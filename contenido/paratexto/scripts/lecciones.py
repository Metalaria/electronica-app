"""Collect the summary ideas of the 1.1 lessons (chapters 0-6) as the base of the drafted summaries."""
import glob
import os
import re

import yaml

from comun import DATOS, LECCIONES, guardar

def num(path):
    m = re.search(r'sec-(\d+)\.(\d+)', path)
    return (int(m.group(1)), int(m.group(2))) if m else (999, 999)

for cap in sorted(glob.glob(os.path.join(LECCIONES, 'cap0[0-6]'))):
    parte = os.path.basename(cap)
    out = []
    for f in sorted(glob.glob(os.path.join(cap, '*.yaml')), key=num):
        d = yaml.safe_load(open(f, encoding='utf-8'))
        ideas = []
        for t in d.get('tarjetas', []) if isinstance(d, dict) else []:
            if t.get('tipo') == 'resumen':
                ideas += [(i.get('titulo', '') + ' ' + i.get('texto', '')).strip() for i in t.get('ideas', [])]
        out.append({'seccion': os.path.basename(f)[:-5], 'titulo': d.get('titulo'), 'ideas': ideas})
    guardar(os.path.join(DATOS, '_lecciones', parte + '.json'), out)
    print(parte, len(out), sum(len(x['ideas']) for x in out))
