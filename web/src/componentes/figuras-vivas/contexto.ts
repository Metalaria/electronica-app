// Context a lesson («Estudiar por pasos») sets so its live figures know they are in a lesson (0.11, group B): a
// simulable DC schematic then shows the «explore» row (esquema/ExploraEsquema.svelte). The lesson loads the list of
// explorable schematics (libro/explorables.json, web/scripts/conceptos11.mjs) before showing a step, so the figure
// keeps the row's room from the first frame while its data load: nothing pushes the text afterwards.

import { leerJSON } from '../../lib/datos';

export const CONTEXTO_LECCION = Symbol('epa:leccion');

export interface ContextoLeccion {
  parte: string;
  seccion: string;
  /** `datos/NAME.json` → indices of its explorable schematics (empty until loaded). */
  explorables: Record<string, number[]>;
}

let carga: Promise<Record<string, number[]>> | null = null;

/** The explorable schematics (cached; an empty list when the file is missing). */
export function cargarExplorables(): Promise<Record<string, number[]>> {
  carga ??= leerJSON<{ version: number; esquemas: Record<string, number[]> }>('explorables.json')
    .then((d) => d.esquemas ?? {})
    .catch(() => {
      carga = null;
      return {};
    });
  return carga;
}
