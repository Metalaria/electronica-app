// The merge of two versions of one exercise's state (store `ejercicios`, 1.0): used by the synchronisation for two live
// versions of an item in the file (lib/sincronizacion/registro.svelte.ts `unir`, fusion.ts fusionarColecciones) and by
// the module's Guardado for two writers of one storage (lib/aprendizaje.svelte.ts). Pure (the tests import it in Node).
//
// Before 1.0 an exercise was one last-write-wins item: the reader's answers typed on one device were lost when another
// device changed the same exercise before synchronising (and so were its attempts). Now, field by field:
//   - `r` (reset epoch: «Reiniciar» writes an item with r = now instead of deleting it): the version with the larger
//     `r` wins, and of the other side — which had not seen that reset — only what is AFTER it comes in, as if it had
//     been done after the reset (`proyectar`): the answers typed after it (a key whose time is later; review 10a,
//     r10a·1), and — when its own `t` is later, i.e. a real attempt was made after the reset (since review 10g only
//     «Comprobar» and «¿Lo tenía bien?» move `t`) — that attempt: its `resuelto`, `bien` and the other whole-item fields,
//     and one attempt (review 10i, r10i·1: an exercise solved after a reset on another device came back as never
//     tried, with the ✓ of its answer). Its counters before the reset (attempts, failures, hints, solution) stay
//     reset — nothing tells them apart from the ones after it, so after the reset its failures and hints are not
//     counted (the lesson of 0.12's «Reiniciar tarjetas»: a union would bring the old ones back);
//   - `valores`, key by key: the value with the newer time — `vt[key]`, the time that key was last typed, or the item's
//     own `t` when absent (an item written by 0.12; review 10a, r10a·2: as 0, its newer text lost to an older one) —,
//     on a tie the larger text — so two answers typed in different fields on two devices both survive; the same field
//     keeps the newer text (no conflict copies). Every key of a merge gets its time in `vt`;
//   - `intentos`, `fallos`, `pistas`: the larger; `solucion` (the solution was opened): either;
//   - `resuelto` and `tapada` (review 10j) are values with their own time, keys of `valores` merged as above: `_r`
//     (MARCA_RESUELTO), written only by the events that decide it — the check that solves it and the self-assessment
//     «Sí»/«No» — and `_o` (MARCA_TAPADA), written by «Ocultar/Ver solución». The fields themselves are derived from
//     the merged keys. Before: whole-item fields of the newer `t`, so a later FAILED check on a device that had not
//     received the solve un-solved it (r10j·2; locally a failed check never undoes «resuelto»), and «Ocultar solución»,
//     which does not move `t`, lost to the device's own older copy in the file (r10j·1). An item without the key (0.12,
//     or 1.0 before review 10j) counts as having it at its own `t` when `resuelto` is true / `tapada` is set
//     (`conMarcas`) — so a failed check without `_r` never decides it;
//   - `bien` (the answers right at that attempt) and any other field: those of the newer version (`t`, then the
//     canonical text of those fields) as a whole — `bien` is the verdict of the last attempt (review 10i: a union kept
//     a ✓ of an earlier attempt, and made the reset rule above impossible to keep associative);
//   - `t`: the larger.
// Each part is a join on a total order or a set union, and `r` orders them lexicographically, so the merge is
// commutative, associative and idempotent: every device reaches the same value whatever the order
// (tests/datos10.spec.ts, property tests).

import { canonico } from './sincronizacion/fusion';

export interface EjercicioUnible {
  intentos: number;
  fallos: number;
  resuelto: boolean;
  pistas: number;
  solucion: boolean;
  valores?: Record<string, string>;
  /** Per key of `valores`: when it was last typed (ms). */
  vt?: Record<string, number>;
  bien?: string[];
  tapada?: boolean;
  /** Reset epoch (ms of the last «Reiniciar»); absent: never reset. */
  r?: number;
  t: number;
}

const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The fields merged one by one; every other field is taken from the newer version as a whole. */
const UNIDOS = new Set(['intentos', 'fallos', 'pistas', 'solucion', 'resuelto', 'tapada', 'valores', 'vt', 't', 'r']);

/**
 * Review 10j: the key of `valores` that holds whether the exercise is solved, with its own time in `vt` — "" (a
 * self-assessment «No») or "1|intentos|fallos|pistas|solucion" (solved, with the counters of the device that solved it
 * at that moment: lib/valores-ejercicio.ts marcarResuelto, ayudaAlResolver).
 */
export const MARCA_RESUELTO = '_r';
/** Review 10j: the key of `valores` that holds «Ocultar solución» of a problem ("1") or «Ver solución» (""). */
export const MARCA_TAPADA = '_o';

/**
 * An item with its `resuelto`/`tapada` as keys of `valores` when it has not got them (written by 0.12 or by 1.0 before
 * review 10j): `_r` "1" when solved, `_o` from `tapada` when set — with no `vt`, so they take the item's own `t`
 * (tiempoClave), the time of the attempt that decided them. A function of the item alone, and the identity on what
 * the merge returns (it always writes both keys when there is something to say): the merge stays associative.
 */
function conMarcas<E extends EjercicioUnible>(e: E): E {
  const v = esObjeto(e.valores) ? e.valores : undefined;
  const r = e.resuelto === true && !(v && MARCA_RESUELTO in v);
  const o = typeof e.tapada === 'boolean' && !(v && MARCA_TAPADA in v);
  if (!r && !o) return e;
  const valores = { ...(v ?? {}) };
  if (r) valores[MARCA_RESUELTO] = '1';
  if (o) valores[MARCA_TAPADA] = e.tapada ? '1' : '';
  return { ...e, valores };
}

/** `resuelto` and `tapada` of a merged item, from its keys `_r` and `_o`. */
function derivarMarcas<E extends EjercicioUnible>(e: E): E {
  e.resuelto = (e.valores?.[MARCA_RESUELTO] ?? '').startsWith('1');
  if (e.valores && MARCA_TAPADA in e.valores) e.tapada = e.valores[MARCA_TAPADA] === '1';
  else delete e.tapada;
  return e;
}
const resto = (e: EjercicioUnible): Record<string, unknown> =>
  Object.fromEntries(Object.entries(e).filter(([k]) => !UNIDOS.has(k)));

/**
 * Whether `a` comes after `b`: its time, then the canonical text of its other fields — never of the merged ones, which
 * differ between a merge and the version it took them from (associativity on equal times).
 */
function despues(a: EjercicioUnible, b: EjercicioUnible): boolean {
  if (num(a.t) !== num(b.t)) return num(a.t) > num(b.t);
  return canonico(resto(a)) >= canonico(resto(b));
}

/** When a key of `valores` was last typed: its `vt`, else the item's own time (an item written by 0.12 has no `vt`). */
function tiempoClave(e: EjercicioUnible, k: string): number {
  const x = esObjeto(e.vt) ? (e.vt as Record<string, unknown>)[k] : undefined;
  return typeof x === 'number' && Number.isFinite(x) ? x : num(e.t);
}

/**
 * The answers of several versions, key by key: the newest by `tiempoClave`, then the larger text. A version given with
 * `desde` takes part only with the keys typed after it (the answers another device typed after a reset it had not
 * seen). Every key of the result gets its time in `vt` (an item of 0.12 is normalised once).
 */
function unirValores(lados: { e: EjercicioUnible; desde: number }[]): { valores?: Record<string, string>; vt?: Record<string, number> } {
  const mejor = new Map<string, { x: number; v: string }>();
  for (const { e, desde } of lados) {
    if (!esObjeto(e.valores)) continue;
    for (const [k, v] of Object.entries(e.valores)) {
      const x = tiempoClave(e, k);
      if (!(x > desde)) continue;
      const m = mejor.get(k);
      const texto = String(v);
      if (!m || x > m.x || (x === m.x && texto > m.v)) mejor.set(k, { x, v: texto });
    }
  }
  if (!mejor.size) return {};
  const valores: Record<string, string> = {};
  const vt: Record<string, number> = {};
  for (const k of [...mejor.keys()].sort()) {
    const m = mejor.get(k)!;
    valores[k] = m.v;
    // (always, 0 too: a key whose time is dropped would take its item's `t` in the next merge — not associative,
    // review 10b)
    vt[k] = m.x;
  }
  return { valores, vt };
}

function ponerValores<E extends EjercicioUnible>(r: E, u: { valores?: Record<string, string>; vt?: Record<string, number> }): E {
  delete r.valores;
  delete r.vt;
  if (u.valores) r.valores = u.valores;
  if (u.vt) r.vt = u.vt;
  return r;
}

/**
 * A version that had not seen the reset `r` (its own reset is older), as the part of it that is after that reset —
 * what joins the reset's side (see the header). Its answers typed after `r` keep their own times (explicit `vt`); when
 * its `t` is after `r` (a real attempt after the reset), its whole-item fields and one attempt; nothing else (t −1: it
 * never wins a whole-item comparison). A homomorphism of the merge of versions of one epoch — the projection of their
 * merge is the merge of their projections —, and projecting twice is projecting once onto the later reset: so the
 * whole merge stays commutative, associative and idempotent (tests/datos10.spec.ts, revision10b-union.spec.ts).
 */
function proyectar(p: EjercicioUnible, r: number): EjercicioUnible {
  const vivo = num(p.t) > r;
  // (t −1 when nothing of it is after the reset: older than any real version — even one of t 0 —, so its whole-item
  // fields never win; a tie with t 0 would let the canonical text decide)
  const q = { ...(vivo ? resto(p) : {}), r, t: vivo ? num(p.t) : -1, intentos: vivo ? 1 : 0, fallos: 0, pistas: 0, solucion: false } as EjercicioUnible;
  // (`resuelto`/`tapada` come with their keys: a solve or an «Ocultar» after the reset, never one before it)
  return derivarMarcas(ponerValores(q, unirValores([{ e: p, desde: r }])));
}

/** Two versions of one reset epoch (the same `r`). */
function mismaEpoca<E extends EjercicioUnible>(a: E, b: E): E {
  const ra = num(a.r);
  const nuevo = despues(a, b) ? a : b;
  const r = { ...resto(nuevo) } as unknown as E;
  if (ra) r.r = ra;
  r.t = Math.max(num(a.t), num(b.t));
  r.intentos = Math.max(num(a.intentos), num(b.intentos));
  r.fallos = Math.max(num(a.fallos), num(b.fallos));
  r.pistas = Math.max(num(a.pistas), num(b.pistas));
  r.solucion = a.solucion === true || b.solucion === true;
  // (a key without `vt` — written by 0.12 — counts from the item's own time, not from 0: review 10a, r10a·2)
  return derivarMarcas(ponerValores(r, unirValores([{ e: a, desde: Number.NEGATIVE_INFINITY }, { e: b, desde: Number.NEGATIVE_INFINITY }])));
}

export function unirEjercicios<E extends EjercicioUnible>(a: E, b: E): E {
  if (!esObjeto(a)) return b;
  if (!esObjeto(b)) return a;
  // (the same version twice: itself, as it is — idempotent without normalising it)
  if (canonico(a) === canonico(b)) return a;
  a = conMarcas(a);
  b = conMarcas(b);
  const ra = num(a.r);
  const rb = num(b.r);
  if (ra === rb) return mismaEpoca(a, b);
  // the newer reset wins; of the other side, what came after that reset (`proyectar`)
  const [g, p] = ra > rb ? [a, b] : [b, a];
  return mismaEpoca(g, proyectar(p, Math.max(ra, rb)) as E);
}
