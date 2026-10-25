"""«Proyectos KiCad»: the four KiCad projects of the book (printed chapters 48-51, sources cap49-cap52).

Reads /home/claude/v3/complementos/kicad (read only; env PROYECTOS_KICAD) and writes, per board, compact data for
the 2D/3D board views and the interactive schematic into web/public/proyectos/:

  indice.json                      projects, boards, companion netlists, summary of the checks
  <placa>.json                     the board: outline, stack, nets, footprints (pads, 3D model, function, block),
                                   copper (tracks, vias, zone fills, rule areas), silkscreen, DC voltages, checks
  <placa>/hoja-0.bin, hoja-0.json  the schematic sheet, in the «Consolas» formats (CSG1 drawing + electrical layer)

Checks (reported in the app and printed here; a hard inconsistency makes main() return 1):
  - PCB pads <-> schematic netlist (kicad-cli sch export netlist): every (ref, pin) on the same net, same partition;
  - every net is one piece of copper (union-find over pads, tracks, vias and zone fills);
  - references, values, footprints and manufacturer part numbers: schematic <-> PCB <-> BOM;
  - board size, layers and component count against the book text and the README; DRC report;
  - chapter numbers printed on the silkscreen against the printed book.

Run alone (python3 contenido/proyectos_kicad.py) or from generar.py (proyectos_kicad.main()).
"""

import csv
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, 'web/public/proyectos')
LIBRO = os.path.join(APP, 'web/public/libro')
CACHE = os.path.join(HERE, '.cache/proyectos')

sys.path.insert(0, HERE)
import consolas_kicad as K          # noqa: E402
import consolas_svg as S            # noqa: E402
import proyectos_kicad_pcb as P     # noqa: E402
import proyectos_kicad_datos as D   # noqa: E402

SRC = os.environ.get('PROYECTOS_KICAD', D.KICAD)


def q(v):
    """mm -> integer hundredths of a millimetre."""
    return int(round(v * 100))


# ------------------------------------------------------------------ kicad-cli with a content cache

def _hash(paths, extra=''):
    h = hashlib.sha1(extra.encode())
    for p in paths:
        with open(p, 'rb') as f:
            h.update(f.read())
    return h.hexdigest()[:16]


def kicad_cli(args, src, out_name, deps=()):
    """Runs kicad-cli once per content of the source (cached in contenido/.cache/proyectos)."""
    key = _hash([src] + list(deps), ' '.join(args))
    folder = os.path.join(CACHE, key)
    target = os.path.join(folder, out_name)
    if os.path.exists(target):
        return target
    os.makedirs(folder, exist_ok=True)
    tmp = folder + '.tmp'
    if os.path.isdir(tmp):
        shutil.rmtree(tmp)
    os.makedirs(tmp)
    dest = os.path.join(tmp, out_name)
    cmd = ['kicad-cli'] + args + ['-o', dest if not out_name.endswith('/') else tmp, src]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    produced = dest if os.path.exists(dest) else None
    if out_name.endswith('/'):
        produced = tmp
    if r.returncode != 0 or not produced:
        raise SystemExit('kicad-cli falló (%s): %s %s' % (' '.join(cmd), r.stdout[-400:], r.stderr[-400:]))
    if out_name.endswith('/'):
        shutil.rmtree(folder, ignore_errors=True)
        os.rename(tmp, folder)
        return folder
    shutil.move(dest, target)
    shutil.rmtree(tmp, ignore_errors=True)
    return target


# ------------------------------------------------------------------ netlist (kicadsexpr)

def read_netlist(path):
    t = K.parse_sexpr(open(path, encoding='utf-8').read())
    comps = {}
    for c in K.children(K.child(t, 'components'), 'comp'):
        ref = str(K.child(c, 'ref')[1])
        fields = {}
        fl = K.child(c, 'fields')
        if fl:
            for f in K.children(fl, 'field'):
                nm = K.child(f, 'name')
                fields[str(nm[1])] = str(f[-1]) if len(f) > 2 and not isinstance(f[-1], list) else ''
        lib = K.child(c, 'libsource')
        fp = K.child(c, 'footprint')
        desc = K.child(lib, 'description') if lib else None
        comps[ref] = {'value': str(K.child(c, 'value')[1]), 'footprint': str(fp[1]) if fp else '',
                      'lib': ('%s:%s' % (K.child(lib, 'lib')[1], K.child(lib, 'part')[1])) if lib else '',
                      'description': str(desc[1]) if desc else '', 'fields': fields}
    nets = []
    for n in K.children(K.child(t, 'nets'), 'net'):
        nodes = []
        for nd in K.children(n, 'node'):
            pf = K.child(nd, 'pinfunction')
            nodes.append({'ref': str(K.child(nd, 'ref')[1]), 'pin': str(K.child(nd, 'pin')[1]),
                          'function': str(pf[1]) if pf else ''})
        nets.append({'name': str(K.child(n, 'name')[1]), 'nodes': nodes})
    return {'components': comps, 'nets': nets}


def plain(name):
    """Schematic net name «/VIN_RAW» -> board net name «VIN_RAW»."""
    return name[1:] if name.startswith('/') and name.count('/') == 1 else name


# ------------------------------------------------------------------ silkscreen from kicad-cli's SVG plot

def silk_layer(svg_file):
    """Polylines of a plotted layer grouped by stroke width (mm), plus filled polygons. Board coordinates."""
    root = ET.parse(svg_file).getroot()
    ns = '{http://www.w3.org/2000/svg}'
    lineas = {}
    rellenos = []
    circulos = []

    def walk(g, st):
        st = dict(st)
        if g.get('style'):
            st.update(S._style(g.get('style')))
        filled = float(st.get('fill-opacity', '1') or 1) > 0.5
        width = float(st.get('stroke-width', '0') or 0)
        for el in g:
            tag = el.tag.replace(ns, '')
            if tag == 'g':
                walk(el, st)
                continue
            if tag in ('text', 'desc', 'title'):
                continue
            if tag == 'path':
                for pts, closed in S._path_polylines(el.get('d', '')):
                    if len(pts) < 2:
                        continue
                    if filled:
                        rellenos.append(pts)
                    else:
                        lineas.setdefault(round(width, 3), []).append(pts)
            elif tag == 'circle':
                cx, cy, r = float(el.get('cx')), float(el.get('cy')), float(el.get('r'))
                circulos.append((cx, cy, r, 0 if filled else width))
            elif tag == 'rect':
                x, y, w, h = (float(el.get(k)) for k in ('x', 'y', 'width', 'height'))
                pts = [(x, y), (x + w, y), (x + w, y + h), (x, y + h), (x, y)]
                if filled:
                    rellenos.append(pts)
                else:
                    lineas.setdefault(round(width, 3), []).append(pts)
    walk(root, {})
    for w in lineas:
        lineas[w] = S._chain([[(q(x), q(y)) for x, y in p] for p in lineas[w]])
    return lineas, [[(q(x), q(y)) for x, y in p] for p in rellenos], circulos


def delta(points, ox, oy):
    """[(x, y)] in 0.01 mm -> [x0, y0, dx, dy, …] relative to the board origin."""
    out = []
    lx = ly = None
    for x, y in points:
        if lx is None:
            out += [x - ox, y - oy]
        else:
            out += [x - lx, y - ly]
        lx, ly = x, y
    return out


def simplify(pts, tol=0.02):
    """Drops collinear points of a polyline (mm), so zone fills shrink without visible change."""
    if len(pts) < 3:
        return pts
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, b, c = out[-1], pts[i], pts[i + 1]
        cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
        ln = math.hypot(c[0] - a[0], c[1] - a[1]) or 1
        if abs(cross) / ln > tol:
            out.append(b)
    out.append(pts[-1])
    return out


# ------------------------------------------------------------------ schematic sheet (Consolas formats)

def bbox_label(lb):
    size = lb['size']
    n = len(lb['name'].replace('~{', '').replace('}', ''))
    length = 0.95 * size * n + size * 0.4
    a = math.radians(lb['angle'])
    dx, dy = math.cos(a), -math.sin(a)
    if 'right' in lb.get('just', []):
        dx, dy = -dx, -dy
    x0, y0 = lb['x'], lb['y']
    x1, y1 = x0 + dx * length, y0 + dy * length
    ux, uy = (0, -1) if abs(dx) > 0.5 else (-1, 0)
    xs = [x0, x1, x0 + ux * size * 1.4, x1 + ux * size * 1.4, x0 - ux * 0.3, x1 - ux * 0.3]
    ys = [y0, y1, y0 + uy * size * 1.4, y1 + uy * size * 1.4, y0 - uy * 0.3, y1 - uy * 0.3]
    return min(xs), min(ys), max(xs), max(ys)


def schematic(sch_file, svg_file, netlist, idx_red, problemas, placa):
    sheets = K.load_tree(sch_file)
    if len(sheets) != 1:
        problemas.append(('error', '%s: el esquema tiene %d hojas; se esperaba una' % (placa, len(sheets))))
    uf, info = K.connectivity(sheets)
    group_net, probs = K.map_nets(sheets, uf, info, netlist)
    for g, nets in probs:
        problemas.append(('error', '%s: un grupo del esquema une varias redes: %s' % (placa, ', '.join(nets))))
    sh = sheets[0]
    w, h, layers = S.extract(svg_file)
    segs = S.wire_segments(layers)
    pts = {p for s in segs for p in s}
    faltan = [ws for ws in sh.wires if (q(ws[0][0]), q(ws[0][1])) not in pts or (q(ws[1][0]), q(ws[1][1])) not in pts]
    if faltan:
        problemas.append(('error', '%s: %d cables del esquema no coinciden con el SVG' % (placa, len(faltan))))
    binario = S.encode(w, h, layers)

    def net_of(node):
        n = group_net.get(uf.find(node))
        return idx_red.get(plain(n), -1) if n else -1

    hilos = []
    for i, (a, b) in enumerate(sh.wires):
        hilos += [net_of(('w', 0, i)), q(a[0]), q(a[1]), q(b[0]), q(b[1])]
    uniones = []
    for jx in sh.junctions:
        k = K.key(jx)
        r = -1
        for i, (a, b) in enumerate(info[0]['wires']):
            if k == a or k == b or K.on_segment(k, a, b):
                r = net_of(('w', 0, i))
                break
        uniones += [r, q(jx[0]), q(jx[1])]
    pines, simbolos, etiquetas = [], [], []
    for j, sym in enumerate(sh.symbols):
        if sym['power']:
            r = -1
            for k2, p in enumerate(sym['pins']):
                r = net_of(('p', 0, j, k2))
            if sym['bbox'] and r >= 0:
                x0, y0, x1, y1 = sym['bbox']
                etiquetas.append([r, 'pwr', sym['value'], q(x0), q(y0), q(x1), q(y1)])
            continue
        if sym['bbox']:
            x0, y0, x1, y1 = sym['bbox']
            simbolos.append([sym['ref'], q(x0), q(y0), q(x1), q(y1)])
        for k2, p in enumerate(sym['pins']):
            pines.append([net_of(('p', 0, j, k2)), sym['ref'], p['number'], p['name'], q(p['x']), q(p['y']), q(p['x2']), q(p['y2'])])
    for li, lb in enumerate(sh.labels):
        node = ('lb', 0, li)
        kind = 'bus' if node in info[0]['bus_label'] else lb['kind']
        r = -1 if kind == 'bus' else net_of(node)
        x0, y0, x1, y1 = bbox_label(lb)
        etiquetas.append([r, kind, lb['name'], q(x0), q(y0), q(x1), q(y1)])
    capa = {'w': q(w), 'h': q(h), 'hilos': hilos, 'uniones': uniones, 'pines': pines, 'etiquetas': etiquetas,
            'simbolos': simbolos, 'buses': [], 'subhojas': []}
    # block of each symbol: the column heading on its left (kicad_gen draws one column per block)
    cabeceras = sorted([(t['x'], t['text']) for t in sh.texts if '\n' not in t['text'] and len(t['text']) < 40 and t['y'] < 40])
    notas = [t['text'].replace('\\n', '\n') for t in sh.texts if '\n' in t['text'] or '\\n' in t['text']]
    bloque = {}
    sin_bom = {sym['ref'] for sym in sh.symbols if not sym['power'] and not sym['in_bom']}
    for sym in sh.symbols:
        if sym['power'] or not sym['ref']:
            continue
        cand = [c for c in cabeceras if c[0] <= sym['x'] + 1]
        if cand:
            bloque[sym['ref']] = cand[-1][1]
    return binario, capa, bloque, [c[1] for c in cabeceras], notas, (w, h), sin_bom


# ------------------------------------------------------------------ BOM, README, DRC

def read_bom(path):
    rows = {}
    with open(path, encoding='utf-8') as f:
        for row in csv.DictReader(f):
            for ref in row['Referencias'].split():
                rows[ref] = {'valor': row['Valor'], 'huella': row['Huella'], 'mpn': row['Referencia de fabricante']}
    return rows


def read_drc(path):
    if not os.path.exists(path):
        return None
    t = open(path, encoding='utf-8').read()
    out = {}
    for k, rx in (('violaciones', r'Found (\d+) DRC violations'), ('sin_conectar', r'Found (\d+) unconnected pads'),
                  ('huellas', r'Found (\d+) Footprint errors')):
        m = re.search(rx, t)
        out[k] = int(m.group(1)) if m else None
    return out


def readme_claims(readme, base):
    """Board size and component count stated in the README («| Placa | 110 × 68 mm …», the HiFi table)."""
    t = open(readme, encoding='utf-8').read()
    out = {}
    m = re.search(r'`%s/`\s*\|\s*(\d+)\s*×\s*(\d+)\s*mm\s*\|\s*(\d+)' % re.escape(base), t)
    if m:
        out = {'ancho': int(m.group(1)), 'alto': int(m.group(2)), 'componentes': int(m.group(3))}
        return out
    m = re.search(r'\|\s*Placa\s*\|\s*(\d+)\s*×\s*(\d+)\s*mm', t)
    if m:
        out['ancho'], out['alto'] = int(m.group(1)), int(m.group(2))
    m = re.search(r'\|\s*Componentes[^|]*\|\s*(\d+)', t)
    if m:
        out['componentes'] = int(m.group(1))
    return out


# ------------------------------------------------------------------ functions deduced from the connections

RAILS = re.compile(r'^(\+|-)?\d+V\d*|^V(CC|DD|P|N|PRE|RAW|OP|NEG|IN)|^\+|^-|3V3|5V|VP_|VN_|V24|AUX[PN]|VPR|VNR', re.I)


def es_masa(n):
    return n in ('GND', 'SGND', 'PGND', 'GND_IN', 'CHASSIS') or n.endswith('GND')


def deducida(f, red_de):
    """A plain Spanish sentence from the part's kind and the nets on its pins (for parts the README does not cite)."""
    ref, v = f['ref'], f['value']
    nets = []
    for p in f['pads']:
        n = red_de.get(p['net'], '')
        if n and n not in nets:
            nets.append(n)
    tipo = f['_modelo']['tipo']
    if tipo == 'taladro':
        return 'Taladro de fijación M3, sin metalizar.'
    if ref.startswith('TP'):
        return 'Punto de prueba de %s.' % (nets[0] if nets else v)
    two = len(nets) == 2
    if ref.startswith('C') and two:
        a, b = nets
        if es_masa(b) and not es_masa(a):
            rail, gnd = a, b
        elif es_masa(a) and not es_masa(b):
            rail, gnd = b, a
        else:
            return 'Condensador de %s entre %s y %s.' % (v, a, b)
        if tipo == 'electrolitico':
            return 'Condensador electrolítico de %s entre %s y %s: filtro y reserva de la alimentación.' % (v, rail, gnd) \
                if RAILS.search(rail) else 'Condensador electrolítico de %s entre %s y %s.' % (v, rail, gnd)
        if RAILS.search(rail):
            return 'Desacoplo de %s (%s a %s).' % (rail, v, gnd)
        return 'Condensador de %s de %s a %s.' % (v, rail, gnd)
    if ref.startswith('R') and two:
        return 'Resistencia de %s entre %s y %s.' % (v, nets[0], nets[1])
    if ref.startswith(('J', 'P')):
        return 'Conector «%s»: %s.' % (v, ', '.join(nets) if nets else 'sin redes')
    if ref.startswith('D') and two:
        return 'Diodo %s entre %s y %s.' % (v, nets[0], nets[1])
    if nets:
        return '%s (%s): %s.' % (v, ref, ', '.join(nets[:8]) + ('…' if len(nets) > 8 else ''))
    return v


# ------------------------------------------------------------------ DC operating point (native ngspice)

def dc_voltages(placa, red_names, problemas):
    cfg = D.SIMULACIONES.get(placa)
    if not cfg:
        return None
    if not shutil.which('ngspice'):
        problemas.append(('aviso', '%s: no hay ngspice en el sistema; sin tensiones simuladas' % placa))
        return None
    folder = os.path.join(SRC, cfg['dir'])
    key = _hash([os.path.join(folder, f) for f in sorted(os.listdir(folder)) if f.endswith(('.inc', '.lib'))], cfg['deck'])
    cache = os.path.join(CACHE, 'op-%s-%s.json' % (placa, key))
    if os.path.exists(cache):
        nodos = json.load(open(cache, encoding='utf-8'))
    else:
        tmpd = os.path.join(CACHE, 'op-%s' % placa)
        os.makedirs(tmpd, exist_ok=True)
        for f in os.listdir(folder):
            if f.endswith(('.inc', '.lib')):
                shutil.copy(os.path.join(folder, f), tmpd)
        deck = cfg['deck'].replace('.op\n', '.op\n.control\nrun\nset width=400\nprint all\n.endc\n')
        with open(os.path.join(tmpd, 'op.cir'), 'w', encoding='utf-8') as f:
            f.write(deck)
        r = subprocess.run(['ngspice', '-b', 'op.cir'], cwd=tmpd, capture_output=True, text=True, timeout=120)
        nodos = {}
        for line in r.stdout.splitlines():
            m = re.match(r'^\s*([\w.#:+-]+)\s*=\s*([-+0-9.eE]+)\s*$', line)
            if m and not m.group(1).endswith('#branch'):
                nodos[m.group(1).lower()] = float(m.group(2))
        if not nodos:
            problemas.append(('aviso', '%s: ngspice no dio el punto de trabajo: %s' % (placa, (r.stdout + r.stderr)[-300:])))
            return None
        json.dump(nodos, open(cache, 'w', encoding='utf-8'))
    tensiones = {}
    sub = cfg['subckt'].lower() + '.'
    lower = {n.lower(): n for n in red_names}
    for node, v in nodos.items():
        name = None
        if node.startswith(sub):
            inner = node[len(sub):]
            name = lower.get(inner)
        else:
            port = {k.lower(): b for k, b in cfg['puertos'].items()}.get(node)
            name = port
        if name and name in red_names:
            tensiones[name] = round(v, 4)
    for g in cfg['tierras']:
        if g in red_names:
            tensiones[g] = 0.0
    return {'titulo': cfg['titulo'], 'fuente': cfg['fuente'], 'tensiones': tensiones}


# ------------------------------------------------------------------ one board

def construir(proy, pl, refs, indice, problemas, erratas):
    pid = pl['id']
    base = os.path.join(SRC, pl['dir'], pl['base'])
    pcb_file, sch_file = base + '.kicad_pcb', base + '.kicad_sch'
    b = P.read_board(pcb_file)
    red_de = b['nets']
    # outline
    loops = P.outline(b['edges'])
    if not loops:
        raise SystemExit('%s: sin contorno en Edge.Cuts' % pid)
    xs = [p[0] for p in loops[0]]
    ys = [p[1] for p in loops[0]]
    X0, Y0 = min(xs), min(ys)
    ancho, alto = max(xs) - X0, max(ys) - Y0
    ox, oy = q(X0), q(Y0)
    # schematic netlist and drawings (kicad-cli)
    net_file = kicad_cli(['sch', 'export', 'netlist', '--format', 'kicadsexpr'], sch_file, 'esquema.net')
    svg_dir = kicad_cli(['sch', 'export', 'svg', '-e', '-n'], sch_file, 'svg/')
    svg_files = [f for f in os.listdir(svg_dir) if f.endswith('.svg')]
    netlist = read_netlist(net_file)
    silk = {}
    for side, layer in (('F', 'F.SilkS'), ('B', 'B.SilkS')):
        tiene = any(t['layer'] == layer for t in b['texts']) or any(
            g[0] == layer for f in b['footprints'] for g in f['graphics'])
        if not tiene:
            continue
        svg = kicad_cli(['pcb', 'export', 'svg', '--layers', layer, '--exclude-drawing-sheet', '--page-size-mode', '0',
                         '--black-and-white'], pcb_file, 'serigrafia-%s.svg' % side)
        silk[side] = silk_layer(svg)

    # nets: the board's names (schematic «/X» -> «X»), sorted; the index is the net id everywhere
    nombres = set(n for n in red_de.values() if n)
    for n in netlist['nets']:
        nombres.add(plain(n['name']))
    redes = sorted(nombres, key=lambda s: (s.startswith('unconnected-'), s))
    idx = {n: i for i, n in enumerate(redes)}

    def rid(netcode):
        n = red_de.get(netcode, '')
        return idx.get(n, -1) if n else -1

    # schematic sheet
    binario, capa, bloque_de, bloques, notas, (sw, sh_), sin_bom = schematic(
        sch_file, os.path.join(svg_dir, svg_files[0]), netlist, idx, problemas, pid)

    # ---------------------------------------------------------------- checks
    comprobaciones = []

    def ok(tipo, texto, detalle=None, errata=False):
        comprobaciones.append({'tipo': tipo, 'texto': texto, **({'detalle': detalle} if detalle else {})})
        if tipo == 'error':
            problemas.append(('error', '%s: %s' % (pid, texto)))
        if errata:
            erratas.append({'placa': pid, 'texto': texto, **({'detalle': detalle} if detalle else {})})

    pad_net = {}
    for f in b['footprints']:
        for p in f['pads']:
            if p['net']:
                pad_net[(f['ref'], p['num'])] = red_de[p['net']]
    sch_net = {}
    for n in netlist['nets']:
        for nd in n['nodes']:
            sch_net[(nd['ref'], nd['pin'])] = plain(n['name'])
    pcb_refs = {f['ref'] for f in b['footprints']}
    sch_refs = set(netlist['components'])
    iguales = distintos = 0
    dif = []
    for k, n in sch_net.items():
        if k[0] not in pcb_refs:
            continue
        pn = pad_net.get(k)
        if pn is None:
            if not n.startswith('unconnected-'):
                dif.append('%s.%s: en el esquema en %s, sin pad en la placa' % (k[0], k[1], n))
            continue
        if pn == n:
            iguales += 1
        else:
            distintos += 1
            dif.append('%s.%s: esquema %s, placa %s' % (k[0], k[1], n, pn))
    for k, pn in pad_net.items():
        if k[0] in sch_refs and k not in sch_net:
            dif.append('%s.%s: en la placa en %s, no está en el esquema' % (k[0], k[1], pn))
    if dif:
        ok('error', '%d pads no coinciden con las redes del esquema' % len(dif), dif[:30])
    else:
        ok('ok', 'Los %d pads conectados coinciden con las redes del esquema (netlist de kicad-cli)' % iguales)
    # same partition (independent of the names)
    part_s = {}
    for k, n in sch_net.items():
        if not n.startswith('unconnected-') and k[0] in pcb_refs:
            part_s.setdefault(n, set()).add(k)
    part_p = {}
    for k, n in pad_net.items():
        if k[0] in sch_refs:
            part_p.setdefault(n, set()).add(k)
    ps = sorted(sorted(v) for v in part_s.values())
    pp = sorted(sorted(v) for v in part_p.values())
    if ps == pp:
        ok('ok', 'Las %d redes del esquema son las mismas agrupaciones de pads que las de la placa' % len(ps))
    else:
        ok('error', 'Las redes del esquema y de la placa no agrupan los mismos pads')
    sobran = sorted(pcb_refs - sch_refs)
    mec = [r for r in sobran if any(f['ref'] == r and 'exclude_from_bom' in f['attrs'] for f in b['footprints'])]
    if set(sobran) - set(mec):
        ok('error', 'Huellas sin símbolo en el esquema: ' + ', '.join(sorted(set(sobran) - set(mec))))
    faltan = sorted(sch_refs - pcb_refs)
    if faltan:
        ok('error', 'Símbolos del esquema sin huella: ' + ', '.join(faltan))
    if not faltan and not (set(sobran) - set(mec)):
        ok('ok', '%d componentes en el esquema y en la placa%s' % (len(sch_refs), (' (más %d taladros de fijación)' % len(mec)) if mec else ''))
    # copper islands
    isl = P.islands(b)
    rotas = {red_de[n]: g for n, g in isl.items() if len(g) > 1}
    if rotas:
        ok('error', 'Redes partidas en varias islas de cobre: ' + ', '.join(sorted(rotas)),
           ['%s: %s' % (n, ' | '.join(', '.join(x) for x in g)) for n, g in rotas.items()])
    else:
        ok('ok', 'Cada red es una sola pieza de cobre (pistas, vías y planos): %d redes con dos pads o más' % len(isl))
    # values, footprints, MPN: schematic vs PCB vs BOM
    bom = read_bom(base + '_BOM.csv') if os.path.exists(base + '_BOM.csv') else {}
    dv, dh, dm, db = [], [], [], []
    for f in b['footprints']:
        c = netlist['components'].get(f['ref'])
        if not c:
            continue
        if c['value'] != f['value']:
            dv.append('%s: esquema «%s», placa «%s»' % (f['ref'], c['value'], f['value']))
        if c['footprint'] and c['footprint'] != f['lib']:
            dh.append('%s: esquema %s, placa %s' % (f['ref'], c['footprint'], f['lib']))
        br = bom.get(f['ref'])
        if bom and not br and 'exclude_from_bom' not in f['attrs'] and f['ref'] not in sin_bom:
            db.append('%s: no está en la lista de materiales' % f['ref'])
        if br and 'exclude_from_bom' in f['attrs']:
            db.append('%s: la huella está marcada «excluir de la lista de materiales», pero la lista la incluye' % f['ref'])
        if br:
            if br['valor'] != c['value']:
                dv.append('%s: lista de materiales «%s», esquema «%s»' % (f['ref'], br['valor'], c['value']))
            if br['huella'] != f['lib']:
                dh.append('%s: lista de materiales %s, placa %s' % (f['ref'], br['huella'], f['lib']))
            mpn = c['fields'].get('MPN', '')
            if mpn and mpn != br['mpn']:
                dm.append('%s: esquema «%s», lista «%s»' % (f['ref'], mpn, br['mpn']))
    for r in bom:
        if r not in pcb_refs:
            db.append('%s: en la lista de materiales y no en la placa' % r)
    for lst, que in ((dv, 'valores'), (dh, 'huellas'), (dm, 'referencias de fabricante'), (db, 'componentes de la lista de materiales')):
        if lst:
            ok('aviso', 'Diferencias de %s entre esquema, placa y lista de materiales' % que, lst[:30], errata=True)
    if bom and not (dv or dh or dm or db):
        ok('ok', 'Valores, huellas y referencias de fabricante iguales en el esquema, la placa y la lista de materiales (%d filas)' % len(bom))
    # DRC
    drc = read_drc(base + '-drc.rpt')
    if drc:
        if drc['violaciones'] == 0 and drc['sin_conectar'] == 0:
            ok('ok', 'Informe DRC del proyecto: 0 violaciones, 0 pads sin conectar')
        else:
            ok('aviso', 'Informe DRC: %s violaciones, %s pads sin conectar' % (drc['violaciones'], drc['sin_conectar']))
    # size, layers and count against the book and the README
    n_comp = len(pcb_refs & sch_refs)
    lib = pl.get('libro', {})
    sec = refs.get(lib.get('texto', ''), {})
    donde = 'sección %s' % sec['num'] if sec else 'el libro'
    real = '%g × %g mm' % (round(ancho, 2), round(alto, 2))
    if 'ancho' in lib:
        if abs(lib['ancho'] - ancho) < 0.05 and abs(lib['alto'] - alto) < 0.05:
            ok('ok', 'Tamaño de la placa %s, el que da el libro (%s)' % (real, donde))
        else:
            ok('aviso', 'El libro (%s) da %d × %d mm; la placa mide %s' % (donde, lib['ancho'], lib['alto'], real), errata=True)
    if 'componentes' in lib:
        if lib['componentes'] == n_comp:
            ok('ok', '%d componentes, los que dice el libro (%s)' % (n_comp, donde))
        else:
            ok('aviso', 'El libro (%s) dice %d componentes; la placa tiene %d' % (donde, lib['componentes'], n_comp), errata=True)
    if 'capas' in lib and lib['capas'] != len(b['copper']):
        ok('aviso', 'El libro (%s) dice %d capas; la placa tiene %d' % (donde, lib['capas'], len(b['copper'])), errata=True)
    rc = readme_claims(os.path.join(SRC, proy['readme']), pl['base'])
    if rc:
        msgs = []
        if 'ancho' in rc and (abs(rc['ancho'] - ancho) > 0.05 or abs(rc['alto'] - alto) > 0.05):
            msgs.append('el README da %d × %d mm y la placa mide %s' % (rc['ancho'], rc['alto'], real))
        if 'componentes' in rc and rc['componentes'] != n_comp:
            msgs.append('el README dice %d componentes y la placa tiene %d' % (rc['componentes'], n_comp))
        if msgs:
            ok('aviso', '; '.join(msgs)[0].upper() + '; '.join(msgs)[1:], errata=True)
        else:
            ok('ok', 'Tamaño y número de componentes iguales a los del README del proyecto')
    # captions that place a part: where it really is
    for c in D.POSICIONES_PIE:
        if c['placa'] != pid:
            continue
        xs = [p['x'] for f in b['footprints'] if f['ref'] in c['refs'] for p in f['pads']]
        if xs:
            f0 = (min(xs) - X0) / ancho
            f1 = (max(xs) - X0) / ancho
            fig = refs.get(c['figura'], {}).get('num', c['figura'])
            if f0 < c['esperado'][0] or f1 > c['esperado'][1]:
                ok('aviso', 'El pie de la figura %s dice «%s», pero %s ocupan del %d %% al %d %% del ancho de la placa (lado derecho)'
                   % (fig, c['texto'], ' y '.join(c['refs']), round(f0 * 100), round(f1 * 100)), errata=True)
            else:
                ok('ok', 'El pie de la figura %s («%s») coincide con la placa' % (fig, c['texto']))
    # chapter numbers on the silkscreen against the printed book
    num_impreso = indice['partes'][proy['parte']]['num']
    for t in b['texts']:
        for m in re.finditer(r'cap\.\s*(\d+)', t['text']):
            if m.group(1) != num_impreso:
                ok('aviso', 'La serigrafía dice «%s», pero en el libro impreso es el capítulo %s' % (t['text'], num_impreso),
                   errata=True)
    # functions cited in the curated data must exist on the board
    for ref in D.FUNCIONES.get(pid, {}):
        if ref not in pcb_refs:
            problemas.append(('error', '%s: FUNCIONES cita %s, que no está en la placa' % (pid, ref)))
    for bl, labels in D.BLOQUES.get(pid, {}).items():
        if bl not in bloques:
            problemas.append(('error', '%s: BLOQUES cita el bloque «%s», que no está en el esquema' % (pid, bl)))
        for lb in labels:
            if lb not in refs:
                problemas.append(('error', '%s: la etiqueta %s no existe en refs.json' % (pid, lb)))
    for bl in bloques:
        if bl not in D.BLOQUES.get(pid, {}):
            problemas.append(('error', '%s: el bloque «%s» del esquema no tiene secciones en BLOQUES' % (pid, bl)))

    # ---------------------------------------------------------------- footprints, pads
    huellas = []
    pads = []
    funciones = D.FUNCIONES.get(pid, {})
    funcion_pin = {(nd['ref'], nd['pin']): nd['function'] for n in netlist['nets'] for nd in n['nodes']}
    for f in b['footprints']:
        c = netlist['components'].get(f['ref'], {})
        mpn = (c.get('fields') or {}).get('MPN', '') or bom.get(f['ref'], {}).get('mpn', '')
        f['_modelo'] = P.model_for(f, {'mpn': mpn})
        fn = funciones.get(f['ref'])
        origen = 'readme'
        if not fn and pid == 'sdr':
            for chip, t in D.CHIPS_SDR.items():
                if chip.lower() in f['value'].lower() or chip.lower() in mpn.lower():
                    fn = t
                    break
        if not fn:
            fn = (deducida(f, red_de), None)
            origen = 'deducida'
        bl = bloque_de.get(f['ref'])
        tipo = 'mec' if f['ref'] not in sch_refs else ('smd' if 'smd' in f['attrs'] else 'tht')
        dnp = 'dnp' in f['attrs'] or f['ref'] in sin_bom
        inicio = len(pads)
        for p in f['pads']:
            flags = 0
            if P.pad_on_layer(p, 'F.Cu'):
                flags |= 1
            if P.pad_on_layer(p, 'B.Cu'):
                flags |= 2
            if p['type'] == 'thru_hole':
                flags |= 4
            if p['type'] == 'np_thru_hole':
                flags |= 8
            if P.pad_on_layer(p, 'F.Mask'):
                flags |= 16
            if P.pad_on_layer(p, 'B.Mask'):
                flags |= 32
            if P.pad_on_layer(p, 'F.Paste'):
                flags |= 64
            dr = p['drill'] or (0, 0)
            shape = P.PAD_SHAPES.get(p['shape'], 'r')
            pads.append([len(huellas), p['num'], shape, q(p['x']) - ox, q(p['y']) - oy, q(p['w']), q(p['h']),
                         round(p['rot'], 2), round(p['rr'], 3), q(dr[0]), q(dr[1]), flags, rid(p['net']),
                         funcion_pin.get((f['ref'], p['num']), '')])
        fab = []
        for L, kind, data, w, fill in f['graphics']:
            if not L.endswith('.Fab'):
                continue
            if kind == 'circle':
                (cx, cy), r = data
                fab.append(['c', q(cx), q(cy), q(r)])
            else:
                fab.append(['l' if not fill else 'p'] + [v for pt in data for v in (q(pt[0]), q(pt[1]))])
        h = {'r': f['ref'], 'v': f['value'], 'l': f['lib'].split(':')[-1], 'lib': f['lib'].split(':')[0],
             'x': q(f['x']) - ox, 'y': q(f['y']) - oy, 'a': round(f['rot'], 2), 'lado': f['side'], 't': tipo,
             'pads': [inicio, len(pads) - inicio], 'm': f['_modelo'], 'fab': fab,
             'f': fn[0], 'fo': origen}
        if fn[1]:
            h['fr'] = fn[1]
        if bl:
            h['b'] = bl
        if mpn:
            h['mpn'] = mpn
        if dnp:
            h['dnp'] = True
        if c.get('description'):
            h['desc'] = c['description']
        huellas.append(h)

    # parts under a shielding can taller than the can
    for f in b['footprints']:
        m = f.get('_modelo')
        if not m or m['tipo'] != 'blindaje':
            continue
        x0, y0, x1, y1 = m['caja']
        xs = [f['x'] + x0, f['x'] + x1]
        ys = [f['y'] + y0, f['y'] + y1]
        altos = []
        for o in b['footprints']:
            mo = o.get('_modelo')
            if o is f or not mo or o['ref'] not in sch_refs:
                continue
            if min(xs) < o['x'] < max(xs) and min(ys) < o['y'] < max(ys):
                hh = P.altura(mo)
                if hh > m['alto']:
                    altos.append('%s (%s, unos %s mm)' % (o['ref'], o['value'], ('%.1f' % hh).replace('.', ',')))
        if altos:
            ok('aviso', 'La cabina de blindaje %s (%s, de %s mm de altura según los distribuidores) cubre piezas más altas que ella, que '
               'no cabrían debajo: %s' % (f['ref'], f['lib'].split(':')[-1].replace('_', ' '), ('%g' % m['alto']).replace('.', ','),
                                          ', '.join(altos)), errata=True)

    # ---------------------------------------------------------------- copper
    pistas = {}
    for t in b['tracks']:
        side = t['layer'].split('.')[0]
        pistas.setdefault(side, []).extend([rid(t['net']), q(t['w']), q(t['a'][0]) - ox, q(t['a'][1]) - oy,
                                            q(t['b'][0]) - ox, q(t['b'][1]) - oy])
    vias = []
    for v in b['vias']:
        vias += [rid(v['net']), q(v['p'][0]) - ox, q(v['p'][1]) - oy, q(v['d']), q(v['drill'])]
    zonas = []
    for z in b['zones']:
        pts = simplify(z['pts'])
        zonas.append({'l': z['layer'].split('.')[0], 'r': rid(z['net']), 'p': delta([(q(x), q(y)) for x, y in pts], ox, oy)})
    areas = []
    for a in b['areas']:
        cobre = [l.split('.')[0] for l in a['layers'] if l.endswith('.Cu')]
        if a['layers'] and a['layers'][0].startswith('F&B'):
            cobre = ['F', 'B']
        areas.append({'capas': cobre, 'nombre': a['name'], 'reglas': a['rules'],
                      'p': delta([(q(x), q(y)) for x, y in a['pts']], ox, oy)})
    seri = {}
    for side, (lineas, rellenos, circulos) in silk.items():
        seri[side] = {'lineas': [[w * 100 // 1 / 100] + [v for pl_ in pls for v in [len(pl_)] + delta(pl_, ox, oy)]
                                 for w, pls in sorted(lineas.items())],
                      'rellenos': [delta(p, ox, oy) for p in rellenos],
                      'circulos': [[q(cx) - ox, q(cy) - oy, q(r), q(w)] for cx, cy, r, w in circulos]}
    contorno = delta([(q(x), q(y)) for x, y in loops[0]], ox, oy)

    # ---------------------------------------------------------------- voltages on the nets
    tensiones = {}
    for n, v, texto in D.ANOTACIONES.get(pid, []):
        if n in idx:
            tensiones[n] = {'v': v, 'texto': texto, 'origen': 'anotacion'}
        else:
            problemas.append(('error', '%s: la anotación cita la red %s, que no existe' % (pid, n)))
    sim = dc_voltages(pid, set(redes), problemas)
    if sim:
        for n, v in sim['tensiones'].items():
            tensiones.setdefault(n, {'v': v, 'origen': 'simulacion'})
    pads_por_red = {}
    for p in pads:
        if p[12] >= 0:
            pads_por_red[p[12]] = pads_por_red.get(p[12], 0) + 1
    lista_redes = []
    for i, n in enumerate(redes):
        r = {'n': n, 'p': pads_por_red.get(i, 0)}
        if n in tensiones:
            r['v'] = tensiones[n]
        lista_redes.append(r)

    fab_cfg = D.FABRICACION[proy['id']]
    placa = {
        'version': 1, 'id': pid, 'proyecto': proy['id'], 'titulo': pl['titulo'], 'proyecto_titulo': proy['titulo'],
        'parte': proy['parte'], 'figura': pl.get('figura', proy['figura'] if len(proy['placas']) == 1 else None),
        'archivo': os.path.relpath(pcb_file, SRC),
        'placa': {'ancho': q(ancho), 'alto': q(alto), 'origen': [round(X0, 3), round(Y0, 3)], 'grosor': b['thickness'],
                  'capas': [c.split('.')[0] for c in b['copper']], 'cobre_um': 35,
                  'mascara': fab_cfg['mascara'] or 'verde', 'mascara_fuente': 'README' if fab_cfg['mascara'] else
                  'no indicado en el proyecto (verde, el habitual)', 'serigrafia': fab_cfg['serigrafia'] or 'blanca',
                  'acabado': fab_cfg['acabado'], 'fabricacion': fab_cfg['cita'], 'contorno': contorno,
                  'apilado': 'definido' if b['stackup'] else 'no definido en el .kicad_pcb'},
        'redes': lista_redes,
        'huellas': huellas,
        'pads': pads,
        'pistas': pistas,
        'vias': vias,
        'zonas': zonas,
        'areas': areas,
        'serigrafia': seri,
        'esquema': {'hoja': '%s/hoja-0' % pid, 'ancho': round(sw, 3), 'alto': round(sh_, 3), 'notas': notas,
                    'bloques': [{'nombre': bl, 'refs': D.BLOQUES.get(pid, {}).get(bl, [])} for bl in bloques]},
        'simulacion': {'titulo': sim['titulo'], 'fuente': sim['fuente']} if sim else None,
        'comprobaciones': comprobaciones,
    }
    os.makedirs(os.path.join(OUT, pid), exist_ok=True)
    with open(os.path.join(OUT, pid, 'hoja-0.bin'), 'wb') as f:
        f.write(binario)
    t1 = json.dumps(capa, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, pid, 'hoja-0.json'), 'w', encoding='utf-8') as f:
        f.write(t1)
    t2 = json.dumps(placa, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, pid + '.json'), 'w', encoding='utf-8') as f:
        f.write(t2)
    resumen = {'id': pid, 'titulo': pl['titulo'], 'ancho': round(ancho, 2), 'alto': round(alto, 2), 'capas': len(b['copper']),
               'componentes': n_comp, 'redes': len([r for r in lista_redes if r['p'] >= 2]), 'pads': len(pads),
               'vias': len(b['vias']), 'pistas': len(b['tracks']),
               'bytes': len(binario) + len(t1.encode('utf-8')) + len(t2.encode('utf-8')),
               'tensiones': len(tensiones), 'avisos': len([c for c in comprobaciones if c['tipo'] != 'ok'])}
    return resumen


def main():
    if not os.path.isdir(SRC):
        print('proyectos_kicad: no está %s; se conservan los datos de web/public/proyectos' % SRC)
        return 0
    if not shutil.which('kicad-cli'):
        print('proyectos_kicad: falta kicad-cli; se conservan los datos de web/public/proyectos')
        return 0
    refs = json.load(open(os.path.join(LIBRO, 'refs.json'), encoding='utf-8'))
    indice = json.load(open(os.path.join(LIBRO, 'indice.json'), encoding='utf-8'))
    spice = json.load(open(os.path.join(LIBRO, 'spice.json'), encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    problemas = []
    erratas = []
    proyectos = []
    total = 0
    for proy in D.PROYECTOS:
        if proy['figura'] not in refs:
            problemas.append(('error', '%s: la figura %s no está en refs.json' % (proy['id'], proy['figura'])))
        placas = []
        for pl in proy['placas']:
            r = construir(proy, pl, refs, indice, problemas, erratas)
            total += r['bytes']
            placas.append(r)
            print('proyectos_kicad: %-21s %5.1f × %5.1f mm, %3d componentes, %3d redes, %4d pads, %4d vías, %2d tensiones, %6.1f kB'
                  % (r['id'], r['ancho'], r['alto'], r['componentes'], r['redes'], r['pads'], r['vias'], r['tensiones'], r['bytes'] / 1024))
        cap = next((c for c in spice['capitulos'] if c['parte'] == proy['parte']), None)
        netlists = []
        for nid in (cap['netlists'] if cap else []):
            n = spice['netlists'][nid]
            netlists.append({'id': nid, 'titulo': n['titulo'] or n['nombre'], 'ref': n['ref'], 'analisis': n['analisis'],
                             'estado': n['motor'].get('estado')})
        # project's own netlists (complementos/kicad/<p>/spice): listed with what the README says they check
        propias = sorted(f for f in os.listdir(os.path.join(SRC, proy['carpeta'], 'spice')) if f.endswith('.cir'))
        p = indice['partes'][proy['parte']]
        proyectos.append({'id': proy['id'], 'titulo': proy['titulo'], 'resumen': proy['resumen'], 'parte': proy['parte'],
                          'capitulo': p['num'], 'capitulo_titulo': p['titulo'], 'color': p['color'], 'figura': proy['figura'],
                          'carpeta': 'complementos/kicad/' + proy['carpeta'], 'placas': placas, 'netlists': netlists,
                          'netlists_proyecto': propias})
        # README chapter and section numbers follow the sources, not the printed book
        t = open(os.path.join(SRC, proy['readme']), encoding='utf-8').read()
        m = re.search(r'\(cap[ií]tulo (\d+)\)', t.split('\n')[0])
        if m and m.group(1) != p['num']:
            erratas.append({'placa': proy['id'], 'texto': 'El README del proyecto (%s) habla del «capítulo %s» y numera las secciones '
                            'como las fuentes (%s.x); en el libro impreso es el capítulo %s (%s.x)' %
                            (proy['readme'], m.group(1), m.group(1), p['num'], p['num'])})
    erratas += [dict(e) for e in D.ERRATAS_MANUALES]
    datos = {'version': 1, 'proyectos': proyectos, 'erratas': erratas, 'bytes': total}
    with open(os.path.join(OUT, 'indice.json'), 'w', encoding='utf-8') as f:
        f.write(json.dumps(datos, ensure_ascii=False, separators=(',', ':')))
    print('proyectos_kicad: %d placas, %.1f kB en %s' % (sum(len(p['placas']) for p in proyectos), total / 1024,
                                                           os.path.relpath(OUT, APP)))
    for e in erratas:
        print('proyectos_kicad: errata?', e['placa'], '·', e['texto'])
    malos = [t for k, t in problemas if k == 'error']
    for k, t in problemas:
        print('proyectos_kicad: %s %s' % ('ERROR' if k == 'error' else 'aviso', t))
    return 1 if malos else 0


if __name__ == '__main__':
    sys.exit(main())
