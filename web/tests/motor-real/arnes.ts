// Harness for the synchronisation engine in Node: drives the REAL modules — sincronizar.svelte.ts, marcas.ts,
// github.ts, fusion.ts and guardado.ts of src/, or the engine of 0.10 (v010/, for an 0.10 device) — with one module
// graph per device and per browser tab (hooks.mjs: `?d=<name>`), a fake storage per device (falsos/almacen.ts; tabs of
// a device share it), the stores built here (falsos/registro.ts), a fake GitHub on `fetch` (409 when the sha is not the
// current one; a hook can make another device write between this run's GET and PUT) and a fake clock.
// Based on the third independent review's harness. Run by revision11-motor.spec.ts as
//   node --experimental-transform-types --no-warnings --import ./tests/motor-real/registrar.mjs tests/motor-real/correr.ts …
//
// Two kinds of store:
//   - `AlmacenSim` (`registro(…)`): the store's memory IS its storage (an object); `falla` makes `aplicar` throw before
//     changing anything, `fallaParcial` after changing memory (a module that is not atomic). For the engine's rules.
//   - `AlmacenG` (`guardado(…)`): a real `Guardado` (src/lib/sincronizacion/guardado.ts) per tab: the module's memory
//     (one per tab) apart from the device's storage, edits written with read-merge-write, the synchronisation's
//     application atomic; `globalThis.__fallaEscritura` makes the storage refuse a write.
import { escribirDoc, esLapida, leerDoc, type Coleccion, type DocSincronizacion, type Sincronizado } from '../../src/lib/sincronizacion/fusion.ts';

export type Valores = Record<string, unknown>;

const SRC = new URL('../../src/lib/sincronizacion/', import.meta.url).href;
const V010 = new URL('./v010/lib/sincronizacion/', import.meta.url).href;

// ------------------------------------------------------------------ globals of a browser page, and the clock
const g = globalThis as Record<string, unknown> & typeof globalThis;
const setTimeoutReal = globalThis.setTimeout;
/** Real delays (a request timeout); else every timer fires at once (the engine's back-offs). */
export const tiempos = { reales: false };
(g as { setTimeout: unknown }).setTimeout = (fn: (...a: unknown[]) => void, ms?: number, ...a: unknown[]) => setTimeoutReal(fn, tiempos.reales ? ms : 0, ...a);
const estado = (x: unknown) => x;
(estado as unknown as { snapshot: (x: unknown) => unknown }).snapshot = (x: unknown) => structuredClone(x);
g.$state = estado;
g.window = new EventTarget();
export const reloj = { ahora: 0 };
Date.now = () => reloj.ahora;
console.warn = () => {};

// ------------------------------------------------------------------ storage per device (tabs share their device's)
const almacenamientos = new Map<string, Map<string, string>>();
const dispositivoDe = new Map<string, string>();
g.__ls = (grafo: string) => {
  const d = dispositivoDe.get(grafo) ?? grafo;
  return almacenamientos.get(d) ?? almacenamientos.set(d, new Map()).get(d)!;
};
const fallos = new Set<string>();
g.__fallaEscritura = (grafo: string, clave: string) => fallos.has(`${dispositivoDe.get(grafo) ?? grafo}|${clave}`);
const fallosLectura = new Set<string>();
g.__fallaLectura = (grafo: string, clave: string) => fallosLectura.has(`${dispositivoDe.get(grafo) ?? grafo}|${clave}`);
/** Devices whose storage is like Tauri's plugin-store (falsos/almacen.ts). */
const tauri = new Set<string>();
g.__tipoAlmacen = (grafo: string) => (tauri.has(dispositivoDe.get(grafo) ?? grafo) ? 'tauri' : 'navegador');
export function almacenamiento(d: Disp): Map<string, string> {
  return (g.__ls as (x: string) => Map<string, string>)(d.etiqueta);
}

// ------------------------------------------------------------------ stores
export interface AlmacenSim {
  clave: string;
  /** Memory and storage at once. */
  valores: Valores;
  tiempo?: (v: unknown) => number | undefined;
  valido?: (v: unknown) => boolean;
  unir?: (a: unknown, b: unknown) => unknown;
  porDefecto?: (id: string) => unknown;
  /** What the store keeps when given `entrante` (its `aplicar`, item by item); default `entrante`. */
  tomar?: (local: unknown, entrante: unknown) => unknown;
  /** `aplicar` throws before changing anything. */
  falla?: boolean;
  /** `aplicar` changes the values, then throws (not atomic). */
  fallaParcial?: boolean;
  /** Called by `aplicar` (an edit elsewhere while it applies). */
  alAplicar?: () => void;
  guardado?: false;
}

/** A store of a module with a `Guardado`: memory per tab, storage per device (key `g:<clave>`). */
export interface AlmacenG {
  guardado: true;
  clave: string;
  tiempo?: (v: unknown) => number | undefined;
  valido?: (v: unknown) => boolean;
  unir?: (a: unknown, b: unknown) => unknown;
  porDefecto?: (id: string) => unknown;
  /** The Guardado reads the memory itself (no copy) and writes the items' texts, as `guardadoDeRegistro` does. */
  vivo?: boolean;
}

export type Almacen = AlmacenSim | AlmacenG;

export const registro = (clave: string, extra: Partial<AlmacenSim> = {}): AlmacenSim => ({ clave, valores: {}, ...extra });
export const guardado = (clave: string, extra: Partial<AlmacenG> = {}): AlmacenG => ({ guardado: true, clave, ...extra });

interface ModGuardado {
  Guardado: new (o: unknown) => { cargar(adoptar?: (m: Valores) => void): Promise<Valores>; escribir(): Promise<void>; refrescar(): Promise<void> };
  sincronizableGuardado: (g: unknown, o: unknown) => { leer(): Promise<Valores>; aplicar(p: Valores, q: string[]): Promise<void> };
}

interface Motor {
  sincronizar: (manual?: boolean) => Promise<boolean>;
  sinc: { error: string };
  anotarCambio: (k: string, id: string, t?: number) => void;
  anotarBorrado: (k: string, id: string | string[], t?: number) => void;
}

/** A tab of a device: its own module graph (engine, marks, Guardados) and its own memory of the `AlmacenG` stores. */
export class Pestana {
  motor!: Motor;
  memoria = new Map<string, Valores>();
  guardados = new Map<string, InstanceType<ModGuardado['Guardado']>>();
  sincronizables: unknown[] = [];
  constructor(
    readonly disp: Disp,
    readonly grafo: string,
  ) {}
  /** The tab's memory of a `guardado` store. */
  mem(clave: string): Valores {
    return this.memoria.get(clave)!;
  }
  /** The reader changes items in this tab: written as the module does (read-merge-write, marks). */
  async editar(clave: string, cambios: Valores, quitar: string[] = []): Promise<void> {
    const m = this.mem(clave);
    Object.assign(m, structuredClone(cambios));
    for (const id of quitar) delete m[id];
    await this.guardados.get(clave)!.escribir();
  }
}

export class Disp {
  pestanas: Pestana[] = [];
  etiqueta = '';
  constructor(
    public nombre: string,
    public almacenes: Almacen[],
    /** Clock offset of this device (ms). */
    public desfase = 0,
    public version: '0.11' | '0.10' = '0.11',
  ) {}
  get motor(): Motor {
    return this.pestanas[0]!.motor;
  }
  /** A store's values: an `AlmacenSim`'s object, or what the storage holds for an `AlmacenG`. */
  almacen(k: string): AlmacenSim {
    const s = this.almacenes.find((x) => x.clave === k)!;
    if (!s.guardado) return s;
    const ls = almacenamiento(this);
    return { clave: k, get valores() {
      const v = ls.get(`g:${k}`);
      return v ? (JSON.parse(v) as Valores) : {};
    } } as AlmacenSim;
  }
  cambio(k: string, id: string, t: number): void {
    this.motor.anotarCambio(k, id, t);
  }
  borrado(k: string, id: string, t: number): void {
    this.motor.anotarBorrado(k, id, t);
  }
  /** `sinc-estado` as stored (items and «borrado» records together). */
  get estado(): { doc: string; items: Record<string, Record<string, Sincronizado>> } {
    const v = almacenamiento(this).get('sinc-estado');
    const e = v ? (JSON.parse(v) as { doc?: string; items?: Record<string, Record<string, Sincronizado>>; borrados?: Record<string, Record<string, number>> }) : {};
    const items = structuredClone(e.items ?? {});
    for (const [k, ids] of Object.entries(e.borrados ?? {})) for (const [id, t] of Object.entries(ids)) (items[k] ??= {})[id] = [t, '-'];
    return { doc: e.doc ?? '', items };
  }
  get marcas() {
    const v = almacenamiento(this).get('sinc-marcas');
    return v ? JSON.parse(v) : { cambios: {}, borrados: {} };
  }
}

// the stores of each graph, for falsos/registro.ts
const pestanaDe = new Map<string, Pestana>();
interface Ctx {
  d: Disp;
  leer: number;
  o: OpcionesPasada;
  hecho: boolean;
}
let ctx: Ctx | null = null;
/** Counts the reads of the stores in a run: the first after the PUT triggers `durante` / `interrumpir`. */
function contarLectura(d: Disp): void {
  if (!ctx || ctx.d !== d) return;
  ctx.leer++;
  if (ctx.leer === d.almacenes.length + 1 && !ctx.hecho) {
    ctx.hecho = true;
    if (ctx.o.interrumpir) throw new Error('cortada');
    ctx.o.durante?.();
  }
}
g.__stores = (grafo: string) => pestanaDe.get(grafo)!.sincronizables;

function adaptador(p: Pestana, s: AlmacenSim) {
  const d = p.disp;
  return {
    clave: s.clave,
    nombre: s.clave,
    tiempo: s.tiempo,
    valido: s.valido,
    porDefecto: s.porDefecto,
    ...(s.unir && d.version === '0.11' ? { unir: s.unir } : {}),
    async leer() {
      contarLectura(d);
      return structuredClone(s.valores);
    },
    async aplicar(poner: Valores, quitar: string[]) {
      if (s.falla) throw new Error('quota');
      s.alAplicar?.();
      for (const [id, v] of Object.entries(structuredClone(poner))) s.valores[id] = s.tomar ? s.tomar(s.valores[id], v) : v;
      for (const id of quitar) delete s.valores[id];
      if (s.fallaParcial) throw new Error('quota al guardar');
    },
  };
}

async function montarPestana(d: Disp, grafo: string): Promise<Pestana> {
  const p = new Pestana(d, grafo);
  pestanaDe.set(grafo, p);
  dispositivoDe.set(grafo, d.etiqueta);
  const base = d.version === '0.10' ? V010 : SRC;
  const q = `?d=${grafo}`;
  const s = await import(base + 'sincronizar.svelte.ts' + q);
  const m = await import(base + 'marcas.ts' + q);
  p.motor = { sincronizar: s.sincronizar, sinc: s.sinc, anotarCambio: m.anotarCambio, anotarBorrado: m.anotarBorrado };
  const mg = d.version === '0.11' ? ((await import(SRC + 'guardado.ts' + q)) as ModGuardado) : null;
  for (const a of d.almacenes) {
    if (!a.guardado) {
      p.sincronizables.push(adaptador(p, a));
      continue;
    }
    if (!mg) throw new Error('un almacén con Guardado necesita el motor de la 0.11');
    const memoria: Valores = {};
    p.memoria.set(a.clave, memoria);
    const gd = new mg.Guardado({
      claveAlmacen: `g:${a.clave}`,
      claveSinc: a.clave,
      deAlmacen: (v: unknown) => (v && typeof v === 'object' ? (v as Valores) : {}),
      aAlmacen: (mapa: Valores) => mapa,
      leerMemoria: () => structuredClone(memoria),
      ...(a.vivo
        ? {
            leerVivo: () => memoria,
            textoAlmacen: (textos: [string, string][]) => '{' + textos.map(([id, t]) => JSON.stringify(id) + ':' + t).join(',') + '}',
          }
        : {}),
      cambiarMemoria: (poner: Valores, quitar: string[]) => {
        Object.assign(memoria, structuredClone(poner));
        for (const id of quitar) delete memoria[id];
      },
      tiempo: a.tiempo,
      unir: a.unir,
    });
    await gd.cargar((m: Valores) => Object.assign(memoria, m));
    p.guardados.set(a.clave, gd);
    const real = mg.sincronizableGuardado(gd, { clave: a.clave, nombre: a.clave, tiempo: a.tiempo, valido: a.valido, porDefecto: a.porDefecto });
    p.sincronizables.push({
      ...real,
      ...(a.unir ? { unir: a.unir } : {}),
      async leer() {
        contarLectura(d);
        return real.leer();
      },
    });
  }
  d.pestanas.push(p);
  return p;
}

let n = 0;
/** A device with one tab. `version`: its engine (0.10: only `AlmacenSim` stores). */
export async function nuevoDisp(nombre: string, almacenes: Almacen[], desfase = 0, version: '0.11' | '0.10' = '0.11', o: { tauri?: boolean } = {}): Promise<Disp> {
  const d = new Disp(nombre, almacenes, desfase, version);
  d.etiqueta = `${nombre}_${++n}`;
  if (o.tauri) tauri.add(d.etiqueta);
  await montarPestana(d, d.etiqueta);
  return d;
}

/** Another tab of the device (same storage, its own memory, engine and marks). */
export async function nuevaPestana(d: Disp): Promise<Pestana> {
  return montarPestana(d, `${d.etiqueta}_t${++n}`);
}

/** The same device (storage and stores) now runs another version of the engine (an update, or going back). */
export async function cambiarVersion(d: Disp, version: '0.11' | '0.10'): Promise<void> {
  d.version = version;
  d.pestanas = [];
  await montarPestana(d, `${d.etiqueta}_v${++n}`);
}

/** The storage refuses (or accepts again) writes of a key on a device (`g:<clave>` for an `AlmacenG`). */
/**
 * A module's `guardadoDeRegistro` of the real guardado.ts in the device's first graph (its marks are the first tab's),
 * over a plain memory record — not loaded (the test calls `cargar` when it wants).
 */
export async function guardadoSuelto(d: Disp, clave: string, o: { tiempo?: (v: unknown) => number | undefined } = {}) {
  const mod = (await import(SRC + 'guardado.ts' + `?d=${d.pestanas[0]!.grafo}`)) as {
    guardadoDeRegistro(o: unknown): {
      cargar(adoptar?: (m: Valores) => void): Promise<Valores>;
      escribir(): Promise<void>;
      guardar(espera?: number): void;
      volcar(): Promise<void>;
      refrescar(): Promise<void>;
      aplicar(p: Valores, q: string[]): Promise<void>;
      medidas: { rapidas: number; completas: number };
    };
  };
  const memoria = { m: {} as Valores };
  const g = mod.guardadoDeRegistro({ claveAlmacen: clave, claveSinc: clave, obtener: () => memoria.m, tiempo: o.tiempo });
  return { g, memoria };
}

/** The device's storage is like Tauri's (no texts, IPC round trips). */
export function esTauri(d: Disp): boolean {
  return tauri.has(d.etiqueta);
}

/** The storage refuses (or accepts again) reads of a key on a device (an IPC error). */
export function fallarLectura(d: Disp, clave: string, si = true): void {
  if (si) fallosLectura.add(`${d.etiqueta}|${clave}`);
  else fallosLectura.delete(`${d.etiqueta}|${clave}`);
}

export function fallarEscritura(d: Disp, clave: string, si = true): void {
  if (si) fallos.add(`${d.etiqueta}|${clave}`);
  else fallos.delete(`${d.etiqueta}|${clave}`);
}

// ------------------------------------------------------------------ the repository on a fake GitHub
export class Repo {
  doc: DocSincronizacion | null = null;
  texto?: string;
  sha?: number;
  commits = 0;
  /** Called once at the next PUT, before it is accepted (another device writes first: 409 and retry). */
  antesDePut?: () => Promise<void>;
  /** The GETs never answer (a hung request). */
  colgado = false;
  /** The live values of a store in the file. */
  vivos(k: string): Valores {
    const c: Coleccion = this.doc?.almacenes[k] ?? {};
    return Object.fromEntries(Object.entries(c).filter(([, e]) => !esLapida(e)).map(([id, e]) => [id, (e as { v: unknown }).v]));
  }
  /** The file is deleted on GitHub. */
  borrar(): void {
    this.texto = undefined;
    this.doc = null;
  }
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let repoActual: Repo | null = null;
g.fetch = async (url: string | URL, init: RequestInit = {}) => {
  const r = repoActual!;
  const u = new URL(String(url));
  const contenido = u.pathname.includes('/contents/');
  if ((init.method ?? 'GET') === 'GET') {
    if (r.colgado)
      return new Promise<Response>((_ok, mal) => {
        init.signal?.addEventListener('abort', () => mal(new DOMException('The operation was aborted.', 'AbortError')));
      });
    if (!contenido) return json(200, { full_name: 'x', private: true });
    if (r.texto == null) return json(404, { message: 'Not Found' });
    return json(200, { type: 'file', sha: `s${r.sha}`, encoding: 'base64', content: Buffer.from(r.texto, 'utf8').toString('base64') });
  }
  if (r.antesDePut) {
    const f = r.antesDePut;
    r.antesDePut = undefined;
    await f();
  }
  const b = JSON.parse(String(init.body)) as { sha?: string; content: string };
  const actual = r.texto == null ? undefined : `s${r.sha}`;
  if (b.sha !== actual) return json(409, { message: 'conflict' });
  r.texto = Buffer.from(b.content, 'base64').toString('utf8');
  r.sha = (r.sha ?? 0) + 1;
  r.doc = leerDoc(r.texto);
  r.commits++;
  return json(200, { content: { sha: `s${r.sha}` } });
};

export interface OpcionesPasada {
  /** Runs at the first read of a store after the PUT (an edit during the run). */
  durante?: () => void;
  /** The run stops there (app closed, a throw): nothing applied nor recorded. */
  interrumpir?: boolean;
  /** The tab that runs (default the first). */
  pestana?: Pestana;
}

export const errores: string[] = [];
export let ultimoError = '';
/** One run of the real engine on device `d` at real time `ahoraReal`. Returns whether it wrote the file. */
export async function pasada(d: Disp, repo: Repo, ahoraReal: number, o: OpcionesPasada = {}): Promise<boolean> {
  const antes = { ctx, reloj: reloj.ahora, repo: repoActual };
  ctx = { d, leer: 0, o, hecho: false };
  reloj.ahora = ahoraReal + d.desfase;
  repoActual = repo;
  const c0 = repo.commits;
  const motor = (o.pestana ?? d.pestanas[0]!).motor;
  const ok = await motor.sincronizar(true);
  ultimoError = ok ? '' : motor.sinc.error;
  if (!ok && !o.interrumpir && !/cortada|reintentará|No se pudieron leer los datos locales/.test(ultimoError)) errores.push(`${d.nombre}: ${ultimoError}`);
  ctx = antes.ctx;
  reloj.ahora = antes.reloj;
  repoActual = antes.repo;
  return repo.commits > c0;
}

export function nuevoRepo(): Repo {
  return new Repo();
}
export { escribirDoc };
