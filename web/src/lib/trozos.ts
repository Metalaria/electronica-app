// Splitting a part into chunks for rendering.
//
// Each chunk (a numbered section, or a slice of a long one) gets `content-visibility: auto`, so the
// browser only lays out and paints the chunks near the screen. The DOM is complete (search in page,
// anchors and references keep working); this is not virtualisation. The estimated height of a chunk
// only matters until it is first rendered (`contain-intrinsic-size: auto …` remembers the real one).

import type { Bloque } from './tipos';
import { textoPlano } from './datos';

export interface Trozo {
  /** Index of the first block in the part. */
  inicio: number;
  bloques: Bloque[];
  /** Label of the section the chunk belongs to (for the scroll spy). */
  seccion: string | null;
  estimado: number;
  /** Labels (DOM ids) of the blocks inside the chunk, nested ones included. */
  etiquetas: Set<string>;
}

const MAX_BLOQUES = 30;

/** Rough height in px of a block for a column width and a text size. */
function estimar(b: Bloque, ancho: number, tam: number): number {
  const linea = tam * 1.62;
  const cpl = Math.max(20, ancho / (tam * 0.47));
  const texto = (html: string | null | undefined, escala = 1) =>
    Math.max(1, Math.ceil(textoPlano(html).length / (cpl / escala))) * linea * escala;
  const lista = (bs: Bloque[]) => bs.reduce((s, x) => s + estimar(x, ancho - tam * 2, tam), 0);
  switch (b.t) {
    case 'p':
      return texto(b.html) + tam * 0.85;
    case 'h2':
      return tam * 5;
    case 'h3':
      return tam * 3.2;
    case 'h4':
      return tam * 2.6;
    case 'centrado':
      return texto(b.html) + tam;
    case 'lista':
      return b.items.reduce((s, it) => s + texto(it) + tam * 0.25, tam);
    case 'caja':
    case 'tarjeta':
    case 'deduccion':
      return lista(b.bloques) + tam * 3;
    case 'ec':
      return (b.h / 10.5) * 1.12 * tam + tam * (b.etiqueta ? 3.3 : 2.2);
    case 'figura':
      return Math.min(ancho, ancho * (b.ancho ?? 1)) * 0.58 + tam * 4;
    case 'tabla':
      return b.filas.length * tam * 2.05 + (b.pie ? tam * 2.5 : tam);
    case 'codigo':
      return b.texto.split('\n').length * tam * 1.25 + tam * 2.5;
    case 'ejercicios':
      return b.items.reduce((s, it) => s + lista(it.bloques) + tam * 3, tam * 4);
    case 'glosario':
      return b.entradas.length * tam * 4;
    default:
      return linea;
  }
}

function etiquetar(b: Bloque, out: Set<string>): void {
  if (b.label) out.add(b.label);
  if ('bloques' in b && Array.isArray(b.bloques)) for (const x of b.bloques) etiquetar(x, out);
  if (b.t === 'ejercicios') {
    for (const it of b.items) {
      if (it.label) out.add(it.label);
      for (const x of it.bloques) etiquetar(x, out);
      for (const x of it.solucion ?? []) etiquetar(x, out);
    }
  }
}

/** Width of the reading column for a text size (the same rule the reader's layout follows). */
export function anchoColumna(tam: number, movil: boolean): number {
  const lateral = movil ? 0 : 308;
  return Math.max(260, Math.min(40 * tam, window.innerWidth - lateral - 64));
}

const cache = new Map<Bloque[], { clave: string; trozos: Trozo[] }>();

/** trocear() remembered per part and layout, so the prefetcher can do the work before the jump. */
export function trozosDe(bloques: Bloque[], ancho: number, tam: number): Trozo[] {
  const clave = `${Math.round(ancho)}|${tam}`;
  const c = cache.get(bloques);
  if (c?.clave === clave) return c.trozos;
  const trozos = trocear(bloques, ancho, tam);
  cache.set(bloques, { clave, trozos });
  return trozos;
}

/** Index of the chunk that holds a block index or a label (null if none). */
export function trozoDe(trozos: Trozo[], que: { b?: number; ids?: string[] }): number | null {
  if (que.b != null) {
    let k = 0;
    for (let i = 0; i < trozos.length; i++) if (trozos[i]!.inicio <= que.b) k = i;
    return k;
  }
  if (que.ids) {
    for (const id of que.ids) {
      const k = trozos.findIndex((t) => t.etiquetas.has(id));
      if (k >= 0) return k;
    }
  }
  return null;
}

export function trocear(bloques: Bloque[], ancho: number, tam: number): Trozo[] {
  const trozos: Trozo[] = [];
  let seccion: string | null = null;
  let actual: Trozo | null = null;
  bloques.forEach((b, i) => {
    if (b.t === 'h2') seccion = b.label ?? null;
    if (!actual || b.t === 'h2' || actual.bloques.length >= MAX_BLOQUES) {
      actual = { inicio: i, bloques: [], seccion, estimado: 0, etiquetas: new Set() };
      trozos.push(actual);
    }
    actual.bloques.push(b);
    actual.estimado += estimar(b, ancho, tam);
    etiquetar(b, actual.etiquetas);
  });
  for (const t of trozos) t.estimado = Math.round(t.estimado);
  return trozos;
}
