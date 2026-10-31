// Learning events (0.11): the one channel through which lessons, practice, exercises, the breadboard and the
// simulator report what the reader did. Emitters call `emitir(...)` with a plain object; everything that
// reacts to learning (feedback sounds and vibration, XP, levels and achievements, and — group B — mastery per
// concept, smart practice and the problem of the day) listens here instead of being called from every page.
//
//   emitir({ tipo: 'respuesta', id: 'cap05-num-ej-5.2', origen: 'leccion', correcta: true, intento: 1, pistas: 0,
//            final: true, clase: 'practica', parte: 'cap05', seccion: 'sec-5.2' });
//
// Delivery:
//   - feedback (retroalimentacion.ts: sound and vibration) runs synchronously inside `emitir`, so it stays inside
//     the user's gesture (browsers only let audio start from one);
//   - `escuchar(fn)`: synchronous listeners for UI that is on screen (returns the function that removes it);
//   - consumers (`registrarConsumidor`, installed by consumidores.ts) are loaded lazily on the first event, so the
//     start-up bundle carries only this file; events emitted while they load are kept and replayed in order. If the
//     chunk fails to load (offline, an update replaced the files), the events stay queued: the load is retried with
//     a growing pause, on the next event and when the app becomes visible (browsers remember a failed module URL,
//     so a retry asks for it with a query string). Until they are delivered, the waiting events are also kept in
//     localStorage (`epa:eventos-pendientes:<tab>`, one key per tab, also while loading), so the next start replays
//     them; the newest MAX_COLA are kept, in memory and stored alike (cola-eventos.ts).
// A listener that throws never stops the others (the error goes to the console / application log).
//
// The events are facts, not commands: a consumer decides what they are worth (XP rules live in niveles.ts) and
// must be idempotent where it stores something (the same answer can be reported again after a reload).

import { retroDe } from './retroalimentacion';
import { encolar, leerLista, MAX_COLA, PREFIJO_PENDIENTES, unirListas } from './cola-eventos';

/**
 * Where an answer was given. `prueba-nivel` answers never give XP (the placement test only measures).
 * Group B: `inteligente` («Práctica inteligente», #/practicar) and `problema-dia` (#/problema).
 */
export type OrigenRespuesta = 'leccion' | 'repaso' | 'practica' | 'ejercicio' | 'prueba-nivel' | 'inteligente' | 'problema-dia';

/** What was answered: an «Aprender haciendo» item, a Repaso question, or a self-checked exercise. */
export type ClasePregunta = 'practica' | 'pregunta' | 'ejercicio';

export type EventoAprendizaje = (
  | {
      /** A checked answer (every attempt; `final` marks the one that closes the question). */
      tipo: 'respuesta';
      /** Item id (`cap05-pred-sec-5.4`), Repaso question id (`cap05-03`) or exercise label (`ej-5.1`). */
      id: string;
      clase: ClasePregunta;
      origen: OrigenRespuesta;
      correcta: boolean;
      /** 1 for the first attempt of this round, 2 for the second… */
      intento: number;
      /** Hints on show when it was checked. */
      pistas: number;
      /** No more attempts in this round (right, or wrong with none left). */
      final: boolean;
      parte?: string;
      seccion?: string;
      /** Kind of practice item (numerico, prediccion…), for statistics. */
      subtipo?: string;
    }
  | {
      /** The summary screen of a lesson «Estudiar por pasos» was reached. */
      tipo: 'leccion-completada';
      parte: string;
      seccion: string;
      /** First time this lesson is completed on this device. */
      primera: boolean;
    }
  | {
      /** A self-checked exercise or problem became solved (or self-assessed as right). */
      tipo: 'ejercicio-resuelto';
      id: string;
      parte?: string;
      intentos: number;
      fallos: number;
      pistas: number;
      /** The solution was opened before solving it. */
      conSolucion: boolean;
    }
  | {
      /** A step of a guided breadboard circuit («Monta este circuito») was done. */
      tipo: 'paso-montaje';
      circuito: string;
      paso: number;
      total: number;
    }
  | {
      /** A guided breadboard circuit was finished and proved by its simulation. */
      tipo: 'circuito-montado';
      circuito: string;
    }
  | {
      /** A simulation started by the reader finished (simulator page, editor, breadboard). */
      tipo: 'simulacion';
      origen: 'simulador' | 'editor' | 'protoboard';
    }
  | {
      /** Today's daily goal was just met (lib/progreso-diario.svelte.ts). */
      tipo: 'objetivo-cumplido';
      /** Review day «2026-10-30» (days start at 04:00). */
      dia: string;
      /** Streak including today. */
      racha: number;
    }
  | {
      /** A placement test («Prueba de nivel») was finished. */
      tipo: 'prueba-nivel';
      curso: string;
      aciertos: number;
      total: number;
      /** Chapter (part id) recommended to start with. */
      recomendado: string | null;
    }
  | {
      /** Group B: the problem of the day got its final answer (once per day; #/problema). */
      tipo: 'problema-dia';
      /** Review day «2026-10-30» (days start at 04:00). */
      dia: string;
      /** The problem: a «Calcula» item id or an exercise label. */
      id: string;
      correcta: boolean;
      intentos: number;
      /** Consecutive days with the problem solved, including this one (0 when wrong). */
      racha: number;
    }
) & {
  /** Time of the event (ms); `emitir` fills it in. */
  t?: number;
};

export type TipoEvento = EventoAprendizaje['tipo'];
export type Oyente = (e: EventoAprendizaje & { t: number }) => void;

const oyentes = new Set<Oyente>();
const consumidores = new Set<Oyente>();
let estado: 'sin-cargar' | 'cargando' | 'listo' | 'fallido' = 'sin-cargar';
let previos: (EventoAprendizaje & { t: number })[] = [];
/** This tab's key for its waiting events (another tab has its own). */
const CLAVE_PENDIENTES = `${PREFIJO_PENDIENTES}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
/** Keys of other tabs (or of an earlier start) whose events this tab took: removed once delivered. */
let adoptadas: string[] = [];
let fallos = 0;
let ultimoError: unknown = null;
let tReintento: ReturnType<typeof setTimeout> | null = null;
let avisadoDescarte = false;

function guardarPendientes(): void {
  try {
    if (previos.length) localStorage.setItem(CLAVE_PENDIENTES, JSON.stringify(previos));
    else localStorage.removeItem(CLAVE_PENDIENTES);
  } catch {
    /* private mode or full: they still wait in memory */
  }
}

/** Waiting events saved by tabs that could not deliver them (this one's earlier starts, or others). */
function leerPendientes(): (EventoAprendizaje & { t: number })[] {
  const listas: (EventoAprendizaje & { t: number })[][] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || (k !== PREFIJO_PENDIENTES && !k.startsWith(`${PREFIJO_PENDIENTES}:`))) continue;
      adoptadas.push(k);
      listas.push(leerLista(localStorage.getItem(k)) as (EventoAprendizaje & { t: number })[]);
    }
  } catch {
    return [];
  }
  return unirListas(listas);
}

function olvidarAdoptadas(): void {
  try {
    for (const k of adoptadas) localStorage.removeItem(k);
  } catch {
    /* nothing to do */
  }
  adoptadas = [];
}

const URL_MODULO = /(https?:\/\/[^\s'"]+?\.js)\b/;

/**
 * The consumers' module. A retry first asks again as usual (some engines do retry a failed module); Chromium and
 * WebKit remember the failure for that URL, so then the URL of the failed request (named in the error) is asked
 * with a query string: another module for the browser, the same file for the server.
 */
async function importar(): Promise<{ instalar: () => void }> {
  if (!fallos) return import('./consumidores');
  try {
    return await import('./consumidores');
  } catch (e) {
    const url = URL_MODULO.exec(String((ultimoError as Error | null)?.message ?? ''))?.[1] ?? URL_MODULO.exec(String((e as Error | null)?.message ?? ''))?.[1];
    if (!url) throw e;
    return (await import(/* @vite-ignore */ `${url}?reintento=${fallos}`)) as { instalar: () => void };
  }
}

function programarReintento(): void {
  if (tReintento || typeof window === 'undefined') return;
  const espera = Math.min(60_000, 2000 * 2 ** Math.min(fallos - 1, 5));
  tReintento = setTimeout(() => {
    tReintento = null;
    void cargarConsumidores();
  }, espera);
}

function avisar(o: Oyente, e: EventoAprendizaje & { t: number }): void {
  try {
    o(e);
  } catch (err) {
    console.error('Error en un oyente de eventos de aprendizaje', err);
  }
}

let cargaConsumidores: Promise<void> | null = null;

/**
 * Loads the consumers (consumidores.ts) once; the events emitted meanwhile are replayed afterwards. A failed load
 * keeps the events (in memory and in localStorage) and is retried (see the header).
 */
export function cargarConsumidores(): Promise<void> {
  if (estado === 'listo' || estado === 'cargando') return cargaConsumidores ?? Promise.resolve();
  estado = 'cargando';
  if (tReintento) {
    clearTimeout(tReintento);
    tReintento = null;
  }
  cargaConsumidores = importar()
    .then((m) => m.instalar())
    .then(
      () => {
        estado = 'listo';
        fallos = 0;
        const antes = previos;
        previos = [];
        for (const e of antes) for (const c of consumidores) avisar(c, e);
        guardarPendientes();
        olvidarAdoptadas();
      },
      (err: unknown) => {
        estado = 'fallido';
        fallos++;
        ultimoError ??= err;
        console.error('No se pudieron cargar los consumidores de eventos; se reintentará', err);
        guardarPendientes();
        programarReintento();
      },
    );
  return cargaConsumidores;
}

/**
 * Resolves when the events emitted so far have reached the consumers: at once if they are loaded (or nothing was
 * emitted yet), else after the lazy load and its replay (0.11 QA: a smart-practice session that ended while the
 * consumers were still loading showed its «what improved» without the session's answers).
 */
export function eventosEntregados(): Promise<void> {
  return estado === 'cargando' && cargaConsumidores ? cargaConsumidores : Promise.resolve();
}

/** Reports something the reader did. Safe to call from anywhere (no-op outside a browser). */
export function emitir(evento: EventoAprendizaje): void {
  if (typeof window === 'undefined') return;
  const e = { ...evento, t: evento.t ?? Date.now() } as EventoAprendizaje & { t: number };
  try {
    retroDe(e);
  } catch (err) {
    console.error('Error en la respuesta sonora o táctil', err);
  }
  for (const o of oyentes) avisar(o, e);
  if (estado === 'listo') {
    for (const c of consumidores) avisar(c, e);
  } else {
    // the newest are kept (as stored); saved at once, also while loading: a page closed now replays them next time
    if (encolar(previos, e, MAX_COLA) && !avisadoDescarte) {
      avisadoDescarte = true;
      console.warn(`Más de ${MAX_COLA} eventos de aprendizaje sin entregar: se descartan los más antiguos.`);
    }
    guardarPendientes();
    void cargarConsumidores();
  }
  // For tests and the diagnostic page: the last events (bounded).
  const w = window as unknown as { __epaEventos?: EventoAprendizaje[] };
  if (w.__epaEventos) {
    w.__epaEventos.push(e);
    if (w.__epaEventos.length > 100) w.__epaEventos.splice(0, w.__epaEventos.length - 100);
  }
}

/** A synchronous listener for UI on screen. Returns the function that removes it. */
export function escuchar(fn: Oyente): () => void {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

/**
 * A consumer that must see every event (also those emitted before it was loaded). Register it from
 * consumidores.ts → instalar(), which `emitir` loads on the first event.
 */
export function registrarConsumidor(fn: Oyente): () => void {
  consumidores.add(fn);
  return () => consumidores.delete(fn);
}

// Events a previous session could not deliver (the consumers' chunk failed to load): replayed now (the consumers are
// idempotent); a failed load is also retried when the app becomes visible again.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const pendientes = leerPendientes();
  if (pendientes.length) {
    previos = pendientes;
    guardarPendientes();
    queueMicrotask(() => void cargarConsumidores());
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && estado === 'fallido') void cargarConsumidores();
  });
}
