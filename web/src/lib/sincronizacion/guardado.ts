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

import { obtenerAlmacen, type Almacen } from '../almacen';
import { huella } from './fusion';
import { alCambiarEnOtraPestana } from '../pestanas';
import { anotarBorrado, anotarCambio, marcaDe, volcarMarcas } from './marcas';

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
  /** Merge of two versions of an item both writers changed (instead of the newer). */
  unir?(a: T, b: T): T;
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
  /** Writes and refreshes that found the key as this module left it (no merge) and those that merged (tests). */
  readonly medidas = { rapidas: 0, completas: 0 };

  constructor(readonly o: OpcionesGuardado<T>) {}

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

  private async guardarAlmacen(a: Almacen, x: { texto?: string; valor?: unknown }, anterior: unknown): Promise<void> {
    if (x.texto !== undefined && a.escribirTexto) {
      await a.escribirTexto(this.o.claveAlmacen, x.texto);
      this.texto = x.texto;
    } else {
      await a.escribir(this.o.claveAlmacen, x.valor);
      this.texto = undefined;
    }
    // (the stored value's other fields: what `aAlmacen` keeps)
    this.anterior = this.ligero(x.valor ?? anterior);
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
  private unir(id: string, local: T, otro: T, ce: Conocido, aplicado: boolean, sinBase: boolean): T {
    if (this.o.unir) return this.o.unir(local, otro);
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
  private fusionar(local: Mapa<T>, il: Indice, entrante: { m: Mapa<T>; i: Indice } | null, aplicados?: Set<string>): { mapa: Mapa<T>; i: Indice } {
    if (!entrante) return { mapa: local, i: il };
    const mapa: Mapa<T> = {};
    const i: Indice = new Map();
    const b = this.base;
    for (const id of new Set([...il.keys(), ...entrante.i.keys()])) {
      const cl = il.get(id);
      const ce = entrante.i.get(id);
      const cb = b.get(id);
      if (cl && ce) {
        if (iguales(cl, ce) || iguales(ce, cb)) {
          mapa[id] = local[id]!;
          i.set(id, cl);
        } else if (iguales(cl, cb)) {
          mapa[id] = entrante.m[id]!;
          i.set(id, ce);
        } else {
          const r = this.unir(id, local[id]!, entrante.m[id]!, ce, !!aplicados?.has(id), cb === undefined);
          mapa[id] = r;
          i.set(id, r === local[id] ? cl : r === entrante.m[id] ? ce : { texto: textoDe(r) });
        }
      } else if (cl) {
        // unchanged here and gone there: deleted by the other writer; changed here and deleted there: the newer
        // (applying a synchronisation, the other tab's deletion — fifth review)
        if (cb && (iguales(cl, cb) || aplicados?.has(id) || this.ganaElOtro(id, undefined))) continue;
        mapa[id] = local[id]!;
        i.set(id, cl);
      } else if (ce) {
        // deleted here and unchanged there: stays deleted; deleted here and changed there: the newer (applying a
        // synchronisation, the other tab's edit)
        if (cb && iguales(ce, cb)) continue;
        if (cb && !aplicados?.has(id) && this.vista.has(id) && !this.ganaElOtro(id, ce)) continue;
        // a deletion the synchronisation applies with no base for the item (the load failed): it is applied
        if (!cb && aplicados?.has(id)) continue;
        mapa[id] = entrante.m[id]!;
        i.set(id, ce);
      }
    }
    return { mapa, i };
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
    return this.enCola(async () => {
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
        const ahora = Date.now();
        // the reader's changes since this Guardado last left the memory — applying a synchronisation too: an edit made
        // while it waited in the queue (fifth review) —: marked now (a change still pending from a refused write keeps
        // its time when its value is the same)
        for (const [id, c] of il) {
          if (aplicados?.has(id) || iguales(c, this.vista.get(id))) continue;
          const h = huellaDe(c);
          const p = this.pendientes.get(id);
          this.pendientes.set(id, [p && p[1] === h ? p[0] : ahora, h]);
        }
        for (const id of this.vista.keys()) {
          if (il.has(id) || aplicados?.has(id)) continue;
          const p = this.pendientes.get(id);
          this.pendientes.set(id, [p && p[1] === null ? p[0] : ahora, null]);
        }
        // every change not stored yet is marked (again): its earlier mark may have been forgotten meanwhile
        for (const [id, [t, h]] of this.pendientes) {
          if (h === null) anotarBorrado(this.o.claveSinc, id, t);
          else anotarCambio(this.o.claveSinc, id, t, h);
        }
      }
      const f = this.fusionar(deseado, il, entrante, aplicados);
      if (entrante) this.medidas.completas++;
      else this.medidas.rapidas++;
      const anterior = l ? l.v : this.anterior;
      const escrito = this.preparar(a, f, anterior);
      // the marks are stored before the data: a synchronisation run in another tab that sees the data sees them too
      // (an unmarked change or deletion is taken for a stale copy: fusion.ts fecharLocal)
      const marcasGuardadas = this.pendientes.size ? await volcarMarcas().then(() => true, () => false) : true;
      try {
        await this.guardarAlmacen(a, escrito, anterior);
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
    });
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
    return this.temporizador || this.pendientes.size || this.debida ? this.escribir() : this.cola.then(() => undefined);
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
        f = this.fusionar(memoria, im, { m, i: ie });
        // the base becomes what the storage holds: a local change not written yet still differs from it
        this.base = ie;
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
        for (const id of Object.keys(poner)) vista.set(id, f.i.get(id)!);
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
   * one — fourth review, finding 2). A failed write rejects and changes nothing.
   */
  async aplicar(poner: Mapa<T>, quitar: string[]): Promise<void> {
    if (this.temporizador) await this.escribir();
    const nuevos = structuredClone(poner);
    const tocados = new Set([...Object.keys(nuevos), ...quitar]);
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
  },
) {
  return {
    clave: o.clave,
    nombre: o.nombre,
    tiempo: o.tiempo as ((v: unknown) => number | undefined) | undefined,
    valido: o.valido,
    maximo: o.maximo,
    porDefecto: o.porDefecto,
    async leer(): Promise<Record<string, unknown>> {
      await o.cargar?.();
      // a pending (debounced) write of the reader's changes first: written and marked, they are sent; if the storage
      // refuses it, `refrescar` marks them anyway
      await g.volcar().catch(() => undefined);
      await g.refrescar();
      return g.o.leerMemoria() as Record<string, unknown>;
    },
    async aplicar(poner: Record<string, unknown>, quitar: string[]): Promise<void> {
      await o.cargar?.();
      await g.aplicar(poner as Mapa<T>, quitar);
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
  unir?: (a: T, b: T) => T;
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
