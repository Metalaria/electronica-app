#!/usr/bin/env python3
"""Generate the app's content from the book's Typst sources.

    cd /home/claude/app && python3 contenido/generar.py [--comprobar-figuras]

Reads /home/claude/v3 (never writes there) and writes web/public/libro/: indice.json, refs.json,
glosario.json, busqueda.json, partes/<stem>.json, ec/*.svg, fig/*.svg, img/*. Equations and figures are
cached (contenido/.cache), so a rerun only renders what changed. The contract is ESQUEMA.md.
"""
import json
import os
import re
import shutil
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
V3 = '/home/claude/v3'
LIB = os.path.join(V3, 'libro')
OUT = os.path.join(APP, 'web/public/libro')
CACHE = os.path.join(HERE, '.cache')

sys.path.insert(0, HERE)
# reuse the book's own numbering and aliases; never leave bytecode in the v3 tree
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(V3, 'herramientas'))
import construir                     # noqa: E402
sys.dont_write_bytecode = False

import typst_parser                  # noqa: E402
import convertir                     # noqa: E402
import ecuaciones                    # noqa: E402
import figuras                       # noqa: E402
import validar                       # noqa: E402
import datos_figuras                 # noqa: E402
import spice                         # noqa: E402
import consolas                      # noqa: E402
import fm7303                        # noqa: E402
import repaso                        # noqa: E402
import formulas                      # noqa: E402
import ejercicios                    # noqa: E402
import proyectos_kicad               # noqa: E402
import glosario_imagenes             # noqa: E402

ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']


def load_json(path):
    return json.load(open(path, encoding='utf-8'))


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))


def reading_order():
    """[(file, volume)] in reading order: preliminaries first, novedades and credits closing volume VIII."""
    tomos = load_json(os.path.join(V3, 'tomos.json'))
    order = []
    for r in ROMAN:
        files = list(tomos[r])
        if r == 'I':
            files = ['00_preliminares.typ'] + files
        if r == ROMAN[-1]:
            if os.path.exists(os.path.join(LIB, 'novedades.typ')):
                files.append('novedades.typ')
            files.append('creditos.typ')
        order += [(f, r) for f in files]
    return order


def part_kind(stem):
    if stem.startswith('cap'):
        return 'capitulo'
    if stem.startswith('ap'):
        return 'apendice'
    if stem == 'glosario':
        return 'glosario'
    return 'anexo'


# ------------------------------------------------------------------ plain text for search
def block_text(b, out):
    t = b['t']
    if 'html' in b:
        out.append(convertir.strip_tags(b['html']))
    if t == 'lista':
        out.extend(convertir.strip_tags(x) for x in b['items'])
    elif t == 'deduccion':
        out.append(convertir.strip_tags(b['titulo']))
    elif t == 'figura':
        out.append(convertir.strip_tags(b['pie']))
    elif t == 'tabla':
        if b['pie']:
            out.append(convertir.strip_tags(b['pie']))
        for fila in b['filas']:
            out.append(' · '.join(convertir.strip_tags(c) for c in fila))
    elif t == 'ec':
        if b.get('etiqueta'):
            out.append(convertir.strip_tags(b['etiqueta']))
    elif t == 'codigo':
        out.append(b['texto'])
    elif t == 'ejercicios':
        for it in b['items']:
            for x in it['bloques']:
                block_text(x, out)
            for x in it['solucion'] or []:
                block_text(x, out)
    elif t == 'glosario':
        return
    for x in b.get('bloques', []):
        block_text(x, out)


def search_docs(stem, part, bloques):
    docs = []
    head = {'id': part.get('label') or stem, 'parte': stem,
            'titulo': ((part['num'] + ' ') if part.get('num') else '') + part['titulo'], 'texto': []}
    cur = head
    docs.append(head)
    for b in bloques:
        if b['t'] == 'h2':
            title = convertir.strip_tags(b['html'])
            cur = {'id': b['label'], 'parte': stem, 'titulo': (b['num'] + ' ' if b['num'] else '') + title,
                   'texto': []}
            docs.append(cur)
            continue
        block_text(b, cur['texto'])
    out = []
    for d in docs:
        d['texto'] = re.sub(r'\s+', ' ', ' '.join(d['texto'])).strip()
        if d['texto'] or d is not head:
            out.append(d)
    return out


# ------------------------------------------------------------------ main
def main():
    t0 = time.time()
    check_figs = '--comprobar-figuras' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(CACHE, exist_ok=True)
    alias = construir.load_alias()
    order = reading_order()

    style = ecuaciones.template_style(os.path.join(V3, 'plantilla/libro.typ'))
    nums, _ = construir.numbering()
    ecs = ecuaciones.Registro(os.path.join(OUT, 'ec'), CACHE, style, os.path.join(V3, 'fonts'), nums)
    figs = figuras.Registro(V3, OUT, CACHE)
    libro = convertir.Libro(ecs, figs)

    # chapter numbers follow libro/orden.json (chapters from 0, appendices from A)
    caps = [f for f in load_json(os.path.join(LIB, 'orden.json')) if f.startswith('cap')]
    aps = [f for f in load_json(os.path.join(LIB, 'orden.json')) if f.startswith('ap')]

    parts = {}                 # stem -> (Parte, bloques, tomo)
    for f, tomo in order:
        stem = f[:-4]
        kind = part_kind(stem)
        num = str(caps.index(f)) if kind == 'capitulo' else (chr(ord('A') + aps.index(f)) if kind == 'apendice' else None)
        text = open(os.path.join(LIB, f), encoding='utf-8').read()
        nodes, probs = typst_parser.parse(text, f)
        for line, msg, sample in probs:
            libro.problems.append((stem, line, msg, sample))
        ctx = convertir.Parte(libro, stem, kind, num)
        bloques = ctx.blocks(nodes)
        ctx.match_solutions(alias)
        if kind == 'glosario':
            bloques, entradas = convertir.glossary(ctx, bloques)
            ctx.entradas = entradas
        if ctx.titulo is None:
            libro.problem(ctx, 0, 'parte sin título')
            ctx.titulo = stem
        parts[stem] = (ctx, bloques, tomo)

    # references of the whole work, old labels resolved to the object that now holds them
    refs = dict(libro.refs)
    for old, new in alias.items():
        if new in libro.refs and old not in refs:
            refs[old] = dict(libro.refs[new])

    # equations and figures
    ec_stats = ecs.render()
    for h, err in ecs.failed.items():
        kind, src = ecs.wanted[h]
        libro.problems.append(('', 0, f'fórmula que Typst no compila ({err[:200]})', src[:120]))
    fig_stats = figs.process()
    for rel, err in figs.failed.items():
        libro.problems.append(('', 0, f'figura no convertida {rel}: {err}', ''))

    def fill_ec(o):
        if isinstance(o, dict):
            if o.get('t') == 'ec':
                meta = ecs.meta.get(o.pop('_h'), {'w': 0, 'h': 0})
                o['w'], o['h'] = meta['w'], meta['h']
            for v in o.values():
                fill_ec(v)
        elif isinstance(o, list):
            for v in o:
                fill_ec(v)

    # figure data for the interactive layer (ESQUEMA.md, «Datos de figuras»)
    datos_figuras.aplicar(V3, OUT, [b for _, b, _ in parts.values()], libro.problems)

    # write the parts
    if os.path.isdir(os.path.join(OUT, 'partes')):
        shutil.rmtree(os.path.join(OUT, 'partes'))
    indice_partes = {}
    busqueda = []
    glosario = []
    for stem, (ctx, bloques, tomo) in parts.items():
        fill_ec(bloques)
        convertir.resolve(bloques, libro, alias, ecs.meta, stem)
        part = {'id': stem, 'tipo': ctx.tipo, 'titulo': ctx.titulo, 'num': ctx.c, 'label': ctx.label,
                'color': ctx.color, 'tomo': tomo, 'bloques': bloques}
        write_json(os.path.join(OUT, 'partes', stem + '.json'), part)
        secciones = [{'num': b['num'], 'label': b['label'], 'titulo': convertir.strip_tags(b['html'])}
                     for b in bloques if b['t'] == 'h2']
        entry = {'tipo': ctx.tipo, 'titulo': ctx.titulo, 'color': ctx.color, 'tomo': tomo, 'secciones': secciones}
        if ctx.c is not None:
            entry.update(num=ctx.c, label=ctx.label)
        indice_partes[stem] = entry
        busqueda += search_docs(stem, part, bloques)
        if ctx.tipo == 'glosario':
            glosario = [dict(e) for e in ctx.entradas]
            for e in glosario:
                busqueda.append({'id': e['id'], 'parte': stem, 'titulo': e['termino'],
                                 'texto': convertir.strip_tags(e['html'])})

    # volumes and colour blocks
    titulos = load_json(os.path.join(V3, 'tomos_titulos.json'))
    tomos = [{'id': r, 'titulo': titulos[r], 'partes': [f[:-4] for f, t in order if t == r]} for r in ROMAN]
    prelim = open(os.path.join(LIB, '00_preliminares.typ'), encoding='utf-8').read()
    bloques_color = []
    for m in re.finditer(r'^- Bloque (\w+) — (.+?), capítulos #nr\("(cap-\d+)"\)', prelim, re.M):
        stem = refs[m.group(3)]['parte']
        bloques_color.append({'color': indice_partes[stem]['color'], 'nombre': m.group(2).strip()})
    creditos = open(os.path.join(LIB, 'creditos.typ'), encoding='utf-8').read()
    versions = re.findall(r'Versión (\d+\.\d+(?:\.\d+)?)', creditos)
    edicion = max(versions, key=lambda v: [int(x) for x in v.split('.')]) if versions else None
    indice = {'edicion': edicion, 'tomos': tomos, 'partes': indice_partes, 'bloques': bloques_color}

    write_json(os.path.join(OUT, 'indice.json'), indice)
    write_json(os.path.join(OUT, 'refs.json'), refs)
    write_json(os.path.join(OUT, 'glosario.json'), glosario)
    write_json(os.path.join(OUT, 'busqueda.json'), busqueda)

    # validation and summary
    ok = validar.run(OUT, LIB, [f for f, _ in order], indice, refs, libro, nums, ec_stats, fig_stats,
                     busqueda, glosario, time.time() - t0)
    ok = datos_figuras.validar(OUT) and ok
    ok = spice.main() == 0 and ok    # netlists for the simulator: spice/, spice.json (cached validation)
    ok = consolas.main() == 0 and ok  # NES and Neo Geo mainboards: web/public/consolas/
    ok = proyectos_kicad.main() == 0 and ok  # KiCad boards of chapters 48-51: web/public/proyectos/ (needs spice.json)
    ok = fm7303.main() == 0 and ok    # the FM7303 kit, live: web/public/fm7303/ (needs refs.json)
    ok = repaso.main() == 0 and ok    # chapter quizzes: web/public/libro/repaso/ (needs indice.json, refs.json)
    ok = formulas.main() == 0 and ok  # live calculators: formulas.json, formulas-ec.json (needs partes/, refs.json)
    ok = ejercicios.main([]) == 0 and ok  # self-checking exercises and problems: ejercicios.json (needs partes/)
    ok = glosario_imagenes.main([]) == 0 and ok  # glossary symbols and 3D models: glosario-imagenes.json
    ok = practica() and ok             # 0.10 «Aprender haciendo»: libro/practica/ (needs all of the above)
    if check_figs:
        validar.check_figures(figs, OUT)
    sys.exit(0 if ok else 1)


def practica():
    """The lessons' interactive items (web/scripts/practica10.mjs, Node + the app's ngspice; ESQUEMA.md «Práctica»)."""
    import subprocess
    web = os.path.join(os.path.dirname(HERE), 'web')
    if not shutil.which('node'):
        print('practica: falta node; no se generan las preguntas interactivas')
        return True
    return subprocess.run(['node', os.path.join('scripts', 'practica10.mjs')], cwd=web).returncode == 0


if __name__ == '__main__':
    main()
