// 1.1 lessons: geometry of the schematic kit's symbols (axis-aligned two-terminal parts). Pure.

export type Punto = [number, number];

/** Unit vector along a segment and its normal (the segment must be horizontal or vertical). */
export function ejes(x1: number, y1: number, x2: number, y2: number): { u: Punto; n: Punto; l: number } {
  const l = Math.hypot(x2 - x1, y2 - y1) || 1;
  const u: Punto = [(x2 - x1) / l, (y2 - y1) / l];
  return { u, n: [-u[1], u[0]], l };
}

const f = (v: number) => Number(v.toFixed(2));

/** A point at distance `a` along the segment and `b` across it. */
export function en(x1: number, y1: number, x2: number, y2: number, a: number, b = 0): Punto {
  const { u, n } = ejes(x1, y1, x2, y2);
  return [f(x1 + u[0] * a + n[0] * b), f(y1 + u[1] * a + n[1] * b)];
}

/** Path through points. */
export const camino = (ps: Punto[]): string => ps.map((p, k) => `${k ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');

/** Lead wire, a body of length `largo` centred on the segment, lead wire: the two ends of the body. */
export function cuerpo(x1: number, y1: number, x2: number, y2: number, largo: number): { a: number; b: number; l: number } {
  const { l } = ejes(x1, y1, x2, y2);
  const a = Math.max(0, (l - largo) / 2);
  return { a, b: Math.min(l, a + largo), l };
}
