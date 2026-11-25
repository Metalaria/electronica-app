// 2.0 (cierre20): «Un fotograma» writes its step into the address (history.replaceState) only while the address is
// still its own. A step reached late — the steps' reload after a route change, the autoplay's timer — between the
// moment the reader opens another page and the moment the router reads it (its «hashchange») put the old tab's
// address back over the new one: going from the N64's step 7 to the PlayStation's «Un fotograma» stayed on the N64
// (1 time in 8 in tests/consolas-n64ps1.spec.ts).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test tests/fotograma20-direccion.spec.ts
import { expect, test } from '@playwright/test';

test('la reproducción automática no devuelve la dirección a la consola que se acaba de dejar', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('#/consolas/n64/fotograma');
  await expect(page.locator('[data-cuenta]')).toHaveText('1/13');
  await page.getByRole('button', { name: 'Reproducir' }).click();
  // the reader opens another page: the address changes, and the router has not read it yet (no «hashchange» so far)
  await page.evaluate(() => history.pushState(history.state, '', '#/consolas/ps1/fotograma'));
  // the autoplay's timer moves the N64 to its next step meanwhile (7 to 20 s per step)
  await expect.poll(() => page.evaluate(() => (globalThis as { __epaFotograma?: { paso: number } }).__epaFotograma?.paso), { timeout: 40_000 }).toBe(2);
  expect(await page.evaluate(() => location.hash)).toBe('#/consolas/ps1/fotograma');
  // the router reads the address: the PlayStation opens
  await page.evaluate(() => dispatchEvent(new HashChangeEvent('hashchange')));
  await expect(page.locator('[data-cuenta]')).toHaveText('1/12');
});

test('de un paso de la N64 al «Un fotograma» de la PlayStation, ocho veces seguidas', async ({ page }) => {
  for (let i = 0; i < 8; i++) {
    await page.goto('#/consolas/n64/fotograma');
    await expect(page.locator('[data-cuenta]')).toHaveText('1/13');
    await page.goto('#/consolas/n64/fotograma/7');
    await expect(page.locator('#fotograma-titulo')).toContainText('índice 6');
    await page.goto('#/consolas/ps1/fotograma');
    await expect(page.locator('[data-cuenta]'), `vuelta ${i + 1}`).toHaveText('1/12', { timeout: 5000 });
    await page.goto('#/');
  }
});
