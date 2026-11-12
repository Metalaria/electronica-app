"""The ids of book 4.1 for the two chapters new in 4.0 (the book's Informes/ids_4.1.json), as the app writes them.

The same rules as web/src/lib/esquemas.ts `renombrar41` (the migration of the reader's stored data; the tests check
that both agree): the part `cap-new-automatas` → `cap55` (`cap-new-maquinas` → `cap56`), also inside composite ids
(`cap55/…`, `cap55-pred-sec-55.3`, `l:cap55/sec-55.1`); the labels `sec-|fig-|ej-|prob-|tab-new-automatas.N` →
`…-55.N`; the review questions `cap-new-automatas-N` → `cap55-0N`; the chapter's own label, where a label is meant,
`cap-new-automatas` → `cap-55` (`etiqueta`). Sections new inside older chapters (`sec-new-24-trifasica`) keep theirs.

    python3 contenido/ids41.py FICHERO…     rewrites those app sources in place (only ids; reports what changed)
"""
import re
import sys

CAP = {'automatas': '55', 'maquinas': '56'}
OBJETO = re.compile(r'(^|\W)(sec|fig|ej|prob|tab)-new-(automatas|maquinas)\.([0-9A-Za-z]+)')
PREGUNTA = re.compile(r'(^|[^\w-])cap-new-(automatas|maquinas)-(\d+)(?![\w.])')
PARTE = re.compile(r'(^|[^\w-])cap-new-(automatas|maquinas)(?!\w)')


def renombrar(s):
    if 'new-automatas' not in s and 'new-maquinas' not in s:
        return s
    s = OBJETO.sub(lambda m: f'{m.group(1)}{m.group(2)}-{CAP[m.group(3)]}.{m.group(4)}', s)
    s = PREGUNTA.sub(lambda m: f'{m.group(1)}cap{CAP[m.group(2)]}-{int(m.group(3)):02d}', s)
    return PARTE.sub(lambda m: f'{m.group(1)}cap{CAP[m.group(2)]}', s)


def etiqueta(s):
    """A stored LABEL: the chapter's own label is `cap-55`, not the part."""
    m = re.fullmatch(r'cap-new-(automatas|maquinas)', s)
    return f'cap-{CAP[m.group(1)]}' if m else renombrar(s)


if __name__ == '__main__':
    for ruta in sys.argv[1:]:
        with open(ruta, encoding='utf-8') as f:
            viejo = f.read()
        nuevo = renombrar(viejo)
        if nuevo != viejo:
            with open(ruta, 'w', encoding='utf-8') as f:
                f.write(nuevo)
            print(f'{ruta}: identificadores de la 4.1')
