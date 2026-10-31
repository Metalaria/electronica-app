// The reader's circuits, saved on the device through the app's store (lib/almacen.ts: Tauri plugin-store or
// localStorage), under ONE key:
//   «editor-circuitos» → { version: 1, circuitos: { [id]: CircuitoGuardado } }
// Each circuit has `creado` and `actualizado` (ms) and a soft delete (`borrado`, ms) kept as a tombstone, so
// a sync between devices can merge per circuit (the newest `actualizado` wins; a tombstone is never revived
// by an older copy). The working draft (a circuit not saved yet) is a per-device convenience in localStorage.

import { obtenerAlmacen } from '../../lib/almacen';
import { guardadoDeRegistro } from '../../lib/sincronizacion/guardado';
import type { CircuitoGuardado, DocumentoEsquema } from './tipos.ts';

export const CLAVE_CIRCUITOS = 'editor-circuitos';
const CLAVE_BORRADOR = 'epa:editor-borrador';
const CLAVE_TRASPASO = 'epa:editor-traspaso';
const CLAVE_NETLIST = 'epa:netlist-esquema';

export const biblioteca = $state({
  listo: false,
  /**
   * What the reader must be told (sixth review): «lectura» — the saved library could not be read (what is done here
   * stays in this page, not saved yet); «escritura» — a save failed (retried; the page shows «Reintentar»); '' — fine.
   */
  /** «memoria»: this browser lets nothing be stored on the device (storage blocked): kept only while the page is open. */
  error: '' as '' | 'lectura' | 'escritura' | 'memoria',
  circuitos: {} as Record<string, CircuitoGuardado>,
});

let carga: Promise<void> | null = null;

/** A circuit's own time: its last change or its deletion. */
export const tiempoCircuito = (v: { actualizado?: unknown; borrado?: unknown } | null | undefined): number | undefined =>
  Math.max(typeof v?.actualizado === 'number' ? v.actualizado : 0, typeof v?.borrado === 'number' ? v.borrado : 0) || undefined;

// Read-merge-write (lib/sincronizacion/guardado.ts): what the synchronisation or another tab stored meanwhile is
// merged into memory and never overwritten with this page's older copy (the third review: the editor wrote its whole
// map from memory loaded once); the synchronisation's results reach the open editor at once (they go through here).
export const guardadoCircuitos = guardadoDeRegistro<CircuitoGuardado>({
  claveAlmacen: CLAVE_CIRCUITOS,
  claveSinc: CLAVE_CIRCUITOS,
  campo: 'circuitos',
  obtener: () => biblioteca.circuitos,
  // (a failed read keeps its notice: every write reads first, so it fails for the same reason)
  alEstado: (sinGuardar) => (biblioteca.error = biblioteca.error === 'memoria' ? 'memoria' : !sinGuardar ? '' : biblioteca.error === 'lectura' ? 'lectura' : 'escritura'),
  tiempo: tiempoCircuito,
});

export function cargarCircuitos(): Promise<void> {
  carga ??= (async () => {
    try {
      // (adopted in the load's step; what was changed before it stays)
      await guardadoCircuitos.cargar((m) => (biblioteca.circuitos = { ...m, ...biblioteca.circuitos }));
      if (biblioteca.error === 'lectura') biblioteca.error = guardadoCircuitos.sinGuardar ? 'escritura' : '';
      // (the 0.11 final QA pass: with the storage blocked the library lives in memory and the page said «Guardado en este
      // dispositivo»; it says now that nothing is kept once the page is closed)
      if ((await obtenerAlmacen()).tipo === 'memoria') biblioteca.error = 'memoria';
    } catch {
      // the store could not be read (fifth review): nothing is taken as stored — every write reads it first (and fails
      // if it cannot), so the saved library is never written over; a later call loads again
      carga = null;
      biblioteca.error = 'lectura';
    }
    biblioteca.listo = true;
  })();
  return carga;
}

/** «Reintentar»: the library is read again (if it could not be), and a save that failed is written now. */
export async function reintentarCircuitos(): Promise<void> {
  await cargarCircuitos();
  await guardadoCircuitos.volcar().catch(() => undefined);
}

function escribir(): Promise<void> {
  // storage unavailable: kept in memory, written by the next write or a retry; the page shows it (`error`)
  return guardadoCircuitos.escribir().catch(() => undefined);
}

/** Saved circuits (not deleted), most recent first. */
export function listaCircuitos(): CircuitoGuardado[] {
  return Object.values(biblioteca.circuitos)
    .filter((c) => !c.borrado)
    .sort((a, b) => b.actualizado - a.actualizado);
}

function nuevoId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export async function guardarNuevo(nombre: string, doc: DocumentoEsquema): Promise<string> {
  await cargarCircuitos();
  const id = nuevoId();
  const ahora = Date.now();
  biblioteca.circuitos[id] = { id, nombre, creado: ahora, actualizado: ahora, doc: JSON.parse(JSON.stringify(doc)) as DocumentoEsquema };
  await escribir();
  return id;
}

export async function actualizar(id: string, doc: DocumentoEsquema): Promise<void> {
  await cargarCircuitos();
  const c = biblioteca.circuitos[id];
  if (!c || c.borrado) return;
  c.doc = JSON.parse(JSON.stringify(doc)) as DocumentoEsquema;
  c.nombre = doc.titulo || c.nombre;
  c.actualizado = Date.now();
  await escribir();
}

export async function renombrar(id: string, nombre: string): Promise<void> {
  const c = biblioteca.circuitos[id];
  if (!c) return;
  c.nombre = nombre;
  c.doc.titulo = nombre;
  c.actualizado = Date.now();
  await escribir();
}

export async function borrar(id: string): Promise<void> {
  const c = biblioteca.circuitos[id];
  if (!c) return;
  const ahora = Date.now();
  // Tombstone: the drawing goes, the entry stays so that a sync knows it was deleted.
  biblioteca.circuitos[id] = { id, nombre: c.nombre, creado: c.creado, actualizado: ahora, borrado: ahora, doc: { ...c.doc, componentes: [], cables: [] } };
  await escribir();
}

export function circuito(id: string): CircuitoGuardado | null {
  const c = biblioteca.circuitos[id];
  return c && !c.borrado ? c : null;
}

// ------------------------------------------------------------------ per-device conveniences

export function leerBorrador(): DocumentoEsquema | null {
  try {
    const t = localStorage.getItem(CLAVE_BORRADOR);
    return t ? (JSON.parse(t) as DocumentoEsquema) : null;
  } catch {
    return null;
  }
}

export function escribirBorrador(doc: DocumentoEsquema | null): void {
  try {
    if (doc) localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(doc));
    else localStorage.removeItem(CLAVE_BORRADOR);
  } catch {
    /* private mode */
  }
}

/** A netlist handed to the editor by the simulator page («Editar el esquema» of an edited netlist). */
export function dejarTraspaso(texto: string, origen: DocumentoEsquema['origen']): void {
  try {
    sessionStorage.setItem(CLAVE_TRASPASO, JSON.stringify({ texto, origen }));
  } catch {
    memoria.traspaso = { texto, origen };
  }
}

export function tomarTraspaso(): { texto: string; origen: DocumentoEsquema['origen'] } | null {
  try {
    const t = sessionStorage.getItem(CLAVE_TRASPASO);
    if (t) {
      sessionStorage.removeItem(CLAVE_TRASPASO);
      return JSON.parse(t) as { texto: string; origen: DocumentoEsquema['origen'] };
    }
  } catch {
    /* fall through */
  }
  const m = memoria.traspaso;
  memoria.traspaso = null;
  return m;
}

/** The generated netlist handed to the simulator page («Ver como netlist»). */
export interface NetlistDelEsquema {
  texto: string;
  titulo: string;
  /** Route back to the drawing. */
  volver: string;
}

export function dejarNetlist(n: NetlistDelEsquema): void {
  try {
    sessionStorage.setItem(CLAVE_NETLIST, JSON.stringify(n));
  } catch {
    memoria.netlist = n;
  }
}

export function leerNetlist(): NetlistDelEsquema | null {
  try {
    const t = sessionStorage.getItem(CLAVE_NETLIST);
    if (t) return JSON.parse(t) as NetlistDelEsquema;
  } catch {
    /* fall through */
  }
  return memoria.netlist;
}

const memoria: { traspaso: { texto: string; origen: DocumentoEsquema['origen'] } | null; netlist: NetlistDelEsquema | null } = { traspaso: null, netlist: null };
