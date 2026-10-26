// Painter of a board side on a Canvas 2D context, shared by the 2D view and the textures of the 3D view.
// Two looks: «real» (the manufactured board: solder mask over the laminate, copper under the mask a lighter
// shade, exposed pads tinned (HASL) or gold (ENIG), white silkscreen clipped by the mask openings) and «capas»
// (inspection colours per layer, as in KiCad). The context must already map board units (u = 0.01 mm) to pixels.

import type { DatosPlaca } from './datos';
import type { CapaCobre, Geometria, Lado } from './geometria';

export type Aspecto = 'real' | 'capas';
export type Acabado = 'hasl' | 'enig';

export interface CapasVisibles {
  F: boolean;
  B: boolean;
  mascara: boolean;
  serigrafia: boolean;
  fab: boolean;
  areas: boolean;
}

export interface OpcionesPintar {
  /** Side looked at (its layers go on top). */
  lado: Lado;
  aspecto: Aspecto;
  acabado: Acabado;
  visibles: CapasVisibles;
  /** Mask colour name from the project (README) or «verde». */
  mascara: string;
  /** Highlighted net (strong) and hovered net (light). */
  red?: number | null;
  rojo?: number | null;
  /** Colour per net (simulated or annotated DC voltages). */
  colores?: Map<number, string> | null;
  /** Pixels per u (for minimum stroke widths). */
  escala: number;
  /** Texture for the 3D view: holes punched out (transparent), no page background. */
  textura?: boolean;
  /** Only the copper of one side, on transparent (exploded / X-ray layers of the 3D view). */
  soloCobre?: boolean;
  oscuro?: boolean;
}

export const MASCARAS: Record<string, { base: string; cobre: string }> = {
  verde: { base: '#15462a', cobre: '#2a6e3a' },
  azul: { base: '#1b3f73', cobre: '#2f62a6' },
  roja: { base: '#7c1f1f', cobre: '#a8392f' },
  negra: { base: '#141414', cobre: '#2c2c2c' },
  blanca: { base: '#e8e8e2', cobre: '#f4f4ee' },
  // Super DMG-01, as in its author's photos
  morada: { base: '#4f1663', cobre: '#7a2a8f' },
};

export const COLORES_CAPA = {
  F: '#d23c3c',
  B: '#4a82d6',
  silkF: '#f2eda1',
  silkB: '#e8b2a7',
  fab: '#a8a8a8',
  fondoOscuro: '#0b1420',
  fondoClaro: '#f3f1ea',
};

const REALCE = '#ffb02e';
const REALCE_SUAVE = 'rgba(255,176,46,0.55)';

function rellenarCobre(ctx: CanvasRenderingContext2D, c: CapaCobre, color: string | ((red: number) => string | null), solo?: number): void {
  const col = (red: number): string | null => (typeof color === 'string' ? color : color(red));
  for (const [red, z] of c.zonas) {
    if (solo !== undefined && red !== solo) continue;
    const k = col(red);
    if (!k) continue;
    ctx.fillStyle = k;
    ctx.fill(z, 'evenodd');
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [w, porRed] of c.pistas) {
    ctx.lineWidth = w;
    for (const [red, p] of porRed) {
      if (solo !== undefined && red !== solo) continue;
      const k = col(red);
      if (!k) continue;
      ctx.strokeStyle = k;
      ctx.stroke(p);
    }
  }
  for (const m of [c.pads, c.vias]) {
    for (const [red, p] of m) {
      if (solo !== undefined && red !== solo) continue;
      const k = col(red);
      if (!k) continue;
      ctx.fillStyle = k;
      ctx.fill(p, 'nonzero');
    }
  }
}

function metal(acabado: Acabado): string {
  return acabado === 'enig' ? '#d6ad55' : '#c9cdd1';
}

/** Paints one side. Assumes the transform maps u to device pixels; `escala` = device px per u. */
export function pintarLado(ctx: CanvasRenderingContext2D, _d: DatosPlaca, g: Geometria, o: OpcionesPintar): void {
  const L = o.lado;
  const otro: Lado = L === 'F' ? 'B' : 'F';
  const v = o.visibles;
  const minimo = 0.8 / o.escala;
  if (o.soloCobre) {
    ctx.save();
    ctx.clip(g.contorno);
    rellenarCobre(ctx, g.cobre[L], o.aspecto === 'capas' ? COLORES_CAPA[L] : '#c8834a');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill(g.taladros, 'nonzero');
    ctx.restore();
    return;
  }
  ctx.save();
  if (o.aspecto === 'capas') {
    // dark board, both copper layers translucent, the side looked at on top
    ctx.fillStyle = o.textura ? '#0d1a14' : '#0f1d16';
    ctx.fill(g.contorno);
    ctx.clip(g.contorno);
    ctx.globalAlpha = 0.8;
    for (const l of [otro, L]) {
      if (!v[l]) continue;
      rellenarCobre(ctx, g.cobre[l], COLORES_CAPA[l]);
    }
    ctx.globalAlpha = 1;
    if (v.areas) pintarAreas(ctx, g, o);
    if (v.serigrafia) pintarSerigrafia(ctx, g, L, L === 'F' ? COLORES_CAPA.silkF : COLORES_CAPA.silkB, minimo);
    if (v.fab) {
      ctx.strokeStyle = COLORES_CAPA.fab;
      ctx.lineWidth = Math.max(10, minimo);
      ctx.globalAlpha = 0.8;
      ctx.stroke(g.fab[L]);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#05080b';
    ctx.fill(g.taladros, 'nonzero');
  } else {
    // manufactured look
    const mk = MASCARAS[o.mascara] ?? MASCARAS.verde!;
    ctx.fillStyle = v.mascara ? mk.base : '#c4b585';
    ctx.fill(g.contorno);
    ctx.clip(g.contorno);
    if (v[L]) {
      if (v.mascara) {
        rellenarCobre(ctx, g.cobre[L], mk.cobre);
        // exposed copper at the openings (pads), finished
        ctx.save();
        ctx.clip(g.aberturas[L], 'nonzero');
        rellenarCobre(ctx, g.cobre[L], metal(o.acabado));
        ctx.restore();
      } else {
        rellenarCobre(ctx, g.cobre[L], '#c47a45');
      }
    } else if (v.mascara) {
      // copper of this side hidden: the openings still show bare laminate
      ctx.fillStyle = '#bba870';
      ctx.fill(g.aberturas[L], 'nonzero');
    }
    if (v.areas) pintarAreas(ctx, g, o);
    if (v.serigrafia && g.serigrafia[L]) {
      ctx.save();
      // silkscreen never prints on the openings
      const fuera = new Path2D();
      fuera.rect(-1e5, -1e5, 1e6, 1e6);
      fuera.addPath(g.aberturas[L]);
      ctx.clip(fuera, 'evenodd');
      pintarSerigrafia(ctx, g, L, '#f3f3ec', minimo);
      ctx.restore();
    }
    if (v.fab) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = Math.max(10, minimo);
      ctx.stroke(g.fab[L]);
    }
    // drills: transparent in a texture, dark holes on paper
    if (o.textura) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill(g.taladros, 'nonzero');
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.fillStyle = o.oscuro ? '#050607' : '#2a2a28';
      ctx.fill(g.taladros, 'nonzero');
    }
  }
  // overlays: voltages, then hovered and selected nets
  if (o.colores && o.colores.size) {
    ctx.globalAlpha = 0.85;
    for (const l of [otro, L]) {
      if (!v[l] && o.aspecto === 'capas') continue;
      if (l !== L && o.aspecto === 'real') continue;
      rellenarCobre(ctx, g.cobre[l], (r) => o.colores!.get(r) ?? null);
    }
    ctx.globalAlpha = 1;
  }
  for (const [red, color, fuerte] of [
    [o.rojo, REALCE_SUAVE, false],
    [o.red, REALCE, true],
  ] as [number | null | undefined, string, boolean][]) {
    if (red === null || red === undefined || red < 0) continue;
    if (o.rojo === o.red && !fuerte) continue;
    for (const l of [otro, L]) {
      if (!v[l] && !(o.aspecto === 'real' && l === L)) continue;
      if (o.aspecto === 'real' && l !== L) continue;
      ctx.globalAlpha = fuerte ? 1 : 0.7;
      rellenarCobre(ctx, g.cobre[l], color, red);
    }
    ctx.globalAlpha = 1;
    if (!o.textura) {
      ctx.fillStyle = o.oscuro ? '#050607' : '#2a2a28';
      ctx.fill(g.taladros, 'nonzero');
    }
  }
  ctx.restore();
}

function pintarSerigrafia(ctx: CanvasRenderingContext2D, g: Geometria, L: Lado, color: string, minimo: number): void {
  const s = g.serigrafia[L];
  if (!s) return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [w, c] of s.trazos) {
    ctx.lineWidth = Math.max(w, minimo);
    ctx.stroke(c);
  }
  ctx.fill(s.rellenos, 'nonzero');
}

function pintarAreas(ctx: CanvasRenderingContext2D, g: Geometria, o: OpcionesPintar): void {
  for (const a of g.areas) {
    if (!a.capas.includes(o.lado)) continue;
    ctx.save();
    ctx.clip(a.camino);
    ctx.strokeStyle = o.aspecto === 'capas' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(12, 1 / o.escala);
    const paso = Math.max(80, 9 / o.escala);
    const c = new Path2D();
    for (let x = -g.alto; x < g.ancho + g.alto; x += paso) {
      c.moveTo(x, 0);
      c.lineTo(x + g.alto, g.alto);
    }
    ctx.stroke(c);
    ctx.restore();
    ctx.strokeStyle = o.aspecto === 'capas' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.35)';
    ctx.setLineDash([Math.max(60, 6 / o.escala), Math.max(40, 4 / o.escala)]);
    ctx.stroke(a.camino);
    ctx.setLineDash([]);
  }
}

// ------------------------------------------------------------------ voltages

/** Diverging colour for a DC voltage (blue negative, grey 0, red positive), log-like over ±40 V. */
export function colorTension(v: number): string {
  const t = Math.sign(v) * Math.min(1, Math.log10(1 + Math.abs(v)) / Math.log10(41));
  const gris = [150, 150, 150];
  const pos = [214, 48, 39];
  const neg = [49, 104, 196];
  const dst = t >= 0 ? pos : neg;
  const k = Math.abs(t);
  const c = gris.map((g0, i) => Math.round(g0 + (dst[i]! - g0) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function coloresTension(d: DatosPlaca): Map<number, string> {
  const m = new Map<number, string>();
  d.redes.forEach((r, i) => {
    if (r.v) m.set(i, colorTension(r.v.v));
  });
  return m;
}

/** One net's copper on the visible layers, in a colour (hover overlay of the 2D view). */
export function pintarRed(ctx: CanvasRenderingContext2D, g: Geometria, red: number, o: Pick<OpcionesPintar, 'lado' | 'aspecto' | 'visibles'>, color: string): void {
  const otro: Lado = o.lado === 'F' ? 'B' : 'F';
  ctx.save();
  ctx.clip(g.contorno);
  for (const l of [otro, o.lado]) {
    if (o.aspecto === 'real' ? l !== o.lado : !o.visibles[l]) continue;
    rellenarCobre(ctx, g.cobre[l], color, red);
  }
  ctx.restore();
}
