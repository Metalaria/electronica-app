"""The small, safe expression language of the formula calculators (ESQUEMA.md, «Calculadoras»).

The same grammar is implemented in TypeScript (web/src/componentes/calculadoras/expresion.ts); this module
parses, evaluates, inverts and prints it so the generator can check every formula and emit solved forms.

    expr   := sum
    sum    := prod (('+' | '-') prod)*
    prod   := unary (('*' | '/') unary)*
    unary  := '-' unary | power
    power  := atom ('^' unary)?             (right associative: 2^3^2 = 2^9; -x^2 = -(x^2))
    atom   := number | name | name '(' expr (',' expr)* ')' | '(' expr ')'

Numbers use a decimal point (1.5, 2e-3). Names are variables or constants (CONSTANTES); functions are FUNCIONES.
Nothing is ever passed to eval(). AST nodes are tuples:
    ('num', v) ('var', name) ('const', name) ('neg', a) ('+', a, b) ('-', a, b) ('*', a, b) ('/', a, b)
    ('^', a, b) ('fn', name, (args...))
"""
import math
import re

CONSTANTES = {
    'pi': math.pi,
    'k_B': 1.380649e-23,       # Boltzmann constant, J/K
    'q_e': 1.602176634e-19,    # elementary charge, C
    'c_0': 299792458.0,        # speed of light, m/s
    'mu_0': 1.25663706212e-6,  # vacuum permeability, H/m
    'eps_0': 8.8541878128e-12,  # vacuum permittivity, F/m
    'h_P': 6.62607015e-34,     # Planck constant, J·s
}


def _par(*xs):
    s = 0.0
    for x in xs:
        if x == 0:
            return 0.0
        s += 1.0 / x
    return 1.0 / s


def _safe(f):
    def g(*a):
        try:
            v = f(*a)
        except (ValueError, ZeroDivisionError, OverflowError):
            return math.nan
        if isinstance(v, complex):
            return math.nan
        return float(v)
    return g


FUNCIONES = {
    'sqrt': (1, _safe(math.sqrt)),
    'exp': (1, _safe(math.exp)),
    'ln': (1, _safe(math.log)),
    'log10': (1, _safe(math.log10)),
    'log2': (1, _safe(math.log2)),
    'sin': (1, _safe(math.sin)),
    'cos': (1, _safe(math.cos)),
    'tan': (1, _safe(math.tan)),
    'asin': (1, _safe(math.asin)),
    'acos': (1, _safe(math.acos)),
    'atan': (1, _safe(math.atan)),
    'sinh': (1, _safe(math.sinh)),
    'cosh': (1, _safe(math.cosh)),
    'tanh': (1, _safe(math.tanh)),
    'asinh': (1, _safe(math.asinh)),
    'acosh': (1, _safe(math.acosh)),
    'atanh': (1, _safe(math.atanh)),
    'abs': (1, _safe(abs)),
    'floor': (1, _safe(math.floor)),
    'ceil': (1, _safe(math.ceil)),
    'round': (1, _safe(lambda x: math.floor(x + 0.5))),
    'atan2': (2, _safe(math.atan2)),
    'min': (-1, _safe(min)),
    'max': (-1, _safe(max)),
    'par': (-1, _safe(_par)),   # resistors in parallel: 1 / (1/a + 1/b + ...)
}

# Inverse of each one-argument function on its principal branch (for the symbolic solver).
INVERSAS = {'sqrt': None, 'exp': 'ln', 'ln': 'exp', 'log10': None, 'log2': None, 'sin': 'asin', 'cos': 'acos',
            'tan': 'atan', 'asin': 'sin', 'acos': 'cos', 'atan': 'tan', 'sinh': 'asinh', 'cosh': 'acosh',
            'tanh': 'atanh', 'asinh': 'sinh', 'acosh': 'cosh', 'atanh': 'tanh'}

_TOKEN = re.compile(r'\s*(?:(\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(.))')


class ErrorExpresion(ValueError):
    pass


def tokens(s):
    out = []
    pos = 0
    s = s.rstrip()
    while pos < len(s):
        m = _TOKEN.match(s, pos)
        if not m:
            break
        pos = m.end()
        if m.group(1):
            out.append(('n', float(m.group(1))))
        elif m.group(2):
            out.append(('id', m.group(2)))
        elif m.group(3):
            if m.group(3) not in '+-*/^(),':
                raise ErrorExpresion(f'carácter no válido «{m.group(3)}» en «{s}»')
            out.append(('op', m.group(3)))
    return out


def parse(s):
    ts = tokens(s)
    i = 0

    def peek():
        return ts[i] if i < len(ts) else ('fin', None)

    def take(kind=None, val=None):
        nonlocal i
        t = peek()
        if kind and (t[0] != kind or (val is not None and t[1] != val)):
            raise ErrorExpresion(f'se esperaba {val or kind} en «{s}» (token {i})')
        i += 1
        return t

    def suma():
        a = prod()
        while peek() in (('op', '+'), ('op', '-')):
            op = take()[1]
            a = (op, a, prod())
        return a

    def prod():
        a = unario()
        while peek() in (('op', '*'), ('op', '/')):
            op = take()[1]
            a = (op, a, unario())
        return a

    def unario():
        if peek() == ('op', '-'):
            take()
            return ('neg', unario())
        if peek() == ('op', '+'):
            take()
            return unario()
        return potencia()

    def potencia():
        a = atomo()
        if peek() == ('op', '^'):
            take()
            return ('^', a, unario())
        return a

    def atomo():
        t = take()
        if t[0] == 'n':
            return ('num', t[1])
        if t == ('op', '('):
            a = suma()
            take('op', ')')
            return a
        if t[0] == 'id':
            name = t[1]
            if peek() == ('op', '('):
                if name not in FUNCIONES:
                    raise ErrorExpresion(f'función desconocida «{name}» en «{s}»')
                take()
                args = [suma()]
                while peek() == ('op', ','):
                    take()
                    args.append(suma())
                take('op', ')')
                n = FUNCIONES[name][0]
                if n > 0 and len(args) != n:
                    raise ErrorExpresion(f'{name} lleva {n} argumentos en «{s}»')
                return ('fn', name, tuple(args))
            if name in CONSTANTES:
                return ('const', name)
            if name in FUNCIONES:
                raise ErrorExpresion(f'«{name}» es una función en «{s}»')
            return ('var', name)
        raise ErrorExpresion(f'expresión incompleta «{s}»')

    a = suma()
    if i != len(ts):
        raise ErrorExpresion(f'sobra texto en «{s}» (token {i})')
    return a


def variables(a, out=None):
    out = set() if out is None else out
    k = a[0]
    if k == 'var':
        out.add(a[1])
    elif k == 'neg':
        variables(a[1], out)
    elif k == 'fn':
        for x in a[2]:
            variables(x, out)
    elif k in '+-*/^':
        variables(a[1], out)
        variables(a[2], out)
    return out


def cuenta(a, name):
    k = a[0]
    if k == 'var':
        return 1 if a[1] == name else 0
    if k == 'neg':
        return cuenta(a[1], name)
    if k == 'fn':
        return sum(cuenta(x, name) for x in a[2])
    if k in '+-*/^':
        return cuenta(a[1], name) + cuenta(a[2], name)
    return 0


def evaluar(a, env):
    k = a[0]
    if k == 'num':
        return a[1]
    if k == 'var':
        return float(env[a[1]])
    if k == 'const':
        return CONSTANTES[a[1]]
    if k == 'neg':
        return -evaluar(a[1], env)
    if k == 'fn':
        return FUNCIONES[a[1]][1](*[evaluar(x, env) for x in a[2]])
    x, y = evaluar(a[1], env), evaluar(a[2], env)
    try:
        if k == '+':
            return x + y
        if k == '-':
            return x - y
        if k == '*':
            return x * y
        if k == '/':
            if y == 0:
                return math.inf if x > 0 else (-math.inf if x < 0 else math.nan)
            return x / y
        if k == '^':
            v = x ** y
            return math.nan if isinstance(v, complex) else float(v)
    except (OverflowError, ZeroDivisionError, ValueError):
        return math.nan
    raise ErrorExpresion(k)


# ------------------------------------------------------------------ printing (minimal parentheses)
_PREC = {'+': 1, '-': 1, '*': 2, '/': 2, 'neg': 3, '^': 4}


def _num(v):
    if v == int(v) and abs(v) < 1e15:
        return str(int(v))
    return repr(v)


def texto(a, ctx=0, derecha=False):
    k = a[0]
    if k == 'num':
        s = _num(a[1])
        return f'({s})' if a[1] < 0 else s
    if k in ('var', 'const'):
        return a[1]
    if k == 'fn':
        return a[1] + '(' + ', '.join(texto(x) for x in a[2]) + ')'
    if k == 'neg':
        s = '-' + texto(a[1], _PREC['neg'])
        return f'({s})' if ctx > _PREC['neg'] - 1 and ctx != 0 else s
    p = _PREC[k]
    if k == '^':
        s = texto(a[1], p + 1) + '^' + texto(a[2], p)
    else:
        s = texto(a[1], p) + k + texto(a[2], p + 1)
    return f'({s})' if p < ctx else s


# ------------------------------------------------------------------ symbolic solving
def _contiene(a, name):
    return cuenta(a, name) > 0


def aislar(rhs, objetivo, lhs):
    """Solves lhs = rhs for `objetivo`, which must occur exactly once in rhs. Returns an AST or None."""
    if cuenta(rhs, objetivo) != 1:
        return None
    a, L = rhs, lhs
    while True:
        k = a[0]
        if k == 'var':
            return L if a[1] == objetivo else None
        if k == 'neg':
            a, L = a[1], ('neg', L)
            continue
        if k == 'fn':
            name, args = a[1], a[2]
            if name == 'par':
                i = next(j for j, x in enumerate(args) if _contiene(x, objetivo))
                otros = [x for j, x in enumerate(args) if j != i]
                # 1/L = 1/x + sum(1/others)  ->  x = 1/(1/L - sum(1/others))
                s = ('/', ('num', 1.0), L)
                for o in otros:
                    s = ('-', s, ('/', ('num', 1.0), o))
                a, L = args[i], ('/', ('num', 1.0), s)
                continue
            if len(args) != 1:
                return None
            x = args[0]
            if name == 'sqrt':
                L = ('^', L, ('num', 2.0))
            elif name == 'log10':
                L = ('^', ('num', 10.0), L)
            elif name == 'log2':
                L = ('^', ('num', 2.0), L)
            elif INVERSAS.get(name):
                L = ('fn', INVERSAS[name], (L,))
            else:
                return None
            a = x
            continue
        x, y = a[1], a[2]
        en_x = _contiene(x, objetivo)
        if k == '+':
            a, L = (x, ('-', L, y)) if en_x else (y, ('-', L, x))
        elif k == '-':
            a, L = (x, ('+', L, y)) if en_x else (y, ('-', x, L))
        elif k == '*':
            a, L = (x, ('/', L, y)) if en_x else (y, ('/', L, x))
        elif k == '/':
            a, L = (x, ('*', L, y)) if en_x else (y, ('/', x, L))
        elif k == '^':
            if en_x:
                if y == ('num', 2.0):
                    a, L = x, ('fn', 'sqrt', (L,))
                else:
                    a, L = x, ('^', L, ('/', ('num', 1.0), y))
            else:
                a, L = y, ('/', ('fn', 'ln', (L,)), ('fn', 'ln', (x,)))
        else:
            return None


# ------------------------------------------------------------------ numeric solving (same as the app)
def muestras(x0, lo, hi, log):
    """Sample points of the bracketing scan: the widened range on its own scale, plus a dense stretch
    around the current value (log variables) or a symmetric logarithmic grid (linear variables), so that
    two close roots or a root far from the typical range are not missed."""
    xs = []
    if log and lo > 0:
        a, b = math.log(lo / 1e3), math.log(hi * 1e3)
        xs += [math.exp(a + (b - a) * i / 600) for i in range(601)]
        if x0 > 0 and math.isfinite(x0):
            c = math.log(x0)
            xs += [math.exp(c + math.log(100) * (i / 100 - 1)) for i in range(201)]
    else:
        w = (hi - lo) or 1.0
        a, b = lo - w, hi + w
        xs += [a + (b - a) * i / 600 for i in range(601)]
        S = 3 * max(abs(lo), abs(hi), abs(x0) if math.isfinite(x0) else 0, 1e-300)
        for i in range(301):
            m = S * 10 ** (-12 * i / 300)
            xs += [m, -m]
        xs.append(0.0)
    return sorted(set(xs))


def resolver_numerico(g, x0, lo, hi, log, escala=0.0):
    """Root of g(x) = 0 near x0: scan the samples for sign changes, then bisection. A bracket is a root
    when |g| shrinks there (a pole or a jump also changes sign, but |g| does not shrink). `escala` is the
    size of the target value (absolute tolerance). Mirrors resolverNumerico() of
    web/src/componentes/calculadoras/expresion.ts. Returns (root, number of roots found)."""
    xs = muestras(x0, lo, hi, log)
    gs = []
    for x in xs:
        try:
            v = g(x)
        except (ValueError, ZeroDivisionError, OverflowError):
            v = math.nan
        gs.append(v)
    raices = []
    for i in range(len(xs) - 1):
        g0, g1 = gs[i], gs[i + 1]
        if not (math.isfinite(g0) and math.isfinite(g1)):
            continue
        if g0 == 0:
            raices.append(xs[i])
            continue
        if g0 * g1 >= 0:
            continue
        x1, x2, f1 = xs[i], xs[i + 1], g0
        tope = max(abs(g0), abs(g1))
        for _ in range(200):
            m = 0.5 * (x1 + x2)
            fm = g(m)
            if not math.isfinite(fm):
                break
            if fm == 0 or abs(x2 - x1) <= 1e-15 * abs(m):
                x1 = x2 = m
                break
            if (fm < 0) == (f1 < 0):
                x1, f1 = m, fm
            else:
                x2 = m
        r = 0.5 * (x1 + x2)
        fr = g(r)
        if math.isfinite(fr) and (abs(fr) <= 1e-3 * tope or abs(fr) <= 1e-9 * escala):
            raices.append(r)
    if not raices:
        return None, 0
    if log and x0 > 0:
        mejor = min(raices, key=lambda r: abs(math.log(r / x0)) if r > 0 else math.inf)
    else:
        mejor = min(raices, key=lambda r: abs(r - x0))
    return mejor, len(raices)
