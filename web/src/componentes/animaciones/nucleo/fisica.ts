// Device equations used by the animations, with the book's numbers as defaults.

export const Q = 1.602176634e-19; // C
export const KB = 1.380649e-23; // J/K
export const EPS0 = 8.8541878128e-12; // F/m
export const MU0 = 4e-7 * Math.PI; // H/m
export const NI_SI = 1e10; // cm⁻³ at 300 K (book, 5.2)
export const EPS_SI = 11.7 * EPS0;
export const T0 = 273.15;

/** Thermal voltage kT/q (25,85 mV at 300 K). */
export function vt(tk = 300): number {
  return (KB * tk) / Q;
}

// ------------------------------------------------------------------ PN junction (5.2, 5.3)

/** Built-in potential V₀ = V_T·ln(N_A·N_D/n_i²), concentrations in cm⁻³. */
export function v0(na: number, nd: number, tk = 300): number {
  return vt(tk) * Math.log((na * nd) / (NI_SI * NI_SI));
}

/**
 * Depletion width (m) and its split into the P and N sides for a junction voltage V (forward positive):
 * W = √(2ε_s/q·(1/N_A + 1/N_D)·(V₀ − V)).
 */
export function agotamiento(na: number, nd: number, v: number, tk = 300): { w: number; xp: number; xn: number; emax: number } {
  const nam = na * 1e6;
  const ndm = nd * 1e6;
  const barrera = Math.max(0.02, v0(na, nd, tk) - v);
  const w = Math.sqrt(((2 * EPS_SI) / Q) * (1 / nam + 1 / ndm) * barrera);
  const xn = (w * nam) / (nam + ndm);
  const xp = w - xn;
  const emax = (2 * barrera) / w;
  return { w, xp, xn, emax };
}

/** Shockley: I = I_S·(e^(V/(n·V_T)) − 1). */
export function shockley(v: number, is = 1e-12, n = 1, tk = 300): number {
  return is * (Math.exp(Math.min(v / (n * vt(tk)), 80)) - 1);
}

/** Inverse of Shockley for forward currents: V = n·V_T·ln(I/I_S + 1). */
export function vDiodo(i: number, is = 1e-12, n = 1, tk = 300): number {
  return n * vt(tk) * Math.log(Math.max(i, 0) / is + 1);
}

/**
 * Diode with series resistance and reverse breakdown (avalanche or Zener), for traced I-V curves.
 * Reverse breakdown modelled as an exponential knee of slope set by r_z.
 */
export function diodoCompleto(
  v: number,
  p: { is: number; n: number; vbr: number; rz?: number; rs?: number; tk?: number },
): number {
  const tk = p.tk ?? 300;
  const rs = p.rs ?? 0;
  const rz = p.rz ?? 1;
  // Breakdown current: grows quickly once −V exceeds V_BR.
  const ruptura = (vv: number) => {
    const x = -vv - p.vbr;
    if (x <= 0) return -1e-12 * Math.exp(x / 0.05) * 1e3;
    return -(x / rz + 1e-9);
  };
  if (rs <= 0) return shockley(v, p.is, p.n, tk) + ruptura(v);
  // Solve I = f(V − I·Rs) by bisection on I.
  const f = (i: number) => shockley(v - i * rs, p.is, p.n, tk) + ruptura(v - i * rs) - i;
  let lo = -10;
  let hi = 10;
  for (let k = 0; k < 60; k++) {
    const m = (lo + hi) / 2;
    if (f(m) > 0) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

// ------------------------------------------------------------------ BJT (6.2)

export interface ParamBJT {
  is: number;
  betaF: number;
  betaR: number;
  va: number;
  tk?: number;
}

export const BJT_LIBRO: ParamBJT = { is: 1e-14, betaF: 100, betaR: 2, va: 100 };

/**
 * Simplified Ebers-Moll (transport form) with the Early effect on the transport current, NPN signs:
 *   I_T = I_S·(e^(V_BE/V_T) − e^(V_BC/V_T))·(1 + V_CE/V_A)
 *   I_C = I_T − (I_S/β_R)·(e^(V_BC/V_T) − 1)
 *   I_B = (I_S/β_F)·(e^(V_BE/V_T) − 1) + (I_S/β_R)·(e^(V_BC/V_T) − 1)
 */
export function ebersMoll(vbe: number, vce: number, p: ParamBJT = BJT_LIBRO): { ic: number; ib: number } {
  const t = vt(p.tk ?? 300);
  const vbc = vbe - vce;
  const eBE = Math.exp(Math.min(vbe / t, 80));
  const eBC = Math.exp(Math.min(vbc / t, 80));
  const it = p.is * (eBE - eBC) * (1 + Math.max(vce, 0) / p.va);
  const ic = it - (p.is / p.betaR) * (eBC - 1);
  const ib = (p.is / p.betaF) * (eBE - 1) + (p.is / p.betaR) * (eBC - 1);
  return { ic, ib };
}

/** Collector current for a given base current and V_CE (solves V_BE by bisection). */
export function icDeIb(ib: number, vce: number, p: ParamBJT = BJT_LIBRO): { ic: number; vbe: number } {
  if (ib <= 0) return { ic: 0, vbe: 0 };
  let lo = -0.2;
  let hi = 1.2;
  for (let k = 0; k < 60; k++) {
    const m = (lo + hi) / 2;
    if (ebersMoll(m, vce, p).ib > ib) hi = m;
    else lo = m;
  }
  const vbe = (lo + hi) / 2;
  return { ic: ebersMoll(vbe, vce, p).ic, vbe };
}

/**
 * Operating point of a common-emitter stage with base resistor: V_BB through R_B, V_CC through R_C.
 * Solves the two nonlinear loop equations by nested bisection.
 */
export function puntoBJT(
  vbb: number,
  rb: number,
  vcc: number,
  rc: number,
  p: ParamBJT = BJT_LIBRO,
): { ib: number; ic: number; vbe: number; vce: number } {
  // For a given V_BE, I_B is fixed by the base loop; then V_CE solves V_CE = V_CC − I_C·R_C.
  const vceDe = (vbe: number) => {
    let lo = 0;
    let hi = vcc;
    for (let k = 0; k < 50; k++) {
      const m = (lo + hi) / 2;
      const { ic } = ebersMoll(vbe, m, p);
      if (vcc - ic * rc > m) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  };
  let lo = 0;
  let hi = Math.min(Math.max(vbb, 0.01), 1.0);
  if (vbb <= 0) return { ib: 0, ic: 0, vbe: vbb, vce: vcc };
  for (let k = 0; k < 50; k++) {
    const vbe = (lo + hi) / 2;
    const vce = vceDe(vbe);
    const { ib } = ebersMoll(vbe, vce, p);
    if ((vbb - vbe) / rb > ib) lo = vbe;
    else hi = vbe;
  }
  const vbe = (lo + hi) / 2;
  const vce = vceDe(vbe);
  const { ic, ib } = ebersMoll(vbe, vce, p);
  return { ib, ic, vbe, vce };
}

// ------------------------------------------------------------------ MOSFET (7.2)

export interface ParamMOS {
  /** Transconductance parameter k (A/V²), I_D = ½·k·V_ov² in saturation. */
  k: number;
  vth: number;
  lambda: number;
}

export const MOS_LIBRO: ParamMOS = { k: 0.5, vth: 2, lambda: 0.02 };

export type RegionMOS = 'corte' | 'ohmica' | 'saturacion';

/** Square law with channel-length modulation λ (N channel; V_DS ≥ 0). */
export function mosfet(vgs: number, vds: number, p: ParamMOS = MOS_LIBRO): { id: number; region: RegionMOS } {
  const vov = vgs - p.vth;
  if (vov <= 0) return { id: 0, region: 'corte' };
  const v = Math.max(0, vds);
  const m = 1 + p.lambda * v;
  if (v < vov) return { id: p.k * (vov * v - (v * v) / 2) * m, region: 'ohmica' };
  return { id: 0.5 * p.k * vov * vov * m, region: 'saturacion' };
}

/** Operating point with a drain resistor from V_DD: solves V_DS = V_DD − I_D·R_D. */
export function puntoMOS(vgs: number, vdd: number, rd: number, p: ParamMOS = MOS_LIBRO): { id: number; vds: number; region: RegionMOS } {
  let lo = 0;
  let hi = vdd;
  for (let k = 0; k < 60; k++) {
    const m = (lo + hi) / 2;
    if (vdd - mosfet(vgs, m, p).id * rd > m) lo = m;
    else hi = m;
  }
  const vds = (lo + hi) / 2;
  const r = mosfet(vgs, vds, p);
  return { id: r.id, vds, region: r.region };
}

// ------------------------------------------------------------------ passive components

/** NTC: R(T) = R₂₅·e^(B·(1/T − 1/298,15 K)). */
export function ntc(tc: number, r25 = 10e3, b = 3950): number {
  return r25 * Math.exp(b * (1 / (tc + T0) - 1 / 298.15));
}

/**
 * Switching PTC (ceramic, BaTiO₃): slightly NTC below the switch temperature, then the resistance rises by
 * orders of magnitude over a few tens of degrees.
 */
export function ptc(tc: number, r25 = 100, tsw = 120): number {
  const base = r25 * Math.exp(-0.004 * (tc - 25));
  const sube = Math.exp(Math.max(0, tc - tsw) * 0.16);
  return base * Math.min(sube, 1e5);
}

/** LDR (CdS): R = R₁₀·(E/10 lx)^(−γ), with a dark resistance as ceiling. */
export function ldr(lux: number, r10 = 20e3, gamma = 0.7, oscuridad = 1e6): number {
  const r = r10 * Math.pow(Math.max(lux, 1e-3) / 10, -gamma);
  return 1 / (1 / r + 1 / oscuridad);
}

/** Capacitor charging and discharging through R. */
export function rcCarga(t: number, tau: number, vf: number, v0 = 0): number {
  return vf + (v0 - vf) * Math.exp(-t / tau);
}

// ------------------------------------------------------------------ colour code (2.4) and E series (2.5)

export interface ColorBanda {
  nombre: string;
  color: string;
  digito: number | null;
  mult: number | null;
  tol: number | null;
}

export const COLORES: ColorBanda[] = [
  { nombre: 'negro', color: '#1b1b1b', digito: 0, mult: 1, tol: null },
  { nombre: 'marrón', color: '#7b4a26', digito: 1, mult: 10, tol: 1 },
  { nombre: 'rojo', color: '#d0281f', digito: 2, mult: 100, tol: 2 },
  { nombre: 'naranja', color: '#f07b16', digito: 3, mult: 1e3, tol: null },
  { nombre: 'amarillo', color: '#f5d119', digito: 4, mult: 1e4, tol: null },
  { nombre: 'verde', color: '#2f9a45', digito: 5, mult: 1e5, tol: 0.5 },
  { nombre: 'azul', color: '#2459c7', digito: 6, mult: 1e6, tol: 0.25 },
  { nombre: 'violeta', color: '#8441b5', digito: 7, mult: 1e7, tol: 0.1 },
  { nombre: 'gris', color: '#8b8f94', digito: 8, mult: 1e8, tol: 0.05 },
  { nombre: 'blanco', color: '#f6f6f2', digito: 9, mult: 1e9, tol: null },
  { nombre: 'dorado', color: '#c9a227', digito: null, mult: 0.1, tol: 5 },
  { nombre: 'plateado', color: '#c3c8ce', digito: null, mult: 0.01, tol: 10 },
];

export const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
export const E24 = [
  1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1,
];

/** Decomposes a value into its bands: 2 or 3 significant digits and the multiplier index. */
export function bandasDe(valor: number, cifras: 2 | 3): { digitos: number[]; mult: number } | null {
  if (!(valor > 0)) return null;
  const e = Math.floor(Math.log10(valor)) - (cifras - 1);
  const n = Math.round(valor / 10 ** e);
  const s = String(n).padStart(cifras, '0');
  const digitos = s.split('').map(Number);
  let mult = e;
  if (s.length > cifras) {
    digitos.length = cifras;
    mult = e + 1;
  }
  if (mult < -2 || mult > 9) return null;
  return { digitos, mult };
}

/** Colour index for a decimal exponent (−1 → dorado, −2 → plateado). */
export function indiceMultiplicador(exp: number): number {
  return exp === -1 ? 10 : exp === -2 ? 11 : exp;
}
