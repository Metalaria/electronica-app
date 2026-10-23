// Seven-segment digits for the LCD: which segments light for each character, and the polygons.

const MAPA: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  O: 'abcdef',
  L: 'fed',
  E: 'afged',
  r: 'eg',
  n: 'ceg',
  I: 'ef',
  C: 'afed',
  A: 'abcefg',
  b: 'fedcg',
  d: 'bcdeg',
  F: 'afeg',
  H: 'fbegc',
  P: 'abfge',
  t: 'fged',
  u: 'cde',
  o: 'cdeg',
  ' ': '',
};

export interface Celda {
  segs: string;
  punto: boolean;
}

/** Cells of a display of `n` digits (right-aligned) and whether the minus sign is lit. */
export function celdas(texto: string, n: number): { celdas: Celda[]; menos: boolean } {
  let t = texto.replace('−', '-');
  let menos = false;
  if (t.startsWith('-') && /\d/.test(t)) {
    menos = true;
    t = t.slice(1);
  }
  const res: Celda[] = [];
  for (const ch of t) {
    if (ch === '.' || ch === ',') {
      const ult = res[res.length - 1];
      if (ult) ult.punto = true;
      else res.push({ segs: '', punto: true });
      continue;
    }
    res.push({ segs: MAPA[ch] ?? '', punto: false });
  }
  while (res.length < n) res.unshift({ segs: '', punto: false });
  return { celdas: res.slice(-n), menos };
}

/** Segment polygons in a cell of width w and height h (thickness k). */
export function segmentos(w: number, h: number, k: number): Record<string, string> {
  const m = h / 2;
  const g = k * 0.18;
  const p = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  return {
    a: p([[k / 2 + g, 0], [w - k / 2 - g, 0], [w - k - g, k], [k + g, k]]),
    d: p([[k + g, h - k], [w - k - g, h - k], [w - k / 2 - g, h], [k / 2 + g, h]]),
    g: p([[k / 2 + g, m], [k + g, m - k / 2], [w - k - g, m - k / 2], [w - k / 2 - g, m], [w - k - g, m + k / 2], [k + g, m + k / 2]]),
    f: p([[0, k / 2 + g], [k, k + g], [k, m - k / 2 - g], [k / 2, m - g], [0, m - k / 2 - g]]),
    e: p([[0, m + k / 2 + g], [k / 2, m + g], [k, m + k / 2 + g], [k, h - k - g], [0, h - k / 2 - g]]),
    b: p([[w, k / 2 + g], [w, m - k / 2 - g], [w - k / 2, m - g], [w - k, m - k / 2 - g], [w - k, k + g]]),
    c: p([[w, m + k / 2 + g], [w, h - k / 2 - g], [w - k, h - k - g], [w - k, m + k / 2 + g], [w - k / 2, m + g]]),
  };
}
