// Fake browser globals: localStorage (Map of strings), window/document event targets, timers left real.
const g = globalThis as any;
export const datos = new Map<string, string>();
g.localStorage = {
  getItem: (k: string) => (datos.has(k) ? datos.get(k)! : null),
  setItem: (k: string, v: string) => { escrituras.push(k); datos.set(k, String(v)); },
  removeItem: (k: string) => { datos.delete(k); },
  key: (i: number) => [...datos.keys()][i] ?? null,
  get length() { return datos.size; },
};
export const escrituras: string[] = [];
g.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const w = new EventTarget() as any;
w.location = { hash: '', href: 'http://x/', search: '' };
w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
w.requestIdleCallback = (f: any) => setTimeout(f, 0);
w.localStorage = g.localStorage;
g.window = w;
g.location = w.location;
const d = new EventTarget() as any;
d.visibilityState = 'visible';
d.documentElement = { dataset: {}, style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} } };
d.querySelector = () => null;
g.document = d;
g.addEventListener = w.addEventListener.bind(w);
g.dispatchEvent = w.dispatchEvent.bind(w);
g.fetch = async () => { throw new Error('sin red'); };
g.CustomEvent ??= class extends Event { detail: any; constructor(t: string, o?: any) { super(t); this.detail = o?.detail; } };
console.warn = () => {};

// EPA_TAURI=1: the app runs as in Tauri (desktop, Android): `window.__TAURI_INTERNALS__` answers the plugin-store's
// IPC (load, get, set…; every call a round trip, values copied) over the same map — `lector.json`'s keys as `epa:<key>`,
// `credenciales.json`'s token as `epa-credencial:github` — so fixtures and checks are the same for both (fifth review:
// the Tauri path was untested).
if (process.env.EPA_TAURI === '1') {
  const rutas = new Map<number, string>();
  const clave = (rid: number, k: string) => (rutas.get(rid) === 'credenciales.json' ? `epa-credencial:${k}` : `epa:${k}`);
  // (EPA_IPC_MS: each IPC round trip takes that long — a slow disk or a busy phone; 0.12, tests/actualizacion/salir.ts)
  const ipc = () => new Promise<void>((r) => setTimeout(r, Number(process.env.EPA_IPC_MS ?? 0)));
  w.__TAURI_INTERNALS__ = {
    async invoke(cmd: string, a: Record<string, any> = {}) {
      await ipc();
      switch (cmd) {
        case 'plugin:store|load':
        case 'plugin:store|get_store': {
          const rid = rutas.size + 1;
          rutas.set(rid, a.path);
          return rid;
        }
        case 'plugin:store|get': {
          const v = datos.get(clave(a.rid, a.key));
          if (v == null) return [null, false];
          const texto = rutas.get(a.rid) === 'credenciales.json' ? JSON.stringify(v) : v;
          return [JSON.parse(texto), true];
        }
        case 'plugin:store|set': {
          const k = clave(a.rid, a.key);
          escrituras.push(k);
          datos.set(k, rutas.get(a.rid) === 'credenciales.json' ? String(a.value) : JSON.stringify(a.value));
          return null;
        }
        default:
          return null;
      }
    },
    transformCallback: () => 0,
  };
}
