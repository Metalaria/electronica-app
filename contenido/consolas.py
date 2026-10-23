"""«Consolas» views: NES (NES-CPU-07) and Neo Geo AES (NEO-AES) mainboards.

Reads the research folder /home/claude/consolas (KiCad 7 copies of the OpenTendo NES-CPU-11 and Board-Folk
NeoGeoAES-3.5 schematics, their kicad-cli netlists, SVG exports and bus groups) and writes compact data
for the app into web/public/consolas/:

  <maquina>.json          machine: photo hotspots, sheets, components, nets (nodes, bus group, sheets),
                          equivalences and sources
  <maquina>/hoja-N.bin    the KiCad drawing of sheet N (consolas_svg format «CSG1»)
  <maquina>/hoja-N.json   the electrical layer of sheet N: wires, junctions, pins, labels, power symbols,
                          symbol boxes and child sheets, each tagged with its net (index into redes)

Every geometric group is checked against the netlist (no group may hold pins of two nets, every netlist
net must be reached, every wire must coincide with a wire of the SVG): the build fails otherwise.

Run alone (python3 contenido/consolas.py) or from generar.py (consolas.main()).
"""

import json
import math
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
SRC = os.environ.get('CONSOLAS_FUENTES', '/home/claude/consolas')
OUT = os.path.join(APP, 'web/public/consolas')

sys.path.insert(0, HERE)
import consolas_kicad as K   # noqa: E402
import consolas_svg as S     # noqa: E402
import consolas_datos as D   # noqa: E402

MAQUINAS = [
    {
        'id': 'nes',
        'titulo': 'NES',
        'placa': 'NES-CPU-07',
        'esquema_titulo': 'NES-CPU-11 (OpenTendo)',
        'raiz': 'nes/kicad7/NES-CPU-11.kicad_sch',
        'netlist': 'nes/netlist/NES-CPU-11.nets.json',
        'buses': 'nes/netlist/NES-CPU-11.buses.json',
        'svg': lambda path: 'nes/svg/NES-CPU-11/NES-CPU-11.svg',
        'foto': {'src': 'libro/img/foto_nes.jpg', 'ancho': 1600, 'alto': 1166, 'figura': 'fig-37.16'},
        'hotspots': D.NES_HOTSPOTS,
        'aviso': 'El esquema es el de la NES-CPU-11 (OpenTendo), obtenido por ingeniería inversa de la placa '
                 'original. La NES-CPU-07 de la foto es eléctricamente la misma placa sin R17 (2,2 kΩ en el '
                 'reloj de la CIC) ni R18 y R19 (1 kΩ en serie con los datos de la CIC), que Nintendo añadió '
                 'en las -09 a -11; en la -07 esos puntos van unidos directamente. Además, U2 y U3 son de la '
                 'familia LS en la foto (74LS373, 74LS139) y U9 es un 74HCU04.',
    },
    {
        'id': 'neogeo',
        'titulo': 'Neo Geo AES',
        'placa': 'NEO-AES (1990)',
        'esquema_titulo': 'NEO-AES3-5 (Board-Folk)',
        'raiz': 'neogeo/kicad7/NeoGeoAES3_5.kicad_sch',
        'netlist': 'neogeo/netlist/NeoGeoAES3_5.nets.json',
        'buses': 'neogeo/netlist/NeoGeoAES3_5.buses.json',
        'svg': lambda path: 'neogeo/svg/NeoGeoAES3_5%s.svg' % ('' if path == '/' else '-' + path.strip('/')),
        'foto': {'src': 'libro/img/foto_neogeo.jpg', 'ancho': 1600, 'alto': 1168, 'figura': 'fig-37.22'},
        'hotspots': D.NEOGEO_HOTSPOTS,
        'aviso': 'No hay esquema público de la primera placa NEO-AES (LSPC-A0, PRO-B0, PRO-C0). Se muestra la '
                 'recreación Board-Folk de la NEO-AES3-5, de 2.ª generación: misma arquitectura y mismas '
                 'señales, pero las funciones están repartidas en otros chips (LSPC2-A2, NEO-B1, NEO-C1, '
                 'NEO-D0, NEO-G0, NEO-E0). La tabla de equivalencias relaciona cada chip de la foto con los '
                 'del esquema.',
    },
]


def q(v):
    return int(round(v * 100))


def bbox_label(lb):
    """Approximate box of a label for hit testing (mm): text along the label direction."""
    size = lb['size']
    n = len(lb['name'].replace('~{', '').replace('}', ''))
    length = 0.95 * size * n + (size * 1.6 if lb['kind'] != 'local' else size * 0.4)
    a = math.radians(lb['angle'])
    dx, dy = math.cos(a), -math.sin(a)
    if lb['kind'] != 'local':
        # global and hierarchical labels: the body extends away from the connection point
        if lb['kind'] == 'global':
            dx, dy = -dx, -dy
        x0, y0 = lb['x'], lb['y']
        x1, y1 = x0 + dx * length, y0 + dy * length
        px, py = -dy * size * 0.9, dx * size * 0.9
        xs = [x0 + px, x0 - px, x1 + px, x1 - px]
        ys = [y0 + py, y0 - py, y1 + py, y1 - py]
    else:
        x0, y0 = lb['x'], lb['y']
        x1, y1 = x0 + dx * length, y0 + dy * length
        # the text sits on the "up" side of the wire
        ux, uy = (0, -1) if abs(dx) > 0.5 else (-1, 0)
        xs = [x0, x1, x0 + ux * size * 1.4, x1 + ux * size * 1.4, x0 - ux * 0.3, x1 - ux * 0.3]
        ys = [y0, y1, y0 + uy * size * 1.4, y1 + uy * size * 1.4, y0 - uy * 0.3, y1 - uy * 0.3]
    return min(xs), min(ys), max(xs), max(ys)


def construir(m, problemas):
    sheets = K.load_tree(os.path.join(SRC, m['raiz']))
    net = json.load(open(os.path.join(SRC, m['netlist']), encoding='utf-8'))
    buses = json.load(open(os.path.join(SRC, m['buses']), encoding='utf-8'))
    uf, info = K.connectivity(sheets)
    group_net, probs = K.map_nets(sheets, uf, info, net)
    for g, nets in probs:
        problemas.append('%s: un grupo une varias redes del netlist: %s' % (m['id'], ', '.join(nets)))

    # nets: index, bus group, nodes
    grupo_de = {}
    for gk, names in buses.items():
        if gk == 'other_named':
            continue
        for n in names:
            grupo_de.setdefault(n, gk)
    redes = []
    idx = {}
    for n in sorted(net['nets'], key=lambda n: n['name']):
        idx[n['name']] = len(redes)
        redes.append({'n': n['name'], 'g': grupo_de.get(n['name']),
                      'nodos': [[nd['ref'], nd['pin'], nd['function']] for nd in n['nodes']], 'h': []})
    reached = set(group_net.values())
    for n in net['nets']:
        if n['name'] not in reached and not n['name'].startswith('unconnected-'):
            problemas.append('%s: red del netlist sin geometría: %s' % (m['id'], n['name']))

    componentes = {}
    for ref, c in net['components'].items():
        componentes[ref] = {'v': c['value'], 'l': c['lib'].split(':')[-1], 'h': []}

    os.makedirs(os.path.join(OUT, m['id']), exist_ok=True)
    hojas = []
    tam = 0
    for si, sh in enumerate(sheets):
        svg_file = os.path.join(SRC, m['svg'](sh.path))
        if not os.path.exists(svg_file):
            raise SystemExit('Falta %s (expórtalo con: kicad-cli sch export svg)' % svg_file)
        w, h, layers = S.extract(svg_file)
        # alignment check: every wire of the .kicad_sch is drawn in the SVG
        segs = S.wire_segments(layers)
        pts = {p for s in segs for p in s}
        faltan = [wseg for wseg in sh.wires if (q(wseg[0][0]), q(wseg[0][1])) not in pts or (q(wseg[1][0]), q(wseg[1][1])) not in pts]
        if faltan:
            problemas.append('%s %s: %d cables no coinciden con el SVG' % (m['id'], sh.path, len(faltan)))
        binario = S.encode(w, h, layers)
        base = '%s/hoja-%d' % (m['id'], si)
        with open(os.path.join(OUT, base + '.bin'), 'wb') as f:
            f.write(binario)
        tam += len(binario)

        def net_of(node):
            n = group_net.get(uf.find(node))
            return idx[n] if n in idx else -1

        hilos = []
        for i, (a, b) in enumerate(sh.wires):
            r = net_of(('w', si, i))
            hilos += [r, q(a[0]), q(a[1]), q(b[0]), q(b[1])]
            if r >= 0 and si not in redes[r]['h']:
                redes[r]['h'].append(si)
        uniones = []
        for jx in sh.junctions:
            k = K.key(jx)
            r = -1
            for i, (a, b) in enumerate(info[si]['wires']):
                if k == a or k == b or K.on_segment(k, a, b):
                    r = net_of(('w', si, i))
                    break
            uniones += [r, q(jx[0]), q(jx[1])]
        pines = []
        simbolos = []
        etiquetas = []
        for j, sym in enumerate(sh.symbols):
            if sym['power']:
                r = -1
                for k2, p in enumerate(sym['pins']):
                    r = net_of(('p', si, j, k2))
                if sym['bbox'] and r >= 0:
                    x0, y0, x1, y1 = sym['bbox']
                    etiquetas.append([r, 'pwr', sym['value'], q(x0), q(y0), q(x1), q(y1)])
                    if si not in redes[r]['h']:
                        redes[r]['h'].append(si)
                continue
            if sym['ref'] in componentes and si not in componentes[sym['ref']]['h']:
                componentes[sym['ref']]['h'].append(si)
            if sym['bbox']:
                x0, y0, x1, y1 = sym['bbox']
                simbolos.append([sym['ref'], q(x0), q(y0), q(x1), q(y1)])
            for k2, p in enumerate(sym['pins']):
                r = net_of(('p', si, j, k2))
                pines.append([r, sym['ref'], p['number'], p['name'], q(p['x']), q(p['y']), q(p['x2']), q(p['y2'])])
                if r >= 0 and si not in redes[r]['h']:
                    redes[r]['h'].append(si)
        for li, lb in enumerate(sh.labels):
            node = ('lb', si, li)
            if node in info[si]['bus_label']:
                kind = 'bus'
                r = -1
            else:
                kind = lb['kind']
                r = net_of(node)
            x0, y0, x1, y1 = bbox_label(lb)
            etiquetas.append([r, kind, lb['name'], q(x0), q(y0), q(x1), q(y1)])
            if r >= 0 and si not in redes[r]['h']:
                redes[r]['h'].append(si)
        subhojas = []
        for cs in sh.sheets:
            ci = next((i for i, s2 in enumerate(sheets) if s2.uuid_path == sh.uuid_path + '/' + cs['uuid']), -1)
            pins = []
            for pi, sp in enumerate(cs['pins']):
                r = net_of(('sp', si, sheets[si].sheets.index(cs), pi))
                pins.append([r, sp['name'], q(sp['x']), q(sp['y'])])
            subhojas.append([ci, cs['name'], q(cs['x']), q(cs['y']), q(cs['w']), q(cs['h']), pins])
        bus_segs = []
        for a, b in sh.buses:
            bus_segs += [q(a[0]), q(a[1]), q(b[0]), q(b[1])]
        capa = {'w': q(w), 'h': q(h), 'hilos': hilos, 'uniones': uniones, 'pines': pines,
                'etiquetas': etiquetas, 'simbolos': simbolos, 'buses': bus_segs, 'subhojas': subhojas}
        texto = json.dumps(capa, ensure_ascii=False, separators=(',', ':'))
        with open(os.path.join(OUT, base + '.json'), 'w', encoding='utf-8') as f:
            f.write(texto)
        tam += len(texto.encode('utf-8'))
        nombre = sh.title if sh.path != '/' else (m['esquema_titulo'] if len(sheets) == 1 else 'Jerarquía (raíz)')
        padre = None
        if sh.path != '/':
            padre = next((i for i, s2 in enumerate(sheets) if sh.uuid_path.rsplit('/', 1)[0] == s2.uuid_path), None)
        hojas.append({'id': si, 'nombre': nombre, 'ruta': sh.path, 'archivo': base, 'ancho': round(w, 3),
                      'alto': round(h, 3), 'padre': padre})

    # photo hotspots: schematic refs must exist
    hot = []
    for hs in m['hotspots']:
        for ref in hs['esquema']:
            if ref not in componentes:
                problemas.append('%s: el punto %s cita %s, que no está en el esquema' % (m['id'], hs['id'], ref))
        for g in hs['buses']:
            if g not in D.GRUPOS[m['id']]:
                problemas.append('%s: grupo de buses desconocido %s' % (m['id'], g))
        hot.append(dict(hs))
    foto_de = {}
    for hs in m['hotspots']:
        for ref in hs['esquema']:
            foto_de.setdefault(ref, hs['id'])
    for ref, c in componentes.items():
        if ref in foto_de:
            c['f'] = foto_de[ref]
    for r in redes:
        r['h'].sort()

    datos = {
        'version': 1,
        'id': m['id'],
        'titulo': m['titulo'],
        'placa': m['placa'],
        'esquema_titulo': m['esquema_titulo'],
        'aviso': m['aviso'],
        'foto': m['foto'],
        'hotspots': hot,
        'grupos': D.GRUPOS[m['id']],
        'hojas': hojas,
        'componentes': componentes,
        'redes': redes,
        'equivalencias': D.EQUIVALENCIAS if m['id'] == 'neogeo' else [],
        'fuentes': D.FUENTES[m['id']],
    }
    texto = json.dumps(datos, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, m['id'] + '.json'), 'w', encoding='utf-8') as f:
        f.write(texto)
    tam += len(texto.encode('utf-8'))
    return {'hojas': len(hojas), 'redes': len(redes), 'componentes': len(componentes),
            'hotspots': len(hot), 'bytes': tam}


def main():
    if not os.path.isdir(SRC):
        print('consolas: no está la carpeta de fuentes %s; se conservan los datos de web/public/consolas' % SRC)
        return 0
    os.makedirs(OUT, exist_ok=True)
    problemas = []
    total = 0
    for m in MAQUINAS:
        r = construir(m, problemas)
        total += r['bytes']
        print('consolas: %-7s %2d hojas, %4d redes, %3d componentes, %2d puntos en la foto, %6.1f kB'
              % (m['id'], r['hojas'], r['redes'], r['componentes'], r['hotspots'], r['bytes'] / 1024))
    print('consolas: total %.1f kB en %s' % (total / 1024, os.path.relpath(OUT, APP)))
    for p in problemas:
        print('consolas: ERROR', p)
    return 1 if problemas else 0


if __name__ == '__main__':
    sys.exit(main())
