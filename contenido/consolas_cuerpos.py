"""3D bodies of the console boards' parts («Placa en 3D»): one descriptor `m` per footprint.

The boards' footprints come from hobbyist recreations whose footprint names are their own («Resistor1-5mm»,
«CAP3-5mm», «BF-2.5mm», «LSPC2», «CASSETTE»…), so proyectos_kicad_pcb.model_for, which knows the KiCad library
names, typed most of them as a plain `caja` (drawn as a grey box up to 0.9.2). 0.10 classifies them here:

  1. a table of the boards' own footprint names (and a few values) -> package, size and look;
  2. otherwise the package inferred from the pads: two pads (axial/radial/chip by pitch, technology and value),
     one row (SIP, connector), two rows at 2.54 mm (DIP and its row spacing), two SMD rows (SOIC/SOP), four sides
     (QFP), and a dark body sized from the outline for whatever is left (listed by `informe`);
  3. every IC gets its marking (`marcado`, «|» separates lines): the value, cleaned, or a per-board table when the
     value is a role name («CPU» -> «S-CPU» on the Super Nintendo).

Descriptors (all sizes in mm, footprint-local KiCad axes: x right, y down; drawn by web/src/componentes/proyectos/
modelos3d.ts, pad-based bodies take their pads' local positions from the board data):
  library models  resistencia_axial {valor, cuerpo (DIN size), paso}, condensador_disco {valor, diametro},
                  electrolitico {valor, diametro, alto, paso}, bobina_axial {valor, paso}, cristal {frecuencia,
                  cuerpo S|U}, dip {pines, ancho_filas, marcado}, soic {pines, marcado}: `giro_k` (degrees, KiCad
                  local) turns the library model so its pads 1 -> 2 run along the footprint's, `escala: false`
  own bodies      ci {cuerpo, alto, patas_pads, marcado, punto}, sip {alto, grosor, color, marcado}, axial {largo,
                  diametro, color, banda, vidrio, vertical}, radial {forma, ancho, fondo, alto, color, marcado},
                  chip {color, alto}, to92 {marcado}, to {encapsulado}, conector {cuerpo, alto, color, abertura,
                  frente, marcado}, lata {cuerpo, alto, marcado}, pulsador, deslizante, interruptor, trimmer_c,
                  bobina_tambor, puente_hilo, cristal_h, generico {cuerpo, alto}, sin_cuerpo {motivo}
  `clasif`: 'tabla' (name table), 'geometria' (inferred from the pads) or 'marcado' (only the marking added).
"""

import math
import re

# ------------------------------------------------------------------ values

SI = {'p': 1e-12, 'n': 1e-9, 'u': 1e-6, 'µ': 1e-6, 'm': 1e-3, 'k': 1e3, 'K': 1e3, 'M': 1e6, 'G': 1e9, 'R': 1.0, 'r': 1.0}


def valor(texto):
    """«4.7K», «1K5», «820», «0.18», «100nF», «470uF/16v», «10u 50V», «47uH» -> number (SI units) or None."""
    s = (texto or '').strip().split()[0] if (texto or '').strip() else ''
    s = s.split('/')[0].replace(',', '.').replace('Ω', '').replace('ohm', '').replace('Ohm', '')
    m = re.match(r'^(\d+)([pnuµmkKMGRr])(\d+)$', s)
    if m:
        return float('%.6g' % (float(m.group(1) + '.' + m.group(3)) * SI[m.group(2)]))
    m = re.match(r'^(\d+(?:\.\d+)?)([pnuµmkKMGRr]?)[FfHhΩAVW]?$', s)
    if m:
        return float('%.6g' % (float(m.group(1)) * (SI[m.group(2)] if m.group(2) else 1)))
    return None


def mhz(texto):
    """Frequency as a crystal or resonator prints it: «24.576», «4.00», «17.734» ('' if none)."""
    f = frecuencia(texto)
    if not f:
        return ''
    s = ('%.6f' % (f / 1e6)).rstrip('0')
    entero, dec = s.split('.')
    return entero + '.' + (dec + '00')[:max(2, len(dec))]


def capacidad(texto):
    """Capacitance in farads: «100nF», «39pF (CH)», «10pF(CH)», «272M» (EIA code 27·10² pF, tolerance M), «0.1u»."""
    t = re.sub(r'\(.*?\)', ' ', texto or '').strip()
    m = re.match(r'^(\d)(\d)(\d)[JKMZ]?$', t.split()[0] if t else '')
    if m:
        return float('%.6g' % (int(m.group(1) + m.group(2)) * 10 ** int(m.group(3)) * 1e-12))
    v = valor(t)
    if v is not None and re.search(r'[pnuµ]', t.split()[0] if t else ''):
        return v
    return None


def frecuencia(texto):
    m = re.search(r'(\d+(?:[.,]\d+)?)\s*MHz', texto or '', re.I)
    return float(m.group(1).replace(',', '.')) * 1e6 if m else None


# ------------------------------------------------------------------ pads in the footprint's own axes

def pads_locales(h, pads):
    """The footprint's pads in its local axes (mm, KiCad's), as escena3d.padsLocales computes them, with their
    size turned into those axes and their kind (tht, npth)."""
    an = math.radians(-h['a'])
    out = []
    for p in pads[h['pads'][0]:h['pads'][0] + h['pads'][1]]:
        dx, dy = p[3] - h['x'], p[4] - h['y']
        lx = round(dx * math.cos(an) + dy * math.sin(an)) / 100
        ly = round(-dx * math.sin(an) + dy * math.cos(an)) / 100
        w, hh = p[5] / 100, p[6] / 100
        if round(((p[7] - h['a']) % 180)) == 90:
            w, hh = hh, w
        out.append({'n': p[1], 'x': lx, 'y': ly, 'w': w, 'h': hh, 'tht': bool(p[11] & 4), 'npth': bool(p[11] & 8),
                    'taladro': p[9] / 100})
    return out


def numerados(P):
    return [p for p in P if p['n'] not in ('',) and not p['npth']]


def nat(n):
    return [(0, int(t), '') if t.isdigit() else (1, 0, t) for t in re.split(r'(\d+)', n)]


def caja_pads(P, k=0.0):
    return [round(min(p['x'] - p['w'] / 2 for p in P) - k, 3), round(min(p['y'] - p['h'] / 2 for p in P) - k, 3),
            round(max(p['x'] + p['w'] / 2 for p in P) + k, 3), round(max(p['y'] + p['h'] / 2 for p in P) + k, 3)]


def caja_centros(P, kx=0.0, ky=None):
    ky = kx if ky is None else ky
    return [round(min(p['x'] for p in P) - kx, 3), round(min(p['y'] for p in P) - ky, 3),
            round(max(p['x'] for p in P) + kx, 3), round(max(p['y'] for p in P) + ky, 3)]


def giro(P):
    """Angle (degrees, local KiCad axes) of the line from the first to the second numbered pad."""
    ps = sorted(numerados(P), key=lambda p: nat(p['n']))
    if len(ps) < 2:
        return 0.0
    a, b = ps[0], ps[1]
    return round(math.degrees(math.atan2(b['y'] - a['y'], b['x'] - a['x'])), 2)


def paso2(P):
    ps = numerados(P)
    return round(math.hypot(ps[1]['x'] - ps[0]['x'], ps[1]['y'] - ps[0]['y']), 3) if len(ps) >= 2 else 0.0


def filas(P, tol=0.3):
    """Rows of pad centres: ('x', [y values]) when the pads sit on lines of constant y, ('y', [x…]) else."""
    def grupos(vals):
        vals = sorted(vals)
        gs = [[vals[0]]]
        for v in vals[1:]:
            if v - gs[-1][-1] <= tol:
                gs[-1].append(v)
            else:
                gs.append([v])
        return [sum(g) / len(g) for g in gs]
    ys = grupos([p['y'] for p in P])
    xs = grupos([p['x'] for p in P])
    return xs, ys


def lados(P, tol=0.4):
    """Pads of a quad package by side: {'izq', 'der', 'arr', 'aba'} -> pads (on the outermost line of each side)."""
    x0, x1 = min(p['x'] for p in P), max(p['x'] for p in P)
    y0, y1 = min(p['y'] for p in P), max(p['y'] for p in P)
    out = {'izq': [], 'der': [], 'arr': [], 'aba': []}
    for p in P:
        if abs(p['x'] - x0) < tol:
            out['izq'].append(p)
        elif abs(p['x'] - x1) < tol:
            out['der'].append(p)
        elif abs(p['y'] - y0) < tol:
            out['arr'].append(p)
        elif abs(p['y'] - y1) < tol:
            out['aba'].append(p)
    return out


# ------------------------------------------------------------------ markings

# Per-board markings where the value is a role name, not what the part says (from the console's own notes: the
# Super Nintendo hotspots name «CPU 5A22 (S-CPU)», «PPU1 5C77 (S-PPU1)»…; the Neo Geo board's notice names the
# LSPC2-A2; the PAL console's lockout chip is the F413; the NES photo's CIC reads «Nintendo 3193A»).
MARCADOS = {
    'nes': {'U10': '3193A'},
    'snes': {'U1': 'S-CPU|5A22', 'U2': 'S-PPU1|5C77', 'U3': 'S-PPU2|5C78', 'U6': 'S-WRAM', 'U8': 'F413'},
    'neogeo': {'U21': 'LSPC2-A2'},
    'gb-superdmg': {'U1': 'DMG-CPU'},
    'gbc-opengbc': {'U1': 'CPU CGB'},
}


def marcado_de(h, ctx):
    """The text printed on an IC: the board's table, else its value cleaned (the schematic's when the board has
    none); '' when there is nothing honest to print."""
    t = MARCADOS.get(ctx.get('placa', ''), {}).get(h['r'])
    if t:
        return t
    v = (h.get('v') or '').strip()
    if v in ('', '~') or re.fullmatch(r'U\d+|IC\d*', v):
        # the schematic's value, or its symbol's name («CXA1145P/M» for the Mega Drive's U13)
        c = ctx.get('componentes', {}).get(h['r'], {}) or {}
        v = c.get('v', '') or ''
        if v.strip() in ('', '~'):
            v = c.get('l', '') or ''
    v = v.strip()
    if v in ('', '~'):
        return ''
    # «5863 / 5814», «6116 (WRAM)», «RP2A03 CPU», «LD1117S33TR_SOT223», «GameBoy_CPU_CGB_KF2007»
    v = re.split(r'\s*/\s*|\s+\(|\s+(?=[A-Z]{3,}$)', v)[0].strip()
    v = re.sub(r'_(SOT|SOIC|TSSOP|DIP|QFP)\w*$', '', v)
    v = re.sub(r'TR$', '', v) if re.search(r'\d{2}TR$', v) else v
    return v[:16]


# ------------------------------------------------------------------ helpers for the table

def sin(motivo):
    return {'tipo': 'sin_cuerpo', 'motivo': motivo}


def lib2(tipo, P, **kw):
    """A two-lead library model turned onto the footprint's pads."""
    return dict({'tipo': tipo, 'giro_k': giro(P), 'escala': False, 'paso': paso2(P), 'de_pads': True}, **kw)


def resistencia(h, P, ctx):
    p = paso2(P)
    din = '0204' if p < 7 else '0207' if p < 12 else '0309' if p < 15 else '0414' if p < 19 else '0617'
    v = valor(h['v'])
    if not v:
        return puente(h, P, ctx) if (h['v'] or '').strip() in ('0', '0R') else axial(h, P, ctx, color='#d9c18e')
    return lib2('resistencia_axial', P, valor=v, cuerpo=din, texto=h['v'])


def puente(h, P, ctx):
    return {'tipo': 'puente_hilo', 'de_pads': True}


def disco(h, P, ctx):
    p = paso2(P)
    return lib2('condensador_disco', P, valor=capacidad(h['v']) or 100e-9, diametro=4 if p < 3.5 else 5, texto=h['v'])


def electrolitico(h, P, ctx, diametro=None, alto=None):
    p = paso2(P)
    c = capacidad(h['v']) or 10e-6
    if diametro is None:
        diametro = 5.0 if p < 2.3 else 6.3 if p < 3.0 else 8.0 if p < 4.0 else 10.0 if p < 6.5 else 12.5
    if alto is None:
        alto = {5.0: 11.0, 6.3: 11.0, 8.0: 11.5, 10.0: 16.0, 12.5: 20.0}.get(diametro, diametro * 1.6)
    return lib2('electrolitico', P, valor=c, diametro=diametro, alto=alto, texto=h['v'])


def bobina(h, P, ctx):
    return lib2('bobina_axial', P, valor=valor(h['v']) or 47e-6, texto=h['v'])


def axial(h, P, ctx, color='#1d1d1f', largo=None, diametro=None, banda=None, vidrio=False, vertical=False):
    p = paso2(P)
    largo = largo or round(min(max(2.0, p - 2.4), 9.5), 2)
    diametro = diametro or round(min(3.0, largo * 0.42), 2)
    smd = not all(q['tht'] for q in numerados(P))
    return {'tipo': 'axial', 'de_pads': True, 'paso': p, 'largo': largo, 'diametro': diametro, 'color': color,
            'banda': banda, 'vidrio': vidrio, 'vertical': vertical, 'smd': smd or None}


def radial(forma, ancho, fondo, alto, color, marcado='', z0=0.8, color_texto='#e6e6e0', **kw):
    return dict({'tipo': 'radial', 'de_pads': True, 'forma': forma, 'ancho': ancho, 'fondo': fondo, 'alto': alto,
                 'color': color, 'marcado': marcado, 'z0': z0, 'color_texto': color_texto}, **kw)


def chip(color, alto, extremos='#c9cdd1', marcado=''):
    return {'tipo': 'chip', 'de_pads': True, 'color': color, 'alto': alto, 'extremos': extremos, 'marcado': marcado}


def sip(h, P, ctx, color='#1d1d1f', alto=5.0, grosor=2.4, color_texto='#e6e6e0'):
    return {'tipo': 'sip', 'de_pads': True, 'color': color, 'alto': alto, 'grosor': grosor, 'marcado': marcado_de(h, ctx),
            'color_texto': color_texto}


def frente(ctx, cx=0.0, cy=0.0):
    """Unit vector (local KiCad axes) from the body towards the nearest board edge: the face of a jack or a port."""
    W, H = ctx['ancho'], ctx['alto']
    a = math.radians(ctx['a'])
    # body centre on the board (KiCad axes: local = R(-a) · global, so global = R(a) · local)
    gx = ctx['x'] + cx * math.cos(a) + cy * math.sin(a)
    gy = ctx['y'] - cx * math.sin(a) + cy * math.cos(a)
    d = [(gx, (-1, 0)), (W - gx, (1, 0)), (gy, (0, -1)), (H - gy, (0, 1))]
    _, (ux, uy) = min(d, key=lambda t: t[0])
    an = math.radians(-ctx['a'])
    lx = ux * math.cos(an) + uy * math.sin(an)
    ly = -ux * math.sin(an) + uy * math.cos(an)
    return [round(lx, 3), round(ly, 3)]


def conector(caja, alto, color='#1c1c1e', abertura=None, ctx=None, marcado='', z0=0.0, **kw):
    m = dict({'tipo': 'conector', 'cuerpo': caja, 'alto': alto, 'color': color, 'z0': z0}, **kw)
    if marcado:
        m['marcado'] = marcado
    if abertura:
        m['abertura'] = abertura
        if abertura.get('cara') == 'frente' and ctx is not None:
            m['frente'] = frente(ctx, (caja[0] + caja[2]) / 2, (caja[1] + caja[3]) / 2)
    return m


def lata(caja, alto, marcado='', color='#c3c7cc'):
    return {'tipo': 'lata', 'cuerpo': caja, 'alto': alto, 'marcado': marcado, 'color': color}


def centro_de(P):
    ps = numerados(P) or P
    return [round(sum(p['x'] for p in ps) / len(ps), 3), round(sum(p['y'] for p in ps) / len(ps), 3)]


def caja_en(cx, cy, w, d):
    return [round(cx - w / 2, 3), round(cy - d / 2, 3), round(cx + w / 2, 3), round(cy + d / 2, 3)]


def cuerpo_ci(P, ancho=None, largo=None, margen=0.4):
    """Body box of a gull-wing package: from the name's size (ancho across the rows, largo along them) when it
    gives one, else inside the pads' inner ends by `margen` on every side that has pads."""
    ps = numerados(P)
    L = lados(ps)
    x0, x1 = min(p['x'] for p in ps), max(p['x'] for p in ps)
    y0, y1 = min(p['y'] for p in ps), max(p['y'] for p in ps)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    cuatro = all(len(v) >= 2 for v in L.values())
    xs, ys = filas(ps)
    filas_x = len(ys) == 2 and not cuatro      # two rows of constant y (pads along x)
    if ancho and largo:
        if cuatro:
            bw, bd = (largo, ancho) if (x1 - x0) >= (y1 - y0) else (ancho, largo)
        else:
            bw, bd = (largo, ancho) if filas_x else (ancho, largo)
        return caja_en(cx, cy, bw, bd)

    if cuatro:
        # `margen` inside the inner ends of the pads of each side
        bx0 = max(p['x'] + p['w'] / 2 for p in L['izq']) + margen
        bx1 = min(p['x'] - p['w'] / 2 for p in L['der']) - margen
        by0 = max(p['y'] + p['h'] / 2 for p in L['arr']) + margen
        by1 = min(p['y'] - p['h'] / 2 for p in L['aba']) - margen
        return [round(bx0, 3), round(by0, 3), round(bx1, 3), round(by1, 3)]
    if filas_x:
        arriba = [p for p in ps if abs(p['y'] - y0) < 0.4]
        abajo = [p for p in ps if abs(p['y'] - y1) < 0.4]
        by0 = max(p['y'] + p['h'] / 2 for p in arriba) + margen
        by1 = min(p['y'] - p['h'] / 2 for p in abajo) - margen
        return [round(x0 - 1.0, 3), round(by0, 3), round(x1 + 1.0, 3), round(by1, 3)]
    izq = [p for p in ps if abs(p['x'] - x0) < 0.4]
    der = [p for p in ps if abs(p['x'] - x1) < 0.4]
    bx0 = max(p['x'] + p['w'] / 2 for p in izq) + margen
    bx1 = min(p['x'] - p['w'] / 2 for p in der) - margen
    return [round(bx0, 3), round(y0 - 1.0, 3), round(bx1, 3), round(y1 + 1.0, 3)]


def ci(h, P, ctx, ancho=None, largo=None, alto=2.7, margen=0.4, color='#1b1b1d', **kw):
    return dict({'tipo': 'ci', 'cuerpo': cuerpo_ci(P, ancho, largo, margen), 'alto': alto, 'color': color,
                 'patas_pads': True, 'marcado': marcado_de(h, ctx)}, **kw)


def dims_nombre(nombre):
    """«PQFP-100_14x20mm», «SO-14_3.9x8.65mm», «QFP-160_28x28» -> (14, 20)…"""
    m = re.search(r'_(\d+(?:[.,]\d+)?)x(\d+(?:[.,]\d+)?)(?:mm)?(?:_|$)', nombre)
    return (float(m.group(1).replace(',', '.')), float(m.group(2).replace(',', '.'))) if m else (None, None)


def dip(h, P, ctx):
    ps = numerados(P)
    xs, ys = filas(ps, 0.6)
    sep = round(abs(xs[-1] - xs[0]) if len(xs) == 2 else abs(ys[-1] - ys[0]), 2)
    n = len({p['n'] for p in ps})
    return {'tipo': 'dip', 'pines': n, 'ancho_filas': sep, 'zocalo': False, 'marcado': marcado_de(h, ctx), 'de_pads': True}


def to92(h, P, ctx):
    return {'tipo': 'to92', 'de_pads': True, 'marcado': (h.get('v') or '').split()[0][:10]}


# ------------------------------------------------------------------ the boards' own footprint names

def _cristal_h(h, P, ctx):
    """HC-49/U lying flat, from its two leads towards its hold-down clips (pads «0», Neo Geo), or over its body
    pad (OpenTendo's «1EP» footprint)."""
    leads = sorted([p for p in numerados(P) if p['n'] in ('1', '2')], key=lambda p: nat(p['n']))
    otros = [p for p in P if p not in leads]
    grande = [p for p in otros if p['w'] > 5 and p['h'] > 5]
    if grande:
        g = grande[0]
        cuerpo = [round(g['x'] - g['w'] / 2, 3), round(g['y'] - g['h'] / 2, 3), round(g['x'] + g['w'] / 2, 3),
                  round(g['y'] + g['h'] / 2, 3)]
    else:
        lx = sum(p['x'] for p in leads) / 2
        ly = sum(p['y'] for p in leads) / 2
        oy = sum(p['y'] for p in otros) / max(1, len(otros))
        s = 1 if oy > ly else -1
        y0, y1 = ly + s * 1.2, ly + s * 1.2 + s * 13.5
        cuerpo = [round(lx - 5.5, 3), round(min(y0, y1), 3), round(lx + 5.5, 3), round(max(y0, y1), 3)]
    return {'tipo': 'cristal_h', 'de_pads': True, 'cuerpo': cuerpo, 'alto': 4.65, 'marcado': mhz(h['v'])}


def _hc49_vertical(h, P, ctx):
    f = frecuencia(h['v'])
    return lib2('cristal', P, frecuencia=f or 16e6, cuerpo='S' if '4H' in h['l'] or 'HC49S' in h['l'] else 'U')


def _transistor(h, P, ctx):
    return to92(h, P, ctx)


def _fila_conector(h, P, ctx, alto, color, k=1.2, abertura=None, marcado=''):
    return conector(caja_pads(numerados(P) or P, k), alto, color, abertura=abertura, ctx=ctx, marcado=marcado)


def _caja_o_pads(h, P, k=0.5):
    """The footprint's outline when it covers its pads, else the pads' box."""
    c = h['m'].get('caja')
    cp = caja_pads(numerados(P) or P, k)
    if c and (c[2] - c[0]) * (c[3] - c[1]) >= 0.5 * (cp[2] - cp[0]) * (cp[3] - cp[1]) and c[0] <= cp[0] + 1 and \
            c[2] >= cp[2] - 1 and c[1] <= cp[1] + 1 and c[3] >= cp[3] - 1:
        return c
    return cp


TABLA = [
    # --- no body: marks, holes, logos, test pads, solder jumpers, card-edge fingers
    (r'^(MARK|HOLE2?|SNK|NeoMadeInJapan|BoardFolk|OSHW-Logo.*)$', lambda h, P, c: sin('marca, taladro o logotipo')),
    (r'^TestPoint_Pad', lambda h, P, c: sin('punto de prueba (solo el pad)')),
    (r'^J2$', lambda h, P, c: sin('puente de soldadura')),
    (r'^Expansion$|^AVOut_Internal$', lambda h, P, c: sin('contactos del borde de la placa')),
    # --- Neo Geo (Board Folk's footprints)
    (r'^Resistor1-5mm$|^R76$|^R83$|^R77$', resistencia),
    (r'^PAL$', puente),
    (r'^CAP3-5mm$', disco),
    (r'^CAP2-2\.5mm$', lambda h, P, c: electrolitico(h, P, c, 5.0, 11.0)),
    (r'^CAP1-5mm$', lambda h, P, c: electrolitico(h, P, c, 10.0, 16.0)),
    (r'^CAP4-Large$', lambda h, P, c: electrolitico(h, P, c, 10.0, 20.0)),
    # TDK ZBF253D: a dark grey ferrite bead on two radial leads
    (r'^BF-2\.5mm$', lambda h, P, c: radial('caja', 3.6, 2.3, 4.2, '#3a3b3e', z0=0.6)),
    (r'^(R_Array_SIP\d+|RN2|CX23065A)$', lambda h, P, c: sip(h, P, c)),
    # HD68HC000P and YM2610: shrink DIP-64 (1.778 mm pitch)
    (r'^68000$', dip),
    (r'^Transistor$|^PST518B$', _transistor),
    # 2SA1442: the larger TO-92L body
    (r'^Q15$', lambda h, P, c: dict(to92(h, P, c), tamano='L')),
    (r'^Diode-Big$', lambda h, P, c: axial(h, P, c, '#1d1d1f', 9.5, 5.3, banda='#c9cdd1')),
    (r'^Diode$|^Diode_RD$', lambda h, P, c: axial(h, P, c, '#d9822b', 3.8, 1.9, banda='#1d1d1f', vidrio=True)),
    (r'^SOD-70_P2\.54mm$', lambda h, P, c: to92(h, P, c)),
    (r'^Crystal$', _cristal_h),
    (r'^(Inductor-Large|Inductor|L1)$', bobina),
    (r'^TC$|^TrimmerCap-THT$|^SurftrimGKG$', lambda h, P, c: {'tipo': 'trimmer_c', 'de_pads': True,
                                                              'diametro': 6.0 if paso2(P) >= 5 else 4.5,
                                                              'color': '#2f5fae' if 'Surftrim' in h['l'] else '#d8c27a'}),
    (r'^T1$', lambda h, P, c: {'tipo': 'bobina_tambor', 'de_pads': True, 'cuerpo': caja_centros(numerados(P), 0.8),
                               'alto': 7.5, 'color': '#2b2b2d'}),
    (r'^LED$', lambda h, P, c: radial('led', 3.0, 3.0, 4.6, '#c62828', z0=1.5)),
    (r'^CN1-2$', lambda h, P, c: conector(caja_pads(P, 1.0), 12.0, '#202022',
                                          abertura={'cara': 'frente', 'forma': 'dsub'}, ctx=c)),
    (r'^CN4-5$', lambda h, P, c: conector(caja_pads(P, 0.5), 11.0, '#1a1a1c',
                                          abertura={'cara': 'arriba', 'forma': 'ranura'})),
    (r'^CN6$', lambda h, P, c: conector(caja_pads(P, 0.3), 8.5, '#2a2b2e',
                                        abertura={'cara': 'frente', 'forma': 'ranura'}, ctx=c)),
    (r'^CN3$', lambda h, P, c: conector(caja_pads(numerados(P), 1.6), 13.0, '#1a1a1c',
                                        abertura={'cara': 'frente', 'forma': 'redonda'}, ctx=c)),
    (r'^J3$|^J4$', lambda h, P, c: conector(caja_pads(numerados(P), 1.4), 10.5 if h['l'] == 'J4' else 6.0, '#1a1a1c',
                                            abertura={'cara': 'frente', 'forma': 'redonda'}, ctx=c)),
    (r'^SW2$', lambda h, P, c: _deslizador(h, P, c, 'interruptor')),
    (r'^SW1$', lambda h, P, c: {'tipo': 'pulsador', 'de_pads': True, 'cuerpo': caja_centros(numerados(P), 3.0, 1.5),
                                'alto': 5.0, 'color': '#1d1d1f', 'boton': 'redondo', 'color_boton': '#3a3a3c'}),
    (r'^RV1$', lambda h, P, c: _deslizador(h, P, c, 'deslizante')),
    (r'^HeadphoneVolumeSlider$', lambda h, P, c: _deslizador(h, P, c, 'deslizante')),
    # --- Super Nintendo (nonSNES)
    (r'^SC-59$', lambda h, P, c: dict(ci(h, P, c, 1.5, 2.9, 1.1, color='#1d1d1f'), marcado='', punto=False)),
    (r'^C_Elec_(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)', lambda h, P, c: _smd_elec(h, P)),
    (r'^C_Axial_', lambda h, P, c: axial(h, P, c, '#6f9fd8', *_ld(h['l']))),
    (r'^Controller$', lambda h, P, c: conector(caja_pads(numerados(P), 2.5), 12.0, '#2f3033',
                                               abertura={'cara': 'frente', 'forma': 'rect'}, ctx=c)),
    (r'^JST_ZE_|^JST_PH_|^PowerReset-switch-In$', lambda h, P, c: _fila_conector(h, P, c, 5.5 if 'PH_S' in h['l'] else 6.0, '#ece6d6', 1.0)),
    (r'^Fuse$', lambda h, P, c: axial(h, P, c, '#cfd8dc', 15.0, 4.6, vidrio=True)),
    (r'^D_3220_', lambda h, P, c: chip('#2e4a6b', 2.8, '#b8bcc2')),
    (r'^Fuse_1210_|^L_1210|^Fuse_0603', lambda h, P, c: chip('#2b2b2d', 1.6)),
    (r'^SO-(\d+)_', lambda h, P, c: ci(h, P, c, *dims_nombre(h['l']), alto=1.6)),
    (r'^SW_Cherry_MX', lambda h, P, c: {'tipo': 'pulsador', 'de_pads': True, 'cuerpo': caja_en(-2.54, 5.08, 15.6, 15.6),
                                        'alto': 11.6, 'color': '#2a2a2c', 'boton': 'cruz', 'color_boton': '#7a4a2a'}),
    (r'^Crystal_HC49-(4H|U)_Vertical', _hc49_vertical),
    (r'^Crystal_HC49-U_Horizontal', _cristal_h),
    (r'^Resonator', lambda h, P, c: radial('caja', round(paso2(P) * (len(numerados(P)) - 1) + 2.2, 2), 2.6, 5.5,
                                             '#c87a33' if 'EM' not in h['r'] else '#4f6f96', z0=0.8,
                                             marcado=mhz(h['v']))),
    (r'^DcJack$', lambda h, P, c: conector(caja_pads(numerados(P), 1.0), 11.0, '#1a1a1c',
                                           abertura={'cara': 'frente', 'forma': 'redonda'}, ctx=c)),
    (r'^AVOut', lambda h, P, c: conector(caja_pads(numerados(P), 1.5), 11.0, '#2a2b2e',
                                         abertura={'cara': 'frente', 'forma': 'rect'}, ctx=c)),
    (r'^EXPANSION$|^EXP_Header$', lambda h, P, c: conector(caja_pads(P, 1.0), 7.0, '#1c1c1e',
                                                           abertura={'cara': 'arriba', 'forma': 'ranura'})),
    (r'^L_CommonMode', lambda h, P, c: {'tipo': 'bobina_tambor', 'de_pads': True, 'cuerpo': caja_centros(numerados(P), 0.2, 1.4),
                                        'alto': 5.0, 'color': '#2b2b2d'}),
    (r'^CASSETTE$', lambda h, P, c: conector(caja_pads(numerados(P), 3.0), 16.0, '#1c1c1e',
                                             abertura={'cara': 'arriba', 'forma': 'ranura'})),
    (r'^ResetSwitch$', lambda h, P, c: {'tipo': 'pulsador', 'de_pads': True, 'cuerpo': caja_centros(numerados(P), 1.2),
                                        'alto': 7.0, 'color': '#1d1d1f', 'boton': 'cuadrado', 'color_boton': '#8a8c90'}),
    (r'^RFModulator$|^Mod_RF$|^RFmod$', lambda h, P, c: lata(_caja_o_pads(h, P, 1.5), 13.0 if h['l'] != 'RFmod' else 15.0)),
    # round bridge rectifier (W04-like) over its four leads
    (r'^FullBridgeRectifier$', lambda h, P, c: radial('cilindro', 8.6, 8.6, 5.5, '#202124', z0=1.0, centro=centro_de(P))),
    # --- Mega Drive (stonedDiscord)
    (r'^LairdTech_28C0236', lambda h, P, c: axial(h, P, c, '#55575c', 6.0, 3.5)),
    (r'^D_A-405_P5\.08mm_Vertical', lambda h, P, c: axial(h, P, c, '#1d1d1f', 5.2, 2.7, banda='#c9cdd1', vertical=True)),
    (r'^DSUB-9_', lambda h, P, c: conector(h['m']['caja'], 12.5, '#202022',
                                           abertura={'cara': 'frente', 'forma': 'dsub'}, ctx=c)),
    (r'^ZIP-(\d+)', lambda h, P, c: sip(h, P, c, alto=9.0, grosor=3.2)),
    (r'^QFP-(\d+)_|^QFP(\d+)$', lambda h, P, c: ci(h, P, c, *dims_nombre(h['l']), alto=3.2)),
    (r'^SW_Tactile', lambda h, P, c: {'tipo': 'pulsador', 'de_pads': True, 'cuerpo': caja_centros(numerados(P), 0.0),
                                      'alto': 5.0, 'color': '#1d1d1f', 'boton': 'redondo', 'color_boton': '#2a2a2c'}),
    (r'^Oscillator_DIP-14$', lambda h, P, c: lata(caja_centros(numerados(P), 2.6), 6.0, marcado_de(h, c))),
    (r'^SEGA_2x32_Female', lambda h, P, c: conector(caja_pads(P, 0.5), 10.0, '#1c1c1e',
                                                    abertura={'cara': 'arriba', 'forma': 'ranura'})),
    (r'^DIN8Video$', lambda h, P, c: conector(caja_pads(numerados(P), 1.0), 13.0, '#1a1a1c',
                                              abertura={'cara': 'frente', 'forma': 'redonda'}, ctx=c)),
    (r'^SW_E-Switch', lambda h, P, c: dict(conector(caja_pads(P, 0.4), 6.0, '#202124'), tipo='interruptor',
                                           palanca=None)),
    # --- NES (OpenTendo)
    (r'^NES_Edge_Connector$', lambda h, P, c: conector(caja_pads(numerados(P), 1.0), 9.0, '#1c1c1e',
                                                       abertura={'cara': 'arriba', 'forma': 'ranura'})),
]


def _ld(nombre):
    m = re.search(r'_L(\d+(?:\.\d+)?)mm_D(\d+(?:\.\d+)?)mm', nombre)
    return (float(m.group(1)), float(m.group(2))) if m else (None, None)


def _smd_elec(h, P):
    m = re.match(r'^C_Elec_(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)', h['l'])
    d, a = float(m.group(1)), float(m.group(2))
    c = [p for p in numerados(P)]
    cx = sum(p['x'] for p in c) / len(c)
    cy = sum(p['y'] for p in c) / len(c)
    return {'tipo': 'electrolitico_smd', 'diametro': d, 'alto': a, 'cuerpo': caja_en(cx, cy, d + 0.3, d + 0.3)}


def _deslizador(h, P, c, tipo):
    """Slide switch / slide potentiometer: a long box over its pins (Neo Geo SW2 and RV1, Mega Drive RV1)."""
    ps = numerados(P)
    cx0 = caja_centros(ps, 1.2)
    if tipo == 'interruptor':
        w, d = cx0[2] - cx0[0], cx0[3] - cx0[1]
        larga_x = w >= d
        cxm, cym = (cx0[0] + cx0[2]) / 2, (cx0[1] + cx0[3]) / 2
        cuerpo = caja_en(cxm, cym, w, max(d, 5.0)) if larga_x else caja_en(cxm, cym, max(w, 5.0), d)
        pal = caja_en(cxm - (w * 0.15 if larga_x else 0), cym - (0 if larga_x else d * 0.15), 3.0 if larga_x else 2.0,
                      2.0 if larga_x else 3.0)
        return {'tipo': 'interruptor', 'cuerpo': cuerpo, 'alto': 6.0, 'color': '#202124', 'palanca': pal}
    w, d = cx0[2] - cx0[0], cx0[3] - cx0[1]
    cxm, cym = (cx0[0] + cx0[2]) / 2, (cx0[1] + cx0[3]) / 2
    larga_x = w >= d
    cuerpo = caja_en(cxm, cym, w, max(d, 6.0)) if larga_x else caja_en(cxm, cym, max(w, 6.0), d)
    return {'tipo': 'deslizante', 'cuerpo': cuerpo, 'alto': 7.0, 'color': '#b9bdc2'}


# ------------------------------------------------------------------ inference from the pads

def inferir(h, P, ctx):
    """Package from the pads' geometry, for a footprint name no table knows."""
    ps = numerados(P)
    if not ps:
        return sin('sin pads numerados')
    if len({p['n'] for p in ps}) == 1:
        return sin('un solo contacto')
    tht = all(p['tht'] for p in ps)
    v = h.get('v') or ''
    ref = re.match(r'^[A-Z]+', h['r'] or '')
    ref = ref.group(0) if ref else ''
    n = len({p['n'] for p in ps})
    if n == 2:
        p = paso2(P)
        if not tht:
            w = max(abs(ps[0]['x'] - ps[1]['x']), abs(ps[0]['y'] - ps[1]['y']))
            return chip('#2b2b2d' if ref in ('L', 'FB', 'F') else '#b48a5a' if ref == 'C' else '#1d1d1f', round(min(1.6, 0.4 + w * 0.25), 2))
        val = valor(v)
        if ref == 'R' or re.search(r'(?i)^\d+(\.\d+)?[kKmMR]?\d*$', v.strip()):
            return resistencia(h, P, ctx)
        if ref in ('C', 'CP') or re.search(r'[pnuµ]F?\b', v):
            if val and val >= 1e-6:
                return electrolitico(h, P, ctx)
            return disco(h, P, ctx)
        if ref in ('L',):
            return bobina(h, P, ctx)
        if ref in ('D', 'ZD'):
            return axial(h, P, ctx, '#1d1d1f', banda='#c9cdd1')
        return radial('caja', max(2.5, p + 1.2), 2.5, 4.0, '#2a2b2e', z0=0.8)
    xs, ys = filas(ps, 0.6)
    L = lados(ps)
    cuatro = all(len(x) >= 3 for x in L.values())
    if cuatro and not tht:
        return ci(h, P, ctx, alto=3.0)
    if (len(xs) == 2 or len(ys) == 2) and n >= 4:
        sep = abs(xs[-1] - xs[0]) if len(xs) == 2 else abs(ys[-1] - ys[0])
        paso = sorted({round(abs(a['x'] - b['x']) + abs(a['y'] - b['y']), 2) for a in ps for b in ps if a is not b})[0]
        if tht and (abs(paso - 2.54) < 0.15 or abs(paso - 1.778) < 0.1) and sep > 6 and ref in ('U', 'IC'):
            return dip(h, P, ctx)
        if not tht and paso <= 1.3 and ref in ('U', 'IC'):
            return ci(h, P, ctx, alto=1.8)
        return conector(caja_pads(ps, 1.0), 8.5 if tht else 4.0, '#1c1c1e')
    if len(xs) == 1 or len(ys) == 1:
        if ref in ('U', 'IC', 'RA', 'RN', 'CR', 'DA', 'Q'):
            return sip(h, P, ctx)
        return conector(caja_pads(ps, 1.0), 8.5, '#1c1c1e')
    return {'tipo': 'generico', 'cuerpo': _caja_o_pads(h, P, 0.5), 'alto': 3.0}


# ------------------------------------------------------------------ the classifier

TIPOS_CI = ('ci', 'soic', 'dip', 'sip', 'lata')


def clasificar(h, P, ctx):
    """New descriptor for footprint `h` (its pads `P` in local axes), or None to keep the one it has.
    ctx: {'placa': id, 'ancho', 'alto' (board, mm), 'x', 'y' (footprint origin on the board, mm), 'a' (degrees),
    'componentes': the console schematic's parts}."""
    m0 = h['m']
    nombre = h['l']
    origen = m0.get('clasif')
    nuevo = None
    if origen != 'marcado' and (m0['tipo'] == 'caja' or origen in ('tabla', 'geometria')):
        for rx, fn in TABLA:
            if re.match(rx, nombre):
                nuevo = dict(fn(h, P, ctx), clasif='tabla')
                break
        else:
            if m0['tipo'] == 'caja' or origen == 'geometria':
                nuevo = dict(inferir(h, P, ctx), clasif='geometria')
    if nuevo is None and m0['tipo'] in ('ci', 'soic', 'dip') and (origen is None or origen == 'marcado'):
        # an IC already typed: only its marking (and leads from the pads when it had none)
        mk = marcado_de(h, ctx)
        pequeno = re.match(r'^(SOT|SC-70|SOT-323|SOT-363|D_SOD)', nombre) or len(numerados(P)) < 6
        nuevo = dict(m0, clasif='marcado')
        # a marking the board data already had (read from a photo: the CGB-CPU-04) stays; ours is recomputed
        dado = m0.get('marcado_dado') or (origen is None and bool(m0.get('marcado')))
        if dado:
            nuevo['marcado_dado'] = True
        elif (not pequeno or m0['tipo'] == 'dip') and mk:
            nuevo['marcado'] = mk
    if nuevo is None:
        return None
    nuevo['caja'] = m0['caja']
    if 'texto' in m0 and 'texto' not in nuevo:
        nuevo['texto'] = m0['texto']
    return {k: v for k, v in nuevo.items() if v is not None}


def contexto(placa_id, placa, h, componentes):
    return {'placa': placa_id, 'ancho': placa['ancho'] / 100, 'alto': placa['alto'] / 100, 'x': h['x'] / 100, 'y': h['y'] / 100,
            'a': h['a'], 'componentes': componentes}


def reclasificar(placa_id, d, componentes):
    """Applies `clasificar` to every footprint of a board's data (consolas_pcb's <placa>.json). Returns the list
    of (reference, footprint, type, origin) for the report."""
    out = []
    for h in d['huellas']:
        if h['t'] == 'mec':
            continue
        P = pads_locales(h, d['pads'])
        m = clasificar(h, P, contexto(placa_id, d['placa'], h, componentes))
        if m is not None:
            h['m'] = m
        out.append((h['r'], h['l'], h['m']['tipo'], h['m'].get('clasif', '')))
    return out


def informe(lista):
    """Counts by type and the generic leftovers."""
    import collections
    tipos = collections.Counter(t for _, _, t, _ in lista)
    genericos = [(r, l) for r, l, t, _ in lista if t in ('generico', 'caja')]
    return tipos, genericos
