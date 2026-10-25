// Canvas drawing helpers shared by every scene. Coordinates are the scene's logical units; text sizes are
// given in CSS pixels and converted so that labels stay legible on a phone (see Vista.f).

import type { Paleta } from './paleta';
import { alfa, mezcla } from './paleta';

export type Ctx = CanvasRenderingContext2D;

export interface Vista {
  ctx: Ctx;
  /** Logical size of the scene. */
  w: number;
  h: number;
  /** CSS pixels per logical unit. */
  escala: number;
  dpr: number;
  pal: Paleta;
  /** Narrow layout (phone): scenes may move or drop secondary labels. */
  estrecho: boolean;
  /** Simulated time (s), advanced only while playing. */
  t: number;
  /** Logical size that looks like `px` CSS pixels (bounded so text grows a little on big screens). */
  f(px: number): number;
  /** Canvas font string for a text of `px` CSS pixels. */
  fuente(px: number, peso?: number | string): string;
  /** Draws a cached layer (redrawn only when `clave` changes); used for static backgrounds. */
  capa(clave: string, dibujar: (ctx: Ctx) => void): void;
}

export const FAMILIA = '"Source Sans 3", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// ------------------------------------------------------------------ text boxes (tests)

/** A text drawn in the last frame: its box in device pixels of the visible canvas. */
export interface CajaTexto {
  s: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Test hook (tests/escenas-textos.spec.ts): while `globalThis.__epaTextos` is a Map, every text drawn by txt()
 * and txtRico() is recorded per canvas, so overlapping labels can be found at any size and with any font.
 * Ui/Escena.svelte clears a canvas's list before each frame and copies the cached layers' texts into it.
 */
export function registroTextos(): Map<HTMLCanvasElement | OffscreenCanvas, CajaTexto[]> | null {
  const r = (globalThis as { __epaTextos?: unknown }).__epaTextos;
  return r instanceof Map ? (r as Map<HTMLCanvasElement | OffscreenCanvas, CajaTexto[]>) : null;
}

function registrar(ctx: Ctx, s: string, x0: number, y0: number, w: number, h: number): void {
  const reg = registroTextos();
  if (!reg || !s.trim()) return;
  const m = ctx.getTransform();
  if (m.b !== 0 || m.c !== 0) return;
  let l = reg.get(ctx.canvas);
  if (!l) reg.set(ctx.canvas, (l = []));
  l.push({ s, x0: m.a * x0 + m.e, y0: m.d * y0 + m.f, x1: m.a * (x0 + w) + m.e, y1: m.d * (y0 + h) + m.f });
}

// ------------------------------------------------------------------ primitives

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** Adds a rounded rectangle sub-path to the current path (no beginPath), for batched drawing. */
export function subRR(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

export function linea(ctx: Ctx, pts: [number, number][], color: string, ancho = 2, discontinua?: number[]): void {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = ancho;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (discontinua) ctx.setLineDash(discontinua);
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
  ctx.stroke();
  ctx.restore();
}

export function circulo(ctx: Ctx, x: number, y: number, r: number, relleno?: string, trazo?: string, ancho = 1.5): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (relleno) {
    ctx.fillStyle = relleno;
    ctx.fill();
  }
  if (trazo) {
    ctx.strokeStyle = trazo;
    ctx.lineWidth = ancho;
    ctx.stroke();
  }
}

/** Arrow from (x1, y1) to (x2, y2). */
export function flecha(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  ancho = 2,
  punta = 9,
  discontinua?: number[],
): void {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const l = Math.hypot(x2 - x1, y2 - y1);
  if (l < 0.5) return;
  const p = Math.min(punta, l * 0.6);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = ancho;
  ctx.lineCap = 'round';
  if (discontinua) ctx.setLineDash(discontinua);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(a) * p * 0.7, y2 - Math.sin(a) * p * 0.7);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(a - 0.42) * p, y2 - Math.sin(a - 0.42) * p);
  ctx.lineTo(x2 - Math.cos(a + 0.42) * p, y2 - Math.sin(a + 0.42) * p);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Arrow head only, pointing along angle `a`, centred at (x, y). */
export function punta(ctx: Ctx, x: number, y: number, a: number, color: string, tam = 9): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tam * 0.6, 0);
  ctx.lineTo(-tam * 0.5, -tam * 0.48);
  ctx.lineTo(-tam * 0.25, 0);
  ctx.lineTo(-tam * 0.5, tam * 0.48);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export interface OpcTexto {
  tam?: number;
  peso?: number | string;
  color?: string;
  alin?: CanvasTextAlign;
  base?: CanvasTextBaseline;
  /** Background pill colour. */
  fondo?: string;
  borde?: string;
  /** Rotation in radians. */
  rot?: number;
  cursiva?: boolean;
  /** Widest the text may be (logical units): a longer one is drawn with a smaller font to fit. */
  max?: number;
}

/**
 * Horizontal shift that keeps a text run starting at local x0 with width `ancho` inside the canvas (labels
 * near the edges of narrow phone scenes would otherwise be clipped). Works under any unrotated transform.
 */
function dentro(ctx: Ctx, x0: number, ancho: number, margen: number): number {
  const m = ctx.getTransform();
  if (m.b !== 0 || m.c !== 0 || m.a <= 0) return 0;
  const W = ctx.canvas.width;
  const izq = m.a * x0 + m.e;
  const der = izq + m.a * ancho;
  const mg = margen * m.a;
  if (der - izq > W - 2 * mg) return 0;
  if (izq < mg) return (mg - izq) / m.a;
  if (der > W - mg) return (W - mg - der) / m.a;
  return 0;
}

/** Text with optional background pill. Returns the width in logical units. */
export function txt(v: Vista, s: string, x: number, y: number, o: OpcTexto = {}): number {
  const { ctx } = v;
  const tam = o.tam ?? 13;
  ctx.save();
  ctx.font = (o.cursiva ? 'italic ' : '') + v.fuente(tam, o.peso ?? 600);
  ctx.textAlign = o.alin ?? 'center';
  ctx.textBaseline = o.base ?? 'middle';
  if (o.rot) {
    ctx.translate(x, y);
    ctx.rotate(o.rot);
    x = 0;
    y = 0;
  }
  let ancho = ctx.measureText(s).width;
  if (o.max && ancho > o.max) {
    ctx.font = (o.cursiva ? 'italic ' : '') + v.fuente((tam * o.max) / ancho, o.peso ?? 600);
    ancho = ctx.measureText(s).width;
  }
  if (!o.rot) {
    const al0 = ctx.textAlign;
    const pad0 = o.fondo ? v.f(tam) * 0.45 : 0;
    const xi = al0 === 'center' ? x - ancho / 2 : al0 === 'right' || al0 === 'end' ? x - ancho : x;
    x += dentro(ctx, xi - pad0, ancho + 2 * pad0, 2);
  }
  if (o.fondo) {
    const fh = v.f(tam) * 1.45;
    const pad = v.f(tam) * 0.45;
    const al = ctx.textAlign;
    const x0 = al === 'center' ? x - ancho / 2 : al === 'right' || al === 'end' ? x - ancho : x;
    const bl = ctx.textBaseline;
    const y0 = bl === 'middle' ? y - fh / 2 : bl === 'top' ? y - fh * 0.15 : y - fh * 0.8;
    rr(ctx, x0 - pad, y0, ancho + pad * 2, fh, fh / 2);
    ctx.fillStyle = o.fondo;
    ctx.fill();
    if (o.borde) {
      ctx.strokeStyle = o.borde;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  ctx.fillStyle = o.color ?? v.pal.tinta;
  ctx.fillText(s, x, y);
  if (!o.rot) {
    const al = ctx.textAlign;
    const bl = ctx.textBaseline;
    const alto = v.f(tam);
    const xi = al === 'center' ? x - ancho / 2 : al === 'right' || al === 'end' ? x - ancho : x;
    const yi = bl === 'middle' ? y - alto * 0.5 : bl === 'top' || bl === 'hanging' ? y : bl === 'bottom' ? y - alto : y - alto * 0.78;
    registrar(ctx, s, xi, yi, ancho, alto);
  }
  ctx.restore();
  return ancho;
}

/**
 * Text with sub- and superscripts written inline: «V_BE», «10^17 cm^-3», «I_C = β·I_B».
 * `_x` / `^x` take one token (letters/digits/sign); use braces for longer: «V_{CE(sat)}».
 */
export function txtRico(v: Vista, s: string, x: number, y: number, o: OpcTexto = {}): number {
  const { ctx } = v;
  const tam = o.tam ?? 13;
  const trozos: { t: string; tipo: 0 | 1 | 2 }[] = [];
  const re = /([_^])(\{[^}]*\}|[−\-+]?[A-Za-z0-9áéíóúñÁÉÍÓÚ]+)/g;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > k) trozos.push({ t: s.slice(k, m.index), tipo: 0 });
    const cuerpo = m[2]!.replace(/^\{|\}$/g, '');
    trozos.push({ t: cuerpo, tipo: m[1] === '_' ? 1 : 2 });
    k = m.index + m[0].length;
  }
  if (k < s.length) trozos.push({ t: s.slice(k), tipo: 0 });
  ctx.save();
  let fN = (o.cursiva ? 'italic ' : '') + v.fuente(tam, o.peso ?? 600);
  let fP = (o.cursiva ? 'italic ' : '') + v.fuente(tam * 0.72, o.peso ?? 600);
  let total = 0;
  for (const t of trozos) {
    ctx.font = t.tipo ? fP : fN;
    total += ctx.measureText(t.t).width;
  }
  let tamReal = tam;
  if (o.max && total > o.max) {
    // Too wide (a narrow phone, or a wider fallback font): a smaller font that fits.
    tamReal = (tam * o.max) / total;
    fN = (o.cursiva ? 'italic ' : '') + v.fuente(tamReal, o.peso ?? 600);
    fP = (o.cursiva ? 'italic ' : '') + v.fuente(tamReal * 0.72, o.peso ?? 600);
    total = 0;
    for (const t of trozos) {
      ctx.font = t.tipo ? fP : fN;
      total += ctx.measureText(t.t).width;
    }
  }
  const al = o.alin ?? 'center';
  let cx = al === 'center' ? x - total / 2 : al === 'right' || al === 'end' ? x - total : x;
  const pad0 = o.fondo ? v.f(tam) * 0.45 : 0;
  cx += dentro(ctx, cx - pad0, total + 2 * pad0, 2);
  if (o.fondo) {
    const fh = v.f(tam) * 1.5;
    const pad = v.f(tam) * 0.45;
    rr(ctx, cx - pad, y - fh / 2, total + pad * 2, fh, fh / 2);
    ctx.fillStyle = o.fondo;
    ctx.fill();
    if (o.borde) {
      ctx.strokeStyle = o.borde;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  ctx.fillStyle = o.color ?? v.pal.tinta;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const d = v.f(tamReal);
  registrar(ctx, s, cx, y - d * 0.5, total, d);
  for (const t of trozos) {
    ctx.font = t.tipo ? fP : fN;
    const dy = t.tipo === 1 ? d * 0.3 : t.tipo === 2 ? -d * 0.38 : 0;
    ctx.fillText(t.t, cx, y + dy);
    cx += ctx.measureText(t.t).width;
  }
  ctx.restore();
  return total;
}

/** Label joined to the point it names by a thin leader line. */
export function etiqueta(v: Vista, s: string, x: number, y: number, ax: number, ay: number, o: OpcTexto = {}): void {
  const { ctx, pal } = v;
  ctx.save();
  ctx.strokeStyle = o.color ? alfa(o.color, 0.7) : pal.suave;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(x, y);
  ctx.stroke();
  circulo(ctx, ax, ay, 2.2, o.color ?? pal.suave);
  ctx.restore();
  const alin: CanvasTextAlign = o.alin ?? (x < ax - 4 ? 'right' : x > ax + 4 ? 'left' : 'center');
  const dx = alin === 'right' ? -4 : alin === 'left' ? 4 : 0;
  const dy = alin === 'center' ? (y < ay ? -v.f(o.tam ?? 13) * 0.75 : v.f(o.tam ?? 13) * 0.75) : 0;
  txtRico(v, s, x + dx, y + dy, { color: pal.suave, peso: 600, ...o, alin });
}

// ------------------------------------------------------------------ carriers and charges

/** Many electrons in one path: blue filled dots with a small highlight. */
export function electrones(ctx: Ctx, pts: Iterable<{ x: number; y: number; a?: number }>, r: number, pal: Paleta): void {
  ctx.beginPath();
  const brillo: { x: number; y: number }[] = [];
  for (const p of pts) {
    if (p.a !== undefined && p.a <= 0.01) continue;
    ctx.moveTo(p.x + r, p.y);
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    brillo.push(p);
  }
  ctx.fillStyle = pal.electron;
  ctx.fill();
  ctx.beginPath();
  for (const p of brillo) {
    ctx.moveTo(p.x - r * 0.3 + r * 0.32, p.y - r * 0.32);
    ctx.arc(p.x - r * 0.3, p.y - r * 0.32, r * 0.32, 0, Math.PI * 2);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
}

/** Many holes: red rings (hollow), as in the book's figures. */
export function huecos(ctx: Ctx, pts: Iterable<{ x: number; y: number }>, r: number, pal: Paleta): void {
  ctx.beginPath();
  for (const p of pts) {
    ctx.moveTo(p.x + r, p.y);
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  }
  ctx.fillStyle = alfa(pal.hueco, pal.oscuro ? 0.18 : 0.12);
  ctx.fill();
  ctx.strokeStyle = pal.hueco;
  ctx.lineWidth = Math.max(1.2, r * 0.42);
  ctx.stroke();
}

/** Fixed ionised dopant atoms: small rounded squares with + (donor) or − (acceptor). */
export function iones(ctx: Ctx, pts: Iterable<{ x: number; y: number }>, s: number, signo: 1 | -1, pal: Paleta, a = 1): void {
  const c = signo > 0 ? pal.ionD : pal.ionA;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = c;
  ctx.lineWidth = Math.max(1, s * 0.13);
  ctx.beginPath();
  const lista: { x: number; y: number }[] = [];
  for (const p of pts) {
    lista.push(p);
    subRR(ctx, p.x - s / 2, p.y - s / 2, s, s, s * 0.25);
  }
  ctx.fillStyle = alfa(c, 0.14);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  const k = s * 0.28;
  for (const p of lista) {
    ctx.moveTo(p.x - k, p.y);
    ctx.lineTo(p.x + k, p.y);
    if (signo > 0) {
      ctx.moveTo(p.x, p.y - k);
      ctx.lineTo(p.x, p.y + k);
    }
  }
  ctx.lineWidth = Math.max(1.1, s * 0.15);
  ctx.stroke();
  ctx.restore();
}

/** A photon: a short wave packet travelling along angle `a`, coloured by its wavelength. */
export function foton(ctx: Ctx, x: number, y: number, a: number, color: string, largo = 26, amp = 4, alfaG = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.globalAlpha = alfaG;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const xx = -largo + u * largo;
    const env = Math.sin(Math.PI * u);
    const yy = Math.sin(u * Math.PI * 6) * amp * env;
    if (i === 0) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  }
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(-2, -3.5);
  ctx.lineTo(-2, 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Soft glow (radial gradient) for heat, light or recombination flashes. */
export function brillo(ctx: Ctx, x: number, y: number, r: number, color: string, a = 0.6): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alfa(color, a));
  g.addColorStop(1, alfa(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ------------------------------------------------------------------ sprites

const sprites = new Map<string, HTMLCanvasElement>();

/**
 * Draws a small shape that repeats many times per frame (lattice ions, grains) from a cached bitmap made at
 * the current device resolution: one drawImage instead of a gradient, a path and a text each time.
 * `fn` draws the shape centred at (0, 0) within radius `r`.
 */
export function sprite(v: Vista, clave: string, r: number, x: number, y: number, fn: (c: Ctx) => void): void {
  const k = v.escala * v.dpr;
  const id = `${clave}|${r}|${k.toFixed(3)}|${v.pal.fondo}`;
  let c = sprites.get(id);
  if (!c) {
    if (sprites.size > 64) sprites.clear();
    c = document.createElement('canvas');
    const lado = Math.ceil(2 * r * k) + 2;
    c.width = lado;
    c.height = lado;
    const g = c.getContext('2d') as Ctx | null;
    if (g) {
      g.setTransform(k, 0, 0, k, lado / 2, lado / 2);
      fn(g);
    }
    sprites.set(id, c);
  }
  const l = c.width / k;
  v.ctx.drawImage(c, x - l / 2, y - l / 2, l, l);
}

// ------------------------------------------------------------------ background and panels

/** Scene background: theme paper with a faint dot grid. */
export function fondo(v: Vista): void {
  v.capa(`fondo:${v.w}x${v.h}:${v.pal.fondo}`, (ctx) => {
    ctx.fillStyle = v.pal.fondo;
    ctx.fillRect(0, 0, v.w, v.h);
    ctx.fillStyle = alfa(v.pal.tenue, v.pal.oscuro ? 0.18 : 0.22);
    const paso = 20;
    ctx.beginPath();
    for (let x = paso / 2; x < v.w; x += paso)
      for (let y = paso / 2; y < v.h; y += paso) {
        ctx.moveTo(x + 0.9, y);
        ctx.arc(x, y, 0.9, 0, Math.PI * 2);
      }
    ctx.fill();
  });
}

/** Rounded card inside the scene (insets, zoom boxes). */
export function tarjeta(v: Vista, x: number, y: number, w: number, h: number, titulo?: string): void {
  const { ctx, pal } = v;
  // Soft shadow faked with two offset fills: shadowBlur is a Gaussian blur on every frame, which costs a lot
  // on integrated GPUs and in software rendering.
  const sombra = pal.oscuro ? 'rgba(0,0,0,0.22)' : 'rgba(30,40,50,0.05)';
  ctx.fillStyle = sombra;
  rr(ctx, x - 1, y + 1, w + 2, h + 3, 11);
  ctx.fill();
  rr(ctx, x, y + 2, w, h + 1, 10);
  ctx.fill();
  rr(ctx, x, y, w, h, 10);
  ctx.fillStyle = pal.panel;
  ctx.fill();
  rr(ctx, x, y, w, h, 10);
  ctx.strokeStyle = pal.linea;
  ctx.lineWidth = 1;
  ctx.stroke();
  if (titulo) txt(v, titulo, x + 10, y + v.f(12) * 1.1, { tam: 12, alin: 'left', color: pal.suave, peso: 700 });
}

/** Vertical linear gradient that makes a flat shape look like a cylinder. */
export function gradCilindro(ctx: Ctx, y0: number, y1: number, color: string, oscuro = false): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, mezcla(color, '#000000', 0.25));
  g.addColorStop(0.18, mezcla(color, '#ffffff', oscuro ? 0.12 : 0.35));
  g.addColorStop(0.45, color);
  g.addColorStop(1, mezcla(color, '#000000', 0.35));
  return g;
}

/** Same as gradCilindro but horizontal (vertical cylinders). */
export function gradCilindroX(ctx: Ctx, x0: number, x1: number, color: string, oscuro = false): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, mezcla(color, '#000000', 0.25));
  g.addColorStop(0.2, mezcla(color, '#ffffff', oscuro ? 0.12 : 0.35));
  g.addColorStop(0.5, color);
  g.addColorStop(1, mezcla(color, '#000000', 0.35));
  return g;
}

// ------------------------------------------------------------------ paths and flow along wires

/** A polyline with arc-length parametrisation, for particles that follow wires. */
export class Camino {
  readonly pts: [number, number][];
  readonly acum: number[];
  readonly largo: number;
  constructor(
    pts: [number, number][],
    readonly cerrado = false,
  ) {
    this.pts = cerrado ? [...pts, pts[0]!] : pts;
    this.acum = [0];
    let s = 0;
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1]!;
      const b = this.pts[i]!;
      s += Math.hypot(b[0] - a[0], b[1] - a[1]);
      this.acum.push(s);
    }
    this.largo = s;
  }

  /** Point and direction at arc length s (wrapped when closed, clamped otherwise). */
  en(s: number): { x: number; y: number; a: number } {
    const L = this.largo;
    let u = this.cerrado ? ((s % L) + L) % L : Math.min(Math.max(s, 0), L);
    let i = 1;
    while (i < this.acum.length - 1 && this.acum[i]! < u) i++;
    const a = this.pts[i - 1]!;
    const b = this.pts[i]!;
    const s0 = this.acum[i - 1]!;
    const seg = this.acum[i]! - s0 || 1;
    u = (u - s0) / seg;
    return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, a: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }

  trazar(ctx: Ctx): void {
    ctx.beginPath();
    ctx.moveTo(this.pts[0]![0], this.pts[0]![1]);
    for (let i = 1; i < this.pts.length; i++) ctx.lineTo(this.pts[i]![0], this.pts[i]![1]);
  }
}

/**
 * Electrons moving along a wire. `fase` is the travelled distance of the train (advance it by
 * velocity·dt); electrons go opposite to the conventional current, so pass −(current speed).
 */
export function electronesEnCamino(ctx: Ctx, c: Camino, fase: number, paso: number, r: number, pal: Paleta, alfaG = 1): void {
  if (alfaG <= 0.01) return;
  const pts: { x: number; y: number }[] = [];
  const n = Math.floor(c.largo / paso);
  for (let i = 0; i < n; i++) {
    const s = (((fase + i * paso) % c.largo) + c.largo) % c.largo;
    if (!c.cerrado && (s < paso * 0.3 || s > c.largo - paso * 0.3)) continue;
    pts.push(c.en(s));
  }
  ctx.save();
  ctx.globalAlpha = alfaG;
  electrones(ctx, pts, r, pal);
  ctx.restore();
}

/** Conventional current arrow heads along a wire (amber), spaced every `paso`. */
export function corrienteEnCamino(ctx: Ctx, c: Camino, fase: number, paso: number, pal: Paleta, tam = 10, alfaG = 1): void {
  if (alfaG <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alfaG;
  const n = Math.max(1, Math.floor(c.largo / paso));
  for (let i = 0; i < n; i++) {
    const s = (((fase + (i + 0.5) * paso) % c.largo) + c.largo) % c.largo;
    const p = c.en(s);
    punta(ctx, p.x, p.y, p.a, pal.corriente, tam);
  }
  ctx.restore();
}

/** Thermal-like random motion helper: smooth pseudo-random value in [−1, 1] for (seed, time). */
export function ruido(semilla: number, t: number): number {
  return (
    Math.sin(t * 1.7 + semilla * 12.9898) * 0.5 +
    Math.sin(t * 2.9 + semilla * 78.233) * 0.3 +
    Math.sin(t * 4.3 + semilla * 37.719) * 0.2
  );
}

/** Deterministic pseudo-random generator (mulberry32) so that scenes look the same on every load. */
export function azar(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function limitar(x: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, x));
}

export function suave(x: number): number {
  const k = limitar(x, 0, 1);
  return k * k * (3 - 2 * k);
}
