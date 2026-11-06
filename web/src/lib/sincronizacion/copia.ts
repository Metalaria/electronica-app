// Backup of all the reader's progress (0.12): export to one file and import it back (format and merge rules:
// copia-formato.ts). Used by the Sincronización page and «Aa» (componentes/sincronizacion/CopiaSeguridad.svelte).
//   crearCopia()                      the file's text and name (every store of registro.svelte.ts, dated as the next
//                                     synchronisation would send them, tombstones included)
//   leerFicheroCopia(texto)           checks a file (ErrorCopia with a Spanish message when it cannot be used)
//   previsualizar(leida, modo, inc.)  what an import would change, store by store («unir» leaves out the copy's items
//                                     older than the last merged file's prune horizon that this device does not know —
//                                     they may have been deleted and pruned since —, unless `incluirAntiguos`)
//   importar(leida, modo)             does it: «unir» merges with the synchronisation's rules; «sustituir» first stores
//                                     an automatic backup of the current data (refused if that fails)
//   deshacerSustitucion()             restores the last automatic backup with «sustituir» (0.12c: with «unir» it would
//                                     restore nothing — the replacement's versions are newer)
// Both run inside the synchronisation's exclusive section (sincronizar.svelte.ts enExclusiva): a run never interleaves
// with an import. An import marks what it changes (marcas.ts) BEFORE writing it, at the time of the merged item, so the
// next synchronisation sends exactly the merged data: nothing deleted comes back, nothing local is lost, nothing older
// replaces what other devices hold. If the marks cannot be stored (storage full) nothing is imported; a store whose
// write fails is reported and left as it was (each store's `aplicar` is atomic), the others are imported.

import { obtenerAlmacen } from '../almacen';
import { huella } from './fusion';
import { guardarCopiaEn, leerCopiaDe } from './copia-guardada';
import { leerToken } from './credenciales';
import { anotarBorrado, anotarCambio, retirarMarcas, volcarMarcas } from './marcas';
import { sincronizables } from './registro.svelte';
import { activos, enExclusiva, fotografiaLocal, nombreDispositivo } from './sincronizar.svelte';
import { VERSION_APP } from './version-app';
import {
  ErrorCopia,
  FORMATO_COPIA,
  VERSION_COPIA,
  escribirCopia,
  leerCopia,
  nombreCopia,
  planificar,
  type AlmacenConocido,
  type Copia,
  type CopiaLeida,
  type ModoImportacion,
  type PlanAlmacen,
} from './copia-formato';

export { ErrorCopia, type CopiaLeida, type ModoImportacion, type PlanAlmacen };

/** Almacen key of the automatic backup made before «Sustituir todo» (only the last one). */
export const CLAVE_COPIA_AUTOMATICA = 'copia-automatica' as const;

function conocidos(): AlmacenConocido[] {
  // (1.0: not the blocked stores — sincronizar.svelte.ts `activos`)
  return activos().map((s) => ({ clave: s.clave, nombre: s.nombre, valido: s.valido, unir: s.unir, maximo: s.maximo }));
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The backup of the current data (inside the exclusive section). */
async function copiaActual(automatica = false): Promise<{ texto: string; nombre: string; copia: Copia; elementos: number }> {
  let f: Awaited<ReturnType<typeof fotografiaLocal>>;
  try {
    f = await fotografiaLocal();
  } catch (e) {
    throw new ErrorCopia(`No se han podido leer los datos de este dispositivo: ${mensaje(e)}`);
  }
  const copia: Copia = {
    formato: FORMATO_COPIA,
    version: VERSION_COPIA,
    app: VERSION_APP,
    exportado: f.ahora,
    dispositivo: nombreDispositivo(),
    ...(automatica ? { automatica: true as const } : {}),
    almacenes: f.almacenes,
  };
  let elementos = 0;
  for (const c of Object.values(f.almacenes)) for (const e of Object.values(c)) if (!('x' in e)) elementos++;
  return { texto: escribirCopia(copia), nombre: nombreCopia(f.ahora), copia, elementos };
}

/** The backup file of all the progress on this device: its text, its suggested name and how many items it holds. */
export function crearCopia(): Promise<{ texto: string; nombre: string; elementos: number }> {
  return enExclusiva(async () => {
    const { texto, nombre, elementos } = await copiaActual();
    return { texto, nombre, elementos };
  });
}

/** Checks a file chosen by the reader (throws ErrorCopia). */
export function leerFicheroCopia(texto: string): CopiaLeida {
  return leerCopia(texto, conocidos());
}

/** What importing it would change now (store by store, in the registry's order; stores without changes included). */
export function previsualizar(leida: CopiaLeida, modo: ModoImportacion, incluirAntiguos = false): Promise<PlanAlmacen[]> {
  return enExclusiva(async () => {
    const f = await fotografiaLocal().catch((e: unknown) => {
      throw new ErrorCopia(`No se han podido leer los datos de este dispositivo: ${mensaje(e)}`);
    });
    return planificar(f.almacenes, leida.copia, conocidos(), modo, f.ahora, { horizonte: f.podado, incluirAntiguos });
  });
}

/**
 * The synchronisation is set up (a token) but this device has never merged the file: it does not know what was deleted
 * on the other devices, so an old backup imported now could bring it back — better synchronise first.
 */
export async function convieneSincronizarAntes(): Promise<boolean> {
  try {
    return !!(await leerToken()) && !(await enExclusiva(fotografiaLocal)).sincronizado;
  } catch {
    return false;
  }
}

export interface ResultadoImportacion {
  /** Stores imported, with what changed. */
  planes: PlanAlmacen[];
  /** Stores that could not be written (storage full…): left as they were. */
  fallidos: { clave: string; nombre: string; error: string }[];
  /** «sustituir»: the automatic backup of the data before (its file name). */
  copiaAutomatica?: string;
}

// ------------------------------------------------------------------ the automatic backup («Sustituir todo»)

/** Stores the automatic backup (copia-guardada.ts: IndexedDB, Tauri's own store file, or an almacen key). */
async function guardarCopiaAutomatica(nombre: string, texto: string): Promise<void> {
  await guardarCopiaEn(await obtenerAlmacen(), CLAVE_COPIA_AUTOMATICA, nombre, texto);
}

/** The last automatic backup, if any: its name, text and time. */
export async function leerCopiaAutomatica(): Promise<{ nombre: string; texto: string; t: number } | null> {
  return leerCopiaDe(await obtenerAlmacen(), CLAVE_COPIA_AUTOMATICA);
}

// ------------------------------------------------------------------ import

/**
 * Imports a checked file. Re-plans against the data as they are now (they may have changed since the preview). Rejects
 * with an ErrorCopia when nothing was imported (local data unreadable, the automatic backup or the marks could not be
 * stored); otherwise resolves with what was imported and what failed.
 */
export function importar(leida: CopiaLeida, modo: ModoImportacion, incluirAntiguos = false): Promise<ResultadoImportacion> {
  return enExclusiva(async () => {
    let copiaAutomatica: string | undefined;
    if (modo === 'sustituir') {
      const actual = await copiaActual(true);
      try {
        await guardarCopiaAutomatica(actual.nombre, actual.texto);
      } catch (e) {
        throw new ErrorCopia(`No se ha podido guardar la copia automática de sus datos actuales (${mensaje(e)}), así que no se ha sustituido nada. Exporte antes una copia o libere espacio.`);
      }
      copiaAutomatica = actual.nombre;
    }
    const f = await fotografiaLocal().catch((e: unknown) => {
      throw new ErrorCopia(`No se han podido leer los datos de este dispositivo: ${mensaje(e)}`);
    });
    const planes = planificar(f.almacenes, leida.copia, conocidos(), modo, f.ahora, { horizonte: f.podado, incluirAntiguos });

    // the marks first, stored before the data (a run in another tab that sees the data sees them too); with no room
    // for them, nothing is written: unmarked, the import would be taken for a stale copy and never synchronised
    const hechas: Parameters<typeof retirarMarcas>[0] = [];
    for (const p of planes) {
      for (const [id, v] of Object.entries(p.poner)) {
        anotarCambio(p.clave, id, p.marcas[id]!, huella(v));
        hechas.push({ tipo: 'cambios', clave: p.clave, id, t: p.marcas[id]! });
      }
      for (const id of p.quitar)
        if (p.marcas[id] !== undefined) {
          anotarBorrado(p.clave, id, p.marcas[id]!);
          hechas.push({ tipo: 'borrados', clave: p.clave, id, t: p.marcas[id]! });
        }
    }
    try {
      await volcarMarcas();
    } catch (e) {
      // nothing is imported: its marks must not be stored by a later write either (review 0.12, finding 6)
      retirarMarcas(hechas);
      throw new ErrorCopia(`No se ha podido guardar el registro de cambios para la sincronización (${mensaje(e)}); no se ha importado nada. Libere espacio y vuelva a intentarlo.`);
    }

    const fallidos: ResultadoImportacion['fallidos'] = [];
    const hechos: PlanAlmacen[] = [];
    const claves: string[] = [];
    for (const p of planes) {
      const s = sincronizables().find((x) => x.clave === p.clave)!;
      if (!Object.keys(p.poner).length && !p.quitar.length) {
        hechos.push(p);
        continue;
      }
      try {
        await s.aplicar(p.poner, p.quitar, f.leido);
      } catch (e) {
        fallidos.push({ clave: p.clave, nombre: p.nombre, error: mensaje(e) });
        continue;
      }
      hechos.push(p);
      claves.push(p.clave);
      // a store that keeps something else than it was given (a union with what it holds, a normalisation): its value is
      // the change to send — marked again, at the same time, with the hash of what it stored. Never the value this
      // device held before the import (review 0.12d, finding 1): that is another tab's stale copy written back
      // meanwhile (or the store refused the change), not what was imported — marked with the import's time it would
      // be sent as imported
      try {
        const ahora = await s.leer();
        const antes = f.almacenes[p.clave] ?? {};
        for (const id of Object.keys(p.poner)) {
          if (!(id in ahora) || huella(ahora[id]) === huella(p.poner[id])) continue;
          const previo = antes[id];
          if (previo && !('x' in previo) && huella(previo.v) === huella(ahora[id])) continue;
          anotarCambio(p.clave, id, p.marcas[id]!, huella(ahora[id]));
        }
      } catch {
        // (read back failed: the marks made above stay, for the values given)
      }
    }
    await volcarMarcas().catch(() => undefined);
    if (claves.length && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('epa:sincronizado', { detail: { claves, importado: true } }));
    return { planes: hechos, fallidos, copiaAutomatica };
  });
}

/**
 * Undoes the last «Sustituir todo»: the automatic backup made before it, imported with «sustituir» (0.12c, review
 * finding 4 — with «unir» nothing came back: the replacement's marks are newer than the backup's items). Like any
 * «sustituir», it first stores an automatic backup of the data as they are now (so this can be undone too). Rejects
 * with an ErrorCopia when there is no automatic backup or it cannot be used.
 */
export async function deshacerSustitucion(): Promise<ResultadoImportacion> {
  const c = await leerCopiaAutomatica();
  if (!c) throw new ErrorCopia('No hay ninguna copia automática que recuperar.');
  return importar(leerFicheroCopia(c.texto), 'sustituir');
}
