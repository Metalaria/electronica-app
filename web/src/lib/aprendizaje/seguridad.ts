// 1.0 «¿Qué seguridad tiene?»: after a right answer the reader may say how sure they were — «Lo sabía», «Dudaba» or
// «He adivinado» — with one optional tap. Pure part (the tests run it in Node): the stored record, its merge, and how
// it changes the spaced review (mastery, dominio.ts), which is where the app schedules what to review.
//
// Stored (almacen key `seguridad`, synchronised as store `seguridad`): `{ version: 1, items: { <item id>: { e: [[a,
// nivel], …], t } } }` — the item id is mastery's (a practice item, a Repaso question, an exercise's label); each entry
// is a tap at time `a` (ms); `t` = the newest `a`. Nothing is stored when the reader does not tap.
//
// Effect on a mastery round (the answers to an item within ten minutes, dominio.ts): the latest tap made during it or
// up to 30 minutes after it applies — but never one made after the next round of that item began (a tap belongs to
// one round only; review 10d) — and only to a round that was right (points ≥ 60):
//   - «Lo sabía» (or no tap): unchanged;
//   - «Dudaba»: 59 points — just below the 60 that make a day count as a success for stability, so the review comes
//     sooner (stability doubles with each successful day: one success fewer roughly halves the interval);
//   - «He adivinado»: 30 points — like a near miss (between wrong, 0, and with help, 60): lower accuracy and no success.
//
// Merge (the synchronisation's `unir`, and another tab's writes): the union of the taps by time; the same time on two
// sides keeps the more cautious level (adivinado > dudaba > sabia); the newest MAX_ENTRADAS are kept; `t` is the max.
// Commutative, associative and idempotent: the same taps give the same record on every device.

import type { RegistroItem, Ronda } from './dominio.ts';

export type NivelSeguridad = 'sabia' | 'dudaba' | 'adivinado';
export const NIVELES_SEGURIDAD: NivelSeguridad[] = ['sabia', 'dudaba', 'adivinado'];
export const NOMBRE_SEGURIDAD: Record<NivelSeguridad, string> = { sabia: 'Lo sabía', dudaba: 'Dudaba', adivinado: 'He adivinado' };

export interface RegistroSeguridad {
  e: [number, NivelSeguridad][];
  t: number;
}

export const MAX_ENTRADAS = 12;
/** A tap applies to a round that started at most this long before it (and 1 min after, for clock jitter). */
export const VENTANA_SEGURIDAD = 30 * 60_000;
export const PUNTOS_SEGURIDAD: Record<Exclude<NivelSeguridad, 'sabia'>, number> = { dudaba: 59, adivinado: 30 };

const esNivel = (v: unknown): v is NivelSeguridad => v === 'sabia' || v === 'dudaba' || v === 'adivinado';

export function seguridadValida(v: unknown): v is RegistroSeguridad {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const r = v as { e?: unknown; t?: unknown };
  return (
    typeof r.t === 'number' &&
    Number.isFinite(r.t) &&
    Array.isArray(r.e) &&
    r.e.length > 0 &&
    r.e.every((x) => Array.isArray(x) && x.length === 2 && typeof x[0] === 'number' && Number.isFinite(x[0]) && esNivel(x[1]))
  );
}

function normalizar(entradas: [number, NivelSeguridad][]): RegistroSeguridad {
  const porT = new Map<number, NivelSeguridad>();
  for (const [a, s] of entradas) {
    const x = porT.get(a);
    porT.set(a, x && NIVELES_SEGURIDAD.indexOf(x) > NIVELES_SEGURIDAD.indexOf(s) ? x : s);
  }
  const e = [...porT.entries()].sort((x, y) => x[0] - y[0]).slice(-MAX_ENTRADAS) as [number, NivelSeguridad][];
  return { e, t: e.length ? e[e.length - 1]![0] : 0 };
}

/** The merge of two versions of an item's record (see the header). */
export function unirSeguridad(a: RegistroSeguridad, b: RegistroSeguridad): RegistroSeguridad {
  return normalizar([...a.e, ...b.e]);
}

/** The record with one more tap. */
export function anotarSeguridad(previo: RegistroSeguridad | undefined, a: number, s: NivelSeguridad): RegistroSeguridad {
  return normalizar([...(previo?.e ?? []), [a, s]]);
}

/** Clock jitter allowed before a round's start. */
const ANTES = 60_000;

/**
 * The level that applies to a round that started at `t`: the latest tap in [t − 1 min, t + 30 min], cut where the
 * item's next round (starting at `siguiente`) takes over — at `siguiente` − 1 min, where that round's own window
 * begins — so that no tap counts for two rounds. Null when there is none.
 */
export function nivelDeRonda(reg: RegistroSeguridad | undefined, t: number, siguiente?: number): NivelSeguridad | null {
  if (!reg) return null;
  const fin = siguiente != null ? Math.min(t + VENTANA_SEGURIDAD + 1, siguiente - ANTES) : t + VENTANA_SEGURIDAD + 1;
  let r: NivelSeguridad | null = null;
  for (const [a, s] of reg.e) if (a >= t - ANTES && a < fin) r = s;
  return r;
}

/**
 * Mastery's records with the taps applied (dominio.svelte.ts calls it before computing). Only right rounds change;
 * records without taps are returned as they are (the same objects).
 */
export function ajustarRegistros(items: Record<string, RegistroItem>, seg: Record<string, RegistroSeguridad>): Record<string, RegistroItem> {
  let r: Record<string, RegistroItem> | null = null;
  for (const [id, reg] of Object.entries(seg)) {
    const it = items[id];
    if (!it) continue;
    let cambiado = false;
    const inicios = it.r.map((x) => x[0]).sort((x, y) => x - y);
    const rondas = it.r.map((x): Ronda => {
      const siguiente = inicios.find((y) => y > x[0]);
      const n = nivelDeRonda(reg, x[0], siguiente);
      if (!n || n === 'sabia') return x;
      const p = Math.min(x[1], PUNTOS_SEGURIDAD[n]);
      if (p === x[1]) return x;
      cambiado = true;
      return x.length === 3 ? [x[0], p, 1] : [x[0], p];
    });
    if (!cambiado) continue;
    r ??= { ...items };
    r[id] = { ...it, r: rondas };
  }
  return r ?? items;
}
