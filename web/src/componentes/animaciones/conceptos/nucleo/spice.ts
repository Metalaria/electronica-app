// Thin wrapper over the app's ngspice worker (simulador/cliente.svelte.ts) for the concept scenes that need a
// real circuit simulation (non-linear parts such as diodes or switches). The engine is downloaded lazily the
// first time; a newer request supersedes a running one.

export interface Resultado {
  /** Vectors of the first transient plot, by lower-case name («time», «v(p)», «vm#branch»…). */
  vec: Map<string, Float64Array>;
  ms: number;
}

let cliente: Promise<typeof import('../../../../simulador/cliente.svelte')> | null = null;

/** Runs a netlist and returns its transient vectors, or null if superseded. Throws on engine errors. */
export async function transitorio(netlist: string): Promise<Resultado | null> {
  cliente ??= import('../../../../simulador/cliente.svelte');
  const { simularTexto, SimulacionCancelada } = await cliente;
  try {
    const t0 = performance.now();
    const sim = await simularTexto(netlist);
    const g = sim.ejecucion.graficas.find((x) => /transient/i.test(x.analisis));
    if (!g) throw new Error(sim.salida.errores[0] ?? 'ngspice no ha devuelto el transitorio');
    const vec = new Map<string, Float64Array>();
    for (const v of g.vectores) vec.set(v.nombre.toLowerCase(), v.re);
    return { vec, ms: performance.now() - t0 };
  } catch (e) {
    if (e instanceof SimulacionCancelada) return null;
    throw e;
  }
}

/** Linear interpolation of y(x) at xi (x increasing). */
export function interp(x: Float64Array, y: Float64Array, xi: number): number {
  let lo = 0;
  let hi = x.length - 1;
  if (xi <= x[0]!) return y[0]!;
  if (xi >= x[hi]!) return y[hi]!;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (x[m]! <= xi) lo = m;
    else hi = m;
  }
  const f = (xi - x[lo]!) / (x[hi]! - x[lo]! || 1);
  return y[lo]! + (y[hi]! - y[lo]!) * f;
}

/** Resamples a window [t0, t1] of a transient on n uniform points. */
export function ventanaUniforme(t: Float64Array, y: Float64Array, t0: number, t1: number, n: number): Float64Array {
  const r = new Float64Array(n);
  for (let i = 0; i < n; i++) r[i] = interp(t, y, t0 + ((t1 - t0) * i) / (n - 1));
  return r;
}
