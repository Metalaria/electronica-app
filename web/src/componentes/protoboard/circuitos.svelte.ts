// The reader's own breadboards, saved on the device through the app's store (lib/almacen.ts), under ONE key,
// exactly like the schematic editor's circuits:
//   «protoboard-circuitos» → { version: 1, circuitos: { [id]: MontajeGuardado } }
// Each one has `creado` and `actualizado` (ms) and a soft delete (`borrado`) kept as a tombstone, so the
// synchronisation (lib/sincronizacion/registro.svelte.ts) merges them per item. The unsaved working board of
// «#/protoboard» is a per-device convenience in localStorage.

import { guardadoDeRegistro } from '../../lib/sincronizacion/guardado';
import type { DocumentoProtoboard, MontajeGuardado } from './tipos.ts';

export const CLAVE_MONTAJES = 'protoboard-circuitos';
const CLAVE_BORRADOR = 'epa:protoboard-borrador';

export const montajes = $state({
  listo: false,
  /**
   * What the reader must be told (sixth review): «lectura» — the saved library could not be read (what is done here
   * stays in this page, not saved yet); «escritura» — a save failed (retried; the page shows «Reintentar»); '' — fine.
   */
  error: '' as '' | 'lectura' | 'escritura',
  circuitos: {} as Record<string, MontajeGuardado>,
});

let carga: Promise<void> | null = null;

// Read-merge-write (lib/sincronizacion/guardado.ts), like the editor's circuits: the synchronisation's results go
// through it (straight into memory, atomically), and another tab's writes are merged, never overwritten.
export const guardadoMontajes = guardadoDeRegistro<MontajeGuardado>({
  claveAlmacen: CLAVE_MONTAJES,
  claveSinc: CLAVE_MONTAJES,
  campo: 'circuitos',
  obtener: () => montajes.circuitos,
  // (a failed read keeps its notice: every write reads first, so it fails for the same reason)
  alEstado: (sinGuardar) => (montajes.error = !sinGuardar ? '' : montajes.error === 'lectura' ? 'lectura' : 'escritura'),
  tiempo: (v) => Math.max(typeof v?.actualizado === 'number' ? v.actualizado : 0, typeof v?.borrado === 'number' ? v.borrado : 0) || undefined,
});

export function cargarMontajes(): Promise<void> {
  carga ??= (async () => {
    try {
      // (adopted in the load's step; what was changed before it stays)
      await guardadoMontajes.cargar((m) => (montajes.circuitos = { ...m, ...montajes.circuitos }));
      if (montajes.error === 'lectura') montajes.error = guardadoMontajes.sinGuardar ? 'escritura' : '';
    } catch {
      // the store could not be read: nothing is taken as stored — every write reads it first (and fails if it cannot)
      carga = null;
      montajes.error = 'lectura';
    }
    montajes.listo = true;
  })();
  return carga;
}

/** «Reintentar»: the library is read again (if it could not be), and a save that failed is written now. */
export async function reintentarMontajes(): Promise<void> {
  await cargarMontajes();
  await guardadoMontajes.volcar().catch(() => undefined);
}

function escribir(): Promise<void> {
  // storage unavailable: kept in memory, written by the next write or a retry; the page shows it (`error`)
  return guardadoMontajes.escribir().catch(() => undefined);
}

/** Saved boards (not deleted), most recent first. */
export function listaMontajes(): MontajeGuardado[] {
  return Object.values(montajes.circuitos)
    .filter((c) => !c.borrado)
    .sort((a, b) => b.actualizado - a.actualizado);
}

const nuevoId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const copia = (d: DocumentoProtoboard) => JSON.parse(JSON.stringify(d)) as DocumentoProtoboard;

export async function guardarMontaje(nombre: string, doc: DocumentoProtoboard): Promise<string> {
  await cargarMontajes();
  const id = nuevoId();
  const ahora = Date.now();
  const d = copia(doc);
  d.titulo = nombre;
  montajes.circuitos[id] = { id, nombre, creado: ahora, actualizado: ahora, doc: d };
  await escribir();
  return id;
}

export async function actualizarMontaje(id: string, doc: DocumentoProtoboard): Promise<void> {
  await cargarMontajes();
  const c = montajes.circuitos[id];
  if (!c || c.borrado) return;
  c.doc = copia(doc);
  c.nombre = doc.titulo || c.nombre;
  c.actualizado = Date.now();
  await escribir();
}

export async function renombrarMontaje(id: string, nombre: string): Promise<void> {
  const c = montajes.circuitos[id];
  if (!c) return;
  c.nombre = nombre;
  c.doc.titulo = nombre;
  c.actualizado = Date.now();
  await escribir();
}

export async function borrarMontaje(id: string): Promise<void> {
  const c = montajes.circuitos[id];
  if (!c) return;
  const ahora = Date.now();
  montajes.circuitos[id] = { id, nombre: c.nombre, creado: c.creado, actualizado: ahora, borrado: ahora, doc: { ...c.doc, piezas: [], cables: [] } };
  await escribir();
}

export function montaje(id: string): MontajeGuardado | null {
  const c = montajes.circuitos[id];
  return c && !c.borrado ? c : null;
}

export function leerBorradorMontaje(): DocumentoProtoboard | null {
  try {
    const t = localStorage.getItem(CLAVE_BORRADOR);
    return t ? (JSON.parse(t) as DocumentoProtoboard) : null;
  } catch {
    return null;
  }
}

export function escribirBorradorMontaje(doc: DocumentoProtoboard | null): void {
  try {
    if (doc) localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(doc));
    else localStorage.removeItem(CLAVE_BORRADOR);
  } catch {
    /* private mode */
  }
}
