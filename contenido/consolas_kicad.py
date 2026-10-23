"""KiCad 7 schematic reader for the «Consolas» views.

Reads .kicad_sch files (s-expressions) and computes, for every sheet instance:
  - wires, buses, junctions, labels (local, global, hierarchical), sheet symbols and pins,
  - every symbol pin in schematic coordinates (lib_symbols + symbol transform, as KiCad does it),
  - the electrical connectivity (wires joined at end points, T joints, junctions, labels, power symbols,
    hierarchical labels <-> sheet pins), and maps each connected group to the net of the netlist exported
    by kicad-cli (by the symbol pins it contains), so geometry and netlist always agree.

Coordinates are millimetres, y down, exactly the space of the SVG that kicad-cli exports.
"""

import math
import os
import re

# ------------------------------------------------------------------ s-expressions

_TOKEN = re.compile(r'\s*(?:(\()|(\))|"((?:[^"\\]|\\.)*)"|([^\s()"]+))', re.S)


class Q(str):
    """A quoted string token (distinguishes "hide" from hide)."""


def parse_sexpr(text):
    stack = [[]]
    pos = 0
    n = len(text)
    while pos < n:
        m = _TOKEN.match(text, pos)
        if not m:
            if text[pos:].strip() == '':
                break
            raise ValueError('s-expression syntax error at %d' % pos)
        pos = m.end()
        if m.group(1):
            stack.append([])
        elif m.group(2):
            done = stack.pop()
            stack[-1].append(done)
        elif m.group(3) is not None:
            stack[-1].append(Q(m.group(3).replace('\\"', '"').replace('\\\\', '\\')))
        else:
            stack[-1].append(m.group(4))
    return stack[0][0]


def head(e):
    return e[0] if isinstance(e, list) and e and isinstance(e[0], str) and not isinstance(e[0], Q) else None


def children(e, name):
    return [c for c in e[1:] if isinstance(c, list) and head(c) == name]


def child(e, name):
    for c in e[1:]:
        if isinstance(c, list) and head(c) == name:
            return c
    return None


def has_flag(e, flag):
    return any(isinstance(c, str) and not isinstance(c, Q) and c == flag for c in e[1:])


def num(x):
    return float(x)


def xy(e):
    return (num(e[1]), num(e[2]))


def at_of(e):
    a = child(e, 'at')
    if not a:
        return (0.0, 0.0, 0.0)
    return (num(a[1]), num(a[2]), num(a[3]) if len(a) > 3 else 0.0)


def prop(e, name):
    for p in children(e, 'property'):
        if p[1] == name:
            return p
    return None


def prop_value(e, name, default=''):
    p = prop(e, name)
    return str(p[2]) if p else default


def effects_info(e):
    """Font size, justification and visibility of a text item's (effects …)."""
    eff = child(e, 'effects')
    size = 1.27
    just = []
    hidden = False
    if eff:
        f = child(eff, 'font')
        if f:
            s = child(f, 'size')
            if s:
                size = num(s[2]) if len(s) > 2 else num(s[1])
        j = child(eff, 'justify')
        if j:
            just = [str(x) for x in j[1:]]
        hidden = has_flag(eff, 'hide')
    return size, just, hidden


# ------------------------------------------------------------------ geometry

def R(v):
    """Grid key: 1e-4 mm."""
    return int(round(v * 10000))


def key(p):
    return (R(p[0]), R(p[1]))


def on_segment(p, a, b, tol=2):
    """Point p strictly inside segment a-b (keys in 1e-4 mm), axis-aligned or diagonal."""
    (px, py), (ax, ay), (bx, by) = p, a, b
    if (px, py) == (ax, ay) or (px, py) == (bx, by):
        return False
    if px < min(ax, bx) - tol or px > max(ax, bx) + tol or py < min(ay, by) - tol or py > max(ay, by) + tol:
        return False
    cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax)
    length = math.hypot(bx - ax, by - ay) or 1
    return abs(cross) / length <= tol


class Transform:
    """KiCad's symbol TRANSFORM (x1, y1, x2, y2): lib (y up) -> schematic (y down)."""

    def __init__(self, x1=1, y1=0, x2=0, y2=-1):
        self.x1, self.y1, self.x2, self.y2 = x1, y1, x2, y2

    def apply(self, x, y):
        return (self.x1 * x + self.y1 * y, self.x2 * x + self.y2 * y)

    def compose(self, t):
        # new = old * temp, as SCH_SYMBOL::SetOrientation does.
        return Transform(self.x1 * t.x1 + self.x2 * t.y1, self.y1 * t.x1 + self.y2 * t.y1,
                         self.x1 * t.x2 + self.x2 * t.y2, self.y1 * t.x2 + self.y2 * t.y2)


def symbol_transform(angle, mirror):
    a = int(round(angle)) % 360
    t = {0: Transform(1, 0, 0, -1), 90: Transform(0, -1, -1, 0),
         180: Transform(-1, 0, 0, 1), 270: Transform(0, 1, 1, 0)}[a]
    if mirror == 'x':
        t = t.compose(Transform(1, 0, 0, -1))
    elif mirror == 'y':
        t = t.compose(Transform(-1, 0, 0, 1))
    return t


# ------------------------------------------------------------------ library symbols

class LibPin:
    __slots__ = ('number', 'name', 'x', 'y', 'angle', 'length', 'unit', 'convert', 'etype', 'hidden')


def lib_pins(libsym):
    """Every pin of a lib symbol, with the unit/convert of the sub-symbol that holds it."""
    name = str(libsym[1])
    base = name.split(':')[-1]
    out = []
    subs = [s for s in children(libsym, 'symbol')]
    for sub in subs:
        sname = str(sub[1])
        m = re.match(re.escape(base) + r'_(\d+)_(\d+)$', sname)
        if not m:
            m = re.search(r'_(\d+)_(\d+)$', sname)
        unit, conv = (int(m.group(1)), int(m.group(2))) if m else (0, 0)
        for p in children(sub, 'pin'):
            lp = LibPin()
            lp.etype = str(p[1])
            lp.hidden = has_flag(p, 'hide')
            x, y, a = at_of(p)
            lp.x, lp.y, lp.angle = x, y, a
            ln = child(p, 'length')
            lp.length = num(ln[1]) if ln else 2.54
            nm = child(p, 'name')
            nb = child(p, 'number')
            lp.name = str(nm[1]) if nm else ''
            lp.number = str(nb[1]) if nb else ''
            lp.unit, lp.convert = unit, conv
            out.append(lp)
    return out


# ------------------------------------------------------------------ sheet model

class Sheet:
    def __init__(self, path_names, uuid_path, file, title):
        self.path = path_names          # '/' or '/CPU/'
        self.uuid_path = uuid_path      # '/root-uuid/sheet-uuid'
        self.file = file
        self.title = title
        self.wires = []                 # ((x1, y1), (x2, y2))
        self.buses = []
        self.bus_entries = []
        self.junctions = []
        self.no_connects = []
        self.labels = []                # dicts: kind, name, x, y, angle, size, shape
        self.symbols = []               # dicts: ref, value, lib_id, x, y, transform, unit, power, pins
        self.sheets = []                # child sheet symbols: name, file, x, y, w, h, pins
        self.texts = []
        self.paper = (420.0, 297.0)


PAPER = {'A4': (297.0, 210.0), 'A3': (420.0, 297.0), 'A2': (594.0, 420.0), 'A1': (841.0, 594.0),
         'A0': (1189.0, 841.0), 'A': (279.4, 215.9), 'B': (431.8, 279.4), 'C': (558.8, 431.8)}


def load_tree(root_file):
    """All sheet instances of a hierarchy, depth first (root first)."""
    base = os.path.dirname(root_file)
    sheets = []

    def visit(fname, path_names, uuid_path, title):
        tree = parse_sexpr(open(fname, encoding='utf-8').read())
        sh = Sheet(path_names, uuid_path, fname, title)
        paper = child(tree, 'paper')
        if paper:
            p = str(paper[1])
            sh.paper = PAPER.get(p, sh.paper)
            if has_flag(paper, 'portrait'):
                sh.paper = (sh.paper[1], sh.paper[0])
        root_uuid = str(child(tree, 'uuid')[1])
        if uuid_path == '':
            uuid_path = '/' + root_uuid
            sh.uuid_path = uuid_path
        libs = {}
        ls = child(tree, 'lib_symbols')
        if ls:
            for s in children(ls, 'symbol'):
                libs[str(s[1])] = s
        read_items(tree, sh, libs)
        sheets.append(sh)
        for cs in sh.sheets:
            child_file = os.path.join(os.path.dirname(fname), cs['file'])
            if not os.path.exists(child_file):
                child_file = os.path.join(base, cs['file'])
            visit(child_file, path_names + cs['name'] + '/', uuid_path + '/' + cs['uuid'], cs['name'])

    visit(root_file, '/', '', 'raíz')
    return sheets


def instance_ref(sym, uuid_path):
    """Reference and unit of a symbol in a given sheet instance (KiCad 7 (instances …))."""
    inst = child(sym, 'instances')
    if inst:
        for proj in children(inst, 'project'):
            for p in children(proj, 'path'):
                if str(p[1]) == uuid_path:
                    r = child(p, 'reference')
                    u = child(p, 'unit')
                    return (str(r[1]) if r else None, int(u[1]) if u else None)
        # single instance: take the first
        for proj in children(inst, 'project'):
            for p in children(proj, 'path'):
                r = child(p, 'reference')
                u = child(p, 'unit')
                return (str(r[1]) if r else None, int(u[1]) if u else None)
    return (None, None)


def read_items(tree, sh, libs):
    for e in tree[1:]:
        h = head(e)
        if h == 'wire' or h == 'bus':
            pts = [xy(p) for p in children(child(e, 'pts'), 'xy')]
            for a, b in zip(pts, pts[1:]):
                (sh.wires if h == 'wire' else sh.buses).append((a, b))
        elif h == 'bus_entry':
            x, y, _ = at_of(e)
            s = child(e, 'size')
            sh.bus_entries.append(((x, y), (x + num(s[1]), y + num(s[2]))))
        elif h == 'junction':
            x, y, _ = at_of(e)
            sh.junctions.append((x, y))
        elif h == 'no_connect':
            x, y, _ = at_of(e)
            sh.no_connects.append((x, y))
        elif h in ('label', 'global_label', 'hierarchical_label'):
            x, y, a = at_of(e)
            size, just, _ = effects_info(e)
            shape = child(e, 'shape')
            sh.labels.append({'kind': {'label': 'local', 'global_label': 'global',
                                       'hierarchical_label': 'hier'}[h],
                              'name': str(e[1]), 'x': x, 'y': y, 'angle': a, 'size': size, 'just': just,
                              'shape': str(shape[1]) if shape else ''})
        elif h == 'text':
            x, y, a = at_of(e)
            size, just, _ = effects_info(e)
            sh.texts.append({'text': str(e[1]), 'x': x, 'y': y, 'angle': a, 'size': size})
        elif h == 'symbol':
            read_symbol(e, sh, libs)
        elif h == 'sheet':
            x, y, _ = at_of(e)
            s = child(e, 'size')
            name = prop_value(e, 'Sheetname') or prop_value(e, 'Sheet name')
            file = prop_value(e, 'Sheetfile') or prop_value(e, 'Sheet file')
            pins = []
            for p in children(e, 'pin'):
                px, py, pa = at_of(p)
                pins.append({'name': str(p[1]), 'x': px, 'y': py, 'angle': pa})
            sh.sheets.append({'name': name, 'file': file, 'x': x, 'y': y, 'w': num(s[1]), 'h': num(s[2]),
                              'uuid': str(child(e, 'uuid')[1]), 'pins': pins})


def read_symbol(e, sh, libs):
    lib_id = str(child(e, 'lib_id')[1])
    lib_name = child(e, 'lib_name')
    libkey = str(lib_name[1]) if lib_name else lib_id
    lib = libs.get(libkey) or libs.get(lib_id)
    x, y, a = at_of(e)
    mirror = None
    m = child(e, 'mirror')
    if m:
        mirror = str(m[1])
    unit_e = child(e, 'unit')
    unit = int(unit_e[1]) if unit_e else 1
    conv_e = child(e, 'convert')
    conv = int(conv_e[1]) if conv_e else 1
    ref, iunit = instance_ref(e, sh.uuid_path)
    if not ref:
        ref = prop_value(e, 'Reference')
    if iunit:
        unit = iunit
    t = symbol_transform(a, mirror)
    power = bool(lib and has_flag(lib, 'power')) or lib_id.startswith('power:')
    in_bom = child(e, 'in_bom')
    pins = []
    if lib is not None:
        for lp in lib_pins(lib):
            if lp.unit not in (0, unit) or lp.convert not in (0, conv):
                continue
            dx, dy = t.apply(lp.x, lp.y)
            # pin direction (lib angle: 0 = pin body extends to +x from its connection point)
            ang = math.radians(lp.angle)
            ex, ey = t.apply(lp.x + lp.length * math.cos(ang), lp.y + lp.length * math.sin(ang))
            pins.append({'number': lp.number, 'name': lp.name, 'type': lp.etype, 'hidden': lp.hidden,
                         'x': x + dx, 'y': y + dy, 'x2': x + ex, 'y2': y + ey})
    # bounding box of the symbol body (graphics of the unit), for hit testing
    bbox = None
    if lib is not None:
        xs, ys = [], []
        base = lib_id.split(':')[-1]
        for sub in children(lib, 'symbol'):
            mm = re.search(r'_(\d+)_(\d+)$', str(sub[1]))
            u, c = (int(mm.group(1)), int(mm.group(2))) if mm else (0, 0)
            if u not in (0, unit) or c not in (0, conv):
                continue
            for g in sub[1:]:
                gh = head(g)
                if gh == 'rectangle':
                    for k in ('start', 'end'):
                        px, py = xy(child(g, k))
                        X, Y = t.apply(px, py)
                        xs.append(x + X)
                        ys.append(y + Y)
                elif gh == 'polyline':
                    for p in children(child(g, 'pts'), 'xy'):
                        X, Y = t.apply(*xy(p))
                        xs.append(x + X)
                        ys.append(y + Y)
                elif gh == 'circle':
                    cx, cy = xy(child(g, 'center'))
                    r = num(child(g, 'radius')[1])
                    for px, py in ((cx - r, cy - r), (cx + r, cy + r)):
                        X, Y = t.apply(px, py)
                        xs.append(x + X)
                        ys.append(y + Y)
                elif gh == 'arc':
                    for k in ('start', 'mid', 'end'):
                        if child(g, k):
                            X, Y = t.apply(*xy(child(g, k)))
                            xs.append(x + X)
                            ys.append(y + Y)
        for p in pins:
            xs += [p['x'], p['x2']]
            ys += [p['y'], p['y2']]
        if xs:
            bbox = (min(xs), min(ys), max(xs), max(ys))
    sh.symbols.append({'ref': ref, 'value': prop_value(e, 'Value'), 'lib_id': lib_id, 'x': x, 'y': y,
                       'unit': unit, 'power': power, 'pins': pins, 'bbox': bbox,
                       'in_bom': not (in_bom and str(in_bom[1]) == 'no')})


# ------------------------------------------------------------------ connectivity

class UF:
    def __init__(self):
        self.p = {}

    def find(self, a):
        p = self.p
        p.setdefault(a, a)
        root = a
        while p[root] != root:
            root = p[root]
        while p[a] != root:
            p[a], a = root, p[a]
        return root

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[ra] = rb


BUS_RE = re.compile(r'^(.*?)\[(\d+)\.\.(\d+)\](.*)$')


def bus_members(name):
    m = BUS_RE.match(name)
    if not m:
        return None
    pre, a, b, post = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4)
    step = 1 if b >= a else -1
    return ['%s%d%s' % (pre, i, post) for i in range(a, b + step, step)]


def connectivity(sheets):
    """Union-find over every sheet instance. Node ids: ('w', s, i) wire, ('p', s, k) pin, ('pt', s, key) point,
    ('L', s, name) local/hier label name, ('G', name) global name."""
    uf = UF()
    info = []
    for si, sh in enumerate(sheets):
        wires = [(key(a), key(b)) for a, b in sh.wires]
        buses = [(key(a), key(b)) for a, b in sh.buses]
        # every connectable point of the sheet
        points = {}

        def add_point(k, node):
            points.setdefault(k, []).append(node)

        for i, (a, b) in enumerate(wires):
            add_point(a, ('w', si, i))
            add_point(b, ('w', si, i))
        pin_nodes = []
        for j, sym in enumerate(sh.symbols):
            for k, p in enumerate(sym['pins']):
                node = ('p', si, j, k)
                add_point(key((p['x'], p['y'])), node)
                pin_nodes.append(node)
                if sym['power'] and p['type'] == 'power_in':
                    # power symbol: a global net named after its (hidden power-input) pin; PWR_FLAG has a
                    # power-output pin and names nothing
                    uf.union(node, ('G', p['name'] or sym['value']))
        label_points = []
        for li, lb in enumerate(sh.labels):
            k = key((lb['x'], lb['y']))
            node = ('lb', si, li)
            label_points.append((k, node, lb))
        sheet_pin_points = []
        for ci, cs in enumerate(sh.sheets):
            for pi, sp in enumerate(cs['pins']):
                k = key((sp['x'], sp['y']))
                node = ('sp', si, ci, pi)
                add_point(k, node)
                sheet_pin_points.append((k, node, cs, sp))
        # labels on a bus are bus labels (not nets)
        bus_label = set()
        for k, node, lb in label_points:
            on_bus = any(k == a or k == b or on_segment(k, a, b) for a, b in buses)
            on_wire = k in points or any(on_segment(k, a, b) for a, b in wires)
            if on_bus and not on_wire:
                bus_label.add(node)
            else:
                add_point(k, node)
        # same point: connected
        for k, nodes in points.items():
            for n in nodes[1:]:
                uf.union(nodes[0], n)
        # T joints: a point on the inside of a wire joins it
        for k, nodes in points.items():
            for i, (a, b) in enumerate(wires):
                if on_segment(k, a, b):
                    uf.union(nodes[0], ('w', si, i))
        # junctions on the inside of wires (crossings)
        for jx in sh.junctions:
            k = key(jx)
            ws = [i for i, (a, b) in enumerate(wires) if k == a or k == b or on_segment(k, a, b)]
            for i in ws[1:]:
                uf.union(('w', si, ws[0]), ('w', si, i))
        # labels by name
        for k, node, lb in label_points:
            if node in bus_label:
                continue
            if lb['kind'] == 'global':
                uf.union(node, ('G', lb['name']))
            else:
                uf.union(node, ('L', si, lb['name']))
        info.append({'wires': wires, 'buses': buses, 'bus_label': bus_label, 'pin_nodes': pin_nodes,
                     'sheet_pins': sheet_pin_points})
    # hierarchical: sheet pin <-> hierarchical label of the child instance
    by_uuid = {sh.uuid_path: i for i, sh in enumerate(sheets)}
    for si, sh in enumerate(sheets):
        for k, node, cs, sp in info[si]['sheet_pins']:
            ci = by_uuid.get(sh.uuid_path + '/' + cs['uuid'])
            if ci is None:
                continue
            members = bus_members(sp['name'])
            if members:
                for m in members:
                    uf.union(('L', si, m), ('L', ci, m))
            else:
                uf.union(node, ('L', ci, sp['name']))
    return uf, info


def map_nets(sheets, uf, info, netlist):
    """Group -> netlist net name, through the symbol pins of each group. Returns (group_net, problems)."""
    pin_net = {}
    for n in netlist['nets']:
        for nd in n['nodes']:
            pin_net[(nd['ref'], nd['pin'])] = n['name']
    group_nets = {}
    for si, sh in enumerate(sheets):
        for j, sym in enumerate(sh.symbols):
            if sym['power']:
                continue
            for k, p in enumerate(sym['pins']):
                net = pin_net.get((sym['ref'], p['number']))
                if net is None:
                    continue
                g = uf.find(('p', si, j, k))
                group_nets.setdefault(g, set()).add(net)
    problems = [(g, sorted(v)) for g, v in group_nets.items() if len(v) > 1]
    group_net = {g: sorted(v)[0] for g, v in group_nets.items()}
    # groups without pins of real parts: named by their global/power name when the netlist has it
    names = {n['name'] for n in netlist['nets']}
    for g_node in list(uf.p.keys()):
        if g_node[0] == 'G':
            g = uf.find(g_node)
            if g not in group_net:
                for cand in (g_node[1], '/' + g_node[1]):
                    if cand in names:
                        group_net[g] = cand
                        break
    return group_net, problems
