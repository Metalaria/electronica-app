// 1.2 visual identity of book 4.0/4.1 in the lessons (plantilla/libro.typ, figuras/roles40.py): the colour of a
// lesson circuit's wires from the block colour of its chapter, and the voltage scale of the living circuit. Pure (the
// unit tests run it in Node): colours in and out as «#rrggbb».
//
// Wires: the book draws main traces and wires in its block colour and, when a series of a close hue shares the figure,
// takes a dark shade of it. A lesson's parts already use the series hues (blue, orange, green…), so the wires always
// take the shade: in the light and sepia themes the block colour mixed 45 % towards the text ink (a tinted ink, far
// darker than any series hue), in the dark theme the block colour mixed 62 % towards white (a tinted light grey). Both
// stay ≥ 3:1 on the panel (WCAG 1.4.11) for the six blocks — checked by tests/lecciones11-ui12-unidad.spec.ts.
//
// Voltage scale: diverging, blue (negative) – grey (0 V) – red (positive), interpolated in OKLab between the theme's
// tokens --v11-tension-neg / -cero / -pos, with a gentle gamma so small voltages still show (as figuras-vivas). Colour
// is never the only cue: the legend gives the ends in volts and «Tensiones» writes each node's value.

import { contraste } from '../leccion11/contraste';
import type { TemaEfectivo } from '../color';

type RGB = [number, number, number];

const INK = '#1b1f27';

function aRGB(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Color no válido: ${hex}`);
  const n = parseInt(m[1]!, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function aHex(c: RGB): string {
  return `#${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
}

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function aOklab(hex: string): RGB {
  const [R, G, B] = aRGB(hex).map(lin) as RGB;
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function deOklab([L, a, b]: RGB): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return aHex([
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => gam(Math.min(1, Math.max(0, c)))) as RGB);
}

/** Perceptual distance of two colours (OKLab, Euclidean). */
export function distancia(a: string, b: string): number {
  const [x, y] = [aOklab(a), aOklab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** Mix of two colours in OKLab (u = 0 → a, 1 → b). */
export function mezclarOklab(a: string, b: string, u: number): string {
  const [x, y] = [aOklab(a), aOklab(b)];
  return deOklab([x[0] + (y[0] - x[0]) * u, x[1] + (y[1] - x[1]) * u, x[2] + (y[2] - x[2]) * u]);
}

/** The six blocks of the book (plantilla/libro.typ BLOQUES; indice.json → bloques). */
export const BLOQUES = ['1a3a5c', '1f6f5c', '6b3fa0', 'a6552b', '2e6ea6', '8a1f3d'] as const;
/** The series hues of the identity (roles40.py SERIES). */
export const SERIES = ['#2457d6', '#b3261e', '#1c7a4b', '#6a45c0', '#d9661c'] as const;

/** The wires' colour of a lesson's circuit from its chapter's block colour («1A3A5C» or «#1a3a5c»), per theme. */
export function hiloDeBloque(bloque: string | null | undefined, tema: TemaEfectivo): string {
  const b = `#${(bloque ?? '1a3a5c').replace(/^#/, '').toLowerCase()}`;
  const base = /^#[0-9a-f]{6}$/.test(b) ? b : '#1a3a5c';
  return tema === 'oscuro' ? mezclarOklab(base, '#ffffff', 0.62) : mezclarOklab(base, INK, 0.45);
}

/** Position on the scale (−1…1) of a voltage on a ±ref scale, with the gamma of figuras-vivas (0,65). */
export function posicionTension(v: number, ref: number): number {
  if (!(ref > 0) || !Number.isFinite(v)) return 0;
  const u = Math.min(1, Math.abs(v) / ref) ** 0.65;
  return Math.sign(v) * u;
}

export interface Escala {
  neg: string;
  cero: string;
  pos: string;
}

/** Colour of a voltage on the theme's scale (its three tokens) whose ends are ±ref. */
export function colorTension(v: number, ref: number, e: Escala): string {
  const p = posicionTension(v, ref);
  return p >= 0 ? mezclarOklab(e.cero, e.pos, p) : mezclarOklab(e.cero, e.neg, -p);
}

/** The lowest contrast of the scale against a background, over `n` + 1 steps from −1 to 1. */
export function contrasteMinimoEscala(e: Escala, fondo: string, n = 20): number {
  let min = Infinity;
  for (let k = 0; k <= n; k++) min = Math.min(min, contraste(colorTension(-1 + (2 * k) / n, 1, e), fondo));
  return min;
}
