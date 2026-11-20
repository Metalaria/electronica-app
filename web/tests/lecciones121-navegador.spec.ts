// 1.2.1 (piloto121) «aprender haciendo» in the browser, on a phone (360 px, touch): the catalogue lesson
// tests/lecciones12-catalogo/cap01/sec-1.5.yaml generated here and served in place of the published one. The probes
// are put by tapping the drawing and the multimeter reads; a tap on the black probe picks it up; the ammeter opens a
// branch; the marker is dragged with a finger and moved with the keyboard; an «elegir» zone is chosen with the
// keyboard alone; the targets on the drawing are 44 px; no horizontal scroll. (The whole walk of every card, with axe
// in two themes, is tests/lecciones11-recorrido.spec.ts with EPA_RECORRER_CATALOGO=1.)
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones11.config.ts tests/lecciones121-navegador.spec.ts
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import type { Leccion11 } from '../src/lib/leccion11/tipos.ts';
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
const ID = 'cap01/sec-1.5';
const leccion = generarLeccion(parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', `${ID}.yaml`), 'utf8')), contexto, 'catalogo-piloto121').leccion as Leccion11;
const n = (id: string) => leccion.tarjetas.findIndex((t) => t.id === id) + 1;

test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

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
const sinScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

test('multímetro: las puntas se ponen tocando el dibujo, la negra se recoge tocándola, y marca la solución del esquema', async ({ page }) => {
  await abrir(page, 'mida-tension');
  const pantalla = page.locator('[data-display-instrumento]');
  await expect(pantalla).toHaveText('—');
  // the targets on the drawing: 44 px to touch
  // (cierre13: while the screen's slide-in transform settles, a fractional translation makes the box read
  // 43.999996 or 44.000008 px for a 44 px button: a float's rounding, not a smaller target)
  for (const d of await page.locator('[data-diana]').all()) {
    const b = (await d.boundingBox())!;
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44 - 1e-3);
  }
  await page.locator('[data-diana="n"]').tap();
  await expect(pantalla).toHaveText('7,20 V');
  await expect(page.locator('[data-diana="n"]')).toHaveAttribute('data-diana-estado', 'roja');
  // the black probe: picked up with a tap, put down with the next one
  await page.locator('[data-diana="0"]').tap();
  await expect(page.locator('[data-consejo-instrumento]')).toContainText('punta negra');
  await page.locator('[data-diana="f1"]').tap();
  await expect(page.locator('[data-punta-negra]')).toHaveValue('f1');
  await expect(pantalla).toHaveText('−4,80 V');
  await sinScroll(page);
  // the ammeter in a branch
  await page.locator('[data-modo="A"]').tap();
  await page.locator('[data-diana="vm3"]').tap();
  await expect(page.locator('[data-diana="vm3"]')).toHaveAttribute('data-diana-estado', 'rama');
  await expect(pantalla).toHaveText('3,60 mA');
});

test('marcar: la marca se arrastra con el dedo sobre la gráfica y se mueve con el teclado', async ({ page }) => {
  await abrir(page, 'marque-maximo');
  const donde = page.locator('[data-marca-donde]');
  const antes = await donde.textContent();
  const zona = (await page.locator('[data-zona-marca]').boundingBox())!;
  // a drag from the right towards the left third of the plot (pointer events, as a finger does)
  await page.mouse.move(zona.x + zona.width * 0.8, zona.y + zona.height / 2);
  await page.mouse.down();
  await page.mouse.move(zona.x + zona.width * 0.25, zona.y + zona.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(donde).not.toHaveText(antes ?? '');
  await expect(page.locator('[data-continuar]')).toHaveAttribute('data-accion', 'comprobar');
  await expect(page.locator('[data-continuar]')).toBeEnabled();
  const tras = await donde.textContent();
  await page.locator('[data-marcador-x]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(donde).not.toHaveText(tras ?? '');
  await sinScroll(page);
});

test('elegir en el esquema con el teclado solo: la zona mala tachada, la buena marcada en el dibujo', async ({ page }) => {
  await abrir(page, 'elija-carga');
  await page.locator('[data-boton-zona-esquema="r1"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-diana="r1"]')).toHaveAttribute('data-diana-estado', 'elegida');
  await page.locator('[data-continuar]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-veredicto]')).toContainText('Por R₁ solo pasa');
  await expect(page.locator('[data-boton-zona-esquema="r1"]')).toHaveAttribute('data-estado', 'mal');
  await page.keyboard.press('Enter');
  await page.locator('[data-boton-zona-esquema="r3"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-continuar]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-veredicto]')).toHaveAttribute('data-veredicto', 'bien');
  await expect(page.locator('[data-diana="r3"]')).toHaveAttribute('data-diana-estado', 'bien');
  await sinScroll(page);
});

test('objetivo: los chips siguen a los mandos y al alcanzarlo dice «¡Conseguido!» y abre «Continuar»', async ({ page }) => {
  await abrir(page, 'explore-objetivo');
  await expect(page.locator('[data-objetivo]')).toHaveAttribute('data-objetivo', 'pendiente');
  await expect(page.locator('[data-continuar]')).toBeDisabled();
  await expect(page.locator('[data-consejo-objetivo]')).toContainText('Sobra tensión');
  // R₁ = 2 kΩ with R₂ = 1 kΩ: a third of the battery
  await page.locator('[data-mando11="R_1"] [role="slider"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-objetivo]')).toHaveAttribute('data-objetivo', 'logrado');
  await expect(page.locator('[data-objetivo-condicion="0"]')).toHaveAttribute('data-cumple', 'si');
  await expect(page.locator('[data-veredicto]')).toContainText('¡Conseguido!');
  // moving away again does not close it
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-continuar]')).toBeEnabled();
});
