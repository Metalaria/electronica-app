// Where the app keeps its automatic backups (0.12; 1.0: one slot per kind), apart from the data themselves:
//   'copia-automatica'  the data before the last «Sustituir todo» (copia.ts)
//   'copia-migracion'   the stored keys as they were before the last schema migration (lib/migrar.ts)
// In a browser in IndexedDB `epa-copias` (localStorage would need as much room again as the data); in Tauri in the
// store file `copia-automatica.json` (not inside lector.json, which every autosave rewrites), written to disk with
// `save()` before it counts (review 0.12, finding 6); else under an almacen key of that name, flushed if it can.
// It takes the storage as an argument: the migration runs before lib/almacen.ts hands the storage to anyone.

import type { Almacen } from '../almacen';

export type Ranura = 'copia-automatica' | 'copia-migracion';
export interface CopiaGuardada {
  nombre: string;
  texto: string;
  t: number;
}

/** The app runs in Tauri (the real window, not a test's storage double). */
const conTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
/** The key of a slot inside Tauri's backup store file (0.12's automatic backup is «copia»). */
const claveTauri = (r: Ranura) => (r === 'copia-automatica' ? 'copia' : 'migracion');

async function almacenCopia() {
  const { load } = await import('@tauri-apps/plugin-store');
  return load('copia-automatica.json', { autoSave: false, defaults: {} });
}

/** Stores a backup in its slot (replacing the previous one). Rejects if it could not be stored. */
export async function guardarCopiaEn(a: Almacen, ranura: Ranura, nombre: string, texto: string): Promise<void> {
  const valor: CopiaGuardada = { nombre, texto, t: Date.now() };
  if (a.tipo === 'navegador' && typeof indexedDB !== 'undefined') {
    await idb('readwrite', (s) => s.put(valor, ranura));
    return;
  }
  if (conTauri()) {
    const s = await almacenCopia();
    await s.set(claveTauri(ranura), valor);
    await s.save();
    return;
  }
  await a.escribir(ranura, valor);
  await a.guardarYa?.();
}

/** The backup in a slot, if any. */
export async function leerCopiaDe(a: Almacen, ranura: Ranura): Promise<CopiaGuardada | null> {
  let v: unknown;
  if (a.tipo === 'navegador' && typeof indexedDB !== 'undefined') v = await idb('readonly', (s) => s.get(ranura)).catch(() => undefined);
  else if (conTauri()) v = await almacenCopia().then((s) => s.get(claveTauri(ranura))).catch(() => undefined);
  else v = await a.leer<unknown>(ranura).catch(() => undefined);
  const x = v as { nombre?: unknown; texto?: unknown; t?: unknown } | undefined;
  return x && typeof x.texto === 'string' && typeof x.nombre === 'string' ? { nombre: x.nombre, texto: x.texto, t: Number(x.t) || 0 } : null;
}

function idb<T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((ok, mal) => {
    const abrir = indexedDB.open('epa-copias', 1);
    abrir.onupgradeneeded = () => abrir.result.createObjectStore('copias');
    abrir.onerror = () => mal(abrir.error ?? new Error('IndexedDB'));
    abrir.onsuccess = () => {
      const db = abrir.result;
      try {
        const tx = db.transaction('copias', modo);
        const r = f(tx.objectStore('copias'));
        let valor: T;
        r.onsuccess = () => (valor = r.result as T);
        tx.oncomplete = () => {
          db.close();
          ok(valor);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          mal(tx.error ?? new Error('IndexedDB'));
        };
      } catch (e) {
        db.close();
        mal(e);
      }
    };
  });
}
