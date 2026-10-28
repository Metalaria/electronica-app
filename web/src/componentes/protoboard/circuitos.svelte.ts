// The reader's own breadboards, saved on the device through the app's store (lib/almacen.ts), under ONE key,
// exactly like the schematic editor's circuits:
//   «protoboard-circuitos» → { version: 1, circuitos: { [id]: MontajeGuardado } }
// Each one has `creado` and `actualizado` (ms) and a soft delete (`borrado`) kept as a tombstone, so the
// synchronisation (lib/sincronizacion/registro.svelte.ts) merges them per item. The unsaved working board of
// «#/protoboard» is a per-device convenience in localStorage.

import { obtenerAlmacen } from '../../lib/almacen';
import type { DocumentoProtoboard, MontajeGuardado } from './tipos.ts';

export const CLAVE_MONTAJES = 'protoboard-circuitos';
const CLAVE_BORRADOR = 'epa:protoboard-borrador';

interface Guardados {
  version: 1;
  circuitos: Record<string, MontajeGuardado>;
}

export const montajes = $state({
  listo: false,
  circuitos: {} as Record<string, MontajeGuardado>,
});

let carga: Promise<void> | null = null;

export function cargarMontajes(): Promise<void> {
  carga ??= (async () => {
    try {
      const g = await (await obtenerAlmacen()).leer<Guardados>(CLAVE_MONTAJES);
      montajes.circuitos = g?.circuitos ?? {};
    } catch {
      montajes.circuitos = {};
    }
    montajes.listo = true;
  })();
  return carga;
}

// A synchronisation that changed the store: read it again.
if (typeof window !== 'undefined')
  window.addEventListener('epa:sincronizado', (ev) => {
    const claves = (ev as CustomEvent<{ claves?: string[] }>).detail?.claves;
    if (!claves || claves.includes(CLAVE_MONTAJES)) {
      carga = null;
      void cargarMontajes();
    }
  });

let escritura: Promise<void> = Promise.resolve();
function escribir(): Promise<void> {
  const datos: Guardados = { version: 1, circuitos: $state.snapshot(montajes.circuitos) as Record<string, MontajeGuardado> };
  escritura = escritura.then(async () => {
    try {
      await (await obtenerAlmacen()).escribir(CLAVE_MONTAJES, datos);
    } catch {
      /* storage unavailable: kept in memory for this session */
    }
  });
  return escritura;
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
