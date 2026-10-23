// Live figures: interactive plots and live schematics over the book's figures (see ESQUEMA.md).

import type { BFigura } from '../../lib/tipos';
import type { Caja } from './tipos';

/** Fields of a figure block that the pipeline adds for plots and schematics (ESQUEMA.md, «figura»). */
interface FiguraConDatos extends BFigura {
  tipo_figura?: string;
  svg_vista?: number[];
  datos?: string;
}

/** Data file and viewBox of a figure that can be made live, or null. */
export function datosVivos(b: BFigura): { ruta: string; vista: Caja; tipo: 'grafica' | 'esquema' } | null {
  const f = b as FiguraConDatos;
  if (!f.datos || !f.svg_vista || f.svg_vista.length !== 4) return null;
  if (f.tipo_figura !== 'grafica' && f.tipo_figura !== 'esquema') return null;
  return { ruta: f.datos, vista: f.svg_vista as Caja, tipo: f.tipo_figura };
}
