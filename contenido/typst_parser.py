"""Recursive parser for the subset of Typst markup used by the book's sources.

The parser turns a source file into a tree of small node objects. It knows Typst's markup lexing
rules that matter for the book (escapes, shorthands, smart quotes, strong/emph delimiters, raw, math,
labels, headings, lists, comments, embedded code calls with arguments and trailing content blocks) and
records anything it does not understand in `Parser.problems` instead of dropping it.
"""
import re
from dataclasses import dataclass, field


# ------------------------------------------------------------------ nodes
@dataclass
class Text:
    s: str


@dataclass
class Space:            # whitespace inside a paragraph (one or more spaces, at most one newline)
    pass


@dataclass
class Linebreak:
    pass


@dataclass
class Parbreak:
    pass


@dataclass
class Strong:
    children: list


@dataclass
class Emph:
    children: list


@dataclass
class Raw:
    text: str
    lang: str
    block: bool


@dataclass
class Math:
    src: str            # source between the dollars, untrimmed
    display: bool
    line: int = 0


@dataclass
class Label:
    name: str


@dataclass
class Ref:
    name: str


@dataclass
class Heading:
    level: int
    children: list
    line: int = 0


@dataclass
class ListItem:
    kind: str           # '-' bullet, '+' auto-numbered, 'n' explicitly numbered
    number: int | None
    indent: int
    children: list
    line: int = 0


@dataclass
class Content:          # a [...] content block used as a value
    children: list
    src: str            # source between the brackets


@dataclass
class Call:             # #name(args)[trailing]...
    name: str
    pos: list = field(default_factory=list)       # positional values (trailing content blocks appended)
    named: dict = field(default_factory=dict)
    line: int = 0
    src: str = ''


@dataclass
class Code:             # #let / #set / #import / #show ... statements that the pipeline skips on purpose
    keyword: str
    src: str
    line: int = 0


@dataclass
class Str:
    value: str


@dataclass
class Num:
    value: float
    unit: str           # '', '%', 'fr', 'pt', ...
    src: str = ''


@dataclass
class Ident:
    name: str


@dataclass
class Array:
    items: list


@dataclass
class Unknown:          # something the parser could not interpret; also reported in problems
    src: str
    line: int = 0


IDENT_START = re.compile(r'[A-Za-z_]')
IDENT = re.compile(r'[A-Za-z_][A-Za-z0-9_-]*')
LABEL = re.compile(r'<([A-Za-z0-9_:.\-]+)>')
NUMBER = re.compile(r'-?(\d+(?:\.\d+)?|\.\d+)(%|fr|pt|em|cm|mm|in|deg|rad)?')
# characters that may start something special in markup
SPECIAL = set('\\#$`<@*_~-.\'"/[]\n')
TEXT_RUN = re.compile(r'[^\\#$`<@*_~\-.\'"/\[\]\n \t\r]+')
CODE_KEYWORDS = {'let', 'set', 'show', 'import', 'include', 'if', 'for', 'while', 'context'}

# Spanish smart quotes, as Typst prints them with lang: "es"
QUOTES = {True: ('«', '»'), False: ('“', '”')}


def wordy(c):
    return c is not None and c.isalnum()


class ParseError(Exception):
    pass


class Parser:
    def __init__(self, text, name=''):
        self.s = text
        self.n = len(text)
        self.i = 0
        self.name = name
        self.problems = []          # (line, message, sample)
        self.quote_stack = []       # smart-quote state of the current paragraph
        # precomputed line starts for error messages
        self._nl = [m.start() for m in re.finditer('\n', text)]

    # ------------------------------------------------------------------ helpers
    def line_of(self, pos=None):
        import bisect
        return bisect.bisect_right(self._nl, (self.i if pos is None else pos) - 1) + 1

    def problem(self, msg, sample=None, pos=None):
        p = self.i if pos is None else pos
        if sample is None:
            sample = self.s[max(0, p - 30): p + 50]
        self.problems.append((self.line_of(p), msg, sample.replace('\n', '⏎')))

    def peek(self, k=0):
        j = self.i + k
        return self.s[j] if 0 <= j < self.n else None

    def startswith(self, t):
        return self.s.startswith(t, self.i)

    def prev_char(self):
        return self.s[self.i - 1] if self.i > 0 else None

    # ------------------------------------------------------------------ markup
    def parse_document(self):
        nodes = self.parse_markup(None, line_start=True)
        return nodes

    def parse_markup(self, end, line_start=False):
        """Parse markup until `end` (']' for a content block, None for the end of the text).

        Returns a flat list of nodes. Headings and list items are recognised at line starts.
        """
        out = []
        depth = 0                   # balance of literal brackets inside this markup
        buf = []                    # pending text characters

        def flush():
            if buf:
                out.append(Text(''.join(buf)))
                buf.clear()

        last_item = None            # last list item, for continuation lines indented under it
        while self.i < self.n:
            c = self.s[self.i]
            if line_start:
                line_start = False
                # measure indentation
                j = self.i
                while j < self.n and self.s[j] in ' \t':
                    j += 1
                indent = j - self.i
                rest = self.s[j:j + 12]
                m_head = re.match(r'(=+)[ \t]', rest)
                m_list = re.match(r'([-+])[ \t]', rest) or re.match(r'(\d+)\.[ \t]', rest)
                if m_head and indent == 0:
                    flush()
                    self.i = j + len(m_head.group(0))
                    ln = self.line_of()
                    children = self.parse_line(end)
                    out.append(Heading(len(m_head.group(1)), children, ln))
                    last_item = None
                    continue
                if m_list:
                    flush()
                    self.i = j + len(m_list.group(0))
                    ln = self.line_of()
                    tok = m_list.group(1)
                    kind = tok if tok in '-+' else 'n'
                    number = int(tok) if kind == 'n' else None
                    self.quote_stack = []
                    children = self.parse_line(end)
                    last_item = ListItem(kind, number, indent, children, ln)
                    out.append(last_item)
                    continue
                if last_item is not None and indent > last_item.indent and j < self.n and self.s[j] not in '\n]':
                    # continuation line of a list item
                    self.i = j
                    more = self.parse_line(end)
                    last_item.children.append(Space())
                    last_item.children.extend(more)
                    continue
                if j < self.n and self.s[j] != '\n':
                    last_item = None
                self.i = j
                continue
            if c == '\n':
                flush()
                # count blank lines
                j = self.i
                newlines = 0
                while j < self.n and self.s[j] in ' \t\r\n':
                    if self.s[j] == '\n':
                        newlines += 1
                    j += 1
                self.i = j
                if newlines >= 2:
                    out.append(Parbreak())
                    self.quote_stack = []
                    last_item = None
                else:
                    out.append(Space())
                if end is not None and self.i < self.n and self.s[self.i] == end and depth == 0:
                    continue
                line_start = True
                # re-measure from the start of the line (indentation already skipped: step back)
                k = self.i
                while k > 0 and self.s[k - 1] in ' \t':
                    k -= 1
                self.i = k
                continue
            if end is not None and c == end and depth == 0:
                flush()
                self.i += 1
                return out
            node = self.markup_token(buf, end)
            if node is None:
                continue
            if node == '[':
                depth += 1
                buf.append('[')
                continue
            if node == ']':
                if depth > 0:
                    depth -= 1
                    buf.append(']')
                else:
                    self.problem('corchete de cierre sin abrir')
                    buf.append(']')
                continue
            flush()
            if isinstance(node, list):
                out.extend(node)
            else:
                out.append(node)
        flush()
        if end is not None:
            raise ParseError(f'{self.name}: falta «{end}» de cierre (bloque abierto)')
        return out

    def parse_line(self, end):
        """Inline markup up to the end of the current line (for headings and list items)."""
        out = []
        buf = []
        depth = 0

        def flush():
            if buf:
                out.append(Text(''.join(buf)))
                buf.clear()

        while self.i < self.n:
            c = self.s[self.i]
            if c == '\n':
                break
            if end is not None and c == end and depth == 0:
                break
            node = self.markup_token(buf, end)
            if node is None:
                continue
            if node == '[':
                depth += 1
                buf.append('[')
                continue
            if node == ']':
                depth -= 1
                buf.append(']')
                continue
            flush()
            if isinstance(node, list):
                out.extend(node)
            else:
                out.append(node)
        flush()
        return out

    def markup_token(self, buf, end):
        """Consume one markup token at self.i. Plain characters go to `buf` (returns None);
        otherwise returns a node, a list of nodes, or '[' / ']' for literal brackets."""
        s, i = self.s, self.i
        c = s[i]
        if c not in SPECIAL and c not in ' \t\r':
            m = TEXT_RUN.match(s, i)
            buf.append(m.group(0))
            self.i = m.end()
            return None
        if c in ' \t\r':
            j = i
            while j < self.n and s[j] in ' \t\r':
                j += 1
            self.i = j
            if buf:
                out = Text(''.join(buf))
                buf.clear()
                return [out, Space()]
            return Space()
        if c == '\\':
            nx = self.peek(1)
            if nx is None or nx in ' \t\r\n':
                self.i += 1
                return Linebreak()
            if nx == 'u' and self.peek(2) == '{':
                close = s.find('}', i)
                try:
                    buf.append(chr(int(s[i + 3:close], 16)))
                except ValueError:
                    self.problem('escape \\u{} no válido')
                self.i = close + 1
                return None
            buf.append(nx)
            self.i += 2
            return None
        if c == '#':
            nx = self.peek(1)
            if nx is not None and IDENT_START.match(nx):
                self.i += 1
                return self.parse_embedded()
            self.problem('«#» sin expresión')
            buf.append('#')
            self.i += 1
            return None
        if c == '$':
            return self.parse_math()
        if c == '`':
            return self.parse_raw()
        if c == '<':
            m = LABEL.match(s, i)
            if m:
                self.i = m.end()
                return Label(m.group(1))
            buf.append('<')
            self.i += 1
            return None
        if c == '@':
            m = re.match(r'@([A-Za-z0-9_:.\-]*[A-Za-z0-9_])', s[i:])
            if m and not wordy(self.prev_char()):
                self.i += m.end()
                self.problem('referencia con @ (se esperaba #nr)')
                return Ref(m.group(1))
            buf.append('@')
            self.i += 1
            return None
        if c in '*_':
            prev = s[i - 1] if i > 0 else None
            nxt = self.peek(1)
            if wordy(prev) and wordy(nxt):
                buf.append(c)
                self.i += 1
                return None
            self.i += 1
            children = self.parse_delimited(c, end)
            return Strong(children) if c == '*' else Emph(children)
        if c == '~':
            buf.append('\u00a0')
            self.i += 1
            return None
        if c == '-':
            if s.startswith('---', i):
                buf.append('—')
                self.i += 3
            elif s.startswith('--', i):
                buf.append('–')
                self.i += 2
            elif s.startswith('-?', i):
                buf.append('\u00ad')
                self.i += 2
            elif self.peek(1) is not None and self.peek(1).isdigit() and not wordy(self.prev_char()):
                buf.append('−')
                self.i += 1
            else:
                buf.append('-')
                self.i += 1
            return None
        if c == '.':
            if s.startswith('...', i):
                buf.append('…')
                self.i += 3
            else:
                buf.append('.')
                self.i += 1
            return None
        if c in '"\'':
            buf.append(self.smart_quote(c == '"', ''.join(buf)))
            self.i += 1
            return None
        if c == '/':
            if s.startswith('//', i) and re.search(r'https?:$', ''.join(buf[-3:])):
                # a URL: Typst links it instead of starting a comment
                m = re.compile(r'//[^\s\]<>"]*').match(s, i)
                url = m.group(0).rstrip('.,;:!?)')
                buf.append(url)
                self.i = i + len(url)
                return None
            if s.startswith('//', i):
                j = s.find('\n', i)
                self.i = self.n if j < 0 else j
                return None
            if s.startswith('/*', i):
                j = s.find('*/', i)
                self.i = self.n if j < 0 else j + 2
                return None
            buf.append('/')
            self.i += 1
            return None
        if c in '[]':
            self.i += 1
            return c
        # '=', '+', digits and the like in the middle of a line are plain text
        buf.append(c)
        self.i += 1
        return None

    def smart_quote(self, double, pending):
        before = pending[-1] if pending else (self.s[self.i - 1] if self.i > 0 else ' ')
        opened = self.quote_stack[-1] if self.quote_stack else None
        if before.isnumeric() and opened != double:
            return '″' if double else '′'
        if not double and opened is not False and before.isalpha():
            return '’'
        if opened == double and not before.isspace() and before not in '([{':
            self.quote_stack.pop()
            return QUOTES[double][1]
        self.quote_stack.append(double)
        return QUOTES[double][0]

    def parse_delimited(self, delim, end):
        """Content of *strong* or _emph_ up to the matching delimiter."""
        out = []
        buf = []
        start = self.i

        def flush():
            if buf:
                out.append(Text(''.join(buf)))
                buf.clear()

        while self.i < self.n:
            c = self.s[self.i]
            if c == delim:
                prev = self.s[self.i - 1] if self.i > 0 else None
                if not (wordy(prev) and wordy(self.peek(1))):
                    self.i += 1
                    flush()
                    self.problem(f'marcado «{delim}…{delim}» (se esperaba #strong/#emph)', pos=start)
                    return out
            if (end is not None and c == end) or (c == '\n' and self.peek(1) == '\n'):
                break
            if c == '\n':
                flush()
                out.append(Space())
                self.i += 1
                continue
            node = self.markup_token(buf, end)
            if node is None:
                continue
            if node in ('[', ']'):
                buf.append(node)
                continue
            flush()
            if isinstance(node, list):
                out.extend(node)
            else:
                out.append(node)
        flush()
        self.problem(f'«{delim}» sin cerrar', pos=start)
        return out

    # ------------------------------------------------------------------ math and raw
    def math_end(self, start):
        """Index of the closing dollar of math starting at `start` (just after the opening '$')."""
        s, j = self.s, start
        while j < self.n:
            c = s[j]
            if c == '\\':
                j += 2
                continue
            if c == '"':
                j += 1
                while j < self.n and s[j] != '"':
                    j += 2 if s[j] == '\\' else 1
                j += 1
                continue
            if c == '$':
                return j
            j += 1
        raise ParseError(f'{self.name}:{self.line_of(start)}: fórmula sin «$» de cierre')

    def parse_math(self):
        start = self.i + 1
        j = self.math_end(start)
        src = self.s[start:j]
        ln = self.line_of()
        self.i = j + 1
        display = len(src) >= 2 and src[0].isspace() and src[-1].isspace()
        return Math(src, display, ln)

    def parse_raw(self):
        s, i = self.s, self.i
        k = i
        while k < self.n and s[k] == '`':
            k += 1
        ticks = k - i
        if ticks == 2:
            self.i = k
            return Raw('', '', False)
        if ticks >= 3:
            fence = '`' * ticks
            close = s.find(fence, k)
            if close < 0:
                raise ParseError(f'{self.name}:{self.line_of()}: bloque raw sin cerrar')
            body = s[k:close]
            self.i = close + ticks
            m = re.match(r'[A-Za-z][\w+#.-]*', body)
            lang = ''
            if m:
                lang = m.group(0)
                body = body[m.end():]
            return Raw(dedent_raw(body), lang, True)
        close = s.find('`', k)
        if close < 0:
            raise ParseError(f'{self.name}:{self.line_of()}: raw sin cerrar')
        self.i = close + 1
        return Raw(s[k:close], '', False)

    # ------------------------------------------------------------------ embedded code
    def parse_embedded(self):
        """After '#': an identifier with calls, or a statement the pipeline skips."""
        start = self.i - 1
        m = IDENT.match(self.s, self.i)
        name = m.group(0)
        ln = self.line_of()
        if name in CODE_KEYWORDS:
            end = self.skip_statement(m.end())
            src = self.s[start:end]
            self.i = end
            return Code(name, src, ln)
        self.i = m.end()
        # Typst: an identifier followed by '-' and letters is one identifier (cap-erratas); a trailing '-'
        # is not part of it
        while name.endswith('-'):
            name = name[:-1]
            self.i -= 1
        call = Call(name, line=ln)
        called = False
        while self.i < self.n:
            c = self.s[self.i]
            if c == '(':
                self.i += 1
                self.parse_args(call)
                called = True
            elif c == '[':
                self.i += 1
                cstart = self.i
                children = self.parse_markup(']', line_start=True)
                call.pos.append(Content(children, self.s[cstart:self.i - 1]))
                called = True
            elif c == '.' and self.i + 1 < self.n and IDENT_START.match(self.s[self.i + 1]) and not called:
                m2 = IDENT.match(self.s, self.i + 1)
                call.name += '.' + m2.group(0)
                self.i = m2.end()
            else:
                break
        call.src = self.s[start:self.i]
        if not called:
            call.pos = None         # a bare identifier such as #sym or a variable
        return call

    def skip_statement(self, j):
        """End of a code statement starting before j: up to a newline at bracket depth 0."""
        s = self.s
        depth = 0
        while j < self.n:
            c = s[j]
            if c == '"':
                j += 1
                while j < self.n and s[j] != '"':
                    j += 2 if s[j] == '\\' else 1
            elif c in '([{':
                depth += 1
            elif c in ')]}':
                depth -= 1
            elif c == '\n' and depth <= 0:
                return j
            elif c == '/' and s.startswith('//', j):
                k = s.find('\n', j)
                j = self.n if k < 0 else k
                continue
            j += 1
        return j

    def skip_ws(self):
        s = self.s
        while self.i < self.n:
            c = s[self.i]
            if c in ' \t\r\n':
                self.i += 1
            elif s.startswith('//', self.i):
                j = s.find('\n', self.i)
                self.i = self.n if j < 0 else j
            elif s.startswith('/*', self.i):
                j = s.find('*/', self.i)
                self.i = self.n if j < 0 else j + 2
            else:
                break

    def parse_args(self, call):
        """Arguments after '(' up to ')': positional and named values."""
        while True:
            self.skip_ws()
            if self.i >= self.n:
                raise ParseError(f'{self.name}:{call.line}: argumentos sin cerrar en #{call.name}')
            if self.s[self.i] == ')':
                self.i += 1
                return
            m = re.compile(r'([A-Za-z_][A-Za-z0-9_-]*)\s*:(?!:)').match(self.s, self.i)
            if m:
                self.i = m.end()
                self.skip_ws()
                call.named[m.group(1)] = self.parse_value()
            else:
                call.pos.append(self.parse_value())
            self.skip_ws()
            if self.i < self.n and self.s[self.i] == ',':
                self.i += 1

    def parse_value(self):
        s = self.s
        self.skip_ws()
        c = s[self.i]
        if c == '"':
            return Str(self.parse_string())
        if c == '[':
            self.i += 1
            cstart = self.i
            children = self.parse_markup(']', line_start=True)
            return Content(children, s[cstart:self.i - 1])
        if c == '$':
            return self.parse_math()
        if c == '(':
            self.i += 1
            items = []
            while True:
                self.skip_ws()
                if s[self.i] == ')':
                    self.i += 1
                    return Array(items)
                items.append(self.parse_value())
                self.skip_ws()
                if s[self.i] == ',':
                    self.i += 1
        m = NUMBER.match(s, self.i)
        if m:
            self.i = m.end()
            return Num(float(m.group(1)) * (-1 if m.group(0).startswith('-') else 1), m.group(2) or '',
                       m.group(0))
        m = IDENT.match(s, self.i)
        if m:
            self.i = m.end()
            name = m.group(0)
            if self.i < self.n and s[self.i] in '([':
                call = Call(name, line=self.line_of())
                while self.i < self.n and s[self.i] in '([':
                    if s[self.i] == '(':
                        self.i += 1
                        self.parse_args(call)
                    else:
                        self.i += 1
                        cstart = self.i
                        children = self.parse_markup(']', line_start=True)
                        call.pos.append(Content(children, s[cstart:self.i - 1]))
                return call
            return Ident(name)
        # unknown value: skip to the next comma or closing paren at depth 0
        start = self.i
        depth = 0
        while self.i < self.n:
            ch = s[self.i]
            if ch in '([{':
                depth += 1
            elif ch in ')]}':
                if depth == 0:
                    break
                depth -= 1
            elif ch == ',' and depth == 0:
                break
            self.i += 1
        self.problem('valor de argumento no reconocido', s[start:self.i], start)
        return Unknown(s[start:self.i], self.line_of(start))

    def parse_string(self):
        s = self.s
        j = self.i + 1
        out = []
        while j < self.n and s[j] != '"':
            if s[j] == '\\':
                nx = s[j + 1]
                if nx == 'n':
                    out.append('\n')
                elif nx == 't':
                    out.append('\t')
                elif nx == 'u' and s[j + 2] == '{':
                    close = s.find('}', j)
                    out.append(chr(int(s[j + 3:close], 16)))
                    j = close + 1
                    continue
                else:
                    out.append(nx)
                j += 2
                continue
            out.append(s[j])
            j += 1
        self.i = j + 1
        return ''.join(out)


def dedent_raw(body):
    """Typst raw block trimming: drop the first line if blank, the last if blank, and common indentation."""
    lines = body.split('\n')
    if lines and not lines[0].strip():
        lines = lines[1:]
    if lines and not lines[-1].strip():
        lines = lines[:-1]
    ind = min((len(l) - len(l.lstrip(' \t')) for l in lines if l.strip()), default=0)
    return '\n'.join(l[ind:] for l in lines)


def parse(text, name=''):
    p = Parser(text, name)
    nodes = p.parse_document()
    return nodes, p.problems
