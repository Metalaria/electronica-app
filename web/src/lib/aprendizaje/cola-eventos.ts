// The queue of learning events waiting for their consumers (eventos.ts), as pure functions (the tests import them).
// The rule: the newest events are kept — in memory and in localStorage alike — and at most MAX_COLA of them (a page
// that emits more before the consumers load, or while they cannot load, drops the oldest ones, saying so).

/** At most this many events wait (memory and storage). */
export const MAX_COLA = 1000;

/** The prefix of the localStorage keys of the waiting events: one key per tab (`<prefix>:<tab id>`). */
export const PREFIJO_PENDIENTES = 'epa:eventos-pendientes';

export interface EventoEnCola {
  tipo: string;
  t: number;
}

/** Adds an event, dropping the oldest beyond `max`; returns how many were dropped. */
export function encolar<T>(cola: T[], e: T, max = MAX_COLA): number {
  cola.push(e);
  const fuera = cola.length - max;
  if (fuera > 0) cola.splice(0, fuera);
  return Math.max(0, fuera);
}

/** A stored list of events, keeping only what looks like one. */
export function leerLista(texto: string | null): EventoEnCola[] {
  try {
    const v = JSON.parse(texto ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((e): e is EventoEnCola => !!e && typeof e === 'object' && typeof (e as EventoEnCola).tipo === 'string' && typeof (e as EventoEnCola).t === 'number') : [];
  } catch {
    return [];
  }
}

/**
 * The events of several stored lists (tabs that could not deliver them) as one queue: each event once (the same
 * event saved by two tabs), in time order, the newest `max`. The consumers are idempotent, so an event delivered
 * again by the tab that saved it is harmless.
 */
export function unirListas<T extends EventoEnCola>(listas: T[][], max = MAX_COLA): T[] {
  const vistos = new Set<string>();
  const r: T[] = [];
  for (const l of listas)
    for (const e of l) {
      const k = JSON.stringify(e);
      if (vistos.has(k)) continue;
      vistos.add(k);
      r.push(e);
    }
  r.sort((a, b) => a.t - b.t);
  return r.slice(-max);
}
