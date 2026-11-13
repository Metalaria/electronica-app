// 1.2 (consolas-A): the parts that are not in the book — the «Consolas por dentro» course, one part «consola-<maquina>»
// per console of the «Consolas» explorer — published by scripts/lecciones11.mjs as libro/lecciones11/partes.json
// (scripts/consolas11.mjs) and merged into the book's index when the app starts (lib/datos.ts iniciar) and by
// scripts/conceptos11.mjs. Pure (no DOM, no fetch): the unit tests import it.

import type { Indice, InfoParte } from './tipos';

export const TIPO_CONSOLA = 'consola';

/**
 * The book's index with the extra parts added after its own, with tipo «consola»; a book part is never replaced, and
 * an entry without a title or a list of sections is ignored. They are in no volume, so the reader's contents and its
 * reading order (lib/datos.ts ordenLectura) leave them out; courses, lessons, progress and mastery see them like
 * chapters.
 */
export function mezclarPartes(i: Indice, extra: Record<string, InfoParte> | null | undefined): Indice {
  if (!extra || typeof extra !== 'object') return i;
  const partes = { ...i.partes };
  for (const [p, info] of Object.entries(extra))
    if (!partes[p] && info && typeof info.titulo === 'string' && Array.isArray(info.secciones)) partes[p] = { ...info, tipo: TIPO_CONSOLA };
  return { ...i, partes };
}
