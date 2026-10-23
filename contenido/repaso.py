#!/usr/bin/env python3
"""Chapter quizzes for the «Repaso» page: contenido/repaso/<stem>.json -> web/public/libro/repaso/.

    cd /home/claude/app && python3 contenido/repaso.py        (generar.py calls main() at the end)

Every question is written by hand, one file per chapter or appendix, and must be faithful to the book.
The generator refuses to write anything when a single check fails:
  - schema (fields, types, 2-4 distractors, no duplicated options, allowed inline HTML only);
  - the reference: a label of refs.json in that same part (or an unnumbered section of indice.json)
    that exists in the part's .typ source;
  - the quote: it must appear, word for word, in the .typ source INSIDE the level-2 section that holds
    the referenced label (Typst markup removed, whitespace and case ignored; «[…]» separates pieces
    that must appear in order);
  - numeric questions: `valor_texto` (the number as the book writes it) must be part of the quote and
    must parse to `valor`;
  - 10-20 questions per chapter, 5-20 per appendix, unique ids.

Input (one file per part, written by hand):
  { "parte": "cap05",
    "preguntas": [
      { "id": "cap05-01", "tipo": "opcion", "enunciado": "…", "respuesta": "…",
        "distractores": ["…", "…", "…"], "explicacion": "…", "ref": "sec-5.3", "cita": "…" },
      { "id": "cap05-02", "tipo": "numero", "enunciado": "…", "valor": 0.77, "unidad": "V",
        "tolerancia": 0.02, "valor_texto": "0,77", "explicacion": "…", "ref": "fig-5.5", "cita": "…" } ] }

Output: repaso/indice.json (parts with a quiz, in reading order, with counts) and repaso/<stem>.json,
where the options of each multiple-choice question are shuffled deterministically (`opciones`,
`correcta`) and the reference carries its printed number (`ref_num`, `ref_tipo`, `ref_titulo`).
"""
import hashlib
import json
import math
import os
import random
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
LIB = '/home/claude/v3/libro'
SRC = os.path.join(HERE, 'repaso')
OUT_LIBRO = os.path.join(APP, 'web/public/libro')
OUT = os.path.join(OUT_LIBRO, 'repaso')

LIMITES = {'capitulo': (10, 20), 'apendice': (5, 20)}
HTML_PERMITIDO = {'sub', 'sup', 'em', 'strong', 'code', 'br'}
TIPOS_REF = {'sec': 'Sección', 'subsec': 'Apartado', 'fig': 'Figura', 'tab': 'Tabla', 'cap': 'Capítulo',
             'ap': 'Apéndice', 'ej': 'Ejercicio', 'prob': 'Problema'}


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))


# ------------------------------------------------------------------ text normalisation

def normalizar_typst(s, refs):
    """Plain text of a Typst fragment, close to what the reader shows."""
    s = re.sub(r'#nr\("([^"]*)"\)', lambda m: refs.get(m.group(1), {}).get('num', m.group(1)), s)
    s = re.sub(r'#raw\("([^"]*)"\)', r'\1', s)
    s = re.sub(r'#[a-zA-Z][\w-]*(\([^()\[\]]*\))?\[', '', s)    # #strong[ #sub[ #emph[ …
    s = re.sub(r'\\\s*\n', ' ', s)                                 # forced line break
    s = re.sub(r'\\(?=[^\w\s])', '', s)                           # escapes \. \~ \#
    s = re.sub(r'<[a-z]+-[\w.:-]+>', '', s)                       # Typst labels
    return normalizar(s, html=False)


def normalizar(s, html=True):
    """Common form of quote and source: no markup characters, one space, case folded."""
    if html:
        s = re.sub(r'</?(sub|sup|em|strong|code|br)\s*/?>', '', s)   # inline HTML of a quote, if any
    s = s.replace('[…]', '\x00')                  # keep the elision marker
    s = re.sub(r'[\[\]*_]', '', s)
    s = s.replace('\x00', '[…]')
    s = re.sub(r'[\s\u00a0\u202f\u2009\u2007]+', ' ', s)
    return s.strip().casefold()


def numero_es(texto):
    """Parses a number as the book writes it: «0,77», «1 450», «−3,3», «2,2·10⁻³» is not supported."""
    t = texto.replace('\u2212', '-').replace('\u202f', '').replace('\u00a0', '').replace(' ', '')
    t = t.replace('.', '').replace(',', '.') if ',' in t else t
    if not re.fullmatch(r'[-+]?\d+(\.\d+)?', t):
        raise ValueError(f'«{texto}» no es un número escrito como en el libro')
    return float(t)


# ------------------------------------------------------------------ sources

def tramos_h2(fuente):
    """[(start, end)] of every level-2 section of a .typ source (preamble first)."""
    cortes = [m.start() for m in re.finditer(r'(?m)^(== |#heading\(level: 2)', fuente)]
    bordes = [0] + cortes + [len(fuente)]
    return [(bordes[k], bordes[k + 1]) for k in range(len(bordes) - 1)]


def tramo_de(fuente, label, info_parte):
    """Text span (raw Typst) where a label lives: its level-2 section, or the whole part."""
    if re.fullmatch(r'(cap|ap)-[\w.]+', label):
        return fuente if f'<{label}>' in fuente else None
    pos = fuente.find(f'<{label}>')
    if pos < 0:
        # unnumbered section: generated label, found by its title
        sec = next((s for s in info_parte.get('secciones', []) if s['label'] == label), None)
        if not sec:
            return None
        pos = fuente.find(sec['titulo'])
        if pos < 0:
            return None
    for a, b in tramos_h2(fuente):
        if a <= pos < b:
            return fuente[a:b]
    return None


# ------------------------------------------------------------------ checks

def html_ok(texto):
    return all(t.lower() in HTML_PERMITIDO for t in re.findall(r'</?\s*([a-zA-Z0-9]+)[^>]*>', texto))


def escapar(s):
    """Escape bare '<' and '&' so a text like «<= en secuenciales» survives {@html}."""
    s = re.sub(r'&(?![a-zA-Z]+;|#\d+;)', '&amp;', s)
    return re.sub(r'<(?!/?(?:' + '|'.join(sorted(HTML_PERMITIDO)) + r')\b)', '&lt;', s)


def texto(q, campo, errores, donde, largo=600):
    v = q.get(campo)
    if not isinstance(v, str) or not v.strip():
        errores.append(f'{donde}: falta «{campo}»')
        return ''
    if len(v) > largo:
        errores.append(f'{donde}: «{campo}» demasiado largo ({len(v)} > {largo})')
    if not html_ok(v):
        errores.append(f'{donde}: «{campo}» lleva HTML no permitido')
    return v


def cita_en(cita, tramo_norm):
    """Every piece of the quote, in order, inside the normalised span."""
    pos = 0
    for trozo in [t.strip() for t in normalizar(cita).split('[…]')]:
        if not trozo:
            continue
        k = tramo_norm.find(trozo, pos)
        if k < 0:
            return False
        pos = k + len(trozo)
    return True


def barajar(opciones, semilla):
    orden = list(range(len(opciones)))
    random.Random(int(hashlib.sha1(semilla.encode()).hexdigest()[:12], 16)).shuffle(orden)
    return orden


def validar_parte(stem, datos, indice, refs, ids_vistos):
    errores = []
    info = indice['partes'].get(stem)
    if not info or info.get('tipo') not in LIMITES:
        return [f'{stem}: no es un capítulo ni un apéndice de indice.json'], None
    if datos.get('parte') != stem:
        errores.append(f'{stem}: «parte» vale {datos.get("parte")!r}')
    fuente_path = os.path.join(LIB, stem + '.typ')
    fuente = open(fuente_path, encoding='utf-8').read()
    preguntas = datos.get('preguntas')
    if not isinstance(preguntas, list):
        return errores + [f'{stem}: falta la lista «preguntas»'], None
    lo, hi = LIMITES[info['tipo']]
    if not lo <= len(preguntas) <= hi:
        errores.append(f'{stem}: {len(preguntas)} preguntas (deben ser {lo}-{hi})')

    cache_tramos = {}
    salida = []
    for k, q in enumerate(preguntas):
        donde = f'{stem}[{k}] {q.get("id", "?")}'
        qid = q.get('id')
        if not isinstance(qid, str) or not re.fullmatch(rf'{re.escape(stem)}-\d{{2,3}}', qid):
            errores.append(f'{donde}: id no válido (debe ser {stem}-NN)')
        elif qid in ids_vistos:
            errores.append(f'{donde}: id repetido')
        ids_vistos.add(qid)
        extra = set(q) - {'id', 'tipo', 'enunciado', 'respuesta', 'distractores', 'valor', 'unidad',
                          'tolerancia', 'valor_texto', 'explicacion', 'ref', 'cita'}
        if extra:
            errores.append(f'{donde}: campos desconocidos {sorted(extra)}')
        enunciado = texto(q, 'enunciado', errores, donde, 500)
        explicacion = texto(q, 'explicacion', errores, donde, 700)
        cita = texto(q, 'cita', errores, donde, 450)
        if cita and len(normalizar(cita)) < 20:
            errores.append(f'{donde}: la cita es demasiado corta para identificar el pasaje')

        # reference and quote
        ref = q.get('ref')
        r = refs.get(ref) if isinstance(ref, str) else None
        sec_sin_num = next((s for s in info.get('secciones', []) if s['label'] == ref), None)
        if r is None and sec_sin_num is None:
            errores.append(f'{donde}: la referencia {ref!r} no existe en refs.json ni en las secciones de {stem}')
        elif r is not None and r['parte'] != stem:
            errores.append(f'{donde}: la referencia {ref} es de {r["parte"]}, no de {stem}')
        else:
            if ref not in cache_tramos:
                t = tramo_de(fuente, ref, info)
                cache_tramos[ref] = normalizar_typst(t, refs) if t is not None else None
            tramo = cache_tramos[ref]
            if tramo is None:
                errores.append(f'{donde}: la etiqueta <{ref}> no aparece en {stem}.typ')
            elif cita and not cita_en(cita, tramo):
                en_parte = cita_en(cita, normalizar_typst(fuente, refs))
                errores.append(f'{donde}: la cita no está en la sección de {ref}'
                               + (' (sí en otra sección del capítulo: corrige la referencia)' if en_parte else
                                  ' ni en el resto de ' + stem + '.typ') + f': «{cita[:90]}»')

        tipo = q.get('tipo')
        item = {'id': qid, 'tipo': tipo, 'enunciado': escapar(enunciado)}
        if tipo == 'opcion':
            resp = texto(q, 'respuesta', errores, donde, 300)
            dis = q.get('distractores')
            if not isinstance(dis, list) or not 2 <= len(dis) <= 4 or not all(isinstance(d, str) and d.strip() for d in dis):
                errores.append(f'{donde}: «distractores» debe tener 2-4 textos')
                dis = []
            for d in dis:
                if len(d) > 300 or not html_ok(d):
                    errores.append(f'{donde}: distractor demasiado largo o con HTML no permitido')
            todas = [resp] + dis
            if len({normalizar(o) for o in todas}) != len(todas):
                errores.append(f'{donde}: opciones repetidas')
            orden = barajar(todas, qid or donde)
            item['opciones'] = [escapar(todas[i]) for i in orden]
            item['correcta'] = orden.index(0)
        elif tipo == 'numero':
            valor = q.get('valor')
            if not isinstance(valor, (int, float)) or isinstance(valor, bool) or not math.isfinite(valor):
                errores.append(f'{donde}: «valor» debe ser un número')
                valor = 0
            unidad = q.get('unidad', '')
            if not isinstance(unidad, str):
                errores.append(f'{donde}: «unidad» debe ser texto')
                unidad = ''
            tol = q.get('tolerancia', 0.02)
            if not isinstance(tol, (int, float)) or not 0 <= tol <= 0.25:
                errores.append(f'{donde}: «tolerancia» (relativa) debe estar entre 0 y 0,25')
                tol = 0.02
            vt = q.get('valor_texto')
            if not isinstance(vt, str) or not vt.strip():
                errores.append(f'{donde}: falta «valor_texto» (el número tal como lo escribe el libro)')
            else:
                try:
                    if not math.isclose(numero_es(vt), valor, rel_tol=1e-9, abs_tol=1e-12):
                        errores.append(f'{donde}: «valor_texto» {vt} no vale {valor}')
                except ValueError as e:
                    errores.append(f'{donde}: {e}')
                if cita and normalizar(vt) not in normalizar(cita):
                    errores.append(f'{donde}: «valor_texto» {vt} no está en la cita')
            for campo in ('respuesta', 'distractores'):
                if campo in q:
                    errores.append(f'{donde}: «{campo}» no se usa en preguntas numéricas')
            item.update({'valor': valor, 'unidad': unidad, 'tolerancia': tol, 'valor_texto': vt})
        else:
            errores.append(f'{donde}: «tipo» debe ser «opcion» o «numero»')

        item['explicacion'] = escapar(explicacion)
        item['ref'] = ref
        if r is not None:
            item['ref_num'] = r['num']
            item['ref_tipo'] = TIPOS_REF.get(r['tipo'], r['tipo'])
        elif sec_sin_num is not None:
            item['ref_num'] = None
            item['ref_tipo'] = 'Sección'
            item['ref_titulo'] = sec_sin_num['titulo']
        item['cita'] = cita
        salida.append(item)
    return errores, {'parte': stem, 'preguntas': salida}


def _main():
    indice = load_json(os.path.join(OUT_LIBRO, 'indice.json'))
    refs = load_json(os.path.join(OUT_LIBRO, 'refs.json'))
    orden = [p for t in indice['tomos'] for p in t['partes']]
    orden += [p for p in indice['partes'] if p not in orden]
    objetivo = [p for p in orden if indice['partes'][p].get('tipo') in LIMITES]

    ficheros = sorted(f for f in os.listdir(SRC) if f.endswith('.json')) if os.path.isdir(SRC) else []
    errores, partes, ids = [], {}, set()
    for f in ficheros:
        stem = f[:-5]
        try:
            datos = load_json(os.path.join(SRC, f))
        except json.JSONDecodeError as e:
            errores.append(f'{f}: JSON no válido: {e}')
            continue
        err, salida = validar_parte(stem, datos, indice, refs, ids)
        errores += err
        if salida:
            partes[stem] = salida

    if errores:
        print(f'repaso: {len(errores)} errores; no se escribe nada')
        for e in errores:
            print('  ' + e)
        return 1

    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.json') and f != 'indice.json' and f[:-5] not in partes:
            os.remove(os.path.join(OUT, f))
    lista = []
    for stem in [p for p in orden if p in partes]:
        info = indice['partes'][stem]
        qs = partes[stem]['preguntas']
        write_json(os.path.join(OUT, stem + '.json'), partes[stem])
        lista.append({'parte': stem, 'tipo': info['tipo'], 'num': info.get('num'), 'titulo': info['titulo'],
                      'tomo': info.get('tomo'), 'color': info.get('color'), 'preguntas': len(qs),
                      'numericas': sum(1 for q in qs if q['tipo'] == 'numero')})
    total = sum(p['preguntas'] for p in lista)
    write_json(os.path.join(OUT, 'indice.json'), {'version': 1, 'total': total, 'partes': lista})
    faltan = [p for p in objetivo if p not in partes]
    print(f'repaso: {total} preguntas en {len(lista)} de {len(objetivo)} capítulos y apéndices'
          + (f'; sin cuestionario: {", ".join(faltan)}' if faltan else ''))
    return 0


def main():
    """Builds web/public/libro/repaso/; returns 0, or 1 (with every error printed)."""
    try:
        return _main()
    except SystemExit as e:
        if e.code in (0, None):
            return 0
        print(e.code if isinstance(e.code, str) else f'repaso: error {e.code}')
        return 1


if __name__ == '__main__':
    sys.exit(main())
