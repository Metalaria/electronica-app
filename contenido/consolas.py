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
import consolas_datos2 as D2  # noqa: E402
import consolas_fotos as F   # noqa: E402
import consolas_pdf as P    # noqa: E402
from PIL import Image        # noqa: E402

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
    {
        'id': 'sms',
        'titulo': 'Master System II',
        'placa': '171-5922A (IC BD M4JR PAL)',
        'esquema_titulo': 'SMS II 171-5922A (manual de Sega, transcrito)',
        'raiz': 'sms/sms2/kicad7/SMS2.kicad_sch',
        'netlist': 'sms/sms2/netlist/SMS2.nets.json',
        'buses': 'sms/sms2/netlist/SMS2.buses.json',
        'svg': lambda path: 'sms/sms2/svg/SMS2%s.svg' % ('' if path == '/' else '-' + path.strip('/')),
        'nombre_raiz': 'Índice de hojas',
        'dudas': 'sms/sms2/transcripcion.py',
        'nombres_hoja': {'/Hoja 1/': 'Hoja 1: VDP, VRAM y alimentación', '/Hoja 2/': 'Hoja 2: Z80, memoria, E/S y mandos',
                         '/Hoja 3/': 'Hoja 3: codificador de vídeo y RF'},
        'fotos': [
            {'id': 'm4jr', 'titulo': 'IC BD M4Jr. PAL montada (1992)', 'origen': 'sms/fotos/M4JrPALTop.jpg', 'ancho': 1600, 'calidad': 74,
             'credito': 'ConsoleMods Wiki · CC BY', 'revision': 'Familia 171-5922A', 'hotspots': D2.SMS_M4JR},
            {'id': '5922a', 'titulo': '171-5922A sin componentes', 'origen': 'sms/fotos/171-5922ATop.jpg', 'ancho': 1600, 'calidad': 70,
             'credito': 'ConsoleMods Wiki · CC BY', 'revision': '171-5922A, la del manual', 'hotspots': D2.SMS_5922A},
        ],
        'aviso': 'Esquema oficial del Master System II PAL (placa 171-5922A, manual de servicio de Sega de abril de 1991), '
                 'transcrito a mano de las tres hojas escaneadas y redibujado: cada componente lleva los números y nombres de '
                 'pin del manual y cada pin la etiqueta de su red. Las lecturas dudosas están en «Fuentes».',
    },
    {
        'id': 'megadrive',
        'titulo': 'Mega Drive',
        'placa': 'Modelo 1 VA6.8 PAL (IC BD M5 PAL)',
        'esquema_titulo': 'IC BD M5 PAL VA5/VA6 (stonedDiscord)',
        'raiz': 'megadrive/kicad7/MegaDrive.kicad_sch',
        'netlist': 'megadrive/netlist/MegaDrive.nets.json',
        'buses': 'megadrive/netlist/MegaDrive.buses.json',
        'svg': lambda path: 'megadrive/svg/MegaDrive.svg',
        'fotos': [
            {'id': 'va68', 'titulo': 'Mega Drive modelo 1 VA6.8 PAL (IC BD M5 PAL)', 'origen': 'megadrive/fotos/Model1VA6.8.jpg',
             'ancho': 1600, 'calidad': 76, 'credito': 'ConsoleMods Wiki · CC BY', 'revision': 'VA6.8 PAL (V6.8, 10 APR 1993)',
             'hotspots': D2.MD_PAL,
             'nota': 'Los cables rojo, azul, blanco y marrón no son de fábrica: son una modificación posterior (ver el punto «Cables añadidos»).',
             'pcb': {'huellas': 'megadrive/pcb/MegaDrive_footprints.json', 'ajuste': 'megadrive/pcb/VA6.8_ajuste.json'}},
            {'id': 'va6', 'titulo': 'Genesis modelo 1 VA6 (IC BD M5 USA)', 'origen': 'megadrive/fotos/USVA6.jpg', 'ancho': 1600, 'calidad': 75,
             'credito': 'ConsoleMods Wiki · CC BY', 'revision': 'VA6', 'hotspots': D2.MD_VA6,
             'pcb': {'huellas': 'megadrive/pcb/MegaDrive_footprints.json', 'mm': [132.1, 116.5], 'px': [770, 575], 'escala': 5.32}},
        ],
        'aviso': 'Recreación «1:1» de la placa PAL «IC BD M5» de la generación VA5/VA6 hecha por stonedDiscord a partir de '
                 'escaneos de ArcadeTV (valores sin verificar según su README). La foto principal es una VA6.8 PAL («IC BD M5 PAL», '
                 'V6.8, abril de 1993) con la misma disposición: el árbitro es el 315-5433 en vez del 315-5402 del esquema y el '
                 'codificador de vídeo, un MB3514 de montaje superficial en vez del CXA1145. La segunda foto es una VA6 de EE. UU. '
                 '(NTSC).',
    },
    {
        'id': 'gb',
        'titulo': 'Game Boy',
        'placa': 'DMG-CPU-05 / -06',
        'esquema_titulo': 'DMG-CPU-06 + DMG-LCD-06 (Gekkio)',
        'raiz': 'gb/kicad7/DMG-CPU-06.kicad_sch',
        'netlist': 'gb/netlist/DMG-CPU-06.nets.json',
        'buses': 'gb/netlist/DMG-CPU-06.buses.json',
        'svg': lambda path: 'gb/svg/DMG-CPU-06%s.svg' % ('' if path == '/' else '-' + path.strip('/')),
        'nombre_raiz': 'Placa base DMG-CPU-06',
        'placas_extra': [
            {'raiz': 'gb/kicad7/DMG-LCD-06/DMG-LCD-06.kicad_sch', 'netlist': 'gb/netlist/DMG-LCD-06.nets.json',
             'buses': 'gb/netlist/DMG-LCD-06.buses.json', 'svg': lambda path: 'gb/svg/DMG-LCD-06.svg',
             'nombre_raiz': 'Placa de la pantalla DMG-LCD-06', 'prefijo_ref': 'LCD-', 'prefijo_red': '/DMG-LCD-06'},
        ],
        'fotos': [
            {'id': 'cpu05', 'titulo': 'Placa base DMG-CPU-05 montada', 'origen': 'gb/fotos/gekkio-3_03_mainboard_front.jpg', 'ancho': 984,
             'credito': 'gbhwdb (gekkio-3) · CC BY-SA 4.0', 'revision': 'DMG-CPU-05', 'hotspots': D2.GB_05},
            {'id': 'pistas', 'titulo': 'DMG-CPU-06 sin componentes, con las pistas', 'origen': 'gb/fotos/DMG-CPU-06_ArcadeTV_ambas_caras.jpg',
             'ancho': 2000, 'calidad': 78, 'credito': 'Escaneo de ArcadeTV (dominio público) · pistas de Gekkio (CC BY 4.0)',
             'revision': 'DMG-CPU-06, la del esquema', 'hotspots': D2.GB_SCAN,
             'nota': 'Izquierda: cara de componentes. Derecha: cara de soldadura. Las pistas de Gekkio cubren las dos caras, así que un bus se ve cruzar de una a otra por las vías.',
             'trazas': {'svg': 'gb/fotos/DMG-CPU-06_trazado_Gekkio.svg', 'mapa': None}},
            {'id': 'lcd-b', 'titulo': 'Placa de la pantalla DMG-LCD-06 (dorso)', 'origen': 'gb/fotos/gekkio-3_06_lcd_board_back.jpg', 'ancho': 1008,
             'credito': 'gbhwdb (gekkio-3) · CC BY-SA 4.0', 'revision': 'DMG-LCD-06', 'hotspots': D2.GB_LCD_B},
            {'id': 'lcd-f', 'titulo': 'Placa de la pantalla DMG-LCD-06 (frente)', 'origen': 'gb/fotos/gekkio-3_05_lcd_board_front.jpg', 'ancho': 968,
             'credito': 'gbhwdb (gekkio-3) · CC BY-SA 4.0', 'revision': 'DMG-LCD-06', 'hotspots': D2.GB_LCD_F},
        ],
        'aviso': 'Esquemas de Gekkio de la placa base DMG-CPU-06 y de la placa de la pantalla DMG-LCD-06, medidos desoldando cada '
                 'componente. La foto principal es una DMG-CPU-05: según Gekkio, las revisiones solo cambian pasivos y trazado. '
                 'En la placa de la pantalla las referencias llevan delante «LCD-».',
    },
    {
        'id': 'gbc',
        'titulo': 'Game Boy Color',
        'placa': 'CGB-CPU-04',
        'esquema_titulo': 'CGB-CPU-04 (Natalie the Nerd, reconstruido del PDF)',
        'pdf': True,
        'netlist': 'gbc/cgb04/CGB_CPU04.nets.json',
        'geom': 'gbc/cgb04/CGB_CPU04.geom.json',
        'comparar': 'gbc/opengbc/netlist/opengbc.nets.json',
        'buses': 'gbc/cgb04/CGB_CPU04.buses.json',
        'nombre_raiz': 'Raíz: CPU CGB, WRAM y cartucho',
        'fotos': [
            {'id': 'frente', 'titulo': 'CGB-CPU-04, cara de componentes', 'origen': 'gbc/fotos/C16416396_03_pcb_front.jpg', 'ancho': 872,
             'credito': 'gbhwdb (C16416396) · CC BY-SA 4.0', 'revision': 'CGB-CPU-04', 'hotspots': D2.GBC_F},
            {'id': 'dorso', 'titulo': 'CGB-CPU-04, cara de los botones', 'origen': 'gbc/fotos/C16416396_04_pcb_back.jpg', 'ancho': 964,
             'credito': 'gbhwdb (C16416396) · CC BY-SA 4.0', 'revision': 'CGB-CPU-04', 'hotspots': D2.GBC_B},
        ],
        'aviso': 'Esquema de la placa ORIGINAL CGB-CPU-04, redibujado por Natalie the Nerd a partir de la placa lijada y escaneada '
                 '(valores del esquema de Nintendo). Solo se publica como PDF de KiCad: el dibujo, los pines y las redes se han '
                 'reconstruido del PDF y se han comprobado con la recreación opengbc (ver «Fuentes»). Natalie avisa de que puede '
                 'haber alguna inexactitud.',
    },
]

# Gekkio's trace layer labels -> DMG-CPU-06 netlist names
TRAZAS_GB = {'GND': 'GND', 'BT+': '/Power/BT+', 'VDD': 'VDD', 'VEE': 'VEE', 'VCC': 'VCC', 'SW1-VCC': '/Power/SW1-VCC',
             'DC-VCC': '/Power/DC-VCC', 'P2-VDD': '/Link port/P2-VDD', 'nWR': '/~{WR}', 'nRD': '/~{RD}', 'nCS': '/~{CS}',
             'nMCS': '/~{MCS}', 'nMRD': '/~{MRD}', 'nMWR': '/~{MWR}', 'LD0': '/LD0', 'LD1': '/LD1', 'CPG': '/CPG', 'CP': '/CP',
             'ST': '/ST', 'CPL': '/CPL', 'FR': '/FR', 'S': '/S', 'SCK': '/SCK', 'SIN': '/SIN', 'SOUT': '/SOUT',
             'P2-SCK': '/Link port/P2-SCK', 'P2-SIN': '/Link port/P2-SIN', 'P2-SOUT': '/Link port/P2-SOUT',
             'P2-P14': '/Link port/P2-P14', 'nRES': '/~{RES}', 'PHI': '/PHI', 'CK1': 'Net-(U1-CK1)', 'CK2': 'Net-(U1-CK2)',
             'SW': '/Analog audio/SW', 'VIN': '/VIN', 'SO1': '/SO1', 'SO2': '/SO2', 'SP': '/SP', 'R5-SO1': 'Net-(C3-Pad2)',
             'R6-SO2': 'Net-(C4-Pad2)', 'VR1-SO1': '/Analog audio/VR1-SO1', 'VR1-SO2': '/Analog audio/VR1-SO2',
             'RIN': '/Analog audio/RIN', 'LIN': '/Analog audio/LIN', 'ROUT': '/Analog audio/ROUT', 'LOUT': '/Analog audio/LOUT',
             'HPRBC': '/Analog audio/HPRBC', 'HPLBC': '/Analog audio/HPLBC'}
TRAZAS_GB.update({'A%d' % i: '/A%d' % i for i in range(16)})
TRAZAS_GB.update({'D%d' % i: '/D%d' % i for i in range(8)})
TRAZAS_GB.update({'MA%d' % i: '/MA%d' % i for i in range(13)})
TRAZAS_GB.update({'MD%d' % i: '/MD%d' % i for i in range(8)})
TRAZAS_GB.update({'P1%d' % i: '/P1%d' % i for i in range(6)})
MAQUINAS[4]['fotos'][1]['trazas']['mapa'] = TRAZAS_GB


def q(v):
    return int(round(v * 100))


def bbox_label(lb):
    """Approximate box of a label for hit testing (mm): text along the label direction."""
    size = lb['size']
    n = len(lb.get('texto', lb['name']).replace('~{', '').replace('}', ''))
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


def renombrar_placa(sheets, net, buses, pref_ref, pref_red):
    """A second board drawn in the same machine (Game Boy LCD board): references get a prefix and nets are
    moved under their own sheet path, so they never merge with the mainboard's (both have U1, GND …)."""
    def ren(n):
        if n.startswith('unconnected-('):
            return 'unconnected-(' + pref_ref + n[len('unconnected-('):]
        return pref_red + (n if n.startswith('/') else '/' + n)

    for sh in sheets:
        for sym in sh.symbols:
            if sym['power']:
                for p in sym['pins']:
                    if p['type'] == 'power_in':
                        p['name'] = ren(p['name'] or sym['value'])
            elif sym['ref']:
                sym['ref'] = pref_ref + sym['ref']
        for lb in sh.labels:
            lb['texto'] = lb['name']
            if lb['kind'] == 'global':
                lb['name'] = ren(lb['name'])
    net = {'nets': [{'name': ren(n['name']),
                     'nodes': [dict(nd, ref=pref_ref + nd['ref']) for nd in n['nodes']]} for n in net['nets']],
           'components': {pref_ref + k: v for k, v in net['components'].items()}}
    buses = {k: [ren(n) for n in v] for k, v in buses.items()}
    return net, buses


def construir(m, problemas):
    if m.get('pdf'):
        return construir_pdf(m, problemas)
    placas = [{'raiz': m['raiz'], 'netlist': m['netlist'], 'buses': m['buses'], 'svg': m['svg'],
               'nombre_raiz': None}] + m.get('placas_extra', [])
    sheets = []
    net = {'nets': [], 'components': {}}
    buses = {}
    svg_de = []
    nombre_raiz = {}
    for pl in placas:
        sh = K.load_tree(os.path.join(SRC, pl['raiz']))
        n = json.load(open(os.path.join(SRC, pl['netlist']), encoding='utf-8'))
        b = json.load(open(os.path.join(SRC, pl['buses']), encoding='utf-8'))
        if pl.get('prefijo_ref'):
            n, b = renombrar_placa(sh, n, b, pl['prefijo_ref'], pl['prefijo_red'])
        if pl['nombre_raiz']:
            nombre_raiz[len(sheets)] = pl['nombre_raiz']
        for x in sh:
            svg_de.append(pl['svg'])
        sheets += sh
        net['nets'] += n['nets']
        net['components'].update(n['components'])
        for k, v in b.items():
            buses.setdefault(k, []).extend(v)
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
        svg_file = os.path.join(SRC, svg_de[si](sh.path))
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
            etiquetas.append([r, kind, lb.get('texto', lb['name']), q(x0), q(y0), q(x1), q(y1)])
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
        if si in nombre_raiz:
            nombre = nombre_raiz[si]
        elif sh.path in m.get('nombres_hoja', {}):
            nombre = m['nombres_hoja'][sh.path]
        else:
            nombre = sh.title if sh.path != '/' else (m['esquema_titulo'] if len(sheets) == 1 else m.get('nombre_raiz', 'Jerarquía (raíz)'))
        padre = None
        if sh.path != '/':
            padre = next((i for i, s2 in enumerate(sheets) if sh.uuid_path.rsplit('/', 1)[0] == s2.uuid_path), None)
        hojas.append({'id': si, 'nombre': nombre, 'ruta': sh.path, 'archivo': base, 'ancho': round(w, 3),
                      'alto': round(h, 3), 'padre': padre})
    return finalizar(m, componentes, redes, hojas, tam, problemas)


def construir_pdf(m, problemas):
    """A schematic published only as a KiCad PDF (Game Boy Color CGB-CPU-04): netlist and geometry rebuilt by
    /home/claude/consolas/tools/pdf2kicadnet.py; the drawing is the PDF's own vector content."""
    net = json.load(open(os.path.join(SRC, m['netlist']), encoding='utf-8'))
    geom = json.load(open(os.path.join(SRC, m['geom']), encoding='utf-8'))
    buses = json.load(open(os.path.join(SRC, m['buses']), encoding='utf-8'))
    grupo_de = {}
    for gk, names in buses.items():
        if gk != 'other_named':
            for n in names:
                grupo_de.setdefault(n, gk)
    redes = []
    idx = {}
    for n in sorted(net['nets'], key=lambda n: n['name']):
        idx[n['name']] = len(redes)
        redes.append({'n': n['name'], 'g': grupo_de.get(n['name']),
                      'nodos': [[nd['ref'], nd['pin'], nd['function']] for nd in n['nodes']], 'h': []})
    componentes = {ref: {'v': c['value'], 'l': c['lib'].split(':')[-1], 'h': []} for ref, c in net['components'].items()}
    os.makedirs(os.path.join(OUT, m['id']), exist_ok=True)
    hojas = []
    tam = 0
    nombres = {}
    for pg in geom['pages']:
        ws = [w['t'] for w in pg['words']]
        nm = None
        for i, t in enumerate(ws):
            if t == 'Sheet:' and i + 1 < len(ws):
                nm = ws[i + 1]
                break
        nombres[pg['page']] = nm or '/'
    for pg in geom['pages']:
        si = pg['page']
        w, h = pg['w'], pg['h']
        layers = P.capas(pg['draw'])
        binario = S.encode(w, h, layers)
        base = '%s/hoja-%d' % (m['id'], si)
        with open(os.path.join(OUT, base + '.bin'), 'wb') as f:
            f.write(binario)
        tam += len(binario)

        def r_of(name):
            return idx.get(name, -1) if name else -1

        def marca(r):
            if r >= 0 and si not in redes[r]['h']:
                redes[r]['h'].append(si)

        hilos = []
        for name, a, b in pg['wires']:
            r = r_of(name)
            marca(r)
            hilos += [r, a[0], a[1], b[0], b[1]]
        uniones = []
        for jx in pg['junctions']:
            r = -1
            for name, a, b in pg['wires']:
                if K.on_segment((jx[0], jx[1]), (a[0], a[1]), (b[0], b[1]), tol=6) or list(jx) in (a, b):
                    r = r_of(name)
                    break
            uniones += [r, jx[0], jx[1]]
        pines = []
        for name, ref, pin, fn, conn, inner in pg['pins']:
            r = r_of(name)
            marca(r)
            pines.append([r, ref, pin, fn, conn[0], conn[1], inner[0], inner[1]])
            if ref in componentes and si not in componentes[ref]['h']:
                componentes[ref]['h'].append(si)
        etiquetas = []
        for name, texto, box in pg['labels']:
            r = r_of(name)
            marca(r)
            etiquetas.append([r, 'local', texto, box[0], box[1], box[2], box[3]])
        for name, valor, box in pg['powers']:
            r = r_of(name)
            marca(r)
            etiquetas.append([r, 'pwr', valor, box[0], box[1], box[2], box[3]])
        simbolos = [[base_ref, box[0], box[1], box[2], box[3]] for base_ref, unidad, box in pg['symbols']]
        subhojas = []
        for child, nm, box, pins in pg['sheets']:
            subhojas.append([child, nombres.get(child, nm).strip('/') or nm, box[0], box[1], box[2] - box[0], box[3] - box[1],
                             [[r_of(n), t, (b[0] + b[2]) // 2, (b[1] + b[3]) // 2] for n, t, b in pins]])
        capa = {'w': q(w), 'h': q(h), 'hilos': hilos, 'uniones': uniones, 'pines': pines, 'etiquetas': etiquetas,
                'simbolos': simbolos, 'buses': [], 'subhojas': subhojas}
        texto = json.dumps(capa, ensure_ascii=False, separators=(',', ':'))
        with open(os.path.join(OUT, base + '.json'), 'w', encoding='utf-8') as f:
            f.write(texto)
        tam += len(texto.encode('utf-8'))
        ruta = nombres[si]
        padre = None if ruta == '/' else 0
        hojas.append({'id': si, 'nombre': m.get('nombre_raiz', 'Raíz') if ruta == '/' else ruta.strip('/'), 'ruta': ruta,
                      'archivo': base, 'ancho': round(w, 3), 'alto': round(h, 3), 'padre': padre})
    if m.get('comparar'):
        m['equivalencias'] = comparar_cgb(net, json.load(open(os.path.join(SRC, m['comparar']), encoding='utf-8')))
    reached = {redes[i]['n'] for i in range(len(redes)) if redes[i]['h']}
    for n in net['nets']:
        if n['name'] not in reached and not n['name'].startswith('unconnected-'):
            problemas.append('%s: red sin geometría: %s' % (m['id'], n['name']))
    return finalizar(m, componentes, redes, hojas, tam, problemas)


def comparar_cgb(a, b):
    """Rows for «Fuentes»: the CGB-CPU-04 netlist rebuilt from Natalie's PDF against opengbc's KiCad netlist."""
    import re

    def pinmap(d, ref):
        out = {}
        for n in d['nets']:
            for nd in n['nodes']:
                if nd['ref'] == ref:
                    out[nd['pin']] = (nd['function'], n['name'])
        return out

    def norm(t):
        return re.sub(r'[~{}\\/]', '', t or '').upper()

    alias = {('XTAL1', 'CK1'), ('XTAL2', 'CK2'), ('SCLK', 'SCK'), ('NM1', 'NMI'), ('Φ', 'PHI'), ('S01', 'SO1'), ('S02', 'SO2')}
    A, B = pinmap(a, 'U1'), pinmap(b, 'U1')
    comunes = [p for p in A if p in B]
    iguales = 0
    for p in comunes:
        fa, fb = norm(A[p][0]), norm(B[p][0])
        if fa == fb or (fa, fb) in alias or (A[p][1] == 'GND' and B[p][1] == 'GND') or fa in fb or fb in fa:
            iguales += 1

    def adj(d, otros):
        out = {}
        for n in d['nets']:
            if n['name'] in ('GND', '+5V', '+3V3', 'VCC', '+3.3V'):
                continue
            for p in [nd['pin'] for nd in n['nodes'] if nd['ref'] == 'U1']:
                out[p] = sorted((otros[nd['ref']], nd['pin']) for nd in n['nodes'] if nd['ref'] in otros)
        return out

    filas = []
    for nombre, oa, ob in [('ranura de cartucho (P1) y WRAM (U2)', {'P1': 'cart', 'U2': 'sram'}, {'P1': 'cart', 'U2': 'sram'}),
                           ('conector de la pantalla (P2)', {'P2': 'ffc'}, {'P2': 'ffc'})]:
        X, Y = adj(a, oa), adj(b, ob)
        ok = bad = 0
        for p in set(X) & set(Y):
            if X[p] or Y[p]:
                if X[p] == Y[p]:
                    ok += 1
                else:
                    bad += 1
        filas.append({'foto': 'U1 ↔ %s' % nombre, 'esquema': 'U1 ↔ %s' % nombre,
                      'senales': '%d pines de la CPU con exactamente las mismas conexiones, %d distintos.' % (ok, bad),
                      'cambios': '', 'fuente': 'comparación de redes'})
    sin = 128 - len(A)
    filas.insert(0, {'foto': 'CPU CGB (U1), %d de 128 pines conectados' % len(A), 'esquema': 'GameBoy_CPU_CGB (U1, símbolo de Gekkio)',
                     'senales': '%d de %d pines comunes con la misma función (alias: XTAL1/CK1, SCLK/SCK, NM1/NMI, φ/PHI, S01/SO1; '
                                'las patillas de prueba que las dos placas llevan a masa).' % (iguales, len(comunes)),
                     'cambios': 'Los %d pines restantes son NC en la placa original (MD8–MD15, M1, 39).' % sin,
                     'fuente': 'comparación de redes'})
    filas.append({'foto': 'LH52256CVT, IR3R56, CGB_REG, DC-DC (U5)', 'esquema': 'AS6C62256, LM4853, LD1117, TPS3840, regulador externo',
                  'senales': 'Mismas funciones.', 'cambios': 'opengbc sustituye la RAM, el amplificador, la alimentación y el reset por '
                  'piezas actuales y usa una pantalla IPS: por eso no se dibuja como esquema de la consola.', 'fuente': 'README de opengbc'})
    return filas


def preparar_fotos(m, problemas):
    """Photos of a machine: the book's (nes, neogeo: m['foto'] + m['hotspots']) or licensed photos from the
    research folder, resized into public/consolas/<id>/ (m['fotos'])."""
    if 'fotos' not in m:
        return m['foto'], m['hotspots'], [], 0
    lista = []
    tam = 0
    for k, fs in enumerate(m['fotos']):
        destino = os.path.join(OUT, m['id'], 'foto-%s.jpg' % fs['id'])
        w, h = F.foto(os.path.join(SRC, fs['origen']), destino, fs.get('ancho', 1600), fs.get('calidad', 80))
        tam += os.path.getsize(destino)
        entrada = {'id': fs['id'], 'titulo': fs['titulo'], 'src': 'consolas/%s/foto-%s.jpg' % (m['id'], fs['id']),
                   'ancho': w, 'alto': h, 'figura': None, 'credito': fs['credito'], 'revision': fs.get('revision', '')}
        if fs.get('nota'):
            entrada['nota'] = fs['nota']
        for hs in fs['hotspots']:
            for c in hs['cajas']:
                if not F.caja_valida(c, w, h):
                    problemas.append('%s: caja fuera de la foto %s en %s' % (m['id'], fs['id'], hs['id']))
        if fs.get('trazas'):
            tz = fs['trazas']
            img = Image.open(os.path.join(SRC, fs['origen']))
            k_esc = w / img.width
            redes_tr, faltan = F.trazas(os.path.join(SRC, tz['svg']), k_esc, tz['mapa'])
            for lab in faltan:
                problemas.append('%s: la capa de pistas no tiene %s' % (m['id'], lab))
            ruta = '%s/trazas-%s.json' % (m['id'], fs['id'])
            tam += F.escribir_json(os.path.join(OUT, ruta), {'version': 1, 'ancho': w, 'alto': h, 'redes': redes_tr})
            entrada['trazas'] = 'consolas/' + ruta
            entrada['trazas_redes'] = sorted(redes_tr)
        if fs.get('pcb'):
            # footprint reference points of a KiCad PCB that has the photographed layout: scale + offset
            pc = fs['pcb']
            hu = json.load(open(os.path.join(SRC, pc['huellas']), encoding='utf-8'))
            if pc.get('ajuste'):
                # photo taken at an angle: fitted homography + quadratic correction (see the JSON's description)
                aj = json.load(open(os.path.join(SRC, pc['ajuste']), encoding='utf-8'))
                k_aj = w / aj['ancho']

                def llevar(X, Y, aj=aj, k_aj=k_aj):
                    Hm, C = aj['H'], aj['C']
                    d = Hm[2][0] * X + Hm[2][1] * Y + Hm[2][2]
                    u = (Hm[0][0] * X + Hm[0][1] * Y + Hm[0][2]) / d
                    v = (Hm[1][0] * X + Hm[1][1] * Y + Hm[1][2]) / d
                    xx, yy = (X - 160) / 100, (Y - 120) / 100
                    b = [1, xx, yy, xx * xx, xx * yy, yy * yy]
                    return ((u + sum(bi * c[0] for bi, c in zip(b, C))) * k_aj, (v + sum(bi * c[1] for bi, c in zip(b, C))) * k_aj)
                nota = ('Punto de referencia de la huella en la PCB de stonedDiscord (el pin 1 en los DIP), llevado a esta foto '
                        'hecha en ángulo con una homografía y una corrección cuadrática ajustadas a %d puntos (taladros y patas '
                        'de chips): error de unos 10 px, hasta 20 en el borde izquierdo' % len(aj['puntos']))
            else:
                k_px = pc['escala'] * w / fs.get('ancho', w)

                def llevar(X, Y, pc=pc):
                    return (pc['px'][0] + (X - pc['mm'][0]) * pc['escala'], pc['px'][1] + (Y - pc['mm'][1]) * pc['escala'])
                nota = ('Punto de referencia de la huella en la PCB de stonedDiscord (el pin 1 en los DIP), '
                        'llevado a la foto con %.2f px/mm' % k_px)
            pos = {}
            for fp in hu['footprints']:
                x, y = llevar(fp['x'], fp['y'])
                if 0 <= x < w and 0 <= y < h and not fp['ref'].startswith(('FID', 'H')):
                    pos[fp['ref']] = [round(x), round(y)]
            entrada['posiciones'] = pos
            entrada['posiciones_nota'] = nota
        lista.append((entrada, [dict(hs) for hs in fs['hotspots']]))
    principal, hot = lista[0]
    extra = [dict(e, hotspots=hs) for e, hs in lista[1:]]
    return principal, hot, extra, tam


def grupos_de(mid):
    return D.GRUPOS.get(mid) or D2.GRUPOS2[mid]


def finalizar(m, componentes, redes, hojas, tam, problemas):
    foto, hot, fotos_extra, tam_fotos = preparar_fotos(m, problemas)
    todos = hot + [h for f in fotos_extra for h in f['hotspots']]
    ids = [h['id'] for h in todos]
    for i in set(ids):
        if ids.count(i) > 1:
            problemas.append('%s: id de punto repetido %s' % (m['id'], i))
    for hs in todos:
        for ref in hs['esquema']:
            if ref not in componentes:
                problemas.append('%s: el punto %s cita %s, que no está en el esquema' % (m['id'], hs['id'], ref))
        for g in hs['buses']:
            if g not in grupos_de(m['id']):
                problemas.append('%s: grupo de buses desconocido %s' % (m['id'], g))
    nombres_red = {r['n'] for r in redes}
    for f in fotos_extra:
        for hs in f['hotspots']:
            for rn in hs.get('redes', []):
                if rn not in nombres_red:
                    problemas.append('%s: el punto %s cita la red %s, que no existe' % (m['id'], hs['id'], rn))
    foto_de = {}
    for hs in todos:
        for ref in hs['esquema']:
            foto_de.setdefault(ref, hs['id'])
    for ref, c in componentes.items():
        if ref in foto_de:
            c['f'] = foto_de[ref]
    for r in redes:
        r['h'].sort()
    for c in componentes.values():
        c['h'].sort()

    datos = {
        'version': 1,
        'id': m['id'],
        'titulo': m['titulo'],
        'placa': m['placa'],
        'esquema_titulo': m['esquema_titulo'],
        'aviso': m['aviso'],
        'foto': foto,
        'hotspots': hot,
        'grupos': grupos_de(m['id']),
        'hojas': hojas,
        'componentes': componentes,
        'redes': redes,
        'equivalencias': D.EQUIVALENCIAS if m['id'] == 'neogeo' else m.get('equivalencias') or D2.EQUIVALENCIAS_DE.get(m['id'], []),
        'fuentes': D.FUENTES.get(m['id']) or D2.FUENTES2[m['id']],
    }
    if fotos_extra:
        datos['fotos'] = fotos_extra
    if m.get('dudas'):
        import importlib.util
        spec = importlib.util.spec_from_file_location('transcripcion_' + m['id'], os.path.join(SRC, m['dudas']))
        tr = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(tr)
        datos['notas'] = [{'ref': r, 'pin': p, 'texto': t} for r, p, t in tr.DUDAS]
    for k in ('revisiones', 'equivalencias_cabecera', 'citas', 'notas', 'trazas_de'):
        v = D2.EXTRA.get(m['id'], {}).get(k)
        if v:
            datos[k] = v
    texto = json.dumps(datos, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, m['id'] + '.json'), 'w', encoding='utf-8') as f:
        f.write(texto)
    tam += len(texto.encode('utf-8')) + tam_fotos
    return {'hojas': len(hojas), 'redes': len(redes), 'componentes': len(componentes),
            'hotspots': len(todos), 'bytes': tam, 'fotos': tam_fotos}


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
