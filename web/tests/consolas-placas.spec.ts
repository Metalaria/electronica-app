// «Placa en 3D / 2D» of the consoles (contenido/consolas_pcb.py → public/consolas/placas/, drawn by the
// «Proyectos KiCad» viewer) and its link with the console's schematic.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.sincronizacion.config.ts consolas-placas
import { test, expect, type Page } from '@playwright/test';

interface Vista2D {
  k: number;
  ox: number;
  oy: number;
}

type Pad = [number, string, string, number, number];
interface Placa {
  huellas: { r: string; pads: [number, number] }[];
  pads: Pad[];
  redes: { n: string }[];
  consola: { enlazada: boolean; redes: Record<string, string>; refs: string[] };
}

async function placa(page: Page, id: string): Promise<Placa> {
  return page.evaluate(async (i) => (await fetch(`consolas/placas/${i}.json`)).json(), id) as Promise<Placa>;
}

/** Forces the 2D fallback of the 3D tab (fast, no WebGL in the test browser needed). */
async function sin3D(page: Page): Promise<void> {
  await page.addInitScript(() => ((globalThis as unknown as { __epaSinWebGL: boolean }).__epaSinWebGL = true));
}

test('las pestañas de placa solo aparecen en las consolas con placa', async ({ page }) => {
  // (the NES has had a board since 0.8: OpenTendo; the Master System has none)
  await page.goto('#/consolas/sms/foto');
  const pestanas = page.getByRole('navigation', { name: 'Vista' });
  await expect(pestanas.getByRole('link', { name: 'Esquema' })).toBeVisible();
  await expect(pestanas.getByRole('link', { name: 'Placa en 3D' })).toHaveCount(0);
  await page.goto('#/consolas/megadrive/foto');
  await expect(pestanas.getByRole('link', { name: 'Placa en 3D' })).toBeVisible();
  await expect(pestanas.getByRole('link', { name: 'Placa en 2D' })).toBeVisible();
  // a machine without a board opened on a board tab falls back to the photo
  await page.goto('#/consolas/sms/placa2d');
  await expect(pestanas.getByRole('link', { name: 'Foto', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('Mega Drive: del esquema a la placa y de la placa al esquema', async ({ page }) => {
  await sin3D(page);
  await page.goto('#/consolas/megadrive/esquema/U1');
  await page.getByRole('button', { name: 'Ver en la placa', exact: true }).click();
  await expect(page).toHaveURL(/#\/consolas\/megadrive\/placa2d\/U1$/);
  const lado = page.locator('.placa-consola .lado');
  await expect(lado.locator('.nombre')).toContainText('U1');
  await expect(lado).toContainText('HD68HC000P8');
  await expect(lado).toContainText('DIP-64');
  // every pad of the board on the schematic's net (checked by the pipeline, shown in the summary)
  const d = await placa(page, 'megadrive');
  expect(d.consola.enlazada).toBe(true);
  expect(d.consola.refs.length).toBe(291);
  // a pad from the list → its net, the same net in the schematic
  await lado.locator('.nodos button').filter({ hasText: 'VD4' }).first().click();
  await expect(page).toHaveURL(/placa2d\/red%3A%2FVD4$/);
  await expect(lado.locator('.nombre')).toHaveText('VD4');
  await lado.getByRole('button', { name: 'Ver en el esquema' }).click();
  await expect(page).toHaveURL(/esquema\/red%3A%2FVD4$/);
  await expect(page.locator('.lado, aside').filter({ hasText: 'pines conectados' }).first()).toBeVisible();
});

test('Mega Drive: tocar un pad en la placa 2D lo elige, también para el esquema', async ({ page }) => {
  await page.goto('#/consolas/megadrive/placa2d');
  const lienzo = page.locator('.placa2d canvas');
  await expect(lienzo).toBeVisible();
  await page.waitForFunction(() => !!(globalThis as unknown as { __epaPlacaVista?: unknown }).__epaPlacaVista);
  await page.waitForTimeout(400);
  const d = await placa(page, 'megadrive');
  const h = d.huellas.find((x) => x.r === 'U8')!;
  const pad = d.pads[h.pads[0]]!;
  const v = (await page.evaluate(() => (globalThis as unknown as { __epaPlacaVista: Vista2D }).__epaPlacaVista)) as Vista2D;
  const caja = (await lienzo.boundingBox())!;
  await page.mouse.click(caja.x + v.ox + pad[3] * v.k, caja.y + v.oy + pad[4] * v.k);
  await expect(page.locator('.placa-consola .lado .nombre')).toContainText('U8');
  await expect(page).toHaveURL(/placa2d\/U8$/);
  await page.getByRole('navigation', { name: 'Vista' }).getByRole('link', { name: 'Esquema' }).click();
  await expect(page).toHaveURL(/esquema\/U8$/);
  await expect(page.locator('h3.nombre')).toContainText('U8');
});

test('Game Boy Color: la CGB-CPU-04 del Gerber enlazada y OpenGBC sin enlazar', async ({ page }) => {
  await sin3D(page);
  await page.goto('#/consolas/gbc/placa3d/U1');
  await expect(page.locator('.placa-consola')).toHaveAttribute('data-placa', 'gbc-cgb04');
  const lado = page.locator('.placa-consola .lado');
  await expect(lado.locator('.nombre')).toContainText('U1');
  await expect(lado).toContainText('el Gerber no da la huella ni el cuerpo');
  await expect(lado.locator('.nodos')).toContainText('ø');
  const d = await placa(page, 'gbc-cgb04');
  expect(d.consola.refs.length).toBeGreaterThan(120);
  expect(d.pads.length).toBeGreaterThan(500);
  // the modern board: not the original, never linked
  await page.getByRole('button', { name: /OpenGBC/ }).click();
  await expect(page.locator('.placa-consola')).toHaveAttribute('data-placa', 'gbc-opengbc');
  await expect(lado).toContainText('No enlazada con el esquema');
  await expect(lado).toContainText('no es la placa de Nintendo');
  // the choice is kept while switching tabs
  await page.getByRole('navigation', { name: 'Vista' }).getByRole('link', { name: 'Placa en 2D' }).click();
  await expect(page.locator('.placa-consola')).toHaveAttribute('data-placa', 'gbc-opengbc');
});

test('las fuentes dicen de dónde sale cada placa y su licencia', async ({ page }) => {
  await page.goto('#/consolas/gbc/fuentes');
  const s = page.locator('.placas-fuentes');
  await expect(s).toContainText('CC BY-NC-SA 4.0');
  await expect(s).toContainText('no es la placa original');
  await expect(s).toContainText('CC BY-SA 4.0');
  await page.goto('#/consolas/megadrive/fuentes');
  await expect(s).toContainText('stonedDiscord');
  await expect(s).toContainText('uso privado');
  await page.goto('#/consolas/nes/fuentes');
  await expect(s).toContainText('OpenTendo');
  await expect(s).toContainText('TAPR Open Hardware License 1.0');
  await page.goto('#/consolas/sms/fuentes');
  await expect(page.locator('.fuentes')).toBeVisible();
  await expect(s).toHaveCount(0);
});

test('la placa en 3D de la CGB-CPU-04 se monta con WebGL', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('#/consolas/gbc/placa3d/U3');
  await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo === true, null, {
    timeout: 180_000,
  });
  await expect(page.locator('.placa-consola .lado .nombre')).toContainText('U3');
  await expect(page.locator('.placa-consola canvas').first()).toBeVisible();
});
