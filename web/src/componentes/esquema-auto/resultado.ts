// What crosses the worker boundary: the drawing as two SVG strings (book palette for pictures, theme palette
// for inline use), the topology and its netlist mapping. Plain data (structured clone).

import type { Correspondencia, Esquema } from '../figuras-vivas/tipos';
import type { EsquemaAuto, Estadisticas } from './generar.ts';

/** Placeholder in `svgLibro` where the embedded @font-face rules go. */
export const HUECO_FUENTES = '/*@fuentes*/';

export interface ResultadoEsquema {
  /** Book colours (for an <img> on the figure plate); fonts to be embedded at HUECO_FUENTES. */
  svgLibro: string;
  /** Theme colours (CSS variables), with data-el / data-disp attributes and hit areas for clicks. */
  svgTema: string;
  vista: [number, number, number, number];
  esquema: Esquema;
  correspondencia: Correspondencia;
  flujo: EsquemaAuto['flujo'];
  estadisticas: Estadisticas;
  /** Subcircuits defined in the netlist (their interior can be drawn on request). */
  subckts: { nombre: string; puertos: string[] }[];
  /** Lines that could not be drawn. */
  ignoradas: { linea: number; texto: string; motivo: string }[];
  /** Subcircuit drawn, or null for the main circuit. */
  subckt: string | null;
}

export interface PeticionEsquema {
  id: number;
  texto: string;
  subckt?: string | null;
  aspecto?: number;
}

export type RespuestaEsquema = { id: number; ok: true; resultado: ResultadoEsquema | null } | { id: number; ok: false; error: string };

