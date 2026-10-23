// Physical dimensions of the calculators' units, to show intermediate results of «Paso a paso» with their unit
// (Ω · F = s, 1/s = Hz, V/Ω = A…). Base: volt, ampere, second, metre, kelvin. Plain TypeScript.

export type Dim = readonly [number, number, number, number, number];

const D = (v: number, a: number, s: number, m: number, k: number): Dim => [v, a, s, m, k];
export const ADIMENSIONAL: Dim = D(0, 0, 0, 0, 0);

/** Units of the catalogue that have a clean dimension (others — h, Ah, eV, cm⁻³, rpm… — are left unknown). */
const UNIDADES: Record<string, Dim> = {
  V: D(1, 0, 0, 0, 0),
  A: D(0, 1, 0, 0, 0),
  'Ω': D(1, -1, 0, 0, 0),
  'Ω/sq': D(1, -1, 0, 0, 0),
  S: D(-1, 1, 0, 0, 0),
  F: D(-1, 1, 1, 0, 0),
  H: D(1, -1, 1, 0, 0),
  s: D(0, 0, 1, 0, 0),
  Hz: D(0, 0, -1, 0, 0),
  'rad/s': D(0, 0, -1, 0, 0),
  'bit/s': D(0, 0, -1, 0, 0),
  W: D(1, 1, 0, 0, 0),
  VA: D(1, 1, 0, 0, 0),
  VAr: D(1, 1, 0, 0, 0),
  J: D(1, 1, 1, 0, 0),
  C: D(0, 1, 1, 0, 0),
  m: D(0, 0, 0, 1, 0),
  'm²': D(0, 0, 0, 2, 0),
  'm/s': D(0, 0, -1, 1, 0),
  'm²/s': D(0, 0, -1, 2, 0),
  'V/s': D(1, 0, -1, 0, 0),
  'A/s': D(0, 1, -1, 0, 0),
  'Ω·m': D(1, -1, 0, 1, 0),
  K: D(0, 0, 0, 0, 1),
  '°C': D(0, 0, 0, 0, 1),
  T: D(1, 0, 1, -2, 0),
  'V/m': D(1, 0, 0, -1, 0),
  'V/√Hz': D(1, 0, 0.5, 0, 0),
  'A/√Hz': D(0, 1, 0.5, 0, 0),
  'H/m': D(1, -1, 1, -1, 0),
  'F/m': D(-1, 1, 1, -1, 0),
  'A/V²': D(-2, 1, 0, 0, 0),
  'V/K': D(1, 0, 0, 0, -1),
  '1/°C': D(0, 0, 0, 0, -1),
  'ppm/°C': D(0, 0, 0, 0, -1),
  '°C/W': D(-1, -1, 0, 0, 1),
  'K/W': D(-1, -1, 0, 0, 1),
  'W/(m·K)': D(1, 1, 0, -1, -1),
  'V·s/rad': D(1, 0, 1, 0, 0),
  'N·m': D(1, 1, 1, 0, 0),
  'N·m/A': D(1, 0, 1, 0, 0),
  's/m': D(0, 0, 1, -1, 0),
  // dimensionless
  '': ADIMENSIONAL,
  '%': ADIMENSIONAL,
  dB: ADIMENSIONAL,
  dBm: ADIMENSIONAL,
  dBi: ADIMENSIONAL,
  dBc: ADIMENSIONAL,
  '°': ADIMENSIONAL,
  rad: ADIMENSIONAL,
  bit: ADIMENSIONAL,
  'V/V': ADIMENSIONAL,
  'A/A': ADIMENSIONAL,
  espiras: ADIMENSIONAL,
  ciclos: ADIMENSIONAL,
  veces: ADIMENSIONAL,
  LSB: ADIMENSIONAL,
  ppm: ADIMENSIONAL,
};

export const DIM_CONSTANTES: Record<string, Dim> = {
  pi: ADIMENSIONAL,
  k_B: D(1, 1, 1, 0, -1),
  q_e: D(0, 1, 1, 0, 0),
  c_0: D(0, 0, -1, 1, 0),
  mu_0: D(1, -1, 1, -1, 0),
  eps_0: D(-1, 1, 1, -1, 0),
  h_P: D(1, 1, 2, 0, 0),
};

/** Unit names used to show an intermediate value, in order of preference. */
const NOMBRES: [string, Dim][] = [
  ['V', UNIDADES.V!], ['A', UNIDADES.A!], ['Ω', UNIDADES['Ω']!], ['S', UNIDADES.S!], ['F', UNIDADES.F!],
  ['H', UNIDADES.H!], ['s', UNIDADES.s!], ['Hz', UNIDADES.Hz!], ['W', UNIDADES.W!], ['J', UNIDADES.J!],
  ['C', UNIDADES.C!], ['m', UNIDADES.m!], ['m²', UNIDADES['m²']!], ['m/s', UNIDADES['m/s']!],
  ['V/s', UNIDADES['V/s']!], ['A/s', UNIDADES['A/s']!], ['V·s', UNIDADES['V·s/rad']!], ['K', UNIDADES.K!],
  ['Ω·m', UNIDADES['Ω·m']!], ['V/m', UNIDADES['V/m']!], ['K/W', UNIDADES['K/W']!],
];

export function dimDe(unidad: string): Dim | null {
  return UNIDADES[unidad] ?? null;
}

export function iguales(a: Dim, b: Dim): boolean {
  for (let i = 0; i < 5; i++) if (Math.abs((a[i] as number) - (b[i] as number)) > 1e-9) return false;
  return true;
}

export function producto(a: Dim, b: Dim, k = 1): Dim {
  return a.map((x, i) => x + k * (b[i] as number)) as unknown as Dim;
}

export function potencia(a: Dim, k: number): Dim {
  return a.map((x) => x * k) as unknown as Dim;
}

export function esAdimensional(a: Dim): boolean {
  return iguales(a, ADIMENSIONAL);
}

/**
 * Name of a dimension for display: «Ω», «Hz»…, '' when dimensionless, null when it has no simple name.
 * `celsius`: temperatures of a formula written in °C are shown in °C.
 */
export function nombreDim(a: Dim, celsius = false): string | null {
  if (esAdimensional(a)) return '';
  for (const [n, d] of NOMBRES) if (iguales(a, d)) return celsius && n.startsWith('K') ? '°C' + n.slice(1) : n;
  return null;
}
