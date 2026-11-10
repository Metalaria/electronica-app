// How a module keeps synchronised data in memory and saves it (0.11, third review). A module (bookmarks, notes,
// exercises, Repaso, lessons, the editor's circuits…) holds its data in memory and used to write the whole object
// from memory: anything another writer had put in the storage meanwhile — the synchronisation applying a store the
// module does not route (the editor's and the breadboard's circuits), another browser tab — was overwritten with the
// stale copy, and the next synchronisation spread that loss to every device. A `Guardado` per storage key fixes it
// for every module the same way:
//   - read-merge-write: every write reads the key first and merges per item with a three-way merge whose base is
//     what this module last read or wrote (lib/pestanas.ts fusionarPestanas): what only the other writer changed is
//     kept and also put in the module's memory; what both changed, the newer by the item's own time;
//   - marks: a write of the reader's changes marks (marcas.ts) the items that differ from the base — the engine then
//     knows a real edit from a stale copy (fusion.ts fecharLocal);
//   - atomic application of a synchronisation (`aplicar`): the new map is written first and the memory changed only
//     after the write succeeded, so a failed write (storage full) leaves memory and storage alike;
//   - reads, merges and writes of one key never overlap (a queue), and each step reads the memory when its turn
//     comes (fourth review: a copy made before an earlier write finished lacked what that write put in memory);
//   - cost (fourth review): an index per item (its JSON text, its hash only when the text changed); when the stored
//     text is the one this module last read or wrote, nothing is parsed or merged; a big store reads its live memory
//     and assembles the stored text from the items' texts (`leerVivo`, `textoAlmacen`).
// The module describes its data as a flat map «item id → item» (the ids of the synchronised store) with four
// functions; `sincronizableGuardado` builds the store the synchronisation registers (registro.svelte.ts).

import { obtenerAlmacen, registrarVolcado, type Almacen } from '../almacen';
import { huella } from './fusion';
import { alCambiarEnOtraPestana } from '../pestanas';
import { anotarBorrado, anotarCambio, marcaDe, volcarMarcas } from './marcas';
import { RETENCIONES_MAX, RETENCIONES_MS, RETRASO_TREGUA, TREGUA_MS } from './tregua';

/** `Guardado.podarPropios`: more entries than this and the oldest go, down to PROPIOS_TRAS. */
const PROPIOS_MAX = 5000;
const PROPIOS_TRAS = 4000;
/** …and never one younger than this (ms). */
const PROPIOS_EDAD = 10 * 60_000;

export type Mapa<T> = Record<string, T>;

export interface OpcionesGuardado<T> {
  /** The storage key (lib/almacen.ts). */
  claveAlmacen: string;
  /** The synchronised store's key (marks); none for data that is not synchronised. */
  claveSinc?: string;
  /** The stored value as a flat map (anything unreadable: empty). */
  deAlmacen(v: unknown): Mapa<T>;
  /** A flat map as the stored value (`anterior`: the stored value it replaces, to keep its other fields). */
  aAlmacen(m: Mapa<T>, anterior: unknown): unknown;
  /** The module's memory as a flat map (a copy). */
  leerMemoria(): Mapa<T>;
  /**
   * The memory itself, not copied (a big store: no copy per write). Only read, and within one step of the queue
   * (its items' texts are taken at once).
   */
  leerVivo?(): Mapa<T>;
  /**
   * The stored text from the items' JSON texts (id → text, in order) — what `aAlmacen` would give, without
   * serialising the items again (a big store's write: one JSON text per item, no copy).
   */
  textoAlmacen?(textos: [string, string][], anterior: unknown): string;
  /** What `aAlmacen`/`textoAlmacen` need of the stored value they replace (a big store: its other fields only). */
  anteriorLigero?(v: unknown): unknown;
  /** Changes the module's memory: items to put, ids to remove. */
  cambiarMemoria(poner: Mapa<T>, quitar: string[]): void;
  /** The item's own time (between two writers that both changed it, the newer wins). */
  tiempo?(v: T): number | undefined;
  /**
   * Merge of two versions of an item both writers changed (instead of the newer). `base`: the item as this module last
   * read or wrote it (a three-way merge: a counter keeps what each writer added — 0.12, the daily activity); `id`: the
   * item. Undefined: the default rule for this item (the newer).
   */
  unir?(a: T, b: T, base?: T, id?: string): T | undefined;
  /**
   * Items derived from others (0.12c, finding 3: the daily activity's mirror of each day, the sum of its records):
   * after a write's merge with another writer's version, called on the merged map with the ids the merge changed from
   * this tab's memory; it updates the derived items in `m` (deterministically: two tabs with the same items write the
   * same) and returns the ids it changed — written in the same step, as this tab's changes (marked). `almacen`: the
   * other writer's version as stored (the snapshot the merge read), for what must not be derived from this tab's memory
   * alone (random trial 71031: memory lagging the storage).
   */
  derivar?(m: Mapa<T>, tocados: string[], almacen?: Mapa<T>): string[];
  /**
   * After each write of the reader's changes (`escribir`, `guardar`, `volcar`, the retries): whether a write is still
   * due (it failed). The module shows it to the reader (sixth review: a failed save must never look saved).
   */
  alEstado?(sinGuardar: boolean): void;
}

/** What is known of one item: the JSON text of its value, and its hash (fusion.ts huella) once needed. */
interface Conocido {
  texto: string;
  h?: string;
}
/** id → what is known of the item. */
type Indice = Map<string, Conocido>;

const textoDe = (v: unknown): string => JSON.stringify(v) ?? 'null';
/** The item's hash (canonical: equal values with their keys in another order hash alike), computed once. */
const huellaDe = (c: Conocido): string => (c.h ??= huella(JSON.parse(c.texto)));
/** Same value: the same text, or else the same canonical hash. */
const iguales = (a: Conocido | undefined, b: Conocido | undefined): boolean =>
  a === b || (!!a && !!b && (a.texto === b.texto || huellaDe(a) === huellaDe(b)));

/**
 * The index of a map. An item whose text is the one `previo` knew keeps that entry (its hash is not computed again):
 * a write costs a JSON text per item, and a hash only for what changed (fourth review, finding 3).
 */
function indexar(m: Record<string, unknown>, previo?: Indice): Indice {
  const r: Indice = new Map();
  for (const [id, v] of Object.entries(m)) {
    const texto = textoDe(v);
    const p = previo?.get(id);
    r.set(id, p && p.texto === texto ? p : { texto });
  }
  return r;
}

/** Evidence read when another writer's version of one of this tab's own changes must be judged (`atestiguado`). */
interface Testigos {
  /** `sinc-aplicados` of the store: id → [hash or «-», time]. */
  aplicados: Record<string, unknown>;
  /** `sinc-estado` records of the store: id → [time, hash, …], and its deleted items: id → time. */
  items: Record<string, unknown>;
  borrados: Record<string, unknown>;
  /** When the run that wrote that record started (`sinc-estado.iniciada`, this device's clock; 0: unknown). */
  iniciada: number;
}

/**
 * The values and deletions applied by a synchronisation or an import lately, per store: {store: {id: [hash | «-», ms]}}
 * (0.12). Kept CADUCIDAD_APLICADOS; only in a browser (other tabs read it: Tauri has one window).
 */
export const CLAVE_APLICADOS = 'sinc-aplicados';
const CADUCIDAD_APLICADOS = 30 * 60_000;

/** A `sinc-aplicados` entry: [hash | «-», ms] and, since 0.12g, the hash the merge read for the item (or «-»). */
type EntradaAplicada = [string, number] | [string, number, string, number];

/** `sinc-aplicados` item standing for every item of a store (`anotarAplicados`, when one per item does not fit). */
const TODOS_APLICADOS = '*';
/** More items than this in one application: one entry for the whole store instead of one per item. */
const MAX_APLICADOS = 1000;

/**
 * Records what a synchronisation or an import applies (`sinc-aplicados`), BEFORE the data are written: one entry per
 * item ([hash | «-», ms], ~50 characters), or — more than MAX_APLICADOS items (the first synchronisation of a new
 * device), or if that does not fit (a nearly full quota) — one entry for the whole store (TODOS_APLICADOS: another tab
 * takes the store's versions written after it as evidence, as before 0.12). Never rejects (review 0.12c, finding 6:
 * rejecting, as 0.12b did, would block that store's synchronisation for as long as the quota stays full, where 0.11
 * applied it): if not even that fits, the data are applied without it (logged). The only consequence then is that
 * another open tab holding its own change of an applied item keeps it for now and writes it back; its mark is older
 * than the run, so the next run applies the synchronised version again (fusion.ts fecharLocal; scenario `b12·5`).
 */
async function anotarAplicados(clave: string, poner: Record<string, unknown>, quitar: string[], leidoEn: number, vistos?: Map<string, string>): Promise<void> {
  let a: Almacen;
  let v: Record<string, Record<string, EntradaAplicada>> | undefined;
  try {
    a = await obtenerAlmacen();
    if (!a.leerTexto) return;
    v = await a.leer<Record<string, Record<string, EntradaAplicada>>>(CLAVE_APLICADOS);
  } catch (e) {
    console.warn('sinc-aplicados: no se pudo leer', e);
    return;
  }
  const ahora = Date.now();
  const r: Record<string, Record<string, EntradaAplicada>> = {};
  for (const [k, ids] of Object.entries(v && typeof v === 'object' ? v : {}))
    for (const [id, x] of Object.entries(ids && typeof ids === 'object' ? ids : {}))
      if (Array.isArray(x) && typeof x[0] === 'string' && typeof x[1] === 'number' && ahora - x[1] < CADUCIDAD_APLICADOS) (r[k] ??= {})[id] = x;
  const todos = () => {
    const c = { ...r };
    // (dated when the applied data were read, not now — review 0.12d: another tab's change made during the run, after
    // that read, is not in what was applied, and must not lose to a stale copy of it on the strength of this entry)
    c[clave] = { [TODOS_APLICADOS]: [TODOS_APLICADOS, Math.min(leidoEn, ahora)] };
    return c;
  };
  const n = Object.keys(poner).length + quitar.length;
  let uno: Record<string, Record<string, EntradaAplicada>> | null = null;
  if (n <= MAX_APLICADOS) {
    uno = { ...r, [clave]: { ...(r[clave] ?? {}) } };
    // (dated when the applied data were read, as `*`: review 0.12e, finding 1 — dated when written, the entry was
    // evidence against another tab's change made after that read, which the application then wrote over unseen)
    const t = Math.min(leidoEn, ahora);
    // (and the hash the run's merge read for the item, «-» for none — review 0.12g, finding 2: a change of another tab
    // made after `leidoEn` that the merge DID read, and merged over, is superseded by what is applied: that tab takes
    // the entry as evidence by that hash — for a change made before the entry was written (`ahora`, always after the
    // merge's read): review 0.12h, finding 1, a later change of that tab back to the same value or deletion (A-B-A) is a
    // real one, and a stale copy of what was applied must not win over it)
    const entrada = (h: string, id: string): EntradaAplicada => (vistos ? [h, t, vistos.get(id) ?? '-', ahora] : [h, t]);
    for (const [id, x] of Object.entries(poner)) uno[clave]![id] = entrada(huella(x), id);
    for (const id of quitar) uno[clave]![id] = entrada('-', id);
  }
  for (const valor of uno ? [uno, todos()] : [todos()])
    try {
      await a.escribir(CLAVE_APLICADOS, valor);
      return;
    } catch {
      // (the next, smaller form)
    }
  console.warn(`sinc-aplicados: no cabe (${clave}, ${n} elementos); se aplica sin esa anotación`);
}

/** Every Guardado: the save before installing an update writes what each has pending (`registrarVolcado`). */
const guardados = new Set<Guardado<unknown>>();
registrarVolcado(() => Promise.allSettled([...guardados].map((g) => g.volcar())).then(() => volcarMarcas()));


export class Guardado<T> {
  /** What the storage held as this module last read or wrote it (the three-way merge's base). */
  private base: Indice = new Map();
  /** The stored text of the key as this module last read or wrote it: unchanged, nobody else wrote it. */
  private texto: string | undefined;
  /** The stored value as last read or written (its other fields are kept: `aAlmacen`). */
  private anterior: unknown;
  /**
   * The memory as this Guardado last left it (loaded, written, merged, applied): what differs from it at the next
   * write is the reader's doing, and is marked.
   */
  private vista: Indice = new Map();
  /**
   * The reader's changes not stored yet (their write failed: storage full): id → [time of the change, its hash or
   * null for a deletion]. They live only in this tab's memory, and the marks made for them may be forgotten by a
   * synchronisation run in another tab (which could not see them): every read for a synchronisation marks them again
   * (`refrescar`), and so does the write that finally stores them (`volcar` retries it).
   */
  private pendientes = new Map<string, [t: number, huella: string | null]>();
  /**
   * 0.12 (review finding 3): the reader's changes this tab stored, id → [hash of the value (null: deleted), time of the
   * change]. Another browser tab whose cached view of localStorage lagged can write the key over them (the compare-and-
   * set cannot see it: each tab reads its own cache); its version of such an item is taken only with evidence
   * (`atestiguado`), else the change stays here and is written again.
   */
  private propios = new Map<string, [huella: string | null, t: number]>();
  /**
   * The values this tab wrote for each of `propios`, as [hash («-»: deleted), time of the change], newest last (a few):
   * a mark with that very hash and time is this tab's own (review 0.12b, finding 1: the hash alone is not enough — the
   * same value set again later, by another tab, is a real change).
   */
  private escritos = new Map<string, [huella: string, t: number][]>();
  /**
   * Loop guard (review 0.12b, finding 1): the times this tab kept its own change of an item against another writer's
   * version without evidence. Too many in a short time (two tabs that each keep writing theirs back) and the item is
   * not written back for a while (still kept: `enTregua`; logged).
   */
  private retenciones = new Map<string, number[]>();
  private treguas = new Map<string, number>();
  private reescritura: ReturnType<typeof setTimeout> | null = null;
  /** `aplicar`: when the data it applies were read (its set of items → ms; review 0.12d, finding 1). */
  private aplicadosDesde = new WeakMap<Set<string>, number>();
  /** The ids of `propios` that are an applied version, not the reader's change (`atestiguado`). */
  private deAplicar = new Set<string>();
  /** Applied versions kept against a stale copy, still to be written (`volcar` writes them; no marks). */
  private aplicadosDebidos = new Set<string>();
  /** The storage is a browser's (other tabs write it): only there is `propios` kept and used (Tauri: one window). */
  private pestanas = false;
  private cola: Promise<unknown> = Promise.resolve();
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private siguiendo = false;
  /**
   * The key has been read successfully (by `cargar` or a write's or refresh's full read): only then can a step trust
   * that the storage is what this module last read or wrote (fifth review: in Tauri a write after a failed or
   * unfinished load took that for granted, and wrote the memory over the whole saved store).
   */
  private leido = false;
  /**
   * A reader's write that failed (its read or its write: an IPC error, the storage full): due until one succeeds —
   * `volcar` (the page hidden, before a synchronisation) writes it, and a few retries are scheduled (sixth review:
   * a write rejected at its read left no trace, and the change lived only in memory).
   */
  private debida = false;
  private reintentos = 0;
  private reintento: ReturnType<typeof setTimeout> | null = null;
  /**
   * Writes and refreshes that found the key as this module left it (no merge) and those that merged; truces of the
   * loop guard (tests).
   */
  readonly medidas = { rapidas: 0, completas: 0, treguas: 0 };

  constructor(readonly o: OpcionesGuardado<T>) {
    guardados.add(this as Guardado<unknown>);
  }

  /** One step of the queue: reads, merges and writes of the key never overlap. */
  private enCola<R>(f: () => Promise<R>): Promise<R> {
    const paso = this.cola.then(f);
    this.cola = paso.catch(() => undefined);
    return paso;
  }

  /**
   * The key as stored now — or `null` when it is known to be what this module last read or wrote: its text is the
   * same (a browser's localStorage), or nobody else writes it (one window: Tauri's store, the memory fallback).
   */
  private async leerAlmacen(a: Almacen, conocido: boolean): Promise<{ v: unknown; texto: string | undefined } | null> {
    conocido &&= this.leido;
    if (a.leerTexto) {
      const texto = await a.leerTexto(this.o.claveAlmacen);
      if (conocido && texto === this.texto) return null;
      let v: unknown;
      try {
        v = texto == null ? undefined : JSON.parse(texto);
      } catch {
        v = undefined;
      }
      return { v, texto };
    }
    if (conocido && a.tipo !== 'navegador') return null;
    return { v: await a.leer<unknown>(this.o.claveAlmacen), texto: undefined };
  }

  /**
   * What will be written, prepared at once (from the items' texts when the module can, else from the merged map): a
   * reader's edit after this moment is not in it, and differs from the vista (the next write marks it).
   */
  private preparar(a: Almacen, f: { mapa: Mapa<T>; i: Indice }, anterior: unknown): { texto?: string; valor?: unknown } {
    if (this.o.textoAlmacen) {
      const texto = this.o.textoAlmacen([...f.i].map(([id, c]) => [id, c.texto]), anterior);
      // (Tauri's store takes a value: a detached one, parsed from the texts — no second serialisation of the memory)
      return a.escribirTexto ? { texto } : { valor: JSON.parse(texto) };
    }
    const valor = this.o.aAlmacen(f.mapa, anterior);
    if (a.escribirTexto) return { texto: textoDe(valor), valor };
    // (memory may be live: a detached copy)
    return { valor: this.o.leerVivo ? JSON.parse(textoDe(valor)) : valor };
  }

  /**
   * Writes the key. `comprobar` (a browser's storage, 0.12): written only if the key still holds `esperado`, the stored
   * text this step read (undefined: absent), in one synchronous call (`escribirTextoSi`); false when another tab wrote
   * meanwhile (the step then reads and merges again: its write would have overwritten that tab's).
   */
  private async guardarAlmacen(a: Almacen, x: { texto?: string; valor?: unknown }, anterior: unknown, comprobar = false, esperado?: string): Promise<boolean> {
    if (x.texto !== undefined && a.escribirTexto) {
      if (comprobar && a.escribirTextoSi) {
        if (!(await a.escribirTextoSi(this.o.claveAlmacen, esperado, x.texto))) return false;
      } else await a.escribirTexto(this.o.claveAlmacen, x.texto);
      this.texto = x.texto;
    } else {
      await a.escribir(this.o.claveAlmacen, x.valor);
      this.texto = undefined;
    }
    // (the stored value's other fields: what `aAlmacen` keeps)
    this.anterior = this.ligero(x.valor ?? anterior);
    return true;
  }

  /** What is kept of the stored value for its other fields (not a whole copy of a big store: `anteriorLigero`). */
  private ligero(v: unknown): unknown {
    return this.o.anteriorLigero ? this.o.anteriorLigero(v) : v;
  }

  /**
   * Reads the key at load and puts it in the module's memory with `adoptar`, in the same step of the queue — a write
   * queued meanwhile runs after it and never from the memory before the load (fifth review: everything stored was
   * taken for the reader's deletions); `adoptar` keeps what the reader changed before the load. Without it, the items
   * are put in memory (`cambiarMemoria`). From then on, what another browser tab writes to the key is merged into
   * memory (the storage event; lib/pestanas.ts), so what is on screen follows. Rejects if the read fails (nothing is
   * then taken as stored: every later step reads the key first).
   */
  async cargar(adoptar?: (m: Mapa<T>) => void): Promise<Mapa<T>> {
    return this.enCola(async () => {
      const a = await obtenerAlmacen();
      const l = (await this.leerAlmacen(a, false))!;
      const m = this.leerSeguro(l.v);
      // a load again (after a failure): what the reader deleted and is not written yet is not adopted back (sixth
      // review: `{ ...stored, ...memory }` resurrected it); its deletion is marked by the next write
      const adoptado = { ...m };
      if (this.vista.size || this.pendientes.size) {
        const memoria = this.o.leerVivo?.() ?? this.o.leerMemoria();
        for (const [id, [, h]] of this.pendientes) if (h === null) delete adoptado[id];
        for (const id of this.vista.keys()) if (!(id in memoria)) delete adoptado[id];
      }
      if (adoptar) adoptar(adoptado);
      else this.o.cambiarMemoria(structuredClone(adoptado), []);
      this.base = indexar(m);
      this.vista = this.base;
      this.texto = l.texto;
      this.anterior = this.ligero(l.v);
      this.leido = true;
      if (!this.siguiendo) {
        this.siguiendo = true;
        alCambiarEnOtraPestana(this.o.claveAlmacen, () => void this.refrescar().catch(() => undefined));
      }
      return m;
    });
  }

  private leerSeguro(v: unknown): Mapa<T> {
    try {
      return this.o.deAlmacen(v) ?? {};
    } catch {
      return {};
    }
  }

  /**
   * Whether the other writer's version of an item (`ce`; none: its deletion) is newer than this module's change: by
   * the marks (this tab's change: its time — a change still pending from a refused write is older than its time
   * of writing —; the other's: its mark, if it is for that very value). Without a mark of the other: no.
   */
  private ganaElOtro(id: string, ce: Conocido | undefined): boolean {
    if (!this.o.claveSinc) return false;
    const nuestro = this.pendientes.get(id)?.[0] ?? Date.now();
    const m = marcaDe(this.o.claveSinc, id);
    if (!m || m.t <= nuestro) return false;
    return ce ? !m.borrado && (m.h === undefined || m.h === huellaDe(ce)) : m.borrado;
  }

  /**
   * Both writers changed the item: `unir`, else the newer by the item's own time, else by the marks (the reader's
   * write, `aplicar` false) — or, applying a synchronisation, the other tab's edit (it was made after the run read the
   * store; it is marked and sent by the next run).
   */
  private unir(id: string, local: T, otro: T, ce: Conocido, aplicado: boolean, cb: Conocido | undefined): T {
    const sinBase = cb === undefined;
    if (this.o.unir) {
      const r = this.o.unir(local, otro, cb ? (JSON.parse(cb.texto) as T) : undefined, id);
      if (r !== undefined) return r;
    }
    const tl = Number(this.o.tiempo?.(local)) || 0;
    const to = Number(this.o.tiempo?.(otro)) || 0;
    if (tl !== to) return to > tl ? otro : local;
    // applying: the other tab's edit made meanwhile stays — but without a base (the load failed) nothing says the
    // other side changed: what the synchronisation applies wins (sixth review)
    if (aplicado) return sinBase ? local : otro;
    return this.ganaElOtro(id, ce) ? otro : local;
  }

  /**
   * Three-way merge (lib/pestanas.ts fusionarPestanas, on the indexes): an item only one side changed since the base
   * takes that side; changed on both, `unir`; deleted on one side and unchanged on the other, deleted; new, kept.
   * `entrante` null: the storage is the base (nothing to merge, the local map wins whole). `aplicados`: the items a
   * synchronisation applies (for them, another tab's edit or deletion made meanwhile stays).
   */
  private fusionar(
    local: Mapa<T>,
    il: Indice,
    entrante: { m: Mapa<T>; i: Indice } | null,
    aplicados?: Set<string>,
    testigos?: Testigos | null,
  ): { mapa: Mapa<T>; i: Indice; dudosos: number; retenidos: number; retenidosTregua: number } {
    if (!entrante) return { mapa: local, i: il, dudosos: 0, retenidos: 0, retenidosTregua: 0 };
    const mapa: Mapa<T> = {};
    const i: Indice = new Map();
    const b = this.base;
    let dudosos = 0;
    let retenidos = 0;
    let retenidosTregua = 0;
    /**
     * The other writer's version of an item whose current value here is a reader's change this tab stored (`propios`):
     * taken only with evidence (`atestiguado`); without it, it is another tab's stale copy written over ours (review
     * 0.12, finding 3) and ours stays. Without the evidence loaded yet (`testigos` undefined), ours stays for now and
     * the caller loads it and merges again.
     */
    const ajenoAceptable = (id: string, ce: Conocido | undefined): boolean => {
      if (!this.pestanas || aplicados?.has(id) || !this.propios.has(id)) return true;
      if (testigos === undefined) {
        dudosos++;
        return false;
      }
      if (this.atestiguado(id, ce, il.get(id), testigos)) return true;
      // (kept either way, and due — review 0.12c, finding 1; written again at once only outside a truce of the loop
      // guard)
      if (this.enTregua(id)) retenidosTregua++;
      else retenidos++;
      this.retener(id);
      return false;
    };
    for (const id of new Set([...il.keys(), ...entrante.i.keys()])) {
      const cl = il.get(id);
      const ce = entrante.i.get(id);
      const cb = b.get(id);
      if (cl && ce) {
        if (iguales(cl, ce) || iguales(ce, cb)) {
          mapa[id] = local[id]!;
          i.set(id, cl);
        } else if (iguales(cl, cb)) {
          if (!ajenoAceptable(id, ce)) {
            // not proven newer: as if both had changed it — the store's merge (a union keeps both), else the newer by
            // the item's own time or the marks (a stale copy is older: this tab's stays). An applied version stays as
            // it is (review 0.12d, finding 1: an import may apply older versions on purpose, and a union with the
            // stale copy would bring back what it removed)
            const r = this.deAplicar.has(id) ? local[id]! : this.unir(id, local[id]!, entrante.m[id]!, ce, false, cb);
            mapa[id] = r;
            i.set(id, r === local[id] ? cl : r === entrante.m[id] ? ce : { texto: textoDe(r) });
            continue;
          }
          mapa[id] = entrante.m[id]!;
          i.set(id, ce);
        } else {
          const r = this.unir(id, local[id]!, entrante.m[id]!, ce, !!aplicados?.has(id), cb);
          mapa[id] = r;
          i.set(id, r === local[id] ? cl : r === entrante.m[id] ? ce : { texto: textoDe(r) });
        }
      } else if (cl) {
        // unchanged here and gone there: deleted by the other writer; changed here and deleted there: the newer
        // (applying a synchronisation, the other tab's deletion — fifth review)
        if (cb && (iguales(cl, cb) || aplicados?.has(id) || this.ganaElOtro(id, undefined)) && ajenoAceptable(id, undefined)) continue;
        mapa[id] = local[id]!;
        i.set(id, cl);
      } else if (ce) {
        // deleted here and unchanged there: stays deleted; deleted here and changed there: the newer (applying a
        // synchronisation, the other tab's edit)
        if (cb && iguales(ce, cb)) continue;
        if (cb && !aplicados?.has(id) && this.vista.has(id) && !this.ganaElOtro(id, ce)) continue;
        // a deletion the synchronisation applies with no base for the item (the load failed): it is applied
        if (!cb && aplicados?.has(id)) continue;
        // deleted here by the reader, and back there without evidence: another tab's stale copy — stays deleted
        if (this.propios.get(id)?.[0] === null && !ajenoAceptable(id, ce)) continue;
        mapa[id] = entrante.m[id]!;
        i.set(id, ce);
      }
    }
    return { mapa, i, dudosos, retenidos, retenidosTregua };
  }

  /**
   * `fusionar`, loading the evidence first when an item needs it (only then: it reads `sinc-estado` and
   * `sinc-aplicados`).
   */
  private async fusionarComprobando(
    a: Almacen,
    local: Mapa<T>,
    il: Indice,
    entrante: { m: Mapa<T>; i: Indice } | null,
    aplicados?: Set<string>,
  ): Promise<ReturnType<Guardado<T>['fusionar']>> {
    const f = this.fusionar(local, il, entrante, aplicados);
    if (!f.dudosos) return f;
    return this.fusionar(local, il, entrante, aplicados, await this.leerTestigos(a));
  }

  /** The evidence of other writers' changes (`atestiguado`), as stored now; null if it cannot be read. */
  private async leerTestigos(a: Almacen): Promise<Testigos | null> {
    const k = this.o.claveSinc;
    if (!k) return null;
    try {
      const [ap, est] = await Promise.all([a.leer<Record<string, unknown>>(CLAVE_APLICADOS), a.leer<Record<string, unknown>>('sinc-estado')]);
      const de = (x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
      return { aplicados: de(de(ap)[k]), items: de(de(de(est).items)[k]), borrados: de(de(de(est).borrados)[k]), iniciada: Number(de(est).iniciada) || 0 };
    } catch {
      return null;
    }
  }

  /**
   * Whether the other writer's version of an item (`ce`; none: its deletion) is a real change made after this tab's
   * own (`propios`: its hash and time), not a stale copy written back over it: another tab's mark for that very value
   * (or deletion) newer than ours; a synchronisation that applied it (`sinc-aplicados`, newer than ours) or recorded it
   * (`sinc-estado`: the file's value or tombstone, dated after ours); or the item's own time, newer than that of the
   * value this tab holds (`cl`).
   * With no evidence readable (`testigos` null): yes (as before 0.12).
   */
  /**
   * Loop guard (review 0.12b, finding 1): whether this tab should stop writing its own change of `id` back at once
   * after keeping it against another writer's version without evidence. Counts each such retention; more than
   * RETENCIONES_MAX within RETENCIONES_MS (two writers that keep writing theirs back over each other) starts a truce of
   * TREGUA_MS for the item: the change is still kept in memory (never the other version taken: nothing is lost — a
   * burst of real writes of two tabs can count that many too) and due (`retener`: `volcar` on `pagehide` writes it — review
   * 0.12c, finding 1), but a refresh no longer writes it back at once: RETRASO_TREGUA later (`reescribirLuego`), or by
   * this tab's next write. A loop is so slowed to one write per RETRASO_TREGUA.
   */
  private enTregua(id: string): boolean {
    const ahora = Date.now();
    const fin = this.treguas.get(id);
    if (fin !== undefined) {
      if (ahora < fin) return true;
      this.treguas.delete(id);
    }
    const r = (this.retenciones.get(id) ?? []).filter((x) => ahora - x < RETENCIONES_MS);
    r.push(ahora);
    if (r.length > RETENCIONES_MAX) {
      this.retenciones.delete(id);
      this.treguas.set(id, ahora + TREGUA_MS);
      this.medidas.treguas++;
      console.warn(`[guardado] «${this.o.claveAlmacen}» · ${id}: kept against another writer ${r.length} times in ${RETENCIONES_MS} ms; written back at most every ${RETRASO_TREGUA} ms for ${TREGUA_MS} ms`);
      return true;
    }
    this.retenciones.set(id, r);
    return false;
  }

  /**
   * A change of this tab kept against another writer's version without evidence is due again (review 0.12c, finding
   * 1): pending with its own time and value (`propios`) — so `volcar` (the page hidden or closed) writes it even during a
   * truce, and the write marks it again (a run in another tab that saw only the stale copy may have forgotten its mark:
   * without it the change would pass for a stale copy and be reverted). A newer change of the reader still pending
   * stays as it is.
   */
  private retener(id: string): void {
    const p = this.propios.get(id);
    // an applied version kept (review 0.12d, finding 1): due, but not the reader's change — not pending nor marked
    // (marked, it would pass for a change made when it was read and beat a newer version from another device: random
    // trial 31052)
    if (p && this.deAplicar.has(id)) {
      this.aplicadosDebidos.add(id);
      return;
    }
    if (!p || this.pendientes.has(id)) return;
    const [h, t] = p;
    this.pendientes.set(id, [t, h]);
    if (!this.o.claveSinc) return;
    if (h === null) anotarBorrado(this.o.claveSinc, id, t);
    else anotarCambio(this.o.claveSinc, id, t, h);
  }

  /**
   * The derived items (`OpcionesGuardado.derivar`) made again on a merge's result `f`, for the ids the merge changed
   * from this tab's memory `il`; those that change and differ from the storage's version (`almacen`) are this tab's
   * changes (pending, marked). The ids changed.
   */
  private derivar(f: { mapa: Mapa<T>; i: Indice }, il: Indice, almacen: Indice, guardado?: Mapa<T>): string[] {
    if (!this.o.derivar) return [];
    const tocados = [...new Set([...f.i.keys(), ...il.keys()])].filter((id) => !iguales(f.i.get(id), il.get(id)));
    if (!tocados.length) return [];
    const cambiados: string[] = [];
    for (const id of this.o.derivar(f.mapa, tocados, guardado)) {
      const v = f.mapa[id];
      if (v === undefined) {
        if (f.i.delete(id)) cambiados.push(id);
        continue;
      }
      const c: Conocido = { texto: textoDe(v) };
      if (iguales(c, f.i.get(id))) continue;
      f.i.set(id, c);
      cambiados.push(id);
      if (!this.o.claveSinc || iguales(c, almacen.get(id))) continue;
      const t = Math.max(Date.now(), (marcaDe(this.o.claveSinc, id)?.t ?? 0) + 1);
      this.pendientes.set(id, [t, huellaDe(c)]);
      anotarCambio(this.o.claveSinc, id, t, huellaDe(c));
    }
    return cambiados;
  }

  /**
   * Bounds `propios` (and `escritos`, `deAplicar`), one entry per item this tab changed or applied, for the tab's life
   * (review 0.12e): beyond PROPIOS_MAX the oldest go, down to PROPIOS_TRAS — but never one younger than PROPIOS_EDAD
   * (review 0.12f, finding 1: one application of thousands of items, the first synchronisation of a new device or a big
   * import, gives them all one time, and they were pruned in that very write, when another tab's stale copy is most
   * likely). A soft cap: beyond it only what is older than that goes; the map stays bounded by the key's ids.
   */
  private podarPropios(): void {
    if (this.propios.size <= PROPIOS_MAX) return;
    const limite = Date.now() - PROPIOS_EDAD;
    const viejos = [...this.propios]
      .filter(([, [, t]]) => t < limite)
      .sort((a, b) => a[1][1] - b[1][1])
      .slice(0, this.propios.size - PROPIOS_TRAS);
    for (const [id] of viejos) {
      this.propios.delete(id);
      this.escritos.delete(id);
      this.deAplicar.delete(id);
      this.retenciones.delete(id);
    }
  }

  /** During a truce: the kept changes written back once, RETRASO_TREGUA later (not once per write of the other). */
  private reescribirLuego(): void {
    if (this.reescritura) return;
    this.reescritura = setTimeout(() => {
      this.reescritura = null;
      if (this.pendientes.size || this.aplicadosDebidos.size) this.guardar(0);
    }, RETRASO_TREGUA);
  }

  private atestiguado(id: string, ce: Conocido | undefined, cl: Conocido | undefined, testigos: Testigos | null): boolean {
    if (!testigos) return true;
    const [hp, t] = this.propios.get(id)!;
    const h = ce ? huellaDe(ce) : null;
    const m = this.o.claveSinc ? marcaDe(this.o.claveSinc, id) : undefined;
    // (two changes at the same millisecond: the same order on both tabs, so they cannot keep writing theirs back)
    const despues = (x: number) => x > t || (x === t && (h ?? '-') > (hp ?? '-'));
    // (a mark this tab wrote itself is no evidence: the marks key too can be written back by a stale tab — its own
    // means that very value and time; the same value set again later by another tab is a real change: finding 1, 0.12b)
    const hm = m ? (m.borrado ? '-' : m.h) : undefined;
    const mio = hm !== undefined && !!this.escritos.get(id)?.some(([eh, et]) => eh === hm && et === m!.t);
    const paraEse = !!m && (h === null ? m.borrado : !m.borrado && (m.h === undefined || m.h === h));
    // an applied version (review 0.12d, finding 1): the newest mark of the item being for that very value or deletion
    // (and not this tab's) is evidence whatever its time — another tab marks a change before it writes it, and that
    // mark can be older than this tab's read of the data it applied while the data land after it (randomized trials
    // 31052, 31240: a union's element made in the other tab during the run was lost); a stale copy written back has
    // no such mark: after a run the old marks are forgotten, and an import marks what it applies
    if (this.deAplicar.has(id) && paraEse && !mio) return true;
    if (m && !mio && despues(m.t) && paraEse) return true;
    const ap = testigos.aplicados[id];
    if (Array.isArray(ap) && ap[0] === (h ?? '-') && typeof ap[1] === 'number' && (ap[1] > t || (typeof ap[2] === 'string' && ap[2] === (hp ?? '-') && typeof ap[3] === 'number' && t <= ap[3])))
      return true;
    // (the whole store applied, from data read after this tab's change: anotarAplicados TODOS_APLICADOS)
    const todo = testigos.aplicados[TODOS_APLICADOS];
    if (Array.isArray(todo) && todo[0] === TODOS_APLICADOS && typeof todo[1] === 'number' && todo[1] > t) return true;
    if (h === null) {
      const b = testigos.borrados[id];
      // (and the run that recorded it started after this tab's change: the tombstone's time is another device's clock —
      // review 0.12e, finding 2)
      return typeof b === 'number' && b > t && testigos.iniciada > t;
    }
    const r = testigos.items[id];
    // (the file's time is another device's clock, maybe ahead: the run that recorded it must also have started after
    // this tab's change — review 0.12e, finding 2: else a stale copy of the run's value beat a later real change)
    if (Array.isArray(r) && r[1] === h && typeof r[0] === 'number' && r[0] > t && testigos.iniciada > t) return true;
    // a newer version of the item by its own time than the one this tab holds (a stale copy is older) — not for an
    // applied version (review 0.12d, finding 1): «Sustituir todo» and its undo apply older versions on purpose, and
    // the stale copy of what they replaced is newer by its own time
    if (this.deAplicar.has(id)) return false;
    try {
      const tiempo = (c: Conocido) => Number(this.o.tiempo?.(JSON.parse(c.texto) as T)) || 0;
      return !!cl && tiempo(ce!) > tiempo(cl);
    } catch {
      return false;
    }
  }

  /**
   * One write, inside the queue: `fuente` gives the map to write, taken from memory right then (never a copy made
   * before an earlier write of the key finished: that copy would lack what the earlier write put in memory, and its
   * write would delete it — fourth review, finding 1); merged with what the storage holds now; written; then memory
   * gets what the merge kept that differs from what was written over (`alMemoria`). `marcar`: the reader's own
   * changes (marks for the synchronisation). Rejects if the storage does, changing nothing in memory.
   */
  private escribirMapa(
    fuente: () => Mapa<T>,
    aplicados: Set<string> | undefined,
    alMemoria: (deseado: Mapa<T>, il: Indice, f: { mapa: Mapa<T>; i: Indice }) => { poner: Mapa<T>; quitar: string[] },
    /** The text an item had in memory when `fuente` read it, where it is not `deseado`'s (the items applied). */
    enMemoria?: (id: string) => string | undefined | null,
  ): Promise<void> {
    // 0.12: a browser's write is a compare-and-set of the text this step read; if the key changed since as far as this
    // page can see (another tab's write already delivered here: the step awaits between its read and its write), the
    // whole step runs again — read, merge, write — (randomized simulation, trial 642; scenario r12·1). It does NOT stop
    // another tab's write in flight from being overwritten (each tab reads its own cached view of localStorage: review
    // 0.12, finding 3): the tab whose change was written over keeps it and writes it again (`propios`, `atestiguado`).
    // A write after five retries is unconditional (as before). A Web Lock was rejected: its callback runs in a later
    // task, which never comes while the page unloads (the flush on `pagehide`).
    return this.enCola(async () => {
      for (let intento = 0; !(await this.pasoEscritura(fuente, aplicados, alMemoria, enMemoria, intento < 5)); intento++);
    });
  }

  /** One attempt of `escribirMapa`'s step; false when the key changed under it (`comprobar`: nothing written then). */
  private async pasoEscritura(
    fuente: () => Mapa<T>,
    aplicados: Set<string> | undefined,
    alMemoria: (deseado: Mapa<T>, il: Indice, f: { mapa: Mapa<T>; i: Indice }) => { poner: Mapa<T>; quitar: string[] },
    enMemoria: ((id: string) => string | undefined | null) | undefined,
    comprobar: boolean,
  ): Promise<boolean> {
    {
      const a = await obtenerAlmacen();
      const l = await this.leerAlmacen(a, true);
      const entrante = l ? { m: this.leerSeguro(l.v), i: new Map() as Indice } : null;
      if (entrante) {
        entrante.i = indexar(entrante.m as Record<string, unknown>, this.base);
        // another writer wrote: its marks too (which of two changes of an item is newer)
        if (this.o.claveSinc) await volcarMarcas().catch(() => undefined);
      }
      // the memory now: from here to the write there is no await but the marks' (the reader's edits after it are
      // in memory, not in what is written, and differ from the vista: the next write marks them)
      const deseado = fuente();
      const il = indexar(deseado as Record<string, unknown>, this.vista);
      if (this.o.claveSinc) {
        const clave = this.o.claveSinc;
        // a new mark is always newer than the item's current one (review 0.12b, finding 4: with the clock set back, a
        // newer value dated before the stored mark lost to it — `poner` keeps the latest — and so to the stale copy)
        const ahora = (id: string) => Math.max(Date.now(), (marcaDe(clave, id)?.t ?? 0) + 1);
        // the reader's changes since this Guardado last left the memory — applying a synchronisation too: an edit made
        // while it waited in the queue (fifth review) —: marked now (a change still pending from a refused write keeps
        // its time when its value is the same)
        for (const [id, c] of il) {
          if (aplicados?.has(id) || iguales(c, this.vista.get(id))) continue;
          const h = huellaDe(c);
          const p = this.pendientes.get(id);
          this.pendientes.set(id, [p && p[1] === h ? p[0] : ahora(id), h]);
        }
        for (const id of this.vista.keys()) {
          if (il.has(id) || aplicados?.has(id)) continue;
          const p = this.pendientes.get(id);
          this.pendientes.set(id, [p && p[1] === null ? p[0] : ahora(id), null]);
        }
        // every change not stored yet is marked (again): its earlier mark may have been forgotten meanwhile
        for (const [id, [t, h]] of this.pendientes) {
          if (h === null) anotarBorrado(this.o.claveSinc, id, t);
          else anotarCambio(this.o.claveSinc, id, t, h);
        }
      }
      const f = await this.fusionarComprobando(a, deseado, il, entrante, aplicados);
      if (entrante) this.medidas.completas++;
      else this.medidas.rapidas++;
      // what is derived from the merged items, made again on the merged map (review 0.12c, finding 3: the day's
      // mirror written from one tab's memory lacked the other tab's steps)
      if (entrante) this.derivar(f, il, entrante.i, entrante.m);
      // a reader's change the merge combined with the other writer's version (the store's `unir`: a union, a sum): what
      // is stored is that combination, so the mark is for it — a mark for the value in memory only would not vouch for
      // what is stored, and the run would take it for a stale copy and drop it (randomized trial 9301: a union's new
      // element lost). Not when the other writer's version won as it is (its own mark vouches for it).
      if (this.o.claveSinc)
        for (const [id, [t, h]] of this.pendientes) {
          const c = f.i.get(id);
          if (h === null || !c || huellaDe(c) === h || iguales(c, entrante?.i.get(id))) continue;
          const hr = huellaDe(c);
          this.pendientes.set(id, [t, hr]);
          anotarCambio(this.o.claveSinc, id, t, hr);
        }
      const anterior = l ? l.v : this.anterior;
      const escrito = this.preparar(a, f, anterior);
      // the marks are stored before the data: a synchronisation run in another tab that sees the data sees them too
      // (an unmarked change or deletion is taken for a stale copy: fusion.ts fecharLocal)
      const marcasGuardadas = this.pendientes.size ? await volcarMarcas().then(() => true, () => false) : true;
      // (the text this step read: the key's, or — unchanged — the one this module last read or wrote)
      const leido = l ? l.texto : this.texto;
      try {
        if (!(await this.guardarAlmacen(a, escrito, anterior, comprobar, leido))) return false;
      } catch (e) {
        // not stored: the reader's changes stay pending (marked), and the memory as it was is what was seen — but for
        // the items a synchronisation applied, which are not in memory
        const vista = new Map(il);
        for (const id of aplicados ?? []) {
          const c = this.vista.get(id);
          if (c) vista.set(id, c);
          else vista.delete(id);
        }
        this.vista = vista;
        throw e;
      }
      this.base = f.i;
      this.vista = f.i;
      this.leido = true;
      this.aplicadosDebidos.clear();
      // the reader's changes this write stored (as stored), and the items a synchronisation applied (no longer ours)
      this.pestanas = !!a.leerTexto && a.tipo === 'navegador';
      if (this.pestanas)
        for (const [id, [t, h]] of this.pendientes) {
          const c = f.i.get(id);
          if (!(h === null ? !c : !!c && huellaDe(c) === h)) continue;
          this.propios.set(id, [h, t]);
          this.deAplicar.delete(id);
          const e: [string, number] = [h ?? '-', t];
          this.escritos.set(id, [...(this.escritos.get(id) ?? []).filter(([eh, et]) => eh !== e[0] || et !== t), e].slice(-8));
        }
      // the items a synchronisation or an import applied (review 0.12d, finding 1): this tab's own version from now on,
      // dated when the applied data were read — another tab's stale copy written back afterwards (its marks older) is
      // not taken without evidence, while that tab's real change made after the read (a newer mark) is. Before, they
      // were dropped from `propios`, and the stale copy was taken: a deleted item came back for good
      const desde = aplicados ? this.aplicadosDesde.get(aplicados) : undefined;
      for (const id of aplicados ?? []) {
        if (!this.pestanas || desde === undefined) {
          this.propios.delete(id);
          this.deAplicar.delete(id);
          continue;
        }
        const c = f.i.get(id);
        const h = c ? huellaDe(c) : null;
        this.propios.set(id, [h, desde]);
        this.deAplicar.add(id);
        const e: [string, number] = [h ?? '-', desde];
        this.escritos.set(id, [...(this.escritos.get(id) ?? []).filter(([eh, et]) => eh !== e[0] || et !== desde), e].slice(-8));
      }
      this.podarPropios();
      // the marks this write relied on, checked again now it has landed: a stale tab's write of the marks key between
      // this tab's marks write and its data write is put back (marcas.ts `reponerMias`; review 0.12b, finding 2)
      if (this.pestanas && this.o.claveSinc) void volcarMarcas().catch(() => undefined);
      // everything in memory is written now (what lost to a newer change of the other writer, too); the changes stay
      // pending when their marks could not be stored (storage full: fifth review) — the next write marks them again
      if (marcasGuardadas) this.pendientes.clear();
      const { poner, quitar } = alMemoria(deseado, il, f);
      if (Object.keys(poner).length || quitar.length) {
        // an item the reader changed in memory during this step's waits (Tauri's IPC) is left as the reader set it:
        // it differs from the vista, so the next write — scheduled now — marks and stores it (sixth review)
        const actual = this.o.leerVivo?.() ?? this.o.leerMemoria();
        const tocadoAhora = (id: string) => {
          const ref = enMemoria ? enMemoria(id) : null;
          const antes = ref === null ? il.get(id)?.texto : ref;
          return (id in actual ? textoDe(actual[id]) : undefined) !== antes;
        };
        let lector = false;
        for (const id of Object.keys(poner))
          if (tocadoAhora(id)) {
            delete poner[id];
            lector = true;
          }
        const q: string[] = [];
        for (const id of quitar)
          if (tocadoAhora(id)) lector = true;
          else q.push(id);
        if (Object.keys(poner).length || q.length) this.o.cambiarMemoria(poner, q);
        if (lector) this.guardar(0);
      }
    }
    return true;
  }

  /** What the merge kept that differs from what was in `deseado`: the other writer's (or the merge's) doing. */
  private static loAjeno<T>(_deseado: Mapa<T>, il: Indice, f: { mapa: Mapa<T>; i: Indice }) {
    const poner: Mapa<T> = {};
    const quitar: string[] = [];
    for (const [id, c] of f.i) if (!iguales(c, il.get(id))) poner[id] = f.mapa[id]!;
    // (the ids of what was written over — `deseado` may be the live memory, with the reader's newer items)
    for (const id of il.keys()) if (!f.i.has(id)) quitar.push(id);
    return { poner, quitar };
  }

  /** Writes the module's memory now (the reader changed something). */
  escribir(): Promise<void> {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    if (this.reintento) clearTimeout(this.reintento);
    this.reintento = null;
    return this.escribirMapa(() => this.o.leerVivo?.() ?? this.o.leerMemoria(), undefined, Guardado.loAjeno).then(
      () => {
        this.debida = false;
        this.reintentos = 0;
        this.o.alEstado?.(false);
      },
      (e: unknown) => {
        // due until a write succeeds: `volcar` writes it, and a few retries are scheduled (1 s, 5 s, 30 s)
        this.debida = true;
        const espera = [1000, 5000, 30_000][this.reintentos++];
        if (espera !== undefined) this.reintento = setTimeout(() => void this.escribir().catch(() => undefined), espera);
        this.o.alEstado?.(true);
        throw e;
      },
    );
  }

  /** A write of the reader's changes is due (its last attempt failed): the module tells the reader. */
  get sinGuardar(): boolean {
    return this.debida;
  }

  /** Writes the module's memory after a pause (bursts of changes make one write); errors are only logged. */
  guardar(espera = 300): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      void this.escribir().catch((e: unknown) => console.warn(`No se pudo guardar «${this.o.claveAlmacen}»`, e));
    }, espera);
  }

  /** A pending write, now (page hidden, before a synchronisation); also retries one the storage refused. */
  volcar(): Promise<void> {
    return this.temporizador || this.pendientes.size || this.aplicadosDebidos.size || this.debida ? this.escribir() : this.cola.then(() => undefined);
  }

  /** What another writer stored since this module last read or wrote, merged into memory (no write). */
  refrescar(): Promise<void> {
    return this.enCola(async () => {
      const a = await obtenerAlmacen();
      const l = await this.leerAlmacen(a, true);
      // nothing new in the storage and nothing pending: nothing to do (no copy of the memory, no merge)
      if (!l && !this.pendientes.size) {
        this.medidas.rapidas++;
        return;
      }
      // another writer wrote: its marks too (which of two changes of an item is newer)
      if (l && this.o.claveSinc) await volcarMarcas().catch(() => undefined);
      const memoria = this.o.leerVivo?.() ?? this.o.leerMemoria();
      const im = indexar(memoria as Record<string, unknown>, this.vista);
      let f = { mapa: memoria, i: im };
      if (l) {
        this.medidas.completas++;
        const m = this.leerSeguro(l.v);
        const ie = indexar(m as Record<string, unknown>, this.base);
        const ff = await this.fusionarComprobando(a, memoria, im, { m, i: ie });
        f = ff;
        // (what is derived, made again on the merged items: where it differs from the storage it is this tab's change
        // — pending, marked — and written with what made it differ; review 0.12c, finding 3)
        const derivados = new Set([...this.derivar(ff, im, ie, m)].filter((id) => !iguales(ff.i.get(id), ie.get(id))));
        if (derivados.size && !ff.retenidos && !ff.retenidosTregua) this.guardar();
        // the reader's changes another tab wrote over without evidence (a stale copy): kept here, written again (review
        // 0.12, finding 3) — the base becomes the storage, so the next write sees them as this side's changes
        if (ff.retenidos) this.guardar(0);
        else if (ff.retenidosTregua) this.reescribirLuego();
        // the base of each item (review 0.12b, finding 3): what the storage holds where the merge took it (a local
        // change made later still differs from it); where the merge kept or made something else (this tab's change
        // kept against a stale copy, or merged with it), the previous base stays — the storage's version is no
        // ancestor of what memory holds then: a later version written from the storage as it was before the stale
        // copy (another tab up to date) would be merged three-way from the stale copy, and a sum
        // (progreso-dias.ts `unirAportesPestanas`) would add this tab's own difference again. With the previous base
        // the next write merges the storage's version against the same ancestor as this refresh did: an idempotent
        // merge (newest by time, union, field max) gives the same result, and the sum adds nothing twice (it takes
        // from the other side only what that side added since the base). As if the refresh had not happened.
        const base: Indice = new Map();
        for (const id of new Set([...ie.keys(), ...ff.i.keys(), ...this.base.keys()])) {
          const ce = ie.get(id);
          const cr = ff.i.get(id);
          const x = (cr ? !!ce && iguales(cr, ce) : !ce) ? ce : this.base.get(id);
          if (x) base.set(id, x);
        }
        this.base = base;
        this.texto = l.texto;
        this.anterior = this.ligero(l.v);
        this.leido = true;
        const poner: Mapa<T> = {};
        const quitar: string[] = [];
        for (const [id, c] of f.i) if (!iguales(c, im.get(id))) poner[id] = f.mapa[id]!;
        for (const id of im.keys()) if (!f.i.has(id)) quitar.push(id);
        if (Object.keys(poner).length || quitar.length) this.o.cambiarMemoria(poner, quitar);
        // the reader's changes made since the last write (not marked yet) stay apart from the vista: the next write
        // marks them; what came from the storage is not the reader's doing
        const vista = new Map(this.vista);
        for (const id of Object.keys(poner)) if (!derivados.has(id)) vista.set(id, f.i.get(id)!);
        for (const id of quitar) vista.delete(id);
        this.vista = vista;
      }
      // the reader's changes still unwritten are marked again with their time (the synchronisation sends them), unless
      // the other writer's newer version replaced them
      if (this.o.claveSinc)
        for (const [id, [t, h]] of [...this.pendientes]) {
          const c = f.i.get(id);
          if ((c ? huellaDe(c) : null) !== h) this.pendientes.delete(id);
          else if (!c) anotarBorrado(this.o.claveSinc, id, t);
          else anotarCambio(this.o.claveSinc, id, t, h ?? undefined);
        }
    });
  }

  /**
   * A synchronisation's result, atomically: the memory as it is when the write's turn comes, with `poner` and without
   * `quitar`, merged with the storage and written; only then memory gets, for the items applied and for what the
   * merge brought, what was STORED (another tab's newer version of an item kept by the merge, not the file's older
   * one — fourth review, finding 2). A failed write rejects and changes nothing. `leidoEn`: when the applied data were
   * read (the run's read of the store, the import's plan); by default now. `vistos`: the hash of each item the merge
   * read (id → hash; review 0.12g).
   */
  async aplicar(poner: Mapa<T>, quitar: string[], leidoEn?: number, vistos?: Map<string, string>): Promise<void> {
    const desde = leidoEn ?? Date.now();
    if (this.temporizador) await this.escribir();
    // the evidence, for the other tabs, that these values and deletions come from a synchronisation (or an import), not
    // from a stale copy (`atestiguado`): stored before the data (review 0.12, finding 3)
    if (this.o.claveSinc) await anotarAplicados(this.o.claveSinc, poner, quitar, desde, vistos);
    const nuevos = structuredClone(poner);
    const tocados = new Set([...Object.keys(nuevos), ...quitar]);
    this.aplicadosDesde.set(tocados, desde);
    // the applied items as they were in memory when the write's turn came (to tell an edit made meanwhile)
    const previo = new Map<string, string | undefined>();
    await this.escribirMapa(
      () => {
        const memoria = this.o.leerVivo?.() ?? this.o.leerMemoria();
        for (const id of tocados) previo.set(id, id in memoria ? textoDe(memoria[id]) : undefined);
        const deseado = { ...memoria, ...structuredClone(nuevos) };
        for (const id of quitar) delete deseado[id];
        return deseado;
      },
      tocados,
      (deseado, il, f) => {
        const r = Guardado.loAjeno(deseado, il, f);
        // the applied items: what is stored now (as the memory before them did not have them)
        for (const id of tocados) {
          if (f.i.has(id)) r.poner[id] = f.mapa[id]!;
          else if (!r.quitar.includes(id)) r.quitar.push(id);
        }
        return r;
      },
      (id) => (previo.has(id) ? previo.get(id) : null),
    );
  }
}

/** The synchronised store (registro.svelte.ts `Sincronizable`) of a module's `Guardado`. */
export function sincronizableGuardado<T>(
  g: Guardado<T>,
  o: {
    clave: string;
    nombre: string;
    /** Loads the module (its memory) if needed. */
    cargar?: () => Promise<unknown>;
    tiempo?: (v: T) => number | undefined;
    valido?: (v: unknown) => boolean;
    maximo?: number;
    porDefecto?: (id: string) => unknown;
    /** The store's merge of two versions of an item in the file (registro.svelte.ts `Sincronizable.unir`). */
    unir?: (a: unknown, b: unknown) => unknown;
  },
) {
  // (1.1, enlaces11: a module's Guardado must mark its writes under the store's key — without marks a change of the
  // reader cannot be told from a stale copy, and another tab's stale copy took it away: scenario e11·1)
  if (g.o.claveSinc !== o.clave) throw new Error(`sincronizableGuardado «${o.clave}»: the Guardado of «${g.o.claveAlmacen}» marks as «${g.o.claveSinc ?? '(nothing)'}»`);
  return {
    clave: o.clave,
    nombre: o.nombre,
    // (1.0: its almacen key — a blocked key is left out of the synchronisation: sincronizar.svelte.ts `activos`)
    claveAlmacen: g.o.claveAlmacen,
    tiempo: o.tiempo as ((v: unknown) => number | undefined) | undefined,
    valido: o.valido,
    maximo: o.maximo,
    porDefecto: o.porDefecto,
    unir: o.unir,
    async leer(): Promise<Record<string, unknown>> {
      await o.cargar?.();
      // a pending (debounced) write of the reader's changes first: written and marked, they are sent; if the storage
      // refuses it, `refrescar` marks them anyway
      await g.volcar().catch(() => undefined);
      await g.refrescar();
      return g.o.leerMemoria() as Record<string, unknown>;
    },
    async aplicar(poner: Record<string, unknown>, quitar: string[], leidoEn?: number, vistos?: Map<string, string>): Promise<void> {
      await o.cargar?.();
      await g.aplicar(poner as Mapa<T>, quitar, leidoEn, vistos);
    },
  };
}

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** A plain copy of a module's (reactive) data: they are stored as JSON anyway. */
export const copiaPlana = <X>(x: X): X => JSON.parse(JSON.stringify(x ?? null)) as X;

/**
 * The `Guardado` of the common case: a module keeps the items in a Record of its reactive state (`obtener`), stored
 * as is under `claveAlmacen`, or as `{ version: 1, [campo]: Record }` (the editor's and the breadboard's circuits).
 */
export function guardadoDeRegistro<T>(o: {
  claveAlmacen: string;
  claveSinc?: string;
  obtener: () => Record<string, T>;
  campo?: string;
  tiempo?: (v: T) => number | undefined;
  unir?: (a: T, b: T, base?: T, id?: string) => T | undefined;
  alEstado?: (sinGuardar: boolean) => void;
}): Guardado<T> {
  return new Guardado<T>({
    claveAlmacen: o.claveAlmacen,
    claveSinc: o.claveSinc,
    tiempo: o.tiempo,
    unir: o.unir,
    alEstado: o.alEstado,
    deAlmacen: (v) => {
      const m = o.campo && esObjeto(v) ? v[o.campo] : v;
      return esObjeto(m) ? (m as Mapa<T>) : {};
    },
    aAlmacen: (m, anterior) => (o.campo ? { version: 1, ...(esObjeto(anterior) ? anterior : {}), [o.campo]: m } : m),
    leerMemoria: () => copiaPlana(o.obtener()) ?? {},
    leerVivo: () => o.obtener(),
    anteriorLigero: (v) => {
      if (!o.campo || !esObjeto(v)) return undefined;
      const resto: Record<string, unknown> = { ...v };
      delete resto[o.campo];
      return resto;
    },
    textoAlmacen: (textos, anterior) => {
      const cuerpo = '{' + textos.map(([id, t]) => JSON.stringify(id) + ':' + t).join(',') + '}';
      if (!o.campo) return cuerpo;
      const resto: Record<string, unknown> = { version: 1, ...(esObjeto(anterior) ? anterior : {}) };
      delete resto[o.campo];
      return JSON.stringify(resto).slice(0, -1) + ',' + JSON.stringify(o.campo) + ':' + cuerpo + '}';
    },
    cambiarMemoria: (poner, quitar) => {
      const r = o.obtener();
      for (const [id, v] of Object.entries(poner)) r[id] = v;
      for (const id of quitar) delete r[id];
    },
  });
}
