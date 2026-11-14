#!/usr/bin/env python3
"""Compile Typst files of paratexto/ with the typst Python bindings and the template's fonts.

Usage: python3 compilar.py [archivo.typ] [variante ...]
  archivo.typ  default muestra-paratexto.typ (relative to paratexto/); «todo» compiles a check of every
               chapter snippet and volume file (no PDF kept) instead.
  variante     <salida>-<color>, e.g. pantalla-intenso (default), imprenta-medio.
Output: salida/<nombre>-<variante>.pdf. Root is libro11/ so that ../plantilla/ resolves.
"""
import os
import sys
import tempfile

import typst

AQUI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAIZ = os.path.dirname(AQUI)
FUENTES = [os.path.join(RAIZ, 'plantilla', 'fuentes')]


def compilar(ruta, variante, out):
    salida, color = variante.split('-')
    try:
        _, avisos = typst.compile_with_warnings(ruta, output=out, root=RAIZ, font_paths=FUENTES,
                                                ignore_system_fonts=True,
                                                sys_inputs={'salida': salida, 'color': color})
    except typst.TypstError as e:
        sys.exit(f'{os.path.basename(ruta)}: {e.diagnostic or e.message}')
    for w in avisos or []:
        print(getattr(w, 'diagnostic', w), file=sys.stderr)
    return out


def todo():
    """Every chapter snippet and volume file, used from a throwaway document."""
    import glob
    partes = sorted(os.path.basename(f)[:-4] for f in glob.glob(os.path.join(AQUI, '*.typ'))
                    if os.path.basename(f) not in ('paratexto.typ', 'muestra-paratexto.typ'))
    with tempfile.TemporaryDirectory(dir=AQUI) as tmp:
        for p in partes:
            doc = os.path.join(tmp, 'x.typ')
            if p.startswith('tomo'):
                cuerpo = f'#import "../{p}.typ" as t\n#show: libro\n#t.soluciones\n#t.indice\n'
            elif p == 'grado':
                cuerpo = '#import "../grado.typ": correspondencia\n#show: libro\n#correspondencia\n'
            else:
                cuerpo = (f'#import "../{p}.typ" as c\n#show: libro\n#capitulo("1A3A5C")[Prueba]\n'
                          '#c.inicio\n#c.cierre\n')
            open(doc, 'w', encoding='utf-8').write('#import "../../plantilla/plantilla.typ": *\n'
                                                   '#import "../paratexto.typ": *\n' + cuerpo)
            compilar(doc, 'pantalla-intenso', os.path.join(tmp, 'x.pdf'))
            print('ok', p)


if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == 'todo':
        todo()
        sys.exit(0)
    archivo = args[0] if args and args[0].endswith('.typ') else 'muestra-paratexto.typ'
    variantes = [a for a in args if not a.endswith('.typ')] or ['pantalla-intenso']
    os.makedirs(os.path.join(AQUI, 'salida'), exist_ok=True)
    for v in variantes:
        out = os.path.join(AQUI, 'salida', f'{archivo[:-4]}-{v}.pdf')
        print(compilar(os.path.join(AQUI, archivo), v, out))
