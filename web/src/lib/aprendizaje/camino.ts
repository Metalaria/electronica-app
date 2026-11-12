// 1.0 «Mapa de cada curso como camino»: which nodes of a course are open, and when each completed lesson is due for
// review. Pure (the tests run it in Node). Nothing is stored here: the state comes from what the app already keeps —
// lessons (`lecciones`), lessons passed by a test (`cursos.superadas`), the own courses' items, and mastery
// (`dominio`) for the review schedule.
//
// Unlocking rule: a lesson opens when the lesson before it is completed or passed (a thematic course is all lessons:
// the next one opens when the previous is done). The exercises and questions of an own course never block: they open
// together with the lesson before them. Nothing the reader has already touched is ever locked: every node up to the
// furthest one with progress is open (someone who read ahead in the book keeps it). A locked node can be reached by
// passing a short check on the lessons it skips (`saltadas`), which marks them as passed.

import { REPASAR, DIA_MS, type DominioConcepto } from './dominio.ts';

export type EstadoNodo = 'hecho' | 'superado' | 'en-curso' | 'disponible' | 'bloqueado';

export interface NodoEntrada {
  /** «parte/label» for a lesson; any unique key otherwise. */
  clave: string;
  /** A lesson (blocks what follows until done) or an exercise/question of an own course (never blocks). */
  leccion: boolean;
  /** What the app knows of it. */
  progreso: 'hecho' | 'superado' | 'empezado' | 'nada';
}

export interface Camino {
  estados: EstadoNodo[];
  /** Index of the next node to do (the first open one not done), or -1 when everything is done. */
  siguiente: number;
}

const pasado = (n: NodoEntrada) => n.progreso === 'hecho' || n.progreso === 'superado';

export function calcularCamino(nodos: NodoEntrada[]): Camino {
  let frontera = -1;
  nodos.forEach((n, i) => {
    if (n.progreso !== 'nada') frontera = i;
  });
  const estados: EstadoNodo[] = [];
  let ultimaLeccion = -1;
  for (let i = 0; i < nodos.length; i++) {
    const n = nodos[i]!;
    // a lesson waits for the previous lesson to be done; an exercise or a question opens with its lesson
    const abierta =
      i <= frontera || ultimaLeccion < 0 || (n.leccion ? pasado(nodos[ultimaLeccion]!) : estados[ultimaLeccion] !== 'bloqueado');
    estados.push(
      n.progreso === 'hecho' ? 'hecho' : n.progreso === 'superado' ? 'superado' : !abierta ? 'bloqueado' : n.progreso === 'empezado' ? 'en-curso' : 'disponible',
    );
    if (n.leccion) ultimaLeccion = i;
  }
  const siguiente = estados.findIndex((e) => e === 'disponible' || e === 'en-curso');
  return { estados, siguiente };
}

/** The lessons a jump to node k skips: every lesson before it neither completed nor passed. */
export function saltadas(nodos: NodoEntrada[], k: number): string[] {
  return nodos.slice(0, Math.max(0, k)).filter((n) => n.leccion && !pasado(n)).map((n) => n.clave);
}

// ------------------------------------------------------------------ spaced review

/** Fraction of a review period after which retention falls to REPASAR.retencion: 0,5^x = 0,7 → x ≈ 0,515. */
export const FRACCION_REPASO = Math.log(REPASAR.retencion) / Math.log(0.5);

export type Repaso =
  /** Known but fading: practise it now. */
  | { k: 'ahora' }
  /** Known: next review at that time (ms). */
  | { k: 'fecha'; t: number }
  /** Answered, but not well enough to speak of reviewing: practise it. */
  | { k: 'flojo' }
  /** Nothing answered about it yet. */
  | { k: 'sin-datos' };

/**
 * When a completed lesson is due for review, from its mastery (dominio.ts: retention 0,5^(days/S), due below 0,7).
 * `ahora`: a date already reached is due now, even if the mastery was computed earlier (review 10d).
 */
export function repasoDe(d: DominioConcepto | null | undefined, ahora?: number): Repaso {
  if (!d || !d.ultima || !d.rondas) return { k: 'sin-datos' };
  if (d.repasar) return { k: 'ahora' };
  if (d.precision < REPASAR.precision) return { k: 'flojo' };
  const t = d.ultima + FRACCION_REPASO * d.estabilidad * DIA_MS;
  return ahora != null && t <= ahora ? { k: 'ahora' } : { k: 'fecha', t };
}

/**
 * 1.2: a section is «dominada» (the fourth state of the course map: por hacer / en curso / hecha / dominada) when its
 * mastery is at the top level («dominado»: dominio.ts UMBRALES, mastery with forgetting) AND it is not due for review
 * now (repasoDe gives a future date). Only completed or passed lessons are asked (the caller checks). Nothing new is
 * stored: it follows the review data, so a mastered section that fades below the level, or falls due, is «hecha»
 * again until it is reviewed.
 */
export function dominadaDe(d: DominioConcepto | null | undefined, ahora: number): boolean {
  if (!d || d.nivel !== 'dominado') return false;
  return repasoDe(d, ahora).k === 'fecha';
}

/** The local calendar day of a time, as a day count. */
const diaLocal = (x: number) => {
  const f = new Date(x);
  return Math.round(Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()) / DIA_MS);
};

/**
 * «hoy», «mañana», «en 3 días», «en 2 semanas» (Spanish), from now — by calendar days (review 10d: a review due in two
 * hours said «mañana»).
 */
export function cuandoRepaso(t: number, ahora: number): string {
  const dias = diaLocal(t) - diaLocal(ahora);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias < 14) return `en ${dias} días`;
  if (dias < 60) return `en ${Math.round(dias / 7)} semanas`;
  return `en ${Math.round(dias / 30)} meses`;
}

// ------------------------------------------------------------------ the short check of a jump

/** Questions of the check: 4, fewer when the skipped lessons have fewer (QA 1.0: never other lessons' questions). */
export const PREGUNTAS_SALTO = 4;

/**
 * QA 1.0: the pool of the jump's check — only questions about the lessons skipped (`concepto` maps a question to its
 * lesson «parte/label», null when unknown). Skipping only 0.1 used to fill up with the chapter's other lessons (ω,
 * complex numbers, inductors…): now it asks fewer questions, or none (the jump is then allowed with a note).
 */
export function preguntasDelSalto<T>(candidatas: readonly T[], concepto: (x: T) => string | null, lecciones: readonly string[]): T[] {
  const set = new Set(lecciones);
  return candidatas.filter((x) => set.has(concepto(x) ?? ''));
}

/** Passed with at most one miss (all right when there are fewer than four questions). */
export function aprobadoSalto(aciertos: number, total: number): boolean {
  if (total <= 0) return false;
  return total >= 4 ? aciertos >= total - 1 : aciertos === total;
}
