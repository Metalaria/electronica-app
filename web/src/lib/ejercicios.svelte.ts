// The self-checking data of exercises and problems (web/public/libro/ejercicios.json, written by
// contenido/ejercicios.py; see ESQUEMA.md «Ejercicios autocomprobables»). Fetched lazily, the first time
// a part with exercises or problems, the «Ejercicios» page or the start page needs it.

import { leerJSON } from './datos';
import type { Esperado } from './magnitudes';
import type { Pregunta } from './preguntas-ejercicio';
import type { BEjercicios, Bloque, Parte } from './tipos';

export type ClaseRespuesta = 'numerico' | 'eleccion' | 'texto' | 'deduccion' | 'diseno' | 'razonamiento' | 'sin-solucion';

export interface Respuesta extends Esperado {
  id: string;
  /** HTML: what is asked («Resistencia limitadora R»). */
  nombre: string;
  alternativas: Esperado[];
}

export interface ItemEjercicio {
  tipo: 'ej' | 'prob';
  parte: string;
  num: string;
  seccion: string | null;
  /**
   * Exercises: [index of the `ejercicios` block in the part, index of the item].
   * Problems: [index of the h3, index of the «Se pide» paragraph, index after the last block].
   */
  pos: number[];
  /** 'auto': numeric answers or structured questions checked by the app; 'comparar': self-assessed. */
  modo: 'auto' | 'comparar';
  clase: ClaseRespuesta;
  respuestas: Respuesta[];
  /** 1.0: structured questions checked by the app (choice, order, classification…; lib/preguntas-ejercicio.ts). */
  preguntas?: Pregunta[];
  /**
   * Parts of the question that are not checked automatically (HTML): the reader writes the answer, compares it with
   * the book's solution and this list, and rates it.
   */
  otras?: { clase: ClaseRespuesta; texto: string }[];
  /** Progressive hints (HTML): the approach, then an intermediate result. */
  pistas: string[];
  /** Problems: their title. */
  titulo?: string;
  /** Plain-text start of the statement, for lists. */
  resumen?: string;
  nota?: string;
  /** A mistake of the book's solution found while preparing the answers. */
  errata?: string;
  /** 1.1: a datum the book's solution uses and its statement does not give (HTML; shown next to «Se pide»). */
  dato?: string;
  origen: 'auto' | 'curado' | 'ampliacion';
  /**
   * 1.1: a new exercise the book does not have yet (contenido/ejercicios_nuevos11/, «Aún no en el libro»): it carries its
   * own statement and solution (`pos` is empty) and, optionally, the test-bench practice to measure it on.
   */
  nuevo?: boolean;
  /**
   * 1.1: an exercise or problem of a book expansion (contenido/ampliaciones11/, «Aún no en el libro»): unlike `nuevo`,
   * its statement and solution are in the part, like the book's (`pos` points to them).
   */
  ampliacion?: string;
  /**
   * Review 11a: 1.0 graded it by comparison (a written text, self-assessed) and 1.1 checks it by itself
   * (contenido/autoevaluados10.json): a 1.0 exam answer to it is still graded as an open part (docente/examen.ts).
   */
  comparar10?: boolean;
  enunciado?: Bloque[];
  solucion?: Bloque[];
  banco?: { practica: number; texto: string };
}

export interface DatosEjercicios {
  version: number;
  items: Record<string, ItemEjercicio>;
  capitulos: { parte: string; items: string[] }[];
}

export const ejercicios = $state({
  datos: null as DatosEjercicios | null,
  error: '',
});

let carga: Promise<DatosEjercicios | null> | null = null;
/** part → index of its «Se pide» paragraph → problem label */
let problemasPorParte = new Map<string, Map<number, string>>();

export function cargarEjercicios(): Promise<DatosEjercicios | null> {
  carga ??= leerJSON<DatosEjercicios>('ejercicios.json')
    .then((d) => {
      const m = new Map<string, Map<number, string>>();
      for (const [label, it] of Object.entries(d.items)) {
        if (it.tipo !== 'prob' || it.pos[1] == null) continue;
        let p = m.get(it.parte);
        if (!p) m.set(it.parte, (p = new Map()));
        p.set(it.pos[1], label);
      }
      problemasPorParte = m;
      ejercicios.datos = d;
      return d;
    })
    .catch((e: unknown) => {
      ejercicios.error = e instanceof Error ? e.message : String(e);
      return null;
    });
  return carga;
}

export function item(label: string | null | undefined): ItemEjercicio | undefined {
  return label ? ejercicios.datos?.items[label] : undefined;
}

/** The problem whose «Se pide» paragraph is block `indice` of a part. */
export function problemaEn(parte: string, indice: number): string | undefined {
  void ejercicios.datos;
  return problemasPorParte.get(parte)?.get(indice);
}

/**
 * The statement and the solution of an exercise or problem: from its part (the book's) or, for a new exercise, its own.
 * Null when the part does not have it where `pos` says.
 */
export function bloquesEjercicio(it: ItemEjercicio, p: Parte | null | undefined): { enunciado: Bloque[]; solucion: Bloque[] } | null {
  if (it.nuevo) return { enunciado: it.enunciado ?? [], solucion: it.solucion ?? [] };
  if (!p) return null;
  if (it.tipo === 'ej') {
    const b = p.bloques[it.pos[0] ?? -1] as BEjercicios | undefined;
    const e = b?.t === 'ejercicios' ? b.items[it.pos[1] ?? -1] : undefined;
    return e ? { enunciado: e.bloques, solucion: e.solucion ?? [] } : null;
  }
  const [h, pide, fin] = it.pos as [number, number, number];
  return { enunciado: p.bloques.slice(h + 1, pide + 1), solucion: p.bloques.slice(pide + 1, fin) };
}

/** 1.1: a part's new exercises (not in the book yet), in order, as the reader's «Ejercicios» block shows them. */
export function nuevosDeParte(parte: string): BEjercicios | null {
  const d = ejercicios.datos;
  if (!d) return null;
  const items = itemsDeParte(parte)
    .map((l) => [l, d.items[l]] as const)
    .filter(([, it]) => it?.nuevo)
    .map(([l, it]) => ({ label: l, num: it!.num, bloques: it!.enunciado ?? [], solucion: it!.solucion ?? [] }));
  return items.length ? { t: 'ejercicios', items } : null;
}

/** Labels of a part's exercises and problems, in book order. */
export function itemsDeParte(parte: string): string[] {
  return ejercicios.datos?.capitulos.find((c) => c.parte === parte)?.items ?? [];
}

export const NOMBRE_CLASE: Record<ClaseRespuesta, string> = {
  numerico: 'resultado numérico',
  eleccion: 'elección',
  texto: 'respuesta breve',
  deduccion: 'deducción',
  diseno: 'diseño',
  razonamiento: 'razonamiento',
  'sin-solucion': 'sin solución en el libro',
};
