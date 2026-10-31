// Mastery per concept (0.11, group B). Pure module (its only runtime import, the review day of repaso/srs.ts, is pure
// too): the tests import it directly.
//
// A concept is a SECTION of the book (an h2: «cap05/sec-5.3»), the unit of the lessons «Estudiar por pasos», of
// the practice items (each carries its `seccion`), of the Repaso questions (their `ref` is the section or something
// inside it: a subsection, a problem) and of the exercises (ejercicios.json gives each one its section). 634 of the
// 754 sections have something to answer. Chapters and courses aggregate their sections. Glossary terms were
// considered and rejected: no question is tagged with a term (only the «Une las parejas» items name some), so a
// term-level mastery would have no evidence behind it.
//
// Evidence: every checked answer (`respuesta` event) of an item is folded into ROUNDS. A round is the first answer
// to an item after a pause of at least VENTANA; what follows within the window (the second attempt, «Probar otra
// vez», a reload that reports the answer again) is not new evidence. Points of a round: 100 right at the first
// attempt without hints, 60 right with help (second attempt or hints), 0 wrong. A wrong first attempt of a question
// that still has an attempt left is stored as a provisional 0 (`pendiente`) that the final answer of the same round
// replaces (60 when the second attempt is right). A round with exactly the same time as a stored one is the same
// event replayed: ignored. So recording is idempotent.
//
// Mastery of a concept (0–1), from its items' rounds:
//   item score q   = recency-weighted mean of its rounds (the last one weighs 1, the previous ½, then ¼…)
//   item weight w  = 1 + ½·min(2, d − 1), d = days with a round on that item (spaced practice counts more)
//   accuracy A     = (Σ w·q + 0,45) / (Σ w + 1,5)       a pessimistic prior (mean 0,3, weight 1,5): one right
//                                                         answer is not mastery; 0,58 → 0,70 → 0,77 → 0,84…
//   stability S    = 3 days · 2^(m − 1), m = days on which the concept's rounds averaged ≥ 60 (1,5 days if none;
//                    at most 192 days): each successful day doubles how long it is remembered
//   retention R    = 0,5^(days since the last round / S)
//   mastery        = A · (0,5 + 0,5·R)                    forgetting halves it at most
// Levels (as in Khan Academy): nuevo (no evidence), intentado < 0,4 ≤ familiarizado < 0,6 ≤ competente < 0,8 ≤
// dominado. «Para repasar» (decaying): A ≥ 0,6 and R < 0,7.

import { inicioDia } from '../../componentes/repaso/srs';

export const VERSION_DOMINIO = 1;

/** Kind of item: an «Aprender haciendo» practice item, a Repaso question, an exercise of the book. */
export type ClaseItem = 'p' | 'q' | 'e';

/** [time (ms), points 0–100, provisional?]. */
export type Ronda = [number, number] | [number, number, 1];

/** What is stored per item. */
export interface RegistroItem {
  /** Concept: «<parte>/<label of the h2 section>». */
  s: string;
  c: ClaseItem;
  /** Rounds, oldest first (at most MAX_RONDAS). */
  r: Ronda[];
}

/** Answers of the same item closer than this are one round. */
export const VENTANA = 10 * 60_000;
export const MAX_RONDAS = 6;
export const DIA_MS = 86_400_000;
/** Points of a right answer at the first attempt without hints, with help, and of a wrong one. */
export const PUNTOS = { bien: 100, ayuda: 60, mal: 0 } as const;

const PRIOR_MEDIA = 0.3;
const PRIOR_PESO = 1.5;
const S0_DIAS = 3;
const S_MAX_DIAS = 192;
const S_SIN_EXITO = 1.5;

export const UMBRALES = { familiarizado: 0.4, competente: 0.6, dominado: 0.8 } as const;
/** «Para repasar»: accuracy at least this, retention below that. */
export const REPASAR = { precision: 0.6, retencion: 0.7 } as const;

export type NivelDominio = 'nuevo' | 'intentado' | 'familiarizado' | 'competente' | 'dominado';
export const NIVELES_DOMINIO: NivelDominio[] = ['nuevo', 'intentado', 'familiarizado', 'competente', 'dominado'];
export const NOMBRE_NIVEL_DOMINIO: Record<NivelDominio, string> = {
  nuevo: 'Sin practicar',
  intentado: 'Intentado',
  familiarizado: 'Familiarizado',
  competente: 'Competente',
  dominado: 'Dominado',
};

/** The parts of a `respuesta` event that matter here. */
export interface RespuestaDominio {
  t: number;
  correcta: boolean;
  intento: number;
  pistas: number;
  final: boolean;
  clase: 'practica' | 'pregunta' | 'ejercicio';
}

export const claseItem = (c: RespuestaDominio['clase']): ClaseItem => (c === 'practica' ? 'p' : c === 'pregunta' ? 'q' : 'e');

/** Points of an answer. An exercise's `intento` counts every check of its life, so only its hints matter. */
export function puntosDe(e: Pick<RespuestaDominio, 'correcta' | 'intento' | 'pistas' | 'clase'>): number {
  if (!e.correcta) return PUNTOS.mal;
  if (e.clase === 'ejercicio') return e.pistas > 0 ? PUNTOS.ayuda : PUNTOS.bien;
  return e.intento <= 1 && e.pistas <= 0 ? PUNTOS.bien : PUNTOS.ayuda;
}

const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function rondaValida(v: unknown): v is Ronda {
  return Array.isArray(v) && (v.length === 2 || (v.length === 3 && v[2] === 1)) && esNumero(v[0]) && esNumero(v[1]) && v[1] >= 0 && v[1] <= 100;
}

export function registroValido(v: unknown): v is RegistroItem {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return typeof o.s === 'string' && o.s.includes('/') && (o.c === 'p' || o.c === 'q' || o.c === 'e') && Array.isArray(o.r) && o.r.every(rondaValida);
}

function recortar(r: Ronda[]): Ronda[] {
  r.sort((a, b) => a[0] - b[0]);
  return r.length > MAX_RONDAS ? r.slice(r.length - MAX_RONDAS) : r;
}

/**
 * Folds one answer into an item's record. Returns the new record, or null when nothing changes (a replayed event,
 * a retry within the same round, a non-final answer of a round already open). Never mutates `previo`.
 */
export function anotarRespuesta(previo: RegistroItem | undefined, s: string, e: RespuestaDominio): RegistroItem | null {
  if (!esNumero(e.t)) return null;
  const c = claseItem(e.clase);
  const puntos = puntosDe(e);
  // A wrong answer that leaves another attempt: provisional (exercises have no «final» wrong answer: every wrong
  // check of an exercise is provisional and a right one within the window settles the round).
  const provisional = !e.final && !e.correcta;
  // Neither final nor wrong (a right answer that does not close: does not happen today): wait for the final one.
  if (!e.final && e.correcta && e.clase !== 'ejercicio') return null;
  const r: Ronda[] = previo ? previo.r.map((x) => [...x] as Ronda) : [];
  if (r.some((x) => x[0] === e.t)) return null;
  // The round this answer belongs to: the latest one that started at most VENTANA before it.
  let k = -1;
  for (let i = r.length - 1; i >= 0; i--) {
    const d = e.t - r[i]![0];
    if (d >= 0 && d < VENTANA) {
      k = i;
      break;
    }
  }
  if (k >= 0) {
    const ronda = r[k]!;
    // Only a provisional round is settled by the final answer of the same round; anything else is a retry.
    if (ronda.length !== 3 || provisional) return null;
    // The round started wrong: a right final answer is «with help» at most.
    r[k] = [ronda[0], Math.min(puntos, PUNTOS.ayuda)];
    return { s: previo?.s ?? s, c: previo?.c ?? c, r };
  }
  // An older answer arriving late (replays, another device) opens its own round only if no stored round is near.
  if (r.some((x) => Math.abs(x[0] - e.t) < VENTANA)) return null;
  r.push(provisional ? [e.t, puntos, 1] : [e.t, puntos]);
  return { s: previo?.s ?? s, c: previo?.c ?? c, r: recortar(r) };
}

/** Union of two records of the same item (synchronisation): rounds by time, the same time once (settled wins). */
export function fusionarRegistros(a: RegistroItem, b: RegistroItem): RegistroItem {
  const porT = new Map<number, Ronda>();
  for (const x of [...a.r, ...b.r]) {
    const y = porT.get(x[0]);
    // a settled round beats a provisional one with the same start; otherwise the higher points
    if (!y || (y.length === 3 && x.length === 2) || (y.length === x.length && x[1] > y[1])) porT.set(x[0], [...x] as Ronda);
  }
  // Rounds are told apart by their start only (no merging of near ones: that made the union depend on the order in
  // which three devices merged — third review). Every choice is a maximum of an order (settled > provisional, then
  // points; the newest MAX_RONDAS; the larger concept and kind), so the union is commutative, associative and
  // idempotent: any number of devices reach the same record in any order.
  return { s: a.s === b.s || !b.s ? a.s : !a.s ? b.s : a.s > b.s ? a.s : b.s, c: a.c === b.c || a.c > b.c ? a.c : b.c, r: recortar([...porT.values()]) };
}

/**
 * Day number of a time, days starting at 04:00 local: the review day of repaso/srs.ts (claveDia, the streak), also on
 * the days the clocks change (t − 4 h was an hour off on them).
 */
export function numeroDia(t: number): number {
  const d = new Date(inicioDia(t));
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DIA_MS);
}

export interface DominioConcepto {
  /** «parte/label». */
  clave: string;
  /** Mastery 0–1 (with forgetting). */
  valor: number;
  nivel: NivelDominio;
  /** Accuracy A (without forgetting). */
  precision: number;
  /** Retention R now (1 just practised). */
  retencion: number;
  /** Stability S in days. */
  estabilidad: number;
  /** Last round (ms), 0 without evidence. */
  ultima: number;
  /** Items answered and rounds. */
  items: number;
  rondas: number;
  /** Decaying: known but due for review. */
  repasar: boolean;
}

export function nivelDominio(valor: number, conDatos: boolean): NivelDominio {
  if (!conDatos) return 'nuevo';
  if (valor >= UMBRALES.dominado) return 'dominado';
  if (valor >= UMBRALES.competente) return 'competente';
  if (valor >= UMBRALES.familiarizado) return 'familiarizado';
  return 'intentado';
}

export function conceptoVacio(clave: string): DominioConcepto {
  return { clave, valor: 0, nivel: 'nuevo', precision: 0, retencion: 0, estabilidad: 0, ultima: 0, items: 0, rondas: 0, repasar: false };
}

/** Mastery of one concept from the records of its items, at time `ahora`. */
export function dominioConcepto(clave: string, registros: RegistroItem[], ahora: number): DominioConcepto {
  let suma = 0;
  let pesos = 0;
  let ultima = 0;
  let rondas = 0;
  let items = 0;
  const porDia = new Map<number, { s: number; n: number }>();
  for (const reg of registros) {
    const r = reg.r;
    if (!r.length) continue;
    items++;
    rondas += r.length;
    let num = 0;
    let den = 0;
    const dias = new Set<number>();
    for (let i = 0; i < r.length; i++) {
      const [t, p] = r[i]!;
      const w = 0.5 ** (r.length - 1 - i);
      num += w * (p / 100);
      den += w;
      const d = numeroDia(t);
      dias.add(d);
      const x = porDia.get(d) ?? { s: 0, n: 0 };
      x.s += p / 100;
      x.n++;
      porDia.set(d, x);
      if (t > ultima) ultima = t;
    }
    const peso = 1 + 0.5 * Math.min(2, dias.size - 1);
    suma += peso * (num / den);
    pesos += peso;
  }
  if (!items) return conceptoVacio(clave);
  const precision = (suma + PRIOR_MEDIA * PRIOR_PESO) / (pesos + PRIOR_PESO);
  let exitos = 0;
  for (const x of porDia.values()) if (x.s / x.n >= 0.6) exitos++;
  const estabilidad = exitos ? Math.min(S_MAX_DIAS, S0_DIAS * 2 ** (exitos - 1)) : S_SIN_EXITO;
  const dias = Math.max(0, (ahora - ultima) / DIA_MS);
  const retencion = 0.5 ** (dias / estabilidad);
  const valor = precision * (0.5 + 0.5 * retencion);
  return {
    clave,
    valor,
    nivel: nivelDominio(valor, true),
    precision,
    retencion,
    estabilidad,
    ultima,
    items,
    rondas,
    repasar: precision >= REPASAR.precision && retencion < REPASAR.retencion,
  };
}

/** Every concept's mastery from all the item records. */
export function dominioPorConcepto(registros: Record<string, RegistroItem>, ahora: number): Record<string, DominioConcepto> {
  const porConcepto = new Map<string, RegistroItem[]>();
  for (const reg of Object.values(registros)) {
    const l = porConcepto.get(reg.s);
    if (l) l.push(reg);
    else porConcepto.set(reg.s, [reg]);
  }
  const r: Record<string, DominioConcepto> = {};
  for (const [clave, regs] of porConcepto) r[clave] = dominioConcepto(clave, regs, ahora);
  return r;
}

export interface Agregado {
  /** Mean mastery over the concepts (untouched ones count as 0). */
  valor: number;
  /** Concepts per level. */
  cuenta: Record<NivelDominio, number>;
  total: number;
  /** Concepts with evidence. */
  practicados: number;
  repasar: number;
}

/** A chapter's or a course's mastery: the mean over its concepts (those without evidence count as 0). */
export function agregar(claves: string[], porConcepto: Record<string, DominioConcepto>): Agregado {
  const cuenta: Record<NivelDominio, number> = { nuevo: 0, intentado: 0, familiarizado: 0, competente: 0, dominado: 0 };
  let suma = 0;
  let practicados = 0;
  let repasar = 0;
  for (const k of claves) {
    const d = porConcepto[k];
    if (!d || d.nivel === 'nuevo') {
      cuenta.nuevo++;
      continue;
    }
    cuenta[d.nivel]++;
    suma += d.valor;
    practicados++;
    if (d.repasar) repasar++;
  }
  return { valor: claves.length ? suma / claves.length : 0, cuenta, total: claves.length, practicados, repasar };
}

/** «72 %». */
export const porcentaje = (v: number): string => `${Math.round(Math.max(0, Math.min(1, v)) * 100)} %`;
