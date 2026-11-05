// The size of the drawing a book netlist will show (0.12 QA), precomputed by scripts/circuitos-proporciones.mjs, so the
// simulator page (CircuitoVivo) and the instruments bench (Banco) keep exactly its place while the drawing is decided:
// a fixed 16:9 or 5:2 place moved everything under a much wider or taller drawing up to 300 px when it came.
import tabla from './proporciones.json';
import { aspectoPantalla } from '../../esquema-auto/aspecto';

type Tamano = [number, number];
type Entrada = { l?: Tamano; a: Tamano | null | Record<string, Tamano | null> };

/**
 * [width, height] of the drawing of netlist `id` on the simulator page («pagina»: the book figure when it matches, else
 * the automatic schematic) or on the bench («banco»: always the automatic one); null when there is nothing to draw;
 * undefined when unknown (an edited netlist, an entry missing): the caller keeps its generic place.
 */
export function tamanoDibujo(id: string, de: 'pagina' | 'banco'): Tamano | null | undefined {
  const e = (tabla as unknown as Record<string, Entrada | undefined>)[id];
  if (!e) return undefined;
  if (de === 'pagina' && e.l) return e.l;
  const a = e.a;
  if (a === null || Array.isArray(a)) return a;
  return a[String(aspectoPantalla())];
}
