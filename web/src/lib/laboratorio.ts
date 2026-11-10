// 1.1 «Laboratorio guiado» (componentes/instrumentos/practicas/laboratorio.ts): what is kept of each lab. Pure (the
// tests run it in Node).
//
// Stored (almacen key `laboratorio`, schema 1 in esquemas.ts; synchronised as store `laboratorio`):
//   { version: 1, practicas: { "p<n>": { h: [step id…], l: { <step id>: [value, ms] }, c: ms | 0, t: ms, a?: [step id…] } } }
// `h`: the steps done (sorted, no repeats); `l`: the reading typed at each step done with one, and when; `c`: when the
// lab was first completed (0 = not yet); `t`: the newest change; `a` (review 11a, absent when empty): the steps
// «Hágalo por mí» did for the reader — they give no XP afterwards, on any device (the exercises' `_r` keeps the help
// of a solve the same way). Ids are the labs' stable ids (laboratorios.ts).
// Nothing is ever taken away: «Repetir» starts the bench again but keeps what was done, so a merge cannot resurrect
// anything (there are no deletions to lose).
//
// Merge (the synchronisation's `unir` and another tab's writes): the union of the steps (and of the steps done for the
// reader); per step the reading with the newer time (same time: the larger value); the earliest completion; the newest
// `t`. Commutative, associative and idempotent.

export interface RegistroLab {
  h: string[];
  l: Record<string, [number, number]>;
  c: number;
  t: number;
  /** Review 11a: steps done by «Hágalo por mí» (no XP for them any more); absent when none. */
  a?: string[];
}

export const CLAVE_LABORATORIO = 'laboratorio';

/** Item id of a lab in the store. */
export const claveLab = (n: number): string => `p${n}`;

const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function registroLabValido(v: unknown): v is RegistroLab {
  if (!objeto(v) || !Array.isArray(v.h) || !objeto(v.l) || !numero(v.c) || !numero(v.t)) return false;
  if (!v.h.every((x) => typeof x === 'string')) return false;
  if (v.a !== undefined && !(Array.isArray(v.a) && v.a.every((x) => typeof x === 'string'))) return false;
  return Object.values(v.l).every((e) => Array.isArray(e) && e.length === 2 && numero(e[0]) && numero(e[1]));
}

const ordenados = (xs: Iterable<string>) => [...new Set(xs)].sort();

export function unirRegistrosLab(a: RegistroLab, b: RegistroLab): RegistroLab {
  const l: Record<string, [number, number]> = {};
  for (const k of ordenados([...Object.keys(a.l), ...Object.keys(b.l)])) {
    const x = a.l[k];
    const y = b.l[k];
    l[k] = !x ? [...y!] : !y ? [...x] : x[1] > y[1] || (x[1] === y[1] && x[0] >= y[0]) ? [...x] : [...y];
  }
  const c = a.c && b.c ? Math.min(a.c, b.c) : a.c || b.c;
  const r: RegistroLab = { h: ordenados([...a.h, ...b.h]), l, c, t: Math.max(a.t, b.t) };
  const ayuda = ordenados([...(a.a ?? []), ...(b.a ?? [])]);
  if (ayuda.length) r.a = ayuda;
  return r;
}

/**
 * A step done: added to `h` (and its reading to `l`); `c` set when every step of the lab is done. `ahora` is never
 * earlier than the record's own time (a clock set back would sort the change before the older one).
 */
export function anotarPasoLab(previo: RegistroLab | undefined, paso: string, lectura: number | null, pasos: readonly string[], ahora: number): RegistroLab {
  const r: RegistroLab = previo ? { h: [...previo.h], l: { ...previo.l }, c: previo.c, t: previo.t } : { h: [], l: {}, c: 0, t: 0 };
  if (previo?.a?.length) r.a = [...previo.a];
  const t = Math.max(ahora, r.t + 1);
  r.h = ordenados([...r.h, paso]);
  if (lectura !== null && Number.isFinite(lectura)) r.l[paso] = [lectura, t];
  if (!r.c && pasos.every((p) => r.h.includes(p))) r.c = t;
  r.t = t;
  return r;
}

/**
 * Review 11a: whether a lab is completed — its first completion `c`, or every step of it in `h` (two devices that did
 * different steps: their union covers the lab, and no device set `c`; PanelLaboratorio already reads `h`).
 */
export function labCompletado(r: RegistroLab | undefined, pasos: readonly string[]): boolean {
  if (!r) return false;
  return !!r.c || (pasos.length > 0 && pasos.every((p) => r.h.includes(p)));
}

/** Review 11a: «Hágalo por mí» did a step for the reader: from now on that step gives no XP, on any device. */
export function anotarAyudaLab(previo: RegistroLab | undefined, paso: string, ahora: number): RegistroLab {
  const r: RegistroLab = previo ? { h: [...previo.h], l: { ...previo.l }, c: previo.c, t: previo.t } : { h: [], l: {}, c: 0, t: 0 };
  r.a = ordenados([...(previo?.a ?? []), paso]);
  r.t = Math.max(ahora, r.t + 1);
  return r;
}

/** Review 11a: whether a step of a lab still gives XP (it was not done for the reader on any device). */
export const pasoDaXp = (r: RegistroLab | undefined, paso: string): boolean => !r?.a?.includes(paso);
