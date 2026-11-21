// 1.3.1 (qa131-interaccion): the boards' map navigation (tres/motor/orbita.ts) when a pointer's release never reaches
// the viewer — a mouse pressed on an overlay inside the viewer (a label: no pointer capture there, so that its tap
// still follows its link) and released outside the window. The next press of the same mouse (the same pointerId) was
// taken as a second finger: the right button no longer turned the board and the left one never panned on its own
// again until the page was reloaded. Without a browser, on a stand-in element (as tests/orbita13-unidad.spec.ts).
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config without server> tests/qa131-orbita-unidad.spec.ts
import { expect, test } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { MAPA, Orbita, type SuperficieMapa } from '../src/componentes/tres/motor/orbita';

const W = 400;
const H = 600;

// (Node has no DOM: an overlay is a Node inside the viewer's zone)
class NodoFalso {}
(globalThis as unknown as { Node: unknown }).Node ??= NodoFalso;
const etiqueta = new ((globalThis as unknown as { Node: new () => object }).Node)();

class Elemento {
  oyentes = new Map<string, Set<(e: unknown) => void>>();
  clientWidth = W;
  clientHeight = H;
  addEventListener(t: string, f: (e: unknown) => void): void {
    if (!this.oyentes.has(t)) this.oyentes.set(t, new Set());
    this.oyentes.get(t)!.add(f);
  }
  removeEventListener(t: string, f: (e: unknown) => void): void {
    this.oyentes.get(t)?.delete(f);
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0 };
  }
  setPointerCapture(): void {}
  contains(): boolean {
    return true;
  }
  focus(): void {}
  emitir(t: string, e: Record<string, unknown>): void {
    for (const f of this.oyentes.get(t) ?? []) f({ preventDefault() {}, cancelable: true, target: this, ...e });
  }
}

const plana: SuperficieMapa = { z: () => 0, limites: () => ({ x: 500, y: 500 }), altura: () => 0 };

function banco() {
  const el = new Elemento();
  const cam = new PerspectiveCamera(32, W / H, 0.1, 4000);
  const o = new Orbita(cam, el as unknown as HTMLElement, () => {}, () => false);
  o.mapa = plana;
  o.maxDist = 2000;
  o.minDist = MAPA.holgura;
  o.ir({ azimut: 0, elevacion: 1.2, distancia: 200, objetivo: new Vector3() }, false);
  return { el, o };
}

const raton = (el: Elemento, tipo: string, x: number, y: number, extra: Record<string, unknown> = {}) =>
  el.emitir(tipo, { pointerId: 1, clientX: x, clientY: y, button: 0, buttons: tipo === 'pointerup' ? 0 : 1, pointerType: 'mouse', shiftKey: false, ctrlKey: false, metaKey: false, ...extra });

test('modo mapa: tras perder la suelta del ratón (pulsado sobre una etiqueta, soltado fuera), el botón derecho gira y el izquierdo desplaza', () => {
  const { el, o } = banco();
  // pressed on a label inside the viewer, dragged out, released outside: no pointerup reaches the viewer
  raton(el, 'pointerdown', 200, 300, { target: etiqueta });
  raton(el, 'pointermove', 230, 320);
  // the right button on the canvas turns the board
  const az0 = o.azimut;
  raton(el, 'pointerdown', 200, 300, { button: 2, buttons: 2 });
  for (let k = 1; k <= 8; k++) raton(el, 'pointermove', 200 + 10 * k, 300, { button: 2, buttons: 2 });
  raton(el, 'pointerup', 280, 300, { button: 2 });
  expect(Math.abs(o.azimut - az0), 'el botón derecho no gira la placa').toBeGreaterThan(0.3);
  // and the left one pans, with the grabbed point under the mouse
  const t0 = o.objetivo.clone();
  raton(el, 'pointerdown', 200, 300);
  for (let k = 1; k <= 8; k++) raton(el, 'pointermove', 200, 300 + 10 * k);
  raton(el, 'pointerup', 200, 380);
  expect(o.objetivo.distanceTo(t0), 'el botón izquierdo no desplaza la placa').toBeGreaterThan(1);
  expect([o.azimut, o.elevacion, o.distanciaReal, o.objetivo.x, o.objetivo.y].every(Number.isFinite)).toBe(true);
});

test('modo mapa: un dedo cuya suelta se perdió no convierte el siguiente en un segundo dedo', () => {
  const { el, o } = banco();
  // a finger on a label, its release lost; the same pointer id comes again (the mouse, or a pen)
  el.emitir('pointerdown', { pointerId: 7, clientX: 100, clientY: 100, button: 0, buttons: 1, pointerType: 'pen', target: etiqueta });
  const t0 = o.objetivo.clone();
  el.emitir('pointerdown', { pointerId: 7, clientX: 200, clientY: 300, button: 0, buttons: 1, pointerType: 'pen' });
  for (let k = 1; k <= 8; k++) el.emitir('pointermove', { pointerId: 7, clientX: 200 + 10 * k, clientY: 300, button: 0, buttons: 1, pointerType: 'pen' });
  el.emitir('pointerup', { pointerId: 7, clientX: 280, clientY: 300, button: 0, buttons: 0, pointerType: 'pen' });
  expect(o.objetivo.distanceTo(t0), 'el lápiz no desplaza la placa').toBeGreaterThan(1);
  // and afterwards a fresh finger pans on its own (nothing stuck)
  const t1 = o.objetivo.clone();
  el.emitir('pointerdown', { pointerId: 8, clientX: 200, clientY: 300, button: 0, buttons: 1, pointerType: 'touch' });
  for (let k = 1; k <= 8; k++) el.emitir('pointermove', { pointerId: 8, clientX: 200, clientY: 300 - 10 * k, button: 0, buttons: 1, pointerType: 'touch' });
  el.emitir('pointerup', { pointerId: 8, clientX: 200, clientY: 220, button: 0, buttons: 0, pointerType: 'touch' });
  expect(o.objetivo.distanceTo(t1), 'un dedo nuevo no desplaza la placa').toBeGreaterThan(1);
});
