"""Keeps the figure data (web/public/libro/datos/NAME.json, «Datos de figuras» in ESQUEMA.md) on the book's current
drawings.

The data were exported by the book's figure scripts years ago (figuras/exportar_datos.py, which the 3.0.2 and 4.x
trees no longer carry), so the published files are their only copy. When the book redraws a figure (4.1: every
scripted figure again, with Inter and colours by role) its cropped canvas moves by a few points, and the overlay
(readouts on plots, current and voltages on schematics) would no longer sit on the drawing. For every data file whose
canvas differs from its SVG, this runs the figure's own script (Fuentes/figuras/src, found by its OUT line) in a
scratch copy of Fuentes/ (contenido/.cache/figuras-trabajo: the book is never written) with a stand-in
`exportar_datos` module that records what matplotlib really saved — the figure size, the PDF backend's tight box and
every Axes (insets included) with its position and limits — and then:

  - same figure size and the same Axes at the same place → only the crop moved: every `*_svg` value (fig_a_svg,
    pos_svg, dibujo_a_svg) is moved by the new crop, and the canvas takes the SVG's size;
  - anything else (a resized figure, an Axes moved or gone) → the file is removed and the figure becomes a plain
    `diagrama` (reported: its data would have to be exported again).

Idempotent (a file already on its drawing is not touched) and order-stable. Called by generar.py before
datos_figuras.aplicar(); on its own: python3 contenido/datos_figuras_recolocar.py
"""
import json
import os
import re
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import fuentes  # noqa: E402

VB = re.compile(r'<svg[^>]*\bviewBox="([^"]+)"')
TOL_PT = 0.06

# The stand-in module the figure scripts import (figuras/estilo2.py: `import exportar_datos`, then
# exportar_datos.exportar(f, path, tight, DPI) after saving).
GANCHO = r'''# Written by the app's contenido/datos_figuras_recolocar.py into a scratch copy of Fuentes/: records the saved
# area and every Axes of a figure (never changes the drawing).
import io
import json
import os


def exportar(f, path, tight, dpi):
    out = os.environ.get('EPA_GEOMETRIA')
    if not out:
        return
    w, h = f.get_size_inches()
    d = {'ancho_in': float(w), 'alto_in': float(h), 'tight': bool(tight)}
    if tight:
        # the box the PDF backend crops to: what matplotlib._tight_bbox.adjust_bbox receives during savefig
        import matplotlib._tight_bbox as tb
        visto = []
        viejo = tb.adjust_bbox

        def espia(fig, caja, *a, **k):
            visto.append(caja)
            return viejo(fig, caja, *a, **k)
        tb.adjust_bbox = espia
        try:
            f.savefig(io.BytesIO(), format='pdf', bbox_inches='tight', pad_inches=0.03)
        finally:
            tb.adjust_bbox = viejo
        b = visto[-1]
        d['bbox'] = [float(b.x0), float(b.y0), float(b.x1), float(b.y1)]
    todos = []

    def con_hijos(ax):
        todos.append(ax)
        for hijo in getattr(ax, 'child_axes', []):
            con_hijos(hijo)
    for ax in f.get_axes():
        con_hijos(ax)
    d['ejes'] = []
    for ax in todos:
        ax.apply_aspect()
        p = ax.get_position()
        d['ejes'].append({'pos': [float(p.x0), float(p.y0), float(p.x1), float(p.y1)],
                          'xlim': [float(v) for v in ax.get_xlim()], 'ylim': [float(v) for v in ax.get_ylim()]})
    with open(os.path.join(out, os.path.basename(path)[:-4] + '.json'), 'w') as fh:
        json.dump(d, fh)
'''


def viewbox(ruta):
    try:
        with open(ruta, encoding='utf-8') as f:
            m = VB.search(f.read(4096))
    except OSError:
        return None
    return [float(x) for x in m.group(1).replace(',', ' ').split()] if m else None


def r6(x):
    return float(f'{x:.6g}')


def igual(a, b, tol):
    return len(a) == len(b) and all(abs(x - y) <= tol * max(1.0, abs(x), abs(y)) for x, y in zip(a, b))


def guiones():
    """{figure name: script file} from the OUT = …/figuras/png/<name>.png lines of figuras/src/*.py."""
    src = os.path.join(fuentes.FIGURAS, 'src')
    out = {}
    if not os.path.isdir(src):
        return out
    for f in sorted(os.listdir(src)):
        if f.endswith('.py'):
            with open(os.path.join(src, f), encoding='utf-8') as fh:
                for m in re.finditer(r"figuras/png/([^'\"]+)\.png", fh.read()):
                    out.setdefault(m.group(1), f)
    return out


def copia_fuentes(trabajo):
    """A scratch Fuentes/ for the scripts (as the book's herramientas/regenerar_figuras.py makes it), with the hook."""
    fig = os.path.join(trabajo, 'figuras')
    for d in ('pdf', 'png'):
        os.makedirs(os.path.join(fig, d), exist_ok=True)
    for d in ('fonts', 'libro', 'herramientas'):
        if not os.path.lexists(os.path.join(trabajo, d)):
            os.symlink(os.path.join(fuentes.FUENTES, d), os.path.join(trabajo, d))
    if not os.path.lexists(os.path.join(fig, 'src')):
        os.symlink(os.path.join(fuentes.FIGURAS, 'src'), os.path.join(fig, 'src'))
    for f in ('estilo2.py', 'coma_fig.py', 'roles40.py', 'numeros.json'):
        if os.path.exists(os.path.join(fuentes.FIGURAS, f)):
            shutil.copy2(os.path.join(fuentes.FIGURAS, f), os.path.join(fig, f))
    with open(os.path.join(fig, 'exportar_datos.py'), 'w', encoding='utf-8') as fh:
        fh.write(GANCHO)


def geometrias(nombres, trabajo):
    """{name: geometry} of the figures, by running their scripts; {name: error} for those that could not be run."""
    g = guiones()
    falta = {n: 'sin guion en figuras/src' for n in nombres if n not in g}
    scripts = sorted({g[n] for n in nombres if n in g})
    if not scripts:
        return {}, falta
    copia_fuentes(trabajo)
    salida = os.path.join(trabajo, 'geometria')
    if os.path.isdir(salida):
        shutil.rmtree(salida)
    os.makedirs(salida)
    env = dict(os.environ, EPA_FUENTES=trabajo, MPLBACKEND='Agg', SOURCE_DATE_EPOCH='0', PYTHONHASHSEED='0',
               EPA_GEOMETRIA=salida)
    errores = {}

    def correr(s):
        r = subprocess.run(['nice', sys.executable, os.path.join(trabajo, 'figuras', 'src', s)], env=env,
                           capture_output=True, text=True, timeout=900)
        return s, '' if r.returncode == 0 else (r.stderr.strip().split('\n') or ['?'])[-1]
    with ThreadPoolExecutor(2) as ex:
        for s, e in ex.map(correr, scripts):
            if e:
                errores[s] = e
    geo = {}
    for n in nombres:
        p = os.path.join(salida, n + '.json')
        if os.path.exists(p):
            with open(p, encoding='utf-8') as fh:
                geo[n] = json.load(fh)
        elif n not in falta:
            falta[n] = errores.get(g[n], 'el guion no ha guardado la figura')
    return geo, falta


def trasladar(d, g, vista):
    """The data `d` moved onto the drawing described by `g` (geometry) and `vista` (its viewBox): the new data, or the
    reason why it cannot be moved."""
    lz = d['lienzo']
    t = lz['svg']['fig_a_svg']
    W, H = vista[2], vista[3]
    if abs(lz['ancho_in'] - g['ancho_in']) > 1e-4 or abs(lz['alto_in'] - g['alto_in']) > 1e-4:
        return None, f'tamaño {lz["ancho_in"]}×{lz["alto_in"]} → {g["ancho_in"]:.4f}×{g["alto_in"]:.4f} in'
    if (lz.get('recorte') == 'tight') != g['tight']:
        return None, 'recorte distinto'
    if g['tight']:
        x0, y0, x1, y1 = g['bbox']
        Wg, Hg, tx, ty = (x1 - x0) * 72, (y1 - y0) * 72, -x0 * 72, y1 * 72
    else:
        Wg, Hg, tx, ty = g['ancho_in'] * 72, g['alto_in'] * 72, 0.0, g['alto_in'] * 72
    if abs(Wg - W) > TOL_PT or abs(Hg - H) > TOL_PT:
        return None, f'lienzo calculado {Wg:.2f}×{Hg:.2f}, SVG {W}×{H}'
    libres = list(g['ejes'])
    for e in d.get('ejes', []):
        lim = (e['x']['lim'] + e['y']['lim']) if 'x' in e and 'y' in e else None
        cand = [a for a in libres if igual(a['pos'], e['pos_fig'], 1e-4)
                and (lim is None or None in lim or igual(a['xlim'] + a['ylim'], lim, 1e-5))]
        if not cand:
            return None, f'ejes {e["id"]} movidos o distintos'
        libres.remove(cand[0])
    dx, dy = tx - t['tx'], ty - t['ty']
    n = json.loads(json.dumps(d))
    n['lienzo']['svg'].update(ancho=r6(W), alto=r6(H))
    n['lienzo']['svg']['fig_a_svg'].update(tx=r6(tx), ty=r6(ty))
    for e in n.get('ejes', []):
        e['pos_svg'] = [r6(e['pos_svg'][0] + dx), r6(e['pos_svg'][1] + dy)] + e['pos_svg'][2:]
    for q in n.get('esquemas', []):
        q['dibujo_a_svg'].update(tx=r6(q['dibujo_a_svg']['tx'] + dx), ty=r6(q['dibujo_a_svg']['ty'] + dy))
    return n, None


def main(out=None):
    """Moves every data file of `out` (web/public/libro) that is off its drawing; returns [(name, problem)]."""
    out = out or os.path.join(APP, 'web', 'public', 'libro')
    carpeta = os.path.join(out, 'datos')
    if not os.path.isdir(carpeta):
        return []
    fuera = {}
    for f in sorted(os.listdir(carpeta)):
        if not f.endswith('.json'):
            continue
        n = f[:-5]
        with open(os.path.join(carpeta, f), encoding='utf-8') as fh:
            d = json.load(fh)
        vista = viewbox(os.path.join(out, 'fig', n + '.svg'))
        sv = d.get('lienzo', {}).get('svg', {})
        if vista and (abs(sv.get('ancho', -1) - vista[2]) > 0.05 or abs(sv.get('alto', -1) - vista[3]) > 0.05):
            fuera[n] = (d, vista)
    if not fuera:
        return []
    geo, falta = geometrias(sorted(fuera), os.path.join(HERE, '.cache', 'figuras-trabajo'))
    problemas = []
    movidos = 0
    for n in sorted(fuera):
        d, vista = fuera[n]
        nuevo, motivo = (trasladar(d, geo[n], vista) if n in geo else (None, falta.get(n, '?')))
        ruta = os.path.join(carpeta, n + '.json')
        if nuevo is None:
            os.remove(ruta)
            problemas.append((n, motivo))
            continue
        with open(ruta, 'w', encoding='utf-8') as fh:
            json.dump(nuevo, fh, ensure_ascii=False, separators=(',', ':'))
        movidos += 1
    print(f'datos de figuras: {movidos} llevados al dibujo actual, {len(problemas)} retirados'
          + ''.join(f'\n  {n}: {m}' for n, m in problemas))
    return problemas


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else None)
