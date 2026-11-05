// Fake lib/almacen.ts of one device (the `?d=` of the module graph): a Map of JSON texts per device (tabs of one
// device share it). `globalThis.__fallaEscritura(d, clave)` returning true makes a write throw (storage full),
// `globalThis.__fallaLectura(d, clave)` a read (an IPC error).
// Two kinds, by `globalThis.__tipoAlmacen(d)` (fifth review: the Tauri path was untested):
//   - 'navegador' (default): like localStorage — `leerTexto`/`escribirTexto`, synchronous underneath;
//   - 'tauri': like the plugin-store — no texts, every call an IPC round trip (a macrotask), values copied.
const g = globalThis as unknown as {
  __ls(d: string): Map<string, string>;
  __fallaEscritura?: (d: string, c: string) => boolean;
  __fallaLectura?: (d: string, c: string) => boolean;
  /** 0.12c: the longest text a write of the key may store (a nearly full quota); undefined: no limit. */
  __limiteEscritura?: (d: string, c: string) => number | undefined;
  __tipoAlmacen?: (d: string) => 'navegador' | 'tauri';
};
const d = new URL(import.meta.url).searchParams.get('d')!;
export interface Almacen {
  leer<T>(c: string): Promise<T | undefined>;
  escribir(c: string, v: unknown): Promise<void>;
  leerTexto?(c: string): Promise<string | undefined>;
  escribirTexto?(c: string, t: string): Promise<void>;
  escribirTextoSi?(c: string, esperado: string | undefined, t: string): Promise<boolean>;
  readonly tipo: 'navegador' | 'tauri' | 'memoria';
}
const ipc = () => new Promise<void>((r) => setTimeout(r, 0));
const leer = <T>(c: string): T | undefined => {
  if (g.__fallaLectura?.(d, c)) throw new Error(`IPC: no se pudo leer ${c}`);
  const v = g.__ls(d).get(c);
  return v == null ? undefined : (JSON.parse(v) as T);
};
const escribir = (c: string, t: string) => {
  if (g.__fallaEscritura?.(d, c)) throw new Error(`QuotaExceededError (${c})`);
  const limite = g.__limiteEscritura?.(d, c);
  if (limite !== undefined && t.length > limite) throw new Error(`QuotaExceededError (${c}: ${t.length} > ${limite})`);
  g.__ls(d).set(c, t);
};
const navegador: Almacen = {
  tipo: 'navegador',
  async leer<T>(c: string) {
    return leer<T>(c);
  },
  async escribir(c: string, v: unknown) {
    escribir(c, JSON.stringify(v));
  },
  async leerTexto(c: string) {
    if (g.__fallaLectura?.(d, c)) throw new Error(`no se pudo leer ${c}`);
    return g.__ls(d).get(c);
  },
  async escribirTexto(c: string, t: string) {
    escribir(c, t);
  },
  // (0.12: compare and write in one synchronous call, as localStorage does)
  async escribirTextoSi(c: string, esperado: string | undefined, t: string) {
    if (g.__ls(d).get(c) !== esperado) return false;
    escribir(c, t);
    return true;
  },
};
const tauri: Almacen = {
  tipo: 'tauri',
  async leer<T>(c: string) {
    await ipc();
    return leer<T>(c);
  },
  async escribir(c: string, v: unknown) {
    // (serialised when the call is made, as the IPC does; `__alEscribir(d, c)`: the reader acting during the wait)
    const t = JSON.stringify(v);
    (globalThis as { __alEscribir?: (d: string, c: string) => void }).__alEscribir?.(d, c);
    await ipc();
    escribir(c, t);
  },
};
export function obtenerAlmacen(): Promise<Almacen> {
  return Promise.resolve(g.__tipoAlmacen?.(d) === 'tauri' ? tauri : navegador);
}
export function enTauri(): boolean {
  return g.__tipoAlmacen?.(d) === 'tauri';
}

// (0.12: the registry of pending writes of the real almacen.ts; not used here)
export function registrarVolcado(_f: () => Promise<unknown>): () => void {
  return () => {};
}
