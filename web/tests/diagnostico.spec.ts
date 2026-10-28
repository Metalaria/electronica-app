// «Diagnóstico de rendimiento» (componentes/diagnostico): reached from «Ajustes», nothing heavy runs before
// «Empezar», every test produces rows in the results table, and «Copiar resultados» copies the plain text.
// 0.9: the Neo Geo board test and its breadcrumbs (a test that froze or closed the app is reported next time).
import { expect, test } from '@playwright/test';

test('el diagnóstico se abre desde Ajustes, mide al pulsar «Empezar» y copia el informe', async ({ page, context }) => {
  test.setTimeout(540_000);
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
  await expect(page.locator('.diagnostico')).toHaveAttribute('data-estado', 'hecho', { timeout: 520_000 });

  const filas = page.locator('.diagnostico tbody tr:not(.grupo)');
  const grupos = await page.locator('.diagnostico tbody tr.grupo').allTextContents();
  expect(grupos).toEqual([
    'Dispositivo',
    'WebGL 2',
    'Visor 3D de componentes',
    'Placa KiCad (SDR)',
    'Caras de la placa SDR (resolución completa)',
    'Placa de consola en 3D (Neo Geo)',
    'Esquema automático (en vivo)',
    'Simulación (ngspice)',
  ]);
  expect(await filas.count()).toBeGreaterThan(15);
  await expect(page.locator('.diagnostico tbody')).toContainText('cuadros/s');
  await expect(page.locator('.diagnostico tbody')).toContainText('Placa con componentes');
  // 0.8: the new phases (shaders before the first frame, a second view, full-resolution faces and their three
  // ways of painting, the resolution while turning).
  await expect(page.locator('.diagnostico tbody')).toContainText('Segunda vista');
  await expect(page.locator('.diagnostico tbody')).toContainText('Caras a resolución completa');
  await expect(page.locator('.diagnostico tbody')).toContainText('Resolución al girar');
  for (const modo of ['directo', 'trabajador', 'franjas']) await expect(page.locator('.diagnostico tbody tr td:first-child', { hasText: new RegExp(`^${modo}`) })).toHaveCount(1);
  // Chromium paints the faces directly: the second full board is not built (it closed the app on Android), the
  // direct mode is the one «Placa SDR en 3D» measured and the other two are WebKit's.
  await expect(page.locator('.diagnostico tbody tr', { hasText: /^directo/ })).toContainText('en «Placa SDR»');
  await expect(page.locator('.diagnostico tbody tr', { hasText: /^trabajador/ })).toContainText('no se mide aquí');
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

const MIGAS = 'epa-diagnostico-migas';

test('las migas de una prueba que no terminó se ven al volver, y las de la Neo Geo se escriben fase a fase', async ({ page, context }) => {
  test.setTimeout(300_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#/');
  // A run that froze at part 237 twelve seconds in (as the tablet would leave it): no «fin».
  await page.evaluate((k) => {
    const inicio = Date.now() - 60_000;
    const fases = [[0, 'empezando'], [40, 'datos'], [900, 'geometría'], [1500, 'caras'], [2600, 'primer cuadro de la placa'], [12_340, 'pieza 237: R1']];
    localStorage.setItem(k, JSON.stringify({ prueba: 'Placa de consola en 3D (Neo Geo)', inicio, fases }));
  }, MIGAS);
  await page.goto('/#/diagnostico');
  const fila = page.locator('.diagnostico tbody tr', { hasText: 'La última prueba se quedó en' });
  await expect(fila).toHaveCount(1);
  await expect(fila.locator('td.valor')).toHaveText('pieza 237: R1 tras 12,3 s');
  await expect(fila).toContainText('Placa de consola en 3D (Neo Geo)');
  await page.locator('.diagnostico section:not(.registro-app) details summary').click();
  await expect(page.locator('.diagnostico textarea:not(.registro)')).toHaveValue(/- La última prueba se quedó en: pieza 237: R1 tras 12,3 s/);

  // Only the Neo Geo test: the report of the unfinished run stays on top and is copied with the new results.
  const etiquetas = page.locator('.pruebas label');
  for (let i = 0; i < (await etiquetas.count()); i++) {
    const quiero = /Neo Geo/.test(await etiquetas.nth(i).innerText());
    const c = etiquetas.nth(i).locator('input');
    if ((await c.isChecked()) !== quiero) await c.click();
  }
  await page.locator('[data-accion="empezar"]').click();
  // breadcrumbs are written while it runs
  await page.waitForFunction((k) => /"(datos|geometría|caras|pieza \d+: [^"]+|primer cuadro de la placa)"/.test(localStorage.getItem(k) ?? '') && !/"fin"/.test(localStorage.getItem(k) ?? ''), MIGAS, { timeout: 120_000, polling: 20 });
  await expect(page.locator('.diagnostico')).toHaveAttribute('data-estado', 'hecho', { timeout: 280_000 });
  const grupos = await page.locator('.diagnostico tbody tr.grupo').allTextContents();
  expect(grupos).toEqual(['Prueba anterior sin terminar', 'Dispositivo', 'Placa de consola en 3D (Neo Geo)']);
  await expect(page.locator('.diagnostico tbody')).toContainText('Placa con componentes');
  await expect(page.locator('.diagnostico tbody')).toContainText('Hueco más largo de la página');
  await expect(page.locator('.diagnostico tbody tr', { hasText: 'Revisión de las piezas' }).locator('td.valor')).toHaveText('sin problemas');
  await expect(page.locator('.diagnostico tbody tr td:first-child', { hasText: /^Error$/ })).toHaveCount(0);
  // every phase was left as it started, in order, with times, and the run is marked as ended
  const m = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), MIGAS);
  expect(m.prueba).toMatch(/Neo Geo/);
  expect(typeof m.fin).toBe('number');
  const fases = (m.fases as [number, string][]).map((x) => x[1]);
  const orden = ['empezando', 'datos', 'geometría', 'caras', 'pieza 320: ', 'uniendo', 'compilando', 'primer cuadro', 'caras a resolución completa'];
  let i = -1;
  for (const f of orden) {
    const j = fases.findIndex((x, k) => k > i && x.startsWith(f));
    expect(j, `${f} en ${fases.join(' | ')}`).toBeGreaterThan(i);
    i = j;
  }
  const tiempos = (m.fases as [number, string][]).map((x) => x[0]);
  expect([...tiempos].sort((a, b) => a - b)).toEqual(tiempos);
  await page.locator('[data-accion="copiar"]').click();
  const texto = await page.evaluate(() => navigator.clipboard.readText());
  expect(texto).toContain('- La última prueba se quedó en: pieza 237: R1 tras 12,3 s');
  expect(texto).toContain('Placa de consola en 3D (Neo Geo):');
  // a finished run is not reported again
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Diagnóstico de rendimiento' })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator('.diagnostico table')).toHaveCount(0);
});

test('el registro de la aplicación guarda errores y pasos y se puede copiar y borrar', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#/');
  await page.evaluate(() => console.error('fallo de prueba del registro'));
  await page.goto('/#/diagnostico');
  const tarjeta = page.locator('.registro-app');
  await expect(tarjeta).toBeVisible();
  await tarjeta.locator('[data-accion="copiar-registro"]').click();
  await expect(tarjeta.locator('[data-accion="copiar-registro"]')).toContainText('Copiado');
  const texto = await page.evaluate(() => navigator.clipboard.readText());
  expect(texto).toMatch(/^Registro de la aplicación · Electrónica Práctica Avanzada \d+\.\d+\.\d+/);
  expect(texto).toMatch(/\[app\] inicio \d+\.\d+\.\d+/);
  expect(texto).toContain('[consola] fallo de prueba del registro');
  // it survives a reload (stored at once)
  await page.reload();
  await expect(page.locator('.registro-app')).toContainText('líneas');
  await page.locator('.registro-app [data-accion="borrar-registro"]').click();
  await expect(page.locator('.registro-app')).toContainText('Tiene 0 líneas');
});

// 0.10: a quick «Simular» on the simulator page must not flash the live schematic's «Simulando con ngspice…» line
// (the owner saw something appear and vanish on the tablet), and the run goes to the application log.
test('«Simular» no hace parpadear el esquema vivo y la simulación queda en el registro', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#/simulador/cap00/fig-0.2_dos_mallas');
  const boton = page.getByRole('button', { name: 'Simular', exact: true }).first();
  await expect(boton).toBeEnabled({ timeout: 60_000 });
  await expect(page.locator('text=/Simulado en/').first()).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => {
    const w = window as unknown as { __parrafos: string[] };
    w.__parrafos = [];
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n instanceof HTMLElement && n.tagName === 'P') w.__parrafos.push(n.textContent ?? '');
    }).observe(document.body, { subtree: true, childList: true });
  });
  await boton.click();
  await page.waitForTimeout(1500);
  const parrafos = await page.evaluate(() => (window as unknown as { __parrafos: string[] }).__parrafos);
  expect(parrafos.filter((t) => /Simulando con ngspice/.test(t))).toEqual([]);
  await page.goto('/#/diagnostico');
  await page.locator('.registro-app [data-accion="copiar-registro"]').click();
  const texto = await page.evaluate(() => navigator.clipboard.readText());
  expect(texto).toMatch(/\[simulador\] «fig-0\.2.*»: \d+ ms/);
  expect(texto).toContain('[navegación] #/diagnostico');
  // «Copiar errores»: only errors and warnings with the lines just before them
  await page.evaluate(() => console.error('fallo para copiar errores'));
  await page.locator('.registro-app [data-accion="copiar-errores"]').click();
  const errores = await page.evaluate(() => navigator.clipboard.readText());
  expect(errores).toMatch(/^Errores y avisos de la aplicación/);
  expect(errores).toContain('[consola] fallo para copiar errores');
  expect(errores.split('\n').filter((l) => / \[simulador\] /.test(l)).length).toBeLessThanOrEqual(3);
});

