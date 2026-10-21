// Canvas drawing of a plot: base layer (grid, axes, series) and overlay (crosshair, cursors, zoom box).

import { aPixel, buscar, type Escala } from './escalas';

export interface Tema {
  tinta: string;
  tenue: string;
  rejilla: string;
  eje: string;
  fondo: string;
  fuente: string;
}

/** Plot area inside the canvas, in CSS pixels. */
export interface Marco {
  w: number;
  h: number;
  izq: number;
  der: number;
  arr: number;
  aba: number;
}

export interface TrazoSerie {
  x: Float64Array;
  y: Float64Array;
  color: string;
  ancho: number;
  alfa: number;
  discontinua: boolean;
  orden: 1 | -1 | 0;
  /** Draw markers when few points are visible. */
  marcas: boolean;
}

export interface Ejes {
  marcasX: number[];
  menoresX: number[];
  textosX: string[];
  marcasY: number[];
  menoresY: number[];
  textosY: string[];
  tituloX: string;
  tituloY: string;
}

export function preparar(canvas: HTMLCanvasElement, w: number, h: number, dpr: number): CanvasRenderingContext2D | null {
  const W = Math.max(1, Math.round(w * dpr));
  const H = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

/** Half-pixel alignment of 1 px lines. */
const n = (v: number) => Math.round(v) + 0.5;

export function dibujarBase(
  ctx: CanvasRenderingContext2D,
  m: Marco,
  sx: Escala,
  sy: Escala,
  ejes: Ejes,
  tema: Tema,
  series: TrazoSerie[],
): void {
  const x0 = m.izq;
  const x1 = m.w - m.der;
  const y0 = m.arr;
  const y1 = m.h - m.aba;

  // Grid (recessive: hairlines), minor first.
  ctx.lineWidth = 1;
  ctx.strokeStyle = tema.rejilla;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  for (const v of ejes.menoresX) {
    const p = n(aPixel(sx, v));
    ctx.moveTo(p, y0);
    ctx.lineTo(p, y1);
  }
  for (const v of ejes.menoresY) {
    const p = n(aPixel(sy, v));
    ctx.moveTo(x0, p);
    ctx.lineTo(x1, p);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  for (const v of ejes.marcasX) {
    const p = n(aPixel(sx, v));
    if (p < x0 - 1 || p > x1 + 1) continue;
    ctx.moveTo(p, y0);
    ctx.lineTo(p, y1);
  }
  for (const v of ejes.marcasY) {
    const p = n(aPixel(sy, v));
    if (p < y0 - 1 || p > y1 + 1) continue;
    ctx.moveTo(x0, p);
    ctx.lineTo(x1, p);
  }
  ctx.stroke();

  // Zero line, slightly stronger, when in view.
  if (sy.tipo === 'linear' && sy.min < 0 && sy.max > 0) {
    ctx.strokeStyle = tema.eje;
    ctx.beginPath();
    const p = n(aPixel(sy, 0));
    ctx.moveTo(x0, p);
    ctx.lineTo(x1, p);
    ctx.stroke();
  }
  // Frame: bottom and left axes.
  ctx.strokeStyle = tema.eje;
  ctx.beginPath();
  ctx.moveTo(n(x0), y0);
  ctx.lineTo(n(x0), n(y1));
  ctx.lineTo(x1, n(y1));
  ctx.stroke();

  // Tick labels.
  ctx.fillStyle = tema.tenue;
  ctx.font = `12px ${tema.fuente}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  let ultimo = -Infinity;
  ejes.marcasX.forEach((v, i) => {
    const p = aPixel(sx, v);
    const txt = ejes.textosX[i] ?? '';
    const w = ctx.measureText(txt).width;
    if (p < x0 - 2 || p > x1 + 2 || p - w / 2 < ultimo + 6) return;
    const px = Math.min(Math.max(p, x0 + w / 2 - 4), m.w - w / 2 - 1);
    ctx.fillText(txt, px, y1 + 6);
    ultimo = px + w / 2;
  });
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ejes.marcasY.forEach((v, i) => {
    const p = aPixel(sy, v);
    if (p < y0 - 2 || p > y1 + 2) return;
    ctx.fillText(ejes.textosY[i] ?? '', x0 - 6, Math.min(Math.max(p, y0 + 6), y1 - 6));
  });
  // Axis titles: y at the top left (horizontal, readable on phones), x at the bottom right.
  ctx.fillStyle = tema.tenue;
  ctx.font = `600 12px ${tema.fuente}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(ejes.tituloY, 4, 2);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(ejes.tituloX, x1, m.h - 1);

  // Series, clipped to the plot area.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0 - 1, x1 - x0 + 1, y1 - y0 + 2);
  ctx.clip();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const s of series) trazar(ctx, s, sx, sy, x0, x1);
  ctx.restore();
}

function trazar(ctx: CanvasRenderingContext2D, s: TrazoSerie, sx: Escala, sy: Escala, x0: number, x1: number): void {
  const N = Math.min(s.x.length, s.y.length);
  if (!N) return;
  const logX = sx.tipo === 'log';
  const logY = sy.tipo === 'log';
  const valido = (xv: number, yv: number) =>
    Number.isFinite(xv) && Number.isFinite(yv) && (!logX || xv > 0) && (!logY || yv > 0);

  let i0 = 0;
  let i1 = N;
  if (s.orden === 1) {
    i0 = Math.max(0, buscar(s.x, sx.min) - 1);
    i1 = Math.min(N, buscar(s.x, sx.max) + 1);
  }
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.ancho;
  ctx.globalAlpha = s.alfa;
  ctx.setLineDash(s.discontinua ? [5, 4] : []);
  ctx.beginPath();

  const visibles = i1 - i0;
  const columnas = Math.max(1, x1 - x0);
  if (s.orden === 1 && visibles > columnas * 3) {
    // Many points per pixel column: draw each column's first, min, max and last value (M4), which keeps
    // every peak while drawing a few thousand segments at most.
    let col = NaN;
    let ini = 0;
    let fin = 0;
    let mn = Infinity;
    let mx = -Infinity;
    let pluma = false;
    const volcar = () => {
      if (Number.isNaN(col)) return;
      if (!pluma) {
        ctx.moveTo(col, ini);
        pluma = true;
      } else ctx.lineTo(col, ini);
      ctx.lineTo(col, mn);
      ctx.lineTo(col, mx);
      ctx.lineTo(col, fin);
    };
    for (let i = i0; i < i1; i++) {
      const xv = s.x[i]!;
      const yv = s.y[i]!;
      if (!valido(xv, yv)) {
        volcar();
        col = NaN;
        pluma = false;
        continue;
      }
      const px = Math.round(aPixel(sx, xv));
      const py = aPixel(sy, yv);
      if (px !== col) {
        volcar();
        col = px;
        ini = fin = mn = mx = py;
      } else {
        fin = py;
        if (py < mn) mn = py;
        if (py > mx) mx = py;
      }
    }
    volcar();
    ctx.stroke();
  } else {
    let pluma = false;
    let dir = 0;
    let prev = NaN;
    const puntos: [number, number][] = [];
    for (let i = i0; i < i1; i++) {
      const xv = s.x[i]!;
      const yv = s.y[i]!;
      if (!valido(xv, yv)) {
        pluma = false;
        continue;
      }
      // Nested sweeps (.dc with two sources) restart x: lift the pen when x turns back.
      if (s.orden === 0 && !Number.isNaN(prev)) {
        const d = Math.sign(xv - prev);
        if (dir === 0) dir = d;
        else if (d !== 0 && d !== dir) pluma = false;
      }
      prev = xv;
      const px = aPixel(sx, xv);
      const py = aPixel(sy, yv);
      if (!pluma) {
        ctx.moveTo(px, py);
        pluma = true;
      } else ctx.lineTo(px, py);
      if (s.marcas) puntos.push([px, py]);
    }
    ctx.stroke();
    if (s.marcas && puntos.length <= 40) {
      ctx.setLineDash([]);
      for (const [px, py] of puntos) {
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

export interface Capa {
  /** Crosshair x in px, or null. */
  cruz: number | null;
  puntos: { px: number; py: number; color: string }[];
  cursores: { px: number; etiqueta: string; activo: boolean }[];
  caja: { x0: number; y0: number; x1: number; y1: number } | null;
}

export function dibujarCapa(ctx: CanvasRenderingContext2D, m: Marco, tema: Tema, c: Capa): void {
  const y0 = m.arr;
  const y1 = m.h - m.aba;
  ctx.lineWidth = 1;
  for (const k of c.cursores) {
    const p = n(k.px);
    ctx.strokeStyle = tema.tinta;
    ctx.globalAlpha = k.activo ? 0.95 : 0.7;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(p, y0);
    ctx.lineTo(p, y1);
    ctx.stroke();
    ctx.setLineDash([]);
    // Handle with the cursor's letter.
    ctx.fillStyle = tema.tinta;
    ctx.beginPath();
    ctx.roundRect?.(p - 9, y0, 18, 17, 4);
    if (!ctx.roundRect) ctx.rect(p - 9, y0, 18, 17);
    ctx.fill();
    ctx.fillStyle = tema.fondo;
    ctx.font = `700 11px ${tema.fuente}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(k.etiqueta, p, y0 + 9);
  }
  ctx.globalAlpha = 1;
  if (c.cruz != null) {
    ctx.strokeStyle = tema.tenue;
    ctx.beginPath();
    ctx.moveTo(n(c.cruz), y0);
    ctx.lineTo(n(c.cruz), y1);
    ctx.stroke();
    for (const p of c.puntos) {
      ctx.beginPath();
      ctx.arc(p.px, p.py, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = tema.fondo;
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }
  if (c.caja) {
    const { x0, y0: b0, x1, y1: b1 } = c.caja;
    ctx.fillStyle = tema.tinta;
    ctx.globalAlpha = 0.08;
    ctx.fillRect(Math.min(x0, x1), Math.min(b0, b1), Math.abs(x1 - x0), Math.abs(b1 - b0));
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = tema.tinta;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(n(Math.min(x0, x1)), n(Math.min(b0, b1)), Math.abs(x1 - x0), Math.abs(b1 - b0));
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
}
