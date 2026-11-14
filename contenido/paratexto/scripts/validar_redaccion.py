"""Check the drafted texts: every part present, 4-7 objectives, summary length, known codes and readings."""
import glob
import os
import sys

import yaml

from comun import REDACCION, partes_del_libro

MATERIAS = {'mat', 'fis', 'inf', 'exp', 'tc', 'elt', 'fe', 'ea', 'ed', 'ep', 'ie', 'sed', 'dse', 'te', 'ra',
            'aut', 'ii', 'com', 'mod', 'ss', 'rob', 'pry', 'tfg'}
COMPETENCIAS = {f'FB{i}' for i in range(1, 7)} | {f'CR{i}' for i in range(1, 13)} | {f'TE{i}' for i in range(1, 12)}


def cargar_redaccion():
    red = {}
    for f in sorted(glob.glob(os.path.join(REDACCION, 'tomo*.yaml'))):
        red.update(yaml.safe_load(open(f, encoding='utf-8')))
    return red


if __name__ == '__main__':
    red = cargar_redaccion()
    lect = yaml.safe_load(open(os.path.join(REDACCION, 'lecturas.yaml'), encoding='utf-8'))
    errores = 0
    for p, info, t in partes_del_libro():
        r = red.get(p)
        if not r:
            print('FALTA', p); errores += 1; continue
        n = len(r['objetivos'])
        w = len(r['resumen'].split())
        apendice = info['tipo'] == 'apendice'
        lo, hi = (60, 200) if apendice else (150, 250)
        if not 4 <= n <= 7:
            print(p, 'objetivos', n); errores += 1
        if not lo <= w <= hi:
            print(p, 'palabras', w); errores += 1
        for m in r['grado']['materias']:
            if m not in MATERIAS:
                print(p, 'materia?', m); errores += 1
        for c in r['grado']['competencias']:
            if c not in COMPETENCIAS:
                print(p, 'competencia?', c); errores += 1
        for l in r.get('lecturas', []):
            if l not in lect:
                print(p, 'lectura?', l); errores += 1
    print('partes', len(red), 'errores', errores)
    sys.exit(1 if errores else 0)
