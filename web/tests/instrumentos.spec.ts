// Virtual instruments on the test bench: the Brymen BM869s on a divider (voltage and current with its
// burden), the FNIRSI 2C53T on the 555 astable (frequency, duty cycle, thresholds), a guided practice with
// its steps and its «tu medida frente a lo esperado» checks, the link from the reader, and screenshots
// (phone, 1280 × 800 at DPR 2, tablet portrait; light and dark) in tests/capturas/.
import { expect, test, type Page } from '@playwright/test';

/** Live value of a check row of the practice panel (the cell keeps the exact number in its title). */
async function medida(page: Page, id: string): Promise<number> {
  const celda = page.locator(`table.comprobaciones tr[data-id="${id}"] td.medida`);
  await expect(celda).toHaveAttribute('title', /\d/, { timeout: 60_000 });
  return Number(await celda.getAttribute('title'));
}

/** Selects a lead or probe (a second tap on the selected one deselects it). */
async function elegirPunta(page: Page, nombre: RegExp) {
  const r = page.getByRole('radio', { name: nombre });
  if ((await r.getAttribute('aria-checked')) !== 'true') await r.click();
}

async function coincide(page: Page, id: string) {
  await expect(page.locator(`table.comprobaciones tr[data-id="${id}"]`)).toHaveClass(/\bok\b/, { timeout: 60_000 });
}

async function abrirPractica(page: Page, n: number) {
  await page.goto(`/#/instrumentos/practica/${n}`);
  await expect(page.locator('.practica h2')).toBeVisible();
  await expect(page.locator('.banco .estado')).toContainText('Simulado en', { timeout: 90_000 });
}

test('Brymen: tensión de un divisor con su exactitud y carga de 10 MΩ', async ({ page }) => {
  await abrirPractica(page, 1);
  // Step 1: the supply.
  expect(await medida(page, 'vin')).toBeCloseTo(9, 2);
  // Step 2: the midpoint, 2,88 V (2,8766 V with the 10 MΩ of the meter).
  await page.getByRole('button', { name: 'Siguiente →' }).click();
  const v = await medida(page, 'vout');
  expect(Math.abs(v - 2.8766)).toBeLessThan(0.0015);
  await coincide(page, 'vout');
  // The LCD shows the 5 V range with four decimals.
  await expect(page.locator('figcaption', { hasText: 'Brymen:' })).toContainText(/2,87\d\d V/);
  // Step 5: R1 = R2 = 1 MΩ: the meter loads the divider (4,29 V instead of 4,5 V).
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Siguiente →' }).click();
  expect(await medida(page, 'alta')).toBeCloseTo(4.2857, 2);
});

test('Brymen: corriente en serie con su tensión de carga', async ({ page }) => {
  await abrirPractica(page, 1);
  await page.getByRole('button', { name: 'Siguiente →' }).click();
  await page.getByRole('button', { name: 'Siguiente →' }).click();
  // In series with R1 on the mA jack: 0,612 mA through 3,3 Ω of burden.
  const i = await medida(page, 'i');
  expect(i).toBeGreaterThan(0.6e-3);
  expect(i).toBeLessThan(0.625e-3);
  await coincide(page, 'i');
  await expect(page.locator('figcaption', { hasText: 'Brymen:' })).toContainText('mA');
  // The same meter across the supply on the mA jack blows its 440 mA fuse.
  await page.locator('.serie select').first().selectOption('');
  await elegirPunta(page, /Brymen punta roja/);
  await page.locator('.nodos .nodo-chip', { hasText: /^a$/ }).click();
  await elegirPunta(page, /Brymen punta negra/);
  await page.locator('.nodos .nodo-chip', { hasText: /^0$/ }).click();
  await expect(page.locator('.banco .aviso', { hasText: 'fusible' })).toBeVisible({ timeout: 60_000 });
});

test('FNIRSI: el astable 555 en pantalla con su frecuencia y ciclo de trabajo', async ({ page }) => {
  await abrirPractica(page, 7);
  const f = await medida(page, 'f');
  expect(Math.abs(f - 13.9) / 13.9).toBeLessThan(0.02);
  const d = await medida(page, 'ciclo');
  expect(Math.abs(d - 55)).toBeLessThan(2);
  await coincide(page, 'alto');
  await coincide(page, 'bajo');
  // The Brymen counts the same frequency on its secondary display.
  await coincide(page, 'fbm');
  // Something is drawn on the scope's screen (yellow and cyan traces).
  const pixeles = await page.locator('canvas.pantalla').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let amarillo = 0;
    let cian = 0;
    for (let i = 0; i < d.length; i += 4) {
      const [r, g, b] = [d[i]!, d[i + 1]!, d[i + 2]!];
      if (r > 200 && g > 180 && b < 120) amarillo++;
      if (r < 120 && g > 160 && b > 200) cian++;
    }
    return { amarillo, cian };
  });
  expect(pixeles.amarillo).toBeGreaterThan(300);
  expect(pixeles.cian).toBeGreaterThan(300);
});

test('FNIRSI: carga RC con el generador y τ medida con cursores', async ({ page }) => {
  await abrirPractica(page, 2);
  // Cursors at the edge (A) and at the 63,2 % crossing (B): τ = 1 ms.
  await page.getByRole('button', { name: 'Siguiente →' }).click();
  await page.getByRole('button', { name: 'Siguiente →' }).click();
  await expect(page.locator('table.comprobaciones tr[data-id="tau"]')).toHaveClass(/\bmal\b/, { timeout: 30_000 });
  // Drag cursor B on the screen to one division after the trigger (−3 div from the centre).
  const lienzo = page.locator('canvas.pantalla');
  const caja = (await lienzo.boundingBox())!;
  const x = (div: number) => caja.x + ((10 + 150 + div * 25) / 320) * caja.width;
  const y = caja.y + caja.height * 0.5;
  await page.mouse.move(x(-3.5), y);
  await page.mouse.down();
  await page.mouse.move(x(-3.0), y, { steps: 4 });
  await page.mouse.up();
  await coincide(page, 'tau');
  expect(await medida(page, 'tau')).toBeCloseTo(1e-3, 4);
});

test('práctica guiada: Bode del RC con el generador y la tabla de puntos', async ({ page }) => {
  await abrirPractica(page, 5);
  // At 1 kHz the output is −3 dB.
  const g = await medida(page, 'g1k');
  expect(Math.abs(g + 3)).toBeLessThan(0.4);
  await coincide(page, 'g1k');
  // Note the point; then 20 kHz through the generator's direct entry.
  await page.getByRole('button', { name: 'Anotar punto' }).click();
  await expect(page.locator('table.puntos tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'MENU: osciloscopio, multímetro o generador' }).click();
  const lienzo = page.locator('canvas.pantalla');
  const caja = (await lienzo.boundingBox())!;
  await page.mouse.click(caja.x + caja.width * ((16 + 200 + 44) / 320), caja.y + caja.height * (115 / 240));
  await page.getByLabel('Frecuencia (Hz)').fill('20000');
  await page.getByLabel('Frecuencia (Hz)').press('Enter');
  await page.getByRole('button', { name: 'MENU: osciloscopio, multímetro o generador' }).click();
  await page.mouse.click(caja.x + caja.width * ((16 + 44) / 320), caja.y + caja.height * (115 / 240));
  await page.getByRole('button', { name: 'AUTO: ajuste automático de escalas y disparo' }).click();
  const g20 = await medida(page, 'g20k');
  expect(Math.abs(g20 + 26.1)).toBeLessThan(1.2);
  await page.getByRole('button', { name: 'Anotar punto' }).click();
  await expect(page.locator('table.puntos tbody tr')).toHaveCount(2);
  // Back to the book.
  await page.getByRole('link', { name: 'Leer en el libro →' }).click();
  await expect(page.locator('#sec-22\\.5')).toBeVisible();
});

test('el lector enlaza cada práctica con el banco', async ({ page }) => {
  await page.goto('/#/cap22/sec-22.7');
  const boton = page.locator('.seccion-cab:has(#sec-22\\.7) a.practicar');
  await expect(boton).toBeVisible({ timeout: 30_000 });
  await boton.click();
  await expect(page).toHaveURL(/#\/instrumentos\/practica\/7$/);
  await expect(page.locator('.practica h2')).toHaveText('Oscilador astable con el 555');
});

for (const [tam, vista] of [
  ['movil', { width: 390, height: 844 }],
  ['escritorio', { width: 1280, height: 800 }],
  ['tableta', { width: 800, height: 1280 }],
] as const) {
  for (const tema of ['claro', 'oscuro'] as const) {
    test(`capturas de instrumentos ${tam} ${tema}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: vista, deviceScaleFactor: 2 });
      await ctx.addInitScript((t) => localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 })), tema);
      const page = await ctx.newPage();
      for (const [n, nombre] of [
        [7, '555'],
        [6, 'fft'],
        [1, 'divisor'],
      ] as const) {
        await abrirPractica(page, n);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `tests/capturas/instrumentos-${tam}-${tema}-${nombre}.png` });
      }
      if (tam === 'escritorio') {
        await page.goto('/#/instrumentos');
        await page.waitForTimeout(800);
        await page.screenshot({ path: `tests/capturas/instrumentos-${tam}-${tema}-portada.png` });
      }
      await ctx.close();
    });
  }
}
