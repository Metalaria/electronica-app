"""Console mainboards in 3D and 2D («Placa en 3D» / «Placa en 2D» of the «Consolas» section).

Writes web/public/consolas/placas/ in the format of the «Proyectos KiCad» boards (ESQUEMA.md, «Proyectos KiCad»,
<placa>.json), so the same viewer draws them, plus a few fields of its own (`consola`):

  indice.json        {version, placas: [{id, maquina, titulo, corto, enlazada, componentes, redes, bytes}]}
  <placa>.json       DatosPlaca + consola {maquina, enlazada, aviso, fuente, redes {board net -> schematic net},
                     refs [references that are also in the console's schematic], capas_internas}

Sources (read only, never copied into the repository; env CONSOLAS_FUENTES, default /home/claude/consolas):
  - nes:         Redherring32/OpenTendo «Board Files/Motherboard.kicad_pcb» (KiCad 8, TAPR OHL 1.0): a near 1:1
                 recreation of the NES-CPU-11 with the references and net names of the console's schematic;
  - megadrive:   stonedDiscord/MegaDrive.kicad_pcb (KiCad 9): the same project as the console's schematic, so
                 every reference and net matches it (checked here);
  - gbc-cgb04:   Natalie the Nerd's Gerbers of the CGB-CPU-04 (4 layers, X2 attributes: nets, references and pins
                 of every pad), read with consolas_gerber.py; there is no placement data, so no part bodies;
  - gbc-opengbc: whatwareweb/opengbc (KiCad 9), a modern replacement board: shown, but not linked to the
                 CGB-CPU-04 schematic (other references).
  - neogeo:      Board-Folk/NeoGeoAES-3.5 NeoGeoAES3_5.kicad_pcb (KiCad 10, 53 MB, not in the research folder):
                 the same project as the console's schematic. Pass its path in CONSOLAS_PCB_NEOGEO (any board's
                 source can be given in CONSOLAS_PCB_<ID>); KiCad 10 names the nets of pads and tracks instead of
                 numbering them, which proyectos_kicad_pcb.net_id handles.
The Master System's slowcoder/SMSSchematic.kicad_pcb has no footprints (an empty KiCad 4 board): skipped.

The KiCad 9 boards are read with proyectos_kicad_pcb (its s-expression reader copes with the newer syntax). Their
silkscreen text needs KiCad's stroke font: every silkscreen item is copied, in board coordinates, into a minimal
KiCad 7 board that kicad-cli 7 plots to SVG (cached in contenido/.cache/consolas_pcb), then read like the projects'.

Run alone: python3 contenido/consolas_pcb.py [board id …]   (with ids, only those boards are rebuilt; a board whose
source is missing keeps its previous files and index entry)
"""

import collections
import io
import json
import math
import os
import re
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, 'web/public/consolas/placas')
CONSOLAS_JSON = os.path.join(APP, 'web/public/consolas')
FUENTES = os.environ.get('CONSOLAS_FUENTES', '/home/claude/consolas')

sys.path.insert(0, HERE)
import consolas_kicad as K          # noqa: E402
import proyectos_kicad_pcb as P     # noqa: E402
import proyectos_kicad as PK        # noqa: E402  (read only: kicad-cli cache, silkscreen SVG reader, helpers)
import consolas_gerber as G         # noqa: E402

# kicad-cli results of this script go to their own cache folder
PK.CACHE = os.path.join(HERE, '.cache/consolas_pcb')
q = PK.q
Q = K.Q

PLACAS = [
    {
        'id': 'nes', 'maquina': 'nes', 'tipo': 'kicad',
        'ruta': 'nes/original/OpenTendo/Board Files/Motherboard.kicad_pcb',
        'soldar_bordes': 0.005,
        'titulo': 'NES-CPU-11, recreación OpenTendo v1.4 (KiCad 8)',
        'corto': 'NES-CPU-11 · OpenTendo',
        'enlazada': True,
        'mascara': 'verde', 'serigrafia': 'blanca', 'acabado': None,
        'aviso': 'Recreación «casi 1:1» de la placa NES-CPU-11 de Nintendo hecha por el proyecto OpenTendo a partir de '
                 'escaneos de la placa original: sigue el trazado OEM, pero es un dibujo nuevo, no una foto, y la foto de '
                 'la pestaña «Foto» es de una NES-CPU-07. Usa las mismas referencias y nombres de red que el esquema '
                 'NES-CPU-11, así que se enlazan uno a uno; los mandos, los LED y los interruptores van en placas aparte.',
        'fuente': {'titulo': 'Redherring32/OpenTendo — Board Files/Motherboard.kicad_pcb (v1.4, KiCad 8, commit 3bd0b0b)',
                   'autor': 'Redherring32, Muramasa y Kamoteshake (OpenTendo)',
                   'url': 'https://github.com/Redherring32/OpenTendo',
                   'licencia': 'TAPR Open Hardware License 1.0 (permite estudiar, modificar y distribuir)',
                   'uso': 'Placa en 3D y en 2D: contorno, cobre de las dos caras, vías, taladros, serigrafía y componentes '
                          'con sus huellas; recorrido de las señales en «Un fotograma».'},
    },
    {
        'id': 'megadrive', 'maquina': 'megadrive', 'tipo': 'kicad',
        'ruta': 'megadrive/original/MegaDrive-stonedDiscord/MegaDrive.kicad_pcb',
        'titulo': 'IC BD M5 PAL (VA5/VA6), recreación KiCad de stonedDiscord',
        'corto': 'IC BD M5 PAL · recreación KiCad',
        'enlazada': True,
        'mascara': 'verde', 'serigrafia': 'blanca', 'acabado': None,
        'aviso': 'Recreación «1:1» en KiCad de la placa PAL original (generación VA5/VA6) hecha por stonedDiscord a partir de '
                 'escaneos de la placa desnuda: sigue el trazado original, pero es un dibujo nuevo, no una foto. Es el mismo '
                 'proyecto que el esquema, así que referencias y redes coinciden una a una. El README pide aún «verificar los '
                 'valores de los componentes».',
        'fuente': {'titulo': 'stonedDiscord/MegaDrive — PCB de la recreación (MegaDrive.kicad_pcb, KiCad 9)',
                   'autor': 'stonedDiscord, a partir de los escaneos de ArcadeTV («STRIP-CLUB PCB-Scans»)',
                   'url': 'https://github.com/stonedDiscord/MegaDrive',
                   'licencia': 'Sin fichero de licencia (el README dice OSHW, sin nombrarla): uso privado, sin redistribuir',
                   'uso': 'Placa en 3D y en 2D: contorno, cobre de las dos caras, planos, vías, taladros, serigrafía y '
                          'componentes con sus huellas.'},
    },
    {
        'id': 'neogeo', 'maquina': 'neogeo', 'tipo': 'kicad',
        'ruta': 'neogeo/original/NeoGeoAES-3.5/NeoGeoAES3_5.kicad_pcb',
        'titulo': 'NEO-AES3-5, recreación KiCad de Board Folk (rev. BF1.5)',
        'corto': 'NEO-AES3-5 · recreación KiCad',
        'enlazada': True,
        'mascara': 'verde', 'serigrafia': 'blanca', 'acabado': None,
        'aviso': 'Recreación en KiCad de la placa NEO-AES3-5 (2.ª generación del chipset) hecha por el equipo Board Folk '
                 'a partir de los esquemas de SNK y de escaneos del cobre original («razonablemente fiel», según su README; '
                 'la revisión BF1.5 aún no se ha fabricado). Es el mismo proyecto que el esquema, así que referencias y '
                 'redes coinciden, pero no es la NEO-AES de 1.ª generación de la foto del libro: el LSPC-A0 de la foto es aquí '
                 'el LSPC2-A2, y los PRO-B0 y PRO-C0 se reparten entre NEO-B1 y NEO-C1 (tabla de equivalencias).',
        'fuente': {'titulo': 'Board-Folk/NeoGeoAES-3.5 — PCB de la recreación (NeoGeoAES3_5.kicad_pcb, KiCad 10, rev. BF1.5)',
                   'autor': 'Equipo Board Folk; trazado de Rob Taylor (@PeepoUK)',
                   'url': 'https://github.com/Board-Folk/NeoGeoAES-3.5',
                   'licencia': 'Dominio público según su README («no claim of copyright … solely for the purposes of '
                               'study and historical preservation»)',
                   'uso': 'Placa en 3D y en 2D: contorno, cobre de las dos caras, planos, vías, taladros, serigrafía y '
                          'componentes con sus huellas.'},
    },
    {
        'id': 'gbc-cgb04', 'maquina': 'gbc', 'tipo': 'gerber',
        'ruta': 'descargas_usuario_4/CGB_ReverseEngineer/Technical Files/Gerbers_CGB_CPU_04_Reverse_Engineer.zip',
        'titulo': 'CGB-CPU-04 redibujada por Natalie the Nerd (Gerber, 4 capas)',
        'corto': 'CGB-CPU-04 · Gerber',
        'enlazada': True,
        'mascara': 'verde', 'serigrafia': 'blanca', 'acabado': 'enig',
        'aviso': 'Natalie the Nerd escaneó y lijó una CGB-CPU-04 y redibujó su cobre en KiCad: estos Gerber son esa placa, '
                 'la del esquema. Un Gerber no guarda dónde va cada componente, solo sus pads (con su referencia, su patilla '
                 'y su red), así que se ven el cobre, la serigrafía y los taladros, pero no los cuerpos de los componentes. '
                 'Las capas internas (In1, In2) solo llevan las coronas de los taladros. Ella misma avisa de que «puede '
                 'haber alguna inexactitud».',
        'fuente': {'titulo': 'Natalie the Nerd, CGB_ReverseEngineer — Gerbers_CGB_CPU_04_Reverse_Engineer.zip (KiCad 9.0.6)',
                   'autor': 'Natalie Cursio («Natalie the Nerd»)',
                   'url': 'https://github.com/nataliethenerd/CGB_ReverseEngineer',
                   'licencia': 'CC BY-NC-SA 4.0 (uso privado no comercial permitido, con atribución)',
                   'uso': 'Placa en 3D y en 2D sin componentes: contorno, cobre de las caras exterior e interior, '
                          'máscara, serigrafía y taladros; los atributos X2 dan la red y la referencia de cada pad.'},
    },
    {
        'id': 'gbc-opengbc', 'maquina': 'gbc', 'tipo': 'kicad',
        'ruta': 'descargas_usuario_2/consolas_descargas_2/gbc/opengbc/PCB/opengbc-pcb/opengbc-pcb.kicad_pcb',
        'titulo': 'OpenGBC, placa moderna de sustitución (no es la original)',
        'corto': 'OpenGBC · placa moderna',
        'enlazada': False,
        'mascara': 'negra', 'serigrafia': 'blanca', 'acabado': 'enig',
        'aviso': 'OpenGBC no es la placa de Nintendo: es una placa nueva y abierta que cabe en la carcasa de la Game Boy '
                 'Color y usa la CPU CGB original con piezas actuales (RAM, amplificador, pantalla IPS). Sus referencias '
                 'no son las de la CGB-CPU-04, así que no se enlaza con el esquema. El color de la máscara es supuesto.',
        'fuente': {'titulo': 'whatwareweb/opengbc — opengbc-pcb.kicad_pcb (KiCad 9)',
                   'autor': 'whatware',
                   'url': 'https://github.com/whatwareweb/opengbc',
                   'licencia': 'CC BY-SA 4.0 (según el repositorio; el LICENSE.md descargado no se pudo leer)',
                   'uso': 'Placa en 3D y en 2D de la alternativa moderna, para comparar con la original.'},
    },
]


# ------------------------------------------------------------------ console data (schematic side)

def consola(maquina):
    with open(os.path.join(CONSOLAS_JSON, maquina + '.json'), encoding='utf-8') as f:
        return json.load(f)


def mapa_redes(pads_red, d):
    """Board net -> schematic net, by the (reference, pin) of its pads (majority), and how many pads agree."""
    nodo = {}
    for r in d['redes']:
        for nd in r['nodos']:
            nodo[(nd[0], str(nd[1]))] = r['n']
    votos = collections.defaultdict(collections.Counter)
    iguales = distintos = 0
    for (ref, pin), red in pads_red.items():
        n = nodo.get((ref, pin))
        if n is None:
            continue
        votos[red][n] += 1
    mapa = {}
    for red, c in votos.items():
        n, k = c.most_common(1)[0]
        mapa[red] = n
        iguales += k
        distintos += sum(c.values()) - k
    return mapa, iguales, distintos


def patillas_cambiadas(pads_red, d, mapa):
    """Two-pin parts whose pins 1 and 2 agree with the schematic only when swapped."""
    nodo = {}
    for r in d['redes']:
        for nd in r['nodos']:
            nodo[(nd[0], str(nd[1]))] = r['n']
    out = []
    refs = {ref for ref, _ in pads_red}
    for ref in sorted(refs):
        a, b = pads_red.get((ref, '1')), pads_red.get((ref, '2'))
        if not a or not b or (ref, '3') in pads_red:
            continue
        sa, sb = nodo.get((ref, '1')), nodo.get((ref, '2'))
        if sa and sb and mapa.get(a) != sa and mapa.get(a) == sb and mapa.get(b) == sa:
            out.append(ref)
    return out


# ------------------------------------------------------------------ 3D descriptors for the console parts

ALTOS = {
    'QFP': 3.2, 'ZIP-24': 9.0, 'Resonator': 3.5, 'DSUB-9': 12.5, 'DIN8Video': 13.0, 'RFmod': 18.0, 'Expansion': 9.0,
    'SEGA_2x32': 10.0, 'HeadphoneVolumeSlider': 9.0, 'LairdTech': 5.0, 'SW_E-Switch': 6.0, 'SW_Tactile': 5.0,
    'Oscillator_DIP-14': 6.0, 'D_A-405': 6.0, 'LQFP': 1.6, 'TSOP': 1.2, 'VSSOP': 1.0, 'SOT-323': 1.0, 'SOT-223': 1.8,
    'CP_Elec_5x5.3': 5.3, 'gbc_mgb_cart_slot': 8.0, 'audio_jack': 5.0, 'Oscillator_SMD': 1.0, 'R_Array': 0.5,
    'Fuse_0603': 0.5, 'D_SOD-323': 1.0, 'L_CommonModeChoke': 2.0, 'AMPHENOL': 2.0, 'SWITCHCRAFT': 6.0,
}
SIN_CUERPO = ('Fiducial', 'NetTie', 'artwork', 'SolderJumper', 'gbc_buttons', 'gbc_ir_leds', 'GBC-PWRBD',
              'gbc-link-cable-adapter', 'gbc_volume_wheel', 'gbc_PowerSwitch')


def modelo(f):
    m = P.model_for(f)
    name = f['lib'].split(':')[-1]
    if any(name.startswith(s) for s in SIN_CUERPO):
        return dict(m, tipo='taladro')
    if m['tipo'] == 'caja':
        for k, h in ALTOS.items():
            if name.startswith(k) or k in name:
                m['alto'] = h
                break
    return m


# ------------------------------------------------------------------ silkscreen through a KiCad 7 board

def sx(e):
    if isinstance(e, list):
        return '(' + ' '.join(sx(x) for x in e) + ')'
    if isinstance(e, Q):
        return '"' + str(e).replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n') + '"'
    return str(e)


def _num(v):
    return ('%.6f' % v).rstrip('0').rstrip('.')


SILK = ('F.SilkS', 'B.SilkS')


def _oculto(e):
    if K.has_flag(e, 'hide'):
        return True
    h = K.child(e, 'hide')
    if h and (len(h) == 1 or str(h[1]) == 'yes'):
        return True
    ef = K.child(e, 'effects')
    if ef and (K.has_flag(ef, 'hide') or (K.child(ef, 'hide') and str(K.child(ef, 'hide')[-1]) in ('yes', 'hide'))):
        return True
    return False


def _efectos(e):
    ef = K.child(e, 'effects')
    font = K.child(ef, 'font') if ef else None
    size = K.child(font, 'size') if font else None
    th = K.child(font, 'thickness') if font else None
    f7 = ['font', ['size', size[1] if size else '1', size[2] if size else '1'], ['thickness', th[1] if th else '0.15']]
    if font and (K.has_flag(font, 'bold') or (K.child(font, 'bold') and str(K.child(font, 'bold')[1]) == 'yes')):
        f7.append('bold')
    if font and (K.has_flag(font, 'italic') or (K.child(font, 'italic') and str(K.child(font, 'italic')[1]) == 'yes')):
        f7.append('italic')
    out = ['effects', f7]
    j = K.child(ef, 'justify') if ef else None
    if j:
        out.append(['justify'] + [str(x) for x in j[1:] if not isinstance(x, list)])
    return out


def placa_serigrafia(tree):
    """A KiCad 7 board (text) holding only the silkscreen of `tree`, every item in board coordinates."""
    items = []

    def linea(L, a, b, w):
        items.append(['gr_line', ['start', _num(a[0]), _num(a[1])], ['end', _num(b[0]), _num(b[1])],
                      ['stroke', ['width', _num(w)], ['type', 'solid']], ['layer', Q(L)]])

    def poli(L, pts, w, relleno):
        items.append(['gr_poly', ['pts'] + [['xy', _num(x), _num(y)] for x, y in pts],
                      ['stroke', ['width', _num(w)], ['type', 'solid']], ['fill', 'solid' if relleno else 'none'], ['layer', Q(L)]])

    def circulo(L, c, r, w, relleno):
        items.append(['gr_circle', ['center', _num(c[0]), _num(c[1])], ['end', _num(c[0] + r), _num(c[1])],
                      ['stroke', ['width', _num(w)], ['type', 'solid']], ['fill', 'solid' if relleno else 'none'], ['layer', Q(L)]])

    def texto(L, t, x, y, a, e, derecho=False):
        if not t.strip():
            return
        ef = _efectos(e)
        if derecho:
            # footprint texts are drawn «keep upright» by KiCad: an angle in (90°, 270°] reads turned by 180°
            a = a % 360
            if 90 < a <= 270:
                a -= 180
                for x_ in ef[1:]:
                    if x_[0] == 'justify':
                        cambio = {'left': 'right', 'right': 'left', 'top': 'bottom', 'bottom': 'top'}
                        x_[1:] = [cambio.get(v, v) for v in x_[1:]]
        items.append(['gr_text', Q(t), ['at', _num(x), _num(y), _num(a)], ['layer', Q(L)], ef])

    def dibujos(lista, tr):
        for L, kind, data, w, fill in lista:
            if L not in SILK:
                continue
            if kind == 'line':
                pts = [tr(*p) for p in data]
                for a, b in zip(pts, pts[1:]):
                    linea(L, a, b, w)
            elif kind == 'poly':
                pts = [tr(*p) for p in data]
                if fill:
                    poli(L, pts[:-1] if pts and pts[0] == pts[-1] else pts, w, True)
                else:
                    for a, b in zip(pts, pts[1:]):
                        linea(L, a, b, w)
            elif kind == 'circle':
                (cx, cy), r = data
                circulo(L, tr(cx, cy), r, w, fill)

    # board-level items: the same reader as the footprints' graphics, with the identity transform
    nivel = ['footprint'] + [x for x in tree[1:] if isinstance(x, list) and K.head(x) in
                             ('gr_line', 'gr_rect', 'gr_circle', 'gr_arc', 'gr_poly')]
    falsos = [[('fp' + x[0][2:])] + x[1:] for x in nivel[1:]]
    dibujos(P.graphics(['footprint'] + falsos, SILK), lambda x, y: (x, y))
    for e in K.children(tree, 'gr_text'):
        ly = K.child(e, 'layer')
        if ly and str(ly[1]) in SILK:
            x, y, a = K.at_of(e)
            texto(str(ly[1]), str(e[1]), x, y, a, e)
    for fp in K.children(tree, 'footprint'):
        X, Y, A = K.at_of(fp)

        def tr(x, y, X=X, Y=Y, A=A):
            dx, dy = P.rot(x, y, A)
            return (X + dx, Y + dy)
        dibujos(P.graphics(fp, SILK), tr)
        ref = P.fp_text(fp, 'reference')
        val = P.fp_text(fp, 'value')
        for e in K.children(fp, 'fp_text') + K.children(fp, 'property'):
            ly = K.child(e, 'layer')
            if not ly or str(ly[1]) not in SILK or _oculto(e):
                continue
            t = str(e[2])
            t = t.replace('${REFERENCE}', ref).replace('${VALUE}', val)
            x, y, a = K.at_of(e)
            px, py = tr(x, y)
            texto(str(ly[1]), t, px, py, a, e, derecho=True)
    cab = ('(kicad_pcb (version 20221018) (generator pcbnew) (general (thickness 1.6)) (paper "A3") '
           '(layers (0 "F.Cu" signal) (31 "B.Cu" signal) (36 "B.SilkS" user "B.Silkscreen") '
           '(37 "F.SilkS" user "F.Silkscreen") (44 "Edge.Cuts" user)) (setup (pad_to_mask_clearance 0)) (net 0 "")\n')
    return cab + '\n'.join(sx(i) for i in items) + '\n)\n', len(items)


def serigrafia_kicad(pcb_file, tree, nombre):
    texto, n = placa_serigrafia(tree)
    tmp = os.path.join(PK.CACHE, nombre + '-serigrafia.kicad_pcb')
    os.makedirs(PK.CACHE, exist_ok=True)
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(texto)
    silk = {}
    for side, layer in (('F', 'F.SilkS'), ('B', 'B.SilkS')):
        if '"%s"' % layer not in texto.split('\n', 1)[1]:
            continue
        svg = PK.kicad_cli(['pcb', 'export', 'svg', '--layers', layer, '--exclude-drawing-sheet', '--page-size-mode', '0',
                            '--black-and-white'], tmp, 'serigrafia-%s.svg' % side)
        silk[side] = PK.silk_layer(svg)
    return silk, n


def serigrafia_json(silk, ox, oy):
    seri = {}
    for side, (lineas, rellenos, circulos) in silk.items():
        seri[side] = {'lineas': [[w * 100 // 1 / 100] + [v for pl_ in pls for v in [len(pl_)] + PK.delta(pl_, ox, oy)]
                                 for w, pls in sorted(lineas.items())],
                      'rellenos': [PK.delta(p, ox, oy) for p in rellenos],
                      'circulos': [[q(cx) - ox, q(cy) - oy, q(r), q(w)] for cx, cy, r, w in circulos]}
    return seri


# ------------------------------------------------------------------ boards from KiCad

def fusionar_colineales(arr):
    """Join track segments [net, width, x1, y1, x2, y2]… that continue each other in a straight line (same net and
    width, a joint shared by exactly those two segments, zero cross product in 0.01 mm units): the drawing is the
    same, with fewer segments (the Neo Geo's traced copper is cut into many collinear pieces)."""
    segs = [arr[i:i + 6] for i in range(0, len(arr), 6)]
    vivos = [True] * len(segs)
    while True:
        ends = collections.defaultdict(list)
        for i, sg in enumerate(segs):
            if vivos[i]:
                ends[(sg[0], sg[1], sg[2], sg[3])].append(i)
                ends[(sg[0], sg[1], sg[4], sg[5])].append(i)
        hecho = set()
        cambios = 0
        for k, v in ends.items():
            if len(v) != 2 or v[0] == v[1] or v[0] in hecho or v[1] in hecho:
                continue
            a, b = segs[v[0]], segs[v[1]]
            p = (k[2], k[3])
            qa = (a[4], a[5]) if (a[2], a[3]) == p else (a[2], a[3])
            qb = (b[4], b[5]) if (b[2], b[3]) == p else (b[2], b[3])
            u, w = (qa[0] - p[0], qa[1] - p[1]), (qb[0] - p[0], qb[1] - p[1])
            if u[0] * w[1] - u[1] * w[0] != 0 or u[0] * w[0] + u[1] * w[1] > 0:
                continue
            segs[v[0]] = [a[0], a[1], qa[0], qa[1], qb[0], qb[1]]
            vivos[v[1]] = False
            hecho.update(v)
            cambios += 1
        if not cambios:
            break
    return [x for i, sg in enumerate(segs) if vivos[i] for x in sg]


def soldar_bordes(edges, tol):
    """Joins the ends of Edge.Cuts pieces that miss each other by less than `tol` mm (OpenTendo's outline has
    arcs whose ends are 1–4 µm away from the lines they meet, more than proyectos_kicad_pcb.outline accepts)."""
    puntos = []

    def unir(p):
        for q in puntos:
            if abs(p[0] - q[0]) < tol and abs(p[1] - q[1]) < tol:
                return q
        puntos.append(p)
        return p

    out = []
    for e in edges:
        e = list(e)
        e[0] = unir(e[0])
        e[-1] = unir(e[-1])
        out.append(e)
    return out


def placa_kicad(cfg, d, problemas):
    pcb_file = fuente_de(cfg)
    tree = K.parse_sexpr(open(pcb_file, encoding='utf-8').read())
    b = P.read_board(pcb_file)
    red_de = b['nets']
    if cfg.get('soldar_bordes'):
        b['edges'] = soldar_bordes(b['edges'], cfg['soldar_bordes'])
    loops = P.outline(b['edges'])
    if not loops:
        raise SystemExit('%s: sin contorno en Edge.Cuts' % cfg['id'])
    loops.sort(key=lambda lp: -(max(p[0] for p in lp) - min(p[0] for p in lp)) * (max(p[1] for p in lp) - min(p[1] for p in lp)))
    xs = [p[0] for p in loops[0]]
    ys = [p[1] for p in loops[0]]
    X0, Y0 = min(xs), min(ys)
    ancho, alto = max(xs) - X0, max(ys) - Y0
    ox, oy = q(X0), q(Y0)
    silk, n_silk = serigrafia_kicad(pcb_file, tree, cfg['id'])

    redes = sorted({n for n in red_de.values() if n}, key=lambda s: (s.startswith('unconnected-'), s))
    idx = {n: i for i, n in enumerate(redes)}

    def rid(netcode):
        n = red_de.get(netcode, '')
        return idx.get(n, -1) if n else -1

    comp = d['componentes']
    funcion = {}
    for h in d['hotspots']:
        for r in h.get('esquema', []):
            funcion.setdefault(r, h.get('nombre', ''))
    huellas, pads, pads_red = [], [], {}
    for f in b['footprints']:
        m = modelo(f)
        f['_modelo'] = m
        inicio = len(pads)
        for p in f['pads']:
            flags = 0
            for bit, layer in ((1, 'F.Cu'), (2, 'B.Cu'), (16, 'F.Mask'), (32, 'B.Mask'), (64, 'F.Paste')):
                if P.pad_on_layer(p, layer):
                    flags |= bit
            if p['type'] == 'thru_hole':
                flags |= 4
            if p['type'] == 'np_thru_hole':
                flags |= 8
            dr = p['drill'] or (0, 0)
            r = rid(p['net'])
            if r >= 0 and p['num']:
                pads_red[(f['ref'], p['num'])] = redes[r]
            pads.append([len(huellas), p['num'], P.PAD_SHAPES.get(p['shape'], 'r'), q(p['x']) - ox, q(p['y']) - oy,
                         q(p['w']), q(p['h']), round(p['rot'], 2), round(p['rr'], 3), q(dr[0]), q(dr[1]), flags, r, ''])
        fab = []
        for L, kind, data, w, fill in f['graphics']:
            if not L.endswith('.Fab'):
                continue
            if kind == 'circle':
                (cx, cy), rr = data
                fab.append(['c', q(cx), q(cy), q(rr)])
            else:
                fab.append(['l' if not fill else 'p'] + [v for pt in data for v in (q(pt[0]), q(pt[1]))])
        enlazada = cfg['enlazada'] and f['ref'] in comp
        mec = m['tipo'] == 'taladro'
        fn = (funcion.get(f['ref']) if enlazada else '') or PK.deducida(f, red_de)
        if fn.startswith('%s (%s):' % (f['value'], f['ref'])):
            fn = ''  # only a list of nets: the panel lists the pads anyway
        h = {'r': f['ref'], 'v': f['value'], 'l': f['lib'].split(':')[-1], 'lib': f['lib'].split(':')[0],
             'x': q(f['x']) - ox, 'y': q(f['y']) - oy, 'a': round(f['rot'], 2), 'lado': f['side'],
             't': 'mec' if mec else ('smd' if 'smd' in f['attrs'] else 'tht'),
             'pads': [inicio, len(pads) - inicio], 'm': m, 'fab': fab,
             'f': fn, 'fo': 'deducida'}
        if 'dnp' in f['attrs']:
            h['dnp'] = True
        huellas.append(h)

    pistas = {}
    for t in b['tracks']:
        side = t['layer'].split('.')[0]
        if side not in ('F', 'B'):
            continue
        pistas.setdefault(side, []).extend([rid(t['net']), q(t['w']), q(t['a'][0]) - ox, q(t['a'][1]) - oy,
                                            q(t['b'][0]) - ox, q(t['b'][1]) - oy])
    for side in pistas:
        pistas[side] = fusionar_colineales(pistas[side])
    vias = []
    for v in b['vias']:
        vias += [rid(v['net']), q(v['p'][0]) - ox, q(v['p'][1]) - oy, q(v['d']), q(v['drill'])]
    zonas = []
    for z in b['zones']:
        lado = z['layer'].split('.')[0]
        if lado not in ('F', 'B'):
            continue
        zonas.append({'l': lado, 'r': rid(z['net']), 'p': PK.delta([(q(x), q(y)) for x, y in PK.simplify(z['pts'])], ox, oy)})
    areas = []
    for a in b['areas']:
        cobre = [l.split('.')[0] for l in a['layers'] if l.endswith('.Cu') and l.split('.')[0] in ('F', 'B')]
        if a['layers'] and a['layers'][0].startswith(('F&B', '*')):
            cobre = ['F', 'B']
        areas.append({'capas': cobre, 'nombre': a['name'], 'reglas': a['rules'],
                      'p': PK.delta([(q(x), q(y)) for x, y in a['pts']], ox, oy)})
    contorno = PK.delta([(q(x), q(y)) for x, y in loops[0]], ox, oy)

    comprobaciones = []
    mapa, iguales, distintos = mapa_redes(pads_red, d) if cfg['enlazada'] else ({}, 0, 0)
    refs = sorted({f['ref'] for f in b['footprints']} & set(comp)) if cfg['enlazada'] else []
    if cfg['enlazada']:
        sin = sorted({f['ref'] for f in b['footprints']} - set(comp))
        faltan = sorted(set(comp) - {f['ref'] for f in b['footprints']})
        comprobaciones.append({'tipo': 'ok' if not sin and not faltan else 'aviso',
                               'texto': '%d componentes de la placa están en el esquema' % len(refs) +
                               ('; solo en la placa: %s' % ', '.join(sin[:20]) if sin else '') +
                               ('; solo en el esquema: %s' % ', '.join(faltan[:20]) if faltan else '')})
        comprobaciones.append({'tipo': 'ok' if not distintos else 'aviso',
                               'texto': '%d pads en la misma red que en el esquema%s' % (iguales, (', %d en otra' % distintos) if distintos else '')})
        if distintos:
            problemas.append(('aviso', '%s: %d pads en otra red que en el esquema' % (cfg['id'], distintos)))
    extra = len(b['copper']) - 2
    return {
        'X0': X0, 'Y0': Y0, 'ancho': ancho, 'alto': alto, 'ox': ox, 'oy': oy,
        'capas': [c.split('.')[0] for c in b['copper']], 'grosor': b['thickness'],
        'redes': redes, 'huellas': huellas, 'pads': pads, 'pistas': pistas, 'vias': vias, 'zonas': zonas, 'areas': areas,
        'serigrafia': serigrafia_json(silk, ox, oy), 'contorno': contorno, 'mapa': mapa, 'refs': refs,
        'comprobaciones': comprobaciones, 'internas': extra, 'stats': {'serigrafia': n_silk, 'pistas': len(b['tracks'])},
    }


# ------------------------------------------------------------------ boards from Gerber files

def _capas_gerber(zpath):
    out = {}
    with zipfile.ZipFile(zpath) as z:
        for n in z.namelist():
            t = z.read(n).decode('utf-8', 'replace')
            out[n] = t
    return out


def placa_gerber(cfg, d, problemas):
    ficheros = _capas_gerber(fuente_de(cfg))

    def capa(sufijo):
        for n, t in ficheros.items():
            if n.endswith(sufijo):
                return G.leer_gerber(t)
        return None

    def taladros(sufijo):
        for n, t in ficheros.items():
            if n.endswith(sufijo):
                return G.leer_excellon(t)
        return []

    cobre = {'F': capa('F_Cu.gtl'), 'B': capa('B_Cu.gbl')}
    internas = [x for x in (capa('In1_Cu.g1'), capa('In2_Cu.g2')) if x]
    mascara = {'F': capa('F_Mask.gts'), 'B': capa('B_Mask.gbs')}
    seri = {'F': capa('F_Silkscreen.gto'), 'B': capa('B_Silkscreen.gbo')}
    borde = capa('Edge_Cuts.gm1')
    pth = taladros('-PTH.drl')
    npth = taladros('-NPTH.drl')

    edges = [t['pts'] for t in borde['trazos']]
    loops = P.outline(edges)
    if not loops:
        raise SystemExit('%s: sin contorno en Edge_Cuts' % cfg['id'])
    loops.sort(key=lambda lp: -(max(p[0] for p in lp) - min(p[0] for p in lp)) * (max(p[1] for p in lp) - min(p[1] for p in lp)))
    xs = [p[0] for p in loops[0]]
    ys = [p[1] for p in loops[0]]
    X0, Y0 = min(xs), min(ys)
    ancho, alto = max(xs) - X0, max(ys) - Y0
    ox, oy = q(X0), q(Y0)

    nombres = set()
    for c in cobre.values():
        for o in c['trazos'] + c['destellos'] + c['regiones']:
            n = (o['atrib'].get('.N') or [''])[0]
            if n:
                nombres.add(n)
    redes = sorted(nombres, key=lambda s: (s.startswith('unconnected-'), s))
    idx = {n: i for i, n in enumerate(redes)}

    def rid(o):
        n = (o['atrib'].get('.N') or [''])[0]
        return idx.get(n, -1) if n else -1

    # pads: flashes with a pin attribute, merged across faces by (reference, pin, position)
    por_clave = {}
    zonas = []
    vias = []
    for lado, c in cobre.items():
        for o in c['destellos']:
            pin = o['atrib'].get('.P')
            funcion = o['ap'].funcion
            if 'ViaPad' in funcion:
                v = [rid(o), q(o['x']) - ox, q(o['y']) - oy, q(o['ap'].params[0] if o['ap'].forma == 'C' else 0.6), 0]
                if not any(abs(w[1] - v[1]) <= 2 and abs(w[2] - v[2]) <= 2 for w in vias):
                    vias.append(v)
                continue
            forma, w, h, rot, rr = G.forma_pad(o['ap'])
            if pin and pin[0]:
                k = (pin[0], pin[1] if len(pin) > 1 else '', round(o['x'], 2), round(o['y'], 2))
                pd = por_clave.get(k)
                if not pd:
                    pd = por_clave[k] = {'ref': pin[0], 'num': pin[1] if len(pin) > 1 else '', 'fn': pin[2] if len(pin) > 2 else '',
                                         'x': o['x'], 'y': o['y'], 'forma': forma, 'w': w, 'h': h, 'rot': rot, 'rr': rr,
                                         'lados': set(), 'red': rid(o), 'drill': 0.0, 'tht': 'ComponentPad' in funcion}
                pd['lados'].add(lado)
                if forma == 'x':
                    # custom shape: the exact copper as a zone, the pad only marks the mask opening
                    pd['forma'] = 'r'
                    pd['solo_mascara'] = True
                    for poly, pos in G.poligonos_apertura(o['ap']):
                        if pos:
                            pts = [(o['x'] + px, o['y'] - py) for px, py in poly]
                            zonas.append({'l': lado, 'r': rid(o), 'p': PK.delta([(q(x), q(y)) for x, y in pts + pts[:1]], ox, oy)})
            else:
                for poly, pos in G.poligonos_apertura(o['ap']):
                    if pos:
                        pts = [(o['x'] + px, o['y'] - py) for px, py in poly]
                        zonas.append({'l': lado, 'r': rid(o), 'p': PK.delta([(q(x), q(y)) for x, y in pts + pts[:1]], ox, oy)})
        for o in c['regiones']:
            pts = PK.simplify(o['pts'])
            zonas.append({'l': lado, 'r': rid(o), 'p': PK.delta([(q(x), q(y)) for x, y in pts], ox, oy)})
    # drills: on a pad (plated), on a via, or a free plated hole
    sin_sitio = 0
    for t in pth:
        mejor = None
        for pd in por_clave.values():
            if abs(pd['x'] - t['x']) < 0.05 and abs(pd['y'] - t['y']) < 0.05:
                mejor = pd
                break
        if mejor:
            mejor['drill'] = t['d']
            mejor['tht'] = True
            if t['ranura']:
                (x0, y0), (x1, y1) = t['ranura']
                mejor['ranura'] = (math.hypot(x1 - x0, y1 - y0) + t['d'], t['d'], math.degrees(math.atan2(-(y1 - y0), x1 - x0)))
            continue
        for i in range(0, len(vias)):
            v = vias[i]
            if abs(v[1] - (q(t['x']) - ox)) <= 5 and abs(v[2] - (q(t['y']) - oy)) <= 5:
                v[4] = q(t['d'])
                break
        else:
            vias.append([-1, q(t['x']) - ox, q(t['y']) - oy, q(t['d'] + 0.3), q(t['d'])])
            sin_sitio += 1
    for v in vias:
        if not v[4]:
            v[4] = max(1, v[3] // 2)
    # mask openings: a mask flash on the pad's position
    abiertos = {'F': [], 'B': []}
    for lado, c in mascara.items():
        if c:
            abiertos[lado] = [(o['x'], o['y']) for o in c['destellos']]

    def abierto(lado, x, y):
        return any(abs(ax - x) < 0.05 and abs(ay - y) < 0.05 for ax, ay in abiertos[lado])

    comp = d['componentes']
    funcion_hot = {}
    for h in d['hotspots']:
        for r in h.get('esquema', []):
            funcion_hot.setdefault(r, h.get('nombre', ''))
    por_ref = collections.defaultdict(list)
    for pd in por_clave.values():
        por_ref[pd['ref']].append(pd)
    def nat(s):
        return [(0, int(t), '') if t.isdigit() else (1, 0, t) for t in re.split(r'(\d+)', s)]
    huellas, pads, pads_red = [], [], {}
    for ref in sorted(por_ref, key=nat):
        lista = sorted(por_ref[ref], key=lambda p: nat(p['num']))
        xs = [p['x'] for p in lista]
        ys = [p['y'] for p in lista]
        cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        x0 = min(p['x'] - max(p['w'], p['h']) / 2 for p in lista) - cx - 0.3
        x1 = max(p['x'] + max(p['w'], p['h']) / 2 for p in lista) - cx + 0.3
        y0 = min(p['y'] - max(p['w'], p['h']) / 2 for p in lista) - cy - 0.3
        y1 = max(p['y'] + max(p['w'], p['h']) / 2 for p in lista) - cy + 0.3
        smd_b = all(not p['tht'] and p['lados'] == {'B'} for p in lista)
        inicio = len(pads)
        for p in lista:
            flags = 0
            if not p.get('solo_mascara'):
                if 'F' in p['lados'] or p['tht']:
                    flags |= 1
                if 'B' in p['lados'] or p['tht']:
                    flags |= 2
            if p['tht']:
                flags |= 4
            if abierto('F', p['x'], p['y']) or (p['tht'] and abiertos['F'] == []):
                flags |= 16
            if abierto('B', p['x'], p['y']) or (p['tht'] and abiertos['B'] == []):
                flags |= 32
            dw = dh = q(p['drill'])
            if p.get('ranura'):
                dw, dh = q(p['ranura'][0]), q(p['ranura'][1])
            pads.append([len(huellas), p['num'], p['forma'], q(p['x']) - ox, q(p['y']) - oy, q(p['w']), q(p['h']),
                         round(p['rot'], 2), round(p['rr'], 3), dw, dh, flags, p['red'], p['fn']])
            if p['red'] >= 0 and p['num']:
                pads_red[(ref, p['num'])] = redes[p['red']]
        c = comp.get(ref, {})
        huellas.append({'r': ref, 'v': c.get('v', ''), 'l': 'pads del Gerber', 'lib': '', 'x': q(cx) - ox, 'y': q(cy) - oy, 'a': 0,
                        'lado': 'B' if smd_b else 'F', 't': 'mec', 'pads': [inicio, len(pads) - inicio],
                        'm': {'tipo': 'taladro', 'caja': [round(x0, 3), round(y0, 3), round(x1, 3), round(y1, 3)]},
                        'fab': [], 'f': funcion_hot.get(ref, ''), 'fo': 'deducida'})
    # unplated holes: one mechanical «footprint» each
    for k, t in enumerate(npth, 1):
        w, h, rot = (t['d'], t['d'], 0.0)
        if t['ranura']:
            (x0, y0), (x1, y1) = t['ranura']
            w, h, rot = math.hypot(x1 - x0, y1 - y0) + t['d'], t['d'], math.degrees(math.atan2(-(y1 - y0), x1 - x0))
        huellas.append({'r': 'H%d' % k, 'v': 'taladro sin metalizar', 'l': 'NPTH', 'lib': '', 'x': q(t['x']) - ox, 'y': q(t['y']) - oy,
                        'a': 0, 'lado': 'F', 't': 'mec', 'pads': [len(pads), 1],
                        'm': {'tipo': 'taladro', 'caja': [-w / 2, -h / 2, w / 2, h / 2]}, 'fab': [], 'f': 'Taladro sin metalizar', 'fo': 'deducida'})
        pads.append([len(huellas) - 1, '', 'o' if t['ranura'] else 'c', q(t['x']) - ox, q(t['y']) - oy, q(w), q(h), round(rot, 2), 0,
                     q(w), q(h), 8 | 16 | 32, -1, ''])

    pistas = {}
    for lado, c in cobre.items():
        for o in c['trazos']:
            r = rid(o)
            w = q(o['w'])
            pts = o['pts']
            for a, b in zip(pts, pts[1:]):
                pistas.setdefault(lado, []).extend([r, w, q(a[0]) - ox, q(a[1]) - oy, q(b[0]) - ox, q(b[1]) - oy])

    # silkscreen: strokes by width, flashes and regions filled
    serigrafia = {}
    for lado, c in seri.items():
        if not c:
            continue
        lineas = collections.defaultdict(list)
        for o in c['trazos']:
            lineas[round(o['w'], 3)].append([(q(x), q(y)) for x, y in o['pts']])
        rellenos = []
        circulos = []
        for o in c['destellos']:
            if o['ap'].forma == 'C':
                circulos.append((o['x'], o['y'], o['ap'].params[0] / 2, 0))
                continue
            for poly, pos in G.poligonos_apertura(o['ap']):
                if pos:
                    rellenos.append([(q(o['x'] + px), q(o['y'] - py)) for px, py in poly])
        for o in c['regiones']:
            rellenos.append([(q(x), q(y)) for x, y in o['pts']])
        lineas = {w: PK.S._chain(pls) for w, pls in lineas.items()}
        serigrafia[lado] = (lineas, rellenos, circulos)

    contorno = PK.delta([(q(x), q(y)) for x, y in loops[0]], ox, oy)
    mapa, iguales, distintos = mapa_redes(pads_red, d)
    cambiadas = patillas_cambiadas(pads_red, d, mapa)
    refs = sorted(set(por_ref) & set(comp))
    sin = sorted(set(por_ref) - set(comp))
    faltan = sorted(set(comp) - set(por_ref))
    comprobaciones = [
        {'tipo': 'ok' if not sin else 'aviso',
         'texto': '%d referencias de los pads están en el esquema' % len(refs) + ('; solo en la placa: %s' % ', '.join(sin) if sin else '')},
        {'tipo': 'ok' if not faltan else 'aviso',
         'texto': ('Sin pads en la placa: %s (componentes del esquema que este Gerber no tiene)' % ', '.join(faltan)) if faltan
         else 'Todos los componentes del esquema tienen pads en la placa'},
        {'tipo': 'ok' if not distintos else 'aviso',
         'texto': '%d pads en la misma red que en el esquema%s' % (iguales, (', %d en otra' % distintos) if distintos else '')},
    ]
    if cambiadas:
        comprobaciones.append({'tipo': 'aviso', 'texto': 'En %d componentes de dos patillas (%s) la patilla 1 y la 2 están cambiadas entre '
                               'el esquema reconstruido del PDF y el Gerber: la conexión es la misma, solo cambia la numeración'
                               % (len(cambiadas), ', '.join(cambiadas))})
    if sin_sitio:
        comprobaciones.append({'tipo': 'aviso', 'texto': '%d taladros metalizados sin pad ni vía en las capas exteriores' % sin_sitio})
    n_int = sum(len(c['destellos']) for c in internas)
    return {
        'X0': X0, 'Y0': Y0, 'ancho': ancho, 'alto': alto, 'ox': ox, 'oy': oy,
        'capas': ['F', 'In1', 'In2', 'B'] if internas else ['F', 'B'], 'grosor': 1.0,
        'redes': redes, 'huellas': huellas, 'pads': pads, 'pistas': pistas, 'vias': [x for v in vias for x in v], 'zonas': zonas, 'areas': [],
        'serigrafia': serigrafia_json(serigrafia, ox, oy), 'contorno': contorno, 'mapa': mapa, 'refs': refs,
        'comprobaciones': comprobaciones, 'internas': len(internas),
        'stats': {'destellos_internos': n_int, 'pistas': sum(len(c['trazos']) for c in cobre.values())},
    }


# ------------------------------------------------------------------ output

def escribir(cfg, r):
    pid = cfg['id']
    pads_por_red = collections.Counter(p[12] for p in r['pads'] if p[12] >= 0)
    placa = {
        'version': 1, 'id': pid, 'proyecto': 'consola-' + cfg['maquina'], 'titulo': cfg['titulo'], 'proyecto_titulo': cfg['corto'],
        'parte': '', 'figura': None, 'archivo': cfg['ruta'].split('/')[-1],
        'placa': {'ancho': q(r['ancho']), 'alto': q(r['alto']), 'origen': [round(r['X0'], 3), round(r['Y0'], 3)],
                  'grosor': r['grosor'], 'capas': ['F', 'B'], 'cobre_um': 35, 'mascara': cfg['mascara'],
                  'mascara_fuente': 'supuesto (los ficheros no lo indican)', 'serigrafia': cfg['serigrafia'],
                  'acabado': cfg['acabado'], 'fabricacion': '', 'contorno': r['contorno'],
                  'apilado': '%d capas de cobre' % len(r['capas'])},
        'redes': [{'n': n, 'p': pads_por_red.get(i, 0)} for i, n in enumerate(r['redes'])],
        'huellas': r['huellas'], 'pads': r['pads'], 'pistas': r['pistas'], 'vias': r['vias'], 'zonas': r['zonas'],
        'areas': r['areas'], 'serigrafia': r['serigrafia'],
        'esquema': {'hoja': '', 'ancho': 0, 'alto': 0, 'notas': [], 'bloques': []},
        'simulacion': None,
        'comprobaciones': r['comprobaciones'],
        'consola': {'maquina': cfg['maquina'], 'enlazada': cfg['enlazada'], 'aviso': cfg['aviso'], 'fuente': cfg['fuente'],
                    'redes': r['mapa'], 'refs': r['refs'], 'capas_cobre': r['capas'], 'tipo': cfg['tipo']},
    }
    os.makedirs(OUT, exist_ok=True)
    texto = json.dumps(placa, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, pid + '.json'), 'w', encoding='utf-8') as f:
        f.write(texto)
    componentes = len([h for h in r['huellas'] if not h['r'].startswith('H') or h['l'] != 'NPTH'])
    return {'id': pid, 'maquina': cfg['maquina'], 'titulo': cfg['titulo'], 'corto': cfg['corto'], 'enlazada': cfg['enlazada'],
            'aviso': cfg['aviso'], 'fuente': cfg['fuente'],
            'tipo': cfg['tipo'], 'ancho': round(r['ancho'], 2), 'alto': round(r['alto'], 2), 'capas': len(r['capas']),
            'componentes': componentes, 'redes': len([1 for i in range(len(r['redes'])) if pads_por_red.get(i, 0) >= 2]),
            'bytes': len(texto.encode('utf-8'))}


def fuente_de(cfg):
    """Path of a board's source: CONSOLAS_PCB_<ID> if set, else cfg['ruta'] under CONSOLAS_FUENTES."""
    return os.environ.get('CONSOLAS_PCB_' + re.sub(r'[^A-Z0-9]', '_', cfg['id'].upper())) or os.path.join(FUENTES, cfg['ruta'])


def main(ids=()):
    problemas = []
    indice = []
    try:
        with open(os.path.join(OUT, 'indice.json'), encoding='utf-8') as f:
            previas = {e['id']: e for e in json.load(f)['placas']}
    except (OSError, ValueError, KeyError):
        previas = {}
    for cfg in PLACAS:
        ruta = fuente_de(cfg)
        if (ids and cfg['id'] not in ids) or not os.path.exists(ruta):
            if not (ids and cfg['id'] not in ids):
                print('consolas_pcb: falta %s; se omite %s' % (ruta, cfg['id']))
            if cfg['id'] in previas and os.path.exists(os.path.join(OUT, cfg['id'] + '.json')):
                indice.append(previas[cfg['id']])
                print('consolas_pcb: %-12s se conservan los ficheros ya generados' % cfg['id'])
            continue
        d = consola(cfg['maquina'])
        r = (placa_kicad if cfg['tipo'] == 'kicad' else placa_gerber)(cfg, d, problemas)
        e = escribir(cfg, r)
        indice.append(e)
        print('consolas_pcb: %-12s %6.1f × %5.1f mm, %d capas, %d componentes, %d pads, %d redes, %d vías, %d zonas, %.0f kB · %s'
              % (cfg['id'], r['ancho'], r['alto'], len(r['capas']), e['componentes'], len(r['pads']), e['redes'], len(r['vias']) // 5,
                 len(r['zonas']), e['bytes'] / 1024, '; '.join(c['texto'] for c in r['comprobaciones'])))
    with open(os.path.join(OUT, 'indice.json'), 'w', encoding='utf-8') as f:
        json.dump({'version': 1, 'placas': indice}, f, ensure_ascii=False, separators=(',', ':'))
    for t, m in problemas:
        print('consolas_pcb: %s: %s' % (t, m))
    return 1 if any(t == 'error' for t, _ in problemas) else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
