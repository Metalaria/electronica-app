"""Conversion of the parsed Typst tree into the app's JSON blocks (see ESQUEMA.md).

References and inline equations are written as placeholders while converting, because their final text
(the number of a label in a later chapter, the size of an equation not rendered yet) is only known at the
end; `resolve()` replaces them once everything has been collected.
"""
import html as htmlmod
import re
from collections import Counter

from typst_parser import (Text, Space, Linebreak, Parbreak, Strong, Emph, Raw, Math, Label, Ref, Heading,
                          ListItem, Content, Call, Code, Str, Num, Ident, Array, Unknown)

# placeholders inside html strings: R<key> (reference number), E<hash> (inline math)
PH = re.compile('([RE])([^]*)')

BOXES = ('nota', 'importante', 'precaucion', 'ejemplo', 'comprobacion')
PART_HEADS = ('capitulo', 'apendice', 'glosario', 'creditos', 'prelim')
BLOCK_CALLS = set(BOXES) | set(PART_HEADS) | {
    'heading', 'figura', 'tabla', 'ec', 'formula', 'formula-texto', 'eclabel', 'deduccion', 'tarjeta', 'codigo',
    'centrado', 'ejercicios', 'soluciones', 'ejercicio', 'solucion', 'cap-erratas', 'ap-erratas'}
# statements the pipeline skips on purpose: imports, local style rules and the helper functions that
# novedades.typ and apJ.typ define (caps, cap-erratas, ap-erratas are implemented natively here)
KNOWN_CODE = {('import', None), ('set', None), ('let', 'caps'), ('let', 'cap-erratas'), ('let', 'ap-erratas')}


def esc(s):
    return htmlmod.escape(s, quote=False)


def strip_tags(h):
    return htmlmod.unescape(re.sub(r'<[^>]+>', '', h))


class Libro:
    """State shared by all parts: labels, problems, equations, figures and statistics."""

    def __init__(self, ecuaciones, figuras):
        self.refs = {}              # label -> {num, parte, tipo}
        self.problems = []          # (parte, line, message, sample)
        self.ec = ecuaciones        # equation registry (ecuaciones.Registro)
        self.fig = figuras          # figure registry (figuras.Registro)
        self.stats = Counter()      # converted constructs
        self.ignored = Counter()    # skipped code statements
        self.ref_keys = Counter()   # keys cited with #nr / #caps / #ver

    def problem(self, ctx, line, msg, sample=''):
        self.problems.append((ctx.stem if ctx else '', line, msg, sample[:160]))

    def add_ref(self, ctx, label, num, tipo, line=0):
        if label in self.refs:
            self.problem(ctx, line, f'etiqueta duplicada {label}')
        self.refs[label] = {'num': num, 'parte': ctx.stem, 'tipo': tipo}


class Parte:
    """Conversion context of one source file."""

    def __init__(self, libro, stem, tipo, num):
        self.libro = libro
        self.stem = stem
        self.tipo = tipo            # capitulo | apendice | glosario | anexo
        self.c = num                # printed chapter number or appendix letter (None for back matter)
        self.numbered = tipo in ('capitulo', 'apendice')
        self.sec = self.sub = self.fig = self.tab = self.ej = 0
        self.titulo = None
        self.label = None
        self.color = None
        self.unnumbered_h2 = 0
        self.subnum_value = None
        self.ver = None             # keys collected by #ver in the current paragraph
        self.pending_eclabel = None
        self.solutions = {}         # exercise label -> blocks
        self.exercises = []         # exercise items, to receive their solutions

    def problem(self, line, msg, sample=''):
        self.libro.problem(self, line, msg, sample)

    # ------------------------------------------------------------------ inline
    def ref(self, key):
        self.libro.ref_keys[key] += 1
        return f'<a class="ref" data-ref="{esc(key)}">R{key}</a>'

    def inline(self, nodes, cell=False):
        out = []

        def space():
            if out and not out[-1].endswith((' ', '<br>')):
                out.append(' ')

        for n in nodes:
            t = type(n)
            if t is Text:
                out.append(esc(n.s))
            elif t is Space:
                space()
            elif t is Linebreak:
                if out and out[-1] == ' ':
                    out.pop()
                out.append('<br>')
            elif t is Strong:
                out.append('<strong>' + self.inline(n.children, cell) + '</strong>')
            elif t is Emph:
                out.append('<em>' + self.inline(n.children, cell) + '</em>')
            elif t is Raw:
                if n.block:
                    self.problem(0, 'bloque raw dentro de un párrafo', n.text[:60])
                out.append('<code>' + esc(n.text) + '</code>')
            elif t is Math:
                out.append(self.inline_math(n))
            elif t is Call:
                out.append(self.inline_call(n, cell))
            elif t is Code:
                self.code(n)
            elif t is Label:
                self.problem(0, f'etiqueta <{n.name}> dentro de un párrafo')
            elif t is Ref:
                out.append(self.ref(n.name))
            elif t is Parbreak and cell:
                if out and out[-1] == ' ':
                    out.pop()
                out.append('<br>')
            elif t is ListItem and cell:
                if out:
                    out.append('<br>')
                out.append('• ' + self.inline(n.children, cell))
            elif t is Heading and cell:
                out.append('<strong>' + self.inline(n.children, cell) + '</strong>')
            else:
                self.problem(getattr(n, 'line', 0), f'elemento {t.__name__} no admitido en línea')
        return ''.join(out).strip()

    def inline_math(self, m):
        self.libro.stats['ec-inline'] += 1
        h = self.libro.ec.request('inline', '$' + m.src + '$')
        alt = htmlmod.escape(m.src.strip(), quote=True)
        return f'<img class="m" src="ec/{h}.svg" alt="{alt}" E{h}>'

    def content_arg(self, call, k=0):
        if call.pos is None or len(call.pos) <= k:
            self.problem(call.line, f'#{call.name} sin argumento de contenido', call.src[:80])
            return []
        v = call.pos[k]
        if isinstance(v, Content):
            return v.children
        if isinstance(v, Str):
            return [Text(v.value)]
        self.problem(call.line, f'#{call.name}: argumento inesperado', call.src[:80])
        return []

    def inline_call(self, c, cell=False):
        name = c.name
        self.libro.stats['#' + name] += 1
        if name in ('strong', 'emph', 'sub', 'super'):
            tag = {'strong': 'strong', 'emph': 'em', 'sub': 'sub', 'super': 'sup'}[name]
            return f'<{tag}>' + self.inline(self.content_arg(c), cell) + f'</{tag}>'
        if name == 'raw':
            v = c.pos[0] if c.pos else None
            if isinstance(v, Str):
                return '<code>' + esc(v.value) + '</code>'
        if name == 'nr' and c.pos and isinstance(c.pos[0], Str):
            return self.ref(c.pos[0].value)
        if name == 'caps' and c.pos:
            keys = []
            for v in c.pos:
                if isinstance(v, Num):
                    keys.append(self.ref('cap-' + str(int(v.value))))
                else:
                    self.problem(c.line, '#caps con argumento no numérico', c.src)
            return ', '.join(keys)
        if name == 'subnum':
            if self.subnum_value is None:
                self.problem(c.line, '#subnum fuera de un título')
                return ''
            return esc(self.subnum_value)
        if name == 'ver' and c.pos:
            if self.ver is None:
                self.problem(c.line, '#ver fuera del glosario', c.src)
                self.ver = []
            for v in c.pos:
                if isinstance(v, Str):
                    self.ver.append(v.value)
                    self.libro.ref_keys[v.value] += 1
            return ''
        if name in BLOCK_CALLS:
            if cell:
                bl = self.block_call(c)
                return '<br>'.join(flatten_html(b) for b in bl)
            self.problem(c.line, f'#{name} dentro de un párrafo', c.src[:80])
            return ''
        self.problem(c.line, f'función #{name} no reconocida', c.src[:100])
        # keep any content the call carries so nothing is lost
        parts = [self.inline(v.children, cell) for v in (c.pos or []) if isinstance(v, Content)]
        return ' '.join(parts)

    def code(self, n):
        m = re.match(r'#(\w+)\s+([A-Za-z_][\w-]*)?', n.src)
        key = (n.keyword, m.group(2) if n.keyword == 'let' and m else None)
        if key in KNOWN_CODE:
            self.libro.ignored[f'#{n.keyword}' + (f' {key[1]}' if key[1] else '')] += 1
        else:
            self.problem(n.line, f'instrucción #{n.keyword} no admitida', n.src[:100])

    # ------------------------------------------------------------------ blocks
    def blocks(self, nodes):
        out = []
        para = []
        state = {'target': None}       # last block that a following <label> belongs to

        def flush():
            if any(not isinstance(n, (Space, Parbreak)) for n in para):
                self.ver = [] if self.tipo == 'glosario' else None
                h = self.inline(para)
                if h or self.ver:
                    b = {'t': 'p', 'html': h}
                    if self.ver:
                        b['_ver'] = self.ver
                    self.emit(out, b)
                self.ver = None
                state['target'] = None
            para.clear()

        for n in nodes:
            t = type(n)
            if t is Parbreak:
                flush()
            elif t is Heading:
                flush()
                b = self.heading(n.level, n.children, n.line)
                if b:
                    self.emit(out, b)
                state['target'] = None
            elif t is ListItem:
                flush()
                self.list_item(out, n)
                state['target'] = None
            elif t is Call and n.name in BLOCK_CALLS:
                flush()
                bl = self.block_call(n)
                for b in bl:
                    self.emit(out, b)
                state['target'] = bl[-1] if bl else ('part' if n.name in PART_HEADS else None)
            elif t is Math and n.display:
                flush()
                self.emit(out, self.ec_block(n.src.strip(), '$' + n.src + '$', 'display'))
                state['target'] = None
            elif t is Raw and n.block:
                flush()
                self.emit(out, {'t': 'codigo', 'lenguaje': n.lang, 'texto': n.text})
                state['target'] = None
            elif t is Label:
                if any(not isinstance(x, (Space, Parbreak)) for x in para):
                    self.problem(0, f'etiqueta <{n.name}> dentro de un párrafo')
                    continue
                self.attach_label(state['target'], n.name)
                state['target'] = None
            elif t is Code:
                self.code(n)
            else:
                para.append(n)
        flush()
        if self.pending_eclabel is not None:
            self.problem(0, '#eclabel sin ecuación detrás')
            out.append({'t': 'p', 'html': self.pending_eclabel})
            self.pending_eclabel = None
        return out

    def emit(self, out, b):
        if self.pending_eclabel is not None and b['t'] != 'ec':
            self.problem(0, '#eclabel no seguido de #ec')
            out.append({'t': 'p', 'html': self.pending_eclabel})
            self.pending_eclabel = None
        if b['t'] == 'ec' and self.pending_eclabel is not None:
            b['etiqueta'] = self.pending_eclabel
            self.pending_eclabel = None
        out.append(b)
        self.libro.stats['bloque ' + b['t']] += 1

    def attach_label(self, target, name):
        if target == 'part':
            self.label = name
            self.libro.add_ref(self, name, self.c, 'cap' if self.tipo == 'capitulo' else 'ap')
            return
        if not isinstance(target, dict) or target.get('label'):
            self.problem(0, f'etiqueta <{name}> sin objeto al que pertenecer')
            return
        target['label'] = name
        tipo = {'figura': 'fig', 'tabla': 'tab'}.get(target['t'])
        if tipo and target.get('num'):
            self.libro.add_ref(self, name, target['num'], tipo)
        else:
            self.problem(0, f'etiqueta <{name}> en un bloque {target["t"]} sin número')

    def list_item(self, out, n):
        nivel = 0 if n.indent == 0 else 1
        ordered = n.kind != '-'
        html = self.inline(n.children)
        last = out[-1] if out else None
        if last is not None and last['t'] == 'lista' and last['ordenada'] == ordered \
                and last.get('nivel', 0) == nivel:
            last['items'].append(html)
            return
        b = {'t': 'lista', 'ordenada': ordered, 'items': [html]}
        if nivel:
            b['nivel'] = nivel
        if n.kind == 'n' and n.number != 1:
            b['inicio'] = n.number
        self.emit(out, b)

    def split_label(self, children):
        """Heading children without the trailing label, and that label."""
        ch = list(children)
        while ch and isinstance(ch[-1], Space):
            ch.pop()
        label = None
        if ch and isinstance(ch[-1], Label):
            label = ch.pop().name
        return ch, label

    def heading(self, level, children, line, numbered=True):
        ch, label = self.split_label(children)
        if level == 2:
            if self.numbered and numbered:
                self.sec += 1
                self.sub = 0
                num = f'{self.c}.{self.sec}'
                if label:
                    self.libro.add_ref(self, label, num, 'sec')
                else:
                    self.problem(line, 'sección numerada sin etiqueta')
                    label = f'{self.stem}-s{self.sec}'
                return {'t': 'h2', 'num': num, 'label': label, 'html': self.inline(ch)}
            if label:
                self.problem(line, f'etiqueta <{label}> en una sección sin número')
            self.unnumbered_h2 += 1
            return {'t': 'h2', 'num': None, 'label': f'{self.stem}-{self.unnumbered_h2}', 'html': self.inline(ch)}
        if level == 3:
            core = [x for x in ch if not isinstance(x, Space)]
            b = {'t': 'h3'}
            if core and isinstance(core[0], Call) and core[0].name == 'subnum':
                self.sub += 1
                num = f'{self.c}.{self.sec}.{self.sub}'
                self.subnum_value = num
                i = ch.index(core[0])
                html = self.inline(ch[i + 1:])
                self.libro.stats['#subnum'] += 1
                self.subnum_value = None
                b.update(num=num, html=html)
                if label:
                    self.libro.add_ref(self, label, num, 'subsec')
            else:
                b['html'] = self.inline(ch)
                if label:
                    if label.startswith('prob-'):
                        self.libro.add_ref(self, label, f'{self.c}.{label.split(".")[-1]}', 'prob')
                    else:
                        self.problem(line, f'etiqueta <{label}> en un título de nivel 3')
            if label:
                b['label'] = label
            return b
        if level == 4:
            if label:
                self.problem(line, f'etiqueta <{label}> en un título de nivel 4')
            return {'t': 'h4', 'html': self.inline(ch)}
        self.problem(line, f'título de nivel {level} no admitido', strip_tags(self.inline(ch)))
        return {'t': 'h4', 'html': self.inline(ch)}

    # ------------------------------------------------------------------ block calls
    def block_call(self, c):
        name = c.name
        self.libro.stats['#' + name] += 1
        f = getattr(self, 'b_' + name.replace('-', '_'), None)
        if f is None:
            self.problem(c.line, f'bloque #{name} no implementado')
            return []
        try:
            return f(c)
        except (IndexError, AttributeError, TypeError, ValueError) as e:
            self.problem(c.line, f'#{name} con argumentos inesperados ({e})', c.src[:120])
            return []

    # part headings
    def b_capitulo(self, c):
        self.color = c.pos[0].value
        self.titulo = strip_tags(self.inline(self.content_arg(c, 1)))
        return []

    def b_apendice(self, c):
        self.color = '1A3A5C'
        self.titulo = strip_tags(self.inline(self.content_arg(c, 1)))
        return []

    def b_glosario(self, c):
        self.color = '8A1F3D'
        self.titulo = strip_tags(self.inline(self.content_arg(c)))
        return []

    def b_creditos(self, c):
        self.color = '1A3A5C'
        self.titulo = strip_tags(self.inline(self.content_arg(c)))
        return []

    def b_prelim(self, c):
        if self.titulo is None:
            self.color = '1A3A5C'
            self.titulo = strip_tags(self.inline(self.content_arg(c)))
            return []
        # a second front-matter heading inside the same file becomes an unnumbered section
        return [self.heading(2, self.content_arg(c), c.line, numbered=False)]

    def b_heading(self, c):
        level = int(c.named['level'].value) if 'level' in c.named else 1
        numbered = not (isinstance(c.named.get('numbering'), Ident) and c.named['numbering'].name == 'none')
        if numbered:
            self.problem(c.line, '#heading numerado')
        return [self.heading(level, self.content_arg(c), c.line, numbered=numbered)]

    def b_cap_erratas(self, c):
        key = c.pos[0].value
        n = int(key.split('-')[1])
        h = 'Capítulo ' + self.ref(key) + ' — ' + self.inline(self.content_arg(c, 1))
        if n >= 15:
            h += f' <span class="nota-ed">(capítulo {n} en la 2.3)</span>'
        return [{'t': 'h4', 'html': h}]

    def b_ap_erratas(self, c):
        key = c.pos[0].value
        return [{'t': 'h4', 'html': 'Apéndice ' + self.ref(key) + ' — ' + self.inline(self.content_arg(c, 1))}]

    # boxes
    def caja(self, c):
        return [{'t': 'caja', 'tipo': c.name, 'bloques': self.blocks(self.content_arg(c))}]

    b_nota = b_importante = b_precaucion = b_ejemplo = b_comprobacion = caja

    def b_deduccion(self, c):
        return [{'t': 'deduccion', 'titulo': self.inline(self.content_arg(c, 0)),
                 'bloques': self.blocks(self.content_arg(c, 1))}]

    def b_tarjeta(self, c):
        return [{'t': 'tarjeta', 'bloques': self.blocks(self.content_arg(c))}]

    def b_centrado(self, c):
        return [{'t': 'centrado', 'html': self.inline(self.content_arg(c), cell=True)}]

    def b_codigo(self, c):
        raws = [x for x in self.content_arg(c) if isinstance(x, Raw)]
        others = [x for x in self.content_arg(c) if not isinstance(x, (Raw, Space, Parbreak))]
        if len(raws) != 1 or others:
            self.problem(c.line, '#codigo sin un único bloque raw', c.src[:80])
        if not raws:
            return []
        return [{'t': 'codigo', 'lenguaje': raws[0].lang, 'texto': raws[0].text}]

    # equations
    def ec_block(self, fuente, src, kind):
        h = self.libro.ec.request(kind, src)
        self.libro.stats['ec-' + kind] += 1
        return {'t': 'ec', 'svg': f'ec/{h}.svg', '_h': h, 'fuente': fuente}

    def b_ec(self, c):
        ch = self.content_arg(c)
        maths = [x for x in ch if isinstance(x, Math)]
        others = [x for x in ch if not isinstance(x, (Math, Space, Parbreak))]
        src = c.pos[0].src
        if len(maths) == 1 and not others:
            return [self.ec_block(maths[0].src.strip(), src, 'display')]
        self.problem(c.line, '#ec con contenido que no es una sola fórmula', src[:80])
        return [self.ec_block(strip_tags(self.inline(ch)), src, 'texto')]

    def b_formula(self, c):
        m = c.pos[0]
        if isinstance(m, Content):
            # a formula card line written as text (cap16): rendered like #formula-texto
            return [self.ec_block(strip_tags(self.inline(m.children)), m.src, 'texto')]
        if not isinstance(m, Math):
            raise ValueError('se esperaba una fórmula')
        return [self.ec_block(m.src.strip(), '$' + m.src + '$', 'display')]

    def b_formula_texto(self, c):
        ch = self.content_arg(c)
        return [self.ec_block(strip_tags(self.inline(ch)), c.pos[0].src, 'texto')]

    def b_eclabel(self, c):
        if self.pending_eclabel is not None:
            self.problem(c.line, '#eclabel seguido de otro #eclabel')
        self.pending_eclabel = self.inline(self.content_arg(c))
        return []

    # figures and tables
    def b_figura(self, c):
        fname = c.pos[0].value
        w = c.pos[1]
        if not (isinstance(w, Num) and w.unit == '%'):
            self.problem(c.line, f'anchura de figura no porcentual: {getattr(w, "src", w)}')
            ancho = 1.0
        else:
            ancho = round(w.value / 100, 3)
        self.fig += 1
        cred = c.named.get('credito')
        return [{'t': 'figura', 'src': self.libro.fig.request(fname), 'num': f'{self.c}.{self.fig}',
                 'ancho': ancho, 'pie': self.inline(self.content_arg(c, 2)),
                 'credito': self.inline(cred.children) if isinstance(cred, Content) else None}]

    def b_tabla(self, c):
        cap = c.pos[0]
        cells = c.pos[1:]
        cols_v = c.named.get('columns')
        if isinstance(cols_v, Array):
            cols = len(cols_v.items)
        elif isinstance(cols_v, Num):
            cols = int(cols_v.value)
        else:
            raise ValueError('columns')
        al_v = c.named.get('align')
        if isinstance(al_v, Array):
            align = [x.name if isinstance(x, Ident) else 'left' for x in al_v.items]
        elif isinstance(al_v, Ident):
            align = [al_v.name] * cols
        else:
            align = []
        align = (align + ['left'] * cols)[:cols]
        for a in align:
            if a not in ('left', 'center', 'right'):
                self.problem(c.line, f'alineación de columna «{a}»')
        html_cells = []
        for v in cells:
            if isinstance(v, Content):
                html_cells.append(self.inline(v.children, cell=True))
            else:
                self.problem(c.line, 'celda de tabla que no es contenido', getattr(v, 'src', str(v))[:60])
                html_cells.append('')
        if len(html_cells) % cols:
            self.problem(c.line, f'tabla con {len(html_cells)} celdas para {cols} columnas')
        filas = [html_cells[k:k + cols] for k in range(0, len(html_cells), cols)]
        num = pie = None
        if isinstance(cap, Content):
            self.tab += 1
            num = f'{self.c}.{self.tab}'
            pie = self.inline(cap.children)
        elif not (isinstance(cap, Ident) and cap.name == 'none'):
            self.problem(c.line, 'título de tabla no reconocido')
        return [{'t': 'tabla', 'num': num, 'pie': pie, 'cols': cols, 'align': align, 'cabecera': True,
                 'filas': filas}]

    # exercises
    def b_ejercicios(self, c):
        items = []
        current = None
        for n in self.content_arg(c):
            if isinstance(n, Call) and n.name == 'ejercicio':
                self.libro.stats['#ejercicio'] += 1
                self.ej += 1
                current = {'label': None, 'num': f'{self.c}.{self.ej}',
                           'bloques': self.blocks(self.content_arg(n)), 'solucion': None}
                items.append(current)
            elif isinstance(n, Label):
                if current is None or current['label']:
                    self.problem(0, f'etiqueta <{n.name}> suelta en #ejercicios')
                    continue
                current['label'] = n.name
                self.libro.add_ref(self, n.name, current['num'], 'ej')
            elif isinstance(n, (Space, Parbreak)):
                continue
            elif isinstance(n, Code):
                self.code(n)
            else:
                self.problem(getattr(n, 'line', 0), f'contenido inesperado en #ejercicios: {type(n).__name__}',
                             strip_tags(self.inline([n])) if not isinstance(n, Heading) else '')
        for it in items:
            if not it['label']:
                self.problem(0, f'ejercicio {it["num"]} sin etiqueta')
        self.exercises.extend(items)
        return [{'t': 'ejercicios', 'items': items}]

    def b_soluciones(self, c):
        for n in self.content_arg(c):
            if isinstance(n, Call) and n.name == 'solucion':
                self.libro.stats['#solucion'] += 1
                key = n.pos[0].value
                if key in self.solutions:
                    self.problem(n.line, f'solución repetida para {key}')
                self.solutions[key] = self.blocks(self.content_arg(n, 1))
            elif isinstance(n, (Space, Parbreak)):
                continue
            else:
                self.problem(getattr(n, 'line', 0), f'contenido inesperado en #soluciones: {type(n).__name__}')
        return []

    def b_ejercicio(self, c):
        self.problem(c.line, '#ejercicio fuera de #ejercicios')
        return []

    def b_solucion(self, c):
        self.problem(c.line, '#solucion fuera de #soluciones')
        return []

    def match_solutions(self, alias):
        by_label = {it['label']: it for it in self.exercises if it['label']}
        for key, bl in self.solutions.items():
            it = by_label.get(key) or by_label.get(alias.get(key, key))
            if it is None:
                self.problem(0, f'solución {key} sin ejercicio en esta parte')
                continue
            it['solucion'] = bl
        for it in self.exercises:
            if it['solucion'] is None:
                self.problem(0, f'ejercicio {it["label"]} sin solución')


def flatten_html(b):
    """A block rendered as inline html (only for blocks found inside table cells)."""
    t = b['t']
    if t in ('p', 'centrado', 'h2', 'h3', 'h4'):
        return b['html']
    if t == 'lista':
        return '<br>'.join('• ' + x for x in b['items'])
    if 'bloques' in b:
        return '<br>'.join(flatten_html(x) for x in b['bloques'])
    return ''


# ------------------------------------------------------------------ glossary
def slug(s):
    import unicodedata
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def glossary(parte, bloques):
    """Turn the term paragraphs of glosario.typ into one `glosario` block.

    The letter-range headings (A – C, …) are left out: the app groups the entries by letter itself.
    """
    out, entradas, seen = [], [], set()
    pos = None
    for b in bloques:
        # the term is the run of adjacent <strong> at the start («Multiplicador de V<sub>BE</sub>:» is three)
        m = re.match(r'((?:<strong>.*?</strong>)+)\s*(.*)$', b.get('html', ''), re.S) if b['t'] == 'p' else None
        if m and strip_tags(m.group(1)).rstrip().endswith(':'):
            termino = strip_tags(m.group(1)).rstrip()[:-1].strip()
            inner = re.sub(r'</?strong>', '', m.group(1)).rstrip()[:-1].strip()
            sid = 'glos-' + slug(termino)
            k = 2
            while sid in seen:
                sid = f'glos-{slug(termino)}-{k}'
                k += 1
            seen.add(sid)
            e = {'id': sid, 'termino': termino, 'html': m.group(2).strip(), 'ver': b.get('_ver', [])}
            if inner != esc(termino):
                e['termino_html'] = inner
            entradas.append(e)
            if pos is None:
                pos = len(out)
                out.append(None)
            continue
        if b['t'] == 'h2' and b['num'] is None:
            parte.libro.ignored['título de grupo de letras del glosario'] += 1
            continue
        b.pop('_ver', None)
        out.append(b)
    if pos is not None:
        out[pos] = {'t': 'glosario', 'entradas': entradas}
    return out, entradas


# ------------------------------------------------------------------ placeholders
def resolve(obj, libro, alias, ec_meta, stem_of=None):
    """Replace reference and inline-math placeholders in every string of obj (in place)."""
    def num_of(key):
        target = alias.get(key, key)
        r = libro.refs.get(target) or libro.refs.get(key)
        if r is None:
            libro.problems.append((stem_of or '', 0, f'referencia sin destino: {key}', ''))
            return esc('-'.join(key.split('-')[1:]))
        return esc(r['num'])

    def sub(m):
        if m.group(1) == 'R':
            return num_of(m.group(2))
        meta = ec_meta.get(m.group(2))
        if meta is None:
            return ''
        return (f'style="height:{meta["h"] / 10.5:.3f}em;'
                f'vertical-align:{-meta["d"] / 10.5:.3f}em"')

    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                o[k] = walk(v)
            return o
        if isinstance(o, list):
            for k, v in enumerate(o):
                o[k] = walk(v)
            return o
        if isinstance(o, str) and '' in o:
            return PH.sub(sub, o)
        return o

    return walk(obj)
