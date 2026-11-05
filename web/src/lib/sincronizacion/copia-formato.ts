// The backup file of all the reader's progress (0.12), pure (no storage: also run by the tests in Node).
//
//   { "formato": "epa-copia-seguridad", "version": 1, "app": "0.12.0", "exportado": 1793800000000,
//     "dispositivo": "Mac", "almacenes": { "<store>": { "<item id>": { "t": ms, "v": value } | { "t": ms, "x": 1 } } } }
//
// `almacenes` holds every store the synchronisation knows (registro.svelte.ts), each item dated as this device's next
// synchronisation would send it — tombstones of deleted items included — so an import merges with exactly the rules
// of the synchronisation (fusion.ts: last write wins per item, the stores' unions, the newest N). Device-only data
// (theme, text size, the greeting's name, the synchronisation's settings, the device id) and the GitHub token are
// never in it. Written with sorted keys and one level of indentation, like the synchronisation's file.
// An import also accepts the synchronisation's own file (`epa-sincronizacion`, as any version since 0.7 wrote it: the
// same collections), so the copy kept on GitHub can be restored by hand. A newer format is refused (update the app);
// older formats are migrated step by step (`MIGRACIONES`); items an older version wrote are read by their stores as
// always (e.g. the daily progress of 0.9–0.11: lib/progreso-dias.ts).

import { canonico, entradaValida, esLapida, fusionarColecciones, huella, limitar, FORMATO, type Coleccion, type Entrada, type Union } from './fusion';

export const FORMATO_COPIA = 'epa-copia-seguridad';
export const VERSION_COPIA = 1;

export interface Copia {
  formato: typeof FORMATO_COPIA;
  version: number;
  /** The app version that wrote it. */
  app: string;
  /** When it was made (ms). */
  exportado: number;
  /** The device's name (sincronizar.svelte.ts nombreDispositivo). */
  dispositivo: string;
  /**
   * 0.12c: the automatic backup made before «Sustituir todo» (absent otherwise; an older reader ignores it). Undoing that
   * replacement takes «Sustituir» with this file: «Unir» would keep the replacement's newer versions.
   */
  automatica?: true;
  almacenes: Record<string, Coleccion>;
}

/** What an import needs to know of a store (registro.svelte.ts `Sincronizable`). */
export interface AlmacenConocido {
  clave: string;
  nombre: string;
  valido?: (v: unknown) => boolean;
  unir?: (a: unknown, b: unknown) => unknown;
  maximo?: number;
}

/** A Spanish message for the reader: the file cannot be imported. */
export class ErrorCopia extends Error {}

/** A file read and checked: what can be imported, and what was left out. */
export interface CopiaLeida {
  copia: Copia;
  /** The file was the synchronisation's (GitHub) file, not a backup. */
  deSincronizacion: boolean;
  /** Items left out: malformed entries, or values their store rejects (store → count). */
  descartados: Record<string, number>;
  /** Stores this version does not know (a newer version's): left out. */
  desconocidos: string[];
}

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The file's text: stable key order, one level of indentation. */
export function escribirCopia(c: Copia): string {
  return JSON.stringify(JSON.parse(canonico(c)), null, 1) + '\n';
}

/** «electronica-copia-2026-11-04-1830.json» (local time). */
export function nombreCopia(t: number): string {
  const f = new Date(t);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `electronica-copia-${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}-${dos(f.getHours())}${dos(f.getMinutes())}.json`;
}

/**
 * Migrations of the backup format, from version n to n + 1 (none yet: 1 is the first). Each takes the parsed object
 * of version n and returns version n + 1's.
 */
export const MIGRACIONES: Record<number, (o: Record<string, unknown>) => Record<string, unknown>> = {};

/**
 * Reads a backup (or the synchronisation's file) and checks it item by item against the stores of this version.
 * Throws an `ErrorCopia` (Spanish) when it is not a usable file: not JSON (damaged, cut short), not this app's, a
 * newer format, no data. A damaged item is left out and counted, never the whole store.
 */
export function leerCopia(texto: string, almacenes: AlmacenConocido[]): CopiaLeida {
  let o: unknown;
  try {
    o = JSON.parse(texto.replace(/^﻿/, ''));
  } catch {
    throw new ErrorCopia('El fichero no es JSON válido: está dañado o incompleto (¿se cortó al copiarlo?). No se ha importado nada.');
  }
  if (!esObjeto(o)) throw new ErrorCopia('El fichero no contiene una copia de seguridad de esta aplicación. No se ha importado nada.');
  const deSincronizacion = o.formato === FORMATO;
  if (o.formato !== FORMATO_COPIA && !deSincronizacion)
    throw new ErrorCopia('El fichero no es una copia de seguridad de «Electrónica Práctica Avanzada». No se ha importado nada.');
  const version = o.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    throw new ErrorCopia('El fichero no indica una versión de formato válida. No se ha importado nada.');
  // the synchronisation's file has its own format version (fusion.ts VERSION_DOC); its collections are the same
  const maxima = deSincronizacion ? 1 : VERSION_COPIA;
  if (version > maxima)
    throw new ErrorCopia(
      `La copia se hizo con una versión más nueva de la aplicación (formato ${version}${typeof o.app === 'string' ? `, aplicación ${o.app}` : ''}). Actualice la aplicación para importarla.`,
    );
  let x: Record<string, unknown> = o;
  if (!deSincronizacion) for (let v = version; v < VERSION_COPIA; v++) x = MIGRACIONES[v]!(x);
  if (!esObjeto(x.almacenes)) throw new ErrorCopia('La copia no contiene datos («almacenes»). No se ha importado nada.');

  const conocidos = new Map(almacenes.map((a) => [a.clave, a]));
  const r: Record<string, Coleccion> = {};
  const descartados: Record<string, number> = {};
  const desconocidos: string[] = [];
  for (const [k, c] of Object.entries(x.almacenes)) {
    const a = conocidos.get(k);
    if (!a) {
      desconocidos.push(k);
      continue;
    }
    const col: Coleccion = {};
    let malos = 0;
    if (esObjeto(c)) {
      for (const [id, e] of Object.entries(c)) {
        if (!entradaValida(e)) {
          malos++;
          continue;
        }
        const limpia: Entrada = esLapida(e) ? { t: e.t, x: 1 } : { t: e.t, v: e.v };
        if (!esLapida(limpia)) {
          let bueno = true;
          try {
            bueno = !a.valido || a.valido(limpia.v);
          } catch {
            bueno = false;
          }
          if (!bueno) {
            malos++;
            continue;
          }
        }
        col[id] = limpia;
      }
    } else malos++;
    if (malos) descartados[k] = malos;
    r[k] = col;
  }
  if (!Object.keys(r).length && desconocidos.length)
    throw new ErrorCopia('La copia solo contiene datos que esta versión de la aplicación no conoce. Actualice la aplicación para importarla.');
  return {
    copia: {
      formato: FORMATO_COPIA,
      version: VERSION_COPIA,
      app: typeof x.app === 'string' ? x.app : deSincronizacion ? '' : '?',
      exportado: typeof x.exportado === 'number' && Number.isFinite(x.exportado) ? x.exportado : Number(x.actualizado) || 0,
      dispositivo: typeof x.dispositivo === 'string' ? x.dispositivo : '',
      ...(!deSincronizacion && x.automatica === true ? { automatica: true as const } : {}),
      almacenes: r,
    },
    deSincronizacion,
    descartados,
    desconocidos: desconocidos.sort(),
  };
}

export type ModoImportacion = 'unir' | 'sustituir';

/** What an import does to one store. */
export interface PlanAlmacen {
  clave: string;
  nombre: string;
  /** Items to create or replace (value), and to delete. */
  poner: Record<string, unknown>;
  quitar: string[];
  /** The time of each change's mark (the synchronisation sends it with this time: fusion.ts fecharLocal). */
  marcas: Record<string, number>;
  nuevos: number;
  cambiados: number;
  borrados: number;
  iguales: number;
  /**
   * «unir»: the copy's live items left out because they are older than the synchronisation's prune horizon and unknown
   * here (they may have been deleted since and their tombstones pruned: importing them would bring them back to every
   * device — review 0.12, finding 1); included only when asked (`incluirAntiguos`).
   */
  antiguos: number;
}

/** Options of a plan. */
export interface OpcionesPlan {
  /**
   * «unir»: the prune horizon of the file this device last merged (sinc-estado `podado`, 0: never merged one): a copy's
   * item older than it and unknown here is left out (counted in `antiguos`) unless `incluirAntiguos`.
   */
  horizonte?: number;
  incluirAntiguos?: boolean;
}

/**
 * The plan of an import against the local data (each store's items dated as the synchronisation dates them:
 * sincronizar.svelte.ts fotografiaLocal).
 *   - «unir» (the default): every item merged with the synchronisation's rule — the newer version of each item wins,
 *     a deletion newer than the copy's item keeps it deleted (no resurrection), a local item the copy does not have
 *     stays (nothing is lost), the stores' unions merge both, `maximo` keeps the newest N. What changes is marked at
 *     the merged item's time: the next synchronisation sends exactly that, and nothing older than what other devices
 *     hold.
 *   - «sustituir»: each store the copy holds becomes the copy's (stores it does not hold are left alone); what changes
 *     is marked at `ahora`, so those changes — the copy's values, and the deletion of what the copy lacks — are
 *     synchronised as edits made now (an item already equal to the copy's is synchronised as usual).
 */
export function planificar(
  local: Record<string, Coleccion>,
  copia: Copia,
  almacenes: AlmacenConocido[],
  modo: ModoImportacion,
  ahora: number,
  opciones: OpcionesPlan = {},
): PlanAlmacen[] {
  const horizonte = opciones.incluirAntiguos ? 0 : (opciones.horizonte ?? 0);
  const planes: PlanAlmacen[] = [];
  for (const a of almacenes) {
    const col = copia.almacenes[a.clave];
    if (!col) continue;
    const l = local[a.clave] ?? {};
    const vivo = (e: Entrada | undefined) => (e && !esLapida(e) ? e : undefined);
    const p: PlanAlmacen = { clave: a.clave, nombre: a.nombre, poner: {}, quitar: [], marcas: {}, nuevos: 0, cambiados: 0, borrados: 0, iguales: 0, antiguos: 0 };
    const union: Union | undefined = a.unir ? { unir: a.unir, valido: a.valido } : undefined;
    // «unir»: the copy without its items older than the prune horizon that this device does not know at all (neither
    // live nor deleted): the synchronisation would take them for new and bring back what was deleted and pruned
    let c = col;
    if (modo === 'unir' && horizonte > 0) {
      c = {};
      for (const [id, e] of Object.entries(col)) {
        if (!esLapida(e) && e.t <= horizonte && !(id in l)) p.antiguos++;
        else c[id] = e;
      }
    }
    // the target of each item: the merge (local as `a`: a union equal to the local value keeps its time) or the copy
    const destino: Coleccion =
      modo === 'unir' ? limitar(fusionarColecciones(l, c, union), a.maximo) : limitar(Object.fromEntries(Object.entries(c).filter(([, e]) => !esLapida(e))), a.maximo);
    for (const id of new Set([...Object.keys(l), ...Object.keys(destino)])) {
      const antes = vivo(l[id]);
      const despues = vivo(destino[id]);
      const t = modo === 'unir' ? (destino[id]?.t ?? ahora) : ahora;
      if (despues && !antes) {
        p.poner[id] = despues.v;
        p.marcas[id] = t;
        p.nuevos++;
      } else if (despues && antes) {
        if (huella(despues.v) === huella(antes.v)) p.iguales++;
        else {
          p.poner[id] = despues.v;
          p.marcas[id] = t;
          p.cambiados++;
        }
      } else if (antes && !despues) {
        p.quitar.push(id);
        // (an item `maximo` dropped is not marked: the synchronisation drops it the same way)
        if (destino[id] || modo === 'sustituir') p.marcas[id] = t;
        p.borrados++;
      }
    }
    planes.push(p);
  }
  return planes;
}
