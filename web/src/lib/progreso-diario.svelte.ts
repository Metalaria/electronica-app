// Daily progress (0.9): what the reader did each day and the streak of days on which the daily goal was met.
//   registrarActividad('paso' | 'pregunta' | 'seccion', n = 1)   a lesson step completed, a review or lesson
//                                                                question answered, a section marked read
//   progresoDiario                                               reactive summary for the start page
// Days follow the review's day (lib: repaso/srs.ts, starting at 04:00 local time), so studying past midnight
// still counts for the evening's day. Stored with the same layer as the other learning data
// (lib/almacen.ts: Tauri plugin-store `lector.json`, or localStorage `epa:*`):
//   progreso-diario     { "2026-10-27": { pasos, preguntas, secciones, cumplido, t },          the day (mirror)
//                         "2026-10-27@<device id>": { pasos, preguntas, secciones, cumplido: false, t } }   0.12
//   progreso-objetivo   { tipo: 'pasos' | 'preguntas', cantidad: 1–10, secciones: boolean, t }
// With `secciones` (on by default, «Aa»), each section marked as read counts as one lesson step towards a
// «pasos» goal: reading the book the usual way also keeps the streak.
// Both are synchronised (lib/sincronizacion/registro.svelte.ts): the days and the goal.
// 0.12: a day's activity is the SUM of what each device did that day — every device keeps its own record per day
// («<day>@<device id>», in a browser «<day>@<device id>-<tab id>»: lib/progreso-dias.ts, sincronizacion/dispositivo.ts)
// and writes the day item «<day>» as the day's summary (its `cumplido` is the frozen verdict of a past day). 1.0: the
// activity older versions left in the day item alone is moved into «<day>@0» by the schema migration (lib/esquemas.ts)
// before this module reads the store; the total is the records' sum (lib/progreso-dias.ts).
// `cumplido` freezes the verdict of past days, so changing the goal never rewrites the streak's history;
// today's verdict always follows the current goal.

import { Guardado } from './sincronizacion/guardado';
import { idRegistro, usarIdDispositivo } from './sincronizacion/dispositivo';
import { claveDia, diaMas } from '../componentes/repaso/srs';
import { emitir } from './aprendizaje/eventos';
import {
  agrupar,
  campoDe,
  compactar,
  cuenta,
  cumplidoDia,
  diasResumidos,
  esAporte,
  grupoDe,
  rehacerDias,
  tocarDia,
  totalDia,
  unirAportesPestanas,
  type DiaProgreso,
  type ObjetivoDiario,
  type TipoActividad,
  type TipoObjetivo,
} from './progreso-dias';

export type { DiaProgreso, ObjetivoDiario, TipoActividad, TipoObjetivo };

export const OBJETIVO_MIN = 1;
export const OBJETIVO_MAX = 10;
export const OBJETIVO_DEFECTO: ObjetivoDiario = { tipo: 'pasos', cantidad: 3, secciones: true };

const CLAVE_DIAS = 'progreso-diario';
const CLAVE_OBJETIVO = 'progreso-objetivo';

/** Reactive summary; `ultimosDias` are the last 7 days, oldest first, today last. */
export const progresoDiario = $state({
  listo: false,
  racha: 0,
  hoy: { pasos: 0, preguntas: 0, secciones: 0 },
  objetivo: { ...OBJETIVO_DEFECTO } as ObjetivoDiario,
  cumplidoHoy: false,
  /** What counts towards today's goal (steps, plus the sections read when that option is on; or questions). */
  hechosHoy: 0,
  ultimosDias: [] as { fecha: string; cumplido: boolean }[],
});

// The stored data (plain objects: the summary above is what components read).
let dias: Record<string, DiaProgreso> = {};
let objetivoT = 0;
let carga: Promise<void> | null = null;
let pendientesAntes: { tipo: TipoActividad; n: number; t: number }[] = [];
let cambioDia: ReturnType<typeof setTimeout> | null = null;
/** This device's (in a browser: this tab's) id: the key of its own record of each day (set by the load). */
let yo = '';

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const entero = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);

function limpiarObjetivo(o: unknown): ObjetivoDiario {
  if (!esObjeto(o)) return { ...OBJETIVO_DEFECTO };
  const tipo: TipoObjetivo = o.tipo === 'preguntas' ? 'preguntas' : 'pasos';
  const c = Math.round(Number(o.cantidad));
  const cantidad = Number.isFinite(c) ? Math.min(OBJETIVO_MAX, Math.max(OBJETIVO_MIN, c)) : OBJETIVO_DEFECTO.cantidad;
  // a goal stored before the option existed counts the sections (the default)
  const secciones = o.secciones !== false;
  return { tipo, cantidad, secciones };
}

export function diaValido(v: unknown): v is DiaProgreso {
  return esObjeto(v) && typeof v.t === 'number' && ['pasos', 'preguntas', 'secciones'].every((k) => v[k] === undefined || typeof v[k] === 'number');
}

function limpiarDia(v: Record<string, unknown>): DiaProgreso {
  return { pasos: entero(v.pasos), preguntas: entero(v.preguntas), secciones: entero(v.secciones), cumplido: v.cumplido === true, t: entero(v.t) };
}

// ------------------------------------------------------------------ storage

const diasDe = (d: unknown): Record<string, DiaProgreso> => {
  const r: Record<string, DiaProgreso> = {};
  if (esObjeto(d)) for (const [k, v] of Object.entries(d)) if (diaValido(v)) r[k] = limpiarDia(v as unknown as Record<string, unknown>);
  return r;
};
/** The goal as stored and synchronised (one item «objetivo»): the goal and the time it was set (0: never). */
type ObjetivoGuardado = ObjetivoDiario & { t: number };
/** The goal of a fresh install, as the synchronisation sees it (registro.svelte.ts `porDefecto`). */
export const OBJETIVO_GUARDADO_DEFECTO: ObjetivoGuardado = { ...OBJETIVO_DEFECTO, t: 0 };

// Both keys are written with read-merge-write (sincronizacion/guardado.ts): what the synchronisation or another tab
// stored meanwhile is never overwritten with this tab's older copy; the synchronisation's results are applied
// atomically (written first, then put in memory).
export const guardadoDias = new Guardado<DiaProgreso>({
  claveAlmacen: CLAVE_DIAS,
  claveSinc: CLAVE_DIAS,
  deAlmacen: diasDe,
  aAlmacen: (m) => m,
  leerMemoria: () => structuredClone(dias),
  cambiarMemoria: (poner, quitar) => {
    Object.assign(dias, diasDe(poner));
    for (const k of quitar) delete dias[k];
    if (!progresoDiario.listo) return;
    // (the days' mirrors follow the merged records in `rehacerEspejos`, only in the tab that ran the synchronisation or
    // the import: every tab rewriting them at once on the storage event made concurrent writes of the key likely —
    // review 0.12, finding 3)
    // another device's (or tab's) activity may complete today's goal: the same event as a goal met here (its XP id
    // is the day's, so two devices never count it twice)
    const antes = progresoDiario.cumplidoHoy;
    const ahora = Date.now();
    recalcular(ahora);
    if (!antes && progresoDiario.cumplidoHoy) emitir({ tipo: 'objetivo-cumplido', dia: claveDia(ahora), racha: progresoDiario.racha, t: ahora });
  },
  tiempo: (v) => v.t,
  // two tabs changed an item of a day: this tab's record keeps both counts (three-way), the legacy record the larger,
  // the rest the newer (lib/progreso-dias.ts unirAportesPestanas; 1.0: one active tab at a time, lib/pestana-activa.ts —
  // kept as a defence)
  unir: (a, b, base, id) => (id && yo ? unirAportesPestanas(id, a, b, base, yo) : undefined),
  // the summary of each day whose records another tab's write changed follows the merged records, in the write itself
  // (review 0.12c, finding 3); the same value from both tabs (`rehacerDia` is deterministic), so nothing is written
  // back and forth
  derivar: (m, tocados) => {
    // (the days touched only, the map grouped once: review 0.12g, finding 1)
    return rehacerDias(m, new Set(tocados.map((id) => id.split('@')[0]!)), { ...progresoDiario.objetivo, t: objetivoT }, claveDia(Date.now()), finDe);
  },
});
export const guardadoObjetivo = new Guardado<ObjetivoGuardado>({
  claveAlmacen: CLAVE_OBJETIVO,
  claveSinc: CLAVE_OBJETIVO,
  deAlmacen: (o): Record<string, ObjetivoGuardado> => (esObjeto(o) ? { objetivo: { ...limpiarObjetivo(o), t: entero(o.t) } } : {}),
  aAlmacen: (m, anterior) => m.objetivo ?? anterior ?? null,
  leerMemoria: () => ({ objetivo: { ...limpiarObjetivo(progresoDiario.objetivo), t: objetivoT } }),
  cambiarMemoria: (poner) => {
    const o = poner.objetivo;
    if (!esObjeto(o)) return;
    progresoDiario.objetivo = limpiarObjetivo(o);
    objetivoT = entero(o.t);
    if (progresoDiario.listo) recalcular();
  },
  tiempo: (v) => v.t || undefined,
});

function guardar(clave: string, espera = 400): void {
  (clave === CLAVE_DIAS ? guardadoDias : guardadoObjetivo).guardar(espera);
}

function volcar(): void {
  for (const g of [guardadoDias, guardadoObjetivo]) void g.volcar().catch((e: unknown) => console.warn('No se pudo guardar el progreso diario', e));
}

/** Loads the stored days and goal once (idempotent); the module starts it by itself in a browser. */
export function cargarProgresoDiario(): Promise<void> {
  carga ??= (async () => {
    // each key adopted in its own load step (a write queued meanwhile runs after it — fifth review)
    yo = await idRegistro();
    await Promise.all([
      guardadoDias.cargar((d) => Object.assign(dias, d)),
      guardadoObjetivo.cargar((o) => {
        if (!o.objetivo) return;
        progresoDiario.objetivo = limpiarObjetivo(o.objetivo);
        objetivoT = o.objetivo.t;
      }),
    ]);
    // activity registered while loading
    const antes = pendientesAntes;
    pendientesAntes = [];
    for (const p of antes) sumar(p.tipo, p.n, p.t);
    if (antes.length) guardar(CLAVE_DIAS);
    progresoDiario.listo = true;
    compactarPasados();
    recalcular();
    if (typeof window !== 'undefined') {
      // the synchronisation (or an import) changed the days in THIS tab: their mirrors follow
      window.addEventListener('epa:sincronizado', (e) => {
        const claves = (e as CustomEvent<{ claves?: string[] }>).detail?.claves;
        if (!claves || claves.includes(CLAVE_DIAS)) rehacerEspejos();
      });
      window.addEventListener('pagehide', volcar);
      window.addEventListener('epa:antes-de-sincronizar', volcar);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') volcar();
        else recalcular();
      });
    }
  })().catch((e: unknown) => {
    // a load that failed (the storage could not be read) is tried again by the next call, not memoised for the
    // session (sixth review); nothing was taken as stored meanwhile (sincronizacion/guardado.ts)
    carga = null;
    throw e;
  });
  return carga;
}

/**
 * The summary of every day with records follows them (lib/progreso-dias.ts rehacerDia: the frozen verdict of the day),
 * written as a change of this module (marked by its write).
 */
function rehacerEspejos(): void {
  // (the map grouped once, each day remade on its own items: linear — review 0.12g, finding 1)
  if (rehacerDias(dias, null, { ...progresoDiario.objetivo, t: objetivoT }, claveDia(Date.now()), finDe).length) guardar(CLAVE_DIAS);
}

/** This device's records of the days before yesterday, one per day (lib/progreso-dias.ts compactar). */
function compactarPasados(): void {
  if (!yo) return;
  const { poner, quitar } = compactar(dias, yo.split('-')[0]!, claveDia(diaMas(Date.now(), -1)));
  // (1.0: and every day's summary follows its records at load — after a compaction its time is the compacted record's;
  // in data of 0.12, which compacted without remaking them, too —, in the same write: remade only after the next
  // synchronisation, they cost a commit of their own. Deterministic, one scan: lib/progreso-dias.ts rehacerDias)
  const rehechos = rehacerDias(dias, null, { ...progresoDiario.objetivo, t: objetivoT }, claveDia(Date.now()), finDe);
  if (poner.length || quitar.length || rehechos.length) guardar(CLAVE_DIAS);
}

// ------------------------------------------------------------------ summary

/** Recomputes the reactive summary (after a change, a synchronisation or a new day). */
function recalcular(ahora = Date.now()): void {
  const o = progresoDiario.objetivo;
  const conHora = { ...o, t: objetivoT };
  const grupos = agrupar(dias);
  const hoyClave = claveDia(ahora);
  const hoy = totalDia(grupos.get(hoyClave) ?? { aportes: new Map() });
  const cumplidoHoy = cuenta(hoy, o) >= o.cantidad;
  // (k days ago: its key and the start of the next day, for the verdict of a past day — lib/progreso-dias.ts)
  const cumplido = (k: number): boolean => {
    if (k === 0) return cumplidoHoy;
    const clave = claveDia(diaMas(ahora, -k));
    return cumplidoDia(grupos.get(clave), conHora, false, diaMas(ahora, -k + 1));
  };

  let racha = 0;
  for (let k = cumplidoHoy ? 0 : 1; k < 5000; k++) {
    if (!cumplido(k)) break;
    racha++;
  }
  const ultimos: { fecha: string; cumplido: boolean }[] = [];
  for (let k = 6; k >= 0; k--) ultimos.push({ fecha: claveDia(diaMas(ahora, -k)), cumplido: cumplido(k) });

  progresoDiario.hoy = hoy;
  progresoDiario.cumplidoHoy = cumplidoHoy;
  progresoDiario.hechosHoy = cuenta(hoy, o);
  progresoDiario.racha = racha;
  progresoDiario.ultimosDias = ultimos;
  programarCambioDia(ahora);
}

/** At the start of the next day the summary moves on by itself (an app left open overnight). */
function programarCambioDia(ahora: number): void {
  if (typeof window === 'undefined') return;
  if (cambioDia) clearTimeout(cambioDia);
  const espera = Math.min(diaMas(ahora, 1) - ahora + 1000, 2 ** 31 - 1);
  cambioDia = setTimeout(() => recalcular(), espera);
}

// ------------------------------------------------------------------ activity

/** This device's record of the day gets n more (lib/progreso-dias.ts tocarDia: also the day's summary). */
function sumar(tipo: TipoActividad, n: number, t: number): void {
  usarIdDispositivo();
  tocarDia(dias, claveDia(t), yo, t, progresoDiario.objetivo, campoDe(tipo), n);
}

/**
 * Something was learnt: a lesson step completed ('paso'), a review or lesson question answered ('pregunta'),
 * a section marked read ('seccion'). A negative n undoes (e.g. «Deshacer» in the flashcards).
 */
export function registrarActividad(tipo: TipoActividad, n = 1): void {
  if (!n || !Number.isFinite(n)) return;
  const t = Date.now();
  if (!progresoDiario.listo) {
    pendientesAntes.push({ tipo, n, t });
    void cargarProgresoDiario().catch(() => undefined);
    return;
  }
  const antes = progresoDiario.cumplidoHoy;
  sumar(tipo, n, t);
  guardar(CLAVE_DIAS);
  recalcular(t);
  // 0.11: the goal just met is a learning event (its XP and the streak achievements)
  if (!antes && progresoDiario.cumplidoHoy) emitir({ tipo: 'objetivo-cumplido', dia: claveDia(t), racha: progresoDiario.racha, t });
}

/** The daily goal («Aa»): lesson steps or review questions, 1–10 a day. */
export function ponerObjetivo(o: Partial<ObjetivoDiario>): void {
  progresoDiario.objetivo = limpiarObjetivo({ ...progresoDiario.objetivo, ...o });
  objetivoT = Date.now();
  // today's stored verdict follows the new goal (the mirror, dated with this device's record of the day)
  const hoy = claveDia(objetivoT);
  const g = grupoDe(dias, hoy);
  if (progresoDiario.listo && (g.espejo || g.aportes.size)) {
    usarIdDispositivo();
    tocarDia(dias, hoy, yo, objetivoT, progresoDiario.objetivo);
    guardar(CLAVE_DIAS, 200);
  }
  guardar(CLAVE_OBJETIVO, 100);
  recalcular();
}

// ------------------------------------------------------------------ synchronisation (registro.svelte.ts)

/** Start of the review day after «2026-10-27» (ms). */
function finDe(dia: string): number {
  const [a, m, d] = dia.split('-').map(Number);
  return diaMas(new Date(a ?? 1970, (m ?? 1) - 1, d ?? 1, 12).getTime(), 1);
}

/**
 * The days as they add up: day → { the activity of every device, the verdict (the streak), the newest time } (the XP
 * reconciliation and the statistics; never the per-device records themselves).
 */
export async function leerDias(): Promise<Record<string, DiaProgreso>> {
  await cargarProgresoDiario();
  return diasResumidos(dias, { ...progresoDiario.objetivo, t: objetivoT }, claveDia(Date.now()), finDe);
}

/** The stored items of the store (days and per-device records), a copy: for the tests. */
export function itemsDias(): Record<string, DiaProgreso> {
  return structuredClone(dias);
}

/** Whether an item id is a device's record of a day (not a day). */
export const esRegistroDeDispositivo = esAporte;

// The synchronised stores (registro.svelte.ts) are `sincronizableGuardado(guardadoDias)` and
// `sincronizableGuardado(guardadoObjetivo)`: they read the memory merged with the storage and apply atomically.

if (typeof window !== 'undefined') void cargarProgresoDiario().catch(() => undefined);

// Tests (tests/datos12-pestanas.spec.ts, two real browser tabs): a page that defines `window.__epaPruebasDiario` before
// the app loads gets this module's functions on it.
if (typeof window !== 'undefined' && (window as unknown as { __epaPruebasDiario?: object }).__epaPruebasDiario)
  Object.assign((window as unknown as { __epaPruebasDiario: object }).__epaPruebasDiario, {
    registrarActividad,
    leerDias,
    itemsDias,
    escribir: () => guardadoDias.escribir(),
    cargar: cargarProgresoDiario,
  });
