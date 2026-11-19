// 1.3 (tactil13) precise placement with a finger, in Node (no browser): the shared maths of componentes/colocar/
// precision.ts — snapping to the nearest valid hole with hysteresis (no flicker between neighbours while the finger
// trembles on the border, the channel and the gaps skipped, nothing off the holes), the same for the nodes of a
// schematic, the next hole / node in a direction (fine-adjust arrows), the lift above a finger, the auto zoom's rule,
// the loupe's place and the throttle of the ticks.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config> tests/tactil13-unidad.spec.ts
import { test, expect } from '@playwright/test';
import {
  candidatoConHisteresis,
  elevacion,
  ELEVACION_DEDO,
  histeresisRejilla,
  huecoConHisteresis,
  posicionLupa,
  Pulsos,
  siguienteHueco,
  vecinoEnDireccion,
  zoomAutomatico,
  type Pt,
} from '../src/componentes/colocar/precision.ts';
import { agujero, etiquetaHueco } from '../src/componentes/protoboard/placa.ts';

const cfg = { placas: 1, columnas: 30 };
const valido = (q: Pt) => !!agujero(cfg, q[0], q[1]);

test('rejilla: el agujero más cercano, y con histéresis se queda en el actual hasta pasar el borde con margen', () => {
  // no current hole: plain nearest
  expect(huecoConHisteresis([12.3, 5.2], null, valido, 0.2)).toEqual([12, 5]);
  expect(huecoConHisteresis([12.6, 5.2], null, valido, 0.2)).toEqual([13, 5]);
  // on the border between 12 and 13, the finger trembling ±0.15: it stays on 12 (no flicker)
  let q: Pt | null = [12, 5];
  for (const x of [12.45, 12.55, 12.62, 12.5, 12.68, 12.4, 12.65]) {
    q = huecoConHisteresis([x, 5], q, valido, 0.2);
    expect(q).toEqual([12, 5]);
  }
  // beyond half a pitch plus the hysteresis it moves on, and then sticks to the new one coming back a little
  q = huecoConHisteresis([12.72, 5], q, valido, 0.2);
  expect(q).toEqual([13, 5]);
  q = huecoConHisteresis([12.35, 5], q, valido, 0.2);
  expect(q).toEqual([13, 5]);
  q = huecoConHisteresis([12.25, 5], q, valido, 0.2);
  expect(q).toEqual([12, 5]);
  // the same vertically
  expect(huecoConHisteresis([12, 5.65], [12, 5], valido, 0.2)).toEqual([12, 5]);
  expect(huecoConHisteresis([12, 5.75], [12, 5], valido, 0.2)).toEqual([12, 6]);
});

test('rejilla: el canal y los huecos entre carriles no son agujeros; fuera de la placa no hay destino', () => {
  // the channel (y 8–9): the nearest real hole, e (7) or f (10)
  expect(huecoConHisteresis([5, 8.3], null, valido)).toEqual([5, 7]);
  expect(huecoConHisteresis([5, 9.7], null, valido)).toEqual([5, 10]);
  // a current hole that is not valid is not kept
  expect(huecoConHisteresis([5, 8.3], [5, 8], valido)).toEqual([5, 7]);
  // rails: column 7 has no rail hole on a 30-column board (groups of five from column 2)
  expect(agujero(cfg, 7, 0)).toBeNull();
  expect(huecoConHisteresis([7.1, 0], null, valido)).toEqual([8, 0]);
  expect(huecoConHisteresis([6.9, 0], null, valido)).toEqual([6, 0]);
  // far from every hole (above the board, beyond the reach): null — released there it stays where it was
  expect(huecoConHisteresis([5, -3], null, valido)).toBeNull();
  expect(huecoConHisteresis([40, 5], [30, 5], valido)).toBeNull();
});

test('histéresis según el tamaño del agujero en pantalla y el puntero', () => {
  expect(histeresisRejilla(30, 'touch')).toBeCloseTo(5 / 30);
  expect(histeresisRejilla(10, 'touch')).toBe(0.3);
  expect(histeresisRejilla(60, 'mouse')).toBe(0.08);
  expect(histeresisRejilla(20, 'mouse')).toBeCloseTo(0.1);
});

test('nodos de un esquema: el más cercano, con histéresis en píxeles y un alcance', () => {
  const nodos = [
    { id: 'f1', x: 72, y: 204 },
    { id: 'n', x: 206, y: 204 },
    { id: 'f2', x: 340, y: 204 },
    { id: '0', x: 131, y: 372 },
  ];
  expect(candidatoConHisteresis(nodos, { x: 190, y: 210 }, null)?.id).toBe('n');
  // halfway between n and f2 (273): n kept until f2 is nearer by more than 12 px
  expect(candidatoConHisteresis(nodos, { x: 275, y: 204 }, 'n', 12, 100)?.id).toBe('n');
  expect(candidatoConHisteresis(nodos, { x: 280, y: 204 }, 'n', 12, 100)?.id).toBe('f2');
  // beyond the reach: none (and the current one is not kept either)
  expect(candidatoConHisteresis(nodos, { x: 206, y: 290 }, 'n', 12, 60)).toBeNull();
});

test('ajuste fino: el agujero siguiente en una dirección (salta el canal) y el nodo vecino', () => {
  expect(siguienteHueco([12, 5], 'derecha', valido)).toEqual([13, 5]);
  expect(siguienteHueco([12, 7], 'abajo', valido)).toEqual([12, 10]);
  expect(siguienteHueco([30, 5], 'derecha', valido)).toBeNull();
  expect(siguienteHueco([6, 0], 'derecha', valido)).toEqual([8, 0]);
  const nodos = [
    { id: 'f1', x: 72, y: 204 },
    { id: 'n', x: 206, y: 204 },
    { id: 'f2', x: 340, y: 204 },
    { id: '0', x: 131, y: 372 },
  ];
  const n = nodos[1]!;
  expect(vecinoEnDireccion(nodos, n, 'derecha')?.id).toBe('f2');
  expect(vecinoEnDireccion(nodos, n, 'izquierda')?.id).toBe('f1');
  expect(vecinoEnDireccion(nodos, n, 'abajo')?.id).toBe('0');
  expect(vecinoEnDireccion(nodos, n, 'arriba')).toBeNull();
});

test('el nombre del agujero en la vista previa', () => {
  expect(etiquetaHueco(cfg, 12, 5)).toBe('C12 · tira 12 de arriba');
  expect(etiquetaHueco(cfg, 4, 12)).toBe('H4 · tira 4 de abajo');
  expect(etiquetaHueco(cfg, 3, 0)).toBe('Carril + superior · columna 3');
  expect(etiquetaHueco(cfg, 3, 16)).toBe('Carril − inferior · columna 3');
  expect(etiquetaHueco({ placas: 2, columnas: 30 }, 5, 21 + 3)).toBe('A5 · tira 5 de arriba · placa 2');
  expect(etiquetaHueco(cfg, 5, 8)).toBe('');
});

test('elevación, zoom automático, sitio de la lupa y ritmo de las vibraciones', () => {
  expect(elevacion('touch')).toBe(ELEVACION_DEDO);
  expect(ELEVACION_DEDO).toBeGreaterThanOrEqual(40);
  expect(ELEVACION_DEDO).toBeLessThanOrEqual(60);
  expect(elevacion('mouse')).toBe(0);
  expect(elevacion('pen')).toBe(0);
  // a phone with 12 px holes zooms in; 22 px holes, a tablet or a mouse do not
  expect(zoomAutomatico(12, 412, 915, 'touch')).toBe(30);
  expect(zoomAutomatico(22, 412, 915, 'touch')).toBeNull();
  expect(zoomAutomatico(12, 800, 1280, 'touch')).toBeNull();
  expect(zoomAutomatico(12, 412, 915, 'mouse')).toBeNull();
  // the loupe: above the target, on the side with room, never off the window, never over the target
  const r = 64;
  for (const o of [
    { x: 60, y: 500 },
    { x: 380, y: 500 },
    { x: 200, y: 60 },
    { x: 10, y: 900 },
  ]) {
    const c = posicionLupa(o, { ancho: 412, alto: 915 }, r);
    expect(c.x - r).toBeGreaterThanOrEqual(8);
    expect(c.x + r).toBeLessThanOrEqual(412 - 8);
    expect(c.y - r).toBeGreaterThanOrEqual(8);
    expect(c.y + r).toBeLessThanOrEqual(915 - 8);
    expect(Math.hypot(c.x - o.x, c.y - o.y)).toBeGreaterThan(r);
  }
  const p = new Pulsos(45);
  expect(p.toca(0)).toBe(true);
  expect(p.toca(20)).toBe(false);
  expect(p.toca(50)).toBe(true);
});
