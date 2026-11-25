// The real FNIRSI 2C53T's oscilloscope: measurements and a spectrum computed here, in the application, from the
// record the instrument sends (osciloscopio.ts). Nothing of this is asked of the instrument or changes it: the link
// only reads. What the instrument's own screen shows (peak to peak, frequency) stays in osciloscopio.ts; this file
// adds what its screen does not give.
//
// A record is 1023 samples of 8 bits, 25 to a division. That bounds everything here: a time is known to a fraction
// of a sample, a level to 1/25 of a division, and a spectrum cannot show anything under about 1 % of the wave
// (the steps of the converter). The functions say so in what they return instead of giving figures finer than
// the record.
import { csv, numeroCsv } from '../registro-real/registro';
import { subidas, voltios, type Traza } from './osciloscopio';

export interface MedidasAmpliadas {
  /** Volts. */
  minimo: number;
  maximo: number;
  picoPico: number;
  /** Mean, true RMS and RMS without the mean (volts), over whole periods when the record holds them; else over it all. */
  media: number;
  eficaz: number;
  eficazAlterna: number;
  /** Hertz and seconds, as osciloscopio.ts gives them: null with fewer than two whole periods in the record. */
  frecuencia: number | null;
  periodo: number | null;
  /** Share of each period above the middle level, %; null without a whole period. */
  ciclo: number | null;
  /** Time from 10 % to 90 % of the wave's height, and from 90 % to 10 %, seconds; null when no whole edge is seen. */
  subida: number | null;
  bajada: number | null;
  /** An edge takes under two samples: this time base cannot resolve it, and the time given is an upper bound. */
  flancoLimitado: boolean;
  /** Whole periods the mean and the RMS were taken over (0: the whole record). */
  periodos: number;
}

/** Mean time (in samples) each crossing in `cruces` takes to go from level `desde` up to level `hasta`. */
function tiempoFlanco(m: ArrayLike<number>, cruces: number[], desde: number, hasta: number): number | null {
  let suma = 0;
  let n = 0;
  for (const p of cruces) {
    // back from the crossing to the last sample at or under `desde`
    let a = Math.min(m.length - 1, Math.floor(p));
    while (a > 0 && m[a]! > desde) a--;
    // forward to the first sample at or over `hasta`
    let b = Math.max(0, Math.ceil(p));
    while (b < m.length - 1 && m[b]! < hasta) b++;
    if (m[a]! > desde || m[b]! < hasta || a >= b) continue;
    const ya = m[a]!;
    const ya1 = m[a + 1]!;
    const yb = m[b]!;
    const yb1 = m[b - 1]!;
    const ta = ya1 !== ya ? a + (desde - ya) / (ya1 - ya) : a;
    const tb = yb !== yb1 ? b - 1 + (hasta - yb1) / (yb - yb1) : b;
    if (tb > ta) {
      suma += tb - ta;
      n++;
    }
  }
  return n ? suma / n : null;
}

/** What the instrument's screen does not give, from the trace: mean, RMS, duty cycle and edge times. */
export function medirAmpliado(t: Traza): MedidasAmpliadas {
  const m = t.muestras;
  let min = 255;
  let max = 0;
  for (const x of m) {
    if (x < min) min = x;
    if (x > max) max = x;
  }
  const amplitud = max - min;
  const dt = t.ajustes.periodoMuestra;
  let s: number[] = [];
  let b: number[] = [];
  const inv = new Uint8Array(m.length);
  for (let k = 0; k < m.length; k++) inv[k] = 255 - m[k]!;
  // (under a third of a division the crossings are noise: the same rule as the instrument's own measurements)
  if (amplitud >= 8) {
    const nivel = (max + min) / 2;
    const h = Math.max(2, amplitud / 8);
    s = subidas(m, nivel, h);
    b = subidas(inv, 255 - nivel, h);
  }
  // mean and RMS over whole periods: a part of a period would pull both towards whatever it holds
  const periodos = Math.max(0, s.length - 1);
  const desde = periodos ? Math.ceil(s[0]!) : 0;
  const hasta = periodos ? Math.ceil(s[s.length - 1]!) : m.length;
  let suma = 0;
  let cuadrados = 0;
  for (let k = desde; k < hasta; k++) {
    const v = voltios(t, m[k]!);
    suma += v;
    cuadrados += v * v;
  }
  const n = Math.max(1, hasta - desde);
  const media = suma / n;
  const eficaz = Math.sqrt(cuadrados / n);
  // (the alternating part on its own pass: as the difference of two squares a flat trace would not come out at zero)
  let alterna = 0;
  for (let k = desde; k < hasta; k++) {
    const d = voltios(t, m[k]!) - media;
    alterna += d * d;
  }
  let frecuencia: number | null = null;
  if (s.length >= 3) {
    const p = (s[s.length - 1]! - s[0]!) / (s.length - 1);
    if (p > 0) frecuencia = 1 / (p * dt);
  }
  let ciclo: number | null = null;
  if (periodos) {
    let total = 0;
    let cuenta = 0;
    for (let i = 0; i + 1 < s.length; i++) {
      const caida = b.find((x) => x > s[i]! && x < s[i + 1]!);
      if (caida === undefined) continue;
      total += (caida - s[i]!) / (s[i + 1]! - s[i]!);
      cuenta++;
    }
    if (cuenta) ciclo = (100 * total) / cuenta;
  }
  const subida = amplitud >= 8 ? tiempoFlanco(m, s, min + 0.1 * amplitud, min + 0.9 * amplitud) : null;
  const bajada = amplitud >= 8 ? tiempoFlanco(inv, b, 255 - max + 0.1 * amplitud, 255 - max + 0.9 * amplitud) : null;
  return {
    minimo: voltios(t, min),
    maximo: voltios(t, max),
    picoPico: voltios(t, max) - voltios(t, min),
    media,
    eficaz,
    eficazAlterna: Math.sqrt(alterna / n),
    frecuencia,
    periodo: frecuencia === null ? null : 1 / frecuencia,
    ciclo,
    subida: subida === null ? null : subida * dt,
    bajada: bajada === null ? null : bajada * dt,
    flancoLimitado: (subida !== null && subida < 2) || (bajada !== null && bajada < 2),
    periodos,
  };
}

/** In-place radix-2 FFT of `re` + j·`im` (length a power of two). */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const r = re[i]!;
      re[i] = re[j]!;
      re[j] = r;
      const q = im[i]!;
      im[i] = im[j]!;
      im[j] = q;
    }
  }
  for (let largo = 2; largo <= n; largo <<= 1) {
    const ang = (-2 * Math.PI) / largo;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += largo) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < largo / 2; k++) {
        const a = i + k;
        const z = a + largo / 2;
        const xr = re[z]! * cr - im[z]! * ci;
        const xi = re[z]! * ci + im[z]! * cr;
        re[z] = re[a]! - xr;
        im[z] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

export const PUNTOS_ESPECTRO = 512;
/** Harmonics looked at, the fundamental included. */
export const ARMONICOS = 10;
/** Bins on each side of a tone that hold it under the Hann window, and the fewest the fundamental must be from zero. */
const LOBULO = 3;
const MINIMO_FUNDAMENTAL = 4;

export interface Tono {
  /** 1 the fundamental, 2 the second harmonic… */
  orden: number;
  /** Hertz. */
  frecuencia: number;
  /** Volts RMS. */
  eficaz: number;
}

export interface Espectro {
  /** Hertz between one point and the next; the points go from 0 to half the sampling rate. */
  resolucion: number;
  /** Volts RMS a tone exactly on each point would have (PUNTOS_ESPECTRO of them). */
  amplitudes: Float64Array;
  /** The fundamental and the harmonics that fit under half the sampling rate; empty when there is no wave to speak of. */
  tonos: Tono[];
  /** Harmonic distortion, %: the harmonics found, together, against the fundamental. Null without them. */
  distorsion: number | null;
  /** The record holds too few periods to tell the fundamental from its harmonics: no tones are given. */
  pocosPeriodos: boolean;
}

/**
 * The spectrum of a trace: a Hann window over the record without its mean, 1024 points. The fundamental is the
 * frequency the trace's crossings give (the record resolves it far better than one point of the spectrum does), and
 * each tone's size is taken from the points around it, which is where the window spreads it.
 */
export function espectro(t: Traza): Espectro {
  const m = t.muestras;
  const n = 2 * PUNTOS_ESPECTRO;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const largo = Math.min(m.length, n);
  let media = 0;
  for (let k = 0; k < largo; k++) media += voltios(t, m[k]!);
  media /= largo;
  let sumaW = 0;
  let sumaW2 = 0;
  for (let k = 0; k < largo; k++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / (largo - 1));
    re[k] = (voltios(t, m[k]!) - media) * w;
    sumaW += w;
    sumaW2 += w * w;
  }
  fft(re, im);
  const amplitudes = new Float64Array(PUNTOS_ESPECTRO);
  // (a tone of A volts RMS exactly on a point gives |X| = A·√2·ΣW/2 there)
  for (let k = 0; k < PUNTOS_ESPECTRO; k++) amplitudes[k] = (Math.SQRT2 * Math.hypot(re[k]!, im[k]!)) / sumaW;
  const resolucion = 1 / (n * t.ajustes.periodoMuestra);
  // how many points wide a tone's power comes out, under this window
  const anchoRuido = (n * sumaW2) / (sumaW * sumaW);
  const tono = (centro: number): number => {
    let p = 0;
    for (let k = Math.max(1, centro - LOBULO); k <= Math.min(PUNTOS_ESPECTRO - 1, centro + LOBULO); k++) p += amplitudes[k]! * amplitudes[k]!;
    return Math.sqrt(p / anchoRuido);
  };
  const f0 = medirAmpliado(t).frecuencia;
  const tonos: Tono[] = [];
  let pocosPeriodos = false;
  if (f0 !== null) {
    if (f0 / resolucion < MINIMO_FUNDAMENTAL) pocosPeriodos = true;
    else
      for (let orden = 1; orden <= ARMONICOS; orden++) {
        const centro = Math.round((orden * f0) / resolucion);
        if (centro + LOBULO >= PUNTOS_ESPECTRO) break;
        tonos.push({ orden, frecuencia: orden * f0, eficaz: tono(centro) });
      }
  }
  let distorsion: number | null = null;
  if (tonos.length > 1 && tonos[0]!.eficaz > 0) {
    let p = 0;
    for (const x of tonos.slice(1)) p += x.eficaz * x.eficaz;
    distorsion = (100 * Math.sqrt(p)) / tonos[0]!.eficaz;
  }
  return { resolucion, amplitudes, tonos, distorsion, pocosPeriodos };
}

/** The trace as a file: one row per sample, seconds from the first one and volts at the probe tip (decimal comma). */
export function csvTraza(t: Traza): string {
  const filas: string[][] = [];
  for (let k = 0; k < t.muestras.length; k++) filas.push([numeroCsv(k * t.ajustes.periodoMuestra), numeroCsv(voltios(t, t.muestras[k]!))]);
  return csv(['segundos', 'voltios'], filas);
}
