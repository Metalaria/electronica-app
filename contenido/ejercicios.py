#!/usr/bin/env python3
"""Self-checking exercises and problems: web/public/libro/ejercicios.json.

    cd /home/claude/app && python3 contenido/ejercicios.py [--revisar FICHERO]

Reads the generated parts (web/public/libro/partes/*.json, written by generar.py, which calls main() at
the end) and, for each exercise (`ejercicios` blocks) and each problem (h3 «Problema …» sections, labels
`prob-*`), works out what the reader can type and check:

  * numeric answers (value in SI base units, unit, tolerance, alternative acceptable values) extracted
    automatically from the solution text (the last value of each «X = … = 12,5 mA» chain), or
  * a class for answers that cannot be checked automatically (choice, short text, derivation, design),
    for which the app offers «comparar con la solución»,
  * two progressive hints (the approach, then an intermediate result).

The automatic pass is a heuristic; contenido/ejercicios_curado.txt overrides it item by item (format at
the top of that file). The curated file wins wherever it says something. The contract is ESQUEMA.md
(«Ejercicios autocomprobables»). --revisar writes a text dump (statement, solution, result) for review.
"""
import html as htmlmod
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, 'web/public/libro')
CURADO = os.path.join(HERE, 'ejercicios_curado.txt')

VERSION = 1
TOL_DEFECTO = 0.02          # relative tolerance when the book's rounding is finer than 2 %
TOL_MAX_REDONDEO = 0.06     # never accept more than 6 % just because the book rounds coarsely

# ------------------------------------------------------------------ units

PREFIJOS = {'p': 1e-12, 'n': 1e-9, 'µ': 1e-6, 'u': 1e-6, 'μ': 1e-6, 'm': 1e-3, 'k': 1e3, 'K': 1e3,
            'M': 1e6, 'G': 1e9, 'T': 1e12}
# Units that take SI prefixes (the value is stored in the bare unit).
PREFIJABLES = ['Ω', 'V', 'A', 'W', 'F', 'H', 'Hz', 's', 'J', 'C', 'S', 'Wb', 'T', 'VA', 'var', 'Wh', 'Ah',
               'm', 'g', 'bit/s', 'b/s', 'B', 'bit', 'Bd', 'baud', 'Pa', 'N', 'VAr', 'lm', 'lx', 'cd', 'Sa/s',
               'S/s', 'FLOPS', 'V/s', 'A/s', 'V/V']
# Units written as a whole (no prefix analysis): compound or prefix-like.
ATOMICAS = ['dBm', 'dBV', 'dBu', 'dBc', 'dBi', 'dBµV', 'dB/década', 'dB/dec', 'dB/octava', 'dB', '%', '°C/W',
            'K/W', '°C', '°', 'ppm/°C', 'ppm', 'V/µs', 'mV/µs', 'Ω·m', 'mm²', 'cm²', 'm²', 'mm', 'cm', 'km', 'µm',
            'nm', 'min', 'h', 'rpm', 'K', 'Ω/sq', 'mA/V', 'A/V', 'mS', 'µS', 'nV/√Hz', 'pA/√Hz', 'V/√Hz',
            'lm/W', 'W/m²', 'Wh/kg', 'bits', 'LSB', 'ciclos', 'muestras', 'veces', 'dB(A)', 'mAh', 'kWh',
            'mWh', 'kVA', 'kHz', 'MHz', 'GHz', 'mΩ', 'kΩ', 'MΩ', 'rad/s', 'krad/s', 'rad', 'dB/V',
            'V/V', 'Ω/V', 'Hz/V', 'V/A', 'A/A', 'g', 'kg', 'mm/s', 'm/s', 'km/h', 'N·m', 'bit', 'kbit/s', 'mm/ns', 'cm/ns', 'ns/m', 'dB/m', 'dB/km',
            'palabras', 'ciclos/muestra', 'MAC/s']
# Atomic spellings that are really prefixed units: normalise them to the bare unit.
ATOMICAS_PREFIJO = {'mAh': ('Ah', 1e-3), 'kWh': ('Wh', 1e3), 'mWh': ('Wh', 1e-3), 'kVA': ('VA', 1e3),
                    'kHz': ('Hz', 1e3), 'MHz': ('Hz', 1e6), 'GHz': ('Hz', 1e9), 'mΩ': ('Ω', 1e-3),
                    'kΩ': ('Ω', 1e3), 'MΩ': ('Ω', 1e6), 'mS': ('S', 1e-3), 'µS': ('S', 1e-6),
                    'mA/V': ('A/V', 1e-3), 'mV/µs': ('V/µs', 1e-3)}
ALIAS = {'ohm': 'Ω', 'ohms': 'Ω', 'ohmios': 'Ω', 'Ohm': 'Ω', 'grados': '°', 'º': '°', 'ºC': '°C', 'hz': 'Hz',
         'HZ': 'Hz', 'seg': 's', 'V·A': 'VA', 'μ': 'µ'}

SUPER = str.maketrans('⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺', '0123456789-+')
ESPACIOS = '    '

NUM_RE = (r'[−\-+]?(?:\d{1,3}(?:[    ]\d{3})+|\d+)(?:,\d+)?'
          r'(?:\s*[×x·]\s*10(?:[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+|\^\(?[−\-+]?\d+\)?))?')


def num(texto):
    """'1,2 × 10⁻³' → 0.0012 ; '4 700' → 4700 ; '−3,8' → -3.8"""
    t = texto.strip().replace('−', '-')
    for e in ESPACIOS + ' ':
        t = re.sub(r'(?<=\d)' + re.escape(e) + r'(?=\d{3})', '', t)
    m = re.match(r'^([+\-]?\d+(?:,\d+)?)(?:\s*[×x·]\s*10(?:\^\(?([+\-−]?\d+)\)?|([⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)))?$', t)
    if not m:
        raise ValueError(f'número no reconocido: {texto!r}')
    v = float(m.group(1).replace(',', '.'))
    exp = m.group(2) or (m.group(3).translate(SUPER) if m.group(3) else None)
    if exp:
        v *= 10 ** int(exp.replace('−', '-'))
    return v


def decimales(texto):
    """Significant resolution of a written number: '0,165' → 0.001 ; '440' → 1 ; '1,2 × 10¹⁰' → 1e9."""
    t = texto.strip().replace('−', '-')
    for e in ESPACIOS + ' ':
        t = re.sub(r'(?<=\d)' + re.escape(e) + r'(?=\d{3})', '', t)
    m = re.match(r'^[+\-]?(\d+)(?:,(\d+))?(?:\s*[×x·]\s*10(?:\^\(?([+\-−]?\d+)\)?|([⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)))?$', t)
    if not m:
        return None
    exp = m.group(3) or (m.group(4).translate(SUPER) if m.group(4) else None)
    e = int(exp.replace('−', '-')) if exp else 0
    if m.group(2):
        return 10 ** (e - len(m.group(2)))
    # integers: trailing zeros are not significant ('4700' → 100)
    ent = m.group(1)
    ceros = len(ent) - len(ent.rstrip('0')) if ent != '0' else 0
    return 10 ** (e + ceros)


def unidad(texto):
    """'mA' → ('A', 1e-3) ; 'kΩ' → ('Ω', 1e3) ; '%' → ('%', 1) ; '' → ('', 1). Raises on unknown units."""
    u = texto.strip()
    u = ALIAS.get(u, u)
    if u == '':
        return '', 1.0
    if u in ATOMICAS_PREFIJO:
        return ATOMICAS_PREFIJO[u]
    if u in ATOMICAS:
        return u, 1.0
    if u in PREFIJABLES:
        return u, 1.0
    if len(u) > 1 and u[0] in PREFIJOS:
        base = ALIAS.get(u[1:], u[1:])
        if base in PREFIJABLES:
            return base, PREFIJOS[u[0]]
    raise ValueError(f'unidad no reconocida: {texto!r}')


def formatear(v, u):
    """Display text in Spanish style of an SI value: (0.0201, 'A') → '20,1 mA'."""
    if u in PREFIJABLES and v != 0 and u not in ('m', 'g', 'B', 'bit'):
        e = math.floor(math.log10(abs(v)) / 3) * 3
        e = max(-12, min(12, e))
        if u in ('s',) and e > 0:
            e = 0
        pref = {-12: 'p', -9: 'n', -6: 'µ', -3: 'm', 0: '', 3: 'k', 6: 'M', 9: 'G', 12: 'T'}[e]
        x = v / 10 ** e
    else:
        pref, x = '', v
    s = f'{x:.4g}'
    if 'e' in s:
        mant, ex = s.split('e')
        s = f'{mant} × 10^{int(ex)}'
    s = s.replace('.', ',').replace('-', '−')
    return f'{s} {pref}{u}' if u else s


# ------------------------------------------------------------------ text helpers

def plano(h):
    """HTML of the pipeline → plain text, keeping subscripts as _x / _{xy} and superscripts as ^x."""
    h = re.sub(r'<img[^>]*alt="([^"]*)"[^>]*>', lambda m: htmlmod.unescape(m.group(1)), h or '')
    h = re.sub(r'<sub>(.*?)</sub>', lambda m: '_' + (m.group(1) if re.fullmatch(r'\w+', m.group(1)) else '{' + m.group(1) + '}'), h)
    h = re.sub(r'<sup>(.*?)</sup>', lambda m: '^' + (m.group(1) if re.fullmatch(r'\w+', m.group(1)) else '{' + m.group(1) + '}'), h)
    h = re.sub(r'<br\s*/?>', ' ', h)
    h = re.sub(r'<[^>]+>', '', h)
    return htmlmod.unescape(h)


def marcado(t):
    """Plain text with _x / _{x y} / ^x marks → the pipeline's HTML (sub, sup), escaped."""
    t = htmlmod.escape(t, quote=False)
    t = re.sub(r'_\{([^}]*)\}', r'<sub>\1</sub>', t)
    t = re.sub(r'(?<=[\wΩ)\]])_([\wα-ωΑ-Ω]+)', r'<sub>\1</sub>', t)
    t = re.sub(r'\^\{([^}]*)\}', r'<sup>\1</sup>', t)
    t = re.sub(r'(?<=[\w)\]])\^([\-−]?[\w]+)', r'<sup>\1</sup>', t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    return t


def texto_bloques(bs, out):
    for b in bs:
        t = b['t']
        if 'html' in b:
            out.append(plano(b['html']))
        elif t == 'lista':
            out.extend(plano(x) for x in b['items'])
        elif t == 'ec':
            out.append(ecuacion_plana(b.get('fuente', '')))
        elif t == 'tabla':
            for f in b['filas']:
                out.append(' | '.join(plano(c) for c in f))
        if 'bloques' in b and t != 'ejercicios':
            texto_bloques(b['bloques'], out)
    return out


def ecuacion_plana(f):
    """Typst math source → rough plain text, enough to find «= 12,5 mA» results in it."""
    f = re.sub(r'"([^"]*)"', r'\1', f)
    f = f.replace('dot.op', '·').replace('times', '×').replace('approx', '≈').replace('arrow.r.double.long', '⇒')
    f = f.replace('arrow.r', '→').replace('lt.eq', '≤').replace('gt.eq', '≥').replace('quad', ';')
    f = re.sub(r'\b(op|lr|sqrt)\b', '', f)
    f = re.sub(r'\s+', ' ', f)
    return f


# ------------------------------------------------------------------ automatic extraction

_UNID_RE = '|'.join(sorted({re.escape(u) for u in ATOMICAS + PREFIJABLES}
                            | {re.escape(p + u) for p in 'pnµmkMG' for u in PREFIJABLES}, key=len, reverse=True))
RESULTADO_RE = re.compile(r'(=|≈|≃)\s*(' + NUM_RE + r')(?:\s*(' + _UNID_RE + r'))?(?![\w/²·])')
VAR_RE = re.compile(r'([A-Za-zα-ωΑ-Ωτφθη][\w\'′]*(?:_\{[^}]*\}|_[\w]+)?(?:\([^)]{0,12}\))?)\s*$')

NO_NUMERICO = re.compile(r'\b(explica|justifica|razona|por qué|describe|dibuja|qué ocurre|qué pasa|compara|'
                         r'enumera|indica (qué|cuál|si)|identifica|propón|elige|qué tipo|cuál es la diferencia|'
                         r'deduce|demuestra|qué ventaja|qué inconveniente)\b', re.I)


def resultados(texto):
    """[(lhs variable, value SI, unit, written number, written unit, position)] of the chains in a text."""
    res = []
    # chains are cut at sentence ends and semicolons
    for frase in re.split(r'(?<=[.;:])\s+(?=[A-ZÁÉÍÓÚÑ(¿])|;\s+|\.\s*$', texto):
        cadenas = re.split(r',\s+(?=[a-záéíóú])|\s+y\s+(?=[A-Za-z]\w*\s*=)', frase)
        for c in cadenas:
            ms = list(RESULTADO_RE.finditer(c))
            if not ms:
                continue
            ult = ms[-1]
            primero = re.search(r'[=≈]', c)
            lhs = VAR_RE.search(c[:primero.start()]) if primero else None
            try:
                v = num(ult.group(2))
                base, f = unidad(ult.group(3) or '')
            except ValueError:
                continue
            res.append({'var': lhs.group(1) if lhs else '', 'valor': v * f, 'unidad': base,
                        'escrito': ult.group(2), 'u_escrita': ult.group(3) or '', 'pos': ult.start()})
    return res


def tolerancia(escrito, valor_escrito):
    d = decimales(escrito)
    if not d or not valor_escrito:
        return TOL_DEFECTO
    r = 0.5 * d / abs(valor_escrito)
    return round(min(TOL_MAX_REDONDEO, max(TOL_DEFECTO, r)), 4)


def nombre_magnitud(u):
    return {'Ω': 'Resistencia', 'V': 'Tensión', 'A': 'Corriente', 'W': 'Potencia', 'F': 'Capacidad',
            'H': 'Inductancia', 'Hz': 'Frecuencia', 's': 'Tiempo', 'dB': 'Ganancia', '%': 'Porcentaje',
            '°': 'Ángulo', '°C': 'Temperatura', 'J': 'Energía', 'Wh': 'Energía', 'Ah': 'Carga', 'VA': 'Potencia aparente',
            'h': 'Tiempo', 'bit/s': 'Velocidad', 'dBm': 'Potencia', 'S': 'Conductancia', 'C': 'Carga',
            'K': 'Temperatura', 'mm²': 'Sección', 'm': 'Longitud', 'bits': 'Bits'}.get(u, 'Resultado')


def auto(item):
    """Automatic answers and hints for one item (the curated file may replace any of it)."""
    sol = item['_sol']
    enun = item['_enun']
    rs = [r for r in resultados(sol) if r['unidad'] or r['var']]
    # the last result for each distinct quantity (variable or, without one, unit), in order of appearance
    vistos = {}
    for r in rs:
        k = r['var'] or ('?' + r['unidad'])
        vistos[k] = r
    elegidos = sorted(vistos.values(), key=lambda r: r['pos'])
    con_unidad = [r for r in elegidos if r['unidad']]
    if con_unidad:
        elegidos = con_unidad
    elegidos = elegidos[-3:]
    respuestas = []
    for r in elegidos:
        escrito_v = num(r['escrito'])
        nombre = (nombre_magnitud(r['unidad']) + (f" {r['var']}" if r['var'] else '')).strip()
        respuestas.append({'nombre': nombre, 'valor': r['valor'], 'unidad': r['unidad'],
                           'tol': tolerancia(r['escrito'], escrito_v), 'alternativas': []})
    pide_texto = bool(NO_NUMERICO.search(enun))
    if not respuestas:
        clase = 'deduccion' if re.search(r'\b(deduce|demuestra|obtén la expresión)\b', enun, re.I) else (
            'eleccion' if re.search(r'\b(elige|cuál|qué tipo|qué familia|qué componente)\b', enun, re.I) else 'texto')
        modo = 'comparar'
    else:
        clase, modo = 'numerico', 'auto'
    # hints: first sentence without numbers; first intermediate result
    frases = [f for f in re.split(r'(?<=[.])\s+', sol) if f.strip()]
    p1 = ''
    if frases:
        p1 = re.sub(r'\s*[=≈]\s*[^=≈.;,]*\d[^=≈.;,]*', '', frases[0]).strip()
        p1 = re.sub(r'\d+(?:,\d+)?\s*(?:' + _UNID_RE + r')?', '…', p1)
        if len(p1) < 25:
            p1 = ''
    inter = [r for r in rs if r not in elegidos]
    p2 = ''
    if inter:
        r = inter[0]
        p2 = f"Resultado intermedio: {r['var'] + ' = ' if r['var'] else ''}{r['escrito']}{(' ' + r['u_escrita']) if r['u_escrita'] else ''}."
    pistas = [p for p in (p1, p2) if p]
    return {'modo': modo, 'clase': clase, 'respuestas': respuestas, 'otras': [], 'pistas': pistas,
            'pide_texto': pide_texto}


# ------------------------------------------------------------------ items of the book

CABECERAS_PROBLEMA = {'Análisis', 'Solución', 'Verificación', 'Resultado', 'En el banco', 'Diseño'}


def items_del_libro():
    indice = json.load(open(os.path.join(OUT, 'indice.json'), encoding='utf-8'))
    orden = [p for t in indice['tomos'] for p in t['partes']]
    items = []
    for stem in orden:
        ruta = os.path.join(OUT, 'partes', stem + '.json')
        if not os.path.exists(ruta):
            continue
        parte = json.load(open(ruta, encoding='utf-8'))
        bl = parte['bloques']
        seccion = None
        for i, b in enumerate(bl):
            if b['t'] == 'h2':
                seccion = b.get('label')
            if b['t'] == 'ejercicios':
                for k, it in enumerate(b['items']):
                    if not it.get('label'):
                        continue
                    items.append({'label': it['label'], 'tipo': 'ej', 'parte': stem, 'num': it['num'],
                                  'seccion': seccion, 'pos': [i, k], 'titulo': None,
                                  '_enun': ' '.join(texto_bloques(it['bloques'], [])),
                                  '_sol': ' '.join(texto_bloques(it.get('solucion') or [], [])),
                                  '_sin_solucion': not it.get('solucion')})
            if b['t'] == 'h3' and (b.get('label') or '').startswith('prob-'):
                j = i + 1
                se_pide = None
                while j < len(bl):
                    x = bl[j]
                    if x['t'] in ('h2', 'ejercicios'):
                        break
                    if x['t'] == 'h3' and (x.get('label') or plano(x['html']).strip() not in CABECERAS_PROBLEMA):
                        break
                    if se_pide is None and x['t'] == 'p' and re.match(r'<strong>Se pide', x['html']):
                        se_pide = j
                    j += 1
                fin = j
                if se_pide is None:
                    se_pide = i + 1
                titulo = plano(b['html'])
                m = re.match(r'Problema\s+\S+\s+—\s+(.*)', titulo)
                num_impreso = re.search(r'data-ref="[^"]+">([^<]+)<', b['html'])
                items.append({'label': b['label'], 'tipo': 'prob', 'parte': stem,
                              'num': num_impreso.group(1) if num_impreso else b['label'][5:],
                              'seccion': seccion, 'pos': [i, se_pide, fin],
                              'titulo': m.group(1) if m else titulo,
                              '_enun': ' '.join(texto_bloques(bl[i + 1:se_pide + 1], [])),
                              '_sol': ' '.join(texto_bloques(bl[se_pide + 1:fin], [])),
                              '_sin_solucion': fin == se_pide + 1})
    return indice, items


# ------------------------------------------------------------------ curated overrides

CLASES = {'numerico', 'eleccion', 'texto', 'deduccion', 'diseno', 'razonamiento'}


def valor_dsl(t, linea):
    """'440 Ω ±3% (E12)' → dict(valor, unidad, tol?, tol_abs?, nota?, texto)"""
    nota = None
    m = re.search(r'\(([^()]*)\)\s*$', t)
    if m:
        nota = m.group(1).strip()
        t = t[:m.start()].strip()
    tol = tol_abs = None
    m = re.search(r'±\s*([\d,]+)\s*%\s*$', t)
    if m:
        tol = float(m.group(1).replace(',', '.')) / 100
        t = t[:m.start()].strip()
    else:
        m = re.search(r'±\s*(' + NUM_RE + r')\s*(\S*)\s*$', t)
        if m:
            # absolute tolerance in the answer's unit; «pp» = percentage points (answers in %)
            b, f = ('%', 1.0) if m.group(2) == 'pp' else unidad(m.group(2))
            tol_abs = num(m.group(1)) * f
            t = t[:m.start()].strip()
    m = re.match(r'^(' + NUM_RE + r')\s*(.*)$', t)
    if not m:
        raise ValueError(f'línea {linea}: valor no reconocido {t!r}')
    escrito = m.group(1)
    v = num(escrito)
    base, f = unidad(m.group(2))
    d = {'valor': v * f, 'unidad': base, 'texto': (escrito + (' ' + m.group(2).strip() if m.group(2).strip() else '')).replace(' ', ' ', 1) if m.group(2).strip() else escrito}
    if tol is not None:
        d['tol'] = tol
    elif tol_abs is not None:
        d['tol_abs'] = tol_abs
    else:
        d['tol'] = tolerancia(escrito, v)
    if nota:
        d['nota'] = nota
    return d


def leer_curado(ruta):
    """{label: {'respuestas': [...] | None, 'otras': [...], 'pistas': [...], 'clase': str|None, 'nota': str|None,
    'errata': str|None}}"""
    out = {}
    if not os.path.exists(ruta):
        return out
    actual = None
    for n, linea in enumerate(open(ruta, encoding='utf-8'), 1):
        s = linea.rstrip('\n')
        if not s.strip() or s.lstrip().startswith('#'):
            continue
        m = re.match(r'^\[([\w.\-]+)\]\s*$', s)
        if m:
            actual = out.setdefault(m.group(1), {'respuestas': None, 'otras': [], 'pistas': [], 'clase': None,
                                                  'nota': None, 'errata': None, '_linea': n})
            continue
        if actual is None:
            raise ValueError(f'{ruta}:{n}: línea fuera de un [label]')
        s = s.strip()
        if s.startswith('='):
            partes = [p.strip() for p in s[1:].split('|')]
            if len(partes) < 2:
                raise ValueError(f'{ruta}:{n}: «= nombre | valor [| alternativa…]»')
            principal = valor_dsl(partes[1], n)
            alts = []
            for p in partes[2:]:
                a = valor_dsl(p, n)
                if a['unidad'] != principal['unidad']:
                    raise ValueError(f'{ruta}:{n}: alternativa con otra unidad ({a["unidad"]} ≠ {principal["unidad"]})')
                alts.append(a)
            if actual['respuestas'] is None:
                actual['respuestas'] = []
            actual['respuestas'].append({'nombre': partes[0], **principal, 'alternativas': alts})
        elif s.startswith('~'):
            m = re.match(r'^~\s*(\w+)\s*:\s*(.+)$', s)
            if not m or m.group(1) not in CLASES:
                raise ValueError(f'{ruta}:{n}: «~ clase: texto» con clase en {sorted(CLASES)}')
            actual['otras'].append({'clase': m.group(1), 'texto': m.group(2).strip()})
        elif re.match(r'^[12]:', s):
            k = int(s[0])
            while len(actual['pistas']) < k:
                actual['pistas'].append('')
            actual['pistas'][k - 1] = s[2:].strip()
        elif s.startswith('clase:'):
            c = s[6:].strip()
            if c not in CLASES:
                raise ValueError(f'{ruta}:{n}: clase desconocida {c!r}')
            actual['clase'] = c
        elif s.startswith('nota:'):
            actual['nota'] = s[5:].strip()
        elif s.startswith('errata:'):
            actual['errata'] = s[7:].strip()
        elif s == 'sin-respuestas':
            actual['respuestas'] = []
        else:
            raise ValueError(f'{ruta}:{n}: línea no reconocida {s!r}')
    return out


def superindices(t):
    """'3,4 × 10^−5' → '3,4 × 10⁻⁵' (display text of a value)."""
    tabla = str.maketrans('0123456789-−+', '⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁻⁺')
    return re.sub(r'\^\(?([−\-+]?\d+)\)?', lambda m: m.group(1).translate(tabla), t)


def resumen(t, largo=150):
    """Start of a statement for lists, plain text (subscripts flattened), cut at a word."""
    t = re.sub(r'^\s*Enunciado\s+', '', t)
    t = re.sub(r'_\{([^}]*)\}|_(\w+)', lambda m: m.group(1) or m.group(2), t)
    t = re.sub(r'\^\{([^}]*)\}|\^(\w+)', lambda m: m.group(1) or m.group(2), t)
    t = re.sub(r'\s+', ' ', t).strip()
    if len(t) <= largo:
        return t
    return t[:largo].rsplit(' ', 1)[0] + '…'


# ------------------------------------------------------------------ main

def construir(revisar=None):
    indice, items = items_del_libro()
    curado = leer_curado(CURADO)
    etiquetas = {it['label'] for it in items}
    problemas = []
    for lab, c in curado.items():
        if lab not in etiquetas:
            problemas.append(f'curado: [{lab}] no existe en el libro (línea {c["_linea"]})')

    salida = {}
    estad = {'total': 0, 'ej': 0, 'prob': 0, 'auto': 0, 'comparar': 0, 'campos': 0, 'curados': 0,
             'respuestas_parser': 0, 'respuestas_curadas': 0, 'pistas_curadas': 0, 'clases': {}}
    dump = []
    for it in items:
        a = auto(it)
        c = curado.get(it['label'])
        origen = 'auto'
        respuestas, otras, pistas, clase = a['respuestas'], a['otras'], a['pistas'], a['clase']
        nota = errata = None
        if c:
            estad['curados'] += 1
            if c['respuestas'] is None and c['otras']:
                c['respuestas'] = []          # only «~» lines: compare with the solution
            if c['respuestas'] is not None:
                respuestas = c['respuestas']
                origen = 'curado'
            if c['otras']:
                otras = c['otras']
            if any(c['pistas']):
                pistas = [p for p in c['pistas'] if p] + []
                estad['pistas_curadas'] += 1
            nota, errata = c['nota'], c['errata']
            if c['clase']:
                clase = c['clase']
            elif respuestas:
                clase = 'numerico'
            elif otras:
                clase = otras[0]['clase']
        if it['_sin_solucion']:
            respuestas, otras, clase = [], [], 'sin-solucion'
        modo = 'auto' if respuestas else 'comparar'
        if modo == 'auto' and clase not in ('numerico',):
            clase = 'numerico'
        for k, r in enumerate(respuestas):
            r['id'] = f'r{k + 1}'
            r['texto'] = superindices(r.get('texto') or formatear(r['valor'], r['unidad']))
            for alt in r['alternativas']:
                alt['texto'] = superindices(alt.get('texto') or formatear(alt['valor'], alt['unidad']))
                alt.pop('unidad', None)
        entrada = {'tipo': it['tipo'], 'parte': it['parte'], 'num': it['num'], 'seccion': it['seccion'],
                   'pos': it['pos'], 'modo': modo, 'clase': clase,
                   'respuestas': [{k: v for k, v in r.items() if not k.startswith('_')} for r in respuestas],
                   'pistas': [marcado(p) for p in pistas], 'origen': origen}
        if it['titulo']:
            entrada['titulo'] = it['titulo']
        entrada['resumen'] = resumen(it['_enun'])
        if otras:
            entrada['otras'] = [{'clase': o['clase'], 'texto': marcado(o['texto'])} for o in otras]
        for r in entrada['respuestas']:
            r['nombre'] = marcado(r['nombre'])
            if 'nota' in r:
                r['nota'] = marcado(r['nota'])
            for alt in r['alternativas']:
                if 'nota' in alt:
                    alt['nota'] = marcado(alt['nota'])
        if nota:
            entrada['nota'] = marcado(nota)
        if errata:
            entrada['errata'] = marcado(errata)
        salida[it['label']] = entrada
        estad['total'] += 1
        estad[it['tipo']] += 1
        estad[modo] += 1
        estad['campos'] += len(respuestas)
        estad['clases'][clase] = estad['clases'].get(clase, 0) + 1
        if modo == 'auto':
            estad['respuestas_curadas' if origen == 'curado' else 'respuestas_parser'] += 1
        if revisar is not None:
            dump.append(f"### {it['label']} [{it['parte']}] {it['titulo'] or ''}\nQ: {it['_enun']}\nS: {it['_sol']}\n"
                        f"=> {modo}/{clase} ({origen}) " +
                        '; '.join(f"{r['nombre']} = {r['texto']} (±{r.get('tol', 0) * 100:.1f} %)" for r in respuestas) +
                        ('\n   P: ' + ' / '.join(pistas) if pistas else '') + '\n')

    # chapters in reading order, for the «Ejercicios» page
    capitulos = []
    for stem in [p for t in indice['tomos'] for p in t['partes']]:
        labs = [lab for lab, e in salida.items() if e['parte'] == stem]
        if labs:
            capitulos.append({'parte': stem, 'items': labs})
    doc = {'version': VERSION, 'items': salida, 'capitulos': capitulos,
           'resumen': {k: v for k, v in estad.items()}}
    if revisar:
        with open(revisar, 'w', encoding='utf-8') as f:
            f.write('\n'.join(dump))
    return doc, estad, problemas


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    revisar = None
    if '--revisar' in argv:
        revisar = argv[argv.index('--revisar') + 1]
    try:
        doc, e, problemas = construir(revisar)
    except ValueError as err:
        print(f'ejercicios: {err}')
        return 1
    with open(os.path.join(OUT, 'ejercicios.json'), 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
    pct = 100 * e['auto'] / e['total'] if e['total'] else 0
    print(f"ejercicios.json: {e['total']} ({e['ej']} ejercicios, {e['prob']} problemas); "
          f"autocomprobables {e['auto']} ({pct:.0f} %, {e['campos']} campos: {e['respuestas_parser']} del analizador, "
          f"{e['respuestas_curadas']} curados); comparar con la solución {e['comparar']}; "
          f"curados {e['curados']}; clases {e['clases']}")
    for p in problemas:
        print('  ' + p)
    return 1 if problemas else 0


if __name__ == '__main__':
    sys.exit(main())
