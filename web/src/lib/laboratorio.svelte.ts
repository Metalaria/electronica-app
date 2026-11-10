// 1.1 «Laboratorio guiado»: the labs' progress in memory, saved through its Guardado (read-merge-write with
// `unirRegistrosLab`, so another tab's steps are kept) and synchronised as store `laboratorio`
// (sincronizacion/registro.svelte.ts, with the same merge). Shape and rules: laboratorio.ts.

import { guardadoDeRegistro } from './sincronizacion/guardado';
import { CLAVE_LABORATORIO, anotarAyudaLab, anotarPasoLab, claveLab, registroLabValido, unirRegistrosLab, type RegistroLab } from './laboratorio';

export const estadoLab = $state({
  listo: false,
  items: {} as Record<string, RegistroLab>,
});

export const guardadoLab = guardadoDeRegistro<RegistroLab>({
  claveAlmacen: CLAVE_LABORATORIO,
  // (the store's key for the marks: without it no write was marked, and another tab's stale copy took the reader's
  // step away — enlaces11, scenario e11·1)
  claveSinc: CLAVE_LABORATORIO,
  campo: 'practicas',
  obtener: () => estadoLab.items,
  tiempo: (v) => v.t,
  unir: (a, b) => (registroLabValido(a) && registroLabValido(b) ? unirRegistrosLab(a, b) : registroLabValido(a) ? a : b),
});

let carga: Promise<void> | null = null;

/** Loads the progress once. */
export function cargarLaboratorio(): Promise<void> {
  carga ??= (async () => {
    try {
      await guardadoLab.cargar((m) => {
        const r: Record<string, RegistroLab> = { ...estadoLab.items };
        for (const [k, v] of Object.entries(m)) if (registroLabValido(v)) r[k] = r[k] ? unirRegistrosLab(r[k]!, v) : v;
        estadoLab.items = r;
      });
    } catch {
      // not read: nothing is taken as stored; a later call loads again
      carga = null;
    }
    estadoLab.listo = true;
  })();
  return carga;
}

/** The record of lab n (reactive), or undefined before anything was done. */
export function registroLab(n: number): RegistroLab | undefined {
  return estadoLab.items[claveLab(n)];
}

/** A step of lab n done, with the reading typed (if any). Rejects when the write failed (kept in memory and retried). */
export async function anotarPasoLaboratorio(n: number, paso: string, lectura: number | null, pasos: readonly string[], ahora = Date.now()): Promise<void> {
  await cargarLaboratorio();
  const k = claveLab(n);
  estadoLab.items[k] = anotarPasoLab($state.snapshot(estadoLab.items[k]) as RegistroLab | undefined, paso, lectura, pasos, ahora);
  await guardadoLab.escribir();
}

/** Review 11a: «Hágalo por mí» did a step of lab n: kept (and synchronised) so that the step gives no XP afterwards. */
export async function anotarAyudaLaboratorio(n: number, paso: string, ahora = Date.now()): Promise<void> {
  await cargarLaboratorio();
  const k = claveLab(n);
  if (estadoLab.items[k]?.a?.includes(paso)) return;
  estadoLab.items[k] = anotarAyudaLab($state.snapshot(estadoLab.items[k]) as RegistroLab | undefined, paso, ahora);
  await guardadoLab.escribir();
}
