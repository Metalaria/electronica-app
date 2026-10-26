// The two WebAssembly builds of ngspice the app can run. Both are ngspice 45.2 driven the same way (the
// Asyncify hooks of eecircuit-engine, see nucleo.ts); they differ in XSPICE:
//
//   xspice     built by web/scripts/ngspice-wasm/compilar.sh, with XSPICE and every standard code-model
//              library linked in (digital gates, flip-flops, ADC/DAC bridges, analog code models…).
//              Committed in web/vendor/ngspice-xspice/; copied by scripts/ngspice.mjs.
//   eecircuit  the one of the npm package eecircuit-engine 1.8.0 (no XSPICE): the engine up to 0.7, kept as
//              a fallback during 0.8. Extracted from node_modules by scripts/ngspice.mjs.
//
// MOTOR_PREDETERMINADO chooses; localStorage «epa:motor-spice» = 'eecircuit' | 'xspice' overrides it on one
// device (for comparisons). If the chosen engine cannot be loaded, the client falls back to the other one.

export type IdMotor = 'xspice' | 'eecircuit';

export const MOTOR_PREDETERMINADO: IdMotor = 'xspice';

export interface DescripcionMotor {
  /** Path of the binary under the site root (public/). */
  wasm: string;
  nombre: string;
  /** Runs XSPICE code models (A devices). */
  xspice: boolean;
}

export const MOTORES: Record<IdMotor, DescripcionMotor> = {
  xspice: { wasm: 'ngspice/ngspice-xspice.wasm', nombre: 'ngspice 45.2 con XSPICE', xspice: true },
  eecircuit: { wasm: 'ngspice/ngspice.wasm', nombre: 'ngspice 45.2 (eecircuit-engine 1.8.0)', xspice: false },
};

export const CLAVE_MOTOR = 'epa:motor-spice';

export function esIdMotor(x: unknown): x is IdMotor {
  return x === 'xspice' || x === 'eecircuit';
}

/** The engine to load on this device: the local override, if any, or MOTOR_PREDETERMINADO. */
export function motorElegido(): IdMotor {
  try {
    const v = globalThis.localStorage?.getItem(CLAVE_MOTOR);
    if (esIdMotor(v)) return v;
  } catch {
    /* no storage (private mode, Node): the default */
  }
  return MOTOR_PREDETERMINADO;
}

/** The other engine (fallback when the chosen one cannot be loaded). */
export function otroMotor(id: IdMotor): IdMotor {
  return id === 'xspice' ? 'eecircuit' : 'xspice';
}
