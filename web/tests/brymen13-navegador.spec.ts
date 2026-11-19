// 1.3 (brymen13): the real Brymen BM869s through its BU-86X cable, in the browser, with a fake cable
// (window.__epaBrymenFalso, transporte.ts) that answers with packets built from the documented layout. Practice 1 on
// the bench: connect, the reading appears next to the simulated one, a matching real V_out passes the practice's
// check, a mismatch is explained, a reading in the wrong function says so, and the cable unplugged mid-reading gives
// a clear message and takes the reading away. The lessons' «En el banco» card: «Medir con el Brymen» fills and
// compares. Without any transport the feature is not shown at all. Axe on the new panel; the phone at 412 px.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config> tests/brymen13-navegador.spec.ts
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import type { Leccion11 } from '../src/lib/leccion11/tipos.ts';
import { sqlNode } from '../src/lib/leccion12/sql/node.ts';
import { construirPaquete, type Simulacion } from '../src/lib/brymen-real/protocolo.ts';
import { axe, limpio, sinHallazgos } from './accesibilidad10-comun';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';

const paquete = (s: Simulacion) => Array.from(construirPaquete(s));

/** The fake cable, installed before the page loads (the transport is chosen once, at start). */
async function conCable(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __epaBrymenFalso: unknown }).__epaBrymenFalso = { respuesta: null, fija: true };
  });
}
async function responder(page: Page, p: number[] | null) {
  await page.evaluate((x) => {
    const c = (window as unknown as { __epaBrymenFalso: { respuesta: number[] | null } }).__epaBrymenFalso;
    c.respuesta = x;
  }, p);
}

async function practica1(page: Page) {
  await page.goto('/#/instrumentos/practica/1');
  await expect(page.locator('section.practica h2')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.banco .estado')).toContainText('Simulado en', { timeout: 90_000 });
  // step 1 (V⎓, red on a) and step 2 (red on out): V_out live on the simulated Brymen
  await page.getByRole('button', { name: 'Preparar este paso en el banco' }).click();
  await page.getByRole('button', { name: 'Siguiente →' }).click();
  await expect(page.locator('tr[data-id="vout"] .medida .valor')).toContainText('2,8', { timeout: 60_000 });
}

test.describe('escritorio', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'escritorio'));

  test('sin cable ni WebHID no aparece nada del Brymen real', async ({ page }) => {
    await limpio(page);
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'hid', { get: () => undefined, configurable: true }));
    await practica1(page);
    await expect(page.locator('[data-brymen-real]')).toHaveCount(0);
    await expect(page.locator('[data-usar-real]')).toHaveCount(0);
    // the practice works as before: the simulated V_out passes
    await page.locator('tr[data-id="vout"]').getByRole('button', { name: 'Anotar' }).click();
    await expect(page.locator('tr[data-id="vout"]')).toHaveClass(/ok/);
  });

  test('práctica 1 con el Brymen real: conectar, lectura, comprobación, diferencia explicada y desconexión', async ({ page }) => {
    await limpio(page);
    await conCable(page);
    await practica1(page);
    const panel = page.locator('[data-brymen-real]');
    await expect(panel).toHaveAttribute('data-conexion-real', 'desconectado');
    await expect(page.locator('[data-usar-real]')).toHaveCount(0);

    // connect: the cable opens, the meter does not answer yet
    await panel.getByRole('button', { name: 'Conectar el Brymen real' }).click();
    await expect(page.locator('[data-estado-real]')).toContainText('Esperando la primera lectura');
    // the meter answers: 2,8752 V ⎓ next to the simulated reading
    await responder(page, paquete({ principal: '2.8752', unidad: 'V', dc: true, auto: true }));
    await expect(page.locator('[data-lectura-real]')).toHaveText('2,8752 V ⎓');
    await expect(panel).toHaveAttribute('data-conexion-real', 'conectado');
    await expect(page.locator('[data-lectura-simulada]')).toContainText('V');
    await expect(page.locator('[data-crudo-real]')).toContainText('86 86 86 86');
    sinHallazgos(await axe(page, '[data-brymen-real]'), 'panel del Brymen real');

    // a matching real V_out passes the practice's own tolerance (± 0,5 %)
    const fila = page.locator('tr[data-id="vout"]');
    await page.locator('[data-usar-real="vout"]').click();
    await expect(fila).toHaveClass(/ok/);
    await expect(fila.locator('.medida')).toContainText('de su Brymen');
    const texto = page.locator('[data-comparacion-real="vout"]');
    await expect(texto).toContainText('Su circuito da 2,875 V; el simulado,');
    await expect(texto).toContainText('Dentro de lo que admite la práctica');

    // a real circuit 4 % low: outside, and the difference is not the meter's
    await responder(page, paquete({ principal: '2.7650', unidad: 'V', dc: true }));
    await expect(page.locator('[data-lectura-real]')).toHaveText('2,7650 V ⎓');
    await page.locator('[data-usar-real="vout"]').click();
    await expect(fila).toHaveClass(/mal/);
    await expect(texto).toContainText('Es mayor que lo que el Brymen puede equivocarse en esta escala');
    await expect(texto).toContainText('no del instrumento');
    await expect(texto).toContainText('Fuera de lo que admite la práctica');

    // the meter on Ω: the V check says what is wrong instead of taking it
    await responder(page, paquete({ principal: '3.1970', unidad: 'kΩ' }));
    await expect(page.locator('[data-lectura-real]')).toHaveText('3,1970 kΩ');
    await page.locator('[data-usar-real="vin"]').click();
    await expect(page.locator('[data-comparacion-real="vin"]')).toContainText('esta medida va en V');

    // the cable unplugged mid-reading: a clear message, the reading gone, nothing to use
    await page.evaluate(() => {
      (window as unknown as { __epaBrymenFalso: { desenchufado: string } }).__epaBrymenFalso.desenchufado =
        'Se ha perdido la conexión con el cable del Brymen: ¿se ha desenchufado?';
    });
    await expect(panel).toHaveAttribute('data-conexion-real', 'error');
    await expect(page.locator('[data-estado-real]')).toContainText('¿se ha desenchufado?');
    await expect(page.locator('[data-estado-real]')).toContainText('La última lectura ya no vale');
    await expect(page.locator('[data-lectura-real]')).toHaveCount(0);
    await expect(page.locator('[data-usar-real]')).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Conectar el Brymen real' })).toBeVisible();
    // what was noted from the real meter stays noted (and says so)
    await expect(fila.locator('.medida')).toContainText('de su Brymen');
  });

  test('el cable enchufado pero el Brymen apagado: lo dice', async ({ page }) => {
    await limpio(page);
    await conCable(page);
    await practica1(page);
    await page.getByRole('button', { name: 'Conectar el Brymen real' }).click();
    await expect(page.locator('[data-estado-real]')).toContainText('el Brymen no envía lecturas', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Desconectar' }).click();
    await expect(page.locator('[data-brymen-real]')).toHaveAttribute('data-conexion-real', 'desconectado');
  });
});

// ------------------------------------------------------------------ the lessons' «En el banco» card

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ID = 'cap01/sec-1.4';
let leccion: Leccion11 | null = null;
async function cargarLeccion(): Promise<Leccion11> {
  if (leccion) return leccion;
  await cargarEsquemas11();
  const contexto: ContextoLibro = {
    bloques: (p) => {
      const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
      return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
    },
    sql: await sqlNode(),
  };
  leccion = generarLeccion(parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', `${ID}.yaml`), 'utf8')), contexto, 'catalogo12').leccion as Leccion11;
  return leccion;
}
async function servir(ctx: BrowserContext, l: Leccion11) {
  await ctx.route('**/libro/lecciones11/indice.json', async (x) => {
    const real = await x.fetch().then((y) => y.json()).catch(() => ({ version: 1, total: 0, lecciones: {} }));
    const lecciones = { ...(real.lecciones ?? {}), [ID]: { tarjetas: l.tarjetas.length } };
    await x.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, total: Object.keys(lecciones).length, lecciones }) });
  });
  await ctx.route(`**/libro/lecciones11/${ID}.json`, (x) => x.fulfill({ contentType: 'application/json', body: JSON.stringify(l) }));
}
async function tarjetaBanco(page: Page) {
  const l = await cargarLeccion();
  await servir(page.context(), l);
  const k = l.tarjetas.findIndex((t) => t.id === 'banco-divisor');
  await page.goto(`/#/leccion/${ID}/${k + 1}`);
  const d = page.getByRole('alertdialog');
  if (await d.isVisible({ timeout: 300 }).catch(() => false)) await d.getByRole('button', { name: 'Salir' }).click();
  await expect(page.locator('[data-tarjeta="banco-divisor"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-esperado]')).toHaveText('4,00 V ± 5 %');
}

for (const proyecto of ['escritorio', 'movil'] as const) {
  test(`tarjeta «En el banco»: «Medir con el Brymen» rellena y compara (${proyecto})`, async ({ page }, info) => {
    test.skip(info.project.name !== proyecto, proyecto);
    await limpio(page);
    await conCable(page);
    await tarjetaBanco(page);
    await responder(page, paquete({ principal: '3.9512', unidad: 'V', dc: true }));
    await page.locator('[data-medir-real]').click();
    await expect(page.locator('[data-medida-banco]')).toHaveValue('3,9512 V');
    await expect(page.locator('[data-comparacion]')).toHaveAttribute('data-comparacion', 'bien');
    await expect(page.locator('[data-estado-real-banco]')).toContainText('Leído en su Brymen: 3,9512 V ⎓');
    // off by 12 %: outside, with the card's own advice
    await responder(page, paquete({ principal: '4.4800', unidad: 'V', dc: true }));
    await page.waitForTimeout(800);
    await page.locator('[data-medir-real]').click();
    await expect(page.locator('[data-medida-banco]')).toHaveValue('4,4800 V');
    await expect(page.locator('[data-comparacion]')).toHaveAttribute('data-comparacion', 'mal');
    await expect(page.locator('[data-consejo]')).toBeVisible();
    // the meter in Ω: said, nothing filled
    await responder(page, paquete({ principal: '4.7000', unidad: 'kΩ' }));
    await page.waitForTimeout(800);
    await page.locator('[data-medir-real]').click();
    await expect(page.locator('[data-estado-real-banco]')).toContainText('esta medida va en V');
    await expect(page.locator('[data-medida-banco]')).toHaveValue('4,4800 V');
    sinHallazgos(await axe(page, '[data-banco]'), 'tarjeta en el banco con el Brymen real');
    if (proyecto === 'movil') {
      const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(ancho).toBeLessThanOrEqual(0);
      const caja = (await page.locator('[data-medir-real]').boundingBox())!;
      expect(caja.height).toBeGreaterThanOrEqual(44);
    }
  });
}
