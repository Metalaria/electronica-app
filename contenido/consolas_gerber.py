"""Gerber RS-274X (X2) and Excellon reader for the console boards that are published only as Gerbers.

Enough of the format for KiCad's output: FSLA/MOMM, apertures C, R, O, P and macros (primitives 1, 4, 5, 20, 21
with arithmetic on $n), D01/D02/D03, G01/G02/G03 with G75, regions G36/G37, polarity LPD/LPC, and the X2
attributes that KiCad writes as «G04 #@! …» comments or as %TO/%TA/%TD blocks: TO.N (net), TO.C (component),
TO.P (component, pin, pin function), TA.AperFunction. Coordinates are returned in board millimetres with
KiCad's y down (a Gerber is y up: y_board = -y_gerber); bottom layers stay seen from the top, as in the files.

    capa = leer_gerber(texto)   ->  {'trazos': [...], 'destellos': [...], 'regiones': [...]}
    taladros = leer_excellon(texto)  ->  [{'x', 'y', 'd', 'ranura': [(x0, y0), (x1, y1)] | None, 'funcion'}]
"""

import math
import re

_COORD = re.compile(r'([XYIJ])([+-]?\d+(?:\.\d*)?)')


class Apertura:
    def __init__(self, forma, params, funcion, macro=None):
        self.forma = forma          # 'C', 'R', 'O', 'P' or a macro name
        self.params = params
        self.funcion = funcion      # TA.AperFunction (e.g. 'SMDPad,CuDef', 'Conductor', 'ViaPad')
        self.macro = macro          # list of primitives when forma is a macro

    def ancho_trazo(self):
        if self.forma == 'C':
            return self.params[0]
        if self.forma in ('R', 'O'):
            return min(self.params[0], self.params[1])
        return 0.1


def _evaluar(expr, vars_):
    """Macro arithmetic: numbers, $n, + - x / and parentheses."""
    s = re.sub(r'\$(\d+)', lambda m: repr(vars_.get(int(m.group(1)), 0.0)), expr.strip())
    s = s.replace('x', '*').replace('X', '*')
    if not re.fullmatch(r'[0-9.+\-*/() eE]*', s):
        raise ValueError('expresión de macro no admitida: %r' % expr)
    return float(eval(s, {'__builtins__': {}}, {})) if s.strip() else 0.0  # noqa: S307 (checked characters only)


def _rotar(pts, grados):
    if not grados:
        return pts
    a = math.radians(grados)
    c, s = math.cos(a), math.sin(a)
    return [(x * c - y * s, x * s + y * c) for x, y in pts]


def _circulo(cx, cy, d, n=24):
    r = d / 2
    return [(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n)) for k in range(n)]


def _rect_centrado(w, h):
    return [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]


def _ovalo(w, h, n=10):
    pts = []
    if w >= h:
        r = h / 2
        cx = w / 2 - r
        for k in range(n + 1):
            a = -math.pi / 2 + math.pi * k / n
            pts.append((cx + r * math.cos(a), r * math.sin(a)))
        for k in range(n + 1):
            a = math.pi / 2 + math.pi * k / n
            pts.append((-cx + r * math.cos(a), r * math.sin(a)))
    else:
        pts = [(y, x) for x, y in _ovalo(h, w, n)]
    return pts


def poligonos_apertura(ap):
    """Shape of an aperture flashed at (0, 0): list of (polygon, positive) in Gerber axes (y up)."""
    f, p = ap.forma, ap.params
    if f == 'C':
        return [(_circulo(0, 0, p[0]), True)]
    if f == 'R':
        return [(_rect_centrado(p[0], p[1]), True)]
    if f == 'O':
        return [(_ovalo(p[0], p[1]), True)]
    if f == 'P':
        d, n = p[0], int(p[1])
        rot = p[2] if len(p) > 2 else 0
        return [(_rotar(_circulo(0, 0, d, n), rot), True)]
    out = []
    vars_ = {i + 1: v for i, v in enumerate(p)}
    for prim in ap.macro or []:
        if prim[0].startswith('$'):
            nombre, expr = prim[0].split('=', 1)
            vars_[int(nombre[1:])] = _evaluar(expr, vars_)
            continue
        codigo = int(prim[0])
        v = [_evaluar(x, vars_) for x in prim[1:]]
        if codigo == 0:
            continue
        if codigo == 1:
            exp, d, cx, cy = v[0], v[1], v[2], v[3]
            rot = v[4] if len(v) > 4 else 0
            out.append((_rotar(_circulo(cx, cy, d), rot), exp > 0))
        elif codigo == 4:
            exp, n = v[0], int(v[1])
            pts = [(v[2 + 2 * k], v[3 + 2 * k]) for k in range(n + 1)]
            rot = v[2 + 2 * (n + 1)] if len(v) > 2 + 2 * (n + 1) else 0
            out.append((_rotar(pts[:-1], rot), exp > 0))
        elif codigo == 5:
            exp, n, cx, cy, d = v[0], int(v[1]), v[2], v[3], v[4]
            rot = v[5] if len(v) > 5 else 0
            out.append((_rotar([(cx + x, cy + y) for x, y in _circulo(0, 0, d, n)], rot), exp > 0))
        elif codigo == 20:
            exp, w, x1, y1, x2, y2 = v[:6]
            rot = v[6] if len(v) > 6 else 0
            dx, dy = x2 - x1, y2 - y1
            ln = math.hypot(dx, dy) or 1
            nx, ny = -dy / ln * w / 2, dx / ln * w / 2
            out.append((_rotar([(x1 + nx, y1 + ny), (x2 + nx, y2 + ny), (x2 - nx, y2 - ny), (x1 - nx, y1 - ny)], rot), exp > 0))
        elif codigo == 21:
            exp, w, h, cx, cy = v[:5]
            rot = v[5] if len(v) > 5 else 0
            out.append((_rotar([(cx + x, cy + y) for x, y in _rect_centrado(w, h)], rot), exp > 0))
        else:
            raise ValueError('primitiva de macro %d no admitida' % codigo)
    return out


def forma_pad(ap):
    """KiCad pad shape of an aperture: (shape c|r|o|rr|x, w, h, rot degrees CCW in board axes, roundrect ratio)."""
    f, p = ap.forma, ap.params
    if f == 'C':
        return ('c', p[0], p[0], 0.0, 0.0)
    if f == 'R':
        return ('r', p[0], p[1], 0.0, 0.0)
    if f == 'O':
        return ('o', p[0], p[1], 0.0, 0.0)
    if f.startswith('RoundRect') and len(p) >= 9:
        r = p[0]
        c = [(p[1], p[2]), (p[3], p[4]), (p[5], p[6]), (p[7], p[8])]
        w = math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1]) + 2 * r
        h = math.hypot(c[2][0] - c[1][0], c[2][1] - c[1][1]) + 2 * r
        ang = math.degrees(math.atan2(c[1][1] - c[0][1], c[1][0] - c[0][0]))
        # Gerber angles are counter-clockwise with y up; on the board (y down) the same turn reads clockwise,
        # and the viewer takes KiCad's convention (counter-clockwise on screen): negate.
        rot = round(-ang, 3) % 180
        if abs(rot - 90) < 0.01:
            w, h, rot = h, w, 0.0
        return ('rr', w, h, rot, (r / min(w, h)) if min(w, h) else 0.0)
    pts = [q for poly, pos in poligonos_apertura(ap) if pos for q in poly]
    if not pts:
        return ('c', 0.1, 0.1, 0.0, 0.0)
    xs = [q[0] for q in pts]
    ys = [q[1] for q in pts]
    return ('x', max(xs) - min(xs), max(ys) - min(ys), 0.0, 0.0)


def _arco(p0, p1, centro, horario, paso=8):
    """Points of an arc from p0 to p1 around centro (Gerber axes), excluding p0."""
    a0 = math.atan2(p0[1] - centro[1], p0[0] - centro[0])
    a1 = math.atan2(p1[1] - centro[1], p1[0] - centro[0])
    r = math.hypot(p0[0] - centro[0], p0[1] - centro[1])
    if horario:
        while a1 >= a0:
            a1 -= 2 * math.pi
    else:
        while a1 <= a0:
            a1 += 2 * math.pi
    if abs(p0[0] - p1[0]) < 1e-9 and abs(p0[1] - p1[1]) < 1e-9:
        a1 = a0 - 2 * math.pi if horario else a0 + 2 * math.pi
    n = max(2, int(abs(math.degrees(a1 - a0)) / paso) + 1)
    return [(centro[0] + r * math.cos(a0 + (a1 - a0) * k / n), centro[1] + r * math.sin(a0 + (a1 - a0) * k / n))
            for k in range(1, n + 1)]


def leer_gerber(texto):
    """Graphic objects of one Gerber layer, board coordinates (mm, y down).

    trazos:    {'pts': [(x, y)…], 'w', 'ap', 'atrib'}   (D01 strokes; arcs flattened)
    destellos: {'x', 'y', 'ap', 'atrib'}                (D03 flashes)
    regiones:  {'pts': [(x, y)…], 'atrib'}              (G36/G37 contours)
    Objects drawn with clear polarity (LPC) are dropped.
    """
    fx = fy = 6
    escala = 1.0
    aperturas = {}
    macros = {}
    ta = {}
    to = {}
    actual = None
    interp = 'G01'
    region = False
    oscuro = True
    x = y = 0.0
    contorno = []
    out = {'trazos': [], 'destellos': [], 'regiones': []}

    def atributos():
        return dict(to)

    def leer_attr(cmd):
        # «TO.N,VCC», «TA.AperFunction,SMDPad,CuDef», «TD», «TD.N»; non-ASCII comes escaped as \uXXXX
        cmd = re.sub(r'\\u([0-9A-Fa-f]{4})', lambda m: chr(int(m.group(1), 16)), cmd)
        if cmd.startswith('TO'):
            nombre, _, valor = cmd[2:].partition(',')
            to[nombre] = valor.split(',')
        elif cmd.startswith('TA'):
            nombre, _, valor = cmd[2:].partition(',')
            ta[nombre] = valor
        elif cmd.startswith('TD'):
            nombre = cmd[2:]
            if not nombre:
                to.clear()
                ta.clear()
            else:
                to.pop(nombre, None)
                ta.pop(nombre, None)

    def coord(val, digitos):
        if '.' in val:
            return float(val) * escala
        return int(val) / (10 ** digitos) * escala

    def fin_contorno():
        if region and len(contorno) >= 3 and oscuro:
            out['regiones'].append({'pts': [(px, -py) for px, py in contorno], 'atrib': atributos()})

    i = 0
    n = len(texto)
    while i < n:
        c = texto[i]
        if c in ' \r\n\t':
            i += 1
            continue
        if c == '%':
            j = texto.index('%', i + 1)
            bloque = texto[i + 1:j]
            i = j + 1
            partes = [s.strip() for s in bloque.split('*') if s.strip()]
            if not partes:
                continue
            p0 = partes[0]
            if p0.startswith('FS'):
                m = re.search(r'X(\d)(\d)Y(\d)(\d)', p0)
                fx, fy = int(m.group(2)), int(m.group(4))
            elif p0.startswith('MO'):
                escala = 25.4 if p0[2:4] == 'IN' else 1.0
            elif p0.startswith('AM'):
                nombre = p0[2:]
                prims = []
                for s in partes[1:]:
                    s = s.replace('\n', '').replace('\r', '')
                    if s.startswith('0 ') or s == '0':
                        continue
                    prims.append([t.strip() for t in s.split(',')])
                macros[nombre] = prims
            elif p0.startswith('AD'):
                m = re.match(r'ADD(\d+)([A-Za-z_][A-Za-z0-9_.]*)(?:,(.*))?$', p0)
                codigo, forma, args = int(m.group(1)), m.group(2), m.group(3)
                params = [float(v) for v in args.split('X')] if args else []
                if forma in ('C', 'R', 'O', 'P'):
                    aperturas[codigo] = Apertura(forma, params, ta.get('.AperFunction', ''))
                else:
                    aperturas[codigo] = Apertura(forma, params, ta.get('.AperFunction', ''), macros.get(forma))
            elif p0.startswith('LP'):
                oscuro = p0[2] == 'D'
            elif p0.startswith(('TO', 'TA', 'TD')):
                leer_attr(p0)
            continue
        j = texto.index('*', i)
        palabra = texto[i:j].strip()
        i = j + 1
        if not palabra:
            continue
        if palabra.startswith('G04'):
            m = re.match(r'G04 #@! (T[OAD].*)$', palabra)
            if m:
                leer_attr(m.group(1).strip())
            continue
        if palabra.startswith('M02'):
            break
        m = re.match(r'G0?([0-9]+)(.*)$', palabra)
        if m:
            g = int(m.group(1))
            if g in (1, 2, 3):
                interp = 'G0%d' % g
            elif g == 36:
                region = True
                contorno = []
            elif g == 37:
                fin_contorno()
                region = False
                contorno = []
            palabra = m.group(2).strip()
            if not palabra:
                continue
        m = re.match(r'^D(\d+)$', palabra)
        if m and int(m.group(1)) >= 10:
            actual = aperturas.get(int(m.group(1)))
            continue
        vals = dict((k, v) for k, v in _COORD.findall(palabra))
        d = re.search(r'D0?([123])$', palabra)
        nx = coord(vals['X'], fx) if 'X' in vals else x
        ny = coord(vals['Y'], fy) if 'Y' in vals else y
        if not d:
            x, y = nx, ny
            continue
        op = int(d.group(1))
        if op == 2:
            if region:
                fin_contorno()
                contorno = [(nx, ny)]
            x, y = nx, ny
        elif op == 3:
            if oscuro and actual is not None:
                out['destellos'].append({'x': nx, 'y': -ny, 'ap': actual, 'atrib': atributos()})
            x, y = nx, ny
        else:
            if interp == 'G01':
                pts = [(nx, ny)]
            else:
                ci = coord(vals.get('I', '0'), fx)
                cj = coord(vals.get('J', '0'), fy)
                pts = _arco((x, y), (nx, ny), (x + ci, y + cj), interp == 'G02')
            if region:
                if not contorno:
                    contorno = [(x, y)]
                contorno.extend(pts)
            elif oscuro and actual is not None:
                out['trazos'].append({'pts': [(x, -y)] + [(px, -py) for px, py in pts], 'w': actual.ancho_trazo(),
                                      'ap': actual, 'atrib': atributos()})
            x, y = nx, ny
    return out


def leer_excellon(texto):
    """Holes of a KiCad Excellon file (metric, decimal): round holes and routed slots, board coordinates."""
    herramientas = {}
    funcion = {}
    taladros = []
    actual = None
    ultima_funcion = ''
    ruta = None
    x = y = 0.0
    cabecera = True
    for linea in texto.splitlines():
        s = linea.strip()
        if not s:
            continue
        if s.startswith(';'):
            m = re.search(r'TA\.AperFunction,(.*)$', s)
            if m:
                ultima_funcion = m.group(1)
            continue
        if cabecera:
            m = re.match(r'^T(\d+)C([\d.]+)', s)
            if m:
                herramientas[int(m.group(1))] = float(m.group(2))
                funcion[int(m.group(1))] = ultima_funcion
                continue
            if s == '%':
                cabecera = False
            continue
        m = re.match(r'^T(\d+)$', s)
        if m:
            actual = int(m.group(1))
            continue
        if s in ('M30', 'G90', 'G05', 'M16') or s.startswith('M'):
            if s == 'M16':
                ruta = None
            continue
        m = re.match(r'^(G0[01])?X([+-]?[\d.]+)Y([+-]?[\d.]+)$', s)
        if not m:
            continue
        nx, ny = float(m.group(2)), -float(m.group(3))
        g = m.group(1)
        d = herramientas.get(actual, 0.0)
        if g == 'G00':
            ruta = (nx, ny)
        elif g == 'G01' and ruta is not None:
            (x0, y0) = ruta
            taladros.append({'x': (x0 + nx) / 2, 'y': (y0 + ny) / 2, 'd': d, 'ranura': [(x0, y0), (nx, ny)],
                             'funcion': funcion.get(actual, '')})
            ruta = None
        else:
            taladros.append({'x': nx, 'y': ny, 'd': d, 'ranura': None, 'funcion': funcion.get(actual, '')})
        x, y = nx, ny
    return taladros
