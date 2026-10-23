// Drawings of the practice circuits that the book's figures do not draw as schematics (or draw without the
// part that a step needs, such as the winding resistance of practice 4).

import { construir } from '../esquema/dibujoPropio';
import type { Esquema } from '../../figuras-vivas/tipos';

const masa = (x0: number, x1: number, y = 0) => ({ puntos: [[x0, y], [x1, y]] as [number, number][], nodo: '0' });

export const DIBUJOS: Record<string, Esquema> = {
  p1_led: construir(
    [
      { id: 'V1', rol: 'V', etiqueta: '9 V', de: [0, 0], a: [0, 4], nodos: ['0', 'a'] },
      { id: 'R1', rol: 'R', etiqueta: 'R1 10 kΩ', de: [0, 4], a: [3.5, 4], nodos: ['a', 'out'] },
      { id: 'R2', rol: 'R', etiqueta: 'R2 4,7 kΩ', de: [3.5, 4], a: [3.5, 0], nodos: ['out', '0'] },
      { id: 'RL', rol: 'R', etiqueta: '330 Ω', de: [6.5, 4], a: [6.5, 2], nodos: ['out', 'led'] },
      { id: 'DL', rol: 'LED', etiqueta: 'LED', de: [6.5, 2], a: [6.5, 0], nodos: ['led', '0'] },
    ],
    [{ puntos: [[3.5, 4], [6.5, 4]], nodo: 'out' }, masa(0, 6.5)],
    [[3.5, 0]],
  ),
  p3_suelto: construir([{ id: 'D1', rol: 'D', etiqueta: '1N4148', de: [0, 3], a: [0, 0], nodos: ['a', '0'] }], [], []),
  p3_xy: construir(
    [
      { id: 'VG', rol: 'VSIN', etiqueta: 'DDS', de: [0, 0], a: [0, 3], nodos: ['0', 'g'] },
      { id: 'D1', rol: 'D', etiqueta: '1N4148', de: [0, 3], a: [3.5, 3], nodos: ['g', 'k'] },
      { id: 'R1', rol: 'R', etiqueta: '1 kΩ', de: [3.5, 3], a: [3.5, 0], nodos: ['k', '0'] },
    ],
    [masa(0, 3.5)],
    [[1.75, 0]],
  ),
  p4: construir(
    [
      { id: 'VS', rol: 'VSIN', etiqueta: '9 V ef · 50 Hz', de: [0, 0], a: [0, 3], nodos: ['0', 's'] },
      { id: 'RS', rol: 'R', etiqueta: 'RS 0,5 Ω', de: [0, 3], a: [2.8, 3], nodos: ['s', 'x'] },
      { id: 'D1', rol: 'D', etiqueta: '1N4007', de: [2.8, 3], a: [5.4, 3], nodos: ['x', 'out'] },
      { id: 'C1', rol: 'C', etiqueta: '1000 µF', de: [5.4, 3], a: [5.4, 0], nodos: ['out', '0'] },
      { id: 'RL', rol: 'R', etiqueta: '110 Ω', de: [7.6, 3], a: [7.6, 0], nodos: ['out', '0'] },
    ],
    [{ puntos: [[5.4, 3], [7.6, 3]], nodo: 'out' }, masa(0, 7.6)],
    [[3.8, 0]],
  ),
  p4_sinC: construir(
    [
      { id: 'VS', rol: 'VSIN', etiqueta: '9 V ef · 50 Hz', de: [0, 0], a: [0, 3], nodos: ['0', 's'] },
      { id: 'RS', rol: 'R', etiqueta: 'RS 0,5 Ω', de: [0, 3], a: [2.8, 3], nodos: ['s', 'x'] },
      { id: 'D1', rol: 'D', etiqueta: '1N4007', de: [2.8, 3], a: [5.4, 3], nodos: ['x', 'out'] },
      { id: 'RL', rol: 'R', etiqueta: '110 Ω', de: [5.4, 3], a: [5.4, 0], nodos: ['out', '0'] },
    ],
    [masa(0, 5.4)],
    [[2.7, 0]],
  ),
  p9: construir(
    [
      { id: 'VG', rol: 'VSIN', etiqueta: 'DDS', de: [0, 0], a: [0, 3], nodos: ['0', 'in'] },
      { id: 'L1', rol: 'L', etiqueta: '10 mH', de: [0, 3], a: [2.8, 3], nodos: ['in', 'nl'] },
      { id: 'RCU', rol: 'R', etiqueta: 'cobre 20 Ω', de: [2.8, 3], a: [5.6, 3], nodos: ['nl', 'n1'] },
      { id: 'C1', rol: 'C', etiqueta: '100 nF', de: [5.6, 3], a: [8.4, 3], nodos: ['n1', 'n2'] },
      { id: 'R1', rol: 'R', etiqueta: '100 Ω', de: [8.4, 3], a: [8.4, 0], nodos: ['n2', '0'] },
    ],
    [masa(0, 8.4)],
    [[4.2, 0]],
  ),
  p10: construir(
    [
      { id: 'VP', rol: 'VPULSE', etiqueta: '74AC04 · 1 MHz', de: [0, 0], a: [0, 3], nodos: ['0', 'g'] },
      { id: 'RO', rol: 'R', etiqueta: 'salida 25 Ω', de: [0, 3], a: [3, 3], nodos: ['g', 'out'] },
    ],
    [{ puntos: [[3, 3], [5, 3]], nodo: 'out' }, masa(0, 5)],
    [[2.5, 0]],
  ),
  p11: construir(
    [
      { id: 'BAM', rol: 'VSIN', etiqueta: 'AM 100 kHz, m = 0,5', de: [0, 0], a: [0, 3], nodos: ['0', 'am'] },
      { id: 'D1', rol: 'D', etiqueta: '1N4148', de: [0, 3], a: [3, 3], nodos: ['am', 'o1'] },
      { id: 'R1', rol: 'R', etiqueta: '10 kΩ', de: [4.5, 3], a: [4.5, 0], nodos: ['o1', '0'] },
      { id: 'C1', rol: 'C', etiqueta: 'C1', de: [6.5, 3], a: [6.5, 0], nodos: ['o1', '0'] },
    ],
    [{ puntos: [[3, 3], [6.5, 3]], nodo: 'o1' }, masa(0, 6.5)],
    [[2, 0]],
  ),
  p12: construir(
    [
      { id: 'VG', rol: 'VSIN', etiqueta: 'DDS', de: [0, 0], a: [0, 3], nodos: ['0', 'in'] },
      { id: 'R1', rol: 'R', etiqueta: '100 Ω', de: [0, 3], a: [2.8, 3], nodos: ['in', 'c'] },
      { id: 'RESR', rol: 'R', etiqueta: 'ESR', de: [2.8, 3], a: [5.4, 3], nodos: ['c', 'e1'] },
      { id: 'LESL', rol: 'L', etiqueta: 'ESL', de: [5.4, 3], a: [8, 3], nodos: ['e1', 'e2'] },
      { id: 'C1', rol: 'C', etiqueta: '100 µF', de: [8, 3], a: [8, 0], nodos: ['e2', '0'] },
    ],
    [masa(0, 8)],
    [[4, 0]],
  ),
};
