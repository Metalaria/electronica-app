// 1.4.1 (brymen141): the real Brymen keeps about three readings a second with the window covered. A browser slows a
// covered page's timers to about one a second; Playwright keeps its pages visible, so the test slows the page's own
// timers itself (every wait of 100 ms or more lasts at least a second, as Chrome does) and checks that the pause
// between requests runs on the worker's clock, which that does not touch: before 1.4.1 this gave one reading a second.
// The fake cable (window.__epaBrymenFalso) answers at once. «Diagnóstico» says which clock is in use.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.brymen13.config.ts tests/brymen141-navegador.spec.ts
import { test, expect, type Page } from '@playwright/test';
import { construirPaquete } from '../src/lib/brymen-real/protocolo.ts';

const BANCO = '/#/instrumentos/circuito/cap05/sec-5.3_led_150ohm';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'escritorio'));

async function conCable(page: Page, lenta: boolean) {
  await page.addInitScript((lenta) => {
    const w = window as unknown as { __epaBrymenFalso: unknown };
    w.__epaBrymenFalso = { respuesta: null, fija: true };
    if (lenta) {
      // a covered window: the page's timers of 100 ms or more wait at least a second (workers are not affected)
      const original = window.setTimeout.bind(window);
      (window as unknown as { setTimeout: unknown }).setTimeout = (f: () => void, ms?: number, ...a: unknown[]) =>
        original(f, (ms ?? 0) >= 100 ? Math.max(ms ?? 0, 1000) : ms, ...a);
    }
  }, lenta);
}

async function conectar(page: Page) {
  await page.goto(BANCO);
  await expect(page.locator('.elegir h2')).toBeVisible({ timeout: 60_000 });
  await page.evaluate((p) => {
    (window as unknown as { __epaBrymenFalso: { respuesta: number[] } }).__epaBrymenFalso.respuesta = p;
  }, Array.from(construirPaquete({ principal: '9.2040', unidad: 'V', dc: true, auto: true })));
  const panel = page.locator('.elegir [data-brymen-real]');
  await panel.getByRole('button', { name: 'Conectar el Brymen real' }).click();
  await expect(panel).toHaveAttribute('data-conexion-real', 'conectado');
  return panel;
}

async function paquetes(page: Page): Promise<number> {
  const t = (await page.locator('.elegir [data-brymen-real] .br-diag').textContent()) ?? '';
  return Number(/paquetes recibidos: (\d+)/.exec(t)?.[1] ?? NaN);
}

async function ritmo(page: Page): Promise<number> {
  const a = await paquetes(page);
  const t0 = Date.now();
  await page.waitForTimeout(4000);
  return ((await paquetes(page)) - a) / ((Date.now() - t0) / 1000);
}

test('con la ventana tapada, el Brymen sigue dando unas tres lecturas por segundo', async ({ page }) => {
  const workers: string[] = [];
  page.on('worker', (w) => workers.push(w.url()));
  await conCable(page, true);
  const panel = await conectar(page);
  await expect(panel.locator('[data-reloj-real]')).toHaveAttribute('data-reloj-real', 'worker');
  await expect(panel.locator('[data-reloj-real]')).toContainText('sigue a su ritmo con la ventana tapada');
  expect(workers.some((u) => /reloj/.test(u))).toBe(true);
  const r = await ritmo(page);
  // pause 250 ms + the fake cable's 30 ms: about 3.5 a second; the page's own timer would give 1
  expect(r).toBeGreaterThan(2.5);
});

test('sin worker, la pausa va con el reloj de la página y el Brymen sigue leyendo', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { Worker: unknown }).Worker = undefined;
  });
  await conCable(page, false);
  const panel = await conectar(page);
  await expect(panel.locator('[data-reloj-real]')).toHaveAttribute('data-reloj-real', 'pagina');
  await expect(panel.locator('[data-lectura-real]')).not.toHaveText('');
  expect(await ritmo(page)).toBeGreaterThan(2.5);
});
