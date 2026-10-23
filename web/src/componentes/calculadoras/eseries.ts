// Standard E12 and E24 values for resistors, capacitors and inductors (the sliders snap to them on request).

export type Serie = 'libre' | 'E12' | 'E24';

const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
const E24 = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];

/** Units whose values come in E series. */
export function normalizable(unidad: string): boolean {
  return unidad === 'Ω' || unidad === 'F' || unidad === 'H';
}

/** Nearest value of the series (on a logarithmic scale). */
export function aSerie(x: number, serie: Serie): number {
  if (serie === 'libre' || !(x > 0) || !Number.isFinite(x)) return x;
  const tabla = serie === 'E12' ? E12 : E24;
  const d = Math.floor(Math.log10(x));
  const m = x / 10 ** d;
  let mejor = 1;
  let dist = Infinity;
  for (const c of [...tabla, 10]) {
    const q = Math.abs(Math.log(m / c));
    if (q < dist) {
      dist = q;
      mejor = c;
    }
  }
  return Number((mejor * 10 ** d).toPrecision(3));
}
