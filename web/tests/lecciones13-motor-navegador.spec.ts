// 1.3 (motor13) «explorar sin modelo» in the browser, on the owner's phone (Pixel 8 Pro: 412×915, DPR 3.5, touch): the
// catalogue lesson tests/lecciones12-catalogo/cap16/sec-16.16.yaml generated here and served in place of the published
// one. A goal of zones on a book figure: the chips light as the zones are tapped on the picture; in order, a zone out
// of order does not light and the advice names the next; reached, «¡Conseguido!» and «Continuar» open. The same goal
// with the keyboard alone (the list of zones). No horizontal scroll. And «repaso haciendo» (GUIA §13.13): a practice
// session asks a card as one of its variants (catalogue lesson cap01/sec-1.10), the lesson's remembered answer is
// wrong and the variant's right, recorded under the card's own id.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones12.config.ts tests/lecciones13-motor-navegador.spec.ts
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import type { Leccion11 } from '../src/lib/leccion11/tipos.ts';
import { compilarModelo, valoresDeTarjeta } from '../src/lib/leccion11/modelo.ts';
import { valoresSueltos } from '../src/lib/leccion11/motor.ts';
import { textoPlano } from '../src/lib/leccion11/texto.ts';
import { conVariante, elegirVariante } from '../src/lib/leccion12/variantes.ts';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';

await cargarEsquemas11();
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contexto: ContextoLibro = {
  bloques: (p) => {
    const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
  },
};
const ID = 'cap16/sec-16.16';
const leccion = generarLeccion(parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', `${ID}.yaml`), 'utf8')), contexto, 'catalogo-motor13').leccion as Leccion11;
const n = (id: string) => leccion.tarjetas.findIndex((t) => t.id === id) + 1;

test.use({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, hasTouch: true, isMobile: true });

async function abrir(page: Page, id: string) {
  const ctx = page.context();
  await ctx.route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await ctx.route('**/libro/lecciones11/indice.json', async (x) => {
    const real = await x.fetch().then((y) => y.json()).catch(() => ({ version: 1, total: 0, lecciones: {} }));
    const lecciones = { ...(real.lecciones ?? {}), [ID]: { tarjetas: leccion.tarjetas.length } };
    await x.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, total: Object.keys(lecciones).length, lecciones }) });
  });
  await ctx.route(`**/libro/lecciones11/${ID}.json`, (x) => x.fulfill({ contentType: 'application/json', body: JSON.stringify(leccion) }));
  await page.addInitScript(() => {
    localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
  });
  await page.goto(`#/leccion/${ID}/${n(id)}`);
  await expect(page.locator(`[data-tarjeta="${id}"]`)).toBeVisible();
}
const sinScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412);
const continuar = (page: Page) => page.locator('[data-continuar]');

/** A tap with the finger on the middle of a zone, on the picture. */
async function tocarDibujo(page: Page, id: string) {
  const r = page.locator(`[data-zona="${id}"] rect:not(.halo)`).first();
  await r.scrollIntoViewIfNeeded();
  const b = (await r.boundingBox())!;
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}
const chip = (page: Page, k: number) => page.locator(`[data-objetivo-condicion="${k}"]`);

test('en orden, con el dedo: fuera de orden no cuenta y el consejo dice la siguiente; en orden, «¡Conseguido!»', async ({ page }) => {
  await abrir(page, 'explore-orden');
  await expect(page.locator('[data-objetivo]')).toHaveAttribute('data-objetivo', 'pendiente');
  await expect(continuar(page)).toBeDisabled();
  await tocarDibujo(page, 'diferir');
  await expect(page.locator('[data-zona="diferir"]')).toHaveAttribute('data-estado', 'vista');
  await expect(chip(page, 1)).toHaveAttribute('data-cumple', 'no');
  await expect(page.locator('[data-consejo-objetivo]')).toHaveText('Van en orden. La siguiente: Arriba a la izquierda.');
  await tocarDibujo(page, 'coincidir');
  await expect(chip(page, 0)).toHaveAttribute('data-cumple', 'si');
  await expect(chip(page, 1)).toHaveAttribute('data-cumple', 'no');
  await tocarDibujo(page, 'diferir');
  await expect(chip(page, 1)).toHaveAttribute('data-cumple', 'si');
  await expect(continuar(page)).toBeDisabled();
  await tocarDibujo(page, 'trampas');
  await expect(page.locator('[data-objetivo]')).toHaveAttribute('data-objetivo', 'logrado');
  await expect(page.locator('[data-veredicto]')).toHaveAttribute('data-veredicto', 'bien');
  await expect(continuar(page)).toBeEnabled();
  await sinScroll(page);
});

test('sin orden, solo con el teclado: la lista de zonas; los chips dicen al lector de pantalla qué falta', async ({ page }) => {
  await abrir(page, 'explore-equivalente');
  await expect(chip(page, 2)).toContainText('Todavía no:');
  for (const id of ['trampas', 'coincidir']) {
    await page.locator(`[data-boton-zona="${id}"]`).focus();
    await page.keyboard.press('Enter');
  }
  await expect(chip(page, 2)).toContainText('Cumple:');
  await expect(page.locator('[data-consejo-objetivo]')).toHaveText('Toque los recuadros que faltan.');
  await expect(continuar(page)).toBeDisabled();
  await page.locator('[data-boton-zona="diferir"]').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('[data-objetivo]')).toHaveAttribute('data-objetivo', 'logrado');
  await expect(continuar(page)).toBeEnabled();
  await sinScroll(page);
});

// ------------------------------------------------------------------ B: review by doing

// the catalogue lesson cap01/sec-1.10 (declared variants), served in place of the published one; its practicable
// cards narrowed to «prediga-bornes» so the session is predictable
const IDB = 'cap01/sec-1.10';
const leccionB = generarLeccion(parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', `${IDB}.yaml`), 'utf8')), contexto, 'catalogo-motor13').leccion as Leccion11;
const SEMILLA = 4242;

test('repaso: la sesión pregunta una variante de la tarjeta (otros valores, textos de nuevo) y la corrige con sus valores', async ({ page }) => {
  test.setTimeout(120_000);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const ctx = page.context();
  await ctx.route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await ctx.route('**/libro/lecciones11/indice.json', async (x) => {
    const real = await x.fetch().then((y) => y.json());
    real.lecciones[IDB] = { tarjetas: leccionB.tarjetas.length, preguntas: [{ id: 'prediga-bornes', tipo: 'simular' }] };
    await x.fulfill({ contentType: 'application/json', body: JSON.stringify(real) });
  });
  await ctx.route(`**/libro/lecciones11/${IDB}.json`, (x) => x.fulfill({ contentType: 'application/json', body: JSON.stringify(leccionB) }));
  await page.addInitScript((s) => {
    (window as unknown as { __epaSemillaPractica: number }).__epaSemillaPractica = s;
    if (sessionStorage.getItem('preparado')) return;
    sessionStorage.setItem('preparado', '1');
    localStorage.clear();
    localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
  }, SEMILLA);
  const t = leccionB.tarjetas.find((x) => x.id === 'prediga-bornes')!;
  const k = elegirVariante(t, SEMILLA)!;
  const tv = conVariante(t, k);
  const mc = compilarModelo(leccionB.modelo);
  const j = leccionB.tarjetas.indexOf(t);
  const bueno = mc.evaluar(valoresDeTarjeta(tv, valoresSueltos(leccionB, j))).V_to!;

  await page.goto(`#/practicar/${IDB}`);
  await page.locator('[data-empezar-sesion]').click();
  for (let n = 0; n < 15 && (await page.locator('[data-item]').getAttribute('data-item-tipo')) !== 'leccion11'; n++) await page.locator('[data-saltar]').click();
  const tarjeta = page.locator('[data-leccion11-suelta]');
  await expect(tarjeta).toHaveAttribute('data-tarjeta', 'prediga-bornes');
  await expect(tarjeta).toHaveAttribute('data-variante', String(k));
  await expect(tarjeta.locator('[data-rotulo-variante]')).toHaveText('Con otros valores');
  await expect(tarjeta).toContainText(textoPlano(tv.texto));
  // the lesson's own answer, remembered, is wrong now; the variant's is right
  await tarjeta.locator('[data-estimacion]').fill('8,1 V');
  await tarjeta.locator('[data-comprobar-l11]').click();
  await expect(tarjeta.locator('[data-veredicto="mal"]')).toBeVisible();
  // (another reader's session, the same seed: the same variant)
  await page.evaluate(() => (localStorage.clear(), sessionStorage.clear()));
  await page.reload();
  await page.locator('[data-empezar-sesion]').click();
  for (let n = 0; n < 15 && (await page.locator('[data-item]').getAttribute('data-item-tipo')) !== 'leccion11'; n++) await page.locator('[data-saltar]').click();
  await expect(tarjeta).toHaveAttribute('data-variante', String(k));
  await tarjeta.locator('[data-estimacion]').fill(`${String(Number(bueno.toPrecision(4))).replace('.', ',')} V`);
  await tarjeta.locator('[data-comprobar-l11]').click();
  await expect(tarjeta.locator('[data-veredicto="bien"]')).toBeVisible();
  // recorded under the card's own answer id (mastery), nothing about the variant
  await expect.poll(async () => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('epa:dominio') ?? '{"items":{}}').items)), { timeout: 15_000 }).toContain('cap01-l11-sec-1.10-prediga-bornes');
  expect(await page.evaluate(() => JSON.stringify(localStorage).includes('variante'))).toBe(false);
  await sinScroll(page);
  expect(errores).toEqual([]);
});
