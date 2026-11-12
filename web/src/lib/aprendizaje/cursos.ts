// Thematic courses (0.11): the book's chapters grouped by subject, as approved by the owner. A course is an
// ordered list of chapters (part ids `capNN` of the generated content — the file numbering, not the printed one: cap15
// is «Capítulo 14», and the chapters new since 4.0 have the next free numbers, cap55 «Capítulo 31», cap56 «Capítulo 34»,
// cap57 «Capítulo 54»); its lessons are the sections (h2) of those chapters, in order, each one a lesson. A course may
// also list an appendix (apK) whose sections are lessons too.
// Pure module (types only): the tests import it to check that every chapter is mapped.

import type { Indice, Seccion } from '../tipos';

export interface Curso {
  id: string;
  nombre: string;
  /** One line under the name. */
  descripcion: string;
  /** Part ids, in the order they are studied (easy → hard). */
  partes: string[];
}

const cap = (...ns: (number | [number, number])[]): string[] =>
  ns.flatMap((n) => (Array.isArray(n) ? Array.from({ length: n[1] - n[0] + 1 }, (_, k) => n[0] + k) : [n])).map((n) => `cap${String(n).padStart(2, '0')}`);

/** The approved table (numbers are the part ids capNN). */
export const CURSOS: Curso[] = [
  { id: 'fundamentos', nombre: 'Fundamentos', descripcion: 'Matemáticas, electricidad y los componentes básicos: resistencias, condensadores, bobinas, diodos y transistores.', partes: cap([0, 6]) },
  { id: 'analisis', nombre: 'Análisis de circuitos', descripcion: 'Métodos formales, transitorios y alterna, cuadripolos y simulación con SPICE.', partes: cap(23, 24, 25, 42) },
  { id: 'analogica', nombre: 'Electrónica analógica', descripcion: 'MOSFET, integrados analógicos, el operacional, osciladores, ruido, amplificadores discretos y un amplificador de audio completo.', partes: cap(7, 8, 26, 27, 28, 32, 43, 51) },
  // (the two chapters new in 4.0 where the book places them: the PLCs (cap55) after control and communications, the
  // electric machines (cap56) right after power electronics — 1.1 called them cap-new-automatas and cap-new-maquinas,
  // and lib/esquemas.ts migrates the stored progress. 1.2: appendix K, C for embedded systems, closes the digital
  // course, after the embedded systems of cap38, which now include the assembler section 39.16)
  { id: 'digital', nombre: 'Digital y programable', descripcion: 'Lógica, secuencias, automatismos y autómatas programables, conversión de datos, FPGA, sistemas embebidos, ensamblador, C para sistemas empotrados y buses.', partes: [...cap(9, 29, 55, 34, 37, 38, 44), 'apK'] },
  { id: 'potencia', nombre: 'Potencia y energía', descripcion: 'Componentes de potencia, convertidores, máquinas eléctricas y accionamientos, baterías y una fuente de alimentación completa.', partes: cap(10, 33, 56, 39, 50) },
  { id: 'senales', nombre: 'Señales, RF y comunicaciones', descripcion: 'Señales y sistemas, control y comunicaciones, radiofrecuencia, optoelectrónica y una radio definida por software.', partes: cap(30, 31, 36, 45, 52) },
  { id: 'sensores', nombre: 'Sensores y microcontroladores', descripcion: 'Arduino, Raspberry Pi, sensores, acondicionamiento de señal y una estación de medida.', partes: cap([17, 20], 35, 49) },
  { id: 'taller', nombre: 'Taller e instrumentos', descripcion: 'Esquemas, soldadura, protoboard, el osciloscopio, instrumentación y reparación.', partes: cap([11, 13], 15, 21, 22, 47, 53) },
  { id: 'placas', nombre: 'Diseño de placas', descripcion: 'Circuito impreso avanzado, integridad de señal y diseño para fabricación.', partes: cap(40, 41, 46) },
  // (1.2: the robotics chapter of 4.1, cap57, printed 54 after the SDR, only here: it is a whole system — arms and
  // mobile robots, kinematics, drives, sensors and programming — rather than power electronics)
  { id: 'proyectos', nombre: 'Proyectos completos', descripcion: 'El receptor de radio, los cuatro proyectos detallados, la electrónica de un robot y la ingeniería inversa.', partes: cap(16, [48, 52], 57, 54) },
];

export const CURSO = new Map(CURSOS.map((c) => [c.id, c]));

export interface LeccionCurso extends Seccion {
  parte: string;
}

/** The lessons of a course, in order (the sections of its chapters as the index lists them). */
export function leccionesDeCurso(c: Curso, indice: Indice): LeccionCurso[] {
  return c.partes.flatMap((p) => (indice.partes[p]?.secciones ?? []).map((s) => ({ ...s, parte: p })));
}

/**
 * The courses a chapter belongs to. The four detailed projects (cap49–cap52) are in two: their topic course and
 * «Proyectos completos» (owner's decision in 0.11: IoT → sensores, power supply → potencia, hi-fi → analógica,
 * SDR → señales).
 */
export function cursosDeParte(parte: string): Curso[] {
  return CURSOS.filter((c) => c.partes.includes(parte));
}

/** Placement test size: one question per chapter, at least 6 and at most 10. */
export function preguntasPrueba(capitulos: number): number {
  return Math.min(10, Math.max(6, capitulos));
}

/** Questions of the placement test per chapter, in the course's order: as even as possible, extras to the first. */
export function repartoPrueba(capitulos: number): number[] {
  if (capitulos <= 0) return [];
  const n = preguntasPrueba(capitulos);
  // more than 10 chapters: the first 10 get one each (no course has that many today)
  if (capitulos > n) return Array.from({ length: capitulos }, (_, i) => (i < n ? 1 : 0));
  const base = Math.floor(n / capitulos);
  const extra = n % capitulos;
  return Array.from({ length: capitulos }, (_, i) => base + (i < extra ? 1 : 0));
}

export interface Verificacion {
  /** Chapters of the content that no course includes. */
  sinCurso: string[];
  /** Part ids in the table that the content does not have. */
  inexistentes: string[];
  /** Part ids in more than one course, with their courses. */
  repetidos: Record<string, string[]>;
  /** Appendices and back matter (not chapters), for the record. */
  otras: string[];
}

/** Checks the table against the content's index. */
export function verificarCursos(indice: Indice): Verificacion {
  const usados = new Map<string, string[]>();
  for (const c of CURSOS) for (const p of c.partes) usados.set(p, [...(usados.get(p) ?? []), c.id]);
  const capitulos = Object.entries(indice.partes)
    .filter(([, i]) => i.tipo === 'capitulo')
    .map(([id]) => id);
  return {
    sinCurso: capitulos.filter((p) => !usados.has(p)),
    inexistentes: [...usados.keys()].filter((p) => !indice.partes[p]),
    repetidos: Object.fromEntries([...usados].filter(([, cs]) => cs.length > 1)),
    otras: Object.entries(indice.partes)
      .filter(([, i]) => i.tipo !== 'capitulo')
      .map(([id]) => id),
  };
}
