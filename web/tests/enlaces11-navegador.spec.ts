// 1.1 «enlaces11» in the browser: the book's QR links (epa://leccion/<parte>/<label>) given as a hash — the browser
// build's fallback (lib/ruta.svelte.ts, lib/enlaces.ts) —: the lesson opens (the 1.1 one when the section has one, the
// classic one otherwise), the history entry is replaced (Atrás does not come back to the link), the case of an
// appendix is the book's; a part or section the book does not have, or an invalid link, shows «No se encuentra esa
// lección» with its link to the index (axe in the three themes, 360 px without horizontal scroll), never an error.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.enlaces11.config.ts tests/enlaces11-navegador.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { asentar, axe, limpio, sinHallazgos, TEMAS } from './accesibilidad10-comun';

function vigilar(page: Page): string[] {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  return errores;
}

test('un enlace del libro como hash abre la lección, con la grafía del libro y sin volver al enlace con «Atrás»', async ({ page }) => {
  const errores = vigilar(page);
  await limpio(page);
  await page.goto('/#/cap01');
  await asentar(page, 200);
  // a 1.1 lesson
  await page.goto('/#epa://leccion/cap01/sec-1.4');
  await expect(page).toHaveURL(/#\/leccion\/cap01\/sec-1\.4$/);
  await expect(page.locator('[data-leccion11="cap01/sec-1.4"]')).toBeVisible({ timeout: 60_000 });
  // «Atrás» goes to the page before, not to the link (it was replaced)
  await page.goBack();
  await expect(page).toHaveURL(/#\/cap01$/);
  // a section without a 1.1 lesson: the classic one; percent-encoded and with the other slash form (1.2: every chapter
  // section has a hand-made lesson, so an appendix's; cap10/sec-10.1 opens its new one)
  await page.goto('/#/epa%3A%2F%2Fleccion%2FapB%2Fsec-B.1');
  await expect(page).toHaveURL(/#\/leccion\/apB\/sec-B\.1$/);
  await expect(page.locator('[data-leccion="apB/sec-B.1"]')).toBeVisible({ timeout: 60_000 });
  await page.goto('/#/epa%3A%2F%2Fleccion%2Fcap10%2Fsec-10.1');
  await expect(page).toHaveURL(/#\/leccion\/cap10\/sec-10\.1$/);
  await expect(page.locator('[data-leccion11="cap10/sec-10.1"]')).toBeVisible({ timeout: 60_000 });
  // an appendix written in another case: the book's spelling
  await page.goto('/#EPA://LECCION/APA/SEC-A.1');
  await expect(page).toHaveURL(/#\/leccion\/apA\/sec-A\.1$/, { timeout: 30_000 });
  await expect(page.locator('[data-leccion="apA/sec-A.1"]')).toBeVisible({ timeout: 60_000 });
  expect(errores).toEqual([]);
});

test('una lección que el libro no tiene, o un enlace no válido: «No se encuentra esa lección» con el índice, nunca un error', async ({ page }) => {
  const errores = vigilar(page);
  await limpio(page);
  for (const [hash, ruta, texto] of [
    ['#epa://leccion/cap99/sec-99.1', /#\/leccion\/cap99\/sec-99\.1$/, /sección «sec-99\.1» de «cap99»/],
    ['#epa://leccion/cap01/sec-1.99', /#\/leccion\/cap01\/sec-1\.99$/, /sección «sec-1\.99» de «cap01»/],
    ['#epa://evil.example/cap01/sec-1.4', /#\/leccion$/, /no es una dirección de lección válida/],
    ['#epa://leccion/cap01/../../sincronizacion', /#\/leccion$/, /no es una dirección de lección válida/],
    ['#/leccion/cap01/no-existe', /#\/leccion\/cap01\/no-existe$/, /sección «no-existe» de «cap01»/],
  ] as const) {
    await page.goto(`/${hash}`);
    await expect(page, hash).toHaveURL(ruta);
    const aviso = page.locator('[data-leccion-no-encontrada]');
    await expect(aviso, hash).toBeVisible({ timeout: 60_000 });
    await expect(aviso.getByRole('heading', { level: 1 })).toHaveText('No se encuentra esa lección');
    await expect(aviso).toContainText(texto);
    await expect(page.getByText('No se pudo abrir la lección')).toHaveCount(0);
  }
  // the link to the index
  const ir = page.getByRole('link', { name: 'Ir al índice del libro' });
  expect((await ir.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await ir.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/$/);
  expect(errores).toEqual([]);
});

for (const tema of TEMAS)
  test(`«No se encuentra esa lección» accesible (${tema}) y a 360 px sin desplazamiento horizontal`, async ({ page }) => {
    await limpio(page, tema);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/#epa://leccion/cap99/sec-99.1');
    await expect(page.locator('[data-leccion-no-encontrada]')).toBeVisible({ timeout: 60_000 });
    await asentar(page, 300);
    sinHallazgos(await axe(page), `no encontrada · ${tema}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
