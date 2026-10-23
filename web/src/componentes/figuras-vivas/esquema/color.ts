// Diverging colour scale of node voltages: blue (negative) – grey (0 V, ground) – red (positive),
// interpolated in OKLab so the steps look even. The schematic is drawn on the light figure plate in every
// theme, so one set of colours serves light and dark (the legend outside the plate uses the same ones).

type RGB = [number, number, number];

const NEG = '#2f6db5';
const CERO = '#d0d0cc';
const POS = '#c8402e';

/** Conventional current (amber) and electron flow (blue), as in the component animations. */
export const COLOR_CORRIENTE = '#e08a00';
export const BORDE_CORRIENTE = '#6b3f00';
export const COLOR_ELECTRON = '#2468d6';
export const BORDE_ELECTRON = '#ffffff';

function hex(c: string): RGB {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as RGB;
}

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function aOklab([r, g, b]: RGB): RGB {
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function deOklab([L, a, b]: RGB): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, gam(c)))) as RGB;
}

const [N, Z, P] = [NEG, CERO, POS].map((c) => aOklab(hex(c))) as [RGB, RGB, RGB];

function mezcla(a: RGB, b: RGB, u: number): RGB {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

const css = (lab: RGB) => `rgb(${deOklab(lab).map((v) => Math.round(v * 255)).join(' ')})`;

/** Position on the scale (−1…1) of a voltage, with a gentle gamma so small voltages still show. */
export function posicion(v: number, ref: number): number {
  if (!(ref > 0) || !Number.isFinite(v)) return 0;
  const u = Math.min(1, Math.abs(v) / ref) ** 0.65;
  return Math.sign(v) * u;
}

/** Colour of a voltage on a scale whose ends are ±ref. */
export function colorTension(v: number, ref: number): string {
  const p = posicion(v, ref);
  return css(p >= 0 ? mezcla(Z, P, p) : mezcla(Z, N, -p));
}

/** CSS gradient of the legend from vmin to vmax (each end at its own position on the ±ref scale). */
export function gradiente(vmin: number, vmax: number, ref: number): string {
  const paradas: string[] = [];
  const n = 12;
  for (let k = 0; k <= n; k++) {
    const v = vmin + ((vmax - vmin) * k) / n;
    paradas.push(`${colorTension(v, ref)} ${((k / n) * 100).toFixed(1)}%`);
  }
  return `linear-gradient(to right, ${paradas.join(', ')})`;
}
