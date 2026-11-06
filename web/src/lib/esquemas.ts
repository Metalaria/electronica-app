// The stable data format (1.0): the schema version of every stored key and the ONE registry of migrations (pure, no
// DOM: also used by the tests in Node). Used by
//   - lib/migrar.ts           the device's own storage, at load, before any module reads it;
//   - sincronizacion/fusion.ts the synchronisation file of an older format (`leerDoc`);
//   - sincronizacion/copia-formato.ts a backup (or synchronisation file) of an older format (`leerCopia`).
//
// Each migration takes ONE key from version n to n + 1, and is
//   - pure: a function of the old value only (no clock, no device), so every device that migrates the same data
//     writes the same value and the synchronisation sends nothing twice;
//   - idempotent: run again on its own output it changes nothing (a migration cut before the versions were stored
//     runs again at the next start);
//   - total: it never throws on a well-formed value of version n; a damaged value is left as it is (the module's own
//     reader already drops what it cannot read). A migration that does throw leaves that key untouched (lib/migrar.ts).
// `local` migrates the value as stored on the device; `coleccion` the same store as the synchronisation file and the
// backups carry it ({id: {t, v} | {t, x: 1}}), keeping each item's time when its value is unchanged. `formato` is the
// version of those two file formats that introduced the migration: a file of an older format gets every migration
// with a larger `formato`, in order.
//
// Adding a migration (a store whose stored shape changes): bump that key's version in ESQUEMAS, add the step here with
// a test from real fixtures (tests/actualizacion), and bump FORMATO_DATOS when the store is synchronised — older apps
// then refuse the new file instead of writing their old shape over it (fusion.ts VERSION_DOC, copia VERSION_COPIA).
// Keys this registry does not list (a newer version's, or a module's own) are left alone.

import { absorberLegado, type DiaProgreso } from './progreso-dias';

/** The format of the data in the synchronisation file and the backups: 1 up to 0.12, 2 since 1.0. */
export const FORMATO_DATOS = 2;
/** The first app version that reads FORMATO_DATOS (devices of the file below it are told to update). */
export const VERSION_MINIMA_DATOS = '1.0.0';

/**
 * Schema version of every key the app stores (lib/almacen.ts; `epa:<key>` in a browser, keys of `lector.json` in Tauri).
 * 1 = the shape 0.12.0 stores (and reads, with its lazy migrations, from 0.9–0.11).
 */
export const ESQUEMAS: Readonly<Record<string, number>> = {
  prefs: 1,
  posiciones: 1,
  marcadores: 1,
  notas: 1,
  ejercicios: 2,
  leidas: 1,
  deducciones: 1,
  'calc-favoritos': 1,
  'repaso-tarjetas': 1,
  'repaso-diario': 1,
  'repaso-ajustes': 1,
  'repaso-tests': 1,
  'repaso-fallos': 1,
  'repaso-examenes': 1,
  lecciones: 1,
  'progreso-diario': 2,
  'progreso-objetivo': 1,
  'progreso-xp': 1,
  cursos: 1,
  dominio: 1,
  'problema-dia': 1,
  // 1.0: «¿Qué seguridad tiene?» (lib/aprendizaje/seguridad.svelte.ts), synchronised as store `seguridad`
  seguridad: 1,
  'editor-circuitos': 1,
  'protoboard-circuitos': 1,
  'protoboard-recorrido': 1,
  'protoboard-leccion': 1,
  'medir-pista': 1,
  'componentes-vista': 1,
  'recordatorio-icono': 1,
  'dispositivo-local': 1,
  'sinc-ajustes': 1,
  'sinc-estado': 1,
  'sinc-marcas': 1,
  'sinc-version': 1,
  'sinc-aplicados': 1,
  'sinc-enviado': 1,
  'copia-automatica': 1,
  'copia-migracion': 1,
  // 1.0: teacher mode (lib/docente/estado.svelte.ts): own courses and exams, their results
  docente: 1,
  'docente-resultados': 1,
};

/** The key that records the schema version of each key (lib/migrar.ts). Never synchronised nor exported. */
export const CLAVE_ESQUEMAS = 'esquemas';

export interface Migracion {
  clave: string;
  /** From version `de` to `de + 1`. */
  de: number;
  /** The file format (FORMATO_DATOS) that introduced it. */
  formato: number;
  /** What it does, in Spanish (the notice when it fails, the README). */
  descripcion: string;
  local: (valor: unknown) => unknown;
  coleccion?: (c: Record<string, unknown>) => Record<string, unknown>;
}

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const diaBueno = (v: unknown): v is DiaProgreso => esObjeto(v) && typeof v.t === 'number' && Number.isFinite(v.t);

/** progreso-diario 1 → 2 on a plain map of days (only well-formed items take part; the others are left as they are). */
function migrarDias(valor: unknown): unknown {
  if (!esObjeto(valor)) return valor;
  const m: Record<string, DiaProgreso> = {};
  for (const [id, v] of Object.entries(valor)) if (diaBueno(v)) m[id] = { ...v, pasos: n(v.pasos), preguntas: n(v.preguntas), secciones: n(v.secciones) };
  const escritos = absorberLegado(m);
  if (!escritos.length) return valor;
  const r: Record<string, unknown> = { ...valor };
  for (const id of escritos) r[id] = m[id];
  return r;
}
const n = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.round(x)) : 0);

/**
 * ejercicios 1 → 2 (review 10a, r10a·2): every key of an exercise's `valores` without its time in `vt` gets the item's
 * own time — what 0.12 knew of it. Without it, 1.0's merge (lib/union-ejercicios.ts) would date such a key by the
 * item's CURRENT time, which a later change of another key moves on: an old text would pass for new. Damaged items
 * are left as they are.
 */
function migrarEjercicios(valor: unknown): unknown {
  if (!esObjeto(valor)) return valor;
  let r: Record<string, unknown> | null = null;
  for (const [id, e] of Object.entries(valor)) {
    if (!esObjeto(e) || !esObjeto(e.valores) || typeof e.t !== 'number' || !Number.isFinite(e.t)) continue;
    const vt = esObjeto(e.vt) ? e.vt : {};
    const faltan = Object.keys(e.valores).filter((k) => typeof vt[k] !== 'number');
    if (!faltan.length) continue;
    r ??= { ...valor };
    r[id] = { ...e, vt: { ...vt, ...Object.fromEntries(faltan.map((k) => [k, e.t])) } };
  }
  return r ?? valor;
}

/** A migration of plain items applied to a collection {id: {t, v} | {t, x: 1}}: changed items get their value's time. */
function enColeccion(f: (valor: unknown) => unknown, tiempo: (v: unknown) => number): (c: Record<string, unknown>) => Record<string, unknown> {
  return (c) => {
    const vivos: Record<string, unknown> = {};
    for (const [id, e] of Object.entries(c)) if (esObjeto(e) && e.x !== 1 && 'v' in e) vivos[id] = e.v;
    const migrado = f(vivos);
    if (migrado === vivos || !esObjeto(migrado)) return c;
    const r: Record<string, unknown> = { ...c };
    for (const [id, v] of Object.entries(migrado)) {
      if (id in vivos && vivos[id] === v) continue;
      const previo = c[id];
      const tPrevio = esObjeto(previo) && typeof previo.t === 'number' ? previo.t : 0;
      // (a new item or a new value: dated with its own time, never older than the entry it replaces — a tombstone
      // older than the absorbed day is outdated, as 0.12's absorption outdated it)
      r[id] = { t: Math.max(tiempo(v), tPrevio + (id in vivos ? 0 : 1)), v };
    }
    return r;
  };
}

/** The registry: every migration, in order (by key, then `de`). */
export const MIGRACIONES: readonly Migracion[] = [
  {
    clave: 'ejercicios',
    de: 1,
    formato: 2,
    descripcion: 'cada respuesta de un ejercicio guarda la hora en que se escribió',
    local: migrarEjercicios,
    coleccion: enColeccion(migrarEjercicios, (v) => (esObjeto(v) && typeof v.t === 'number' ? v.t : 0)),
  },
  {
    clave: 'progreso-diario',
    de: 1,
    formato: 2,
    descripcion: 'la actividad diaria guardada por versiones anteriores a la 0.12 pasa al registro «heredado» de cada día',
    local: migrarDias,
    coleccion: enColeccion(migrarDias, (v) => (diaBueno(v) ? v.t : 0)),
  },
];

/** The migrations that take `clave` from version `desde` to the current one, in order. */
export function migracionesDe(clave: string, desde: number): Migracion[] {
  const hasta = ESQUEMAS[clave] ?? desde;
  return MIGRACIONES.filter((m) => m.clave === clave && m.de >= desde && m.de < hasta).sort((a, b) => a.de - b.de);
}

/** A stored value of `clave` taken from version `desde` to the current one (throws what a migration throws). */
export function migrarValor(clave: string, desde: number, valor: unknown): unknown {
  let v = valor;
  for (const m of migracionesDe(clave, desde)) v = m.local(v);
  return v;
}

/**
 * The stores of a synchronisation file or a backup of data format `formato` (< FORMATO_DATOS) in the current format:
 * every collection migration introduced after it, in order. A migration that throws leaves its store as it was and is
 * reported in `fallidas` (the caller decides: the synchronisation refuses the file, a backup import leaves the store
 * out).
 */
export function migrarColecciones(
  almacenes: Record<string, Record<string, unknown>>,
  formato: number,
): { almacenes: Record<string, Record<string, unknown>>; fallidas: string[] } {
  const r: Record<string, Record<string, unknown>> = { ...almacenes };
  const fallidas: string[] = [];
  for (const m of MIGRACIONES) {
    if (m.formato <= formato || !m.coleccion || !esObjeto(r[m.clave])) continue;
    try {
      r[m.clave] = m.coleccion(r[m.clave]!);
    } catch {
      fallidas.push(m.clave);
      r[m.clave] = almacenes[m.clave]!;
    }
  }
  return { almacenes: r, fallidas };
}
