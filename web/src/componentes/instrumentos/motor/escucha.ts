// Listening to a node (0.10): what a simulated waveform would sound like in an earphone. The node's transient
// is turned into audio samples: DC removed, resampled to the audio rate and, for a repeating signal, one
// period repeated over about a second (exactly periodic, so the loop does not click and the pitch is right
// whatever the ratio of the period to the sample time). Only signals in or near the audio band (20 Hz–20 kHz)
// give a tone; for slower ones the explanation and their edges as clicks, for faster ones (radio) the
// explanation and, when the amplitude changes, the envelope a detector would give. Plain TypeScript (Node too).

import { frecuencia, interpolar, media, type Serie } from './senal.ts';
import { formatoSI } from '../../grafica/formato.ts';

export type TipoEscucha = 'tono' | 'lento' | 'rf' | 'continua' | 'irregular';

export interface Sonido {
  /** Samples (V, without DC) at the audio rate. */
  muestras: Float32Array;
  /** Repeat them (a periodic signal) or play them once. */
  bucle: boolean;
}

export interface Escucha {
  tipo: TipoEscucha;
  /** Repetition frequency (Hz), when found. */
  f: number | null;
  /** Peak-to-peak voltage of the stretch (V). */
  vpp: number;
  /** What is heard, or why nothing is (Spanish). */
  texto: string;
  /** What to play, or null. */
  sonido: Sonido | null;
  /** Something else worth hearing (the envelope of a radio signal, the clicks of a slow one). */
  alternativa?: { etiqueta: string; texto: string; sonido: Sonido };
}

/** The audible band (Hz). */
export const BANDA = { min: 20, max: 20000 };

const fmt = (v: number, u: string) => formatoSI(v, u, 3).replace('.', ',');

/** Samples of `s` over [a, a + periodos·T] repeated to about `segundos` (exactly periodic), DC removed. */
function periodico(s: Serie, a: number, T: number, tasa: number, segundos = 1): Float32Array {
  const M = Math.max(1, Math.round(segundos / T));
  const L = Math.max(2, Math.round((M * T) * tasa));
  // One period sampled finely, its mean removed.
  const n = Math.max(64, Math.min(48000, Math.ceil(T * tasa * 4)));
  const pista = { i: 0 };
  const per = new Float64Array(n);
  let m = 0;
  for (let k = 0; k < n; k++) {
    per[k] = interpolar(s, a + (k / n) * T, pista);
    m += per[k]!;
  }
  m /= n;
  const out = new Float32Array(L);
  for (let k = 0; k < L; k++) {
    const fase = ((k * M) / L) % 1;
    const x = fase * n;
    const i = Math.floor(x);
    const fr = x - i;
    const y0 = per[i % n]!;
    const y1 = per[(i + 1) % n]!;
    out[k] = y0 + fr * (y1 - y0) - m;
  }
  return out;
}

/** The whole stretch resampled, DC removed (played once). */
function tramo(s: Serie, tasa: number): Float32Array {
  const t0 = s.t[0]!;
  const t1 = s.t[s.t.length - 1]!;
  const L = Math.max(2, Math.min(tasa * 4, Math.round((t1 - t0) * tasa)));
  const m = media(s);
  const out = new Float32Array(L);
  const pista = { i: 0 };
  for (let k = 0; k < L; k++) out[k] = interpolar(s, t0 + (k / tasa), pista) - m;
  // Short fades at both ends (no click on start and stop).
  const r = Math.min(Math.floor(L / 4), Math.round(tasa * 0.005));
  for (let k = 0; k < r; k++) {
    out[k] = out[k]! * (k / r);
    out[L - 1 - k] = out[L - 1 - k]! * (k / r);
  }
  return out;
}

/** Clicks: the stretch through a first-order high-pass at 300 Hz (only the fast changes remain). */
function chasquidos(s: Serie, tasa: number, periodo: { a: number; T: number } | null): Sonido {
  // (a period of more than four seconds is played as the stretch, once)
  const bucle = periodo && periodo.T <= 4 ? periodo : null;
  const base = bucle ? periodico(s, bucle.a, bucle.T, tasa, Math.max(1, bucle.T * 2)) : tramo(s, tasa);
  const rc = 1 / (2 * Math.PI * 300);
  const k = rc / (rc + 1 / tasa);
  const out = new Float32Array(base.length);
  let yPrev = 0;
  let xPrev = base[0] ?? 0;
  // Two passes over a loop so its start is already settled.
  for (let pasada = 0; pasada < (bucle ? 2 : 1); pasada++)
    for (let i = 0; i < base.length; i++) {
      const y = k * (yPrev + base[i]! - xPrev);
      xPrev = base[i]!;
      yPrev = y;
      out[i] = y;
    }
  return { muestras: out, bucle: !!bucle };
}

/** Peak envelope of a fast signal: half the peak-to-peak value over each carrier period. */
function envolvente(s: Serie, f: number): Serie {
  const T = 1 / f;
  const t0 = s.t[0]!;
  const t1 = s.t[s.t.length - 1]!;
  const n = Math.floor((t1 - t0) / T);
  const t = new Float64Array(n);
  const y = new Float64Array(n);
  let i = 0;
  for (let k = 0; k < n; k++) {
    const a = t0 + k * T;
    const b = a + T;
    let max = -Infinity;
    let min = Infinity;
    while (i < s.t.length && s.t[i]! < a) i++;
    let j = i;
    while (j < s.t.length && s.t[j]! <= b) {
      const v = s.y[j]!;
      if (v > max) max = v;
      if (v < min) min = v;
      j++;
    }
    t[k] = a + T / 2;
    y[k] = max > min ? (max - min) / 2 : 0;
  }
  return { t, y };
}

/** What a stretch of a node's voltage sounds like, at an audio sample rate `tasa`. */
export function prepararEscucha(s: Serie | number, tasa: number): Escucha {
  if (typeof s === 'number')
    return { tipo: 'continua', f: null, vpp: 0, texto: `En ese punto la tensión es continua (${fmt(s, 'V')}): un auricular solo suena cuando la tensión cambia.`, sonido: null };
  let max = -Infinity;
  let min = Infinity;
  for (const v of s.y) {
    if (v > max) max = v;
    if (v < min) min = v;
  }
  const vpp = max - min;
  const m = media(s);
  if (!(vpp > 1e-4 * Math.max(1, Math.abs(m))))
    return { tipo: 'continua', f: null, vpp, texto: `En ese punto la tensión apenas cambia (${fmt(m, 'V')} de continua): un auricular solo suena cuando la tensión cambia.`, sonido: null };
  const r = frecuencia(s, (max + min) / 2, vpp * 0.1);
  const dur = s.t[s.t.length - 1]! - s.t[0]!;
  if (!r) {
    return {
      tipo: 'irregular',
      f: null,
      vpp,
      texto: `La señal (${fmt(vpp, 'V')} pico a pico) no se repite en el tramo simulado (${fmt(dur, 's')}): se oye ese tramo una vez. Si cambia más despacio de 20 veces por segundo, el oído solo notaría chasquidos.`,
      sonido: { muestras: tramo(s, tasa), bucle: false },
    };
  }
  const T = 1 / r.f;
  // The last whole period found.
  const a = r.t0 + (r.n - 1) * T;
  if (r.f < BANDA.min) {
    return {
      tipo: 'lento',
      f: r.f,
      vpp,
      texto: `La señal se repite ${String(Math.round(r.f * 10) / 10).replace('.', ',')} veces por segundo (${fmt(r.f, 'Hz')}), menos de 20: el oído no la oye como un tono. Un auricular solo daría un chasquido en cada cambio brusco.`,
      sonido: null,
      alternativa: { etiqueta: 'Oír los chasquidos', texto: 'Los cambios bruscos de la señal, como los daría un auricular.', sonido: chasquidos(s, tasa, { a, T }) },
    };
  }
  if (r.f > BANDA.max) {
    const env = envolvente(s, r.f);
    let emax = -Infinity;
    let emin = Infinity;
    for (const v of env.y) {
      if (v > emax) emax = v;
      if (v < emin) emin = v;
    }
    const varia = env.y.length > 8 && emax > 0 && (emax - emin) / emax > 0.1;
    const res: Escucha = {
      tipo: 'rf',
      f: r.f,
      vpp,
      texto: `La señal oscila a ${fmt(r.f, 'Hz')}, por encima de lo que oye el oído (unos 20 kHz): en un auricular no se oiría nada.${varia ? ' Su amplitud sí cambia: se puede oír la envolvente, lo que daría un detector de AM.' : ' Su amplitud no cambia, así que tampoco hay envolvente que oír.'}`,
      sonido: null,
    };
    if (varia) {
      const re = frecuencia(env, (emax + emin) / 2, (emax - emin) * 0.1);
      const sonido: Sonido =
        re && re.f >= BANDA.min && re.f <= BANDA.max ? { muestras: periodico(env, re.t0 + (re.n - 1) / re.f, 1 / re.f, tasa), bucle: true } : { muestras: tramo(env, tasa), bucle: false };
      res.alternativa = {
        etiqueta: 'Oír la envolvente',
        texto: re ? `La envolvente es un tono de ${fmt(re.f, 'Hz')}.` : `La envolvente del tramo simulado (${fmt(dur, 's')}).`,
        sonido,
      };
    }
    return res;
  }
  return {
    tipo: 'tono',
    f: r.f,
    vpp,
    texto: `Un tono de ${fmt(r.f, 'Hz')} (${fmt(vpp, 'V')} pico a pico).`,
    sonido: { muestras: periodico(s, a, T, tasa), bucle: true },
  };
}
