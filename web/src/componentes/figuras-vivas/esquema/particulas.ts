// Charge-flow particles along the wires and through the parts of a live schematic. Constant density on
// screen, speed proportional to the current on a log scale (four decades below the largest current), zero
// current = no motion. Positions advance with the real elapsed time (dt in seconds), never per frame.

import type { Camino, EstadoEsquema } from './modelo.svelte';
import { BORDE_CORRIENTE, BORDE_ELECTRON, COLOR_CORRIENTE, COLOR_ELECTRON } from './color';

/** Spacing between particles and their radius, in CSS px. */
const ESPACIADO_PX = 15;
const RADIO_PX = 2.3;
/** Speed range in CSS px per second. */
const V_MIN = 7;
const V_MAX = 75;
const DECADAS = 4;
/** Particle cap per schematic (cost bound on slow devices). */
const MAX_PARTICULAS = 420;

/** Lays out the particles for a rendering scale `k` (CSS px per SVG unit). */
export function repartir(caminos: Camino[], k: number): void {
  const total = caminos.reduce((s, c) => s + c.tr.largo, 0);
  const paso = Math.max(ESPACIADO_PX / k, total / MAX_PARTICULAS);
  for (const c of caminos) {
    c.n = c.tr.largo > 0 ? Math.max(1, Math.round(c.tr.largo / paso)) : 0;
    c.paso = c.n ? c.tr.largo / c.n : 0;
    if (!(c.fase >= 0 && c.fase < c.paso)) c.fase = Math.random() * c.paso;
  }
}

/** Speed (CSS px/s) for a current, given the largest current of the circuit. */
export function velocidad(i: number, imax: number): number {
  const a = Math.abs(i);
  if (!(imax > 1e-12) || a < Math.max(imax * 1e-6, 1e-12)) return 0;
  const u = Math.min(1, Math.max(0, (Math.log10(a / imax) + DECADAS) / DECADAS));
  return V_MIN + (V_MAX - V_MIN) * u;
}

/** Advances every particle by dt seconds. */
export function avanzar(est: EstadoEsquema, caminos: Camino[], dt: number, k: number): void {
  const imax = est.rangos.imax;
  const f = est.muestraEn(est.faseFina);
  const signo = est.electrones ? -1 : 1;
  for (const c of caminos) {
    if (!c.n) continue;
    const i = est.corriente(c.clave, f) ?? 0;
    const v = velocidad(i, imax) / k;
    if (!v) continue;
    c.fase = (c.fase + Math.sign(i) * signo * v * dt) % c.paso;
    if (c.fase < 0) c.fase += c.paso;
  }
}

/**
 * Draws the particles. `ctx` is set up so that one unit is one SVG user unit; `k` is CSS px per unit.
 * Particles on paths without current are drawn faint and still.
 */
export function dibujar(ctx: CanvasRenderingContext2D, est: EstadoEsquema, caminos: Camino[], k: number, foco: string | null): void {
  const imax = est.rangos.imax;
  const f = est.muestraEn(est.faseFina);
  const r = RADIO_PX / k;
  const quietas = new Path2D();
  const vivas = new Path2D();
  const tenues = new Path2D();
  for (const c of caminos) {
    if (!c.n) continue;
    const i = est.corriente(c.clave, f) ?? 0;
    const mueve = velocidad(i, imax) > 0;
    const apagada = foco != null && c.nodo !== foco && c.elemento !== foco;
    const destino = !mueve ? quietas : apagada ? tenues : vivas;
    const { pts, acum } = c.tr;
    let seg = 1;
    for (let j = 0; j < c.n; j++) {
      const s = c.fase + j * c.paso;
      while (seg < pts.length - 1 && acum[seg]! < s) seg++;
      const a = pts[seg - 1]!;
      const b = pts[seg]!;
      const l = acum[seg]! - acum[seg - 1]!;
      const u = l > 0 ? (s - acum[seg - 1]!) / l : 0;
      const x = a[0] + (b[0] - a[0]) * u;
      const y = a[1] + (b[1] - a[1]) * u;
      destino.moveTo(x + r, y);
      destino.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  const relleno = est.electrones ? COLOR_ELECTRON : COLOR_CORRIENTE;
  const borde = est.electrones ? BORDE_ELECTRON : BORDE_CORRIENTE;
  ctx.lineWidth = 0.9 / k;
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#7d8790';
  ctx.fill(quietas);
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = relleno;
  ctx.fill(tenues);
  ctx.globalAlpha = 1;
  ctx.fillStyle = relleno;
  ctx.strokeStyle = borde;
  ctx.fill(vivas);
  ctx.stroke(vivas);
}
