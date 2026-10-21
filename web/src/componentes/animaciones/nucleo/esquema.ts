// Schematic symbols (IEC style, as in the book's figures) drawn between two terminals.

import type { Vista } from './dibujo';
import { brillo, circulo, flecha, rr, txtRico } from './dibujo';
import { alfa } from './paleta';

interface Opc {
  color?: string;
  ancho?: number;
}

/** Runs `cuerpo` in a frame where the element lies along +x, centred at the origin; draws the leads. */
function dosTerminales(
  v: Vista,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  largoCuerpo: number,
  o: Opc,
  cuerpo: (L: number) => void,
): void {
  const { ctx } = v;
  const L = Math.hypot(x2 - x1, y2 - y1);
  const a = Math.atan2(y2 - y1, x2 - x1);
  const c = o.color ?? v.pal.tinta;
  ctx.save();
  ctx.translate((x1 + x2) / 2, (y1 + y2) / 2);
  ctx.rotate(a);
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = o.ancho ?? 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const m = Math.min(largoCuerpo, L) / 2;
  ctx.beginPath();
  ctx.moveTo(-L / 2, 0);
  ctx.lineTo(-m, 0);
  ctx.moveTo(m, 0);
  ctx.lineTo(L / 2, 0);
  ctx.stroke();
  cuerpo(m * 2);
  ctx.restore();
}

export function hilo(v: Vista, pts: [number, number][], color?: string, ancho = 2): void {
  const { ctx } = v;
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color ?? v.pal.tinta;
  ctx.lineWidth = ancho;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
  ctx.stroke();
  ctx.restore();
}

export function nodo(v: Vista, x: number, y: number, color?: string): void {
  circulo(v.ctx, x, y, 3.4, color ?? v.pal.tinta);
}

export function terminal(v: Vista, x: number, y: number, color?: string): void {
  circulo(v.ctx, x, y, 4, v.pal.fondo, color ?? v.pal.tinta, 1.8);
}

/** IEC resistor (rectangle). `relleno` tints the body (heat, highlight). */
export function resistencia(
  v: Vista,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  o: Opc & { largo?: number; alto?: number; relleno?: string; flechaVariable?: boolean } = {},
): void {
  const largo = o.largo ?? 44;
  const alto = o.alto ?? 16;
  dosTerminales(v, x1, y1, x2, y2, largo, o, (l) => {
    const { ctx } = v;
    rr(ctx, -l / 2, -alto / 2, l, alto, 2);
    ctx.fillStyle = o.relleno ?? v.pal.fondo;
    ctx.fill();
    ctx.stroke();
  });
  if (o.flechaVariable) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    flecha(v.ctx, mx - largo * 0.55, my + alto * 1.1, mx + largo * 0.55, my - alto * 1.1, o.color ?? v.pal.tinta, 1.6, 8);
  }
}

/** Capacitor: two plates. `polarizado` draws the curved negative plate and a «+». */
export function condensador(
  v: Vista,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  o: Opc & { sep?: number; placa?: number; polarizado?: boolean; carga?: number } = {},
): void {
  const sep = o.sep ?? 9;
  const placa = o.placa ?? 30;
  dosTerminales(v, x1, y1, x2, y2, sep, o, () => {
    const { ctx } = v;
    ctx.lineWidth = (o.ancho ?? 2) * 1.5;
    ctx.beginPath();
    ctx.moveTo(-sep / 2, -placa / 2);
    ctx.lineTo(-sep / 2, placa / 2);
    if (o.polarizado) {
      ctx.moveTo(sep / 2 + 4, -placa / 2);
      ctx.quadraticCurveTo(sep / 2 - 2, 0, sep / 2 + 4, placa / 2);
    } else {
      ctx.moveTo(sep / 2, -placa / 2);
      ctx.lineTo(sep / 2, placa / 2);
    }
    ctx.stroke();
    if (o.polarizado) {
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-sep / 2 - 10, -placa / 2 + 2);
      ctx.lineTo(-sep / 2 - 4, -placa / 2 + 2);
      ctx.moveTo(-sep / 2 - 7, -placa / 2 - 1);
      ctx.lineTo(-sep / 2 - 7, -placa / 2 + 5);
      ctx.stroke();
    }
  });
}

/** Inductor: IEC humps. */
export function bobina(v: Vista, x1: number, y1: number, x2: number, y2: number, o: Opc & { n?: number; largo?: number; nucleo?: boolean } = {}): void {
  const n = o.n ?? 4;
  const largo = o.largo ?? 52;
  dosTerminales(v, x1, y1, x2, y2, largo, o, (l) => {
    const { ctx } = v;
    const r = l / n / 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const cx = -l / 2 + r + i * 2 * r;
      ctx.moveTo(cx - r, 0);
      ctx.arc(cx, 0, r, Math.PI, 0, false);
    }
    ctx.stroke();
    if (o.nucleo) {
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-l / 2, -r - 5);
      ctx.lineTo(l / 2, -r - 5);
      ctx.moveTo(-l / 2, -r - 9);
      ctx.lineTo(l / 2, -r - 9);
      ctx.stroke();
    }
  });
}

export type TipoDiodo = 'normal' | 'zener' | 'schottky' | 'led' | 'foto' | 'tvs';

/**
 * Diode from anode (x1, y1) to cathode (x2, y2). `conduce` (0..1) lights the body as a cue that it is
 * conducting; `luz` is the LED colour.
 */
export function diodo(
  v: Vista,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  o: Opc & { tipo?: TipoDiodo; tam?: number; conduce?: number; luz?: string } = {},
): void {
  const t = o.tam ?? 18;
  const tipo = o.tipo ?? 'normal';
  const c = o.color ?? v.pal.tinta;
  dosTerminales(v, x1, y1, x2, y2, t, o, () => {
    const { ctx } = v;
    const k = o.conduce ?? 0;
    if (k > 0.02) brillo(ctx, 0, 0, t * 1.4, o.luz ?? v.pal.corriente, 0.45 * k);
    ctx.beginPath();
    ctx.moveTo(-t / 2, -t / 2);
    ctx.lineTo(t / 2, 0);
    ctx.lineTo(-t / 2, t / 2);
    ctx.closePath();
    ctx.fillStyle = k > 0.02 ? alfa(o.luz ?? v.pal.corriente, 0.35 + 0.5 * k) : v.pal.fondo;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(t / 2, -t / 2);
    ctx.lineTo(t / 2, t / 2);
    if (tipo === 'zener') {
      ctx.moveTo(t / 2, -t / 2);
      ctx.lineTo(t / 2 - 5, -t / 2 - 3);
      ctx.moveTo(t / 2, t / 2);
      ctx.lineTo(t / 2 + 5, t / 2 + 3);
    } else if (tipo === 'schottky') {
      ctx.moveTo(t / 2, -t / 2);
      ctx.lineTo(t / 2 + 5, -t / 2);
      ctx.lineTo(t / 2 + 5, -t / 2 + 4);
      ctx.moveTo(t / 2, t / 2);
      ctx.lineTo(t / 2 - 5, t / 2);
      ctx.lineTo(t / 2 - 5, t / 2 - 4);
    }
    ctx.stroke();
    if (tipo === 'led' || tipo === 'foto') {
      const s = tipo === 'led' ? 1 : -1;
      const col = tipo === 'led' && o.luz ? o.luz : c;
      for (const d of [-4, 5]) {
        const ax = d;
        const ay = -t / 2 - 4;
        if (s > 0) flecha(ctx, ax, ay, ax + 9, ay - 11, col, 1.6, 6);
        else flecha(ctx, ax + 9, ay - 11, ax, ay, col, 1.6, 6);
      }
    }
  });
}

/** Battery / DC source as a cell symbol (long plate positive) from + (x1, y1) to − (x2, y2). */
export function bateria(v: Vista, x1: number, y1: number, x2: number, y2: number, o: Opc & { rotulo?: string } = {}): void {
  dosTerminales(v, x1, y1, x2, y2, 10, o, () => {
    const { ctx } = v;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-5, -16);
    ctx.lineTo(-5, 16);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(5, -8);
    ctx.lineTo(5, 8);
    ctx.stroke();
  });
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  txtRico(v, '+', mx - Math.cos(ang) * 14 + nx * 20, my - Math.sin(ang) * 14 + ny * 20, { tam: 13, color: v.pal.positivo });
  if (o.rotulo) txtRico(v, o.rotulo, mx - nx * 30, my - ny * 30, { tam: 13 });
}

/** Voltage source: circle with + and − (DC) or a sine (AC). Vertical, + on top, centred at (x, y). */
export function fuente(v: Vista, x: number, y: number, r: number, tipo: 'dc' | 'ac', o: Opc & { rotulo?: string; lado?: 1 | -1 } = {}): void {
  const { ctx, pal } = v;
  const c = o.color ?? pal.tinta;
  ctx.save();
  ctx.strokeStyle = c;
  ctx.lineWidth = o.ancho ?? 2;
  circulo(ctx, x, y, r, pal.fondo, c, o.ancho ?? 2);
  ctx.beginPath();
  if (tipo === 'dc') {
    const k = r * 0.28;
    ctx.moveTo(x - k, y - r * 0.45);
    ctx.lineTo(x + k, y - r * 0.45);
    ctx.moveTo(x, y - r * 0.45 - k);
    ctx.lineTo(x, y - r * 0.45 + k);
    ctx.moveTo(x - k, y + r * 0.45);
    ctx.lineTo(x + k, y + r * 0.45);
  } else {
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const xx = x - r * 0.6 + u * r * 1.2;
      const yy = y - Math.sin(u * Math.PI * 2) * r * 0.35;
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
  }
  ctx.stroke();
  ctx.restore();
  if (o.rotulo) txtRico(v, o.rotulo, x + (o.lado ?? -1) * (r + 8), y, { tam: 13, alin: (o.lado ?? -1) < 0 ? 'right' : 'left' });
}

export function masa(v: Vista, x: number, y: number, color?: string): void {
  const { ctx } = v;
  ctx.save();
  ctx.strokeStyle = color ?? v.pal.tinta;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + 8);
  ctx.moveTo(x - 12, y + 8);
  ctx.lineTo(x + 12, y + 8);
  ctx.moveTo(x - 7.5, y + 13);
  ctx.lineTo(x + 7.5, y + 13);
  ctx.moveTo(x - 3, y + 18);
  ctx.lineTo(x + 3, y + 18);
  ctx.stroke();
  ctx.restore();
}

/** Switch between (x1, y1) and (x2, y2); `cierre` 0 (open) → 1 (closed) animates the blade. */
export function interruptor(v: Vista, x1: number, y1: number, x2: number, y2: number, cierre: number, o: Opc = {}): void {
  dosTerminales(v, x1, y1, x2, y2, 34, o, (l) => {
    const { ctx } = v;
    const ang = -0.55 * (1 - cierre);
    ctx.beginPath();
    ctx.moveTo(-l / 2, 0);
    ctx.lineTo(-l / 2 + Math.cos(ang) * l, Math.sin(ang) * l);
    ctx.stroke();
    circulo(ctx, -l / 2, 0, 3, v.pal.fondo, o.color ?? v.pal.tinta, 1.6);
    circulo(ctx, l / 2, 0, 3, v.pal.fondo, o.color ?? v.pal.tinta, 1.6);
  });
}

/** Lamp: circle with a cross; `luz` 0..1 makes it glow. */
export function lampara(v: Vista, x1: number, y1: number, x2: number, y2: number, luz: number, o: Opc = {}): void {
  dosTerminales(v, x1, y1, x2, y2, 30, o, () => {
    const { ctx } = v;
    if (luz > 0.02) brillo(ctx, 0, 0, 38, '#ffd23f', 0.75 * Math.min(1, luz));
    circulo(ctx, 0, 0, 15, luz > 0.02 ? alfa('#ffe27a', 0.25 + 0.6 * Math.min(1, luz)) : v.pal.fondo, o.color ?? v.pal.tinta, o.ancho ?? 2);
    ctx.beginPath();
    const k = 15 * 0.707;
    ctx.moveTo(-k, -k);
    ctx.lineTo(k, k);
    ctx.moveTo(-k, k);
    ctx.lineTo(k, -k);
    ctx.stroke();
  });
}

/** Voltmeter-style label for a node voltage. */
export function sonda(v: Vista, x: number, y: number, texto: string, color: string): void {
  txtRico(v, texto, x, y, { tam: 13, color, fondo: alfa(color, v.pal.oscuro ? 0.18 : 0.1), peso: 700 });
}

/**
 * Bipolar transistor symbol centred at (x, y): base terminal at (x − 36, y), collector at (x + 14, y − 44),
 * emitter at (x + 14, y + 44). Returns the terminal positions.
 */
export function bjt(
  v: Vista,
  x: number,
  y: number,
  o: Opc & { pnp?: boolean; activo?: number } = {},
): { b: [number, number]; c: [number, number]; e: [number, number] } {
  const { ctx, pal } = v;
  const c = o.color ?? pal.tinta;
  ctx.save();
  if (o.activo && o.activo > 0.02) brillo(ctx, x, y, 44, pal.corriente, 0.35 * o.activo);
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = 2;
  circulo(ctx, x + 2, y, 30, alfa(pal.fondo, 0.6), c, 1.6);
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 18);
  ctx.lineTo(x - 10, y + 18);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 36, y);
  ctx.lineTo(x - 10, y);
  ctx.moveTo(x - 10, y - 8);
  ctx.lineTo(x + 14, y - 26);
  ctx.lineTo(x + 14, y - 44);
  ctx.moveTo(x - 10, y + 8);
  ctx.lineTo(x + 14, y + 26);
  ctx.lineTo(x + 14, y + 44);
  ctx.stroke();
  if (o.pnp) flecha(ctx, x + 6, y + 20, x - 8, y + 10, c, 2, 9);
  else flecha(ctx, x - 4, y + 12, x + 12, y + 24, c, 2, 9);
  ctx.restore();
  return { b: [x - 36, y], c: [x + 14, y - 44], e: [x + 14, y + 44] };
}

/**
 * Enhancement MOSFET symbol centred at (x, y): gate at (x − 36, y), drain at (x + 14, y − 44),
 * source at (x + 14, y + 44). Draws the body diode when asked.
 */
export function mosfetSimbolo(
  v: Vista,
  x: number,
  y: number,
  o: Opc & { canalP?: boolean; activo?: number; diodoCuerpo?: boolean } = {},
): { g: [number, number]; d: [number, number]; s: [number, number] } {
  const { ctx, pal } = v;
  const c = o.color ?? pal.tinta;
  ctx.save();
  if (o.activo && o.activo > 0.02) brillo(ctx, x, y, 44, pal.corriente, 0.35 * o.activo);
  ctx.strokeStyle = c;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 36, y + (o.canalP ? -14 : 14));
  ctx.lineTo(x - 14, y + (o.canalP ? -14 : 14));
  ctx.moveTo(x - 14, y - 20);
  ctx.lineTo(x - 14, y + 20);
  ctx.stroke();
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  for (const yy of [-16, 0, 16]) {
    ctx.moveTo(x - 6, y + yy - 6);
    ctx.lineTo(x - 6, y + yy + 6);
  }
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 16);
  ctx.lineTo(x + 14, y - 16);
  ctx.lineTo(x + 14, y - 44);
  ctx.moveTo(x - 6, y + 16);
  ctx.lineTo(x + 14, y + 16);
  ctx.lineTo(x + 14, y + 44);
  ctx.moveTo(x - 6, y);
  ctx.lineTo(x + 14, y);
  ctx.lineTo(x + 14, y + 16);
  ctx.stroke();
  if (o.canalP) flecha(ctx, x - 4, y, x + 10, y, c, 2, 8);
  else flecha(ctx, x + 12, y, x - 4, y, c, 2, 8);
  ctx.restore();
  if (o.diodoCuerpo) {
    hilo(v, [
      [x + 14, y - 32],
      [x + 30, y - 32],
      [x + 30, y - 10],
    ], c, 1.4);
    hilo(v, [
      [x + 30, y + 10],
      [x + 30, y + 32],
      [x + 14, y + 32],
    ], c, 1.4);
    if (o.canalP) diodo(v, x + 30, y - 10, x + 30, y + 10, { tam: 12, color: c, ancho: 1.4 });
    else diodo(v, x + 30, y + 10, x + 30, y - 10, { tam: 12, color: c, ancho: 1.4 });
  }
  return { g: [x - 36, y + (o.canalP ? -14 : 14)], d: [x + 14, y - 44], s: [x + 14, y + 44] };
}
