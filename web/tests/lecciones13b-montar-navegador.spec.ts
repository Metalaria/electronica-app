// 1.3 (motor13b) «Monte este circuito en la protoboard» (GUIA §13.14) in the browser, on the owner's phone (Pixel 8 Pro:
// 412×915, DPR 3.5, touch; real touches through CDP Input.dispatchTouchEvent): the catalogue lesson
// tests/lecciones12-catalogo/cap02/sec-2.7.yaml generated here and served in place of the published one.
//   - guided divider: the holes of each step lit, each part dragged from the tray with the finger lands where the
//     guide wants it (tactil13's precise placement inside the lesson), the wires laid tap by tap; the board is
//     simulated and «Comprobar» says it is right with what the multimeter reads;
//   - free LED: the LED flipped with «Voltear», «Comprobar» says it is the wrong way round; «Volver a intentarlo»
//     keeps the board; flipped back, right;
//   - the ladder's solution loads the automatic placement; the keyboard puts a part from the tray and the list of what
//     the board joins says it with the instrument's names; no horizontal scroll.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config> tests/lecciones13b-montar-navegador.spec.ts
import { test, expect, type CDPSession, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import type { Leccion11 } from '../src/lib/leccion11/tipos.ts';
import type { Montar } from '../src/lib/leccion12/montar/tipos.ts';
import { planDeMontaje } from '../src/componentes/protoboard/guia.ts';
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
const ID = 'cap02/sec-2.7';
const leccion = generarLeccion(parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', `${ID}.yaml`), 'utf8')), contexto, 'catalogo-motor13b').leccion as Leccion11;
const n = (id: string) => leccion.tarjetas.findIndex((t) => t.id === id) + 1;
const A = (id: string) => leccion.tarjetas.find((t) => t.id === id)!.actividad as Montar;

test.use({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, hasTouch: true, isMobile: true });

type P = [number, number];
type Ventana = { __epaProtoboard?: { pb: { doc: { piezas: { comp: { nombre: string }; pos: P[] }[]; cables: unknown[] }; sel: string[] }; pantalla: (x: number, y: number) => P; ajustar: () => void } };

async function abrir(page: Page, id: string): Promise<CDPSession> {
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
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 30_000 });
  await page.waitForTimeout(300);
  return page.context().newCDPSession(page);
}

/** Screen point of a hole; the whole board is brought into view first when it is outside the bench. */
async function pantalla(page: Page, q: P): Promise<P> {
  const m = (await page.locator('.mesa').boundingBox())!;
  const en = () => page.evaluate(([x, y]) => (window as unknown as Ventana).__epaProtoboard!.pantalla(x!, y!), q);
  let s = await en();
  if (s[0] < m.x + 4 || s[0] > m.x + m.width - 4 || s[1] < m.y + 4 || s[1] > m.y + m.height - 4) {
    await page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.ajustar());
    await page.waitForTimeout(150);
    s = await en();
  }
  return s;
}
const piezas = (page: Page) => page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.pb.doc.piezas.map((p) => ({ nombre: p.comp.nombre, pos: p.pos })));
const boton = (page: Page) => page.locator('[data-continuar]');
const aviso = (page: Page) => page.locator('[data-veredicto]');
const montar = (page: Page) => page.locator('[data-montar]');

async function toques(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', puntos: P[]) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: puntos.map(([x, y], i) => ({ x, y, id: i, radiusX: 4, radiusY: 4, force: 1 })) });
}
/** A finger from `de` to `a`, lifted. */
async function arrastrar(page: Page, cdp: CDPSession, de: P, a: P, pasos = 14) {
  await toques(cdp, 'touchStart', [de]);
  await page.waitForTimeout(40);
  for (let k = 1; k <= pasos; k++) {
    await toques(cdp, 'touchMove', [[de[0] + ((a[0] - de[0]) * k) / pasos, de[1] + ((a[1] - de[1]) * k) / pasos]]);
    await page.waitForTimeout(16);
  }
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(300);
}
/** A tray card dragged with the finger so that its part lands with its first leg on hole `q` (it rides 56 px above). */
async function cartaA(page: Page, cdp: CDPSession, nombre: string, legs: P[]) {
  const carta = page.locator(`.bandeja [data-carta="${nombre}"]`);
  await carta.scrollIntoViewIfNeeded();
  const c = (await carta.boundingBox())!;
  const centro: P = [(legs[0]![0] + legs[legs.length - 1]![0]) / 2, (legs[0]![1] + legs[legs.length - 1]![1]) / 2];
  const q = await pantalla(page, centro);
  await arrastrar(page, cdp, [c.x + c.width / 2, c.y + c.height / 2], [q[0], q[1] + 56]);
}
async function tocarHueco(page: Page, q: P) {
  const s = await pantalla(page, q);
  await page.touchscreen.tap(s[0], s[1]);
  await page.waitForTimeout(180);
}
const sinScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412);

/** Builds the card's schematic as its guide says: each part from the tray with the finger, each wire tap by tap. */
async function montarComoLaGuia(page: Page, cdp: CDPSession, a: Montar) {
  const plan = planDeMontaje(a.objetivo, a.objetivo.titulo);
  for (const paso of plan.pasos) {
    if (paso.tipo === 'pieza') {
      await cartaA(page, cdp, paso.pieza.comp.nombre, paso.pieza.pos);
      await expect.poll(async () => (await piezas(page)).find((p) => p.nombre === paso.pieza.comp.nombre)?.pos, { message: `${paso.pieza.comp.nombre} donde la guía` }).toEqual(paso.pieza.pos);
    } else if (paso.tipo === 'cable') {
      // (the part just put is selected, with its floating bar over the board: let it go first)
      await page.evaluate(() => ((window as unknown as Ventana).__epaProtoboard!.pb.sel = []));
      await tocarHueco(page, paso.a);
      await tocarHueco(page, paso.b);
    }
  }
}

test('guiada: con el dedo, cada pieza cae donde la guía; simulada, «Comprobar» dice que está bien y lo que marca el multímetro', async ({ page }) => {
  test.setTimeout(150_000);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const cdp = await abrir(page, 'monte-divisor');
  await expect(montar(page)).toHaveAttribute('data-montar', 'guiada');
  await expect(montar(page)).toHaveAttribute('data-diagnostico', 'vacia');
  await expect(page.locator('[data-paso-montar]')).toContainText('Coloque');
  await expect(boton(page)).toBeDisabled();
  await montarComoLaGuia(page, cdp, A('monte-divisor'));
  await expect(page.locator('[data-paso-montar]')).toHaveText('Todo puesto: pulse «Comprobar».');
  await expect(montar(page)).toHaveAttribute('data-diagnostico', 'bien', { timeout: 60_000 });
  // the list of what the board joins, with the instrument's names
  await page.locator('.a12-montar-uniones summary').click();
  await expect(page.locator('[data-uniones]')).toContainText('Salida, entre las dos resistencias');
  await expect(boton(page)).toHaveAttribute('data-accion', 'comprobar');
  await boton(page).click();
  await expect(aviso(page)).toHaveAttribute('data-veredicto', 'bien');
  await expect(aviso(page)).toContainText('el simulador da en cada uno la misma tensión que en el esquema');
  await expect(aviso(page)).toContainText(/Salida del divisor: el multímetro marca 5,00\sV\./);
  await sinScroll(page);
  expect(errores).toEqual([]);
});

test('libre: el LED al revés se dice; «Volver a intentarlo» conserva la placa; al derecho, bien', async ({ page }) => {
  test.setTimeout(150_000);
  const cdp = await abrir(page, 'monte-led');
  await expect(montar(page)).toHaveAttribute('data-montar', 'libre');
  await expect(page.locator('[data-paso-montar]')).toHaveCount(0);
  await montarComoLaGuia(page, cdp, A('monte-led'));
  await expect(montar(page)).toHaveAttribute('data-diagnostico', 'bien', { timeout: 60_000 });
  // the LED flipped with the floating bar's «Voltear»
  const d1 = A('monte-led').objetivo.piezas.find((p) => p.comp.nombre === 'D1')!;
  const centro = await pantalla(page, [(d1.pos[0]![0] + d1.pos[1]![0]) / 2, (d1.pos[0]![1] + d1.pos[1]![1]) / 2]);
  await page.touchscreen.tap(centro[0], centro[1]);
  await page.getByRole('button', { name: 'Voltear' }).click();
  await expect(montar(page)).toHaveAttribute('data-diagnostico', /problemas-/);
  await boton(page).click();
  await expect(aviso(page)).toHaveAttribute('data-veredicto', 'mal');
  await expect(aviso(page)).toContainText('El LED D1 está al revés');
  await expect(boton(page)).toHaveAttribute('data-accion', 'reintentar');
  await boton(page).click();
  // the board is kept: the LED is still there, reversed
  expect((await piezas(page)).find((p) => p.nombre === 'D1')!.pos).toEqual([...d1.pos].reverse());
  await page.touchscreen.tap(centro[0], centro[1]);
  await page.getByRole('button', { name: 'Voltear' }).click();
  await expect(montar(page)).toHaveAttribute('data-diagnostico', 'bien', { timeout: 60_000 });
  await boton(page).click();
  await expect(aviso(page)).toHaveAttribute('data-veredicto', 'bien');
  await sinScroll(page);
});

test('la solución de la escalera pone la colocación automática; el teclado pone una pieza de la bandeja', async ({ page }) => {
  test.setTimeout(120_000);
  await abrir(page, 'monte-rc');
  await expect(page.locator('[data-montar-solucion]')).toHaveCount(0);
  // the keyboard: a tray card chosen with Enter, put with Enter where the bench's cursor is
  await page.locator('.bandeja [data-carta="R1"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.mesa')).toBeFocused();
  // (the cursor starts on the hole nearest the middle of the view: down a row at a time until the part fits — a
  // vertical resistor across the central channel)
  for (let k = 0; k < 16 && !(await piezas(page)).some((p) => p.nombre === 'R1'); k++) {
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
  }
  await expect.poll(async () => (await piezas(page)).some((p) => p.nombre === 'R1')).toBe(true);
  await page.locator('.a12-montar-uniones summary').click();
  await expect(page.locator('[data-uniones]')).toContainText('R1');
  // the ladder opened to its solution: the button that puts it on the board
  await page.locator('[data-escalera] button, [data-pista]').first().click();
  for (let k = 0; k < 4 && !(await page.locator('[data-montar-solucion]').count()); k++) await page.locator('[data-escalera] button, [data-pista]').first().click().catch(() => undefined);
  await page.locator('[data-montar-solucion]').click();
  await expect(montar(page)).toHaveAttribute('data-diagnostico', 'bien', { timeout: 60_000 });
  await boton(page).click();
  await expect(aviso(page)).toHaveAttribute('data-veredicto', 'bien');
  await sinScroll(page);
});

test('avería en la placa (widget «averia-placa»): una pieza mala no completa; la buena, «¡Conseguido!» y «Continuar»', async ({ page }) => {
  test.setTimeout(120_000);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const ctx = page.context();
  await ctx.route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await ctx.route(`**/libro/lecciones11/${ID}.json`, (x) => x.fulfill({ contentType: 'application/json', body: JSON.stringify(leccion) }));
  await page.addInitScript(() => localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false })));
  await page.goto(`#/leccion/${ID}/${n('averia-snes')}`);
  await expect(page.locator('[data-widget-averia="snes-no-enciende"]')).toBeVisible();
  await expect(page.locator('[data-sospechoso="regulador"]')).toBeVisible({ timeout: 30_000 });
  await expect(boton(page)).toBeDisabled();
  // a measurement first, from the list of test points (the keyboard's way; the list stays open after each choice —
  // before 1.3 it closed on a phone): the regulator's input against ground, as the lesson's probes do
  const puntos = page.locator('details.puntos');
  if ((await puntos.getAttribute('open')) === null) await puntos.locator('summary').click();
  const lectura = page.locator('[data-lectura-averia]');
  await page.locator('[data-select-punta="roja"]').selectOption('J1.2');
  await expect(puntos).toHaveAttribute('open', '');
  await page.locator('[data-select-punta="negra"]').selectOption('J1.1');
  await expect(lectura).toContainText(/10,00\sV/);
  // (and across the fuse, off and unplugged, in Ω: open)
  await page.locator('[data-funcion="Ω"]').tap();
  await page.locator('[data-encendida="no"]').tap();
  await page.locator('[data-select-punta="roja"]').selectOption('F1.1');
  await page.locator('[data-select-punta="negra"]').selectOption('F1.2');
  await expect(lectura).toContainText('OL');
  await page.locator('[data-sospechoso="regulador"]').tap();
  await expect(page.locator('[data-widget-averia]')).toHaveAttribute('data-encontrada', 'no');
  await expect(page.locator('[data-objetivo]')).toHaveAttribute('data-objetivo', 'pendiente');
  await page.locator('[data-sospechoso="fusible"]').tap();
  await expect(page.locator('[data-widget-averia]')).toHaveAttribute('data-encontrada', 'si');
  await expect(page.locator('[data-objetivo]')).toHaveAttribute('data-objetivo', 'logrado');
  await expect(boton(page)).toBeEnabled();
  await sinScroll(page);
  expect(errores).toEqual([]);
});
