// 1.0 «¿Qué seguridad tiene?»: the reader's optional taps after a right answer (rules and merge in seguridad.ts).
// Almacen key `seguridad` `{ version: 1, items: { <item id>: RegistroSeguridad } }`, written through its Guardado
// (read-merge-write with `unirSeguridad`, so another tab's taps are kept) and synchronised as store `seguridad`
// (registro.svelte.ts, with the same `unir`). Mastery applies the taps through `establecerAjuste` (dominio.svelte.ts).

import { guardadoDeRegistro } from '../sincronizacion/guardado';
import { anotarSeguridad, ajustarRegistros, nivelDeRonda, seguridadValida, unirSeguridad, type NivelSeguridad, type RegistroSeguridad } from './seguridad';
import { establecerAjuste } from './dominio.svelte';

export const CLAVE_SEGURIDAD = 'seguridad';

export const estadoSeguridad = $state({
  listo: false,
  items: {} as Record<string, RegistroSeguridad>,
});

export const guardadoSeguridad = guardadoDeRegistro<RegistroSeguridad>({
  claveAlmacen: CLAVE_SEGURIDAD,
  // (the store's key for the marks: without it no write was marked, and another tab's stale copy took the reader's
  // tap away — enlaces11, scenario e11·2)
  claveSinc: CLAVE_SEGURIDAD,
  campo: 'items',
  obtener: () => estadoSeguridad.items,
  tiempo: (v) => v.t,
  unir: (a, b) => (seguridadValida(a) && seguridadValida(b) ? unirSeguridad(a, b) : seguridadValida(a) ? a : b),
});

let carga: Promise<void> | null = null;

/** Loads the taps once and lets mastery use them. */
export function cargarSeguridad(): Promise<void> {
  carga ??= (async () => {
    try {
      await guardadoSeguridad.cargar((m) => {
        const r: Record<string, RegistroSeguridad> = { ...estadoSeguridad.items };
        for (const [k, v] of Object.entries(m)) if (seguridadValida(v)) r[k] = r[k] ? unirSeguridad(r[k]!, v) : v;
        estadoSeguridad.items = r;
      });
    } catch {
      // not read: nothing is taken as stored; a later call loads again
      carga = null;
    }
    estadoSeguridad.listo = true;
    establecerAjuste((items) => ajustarRegistros(items, $state.snapshot(estadoSeguridad.items) as Record<string, RegistroSeguridad>));
  })();
  return carga;
}

/**
 * A tap: how sure the reader was of the answer just given to `item`. Rejects when the write failed (review 10d: the
 * chip must not say «Anotado» then); the tap stays in memory and the Guardado retries it.
 */
export async function marcarSeguridad(item: string, s: NivelSeguridad, ahora = Date.now()): Promise<void> {
  await cargarSeguridad();
  const previo = estadoSeguridad.items[item];
  // a later tap must sort after the earlier ones (same millisecond, a clock set back)
  const a = Math.max(ahora, (previo?.t ?? 0) + 1);
  estadoSeguridad.items[item] = anotarSeguridad(previo, a, s);
  establecerAjuste((items) => ajustarRegistros(items, $state.snapshot(estadoSeguridad.items) as Record<string, RegistroSeguridad>));
  await guardadoSeguridad.escribir();
}

/** The tap already given for the round answered at `t` (to show it chosen), or null. */
export function seguridadDe(item: string, t: number): NivelSeguridad | null {
  return nivelDeRonda(estadoSeguridad.items[item], t);
}
