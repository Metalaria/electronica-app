// The small, safe expression language of the formula calculators (same grammar as contenido/formulas_expr.py).
//
//   expr  := sum            sum := prod (('+'|'-') prod)*      prod := unary (('*'|'/') unary)*
//   unary := '-' unary | power                                power := atom ('^' unary)?
//   atom  := number | name | name '(' expr (',' expr)* ')' | '(' expr ')'
//
// Expressions are parsed once and compiled to closures; nothing is ever passed to eval() or Function().
// Plain TypeScript without DOM (usable in a worker or in Node).

export type Entorno = Record<string, number>;
export type Funcion = (e: Entorno) => number;

export const CONSTANTES: Record<string, number> = {
  pi: Math.PI,
  k_B: 1.380649e-23,
  q_e: 1.602176634e-19,
  c_0: 299792458,
  mu_0: 1.25663706212e-6,
  eps_0: 8.8541878128e-12,
  h_P: 6.62607015e-34,
};

function par(...xs: number[]): number {
  let s = 0;
  for (const x of xs) {
    if (x === 0) return 0;
    s += 1 / x;
  }
  return 1 / s;
}

/** Functions and their number of arguments (−1: any number). */
const FUNCIONES: Record<string, [number, (...a: number[]) => number]> = {
  sqrt: [1, Math.sqrt],
  exp: [1, Math.exp],
  ln: [1, Math.log],
  log10: [1, Math.log10],
  log2: [1, Math.log2],
  sin: [1, Math.sin],
  cos: [1, Math.cos],
  tan: [1, Math.tan],
  asin: [1, Math.asin],
  acos: [1, Math.acos],
  atan: [1, Math.atan],
  sinh: [1, Math.sinh],
  cosh: [1, Math.cosh],
  tanh: [1, Math.tanh],
  asinh: [1, Math.asinh],
  acosh: [1, Math.acosh],
  atanh: [1, Math.atanh],
  abs: [1, Math.abs],
  floor: [1, Math.floor],
  ceil: [1, Math.ceil],
  round: [1, (x) => Math.floor(x + 0.5)],
  atan2: [2, Math.atan2],
  min: [-1, Math.min],
  max: [-1, Math.max],
  par: [-1, par],
};

export type Nodo =
  | { k: 'num'; v: number }
  | { k: 'var'; n: string }
  | { k: 'const'; n: string }
  | { k: 'neg'; a: Nodo }
  | { k: 'op'; o: '+' | '-' | '*' | '/' | '^'; a: Nodo; b: Nodo }
  | { k: 'fn'; n: string; args: Nodo[] };

type Token = { t: 'n'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

const RE_TOKEN = /\s*(?:(\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(\S))/y;

function tokens(s: string): Token[] {
  const out: Token[] = [];
  RE_TOKEN.lastIndex = 0;
  const texto = s.trimEnd();
  while (RE_TOKEN.lastIndex < texto.length) {
    const m = RE_TOKEN.exec(texto);
    if (!m) break;
    if (m[1] !== undefined) out.push({ t: 'n', v: Number(m[1]) });
    else if (m[2] !== undefined) out.push({ t: 'id', v: m[2] });
    else if (m[3] !== undefined) {
      if (!'+-*/^(),'.includes(m[3])) throw new Error(`carácter no válido «${m[3]}» en «${s}»`);
      out.push({ t: 'op', v: m[3] });
    }
  }
  return out;
}

export function analizar(s: string): Nodo {
  const ts = tokens(s);
  let i = 0;
  const ver = (): Token | undefined => ts[i];
  const esOp = (v: string): boolean => {
    const t = ts[i];
    return t !== undefined && t.t === 'op' && t.v === v;
  };
  const esperar = (v: string): void => {
    if (!esOp(v)) throw new Error(`se esperaba «${v}» en «${s}»`);
    i++;
  };

  function suma(): Nodo {
    let a = prod();
    while (esOp('+') || esOp('-')) {
      const o = (ts[i++] as Token).v as '+' | '-';
      a = { k: 'op', o, a, b: prod() };
    }
    return a;
  }
  function prod(): Nodo {
    let a = unario();
    while (esOp('*') || esOp('/')) {
      const o = (ts[i++] as Token).v as '*' | '/';
      a = { k: 'op', o, a, b: unario() };
    }
    return a;
  }
  function unario(): Nodo {
    if (esOp('-')) {
      i++;
      return { k: 'neg', a: unario() };
    }
    if (esOp('+')) {
      i++;
      return unario();
    }
    return potencia();
  }
  function potencia(): Nodo {
    const a = atomo();
    if (esOp('^')) {
      i++;
      return { k: 'op', o: '^', a, b: unario() };
    }
    return a;
  }
  function atomo(): Nodo {
    const t = ver();
    if (!t) throw new Error(`expresión incompleta «${s}»`);
    i++;
    if (t.t === 'n') return { k: 'num', v: t.v };
    if (t.t === 'op' && t.v === '(') {
      const a = suma();
      esperar(')');
      return a;
    }
    if (t.t === 'id') {
      if (esOp('(')) {
        const f = FUNCIONES[t.v];
        if (!f) throw new Error(`función desconocida «${t.v}»`);
        i++;
        const args = [suma()];
        while (esOp(',')) {
          i++;
          args.push(suma());
        }
        esperar(')');
        if (f[0] > 0 && args.length !== f[0]) throw new Error(`${t.v} lleva ${f[0]} argumentos`);
        return { k: 'fn', n: t.v, args };
      }
      if (t.v in CONSTANTES) return { k: 'const', n: t.v };
      return { k: 'var', n: t.v };
    }
    throw new Error(`expresión mal formada «${s}»`);
  }

  const a = suma();
  if (i !== ts.length) throw new Error(`sobra texto en «${s}»`);
  return a;
}

/** Compiles an AST to a closure. Division by zero gives ±∞ (or NaN for 0/0), as in the generator. */
export function compilarNodo(n: Nodo): Funcion {
  switch (n.k) {
    case 'num': {
      const v = n.v;
      return () => v;
    }
    case 'const': {
      const v = CONSTANTES[n.n] ?? NaN;
      return () => v;
    }
    case 'var': {
      const nombre = n.n;
      return (e) => e[nombre] ?? NaN;
    }
    case 'neg': {
      const a = compilarNodo(n.a);
      return (e) => -a(e);
    }
    case 'fn': {
      const f = (FUNCIONES[n.n] as [number, (...a: number[]) => number])[1];
      const args = n.args.map(compilarNodo);
      if (args.length === 1) {
        const a0 = args[0] as Funcion;
        return (e) => f(a0(e));
      }
      return (e) => f(...args.map((a) => a(e)));
    }
    case 'op': {
      const a = compilarNodo(n.a);
      const b = compilarNodo(n.b);
      switch (n.o) {
        case '+':
          return (e) => a(e) + b(e);
        case '-':
          return (e) => a(e) - b(e);
        case '*':
          return (e) => a(e) * b(e);
        case '/':
          return (e) => a(e) / b(e);
        case '^':
          return (e) => Math.pow(a(e), b(e));
      }
    }
  }
}

const cache = new Map<string, Funcion>();

/** Parses and compiles (cached). */
export function compilar(s: string): Funcion {
  let f = cache.get(s);
  if (!f) {
    f = compilarNodo(analizar(s));
    cache.set(s, f);
  }
  return f;
}

/** Variables used by an expression. */
export function variablesDe(n: Nodo, out = new Set<string>()): Set<string> {
  if (n.k === 'var') out.add(n.n);
  else if (n.k === 'neg') variablesDe(n.a, out);
  else if (n.k === 'op') {
    variablesDe(n.a, out);
    variablesDe(n.b, out);
  } else if (n.k === 'fn') for (const a of n.args) variablesDe(a, out);
  return out;
}

// ------------------------------------------------------------------ numeric solving

/**
 * Sample points of the bracketing scan: the widened typical range on its own scale, plus a dense stretch
 * around the current value (log variables) or a symmetric logarithmic grid (linear variables). Same as
 * muestras() in contenido/formulas_expr.py.
 */
export function muestras(x0: number, lo: number, hi: number, log: boolean): number[] {
  const xs: number[] = [];
  if (log && lo > 0) {
    const a = Math.log(lo / 1e3);
    const b = Math.log(hi * 1e3);
    for (let i = 0; i <= 600; i++) xs.push(Math.exp(a + ((b - a) * i) / 600));
    if (x0 > 0 && Number.isFinite(x0)) {
      const c = Math.log(x0);
      for (let i = 0; i <= 200; i++) xs.push(Math.exp(c + Math.log(100) * (i / 100 - 1)));
    }
  } else {
    const w = hi - lo || 1;
    const a = lo - w;
    const b = hi + w;
    for (let i = 0; i <= 600; i++) xs.push(a + ((b - a) * i) / 600);
    const S = 3 * Math.max(Math.abs(lo), Math.abs(hi), Number.isFinite(x0) ? Math.abs(x0) : 0, 1e-300);
    for (let i = 0; i <= 300; i++) {
      const m = S * 10 ** ((-12 * i) / 300);
      xs.push(m, -m);
    }
    xs.push(0);
  }
  return [...new Set(xs)].sort((p, q) => p - q);
}

export interface Solucion {
  x: number;
  /** Number of roots found in the scanned range (more than one: the nearest to x0 is returned). */
  n: number;
}

/**
 * Root of g(x) = 0 near x0: scan for sign changes, then bisection. A bracket is a root when |g| shrinks
 * there (a pole or a jump also changes sign, but |g| does not shrink). Same algorithm as
 * resolver_numerico() in contenido/formulas_expr.py, which checks every formula with it.
 */
export function resolverNumerico(g: (x: number) => number, x0: number, lo: number, hi: number, log: boolean, escala = 0): Solucion | null {
  const xs = muestras(x0, lo, hi, log);
  const gs = xs.map((x) => g(x));
  const raices: number[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const g0 = gs[i] as number;
    const g1 = gs[i + 1] as number;
    if (!Number.isFinite(g0) || !Number.isFinite(g1)) continue;
    if (g0 === 0) {
      raices.push(xs[i] as number);
      continue;
    }
    if (g0 * g1 >= 0) continue;
    let x1 = xs[i] as number;
    let x2 = xs[i + 1] as number;
    let f1 = g0;
    const tope = Math.max(Math.abs(g0), Math.abs(g1));
    for (let k = 0; k < 200; k++) {
      const m = 0.5 * (x1 + x2);
      const fm = g(m);
      if (!Number.isFinite(fm)) break;
      if (fm === 0 || Math.abs(x2 - x1) <= 1e-15 * Math.abs(m)) {
        x1 = x2 = m;
        break;
      }
      if (fm < 0 === f1 < 0) {
        x1 = m;
        f1 = fm;
      } else x2 = m;
    }
    const r = 0.5 * (x1 + x2);
    const fr = g(r);
    if (Number.isFinite(fr) && (Math.abs(fr) <= 1e-3 * tope || Math.abs(fr) <= 1e-9 * escala)) raices.push(r);
  }
  if (!raices.length) return null;
  let mejor = raices[0] as number;
  const dist = (r: number): number => (log && x0 > 0 ? (r > 0 ? Math.abs(Math.log(r / x0)) : Infinity) : Math.abs(r - x0));
  for (const r of raices) if (dist(r) < dist(mejor)) mejor = r;
  return { x: mejor, n: raices.length };
}
