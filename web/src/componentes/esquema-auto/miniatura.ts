// Thumbnail of a schematic: the drawing reduced to four compact path strings (wires, symbol strokes, ink
// fills, background fills) with no text, on a coarse integer grid. `trazosMiniatura` does it for an automatic
// schematic (written at build time by scripts/miniaturas.mjs for every book netlist); `Trazador` is the
// builder, also used by the schematic editor for the reader's own circuits (editor/miniatura.ts). Drawn by
// componentes/miniaturas as one small inline <svg> per row (themed with CSS variables, no fonts).

import type { EsquemaAuto } from './generar.ts';
import { girar, type Prim, type Pt } from './simbolos.ts';

/** [width, height, wires, strokes, ink fills, background fills] in thumbnail units. */
export type TrazosMiniatura = [number, number, string, string, string, string];

/** Thumbnail units per drawing unit (a drawing unit is a pin pitch). */
export const ESCALA_MINIATURA = 10;

/** Relative polyline: «M x y» then «h», «v» or «l» steps between rounded points (repeated points dropped). */
function polilinea(ps: [number, number][], cerrado: boolean): string {
  if (ps.length < 2) return '';
  let [x, y] = ps[0]!;
  let d = `M${x} ${y}`;
  for (let i = 1; i < ps.length; i++) {
    const [px, py] = ps[i]!;
    const dx = px - x;
    const dy = py - y;
    if (!dx && !dy) continue;
    d += !dy ? `h${dx}` : !dx ? `v${dy}` : `l${dx} ${dy}`;
    x = px;
    y = py;
  }
  return d + (cerrado ? 'z' : '');
}

function circulo(cx: number, cy: number, r: number): string {
  // Two arcs (an SVG path cannot draw a full circle with one).
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

type Capa = 0 | 1 | 2 | 3; // 0 wires, 1 symbol strokes, 2 ink fills, 3 background fills
type Trazo = { k: Capa; p: Pt[]; z: boolean } | { k: Capa; c: Pt; r: number };

/**
 * Collects a drawing in drawing units (pin pitch = 1, y down) and writes it as a thumbnail. The bounds are
 * those of what is drawn (texts are left out, so a sheet's own bounds would leave empty margins).
 */
export class Trazador {
  private lista: Trazo[] = [];

  linea(k: Capa, p: Pt[], z = false): void {
    this.lista.push({ k, p, z });
  }

  circulo(k: Capa, c: Pt, r: number): void {
    this.lista.push({ k, c, r });
  }

  cable(a: Pt, b: Pt): void {
    this.linea(0, [a, b]);
  }

  union(p: Pt): void {
    this.circulo(2, p, 0.1);
  }

  /** A symbol's primitives through its placement `T` (texts and the small ± signs are left out). */
  simbolo(prims: Prim[], T: (p: Pt) => Pt): void {
    for (const pr of prims) {
      if (pr.t === 'l') {
        const ps = pr.p.map(T);
        this.linea(1, ps, !!pr.cerrado);
        if (pr.relleno === 'tinta') this.linea(2, ps, true);
        else if (pr.relleno === 'fondo') this.linea(3, ps, true);
      } else if (pr.t === 'c') {
        const c = T(pr.c);
        this.circulo(1, c, pr.r);
        if (pr.relleno === 'tinta') this.circulo(2, c, pr.r);
        else if (pr.relleno === 'fondo') this.circulo(3, c, pr.r);
      } else if (pr.t === 'glifo') {
        // The waveform inside a source, coarsely (what tells a sine source from a DC one at a glance).
        const [cx, cy] = T(pr.c);
        const ps: Pt[] =
          pr.g === 'sin'
            ? Array.from({ length: 9 }, (_, i) => [cx - 0.27 + (0.54 * i) / 8, cy - 0.15 * Math.sin((2 * Math.PI * i) / 8)] as Pt)
            : pr.g === 'cuadrada'
              ? [[cx - 0.28, cy + 0.14], [cx - 0.14, cy + 0.14], [cx - 0.14, cy - 0.14], [cx + 0.14, cy - 0.14], [cx + 0.14, cy + 0.14], [cx + 0.28, cy + 0.14]]
              : [[cx - 0.28, cy + 0.14], [cx - 0.05, cy - 0.14], [cx + 0.1, cy + 0.04], [cx + 0.28, cy - 0.1]];
        this.linea(1, ps);
      }
    }
  }

  terminar(S = ESCALA_MINIATURA): TrazosMiniatura {
    const lista = this.lista;
    if (!lista.length) return [S, S, '', '', '', ''];
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const caja = (x: number, y: number, r = 0) => {
      x0 = Math.min(x0, x - r);
      y0 = Math.min(y0, y - r);
      x1 = Math.max(x1, x + r);
      y1 = Math.max(y1, y + r);
    };
    for (const t of lista) {
      if ('c' in t) caja(t.c[0], t.c[1], t.r);
      else for (const [x, y] of t.p) caja(x, y);
    }
    const m = 0.3;
    const X = (x: number) => Math.round(S * (x - x0 + m));
    const Y = (y: number) => Math.round(S * (y - y0 + m));
    const salida: [string[], string[], string[], string[]] = [[], [], [], []];
    for (const t of lista) {
      const d = 'c' in t ? circulo(X(t.c[0]), Y(t.c[1]), Math.max(1, Math.round(t.r * S))) : polilinea(t.p.map(([x, y]) => [X(x), Y(y)]), t.z);
      if (d) salida[t.k].push(d);
    }
    return [Math.round(S * (x1 - x0 + 2 * m)), Math.round(S * (y1 - y0 + 2 * m)), salida[0].join(''), salida[1].join(''), salida[2].join(''), salida[3].join('')];
  }
}

export function trazosMiniatura(a: EsquemaAuto, S = ESCALA_MINIATURA): TrazosMiniatura {
  const t = new Trazador();
  for (const c of a.dibujo.cables) for (const [p, q, r, s] of c.runs) t.cable([p, q], [r, s]);
  for (const ud of a.dibujo.unidades) {
    const v = ud.u.vars[ud.u.v]!;
    t.simbolo(v.def.prims, (p: Pt): Pt => {
      const [x, y] = girar(v.o, p[0], p[1]);
      return [x + ud.x, y + ud.y];
    });
    for (const tal of v.talones) {
      const W = (p: Pt): Pt => [p[0] + ud.x, p[1] + ud.y];
      t.linea(1, tal.pata.map(W));
      const [px, py] = W(tal.punto);
      const [dx, dy] = tal.dir;
      const barras: [number, number][] = tal.tipo === 'tierra' ? [[0, 0.3], [0.12, 0.19], [0.24, 0.08]] : [[0, 0.25]];
      for (const [s, w] of barras) {
        const cx = px + dx * s;
        const cy = py + dy * s;
        t.linea(1, dy !== 0 ? [[cx - w, cy], [cx + w, cy]] : [[cx, cy - w], [cx, cy + w]]);
      }
    }
  }
  for (const p of a.dibujo.uniones) t.union(p);
  for (const e of a.dibujo.etiquetas) {
    // Net label: its stub and the small dot at its end.
    t.linea(1, [e.pin, e.fin]);
    t.circulo(2, e.fin, 0.08);
  }
  return t.terminar(S);
}
