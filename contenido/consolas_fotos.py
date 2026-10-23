"""Board photos and photo traces of the «Consolas» views.

Photos of the newer machines are not in the book: they come from the research folder (licensed photos copied
there from the owner's downloads, see consolas_datos.FUENTES) and are written resized and recompressed as
web/public/consolas/<maquina>/foto-<id>.jpg. Hotspot boxes are given in the pixels of that output image.

Traces: Gekkio's DMG-CPU-06 trace drawing is an Inkscape SVG in the pixel grid of the ArcadeTV scan, one
filled path (or group of paths) per net, labelled with the net name. `trazas()` turns it into
{net name: [path data]} in the coordinates of the resized scan (absolute M/L/C/A/Z, 0.1 px), so the photo
view can light up the copper of a net.
"""

import json
import math
import os
import re
import xml.etree.ElementTree as ET

from PIL import Image

NS = {'svg': 'http://www.w3.org/2000/svg', 'inkscape': 'http://www.inkscape.org/namespaces/inkscape'}
LABEL = '{http://www.inkscape.org/namespaces/inkscape}label'


def foto(origen, destino, ancho, calidad=80):
    """Resize (never enlarge) and recompress a photo; returns (width, height) of the written file."""
    im = Image.open(origen)
    im.load()
    im = im.convert('RGB')
    if im.width > ancho:
        alto = round(im.height * ancho / im.width)
        im = im.resize((ancho, alto), Image.LANCZOS)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    im.save(destino, 'JPEG', quality=calidad, optimize=True, progressive=True)
    return im.width, im.height


# ------------------------------------------------------------------ SVG path data

_TOK = re.compile(r'[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?')
_ARGS = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'C': 6, 'S': 4, 'Q': 4, 'T': 2, 'A': 7, 'Z': 0}


def normalizar_path(d, k, tx, ty):
    """Path data -> absolute M/L/C/A/Z with p' = k·(p + t), numbers rounded to 0.1."""
    toks = _TOK.findall(d)
    out = []
    i = 0
    cmd = None
    x = y = 0.0
    sx = sy = 0.0

    def P(px, py):
        return '%s %s' % (_r(k * (px + tx)), _r(k * (py + ty)))

    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t
            i += 1
            if cmd in 'Zz':
                out.append('Z')
                x, y = sx, sy
                continue
        if cmd is None:
            raise ValueError('path sin orden inicial')
        up = cmd.upper()
        rel = cmd.islower()
        n = _ARGS[up]
        a = [float(v) for v in toks[i:i + n]]
        i += n
        if up == 'M':
            if rel:
                a[0] += x
                a[1] += y
            x, y = a
            sx, sy = x, y
            out.append('M' + P(x, y))
            cmd = 'l' if rel else 'L'
        elif up == 'L':
            if rel:
                a[0] += x
                a[1] += y
            x, y = a
            out.append('L' + P(x, y))
        elif up == 'H':
            x = a[0] + (x if rel else 0)
            out.append('L' + P(x, y))
        elif up == 'V':
            y = a[0] + (y if rel else 0)
            out.append('L' + P(x, y))
        elif up == 'C':
            if rel:
                for j in range(0, 6, 2):
                    a[j] += x
                    a[j + 1] += y
            out.append('C' + ' '.join(P(a[j], a[j + 1]) for j in range(0, 6, 2)))
            x, y = a[4], a[5]
        elif up == 'A':
            ex, ey = a[5], a[6]
            if rel:
                ex += x
                ey += y
            out.append('A%s %s %s %d %d %s' % (_r(k * a[0]), _r(k * a[1]), _r(a[2]), int(a[3]), int(a[4]), P(ex, ey)))
            x, y = ex, ey
        else:
            raise ValueError('orden de path no prevista: %s' % cmd)
    return ''.join(out)


def _r(v):
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def _translate(el):
    t = el.get('transform')
    if not t:
        return 0.0, 0.0
    m = re.fullmatch(r'\s*translate\(\s*([-+\d.eE]+)[ ,]+([-+\d.eE]+)\s*\)\s*', t)
    if not m:
        raise ValueError('transformación no prevista: %s' % t)
    return float(m.group(1)), float(m.group(2))


def trazas(svg_file, k, mapa):
    """{net name: [path data]} of the labelled paths/groups of an Inkscape trace drawing.

    `mapa` maps Inkscape labels to netlist net names; labels not in it are ignored (layer groups) and
    reported back so the caller can check the coverage."""
    root = ET.parse(svg_file).getroot()
    out = {}
    vistos = set()

    def paths_de(el, tx, ty):
        res = []
        dx, dy = _translate(el)
        tx, ty = tx + dx, ty + dy
        tag = el.tag.split('}')[-1]
        if tag == 'path':
            res.append(normalizar_path(el.get('d', ''), k, tx, ty))
        for c in el:
            res += paths_de(c, tx, ty)
        return res

    def walk(el, tx, ty):
        dx, dy = _translate(el)
        tx, ty = tx + dx, ty + dy
        for c in el:
            lab = c.get(LABEL)
            if lab is not None and lab in mapa:
                vistos.add(lab)
                ds = paths_de(c, tx, ty)
                if ds:
                    out.setdefault(mapa[lab], []).extend(ds)
            else:
                walk(c, tx, ty)

    walk(root, 0.0, 0.0)
    faltan = sorted(set(mapa) - vistos)
    return out, faltan


def etiquetas_svg(svg_file):
    root = ET.parse(svg_file).getroot()
    return [el.get(LABEL) for el in root.iter() if el.get(LABEL)]


def escribir_json(ruta, datos):
    texto = json.dumps(datos, ensure_ascii=False, separators=(',', ':'))
    with open(ruta, 'w', encoding='utf-8') as f:
        f.write(texto)
    return len(texto.encode('utf-8'))


def caja_valida(c, ancho, alto):
    x0, y0, x1, y1 = c
    return 0 <= x0 < x1 <= ancho and 0 <= y0 < y1 <= alto and not any(math.isnan(v) for v in c)
