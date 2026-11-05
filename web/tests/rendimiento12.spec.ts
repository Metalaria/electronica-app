// 0.12 performance of the 3D boards (QA 0.11, «equipo lento»: the IoT board took 40–47 s to show with CPU ×4 and
// Fast 3G). What it found and what these tests keep fixed:
// - the studio's room environment (a PMREM) was filtered again by every 3D view: with a software GPU that alone took
//   8–9 s and blocked the page (any synchronous GL call waited for it); now it is filtered once per device, read
//   back without blocking, kept in memory and in IndexedDB, and later views upload those exact pixels;
// - the view's code (three.js) was fetched only after the board's data, and the model library only after the scene;
// - Chromium's Path2D.closePath() costs time proportional to the whole path, so closing every pad made building the
//   board geometry quadratic (the Neo Geo: about 3 s of the page's thread with a 4× slower CPU);
// - the canvas was resized after the environment's GPU work was queued (the resize checks the drawing buffer
//   synchronously) and the board's programs were linked while it ran.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.rendimiento12.config.ts tests/rendimiento12.spec.ts
// Budgets have a wide margin: this runs WebGL on SwiftShader (the CPU) on a shared 2-core machine.
import { expect, test, type Page } from '@playwright/test';

interface Stats {
  cuadros: number;
  llamadas: number;
  primerCuadroPlaca?: number;
  carasFinas?: number;
  ladoCaras?: number;
  entorno?: 'pmrem' | 'memoria' | null;
  fases?: { maxTramo?: number };
}
interface Entorno {
  origen: 'pmrem' | 'memoria' | null;
  lectura: string;
  guardado: boolean;
  leidoDeBd: boolean;
  error: string;
}
type G = typeof globalThis & { __epaPlaca3D?: Stats; __epaPlaca3DListo?: boolean; __epaEntorno?: Entorno };

const IOT = '#/proyectos/estacion_iot/3d';

/** Opens a 3D board by its hash (in the page already loaded) and waits for its parts and its full faces. */
async function abrir(page: Page, hash: string, ms = 240_000): Promise<Stats> {
  await page.evaluate((h) => {
    const g = globalThis as G;
    g.__epaPlaca3D = undefined;
    g.__epaPlaca3DListo = false;
    location.hash = h;
  }, hash);
  await page.waitForFunction(() => (globalThis as G).__epaPlaca3DListo === true && (globalThis as G).__epaPlaca3D?.carasFinas != null, null, { timeout: ms, polling: 250 });
  return page.evaluate(() => JSON.parse(JSON.stringify((globalThis as G).__epaPlaca3D)) as Stats);
}

async function salir(page: Page): Promise<void> {
  await page.evaluate(() => (location.hash = '#/'));
  await page.waitForTimeout(500);
}

const entorno = (page: Page) => page.evaluate(() => (globalThis as G).__epaEntorno ?? null);

/** Pixels (of two PNG screenshots of the same size) whose channels differ by more than `tol`, and the largest gap. */
async function diferencia(page: Page, a: Buffer, b: Buffer, tol = 2): Promise<{ distintos: number; total: number; max: number }> {
  return page.evaluate(
    async ([x, y, t]) => {
      const imagen = async (s: string) => {
        const bin = atob(s);
        const u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        return createImageBitmap(new Blob([u], { type: 'image/png' }));
      };
      const [A, B] = [await imagen(x), await imagen(y)];
      if (A.width !== B.width || A.height !== B.height) return { distintos: -1, total: 0, max: 255 };
      const c = new OffscreenCanvas(A.width, A.height);
      const k = c.getContext('2d')!;
      k.drawImage(A, 0, 0);
      const da = k.getImageData(0, 0, A.width, A.height).data;
      k.clearRect(0, 0, A.width, A.height);
      k.drawImage(B, 0, 0);
      const db = k.getImageData(0, 0, A.width, A.height).data;
      let distintos = 0;
      let max = 0;
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.max(Math.abs(da[i]! - db[i]!), Math.abs(da[i + 1]! - db[i + 1]!), Math.abs(da[i + 2]! - db[i + 2]!));
        if (d > t) distintos++;
        max = Math.max(max, d);
      }
      return { distintos, total: da.length / 4, max };
    },
    [a.toString('base64'), b.toString('base64'), tol] as const,
  );
}

test('entorno del estudio: se filtra una vez, la placa siguiente usa esos píxeles y se ve igual', async ({ page }, info) => {
  await page.goto('#/');
  const primera = await abrir(page, IOT);
  expect(primera.entorno).toBe('pmrem');
  // Android keeps the 0.9.2 face size (ladoCarasDispositivo): 2048 px; elsewhere 4096
  expect(primera.ladoCaras).toBe(info.project.name === 'tableta' ? 2048 : 4096);
  await expect.poll(async () => (await entorno(page))?.lectura, { timeout: 120_000 }).toBe('leído');
  expect((await entorno(page))?.error).toBe('');
  await page.waitForTimeout(1500);
  const a = await page.locator('.v3d canvas').screenshot();
  await salir(page);

  const segunda = await abrir(page, IOT);
  expect(segunda.entorno).toBe('memoria');
  expect(segunda.llamadas).toBe(primera.llamadas);
  await page.waitForTimeout(1500);
  const b = await page.locator('.v3d canvas').screenshot();
  // the saved half floats are the PMREM's own: the same picture
  const d = await diferencia(page, a, b);
  expect(d.distintos).toBeGreaterThanOrEqual(0);
  expect(d.distintos / d.total).toBeLessThan(0.001);
  await salir(page);

  // a new session reads it from IndexedDB (its own database, «epa-cache-3d»)
  await expect.poll(async () => (await entorno(page))?.guardado, { timeout: 30_000 }).toBe(true);
  await page.reload();
  const tercera = await abrir(page, IOT);
  expect(tercera.entorno).toBe('memoria');
  expect((await entorno(page))?.leidoDeBd).toBe(true);
  await page.waitForTimeout(1500);
  const c = await page.locator('.v3d canvas').screenshot();
  expect((await diferencia(page, a, c)).distintos / d.total).toBeLessThan(0.001);
});

test('entorno: se guarda aunque se deje la placa antes de que termine, y su contexto WebGL se suelta después', async ({ page }) => {
  // every WebGL context the page creates
  await page.addInitScript(() => {
    const w = window as unknown as { __ctxs: unknown[] };
    w.__ctxs = [];
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, tipo: string, ...resto: unknown[]) {
      const c = (original as (t: string, ...r: unknown[]) => unknown).call(this, tipo, ...resto);
      if (c && /webgl/.test(tipo) && !w.__ctxs.includes(c)) w.__ctxs.push(c);
      return c;
    } as typeof original;
  });
  await page.goto('#/');
  await page.evaluate((h) => (location.hash = h), IOT);
  // left as soon as the scene exists (the QA's slow-device run leaves at the first content)
  await page.waitForFunction(() => !!(globalThis as G).__epaPlaca3D, null, { timeout: 120_000, polling: 100 });
  await salir(page);
  await expect.poll(async () => (await entorno(page))?.lectura, { timeout: 120_000 }).toBe('leído');
  // nothing left alive: the closed view's context goes once the read-back is done
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __ctxs: WebGLRenderingContext[] }).__ctxs.filter((c) => !c.isContextLost()).length), { timeout: 70_000 })
    .toBe(0);
  const s = await abrir(page, IOT);
  expect(s.entorno).toBe('memoria');
});

test('entorno: la primera vista del dispositivo dibuja la placa antes de leer el entorno de la GPU', async ({ page }) => {
  // every float read-back (the environment's) with the frames the board had drawn when it was issued
  await page.addInitScript(() => {
    const w = window as unknown as { __lecturas: { cuadros: number; t: number }[]; __epaPlaca3D?: { cuadros: number } };
    w.__lecturas = [];
    const original = WebGL2RenderingContext.prototype.readPixels;
    WebGL2RenderingContext.prototype.readPixels = function (this: WebGL2RenderingContext, ...a: unknown[]) {
      if (a[5] === this.FLOAT) w.__lecturas.push({ cuadros: w.__epaPlaca3D?.cuadros ?? 0, t: performance.now() });
      return (original as (...x: unknown[]) => void).apply(this, a);
    } as typeof original;
  });
  await page.goto('#/');
  const s = await abrir(page, IOT);
  expect(s.entorno).toBe('pmrem');
  await expect.poll(async () => (await entorno(page))?.lectura, { timeout: 120_000 }).toBe('leído');
  const lecturas = await page.evaluate(() => (window as unknown as { __lecturas: { cuadros: number }[] }).__lecturas);
  expect(lecturas.length).toBe(1);
  // 0.12 first version: issued in the constructor, right behind the filtering (0 frames): the cold board 2–3 s later
  expect(lecturas[0]!.cuadros).toBeGreaterThanOrEqual(1);
});

test('equipo lento (CPU ×4): con el entorno ya guardado, la placa IoT se ve enseguida y sin tramos largos de piezas', async ({ page }, info) => {
  test.skip(info.project.name !== 'tableta', 'el perfil de la tableta');
  await page.goto('#/');
  await abrir(page, IOT);
  // (a build without the saved environment has no __epaEntorno: then the budget below is what fails)
  if (await entorno(page)) await expect.poll(async () => (await entorno(page))?.lectura, { timeout: 120_000 }).toBe('leído');
  await salir(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  const s = await abrir(page, IOT, 120_000);
  const total = Date.now() - t0;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log(`IoT ×4: primer cuadro ${Math.round(s.primerCuadroPlaca ?? -1)} ms tras crear la escena, todo ${total} ms, tramo más largo de las piezas ${Math.round(s.fases?.maxTramo ?? -1)} ms`);
  // 0.11: 6.7–19 s (the environment filtered again, blocking); 0.12 here: 0.45–1.7 s
  expect(s.primerCuadroPlaca!).toBeLessThan(4000);
  expect(s.entorno).toBe('memoria');
  // the parts in slices (0.9): the longest stretch of their own work between two pauses
  expect(s.fases!.maxTramo!).toBeLessThan(400);
});

test('geometría de la placa: Path2D.closePath no se llama por cada pad (era cuadrático en Chromium)', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __cierres: number };
    w.__cierres = 0;
    const original = Path2D.prototype.closePath;
    Path2D.prototype.closePath = function (this: Path2D) {
      w.__cierres++;
      return original.call(this);
    };
  });
  await page.goto('#/consolas/neogeo/placa2d');
  await page.waitForFunction(() => !!(globalThis as unknown as { __epaPlacaVista?: unknown }).__epaPlacaVista || !!document.querySelector('.cuerpo canvas'), null, { timeout: 120_000 });
  await page.waitForTimeout(2000);
  const cierres = await page.evaluate(() => (window as unknown as { __cierres: number }).__cierres);
  // 0.11: one per pad, drill slot, zone and silkscreen fill (over 20 000 on this board)
  expect(cierres).toBeLessThan(200);
  // and the board is drawn: its pads are hit-tested through these (now open) subpaths
  await expect(page.locator('.cuerpo canvas').first()).toBeVisible();
});

test('la vista 3D (three.js) se pide junto con los datos de la placa, no después', async ({ page }) => {
  await page.goto('#/');
  await page.waitForTimeout(1000);
  const pedidos: [string, number][] = [];
  const t0 = Date.now();
  page.on('request', (r) => pedidos.push([new URL(r.url()).pathname, Date.now() - t0]));
  let entregada = Infinity;
  // the board's data arrives late (a slow network)
  await page.route('**/proyectos/estacion_iot.json', async (rt) => {
    await new Promise((r) => setTimeout(r, 2500));
    entregada = Date.now() - t0;
    await rt.continue();
  });
  await page.evaluate((h) => (location.hash = h), IOT);
  await page.waitForFunction(() => (globalThis as G).__epaPlaca3DListo === true, null, { timeout: 240_000, polling: 250 });
  const tres = pedidos.find(([u]) => /\/assets\/three\.core-[^/]*\.js$/.test(u) || /\/assets\/Vista3D-[^/]*\.js$/.test(u));
  expect(tres, 'el código de la vista 3D se pidió').toBeTruthy();
  // 0.11: only once the data was there and its geometry built
  expect(tres![1]).toBeLessThan(entregada);
});
