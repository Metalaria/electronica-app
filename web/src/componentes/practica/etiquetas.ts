// The value label of a part drawn in a book figure («5 kΩ» beside R₂), found in the figure's SVG so a
// prediction or a slider can write the NEW value over it. The figure SVG keeps its text as glyph <use>
// elements (pdftocairo); the browser measures them (getBBox in a hidden copy of the SVG), they are grouped
// into runs on one baseline, and the run near the part with as many glyphs as the book's value text («5 kΩ»:
// 4) is the label; for a label with a name in front («V_CC = 12 V») its last glyphs are taken.

import { url } from '../../lib/datos';
import type { Esquema } from '../figuras-vivas/tipos';

export interface EtiquetaValor {
  /** Box of the value glyphs in SVG units of the figure. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Baseline (SVG units) and glyph colour. */
  base: number;
  color: string;
  /** Character between number and unit in the book («5 kΩ»), to write the new value the same way. */
  separador: string;
  /** The label is on the left of the part: the new text keeps its right edge (it grows away from the symbol). */
  izquierda: boolean;
}

interface Glifo {
  x: number;
  y: number;
  caja: DOMRect | null;
  color: string;
}

const svgs = new Map<string, Promise<Glifo[]>>();

/** The glyphs of a figure SVG with their measured boxes, in document order. */
function glifos(src: string): Promise<Glifo[]> {
  let p = svgs.get(src);
  if (!p) {
    p = fetch(url(src))
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((texto) => {
        const caja = document.createElement('div');
        caja.style.cssText = 'position:absolute;left:-10000px;top:0;width:1000px;height:1000px;visibility:hidden;pointer-events:none';
        caja.innerHTML = texto.replace(/<\?xml[^>]*>/, '');
        document.body.appendChild(caja);
        const r: Glifo[] = [];
        try {
          for (const u of caja.querySelectorAll('use')) {
            const x = Number(u.getAttribute('x'));
            const y = Number(u.getAttribute('y'));
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            let b: DOMRect | null = null;
            try {
              const bb = (u as SVGGraphicsElement).getBBox();
              b = bb.width > 0 || bb.height > 0 ? new DOMRect(bb.x, bb.y, bb.width, bb.height) : null;
            } catch {
              b = null;
            }
            r.push({ x, y, caja: b, color: u.closest('[fill]')?.getAttribute('fill') ?? '#1a3a5c' });
          }
        } finally {
          caja.remove();
        }
        return r;
      });
    p.catch(() => svgs.delete(src));
    svgs.set(src, p);
  }
  return p;
}

/** Runs of glyphs on one baseline with small gaps (a word or a short label). */
function renglones(gs: Glifo[]): Glifo[][] {
  const r: Glifo[][] = [];
  let actual: Glifo[] = [];
  for (const g of gs) {
    const u = actual[actual.length - 1];
    if (u && Math.abs(g.y - u.y) < 0.3 && g.x > u.x && g.x - u.x < 9) actual.push(g);
    else {
      if (actual.length) r.push(actual);
      actual = [g];
    }
  }
  if (actual.length) r.push(actual);
  return r;
}

function unir(gs: Glifo[]): { x: number; y: number; w: number; h: number } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const g of gs) {
    if (!g.caja) continue;
    x0 = Math.min(x0, g.caja.x);
    y0 = Math.min(y0, g.caja.y);
    x1 = Math.max(x1, g.caja.x + g.caja.width);
    y1 = Math.max(y1, g.caja.y + g.caja.height);
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/** The value label of an element of a figure's schematic, or null when it cannot be found reliably. */
const sinBlancos = (t: string) => t.replace(/[\s\u00a0\u202f]/g, '');

/**
 * Glyphs that the run on the label's last baseline must have: the label's last line after its last math
 * part («$R_2$ = 4 Ω» → «=4Ω», «$R_1$\n10 kΩ» → «10kΩ», «R = 300 Ω» → «R=300Ω»), spaces left out (a
 * subscript sits lower and ends the run before it).
 */
function ultimoRenglon(etiqueta: string): string {
  const linea = etiqueta.split('\n').pop() ?? '';
  const i = linea.lastIndexOf('$');
  return sinBlancos(i >= 0 ? linea.slice(i + 1) : linea);
}

/** The value label of an element of a figure's schematic, or null when it cannot be found reliably. */
export async function etiquetaDeValor(
  src: string,
  esq: Esquema,
  elemento: string,
  /** Only labels inside this box (the schematic's crop of the figure). */
  dentro: [number, number, number, number] | null = null,
): Promise<EtiquetaValor | null> {
  const e = esq.elementos.find((x) => x.id === elemento);
  if (!e?.caja || !e.valor_texto) return null;
  const valor = sinBlancos(e.valor_texto);
  // the label drawn with the part, or the free text next to it the value was read from («texto_cercano»)
  const etiqueta = [...(e.etiquetas ?? []), (e as { texto_valor?: string }).texto_valor ?? '', e.valor_texto].find((t) => sinBlancos(t).includes(valor));
  if (!etiqueta) return null;
  const renglon = ultimoRenglon(etiqueta);
  if (!renglon.endsWith(valor)) return null;
  const k = [...renglon].length;
  const m = [...valor].length;
  const A = esq.dibujo_a_svg;
  const xs = [A.sx * e.caja[0] + A.tx, A.sx * e.caja[2] + A.tx];
  const ys = [A.sy * e.caja[1] + A.ty, A.sy * e.caja[3] + A.ty];
  const caja = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  const lado = Math.max(caja.x1 - caja.x0, caja.y1 - caja.y0);
  const lejos = Math.max(30, lado * 1.6);
  let gs: Glifo[];
  try {
    gs = await glifos(src);
  } catch {
    return null;
  }
  let mejor: { d: number; gs: Glifo[] } | null = null;
  for (const r of renglones(gs)) {
    // visible glyphs only (a space is an empty glyph, or no glyph at all)
    const vis = r.filter((g) => g.caja);
    if (vis.length !== k) continue;
    const tramo = vis.slice(k - m);
    const b = unir(tramo);
    if (!b) continue;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    if (dentro && (cx < dentro[0] || cx > dentro[0] + dentro[2] || cy < dentro[1] || cy > dentro[1] + dentro[3])) continue;
    const dx = Math.max(caja.x0 - cx, 0, cx - caja.x1);
    const dy = Math.max(caja.y0 - cy, 0, cy - caja.y1);
    const d = Math.hypot(dx, dy);
    if (d > lejos) continue;
    if (!mejor || d < mejor.d) mejor = { d, gs: tramo };
  }
  if (!mejor) return null;
  const b = unir(mejor.gs)!;
  const sep = /\d([\s\u00a0\u202f])\D/.exec(e.valor_texto)?.[1] ?? ' ';
  return { ...b, base: mejor.gs[0]!.y, color: mejor.gs[0]!.color, separador: sep, izquierda: b.x + b.w <= caja.x0 + 0.5 };
}
