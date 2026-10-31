// Daily progress (0.9): what the reader did each day and the streak of days on which the daily goal was met.
//   registrarActividad('paso' | 'pregunta' | 'seccion', n = 1)   a lesson step completed, a review or lesson
//                                                                question answered, a section marked read
//   progresoDiario                                               reactive summary for the start page
// Days follow the review's day (lib: repaso/srs.ts, starting at 04:00 local time), so studying past midnight
// still counts for the evening's day. Stored with the same layer as the other learning data
// (lib/almacen.ts: Tauri plugin-store `lector.json`, or localStorage `epa:*`):
//   progreso-diario     { "2026-10-27": { pasos, preguntas, secciones, cumplido, t } }   one item per day
//   progreso-objetivo   { tipo: 'pasos' | 'preguntas', cantidad: 1–10, secciones: boolean, t }
// With `secciones` (on by default, «Aa»), each section marked as read counts as one lesson step towards a
// «pasos» goal: reading the book the usual way also keeps the streak.
// Both are synchronised (lib/sincronizacion/registro.svelte.ts): one last-write-wins item per day, and the goal.
// `cumplido` freezes the verdict of past days, so changing the goal never rewrites the streak's history;
// today's verdict always follows the current goal.

import { Guardado } from './sincronizacion/guardado';
import { claveDia, diaMas } from '../componentes/repaso/srs';
import { emitir } from './aprendizaje/eventos';

export type TipoActividad = 'paso' | 'pregunta' | 'seccion';
export type TipoObjetivo = 'pasos' | 'preguntas';

export interface DiaProgreso {
  pasos: number;
  preguntas: number;
  secciones: number;
  /** The goal was met that day (frozen once the day is over). */
  cumplido: boolean;
  /** Last change (ms), for the synchronisation. */
  t: number;
}

export interface ObjetivoDiario {
  tipo: TipoObjetivo;
  cantidad: number;
  /** Sections marked as read count as lesson steps (only for a «pasos» goal). */
  secciones: boolean;
}

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

function cuenta(d: DiaProgreso | undefined, o: ObjetivoDiario): number {
  if (!d) return 0;
  return o.tipo === 'preguntas' ? d.preguntas : d.pasos + (o.secciones ? d.secciones : 0);
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
    if (progresoDiario.listo) recalcular();
  },
  tiempo: (v) => v.t,
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
    recalcular();
    if (typeof window !== 'undefined') {
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

// ------------------------------------------------------------------ summary

/** Recomputes the reactive summary (after a change, a synchronisation or a new day). */
function recalcular(ahora = Date.now()): void {
  const o = progresoDiario.objetivo;
  const hoyClave = claveDia(ahora);
  const hoy = dias[hoyClave];
  const cumplidoHoy = cuenta(hoy, o) >= o.cantidad;
  const cumplido = (clave: string): boolean => (clave === hoyClave ? cumplidoHoy : !!dias[clave]?.cumplido);

  let racha = 0;
  for (let k = cumplidoHoy ? 0 : 1; k < 5000; k++) {
    if (!cumplido(claveDia(diaMas(ahora, -k)))) break;
    racha++;
  }
  const ultimos: { fecha: string; cumplido: boolean }[] = [];
  for (let k = 6; k >= 0; k--) {
    const fecha = claveDia(diaMas(ahora, -k));
    ultimos.push({ fecha, cumplido: cumplido(fecha) });
  }

  progresoDiario.hoy = { pasos: hoy?.pasos ?? 0, preguntas: hoy?.preguntas ?? 0, secciones: hoy?.secciones ?? 0 };
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

function sumar(tipo: TipoActividad, n: number, t: number): void {
  const clave = claveDia(t);
  const d = (dias[clave] ??= { pasos: 0, preguntas: 0, secciones: 0, cumplido: false, t });
  const campo = tipo === 'paso' ? 'pasos' : tipo === 'pregunta' ? 'preguntas' : 'secciones';
  d[campo] = Math.max(0, d[campo] + n);
  d.cumplido = cuenta(d, progresoDiario.objetivo) >= progresoDiario.objetivo.cantidad;
  d.t = Math.max(t, d.t + 1);
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
  // today's stored verdict follows the new goal
  const hoy = dias[claveDia(objetivoT)];
  if (hoy) {
    hoy.cumplido = cuenta(hoy, progresoDiario.objetivo) >= progresoDiario.objetivo.cantidad;
    hoy.t = Math.max(objetivoT, hoy.t + 1);
    guardar(CLAVE_DIAS, 200);
  }
  guardar(CLAVE_OBJETIVO, 100);
  recalcular();
}

// ------------------------------------------------------------------ synchronisation (registro.svelte.ts)

/** The days kept on this device: day → item (a copy). */
export async function leerDias(): Promise<Record<string, DiaProgreso>> {
  await cargarProgresoDiario();
  return structuredClone(dias);
}

// The synchronised stores (registro.svelte.ts) are `sincronizableGuardado(guardadoDias)` and
// `sincronizableGuardado(guardadoObjetivo)`: they read the memory merged with the storage and apply atomically.

if (typeof window !== 'undefined') void cargarProgresoDiario().catch(() => undefined);
