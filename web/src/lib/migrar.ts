// The schema migration of the device's own storage (1.0), run by lib/almacen.ts `obtenerAlmacen` before it hands the
// storage to any module — so nothing reads a key before it is in this version's schema (lib/esquemas.ts).
//
//   1. The versions stored in the key `esquemas` ({formato: 'epa-esquemas', app, almacenes: {key: version}}); without
//      it (data of 0.12 and older, a lector.json copied from an older device) every key is at version 1.
//   2. For each key with migrations due: its value read and migrated in memory (pure, lib/esquemas.ts). A migration that
//      throws leaves that key untouched — and its writes refused for this session (`bloqueadas`, lib/almacen.ts), so no
//      module writes this version's shape over data it could not read as such — with a Spanish notice offering to save
//      the original data to a file (componentes/AvisoDatos.svelte). The other keys migrate.
//   3. Before anything is written, the original values of the keys that change are stored as a backup
//      (sincronizacion/copia-guardada.ts, slot 'copia-migracion': the mechanism of 0.12's automatic backup) — ONCE: a
//      backup for the same target versions and of these very data is kept (a migration cut halfway and run again keeps
//      the first original); one of other data is replaced. If the backup cannot be stored, nothing is migrated (the keys stay as they are, blocked).
//   4. The migrated values are written, then the versions. A start cut between both runs the migrations again on
//      their own output: idempotent, nothing changes.
// A key stored by a NEWER version than this app knows (its version above ESQUEMAS: the reader went back to an older
// app) is left alone and its writes refused too («actualice la aplicación»).
// «Restaurar los datos anteriores» (`restaurarAntesDeMigrar`): the backup's values written back and the old versions
// stored with `retenida` = this app version, which then does not migrate them again (the data stay readable by the
// older app — the way back — and writes to them are refused here); a later version migrates them afresh.

import type { Almacen } from './almacen';
import { CLAVE_ESQUEMAS, ESQUEMAS, migracionesDe, migrarValor } from './esquemas';
import { guardarCopiaEn, leerCopiaDe } from './sincronizacion/copia-guardada';
import { canonico } from './sincronizacion/fusion';
import { VERSION_APP } from './sincronizacion/version-app';

export const RANURA_MIGRACION = 'copia-migracion' as const;
export const FORMATO_COPIA_MIGRACION = 'epa-copia-migracion';

interface Sello {
  formato: 'epa-esquemas';
  app: string;
  almacenes: Record<string, number>;
  /** The app version that must not migrate these keys again (the reader restored the data from before). */
  retenida?: string;
}

export interface FalloMigracion {
  clave: string;
  /** What the migration does (Spanish), or why the key is left alone. */
  descripcion: string;
  error: string;
  tipo: 'fallo' | 'nueva' | 'retenida';
}

export interface ResultadoMigracion {
  /** Keys migrated at this start. */
  migradas: string[];
  /** Keys left as they were: a migration that failed, data of a newer version, data restored to before. */
  fallidas: FalloMigracion[];
  /** Keys whose writes lib/almacen.ts refuses this session. */
  bloqueadas: Set<string>;
}

let resultado: ResultadoMigracion = { migradas: [], fallidas: [], bloqueadas: new Set() };

/** What the migration at this start did (the notice, lib/almacen.ts's guard, the tests). */
export function resultadoMigracion(): ResultadoMigracion {
  return resultado;
}

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

function leerSello(v: unknown): Sello | null {
  if (!esObjeto(v) || v.formato !== 'epa-esquemas' || !esObjeto(v.almacenes)) return null;
  const almacenes: Record<string, number> = {};
  for (const [k, n] of Object.entries(v.almacenes)) if (typeof n === 'number' && Number.isInteger(n) && n >= 1) almacenes[k] = n;
  return { formato: 'epa-esquemas', app: typeof v.app === 'string' ? v.app : '', almacenes, ...(typeof v.retenida === 'string' ? { retenida: v.retenida } : {}) };
}

/** Runs the due migrations on `a` (never throws: a failure is reported in the result). */
export async function migrarAlmacen(a: Almacen): Promise<ResultadoMigracion> {
  const r: ResultadoMigracion = { migradas: [], fallidas: [], bloqueadas: new Set() };
  resultado = r;
  let sello: Sello | null = null;
  try {
    sello = leerSello(await a.leer<unknown>(CLAVE_ESQUEMAS));
  } catch {
    // (unreadable: as if absent — every key at version 1; the migrations are idempotent)
  }
  const retenida = sello?.retenida === VERSION_APP;
  const versiones: Record<string, number> = {};
  const nuevos: Record<string, unknown> = {};
  const originales: Record<string, unknown> = {};
  for (const [clave, actual] of Object.entries(ESQUEMAS)) {
    const desde = sello?.almacenes[clave] ?? 1;
    versiones[clave] = desde;
    if (desde > actual) {
      r.fallidas.push({ clave, tipo: 'nueva', descripcion: 'guardado por una versión más nueva de la aplicación', error: `esquema ${desde}, esta versión conoce el ${actual}` });
      r.bloqueadas.add(clave);
      continue;
    }
    const pasos = migracionesDe(clave, desde);
    if (!pasos.length) {
      versiones[clave] = actual;
      continue;
    }
    if (retenida) {
      r.fallidas.push({ clave, tipo: 'retenida', descripcion: pasos.map((m) => m.descripcion).join('; '), error: 'datos restaurados a como estaban antes de actualizar' });
      r.bloqueadas.add(clave);
      continue;
    }
    let valor: unknown;
    try {
      valor = await a.leer<unknown>(clave);
    } catch (e) {
      r.fallidas.push({ clave, tipo: 'fallo', descripcion: pasos.map((m) => m.descripcion).join('; '), error: `no se ha podido leer: ${mensaje(e)}` });
      r.bloqueadas.add(clave);
      continue;
    }
    if (valor === undefined) {
      // (nothing stored: a fresh key is already in this version's schema)
      versiones[clave] = actual;
      continue;
    }
    let v: unknown = valor;
    let fallo: FalloMigracion | null = null;
    for (const m of pasos) {
      try {
        // (tests: a migration made to fail — tests/datos10.spec.ts, the notice and the original data kept)
        if ((globalThis as { __epaFallarMigracion?: string[] }).__epaFallarMigracion?.includes(clave)) throw new Error('fallo provocado por la prueba');
        v = m.local(v);
      } catch (e) {
        fallo = { clave, tipo: 'fallo', descripcion: m.descripcion, error: mensaje(e) };
        break;
      }
    }
    if (fallo) {
      r.fallidas.push(fallo);
      r.bloqueadas.add(clave);
      continue;
    }
    versiones[clave] = actual;
    if (canonico(v) !== canonico(valor)) {
      nuevos[clave] = v;
      originales[clave] = valor;
    }
  }
  const claves = Object.keys(nuevos);
  if (claves.length) {
    // the originals first, once (a backup for the same targets is kept: it holds the first original)
    const hacia = Object.fromEntries(claves.sort().map((k) => [k, ESQUEMAS[k]!]));
    let copiaHecha = false;
    try {
      // One backup of the originals, never losing one (review 10b, r10b·3: a first start cut between two keys left
      // the first key migrated, and the next start replaced the backup — the first key's original was gone). Per key
      // being migrated now: an original in the backup that is these very data (stored now, or what migrating it gives)
      // is kept; a missing one is ADDED; one of other data (a lector.json copied in, data restored from elsewhere) is
      // replaced — «Restaurarlos…» must never write foreign or stale data (review 10a, low b). Keys of the backup not
      // migrated now stay.
      const previa = await leerCopiaDe(a, RANURA_MIGRACION);
      const p = leerPrevia(previa?.texto);
      const mismaClave = (k: string): boolean => {
        const o = p?.claves?.[k];
        if (o === undefined || p?.hacia?.[k] !== ESQUEMAS[k]) return false;
        if (canonico(o) === canonico(originales[k])) return true;
        try {
          return canonico(migrarValor(k, p?.esquemas?.[k] ?? 1, o)) === canonico(originales[k]);
        } catch {
          return false;
        }
      };
      if (!p || !claves.every(mismaClave)) {
        const base = p && typeof p.claves === 'object' && p.claves ? p : null;
        const copia = {
          formato: FORMATO_COPIA_MIGRACION,
          version: 1,
          app: VERSION_APP,
          t: Date.now(),
          esquemas: { ...(base?.esquemas ?? {}), ...Object.fromEntries(claves.map((k) => [k, sello?.almacenes[k] ?? 1])) },
          hacia: { ...(base?.hacia ?? {}), ...hacia },
          claves: { ...(base?.claves ?? {}), ...Object.fromEntries(claves.filter((k) => !mismaClave(k)).map((k) => [k, originales[k]])) },
        };
        await guardarCopiaEn(a, RANURA_MIGRACION, nombreCopiaMigracion(copia.t), JSON.stringify(copia, null, 1) + '\n');
      }
      copiaHecha = true;
    } catch (e) {
      for (const clave of claves) {
        r.fallidas.push({ clave, tipo: 'fallo', descripcion: 'copia de los datos antes de actualizarlos', error: `no se ha podido guardar la copia previa (${mensaje(e)})` });
        r.bloqueadas.add(clave);
        versiones[clave] = sello?.almacenes[clave] ?? 1;
      }
    }
    if (copiaHecha)
      for (const clave of claves) {
        try {
          await a.escribir(clave, nuevos[clave]);
          r.migradas.push(clave);
        } catch (e) {
          r.fallidas.push({ clave, tipo: 'fallo', descripcion: 'guardar los datos actualizados', error: mensaje(e) });
          r.bloqueadas.add(clave);
          versiones[clave] = sello?.almacenes[clave] ?? 1;
        }
      }
  }
  // the versions, after the data (keys of a newer version keep theirs; a «retenida» mark stays for this version)
  const nuevo: Sello = { formato: 'epa-esquemas', app: VERSION_APP, almacenes: { ...(sello?.almacenes ?? {}), ...versiones }, ...(retenida ? { retenida: VERSION_APP } : {}) };
  if (!sello || canonico(nuevo) !== canonico(sello)) {
    try {
      await a.escribir(CLAVE_ESQUEMAS, nuevo);
      await a.guardarYa?.();
    } catch {
      // (the next start runs the same migrations again: idempotent)
    }
  }
  if (r.fallidas.length) console.warn('migración de datos:', r.fallidas.map((f) => `${f.clave}: ${f.error}`).join('; '));
  return r;
}

interface CopiaPrevia {
  hacia?: Record<string, number>;
  esquemas?: Record<string, number>;
  claves?: Record<string, unknown>;
}

function leerPrevia(texto: string | undefined): CopiaPrevia | null {
  try {
    const o = texto ? (JSON.parse(texto) as unknown) : null;
    return esObjeto(o) ? (o as CopiaPrevia) : null;
  } catch {
    return null;
  }
}

function nombreCopiaMigracion(t: number): string {
  const f = new Date(t);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `electronica-datos-antes-de-actualizar-${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}.json`;
}

/** The backup of the data as they were before the last migration (its name and text), if any. */
export async function leerCopiaMigracion(a: Almacen): Promise<{ nombre: string; texto: string; t: number } | null> {
  return leerCopiaDe(a, RANURA_MIGRACION);
}

/**
 * Writes the backup's original values back and stores their old versions, retained for this app version (it will not
 * migrate them again; their writes are refused here). The page must be reloaded afterwards. Rejects when there is no
 * backup or it cannot be read or written.
 */
export async function restaurarAntesDeMigrar(a: Almacen): Promise<string[]> {
  const c = await leerCopiaDe(a, RANURA_MIGRACION);
  if (!c) throw new Error('No hay ninguna copia de los datos anteriores a la actualización.');
  const o = JSON.parse(c.texto) as { formato?: unknown; claves?: unknown; esquemas?: unknown };
  if (o.formato !== FORMATO_COPIA_MIGRACION || !esObjeto(o.claves)) throw new Error('La copia de los datos anteriores está dañada.');
  const antes = esObjeto(o.esquemas) ? (o.esquemas as Record<string, number>) : {};
  let sello: Sello | null = null;
  try {
    sello = leerSello(await a.leer<unknown>(CLAVE_ESQUEMAS));
  } catch {
    sello = null;
  }
  const almacenes = { ...(sello?.almacenes ?? {}) };
  for (const [k, v] of Object.entries(o.claves)) {
    await a.escribir(k, v);
    almacenes[k] = typeof antes[k] === 'number' ? antes[k] : 1;
  }
  await a.escribir(CLAVE_ESQUEMAS, { formato: 'epa-esquemas', app: VERSION_APP, almacenes, retenida: VERSION_APP } satisfies Sello);
  await a.guardarYa?.();
  return Object.keys(o.claves);
}
