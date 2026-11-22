// 1.3 (motor13, petición de autor121-senpro «explorar sin modelo»): «objetivo» on a book figure or photo (GUIA §13.3).
// A lesson of criteria without any number of the book has no model to set a goal on; its explore card on a figure can
// still ask for something that is checked: visit these zones (`{ zona: coincidir }`), optionally in the order written
// (`orden: true`: the path of the current, the order of the checks). Like a logic goal, the conditions become ordinary
// conditions on «variables» the shell adds to the card's values from the widget's state: «zona:<id>» is 1 once the zone
// has been touched (in order: once it and every zone before it in the goal have been touched in that order). The
// figure keeps its touches in order (EstadoWidget12.visitadas, in memory only); past TOQUES_GUARDADOS the walk is
// compacted to what a goal reads from it (the zones touched and, for an ordered goal, the prefix followed). Pure.

import type { Valores } from '../../leccion11/modelo';
import type { Tarjeta } from '../../leccion11/tipos';
import type { Objetivo } from '../hacer/tipos';
import { variablesLogica } from './objetivo-logico';
import type { EstadoWidget12, WidgetFigura } from './tipos';
import { variablesAveriaPlaca } from '../averia-placa';

/** The touches a figure keeps before compacting them (a walk of an ordered goal is far shorter). */
export const TOQUES_GUARDADOS = 100;

/**
 * The figure's touches after touching `id` (`o`: the card's goal, if any). Past TOQUES_GUARDADOS the walk is compacted
 * without changing what variablesFigura reads from it: the zones touched off the goal's ordered prefix, once each,
 * then that prefix in order. (cierre131: it used to keep only the last touches, so a zone touched once early was
 * forgotten after many touches elsewhere and a goal already met went back to pending.)
 */
export function tocarVisita(w12: EstadoWidget12 | undefined, id: string, o?: Pick<Objetivo, 'condiciones' | 'orden'>): string[] {
  const todas = [...(w12?.visitadas ?? []), id];
  if (todas.length <= TOQUES_GUARDADOS) return todas;
  const prefijo: string[] = [];
  if (o?.orden) {
    const lista = zonasDelObjetivo(o);
    for (const z of todas) if (prefijo.length < lista.length && z === lista[prefijo.length]) prefijo.push(z);
  }
  // (none of the others is the goal's next zone in order before the prefix: the greedy walk over them matches nothing,
  // since the goal's first zone is either in the prefix or was never touched)
  const otras = [...new Set(todas)].filter((z) => !prefijo.includes(z));
  return [...otras, ...prefijo];
}

/** The variable of a zone. */
export const variableZona = (id: string) => `zona:${id}`;

/** A zone condition as the author writes it (`{ zona: id }`, or `{ zona: id, valor: 0 }` in a hint) → an ordinary condition. */
export function condicionFigura(x: Record<string, unknown>, w: WidgetFigura): { valor: string; min?: number; max?: number } | string {
  const id = String(x.zona);
  if (!w.zonas.some((z) => z.id === id)) return `«${id}» no es una zona de la figura (${w.zonas.map((z) => z.id).join(', ')})`;
  for (const k of Object.keys(x)) if (!['zona', 'valor', 'rotulo'].includes(k)) return `clave desconocida «${k}» (una condición de una figura es { zona, valor?, rotulo })`;
  if (x.valor != null && x.valor !== 0 && x.valor !== 1) return '«valor»: 1 (la zona se ha tocado, por defecto) o 0 (todavía no)';
  return x.valor === 0 ? { valor: variableZona(id), max: 0 } : { valor: variableZona(id), min: 1 };
}

/** The zones a goal asks to touch, in its order (conditions on «zona:…» with min 1). */
export function zonasDelObjetivo(o: Pick<Objetivo, 'condiciones'>): string[] {
  return o.condiciones.filter((c) => c.valor.startsWith('zona:') && c.min === 1).map((c) => c.valor.slice(5));
}

/**
 * The zone variables of a figure now: 1 for each zone touched, 0 for the others. With an ordered goal, a zone of the
 * goal counts only once the ones before it have been touched in that order (the touches are a walk: a zone touched out
 * of order does not count, the walk goes on from where it was).
 */
export function variablesFigura(w: WidgetFigura, w12: EstadoWidget12 | undefined, o?: Pick<Objetivo, 'condiciones' | 'orden'>): Valores {
  const visitadas = w12?.visitadas ?? (w12?.zona ? [w12.zona] : []);
  const v: Valores = {};
  for (const z of w.zonas) v[variableZona(z.id)] = visitadas.includes(z.id) ? 1 : 0;
  // (how many zones have been touched at all: the ordered goal's advice waits for the first touch)
  v['zonas:tocadas'] = new Set(visitadas).size;
  if (o?.orden) {
    const lista = zonasDelObjetivo(o);
    let p = 0;
    for (const id of visitadas) if (p < lista.length && id === lista[p]) p++;
    lista.forEach((id, k) => (v[variableZona(id)] = k < p ? 1 : 0));
  }
  return v;
}

/** The ordered goal's next zone (null when it is not ordered or done): what the live advice names. */
export function siguienteZona(w: WidgetFigura, w12: EstadoWidget12 | undefined, o: Pick<Objetivo, 'condiciones' | 'orden'>): string | null {
  if (!o.orden) return null;
  const v = variablesFigura(w, w12, o);
  return zonasDelObjetivo(o).find((id) => !v[variableZona(id)]) ?? null;
}

/** The variables a card's goal looks at besides the model: a logic circuit's (LEDs, signals, counters) or a figure's zones. */
export function variablesWidget12(t: Tarjeta, w12: EstadoWidget12 | undefined): Valores {
  if (!t.objetivo) return {};
  if (t.widget?.tipo === 'logica') return variablesLogica(t.widget, w12);
  if (t.widget?.tipo === 'figura') return variablesFigura(t.widget, w12, t.objetivo);
  // (motor13b: a console's board, the fault found: averia-placa.ts)
  if (t.widget?.tipo === 'averia-placa') return variablesAveriaPlaca(w12);
  return {};
}
