// 1.1 «Proyectos por etapas»: what is kept of each stage. Pure (the tests run it in Node).
//
// Stored (almacen key `proyectos`, schema 1 in esquemas.ts — a new key, so no migration; synchronised as store
// `proyectos`):
//   { version: 1, etapas: { "<stage id>": { c, tc, h, m, n, s, t } } }
// `c`: the id of the stage's circuit in «Mis circuitos» (store `editor-circuitos`), set when the stage is first opened
// (or opened again after that circuit was deleted), `tc` when; `h`: when the stage was first passed (0 = not yet); `m`:
// the design values and measurements of the latest pass, `{v: {component id: SI value}, r: {measurement id: value},
// t: ms}` or null; `n`: how many checks were simulated; `s`: when the book's design was first shown (0 = never: no XP
// after it); `t`: the newest change. Stage ids are the stable ids of etapas.ts.
//
// Nothing is ever taken away (a stage passed stays passed; «Restaurar la etapa» only redraws its circuit), so a merge
// cannot resurrect anything. Merge (the synchronisation's `unir` and another tab's writes): the circuit of the newer
// assignment (same time: the larger id); the earliest pass and the earliest «book's design shown»; the newer pass's
// values (same time: the larger, as text); the larger count; the newer `t`. Commutative, associative and idempotent.

export interface PaseEtapa {
  v: Record<string, number>;
  r: Record<string, number>;
  t: number;
}

export interface RegistroEtapa {
  c: string;
  tc: number;
  h: number;
  m: PaseEtapa | null;
  n: number;
  s: number;
  t: number;
}

export const CLAVE_PROYECTOS = 'proyectos';

const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const numeros = (v: unknown): boolean => objeto(v) && Object.values(v).every((x) => numero(x) || x === null);

function paseValido(v: unknown): v is PaseEtapa {
  return objeto(v) && numeros(v.v) && numeros(v.r) && numero(v.t);
}

export function registroEtapaValido(v: unknown): v is RegistroEtapa {
  return (
    objeto(v) &&
    typeof v.c === 'string' &&
    numero(v.tc) &&
    numero(v.h) &&
    (v.m === null || paseValido(v.m)) &&
    numero(v.n) &&
    numero(v.s) &&
    numero(v.t)
  );
}

export const registroVacio = (): RegistroEtapa => ({ c: '', tc: 0, h: 0, m: null, n: 0, s: 0, t: 0 });

const antes = (a: number, b: number) => (a && b ? Math.min(a, b) : a || b);
const copia = (p: PaseEtapa): PaseEtapa => ({ v: { ...p.v }, r: { ...p.r }, t: p.t });

export function unirRegistrosEtapa(a: RegistroEtapa, b: RegistroEtapa): RegistroEtapa {
  const circuito = a.tc > b.tc || (a.tc === b.tc && a.c >= b.c) ? { c: a.c, tc: a.tc } : { c: b.c, tc: b.tc };
  let m: PaseEtapa | null = null;
  if (a.m && b.m) m = a.m.t > b.m.t || (a.m.t === b.m.t && JSON.stringify(a.m) >= JSON.stringify(b.m)) ? copia(a.m) : copia(b.m);
  else if (a.m || b.m) m = copia((a.m ?? b.m)!);
  return { ...circuito, h: antes(a.h, b.h), m, n: Math.max(a.n, b.n), s: antes(a.s, b.s), t: Math.max(a.t, b.t) };
}

/** `ahora`, never earlier than the record's own time (a clock set back would sort the change before the older one). */
const momento = (r: RegistroEtapa, ahora: number) => Math.max(ahora, r.t + 1);
const base = (previo: RegistroEtapa | undefined): RegistroEtapa => (previo ? { ...previo, m: previo.m ? copia(previo.m) : null } : registroVacio());

/** The stage's circuit is this one (made now, or again after the old one was deleted). */
export function anotarCircuito(previo: RegistroEtapa | undefined, circuito: string, ahora: number): RegistroEtapa {
  const r = base(previo);
  const t = momento(r, ahora);
  return { ...r, c: circuito, tc: Math.max(t, r.tc + 1), t };
}

/** A check that was simulated: counted; a pass keeps its values and measurements (and the first pass its time). */
export function anotarComprobacion(
  previo: RegistroEtapa | undefined,
  bien: boolean,
  valores: Record<string, number>,
  medidas: Record<string, number>,
  ahora: number,
): RegistroEtapa {
  const r = base(previo);
  const t = momento(r, ahora);
  const limpio = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).filter(([, x]) => Number.isFinite(x)));
  return { ...r, n: r.n + 1, h: bien ? r.h || t : r.h, m: bien ? { v: limpio(valores), r: limpio(medidas), t } : r.m, t };
}

/** The book's design was shown: from now on this stage gives no XP. */
export function anotarSolucion(previo: RegistroEtapa | undefined, ahora: number): RegistroEtapa {
  const r = base(previo);
  const t = momento(r, ahora);
  return { ...r, s: r.s || t, t };
}

/** Learning-event id of a stage (XP `pr:proy-<stage id>`, once). */
export const idEvento = (etapa: string): string => `proy-${etapa}`;

/**
 * Review 11a: whether a stage still gives XP — not passed yet and its book's design never shown, on any device (`s`
 * is merged as the earliest, so once one device showed it the merged record keeps it, as the exercises' `_r` keeps the
 * help of a solve).
 */
export const etapaDaXp = (r: RegistroEtapa | undefined): boolean => !r?.h && !r?.s;
