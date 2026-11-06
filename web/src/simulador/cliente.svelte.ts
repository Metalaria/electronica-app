// Main-thread side of the simulator: loads ngspice lazily (only when the simulator is used), keeps one Web
// Worker, runs one netlist at a time and reports progress. A new request supersedes a running one (the worker
// is dropped and a fresh one started from the already compiled module, which takes a few tens of ms), so
// moving a slider never queues stale simulations.

import { registrar } from '../lib/registro';
import { informarFallo, miga } from '../lib/informe-fallos';
import type { Simulacion } from './motor/simular.ts';
import type { MensajeAlMotor, MensajeDelMotor } from './protocolo';
import { MOTORES, motorElegido, otroMotor, type IdMotor } from './motor/motores.ts';
/** A run that takes longer than this is stopped (the reader can start it again). */
export const LIMITE_MS = 180_000;
/** 1.0: a download that receives nothing for this long is abandoned (the next run tries again). */
export const SIN_DATOS_MS = 30_000;
/** 1.0: a worker that does not report «listo» within this time is dropped (the next run starts another one). */
export const ARRANQUE_MS = 60_000;

export type Fase = 'inactivo' | 'descargando' | 'preparando' | 'simulando';

export const motor = $state({
  fase: 'inactivo' as Fase,
  /** Download progress of the binary, 0–1 (or null if the size is unknown). */
  descarga: null as number | null,
  /** Lines printed by ngspice during the current run (live). */
  lineas: [] as string[],
  /** Start time of the current run (performance.now). */
  inicio: 0,
  /** Analyses started in the current run («Doing analysis…» lines). */
  analisis: 0,
  /** Build of ngspice in use (motores.ts), once loaded. */
  id: null as IdMotor | null,
});

/** Whether the engine in use (or the one that will be loaded) runs XSPICE code models (A devices). */
export function motorConXspice(): boolean {
  return MOTORES[motor.id ?? motorElegido()].xspice;
}

export class SimulacionCancelada extends Error {
  constructor() {
    super('Simulación sustituida o detenida');
  }
}

interface MotorCargado {
  modulo: WebAssembly.Module;
  id: IdMotor;
}

let moduloPromesa: Promise<MotorCargado> | null = null;

/** Fetches and compiles the chosen engine once (≈ 6 MB), with download progress; the other one if it fails. */
function cargarModulo(): Promise<MotorCargado> {
  moduloPromesa ??= (async () => {
    const elegido = motorElegido();
    try {
      return { modulo: await descargarYCompilar(elegido), id: elegido };
    } catch (e) {
      const otro = otroMotor(elegido);
      console.warn(`No se pudo cargar ${MOTORES[elegido].nombre}; se usa ${MOTORES[otro].nombre}.`, e);
      informarFallo('simulador', e, { zona: `motor ${MOTORES[elegido].nombre}` });
      return { modulo: await descargarYCompilar(otro), id: otro };
    }
  })();
  moduloPromesa
    .then((m) => (motor.id = m.id))
    .catch((e: unknown) => {
      moduloPromesa = null;
      motor.fase = 'inactivo';
      informarFallo('simulador', e, { zona: 'carga del motor de simulación' });
    });
  return moduloPromesa;
}

async function descargarYCompilar(id: IdMotor): Promise<WebAssembly.Module> {
  motor.fase = 'descargando';
  motor.descarga = 0;
  const url = new URL(MOTORES[id].wasm, document.baseURI).href;
  // 1.0: a stalled download (no bytes for SIN_DATOS_MS) is abandoned instead of «Descargando…» forever
  const corte = new AbortController();
  let vigia = setTimeout(() => corte.abort(), SIN_DATOS_MS);
  const vigilar = () => {
    clearTimeout(vigia);
    vigia = setTimeout(() => corte.abort(), SIN_DATOS_MS);
  };
  try {
    return await descargarYCompilarCon(url, corte.signal, vigilar);
  } catch (e) {
    if (corte.signal.aborted) throw new Error('La descarga del motor de simulación se ha detenido (sin datos durante 30 s). Compruebe la conexión e inténtelo de nuevo.');
    throw e;
  } finally {
    clearTimeout(vigia);
  }
}

async function descargarYCompilarCon(url: string, signal: AbortSignal, vigilar: () => void): Promise<WebAssembly.Module> {
  const r = await fetch(url, { signal });
  vigilar();
  if (!r.ok) throw new Error(`No se pudo cargar el motor de simulación (${r.status}).`);
  const total = Number(r.headers.get('content-length')) || 0;
  let bytes: ArrayBuffer;
  if (r.body && total) {
    const lector = r.body.getReader();
    const trozos: Uint8Array[] = [];
    let n = 0;
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      trozos.push(value);
      vigilar();
      n += value.length;
      motor.descarga = Math.min(1, n / total);
    }
    const todo = new Uint8Array(n);
    let p = 0;
    for (const t of trozos) {
      todo.set(t, p);
      p += t.length;
    }
    bytes = todo.buffer;
  } else {
    motor.descarga = null;
    bytes = await r.arrayBuffer();
  }
  motor.fase = 'preparando';
  try {
    return await WebAssembly.compile(bytes);
  } catch (e) {
    throw new Error(`No se pudo preparar el motor de simulación (WebAssembly): ${e instanceof Error ? e.message : String(e)}`);
  }
}

let trabajador: Worker | null = null;
let trabajadorListo: Promise<void> | null = null;
let siguienteId = 1;
let actual: { id: number; resolver: (r: Simulacion) => void; rechazar: (e: unknown) => void; limite: ReturnType<typeof setTimeout> } | null = null;

function nuevoTrabajador({ modulo, id: idMotor }: MotorCargado): Promise<void> {
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'ngspice' });
  trabajador = w;
  const arrancado = new Promise<void>((listoOk, falloOk) => {
    // 1.0: a worker that never says «listo» (its module failed to instantiate without an error event, or it hangs) is
    // dropped after ARRANQUE_MS; and a failed start drops it too, so the NEXT run starts a new one — before, the
    // rejected start stayed in `trabajadorListo` and every later run failed with it until the page was reloaded.
    let resuelto = false;
    const arranque = setTimeout(() => fallo(new Error('El motor de simulación no ha arrancado; se ha detenido. Vuelva a intentarlo.')), ARRANQUE_MS);
    const listo = () => {
      if (resuelto) return;
      resuelto = true;
      clearTimeout(arranque);
      listoOk();
    };
    const fallo = (e: unknown) => {
      if (resuelto) return;
      resuelto = true;
      clearTimeout(arranque);
      if (trabajador === w) descartar();
      else w.terminate();
      falloOk(e);
    };
    w.onmessage = (ev: MessageEvent<MensajeDelMotor>) => {
      const m = ev.data;
      if (m.t === 'listo') listo();
      else if (m.t === 'lineas' && actual?.id === m.id) {
        motor.lineas.push(...m.lineas);
        motor.analisis += m.lineas.filter((l) => /^Doing analysis/.test(l)).length;
      } else if (m.t === 'fin' && actual?.id === m.id) {
        const a = actual;
        actual = null;
        clearTimeout(a.limite);
        motor.fase = 'inactivo';
        a.resolver(m.resultado);
      } else if (m.t === 'error') {
        if (m.id === 0) fallo(new Error(m.mensaje));
        else if (actual?.id === m.id) {
          const a = actual;
          actual = null;
          clearTimeout(a.limite);
          motor.fase = 'inactivo';
          a.rechazar(new Error(m.mensaje));
        }
      }
    };
    w.onerror = (e) => {
      const err = new Error(`El motor de simulación ha fallado: ${e.message || 'error desconocido'}`);
      fallo(err);
      if (actual) {
        const a = actual;
        actual = null;
        clearTimeout(a.limite);
        motor.fase = 'inactivo';
        a.rechazar(err);
      }
      if (trabajador === w) descartar();
    };
    const msg: MensajeAlMotor = { t: 'motor', modulo, motor: idMotor };
    try {
      w.postMessage(msg);
    } catch {
      // Engines that cannot send a compiled module to a worker get the bytes again.
      fetch(new URL(MOTORES[idMotor].wasm, document.baseURI).href)
        .then((r) => r.arrayBuffer())
        .then((bytes) => w.postMessage({ t: 'motor', bytes, motor: idMotor } satisfies MensajeAlMotor, [bytes]))
        .catch(fallo);
    }
  });
  // (whoever awaits it gets the failure; a start nobody awaits — precalentarMotor — is not an unhandled rejection)
  arrancado.catch(() => {});
  return arrancado;
}

function descartar() {
  trabajador?.terminate();
  trabajador = null;
  trabajadorListo = null;
}

/**
 * Whether the newest run asked for is a background one (`simularTexto(…, { fondo: true })`: a drawn circuit solving
 * itself again after a page's result). A page whose run that replaced runs it again; one replaced by someone's own
 * run (the breadboard over the simulator, the instruments) does not — it would cancel that run in turn (0.11 final
 * QA: the breadboard's «Simular» over a book netlist did nothing).
 */
let ultimaDeFondo = false;
export function sustituidaPorFondo(): boolean {
  return ultimaDeFondo;
}

/** Stops the running simulation (if any). */
export function detener(): void {
  ultimaDeFondo = false;
  if (!actual) return;
  const a = actual;
  actual = null;
  clearTimeout(a.limite);
  descartar();
  motor.fase = 'inactivo';
  a.rechazar(new SimulacionCancelada());
}

/** Runs a netlist. Rejects with SimulacionCancelada if another run replaces it or it is stopped. */
export async function simularTexto(texto: string, op: { fondo?: boolean } = {}): Promise<Simulacion> {
  // Application log (0.10): every run with its title, time and outcome, so a report from the tablet says what was
  // simulated and what came out (superseded runs are not errors).
  const titulo = (texto.split('\n').find((l) => l.trim()) ?? '').replace(/^\*\s*/, '').slice(0, 80);
  const t0 = performance.now();
  try {
    const r = await simularTextoSinRegistro(texto, !!op.fondo);
    const errores = r.salida.errores ?? [];
    registrar(
      errores.length || r.ejecucion.fallo ? 'aviso' : 'info',
      'simulador',
      `«${titulo}»: ${Math.round(performance.now() - t0)} ms${errores.length ? `; ${errores.length} errores de ngspice: ${errores.slice(0, 2).join(' · ')}` : ''}${r.ejecucion.fallo ? `; fallo: ${String(r.ejecucion.fallo)}` : ''}`,
    );
    return r;
  } catch (e) {
    if (!(e instanceof SimulacionCancelada)) {
      registrar('error', 'simulador', `«${titulo}»: ${e instanceof Error ? e.message : String(e)}`);
      // (the report gets the failure, not the circuit's title)
      informarFallo('simulador', e, { zona: 'simulación' });
    }
    throw e;
  }
}

async function simularTextoSinRegistro(texto: string, fondo: boolean): Promise<Simulacion> {
  miga(fondo ? 'simulación (de fondo)' : 'simulación');
  detener();
  ultimaDeFondo = fondo;
  const id = siguienteId++;
  motor.lineas = [];
  motor.analisis = 0;
  const cargado = await cargarModulo();
  if (siguienteId - 1 !== id) throw new SimulacionCancelada();
  if (!trabajador || !trabajadorListo) {
    motor.fase = 'preparando';
    trabajadorListo = nuevoTrabajador(cargado);
  }
  await trabajadorListo;
  if (siguienteId - 1 !== id) throw new SimulacionCancelada();
  motor.fase = 'simulando';
  motor.inicio = performance.now();
  return new Promise<Simulacion>((resolver, rechazar) => {
    const limite = setTimeout(() => {
      if (actual?.id !== id) return;
      actual = null;
      descartar();
      motor.fase = 'inactivo';
      rechazar(new Error(`La simulación ha superado ${LIMITE_MS / 60000} minutos y se ha detenido.`));
    }, LIMITE_MS);
    actual = { id, resolver, rechazar, limite };
    trabajador!.postMessage({ t: 'simular', id, texto } satisfies MensajeAlMotor);
  });
}

/** Starts downloading and compiling the engine in the background (when the simulator page opens). */
export function precalentarMotor(): void {
  void cargarModulo()
    .then((m) => {
      if (!trabajador) trabajadorListo = nuevoTrabajador(m);
      if (motor.fase !== 'simulando') motor.fase = 'inactivo';
    })
    .catch(() => {
      motor.fase = 'inactivo';
    });
}
