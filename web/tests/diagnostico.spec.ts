// «Diagnóstico de rendimiento» (componentes/diagnostico): reached from «Ajustes», nothing heavy runs before
// «Empezar», every test produces rows in the results table, and «Copiar resultados» copies the plain text.
import { expect, test } from '@playwright/test';

test('el diagnóstico se abre desde Ajustes, mide al pulsar «Empezar» y copia el informe', async ({ page, context }) => {
  test.setTimeout(420_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#/');
  // «Aa» in the top bar opens «Ajustes» (on phones too).
  await page.getByRole('button', { name: 'Tema y tamaño de letra' }).first().click();
  await page.getByRole('link', { name: 'Diagnóstico de rendimiento' }).click();
  await expect(page.getByRole('heading', { name: 'Diagnóstico de rendimiento' })).toBeVisible();
  await expect(page).toHaveURL(/#\/diagnostico$/);
  // Nothing measured, nothing built yet.
  await page.waitForTimeout(800);
  expect(await page.locator('.diagnostico .zona canvas').count()).toBe(0);
  expect(await page.evaluate(() => 'motor' in globalThis || !!(globalThis as { __epa3d?: unknown }).__epa3d)).toBe(false);
  await expect(page.locator('.diagnostico table')).toHaveCount(0);

  await page.locator('.segundos input').fill('2');
  await page.locator('[data-accion="empezar"]').click();
  await expect(page.locator('[data-accion="detener"]')).toBeVisible();
  await expect(page.locator('.diagnostico')).toHaveAttribute('data-estado', 'hecho', { timeout: 400_000 });

  const filas = page.locator('.diagnostico tbody tr:not(.grupo)');
  const grupos = await page.locator('.diagnostico tbody tr.grupo').allTextContents();
  expect(grupos).toEqual(['Dispositivo', 'WebGL 2', 'Visor 3D de componentes', 'Placa KiCad (SDR)', 'Esquema automático (en vivo)', 'Simulación (ngspice)']);
  expect(await filas.count()).toBeGreaterThan(15);
  await expect(page.locator('.diagnostico tbody')).toContainText('cuadros/s');
  await expect(page.locator('.diagnostico tbody')).toContainText('Placa con componentes');
  await expect(page.locator('.diagnostico tbody')).toContainText('cap50/rectificador');
  // No test failed (a slow result is also marked in red, as SwiftShader's frame rates are here; a failure is a
  // row named «Error»).
  await expect(page.locator('.diagnostico tbody tr td:first-child', { hasText: /^Error$/ })).toHaveCount(0);

  await page.locator('[data-accion="copiar"]').click();
  await expect(page.locator('[data-accion="copiar"]')).toContainText('Copiado');
  const texto = await page.evaluate(() => navigator.clipboard.readText());
  expect(texto).toMatch(/^Diagnóstico de rendimiento · Electrónica Práctica Avanzada/);
  expect(texto).toContain('WebGL 2:');
  expect(texto).toContain('- Al girar:');
  expect(texto).toContain('Simulación (ngspice):');
});
