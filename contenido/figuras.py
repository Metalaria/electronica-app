"""Figures: vector PDFs to SVG (pdftocairo, glyphs become paths) and photos resized for the app."""
import json
import os
import re
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageOps

FIG_VERSION = '3'
MAX_PX = 1600
JPEG_QUALITY = 85
NUM = re.compile(r'(-?\d+\.\d{3,})')
RGB_PCT = re.compile(r'rgb\(([\d.]+)%, ([\d.]+)%, ([\d.]+)%\)')


PATH_D = re.compile(r'(<path[^>]*?\bd=")([^"]*)(")')
PATH_TOKEN = re.compile(r'[MLHVCZmlhvcz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?')
ARGS = {'m': 2, 'l': 2, 'h': 1, 'v': 1, 'c': 6, 'z': 0}


def fmt(v):
    """A coordinate in hundredths of a point as the shortest decimal string ('-.5', '12', '3.07')."""
    neg = v < 0
    v = abs(v)
    whole, frac = divmod(v, 100)
    s = str(whole) if whole else ''
    if frac:
        s += ('.%02d' % frac).rstrip('0')
    if not s:
        s = '0'
    return '-' + s if neg else s


def join_numbers(nums, prev=''):
    out = []
    for s in nums:
        last = out[-1] if out else prev
        if last and not (s.startswith('-') or (s.startswith('.') and '.' in last.split(' ')[-1])):
            out.append(' ')
        out.append(s)
    return ''.join(out)


def compact_path(d):
    """Path data (M L H V C Z, absolute or relative) to relative commands with 1/100 pt precision.

    Every point is first made absolute and rounded once; the relative steps written are differences of
    rounded values, so no error accumulates along the path. Returns None for anything unexpected
    (arcs, quadratic curves), and the caller keeps the original data."""
    toks = PATH_TOKEN.findall(d)
    if not toks or not toks[0].isalpha():
        return None
    segs = []                       # (letter, [absolute float coordinates])
    x = y = sx = sy = 0.0
    i, n = 0, len(toks)
    while i < n:
        c = toks[i]
        if not c.isalpha():
            return None
        i += 1
        lc = c.lower()
        if lc not in ARGS:
            return None
        rel = c.islower()
        if lc == 'z':
            segs.append(('z', []))
            x, y = sx, sy
            continue
        nums = []
        while i < n and not toks[i].isalpha():
            nums.append(float(toks[i]))
            i += 1
        k = ARGS[lc]
        if not nums or len(nums) % k:
            return None
        for j in range(0, len(nums), k):
            v = nums[j:j + k]
            letter = lc if (lc != 'm' or j == 0) else 'l'      # extra pairs after a moveto are linetos
            if letter == 'h':
                pts = [v[0] + x if rel else v[0], y]
            elif letter == 'v':
                pts = [x, v[0] + y if rel else v[0]]
            else:
                pts = [v[q] + (x if q % 2 == 0 else y) if rel else v[q] for q in range(k)]
            if letter in 'hv':
                letter = 'l'
            x, y = pts[-2], pts[-1]
            if letter == 'm':
                sx, sy = x, y
            segs.append((letter, pts))
    out = []
    cx = cy = 0                     # current point of the rounded path, hundredths of a point
    ssx = ssy = 0
    prev = None
    for k, (letter, pts) in enumerate(segs):
        if letter == 'z':
            out.append('z')
            cx, cy = ssx, ssy
            prev = 'z'
            continue
        if letter == 'm' and (k + 1 == len(segs) or segs[k + 1][0] == 'm'):
            continue                # a moveto with nothing drawn from it
        r = [round(p * 100) for p in pts]
        rel = [r[q] - (cx if q % 2 == 0 else cy) for q in range(len(r))]
        if letter == 'l' and rel[0] == 0:
            letter, rel = 'v', rel[1:]
        elif letter == 'l' and rel[1] == 0:
            letter, rel = 'h', rel[:1]
        if letter == prev and letter != 'm':
            out.append(join_numbers([fmt(v) for v in rel], out[-1]))
        else:
            out.append(letter + join_numbers([fmt(v) for v in rel]))
        prev = letter
        cx, cy = r[-2], r[-1]
        if letter == 'm':
            ssx, ssy = cx, cy
    return ''.join(out)


def compact_svg(svg):
    """Smaller SVG: path data relative with two decimals (1/100 pt, far below what a screen shows even
    zoomed in), other numbers rounded, whitespace between tags removed."""
    def path(m):
        c = compact_path(m.group(2))
        return m.group(1) + (c if c is not None else m.group(2)) + m.group(3)
    svg = PATH_D.sub(path, svg)
    # attributes that only restate SVG defaults
    for a in (' fill-opacity="1"', ' stroke-opacity="1"', ' stroke-linecap="butt"', ' stroke-linejoin="miter"',
              ' fill-rule="nonzero"'):
        svg = svg.replace(a, '')
    svg = RGB_PCT.sub(lambda m: '#%02x%02x%02x' % tuple(round(float(m.group(k)) * 2.55) for k in (1, 2, 3)), svg)

    def rnd(m):
        v = f'{float(m.group(1)):.2f}'.rstrip('0').rstrip('.')
        return '0' if v == '-0' else v
    svg = NUM.sub(rnd, svg)
    svg = re.sub(r'>\s+<', '><', svg)
    return svg


class Registro:
    def __init__(self, v3, out_dir, cache_dir):
        self.pdf_dir = os.path.join(v3, 'figuras/pdf')
        self.img_dir = os.path.join(v3, 'img')
        self.out_dir = out_dir
        self.cache_file = os.path.join(cache_dir, 'fig.json')
        self.cache_dir = cache_dir
        try:
            self.cache = json.load(open(self.cache_file, encoding='utf-8'))
        except (OSError, ValueError):
            self.cache = {}
        self.wanted = {}            # output relative path -> source path
        self.failed = {}
        self.converted = 0

    def request(self, fname):
        if fname.endswith('.pdf'):
            rel = 'fig/' + fname[:-4] + '.svg'
            src = os.path.join(self.pdf_dir, fname)
        else:
            rel = 'img/' + fname
            src = os.path.join(self.img_dir, fname)
        self.wanted[rel] = src
        return rel

    def stamp(self, src):
        st = os.stat(src)
        return f'{FIG_VERSION}:{st.st_size}:{int(st.st_mtime)}'

    def convert(self, rel, src):
        out = os.path.join(self.out_dir, rel)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        if not os.path.exists(src):
            raise RuntimeError('no existe ' + src)
        if rel.endswith('.svg'):
            with tempfile.TemporaryDirectory(dir=self.cache_dir) as tmp:
                tmp_svg = os.path.join(tmp, 'f.svg')
                res = subprocess.run(['pdftocairo', '-svg', src, tmp_svg], capture_output=True, text=True)
                if res.returncode != 0:
                    raise RuntimeError(res.stderr.strip()[:300])
                svg = open(tmp_svg, encoding='utf-8').read()
            open(out, 'w', encoding='utf-8').write(compact_svg(svg))
            return
        im = Image.open(src)
        im = ImageOps.exif_transpose(im)
        if max(im.size) > MAX_PX:
            im.thumbnail((MAX_PX, MAX_PX), Image.LANCZOS)
        if rel.lower().endswith(('.jpg', '.jpeg')):
            if im.mode not in ('RGB', 'L'):
                im = im.convert('RGB')
            im.save(out, 'JPEG', quality=JPEG_QUALITY, optimize=True, progressive=True)
        else:
            im.save(out, 'PNG', optimize=True)

    def job(self, item):
        rel, src = item
        try:
            self.convert(rel, src)
            return rel, self.stamp(src), None
        except Exception as e:      # reported, never silently dropped
            return rel, None, str(e)

    def process(self, jobs=8):
        todo = []
        for rel, src in self.wanted.items():
            out = os.path.join(self.out_dir, rel)
            if os.path.exists(out) and os.path.exists(src) and self.cache.get(rel) == self.stamp(src):
                continue
            todo.append((rel, src))
        with ThreadPoolExecutor(jobs) as ex:
            for rel, stamp, err in ex.map(self.job, todo):
                if err:
                    self.failed[rel] = err
                    self.cache.pop(rel, None)
                else:
                    self.cache[rel] = stamp
                    self.converted += 1
        # remove outputs of figures that left the book
        removed = 0
        for sub in ('fig', 'img'):
            d = os.path.join(self.out_dir, sub)
            if not os.path.isdir(d):
                continue
            for f in os.listdir(d):
                if f'{sub}/{f}' not in self.wanted:
                    os.remove(os.path.join(d, f))
                    removed += 1
        self.cache = {k: v for k, v in self.cache.items() if k in self.wanted}
        json.dump(self.cache, open(self.cache_file, 'w', encoding='utf-8'), indent=0, sort_keys=True)
        return {'total': len(self.wanted), 'convertidas': self.converted, 'borradas': removed,
                'fallidas': len(self.failed)}


def compare_all(items, out_dir, dpi=50):
    """Mean absolute difference (0-255) between each PDF rendered by poppler and its SVG rendered by Chromium
    (headless, through Playwright), at the same pixel size. Returns {rel: difference or error text}."""
    import io
    import numpy as np
    from playwright.sync_api import sync_playwright
    res = {}
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        for rel, src in items:
            try:
                subprocess.run(['pdftoppm', '-r', str(dpi), '-png', '-singlefile', src, os.path.join(tmp, 'p')],
                               check=True)
                a = Image.open(os.path.join(tmp, 'p.png')).convert('L')
                w, h = a.size
                html = os.path.join(tmp, 'v.html')
                open(html, 'w', encoding='utf-8').write(
                    f'<body style="margin:0;background:#fff"><img id="f" src="file://{os.path.join(out_dir, rel)}" '
                    f'style="display:block;width:{w}px;height:{h}px"></body>')
                page.set_viewport_size({'width': w + 20, 'height': h + 20})
                page.goto('file://' + html)
                page.wait_for_function('document.getElementById("f").complete')
                b = Image.open(io.BytesIO(page.locator('#f').screenshot())).convert('L').resize((w, h))
                res[rel] = float(np.abs(np.asarray(a, dtype=np.int16) - np.asarray(b, dtype=np.int16)).mean())
            except Exception as e:       # reported by the caller
                res[rel] = f'error: {e}'
        browser.close()
    return res
