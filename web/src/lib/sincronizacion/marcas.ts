// When each item of the reader's data last changed or was deleted on this device, for the synchronisation
// (lib/sincronizacion/registro.svelte.ts). The data modules call these two functions (a module with a `Guardado`
// marks every write of the reader's changes by itself). Since the third review a change WITHOUT a mark is taken for a
// stale copy (a module's old memory, an old version) and never outdates what was synchronised (fusion.ts fecharLocal),
// so the marks must not get lost:
//   - they are written to the almacen key `sinc-marcas` at once (next tick), and `volcarMarcas()` waits for that;
//   - every write is read-merge-write, so a browser tab never overwrites the marks another tab stored meanwhile (the
//     latest mark of an item wins; a change and a deletion of the same item: the later one);
//   - after a run, only the marks that run saw (`recargarMarcas`) are forgotten, and only if unchanged since;
//   - in a browser, each tab remembers the marks it stored (`mias`) and puts back any another tab's read-merge-write
//     lost (its cached view of localStorage lagged: review 0.12b, finding 2) — after every write of its own, on every
//     `storage` event of the key — unless a run recorded the item since or started after the mark was stored (it
//     saw it, and may have forgotten it).
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

/** The stored marks as last read or written (without this tab's pending ones). */
let ultimasGuardadas: Marcas = vacias();

/**
 * The marks this tab stored, in a browser (review 0.12b, finding 2), with when they were stored: another tab whose
 * cached view of localStorage lagged can write the key without them (its read-merge-write cannot see them), and the
 * item's change would then be taken for a stale copy (fusion.ts fecharLocal) — they are put back (`reponerMias`).
 */
interface Mia {
  x: Marca;
  guardada: number;
}
let mias: Mia[] = [];
/**
 * At most this many (review 0.12c, finding 6): kept in this tab's memory only (~150 bytes each: 3 MB at most), so far
 * more than the largest burst of marks of a session — «Reiniciar tarjetas» ~2500 (cards, reverses, days), the first
 * import of a big backup a few thousand —; an entry leaves sooner once its mark is superseded or dealt with by a run
 * (`reponerMias`). Beyond it the oldest go — which only matters if one of those were also lost to another tab's stale
 * write.
 */
const MIAS_MAX = 20_000;
/**
 * A run that started at least this long after a mark was stored saw it (another tab's cached view lags by far less):
 * the mark missing then was forgotten by that run, not lost — it is not put back.
 */
const HOLGURA_MIAS = 2000;

/** The mark is not in `s`, and nothing newer of the item is (a mark of the item newer than it: no longer needed). */
function falta(s: Marcas, x: Marca): boolean | 'superada' {
  const actual = s[x.tipo][x.clave]?.[x.id];
  const otro = s[x.tipo === 'cambios' ? 'borrados' : 'cambios'][x.clave]?.[x.id];
  // (a mark of the other kind at the same time is not fought over: the later of two marks of one time wins in `poner`)
  if ((actual !== undefined && actual > x.t) || (otro !== undefined && otro >= x.t)) return 'superada';
  if (actual === x.t) return false;
  return true;
}

/**
 * Puts back in `s` this tab's stored marks that are missing from it, unless the synchronisation record (`sinc-estado`)
 * shows a run dealt with them: it recorded the item at or after the mark (pushed it, or something newer), or it
 * started after the mark was stored with the mark not newer than its start (it saw the mark, and forgot it). A mark
 * forgotten legitimately is so never put back more than once per run that forgets it (a run started within
 * HOLGURA_MIAS of the store; harmless then: a mark not newer than the last run's start never outdates what was recorded,
 * fusion.ts fecharLocal). Whether anything was put back.
 */
async function reponerMias(s: Marcas): Promise<boolean> {
  if (!mias.length) return false;
  const faltan = new Set<Mia>();
  mias = mias.filter((m) => {
    const f = falta(s, m.x);
    if (f === 'superada') return false;
    if (f) faltan.add(m);
    return true;
  });
  if (!faltan.size) return false;
  let e: { iniciada?: unknown; items?: Record<string, Record<string, unknown>>; borrados?: Record<string, Record<string, unknown>> } | undefined;
  try {
    e = await (await obtenerAlmacen()).leer('sinc-estado');
  } catch {
    // (not readable now: put back — at worst once, a mark a run forgot, harmless as above)
    e = undefined;
  }
  const est = e && typeof e === 'object' ? e : {};
  const iniciada = typeof est.iniciada === 'number' ? est.iniciada : -Infinity;
  let cambiado = false;
  mias = mias.filter((m) => {
    if (!faltan.has(m)) return true;
    const { x } = m;
    const r = est.items?.[x.clave]?.[x.id];
    const b = est.borrados?.[x.clave]?.[x.id];
    if ((Array.isArray(r) && typeof r[0] === 'number' && r[0] >= x.t) || (typeof b === 'number' && b >= x.t)) return false;
    if (x.t <= iniciada && m.guardada + HOLGURA_MIAS < iniciada) return false;
    poner(s, x);
    cambiado = true;
    return true;
  });
  return cambiado;
}

/** Remembers the marks this tab just stored (`mias`), in a browser only (Tauri: one window). */
function recordarMias(a: { tipo: string }, lista: Marca[]): void {
  if (a.tipo !== 'navegador' || !lista.length) return;
  const ahora = Date.now();
  // one per item, the last: an item's earlier mark of this tab — a change or a deletion — is superseded by the later
  // one (randomized trial 557: a change and then a deletion at the same millisecond — kept both, the change put back
  // over the deletion, and the deleted item came back)
  const ultima = new Map<string, Marca>();
  for (const x of lista) ultima.set(`${x.clave}|${x.id}`, x);
  mias = [...mias.filter((m) => !ultima.has(`${m.x.clave}|${m.x.id}`)), ...[...ultima.values()].map((x) => ({ x, guardada: ahora }))].slice(-MIAS_MAX);
}

/** The stored ones as this tab's view, with what it has not written yet. */
function verComo(guardadas: Marcas): void {
  ultimasGuardadas = structuredClone(guardadas);
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
      const a = await obtenerAlmacen();
      s = await leerGuardadas();
      for (const x of escribir) poner(s, x);
      const repuestas = await reponerMias(s);
      if (escribir.length || repuestas) await a.escribir(CLAVE_MARCAS, s);
      recordarMias(a, escribir);
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

/**
 * Another tab wrote the marks (browser `storage` event): this tab's stored ones are checked (and put back if lost)
 * soon, once per burst of writes.
 */
let revisando = false;
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function')
  window.addEventListener('storage', (ev) => {
    if (ev.key !== `epa:${CLAVE_MARCAS}` || !mias.length || revisando) return;
    revisando = true;
    setTimeout(() => {
      revisando = false;
      void volcarMarcas().catch(() => undefined);
    }, 0);
  });

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

/**
 * Withdraws marks this tab made and could not store (0.12, review finding 6: an import whose marks could not be stored
 * imports nothing, and its marks must not be stored later by another write). Only marks still pending are withdrawn.
 */
export function retirarMarcas(lista: { tipo: Tipo; clave: string; id: string; t: number }[]): void {
  const fuera = new Set(lista.map((x) => `${x.tipo}|${x.clave}|${x.id}|${x.t}`));
  pendientes = pendientes.filter((x) => !fuera.has(`${x.tipo}|${x.clave}|${x.id}|${x.t}`));
  verComo(structuredClone(ultimasGuardadas));
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
      const a = await obtenerAlmacen();
      s = await leerGuardadas();
      for (const x of escribir) poner(s, x);
      const olvidadas = new Set<string>();
      for (const tipo of ['cambios', 'borrados'] as const)
        for (const [k, ids] of Object.entries(vistas[tipo])) {
          if (conservar.has(k) || !s[tipo][k]) continue;
          for (const [id, t] of Object.entries(ids))
            if (t <= hasta && s[tipo][k]![id] === t) {
              delete s[tipo][k]![id];
              if (tipo === 'cambios') quitarHuella(s, k, id);
              olvidadas.add(`${tipo}|${k}|${id}|${t}`);
            }
          if (!Object.keys(s[tipo][k]!).length) delete s[tipo][k];
        }
      // (this tab's own forgotten marks are not put back; another tab's lost ones are: `reponerMias`)
      mias = mias.filter(({ x }) => !olvidadas.has(`${x.tipo}|${x.clave}|${x.id}|${x.t}`));
      await reponerMias(s);
      await a.escribir(CLAVE_MARCAS, s);
      recordarMias(a, escribir);
    } catch (e) {
      // (nothing forgotten: the marks stay — the next run sees them and finds the items as recorded)
      pendientes = [...escribir, ...pendientes];
      throw e;
    }
    vistas = vacias();
    verComo(s);
  });
}
