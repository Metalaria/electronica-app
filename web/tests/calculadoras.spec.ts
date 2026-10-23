// Live formula calculators (componentes/calculadoras): the «Calcular» button of the reader, the bottom sheet
// on phones, the «Calculadoras» page (search, favourites, numeric solving, the book's example) and the live
// formula cards; screenshots (phone, 1280 × 800 at DPR 2, tablet portrait; light and dark) in tests/capturas/.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test tests/calculadoras.spec.ts
//   (or with -c playwright.calculadoras.config.ts on its own port while :4173 is busy)
import { test, expect, type Page } from '@playwright/test';

/** Opens the calculator of the RC cut-off equation of section 3.6 and returns the calculator. */
async function abrirCorteRC(page: Page) {
  await page.goto('/#/cap03/sec-3.6');
  const boton = page.locator('#sec-3\\.6').locator('xpath=following::button[contains(@class,"calcular")][1]');
  await expect(boton).toBeVisible({ timeout: 30_000 });
  await boton.scrollIntoViewIfNeeded();
  await boton.click();
  const calc = page.locator('.calculadora').first();
  await expect(calc.locator('.resultado .valor')).toHaveText(/159,2\sHz/);
  return { boton, calc };
}

test('el lector ofrece «Calcular» y calcula con prefijos, despeja y avisa', async ({ page }) => {
  const pedidos: string[] = [];
  page.on('request', (r) => pedidos.push(r.url()));
  await page.goto('/#/cap03/sec-3.6');
  await expect(page.locator('.calcular').first()).toBeVisible({ timeout: 30_000 });
  // Only the small map is fetched while reading; the catalogue waits for a calculator.
  expect(pedidos.some((u) => u.endsWith('/formulas-ec.json'))).toBe(true);
  expect(pedidos.some((u) => u.endsWith('/formulas.json'))).toBe(false);

  const { calc } = await abrirCorteRC(page);
  expect(pedidos.some((u) => u.endsWith('/formulas.json'))).toBe(true);
  await expect(calc.locator('.ejemplo')).toContainText('comprobado');
  await expect(calc.locator('.seccion')).toContainText('3.6');

  // «1k6» = 1,6 kΩ (the practice of section 21.5 gives 995 Hz).
  await calc.getByRole('textbox', { name: /Resistencia/ }).fill('1k6');
  await expect(calc.locator('.resultado .valor')).toHaveText(/994,7\sHz/);

  // Solve for C with f_c = 1 kHz.
  await calc.getByRole('radio', { name: 'C', exact: true }).click();
  await calc.getByRole('textbox', { name: /Frecuencia de corte/ }).fill('1 kHz');
  await expect(calc.locator('.resultado .valor')).toHaveText(/99,47\snF/);
  await calc.getByRole('textbox', { name: /Frecuencia de corte/ }).fill('2,2 k');
  await expect(calc.locator('.resultado .valor')).toHaveText(/45,21\snF/);

  // Out of the book's range, and unreadable values.
  await calc.getByRole('textbox', { name: /Resistencia/ }).fill('1T');
  await expect(calc).toContainText('Fuera de lo habitual en el libro');
  await calc.getByRole('textbox', { name: /Resistencia/ }).fill('abc');
  await expect(calc).toContainText('No se entiende el valor');
  await expect(calc.locator('.resultado .valor')).toHaveText('—');

  // The sensitivity plot, and Esc closes the panel.
  await calc.getByRole('button', { name: 'Ver cómo depende' }).click();
  await calc.getByRole('textbox', { name: /Resistencia/ }).fill('10k');
  await expect(calc.locator('.grafica canvas').first()).toBeVisible();
  await calc.getByRole('textbox', { name: /Resistencia/ }).press('Escape');
  await expect(page.locator('.calculadora')).toHaveCount(0);
});

test('en el teléfono la calculadora es una hoja inferior que se cierra con Atrás', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await abrirCorteRC(page);
  const hoja = page.locator('body > .emergente.hoja');
  await expect(hoja).toBeVisible();
  await expect(hoja.locator('.calculadora .ecuacion')).toBeVisible();
  const url = page.url();
  await page.goBack();
  await expect(page.locator('.emergente.hoja')).toHaveCount(0);
  expect(page.url()).toBe(url);
  // A link inside the sheet goes there, and «Atrás» comes back to the reading.
  const { boton } = await abrirCorteRC(page);
  await page.locator('body > .emergente.hoja a[title="Abrir en Calculadoras"]').click();
  await expect(page).toHaveURL(/#\/calculadoras\/fc-rc$/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/cap03\/sec-3\.6$/);
  await expect(boton).toBeVisible();
  await ctx.close();
});

test('página de calculadoras: búsqueda, favoritas, despeje numérico y el ejemplo del libro', async ({ page }) => {
  await page.goto('/#/calculadoras');
  await expect(page.locator('.cuenta')).toContainText('fórmulas', { timeout: 30_000 });
  await page.getByRole('searchbox', { name: 'Buscar una fórmula' }).fill('corte rc');
  const fila = page.locator('li', { hasText: 'Frecuencia de corte de un filtro RC' });
  await expect(fila).toBeVisible();
  await fila.getByRole('button', { name: /Añadir .* a favoritas/ }).click();
  await page.getByRole('searchbox', { name: 'Buscar una fórmula' }).fill('');
  await page.getByRole('button', { name: /Favoritas \(1\)/ }).click();
  await expect(page.locator('.grupo li')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: /Favoritas \(1\)/ }).click();
  await expect(page.locator('.grupo li')).toHaveCount(1);

  // Search by symbol and by chapter.
  await page.getByRole('button', { name: /Favoritas/ }).click();
  await page.getByRole('searchbox', { name: 'Buscar una fórmula' }).fill('vswr');
  await expect(page.locator('.grupo li', { hasText: 'Razón de onda estacionaria (VSWR)' })).toBeVisible();

  // A variable without a closed form is solved numerically (C of the series RLC impedance).
  await page.goto('/#/calculadoras/z-rlc-serie');
  const calc = page.locator('.calculadora');
  await calc.getByRole('radio', { name: 'C', exact: true }).click();
  await expect(calc).toContainText('Despejado numéricamente');
  await expect(calc.locator('.resultado .valor')).toHaveText(/100,0\snF/);

  // The book's example: change a value, then «Valores del libro» brings back the printed result.
  await page.goto('/#/calculadoras/extincion-bobina');
  await expect(calc.locator('.resultado .valor')).toHaveText(/4,830\sms/);
  await calc.getByRole('textbox', { name: /Tensión de extinción/ }).fill('30,7');
  await expect(calc.locator('.resultado .valor')).toHaveText(/549,9\sµs/);
  await calc.getByRole('button', { name: 'Valores del libro' }).click();
  await expect(calc.locator('.resultado .valor')).toHaveText(/4,830\sms/);
  await expect(calc.locator('.grafica canvas').first()).toBeVisible();
});

test('tarjetas vivas: las variables compartidas recalculan todas las fórmulas', async ({ page }) => {
  await page.goto('/#/cap03/sec-3.6');
  const abrir = page.locator('.tarjeta .viva .abrir').first();
  await abrir.scrollIntoViewIfNeeded();
  await abrir.click();
  const panel = page.locator('.panel-tarjeta');
  const corte = panel.locator('li', { hasText: 'Frecuencia de corte de un filtro RC' });
  await expect(corte).toContainText(/159,2\sHz/);
  await panel.getByLabel(/^R\s*Resistencia/).fill('1k');
  await expect(corte).toContainText(/1,592\skHz/);
  // Another formula of the card follows the same R: the charge after 1 ms with τ = 0,1 ms.
  await expect(panel.locator('li', { hasText: /^Carga de un condensador a través de R/ })).toContainText(/10,00\sV/);

  // In chapter 0 the time constant is computed by its own formula and feeds the charge curve.
  await page.goto('/#/cap00');
  const abrir0 = page.locator('.tarjeta .viva .abrir').first();
  await abrir0.scrollIntoViewIfNeeded();
  await abrir0.click();
  const vinculo = page.locator('.panel-tarjeta .vinculo', { hasText: 'Constante de tiempo RC' });
  await expect(vinculo.locator('input')).toBeChecked();
});

for (const [tam, vista] of [
  ['movil', { width: 390, height: 844 }],
  ['escritorio', { width: 1280, height: 800 }],
  ['tableta', { width: 800, height: 1280 }],
] as const) {
  for (const tema of ['claro', 'oscuro'] as const) {
    test(`capturas de calculadoras ${tam} ${tema}`, async ({ browser }) => {
      const movil = tam !== 'escritorio';
      const ctx = await browser.newContext({ viewport: vista, deviceScaleFactor: 2, isMobile: movil, hasTouch: movil });
      await ctx.addInitScript((t) => localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 })), tema);
      const page = await ctx.newPage();
      const { boton, calc } = await abrirCorteRC(page);
      if (tam !== 'movil') {
        await calc.getByRole('button', { name: 'Ver cómo depende' }).click();
        await expect(calc.locator('.grafica canvas').first()).toBeVisible();
        await boton.evaluate((e) => window.scrollBy(0, e.getBoundingClientRect().top - 140));
      }
      await page.waitForTimeout(600);
      await page.screenshot({ path: `tests/capturas/calculadoras-${tam}-${tema}-lector.png` });

      await page.goto('/#/cap03/sec-3.6');
      const abrir = page.locator('.tarjeta .viva .abrir').first();
      await abrir.scrollIntoViewIfNeeded();
      await abrir.click();
      await expect(page.locator('.panel-tarjeta')).toBeVisible();
      await abrir.evaluate((e) => window.scrollBy(0, e.getBoundingClientRect().top - 120));
      await page.waitForTimeout(400);
      await page.screenshot({ path: `tests/capturas/calculadoras-${tam}-${tema}-tarjeta.png` });

      await page.goto('/#/calculadoras');
      await expect(page.locator('.grupo').first()).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `tests/capturas/calculadoras-${tam}-${tema}-lista.png` });

      await page.goto('/#/calculadoras/rizado-bobina-buck');
      await expect(page.locator('.calculadora .grafica canvas').first()).toBeVisible();
      await page.waitForTimeout(600);
      await page.screenshot({ path: `tests/capturas/calculadoras-${tam}-${tema}-pagina.png` });
      await ctx.close();
    });
  }
}
