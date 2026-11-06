// 1.0: writing the reader's values of an exercise (EstadoEjercicio.valores) with the time of each changed key in `vt`,
// which the synchronisation merges key by key (lib/union-ejercicios.ts). Plain TypeScript (no runes) so the tests can
// run it in Node; lib/aprendizaje.svelte.ts re-exports it.
import type { EstadoEjercicio } from './aprendizaje.svelte';
import { MARCA_RESUELTO, MARCA_TAPADA } from './union-ejercicios';

/** 1.0: longest free text kept per value (the reader's written answer), so the synchronised file cannot balloon. */
export const MAX_TEXTO_EJERCICIO = 4000;

/** 1.0 (review 10e): longest draft of a numeric field (r1…) or of a structured answer (p1…) kept while typing. */
export const MAX_VALOR_EJERCICIO = 200;

/** A value about to be stored as typed (not an attempt): «texto» trimmed and capped, checklist marks short, the rest capped. */
export function limpiarValorEjercicio(clave: string, x: string): string {
  if (clave === 'texto') return normalizarTextoEjercicio(x);
  if (/^c\d+$/.test(clave)) return x.slice(0, 16);
  return x.slice(0, MAX_VALOR_EJERCICIO);
}

/**
 * Whether the stored value of a key is what the last «Comprobar» checked (its verdict can be shown again), rather
 * than a draft typed after it. `_c` is the time of the last check (registrarIntento); without it (data of 0.12 or of
 * 1.0 before the drafts) every stored value came from a check.
 */
export function valorComprobado(e: EstadoEjercicio | undefined, clave: string): boolean {
  const c = Number(e?.valores?._c ?? NaN);
  // no check time: data of 0.12 (values only came from checks: some attempt) or a draft never checked (review 10g:
  // also right after «Reiniciar»)
  // — and only a value not typed after the last attempt (review 10i, r10i·2: a draft typed in 1.0 over a migrated item
  // of 0.12, whose keys have vt = its t, came back with a verdict; its time is later than the item's `t`, which only an
  // attempt moves)
  if (!Number.isFinite(c)) {
    if (!((e?.intentos ?? 0) > 0)) return false;
    const x = e?.vt?.[clave];
    return typeof x !== 'number' || x <= (e?.t ?? 0);
  }
  // a check stamps every value it checked with its own time (registrarIntento): the same time means «this very value
  // was checked»; a draft — typed later, or on another device before or after that check — has another one (review 10g)
  return e?.vt?.[clave] === c;
}

/**
 * The item a draft creates when the exercise had none here (review 10g, r10g·7): no attempt, and t = 0, so the merge
 * (lib/union-ejercicios.ts: whole-item fields from the newer `t`) never takes its `resuelto: false` over another
 * device's real state; its keys keep their own times in `vt`.
 */
export function estadoDeBorrador(): EstadoEjercicio {
  return { intentos: 0, fallos: 0, resuelto: false, pistas: 0, solucion: false, t: 0 };
}

/** A written answer as stored: trimmed, line ends unified, no runs of blank lines, at most MAX_TEXTO_EJERCICIO. */
export function normalizarTextoEjercicio(t: string): string {
  return t
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXTO_EJERCICIO);
}

/**
 * 1.0: writes some keys of `valores`, stamping in `vt` the time of each key whose value changes (and only those; all of
 * them with `sellarTodas`, which a check uses), so
 * the synchronisation (lib/union-ejercicios.ts) merges two devices' answers key by key. Returns whether anything changed.
 */
export function ponerValores(e: EstadoEjercicio, nuevos: Record<string, string>, ahora = Date.now(), sellarTodas = false): boolean {
  let v: Record<string, string> | null = null;
  let vt: Record<string, number> | null = null;
  for (const [k, x] of Object.entries(nuevos)) {
    // (sellarTodas: a check stamps every value it checked, changed or not — see valorComprobado)
    if (!sellarTodas && (e.valores?.[k] ?? undefined) === x) continue;
    v ??= { ...(e.valores ?? {}) };
    vt ??= { ...(e.vt ?? {}) };
    v[k] = x;
    vt[k] = ahora;
  }
  if (!v || !vt) return false;
  e.valores = v;
  e.vt = vt;
  return true;
}


/**
 * Review 10j: an event that decides whether the exercise is solved — the check that solves it (`si`) and the
 * self-assessment «Sí»/«No» — writes `resuelto` and its key `_r` with its own time, so the merge keeps the newest of
 * those events and a later failed check (which writes no `_r`) never undoes it (lib/union-ejercicios.ts). The key keeps
 * the counters at that moment (after this attempt), so XP and the summary are never more generous on another device
 * than on the one that solved it (ayudaAlResolver).
 */
export function marcarResuelto(e: EstadoEjercicio, si: boolean, ahora = Date.now()): void {
  e.resuelto = si;
  const v = si ? `1|${e.intentos}|${e.fallos}|${e.pistas}|${e.solucion ? 1 : 0}` : '';
  ponerValores(e, { [MARCA_RESUELTO]: v }, ahora, true);
}

/** Review 10j: «Ocultar solución» / «Ver solución» of a problem, with its own time (key `_o`; it does not move `t`). */
export function marcarTapada(e: EstadoEjercicio, tapada: boolean, ahora = Date.now()): void {
  e.tapada = tapada;
  ponerValores(e, { [MARCA_TAPADA]: tapada ? '1' : '' }, ahora, true);
}

/**
 * The counters a solved exercise is judged by (XP, mastery, «Resuelto a la primera»): its own, and at least those the
 * device that solved it had then (`_r`). After a reset another device had not seen, the merge keeps only one attempt
 * of that device and none of its hints or the solution it opened (union-ejercicios.ts `proyectar`); without this, a
 * device that withheld the XP (solution seen) could see another one grant it in full (review 10j).
 */
export function ayudaAlResolver(e: EstadoEjercicio): { intentos: number; fallos: number; pistas: number; solucion: boolean } {
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
  const r = { intentos: n(e.intentos), fallos: n(e.fallos), pistas: n(e.pistas), solucion: e.solucion === true };
  const m = /^1\|(\d+)\|(\d+)\|(\d+)\|([01])$/.exec(e.valores?.[MARCA_RESUELTO] ?? '');
  if (!e.resuelto || !m) return r;
  return {
    intentos: Math.max(r.intentos, Number(m[1])),
    fallos: Math.max(r.fallos, Number(m[2])),
    pistas: Math.max(r.pistas, Number(m[3])),
    solucion: r.solucion || m[4] === '1',
  };
}

/**
 * «resuelto», «fallado» (tried and not solved) or «pendiente» (never tried). Review 10j, r10j·3: an attempt that is
 * not «resuelto» counts as failed even with `fallos` 0 — what the merge leaves of an attempt made after a reset the
 * device had not seen (one attempt, its failures not told apart from the ones before the reset).
 */
export function estadoEjercicio(e: EstadoEjercicio | undefined): 'pendiente' | 'fallado' | 'resuelto' {
  if (!e) return 'pendiente';
  if (e.resuelto) return 'resuelto';
  return (e.fallos ?? 0) > 0 || (e.intentos ?? 0) > 0 ? 'fallado' : 'pendiente';
}
