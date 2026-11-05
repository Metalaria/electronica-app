// Personal data of the «Repaso» page: flashcard states, daily log, settings and quiz results.
// Stored with the same layer as bookmarks and notes (lib/almacen.ts: Tauri plugin-store on Windows,
// macOS and Android, localStorage in a browser), under its own keys, with debounced writes that are
// flushed when the page is hidden or closed.

import { Guardado, copiaPlana, guardadoDeRegistro } from '../../lib/sincronizacion/guardado';
import { claveDia, responder, type Calificacion, type EstadoTarjeta } from './srs';
import { anotarBorrado, anotarCambio } from '../../lib/sincronizacion/marcas';
import { registrarActividad } from '../../lib/progreso-diario.svelte';
import { efectivo, unirDiasRepaso } from './diario';
export { efectivo, unirDiasRepaso };

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
  /** 0.12d: what of r/n/b was undone (only growing; absent while 0): the day's counts are the difference (`efectivo`). */
  dr?: number;
  dn?: number;
  db?: number;
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

let carga: Promise<void> | null = null;

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
/** The settings of a fresh install (the synchronised store's default value: registro.svelte.ts `porDefecto`). */
export const AJUSTES_DEFECTO: AjustesRepaso = { nuevasDia: NUEVAS_DIA_DEFECTO, inversas: false, mazo: 'todo' };
function normalizarAjustes(a: unknown): AjustesRepaso {
  const r = { ...repaso.ajustes, ...(esObjeto(a) ? (a as Partial<AjustesRepaso>) : {}) };
  r.nuevasDia = Math.min(NUEVAS_DIA_MAX, Math.max(0, Math.round(Number(r.nuevasDia) || 0)));
  return r;
}
const MAX_EXAMENES = 30;
function listaExamenes(m: Record<string, Examen>): Examen[] {
  return Object.values(m)
    .sort((a, b) => b.t - a.t)
    .slice(0, MAX_EXAMENES);
}
const mapaExamenes = (l: unknown): Record<string, Examen> =>
  Array.isArray(l) ? Object.fromEntries(l.filter((e) => esObjeto(e) && typeof e.t === 'number').map((e: Examen) => [String(e.t), e])) : {};

// Every key is written with read-merge-write (lib/sincronizacion/guardado.ts): what the synchronisation or another
// tab stored meanwhile is never overwritten with this tab's older copy; the synchronisation's results are applied
// atomically. The settings are one item («ajustes»), the exams a list keyed by their time.
export const guardadosRepaso = {
  tarjetas: guardadoDeRegistro<EstadoTarjeta>({ claveAlmacen: CLAVES.tarjetas, claveSinc: CLAVES.tarjetas, obtener: () => repaso.tarjetas, tiempo: (v) => numero(v?.u) }),
  // (two tabs that answered the same day: the larger count per field — `unirDiasRepaso`)
  diario: guardadoDeRegistro<DiaRepaso>({ claveAlmacen: CLAVES.diario, claveSinc: CLAVES.diario, obtener: () => repaso.diario, unir: (a, b) => unirDiasRepaso(a, b) }),
  tests: guardadoDeRegistro<ResultadoTest>({ claveAlmacen: CLAVES.tests, claveSinc: CLAVES.tests, obtener: () => repaso.tests, tiempo: (v) => numero(v?.ultimo?.t) }),
  fallos: guardadoDeRegistro<Fallo>({ claveAlmacen: CLAVES.fallos, claveSinc: CLAVES.fallos, obtener: () => repaso.fallos, tiempo: (v) => numero(v?.t) }),
  ajustes: new Guardado<AjustesRepaso>({
    claveAlmacen: CLAVES.ajustes,
    claveSinc: CLAVES.ajustes,
    deAlmacen: (v): Record<string, AjustesRepaso> => (esObjeto(v) ? { ajustes: v as unknown as AjustesRepaso } : {}),
    aAlmacen: (m, anterior) => m.ajustes ?? anterior ?? null,
    leerMemoria: () => ({ ajustes: copiaPlana(repaso.ajustes) }),
    cambiarMemoria: (poner) => {
      if (poner.ajustes) repaso.ajustes = normalizarAjustes(poner.ajustes);
    },
  }),
  examenes: new Guardado<Examen>({
    claveAlmacen: CLAVES.examenes,
    claveSinc: CLAVES.examenes,
    deAlmacen: mapaExamenes,
    aAlmacen: listaExamenes,
    leerMemoria: () => mapaExamenes(copiaPlana(repaso.examenes)),
    cambiarMemoria: (poner, quitar) => {
      const m = mapaExamenes(copiaPlana(repaso.examenes));
      Object.assign(m, poner);
      for (const id of quitar) delete m[id];
      repaso.examenes = listaExamenes(m);
    },
    tiempo: (e) => e.t,
  }),
};

function guardar(campo: Campo, espera = 250): void {
  guardadosRepaso[campo].guardar(espera);
}

/** Writes everything still pending. */
export function volcarRepaso(): void {
  for (const g of Object.values(guardadosRepaso)) void g.volcar().catch(() => undefined);
}

/** Loads the stored data once (idempotent). */
export function cargarRepaso(): Promise<void> {
  carga ??= (async () => {
    const g = guardadosRepaso;
    // each key adopted in its own load step (a write queued meanwhile runs after it, never from the memory before the
    // load — fifth review); what was changed before the load stays
    await Promise.all([
      g.tarjetas.cargar((m) => (repaso.tarjetas = { ...m, ...repaso.tarjetas })),
      g.diario.cargar((m) => (repaso.diario = { ...m, ...repaso.diario })),
      g.ajustes.cargar((m) => {
        repaso.ajustes = normalizarAjustes({ ...(m.ajustes ?? {}), ...ajustesAntesDeCargar });
        ajustesAntesDeCargar = {};
      }),
      g.tests.cargar((m) => (repaso.tests = { ...m, ...repaso.tests })),
      g.fallos.cargar((m) => (repaso.fallos = { ...m, ...repaso.fallos })),
      g.examenes.cargar((m) => (repaso.examenes = listaExamenes({ ...m, ...mapaExamenes(copiaPlana(repaso.examenes)) }))),
    ]);
    repaso.listo = true;
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') volcarRepaso();
      });
      window.addEventListener('pagehide', volcarRepaso);
    }
  })().catch((e: unknown) => {
    // a load that failed (the storage could not be read) is tried again by the next call, not memoised for the
    // session (sixth review); nothing was taken as stored meanwhile (sincronizacion/guardado.ts)
    carga = null;
    throw e;
  });
  return carga;
}

// ------------------------------------------------------------------ flashcards

export interface Deshacer {
  id: string;
  previo: EstadoTarjeta | undefined;
  dia: string;
  /** What the answer added to the day (an undo adds it to the undo counters: review 0.12d, finding 2). */
  suma: { r: number; n: number; b: number };
  /**
   * The card's state the answer left (0.12f): the undo restores `previo` only while the card still has it — not after
   * «Reiniciar tarjetas» or another answer of it (another tab, another device).
   */
  tras?: EstadoTarjeta;
}

/** Records an answer; returns what is needed to undo it. */
export function calificar(id: string, c: Calificacion, ahora = Date.now()): Deshacer {
  const previo = repaso.tarjetas[id] ? { ...repaso.tarjetas[id] } : undefined;
  const dia = claveDia(ahora);
  repaso.tarjetas[id] = responder(previo, c, ahora, id);
  const d = repaso.diario[dia] ?? { r: 0, n: 0, b: 0 };
  const suma = { r: 1, n: previo ? 0 : 1, b: c > 1 ? 1 : 0 };
  d.r += suma.r;
  d.n += suma.n;
  d.b += suma.b;
  repaso.diario[dia] = d;
  anotarCambio('repaso-diario', dia);
  guardar('tarjetas');
  guardar('diario');
  // a flashcard answered counts as a review question for the daily goal
  registrarActividad('pregunta');
  return { id, previo, dia, suma, tras: { ...repaso.tarjetas[id]! } };
}

export function deshacer(d: Deshacer): void {
  if (d.dia === claveDia(Date.now())) registrarActividad('pregunta', -1);
  const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (d.tras === undefined || igual(repaso.tarjetas[d.id], d.tras)) {
    if (d.previo) {
      repaso.tarjetas[d.id] = d.previo;
      anotarCambio('repaso-tarjetas', d.id);
    } else {
      delete repaso.tarjetas[d.id];
      anotarBorrado('repaso-tarjetas', d.id);
    }
  }
  // the day's counts never go down (another device's or the file's larger count would bring the undone answer back:
  // review 0.12d, finding 2): what is undone grows instead — never beyond what was answered (review 0.12f, finding 3:
  // «Deshacer» in one tab after «Reiniciar tarjetas» in another, which leaves today wholly undone, made dr = r + 1 and
  // the day's next answer and new card counted nothing)
  const dia = repaso.diario[d.dia];
  if (dia) {
    const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0);
    dia.dr = Math.min(n(dia.r), n(dia.dr) + d.suma.r);
    if (d.suma.n) dia.dn = Math.min(n(dia.n), n(dia.dn) + d.suma.n);
    if (d.suma.b) dia.db = Math.min(n(dia.b), n(dia.db) + d.suma.b);
    repaso.diario[d.dia] = dia;
    anotarCambio('repaso-diario', d.dia);
  }
  guardar('tarjetas');
  guardar('diario');
}

/** The settings the reader changed before the load finished (they win over the stored ones: sixth review). */
let ajustesAntesDeCargar: Partial<AjustesRepaso> = {};

export function ponerAjustes(a: Partial<AjustesRepaso>): void {
  if (!repaso.listo) Object.assign(ajustesAntesDeCargar, a);
  repaso.ajustes = { ...repaso.ajustes, ...a };
  repaso.ajustes.nuevasDia = Math.min(NUEVAS_DIA_MAX, Math.max(0, Math.round(repaso.ajustes.nuevasDia)));
  anotarCambio('repaso-ajustes', 'ajustes');
  guardar('ajustes', 100);
}

/** Forgets every flashcard state and the log (the quiz results stay). */
export function reiniciarTarjetas(ahora = Date.now()): void {
  anotarBorrado('repaso-tarjetas', Object.keys(repaso.tarjetas));
  repaso.tarjetas = {};
  // the past days are deleted (as before); TODAY is kept, wholly undone (review 0.12e, finding 3): its counters only
  // grow and versions merge by the larger value, so a deleted today answered again after the reset ({1,1,1}) merged
  // with the version already synchronised ({10,10,8}) and the pre-reset counts came back — and with them today's new
  // cards, leaving the reader without new cards for the rest of the day. 0.10/0.11 still read today's r/n/b (the
  // pre-reset answers): only today, and only what they show
  const hoy = claveDia(ahora);
  const pasados = Object.keys(repaso.diario).filter((d) => d !== hoy);
  if (pasados.length) anotarBorrado('repaso-diario', pasados);
  const d = repaso.diario[hoy];
  repaso.diario = {};
  if (d) {
    repaso.diario[hoy] = { ...d, dr: Math.max(d.r, d.dr ?? 0), dn: Math.max(d.n, d.dn ?? 0), db: Math.max(d.b, d.db ?? 0) };
    anotarCambio('repaso-diario', hoy);
  }
  guardar('tarjetas', 50);
  guardar('diario', 50);
}

/** New cards already introduced today. */
export function nuevasHoy(ahora = Date.now()): number {
  return efectivo(repaso.diario[claveDia(ahora)]).n;
}

/** Consecutive review days up to today (or up to yesterday, when today has no answers yet). */
export function racha(ahora = Date.now()): number {
  const d = new Date(ahora);
  let n = 0;
  let hoy = true;
  for (let k = 0; k < 4000; k++) {
    const clave = claveDia(d.getTime());
    if (efectivo(repaso.diario[clave]).r > 0) n++;
    else if (!hoy) break;
    hoy = false;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// ------------------------------------------------------------------ quizzes

/** Stores the result of a chapter quiz, an exam or a review of mistakes. */
export function registrarRespuesta(id: string, parte: string, bien: boolean, ahora = Date.now()): void {
  // every quiz answer (right or wrong) counts for the daily goal
  registrarActividad('pregunta');
  if (bien) {
    if (id in repaso.fallos) {
      delete repaso.fallos[id];
      anotarBorrado('repaso-fallos', id);
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
  anotarBorrado('repaso-fallos', id);
  guardar('fallos');
}
