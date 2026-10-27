// Automatic steps of a lesson («Estudiar por pasos», 0.9): pure functions over a part's blocks, so they can
// be checked against every section of the book outside the app (lib/lecciones.svelte.ts uses them).
//
// The owner chose «automático por subapartados»: each h3 of the h2 section is one step, and the blocks
// before the first h3 (if any) are step 0, the introduction. A section without h3 is split at its h4
// headings (short h4 parts merged), or else into balanced runs of about one screen; an h3 subsection is
// split the same way only when it is very long (about 1 % of them).

// No imports but types: tests/leccion09.spec.ts runs it in Node over every section of the book.

import type { Bloque, BH2 } from './tipos';

/** Plain text of a pipeline HTML fragment (the same rules as textoPlano in lib/datos.ts). */
function plano(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/g, ' $1 ')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface PasoLeccion {
  /** Plain-text title: the h3, the h4 that opens it, or the section's title. */
  titulo: string;
  /** Heading HTML (from the h3/h4), or null to use the section's title. */
  html: string | null;
  /** Subsection number (5.3.2), when the h3 has one. */
  num: string | null;
  /** Label of the h3/h4 (anchor in the reader), when the step starts at one. */
  label: string | null;
  /** intro: blocks before the first h3 · sub: an h3 · parte: a run of a section without h3 · continua: rest of a long h3. */
  tipo: 'intro' | 'sub' | 'parte' | 'continua';
  /** Top-level block range of the part [desde, hasta), the heading excluded. */
  desde: number;
  hasta: number;
}

/** Approximate reading weight of a block, in characters of text (a figure counts as ~700). */
export function peso(b: Bloque): number {
  switch (b.t) {
    case 'p':
    case 'centrado':
      return plano(b.html).length;
    case 'h3':
    case 'h4':
      return 80;
    case 'lista':
      return b.items.reduce((s, it) => s + plano(it).length, 40);
    case 'caja':
    case 'tarjeta':
    case 'deduccion':
      return b.bloques.reduce((s, x) => s + peso(x), 120);
    case 'ec':
      return 160;
    case 'figura':
      return 700;
    case 'tabla':
      return 100 + 80 * b.filas.length;
    case 'codigo':
      return 60 * b.texto.split('\n').length;
    case 'ejercicios':
      return b.items.reduce((s, it) => s + it.bloques.reduce((t, x) => t + peso(x), 150), 0);
    case 'glosario':
      return 300 * b.entradas.length;
    default:
      return 100;
  }
}

/** Target weight of one screen. */
export const OBJETIVO = 2000;
/** A section without h3 is split above this weight. */
export const PARTIR_SIN_H3 = 2600;
/** An h3 subsection is split only above this weight. */
export const PARTIR_H3 = 7200;

/** A paragraph that introduces what follows («… es:», «Se pide:»), or a heading, must stay with the next block. */
function anuncia(b: Bloque | undefined): boolean {
  if (!b) return false;
  if (b.t === 'p' || b.t === 'centrado') return /:\s*$/.test(plano(b.html));
  return b.t === 'h3' || b.t === 'h4';
}

/**
 * Splits the block range [desde, hasta) into runs of about one screen: at h4 headings when there are any
 * (an h4 opens a run once the current one has half a screen), else greedily by weight, never right after a
 * block that announces the next one and never leaving a tiny last run. Returns the start index of each run.
 */
export function cortes(bloques: Bloque[], desde: number, hasta: number): number[] {
  const pesos = bloques.slice(desde, hasta).map(peso);
  const h4 = new Set<number>();
  for (let i = desde + 1; i < hasta; i++) if (bloques[i]!.t === 'h4') h4.add(i);
  const r = [desde];
  let acumulado = 0;
  if (h4.size) {
    for (let i = desde; i < hasta; i++) {
      if (h4.has(i) && acumulado >= OBJETIVO * 0.5) {
        r.push(i);
        acumulado = 0;
      }
      acumulado += pesos[i - desde]!;
    }
    return r;
  }
  const total = pesos.reduce((s, x) => s + x, 0);
  const n = Math.max(1, Math.round(total / OBJETIVO));
  if (n === 1) return r;
  const meta = total / n;
  let restante = total;
  for (let i = desde; i < hasta; i++) {
    const w = pesos[i - desde]!;
    if (r.length < n && i > r[r.length - 1]! && acumulado >= meta * 0.8 && restante >= meta * 0.45 && !anuncia(bloques[i - 1])) {
      r.push(i);
      acumulado = 0;
    }
    acumulado += w;
    restante -= w;
  }
  return r;
}

/** End (exclusive) of the section whose h2 is at index h2. */
export function finDeSeccion(bloques: Bloque[], h2: number): number {
  for (let i = h2 + 1; i < bloques.length; i++) if (bloques[i]!.t === 'h2') return i;
  return bloques.length;
}

/** Steps of the section whose h2 is at index h2 of the part. */
export function calcularPasos(bloques: Bloque[], h2: number): PasoLeccion[] {
  const tituloSec = plano((bloques[h2] as BH2).html);
  const fin = finDeSeccion(bloques, h2);
  const h3: number[] = [];
  for (let i = h2 + 1; i < fin; i++) if (bloques[i]!.t === 'h3') h3.push(i);
  const pasos: PasoLeccion[] = [];
  const pesoDe = (a: number, b: number) => bloques.slice(a, b).reduce((s, x) => s + peso(x), 0);

  /** Pushes the run [a, b) as one step, or several when it weighs more than `umbral`. */
  const anadir = (base: Omit<PasoLeccion, 'desde' | 'hasta'>, a: number, b: number, umbral: number) => {
    const inicios = pesoDe(a, b) > umbral ? cortes(bloques, a, b) : [a];
    inicios.forEach((c, k) => {
      const hasta = inicios[k + 1] ?? b;
      const cab = bloques[c];
      const tipo = base.tipo === 'parte' ? 'parte' : 'continua';
      if (k === 0) pasos.push({ ...base, desde: c, hasta });
      // An h4 that opens a run becomes the step's heading.
      else if (cab?.t === 'h4') pasos.push({ titulo: plano(cab.html), html: cab.html, num: null, label: cab.label ?? null, tipo, desde: c + 1, hasta });
      else pasos.push({ ...base, tipo, desde: c, hasta });
    });
  };

  if (h3.length) {
    const primero = h3[0]!;
    if (primero > h2 + 1) anadir({ titulo: tituloSec, html: null, num: null, label: null, tipo: 'intro' }, h2 + 1, primero, PARTIR_H3);
    h3.forEach((i, k) => {
      const b = bloques[i]!;
      if (b.t !== 'h3') return;
      anadir({ titulo: plano(b.html), html: b.html, num: b.num ?? null, label: b.label ?? null, tipo: 'sub' }, i + 1, h3[k + 1] ?? fin, PARTIR_H3);
    });
  } else {
    // Also an empty section (heading only): one empty step, so the lesson still opens.
    anadir({ titulo: tituloSec, html: null, num: null, label: null, tipo: 'parte' }, h2 + 1, fin, PARTIR_SIN_H3);
  }
  return pasos;
}
