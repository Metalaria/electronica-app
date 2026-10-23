// Plots drawn inside a scene's canvas (oscilloscope-like panels synchronised with the animation): axes with
// Spanish number format and SI prefixes, grid, curves, markers. The static part of a panel (frame, grid,
// numbers) is meant to be drawn once into a cached layer (see `estatico`), the curves every frame.

import type { Ctx, Vista } from '../../nucleo/dibujo';
import { rr, txt, txtRico } from '../../nucleo/dibujo';
import { alfa } from '../../nucleo/paleta';
import { siCorto, num } from '../../nucleo/formato';

export interface Ejes {
  /** Plotting area in logical units. */
  x: number;
  y: number;
  w: number;
  h: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  logX?: boolean;
  logY?: boolean;
}

function tr(v: number, log?: boolean): number {
  return log ? Math.log10(Math.max(v, 1e-300)) : v;
}

export function X(e: Ejes, x: number): number {
  return e.x + (e.w * (tr(x, e.logX) - tr(e.x0, e.logX))) / (tr(e.x1, e.logX) - tr(e.x0, e.logX));
}

export function Y(e: Ejes, y: number): number {
  return e.y + e.h * (1 - (tr(y, e.logY) - tr(e.y0, e.logY)) / (tr(e.y1, e.logY) - tr(e.y0, e.logY)));
}

/** Inverse of X (pointer → data). */
export function deX(e: Ejes, px: number): number {
  const u = (px - e.x) / e.w;
  const a = tr(e.x0, e.logX);
  const b = tr(e.x1, e.logX);
  const t = a + u * (b - a);
  return e.logX ? 10 ** t : t;
}

export function deY(e: Ejes, py: number): number {
  const u = 1 - (py - e.y) / e.h;
  const a = tr(e.y0, e.logY);
  const b = tr(e.y1, e.logY);
  const t = a + u * (b - a);
  return e.logY ? 10 ** t : t;
}

/** «Nice» tick values between a and b (about n of them). */
export function marcas(a: number, b: number, n = 5): number[] {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const bruto = (hi - lo) / Math.max(1, n);
  const p = 10 ** Math.floor(Math.log10(bruto || 1));
  const f = bruto / p;
  const paso = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  const v: number[] = [];
  for (let k = Math.ceil(lo / paso - 1e-9); k * paso <= hi + paso * 1e-9; k++) {
    v.push(Math.abs(k * paso) < paso * 1e-9 ? 0 : k * paso);
    if (v.length > 40) break;
  }
  return v;
}

/** Decade ticks of a log axis. */
export function marcasLog(a: number, b: number): number[] {
  const v: number[] = [];
  for (let e = Math.ceil(Math.log10(Math.min(a, b)) - 1e-9); e <= Math.log10(Math.max(a, b)) + 1e-9; e++) v.push(10 ** e);
  return v;
}

export interface OpcPanel {
  titulo?: string;
  /** Axis units (SI, without prefix) used to format the tick numbers; '' for plain numbers. */
  ux?: string;
  uy?: string;
  /** Axis names, written at the end of each axis («t», «v_C»). */
  etX?: string;
  etY?: string;
  marcasX?: number[];
  marcasY?: number[];
  fmtX?: (v: number) => string;
  fmtY?: (v: number) => string;
  /** No numbers on the axis (qualitative). */
  sinX?: boolean;
  sinY?: boolean;
  /** Draw the line y = 0 (and x = 0) a bit stronger. */
  cero?: boolean;
  /** Panel background (default: the scene's panel colour). */
  fondo?: string | null;
}

function fmt(v: number, u: string | undefined): string {
  if (u === undefined || u === '') {
    const a = Math.abs(v);
    if (a === 0) return '0';
    if (a >= 1e4 || a < 1e-2) return siCorto(v, '', 3);
    return num(v, a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 2).replace(/,?0+$/, '').replace(/,$/, '') || '0';
  }
  return siCorto(v, u, 3);
}

/**
 * Frame, grid and tick numbers of a plot. Pass a Vista whose ctx is the target (the scene or a cached layer).
 * Tick labels go below and to the left of the plotting area, so leave about 30 units on the left and 18 below.
 */
export function panel(v: Vista, e: Ejes, o: OpcPanel = {}): void {
  const { ctx, pal } = v;
  ctx.save();
  if (o.fondo !== null) {
    rr(ctx, e.x - 6, e.y - 6, e.w + 12, e.h + 12, 8);
    ctx.fillStyle = o.fondo ?? pal.panel;
    ctx.fill();
    ctx.strokeStyle = pal.linea;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  const mx = o.marcasX ?? (e.logX ? marcasLog(e.x0, e.x1) : marcas(e.x0, e.x1, Math.max(3, Math.round(e.w / 90))));
  const my = o.marcasY ?? (e.logY ? marcasLog(e.y0, e.y1) : marcas(e.y0, e.y1, Math.max(3, Math.round(e.h / 46))));
  ctx.lineWidth = 1;
  ctx.strokeStyle = pal.rejilla;
  ctx.beginPath();
  for (const m of mx) {
    const px = X(e, m);
    if (px < e.x - 0.5 || px > e.x + e.w + 0.5) continue;
    ctx.moveTo(px, e.y);
    ctx.lineTo(px, e.y + e.h);
  }
  for (const m of my) {
    const py = Y(e, m);
    if (py < e.y - 0.5 || py > e.y + e.h + 0.5) continue;
    ctx.moveTo(e.x, py);
    ctx.lineTo(e.x + e.w, py);
  }
  ctx.stroke();
  if (o.cero) {
    ctx.strokeStyle = alfa(pal.tinta, 0.35);
    ctx.beginPath();
    if (e.y0 < 0 && e.y1 > 0 && !e.logY) {
      ctx.moveTo(e.x, Y(e, 0));
      ctx.lineTo(e.x + e.w, Y(e, 0));
    }
    if (e.x0 < 0 && e.x1 > 0 && !e.logX) {
      ctx.moveTo(X(e, 0), e.y);
      ctx.lineTo(X(e, 0), e.y + e.h);
    }
    ctx.stroke();
  }
  ctx.restore();
  const tam = 10.5;
  if (!o.sinX)
    for (const m of mx) {
      const px = X(e, m);
      if (px < e.x - 0.5 || px > e.x + e.w + 0.5) continue;
      txt(v, o.fmtX ? o.fmtX(m) : fmt(m, o.ux), px, e.y + e.h + 6 + v.f(tam) * 0.6, { tam, peso: 500, color: pal.suave });
    }
  if (!o.sinY)
    for (const m of my) {
      const py = Y(e, m);
      if (py < e.y - 0.5 || py > e.y + e.h + 0.5) continue;
      txt(v, o.fmtY ? o.fmtY(m) : fmt(m, o.uy), e.x - 8, py, { tam, peso: 500, color: pal.suave, alin: 'right' });
    }
  if (o.titulo) txtRico(v, o.titulo, e.x + 2, e.y - 6 - v.f(12) * 0.75, { tam: 12, peso: 700, color: pal.suave, alin: 'left' });
  if (o.etX) txtRico(v, o.etX, e.x + e.w - 2, e.y + e.h - v.f(11) * 0.7, { tam: 11.5, peso: 700, color: pal.suave, alin: 'right' });
  if (o.etY) txtRico(v, o.etY, e.x + 4, e.y + v.f(11) * 0.75, { tam: 11.5, peso: 700, color: pal.suave, alin: 'left' });
}

/** A curve from arrays (only the points inside [x0, x1] are drawn; y is clipped to the panel). */
export function curva(
  ctx: Ctx,
  e: Ejes,
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  color: string,
  ancho = 2,
  discontinua?: number[],
  n = xs.length,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(e.x - 1, e.y - 2, e.w + 2, e.h + 4);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = ancho;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (discontinua) ctx.setLineDash(discontinua);
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i < n; i++) {
    const yv = ys[i]!;
    if (!Number.isFinite(yv)) {
      pen = false;
      continue;
    }
    const px = X(e, xs[i]!);
    const py = Y(e, yv);
    if (!pen) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
    pen = true;
  }
  ctx.stroke();
  ctx.restore();
}

/** A curve y = f(x) sampled at n points across the panel. */
export function funcion(ctx: Ctx, e: Ejes, f: (x: number) => number, color: string, ancho = 2, n = 240, discontinua?: number[]): void {
  const xs = new Float64Array(n + 1);
  const ys = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const x = deX(e, e.x + (e.w * i) / n);
    xs[i] = x;
    ys[i] = f(x);
  }
  curva(ctx, e, xs, ys, color, ancho, discontinua);
}

/** Filled area between the curve and y = base. */
export function area(ctx: Ctx, e: Ejes, xs: ArrayLike<number>, ys: ArrayLike<number>, color: string, base = 0, n = xs.length): void {
  if (n < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(e.x, e.y, e.w, e.h);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(X(e, xs[0]!), Y(e, base));
  for (let i = 0; i < n; i++) ctx.lineTo(X(e, xs[i]!), Y(e, ys[i]!));
  ctx.lineTo(X(e, xs[n - 1]!), Y(e, base));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Vertical or horizontal guide inside the panel. */
export function guia(ctx: Ctx, e: Ejes, eje: 'x' | 'y', valor: number, color: string, ancho = 1.2, discontinua: number[] = [4, 4]): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = ancho;
  ctx.setLineDash(discontinua);
  ctx.beginPath();
  if (eje === 'x') {
    const px = X(e, valor);
    if (px < e.x - 0.5 || px > e.x + e.w + 0.5) {
      ctx.restore();
      return;
    }
    ctx.moveTo(px, e.y);
    ctx.lineTo(px, e.y + e.h);
  } else {
    const py = Y(e, valor);
    if (py < e.y - 0.5 || py > e.y + e.h + 0.5) {
      ctx.restore();
      return;
    }
    ctx.moveTo(e.x, py);
    ctx.lineTo(e.x + e.w, py);
  }
  ctx.stroke();
  ctx.restore();
}

/** A marker dot at a data point (clipped to the panel). */
export function punto(ctx: Ctx, e: Ejes, x: number, y: number, color: string, r = 4.5, borde?: string): void {
  const px = X(e, x);
  const py = Y(e, y);
  if (px < e.x - r || px > e.x + e.w + r || py < e.y - r || py > e.y + e.h + r) return;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (borde) {
    ctx.strokeStyle = borde;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/** Vertical bars (spectra): one bar per (x, y) from y = base. */
export function barras(ctx: Ctx, e: Ejes, xs: ArrayLike<number>, ys: ArrayLike<number>, color: string, ancho = 5, base = 0): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(e.x, e.y - 1, e.w, e.h + 2);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = ancho;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  const yb = Y(e, e.logY ? e.y0 : Math.max(e.y0, Math.min(e.y1, base)));
  for (let i = 0; i < xs.length; i++) {
    const yv = ys[i]!;
    if (!Number.isFinite(yv)) continue;
    const px = X(e, xs[i]!);
    ctx.moveTo(px, yb);
    ctx.lineTo(px, Y(e, e.logY ? Math.max(yv, e.y0) : yv));
  }
  ctx.stroke();
  ctx.restore();
}

/** The same Vista drawing into another context (cached layers). */
export function enCtx(v: Vista, ctx: Ctx): Vista {
  return { ...v, ctx };
}

/** Scene paper with the faint dot grid, painted into the current context (for one-blit static layers). */
export function papel(v: Vista): void {
  const { ctx, pal } = v;
  ctx.fillStyle = pal.fondo;
  ctx.fillRect(0, 0, v.w, v.h);
  ctx.fillStyle = alfa(pal.tenue, pal.oscuro ? 0.18 : 0.22);
  const paso = 20;
  ctx.beginPath();
  for (let x = paso / 2; x < v.w; x += paso)
    for (let y = paso / 2; y < v.h; y += paso) {
      ctx.moveTo(x + 0.9, y);
      ctx.arc(x, y, 0.9, 0, Math.PI * 2);
    }
  ctx.fill();
}

/**
 * Draws the static part of a scene (paper + whatever `fn` draws) into one cached layer, redrawn only when
 * `clave` changes. One blit per frame instead of re-stroking grids and texts.
 */
export function estatico(v: Vista, clave: string, fn: (vv: Vista) => void): void {
  v.capa(`estatico:${clave}`, (ctx) => {
    const vv = enCtx(v, ctx);
    papel(vv);
    fn(vv);
  });
}
