// «Modo docente» (1.0): the reader's own courses and exams built from the book's sections, exercises, problems and
// Repaso questions, and the results of the exams taken in the app. Plain types (no DOM: also used by the tests in
// Node). Stored by lib/docente/estado.svelte.ts; see ESQUEMA.md «Modo docente».

/** A piece of a course, in the order it is studied. */
export type ElementoCurso =
  /** A section of the book (an h2), studied as a lesson «Estudiar por pasos». */
  | { k: 'seccion'; parte: string; label: string }
  /** An exercise or problem of the book (ejercicios.json label). */
  | { k: 'ejercicio'; label: string }
  /** A Repaso question (its id, «cap05-03»). */
  | { k: 'pregunta'; id: string };

/** One item of an exam: an exercise or problem (label) or a Repaso question (id), with its points. */
export interface ItemExamen {
  k: 'ejercicio' | 'pregunta';
  ref: string;
  puntos: number;
}

/** Space left for the answers in the printed exam. */
export type EspacioRespuesta = 'no' | 'corto' | 'largo';

/** How the items were chosen (kept so that «Volver a elegir» repeats the same filters). */
export interface FiltrosExamen {
  partes: string[];
  /** Sections («<parte>/<label>»); empty: any. */
  conceptos: string[];
  /** Kinds: ejercicio, problema, pregunta (test question). */
  tipos: ('ejercicio' | 'problema' | 'pregunta')[];
  /** Only what the app checks by itself. */
  soloAuto: boolean;
  cantidad: number;
}

export interface DefinicionCurso {
  elementos: ElementoCurso[];
}

export interface DefinicionExamen {
  items: ItemExamen[];
  /** Total time in minutes (0: no limit). */
  minutos: number;
  /** Numeric exercises that a formula reproduces get other values (the «valores que cambian» generator). */
  variantes: boolean;
  /** Shuffle the order of the items and the options of the choice questions. */
  barajar: boolean;
  /** Seed of the variant (an exam with the same seed is the same exam, on screen and in the PDF). */
  semilla: number;
  espacio: EspacioRespuesta;
  filtros?: FiltrosExamen;
}

interface PropioBase {
  id: string;
  titulo: string;
  notas: string;
  creado: number;
  actualizado: number;
  /** Soft delete (a tombstone that travels with the synchronisation). */
  borrado?: number;
  version: 1;
}
export interface CursoPropio extends PropioBase {
  tipo: 'curso';
  curso?: DefinicionCurso;
}
export interface ExamenPropio extends PropioBase {
  tipo: 'examen';
  examen?: DefinicionExamen;
}
export type Propio = CursoPropio | ExamenPropio;

/** What an item of a taken exam got. */
/** 'pendiente': an open part still to be self-assessed against the book's development. */
export type EstadoItem = 'bien' | 'parcial' | 'mal' | 'blanco' | 'pendiente';

export interface ResultadoItem {
  k: 'ejercicio' | 'pregunta';
  ref: string;
  puntos: number;
  maximo: number;
  /** What was answered (the same keys as EstadoEjercicio.valores; a question: `r` the option index or the number). */
  valores: Record<string, string>;
  estado: EstadoItem;
  /** The variant number of a numeric exercise with changing values (absent: the book's values). */
  variante?: number;
  /** The reader's self-assessment of the open part (1, 0,5 or 0), once given. */
  autoeval?: number;
  /** As it was shown: a test question's option order, an exercise's choice questions' option orders. */
  orden?: number[];
  opciones?: Record<string, number[]>;
  /** Review 10h: the variant's values, statement and expected answer as the attempt saw them. */
  vv?: import('./examen').VarianteGuardada;
  /** Review 10h: when its self-assessment was given (two devices: the newest per question wins). */
  autoevalT?: number;
}

export interface Resultado {
  id: string;
  /** The exam (Propio id) it was taken from. */
  examen: string;
  titulo: string;
  semilla: number;
  inicio: number;
  /** When it was finished (ms). */
  t: number;
  actualizado: number;
  borrado?: number;
  puntos: number;
  maximo: number;
  items: ResultadoItem[];
  /** Which variant of the exam (0 = A). */
  variante?: number;
  /** Review 10h: the attempt's own time limit (minutes; 0 none). */
  minutos?: number;
  /**
   * Review 10h: items of the attempt that could not be graded (no longer in the book): their answers, kept with the
   * result. Not counted in `maximo`.
   */
  sinCorregir?: { k: 'ejercicio' | 'pregunta'; ref: string; maximo: number; valores: Record<string, string> }[];
  /** The time ran out. */
  agotado?: boolean;
}
