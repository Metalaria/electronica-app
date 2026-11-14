// 1.2 «Diseñe»: a design checked with its components' tolerances — the nominal values, every corner (each toleranced
// value at its two ends: 2ⁿ boards) or a seeded Monte Carlo draw (uniform within each tolerance: a part of ± 5 % is
// anywhere in the band, the rectangular distribution the book's GUM section uses for a manufacturer's tolerance).
// Computed with the lesson's model, which the generator checks against the app's ngspice. Pure.

import { enRango, type ModeloCompilado, type Valores } from '../leccion11/modelo';
import type { Condicion } from '../leccion11/tipos';
import { generador } from './azar';
import type { Diseno } from './tipos';

export const MAX_TOLERANCIAS = 8;
export const MAX_MUESTRAS = 2000;

export interface Informe {
  /** The spec met with the nominal values. */
  nominal: boolean;
  /** Boards evaluated (corners or random) and how many meet the spec. */
  placas: number;
  cumplen: number;
  /** Per condition: its nominal value and the lowest and highest over the boards. */
  rangos: { valor: string; nominal: number; min: number; max: number }[];
  /** Up to 200 values of the first condition's quantity over the boards (for the drawing). */
  muestra: number[];
  /** What the card asks for is met. */
  pasa: boolean;
}

/** The boards of a design: the values with each toleranced one moved to its ends (corners) or drawn at random. */
export function placas(d: Diseno, v: Valores): Valores[] {
  const ids = Object.keys(d.tolerancias).sort();
  if (d.metodo === 'esquinas') {
    const out: Valores[] = [];
    for (let m = 0; m < 1 << ids.length; m++) {
      const p: Valores = { ...v };
      ids.forEach((k, j) => (p[k] = (v[k] ?? 0) * (1 + ((m >> j) & 1 ? 1 : -1) * d.tolerancias[k]!)));
      out.push(p);
    }
    return out;
  }
  const rnd = generador(d.semilla);
  return Array.from({ length: d.muestras }, () => {
    const p: Valores = { ...v };
    for (const k of ids) p[k] = (v[k] ?? 0) * (1 + (2 * rnd() - 1) * d.tolerancias[k]!);
    return p;
  });
}

/** The design's report with the reader's values `v` (the controls' positions). */
export function analizarDiseno(mc: ModeloCompilado, d: Diseno, condiciones: readonly Condicion[], v: Valores): Informe {
  const r0 = mc.evaluar(v);
  const nominal = condiciones.every((c) => enRango(c, r0));
  const ps = placas(d, v).map((p) => mc.evaluar(p));
  const cumplen = ps.filter((r) => condiciones.every((c) => enRango(c, r))).length;
  const rangos = condiciones.map((c) => {
    const xs = ps.map((r) => r[c.valor]!).filter(Number.isFinite);
    return { valor: c.valor, nominal: r0[c.valor]!, min: Math.min(r0[c.valor]!, ...xs), max: Math.max(r0[c.valor]!, ...xs) };
  });
  const primera = condiciones[0]?.valor;
  const muestra = primera ? ps.slice(0, 200).map((r) => r[primera]!) : [];
  const placasN = ps.length;
  const pasa = d.exigir === 'nominal' ? nominal : d.exigir === 'todas' ? nominal && cumplen === placasN : nominal && cumplen >= d.exigir * placasN - 1e-9;
  return { nominal, placas: placasN, cumplen, rangos, muestra, pasa };
}
