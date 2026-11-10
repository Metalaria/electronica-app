// 1.1: runs a design question's netlist on the app's simulator (the worker of simulador/cliente.svelte.ts) and returns
// the «name = value» measurements its `meas` lines print — the `Simulador` that lib/diseno-ejercicio.ts needs. Loaded
// on demand by the panels that check a design (Comprobador, the exam's hand-in), never by the exercise lists.

import { simularTexto } from '../simulador/cliente.svelte';
import { todasLasMedidas } from '../simulador/motor/salida';

export async function medirDiseno(netlist: string): Promise<{ nombre: string; valor: number }[]> {
  const r = await simularTexto(netlist);
  if (r.ejecucion.fallo) throw new Error(String(r.ejecucion.fallo));
  return todasLasMedidas(r.salida).map((m) => ({ nombre: m.nombre, valor: m.valor }));
}
