// The reader's circuits, saved on the device through the app's store (lib/almacen.ts: Tauri plugin-store or
// localStorage), under ONE key:
//   «editor-circuitos» → { version: 1, circuitos: { [id]: CircuitoGuardado } }
// Each circuit has `creado` and `actualizado` (ms) and a soft delete (`borrado`, ms) kept as a tombstone, so
// a sync between devices can merge per circuit (the newest `actualizado` wins; a tombstone is never revived
// by an older copy). The working draft (a circuit not saved yet) is a per-device convenience in localStorage.

import { obtenerAlmacen } from '../../lib/almacen';
import type { CircuitoGuardado, DocumentoEsquema } from './tipos.ts';

export const CLAVE_CIRCUITOS = 'editor-circuitos';
const CLAVE_BORRADOR = 'epa:editor-borrador';
const CLAVE_TRASPASO = 'epa:editor-traspaso';
const CLAVE_NETLIST = 'epa:netlist-esquema';

interface Guardados {
  version: 1;
  circuitos: Record<string, CircuitoGuardado>;
}

export const biblioteca = $state({
  listo: false,
  circuitos: {} as Record<string, CircuitoGuardado>,
});

let carga: Promise<void> | null = null;

export function cargarCircuitos(): Promise<void> {
  carga ??= (async () => {
    try {
      const a = await obtenerAlmacen();
      const g = await a.leer<Guardados>(CLAVE_CIRCUITOS);
      biblioteca.circuitos = g?.circuitos ?? {};
    } catch {
      biblioteca.circuitos = {};
    }
    biblioteca.listo = true;
  })();
  return carga;
}

let escritura: Promise<void> = Promise.resolve();
function escribir(): Promise<void> {
  const datos: Guardados = { version: 1, circuitos: $state.snapshot(biblioteca.circuitos) as Record<string, CircuitoGuardado> };
  escritura = escritura.then(async () => {
    try {
      await (await obtenerAlmacen()).escribir(CLAVE_CIRCUITOS, datos);
    } catch {
      /* storage unavailable: the circuits stay in memory for this session */
    }
  });
  return escritura;
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
