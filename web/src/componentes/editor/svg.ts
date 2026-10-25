// A drawing as one SVG string, in the book's palette (for the live results plate, an <img>) or in the theme's
// (CSS variables), for export too. Same geometry as the editor's canvas (geometria.ts, rotulos.ts).

import type { Rect } from '../esquema-auto/simbolos.ts';
import type { Conectividad } from './conectividad.ts';
import { cajaMundo, geometria, S } from './geometria.ts';
import { ALTO, rotulo, TAM } from './rotulos.ts';
import type { DocumentoEsquema } from './tipos.ts';

export const MARGEN = 1;

const PALETAS = {
  libro: { tinta: '#1a3a5c', texto: '#1a3a5c', fondo: '#ffffff', acento: '#2e6ea6' },
  tema: { tinta: 'var(--titulos, #1a3a5c)', texto: 'var(--tinta, #262626)', fondo: 'var(--superficie, #ffffff)', acento: 'var(--acento, #2e6ea6)' },
};

const n = (v: number) => String(Math.round(v * 100) / 100);
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Bounds of everything drawn (world units), labels included. */
export function limites(doc: DocumentoEsquema): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const amp = (a: number, b: number, c: number, d: number) => {
    x0 = Math.min(x0, a);
    y0 = Math.min(y0, b);
    x1 = Math.max(x1, c);
    y1 = Math.max(y1, d);
  };
  for (const c of doc.componentes) {
    const b = cajaMundo(c);
    amp(b[0], b[1], b[2], b[3]);
    const r = rotulo(c);
    if (r) {
      const w = Math.max(...r.lineas.map((l) => (l.base.length + l.sub.length * 0.7 + l.resto.length) * TAM * 0.55));
      const xa = r.ancla === 'start' ? r.x : r.ancla === 'end' ? r.x - w : r.x - w / 2;
      amp(xa, r.y - TAM, xa + w, r.y + (r.lineas.length - 1) * ALTO + 0.1);
    }
  }
  for (const w of doc.cables) amp(Math.min(w.p[0], w.p[2]), Math.min(w.p[1], w.p[3]), Math.max(w.p[0], w.p[2]), Math.max(w.p[1], w.p[3]));
  if (!Number.isFinite(x0)) return [0, 0, 10, 6];
  return [x0, y0, x1, y1];
}

export interface SvgDibujo {
  svg: string;
  /** viewBox [0, 0, W, H] and the world point at its origin (minus the margin). */
  vista: [number, number, number, number];
  x0: number;
  y0: number;
}

export function svgDocumento(doc: DocumentoEsquema, con: Conectividad, op: { paleta?: 'libro' | 'tema'; fuentes?: string } = {}): SvgDibujo {
  const pal = PALETAS[op.paleta ?? 'libro'];
  const [lx0, ly0, lx1, ly1] = limites(doc);
  const x0 = lx0 - MARGEN;
  const y0 = ly0 - MARGEN;
  const W = Math.ceil((lx1 - lx0 + 2 * MARGEN) * S);
  const H = Math.ceil((ly1 - ly0 + 2 * MARGEN) * S);
  const X = (x: number) => n((x - x0) * S);
  const Y = (y: number) => n((y - y0) * S);
  const lw = 1.1;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="'Source Sans 3', 'Source Sans Pro', system-ui, sans-serif">`);
  out.push(`<style>${op.fuentes ?? ''}
.l{fill:none;stroke:${pal.tinta};stroke-width:${lw};stroke-linecap:round;stroke-linejoin:round}
.w{fill:none;stroke:${pal.tinta};stroke-width:${lw};stroke-linecap:square}
.ft{fill:${pal.tinta}}.fb{fill:${pal.fondo}}
.t{fill:${pal.texto};font-size:${n(TAM * S)}px}
.n{fill:${pal.acento};font-size:${n(TAM * S)}px;font-style:italic}
.p{fill:${pal.texto}}
</style>`);
  if (doc.cables.length) out.push(`<path class="w" d="${doc.cables.map((w) => `M${X(w.p[0])} ${Y(w.p[1])}L${X(w.p[2])} ${Y(w.p[3])}`).join('')}"/>`);
  for (const c of doc.componentes) {
    const g = geometria(c);
    out.push(`<g transform="translate(${n((c.x - x0) * S)} ${n((c.y - y0) * S)})">`);
    for (const t of g.trazos) out.push(`<path class="l${t.relleno === 'tinta' ? ' ft' : t.relleno === 'fondo' ? ' fb' : ''}" d="${t.d}"/>`);
    for (const t of g.textos) out.push(`<text class="p" x="${n(t.x * S)}" y="${n(t.y * S)}" text-anchor="${t.ancla}" font-size="${n(t.tam * S)}">${esc(t.s)}</text>`);
    out.push('</g>');
    const r = rotulo(c);
    if (r) {
      const clase = c.tipo === 'ETQ' ? 'n' : 't';
      r.lineas.forEach((l, i) => {
        const sub = l.sub ? `<tspan font-size="${n(TAM * S * 0.72)}" dy="${n(0.1 * S)}">${esc(l.sub)}</tspan>` : '';
        const resto = l.resto ? `<tspan${l.sub ? ` dy="${n(-0.1 * S)}"` : ''}>${esc(l.resto)}</tspan>` : '';
        out.push(`<text class="${clase}" x="${X(r.x)}" y="${Y(r.y + i * ALTO)}" text-anchor="${r.ancla}">${esc(l.base)}${sub}${resto}</text>`);
      });
    }
  }
  for (const p of con.uniones) out.push(`<circle class="ft" cx="${X(p[0])}" cy="${Y(p[1])}" r="${n(0.1 * S)}"/>`);
  out.push('</svg>');
  return { svg: out.join(''), vista: [0, 0, W, H], x0, y0 };
}
