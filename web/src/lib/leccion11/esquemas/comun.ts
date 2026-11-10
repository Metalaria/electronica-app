// 1.1 lessons: helpers the schematic definitions share — numbers for a netlist, and the simulator's devices for the
// book's non-linear models. Pure.
//
// The book's diode models (sección 5.3): ideal, constant drop (0,7 V; 0,3 V Schottky; 2,0 V a red LED), piecewise
// linear, and Shockley's equation I = IS·(e^(V/(n·VT)) − 1) with VT = 25,85 mV. A lesson writes the model it teaches;
// the simulator always uses a real exponential device:
//   - with the Shockley pieces (is, n, and vt if given) it is exactly that equation, at the temperature that gives that
//     VT (T = VT·q/k), so the check is as tight as for a resistor;
//   - with a constant drop it is a diode that drops exactly that voltage at a reference current (10 mA a diode, 20 mA a
//     LED with n = 2, 1 mA a transistor's base), and the readings are allowed the drop's deviation times their
//     sensitivity to it (tipos.ts NoLineal; the deviations and their reasons are in each definition).

/** A positive number for a netlist (ngspice rejects 0 Ω and 0 F: a tiny value stands for «nothing»). */
export const ng = (v: number): string => (v > 0 ? v.toPrecision(10) : '1e-9');
/** Any number, signs included. */
export const num = (v: number): string => (Number.isFinite(v) ? Number(v.toPrecision(10)).toString() : '0');

const K_B = 1.380649e-23;
const Q_E = 1.602176634e-19;
/** VT at 300 K (26,85 °C): 25,85 mV, the book's value. */
export const VT_LIBRO = (K_B * 300) / Q_E;

/** «.options» that set the simulator's temperature to the one that gives this VT (default the book's 25,85 mV). */
export function temperatura(vt = VT_LIBRO): string {
  const t = (vt * Q_E) / K_B - 273.15;
  return `.options temp=${num(t)} tnom=${num(t)}`;
}

/** Saturation current of a diode that drops `v` at `i` with ideality n (at the book's VT). */
export function isCalibrada(v: number, i: number, n = 1): number {
  return i / Math.expm1(v / (n * VT_LIBRO));
}

/** A diode model for a constant drop `v` (exact at the reference current). */
export function diodoCaida(nombre: string, v: number, iRef = 10e-3, n = 1): string {
  return `.model ${nombre} D(IS=${isCalibrada(Math.max(v, 0.05), iRef, n).toPrecision(8)} N=${num(n)})`;
}

/** A diode model from the Shockley pieces. */
export function diodoShockley(nombre: string, is: number, n: number): string {
  return `.model ${nombre} D(IS=${is.toPrecision(10)} N=${num(n)})`;
}

/**
 * A Zener at VZ (and rz, its dynamic resistance, if the lesson uses it): breakdown at VZ at 5 mA, n = 1, so between
 * 0,1 mA and 250 mA the voltage stays within VZ + I·rz ± 0,1 V (sección 5.8 gives rz from 5 to 20 mA).
 */
export function zener(nombre: string, vz: number, rz: number): string {
  return `.model ${nombre} D(IS=1e-14 N=1 BV=${num(vz)} IBV=5e-3 NBV=1 RS=${rz > 0 ? num(rz) : '0'})`;
}

/** An NPN transistor with the lesson's β and a VBE of `vbe` at 1 mA (no Early effect: sección 6.9 is apart). */
export function npn(nombre: string, beta: number, vbe: number): string {
  return `.model ${nombre} NPN(BF=${num(beta)} BR=1 IS=${isCalibrada(Math.max(vbe, 0.3), 1e-3).toPrecision(8)})`;
}
