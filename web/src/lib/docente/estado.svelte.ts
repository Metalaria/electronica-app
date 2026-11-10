// The reader's own courses and exams («modo docente», 1.0) and the results of the exams taken in the app. Same
// storage layer as the other personal data (lib/almacen.ts: Tauri plugin-store `lector.json`, or localStorage), two
// keys:
//   docente             { version: 1, propios:    { <id>: Propio } }
//   docente-resultados  { version: 1, resultados: { <id>: Resultado } }
// Each item carries `creado`/`actualizado` and a soft delete `borrado` (a tombstone kept as an item, like the
// editor's circuits), so the synchronisation merges item by item, last write wins (stores `docente-propios` and
// `docente-resultados`, registered in lib/sincronizacion/registro.svelte.ts). A deletion is dated
// max(now, actualizado + 1): it always beats the version it deletes, even with a clock behind.
// Read-merge-write through lib/sincronizacion/guardado.ts (another tab's writes and the synchronisation's results
// reach memory and are never overwritten with an older copy).

import { obtenerAlmacen } from '../almacen';
import { guardadoDeRegistro } from '../sincronizacion/guardado';
import type { DefinicionCurso, DefinicionExamen, Propio, Resultado } from './tipos';
import { unirResultados } from './union';

export const CLAVE_DOCENTE = 'docente';
export const CLAVE_RESULTADOS = 'docente-resultados';

export const docente = $state({
  listo: false,
  /** '' fine; «lectura» the stored data could not be read; «escritura» a save failed; «memoria» nothing can be stored. */
  error: '' as '' | 'lectura' | 'escritura' | 'memoria',
  propios: {} as Record<string, Propio>,
  resultados: {} as Record<string, Resultado>,
});

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** An item's own time: its last change or its deletion. */
export const tiempoDocente = (v: { actualizado?: unknown; borrado?: unknown } | null | undefined): number | undefined =>
  Math.max(numero(v?.actualizado) ? v.actualizado : 0, numero(v?.borrado) ? v.borrado : 0) || undefined;

export function propioValido(v: unknown): v is Propio {
  return esObjeto(v) && typeof v.id === 'string' && (v.tipo === 'curso' || v.tipo === 'examen') && numero(v.actualizado);
}

export function resultadoValido(v: unknown): v is Resultado {
  return esObjeto(v) && typeof v.id === 'string' && typeof v.examen === 'string' && numero(v.actualizado) && (numero(v.borrado) || (numero(v.t) && Array.isArray(v.items)));
}

function alEstado(sinGuardar: boolean): void {
  if (docente.error === 'memoria') return;
  docente.error = !sinGuardar ? '' : docente.error === 'lectura' ? 'lectura' : 'escritura';
}

export const guardadoPropios = guardadoDeRegistro<Propio>({
  claveAlmacen: CLAVE_DOCENTE,
  claveSinc: 'docente-propios',
  campo: 'propios',
  obtener: () => docente.propios,
  alEstado,
  tiempo: tiempoDocente,
});

export const guardadoResultados = guardadoDeRegistro<Resultado>({
  claveAlmacen: CLAVE_RESULTADOS,
  claveSinc: 'docente-resultados',
  campo: 'resultados',
  obtener: () => docente.resultados,
  alEstado,
  tiempo: tiempoDocente,
  // (review 10h: another tab's self-assessment of the same result is merged question by question)
  unir: (a, b) => unirResultados(a, b),
});

let carga: Promise<void> | null = null;

export function cargarDocente(): Promise<void> {
  carga ??= (async () => {
    try {
      await guardadoPropios.cargar((m) => (docente.propios = { ...m, ...docente.propios }));
      await guardadoResultados.cargar((m) => (docente.resultados = { ...m, ...docente.resultados }));
      if (docente.error === 'lectura') docente.error = guardadoPropios.sinGuardar || guardadoResultados.sinGuardar ? 'escritura' : '';
      if ((await obtenerAlmacen()).tipo === 'memoria') docente.error = 'memoria';
    } catch {
      // not read: nothing is taken as stored (every write reads first and fails the same way); a later call loads again
      carga = null;
      docente.error = 'lectura';
    }
    docente.listo = true;
  })();
  return carga;
}

/** «Reintentar» after a failed save. */
export async function reintentarDocente(): Promise<void> {
  await cargarDocente();
  await guardadoPropios.volcar().catch(() => undefined);
  await guardadoResultados.volcar().catch(() => undefined);
}


function nuevoId(prefijo: string): string {
  return `${prefijo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const copia = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * Review 10c (r10c·4/·5): a change is put in memory and written; if the write fails, memory goes back to what it held
 * (unless something else replaced that item meanwhile) and the error reaches the caller. Memory never holds what the
 * device does not: nothing can be taken as stored when it is not (a hand-in that failed, an edit that failed).
 */
async function cambiarAtomico<T>(mapa: Record<string, T>, g: { escribir(): Promise<void> }, id: string, nuevo: T): Promise<void> {
  const antes = id in mapa ? mapa[id] : undefined;
  mapa[id] = nuevo;
  const puesto = mapa[id];
  try {
    await g.escribir();
  } catch (e) {
    if (mapa[id] === puesto) {
      if (antes === undefined) delete mapa[id];
      else mapa[id] = antes;
    }
    throw e;
  }
}

/** Own courses and exams (not deleted), most recently changed first. */
export function listaPropios(tipo?: Propio['tipo']): Propio[] {
  return Object.values(docente.propios)
    .filter((p) => !p.borrado && (!tipo || p.tipo === tipo))
    .sort((a, b) => b.actualizado - a.actualizado || a.id.localeCompare(b.id));
}

export function propio(id: string): Propio | null {
  const p = docente.propios[id];
  return p && !p.borrado ? p : null;
}

export async function crearCurso(titulo: string, notas: string, curso: DefinicionCurso): Promise<string> {
  await cargarDocente();
  const id = nuevoId('c');
  const t = Date.now();
  await cambiarAtomico(docente.propios, guardadoPropios, id, { id, tipo: 'curso', titulo, notas, creado: t, actualizado: t, version: 1, curso: copia(curso) });
  return id;
}

export async function crearExamen(titulo: string, notas: string, examen: DefinicionExamen): Promise<string> {
  await cargarDocente();
  const id = nuevoId('x');
  const t = Date.now();
  await cambiarAtomico(docente.propios, guardadoPropios, id, { id, tipo: 'examen', titulo, notas, creado: t, actualizado: t, version: 1, examen: copia(examen) });
  return id;
}

/**
 * Replaces the title, notes and body of a course or exam: «guardado»; «igual» when nothing changed (nothing written,
 * `actualizado` kept — review 10c, r10c·4); «borrado» when it was deleted meanwhile (here or by a synchronisation):
 * nothing written, the caller offers to keep it as a new one. Rejects when it could not be written (memory unchanged).
 */
export async function actualizarPropio(
  id: string,
  cambios: { titulo: string; notas: string; curso?: DefinicionCurso; examen?: DefinicionExamen },
): Promise<'guardado' | 'igual' | 'borrado'> {
  await cargarDocente();
  const p = docente.propios[id];
  if (!p || p.borrado) return 'borrado';
  const cuerpo = p.tipo === 'curso' ? { curso: copia(cambios.curso ?? p.curso) } : { examen: copia(cambios.examen ?? p.examen) };
  const actual = $state.snapshot(p) as Propio;
  const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const viejo = p.tipo === 'curso' ? (actual as Extract<Propio, { tipo: 'curso' }>).curso : (actual as Extract<Propio, { tipo: 'examen' }>).examen;
  const nuevoCuerpo = 'curso' in cuerpo ? cuerpo.curso : cuerpo.examen;
  if (actual.titulo === cambios.titulo && actual.notas === cambios.notas && igual(viejo, nuevoCuerpo)) return 'igual';
  const t = Math.max(Date.now(), p.actualizado + 1);
  await cambiarAtomico(docente.propios, guardadoPropios, id, { ...actual, titulo: cambios.titulo, notas: cambios.notas, ...cuerpo, actualizado: t } as Propio);
  return 'guardado';
}

/** A copy with «(copia)» in its title; returns the new id. */
export async function duplicarPropio(id: string): Promise<string | null> {
  await cargarDocente();
  const p = propio(id);
  if (!p) return null;
  const titulo = `${p.titulo} (copia)`;
  return p.tipo === 'curso'
    ? crearCurso(titulo, p.notas, p.curso ?? { elementos: [] })
    : crearExamen(titulo, p.notas, p.examen!);
}

export async function borrarPropio(id: string): Promise<void> {
  await cargarDocente();
  const p = docente.propios[id];
  if (!p || p.borrado) return;
  const t = Math.max(Date.now(), p.actualizado + 1);
  // tombstone: the body goes, the entry stays so that a synchronisation knows it was deleted (review 10h: atomic — a
  // failed write leaves it as it was, and the caller says so)
  await cambiarAtomico(docente.propios, guardadoPropios, id, { id, tipo: p.tipo, titulo: p.titulo, notas: '', creado: p.creado, actualizado: t, borrado: t, version: 1 } as Propio);
}

// ------------------------------------------------------------------ results

/** The id of the result of one attempt at an exam (its start): handing the same attempt in again reaches it. */
export const idResultado = (examen: string, inicio: number): string => `r${examen}${inicio.toString(36)}`;

/**
 * Stores a result; rejects when it could not be written (review 10a, r10a·4: the failure was swallowed and the exam's
 * draft removed — the whole exam lost; the caller keeps its draft until this resolves). `id`: the attempt's own id, so
 * that handing the same attempt in again after a failure replaces it instead of adding a second result (the failed
 * write stays pending in memory and may still be stored later).
 */
export async function guardarResultado(r: Omit<Resultado, 'id' | 'actualizado'>, id = nuevoId('r')): Promise<string> {
  await cargarDocente();
  // (review 10b: a result of this attempt that the reader deleted stays deleted — a draft left behind by a removal
  // that failed must not bring it back)
  if (docente.resultados[id]?.borrado) return id;
  // (review 10c, r10c·5: a failed write leaves memory as it was — the unwritten result was found in memory and taken
  // as handed in, and the draft removed: both lost on the next start)
  await cambiarAtomico(docente.resultados, guardadoResultados, id, { ...copia(r), id, actualizado: Math.max(Date.now(), r.t, (docente.resultados[id]?.actualizado ?? 0) + 1) });
  return id;
}

/**
 * The result of an attempt as the DEVICE holds it (read from the storage, not from memory): whether a hand-in really
 * was stored before its draft may go (review 10c, r10c·5). Undefined: not stored (or unreadable).
 */
export async function resultadoGuardado(id: string): Promise<Resultado | undefined> {
  try {
    const v = await (await obtenerAlmacen()).leer<{ resultados?: Record<string, unknown> }>(CLAVE_RESULTADOS);
    const r = v?.resultados?.[id];
    return resultadoValido(r) ? r : undefined;
  } catch {
    return undefined;
  }
}

export function resultado(id: string): Resultado | null {
  const r = docente.resultados[id];
  return r && !r.borrado ? r : null;
}

/** Results of an exam (or all), newest first. */
export function resultadosDe(examen?: string): Resultado[] {
  return Object.values(docente.resultados)
    .filter((r) => !r.borrado && (!examen || r.examen === examen))
    .sort((a, b) => b.t - a.t || a.id.localeCompare(b.id));
}

/** The reader's self-assessment after the exam: the result's items and total, regraded by the caller; rejects on a failed write. */
export async function actualizarResultado(id: string, items: Resultado['items'], puntos: number): Promise<void> {
  await cargarDocente();
  const r = docente.resultados[id];
  if (!r || r.borrado) return;
  // (review 10h: the self-assessments given now are dated, per question — two devices merge them question by question)
  const ahora = Math.max(Date.now(), r.actualizado + 1);
  // (review 11a: and an item whose answers changed — a design simulated later — the same way)
  items = items.map((it, k) => (it.autoeval !== r.items[k]?.autoeval || JSON.stringify(it.valores) !== JSON.stringify(r.items[k]?.valores) ? { ...it, autoevalT: ahora } : it));
  // (review 10c: rejects when it could not be written — the page says so — and memory keeps the stored grade)
  await cambiarAtomico(docente.resultados, guardadoResultados, id, { ...($state.snapshot(r) as Resultado), items: copia(items), puntos, actualizado: Math.max(Date.now(), r.actualizado + 1) });
}

export async function borrarResultado(id: string): Promise<void> {
  await cargarDocente();
  const r = docente.resultados[id];
  if (!r || r.borrado) return;
  const t = Math.max(Date.now(), r.actualizado + 1);
  await cambiarAtomico(docente.resultados, guardadoResultados, id, { id, examen: r.examen, titulo: r.titulo, semilla: r.semilla, inicio: r.inicio, t: r.t, actualizado: t, borrado: t, puntos: 0, maximo: 0, items: [] });
}
