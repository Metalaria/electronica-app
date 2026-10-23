"""Drawing layers of a schematic page rebuilt from a KiCad PDF (see consolas.construir_pdf).

The primitives come from /home/claude/consolas/tools/pdf2kicadnet.py (`draw`: colour, stroke width in mm,
fill flag, points in 0.01 mm). KiCad plots its PDF with the same colours as its SVG export, so the roles of
consolas_svg apply; KiCad 9 adds #725600 for label text. Filled green circles (junctions) become circles.
"""

import consolas_svg as S

TEXTO = {'006464', 'A90000', '0F0F0F', '725600', '0000C2'}
ROLES = dict(S.ROLES)
ROLES['725600'] = 5


def capas(draw):
    layers = {}

    def layer(role, flags, width):
        k = (role, flags, round(width, 4))
        if k not in layers:
            layers[k] = S.Layer(role, flags, width)
        return layers[k]

    for c, w, fill, pts in draw:
        if not c or c in ('FFFFFF', 'F5F4EF') or len(pts) < 2:
            continue
        role = ROLES.get(c, 11)
        flags = (1 if fill else 0) | (2 if c in TEXTO else 0)
        q = [(int(x), int(y)) for x, y in pts]
        if fill and c == '009600':
            xs = [x for x, y in q]
            ys = [y for x, y in q]
            lay = layer(role, 1, 0)
            lay.circles.append(((min(xs) + max(xs)) // 2, (min(ys) + max(ys)) // 2, max(1, (max(xs) - min(xs)) // 2)))
            continue
        lay = layer(role, flags, 0 if fill else w)
        lay.polys.append(q)
    out = []
    for lay in layers.values():
        lay.polys = S._chain(lay.polys) if not (lay.flags & 1) else S._dedupe(lay.polys)
        lay.circles = sorted(set(lay.circles))
        if lay.polys or lay.circles:
            out.append(lay)
    out.sort(key=lambda l: (0 if l.flags & 1 else 1, l.role, l.flags, l.width))
    return out
