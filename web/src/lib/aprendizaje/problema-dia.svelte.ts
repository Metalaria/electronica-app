// Problem of the day (0.11, group B): one problem per day, the same all day long, chosen by seleccion.ts
// problemaDelDia() from the reader's course and level (a «Calcula» item with the values of the day, or a
// self-checked exercise not solved yet). Once a day has its problem it is stored, so it does not change during
// the day when the reader progresses, and the other devices get it with the synchronisation.
//
// Stored (lib/almacen.ts: Tauri plugin-store `lector.json`, or localStorage `epa:problema-dia`):
//   problema-dia { version: 1,
//                  dias: { "2026-10-30": { id, k: "practica" | "ejercicio", parte, semilla, curso, t,
//                                          r?: { bien, intentos, t } } } }       r: the first final answer
// `dias` is synchronised item by item (store `problema-dia`; a day's time is that of its answer, else of its
// choice). Of two versions of a day every device keeps the same one (seleccion.ts preferirDia: answered over
// unanswered, right over wrong, the first answer, the first choice): the engine chooses it in the file itself
// (registro.svelte.ts `unir`), so a day solved on one device is never lost to the same day shown on another.
// Another browser tab's writes are merged the same way, before every write (lib/pestanas.ts).
// The day changes at 04:00: `reloj.hoy` follows it (a timer at the boundary and the return to the app) and the
// pages derive from it. Solving it emits `problema-dia` (XP `pd:<day>` and the achievements in progreso.svelte.ts).

import { obtenerAlmacen, registrarVolcado, type Almacen } from '../almacen';
import { anotarCambio } from '../sincronizacion/marcas';
import { claveDia, diaMas } from '../../componentes/repaso/srs';
import { emitir } from './eventos';
import { preferirDia, problemaDelDia, rachaDias, type CandidatoProblema } from './seleccion';
import { cargarContexto, cursoActual, nivelEnCurso } from './contexto';
import { candidatosProblema } from './catalogo';
import { aprendizaje } from '../aprendizaje.svelte';
import { EnlacePestanas, fusionarPestanas, huellasDe, type BasePestanas } from '../pestanas';

export const VERSION_PROBLEMA = 1;
const CLAVE = 'problema-dia';
/** Problems of these last days are not repeated when the pool allows it. */
const SIN_REPETIR_DIAS = 30;

export interface ResultadoProblema {
  bien: boolean;
  intentos: number;
  t: number;
}

export interface DiaProblema {
  id: string;
  k: 'practica' | 'ejercicio';
  parte: string;
  semilla: number;
  curso: string;
  /** When it was chosen (ms). */
  t: number;
  r?: ResultadoProblema;
}

export const problemas = $state({
  listo: false,
  dias: {} as Record<string, DiaProblema>,
});

let almacen: Almacen | null = null;
let carga: Promise<void> | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;
/** What this tab last read from or wrote to the storage (lib/pestanas.ts). */
let base: BasePestanas = new Map();

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function diaProblemaValido(v: unknown): v is DiaProblema {
  if (!esObjeto(v)) return false;
  if (typeof v.id !== 'string' || !v.id || (v.k !== 'practica' && v.k !== 'ejercicio') || typeof v.parte !== 'string' || !numero(v.semilla) || typeof v.curso !== 'string' || !numero(v.t)) return false;
  if (v.r === undefined) return true;
  return esObjeto(v.r) && typeof v.r.bien === 'boolean' && numero(v.r.intentos) && numero(v.r.t);
}

/** A day's time for the synchronisation. */
export function tiempoProblema(v: unknown): number | undefined {
  return diaProblemaValido(v) ? Math.max(v.t, v.r?.t ?? 0) : undefined;
}

/**
 * Writes the days (merging first what another tab wrote meanwhile); the promise fails if the storage does.
 * `cambio` (the synchronisation's result) is applied atomically: to a copy that is written, and to memory only after
 * the write succeeded (third review, finding 2).
 */
function escribir(cambio?: (dias: Record<string, DiaProblema>) => void): Promise<void> {
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  if (!almacen) {
    cambio?.(problemas.dias);
    return Promise.resolve();
  }
  pestanas.antesDeEscribir();
  const dias = $state.snapshot(problemas.dias) as Record<string, DiaProblema>;
  cambio?.(dias);
  const p = almacen.escribir(CLAVE, { version: VERSION_PROBLEMA, dias });
  pestanas.despuesDeEscribir();
  return p.then(() => {
    base = huellasDe(dias);
    cambio?.(problemas.dias);
  });
}

const avisarEscritura = (e: unknown) => console.warn('No se pudo guardar el problema del día', e);

/** Another tab wrote the days: merged with ours (the same preference as the synchronisation). */
function deOtraPestana(v: unknown, escribirSiFalta: boolean): void {
  if (!esObjeto(v) || !esObjeto(v.dias)) return;
  const entrante: Record<string, DiaProblema> = {};
  for (const [k, d] of Object.entries(v.dias)) if (diaProblemaValido(d)) entrante[k] = d;
  const f = fusionarPestanas(base, $state.snapshot(problemas.dias) as Record<string, DiaProblema>, entrante, preferirDia);
  base = huellasDe(entrante);
  if (f.cambiado) problemas.dias = f.mapa;
  if (escribirSiFalta && f.reescribir) void escribir().catch(avisarEscritura);
}

const pestanas = new EnlacePestanas(CLAVE, deOtraPestana);

function guardar(espera = 200): void {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => void escribir().catch(avisarEscritura), espera);
}

export function cargarProblemas(): Promise<void> {
  carga ??= (async () => {
    almacen = await obtenerAlmacen();
    const v = await almacen.leer<Record<string, unknown>>(CLAVE);
    if (esObjeto(v) && esObjeto(v.dias)) {
      base = huellasDe(v.dias);
      for (const [k, d] of Object.entries(v.dias)) if (diaProblemaValido(d)) problemas.dias[k] ??= d;
    }
    pestanas.activar(almacen.tipo);
    problemas.listo = true;
    if (typeof window !== 'undefined') {
      const volcar = () => {
        if (temporizador) void escribir().catch(avisarEscritura);
      };
      window.addEventListener('pagehide', volcar);
      // 0.12: the save before installing an update awaits this write (almacen.ts guardarTodoAntesDeSalir)
      registrarVolcado(() => (temporizador ? escribir() : Promise.resolve()));
      window.addEventListener('epa:antes-de-sincronizar', volcar);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') volcar();
      });
    }
  })();
  return carga;
}

export const hoy = (): string => claveDia(Date.now());
export const ayer = (): string => claveDia(diaMas(Date.now(), -1));

/** Today's review day, kept up to date by `seguirDia()` (pages and cards derive from it). */
export const reloj = $state({ hoy: typeof window === 'undefined' ? '' : hoy() });
let siguiendo = false;
let tReloj: ReturnType<typeof setTimeout> | null = null;

/** The day before a day key. */
export function diaAnterior(dia: string): string {
  return claveDia(diaMas(Date.parse(`${dia}T12:00:00`), -1));
}

/**
 * Keeps `reloj.hoy` on the current day: a timer at the next 04:00 (at most an hour long, timers drift while a device
 * sleeps) and a check whenever the app becomes visible again. Idempotent.
 */
export function seguirDia(): void {
  if (siguiendo || typeof window === 'undefined') return;
  siguiendo = true;
  const actualizar = () => {
    const d = hoy();
    if (d !== reloj.hoy) reloj.hoy = d;
    if (tReloj) clearTimeout(tReloj);
    const ahora = Date.now();
    tReloj = setTimeout(actualizar, Math.max(1000, Math.min(diaMas(ahora, 1) - ahora + 500, 3_600_000)));
  };
  actualizar();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') actualizar();
  });
  window.addEventListener('focus', actualizar);
}

/** The candidates of the reader's course up to its level, or of the first chapters for a new reader. */
async function candidatosDe(partes: string[]): Promise<CandidatoProblema[]> {
  return candidatosProblema(partes, (label) => !!aprendizaje.ejercicios[label]?.resuelto);
}

/** The problem a day would get with the reader's course and level now (not stored). */
async function elegir(dia: string): Promise<DiaProblema | null> {
  await cargarContexto();
  const curso = cursoActual();
  const nivel = nivelEnCurso(curso);
  const recientes: string[] = [];
  const base = Date.parse(`${dia}T12:00:00`) || Date.now();
  for (let k = 1; k <= SIN_REPETIR_DIAS; k++) {
    const d = problemas.dias[claveDia(diaMas(base, -k))];
    if (d) recientes.push(d.id);
  }
  // the course's «Calcula» items and exercises (problemaDelDia takes those up to the level first, then the rest of
  // the course); only when the course has nothing left, an exercise of anywhere in the book
  let elegido = problemaDelDia(dia, curso, nivel, await candidatosDe(curso.partes), recientes);
  if (!elegido) elegido = problemaDelDia(dia, curso, nivel, await candidatosProblema([], (label) => !!aprendizaje.ejercicios[label]?.resuelto, 'todos'), recientes);
  return elegido ? { ...elegido, curso: curso.id, t: Date.now() } : null;
}

const eligiendo = new Map<string, Promise<DiaProblema | null>>();

/**
 * Today's problem: the stored one, or chosen now and stored (so it stays the same all day). Works offline: the
 * choice reads only the app's own data files and the stored progress. Null when nothing can be chosen.
 */
export function problemaDeHoy(dia = hoy()): Promise<DiaProblema | null> {
  let p = eligiendo.get(dia);
  if (!p) {
    p = (async () => {
      await cargarProblemas();
      if (problemas.dias[dia]) return problemas.dias[dia]!;
      const d = await elegir(dia);
      if (!d) return null;
      // another device may have chosen it meanwhile (a synchronisation during the choice)
      if (problemas.dias[dia]) return problemas.dias[dia]!;
      problemas.dias[dia] = d;
      anotarCambio(CLAVE, dia, d.t);
      guardar();
      return d;
    })().finally(() => eligiendo.delete(dia));
    eligiendo.set(dia, p);
  }
  return p;
}

/** A past day's problem: the stored one, or the one it would have been (deterministic; not stored). */
export async function problemaDe(dia: string): Promise<DiaProblema | null> {
  await cargarProblemas();
  return problemas.dias[dia] ?? (await elegir(dia));
}

/** Days with the problem solved. */
export function diasResueltos(): string[] {
  return Object.entries(problemas.dias)
    .filter(([, d]) => d.r?.bien)
    .map(([k]) => k);
}

/** Consecutive days with the problem solved, up to today (or yesterday while today's is pending). */
export function rachaProblemas(dia = hoy()): number {
  return rachaDias(diasResueltos(), dia);
}

/**
 * The first final answer of a day's problem: stored once and reported as a learning event. `mostrado` is the problem
 * that was answered (the page's): when the stored day has another one, still unanswered (a synchronisation or another
 * tab replaced it meanwhile, or the page was opened before 04:00 and answered after), the answered problem becomes
 * the day's. Returns whether it was recorded.
 */
export function registrarResultado(dia: string, bien: boolean, intentos: number, mostrado?: DiaProblema): boolean {
  let d = problemas.dias[dia];
  const t = Date.now();
  if (mostrado && !d?.r && d?.id !== mostrado.id) {
    problemas.dias[dia] = { id: mostrado.id, k: mostrado.k, parte: mostrado.parte, semilla: mostrado.semilla, curso: mostrado.curso, t: d ? Math.min(d.t, t) : t };
    d = problemas.dias[dia];
  }
  if (!d || d.r) return false;
  d.r = { bien, intentos, t };
  anotarCambio(CLAVE, dia, t);
  guardar(50);
  emitir({ tipo: 'problema-dia', dia, id: d.id, correcta: bien, intentos, racha: bien ? rachaProblemas(dia) : 0, t });
  return true;
}

// ------------------------------------------------------------------ synchronisation (registro.svelte.ts)

export async function leerProblemas(): Promise<Record<string, unknown>> {
  await cargarProblemas();
  return { ...$state.snapshot(problemas.dias) };
}

export async function aplicarProblemas(poner: Record<string, unknown>, quitar: string[]): Promise<void> {
  await cargarProblemas();
  // atomic: written first, then put in memory
  await escribir((dias) => {
    for (const [k, d] of Object.entries(poner)) {
      if (!diaProblemaValido(d)) continue;
      const local = dias[k];
      // the version every device keeps (an answered day is never replaced by an unanswered one, a right answer by a
      // wrong one…): the engine already chose it in the file (registro `unir`); ours stays if it changed meanwhile
      if (local && preferirDia($state.snapshot(local) as DiaProblema, d) !== d) continue;
      dias[k] = structuredClone(d);
    }
    for (const k of quitar) delete dias[k];
  });
}
