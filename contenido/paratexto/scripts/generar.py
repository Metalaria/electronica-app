"""Deterministic paratext data for every chapter and appendix, from the app's converted book data only.

Writes datos/<parte>.json with:
  terminos_clave   glossary terms of the chapter (rule in REVISAR.md)
  autoevaluacion   review questions of repaso/<parte>.json, in the app's order
  dificultad       1–3 dots per exercise of ejercicios.json: the book's own, then redaccion/niveles.yaml, then the
                   rule below (REVISAR.md); `origen` says which (1.2)
  formulas         the chapter's formulas from formulas.json (deduplicated), with the card membership
  normas           standards, legislation and documents literally cited in the chapter text
and datos/indice-tomo<N>.json with the alphabetical index of each volume.
Re-running gives the same output (sorted, no clocks, no randomness).
"""
import collections
import os
import re

from comun import DATOS, INDICE, cargar, clave_orden, fragmentos, guardar, partes_del_libro

REFS = cargar('refs.json')
GLOSARIO = cargar('glosario.json')
EJERCICIOS = cargar('ejercicios.json')
FORMULAS = cargar('formulas.json')

# ------------------------------------------------------------------------------------- glossary matching
ACRONIMO = re.compile(r'[A-Z0-9][A-Z0-9\-/+&²]*')


def es_acronimo(s):
    return bool(ACRONIMO.fullmatch(s)) and sum(c.isupper() for c in s) >= 2


def variantes(termino):
    """[(text, case_sensitive)] under which a glossary term is searched in the text."""
    out = []
    partes = [x.strip() for x in termino.split(' / ')]
    for p in partes:
        m = re.match(r'^(.*?)\s*\(([^)]*)\)\s*$', p)
        base, par = (m.group(1), m.group(2)) if m else (p, None)
        if base:
            if es_acronimo(base):
                out.append((base, True))
            elif len(base) >= 3:
                out.append((base, False))
        if par:
            if es_acronimo(par):
                out.append((par, True))
            elif (' ' in par or '-' in par) and re.fullmatch(r'[a-zA-Z \-]+', par) and len(par) >= 6:
                out.append((par, False))
    return out


def compilar_glosario():
    ci, cs = {}, {}
    for g in GLOSARIO:
        for v, sens in variantes(g['termino']):
            (cs if sens else ci).setdefault(v if sens else v.lower(), g['id'])
    def rx(d, flags):
        alts = sorted(d, key=len, reverse=True)
        suf = '' if flags == 0 else r'(?:e?s)?'
        return re.compile(r'(?<![\w\-])(' + '|'.join(re.escape(a) for a in alts) + r')' + suf + r'(?![\w])', flags)
    return (rx(ci, re.I), ci), (rx(cs, 0), cs)


(RX_CI, MAPA_CI), (RX_CS, MAPA_CS) = compilar_glosario()
POR_ID = {g['id']: g for g in GLOSARIO}


def apariciones(fr):
    """Glossary id → Counter(location label) where a location is the labelled h3 if any, else the h2."""
    res = collections.defaultdict(collections.Counter)
    for h2, h3, kind, tx in fr:
        if kind in ('codigo',):
            continue
        loc = h3 if (h3 and h3 in REFS) else h2
        if not loc or loc not in REFS:
            continue
        for m in RX_CI.finditer(tx):
            gid = MAPA_CI.get(m.group(1).lower())
            if gid:
                res[gid][loc] += 1
        for m in RX_CS.finditer(tx):
            gid = MAPA_CS.get(m.group(1))
            if gid:
                res[gid][loc] += 1
    return res


def parte_de(label):
    r = REFS.get(label)
    return r['parte'] if r else None


def h2_de(label):
    """sec-1.2.3 → sec-1.2 (the section that holds a subsection label)."""
    r = REFS.get(label)
    if not r:
        return None
    for s in INDICE['partes'][r['parte']]['secciones']:
        if s['label'] == label:
            return label
    m = re.match(r'^(sec-[^.]+\.\d+)\.\d+$', label)
    return m.group(1) if m and m.group(1) in REFS else label


# ------------------------------------------------------------------------------------- key terms
MAX_CLAVE = 24
MIN_FRECUENCIA = 3


def terminos_clave(parte, apar):
    con_ver = []
    for g in GLOSARIO:
        if any(parte_de(v) == parte for v in g.get('ver', [])):
            con_ver.append(g['id'])
    elegidos = list(dict.fromkeys(con_ver))
    if len(elegidos) < MAX_CLAVE:
        resto = sorted(((sum(c.values()), gid) for gid, c in apar.items() if gid not in elegidos
                        and sum(c.values()) >= MIN_FRECUENCIA), key=lambda x: (-x[0], x[1]))
        elegidos += [gid for _, gid in resto[:MAX_CLAVE - len(elegidos)]]
    else:
        # more glossary entries than room: keep the ones the chapter uses most
        elegidos = sorted(elegidos, key=lambda g: (-sum(apar.get(g, {}).values()), g))[:MAX_CLAVE]
    out = []
    for gid in elegidos:
        g = POR_ID[gid]
        locs = [v for v in g.get('ver', []) if parte_de(v) == parte]
        if not locs and gid in apar:
            locs = [apar[gid].most_common(1)[0][0]]
        out.append({'id': gid, 'termino': g['termino'], 'ref': locs[0] if locs else None,
                    'ref_num': REFS[locs[0]]['num'] if locs else None,
                    'motivo': 'glosario' if gid in con_ver else 'frecuencia',
                    'apariciones': sum(apar.get(gid, {}).values())})
    out.sort(key=lambda x: clave_orden(x['termino']))
    return out


# ------------------------------------------------------------------------------------- difficulty
def dificultad(it):
    """1–3 dots from the app's own classification of the exercise (see REVISAR.md).

    partes = numeric answers + extra questions + other self-assessed parts («otras»).
    3: a design problem (tipo prob, from the «Problemas de diseño» sections), any design part
       (clase or otras «diseno»), or 4 or more parts.
    2: a reasoning exercise (clase or otras «razonamiento»), or 2–3 parts.
    1: everything else (one direct result, one choice or one short text answer).
    """
    otras = [o.get('clase') for o in it.get('otras', [])]
    partes = len(it.get('respuestas', [])) + len(it.get('preguntas', [])) + len(otras)
    motivos = []
    if it['tipo'] == 'prob':
        motivos.append('problema de diseño')
    if it['clase'] == 'diseno' or 'diseno' in otras:
        motivos.append('apartado de diseño')
    if partes >= 4:
        motivos.append(f'{partes} apartados')
    if motivos:
        return 3, motivos
    if it['clase'] == 'razonamiento' or 'razonamiento' in otras:
        motivos.append('razonamiento')
    if 2 <= partes <= 3:
        motivos.append(f'{partes} apartados')
    if motivos:
        return 2, motivos
    return 1, ['un resultado directo' if it['clase'] == 'numerico' else f"respuesta de tipo {it['clase']}"]


def _niveles_fijados():
    """1.2: the levels that win over the rule, {label: (level, origin)}.

    - «libro»: the dots the book prints (its `niveles`, brought by scripts/importar_libro.py into redaccion/libro41.yaml):
      the 1.1 levels it keeps, so regenerating the paratext no longer changes the dots of exercises already printed;
    - «propuesta» and «aplicacion»: redaccion/niveles.yaml, the exercises the book prints without dots (those new
      since 4.0): the ten levels decisiones_4.1.md G5 proposes, and the app's for the rest (the rule on the curated
      answers, reviewed by hand). The rule below is only the fallback for an exercise in none of them.
    """
    import yaml
    from comun import REDACCION
    fijados = {}
    ruta = os.path.join(REDACCION, 'libro41.yaml')
    libro = (yaml.safe_load(open(ruta, encoding='utf-8')) or {}) if os.path.exists(ruta) else {}
    for p in libro.values():
        for k, n in (p.get('niveles') or {}).items():
            fijados[k] = (int(n), 'libro')
    ruta = os.path.join(REDACCION, 'niveles.yaml')
    propios = (yaml.safe_load(open(ruta, encoding='utf-8')) or {}) if os.path.exists(ruta) else {}
    for origen in ('propuesta', 'aplicacion'):
        for k, n in (propios.get(origen) or {}).items():
            if k in fijados:
                raise ValueError(f'niveles.yaml: {k} ya tiene nivel en el libro ({fijados[k][0]})')
            if int(n) not in (1, 2, 3):
                raise ValueError(f'niveles.yaml: {k}: el nivel tiene que ser 1, 2 o 3')
            fijados[k] = (int(n), origen)
    return fijados


NIVELES_FIJADOS = _niveles_fijados()


def dificultades(parte):
    caps = {c['parte']: c['items'] for c in EJERCICIOS['capitulos']}
    out = []
    for k in caps.get(parte, []):
        it = EJERCICIOS['items'][k]
        regla, motivos = dificultad(it)
        n, origen = NIVELES_FIJADOS.get(k, (regla, 'regla'))
        if origen == 'regla':
            print(f'dificultad: {k} sin nivel en el libro ni en redaccion/niveles.yaml; se usa la regla ({regla})')
        out.append({'id': k, 'num': it['num'], 'tipo': it['tipo'], 'nivel': n, 'origen': origen, 'regla': regla,
                    'motivos': motivos,
                    'clase': it['clase'], 'modo': it['modo'],
                    'en_libro': bool(it.get('pos')),
                    'titulo': it.get('titulo')})
    return out


# ------------------------------------------------------------------------------------- formulas
def formulas(parte):
    en_tarjeta = set()
    for t in FORMULAS['tarjetas']:
        if t['parte'] == parte:
            en_tarjeta.update(t['formulas'])
    vistos = {}
    for f in FORMULAS['formulas']:
        if f['parte'] != parte:
            continue
        clave = f['fuente'].strip()
        if clave in vistos:
            vistos[clave]['ids'].append(f['id'])
            vistos[clave]['tarjeta'] = vistos[clave]['tarjeta'] or f['id'] in en_tarjeta
            continue
        vistos[clave] = {'ids': [f['id']], 'nombre': f['nombre'], 'fuente': clave,
                         'seccion': f['seccion']['label'], 'seccion_num': f['seccion']['num'],
                         'seccion_titulo': f['seccion']['titulo'], 'familia': f['familia'],
                         'tarjeta': f['id'] in en_tarjeta}

    def orden(x):
        return [int(n) if n.isdigit() else n for n in re.split(r'[.\-]', x['seccion_num'] or '')]
    return sorted(vistos.values(), key=orden)


# ------------------------------------------------------------------------------------- standards
NORMA = re.compile(
    r'(?<![\w\-])(?:'
    r'(?:UNE(?:[- ]EN)?|EN|IEC|CEI|ISO(?:/IEC)?|IEEE|IPC|ANSI|ASME|CISPR|ETSI|DIN|ASTM|SAE|NEMA|MIL-STD|MIL-HDBK|EIA|TIA|JESD)'
    r'(?:[- ][A-Z]{1,3})?[- ]?\d[\w.\-]*(?:[/ ](?:ASME|ANSI|IEEE|IEC|EN) ?[A-Z]?\d[\w.]*)?'
    r'|JEDEC|RS-(?:232|422|423|485)(?:-[A-Z])?'
    r')')
LEGAL = re.compile(r'Directiva \((?:UE|CE)\) \d{2,4}/\d+|\bRoHS\b|\bREACH\b|\bRAEE\b|\bWEEE\b|marcado CE')
DOCUMENTO = re.compile(
    r'(hojas? de datos|manual(?: de instrucciones)?|nota de aplicación)\s+(?:del?|de la|de los)\s+'
    r'(?:propio\s+|fabricante\s+)?((?:kit\s+)?[A-Z0-9][\w\-/+.]*(?: [A-Z0-9][\w\-/+.]*){0,2})')
NO_NORMA = re.compile(r'^(?:ULN|EN\d|DIN\d)')


def contexto(tx, m, n=70):
    a = max(0, m.start() - n)
    b = min(len(tx), m.end() + n)
    s = tx[a:b].strip()
    return ('…' if a > 0 else '') + ' '.join(s.split()) + ('…' if b < len(tx) else '')


def normas(parte, fr):
    vistas = collections.OrderedDict()
    for h2, h3, kind, tx in fr:
        loc = h3 if (h3 and h3 in REFS) else h2
        for tipo, rx in (('norma', NORMA), ('legislacion', LEGAL), ('documento', DOCUMENTO)):
            for m in rx.finditer(tx):
                txt = m.group(0).rstrip('.,;:)')
                if tipo == 'norma' and NO_NORMA.match(txt):
                    continue
                if tipo == 'documento':
                    txt = m.group(1).capitalize() + ' de ' + m.group(2)
                clave = (tipo, txt.lower().replace('hojas de datos', 'hoja de datos'))
                e = vistas.setdefault(clave, {'tipo': tipo, 'cita': txt, 'refs': [], 'contexto': contexto(tx, m)})
                if loc and loc in REFS and loc not in e['refs']:
                    e['refs'].append(loc)
    out = list(vistas.values())
    for e in out:
        e['refs_num'] = [REFS[r]['num'] for r in e['refs']]
    return out


# ------------------------------------------------------------------------------------- review questions
def autoevaluacion(parte):
    ruta = f'repaso/{parte}.json'
    try:
        d = cargar(ruta)
    except FileNotFoundError:
        return []
    out = []
    for q in d['preguntas']:
        e = {'id': q['id'], 'tipo': q['tipo'], 'enunciado': q['enunciado'], 'explicacion': q['explicacion'],
             'ref': q['ref'], 'ref_num': q['ref_num'], 'ref_valida': q['ref'] in REFS}
        if q['tipo'] == 'opcion':
            e['opciones'] = q['opciones']
            e['correcta'] = q['correcta']
        else:
            e.update(valor_texto=q['valor_texto'], unidad=q.get('unidad', ''), tolerancia=q.get('tolerancia'))
        out.append(e)
    return out


# ------------------------------------------------------------------------------------- volume index
TITULOS_GENERICOS = re.compile(r'^(resumen del cap|problemas de diseño|herramientas adicionales|ejercicios|problema \d|'
                               r'introducci[oó]n$|ampliaci[oó]n$)', re.I)
MAX_LOCS = 4


def indice_tomo(tomo, partes, apar_por_parte, fr_por_parte):
    entradas = {}
    for p in partes:
        apar = apar_por_parte[p]
        for gid, c in apar.items():
            g = POR_ID[gid]
            e = entradas.setdefault(('g', gid), {'texto': g['termino'], 'tipo': 'glosario', 'principales': [],
                                                 'otras': collections.Counter()})
            for loc, n in c.items():
                e['otras'][loc] += n
        for g in GLOSARIO:
            for v in g.get('ver', []):
                if parte_de(v) == p:
                    e = entradas.setdefault(('g', g['id']), {'texto': g['termino'], 'tipo': 'glosario',
                                                             'principales': [], 'otras': collections.Counter()})
                    if v not in e['principales']:
                        e['principales'].append(v)
        # headings: sections and labelled subsections
        for h2, h3, kind, tx in fr_por_parte[p]:
            lab = h3 if kind == 'h3' else h2 if kind == 'h2' else None
            if kind not in ('h2', 'h3') or not lab or lab not in REFS:
                continue
            t = re.sub(r'^[A-J]\.\d+\s+', '', tx).strip()
            if TITULOS_GENERICOS.search(t):
                continue
            e = entradas.setdefault(('t', t.lower()), {'texto': t, 'tipo': 'titulo', 'principales': [],
                                                       'otras': collections.Counter()})
            if lab not in e['principales']:
                e['principales'].append(lab)

    def orden_libro(lab):
        r = REFS[lab]
        orden_partes = [x[0] for x in partes_del_libro()]
        n = [int(x) if x.isdigit() else x for x in re.split(r'[.]', r['num'])]
        return (orden_partes.index(r['parte']), [(0, x) if isinstance(x, int) else (1, x) for x in n])

    out = []
    for (tipo, _), e in entradas.items():
        principales = sorted(set(e['principales']), key=orden_libro)
        # a subsection counts as its section when the section is already a main reference
        otras = [loc for loc, _ in sorted(e['otras'].items(), key=lambda x: (-x[1], orden_libro(x[0])))
                 if loc not in principales and h2_de(loc) not in principales]
        otras = sorted(otras[:max(0, MAX_LOCS - len(principales))], key=orden_libro)
        if not principales and not otras:
            continue
        out.append({'texto': e['texto'], 'tipo': e['tipo'], 'principales': principales, 'otras': otras})
    # merge a heading entry into a glossary entry with the same text
    por_texto = {}
    final = []
    for e in sorted(out, key=lambda x: (clave_orden(x['texto']), x['tipo'])):
        k = e['texto'].lower()
        if k in por_texto:
            prev = por_texto[k]
            prev['principales'] = sorted(set(prev['principales'] + e['principales']), key=orden_libro)
            prev['otras'] = [o for o in prev['otras'] if o not in prev['principales']]
            continue
        por_texto[k] = e
        final.append(e)
    return {'tomo': tomo, 'partes': partes, 'entradas': final}


# ------------------------------------------------------------------------------------- main
def main():
    apar_por_parte, fr_por_parte = {}, {}
    tomos = collections.OrderedDict()
    resumen = []
    for p, info, tomo in partes_del_libro():
        d, fr = fragmentos(p)
        apar = apariciones(fr)
        apar_por_parte[p], fr_por_parte[p] = apar, fr
        tomos.setdefault(tomo, []).append(p)
        datos = {
            'parte': p, 'tipo': info['tipo'], 'num': info.get('num'), 'label': info.get('label'),
            'titulo': info['titulo'], 'tomo': tomo, 'color': info['color'],
            'secciones': info['secciones'],
            'terminos_clave': terminos_clave(p, apar),
            'autoevaluacion': autoevaluacion(p),
            'dificultad': dificultades(p),
            'formulas': formulas(p),
            'normas': normas(p, fr),
        }
        guardar(os.path.join(DATOS, f'{p}.json'), datos)
        resumen.append((p, len(datos['terminos_clave']), len(datos['autoevaluacion']), len(datos['dificultad']),
                        len(datos['formulas']), len(datos['normas'])))
    for t, ps in tomos.items():
        ind = indice_tomo(t, ps, apar_por_parte, fr_por_parte)
        guardar(os.path.join(DATOS, f'indice-tomo{t}.json'), ind)
        print('tomo', t, 'entradas', len(ind['entradas']))
    niveles = collections.Counter()
    for p, *_ in resumen:
        pass
    origenes = collections.Counter()
    for k, it in EJERCICIOS['items'].items():
        n, origen = NIVELES_FIJADOS.get(k, (dificultad(it)[0], 'regla'))
        niveles[n] += 1
        origenes[origen] += 1
    print('niveles', dict(sorted(niveles.items())), 'origen', dict(sorted(origenes.items())))
    print('parte claves autoev ejerc formulas normas')
    for r in resumen:
        print(*r)


if __name__ == '__main__':
    main()
