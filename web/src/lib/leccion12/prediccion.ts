// 1.2 «Prediga y simule»: reading the reader's estimate (a value with its unit, as people type it: «4,2 V», «4k7»,
// «150 m») and explaining how far it is — the typical errors the card lists (the value a misconception gives, or a
// ratio to the right one), a prefix slip (a power of 1000 away), or just near or far. Pure.

import { leerValor } from '../../componentes/calculadoras/unidades';
import type { ModeloCompilado, Valores } from '../leccion11/modelo';
import type { Texto } from '../leccion11/tipos';
import type { ErrorTipico, Simular } from './tipos';

/** The estimate typed in the field, in SI units (NaN if it is not a value). A bare number is in the unit. */
export function leerEstimacion(texto: string, unidad: string): number {
  return leerValor(texto, unidad);
}

/** Relative error |x − v| / |v| (absolute when the right value is 0). */
export function errorRelativo(x: number, v: number): number {
  return v === 0 ? Math.abs(x) : Math.abs(x - v) / Math.abs(v);
}

export interface Diagnostico {
  bien: boolean;
  error: number;
  /** The typical error it matches (index in `errores`), or a built-in one. */
  causa: { k: number } | 'prefijo' | 'signo' | 'cerca' | 'lejos' | null;
  texto: Texto | null;
}

const T = (s: string): Texto => [{ t: 'txt', s }];

/** What an estimate `x` says, with the card's values `v`. */
export function diagnosticar(mc: ModeloCompilado, s: Simular, v: Valores, x: number): Diagnostico {
  const r = mc.evaluar(v);
  const obj = mc.funcion(s.objetivo)(r);
  const error = errorRelativo(x, obj);
  if (error <= s.tol + 1e-12) return { bien: true, error, causa: null, texto: null };
  const k = s.errores.findIndex((e) => coincideError(mc, e, r, x, obj, s.tol));
  if (k >= 0) return { bien: false, error, causa: { k }, texto: s.errores[k]!.texto };
  // built in: a prefix slip (milli for micro, kilo for units), a sign, near, far
  if (obj !== 0 && x !== 0) {
    const q = Math.abs(x / obj);
    const p = Math.round(Math.log10(q) / 3);
    if (p !== 0 && errorRelativo(q, 1000 ** p) <= s.tol) return { bien: false, error, causa: 'prefijo', texto: T(`Su cifra está bien, pero ${p > 0 ? 'sobra' : 'falta'} un factor ${Math.abs(p) === 1 ? 'mil' : Math.abs(p) === 2 ? 'un millón' : 'enorme'}: revise el prefijo de la unidad.`) };
    if (x * obj < 0 && errorRelativo(-x, obj) <= s.tol) return { bien: false, error, causa: 'signo', texto: T('El tamaño es el bueno, pero el signo no: revise el sentido de la medida.') };
  }
  if (error <= 3 * s.tol) return { bien: false, error, causa: 'cerca', texto: T('Va bien encaminado: se ha quedado cerca, pero fuera de la tolerancia. Repase los redondeos.') };
  return { bien: false, error, causa: 'lejos', texto: null };
}

export function coincideError(mc: ModeloCompilado, e: ErrorTipico, r: Valores, x: number, obj: number, tol: number): boolean {
  if (e.expr) {
    const w = mc.funcion(e.expr)(r);
    return Number.isFinite(w) && errorRelativo(x, w) <= (e.tol ?? tol) + 1e-12;
  }
  if (e.razon && obj !== 0) {
    const q = x / obj;
    return (e.razon.min == null || q >= e.razon.min) && (e.razon.max == null || q <= e.razon.max);
  }
  return false;
}
