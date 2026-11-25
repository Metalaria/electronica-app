// The real FNIRSI 2C53T's multimeter: a relative reading and limits with a warning, kept here in the application.
// The instrument is not told: its screen goes on showing what it measures. «Relativo» remembers a reading and gives
// the following ones as their difference from it; the limits say when a reading goes under or over a value.
// Both work on the reading in its base unit (volts, ohms, amperes…), so a change of range in the instrument (mV to
// V) does not change what they mean; a change of unit (volts to ohms) suspends them, and they say so.
import type { PantallaReal } from '../brymen-real/protocolo';

export interface Referencia {
  /** In the base unit. */
  valor: number;
  unidad: string;
}

/** The reading as a reference; null when it holds no number (OL, a word, blank). */
export function tomarReferencia(p: PantallaReal): Referencia | null {
  return p.valor === null || p.ol ? null : { valor: p.valor, unidad: p.unidad };
}

export type Relativo =
  | { estado: 'ok'; diferencia: number; /** Against the reference, %; null when the reference is zero. */ porcentaje: number | null }
  | { estado: 'sin-numero' }
  | { estado: 'otra-unidad' };

export function relativo(p: PantallaReal, ref: Referencia): Relativo {
  if (p.unidad !== ref.unidad) return { estado: 'otra-unidad' };
  if (p.valor === null || p.ol) return { estado: 'sin-numero' };
  const diferencia = p.valor - ref.valor;
  return { estado: 'ok', diferencia, porcentaje: ref.valor !== 0 ? (100 * diferencia) / Math.abs(ref.valor) : null };
}

const PREFIJOS: Record<string, number> = { n: 1e-9, 'µ': 1e-6, u: 1e-6, m: 1e-3, '': 1, k: 1e3, M: 1e6 };

/**
 * A limit as typed: a number with a decimal comma or point, and optionally a prefix and a unit («4,5», «450 m»,
 * «450 mV», «2,2 kΩ»). Without a prefix it is in the base unit. Null when it is not a number; undefined when empty.
 */
export function leerLimite(texto: string): number | null | undefined {
  const t = texto.trim().replace('−', '-');
  if (!t) return undefined;
  const m = /^([+-]?\d+(?:[.,]\d+)?)\s*([nµumkM]?)\s*[A-Za-zΩ°%]*$/.exec(t);
  if (!m) return null;
  const numero = Number(m[1]!.replace(',', '.'));
  return Number.isFinite(numero) ? numero * PREFIJOS[m[2] ?? '']! : null;
}

export interface Limites {
  /** In the base unit; null: no limit on that side. */
  minimo: number | null;
  maximo: number | null;
  /** The unit the limits were set in. */
  unidad: string;
}

export type Alarma = 'dentro' | 'bajo' | 'alto' | 'sin-numero' | 'otra-unidad';

/** Where the reading is against the limits. An overload counts as over the maximum when there is one. */
export function alarma(p: PantallaReal, l: Limites): Alarma {
  if (p.unidad !== l.unidad) return 'otra-unidad';
  if (p.ol) return l.maximo !== null ? 'alto' : 'sin-numero';
  if (p.valor === null) return 'sin-numero';
  if (l.minimo !== null && p.valor < l.minimo) return 'bajo';
  if (l.maximo !== null && p.valor > l.maximo) return 'alto';
  return 'dentro';
}
