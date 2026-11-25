// 2.0 (gamecube20): the GameCube in «Consolas», the machine with NO schematic. The app must degrade cleanly where the
// other machines show «Esquema» and «Busque la avería»: those tabs are hidden and a notice says why; the routes to them
// fall back to the photo without an error; the photo, «Fuentes», the board and the architecture say «no schematic»
// instead of offering links that lead nowhere. Plus the data (hotspots, sources, voltages), the architecture decoder,
// the inside of Flipper, «Un fotograma», the board's route selection and no horizontal overflow on a phone.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.gamecube20.config.ts tests/consolas-gamecube.spec.ts
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publico = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = (r: string): any => JSON.parse(fs.readFileSync(path.join(publico, r), 'utf8'));

/** Page errors and console errors of a page, to check that nothing breaks. */
function errores(page: Page): string[] {
  const lista: string[] = [];
  page.on('pageerror', (e) => lista.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') lista.push(m.text());
  });
  return lista;
}

async function sin3D(page: Page): Promise<void> {
  await page.addInitScript(() => ((globalThis as unknown as { __epaSinWebGL: boolean }).__epaSinWebGL = true));
}

const vista = (page: Page) => page.getByRole('navigation', { name: 'Vista' });

test('datos: sin esquema, tres fotos con recuadros dentro, fuentes con licencia y tensiones citadas', () => {
  const d = json('consolas/gamecube.json');
  expect(d.sin_esquema).toContain('ConsoleArtisan');
  expect(d.hojas).toEqual([]);
  expect(d.redes).toEqual([]);
  expect(Object.keys(d.componentes)).toEqual([]);
  const fotos = [{ ...d.foto, hotspots: d.hotspots }, ...d.fotos];
  expect(fotos.map((f: { id: string }) => f.id)).toEqual(['componentes', 'soldaduras', 'cc-cc']);
  for (const f of fotos) {
    expect(f.credito).toContain('CC BY-NC-SA 3.0');
    for (const h of f.hotspots) {
      expect(['marca', 'posicion']).toContain(h.confianza);
      expect(h.esquema).toEqual([]);
      for (const c of h.cajas) expect(c[0] >= 0 && c[1] >= 0 && c[2] <= f.ancho && c[3] <= f.alto && c[2] > c[0] && c[3] > c[1], `${f.id} ${h.id}`).toBe(true);
    }
  }
  expect(d.foto.revision).toContain('DOL-CPU(P)-01');
  for (const s of d.fuentes) expect(s.licencia.length, s.titulo).toBeGreaterThan(3);
  expect(d.tensiones.find((t: { punto: string }) => t.punto.includes('patilla 5')).tension).toBe('+12 V');
  for (const t of d.tensiones) expect(t.fuente).toBeTruthy();
  // the board: reconstructed, no pads or nets, marked as without schematic
  const p = json('consolas/placas/gamecube.json');
  expect(p.consola.sin_esquema).toBe(true);
  expect(p.consola.tipo).toBe('foto');
  expect(p.pads).toEqual([]);
  expect(p.huellas.length).toBeGreaterThan(15);
  expect(json('consolas/placas/indice.json').placas.some((e: { id: string }) => e.id === 'gamecube')).toBe(true);
});

test('las pestañas: sin «Esquema» ni «Busque la avería», y un aviso que lo explica', async ({ page }) => {
  const err = errores(page);
  await page.goto('#/consolas/gamecube/foto');
  const nav = vista(page);
  for (const t of ['Foto', 'Arquitectura', 'Un fotograma', 'Placa en 3D', 'Placa en 2D', 'Fuentes']) await expect(nav.getByRole('link', { name: t, exact: true }), t).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Esquema', exact: true })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Busque la avería', exact: true })).toHaveCount(0);
  const aviso = page.getByTestId('sin-esquema');
  await expect(aviso).toContainText('no existe ningún esquema');
  await aviso.getByRole('link').click();
  await expect(page).toHaveURL(/#\/consolas\/gamecube\/fuentes$/);
  await expect(page.getByTestId('por-que-sin-esquema')).toContainText('no va a haberlos');
  // a machine with a schematic keeps its tab and shows no notice
  await page.goto('#/consolas/nes/foto');
  await expect(nav.getByRole('link', { name: 'Esquema', exact: true })).toBeVisible();
  await expect(page.getByTestId('sin-esquema')).toHaveCount(0);
  expect(err).toEqual([]);
});

test('las rutas al esquema y a la avería caen en la foto, sin error', async ({ page }) => {
  const err = errores(page);
  for (const r of ['esquema', 'esquema/U1', 'averia', 'averia/no-enciende']) {
    await page.goto(`#/consolas/gamecube/${r}`);
    await expect(vista(page).getByRole('link', { name: 'Foto', exact: true }), r).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.foto-vista')).toBeVisible();
    await expect(page.getByText('No se pudo', { exact: false })).toHaveCount(0);
  }
  expect(err).toEqual([]);
});

test('la foto: la ficha no ofrece el esquema y lleva a la arquitectura', async ({ page }) => {
  await page.goto('#/consolas/gamecube/foto');
  await page.locator('button[data-hotspot="flipper"]').click();
  const ficha = page.locator('.foto-vista .ficha');
  await expect(ficha).toContainText('Pieza identificada en la foto');
  await expect(ficha).toContainText('FLIPPER A');
  await expect(ficha).toContainText('De dónde sale:');
  await expect(ficha).not.toContainText('SNK');
  await expect(ficha.getByRole('button', { name: /Ver en el esquema/ })).toHaveCount(0);
  await ficha.getByRole('button', { name: 'Ver en la arquitectura' }).click();
  await expect(page).toHaveURL(/#\/consolas\/gamecube\/arquitectura\/bloque%3Aflipper$/);
  await expect(page.locator('.arquitectura .ficha').last()).toContainText('Flipper');
});

test('Fuentes: por qué no hay esquema, las tensiones y nada de hojas de KiCad', async ({ page }) => {
  await page.goto('#/consolas/gamecube/fuentes');
  const f = page.locator('.fuentes');
  await expect(f.getByRole('heading', { name: 'Por qué no hay esquema' })).toBeVisible();
  const t = page.getByTestId('tensiones');
  await expect(t).toContainText('+12 V');
  await expect(t).toContainText('3,43 V');
  await expect(f).toContainText('Por qué no hay «Busque la avería»');
  await expect(f).not.toContainText('Las hojas se dibujan');
  await expect(f).toContainText('CC BY 4.0');
});

test('arquitectura: el decodificador de 32 bits y el interior de Flipper', async ({ page }) => {
  await page.goto('#/consolas/gamecube/arquitectura');
  const dir = page.getByRole('textbox', { name: 'Dirección en hexadecimal' });
  await dir.fill('CC008000');
  await page.getByRole('button', { name: 'Decodificar', exact: true }).click();
  await expect(page.locator('.resultado')).toHaveAttribute('data-seleccion', 'GX FIFO');
  await dir.fill('80003100');
  await page.getByRole('button', { name: 'Decodificar', exact: true }).click();
  await expect(page.locator('.resultado')).toContainText('Memoria principal, con caché');
  await page.getByRole('button', { name: 'Dentro de Flipper' }).click();
  await expect(page.getByText('Bloques de Flipper según Copetti y YAGCD', { exact: false })).toBeVisible();
});

test('«Un fotograma»: 15 pasos, del disco a la tele', async ({ page }) => {
  await page.goto('#/consolas/gamecube/fotograma');
  await expect(page.locator('[data-fotograma="gamecube"] h2')).toBeVisible();
  await expect(page.locator('[data-cuenta]')).toHaveText('1/15');
  await page.goto('#/consolas/gamecube/fotograma/9');
  await expect(page.locator('#fotograma-titulo')).toContainText('paleta');
});

test('la placa en 2D: sin esquema, y la selección de la ruta se conserva', async ({ page }) => {
  await sin3D(page);
  const err = errores(page);
  await page.goto('#/consolas/gamecube/placa2d');
  const lado = page.locator('.placa-consola .lado');
  await expect(lado).toContainText('Esta consola no tiene esquema');
  await expect(lado).toContainText('Cómo se ha reconstruido:');
  await expect(lado).not.toContainText('Comprobaciones con el esquema');
  await expect(page.locator('[data-reconstruccion]')).toContainText('No hay pads ni redes');
  await expect(page.locator('[data-reconstruccion]')).not.toContainText('se iluminan sus pads');
  await page.goto('#/consolas/gamecube/placa2d/U1');
  await expect(lado.locator('.nombre')).toContainText('U1');
  await expect(lado.getByRole('button', { name: 'Ver en el esquema' })).toHaveCount(0);
  await lado.getByRole('button', { name: 'Ver en la foto' }).click();
  await expect(page).toHaveURL(/#\/consolas\/gamecube\/foto\/foto%3Aflipper$/);
  await expect(page.locator('.foto-vista .ficha')).toContainText('FLIPPER A');
  expect(err).toEqual([]);
});

test('la placa en 3D abre con una pieza elegida, sin error', async ({ page }) => {
  const err = errores(page);
  await page.goto('#/consolas/gamecube/placa3d/U2');
  const lado = page.locator('.placa-consola .lado');
  await expect(lado.locator('.nombre')).toContainText('U2');
  await expect(lado).toContainText('PPCDBK-EFB486X3');
  await page.waitForTimeout(1500);
  expect(err.filter((e) => !/WebGL|GPU stall|GL Driver/i.test(e))).toEqual([]);
});

test('en el teléfono ninguna vista de la GameCube desborda a lo ancho', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await sin3D(page);
  const err = errores(page);
  for (const v of ['foto', 'arquitectura', 'fotograma', 'placa2d', 'placa3d', 'fuentes']) {
    await page.goto(`#/consolas/gamecube/${v}`);
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), v).toBeLessThanOrEqual(412);
  }
  expect(err).toEqual([]);
  await ctx.close();
});
