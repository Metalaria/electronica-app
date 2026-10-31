// Mastery per concept (0.11, group B): the consumer of the `respuesta` events that keeps each item's rounds
// (dominio.ts: the rules and the formula) and the reactive summary the pages read.
//
// Stored with the other learning data (lib/almacen.ts: Tauri plugin-store `lector.json`, or localStorage
// `epa:dominio`):
//   dominio { version: 1,
//             items:   { "<item id>": { s: "<parte>/<label>", c: "p" | "q" | "e", r: [[t, points, 1?], …] } },
//             migrado: ms }      when the answers kept by 0.10/0.11 were turned into rounds (once per device)
// `items` is synchronised item by item (store `dominio`); two devices' rounds of the same item are merged (union),
// not overwritten, so practising the same item on the tablet and on the Mac keeps both: the engine merges them in the
// file itself before writing it (registro.svelte.ts `unir`), so the union is durable at once. Another browser tab's
// writes are merged the same way, before every write (lib/pestanas.ts).
//
// Migration (once, on the first load): what the app already knew becomes rounds with the times it was stored —
// right answers from the XP ledger (`pr:`/`pq:` award ids: 10 XP = first attempt, 5 = with help), Repaso questions
// still failed (`repaso-fallos`), and the self-checked exercises (`ejercicios`: solved without help, with help, after
// opening the solution, or failed). Those stores are only read. Lessons completed without answers are not
// evidence of mastery: they show as «studied» (the pages read the lessons store live).

import { obtenerAlmacen, type Almacen } from '../almacen';
import { anotarCambio } from '../sincronizacion/marcas';
import { eventosEntregados, type EventoAprendizaje } from './eventos';
import {
  anotarRespuesta,
  agregar,
  conceptoVacio,
  dominioPorConcepto,
  fusionarRegistros,
  registroValido,
  PUNTOS,
  VERSION_DOMINIO,
  type Agregado,
  type DominioConcepto,
  type RegistroItem,
  type ClaseItem,
} from './dominio';
import { conceptoDeEjercicio, conceptoDePractica, conceptoDePregunta } from './catalogo';
import { EnlacePestanas, fusionarPestanas, huellasDe, type BasePestanas } from '../pestanas';

const CLAVE = 'dominio';

export const estadoDominio = $state({
  listo: false,
  /** Increments whenever the records or the time of the computation change (components derive from it). */
  version: 0,
  /** Time the concepts were last computed (forgetting depends on it). */
  calculado: 0,
});

let items: Record<string, RegistroItem> = {};
let conceptos: Record<string, DominioConcepto> = {};
let migrado = 0;
let almacen: Almacen | null = null;
let carga: Promise<void> | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;
/** Answers are processed one at a time, in order (a section lookup may wait for a data file). */
let cola: Promise<void> = Promise.resolve();
/** What this tab last read from or wrote to the storage (lib/pestanas.ts). */
let base: BasePestanas = new Map();

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// ------------------------------------------------------------------ storage

/**
 * Writes the records (merging first what another tab wrote meanwhile); the promise fails if the storage does.
 * `cambio` (the synchronisation's result) is applied atomically: to a copy that is written, and to memory only after
 * the write succeeded (third review, finding 2).
 */
function escribir(cambio?: (items: Record<string, RegistroItem>) => void): Promise<void> {
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  if (!almacen) {
    if (cambio) {
      cambio(items);
      calcular();
    }
    return Promise.resolve();
  }
  pestanas.antesDeEscribir();
  const nuevos = cambio ? structuredClone(items) : items;
  cambio?.(nuevos);
  const p = almacen.escribir(CLAVE, { version: VERSION_DOMINIO, items: nuevos, migrado });
  pestanas.despuesDeEscribir();
  return p.then(() => {
    base = huellasDe(nuevos);
    if (cambio) {
      cambio(items);
      calcular();
    }
  });
}

const avisarEscritura = (e: unknown) => console.warn('No se pudo guardar el dominio', e);

/** Another tab wrote the records: merged with ours (rounds as a union, as the synchronisation does). */
function deOtraPestana(v: unknown, escribirSiFalta: boolean): void {
  if (!esObjeto(v) || !esObjeto(v.items)) return;
  const entrante: Record<string, RegistroItem> = {};
  for (const [k, reg] of Object.entries(v.items)) if (registroValido(reg)) entrante[k] = reg;
  const f = fusionarPestanas(base, items, entrante, fusionarRegistros);
  base = huellasDe(entrante);
  if (typeof v.migrado === 'number' && !migrado) migrado = v.migrado;
  if (f.cambiado) {
    items = f.mapa;
    calcular();
  }
  if (escribirSiFalta && f.reescribir) void escribir().catch(avisarEscritura);
}

const pestanas = new EnlacePestanas(CLAVE, deOtraPestana);

function guardar(espera = 600): void {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => void escribir().catch(avisarEscritura), espera);
}

/** Recomputes every concept (≈ 2 000 items at most: a few milliseconds). */
function calcular(ahora = Date.now()): void {
  conceptos = dominioPorConcepto(items, ahora);
  estadoDominio.calculado = ahora;
  estadoDominio.version++;
}

/** Loads the records once and migrates the older answers the first time. Idempotent. */
export function cargarDominio(): Promise<void> {
  carga ??= (async () => {
    almacen = await obtenerAlmacen();
    const v = await almacen.leer<Record<string, unknown>>(CLAVE);
    // version 1 is the first one: read field by field (later versions branch here)
    if (esObjeto(v)) {
      if (esObjeto(v.items)) {
        base = huellasDe(v.items);
        for (const [k, reg] of Object.entries(v.items)) if (registroValido(reg)) items[k] = reg;
      }
      if (typeof v.migrado === 'number') migrado = v.migrado;
    }
    // another tab's writes from now on (also during the first migration below)
    pestanas.activar(almacen.tipo);
    if (!migrado) {
      try {
        await migrar();
      } catch (e) {
        console.warn('No se pudo derivar el dominio de los datos anteriores', e);
      }
      migrado = Date.now();
      void escribir().catch(avisarEscritura);
    } else if (!esObjeto(v) || v.version !== VERSION_DOMINIO) void escribir().catch(avisarEscritura);
    calcular();
    estadoDominio.listo = true;
    if (typeof window !== 'undefined') {
      const volcar = () => {
        if (temporizador) void escribir().catch(avisarEscritura);
      };
      window.addEventListener('pagehide', volcar);
      window.addEventListener('epa:antes-de-sincronizar', volcar);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') volcar();
        // back after a while: forgetting moved on
        else if (Date.now() - estadoDominio.calculado > 10 * 60_000) calcular();
      });
    }
  })();
  return carga;
}

/** Stores a record and dates it for the synchronisation. */
function poner(id: string, reg: RegistroItem): void {
  items[id] = reg;
  anotarCambio(CLAVE, id, reg.r[reg.r.length - 1]?.[0]);
}

/** Folds a synthetic answer (migration) into the records. */
function sembrar(id: string, s: string, c: ClaseItem, t: number, puntos: number): boolean {
  const clase = c === 'p' ? 'practica' : c === 'q' ? 'pregunta' : 'ejercicio';
  const correcta = puntos > 0;
  const nuevo = anotarRespuesta(items[id], s, { t, correcta, intento: puntos === PUNTOS.bien ? 1 : 2, pistas: puntos === PUNTOS.bien ? 0 : 1, final: true, clase });
  if (!nuevo) return false;
  // migrated rounds keep the exact points (a solution opened first gives less than a right answer with help)
  const k = nuevo.r.findIndex((x) => x[0] === t);
  if (k >= 0) nuevo.r[k] = [t, puntos];
  poner(id, nuevo);
  return true;
}

/** The answers 0.10/0.11 already kept, as rounds (only reads the other stores). */
async function migrar(): Promise<number> {
  const [{ leerXp }, { repaso, cargarRepaso }, { aprendizaje, cargarAprendizaje }] = await Promise.all([
    import('./progreso.svelte'),
    import('../../componentes/repaso/estado.svelte'),
    import('../aprendizaje.svelte'),
  ]);
  await Promise.all([cargarRepaso(), cargarAprendizaje()]);
  const xp = await leerXp();
  let n = 0;
  for (const [k, v] of Object.entries(xp)) {
    const p = v as { x?: number; t?: number };
    if (typeof p?.t !== 'number' || typeof p.x !== 'number') continue;
    const puntos = p.x >= 10 ? PUNTOS.bien : PUNTOS.ayuda;
    if (k.startsWith('pr:')) {
      const id = k.slice(3);
      const s = await conceptoDePractica(id).catch(() => null);
      if (s && sembrar(id, s, 'p', p.t, puntos)) n++;
    } else if (k.startsWith('pq:')) {
      const id = k.slice(3);
      const s = await conceptoDePregunta(id.split('-')[0] ?? '', id).catch(() => null);
      if (s && sembrar(id, s, 'q', p.t, puntos)) n++;
    }
  }
  for (const [id, f] of Object.entries(repaso.fallos)) {
    if (!f || typeof f.t !== 'number') continue;
    const s = await conceptoDePregunta(f.parte, id).catch(() => null);
    if (s && sembrar(id, s, 'q', f.t, PUNTOS.mal)) n++;
  }
  for (const [label, e] of Object.entries(aprendizaje.ejercicios)) {
    if (!e || typeof e.t !== 'number' || !e.intentos) continue;
    const puntos = e.resuelto ? (e.solucion ? 30 : e.fallos > 0 || e.pistas > 0 ? PUNTOS.ayuda : PUNTOS.bien) : e.fallos > 0 ? PUNTOS.mal : -1;
    if (puntos < 0) continue;
    const s = await conceptoDeEjercicio(label).catch(() => null);
    if (s && sembrar(label, s, 'e', e.t, puntos)) n++;
  }
  return n;
}

// ------------------------------------------------------------------ events

async function procesar(e: Extract<EventoAprendizaje, { tipo: 'respuesta' }> & { t: number }): Promise<void> {
  await cargarDominio();
  let s: string | null = null;
  if (e.parte && e.seccion) s = `${e.parte}/${e.seccion}`;
  else if (items[e.id]) s = items[e.id]!.s;
  else if (e.clase === 'practica') s = await conceptoDePractica(e.id, e.parte);
  else if (e.clase === 'pregunta') s = await conceptoDePregunta(e.parte ?? '', e.id);
  else s = await conceptoDeEjercicio(e.id);
  if (!s) return;
  const nuevo = anotarRespuesta(items[e.id], s, { t: e.t, correcta: e.correcta, intento: e.intento, pistas: e.pistas, final: e.final, clase: e.clase });
  if (!nuevo) return;
  poner(e.id, nuevo);
  calcular();
  guardar();
}

/** The consumer registered by consumidores.ts: every answer, in order. */
export function consumirDominio(e: EventoAprendizaje & { t: number }): void {
  if (e.tipo !== 'respuesta') return;
  cola = cola.then(() => procesar(e)).catch((err: unknown) => console.error('Error al anotar el dominio', err));
}

/** Resolves when the answers reported so far are in the records (the end screen of a session waits for it). */
export function esperarDominio(): Promise<void> {
  // the queue is read once the consumers have the events (they load on the first event and replay the ones before)
  return eventosEntregados().then(() => cola.then(() => cargarDominio()));
}

// ------------------------------------------------------------------ queries (reactive through estadoDominio.version)

/** A concept's mastery («parte/label»); `nuevo` without evidence. */
export function dominioDe(clave: string): DominioConcepto {
  void estadoDominio.version;
  return conceptos[clave] ?? conceptoVacio(clave);
}

/** Every concept with evidence. */
export function conceptosConDominio(): DominioConcepto[] {
  void estadoDominio.version;
  return Object.values(conceptos);
}

/** A chapter's sections aggregated (those listed in the index; untouched ones count as 0). */
export function dominioDeClaves(claves: string[]): Agregado {
  void estadoDominio.version;
  return agregar(claves, conceptos);
}

/** Item id → its last round (time and points), for the selection («no repeats soon», «retest failures»). */
export function ultimasRespuestas(): Record<string, { t: number; p: number }> {
  const r: Record<string, { t: number; p: number }> = {};
  for (const [id, reg] of Object.entries(items)) {
    const u = reg.r[reg.r.length - 1];
    if (u) r[id] = { t: u[0], p: u[1] };
  }
  return r;
}

/** Mastery of some concepts now (before/after a session). */
export function instantanea(claves: string[]): Record<string, number> {
  calcular();
  const r: Record<string, number> = {};
  for (const k of claves) r[k] = conceptos[k]?.valor ?? 0;
  return r;
}

// ------------------------------------------------------------------ synchronisation (registro.svelte.ts)

export async function leerDominio(): Promise<Record<string, unknown>> {
  await cargarDominio();
  return structuredClone(items) as Record<string, unknown>;
}

/**
 * The synchronisation's merged items. The engine already merged the rounds of both devices in the file (registro
 * `unir`), so an item normally contains ours; the union with what is here is kept anyway (rounds answered here in the
 * meantime are never dropped). Stored before returning: a failed write makes the synchronisation try again.
 */
export async function aplicarDominio(ponerItems: Record<string, unknown>, quitar: string[]): Promise<void> {
  await cargarDominio();
  await escribir((m) => {
    for (const [k, v] of Object.entries(ponerItems)) {
      if (!registroValido(v)) continue;
      const local = m[k];
      m[k] = local ? fusionarRegistros(local, v) : structuredClone(v);
    }
    for (const k of quitar) delete m[k];
  });
}

/** The time of an item for the synchronisation: its last round. */
export function tiempoRegistro(v: unknown): number | undefined {
  return registroValido(v) ? v.r[v.r.length - 1]?.[0] : undefined;
}
