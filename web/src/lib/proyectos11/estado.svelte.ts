// 1.1 «Proyectos por etapas»: the stages' progress in memory, saved through its Guardado (read-merge-write with
// `unirRegistrosEtapa`, so another tab's checks are kept) and synchronised as store `proyectos`
// (sincronizacion/registro.svelte.ts, with the same merge). Shape and rules: registro.ts.

import { guardadoDeRegistro } from '../sincronizacion/guardado';
import { CLAVE_PROYECTOS, anotarCircuito, anotarComprobacion, anotarSolucion, registroEtapaValido, unirRegistrosEtapa, type RegistroEtapa } from './registro';
import { proyectoIndice } from './indice';

export const estadoProyectos = $state({
  listo: false,
  items: {} as Record<string, RegistroEtapa>,
});

export const guardadoProyectos = guardadoDeRegistro<RegistroEtapa>({
  claveAlmacen: CLAVE_PROYECTOS,
  claveSinc: CLAVE_PROYECTOS,
  campo: 'etapas',
  obtener: () => estadoProyectos.items,
  tiempo: (v) => v.t,
  unir: (a, b) => (registroEtapaValido(a) && registroEtapaValido(b) ? unirRegistrosEtapa(a, b) : registroEtapaValido(a) ? a : b),
});

let carga: Promise<void> | null = null;

/** Loads the progress once. */
export function cargarProyectos(): Promise<void> {
  carga ??= (async () => {
    try {
      await guardadoProyectos.cargar((m) => {
        const r: Record<string, RegistroEtapa> = { ...estadoProyectos.items };
        for (const [k, v] of Object.entries(m)) if (registroEtapaValido(v)) r[k] = r[k] ? unirRegistrosEtapa(r[k]!, v) : v;
        estadoProyectos.items = r;
      });
    } catch {
      // not read: nothing is taken as stored; a later call loads again
      carga = null;
    }
    estadoProyectos.listo = true;
  })();
  return carga;
}

/** The record of a stage (reactive), or undefined before anything was done. */
export function registroEtapa(id: string): RegistroEtapa | undefined {
  return estadoProyectos.items[id];
}

/** Stages passed of a project (reactive). */
export function etapasHechas(parte: string): number {
  const p = proyectoIndice(parte);
  return p ? p.etapas.filter((e) => estadoProyectos.items[e.id]?.h).length : 0;
}

/** The first stage of a project not passed yet (1-based), or 0 when all are. */
export function etapaPendiente(parte: string): number {
  const p = proyectoIndice(parte);
  return p?.etapas.find((e) => !estadoProyectos.items[e.id]?.h)?.n ?? 0;
}

async function cambiar(id: string, f: (r: RegistroEtapa | undefined) => RegistroEtapa): Promise<void> {
  await cargarProyectos();
  estadoProyectos.items[id] = f($state.snapshot(estadoProyectos.items[id]) as RegistroEtapa | undefined);
  await guardadoProyectos.escribir();
}

/** The stage's circuit in «Mis circuitos». Rejects when the write failed (kept in memory and retried). */
export const anotarCircuitoEtapa = (id: string, circuito: string, ahora = Date.now()) => cambiar(id, (r) => anotarCircuito(r, circuito, ahora));

/** A simulated check of a stage. */
export const anotarComprobacionEtapa = (id: string, bien: boolean, valores: Record<string, number>, medidas: Record<string, number>, ahora = Date.now()) =>
  cambiar(id, (r) => anotarComprobacion(r, bien, valores, medidas, ahora));

/** The book's design was shown for a stage. */
export const anotarSolucionEtapa = (id: string, ahora = Date.now()) => cambiar(id, (r) => anotarSolucion(r, ahora));
