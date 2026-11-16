// 1.2.1 (motor121): what the instrument of a live circuit reads when the page cannot solve the schematic by itself
// (GUIA §13.1). A linear DC circuit is solved in the page (lib/leccion12/cc.ts, instantly). Anything else is run on
// the app's own ngspice — the same WebAssembly the generator's --comprobar runs in Node, with the same netlist —:
//   - a non-linear DC circuit (diodes, LEDs, Zeners, transistors, MOSFETs, op-amps with rails, regulators…): the
//     operating point («.op»): every node's voltage and the current of every V source (its 0 V meters);
//   - a circuit that changes with time (its graph's curves are transients: a rectifier, an RC charge, a 555): the
//     multimeter reads the average over the graph's time window, as a real meter on V⎓ settles on the mean, and the
//     oscilloscope shows the probed node's waveform from the same run.
// The request (`peticionMedida`) and the reading of the simulator's plots (`solucionDeGraficas`, `ondaDe`) are pure:
// the generator builds the same request to check the model against what the page will show (generar-hacer.ts). Only
// `medirConSpice` runs the simulator (in the page, through simulador/cliente.svelte.ts), and it keeps the last
// solutions by netlist so the card's verdict (motor-hacer.ts) can quote the reading without waiting.

import { esLineal, type SolucionCC } from '../cc';
import { esquemaDe } from '../../leccion11/esquemas/registro';
import { contextoNetlist, montarNetlist, promedioMedida, tarjetaGrafica, type GraficaSim } from '../../leccion11/spice';
import type { DefinicionEsquema } from '../../leccion11/esquemas/tipos';
import type { Valores } from '../../leccion11/modelo';
import type { WidgetCircuito } from '../../leccion11/tipos';

export interface PeticionMedida {
  /** The netlist itself (what the cache is keyed by). */
  netlist: string;
  /** op: the DC operating point; tran: a transient over the graph's axis (average and waveforms). */
  analisis: 'op' | 'tran';
  /** tran: the window the multimeter averages over (simulated time: the axis plus `desfase`). */
  desde?: number;
  hasta?: number;
  /** tran: simulated time before the axis starts (whole periods of «f»), taken off the waveforms' time. */
  desfase?: number;
}

/** The schematic's DC netlist in this state, or null (no schematic, or it does not build). */
export function lineasOp(def: DefinicionEsquema, w: Pick<WidgetCircuito, 'piezas'>, r: Valores): string[] | null {
  try {
    return def.netlist(contextoNetlist(w, r), 'op');
  } catch {
    return null;
  }
}

/**
 * What has to be simulated to read the instrument in this state; null when the page solves it by itself (a linear DC
 * circuit without a transient graph) or there is nothing to simulate.
 */
export function peticionMedida(w: Pick<WidgetCircuito, 'esquema' | 'piezas' | 'grafica'>, r: Valores, def: DefinicionEsquema | undefined = esquemaDe(w.esquema)): PeticionMedida | null {
  if (!def) return null;
  const c = contextoNetlist(w, r);
  const tg = tarjetaGrafica(def, w, c);
  if (tg?.analisis === 'tran' && w.grafica) {
    try {
      return { netlist: montarNetlist(def, c, 'tran', tg.tarjeta), analisis: 'tran', desde: tg.desfase + w.grafica.x.min, hasta: tg.desfase + w.grafica.x.max, desfase: tg.desfase };
    } catch {
      return null;
    }
  }
  const lineas = lineasOp(def, w, r);
  if (!lineas || esLineal(lineas)) return null;
  return { netlist: montarNetlist(def, c, 'op', '.op'), analisis: 'op' };
}

/** Whether this widget's instrument reads from the simulator (in some state: the schematic and graph decide). */
export function instrumentoSimulado(w: Pick<WidgetCircuito, 'esquema' | 'piezas' | 'grafica'>, r: Valores): boolean {
  return !!peticionMedida(w, r);
}

const PATRON = { op: /operating/i, tran: /transient/i };

/** Node voltages and branch currents from the simulator's plots: the operating point, or each one's average. */
export function solucionDeGraficas(p: PeticionMedida, graficas: readonly GraficaSim[]): SolucionCC | null {
  const g = graficas.find((x) => PATRON[p.analisis].test(x.analisis));
  if (!g) return null;
  const out: SolucionCC = { nodos: { '0': 0 }, corrientes: {} };
  for (const v of g.vectores) {
    const m = /^([vi])\(([^)]+)\)$/i.exec(v.nombre.trim());
    if (!m) continue;
    const valor = p.analisis === 'op' ? Number(v.re[0]) : promedioMedida(g, v.nombre.toLowerCase(), p.desde!, p.hasta!);
    if (valor == null || !Number.isFinite(valor)) continue;
    const k = m[2]!.toLowerCase().replace(/#branch$/, '');
    if (m[1]!.toLowerCase() === 'v') out.nodos[k] = valor;
    else out.corrientes[k] = valor;
  }
  return out;
}

/** The waveform of a node (tran): [t − desfase, v] over the axis; null if the simulator does not give it. */
export function ondaDe(p: PeticionMedida, graficas: readonly GraficaSim[], nodo: string): [number, number][] | null {
  if (p.analisis !== 'tran') return null;
  const g = graficas.find((x) => PATRON.tran.test(x.analisis));
  const t = g?.vectores[0];
  const v = g?.vectores.find((x) => x.nombre.toLowerCase() === `v(${nodo.toLowerCase()})`);
  if (!g || !t || !v) return nodo === '0' && t ? [[(p.desde ?? 0) - (p.desfase ?? 0), 0], [(p.hasta ?? 0) - (p.desfase ?? 0), 0]] : null;
  const out: [number, number][] = [];
  for (let k = 0; k < t.re.length; k++) {
    const x = t.re[k]!;
    if (x < p.desde! - 1e-12 * Math.abs(p.hasta!) || x > p.hasta! + 1e-12 * Math.abs(p.hasta!)) continue;
    out.push([x - (p.desfase ?? 0), Number(v.re[k])]);
  }
  return out;
}

// ------------------------------------------------------------------ the page: the simulator and its cache

export interface Medicion {
  solucion: SolucionCC | null;
  graficas: readonly GraficaSim[];
  error?: string;
}

const cache = new Map<string, Medicion>();
const enCurso = new Map<string, Promise<Medicion>>();
const MAX_CACHE = 120;

/** The simulation of this request already done (undefined while it is not). */
export function medicionCacheada(p: PeticionMedida | null): Medicion | undefined {
  return p ? cache.get(p.netlist) : undefined;
}

/** Runs the request on the app's ngspice (the page's worker) and keeps it. */
export function medirConSpice(p: PeticionMedida): Promise<Medicion> {
  const ya = cache.get(p.netlist);
  if (ya) return Promise.resolve(ya);
  const corre = enCurso.get(p.netlist);
  if (corre) return corre;
  const prom = (async (): Promise<Medicion> => {
    try {
      const { simularTexto } = await import('../../../simulador/cliente.svelte');
      const s = await simularTexto(p.netlist, { fondo: true });
      if (s.ejecucion.fallo) return { solucion: null, graficas: [], error: String(s.ejecucion.fallo) };
      const graficas = s.ejecucion.graficas as unknown as GraficaSim[];
      return { solucion: solucionDeGraficas(p, graficas), graficas };
    } catch (e) {
      return { solucion: null, graficas: [], error: e instanceof Error ? e.message : String(e) };
    }
  })().then((m) => {
    enCurso.delete(p.netlist);
    if (!m.error) {
      cache.set(p.netlist, m);
      if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
    }
    return m;
  });
  enCurso.set(p.netlist, prom);
  return prom;
}
