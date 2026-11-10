"""1.1: the new exercises that are not in the book yet (contenido/ejercicios_nuevos11/<parte>.yaml), merged into
web/public/libro/ejercicios.json and busqueda.json.

The owner decided that chapters 22, 25 and 35 (printed 21, 24 and 34), which the book leaves without exercises, get new
ones now in the app, marked «Aún no en el libro», and in the book's next edition. This step runs right after
contenido/ejercicios.py (generar.py calls it; it can also run on its own) and:

  - removes whatever an earlier run added (items with "nuevo": true, search documents with "nuevo": true), so running it
    again leaves the files byte-identical (idempotent, order-stable);
  - drops every new exercise whose label the book already has: once the author pastes the text into the book, the
    book's item (from ejercicios.py) wins and the app-only one disappears;
  - adds the others after the book's items: "nuevo": true, their own statement and solution as blocks
    ("enunciado", "solucion", the parts' block format; "pos": []), answers, structured questions (choice with an
    explanation per wrong option, order, classification and 1.1 «diseno», checked by simulation), hints and the
    test-bench practice to measure on («banco»); and one search document per exercise.

  python3 contenido/ejercicios_nuevos.py               merge (writes ejercicios.json and busqueda.json)
  python3 contenido/ejercicios_nuevos.py --comprobar   only validate the sources (writes nothing)
  python3 contenido/ejercicios_nuevos.py --typst F     also write F: the Typst text for the book (Markdown)

Source markup (inline): *bold*, $Typst math$ (decimals quoted: "0,707"; units inside the quotes: "1 kHz"),
#nr("label") for a reference. Paragraphs are separated by a blank line; «- » starts a list item. The same text gives
the app's HTML and the book's Typst, so the two never drift apart. EPA_LIBRO=<dir> relocates the book folder (tests).
"""
import hashlib
import html as htmlmod
import json
import math
import os
import re
import sys

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ejercicios as EJ  # noqa: E402

LIBRO = os.environ.get('EPA_LIBRO') or os.path.join(os.path.dirname(HERE), 'web', 'public', 'libro')
FUENTES = os.path.join(HERE, 'ejercicios_nuevos11')
RE_ETIQUETA = re.compile(r'^ej-(\d+)\.(\d+)$')
SERIES = {'E12': [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
          'E24': [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6,
                  6.2, 6.8, 7.5, 8.2, 9.1]}


class Fallo(ValueError):
    pass


# ------------------------------------------------------------------ Typst math → HTML (the subset the sources use)

SIMBOLOS = {'dot': '·', 'dot.op': '·', 'times': '×', 'approx': '≈', 'plus.minus': '±', 'lt.eq': '≤', 'gt.eq': '≥',
            'parallel': '∥', 'pi': 'π', 'tau': 'τ', 'omega': 'ω', 'Omega': 'Ω', 'phi': 'φ', 'Delta': 'Δ', 'mu': 'µ',
            'epsilon': 'ε', 'alpha': 'α', 'beta': 'β', 'zeta': 'ζ', 'theta': 'θ', 'lambda': 'λ', 'sigma': 'σ',
            'infinity': '∞'}
FUNCIONES = {'log', 'ln', 'exp', 'arctan', 'sin', 'cos', 'tan'}
ESPACIADOS = {'=': ' = ', '≈': ' ≈ ', '≤': ' ≤ ', '≥': ' ≥ ', '×': ' × ', '±': ' ± ', '∥': ' ∥ '}
TOKEN = re.compile(r'\s*(?:("(?:[^"\\]|\\.)*")|(\d+(?:\.\d+)?)|([A-Za-z][A-Za-z]*(?:\.[a-z]+)*)|(\S))')


def _tokens(src, donde):
    out, pos = [], 0
    while pos < len(src):
        m = TOKEN.match(src, pos)
        if not m:
            break
        pos = m.end()
        if m.group(1) is not None:
            out.append(('str', m.group(1)[1:-1]))
        elif m.group(2) is not None:
            out.append(('num', m.group(2)))
        elif m.group(3) is not None:
            out.append(('id', m.group(3)))
        elif m.group(4) is not None:
            c = m.group(4)
            if c == ',':
                raise Fallo(f'{donde}: coma sin comillas en «${src}$» (los decimales van entre comillas: "0,707")')
            out.append(('op', c))
    return out


def matematica_html(src, donde):
    """Typst inline math → the app's HTML (plain letters, Unicode symbols, sub/sup): «f_c = 1 / (2 pi dot R dot C)» →
    «f<sub>c</sub> = 1/(2π·R·C)». Raises on anything outside the subset, as Typst itself would on unknown names."""
    tk = _tokens(src, donde)
    pos = 0

    def ver():
        return tk[pos] if pos < len(tk) else None

    def atomo():
        nonlocal pos
        t = ver()
        if t is None:
            raise Fallo(f'{donde}: «${src}$» está incompleta')
        pos += 1
        k, v = t
        if k == 'str':
            return htmlmod.escape(v, quote=False)
        if k == 'num':
            return v
        if k == 'id':
            if v in SIMBOLOS:
                return SIMBOLOS[v]
            if v == 'sqrt':
                if ver() != ('op', '('):
                    return '√' + atomo()
                return '√' + grupo(True)
            if v in FUNCIONES:
                s = v
                if ver() == ('op', '_'):
                    pos += 1
                    s += f'<sub>{sufijo()}</sub>'
                return s if ver() == ('op', '(') else s + ' '
            if len(v) == 1:
                return v
            raise Fallo(f'{donde}: «{v}» no es un símbolo de la fórmula «${src}$» (¿falta entre comillas?)')
        if v == '(':
            pos -= 1
            return grupo(True)
        if v == '-':
            return '−'
        if v in '+=<>/|!°%\'':
            return {'=': ' = ', '+': ' + ', '<': ' &lt; ', '>': ' &gt; '}.get(v, v)
        if v in SIMBOLOS.values() or v in 'ΩµπτωφΔ∥≈±×·…':
            return v
        raise Fallo(f'{donde}: carácter «{v}» no previsto en «${src}$»')

    def grupo(parentesis):
        nonlocal pos
        assert ver() == ('op', '(')
        pos += 1
        s = secuencia(')')
        if ver() != ('op', ')'):
            raise Fallo(f'{donde}: falta cerrar un paréntesis en «${src}$»')
        pos += 1
        return f'({s})' if parentesis else s

    def sufijo():
        # what follows ^ or _: a group (without its parentheses), a minus and an atom, or one atom
        nonlocal pos
        if ver() == ('op', '('):
            return grupo(False)
        if ver() == ('op', '-'):
            pos += 1
            return '−' + atomo()
        return atomo()

    def secuencia(fin):
        nonlocal pos
        partes = []
        anterior = None   # the kind of the last thing written: 'op' or 'atomo'
        while ver() is not None and ver() != ('op', fin):
            t = ver()
            if t[0] == 'op' and t[1] in '^_':
                pos += 1
                tag = 'sup' if t[1] == '^' else 'sub'
                partes.append(f'<{tag}>{sufijo()}</{tag}>')
                anterior = 'atomo'
                continue
            if t[0] == 'op' and t[1] in '+-' and anterior == 'atomo':
                pos += 1
                partes.append(' + ' if t[1] == '+' else ' − ')
                anterior = 'op'
                continue
            if t[0] == 'op' and t[1] == '/':
                pos += 1
                partes.append('/')
                anterior = 'op'
                continue
            if t == ('op', '='):
                pos += 1
                partes.append(' = ')
                anterior = 'op'
                continue
            if t[0] == 'id' and t[1] in SIMBOLOS and SIMBOLOS[t[1]] in ESPACIADOS:
                pos += 1
                partes.append(ESPACIADOS[SIMBOLOS[t[1]]])
                anterior = 'op'
                continue
            partes.append(atomo())
            anterior = 'atomo'
        return ''.join(partes)

    s = secuencia(None)
    if pos != len(tk):
        raise Fallo(f'{donde}: sobra un paréntesis en «${src}$»')
    return re.sub(r' {2,}', ' ', s).strip()


# ------------------------------------------------------------------ inline markup → HTML and Typst

TROZO = re.compile(r'\$([^$]+)\$|\*([^*]+)\*|#nr\("([^"]+)"\)')


def linea_html(t, refs, donde):
    out, pos = [], 0
    for m in TROZO.finditer(t):
        out.append(htmlmod.escape(t[pos:m.start()], quote=False))
        if m.group(1) is not None:
            out.append(matematica_html(m.group(1), donde))
        elif m.group(2) is not None:
            out.append('<strong>' + linea_html(m.group(2), refs, donde) + '</strong>')
        else:
            k = m.group(3)
            if k not in refs:
                raise Fallo(f'{donde}: la referencia «{k}» no existe en refs.json')
            out.append(f'<a class="ref" data-ref="{htmlmod.escape(k)}">{htmlmod.escape(refs[k]["num"])}</a>')
        pos = m.end()
    out.append(htmlmod.escape(t[pos:], quote=False))
    s = ''.join(out)
    if re.search(r'[$*]|#nr', re.sub(r'<[^>]+>', '', s)):
        raise Fallo(f'{donde}: marca sin cerrar en «{t}»')
    return s


def _escapar_typst(t):
    t = re.sub(r'([\\#$*_`<>@\[\]~])', r'\\\1', t)
    t = t.replace('--', '-\\-').replace('//', '/\\/')
    # a number keeps its unit (and its thousands) on the same line: «250~kHz», «2~200~µF»
    return re.sub(r'(?<=\d) (?=\d{3}(?!\d)|' + UNIDADES_TEXTO + r'(?![\wáéíóúñ]))', '~', t)


UNIDADES_TEXTO = ('(?:[pnµmkMG]?(?:Hz|V|A|W|Ω|F|H|s)|dBm|dB|°C/W|°C|°|%|µε|bits|K|pF|nF|µF|mH|mΩ|ms|µs|ns|mV|mA|µA|'
                  'kΩ|MΩ|kHz|MHz|mW|µW|µV/°C|V/µs|m)')


def linea_typst(t):
    out, pos = [], 0
    for m in TROZO.finditer(t):
        out.append(_escapar_typst(t[pos:m.start()]))
        if m.group(1) is not None:
            out.append('$' + m.group(1).strip() + '$')
        elif m.group(2) is not None:
            out.append('*' + linea_typst(m.group(2)) + '*')
        else:
            out.append(f'#nr("{m.group(3)}")')
        pos = m.end()
    out.append(_escapar_typst(t[pos:]))
    return ''.join(out)


def parrafos(texto):
    """[('p', line) | ('lista', [lines])] from the source text."""
    bloques = []
    for trozo in re.split(r'\n\s*\n', (texto or '').strip()):
        lineas = [x.strip() for x in trozo.strip().split('\n') if x.strip()]
        if not lineas:
            continue
        if all(x.startswith('- ') for x in lineas):
            bloques.append(('lista', [x[2:].strip() for x in lineas]))
        elif any(x.startswith('- ') for x in lineas):
            raise ValueError('una lista debe ir en su propio párrafo')
        else:
            bloques.append(('p', ' '.join(lineas)))
    return bloques


def bloques_html(texto, refs, donde):
    out = []
    for k, v in parrafos(texto):
        if k == 'p':
            out.append({'t': 'p', 'html': linea_html(v, refs, donde)})
        else:
            out.append({'t': 'lista', 'ordenada': False, 'items': [linea_html(x, refs, donde) for x in v]})
    return out


def bloques_typst(texto, sangria):
    out = []
    for k, v in parrafos(texto):
        if k == 'p':
            out.append(sangria + linea_typst(v))
        else:
            out.append('\n'.join(sangria + '- ' + linea_typst(x) for x in v))
    return '\n\n'.join(out)


def texto_plano(bloques):
    partes = []
    for b in bloques:
        partes.extend([b['html']] if b['t'] == 'p' else b['items'])
    return ' '.join(re.sub(r'\s+', ' ', htmlmod.unescape(re.sub(r'<[^>]+>', '', p))).strip() for p in partes)


# ------------------------------------------------------------------ values

def magnitud(t, donde, unidad):
    """«3,3 kΩ» → 3300 (in the bare unit, which must be `unidad`)."""
    d = EJ.valor_dsl(str(t), donde)
    if d['unidad'] != unidad:
        raise Fallo(f'{donde}: «{t}» no está en {unidad}')
    return d['valor']


def de_serie(v, serie):
    if v <= 0:
        return False
    d = math.floor(math.log10(v) + 1e-9)
    m = v / 10 ** d
    return any(abs(m - b) < 1e-6 * b for b in SERIES[serie]) or abs(m - 10) < 1e-6


# ------------------------------------------------------------------ items

def pregunta(q, k, label, refs, donde):
    pid = f'p{k + 1}'
    tipo = q['tipo']
    e = {'id': pid, 'tipo': tipo, 'enunciado': linea_html(q['enunciado'], refs, donde)}
    if tipo == 'eleccion':
        ops = q['opciones']
        correctas = [i for i, o in enumerate(ops) if o.get('correcta')]
        if len(correctas) != 1:
            raise Fallo(f'{donde}: una pregunta de elección lleva exactamente una opción correcta')
        sino = all(re.match(r'^(Sí|No)\b', o['texto']) for o in ops)
        orden = list(range(len(ops))) if sino else EJ.permutacion(len(ops), label + pid, False)
        e['opciones'] = [linea_html(ops[i]['texto'], refs, donde) for i in orden]
        e['correcta'] = orden.index(correctas[0])
        porque = {}
        for j, i in enumerate(orden):
            if i == correctas[0]:
                if ops[i].get('porque'):
                    raise Fallo(f'{donde}: la opción correcta se explica en «explicacion», no en «porque»')
                continue
            if not ops[i].get('porque'):
                raise Fallo(f'{donde}: falta «porque» en la opción «{ops[i]["texto"]}» (cada opción incorrecta lleva su explicación)')
            porque[str(j)] = linea_html(ops[i]['porque'], refs, donde)
        e['porque'] = porque
    elif tipo == 'orden':
        e['elementos'] = [linea_html(x, refs, donde) for x in q['elementos']]
        e['mezcla'] = EJ.permutacion(len(q['elementos']), label + pid)
    elif tipo == 'clasificar':
        orden = EJ.permutacion(len(q['elementos']), label + pid, False)
        e['categorias'] = [linea_html(c, refs, donde) for c in q['categorias']]
        e['elementos'] = [{'texto': linea_html(q['elementos'][i]['texto'], refs, donde), 'cat': int(q['elementos'][i]['cat'])}
                          for i in orden]
        for x in e['elementos']:
            if not 0 <= x['cat'] < len(e['categorias']):
                raise Fallo(f'{donde}: categoría fuera de la lista')
    elif tipo == 'diseno':
        e.update(diseno(q, label, refs, donde))
    else:
        raise Fallo(f'{donde}: tipo de pregunta «{tipo}» no previsto')
    if not q.get('explicacion'):
        raise Fallo(f'{donde}: cada pregunta lleva su «explicacion»')
    # the app's own working, never a quote of the book (the panel labels it «Desarrollo», not «Del libro»)
    e['explicacion'] = linea_html(q['explicacion'], refs, donde)
    e['calculo'] = True
    return e


def diseno(q, label, refs, donde):
    comps = []
    for c in q['componentes']:
        u = c['unidad']
        if u not in ('Ω', 'F', 'H'):
            raise Fallo(f'{donde}: componente en {u}')
        if c['serie'] not in SERIES:
            raise Fallo(f'{donde}: serie {c["serie"]} no prevista')
        x = {'id': c['id'], 'nombre': linea_html(c['nombre'], refs, donde), 'unidad': u, 'serie': c['serie'],
             'min': magnitud(c['min'], donde, u), 'max': magnitud(c['max'], donde, u)}
        if not x['min'] < x['max']:
            raise Fallo(f'{donde}: margen vacío en {c["id"]}')
        comps.append(x)
    ids = [c['id'] for c in comps]
    circuito = q['circuito'].strip() + '\n'
    usados = set(re.findall(r'\{(\w+)\}', circuito))
    if usados != set(ids):
        raise Fallo(f'{donde}: el circuito usa {sorted(usados)} y los componentes son {ids}')
    medidas = [{'id': m['id'], 'nombre': linea_html(m['nombre'], refs, donde), 'unidad': m['unidad']} for m in q['medidas']]
    control = q['control'].strip() + '\n'
    for m in medidas:
        if not re.search(r'^meas\s+\w+\s+' + re.escape(m['id']) + r'\b', control, re.M | re.I):
            raise Fallo(f'{donde}: la medida «{m["id"]}» no tiene su «meas» en el control')
    conds = []
    for c in q['condiciones']:
        if c['medida'] not in [m['id'] for m in medidas]:
            raise Fallo(f'{donde}: condición sobre una medida que no existe')
        conds.append({'medida': c['medida'], 'min': float(c['min']), 'max': float(c['max']),
                      'texto': linea_html(c['texto'], refs, donde),
                      'siBaja': linea_html(c['si_baja'], refs, donde), 'siAlta': linea_html(c['si_alta'], refs, donde)})
    ref = {}
    for c in comps:
        v = magnitud(q['referencia'][c['id']], donde, c['unidad'])
        if not (c['min'] <= v <= c['max'] and de_serie(v, c['serie'])):
            raise Fallo(f'{donde}: la referencia de {c["id"]} no cumple su margen o su serie')
        ref[c['id']] = {'valor': v, 'texto': str(q['referencia'][c['id']]).replace(' ', ' ', 1)}
    return {'componentes': comps, 'circuito': circuito, 'control': control, 'medidas': medidas,
            'condiciones': conds, 'referencia': ref}


def item(fuente, x, indice, refs, partes_validas):
    parte = fuente['parte']
    info = indice['partes'].get(parte)
    if not info or info.get('num') is None:
        raise Fallo(f'{parte}: no es un capítulo del índice')
    n = int(x['n'])
    label = f'ej-{int(parte[3:])}.{n}'
    donde = f'{parte}.yaml [{label}]'
    sec = x['seccion']
    if sec not in partes_validas[parte]:
        raise Fallo(f'{donde}: la sección {sec} no es de {parte}')
    enunciado = bloques_html(x['enunciado'], refs, donde)
    solucion = bloques_html(x['solucion'], refs, donde)
    respuestas = []
    for k, r in enumerate(x.get('respuestas') or []):
        d = EJ.valor_dsl(str(r['valor']), donde)
        e = {'nombre': linea_html(r['nombre'], refs, donde), 'valor': d['valor'], 'unidad': d['unidad'],
             'texto': EJ.superindices(d['texto'])}
        if 'tol_abs' in d:
            e['tol_abs'] = d['tol_abs']
        else:
            e['tol'] = d['tol']
        e['alternativas'] = []
        e['id'] = f'r{k + 1}'
        respuestas.append(e)
    preguntas = [pregunta(q, k, label, refs, donde) for k, q in enumerate(x.get('preguntas') or [])]
    pistas = [linea_html(p, refs, donde) for p in x.get('pistas') or []]
    if len(pistas) != 2:
        raise Fallo(f'{donde}: dos pistas (planteamiento y resultado intermedio)')
    if not (respuestas or preguntas):
        raise Fallo(f'{donde}: nada que comprobar')
    clase = 'numerico' if respuestas else ('diseno' if any(q['tipo'] == 'diseno' for q in preguntas) else 'eleccion')
    num = f'{info["num"]}.{n}'
    e = {'tipo': 'ej', 'parte': parte, 'num': num, 'seccion': sec, 'pos': [], 'modo': 'auto', 'clase': clase,
         'respuestas': respuestas}
    if preguntas:
        e['preguntas'] = preguntas
    e['pistas'] = pistas
    e['origen'] = 'curado'
    e['resumen'] = EJ.resumen(texto_plano(enunciado))
    e['nuevo'] = True
    e['enunciado'] = enunciado
    e['solucion'] = solucion
    if x.get('banco'):
        b = x['banco']
        if not 1 <= int(b['practica']) <= 12:
            raise Fallo(f'{donde}: práctica del banco {b["practica"]}')
        e['banco'] = {'practica': int(b['practica']), 'texto': linea_html(b['texto'], refs, donde)}
    return label, e, x


def leer_fuentes():
    out = []
    for f in sorted(os.listdir(FUENTES)):
        if f.endswith('.yaml'):
            with open(os.path.join(FUENTES, f), encoding='utf-8') as h:
                out.append(yaml.safe_load(h))
    return out


def construir(libro=None):
    """(new items in order [(label, item, source)], indice, refs)."""
    libro = libro or LIBRO
    indice = json.load(open(os.path.join(libro, 'indice.json'), encoding='utf-8'))
    refs = json.load(open(os.path.join(libro, 'refs.json'), encoding='utf-8'))
    validas = {}
    nuevos = []
    vistos = set()
    for fuente in leer_fuentes():
        parte = fuente['parte']
        validas[parte] = {s['label'] for s in indice['partes'].get(parte, {}).get('secciones', [])}
        ns = [int(x['n']) for x in fuente['items']]
        if ns != list(range(1, len(ns) + 1)):
            raise Fallo(f'{parte}.yaml: los ejercicios se numeran 1, 2, 3… en orden')
        for x in fuente['items']:
            label, e, src = item(fuente, x, indice, refs, validas)
            if label in vistos:
                raise Fallo(f'{label} repetido')
            vistos.add(label)
            nuevos.append((label, e, src))
    return nuevos, indice, refs


def fusionar(doc, busqueda, nuevos, indice):
    """Removes an earlier run's additions and adds the new exercises the book does not have (the book wins)."""
    viejos = {k for k, v in doc['items'].items() if v.get('nuevo')}
    items = {k: v for k, v in doc['items'].items() if k not in viejos}
    capitulos = [{'parte': c['parte'], 'items': [x for x in c['items'] if x not in viejos]} for c in doc['capitulos']]
    capitulos = [c for c in capitulos if c['items']]
    descartados = []
    añadidos = []
    for label, e, _ in nuevos:
        if label in items:
            descartados.append(label)
            continue
        items[label] = e
        añadidos.append(label)
    por_parte = {c['parte']: c['items'] for c in capitulos}
    for label in añadidos:
        por_parte.setdefault(items[label]['parte'], []).append(label)
    orden = [p for t in indice['tomos'] for p in t['partes']]
    capitulos = [{'parte': p, 'items': por_parte[p]} for p in orden if p in por_parte]
    resumen = dict(doc.get('resumen', {}))
    resumen.pop('nuevos11', None)
    if añadidos:
        resumen['nuevos11'] = {
            'total': len(añadidos),
            'campos': sum(len(items[x]['respuestas']) for x in añadidos),
            'preguntas': sum(len(items[x].get('preguntas', [])) for x in añadidos),
            'disenos': sum(1 for x in añadidos for q in items[x].get('preguntas', []) if q['tipo'] == 'diseno'),
            'banco': sum(1 for x in añadidos if items[x].get('banco')),
            'descartados': descartados,
        }
    nuevo_doc = {k: v for k, v in doc.items() if k not in ('items', 'capitulos', 'resumen')}
    nuevo_doc.update({'version': doc['version'], 'items': items, 'capitulos': capitulos, 'resumen': resumen})
    # same key order as ejercicios.py writes
    nuevo_doc = {k: nuevo_doc[k] for k in ['version', 'items', 'capitulos', 'resumen'] if k in nuevo_doc}
    docs = [d for d in busqueda if not d.get('nuevo')]
    for label in añadidos:
        e = items[label]
        docs.append({'id': label, 'parte': e['parte'], 'titulo': f'Ejercicio {e["num"]} · Aún no en el libro',
                     'texto': texto_plano(e['enunciado']) + ' ' + texto_plano(e['solucion']), 'nuevo': True})
    return nuevo_doc, docs, añadidos, descartados


# ------------------------------------------------------------------ Typst for the book

DONDE_PEGAR = {
    'cap22': 'al final de cap22.typ, después de la última figura del capítulo (fig-22.22, «Impedancia de un condensador '
             'con la frecuencia…»), es decir, cerrando la sección 21.13 «Cierre: lo que demuestran las prácticas…»',
    'cap25': 'al final de cap25.typ, después de la última figura del capítulo (fig-25.13, «Respuesta al escalón de un '
             'Bessel y un Chebyshev…»), cerrando la sección 24.9 «Fase y retardo de grupo»',
    'cap35': 'al final de cap35.typ, después de la última figura del capítulo (fig-35.17, «Qué se gana y qué se pierde '
             'con un sensor con bus…»), cerrando la sección 34.11 «Sensores inteligentes…»',
}


def typst_capitulo(parte, lista, indice):
    info = indice['partes'][parte]
    trozos = ['#ejercicios[']
    for label, e, src in lista:
        trozos.append('  #ejercicio[\n' + bloques_typst(src['enunciado'], '    ') + f'\n  ] <{label}>\n')
    trozos[-1] = trozos[-1].rstrip('\n')
    trozos.append(']\n\n#soluciones[')
    for label, e, src in lista:
        trozos.append(f'  #solucion("{label}")[\n' + bloques_typst(src['solucion'], '    ') + '\n  ]\n')
    trozos[-1] = trozos[-1].rstrip('\n')
    trozos.append(']')
    return '\n'.join(trozos), info


def curado_capitulo(lista):
    """Lines for contenido/ejercicios_curado.txt once the book has them (answers, hints, questions — the explanation of
    each wrong option as «porque N:», a design question as «? diseno: {JSON}» in this source format; review 11a)."""
    out = []
    for label, e, src in lista:
        out.append(f'[{label}]')
        for r, rs in zip(e['respuestas'], src.get('respuestas') or []):
            out.append(f'= {EJ.plano(r["nombre"])} | {rs["valor"]}')
        for q, qs in zip(e.get('preguntas', []), src.get('preguntas') or []):
            if q['tipo'] == 'eleccion':
                ops = [('*' if o.get('correcta') else '') + EJ.plano(linea_html(o['texto'], {}, label)) for o in qs['opciones']]
                out.append(f'? eleccion: {EJ.plano(q["enunciado"])} | ' + ' | '.join(ops))
                # (review 11a: «porque N:», N = the option's place as written above; the explanation after them)
                # (from the converted question: its `porque` is keyed by the shown place, pregunta()'s order)
                sino = all(re.match(r'^(Sí|No)\b', o['texto']) for o in qs['opciones'])
                orden = list(range(len(qs['opciones']))) if sino else EJ.permutacion(len(qs['opciones']), label + q['id'], False)
                porque = [f'porque {i + 1}: {EJ.plano(q["porque"][str(orden.index(i))])}' for i in range(len(qs['opciones']))
                          if str(orden.index(i)) in q.get('porque', {})]
            elif q['tipo'] == 'orden':
                out.append(f'? orden: {EJ.plano(q["enunciado"])} | ' + ' | '.join(EJ.plano(x) for x in qs['elementos']))
            elif q['tipo'] == 'clasificar':
                cats = qs['categorias']
                out.append(f'? clasificar: {EJ.plano(q["enunciado"])} | ' + ' / '.join(cats) + ' | ' +
                           ' | '.join(f'{x["texto"]} => {cats[int(x["cat"])]}' for x in qs['elementos']))
            elif q['tipo'] == 'diseno':
                # (review 11a: the whole question in this source format, converted by the same code — pregunta())
                out.append('? diseno: ' + json.dumps(qs, ensure_ascii=False, separators=(',', ':')))
                continue
            else:
                raise Fallo(f'{label}: tipo de pregunta «{q["tipo"]}» sin forma en el curado')
            out.append(f'>> {EJ.plano(q["explicacion"])}')
            if q['tipo'] == 'eleccion':
                out.extend(porque)
        for k, p in enumerate(e['pistas']):
            out.append(f'{k + 1}: {EJ.plano(p)}')
        out.append('')
    return '\n'.join(out)


def escribir_typst(ruta, nuevos, indice):
    porparte = {}
    for t in nuevos:
        porparte.setdefault(t[1]['parte'], []).append(t)
    h = ['# Ejercicios nuevos para la próxima edición (1.1)', '',
         'Texto Typst listo para pegar en las fuentes del libro, con las funciones del propio libro (`#ejercicios`, '
         '`#ejercicio[…] <etiqueta>`, `#soluciones`, `#solucion("etiqueta")[…]`, `#nr("…")`), tal como las lee '
         '`contenido/convertir.py`. Lo genera `python3 contenido/ejercicios_nuevos.py --typst …` a partir de '
         '`contenido/ejercicios_nuevos11/<parte>.yaml`, la misma fuente de lo que hoy enseña la aplicación con la marca '
         '«Aún no en el libro»: no se edita a mano.', '',
         'Las etiquetas (`ej-22.1`…) son las que la aplicación ya usa, así que el progreso del lector se conserva: '
         'cuando el capítulo regenerado traiga el ejercicio, el del libro sustituye al de la aplicación (el de la '
         'aplicación se descarta). Si el capítulo no tenía ejercicios, el convertidor los numera 21.1, 21.2… como aquí.',
         '', 'Al regenerar la aplicación tras pegarlos, conviene llevar al curado (`contenido/ejercicios_curado.txt`) '
         'las respuestas, pistas y preguntas del apartado «Para el curado» de cada capítulo; los problemas de diseño '
         'comprobados por simulación siguen en la fuente de la aplicación.', '']
    for parte, lista in porparte.items():
        cuerpo, info = typst_capitulo(parte, lista, indice)
        h += [f'## Capítulo {info["num"]} — {info["titulo"]} (`{parte}.typ`)', '',
              f'Dónde pegarlo: {DONDE_PEGAR.get(parte, "al final del capítulo")}. Son {len(lista)} ejercicios, '
              f'del {lista[0][1]["num"]} al {lista[-1][1]["num"]}.', '', '```typst', cuerpo, '```', '',
              f'### Para el curado ({parte})', '', '```text', curado_capitulo(lista).rstrip(), '```', '']
    with open(ruta, 'w', encoding='utf-8') as f:
        f.write('\n'.join(h))


# ------------------------------------------------------------------ entry point

def _escribir(ruta, obj):
    texto = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    if os.path.exists(ruta) and open(ruta, encoding='utf-8').read() == texto:
        return False
    with open(ruta, 'w', encoding='utf-8') as f:
        f.write(texto)
    return True


def main(argv=None, libro=None):
    """0 when done; `libro`: the book folder (contenido/ejercicios.py passes its own)."""
    argv = sys.argv[1:] if argv is None else argv
    libro = libro or LIBRO
    try:
        nuevos, indice, refs = construir(libro)
    except (Fallo, ValueError, KeyError) as err:
        print(f'ejercicios_nuevos: {err}')
        return 1
    if '--typst' in argv:
        escribir_typst(argv[argv.index('--typst') + 1], nuevos, indice)
    if '--comprobar' in argv:
        print(f'ejercicios_nuevos: {len(nuevos)} ejercicios correctos (no se escribe nada)')
        return 0
    ruta_ej = os.path.join(libro, 'ejercicios.json')
    ruta_bu = os.path.join(libro, 'busqueda.json')
    doc = json.load(open(ruta_ej, encoding='utf-8'))
    busqueda = json.load(open(ruta_bu, encoding='utf-8'))
    doc, busqueda, añadidos, descartados = fusionar(doc, busqueda, nuevos, indice)
    a = _escribir(ruta_ej, doc)
    b = _escribir(ruta_bu, busqueda)
    huella = hashlib.sha256(json.dumps([doc['items'][x] for x in añadidos], ensure_ascii=False).encode()).hexdigest()[:10]
    print(f'ejercicios_nuevos: {len(añadidos)} ejercicios nuevos añadidos (huella {huella})'
          + (f'; {len(descartados)} descartados porque el libro ya los trae: {", ".join(descartados)}' if descartados else '')
          + ('' if a or b else '; sin cambios'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
