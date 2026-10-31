// XP, levels and achievements (0.11): the consumer of the learning events (eventos.ts) that turns what the reader
// does into XP, and the reactive summary the start page, the «Progreso» page and the lesson's end show.
//
// Stored with the other learning data (lib/almacen.ts: Tauri plugin-store `lector.json`, or localStorage
// `epa:progreso-xp`):
//   progreso-xp  { version: 1,
//                  xp:     { "<award id>": { x: XP, t: ms } },   ledger with deterministic ids (niveles.ts)
//                  logros: { "<achievement id>": ms unlocked } }
// Both maps are synchronised item by item (stores `progreso-xp` and `progreso-logros`): an award has the same id
// on every device, so the same lesson completed on the tablet and on the Mac counts once, and the total is
// simply the sum of the ledger. Awards are never removed.
//
// Older data is never lost nor rewritten: on load (and after each synchronisation) the ledger is reconciled
// with the progress the app already kept — completed lessons, solved exercises, days whose goal was met — adding
// the awards that are missing with the same ids and amounts the live events give (`reconciliar`). So the first
// start of 0.11 on a 0.10 install credits the earlier work, silently (no toasts).

import { obtenerAlmacen, type Almacen } from '../almacen';
import { anotarCambio } from '../sincronizacion/marcas';
import { claveDia } from '../../componentes/repaso/srs';
import { obtenerIndice } from '../datos';
import { progresoLecciones, cargarLecciones } from '../lecciones.svelte';
import { aprendizaje, cargarAprendizaje } from '../aprendizaje.svelte';
import { progresoDiario, cargarProgresoDiario, leerDias } from '../progreso-diario.svelte';
import { estadoCursos, cargarCursos } from './cursos-estado.svelte';
import { CURSOS, leccionesDeCurso } from './cursos';
import { nivelDe, xpEjercicio, xpObjetivo, xpRespuesta, XP, type Nivel } from './niveles';
import { ESTADISTICAS_VACIAS, LOGROS, cumple, type Estadisticas } from './logros';
import { avisar } from './avisos.svelte';
import type { EventoAprendizaje } from './eventos';
import { EnlacePestanas, fusionarPestanas, huellasDe, type BasePestanas } from '../pestanas';

export const VERSION_PROGRESO = 1;
const CLAVE = 'progreso-xp';

/** The built-in guided breadboard circuits (componentes/protoboard/guiados.ts GUIADOS; checked by the tests). */
export const CIRCUITOS_GUIADOS = ['led', 'divisor', 'pulsador', 'transistor', '555'];

export interface Premio {
  /** XP. */
  x: number;
  /** When it was earned (ms). */
  t: number;
}

export const progresoXp = $state({
  listo: false,
  total: 0,
  nivel: nivelDe(0) as Nivel,
  /** XP earned today (review day, from 04:00). */
  hoy: 0,
  logros: {} as Record<string, number>,
  /** Increments on every change of the ledger (components derive from it). */
  version: 0,
  /** The last statistics computed (for the «Progreso» page). */
  estadisticas: { ...ESTADISTICAS_VACIAS } as Estadisticas,
});

// The ledger is a plain object (it can hold a few thousand items): the summary above is what components read.
let xp: Record<string, Premio> = {};
let almacen: Almacen | null = null;
let carga: Promise<void> | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function premioValido(v: unknown): v is Premio {
  return esObjeto(v) && numero(v.x) && v.x >= 0 && v.x <= 1000 && numero(v.t);
}

// ------------------------------------------------------------------ storage

/** What this tab last read from or wrote to the storage (lib/pestanas.ts). */
let baseXp: BasePestanas = new Map();
let baseLogros: BasePestanas = new Map();

type CambioLibro = (xp: Record<string, Premio>, logros: Record<string, number>) => void;

/**
 * Writes the ledger (merging first what another tab wrote meanwhile); the promise fails if the storage does.
 * `cambio` (the synchronisation's result) is applied atomically: to a copy that is written, and to memory only
 * after the write succeeded — a failed write leaves memory as the storage (third review, finding 2).
 */
function escribir(cambio?: CambioLibro): Promise<void> {
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  if (!almacen) {
    if (cambio) aplicarEnMemoria(cambio);
    return Promise.resolve();
  }
  pestanas.antesDeEscribir();
  const nx = cambio ? structuredClone(xp) : xp;
  const nl = $state.snapshot(progresoXp.logros);
  cambio?.(nx, nl);
  const p = almacen.escribir(CLAVE, { version: VERSION_PROGRESO, xp: nx, logros: nl });
  pestanas.despuesDeEscribir();
  return p.then(() => {
    baseXp = huellasDe(nx);
    baseLogros = huellasDe(nl);
    if (cambio) aplicarEnMemoria(cambio);
  });
}

function aplicarEnMemoria(cambio: CambioLibro): void {
  cambio(xp, progresoXp.logros);
  resumir();
}

/** Another tab wrote the ledger: merged with ours (awards and achievements are only added; the earliest time stays). */
function deOtraPestana(v: unknown, escribirSiFalta: boolean): void {
  if (!esObjeto(v)) return;
  const premios: Record<string, Premio> = {};
  if (esObjeto(v.xp)) for (const [k, p] of Object.entries(v.xp)) if (premioValido(p)) premios[k] = { x: p.x, t: p.t };
  const logros: Record<string, number> = {};
  if (esObjeto(v.logros)) for (const [k, t] of Object.entries(v.logros)) if (numero(t)) logros[k] = t;
  const fx = fusionarPestanas(baseXp, xp, premios, (a, b) => (a.t < b.t || (a.t === b.t && a.x >= b.x) ? a : b));
  const fl = fusionarPestanas(baseLogros, $state.snapshot(progresoXp.logros), logros, (a, b) => Math.min(a, b));
  baseXp = huellasDe(premios);
  baseLogros = huellasDe(logros);
  if (fx.cambiado) {
    xp = fx.mapa;
    resumir();
  }
  if (fl.cambiado) progresoXp.logros = fl.mapa;
  if (escribirSiFalta && (fx.reescribir || fl.reescribir)) void escribir().catch(avisarEscritura);
}

const pestanas = new EnlacePestanas(CLAVE, deOtraPestana);
const avisarEscritura = (e: unknown) => console.warn('No se pudo guardar el XP', e);

function guardar(espera = 400): void {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => void escribir().catch(avisarEscritura), espera);
}

/** Recomputes the totals from the ledger. */
function resumir(): void {
  let total = 0;
  let hoy = 0;
  const dia = claveDia(Date.now());
  for (const p of Object.values(xp)) {
    total += p.x;
    if (p.x && claveDia(p.t) === dia) hoy += p.x;
  }
  progresoXp.total = total;
  progresoXp.nivel = nivelDe(total);
  progresoXp.hoy = hoy;
  progresoXp.version++;
}

/**
 * Loads the ledger once, reconciles it with the older progress and checks the achievements (silently).
 * Idempotent; every page that shows XP calls it.
 */
export function cargarProgresoXp(): Promise<void> {
  carga ??= (async () => {
    almacen = await obtenerAlmacen();
    const v = await almacen.leer<Record<string, unknown>>(CLAVE);
    // version 1 is the first one: any stored object is read field by field (the 1.0 migrations branch here)
    if (esObjeto(v)) {
      if (esObjeto(v.xp)) for (const [k, p] of Object.entries(v.xp)) if (premioValido(p)) xp[k] ??= { x: p.x, t: p.t };
      if (esObjeto(v.logros)) for (const [k, t] of Object.entries(v.logros)) if (numero(t)) progresoXp.logros[k] ??= t;
      baseXp = huellasDe(esObjeto(v.xp) ? v.xp : {});
      baseLogros = huellasDe(esObjeto(v.logros) ? v.logros : {});
    }
    // another tab's writes from now on (also while the reconciliation below runs)
    pestanas.activar(almacen.tipo);
    resumir();
    // what older data proves, and the achievements: a failure there never leaves the reader without the ledger (nor
    // breaks the synchronisation, which reads it through this load)
    let nuevos = 0;
    try {
      nuevos = await reconciliar();
    } catch (e) {
      console.warn('No se pudo conciliar el XP con el progreso anterior', e);
    }
    progresoXp.listo = true;
    if (nuevos || !esObjeto(v) || v.version !== VERSION_PROGRESO) void escribir().catch(avisarEscritura);
    await revisarLogros(true).catch((e: unknown) => console.warn('No se pudieron revisar los logros', e));
    if (typeof window !== 'undefined') {
      const volcar = () => {
        if (temporizador) void escribir().catch(avisarEscritura);
      };
      window.addEventListener('pagehide', volcar);
      window.addEventListener('epa:antes-de-sincronizar', volcar);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') volcar();
        else resumir();
      });
      // Progress from another device (lessons, exercises, days) may bring awards and achievements.
      window.addEventListener('epa:sincronizado', () => {
        void reconciliar()
          .then(async (n) => {
            if (n) guardar();
            await revisarLogros(true);
          })
          .catch((e: unknown) => console.warn('No se pudo conciliar el XP tras sincronizar', e));
      });
    }
  })();
  return carga;
}

/** Adds an award if its id is new. Returns whether it was added. */
function poner(id: string, x: number, t: number, reconciliando = false): boolean {
  if (xp[id] || !Number.isFinite(x) || x < 0) return false;
  if (reconciliando && reservados.has(id)) return false;
  xp[id] = { x: Math.round(x), t };
  anotarCambio(CLAVE, id, t);
  return true;
}

/** An award from a live event: stored, totals updated, «+N XP» and a possible new level announced. */
function otorgar(id: string, x: number, t: number): boolean {
  const antes = progresoXp.nivel.nivel;
  if (!poner(id, x, t)) return false;
  resumir();
  guardar();
  if (x > 0) avisar({ tipo: 'xp', xp: x });
  const ahora = progresoXp.nivel;
  if (ahora.nivel > antes) avisar({ tipo: 'nivel', nivel: ahora.nivel, nombre: ahora.nombre });
  return true;
}

/** Day key «2026-10-30» → day number (for consecutive days). */
function numeroDia(clave: string): number {
  const [a, m, d] = clave.split('-').map(Number);
  return Math.round(Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1) / 864e5);
}

/** Days whose goal was met, with the streak ending on each one. */
async function diasCumplidos(): Promise<{ dia: string; racha: number; t: number }[]> {
  const dias = await leerDias();
  const claves = Object.keys(dias)
    .filter((k) => dias[k]!.cumplido)
    .sort();
  const r: { dia: string; racha: number; t: number }[] = [];
  let anterior = Number.NaN;
  let racha = 0;
  for (const k of claves) {
    const n = numeroDia(k);
    racha = n === anterior + 1 ? racha + 1 : 1;
    anterior = n;
    r.push({ dia: k, racha, t: dias[k]!.t });
  }
  return r;
}

/** Adds the awards for progress kept by the other modules that the ledger lacks. Returns how many. */
async function reconciliar(): Promise<number> {
  await Promise.all([cargarLecciones(), cargarAprendizaje(), cargarProgresoDiario()]);
  let n = 0;
  for (const [id, p] of Object.entries(progresoLecciones.secciones)) if (p.c && poner(`l:${id}`, XP.leccion, p.c, true)) n++;
  for (const [label, e] of Object.entries(aprendizaje.ejercicios)) {
    if (!e.resuelto) continue;
    const x = xpEjercicio(e);
    if (x > 0 && poner(`e:${label}`, x, e.t, true)) n++;
  }
  for (const d of await diasCumplidos()) if (poner(`d:${d.dia}`, xpObjetivo(d.racha), d.t, true)) n++;
  if (n) resumir();
  return n;
}

// ------------------------------------------------------------------ events

/** The award an event is worth (id and XP), or null. Pure: XP rules in niveles.ts. */
export function premioDe(e: EventoAprendizaje): { id: string; x: number } | null {
  switch (e.tipo) {
    case 'respuesta':
      if (!e.correcta || !e.final || e.origen === 'prueba-nivel' || e.clase === 'ejercicio') return null;
      return { id: `${e.clase === 'practica' ? 'pr' : 'pq'}:${e.id}`, x: xpRespuesta(e.intento, e.pistas) };
    case 'leccion-completada':
      return { id: `l:${e.parte}/${e.seccion}`, x: XP.leccion };
    case 'ejercicio-resuelto': {
      const x = xpEjercicio({ fallos: e.fallos, pistas: e.pistas, solucion: e.conSolucion });
      return x > 0 ? { id: `e:${e.id}`, x } : null;
    }
    case 'circuito-montado':
      return { id: `c:${e.circuito}`, x: XP.circuito };
    case 'simulacion':
      return { id: 's:simulacion', x: 0 };
    case 'objetivo-cumplido':
      return { id: `d:${e.dia}`, x: xpObjetivo(e.racha) };
    case 'problema-dia':
      return e.correcta ? { id: `pd:${e.dia}`, x: XP.problemaDia } : null;
    default:
      return null;
  }
}

/**
 * Awards of events waiting for the module to load: the reconciliation that runs on the first load must not take
 * them silently (the event announces them with its «+N XP»).
 */
const reservados = new Set<string>();

/** The consumer registered by consumidores.ts. */
export function consumirEvento(e: EventoAprendizaje & { t: number }): void {
  const premio = premioDe(e);
  if (premio) reservados.add(premio.id);
  void (async () => {
    await cargarProgresoXp();
    let cambio = e.tipo === 'prueba-nivel';
    if (premio) {
      reservados.delete(premio.id);
      cambio = otorgar(premio.id, premio.x, e.t);
    }
    if (cambio) await revisarLogros(false);
  })().catch((err: unknown) => console.warn('No se pudo anotar el XP o los logros de un evento', err));
}

// ------------------------------------------------------------------ statistics and achievements

let totalesCapitulo: Promise<Record<string, number>> | null = null;

/** Practice items + Repaso questions per part (the target of «Capítulo dominado»). */
function preguntasPorParte(): Promise<Record<string, number>> {
  totalesCapitulo ??= (async () => {
    const [{ cargarIndicePractica }, { cargarIndiceRepaso }] = await Promise.all([import('../../componentes/practica/datos'), import('../../componentes/repaso/datos')]);
    const [pr, rp] = await Promise.all([cargarIndicePractica().catch(() => null), cargarIndiceRepaso().catch(() => null)]);
    const r: Record<string, number> = {};
    for (const [p, n] of Object.entries(pr?.porParte ?? {})) r[p] = (r[p] ?? 0) + n;
    for (const e of rp?.partes ?? []) r[e.parte] = (r[e.parte] ?? 0) + e.preguntas;
    return r;
  })().catch(() => {
    totalesCapitulo = null;
    return {};
  });
  return totalesCapitulo;
}

/** The summary of the reader's progress that the achievements are checked against. */
export async function calcularEstadisticas(): Promise<Estadisticas> {
  await Promise.all([cargarLecciones(), cargarAprendizaje(), cargarProgresoDiario(), cargarCursos()]);
  const s: Estadisticas = { ...ESTADISTICAS_VACIAS, circuitos: [], totalGuiados: CIRCUITOS_GUIADOS.length };
  s.xp = progresoXp.total;
  s.nivel = progresoXp.nivel.nivel;

  const completadas = new Set<string>();
  for (const [id, p] of Object.entries(progresoLecciones.secciones)) {
    if (!p?.c) continue;
    completadas.add(id);
    const h = new Date(p.c).getHours();
    if (h >= 4 && h < 8) s.madrugador = true;
    if (h >= 23 || h < 4) s.noctambulo = true;
  }
  s.lecciones = completadas.size;

  const aciertosParte: Record<string, number> = {};
  const diasProblema: string[] = [];
  for (const [id, p] of Object.entries(xp)) {
    if (id.startsWith('pr:') || id.startsWith('pq:')) {
      s.aciertos++;
      if (p.x === XP.acierto) s.sinAyuda++;
      const parte = id.slice(3).split('-')[0]!;
      aciertosParte[parte] = (aciertosParte[parte] ?? 0) + 1;
    } else if (id.startsWith('c:')) s.circuitos.push(id.slice(2));
    else if (id === 's:simulacion') s.simulaciones = 1;
    else if (id.startsWith('pd:')) diasProblema.push(id.slice(3));
  }
  // problem of the day (group B): days solved and the longest run of consecutive days
  s.problemasDia = diasProblema.length;
  {
    let anterior = Number.NaN;
    let racha = 0;
    for (const k of diasProblema.sort()) {
      const n = numeroDia(k);
      racha = n === anterior + 1 ? racha + 1 : 1;
      anterior = n;
      s.rachaProblemas = Math.max(s.rachaProblemas, racha);
    }
  }
  s.ejercicios = Object.values(aprendizaje.ejercicios).filter((e) => e.resuelto).length;
  s.leidas = Object.values(aprendizaje.leidas).reduce((n, secs) => n + Object.keys(secs).length, 0);

  const dias = await diasCumplidos();
  s.diasObjetivo = dias.length;
  s.rachaMax = Math.max(progresoDiario.racha, ...dias.map((d) => d.racha), 0);
  s.pruebas = Object.keys(estadoCursos.pruebas).length;

  if (Object.keys(aciertosParte).length) {
    const totales = await preguntasPorParte();
    s.capitulosPreguntas = Object.entries(aciertosParte).filter(([p, n]) => (totales[p] ?? 0) > 0 && n >= totales[p]!).length;
  }

  let indice;
  try {
    indice = obtenerIndice();
  } catch {
    indice = null;
  }
  if (indice) {
    for (const [p, info] of Object.entries(indice.partes)) {
      if (info.tipo !== 'capitulo' || !info.secciones?.length) continue;
      if (info.secciones.every((x) => completadas.has(`${p}/${x.label}`))) s.capitulosLecciones++;
    }
    for (const c of CURSOS) {
      const ls = leccionesDeCurso(c, indice);
      const hechas = ls.filter((l) => completadas.has(`${l.parte}/${l.label}`)).length;
      if (hechas) s.cursosEmpezados++;
      if (hechas && ls.length && ls.every((l) => completadas.has(`${l.parte}/${l.label}`) || estadoCursos.superadas[`${l.parte}/${l.label}`])) s.cursosTerminados++;
    }
  }
  return s;
}

let revision: Promise<void> = Promise.resolve();

/**
 * Unlocks the achievements whose condition now holds; announces them unless `silencioso`. The returned promise
 * rejects if this check fails, but the chain does not: the next check runs anyway.
 */
export function revisarLogros(silencioso: boolean): Promise<void> {
  // one check at a time (events can arrive in bursts); a failed check must not skip every later one
  const esta = revision.catch(() => {}).then(async () => {
    const s = await calcularEstadisticas();
    progresoXp.estadisticas = s;
    const t = Date.now();
    let nuevos = 0;
    for (const l of LOGROS) {
      if (progresoXp.logros[l.id] || !cumple(l, s)) continue;
      progresoXp.logros[l.id] = t;
      anotarCambio('progreso-logros', l.id, t);
      nuevos++;
      if (!silencioso) avisar({ tipo: 'logro', logro: l.id });
    }
    if (nuevos) guardar(200);
  });
  revision = esta;
  return esta;
}

// ------------------------------------------------------------------ queries

/** XP earned since a moment (the lesson's end screen: what this visit earned). Reactive through `version`. */
export function xpDesde(t: number): number {
  void progresoXp.version;
  let n = 0;
  for (const p of Object.values(xp)) if (p.t >= t) n += p.x;
  return n;
}

export interface EntradaHistorial {
  id: string;
  x: number;
  t: number;
  /** «Lección 5.2», «Práctica», «Objetivo diario»… */
  texto: string;
}

/** The latest awards with XP, newest first (the «Progreso» page). Reactive through `version`. */
export function historialXp(n = 8): EntradaHistorial[] {
  void progresoXp.version;
  return Object.entries(xp)
    .filter(([, p]) => p.x > 0)
    .sort((a, b) => b[1].t - a[1].t)
    .slice(0, n)
    .map(([id, p]) => ({ id, x: p.x, t: p.t, texto: describir(id) }));
}

function describir(id: string): string {
  const [k, resto = ''] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)];
  if (k === 'pr') return 'Práctica acertada';
  if (k === 'pq') return 'Pregunta de repaso acertada';
  if (k === 'e') return `Ejercicio ${resto.replace(/^(ej|prob)-/, '')} resuelto`;
  if (k === 'c') return 'Circuito montado en la protoboard';
  if (k === 'd') return 'Objetivo diario cumplido';
  if (k === 'pd') return 'Problema del día resuelto';
  if (k === 'l') {
    const [parte = '', label = ''] = resto.split('/');
    try {
      const s = obtenerIndice().partes[parte]?.secciones?.find((x) => x.label === label);
      if (s?.num) return `Lección ${s.num} completada`;
    } catch {
      /* index not loaded */
    }
    return 'Lección completada';
  }
  return 'XP';
}

// ------------------------------------------------------------------ synchronisation (registro.svelte.ts)

export async function leerXp(): Promise<Record<string, unknown>> {
  await cargarProgresoXp();
  return structuredClone(xp) as Record<string, unknown>;
}

export async function aplicarXp(poner: Record<string, unknown>, quitar: string[]): Promise<void> {
  await cargarProgresoXp();
  // (awaited and atomic: if the storage fails, nothing changed and the synchronisation knows)
  await escribir((x) => {
    for (const [k, p] of Object.entries(poner)) if (premioValido(p)) x[k] = { x: p.x, t: p.t };
    for (const k of quitar) delete x[k];
  });
}

export async function leerLogros(): Promise<Record<string, unknown>> {
  await cargarProgresoXp();
  return { ...$state.snapshot(progresoXp.logros) };
}

export async function aplicarLogros(poner: Record<string, unknown>, quitar: string[]): Promise<void> {
  await cargarProgresoXp();
  await escribir((_x, l) => {
    for (const [k, t] of Object.entries(poner)) if (numero(t)) l[k] = t;
    for (const k of quitar) delete l[k];
  });
}
