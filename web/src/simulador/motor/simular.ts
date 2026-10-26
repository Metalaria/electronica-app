// One simulation as the app understands it: prepare the netlist, run it, read the output, and retry with the
// KLU solver when the default one gives up. Shared by the Web Worker and the build-time validator.
//
// Solver: this WebAssembly ngspice starts with SPARSE 1.3, which gives the same numbers as native ngspice
// (KLU) on almost every netlist of the book; its KLU, however, breaks .noise and some .ac results. A few
// switching circuits abort with «Timestep too small» under SPARSE and run fine under KLU, so only those are
// retried with `.options klu` (unless the netlist chooses a solver itself).

import { ejecutar, type Ejecucion } from './nucleo.ts';
import { prepararParaMotor } from './netlist.ts';
import { analizarSalida, type SalidaAnalizada } from './salida.ts';
import type { IdMotor } from './motores.ts';

export interface Simulacion {
  ejecucion: Ejecucion;
  salida: SalidaAnalizada;
  control: boolean;
  /** Commands of the .control block that were not run (quit, plot…). */
  anulados: string[];
  /** The run was repeated with the KLU solver after the default one aborted. */
  conKlu: boolean;
}

const ABORTO = /timestep too small|simulation\(s\) aborted/i;

export async function simular(
  modulo: WebAssembly.Module,
  texto: string,
  alImprimir?: (linea: string) => void,
  motor?: IdMotor,
): Promise<Simulacion> {
  const prep = prepararParaMotor(texto);
  const ejecucion = await ejecutar(modulo, prep.texto, { control: prep.control, alImprimir, motor });
  const salida = analizarSalida(ejecucion.salida);
  const base: Simulacion = { ejecucion, salida, control: prep.control, anulados: prep.anulados, conKlu: false };
  const eligeResolvedor = /^\s*\.options?\b.*\b(klu|sparse)\b/im.test(texto);
  if (ejecucion.fallo || eligeResolvedor || !salida.errores.some((e) => ABORTO.test(e))) return base;

  alImprimir?.('');
  alImprimir?.('*** El análisis no converge con el resolvedor SPARSE: se repite con KLU ***');
  const prep2 = prepararParaMotor(texto, { klu: true });
  const ej2 = await ejecutar(modulo, prep2.texto, { control: prep2.control, alImprimir, motor });
  const sal2 = analizarSalida(ej2.salida);
  if (ej2.fallo || sal2.errores.some((e) => ABORTO.test(e))) return base;
  return { ejecucion: ej2, salida: sal2, control: prep2.control, anulados: prep2.anulados, conKlu: true };
}
