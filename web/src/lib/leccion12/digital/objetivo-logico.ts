// 1.2.1 (motor121, petición de autor121-digital): «objetivo» on a logic circuit (GUIA §13.3, §11.2). The conditions look
// at the live circuit instead of the model: a LED (`{ led: Y, valor: 1 }`), any signal (`{ senal: n1.q, valor: 0 }`),
// a counter's count (`{ contador: c1, valor: 5 }`, or `min`/`max`). They become ordinary conditions on «variables» the
// shell adds to the card's values from the widget's state (`variablesLogica`): «led:Y», «senal:n1.q», «contador:c1».
// The generator checks the goal can be reached from power-on by toggling the switches and giving clock pulses, and
// that it is not reached at power-on (`buscarObjetivo`: a breadth-first search over the circuit's states, which also
// gives the walker the shortest way there). Pure.

import { enRango, type Valores } from '../../leccion11/modelo';
import type { Condicion } from '../../leccion11/tipos';
import { circuitoSecuencial, conMemoria, cronograma, ficha, iniciar, leer, poner, pulso, relojDe, salidasDe, type CircuitoLogico, type EstadoLogico, type Nivel } from './logica';

/** A line's state as a number for a condition: 0, 1, 2 floating (Z), 3 fought over (X). */
const FICHA: Record<string, number> = { '0': 0, '1': 1, Z: 2, X: 3 };
import type { EstadoWidget12, WidgetLogica } from './tipos';

/** The state of the widget's circuit as the card shows it (the same as componentes/leccion12/Logica.svelte). */
export function estadoDelWidget(w: WidgetLogica, w12: EstadoWidget12 | undefined): EstadoLogico {
  const c = w.circuito;
  const niveles = w12?.niveles ?? Object.fromEntries(c.entradas.map((x) => [x.id, x.valor]));
  if (w.cronograma) {
    const cr = cronograma(c, w.cronograma.ciclos, w.cronograma.estimulo);
    const k = Math.min(w12?.tramo ?? 0, cr.tramos.length - 1);
    return { senales: cr.tramos[k] ?? {}, internos: {}, relojes: {}, estable: cr.estable };
  }
  if (conMemoria(c) && w12?.logica) return w12.logica;
  return iniciar(c, null, niveles);
}

/** The variables a logic goal's conditions look at, from a state of the circuit. */
export function variablesDeEstado(c: CircuitoLogico, s: EstadoLogico): Valores {
  const v: Valores = {};
  for (const x of c.salidas) v[`led:${x.id}`] = leer(s, x.de);
  for (const x of c.entradas) v[`senal:${x.id}`] = leer(s, x.id);
  for (const x of c.salidas) v[`ficha:${x.id}`] = FICHA[String(ficha(s, x.de))]!;
  for (const p of c.piezas) {
    for (const y of salidasDe(p)) {
      v[`senal:${y}`] = leer(s, y);
      v[`ficha:${y}`] = FICHA[String(ficha(s, y))]!;
    }
    if (p.tipo === 'contador') v[`contador:${p.id}`] = s.internos[p.id] ?? 0;
  }
  return v;
}

/** The logic variables of a card's widget now (none when the widget is not a logic circuit). */
export function variablesLogica(w: WidgetLogica, w12: EstadoWidget12 | undefined): Valores {
  return variablesDeEstado(w.circuito, estadoDelWidget(w, w12));
}

/** A condition of a logic goal as the author writes it → an ordinary condition on its variable (or an error). */
export function condicionLogica(x: Record<string, unknown>, c: CircuitoLogico): { valor: string; min?: number; max?: number } | string {
  const clave = (['led', 'senal', 'contador'] as const).find((k) => x[k] != null);
  if (!clave) return 'una condición de un circuito lógico es { led | senal | contador, valor (o min / max) }';
  const id = String(x[clave]);
  if (clave === 'led' && !c.salidas.some((s) => s.id === id)) return `«${id}» no es un LED del circuito (${c.salidas.map((s) => s.id).join(', ')})`;
  if (clave === 'contador' && !c.piezas.some((p) => p.id === id && p.tipo === 'contador')) return `«${id}» no es un contador del circuito`;
  if (clave === 'senal' && !c.entradas.some((e) => e.id === id) && !c.piezas.some((p) => salidasDe(p).includes(id))) return `«${id}» no es una señal del circuito`;
  // (a line let go or fought over: «valor: Z» or «valor: X», on a LED or a signal)
  if (clave !== 'contador' && (x.valor === 'Z' || x.valor === 'X')) return { valor: `ficha:${id}`, min: FICHA[x.valor]!, max: FICHA[x.valor]! };
  const num = (y: unknown) => (typeof y === 'number' && Number.isFinite(y) ? y : undefined);
  const exacto = num(x.valor);
  const min = exacto ?? num(x.min);
  const max = exacto ?? num(x.max);
  if (min == null && max == null) return '«valor» (o «min» / «max»): el número que se pide';
  if (clave !== 'contador' && exacto !== 0 && exacto !== 1) return 'un LED o una señal valen 0, 1, Z (al aire) o X (en conflicto)';
  return { valor: `${clave}:${id}`, ...(min != null ? { min } : {}), ...(max != null ? { max } : {}) };
}

export type AccionLogica = { tipo: 'conmutar'; id: string } | { tipo: 'pulso' };

/**
 * The shortest way from power-on (the switches at their starting levels) to a state where every condition holds,
 * toggling switches and giving clock pulses; null if none within `limite` states. `inicial` says whether power-on
 * already holds it (then the way is empty).
 */
export function buscarObjetivo(c: CircuitoLogico, condiciones: readonly Condicion[], limite = 20000): { camino: AccionLogica[] | null; inicial: boolean; estados: number } {
  const reloj = relojDe(c);
  const interruptores = c.entradas.filter((e) => !e.reloj).map((e) => e.id);
  // (a loop of gates keeps its state too: settled from the previous one, as the widget does)
  const secuencial = conMemoria(c);
  type Nodo = { niveles: Record<string, Nivel>; s: EstadoLogico; camino: AccionLogica[] };
  const niveles0 = Object.fromEntries(c.entradas.map((x) => [x.id, x.valor])) as Record<string, Nivel>;
  const s0 = iniciar(c, null, niveles0);
  const cumple = (s: EstadoLogico) => condiciones.every((q) => enRango(q, variablesDeEstado(c, s)));
  if (cumple(s0)) return { camino: [], inicial: true, estados: 1 };
  const clave = (n: Nodo) => JSON.stringify([n.niveles, n.s.senales, n.s.internos, n.s.especiales ?? null]);
  const vistos = new Set<string>();
  let cola: Nodo[] = [{ niveles: niveles0, s: s0, camino: [] }];
  vistos.add(clave(cola[0]!));
  while (cola.length && vistos.size < limite) {
    const siguiente: Nodo[] = [];
    for (const n of cola) {
      const hijos: Nodo[] = interruptores.map((id) => {
        const v = (n.niveles[id] === 1 ? 0 : 1) as Nivel;
        const niveles = { ...n.niveles, [id]: v };
        // (a combinational circuit is settled again from its switches, as the widget does)
        return { niveles, s: secuencial ? poner(c, n.s, { [id]: v }) : iniciar(c, null, niveles), camino: [...n.camino, { tipo: 'conmutar', id }] };
      });
      if (reloj && circuitoSecuencial(c)) hijos.push({ niveles: n.niveles, s: pulso(c, n.s, reloj), camino: [...n.camino, { tipo: 'pulso' }] });
      for (const h of hijos) {
        const k = clave(h);
        if (vistos.has(k)) continue;
        vistos.add(k);
        if (cumple(h.s)) return { camino: h.camino, inicial: false, estados: vistos.size };
        siguiente.push(h);
      }
    }
    cola = siguiente;
  }
  return { camino: null, inicial: false, estados: vistos.size };
}
