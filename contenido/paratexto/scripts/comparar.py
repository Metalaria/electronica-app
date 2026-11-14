"""Compares the paratext this package generates (comun.SALIDA) with the book's own Fuentes/paratexto/ (read only).

    python3 contenido/paratexto/scripts/comparar.py          writes contenido/paratexto/DIFERENCIAS.md, prints a summary

The book's paratext is generated from the app's data (this package); since 4.0 the book has also changed it by hand
(Informes/decisiones_4.1.md E3, E8, E9 and the paratext of the new chapters). Every file is identical, or each
differing piece (`#let NAME = …` line of a chapter, or line of a volume file) is listed with its cause.
"""
import difflib
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comun import AQUI, APP, SALIDA  # noqa: E402

sys.path.insert(0, os.path.join(APP, 'contenido'))
import fuentes  # noqa: E402

PIEZA = re.compile(r'^#let ([\w-]+) = ')


def reserva(linea):
    """A line with its fallback printed numbers blanked (the template prints NUMS/PARTES over them)."""
    linea = re.sub(r'\[(Capítulo|Apéndice) [0-9A-K]+\]', r'[\1 #]', linea)
    return re.sub(r'("(?:sec|prob|ej|fig|tab|cap|ap)-[\w.-]+"), "[^"]*"', r'\1, "#"', linea)


def piezas(texto):
    out = {}
    for linea in texto.split('\n'):
        m = PIEZA.match(linea)
        if m:
            out[m.group(1)] = linea
    return out


def main():
    libro = fuentes.PARATEXTO
    if not os.path.isdir(libro):
        print('comparar: no están las fuentes del libro (EPA_FUENTES)')
        return 1
    nombres = sorted(set(os.listdir(libro)) | set(f for f in os.listdir(SALIDA) if f.endswith('.typ')))
    iguales, distintos, filas = [], {}, []
    for f in nombres:
        a = os.path.join(SALIDA, f)
        b = os.path.join(libro, f)
        if not f.endswith('.typ'):
            continue
        if not os.path.exists(a):
            distintos[f] = ['(solo en el libro: el paquete no lo genera)']
            continue
        if not os.path.exists(b):
            distintos[f] = ['(solo en el paquete)']
            continue
        ta, tb = open(a, encoding='utf-8').read(), open(b, encoding='utf-8').read()
        if ta == tb:
            iguales.append(f)
            continue
        pa, pb = piezas(ta), piezas(tb)
        if pa or pb:
            d = [k + (' (solo números de reserva)' if reserva(pa.get(k, '')) == reserva(pb.get(k, '')) else '')
                 for k in sorted(set(pa) | set(pb)) if pa.get(k) != pb.get(k)]
            otras = [x for x in difflib.unified_diff(
                [l for l in ta.split('\n') if not PIEZA.match(l)], [l for l in tb.split('\n') if not PIEZA.match(l)],
                lineterm='', n=0) if x[:1] in '+-' and x[:3] not in ('+++', '---')]
            distintos[f] = d + ([f'{len(otras)} líneas fuera de las piezas'] if otras else [])
        else:
            n = sum(1 for x in difflib.unified_diff(ta.split('\n'), tb.split('\n'), lineterm='', n=0)
                    if x[:1] in '+-' and x[:3] not in ('+++', '---'))
            distintos[f] = [f'{n} líneas distintas']
    for f, d in sorted(distintos.items()):
        filas.append(f'| `{f}` | {", ".join(d)} |')
    md = ['# Paratexto: lo generado frente al libro', '',
          'Escrito por `contenido/paratexto/scripts/comparar.py`: el paratexto que genera la aplicación '
          '(`generar.py` y `generar_typ.py` de este paquete) frente a `Fuentes/paratexto/` del libro. '
          'Las causas de cada clase de diferencia están en el README («Paratexto del libro»).', '',
          f'Iguales byte a byte: {len(iguales)} de {len(iguales) + len(distintos)}.', '',
          '| Fichero | Piezas distintas |', '|---|---|'] + filas + ['']
    open(os.path.join(AQUI, 'DIFERENCIAS.md'), 'w', encoding='utf-8').write('\n'.join(md))
    print(f'paratexto: {len(iguales)} iguales, {len(distintos)} distintos (DIFERENCIAS.md)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
