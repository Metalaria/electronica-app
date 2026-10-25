// Geometry of placed parts: pins and body in world units, and the symbol as a few SVG paths (24 px per unit,
// relative to the part's origin), cached per shape and orientation so that dragging redraws nothing but a
// transform. Signs, glyphs and texts stay upright whatever the orientation (as in esquema-auto/svg.ts).

import { girar, girarRect, type DefSimbolo, type Prim, type Pt, type Rect } from '../esquema-auto/simbolos.ts';
import { claveForma, defDe } from './catalogo.ts';
import type { Componente } from './tipos.ts';

export const S = 24;

export interface Trazo {
  d: string;
  /** Fill: none, ink or the background (diode triangles, open circles). */
  relleno: '' | 'tinta' | 'fondo';
}

export interface TextoSimbolo {
  x: number;
  y: number;
  s: string;
  ancla: 'start' | 'middle' | 'end';
  tam: number;
}

export interface Geometria {
  def: DefSimbolo;
  /** Pin positions relative to the origin (units) and their outward direction. */
  pines: { nombre: string; x: number; y: number; dx: number; dy: number }[];
  /** Body box relative to the origin (units). */
  cuerpo: Rect;
  /** Hit box: body and pins (units). */
  caja: Rect;
  trazos: Trazo[];
  textos: TextoSimbolo[];
  /** Label anchor (units) and direction. */
  etq: { x: number; y: number; dx: number; dy: number };
}

const r2 = (v: number) => Math.round(v * 100) / 100;

function camino(ps: Pt[], cerrado = false): string {
  return `M${ps.map((p) => `${r2(p[0] * S)} ${r2(p[1] * S)}`).join('L')}${cerrado ? 'Z' : ''}`;
}

function circulo(c: Pt, r: number): string {
  const x = r2(c[0] * S);
  const y = r2(c[1] * S);
  const R = r2(r * S);
  return `M${r2(x - R)} ${y}a${R} ${R} 0 1 0 ${r2(2 * R)} 0a${R} ${R} 0 1 0 ${r2(-2 * R)} 0Z`;
}

function trazosDe(def: DefSimbolo, o: number): { trazos: Trazo[]; textos: TextoSimbolo[] } {
  const T = (p: Pt): Pt => girar(o, p[0], p[1]);
  const trazos: Trazo[] = [];
  const textos: TextoSimbolo[] = [];
  const centro = T([(def.cuerpo[0] + def.cuerpo[2]) / 2, (def.cuerpo[1] + def.cuerpo[3]) / 2]);
  const poner = (d: string, relleno: Trazo['relleno']) => {
    const u = trazos[trazos.length - 1];
    if (u && u.relleno === relleno && relleno === '') u.d += d;
    else trazos.push({ d, relleno });
  };
  for (const pr of def.prims as Prim[]) {
    switch (pr.t) {
      case 'l':
        poner(camino(pr.p.map(T), pr.cerrado), pr.relleno ?? '');
        break;
      case 'c':
        poner(circulo(T(pr.c), pr.r), pr.relleno ?? '');
        break;
      case 'signo': {
        const [cx, cy] = T(pr.c);
        const h = 0.12;
        poner(camino([[cx - h, cy], [cx + h, cy]]) + (pr.s === '+' ? camino([[cx, cy - h], [cx, cy + h]]) : ''), '');
        break;
      }
      case 'glifo': {
        const [cx, cy] = T(pr.c);
        let ps: Pt[];
        if (pr.g === 'sin') {
          ps = [];
          for (let i = 0; i <= 24; i++) {
            const t = i / 24;
            ps.push([cx - 0.27 + 0.54 * t, cy - 0.15 * Math.sin(2 * Math.PI * t)]);
          }
        } else if (pr.g === 'cuadrada') {
          ps = [
            [cx - 0.28, cy + 0.14],
            [cx - 0.14, cy + 0.14],
            [cx - 0.14, cy - 0.14],
            [cx + 0.14, cy - 0.14],
            [cx + 0.14, cy + 0.14],
            [cx + 0.28, cy + 0.14],
          ];
        } else {
          ps = [
            [cx - 0.28, cy + 0.14],
            [cx - 0.05, cy - 0.14],
            [cx + 0.1, cy + 0.04],
            [cx + 0.28, cy - 0.1],
          ];
        }
        poner(camino(ps), '');
        break;
      }
      case 'texto': {
        const [cx, cy] = T(pr.c);
        let ancla = pr.ancla;
        if (pr.ref) ancla = cx < centro[0] - 0.1 ? 'end' : cx > centro[0] + 0.1 ? 'start' : 'middle';
        textos.push({ x: cx, y: cy + pr.tam * 0.36, s: pr.s, ancla, tam: pr.tam });
        break;
      }
    }
  }
  return { trazos, textos };
}

const cache = new Map<string, Geometria>();

export function geometria(c: Componente): Geometria {
  const k = `${claveForma(c)}#${c.o}`;
  let g = cache.get(k);
  if (g) return g;
  const def = defDe(c);
  const o = c.o;
  const pines = Object.entries(def.pines).map(([nombre, p]) => {
    const [x, y] = girar(o, p.x, p.y);
    const [dx, dy] = girar(o, p.dx, p.dy);
    return { nombre, x, y, dx, dy };
  });
  const cuerpo = girarRect(o, def.cuerpo);
  let caja: Rect = [...cuerpo];
  for (const p of pines) caja = [Math.min(caja[0], p.x), Math.min(caja[1], p.y), Math.max(caja[2], p.x), Math.max(caja[3], p.y)];
  const { trazos, textos } = trazosDe(def, o);
  const [ex, ey] = girar(o, def.etq.x, def.etq.y);
  const [edx, edy] = girar(o, def.etq.dx, def.etq.dy);
  g = { def, pines, cuerpo, caja, trazos, textos, etq: { x: ex, y: ey, dx: edx, dy: edy } };
  cache.set(k, g);
  return g;
}

/** Pins of a placed part in world units. */
export function pinesMundo(c: Componente): { nombre: string; x: number; y: number; dx: number; dy: number }[] {
  return geometria(c).pines.map((p) => ({ ...p, x: p.x + c.x, y: p.y + c.y }));
}

export function cajaMundo(c: Componente): Rect {
  const b = geometria(c).caja;
  return [b[0] + c.x, b[1] + c.y, b[2] + c.x, b[3] + c.y];
}

/** Orientation after a quarter turn clockwise (R) or a mirror (X: left–right as seen on screen). */
export function girada(o: number): number {
  return (o & 4) | (((o & 3) + 1) & 3);
}

export function reflejada(o: number): number {
  // Mirror on screen about the vertical axis: x → −x. With the code's «mirror y first, then turn», a left–right
  // mirror of turn k equals the y-mirror with turn (k + 2) when k is even and k when it is odd.
  const k = o & 3;
  const m = o & 4 ? 0 : 4;
  return m | (k % 2 === 0 ? (k + 2) & 3 : k);
}
