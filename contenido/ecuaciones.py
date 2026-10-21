"""Equations to SVG with Typst, batched, cached by content hash.

Each equation becomes one auto-sized page of a batch document that uses the book's math font and sizes
(read from plantilla/libro.typ). The SVG is post-processed so that black becomes currentColor. For inline
math a zero-width red probe glyph marks the baseline; it is removed from the SVG after reading its position.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor

from figuras import compact_svg

RENDER_VERSION = '3'
BATCH = 150
NR = re.compile(r'#nr\("([^"]+)"\)')


def template_style(libro_typ):
    """Fonts and sizes of the book, from the template source."""
    src = open(libro_typ, encoding='utf-8').read()
    mathf = re.search(r'#let MATHF = (\(.*?\))', src).group(1)
    serif = re.search(r'#let SERIF = (\(.*?\))', src).group(1)
    text_size = re.search(r'set text\(font: SERIF, size: ([\d.]+pt)', src).group(1)
    math_size = re.search(r'show math\.equation: set text\(font: MATHF, size: ([\d.]+pt)\)', src).group(1)
    return {'mathf': mathf, 'serif': serif, 'text_size': text_size, 'math_size': math_size}


def remove_probe(svg):
    """Baseline (pt from the top) given by the red probe glyph, and the SVG without the probe.

    The probe sits in nested groups (the box, then the glyph run); the vertical offsets of its ancestors
    are added up. Typst only translates these groups, so the last matrix/translate term is the offset."""
    use = re.search(r'<use xlink:href="#([^"]+)"[^>]*fill="#ff0000"[^>]*/>', svg)
    if use is None:
        raise RuntimeError('no se encuentra la sonda de línea base')
    stack = []
    for m in re.finditer(r'<g(?: transform="([^"]*)")?>|</g>', svg[:use.start()]):
        if m.group(0) == '</g>':
            stack.pop()
            continue
        y = 0.0
        tr = m.group(1) or ''
        if t := re.match(r'translate\(([-\d.]+)(?:[ ,]+([-\d.]+))?\)', tr):
            y = float(t.group(2) or 0)
        elif t := re.match(r'matrix\(([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)\)', tr):
            y = float(t.group(6))
        elif tr:
            raise RuntimeError('transformación inesperada en la sonda: ' + tr)
        stack.append(y)
    baseline = sum(stack)
    svg = svg[:use.start()] + svg[use.end():]
    gid = re.escape(use.group(1))
    if svg.count('#' + use.group(1)) == 0:
        svg = re.sub(r'<symbol id="' + gid + r'"[^>]*>.*?</symbol>', '', svg, flags=re.S)
    # groups left empty by the removal
    while True:
        new = re.sub(r'<g(?: transform="[^"]*")?></g>', '', svg)
        if new == svg:
            break
        svg = new
    return baseline, svg


class Registro:
    def __init__(self, out_dir, cache_dir, style, font_path, nums):
        self.nums = nums            # label -> current number, for #nr inside equations
        self.out_dir = out_dir
        self.cache_dir = cache_dir
        self.style = style
        self.font_path = font_path
        self.wanted = {}            # hash -> (kind, src)
        self.meta_file = os.path.join(cache_dir, 'ec.json')
        try:
            self.meta = json.load(open(self.meta_file, encoding='utf-8'))
        except (OSError, ValueError):
            self.meta = {}
        self.failed = {}            # hash -> error message
        self.rendered = 0
        self.signature = json.dumps(style, sort_keys=True) + RENDER_VERSION

    def request(self, kind, src):
        # a reference inside an equation prints the current number: it is part of the identity
        keys = sorted(set(NR.findall(src)))
        shown = ''.join(f'\0{k}={self.nums.get(k, k)}' for k in keys)
        h = hashlib.sha1(f'{self.signature}\0{kind}\0{src}{shown}'.encode('utf-8')).hexdigest()[:20]
        self.wanted[h] = (kind, src)
        return h

    # ------------------------------------------------------------------ rendering
    def preamble(self, items):
        st = self.style
        keys = sorted({k for _, _, s in items for k in NR.findall(s)})
        nums = ', '.join(f'"{k}": "{self.nums.get(k, k)}"' for k in keys)
        return '\n'.join([
            f'#let NUMS = ({nums or ":"})',
            '#let nr(key) = NUMS.at(key)',
            '#set page(width: auto, height: auto, margin: 0.5pt, fill: none)',
            f'#set text(font: {st["serif"]}, size: {st["text_size"]}, lang: "es", region: "ES", fill: black,'
            ' top-edge: "bounds", bottom-edge: "bounds", hyphenate: false)',
            '#set par(justify: false)',
            f'#show math.equation: set text(font: {st["mathf"]}, size: {st["math_size"]})',
            '#let probe = box(width: 0pt, text(fill: rgb("#ff0000"))[.])',
            '',
        ])

    def page(self, kind, src):
        if kind == 'inline':
            return '#probe' + src
        if kind == 'texto':
            return '#align(center)[' + src + ']'
        return src

    def compile(self, items, workdir):
        """Compile [(hash, kind, src)] into SVG pages; returns {hash: svg text}."""
        doc = self.preamble(items) + '\n#pagebreak()\n'.join(self.page(k, s) for _, k, s in items) + '\n'
        path = os.path.join(workdir, 'doc.typ')
        open(path, 'w', encoding='utf-8').write(doc)
        res = subprocess.run(['typst', 'compile', '--root', workdir, '--font-path', self.font_path,
                              '--format', 'svg', path, os.path.join(workdir, 'out-{0p}.svg')],
                             capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(res.stderr.strip()[:600])
        files = sorted(f for f in os.listdir(workdir) if f.startswith('out-'))
        if len(files) != len(items):
            raise RuntimeError(f'{len(files)} páginas para {len(items)} fórmulas')
        return {h: open(os.path.join(workdir, f), encoding='utf-8').read() for (h, _, _), f in zip(items, files)}

    def render_batch(self, items):
        work = tempfile.mkdtemp(dir=self.cache_dir)
        try:
            try:
                svgs = self.compile(items, work)
            except RuntimeError:
                if len(items) == 1:
                    raise
                # isolate the failing equation(s)
                svgs = {}
                for it in items:
                    sub = tempfile.mkdtemp(dir=self.cache_dir)
                    try:
                        svgs.update(self.compile([it], sub))
                    except RuntimeError as e:
                        self.failed[it[0]] = str(e)
                    finally:
                        shutil.rmtree(sub, ignore_errors=True)
            out = {}
            for h, kind, _ in items:
                if h in svgs:
                    try:
                        out[h] = self.postprocess(svgs[h], kind)
                    except (RuntimeError, AttributeError) as e:
                        self.failed[h] = str(e)
            return out
        finally:
            shutil.rmtree(work, ignore_errors=True)

    def postprocess(self, svg, kind):
        w = float(re.search(r'<svg[^>]*\bwidth="([\d.]+)pt"', svg).group(1))
        h = float(re.search(r'<svg[^>]*\bheight="([\d.]+)pt"', svg).group(1))
        d = None
        if kind == 'inline':
            baseline, svg = remove_probe(svg)
            d = round(h - baseline, 3)
        svg = svg.replace('fill="#000000"', 'fill="currentColor"').replace('stroke="#000000"', 'stroke="currentColor"')
        # drop the xhtml namespace Typst declares but does not use
        svg = svg.replace(' xmlns:h5="http://www.w3.org/1999/xhtml"', '')
        svg = compact_svg(svg)
        return svg, {'w': round(w, 3), 'h': round(h, 3), 'd': d}

    def render(self, jobs=4):
        os.makedirs(self.out_dir, exist_ok=True)
        todo = [(h, k, s) for h, (k, s) in self.wanted.items()
                if not (h in self.meta and os.path.exists(os.path.join(self.out_dir, h + '.svg')))]
        batches = [todo[k:k + BATCH] for k in range(0, len(todo), BATCH)]
        with ThreadPoolExecutor(jobs) as ex:
            for res in ex.map(self.render_batch, batches):
                for h, (svg, meta) in res.items():
                    open(os.path.join(self.out_dir, h + '.svg'), 'w', encoding='utf-8').write(svg)
                    self.meta[h] = meta
                    self.rendered += 1
        # forget equations no longer in the book
        removed = 0
        for f in os.listdir(self.out_dir):
            if f.endswith('.svg') and f[:-4] not in self.wanted:
                os.remove(os.path.join(self.out_dir, f))
                removed += 1
        self.meta = {h: m for h, m in self.meta.items() if h in self.wanted}
        json.dump(self.meta, open(self.meta_file, 'w', encoding='utf-8'), indent=0, sort_keys=True)
        return {'total': len(self.wanted), 'renderizadas': self.rendered, 'borradas': removed,
                'fallidas': len(self.failed)}
