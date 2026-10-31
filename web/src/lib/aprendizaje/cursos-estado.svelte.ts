// What the reader did with the thematic courses (0.11): lessons marked «superada por la prueba» by a placement
// test, and the last result of each course's test. Same storage layer as the other learning data
// (lib/almacen.ts: Tauri plugin-store `lector.json`, or localStorage `epa:cursos`):
//   cursos   { version: 1,
//              superadas: { "<parte>/<label>": time marked },
//              pruebas:   { "<curso id>": { t, aciertos, total, recomendado, marcadas } } }
// Both maps are synchronised item by item (lib/sincronizacion/registro.svelte.ts: stores `cursos-superadas`
// and `cursos-pruebas`). A lesson passed by the test is not a completed lesson: it gives no XP, it does not count
// for the daily goal, and completing it later works as usual. Another browser tab's writes are merged item by item,
// deletions («Deshacer») included (lib/pestanas.ts).

import { obtenerAlmacen, type Almacen } from '../almacen';
import { anotarBorrado, anotarCambio } from '../sincronizacion/marcas';
import { EnlacePestanas, fusionarPestanas, huellasDe, type BasePestanas } from '../pestanas';

export const VERSION_CURSOS = 1;
const CLAVE = 'cursos';

export interface PruebaGuardada {
  /** When it was finished (ms). */
  t: number;
  aciertos: number;
  total: number;
  /** Chapter (part id) recommended to start with; null when everything was right. */
  recomendado: string | null;
  /** Lessons marked as passed after this test. */
  marcadas: number;
}

export const estadoCursos = $state({
  listo: false,
  superadas: {} as Record<string, number>,
  pruebas: {} as Record<string, PruebaGuardada>,
});

let almacen: Almacen | null = null;
let carga: Promise<void> | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function pruebaValida(v: unknown): v is PruebaGuardada {
  return esObjeto(v) && numero(v.t) && numero(v.aciertos) && numero(v.total);
}

/** What this tab last read from or wrote to the storage (lib/pestanas.ts). */
let baseSuperadas: BasePestanas = new Map();
let basePruebas: BasePestanas = new Map();

type CambioCursos = (superadas: Record<string, number>, pruebas: Record<string, PruebaGuardada>) => void;

/**
 * Writes the courses (merging first what another tab wrote meanwhile); the promise fails if the storage does.
 * `cambio` (the synchronisation's result) is applied atomically: to a copy that is written, and to memory only after
 * the write succeeded (third review, finding 2).
 */
function escribir(cambio?: CambioCursos): Promise<void> {
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  if (!almacen) {
    cambio?.(estadoCursos.superadas, estadoCursos.pruebas);
    return Promise.resolve();
  }
  pestanas.antesDeEscribir();
  const superadas = $state.snapshot(estadoCursos.superadas);
  const pruebas = $state.snapshot(estadoCursos.pruebas) as Record<string, PruebaGuardada>;
  cambio?.(superadas, pruebas);
  const p = almacen.escribir(CLAVE, { version: VERSION_CURSOS, superadas, pruebas });
  pestanas.despuesDeEscribir();
  return p.then(() => {
    baseSuperadas = huellasDe(superadas);
    basePruebas = huellasDe(pruebas);
    cambio?.(estadoCursos.superadas, estadoCursos.pruebas);
  });
}

const avisarEscritura = (e: unknown) => console.warn('No se pudo guardar el estado de los cursos', e);

/** Another tab wrote the courses: merged with ours (the first mark of a lesson, the latest test of a course). */
function deOtraPestana(v: unknown, escribirSiFalta: boolean): void {
  if (!esObjeto(v)) return;
  const superadas: Record<string, number> = {};
  if (esObjeto(v.superadas)) for (const [k, t] of Object.entries(v.superadas)) if (numero(t)) superadas[k] = t;
  const pruebas: Record<string, PruebaGuardada> = {};
  if (esObjeto(v.pruebas)) for (const [k, p] of Object.entries(v.pruebas)) if (pruebaValida(p)) pruebas[k] = p;
  const fs = fusionarPestanas(baseSuperadas, $state.snapshot(estadoCursos.superadas), superadas, (a, b) => Math.min(a, b));
  const fp = fusionarPestanas(basePruebas, $state.snapshot(estadoCursos.pruebas) as Record<string, PruebaGuardada>, pruebas, (a, b) =>
    a.t > b.t || (a.t === b.t && JSON.stringify(a) >= JSON.stringify(b)) ? a : b,
  );
  baseSuperadas = huellasDe(superadas);
  basePruebas = huellasDe(pruebas);
  if (fs.cambiado) estadoCursos.superadas = fs.mapa;
  if (fp.cambiado) estadoCursos.pruebas = fp.mapa;
  if (escribirSiFalta && (fs.reescribir || fp.reescribir)) void escribir().catch(avisarEscritura);
}

const pestanas = new EnlacePestanas(CLAVE, deOtraPestana);

function guardar(espera = 300): void {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => void escribir().catch(avisarEscritura), espera);
}

/** Loads the stored state once (any version: the 1.0 migrations will branch on `version`). */
export function cargarCursos(): Promise<void> {
  carga ??= (async () => {
    almacen = await obtenerAlmacen();
    const v = await almacen.leer<Record<string, unknown>>(CLAVE);
    if (esObjeto(v)) {
      if (esObjeto(v.superadas)) for (const [k, t] of Object.entries(v.superadas)) if (numero(t)) estadoCursos.superadas[k] ??= t;
      if (esObjeto(v.pruebas)) for (const [k, p] of Object.entries(v.pruebas)) if (pruebaValida(p)) estadoCursos.pruebas[k] ??= p;
      baseSuperadas = huellasDe(esObjeto(v.superadas) ? v.superadas : {});
      basePruebas = huellasDe(esObjeto(v.pruebas) ? v.pruebas : {});
    }
    pestanas.activar(almacen.tipo);
    estadoCursos.listo = true;
    if (temporizador) void escribir().catch(avisarEscritura);
    if (typeof window !== 'undefined') {
      const volcar = () => {
        if (temporizador) void escribir().catch(avisarEscritura);
      };
      window.addEventListener('pagehide', volcar);
      window.addEventListener('epa:antes-de-sincronizar', volcar);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') volcar();
      });
    }
  })();
  return carga;
}

export function esSuperada(parte: string, label: string): boolean {
  return !!estadoCursos.superadas[`${parte}/${label}`];
}

/** Marks lessons («parte/label») as passed by a placement test; returns how many were new. */
export function marcarSuperadas(ids: string[]): number {
  const t = Date.now();
  let n = 0;
  for (const id of ids) {
    if (estadoCursos.superadas[id]) continue;
    estadoCursos.superadas[id] = t;
    anotarCambio('cursos-superadas', id);
    n++;
  }
  if (n) guardar();
  return n;
}

/** Undoes the marks (the «Deshacer» of the test's result). */
export function desmarcarSuperadas(ids: string[]): void {
  let n = 0;
  for (const id of ids) {
    if (!estadoCursos.superadas[id]) continue;
    delete estadoCursos.superadas[id];
    anotarBorrado('cursos-superadas', id);
    n++;
  }
  if (n) guardar(100);
}

export function guardarPrueba(curso: string, p: PruebaGuardada): void {
  estadoCursos.pruebas[curso] = p;
  anotarCambio('cursos-pruebas', curso);
  guardar(100);
}

// ------------------------------------------------------------------ synchronisation (registro.svelte.ts)

export async function leerSuperadas(): Promise<Record<string, unknown>> {
  await cargarCursos();
  return { ...$state.snapshot(estadoCursos.superadas) };
}

export async function aplicarSuperadas(poner: Record<string, unknown>, quitar: string[]): Promise<void> {
  await cargarCursos();
  await escribir((s) => {
    for (const [k, t] of Object.entries(poner)) if (numero(t)) s[k] = t;
    for (const k of quitar) delete s[k];
  });
}

export async function leerPruebas(): Promise<Record<string, unknown>> {
  await cargarCursos();
  return { ...$state.snapshot(estadoCursos.pruebas) };
}

export async function aplicarPruebas(poner: Record<string, unknown>, quitar: string[]): Promise<void> {
  await cargarCursos();
  await escribir((_s, pr) => {
    for (const [k, p] of Object.entries(poner)) if (pruebaValida(p)) pr[k] = p;
    for (const k of quitar) delete pr[k];
  });
}
