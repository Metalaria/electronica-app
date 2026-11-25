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

/**
 * What these functions need of a trace: a record as it arrives (1023 samples of 8 bits) or an average of several
 * (promedio.ts: fewer samples, and not whole numbers any more).
 */
export type Analizable = Pick<Traza, 'canal' | 'ajustes'> & { muestras: ArrayLike<number> };

/** Volts of sample value `m` of an analysable trace. */
const v = (t: Analizable, m: number) => voltios(t as Traza, m);

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
export function medirAmpliado(t: Analizable): MedidasAmpliadas {
  const m = t.muestras;
  let min = 255;
  let max = 0;
  for (let k = 0; k < m.length; k++) {
    const x = m[k]!;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  const amplitud = max - min;
  const dt = t.ajustes.periodoMuestra;
  let s: number[] = [];
  let b: number[] = [];
  const inv = new Float64Array(m.length);
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
    const x = v(t, m[k]!);
    suma += x;
    cuadrados += x * x;
  }
  const n = Math.max(1, hasta - desde);
  const media = suma / n;
  const eficaz = Math.sqrt(cuadrados / n);
  // (the alternating part on its own pass: as the difference of two squares a flat trace would not come out at zero)
  let alterna = 0;
  for (let k = desde; k < hasta; k++) {
    const d = v(t, m[k]!) - media;
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
    minimo: v(t, min),
    maximo: v(t, max),
    picoPico: v(t, max) - v(t, min),
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
  /** Volts RMS a tone exactly on each point would have (PUNTOS_ESPECTRO of them): the picture of the spectrum. */
  amplitudes: Float64Array;
  /** The fundamental and its harmonics; empty when the samples do not hold two whole periods of a wave. */
  tonos: Tono[];
  /** Harmonic distortion, %: the harmonics found, together, against the fundamental. Null without them. */
  distorsion: number | null;
}

/**
 * The fundamental and its harmonics, each as the part of the wave that goes at that frequency: the samples of the
 * whole periods between the first and the last rising crossing, multiplied by a sine and a cosine of each harmonic
 * and added up. Over whole periods one harmonic does not leak into another, which is what lets a few periods be
 * enough (the picture of the spectrum, with its window, needs many more to keep them apart).
 */
function tonosDe(t: Analizable, s: number[]): Tono[] {
  if (s.length < 3) return [];
  const m = t.muestras;
  const dt = t.ajustes.periodoMuestra;
  const a = s[0]!;
  const b = s[s.length - 1]!;
  const periodo = (b - a) / (s.length - 1);
  const desde = Math.ceil(a);
  const hasta = Math.ceil(b);
  const n = hasta - desde;
  if (n < 8 || !(periodo > 0)) return [];
  let media = 0;
  for (let k = desde; k < hasta; k++) media += v(t, m[k]!);
  media /= n;
  const tonos: Tono[] = [];
  for (let orden = 1; orden <= ARMONICOS; orden++) {
    // (a harmonic needs a few samples to each of its periods to be told from its neighbours)
    if (periodo / orden < 2.5) break;
    let re = 0;
    let im = 0;
    for (let k = desde; k < hasta; k++) {
      const fase = (2 * Math.PI * orden * (k - a)) / periodo;
      const x = v(t, m[k]!) - media;
      re += x * Math.cos(fase);
      im -= x * Math.sin(fase);
    }
    tonos.push({ orden, frecuencia: orden / (periodo * dt), eficaz: (Math.SQRT2 * Math.hypot(re, im)) / n });
  }
  return tonos;
}

/**
 * The spectrum of a trace. Its picture: a Hann window over the samples without their mean, 1024 points. Its
 * figures (fundamental, harmonics, distortion): from the whole periods the samples hold, see `tonosDe`.
 */
export function espectro(t: Analizable): Espectro {
  const m = t.muestras;
  const n = 2 * PUNTOS_ESPECTRO;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const largo = Math.min(m.length, n);
  let media = 0;
  let min = 255;
  let max = 0;
  for (let k = 0; k < largo; k++) {
    media += v(t, m[k]!);
    if (m[k]! < min) min = m[k]!;
    if (m[k]! > max) max = m[k]!;
  }
  media /= largo;
  let sumaW = 0;
  for (let k = 0; k < largo; k++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / (largo - 1));
    re[k] = (v(t, m[k]!) - media) * w;
    sumaW += w;
  }
  fft(re, im);
  const amplitudes = new Float64Array(PUNTOS_ESPECTRO);
  // (a tone of A volts RMS exactly on a point gives |X| = A·√2·ΣW/2 there)
  for (let k = 0; k < PUNTOS_ESPECTRO; k++) amplitudes[k] = (Math.SQRT2 * Math.hypot(re[k]!, im[k]!)) / sumaW;
  const resolucion = 1 / (n * t.ajustes.periodoMuestra);
  // (under a third of a division the crossings are noise: the same rule as the measurements)
  const tonos = max - min >= 8 ? tonosDe(t, subidas(m, (max + min) / 2, Math.max(2, (max - min) / 8))) : [];
  let distorsion: number | null = null;
  if (tonos.length > 1 && tonos[0]!.eficaz > 0) {
    let p = 0;
    for (const x of tonos.slice(1)) p += x.eficaz * x.eficaz;
    distorsion = (100 * Math.sqrt(p)) / tonos[0]!.eficaz;
  }
  return { resolucion, amplitudes, tonos, distorsion };
}

/** The trace as a file: one row per sample, seconds from the first one and volts at the probe tip (decimal comma). */
export function csvTraza(t: Analizable): string {
  const filas: string[][] = [];
  for (let k = 0; k < t.muestras.length; k++) filas.push([numeroCsv(k * t.ajustes.periodoMuestra), numeroCsv(v(t, t.muestras[k]!))]);
  return csv(['segundos', 'voltios'], filas);
}
