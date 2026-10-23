// Formulas as math for the reader: the expression tree of a formula drawn as HTML (fractions, roots,
// exponents, the book's symbols) and «Paso a paso»: the formula, the same formula with the numbers in SI,
// intermediate values with their units (Ω · F = s, 1/s = Hz) and the result. Plain TypeScript (no DOM): the
// output is trusted HTML built here from the catalogue (symbols are the pipeline's sub/sup HTML).

import { analizar, compilarNodo, CONSTANTES, type Nodo, type Entorno } from './expresion';
import type { Formula, VarFormula } from './tipos';
import { formatoValor, MENOS, ESPACIO } from './unidades';
import { dimDe, DIM_CONSTANTES, ADIMENSIONAL, producto, potencia, iguales, esAdimensional, nombreDim, type Dim } from './dimensiones';

// ------------------------------------------------------------------ display tree

export type T =
  | { k: 'num'; v: number }
  | { k: 'var'; id: string }
  | { k: 'const'; n: string }
  | { k: 'neg'; a: T }
  | { k: 'suma'; t: { s: 1 | -1; a: T }[] }
  | { k: 'prod'; f: T[] }
  | { k: 'div'; a: T; b: T }
  | { k: 'pot'; a: T; b: T }
  | { k: 'fn'; n: string; args: T[] }
  /** A value: substituted (an input) or computed (a step). */
  | { k: 'val'; v: number; dim: Dim | null; html: string; neg: boolean; unidad: boolean };

function terminos(n: Nodo, s: 1 | -1, out: { s: 1 | -1; a: T }[]): void {
  if (n.k === 'op' && n.o === '+') {
    terminos(n.a, s, out);
    terminos(n.b, s, out);
  } else if (n.k === 'op' && n.o === '-') {
    terminos(n.a, s, out);
    terminos(n.b, (-s) as 1 | -1, out);
  } else if (n.k === 'neg') terminos(n.a, (-s) as 1 | -1, out);
  else out.push({ s, a: arbol(n) });
}

function factores(n: Nodo, out: T[]): void {
  if (n.k === 'op' && n.o === '*') {
    factores(n.a, out);
    factores(n.b, out);
  } else out.push(arbol(n));
}

/** a/b as drawn: −x/y as −(x/y), as the book writes it, and (x/y)/z as x/(y·z). */
function dividir(a: T, b: T): T {
  if (a.k === 'neg') return { k: 'neg', a: dividir(a.a, b) };
  if (a.k === 'div') {
    const fb = [...(a.b.k === 'prod' ? a.b.f : [a.b]), ...(b.k === 'prod' ? b.f : [b])];
    return { k: 'div', a: a.a, b: { k: 'prod', f: fb } };
  }
  return { k: 'div', a, b };
}

/** Expression AST → display tree (sums and products flattened, a/b/c as a/(b·c)). */
export function arbol(n: Nodo): T {
  switch (n.k) {
    case 'num':
      return { k: 'num', v: n.v };
    case 'var':
      return { k: 'var', id: n.n };
    case 'const':
      return { k: 'const', n: n.n };
    case 'neg':
      return { k: 'neg', a: arbol(n.a) };
    case 'fn':
      return { k: 'fn', n: n.n, args: n.args.map(arbol) };
    case 'op':
      if (n.o === '+' || n.o === '-') {
        const t: { s: 1 | -1; a: T }[] = [];
        terminos(n, 1, t);
        return { k: 'suma', t };
      }
      if (n.o === '*') {
        const f: T[] = [];
        factores(n, f);
        return { k: 'prod', f };
      }
      if (n.o === '/') {
        return dividir(arbol(n.a), arbol(n.b));
      }
      return { k: 'pot', a: arbol(n.a), b: arbol(n.b) };
  }
}

// ------------------------------------------------------------------ HTML

const SUPER: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

/** A literal number of a formula as the book writes it: «0,693», «273,15», «6,4516 × 10⁻¹⁰». */
export function numeroLibro(v: number): string {
  if (v === 0) return '0';
  const a = Math.abs(v);
  let s: string;
  if (a >= 1e6 || a < 1e-3) {
    const e = Math.floor(Math.log10(a));
    const m = Number((v / 10 ** e).toPrecision(8));
    const ms = String(m).replace('.', ',');
    s = (ms === '1' ? '' : `${ms}${ESPACIO}×${ESPACIO}`) + `10${String(e).replace(/[-0-9]/g, (c) => SUPER[c] ?? c)}`;
  } else {
    s = String(Number(v.toPrecision(10))).replace('.', ',');
    const [ent = '', dec] = s.split(',');
    if (ent.replace('-', '').length >= 5) s = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACIO) + (dec ? ',' + dec : '');
  }
  return s.replace('-', MENOS);
}

const CONST_HTML: Record<string, string> = {
  pi: 'π',
  k_B: '<i>k</i><sub>B</sub>',
  q_e: '<i>q</i>',
  c_0: '<i>c</i><sub>0</sub>',
  mu_0: 'µ<sub>0</sub>',
  eps_0: 'ε<sub>0</sub>',
  h_P: '<i>h</i>',
};
const CONST_UNIDAD: Record<string, string> = { k_B: 'J/K', q_e: 'C', c_0: 'm/s', mu_0: 'H/m', eps_0: 'F/m', h_P: 'J·s' };

const FN_NOMBRE: Record<string, string> = {
  ln: 'ln', log2: 'log<sub>2</sub>', log10: 'log<sub>10</sub>', sin: 'sen', cos: 'cos', tan: 'tg', asin: 'arcsen',
  acos: 'arccos', atan: 'arctg', sinh: 'senh', cosh: 'cosh', tanh: 'tgh', asinh: 'arcsenh', acosh: 'arccosh',
  atanh: 'arctgh', min: 'mín', max: 'máx', round: 'redondeo', atan2: 'arctg2',
};

export interface OpcionesHtml {
  /** Symbol of each variable (trusted HTML). */
  sim: (id: string) => string;
  /** Variables drawn as buttons («tap to solve»), with their accessible name. */
  pulsable?: (id: string) => string | null;
  /** Variable currently solved for (highlighted). */
  objetivo?: string;
}

function prec(t: T): number {
  switch (t.k) {
    case 'suma':
      return 1;
    case 'neg':
      return 2;
    case 'prod':
      return 2;
    case 'div':
      return 3;
    case 'pot':
      return 4;
    case 'val':
      return t.neg ? 1.5 : 5;
    case 'num':
      return t.v < 0 ? 1.5 : 5;
    default:
      return 5;
  }
}

// around a fraction the parentheses grow to its height
const paren = (s: string): string =>
  s.includes('m-frac')
    ? `<span class="m-pg"><span class="m-p m-pa">(</span>${s}<span class="m-p m-pa">)</span></span>`
    : `<span class="m-p">(</span>${s}<span class="m-p">)</span>`;

function html(t: T, o: OpcionesHtml, enLinea: boolean): string {
  const h = (x: T, minPrec: number, linea = enLinea): string => {
    const s = html(x, o, linea);
    return prec(x) < minPrec ? paren(s) : s;
  };
  switch (t.k) {
    case 'num':
      return `<span class="m-n">${numeroLibro(t.v)}</span>`;
    case 'const':
      return `<span class="m-c">${CONST_HTML[t.n] ?? t.n}</span>`;
    case 'val':
      return `<span class="m-val">${t.html}</span>`;
    case 'var': {
      const cls = `m-v${o.objetivo === t.id ? ' m-obj' : ''}`;
      const nombre = o.pulsable?.(t.id);
      if (nombre) return `<button type="button" class="${cls} m-pulsable" data-var="${t.id}" aria-label="${nombre}">${o.sim(t.id)}</button>`;
      return `<span class="${cls}">${o.sim(t.id)}</span>`;
    }
    case 'neg':
      return `${MENOS}${h(t.a, 2)}`;
    case 'suma':
      return t.t
        .map((x, i) => {
          const s = h(x.a, x.s < 0 ? 2 : 1.5);
          if (i === 0) return x.s < 0 ? `${MENOS}${s}` : s;
          return `<span class="m-op">${x.s < 0 ? MENOS : '+'}</span>${s}`;
        })
        .join('');
    case 'prod': {
      let s = '';
      t.f.forEach((x, i) => {
        const p = h(x, 2.5);
        if (i > 0) {
          const ant = t.f[i - 1] as T;
          // «2π», «2π·R»: a number glued to π; everything else with a centred dot
          const pegado = ant.k === 'num' && x.k === 'const' && x.n === 'pi';
          s += pegado ? '' : '<span class="m-op m-por">·</span>';
        }
        s += p;
      });
      return s;
    }
    case 'div':
      if (enLinea) return `${h(t.a, 2.5)}/${h(t.b, 3.5)}`;
      return `<span class="m-frac"><span class="m-num">${html(t.a, o, false)}</span><span class="m-den">${html(t.b, o, false)}</span></span>`;
    case 'pot': {
      if (t.b.k === 'num' && t.b.v === 0.5) return raiz(html(t.a, o, enLinea));
      const base = t.a.k === 'val' && (t.a.unidad || t.a.neg) ? paren(html(t.a, o, enLinea)) : h(t.a, 4.5);
      return `${base}<sup class="m-sup">${html(t.b, o, true)}</sup>`;
    }
    case 'fn': {
      const a = t.args.map((x) => html(x, o, enLinea));
      if (t.n === 'sqrt') return raiz(a[0] ?? '');
      if (t.n === 'exp') return `<span class="m-c">e</span><sup class="m-sup">${html(t.args[0] as T, o, true)}</sup>`;
      if (t.n === 'abs') return `<span class="m-p">|</span>${a[0]}<span class="m-p">|</span>`;
      if (t.n === 'par') return a.join('<span class="m-op">∥</span>');
      if (t.n === 'floor') return `⌊${a[0]}⌋`;
      if (t.n === 'ceil') return `⌈${a[0]}⌉`;
      return `<span class="m-f">${FN_NOMBRE[t.n] ?? t.n}</span>${paren(a.join('; '))}`;
    }
  }
}

function raiz(s: string): string {
  const alta = s.includes('m-frac') ? ' m-rs-alta' : '';
  return `<span class="m-raiz"><span class="m-rs${alta}" aria-hidden="true">√</span><span class="m-rad">${s}</span></span>`;
}

/** An expression on one line (fractions as a/b), e.g. «2·δV» or «1/(2π·f·C)», with the formula's symbols. */
export function exprLinea(expr: string, sim: (id: string) => string): string {
  return html(arbol(analizar(expr)), { sim }, true);
}

/** «lhs = rhs» as HTML. */
export function ecuacionHtml(lhs: string, rhs: T | string, o: OpcionesHtml): string {
  const r = typeof rhs === 'string' ? arbol(analizar(rhs)) : rhs;
  return `${html({ k: 'var', id: lhs }, o, false)}<span class="m-igual">=</span>${html(r, o, false)}`;
}

// ------------------------------------------------------------------ values

function valorHtml(v: number, unidad: string, cifras: number, recortar: boolean): string {
  return formatoValor(v, unidad, cifras, recortar).replace(/^-/, MENOS);
}

/** Substitutes the variables (and the physical constants) by their values with units. */
function sustituir(t: T, f: Formula, valores: Entorno): T {
  switch (t.k) {
    case 'var': {
      const v = f.vars.find((x) => x.id === t.id) as VarFormula | undefined;
      const x = valores[t.id] ?? NaN;
      const u = v?.unidad ?? '';
      return { k: 'val', v: x, dim: dimDe(u), html: valorHtml(x, u, 4, true), neg: x < 0, unidad: u !== '' };
    }
    case 'const':
      if (t.n === 'pi') return t;
      return {
        k: 'val',
        v: CONSTANTES[t.n] ?? NaN,
        dim: DIM_CONSTANTES[t.n] ?? null,
        html: valorHtml(CONSTANTES[t.n] ?? NaN, CONST_UNIDAD[t.n] ?? '', 4, true),
        neg: false,
        unidad: true,
      };
    case 'neg':
      return { k: 'neg', a: sustituir(t.a, f, valores) };
    case 'suma':
      return { k: 'suma', t: t.t.map((x) => ({ s: x.s, a: sustituir(x.a, f, valores) })) };
    case 'prod':
      return { k: 'prod', f: t.f.map((x) => sustituir(x, f, valores)) };
    case 'div':
      return { k: 'div', a: sustituir(t.a, f, valores), b: sustituir(t.b, f, valores) };
    case 'pot':
      return { k: 'pot', a: sustituir(t.a, f, valores), b: sustituir(t.b, f, valores) };
    case 'fn':
      return { k: 'fn', n: t.n, args: t.args.map((x) => sustituir(x, f, valores)) };
    default:
      return t;
  }
}

/** Value and dimension of a node whose children are all values (null dimension: unknown). */
function evaluarNodo(t: T): { v: number; dim: Dim | null } {
  const hoja = (x: T): { v: number; dim: Dim | null } => {
    if (x.k === 'val') return { v: x.v, dim: x.dim };
    if (x.k === 'num') return { v: x.v, dim: ADIMENSIONAL };
    if (x.k === 'const') return { v: CONSTANTES[x.n] ?? NaN, dim: DIM_CONSTANTES[x.n] ?? null };
    return evaluarNodo(x);
  };
  switch (t.k) {
    case 'val':
    case 'num':
    case 'const':
      return hoja(t);
    case 'neg': {
      const a = hoja(t.a);
      return { v: -a.v, dim: a.dim };
    }
    case 'suma': {
      let v = 0;
      let dim: Dim | null | undefined;
      for (const x of t.t) {
        const a = hoja(x.a);
        v += x.s * a.v;
        if (dim === undefined) dim = a.dim;
        else if (dim && a.dim && !iguales(dim, a.dim)) dim = null;
        else if (!a.dim) dim = null;
      }
      return { v, dim: dim ?? null };
    }
    case 'prod': {
      let v = 1;
      let dim: Dim | null = ADIMENSIONAL;
      for (const x of t.f) {
        const a = hoja(x);
        v *= a.v;
        dim = dim && a.dim ? producto(dim, a.dim) : null;
      }
      return { v, dim };
    }
    case 'div': {
      const a = hoja(t.a);
      const b = hoja(t.b);
      return { v: a.v / b.v, dim: a.dim && b.dim ? producto(a.dim, b.dim, -1) : null };
    }
    case 'pot': {
      const a = hoja(t.a);
      const b = hoja(t.b);
      const dim = a.dim && b.dim && esAdimensional(b.dim) ? (esAdimensional(a.dim) ? ADIMENSIONAL : potencia(a.dim, b.v)) : null;
      return { v: Math.pow(a.v, b.v), dim };
    }
    case 'fn': {
      const xs = t.args.map(hoja);
      const v = compilarNodo({ k: 'fn', n: t.n, args: xs.map((x) => ({ k: 'num' as const, v: x.v })) })({});
      let dim: Dim | null = ADIMENSIONAL;
      const d0 = xs[0]?.dim ?? null;
      if (t.n === 'sqrt') dim = d0 ? potencia(d0, 0.5) : null;
      else if (['abs', 'min', 'max', 'floor', 'ceil', 'round', 'par'].includes(t.n)) {
        dim = d0;
        for (const x of xs) if (!x.dim || !d0 || !iguales(x.dim, d0)) dim = null;
      }
      return { v, dim };
    }
    case 'var':
      return { v: NaN, dim: null };
  }
}

const esValor = (t: T): boolean => t.k === 'val' || t.k === 'num' || (t.k === 'const' && t.n === 'pi');

function hijos(t: T): T[] {
  switch (t.k) {
    case 'neg':
      return [t.a];
    case 'suma':
      return t.t.map((x) => x.a);
    case 'prod':
      return t.f;
    case 'div':
      return [t.a, t.b];
    case 'pot':
      return [t.a, t.b];
    case 'fn':
      return t.args;
    default:
      return [];
  }
}

function conHijos(t: T, hs: T[]): T {
  switch (t.k) {
    case 'neg':
      return { k: 'neg', a: hs[0] as T };
    case 'suma':
      return { k: 'suma', t: t.t.map((x, i) => ({ s: x.s, a: hs[i] as T })) };
    case 'prod':
      return { k: 'prod', f: hs };
    case 'div':
      return { k: 'div', a: hs[0] as T, b: hs[1] as T };
    case 'pot':
      return { k: 'pot', a: hs[0] as T, b: hs[1] as T };
    case 'fn':
      return { k: 'fn', n: t.n, args: hs };
    default:
      return t;
  }
}

/** Reducible nodes: not values, every child a value. */
function reducibles(t: T, out: T[] = []): T[] {
  if (esValor(t) || t.k === 'var' || t.k === 'const') return out;
  const hs = hijos(t);
  if (hs.every(esValor)) out.push(t);
  else for (const h of hs) reducibles(h, out);
  return out;
}

function aValor(t: T, celsius: boolean): T {
  const r = evaluarNodo(t);
  const nombre = r.dim ? nombreDim(r.dim, celsius) : null;
  const txt = nombre === null ? valorHtml(r.v, '', 4, true) : valorHtml(r.v, nombre, 4, true);
  return { k: 'val', v: r.v, dim: r.dim, html: txt, neg: r.v < 0, unidad: !!nombre };
}

function reemplazar(t: T, elegidos: Set<T>, celsius: boolean): T {
  if (elegidos.has(t)) return aValor(t, celsius);
  const hs = hijos(t);
  if (!hs.length) return t;
  return conHijos(t, hs.map((h) => reemplazar(h, elegidos, celsius)));
}

/** Path from `t` down to `x` (both included), or null. */
function caminoA(t: T, x: T): T[] | null {
  if (t === x) return [t];
  for (const h of hijos(t)) {
    const c = caminoA(h, x);
    if (c) return [t, ...c];
  }
  return null;
}

/** A reduction is worth a line of its own when its unit has a simple name (or none). */
function tieneNombre(t: T, celsius: boolean): boolean {
  const r = evaluarNodo(t);
  if (!Number.isFinite(r.v)) return false;
  // pure numbers (2·π, 1 + 0,5) and named units (Ω·F = s)
  return r.dim !== null && nombreDim(r.dim, celsius) !== null;
}

export interface Paso {
  /** «despeje», «formula», «sustitucion», «intermedio», «resultado», «numerico», «comprobacion». */
  tipo: string;
  html: string;
  nota?: string;
}

/**
 * «Paso a paso» of one evaluation: the formula (or its solved form), the numbers in SI with their units,
 * intermediate values and the result with its prefix.
 */
export function pasos(f: Formula, objetivo: string, valores: Entorno, resultado: number, sim: (id: string) => string): Paso[] {
  const o: OpcionesHtml = { sim, objetivo };
  const celsius = f.vars.some((v) => v.unidad === '°C');
  const vObj = f.vars.find((v) => v.id === objetivo);
  const out: Paso[] = [];
  let expr: string;
  if (objetivo === f.resultado) {
    expr = f.expr;
    out.push({ tipo: 'formula', html: ecuacionHtml(objetivo, expr, o), nota: 'La fórmula' });
  } else {
    const d = f.despejes[objetivo];
    out.push({ tipo: 'formula', html: ecuacionHtml(f.resultado, f.expr, o), nota: 'La fórmula' });
    if (typeof d !== 'string') {
      // numeric: show that the value found satisfies the formula
      const env = { ...valores, [objetivo]: resultado };
      out.push({
        tipo: 'numerico',
        html: '',
        nota: `${sim(objetivo)} no se puede despejar con una fórmula cerrada: se busca el valor que cumple la ecuación (bisección).`,
      });
      const t = sustituir(arbol(analizar(f.expr)), f, env);
      const r = compilarNodo(analizar(f.expr))(env);
      const vRes = f.vars.find((v) => v.id === f.resultado);
      out.push({
        tipo: 'comprobacion',
        html: `${html({ k: 'var', id: f.resultado }, o, false)}<span class="m-igual">=</span>${html(t, o, false)}<span class="m-igual">=</span><span class="m-res">${valorHtml(r, vRes?.unidad ?? '', 4, false)}</span>`,
        nota: `Con ${sim(objetivo)} = ${valorHtml(resultado, vObj?.unidad ?? '', 4, false)} la fórmula da el valor pedido`,
      });
      return out;
    }
    expr = d;
    out.push({ tipo: 'despeje', html: ecuacionHtml(objetivo, expr, o), nota: `Despejando ${sim(objetivo)}` });
  }
  let t = sustituir(arbol(analizar(expr)), f, valores);
  const lhs = html({ k: 'var', id: objetivo }, o, false) + '<span class="m-igual">=</span>';
  out.push({ tipo: 'sustitucion', html: lhs + html(t, o, false), nota: 'Con los valores (prefijos SI)' });
  for (let pasada = 0; pasada < 10 && !esValor(t); pasada++) {
    const cands = reducibles(t);
    if (!cands.length) break;
    let elegidos = cands.filter((c) => tieneNombre(c, celsius));
    if (!elegidos.length) {
      // nothing with a simple unit (V·Ω, Ω²…): reduce instead the nearest enclosing expression that has one
      const subir = new Set<T>();
      for (const c of cands) {
        const camino = caminoA(t, c) ?? [t];
        const anc = [...camino].reverse().find((x) => x !== c && tieneNombre(x, celsius)) ?? t;
        subir.add(anc);
      }
      elegidos = [...subir].filter((a) => ![...subir].some((b) => b !== a && caminoA(b, a)));
    }
    t = reemplazar(t, new Set(elegidos), celsius);
    const linea = '<span class="m-igual">=</span>' + html(t, o, false);
    const ultimo = out[out.length - 1] as Paso;
    if (!esValor(t) && linea !== ultimo.html && lhs + linea.slice(linea.indexOf('</span>') + 7) !== ultimo.html)
      out.push({ tipo: 'intermedio', html: linea });
  }
  out.push({
    tipo: 'resultado',
    html: lhs + `<span class="m-res">${valorHtml(resultado, vObj?.unidad ?? '', 4, false)}</span>`,
    nota: 'Resultado',
  });
  return out;
}
