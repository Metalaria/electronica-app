"""Ports into this package the paratext the book changed by hand (1.2, book 4.1).

    python3 contenido/paratexto/scripts/importar_libro.py      (reads the book's Fuentes/paratexto/, never writes there)

Since 4.0 the author's tools edited the generated paratext directly: the suggested readings of every chapter with
their current editions (Informes/decisiones_4.1.md E8), the degree page with the 4.1 numbering and the CIN/351/2009
coverage (E3, G1–G7), and the paratext of the chapters new in 4.0 and 4.1 (cap55, cap56, cap57, apK). The drafted
pieces of each part — `objetivos-cap`, `grado`, `resumen`, `normas` — are the author's text, so the book's version is
the source: this writes redaccion/libro41.yaml with, per part, the book's line of each drafted piece that differs from
what the drafts in redaccion/tomo*.yaml give (`typst`), and for a part the drafts do not know, its objectives,
summary and degree mapping read back from the book (the package's own data: datos/<parte>.json's «redactado»).
grado.typ and paratexto.typ (the template's functions) are kept as the book has them (redaccion/grado.typ,
paratexto.typ). The derived pieces (key terms, formulas, self-assessment and its solutions) are NOT imported: they
come from the app's data; comparar.py lists what still differs and why. The difficulty dots are (1.2, `niveles`):
the book's printed levels win over the app's rule (generar.py), so regenerating never changes a printed dot.
"""
import json
import os
import re
import shutil
import sys

import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comun import AQUI, APP, partes_del_libro  # noqa: E402

sys.path.insert(0, os.path.join(APP, 'contenido'))
import fuentes  # noqa: E402

REDACTADAS = ('objetivos-cap', 'terminos', 'grado', 'resumen', 'normas')
PIEZA = re.compile(r'^#let ([\w-]+) = (.*)$')


def piezas(texto):
    return {m.group(1): m.group(0) for m in map(PIEZA.match, texto.split('\n')) if m}


def contenidos(s):
    """The top-level [content] arguments of a Typst call, unescaped to plain text."""
    out, d, ini = [], 0, None
    i = 0
    while i < len(s):
        c = s[i]
        if c == '\\':
            i += 2
            continue
        if c == '[':
            if d == 0:
                ini = i + 1
            d += 1
        elif c == ']':
            d -= 1
            if d == 0:
                out.append(re.sub(r'\\(.)', r'\1', s[ini:i]))
        i += 1
    return out


def main():
    libro = fuentes.PARATEXTO
    if not os.path.isdir(libro):
        print('importar_libro: no están las fuentes del libro (EPA_FUENTES)')
        return 1
    import generar_typ as G
    salida = {}
    for p, info, tomo in partes_del_libro():
        ruta = os.path.join(libro, p + '.typ')
        if not os.path.exists(ruta):
            continue
        b = piezas(open(ruta, encoding='utf-8').read())
        e = {}
        if p not in G.RED_BORRADOR:
            # a part the drafts do not know: its drafted texts as the book has them
            e['objetivos'] = contenidos(b['objetivos-cap'][len('#let objetivos-cap = objetivos('):])
            e['resumen'] = (contenidos(b['resumen'])[:1] or [''])[0]
            mats = re.findall(r'"([^"]+)"', re.search(r'materias: (\(.*?\)),', b['grado']).group(1)) if 'materias' in b['grado'] else []
            inverso = {v: k for k, v in G.MATERIAS.items()}
            e['grado'] = {'materias': [inverso.get(m, m) for m in mats],
                          'competencias': re.findall(r'\("([A-Z]{2}\d+)", "', b['grado'])}
            e['lecturas'] = []
        r = dict(G.RED_BORRADOR.get(p, {}), **{k: v for k, v in e.items()})
        d = {'parte': p, 'dificultad': [], 'terminos_clave': [], 'formulas': [], 'autoevaluacion': [], 'normas': [],
             'titulo': info['titulo']}
        generado = piezas(G.typ_parte(d, r))
        typst = {k: b[k] for k in REDACTADAS if k in b and (k == 'normas' or generado.get(k) != b[k])}
        if typst:
            e['typst'] = typst
        # 1.2: the difficulty dots the book prints; generar.py keeps them (redaccion/niveles.yaml gives those of the
        # exercises the book prints without dots)
        niveles = dict((k, int(n)) for k, n in re.findall(r'"([\w.\-]+)": ([123])', b.get('niveles', '')))
        if niveles:
            e['niveles'] = niveles
        # the app's review questions the book's self-assessment leaves out (1.1 expansions' questions that the book's
        # paratext did not take in, 4.0): not written to the paratext
        m = re.match(r'^#let autoev = autoevaluacion\("[^"]+", (.*)\)$', b.get('autoev', ''))
        libro_ids = set(re.findall(r'\("((?:cap|ap)[\w-]+-\d+)", \[', m.group(1))) if m else set()
        app_ids = [q['id'] for q in json.load(open(os.path.join(G.DATOS, p + '.json'), encoding='utf-8'))['autoevaluacion']]
        fuera = [i for i in app_ids if i not in libro_ids]
        if fuera and libro_ids:
            e['autoev_fuera'] = fuera
        if p not in G.RED_BORRADOR:
            # a part whose whole paratext was written outside this package (4.0/4.1: libro-maqueta's
            # paratexto_nuevos.py, libro-p10): the book's file is the source, kept as it is
            os.makedirs(os.path.join(AQUI, 'redaccion', 'libro41'), exist_ok=True)
            shutil.copy2(ruta, os.path.join(AQUI, 'redaccion', 'libro41', p + '.typ'))
        if e:
            salida[p] = e
    cabecera = ('# Generated by scripts/importar_libro.py from the book\'s Fuentes/paratexto/ (4.1): the drafted pieces the\n'
                '# book changed by hand, line by line, and the drafted texts of the parts new since 4.0. Do not edit by hand:\n'
                '# edit the book, then import again.\n')
    with open(os.path.join(AQUI, 'redaccion', 'libro41.yaml'), 'w', encoding='utf-8') as f:
        f.write(cabecera + yaml.safe_dump(salida, allow_unicode=True, sort_keys=True, width=100000))
    shutil.copy2(os.path.join(libro, 'grado.typ'), os.path.join(AQUI, 'redaccion', 'grado.typ'))
    shutil.copy2(os.path.join(libro, 'paratexto.typ'), os.path.join(AQUI, 'paratexto.typ'))
    print(f'importar_libro: {len(salida)} partes con texto del libro, grado.typ y paratexto.typ')
    return 0


if __name__ == '__main__':
    sys.exit(main())
