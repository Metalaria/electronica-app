// Circuits of the book behind «Predice y comprueba» and the slider questions (0.10): the netlist of a figure's
// simulable schematic (figuras-vivas/esquema/netlist.ts, the generator's own rules) or a book netlist reduced to
// its operating point, with one value changed, and the reading of what is observed. Plain TypeScript: the
// generator runs it in Node with the same WebAssembly ngspice the app uses in its worker.

import type { Grafica } from '../../simulador/motor/nucleo.ts';
import type { Simulacion } from '../../simulador/motor/simular.ts';
import { aplicarParametro } from '../../simulador/motor/netlist.ts';
import { generarNetlist, type MetaNetlist } from '../figuras-vivas/esquema/netlist.ts';
import { leerOp } from '../figuras-vivas/esquema/resultado.ts';
import type { Esquema, ResultadoOp } from '../figuras-vivas/tipos.ts';
import type { Observable } from './tipos.ts';

/** A figure schematic's netlist with one element value changed, and only its operating point. */
export function netlistFigura(esq: Esquema, cambio: { id: string; valor: number } | null): { texto: string; meta: MetaNetlist } {
  const { texto, meta } = generarNetlist(esq, cambio ? { valor: { [cambio.id]: cambio.valor } } : {});
  return { texto: texto + '.control\nop\n.endc\n.end\n', meta };
}

/**
 * A book netlist reduced to its DC operating point: the analyses, measurements and the .control block are
 * dropped, `.op` and `.options savecurrents` (device currents as @x[i] vectors) are added.
 */
export function netlistLibroOp(texto: string, cambio: { id: string; valor: number } | null): string {
  let t = cambio ? aplicarParametro(texto, cambio.id, cambio.valor) : texto;
  const lineas = t.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let enControl = false;
  let continuaQuitada = false;
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i]!;
    const s = l.trim().toLowerCase();
    if (i > 0 && /^\.control\b/.test(s)) {
      enControl = true;
      continue;
    }
    if (enControl) {
      if (/^\.endc\b/.test(s)) enControl = false;
      continue;
    }
    if (s.startsWith('+') && continuaQuitada) continue;
    continuaQuitada = false;
    if (i > 0 && /^\.(op|tran|ac|dc|noise|tf|pz|sens|four|disto|sp|pss|meas|measure|print|plot|probe|save|end)\b/.test(s)) {
      continuaQuitada = true;
      continue;
    }
    out.push(l);
  }
  out.push('.options savecurrents', '.op', '.end');
  t = out.join('\n') + '\n';
  return t;
}

/** The operating-point plot of a run. */
export function graficaOp(sim: Simulacion): Grafica | null {
  return sim.ejecucion.graficas.find((g) => /operating/i.test(g.analisis)) ?? null;
}

/** A figure schematic's results from its run. */
export function resultadoFigura(esq: Esquema, meta: MetaNetlist, sim: Simulacion): ResultadoOp | null {
  const g = graficaOp(sim);
  return g ? leerOp(esq, meta, g) : null;
}

/** The observed quantity in a figure schematic's operating point. */
export function leerEnFigura(op: ResultadoOp, o: Observable): number | null {
  if (o.k === 'nodo') return op.nodos[o.id] ?? null;
  const e = op.elementos[o.id];
  if (!e) return null;
  return (o.k === 'corriente' ? e.corriente : e.tension) ?? null;
}

/** Vectors of an op plot by lower-case name. */
export function vectoresOp(g: Grafica): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of g.vectores) {
    const x = v.re[0];
    if (x != null && Number.isFinite(x)) m.set(v.nombre.toLowerCase(), x);
  }
  return m;
}

/** The observed quantity in a book netlist's operating point. */
export function leerEnNetlist(m: Map<string, number>, o: Observable): number | null {
  const v = (n: string) => (n === '0' || n === 'gnd' ? 0 : (m.get(`v(${n})`) ?? m.get(n) ?? null));
  if (o.k === 'nodo') return v(o.id.toLowerCase());
  if (o.k === 'tension' && o.nodos) {
    const a = v(o.nodos[0].toLowerCase());
    const b = v(o.nodos[1].toLowerCase());
    return a == null || b == null ? null : a - b;
  }
  if (o.k === 'corriente' && o.vector) return m.get(o.vector.toLowerCase()) ?? null;
  return null;
}

/** «sube», «baja» or «igual» (a change smaller than 1 % of the larger value, or than 1 µV / 1 nA, is «igual»). */
export function sentido(antes: number, despues: number, unidad: 'V' | 'A'): 'sube' | 'baja' | 'igual' {
  const piso = unidad === 'V' ? 1e-6 : 1e-9;
  const d = despues - antes;
  if (Math.abs(d) <= Math.max(piso, 0.01 * Math.max(Math.abs(antes), Math.abs(despues)))) return 'igual';
  // Magnitudes: a current or voltage that grows in absolute value «sube» whatever its sign convention.
  return Math.abs(despues) > Math.abs(antes) ? 'sube' : 'baja';
}
