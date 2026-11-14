// 1.1 lessons: the lesson's model — named values (what the controls move) and calculations (expressions of the
// calculators' language, componentes/calculadoras/expresion.ts, or a switch choosing between two). Everything a card
// shows (readings, bars, the live formula, the challenge's checks, the graph) is computed here, analytically, from the
// current values; the generator checks the circuit templates against the app's ngspice. Pure (no DOM).

import { compilar, type Funcion } from '../../componentes/calculadoras/expresion';
import { formatoValor } from '../../componentes/calculadoras/unidades';
import type { Estimar, Magnitud, Modelo, Rango, Tarjeta } from './tipos';
import type { EstadoActividad12 } from '../leccion12/tipos';

export type Valores = Record<string, number>;

export interface ModeloCompilado {
  modelo: Modelo;
  /** Values + every calculation, for these values (missing values take the model's). */
  evaluar(v: Valores): Valores;
  /** An expression of the model (and of `extra` names, such as a graph's x). */
  funcion(expr: string): Funcion;
  magnitud(id: string): Magnitud | null;
}

const cache = new WeakMap<Modelo, ModeloCompilado>();

export function compilarModelo(m: Modelo): ModeloCompilado {
  const hecho = cache.get(m);
  if (hecho) return hecho;
  const fns = new Map<string, Funcion>();
  const funcion = (expr: string): Funcion => {
    let f = fns.get(expr);
    if (!f) {
      f = compilar(expr);
      fns.set(expr, f);
    }
    return f;
  };
  const pasos = m.orden.map((id) => {
    const c = m.calculos[id]!;
    if (c.si) {
      const a = funcion(c.entonces!);
      const b = funcion(c.sino!);
      const si = c.si;
      return [id, (e: Valores) => ((e[si] ?? 0) !== 0 ? a(e) : b(e))] as const;
    }
    return [id, funcion(c.expr!)] as const;
  });
  const base: Valores = {};
  for (const [id, v] of Object.entries(m.valores)) base[id] = v.valor;
  const r: ModeloCompilado = {
    modelo: m,
    evaluar(v) {
      const e: Valores = { ...base, ...v };
      for (const [id, f] of pasos) e[id] = f(e);
      return e;
    },
    funcion,
    magnitud(id) {
      return m.valores[id] ?? m.calculos[id] ?? null;
    },
  };
  cache.set(m, r);
  return r;
}

/**
 * The values a card works with: the reader's, with the card's fixed ones on top — and, given the card's state, what
 * a 1.2 step lays over them (the hidden fault of an «averia»: the widget shows the faulty board).
 */
export function valoresDeTarjeta(t: Tarjeta, propios: Valores, e?: { actividad?: EstadoActividad12 } | null): Valores {
  // (as lib/leccion12/motor12.ts sobrescritos; written here so that this module imports no 1.2 code)
  const a = t.actividad;
  const fallo = a?.tipo === 'averia' && e?.actividad?.tipo === 'averia' ? a.fallos[e.actividad.fallo]?.con : undefined;
  return { ...propios, ...t.fijar, ...(fallo ?? {}) };
}

/** «4,00 V», «10 kΩ», «20,0 ms»: a quantity of the model in its unit, with its significant figures. */
export function formatear(mag: Magnitud | null, v: number | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (!mag) return formatoValor(v, '', 3, true);
  return formatoValor(v, mag.unidad, mag.cifras, mag.recortar);
}

/** Whether a value is in a range (the challenge's conditions, the hints' «cuando»). */
export function enRango(r: Rango, e: Valores): boolean {
  const v = e[r.valor];
  if (v == null || !Number.isFinite(v)) return false;
  const eps = 1e-12 * Math.max(1, Math.abs(v));
  if (r.min != null && v < r.min - eps) return false;
  if (r.max != null && v > r.max + eps) return false;
  return true;
}

/** Index of the position of a list nearest to a value. */
export function posicionMasCercana(valores: readonly number[], v: number): number {
  let k = 0;
  let d = Infinity;
  valores.forEach((x, i) => {
    const q = Math.abs(x - v);
    if (q < d - 1e-15 * Math.max(1, Math.abs(x))) {
      d = q;
      k = i;
    }
  });
  return k;
}

/** The estimate's target with the card's values. */
export function objetivoEstimar(mc: ModeloCompilado, est: Estimar, e: Valores): number {
  return mc.funcion(est.objetivo)(mc.evaluar(e));
}

/** Positions of an estimate slider. */
export function posicionesEstimar(est: Estimar): number[] {
  const n = Math.round((est.max - est.min) / est.paso);
  const out: number[] = [];
  for (let k = 0; k <= n; k++) out.push(Number((est.min + k * est.paso).toPrecision(12)));
  return out;
}

/**
 * How close an estimate is: relative error, right (within the tolerance) and a score 0–100 (100 within the tolerance,
 * down to 0 at four tolerances away).
 */
export function puntuarEstimacion(x: number, objetivo: number, tol: number): { error: number; bien: boolean; puntos: number } {
  const error = objetivo === 0 ? Math.abs(x) : Math.abs(x - objetivo) / Math.abs(objetivo);
  const bien = error <= tol + 1e-12;
  const puntos = bien ? 100 : Math.max(0, Math.round(100 * (1 - (error - tol) / (3 * tol))));
  return { error, bien, puntos };
}

/** Items of an order exercise in their right place (`orden[k]` = index of the item shown at k). */
export function enSuSitio(orden: readonly number[]): number {
  return orden.filter((x, k) => x === k).length;
}

/** Pairs placed right (`puestas[k]` = right-hand item placed on left item k, or null). */
export function parejasBien(puestas: readonly (number | null)[]): number {
  return puestas.filter((x, k) => x === k).length;
}

/** A permutation of 0…n−1 with no item in its place, the same every time for the same seed text. */
export function barajarFijo(n: number, semilla: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i++) h = Math.imul(h ^ semilla.charCodeAt(i), 16777619) >>> 0;
  const rnd = () => {
    h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return h / 2 ** 32;
  };
  const p = Array.from({ length: n }, (_, k) => k);
  if (n < 2) return p;
  for (let intento = 0; intento < 50; intento++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [p[i], p[j]] = [p[j]!, p[i]!];
    }
    if (p.every((x, k) => x !== k)) return p;
  }
  // a rotation by one never leaves an item in its place
  return Array.from({ length: n }, (_, k) => (k + 1) % n);
}
