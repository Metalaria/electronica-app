// 1.3, item 2: the boards navigated like a map (tres/motor/orbita.ts, map mode), without a browser: the controller
// is driven with synthetic pointer, wheel, key and Safari gesture events on a stand-in element.
//   one finger pans and the grabbed point stays under it (from above and tilted), without turning or tilting;
//   the wheel, a pinch and Safari's gesture zoom toward the point under the cursor / the fingers;
//   a two-finger vertical drag tilts, while a pinch, a small drift or a small twist never tilts nor rotates;
//   lifting one finger after a pinch starts nothing, and the other one pans from where it is (no jump);
//   the camera keeps its clearance over a part and comes down again past it; keyboard; orbit mode unchanged.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config without server> tests/orbita13-unidad.spec.ts
import { expect, test } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { clasificarDos, MAPA, Orbita, type SuperficieMapa } from '../src/componentes/tres/motor/orbita';

const W = 400;
const H = 600;

/** Stand-in for the canvas: listeners, size, no layout. */
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

type Banco = { o: Orbita; el: Elemento; cam: PerspectiveCamera; cambios: number };

function banco(superficie: SuperficieMapa | null, inicial?: Partial<{ azimut: number; elevacion: number; distancia: number }>): Banco {
  const el = new Elemento();
  const cam = new PerspectiveCamera(32, W / H, 0.1, 4000);
  const b = { el, cam, cambios: 0 } as Banco;
  b.o = new Orbita(cam, el as unknown as HTMLElement, () => b.cambios++, () => false);
  b.o.mapa = superficie;
  b.o.maxDist = 2000;
  b.o.minDist = superficie ? MAPA.holgura : 2;
  b.o.ir({ azimut: inicial?.azimut ?? 0, elevacion: inicial?.elevacion ?? Math.PI / 2, distancia: inicial?.distancia ?? 200, objetivo: new Vector3() }, false);
  return b;
}

const plana: SuperficieMapa = { z: () => 0, limites: () => ({ x: 500, y: 500 }), altura: () => 0 };

/** Canvas px of a world point. */
function pantalla(b: Banco, p: Vector3): { x: number; y: number } {
  const v = p.clone().project(b.cam);
  return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H };
}

let id = 0;
function puntero(b: Banco, tipo: string, pid: number, x: number, y: number, extra: Record<string, unknown> = {}): void {
  b.el.emitir(tipo, { pointerId: pid, clientX: x, clientY: y, button: 0, buttons: tipo === 'pointerup' ? 0 : 1, pointerType: 'touch', shiftKey: false, ctrlKey: false, metaKey: false, ...extra });
}

/** One finger from (x0, y0) to (x1, y1) in `n` steps, lifted only if `soltar`. */
function arrastrar(b: Banco, x0: number, y0: number, x1: number, y1: number, n = 10, soltar = true): number {
  const p = ++id;
  puntero(b, 'pointerdown', p, x0, y0);
  for (let i = 1; i <= n; i++) puntero(b, 'pointermove', p, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n);
  if (soltar) puntero(b, 'pointerup', p, x1, y1);
  return p;
}

/** Two fingers, each from its start to its end in `n` steps (moves interleaved as a touch screen sends them). */
function dosDedos(b: Banco, a0: [number, number], a1: [number, number], b0: [number, number], b1: [number, number], n = 12, soltar = true): [number, number] {
  const pa = ++id;
  const pb = ++id;
  puntero(b, 'pointerdown', pa, ...a0);
  puntero(b, 'pointerdown', pb, ...b0);
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    puntero(b, 'pointermove', pa, a0[0] + (a1[0] - a0[0]) * k, a0[1] + (a1[1] - a0[1]) * k);
    puntero(b, 'pointermove', pb, b0[0] + (b1[0] - b0[0]) * k, b0[1] + (b1[1] - b0[1]) * k);
  }
  if (soltar) {
    puntero(b, 'pointerup', pa, ...a1);
    puntero(b, 'pointerup', pb, ...b1);
  }
  return [pa, pb];
}

function angulos(b: Banco): { az: number; el: number } {
  return { az: b.o.azimut, el: b.o.elevacion };
}

test.describe('modo mapa', () => {
  for (const [nombre, ini] of [
    ['desde arriba', { azimut: 0, elevacion: Math.PI / 2 }],
    ['inclinada y girada', { azimut: 0.7, elevacion: 0.75 }],
  ] as const) {
    test(`un dedo desplaza y el punto agarrado sigue bajo el dedo (${nombre})`, () => {
      const b = banco(plana, ini);
      const p = b.o.puntoEnPlano(150, 320)!;
      expect(p.z).toBeCloseTo(0, 9);
      const antes = angulos(b);
      const d0 = b.o.distanciaReal;
      const pid = arrastrar(b, 150, 320, 250, 420, 10, false);
      const s = pantalla(b, p);
      expect(s.x).toBeCloseTo(250, 1);
      expect(s.y).toBeCloseTo(420, 1);
      expect(angulos(b)).toEqual(antes);
      expect(b.o.distanciaReal).toBeCloseTo(d0, 6);
      // the pivot stays on the board
      expect(b.o.objetivo.z).toBe(0);
      puntero(b, 'pointerup', pid, 250, 420);
    });
  }

  test('el pivote no sale de la placa', () => {
    const b = banco({ ...plana, limites: () => ({ x: 20, y: 10 }) });
    for (let i = 0; i < 6; i++) arrastrar(b, 50, 50, 390, 590);
    expect(Math.abs(b.o.objetivo.x)).toBeLessThanOrEqual(20);
    expect(Math.abs(b.o.objetivo.y)).toBeLessThanOrEqual(10);
  });

  test('la rueda (y el pellizco del trackpad, Ctrl + rueda) acercan hacia el punto bajo el cursor', () => {
    const b = banco(plana, { azimut: 0.3, elevacion: 0.9 });
    const p = b.o.puntoEnPlano(90, 160)!;
    const d0 = b.o.distanciaReal;
    b.el.emitir('wheel', { deltaY: -200, deltaMode: 0, ctrlKey: true, metaKey: false, clientX: 90, clientY: 160 });
    expect(b.o.distanciaReal).toBeLessThan(d0 * 0.7);
    const s = pantalla(b, p);
    expect(s.x).toBeCloseTo(90, 1);
    expect(s.y).toBeCloseTo(160, 1);
    expect(b.o.elevacion).toBe(0.9);
  });

  test('pellizcar con dos dedos acerca hacia los dedos sin inclinar ni girar', () => {
    const b = banco(plana);
    const antes = angulos(b);
    const p = b.o.puntoEnPlano(120, 400)!;
    const d0 = b.o.distanciaReal;
    // fingers around (120, 400), spreading apart (and a little drift and twist of a real hand)
    dosDedos(b, [90, 400], [40, 396], [150, 400], [200, 407]);
    expect(b.o.distanciaReal).toBeLessThan(d0 * 0.6);
    // the board point under the fingers' midpoint is the one that was under it (to the step at which the gesture was
    // told apart: half a finger's step, 0,4 mm at the starting zoom)
    const q = b.o.puntoEnPlano(120, 401.5)!;
    expect(q.distanceTo(p)).toBeLessThan(0.6);
    expect(angulos(b)).toEqual(antes);
  });

  test('dos dedos arrastrados juntos hacia arriba inclinan; hacia abajo vuelven a la vista desde arriba', () => {
    const b = banco(plana);
    const d0 = b.o.distanciaReal;
    const t0 = b.o.objetivo.clone();
    // below the threshold nothing happens
    dosDedos(b, [150, 400], [150, 395], [250, 400], [250, 394]);
    expect(b.o.elevacion).toBe(Math.PI / 2);
    dosDedos(b, [150, 400], [152, 300], [250, 400], [249, 302]);
    expect(b.o.elevacion).toBeLessThan(Math.PI / 2 - 0.2);
    expect(b.o.elevacion).toBeGreaterThanOrEqual(MAPA.elMin);
    expect(b.o.azimut).toBe(0);
    expect(b.o.distanciaReal).toBeCloseTo(d0, 6);
    expect(b.o.objetivo.distanceTo(t0)).toBeLessThan(1e-9);
    // the tilt is limited
    for (let i = 0; i < 5; i++) dosDedos(b, [150, 500], [150, 200], [250, 500], [250, 200]);
    expect(b.o.elevacion).toBeCloseTo(MAPA.elMin, 9);
    for (let i = 0; i < 5; i++) dosDedos(b, [150, 200], [150, 500], [250, 200], [250, 500]);
    expect(b.o.elevacion).toBeCloseTo(Math.PI / 2, 9);
  });

  test('clasificación de dos dedos: un pellizco o un desplazamiento nunca inclinan', () => {
    const c = (a0: [number, number], a: [number, number], b0: [number, number], bb: [number, number]) =>
      clasificarDos({ x: a0[0], y: a0[1] }, { x: b0[0], y: b0[1] }, { x: a[0], y: a[1] }, { x: bb[0], y: bb[1] });
    expect(c([100, 100], [104, 103], [200, 100], [203, 104])).toBeNull();
    // one finger's event came, the other's not yet
    expect(c([100, 100], [100, 75], [200, 100], [200, 100])).toBeNull();
    expect(c([100, 100], [100, 40], [200, 100], [200, 45])).toBe('inclinar');
    expect(c([100, 100], [100, 160], [200, 100], [201, 150])).toBe('inclinar');
    // a pinch (fingers apart), a sideways or diagonal two-finger pan, fingers one above the other, one finger only
    expect(c([100, 100], [60, 100], [200, 100], [240, 100])).toBe('pellizco');
    expect(c([100, 100], [160, 100], [200, 100], [260, 100])).toBe('pellizco');
    expect(c([100, 100], [140, 60], [200, 100], [240, 60])).toBe('pellizco');
    expect(c([150, 100], [150, 40], [150, 200], [150, 140])).toBe('pellizco');
    expect(c([100, 100], [100, 40], [200, 100], [200, 100])).toBe('pellizco');
    // a vertical pinch-out (fingers side by side, going opposite ways)
    expect(c([100, 100], [100, 60], [200, 100], [200, 140])).toBe('pellizco');
  });

  test('girar dos dedos más de 15° gira la placa; menos, no', () => {
    const b = banco(plana);
    const giro = (grados: number) => {
      const r = 60;
      const a = (grados * Math.PI) / 180;
      return dosDedos(b, [200 - r, 300], [200 - r * Math.cos(a), 300 - r * Math.sin(a)], [200 + r, 300], [200 + r * Math.cos(a), 300 + r * Math.sin(a)], 20);
    };
    giro(10);
    expect(b.o.azimut).toBe(0);
    expect(b.o.elevacion).toBe(Math.PI / 2);
    giro(50);
    // past the threshold the rest of the twist turns the board (about 50° − 15°), the angles of the view otherwise unchanged
    expect(b.o.azimut).toBeGreaterThan(0.5);
    expect(b.o.azimut).toBeLessThan((50 * Math.PI) / 180);
    expect(b.o.elevacion).toBe(Math.PI / 2);
  });

  test('al levantar un dedo tras dos no empieza otro gesto: el que queda desplaza solo al moverse, sin salto', () => {
    const b = banco(plana);
    const [pa, pb] = dosDedos(b, [150, 300], [120, 300], [250, 300], [280, 300], 12, false);
    const tras = { ...angulos(b), d: b.o.distanciaReal, t: b.o.objetivo.clone() };
    puntero(b, 'pointerup', pb, 280, 300);
    // small movements of the remaining finger: nothing
    puntero(b, 'pointermove', pa, 123, 302);
    puntero(b, 'pointermove', pa, 125, 303);
    expect(b.o.objetivo.distanceTo(tras.t)).toBe(0);
    expect(angulos(b)).toEqual({ az: tras.az, el: tras.el });
    expect(b.o.distanciaReal).toBe(tras.d);
    // then it pans from where it is
    puntero(b, 'pointermove', pa, 130, 306);
    const p = b.o.puntoEnPlano(130, 306)!;
    expect(b.o.objetivo.distanceTo(tras.t)).toBe(0);
    for (let x = 140; x <= 220; x += 10) puntero(b, 'pointermove', pa, x, 306 + (x - 130));
    const s = pantalla(b, p);
    expect(s.x).toBeCloseTo(220, 1);
    expect(s.y).toBeCloseTo(396, 1);
    expect(angulos(b)).toEqual({ az: tras.az, el: tras.el });
    puntero(b, 'pointerup', pa, 220, 396);
  });

  test('la cámara guarda su holgura sobre un chip y vuelve a bajar al pasarlo', () => {
    // a 10 mm high part, 10 × 10 mm, at the centre, with sides sloping at 2:1 (as escena3d.ts)
    const chip = (x: number, y: number) => Math.max(0, 10 - 2 * Math.hypot(Math.max(Math.abs(x) - 5, 0), Math.max(Math.abs(y) - 5, 0)));
    const b = banco({ ...plana, altura: chip });
    // zooming in at the chip stops above it
    for (let i = 0; i < 30; i++) b.el.emitir('wheel', { deltaY: -300, deltaMode: 0, ctrlKey: true, metaKey: false, clientX: W / 2, clientY: H / 2 });
    expect(b.cam.position.z).toBeGreaterThanOrEqual(10 + MAPA.holgura - 1e-6);
    expect(b.cam.position.z).toBeLessThan(10 + MAPA.holgura + 0.5);
    // a closer camera off the chip (5 mm over the board), then panned across it
    b.o.ir({ azimut: 0, elevacion: Math.PI / 2, distancia: 5, objetivo: new Vector3(-14, 0, 0) }, false);
    expect(b.cam.position.z).toBeCloseTo(5, 6);
    let max = 0;
    for (let n = 0; n < 80 && b.cam.position.x < 14; n++) {
      const p = ++id;
      puntero(b, 'pointerdown', p, 380, 300);
      for (let x = 380; x >= 20; x -= 4) {
        puntero(b, 'pointermove', p, x, 300);
        max = Math.max(max, b.cam.position.z);
        // never inside the part nor its clearance
        expect(b.cam.position.z).toBeGreaterThanOrEqual(chip(b.cam.position.x, b.cam.position.y) + MAPA.holgura - 1e-6);
      }
      puntero(b, 'pointerup', p, 20, 300);
    }
    expect(max).toBeGreaterThan(11);
    expect(b.cam.position.x).toBeGreaterThanOrEqual(14);
    // past it, down again to the distance asked for
    expect(b.cam.position.z).toBeCloseTo(5, 6);
  });

  test('teclado: flechas desplazan, Mayús + flechas giran e inclinan, + acerca', () => {
    const b = banco(plana);
    const tecla = (key: string, shiftKey = false) => b.el.emitir('keydown', { key, shiftKey });
    tecla('ArrowLeft');
    expect(b.o.objetivo.x).toBeLessThan(0);
    expect(b.o.azimut).toBe(0);
    tecla('ArrowLeft', true);
    expect(b.o.azimut).toBeCloseTo(0.2, 9);
    tecla('ArrowDown', true);
    expect(b.o.elevacion).toBeCloseTo(Math.PI / 2 - 0.2, 9);
    const d = b.o.distanciaReal;
    tecla('+');
    expect(b.o.distanciaReal).toBeCloseTo(d * 0.8, 6);
    let reinicio = 0;
    b.o.alReiniciar = () => {
      reinicio++;
      b.o.ir({ azimut: 0, elevacion: Math.PI / 2, distancia: 300, objetivo: new Vector3() }, true);
    };
    tecla('0');
    expect(reinicio).toBe(1);
    // the reset is animated: it goes on in the next frames (the key handler must not cancel it)
    expect(b.o.paso(performance.now() + 1000)).toBe(true);
    expect(b.o.distanciaReal).toBeCloseTo(300, 6);
  });

  test('ratón: botón izquierdo desplaza, botón derecho o Ctrl + arrastrar giran e inclinan', () => {
    const b = banco(plana);
    const raton = (extra: Record<string, unknown>) => {
      const p = ++id;
      puntero(b, 'pointerdown', p, 200, 300, { pointerType: 'mouse', ...extra });
      for (let i = 1; i <= 5; i++) puntero(b, 'pointermove', p, 200 + i * 10, 300 - i * 10, { pointerType: 'mouse', ...extra });
      puntero(b, 'pointerup', p, 250, 250, { pointerType: 'mouse', ...extra });
    };
    raton({});
    expect(angulos(b)).toEqual({ az: 0, el: Math.PI / 2 });
    raton({ button: 2 });
    expect(b.o.azimut).toBeLessThan(0);
    expect(b.o.elevacion).toBeLessThan(Math.PI / 2);
    const a = angulos(b);
    raton({ ctrlKey: true });
    expect(b.o.azimut).toBeLessThan(a.az);
  });

  test('Safari: el pellizco del trackpad (gesturechange) acerca hacia el cursor y no se cuenta dos veces', () => {
    const b = banco(plana);
    const p = b.o.puntoEnPlano(100, 100)!;
    const d0 = b.o.distanciaReal;
    b.el.emitir('gesturestart', { scale: 1, rotation: 0, clientX: 100, clientY: 100 });
    b.el.emitir('gesturechange', { scale: 2, rotation: 0, clientX: 100, clientY: 100 });
    // (the same pinch as Ctrl + wheel, if WebKit sends it too)
    b.el.emitir('wheel', { deltaY: -100, deltaMode: 0, ctrlKey: true, metaKey: false, clientX: 100, clientY: 100 });
    b.el.emitir('gestureend', { scale: 2, rotation: 0, clientX: 100, clientY: 100 });
    expect(b.o.distanciaReal).toBeCloseTo(d0 / 2, 6);
    const s = pantalla(b, p);
    expect(s.x).toBeCloseTo(100, 1);
    expect(s.y).toBeCloseTo(100, 1);
  });

  test('inercia al soltar un desplazamiento en movimiento, ninguna tras una pausa', async () => {
    const b = banco(plana);
    const p = ++id;
    puntero(b, 'pointerdown', p, 100, 300);
    for (let i = 1; i <= 8; i++) {
      await new Promise((r) => setTimeout(r, 16));
      puntero(b, 'pointermove', p, 100 + i * 15, 300);
    }
    puntero(b, 'pointerup', p, 220, 300);
    const x0 = b.o.objetivo.x;
    let t = performance.now();
    for (let i = 0; i < 5; i++) b.o.paso((t += 16));
    expect(b.o.objetivo.x).toBeLessThan(x0 - 0.1);
    // after a pause before the release: none
    const q = ++id;
    puntero(b, 'pointerdown', q, 100, 300);
    puntero(b, 'pointermove', q, 160, 300);
    await new Promise((r) => setTimeout(r, 150));
    puntero(b, 'pointerup', q, 160, 300);
    const x1 = b.o.objetivo.x;
    expect(b.o.paso(performance.now() + 16)).toBe(false);
    expect(b.o.objetivo.x).toBe(x1);
  });
});

test('modo órbita (la galería de componentes) sigue girando con un dedo', () => {
  const b = banco(null, { azimut: 0.5, elevacion: 0.55, distancia: 40 });
  arrastrar(b, 200, 300, 260, 260);
  expect(b.o.azimut).toBeLessThan(0.5);
  expect(b.o.elevacion).not.toBe(0.55);
});
