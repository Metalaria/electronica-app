// The operating point of a breadboard, for what is drawn on it (LEDs lit, voltages under the finger) and
// for the checks that need voltages: the board's netlist without its analyses and .control block, plus
// `.op` and the current of every diode that is an LED. Plain TypeScript.
//
// Probe API (for the instruments of later versions): `tensionEn(doc, con, op, x, y)` gives the voltage of
// any hole or terminal; `redEn()` (conexiones.ts) its net.

import type { Simulacion } from '../../simulador/motor/simular.ts';
import { redEn, type ConexionesProto } from './conexiones.ts';
import type { PuntoTrabajo } from './comprobaciones.ts';
import type { DocumentoProtoboard } from './tipos.ts';

const ANALISIS = /^\s*\.(op|tran|ac|dc|noise|tf|pz|sens|four|disto|sp|pss|meas|measure|print|plot|probe|save|step)\b/i;

/** The netlist reduced to its operating point, saving the current of the given diode instances. */
export function netlistPuntoTrabajo(texto: string, diodos: string[]): string {
  const out: string[] = [];
  let enControl = false;
  for (const l of texto.replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*\.control\b/i.test(l)) {
      enControl = true;
      continue;
    }
    if (enControl) {
      if (/^\s*\.endc\b/i.test(l)) enControl = false;
      continue;
    }
    if (/^\s*\.end\s*$/i.test(l)) continue;
    if (ANALISIS.test(l)) continue;
    out.push(l);
  }
  out.push('.op');
  if (diodos.length) out.push(`.save all ${diodos.map((d) => `@${d.toLowerCase()}[id]`).join(' ')}`);
  out.push('.end');
  return out.join('\n') + '\n';
}

/** Node voltages and diode currents of an operating point run. */
export function leerPuntoTrabajo(sim: Simulacion): PuntoTrabajo | null {
  const g = sim.ejecucion.graficas.find((x) => /operating point/i.test(x.analisis) || /^op/i.test(x.id));
  if (!g) return null;
  const v: Record<string, number> = { '0': 0 };
  const i: Record<string, number> = {};
  for (const x of g.vectores) {
    const n = x.nombre.toLowerCase();
    const val = x.re[0];
    if (val == null || !Number.isFinite(val)) continue;
    let m = /^v\((.+)\)$/.exec(n);
    if (m) {
      v[m[1]!] = val;
      continue;
    }
    m = /^i\(@([^[]+)\[id\]\)$/.exec(n);
    if (m) {
      i[m[1]!] = val;
      continue;
    }
    if (!n.includes('(') && !n.includes('#')) v[n] = val;
  }
  return { v, i };
}

/** Voltage at a hole or terminal (V), or null. */
export function tensionEn(doc: DocumentoProtoboard, con: ConexionesProto, op: PuntoTrabajo | null, x: number, y: number): number | null {
  const r = redEn(doc, con, x, y);
  if (r == null || !op) return null;
  return op.v[r] ?? null;
}
