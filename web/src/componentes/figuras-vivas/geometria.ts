// Coordinates of the figure data (ESQUEMA.md, «Datos de figuras»): data ↔ SVG user units for an Axes,
// drawing units → SVG for a schematic, and small geometry helpers (distances, polylines).

import type { Afin, Caja, EjeDatos, Ejes, Punto } from './tipos';

/** Scale transform of an axis: identity, log10 or symlog (linear inside ±linthresh). */
export function transformada(e: EjeDatos): { f: (v: number) => number; inv: (u: number) => number } {
  if (e.escala === 'log') return { f: (v) => Math.log10(v), inv: (u) => 10 ** u };
  if (e.escala === 'symlog') {
    const c = e.linthresh || 1;
    return {
      f: (v) => (Math.abs(v) <= c ? v / c : Math.sign(v) * (1 + Math.log10(Math.abs(v) / c))),
      inv: (u) => (Math.abs(u) <= 1 ? u * c : Math.sign(u) * c * 10 ** (Math.abs(u) - 1)),
    };
  }
  return { f: (v) => v, inv: (u) => u };
}

export interface Mapa {
  caja: Caja;
  /** Data → SVG. */
  x: (v: number) => number;
  y: (v: number) => number;
  /** SVG → data. */
  xi: (X: number) => number;
  yi: (Y: number) => number;
  logX: boolean;
}

/** The data ↔ SVG mapping of an Axes with numeric x and y. */
export function mapa(ej: Ejes): Mapa | null {
  if (!ej.x || !ej.y) return null;
  const [X, Y, W, H] = ej.pos_svg;
  const tx = transformada(ej.x);
  const ty = transformada(ej.y);
  const x0 = tx.f(ej.x.lim[0]);
  const x1 = tx.f(ej.x.lim[1]);
  const y0 = ty.f(ej.y.lim[0]);
  const y1 = ty.f(ej.y.lim[1]);
  const dx = x1 - x0 || 1;
  const dy = y1 - y0 || 1;
  return {
    caja: ej.pos_svg,
    x: (v) => X + (W * (tx.f(v) - x0)) / dx,
    y: (v) => Y + H * (1 - (ty.f(v) - y0) / dy),
    xi: (P) => tx.inv(x0 + ((P - X) / (W || 1)) * dx),
    yi: (P) => ty.inv(y0 + (1 - (P - Y) / (H || 1)) * dy),
    logX: ej.x.escala === 'log',
  };
}

/** Drawing units (schemdraw, y up) → SVG. */
export function afin(a: Afin, p: Punto): Punto {
  return [a.sx * p[0] + a.tx, a.sy * p[1] + a.ty];
}

export function dentro(c: Caja, X: number, Y: number, margen = 0): boolean {
  return X >= c[0] - margen && X <= c[0] + c[2] + margen && Y >= c[1] - margen && Y <= c[1] + c[3] + margen;
}

/** Distance from a point to a segment. */
export function distSegmento(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l = dx * dx + dy * dy;
  let u = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
  u = Math.max(0, Math.min(1, u));
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}

export function distPolilinea(px: number, py: number, pts: Punto[]): number {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    d = Math.min(d, distSegmento(px, py, a[0], a[1], b[0], b[1]));
  }
  if (pts.length === 1) d = Math.hypot(px - pts[0]![0], py - pts[0]![1]);
  return d;
}

/** Distance from a point to a rectangle (0 inside). */
export function distRect(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = Math.max(Math.min(x0, x1) - px, 0, px - Math.max(x0, x1));
  const dy = Math.max(Math.min(y0, y1) - py, 0, py - Math.max(y0, y1));
  return Math.hypot(dx, dy);
}

/** Polyline with its cumulative lengths (for placing particles by arc length). */
export interface Trayecto {
  pts: Punto[];
  acum: Float64Array;
  largo: number;
}

export function trayecto(pts: Punto[]): Trayecto {
  const acum = new Float64Array(pts.length);
  for (let i = 1; i < pts.length; i++)
    acum[i] = acum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  return { pts, acum, largo: acum[pts.length - 1] ?? 0 };
}
