// What the instruments show right now, as numbers (SI), for the practices' checks and tables.

import type { Banco } from '../banco.svelte.ts';
import { nivelEn } from '../motor/osciloscopio.ts';

/** Main reading of the Brymen (null: OL, dashes, OFF). */
export function brymen(b: Banco): number | null {
  return b.brymen.pantalla.principal?.valor ?? null;
}

export function brymenSecundaria(b: Banco): number | null {
  return b.brymen.pantalla.secundaria?.valor ?? null;
}

export function fnirsiDmm(b: Banco): number | null {
  return b.fnirsi.modo === 'dmm' ? (b.fnirsi.lecturaDmm?.valor ?? null) : null;
}

type CampoPrm = 'vpp' | 'vmax' | 'vmin' | 'vmedia' | 'vrms' | 'f' | 'periodo' | 'ciclo';

/** Automatic measurement (PRM) of a channel, in displayed units. */
export function prm(b: Banco, canal: 0 | 1, campo: CampoPrm): number | null {
  if (b.fnirsi.modo !== 'osc' || !b.fnirsi.canales[canal]!.on) return null;
  const m = b.fnirsi.medidas(canal);
  const v = m?.[campo];
  return v === undefined || v === null || !Number.isFinite(v) ? null : v;
}

/** Gain CH2/CH1 in dB from the peak-to-peak values. */
export function gananciaDb(b: Banco): number | null {
  const a = prm(b, 0, 'vpp');
  const c = prm(b, 1, 'vpp');
  return a && c && a > 0 && c > 0 ? 20 * Math.log10(c / a) : null;
}

/** Δ between the cursors: seconds (time cursors) or volts (voltage cursors). */
export function deltaCursores(b: Banco, tipo: 'tiempo' | 'tension'): number | null {
  if (b.fnirsi.cursores !== tipo) return null;
  const l = b.fnirsi.lecturaCursores();
  return l ? Math.abs(l.delta) : null;
}

/** The two voltage cursors (higher first). */
export function cursoresTension(b: Banco): [number, number] | null {
  if (b.fnirsi.cursores !== 'tension') return null;
  const l = b.fnirsi.lecturaCursores();
  return l ? [Math.max(l.a, l.b), Math.min(l.a, l.b)] : null;
}

/** Level of the line at f2 relative to the line at f1 in the FFT on screen (dB). */
export function fftRelativo(b: Banco, f1: number, f2: number, tol = 0.04): number | null {
  const f = b.fnirsi;
  if (f.modo !== 'osc' || (f.mates !== 'fft1' && f.mates !== 'fft2')) return null;
  const e = f.espectro();
  if (!e) return null;
  const a = nivelEn(e, f1, tol);
  const c = nivelEn(e, f2, tol);
  const nyq = e.f[e.f.length - 1]!;
  if (a === null || c === null || f2 > nyq || f1 > nyq) return null;
  return c - a;
}

/** Generator frequency if its output is on. */
export function generador(b: Banco): number | null {
  return b.fnirsi.dds.salida ? b.fnirsi.dds.frecuencia : null;
}

/** A value only while the generator is at a given frequency (±1 %). */
export function conGenerador(b: Banco, f: number, v: () => number | null): number | null {
  const g = generador(b);
  return g !== null && Math.abs(g - f) <= f * 0.01 ? v() : null;
}
