// XP rules and levels (0.11). Pure module (no runtime imports): the tests import it directly.
//
// XP is a ledger of awards with deterministic ids (progreso.svelte.ts): the same thing done twice, or on two
// devices, has the same id and counts once, and synchronising the ledger item by item never double-counts.
//   pr:<item id>        an «Aprender haciendo» item answered right (once per item)
//   pq:<question id>    a Repaso question answered right (lessons, tests, exams; once per question)
//   l:<parte>/<label>   a lesson «Estudiar por pasos» completed (once per section)
//   e:<label>           a self-checked exercise or problem solved (once per exercise)
//   c:<circuit id>      a guided breadboard circuit mounted and proved by its simulation (once per circuit)
//   d:<day>             the daily goal met that day (with a streak bonus)
//   pd:<day>            the problem of the day solved (group B; once per day)
// Lessons marked «superada por la prueba» (placement test) give no XP.

export const XP = {
  /** Right at the first attempt of the round, without hints. */
  acierto: 10,
  /** Right at the second attempt, or with hints on show. */
  aciertoConAyuda: 5,
  leccion: 20,
  ejercicio: 15,
  /** Solved after a failed check or with hints (opening the solution first gives nothing). */
  ejercicioConAyuda: 8,
  circuito: 25,
  /** The problem of the day solved (on top of the item's own answer XP). */
  problemaDia: 15,
  /** Daily goal met… */
  objetivo: 10,
  /** …plus this much per day of streak before today, up to `rachaTope` days. */
  rachaExtra: 2,
  rachaTope: 10,
} as const;

/** XP of a right answer, by attempt and hints. */
export function xpRespuesta(intento: number, pistas: number): number {
  return intento <= 1 && pistas <= 0 ? XP.acierto : XP.aciertoConAyuda;
}

/** XP of a solved exercise from its stored state (the same formula live and when reconciling old data). */
export function xpEjercicio(e: { fallos: number; pistas: number; solucion: boolean }): number {
  if (e.solucion) return 0;
  return e.fallos > 0 || e.pistas > 0 ? XP.ejercicioConAyuda : XP.ejercicio;
}

/** XP of a day whose goal was met, with `racha` days of streak including it. */
export function xpObjetivo(racha: number): number {
  return XP.objetivo + XP.rachaExtra * Math.min(XP.rachaTope, Math.max(0, racha - 1));
}

/**
 * Level names: milestones of the book's own path, from the first spark to the full laboratory. Past the
 * last one the name stays and only the number grows.
 */
export const NOMBRES_NIVEL = [
  'Chispa',
  'Corriente continua',
  'Ley de Ohm',
  'Divisor de tensión',
  'Diodo',
  'Transistor',
  'Amplificador',
  'Operacional',
  'Oscilador',
  'Filtro activo',
  'Lógica digital',
  'Microcontrolador',
  'Fuente conmutada',
  'Radiofrecuencia',
  'Placa de cuatro capas',
  'Sistema embebido',
  'Lazo de control',
  'Radio definida por software',
  'Integridad de señal',
  'Laboratorio completo',
] as const;

/** XP needed to reach level n (n ≥ 1): 0, 100, 250, 450, 700, 1000, 1350… (each level 50 XP longer). */
export function umbralNivel(n: number): number {
  const k = Math.max(1, Math.floor(n));
  return 25 * (k - 1) * (k + 2);
}

export function nombreNivel(n: number): string {
  const k = Math.max(1, Math.floor(n));
  return NOMBRES_NIVEL[Math.min(k, NOMBRES_NIVEL.length) - 1]!;
}

export interface Nivel {
  nivel: number;
  nombre: string;
  /** XP at the start of this level and of the next one. */
  desde: number;
  hasta: number;
  /** Progress inside the level, 0–1. */
  fraccion: number;
  /** XP still needed for the next level. */
  falta: number;
}

/** The level for a total of XP. */
export function nivelDe(xp: number): Nivel {
  const total = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  // inverse of 25(n−1)(n+2) = xp, then corrected for rounding
  let n = Math.max(1, Math.floor((-1 + Math.sqrt(9 + (4 * total) / 25)) / 2) + 1);
  while (umbralNivel(n + 1) <= total) n++;
  while (n > 1 && umbralNivel(n) > total) n--;
  const desde = umbralNivel(n);
  const hasta = umbralNivel(n + 1);
  return { nivel: n, nombre: nombreNivel(n), desde, hasta, fraccion: (total - desde) / (hasta - desde), falta: hasta - total };
}
