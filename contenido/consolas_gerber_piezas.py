"""Part placement reconstructed for a board published only as Gerbers (Natalie the Nerd's CGB-CPU-04).

A Gerber has no placement file, but KiCad's X2 attributes give every copper pad its reference and pin. With the
footprint name of each reference in the console's schematic (Natalie's own KiCad footprint field) and the KiCad
library footprint of that name, each part is placed by fitting the library pads onto the Gerber pads (rotation
by least squares, residual checked). Natalie's own footprints («CPU CGB», «Cart CGB»…) are not in any library:
their bodies come from the silkscreen outline around their pads or, where the silkscreen has none, from the board
photos («Foto» tab), and are marked as approximate. Nothing is read that the sources do not give: values come
from the schematic, markings from the photo hotspots; heights are the package's typical ones.

Every part gets `rec` {pos, cuerpo, nota}: the data flag of a reconstructed placement and the note shown in its
sheet (Spanish).

    reconstruir(pads_por_ref, comp, hotspots, silk, lado_de) -> {ref: huella fields}
"""

import math
import os
import re

import consolas_kicad as K
import proyectos_kicad_pcb as P

KICAD_FP = os.environ.get('KICAD_FOOTPRINTS', '/usr/share/kicad/footprints')
_INDICE = None


def _indice():
    global _INDICE
    if _INDICE is None:
        _INDICE = {}
        if os.path.isdir(KICAD_FP):
            for lib in sorted(os.listdir(KICAD_FP)):
                if lib.endswith('.pretty'):
                    for n in os.listdir(os.path.join(KICAD_FP, lib)):
                        if n.endswith('.kicad_mod'):
                            _INDICE.setdefault(n[:-10], (lib[:-7], os.path.join(KICAD_FP, lib, n)))
    return _INDICE


def huella_biblioteca(nombre):
    """The KiCad library footprint `nombre` read like a board footprint at the origin, or None."""
    e = _indice().get(nombre)
    if not e:
        return None
    lib, ruta = e
    with open(ruta, encoding='utf-8') as f:
        fp = K.parse_sexpr(f.read())
    f = P.read_footprint(fp, {})
    f['lib'] = '%s:%s' % (lib, nombre)
    return f


def _girar(u, v, a):
    """KiCad's rotation of a local offset by `a` degrees (counter-clockwise on screen, y down)."""
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return (u * c + v * s, -u * s + v * c)


def ajustar(locales, tablero):
    """Least-squares rotation and origin putting the local pad positions on the board ones.
    Returns (angle °, origin x, origin y, rms residual mm)."""
    n = len(locales)
    mx = sum(p[0] for p in locales) / n
    my = sum(p[1] for p in locales) / n
    bx = sum(p[0] for p in tablero) / n
    by = sum(p[1] for p in tablero) / n
    sxx = sxy = 0.0
    for (u, v), (x, y) in zip(locales, tablero):
        u, v, x, y = u - mx, v - my, x - bx, y - by
        # board = R_std(θ)·local with θ = −a
        sxx += u * x + v * y
        sxy += u * y - v * x
    th = math.atan2(sxy, sxx) if (sxx or sxy) else 0.0
    a = -math.degrees(th)
    k = round(a / 90) * 90
    if abs(a - k) < 1.5:
        a = float(k)
    a = round(((a + 180) % 360) - 180, 2)
    if a == -180:
        a = 180.0
    dx, dy = _girar(mx, my, a)
    ox, oy = bx - dx, by - dy
    err = 0.0
    for (u, v), (x, y) in zip(locales, tablero):
        gx, gy = _girar(u, v, a)
        err += (ox + gx - x) ** 2 + (oy + gy - y) ** 2
    return a, ox, oy, math.sqrt(err / n)


def ajustar_por_forma(locales, tablero):
    """The same fit when the pin numbers do not follow the library footprint: the pads are paired by position
    (each library pad with the nearest board pad) for each quarter turn, the best one kept."""
    mejor = None
    n = len(locales)
    mx = sum(p[0] for p in locales) / n
    my = sum(p[1] for p in locales) / n
    bx = sum(p[0] for p in tablero) / n
    by = sum(p[1] for p in tablero) / n
    for a in (0.0, 90.0, 180.0, -90.0):
        pares = []
        for u, v in locales:
            gx, gy = _girar(u - mx, v - my, a)
            q = min(tablero, key=lambda t: (t[0] - bx - gx) ** 2 + (t[1] - by - gy) ** 2)
            pares.append(q)
        r = ajustar(locales, pares)
        if mejor is None or r[3] < mejor[3]:
            mejor = r
    return mejor


def _espejo(f):
    """A library footprint as KiCad stores it on the bottom: local y and the layers mirrored."""
    for p in f['pads']:
        p['ly'] = -p['ly']
    g = []
    for L, kind, data, w, fill in f['graphics']:
        L2 = ('B.' + L[2:]) if L.startswith('F.') else L
        if kind == 'circle':
            (cx, cy), r = data
            g.append((L2, kind, [(cx, -cy), r], w, fill))
        else:
            g.append((L2, kind, [(x, -y) for x, y in data], w, fill))
    f['graphics'] = g
    f['side'] = 'B'
    return f


def _caja_silk(silk, x0, y0, x1, y1):
    """Bounding box (board mm) of the silkscreen strokes lying wholly inside a box, or None."""
    xs, ys = [], []
    for pts in silk:
        if all(x0 <= x <= x1 and y0 <= y <= y1 for x, y in pts):
            xs += [x for x, _ in pts]
            ys += [y for _, y in pts]
    return (min(xs), min(ys), max(xs), max(ys)) if xs else None


def _r(v):
    return round(v, 3)


# Parts whose photo hotspot («Foto» tab) quotes the marking printed on them.
ROTULO_EN_FOTO = {'U1', 'U2', 'U3', 'U4', 'X1'}


def _marcado(hotspots, ref):
    if ref not in ROTULO_EN_FOTO:
        return ''
    for h in hotspots:
        if ref in h.get('esquema', []) and len(h.get('esquema', [])) == 1 and h.get('pieza'):
            return '|'.join(t.strip() for t in h['pieza'].replace('Sharp ', '').split('·'))
    return ''


# Natalie's own footprints: body and side from the silkscreen or from the photos (approximate). Boxes are local
# (mm, around the centre of the pads; y down as on the board), `silk` asks for the silkscreen box instead.
PROPIAS = {
    # giro_rotulo: the marking turned as it reads in the photo
    'CPU CGB': dict(tipo='ci', silk=True, alto=2.7, giro_rotulo=180, fuente='serigrafia', paquete='QFP de 128 patillas'),
    'Amp MGB': dict(tipo='ci', silk=True, entre_filas=True, alto=1.8, giro_rotulo=180, fuente='serigrafia', paquete='SSOP de 18 patillas'),
    'Reg CGB': dict(tipo='ci', silk=True, entre_filas=True, alto=1.8, giro_rotulo=180, fuente='serigrafia', paquete='SSOP de 18 patillas'),
    'Crystal CGB': dict(tipo='conector', marcado_foto=True, cuerpo=[-2.3, -4.2, 2.3, 4.2], alto=2.0, color='#4a3c31', fuente='foto',
                        paquete='resonador cerámico'),
    'Cart CGB': dict(tipo='conector', lado='B', cuerpo=[-28.5, -13.5, 28.5, 2.0], alto=7.0, color='#1c1c1e',
                     fuente='foto', paquete='ranura del cartucho'),
    'Screen CGB': dict(tipo='conector', cuerpo=[-15.6, -2.9, 15.6, 0.6], alto=2.0, color='#ece6d6', fuente='foto',
                       paquete='conector FFC de 50 vías'),
    'Serial CGB': dict(tipo='conector', lado='B', cuerpo=[-6.5, -5.6, 2.5, 5.6], alto=7.0, color='#9fa4aa', metal=0.5,
                       rugosidad=0.4, fuente='foto', paquete='puerto de enlace'),
    'DCJACK': dict(tipo='conector', lado='B', cuerpo=[-4.0, -5.0, 4.0, 6.3], alto=5.5, color='#1c1c1e', fuente='foto',
                   paquete='toma de alimentación'),
    'HPjack': dict(tipo='conector', lado='B', cuerpo=[-6.2, -6.0, 6.2, 6.8], alto=5.0, color='#1c1c1e', fuente='foto',
                   paquete='toma de auriculares'),
    'Switch CGB': dict(tipo='interruptor', silk=True, margen=1.2, alto=3.5, palanca=2.6,
                       fuente='serigrafia', paquete='interruptor deslizante'),
    'Volume wheel CGB': dict(tipo='rueda', silk=True, margen=0.8, alto=2.0, diametro=13.0, grosor=2.4,
                             centro_desde_borde=4.2, fuente='serigrafia', paquete='potenciómetro de rueda'),
    'DC': dict(tipo='placa_hija', lado='F', cuerpo=[-10.5, -12.8, 10.5, 8.2], alto=1.0, z0=1.5, marcado='LSEP1018A1',
               fuente='foto', paquete='placa del convertidor CC-CC'),
}
# Footprints without a body: contacts of the buttons (the rubber is in the shell), battery contacts, the
# speaker's wire pads, a solder jumper.
SIN_CUERPO = {
    'Dpad CGB': 'contacto de la membrana: el botón de goma va en la carcasa',
    'AB CGB': 'contacto de la membrana: el botón de goma va en la carcasa',
    'Select CGB': 'contacto de la membrana: el botón de goma va en la carcasa',
    'Start CGB': 'contacto de la membrana: el botón de goma va en la carcasa',
    'Battery CGB': 'chapas de los contactos de las pilas: no se modelan',
    'TestPoint_2Pads_Pitch2.54mm_Drill0.8mm': 'pads de los cables del altavoz: el altavoz va en la carcasa',
    'SolderJumper-2_P1.3mm_Bridged_Pad1.0x1.5mm': 'puente de soldadura en el cobre',
}

NOTA_POS = 'Posición, giro y cara reconstruidos a partir de los pads del Gerber (cada pad lleva su referencia y su patilla)'
NOTA_CUERPO = {
    'huella': 'cuerpo de la huella «%s» del esquema (biblioteca de KiCad), con el alto típico del encapsulado',
    'serigrafia': 'cuerpo del contorno de la serigrafía (%s); el alto es supuesto',
    'foto': 'cuerpo aproximado a partir de las fotos (%s): medidas y alto supuestos',
    'ninguno': '%s',
}


def _ci_lib(f, lado, alto):
    """'ci' descriptor of a library IC footprint: body from its fabrication outline, leads over its pads."""
    box = P.fab_box(f, lado)
    patas = sorted(f['pads'], key=lambda p: (0, int(p['num'])) if p['num'].isdigit() else (1, 0))
    return {'tipo': 'ci', 'caja': [_r(v) for v in box], 'cuerpo': [_r(v) for v in box], 'alto': alto,
            'patas': [[_r(p['lx']), _r(p['ly']), _r(p['w']), _r(p['h'])] for p in patas]}


def reconstruir(pads_por_ref, comp, hotspots, silk, lado_de=None):
    """Placement of every reference with pads.

    pads_por_ref: {ref: [{'num', 'x', 'y', 'w', 'h', 'lados', 'tht'}…]} (board mm, y down)
    comp:         the schematic's components {ref: {'v', 'l'}}
    silk:         {'F': [[(x, y)…]…], 'B': …} silkscreen strokes (board mm)
    Returns {ref: {'x', 'y', 'a', 'lado', 't', 'l', 'lib', 'm', 'v', 'dnp'?, 'rec', 'ajuste'?}}.
    """
    out = {}
    for ref, pads in pads_por_ref.items():
        c = comp.get(ref, {})
        nombre = c.get('l', '')
        valor = c.get('v', '')
        if valor in ('~', 'DNP'):
            valor = '' if valor == '~' else valor
        tht = any(p['tht'] for p in pads)
        smd_lados = {l for p in pads if not p['tht'] for l in p['lados']}
        lado = 'B' if smd_lados == {'B'} else 'F' if smd_lados == {'F'} else None
        xs = [p['x'] for p in pads]
        ys = [p['y'] for p in pads]
        cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        r = {'v': valor, 'l': nombre or 'pads del Gerber', 'lib': '', 'x': cx, 'y': cy, 'a': 0.0, 'lado': lado or 'F',
             't': 'tht' if tht else 'smd'}
        if c.get('v') == 'DNP':
            r['dnp'] = True
        if nombre in SIN_CUERPO or not nombre:
            r.update(t='mec', m={'tipo': 'taladro', 'caja': [_r(min(xs) - cx - 0.5), _r(min(ys) - cy - 0.5), _r(max(xs) - cx + 0.5), _r(max(ys) - cy + 0.5)]},
                     rec={'pos': 'pads', 'cuerpo': 'ninguno', 'nota': 'Sin cuerpo: ' + SIN_CUERPO.get(nombre, 'el esquema no da su huella') + '.'})
            out[ref] = r
            continue
        f = huella_biblioteca(nombre)
        if f:
            lado = lado or ('F' if nombre.startswith('LED_') else 'B')
            if lado == 'B':
                f = _espejo(f)
            f['ref'], f['value'] = ref, valor
            por_num = {}
            for p in f['pads']:
                if p['type'] != 'np_thru_hole' and p['num']:
                    por_num.setdefault(p['num'], []).append(p)
            pares_l, pares_b = [], []
            gnum = {}
            for p in pads:
                gnum.setdefault(p['num'], []).append(p)
            for n, ls in por_num.items():
                if len(ls) == 1 and len(gnum.get(n, [])) == 1:
                    pares_l.append((ls[0]['lx'], ls[0]['ly']))
                    pares_b.append((gnum[n][0]['x'], gnum[n][0]['y']))
            if len(pares_l) >= 2:
                a, ox, oy, err = ajustar(pares_l, pares_b)
                renumerada = False
                if err > 0.05 and len(pares_l) >= 3:
                    r2 = ajustar_por_forma(pares_l, pares_b)
                    if r2[3] < err:
                        (a, ox, oy, err), renumerada = r2, True
                m = P.model_for(f)
                if ref.startswith('EM') and nombre.startswith(('R_0603', 'R_0805')):
                    m = {'tipo': 'ferrita_smd', 'caja': m['caja'], 'alto': 0.6 if '0603' in nombre else 0.85, 'texto': valor}
                elif nombre.startswith('CP_Elec_'):
                    dm = re.match(r'CP_Elec_(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)', nombre)
                    m = {'tipo': 'electrolitico_smd', 'caja': m['caja'], 'cuerpo': m['caja'], 'diametro': float(dm.group(1)),
                         'alto': float(dm.group(2)), 'texto': valor}
                elif nombre.startswith('D_SOD-323'):
                    m = {'tipo': 'diodo_smd', 'caja': m['caja'], 'cuerpo': [-0.85, -0.65, 0.85, 0.65], 'alto': 0.9, 'texto': valor}
                elif nombre.startswith(('SOT-', 'TSOP')):
                    m = _ci_lib(f, lado, {'SOT-323_SC-70': 0.9, 'SOT-363_SC-70-6': 0.9, 'SOT-23-5': 1.1}.get(nombre, 1.0))
                    mk = _marcado(hotspots, ref)
                    if mk:
                        m['marcado'] = mk
                elif nombre.startswith('R_Array'):
                    m = {'tipo': 'conector', 'caja': m['caja'], 'cuerpo': m['caja'], 'alto': 0.45, 'color': '#1d1d1f'}
                elif nombre.startswith('Fuse_'):
                    m = {'tipo': 'conector', 'caja': m['caja'], 'cuerpo': m['caja'], 'alto': 1.0, 'color': '#26262a'}
                elif nombre.startswith('Crystal_SMD') and valor.startswith('ACM'):
                    # a common-mode choke on a crystal's footprint: TDK ACM4532 body (4.5 × 3.2 × 2.8 mm, its datasheet)
                    m = {'tipo': 'conector', 'caja': [-2.25, -1.6, 2.25, 1.6], 'cuerpo': [-2.25, -1.6, 2.25, 1.6], 'alto': 2.8,
                         'color': '#2b2b2d'}
                r.update(x=ox, y=oy, a=a, lado=lado, l=nombre, lib=f['lib'].split(':')[0], m=m,
                         t='tht' if tht else 'smd', ajuste=err,
                         rec={'pos': 'pads', 'cuerpo': 'huella', 'nota': NOTA_POS + '; ' + NOTA_CUERPO['huella'] % nombre + '.'})
                if nombre.startswith('Crystal_SMD') and valor.startswith('ACM'):
                    r['rec']['nota'] = (NOTA_POS + '; el esquema le da la huella de un cristal; cuerpo de la hoja de datos del '
                                        'ACM4532 (4,5 × 3,2 × 2,8 mm).')
                if renumerada:
                    r['rec']['nota'] += (' Los números de sus pads en el Gerber no siguen los de esa huella (patillas renumeradas): '
                                         'se ha ajustado por la forma de los pads.')
                if nombre.startswith('LED_'):
                    r['rec']['nota'] += ' En la foto va doblado y tumbado hacia el borde; aquí, recto.'
                fab = []
                for L, kind, data, w, fill in f['graphics']:
                    if not L.endswith('.Fab'):
                        continue
                    if kind == 'circle':
                        (qx, qy), rr = data
                        fab.append(['c', round(qx * 100), round(qy * 100), round(rr * 100)])
                    else:
                        fab.append(['l'] + [round(v * 100) for pt in data for v in pt])
                r['fab'] = fab
                out[ref] = r
                continue
        cfg = PROPIAS.get(nombre)
        if not cfg:
            r.update(t='mec', m={'tipo': 'taladro', 'caja': [_r(min(xs) - cx), _r(min(ys) - cy), _r(max(xs) - cx), _r(max(ys) - cy)]},
                     rec={'pos': 'pads', 'cuerpo': 'ninguno', 'nota': 'Sin cuerpo: la huella «%s» no está en la biblioteca de KiCad.' % nombre})
            out[ref] = r
            continue
        lado = cfg.get('lado') or lado or 'B'
        caja = None
        fuente = cfg['fuente']
        if cfg.get('silk'):
            mg = cfg.get('margen', 0.0)
            hw = max(p['w'] for p in pads) / 2
            if cfg.get('entre_filas'):
                # the outline between two rows of pads (SSOP): inside the rows' inner edges, a little longer than them
                sb = _caja_silk(silk.get(lado, []), min(xs) + hw, min(ys) - 1.5, max(xs) - hw, max(ys) + 1.5)
            else:
                sb = _caja_silk(silk.get(lado, []), min(xs) - hw - mg, min(ys) - hw - mg, max(xs) + hw + mg, max(ys) + hw + mg)
            if sb:
                caja = [_r(sb[0] - cx), _r(sb[1] - cy), _r(sb[2] - cx), _r(sb[3] - cy)]
            else:
                fuente = 'pads'
        if caja is None:
            caja = cfg.get('cuerpo') or [_r(min(xs) - cx), _r(min(ys) - cy), _r(max(xs) - cx), _r(max(ys) - cy)]
        m = {'tipo': cfg['tipo'], 'caja': caja, 'cuerpo': caja, 'alto': cfg['alto']}
        for k in ('color', 'metal', 'rugosidad', 'z0', 'diametro', 'grosor', 'giro_rotulo'):
            if k in cfg:
                m[k] = cfg[k]
        if cfg['tipo'] == 'rueda':
            # the wheel's centre: on the arc of the outline, level with the middle of the pads
            m['centro'] = [_r(caja[0] + cfg['centro_desde_borde']), 0.0]
        if cfg['tipo'] == 'interruptor':
            # the slider sticks out of the body towards the board's edge (+x on this board, as in the photo)
            m['palanca'] = [_r(caja[2]), -1.5, _r(caja[2] + cfg['palanca']), 1.5]
        if cfg['tipo'] == 'ci':
            orden = sorted(pads, key=lambda p: (0, int(p['num'])) if p['num'].isdigit() else (1, 0))
            m['patas'] = [[_r(p['x'] - cx), _r(p['y'] - cy), _r(p['w']), _r(p['h'])] for p in orden if p['num']]
        mk = cfg.get('marcado') or _marcado(hotspots, ref)
        if mk:
            m['marcado'] = mk
        nota = NOTA_POS + '; ' + (NOTA_CUERPO[fuente] % cfg['paquete'] if fuente in NOTA_CUERPO else
                                  'cuerpo deducido de los pads (%s): alto supuesto' % cfg['paquete'])
        if mk and not cfg.get('marcado'):
            nota += '; rótulo leído en la foto'
        if cfg.get('marcado'):
            nota += '; rótulo leído en la foto de la cara de los botones'
        if tht:
            nota += '; cara del cuerpo según las fotos'
        r.update(lado=lado, m=m, t='tht' if tht else 'smd', rec={'pos': 'pads', 'cuerpo': fuente, 'nota': nota + '.'},
                 fab=[['l', round(caja[0] * 100), round(caja[1] * 100), round(caja[2] * 100), round(caja[1] * 100),
                       round(caja[2] * 100), round(caja[3] * 100), round(caja[0] * 100), round(caja[3] * 100),
                       round(caja[0] * 100), round(caja[1] * 100)]])
        out[ref] = r
    return out
