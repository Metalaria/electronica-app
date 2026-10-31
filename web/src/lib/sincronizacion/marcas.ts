// When each item of the reader's data last changed or was deleted on this device, for the synchronisation
// (lib/sincronizacion/registro.svelte.ts). The data modules call these two functions (a module with a `Guardado`
// marks every write of the reader's changes by itself). Since the third review a change WITHOUT a mark is taken for a
// stale copy (a module's old memory, an old version) and never outdates what was synchronised (fusion.ts fecharLocal),
// so the marks must not get lost:
//   - they are written to the almacen key `sinc-marcas` at once (next tick), and `volcarMarcas()` waits for that;
//   - every write is read-merge-write, so a browser tab never overwrites the marks another tab stored meanwhile (the
//     latest mark of an item wins; a change and a deletion of the same item: the later one);
//   - after a run, only the marks that run saw (`recargarMarcas`) are forgotten, and only if unchanged since.
//   { cambios: { <store key>: { <item id>: ms } }, borrados: { <store key>: { <item id>: ms } } }

import { obtenerAlmacen } from '../almacen';

export const CLAVE_MARCAS = 'sinc-marcas';

export interface Marcas {
  cambios: Record<string, Record<string, number>>;
  borrados: Record<string, Record<string, number>>;
  /**
   * The hash of the value a change mark is for, when the module knows it (a `Guardado`): a mark made by one tab for
   * its value does not make another tab's older copy of the item pass for a change (fusion.ts fecharLocal). The 0.10
   * engine ignores the field.
   */
  huellas: Record<string, Record<string, string>>;
}
type Tipo = 'cambios' | 'borrados';

interface Marca {
  tipo: Tipo;
  clave: string;
  id: string;
  t: number;
  h?: string;
}

const vacias = (): Marcas => ({ cambios: {}, borrados: {}, huellas: {} });
/** The stored marks (as last read) with this tab's not written yet. */
let marcas: Marcas = vacias();
/** This tab's marks not written yet, in order. */
let pendientes: Marca[] = [];
/** The marks the last run saw (`recargarMarcas`): the only ones `olvidarMarcas` may forget. */
let vistas: Marcas = vacias();
/** Reads and writes of the key, one at a time in this tab. */
let cola: Promise<unknown> = Promise.resolve();
let programado = false;

function enCola<T>(f: () => Promise<T>): Promise<T> {
  const p = cola.then(f);
  cola = p.catch(() => undefined);
  return p;
}

function normalizar(m: unknown): Marcas {
  const r = vacias();
  if (!m || typeof m !== 'object') return r;
  for (const tipo of ['cambios', 'borrados'] as const) {
    const g = (m as Partial<Marcas>)[tipo];
    if (!g || typeof g !== 'object') continue;
    for (const [k, ids] of Object.entries(g)) {
      if (!ids || typeof ids !== 'object') continue;
      for (const [id, t] of Object.entries(ids)) if (typeof t === 'number' && Number.isFinite(t)) (r[tipo][k] ??= {})[id] = t;
    }
  }
  const h = (m as Partial<Marcas>).huellas;
  if (h && typeof h === 'object')
    for (const [k, ids] of Object.entries(h)) {
      if (!ids || typeof ids !== 'object') continue;
      for (const [id, x] of Object.entries(ids)) if (typeof x === 'string' && r.cambios[k]?.[id] !== undefined) (r.huellas[k] ??= {})[id] = x;
    }
  return r;
}

function quitarHuella(m: Marcas, clave: string, id: string): void {
  if (!m.huellas[clave]) return;
  delete m.huellas[clave]![id];
  if (!Object.keys(m.huellas[clave]!).length) delete m.huellas[clave];
}

/** Puts a mark in `m`: the latest mark of an item wins (a change after its deletion is a re-creation, and back). */
function poner(m: Marcas, x: Marca): void {
  const otro = x.tipo === 'cambios' ? 'borrados' : 'cambios';
  const contrario = m[otro][x.clave]?.[x.id];
  if (contrario !== undefined && contrario > x.t) return;
  const actual = m[x.tipo][x.clave]?.[x.id];
  if (actual === undefined || actual < x.t || (actual === x.t && x.tipo === 'cambios' && x.h !== undefined)) {
    (m[x.tipo][x.clave] ??= {})[x.id] = x.t;
    if (x.tipo === 'cambios' && x.h !== undefined) (m.huellas[x.clave] ??= {})[x.id] = x.h;
    else if (x.tipo === 'cambios') quitarHuella(m, x.clave, x.id);
  }
  if (contrario !== undefined) {
    delete m[otro][x.clave]![x.id];
    if (!Object.keys(m[otro][x.clave]!).length) delete m[otro][x.clave];
  }
  if (x.tipo === 'borrados') quitarHuella(m, x.clave, x.id);
}

/**
 * The stored marks. A read that FAILS rejects (sixth review: taken for «no marks», the next write stored only the new
 * ones and every other pending mark was lost — the next run then reverted the offline edits); a damaged value is
 * read as what can be read of it (`normalizar`).
 */
async function leerGuardadas(): Promise<Marcas> {
  return normalizar(await (await obtenerAlmacen()).leer<unknown>(CLAVE_MARCAS));
}

/** The stored ones as this tab's view, with what it has not written yet. */
function verComo(guardadas: Marcas): void {
  marcas = guardadas;
  for (const x of pendientes) poner(marcas, x);
}

/**
 * Writes this tab's pending marks into the stored ones (read-merge-write: another tab's are kept) and refreshes this
 * tab's view. Rejects if the storage does (the marks stay pending).
 */
export function volcarMarcas(): Promise<void> {
  return enCola(async () => {
    const escribir = pendientes;
    pendientes = [];
    let s: Marcas;
    try {
      s = await leerGuardadas();
      for (const x of escribir) poner(s, x);
      if (escribir.length) await (await obtenerAlmacen()).escribir(CLAVE_MARCAS, s);
    } catch (e) {
      // (the read or the write failed: this tab's marks stay pending, and its view as it was)
      pendientes = [...escribir, ...pendientes];
      throw e;
    }
    verComo(s);
  });
}

/**
 * The marks of this device (every tab's), with this tab's written first: before every synchronisation. The run
 * forgets afterwards only these (`olvidarMarcas`).
 */
export async function recargarMarcas(): Promise<Marcas> {
  await volcarMarcas().catch(() => undefined);
  vistas = structuredClone(marcas);
  return marcas;
}

function anotar(tipo: Tipo, clave: string, ids: string[], t: number, h?: string): void {
  for (const id of ids) {
    const x: Marca = { tipo, clave, id, t, ...(h !== undefined ? { h } : {}) };
    pendientes.push(x);
    poner(marcas, x);
  }
  if (programado) return;
  programado = true;
  setTimeout(() => {
    programado = false;
    void volcarMarcas().catch(() => undefined);
  }, 0);
}

/**
 * The latest mark of an item in this tab's view (the stored marks as last read, with this tab's): a change (with the
 * hash of its value when known) or a deletion. `volcarMarcas()` refreshes the view first.
 */
export function marcaDe(clave: string, id: string): { t: number; h?: string; borrado: boolean } | undefined {
  const c = marcas.cambios[clave]?.[id];
  if (c !== undefined) return { t: c, h: marcas.huellas[clave]?.[id], borrado: false };
  const b = marcas.borrados[clave]?.[id];
  return b !== undefined ? { t: b, borrado: true } : undefined;
}

/** An item was created or changed on this device; `huella`: the hash of its new value, when known. */
export function anotarCambio(clave: string, id: string, t = Date.now(), huella?: string): void {
  anotar('cambios', clave, [id], t, huella);
}

/** Items were deleted on this device: their tombstones get this time. */
export function anotarBorrado(clave: string, ids: string | string[], t = Date.now()): void {
  anotar('borrados', clave, Array.isArray(ids) ? ids : [ids], t);
}

/**
 * After a synchronisation: forgets the marks it saw (`recargarMarcas`) not newer than `hasta` — and only if still the
 * same (a newer mark of the item, made meanwhile here or in another tab, stays) — except those of the stores in
 * `conservar`.
 */
export function olvidarMarcas(hasta: number, conservar: Set<string> = new Set()): Promise<void> {
  return enCola(async () => {
    const escribir = pendientes;
    pendientes = [];
    let s: Marcas;
    try {
      s = await leerGuardadas();
      for (const x of escribir) poner(s, x);
      for (const tipo of ['cambios', 'borrados'] as const)
        for (const [k, ids] of Object.entries(vistas[tipo])) {
          if (conservar.has(k) || !s[tipo][k]) continue;
          for (const [id, t] of Object.entries(ids))
            if (t <= hasta && s[tipo][k]![id] === t) {
              delete s[tipo][k]![id];
              if (tipo === 'cambios') quitarHuella(s, k, id);
            }
          if (!Object.keys(s[tipo][k]!).length) delete s[tipo][k];
        }
      await (await obtenerAlmacen()).escribir(CLAVE_MARCAS, s);
    } catch (e) {
      // (nothing forgotten: the marks stay — the next run sees them and finds the items as recorded)
      pendientes = [...escribir, ...pendientes];
      throw e;
    }
    vistas = vacias();
    verComo(s);
  });
}
