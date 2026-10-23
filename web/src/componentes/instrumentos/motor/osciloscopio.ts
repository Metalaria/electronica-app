// The oscilloscope of the FNIRSI 2C53T as a model: acquisition with its real limits.
//
//   memory       1 000 points spread over the 12 horizontal divisions: the real sample rate is
//                1 000 / (12 · s/div), at most 250 MS/s. Below 2 · f the signal aliases (section 21.20).
//                (Faster than 4 µs/div the screen shows the sin(x)/x reconstruction, i.e. the analog waveform.)
//   bandwidth    50 MHz (×10) or 6 MHz (×1 probe): already in the simulated waveform (montaje.ts).
//   vertical     8 bits over the 8 divisions of the screen: 32 levels per division; what leaves the screen
//                is clipped (and the measurements are wrong without warning, as in the book).
//   noise        about 0.3 mV RMS at the input (1–2 mV peak to peak at 10 mV/div), ten times larger referred
//                to the tip with the probe on ×10.
//   trigger      edge only, rising or falling, Auto / Normal / Single (section 21.9).
//
// No DOM: the drawing is in fnirsi/dibujo.ts.

import { fft, gauss, interpolar, type Serie } from './senal.ts';

export const MUESTRAS = 1000;
export const DIV_H = 12;
export const DIV_V = 8;
export const NIVELES_DIV = 32;
export const F_MUESTREO_MAX = 250e6;

/** 1-2-5 sequences of the instrument. */
export const V_DIV = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
export const S_DIV = [
  10e-9, 20e-9, 50e-9, 100e-9, 200e-9, 500e-9, 1e-6, 2e-6, 5e-6, 10e-6, 20e-6, 50e-6, 100e-6, 200e-6, 500e-6, 1e-3, 2e-3,
  5e-3, 10e-3, 20e-3, 50e-3, 100e-3, 200e-3, 500e-3, 1, 2, 5, 10, 20,
];

export interface CanalOsc {
  on: boolean;
  /** V/div at the probe tip (the menu's ×10 already applied). */
  vDiv: number;
  /** Vertical position of the zero, in divisions from the centre (−4 … 4). */
  pos: number;
  ac: boolean;
  /** Probe switch (physical): ×10 or ×1. */
  sondaX10: boolean;
  /** Probe factor set in the channel menu: if it does not match the switch, amplitudes are off by ten. */
  menuX10: boolean;
  invertir: boolean;
}

export type ModoDisparo = 'auto' | 'normal' | 'single';

export interface Disparo {
  modo: ModoDisparo;
  fuente: 0 | 1;
  subida: boolean;
  /** Level in displayed volts. */
  nivel: number;
}

export interface Captura {
  /** Time of the first point relative to the trigger (s). */
  t0: number;
  dt: number;
  /** Displayed volts per channel (null when off or not connected), after quantisation. */
  y: (Float64Array | null)[];
  /** Codes beyond the screen (clipped). */
  recortado: boolean[];
  disparada: boolean;
  /** Real sample rate of the acquisition (S/s). */
  fs: number;
  /** When the source data starts (to tell the reader that it is a static circuit). */
  estatica: boolean;
}

/** Signal reaching each channel: a waveform, a constant (operating point) or nothing (probe not connected). */
export type Entrada = Serie | number | null;

/** Factor between the probe tip and what the screen shows (×10 menu with ×1 probe → ten times too large). */
export function factorPantalla(c: CanalOsc): number {
  return (c.menuX10 ? 10 : 1) / (c.sondaX10 ? 10 : 1) * (c.invertir ? -1 : 1);
}

function valorEn(e: Entrada, t: number, pista: { i: number }): number {
  if (e === null) return 0;
  if (typeof e === 'number') return e;
  return interpolar(e, t, pista);
}

/** First trigger crossing at or after `desde` (analog data, no noise), or null. */
function buscarDisparo(e: Entrada, d: Disparo, factor: number, desde: number, hasta: number): number | null {
  if (e === null || typeof e === 'number') return null;
  const { t, y } = e;
  // Small hysteresis so that a flat signal at the level does not trigger.
  let i = 0;
  while (i < t.length && t[i]! < desde) i++;
  let prev = i > 0 ? y[i - 1]! * factor : y[i]! * factor;
  for (; i < t.length && t[i]! <= hasta; i++) {
    const v = y[i]! * factor;
    const cruza = d.subida ? prev < d.nivel && v >= d.nivel : prev > d.nivel && v <= d.nivel;
    if (cruza && i > 0) {
      const v0 = y[i - 1]! * factor;
      const a = v !== v0 ? (d.nivel - v0) / (v - v0) : 0;
      return t[i - 1]! + a * (t[i]! - t[i - 1]!);
    }
    prev = v;
  }
  return null;
}

/**
 * One acquisition. `inicio`–`fin` is the simulated span available. Returns null when the trigger mode is
 * Normal or Single and nothing crosses the level (the screen keeps the previous trace).
 */
export function adquirir(
  canales: CanalOsc[],
  entradas: Entrada[],
  sDiv: number,
  hpos: number,
  d: Disparo,
  inicio: number,
  fin: number,
  opciones: { ruido?: boolean; azar?: () => number } = {},
): Captura | null {
  const W = DIV_H * sDiv;
  const fs = Math.min(F_MUESTREO_MAX, MUESTRAS / W);
  const dt = W / MUESTRAS;
  const azar = opciones.azar ?? Math.random;
  const estatica = entradas.every((e) => e === null || typeof e === 'number');

  // Trigger: the screen centre is at t_trigger + hpos.
  const fuente = entradas[d.fuente] ?? null;
  const fFuente = factorPantalla(canales[d.fuente]!);
  const antes = W / 2 - hpos;
  const despues = W / 2 + hpos;
  let tDisparo: number | null = null;
  if (canales[d.fuente]?.on) tDisparo = buscarDisparo(fuente, d, fFuente, inicio + Math.max(0, antes), fin - Math.max(0, despues));
  let disparada = tDisparo !== null;
  if (!disparada) {
    if (d.modo !== 'auto') return null;
    // Auto: free-running, from a different moment each time: the trace runs.
    const libre = Math.max(0, fin - inicio - W);
    tDisparo = inicio + antes + azar() * libre;
  }
  const tIni = tDisparo! + hpos - W / 2;

  const y: (Float64Array | null)[] = [];
  const recortado: boolean[] = [];
  for (let k = 0; k < canales.length; k++) {
    const c = canales[k]!;
    const e = entradas[k] ?? null;
    if (!c.on || e === null) {
      y.push(null);
      recortado.push(false);
      continue;
    }
    const f = factorPantalla(c);
    const sigma = opciones.ruido === false ? 0 : (c.sondaX10 ? 3e-3 : 0.3e-3) * Math.abs(f) ;
    const lsb = c.vDiv / NIVELES_DIV;
    const out = new Float64Array(MUESTRAS);
    const pista = { i: 0 };
    let clip = false;
    for (let n = 0; n < MUESTRAS; n++) {
      const v = valorEn(e, tIni + n * dt, pista) * f + (sigma ? gauss() * sigma + (azar() - 0.5) * 0.6 * lsb : 0);
      // 8 bits over the screen: codes −128 … 127 around the centre, the zero at `pos` divisions.
      let codigo = Math.round(v / lsb + c.pos * NIVELES_DIV);
      if (codigo > 127) {
        codigo = 127;
        clip = true;
      } else if (codigo < -128) {
        codigo = -128;
        clip = true;
      }
      out[n] = (codigo - c.pos * NIVELES_DIV) * lsb;
    }
    y.push(out);
    recortado.push(clip);
  }
  if (estatica) disparada = d.modo === 'auto' ? false : disparada;
  return { t0: -W / 2 + hpos, dt, y, recortado, disparada, fs, estatica };
}

// ------------------------------------------------------------------ automatic measurements (PRM)

export interface MedidasCanal {
  vpp: number;
  vmax: number;
  vmin: number;
  vmedia: number;
  vrms: number;
  f: number | null;
  periodo: number | null;
  ciclo: number | null;
}

/** Measurements on the points of the screen, as the instrument does (section 21.10). */
export function medir(y: Float64Array, dt: number): MedidasCanal {
  let max = -Infinity;
  let min = Infinity;
  let s = 0;
  let s2 = 0;
  for (const v of y) {
    if (v > max) max = v;
    if (v < min) min = v;
    s += v;
    s2 += v * v;
  }
  const n = y.length;
  const media = s / n;
  const rms = Math.sqrt(s2 / n);
  const pp = max - min;
  let f: number | null = null;
  let ciclo: number | null = null;
  if (pp > 0) {
    const nivel = (max + min) / 2;
    const h = pp * 0.1;
    let estado = y[0]! > nivel ? 1 : -1;
    const sub: number[] = [];
    const baj: number[] = [];
    for (let i = 1; i < n; i++) {
      const v = y[i]!;
      if (estado < 0 && v > nivel + h) {
        estado = 1;
        sub.push(i);
      } else if (estado > 0 && v < nivel - h) {
        estado = -1;
        baj.push(i);
      }
    }
    if (sub.length >= 2) {
      // Interpolated crossing times of the mid level.
      const tc = (i: number) => {
        let j = i;
        const arriba = y[i]! > nivel;
        while (j > 0 && (arriba ? y[j - 1]! > nivel : y[j - 1]! < nivel)) j--;
        if (j === 0) return 0;
        const y0 = y[j - 1]!;
        const y1 = y[j]!;
        return (j - 1 + (y1 !== y0 ? (nivel - y0) / (y1 - y0) : 0)) * dt;
      };
      const ts = sub.map(tc);
      const tb = baj.map(tc);
      const k = ts.length - 1;
      const T = (ts[k]! - ts[0]!) / k;
      if (T > 0) {
        f = 1 / T;
        let alto = 0;
        let m = 0;
        for (let q = 0; q < k; q++) {
          const b = tb.find((x) => x > ts[q]! && x < ts[q + 1]!);
          if (b !== undefined) {
            alto += b - ts[q]!;
            m++;
          }
        }
        if (m) ciclo = (alto / (m * T)) * 100;
      }
    }
  }
  return { vpp: pp, vmax: max, vmin: min, vmedia: media, vrms: rms, f, periodo: f ? 1 / f : null, ciclo };
}

// ------------------------------------------------------------------ FFT of a capture

export interface Espectro {
  /** Frequency of each line (Hz). */
  f: Float64Array;
  /** Level of each line in dBV (RMS of a sine at that frequency). */
  db: Float64Array;
  /** Resolution (Hz) = sample rate / points. */
  df: number;
}

/** Spectrum of the 1 000 points of a capture (Hann window, zero-padded to 1 024). */
export function espectro(y: Float64Array, dt: number): Espectro {
  const N = 1024;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const n = y.length;
  let suma = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    re[i] = y[i]! * w;
    suma += w;
  }
  fft(re, im);
  const K = N / 2;
  const f = new Float64Array(K);
  const db = new Float64Array(K);
  const fsN = 1 / dt / N;
  for (let k = 0; k < K; k++) {
    // Amplitude of a sine = 2·|X|/Σw; RMS = that / √2.
    const amp = (k === 0 ? 1 : 2) * Math.hypot(re[k]!, im[k]!) / suma;
    const rms = k === 0 ? amp : amp / Math.SQRT2;
    f[k] = k * fsN;
    db[k] = 20 * Math.log10(Math.max(rms, 1e-7));
  }
  return { f, db, df: 1 / (n * dt) };
}

/** Level (dBV) of the strongest line within ±tol·f of a frequency (for checks: harmonics, side bands). */
export function nivelEn(e: Espectro, f: number, tol = 0.04): number | null {
  let mejor: number | null = null;
  for (let k = 1; k < e.f.length; k++) {
    if (Math.abs(e.f[k]! - f) <= Math.max(tol * f, 1.5 * (e.f[1]! - e.f[0]!))) {
      if (mejor === null || e.db[k]! > mejor) mejor = e.db[k]!;
    }
  }
  return mejor;
}

// ------------------------------------------------------------------ AUTO

export function siguiente125(lista: number[], x: number): number {
  return lista.find((v) => v >= x * 0.999) ?? lista[lista.length - 1]!;
}

/** Vertical scale and position that make a signal fill about five divisions (section 21.6). */
export function autoVertical(max: number, min: number): { vDiv: number; pos: number } {
  const pp = Math.max(max - min, 1e-3);
  const vDiv = siguiente125(V_DIV, pp / 5);
  const centro = (max + min) / 2;
  let pos = -centro / vDiv;
  pos = Math.max(-4, Math.min(4, Math.round(pos * 4) / 4));
  return { vDiv, pos };
}

/** Time base that shows two or three periods of a frequency. */
export function autoHorizontal(f: number): number {
  return siguiente125(S_DIV, 2.5 / (DIV_H * f));
}
