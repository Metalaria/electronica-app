// 2.1 (owner's item 10): «Novedades de la 2.1», a short note shown once on a device that already used an earlier
// version, saying where things went (the five groups, «Más» in «Aa», the search reaching the app's places, each group
// remembering its tab). Not on a fresh install: a new reader has nothing to relearn. «Earlier use» is data stored by
// an app older than 2.1 (the version in the data's seal, lib/migrar.ts — every version since 1.0 writes it) holding
// some of the reader's own progress or preferences.
// The «seen» mark is a device-local key read and written straight in localStorage, as the breadboard's first-use tour
// does (`epa:protoboard-recorrido`): not a store of lib/almacen.ts, not in lib/esquemas.ts, not synchronised, so the
// data format does not change.

import { obtenerAlmacen } from './almacen';
import { versionAnteriorDatos } from './migrar';
import { compararVersiones } from './sincronizacion/fusion';

export const CLAVE_NOVEDADES21 = 'epa:novedades-21';

/**
 * Stores of the reader's own use. Not the ones every start writes by itself (dominio, problema-dia, progreso-xp,
 * esquemas, sinc-*): read before anything else is written, any of these with content means an earlier use.
 */
const USO_PREVIO = [
  'prefs',
  'posiciones',
  'leidas',
  'marcadores',
  'notas',
  'ejercicios',
  'lecciones',
  'cursos',
  'progreso-diario',
  'repaso-tarjetas',
  'repaso-tests',
  'repaso-fallos',
  'laboratorio',
  'proyectos',
  'docente',
  'editor-circuitos',
  'protoboard-circuitos',
];

// (2.2: `decidido` once the start-up check is over: the tour's offer, lib/recorridos.svelte.ts, waits for it, so the two
// never show at once)
export const novedades = $state({ mostrar: false, decidido: false });

function visto(): boolean {
  try {
    return localStorage.getItem(CLAVE_NOVEDADES21) === '1';
  } catch {
    // private mode, no storage: nothing to tell apart, nothing shown
    return true;
  }
}

function marcarVisto(): void {
  try {
    localStorage.setItem(CLAVE_NOVEDADES21, '1');
  } catch {
    /* private mode: shown again next time */
  }
}

function conContenido(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'object') return Object.keys(v as object).length > 0;
  return true;
}

let comprobado = false;

/**
 * Decides at start (App.svelte, before the modules load and write their stores) whether the note is due. A device with
 * no earlier use is marked as seen at once, so the note never turns up later on it.
 */
export async function comprobarNovedades(): Promise<void> {
  if (comprobado) return;
  comprobado = true;
  if (visto()) {
    novedades.decidido = true;
    return;
  }
  let uso = false;
  try {
    const a = await obtenerAlmacen();
    const antes = versionAnteriorDatos();
    if (antes && compararVersiones(antes, '2.1.0') < 0) {
      const valores = await Promise.all(USO_PREVIO.map((k) => a.leer<unknown>(k).catch(() => undefined)));
      uso = valores.some(conContenido);
    }
  } catch {
    uso = false;
  }
  if (uso) novedades.mostrar = true;
  else marcarVisto();
  novedades.decidido = true;
}

/** «Entendido» (or Esc): not shown again on this device. */
export function cerrarNovedades(): void {
  novedades.mostrar = false;
  marcarVisto();
}
