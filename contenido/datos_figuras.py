"""Figure data for the interactive layer: figuras/datos/NAME.json -> web/public/libro/datos/NAME.json.

Called from generar.py after the figures are converted. For every `figura` block it sets
`tipo_figura` (grafica | esquema | diagrama | foto), `svg_vista` (the viewBox of the SVG, in PDF points, the
coordinate space of every *_svg value in the data files) and, for plots and schematics, `datos`
("datos/NAME.json"). The data files are written by the book's figure scripts (figuras/exportar_datos.py)
and copied here without the PNG-only mappings. The contract is ESQUEMA.md, section «Datos de figuras».
validar() checks the copied files against the SVGs and the internal references of each file.
"""
import json
import math
import os
import re

TIPOS = ('grafica', 'esquema', 'diagrama', 'foto')
VIEWBOX = re.compile(r'<svg[^>]*\bviewBox="([^"]+)"')


def _walk(bloques):
    for b in bloques:
        if b.get('t') == 'figura':
            yield b
        for key in ('bloques', 'solucion'):
            if isinstance(b.get(key), list):
                yield from _walk(b[key])
        for it in b.get('items', []) if isinstance(b.get('items'), list) else []:
            if isinstance(it, dict):
                yield from _walk(it.get('bloques') or [])
                yield from _walk(it.get('solucion') or [])


def _viewbox(path):
    try:
        with open(path, encoding='utf-8') as fh:
            head = fh.read(4096)
    except OSError:
        return None
    m = VIEWBOX.search(head)
    if not m:
        return None
    return [float(x) for x in m.group(1).replace(',', ' ').split()]


def _tam_imagen(path):
    """(width, height) in pixels of a JPEG or PNG, from its header (no imaging library), or None."""
    try:
        with open(path, 'rb') as fh:
            data = fh.read(1 << 20)
    except OSError:
        return None
    if data[:8] == b'\x89PNG\r\n\x1a\n' and data[12:16] == b'IHDR':
        return int.from_bytes(data[16:20], 'big'), int.from_bytes(data[20:24], 'big')
    if data[:2] != b'\xff\xd8':
        return None
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marca = data[i + 1]
        if marca in (0xD8, 0x01) or 0xD0 <= marca <= 0xD7:
            i += 2
            continue
        largo = int.from_bytes(data[i + 2:i + 4], 'big')
        # start of frame (baseline, progressive…): height then width
        if marca in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            return int.from_bytes(data[i + 7:i + 9], 'big'), int.from_bytes(data[i + 5:i + 7], 'big')
        i += 2 + largo
    return None


def tamanos_fotos(out, partes_bloques):
    """`img_tam` [width, height] of every photo figure (img/*.jpg): the app gives the <img> its size before it
    loads, so nothing below it moves when it arrives (0.11 QA)."""
    for bloques in partes_bloques:
        for b in _walk(bloques):
            src = b.get('src', '')
            if src and not src.startswith('fig/'):
                t = _tam_imagen(os.path.join(out, src))
                if t:
                    b['img_tam'] = [t[0], t[1]]


def _strip_png(d):
    """The app only needs SVG coordinates: drop the PNG mappings used to check the export."""
    d.get('lienzo', {}).pop('png', None)
    for q in d.get('esquemas', []):
        q.pop('dibujo_a_png', None)
    return d


def aplicar(v3, out, partes_bloques, problems):
    """Annotate the figure blocks of every part and copy their data files. Returns counts."""
    src_dir = os.path.join(v3, 'figuras', 'datos')
    dst_dir = os.path.join(out, 'datos')
    os.makedirs(dst_dir, exist_ok=True)
    if not os.path.isdir(src_dir):
        # 3.0.2 and 4.x carry no figuras/datos: the published files are the only copy of the data, kept on the
        # current drawings by datos_figuras_recolocar.py (run before this), and read here in place
        src_dir = dst_dir
    stats = {'grafica': 0, 'esquema': 0, 'diagrama': 0, 'foto': 0, 'con_datos': 0, 'sin_json': 0}
    wanted = set()
    for bloques in partes_bloques:
        for b in _walk(bloques):
            src = b.get('src', '')
            if not src.startswith('fig/'):
                b['tipo_figura'] = 'foto'
                stats['foto'] += 1
                t = _tam_imagen(os.path.join(out, src))
                if t:
                    b['img_tam'] = [t[0], t[1]]
                continue
            name = src[4:-4]
            vb = _viewbox(os.path.join(out, src))
            if vb:
                b['svg_vista'] = [round(v, 3) for v in vb]
            path = os.path.join(src_dir, name + '.json')
            if not os.path.exists(path):
                b['tipo_figura'] = 'diagrama'
                stats['diagrama'] += 1
                stats['sin_json'] += 1
                continue
            try:
                d = json.load(open(path, encoding='utf-8'))
            except (OSError, ValueError) as e:
                problems.append(('', 0, f'datos de figura ilegibles {name}.json: {e}', ''))
                b['tipo_figura'] = 'diagrama'
                stats['diagrama'] += 1
                continue
            tipo = d.get('tipo') if d.get('tipo') in TIPOS else 'diagrama'
            b['tipo_figura'] = tipo
            stats[tipo] += 1
            if tipo not in ('grafica', 'esquema'):
                continue
            rel = f'datos/{name}.json'
            b['datos'] = rel
            stats['con_datos'] += 1
            if rel not in wanted:
                wanted.add(rel)
                with open(os.path.join(out, rel), 'w', encoding='utf-8') as fh:
                    json.dump(_strip_png(d), fh, ensure_ascii=False, separators=(',', ':'))
    removed = 0
    for f in os.listdir(dst_dir):
        if f'datos/{f}' not in wanted:
            os.remove(os.path.join(dst_dir, f))
            removed += 1
    stats['ficheros'] = len(wanted)
    stats['borrados'] = removed
    return stats


# ------------------------------------------------------------------ validation
def _finite(v):
    return isinstance(v, (int, float)) and math.isfinite(v)


def _check_file(d, name, vb, err):
    sv = d.get('lienzo', {}).get('svg', {})
    if vb and (abs(sv.get('ancho', -1) - vb[2]) > 0.05 or abs(sv.get('alto', -1) - vb[3]) > 0.05):
        err(f'{name}: lienzo.svg {sv.get("ancho")}×{sv.get("alto")} no coincide con el viewBox {vb[2]}×{vb[3]} '
            f'(SVG y datos de versiones distintas)')
    W, H = (vb[2], vb[3]) if vb else (sv.get('ancho', 0), sv.get('alto', 0))
    for e in d.get('ejes', []):
        x, y, w, h = e['pos_svg']
        if x < -2 or y < -2 or x + w > W + 2 or y + h > H + 2:
            if e['clase'] in ('datos', 'esquema'):
                err(f'{name}: ejes {e["id"]} ({e["clase"]}) fuera del SVG: {e["pos_svg"]} en {W}×{H}')
        if e['clase'] not in ('datos', 'cualitativa'):
            continue
        for k in ('x', 'y'):
            lim = e[k]['lim']
            if not (_finite(lim[0]) and _finite(lim[1])) or lim[0] == lim[1]:
                err(f'{name}: ejes {e["id"]} límites {k} no válidos {lim}')
        for s in e['series']:
            if isinstance(s.get('x'), list) and isinstance(s.get('y'), list) and len(s['x']) != len(s['y']):
                err(f'{name}: serie {s["tipo"]} con x e y de distinta longitud')
            if isinstance(s.get('x'), list) and len(s['x']) > 2600:
                err(f'{name}: serie {s["tipo"]} con {len(s["x"])} puntos (máximo ~2000)')
    for k, q in enumerate(d.get('esquemas', [])):
        nodes = {n['id'] for n in q['nodos']}
        pts = {p['id']: p for p in q['puntos']}
        for el in q['elementos']:
            for t, n in el.get('terminales', {}).items():
                if n not in nodes:
                    err(f'{name}#{k}: {el["id"]}.{t} en un nodo inexistente {n}')
                if el.get('puntos_terminal', {}).get(t) not in pts:
                    err(f'{name}#{k}: {el["id"]}.{t} sin punto')
        for t in q['tramos']:
            if t['de'] not in pts or t['a'] not in pts or t['nodo'] not in nodes:
                err(f'{name}#{k}: tramo {t["id"]} con referencias rotas')
        s = q.get('simulacion', {})
        if s.get('simulable'):
            op = s.get('op', {})
            if set(op.get('nodos', {})) != nodes:
                err(f'{name}#{k}: simulable pero op.nodos no cubre los nodos')
            if set(op.get('tramos', {})) != {t['id'] for t in q['tramos']}:
                err(f'{name}#{k}: simulable pero op.tramos no cubre los tramos')


def validar(out):
    """Checks of web/public/libro/datos against the parts and the SVGs; prints a summary. True when correct."""
    errors = []
    err = errors.append
    refs = {}
    tipos = {}
    sin_vista = 0
    pdir = os.path.join(out, 'partes')
    for f in sorted(os.listdir(pdir)):
        part = json.load(open(os.path.join(pdir, f), encoding='utf-8'))
        for b in _walk(part['bloques']):
            t = b.get('tipo_figura')
            tipos[t] = tipos.get(t, 0) + 1
            if t not in TIPOS:
                err(f'{f}: figura {b.get("num")} sin tipo_figura válido ({t})')
            if b['src'].startswith('fig/') and not b.get('svg_vista'):
                sin_vista += 1
            if b.get('datos'):
                refs[b['datos']] = b
                if t not in ('grafica', 'esquema'):
                    err(f'{f}: figura {b.get("num")} con datos y tipo {t}')
    files = {f'datos/{f}' for f in os.listdir(os.path.join(out, 'datos'))} if os.path.isdir(
        os.path.join(out, 'datos')) else set()
    for rel in sorted(set(refs) - files):
        err(f'falta {rel}')
    for rel in sorted(files - set(refs)):
        err(f'{rel} no lo usa ninguna figura')
    simulables = esquemas = ejes_datos = 0
    for rel in sorted(set(refs) & files):
        b = refs[rel]
        try:
            d = json.load(open(os.path.join(out, rel), encoding='utf-8'))
        except ValueError as e:
            err(f'{rel}: JSON inválido ({e})')
            continue
        if d.get('version') != 1:
            err(f'{rel}: versión {d.get("version")} desconocida')
        if d.get('tipo') != b.get('tipo_figura'):
            err(f'{rel}: tipo {d.get("tipo")} distinto del bloque ({b.get("tipo_figura")})')
        _check_file(d, rel, b.get('svg_vista'), err)
        for q in d.get('esquemas', []):
            esquemas += 1
            simulables += bool(q.get('simulacion', {}).get('simulable'))
        ejes_datos += sum(1 for e in d.get('ejes', []) if e['clase'] == 'datos')
    if sin_vista:
        err(f'{sin_vista} figuras SVG sin svg_vista')
    print('\n== Datos de figuras (web/public/libro/datos)')
    print('  bloques figura por tipo: ' + ', '.join(f'{k} {v}' for k, v in sorted(tipos.items(), key=str)))
    size = sum(os.path.getsize(os.path.join(out, r)) for r in files)
    print(f'  {len(files)} ficheros ({size / 1e6:.1f} MB): {ejes_datos} ejes con datos, {esquemas} esquemas, '
          f'{simulables} simulables')
    for e in errors[:40]:
        print('  ERROR: ' + e)
    if len(errors) > 40:
        print(f'  … y {len(errors) - 40} más')
    if not errors:
        print('  correctos: ficheros, tipos, viewBox y referencias internas')
    return not errors
