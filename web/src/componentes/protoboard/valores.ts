// Values offered next to a part on the breadboard (0.11): the field the floating bar edits, the common values
// of each kind as chips (resistors along the E12 series, capacitors, supply voltages, models) and the step to
// the previous or next E12 value. Plain TypeScript.

import { tipoDe, type Campo } from '../editor/catalogo.ts';
import type { Componente } from '../editor/tipos.ts';
import { modelosDe, type FamiliaModelo } from '../editor/modelos.ts';
import { formatoValor, leerValor } from '../editor/valores.ts';

export const E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];

/** The field a part's value lives in (resistance, capacitance, supply voltage, model), if any. */
export function campoValor(c: Componente): Campo | null {
  const t = tipoDe(c);
  if (c.tipo === 'V' && (c.campos['forma'] ?? 'dc') === 'dc') return t.campos.find((f) => f.id === 'dc') ?? null;
  if (['R', 'POT', 'C', 'L'].includes(c.tipo)) return t.campos.find((f) => f.id === 'valor') ?? null;
  return t.campos.find((f) => f.tipo === 'modelo') ?? null;
}

/** Common values as [stored text, label] chips. */
export function valoresComunes(f: Campo): [string, string][] {
  if (f.tipo === 'modelo' && f.familia) return modelosDe(f.familia as FamiliaModelo).map((m) => [m.nombre, m.descripcion.split(' (')[0]!]);
  const lista: number[] =
    f.unidad === 'Ω'
      ? [100, 220, 330, 470, 1e3, 2.2e3, 4.7e3, 10e3, 22e3, 47e3, 100e3, 1e6]
      : f.unidad === 'F'
        ? [10e-12, 100e-12, 1e-9, 10e-9, 100e-9, 1e-6, 10e-6, 100e-6, 470e-6]
        : f.unidad === 'H'
          ? [10e-6, 100e-6, 1e-3, 10e-3, 100e-3]
          : f.unidad === 'V'
            ? [1.5, 3, 3.3, 5, 9, 12]
            : [];
  return lista.map((v) => [formatoValor(v), conUnidad(v, f.unidad ?? '')]);
}

/** «4,7 kΩ», «330 Ω», «100 nF», «5 V». */
export function conUnidad(v: number, unidad: string): string {
  const t = formatoValor(v);
  const m = /^(.*?)([TGMkmµnp]?)$/.exec(t)!;
  return `${m[1]} ${m[2]}${unidad}`;
}

/** The value of a field as a number (null when it is not a plain number). */
export function numeroDe(c: Componente, f: Campo): number | null {
  const l = leerValor(c.campos[f.id] ?? '', f.unidad ?? '');
  return l.ok ? l.v : null;
}

/** The E12 value before or after `v` (across decades). */
export function pasoE12(v: number, sentido: 1 | -1): number {
  const d = Math.floor(Math.log10(v) + 1e-9);
  const m = v / 10 ** d;
  let i = E12.findIndex((x) => Math.abs(x - m) < 1e-6);
  if (i < 0) {
    // Not an E12 value: the nearest one in that direction.
    i = sentido > 0 ? E12.findIndex((x) => x > m) - 1 : E12.findIndex((x) => x >= m);
    if (i < -1) i = E12.length - 1;
  }
  let k = i + sentido;
  let dec = d;
  if (k >= E12.length) {
    k = 0;
    dec++;
  } else if (k < 0) {
    k = E12.length - 1;
    dec--;
  }
  return Number((E12[k]! * 10 ** dec).toPrecision(3));
}
