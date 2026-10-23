// Builds the worker's answer (both SVGs and the topology) from a generated schematic.

import type { EsquemaAuto } from './generar.ts';
import { HUECO_FUENTES, type ResultadoEsquema } from './resultado.ts';
import { svgEsquema } from './svg.ts';

export function construirResultado(a: EsquemaAuto): ResultadoEsquema {
  return {
    svgLibro: svgEsquema(a, { paleta: 'libro', fuentes: HUECO_FUENTES }),
    svgTema: svgEsquema(a, { paleta: 'tema', interactivo: true }),
    vista: a.vista,
    esquema: a.esquema,
    correspondencia: a.correspondencia,
    flujo: a.flujo,
    estadisticas: a.estadisticas,
    subckts: [...a.circuito.subckts.values()].map((s) => ({ nombre: s.nombre, puertos: s.puertos })),
    ignoradas: a.circuito.ignoradas,
    subckt: a.circuito.subckt,
  };
}
