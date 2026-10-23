#!/usr/bin/env python3
"""Catalogue of the book's usable formulas for the live calculators (ESQUEMA.md, «Calculadoras»).

    python3 contenido/formulas.py            (or called from generar.py: formulas.main())

Reads the generated parts (web/public/libro/partes/*.json, refs.json, indice.json), matches every curated
formula of formulas_cat*.py to its `ec` blocks, checks it (expression, variables, ranges, solved forms, the
book's own worked example) and writes web/public/libro/formulas.json and formulas-ec.json (the small map the
reader fetches for its «Calcular» buttons). Fails (exit 1) when a formula does not match the book or a check
does not hold, so a change in the book reaches the curated data.
"""
import itertools
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import formulas_expr as X          # noqa: E402
from formulas_vars import VAR, unidad_con_prefijo   # noqa: E402

APP = os.path.dirname(HERE)
OUT = os.path.join(APP, 'web/public/libro')

TOL_EJEMPLO = 0.015       # relative tolerance of a book example (the book rounds to 3 significant digits)


# ------------------------------------------------------------------ values written as in the book
_PREF = {'c': 1e-2, 'f': 1e-15, 'p': 1e-12, 'n': 1e-9, 'µ': 1e-6, 'μ': 1e-6, 'u': 1e-6, 'm': 1e-3, '': 1.0,
         'k': 1e3, 'K': 1e3, 'M': 1e6, 'G': 1e9, 'T': 1e12}


def valor(s, unidad=''):
    """«4,7 kΩ», «100 nF», «2,2 µ», «4k7», «1 930», «−6 dB», 12.5 -> float in the variable's unit."""
    if isinstance(s, (int, float)):
        return float(s)
    t = s.strip().replace('−', '-').replace(' ', ' ').replace(' ', ' ').replace('\xa0', ' ')
    if unidad and t.endswith(unidad):
        t = t[: -len(unidad)].rstrip()
    m = re.fullmatch(r'([-+]?\d+)([pnµuμmkKMG])(\d+)', t)          # 4k7, 2u2
    if m:
        return float(m.group(1) + '.' + m.group(3)) * _PREF[m.group(2)]
    m = re.fullmatch(r'([-+]?[\d ]*\d(?:[.,]\d+)?(?:[eE][-+]?\d+)?)\s*([fpnµuμmckKMGT]?)', t)
    if not m:
        raise ValueError(f'valor ilegible «{s}» ({unidad})')
    num = m.group(1).replace(' ', '').replace(',', '.')
    p = m.group(2)
    if p and not unidad_con_prefijo(unidad):
        raise ValueError(f'prefijo en una unidad sin prefijos: «{s}» ({unidad})')
    return float(num) * _PREF[p]


# ------------------------------------------------------------------ the curated entries
class Formula:
    def __init__(self, id, nombre, parte, ec, ecuacion, vars=None, ej=None, tol=None, sec=None, nota=None,
                 claves='', no=(), errata=None, ej_libro=None, origen=None):
        self.id = id
        self.nombre = nombre
        self.parte = parte
        self.ec = [ec] if isinstance(ec, (str, tuple)) else list(ec)
        self.ecuacion = ecuacion
        self.vars = vars or {}
        self.ej = ej
        self.tol = tol if tol is not None else TOL_EJEMPLO
        self.sec = sec
        self.nota = nota
        self.claves = claves
        self.no = set(no.split() if isinstance(no, str) else no)   # variables that cannot be solved for
        self.errata = errata            # what is wrong in the book (reported), with ej holding the right values
        self.ej_libro = ej_libro        # the book's (wrong) printed result, for the report
        self.origen = origen            # where the example is in the book, when not the formula's own section


CATALOGO = []


def F(*a, **k):
    f = Formula(*a, **k)
    CATALOGO.append(f)
    return f


# ------------------------------------------------------------------ the book's equations
def recorrer_partes():
    """[(stem, [ec occurrence])] with section label, inside-card flag and card index."""
    indice = json.load(open(os.path.join(OUT, 'indice.json'), encoding='utf-8'))
    orden = [p for t in indice['tomos'] for p in t['partes']]
    res = {}
    contador = itertools.count()      # reading order of every equation of the book
    for stem in orden:
        path = os.path.join(OUT, 'partes', stem + '.json')
        if not os.path.exists(path):
            continue
        parte = json.load(open(path, encoding='utf-8'))
        ocurr = []
        estado = {'sec': parte.get('label') or stem, 'sub': None, 'tarjeta': -1, 'n_tarjetas': 0}

        def walk(bs, en_tarjeta=None, en_deduccion=False):
            for b in bs:
                t = b['t']
                if t == 'h2':
                    estado['sec'] = b['label']
                    estado['sub'] = None
                elif t == 'h3' and b.get('label'):
                    estado['sub'] = b['label']
                elif t == 'ec':
                    ocurr.append({'pos': next(contador), 'svg': b['svg'], 'fuente': b['fuente'], 'w': b['w'], 'h': b['h'],
                                  'sec': estado['sec'], 'sub': estado['sub'], 'tarjeta': en_tarjeta,
                                  'deduccion': en_deduccion})
                if t == 'tarjeta':
                    k = estado['n_tarjetas']
                    estado['n_tarjetas'] += 1
                    walk(b['bloques'], k, en_deduccion)
                elif t == 'deduccion':
                    walk(b['bloques'], en_tarjeta, True)
                elif t == 'ejercicios':
                    for it in b['items']:
                        walk(it['bloques'], en_tarjeta, en_deduccion)
                        walk(it.get('solucion') or [], en_tarjeta, en_deduccion)
                elif 'bloques' in b:
                    walk(b['bloques'], en_tarjeta, en_deduccion)
        walk(parte['bloques'])
        res[stem] = ocurr
    return res, indice


# ------------------------------------------------------------------ build
def html_simbolo(vid):
    """'V_CC' -> V<sub>CC</sub>, 'tau' -> τ, 'r_pi' -> r<sub>π</sub>, 'f_c2' -> f<sub>c2</sub>."""
    from formulas_vars import GRIEGAS
    base, _, sub = vid.partition('_')
    base = GRIEGAS.get(base, base)
    if not sub:
        return base
    partes = [GRIEGAS.get(p, p) for p in sub.split('_')]
    return f'{base}<sub>{",".join(partes) if len(partes) > 1 and all(len(p) > 1 for p in partes) else "".join(partes)}</sub>'


def construir_variable(f, vid, problemas):
    base = dict(VAR.get(vid, {}))
    o = f.vars.get(vid)
    if isinstance(o, str):
        base['n'] = o
    elif isinstance(o, tuple):          # (name, unit, min, max[, default])
        base.update(n=o[0], u=o[1], r=(o[2], o[3]))
        base.pop('d', None)
        base.pop('sim', None)
        if len(o) > 4:
            base['d'] = o[4]
    elif isinstance(o, dict):
        if 'u' in o:                    # another unit: nothing of the common variable applies
            base = {}
        base.update(o)
    for k in ('n', 'u', 'r'):
        if k not in base:
            problemas.append(f'{f.id}: la variable «{vid}» no tiene «{k}» (ni en VAR ni en la fórmula)')
            return None
    u = base['u']
    try:
        lo, hi = (valor(x, u) for x in base['r'])
        d = valor(base['d'], u) if 'd' in base else None
    except ValueError as e:
        problemas.append(f'{f.id}: {e}')
        return None
    v = {'id': vid, 'nombre': base['n'], 'sim': base.get('sim') or html_simbolo(vid), 'unidad': u,
         'min': lo, 'max': hi}
    if d is not None:
        v['defecto'] = d
    if base.get('entero'):
        v['entero'] = True
    if base.get('lineal') or lo <= 0:
        v['escala'] = 'lineal'
    else:
        v['escala'] = 'log' if hi / lo >= 20 else 'lineal'
    return v


def comprobar_ejemplo(f, lhs, rhs, vs, problemas):
    """The book's worked example: inputs give the printed result. Returns (valores, resultado) or None."""
    porid = {v['id']: v for v in vs}
    vals = {}
    for k, s in f.ej.items():
        if k not in porid:
            problemas.append(f'{f.id}: el ejemplo usa «{k}», que no es una variable')
            return None
        try:
            vals[k] = valor(s, porid[k]['unidad'])
        except ValueError as e:
            problemas.append(f'{f.id}: {e}')
            return None
    if lhs not in vals:
        problemas.append(f'{f.id}: el ejemplo no da el resultado «{lhs}»')
        return None
    faltan = [v['id'] for v in vs if v['id'] not in vals]
    if faltan:
        problemas.append(f'{f.id}: al ejemplo le faltan {faltan}')
        return None
    calc = X.evaluar(rhs, vals)
    esperado = vals[lhs]
    if not _cerca(calc, esperado, f.tol):
        problemas.append(f'{f.id}: el ejemplo del libro no cuadra: {lhs} = {calc:.6g} calculado, '
                         f'{esperado:.6g} en el libro ({f.ej})')
        return None
    return vals, calc


def _esp(s):
    """Thin and no-break spaces of the book's math read as plain spaces when matching."""
    return re.sub(r'[\u2009\u202f\xa0]', ' ', s)


def _cerca(a, b, tol):
    if not (math.isfinite(a) and math.isfinite(b)):
        return False
    if b == 0:
        return abs(a) <= tol
    return abs(a - b) <= tol * abs(b)


def construir(f, ocurrencias, refs, indice, problemas):
    # --- the equation
    try:
        izq, der = f.ecuacion.split('=', 1)
        lhs = izq.strip()
        rhs = X.parse(der)
    except (ValueError, X.ErrorExpresion) as e:
        problemas.append(f'{f.id}: ecuación ilegible: {e}')
        return None
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', lhs):
        problemas.append(f'{f.id}: el lado izquierdo debe ser una variable: «{lhs}»')
        return None
    ids = [lhs] + sorted(X.variables(rhs) - {lhs}, key=lambda s: (list(f.vars).index(s) if s in f.vars else 99, s))
    if lhs in X.variables(rhs):
        problemas.append(f'{f.id}: «{lhs}» aparece en los dos lados')
        return None
    for k in f.vars:
        if k not in ids:
            problemas.append(f'{f.id}: variable «{k}» descrita pero ausente de la ecuación')
    vs = []
    for vid in ids:
        if vid in X.CONSTANTES or vid in X.FUNCIONES:
            problemas.append(f'{f.id}: «{vid}» es un nombre reservado')
            return None
        v = construir_variable(f, vid, problemas)
        if v is None:
            return None
        vs.append(v)

    # --- the book's equation blocks
    ecs = []
    for sub in f.ec:
        parte = f.parte
        if isinstance(sub, tuple):          # (part, substring): the formula also appears in another part
            parte, sub = sub
        if sub.endswith('$'):               # «… $»: the equation ends there
            fin = _esp(sub[:-1]).strip()
            hits = [o for o in ocurrencias.get(parte, []) if _esp(o['fuente']).strip().endswith(fin)]
        else:
            hits = [o for o in ocurrencias.get(parte, []) if _esp(sub) in _esp(o['fuente'])]
        if not hits:
            problemas.append(f'{f.id}: ninguna ecuación de {parte} contiene «{sub}»')
            return None
        ecs += [h for h in hits if h not in ecs]
    principal = next((o for o in ecs if o['tarjeta'] is None and not o['deduccion']), None) \
        or next((o for o in ecs if o['tarjeta'] is None), ecs[0])
    sec = f.sec or principal['sec']
    if sec not in refs:
        problemas.append(f'{f.id}: la sección «{sec}» no está en refs.json')
        return None

    # --- example and defaults
    ejemplo = None
    if f.ej:
        r = comprobar_ejemplo(f, lhs, rhs, vs, problemas)
        if r is None:
            return None
        vals, calc = r
        ejemplo = {'valores': {k: vals[k] for k in ids if k != lhs}, 'resultado': calc,
                   'libro': vals[lhs]}
        if f.origen:
            def num(m):
                if m.group(1) not in refs:
                    problemas.append(f'{f.id}: el origen cita «{m.group(1)}», que no está en refs.json')
                    return m.group(0)
                return refs[m.group(1)]['num']
            ejemplo['origen'] = re.sub(r'@([a-z]+-[\w.]+?)(?=[\s,:;)]|$)', num, f.origen)
        if f.errata:
            ejemplo['errata'] = f.errata
        for v in vs:
            v['defecto'] = vals[v['id']] if v['id'] != lhs else calc
    for v in vs:
        if 'defecto' not in v:
            lo, hi = v['min'], v['max']
            v['defecto'] = math.sqrt(lo * hi) if v['escala'] == 'log' else (lo + hi) / 2
    env = {v['id']: v['defecto'] for v in vs if v['id'] != lhs}
    res = X.evaluar(rhs, env)
    if not math.isfinite(res):
        problemas.append(f'{f.id}: con los valores por defecto el resultado no es finito')
        return None
    porid = {v['id']: v for v in vs}
    porid[lhs]['defecto'] = res
    # ranges must hold the defaults (the example is the book's: the range is widened, not the example)
    for v in vs:
        d = v['defecto']
        if not (v['min'] <= d <= v['max']):
            problemas.append(f'{f.id}: el valor por defecto de «{v["id"]}» ({d:.4g}) cae fuera de su intervalo '
                             f'[{v["min"]:.4g}, {v["max"]:.4g}]')

    # --- solved forms: symbolic when the variable occurs once, else numeric; both checked here
    despejes = {}
    entorno = dict(env, **{lhs: res})
    for v in vs:
        vid = v['id']
        if vid == lhs or vid in f.no or v.get('entero'):
            continue
        sol = X.aislar(rhs, vid, ('var', lhs))
        txt = None
        if sol is not None:
            e2 = {k: x for k, x in entorno.items() if k != vid}
            try:
                got = X.evaluar(sol, e2)
            except Exception:       # noqa: BLE001
                got = math.nan
            if _cerca(got, v['defecto'], 1e-9) or (v['defecto'] == 0 and abs(got) < 1e-12):
                txt = X.texto(sol)
        if txt is not None:
            despejes[vid] = txt
            continue

        def g(x, vid=vid):
            e = dict(entorno)
            e[vid] = x
            return X.evaluar(rhs, e) - res
        raiz, _n = X.resolver_numerico(g, v['defecto'], v['min'], v['max'], v['escala'] == 'log', abs(res))
        if raiz is not None and _cerca(raiz, v['defecto'], 1e-6):
            despejes[vid] = None          # numeric (bracketed) in the app
        else:
            problemas.append(f'{f.id}: no se puede despejar «{vid}» ni numéricamente (raíz {raiz})')

    ref = refs[sec]
    parte_sec = ref['parte']
    titulo_sec = next((s['titulo'] for s in indice['partes'][parte_sec]['secciones'] if s['label'] == sec), '')
    out = {
        'id': f.id, 'nombre': f.nombre, 'parte': parte_sec,
        'cap': indice['partes'][parte_sec].get('num'),
        'seccion': {'label': sec, 'num': ref['num'], 'titulo': titulo_sec},
        'fuente': principal['fuente'], 'svg': principal['svg'], 'w': principal['w'], 'h': principal['h'],
        'ecuacion': f.ecuacion, 'resultado': lhs, 'expr': X.texto(rhs),
        'vars': vs, 'despejes': despejes,
    }
    out['_pos'] = principal['pos']
    if principal.get('sub') and not f.sec:
        out['sub'] = principal['sub']
    if ejemplo:
        out['ejemplo'] = ejemplo
    if f.nota:
        out['nota'] = f.nota
    if f.claves:
        out['claves'] = f.claves
    return out, ecs


def main():
    import formulas_cat1  # noqa: F401  (each module appends to CATALOGO)
    import formulas_cat2  # noqa: F401
    import formulas_cat3  # noqa: F401
    import formulas_cat4  # noqa: F401
    import formulas as modulo     # the catalogue lives in the imported module, also when run as a script
    refs = json.load(open(os.path.join(OUT, 'refs.json'), encoding='utf-8'))
    ocurrencias, indice = recorrer_partes()
    problemas = []
    vistos = set()
    formulas = []
    por_svg = {}
    for f in modulo.CATALOGO:
        if f.id in vistos:
            problemas.append(f'id repetido «{f.id}»')
            continue
        vistos.add(f.id)
        r = construir(f, ocurrencias, refs, indice, problemas)
        if r is None:
            continue
        out, ecs = r
        formulas.append(out)
        for o in ecs:
            por_svg.setdefault(o['svg'], [])
            if out['id'] not in por_svg[o['svg']]:
                por_svg[o['svg']].append(out['id'])
    formulas.sort(key=lambda x: x.pop('_pos'))   # book order
    # families, illustrations, explanations from the book and links (formulas_enriquecer.py)
    from formulas_enriquecer import enriquecer
    familias = enriquecer(formulas, refs, indice, OUT, problemas)
    # the same equation elsewhere in the book has the same SVG (named by its source), so it gets the button too
    # cards: the formulas of every card, in order
    tarjetas = []
    for stem, os_ in ocurrencias.items():
        k_prev = None
        for o in os_:
            if o['tarjeta'] is None or o['svg'] not in por_svg:
                continue
            if k_prev != o['tarjeta']:
                tarjetas.append({'parte': stem, 'indice': o['tarjeta'], 'seccion': o['sec'], 'formulas': []})
                k_prev = o['tarjeta']
            for i in por_svg[o['svg']]:
                if i not in tarjetas[-1]['formulas']:
                    tarjetas[-1]['formulas'].append(i)

    con_ejemplo = sum(1 for x in formulas if 'ejemplo' in x)
    erratas = [(x['id'], x['seccion']['num'], x['ejemplo']['errata']) for x in formulas
               if 'ejemplo' in x and 'errata' in x['ejemplo']]
    doc = {'version': 1, 'total': len(formulas), 'con_ejemplo': con_ejemplo, 'formulas': formulas,
           'tarjetas': tarjetas, 'familias': familias,
           'cobertura': {'esquema': sum(1 for x in formulas if 'esquema' in x.get('figura', {})),
                         'grafico': sum(1 for x in formulas if x.get('figura', {}).get('grafico', {}).get('p') not in (None, 'respuesta')),
                         'explicacion': sum(1 for x in formulas if 'explicacion' in x),
                         'ejercicios': sum(1 for x in formulas if 'ejercicios' in x),
                         'simulador': sum(1 for x in formulas if 'simulador' in x)}}
    with open(os.path.join(OUT, 'formulas.json'), 'w', encoding='utf-8') as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, 'formulas-ec.json'), 'w', encoding='utf-8') as fh:
        json.dump(por_svg, fh, ensure_ascii=False, separators=(',', ':'))

    n_ec = sum(len(v) for v in ocurrencias.values())
    print(f'formulas: {len(formulas)} fórmulas ({con_ejemplo} con el ejemplo del libro comprobado), '
          f'{len(por_svg)} ecuaciones con «Calcular» de {n_ec}, {len(tarjetas)} tarjetas vivas')
    simb = sum(1 for x in formulas for v in x['despejes'].values() if v)
    num = sum(1 for x in formulas for v in x['despejes'].values() if v is None)
    print(f'formulas: despejes simbólicos {simb}, numéricos {num}')
    cob = doc['cobertura']
    print(f'formulas: {len(familias)} familias; con esquema {cob["esquema"]}, con gráfico propio {cob["grafico"]}, '
          f'con explicación del libro {cob["explicacion"]}, con ejercicios {cob["ejercicios"]}, con simulación {cob["simulador"]}')
    for i, s, e in erratas:
        print(f'formulas: errata del libro en {s} ({i}): {e}')
    for p in problemas:
        print('formulas: PROBLEMA', p)
    return 1 if problemas else 0


if __name__ == '__main__':
    sys.exit(main())
