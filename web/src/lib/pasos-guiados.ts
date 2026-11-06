// 1.0 «Resolver paso a paso»: the guided steps of an exercise (web/public/libro/pasos.json, written by
// contenido/pasos.py from the steps reviewed by hand in contenido/pasos_curado.json; ESQUEMA.md «Paso a paso»).
// Read-only content, fetched the first time an exercise panel needs it. Nothing about the guided mode is stored:
// entering it counts as using the exercise's hints (aprendizaje.usarPista), so a later solve is «with help».
import { leerJSON } from './datos';
import type { Esperado } from './magnitudes';

interface PasoBase {
  /** HTML: the short question of this step. */
  pregunta: string;
  /** HTML: the book's sentence this step comes from, shown once the step is settled. */
  explicacion: string;
  /** HTML: an optional hint. */
  pista?: string;
}
export interface PasoNumerico extends PasoBase {
  tipo: 'numerico';
  /** HTML: the quantity asked («R<sub>2</sub>»). */
  nombre: string;
  respuesta: Esperado;
  alternativas: Esperado[];
}
export interface PasoEleccion extends PasoBase {
  tipo: 'eleccion';
  opciones: string[];
  correcta: number;
  /** Option index → HTML: why that wrong option is not it. */
  porque: Record<string, string>;
}
export type PasoGuiado = PasoNumerico | PasoEleccion;

export interface DatosPasos {
  version: 1;
  items: Record<string, { pasos: PasoGuiado[] }>;
  total: number;
  pasos: number;
}

let carga: Promise<DatosPasos | null> | null = null;

/** The guided steps of every exercise that has them (null if the file cannot be read: no guided mode). */
export function cargarPasos(): Promise<DatosPasos | null> {
  carga ??= leerJSON<DatosPasos>('pasos.json').catch(() => {
    carga = null;
    return null;
  });
  return carga;
}
