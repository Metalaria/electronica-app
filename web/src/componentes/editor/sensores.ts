// Resistance of the sensors of the palette from their parameter (light, temperature), as written to the
// netlist: the light-dependent resistor and the NTC and PTC thermistors are plain resistors whose value the
// editor computes, so the knob of the results view and the parameter sweep only change one number.

import type { Componente } from './tipos.ts';
import { leerValor } from './valores.ts';

function num(c: Componente, campo: string, unidad: string): number | null {
  const l = leerValor(c.campos[campo] ?? '', unidad);
  return l.ok && l.v != null && Number.isFinite(l.v) ? l.v : null;
}

/**
 * LDR: R = R₁₀ · (E / 10 lx)^(−γ), never above the dark resistance. A typical GL5528: R₁₀ ≈ 20 kΩ, γ ≈ 0,7,
 * dark ≥ 1 MΩ.
 */
export function resistenciaLdr(c: Componente): number | null {
  const r10 = num(c, 'r10', 'Ω');
  const g = num(c, 'gamma', '');
  const e = num(c, 'luz', 'lx');
  const osc = num(c, 'rosc', 'Ω') ?? 1e6;
  if (r10 == null || g == null || e == null || r10 <= 0 || e < 0) return null;
  const r = e <= 0 ? Infinity : r10 * Math.pow(e / 10, -g);
  return Math.min(r, osc);
}

/** NTC: R = R₂₅ · exp(β · (1/T − 1/298,15 K)). */
export function resistenciaNtc(c: Componente): number | null {
  const r25 = num(c, 'r25', 'Ω');
  const b = num(c, 'beta', '');
  const t = num(c, 'temp', '°C');
  if (r25 == null || b == null || t == null || r25 <= 0 || t <= -273.15) return null;
  return r25 * Math.exp(b * (1 / (t + 273.15) - 1 / 298.15));
}

/**
 * Switching PTC (ceramic): R = R₂₅ · (1 + e^(0,2·(T − Tref))) / (1 + e^(0,2·(25 − Tref))): R₂₅ at 25 °C, about
 * twice that at the reference (switching) temperature and fifty times 20 °C above it.
 */
export function resistenciaPtc(c: Componente): number | null {
  const r25 = num(c, 'r25', 'Ω');
  const tr = num(c, 'tref', '°C');
  const t = num(c, 'temp', '°C');
  if (r25 == null || tr == null || t == null || r25 <= 0) return null;
  return (r25 * (1 + Math.exp(0.2 * (t - tr)))) / (1 + Math.exp(0.2 * (25 - tr)));
}

/** The resistance of a sensor part (null when a field is wrong; not a sensor: undefined). */
export function resistenciaSensor(c: Componente): number | null | undefined {
  if (c.tipo === 'LDR') return resistenciaLdr(c);
  if (c.tipo === 'NTC') return resistenciaNtc(c);
  if (c.tipo === 'PTC') return resistenciaPtc(c);
  return undefined;
}

/** A number for SPICE with 6 significant digits. */
export function numeroSpiceCorto(v: number): string {
  return Number(v.toPrecision(6)).toString();
}
