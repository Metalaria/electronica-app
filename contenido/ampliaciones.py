#!/usr/bin/env python3
"""1.1: the book's new expansions (contenido/ampliaciones11/<ID>/), shown in the app now, marked «Aún no en el libro».

The authors write each expansion as Typst for the book (new sections, problems, exercises, or a whole new chapter) with
its figures, SVG already in the identity palette, ngspice netlists, review questions and the data its numbers come from.
This step converts that Typst with the app's own converter (typst_parser.py + convertir.py, unchanged) and merges it into
the generated book (web/public/libro/) at the place the manifest names, exactly as if the author had pasted it:

  phase «partes» (generar.py runs it right after writing indice/refs/partes/busqueda/glosario, so that everything
  downstream — spice, repaso, formulas, ejercicios, pasos, practica… — sees the merged book):
    - the blocks in the chapter (or a new chapter: its own partes/<stem>.json, an entry in indice.json, its colour), the
      figures (identity SVG → PDF with Typst → SVG with pdftocairo, glyphs as paths, like the book's), the equations
      (Typst, cached), refs.json, the search documents, the glossary links;
    - the printed numbering follows the expansion: sections, figures, tables and exercises after an insertion shift, and
      the chapters after a new chapter take the next number, in headings, references (every «<a class="ref">» of every
      part), equations that print a number, the index and the search. Storage keys never change: part stems and labels
      of the existing content stay as they are (saved progress keeps working), the new content has its own labels;
  phase «derivados» (generar.py runs it after ejercicios.py and before the Node chain):
    - the netlists (spice/<stem>/*.cir, spice.json, spice-refs.json), validated in the app's ngspice;
    - the review questions (repaso/<stem>.json and repaso/indice.json; checked with contenido/repaso.py's own rules
      against the expansion's Typst, since repaso.py needs the book's sources);
  and ejercicios.py calls anotar_ejercicios() at its end: the new exercises (extracted from the merged parts like any
  other) get their mark and their numeric answers, taken from the expansion's datos/*.json and checked against the
  solution text.

An expansion can also absorb a run of the book (pieces «retirar»: P02 takes over 32.13): the run leaves its part while
the expansion is merged, its label stays in refs.json as an alias of where its content went, and every reference, review
question, netlist and practice item keyed by it keeps its key (see retirar() and ESQUEMA.md).

Everything new carries "ampliacion": "<ID>" (blocks, exercise items, refs, search documents, netlists, questions); a
changed number keeps the book's in "num_libro" (an equation re-rendered for a new number keeps "svg_libro"). That makes
the step reversible and idempotent: every run first undoes what an earlier run added (so running it twice leaves every
file byte-identical, and with no expansion the book is left exactly as generated), then merges again. When the author
pastes an expansion into the book and regenerates, every unit (section, problem, exercise, chapter, question, netlist)
whose label (or, for a netlist, content) the book already has is dropped: the book's version wins, no duplicates.

    python3 contenido/ampliaciones.py                 both phases and, without the book's sources, the downstream steps
                                                      that can run here (ejercicios.py, pasos.py, formulas.py)
    python3 contenido/ampliaciones.py --fase partes   only phase «partes» (generar.py)
    python3 contenido/ampliaciones.py --fase derivados
    python3 contenido/ampliaciones.py --comprobar     convert and check everything, write nothing
    python3 contenido/ampliaciones.py --deshacer      only undo (the book as generated)
EPA_LIBRO=<dir> relocates the book folder and EPA_AMPLIACIONES=<dir> the expansions (tests). The manifest format is in
ESQUEMA.md («Ampliaciones del libro (1.1)»).
"""
import hashlib
import html as htmlmod
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
WEB = os.path.join(APP, 'web')
sys.path.insert(0, HERE)
import convertir  # noqa: E402
import typst_parser  # noqa: E402
import ecuaciones  # noqa: E402
from figuras import compact_svg  # noqa: E402

V3 = '/home/claude/v3'
VERSION = 1
FIG_VERSION = '1'
REF_A = re.compile(r'(<a class="ref" data-ref=")([^"]+)(">)([^<]*)(</a>)')
PARTE_TYPST = re.compile(r'^// =+ PARTE (\d+)\s*$', re.M)
TIPOS_NUM = ('sec', 'fig', 'tab', 'ej')


def libro_dir():
    return os.environ.get('EPA_LIBRO') or os.path.join(WEB, 'public', 'libro')


def fuentes_dir():
    return os.environ.get('EPA_AMPLIACIONES') or os.path.join(HERE, 'ampliaciones11')


def cache_dir():
    return os.environ.get('EPA_CACHE_AMPLIACIONES') or os.path.join(HERE, '.cache', 'ampliaciones')


class Fallo(ValueError):
    pass


def esc(s):
    return htmlmod.escape(s, quote=False)


def leer_json(ruta):
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


def serial(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(',', ':'))


def escribir(ruta, obj):
    """Writes compact JSON like the generator; only when the bytes change (True if written)."""
    texto = serial(obj)
    if os.path.exists(ruta):
        with open(ruta, encoding='utf-8') as f:
            if f.read() == texto:
                return False
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, 'w', encoding='utf-8') as f:
        f.write(texto)
    return True


def recorrer(o):
    """Every dict inside o, depth first, in document order (dict values in insertion order)."""
    if isinstance(o, dict):
        yield o
        for v in o.values():
            yield from recorrer(v)
    elif isinstance(o, list):
        for v in o:
            yield from recorrer(v)


# ------------------------------------------------------------------ manifests

CAMPOS_MANIFIESTO = {'id', 'titulo', 'fuente', 'piezas', 'respuestas', 'repaso', 'spice', 'glosario', 'datos', 'nota'}
TIPOS_PIEZA = {'bloques', 'ejercicios', 'tarjeta', 'capitulo', 'retirar'}
OBLIGATORIOS = {'bloques': ['trozos', 'antes'], 'ejercicios': ['trozos', 'tras'], 'tarjeta': ['trozos', 'en'],
                'capitulo': ['tras', 'tomo'], 'retirar': ['desde', 'hasta', 'destino']}


def importar(origen, base=None):
    """Copies an expansion as the authors deliver it (<ID>.typ, NOTAS.md, figures/identidad/*.svg or figures/*.svg,
    spice/*.cir, app/repaso-*.json, datos/*.json up to 1 MB) into contenido/ampliaciones11/<ID>/ and, if it has no
    manifest yet, writes one with the pieces the Typst's «// ==== PARTE n» markers suggest. What only a person can
    decide (where each piece goes, the answers, the netlists' Spanish titles) is left empty, so the step refuses to run
    and says what is missing."""
    import glob
    origen = os.path.abspath(origen)
    ident = os.path.basename(origen.rstrip('/'))
    destino = os.path.join(base or fuentes_dir(), ident)
    os.makedirs(os.path.join(destino, 'figuras'), exist_ok=True)
    os.makedirs(os.path.join(destino, 'spice'), exist_ok=True)
    os.makedirs(os.path.join(destino, 'datos'), exist_ok=True)
    shutil.copyfile(os.path.join(origen, ident + '.typ'), os.path.join(destino, ident + '.typ'))
    figs = glob.glob(os.path.join(origen, 'figures', 'identidad', '*.svg')) or glob.glob(os.path.join(origen, 'figures', '*.svg'))
    for f in figs:
        shutil.copyfile(f, os.path.join(destino, 'figuras', os.path.basename(f)))
    for f in glob.glob(os.path.join(origen, 'spice', '*.cir')):
        shutil.copyfile(f, os.path.join(destino, 'spice', os.path.basename(f)))
    for f in glob.glob(os.path.join(origen, 'datos', '*.json')):
        if os.path.getsize(f) <= 1_000_000 and not f.endswith(('convertido.json', 'spice.json')):
            shutil.copyfile(f, os.path.join(destino, 'datos', os.path.basename(f)))
    rep = glob.glob(os.path.join(origen, 'app', 'repaso-*.json'))
    if rep:
        shutil.copyfile(rep[0], os.path.join(destino, 'repaso.json'))
    man = os.path.join(destino, 'ampliacion.json')
    if not os.path.exists(man):
        with open(os.path.join(destino, ident + '.typ'), encoding='utf-8') as f:
            trozos = trozos_typst(f.read())
        piezas = []
        if list(trozos) == [0] and '#capitulo(' in trozos[0]:
            piezas.append({'tipo': 'capitulo', 'parte': '', 'tras': '', 'tomo': ''})
        else:
            for n, t in trozos.items():
                if '#soluciones[' in t and piezas and piezas[-1]['tipo'] == 'ejercicios':
                    piezas[-1]['trozos'].append(n)
                elif '#ejercicios[' in t:
                    piezas.append({'tipo': 'ejercicios', 'parte': '', 'trozos': [n], 'tras': ''})
                elif re.search(r'^#tarjeta\[', t, re.M):
                    piezas.append({'tipo': 'tarjeta', 'parte': '', 'trozos': [n], 'en': ''})
                elif re.search(r'^==+ ', t, re.M):
                    piezas.append({'tipo': 'bloques', 'parte': '', 'trozos': [n], 'antes': ''})
        titulo = ident
        notas = os.path.join(origen, 'NOTAS.md')
        if os.path.exists(notas):
            with open(notas, encoding='utf-8') as f:
                m = re.match(r'#\s*(.+)', f.readline())
            titulo = m.group(1).strip() if m else ident
        doc = {'id': ident, 'titulo': titulo, 'fuente': ident + '.typ', 'piezas': piezas, 'respuestas': {},
               'spice': {os.path.basename(f)[:-4]: {'titulo': '', 'descripcion': '', 'refs': []}
                         for f in sorted(glob.glob(os.path.join(destino, 'spice', '*.cir')))},
               'glosario': []}
        if rep:
            doc['repaso'] = 'repaso.json'
        with open(man, 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, indent=1)
            f.write('\n')
    print(f'ampliaciones: {ident} copiada en {destino}; complete ampliacion.json y ejecute --comprobar')
    return 0


def cargar_manifiestos(base=None):
    """The expansions in order of their id (order-stable): [manifest + '_dir']."""
    base = base or fuentes_dir()
    out = []
    if not os.path.isdir(base):
        return out
    for d in sorted(os.listdir(base)):
        ruta = os.path.join(base, d, 'ampliacion.json')
        if not os.path.exists(ruta):
            continue
        m = leer_json(ruta)
        extra = set(m) - CAMPOS_MANIFIESTO
        if extra:
            raise Fallo(f'{d}/ampliacion.json: campos desconocidos {sorted(extra)}')
        if m.get('id') != d:
            raise Fallo(f'{d}/ampliacion.json: «id» debe ser {d!r}')
        for k, p in enumerate(m.get('piezas', [])):
            if p.get('tipo') not in TIPOS_PIEZA:
                raise Fallo(f'{d}: pieza {k + 1} de tipo desconocido {p.get("tipo")!r}')
            for campo in ['parte'] + OBLIGATORIOS[p['tipo']]:
                if not p.get(campo):
                    raise Fallo(f'{d}: a la pieza {k + 1} ({p["tipo"]}) le falta «{campo}»')
        for nombre, n in m.get('spice', {}).items():
            if not (n.get('titulo') and n.get('descripcion') and n.get('refs')):
                raise Fallo(f'{d}: la netlist {nombre} necesita «titulo», «descripcion» (en español) y «refs»')
        m['_dir'] = os.path.join(base, d)
        out.append(m)
    return out


def trozos_typst(texto):
    """{n: text} of the «// ==== PARTE n» pieces; {0: whole text} when the file has no pieces."""
    t = PARTE_TYPST.split(texto)
    if len(t) == 1:
        return {0: texto}
    return {int(t[i]): t[i + 1] for i in range(1, len(t), 2)}


# ------------------------------------------------------------------ equations and figures

def estilo_y_fuentes():
    """The equations' style and font folder: the book's (its template and fonts) when its sources are here, else the
    1.1 template's (Fira Math, Inter at the app's 10.5 pt), with the fonts kept in contenido/ampliaciones11/fuentes."""
    libro_typ = os.path.join(V3, 'plantilla', 'libro.typ')
    if os.path.exists(libro_typ) and os.path.isdir(os.path.join(V3, 'fonts')):
        return ecuaciones.template_style(libro_typ), os.path.join(V3, 'fonts')
    estilo = {'mathf': '("Fira Math", "New Computer Modern Math")', 'serif': '("Inter", "Fira Math")',
              'text_size': '10.5pt', 'math_size': '10.5pt'}
    return estilo, os.environ.get('EPA_FUENTES') or os.path.join(fuentes_dir(), 'fuentes')


def typst_compilar(doc_typ, salida_patron, formato, raiz, fuentes):
    """Typst with the CLI when it is installed (as generar.py), else the Python package `typst` (same compiler)."""
    if shutil.which('typst'):
        res = subprocess.run(['typst', 'compile', '--root', raiz, '--font-path', fuentes, '--format', formato,
                              doc_typ, salida_patron], capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(res.stderr.strip()[:600])
        return
    try:
        import typst
    except ImportError as e:
        raise RuntimeError('no hay Typst (ni la orden typst ni el paquete de Python)') from e
    try:
        datos = typst.compile(doc_typ, root=raiz, font_paths=[fuentes], format=formato)
    except Exception as e:  # noqa: BLE001 (the compiler's own error type)
        raise RuntimeError(str(e)[:600]) from e
    paginas = datos if isinstance(datos, list) else [datos]
    for k, p in enumerate(paginas, 1):
        ruta = salida_patron.replace('{0p}', f'{k:0{len(str(len(paginas)))}d}').replace('{p}', str(k))
        with open(ruta, 'wb') as f:
            f.write(p)


class Ecuaciones(ecuaciones.Registro):
    """The book's equation registry, with its own cache and signature (its hashes never coincide with the book's),
    deferred hashes (an equation that prints a reference number is hashed once the numbering is final) and no clean-up
    of ec/ (the folder is the book's)."""

    def __init__(self, out_dir):
        estilo, fuentes = estilo_y_fuentes()
        cache = os.path.join(cache_dir(), 'ec')
        os.makedirs(cache, exist_ok=True)
        super().__init__(out_dir, cache, estilo, fuentes, {})
        self.signature += '\0ampliacion11'
        self.pendientes = []           # (token, kind, src)

    def request(self, kind, src):
        tok = f'T{len(self.pendientes)}'
        self.pendientes.append((tok, kind, src))
        return tok

    def fijar(self, nums, usados):
        """Final hashes of the requested equations that the merged blocks use (a unit the book already has was
        converted but is not merged), with the final numbers; {token: hash}."""
        self.nums = nums
        return {tok: ecuaciones.Registro.request(self, kind, src) for tok, kind, src in self.pendientes if tok in usados}

    def compile(self, items, workdir):
        doc = self.preamble(items) + '\n#pagebreak()\n'.join(self.page(k, s) for _, k, s in items) + '\n'
        path = os.path.join(workdir, 'doc.typ')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(doc)
        typst_compilar(path, os.path.join(workdir, 'out-{0p}.svg'), 'svg', workdir, self.font_path)
        files = sorted(f for f in os.listdir(workdir) if f.startswith('out-'))
        if len(files) != len(items):
            raise RuntimeError(f'{len(files)} páginas para {len(items)} fórmulas')
        out = {}
        for (h, _, _), f in zip(items, files):
            with open(os.path.join(workdir, f), encoding='utf-8') as fh:
                out[h] = fh.read()
        return out

    def render(self, jobs=2):
        """Renders what is not cached, copies every wanted SVG into ec/; returns the file names."""
        os.makedirs(self.out_dir, exist_ok=True)
        todo = [(h, k, s) for h, (k, s) in self.wanted.items()
                if not (h in self.meta and os.path.exists(os.path.join(self.cache_dir, h + '.svg')))]
        for k in range(0, len(todo), ecuaciones.BATCH):
            for h, (svg, meta) in self.render_batch(todo[k:k + ecuaciones.BATCH]).items():
                with open(os.path.join(self.cache_dir, h + '.svg'), 'w', encoding='utf-8') as f:
                    f.write(svg)
                self.meta[h] = meta
                self.rendered += 1
        with open(self.meta_file, 'w', encoding='utf-8') as f:
            json.dump(self.meta, f, indent=0, sort_keys=True)
        nombres = []
        for h in self.wanted:
            if h in self.failed:
                continue
            origen = os.path.join(self.cache_dir, h + '.svg')
            destino = os.path.join(self.out_dir, h + '.svg')
            if not os.path.exists(destino) or open(destino, 'rb').read() != open(origen, 'rb').read():
                shutil.copyfile(origen, destino)
            nombres.append(h + '.svg')
        return sorted(nombres)


class Figuras:
    """The expansions' figures: identity-palette SVG (text as text) → PDF with Typst and the fonts → SVG with pdftocairo
    (glyphs as paths, as the book's figures) → compact_svg; cached by content."""

    def __init__(self, out_dir):
        self.out_dir = out_dir
        self.cache = os.path.join(cache_dir(), 'fig')
        os.makedirs(self.cache, exist_ok=True)
        self.wanted = {}             # fig/<name>.svg -> source path
        self.dir_actual = None
        self.failed = {}

    def request(self, fname):
        if not fname.endswith('.svg'):
            raise Fallo(f'figura {fname}: las ampliaciones dan sus figuras en SVG')
        rel = 'fig/' + fname
        src = os.path.join(self.dir_actual, 'figuras', fname)
        if rel in self.wanted and self.wanted[rel] != src:
            raise Fallo(f'figura {fname} en dos ampliaciones')
        self.wanted[rel] = src
        return rel

    def convertir(self, src, fuentes):
        with open(src, 'rb') as f:
            datos = f.read()
        huella = hashlib.sha256(datos + FIG_VERSION.encode() + fuentes.encode()).hexdigest()[:16]
        destino = os.path.join(self.cache, f'{os.path.basename(src)[:-4]}.{huella}.svg')
        if os.path.exists(destino):
            return destino
        texto = datos.decode('utf-8')
        m = re.search(r'<svg[^>]*\bviewBox="([-\d.\s]+)"', texto)
        if not m:
            raise RuntimeError('SVG sin viewBox')
        w, h = [float(x) for x in m.group(1).split()][2:]
        tmp = tempfile.mkdtemp(dir=self.cache)
        try:
            shutil.copyfile(src, os.path.join(tmp, 'f.svg'))
            doc = os.path.join(tmp, 'd.typ')
            with open(doc, 'w', encoding='utf-8') as f:
                f.write(f'#set page(width: {w}pt, height: {h}pt, margin: 0pt)\n'
                        f'#image("f.svg", width: {w}pt, height: {h}pt)\n')
            typst_compilar(doc, os.path.join(tmp, 'd.pdf'), 'pdf', tmp, fuentes)
            res = subprocess.run(['pdftocairo', '-svg', os.path.join(tmp, 'd.pdf'), os.path.join(tmp, 's.svg')],
                                 capture_output=True, text=True)
            if res.returncode != 0:
                raise RuntimeError(res.stderr.strip()[:300])
            with open(os.path.join(tmp, 's.svg'), encoding='utf-8') as f:
                svg = compact_svg(f.read())
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        with open(destino, 'w', encoding='utf-8') as f:
            f.write(svg)
        return destino

    def process(self):
        # the identity SVGs name Inter: always the fonts kept with the expansions (the book's may not have it)
        fuentes = os.environ.get('EPA_FUENTES') or os.path.join(fuentes_dir(), 'fuentes')
        os.makedirs(self.out_dir, exist_ok=True)
        hechas = []
        for rel, src in sorted(self.wanted.items()):
            try:
                c = self.convertir(src, fuentes)
            except (OSError, RuntimeError) as e:
                self.failed[rel] = str(e)
                continue
            destino = os.path.join(os.path.dirname(self.out_dir), rel)
            if not os.path.exists(destino) or open(destino, 'rb').read() != open(c, 'rb').read():
                shutil.copyfile(c, destino)
            hechas.append(rel[4:])
        return hechas


def vista_svg(ruta):
    with open(ruta, encoding='utf-8') as f:
        m = re.search(r'<svg[^>]*\bviewBox="([-\d.\s]+)"', f.read(4000))
    return [round(float(x), 3) for x in m.group(1).split()] if m else None


# ------------------------------------------------------------------ the book on disk

class Libro:
    """The generated book: index, references, parts, search, glossary (read once, written only where it changed)."""

    def __init__(self, ruta):
        self.ruta = ruta
        self.indice = leer_json(os.path.join(ruta, 'indice.json'))
        self.refs = leer_json(os.path.join(ruta, 'refs.json'))
        self.busqueda = leer_json(os.path.join(ruta, 'busqueda.json'))
        self.glosario = leer_json(os.path.join(ruta, 'glosario.json'))
        self.partes = {}
        for stem in self.indice['partes']:
            p = os.path.join(ruta, 'partes', stem + '.json')
            if os.path.exists(p):
                self.partes[stem] = leer_json(p)
        reg = os.path.join(ruta, 'ampliaciones.json')
        self.registro = leer_json(reg) if os.path.exists(reg) else None
        self.originales = {k: serial(v) for k, v in self._ficheros().items()}

    def orden(self):
        return [p for t in self.indice['tomos'] for p in t['partes']]

    def _ficheros(self):
        f = {'indice.json': self.indice, 'refs.json': self.refs, 'busqueda.json': self.busqueda,
             'glosario.json': self.glosario}
        for stem, p in self.partes.items():
            f[f'partes/{stem}.json'] = p
        return f

    def guardar(self, registro):
        """Writes the files that changed, removes the parts that left; returns the written paths."""
        escritos = []
        actuales = self._ficheros()
        for rel, obj in actuales.items():
            if self.originales.get(rel) != serial(obj):
                escribir(os.path.join(self.ruta, rel), obj)
                escritos.append(rel)
        for rel in self.originales:
            if rel not in actuales and rel.startswith('partes/'):
                os.remove(os.path.join(self.ruta, rel))
                escritos.append(rel)
        reg = os.path.join(self.ruta, 'ampliaciones.json')
        if registro is None:
            if os.path.exists(reg):
                os.remove(reg)
                escritos.append('ampliaciones.json')
        elif escribir(reg, registro):
            escritos.append('ampliaciones.json')
        return escritos


# ------------------------------------------------------------------ undo

def quitar_marcados(o):
    """Removes, at any depth, every list element that is a dict with "ampliacion"."""
    if isinstance(o, dict):
        for v in o.values():
            quitar_marcados(v)
    elif isinstance(o, list):
        o[:] = [x for x in o if not (isinstance(x, dict) and 'ampliacion' in x)]
        for x in o:
            quitar_marcados(x)


def restaurar_numeros(o):
    for d in recorrer(o):
        if 'num_libro' in d:
            d['num'] = d.pop('num_libro')
        if 'svg_libro' in d:
            d['svg'], d['w'], d['h'] = d.pop('svg_libro'), d.pop('w_libro'), d.pop('h_libro')


def reescribir_refs(libro, cambiados):
    """Anchor texts of every part and glossary entry for the keys whose number changed: {key: (old, new)}."""
    if not cambiados:
        return

    def sub(m):
        c = cambiados.get(m.group(2))
        if c and m.group(4) == esc(c[0]):
            return m.group(1) + m.group(2) + m.group(3) + esc(c[1]) + m.group(5)
        return m.group(0)

    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                o[k] = walk(v)
            return o
        if isinstance(o, list):
            for k, v in enumerate(o):
                o[k] = walk(v)
            return o
        if isinstance(o, str) and 'data-ref="' in o:
            return REF_A.sub(sub, o)
        return o

    for p in libro.partes.values():
        walk(p)
    walk(libro.glosario)


def deshacer(libro):
    """The book exactly as generated: removes what an earlier run added and restores the numbers it changed."""
    for stem in [s for s, p in libro.partes.items() if 'ampliacion' in p]:
        del libro.partes[stem]
    for t in libro.indice['tomos']:
        t['partes'] = [s for s in t['partes'] if 'ampliacion' not in libro.indice['partes'].get(s, {})]
    for s in [s for s, e in libro.indice['partes'].items() if 'ampliacion' in e]:
        del libro.indice['partes'][s]
    cambiados = {}
    for k in [k for k, e in libro.refs.items() if 'ampliacion' in e]:
        del libro.refs[k]
    for k, e in libro.refs.items():
        if 'num_libro' in e:
            cambiados[k] = (e['num'], e['num_libro'])
            e['num'] = e.pop('num_libro')
    for p in libro.partes.values():
        quitar_marcados(p['bloques'])
        restaurar_numeros(p)
    reescribir_refs(libro, cambiados)
    for e in libro.glosario:
        quitar_glosario(e)
    g = libro.partes.get('glosario')
    if g:
        for b in g['bloques']:
            if b['t'] == 'glosario':
                for e in b['entradas']:
                    quitar_glosario(e)
    deshacer_retiradas(libro)
    for stem, e in libro.indice['partes'].items():
        if 'num_libro' in e:
            e['num'] = e.pop('num_libro')
    libro.busqueda = [d for d in libro.busqueda if 'ampliacion' not in d]
    regenerar_indice_y_busqueda(libro, None)


def quitar_glosario(e):
    if 'ver_ampliacion' in e:
        quitadas = set(e.pop('ver_ampliacion'))
        e['ver'] = [v for v in e['ver'] if v not in quitadas]


# ------------------------------------------------------------------ search and index (as generar.py)

def block_text(b, out):
    """generar.py's block_text (plain text of a block for the search), unchanged."""
    t = b['t']
    if 'html' in b:
        out.append(convertir.strip_tags(b['html']))
    if t == 'lista':
        out.extend(convertir.strip_tags(x) for x in b['items'])
    elif t == 'deduccion':
        out.append(convertir.strip_tags(b['titulo']))
    elif t == 'figura':
        out.append(convertir.strip_tags(b['pie']))
    elif t == 'tabla':
        if b['pie']:
            out.append(convertir.strip_tags(b['pie']))
        for fila in b['filas']:
            out.append(' · '.join(convertir.strip_tags(c) for c in fila))
    elif t == 'ec':
        if b.get('etiqueta'):
            out.append(convertir.strip_tags(b['etiqueta']))
    elif t == 'codigo':
        out.append(b['texto'])
    elif t == 'ejercicios':
        for it in b['items']:
            for x in it['bloques']:
                block_text(x, out)
            for x in it['solucion'] or []:
                block_text(x, out)
    elif t == 'glosario':
        return
    for x in b.get('bloques', []):
        block_text(x, out)


def search_docs(stem, part, bloques):
    """generar.py's search_docs, plus the expansion mark on the documents of new sections or a new chapter."""
    docs = []
    head = {'id': part.get('label') or stem, 'parte': stem,
            'titulo': ((part['num'] + ' ') if part.get('num') else '') + part['titulo'], 'texto': []}
    if part.get('ampliacion'):
        head['ampliacion'] = part['ampliacion']
    cur = head
    docs.append(head)
    for b in bloques:
        if b['t'] == 'h2':
            title = convertir.strip_tags(b['html'])
            cur = {'id': b['label'], 'parte': stem, 'titulo': (b['num'] + ' ' if b['num'] else '') + title,
                   'texto': []}
            if b.get('ampliacion'):
                cur['ampliacion'] = b['ampliacion']
            docs.append(cur)
            continue
        block_text(b, cur['texto'])
    out = []
    for d in docs:
        d['texto'] = re.sub(r'\s+', ' ', ' '.join(d['texto'])).strip()
        if d['texto'] or d is not head:
            out.append({k: d[k] for k in ('id', 'parte', 'titulo', 'texto', 'ampliacion') if k in d})
    return out


def regenerar_indice_y_busqueda(libro, solo):
    """The sections of indice.json and the book's search documents, from the parts. `solo`: the stems to redo (None:
    all). Documents that are not the book's (the new exercises' «nuevo») keep their place after the book's."""
    for stem in (solo if solo is not None else list(libro.partes)):
        p = libro.partes.get(stem)
        e = libro.indice['partes'].get(stem)
        if p is None or e is None:
            continue
        e['secciones'] = [{'num': b['num'], 'label': b['label'], 'titulo': convertir.strip_tags(b['html']),
                           **({'ampliacion': b['ampliacion']} if 'ampliacion' in b else {})}
                          for b in p['bloques'] if b['t'] == 'h2']
        if p.get('num') is not None:
            e['num'] = p['num']
    ajenos = [d for d in libro.busqueda if d.get('nuevo')]
    propios = {}
    for d in libro.busqueda:
        if not d.get('nuevo'):
            propios.setdefault(d['parte'], []).append(d)
    nueva = []
    for stem in libro.orden():
        p = libro.partes.get(stem)
        if p is None:
            continue
        if solo is None or stem in solo:
            docs = search_docs(stem, p, p['bloques'])
            if p['tipo'] == 'glosario':
                docs += [d for d in propios.get(stem, []) if d['id'].startswith('glos-')]
            nueva += docs
        else:
            nueva += propios.get(stem, [])
    vistos = {d['parte'] for d in nueva}
    resto = [d for st, ds in propios.items() if st not in vistos for d in ds]
    libro.busqueda = nueva + resto + ajenos
    # glossary entries' text (references inside definitions may have changed)
    textos = {e['id']: convertir.strip_tags(e['html']) for e in libro.glosario if 'id' in e}
    for d in libro.busqueda:
        if d['id'] in textos and d['parte'] == 'glosario':
            d['texto'] = textos[d['id']]


# ------------------------------------------------------------------ conversion of one expansion

class _Refs:
    """What convertir.resolve() needs of a Libro: the references and a list for the problems."""

    def __init__(self, refs):
        self.refs = refs
        self.problems = []


def convertir_pieza(libro_conv, figs, man, pieza, stem, num, tipo_parte='capitulo'):
    """Converts one piece: (blocks, Parte)."""
    with open(os.path.join(man['_dir'], man.get('fuente', man['id'] + '.typ')), encoding='utf-8') as f:
        texto = f.read()
    trozos = trozos_typst(texto)
    claves = pieza.get('trozos', [0])
    for k in claves:
        if k not in trozos:
            raise Fallo(f'{man["id"]}: no hay PARTE {k} en {man.get("fuente")}')
    fuente = '\n'.join(trozos[k] for k in claves)
    figs.dir_actual = man['_dir']
    nodes, probs = typst_parser.parse(fuente, f'{man["id"]}.typ')
    for line, msg, sample in probs:
        libro_conv.problems.append((man['id'], line, msg, sample))
    ctx = convertir.Parte(libro_conv, stem, tipo_parte, num)
    bloques = ctx.blocks(nodes)
    ctx.match_solutions({})
    return bloques, ctx


def etiquetas_de(bloques):
    """Labels a list of converted blocks defines (sections, figures, tables, problems, exercises)."""
    out = []
    for d in recorrer(bloques):
        if isinstance(d.get('label'), str) and ('t' in d or 'bloques' in d):
            out.append(d['label'])
    return out


def unidades(bloques):
    """Splits converted top-level blocks into units: each h2 with what follows it, each problem h3 with what follows
    it (to the next h2/problem), and loose blocks before the first heading as one unit; [(main label, blocks)]."""
    out = []
    for b in bloques:
        nuevo = b['t'] == 'h2' or (b['t'] == 'h3' and (b.get('label') or '').startswith('prob-'))
        if nuevo or not out:
            out.append([b.get('label') if nuevo else None, [b]])
        else:
            out[-1][1].append(b)
    return [(u[0], u[1]) for u in out]


# ------------------------------------------------------------------ numbering

def seq(num):
    return int(num.rsplit('.', 1)[1])


def objetos(bloques, tipo):
    """Numbered objects of a type, in document order: top-level h2, exercise items, figures, numbered tables."""
    if tipo == 'sec':
        return [b for b in bloques if b['t'] == 'h2' and b.get('num')]
    if tipo == 'ej':
        return [it for b in bloques if b['t'] == 'ejercicios' for it in b['items']]
    t = {'fig': 'figura', 'tab': 'tabla'}[tipo]
    return [d for d in recorrer(bloques) if d.get('t') == t and d.get('num')]


def poner_num(obj, nuevo):
    if obj['num'] == nuevo:
        return
    if 'num_libro' not in obj:
        obj['num_libro'] = obj['num']
    obj['num'] = nuevo
    if obj.get('num_libro') == obj['num']:
        del obj['num_libro']


def numerar_insercion(bloques, nuevos_ids, orden_conv, c):
    """After physically inserting new objects into a part, numbers them after the existing ones that precede them and
    shifts the existing ones that follow. `nuevos_ids`: ids of the new objects; `orden_conv`: id → the converter's
    sequence (the order Typst would number them in)."""
    for tipo in TIPOS_NUM:
        objs = objetos(bloques, tipo)
        nuevos = [o for o in objs if id(o) in nuevos_ids]
        if not nuevos:
            continue
        primero = next(k for k, o in enumerate(objs) if id(o) in nuevos_ids)
        base = max((seq(o['num']) for o in objs[:primero] if id(o) not in nuevos_ids), default=0)
        n = len(nuevos)
        for o in objs[primero:]:
            if id(o) not in nuevos_ids and seq(o['num']) > base:
                poner_num(o, f'{c}.{seq(o["num"]) + n}')
        for k, o in enumerate(sorted(nuevos, key=lambda o: orden_conv[id(o)]), 1):
            o['num'] = f'{c}.{base + k}'


def numerar_subsecciones(bloques, c):
    sec = None
    for b in bloques:
        if b['t'] == 'h2' and b.get('num'):
            sec = seq(b['num'])
        elif b['t'] == 'h3' and b.get('num') and sec is not None:
            poner_num(b, f'{c}.{sec}.{b["num"].rsplit(".", 1)[1]}')


def cambiar_capitulo(parte, c_viejo, c_nuevo):
    """Every number of a part whose chapter number changes (a new chapter before it)."""
    pre = f'{c_viejo}.'
    for d in recorrer(parte['bloques']):
        n = d.get('num')
        if isinstance(n, str) and n.startswith(pre) and ('t' in d or 'bloques' in d):
            poner_num(d, f'{c_nuevo}.{n[len(pre):]}')
    poner_num(parte, c_nuevo)


# ------------------------------------------------------------------ the merge

def libro_tiene(libro, etiquetas):
    return [e for e in etiquetas if e in libro.refs and 'ampliacion' not in libro.refs[e]]


def buscar_pos(bloques, ancla, donde, desde=0):
    """Top-level index for «antes»: a label of a top-level block, or «#ejercicios» / «#tarjeta» (the first one, from
    index `desde` on)."""
    if ancla.startswith('#'):
        t = ancla[1:]
        for k, b in enumerate(bloques):
            if k >= desde and b['t'] == t:
                return k
        raise Fallo(f'{donde}: no hay ningún bloque {ancla}')
    for k, b in enumerate(bloques):
        if k >= desde and b.get('label') == ancla:
            return k
    raise Fallo(f'{donde}: no hay ningún bloque con la etiqueta {ancla}')


def retirar(libro, mans, problemas):
    """Pieces «retirar»: an expansion that absorbs a run of the book (P02 takes over 32.13) takes it out of its part while
    it is merged: the top-level blocks from the label «desde» up to «hasta» (excluded: a label, or «#tarjeta» for the
    chapter's formula card), and from the card that follows them the lines listed in «tarjeta» (by their Typst source).
    Runs first, on the book as generated; returns the records of ampliaciones.json «retiradas» (deshacer() puts
    everything back from them). The numbers after the run shift back («num_libro» keeps the book's). Not applied when
    the book already has the destination (the author pasted the expansion: the book wins) or no longer has the run."""
    out = []
    for m in mans:
        for p in m.get('piezas', []):
            if p['tipo'] != 'retirar':
                continue
            donde = f'{m["id"]} retirar {p["desde"]}'
            # (the book no longer has the label: an expansion still merged may cite it, and then it is an alias of its
            # destination all the same; fusionar() keeps this record only if some merged content cites it)
            solo_alias = {'id': m['id'], 'parte': p['parte'], 'pos': None, 'bloques': [], 'tarjeta': [],
                          'etiquetas': [p['desde']], 'destino': p['destino'], 'destinos': p.get('destinos', {}),
                          'solo_alias': True}
            if libro_tiene(libro, [p['destino']]):
                problemas.append(f'{donde}: el libro ya trae {p["destino"]}; se queda el del libro')
                if p['desde'] not in libro.refs:
                    out.append(solo_alias)
                continue
            parte = libro.partes.get(p['parte'])
            if parte is None:
                raise Fallo(f'{donde}: la parte {p["parte"]} no existe')
            bl = parte['bloques']
            ini = next((k for k, b in enumerate(bl) if b.get('label') == p['desde']), None)
            if ini is None:
                if p['desde'] in libro.refs:
                    raise Fallo(f'{donde}: {p["desde"]} no es un bloque de primer nivel de {p["parte"]}')
                problemas.append(f'{donde}: el libro ya no tiene {p["desde"]}; se queda el del libro')
                out.append(solo_alias)
                continue
            fin = buscar_pos(bl, p['hasta'], donde, ini + 1)
            quitados = bl[ini:fin]
            c = parte['num']
            antes = {t: objetos(bl, t) for t in TIPOS_NUM}
            fuera = {id(o) for t in TIPOS_NUM for o in objetos(quitados, t)}
            del bl[ini:fin]
            for t in TIPOS_NUM:
                n = 0
                for o in antes[t]:
                    if id(o) in fuera:
                        n += 1
                    elif n:
                        poner_num(o, f'{c}.{seq(o["num"]) - n}')
            numerar_subsecciones(bl, c)
            reg = {'id': m['id'], 'parte': p['parte'], 'pos': ini, 'bloques': quitados, 'tarjeta': [],
                   'etiquetas': [e for e in etiquetas_de(quitados) if e in libro.refs],
                   'destino': p['destino'], 'destinos': p.get('destinos', {})}
            if p.get('tarjeta'):
                tarjeta = next((b for b in bl[ini:] if b['t'] == 'tarjeta'), None)
                if tarjeta is None:
                    raise Fallo(f'{donde}: no hay tarjeta de fórmulas después de {p["desde"]}')
                for fuente in p['tarjeta']:
                    k = next((k for k, x in enumerate(tarjeta['bloques'])
                              if x.get('t') == 'ec' and x.get('fuente') == fuente), None)
                    if k is None:
                        raise Fallo(f'{donde}: la tarjeta no tiene la fórmula {fuente!r}')
                    reg['tarjeta'].append([k, tarjeta['bloques'].pop(k)])
            out.append(reg)
    return out


def _alias_retiradas(retiradas):
    return {lab: r for r in retiradas for lab in r['etiquetas']}


def _destino_retirada(r, claves):
    for k in claves:
        if k and k in r['destinos']:
            return r['destinos'][k]
    return r['destino']


def redirigir_retiradas(libro, retiradas):
    """Every reference to a retired label («<a class="ref">» of every part and glossary entry) goes to the destination
    its piece gives for where it is («destinos»: the id of the dict that holds it, e.g. a glossary term, the expansion
    of the block, the label of its section, the part; else «destino»). In the book's own content the dict that holds the
    text keeps "refs_libro" {destination: retired label}, so deshacer() can put the book's reference back."""
    alias = _alias_retiradas(retiradas)
    if not alias:
        return
    pat = re.compile(r'<a class="ref" data-ref="(' + '|'.join(re.escape(esc(a)) for a in alias) + r')">[^<]*</a>')

    def walk(v, ctx, cambios):
        if isinstance(v, str):
            if 'data-ref="' not in v:
                return v

            def sub(mm):
                lab = htmlmod.unescape(mm.group(1))
                d = _destino_retirada(alias[lab], ctx[0])
                cambios[d] = lab
                return f'<a class="ref" data-ref="{esc(d)}">{esc(libro.refs[d]["num"])}</a>'
            return pat.sub(sub, v)
        if isinstance(v, list):
            for i, x in enumerate(v):
                v[i] = walk(x, ctx, cambios)
            return v
        if isinstance(v, dict):
            amp = ctx[1] or v.get('ampliacion')
            claves = ([v['id']] if isinstance(v.get('id'), str) else []) + ([amp] if amp else []) + ctx[0]
            mios = {}
            for k in list(v):
                if k != 'refs_libro':
                    v[k] = walk(v[k], (claves, amp), mios)
            if mios and not amp:
                v.setdefault('refs_libro', {}).update(mios)
            return v
        return v

    for stem, p in libro.partes.items():
        sec = None
        for b in p['bloques']:
            if b['t'] == 'h2':
                sec = b.get('label')
            walk(b, ([sec, stem], p.get('ampliacion')), {})
    for e in libro.glosario:
        walk(e, (['glosario'], None), {})


def redirigir_glosario(libro, retiradas, mans):
    """A glossary entry that sends the reader to a retired label («ver») sends him to the expansion's section for that
    term (its manifest's «glosario»), else to the piece's destination; "ver_retirada" [[index, label, destination or
    null when it was already listed]] lets deshacer() restore the list."""
    alias = _alias_retiradas(retiradas)
    if not alias:
        return
    por_id = {m['id']: m for m in mans}
    for lista in _entradas_glosario(libro):
        for e in lista:
            for k in range(len(e.get('ver', [])) - 1, -1, -1):
                lab = e['ver'][k]
                if lab not in alias:
                    continue
                r = alias[lab]
                g = next((g for g in por_id.get(r['id'], {}).get('glosario', []) if g['termino'] == e.get('id')), None)
                d = g['seccion'] if g else _destino_retirada(r, [e.get('id')])
                if d in e['ver']:
                    del e['ver'][k]
                    e.setdefault('ver_retirada', []).append([k, lab, None])
                else:
                    e['ver'][k] = d
                    e.setdefault('ver_retirada', []).append([k, lab, d])


def deshacer_retiradas(libro):
    """The inverse of retirar(), redirigir_retiradas() and redirigir_glosario(), from the registry of the last run (each
    step only if the book does not have it already: after generar.py the parts are the book's again)."""
    for k in [k for k, e in libro.refs.items() if 'retirada' in e]:
        if libro.refs[k]['libro'] is None:
            del libro.refs[k]
        else:
            libro.refs[k] = libro.refs[k]['libro']
    for o in recorrer([libro.partes, libro.glosario]):
        if 'refs_libro' in o:
            vuelta = o.pop('refs_libro')
            pat = re.compile(r'<a class="ref" data-ref="(' + '|'.join(re.escape(esc(d)) for d in vuelta) + r')">[^<]*</a>')

            def sub(mm, vuelta=vuelta):
                lab = vuelta[htmlmod.unescape(mm.group(1))]
                num = libro.refs[lab]['num'] if lab in libro.refs else lab
                return f'<a class="ref" data-ref="{esc(lab)}">{esc(num)}</a>'

            def walk(v):
                if isinstance(v, str):
                    return pat.sub(sub, v)
                if isinstance(v, list):
                    return [walk(x) for x in v]
                return v
            for k in list(o):
                if isinstance(o[k], (str, list)):
                    o[k] = walk(o[k])
    for lista in _entradas_glosario(libro):
        for e in lista:
            for k, lab, d in reversed(e.pop('ver_retirada', [])):
                if d is None:
                    e['ver'].insert(k, lab)
                elif k < len(e['ver']) and e['ver'][k] == d:
                    e['ver'][k] = lab
    for r in reversed((libro.registro or {}).get('retiradas', [])):
        p = libro.partes.get(r['parte'])
        if p is None:
            continue
        bl = p['bloques']
        if r['tarjeta']:
            tarjeta = next((b for b in bl[r['pos']:] if b['t'] == 'tarjeta'), None)
            if tarjeta is not None:
                tiene = {x.get('fuente') for x in tarjeta['bloques'] if x.get('t') == 'ec'}
                for k, linea in reversed(r['tarjeta']):
                    if linea.get('fuente') not in tiene:
                        tarjeta['bloques'].insert(k, linea)
        primero = r['bloques'][0].get('label') if r['bloques'] else None
        if r['bloques'] and not any(b.get('label') == primero for b in bl):
            bl[r['pos']:r['pos']] = r['bloques']


def fusionar(libro, mans, comprobar=False, previos=frozenset()):
    """Merges every expansion into the (undone) book. Returns the registry (ampliaciones.json) and the problems."""
    problemas = []
    # 0. runs of the book an expansion absorbs (pieces «retirar»), out first
    retiradas = retirar(libro, mans, problemas)
    ec = Ecuaciones(os.path.join(libro.ruta, 'ec'))
    figs = Figuras(os.path.join(libro.ruta, 'fig'))
    conv = convertir.Libro(ec, figs)
    orden = libro.orden()
    registro = {'version': VERSION, 'ampliaciones': [], 'etiquetas': {}, 'ficheros': {'fig': [], 'ec': []}}

    # 1. new chapters: their place and the chapter numbers that follow
    nuevos_caps = []       # (manifest, piece)
    for m in mans:
        for p in m.get('piezas', []):
            if p['tipo'] == 'capitulo':
                nuevos_caps.append((m, p))
    insertar_caps = []
    for m, p in nuevos_caps:
        stem = p['parte']
        labels_cap = [stem, p.get('label', stem)]
        if stem in libro.partes or libro_tiene(libro, labels_cap):
            problemas.append(f'{m["id"]}: el libro ya tiene el capítulo {stem}; se queda el del libro')
            p['_omitida'] = True
            continue
        if p['tras'] not in orden:
            raise Fallo(f'{m["id"]}: «tras» {p["tras"]} no es una parte del índice')
        insertar_caps.append((m, p))
    # reading order with the new chapters
    nuevo_orden = list(orden)
    for m, p in insertar_caps:
        nuevo_orden.insert(nuevo_orden.index(p['tras']) + 1, p['parte'])
    c_final = {}
    delta, ultimo = 0, None
    nuevos_stems = {p['parte'] for _, p in insertar_caps}
    for stem in nuevo_orden:
        if stem in nuevos_stems:
            c_final[stem] = str(int(ultimo) + 1) if ultimo is not None else '0'
            delta += 1
            ultimo = c_final[stem]
            continue
        e = libro.indice['partes'][stem]
        if e.get('tipo') == 'capitulo' and e.get('num') is not None:
            c_final[stem] = str(int(e['num']) + delta)
            ultimo = c_final[stem]
    for stem, p in libro.partes.items():
        if p.get('tipo') == 'capitulo' and stem in c_final and c_final[stem] != p['num']:
            cambiar_capitulo(p, p['num'], c_final[stem])

    # 2. the pieces, in manifest order, converted with the final chapter number
    tocadas = set()
    conv_orden = {}
    for m in mans:
        info = {'id': m['id'], 'titulo': m.get('titulo', m['id']), 'partes': [], 'etiquetas': [], 'omitidas': []}
        registro['ampliaciones'].append(info)
        for k, p in enumerate(m.get('piezas', [])):
            donde = f'{m["id"]} pieza {k + 1}'
            if p.get('_omitida'):
                info['omitidas'].append(p['parte'])
                continue
            if p['tipo'] == 'retirar':
                continue        # done in step 0
            stem = p['parte']
            if p['tipo'] == 'capitulo':
                bl, ctx = convertir_pieza(conv, figs, m, p, stem, c_final[stem])
                if not ctx.label:
                    raise Fallo(f'{donde}: el capítulo nuevo no tiene etiqueta (#capitulo(…)[…] <cap-…>)')
                parte = {'id': stem, 'tipo': 'capitulo', 'titulo': ctx.titulo, 'num': c_final[stem],
                         'label': ctx.label, 'color': ctx.color, 'tomo': p['tomo'], 'bloques': bl,
                         'ampliacion': m['id']}
                for b in bl:
                    b['ampliacion'] = m['id']
                libro.partes[stem] = parte
                tomo = next((t for t in libro.indice['tomos'] if t['id'] == p['tomo']), None)
                if tomo is None or p['tras'] not in tomo['partes']:
                    raise Fallo(f'{donde}: «tras» {p["tras"]} no está en el tomo {p["tomo"]}')
                tomo['partes'].insert(tomo['partes'].index(p['tras']) + 1, stem)
                libro.indice['partes'][stem] = {'tipo': 'capitulo', 'titulo': ctx.titulo, 'color': ctx.color,
                                                'tomo': p['tomo'], 'secciones': [], 'num': c_final[stem],
                                                'label': ctx.label, 'ampliacion': m['id']}
                # keep the dict order of indice.json: reading order
                libro.indice['partes'] = {s: libro.indice['partes'][s] for s in
                                          [x for t in libro.indice['tomos'] for x in t['partes']]
                                          + [x for x in libro.indice['partes'] if x not in nuevo_orden]}
                info['partes'].append(stem)
                info['etiquetas'] += [ctx.label] + etiquetas_de(bl)
                tocadas.add(stem)
                continue
            if stem not in libro.partes:
                raise Fallo(f'{donde}: la parte {stem} no existe')
            parte = libro.partes[stem]
            c = parte['num']
            bl, ctx = convertir_pieza(conv, figs, m, p, stem, c)
            for t in TIPOS_NUM:
                for j, o in enumerate(objetos(bl, t)):
                    conv_orden[id(o)] = (len(conv_orden), j)
            nuevos_ids = set()
            if p['tipo'] == 'bloques':
                pos = buscar_pos(parte['bloques'], p['antes'], donde)
                meter = []
                for _, us in unidades(bl):
                    labs = etiquetas_de(us)
                    ya = libro_tiene(libro, labs)
                    if ya:
                        problemas.append(f'{donde}: el libro ya trae {", ".join(ya)}; se queda el del libro')
                        info['omitidas'] += labs
                        continue
                    for b in us:
                        b['ampliacion'] = m['id']
                    meter += us
                    info['etiquetas'] += labs
                if not meter:
                    continue
                parte['bloques'][pos:pos] = meter
                for t in TIPOS_NUM:
                    nuevos_ids |= {id(o) for o in objetos(meter, t)}
            elif p['tipo'] == 'ejercicios':
                nuevos_items = [it for b in bl if b['t'] == 'ejercicios' for it in b['items']]
                if len(bl) != 1 or bl[0]['t'] != 'ejercicios':
                    raise Fallo(f'{donde}: la pieza de ejercicios debe dar un solo bloque #ejercicios')
                tras = p['tras']
                destino = None
                for b in parte['bloques']:
                    if b['t'] == 'ejercicios':
                        for j, it in enumerate(b['items']):
                            if it.get('label') == tras:
                                destino = (b, j)
                if destino is None:
                    raise Fallo(f'{donde}: no hay ningún ejercicio {tras} en {stem}')
                meter = []
                for it in nuevos_items:
                    labs = etiquetas_de([it])
                    ya = libro_tiene(libro, labs)
                    if ya:
                        problemas.append(f'{donde}: el libro ya trae {", ".join(ya)}; se queda el del libro')
                        info['omitidas'] += labs
                        continue
                    it['ampliacion'] = m['id']
                    meter.append(it)
                    info['etiquetas'] += labs
                if not meter:
                    continue
                b, j = destino
                b['items'][j + 1:j + 1] = meter
                nuevos_ids |= {id(it) for it in meter}
                nuevos_ids |= {id(o) for t in ('fig', 'tab') for o in objetos(meter, t)}
            elif p['tipo'] == 'tarjeta':
                tarjeta = None
                if p.get('en'):
                    pos = buscar_pos(parte['bloques'], p['en'], donde)
                    for b in parte['bloques'][pos:]:
                        if b['t'] == 'tarjeta':
                            tarjeta = b
                            break
                        if b['t'] == 'h2' and b is not parte['bloques'][pos]:
                            break
                if tarjeta is None:
                    raise Fallo(f'{donde}: no hay tarjeta de fórmulas en {p.get("en")}')
                nuevas = [x for b in bl if b['t'] == 'tarjeta' for x in b['bloques']]
                if not nuevas or any(b['t'] != 'tarjeta' for b in bl):
                    raise Fallo(f'{donde}: la pieza de tarjeta debe dar un solo bloque #tarjeta')
                tiene = {x.get('fuente') for x in tarjeta['bloques'] if x.get('t') == 'ec'}
                meter = [x for x in nuevas if not (x.get('t') == 'ec' and x.get('fuente') in tiene)]
                if not meter:
                    problemas.append(f'{donde}: la tarjeta del libro ya tiene estas fórmulas')
                    continue
                for x in meter:
                    x['ampliacion'] = m['id']
                tarjeta['bloques'] += meter
            orden_conv = {i: conv_orden[i] for i in nuevos_ids if i in conv_orden}
            for i in nuevos_ids:
                orden_conv.setdefault(i, (len(conv_orden), 0))
            numerar_insercion(parte['bloques'], nuevos_ids, orden_conv, c)
            numerar_subsecciones(parte['bloques'], c)
            if stem not in info['partes']:
                info['partes'].append(stem)
            tocadas.add(stem)

    problemas += [f'{x[0]}:{x[1]}: {x[2]} {x[3]}'.rstrip() for x in conv.problems]

    # 3. references: changed numbers, new labels
    cambios = {}        # (parte, tipo, old) -> new
    for stem, p in libro.partes.items():
        if p.get('ampliacion'):
            continue
        for d in recorrer(p['bloques']):
            if 'num_libro' in d:
                tipo = tipo_de(d)
                if tipo:
                    cambios[(stem, tipo, d['num_libro'])] = d['num']
    cambiados = {}
    for k, e in libro.refs.items():
        stem = e['parte']
        nuevo = None
        if e['tipo'] in ('cap', 'ap'):
            if stem in c_final and e['tipo'] == 'cap':
                nuevo = c_final[stem]
        elif e['tipo'] == 'prob':
            p = libro.partes.get(stem)
            if p is not None and 'num_libro' in p:
                pre = p['num_libro'] + '.'
                if e['num'].startswith(pre):
                    nuevo = p['num'] + '.' + e['num'][len(pre):]
        else:
            nuevo = cambios.get((stem, e['tipo'], e['num']))
        if nuevo is not None and nuevo != e['num']:
            cambiados[k] = (e['num'], nuevo)
            e['num_libro'] = e['num']
            e['num'] = nuevo
    for info in registro['ampliaciones']:
        for stem in info['partes']:
            p = libro.partes[stem]
            c = p['num']
            for d in recorrer(p['bloques']) if p.get('ampliacion') else _marcados(p['bloques'], info['id']):
                lab = d.get('label')
                if not isinstance(lab, str) or not ('t' in d or 'bloques' in d):
                    continue
                tipo = tipo_de(d)
                if tipo is None:
                    if d.get('t') == 'h3' and lab.startswith('prob-'):
                        tipo, num = 'prob', f'{c}.{lab.split(".")[-1]}'
                    else:
                        continue
                else:
                    num = d['num']
                if lab in libro.refs:
                    raise Fallo(f'{info["id"]}: etiqueta {lab} ya usada en el libro')
                libro.refs[lab] = {'num': num, 'parte': stem, 'tipo': tipo, 'ampliacion': info['id']}
            if p.get('ampliacion'):
                libro.refs[p['label']] = {'num': c, 'parte': stem, 'tipo': 'cap', 'ampliacion': info['id']}
        for lab in info['etiquetas']:
            registro['etiquetas'][lab] = info['id']
    reescribir_refs(libro, cambiados)
    # a retired label stays in refs.json as an alias of its destination (the app's candidatosDeRef() honours «label»):
    # links, bookmarks, notes and progress keyed by it lead to where its content went; «libro» keeps the book's entry
    # (null when the book no longer has it and only a merged expansion cites it)
    def citada(lab):
        marca = f'data-ref="{esc(lab)}"'
        for p in libro.partes.values():
            for d in (recorrer(p['bloques']) if p.get('ampliacion') else _marcados(p['bloques'])):
                if any(isinstance(v, str) and marca in v for v in d.values()):
                    return True
        return False
    retiradas[:] = [r for r in retiradas if not r.get('solo_alias') or citada(r['etiquetas'][0])]
    for r in retiradas:
        if r['destino'] not in libro.refs:
            raise Fallo(f'{r["id"]}: el destino {r["destino"]} de lo retirado no existe')
        for lab in r['etiquetas']:
            d = libro.refs[r['destino']]
            libro.refs[lab] = {'num': d['num'], 'parte': d['parte'], 'tipo': d['tipo'], 'label': r['destino'],
                               'retirada': r['id'], 'libro': libro.refs.get(lab)}

    # 4. equations: final hashes, render, placeholders (only those of what was merged; likewise the figures)
    fusionados = []
    for info in registro['ampliaciones']:
        for stem in info['partes']:
            p = libro.partes[stem]
            fusionados += list(recorrer(p['bloques']) if p.get('ampliacion') else _marcados(p['bloques'], info['id']))
    usados = set()
    for d in fusionados:
        if d.get('t') == 'ec' and str(d.get('_h', '')).startswith('T'):
            usados.add(d['_h'])
        for v in d.values():
            if isinstance(v, str) and 'src="ec/T' in v:
                usados |= set(re.findall(r'src="ec/(T\d+)\.svg"', v))
    figs.wanted = {rel: src for rel, src in figs.wanted.items()
                   if any(d.get('t') == 'figura' and d.get('src') == rel for d in fusionados)}
    nums = {k: e['num'] for k, e in libro.refs.items()}
    hashes = ec.fijar(nums, usados)
    rehacer = []           # existing equations that print a number that changed
    for stem, p in libro.partes.items():
        for d in recorrer(p['bloques']):
            if d.get('t') == 'ec' and 'ampliacion' not in d and '#nr(' in d.get('fuente', '') and not p.get('ampliacion'):
                claves = set(ecuaciones.NR.findall(d['fuente']))
                if claves & set(cambiados):
                    rehacer.append(d)
    for d in rehacer:
        h = ecuaciones.Registro.request(ec, 'display', '$' + d['fuente'] + '$')
        d['_rehacer'] = h

    def poner_hash(o):
        # the converter's inline-math placeholder is E<hash> (convertir.PH); here <hash> is a token
        if isinstance(o, dict):
            if o.get('t') == 'ec' and str(o.get('_h', '')).startswith('T'):
                o['_h'] = hashes[o['_h']]
                o['svg'] = f'ec/{o["_h"]}.svg'
            for k, v in o.items():
                if isinstance(v, str):
                    if 'src="ec/T' in v:
                        v = re.sub('E(T\\d+)', lambda mm: 'E' + hashes[mm.group(1)] + '', v)
                        v = re.sub(r'src="ec/(T\d+)\.svg"', lambda mm: f'src="ec/{hashes[mm.group(1)]}.svg"', v)
                        o[k] = v
                else:
                    poner_hash(v)
        elif isinstance(o, list):
            for v in o:
                poner_hash(v)
    unicas = list(dict.fromkeys(s for info in registro['ampliaciones'] for s in info['partes']))
    for stem in unicas:
        poner_hash(libro.partes[stem]['bloques'])
    if comprobar:
        ec_files = []
        ec_meta = {h: {'w': 0, 'h': 0, 'd': 0} for h in ec.wanted}
    else:
        ec_files = ec.render()
        ec_meta = ec.meta
    for h, err in ec.failed.items():
        problemas.append(f'fórmula que Typst no compila ({err[:200]}): {ec.wanted[h][1][:120]}')
    for d in rehacer:
        h = d.pop('_rehacer')
        meta = ec_meta.get(h)
        if meta is None:
            continue
        d['svg_libro'], d['w_libro'], d['h_libro'] = d['svg'], d['w'], d['h']
        d['svg'], d['w'], d['h'] = f'ec/{h}.svg', meta['w'], meta['h']

    def fill_ec(o):
        for d in recorrer(o):
            if d.get('t') == 'ec' and '_h' in d:
                meta = ec_meta.get(d.pop('_h'), {'w': 0, 'h': 0})
                d['w'], d['h'] = meta['w'], meta['h']
    resolver = _Refs(libro.refs)
    for stem in unicas:
        bl = libro.partes[stem]['bloques']
        fill_ec(bl)
        convertir.resolve(bl, resolver, {}, ec_meta, stem)
    problemas += [f'{x[0]}: {x[2]}' for x in resolver.problems]
    redirigir_retiradas(libro, retiradas)

    # 5. figures (a file that is there and not an earlier run's is the book's)
    for rel in figs.wanted:
        if rel not in previos and os.path.exists(os.path.join(libro.ruta, rel)):
            raise Fallo(f'la figura {rel} de una ampliación tiene el nombre de una del libro')
    fig_files = [] if comprobar else figs.process()
    for rel, err in figs.failed.items():
        problemas.append(f'figura no convertida {rel}: {err}')
    for info in registro['ampliaciones']:
        for stem in info['partes']:
            for d in recorrer(libro.partes[stem]['bloques']):
                if d.get('t') == 'figura' and d['src'] in figs.wanted and 'tipo_figura' not in d:
                    ruta = os.path.join(libro.ruta, d['src'])
                    d['tipo_figura'] = 'diagrama'
                    v = vista_svg(ruta) if os.path.exists(ruta) else None
                    if v:
                        d['svg_vista'] = v
    registro['ficheros'] = {'fig': fig_files, 'ec': ec_files}
    if retiradas:
        registro['retiradas'] = retiradas

    # 6. glossary links (first, those that pointed to a retired label)
    redirigir_glosario(libro, retiradas, mans)
    for m in mans:
        for g in m.get('glosario', []):
            if registro['etiquetas'].get(g['seccion']) != m['id']:
                continue
            for lista in _entradas_glosario(libro):
                e = next((x for x in lista if x.get('id') == g['termino']), None)
                if e is None:
                    raise Fallo(f'{m["id"]}: el glosario no tiene {g["termino"]}')
                if g['seccion'] not in e['ver']:
                    e['ver'].append(g['seccion'])
                    e.setdefault('ver_ampliacion', []).append(g['seccion'])
            texto = texto_seccion(libro, g['seccion'])
            palabra = g.get('palabra') or re.sub(r'\s*\(.*\)\s*$', '', next(
                x['termino'] for x in libro.glosario if x.get('id') == g['termino']))
            if palabra.casefold() not in texto.casefold():
                problemas.append(f'{m["id"]}: «{palabra}» ({g["termino"]}) no aparece en {g["seccion"]}')

    # 7. index and search, from all the parts (exactly what generar.py writes for the parts it did not touch)
    regenerar_indice_y_busqueda(libro, None)
    if not any(info['etiquetas'] for info in registro['ampliaciones']):
        registro = None if not mans else registro
    return registro, problemas


def _marcados(bloques, ident=None):
    """Dicts inside the top-level blocks / exercise items / card lines marked as new (by expansion `ident`, if given:
    two expansions can merge into the same part)."""
    for d in recorrer(bloques):
        if 'ampliacion' in d and (ident is None or d['ampliacion'] == ident):
            yield from recorrer(d)


def tipo_de(d):
    t = d.get('t')
    if t == 'h2' and d.get('num'):
        return 'sec'
    if t == 'h3' and d.get('num'):
        return 'subsec'
    if t == 'figura':
        return 'fig'
    if t == 'tabla' and d.get('num'):
        return 'tab'
    if 't' not in d and 'bloques' in d and 'solucion' in d:
        return 'ej'
    return None


def _entradas_glosario(libro):
    out = [libro.glosario]
    g = libro.partes.get('glosario')
    if g:
        out += [b['entradas'] for b in g['bloques'] if b['t'] == 'glosario']
    return out


def texto_seccion(libro, label):
    for d in libro.busqueda:
        if d['id'] == label:
            return d['titulo'] + ' ' + d['texto']
    r = libro.refs.get(label)
    if not r:
        return ''
    out = []
    dentro = False
    for b in libro.partes[r['parte']]['bloques']:
        if b['t'] == 'h2':
            dentro = b.get('label') == label
        if dentro:
            block_text(b, out)
    return ' '.join(out)


# ------------------------------------------------------------------ printed numbers written by hand in the app's sources

# The app's hand-written sources (curated answers and quotes, review questions, lessons…) quote the book, and the book
# says «sección 31.10» or «figura 33.2». When an expansion shifts those numbers, the quotes would no longer be in the
# text (the checks of ejercicios.py, repaso.py… would fail) and the explanations would show the old number. So the
# step rewrites them too, by label: numeracion.json records, for every printed number the sources mention, the label it
# stands for; on each run every mention gets that label's current number, and the record is updated. Without a record
# (the first time), the mentions are in the book's own numbering; afterwards, a new mention is taken as written in the
# current numbering (it was copied from the app). So the rewrite is idempotent and it also undoes itself when an
# expansion leaves, or when the author pastes one into the book (the label keeps its number: nothing changes).

FUENTES_CURADAS = ['ejercicios_curado.txt', 'porque_curado.json', 'pasos_curado.json', 'teoria_viva_curado.json',
                   'averias_curado.json', 'repaso/*.json', 'lecciones11/**/*.yaml', 'ejercicios_nuevos11/*.yaml']
_ESP = r'[   ]'
_NUM = r'\d+(?:\.(?:\d+|[A-Z]))*(?![\d,]\d)'
MENCION = re.compile(r'(?<![\w-])(?P<kw>secci[oó]n(?:es)?|apartados?|figuras?|figs?\.|cap[ií]tulos?|ejercicios?'
                     r'|problemas?|tablas?)(?P<resto>' + _ESP + r'+' + _NUM + r'(?:' + _ESP + r'*(?:,|y|e|o|a|–|/)'
                     + _ESP + r'*' + _NUM + r')*)', re.I)
UN_NUM = re.compile(_NUM)
AJENA = re.compile(r'\s+de(?:l|\s+la|\s+las|\s+los)?\s+(?:norma|IEC|UNE|EN\b|ISO|ITC|REBT|reglamento|manual|hoja'
                   r'|especificaci|datasheet|directiva)', re.I)


def _tipo_mencion(kw, num):
    k = kw.lower()
    partes = num.split('.')
    if k.startswith('cap'):
        return 'cap' if len(partes) == 1 else None
    if len(partes) == 1:
        return None
    if k.startswith(('secc', 'apart')):
        return 'sec' if len(partes) == 2 else 'subsec'
    if k.startswith('fig'):
        return 'fig' if len(partes) == 2 else None
    if k.startswith('ejer'):
        return 'ej' if len(partes) == 2 and partes[1].isdigit() else None
    if k.startswith('prob'):
        return 'prob' if len(partes) == 2 and partes[1].isalpha() else None
    if k.startswith('tab'):
        return 'tab' if len(partes) == 2 else None
    return None


def _mapa_numeros(refs, del_libro):
    """(tipo, printed number) → label, in the current numbering or in the book's (num_libro)."""
    out = {}
    for k in sorted(refs):
        e = refs[k]
        if del_libro and 'ampliacion' in e:
            continue
        if 'retirada' in e:
            # a retired label (an alias of where its content went): the book's number names it; the current one, its
            # destination
            if del_libro and e['libro']:
                out.setdefault((e['libro']['tipo'], e['libro']['num']), k)
            continue
        num = e.get('num_libro', e['num']) if del_libro else e['num']
        out.setdefault((e['tipo'], num), k)
    return out


def _reescribir(texto, previo, refs, actual, libro, nuevo_reg):
    """`texto` with every mention of a printed number of the book given its label's current number. `previo`: the
    record of the text ({tipo: {num: label}}), or None when it has none (then its mentions are the book's numbering;
    with a record, a mention it does not list is taken as written in the current numbering). `nuevo_reg` receives the
    record of the result."""
    def sub(m):
        kw = m.group('kw')
        if AJENA.match(m.string, m.end()):
            return m.group(0)       # «apartado 4.2 de la norma …»: not the book's

        def uno(mm):
            n = mm.group(0)
            t = _tipo_mencion(kw, n)
            if t is None:
                return n
            if previo is not None and n in previo.get(t, {}):
                lab = previo[t][n]
            elif previo is None:
                lab = libro.get((t, n))
            else:
                lab = actual.get((t, n))
            if lab is None or lab not in refs:
                return n
            nuevo = refs[lab]['num']
            nuevo_reg.setdefault(t, {})[nuevo] = lab
            return nuevo
        return kw + UN_NUM.sub(uno, m.group('resto'))
    return MENCION.sub(sub, texto)


def _ordenar_registro(reg):
    return {t: dict(sorted(v.items(), key=lambda kv: [int(x) if x.isdigit() else x for x in re.split(r'(\d+)', kv[0])]))
            for t, v in sorted(reg.items())}


def _ruta_numeracion(base):
    return os.path.join(os.environ.get('EPA_AMPLIACIONES') or os.path.join(base, 'ampliaciones11'), 'numeracion.json')


def renumerar_fuentes(refs, base=None, comprobar=False):
    """Rewrites the printed numbers that the app's sources mention (see above); returns the files changed."""
    import glob
    if base is None and os.environ.get('EPA_LIBRO') and not os.environ.get('EPA_CURADAS'):
        return []      # a copy of the book (tests): never touch the real sources unless EPA_CURADAS says where
    base = base or os.environ.get('EPA_CURADAS') or HERE
    reg_ruta = _ruta_numeracion(base)
    guardado = leer_json(reg_ruta) if os.path.exists(reg_ruta) else {}
    previo = guardado.get('tipos')
    actual = _mapa_numeros(refs, False)
    libro = _mapa_numeros(refs, True)
    nuevo_reg = {}
    cambiados = []
    ficheros = sorted({f for patron in FUENTES_CURADAS for f in glob.glob(os.path.join(base, patron), recursive=True)})
    for ruta in ficheros:
        with open(ruta, encoding='utf-8') as f:
            texto = f.read()
        nuevo = _reescribir(texto, previo, refs, actual, libro, nuevo_reg)
        if nuevo != texto:
            cambiados.append(os.path.relpath(ruta, base))
            if not comprobar:
                with open(ruta, 'w', encoding='utf-8') as f:
                    f.write(nuevo)
    reg = dict(guardado)
    reg.update({'version': 1, 'nota': 'Etiqueta de cada número impreso que citan las fuentes curadas de la app '
                '(«tipos») y los ficheros generados que no se pueden regenerar sin las fuentes del libro '
                '(«derivados»); contenido/ampliaciones.py, renumerar_fuentes.', 'tipos': _ordenar_registro(nuevo_reg)})
    reg = {k: reg[k] for k in ('version', 'nota', 'tipos', 'derivados') if k in reg}
    if not comprobar and guardado != reg:
        with open(reg_ruta, 'w', encoding='utf-8') as f:
            json.dump(reg, f, ensure_ascii=False, indent=1)
            f.write('\n')
    return cambiados


def renumerar_derivado(ruta, refs, clave, regenerado):
    """The printed numbers written as text in a generated file that cannot be generated again here (formulas.json
    without the book's sources), with its own record under «derivados» of numeracion.json. `regenerado`: the file has
    just been written from the merged book (generar.py): its numbers are the current ones, so it only drops its record."""
    base = os.environ.get('EPA_CURADAS') or HERE
    reg_ruta = _ruta_numeracion(base)
    if os.environ.get('EPA_LIBRO') and not os.environ.get('EPA_CURADAS'):
        return False
    guardado = leer_json(reg_ruta) if os.path.exists(reg_ruta) else {'version': 1}
    derivados = dict(guardado.get('derivados', {}))
    cambiado = False
    if regenerado:
        derivados.pop(clave, None)
    else:
        with open(ruta, encoding='utf-8') as f:
            texto = f.read()
        nuevo_reg = {}
        nuevo = _reescribir(texto, derivados.get(clave), refs, _mapa_numeros(refs, False), _mapa_numeros(refs, True),
                            nuevo_reg)
        if nuevo != texto:
            with open(ruta, 'w', encoding='utf-8') as f:
                f.write(nuevo)
            cambiado = True
        derivados[clave] = _ordenar_registro(nuevo_reg)
    reg = dict(guardado)
    if derivados:
        reg['derivados'] = dict(sorted(derivados.items()))
    else:
        reg.pop('derivados', None)
    if reg != guardado:
        with open(reg_ruta, 'w', encoding='utf-8') as f:
            json.dump(reg, f, ensure_ascii=False, indent=1)
            f.write('\n')
    return cambiado


# ------------------------------------------------------------------ phase «partes»

def fase_partes(ruta=None, comprobar=False, solo_deshacer=False):
    ruta = ruta or libro_dir()
    libro = Libro(ruta)
    previo = libro.registro
    previos = {f'{sub}/{f}' for sub in ('fig', 'ec') for f in (previo or {}).get('ficheros', {}).get(sub, [])}

    def borrar_previos(quedan):
        for rel in sorted(previos - quedan):
            p = os.path.join(ruta, rel)
            if os.path.exists(p):
                os.remove(p)
    deshacer(libro)
    if solo_deshacer:
        escritos = libro.guardar(None)
        borrar_previos(set())
        escritos += renumerar_fuentes(libro.refs)
        print(f'ampliaciones: deshecho ({len(escritos)} ficheros)')
        return 0
    try:
        mans = cargar_manifiestos()
        registro, problemas = fusionar(libro, mans, comprobar, previos)
    except Fallo as e:
        print(f'ampliaciones: {e}')
        return 1
    errores = [p for p in problemas if 'se queda el del libro' not in p and 'ya tiene estas fórmulas' not in p]
    for p in problemas:
        print(('  ERROR ' if p in errores else '  ') + p)
    if errores:
        print(f'ampliaciones: {len(errores)} errores; no se escribe nada')
        return 1
    if comprobar:
        cambiarian = renumerar_fuentes(libro.refs, comprobar=True)
        if cambiarian:
            print(f'ampliaciones: renumeraría las citas de {", ".join(cambiarian)}')
        n = sum(len(i['etiquetas']) for i in (registro or {}).get('ampliaciones', []))
        print(f'ampliaciones: {len(mans)} ampliaciones correctas, {n} etiquetas nuevas (no se escribe nada)')
        return 0
    escritos = libro.guardar(registro)
    borrar_previos({f'{sub}/{f}' for sub in ('fig', 'ec') for f in (registro or {}).get('ficheros', {}).get(sub, [])})
    # the printed numbers the app's own sources quote (curated answers, review questions, lessons…)
    escritos += renumerar_fuentes(libro.refs)
    resumen = ', '.join(f'{i["id"]} ({len(i["etiquetas"])} etiquetas{", omitidas " + str(len(i["omitidas"])) if i["omitidas"] else ""})'
                        for i in (registro or {}).get('ampliaciones', []))
    print(f'ampliaciones: {resumen or "ninguna"}; {len(escritos)} ficheros escritos')
    return 0


# ------------------------------------------------------------------ main

def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if '--importar' in argv:
        return importar(argv[argv.index('--importar') + 1])
    fase = argv[argv.index('--fase') + 1] if '--fase' in argv else None
    if '--deshacer' in argv:
        r = fase_partes(solo_deshacer=True)
        return r or fase_derivados(solo_deshacer=True)
    comprobar = '--comprobar' in argv
    if fase in (None, 'partes'):
        r = fase_partes(comprobar=comprobar)
        if r:
            return r
    if comprobar:
        return 0
    if fase is None and not os.path.isdir(os.path.join(V3, 'libro')):
        # without the book's sources, the downstream steps that can run here (generar.py runs them itself)
        # (formulas.py needs the book's sources: phase «derivados» adjusts formulas.json instead)
        import ejercicios
        import pasos
        if ejercicios.main([]):
            return 1
        if pasos.main([]):
            return 1
    if fase in (None, 'derivados'):
        r = fase_derivados(validar='--sin-validar' not in argv)
        if r:
            return r
    if fase is None and not os.path.isdir(os.path.join(V3, 'libro')) and '--sin-cadena' not in argv:
        return cadena_node('--miniaturas' in argv)
    return 0


CADENA = ['practica10.mjs', 'retos10.mjs', 'averias10.mjs', 'porque10.mjs', 'teoria10.mjs', 'conceptos11.mjs',
          'lecciones11.mjs', 'circuitos-proporciones.mjs']


def cadena_node(miniaturas=False):
    """The Node steps generar.py runs after the Python ones (practica() and proporciones()), in its order: they read
    the merged parts; each one rewrites only its own files and is idempotent."""
    if not shutil.which('node'):
        print('ampliaciones: falta node; no se rehacen la práctica, los «por qué», las lecciones…')
        return 0
    pasos_node = list(CADENA)
    if miniaturas:
        pasos_node.append('miniaturas.mjs')
    for s in pasos_node:
        args = (['nice'] if shutil.which('nice') else []) + ['node', os.path.join('scripts', s)] + (['--esquemas', '--figuras'] if s == 'miniaturas.mjs' else [])
        if subprocess.run(args, cwd=WEB).returncode != 0:
            print(f'ampliaciones: falló {s}')
            return 1
    return 0


# ------------------------------------------------------------------ exercises (called by ejercicios.py at its end)

def _dato(man, clave):
    fichero, ruta = clave.split(':', 1)
    d = leer_json(os.path.join(man['_dir'], 'datos', fichero + '.json'))
    for k in ruta.split('.'):
        d = d[int(k)] if isinstance(d, list) else d[k]
    if not isinstance(d, (int, float)) or isinstance(d, bool):
        raise Fallo(f'{man["id"]}: el dato {clave} no es un número')
    return float(d)


def _plano(t):
    return re.sub(r'[\s    ]+', ' ', t.replace('−', '-')).strip()


def respuestas_de(man, label, lista, solucion):
    """The checked answers of one exercise: [nombre, escrito, dato] → ejercicios.json fields. The written value must be
    in the solution and must be the datum of the expansion's data rounded as written."""
    import ejercicios as EJ
    out = []
    sol = ' ' + _plano(solucion) + ' '
    for k, (nombre, escrito, clave) in enumerate(lista, 1):
        donde = f'{man["id"]} {label} «{nombre}»'
        r = EJ.valor_dsl(escrito, donde)
        m = re.match(r'^(' + EJ.NUM_RE + r')', escrito)
        if not m:
            raise Fallo(f'{donde}: valor no reconocido {escrito!r}')
        cifra = _plano(m.group(1))
        if not re.search(r'(?<![\d,])' + re.escape(cifra) + r'(?![\d]|,\d)', sol):
            raise Fallo(f'{donde}: {escrito} no aparece en la solución')
        dato = _dato(man, clave)
        n = EJ.num(m.group(1))
        dec = len(m.group(1).split(',')[1]) if ',' in m.group(1) else 0
        paso = 0.5 * 10 ** -dec + 1e-9
        factor = r['valor'] / n if n else 1.0
        candidatos = [dato, dato / factor if factor else dato]
        if escrito.rstrip().endswith('%'):
            candidatos.append(dato * 100)       # a fraction in the data, a percentage in the text
        if not any(abs(x - n) <= paso for x in candidatos):
            raise Fallo(f'{donde}: {escrito} no es el dato {clave} = {dato} redondeado')
        r = dict(r)
        r['id'] = f'r{k}'
        r['nombre'] = EJ.marcado(nombre)
        r['texto'] = EJ.superindices(r.get('texto') or EJ.formatear(r['valor'], r['unidad']))
        r['alternativas'] = []
        out.append({k2: v for k2, v in r.items() if not k2.startswith('_')})
    return out


def _texto_solucion(parte, entrada):
    import ejercicios as EJ
    bl = parte['bloques']
    if entrada['tipo'] == 'ej':
        it = bl[entrada['pos'][0]]['items'][entrada['pos'][1]]
        return ' '.join(EJ.texto_bloques(it.get('solucion') or [], [])), ' '.join(EJ.texto_bloques(it['bloques'], []))
    h, pide, fin = entrada['pos']
    return ' '.join(EJ.texto_bloques(bl[pide + 1:fin], [])), ' '.join(EJ.texto_bloques(bl[h + 1:pide + 1], []))


_NUMS = re.compile(r'\d+(?:[\s\u00a0\u202f]\d{3})*(?:,\d+)?')
_OPERA = re.compile(r'[×/·+−√^()]')


def pistas_de_solucion(sol, escritos):
    """Up to two hints for an expansion's exercise, taken from its solution text: «Empiece por: X = <the substitution
    with the data>» and «Resultado intermedio: X = <value>», from the first clauses written as X = expression = value.
    Never a value that is one of the checked answers (`escritos`, as the manifest writes them); [] when the solution
    has no such clause."""
    import ejercicios as EJ
    respuestas = {_plano(m) for x in escritos for m in _NUMS.findall(x)}
    pistas = []
    intermedio = None
    for c in re.split(r'(?<=[.;:])\s+|,\s+(?=[^\d])', re.sub(r'\s+', ' ', sol).strip()):
        partes = [x.strip() for x in c.split('=')]
        if len(partes) < 3 or not partes[0] or len(partes[0]) > 40:
            continue
        sust, valor = partes[1], re.split(r',\s|;|\s+y\s|:', partes[2])[0].strip().rstrip('.')
        if not (re.search(r'\d', sust) and _OPERA.search(sust) and re.search(r'\d', valor)):
            continue
        if {_plano(m) for x in (sust, valor) for m in _NUMS.findall(x)} & respuestas:
            continue
        if not pistas:
            pistas.append(f'Empiece por: {partes[0]} = {sust}.')
        if intermedio is None:
            intermedio = f'Resultado intermedio: {partes[0]} = {valor}.'
            break
    if intermedio:
        pistas.append(intermedio)
    return [EJ.marcado(p) for p in pistas if len(p) <= 200]


def anotar_ejercicios(ruta=None):
    """Marks the expansions' exercises and problems in ejercicios.json and gives them their checked answers (or the
    «compare with the solution» mode); 0, or 1 with the problem printed. Idempotent."""
    ruta = ruta or libro_dir()
    reg_ruta = os.path.join(ruta, 'ampliaciones.json')
    ej_ruta = os.path.join(ruta, 'ejercicios.json')
    if not os.path.exists(ej_ruta):
        return 0
    doc = leer_json(ej_ruta)
    registro = leer_json(reg_ruta) if os.path.exists(reg_ruta) else None
    etiquetas = (registro or {}).get('etiquetas', {})
    try:
        mans = {m['id']: m for m in cargar_manifiestos()}
        for label, e in doc['items'].items():
            amp = etiquetas.get(label)
            if amp is None:
                e.pop('ampliacion', None)
                continue
            man = mans.get(amp)
            if man is None:
                continue
            e['ampliacion'] = amp
            curado = man.get('respuestas', {})
            if label not in curado:
                raise Fallo(f'{amp}: falta {label} en «respuestas» (una lista, vacía si se compara con la solución)')
            parte = leer_json(os.path.join(ruta, 'partes', e['parte'] + '.json'))
            sol, enun = _texto_solucion(parte, e)
            rs = respuestas_de(man, label, curado[label], sol)
            e['respuestas'] = rs
            e['origen'] = 'ampliacion'
            # hints from the expansion's own solution: its first substitution and its first intermediate result
            # that is not an answer (the parser's automatic hints are guesses; the expansions bring none)
            e['pistas'] = pistas_de_solucion(sol, [r[1] for r in curado[label]])
            if rs:
                e['modo'], e['clase'] = 'auto', 'numerico'
            else:
                e['modo'] = 'comparar'
                if e['clase'] == 'numerico':
                    e['clase'] = 'diseno' if e['tipo'] == 'prob' else (
                        'deduccion' if re.search(r'\b(deduce|demuestra|obtén la expresión)\b', enun, re.I) else 'texto')
        for m in mans.values():
            for label in m.get('respuestas', {}):
                if etiquetas.get(label) == m['id'] and label not in doc['items']:
                    raise Fallo(f'{m["id"]}: {label} no está en ejercicios.json')
    except (Fallo, ValueError, KeyError, IndexError) as err:
        print(f'ampliaciones (ejercicios): {err}')
        return 1
    n = sum(1 for e in doc['items'].values() if 'ampliacion' in e)
    escribir(ej_ruta, doc)
    if n:
        print(f'ampliaciones: {n} ejercicios y problemas de las ampliaciones marcados en ejercicios.json')
    return 0


# ------------------------------------------------------------------ phase «derivados»: netlists and review questions

def _validar_spice(textos):
    """{id: validation} of the expansions' netlists in the app's ngspice, with their own cache (never the book's)."""
    import spice
    tmp = tempfile.mkdtemp(dir=cache_dir())
    viejo_out, viejo_cache = spice.OUT, spice.CACHE
    try:
        for nid, t in textos.items():
            p = os.path.join(tmp, 'spice', nid + '.cir')
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, 'w', encoding='utf-8') as f:
                f.write(t)
        spice.OUT, spice.CACHE = tmp, os.path.join(cache_dir(), 'spice-validacion.json')
        return spice.validar(textos, False, False)
    finally:
        spice.OUT, spice.CACHE = viejo_out, viejo_cache
        shutil.rmtree(tmp, ignore_errors=True)


def fusionar_spice(ruta, registro, mans, validar=True):
    import spice
    sj = os.path.join(ruta, 'spice.json')
    if not os.path.exists(sj):
        return []
    doc = leer_json(sj)
    indice = leer_json(os.path.join(ruta, 'indice.json'))
    refs = leer_json(os.path.join(ruta, 'refs.json'))
    problemas = []
    # undo
    for nid in [n for n, e in doc['netlists'].items() if 'ampliacion' in e]:
        p = os.path.join(ruta, doc['netlists'][nid]['fichero'])
        if os.path.exists(p):
            os.remove(p)
            try:
                os.rmdir(os.path.dirname(p))
            except OSError:
                pass
        del doc['netlists'][nid]
    doc['capitulos'] = [c for c in doc['capitulos'] if 'ampliacion' not in c]
    for c in doc['capitulos']:
        c['netlists'] = [n for n in c['netlists'] if n in doc['netlists']]
    for k in list(doc['porRef']):
        doc['porRef'][k] = [n for n in doc['porRef'][k] if n in doc['netlists']]
        if not doc['porRef'][k]:
            del doc['porRef'][k]
    for e in doc['netlists'].values():
        if 'refs_libro' in e:
            v = e.pop('refs_libro')
            e['ref'], e['refs'] = v['ref'], v['refs']
    if 'porRef_libro' in doc:
        doc['porRef'] = doc.pop('porRef_libro')
    # a netlist of the book about a retired run (pieces «retirar») keeps its id (its saved state, the live figure's
    # layout) and is shown where that content went: «refs_libro» and «porRef_libro» keep the book's
    alias = _alias_retiradas((registro or {}).get('retiradas', []))
    movidas = [(nid, e) for nid, e in doc['netlists'].items() if any(r in alias for r in e['refs'])]
    if movidas:
        doc['porRef_libro'] = json.loads(json.dumps(doc['porRef']))
        for nid, e in movidas:
            e['refs_libro'] = {'ref': e['ref'], 'refs': list(e['refs'])}
            nuevo = lambda r, nid=nid: _destino_retirada(alias[r], [nid]) if r in alias else r  # noqa: E731
            for r in e['refs']:
                if nid in doc['porRef'].get(r, []):
                    doc['porRef'][r].remove(nid)
                    if not doc['porRef'][r]:
                        del doc['porRef'][r]
                    lista = doc['porRef'].setdefault(nuevo(r), [])
                    if nid not in lista:
                        lista.append(nid)
            e['refs'] = list(dict.fromkeys(nuevo(r) for r in e['refs']))
            e['ref'] = nuevo(e['ref']) if e['ref'] else e['ref']
    añadidos = []
    if registro:
        huellas = {}
        for nid, e in doc['netlists'].items():
            p = os.path.join(ruta, e['fichero'])
            if os.path.exists(p):
                huellas[hashlib.sha256(open(p, 'rb').read()).hexdigest()] = nid
        en_partes = set()
        for f in os.listdir(os.path.join(ruta, 'partes')):
            for d in recorrer(leer_json(os.path.join(ruta, 'partes', f))):
                if isinstance(d.get('label'), str):
                    en_partes.add(d['label'])
        textos = {}
        for m in mans:
            info = next((i for i in registro['ampliaciones'] if i['id'] == m['id']), None)
            if info is None or not info['etiquetas']:
                continue
            defecto = info['partes'][0] if info['partes'] else None
            for nombre, s in m.get('spice', {}).items():
                stem = s.get('parte', defecto)
                origen = os.path.join(m['_dir'], 'spice', nombre + '.cir')
                raw = open(origen, 'rb').read()
                h = hashlib.sha256(raw).hexdigest()
                nid = f'{stem}/{nombre}'
                if h in huellas:
                    problemas.append(f'{m["id"]}: el libro ya trae la netlist {nombre} ({huellas[h]}); se queda la del libro')
                    continue
                if nid in doc['netlists']:
                    raise Fallo(f'{m["id"]}: la netlist {nid} choca con una del libro')
                rs = [r for r in s['refs'] if r in refs]
                if len(rs) != len(s['refs']):
                    problemas.append(f'{m["id"]}: {nombre}: referencias sin destino {sorted(set(s["refs"]) - set(rs))}')
                texto = raw.decode('utf-8')
                control, analisis = spice.analizar(texto)
                doc['netlists'][nid] = {
                    'fichero': f'spice/{stem}/{nombre}.cir', 'parte': stem, 'nombre': nombre, 'titulo': s['titulo'],
                    'ref': rs[0] if rs else None, 'refs': rs, 'descripcion': s['descripcion'], 'analisis': analisis,
                    'control': control, 'parametros': spice.parametros(texto), 'xspice': spice.usa_xspice(texto),
                    'ampliacion': m['id']}
                os.makedirs(os.path.join(ruta, 'spice', stem), exist_ok=True)
                destino = os.path.join(ruta, 'spice', stem, nombre + '.cir')
                with open(destino, 'wb') as f:
                    f.write(raw)
                textos[nid] = texto
                añadidos.append(nid)
        val = _validar_spice(textos) if (validar and textos) else None
        motor_xspice = spice.motor_app()['xspice']
        for nid in añadidos:
            n = doc['netlists'][nid]
            n['motor'] = spice.resumen_motor((val or {}).get(nid) if val is not None else None, n.pop('xspice'),
                                             motor_xspice)
            if n['motor']['estado'] not in ('ok', 'sin-validar'):
                problemas.append(f'{nid}: el motor da «{n["motor"]["estado"]}» {n["motor"].get("errores", "")}')
            for r in n['refs']:
                if r in en_partes:
                    doc['porRef'].setdefault(r, []).append(nid)
        por_parte = {}
        for nid in añadidos:
            por_parte.setdefault(doc['netlists'][nid]['parte'], []).append(nid)

        def clave(nid):
            r = refs.get(doc['netlists'][nid]['ref'] or '')
            num = [int(x) if x.isdigit() else ord(x) for x in re.split(r'[.]', r['num'])] if r else []
            return (0 if r else 1, num, spice.natural(nid))
        for stem, ids in por_parte.items():
            ids.sort(key=clave)
            cap = next((c for c in doc['capitulos'] if c['parte'] == stem), None)
            if cap is None:
                cap = {'parte': stem, 'netlists': [], 'ampliacion': registro['etiquetas'].get(
                    indice['partes'][stem].get('label'), True)}
                doc['capitulos'].append(cap)
            cap['netlists'] += ids
    # chapters in reading order, with the index's numbers (they shift with a new chapter)
    orden = [p for t in indice['tomos'] for p in t['partes']]
    doc['capitulos'].sort(key=lambda c: orden.index(c['parte']) if c['parte'] in orden else len(orden))
    for c in doc['capitulos']:
        info = indice['partes'].get(c['parte'], {})
        nuevo = {'parte': c['parte'], 'tipo': info.get('tipo', 'capitulo'), 'num': info.get('num'),
                 'titulo': info.get('titulo', c['parte']), 'color': info.get('color'), 'tomo': info.get('tomo'),
                 'netlists': c['netlists']}
        if 'ampliacion' in c:
            nuevo['ampliacion'] = c['ampliacion']
        c.clear()
        c.update(nuevo)
    doc['total'] = len(doc['netlists'])
    escribir(sj, doc)
    escribir(os.path.join(ruta, 'spice-refs.json'), doc['porRef'])
    if añadidos:
        print(f'ampliaciones: {len(añadidos)} netlists en spice.json')
    return problemas


def fusionar_repaso(ruta, registro, mans):
    import repaso
    carpeta = os.path.join(ruta, 'repaso')
    if not os.path.isdir(carpeta):
        return []
    indice = leer_json(os.path.join(ruta, 'indice.json'))
    refs = leer_json(os.path.join(ruta, 'refs.json'))
    partes = {}
    for f in sorted(os.listdir(carpeta)):
        if f.endswith('.json') and f != 'indice.json':
            partes[f[:-5]] = leer_json(os.path.join(carpeta, f))
    # undo
    for stem in list(partes):
        d = partes[stem]
        antes = len(d['preguntas'])
        d['preguntas'] = [q for q in d['preguntas'] if 'ampliacion' not in q]
        for q in d['preguntas']:
            if 'ref_libro' in q:
                q['ref'] = q.pop('ref_libro')
        if antes and not d['preguntas']:
            del partes[stem]
            os.remove(os.path.join(carpeta, stem + '.json'))
    # the book's questions again from their sources (contenido/repaso/), exactly as repaso.py writes them: their texts
    # and printed numbers follow the renumbered sources and refs.json. Only the check of the quote against the book's
    # Typst is left out (the sources are not here; generar.py has just run repaso.py, which does check it).
    fuentes = os.path.join(os.environ.get('EPA_CURADAS') or HERE, 'repaso')
    if os.path.isdir(fuentes):
        tmp = tempfile.mkdtemp(dir=cache_dir())
        viejo = repaso.LIB
        try:
            repaso.LIB = tmp
            for stem in list(partes):
                src = os.path.join(fuentes, stem + '.json')
                if not os.path.exists(src):
                    continue
                with open(os.path.join(tmp, stem + '.typ'), 'w', encoding='utf-8'):
                    pass
                # (a label an expansion retired is still the book's own for the book's questions)
                refs_libro = {k: (e.get('libro') or e) if 'retirada' in e else e for k, e in refs.items()}
                err, salida = repaso.validar_parte(stem, leer_json(src), indice, refs_libro, set())
                err = [e for e in err if 'la cita no está' not in e and 'no aparece en' not in e]
                if err:
                    raise Fallo('repaso del libro: ' + '; '.join(err[:5]))
                partes[stem] = salida
        finally:
            repaso.LIB = viejo
            shutil.rmtree(tmp, ignore_errors=True)
    problemas = []
    # a question of the book about a retired run (pieces «retirar») keeps its id, so its review history goes on, and
    # points to where that content went (its id in «destinos», else the destination): «ref_libro» keeps the book's
    alias = _alias_retiradas((registro or {}).get('retiradas', []))
    for d in partes.values():
        for q in d['preguntas']:
            if q.get('ref') in alias:
                q['ref_libro'] = q['ref']
                q['ref'] = _destino_retirada(alias[q['ref']], [q['id']])
    if registro:
        ids = {q['id'] for d in partes.values() for q in d['preguntas']}
        for m in mans:
            if not m.get('repaso') or registro['etiquetas'] == {}:
                continue
            datos = leer_json(os.path.join(m['_dir'], m['repaso']))
            stem = datos['parte']
            info = next((x for x in registro['ampliaciones'] if x['id'] == m['id']), None)
            if info is None or not info['etiquetas']:
                continue

            def del_libro(q):
                # a question about what the expansion adds to a section of the book (P08 extends 0.12): its reference
                # is the book's own section
                r = refs.get(q.get('ref'))
                return r is not None and 'ampliacion' not in r and 'retirada' not in r and r['parte'] == stem \
                    and r['parte'] in info['partes']
            nuevas = [q for q in datos['preguntas'] if registro['etiquetas'].get(q.get('ref')) == m['id'] or del_libro(q)]
            ya = [q['id'] for q in nuevas if q['id'] in ids]
            if ya:
                problemas.append(f'{m["id"]}: el repaso del libro ya tiene {", ".join(ya)}; se quedan las del libro')
            nuevas = [q for q in nuevas if q['id'] not in ids]
            if not nuevas:
                continue
            # repaso.py's own checks, against the expansion's Typst (the book's source does not have it yet); a question
            # whose reference is a section of the book is checked against the expansion's text under that section's
            # label (what it adds there)
            with open(os.path.join(m['_dir'], m.get('fuente', m['id'] + '.typ')), encoding='utf-8') as f:
                # (without its comment lines: an expansion's header names labels, «<sec-…>», that repaso.py would take
                # for where they are defined)
                typ = re.sub(r'(?m)^[ \t]*//.*$', '', f.read())
            grupos = {}
            for q in nuevas:
                grupos.setdefault(q['ref'] if del_libro(q) else None, []).append(q)
            salida = {'preguntas': []}
            for lab, qs in grupos.items():
                tmp = tempfile.mkdtemp(dir=cache_dir())
                viejo = repaso.LIB
                try:
                    with open(os.path.join(tmp, stem + '.typ'), 'w', encoding='utf-8') as f:
                        f.write((f'== {lab} <{lab}>\n\n' if lab else '') + typ)
                    repaso.LIB = tmp
                    err, s = repaso.validar_parte(stem, {'parte': stem, 'preguntas': qs}, indice, refs, set(ids))
                finally:
                    repaso.LIB = viejo
                    shutil.rmtree(tmp, ignore_errors=True)
                err = [e for e in err if 'preguntas (deben ser' not in e
                       and not (re.search(r'id no válido', e) and re.search(rf'{re.escape(stem)}-\d+\b', e))]
                if err:
                    raise Fallo(f'{m["id"]}: repaso: ' + '; '.join(err))
                salida['preguntas'] += s['preguntas']
            orden_q = {q['id']: k for k, q in enumerate(nuevas)}
            salida['preguntas'].sort(key=lambda q: orden_q[q['id']])
            for q in salida['preguntas']:
                q['ampliacion'] = m['id']
            partes.setdefault(stem, {'parte': stem, 'preguntas': []})['preguntas'] += salida['preguntas']
            ids |= {q['id'] for q in nuevas}
    # the printed number of each reference (it shifts with an expansion) and the index, as repaso.py writes them
    for d in partes.values():
        for q in d['preguntas']:
            r = refs.get(q.get('ref'))
            if r is not None and q.get('ref_num') is not None:
                q['ref_num'] = r['num']
        escribir(os.path.join(carpeta, d['parte'] + '.json'), d)
    orden = [p for t in indice['tomos'] for p in t['partes']]
    orden += [p for p in indice['partes'] if p not in orden]
    lista = []
    for stem in [p for p in orden if p in partes]:
        info = indice['partes'][stem]
        qs = partes[stem]['preguntas']
        e = {'parte': stem, 'tipo': info['tipo'], 'num': info.get('num'), 'titulo': info['titulo'],
             'tomo': info.get('tomo'), 'color': info.get('color'), 'preguntas': len(qs),
             'numericas': sum(1 for q in qs if q['tipo'] == 'numero')}
        n = sum(1 for q in qs if 'ampliacion' in q)
        if n:
            e['ampliacion'] = n
        lista.append(e)
    escribir(os.path.join(carpeta, 'indice.json'),
             {'version': 1, 'total': sum(p['preguntas'] for p in lista), 'partes': lista})
    return problemas


def ajustar_formulas(ruta):
    """formulas.json carries printed numbers (chapter, section, the reference of each explanation and, in the
    explanations' text, «sección 31.8»…). formulas.py needs the book's sources: without them (here) it cannot run again,
    so the numbers are set from refs.json and indice.json; with them, generar.py has just written it from the merged
    book and this only checks it."""
    fr = os.path.join(ruta, 'formulas.json')
    if not os.path.exists(fr):
        return False
    refs = leer_json(os.path.join(ruta, 'refs.json'))
    indice = leer_json(os.path.join(ruta, 'indice.json'))
    doc = leer_json(fr)
    for f in doc.get('formulas', []):
        info = indice['partes'].get(f.get('parte'))
        if info and info.get('num') is not None and 'cap' in f:
            f['cap'] = info['num']
    for d in recorrer(doc):
        lab = d.get('label') if 'num' in d else None
        if isinstance(lab, str) and lab in refs and d.get('num') is not None:
            d['num'] = refs[lab]['num']
        if 'ref_num' in d and d.get('ref') in refs and d['ref_num'] is not None:
            d['ref_num'] = refs[d['ref']]['num']
    escribir(fr, doc)
    regenerado = os.path.isdir(os.path.join(V3, 'libro'))
    return renumerar_derivado(fr, refs, 'web/public/libro/formulas.json', regenerado)


def fase_derivados(ruta=None, solo_deshacer=False, validar=True):
    ruta = ruta or libro_dir()
    os.makedirs(cache_dir(), exist_ok=True)
    reg = os.path.join(ruta, 'ampliaciones.json')
    registro = None if solo_deshacer or not os.path.exists(reg) else leer_json(reg)
    try:
        mans = cargar_manifiestos()
        problemas = fusionar_spice(ruta, registro, mans, validar)
        problemas += fusionar_repaso(ruta, registro, mans)
    except Fallo as e:
        print(f'ampliaciones: {e}')
        return 1
    for p in problemas:
        print('  ' + p)
    if not solo_deshacer and anotar_ejercicios(ruta):
        return 1
    ajustar_formulas(ruta)
    errores = [p for p in problemas if 'se queda' not in p]
    return 1 if errores else 0


if __name__ == '__main__':
    sys.exit(main())
