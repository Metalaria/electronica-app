"""Master System II mainboard 171-5922A in 3D and 2D, RECONSTRUCTED from photographs (0.11).

There is no published PCB of the 171-5922A (slowcoder's .kicad_pcb is an empty KiCad 4 board). What exists, with a
free licence, are ConsoleMods' 600 dpi flatbed scans of the bare board, both faces (171-5922ATop.jpg and
171-5922ABottom.jpg, CC BY), whose silkscreen carries the references of Sega's service manual. This module turns
them into a board of the «Proyectos KiCad» format (consolas_pcb.escribir):

  - every component hole was located by eye on the top scan (the table PIEZAS below, photo pixels of the
    4572 × 3676 original) and snapped to the centre of its solder ring (a ring-minus-centre matched filter);
  - the scale comes from the parts themselves: the pins of every DIP, of the cartridge slot, of the resistor
    network and of the D-sub ports sit on a 2.54 mm grid, so one affine map photo px -> board mm is fitted by least
    squares to all of them at once (each part with its own unknown position, its axes at a multiple of 90°);
  - the outline, the mounting holes and the slots are measured on the same scan (the board against the scanner's
    white lid) and carried through that map;
  - the faces are the scans themselves, rectified into the board's frame (the bottom one registered on the top
    one through the holes they share), written as JPEG textures next to the board JSON;
  - the pads get the nets of the console's schematic (sms.json, the manual's netlist) by reference and pin; the
    copper is NOT vectorised: traces exist only in the photo texture. For two-lead parts the scan does not say
    which hole is pin 1: polarised parts follow the silkscreen («+», the diode bar), the others keep the order
    of the table, and their note says so. (Tracing the copper of the scans automatically was tried: the traces
    under the green mask break up at the silkscreen and at the dark clearance around the pads, and it decided
    only 14 of 100 parts with no way of checking them, so it is not used.)

Run through consolas_pcb.py (board id «sms»):  python3 contenido/consolas_pcb.py sms
Sources: CONSOLAS_FUENTES/sms/fotos/171-5922ATop.jpg and 171-5922ABottom.jpg (never copied whole: only the
rectified faces, at the size the 3D view uses).
"""

import math
import os

import numpy as np

try:
    import cv2
except ImportError:  # pragma: no cover - the board is then kept as generated
    cv2 = None

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache/consolas_sms')
PASO = 2.54

# ------------------------------------------------------------------ the parts, measured on the top scan (px)
#
# DIP: (ref, pins, pin 1, last pin of pin 1's row, pin across from pin 1)  — the rows are interpolated between them.
# DOS: (ref, kind, pad 1, pad 2) — kind: r resistor, c ceramic, ce electrolytic (pad 1 is «+»), fb ferrite bead,
#      l inductor, d diode (pad 1 is the cathode, the silkscreen bar). Values come from the schematic.
# Everything else is written out below.

DIPS = [
    ('IC1', 40, (2957, 350), (2957, 1497), (3314, 350)),
    ('IC2', 28, (3436, 471), (3436, 1250), (3796, 471)),
    # IC3 has a double footprint: 600 mil (columns 3851 / 4219) and 300 mil (4039 / 4219); the 4168 is the wide one
    ('IC3', 28, (3851, 503), (3851, 1283), (4219, 503)),
    ('IC4', 48, (4226, 2213), (2843, 2213), (4226, 2572)),
    ('IC6', 28, (1525, 2162), (741, 2162), (1525, 2525)),
    ('IC7', 28, (1586, 2822), (806, 2822), (1589, 3185)),
    ('IC9', 24, (1816, 1203), (2476, 1203), (1816, 963)),
]

DOS = [
    # resistors
    ('R1', 'r', (4072, 1456), (4183, 1456)), ('R2', 'r', (3406, 1461), (3526, 1461)),
    ('R3', 'r', (3509, 3283), (3628, 3283)), ('R4', 'r', (2729, 2754), (2729, 2871)),
    ('R5', 'r', (1892, 3183), (1892, 3303)), ('R6', 'r', (2543, 3179), (2543, 3300)),
    ('R7', 'r', (2729, 3179), (2729, 3300)), ('R8', 'r', (3300, 3290), (3418, 3290)),
    ('R9', 'r', (922, 1781), (922, 1894)), ('R10', 'r', (2350, 1296), (2350, 1414)),
    ('R11', 'r', (2450, 1296), (2450, 1414)), ('R12', 'r', (1583, 1564), (1583, 1679)),
    ('R13', 'r', (1729, 1296), (1729, 1414)), ('R14', 'r', (1397, 1564), (1397, 1679)),
    ('R15', 'r', (1550, 1296), (1550, 1414)), ('R16', 'r', (1490, 1564), (1490, 1679)),
    ('R17', 'r', (1636, 1296), (1636, 1414)), ('R18', 'r', (2237, 480), (2356, 480)),
    ('R19', 'r', (1307, 1564), (1307, 1679)), ('R20', 'r', (1214, 1564), (1214, 1679)),
    ('R21', 'r', (1727, 1056), (1727, 1171)), ('R22', 'r', (2237, 684), (2356, 689)),
    ('R24', 'r', (2473, 689), (2593, 689)), ('R25', 'r', (2237, 867), (2356, 871)),
    ('R26', 'r', (2473, 871), (2593, 871)), ('R27', 'r', (1068, 1298), (1068, 1412)),
    ('R28', 'r', (1340, 1298), (1340, 1412)), ('R29', 'r', (1430, 1298), (1430, 1412)),
    ('R30', 'r', (2237, 600), (2356, 600)),
    # ceramic capacitors (C7 and C54 are printed on the board but not drawn in the manual's schematic)
    ('C1', 'c', (2781, 1137), (2781, 1258)), ('C2', 'c', (3617, 1344), (3617, 1461)),
    ('C3', 'c', (3733, 1344), (3733, 1461)), ('C4', 'c', (2753, 1464), (2872, 1464)),
    ('C5', 'c', (2744, 1378), (2869, 1378)), ('C6', 'c', (2869, 1137), (2869, 1258)),
    ('C7', 'c', (3828, 1376), (3944, 1369)), ('C8', 'c', (4072, 1369), (4183, 1369)),
    ('C9', 'c', (3535, 2873), (3535, 2988)), ('C10', 'c', (3446, 2873), (3446, 2988)),
    ('C11', 'c', (3383, 2662), (3383, 2778)), ('C12', 'c', (3356, 2873), (3356, 2988)),
    ('C13', 'c', (3298, 2662), (3298, 2778)), ('C14', 'c', (3860, 2030), (3980, 2030)),
    ('C15', 'c', (3748, 2688), (3748, 2806)), ('C16', 'c', (3651, 2662), (3651, 2778)),
    ('C17', 'c', (3628, 3073), (3628, 3194)), ('C19', 'c', (2000, 2004), (2121, 2004)),
    ('C20', 'c', (1668, 2011), (1668, 2126)), ('C21', 'c', (985, 2615), (985, 2731)),
    ('C22', 'c', (806, 2615), (797, 2735)), ('C23', 'c', (1580, 1953), (1580, 2069)),
    ('C24', 'c', (2264, 2004), (2386, 2004)), ('C25', 'c', (2567, 1198), (2687, 1198)),
    ('C26', 'c', (2107, 1296), (2107, 1414)), ('C27', 'c', (1814, 1296), (1814, 1414)),
    ('C28', 'c', (1907, 1296), (1907, 1414)), ('C29', 'c', (2000, 1296), (2000, 1414)),
    ('C30', 'c', (1129, 1564), (1129, 1679)), ('C33', 'c', (2027, 600), (2143, 600)),
    ('C34', 'c', (2237, 777), (2356, 777)), ('C35', 'c', (2027, 871), (2143, 871)),
    ('C36', 'c', (2473, 777), (2593, 777)), ('C37', 'c', (2027, 689), (2143, 689)),
    ('C39', 'c', (2567, 958), (2687, 958)), ('C40', 'c', (1243, 1298), (1243, 1412)),
    ('C45', 'c', (3828, 1461), (3944, 1461)), ('C46', 'c', (3470, 2662), (3470, 2778)),
    ('C47', 'c', (1341, 2615), (1341, 2731)), ('C48', 'c', (894, 2615), (896, 2735)),
    ('C49', 'c', (1254, 2615), (1254, 2731)), ('C50', 'c', (1160, 2615), (1162, 2731)),
    ('C51', 'c', (3406, 1376), (3526, 1376)), ('C52', 'c', (3628, 2873), (3628, 2988)),
    ('C53', 'c', (4112, 2716), (4112, 2834)), ('C54', 'c', (2567, 1044), (2687, 1048)),
    # electrolytics: pad 1 is the «+» of the silkscreen
    ('C18', 'ce', (2843, 2814), (2971, 2814)), ('C31', 'ce', (2221, 1296), (2221, 1414)),
    ('C32', 'ce', (2474, 568), (2597, 568)), ('C38', 'ce', (1546, 1176), (1429, 1176)),
    ('C41', 'ce', (440, 1631), (556, 1631)), ('C42', 'ce', (800, 1569), (800, 1681)),
    ('C43', 'ce', (675, 1027), (556, 1027)), ('C44', 'ce', (2567, 1409), (2567, 1291)),
    # the bypass capacitors are printed «CE» and «CP» without a number: numbered here by position (see NOTA_CP)
    ('CE1', 'ce', (3583, 354), (3463, 354)), ('CE2', 'ce', (4006, 354), (3881, 354)),
    ('CE3', 'ce', (2826, 721), (2717, 721)), ('CE4', 'ce', (1284, 2075), (1284, 1960)),
    ('CE5', 'ce', (1469, 2731), (1456, 2615)), ('CE6', 'ce', (1378, 3303), (1260, 3303)),
    ('CP1', 'c', (4229, 3135), (4229, 3250)), ('CP2', 'c', (4229, 2716), (4229, 2834)),
    ('CP3', 'c', (3414, 3073), (3414, 3194)), ('CP4', 'c', (440, 1506), (556, 1506)),
    ('CP5', 'c', (440, 1329), (556, 1329)), ('CP6', 'c', (560, 1148), (675, 1148)),
    ('CP7', 'c', (3674, 354), (3791, 354)), ('CP8', 'c', (4094, 354), (4213, 354)),
    ('CP9', 'c', (2830, 844), (2830, 956)), ('CP10', 'c', (1403, 1960), (1403, 2069)),
    ('CP11', 'c', (1584, 2615), (1590, 2731)), ('CP12', 'c', (1471, 3303), (1589, 3303)),
    ('CP13', 'c', (2429, 2969), (2429, 3089)),
    # ferrite beads and inductors
    ('FB1', 'fb', (1797, 3183), (1797, 3303)), ('FB2', 'fb', (2636, 3179), (2636, 3300)),
    ('FB3', 'fb', (800, 1156), (800, 1262)), ('FB4', 'fb', (1637, 1056), (1633, 1171)),
    ('FB5', 'fb', (1221, 1176), (1336, 1176)), ('FB6', 'fb', (1150, 1298), (1150, 1412)),
    ('FB7', 'fb4', (3921, 2753), (3921, 2871)), ('FB8', 'fb', (4229, 2922), (4229, 3043)),
    ('FB9', 'fb', (3558, 2662), (3558, 2778)), ('FB10', 'fb', (1491, 1953), (1491, 2069)),
    ('JV1', 'fb', (435, 550), (435, 671)), ('JG1', 'fb', (555, 544), (555, 669)),
    ('L1', 'l', (1907, 663), (1907, 777)), ('L2', 'l', (2027, 511), (2143, 513)),
    ('L3', 'l', (2027, 777), (2143, 777)),
    # diodes: pad 1 is the cathode (the bar of the silkscreen symbol)
    ('D1', 'd', (2636, 2871), (2636, 2754)), ('D2', 'd', (440, 1747), (556, 1747)),
]

# Three-terminal EMI filters of the controller lines: (ref, column x, rows y top/middle/bottom); pin 1 is the one
# towards the ports (bottom), pin 2 the middle (ground), pin 3 towards the chips: as the schematic draws them.
EMIS = [(r, x, (2969, 3028, 3089)) for r, x in (('EM17', 1797), ('EM16', 1886), ('EM11', 1976), ('EM12', 2067),
                                                ('EM13', 2161), ('EM14', 2250), ('EM15', 2336), ('EM18', 2543),
                                                ('EM27', 2636), ('EM26', 2729))] + \
       [(r, x, (3026, 3079, 3140)) for r, x in (('EM21', 2821), ('EM22', 2907), ('EM23', 2997), ('EM24', 3086))] + \
       [(r, x, (3073, 3136, 3194)) for r, x in (('EM25', 3323), ('EM28', 3509))]

# The labels of the bypass capacitors and of the two groups whose silkscreen is ambiguous.
NOTA_CP = ('La serigrafía solo dice «CP» o «CE», sin número: su número del esquema (todos van entre +5 V y masa, salvo '
           'CP1, CP4 y CP6) se ha asignado por su posición junto al chip o la fuente que desacoplan.')
DUDOSAS = {
    'EM18': 'La etiqueta EM18 queda entre dos columnas de filtros; se toma la de su izquierda.',
    'EM26': 'Las etiquetas EM26 y EM27 quedan encima de las columnas: se toma la más cercana.',
    'EM27': 'Las etiquetas EM26 y EM27 quedan encima de las columnas: se toma la más cercana.',
    'FB7': 'La serigrafía dibuja una ferrita grande en un círculo con dos taladros: se toma como FB7 («FB (4 HOLE)»).',
    'FB9': 'Rotulada solo con el símbolo de ferrita; se toma como FB9 por su posición entre C16 y C46.',
    'FB10': 'En este grupo (CP, FB10, C23) los rótulos quedan entre columnas: asignación por proximidad.',
    'C23': 'En este grupo (CP, FB10, C23) los rótulos quedan entre columnas: asignación por proximidad.',
    'C15': 'Entre los rótulos C15 y FB7: se toma como C15.',
}

# Bigger parts (px on the top scan).
OSC1 = {1: (4112, 3106), 7: (3751, 3106), 8: (3751, 3290), 14: (4112, 3290)}
IC8 = [(110, 1450), (168, 1450), (232, 1450)]          # I C O as the silkscreen says
# cartridge slot: odd pins on the row towards IC1, pin 1 at the right
CN1 = {'impar': ((3680, 1674), (2240, 1674)), 'par': ((3680, 1794), (2240, 1794))}
CN_MANDO = {
    'CN2': {'fila1': ((2150, 3246), (2410, 3246)), 'fila2': ((2186, 3310), (2379, 3310)), 'fijacion': [(1971, 3464), (2571, 3457)]},
    'CN3': {'fila1': ((2900, 3240), (3157, 3240)), 'fila2': ((2936, 3304), (3122, 3304)), 'fijacion': [(2729, 3457), (3325, 3466)]},
}
# one 9-pin SIP: the manual draws it as two boxes «RA1» (the second one is RA2 in the transcription)
RA1 = ((4227, 2146), (3740, 2146))
# QUIP-64 VDP: pins 1–32 on the side towards the cartridge slot (pin 1 at the right, odd pins on the inner row)
IC5 = {'arriba': (2690, 2157, 2097), 'abajo': (1763, 2666, 2603), 'paso': 30.0}
# DC jack: five slots; which slot is which contact is not printed
CN4 = [(637, 177, 'h'), (637, 325, 'h'), (522, 256, 'v'), (522, 137, 'v'), (746, 156, 'v')]
SW1 = {'pines': [(385, 3290), (477, 3290), (575, 3290)], 'fijacion': [(337, 3194), (619, 3190), (337, 3337), (622, 3335)]}
SW2 = [(347, 1956, '1'), (347, 2069, '1'), (594, 1956, '2'), (594, 2069, '2')]
# RF modulator: the three signal pins (silkscreen «3 … 1»), its case tabs, and three pins of the channel switch
RF1 = {'senal': [(1431, 996), (1371, 996), (1309, 996)], 'caja': [(975, 427, 'v'), (950, 669, 'v'), (1647, 420, 'v'), (1673, 653, 'v')],
       'canal': [(1150, 581), (1090, 581), (1027, 581)], 'contorno': (915, 310, 1731, 1045)}
# holes of the narrow (300 mil) alternative of IC3, unused by the 4168
IC3_ALT = ((4039, 503), (4039, 1283))

# (the chips' markings are in consolas_cuerpos.MARCADOS['sms'], with the other boards')

# ------------------------------------------------------------------ image helpers


def _ruta_cache(nombre):
    os.makedirs(CACHE, exist_ok=True)
    return os.path.join(CACHE, nombre)


def respuesta(ruta):
    """Ring-minus-centre response of a scan (high on a solder ring around a hole), cached next to this script."""
    st = os.stat(ruta)
    clave = _ruta_cache('%s-%d-%d.npy' % (os.path.basename(ruta), st.st_size, int(st.st_mtime)))
    if os.path.exists(clave):
        return np.load(clave).astype(np.float32)
    im = cv2.imread(ruta)
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    v = hsv[..., 2].astype(np.float32)
    s = hsv[..., 1].astype(np.float32)
    plata = np.clip((v - 110) / 100, 0, 1) * np.clip((120 - s) / 80, 0, 1)

    def disco(r):
        k = np.zeros((2 * r + 1, 2 * r + 1), np.float32)
        cv2.circle(k, (r, r), r, 1, -1)
        return k
    mejor = None
    for R in (13, 16, 20, 25):
        rc = max(3, int(R * 0.45))
        ri = int(R * 0.62)
        ann = disco(R) - np.pad(disco(ri), R - ri)
        ann /= ann.sum()
        cen = np.pad(disco(rc), R - rc)
        cen /= cen.sum()
        r = cv2.filter2D(plata, -1, ann) - cv2.filter2D(plata, -1, cen)
        mejor = r if mejor is None else np.maximum(mejor, r)
    np.save(clave, mejor.astype(np.float16))
    return mejor


def ajustar_punto(resp, p, radio=18, umbral=0.12):
    """The ring centre nearest to `p` (px): the response maximum within `radio`, refined to sub-pixel; None if weak."""
    x, y = int(round(p[0])), int(round(p[1]))
    h, w = resp.shape
    x0, x1, y0, y1 = max(0, x - radio), min(w, x + radio + 1), max(0, y - radio), min(h, y + radio + 1)
    ven = resp[y0:y1, x0:x1]
    j = int(np.argmax(ven))
    vy, vx = divmod(j, ven.shape[1])
    if ven[vy, vx] < umbral:
        return None
    # centroid of the top of the peak
    yy, xx = np.mgrid[max(0, vy - 3):min(ven.shape[0], vy + 4), max(0, vx - 3):min(ven.shape[1], vx + 4)]
    ww = np.clip(ven[yy, xx] - 0.7 * ven[vy, vx], 0, None)
    if ww.sum() <= 0:
        return (x0 + vx, y0 + vy)
    return (x0 + float((xx * ww).sum() / ww.sum()), y0 + float((yy * ww).sum() / ww.sum()))


def _interp(a, b, n):
    return [(a[0] + (b[0] - a[0]) * i / (n - 1), a[1] + (b[1] - a[1]) * i / (n - 1)) for i in range(n)]


# ------------------------------------------------------------------ geometry of each part in photo px


def piezas_px():
    """Every part as {ref, tipo, pads: [(num, (x, y) px, forma)], rejilla: bool (pins on a 2.54 mm lattice)}."""
    out = []
    for ref, n, p1, pk, pn in DIPS:
        m = n // 2
        f1 = _interp(p1, pk, m)
        f2 = _interp(pn, (pn[0] + pk[0] - p1[0], pn[1] + pk[1] - p1[1]), m)
        pads = [(str(i + 1), q, 'c') for i, q in enumerate(f1)] + [(str(n - i), q, 'c') for i, q in enumerate(f2)]
        out.append({'ref': ref, 'tipo': 'dip', 'pads': pads, 'rejilla': True})
    # QUIP-64
    xa, ya_in, ya_out = IC5['arriba']
    xb, yb_out, yb_in = IC5['abajo']
    st = IC5['paso']
    pads = []
    for i in range(32):
        pads.append((str(i + 1), (xa - i * st, ya_in if i % 2 == 0 else ya_out), 'c'))
    for i in range(32):
        pads.append((str(33 + i), (xb + i * st, yb_out if i % 2 == 0 else yb_in), 'c'))
    out.append({'ref': 'IC5', 'tipo': 'quip', 'pads': pads, 'rejilla': True})
    out.append({'ref': 'OSC1', 'tipo': 'osc', 'pads': [(str(k), v, 'c') for k, v in sorted(OSC1.items())], 'rejilla': True})
    out.append({'ref': 'IC8', 'tipo': 'to220', 'pads': [(str(i + 1), v, 'c') for i, v in enumerate(IC8)], 'rejilla': True})
    impar = _interp(*CN1['impar'], 25)
    par = _interp(*CN1['par'], 25)
    out.append({'ref': 'CN1', 'tipo': 'cartucho', 'rejilla': True,
                'pads': [(str(2 * i + 1), q, 'c') for i, q in enumerate(impar)] + [(str(2 * i + 2), q, 'c') for i, q in enumerate(par)]})
    for ref, c in CN_MANDO.items():
        f1 = _interp(*c['fila1'], 5)
        f2 = _interp(*c['fila2'], 4)
        out.append({'ref': ref, 'tipo': 'dsub', 'rejilla': False,
                    'pads': [(str(i + 1), q, 'c') for i, q in enumerate(f1)] + [(str(6 + i), q, 'c') for i, q in enumerate(f2)] +
                            [('', q, 'fij') for q in c['fijacion']]})
    out.append({'ref': 'RA1', 'tipo': 'sip', 'rejilla': True, 'pads': [(str(i + 1), q, 'c') for i, q in enumerate(_interp(*RA1, 9))]})
    for ref, x, ys in EMIS:
        out.append({'ref': ref, 'tipo': 'emi', 'rejilla': True, 'pads': [('1', (x, ys[2]), 'c'), ('2', (x, ys[1]), 'c'), ('3', (x, ys[0]), 'c')]})
    for ref, k, a, b in DOS:
        out.append({'ref': ref, 'tipo': k, 'rejilla': False, 'pads': [('1', a, 'c'), ('2', b, 'c')]})
    out.append({'ref': 'CN4', 'tipo': 'jack', 'rejilla': False, 'pads': [(str(i + 1), (x, y), 'ranura-' + o) for i, (x, y, o) in enumerate(CN4)]})
    out.append({'ref': 'SW1', 'tipo': 'interruptor', 'rejilla': False,
                'pads': [(str(i + 1), q, 'c') for i, q in enumerate(SW1['pines'])] + [('', q, 'fij-np') for q in SW1['fijacion']]})
    out.append({'ref': 'SW2', 'tipo': 'pulsador', 'rejilla': False, 'pads': [(n, (x, y), 'c') for x, y, n in SW2]})
    out.append({'ref': 'RF1', 'tipo': 'rf', 'rejilla': False,
                'pads': [(str(i + 1), q, 'c') for i, q in enumerate(RF1['senal'])] +
                        [('4', (x, y), 'ranura-' + o) for x, y, o in RF1['caja']] + [('', q, 'c') for q in RF1['canal']]})
    out.append({'ref': 'IC3-ALT', 'tipo': 'huecos', 'rejilla': True, 'pads': [('', q, 'c') for q in _interp(*IC3_ALT, 14)]})
    return out


# ------------------------------------------------------------------ calibration: photo px -> board mm


def _giro90(v):
    """The multiple of 90° (as an index 0..3) of a px direction: 0 = +x, 1 = +y, 2 = −x, 3 = −y."""
    return int(round(math.atan2(v[1], v[0]) / (math.pi / 2))) % 4


def ajustar_rejillas(piezas, resp):
    """Snaps every pad to its ring; then fits one affine map (px = A · mm + t) to the parts whose pins lie on the
    2.54 mm lattice, each part with its own offset, and puts their pads on the fitted lattice. Returns
    (A 2×2, residual list px, snapped count, total)."""
    filas_A, filas_b = [], []
    partes = [p for p in piezas if p['rejilla'] and p['tipo'] != 'huecos']
    n_ok = n_tot = 0
    # first pass: snapped px of every pad
    for p in piezas:
        snap = []
        for num, q, forma in p['pads']:
            r = ajustar_punto(resp, q, 20 if forma == 'c' else 6) if forma == 'c' else None
            n_tot += 1
            if r is not None:
                n_ok += 1
            snap.append(r)
        p['snap'] = snap
    # local lattice coordinates (in pitches) of each lattice part from its nominal px pads
    k = len(partes)
    for j, p in enumerate(partes):
        q0 = p['pads'][0][1]
        # the part's axes: along its first row and across
        if len(p['pads']) >= 2:
            ref_dir = (p['pads'][1][1][0] - q0[0], p['pads'][1][1][1] - q0[1])
        else:
            ref_dir = (1, 0)
        p['_q0'] = q0
        for (num, q, forma), s in zip(p['pads'], p['snap']):
            if s is None:
                continue
            # nominal offset from pad 1 in px, rounded to the lattice (pitch ≈ 60 px at 600 dpi) → mm
            mm = (round((q[0] - q0[0]) / 60.0 * 2) / 2 * PASO, round((q[1] - q0[1]) / 60.0 * 2) / 2 * PASO)
            if p['tipo'] == 'quip':
                # half-pitch steps along the rows, 2.54 between the inner and outer rows (to be checked)
                mm = (round((q[0] - q0[0]) / 30.0) * PASO / 2, round((q[1] - q0[1]) / 60.0 * 2) / 2 * PASO)
            row = np.zeros((2, 4 + 2 * k))
            row[0, 0], row[0, 1] = mm
            row[1, 2], row[1, 3] = mm
            row[0, 4 + 2 * j] = 1
            row[1, 5 + 2 * j] = 1
            filas_A.append(row)
            filas_b.append(s)
            p.setdefault('_obs', []).append((mm, s))
    A = np.vstack(filas_A)
    b = np.array(filas_b, float).reshape(-1)
    sol, *_ = np.linalg.lstsq(A, b, rcond=None)
    # drop outliers (a misread snap) and fit again
    res = (A @ sol - b).reshape(-1, 2)
    malos = np.hypot(res[:, 0], res[:, 1]) > 6
    if malos.any():
        keep = np.repeat(~malos, 2)
        sol, *_ = np.linalg.lstsq(A[keep], b[keep], rcond=None)
        res = (A[keep] @ sol - b[keep]).reshape(-1, 2)
    M = np.array([[sol[0], sol[1]], [sol[2], sol[3]]])
    for j, p in enumerate(partes):
        o = np.array([sol[4 + 2 * j], sol[5 + 2 * j]])
        p['_origen'] = o
    return M, np.hypot(res[:, 0], res[:, 1]), n_ok, n_tot, partes


# ------------------------------------------------------------------ outline and holes of the scan


def contorno_px(im):
    """The board's outline in px: the largest region that is not the scanner's white lid, simplified."""
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    fondo = ((g > 228) & (hsv[..., 1] < 30)).astype(np.uint8)
    placa = 1 - fondo
    placa = cv2.morphologyEx(placa, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    placa = cv2.morphologyEx(placa, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    cs, jer = cv2.findContours(placa, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    i = max(range(len(cs)), key=lambda k: cv2.contourArea(cs[k]))
    ext = cv2.approxPolyDP(cs[i], 2.5, True).reshape(-1, 2)
    # inner white regions of the board (holes through which the lid shows): children of the outline
    huecos = []
    for k, c in enumerate(cs):
        if jer[0][k][3] == i and cv2.contourArea(c) > 400:
            huecos.append(c.reshape(-1, 2))
    return ext, huecos


def _a_mm(Minv, t, pts):
    pts = np.asarray(pts, float)
    return (Minv @ (pts - t).T).T


# ------------------------------------------------------------------ nets


def _nodos(d):
    out = {}
    for r in d['redes']:
        for nd in r['nodos']:
            out[(nd[0], str(nd[1]))] = r['n']
    return out


# ------------------------------------------------------------------ the board


def _es(v, dec=2):
    """A number with a decimal comma (Spanish)."""
    return ('%.*f' % (dec, v)).replace('.', ',')


def _q(v):
    return int(round(v * 100))


def _delta(pts):
    out = []
    lx = ly = None
    for x, y in pts:
        if lx is None:
            out += [x, y]
        else:
            out += [x - lx, y - ly]
        lx, ly = x, y
    return out


def construir(cfg, d, fuentes, out_dir, problemas):
    """The board data for consolas_pcb.escribir, plus the two face textures written into `out_dir`/sms/."""
    if cv2 is None:
        raise SystemExit('consolas_sms_placa: hace falta OpenCV (python3-opencv) para leer las fotos')
    ruta_top = os.path.join(fuentes, cfg['ruta'])
    ruta_bot = os.path.join(fuentes, cfg['ruta_inferior'])
    top = cv2.imread(ruta_top)
    resp = respuesta(ruta_top)
    piezas = piezas_px()
    M, resid, n_ok, n_tot, partes = ajustar_rejillas(piezas, resp)
    # board frame: x along the image's x, rotation removed by the fit (M = scale · rotation · shear)
    Minv = np.linalg.inv(M)
    # px of every pad: lattice parts from their fitted lattice, the rest snapped (or as measured)
    for p in piezas:
        px = []
        if p in partes:
            for (num, q, forma), s in zip(p['pads'], p['snap']):
                q0 = p['_q0']
                if p['tipo'] == 'quip':
                    mm = (round((q[0] - q0[0]) / 30.0) * PASO / 2, round((q[1] - q0[1]) / 60.0 * 2) / 2 * PASO)
                else:
                    mm = (round((q[0] - q0[0]) / 60.0 * 2) / 2 * PASO, round((q[1] - q0[1]) / 60.0 * 2) / 2 * PASO)
                px.append(tuple(M @ np.array(mm) + p['_origen']))
        else:
            for (num, q, forma), s in zip(p['pads'], p['snap']):
                px.append(s if s is not None else q)
        p['px'] = px
    ext, huecos = contorno_px(top)
    # origin: the outline's top-left in the board frame
    t0 = np.array([0.0, 0.0])
    ext_mm = _a_mm(Minv, t0, ext)
    X0, Y0 = ext_mm[:, 0].min(), ext_mm[:, 1].min()
    t = M @ np.array([X0, Y0])           # px of the board origin
    ext_mm = _a_mm(Minv, t, ext)
    ancho, alto = float(ext_mm[:, 0].max()), float(ext_mm[:, 1].max())
    escala = (math.hypot(M[0, 0], M[1, 0]), math.hypot(M[0, 1], M[1, 1]))
    giro = math.degrees(math.atan2(M[1, 0], M[0, 0]))

    def a_mm(q):
        return _a_mm(Minv, t, [q])[0]

    # ---- bottom scan registered on the top one through the holes (mirror + affine, refined by nearest rings)
    bot = cv2.imread(ruta_bot)
    resp_b = respuesta(ruta_bot)
    Wb = bot.shape[1]
    pads_top = np.array([q for p in piezas for q in p['px']], float)
    ext_b, _ = contorno_px(bot)
    # initial guess from the outlines' boxes (the bottom scan is the top one mirrored left-right)
    bx0, by0, bw, bh = cv2.boundingRect(ext_b.astype(np.int32))
    tx0, ty0, tw, th = cv2.boundingRect(ext.astype(np.int32))
    G = np.array([[-bw / tw, 0, bx0 + bw + (tx0) * bw / tw], [0, bh / th, by0 - ty0 * bh / th]])
    for it in range(6):
        pred = (G[:, :2] @ pads_top.T).T + G[:, 2]
        src, dst = [], []
        for q, pr in zip(pads_top, pred):
            s = ajustar_punto(resp_b, pr, 22 if it < 2 else 12, 0.15)
            if s is not None:
                src.append(q)
                dst.append(s)
        src = np.array(src)
        dst = np.array(dst)
        Xs = np.hstack([src, np.ones((len(src), 1))])
        G = np.linalg.lstsq(Xs, dst, rcond=None)[0].T
    err_b = np.hypot(*((np.hstack([src, np.ones((len(src), 1))]) @ G.T) - dst).T)

    def a_bot(q):
        return tuple(G[:, :2] @ np.asarray(q, float) + G[:, 2])

    # ---- textures in the board frame, each face at its own size (`textura_px`: long side in px)
    os.makedirs(os.path.join(out_dir, cfg['id']), exist_ok=True)
    fotos = {}
    calidad = cfg.get('calidad', 80)
    for lado in ('F', 'B'):
        lado_tex = cfg.get('textura_px', {}).get(lado, 2048)
        k = lado_tex / max(ancho, alto)              # texture px per mm
        Wt, Ht = int(round(ancho * k)), int(round(alto * k))
        # texture px -> mm: (x / k, y / k); mm -> top px: M · mm + t; the bottom scan through the registration G.
        # The scan is first reduced (area average) close to the texture's scale, then warped: no aliasing.
        T = np.hstack([M / k, t.reshape(2, 1)])
        fuente = top
        if lado == 'B':
            T = np.hstack([G[:, :2] @ (M / k), (G[:, :2] @ t + G[:, 2]).reshape(2, 1)])
            fuente = bot
        red = max(1, int(math.floor(escala[0] / k)))
        if red > 1:
            fuente = cv2.resize(fuente, None, fx=1 / red, fy=1 / red, interpolation=cv2.INTER_AREA)
            T = T / red
        img = cv2.warpAffine(fuente, T, (Wt, Ht), flags=cv2.WARP_INVERSE_MAP | cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        nombre = 'cara-%s.jpg' % lado
        cv2.imwrite(os.path.join(out_dir, cfg['id'], nombre), img, [cv2.IMWRITE_JPEG_QUALITY, calidad, cv2.IMWRITE_JPEG_PROGRESSIVE, 1])
        fotos[lado] = {'src': 'consolas/placas/%s/%s' % (cfg['id'], nombre), 'w': Wt, 'h': Ht,
                       'bytes': os.path.getsize(os.path.join(out_dir, cfg['id'], nombre))}

    # ---- nets: the schematic's, by reference and pin
    nodos = _nodos(d)
    # the 9-pin network RA1 is drawn in the manual as two boxes (RA1 and RA2, each with the common pin): its pins
    # 6–9 are RA2's 2–5 (an assumption of order: the board does not number them)
    for i in range(4):
        if ('RA2', str(i + 2)) in nodos:
            nodos[('RA1', str(i + 6))] = nodos[('RA2', str(i + 2))]
    for p in piezas:
        p['mm'] = [a_mm(q) for q in p['px']]

    comp = d['componentes']
    redes = sorted({n for n in nodos.values()}, key=lambda s: (s.startswith('unconnected-'), s))
    idx = {n: i for i, n in enumerate(redes)}
    funcion = {}
    for h in d['hotspots'] + [x for f in d.get('fotos', []) for x in f.get('hotspots', [])]:
        for r in h.get('esquema', []):
            funcion.setdefault(r, h.get('funcion', ''))

    huellas, pads, pads_red = [], [], {}
    TAM = {'dip': (1.6, 0.8), 'quip': (1.3, 0.7), 'osc': (1.6, 0.8), 'to220': (1.8, 1.0), 'cartucho': (1.7, 1.0),
           'dsub': (1.6, 1.0), 'sip': (1.6, 0.8), 'emi': (1.7, 0.8), 'huecos': (1.6, 0.8), 'pulsador': (2.0, 1.1),
           'interruptor': (1.8, 1.1), 'rf': (1.8, 1.0)}
    for p in piezas:
        ref = p['ref']
        v = (comp.get(ref) or {}).get('v', '')
        mm = p['mm']
        # footprint frame: origin at pad 1, local +x towards pad 2 for two-lead parts, local +y along the first
        # row for the multi-row ones (KiCad's DIP convention)
        o = mm[0]
        if p['tipo'] in ('dip', 'quip', 'osc', 'cartucho'):
            u = mm[1] - mm[0] if p['tipo'] != 'osc' else mm[1] - mm[0]
            if p['tipo'] == 'quip':
                u = mm[2] - mm[0]
            if p['tipo'] == 'cartucho':
                u = mm[1] - mm[0]           # pin 1 -> pin 3 along the odd row
            a = math.degrees(math.atan2(u[0], u[1]))
        else:
            dvec = mm[1] - mm[0]
            a = math.degrees(math.atan2(-dvec[1], dvec[0]))
        a = round(a / 90) * 90 if p['tipo'] not in ('c', 'r', 'ce', 'fb', 'fb4', 'l', 'd') else round(a, 1)
        a = ((a + 180) % 360) - 180
        inicio = len(pads)
        dpad, dtal = TAM.get(p['tipo'], (2.0, 1.0))
        for (num, q, forma), xy in zip(p['pads'], mm):
            n = nodos.get((ref, num)) if num else None
            r = idx.get(n, -1) if n else -1
            if r >= 0:
                pads_red[(ref, num)] = n
            x, y = _q(xy[0]), _q(xy[1])
            if forma.startswith('ranura'):
                w, h = (3.0, 1.4) if forma.endswith('h') else (1.4, 3.0)
                pads.append([len(huellas), num, 'o', x, y, _q(w + 0.8), _q(h + 0.8), 0.0, 0.0, _q(w), _q(h), 1 | 2 | 4 | 16 | 32, r, ''])
            elif forma == 'fij-np':
                pads.append([len(huellas), num, 'c', x, y, _q(1.6), _q(1.6), 0.0, 0.0, _q(1.6), _q(1.6), 8 | 16 | 32, -1, ''])
            elif forma == 'fij':
                pads.append([len(huellas), num, 'c', x, y, _q(5.0), _q(5.0), 0.0, 0.0, _q(3.1), _q(3.1), 1 | 2 | 4 | 16 | 32, idx.get('GND', -1), ''])
            else:
                pads.append([len(huellas), num, 'c', x, y, _q(dpad), _q(dpad), 0.0, 0.0, _q(dtal), _q(dtal), 1 | 2 | 4 | 16 | 32, r, ''])
        nombre, caja = _huella(p, mm, a)
        if caja is None and '_rf' in p:
            # the modulator's box: the silkscreen rectangle of the photo, in the footprint's local mm
            x0, y0, x1, y1 = p['_rf']
            an = math.radians(-a)
            loc = []
            for c in ((x0, y0), (x1, y0), (x1, y1), (x0, y1)):
                m_ = a_mm(c) - o
                loc.append((m_[0] * math.cos(an) + m_[1] * math.sin(an), -m_[0] * math.sin(an) + m_[1] * math.cos(an)))
            caja = [round(min(v[0] for v in loc), 3), round(min(v[1] for v in loc), 3),
                    round(max(v[0] for v in loc), 3), round(max(v[1] for v in loc), 3)]
        nota = 'Taladros medidos en la foto de la placa desnuda (serigrafía «%s»)' % ref.replace('-ALT', '')
        if ref.startswith(('CP', 'CE')):
            nota += '. ' + NOTA_CP
        if ref in DUDOSAS:
            nota += '. ' + DUDOSAS[ref]
        if len([1 for x in p['pads'] if x[0]]) == 2 and p['tipo'] not in ('ce', 'd') and ref in comp:
            nota += '. Qué taladro lleva cada red no se ve en la foto: el orden de sus dos pads es supuesto'
        elif p['tipo'] == 'ce':
            nota += '. El «+» de la serigrafía marca su patilla positiva'
        elif p['tipo'] == 'd':
            nota += '. La barra del símbolo de la serigrafía marca el cátodo'
        elif ref == 'RA1':
            nota += ('. Es una sola red de 9 patas (común y 8 resistencias) que el manual dibuja en dos cajas, RA1 y RA2: '
                     'sus patas 6 a 9 son las 2 a 5 de RA2 (orden supuesto). Su rótulo no se ve en las fotos: se escribe '
                     '«8 × R»')
        elif ref in ('CN4', 'SW1', 'SW2', 'RF1'):
            nota += '. Qué contacto es cada taladro no está impreso: la asignación es supuesta'
        h = {'r': ref, 'v': v or ('' if ref != 'IC3-ALT' else 'huella de 300 mil sin usar'), 'l': nombre, 'lib': 'SMS_171-5922A',
             'x': _q(o[0]), 'y': _q(o[1]), 'a': a, 'lado': 'F', 't': 'mec' if p['tipo'] == 'huecos' else 'tht',
             'pads': [inicio, len(pads) - inicio], 'm': {'tipo': 'caja', 'caja': caja}, 'fab': [],
             'f': funcion.get(ref, '') or _deducida(ref, v, [nodos.get((ref, x[0])) for x in p['pads'] if x[0]]),
             'fo': 'deducida', 'rec': {'pos': 'foto', 'cuerpo': 'foto', 'nota': nota + '.'}}
        if p['tipo'] == 'huecos':
            h['m'] = {'tipo': 'sin_cuerpo', 'caja': caja, 'motivo': 'taladros de la otra huella de IC3', 'clasif': 'tabla'}
            h['f'] = 'Taladros de la huella alternativa de IC3 (RAM estrecha de 300 mil): en esta placa no se usan.'
        if ref == 'R3':
            h['dnp'] = True
        huellas.append(h)

    # ---- mounting holes and cut-outs: white regions inside the outline (the lid seen through the board)
    nh = 0
    for c in huecos:
        cmm = _a_mm(Minv, t, c)
        x0, y0 = cmm.min(axis=0)
        x1, y1 = cmm.max(axis=0)
        w, h = x1 - x0, y1 - y0
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        if max(w, h) < 1.2:
            continue
        # a hole of a part already placed (its drill is there) is not a separate hole
        if any(math.hypot(cx - pp[3] / 100, cy - pp[4] / 100) < 1.2 for pp in pads):
            continue
        nh += 1
        inicio = len(pads)
        redondo = abs(w - h) < 0.6
        pads.append([len(huellas), '', 'c' if redondo else 'o', _q(cx), _q(cy), _q(w), _q(h), 0.0, 0.0, _q(w), _q(h), 8, -1, ''])
        huellas.append({'r': 'H%d' % nh, 'v': '', 'l': 'NPTH', 'lib': 'SMS_171-5922A', 'x': _q(cx), 'y': _q(cy),
                        'a': 0, 'lado': 'F', 't': 'mec', 'pads': [inicio, 1],
                        'm': {'tipo': 'sin_cuerpo', 'caja': [-w / 2, -h / 2, w / 2, h / 2], 'motivo': 'taladro', 'clasif': 'tabla'},
                        'fab': [], 'f': ('Taladro de fijación sin metalizar (%.1f mm).' % w).replace('.', ',', 1) if redondo else
                        ('Ranura de la placa (%.1f × %.1f mm).' % (w, h)).replace('.', ','), 'fo': 'deducida'})

    contorno = _delta([(_q(x), _q(y)) for x, y in ext_mm])
    refs = sorted({h['r'] for h in huellas} & set(comp))
    solo_placa = sorted({h['r'] for h in huellas if h['t'] != 'mec'} - set(comp))
    faltan = sorted(set(comp) - {h['r'] for h in huellas} - {'RA2'})
    comprobaciones = [
        {'tipo': 'aviso', 'texto': 'Reconstrucción a partir de la foto: no hay fichero de la placa. %d de %d taladros de componente '
                                   'centrados en su anillo de cobre; escala %s × %s px/mm (%.0f ppp), giro %s°, error '
                                   'mediano de la rejilla de 2,54 mm %s px (%s mm).'
                                   % (n_ok, n_tot, _es(escala[0]), _es(escala[1]), escala[0] * 25.4, _es(giro), _es(float(np.median(resid)), 1),
                                      _es(float(np.median(resid)) / escala[0]))},
        {'tipo': 'ok' if not faltan else 'aviso',
         'texto': '%d componentes de la placa están en el esquema' % len(refs) +
                  ('; solo en la placa: %s' % ', '.join(solo_placa) if solo_placa else '') +
                  ('; solo en el esquema: %s' % ', '.join(faltan) if faltan else '') +
                  ' (RA2 del esquema es la otra mitad de la red RA1 de 9 patas)'},
        {'tipo': 'ok', 'texto': 'Cara inferior: la foto de soldaduras registrada sobre la superior con %d taladros comunes '
                                '(error mediano %s px).' % (len(err_b), _es(float(np.median(err_b)), 1))},
    ]
    n_dos = sum(1 for p in piezas if p['tipo'] in ('r', 'c', 'fb', 'fb4', 'l') and p['ref'] in comp)
    comprobaciones.append({'tipo': 'aviso',
                           'texto': 'Piezas de dos patas sin polaridad (%d): la foto no dice qué taladro lleva cada red, así que '
                                    'el orden de sus dos pads es supuesto; los electrolíticos y los diodos siguen el «+» y la '
                                    'barra de la serigrafía.' % n_dos})
    pads_ic = sum(1 for (r, n) in pads_red if r.startswith(('IC', 'CN', 'OSC', 'RA')))
    comprobaciones.append({'tipo': 'ok', 'texto': '%d pads con la red del esquema (%d de chips y conectores, con su número de patilla).'
                                                  % (len(pads_red), pads_ic)})
    info = {'escala': escala, 'giro': giro, 'resid': resid, 'n_ok': n_ok, 'n_tot': n_tot, 'err_b': err_b, 'fotos': fotos,
            'agujeros': nh}
    return {
        'X0': 0.0, 'Y0': 0.0, 'ancho': ancho, 'alto': alto, 'ox': 0, 'oy': 0, 'capas': ['F', 'B'], 'grosor': 1.6,
        'redes': redes, 'huellas': huellas, 'pads': pads, 'pistas': {}, 'vias': [], 'zonas': [], 'areas': [],
        'serigrafia': {}, 'contorno': contorno, 'mapa': {n: n for n in redes}, 'refs': refs,
        'comprobaciones': comprobaciones, 'fotos': fotos, 'info': info, 'alias': {'RA2': 'RA1'},
    }


def _deducida(ref, v, nets):
    nets = [n for n in nets if n]
    unicas = list(dict.fromkeys(nets))
    clase = {'R': 'Resistencia', 'C': 'Condensador', 'L': 'Bobina', 'F': 'Ferrita', 'J': 'Ferrita', 'D': 'Diodo',
             'E': 'Filtro EMI'}.get(ref[0], 'Componente')
    if ref.startswith('EM'):
        clase = 'Filtro EMI de tres terminales'
    if len(unicas) == 2:
        return '%s de %s entre %s y %s.' % (clase, v, unicas[0], unicas[1]) if v else '%s entre %s y %s.' % (clase, unicas[0], unicas[1])
    if unicas:
        return '%s de %s: %s.' % (clase, v, ', '.join(unicas)) if v else '%s: %s.' % (clase, ', '.join(unicas))
    return '%s que no aparece en el esquema del manual.' % clase


def _huella(p, mm, a):
    """Footprint name (classified by consolas_cuerpos) and its body box in local mm."""
    an = math.radians(-a)
    o = mm[0]
    loc = [((q[0] - o[0]) * math.cos(an) + (q[1] - o[1]) * math.sin(an), -(q[0] - o[0]) * math.sin(an) + (q[1] - o[1]) * math.cos(an))
           for q in mm]
    xs = [q[0] for q in loc]
    ys = [q[1] for q in loc]
    caja = [round(min(xs) - 1, 3), round(min(ys) - 1, 3), round(max(xs) + 1, 3), round(max(ys) + 1, 3)]
    t = p['tipo']
    n = len(p['pads'])
    nombre = {
        'dip': 'DIP-%d' % n, 'quip': 'SMS_QUIP-64', 'osc': 'Oscillator_DIP-14', 'to220': 'TO-220-3_Vertical',
        'cartucho': 'SMS_CART_2x25', 'dsub': 'DSUB-9_Male_Horizontal', 'sip': 'SMS_SIP-9', 'emi': 'SMS_EMI-3',
        'r': 'SMS_R', 'c': 'SMS_C', 'ce': 'SMS_CE', 'fb': 'SMS_FB', 'fb4': 'SMS_FB_4H', 'l': 'SMS_L', 'd': 'SMS_D',
        'jack': 'DcJack', 'interruptor': 'SW_E-Switch', 'pulsador': 'SW_Tactile', 'rf': 'Mod_RF', 'huecos': 'SMS_IC3_300mil',
    }[t]
    if t == 'rf':
        # the modulator's silkscreen box, from the photo
        x0, y0, x1, y1 = RF1['contorno']
        caja = None
        p['_rf'] = (x0, y0, x1, y1)
    if t == 'dsub':
        # the D-sub body: between its flange holes, towards the board edge (12 mm deep)
        fx = [q[0] for q in loc[-2:]]
        fy = [q[1] for q in loc[-2:]]
        caja = [round(min(fx) - 3.5, 3), round(min(ys) - 2.0, 3), round(max(fx) + 3.5, 3), round(max(fy) + 2.0, 3)]
    if t == 'dip' and p['ref'] == 'IC3':
        nombre = 'DIP-28_W15.24mm'
    return nombre, caja


def resumen(info):
    e = info['escala']
    return ('escala %.2f × %.2f px/mm (%.0f ppp), giro %.2f°, rejilla: error mediano %.1f px, máx. %.1f px; '
            'taladros centrados %d/%d; cara inferior: %d taladros comunes, error mediano %.1f px; '
            'agujeros y ranuras %d; caras %s'
            % (e[0], e[1], e[0] * 25.4, info['giro'], float(np.median(info['resid'])), float(np.max(info['resid'])), info['n_ok'],
               info['n_tot'], len(info['err_b']), float(np.median(info['err_b'])), info['agujeros'],
               ', '.join('%s %d×%d %.0f kB' % (k, v['w'], v['h'], v['bytes'] / 1024) for k, v in info['fotos'].items())))
