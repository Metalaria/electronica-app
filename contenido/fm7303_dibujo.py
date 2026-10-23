"""Drawing and topology engine for the FM7303 kit schematic (contenido/fm7303.py).

A tiny schematic DSL: parts are placed with explicit coordinates (SVG user units, y down) and wires are
orthogonal polylines tagged with the net they belong to. From that single description the engine writes

  * the SVG of the schematic (light plate, dark ink, as the book's figures), and
  * its topology in the «Datos de figuras» format of ESQUEMA.md (`esquemas[]`: puntos, elementos, nodos,
    tramos), which the app's live-schematic overlay (componentes/figuras-vivas) animates.

The geometry is checked against the declared nets: every wire end must land on a terminal or on another
wire of the same net, no wire or terminal may touch something of another net, and every net must be one
connected drawing (or several pieces joined by supply/ground symbols of that net). The build fails otherwise.
"""

import math

TINTA = '#1b2733'
GRIS = '#5d6d7e'
FUENTE = "'Source Sans 3', 'Source Sans Pro', system-ui, sans-serif"
TOL = 0.6


def fmt(v):
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


class Parte:
    def __init__(self, ref, rol, clase, valor=None, unidad=None, texto=None):
        self.ref = ref
        self.rol = rol
        self.clase = clase
        self.valor = valor
        self.unidad = unidad
        self.texto = texto            # value as written («4,7 µF»)
        self.term = {}                # terminal -> (x, y)
        self.redes = {}               # terminal -> net
        self.anclas = {}              # extra anchors (istart, iend, center…)
        self.caja = None              # [x0, y0, x1, y1]
        self.svg = []
        self.polaridad = None
        self.bloque = None

    def p(self, t):
        return self.term[t]


class Esquema:
    def __init__(self):
        self.partes = []
        self.cables = []              # (net, [points])
        self.textos = []              # svg fragments drawn on top (labels)
        self.fondo = []               # svg fragments drawn below (block areas)
        self.puntos_prueba = []       # (id, net, (x, y), label)
        self._refs = {}

    # ------------------------------------------------------------ registry
    def add(self, parte, bloque):
        if parte.ref in self._refs:
            raise ValueError(f'designador repetido: {parte.ref}')
        parte.bloque = bloque
        self._refs[parte.ref] = parte
        self.partes.append(parte)
        return parte

    def __getitem__(self, ref):
        return self._refs[ref]

    def w(self, net, *pts):
        """Orthogonal wire through the given points (terminal tuples or (x, y))."""
        pts = [tuple(map(float, p)) for p in pts]
        for a, b in zip(pts, pts[1:]):
            if abs(a[0] - b[0]) > 1e-6 and abs(a[1] - b[1]) > 1e-6:
                raise ValueError(f'cable no ortogonal en {net}: {a} -> {b}')
        # drop repeated points
        lim = [pts[0]]
        for p in pts[1:]:
            if math.dist(p, lim[-1]) > 1e-6:
                lim.append(p)
        if len(lim) >= 2:
            self.cables.append((net, lim))

    def texto(self, x, y, t, tam=9, ancla='start', color=TINTA, peso=400, cursiva=False):
        st = ' font-style="italic"' if cursiva else ''
        self.textos.append(
            f'<text x="{fmt(x)}" y="{fmt(y)}" font-size="{tam}" text-anchor="{ancla}" fill="{color}" '
            f'font-weight="{peso}"{st}>{esc(t)}</text>')

    def tp(self, id_, net, xy, etiqueta):
        self.puntos_prueba.append((id_, net, tuple(map(float, xy)), etiqueta))


# ================================================================== symbols
def _xf(a, b):
    """Local frame of a two-terminal part: s along a->b, t to the left of the direction."""
    ax, ay = a
    bx, by = b
    L = math.dist(a, b)
    ux, uy = (bx - ax) / L, (by - ay) / L
    nx, ny = uy, -ux                       # normal (screen: to the "upper" side of a left-to-right part)

    def f(s, t):
        return (ax + ux * s + nx * t, ay + uy * s + ny * t)
    return f, L


def _pl(f, pts, extra=''):
    d = ' '.join(f'{fmt(x)},{fmt(y)}' for x, y in (f(s, t) for s, t in pts))
    return f'<polyline points="{d}" fill="none"{extra}/>'


def _caja(pts, m=0.0):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return [min(xs) - m, min(ys) - m, max(xs) + m, max(ys) + m]


def dos(ref, rol, clase, a, b, cuerpo, valor=None, unidad=None, texto=None, redes=('', ''), larg=24, pol=None):
    """Two-terminal part from a to b; `cuerpo(f, c0, c1)` draws the body between s=c0 and s=c1."""
    p = Parte(ref, rol, clase, valor, unidad, texto)
    f, L = _xf(a, b)
    c0 = (L - larg) / 2
    c1 = c0 + larg
    p.term = {'start': tuple(map(float, a)), 'end': tuple(map(float, b))}
    p.redes = {'start': redes[0], 'end': redes[1]}
    p.anclas = {'istart': f(c0, 0), 'iend': f(c1, 0), 'center': f(L / 2, 0)}
    p.svg.append(_pl(f, [(0, 0), (c0, 0)]))
    p.svg.append(_pl(f, [(c1, 0), (L, 0)]))
    forma = cuerpo(f, c0, c1)
    p.svg.extend(forma['svg'])
    p.caja = _caja([f(s, t) for s, t in forma['caja']], 1.5)
    p.polaridad = pol
    return p


def b_res(f, c0, c1):
    pts = [(c0, -4.5), (c1, -4.5), (c1, 4.5), (c0, 4.5), (c0, -4.5)]
    return {'svg': [_pl(f, pts)], 'caja': pts}


def b_cap(f, c0, c1, pol=False):
    c = (c0 + c1) / 2
    svg = [_pl(f, [(c0, 0), (c - 2.5, 0)]), _pl(f, [(c + 2.5, 0), (c1, 0)]),
           _pl(f, [(c - 2.5, -8), (c - 2.5, 8)], ' stroke-width="2"')]
    if pol:
        # electrolytic: second plate filled; «+» on the first one
        q = [f(c + 1.5, -8), f(c + 4, -8), f(c + 4, 8), f(c + 1.5, 8)]
        svg.append('<polygon points="' + ' '.join(f'{fmt(x)},{fmt(y)}' for x, y in q) + f'" fill="{TINTA}" stroke="none"/>')
        svg.append(_pl(f, [(c + 4, 0), (c1, 0)]))
        px, py = f(c - 7, 7)
        svg.append(f'<text x="{fmt(px)}" y="{fmt(py + 3)}" font-size="8" text-anchor="middle" fill="{TINTA}">+</text>')
    else:
        svg.append(_pl(f, [(c + 2.5, -8), (c + 2.5, 8)], ' stroke-width="2"'))
    return {'svg': svg, 'caja': [(c - 4, -9), (c + 4, 9)]}


def b_cap_pol(f, c0, c1):
    return b_cap(f, c0, c1, pol=True)


def b_cap_var(f, c0, c1, trim=False):
    r = b_cap(f, c0, c1)
    c = (c0 + c1) / 2
    a = f(c - 9, 9)
    b = f(c + 9, -9)
    r['svg'].append(f'<line x1="{fmt(a[0])}" y1="{fmt(a[1])}" x2="{fmt(b[0])}" y2="{fmt(b[1])}"/>')
    if trim:
        # trimmer: a bar across the end of the diagonal
        e1 = f(c + 6, -12)
        e2 = f(c + 12, -6)
        r['svg'].append(f'<line x1="{fmt(e1[0])}" y1="{fmt(e1[1])}" x2="{fmt(e2[0])}" y2="{fmt(e2[1])}"/>')
    else:
        h1 = f(c + 3.5, -8.5)
        h2 = f(c + 8.5, -3.5)
        r['svg'].append('<polygon points="' + ' '.join(f'{fmt(x)},{fmt(y)}' for x, y in (b, h1, h2)) + f'" fill="{TINTA}"/>')
    r['caja'] = [(c - 10, -12), (c + 12, 12)]
    return r


def b_trim(f, c0, c1):
    return b_cap_var(f, c0, c1, trim=True)


def b_ind(f, c0, c1, nucleo=False):
    n = 4
    paso = (c1 - c0) / n
    d = []
    for i in range(n):
        s0 = c0 + i * paso
        pts = [(s0 + paso / 2 - paso / 2 * math.cos(k * math.pi / 8), -paso / 2 * math.sin(k * math.pi / 8) * 1.15)
               for k in range(9)]
        d.append(_pl(f, pts))
    caja = [(c0, -7), (c1, 2)]
    if nucleo:
        # adjustable core: a slanted arrow across the coil
        a = f(c0 + 2, 9)
        b = f(c1 - 2, -12)
        d.append(f'<line x1="{fmt(a[0])}" y1="{fmt(a[1])}" x2="{fmt(b[0])}" y2="{fmt(b[1])}" stroke-dasharray="3 2"/>')
        caja = [(c0, -12), (c1, 9)]
    return {'svg': d, 'caja': caja}


def b_ind_nucleo(f, c0, c1):
    return b_ind(f, c0, c1, nucleo=True)


def b_diodo(f, c0, c1, tipo='D'):
    c = (c0 + c1) / 2
    tri = [f(c - 5, -6), f(c - 5, 6), f(c + 5, 0)]
    svg = [_pl(f, [(c0, 0), (c - 5, 0)]), _pl(f, [(c + 5, 0), (c1, 0)]),
           '<polygon points="' + ' '.join(f'{fmt(x)},{fmt(y)}' for x, y in tri) + '" fill="none"/>',
           _pl(f, [(c + 5, -6), (c + 5, 6)])]
    caja = [(c - 6, -8), (c + 7, 8)]
    if tipo == 'VAR':
        svg.append(_pl(f, [(c + 8, -6), (c + 8, 6)]))
        caja = [(c - 6, -8), (c + 9, 8)]
    if tipo == 'LED':
        for k in (0, 5):
            a = f(c - 1 + k, -8)
            b = f(c + 4 + k, -13)
            svg.append(f'<line x1="{fmt(a[0])}" y1="{fmt(a[1])}" x2="{fmt(b[0])}" y2="{fmt(b[1])}"/>')
            h1 = f(c + 1.5 + k, -13)
            h2 = f(c + 4 + k, -10.5)
            svg.append('<polygon points="' + ' '.join(f'{fmt(x)},{fmt(y)}' for x, y in (b, h1, h2)) + f'" fill="{TINTA}"/>')
        caja = [(c - 6, -14), (c + 10, 8)]
    return {'svg': svg, 'caja': caja}


def b_interruptor(f, c0, c1):
    c = (c0 + c1) / 2
    a = f(c - 8, 0)
    b = f(c + 8, 0)
    k = f(c + 7, -8)
    svg = [_pl(f, [(c0, 0), (c - 10, 0)]), _pl(f, [(c + 10, 0), (c1, 0)]),
           f'<circle cx="{fmt(a[0])}" cy="{fmt(a[1])}" r="2" fill="#fff"/>',
           f'<circle cx="{fmt(b[0])}" cy="{fmt(b[1])}" r="2" fill="#fff"/>',
           f'<line x1="{fmt(a[0])}" y1="{fmt(a[1])}" x2="{fmt(k[0])}" y2="{fmt(k[1])}"/>']
    return {'svg': svg, 'caja': [(c - 11, -10), (c + 11, 4)]}


def b_puente(f, c0, c1):
    """The «Monitor» solder bridge: two square pads, open."""
    c = (c0 + c1) / 2
    svg = [_pl(f, [(c0, 0), (c - 4, 0)]), _pl(f, [(c + 4, 0), (c1, 0)])]
    for s in (c - 4, c + 1):
        q = [f(s, -3), f(s + 3, -3), f(s + 3, 3), f(s, 3)]
        svg.append('<polygon points="' + ' '.join(f'{fmt(x)},{fmt(y)}' for x, y in q) + '" fill="#fff"/>')
    return {'svg': svg, 'caja': [(c - 6, -6), (c + 6, 6)]}


def b_medidor(f, c0, c1):
    c = (c0 + c1) / 2
    x, y = f(c, 0)
    a = f(c - 7, 7)
    b = f(c + 7, -7)
    svg = [_pl(f, [(c0, 0), (c - 11, 0)]), _pl(f, [(c + 11, 0), (c1, 0)]),
           f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="11" fill="#fff"/>',
           f'<line x1="{fmt(a[0])}" y1="{fmt(a[1])}" x2="{fmt(b[0])}" y2="{fmt(b[1])}"/>']
    h1 = f(c + 3, -7.5)
    h2 = f(c + 7.5, -3)
    svg.append('<polygon points="' + ' '.join(f'{fmt(u)},{fmt(v)}' for u, v in (b, h1, h2)) + f'" fill="{TINTA}"/>')
    return {'svg': svg, 'caja': [(c - 12, -12), (c + 12, 12)]}


def b_altavoz(f, c0, c1):
    c = (c0 + c1) / 2
    rect = [(c - 6, -4), (c + 6, -4), (c + 6, 4), (c - 6, 4), (c - 6, -4)]
    cono = [(c - 6, 4), (c - 10, 13), (c + 10, 13), (c + 6, 4)]
    return {'svg': [_pl(f, rect), _pl(f, cono)], 'caja': [(c - 11, -5), (c + 11, 14)]}


# ------------------------------------------------------------------ two-terminal factories
def R(ref, a, b, valor, texto, redes):
    return dos(ref, 'R', 'Resistor', a, b, b_res, valor, 'Ω', texto, redes)


def C(ref, a, b, valor, texto, redes, pol=False):
    if pol:
        return dos(ref, 'C', 'Capacitor2', a, b, b_cap_pol, valor, 'F', texto, redes,
                   pol={'positivo': 'start', 'negativo': 'end'})
    return dos(ref, 'C', 'Capacitor', a, b, b_cap, valor, 'F', texto, redes)


def CV(ref, a, b, valor, texto, redes, trim=False):
    return dos(ref, 'C', 'CapacitorTrim' if trim else 'CapacitorVar', a, b, b_trim if trim else b_cap_var,
               valor, 'F', texto, redes)


def L(ref, a, b, valor, texto, redes, nucleo=False):
    return dos(ref, 'L', 'Inductor2', a, b, b_ind_nucleo if nucleo else b_ind, valor, 'H', texto, redes)


def D(ref, a, b, texto, redes, tipo='D'):
    rol = {'D': 'D', 'LED': 'LED', 'VAR': 'VAR'}[tipo]
    return dos(ref, rol, {'D': 'Diode', 'LED': 'LED', 'VAR': 'Varactor'}[tipo], a, b,
               lambda f, c0, c1: b_diodo(f, c0, c1, tipo), None, None, texto, redes,
               pol={'anodo': 'start', 'catodo': 'end'})


def SW(ref, a, b, texto, redes, estado='abierto'):
    p = dos(ref, 'SW', 'Switch', a, b, b_interruptor, None, None, texto, redes)
    return p


def PUENTE(ref, a, b, texto, redes):
    return dos(ref, 'SW', 'Jumper', a, b, b_puente, None, None, texto, redes, larg=12)


def MEDIDOR(ref, a, b, texto, redes):
    return dos(ref, 'VM', 'Meter', a, b, b_medidor, None, None, texto, redes)


def ALTAVOZ(ref, a, b, texto, redes):
    return dos(ref, 'SPK', 'Speaker', a, b, b_altavoz, None, None, texto, redes, larg=24)


# ------------------------------------------------------------------ multi-terminal parts
def POT(ref, a, b, lado, valor, texto, redes):
    """Potentiometer from a to b with its wiper on side `lado` (+1 left of a->b, -1 right); `redes`
    = (start, end, tap). The tap terminal sits 16 units from the axis."""
    p = dos(ref, 'POT', 'Potentiometer', a, b, b_res, valor, 'Ω', texto, redes[:2])
    f, L_ = _xf(a, b)
    c = L_ / 2
    t = f(c, 16 * lado)
    p.term['tap'] = t
    p.redes['tap'] = redes[2]
    tip = f(c, 5 * lado)
    p.svg.append(f'<line x1="{fmt(t[0])}" y1="{fmt(t[1])}" x2="{fmt(tip[0])}" y2="{fmt(tip[1])}"/>')
    h1 = f(c - 3, 9 * lado)
    h2 = f(c + 3, 9 * lado)
    p.svg.append('<polygon points="' + ' '.join(f'{fmt(x)},{fmt(y)}' for x, y in (tip, h1, h2)) + f'" fill="{TINTA}"/>')
    p.caja = _caja([p.caja[:2], p.caja[2:], t], 0)
    return p


def CONMUTADOR(ref, com, a, b, texto, redes):
    """SPDT (K1): common contact `com`, positions `a` and `b`; the blade is drawn towards b."""
    p = Parte(ref, 'SPDT', 'SPDT', texto=texto)
    p.term = {'com': com, 'a': a, 'b': b}
    p.redes = {'com': redes[0], 'a': redes[1], 'b': redes[2]}
    cx = (com[0] + a[0] + b[0]) / 3
    cy = (com[1] + a[1] + b[1]) / 3
    p.anclas = {'center': (cx, cy)}
    for q in (com, a, b):
        p.svg.append(f'<circle cx="{fmt(q[0])}" cy="{fmt(q[1])}" r="2.2" fill="#fff"/>')
    # blade from com towards a (drawn), position b dotted
    dx, dy = a[0] - com[0], a[1] - com[1]
    n = math.hypot(dx, dy)
    tip = (com[0] + dx / n * (n - 3), com[1] + dy / n * (n - 3))
    p.svg.append(f'<line x1="{fmt(com[0])}" y1="{fmt(com[1])}" x2="{fmt(tip[0])}" y2="{fmt(tip[1])}"/>')
    p.caja = _caja([com, a, b], 6)
    return p


def CAJA_CI(ref, rol, clase, x0, y0, w, h, pines, titulo, sub='', lado='abajo', paso=None, stub=10):
    """IC drawn as a box; `pines` = [(name, net, label)] placed along one side (or a list of
    (name, net, label, side, offset) when `lado` is None)."""
    p = Parte(ref, rol, clase, texto=sub)
    p.svg.append(f'<rect x="{fmt(x0)}" y="{fmt(y0)}" width="{fmt(w)}" height="{fmt(h)}" rx="3" fill="#fff"/>')
    n = len(pines)
    for i, pin in enumerate(pines):
        if lado is None:
            nombre, red, et, ld, off = pin
        else:
            nombre, red, et = pin
            ld = lado
            off = (paso * (i + 0.5) if paso else w * (i + 0.5) / n) if ld in ('abajo', 'arriba') else (h * (i + 0.5) / n)
        if ld == 'abajo':
            a = (x0 + off, y0 + h)
            t = (a[0], a[1] + stub)
            tx, ty, anc = a[0], a[1] - 3, 'middle'
        elif ld == 'arriba':
            a = (x0 + off, y0)
            t = (a[0], a[1] - stub)
            tx, ty, anc = a[0], a[1] + 9, 'middle'
        elif ld == 'izq':
            a = (x0, y0 + off)
            t = (a[0] - stub, a[1])
            tx, ty, anc = a[0] + 3, a[1] + 3, 'start'
        else:
            a = (x0 + w, y0 + off)
            t = (a[0] + stub, a[1])
            tx, ty, anc = a[0] - 3, a[1] + 3, 'end'
        p.svg.append(f'<line x1="{fmt(a[0])}" y1="{fmt(a[1])}" x2="{fmt(t[0])}" y2="{fmt(t[1])}"/>')
        if et:
            p.svg.append(f'<text x="{fmt(tx)}" y="{fmt(ty)}" font-size="6.5" text-anchor="{anc}" fill="{GRIS}" stroke="none">{esc(et)}</text>')
        p.term[nombre] = t
        p.redes[nombre] = red
    p.anclas = {'center': (x0 + w / 2, y0 + h / 2)}
    p.caja = [x0, y0, x0 + w, y0 + h]
    lineas = [titulo] + ([sub] if sub else [])
    for k, l in enumerate(lineas):
        yy = y0 + h / 2 + (k - (len(lineas) - 1) / 2) * 11 + 3
        peso = 700 if k == 0 else 400
        p.svg.append(f'<text x="{fmt(x0 + w / 2)}" y="{fmt(yy)}" font-size="{9.5 if k == 0 else 8}" text-anchor="middle" '
                     f'font-weight="{peso}" fill="{TINTA}" stroke="none">{esc(l)}</text>')
    return p


def NPN(ref, base, redes, texto):
    """NPN with the base terminal at `base`, body to the right; collector up, emitter down."""
    bx, by = base
    cx, cy = bx + 18, by
    p = Parte(ref, 'QN', 'BjtNpn', texto=texto)
    p.term = {'base': (bx, by), 'collector': (bx + 24, by - 22), 'emitter': (bx + 24, by + 22)}
    p.redes = dict(zip(('base', 'collector', 'emitter'), redes))
    p.anclas = {'center': (cx, cy)}
    p.svg += [f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="11" fill="#fff"/>',
              f'<line x1="{fmt(bx)}" y1="{fmt(by)}" x2="{fmt(bx + 12)}" y2="{fmt(by)}"/>',
              f'<line x1="{fmt(bx + 12)}" y1="{fmt(by - 7)}" x2="{fmt(bx + 12)}" y2="{fmt(by + 7)}" stroke-width="2"/>',
              f'<polyline points="{fmt(bx + 12)},{fmt(by - 3)} {fmt(bx + 24)},{fmt(by - 12)} {fmt(bx + 24)},{fmt(by - 22)}" fill="none"/>',
              f'<polyline points="{fmt(bx + 12)},{fmt(by + 3)} {fmt(bx + 24)},{fmt(by + 12)} {fmt(bx + 24)},{fmt(by + 22)}" fill="none"/>',
              f'<polygon points="{fmt(bx + 24)},{fmt(by + 12)} {fmt(bx + 17.5)},{fmt(by + 11)} {fmt(bx + 21)},{fmt(by + 6.5)}" fill="{TINTA}"/>']
    p.caja = [bx, by - 14, bx + 30, by + 14]
    return p


def TRAFO_FI(ref, x, y, redes, texto):
    """IF transformer B1 at (x, y) (top-left of the primary): primary 1-3 on the left, secondary 4-6 on
    the right (6 at the top), adjustable core. Terminals p1, p3, p4, p6."""
    p = Parte(ref, 'XFMR', 'Transformer', 3e-6, 'H', texto)
    p.term = {'p1': (x, y), 'p3': (x, y + 40), 'p6': (x + 34, y), 'p4': (x + 34, y + 40)}
    p.redes = dict(zip(('p1', 'p3', 'p6', 'p4'), redes))
    p.anclas = {'center': (x + 17, y + 20)}
    for xx, sgn in ((x + 10, 1), (x + 24, -1)):
        pts = []
        for i in range(4):
            for k in range(9):
                yy = y + 8 + i * 6 + 3 - 3 * math.cos(k * math.pi / 8)
                xs = xx + sgn * 4.2 * math.sin(k * math.pi / 8)
                pts.append((xs, yy))
        p.svg.append('<polyline points="' + ' '.join(f'{fmt(a)},{fmt(b)}' for a, b in pts) + '" fill="none"/>')
    p.svg += [f'<polyline points="{fmt(x)},{fmt(y)} {fmt(x + 10)},{fmt(y)} {fmt(x + 10)},{fmt(y + 8)}" fill="none"/>',
              f'<polyline points="{fmt(x)},{fmt(y + 40)} {fmt(x + 10)},{fmt(y + 40)} {fmt(x + 10)},{fmt(y + 32)}" fill="none"/>',
              f'<polyline points="{fmt(x + 34)},{fmt(y)} {fmt(x + 24)},{fmt(y)} {fmt(x + 24)},{fmt(y + 8)}" fill="none"/>',
              f'<polyline points="{fmt(x + 34)},{fmt(y + 40)} {fmt(x + 24)},{fmt(y + 40)} {fmt(x + 24)},{fmt(y + 32)}" fill="none"/>',
              f'<line x1="{fmt(x + 17)}" y1="{fmt(y + 4)}" x2="{fmt(x + 17)}" y2="{fmt(y + 36)}" stroke-dasharray="3 2"/>',
              f'<line x1="{fmt(x + 9)}" y1="{fmt(y + 40)}" x2="{fmt(x + 26)}" y2="{fmt(y - 2)}"/>',
              f'<rect x="{fmt(x + 2)}" y="{fmt(y - 4)}" width="30" height="48" fill="none" stroke="{GRIS}" stroke-dasharray="2 2" stroke-width="0.8"/>']
    for t, (tx, ty) in (('1', (x - 3, y - 3)), ('3', (x - 3, y + 50)), ('6', (x + 37, y - 3)), ('4', (x + 37, y + 50))):
        p.svg.append(f'<text x="{fmt(tx)}" y="{fmt(ty)}" font-size="6" text-anchor="middle" fill="{GRIS}" stroke="none">{t}</text>')
    p.caja = [x, y - 4, x + 34, y + 44]
    return p


def FILTRO_CER(ref, x, y, redes, texto):
    """Ceramic filter: input p1 at (x, y), output p3 at (x + 40, y), ground p2 below the centre."""
    p = Parte(ref, 'X', 'CeramicFilter', 10.7e6, 'Hz', texto)
    p.term = {'p1': (x, y), 'p3': (x + 40, y), 'p2': (x + 20, y + 26)}
    p.redes = dict(zip(('p1', 'p3', 'p2'), redes))
    p.anclas = {'center': (x + 20, y + 6)}
    p.svg += [f'<line x1="{fmt(x)}" y1="{fmt(y)}" x2="{fmt(x + 12)}" y2="{fmt(y)}"/>',
              f'<line x1="{fmt(x + 28)}" y1="{fmt(y)}" x2="{fmt(x + 40)}" y2="{fmt(y)}"/>',
              f'<line x1="{fmt(x + 12)}" y1="{fmt(y - 7)}" x2="{fmt(x + 12)}" y2="{fmt(y + 7)}" stroke-width="2"/>',
              f'<line x1="{fmt(x + 28)}" y1="{fmt(y - 7)}" x2="{fmt(x + 28)}" y2="{fmt(y + 7)}" stroke-width="2"/>',
              f'<rect x="{fmt(x + 15)}" y="{fmt(y - 8)}" width="10" height="16" fill="#fff"/>',
              f'<line x1="{fmt(x + 20)}" y1="{fmt(y + 8)}" x2="{fmt(x + 20)}" y2="{fmt(y + 26)}"/>',
              f'<line x1="{fmt(x + 14)}" y1="{fmt(y + 12)}" x2="{fmt(x + 26)}" y2="{fmt(y + 12)}" stroke-width="2"/>']
    for t, (tx, ty) in (('1', (x + 6, y - 4)), ('3', (x + 34, y - 4)), ('2', (x + 24, y + 22))):
        p.svg.append(f'<text x="{fmt(tx)}" y="{fmt(ty)}" font-size="6" text-anchor="middle" fill="{GRIS}" stroke="none">{t}</text>')
    p.caja = [x + 10, y - 9, x + 30, y + 14]
    return p


def BLOQUE3(ref, rol, clase, x, y, w, h, titulo, sub, term, redes):
    """A labelled box with arbitrary terminals {name: (x, y)} (regulators, BPF, jack, display)."""
    p = Parte(ref, rol, clase, texto=sub)
    p.svg.append(f'<rect x="{fmt(x)}" y="{fmt(y)}" width="{fmt(w)}" height="{fmt(h)}" rx="2.5" fill="#fff"/>')
    lineas = [titulo] + ([sub] if sub else [])
    for k, l in enumerate(lineas):
        yy = y + h / 2 + (k - (len(lineas) - 1) / 2) * 10 + 3
        p.svg.append(f'<text x="{fmt(x + w / 2)}" y="{fmt(yy)}" font-size="{9 if k == 0 else 7.5}" text-anchor="middle" '
                     f'font-weight="{700 if k == 0 else 400}" fill="{TINTA}" stroke="none">{esc(l)}</text>')
    for t, q in term.items():
        p.term[t] = tuple(map(float, q))
        p.redes[t] = redes[t]
        # stub from the box edge to the terminal
        ex = min(max(q[0], x), x + w)
        ey = min(max(q[1], y), y + h)
        if math.dist((ex, ey), q) > 0.1:
            p.svg.append(f'<line x1="{fmt(ex)}" y1="{fmt(ey)}" x2="{fmt(q[0])}" y2="{fmt(q[1])}"/>')
    p.anclas = {'center': (x + w / 2, y + h / 2)}
    p.caja = [x, y, x + w, y + h]
    return p


def GND(ref, xy):
    x, y = xy
    p = Parte(ref, 'GND', 'Ground')
    p.term = {'start': (float(x), float(y))}
    p.redes = {'start': '0'}
    p.svg += [f'<line x1="{fmt(x)}" y1="{fmt(y)}" x2="{fmt(x)}" y2="{fmt(y + 5)}"/>',
              f'<line x1="{fmt(x - 7)}" y1="{fmt(y + 5)}" x2="{fmt(x + 7)}" y2="{fmt(y + 5)}" stroke-width="1.8"/>',
              f'<line x1="{fmt(x - 4.5)}" y1="{fmt(y + 8)}" x2="{fmt(x + 4.5)}" y2="{fmt(y + 8)}"/>',
              f'<line x1="{fmt(x - 2)}" y1="{fmt(y + 11)}" x2="{fmt(x + 2)}" y2="{fmt(y + 11)}"/>']
    p.caja = [x - 7, y, x + 7, y + 12]
    p.anclas = {'center': (x, y + 6)}
    return p


def RAIL(ref, xy, red, texto, dir_='arriba'):
    """Supply flag: a short stem from the terminal and a tag with the rail name."""
    x, y = xy
    p = Parte(ref, 'RAIL', 'Vdd', texto=texto)
    p.term = {'start': (float(x), float(y))}
    p.redes = {'start': red}
    ancho = 5.2 * len(texto) + 8
    if dir_ in ('arriba', 'abajo'):
        s = -1 if dir_ == 'arriba' else 1
        y1 = y + s * 6
        p.svg.append(f'<line x1="{fmt(x)}" y1="{fmt(y)}" x2="{fmt(x)}" y2="{fmt(y1)}"/>')
        p.svg.append(f'<line x1="{fmt(x - 6)}" y1="{fmt(y1)}" x2="{fmt(x + 6)}" y2="{fmt(y1)}" stroke-width="1.8"/>')
        ty = y1 + (-3 if s < 0 else 9)
        p.svg.append(f'<text x="{fmt(x)}" y="{fmt(ty)}" font-size="8" text-anchor="middle" font-weight="600" fill="{TINTA}" stroke="none">{esc(texto)}</text>')
        p.caja = [x - ancho / 2, min(y, ty - 8), x + ancho / 2, max(y, ty + 2)]
    else:
        s = -1 if dir_ == 'izq' else 1
        x1 = x + s * 6
        p.svg.append(f'<line x1="{fmt(x)}" y1="{fmt(y)}" x2="{fmt(x1)}" y2="{fmt(y)}"/>')
        p.svg.append(f'<line x1="{fmt(x1)}" y1="{fmt(y - 6)}" x2="{fmt(x1)}" y2="{fmt(y + 6)}" stroke-width="1.8"/>')
        tx = x1 + s * 3
        p.svg.append(f'<text x="{fmt(tx)}" y="{fmt(y + 3)}" font-size="8" text-anchor="{"end" if s < 0 else "start"}" font-weight="600" fill="{TINTA}" stroke="none">{esc(texto)}</text>')
        p.caja = [min(x, tx - (ancho if s < 0 else 0)), y - 7, max(x, tx + (ancho if s > 0 else 0)), y + 7]
    p.anclas = {'center': ((p.caja[0] + p.caja[2]) / 2, (p.caja[1] + p.caja[3]) / 2)}
    return p


def ANTENA(ref, xy, red):
    x, y = xy
    p = Parte(ref, 'X', 'Antenna', texto='antena telescópica')
    p.term = {'start': (float(x), float(y))}
    p.redes = {'start': red}
    p.svg += [f'<line x1="{fmt(x)}" y1="{fmt(y)}" x2="{fmt(x)}" y2="{fmt(y - 22)}"/>',
              f'<polyline points="{fmt(x - 9)},{fmt(y - 34)} {fmt(x)},{fmt(y - 22)} {fmt(x + 9)},{fmt(y - 34)}" fill="none"/>',
              f'<line x1="{fmt(x)}" y1="{fmt(y - 22)}" x2="{fmt(x)}" y2="{fmt(y - 36)}"/>']
    p.caja = [x - 10, y - 37, x + 10, y]
    p.anclas = {'center': (x, y - 20)}
    return p


# ================================================================== topology
class Topologia:
    """Points, nodes and wire segments («tramos») of the drawing, checked against the declared nets."""

    def __init__(self, esq: Esquema):
        self.esq = esq
        self.puntos = []            # [x, y]
        self.indice = {}

    def pid(self, xy):
        k = (round(xy[0] / TOL), round(xy[1] / TOL))
        for dk in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            j = self.indice.get((k[0] + dk[0], k[1] + dk[1]))
            if j is not None and math.dist(self.puntos[j], xy) <= TOL:
                return j
        self.puntos.append(list(xy))
        self.indice[k] = len(self.puntos) - 1
        return len(self.puntos) - 1

    def construir(self):
        esq = self.esq
        errores = []
        # 1. terminal points
        term_pt = {}                     # (ref, t) -> pid
        net_pt = {}                      # pid -> set(nets)
        for p in esq.partes:
            for t, xy in p.term.items():
                j = self.pid(xy)
                term_pt[(p.ref, t)] = j
                net_pt.setdefault(j, set()).add(p.redes[t])
        # 2. wire vertices and attachment points
        cables = []
        for net, pts in esq.cables:
            ids = [self.pid(q) for q in pts]
            for j in ids:
                net_pt.setdefault(j, set()).add(net)
            cables.append((net, pts, ids))
        # attachment: any point (terminal or wire vertex/end) lying on the interior of a wire segment
        def sobre(q, a, b):
            if abs(a[0] - b[0]) < 1e-6:           # vertical
                return abs(q[0] - a[0]) <= TOL and min(a[1], b[1]) + TOL < q[1] < max(a[1], b[1]) - TOL
            return abs(q[1] - a[1]) <= TOL and min(a[0], b[0]) + TOL < q[0] < max(a[0], b[0]) - TOL
        extremos = set()
        for net, pts, ids in cables:
            extremos.add(ids[0])
            extremos.add(ids[-1])
        candidatos = set(term_pt.values()) | extremos
        # corners of a wire are attachment points only if something else ends there; handled by pid sharing
        tramos = []
        for net, pts, ids in cables:
            # build the full vertex list with inserted attachment points
            seq = [ids[0]]
            for (a, b), jb in zip(zip(pts, pts[1:]), ids[1:]):
                dentro = [c for c in candidatos if sobre(self.puntos[c], a, b)]
                dentro.sort(key=lambda c: math.dist(self.puntos[c], a))
                for c in dentro:
                    net_pt.setdefault(c, set()).add(net)
                seq.extend(dentro)
                seq.append(jb)
            # split at attachment points (terminals, other wires' ends) but keep plain corners inside
            uso = {}
            for net2, pts2, ids2 in cables:
                for j in ids2:
                    uso[j] = uso.get(j, 0) + 1
            corte = set(term_pt.values()) | extremos
            tramo = [seq[0]]
            for j in seq[1:]:
                tramo.append(j)
                if j in corte or uso.get(j, 0) > 1:
                    if len(tramo) >= 2:
                        tramos.append((net, tramo))
                    tramo = [j]
            if len(tramo) >= 2:
                tramos.append((net, tramo))
        # 3. nets per point must be unique
        for j, ns in net_pt.items():
            if len(ns) > 1:
                errores.append(f'punto {self.puntos[j]} une redes distintas: {sorted(ns)}')
        # 4. connectivity: union-find over points
        padre = list(range(len(self.puntos)))

        def raiz(i):
            while padre[i] != i:
                padre[i] = padre[padre[i]]
                i = padre[i]
            return i

        def unir(a, b):
            ra, rb = raiz(a), raiz(b)
            if ra != rb:
                padre[ra] = rb
        for net, tr in tramos:
            for a, b in zip(tr, tr[1:]):
                unir(a, b)
        # every terminal must touch a wire or another terminal of its net
        tocados = {}
        for (ref, t), j in term_pt.items():
            tocados.setdefault(j, []).append((ref, t))
        en_cable = set()
        for net, tr in tramos:
            en_cable.update(tr)
        for (ref, t), j in term_pt.items():
            if j not in en_cable and len(tocados[j]) < 2 and not esq[ref].redes[t].startswith('nc'):
                p = esq[ref]
                if p.rol not in ('GND', 'RAIL') or True:
                    errores.append(f'terminal sin conectar: {ref}.{t} en {self.puntos[j]} (red {p.redes[t]})')
        # every wire end must land on a terminal, another wire, or a junction
        for net, pts, ids in cables:
            for j in (ids[0], ids[-1]):
                otros = sum(1 for _, _, ids2 in cables for k in ids2 if k == j)
                en_otro = any(j in tr and j not in (tr[0], tr[-1]) for _, tr in tramos)
                if j not in term_pt.values() and otros < 2 and not en_otro:
                    # an end on the interior of another wire was inserted into that wire's sequence
                    inserto = sum(1 for _, tr in tramos if j in tr)
                    if inserto < 2:
                        errores.append(f'extremo de cable suelto en {self.puntos[j]} (red {net})')
        # each net: its pieces must contain a ground or rail symbol when there is more than one piece
        piezas = {}
        for j, ns in net_pt.items():
            n = next(iter(ns))
            piezas.setdefault(n, {}).setdefault(raiz(j), set()).add(j)
        simbolo = {}
        for p in esq.partes:
            if p.rol in ('GND', 'RAIL'):
                simbolo.setdefault(raiz(term_pt[(p.ref, 'start')]), True)
        for n, comp in piezas.items():
            if len(comp) > 1:
                for r, js in comp.items():
                    if r not in simbolo:
                        q = self.puntos[next(iter(js))]
                        errores.append(f'la red {n} tiene un trozo sin símbolo de alimentación/masa cerca de {q}')
        self.term_pt = term_pt
        self.net_pt = net_pt
        self.tramos = tramos
        if errores:
            raise SystemExit('Esquema FM7303 incoherente:\n  ' + '\n  '.join(errores[:40]))
        return self

    def juntas(self):
        """Junction dots: points where three or more wire ends/terminals meet, or a T on a wire."""
        grado = {}
        for net, tr in self.tramos:
            grado[tr[0]] = grado.get(tr[0], 0) + 1
            grado[tr[-1]] = grado.get(tr[-1], 0) + 1
        for j in self.term_pt.values():
            grado[j] = grado.get(j, 0) + 1
        return [self.puntos[j] for j, g in grado.items() if g >= 3]
