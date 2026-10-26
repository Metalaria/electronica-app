// 0.8 performance work: adaptive resolution while orbiting (the drawing buffer gets fewer pixels while the view
// moves on a GPU that cannot keep 60 frames per second, and the full resolution comes back at rest), the board's
// faces painted progressively (a worker or bands, uploaded in strips) without long tasks on the page's thread,
// and the component viewer's shaders compiled before its first frame.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.rendimiento.config.ts tests/rendimiento.spec.ts
// Chromium runs WebGL on SwiftShader here (the CPU): frames take hundreds of ms, so the resolution always drops.
import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });

type Res = { base: number; actual: number; minima: number; cambios: number };

/**
 * Drags over `selector` for `ms` (or until its drawing buffer is narrower than `hastaAncho`) with synthetic pointer events sent from the page every animation frame (as the
 * diagnostic does: Playwright's mouse waits for a frame per move, seconds with SwiftShader), sampling the
 * canvas's drawing-buffer width; returns the samples.
 */
async function arrastrar(page: Page, selector: string, ms: number, hastaAncho = 0): Promise<number[]> {
  return page.evaluate(
    async ([sel, dur, hasta]) => {
      const c = document.querySelector(sel) as HTMLCanvasElement;
      const r = c.getBoundingClientRect();
      const x0 = r.left + r.width / 2;
      const y0 = r.top + r.height / 2;
      const ev = (t: string, x: number, y: number) =>
        c.dispatchEvent(new PointerEvent(t, { pointerId: 7, clientX: x, clientY: y, bubbles: true, button: 0, buttons: t === 'pointerup' ? 0 : 1, pointerType: 'mouse' }));
      const anchos: number[] = [];
      ev('pointerdown', x0, y0);
      const t0 = performance.now();
      while (performance.now() - t0 < dur) {
        await new Promise((res) => requestAnimationFrame(res));
        const dt = performance.now() - t0;
        ev('pointermove', x0 + Math.sin(dt / 700) * r.width * 0.3, y0 + Math.sin(dt / 1100) * r.height * 0.12);
        anchos.push(c.width);
        // Enough: the drawing buffer is already smaller (SwiftShader may draw one frame per second or less).
        if (c.width < hasta) break;
      }
      // Release after a short pause: no inertia (it would keep the view moving for minutes at SwiftShader's pace).
      await new Promise((res) => setTimeout(res, 150));
      ev('pointerup', x0, y0);
      return anchos;
    },
    [selector, ms, hastaAncho] as const,
  );
}

test('placa en 3D: menos resolución al girar y la completa en reposo', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('#/proyectos/sdr/3d');
  await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo === true, null, { timeout: 240_000 });
  await page.waitForTimeout(500);
  const ancho0 = await page.locator('.v3d canvas').evaluate((c) => (c as HTMLCanvasElement).width);
  const anchos = await arrastrar(page, '.v3d canvas', 60_000, ancho0 * 0.9);
  expect(Math.min(...anchos)).toBeLessThan(ancho0 * 0.9);
  // At rest: the full resolution again (with a final frame).
  await expect.poll(() => page.locator('.v3d canvas').evaluate((c) => (c as HTMLCanvasElement).width), { timeout: 90_000 }).toBe(ancho0);
  const r = await page.evaluate(() => (globalThis as unknown as { __epaPlaca3D: { resolucion: Res } }).__epaPlaca3D.resolucion);
  expect(r.cambios).toBeGreaterThan(0);
  expect(r.minima).toBeLessThan(r.base);
  expect(r.actual).toBe(r.base);
});

test('visor de componentes: menos resolución al girar, la completa en reposo, sombreadores antes del primer cuadro', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('#/componentes/3d/qfp');
  await page.waitForFunction(() => ((globalThis as unknown as { __epa3d?: { n: number } }).__epa3d?.n ?? 0) > 0, null, { timeout: 120_000 });
  await expect(page.locator('.visor3d .cargando')).toHaveCount(0);
  const prep = await page.evaluate(() => (globalThis as unknown as { __epaVisor3d: { visor: { preparacion: { compilar: number; primerCuadro: number; programas: number } } } }).__epaVisor3d.visor.preparacion);
  expect(prep.compilar).toBeGreaterThan(0);
  expect(prep.primerCuadro).toBeGreaterThanOrEqual(prep.compilar);
  expect(prep.programas).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  const ancho0 = await page.locator('.visor3d canvas').evaluate((c) => (c as HTMLCanvasElement).width);
  const anchos = await arrastrar(page, '.visor3d canvas', 60_000, ancho0 * 0.9);
  expect(Math.min(...anchos)).toBeLessThan(ancho0 * 0.9);
  await expect.poll(() => page.locator('.visor3d canvas').evaluate((c) => (c as HTMLCanvasElement).width), { timeout: 90_000 }).toBe(ancho0);
  const r = await page.evaluate(() => (globalThis as unknown as { __epa3d: { resolucion: Res } }).__epa3d.resolucion);
  expect(r.cambios).toBeGreaterThan(0);
  expect(r.actual).toBe(r.base);
});

/** Opens the SDR board with the faces painted in `modo` and returns their phases and the page's longest gap
 *  while the full-resolution faces were being made (a 4 ms timer chain). */
async function caras(page: Page, modo: string) {
  await page.addInitScript((m) => localStorage.setItem('epa-caras', m), modo);
  await page.addInitScript(() => {
    const g = globalThis as unknown as { __latido: { max: number; desde: number; previo: number } };
    g.__latido = { max: 0, desde: Infinity, previo: performance.now() };
    const latir = () => {
      const t = performance.now();
      if (t >= g.__latido.desde) g.__latido.max = Math.max(g.__latido.max, t - g.__latido.previo);
      g.__latido.previo = t;
      setTimeout(latir, 4);
    };
    setTimeout(latir, 4);
  });
  await page.goto('#/proyectos/sdr/3d');
  await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo === true, null, { timeout: 240_000 });
  // The full faces start after the first frame with the parts: watch the page from now on.
  await page.evaluate(() => {
    const g = globalThis as unknown as { __latido: { max: number; desde: number } };
    g.__latido.desde = performance.now();
    g.__latido.max = 0;
  });
  await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3D: { carasFinas?: number } }).__epaPlaca3D.carasFinas != null, null, { timeout: 240_000 });
  return page.evaluate(() => {
    const g = globalThis as unknown as {
      __epaPlaca3D: { fasesCaras: { modo: string; completa: { modo: string; motivo?: string; maxTarea: number; franjas: number; total: number } } };
      __latido: { max: number };
    };
    return { fases: g.__epaPlaca3D.fasesCaras, latido: g.__latido.max };
  });
}

test('caras de la placa pintadas por un trabajador: ninguna tarea de la página pasa de 50 ms', async ({ page }) => {
  test.setTimeout(300_000);
  const r = await caras(page, 'trabajador');
  expect(r.fases.modo).toBe('trabajador');
  expect(r.fases.completa.motivo ?? '').toBe('');
  expect(r.fases.completa.modo).toBe('trabajador');
  expect(r.fases.completa.franjas).toBeGreaterThan(10);
  // The work of the faces on the page's thread (strip uploads) never lasts 50 ms in one task.
  expect(r.fases.completa.maxTarea).toBeLessThan(50);
  console.log(`trabajador: ${Math.round(r.fases.completa.total)} ms, tarea más larga ${r.fases.completa.maxTarea.toFixed(1)} ms, hueco más largo de la página ${r.latido.toFixed(0)} ms`);
});

test('caras de la placa en franjas en el hilo de la página (sin trabajador): se completan', async ({ page }) => {
  test.setTimeout(300_000);
  const r = await caras(page, 'franjas');
  expect(r.fases.completa.modo).toBe('franjas');
  expect(r.fases.completa.franjas).toBeGreaterThan(10);
  console.log(`franjas: ${Math.round(r.fases.completa.total)} ms, tarea más larga ${r.fases.completa.maxTarea.toFixed(1)} ms, hueco más largo de la página ${r.latido.toFixed(0)} ms`);
});
