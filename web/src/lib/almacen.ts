// Persistent key-value storage for the reader's personal data.
// Inside Tauri it uses plugin-store (a JSON file in the app data folder, which survives updates);
// in a plain browser it falls back to localStorage.

export interface Almacen {
  leer<T>(clave: string): Promise<T | undefined>;
  escribir(clave: string, valor: unknown): Promise<void>;
  /**
   * The stored JSON text of a key, and writing one (localStorage only): a module that knows the text it last read or
   * wrote knows, by comparing texts, whether another tab wrote the key since — without parsing it
   * (lib/sincronizacion/guardado.ts).
   */
  leerTexto?(clave: string): Promise<string | undefined>;
  escribirTexto?(clave: string, texto: string): Promise<void>;
  /**
   * 0.12: writes `texto` only if the key still holds `esperado` (undefined: absent), comparing and writing in one
   * synchronous call — no other code of THIS page runs in between —; false if it held something else. It catches a
   * write landed since this page read the key as far as this page can see it, NOT another tab's write in flight:
   * Chromium gives each tab its own cached view of localStorage and delivers the other tabs' changes as later tasks,
   * so two tabs writing at once both succeed and the second overwrites the first (review 0.12, finding 3; measured
   * with two real tabs). What protects the data is the Guardado's rule for its own changes (guardado.ts `propios`).
   */
  escribirTextoSi?(clave: string, esperado: string | undefined, texto: string): Promise<boolean>;
  /** Writes the pending changes to disk now (Tauri: the store saves 400 ms after the last change otherwise). */
  guardarYa?(): Promise<void>;
  readonly tipo: 'tauri' | 'navegador' | 'memoria';
}

const PREFIJO = 'epa:';

export function enTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

class AlmacenNavegador implements Almacen {
  readonly tipo = 'navegador' as const;
  async leer<T>(clave: string): Promise<T | undefined> {
    const v = localStorage.getItem(PREFIJO + clave);
    if (v == null) return undefined;
    try {
      return JSON.parse(v) as T;
    } catch {
      return undefined;
    }
  }
  async escribir(clave: string, valor: unknown): Promise<void> {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  }
  async leerTexto(clave: string): Promise<string | undefined> {
    return localStorage.getItem(PREFIJO + clave) ?? undefined;
  }
  async escribirTexto(clave: string, texto: string): Promise<void> {
    localStorage.setItem(PREFIJO + clave, texto);
  }
  async escribirTextoSi(clave: string, esperado: string | undefined, texto: string): Promise<boolean> {
    if ((localStorage.getItem(PREFIJO + clave) ?? undefined) !== esperado) return false;
    localStorage.setItem(PREFIJO + clave, texto);
    return true;
  }
}

class AlmacenMemoria implements Almacen {
  readonly tipo = 'memoria' as const;
  private datos = new Map<string, unknown>();
  async leer<T>(clave: string): Promise<T | undefined> {
    return this.datos.get(clave) as T | undefined;
  }
  async escribir(clave: string, valor: unknown): Promise<void> {
    this.datos.set(clave, valor);
  }
}

async function almacenTauri(): Promise<Almacen> {
  const { load } = await import('@tauri-apps/plugin-store');
  const store = await load('lector.json', { autoSave: 400, defaults: {} });
  return {
    tipo: 'tauri',
    async leer<T>(clave: string) {
      return (await store.get<T>(clave)) ?? undefined;
    },
    async escribir(clave: string, valor: unknown) {
      await store.set(clave, valor);
    },
    async guardarYa() {
      await store.save();
    },
  };
}

let almacen: Promise<Almacen> | null = null;

export function obtenerAlmacen(): Promise<Almacen> {
  almacen ??= (async () => {
    if (enTauri()) {
      try {
        return await almacenTauri();
      } catch (e) {
        console.warn('plugin-store no disponible; se usa localStorage', e);
      }
    }
    try {
      const k = PREFIJO + '__prueba';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return new AlmacenNavegador();
    } catch {
      return new AlmacenMemoria();
    }
  })();
  return almacen;
}

/** The modules' pending writes, as functions that write them now (`registrarVolcado`). */
const volcados = new Set<() => Promise<unknown>>();

/**
 * A module that writes with a delay registers how to write it now (0.12): `guardarTodoAntesDeSalir` awaits it. Every
 * `Guardado` (sincronizacion/guardado.ts) and the learning modules of 0.11 register. Returns the remover.
 */
export function registrarVolcado(f: () => Promise<unknown>): () => void {
  volcados.add(f);
  return () => volcados.delete(f);
}

/**
 * Before the app quits on its own (installing an update, 0.12): every registered module writes what it has pending
 * and that is AWAITED (review 0.12, finding 6: a fixed 300 ms wait did not await them), at most `espera` ms (a write
 * that hangs never blocks the update); `pagehide` and `epa:antes-de-sincronizar` are dispatched too, for anything else
 * that flushes on them; then the store is written to disk. The Windows installer ends the process without the exit
 * events that would save it otherwise.
 */
export async function guardarTodoAntesDeSalir(espera = 5000): Promise<void> {
  const escrituras = Promise.allSettled([...volcados].map((f) => f()));
  window.dispatchEvent(new Event('pagehide'));
  window.dispatchEvent(new CustomEvent('epa:antes-de-sincronizar'));
  let reloj: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([escrituras, new Promise((r) => (reloj = setTimeout(r, espera)))]);
  clearTimeout(reloj);
  try {
    await (await obtenerAlmacen()).guardarYa?.();
  } catch (e) {
    console.warn('No se pudo guardar el almacén antes de salir', e);
  }
}
