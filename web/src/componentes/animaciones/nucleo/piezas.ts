// Drawings of physical components shared by several scenes (axial resistor, leads, heat waves…).

import type { Ctx } from './dibujo';
import { gradCilindro, rr } from './dibujo';
import type { Paleta } from './paleta';
import { alfa, mezcla } from './paleta';

/** A tinned lead (horizontal) from xa to xb at height y. */
export function pata(ctx: Ctx, xa: number, xb: number, y: number, grosor: number, pal: Paleta): void {
  ctx.fillStyle = gradCilindro(ctx, y - grosor / 2, y + grosor / 2, pal.estano, pal.oscuro);
  ctx.fillRect(Math.min(xa, xb), y - grosor / 2, Math.abs(xb - xa), grosor);
}

/** Path of the classic «dog-bone» body of an axial resistor. */
export function cuerpoAxial(ctx: Ctx, x0: number, x1: number, yc: number, r: number): void {
  const L = x1 - x0;
  const cap = L * 0.2;
  const rc = r * 0.84;
  ctx.beginPath();
  ctx.moveTo(x0 + r, yc - r);
  ctx.lineTo(x0 + cap - 4, yc - r);
  ctx.quadraticCurveTo(x0 + cap + 4, yc - r, x0 + cap + 8, yc - rc);
  ctx.lineTo(x1 - cap - 8, yc - rc);
  ctx.quadraticCurveTo(x1 - cap - 4, yc - r, x1 - cap + 4, yc - r);
  ctx.lineTo(x1 - r, yc - r);
  ctx.arc(x1 - r, yc, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x1 - cap + 4, yc + r);
  ctx.quadraticCurveTo(x1 - cap - 4, yc + r, x1 - cap - 8, yc + rc);
  ctx.lineTo(x0 + cap + 8, yc + rc);
  ctx.quadraticCurveTo(x0 + cap + 4, yc + r, x0 + cap - 4, yc + r);
  ctx.lineTo(x0 + r, yc + r);
  ctx.arc(x0 + r, yc, r, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.closePath();
}

export interface Banda {
  /** Position along the body, 0..1. */
  f: number;
  color: string;
  /** Width relative to the body length. */
  ancho?: number;
}

/** Axial resistor with colour bands, leads and cylindrical shading. */
export function resistenciaAxial(
  ctx: Ctx,
  pal: Paleta,
  o: { x0: number; x1: number; yc: number; r: number; cuerpo: string; bandas: Banda[]; patas?: [number, number]; brilloBandas?: number[] },
): void {
  const { x0, x1, yc, r } = o;
  if (o.patas) {
    pata(ctx, o.patas[0], x0 + 6, yc, Math.max(3, r * 0.16), pal);
    pata(ctx, x1 - 6, o.patas[1], yc, Math.max(3, r * 0.16), pal);
  }
  ctx.save();
  // Cheap contact shadow (no shadowBlur, which is a per-frame Gaussian blur).
  ctx.save();
  ctx.translate(0, r * 0.2);
  cuerpoAxial(ctx, x0 + 2, x1 - 2, yc, r * 0.96);
  ctx.fillStyle = pal.oscuro ? 'rgba(0,0,0,0.35)' : 'rgba(40,30,20,0.12)';
  ctx.fill();
  ctx.restore();
  cuerpoAxial(ctx, x0, x1, yc, r);
  ctx.fillStyle = gradCilindro(ctx, yc - r, yc + r, o.cuerpo, pal.oscuro);
  ctx.fill();
  ctx.restore();
  ctx.save();
  cuerpoAxial(ctx, x0, x1, yc, r);
  ctx.clip();
  const L = x1 - x0;
  o.bandas.forEach((b, i) => {
    const w = (b.ancho ?? 0.07) * L;
    const x = x0 + b.f * L - w / 2;
    ctx.fillStyle = gradCilindro(ctx, yc - r, yc + r, b.color, pal.oscuro);
    ctx.fillRect(x, yc - r - 2, w, 2 * r + 4);
    const k = o.brilloBandas?.[i] ?? 0;
    if (k > 0.01) {
      ctx.strokeStyle = alfa('#ffffff', 0.85 * k);
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 1.5, yc - r + 1, w + 3, 2 * r - 2);
    }
  });
  // Specular highlight.
  const g = ctx.createLinearGradient(0, yc - r, 0, yc - r * 0.2);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x0, yc - r, L, r * 0.8);
  ctx.restore();
  cuerpoAxial(ctx, x0, x1, yc, r);
  ctx.strokeStyle = alfa(mezcla(o.cuerpo, '#000000', 0.55), 0.6);
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Rising heat waves over a hot body; `k` 0..1 intensity, `t` time. */
export function ondasCalor(ctx: Ctx, x0: number, x1: number, y: number, k: number, t: number, color: string): void {
  if (k < 0.02) return;
  const n = Math.max(2, Math.round((x1 - x0) / 46));
  ctx.save();
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = x0 + ((i + 0.5) * (x1 - x0)) / n;
    const fase = (t * 0.7 + i * 0.37) % 1;
    const alto = 40 + 30 * k;
    const yb = y - fase * alto;
    ctx.strokeStyle = alfa(color, k * Math.sin(Math.PI * fase) * 0.9);
    ctx.beginPath();
    for (let j = 0; j <= 20; j++) {
      const u = j / 20;
      const yy = yb - u * 38;
      const xx = x + Math.sin(u * Math.PI * 3 + t * 2 + i) * 3.5;
      if (j === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Small rounded label plate with a value (used for numeric callouts on components). */
export function placa(ctx: Ctx, x: number, y: number, w: number, h: number, fondo: string, borde: string): void {
  rr(ctx, x, y, w, h, Math.min(8, h / 2));
  ctx.fillStyle = fondo;
  ctx.fill();
  ctx.strokeStyle = borde;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * Horizontal solenoid seen from the side: back half of each turn, an optional core, then the front half,
 * so that the winding wraps around the core. Returns nothing; `n` turns between x0 and x1.
 */
export function solenoide(
  ctx: Ctx,
  pal: Paleta,
  o: { x0: number; x1: number; yc: number; r: number; n: number; nucleo?: string | null; hilo?: string; grosor?: number },
): void {
  const { x0, x1, yc, r, n } = o;
  const paso = (x1 - x0) / n;
  const color = o.hilo ?? pal.cobre;
  const g = o.grosor ?? Math.max(2.5, Math.min(6, paso * 0.5));
  const vuelta = (frente: boolean) => {
    for (let k = 0; k < n; k++) {
      const xa = x0 + k * paso;
      ctx.beginPath();
      for (let j = 0; j <= 16; j++) {
        const th = frente ? -Math.PI / 2 + (Math.PI * j) / 16 : Math.PI / 2 + (Math.PI * j) / 16;
        const x = xa + (paso * (th + Math.PI / 2)) / (2 * Math.PI);
        const y = yc + r * Math.sin(th);
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = frente ? color : mezcla(color, '#000000', 0.45);
      ctx.lineWidth = g;
      ctx.lineCap = 'round';
      ctx.stroke();
      if (frente) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = g * 0.3;
        ctx.stroke();
      }
    }
  };
  vuelta(false);
  if (o.nucleo) {
    ctx.fillStyle = gradCilindro(ctx, yc - r * 0.72, yc + r * 0.72, o.nucleo, pal.oscuro);
    rr(ctx, x0 - 18, yc - r * 0.72, x1 - x0 + 36, r * 1.44, 4);
    ctx.fill();
  }
  vuelta(true);
}
