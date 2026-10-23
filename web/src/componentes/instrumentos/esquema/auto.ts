// Drawing of an arbitrary netlist with the automatic schematic generator (web/src/componentes/esquema-auto/,
// another part of the app). It is looked up lazily and by name (import.meta.glob), so the bench builds and
// works without it: when it is missing or fails, the bench falls back to the list of nodes.

import type { Esquema } from '../../figuras-vivas/tipos';

export interface DibujoAuto {
  /** SVG markup in theme colours (CSS variables). */
  svg: string;
  vista: [number, number, number, number];
  esquema: Esquema;
  /** Drawing node id («N3») → netlist node («out»). */
  mapa: Record<string, string>;
}

interface ResultadoGenerador {
  svgTema: string;
  vista: [number, number, number, number];
  esquema: Esquema;
  correspondencia?: { nodos: Record<string, string> };
}

const modulos = import.meta.glob('../../esquema-auto/index.ts');

export async function esquemaAutomatico(netlist: string): Promise<DibujoAuto | null> {
  const cargar = Object.values(modulos)[0];
  if (!cargar) return null;
  try {
    const m = (await cargar()) as Record<string, unknown>;
    const fn = m.esquemaAutomatico as ((t: string) => Promise<ResultadoGenerador | null>) | undefined;
    if (typeof fn !== 'function') return null;
    const r = await fn(netlist);
    if (!r || !r.esquema || !Array.isArray(r.esquema.nodos) || typeof r.svgTema !== 'string') return null;
    return { svg: r.svgTema, vista: r.vista, esquema: r.esquema, mapa: r.correspondencia?.nodos ?? {} };
  } catch {
    return null;
  }
}
