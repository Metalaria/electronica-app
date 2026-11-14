// 1.2 learning-by-doing step types in the browser: the catalogue lesson tests/lecciones12-catalogo/cap01/sec-1.4.yaml
// (one card of each type) is generated here, in Node, and served in place of the published one, so this runs against
// any build. One pass through every card with the keyboard and the mouse: the hint ladder, an estimate that forgot
// the load (explained) and the app's ngspice result, a design approved with its tolerance corners, a fault found
// after a wrong suspect (explained from the probe), a control tuned into its band, the optional bench comparison, a
// drawing compared and overlaid, SQLite in WebAssembly (an error in Spanish, a result table, a filled query), axe
// (contrast included) on every card; and at 360 px in dark and sepia, no horizontal scroll, 44 px targets and axe.
//   EPA_DIST=… EPA_PUERTO=… PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones12.config.ts tests/lecciones12-navegador.spec.ts
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import type { Leccion11 } from '../src/lib/leccion11/tipos.ts';
import { sqlNode } from '../src/lib/leccion12/sql/node.ts';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';

await cargarEsquemas11();
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const contexto: ContextoLibro = {
  bloques: (p) => {
    const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
  },
  sql: await sqlNode(),
};
const ID = 'cap01/sec-1.4';
const r = generarLeccion(parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', `${ID}.yaml`), 'utf8')), contexto, 'catalogo12');
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
  // (the shell slides a new card in: measure once it has arrived)
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
}
async function axe(page: Page, donde: string) {
  await page.addScriptTag({ path: AXE });
  const v = await page.evaluate(async () => {
    // (the card's body: the shell around it — header, footer, «Continuar» — is tested by its own specs)
    const r = await (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe.run(document.querySelector('[data-tarjeta]'), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] });
    return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);
  });
  expect(v, donde).toEqual([]);
}
const principal = (page: Page) => page.locator('[data-continuar]');
const veredicto = (page: Page) => page.locator('[data-veredicto]');

test('cada paso 1.2 de punta a punta, con teclado y ratón, y axe en cada tarjeta', async ({ browser }) => {
  test.setTimeout(240_000);
  expect(r.errores).toEqual([]);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await servir(ctx);
  const page = await ctx.newPage();
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await preparar(page);

  // predict, then simulate: the ladder first, then an estimate that forgot the load
  await irA(page, 'simule-carga');
  await page.locator('[data-pedir-pista]').click();
  await expect(page.locator('[data-escalera="1"]')).toContainText('Pista 1. La carga queda en paralelo con R₂.');
  await expect(principal(page)).toBeDisabled();
  await page.locator('[data-estimacion]').fill('4 V');
  await axe(page, 'simular');
  await principal(page).click();
  await expect(veredicto(page)).toHaveAttribute('data-veredicto', 'mal');
  await expect(veredicto(page)).toContainText('ha olvidado la carga');
  await expect(page.locator('[data-error-relativo]')).toHaveText('33 %');
  // the app's own ngspice gives the circuit's output
  await expect(page.locator('[data-simulado]')).toHaveText('3,00 V', { timeout: 30_000 });
  await expect(page.locator('[data-resultado-sim]')).toContainText('El simulador (ngspice)');
  await expect(principal(page)).toHaveAttribute('data-accion', 'continuar');

  // design with E24 values and the tolerance corners: R₂ from 1 kΩ to 2 kΩ (7 steps of the E24 list)
  await irA(page, 'disene-33');
  const r2 = page.locator('[data-mando11="R_2"] [role="slider"]');
  await r2.focus();
  for (let j = 0; j < 7; j++) await page.keyboard.press('ArrowRight');
  await expect(r2).toHaveAttribute('aria-valuenow', '2000');
  await principal(page).click();
  await expect(veredicto(page)).toHaveAttribute('data-veredicto', 'bien');
  await expect(page.locator('[data-pasa]')).toHaveAttribute('data-pasa', 'si');
  await expect(page.locator('[data-cumplen]')).toHaveText('4 de 4');
  await axe(page, 'diseno');

  // fault finding: a probe, a wrong suspect explained by it, then the right one
  await irA(page, 'averia-divisor');
  await page.locator('[data-sonda="salida"]').click();
  await expect(page.locator('[data-lectura-multimetro]')).toHaveText('12,0 V');
  await expect(page.locator('[data-quedan]')).toHaveAttribute('data-quedan', '1');
  await page.locator('[data-sospechoso="r1"]').click();
  await axe(page, 'averia');
  await principal(page).click();
  await expect(veredicto(page)).toContainText('Si fuera R₁ (está abierta: no conduce), en «Salida» mediría 0 V; usted ha medido 12,0 V.');
  await principal(page).click(); // «Volver a intentarlo»
  await page.locator('[data-sospechoso="r2"]').click();
  await principal(page).click();
  await expect(veredicto(page)).toHaveAttribute('data-veredicto', 'bien');
  await page.locator('[data-otra-averia]').click();
  await expect(page.locator('[data-averia]')).toHaveAttribute('data-ronda', '1');

  // tune: R₂ from 500 Ω to the band around 3,3 V with the keyboard
  await irA(page, 'ajuste-33');
  await expect(page.locator('[data-ajuste]')).toHaveAttribute('data-lado', 'bajo');
  await expect(principal(page)).toBeDisabled();
  const s = page.locator('[data-mando11="R_2"] [role="slider"]');
  await s.focus();
  for (let j = 0; j < 144; j++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-ajuste]')).toHaveAttribute('data-lado', 'dentro');
  await expect(principal(page)).toBeEnabled();
  await axe(page, 'ajuste');

  // the optional bench: «Continuar» open from the start; a reading within tolerance, then one off with its advice
  await irA(page, 'banco-divisor');
  await expect(principal(page)).toBeEnabled();
  await expect(page.locator('[data-esperado]')).toHaveText('4,00 V ± 5 %');
  await page.locator('[data-medida-banco]').fill('3,9');
  await page.locator('[data-comparar]').click();
  await expect(page.locator('[data-comparacion]')).toHaveAttribute('data-comparacion', 'bien');
  await page.locator('[data-medida-banco]').fill('4,5');
  await page.locator('[data-comparar]').click();
  await expect(page.locator('[data-consejo]')).toContainText('R₂ es la de abajo');
  await expect(page.locator('[data-ficha="1"]')).toContainText('ficha 1');
  await axe(page, 'banco');

  // draw: a flat line with the mouse is wrong (twice: the right curve is then overlaid); the keyboard moves a point
  await irA(page, 'dibuje-salida');
  const lienzo = page.locator('[data-lienzo]');
  const b = (await lienzo.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.16, b.y + b.height * 0.5);
  await page.mouse.down();
  for (let j = 0; j <= 30; j++) await page.mouse.move(b.x + b.width * (0.16 + (0.82 * j) / 30), b.y + b.height * 0.5);
  await page.mouse.up();
  await expect(principal(page)).toBeEnabled();
  await principal(page).click();
  await expect(veredicto(page)).toHaveAttribute('data-veredicto', 'mal');
  await principal(page).click();
  const v0 = await page.locator('[data-valor-punto]').inputValue();
  await page.locator('[data-valor-punto]').focus();
  await page.keyboard.press('ArrowUp');
  expect(await page.locator('[data-valor-punto]').inputValue()).not.toBe(v0);
  // (the mouse left the last point selected)
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(page.locator('[data-dibujar] .etq')).toContainText('Punto 20 de 21');
  await principal(page).click();
  await principal(page).click();
  await expect(page.locator('[data-curva-buena]')).toBeVisible();
  await axe(page, 'dibujar');

  // SQL: SQLite in WebAssembly, an error in Spanish, then the result table and the check
  await irA(page, 'sql-cuenta');
  const editor = page.locator('[data-editor-sql]');
  await editor.fill('SELECT * FROM medida');
  await page.locator('[data-ejecutar]').click();
  await expect(page.locator('[data-error-sql]')).toContainText('No existe la tabla «medida»', { timeout: 30_000 });
  await editor.fill('SELECT s.nombre, count(*) AS n FROM medidas AS m JOIN sensores AS s ON s.id = m.sensor GROUP BY s.id ORDER BY s.id');
  await expect(principal(page)).toBeDisabled();
  await editor.press('Control+Enter');
  await expect(page.locator('[data-filas]')).toHaveAttribute('data-filas', '4');
  await principal(page).click();
  await expect(veredicto(page)).toHaveAttribute('data-veredicto', 'bien');
  await axe(page, 'sql');

  await irA(page, 'sql-maxima');
  await page.locator('[data-hueco="0"]').selectOption('max');
  await page.locator('[data-hueco="1"]').fill('dia');
  await page.locator('[data-ejecutar]').click();
  await expect(page.locator('[data-filas]')).toHaveAttribute('data-filas', '31');
  await principal(page).click();
  await expect(veredicto(page)).toHaveAttribute('data-veredicto', 'bien');

  expect(errores).toEqual([]);
  await ctx.close();
});

for (const tema of ['oscuro', 'sepia'])
test(`360 px en ${tema}: sin desplazamiento horizontal, objetivos de 44 px y axe en las tarjetas 1.2`, async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 760 }, deviceScaleFactor: 2, hasTouch: true });
  await servir(ctx);
  const page = await ctx.newPage();
  await preparar(page, tema);
  for (const id of ['simule-carga', 'averia-divisor', 'ajuste-33', 'banco-divisor', 'dibuje-salida', 'sql-cuenta', 'sql-maxima', 'sql-orden']) {
    await irA(page, id);
    if (id === 'sql-cuenta') {
      await page.locator('[data-ejecutar]').click();
      await expect(page.locator('[data-salida-sql] [data-filas], [data-error-sql]').first()).toBeVisible({ timeout: 30_000 });
    }
    const anchos = await page.evaluate(() => [...document.querySelectorAll('[data-tarjeta] *')].filter((x) => x.getBoundingClientRect().right > 361 && ![...x.children].some((c) => c.getBoundingClientRect().right > 361)).map((x) => `${x.tagName}.${(x as HTMLElement).className} ${Math.round(x.getBoundingClientRect().right)}`).slice(0, 8));
    expect(anchos, id).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), id).toBeLessThanOrEqual(360);
    const pequenos = await page.locator('[data-tarjeta] :is(.a12 button, .a12 input, .a12 select, .a12 summary, .escalera button)').evaluateAll((xs) =>
      xs.filter((x) => (x as HTMLElement).offsetParent && (x.getBoundingClientRect().height < 44 || x.getBoundingClientRect().width < 44)).map((x) => `${x.tagName} ${x.textContent?.trim().slice(0, 20)}`),
    );
    expect(pequenos, id).toEqual([]);
    await axe(page, `${id} ${tema}`);
  }
  await ctx.close();
});
