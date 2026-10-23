// Signal arithmetic shared by the instruments: windows of a simulated waveform, statistics, a radix-2 FFT,
// band-limited RMS and a frequency counter. Times and values are SI. No DOM.

export interface Serie {
  t: Float64Array;
  y: Float64Array;
}

/** Linear interpolation of a (time-sorted) waveform at time x. `pista` speeds up monotonic queries. */
export function interpolar(s: Serie, x: number, pista = { i: 0 }): number {
  const { t, y } = s;
  const n = t.length;
  if (!n) return 0;
  if (x <= t[0]!) return y[0]!;
  if (x >= t[n - 1]!) return y[n - 1]!;
  let i = Math.min(Math.max(pista.i, 0), n - 2);
  if (t[i]! > x) {
    // Binary search backwards.
    let lo = 0;
    let hi = i;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (t[m]! <= x) lo = m;
      else hi = m;
    }
    i = lo;
  } else {
    while (i < n - 2 && t[i + 1]! <= x) {
      // Jump ahead quickly over long stretches.
      if (i + 64 < n - 1 && t[i + 64]! <= x) i += 64;
      else i++;
    }
  }
  pista.i = i;
  const t0 = t[i]!;
  const t1 = t[i + 1]!;
  const a = t1 > t0 ? (x - t0) / (t1 - t0) : 0;
  return y[i]! + a * (y[i + 1]! - y[i]!);
}

/** The part of a waveform between two times (inclusive, interpolated ends). */
export function recortar(s: Serie, desde: number, hasta: number): Serie {
  const { t, y } = s;
  let a = 0;
  while (a < t.length && t[a]! < desde) a++;
  let b = t.length - 1;
  while (b > a && t[b]! > hasta) b--;
  const n = Math.max(0, b - a + 1);
  const tt = new Float64Array(n + 2);
  const yy = new Float64Array(n + 2);
  tt[0] = desde;
  yy[0] = interpolar(s, desde);
  for (let k = 0; k < n; k++) {
    tt[k + 1] = t[a + k]!;
    yy[k + 1] = y[a + k]!;
  }
  tt[n + 1] = hasta;
  yy[n + 1] = interpolar(s, hasta);
  return { t: tt, y: yy };
}

/** Uniform resampling of a window into `n` points. */
export function remuestrear(s: Serie, desde: number, hasta: number, n: number): Float64Array {
  const out = new Float64Array(n);
  const dt = (hasta - desde) / n;
  const pista = { i: 0 };
  for (let k = 0; k < n; k++) out[k] = interpolar(s, desde + k * dt, pista);
  return out;
}

/** Time average (trapezoids: the simulator's steps are not uniform). */
export function media(s: Serie): number {
  const { t, y } = s;
  if (t.length < 2) return y[0] ?? 0;
  let area = 0;
  for (let i = 1; i < t.length; i++) area += ((y[i]! + y[i - 1]!) / 2) * (t[i]! - t[i - 1]!);
  const T = t[t.length - 1]! - t[0]!;
  return T > 0 ? area / T : y[0]!;
}

export function extremos(s: Serie): { max: number; min: number } {
  let max = -Infinity;
  let min = Infinity;
  for (const v of s.y) {
    if (v > max) max = v;
    if (v < min) min = v;
  }
  return { max, min };
}

// ------------------------------------------------------------------ FFT

/** In-place radix-2 FFT (n a power of two). */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b]! * cr - im[b]! * ci;
        const xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

/**
 * RMS of a window with a frequency weighting |H(f)| (the meter's bandwidth): the window is resampled
 * uniformly, transformed, weighted and summed (Parseval). With `conDc` the DC term is included.
 */
export function rmsPonderado(s: Serie, desde: number, hasta: number, H: (f: number) => number, conDc: boolean): number {
  const N = 4096;
  const x = remuestrear(s, desde, hasta, N);
  const re = Float64Array.from(x);
  const im = new Float64Array(N);
  fft(re, im);
  const T = hasta - desde;
  let p = conDc ? (re[0]! / N) ** 2 : 0;
  for (let k = 1; k <= N / 2; k++) {
    const a2 = (re[k]! ** 2 + im[k]! ** 2) / (N * N);
    const f = k / T;
    const h = H(f);
    // Bins 1 … N/2−1 appear twice (positive and negative frequency); N/2 once.
    p += (k === N / 2 ? 1 : 2) * a2 * h * h;
  }
  return Math.sqrt(p);
}

/**
 * Frequency counter: rising crossings of the mean with hysteresis ±h around it. Returns the frequency
 * (Hz) over whole periods, or null when fewer than two crossings are found.
 */
export function frecuencia(s: Serie, nivel: number, h: number): { f: number; n: number; ciclo: number; t0: number } | null {
  const { t, y } = s;
  let estado = y[0]! > nivel ? 1 : -1;
  const subidas: number[] = [];
  const bajadas: number[] = [];
  for (let i = 1; i < t.length; i++) {
    const v = y[i]!;
    if (estado < 0 && v > nivel + h) {
      estado = 1;
      subidas.push(cruce(t, y, i, nivel));
    } else if (estado > 0 && v < nivel - h) {
      estado = -1;
      bajadas.push(cruce(t, y, i, nivel));
    }
  }
  if (subidas.length < 2) return null;
  const n = subidas.length - 1;
  const T = (subidas[n]! - subidas[0]!) / n;
  if (!(T > 0)) return null;
  // Duty cycle: time high between the first and last rising crossing.
  let alto = 0;
  for (let k = 0; k < n; k++) {
    const b = bajadas.find((x) => x > subidas[k]! && x < subidas[k + 1]!);
    if (b !== undefined) alto += b - subidas[k]!;
  }
  return { f: 1 / T, n, ciclo: (alto / (n * T)) * 100, t0: subidas[0]! };
}

function cruce(t: Float64Array, y: Float64Array, i: number, nivel: number): number {
  // Back to the sample before the crossing of the level itself.
  let j = i;
  const sube = y[i]! > nivel;
  while (j > 0 && (sube ? y[j - 1]! > nivel : y[j - 1]! < nivel)) j--;
  if (j === 0) return t[0]!;
  const y0 = y[j - 1]!;
  const y1 = y[j]!;
  const a = y1 !== y0 ? (nivel - y0) / (y1 - y0) : 0;
  return t[j - 1]! + a * (t[j]! - t[j - 1]!);
}

/** Deterministic pseudo-random number in [−1, 1) from a text (a fixed calibration error per range). */
export function azarFijo(clave: string): number {
  let h = 2166136261;
  for (let i = 0; i < clave.length; i++) {
    h ^= clave.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

/** Gaussian random number (Box–Muller). */
export function gauss(): number {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}
