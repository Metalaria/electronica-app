// Complex arithmetic for phasors and impedances (plain objects, no allocation-heavy classes).

export interface C {
  re: number;
  im: number;
}

export const c = (re: number, im = 0): C => ({ re, im });
export const polar = (r: number, a: number): C => ({ re: r * Math.cos(a), im: r * Math.sin(a) });
export const suma = (a: C, b: C): C => ({ re: a.re + b.re, im: a.im + b.im });
export const resta = (a: C, b: C): C => ({ re: a.re - b.re, im: a.im - b.im });
export const mul = (a: C, b: C): C => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export const esc = (a: C, k: number): C => ({ re: a.re * k, im: a.im * k });
export function div(a: C, b: C): C {
  const d = b.re * b.re + b.im * b.im || 1e-300;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}
export const inv = (a: C): C => div(c(1), a);
export const mod = (a: C): number => Math.hypot(a.re, a.im);
export const arg = (a: C): number => Math.atan2(a.im, a.re);
export const conj = (a: C): C => ({ re: a.re, im: -a.im });
/** Parallel combination of impedances. */
export const par = (a: C, b: C): C => div(mul(a, b), suma(a, b));
export const grados = (rad: number): number => (rad * 180) / Math.PI;
