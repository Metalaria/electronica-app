"""Shared helpers for the paratext generators (read-only access to the app's book data)."""
import html
import json
import os
import re
import unicodedata

AQUI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 1.2: part of the app (contenido/paratexto/); it reads the app's generated book and lessons
APP = os.path.dirname(os.path.dirname(AQUI))
LIBRO = os.environ.get('EPA_LIBRO') or os.path.join(APP, 'web', 'public', 'libro')
LECCIONES = os.path.join(APP, 'contenido', 'lecciones11')
# the Typst it writes is the book's Fuentes/paratexto/ (never written here): by default a scratch folder to compare
# with the book (comparar.py), or the folder given in EPA_PARATEXTO_SALIDA
SALIDA = os.environ.get('EPA_PARATEXTO_SALIDA') or os.path.join(APP, 'contenido', '.cache', 'paratexto')
DATOS = os.path.join(AQUI, 'datos')
REDACCION = os.path.join(AQUI, 'redaccion')


def cargar(rel):
    with open(os.path.join(LIBRO, rel), encoding='utf-8') as f:
        return json.load(f)


def guardar(ruta, obj):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
        f.write('\n')


INDICE = cargar('indice.json')


def partes_del_libro():
    """Chapters and appendices in book order: [(parte, info, tomo)]."""
    out = []
    for t in INDICE['tomos']:
        for p in t['partes']:
            info = INDICE['partes'][p]
            if info['tipo'] in ('capitulo', 'apendice'):
                out.append((p, info, t['id']))
    return out


def texto_plano(h):
    """HTML fragment of the app → plain text."""
    if h is None:
        return ''
    h = re.sub(r'<br\s*/?>', ' ', h)
    h = re.sub(r'<[^>]+>', '', h)
    return html.unescape(h).replace('\u00ad', '')


def recorrer(bloques, ctx, salida):
    """Walk blocks in order, yielding (h2 label, h3 label or None, kind, text)."""
    for b in bloques:
        t = b.get('t')
        if t == 'h2':
            ctx['h2'] = b.get('label')
            ctx['h3'] = None
            salida.append((ctx['h2'], None, 'h2', texto_plano(b.get('html'))))
            continue
        if t == 'h3':
            ctx['h3'] = b.get('label')
            salida.append((ctx['h2'], ctx['h3'], 'h3', texto_plano(b.get('html'))))
            continue
        if t in ('p', 'h4', 'centrado'):
            salida.append((ctx['h2'], ctx['h3'], t, texto_plano(b.get('html'))))
        elif t == 'lista':
            for it in b.get('items', []):
                salida.append((ctx['h2'], ctx['h3'], 'li', texto_plano(it if isinstance(it, str) else it.get('html', ''))))
        elif t == 'tabla':
            if b.get('pie'):
                salida.append((ctx['h2'], ctx['h3'], 'pie', texto_plano(b['pie'])))
            for fila in b.get('filas', []):
                salida.append((ctx['h2'], ctx['h3'], 'celda', ' · '.join(texto_plano(c) for c in fila)))
        elif t == 'figura':
            salida.append((ctx['h2'], ctx['h3'], 'pie', texto_plano(b.get('pie'))))
        elif t == 'codigo':
            salida.append((ctx['h2'], ctx['h3'], 'codigo', b.get('texto', '')))
        elif t in ('caja', 'deduccion', 'tarjeta'):
            if b.get('titulo'):
                salida.append((ctx['h2'], ctx['h3'], 'p', texto_plano(b['titulo'])))
            recorrer(b.get('bloques', []), ctx, salida)
        elif t == 'ejercicios':
            for it in b.get('items', []):
                for sub in ('bloques', 'solucion'):
                    tmp = []
                    recorrer(it.get(sub, []), dict(ctx), tmp)
                    salida.extend((ctx['h2'], ctx['h3'], 'ej' if sub == 'bloques' else 'sol', x[3]) for x in tmp)
    return salida


def fragmentos(parte):
    d = cargar(f'partes/{parte}.json')
    return d, recorrer(d.get('bloques', []), {'h2': None, 'h3': None}, [])


def clave_orden(s):
    """Spanish alphabetical sort key: accents ignored, ñ after n, digits and symbols first."""
    s = s.strip().lower()
    out = []
    for ch in s:
        if ch == 'ñ':
            out.append('n~')
            continue
        d = unicodedata.normalize('NFD', ch)
        base = ''.join(c for c in d if unicodedata.category(c) != 'Mn')
        out.append(base)
    k = ''.join(out)
    k = re.sub(r'^[^0-9a-z]+', '', k)
    grupo = 0 if (k[:1].isdigit() or not k[:1].isalpha()) else 1
    return (grupo, k, s)


def letra_de(s):
    k = clave_orden(s)
    if k[0] == 0 or not k[1]:
        return '#'
    c = k[1][0].upper()
    return 'Ñ' if k[1].startswith('n~') else c


# ---------------------------------------------------------------- Typst markup from the app's HTML
ESCAPAR = set('\\#*_`$<>@[]~/=+-"\'')


def escapar(s):
    out = []
    for ch in s:
        if ch in ESCAPAR:
            out.append('\\' + ch)
        else:
            out.append(ch)
    r = ''.join(out)
    # a leading "1." would start an enumeration
    r = re.sub(r'^(\d+)\.', r'\1\\.', r)
    return r


def html_a_typst(h):
    """Inline HTML of the app (sub, sup, strong, em, code, br, ref links) → Typst markup."""
    if h is None:
        return ''
    h = h.replace('\u00ad', '')
    trozos = re.split(r'(<[^>]+>)', h)
    out = []
    pila = []
    for tr in trozos:
        if not tr:
            continue
        if tr.startswith('<'):
            m = re.match(r'<\s*(/?)\s*([a-zA-Z0-9]+)([^>]*)>', tr)
            if not m:
                continue
            cierre, tag, attrs = m.group(1) == '/', m.group(2).lower(), m.group(3)
            if tag == 'br':
                out.append(' #linebreak() ')
                continue
            mapa = {'sub': '#sub[', 'sup': '#super[', 'strong': '#strong[', 'b': '#strong[', 'em': '#emph[',
                    'i': '#emph[', 'code': '#raw("', 'span': '', 'a': ''}
            if tag not in mapa:
                continue
            if not cierre:
                if tag == 'code':
                    pila.append('code')
                    out.append('\0CODE\0')
                elif tag == 'a':
                    ref = re.search(r'data-ref="([^"]+)"', attrs)
                    pila.append('a')
                    if ref:
                        # the visible number is regenerated by nr(), like the book does
                        out.append(f'#nr("{ref.group(1)}")\0SKIP\0')
                    else:
                        out.append('')
                else:
                    pila.append(tag)
                    out.append(mapa[tag])
            else:
                if not pila:
                    continue
                t = pila.pop()
                if t == 'code':
                    out.append('\0/CODE\0')
                elif t == 'a':
                    out.append('\0/SKIP\0')
                elif mapa.get(t):
                    out.append(']')
        else:
            out.append(('\0T\0', html.unescape(tr)))
    # resolve text, code and skipped link text
    res = []
    modo = None
    for x in out:
        if isinstance(x, tuple):
            txt = x[1]
            if modo == 'skip':
                continue
            if modo == 'code':
                res.append(txt.replace('\\', '\\\\').replace('"', '\\"'))
            else:
                res.append(escapar(txt))
            continue
        if x == '\0CODE\0':
            res.append('#raw("')
            modo = 'code'
        elif x == '\0/CODE\0':
            res.append('")')
            modo = None
        elif x.endswith('\0SKIP\0'):
            res.append(x[:-6])
            modo = 'skip'
        elif x == '\0/SKIP\0':
            modo = None
        else:
            res.append(x)
    s = ''.join(res)
    s = re.sub(r'\s+', ' ', s).strip()
    # «#sub[th](t)» would read «(t)» as more arguments of the call: escape the parenthesis
    s = s.replace('](', ']\\(')
    return s


def cadena(s):
    """Python string → Typst string literal."""
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n') + '"'
