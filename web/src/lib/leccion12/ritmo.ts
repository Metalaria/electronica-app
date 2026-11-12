// 1.2 lesson rhythm: the order in which a lesson's cards are shown in one visit. Pure (the unit tests run it in Node).
//
// A lesson is shown card by card (0 … n−1; the last one is the summary). A card whose FIRST check of this visit was
// wrong, or that was left with «Saltar», is «missed»: when the reader reaches the summary, the missed cards come back
// once, in lesson order, fresh (a new round for the spaced review), and only then the summary. A card missed again in
// that return round does not come back a second time. Nothing here is stored: a reload starts a normal visit (the
// lesson's saved progress — `lecciones` — is per card and does not change meaning).

export type Fase = 'normal' | 'vuelta' | 'hecha';

export interface Ritmo {
  fase: Fase;
  /** Missed cards of this visit (card indexes, unique, in the order they were missed). */
  falladas: readonly number[];
  /** The return round (card indexes, lesson order), fixed when it starts. */
  vuelta: readonly number[];
  /** Position in `vuelta` while `fase` is «vuelta». */
  j: number;
}

export function nuevoRitmo(): Ritmo {
  return { fase: 'normal', falladas: [], vuelta: [], j: 0 };
}

/** Notes a missed card (first check wrong, or skipped). Only in the normal round; repeated notes are ignored. */
export function anotarFallada(r: Ritmo, k: number): Ritmo {
  if (r.fase !== 'normal' || r.falladas.includes(k)) return r;
  return { ...r, falladas: [...r.falladas, k] };
}

/** Whether the card on show is a returning one. */
export const enVuelta = (r: Ritmo): boolean => r.fase === 'vuelta';

export interface Paso {
  /** Card to show. */
  destino: number;
  ritmo: Ritmo;
  /** The destination must be shown fresh (its earlier answer forgotten): it is a returning card. */
  fresca: boolean;
}

/**
 * Where «Continuar» goes from card `actual` of a lesson of `n` cards (the last one the summary). Entering the summary
 * with missed cards starts the return round instead.
 */
export function siguiente(r: Ritmo, actual: number, n: number): Paso {
  const resumen = n - 1;
  if (r.fase === 'vuelta') {
    const j = r.j + 1;
    if (j < r.vuelta.length) return { destino: r.vuelta[j]!, ritmo: { ...r, j }, fresca: true };
    return { destino: resumen, ritmo: { ...r, fase: 'hecha', j: r.vuelta.length }, fresca: false };
  }
  const k = Math.min(actual + 1, resumen);
  if (r.fase === 'normal' && k === resumen) {
    const vuelta = [...new Set(r.falladas)].filter((x) => x >= 0 && x < resumen).sort((a, b) => a - b);
    if (vuelta.length) return { destino: vuelta[0]!, ritmo: { ...r, fase: 'vuelta', vuelta, j: 0 }, fresca: true };
    return { destino: resumen, ritmo: { ...r, fase: 'hecha', vuelta: [], j: 0 }, fresca: false };
  }
  return { destino: k, ritmo: r, fresca: false };
}

/**
 * Where «Atrás» goes. In the return round: the previous returning card, or — from the first one — back to the last
 * card of the normal round (the return round is then left; the missed cards are kept and come back again).
 * Otherwise the previous card (never before 0).
 */
export function anterior(r: Ritmo, actual: number, n: number): Paso {
  if (r.fase === 'vuelta') {
    if (r.j > 0) return { destino: r.vuelta[r.j - 1]!, ritmo: { ...r, j: r.j - 1 }, fresca: false };
    return { destino: Math.max(0, n - 2), ritmo: { ...r, fase: 'normal', vuelta: [], j: 0 }, fresca: false };
  }
  return { destino: Math.max(0, actual - 1), ritmo: r, fresca: false };
}

export interface Segmento {
  /** Card index the segment stands for. */
  k: number;
  estado: 'hecho' | 'actual' | 'pendiente';
  /** A returning card's segment (drawn apart, before the summary's). */
  vuelta: boolean;
}

/**
 * The segmented progress bar: one segment per card and, once the return round has started, one more per returning
 * card, placed before the summary. `actual` is the card on show.
 */
export function segmentos(r: Ritmo, n: number, actual: number): Segmento[] {
  const out: Segmento[] = [];
  const conVuelta = r.fase !== 'normal' && r.vuelta.length > 0;
  const pos = r.fase === 'vuelta' ? n - 1 + r.j : r.fase === 'hecha' && actual === n - 1 ? n - 1 + r.vuelta.length : actual;
  const orden: { k: number; vuelta: boolean }[] = [];
  for (let k = 0; k < n - 1; k++) orden.push({ k, vuelta: false });
  if (conVuelta) for (const k of r.vuelta) orden.push({ k, vuelta: true });
  if (n > 0) orden.push({ k: n - 1, vuelta: false });
  orden.forEach((s, i) => out.push({ ...s, estado: i < pos ? 'hecho' : i === pos ? 'actual' : 'pendiente' }));
  return out;
}

/** Position (1-based) and total for «Tarjeta x de y» and the progress bar's value. */
export function posicion(r: Ritmo, n: number, actual: number): { x: number; de: number } {
  const s = segmentos(r, n, actual);
  const i = s.findIndex((q) => q.estado === 'actual');
  return { x: i + 1, de: s.length };
}
