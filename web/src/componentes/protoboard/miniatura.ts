// Thumbnail of a saved breadboard («Mis montajes»): the page's own drawing (dibujo.ts svgMontaje, without
// the part labels) cropped to where the parts and wires are, with the list thumbnail's aspect, as an SVG
// data URL for an <img>. Cached per montage and its last save, so only a montage saved again is redrawn.

import { svgMontaje } from './dibujo.ts';
import { cajaExterno } from './encapsulados.ts';
import { ALTO_PLACA, FILAS_RIEL, rectPlaca } from './placa.ts';
import type { DocumentoProtoboard, MontajeGuardado } from './tipos.ts';

/** Width / height of the thumbnail box (componentes/miniaturas, --mini-w × --mini-h of the list). */
const ASPECTO = 84 / 52;
const EXTERNOS = new Set(['alimentacion', 'generador', 'corriente', 'voltimetro']);

export function svgMiniaturaMontaje(doc: DocumentoProtoboard): string | null {
  if (!doc.piezas.length && !doc.cables.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const amp = (a: number, b: number, c = a, d = b) => {
    x0 = Math.min(x0, a);
    y0 = Math.min(y0, b);
    x1 = Math.max(x1, c);
    y1 = Math.max(y1, d);
  };
  // The parts on the board and the jumpers between holes (y ≥ −1.5: the bench equipment sits above the board
  // with its leads, and would shrink the parts to dots), leaving out the jumpers from rail to rail (they span
  // the board); the equipment only when nothing else is there.
  const enPlaca = (q: readonly number[]) => q[1]! >= -1.5;
  const riel = (q: readonly number[]) => (FILAS_RIEL as readonly number[]).includes(((Math.round(q[1]!) % ALTO_PLACA) + ALTO_PLACA) % ALTO_PLACA);
  for (const p of doc.piezas) if (!EXTERNOS.has(p.enc)) for (const q of p.pos) amp(q[0]!, q[1]!);
  for (const w of doc.cables) {
    if (!enPlaca(w.a) || !enPlaca(w.b) || (riel(w.a) && riel(w.b))) continue;
    amp(w.a[0], w.a[1]);
    amp(w.b[0], w.b[1]);
  }
  if (!Number.isFinite(x0)) {
    for (const p of doc.piezas) {
      const b = cajaExterno(p);
      amp(b[0], b[1], b[2], b[3]);
    }
  }
  // A margin of board around the parts (bodies reach past their legs), then the box's aspect, never
  // smaller than a few columns, centred and kept on the drawing.
  const m = 1.6;
  let w = Math.max(x1 - x0 + 2 * m, 10);
  let h = Math.max(y1 - y0 + 2 * m, 6);
  if (w / h < ASPECTO) w = h * ASPECTO;
  else h = w / ASPECTO;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const tablero = rectPlaca({ placas: doc.placas, columnas: doc.columnas }, 0);
  const vx = Math.max(tablero[0] - 0.7, Math.min(cx - w / 2, doc.columnas + 2.6 - w));
  const vy = cy - h / 2;
  const r = (v: number) => Math.round(v * 100) / 100;
  const svg = svgMontaje(doc, { rotulos: false }).replace(/viewBox="[^"]*"/, `viewBox="${r(vx)} ${r(vy)} ${r(w)} ${r(h)}"`);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const hechas = new Map<string, { t: number; url: string | null }>();

/** The thumbnail of a saved montage (data URL), drawn again only when it has been saved since. */
export function miniaturaMontaje(m: MontajeGuardado): string | null {
  const h = hechas.get(m.id);
  if (h && h.t === m.actualizado) return h.url;
  let url: string | null = null;
  try {
    url = svgMiniaturaMontaje(m.doc);
  } catch {
    // a montage this version cannot draw keeps the placeholder
  }
  hechas.set(m.id, { t: m.actualizado, url });
  return url;
}
