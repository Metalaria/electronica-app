// 1.0 accessibility pass: the book's equations, read aloud. Every equation is an image whose text alternative was its
// Typst source («V_("B") = V_("CC") dot.op (R_("2"))/(R_("1") + R_("2"))»), which a screen reader spelled out symbol
// by symbol. `leerMatematicas` turns that source into Spanish words: «V sub B igual a V sub CC por R sub 2, entre R sub
// 1 más R sub 2». It is a reader, not a full Typst parser: it knows the constructs the book's sources use (fractions
// with /, sub- and superscripts, function calls such as sqrt and overline, lr(…) groups, quoted text, the named
// symbols of the book) and passes anything else through as it is, so nothing is ever lost — at worst a symbol is read
// by its own name. Units and numbers inside quotes («"0,7 V"») are kept as written (decimal comma, as the book).

type Nodo =
  | { t: 'txt'; s: string }
  | { t: 'grupo'; hijos: Nodo[]; abre: string; cierra: string }
  | { t: 'llamada'; nombre: string; args: Nodo[][] }
  | { t: 'sub'; base: Nodo; ind: Nodo }
  | { t: 'sup'; base: Nodo; exp: Nodo }
  | { t: 'frac'; num: Nodo; den: Nodo };

/** Named symbols → words (or the character itself, which screen readers name well). */
const SIMBOLOS: Record<string, string> = {
  'dot.op': 'por',
  'dot.c': 'por',
  dot: 'por',
  times: 'por',
  'plus.minus': 'más menos',
  pm: 'más menos',
  approx: 'aproximadamente igual a',
  'eq.not': 'distinto de',
  'lt.eq': 'menor o igual que',
  'gt.eq': 'mayor o igual que',
  'lt.double': 'mucho menor que',
  'gt.double': 'mucho mayor que',
  'arrow.r': 'conduce a',
  arrow: 'conduce a',
  'arrow.l': 'viene de',
  'arrow.r.double': 'implica',
  'arrow.r.double.long': 'implica',
  'arrow.double': 'implica',
  'arrow.l.r.double': 'equivale a',
  infinity: 'infinito',
  oo: 'infinito',
  prop: 'proporcional a',
  partial: 'derivada parcial de',
  integral: 'integral',
  sum: 'sumatorio',
  product: 'productorio',
  'dots.h': 'puntos suspensivos',
  'dots.c': 'puntos suspensivos',
  dots: 'puntos suspensivos',
  'bar.v': 'barra',
  ast: 'asterisco',
  degree: 'grados',
  quad: ',',
  qquad: ',',
  space: ' ',
  thin: ' ',
  zws: '',
  quot: '',
  nabla: 'nabla',
  in: 'pertenece a',
  'subset.eq': 'contenido en',
  forall: 'para todo',
  exists: 'existe',
  'and': 'y',
  or: 'o',
  not: 'no',
  // Greek letters by name (the book's sources mostly carry the characters already)
  alpha: 'α', beta: 'β', gamma: 'γ', Gamma: 'Γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', Theta: 'Θ', kappa: 'κ', lambda: 'λ', Lambda: 'Λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', Pi: 'Π', rho: 'ρ',
  sigma: 'σ', Sigma: 'Σ', tau: 'τ', phi: 'φ', Phi: 'Φ', chi: 'χ', psi: 'ψ', Psi: 'Ψ', omega: 'ω', Omega: 'Ω',
};

const OPERADORES: Record<string, string> = {
  '=': 'igual a',
  '+': 'más',
  '-': 'menos',
  '−': 'menos',
  '±': 'más menos',
  '<': 'menor que',
  '>': 'mayor que',
  '≤': 'menor o igual que',
  '≥': 'mayor o igual que',
  '≈': 'aproximadamente igual a',
  '≠': 'distinto de',
  '·': 'por',
  '×': 'por',
  '*': 'por',
  '→': 'conduce a',
  '⇒': 'implica',
  '%': 'por ciento',
  "'": 'prima',
  '!': 'factorial',
  ':': ':',
  ';': ';',
  ',': ',',
  '&': '',
};

/** Calls → how to read them (`a` = the arguments already read). */
const FUNCIONES: Record<string, (a: string[]) => string> = {
  sqrt: (a) => `raíz cuadrada de ${a[0] ?? ''}`,
  root: (a) => `raíz de índice ${a[0] ?? ''} de ${a[1] ?? ''}`,
  overline: (a) => `${a[0] ?? ''} negada`,
  abs: (a) => `valor absoluto de ${a[0] ?? ''}`,
  norm: (a) => `norma de ${a[0] ?? ''}`,
  hat: (a) => `${a[0] ?? ''} sombrero`,
  tilde: (a) => `${a[0] ?? ''} tilde`,
  vec: (a) => `vector ${a.join(', ')}`,
  frac: (a) => `${a[0] ?? ''} entre ${a[1] ?? ''}`,
  binom: (a) => `combinaciones de ${a[0] ?? ''} sobre ${a[1] ?? ''}`,
  dot: (a) => `derivada de ${a[0] ?? ''}`,
  lr: (a) => a.join(', '),
  op: (a) => a.map((x) => NOMBRES[x] ?? x).join(' '),
  upright: (a) => a.join(' '),
  italic: (a) => a.join(' '),
  bold: (a) => a.join(' '),
  cal: (a) => a.join(' '),
  sans: (a) => a.join(' '),
  mono: (a) => a.join(' '),
  underline: (a) => a.join(' '),
  cancel: (a) => `${a[0] ?? ''} tachado`,
  mat: (a) => `matriz: ${a.join('; ')}`,
  cases: (a) => `casos: ${a.join('; ')}`,
  ln: (a) => `logaritmo neperiano de ${a.join(', ')}`,
  log: (a) => `logaritmo de ${a.join(', ')}`,
  exp: (a) => `exponencial de ${a.join(', ')}`,
  sin: (a) => `seno de ${a.join(', ')}`,
  cos: (a) => `coseno de ${a.join(', ')}`,
  tan: (a) => `tangente de ${a.join(', ')}`,
  max: (a) => `máximo de ${a.join(', ')}`,
  min: (a) => `mínimo de ${a.join(', ')}`,
};

/** Functions written without parentheses («ln x», «cos ω t») read with their name. */
const NOMBRES: Record<string, string> = { ln: 'logaritmo neperiano de', log: 'logaritmo de', exp: 'exponencial de', sin: 'seno de', cos: 'coseno de', tan: 'tangente de', sen: 'seno de', tg: 'tangente de', lim: 'límite', max: 'máximo de', min: 'mínimo de', arg: 'argumento de', det: 'determinante de' };

const ABRE: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

// ------------------------------------------------------------------ tokens

/** `sep`: whitespace before it («dot.op (x)» is a product, «sqrt(x)» a call). */
type Token = { k: 'txt' | 'id' | 'op' | 'abre' | 'cierra' | 'sub' | 'sup' | 'frac' | 'coma'; s: string; sep?: boolean };

function tokens(src: string): Token[] {
  const t: Token[] = [];
  let i = 0;
  let espacio = false;
  while (i < src.length) {
    const c = src[i]!;
    const antes = t.length;
    if (c === '"') {
      let j = i + 1;
      let s = '';
      while (j < src.length && src[j] !== '"') {
        if (src[j] === '\\' && j + 1 < src.length) j++;
        s += src[j];
        j++;
      }
      t.push({ k: 'txt', s });
      i = j + 1;
    } else if (c === '\\') {
      // an escaped character is itself («\/» a slash written inline, «\%»); a backslash before a line break is a break
      const n = src[i + 1] ?? '';
      if (n === '\n' || n === '') t.push({ k: 'op', s: ',' });
      else if (n === '/') t.push({ k: 'op', s: 'entre' });
      else t.push({ k: 'op', s: n });
      i += 2;
    } else if (/\s/.test(c)) {
      i++;
      espacio = true;
      continue;
    } else if (/\p{L}/u.test(c)) {
      const m = /^\p{L}[\p{L}0-9]*(?:\.[A-Za-z]+)*/u.exec(src.slice(i))!;
      t.push({ k: 'id', s: m[0] });
      i += m[0].length;
    } else if (/[0-9]/.test(c)) {
      const m = /^[0-9]+(?:[.,][0-9]+)?/.exec(src.slice(i))!;
      t.push({ k: 'txt', s: m[0] });
      i += m[0].length;
    } else if (c in ABRE) {
      t.push({ k: 'abre', s: c });
      i++;
    } else if (c === ')' || c === ']' || c === '}') {
      t.push({ k: 'cierra', s: c });
      i++;
    } else if (c === '_') {
      t.push({ k: 'sub', s: c });
      i++;
    } else if (c === '^') {
      t.push({ k: 'sup', s: c });
      i++;
    } else if (c === '/') {
      t.push({ k: 'frac', s: c });
      i++;
    } else if (c === ',') {
      t.push({ k: 'coma', s: c });
      i++;
    } else {
      // two-character operators of Typst
      const dos = src.slice(i, i + 2);
      const D: Record<string, string> = { '<=': '≤', '>=': '≥', '!=': '≠', '->': '→', '=>': '⇒' };
      if (D[dos]) {
        t.push({ k: 'op', s: D[dos]! });
        i += 2;
      } else {
        t.push({ k: /\p{L}/u.test(c) ? 'txt' : 'op', s: c });
        i++;
      }
    }
    if (t.length > antes) {
      t[antes]!.sep = espacio;
      espacio = false;
    }
  }
  return t;
}

// ------------------------------------------------------------------ parse

class Analizador {
  i = 0;
  readonly t: Token[];
  constructor(t: Token[]) {
    this.t = t;
  }
  private ver(): Token | undefined {
    return this.t[this.i];
  }

  /** A sequence up to a closing bracket (or a comma, inside a call's arguments). */
  secuencia(hastaComa = false): Nodo[] {
    const out: Nodo[] = [];
    for (;;) {
      const k = this.ver();
      if (!k || k.k === 'cierra' || (hastaComa && k.k === 'coma')) return out;
      let n = this.postfijo();
      // fractions bind the elements next to the slash
      while (this.ver()?.k === 'frac') {
        this.i++;
        const den = this.postfijo();
        n = { t: 'frac', num: n, den };
      }
      out.push(n);
    }
  }

  private postfijo(): Nodo {
    let n = this.primario();
    for (;;) {
      const k = this.ver();
      if (k?.k === 'sub') {
        this.i++;
        n = { t: 'sub', base: n, ind: this.primario() };
      } else if (k?.k === 'sup') {
        this.i++;
        n = { t: 'sup', base: n, exp: this.primario() };
      } else return n;
    }
  }

  private primario(): Nodo {
    const k = this.t[this.i++];
    if (!k) return { t: 'txt', s: '' };
    if (k.k === 'abre') {
      const hijos = this.secuencia();
      const c = this.ver();
      if (c?.k === 'cierra') this.i++;
      return { t: 'grupo', hijos, abre: k.s, cierra: ABRE[k.s] ?? '' };
    }
    if (k.k === 'id' && this.ver()?.k === 'abre' && this.ver()?.s === '(' && !this.ver()?.sep) {
      this.i++;
      const args: Nodo[][] = [];
      for (;;) {
        args.push(this.secuencia(true));
        const c = this.ver();
        if (c?.k === 'coma') {
          this.i++;
          continue;
        }
        if (c?.k === 'cierra') this.i++;
        break;
      }
      return { t: 'llamada', nombre: k.s, args };
    }
    if (k.k === 'id') return { t: 'txt', s: leerId(k.s) };
    if (k.k === 'op') return { t: 'txt', s: OPERADORES[k.s] ?? k.s };
    if (k.k === 'coma') return { t: 'txt', s: ',' };
    if (k.k === 'cierra' || k.k === 'sub' || k.k === 'sup' || k.k === 'frac') return { t: 'txt', s: '' };
    return { t: 'txt', s: k.s };
  }
}

function leerId(s: string): string {
  if (s in SIMBOLOS) return SIMBOLOS[s]!;
  if (s in NOMBRES) return NOMBRES[s]!;
  return s;
}

// ------------------------------------------------------------------ words

/** One word or a quoted text: no pause needed around it in a fraction. */
function simple(n: Nodo): boolean {
  if (n.t === 'txt') return !/\s/.test(n.s.trim());
  if (n.t === 'grupo') return n.hijos.length === 1 && simple(n.hijos[0]!);
  if (n.t === 'sub') return simple(n.base) && simple(n.ind);
  return false;
}

/** The contents of a group used as an operand (the parentheses of «(a+b)/c» are not read). */
const dentro = (n: Nodo): Nodo[] => (n.t === 'grupo' && n.abre === '(' ? n.hijos : [n]);

function leer(n: Nodo): string {
  switch (n.t) {
    case 'txt':
      return n.s;
    case 'grupo': {
      const s = juntar(n.hijos);
      return n.abre === '(' ? `(${s})` : n.abre === '[' ? `[${s}]` : s;
    }
    case 'llamada': {
      const args = n.args.map((a) => juntar(a));
      const f = FUNCIONES[n.nombre];
      return f ? f(args) : `${leerId(n.nombre)} ${args.join(', ')}`;
    }
    case 'sub':
      return `${leer(n.base)} sub ${juntar(dentro(n.ind))}`;
    case 'sup': {
      const e = juntar(dentro(n.exp)).trim();
      // a group raised to a power: «(V_GS − V_th)²» is «V sub GS menos V sub th, todo al cuadrado»
      const base = simple(n.base) || n.base.t === 'sub' ? leer(n.base) : `${leer(n.base)}, todo`;
      if (e === '2') return `${base} al cuadrado`;
      if (e === '3') return `${base} al cubo`;
      return `${base} elevado a ${e}${simple(n.exp) ? '' : ','}`;
    }
    case 'frac': {
      const a = juntar(dentro(n.num));
      const b = juntar(dentro(n.den));
      return `${a}${simple(n.num) ? '' : ','} entre ${b}${simple(n.den) ? '' : ','}`;
    }
  }
}

/** An empty base («lr((…)) zws^2», the book's way to raise a group) takes the node before it as its base. */
function agrupar(ns: Nodo[]): Nodo[] {
  const out: Nodo[] = [];
  for (const n of ns) {
    const vacia = (n.t === 'sup' || n.t === 'sub') && n.base.t === 'txt' && !n.base.s.trim();
    const prev = out[out.length - 1];
    if (vacia && prev) out[out.length - 1] = n.t === 'sup' ? { t: 'sup', base: prev, exp: n.exp } : { t: 'sub', base: prev, ind: n.ind };
    else out.push(n);
  }
  return out;
}

function juntar(ns: Nodo[]): string {
  const g = agrupar(ns);
  return g
    .map((n, k) => {
      // «f lr(( t ))»: a single letter followed by a bracketed group is a function of it — «f de t»
      const prev = g[k - 1];
      const de = n.t === 'llamada' && n.nombre === 'lr' && prev?.t === 'txt' && /^\p{L}$/u.test(prev.s);
      return `${de ? 'de ' : ''}${leer(n)}`;
    })
    .join(' ')
    .replace(/\(\s*/g, '(')
    .replace(/\s*\)/g, ')');
}

// ------------------------------------------------------------------ units

const PREFIJOS: Record<string, string> = { p: 'pico', n: 'nano', µ: 'micro', μ: 'micro', u: 'micro', m: 'mili', k: 'kilo', M: 'mega', G: 'giga' };
const UNIDADES: Record<string, [string, string]> = {
  V: ['voltio', 'voltios'],
  A: ['amperio', 'amperios'],
  Ω: ['ohmio', 'ohmios'],
  W: ['vatio', 'vatios'],
  Hz: ['hercio', 'hercios'],
  F: ['faradio', 'faradios'],
  H: ['henrio', 'henrios'],
  s: ['segundo', 'segundos'],
  S: ['siemens', 'siemens'],
  dB: ['decibelio', 'decibelios'],
  '°C': ['grado Celsius', 'grados Celsius'],
  VA: ['voltamperio', 'voltamperios'],
};
const RE_UNIDAD = /(\d(?:[\d.,]*\d)?)(\s| | | )?([pnµμumkMG])?(VA|Hz|dB|°C|[VAΩWFHsS])(?![\p{L}\d])/gu;

/**
 * Units after a number in words, as a screen reader should say them: «4,7 kΩ» → «4,7 kiloohmios», «10,7 MHz» →
 * «10,7 megahercios», «1 V» → «1 voltio». Only after a number (a lone «V» or «A» is a variable); «m» alone is left as it
 * is (metres or milli-?). Units the table does not know stay as written.
 */
export function leerUnidades(texto: string): string {
  return texto.replace(RE_UNIDAD, (todo, n: string, _esp: string | undefined, pre: string | undefined, u: string) => {
    const nombres = UNIDADES[u];
    if (!nombres) return todo;
    const uno = /^[-−]?1$/.test(n);
    return `${n} ${pre ? PREFIJOS[pre] ?? pre : ''}${uno ? nombres[0] : nombres[1]}`;
  });
}

/** The Typst source of an equation of the book, in Spanish words for a screen reader. */
export function leerMatematicas(src: string | null | undefined): string {
  if (!src) return '';
  try {
    const a = new Analizador(tokens(src));
    const partes: Nodo[] = [];
    // stray closing brackets do not stop the reading
    for (let g = 0; g < 1000; g++) {
      partes.push(...a.secuencia());
      if (a.i >= a.t.length) break;
      a.i++;
    }
    return leerUnidades(juntar(partes))
      .replace(/[()[\]]/g, ' ')
      .replace(/\s+([,;:])/g, '$1')
      .replace(/([,;])(?:\s*[,;])+/g, '$1')
      .replace(/\s+/g, ' ')
      .replace(/^[\s,;]+|[\s,;]+$/g, '')
      .trim();
  } catch {
    return src;
  }
}
