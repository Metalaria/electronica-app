// Signal helpers: radix-2 FFT, windows, deterministic noise.

/** In-place radix-2 FFT (n a power of two). */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]!;
      re[i] = re[j]!;
      re[j] = t;
      t = im[i]!;
      im[i] = im[j]!;
      im[j] = t;
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

export type Ventana = 'rectangular' | 'hann' | 'flattop';

/** Window coefficients and their coherent gain (mean value), to read amplitudes correctly. */
export function ventana(tipo: Ventana, n: number): { w: Float64Array; ganancia: number } {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = (2 * Math.PI * i) / n;
    w[i] =
      tipo === 'hann'
        ? 0.5 - 0.5 * Math.cos(x)
        : tipo === 'flattop'
          ? 0.21557895 - 0.41663158 * Math.cos(x) + 0.277263158 * Math.cos(2 * x) - 0.083578947 * Math.cos(3 * x) + 0.006947368 * Math.cos(4 * x)
          : 1;
  }
  let s = 0;
  for (let i = 0; i < n; i++) s += w[i]!;
  return { w, ganancia: s / n };
}

/** Deterministic Gaussian-ish noise (sum of uniforms from mulberry32), unit RMS. */
export function generadorRuido(semilla: number): () => number {
  let a = semilla >>> 0;
  const u = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Irwin–Hall with 6 terms: variance 6/12 = 0,5, scaled to 1.
  return () => (u() + u() + u() + u() + u() + u() - 3) * Math.SQRT2;
}

export function dB(x: number): number {
  return 20 * Math.log10(Math.max(Math.abs(x), 1e-12));
}
