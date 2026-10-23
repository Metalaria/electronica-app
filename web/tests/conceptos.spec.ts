// Concept animations (componentes/animaciones/conceptos): the gallery and its filter, every scene loads and draws
// without errors, the reader's «Ver animación» buttons lead to them and back, a pole of the Bode scene can be
// dragged, and the linear supply is simulated with ngspice. Frame cost and frame-rate independence are measured
// by tests/animaciones.mjs and tests/animaciones-hz.mjs; screenshots by tests/conceptos-capturas.mjs.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fuente = readFileSync(new URL('../src/componentes/animaciones/conceptos/cargadores.ts', import.meta.url), 'utf8');
const IDS = [...fuente.matchAll(/^\s+'?([a-z0-9-]+)'?: \(\) => import/gm)].map((m) => m[1]!);

test('galería de conceptos: tarjetas por áreas y búsqueda sin tildes', async ({ page }) => {
  await page.goto('/#/conceptos');
  await expect(page.getByRole('heading', { name: 'La teoría, en movimiento' })).toBeVisible();
  await expect(page.locator('a.tarjeta')).toHaveCount(IDS.length);
  expect(IDS.length).toBeGreaterThanOrEqual(30);
  await page.getByPlaceholder(/Buscar: fasor/).fill('nyquist');
  await expect(page.locator('a.tarjeta')).toHaveCount(1);
  await expect(page.locator('a.tarjeta')).toHaveAttribute('href', '#/conceptos/muestreo-aliasing');
  await page.getByPlaceholder(/Buscar: fasor/).fill('23.6');
  await expect(page.locator('a.tarjeta').first()).toBeVisible();
});

test('cada escena se carga, dibuja y no da errores', async ({ page }) => {
  test.setTimeout(240_000);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  for (const id of IDS) {
    await page.goto(`/#/conceptos/${id}`);
    const lienzo = page.locator('.escena canvas').first();
    await expect(lienzo, id).toBeVisible();
    await page.waitForTimeout(400);
    // Something was drawn: the canvas is not a single flat colour.
    const colores = await lienzo.evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      const vistos = new Set<number>();
      for (let i = 0; i < d.length; i += 4 * 97) vistos.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
      return vistos.size;
    });
    expect(colores, id).toBeGreaterThan(8);
    // The explanation and the links to the book are there.
    await expect(page.locator('.texto p').first(), id).not.toBeEmpty();
    await expect(page.locator('.libro a').first(), id).toBeVisible();
  }
  expect(errores).toEqual([]);
});

test('del libro a la animación y de vuelta', async ({ page }) => {
  await page.goto('/#/cap24/sec-24.4');
  const seccion = page.locator('[id="sec-24.4"]');
  await expect(seccion).toBeVisible();
  // Section 23.4 is illustrated by several animations: a menu.
  const boton = page.locator('button.ver', { hasText: 'Ver animaciones' }).first();
  await boton.click();
  await page.locator('.menu a', { hasText: 'Fasores' }).click();
  await expect(page).toHaveURL(/#\/conceptos\/fasores$/);
  await expect(page.getByRole('heading', { name: /Fasores/ })).toBeVisible();
  // «Volver» returns to the section; the page lists the section among «En el libro».
  await page.getByRole('button', { name: /Volver a 23.4/ }).click();
  await expect(page).toHaveURL(/#\/cap24\/sec-24.4$/);
  await page.goto('/#/conceptos/fasores');
  await page.locator('.libro a', { hasText: '23.4' }).click();
  await expect(page).toHaveURL(/#\/cap24\/sec-24.4$/);
  await expect(page.getByRole('button', { name: 'Volver a la animación' })).toBeVisible();
});

test('una figura enlaza con su animación de concepto', async ({ page }) => {
  await page.goto('/#/cap30/fig-30.7');
  const fig = page.locator('figure[id="fig-30.7"]');
  await expect(fig).toBeVisible();
  const enlace = fig.locator('a.ver[href="#/conceptos/muestreo-aliasing"]');
  await expect(enlace).toBeVisible();
  await enlace.click();
  await expect(page.getByRole('heading', { name: 'Muestreo, Nyquist y aliasing' })).toBeVisible();
});

test('Bode: arrastrar un polo cambia la respuesta', async ({ page }) => {
  await page.goto('/#/conceptos/bode-polos-ceros');
  const lienzo = page.locator('.escena canvas').first();
  await expect(lienzo).toBeVisible();
  await page.getByText('Barrer la frecuencia de prueba').click();
  const lectura = page.locator('.lecturas div').first().locator('dd');
  const antes = await lectura.textContent();
  const caja = (await lienzo.boundingBox())!;
  const ancho = caja.width / (caja.width < 560 ? 600 : 900);
  // The pole of the RC (1,59 kHz) sits on the ruler: x = 60 + 500·log10(1592)/6 logical units, y = 60 or 55.
  const x = caja.x + (60 + (500 * Math.log10(1592)) / 6) * ancho;
  const y = caja.y + (caja.width < 560 ? 60 : 55) * ancho;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 120 * ancho, y, { steps: 6 });
  await page.mouse.up();
  await expect(lectura).not.toHaveText(antes ?? '');
});

test('fuente lineal: el rectificador se simula con ngspice', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/#/conceptos/fuente-lineal');
  const media = page.locator('.lecturas div', { hasText: 'Tensión media en C' }).locator('dd');
  await expect(media).toHaveText(/^\d+,\d+\s?V$/, { timeout: 120_000 });
  // Book: 18 V rms, bridge, 5000 µF and 1 A → about 23 V.
  const v = Number((await media.textContent())!.replace(/[^\d,]/g, '').replace(',', '.'));
  expect(v).toBeGreaterThan(21.5);
  expect(v).toBeLessThan(24.5);
});
