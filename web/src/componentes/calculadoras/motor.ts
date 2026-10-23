// Evaluation of a catalogued formula for any of its variables, sensitivity sweeps and live formula cards.
// Plain TypeScript (no DOM).

import { compilar, resolverNumerico, type Entorno } from './expresion';
import type { Formula, VarFormula } from './tipos';

export interface Resultado {
  valor: number;
  /** Solved with the bracketed numeric solver (no closed form for that variable). */
  numerico: boolean;
  /** Roots found by the numeric solver (more than one: the nearest to the previous value is shown). */
  raices: number;
  error?: string;
}

export function variable(f: Formula, id: string): VarFormula | undefined {
  return f.vars.find((v) => v.id === id);
}

/** Variables that can be computed: the result and every one with a solved form (symbolic or numeric). */
export function objetivosPosibles(f: Formula): string[] {
  return f.vars.filter((v) => v.id === f.resultado || v.id in f.despejes).map((v) => v.id);
}

/** Inputs of the formula when solving for `objetivo`. */
export function entradas(f: Formula, objetivo: string): VarFormula[] {
  return f.vars.filter((v) => v.id !== objetivo);
}

/** Default values (the book's example when there is one). */
export function valoresPorDefecto(f: Formula): Entorno {
  const e: Entorno = {};
  for (const v of f.vars) e[v.id] = v.defecto;
  return e;
}

/**
 * Value of `objetivo` from the other variables. `previo` (the last value shown) guides the numeric solver
 * towards the same branch when there are several solutions.
 */
export function calcular(f: Formula, objetivo: string, valores: Entorno, previo?: number): Resultado {
  for (const v of entradas(f, objetivo)) {
    const x = valores[v.id];
    if (x === undefined || !Number.isFinite(x)) return { valor: NaN, numerico: false, raices: 0, error: 'falta' };
  }
  try {
    if (objetivo === f.resultado) return { valor: compilar(f.expr)(valores), numerico: false, raices: 1 };
    const d = f.despejes[objetivo];
    if (typeof d === 'string') return { valor: compilar(d)(valores), numerico: false, raices: 1 };
    if (d === null) {
      const v = variable(f, objetivo) as VarFormula;
      const fx = compilar(f.expr);
      const meta = valores[f.resultado] as number;
      const e = { ...valores };
      const g = (x: number): number => {
        e[objetivo] = x;
        return fx(e) - meta;
      };
      const x0 = previo !== undefined && Number.isFinite(previo) ? previo : v.defecto;
      const s = resolverNumerico(g, x0, v.min, v.max, v.escala === 'log', Math.abs(meta));
      if (!s) return { valor: NaN, numerico: true, raices: 0, error: 'sin-solucion' };
      return { valor: s.x, numerico: true, raices: s.n };
    }
  } catch {
    return { valor: NaN, numerico: false, raices: 0, error: 'expresion' };
  }
  return { valor: NaN, numerico: false, raices: 0, error: 'no-despejable' };
}

/** Is a value outside the book's typical range for that variable? */
export function fueraDeRango(v: VarFormula, x: number): boolean {
  if (!Number.isFinite(x)) return false;
  const holgura = 1e-9 * Math.max(Math.abs(v.min), Math.abs(v.max));
  return x < v.min - holgura || x > v.max + holgura;
}

export interface Barrido {
  x: Float64Array;
  y: Float64Array;
}

/**
 * The result (`objetivo`) against one input (`xVar`) over that input's typical range, widened to include the
 * current value, with every other input fixed.
 */
export function barrido(f: Formula, objetivo: string, xVar: string, valores: Entorno, n = 121): Barrido {
  const v = variable(f, xVar) as VarFormula;
  const actual = valores[xVar] ?? v.defecto;
  let lo = v.min;
  let hi = v.max;
  const log = v.escala === 'log' && lo > 0;
  if (Number.isFinite(actual)) {
    if (log && actual > 0) {
      lo = Math.min(lo, actual / 3);
      hi = Math.max(hi, actual * 3);
    } else if (!log) {
      lo = Math.min(lo, actual);
      hi = Math.max(hi, actual);
    }
  }
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const e = { ...valores };
  let previo = valores[objetivo];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = log ? lo * (hi / lo) ** t : lo + (hi - lo) * t;
    e[xVar] = x;
    const r = calcular(f, objetivo, e, previo);
    xs[i] = x;
    ys[i] = r.valor;
    if (Number.isFinite(r.valor)) previo = r.valor;
  }
  return { x: xs, y: ys };
}

// ------------------------------------------------------------------ live formula cards

export interface VarTarjeta {
  /** Key shared by the formulas of the card: the variable id, plus the unit when two formulas disagree. */
  clave: string;
  v: VarFormula;
  /** Formulas that use it. */
  usos: string[];
  /** Formula of the card that computes it, when one does: the reader may link the field to it. */
  calculadaPor?: Formula;
  /** Linked by default: the producing formula only combines variables the rest of the card uses too. */
  vincular: boolean;
}

export interface ModeloTarjeta {
  formulas: Formula[];
  /** Variables the reader sets (shared by every formula that uses them). */
  entradas: VarTarjeta[];
  /** Results of the card's formulas, in card order. */
  salidas: { f: Formula; clave: string; v: VarFormula }[];
}

function unidadesDe(fs: Formula[]): Map<string, string> {
  const u = new Map<string, string>();
  for (const f of fs) for (const v of f.vars) if (!u.has(v.id)) u.set(v.id, v.unidad);
  return u;
}

function claveDe(v: VarFormula, unidades: Map<string, string>): string {
  const u = unidades.get(v.id);
  return u === undefined || u === v.unidad ? v.id : `${v.id}|${v.unidad}`;
}

/** Shared variables of a card: same id and unit = same value. */
export function modeloTarjeta(fs: Formula[]): ModeloTarjeta {
  const unidades = unidadesDe(fs);
  const salidas: ModeloTarjeta['salidas'] = [];
  const productora = new Map<string, Formula>();
  for (const f of fs) {
    const v = variable(f, f.resultado) as VarFormula;
    const clave = claveDe(v, unidades);
    salidas.push({ f, clave, v });
    if (!productora.has(clave)) productora.set(clave, f);
  }
  const ent = new Map<string, VarTarjeta>();
  for (const f of fs) {
    for (const v of f.vars) {
      if (v.id === f.resultado) continue;
      const clave = claveDe(v, unidades);
      const e = ent.get(clave);
      if (e) e.usos.push(f.id);
      else ent.set(clave, { clave, v, usos: [f.id], calculadaPor: productora.get(clave), vincular: false });
    }
  }
  for (const e of ent.values()) {
    const p = e.calculadaPor;
    if (!p || e.usos.includes(p.id)) continue;
    const otras = (clave: string) => (ent.get(clave)?.usos ?? []).some((id) => id !== p.id);
    e.vincular = p.vars.filter((v) => v.id !== p.resultado).every((v) => otras(claveDe(v, unidades)));
  }
  return { formulas: fs, entradas: [...ent.values()], salidas };
}

/**
 * Evaluates every formula of a card with the shared inputs. A linked variable takes the value computed by
 * its formula, which then feeds the others, in as many passes as needed (τ = R·C → v(t) = V·(1 − e^(−t/τ))).
 * Returns the result of each formula and the value of each linked variable.
 */
export function evaluarTarjeta(m: ModeloTarjeta, entradasValores: Record<string, number>, vinculadas: Set<string>): Map<string, number> {
  const unidades = unidadesDe(m.formulas);
  const productora = new Map<string, string>();
  for (const s of m.salidas) if (!productora.has(s.clave)) productora.set(s.clave, s.f.id);
  const porFormula = new Map<string, number>();
  const valor = (clave: string, v: VarFormula): number => {
    if (vinculadas.has(clave)) {
      const id = productora.get(clave);
      const r = id !== undefined ? porFormula.get(id) : undefined;
      if (r !== undefined) return r;
    }
    return entradasValores[clave] ?? v.defecto;
  };
  for (let pasada = 0; pasada <= m.salidas.length; pasada++) {
    let cambio = false;
    for (const s of m.salidas) {
      const e: Entorno = {};
      for (const v of s.f.vars) if (v.id !== s.f.resultado) e[v.id] = valor(claveDe(v, unidades), v);
      const r = calcular(s.f, s.f.resultado, e).valor;
      if (!Object.is(porFormula.get(s.f.id), r)) cambio = true;
      porFormula.set(s.f.id, r);
    }
    if (!cambio) break;
  }
  return porFormula;
}
