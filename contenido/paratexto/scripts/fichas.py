"""Compact per-part outline (intro, sections, first sentence, subsections, own summary) used to draft
objectives, summaries and the degree mapping. Output: datos/_fichas/tomo<N>.txt (working material)."""
import os
import re
import sys

from comun import DATOS, fragmentos, partes_del_libro

RESUMEN = re.compile(r'resumen|síntesis', re.I)


def primera_frase(t, n=28):
    f = re.split(r'(?<=[.:;])\s', t.strip(), maxsplit=1)[0]
    w = f.split()
    return ' '.join(w[:n]) + (' …' if len(w) > n else '')


def ficha(p, info):
    d, fr = fragmentos(p)
    out = [f"## {p} — {info['tipo']} {info.get('num') or ''}: {info['titulo']}"]
    intro = [x[3] for x in fr if x[0] is None and x[2] == 'p']
    if intro:
        out.append('INTRO: ' + ' '.join(' '.join(intro).split()[:90]))
    for s in info['secciones']:
        lab = s['label']
        cuerpo = [x for x in fr if x[0] == lab]
        h3 = [x[3] for x in cuerpo if x[2] == 'h3']
        ps = [x[3] for x in cuerpo if x[2] == 'p']
        linea = f"- {s['num'] or ''} {s['titulo']}"
        if RESUMEN.search(s['titulo']):
            txt = ' '.join(x[3] for x in cuerpo if x[2] in ('p', 'li'))
            out.append(linea + ' [RESUMEN PROPIO] ' + ' '.join(txt.split()[:260]))
            continue
        if ps:
            linea += ' :: ' + primera_frase(ps[0])
        if h3:
            linea += ' || ' + ' | '.join(h[:60] for h in h3[:9]) + (' | …' if len(h3) > 9 else '')
        out.append(linea)
    return '\n'.join(out)


if __name__ == '__main__':
    os.makedirs(os.path.join(DATOS, '_fichas'), exist_ok=True)
    por_tomo = {}
    for p, info, t in partes_del_libro():
        por_tomo.setdefault(t, []).append(ficha(p, info))
    for t, fs in por_tomo.items():
        with open(os.path.join(DATOS, '_fichas', f'tomo{t}.txt'), 'w', encoding='utf-8') as f:
            f.write('\n\n'.join(fs) + '\n')
        print(t, sum(len(x.split()) for x in fs))
