// The synchronisation document and its merge (pure functions, no DOM: also used by the tests in Node).
//
// The document kept in the owner's private repository (JSON, UTF-8):
//   { formato: 'epa-sincronizacion', version: 1, id, actualizado, podado,
//     dispositivos: { <device id>: { nombre, ultima, version } },
//     almacenes: { <store key>: { <item id>: { t, v } | { t, x: 1 } } } }
// Every item of every store is a last-write-wins register: the entry with the larger `t` (ms) wins and,
// on equal times, the one whose canonical JSON sorts last. That is a total order, so the merge is
// commutative, associative and idempotent: any number of devices that merge in any order converge.
// A deletion is a tombstone `{ t, x: 1 }`; tombstones older than PODA_DIAS are pruned and `podado`
// records the horizon, so a device that still holds an unchanged copy of a pruned item can drop it.

export const FORMATO = 'epa-sincronizacion';
export const VERSION_DOC = 1;
/** Tombstones are kept this long (a device offline for longer may bring a deleted item back). */
export const PODA_DIAS = 90;
const DIA = 86_400_000;

export interface EntradaViva {
  t: number;
  v: unknown;
}
export interface Lapida {
  t: number;
  x: 1;
}
export type Entrada = EntradaViva | Lapida;
export type Coleccion = Record<string, Entrada>;

export interface Dispositivo {
  nombre: string;
  ultima: number;
  version: string;
}

export interface DocSincronizacion {
  formato: typeof FORMATO;
  version: number;
  /** Random id given when the file is created: a new file (or another repository) is another history. */
  id: string;
  actualizado: number;
  /** Tombstones older than this were removed. */
  podado: number;
  dispositivos: Record<string, Dispositivo>;
  almacenes: Record<string, Coleccion>;
}

export function esLapida(e: Entrada): e is Lapida {
  return (e as Lapida).x === 1;
}

/** JSON with the keys of every object sorted: equal data, equal text. */
export function canonico(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return '[' + v.map((x) => (x === undefined ? 'null' : canonico(x))).join(',') + ']';
  const o = v as Record<string, unknown>;
  const claves = Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort();
  return '{' + claves.map((k) => JSON.stringify(k) + ':' + canonico(o[k])).join(',') + '}';
}

/** 53-bit hash (cyrb53) of the canonical JSON of a value, as base 36. */
export function huella(v: unknown): string {
  const s = canonico(v);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** The winner of two entries of the same item (total order: time, then canonical text). */
export function ganadora(a: Entrada | undefined, b: Entrada | undefined): Entrada | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.t !== b.t) return a.t > b.t ? a : b;
  const ca = canonico(a);
  const cb = canonico(b);
  return ca >= cb ? a : b;
}

export function fusionarColecciones(a: Coleccion | undefined, b: Coleccion | undefined): Coleccion {
  const r: Coleccion = {};
  for (const [id, e] of Object.entries(a ?? {})) if (entradaValida(e)) r[id] = e;
  for (const [id, e] of Object.entries(b ?? {})) {
    if (!entradaValida(e)) continue;
    r[id] = ganadora(r[id], e)!;
  }
  return r;
}

export function entradaValida(e: unknown): e is Entrada {
  if (!e || typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  if (typeof o.t !== 'number' || !Number.isFinite(o.t)) return false;
  return o.x === 1 || 'v' in o;
}

/** Keeps only the `maximo` newest live items (tombstones are kept: they are small and get pruned). */
export function limitar(c: Coleccion, maximo: number | undefined): Coleccion {
  if (!maximo) return c;
  const vivas = Object.entries(c).filter(([, e]) => !esLapida(e));
  if (vivas.length <= maximo) return c;
  vivas.sort((x, y) => (ganadora(x[1], y[1]) === x[1] ? -1 : 1));
  const fuera = new Set(vivas.slice(maximo).map(([id]) => id));
  const r: Coleccion = {};
  for (const [id, e] of Object.entries(c)) if (!fuera.has(id)) r[id] = e;
  return r;
}

/** Removes tombstones older than the horizon; returns whether something was removed. */
export function podar(c: Coleccion, horizonte: number): boolean {
  let algo = false;
  for (const [id, e] of Object.entries(c)) {
    if (esLapida(e) && e.t < horizonte) {
      delete c[id];
      algo = true;
    }
  }
  return algo;
}

export function horizontePoda(ahora: number): number {
  return ahora - PODA_DIAS * DIA;
}

export function docVacio(id: string, ahora: number): DocSincronizacion {
  return { formato: FORMATO, version: VERSION_DOC, id, actualizado: ahora, podado: 0, dispositivos: {}, almacenes: {} };
}

/** Reads a document from its text; throws a Spanish message when it is not one. */
export function leerDoc(texto: string): DocSincronizacion {
  let d: unknown;
  try {
    d = JSON.parse(texto);
  } catch {
    throw new Error('el fichero no es JSON válido');
  }
  if (!d || typeof d !== 'object') throw new Error('el fichero no contiene un objeto JSON');
  const o = d as Partial<DocSincronizacion>;
  if (o.formato !== FORMATO) throw new Error(`el fichero no es de sincronización («formato» ≠ «${FORMATO}»)`);
  if (typeof o.version !== 'number' || o.version > VERSION_DOC)
    throw new Error(`el fichero tiene la versión ${String(o.version)} del formato; actualice la aplicación`);
  const almacenes: Record<string, Coleccion> = {};
  for (const [k, c] of Object.entries(o.almacenes ?? {})) {
    if (!c || typeof c !== 'object') continue;
    almacenes[k] = fusionarColecciones(c as Coleccion, undefined);
  }
  return {
    formato: FORMATO,
    version: VERSION_DOC,
    id: typeof o.id === 'string' && o.id ? o.id : 'sin-id',
    actualizado: Number(o.actualizado) || 0,
    podado: Number(o.podado) || 0,
    dispositivos: o.dispositivos && typeof o.dispositivos === 'object' ? o.dispositivos : {},
    almacenes,
  };
}

/** The text written to the repository: stable key order, one level of indentation (readable diffs). */
export function escribirDoc(d: DocSincronizacion): string {
  return JSON.stringify(JSON.parse(canonico(d)), null, 1) + '\n';
}

/** Merges two whole documents (the device list by last time seen, every store item by item). */
export function fusionarDocs(a: DocSincronizacion, b: DocSincronizacion, maximos: Record<string, number> = {}): DocSincronizacion {
  const almacenes: Record<string, Coleccion> = {};
  const claves = new Set([...Object.keys(a.almacenes), ...Object.keys(b.almacenes)]);
  for (const k of [...claves].sort()) almacenes[k] = limitar(fusionarColecciones(a.almacenes[k], b.almacenes[k]), maximos[k]);
  const dispositivos: Record<string, Dispositivo> = { ...a.dispositivos };
  for (const [id, d] of Object.entries(b.dispositivos)) {
    const x = dispositivos[id];
    if (!x || d.ultima > x.ultima || (d.ultima === x.ultima && canonico(d) > canonico(x))) dispositivos[id] = d;
  }
  return {
    ...a,
    actualizado: Math.max(a.actualizado, b.actualizado),
    podado: Math.max(a.podado, b.podado),
    dispositivos,
    almacenes,
  };
}

/** Same stores and items (devices and times of the document itself are ignored). */
export function mismosAlmacenes(a: DocSincronizacion | null, b: DocSincronizacion): boolean {
  if (!a) return false;
  const vacios = (d: DocSincronizacion) =>
    Object.fromEntries(Object.entries(d.almacenes).filter(([, c]) => Object.keys(c).length > 0));
  return canonico(vacios(a)) === canonico(vacios(b)) && a.podado === b.podado;
}

// ------------------------------------------------------------------ versions (update notice)

/** «v0.7.1», «0.7.1» → [0, 7, 1]; null when it is not X.Y.Z (a pre-release suffix is ignored). */
export function leerVersion(v: string | null | undefined): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec((v ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** > 0 when a is newer than b. */
export function compararVersiones(a: string, b: string): number {
  const x = leerVersion(a);
  const y = leerVersion(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
  return 0;
}
