// SVG of an automatic schematic, in the book's style. Two palettes: «libro» (fixed colours of the book's
// figures, for a picture shown on the figure plate, e.g. as an <img>) and «tema» (the app's CSS variables, for
// inline SVG that follows light and dark mode).

import { ALTO_LINEA, partesRef, TAM_ETQ, type Talon } from './colocacion.ts';
import { esc, etiquetaMundo, TAM_NOMBRE, type EsquemaAuto } from './generar.ts';
import { girar, type Prim, type Pt, type Rect } from './simbolos.ts';

export type Paleta = 'libro' | 'tema';

export interface OpcionesSvg {
  paleta?: Paleta;
  /** @font-face rules to embed (data: URLs), for pictures that cannot see the page's fonts. */
  fuentes?: string;
  /** Element id highlighted (selected). */
  resaltado?: string | null;
  /** Add invisible hit areas and data attributes for clicks. */
  interactivo?: boolean;
}

const COLORES = {
  libro: {
    tinta: '#1a3a5c',
    texto: '#1a3a5c',
    suave: '#4d5656',
    acento: '#2e6ea6',
    fondo: '#ffffff',
    resalte: '#b9770e',
  },
  tema: {
    tinta: 'var(--titulos, #1a3a5c)',
    texto: 'var(--tinta, #262626)',
    suave: 'var(--tinta-suave, #5d6d7e)',
    acento: 'var(--acento, #2e6ea6)',
    fondo: 'var(--superficie, #ffffff)',
    resalte: 'var(--c-importante, #b9770e)',
  },
};

function n(v: number): string {
  return String(Math.round(v * 100) / 100);
}

export function svgEsquema(a: EsquemaAuto, op: OpcionesSvg = {}): string {
  const pal = COLORES[op.paleta ?? 'libro'];
  const S = a.escala;
  const M = a.margen;
  const [x0, y0] = a.dibujo.limites;
  const X = (x: number) => n(S * (x - x0 + M));
  const Y = (y: number) => n(S * (y - y0 + M));
  const P = (p: Pt) => `${X(p[0])} ${Y(p[1])}`;
  const camino = (ps: Pt[], cerrado = false) => `M${ps.map(P).join('L')}${cerrado ? 'Z' : ''}`;
  const out: string[] = [];
  const [, , W, H] = a.vista;
  const lw = 1.1;
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="esquema-auto" font-family="'Source Sans 3', 'Source Sans Pro', system-ui, sans-serif">`,
  );
  out.push(`<style>${op.fuentes ?? ''}
.ea-l{fill:none;stroke:${pal.tinta};stroke-width:${lw};stroke-linecap:round;stroke-linejoin:round}
.ea-w{fill:none;stroke:${pal.tinta};stroke-width:${lw};stroke-linecap:square;stroke-linejoin:miter}
.ea-fino{stroke-width:${lw * 0.7}}
.ea-ft{fill:${pal.tinta}}
.ea-fb{fill:${pal.fondo}}
.ea-t{fill:${pal.texto};font-size:${n(TAM_ETQ * S)}px}
.ea-v{fill:${pal.texto};font-size:${n(TAM_ETQ * S)}px}
.ea-p{fill:${pal.suave};font-size:${n(0.3 * S)}px}
.ea-r{fill:${pal.texto};font-size:${n(TAM_ETQ * S)}px}
.ea-n{fill:${pal.acento};font-size:${n(TAM_ETQ * S)}px;font-style:italic}
.ea-nl{stroke:${pal.acento}}
.ea-nn{fill:${pal.acento};font-size:${n(TAM_NOMBRE * S)}px;font-style:italic;opacity:.85}
.ea-sel .ea-l,.ea-sel .ea-w{stroke:${pal.resalte}}
.ea-sel .ea-ft{fill:${pal.resalte}}
.ea-hit{fill:transparent;stroke:none}
</style>`);

  // Wires first (symbols are drawn over their ends).
  for (const c of a.dibujo.cables) {
    const d = c.runs.map(([p, q, r, s]) => `M${X(p)} ${Y(q)}L${X(r)} ${Y(s)}`).join('');
    out.push(`<path class="ea-w" data-red="${esc(c.red)}" d="${d}"/>`);
  }

  const texto = (x: number, y: number, s: string, ancla: string, clase: string, ref?: string) => {
    let cuerpo = esc(s);
    if (ref && (s === ref || s.startsWith(ref + ' '))) {
      const p = partesRef(ref);
      const resto = s.slice(ref.length);
      cuerpo = p.sub
        ? `${esc(p.base)}<tspan font-size="${n(TAM_ETQ * S * 0.72)}px" dy="${n(0.1 * S)}">${esc(p.sub)}</tspan>${resto ? `<tspan dy="${n(-0.1 * S)}">${esc(resto)}</tspan>` : ''}`
        : esc(s);
    }
    return `<text class="${clase}" x="${X(x)}" y="${Y(y)}" text-anchor="${ancla}">${cuerpo}</text>`;
  };

  for (const ud of a.dibujo.unidades) {
    const u = ud.u;
    const v = u.vars[u.v]!;
    const o = v.o;
    const T = (p: Pt): Pt => {
      const [x, y] = girar(o, p[0], p[1]);
      return [x + ud.x, y + ud.y];
    };
    const sel = op.resaltado && op.resaltado === ud.el;
    const attrs = op.interactivo && ud.el ? ` data-el="${ud.el}"${u.disp ? ` data-disp="${esc(u.disp.clave)}"` : ''}` : '';
    out.push(`<g class="ea-u${sel ? ' ea-sel' : ''}"${attrs}>`);
    const centro = T([(v.def.cuerpo[0] + v.def.cuerpo[2]) / 2, (v.def.cuerpo[1] + v.def.cuerpo[3]) / 2]);
    for (const pr of v.def.prims) out.push(primitiva(pr, T, camino, X, Y, S, centro));
    const e = etiquetaMundo(ud);
    if (e) {
      e.lineas.forEach((l, i) => {
        const yb = e.rect[1] + i * ALTO_LINEA + 0.36;
        out.push(texto(e.x, yb, l, e.ancla, i === 0 ? 'ea-t' : 'ea-v', u.disp?.nombre));
      });
    }
    for (const t of v.talones) out.push(talon(t, ud.x, ud.y, camino, X, Y, S, u.pines[t.pin]!.riel?.html ?? ''));
    if (op.interactivo && ud.el) {
      const c = v.cuerpo;
      const m = 0.35;
      out.push(`<rect class="ea-hit" x="${X(c[0] + ud.x - m)}" y="${Y(c[1] + ud.y - m)}" width="${n(S * (c[2] - c[0] + 2 * m))}" height="${n(S * (c[3] - c[1] + 2 * m))}"/>`);
    }
    out.push('</g>');
  }

  // Junction dots.
  for (const p of a.dibujo.uniones) out.push(`<circle class="ea-ft" cx="${X(p[0])}" cy="${Y(p[1])}" r="${n(0.1 * S)}"/>`);

  // Net labels.
  for (const e of a.dibujo.etiquetas) {
    out.push(`<path class="ea-l ea-nl" d="${camino([e.pin, e.fin])}"/>`);
    out.push(`<circle class="ea-ft" cx="${X(e.fin[0])}" cy="${Y(e.fin[1])}" r="${n(0.07 * S)}" style="fill:${pal.acento}"/>`);
    out.push(texto(e.tx, e.ty, e.red, e.ancla, 'ea-n'));
  }
  // Net names next to wires.
  for (const m of a.dibujo.nombres) out.push(texto(m.x, m.y, m.red, m.ancla, 'ea-nn'));
  out.push('</svg>');
  return out.join('');
}

function primitiva(
  pr: Prim,
  T: (p: Pt) => Pt,
  camino: (ps: Pt[], c?: boolean) => string,
  X: (x: number) => string,
  Y: (y: number) => string,
  S: number,
  centro: Pt,
): string {
  switch (pr.t) {
    case 'l': {
      const rel = pr.relleno === 'tinta' ? ' ea-ft' : pr.relleno === 'fondo' ? ' ea-fb' : '';
      return `<path class="ea-l${rel}${pr.fino ? ' ea-fino' : ''}" d="${camino(pr.p.map(T), pr.cerrado)}"/>`;
    }
    case 'c': {
      const c = T(pr.c);
      const rel = pr.relleno === 'tinta' ? ' ea-ft' : pr.relleno === 'fondo' ? ' ea-fb' : '';
      return `<circle class="ea-l${rel}" cx="${X(c[0])}" cy="${Y(c[1])}" r="${n(pr.r * S)}"/>`;
    }
    case 'signo': {
      const [cx, cy] = T(pr.c);
      const h = 0.12;
      const d = pr.s === '+' ? camino([[cx - h, cy], [cx + h, cy]]) + camino([[cx, cy - h], [cx, cy + h]]) : camino([[cx - h, cy], [cx + h, cy]]);
      return `<path class="ea-l" d="${d}"/>`;
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
      return `<path class="ea-l" d="${camino(ps)}"/>`;
    }
    case 'texto': {
      const [cx, cy] = T(pr.c);
      if (pr.ref) {
        // Names around a rotated symbol: anchored away from its centre.
        const ancla = cx < centro[0] - 0.1 ? 'end' : cx > centro[0] + 0.1 ? 'start' : 'middle';
        const p = partesRef(pr.s);
        const sub = p.sub ? `<tspan font-size="${n(pr.tam * S * 0.72)}px" dy="${n(0.09 * S)}">${esc(p.sub)}</tspan>` : '';
        return `<text class="ea-t" x="${X(cx)}" y="${Y(cy)}" text-anchor="${ancla}" style="font-size:${n(pr.tam * S)}px">${esc(p.base)}${sub}</text>`;
      }
      return `<text class="ea-p" x="${X(cx)}" y="${Y(cy + pr.tam * 0.36)}" text-anchor="${pr.ancla}" style="font-size:${n(pr.tam * S)}px">${esc(pr.s)}</text>`;
    }
  }
}

function talon(
  t: Talon,
  ox: number,
  oy: number,
  camino: (ps: Pt[], c?: boolean) => string,
  X: (x: number) => string,
  Y: (y: number) => string,
  S: number,
  html: string,
): string {
  const W = (p: Pt): Pt => [p[0] + ox, p[1] + oy];
  const res: string[] = [`<path class="ea-l" d="${camino(t.pata.map(W))}"/>`];
  const [px, py] = W(t.punto);
  const [dx, dy] = t.dir;
  if (t.tipo === 'tierra') {
    // Three bars (schemdraw Ground), perpendicular to the lead.
    const barras: [number, number][] = [
      [0, 0.3],
      [0.12, 0.19],
      [0.24, 0.08],
    ];
    const d = barras
      .map(([s, w]) => {
        const cx = px + dx * s;
        const cy = py + dy * s;
        return dy !== 0 ? camino([[cx - w, cy], [cx + w, cy]]) : camino([[cx, cy - w], [cx, cy + w]]);
      })
      .join('');
    res.push(`<path class="ea-l" d="${d}"/>`);
  } else {
    const d = dy !== 0 ? camino([[px - 0.25, py], [px + 0.25, py]]) : camino([[px, py - 0.25], [px, py + 0.25]]);
    res.push(`<path class="ea-l" d="${d}"/>`);
    if (t.etq) {
      const r: Rect = [t.etq[0] + ox, t.etq[1] + oy, t.etq[2] + ox, t.etq[3] + oy];
      const ancla = dy !== 0 ? 'middle' : dx > 0 ? 'start' : 'end';
      const x = ancla === 'middle' ? (r[0] + r[2]) / 2 : ancla === 'start' ? r[0] : r[2];
      res.push(`<text class="ea-r" x="${X(x)}" y="${Y(r[1] + 0.36)}" text-anchor="${ancla}">${htmlATspan(html, S)}</text>`);
    }
  }
  return res.join('');
}

/** «V<sub>CC</sub>» → SVG tspans. */
function htmlATspan(h: string, S: number): string {
  return h.replace(/<sub>(.*?)<\/sub>/g, (_m, s: string) => `<tspan font-size="${n(TAM_ETQ * S * 0.72)}px" dy="${n(0.1 * S)}">${s}</tspan><tspan dy="${n(-0.1 * S)}"></tspan>`);
}
