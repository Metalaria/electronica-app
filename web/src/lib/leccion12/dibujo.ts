// 1.2 «Dibuje la forma de onda»: the reader's drawing against the right curve. Both are sampled at the same `puntos`
// evenly spaced x; the error is the RMS difference over the height of the y axis, after forgiving a small shift along
// x and a small offset along y (both up to `holgura` of the axis): a hand never draws exactly on the grid, and a
// curve that is right but a little to one side is right. Features of the drawing (amplitude ratio, mean offset,
// shift) let the hints say what is wrong. 1.2 (motor12b): a logarithmic x axis (`escala: log`, a Bode plot) spaces the
// points evenly in log x, and the forgiven shift is a fraction of the axis in that scale too. Pure.

import type { ModeloCompilado, Valores } from '../leccion11/modelo';
import type { Dibujar } from './tipos';

/** The x at a fraction `u` (0 … 1) of the axis, in its own scale (linear, or logarithmic: evenly in log x). */
export function xEnFraccion(x: Pick<Dibujar['x'], 'min' | 'max' | 'escala'>, u: number): number {
  return x.escala === 'log' ? x.min * (x.max / x.min) ** u : x.min + (x.max - x.min) * u;
}

/** `x` moved by a fraction `u` of the axis (+ = to the right), in the axis' scale. */
function desplazar(x: Pick<Dibujar['x'], 'min' | 'max' | 'escala'>, v: number, u: number): number {
  return x.escala === 'log' ? v * (x.max / x.min) ** u : v + (x.max - x.min) * u;
}

/** The x of each point of the drawing (evenly spaced along the axis, in its scale). */
export function xsDibujo(d: Pick<Dibujar, 'x' | 'puntos'>): number[] {
  return Array.from({ length: d.puntos }, (_, k) => xEnFraccion(d.x, k / (d.puntos - 1)));
}

/** The right curve at any x (with the card's values). */
export function curvaDe(mc: ModeloCompilado, d: Dibujar, v: Valores): (x: number) => number {
  const r = mc.evaluar(v);
  const f = mc.funcion(d.curva);
  return (x) => f({ ...r, [d.x.id]: x });
}

/** The drawing with its gaps filled by straight lines (ends: the nearest drawn point); null if nothing is drawn. */
export function rellenar(ys: readonly (number | null)[]): number[] | null {
  const hechos = ys.map((y, k) => [k, y] as const).filter((p): p is readonly [number, number] => p[1] != null && Number.isFinite(p[1]));
  if (!hechos.length) return null;
  return ys.map((_, k) => {
    const a = [...hechos].reverse().find((p) => p[0] <= k);
    const b = hechos.find((p) => p[0] >= k);
    if (a && b) return a[0] === b[0] ? a[1] : a[1] + ((b[1] - a[1]) * (k - a[0])) / (b[0] - a[0]);
    return (a ?? b)![1];
  });
}

/** Fraction of the points drawn. */
export function cobertura(ys: readonly (number | null)[]): number {
  return ys.length ? ys.filter((y) => y != null).length / ys.length : 0;
}

export interface Comparacion {
  /** Normalised RMS error after the forgiven shift and offset. */
  error: number;
  /** Peak-to-peak of the drawing over the right curve's (1 = same size). */
  amplitud: number;
  /** Mean of the drawing minus the right curve's, as a fraction of the axis height (+ = drawn too high). */
  media: number;
  /** Best shift along x, as a fraction of the axis (+ = drawn late, to the right). */
  desfase: number;
  bien: boolean;
}

/** Compares a drawing with the right curve `f`. */
export function compararDibujo(d: Dibujar, ys: readonly (number | null)[], f: (x: number) => number): Comparacion {
  const u = rellenar(ys) ?? ys.map(() => (d.y.min + d.y.max) / 2);
  const xs = xsDibujo(d);
  const H = d.y.max - d.y.min;
  const ref = xs.map(f);
  const pp = (a: number[]) => Math.max(...a) - Math.min(...a);
  const media = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  let mejor = { e: Infinity, s: 0 };
  const pasos = 20;
  for (let j = -pasos; j <= pasos; j++) {
    // (s: a fraction of the axis, in its scale)
    const s = (d.holgura * j) / pasos;
    // the drawing at x matched with the curve at x − s (drawn late: s > 0)
    const r = xs.map((x) => f(desplazar(d.x, x, -s)));
    const dif = u.map((y, k) => y - r[k]!);
    const o = Math.max(-d.holgura * H, Math.min(d.holgura * H, media(dif)));
    const e = Math.sqrt(media(dif.map((x) => (x - o) ** 2))) / H;
    if (e < mejor.e - 1e-12 || (Math.abs(e - mejor.e) <= 1e-12 && Math.abs(s) < Math.abs(mejor.s))) mejor = { e, s };
  }
  const ppr = pp(ref);
  return {
    error: mejor.e,
    amplitud: ppr > 1e-12 * H ? pp(u) / ppr : pp(u) <= 0.02 * H ? 1 : Infinity,
    media: (media(u) - media(ref)) / H,
    desfase: mejor.s,
    bien: mejor.e <= d.tol + 1e-12,
  };
}

/** A y from a pointer position (fraction 0 top … 1 bottom of the plot), snapped to 1/100 of the axis. */
export function yDeFraccion(d: Pick<Dibujar, 'y'>, f: number): number {
  const c = Math.max(0, Math.min(1, f));
  const paso = (d.y.max - d.y.min) / 100;
  return Number((d.y.max - Math.round((c * (d.y.max - d.y.min)) / paso) * paso).toPrecision(12));
}
