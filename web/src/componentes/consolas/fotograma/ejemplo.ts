// The example tile shared by every console (a small ball) and the arithmetic the screen panel shows: the bits of
// each plane, the stored bytes and the colour index of every pixel of the followed row.

import type { Ejemplo } from './tipos';

/** 8 × 8 ball in 2 bits per pixel: 0 transparent, 1 fill, 2 highlight, 3 outline. */
export const PELOTA: number[][] = [
  [0, 0, 3, 3, 3, 3, 0, 0],
  [0, 3, 1, 1, 1, 1, 3, 0],
  [3, 1, 2, 2, 1, 1, 1, 3],
  [3, 1, 2, 1, 1, 1, 1, 3],
  [3, 1, 1, 1, 1, 1, 1, 3],
  [3, 1, 1, 1, 1, 1, 1, 3],
  [0, 3, 1, 1, 1, 1, 3, 0],
  [0, 0, 3, 3, 3, 3, 0, 0],
];

/** The same ball for 4-bit tiles: outline 1, fill 6, highlight 15 (so that every plane has something). */
export const PELOTA_4BPP: number[][] = PELOTA.map((f) => f.map((i) => [0, 6, 15, 1][i]!));

/** Every pixel doubled: the 16 × 16 sprite tile of the Neo Geo. */
export function doblar(t: number[][]): number[][] {
  const r: number[][] = [];
  for (const f of t) {
    const d = f.flatMap((i) => [i, i]);
    r.push(d, [...d]);
  }
  return r;
}

/** Columns of the followed row read together. */
export function ventana(e: Ejemplo): [number, number] {
  return e.ventana ?? [0, e.tesela];
}

/** Indices of the followed row (inside the window). */
export function filaSeguida(e: Ejemplo): number[] {
  const [a, b] = ventana(e);
  return e.indices[e.fila]!.slice(a, b);
}

/** Bits of each plane of the followed row, leftmost pixel first (plane 0 = bit 0 of the index). */
export function planos(e: Ejemplo): number[][] {
  const fila = filaSeguida(e);
  return Array.from({ length: e.bpp }, (_, p) => fila.map((i) => (i >> p) & 1));
}

export function hex2(n: number): string {
  return '$' + n.toString(16).toUpperCase().padStart(2, '0');
}

/** A plane's bits as the byte stored with the leftmost pixel in bit 7. */
export function byteDe(bits: number[]): number {
  return bits.reduce((a, b) => (a << 1) | b, 0);
}

/** Packed nibbles of the followed row: two pixels per byte, the left one in the high nibble. */
export function nibbles(e: Ejemplo): number[] {
  const f = filaSeguida(e);
  const r: number[] = [];
  for (let i = 0; i < f.length; i += 2) r.push((f[i]! << 4) | (f[i + 1] ?? 0));
  return r;
}

/** Index of the followed pixel. */
export function indiceSeguido(e: Ejemplo): number {
  return e.indices[e.fila]![e.columna]!;
}

/** Screen coordinates of the followed pixel. */
export function puntoSeguido(e: Ejemplo): [number, number] {
  return [e.x + e.columna, e.y + e.fila];
}
