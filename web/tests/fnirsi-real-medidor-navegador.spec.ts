// 1.4 «instrumentos14»: the real FNIRSI 2C53T as a meter and next to the simulated FNIRSI, in the browser, with the
// fake link (window.__epaFnirsiFalso) handing out multimeter frames built from a real capture (fnirsi-real-datos.ts:
// the 9 V battery's frame with other digits) and real oscilloscope records:
//   - practice 1: «Usar su FNIRSI» notes a reliable reading in a multimeter check like the real Brymen's, the
//     difference said without claiming the instrument's accuracy; an unchecked function (diode) is not noted;
//   - guided lab 1, a Brymen step: the FNIRSI's panel under «Comprobar» and its reading compared with the step's;
//     lab 2, a FNIRSI step: the panel with the simulated FNIRSI said as the fallback;
//   - the lessons' «En el banco» card: «Medir con el FNIRSI» fills and compares; in oscilloscope mode it says so;
//   - the free bench: the oscilloscope's trace compared with the simulated FNIRSI's channel;
//   - the panel on phone, tablet and desktop, dark and sepia: no horizontal scroll, the keyboard connects it, axe.
//   EPA_DIST=… EPA_PUERTO=… npx playwright test -c playwright.fnirsi-real.config.ts tests/fnirsi-real-medidor-navegador.spec.ts
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import type { Leccion11 } from '../src/lib/leccion11/tipos.ts';
import { sqlNode } from '../src/lib/leccion12/sql/node.ts';
import { axe, limpio, sinHallazgos, type Tema } from './accesibilidad10-comun';
import { MULTIMETRO, REGISTRO_CH1 } from './fnirsi-real-datos.ts';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';

const deHex = (h: string) => h.match(/../g)!.map((x) => parseInt(x, 16));

// the display's segments (multimetro.ts): a 0x80, f 0x40, e 0x20, b 0x08, g 0x04, c 0x02, d 0x01; 0x10 the point
const SEG: Record<string, number> = { a: 0x80, b: 0x08, c: 0x02, d: 0x01, e: 0x20, f: 0x40, g: 0x04 };
const GLIFO: Record<string, string> = { '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg' };

/**
 * The real 9 V battery frame (V DC, firmware unit «V») with the display showing `texto` (four digits and a point,
 * «3.951»); `codigo` replaces the firmware's unit code (1 is «V»; one the app does not know makes the reading
 * not «fiable»).
 */
function voltios(texto: string, codigo?: number): number[] {
  const r = deHex(MULTIMETRO.pila9V!);
  const digitos = texto.replace('.', '');
  const punto = texto.indexOf('.');
  const m = [...digitos].map((ch, i) => [...GLIFO[ch]!].reduce((s, x) => s | SEG[x]!, 0) | (i > 0 && i === punto ? 0x10 : 0));
  const t = 8;
  r[t + 2] = (m[0]! & 0xf0) | (r[t + 2]! & 0x0f & ~0x08);
  r[t + 3] = (m[1]! & 0xf0) | (m[0]! & 0x0f);
  r[t + 4] = (m[2]! & 0xf0) | (m[1]! & 0x0f);
  r[t + 5] = (m[3]! & 0xf0) | (m[2]! & 0x0f);
  r[t + 6] = (r[t + 6]! & 0xf0) | (m[3]! & 0x0f);
  if (codigo !== undefined) r[24 + 16] = codigo;
  return r;
}

/** A record (56 settings bytes + 1024 samples, base64) as the link sends it: a header event and its data events. */
function informesDe(registro: string, canal: number, secuencia: number): number[][] {
  const b = Array.from(Buffer.from(registro, 'base64'));
  const v: number[][] = [];
  const informe = (cab: number[], datos: number[]) => {
    const r = new Array<number>(64).fill(0);
    cab.forEach((x, k) => (r[k] = x));
    datos.forEach((x, k) => (r[8 + k] = x));
    return r;
  };
  v.push(informe([0xa0, secuencia, canal, 56, 0, 0, 0, 0], b.slice(0, 56)));
  for (let d = 0; d < 1024; d += 56) {
    const n = Math.min(56, 1024 - d);
    v.push(informe([0xa1, secuencia, canal, n, d & 0xff, d >> 8, 0, 0], b.slice(56 + d, 56 + d + n)));
  }
  return v;
}

/** The fake link, installed before the page loads (the transport is chosen once, at start). */
async function conEnlace(page: Page, modo: number, eventos: number[][]) {
  await page.addInitScript((x) => {
    (window as unknown as { __epaFnirsiFalso: unknown }).__epaFnirsiFalso = { modo: x.modo, eventos: x.eventos, repetir: true };
  }, { modo, eventos });
}
/** What the multimeter shows from now on. */
async function mostrar(page: Page, informe: number[]) {
  await page.evaluate((x) => {
    const c = (window as unknown as { __epaFnirsiFalso: { eventos: number[][] } }).__epaFnirsiFalso;
    c.eventos = [x];
  }, informe);
  // (a few frames of the new reading)
  await page.waitForTimeout(300);
}

async function practica1(page: Page) {
  await page.goto('/#/instrumentos/practica/1');
  await expect(page.locator('section.practica h2')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.banco .estado')).toContainText('simulado en', { timeout: 90_000 });
  await page.getByRole('button', { name: 'Preparar este paso en el banco' }).click();
  await page.getByRole('button', { name: 'Siguiente →' }).click();
  await expect(page.locator('tr[data-id="vout"] .medida .valor')).toContainText('2,8', { timeout: 60_000 });
}

test.describe('escritorio', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'escritorio'));

  test('práctica 1: «Usar su FNIRSI» anota una lectura fiable como la del Brymen real, y no una sin comprobar', async ({ page }) => {
    await limpio(page);
    await conEnlace(page, 1, [voltios('2.875')]);
    await practica1(page);
    const panel = page.locator('section.practica [data-fnirsi-real]');
    await expect(panel).toHaveClass(/compacto/);
    await expect(page.locator('[data-estado-fnirsi]')).toContainText('la práctica usa el FNIRSI simulado');
    // nothing to use before connecting
    await expect(page.locator('[data-usar-fnirsi]')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
    await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado');
    await expect(page.locator('[data-lectura-fnirsi]')).toHaveText('2,875 V ⎓');
    // a multimeter check (on the Brymen in the book) takes it; an oscilloscope check of another practice would not
    const fila = page.locator('tr[data-id="vout"]');
    await page.locator('[data-usar-fnirsi="vout"]').click();
    await expect(fila).toHaveClass(/ok/);
    await expect(fila.locator('.medida')).toContainText('de su FNIRSI');
    const texto = page.locator('[data-comparacion-real="vout"]');
    await expect(texto).toContainText('Su circuito da 2,875 V en el FNIRSI; el simulado,');
    await expect(texto).toContainText('Dentro de lo que admite la práctica');
    await expect(texto).not.toContainText('Brymen');
    // 4 % low: outside, and more than the instrument itself may be off by on that range (1.4.2)
    await mostrar(page, voltios('2.765'));
    await expect(page.locator('[data-lectura-fnirsi]')).toHaveText('2,765 V ⎓');
    await page.locator('[data-usar-fnirsi="vout"]').click();
    await expect(fila).toHaveClass(/mal/);
    await expect(texto).toContainText('Es mayor que lo que el FNIRSI puede equivocarse en la escala de 20 V');
    await expect(texto).toContainText('Fuera de lo que admite la práctica');
    // a reading the decoder does not back (a firmware unit it does not know): warned on the panel, and not noted
    await mostrar(page, voltios('0.612', 0x7f));
    await expect(page.locator('[data-aviso-fnirsi]')).toContainText('todavía no conoce');
    await page.locator('[data-usar-fnirsi="vin"]').click();
    await expect(page.locator('[data-comparacion-real="vin"]')).toContainText('no se usa para comprobar');
    await expect(page.locator('tr[data-id="vin"] .medida')).not.toContainText('de su FNIRSI');
    sinHallazgos(await axe(page, 'section.practica [data-fnirsi-real]'), 'panel del FNIRSI real en la práctica');
  });

  test('laboratorio 1, paso del Brymen: el panel del FNIRSI bajo «Comprobar» y su lectura frente a la del paso', async ({ page }) => {
    await limpio(page);
    await conEnlace(page, 1, [voltios('9.201')]);
    await page.goto('/#/instrumentos/laboratorio/1');
    await expect(page.locator('section.lab h2')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-paso]')).toHaveAttribute('data-paso', 'alimentacion');
    const panel = page.locator('section.lab [data-fnirsi-real]');
    await expect(panel).toBeVisible();
    await expect(page.locator('section.lab [data-estado-fnirsi]')).toContainText('también puede medir este paso con el multímetro de su FNIRSI');
    // under the step's own «Comprobar»
    const comprobar = (await page.locator('[data-comprobar]').boundingBox())!;
    expect((await panel.boundingBox())!.y).toBeGreaterThan(comprobar.y);
    // the simulated Brymen set up by «Hágalo por mí»: the step's reading is the supply's 9 V
    await page.locator('[data-hagalo]').click();
    await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
    await expect(page.locator('[data-lectura-fnirsi]')).toHaveText('9,201 V ⎓');
    const nota = page.locator('[data-comparacion-fnirsi-lab]');
    await expect(nota).toContainText('Su circuito da 9,201 V en el FNIRSI; el simulado,', { timeout: 20_000 });
    await expect(nota).toContainText('El paso se comprueba con el Brymen simulado.');
    sinHallazgos(await axe(page, 'section.lab [data-fnirsi-real]'), 'panel del FNIRSI real en el laboratorio');
  });

  test('laboratorio 2, paso del FNIRSI: el panel dice que el paso usa el FNIRSI simulado', async ({ page }) => {
    await limpio(page);
    await conEnlace(page, 2, informesDe(REGISTRO_CH1, 0, 1));
    await page.goto('/#/instrumentos/laboratorio/2');
    await expect(page.locator('section.lab h2')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('section.lab [data-estado-fnirsi]')).toContainText('el paso usa el FNIRSI simulado');
    await page.locator('section.lab [data-fnirsi-real]').getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
    await expect(page.locator('section.lab [data-trazas-fnirsi]')).toHaveAttribute('data-trazas-fnirsi', '1');
  });

  test('banco libre: la traza del FNIRSI real frente al canal del FNIRSI simulado', async ({ page }) => {
    await limpio(page);
    await conEnlace(page, 2, informesDe(REGISTRO_CH1, 0, 1));
    await page.goto('/#/instrumentos/circuito/cap05/sec-5.3_led_150ohm');
    // (2.1: the real instruments' panel opens from «Usar un aparato real»)
    await page.locator('[data-usar-aparato-real]').click();
    const panel = page.locator('.elegir [data-fnirsi-real]');
    await expect(panel).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-estado-fnirsi]')).toContainText('el banco usa el FNIRSI simulado');
    await expect(page.locator('.banco .estado')).toContainText('simulado en', { timeout: 90_000 });
    await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
    const c1 = page.locator('[data-comparacion-traza="1"]');
    await expect(c1).toContainText(/^CH1: Vpp de 3,\d\d\sV en el FNIRSI; el simulado, /, { timeout: 20_000 });
  });

  for (const [circuito, conSenal] of [
    ['cap22/fig-22.14_555_astable', true],
    ['cap05/sec-5.3_led_150ohm', false],
  ] as const) {
    test(`1.4.3: la comparación de la traza se reescribe como mucho una vez por segundo (${circuito})`, async ({ page }) => {
      await limpio(page);
      await conEnlace(page, 2, informesDe(REGISTRO_CH1, 0, 1));
      await page.goto(`/#/instrumentos/circuito/${circuito}`);
      // (2.1: the real instruments' panel opens from «Usar un aparato real»)
      await page.locator('[data-usar-aparato-real]').click();
      const panel = page.locator('.elegir [data-fnirsi-real]');
      await expect(panel).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('.banco .estado')).toContainText('simulado en', { timeout: 90_000 });
      await panel.getByRole('button', { name: 'Conectar el FNIRSI real' }).click();
      const c1 = page.locator('[data-comparacion-traza="1"]');
      await expect(c1).toContainText(/^CH1: Vpp de 3,\d\d\sV en el FNIRSI; el simulado, /, { timeout: 20_000 });
      // count every rewrite of the line (before 1.4.3 it followed every sweep of the simulated oscilloscope)
      await page.evaluate(() => {
        const w = window as unknown as { __cambios: number };
        w.__cambios = 0;
        new MutationObserver((ms) => {
          for (const m of ms) if ((m.target instanceof Element ? m.target : m.target.parentElement)?.closest('[data-comparacion-traza]')) w.__cambios++;
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
      });
      await page.waitForTimeout(4000);
      expect(await page.evaluate(() => (window as unknown as { __cambios: number }).__cambios)).toBeLessThanOrEqual(5);
      // the 555 has a frequency to compare; the LED circuit has no signal on CH1, only a sample or two of the
      // simulated converter's noise, whose «frequency» is not compared
      if (conSenal) await expect(c1).toContainText('Frecuencia de 1,000 kHz en el FNIRSI; el simulado, ');
      else await expect(c1).not.toContainText('Frecuencia');
    });
  }
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
  test(`tarjeta «En el banco»: «Medir con el FNIRSI» rellena y compara (${proyecto})`, async ({ page }, info) => {
    test.skip(info.project.name !== proyecto, proyecto);
    await limpio(page);
    await conEnlace(page, 1, [voltios('3.951')]);
    await tarjetaBanco(page);
    // connects by itself and takes the first reading
    await page.locator('[data-medir-fnirsi]').click();
    await expect(page.locator('[data-medida-banco]')).toHaveValue('3,951 V');
    await expect(page.locator('[data-comparacion]')).toHaveAttribute('data-comparacion', 'bien');
    await expect(page.locator('[data-estado-real-banco]')).toContainText('Leído en su FNIRSI: 3,951 V ⎓');
    // off by 12 %: outside, with the card's own advice
    await mostrar(page, voltios('4.480'));
    await page.locator('[data-medir-fnirsi]').click();
    await expect(page.locator('[data-medida-banco]')).toHaveValue('4,480 V');
    await expect(page.locator('[data-comparacion]')).toHaveAttribute('data-comparacion', 'mal');
    // a reading the decoder does not back: said, nothing filled
    await mostrar(page, voltios('0.612', 0x7f));
    await page.locator('[data-medir-fnirsi]').click();
    await expect(page.locator('[data-estado-real-banco]')).toContainText('no se usa para comprobar');
    await expect(page.locator('[data-medida-banco]')).toHaveValue('4,480 V');
    sinHallazgos(await axe(page, '[data-banco]'), 'tarjeta en el banco con el FNIRSI real');
    if (proyecto === 'movil') {
      const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(ancho).toBeLessThanOrEqual(0);
      expect((await page.locator('[data-medir-fnirsi]').boundingBox())!.height).toBeGreaterThanOrEqual(48);
    }
  });
}

test('tarjeta «En el banco» con el FNIRSI en el osciloscopio: lo dice y no rellena nada', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'escritorio');
  await limpio(page);
  await conEnlace(page, 2, informesDe(REGISTRO_CH1, 0, 1));
  await tarjetaBanco(page);
  await page.locator('[data-medir-fnirsi]').click();
  await expect(page.locator('[data-estado-real-banco]')).toContainText('póngalo en multímetro');
  await expect(page.locator('[data-medida-banco]')).toHaveValue('');
});

// ------------------------------------------------------------------ the panel at every size, dark and sepia

const TAMANOS = [
  { nombre: 'teléfono', ancho: 412, alto: 915 },
  { nombre: 'tableta', ancho: 1280, alto: 800 },
  { nombre: 'escritorio', ancho: 1366, alto: 900 },
];
for (const tema of ['oscuro', 'sepia'] as Tema[]) {
  test(`el panel en teléfono, tableta y escritorio (${tema}): cabe, se conecta con el teclado y lo lee un lector de pantalla`, async ({ browser }, info) => {
    test.skip(info.project.name !== 'escritorio', 'escritorio');
    for (const t of TAMANOS) {
      const ctx = await browser.newContext({ viewport: { width: t.ancho, height: t.alto }, hasTouch: t.ancho < 800, isMobile: t.ancho < 800 });
      const page = await ctx.newPage();
      await limpio(page, tema);
      await conEnlace(page, 2, informesDe(REGISTRO_CH1, 0, 1));
      await page.goto('/#/instrumentos/circuito/cap05/sec-5.3_led_150ohm');
      // (2.1: the real instruments' panel opens from «Usar un aparato real»)
      await page.locator('[data-usar-aparato-real]').click();
      const panel = page.locator('.elegir [data-fnirsi-real]');
      await expect(panel).toBeAttached({ timeout: 60_000 });
      // a named region and a named button, reached and pressed with the keyboard
      await expect(page.getByRole('region', { name: 'FNIRSI real' })).toBeAttached();
      const boton = panel.getByRole('button', { name: 'Conectar el FNIRSI real' });
      await boton.focus();
      await page.keyboard.press('Enter');
      await expect(panel).toHaveAttribute('data-conexion-fnirsi', 'conectado');
      await expect(page.getByRole('img', { name: 'Trazas del osciloscopio del FNIRSI' })).toBeVisible();
      await expect(panel.getByRole('button', { name: 'Desconectar' })).toBeVisible();
      await expect(page.locator('[data-estado-fnirsi]')).toHaveAttribute('role', 'status');
      const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(ancho, `${t.nombre}: sin desplazamiento horizontal`).toBeLessThanOrEqual(0);
      const caja = (await panel.boundingBox())!;
      expect(caja.x + caja.width, `${t.nombre}: el panel cabe`).toBeLessThanOrEqual(t.ancho + 0.5);
      sinHallazgos(await axe(page, '.elegir [data-fnirsi-real]'), `panel del FNIRSI real, ${t.nombre}, ${tema}`);
      await ctx.close();
    }
  });
}
