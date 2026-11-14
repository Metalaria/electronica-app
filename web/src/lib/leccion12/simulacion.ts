// 1.2 «Prediga y simule» and «Diseñe»: the card's circuit run on the app's own ngspice (the WebAssembly worker of
// simulador/cliente.svelte.ts), after the reader has committed an estimate or a design. The verdict never waits for it
// (it comes from the lesson's model, which the generator checked against this same ngspice): this is the reader
// seeing the simulator agree. Loaded on demand by those cards only.

import { esquemaDe } from '../leccion11/esquemas/registro';
import type { ModeloCompilado, Valores } from '../leccion11/modelo';
import { contextoNetlist, montarNetlist, terminos } from '../leccion11/spice';
import { num } from '../leccion11/esquemas/comun';
import type { WidgetCircuito } from '../leccion11/tipos';

export interface Simulado {
  valor: number | null;
  unidad: string;
  error?: string;
  ms: number;
}

/** Simulates the widget's circuit with the values `v` and reads the observable `medida` (a DC or an AC reading). */
export async function simularMedida(mc: ModeloCompilado, w: WidgetCircuito, medida: string, v: Valores): Promise<Simulado> {
  const t0 = performance.now();
  const def = esquemaDe(w.esquema);
  const ob = def?.observables[medida];
  if (!def || !ob || ob.analisis === 'tran') return { valor: null, unidad: '', error: 'Esta medida no se puede simular aquí.', ms: 0 };
  const r = mc.evaluar(v);
  const c = contextoNetlist(w, r);
  const tarjeta = ob.analisis === 'op' ? '.op' : `.ac lin 1 ${num(c.p('f'))} ${num(c.p('f'))}`;
  const netlist = montarNetlist(def, c, ob.analisis, tarjeta);
  try {
    const { simularTexto } = await import('../../simulador/cliente.svelte');
    const s = await simularTexto(netlist);
    if (s.ejecucion.fallo) return { valor: null, unidad: ob.unidad, error: String(s.ejecucion.fallo), ms: performance.now() - t0 };
    const patron = ob.analisis === 'op' ? /operating/i : /\bac\b/i;
    const g = s.ejecucion.graficas.find((x) => patron.test(x.analisis));
    const ts = terminos(ob.medida);
    if (!g || !ts) return { valor: null, unidad: ob.unidad, error: 'El simulador no ha dado esa medida.', ms: performance.now() - t0 };
    let re = 0;
    let im = 0;
    for (const t of ts) {
      const vec = g.vectores.find((x) => x.nombre.toLowerCase() === t.vector);
      if (!vec) return { valor: null, unidad: ob.unidad, error: 'El simulador no ha dado esa medida.', ms: performance.now() - t0 };
      re += t.signo * (vec.re[0] ?? NaN);
      im += t.signo * (vec.im?.[0] ?? 0);
    }
    const valor = !ob.ac ? re : ob.ac === 'fase' ? (Math.atan2(im, re) * 180) / Math.PI : ob.ac === 'db' ? 20 * Math.log10(Math.hypot(re, im)) : Math.hypot(re, im);
    return { valor, unidad: ob.unidad, ms: performance.now() - t0 };
  } catch (e) {
    return { valor: null, unidad: ob.unidad, error: e instanceof Error ? e.message : String(e), ms: performance.now() - t0 };
  }
}
