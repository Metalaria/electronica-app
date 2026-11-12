// Charge-flow particles along the wires and through the parts of a live schematic. Constant density on
// screen, speed proportional to the current on a log scale (four decades below the largest current), zero
// current = no motion. Positions advance with the real elapsed time (dt in seconds), never per frame.
// 1.2 (fix12): particles travel only along the wires. Every path may carry «zonas» (a part's body, a label, a node
// dot; SVG units) and the stretches of the path inside a zone grown by the particle's radius and a clear gap
// (`ocultar`) are not drawn: a particle goes into a part at one terminal and comes out at the other, and never covers
// a symbol, a label or a node dot.

import type { Camino, EstadoEsquema } from './modelo.svelte';
import { trayecto, type Trayecto } from '../geometria';
import type { Punto } from '../tipos';
import { BORDE_CORRIENTE, BORDE_ELECTRON, COLOR_CORRIENTE, COLOR_ELECTRON } from './color';

/** Spacing between particles and their radius, in CSS px. */
const ESPACIADO_PX = 15;
const RADIO_PX = 2.3;
/** Clear gap (CSS px) between a particle's edge and a symbol, a label or a node dot. */
const HOLGURA_PX = 3;

/** A rectangle in SVG units [x0, y0, x1, y1] (x0 ≤ x1, y0 ≤ y1) particles keep out of; a point is one of no size. */
export type Zona = [number, number, number, number];

/** How far (SVG units) particles keep from the zones at a rendering scale `k` (CSS px per SVG unit). */
export function margenZonas(k: number): number {
  return (RADIO_PX + HOLGURA_PX) / Math.max(k, 1e-6);
}

/**
 * The stretches of a path (arc-length intervals, sorted and merged) that cross a zone grown by `m` on every side
 * (Liang–Barsky clipping of each segment against each grown rectangle).
 */
export function tramosOcultos(tr: Trayecto, zonas: readonly Zona[], m: number): [number, number][] {
  const out: [number, number][] = [];
  const { pts, acum } = tr;
  for (let j = 1; j < pts.length; j++) {
    const [ax, ay] = pts[j - 1]!;
    const [bx, by] = pts[j]!;
    const l = acum[j]! - acum[j - 1]!;
    if (!(l > 0)) continue;
    const dx = bx - ax;
    const dy = by - ay;
    const sx0 = Math.min(ax, bx);
    const sx1 = Math.max(ax, bx);
    const sy0 = Math.min(ay, by);
    const sy1 = Math.max(ay, by);
    for (const z of zonas) {
      const x0 = z[0] - m;
      const y0 = z[1] - m;
      const x1 = z[2] + m;
      const y1 = z[3] + m;
      if (x0 > sx1 || x1 < sx0 || y0 > sy1 || y1 < sy0) continue;
      let t0 = 0;
      let t1 = 1;
      let fuera = false;
      const p = [-dx, dx, -dy, dy];
      const q = [ax - x0, x1 - ax, ay - y0, y1 - ay];
      for (let i = 0; i < 4 && !fuera; i++) {
        const pi = p[i]!;
        const qi = q[i]!;
        if (pi === 0) {
          if (qi < 0) fuera = true;
        } else {
          const r = qi / pi;
          if (pi < 0) {
            if (r > t1) fuera = true;
            else if (r > t0) t0 = r;
          } else if (r < t0) fuera = true;
          else if (r < t1) t1 = r;
        }
      }
      if (!fuera && t1 >= t0) out.push([acum[j - 1]! + t0 * l, acum[j - 1]! + t1 * l]);
    }
  }
  out.sort((a, b) => a[0] - b[0]);
  const unidos: [number, number][] = [];
  for (const t of out) {
    const u = unidos[unidos.length - 1];
    if (u && t[0] <= u[1] + 1e-9) u[1] = Math.max(u[1], t[1]);
    else unidos.push([t[0], t[1]]);
  }
  return unidos;
}

/** Works out, for a rendering scale `k`, the hidden stretches of every path that carries zones. */
export function ocultar(caminos: Camino[], k: number): void {
  const m = margenZonas(k);
  for (const c of caminos) c.ocultos = c.zonas?.length ? tramosOcultos(c.tr, c.zonas, m) : undefined;
}

/** Whether arc length `s` of a path is in one of its hidden stretches. */
export function oculta(c: Camino, s: number): boolean {
  const o = c.ocultos;
  if (!o) return false;
  for (const [a, b] of o) {
    if (s < a) return false;
    if (s <= b) return true;
  }
  return false;
}

/**
 * The nearest arc length to `s` whose stretch [x − h, x + h] is free of hidden stretches (an arrow of the still picture,
 * `h` its length), or null if there is none.
 */
export function visibleCerca(c: Camino, s: number, h = 0): number | null {
  const o = c.ocultos ?? [];
  const L = c.tr.largo;
  const libre = (x: number) => x - h >= -1e-9 && x + h <= L + 1e-9 && !o.some(([a, b]) => a <= x + h && b >= x - h);
  if (libre(s)) return s;
  let mejor: number | null = null;
  for (const [a, b] of o) {
    for (const x of [a - h - 1e-6, b + h + 1e-6]) {
      if (!libre(x)) continue;
      if (mejor == null || Math.abs(x - s) < Math.abs(mejor - s)) mejor = x;
    }
  }
  return mejor;
}

/** Point at arc length `s` of a path. */
export function puntoEn(tr: Trayecto, s: number): Punto {
  const { pts, acum } = tr;
  let j = 1;
  while (j < pts.length - 1 && acum[j]! < s) j++;
  const a = pts[j - 1]!;
  const b = pts[j]!;
  const l = acum[j]! - acum[j - 1]!;
  const u = l > 0 ? (s - acum[j - 1]!) / l : 0;
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

/** Calls `f` with the position (SVG units) of every particle of a path that is drawn (not in a hidden stretch). */
export function recorrer(c: Camino, f: (x: number, y: number) => void): void {
  if (!c.n) return;
  const { pts, acum } = c.tr;
  const o = c.ocultos;
  let seg = 1;
  let h = 0;
  for (let j = 0; j < c.n; j++) {
    const s = c.fase + j * c.paso;
    if (o) {
      // (s grows with j: one pass over the sorted stretches)
      while (h < o.length && o[h]![1] < s) h++;
      if (h < o.length && s >= o[h]![0]) continue;
    }
    while (seg < pts.length - 1 && acum[seg]! < s) seg++;
    const a = pts[seg - 1]!;
    const b = pts[seg]!;
    const l = acum[seg]! - acum[seg - 1]!;
    const u = l > 0 ? (s - acum[seg - 1]!) / l : 0;
    f(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u);
  }
}

/**
 * The pieces of a polyline outside every zone (pieces shorter than `minimo` dropped): a node's coloured halo must not
 * be drawn over a part's body (some book schematics have a wire along the whole part, start to end).
 */
export function fueraDeZonas(pts: Punto[], zonas: readonly Zona[], minimo = 0.5): Punto[][] {
  if (pts.length < 2) return [pts];
  const tr = trayecto(pts);
  const oc = tramosOcultos(tr, zonas, 0);
  if (!oc.length) return [pts];
  const out: Punto[][] = [];
  const trozo = (a: number, b: number) => {
    if (b - a < minimo) return;
    const ps: Punto[] = [puntoEn(tr, a)];
    for (let j = 1; j < pts.length - 1; j++) if (tr.acum[j]! > a && tr.acum[j]! < b) ps.push(pts[j]!);
    ps.push(puntoEn(tr, b));
    out.push(ps);
  };
  let s0 = 0;
  for (const [a, b] of oc) {
    trozo(s0, Math.max(s0, a));
    s0 = Math.max(s0, b);
  }
  trozo(s0, tr.largo);
  return out;
}

/**
 * The bodies of the two-terminal parts of a book schematic (start / end, with a body between istart and iend), shrunk
 * by `encoger` SVG units: what no wire of the live layer may cover.
 */
export function cuerposDeDosBornes(
  elementos: readonly { e: { rol: string; anclas: Record<string, Punto>; terminales?: Record<string, string> }; caja: [number, number, number, number] | null }[],
  P: (p: Punto) => Punto,
  encoger = 0.5,
): Zona[] {
  const dos = elementos.filter(({ e }) => {
    const t = Object.keys(e.terminales ?? {});
    const [a, b] = [e.anclas['istart'], e.anclas['iend']];
    return t.length === 2 && t.includes('start') && t.includes('end') && !!a && !!b && Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-6;
  });
  return zonasDeElementos(dos, P)
    .map((z): Zona => [z[0] + encoger, z[1] + encoger, z[2] - encoger, z[3] - encoger])
    .filter((z) => z[0] < z[2] && z[1] < z[3]);
}

/** Positions (SVG units) of every particle drawn now (the tests check none is on a symbol, a label or a node dot). */
export function posicionesVisibles(caminos: readonly Camino[]): Punto[] {
  const out: Punto[] = [];
  for (const c of caminos) recorrer(c, (x, y) => out.push([x, y]));
  return out;
}

/**
 * The zones of the book's schematics (figuras-vivas): every part's body — for a two-terminal part, its symbol box
 * between the ends of its body (schemdraw's istart / iend: the leads are wires), else its whole box — and the node
 * dots and annotations. `cajas` are the parts' boxes in SVG units (EstadoEsquema.elementos), `P` maps drawing units.
 */
export function zonasDeElementos(
  elementos: readonly { e: { rol: string; anclas: Record<string, Punto> }; caja: [number, number, number, number] | null }[],
  P: (p: Punto) => Punto,
): Zona[] {
  const out: Zona[] = [];
  for (const { e, caja } of elementos) {
    if (!caja || e.rol === 'WIRE' || e.rol === 'GND' || e.rol === 'RAIL') continue;
    const [x0, y0, x1, y1] = caja;
    const a = e.anclas['start'];
    const b = e.anclas['end'];
    const ia = e.anclas['istart'];
    const ib = e.anclas['iend'];
    if (a && b && ia && ib) {
      const A = P(ia);
      const B = P(ib);
      if (Math.hypot(A[0] - B[0], A[1] - B[1]) > 1e-6) {
        // the body along the part's axis, its full width across it
        const hor = Math.abs(B[0] - A[0]) >= Math.abs(B[1] - A[1]);
        out.push(hor ? [Math.min(A[0], B[0]), y0, Math.max(A[0], B[0]), y1] : [x0, Math.min(A[1], B[1]), x1, Math.max(A[1], B[1])]);
        continue;
      }
    }
    out.push([x0, y0, x1, y1]);
  }
  return out;
}
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
  const f = est.muestraEn(est.faseFina);
  avanzarCon(caminos, (c) => est.corriente(c.clave, f) ?? 0, est.rangos.imax, est.electrones ? -1 : 1, dt, k);
}

/**
 * 1.2: the same advance with the current of each path given by `corriente` (the 1.1/1.2 lesson circuits, whose
 * currents come from the lesson's model, not from a simulation result). `signo` −1 moves electrons.
 */
export function avanzarCon<C extends Camino>(caminos: C[], corriente: (c: C) => number, imax: number, signo: number, dt: number, k: number): void {
  for (const c of caminos) {
    if (!c.n) continue;
    const i = corriente(c);
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
  const f = est.muestraEn(est.faseFina);
  dibujarCon(ctx, caminos, (c) => est.corriente(c.clave, f) ?? 0, est.rangos.imax, k, foco, est.electrones);
}

/** 1.2: `dibujar` with the current of each path given by `corriente` (see avanzarCon). */
export function dibujarCon<C extends Camino>(
  ctx: CanvasRenderingContext2D,
  caminos: C[],
  corriente: (c: C) => number,
  imax: number,
  k: number,
  foco: string | null,
  electrones: boolean,
): void {
  const est = { electrones };
  const r = RADIO_PX / k;
  const quietas = new Path2D();
  const vivas = new Path2D();
  const tenues = new Path2D();
  for (const c of caminos) {
    if (!c.n) continue;
    const i = corriente(c);
    const mueve = velocidad(i, imax) > 0;
    const apagada = foco != null && c.nodo !== foco && c.elemento !== foco;
    const destino = !mueve ? quietas : apagada ? tenues : vivas;
    recorrer(c, (x, y) => {
      destino.moveTo(x + r, y);
      destino.arc(x, y, r, 0, Math.PI * 2);
    });
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
