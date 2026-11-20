// 1.3, item 2: a console board in 3D navigated like a map on the owner's phone (Pixel 8 Pro: 412 × 915 CSS px,
// DPR 3.5, touch), with real multi-touch sent through CDP (Input.dispatchTouchEvent) on the Super Nintendo's board:
// one finger pans without turning or tilting, a pinch zooms toward the fingers without tilting, two fingers dragged
// up together tilt, lifting one finger after a pinch moves nothing, a double tap brings a part to the middle and
// closer; the board opens from straight above, and «Vista desde arriba» straightens a tilted view in place.
// The camera is read from the scene (globalThis.__epaPlaca3DEscena, set by proyectos/Vista3D.svelte).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config with its own port> tests/orbita13-navegador.spec.ts
import { expect, test, type CDPSession, type Page } from '@playwright/test';

test.use({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true });
test.describe.configure({ mode: 'serial' });

type Camara = { az: number; el: number; d: number; t: [number, number, number] };

async function abrir(page: Page): Promise<{ x: number; y: number; w: number; h: number }> {
  await page.goto('#/consolas/snes/placa3d');
  await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo === true, null, { timeout: 300_000 });
  const lienzo = page.locator('.v3d canvas');
  await lienzo.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const b = (await lienzo.boundingBox())!;
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

function camara(page: Page): Promise<Camara> {
  return page.evaluate(() => {
    const o = (globalThis as unknown as { __epaPlaca3DEscena: { orbita: { azimut: number; elevacion: number; distanciaReal: number; objetivo: { x: number; y: number; z: number } } } }).__epaPlaca3DEscena.orbita;
    return { az: o.azimut, el: o.elevacion, d: o.distanciaReal, t: [o.objetivo.x, o.objetivo.y, o.objetivo.z] as [number, number, number] };
  });
}

/** Board point (world) under a canvas point. */
function bajo(page: Page, px: number, py: number): Promise<[number, number, number] | null> {
  return page.evaluate(
    ([x, y]) => {
      const o = (globalThis as unknown as { __epaPlaca3DEscena: { orbita: { puntoEnPlano(x: number, y: number): { x: number; y: number; z: number } | null } } }).__epaPlaca3DEscena.orbita;
      const p = o.puntoEnPlano(x!, y!);
      return p ? ([p.x, p.y, p.z] as [number, number, number]) : null;
    },
    [px, py],
  );
}

/** Canvas point of a world point. */
function pantalla(page: Page, p: [number, number, number]): Promise<[number, number]> {
  return page.evaluate((q) => {
    type V = { x: number; y: number; set(x: number, y: number, z: number): V; clone(): V; project(c: unknown): V };
    const e = (globalThis as unknown as { __epaPlaca3DEscena: { camara: unknown; orbita: { objetivo: V; elemento: HTMLElement } } }).__epaPlaca3DEscena;
    const v = e.orbita.objetivo.clone().set(q[0], q[1], q[2]).project(e.camara);
    const el = e.orbita.elemento;
    return [((v.x + 1) / 2) * el.clientWidth, ((1 - v.y) / 2) * el.clientHeight] as [number, number];
  }, p);
}

type Toque = { x: number; y: number; id: number };
const tocar = (cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: Toque[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });

/** Fingers from `de` to `a` (viewport px) in `n` steps; lifted at the end unless `soltar` is false. */
async function dedos(cdp: CDPSession, de: [number, number][], a: [number, number][], n = 14, soltar = true): Promise<void> {
  const en = (k: number) => de.map(([x, y], i) => ({ x: x + (a[i]![0] - x) * k, y: y + (a[i]![1] - y) * k, id: i + 1 }));
  // (one finger first, then the others: as a hand puts them down)
  await tocar(cdp, 'touchStart', en(0).slice(0, 1));
  if (de.length > 1) await tocar(cdp, 'touchStart', en(0));
  for (let i = 1; i <= n; i++) await tocar(cdp, 'touchMove', en(i / n));
  if (soltar) await tocar(cdp, 'touchEnd', []);
}

test('la placa se abre desde arriba; un dedo la desplaza sin girarla ni inclinarla, con el punto bajo el dedo', async ({ page }) => {
  test.setTimeout(600_000);
  const c = await abrir(page);
  const cdp = await page.context().newCDPSession(page);
  const c0 = await camara(page);
  expect(c0.el).toBeCloseTo(Math.PI / 2, 6);
  expect(c0.az).toBeCloseTo(0, 6);
  const px = c.w * 0.4;
  const py = c.h * 0.45;
  const agarrado = (await bajo(page, px, py))!;
  await dedos(cdp, [[c.x + px, c.y + py]], [[c.x + px + 90, c.y + py + 70]], 14, false);
  const c1 = await camara(page);
  expect(c1.el).toBe(c0.el);
  expect(c1.az).toBe(c0.az);
  expect(Math.hypot(c1.t[0] - c0.t[0], c1.t[1] - c0.t[1])).toBeGreaterThan(1);
  expect(c1.t[2]).toBe(c0.t[2]);
  const s = await pantalla(page, agarrado);
  expect(Math.hypot(s[0] - (px + 90), s[1] - (py + 70))).toBeLessThan(2);
  await tocar(cdp, 'touchEnd', []);
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
});

test('pellizcar acerca hacia los dedos sin inclinar ni girar; al levantar un dedo no se mueve nada', async ({ page }) => {
  test.setTimeout(600_000);
  const c = await abrir(page);
  const cdp = await page.context().newCDPSession(page);
  const c0 = await camara(page);
  // fingers round a point off the middle of the view
  const mx = c.w * 0.32;
  const my = c.h * 0.6;
  const punto = (await bajo(page, mx, my))!;
  await dedos(
    cdp,
    [
      [c.x + mx - 25, c.y + my],
      [c.x + mx + 25, c.y + my],
    ],
    [
      [c.x + mx - 100, c.y + my + 3],
      [c.x + mx + 100, c.y + my - 2],
    ],
    16,
    false,
  );
  const c1 = await camara(page);
  expect(c1.d).toBeLessThan(c0.d * 0.5);
  expect(c1.el).toBe(c0.el);
  expect(c1.az).toBe(c0.az);
  // the board point that was between the fingers is still between them (within a few px of the zoomed view)
  const s = await pantalla(page, punto);
  expect(Math.hypot(s[0] - mx, s[1] - (my + 0.5))).toBeLessThan(12);
  // one finger lifts; the other moves a little: nothing changes (no switch to turning, no jump)
  // (CDP: touchEnd with points lifts those points; the others stay down)
  await tocar(cdp, 'touchEnd', [{ x: c.x + mx + 100, y: c.y + my - 2, id: 2 }]);
  await tocar(cdp, 'touchMove', [{ x: c.x + mx - 97, y: c.y + my + 5, id: 1 }]);
  await tocar(cdp, 'touchMove', [{ x: c.x + mx - 95, y: c.y + my + 7, id: 1 }]);
  const c2 = await camara(page);
  expect(c2).toEqual(c1);
  await tocar(cdp, 'touchEnd', []);
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
});

test('dos dedos arrastrados juntos hacia arriba inclinan la placa; «Vista desde arriba» la endereza en su sitio', async ({ page }) => {
  test.setTimeout(600_000);
  const c = await abrir(page);
  const cdp = await page.context().newCDPSession(page);
  const c0 = await camara(page);
  const y = c.y + c.h * 0.75;
  await dedos(
    cdp,
    [
      [c.x + c.w * 0.3, y],
      [c.x + c.w * 0.7, y],
    ],
    [
      [c.x + c.w * 0.3 + 2, y - 220],
      [c.x + c.w * 0.7 - 1, y - 215],
    ],
  );
  const c1 = await camara(page);
  expect(c1.el).toBeLessThan(c0.el - 0.3);
  expect(c1.el).toBeGreaterThanOrEqual(Math.PI / 6 - 1e-9);
  expect(c1.az).toBe(c0.az);
  expect(c1.d).toBeCloseTo(c0.d, 3);
  expect(c1.t).toEqual(c0.t);
  // straightened: from above again, the same pivot and zoom
  await page.getByRole('button', { name: 'Vista desde arriba' }).click();
  await expect.poll(async () => (await camara(page)).el, { timeout: 60_000 }).toBeCloseTo(Math.PI / 2, 6);
  const c2 = await camara(page);
  expect(c2.t).toEqual(c1.t);
  expect(c2.d).toBeCloseTo(c1.d, 3);
});

test('doble toque sobre un componente lo lleva al centro y lo acerca', async ({ page }) => {
  test.setTimeout(600_000);
  const c = await abrir(page);
  const cdp = await page.context().newCDPSession(page);
  const c0 = await camara(page);
  // the S-CPU (U1): where it is on screen, away from the middle
  const u1 = await page.evaluate(([w, h]) => {
    const e = (globalThis as unknown as { __epaPlaca3DEscena: { d: { huellas: { r: string }[] }; proyectar(i: number, w: number, h: number): [number, number] | null } }).__epaPlaca3DEscena;
    const i = e.d.huellas.findIndex((x) => x.r === 'U1');
    return { i, p: e.proyectar(i, w!, h!) };
  }, [c.w, c.h]);
  expect(u1.i).toBeGreaterThanOrEqual(0);
  const [ux, uy] = u1.p!;
  expect(Math.hypot(ux - c.w / 2, uy - c.h / 2)).toBeGreaterThan(20);
  // two taps 150 ms apart, as the finger gives them (the input's own times: SwiftShader keeps the page busy with the
  // first tap's selection for longer than that)
  const t0 = Date.now() / 1000;
  for (let k = 0; k < 2; k++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x + ux, y: c.y + uy, id: 1 }], timestamp: t0 + k * 0.15 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: t0 + k * 0.15 + 0.06 });
  }
  // the first tap chose it
  await expect(page.locator('.v3d .etiqueta')).toContainText('U1');
  await expect
    .poll(
      async () =>
        page.evaluate(([w, h]) => {
          const e = (globalThis as unknown as { __epaPlaca3DEscena: { d: { huellas: { r: string }[] }; proyectar(i: number, w: number, h: number): [number, number] | null } }).__epaPlaca3DEscena;
          const p = e.proyectar(e.d.huellas.findIndex((x) => x.r === 'U1'), w!, h!);
          return p ? Math.hypot(p[0] - w! / 2, p[1] - h! / 2) : 1e9;
        }, [c.w, c.h]),
      { timeout: 120_000 },
    )
    .toBeLessThan(6);
  const c1 = await camara(page);
  expect(c1.d).toBeLessThan(c0.d * 0.7);
  expect(c1.el).toBe(c0.el);
  expect(c1.az).toBe(c0.az);
});
