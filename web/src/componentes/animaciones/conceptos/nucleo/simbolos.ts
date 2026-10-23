// Extra schematic symbols and small drawing helpers for the concept scenes.

import type { Vista } from '../../nucleo/dibujo';
import { circulo, flecha, txtRico, Camino, corrienteEnCamino } from '../../nucleo/dibujo';
import { alfa } from '../../nucleo/paleta';

/** Current source: circle with an arrow pointing up (towards +), centred at (x, y). */
export function fuenteCorriente(v: Vista, x: number, y: number, r: number, color?: string): void {
  const c = color ?? v.pal.tinta;
  circulo(v.ctx, x, y, r, v.pal.fondo, c, 2);
  flecha(v.ctx, x, y + r * 0.6, x, y - r * 0.6, c, 2, r * 0.5);
}

/**
 * Conventional current along a polyline: arrow heads that move at a speed proportional to |I| (the caller
 * advances `fase` by dt·|I|·k); reversed when I < 0; hidden when I is negligible.
 */
export function corriente(v: Vista, pts: [number, number][], fase: number, I: number, paso = 40, tam = 10, umbral = 1e-9): void {
  if (Math.abs(I) <= umbral) return;
  const c = new Camino(I >= 0 ? pts : [...pts].reverse());
  corrienteEnCamino(v.ctx, c, fase, paso, v.pal, tam, 0.95);
}

/** Value label with a soft background pill. */
export function chapa(v: Vista, s: string, x: number, y: number, color: string, tam = 12.5, alin: CanvasTextAlign = 'center'): void {
  txtRico(v, s, x, y, { tam, peso: 700, color, fondo: alfa(color, v.pal.oscuro ? 0.18 : 0.1), alin });
}

/** Horizontal bar meter (0–1 filled) with a label, for powers and percentages. */
export function barra(v: Vista, x: number, y: number, w: number, h: number, f: number, color: string): void {
  const { ctx, pal } = v;
  ctx.fillStyle = alfa(pal.tinta, pal.oscuro ? 0.12 : 0.07);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, f)), h);
  ctx.strokeStyle = pal.linea;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}
