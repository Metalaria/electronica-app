// Axis scales: linear and logarithmic mappings, «nice» ticks, data ranges and interpolation.

export type TipoEscala = 'linear' | 'log';

export interface Escala {
  tipo: TipoEscala;
  /** Data range shown. */
  min: number;
  max: number;
  /** Pixel range (a: data min, b: data max; b < a for the y axis). */
  a: number;
  b: number;
}

const t = (s: Escala, v: number) => (s.tipo === 'log' ? Math.log10(v) : v);

/** Data → pixel. */
export function aPixel(s: Escala, v: number): number {
  const lo = t(s, s.min);
  const hi = t(s, s.max);
  return s.a + ((t(s, v) - lo) / (hi - lo || 1)) * (s.b - s.a);
}

/** Pixel → data. */
export function aDato(s: Escala, px: number): number {
  const lo = t(s, s.min);
  const hi = t(s, s.max);
  const u = lo + ((px - s.a) / (s.b - s.a || 1)) * (hi - lo);
  return s.tipo === 'log' ? 10 ** u : u;
}

/** Zooms a range around a data value by a factor (<1 zooms in), in the scale's own space. */
export function ampliar(tipo: TipoEscala, [lo, hi]: [number, number], centro: number, factor: number): [number, number] {
  if (tipo === 'log') {
    const c = Math.log10(centro);
    const a = c - (c - Math.log10(lo)) * factor;
    const b = c + (Math.log10(hi) - c) * factor;
    return [10 ** a, 10 ** b];
  }
  return [centro - (centro - lo) * factor, centro + (hi - centro) * factor];
}

/** Shifts a range by a number of pixels of a scale. */
export function desplazar(s: Escala, dpx: number): [number, number] {
  return [aDato(s, s.a - dpx), aDato(s, s.b - dpx)].sort((x, y) => x - y) as [number, number];
}

/** Interpolates between two ranges (for animations), in the scale's own space. */
export function mezclarRango(tipo: TipoEscala, de: [number, number], a: [number, number], e: number): [number, number] {
  if (tipo === 'log') {
    const l = (x: number, y: number) => 10 ** (Math.log10(x) + (Math.log10(y) - Math.log10(x)) * e);
    return [l(de[0], a[0]), l(de[1], a[1])];
  }
  return [de[0] + (a[0] - de[0]) * e, de[1] + (a[1] - de[1]) * e];
}

// ------------------------------------------------------------------ ticks

/** Linear ticks with steps 1, 2 or 5 × 10ⁿ, about one every `px` pixels. */
export function marcasLineales(min: number, max: number, largo: number, px = 70): number[] {
  if (!(max > min)) return [min];
  const n = Math.max(2, Math.round(largo / px));
  const bruto = (max - min) / n;
  const p = 10 ** Math.floor(Math.log10(bruto));
  const f = bruto / p;
  const paso = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  const res: number[] = [];
  for (let v = Math.ceil(min / paso - 1e-9) * paso; v <= max + paso * 1e-9; v += paso) {
    res.push(Math.abs(v) < paso * 1e-9 ? 0 : Number(v.toPrecision(12)));
    if (res.length > 200) break;
  }
  return res;
}

/** Log ticks: the decades (labelled) and, when there is room, 2 and 5 (labelled) and the rest (grid only). */
export function marcasLog(min: number, max: number, largo: number): { mayores: number[]; menores: number[] } {
  const d0 = Math.floor(Math.log10(min));
  const d1 = Math.ceil(Math.log10(max));
  const decadas = d1 - d0;
  const porDecada = largo / Math.max(1, Math.log10(max / min));
  const mayores: number[] = [];
  const menores: number[] = [];
  const salto = Math.max(1, Math.ceil(decadas / Math.max(1, largo / 60)));
  for (let d = d0; d <= d1; d++) {
    for (let k = 1; k <= 9; k++) {
      const v = Number((k * 10 ** d).toPrecision(6));
      if (v < min * 0.9999 || v > max * 1.0001) continue;
      if (k === 1 && (d - d0) % salto === 0) mayores.push(v);
      else if ((k === 2 || k === 5) && porDecada > 150) mayores.push(v);
      else if (porDecada > 25) menores.push(v);
    }
  }
  if (mayores.length < 2 && min > 0) {
    // Less than a decade on screen: fall back to linear ticks.
    return { mayores: marcasLineales(min, max, largo).filter((v) => v > 0), menores: [] };
  }
  return { mayores, menores };
}

// ------------------------------------------------------------------ data helpers

/** Whether an array never decreases (or never increases): then binary search and decimation apply. */
export function monotona(x: Float64Array): 1 | -1 | 0 {
  let sube = true;
  let baja = true;
  for (let i = 1; i < x.length && (sube || baja); i++) {
    if (x[i]! < x[i - 1]!) sube = false;
    if (x[i]! > x[i - 1]!) baja = false;
  }
  return sube ? 1 : baja ? -1 : 0;
}

/** First index with x[i] >= v in an increasing array. */
export function buscar(x: Float64Array, v: number): number {
  let lo = 0;
  let hi = x.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (x[m]! < v) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/**
 * y at x = v, linearly interpolated (in log x when the axis is logarithmic). Increasing x: binary search;
 * otherwise the nearest sample. NaN outside the data.
 */
export function interpolar(x: Float64Array, y: Float64Array, v: number, orden: 1 | -1 | 0, logX = false): number {
  const n = Math.min(x.length, y.length);
  if (!n) return NaN;
  if (orden === 1) {
    if (v < x[0]! || v > x[n - 1]!) return NaN;
    const i = Math.min(n - 1, buscar(x, v));
    if (i === 0 || x[i] === v) return y[i]!;
    const x0 = x[i - 1]!;
    const x1 = x[i]!;
    const u = logX && x0 > 0 && x1 > 0 ? Math.log(v / x0) / Math.log(x1 / x0) : (v - x0) / (x1 - x0);
    return y[i - 1]! + (y[i]! - y[i - 1]!) * u;
  }
  let mejor = 0;
  let d = Infinity;
  for (let i = 0; i < n; i++) {
    const e = Math.abs(x[i]! - v);
    if (e < d) {
      d = e;
      mejor = i;
    }
  }
  return y[mejor]!;
}

/** Finite (and, for a log axis, positive) extent of some arrays, optionally restricted to an x window. */
export function extension(
  pares: { x: Float64Array; y: Float64Array; orden: 1 | -1 | 0 }[],
  eje: 'x' | 'y',
  log: boolean,
  ventana?: [number, number],
): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of pares) {
    const n = Math.min(p.x.length, p.y.length);
    let i0 = 0;
    let i1 = n;
    if (ventana && eje === 'y' && p.orden === 1) {
      i0 = Math.max(0, buscar(p.x, ventana[0]) - 1);
      i1 = Math.min(n, buscar(p.x, ventana[1]) + 1);
    }
    const arr = eje === 'x' ? p.x : p.y;
    for (let i = i0; i < i1; i++) {
      const v = arr[i]!;
      if (!Number.isFinite(v) || (log && v <= 0)) continue;
      if (ventana && eje === 'y' && p.orden !== 1) {
        const xv = p.x[i]!;
        if (xv < ventana[0] || xv > ventana[1]) continue;
      }
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return lo <= hi ? [lo, hi] : null;
}

/** A displayable range from a data extent: padded (y), never empty. */
export function rangoBonito(ext: [number, number] | null, log: boolean, margen: number): [number, number] {
  if (!ext) return log ? [1, 10] : [0, 1];
  let [lo, hi] = ext;
  if (log) {
    if (lo === hi) return [lo / 2, hi * 2];
    const f = (Math.log10(hi) - Math.log10(lo)) * margen;
    return [10 ** (Math.log10(lo) - f), 10 ** (Math.log10(hi) + f)];
  }
  if (lo === hi) {
    const d = Math.abs(lo) * 0.1 || 1;
    return [lo - d, hi + d];
  }
  const d = (hi - lo) * margen;
  return [lo - d, hi + d];
}
