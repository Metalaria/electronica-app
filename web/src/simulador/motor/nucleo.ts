// ngspice driver: runs one netlist in a fresh ngspice instance and returns its printed output and every plot.
//
// The Emscripten build (eecircuit-engine) runs ngspice's interactive front end. ngspice asks for each command
// line through `window.prompt` (our `getInput`) and, before each prompt, calls `handleThings`, where the driver
// may suspend the WebAssembly stack (Asyncify) until there is more work. One run is:
//
//   source /test.cir         loads the circuit and executes its .control block, as `ngspice -b` does
//   run                      only when there is no .control block (batch mode runs the dot analyses then)
//   echo $plots              lists the plots the run created (tran1, ac1, op1, …)
//   setplot X / write X.raw  dumps every plot to a binary raw file, read back with leerRaw()
//
// Every run uses a new instance (≈ 40 ms from the compiled module): no state leaks from one netlist to the next
// (variables set with `set`, circuits, plots), and a run that never ends is cancelled by dropping the instance
// (or the Web Worker that hosts it). This module has no DOM dependency: it runs in a Web Worker and in Node.

import crearModulo from './ngspice.js';
import type { ModuloNgspice } from './ngspice.js';

export interface Vector {
  nombre: string;
  /** ngspice type: voltage, current, time, frequency, notype, … */
  tipo: string;
  re: Float64Array;
  /** Imaginary part (complex plots only). */
  im: Float64Array | null;
  /** Length-1 vector (created by meas or let): only re[0] is meaningful. */
  escalar: boolean;
}

export interface Grafica {
  /** Plot name in ngspice: tran1, ac2, op1, … */
  id: string;
  /** Analysis description written by ngspice: «Transient Analysis», «AC Analysis», … */
  analisis: string;
  complejo: boolean;
  puntos: number;
  /** All vectors; the first one is the scale (time, frequency, sweep). */
  vectores: Vector[];
}

export interface Ejecucion {
  /** Everything ngspice printed (stdout and stderr, in order), without prompts. */
  salida: string;
  graficas: Grafica[];
  /** Milliseconds of the run (without creating the instance). */
  ms: number;
  /** Set when the instance aborted (internal ngspice error) or the netlist made it exit. */
  fallo: string | null;
}

export interface OpcionesEjecucion {
  /** The netlist has a .control block: do not add `run` (as in batch mode). */
  control: boolean;
  /** Receives each printed line as it is produced (progress). */
  alImprimir?: (linea: string) => void;
}

const PROMPT = /^(?:ngspice \d+ -> )+/;
const RUIDO_INTERNO = /^fopen\("\/proc\/meminfo"\)/;

/** Compiles the WebAssembly binary (fetching is the caller's job). */
export function compilar(bytes: BufferSource): Promise<WebAssembly.Module> {
  return WebAssembly.compile(bytes);
}

/** Runs a netlist in a new ngspice instance. Never rejects for simulation errors: they are in `salida`. */
export async function ejecutar(
  modulo: WebAssembly.Module,
  netlist: string,
  op: OpcionesEjecucion,
): Promise<Ejecucion> {
  const lineas: string[] = [];
  // Output of the driver's own commands (echo $plots, write) is captured apart, not shown.
  let capturaPropia: string[] | null = null;
  let fallo: string | null = null;

  const imprimir = (t = '') => {
    for (const bruta of String(t).split('\n')) {
      const l = bruta.replace(PROMPT, '');
      if (RUIDO_INTERNO.test(l)) continue;
      if (capturaPropia) {
        capturaPropia.push(l);
        continue;
      }
      lineas.push(l);
      op.alImprimir?.(l);
    }
  };

  // --- command sequence (state machine fed by getInput) ---
  const graficasPedidas: string[] = [];
  let fase: 'inicio' | 'source' | 'run' | 'plots' | 'volcar' | 'fin' = 'inicio';
  let pendientes: string[] = [];

  const siguiente = (): string | null => {
    for (;;) {
      if (pendientes.length) return pendientes.shift()!;
      switch (fase) {
        case 'inicio':
          // The first line read after start-up is swallowed by the front end: send a blank one.
          fase = 'source';
          pendientes = [' ', 'source /test.cir'];
          continue;
        case 'source':
          fase = 'run';
          if (!op.control) pendientes = ['run'];
          continue;
        case 'run':
          fase = 'plots';
          capturaPropia = [];
          pendientes = ['set filetype=binary', 'unset appendwrite', 'echo @@PLOTS@@ $plots'];
          continue;
        case 'plots': {
          const linea = (capturaPropia ?? []).find((l) => l.startsWith('@@PLOTS@@')) ?? '';
          for (const p of linea.replace('@@PLOTS@@', '').trim().split(/\s+/)) {
            if (p && p !== 'const' && /^[\w.-]+$/.test(p)) graficasPedidas.push(p);
          }
          fase = 'volcar';
          pendientes = graficasPedidas.flatMap((p) => [`setplot ${p}`, `write /raw/${p}.raw`]);
          continue;
        }
        case 'volcar':
          fase = 'fin';
          return null;
        case 'fin':
          return null;
      }
    }
  };

  let terminar: (() => void) | null = null;
  const terminado = new Promise<void>((r) => (terminar = r));
  const acabar = () => {
    const t = terminar;
    terminar = null;
    t?.();
  };

  let M: ModuloNgspice | null = null;
  let t0 = 0;

  M = await crearModulo({
    noInitialRun: true,
    print: imprimir,
    printErr: imprimir,
    instantiateWasm(imports, listo) {
      WebAssembly.instantiate(modulo, imports).then(listo, (e: unknown) => {
        fallo = `No se pudo iniciar ngspice: ${String(e)}`;
        acabar();
      });
      return {};
    },
    onAbort(motivo) {
      fallo = `ngspice se detuvo por un error interno (${String(motivo)}).`;
      acabar();
    },
    onExit(codigo) {
      fallo = `ngspice terminó (código ${codigo}) antes de acabar la simulación.`;
      acabar();
    },
  });

  const mod = M;
  mod.FS.writeFile('/proc/meminfo', 'MemTotal: 2097152 kB\nMemFree: 2097152 kB\nMemAvailable: 2097152 kB\n');
  mod.FS.writeFile('/spinit', '* ngspice init file (empty)\n');
  mod.FS.mkdir('/raw');
  mod.FS.writeFile('/test.cir', netlist);

  // handleThings is also called while a .control block runs, so it only checks whether the sequence is over;
  // the sequence advances in getInput, when ngspice really asks for the next command.
  let acabados = false;
  mod.setHandleThings(() => {
    mod.Asyncify.handleAsync(async () => {
      if (acabados) {
        // Report, and keep this instance suspended for ever (it is dropped).
        acabar();
        await new Promise<void>(() => {});
      }
    });
  });
  mod.setGetInput(() => {
    const c = siguiente();
    if (c === null) {
      acabados = true;
      return ' ';
    }
    return c;
  });

  t0 = Date.now();
  try {
    mod.runThings();
  } catch (e) {
    fallo ??= `ngspice se detuvo: ${String(e)}`;
    acabar();
  }
  await terminado;
  const ms = Date.now() - t0;

  // Read the plots back.
  const graficas: Grafica[] = [];
  if (!fallo) {
    for (const id of graficasPedidas) {
      let bytes: Uint8Array;
      try {
        bytes = mod.FS.readFile(`/raw/${id}.raw`);
      } catch {
        continue;
      }
      for (const g of leerRaw(bytes)) graficas.push({ ...g, id });
    }
  }
  // Drop trailing blank lines.
  while (lineas.length && !lineas[lineas.length - 1]!.trim()) lineas.pop();
  return { salida: lineas.join('\n'), graficas, ms, fallo };
}

// ------------------------------------------------------------------ raw files

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8');

function buscar(bytes: Uint8Array, patron: Uint8Array, desde: number): number {
  const n = patron.length;
  const p0 = patron[0];
  fuera: for (let i = desde; i <= bytes.length - n; i++) {
    if (bytes[i] !== p0) continue;
    for (let k = 1; k < n; k++) if (bytes[i + k] !== patron[k]) continue fuera;
    return i;
  }
  return -1;
}

const BINARY = enc.encode('Binary:\n');
const VALUES = enc.encode('Values:\n');

/**
 * Reads an ngspice raw file (binary or ASCII; one or several plots appended). The header is located by bytes,
 * not by decoded characters, so titles with accents or «» do not shift the data.
 */
export function leerRaw(bytes: Uint8Array): Omit<Grafica, 'id'>[] {
  const res: Omit<Grafica, 'id'>[] = [];
  let pos = 0;
  while (pos < bytes.length) {
    const b = buscar(bytes, BINARY, pos);
    const a = buscar(bytes, VALUES, pos);
    const binario = b >= 0 && (a < 0 || b < a);
    const marca = binario ? b : a;
    if (marca < 0) break;
    const cab = dec.decode(bytes.subarray(pos, marca)).split('\n');
    const campo = (k: string) => cab.find((l) => l.startsWith(k))?.slice(k.length).trim() ?? '';
    const analisis = campo('Plotname:');
    const complejo = /complex/i.test(campo('Flags:'));
    const nv = parseInt(campo('No. Variables:'), 10);
    const np = parseInt(campo('No. Points:'), 10);
    const iv = cab.findIndex((l) => l.startsWith('Variables:'));
    if (!(nv > 0) || !(np >= 0) || iv < 0) break;
    const vars = cab.slice(iv + 1, iv + 1 + nv).map((l) => {
      const t = l.trim().split(/\s+/);
      return { nombre: t[1] ?? '?', tipo: t[2] ?? 'notype', escalar: /dims=1\b/.test(l) };
    });
    const vectores: Vector[] = vars.map((v) => ({
      nombre: v.nombre,
      tipo: v.tipo,
      re: new Float64Array(np),
      im: complejo ? new Float64Array(np) : null,
      escalar: v.escalar,
    }));
    const por = complejo ? 2 : 1;
    if (binario) {
      const ini = marca + BINARY.length;
      const largo = np * nv * por * 8;
      if (ini + largo > bytes.length) break;
      // Copy to an aligned buffer (the header length is arbitrary).
      const datos = new Float64Array(bytes.slice(ini, ini + largo).buffer);
      let k = 0;
      for (let p = 0; p < np; p++) {
        for (let v = 0; v < nv; v++) {
          const vec = vectores[v]!;
          vec.re[p] = datos[k++]!;
          if (vec.im) vec.im[p] = datos[k++]!;
        }
      }
      pos = ini + largo;
    } else {
      // ASCII: «index\tvalue» then one value per line («re,im» for complex).
      let fin = buscar(bytes, enc.encode('\nTitle:'), marca);
      if (fin < 0) fin = bytes.length;
      const nums = dec
        .decode(bytes.subarray(marca + VALUES.length, fin))
        .split(/\s+/)
        .filter(Boolean);
      let k = 0;
      for (let p = 0; p < np; p++) {
        k++; // point index
        for (let v = 0; v < nv; v++) {
          const [r = 'NaN', i = '0'] = (nums[k++] ?? 'NaN').split(',');
          const vec = vectores[v]!;
          vec.re[p] = parseFloat(r);
          if (vec.im) vec.im[p] = parseFloat(i);
        }
      }
      pos = fin + 1;
    }
    res.push({ analisis, complejo, puntos: np, vectores });
  }
  return res;
}
