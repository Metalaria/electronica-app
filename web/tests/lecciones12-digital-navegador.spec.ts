// 1.2 (motor12c) widgets «figura» and «logica» and their steps in the browser (contenido/lecciones11/GUIA.md §11):
// the catalogue lesson tests/lecciones12-catalogo/cap29/sec-29.2.yaml is generated here, in Node, and served in place
// of the published one, so this runs against any build. One pass through every card with the keyboard (switches,
// the cursor of the timing diagram, the cells of a truth table, the zones' list, the drawing) and the pointer (a tap
// on the figure, on a wire with the probe), axe on every card; then at 360 px in dark and sepia: no horizontal
// scroll, 44 px targets and axe.
//   EPA_DIST=… EPA_PUERTO=… PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones12.config.ts tests/lecciones12-digital-navegador.spec.ts
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import type { Leccion11 } from '../src/lib/leccion11/tipos.ts';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { recursosLibro } from '../scripts/recursos11.mjs';

await cargarEsquemas11();
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const contexto: ContextoLibro = {
  bloques: (p) => {
    const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
  },
  recursos: recursosLibro(path.join(web, 'public', 'libro'), path.join(web, 'public')),
};
const ID = 'cap29/sec-29.2';
const r = generarLeccion(parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', `${ID}.yaml`), 'utf8')), contexto, 'catalogo-digital');
const leccion = r.leccion as Leccion11;

async function servir(ctx: BrowserContext) {
  await ctx.route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await ctx.route('**/libro/lecciones11/indice.json', async (x) => {
    const real = await x.fetch().then((y) => y.json()).catch(() => ({ version: 1, total: 0, lecciones: {} }));
    const lecciones = { ...(real.lecciones ?? {}), [ID]: { tarjetas: leccion.tarjetas.length } };
    await x.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, total: Object.keys(lecciones).length, lecciones }) });
  });
  await ctx.route(`**/libro/lecciones11/${ID}.json`, (x) => x.fulfill({ contentType: 'application/json', body: JSON.stringify(leccion) }));
}
async function preparar(page: Page, tema = 'claro') {
  await page.addInitScript((t) => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18, sonido: false, vibracion: false }));
    }
  }, tema);
}
const k = (id: string) => leccion.tarjetas.findIndex((t) => t.id === id);
async function irA(page: Page, id: string) {
  await page.goto(`#/leccion/${ID}/${k(id) + 1}`);
  const d = page.getByRole('alertdialog');
  if (await d.isVisible({ timeout: 300 }).catch(() => false)) await d.getByRole('button', { name: 'Salir' }).click();
  await expect(page.locator(`[data-tarjeta="${id}"]`)).toBeVisible();
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
}
async function axe(page: Page, donde: string) {
  await page.addScriptTag({ path: AXE });
  const v = await page.evaluate(async () => {
    const r = await (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe.run(document.querySelector('[data-tarjeta]'), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] });
    return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);
  });
  expect(v, donde).toEqual([]);
}
const principal = (page: Page) => page.locator('[data-continuar]');
const veredicto = (page: Page) => page.locator('[data-veredicto]');
/** Presses a control with the keyboard (focus, then Enter or Space). */
async function teclear(page: Page, sel: string, tecla = 'Enter') {
  await page.locator(sel).focus();
  await page.keyboard.press(tecla);
}

test('figura y circuito lógico de punta a punta, con teclado y ratón, y axe en cada tarjeta', async ({ browser }) => {
  test.setTimeout(240_000);
  expect(r.errores).toEqual([]);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await servir(ctx);
  const page = await ctx.newPage();
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await preparar(page);

  // a living NAND: the switches by keyboard, the LED and the row of the truth table follow
  await irA(page, 'explore-nand');
  await expect(principal(page)).toBeDisabled();
  await expect(page.locator('[data-led="Y"]')).toHaveAttribute('data-encendido', 'si');
  await expect(page.locator('[data-fila="0"]')).toHaveAttribute('data-actual', 'si');
  await teclear(page, '[data-boton-entrada="A"]');
  await teclear(page, '[data-boton-entrada="B"]', ' ');
  await expect(page.locator('[data-boton-entrada="B"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-led="Y"]')).toHaveAttribute('data-encendido', 'no');
  await expect(page.locator('[data-fila="3"]')).toHaveAttribute('data-actual', 'si');
  await expect(page.locator('[data-hilo="A"]').first()).toHaveAttribute('data-nivel', '1');
  await expect(page.locator('[data-leds]')).toHaveText('Y apagado (0)');
  // (a tap on the drawn switch toggles it too)
  await page.locator('[data-interruptor="A"]').click();
  await expect(page.locator('[data-led="Y"]')).toHaveAttribute('data-encendido', 'si');
  await expect(principal(page)).toBeEnabled();
  await axe(page, 'explore-nand');

  // predict: the LED says «?» and the switches stay; a wrong option is explained
  await irA(page, 'prediga-nand');
  await expect(page.locator('[data-led="Y"]')).toHaveAttribute('data-encendido', 'oculto');
  await expect(page.locator('[data-boton-entrada="A"]')).toHaveAttribute('aria-disabled', 'true');
  await page.locator('[data-boton-entrada="A"]').dispatchEvent('click');
  await expect(page.locator('[data-boton-entrada="A"]')).toHaveAttribute('aria-pressed', 'true');
  await axe(page, 'prediga-nand');
  await page.locator('[data-opcion="1"]').click();
  await principal(page).click();
  await expect(veredicto(page)).toContainText('Ese 1 es el de la AND');
  await expect(page.locator('[data-led="Y"]')).toHaveAttribute('data-encendido', 'oculto');
  await principal(page).click();
  await page.locator('[data-opcion="0"]').click();
  await principal(page).click();
  await expect(veredicto(page)).toHaveAttribute('data-veredicto', 'bien');
  await expect(page.locator('[data-led="Y"]')).toHaveAttribute('data-encendido', 'no');

  // fill the truth table: one wrong row is marked, then put right
  await irA(page, 'tabla-or-nand');
  await expect(principal(page)).toBeDisabled();
  for (const [r0, v] of [[0, 0], [1, 1], [2, 1], [3, 0]] as const) {
    await teclear(page, `[data-celda="${r0}-0"]`);
    if (v === 1) await teclear(page, `[data-celda="${r0}-0"]`);
  }
  await axe(page, 'tabla');
  await principal(page).click();
  await expect(veredicto(page)).toContainText('3 de 4 filas bien');
  await expect(page.locator('[data-tabla-verdad] tr.mal')).toHaveCount(1);
  await principal(page).click();
  await teclear(page, '[data-celda="3-0"]');
  await principal(page).click();
  await expect(veredicto(page)).toHaveAttribute('data-veredicto', 'bien');
  await expect(veredicto(page)).toContainText('Es la OR');

  // design an OR with NAND gates: two gates do not do it, three do
  await irA(page, 'disene-or');
  await page.locator('[data-anadir-puerta]').click();
  await page.locator('[data-anadir-puerta]').click();
  await page.locator('[data-puerta="1"] [data-entrada-puerta="2"]').selectOption('A');
  await page.locator('[data-puerta="2"] [data-entrada-puerta="1"]').selectOption('p1');
  await page.locator('[data-puerta="2"] [data-entrada-puerta="2"]').selectOption('B');
  await expect(page.locator('[data-plano] [data-pieza="p2"]')).toBeVisible();
  await principal(page).click();
  await expect(veredicto(page)).toContainText('Con A = 0, B = 0 su circuito da 1 y debe dar 0.');
  await principal(page).click();
  await page.locator('[data-puerta="2"] [data-entrada-puerta="1"]').selectOption('B');
  await page.locator('[data-anadir-puerta]').click();
  await page.locator('[data-puerta="3"] [data-entrada-puerta="1"]').selectOption('p1');
  await page.locator('[data-puerta="3"] [data-entrada-puerta="2"]').selectOption('p2');
  await expect(page.locator('[data-salida-diseno]')).toHaveValue('p3');
  await teclear(page, '[data-boton-entrada="B"]');
  await expect(page.locator('[data-led="Y"]')).toHaveAttribute('data-encendido', 'si');
  await axe(page, 'diseno-logico');
  await principal(page).click();
  await expect(veredicto(page)).toHaveAttribute('data-veredicto', 'bien');
  await expect(veredicto(page)).toContainText('Funciona, con 3 puertas: el mínimo.');

  // fault finding with the logic probe: a wrong suspect explained by a reading, then the right piece
  await irA(page, 'averia-or');
  await expect(page.locator('[data-logica]')).toHaveAttribute('data-modo', 'averia');
  await expect(page.locator('[data-hilo="n1"]').first()).toHaveAttribute('data-nivel', 'oculto');
  await page.locator('[data-punto]').selectOption('s-n1');
  await teclear(page, '[data-medir]');
  await expect(page.locator('[data-lectura-sonda]')).toHaveText('ALTO (1)');
  // (a tap on a wire measures it too: the input pin of N3 that comes from N1 is the open one)
  await page.locator('[data-sondear="n2"]').first().dispatchEvent('click');
  await expect(page.locator('[data-medidas] li')).toHaveCount(2);
  await page.locator('[data-punto]').selectOption('p-n3-1');
  await page.locator('[data-medir]').click();
  await expect(page.locator('[data-lectura-sonda]')).toHaveText('sin nivel (al aire)');
  await page.locator('[data-sospechoso="n1"]').click();
  await axe(page, 'averia-logica');
  await principal(page).click();
  await expect(veredicto(page)).toContainText('Si fuera N1 (invierte A) (salida atascada a 0), con A = 0, B = 0 la sonda en «Salida de N1» marcaría nivel bajo (0); usted midió nivel alto (1).');
  await principal(page).click();
  await page.locator('[data-sospechoso="n3"]').click();
  await principal(page).click();
  await expect(veredicto(page)).toHaveAttribute('data-veredicto', 'bien');
  await page.locator('[data-otra-averia]').click();
  await expect(page.locator('[data-paso-averia-logica]')).toHaveAttribute('data-ronda', '1');

  // the timing diagram: the cursor by keyboard moves the circuit to that moment
  await irA(page, 'explore-divisor');
  await expect(principal(page)).toBeDisabled();
  await expect(page.locator('[data-led="Q"]')).toHaveAttribute('data-encendido', 'no');
  await page.locator('[data-tramo]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-led="Q"]')).toHaveAttribute('data-encendido', 'si');
  await expect(page.locator('[data-onda="Q"]')).toBeVisible();
  await expect(principal(page)).toBeEnabled();
  await axe(page, 'cronograma');

  // draw Q in digital mode: all low is wrong (marked), then the right levels by keyboard
  await irA(page, 'dibuje-divisor');
  await expect(page.locator('[data-onda="Q"]')).toHaveCount(0);
  const dibujo = page.locator('[data-dibujo-digital]');
  await dibujo.focus();
  for (let j = 0; j < 8; j++) {
    await page.keyboard.press('0');
    await page.keyboard.press('ArrowRight');
  }
  await axe(page, 'dibujar-digital');
  await principal(page).click();
  await expect(veredicto(page)).toContainText('4 de 8 tramos no coinciden');
  await principal(page).click();
  await dibujo.focus();
  await page.keyboard.press('Home');
  for (const v of [0, 1, 1, 0, 0, 1, 1, 0]) {
    await page.keyboard.press(v ? 'ArrowUp' : 'ArrowDown');
    await page.keyboard.press('ArrowRight');
  }
  await principal(page).click();
  await expect(veredicto(page)).toHaveAttribute('data-veredicto', 'bien');
  await expect(page.locator('[data-onda-correcta]')).toBeVisible();

  // the book figure: a tap on the picture, the list by keyboard; «Continuar» once both asked zones are seen
  await irA(page, 'explore-soldaduras');
  await expect(page.locator('[data-figura] img')).toHaveJSProperty('complete', true);
  await expect(principal(page)).toBeDisabled();
  const caja = await page.locator('[data-zonas]').boundingBox();
  // (the zone «puente» is the middle of the bottom row: x 159–295 of 453.6, y 138–270 of 273.6)
  await page.mouse.click(caja!.x + caja!.width * (227 / 453.6), caja!.y + caja!.height * (200 / 273.6));
  await expect(page.locator('[data-info-zona]')).toContainText('Puente: cortocircuita islas adyacentes.');
  await expect(page.locator('[data-zona="puente"]')).toHaveAttribute('data-estado', 'vista');
  await teclear(page, '[data-boton-zona="fria"]');
  await expect(page.locator('[data-info-zona]')).toContainText('Fría: mate y grumosa.');
  await expect(principal(page)).toBeEnabled();
  await teclear(page, '[data-ampliar]');
  await expect(page.locator('[data-entera]')).toBeVisible();
  await axe(page, 'figura');

  // «toque»: a wrong zone explained and crossed out, then the right one from the list
  await irA(page, 'toque-puente');
  await page.locator('[data-boton-zona="fria"]').click();
  await principal(page).click();
  await expect(veredicto(page)).toContainText('Está mate y grumosa, pero en una sola isla.');
  await principal(page).click();
  await expect(page.locator('[data-zona="fria"]')).toHaveAttribute('data-estado', 'mal');
  await expect(page.locator('[data-boton-zona="fria"]')).toHaveAttribute('aria-disabled', 'true');
  await teclear(page, '[data-boton-zona="puente"]');
  await axe(page, 'tocar');
  await principal(page).click();
  await expect(veredicto(page)).toHaveAttribute('data-veredicto', 'bien');
  await expect(page.locator('[data-zona="puente"]')).toHaveAttribute('data-estado', 'bien');

  // a console photo of the explorer: its hotspot boxes are the zones
  await irA(page, 'toque-decodificador');
  await expect(page.locator('[data-figura] img')).toHaveJSProperty('complete', true);
  expect(await page.locator('[data-figura] img').evaluate((x) => (x as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('[data-zona="decodificador"] rect:not(.halo)')).toHaveCount(1);
  await page.locator('[data-boton-zona="cpu"]').click();
  await principal(page).click();
  await expect(veredicto(page)).toContainText('Es la CPU');
  await principal(page).click();
  await page.locator('[data-boton-zona="decodificador"]').click();
  await principal(page).click();
  await expect(veredicto(page)).toHaveAttribute('data-veredicto', 'bien');
  await axe(page, 'consola');

  expect(errores).toEqual([]);
  await ctx.close();
});

for (const tema of ['oscuro', 'sepia'])
  test(`360 px en ${tema}: sin desplazamiento horizontal, objetivos de 44 px y axe en las tarjetas de figura y lógica`, async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ viewport: { width: 360, height: 760 }, deviceScaleFactor: 2, hasTouch: true });
    await servir(ctx);
    const page = await ctx.newPage();
    await preparar(page, tema);
    for (const id of ['explore-nand', 'tabla-or-nand', 'disene-or', 'averia-or', 'explore-divisor', 'dibuje-divisor', 'toque-puente', 'toque-decodificador']) {
      await irA(page, id);
      if (id === 'disene-or') {
        for (let j = 0; j < 3; j++) await page.locator('[data-anadir-puerta]').click();
      }
      const anchos = await page.evaluate(() =>
        [...document.querySelectorAll('[data-tarjeta] *')]
          .filter((x) => x.getBoundingClientRect().right > 361 && !x.closest('.d12-marco.ampliada, .d12-circuito') && ![...x.children].some((c) => c.getBoundingClientRect().right > 361))
          .map((x) => `${x.tagName}.${(x as HTMLElement).className} ${Math.round(x.getBoundingClientRect().right)}`)
          .slice(0, 8),
      );
      expect(anchos, id).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), id).toBeLessThanOrEqual(360);
      const pequenos = await page.locator('[data-tarjeta] :is(.a12 button, .a12 input, .a12 select, .d12 button, .d12 input, .d12 select, .escalera button)').evaluateAll((xs) =>
        xs.filter((x) => (x as HTMLElement).offsetParent && (x.getBoundingClientRect().height < 44 || x.getBoundingClientRect().width < 44)).map((x) => `${x.tagName} ${x.textContent?.trim().slice(0, 20)}`),
      );
      expect(pequenos, id).toEqual([]);
      await axe(page, `${id} ${tema}`);
    }
    await ctx.close();
  });
