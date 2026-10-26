// Automatic schematics in the simulator (web/src/componentes/esquema-auto/): a netlist without a drawn
// figure gets its circuit drawn from the netlist (alive, under the live layer), an XSPICE netlist that the app
// cannot simulate is still drawn (own viewer, pan/zoom), a click on a part brings up its slider, and a
// subcircuit's interior can be opened. Screenshots (phone, 1280×800 at DPR 2, tablet portrait; light and
// dark) go to tests/capturas/. The layout itself is checked on all 313 netlists by tests/esquema-auto.mjs.
import { expect, test } from '@playwright/test';

test('una netlist sin figura dibujada muestra su circuito dibujado automáticamente', async ({ page }) => {
  await page.goto('/#/simulador/cap42/fig-42.3_op_emisor_comun');
  const c = page.locator('.circuito-vivo');
  await expect(c).toBeVisible({ timeout: 60_000 });
  await expect(c.locator('.origen')).toContainText('automáticamente');
  // The drawing is an SVG picture with the parts of the netlist (embedded fonts, book colours).
  const src = await c.locator('img').first().getAttribute('src');
  expect(src).toContain('data:image/svg+xml');
  const svg = decodeURIComponent(src!.split(',')[1]!);
  for (const t of ['47 kΩ', '4,7 kΩ', 'Q2N3904', '@font-face']) expect(svg).toContain(t);
  // Overlay results arrive (voltage legend).
  await expect(c.locator('.leyenda')).toBeVisible({ timeout: 60_000 });
});

test('una netlist XSPICE se dibuja aunque no se pueda simular, con zoom y clic en los componentes', async ({ page }) => {
  // Since 0.8 the default engine runs XSPICE; the fallback engine (eecircuit-engine) cannot, which is the case
  // this test covers.
  await page.addInitScript(() => localStorage.setItem('epa:motor-spice', 'eecircuit'));
  await page.goto('/#/simulador/cap29/sec-29.7-contador-asincrono');
  const v = page.locator('.esquema-auto-vista');
  await expect(v).toBeVisible({ timeout: 60_000 });
  const lienzo = v.locator('.lienzo');
  await expect(lienzo.locator('svg .ea-u').first()).toBeAttached({ timeout: 30_000 });
  expect(await lienzo.locator('svg [data-disp]').count()).toBeGreaterThan(10);
  // Zoom in and back.
  const vb0 = await lienzo.locator('svg').getAttribute('viewBox');
  await v.getByRole('button', { name: 'Ampliar' }).click();
  const vb1 = await lienzo.locator('svg').getAttribute('viewBox');
  expect(vb1).not.toBe(vb0);
  await v.getByRole('button', { name: 'Ajustar a la vista' }).click();
  // Clicking the clock source selects it and focuses its slider.
  const g = lienzo.locator('svg [data-disp="vclk"]');
  await lienzo.scrollIntoViewIfNeeded();
  const b = (await g.locator('.ea-hit').boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await expect(v.locator('.ayuda')).toContainText('VCLK');
  await expect(page.locator('.parametros li.enfocado').first()).toBeVisible();
  await expect(page.locator('.parametros li.enfocado .nombre').first()).toContainText('VCLK');
});

test('elegir un componente desde un esquema lleva a su control deslizante', async ({ page }) => {
  await page.goto('/#/simulador/cap42/fig-42.5_filtro_rc');
  await expect(page.locator('.parametros li').first()).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('epa:elegir-componente', { detail: { nombre: 'c1' } })));
  await expect(page.locator('.parametros li.enfocado .nombre')).toContainText('C1');
});

test('el interior de un subcircuito se abre como esquema propio', async ({ page }) => {
  await page.goto('/#/simulador/cap27/diferencial_cmrr_27.7');
  const boton = page.getByRole('button', { name: 'Ver el interior de opamp' });
  await expect(boton).toBeVisible({ timeout: 60_000 });
  await boton.click();
  const v = page.locator('.esquema-auto-vista');
  await expect(v.locator('h3')).toContainText('Subcircuito opamp');
  await expect(v.locator('svg .ea-u').first()).toBeAttached({ timeout: 30_000 });
  // Ports of the subcircuit are drawn as terminals.
  for (const p of ['inp', 'inn', 'out']) await expect(v.locator('svg text', { hasText: new RegExp(`^${p}$`) }).first()).toBeAttached();
  await v.getByRole('button', { name: 'Volver al circuito' }).click();
  await expect(boton).toBeVisible();
});

test('nuevo circuito: el esquema sigue a la netlist escrita', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('epa:circuito'));
  await page.goto('/#/simulador/nuevo');
  await page.getByRole('button', { name: 'Insertar un ejemplo' }).click();
  const c = page.locator('.circuito-vivo');
  await expect(c).toBeVisible({ timeout: 60_000 });
  const src0 = await c.locator('img').first().getAttribute('src');
  // Add a load resistor: the drawing is regenerated with it.
  const editor = page.locator('.netlist textarea').first();
  await editor.focus();
  await editor.press('Control+End');
  const texto = await editor.inputValue();
  await editor.fill(texto.replace('C1 out 0 100n', 'C1 out 0 100n\nRL out 0 10k'));
  await expect
    .poll(async () => decodeURIComponent((await c.locator('img').first().getAttribute('src')) ?? ''), { timeout: 30_000 })
    .toContain('10 kΩ');
  expect(await c.locator('img').first().getAttribute('src')).not.toBe(src0);
});

const TAMANOS = {
  movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  mac: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
  'tableta-vertical': { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;

for (const [tam, opciones] of Object.entries(TAMANOS)) {
  for (const tema of ['claro', 'oscuro'] as const) {
    test(`capturas de esquemas automáticos ${tam} ${tema}`, async ({ browser }) => {
      const ctx = await browser.newContext({ ...opciones, colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
      await ctx.addInitScript((t) => localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 })), tema);
      const page = await ctx.newPage();
      for (const [id, nombre] of [
        ['cap42/fig-42.3_op_emisor_comun', 'emisor-comun'],
        ['cap22/fig-22.14_555_astable', '555'],
        ['cap50/rectificador', 'rectificadores'],
      ] as const) {
        await page.goto(`/#/simulador/${id}`);
        const c = page.locator('.circuito-vivo');
        await expect(c.locator('.leyenda')).toBeVisible({ timeout: 90_000 });
        await page.waitForTimeout(500);
        await c.screenshot({ path: `tests/capturas/esquema-auto-${tam}-${tema}-${nombre}.png` });
      }
      // The «not simulable» drawing of an XSPICE netlist: only with the fallback engine since 0.8.
      await page.evaluate(() => localStorage.setItem('epa:motor-spice', 'eecircuit'));
      await page.goto('/#/simulador/cap29/prob-29.C-decodificador');
      await page.reload();
      const v = page.locator('.esquema-auto-vista');
      await expect(v.locator('svg .ea-u').first()).toBeAttached({ timeout: 60_000 });
      await page.waitForTimeout(300);
      await v.screenshot({ path: `tests/capturas/esquema-auto-${tam}-${tema}-xspice.png` });
      await v.getByRole('button', { name: 'Ampliar' }).click();
      await v.getByRole('button', { name: 'Ampliar' }).click();
      await v.screenshot({ path: `tests/capturas/esquema-auto-${tam}-${tema}-xspice-zoom.png` });
      await ctx.close();
    });
  }
}
