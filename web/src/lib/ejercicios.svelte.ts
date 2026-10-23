// The self-checking data of exercises and problems (web/public/libro/ejercicios.json, written by
// contenido/ejercicios.py; see ESQUEMA.md «Ejercicios autocomprobables»). Fetched lazily, the first time
// a part with exercises or problems, the «Ejercicios» page or the start page needs it.

import { leerJSON } from './datos';
import type { Esperado } from './magnitudes';

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
  /** 'auto': numeric answers checked by the app; 'comparar': the reader compares with the solution. */
  modo: 'auto' | 'comparar';
  clase: ClaseRespuesta;
  respuestas: Respuesta[];
  /** Parts of the question that are not numeric (HTML), to compare with the solution. */
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
  origen: 'auto' | 'curado';
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
