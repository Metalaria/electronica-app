// Re-simulation of a live schematic with the values of its sliders: the netlist is regenerated from the
// topology (netlist.ts, the generator's rules) and run in the app's ngspice Web Worker; the results replace
// the book's ones in the animation.

import type { Elemento } from '../tipos';
import type { EstadoEsquema } from './modelo.svelte';
import { bloqueControl, cargaDe, frecuenciaOriginal, generarNetlist, ONDAS, type Cambios } from './netlist.ts';
import { leerOp, leerTran } from './resultado.ts';
import { serieE12 } from '../../../simulador/motor/netlist.ts';

export interface ParametroEsquema {
  /** Key in `EstadoEsquema.cambios`: element id, «f:id» (frequency) or «i:id» (load current). */
  id: string;
  elemento: Elemento;
  etiqueta: string;
  unidad: string;
  original: number;
  min: number;
  max: number;
  /** Values of the E12 series in the range (R, C, L), or null. */
  e12: number[] | null;
}

const UNIDAD: Record<string, string> = { R: 'Ω', POT: 'Ω', LAMP: 'Ω', C: 'F', L: 'H', I: 'A' };
const CON_VALOR = new Set(['R', 'POT', 'C', 'L', 'V', 'V?', 'BAT', 'I', 'VSIN', 'VPULSE', 'VTRI', 'RAIL', 'LAMP']);

/** The values a reader can change in a simulable schematic (×0,1 … ×10 of the book's value). */
export function parametros(est: EstadoEsquema, nombre: (e: Elemento) => string): ParametroEsquema[] {
  if (!est.simulable) return [];
  const excl = new Set(est.esq.simulacion?.excluidos ?? []);
  const res: ParametroEsquema[] = [];
  const rango = (v: number) => {
    const a = Math.abs(v);
    return { min: a / 10, max: a * 10 };
  };
  for (const e of est.esq.elementos) {
    if (excl.has(e.id) || e.discontinuo) continue;
    const carga = cargaDe(e);
    if (e.rol === 'R' && carga != null && carga !== 0) {
      res.push({ id: `i:${e.id}`, elemento: e, etiqueta: `${nombre(e)} · corriente`, unidad: 'A', original: carga, ...rango(carga), e12: null });
      continue;
    }
    if (!CON_VALOR.has(e.rol) || e.valor == null || e.valor === 0) continue;
    const unidad = UNIDAD[e.rol] ?? e.unidad ?? 'V';
    const r = rango(e.valor);
    const e12 = ['R', 'POT', 'C', 'L'].includes(e.rol) ? serieE12(r.min, r.max) : null;
    res.push({
      id: e.id,
      elemento: e,
      etiqueta: ONDAS.has(e.rol) ? `${nombre(e)} · amplitud` : nombre(e),
      unidad,
      original: e.valor,
      ...r,
      e12: e12 && e12.length > 2 ? e12 : null,
    });
    if (ONDAS.has(e.rol)) {
      const f = frecuenciaOriginal(e);
      res.push({ id: `f:${e.id}`, elemento: e, etiqueta: `${nombre(e)} · frecuencia`, unidad: 'Hz', original: f, min: f / 10, max: f * 10, e12: null });
    }
  }
  return res;
}

function cambiosDe(est: EstadoEsquema): Cambios {
  const c: Cambios = { valor: {}, frecuencia: {}, carga: {} };
  for (const [k, v] of Object.entries(est.cambios)) {
    if (k.startsWith('f:')) c.frecuencia![k.slice(2)] = v;
    else if (k.startsWith('i:')) c.carga![k.slice(2)] = v;
    else c.valor![k] = v;
  }
  return c;
}

let cliente: Promise<typeof import('../../../simulador/cliente.svelte')> | null = null;

/** Runs the schematic with its changed values. Superseded runs (another slider move) end silently. */
export async function resimular(est: EstadoEsquema): Promise<void> {
  if (!Object.keys(est.cambios).length) {
    restaurar(est);
    return;
  }
  est.estadoSim = 'simulando';
  est.mensaje = '';
  let texto: string;
  let meta: ReturnType<typeof generarNetlist>['meta'];
  try {
    ({ texto, meta } = generarNetlist(est.esq, cambiosDe(est)));
  } catch (e) {
    est.estadoSim = 'error';
    est.mensaje = e instanceof Error ? e.message : String(e);
    return;
  }
  cliente ??= import('../../../simulador/cliente.svelte');
  const { simularTexto, SimulacionCancelada } = await cliente;
  try {
    const sim = await simularTexto(texto + bloqueControl(meta));
    const graficas = sim.ejecucion.graficas;
    const gop = graficas.find((g) => /operating/i.test(g.analisis));
    const gtr = graficas.find((g) => /transient/i.test(g.analisis));
    if (!gop) {
      est.estadoSim = 'error';
      est.mensaje = 'ngspice no encuentra el punto de trabajo con estos valores' + (sim.salida.errores[0] ? `: ${sim.salida.errores[0]}` : '.');
      return;
    }
    const op = leerOp(est.esq, meta, gop);
    const bad = Object.values(op.nodos).some((v) => v != null && Math.abs(v) > 1e5);
    if (bad) {
      est.estadoSim = 'error';
      est.mensaje = 'Solución sin sentido (más de 100 kV en algún nodo).';
      return;
    }
    est.op = op;
    est.tran = gtr ? leerTran(est.esq, meta, gtr) : null;
    est.estadoSim = 'ok';
  } catch (e) {
    if (e instanceof SimulacionCancelada) return;
    est.estadoSim = 'error';
    est.mensaje = e instanceof Error ? e.message : String(e);
  }
}

/** Back to the book's values and results. */
export function restaurar(est: EstadoEsquema): void {
  est.cambios = {};
  est.op = est.esq.simulacion?.op ?? null;
  est.tran = est.esq.simulacion?.tran ?? null;
  est.estadoSim = 'libro';
  est.mensaje = '';
}
