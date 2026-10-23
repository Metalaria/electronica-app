// DC operating point of the whole kit with the app's ngspice worker: the template netlist of kit.json filled
// with the positions of the controls, the voltages that the alignment model gives to the detector (TP3) and
// the signal meter, and the fault being simulated; instrumented with the live overlay's ammeters
// (figuras-vivas/circuito/netlist.ts) so that every wire and pin gets its current.

import type { ResultadoOp } from '../figuras-vivas/tipos';
import { instrumentar, resultados } from '../figuras-vivas/circuito/netlist';
import type { Controles, EstadoRadio } from './fisica';
import type { Averia, Kit } from './tipos';

const sp = (v: number) => {
  const r = Math.max(1, v);
  return r >= 1e6 ? `${(r / 1e6).toPrecision(6)}meg` : r.toPrecision(6);
};

/** Values of the template's placeholders for these controls. */
export function parametros(kit: Kit, c: Controles, r: EstadoRadio, averia: Averia | null): Record<string, string | number> {
  const p: Record<string, string | number> = { ...kit.modelo.parametros };
  const on = 0.01;
  const off = '1e12';
  p['VCC'] = c.vcc.toFixed(3);
  p['K4'] = c.k4 ? on : off;
  // K1: «a» = ON (detector), «b» = OFF (W1)
  p['K1A'] = c.k1 ? on : off;
  p['K1B'] = c.k1 ? off : on;
  p['K2'] = c.k2 ? on : off;
  p['K3'] = c.k3 ? on : off;
  p['MON'] = c.monitor ? on : off;
  // Potentiometers: start → tap = ra, tap → end = rb. W1 and W2 have the end at ground: the wiper position
  // is measured from ground. W3 is used as a rheostat (tap tied to its end): ra is the resistance in circuit.
  p['W1A'] = sp(20e3 * (1 - c.w1));
  p['W1B'] = sp(20e3 * c.w1);
  p['W2A'] = sp(10e3 * (1 - c.w2));
  p['W2B'] = sp(10e3 * c.w2);
  p['W3A'] = sp(5e3 * c.w3);
  p['W3B'] = sp(5e3 * (1 - c.w3));
  for (const k of ['W4L', 'W4R']) {
    p[`${k}A`] = sp(20e3 * (1 - c.volumen));
    p[`${k}B`] = sp(20e3 * c.volumen);
  }
  p['VDET'] = r.vTP3.toFixed(4);
  p['VSM'] = r.vMedidor.toFixed(4);
  // Stereo LED on: pin 6 sinks it; the decoder's own current is lowered so that IC4 + LED keep the 18 mA
  // of the companion netlist (the 8 V of the book in both states).
  if (r.estereo) {
    p['RLED'] = 40;
    p['ICORE'] = '7.5m';
  }
  if (averia) for (const [k, v] of Object.entries(averia.dc)) p[k] = v;
  return p;
}

export function rellenar(plantilla: string, valores: Record<string, string | number>): string {
  return plantilla.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(valores[k] ?? ''));
}

/** Nodes (topology ids) whose DC voltage the macro-models do not set, for these switch positions. */
export function nodosSinModelo(kit: Kit, c: Controles): Set<string> {
  const redes = new Set(kit.modelo.sin_modelo);
  for (const [red, sw] of Object.entries(kit.modelo.sin_modelo_segun)) {
    const cerrado = sw === 'K2' ? c.k2 : sw === 'K3' ? c.k3 : false;
    if (!cerrado) redes.add(red);
  }
  const res = new Set<string>();
  for (const n of kit.esquema.nodos) if (redes.has(n.red)) res.add(n.id);
  return res;
}

export interface ResultadoDC {
  op: ResultadoOp;
  /** Current drawn from CZ1 (A). */
  consumo: number | null;
  ms: number;
}

/** Runs the operating point (rejects with SimulacionCancelada when superseded). */
export async function simularDC(kit: Kit, valores: Record<string, string | number>, sinModelo: Set<string>): Promise<ResultadoDC> {
  const texto = rellenar(kit.modelo.plantilla, valores);
  const corr = kit.modelo.correspondencia;
  const ins = instrumentar(texto, [corr], false);
  const { simularTexto } = await import('../../simulador/cliente.svelte');
  const t0 = performance.now();
  const sim = await simularTexto(ins.texto);
  const r = resultados(kit.esquema, corr, ins, sim.ejecucion.graficas);
  if (!r.op) {
    const err = sim.salida.errores[0] ?? sim.ejecucion.fallo ?? 'sin punto de trabajo';
    throw new Error(`ngspice no ha resuelto el modelo de continua: ${err}`);
  }
  for (const id of sinModelo) r.op.nodos[id] = null;
  const cz1 = kit.esquema.elementos.find((e) => e.designador === 'CZ1');
  const ipos = cz1 ? r.op.elementos[cz1.id]?.terminales?.['pos'] : null;
  return { op: r.op, consumo: ipos != null ? -ipos : null, ms: performance.now() - t0 };
}
