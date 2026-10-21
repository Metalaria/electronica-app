// Persistent key-value storage for the reader's personal data.
// Inside Tauri it uses plugin-store (a JSON file in the app data folder, which survives updates);
// in a plain browser it falls back to localStorage.

export interface Almacen {
  leer<T>(clave: string): Promise<T | undefined>;
  escribir(clave: string, valor: unknown): Promise<void>;
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
