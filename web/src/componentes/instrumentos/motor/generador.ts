// The DDS signal generator of the FNIRSI 2C53T as a SPICE source.
//
// What the book says (sections 21.1, 21.14 and 21.16): 1 Hz to 50 kHz in 1 Hz steps, thirteen fixed waveforms,
// amplitude 0.1 to 3 V and no offset: the output always goes from 0 to the amplitude (so it carries a DC level of
// half the amplitude), duty cycle for square and pulse, symmetry for the sawtooth (50 % gives a triangle).
// Assumptions (the manual does not publish them): 50 Ω output impedance, edges of about 0.2 µs.

import { textoSpice } from '../../../simulador/motor/netlist.ts';

export type FormaDds =
  | 'seno'
  | 'cuadrada'
  | 'sierra'
  | 'media-onda'
  | 'onda-completa'
  | 'escalon-subida'
  | 'escalon-bajada'
  | 'exp-subida'
  | 'exp-bajada'
  | 'pulso'
  | 'multitono'
  | 'sinc'
  | 'lorentz';

export interface Dds {
  forma: FormaDds;
  /** Hz, 1 … 50 000 */
  frecuencia: number;
  /** V, 0.1 … 3 (peak-to-peak: the output goes from 0 to this value) */
  amplitud: number;
  /** %, square and pulse */
  ciclo: number;
  /** %, sawtooth rising part (50 % = triangle) */
  simetria: number;
  salida: boolean;
}

export const FORMAS: { id: FormaDds; nombre: string; corto: string }[] = [
  { id: 'seno', nombre: 'Senoidal', corto: 'Seno' },
  { id: 'cuadrada', nombre: 'Cuadrada', corto: 'Cuadr.' },
  { id: 'sierra', nombre: 'Diente de sierra', corto: 'Sierra' },
  { id: 'media-onda', nombre: 'Media onda', corto: '½ onda' },
  { id: 'onda-completa', nombre: 'Onda completa', corto: 'Completa' },
  { id: 'escalon-subida', nombre: 'Escalón positivo', corto: 'Esc. +' },
  { id: 'escalon-bajada', nombre: 'Escalón negativo', corto: 'Esc. −' },
  { id: 'exp-subida', nombre: 'Subida exponencial', corto: 'Exp. ↑' },
  { id: 'exp-bajada', nombre: 'Bajada exponencial', corto: 'Exp. ↓' },
  { id: 'pulso', nombre: 'Pulso', corto: 'Pulso' },
  { id: 'multitono', nombre: 'Multitono', corto: 'Multit.' },
  { id: 'sinc', nombre: 'Sinc', corto: 'Sinc' },
  { id: 'lorentz', nombre: 'Lorentz', corto: 'Lorentz' },
];

export const DDS_LIMITES = {
  fMin: 1,
  fMax: 50_000,
  aMin: 0.1,
  aMax: 3,
  /** Ω (assumed) */
  rSalida: 50,
  /** s (assumed edge time of square and pulse) */
  flanco: 0.2e-6,
};

export const DDS_INICIAL: Dds = { forma: 'cuadrada', frecuencia: 1000, amplitud: 3, ciclo: 50, simetria: 50, salida: true };

export function limitarDds(d: Dds): Dds {
  const lim = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  return {
    ...d,
    frecuencia: Math.round(lim(d.frecuencia, DDS_LIMITES.fMin, DDS_LIMITES.fMax)),
    amplitud: Math.round(lim(d.amplitud, DDS_LIMITES.aMin, DDS_LIMITES.aMax) * 100) / 100,
    ciclo: lim(Math.round(d.ciclo), 1, 99),
    simetria: lim(Math.round(d.simetria), 0, 100),
  };
}

const n = (v: number) => textoSpice(v, 6);

/**
 * The part of a SPICE V line after the nodes for the DDS output (open-circuit voltage), and whether it is a
 * behavioural source (then the line must be a B element: «V = expression»).
 */
export function fuenteDds(d: Dds): { tipo: 'V' | 'B'; texto: string } {
  if (!d.salida) return { tipo: 'V', texto: 'DC 0' };
  const A = d.amplitud;
  const f = d.frecuencia;
  const T = 1 / f;
  const tr = Math.min(DDS_LIMITES.flanco, T / 20);
  // Fraction of the period, 0 … 1, for the behavioural waveforms.
  const fr = `(time*${n(f)}-floor(time*${n(f)}))`;
  switch (d.forma) {
    case 'seno':
      return { tipo: 'V', texto: `SIN(${n(A / 2)} ${n(A / 2)} ${n(f)} 0 0 -90)` };
    case 'cuadrada':
    case 'pulso': {
      const pw = Math.max(tr, (d.ciclo / 100) * T - tr);
      return { tipo: 'V', texto: `PULSE(0 ${n(A)} 0 ${n(tr)} ${n(tr)} ${n(pw)} ${n(T)})` };
    }
    case 'sierra': {
      const s = d.simetria / 100;
      const subida = Math.max(tr, s * T);
      // ngspice takes a zero pulse width as «not given» (= the stop time): use a tiny one.
      const pw = T * 1e-6;
      const bajada = Math.max(tr, T - subida - pw);
      return { tipo: 'V', texto: `PULSE(0 ${n(A)} 0 ${n(subida)} ${n(bajada)} ${n(pw)} ${n(subida + bajada + pw)})` };
    }
    case 'media-onda':
      return { tipo: 'B', texto: `V = ${n(A)}*max(sin(2*pi*${n(f)}*time),0)` };
    case 'onda-completa':
      return { tipo: 'B', texto: `V = ${n(A)}*abs(sin(pi*${n(f)}*time))` };
    case 'escalon-subida':
      return { tipo: 'B', texto: `V = ${n(A)}*floor(5*${fr})/4` };
    case 'escalon-bajada':
      return { tipo: 'B', texto: `V = ${n(A)}*(1-floor(5*${fr})/4)` };
    case 'exp-subida':
      return { tipo: 'B', texto: `V = ${n(A)}*(1-exp(-5*${fr}))/(1-exp(-5))` };
    case 'exp-bajada':
      return { tipo: 'B', texto: `V = ${n(A)}*(exp(-5*${fr})-exp(-5))/(1-exp(-5))` };
    case 'multitono':
      // Fundamental, 2nd and 3rd harmonic of equal amplitude, scaled into 0 … A.
      return {
        tipo: 'B',
        texto: `V = ${n(A / 2)}*(1+(sin(2*pi*${n(f)}*time)+sin(4*pi*${n(f)}*time)+sin(6*pi*${n(f)}*time))/2.6)`,
      };
    case 'sinc': {
      const x = `(16*pi*(${fr}-0.5)+1e-9)`;
      return { tipo: 'B', texto: `V = ${n(A)}*(sin(${x})/${x}+0.2172)/1.2172` };
    }
    case 'lorentz': {
      const x = `(20*(${fr}-0.5))`;
      return { tipo: 'B', texto: `V = ${n(A)}/(1+${x}*${x})` };
    }
  }
}

/** Highest frequency worth resolving in the DDS output (for the simulation step). */
export function fMaxDds(d: Dds): number {
  if (!d.salida) return 0;
  const sube = d.forma === 'cuadrada' || d.forma === 'pulso' || d.forma.startsWith('escalon') ? 40 : 10;
  return d.frecuencia * sube;
}
