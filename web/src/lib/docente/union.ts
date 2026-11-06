// «Modo docente» (1.0, review 10h): two versions of one result (the same attempt) merged question by question — the
// self-assessment of each question is the newest one given (`autoevalT`) on either device, instead of the whole result of
// the device that wrote last winning (one device's «Bien» on question 2 and the other's «Mal» on question 5 both stay).
// Used by the synchronisation (registro.svelte.ts `unir`, merged in the file) and between tabs (the Guardado).
// Pure; commutative, associative and idempotent: every choice is a maximum by a total order (time, then canonical JSON),
// and the result's own fields follow the version chosen for them the same way.

import type { Resultado, ResultadoItem } from './tipos';

const canon = (v: unknown): string => JSON.stringify(v, (_k, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x));
const tiempo = (r: Resultado) => Math.max(r.actualizado ?? 0, r.borrado ?? 0);

/** The larger of two values by (time, canonical JSON). */
function mayor<T>(a: T, ta: number, b: T, tb: number): T {
  if (ta !== tb) return ta > tb ? a : b;
  return canon(a) >= canon(b) ? a : b;
}

const redondear = (x: number) => Math.round(x * 100) / 100;

export function unirResultados(a: Resultado, b: Resultado): Resultado {
  // a deletion is final for a result (an attempt's id is never stored again once deleted: estado.guardarResultado), so
  // a tombstone absorbs any live version, whatever its time — and of two tombstones, the later
  if (a.borrado && b.borrado) return mayor(a, tiempo(a), b, tiempo(b));
  if (a.borrado) return a;
  if (b.borrado) return b;
  // different attempts or shapes (never for one id): the later whole
  if (a.items.length !== b.items.length || a.items.some((it, k) => it.ref !== b.items[k]!.ref || it.k !== b.items[k]!.k)) return mayor(a, tiempo(a), b, tiempo(b));
  // (the result's own fields: of the later version by its time, on a tie by its own fields — never by the items, which
  // are merged apart; so the choice is the same whatever the order of the merges)
  const meta = (r: Resultado) => ({ ...r, items: undefined, puntos: undefined, actualizado: undefined });
  const base = tiempo(a) !== tiempo(b) ? (tiempo(a) > tiempo(b) ? a : b) : canon(meta(a)) >= canon(meta(b)) ? a : b;
  const items: ResultadoItem[] = a.items.map((ia, k) => {
    const ib = b.items[k]!;
    return mayor(ia, ia.autoevalT ?? 0, ib, ib.autoevalT ?? 0);
  });
  return { ...base, items, puntos: redondear(items.reduce((s, it) => s + it.puntos, 0)), actualizado: Math.max(a.actualizado, b.actualizado) };
}
