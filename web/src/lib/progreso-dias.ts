// Daily activity summed across devices (0.12), pure: used by progreso-diario.svelte.ts and by the tests in Node.
//
// The synchronised store `progreso-diario` keeps, per review day «2026-10-27», two kinds of item:
//   «2026-10-27@<device id>»  the activity of ONE device that day { pasos, preguntas, secciones, cumplido: false, t };
//                              only that device ever changes it, so last-write-wins per item is exact, and a day's
//                              activity is the SUM of its devices' items: studying on two devices adds up, and
//                              synchronising again never counts anything twice (each device's count is one item);
//   «2026-10-27»              the day's summary { pasos, preguntas, secciones, cumplido, t }: written as the sum of
//                              the records, with the day's verdict and the newest record's time. Since 1.0 only its
//                              `cumplido` is read (the frozen verdict of a past day, the streak); its counts are kept
//                              for a person reading the file and as the activity of a day with no records at all.
// The records have the 0.11 day shape (no normalisation, no back-and-forth).
//
// 1.0 (compatibility with 0.10/0.11 clients dropped): no device writes a day on top of a sum it has not seen any more
// (only 0.9–0.11 did: their mirror, newer than every record, held activity no record counted — the «legacy excess»,
// absorbed into «<day>@0» lazily by 0.12). That excess is now absorbed ONCE, by the schema migration of this store
// (lib/esquemas.ts, `absorberLegado`: the local data at load, a synchronisation file or a backup of format 1), with
// 0.12's own rule, and the day's total is just the sum of the records minus the undo records. Gone with it: the excess
// at every read, its absorption at every change and merge (and the guard of random trial 71031 against a merged map
// that paired a stored mirror with a lagging record), and the documented under-count of review 0.12d (d12d·3: a 0.11
// device's step on top of a mirror with an undone step) — there is no 0.11 device to write such a mirror.
//
// Verdict of a day (the streak): today, the day's total against the current goal; a past day, the mirror's frozen
// `cumplido`, or the total against the current goal when that goal was already in force at the end of the day (so a
// day reached only by adding up two devices — synchronised after midnight — still counts, and a later goal never
// rewrites the history).

export type TipoActividad = 'paso' | 'pregunta' | 'seccion';
export type TipoObjetivo = 'pasos' | 'preguntas';

export interface DiaProgreso {
  pasos: number;
  preguntas: number;
  secciones: number;
  /** The goal was met that day (frozen once the day is over); always false in a device's contribution. */
  cumplido: boolean;
  /** Last change (ms). */
  t: number;
}

export interface ObjetivoDiario {
  tipo: TipoObjetivo;
  cantidad: number;
  /** Sections marked as read count as lesson steps (only for a «pasos» goal). */
  secciones: boolean;
}

export interface Cuentas {
  pasos: number;
  preguntas: number;
  secciones: number;
}

/** Separator of a contribution's id: «<day>@<device id>». */
export const SEPARADOR = '@';
/** The device id of the contribution that holds a day's legacy activity (written before 0.12 or by an older device). */
export const LEGADO = '0';
const CAMPOS = ['pasos', 'preguntas', 'secciones'] as const;

export const esAporte = (id: string): boolean => id.includes(SEPARADOR);
export const diaDe = (id: string): string => id.split(SEPARADOR)[0]!;
export const idAporte = (dia: string, dispositivo: string): string => `${dia}${SEPARADOR}${dispositivo}`;
export const campoDe = (tipo: TipoActividad): keyof Cuentas => (tipo === 'paso' ? 'pasos' : tipo === 'pregunta' ? 'preguntas' : 'secciones');

export function cuenta(d: Cuentas | undefined, o: ObjetivoDiario): number {
  if (!d) return 0;
  return o.tipo === 'preguntas' ? d.preguntas : d.pasos + (o.secciones ? d.secciones : 0);
}

const cero = (t: number): DiaProgreso => ({ pasos: 0, preguntas: 0, secciones: 0, cumplido: false, t });

/** A day's items: its mirror and its contributions. */
export interface GrupoDia {
  espejo?: DiaProgreso;
  aportes: Map<string, DiaProgreso>;
}

/** The days of a flat map (store items) with their items. */
export function agrupar(m: Record<string, DiaProgreso>): Map<string, GrupoDia> {
  const r = new Map<string, GrupoDia>();
  for (const [id, v] of Object.entries(m)) {
    const dia = diaDe(id);
    const g = r.get(dia) ?? r.set(dia, { aportes: new Map() }).get(dia)!;
    if (esAporte(id)) g.aportes.set(id.slice(dia.length + 1), v);
    else g.espejo = v;
  }
  return r;
}

/** One day's group straight from the map (no grouping of the whole map). */
export function grupoDe(m: Record<string, DiaProgreso>, dia: string): GrupoDia {
  const g: GrupoDia = { espejo: m[dia], aportes: new Map() };
  const prefijo = dia + SEPARADOR;
  for (const [id, v] of Object.entries(m)) if (id.startsWith(prefijo)) g.aportes.set(id.slice(prefijo.length), v);
  return g;
}

/** The suffix of an undo record: «<day>@<record id>~» holds what that record's writer undid (subtracted). */
export const DESHECHO = '~';
const esDeshecho = (quien: string): boolean => quien.endsWith(DESHECHO);

/**
 * The day's records added up: `pasos…` the counts of every record (never lowered by an undo: what an older version's
 * mirror may already hold), `menos` the undo records, `maxT` the newest record's time.
 */
function suma(g: GrupoDia): Cuentas & { maxT: number; menos: Cuentas } {
  const s = { pasos: 0, preguntas: 0, secciones: 0, maxT: Number.NEGATIVE_INFINITY, menos: { pasos: 0, preguntas: 0, secciones: 0 } };
  for (const [quien, a] of g.aportes) {
    for (const c of CAMPOS) (esDeshecho(quien) ? s.menos : s)[c] += a[c];
    s.maxT = Math.max(s.maxT, a.t);
  }
  return s;
}

/**
 * What the mirror holds beyond the sum of the contributions, when an older version wrote it (see the header): read only
 * by the schema migration (`absorberLegado`) since 1.0.
 */
export function exceso(g: GrupoDia): Cuentas {
  const s = suma(g);
  const e = g.espejo;
  if (!e || !(e.t > s.maxT)) return { pasos: 0, preguntas: 0, secciones: 0 };
  return { pasos: Math.max(0, e.pasos - s.pasos), preguntas: Math.max(0, e.preguntas - s.preguntas), secciones: Math.max(0, e.secciones - s.secciones) };
}

/**
 * The day's activity: the sum of every record minus the undo records (1.0: the legacy excess was absorbed into
 * «<day>@0» by the migration). A day with no record at all (data of 0.9–0.11 the migration has not seen — e.g. a
 * device that went back to 0.12 and imported an old backup) counts its summary as it is: never zero, never twice.
 */
export function totalDia(g: GrupoDia): Cuentas {
  if (!g.aportes.size) return { pasos: g.espejo?.pasos ?? 0, preguntas: g.espejo?.preguntas ?? 0, secciones: g.espejo?.secciones ?? 0 };
  const s = suma(g);
  const t = (c: keyof Cuentas) => Math.max(0, s[c] - s.menos[c]);
  return { pasos: t('pasos'), preguntas: t('preguntas'), secciones: t('secciones') };
}

/** The newest time of the day's items (0 if none). */
export function tiempoDia(g: GrupoDia): number {
  let t = g.espejo?.t ?? 0;
  for (const a of g.aportes.values()) t = Math.max(t, a.t);
  return t;
}

/**
 * Whether the day's goal was met: today against the current goal; a past day by its frozen verdict, or by its total
 * against the current goal when that goal was set before the day ended (`finDia`: the start of the next day, ms).
 */
export function cumplidoDia(g: GrupoDia | undefined, o: ObjetivoDiario & { t?: number }, hoy: boolean, finDia: number): boolean {
  if (!g) return false;
  const llega = cuenta(totalDia(g), o) >= o.cantidad;
  if (hoy) return llega;
  return !!g.espejo?.cumplido || ((o.t ?? 0) < finDia && llega);
}

/**
 * This device changes a day (mutates `m`, returns the ids written): `n` is added to `campo` of its own contribution (n < 0 undoes, never below 0), and the mirror gets the new total,
 * the verdict against `objetivo` and the time of the newest contribution (so it is never taken for an older device's).
 * With no `campo` only the verdict and the times are refreshed (a new goal).
 */
export function tocarDia(
  m: Record<string, DiaProgreso>,
  dia: string,
  dispositivo: string,
  t: number,
  objetivo: ObjetivoDiario,
  campo?: keyof Cuentas,
  n = 0,
): string[] {
  // (a day with a summary and no record — not migrated, see `totalDia` — keeps its activity as «<day>@0» first: the new
  // record alone would make it count less)
  const g0 = grupoDe(m, dia);
  const escritos: string[] = !g0.aportes.size && g0.espejo ? absorberDia(m, dia, g0) : [];
  const propio = idAporte(dia, dispositivo);
  const p = { ...(m[propio] ?? cero(t)) };
  p.t = Math.max(t, p.t + 1);
  p.cumplido = false;
  if (campo && n > 0) p[campo] += n;
  else if (campo && n < 0) {
    // an undo never lowers the record (an older device's mirror may already include it, and its excess would bring it
    // back: review 0.12, finding 4): it goes to this writer's undo record, up to what it counted itself
    const idMenos = idAporte(dia, dispositivo + DESHECHO);
    const d = { ...(m[idMenos] ?? cero(t)) };
    d[campo] = Math.min(p[campo], d[campo] - n);
    d.t = p.t;
    d.cumplido = false;
    m[idMenos] = d;
    escritos.push(idMenos);
  }
  m[propio] = p;
  escritos.push(propio);
  const total = totalDia(grupoDe(m, dia));
  m[dia] = { ...total, cumplido: cuenta(total, objetivo) >= objetivo.cantidad, t: tiempoAportes(grupoDe(m, dia)) };
  escritos.push(dia);
  return escritos;
}

/**
 * The schema migration of `progreso-diario` from 1 (0.12 and older) to 2 (1.0), pure and idempotent (lib/esquemas.ts):
 * every day's legacy excess (a mirror newer than every record — written by 0.9–0.11 — holding more than the records)
 * goes into «<day>@0», exactly as 0.12 absorbed it when it changed the day (the same value on every device that saw the
 * same mirror; dated with the mirror's time, never older than before), so that 1.0 counts only records. A day with no
 * record (0.9–0.11 data) gets its whole summary as «<day>@0». After it no mirror is newer than its day's records, so a
 * second pass changes nothing. Mutates `m`; returns the ids written.
 */
export function absorberLegado(m: Record<string, DiaProgreso>): string[] {
  const escritos: string[] = [];
  for (const [dia, g] of agrupar(m)) escritos.push(...absorberDia(m, dia, g));
  return escritos;
}

function absorberDia(m: Record<string, DiaProgreso>, dia: string, g: GrupoDia): string[] {
  const x = exceso(g);
  if (!x.pasos && !x.preguntas && !x.secciones) return [];
  const id = idAporte(dia, LEGADO);
  const l = { ...(m[id] ?? cero(0)) };
  for (const c of CAMPOS) l[c] += x[c];
  l.t = Math.max(g.espejo!.t, l.t + 1);
  l.cumplido = false;
  m[id] = l;
  return [id];
}

function tiempoAportes(g: GrupoDia): number {
  let t = 0;
  for (const a of g.aportes.values()) t = Math.max(t, a.t);
  return t;
}

/**
 * After a merge (a synchronisation, another tab): the day's summary as it follows from the merged records — the sum,
 * the verdict (`cumplidoDia`: once met, a past day keeps it), the newest record's time. A day without records is left
 * as it is. Deterministic: two devices with the same records and goal write the same items, equal values that the
 * synchronisation does not send twice (fusion.ts alinearIguales). Mutates `m`; returns the ids changed.
 */
export function rehacerDia(m: Record<string, DiaProgreso>, dia: string, objetivo: ObjetivoDiario & { t?: number }, hoy: boolean, finDia: number): string[] {
  const g = grupoDe(m, dia);
  if (!g.aportes.size) return [];
  const escritos: string[] = [];
  const espejo: DiaProgreso = { ...totalDia(g), cumplido: cumplidoDia(g, objetivo, hoy, finDia), t: tiempoAportes(g) };
  const e = m[dia];
  if (!e || CAMPOS.some((c) => e[c] !== espejo[c]) || e.cumplido !== espejo.cumplido || e.t !== espejo.t) {
    m[dia] = espejo;
    escritos.push(dia);
  }
  return escritos;
}

/**
 * `rehacerDia` for several days at once (all with `dias` null): the map is grouped once and each day is remade on a
 * map of its own items only — linear in the items, where calling `rehacerDia` on the whole map for every day scanned
 * the whole map three times per day (review 0.12g, finding 1: 2920 items, 2 years × 3 devices, 1,4 s of main thread on
 * a desktop, 6,2 s at CPU ×4). Mutates `m`; returns the ids changed. `hoy`: today's key; `finDe(dia)`: the day's end.
 */
export function rehacerDias(
  m: Record<string, DiaProgreso>,
  dias: Iterable<string> | null,
  objetivo: ObjetivoDiario & { t?: number },
  hoy: string,
  finDe: (dia: string) => number,
): string[] {
  const grupos = agrupar(m);
  const deGrupo = (dia: string, g: GrupoDia): Record<string, DiaProgreso> => {
    const sub: Record<string, DiaProgreso> = {};
    if (g.espejo) sub[dia] = g.espejo;
    for (const [quien, a] of g.aportes) sub[idAporte(dia, quien)] = a;
    return sub;
  };
  const r: string[] = [];
  for (const dia of dias ?? grupos.keys()) {
    const g = grupos.get(dia);
    if (!g || !g.aportes.size) continue;
    const sub = deGrupo(dia, g);
    for (const id of rehacerDia(sub, dia, objetivo, dia === hoy, finDe(dia))) {
      m[id] = sub[id]!;
      r.push(id);
    }
  }
  return r;
}

/**
 * Two writers of one device's storage (two browser tabs) changed the same item of a day (lib/sincronizacion/
 * guardado.ts `unir`, three-way; `local`: this tab's version, `otro`: the stored one, `yo`: this tab's record id):
 *   - this tab's own record: both counts kept — base + what each side added — and never less than this tab's own
 *     count, field by field: another tab that shares the record (a duplicated tab before it got its own id) adds up,
 *     and a stale copy written back by another tab (an older version: it subtracts) never lowers it. With no base
 *     both created the record since this module last read the key (each counted from zero): they add up;
 *   - the legacy record «<day>@0» (an absorbed excess, the same value on every device that saw the same mirror —
 *     not a counter): the larger value per field, never a sum (review 0.12, finding 2: two tabs with different views
 *     counted it twice);
 *   - another device's (or tab's) record, or the day's mirror: undefined (the Guardado's default: the newer).
 */
export function unirAportesPestanas(id: string, local: DiaProgreso, otro: DiaProgreso, base: DiaProgreso | undefined, yo: string): DiaProgreso | undefined {
  if (!esAporte(id)) return undefined;
  const dia = diaDe(id);
  const r = cero(Math.max(local.t, otro.t));
  if (id === idAporte(dia, LEGADO)) {
    for (const c of CAMPOS) r[c] = Math.max(local[c], otro[c]);
    return r;
  }
  if (id !== idAporte(dia, yo) && id !== idAporte(dia, yo + DESHECHO)) return undefined;
  for (const c of CAMPOS) r[c] = Math.max(local[c], local[c] + otro[c] - (base?.[c] ?? 0));
  return r;
}

/**
 * This device's records of past days in one (review 0.12, finding 5: a browser keeps one record per tab and day, ~100 kB
 * a year in the synchronised file): for each day before `hasta` («YYYY-MM-DD») with more than one record of this
 * device (`dispositivo`: its id; a tab's record is «<device>-<tab>») or with a tab's record, one record «<day>@<device>»
 * with their sum, dated after all of them, and the others deleted. The day's total does not change (the mirror neither);
 * safe with the synchronisation: no tab writes a day two days old, two tabs
 * compacting at once write the same, and an older version of a deleted record loses to its tombstone. Mutates `m`;
 * returns what changed.
 */
export function compactar(m: Record<string, DiaProgreso>, dispositivo: string, hasta: string): { poner: string[]; quitar: string[] } {
  const poner: string[] = [];
  const quitar: string[] = [];
  for (const [dia, g] of agrupar(m)) {
    if (!(dia < hasta)) continue;
    for (const sufijo of ['', DESHECHO]) {
      const destino = dispositivo + sufijo;
      const mios = [...g.aportes].filter(([quien]) => esDeshecho(quien) === !!sufijo && (quien === destino || quien.startsWith(`${dispositivo}-`)));
      if (!mios.length || (mios.length === 1 && mios[0]![0] === destino)) continue;
      const r = cero(0);
      for (const [, a] of mios) {
        for (const c of CAMPOS) r[c] += a[c];
        r.t = Math.max(r.t, a.t);
      }
      r.t += 1;
      for (const [quien] of mios) {
        if (quien === destino) continue;
        delete m[idAporte(dia, quien)];
        quitar.push(idAporte(dia, quien));
      }
      m[idAporte(dia, destino)] = r;
      poner.push(idAporte(dia, destino));
    }
  }
  return { poner, quitar };
}

/** The days summed (the XP reconciliation, the statistics): day → total, verdict and newest time. */
export function diasResumidos(
  m: Record<string, DiaProgreso>,
  o: ObjetivoDiario & { t?: number },
  hoy: string,
  finDe: (dia: string) => number,
): Record<string, DiaProgreso> {
  const r: Record<string, DiaProgreso> = {};
  for (const [dia, g] of agrupar(m)) r[dia] = { ...totalDia(g), cumplido: cumplidoDia(g, o, dia === hoy, finDe(dia)), t: tiempoDia(g) };
  return r;
}
