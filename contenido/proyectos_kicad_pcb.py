"""KiCad 7 board reader for the «Proyectos KiCad» views.

Reads a .kicad_pcb (s-expressions, the reader of consolas_kicad) and returns plain Python data in board
millimetres (y down, KiCad's own frame): outline, layers, nets, footprints with their pads in absolute
coordinates, tracks, vias, filled zones and rule areas. Also:
  - copper connectivity (union-find over pads, track ends, vias and zone fills) to check that every net is
    one piece of copper, as the DRC claims;
  - the mapping of every footprint (library id, value, fabrication outline) to a 3D model type and its
    parameters for the procedural model library of the app.

Rotation: KiCad angles are counter-clockwise on screen (y down). A footprint at (X, Y, a) maps a local point
(x, y) to (X + x cos a + y sin a, Y - x sin a + y cos a). Pad angles in the file are absolute.
"""

import math
import re

import consolas_kicad as K

head, child, children, has_flag = K.head, K.child, K.children, K.has_flag


def num(v):
    return float(v)


def rot(x, y, a_deg):
    a = math.radians(a_deg)
    c, s = math.cos(a), math.sin(a)
    return (x * c + y * s, -x * s + y * c)


# ------------------------------------------------------------------ reading

def fp_text(fp, kind):
    for t in children(fp, 'fp_text'):
        if str(t[1]) == kind:
            return str(t[2])
    for p in children(fp, 'property'):  # KiCad 8 style, just in case
        if str(p[1]).lower() == kind:
            return str(p[2])
    return ''


def stroke_w(e):
    s = child(e, 'stroke')
    if s:
        w = child(s, 'width')
        if w:
            return num(w[1])
    w = child(e, 'width')
    return num(w[1]) if w else 0.1


def graphics(fp, layers):
    """Footprint graphics on the given layers, in LOCAL coordinates: list of (layer, kind, data, width, fill)."""
    out = []
    for e in fp[1:]:
        h = head(e)
        if h not in ('fp_line', 'fp_rect', 'fp_circle', 'fp_arc', 'fp_poly'):
            continue
        ly = child(e, 'layer')
        if not ly or str(ly[1]) not in layers:
            continue
        L = str(ly[1])
        w = stroke_w(e)
        fill = child(e, 'fill')
        filled = bool(fill and str(fill[1]) in ('solid', 'yes'))
        if h == 'fp_line':
            out.append((L, 'line', [K.xy(child(e, 'start')), K.xy(child(e, 'end'))], w, False))
        elif h == 'fp_rect':
            (x0, y0), (x1, y1) = K.xy(child(e, 'start')), K.xy(child(e, 'end'))
            out.append((L, 'poly', [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)], w, filled))
        elif h == 'fp_circle':
            c = K.xy(child(e, 'center'))
            p = K.xy(child(e, 'end'))
            out.append((L, 'circle', [c, math.hypot(p[0] - c[0], p[1] - c[1])], w, filled))
        elif h == 'fp_arc':
            s, m, en = K.xy(child(e, 'start')), K.xy(child(e, 'mid')), K.xy(child(e, 'end'))
            out.append((L, 'line', arc_points(s, m, en), w, False))
        elif h == 'fp_poly':
            pts = [K.xy(p) for p in children(child(e, 'pts'), 'xy')]
            if pts and pts[0] != pts[-1]:
                pts.append(pts[0])
            out.append((L, 'poly', pts, w, filled))
    return out


def arc_points(s, m, e, step_deg=10):
    """Circular arc through start, mid and end -> polyline."""
    ax, ay = s
    bx, by = m
    cx, cy = e
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if abs(d) < 1e-12:
        return [s, e]
    ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
    uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d
    r = math.hypot(ax - ux, ay - uy)
    a0 = math.atan2(ay - uy, ax - ux)
    a1 = math.atan2(by - uy, bx - ux)
    a2 = math.atan2(cy - uy, cx - ux)

    def norm(a):
        while a < 0:
            a += 2 * math.pi
        while a >= 2 * math.pi:
            a -= 2 * math.pi
        return a
    d1 = norm(a1 - a0)
    d2 = norm(a2 - a0)
    sweep = d2 if d1 <= d2 else d2 - 2 * math.pi
    n = max(2, int(abs(math.degrees(sweep)) / step_deg) + 1)
    return [(ux + r * math.cos(a0 + sweep * i / n), uy + r * math.sin(a0 + sweep * i / n)) for i in range(n + 1)]


_NET_REV = {}  # net name -> number of the board being read (KiCad 10 boards name their nets, without a table)


def net_id(node, nets):
    """Number of the net of a (net …) node: KiCad ≤ 9 writes the number, KiCad 10 only the name."""
    if not node or len(node) < 2:
        return 0
    v = str(node[1])
    if v.lstrip('-').isdigit():
        return int(v)
    if not v:
        return 0
    if v not in _NET_REV:
        _NET_REV[v] = max(list(nets) + [0]) + 1
        nets[_NET_REV[v]] = v
    return _NET_REV[v]


def read_board(path):
    tree = K.parse_sexpr(open(path, encoding='utf-8').read())
    _NET_REV.clear()
    b = {'nets': {}, 'footprints': [], 'tracks': [], 'arcs': [], 'vias': [], 'zones': [], 'areas': [],
         'edges': [], 'thickness': 1.6, 'copper': [], 'texts': []}
    g = child(tree, 'general')
    if g and child(g, 'thickness'):
        b['thickness'] = num(child(g, 'thickness')[1])
    for ly in child(tree, 'layers')[1:]:
        if isinstance(ly, list) and len(ly) >= 3 and str(ly[2]) in ('signal', 'power', 'mixed', 'jumper'):
            b['copper'].append(str(ly[1]))
    setup = child(tree, 'setup')
    b['stackup'] = None
    b['mask_clearance'] = 0.0
    if setup:
        st = child(setup, 'stackup')
        if st:
            b['stackup'] = st
        pm = child(setup, 'pad_to_mask_clearance')
        if pm:
            b['mask_clearance'] = num(pm[1])
    for n in children(tree, 'net'):
        b['nets'][int(n[1])] = str(n[2])
    for e in tree[1:]:
        h = head(e)
        if h in ('gr_line', 'gr_rect', 'gr_arc', 'gr_circle', 'gr_poly'):
            ly = child(e, 'layer')
            if ly and str(ly[1]) == 'Edge.Cuts':
                if h == 'gr_line':
                    b['edges'].append([K.xy(child(e, 'start')), K.xy(child(e, 'end'))])
                elif h == 'gr_rect':
                    (x0, y0), (x1, y1) = K.xy(child(e, 'start')), K.xy(child(e, 'end'))
                    b['edges'].append([(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)])
                elif h == 'gr_arc':
                    b['edges'].append(arc_points(K.xy(child(e, 'start')), K.xy(child(e, 'mid')), K.xy(child(e, 'end'))))
                elif h == 'gr_poly':
                    pts = [K.xy(p) for p in children(child(e, 'pts'), 'xy')]
                    b['edges'].append(pts + [pts[0]])
        elif h == 'gr_text':
            ly = child(e, 'layer')
            x, y, a = K.at_of(e)
            b['texts'].append({'text': str(e[1]), 'layer': str(ly[1]) if ly else '', 'x': x, 'y': y})
        elif h == 'segment':
            b['tracks'].append({'a': K.xy(child(e, 'start')), 'b': K.xy(child(e, 'end')), 'w': num(child(e, 'width')[1]),
                                'layer': str(child(e, 'layer')[1]), 'net': net_id(child(e, 'net'), b['nets'])})
        elif h == 'arc':
            pts = arc_points(K.xy(child(e, 'start')), K.xy(child(e, 'mid')), K.xy(child(e, 'end')))
            for p0, p1 in zip(pts, pts[1:]):
                b['tracks'].append({'a': p0, 'b': p1, 'w': num(child(e, 'width')[1]),
                                    'layer': str(child(e, 'layer')[1]), 'net': net_id(child(e, 'net'), b['nets'])})
        elif h == 'via':
            ly = child(e, 'layers')
            b['vias'].append({'p': K.xy(child(e, 'at')), 'd': num(child(e, 'size')[1]), 'drill': num(child(e, 'drill')[1]),
                              'layers': [str(x) for x in ly[1:]] if ly else ['F.Cu', 'B.Cu'], 'net': net_id(child(e, 'net'), b['nets'])})
        elif h == 'zone':
            read_zone(e, b)
        elif h == 'footprint':
            b['footprints'].append(read_footprint(e, b['nets']))
    return b


def read_zone(e, b):
    net = net_id(child(e, 'net'), b['nets'])
    if child(e, 'keepout'):
        ko = child(e, 'keepout')
        rules = {str(r[0]): str(r[1]) for r in ko[1:] if isinstance(r, list) and len(r) > 1}
        poly = child(e, 'polygon')
        pts = [K.xy(p) for p in children(child(poly, 'pts'), 'xy')] if poly else []
        ly = child(e, 'layers') or child(e, 'layer')
        layers = [str(x) for x in ly[1:]] if ly else []
        nm = child(e, 'name')
        b['areas'].append({'pts': pts, 'layers': layers, 'rules': rules, 'name': str(nm[1]) if nm else ''})
        return
    for fp in children(e, 'filled_polygon'):
        ly = child(fp, 'layer')
        pts = [K.xy(p) for p in children(child(fp, 'pts'), 'xy')]
        b['zones'].append({'net': net, 'layer': str(ly[1]), 'pts': pts})


PAD_SHAPES = {'circle': 'c', 'rect': 'r', 'oval': 'o', 'roundrect': 'rr', 'trapezoid': 't', 'custom': 'x'}


def read_footprint(fp, nets):
    lib = str(fp[1])
    X, Y, A = K.at_of(fp)
    side = 'B' if str(child(fp, 'layer')[1]) == 'B.Cu' else 'F'
    attr = child(fp, 'attr')
    attrs = [str(x) for x in attr[1:]] if attr else []
    f = {'ref': fp_text(fp, 'reference'), 'value': fp_text(fp, 'value'), 'lib': lib, 'x': X, 'y': Y, 'rot': A,
         'side': side, 'attrs': attrs, 'pads': [], 'descr': '', 'model': ''}
    d = child(fp, 'descr')
    if d:
        f['descr'] = str(d[1])
    m = child(fp, 'model')
    if m:
        f['model'] = str(m[1])
    for p in children(fp, 'pad'):
        px, py, pa = K.at_of(p)
        dx, dy = rot(px, py, A)
        size = child(p, 'size')
        dr = child(p, 'drill')
        drill = None
        if dr:
            vals = [x for x in dr[1:] if not isinstance(x, list)]
            if vals and str(vals[0]) == 'oval':
                drill = (num(vals[1]), num(vals[2]) if len(vals) > 2 else num(vals[1]))
            elif vals:
                drill = (num(vals[0]), num(vals[0]))
        lys = child(p, 'layers')
        layers = [str(x) for x in lys[1:]] if lys else []
        netn = child(p, 'net')
        rr = child(p, 'roundrect_rratio')
        smm = child(p, 'solder_mask_margin')
        f['pads'].append({'num': str(p[1]), 'type': str(p[2]), 'shape': str(p[3]), 'x': X + dx, 'y': Y + dy,
                          'lx': px, 'ly': py, 'rot': pa, 'w': num(size[1]), 'h': num(size[2]),
                          'rr': num(rr[1]) if rr else 0.0, 'drill': drill, 'layers': layers,
                          'net': net_id(netn, nets), 'mask_margin': num(smm[1]) if smm else None})
    f['graphics'] = graphics(fp, ('F.Fab', 'B.Fab', 'F.CrtYd', 'B.CrtYd', 'F.SilkS', 'B.SilkS'))
    return f


# ------------------------------------------------------------------ outline

def outline(edges):
    """Chains Edge.Cuts segments into closed loops (largest first)."""
    segs = []
    for e in edges:
        for a, b in zip(e, e[1:]):
            segs.append((a, b))
    loops = []
    used = [False] * len(segs)

    def close(p, q):
        return abs(p[0] - q[0]) < 1e-3 and abs(p[1] - q[1]) < 1e-3

    for i in range(len(segs)):
        if used[i]:
            continue
        used[i] = True
        loop = [segs[i][0], segs[i][1]]
        changed = True
        while changed and not close(loop[0], loop[-1]):
            changed = False
            for j in range(len(segs)):
                if used[j]:
                    continue
                a, b = segs[j]
                if close(loop[-1], a):
                    loop.append(b)
                elif close(loop[-1], b):
                    loop.append(a)
                else:
                    continue
                used[j] = True
                changed = True
                break
        loops.append(loop)

    def area(l):
        return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(l, l[1:]))) / 2
    loops.sort(key=area, reverse=True)
    return loops


# ------------------------------------------------------------------ pad geometry

def pad_polygon(p, grow=0.0, seg=8):
    """Absolute outline of a pad (closed list of points); `grow` enlarges it (mask openings)."""
    w, h = p['w'] + 2 * grow, p['h'] + 2 * grow
    shape = p['shape']
    pts = []
    if shape == 'circle':
        r = w / 2
        for i in range(seg * 4):
            t = 2 * math.pi * i / (seg * 4)
            pts.append((r * math.cos(t), r * math.sin(t)))
    else:
        if shape == 'oval':
            r = min(w, h) / 2
        elif shape == 'roundrect':
            r = min(w, h) * p['rr'] + grow
            r = min(r, min(w, h) / 2)
        else:
            r = 0.0
        hw, hh = w / 2, h / 2
        if r <= 1e-6:
            pts = [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]
        else:
            for cx, cy, a0 in ((hw - r, -hh + r, -90), (hw - r, hh - r, 0), (-hw + r, hh - r, 90), (-hw + r, -hh + r, 180)):
                for i in range(seg + 1):
                    t = math.radians(a0 + 90 * i / seg)
                    pts.append((cx + r * math.cos(t), cy + r * math.sin(t)))
    out = []
    for x, y in pts:
        dx, dy = rot(x, y, p['rot'])
        out.append((p['x'] + dx, p['y'] + dy))
    out.append(out[0])
    return out


def pad_on_layer(p, layer):
    ls = p['layers']
    if layer in ls:
        return True
    side = layer.split('.')[0]
    kind = layer.split('.', 1)[1]
    if '*.' + kind in ls:
        return True
    if (side + '&B.' + kind) in ls or ('F&B.' + kind) in ls:
        return True
    return False


def point_in_pad(p, x, y, tol=0.0):
    dx, dy = x - p['x'], y - p['y']
    lx, ly = rot(dx, dy, -p['rot'])
    hw, hh = p['w'] / 2 + tol, p['h'] / 2 + tol
    if p['shape'] == 'circle':
        return math.hypot(lx, ly) <= p['w'] / 2 + tol
    if p['shape'] == 'oval':
        r = min(hw, hh)
        if hw > hh:
            cx = max(-(hw - r), min(hw - r, lx))
            return math.hypot(lx - cx, ly) <= r
        cy = max(-(hh - r), min(hh - r, ly))
        return math.hypot(lx, ly - cy) <= r
    return abs(lx) <= hw and abs(ly) <= hh


def point_in_poly(x, y, pts):
    inside = False
    n = len(pts)
    j = n - 1
    for i in range(n):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-30) + xi:
            inside = not inside
        j = i
    return inside


# ------------------------------------------------------------------ copper connectivity

def islands(b):
    """Pieces of copper per net: returns {net: [[pad keys «REF.N»] per island]} (nets with ≥ 2 pads)."""
    parent = {}

    def find(a):
        parent.setdefault(a, a)
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a, c):
        ra, rc = find(a), find(c)
        if ra != rc:
            parent[ra] = rc

    pads = []
    for f in b['footprints']:
        for p in f['pads']:
            if p['net'] and p['type'] != 'np_thru_hole':
                key = ('p', f['ref'], p['num'], id(p))
                pads.append((key, p, f['ref']))
                find(key)
    by_net = {}
    for key, p, ref in pads:
        by_net.setdefault(p['net'], []).append((key, p))
    tracks_by = {}
    for i, t in enumerate(b['tracks']):
        tracks_by.setdefault(t['net'], []).append((('t', i), t))
    vias_by = {}
    for i, v in enumerate(b['vias']):
        vias_by.setdefault(v['net'], []).append((('v', i), v))
    zones_by = {}
    for i, z in enumerate(b['zones']):
        zones_by.setdefault(z['net'], []).append((('z', i), z))
    for net in by_net:
        ps = by_net[net]
        ts = tracks_by.get(net, [])
        vs = vias_by.get(net, [])
        zs = zones_by.get(net, [])
        # through-hole pads join both layers by themselves; a track end inside a pad (same layer) joins it
        for tk, t in ts:
            for end in (t['a'], t['b']):
                for pk, p in ps:
                    if pad_on_layer(p, t['layer']) and point_in_pad(p, end[0], end[1], 0.01):
                        union(tk, pk)
                for vk, v in vs:
                    if math.hypot(end[0] - v['p'][0], end[1] - v['p'][1]) <= v['d'] / 2 + 0.01:
                        union(tk, vk)
        # track to track: shared end, or an end on the other track (T joint)
        for i in range(len(ts)):
            ka, ta = ts[i]
            for j in range(i + 1, len(ts)):
                kb, tb = ts[j]
                if ta['layer'] != tb['layer']:
                    continue
                if any(_near_seg(e, tb['a'], tb['b'], (ta['w'] + tb['w']) / 4) for e in (ta['a'], ta['b'])) or \
                        any(_near_seg(e, ta['a'], ta['b'], (ta['w'] + tb['w']) / 4) for e in (tb['a'], tb['b'])):
                    union(ka, kb)
        # zones: pads (centre or any corner inside), vias and track ends inside the fill
        for zk, z in zs:
            pts = z['pts']
            xs = [q[0] for q in pts]
            ys = [q[1] for q in pts]
            bx0, bx1, by0, by1 = min(xs), max(xs), min(ys), max(ys)

            def inside(x, y):
                return bx0 <= x <= bx1 and by0 <= y <= by1 and point_in_poly(x, y, pts)
            for pk, p in ps:
                if not pad_on_layer(p, z['layer']):
                    continue
                poly = pad_polygon(p, 0.0, 2)
                if any(inside(x, y) for x, y in poly[::max(1, len(poly) // 8)]):
                    union(zk, pk)
            for vk, v in vs:
                r = v['d'] / 2
                if any(inside(v['p'][0] + dx, v['p'][1] + dy) for dx, dy in ((r, 0), (-r, 0), (0, r), (0, -r))):
                    union(zk, vk)
            for tk, t in ts:
                if t['layer'] == z['layer'] and (inside(*t['a']) or inside(*t['b'])):
                    union(zk, tk)
        # pads of the same footprint and number on different copper (THT) are one piece: already one key
    out = {}
    for net, ps in by_net.items():
        groups = {}
        for pk, p in ps:
            groups.setdefault(find(pk), []).append('%s.%s' % (pk[1], pk[2]))
        if len(ps) >= 2:
            out[net] = sorted(groups.values(), key=len, reverse=True)
    return out


def _near_seg(p, a, b, tol):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    t = ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2 if l2 else 0
    t = max(0.0, min(1.0, t))
    return math.hypot(ax + t * dx - p[0], ay + t * dy - p[1]) <= tol + 1e-3


# ------------------------------------------------------------------ 3D model mapping

def fab_box(f, layer_prefix='F'):
    """Local bounding box of the fabrication outline (or the courtyard), as (x0, y0, x1, y1)."""
    for want in (layer_prefix + '.Fab', layer_prefix + '.CrtYd'):
        xs, ys = [], []
        for L, kind, data, w, fill in f['graphics']:
            if L != want:
                continue
            if kind == 'circle':
                (cx, cy), r = data
                xs += [cx - r, cx + r]
                ys += [cy - r, cy + r]
            else:
                xs += [q[0] for q in data]
                ys += [q[1] for q in data]
        if xs:
            return (min(xs), min(ys), max(xs), max(ys))
    xs = [p['lx'] for p in f['pads']] or [0]
    ys = [p['ly'] for p in f['pads']] or [0]
    return (min(xs) - 1, min(ys) - 1, max(xs) + 1, max(ys) + 1)


def _f(rx, s, default=None):
    m = re.search(rx, s)
    return float(m.group(1)) if m else default


SI = {'p': 1e-12, 'n': 1e-9, 'u': 1e-6, 'µ': 1e-6, 'm': 1e-3, 'k': 1e3, 'K': 1e3, 'M': 1e6, 'G': 1e9, 'R': 1, 'r': 1}


def parse_value(v):
    """«4k7», «0R1», «2.2u», «100n 50V», «10 Ohm» -> number (SI) or None."""
    s = v.strip().split()[0] if v.strip() else ''
    s = s.replace(',', '.').replace('Ω', '').replace('ohm', '').replace('Ohm', '')
    m = re.match(r'^(\d+)([pnuµmkKMGRr])(\d+)$', s)
    if m:
        return float(m.group(1) + '.' + m.group(3)) * SI[m.group(2)]
    m = re.match(r'^(\d+(?:\.\d+)?)([pnuµmkKMGRr]?)[FHΩAVW]?$', s)
    if m:
        return float(m.group(1)) * (SI[m.group(2)] if m.group(2) else 1)
    return None


def model_for(f, extra=None):
    """3D model descriptor: {'tipo': …, parameters…} from the footprint library id, its value and its outline.
    Dimensions in mm; heights from the package standards when the footprint does not give them."""
    lib = f['lib']
    name = lib.split(':')[-1]
    val = f['value']
    box = fab_box(f, f['side'])
    bw, bh = round(box[2] - box[0], 3), round(box[3] - box[1], 3)
    cx, cy = round((box[0] + box[2]) / 2, 3), round((box[1] + box[3]) / 2, 3)
    pads = f['pads']
    n_pads = len([p for p in pads if p['type'] != 'np_thru_hole'])
    pitch = _f(r'_P(\d+(?:\.\d+)?)mm', name)
    d = {'caja': [round(box[0], 3), round(box[1], 3), round(box[2], 3), round(box[3], 3)]}
    v = parse_value(val)
    if name.startswith('MountingHole'):
        return dict(d, tipo='taladro', diametro=_f(r'_(\d+(?:\.\d+)?)mm', name, 3.2))
    if name.startswith('R_Axial_Shunt'):
        return dict(d, tipo='resistencia_shunt', largo=_f(r'_L(\d+(?:\.\d+)?)mm', name), ancho=_f(r'_W(\d+(?:\.\d+)?)mm', name),
                    paso=pitch, valor=v)
    if name.startswith('R_Axial'):
        din = _f(r'DIN(\d{4})', name)
        return dict(d, tipo='resistencia_axial', largo=_f(r'_L(\d+(?:\.\d+)?)mm', name), diametro=_f(r'_D(\d+(?:\.\d+)?)mm', name),
                    paso=pitch, valor=v, texto=val, potencia={207: 0.25, 309: 0.5, 414: 1.0, 617: 2.0}.get(int(din or 0)))
    if re.match(r'^(R|C|L)_(0402|0603|0805|1206|1210|2512)', name):
        size = re.match(r'^[RCL]_(\d{4})', name).group(1)
        kind = {'R': 'resistencia_smd', 'C': 'condensador_smd', 'L': 'inductor_smd'}[name[0]]
        if f['ref'].startswith('FB'):
            kind = 'ferrita_smd'
        dims = {'0402': (1.0, 0.5, 0.35), '0603': (1.6, 0.8, 0.45), '0805': (2.0, 1.25, 0.5), '1206': (3.2, 1.6, 0.55),
                '1210': (3.2, 2.5, 0.6), '2512': (6.3, 3.2, 0.6)}[size]
        if kind == 'condensador_smd':
            dims = (dims[0], dims[1], {'0805': 0.85, '1206': 1.1}.get(size, dims[1] * 0.8))
        return dict(d, tipo=kind, encapsulado=size, largo=dims[0], ancho=dims[1], alto=dims[2], valor=v, texto=val)
    if name.startswith('CP_Radial'):
        dia = _f(r'_D(\d+(?:\.\d+)?)mm', name)
        alto = {5.0: 11.0, 6.3: 11.0, 8.0: 11.5, 10.0: 16.0, 12.5: 20.0, 16.0: 25.0, 35.0: 52.0}.get(dia, dia * 1.6)
        return dict(d, tipo='electrolitico', diametro=dia, alto=alto, paso=pitch, snap_in='SnapIn' in name, valor=v, texto=val)
    if name.startswith('C_Disc'):
        return dict(d, tipo='condensador_disco', diametro=_f(r'_D(\d+(?:\.\d+)?)mm', name), grueso=_f(r'_W(\d+(?:\.\d+)?)mm', name),
                    paso=pitch, valor=v, texto=val)
    if name.startswith('C_Rect'):
        L = _f(r'_L(\d+(?:\.\d+)?)mm', name)
        W = _f(r'_W(\d+(?:\.\d+)?)mm', name)
        return dict(d, tipo='condensador_film', largo=L, ancho=W, alto=round(max(W * 1.6, 6.5 if L < 9 else 9.0), 2), paso=pitch,
                    valor=v, texto=val)
    if name.startswith(('D_DO-', 'D_P600')) or (name.startswith('D_') and 'Horizontal' in name):
        pk = re.match(r'^D_([A-Z0-9-]+?)(?:_SOD\d+)?_P', name)
        pkg = pk.group(1) if pk else 'DO-41'
        dims = {'DO-35': (3.8, 1.9), 'DO-41': (5.2, 2.7), 'DO-15': (7.6, 3.6), 'DO-201AD': (9.5, 5.3), 'P600': (9.1, 9.1)}.get(pkg, (5.2, 2.7))
        vidrio = pkg == 'DO-35'
        return dict(d, tipo='diodo_axial', encapsulado=pkg, largo=dims[0], diametro=dims[1], paso=pitch, vidrio=vidrio, texto=val)
    if name.startswith('D_SOD-123'):
        return dict(d, tipo='diodo_smd', encapsulado='SOD-123', largo=2.7, ancho=1.6, alto=1.15, texto=val)
    if name.startswith('Diode_Bridge'):
        return dict(d, tipo='puente_gbu', largo=22.0, ancho=3.5, alto=18.0, texto=val, pines=n_pads)
    if name.startswith('LED_D'):
        col = 'verde' if re.search(r'verde|green|grn', val, re.I) else 'rojo' if re.search(r'rojo|red', val, re.I) else \
            'amarillo' if re.search(r'amar|yell', val, re.I) else 'azul' if re.search(r'azul|blue', val, re.I) else 'rojo'
        return dict(d, tipo='led', diametro=_f(r'_D(\d+(?:\.\d+)?)mm', name, 3.0), color=col, texto=val)
    m = re.match(r'^(DIP|SOIC|MSOP|TSSOP|SSOP)-(\d+)', name)
    if m:
        fam, n = m.group(1), int(m.group(2))
        if fam == 'DIP':
            return dict(d, tipo='dip', pines=n, ancho_filas=_f(r'_W(\d+(?:\.\d+)?)mm', name, 7.62), zocalo='Socket' in name, texto=val)
        size = re.search(r'_(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)mm', name)
        bw2, bl2 = (float(size.group(1)), float(size.group(2))) if size else (3.9, 4.9)
        return dict(d, tipo=fam.lower(), pines=n, cuerpo_ancho=bw2, cuerpo_largo=bl2, paso=pitch or 1.27,
                    alto=1.1 if fam == 'MSOP' else 1.6, texto=val)
    if name.startswith('SOT-23'):
        return dict(d, tipo='sot23', pines=n_pads, texto=val)
    m = re.match(r'^TO-(\d+)(P)?-(\d+)_(Vertical|Horizontal)', name)
    if m:
        pkg = 'TO-%s%s' % (m.group(1), m.group(2) or '')
        return dict(d, tipo='to', encapsulado=pkg, pines=int(m.group(3)), vertical=m.group(4) == 'Vertical', texto=val)
    if name.startswith('TO-92'):
        return dict(d, tipo='to92', texto=val)
    if name.startswith('Crystal_SMD'):
        return dict(d, tipo='cristal_smd', largo=3.2, ancho=2.5, alto=0.8, texto=val)
    if name.startswith(('PinHeader', 'PinSocket', 'IDC-Header')):
        m2 = re.search(r'_(\d+)x(\d+)_P(\d+(?:\.\d+)?)mm', name)
        filas, cols = (int(m2.group(1)), int(m2.group(2))) if m2 else (1, n_pads)
        kind = 'zocalo_hembra' if name.startswith('PinSocket') else 'idc' if name.startswith('IDC') else 'tira_pines'
        return dict(d, tipo=kind, filas=filas, columnas=cols, paso=_f(r'_P(\d+(?:\.\d+)?)mm', name, 2.54), texto=val)
    if name.startswith('JST_XH'):
        m2 = re.search(r'_1x(\d+)_', name)
        return dict(d, tipo='jst_xh', pines=int(m2.group(1)) if m2 else n_pads, paso=2.5, texto=val)
    if name.startswith('TerminalBlock'):
        m2 = re.search(r'MKDS-(\d+(?:,\d+)?)-(\d+)-', name)
        return dict(d, tipo='borna', pines=int(m2.group(2)) if m2 else n_pads, paso=pitch or 5.08,
                    serie=('MKDS-' + m2.group(1)) if m2 else 'MKDS', texto=val)
    if name.startswith('TestPoint_Keystone'):
        col = {'5000': 'rojo', '5001': 'negro', '5002': 'blanco', '5003': 'naranja', '5004': 'amarillo'}
        mpn = (extra or {}).get('mpn', '')
        c = 'rojo'
        for k2, c2 in col.items():
            if k2 in mpn:
                c = c2
        return dict(d, tipo='punto_prueba', forma='keystone', color=c, texto=val)
    if name.startswith('TestPoint_Loop'):
        return dict(d, tipo='punto_prueba', forma='lazo', color='metal', texto=val)
    if name.startswith('TestPoint_THTPad'):
        return dict(d, tipo='punto_prueba', forma='pad', color='metal', texto=val)
    if name.startswith('Fuseholder'):
        return dict(d, tipo='portafusibles', largo=20.0, diametro=5.0, paso=pitch or 20.5, texto=val)
    if name.startswith('Fuse_Bourns'):
        return dict(d, tipo='ptc_radial', ancho=bw, alto=12.0, texto=val)
    if name.startswith('L_Toroid'):
        return dict(d, tipo='toroide', diametro=_f(r'_L(\d+(?:\.\d+)?)mm', name, 10.0), alto=_f(r'_W(\d+(?:\.\d+)?)mm', name, 5.0),
                    vertical='Vertical' in name, texto=val)
    if name.startswith('Toroid_FT37'):
        return dict(d, tipo='toroide', diametro=9.5, alto=4.8, vertical=False, trifilar=True, texto=val)
    if name.startswith('L_Axial'):
        return dict(d, tipo='bobina_axial', largo=_f(r'_L(\d+(?:\.\d+)?)mm', name), diametro=_f(r'_D(\d+(?:\.\d+)?)mm', name),
                    paso=pitch, texto=val)
    if name.startswith('Relay'):
        return dict(d, tipo='rele', largo=bw, ancho=bh, alto=15.7 if 'G2RL' in name else 10.0,
                    modelo='G2RL-1-E' if 'G2RL' in name else 'G5V-2', texto=val)
    if name.startswith('Potentiometer_Bourns_3296W'):
        return dict(d, tipo='trimmer_multivuelta', largo=9.5, ancho=4.8, alto=10.0, texto=val)
    if name.startswith('Alps_RK163'):
        return dict(d, tipo='potenciometro', doble='Dual' in name, eje=25.0, texto=val)
    if name.startswith('RotaryEncoder'):
        return dict(d, tipo='codificador', alto=20.0, texto=val)
    if name.startswith('SW_CK_JS202011'):
        return dict(d, tipo='conmutador_deslizante', largo=9.0, ancho=3.6, alto=3.5, texto=val)
    if name.startswith('Arduino_Nano'):
        return dict(d, tipo='modulo', modelo='Arduino Nano', largo=bw, ancho=bh, alto=10.0, texto=val)
    if name.startswith('Wuerth_365'):
        # WE-SHC 36503505: 50 × 50 × 3,2 mm (distributor data sheets; the project does not give the height)
        return dict(d, tipo='blindaje', largo=bw, ancho=bh, alto=3.2 if '36503505' in name else 5.0, texto=val)
    if name.startswith('BNC'):
        return dict(d, tipo='bnc', texto=val)
    if name.startswith('BarrelJack'):
        return dict(d, tipo='jack_cc', texto=val)
    if name.startswith('Jack_3.5mm'):
        return dict(d, tipo='jack_audio', texto=val)
    return dict(d, tipo='caja', alto=max(1.0, min(bw, bh) * 0.6), texto=val)


def altura(m):
    """Height above the board (mm) of a model descriptor, from the package (estimate where not stated)."""
    t = m['tipo']
    if t == 'electrolitico':
        return m.get('alto') or 11
    if t == 'toroide':
        return m.get('diametro', 10) if m.get('vertical') else m.get('alto', 5)
    if t in ('condensador_film', 'rele', 'blindaje', 'modulo', 'trimmer_multivuelta', 'codificador'):
        return m.get('alto') or 10
    if t in ('resistencia_axial', 'diodo_axial'):
        return (m.get('diametro') or 2.5) + 0.5
    if t in ('soic', 'msop', 'sot23', 'resistencia_smd', 'condensador_smd', 'diodo_smd', 'cristal_smd', 'ferrita_smd', 'inductor_smd'):
        return m.get('alto') or 1.6
    if t == 'to92':
        return 5.2
    if t == 'to':
        return 15
    if t == 'condensador_disco':
        return (m.get('diametro') or 5) + 1
    if t == 'punto_prueba':
        return 5
    return m.get('alto') or 3
