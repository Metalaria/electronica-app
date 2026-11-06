#!/usr/bin/env python3
"""1.0 guided step mode («Resolver paso a paso»): web/public/libro/pasos.json.

    python3 contenido/pasos.py                    emit the approved steps (generar.py calls main())
    python3 contenido/pasos.py --proponer FICHERO write a proposal to review (never read by the app)

The proposal takes, for every self-checking numeric exercise, the chains «X = … = 12,5 mA» of the book's solution,
one step per chain, with the sentence it comes from. Nothing of it reaches the app until it is reviewed by hand in
contenido/pasos_curado.json, where every step is written out (its question, its answer, a hint, optional «por qué
no» explanations of the wrong options) with «"aprobado": true» on the exercise. The emitted file is checked:

  * every step quotes the book's solution literally («cita»), and a numeric step's value is written in its quote;
  * a numeric step's answer and alternatives parse as in contenido/ejercicios_curado.txt («12,5 mA ±2%»);
  * a choice step has two options or more, exactly one marked «*», and «por qué no» only for wrong options;
  * the last step is one of the exercise's own answers (the guided mode leads to the final result).

The contract is ESQUEMA.md («Paso a paso»).
"""
import json
import os
import re
import sys

import ejercicios as ej

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'web', 'public', 'libro')
CURADO = os.path.join(HERE, 'pasos_curado.json')
VERSION = 1


def frases(texto):
    return [f for f in re.split(r'(?<=[.;:])\s+(?=[A-ZÁÉÍÓÚÑ(¿])|;\s+', texto) if f.strip()]


def proponer(items, doc):
    out = {}
    for it in items:
        e = doc['items'].get(it['label'])
        if not e or e['modo'] != 'auto' or not e['respuestas']:
            continue
        pasos = []
        for f in frases(it['_sol']):
            for r in ej.resultados(f):
                pasos.append({'var': r['var'], 'valor': f"{r['escrito']} {r['u_escrita']}".strip(), 'cita': f.strip()[:400]})
        if len(pasos) >= 2:
            out[it['label']] = {'respuestas': [f"{r['nombre']} = {r['texto']}" for r in e['respuestas']],
                                'pistas': e['pistas'], 'propuesta': pasos}
    return out


def html_paso(t):
    """The pipeline's HTML of a curated text: _x / ^x marks as in ejercicios_curado.txt, and the <sub>, <sup>,
    <strong> and <em> written by hand kept as tags (marcado() escapes everything else)."""
    h = ej.marcado(t)
    return re.sub(r'&lt;(/?)(sub|sup|strong|em)&gt;', r'<\1\2>', h)


def numeros_de(texto):
    """Every number written in a text, as floats (Spanish comma, thin-space thousands)."""
    t = ej.normalizar_cita(texto).replace('−', '-')
    out = []
    for m in re.finditer(ej.NUM_RE, t):
        try:
            out.append(ej.num(m.group(0)))
        except ValueError:
            pass
    return out


def construir():
    _, items = ej.items_del_libro()
    por = {it['label']: it for it in items}
    doc, _, _ = ej.construir()
    curado = json.load(open(CURADO, encoding='utf-8')) if os.path.exists(CURADO) else {}
    salida, problemas = {}, []
    for label, c in curado.items():
        if label.startswith('_'):
            continue
        if label not in por or label not in doc['items']:
            problemas.append(f'[{label}] no es un ejercicio del libro')
            continue
        if not c.get('aprobado'):
            continue
        it, e = por[label], doc['items'][label]
        sol = ej.normalizar_cita(it['_sol'])
        pasos = []
        for k, p in enumerate(c['pasos']):
            donde = f'[{label}] paso {k + 1}'
            cita = ej.normalizar_cita(p.get('cita', ''))
            if not cita or cita not in sol:
                problemas.append(f'{donde}: la cita no está en la solución del libro: {cita[:90]!r}')
                continue
            q = {'pregunta': html_paso(p['pregunta']), 'explicacion': ej.marcado(p['cita'])}
            if p.get('pista'):
                q['pista'] = html_paso(p['pista'])
            if p['tipo'] == 'numerico':
                try:
                    r = ej.valor_dsl(p['respuesta'], donde)
                    alts = [ej.valor_dsl(a, donde) for a in p.get('alternativas', [])]
                except ValueError as err:
                    problemas.append(str(err))
                    continue
                escrito = re.match(ej.NUM_RE, p['respuesta'].strip()).group(0)
                # (the sign may be said in words: «181 … con signo negativo»)
                if not any(abs(abs(x) - abs(ej.num(escrito))) <= 1e-9 * max(1, abs(x)) for x in numeros_de(p['cita'])):
                    problemas.append(f'{donde}: el valor {escrito} no está escrito en la cita')
                # a step that gives one of the exercise's own answers accepts exactly what the exercise accepts
                # (its tolerance and its alternatives: review 10e, «181» for −181, ±1 for analogWrite)
                igual = next((x for x in e['respuestas'] if x['unidad'] == r['unidad'] and abs(x['valor'] - r['valor'])
                              <= max(x.get('tol', 0) * abs(x['valor']), x.get('tol_abs', 0), 1e-12)), None)
                if igual is not None and 'alternativas' not in p and not re.search(r'±', p['respuesta']):
                    for k2 in ('tol', 'tol_abs'):
                        r.pop(k2, None)
                        if k2 in igual:
                            r[k2] = igual[k2]
                    r['valor'] = igual['valor']
                    alts = [dict(a, unidad=igual['unidad']) for a in igual['alternativas']]
                q.update({'tipo': 'numerico', 'nombre': html_paso(p['nombre']),
                          'respuesta': {k2: v for k2, v in r.items()},
                          'alternativas': [{k2: v for k2, v in a.items() if k2 != 'unidad'} for a in alts]})
                q['respuesta']['texto'] = ej.superindices(q['respuesta']['texto'])
            elif p['tipo'] == 'eleccion':
                ops = p['opciones']
                if len(ops) < 2 or sum(o.startswith('*') for o in ops) != 1:
                    problemas.append(f'{donde}: elección con dos opciones o más y exactamente una «*»')
                    continue
                q.update({'tipo': 'eleccion', 'opciones': [html_paso(o.lstrip('*').strip()) for o in ops],
                          'correcta': next(i for i, o in enumerate(ops) if o.startswith('*'))})
                pq = p.get('porque', {})
                for i_str, txt in pq.items():
                    if int(i_str) == q['correcta']:
                        problemas.append(f'{donde}: «por qué no» en la opción correcta')
                q['porque'] = {i_str: html_paso(t) for i_str, t in pq.items()}
            else:
                problemas.append(f'{donde}: tipo {p["tipo"]!r}')
                continue
            pasos.append(q)
        if len(pasos) != len(c['pasos']):
            continue
        ult = pasos[-1] if pasos else None
        if not ult or ult['tipo'] != 'numerico' or not any(
                r['unidad'] == ult['respuesta']['unidad'] and
                abs(r['valor'] - ult['respuesta']['valor']) <= max(r.get('tol', 0.02) * abs(r['valor']), r.get('tol_abs', 0))
                for r in e['respuestas']):
            problemas.append(f'[{label}] el último paso no es una de las respuestas del ejercicio')
            continue
        if len(pasos) < 2:
            problemas.append(f'[{label}] un paso a paso necesita dos pasos o más')
            continue
        salida[label] = {'pasos': pasos}
    return {'version': VERSION, 'items': salida, 'total': len(salida),
            'pasos': sum(len(v['pasos']) for v in salida.values())}, problemas


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if '--proponer' in argv:
        _, items = ej.items_del_libro()
        doc, _, _ = ej.construir()
        destino = argv[argv.index('--proponer') + 1]
        json.dump(proponer(items, doc), open(destino, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'pasos: propuesta en {destino}')
        return 0
    doc, problemas = construir()
    for p in problemas:
        print('  pasos: ' + p)
    if problemas:
        return 1
    texto = json.dumps(doc, ensure_ascii=False, separators=(',', ':'))
    ruta = os.path.join(OUT, 'pasos.json')
    # idempotent: the file is rewritten only when it changes
    if not os.path.exists(ruta) or open(ruta, encoding='utf-8').read() != texto:
        open(ruta, 'w', encoding='utf-8').write(texto)
    print(f"pasos.json: {doc['total']} ejercicios con paso a paso, {doc['pasos']} pasos (todos revisados a mano)")
    return 0


if __name__ == '__main__':
    sys.exit(main())
