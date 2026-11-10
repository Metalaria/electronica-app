// 1.1 lessons: what the AC schematics share (filtro-rc, filtro-rl, rlc-serie, rlc-paralelo) — the source line, the
// source's phasor (each schematic starts its transient in the steady state at t = 0, so the curves are compared from
// the first point) and the AC observables of a node or branch. Pure.
import { num } from './comun';
import type { ContextoNetlist, Observable } from './tipos';

/** A sine source v(t) = Vp·sin(2π·f·t + φ) for every analysis: «AC Vp φ» for the sweep, «SIN(…)» for the transient. */
export function fuenteSeno(c: ContextoNetlist, nodo = 'fte'): string {
  const vp = num(c.p('fuente'));
  const fase = num(c.p('fase'));
  return `VF ${nodo} 0 DC 0 AC ${vp} ${fase} SIN(0 ${vp} ${num(c.p('f'))} 0 0 ${fase})`;
}

/** The source's phasor Vp·e^(jφ) and ω. */
export function fasor(c: ContextoNetlist): { re: number; im: number; w: number } {
  const vp = c.p('fuente');
  const f = (c.p('fase') * Math.PI) / 180;
  return { re: vp * Math.cos(f), im: vp * Math.sin(f), w: 2 * Math.PI * c.p('f') };
}

/** a / b of complex numbers. */
export function div(a: { re: number; im: number }, b: { re: number; im: number }): { re: number; im: number } {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}

/** The AC readings of a measure: amplitude, phase and dB (named «<base>_amp», «<base>_fase», «<base>_db»). */
export function observablesCA(base: string, medida: string, unidad: string, descripcion: string): Record<string, Observable> {
  return {
    [`${base}_amp`]: { medida, analisis: 'ac', ac: 'mag', unidad, descripcion: `amplitud de ${descripcion}` },
    [`${base}_fase`]: { medida, analisis: 'ac', ac: 'fase', unidad: '°', descripcion: `fase de ${descripcion} (grados, la de la fuente incluida)` },
    [`${base}_db`]: { medida, analisis: 'ac', ac: 'db', unidad: 'dB', descripcion: `amplitud de ${descripcion} en dB (20·log₁₀ de la amplitud)` },
  };
}
