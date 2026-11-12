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

/**
 * The format of the data in the synchronisation file and the backups: 1 up to 0.12, 2 since 1.0, 3 since 1.2 (the
 * book's two new 4.0 chapters take their definitive ids: an older app must not write the old ids back into the file).
 */
export const FORMATO_DATOS = 3;
/** The first app version that reads FORMATO_DATOS (devices of the file below it are told to update). */
export const VERSION_MINIMA_DATOS = '1.2.0';

/**
 * Schema version of every key the app stores (lib/almacen.ts; `epa:<key>` in a browser, keys of `lector.json` in Tauri).
 * 1 = the shape 0.12.0 stores (and reads, with its lazy migrations, from 0.9–0.11).
 */
// 1.2: every key that can hold a part id, a label, a question or practice id or a netlist id of the two chapters new
// in edition 4.0 is one version up (ids of book 4.1, `renombrarIds41` below).
export const ESQUEMAS: Readonly<Record<string, number>> = {
  prefs: 1,
  posiciones: 2,
  marcadores: 2,
  notas: 2,
  ejercicios: 3,
  leidas: 2,
  deducciones: 2,
  'calc-favoritos': 2,
  'repaso-tarjetas': 2,
  'repaso-diario': 1,
  'repaso-ajustes': 1,
  'repaso-tests': 2,
  'repaso-fallos': 2,
  'repaso-examenes': 2,
  lecciones: 2,
  'progreso-diario': 3,
  'progreso-objetivo': 1,
  'progreso-xp': 2,
  cursos: 2,
  dominio: 2,
  'problema-dia': 2,
  // 1.0: «¿Qué seguridad tiene?» (lib/aprendizaje/seguridad.svelte.ts), synchronised as store `seguridad`
  seguridad: 2,
  // 1.1: the guided labs of printed chapter 21 (lib/laboratorio.svelte.ts), synchronised as store `laboratorio`; a new
  // key, so no migration (1.0 has nothing under it and leaves it alone)
  laboratorio: 1,
  // 1.1: the projects by stages of printed chapters 48–51 (lib/proyectos11/estado.svelte.ts), synchronised as store
  // `proyectos`; a new key, so no migration
  proyectos: 1,
  'editor-circuitos': 2,
  'protoboard-circuitos': 2,
  'protoboard-recorrido': 1,
  'protoboard-leccion': 2,
  'medir-pista': 1,
  'componentes-vista': 1,
  'recordatorio-icono': 1,
  'dispositivo-local': 1,
  'sinc-ajustes': 1,
  'sinc-estado': 2,
  'sinc-marcas': 2,
  'sinc-version': 1,
  'sinc-aplicados': 2,
  'sinc-enviado': 2,
  'copia-automatica': 1,
  'copia-migracion': 1,
  // 1.0: teacher mode (lib/docente/estado.svelte.ts): own courses and exams, their results
  docente: 2,
  'docente-resultados': 2,
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

// ------------------------------------------------------------------ 1.2: the ids of book 4.1
//
// Edition 4.0 brought two chapters with provisional ids (`cap-new-automatas`, `cap-new-maquinas`, printed 31 and 34);
// 4.1 gives them the repository's convention, `cap55` and `cap56` (the book's Informes/ids_4.1.json, «partes»,
// «etiquetas», «autoevaluacion»). The app's ids follow: the part (`cap55`, also in netlist ids `cap55/…`, lesson
// keys `cap55/sec-55.1`, practice ids `cap55-…`, XP ids `l:cap55/…`), the labels (`sec-new-automatas.3` → `sec-55.3`,
// likewise `fig-`, `ej-`, `prob-`, `tab-`), the chapter's own label (`cap-new-automatas` → `cap-55`, only where a label
// is stored: bookmarks, notes, the section of a reading position) and the review questions (`cap-new-automatas-1` →
// `cap55-01`, the book's self-assessment keys). Sections new inside older chapters (`sec-new-24-trifasica`…) keep
// their ids, as in the book. Pure and idempotent: a value with no old id is returned as it is (the same object).

const CAP41: Readonly<Record<string, string>> = { automatas: '55', maquinas: '56' };
// (a label may follow a hyphen inside a composite id: `cap-new-automatas-pred-sec-new-automatas.3`)
const OBJETO41 = /(^|\W)(sec|fig|ej|prob|tab)-new-(automatas|maquinas)\.([0-9A-Za-z]+)/g;
const PREGUNTA41 = /(^|[^\w-])cap-new-(automatas|maquinas)-(\d+)(?![\w.])/g;
const PARTE41 = /(^|[^\w-])cap-new-(automatas|maquinas)(?!\w)/g;
const tieneId41 = (s: string) => s.includes('new-automatas') || s.includes('new-maquinas');

/** One id (or a composite id: `l:cap-new-maquinas/sec-new-maquinas.2`) in the 4.1 ids; anything else unchanged. */
export function renombrar41(s: string): string {
  if (!tieneId41(s)) return s;
  return s
    .replace(OBJETO41, (_, a: string, t: string, c: string, n: string) => `${a}${t}-${CAP41[c]}.${n}`)
    .replace(PREGUNTA41, (_, a: string, c: string, n: string) => `${a}cap${CAP41[c]}-${n.padStart(2, '0')}`)
    .replace(PARTE41, (_, a: string, c: string) => `${a}cap${CAP41[c]}`);
}

/** The chapter's own label where a LABEL is stored (a bookmark of the chapter title): `cap-new-automatas` → `cap-55`. */
function etiqueta41(s: string): string {
  const m = /^cap-new-(automatas|maquinas)$/.exec(s);
  return m ? `cap-${CAP41[m[1]!]}` : renombrar41(s);
}

const tiempoDe = (v: unknown): number => (esObjeto(v) && typeof v.t === 'number' && Number.isFinite(v.t) ? v.t : -Infinity);

/**
 * Every object key and every id-like string (no white space: never the reader's own texts) of `valor`, at any depth,
 * in the 4.1 ids. Two keys that end up the same (an old and a new id of one item: never on a device, which had only
 * the old ones, but possible in a hand-merged file): the one already under the new id stays unless the renamed one is
 * strictly newer (`t`), whatever the order of the keys.
 */
export function renombrarIds41(valor: unknown, etiquetas: readonly string[] = [], clavesEtiqueta = false): unknown {
  if (typeof valor === 'string') return tieneId41(valor) && !/\s/.test(valor) ? renombrar41(valor) : valor;
  if (Array.isArray(valor)) {
    let r: unknown[] | null = null;
    valor.forEach((x, i) => {
      const y = renombrarIds41(x, etiquetas);
      if (y !== x) (r ??= valor.slice())[i] = y;
    });
    return r ?? valor;
  }
  if (!esObjeto(valor)) return valor;
  let cambiado = false;
  const fijos: [string, unknown][] = [];
  const movidos: [string, unknown][] = [];
  for (const [k, v] of Object.entries(valor)) {
    // (`clavesEtiqueta`: the keys of this level are labels; fields named in `etiquetas` hold a label — for both, the
    // chapter's own label maps to `cap-55`, not to the part)
    const k2 = clavesEtiqueta ? etiqueta41(k) : renombrar41(k);
    const v2 = etiquetas.includes(k) && typeof v === 'string' && !/\s/.test(v) ? etiqueta41(v) : renombrarIds41(v, etiquetas);
    if (v2 !== v) cambiado = true;
    if (k2 === k) fijos.push([k, v2]);
    else {
      movidos.push([k2, v2]);
      cambiado = true;
    }
  }
  if (!cambiado) return valor;
  const r: Record<string, unknown> = {};
  for (const [k, v] of fijos) r[k] = v;
  for (const [k, v] of movidos) if (!(k in r) || tiempoDe(v) > tiempoDe(r[k])) r[k] = v;
  return r;
}

/** Bookmarks and notes ({label: {parte, label, …}}, and their collections): keys and `label` are labels, `parte` a part. */
const marcadores41 = (v: unknown) => renombrarIds41(v, ['label'], true);
/** Reading positions ({parte: {b, sec, …}}): `sec` is a label. */
const posiciones41 = (v: unknown) => renombrarIds41(v, ['sec']);

/**
 * The synchronisation's own marks ({cambios, borrados, huellas: {store: {id: …}}}): ids renamed; the hash a change
 * mark was made for (`huellas`) is dropped for a renamed item — its value may have changed with the ids, and a mark
 * whose hash does not match is not taken for this copy's change (fusion.ts fecharLocal): a change made just before
 * updating and not yet synchronised must still count as one.
 */
function marcas41(v: unknown): unknown {
  const r = renombrarIds41(v);
  if (r === v || !esObjeto(r) || !esObjeto(r.huellas) || !esObjeto(v) || !esObjeto(v.huellas)) return r;
  const huellas: Record<string, unknown> = {};
  for (const [almacen, ids] of Object.entries(v.huellas)) {
    const a2 = renombrar41(almacen);
    if (!esObjeto(ids)) {
      huellas[a2] = ids;
      continue;
    }
    huellas[a2] = Object.fromEntries(Object.entries(ids).filter(([id]) => renombrar41(id) === id));
  }
  return { ...r, huellas };
}

/** A synchronisation collection ({id: {t, v} | {t, x: 1}}): ids and values renamed, each entry with its own time. */
const coleccion41 = (f: (v: unknown) => unknown) => (c: Record<string, unknown>) => {
  const r = f(c);
  return esObjeto(r) ? r : c;
};

const IDS41 = 'los capítulos nuevos de la edición 4.0 toman sus identificadores definitivos de la 4.1 (cap55, cap56)';

/** One step per key (version as before 1.2 → +1); the stores of the synchronisation file get the same renaming. */
function pasos41(): Migracion[] {
  const local: [string, number, (v: unknown) => unknown][] = [
    ['posiciones', 1, posiciones41],
    ['marcadores', 1, marcadores41],
    ['notas', 1, marcadores41],
    ['ejercicios', 2, renombrarIds41],
    ['leidas', 1, renombrarIds41],
    ['deducciones', 1, renombrarIds41],
    ['calc-favoritos', 1, renombrarIds41],
    ['repaso-tarjetas', 1, renombrarIds41],
    ['repaso-tests', 1, renombrarIds41],
    ['repaso-fallos', 1, renombrarIds41],
    ['repaso-examenes', 1, renombrarIds41],
    ['lecciones', 1, renombrarIds41],
    ['progreso-diario', 2, renombrarIds41],
    ['progreso-xp', 1, renombrarIds41],
    ['cursos', 1, renombrarIds41],
    ['dominio', 1, renombrarIds41],
    ['problema-dia', 1, renombrarIds41],
    ['seguridad', 1, renombrarIds41],
    ['editor-circuitos', 1, renombrarIds41],
    ['protoboard-circuitos', 1, renombrarIds41],
    ['protoboard-leccion', 1, renombrarIds41],
    ['docente', 1, renombrarIds41],
    ['docente-resultados', 1, renombrarIds41],
    ['sinc-estado', 1, renombrarIds41],
    ['sinc-marcas', 1, marcas41],
    ['sinc-aplicados', 1, renombrarIds41],
    ['sinc-enviado', 1, renombrarIds41],
  ];
  const pasos: Migracion[] = local.map(([clave, de, f]) => ({
    clave,
    de,
    formato: 3,
    descripcion: IDS41,
    local: f,
    coleccion: coleccion41(f),
  }));
  // synchronised stores whose name is not a storage key (their storage key's own step migrates the device's data):
  // only their collection in a file of format 2 (no version of their own: migrarAlmacen never sees them)
  for (const clave of ['progreso-logros', 'cursos-superadas', 'cursos-pruebas', 'docente-propios'])
    pasos.push({ clave, de: 1, formato: 3, descripcion: IDS41, local: renombrarIds41, coleccion: coleccion41(renombrarIds41) });
  return pasos;
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
  // 1.2 (format 3): after the steps above, so a file of format 1 gets them first
  ...pasos41(),
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
