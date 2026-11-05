// Fake lib/almacen.ts for the randomized Guardado simulation (guardado-azar.ts; sixth review), replacing the module
// with EPA_SUSTITUIR='src/lib/almacen.ts=tests/motor-real/falsos/almacen-ipc.ts'. EPA_ALMACEN=tauri: like the
// plugin-store (values, no texts, every call an IPC round trip of `globalThis.__ipcMs` ms); otherwise like
// localStorage (texts, synchronous). `__tauri`: the stored JSON texts. `__fallaLeer(c, n)` / `__fallaEscribir(c, n)`
// (n: the call number for that key, from 1) make a call throw; `__alEscribir(c)` runs inside a write's IPC wait.
const g = globalThis as any;
g.__tauri ??= new Map<string, string>();
g.__ipcMs ??= 1;
g.__n ??= new Map<string, number>();
const tauri = process.env.EPA_ALMACEN === 'tauri';
const ipc = () => (tauri ? new Promise<void>((r) => setTimeout(r, g.__ipcMs)) : Promise.resolve());
const cuenta = (k: string) => {
  const n = (g.__n.get(k) ?? 0) + 1;
  g.__n.set(k, n);
  return n;
};
export interface Almacen {
  leer<T>(c: string): Promise<T | undefined>;
  escribir(c: string, v: unknown): Promise<void>;
  leerTexto?(c: string): Promise<string | undefined>;
  escribirTexto?(c: string, t: string): Promise<void>;
  escribirTextoSi?(c: string, esperado: string | undefined, t: string): Promise<boolean>;
  readonly tipo: 'tauri' | 'navegador' | 'memoria';
}
const comun = {
  async leer<T>(c: string) {
    const n = cuenta('l:' + c);
    await ipc();
    if (g.__fallaLeer?.(c, n)) throw new Error('IPC get failed ' + c);
    const v = g.__tauri.get(c);
    return v === undefined ? undefined : (JSON.parse(v) as T);
  },
  async escribir(c: string, v: unknown) {
    const n = cuenta('e:' + c);
    const t = JSON.stringify(v);
    g.__alEscribir?.(c);
    await ipc();
    if (g.__fallaEscribir?.(c, n)) throw new Error('IPC set failed ' + c);
    g.__tauri.set(c, t);
  },
};
const a: Almacen = tauri
  ? { tipo: 'tauri', ...comun }
  : {
      tipo: 'navegador',
      ...comun,
      async leerTexto(c: string) {
        const n = cuenta('l:' + c);
        if (g.__fallaLeer?.(c, n)) throw new Error('get failed ' + c);
        return g.__tauri.get(c);
      },
      async escribirTexto(c: string, t: string) {
        const n = cuenta('e:' + c);
        g.__alEscribir?.(c);
        if (g.__fallaEscribir?.(c, n)) throw new Error('QuotaExceededError ' + c);
        g.__tauri.set(c, t);
      },
      // (0.12: compare and write in one synchronous call, as localStorage does)
      async escribirTextoSi(c: string, esperado: string | undefined, t: string) {
        const n = cuenta('e:' + c);
        g.__alEscribir?.(c);
        if (g.__fallaEscribir?.(c, n)) throw new Error('QuotaExceededError ' + c);
        if (g.__tauri.get(c) !== esperado) return false;
        g.__tauri.set(c, t);
        return true;
      },
    };
export function obtenerAlmacen(): Promise<Almacen> {
  return Promise.resolve(a);
}
export function enTauri() {
  return tauri;
}

// (0.12: the registry of pending writes of the real almacen.ts; not used here)
export function registrarVolcado(_f: () => Promise<unknown>): () => void {
  return () => {};
}
