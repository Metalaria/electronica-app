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

import { FORMATO_DATOS, migrarColecciones } from '../esquemas';

export const FORMATO = 'epa-sincronizacion';
/**
 * 1: up to 0.12. 2: 1.0 (lib/esquemas.ts FORMATO_DATOS) — the same document; its stores in the 1.0 schemas. A file of
 * version 1 is read with the migrations of lib/esquemas.ts (`leerDoc`) and written back as 2. Why a new version and the
 * same path (ESQUEMA.md «Transition from 0.12»): 0.12.0's `leerDoc` refuses any version above 1 — «actualice la
 * aplicación», nothing written, every run of a 0.12 device stops before its PUT, also after a 409 — so a 0.12 device
 * can never write its older shapes over a 1.0 file, and its changes wait on it until it is updated (no loss).
 */
export const VERSION_DOC = FORMATO_DATOS;
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
  /**
   * 1.0: the data format this device writes (VERSION_DOC). A device without it last synchronised with an older version
   * (0.12 never writes a file of format 2): it must be updated before it can synchronise again (the Sincronización page
   * names it).
   */
  datos?: number;
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

/** A store's merge of two versions of an item (registro.svelte.ts `unir`), with the check of its values. */
export interface Union {
  unir: (a: unknown, b: unknown) => unknown;
  valido?: (v: unknown) => boolean;
}

/**
 * Merges two collections item by item: last write wins — except, with `union`, two live versions of an item that the
 * store knows how to merge (both valid): their merge, kept as `a`'s entry when it equals `a`'s value (the engine
 * passes the file as `a`, so nothing changes there), else dated max(tₐ, t_b) + 1 so it outdates both. The merge must
 * be commutative, associative and idempotent (a union, a total order), so every device reaches the same value.
 */
export function fusionarColecciones(a: Coleccion | undefined, b: Coleccion | undefined, union?: Union): Coleccion {
  const r: Coleccion = {};
  for (const [id, e] of Object.entries(a ?? {})) if (entradaValida(e)) r[id] = e;
  for (const [id, e] of Object.entries(b ?? {})) {
    if (!entradaValida(e)) continue;
    const x = r[id];
    if (union && x && !esLapida(x) && !esLapida(e)) {
      const u = unidos(union, x.v, e.v);
      if (u !== undefined) {
        const hu = huella(u);
        if (hu !== huella(x.v)) r[id] = { t: Math.max(x.t, e.t) + 1, v: u };
        continue;
      }
    }
    r[id] = ganadora(x, e)!;
  }
  return r;
}

function unidos(union: Union, a: unknown, b: unknown): unknown {
  if (union.valido && (!union.valido(a) || !union.valido(b))) return undefined;
  try {
    const u = union.unir(a, b);
    return u === undefined || (union.valido && !union.valido(u)) ? undefined : u;
  } catch {
    return undefined;
  }
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
  if (o.version < 1 || !Number.isInteger(o.version)) throw new Error(`el fichero tiene una versión del formato no válida (${String(o.version)})`);
  let almacenes: Record<string, Coleccion> = {};
  for (const [k, c] of Object.entries(o.almacenes ?? {})) {
    if (!c || typeof c !== 'object') continue;
    almacenes[k] = fusionarColecciones(c as Coleccion, undefined);
  }
  if (o.version < VERSION_DOC) {
    // (an older app's file: its stores in this version's schemas — lib/esquemas.ts; a migration that fails stops the
    // run, so nothing is ever written from a half-migrated file)
    const m = migrarColecciones(almacenes, o.version);
    if (m.fallidas.length) throw new Error(`no se han podido convertir los datos de la versión ${o.version} del formato (${m.fallidas.join(', ')})`);
    almacenes = Object.fromEntries(Object.entries(m.almacenes).map(([k, c]) => [k, fusionarColecciones(c as Coleccion, undefined)]));
  }
  const doc: DocSincronizacion = {
    formato: FORMATO,
    version: VERSION_DOC,
    id: typeof o.id === 'string' && o.id ? o.id : 'sin-id',
    actualizado: Number(o.actualizado) || 0,
    podado: Number(o.podado) || 0,
    dispositivos: dispositivosValidos(o.dispositivos),
    almacenes,
  };
  if (o.version < VERSION_DOC) migrados.set(doc, o.version);
  return doc;
}

/** Documents read from an older format version (never written into the file). */
const migrados = new WeakMap<DocSincronizacion, number>();

/**
 * The format version a document was read from when it was older than this app's (`leerDoc`), else undefined: the run
 * then writes the file even with nothing new in it, so the file is in the new format from the first 1.0 run on and the
 * devices still on 0.12 are told at once to update (and never keep writing the old one in between).
 */
export function migradoDe(d: DocSincronizacion): number | undefined {
  return migrados.get(d);
}

/**
 * The file's devices, only well-formed entries ({nombre, ultima, version}; sixth review: a null entry made every run of
 * every 0.11 device throw, and the merge kept it in the file for ever). A damaged entry is dropped (that device puts
 * itself back at its next run).
 */
export function dispositivosValidos(x: unknown): Record<string, Dispositivo> {
  const r: Record<string, Dispositivo> = {};
  if (!x || typeof x !== 'object' || Array.isArray(x)) return r;
  for (const [id, d] of Object.entries(x as Record<string, unknown>)) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) continue;
    const e = d as Partial<Dispositivo>;
    if (typeof e.nombre !== 'string' || typeof e.ultima !== 'number' || !Number.isFinite(e.ultima)) continue;
    r[id] = { nombre: e.nombre, ultima: e.ultima, version: typeof e.version === 'string' ? e.version : '', ...(typeof e.datos === 'number' && Number.isInteger(e.datos) ? { datos: e.datos } : {}) };
  }
  return r;
}

/** The text written to the repository: stable key order, one level of indentation (readable diffs). */
export function escribirDoc(d: DocSincronizacion): string {
  return JSON.stringify(JSON.parse(canonico(d)), null, 1) + '\n';
}

/**
 * Merges two whole documents (the device list by last time seen, every store item by item; `uniones`: the stores
 * whose items are merged rather than replaced, see fusionarColecciones — `a` is the file).
 */
export function fusionarDocs(a: DocSincronizacion, b: DocSincronizacion, maximos: Record<string, number> = {}, uniones: Record<string, Union> = {}): DocSincronizacion {
  const almacenes: Record<string, Coleccion> = {};
  const claves = new Set([...Object.keys(a.almacenes), ...Object.keys(b.almacenes)]);
  for (const k of [...claves].sort()) almacenes[k] = limitar(fusionarColecciones(a.almacenes[k], b.almacenes[k], uniones[k]), maximos[k]);
  const dispositivos: Record<string, Dispositivo> = dispositivosValidos(a.dispositivos);
  for (const [id, d] of Object.entries(dispositivosValidos(b.dispositivos))) {
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

// ------------------------------------------------------------------ one store in a run (sincronizar.svelte.ts)
//
// The engine's per-store rules, pure so the tests can simulate several devices in Node.

/**
 * What `sinc-estado` keeps per item after a run: [time of the merged entry, hash of the FILE's value] and — while
 * the store keeps something else than the file — [time, hash, how many runs in a row it did so against this same
 * file value, hash of that file value]. A local value whose hash differs from the recorded one is a change and is
 * sent with a new time: so a store that normalises a value sends its form once. An item the store could not take
 * (its `aplicar` failed) or rejects (`valido`) is recorded as [file time − 1, hash of what the store holds]: the
 * local copy loses to the file until the user changes it, and nothing is sent for it.
 */
export type Sincronizado = [number, string] | [number, string, number, string];

/**
 * The «hash» recorded for an item synchronised as deleted (a tombstone in the file that the store does not hold): a
 * later re-creation here then counts as a change made after that deletion and outdates it, whatever this device's
 * clock says. Never a real hash (those are base 36).
 */
export const BORRADO = '-';

/**
 * Runs in a row an item is sent again because its store keeps something else than the same file value. Stores whose
 * merge is deterministic converge after one; past this limit (two devices of different versions normalising a value
 * in opposite ways find the same file value again and again) the store's value is taken as synchronised, so they
 * can never write the file back and forth. A new file value starts the count again.
 */
export const REENVIOS_MAXIMOS = 3;

/**
 * The local items of one store as a collection, each dated (the rules of ESQUEMA.md «Dating a local item»):
 *   - unchanged since the last run (same hash as recorded) → the recorded time;
 *   - changed and marked (anotarCambio: an edit of the reader; every module marks its edits, lib/sincronizacion/
 *     guardado.ts does it for the modules that use it) → the larger of its own time and its mark, and never older than
 *     what was recorded + 1 (a device whose clock is behind still outdates the version it saw);
 *   - changed and not marked → not an edit of the reader (a module's stale copy written back, a version the storage
 *     could not keep): its own time, which loses to the newer version recorded; without a time of its own, the time
 *     just before the recorded one;
 *   - never synchronised and not marked → its own time; without one, «unknown age»: 1 for the store's default value
 *     (`porDefecto`), 2 for anything else (a fresh install's defaults never beat the reader's settings);
 *   - recorded but missing and marked as deleted → a tombstone at its mark (never older than the recorded + 1);
 *     recorded but missing and not marked → nothing: not deleted by the reader (a stale copy dropped it, or the
 *     synchronisation removed it and its record was not saved), so the file's version comes back or stays deleted;
 *   - recorded as deleted (`BORRADO`) and missing → that same tombstone, or one at a newer deletion mark;
 *   - not recorded, missing and marked as deleted (created and sent by a run that did not finish) → a tombstone at
 *     its mark.
 */
export function fecharLocal(
  valores: Record<string, unknown>,
  huellas: Map<string, string>,
  previos: Record<string, Sincronizado>,
  cambios: Record<string, number>,
  borrados: Record<string, number>,
  tiempo: ((v: unknown) => number | undefined) | undefined,
  ahora: number,
  porDefecto?: (id: string) => unknown,
  /**
   * Local time the last successful run started. A mark newer than it is a change made after this device recorded
   * what it last synchronised, so it outdates that record even if this clock is behind (moved past it); a mark not
   * newer was already seen by that run — kept for a store that could not be written, or made again for a change still
   * unwritten — and keeps its own time: it never outdates a newer version recorded since (third review: an old
   * pending change brought back over a deletion made later on another device).
   */
  iniciada = 0,
): Coleccion {
  const nueva = (marca: number) => marca > iniciada;
  const c: Coleccion = {};
  for (const [id, v] of Object.entries(valores)) {
    const h = huellas.get(id) ?? huella(v);
    const p = Array.isArray(previos[id]) ? previos[id] : undefined;
    let t: number;
    if (p && p[1] === h) t = p[0];
    else {
      let propio = 0;
      try {
        propio = Number(tiempo?.(v)) || 0;
      } catch {
        // a damaged local item (null, wrong shape): dated as if it had no time of its own, never stopping the run
      }
      const marca = cambios[id];
      if (marca) {
        t = Math.max(propio, marca);
        // not newer than the record: a change made after it (moved past it), or an old mark — of this value or of
        // another tab's — that never outdates it (below it, not even equal: an equal time would let the content decide)
        if (p && t <= p[0]) t = nueva(marca) ? Math.max(ahora, p[0] + 1) : Math.max(1, p[0] - 1);
      } else if (!p) {
        let defecto = false;
        try {
          defecto = !!porDefecto && huella(porDefecto(id)) === h;
        } catch {
          defecto = false;
        }
        t = propio || (defecto ? 1 : 2);
      } else t = propio && propio !== p[0] ? propio : Math.max(1, p[0] - 1);
    }
    c[id] = { t, v };
  }
  for (const [id, p] of Object.entries(previos)) {
    if (id in valores || !Array.isArray(p)) continue;
    const marca = borrados[id];
    // recorded as deleted: the same tombstone (nothing new), unless it was deleted here again since (its mark)
    if (p[1] === BORRADO) c[id] = { t: marca! > p[0] ? marca! : p[0], x: 1 };
    else if (marca) c[id] = { t: nueva(marca) ? Math.max(marca, p[0] + 1) : marca > p[0] ? marca : Math.max(1, p[0] - 1), x: 1 };
  }
  // deleted here with a mark but never recorded (created and sent by a run that did not finish): its tombstone
  for (const [id, t] of Object.entries(borrados)) if (!(id in valores) && !(id in c) && Number.isFinite(t)) c[id] = { t, x: 1 };
  return c;
}

/**
 * A local item whose value is the file's (another device sent the same value, e.g. both normalised it alike) takes the
 * file's time: no newer copy of an identical value, so nothing is written for it.
 */
export function alinearIguales(local: Coleccion, remoto: Coleccion | undefined): void {
  if (!remoto) return;
  for (const [id, e] of Object.entries(local)) {
    const r = remoto[id];
    if (!r || esLapida(e) || esLapida(r) || r.t === e.t) continue;
    if (huella(e.v) === huella(r.v)) local[id] = { t: r.t, v: e.v };
  }
}

/**
 * What a store must take from the merged collection: values that differ from what it holds (valid ones only:
 * `rechazados` lists the others) and ids to remove (tombstones, and items the merge no longer has). Items edited
 * during the run (`tocado`) are left, and so is an item whose store already kept its own value against this same file
 * value more than REENVIOS_MAXIMOS runs (`previos`): giving it again would change nothing.
 */
export function porAplicar(
  c: Coleccion,
  tiene: Map<string, string>,
  tocado: (id: string) => boolean,
  valido?: (v: unknown) => boolean,
  previos: Record<string, Sincronizado> = {},
): { poner: Record<string, unknown>; quitar: string[]; rechazados: Set<string> } {
  const poner: Record<string, unknown> = {};
  const quitar: string[] = [];
  const rechazados = new Set<string>();
  for (const [id, e] of Object.entries(c)) {
    if (tocado(id)) continue;
    if (esLapida(e)) {
      if (tiene.has(id)) quitar.push(id);
      continue;
    }
    let bueno = true;
    try {
      bueno = !valido || valido(e.v);
    } catch {
      bueno = false;
    }
    if (!bueno) {
      rechazados.add(id);
      continue;
    }
    const h = huella(e.v);
    if (tiene.get(id) === h) continue;
    const p = previos[id];
    if (p && p.length === 4 && p[2] > REENVIOS_MAXIMOS && p[3] === h && tiene.get(id) === p[1]) continue;
    poner[id] = e.v;
  }
  for (const id of tiene.keys()) if (!(id in c) && !tocado(id)) quitar.push(id);
  return { poner, quitar, rechazados };
}

/**
 * The record of one store after applying (see `Sincronizado`): for each live merged item the store holds (`despues`:
 * id → hash of what it holds now), the merged time and the file's hash — or, once the store has kept something else
 * than this same file value REENVIOS_MAXIMOS runs in a row, the store's own hash with the time just before the
 * file's (accepted as it is, and losing to the file). A live item the store does not hold is not recorded (a recorded
 * item missing locally would be read as deleted here); a tombstone of an item it does not hold is recorded as
 * [its time, BORRADO]. An item edited during the run (`tocado`) keeps its previous record,
 * so a deletion made meanwhile becomes a tombstone next time. An item the store could not take (`fallidos`: its
 * `aplicar` failed) and holds is recorded as losing to the file ([file time − 1, local hash]: the next run tries
 * again, and the local copy — which already lost — is never sent over the file's); one it does not hold is not
 * recorded (the file's version, newer, is not deleted again), and one the merge no longer has keeps its record. An
 * item the store rejects (`rechazados`) is recorded as losing to the file too.
 */
export function registroSincronizado(
  c: Coleccion,
  despues: Map<string, string>,
  previos: Record<string, Sincronizado>,
  tocado: (id: string) => boolean,
  aplicados: Set<string>,
  fallidos: Set<string> = new Set(),
  rechazados: Set<string> = new Set(),
): Record<string, Sincronizado> {
  const reg: Record<string, Sincronizado> = {};
  for (const [id, e] of Object.entries(c)) {
    const p = previos[id];
    if (tocado(id)) {
      if (p) reg[id] = p;
      continue;
    }
    if (fallidos.has(id)) {
      const l = despues.get(id);
      if (l) reg[id] = [e.t - 1, l];
      continue;
    }
    const local = despues.get(id);
    if (esLapida(e)) {
      if (!local) reg[id] = [e.t, BORRADO];
      continue;
    }
    if (!local) continue;
    if (rechazados.has(id)) {
      reg[id] = [e.t - 1, local];
      continue;
    }
    const fichero = huella(e.v);
    if (local === fichero) {
      // The file has what the store holds. If the store took it now, the devices agree: the count ends. If nothing
      // was applied, the file holds what this device sent: a count in progress goes on (a back-and-forth between two
      // devices alternates both cases, and must still reach the limit).
      reg[id] = p && p.length === 4 && !aplicados.has(id) ? [e.t, fichero, p[2], p[3]] : [e.t, fichero];
      continue;
    }
    const n = p && p.length === 4 && p[3] === fichero ? Math.min(p[2] + 1, REENVIOS_MAXIMOS + 1) : 1;
    reg[id] = n <= REENVIOS_MAXIMOS ? [e.t, fichero, n, fichero] : [e.t - 1, local, n, fichero];
  }
  for (const id of fallidos) if (!(id in c) && previos[id]) reg[id] = previos[id]!;
  return reg;
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
