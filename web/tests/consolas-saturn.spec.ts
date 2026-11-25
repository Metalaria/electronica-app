// 2.0 (saturn20): the Sega Saturn in «Consolas». Its schematic is RGBeter's KiCad reproduction of the VA0.5 main board
// (six sheets) plus a seventh sheet, the SH-1 CD board, transcribed by hand from Sega's PAL service manual and joined
// to the main board through the CN4 ↔ E101 connector; its board is RGBeter's KiCad PCB; its photos are Evan-Amos's
// (public domain). The spec checks the data (sheets, the joined nets, photos, sources and licence), the jumps between
// photo, schematic, architecture and board, the architecture decoder, «Un fotograma», «Busque la avería» on CN3 and
// IC34, and that no view overflows on a phone.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.saturn20.config.ts tests/consolas-saturn.spec.ts
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

type Red = { n: string; g: string; nodos: [string, string, string][]; h: number[] };

test('datos: siete hojas (la 7, la placa SH-1), redes unidas por CN4–E101, fotos con recuadros y licencia', () => {
  const d = json('consolas/saturn.json');
  expect(d.hojas.length).toBe(8);
  expect(d.hojas[7].nombre).toContain('placa SH-1');
  for (const h of d.hojas.slice(1)) expect(fs.existsSync(path.join(publico, `consolas/saturn/hoja-${h.id}.json`)), `hoja ${h.id}`).toBe(true);
  // the SH-1 board keeps its own references, with the prefix of its board
  expect(d.componentes['SH1-IC103'].v).toBe('YGR019A');
  expect(d.componentes['SH1-IC103'].h).toEqual([7]);
  expect(d.componentes['SH1-IC101'].h).toEqual([7]);
  expect(d.componentes['IC5']).toBeTruthy();
  const redes: Red[] = d.redes;
  const de = (ref: string, pin: string) => redes.filter((r) => r.nodos.some(([a, b]) => a === ref && b === pin));
  // the mated connector: each pin of E101 on the SH-1 board is the same net as that pin of CN4 on the main board
  const exbg6 = de('SH1-E101', 'A32');
  expect(exbg6.length).toBe(1);
  expect(exbg6[0].n).toBe('EXBG6');
  expect(exbg6[0].nodos.some(([a, b]) => a === 'CN4' && b === 'A32')).toBe(true);
  expect(exbg6[0].h).toContain(7);
  // the main board's name wins over an automatic one: the ground stays «GND», on all seven sheets
  const gnd = redes.find((r) => r.n === 'GND')!;
  expect(gnd.h).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(gnd.nodos.some(([a]) => a.startsWith('SH1-'))).toBe(true);
  expect(redes.some((r) => /^unconnected-\(CN4-/.test(r.n) && r.nodos.length > 2)).toBe(false);
  // the power rails are separate nets (KiCad 9 power symbols named per instance)
  for (const n of ['VCC', 'LVCC', '+9V', 'AVCC1']) expect(redes.filter((r) => r.n === n).length, n).toBe(1);
  expect(de('CN3', '3')[0].n).toBe('LVCC');
  expect(de('IC34', '1')[0].n).toBe('AVCC1');
  // photos: Evan-Amos, public domain, every box inside its photo
  const fotos = [{ ...d.foto, hotspots: d.hotspots }, ...d.fotos];
  expect(fotos.map((f: { id: string }) => f.id)).toEqual(['va8', 'va8-b']);
  for (const f of fotos) {
    expect(f.credito).toContain('Evan-Amos');
    expect(f.credito).toContain('dominio público');
    expect(fs.existsSync(path.join(publico, f.src.replace(/^\//, '')))).toBe(true);
    for (const h of f.hotspots) for (const c of h.cajas) expect(c[0] >= 0 && c[1] >= 0 && c[2] <= f.ancho && c[3] <= f.alto && c[2] > c[0] && c[3] > c[1], `${f.id} ${h.id}`).toBe(true);
  }
  expect(d.hotspots.find((h: { id: string }) => h.id === 'ygr').esquema).toEqual(['SH1-IC103']);
  // sources: RGBeter's licence text is shipped; Sega's manual is cited, not shipped
  const rgb = d.fuentes.find((s: { titulo: string }) => s.titulo.includes('RGBeter'));
  expect(rgb.licencia).toContain('CERN-OHL-S');
  expect(fs.readFileSync(path.join(publico, 'consolas/saturn/LICENSE-RGBeter.txt'), 'utf8')).toContain('CERN Open Hardware Licence Version 2 - Strongly Reciprocal');
  expect(d.fuentes.some((s: { titulo: string }) => /Service Manual|manual de servicio/i.test(s.titulo))).toBe(true);
  expect(fs.readdirSync(path.join(publico, 'consolas/saturn')).some((f) => /\.pdf$/i.test(f))).toBe(false);
  // the board: the outline welded into one closed board of 238 × 207 mm, linked to the schematic
  const p = json('consolas/placas/saturn.json');
  expect(p.placa.ancho).toBeGreaterThan(23700);
  expect(p.placa.ancho).toBeLessThan(23900);
  expect(p.placa.alto).toBeGreaterThan(20600);
  expect(p.placa.alto).toBeLessThan(20800);
  expect(p.consola.enlazada).toBe(true);
  expect(p.huellas.length).toBeGreaterThan(400);
  expect(json('consolas/placas/indice.json').placas.some((e: { id: string }) => e.id === 'saturn')).toBe(true);
});

test('las pestañas de la Saturn, con «Arquitectura», «Un fotograma» y «Busque la avería»', async ({ page }) => {
  const err = errores(page);
  await page.goto('#/consolas/saturn/foto');
  const nav = vista(page);
  for (const t of ['Foto', 'Esquema', 'Arquitectura', 'Un fotograma', 'Placa en 3D', 'Placa en 2D', 'Busque la avería', 'Fuentes'])
    await expect(nav.getByRole('link', { name: t, exact: true }), t).toBeVisible();
  await expect(page.locator('[data-elegir-consola] .nombre')).toHaveText(/Sega Saturn/); // (2.1: the machine is the page's title; the others in its menu)
  await expect(page.locator('.foto-vista img')).toHaveAttribute('src', /foto-va8\.jpg$/);
  expect(err).toEqual([]);
});

test('el YGR019 de la foto salta a la hoja 7 del esquema, y la SCU a la arquitectura', async ({ page }) => {
  const err = errores(page);
  await page.goto('#/consolas/saturn/foto');
  await page.locator('button[data-hotspot="ygr"]').click();
  const ficha = page.locator('.foto-vista .ficha');
  await expect(ficha).toContainText('YGR019');
  await ficha.getByRole('button', { name: /Ver en el esquema/ }).first().click();
  await expect(page).toHaveURL(/#\/consolas\/saturn\/esquema\//);
  await expect(page.locator('.marco')).toHaveAttribute('data-simbolo', 'SH1-IC103');
  await expect(page.locator('.esquema .ficha')).toContainText('YGR019A');
  // a main board chip on its own sheet, then to the architecture
  await page.goto('#/consolas/saturn/esquema/IC5');
  await expect(page.locator('.marco')).toHaveAttribute('data-simbolo', 'IC5');
  await page.locator('.esquema .ficha').getByRole('button', { name: 'Ver en la arquitectura' }).click();
  await expect(page).toHaveURL(/#\/consolas\/saturn\/arquitectura\//);
  await expect(page.locator('.arquitectura .ficha').last()).toContainText('SCU');
  expect(err).toEqual([]);
});

test('arquitectura: el decodificador lleva $25E00000 a la VRAM del VDP2 por /CS2 → /BCS2, y la norma cambia los relojes', async ({ page }) => {
  await page.goto('#/consolas/saturn/arquitectura');
  const dir = page.getByRole('textbox', { name: 'Dirección en hexadecimal' });
  await dir.fill('25E00000');
  // (Enter, as the phone keyboard's «Ir»: the bottom tab bar, hidden while a text box has the focus, comes back on
  // blur under a tap near the bottom of a phone screen)
  await dir.press('Enter');
  await expect(page.locator('.resultado')).toHaveAttribute('data-seleccion', '/CS2 → /BCS2');
  await expect(page.locator('.resultado')).toContainText('VRAM del VDP2');
  await expect(page.locator('.resultado')).toContainText('sin caché');
  await dir.fill('06123456');
  await dir.press('Enter');
  await expect(page.locator('.resultado')).toHaveAttribute('data-seleccion', '/CS3 → /CS3');
  await expect(page.locator('.resultado')).toContainText('06023456');
  await dir.fill('05800000');
  await dir.press('Enter');
  await expect(page.locator('.resultado')).toHaveAttribute('data-seleccion', '/CS2 → /ACS2');
});

test('arquitectura: cada escenario en NTSC y en PAL, sin error, y PAL cambia el cristal', async ({ page }) => {
  const err = errores(page);
  await page.goto('#/consolas/saturn/arquitectura');
  const escenarios = page.getByRole('tablist', { name: 'Escenario' }).getByRole('tab');
  await expect(escenarios).toHaveText(['Ciclos de la SH-2', 'Decodificar una dirección', 'Cuadro e interrupciones', 'Bloque de CD → SH-2', 'Relojes']);
  const normas = page.getByRole('group', { name: 'Norma de vídeo' }).getByRole('button');
  for (const n of ['NTSC', 'PAL']) {
    await normas.filter({ hasText: n }).click();
    await expect(page.locator('[data-norma]')).toHaveAttribute('data-norma', n.toLowerCase());
    for (let i = 0; i < 5; i++) {
      await escenarios.nth(i).click();
      await expect(escenarios.nth(i)).toHaveAttribute('aria-selected', 'true');
      await page.getByRole('button', { name: 'Paso adelante' }).click();
      await page.waitForTimeout(150);
    }
    await expect(page.locator('.descripcion')).toContainText(n === 'PAL' ? '17,7344 MHz' : '14,31818 MHz');
    await expect(page.locator('[data-norma]')).toContainText(n === 'PAL' ? '313 líneas' : '14,31818 MHz');
  }
  expect(err).toEqual([]);
});

test('«Un fotograma»: 13 pasos, del programa a la tele', async ({ page }) => {
  const err = errores(page);
  await page.goto('#/consolas/saturn/fotograma');
  await expect(page.locator('[data-fotograma="saturn"] h2')).toBeVisible();
  await expect(page.locator('[data-cuenta]')).toHaveText('1/13');
  await page.goto('#/consolas/saturn/fotograma/13');
  await expect(page.locator('[data-cuenta]')).toHaveText('13/13');
  expect(err).toEqual([]);
});

test('«Busque la avería»: sin imagen por el regulador IC34 o por los 3,3 V de la fuente', async ({ page }) => {
  await sin3D(page);
  const err = errores(page);
  await page.goto('#/consolas/saturn/averia/regulador-muerto');
  await expect(page.locator('[data-averia-placa]')).toBeVisible({ timeout: 60_000 });
  const roja = page.locator('[data-select-punta="roja"]');
  const negra = page.locator('[data-select-punta="negra"]');
  const lectura = page.locator('[data-lectura-averia]');
  // on a phone the list of test points starts folded
  const abrir = async () => {
    if ((await page.locator('details.puntos').getAttribute('open')) === null) await page.locator('details.puntos summary').click();
  };
  await abrir();
  await negra.selectOption('IC34.2');
  await roja.selectOption('IC34.3');
  await expect(lectura).toContainText(': 9,00 V');
  await roja.selectOption('IC34.1');
  await expect(lectura).toContainText(': 0,00 V');
  await negra.selectOption('CN3.1');
  await roja.selectOption('CN3.4');
  await expect(lectura).toContainText(': 5,00 V');
  await page.locator('[data-sospechoso="regulador"]').click();
  await expect(page.locator('[data-diagnostico]')).toHaveAttribute('data-diagnostico', 'bien');

  await page.goto('#/consolas/saturn/averia/fuente-sin-3');
  await expect(page.locator('[data-averia-placa]')).toBeVisible({ timeout: 60_000 });
  await abrir();
  await negra.selectOption('CN3.1');
  await roja.selectOption('CN3.3');
  await expect(lectura).toContainText(': 0,00 V');
  await roja.selectOption('IC34.1');
  await expect(lectura).toContainText(': 5,00 V');
  await page.locator('[data-sospechoso="regulador"]').click();
  await expect(page.locator('[data-diagnostico]')).toHaveAttribute('data-diagnostico', 'mal');
  expect(err).toEqual([]);
});

test('la placa en 2D: una pieza elegida enlaza con el esquema y con la foto', async ({ page }) => {
  await sin3D(page);
  const err = errores(page);
  await page.goto('#/consolas/saturn/placa2d/IC14');
  const lado = page.locator('.placa-consola .lado');
  await expect(lado.locator('.nombre')).toContainText('IC14', { timeout: 60_000 });
  await expect(lado).toContainText('PQFP-160');
  await lado.getByRole('button', { name: 'Ver en el esquema' }).click();
  await expect(page).toHaveURL(/#\/consolas\/saturn\/esquema\//);
  await expect(page.locator('.marco')).toHaveAttribute('data-simbolo', 'IC14');
  expect(err).toEqual([]);
});

test('Fuentes: licencia de RGBeter, manual de Sega citado y fotos de Evan-Amos, sin error', async ({ page }) => {
  const err = errores(page);
  await page.goto('#/consolas/saturn/fuentes');
  const f = page.locator('.fuentes');
  // the sources of «Un fotograma» are listed by their address: each one its own (three Sega manuals in one folder
  // address broke the list with a duplicate key)
  await expect(page.locator('.fuentes-fotograma li')).toHaveCount(4);
  await expect(f).toContainText('CERN-OHL-S');
  await expect(f).toContainText('Evan-Amos');
  await expect(f).toContainText('SH-1');
  expect(err).toEqual([]);
});

test('en el teléfono ninguna vista de la Saturn desborda a lo ancho', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await sin3D(page);
  const err = errores(page);
  for (const v of ['foto', 'esquema', 'arquitectura', 'fotograma', 'placa2d', 'averia', 'fuentes']) {
    await page.goto(`#/consolas/saturn/${v}`);
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), v).toBeLessThanOrEqual(412);
  }
  expect(err).toEqual([]);
  await ctx.close();
});
