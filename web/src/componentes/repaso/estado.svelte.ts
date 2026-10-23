// Personal data of the «Repaso» page: flashcard states, daily log, settings and quiz results.
// Stored with the same layer as bookmarks and notes (lib/almacen.ts: Tauri plugin-store on Windows,
// macOS and Android, localStorage in a browser), under its own keys, with debounced writes that are
// flushed when the page is hidden or closed.

import { obtenerAlmacen, type Almacen } from '../../lib/almacen';
import { claveDia, responder, type Calificacion, type EstadoTarjeta } from './srs';

export interface AjustesRepaso {
  /** New cards introduced per day (shared by every deck). */
  nuevasDia: number;
  /** Also study reversed cards (definition → term). */
  inversas: boolean;
  /** Last deck chosen. */
  mazo: string;
}

export interface DiaRepaso {
  /** Answers given that day. */
  r: number;
  /** New cards seen for the first time. */
  n: number;
  /** Answers other than «Otra vez». */
  b: number;
}

export interface ResultadoTest {
  /** Best fraction of correct answers (0–1). */
  mejor: number;
  intentos: number;
  ultimo: { t: number; aciertos: number; total: number };
}

export interface Fallo {
  parte: string;
  /** Last time it was answered wrong. */
  t: number;
  veces: number;
}

export interface Examen {
  t: number;
  partes: string[];
  aciertos: number;
  total: number;
}

export const NUEVAS_DIA_DEFECTO = 15;
export const NUEVAS_DIA_MAX = 100;

export const repaso = $state({
  listo: false,
  tarjetas: {} as Record<string, EstadoTarjeta>,
  diario: {} as Record<string, DiaRepaso>,
  ajustes: { nuevasDia: NUEVAS_DIA_DEFECTO, inversas: false, mazo: 'todo' } as AjustesRepaso,
  tests: {} as Record<string, ResultadoTest>,
  fallos: {} as Record<string, Fallo>,
  examenes: [] as Examen[],
});

const CLAVES = {
  tarjetas: 'repaso-tarjetas',
  diario: 'repaso-diario',
  ajustes: 'repaso-ajustes',
  tests: 'repaso-tests',
  fallos: 'repaso-fallos',
  examenes: 'repaso-examenes',
} as const;
type Campo = keyof typeof CLAVES;

let almacen: Almacen | null = null;
let carga: Promise<void> | null = null;
const pendientes = new Map<Campo, ReturnType<typeof setTimeout>>();

function escribir(campo: Campo): void {
  void almacen?.escribir(CLAVES[campo], $state.snapshot(repaso[campo]));
}

function guardar(campo: Campo, espera = 250): void {
  const t = pendientes.get(campo);
  if (t) clearTimeout(t);
  pendientes.set(
    campo,
    setTimeout(() => {
      pendientes.delete(campo);
      escribir(campo);
    }, espera),
  );
}

/** Writes everything still pending. */
export function volcarRepaso(): void {
  for (const [campo, t] of pendientes) {
    clearTimeout(t);
    escribir(campo);
  }
  pendientes.clear();
}

/** Loads the stored data once (idempotent). */
export function cargarRepaso(): Promise<void> {
  carga ??= (async () => {
    almacen = await obtenerAlmacen();
    const [tarjetas, diario, ajustes, tests, fallos, examenes] = await Promise.all([
      almacen.leer<Record<string, EstadoTarjeta>>(CLAVES.tarjetas),
      almacen.leer<Record<string, DiaRepaso>>(CLAVES.diario),
      almacen.leer<Partial<AjustesRepaso>>(CLAVES.ajustes),
      almacen.leer<Record<string, ResultadoTest>>(CLAVES.tests),
      almacen.leer<Record<string, Fallo>>(CLAVES.fallos),
      almacen.leer<Examen[]>(CLAVES.examenes),
    ]);
    if (tarjetas && typeof tarjetas === 'object') repaso.tarjetas = tarjetas;
    if (diario && typeof diario === 'object') repaso.diario = diario;
    if (ajustes && typeof ajustes === 'object') repaso.ajustes = { ...repaso.ajustes, ...ajustes };
    repaso.ajustes.nuevasDia = Math.min(NUEVAS_DIA_MAX, Math.max(0, Math.round(Number(repaso.ajustes.nuevasDia) || 0)));
    if (tests && typeof tests === 'object') repaso.tests = tests;
    if (fallos && typeof fallos === 'object') repaso.fallos = fallos;
    if (Array.isArray(examenes)) repaso.examenes = examenes;
    repaso.listo = true;
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') volcarRepaso();
      });
      window.addEventListener('pagehide', volcarRepaso);
    }
  })();
  return carga;
}

// ------------------------------------------------------------------ flashcards

export interface Deshacer {
  id: string;
  previo: EstadoTarjeta | undefined;
  dia: string;
  diaPrevio: DiaRepaso | undefined;
}

/** Records an answer; returns what is needed to undo it. */
export function calificar(id: string, c: Calificacion, ahora = Date.now()): Deshacer {
  const previo = repaso.tarjetas[id] ? { ...repaso.tarjetas[id] } : undefined;
  const dia = claveDia(ahora);
  const diaPrevio = repaso.diario[dia] ? { ...repaso.diario[dia] } : undefined;
  repaso.tarjetas[id] = responder(previo, c, ahora, id);
  const d = repaso.diario[dia] ?? { r: 0, n: 0, b: 0 };
  d.r += 1;
  if (!previo) d.n += 1;
  if (c > 1) d.b += 1;
  repaso.diario[dia] = d;
  guardar('tarjetas');
  guardar('diario');
  return { id, previo, dia, diaPrevio };
}

export function deshacer(d: Deshacer): void {
  if (d.previo) repaso.tarjetas[d.id] = d.previo;
  else delete repaso.tarjetas[d.id];
  if (d.diaPrevio) repaso.diario[d.dia] = d.diaPrevio;
  else delete repaso.diario[d.dia];
  guardar('tarjetas');
  guardar('diario');
}

export function ponerAjustes(a: Partial<AjustesRepaso>): void {
  repaso.ajustes = { ...repaso.ajustes, ...a };
  repaso.ajustes.nuevasDia = Math.min(NUEVAS_DIA_MAX, Math.max(0, Math.round(repaso.ajustes.nuevasDia)));
  guardar('ajustes', 100);
}

/** Forgets every flashcard state and the log (the quiz results stay). */
export function reiniciarTarjetas(): void {
  repaso.tarjetas = {};
  repaso.diario = {};
  guardar('tarjetas', 50);
  guardar('diario', 50);
}

/** New cards already introduced today. */
export function nuevasHoy(ahora = Date.now()): number {
  return repaso.diario[claveDia(ahora)]?.n ?? 0;
}

/** Consecutive review days up to today (or up to yesterday, when today has no answers yet). */
export function racha(ahora = Date.now()): number {
  const d = new Date(ahora);
  let n = 0;
  let hoy = true;
  for (let k = 0; k < 4000; k++) {
    const clave = claveDia(d.getTime());
    if ((repaso.diario[clave]?.r ?? 0) > 0) n++;
    else if (!hoy) break;
    hoy = false;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// ------------------------------------------------------------------ quizzes

/** Stores the result of a chapter quiz, an exam or a review of mistakes. */
export function registrarRespuesta(id: string, parte: string, bien: boolean, ahora = Date.now()): void {
  if (bien) {
    if (id in repaso.fallos) {
      delete repaso.fallos[id];
      guardar('fallos');
    }
    return;
  }
  const f = repaso.fallos[id];
  repaso.fallos[id] = { parte, t: ahora, veces: (f?.veces ?? 0) + 1 };
  guardar('fallos');
}

export function registrarTest(parte: string, aciertos: number, total: number, ahora = Date.now()): void {
  if (!total) return;
  const prev = repaso.tests[parte];
  repaso.tests[parte] = {
    mejor: Math.max(prev?.mejor ?? 0, aciertos / total),
    intentos: (prev?.intentos ?? 0) + 1,
    ultimo: { t: ahora, aciertos, total },
  };
  guardar('tests');
}

export function registrarExamen(partes: string[], aciertos: number, total: number, ahora = Date.now()): void {
  if (!total) return;
  repaso.examenes = [{ t: ahora, partes, aciertos, total }, ...repaso.examenes].slice(0, 30);
  guardar('examenes');
}

export function quitarFallo(id: string): void {
  delete repaso.fallos[id];
  guardar('fallos');
}
