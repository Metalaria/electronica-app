// Main-thread side of the simulator: loads ngspice lazily (only when the simulator is used), keeps one Web
// Worker, runs one netlist at a time and reports progress. A new request supersedes a running one (the worker
// is dropped and a fresh one started from the already compiled module, which takes a few tens of ms), so
// moving a slider never queues stale simulations.

import { registrar } from '../lib/registro';
import type { Simulacion } from './motor/simular.ts';
import type { MensajeAlMotor, MensajeDelMotor } from './protocolo';
import { MOTORES, motorElegido, otroMotor, type IdMotor } from './motor/motores.ts';
/** A run that takes longer than this is stopped (the reader can start it again). */
export const LIMITE_MS = 180_000;

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
      return { modulo: await descargarYCompilar(otro), id: otro };
    }
  })();
  moduloPromesa.then((m) => (motor.id = m.id)).catch(() => (moduloPromesa = null));
  return moduloPromesa;
}

async function descargarYCompilar(id: IdMotor): Promise<WebAssembly.Module> {
  motor.fase = 'descargando';
  motor.descarga = 0;
  const url = new URL(MOTORES[id].wasm, document.baseURI).href;
  const r = await fetch(url);
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
  return WebAssembly.compile(bytes);
}

let trabajador: Worker | null = null;
let trabajadorListo: Promise<void> | null = null;
let siguienteId = 1;
let actual: { id: number; resolver: (r: Simulacion) => void; rechazar: (e: unknown) => void; limite: ReturnType<typeof setTimeout> } | null = null;

function nuevoTrabajador({ modulo, id: idMotor }: MotorCargado): Promise<void> {
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'ngspice' });
  trabajador = w;
  return new Promise<void>((listo, fallo) => {
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
      descartar();
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
}

function descartar() {
  trabajador?.terminate();
  trabajador = null;
  trabajadorListo = null;
}

/** Stops the running simulation (if any). */
export function detener(): void {
  if (!actual) return;
  const a = actual;
  actual = null;
  clearTimeout(a.limite);
  descartar();
  motor.fase = 'inactivo';
  a.rechazar(new SimulacionCancelada());
}

/** Runs a netlist. Rejects with SimulacionCancelada if another run replaces it or it is stopped. */
export async function simularTexto(texto: string): Promise<Simulacion> {
  // Application log (0.10): every run with its title, time and outcome, so a report from the tablet says what was
  // simulated and what came out (superseded runs are not errors).
  const titulo = (texto.split('\n').find((l) => l.trim()) ?? '').replace(/^\*\s*/, '').slice(0, 80);
  const t0 = performance.now();
  try {
    const r = await simularTextoSinRegistro(texto);
    const errores = r.salida.errores ?? [];
    registrar(
      errores.length || r.ejecucion.fallo ? 'aviso' : 'info',
      'simulador',
      `«${titulo}»: ${Math.round(performance.now() - t0)} ms${errores.length ? `; ${errores.length} errores de ngspice: ${errores.slice(0, 2).join(' · ')}` : ''}${r.ejecucion.fallo ? `; fallo: ${String(r.ejecucion.fallo)}` : ''}`,
    );
    return r;
  } catch (e) {
    if (!(e instanceof SimulacionCancelada)) registrar('error', 'simulador', `«${titulo}»: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
}

async function simularTextoSinRegistro(texto: string): Promise<Simulacion> {
  detener();
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
