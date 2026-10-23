// Waveforms of the test points and of the signal path. TP1 and TP3's DC level come from the DC operating point;
// the AC signals are synthesised from what the book describes (labelled «sintetizada» in the app): the MPX of
// section 15.4 (L+R up to 15 kHz, pilot at 19 kHz, L−R around a suppressed 38 kHz subcarrier), the 10,7 MHz IF,
// the 38 kHz VCO; the FNIRSI traces of figure 15.16 are drawn as the book's reference.

import type { Series } from '../grafica';
import { leerJSON } from '../../lib/datos';
import type { DatosFigura, SerieLinea } from '../figuras-vivas/tipos';
import { FI, Q_RF, fiDb, resonancia, type EstadoRadio } from './fisica';
import type { EmisoraSimulada } from './tipos';

const TAU = 2 * Math.PI;

/** Deterministic noise (so a redraw does not flicker): xorshift, roughly uniform in −1…1. */
function ruido(semilla: number): () => number {
  let s = semilla >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

/** The programme of the simulated station: left and right audio (−1…1). */
export function programa(t: number, estereo: boolean): [number, number] {
  const l = 0.55 * Math.sin(TAU * 440 * t) + 0.22 * Math.sin(TAU * 1320 * t + 0.7) + 0.12 * Math.sin(TAU * 2950 * t);
  const r = estereo ? 0.5 * Math.sin(TAU * 660 * t + 1.1) + 0.2 * Math.sin(TAU * 1760 * t) + 0.1 * Math.sin(TAU * 4100 * t + 2) : l;
  return [l, r];
}

/** MPX at the detector output (V, DC included): amplitude about ±150 mV as in figure 15.16. */
export function mpx(r: EstadoRadio, n: number, dt: number, acoplo: 'dc' | 'ac'): { t: Float64Array; v: Float64Array } {
  const t = new Float64Array(n);
  const v = new Float64Array(n);
  const rnd = ruido(12345);
  const hay = !!r.emisora && r.alimentada;
  const est = hay && r.emisora!.estereo;
  const amp = hay ? 0.075 * r.calidadDetector * Math.min(1, Math.max(0, (r.nivel - 12) / 12)) : 0;
  const ruidoAmp = 0.06 * (hay ? Math.min(1, 1 / (1 + 10 ** ((r.nivel - 26) / 8))) : 1);
  for (let i = 0; i < n; i++) {
    const ti = i * dt;
    const [l, rr] = programa(ti, est);
    let s = (l + rr) / 2;
    if (est) s += 0.1 * Math.sin(TAU * 19e3 * ti) + ((l - rr) / 2) * Math.sin(TAU * 38e3 * ti);
    t[i] = ti;
    v[i] = (acoplo === 'dc' ? r.vTP3 : 0) + amp * 2 * s + ruidoAmp * rnd();
  }
  return { t, v };
}

/** 10,7 MHz at the IF input of IC3 (TP2), as seen with a ×10 probe (V at the tip); amplitude illustrative. */
export function senalFI(r: EstadoRadio, n: number, dt: number): { t: Float64Array; v: Float64Array } {
  const t = new Float64Array(n);
  const v = new Float64Array(n);
  const rnd = ruido(777);
  const hay = !!r.emisora && r.fOL != null && r.alimentada;
  const a = hay ? Math.min(0.12, 0.004 * 10 ** ((r.nivel - 20) / 30)) : 0;
  const f = r.fIF;
  for (let i = 0; i < n; i++) {
    t[i] = i * dt;
    v[i] = a * Math.sin(TAU * f * t[i]!) + (r.alimentada ? 0.004 : 0) * rnd();
  }
  return { t, v };
}

/** VCO at TP4: a rounded square wave (illustrative amplitude), or a flat line when there is none. */
export function senalVCO(f: number | null, n: number, dt: number): { t: Float64Array; v: Float64Array } {
  const t = new Float64Array(n);
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    t[i] = i * dt;
    v[i] = f ? 0.5 * Math.tanh(4 * Math.sin(TAU * f * t[i]!)) : 0;
  }
  return { t, v };
}

/** Audio at a speaker (V): about 0,5 V peak at mid volume (the scale of figure 15.16's CZ3 trace). */
export function senalAudio(r: EstadoRadio, canal: 'L' | 'R', n: number, dt: number): { t: Float64Array; v: Float64Array } {
  const t = new Float64Array(n);
  const v = new Float64Array(n);
  const rnd = ruido(canal === 'L' ? 99 : 101);
  const g = canal === 'L' ? r.audioL : r.audioR;
  const est = !!r.emisora?.estereo && r.estereo;
  for (let i = 0; i < n; i++) {
    t[i] = i * dt;
    const [l, rr] = programa(t[i]!, est);
    v[i] = 2.2 * g * (canal === 'L' ? l : rr) + 0.6 * r.siseo * rnd() * (canal === 'R' && r.audioR === 0 && r.audioL > 0 ? 0 : 1);
  }
  return { t, v };
}

/** Magnitude spectrum in dB relative to its maximum (Hann window, radix-2 FFT). */
export function espectro(v: Float64Array, dt: number): { f: Float64Array; db: Float64Array } {
  let n = 1;
  while (n * 2 <= v.length) n *= 2;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  let media = 0;
  for (let i = 0; i < n; i++) media += v[i]!;
  media /= n;
  for (let i = 0; i < n; i++) re[i] = (v[i]! - media) * (0.5 - 0.5 * Math.cos((TAU * i) / (n - 1)));
  for (let i = 1, j = 0; i < n; i++) {
    let b = n >> 1;
    for (; j & b; b >>= 1) j ^= b;
    j ^= b;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -TAU / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b]! * wr - im[b]! * wi;
        const xi = re[b]! * wi + im[b]! * wr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
      }
    }
  }
  const m = n / 2;
  const f = new Float64Array(m);
  const db = new Float64Array(m);
  let max = 1e-30;
  for (let k = 0; k < m; k++) {
    const mag = Math.hypot(re[k]!, im[k]!);
    db[k] = mag;
    if (mag > max) max = mag;
    f[k] = k / (n * dt);
  }
  for (let k = 0; k < m; k++) db[k] = Math.max(-90, 20 * Math.log10(db[k]! / max + 1e-12));
  return { f, db };
}

/** The radio band as the RF input sees it: station levels (stems) and the RF tank response, dB. */
export function bandaRF(r: EstadoRadio, emisoras: EmisoraSimulada[]): Series[] {
  const n = 400;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = 86e6 + (24e6 * i) / (n - 1);
    y[i] = 80 + 20 * Math.log10(resonancia(x[i]!, r.fRF, Q_RF));
  }
  const ex: number[] = [];
  const ey: number[] = [];
  for (const e of emisoras) {
    ex.push(e.f * 1e6, e.f * 1e6, e.f * 1e6);
    ey.push(0, e.nivel, NaN);
  }
  const s: Series[] = [
    { name: 'Emisoras simuladas (dBµV en la antena)', unit: '', x: Float64Array.from(ex), y: Float64Array.from(ey) },
    { name: 'Circuito de entrada L1 + C4A (relativo)', unit: '', x, y, dashed: true },
  ];
  if (r.fRx != null) s.push({ name: 'Frecuencia sintonizada', unit: '', x: Float64Array.from([r.fRx, r.fRx]), y: Float64Array.from([0, 90]) });
  if (r.fOL != null) s.push({ name: 'Oscilador local (fuera de escala si > 110 MHz)', unit: '', x: Float64Array.from([Math.min(r.fOL, 110e6), Math.min(r.fOL, 110e6)]), y: Float64Array.from([0, 60]) });
  return s;
}

/** The IF passband (two ceramic filters) and B1, around 10,7 MHz, with the received station's IF. */
export function bandaFI(r: EstadoRadio): Series[] {
  const n = 300;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const yb = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = FI - 800e3 + (1600e3 * i) / (n - 1);
    y[i] = fiDb(x[i]! - FI);
    yb[i] = 20 * Math.log10(resonancia(x[i]!, r.fB1, 20));
  }
  const s: Series[] = [
    { name: 'Filtros cerámicos CF1 + CF2', unit: 'dB', x, y },
    { name: 'Transformador B1', unit: 'dB', x, y: yb, dashed: true },
  ];
  if (r.emisora) s.push({ name: 'FI de la emisora', unit: 'dB', x: Float64Array.from([r.fIF, r.fIF]), y: Float64Array.from([-60, 3]) });
  return s;
}

/** Discriminator S-curve: TP3 against the IF, with the centre of B2. */
export function curvaS(r: EstadoRadio, tp3: (f: number, c: number, s: number) => number): Series[] {
  const n = 200;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = FI - 500e3 + (1000e3 * i) / (n - 1);
    y[i] = tp3(x[i]!, r.fB2, 1);
  }
  const s: Series[] = [{ name: 'TP3 (V) frente a la FI', unit: 'V', x, y }];
  if (r.emisora) s.push({ name: 'FI de la emisora', unit: 'V', x: Float64Array.from([r.fIF, r.fIF]), y: Float64Array.from([3.9, 5.3]) });
  s.push({ name: '4,6 V (objetivo del libro)', unit: 'V', x: Float64Array.from([FI - 500e3, FI + 500e3]), y: Float64Array.from([4.6, 4.6]), dashed: true });
  return s;
}

// ------------------------------------------------------------------ the book's FNIRSI traces (figure 15.16)
export interface TrazasLibro {
  audio: Series | null;
  mpx: Series | null;
  fft: Series | null;
  rizado: Series | null;
}

let trazas: Promise<TrazasLibro> | null = null;

/** Traces of figure 15.16 (datos/16.15.json), converted to SI units. */
export function trazasLibro(): Promise<TrazasLibro> {
  trazas ??= leerJSON<DatosFigura>('datos/16.15.json')
    .then((d) => {
      const serie = (i: number, nombre: string, unidad: string, fx: number, fy: number): Series | null => {
        const s = d.ejes[i]?.series?.find((x) => x.tipo === 'linea') as SerieLinea | undefined;
        if (!s) return null;
        const xs: number[] = [];
        const ys: number[] = [];
        s.x.forEach((xv, k) => {
          const yv = s.y[k];
          if (xv != null && yv != null) {
            xs.push(xv * fx);
            ys.push(yv * fy);
          }
        });
        return { name: nombre, unit: unidad, x: Float64Array.from(xs), y: Float64Array.from(ys), dashed: true };
      };
      return {
        audio: serie(0, 'Figura 15.16 (libro)', 'V', 1e-3, 1),
        mpx: serie(1, 'Figura 15.16 (libro)', 'V', 1e-3, 1e-3),
        fft: serie(2, 'Figura 15.16 (libro)', 'dB', 1e3, 1),
        rizado: serie(3, 'Figura 15.16 (libro)', 'V', 1e-3, 1e-3),
      };
    })
    .catch(() => ({ audio: null, mpx: null, fft: null, rizado: null }));
  return trazas;
}
