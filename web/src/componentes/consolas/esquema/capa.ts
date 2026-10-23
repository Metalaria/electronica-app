// Electrical layer of a sheet: hit testing (pins, labels, wires, junctions, symbols, child sheets) and the
// overlay that highlights a whole net. Units: 0.01 mm, as the drawing.

import type { CapaHoja } from '../datos';

export type Impacto =
  | { tipo: 'pin'; red: number; ref: string; pin: string; nombre: string }
  | { tipo: 'etiqueta'; red: number; texto: string; clase: string }
  | { tipo: 'hilo'; red: number }
  | { tipo: 'simbolo'; ref: string }
  | { tipo: 'subhoja'; hoja: number; nombre: string }
  | { tipo: 'bus'; texto: string };

function distSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const ex = x1 + t * dx - px;
  const ey = y1 + t * dy - py;
  return Math.sqrt(ex * ex + ey * ey);
}

/** What is under the point (x, y); tol in sheet units. */
export function impacto(c: CapaHoja, x: number, y: number, tol: number): Impacto | null {
  // pins first: they name the chip
  let mejor: Impacto | null = null;
  let dmin = tol;
  for (const p of c.pines) {
    const d = distSeg(x, y, p[4], p[5], p[6], p[7]);
    if (d < dmin) {
      dmin = d;
      mejor = { tipo: 'pin', red: p[0], ref: p[1], pin: p[2], nombre: p[3] };
    }
  }
  if (mejor) return mejor;
  for (const e of c.etiquetas) {
    if (x >= e[3] - tol * 0.3 && x <= e[5] + tol * 0.3 && y >= e[4] - tol * 0.3 && y <= e[6] + tol * 0.3) {
      if (e[1] === 'bus') return { tipo: 'bus', texto: e[2] };
      if (e[0] >= 0) return { tipo: 'etiqueta', red: e[0], texto: e[2], clase: e[1] };
    }
  }
  const h = c.hilos;
  dmin = tol;
  let red = -1;
  for (let i = 0; i < h.length; i += 5) {
    const d = distSeg(x, y, h[i + 1]!, h[i + 2]!, h[i + 3]!, h[i + 4]!);
    if (d < dmin) {
      dmin = d;
      red = h[i]!;
    }
  }
  if (red >= 0) return { tipo: 'hilo', red };
  const b = c.buses;
  for (let i = 0; i < b.length; i += 4) {
    if (distSeg(x, y, b[i]!, b[i + 1]!, b[i + 2]!, b[i + 3]!) < tol * 0.7) {
      // name of the nearest bus label
      let txt = 'bus';
      let dl = Infinity;
      for (const e of c.etiquetas) {
        if (e[1] !== 'bus') continue;
        const dd = Math.hypot((e[3] + e[5]) / 2 - x, (e[4] + e[6]) / 2 - y);
        if (dd < dl) {
          dl = dd;
          txt = e[2];
        }
      }
      return { tipo: 'bus', texto: txt };
    }
  }
  // smallest symbol box containing the point
  let area = Infinity;
  let ref: string | null = null;
  for (const s of c.simbolos) {
    if (x >= s[1] && x <= s[3] && y >= s[2] && y <= s[4]) {
      const a = (s[3] - s[1]) * (s[4] - s[2]);
      if (a < area) {
        area = a;
        ref = s[0];
      }
    }
  }
  if (ref) return { tipo: 'simbolo', ref };
  for (const s of c.subhojas) {
    if (x >= s[2] && x <= s[2] + s[4] && y >= s[3] && y <= s[3] + s[5]) return { tipo: 'subhoja', hoja: s[0], nombre: s[1] };
  }
  return null;
}

/** Bounding box of a net on the sheet, or null when it is not there. */
export function cajaRed(c: CapaHoja, red: number): [number, number, number, number] | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const mas = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  const h = c.hilos;
  for (let i = 0; i < h.length; i += 5) {
    if (h[i] === red) {
      mas(h[i + 1]!, h[i + 2]!);
      mas(h[i + 3]!, h[i + 4]!);
    }
  }
  for (const p of c.pines) if (p[0] === red) mas(p[4], p[5]);
  for (const e of c.etiquetas) {
    if (e[0] === red) {
      mas(e[3], e[4]);
      mas(e[5], e[6]);
    }
  }
  return x0 === Infinity ? null : [x0, y0, x1, y1];
}

export function cajaSimbolo(c: CapaHoja, ref: string): [number, number, number, number] | null {
  let r: [number, number, number, number] | null = null;
  for (const s of c.simbolos) {
    if (s[0] !== ref) continue;
    r = r ? [Math.min(r[0], s[1]), Math.min(r[1], s[2]), Math.max(r[2], s[3]), Math.max(r[3], s[4])] : [s[1], s[2], s[3], s[4]];
  }
  return r;
}

/** Draws a net (thick, in the highlight colour) over the sheet. The context is in sheet units. */
export function dibujarRed(ctx: CanvasRenderingContext2D, c: CapaHoja, red: number, k: number, color: string, halo: string, fuerte: boolean): void {
  const g = Math.max(22, (fuerte ? 3.2 : 2.2) / k);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const camino = new Path2D();
  const h = c.hilos;
  for (let i = 0; i < h.length; i += 5) {
    if (h[i] !== red) continue;
    camino.moveTo(h[i + 1]!, h[i + 2]!);
    camino.lineTo(h[i + 3]!, h[i + 4]!);
  }
  for (const p of c.pines) {
    if (p[0] !== red) continue;
    camino.moveTo(p[4], p[5]);
    camino.lineTo(p[6], p[7]);
  }
  ctx.strokeStyle = halo;
  ctx.lineWidth = g * 3.2;
  ctx.stroke(camino);
  ctx.strokeStyle = color;
  ctx.lineWidth = g;
  ctx.stroke(camino);
  ctx.fillStyle = color;
  const r = Math.max(45, 3.2 / k);
  for (let i = 0; i < c.uniones.length; i += 3) {
    if (c.uniones[i] !== red) continue;
    ctx.beginPath();
    ctx.arc(c.uniones[i + 1]!, c.uniones[i + 2]!, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of c.pines) {
    if (p[0] !== red) continue;
    ctx.beginPath();
    ctx.arc(p[4], p[5], r * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(15, 1.5 / k);
  for (const e of c.etiquetas) {
    if (e[0] !== red) continue;
    ctx.fillStyle = halo;
    ctx.fillRect(e[3], e[4], e[5] - e[3], e[6] - e[4]);
    ctx.strokeRect(e[3], e[4], e[5] - e[3], e[6] - e[4]);
  }
  ctx.restore();
}

export function dibujarCaja(ctx: CanvasRenderingContext2D, b: [number, number, number, number], k: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(20, 2.5 / k);
  ctx.setLineDash([Math.max(60, 7 / k), Math.max(40, 4 / k)]);
  const m = Math.max(80, 6 / k);
  ctx.strokeRect(b[0] - m, b[1] - m, b[2] - b[0] + 2 * m, b[3] - b[1] + 2 * m);
  ctx.restore();
}
