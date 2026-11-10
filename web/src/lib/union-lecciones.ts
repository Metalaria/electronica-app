// Review 11a (from 1.0): the merge of two versions of one lesson's progress (store `lecciones`, «<parte>/<label>» →
// { h, u, n, c, t }: lecciones.svelte.ts ProgresoGuardado). Before, two versions were merged by the newer `t` alone:
// a device that opened a lesson another device had completed (anotarPaso → { h: [], c: 0, t: now }) took the
// completion and the cards done away, on both devices. Now, field by field:
//   - `h` (steps or cards done): the union, sorted;
//   - `c` (when the lesson was completed): the first completion (the smaller non-zero);
//   - `u` (last screen) and `n` (number of steps): of the newer version — the larger (t, u, n), so a tie is decided
//     the same way whatever the order;
//   - `t`: the larger.
// Each part is a join on a total order or a set union: commutative, associative and idempotent. Nothing in this store
// is ever taken away (no «reset» of a lesson; a deleted item is a deletion of the synchronisation, never given to
// this merge), so the union cannot resurrect anything. Pure (the tests import it in Node).

export interface ProgresoUnible {
  h: number[];
  u: number;
  n: number;
  c: number;
  t: number;
}

const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

/** Whether `a` is the newer version for `u`/`n`: its time, then its last screen, then its number of steps. */
function posterior(a: ProgresoUnible, b: ProgresoUnible): boolean {
  if (num(a.t) !== num(b.t)) return num(a.t) > num(b.t);
  if (num(a.u) !== num(b.u)) return num(a.u) > num(b.u);
  return num(a.n) >= num(b.n);
}

export function unirProgresoLeccion(a: ProgresoUnible, b: ProgresoUnible): ProgresoUnible {
  const nuevo = posterior(a, b) ? a : b;
  const h = [...new Set([...(a.h ?? []), ...(b.h ?? [])].filter((x) => typeof x === 'number' && Number.isFinite(x)))].sort((x, y) => x - y);
  const ca = num(a.c);
  const cb = num(b.c);
  const c = ca && cb ? Math.min(ca, cb) : ca || cb;
  // (exactly these five fields: another field could not be ordered the same way whatever the order of the merges)
  return { h, u: num(nuevo.u), n: num(nuevo.n), c, t: Math.max(num(a.t), num(b.t)) };
}

/** A stored lesson progress with the shape the app writes (the synchronisation's `valido` of store `lecciones`). */
export function progresoLeccionValido(v: unknown): v is ProgresoUnible {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = v as Record<string, unknown>;
  return Array.isArray(p.h) && typeof p.u === 'number' && typeof p.n === 'number' && typeof p.t === 'number';
}
