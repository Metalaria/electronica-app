// Schematic editor (#/editor, componentes/editor/): draw with the mouse and with touch, wire, simulate .op and
// .tran against hand calculations, undo/redo, pinch zoom that never zooms the page, save and reload, a book
// netlist opened as a drawing gives the same results as its text, .cir export/import round trip, and the
// screenshots of tests/capturas/editor/ (Mac 1280×800 DPR 2, tablet portrait, phone; light and dark).
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.editor.config.ts tests/editor.spec.ts
import fs from 'node:fs';
import { expect, test, type Browser, type CDPSession, type Page } from '@playwright/test';

type P = [number, number];

/** Screen point of a world point of the drawing. */
async function W(page: Page, x: number, y: number): Promise<P> {
  return page.evaluate(([a, b]) => (window as unknown as { __epaEditor: { pantalla: (x: number, y: number) => P } }).__epaEditor.pantalla(a, b), [x, y] as P);
}

async function abrirEditor(page: Page, hash = '#/editor') {
  await page.goto(`/${hash}`);
  await expect(page.locator('.lienzo')).toBeVisible();
  await page.waitForFunction(() => !!(window as unknown as { __epaEditor?: unknown }).__epaEditor);
}

async function componentes(page: Page): Promise<{ tipo: string; nombre: string; x: number; y: number; o: number }[]> {
  return page.evaluate(() =>
    (window as unknown as { __epaEditor: { ed: { doc: { componentes: { tipo: string; nombre: string; x: number; y: number; o: number }[] } } } }).__epaEditor.ed.doc.componentes.map(
      (c) => ({ tipo: c.tipo, nombre: c.nombre, x: c.x, y: c.y, o: c.o }),
    ),
  );
}

async function netlist(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __epaEditor: { ed: { nl: { texto: string } } } }).__epaEditor.ed.nl.texto);
}

/** Clicks a part on its body. */
async function seleccionar(page: Page, nombre: string) {
  const p = await page.evaluate((n) => (window as unknown as { __epaEditor: { centroDe: (n: string) => P | null } }).__epaEditor.centroDe(n), nombre);
  await page.mouse.click(p![0], p![1]);
}

async function campo(page: Page, nombre: string, valor: string) {
  const c = page.locator(`.propiedades [name="${nombre}"]`);
  await c.fill(valor);
  await c.press('Enter');
}

// ------------------------------------------------------------------ mouse

async function ponerRaton(page: Page, tipo: string, x: number, y: number) {
  await page.locator(`.paleta [data-tipo="${tipo}"]`).click();
  const [a, b] = await W(page, x, y);
  await page.mouse.click(a, b);
}

async function cableRaton(page: Page, x0: number, y0: number, x1: number, y1: number) {
  const [a, b] = await W(page, x0, y0);
  const [c, d] = await W(page, x1, y1);
  await page.mouse.move(a, b);
  await page.mouse.down();
  await page.mouse.move((a + c) / 2, (b + d) / 2, { steps: 4 });
  await page.mouse.move(c, d, { steps: 4 });
  await page.mouse.up();
}

/** V1 (6 V) → R1 (1 k) → out → R2 (2 k) → ground, all with the mouse. */
async function divisorConRaton(page: Page) {
  await ponerRaton(page, 'V', 2, 4);
  await campo(page, 'dc', '6');
  await ponerRaton(page, 'R', 5, 3);
  await ponerRaton(page, 'R', 8, 4);
  await page.keyboard.press('r');
  await campo(page, 'valor', '2k');
  await ponerRaton(page, 'GND', 2, 7.4);
  await ponerRaton(page, 'GND', 8, 7.4);
  await ponerRaton(page, 'ETQ', 7, 1);
  await campo(page, 'red', 'out');
  await cableRaton(page, 2, 3, 4, 3);
  await cableRaton(page, 6, 3, 8, 3);
  await cableRaton(page, 8, 5, 8, 7);
  await cableRaton(page, 2, 5, 2, 7);
  await cableRaton(page, 7, 1, 7, 3);
}

// ------------------------------------------------------------------ touch (CDP)

async function toques(cdp: CDPSession, tipo: 'touchStart' | 'touchMove' | 'touchEnd', puntos: P[]) {
  await cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: puntos.map(([x, y], id) => ({ x, y, id })) });
}

async function arrastreTactil(page: Page, cdp: CDPSession, de: P, a: P) {
  await toques(cdp, 'touchStart', [de]);
  for (let k = 1; k <= 8; k++) await toques(cdp, 'touchMove', [[de[0] + ((a[0] - de[0]) * k) / 8, de[1] + ((a[1] - de[1]) * k) / 8]]);
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(50);
}

/** Brings the canvas on screen (a phone scrolls to the properties below it). */
async function verLienzo(page: Page) {
  // Its top just under the app bar, whatever was scrolled to before.
  await page.evaluate(() => window.scrollBy(0, document.querySelector('.lienzo')!.getBoundingClientRect().top - 120));
  await page.waitForTimeout(80);
}

async function tocar(page: Page, p: P) {
  await page.touchscreen.tap(p[0], p[1]);
  await page.waitForTimeout(60);
}

async function ponerTactil(page: Page, tipo: string, x: number, y: number) {
  await page.locator(`.paleta [data-tipo="${tipo}"]`).tap();
  await verLienzo(page);
  await tocar(page, await W(page, x, y));
}

async function contextoTactil(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp };
}

// ------------------------------------------------------------------ results

interface VectorSim {
  nombre: string;
  re: number[];
}
async function vectores(page: Page, analisis: RegExp): Promise<VectorSim[]> {
  await page.waitForFunction(() => !!(window as unknown as { __epaEditorSim?: unknown }).__epaEditorSim);
  return page.evaluate((fuente) => {
    const r = (window as unknown as { __epaEditorSim: { ejecucion: { graficas: { analisis: string; vectores: { nombre: string; re: Float64Array }[] }[] } } }).__epaEditorSim;
    const re = new RegExp(fuente, 'i');
    const g = r.ejecucion.graficas.find((x) => re.test(x.analisis));
    return g ? g.vectores.map((v) => ({ nombre: v.nombre, re: Array.from(v.re) })) : [];
  }, analisis.source);
}

function interpolar(t: number[], y: number[], x: number): number {
  let i = 1;
  while (i < t.length - 1 && t[i]! < x) i++;
  const u = (x - t[i - 1]!) / (t[i]! - t[i - 1]! || 1);
  return y[i - 1]! + (y[i]! - y[i - 1]!) * u;
}

async function simular(page: Page) {
  await page.evaluate(() => delete (window as unknown as { __epaEditorSim?: unknown }).__epaEditorSim);
  await page.locator('button.simular').click();
  await page.waitForFunction(() => !!(window as unknown as { __epaEditorSim?: unknown }).__epaEditorSim, null, { timeout: 60_000 });
}

/** Measurements table of the results (name → value), in order. */
async function medidas(page: Page): Promise<[string, number][]> {
  await expect(page.locator('table.medidas td.n').first()).toBeVisible({ timeout: 60_000 });
  return page.locator('table.medidas tbody tr').evaluateAll((filas) =>
    filas.flatMap((f) => {
      const n = f.querySelector('td.n')?.textContent?.trim();
      const v = f.querySelector('td.v')?.getAttribute('title');
      return n && v ? [[n, Number(v)] as [string, number]] : [];
    }),
  );
}

// ------------------------------------------------------------------ tests

test.beforeEach(async ({ page }) => {
  // Every test starts with an empty draft and no saved circuits.
  await page.goto('/#/');
  await page.evaluate(() => {
    localStorage.removeItem('epa:editor-borrador');
    localStorage.removeItem('epa:editor-circuitos');
  });
});

test('con el ratón: divisor, punto de trabajo como el cálculo a mano y valores sobre el esquema', async ({ page }) => {
  await abrirEditor(page);
  await divisorConRaton(page);
  const nl = await netlist(page);
  expect(nl).toMatch(/^V1 n1 0 DC 6$/m);
  expect(nl).toMatch(/^R1 n1 out 1k$/m);
  expect(nl).toMatch(/^R2 out 0 2k$/m);
  expect(nl).toMatch(/^\.op$/m);
  await simular(page);
  // Hand calculation: 6 V · 2k / (1k + 2k) = 4 V; I = 6 V / 3 kΩ = 2 mA.
  const v = await vectores(page, /operating/);
  expect(v.find((x) => x.nombre === 'v(out)')!.re[0]).toBeCloseTo(4, 6);
  expect(v.find((x) => x.nombre === 'i(v1)')!.re[0]).toBeCloseTo(-2e-3, 9);
  // The live drawing shows the node voltage and the branch current.
  await expect(page.locator('.viva svg.valores text.v', { hasText: '4,00 V' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.viva svg.valores text.i', { hasText: '2,00 mA' }).first()).toBeVisible();
  // The generated netlist is shown, read-only and copyable.
  await page.locator('.netlist summary', { hasText: 'Netlist generada' }).click();
  await expect(page.locator('pre.texto-netlist')).toContainText('R2 out 0 2k');
});

test('deshacer y rehacer', async ({ page }) => {
  await abrirEditor(page);
  await ponerRaton(page, 'R', 4, 3);
  await ponerRaton(page, 'C', 4, 6);
  await cableRaton(page, 3, 3, 3, 6);
  expect((await componentes(page)).length).toBe(2);
  const cables = () => page.evaluate(() => (window as unknown as { __epaEditor: { ed: { doc: { cables: unknown[] } } } }).__epaEditor.ed.doc.cables.length);
  expect(await cables()).toBe(1);
  await page.keyboard.press('Control+z');
  expect(await cables()).toBe(0);
  await page.keyboard.press('Control+z');
  expect((await componentes(page)).length).toBe(1);
  await page.keyboard.press('Control+y');
  await page.keyboard.press('Control+Shift+z');
  expect((await componentes(page)).length).toBe(2);
  expect(await cables()).toBe(1);
  // Rotation, move and delete go through the history too.
  await seleccionar(page, 'C1');
  await page.keyboard.press('r');
  expect((await componentes(page)).find((c) => c.nombre === 'C1')!.o).toBe(1);
  await page.keyboard.press('Delete');
  expect((await componentes(page)).length).toBe(1);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  expect((await componentes(page)).find((c) => c.nombre === 'C1')!.o).toBe(1);
  // Copy and paste: a new name.
  await seleccionar(page, 'C1');
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  expect((await componentes(page)).map((c) => c.nombre).sort()).toEqual(['C1', 'C2', 'R1']);
});

test('con el tacto: carga de un RC, el transitorio sigue a 5·(1 − e^(−t/τ))', async ({ browser }) => {
  const { ctx, page, cdp } = await contextoTactil(browser);
  await abrirEditor(page);
  await ponerTactil(page, 'VPULSE', 2, 4);
  // 0 → 5 V step at t = 0 (a long pulse).
  await campo(page, 'tr', '1n');
  await campo(page, 'tf', '1n');
  await campo(page, 'pw', '10');
  await campo(page, 'per', '20');
  await campo(page, 'td', '0');
  await ponerTactil(page, 'R', 5, 3);
  await ponerTactil(page, 'C', 8, 4);
  await page.locator('.propiedades').getByRole('button', { name: 'Girar' }).tap();
  await campo(page, 'valor', '1µ');
  await ponerTactil(page, 'GND', 2, 7.4);
  await ponerTactil(page, 'GND', 8, 7.4);
  await ponerTactil(page, 'ETQ', 7, 1);
  await campo(page, 'red', 'out');
  // A voltage probe on the capacitor's top pin: it chooses the plotted curve.
  await ponerTactil(page, 'SONDA', 8, 2.08);
  // Wires: two dragged from a pin with a finger, the rest tap by tap with the wire tool.
  await verLienzo(page);
  await arrastreTactil(page, cdp, await W(page, 2, 3), await W(page, 4, 3));
  await arrastreTactil(page, cdp, await W(page, 6, 3), await W(page, 8, 3));
  await page.getByRole('button', { name: 'Cable', exact: true }).tap();
  await verLienzo(page);
  await tocar(page, await W(page, 8, 5));
  await tocar(page, await W(page, 8, 7));
  await tocar(page, await W(page, 2, 5));
  await tocar(page, await W(page, 2, 7));
  await tocar(page, await W(page, 7, 1));
  await tocar(page, await W(page, 7, 3));
  const nl = await netlist(page);
  expect(nl).toMatch(/^R1 n1 out 1k$/m);
  expect(nl).toMatch(/^C1 out 0 1u$/m);
  expect(nl).toMatch(/^V1 n1 0 PULSE\(0 5 0 1n 1n 10 20\)$/m);
  // Transient 10 µs steps up to 5 ms, from rest (UIC).
  await page.getByText('Transitorio', { exact: false }).first().tap();
  await page.locator('[name="tran-paso"]').fill('10µ');
  await page.locator('[name="tran-paso"]').press('Enter');
  await page.locator('[name="tran-fin"]').fill('5m');
  await page.locator('[name="tran-fin"]').press('Enter');
  expect(await netlist(page)).toMatch(/^\.tran 10u 5m$/m);
  await simular(page);
  const v = await vectores(page, /transient/);
  const t = v.find((x) => x.nombre === 'time')!.re;
  const y = v.find((x) => x.nombre === 'v(out)')!.re;
  // τ = 1 kΩ · 1 µF = 1 ms: 63,2 % at τ, 95,0 % at 3τ.
  expect(interpolar(t, y, 1e-3)).toBeCloseTo(5 * (1 - Math.exp(-1)), 1);
  expect(Math.abs(interpolar(t, y, 1e-3) / (5 * (1 - Math.exp(-1))) - 1)).toBeLessThan(0.01);
  expect(Math.abs(interpolar(t, y, 3e-3) / (5 * (1 - Math.exp(-3))) - 1)).toBeLessThan(0.01);
  // The probe chose the plotted curve.
  await expect(page.locator('section.resultados .vectores button[aria-pressed="true"]')).toHaveText(['v(out)']);
  // The transient animates the drawing (particles on its canvas).
  await expect(page.locator('.viva canvas')).toBeVisible({ timeout: 30_000 });
  await ctx.close();
});

test('el pellizco amplía el esquema y nunca la página', async ({ browser }) => {
  const { ctx, page, cdp } = await contextoTactil(browser);
  await abrirEditor(page);
  await ponerTactil(page, 'R', 4, 4);
  await verLienzo(page);
  const caja = (await page.locator('.lienzo').boundingBox())!;
  const c: P = [caja.x + caja.width / 2, caja.y + caja.height / 2];
  const z0 = await page.evaluate(() => (window as unknown as { __epaEditor: { zoom: () => number } }).__epaEditor.zoom());
  await toques(cdp, 'touchStart', [
    [c[0] - 30, c[1]],
    [c[0] + 30, c[1]],
  ]);
  for (let k = 1; k <= 10; k++)
    await toques(cdp, 'touchMove', [
      [c[0] - 30 - k * 9, c[1]],
      [c[0] + 30 + k * 9, c[1]],
    ]);
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(100);
  const z1 = await page.evaluate(() => (window as unknown as { __epaEditor: { zoom: () => number } }).__epaEditor.zoom());
  expect(z1).toBeGreaterThan(z0 * 2);
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
  // Nothing was added or moved by the two fingers.
  expect((await componentes(page)).length).toBe(1);
  await ctx.close();
});

test('la rueda desplaza la página; Ctrl + rueda acerca el dibujo y Mayús + rueda lo desplaza', async ({ page }) => {
  await abrirEditor(page);
  await ponerRaton(page, 'R', 4, 4);
  await expect(page.locator('.lienzo .ayuda')).toContainText('Ctrl + rueda para acercar');
  const zoom = () => page.evaluate(() => (window as unknown as { __epaEditor: { zoom: () => number } }).__epaEditor.zoom());
  const caja = (await page.locator('.lienzo').boundingBox())!;
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  // Plain wheel over the canvas: the page scrolls, the drawing does not zoom.
  const z0 = await zoom();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.wheel(0, 300);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  expect(await zoom()).toBe(z0);
  // Ctrl + wheel (and a trackpad pinch, which is ctrl+wheel): only the drawing zooms.
  await page.evaluate(() => window.scrollTo(0, 0));
  const c2 = (await page.locator('.lienzo').boundingBox())!;
  await page.mouse.move(c2.x + c2.width / 2, c2.y + c2.height / 2);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  expect(await zoom()).toBeGreaterThan(z0 * 1.3);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // Shift + wheel: the drawing moves sideways, the page stays.
  const x0 = (await W(page, 4, 4))[0];
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 120);
  await page.keyboard.up('Shift');
  await expect.poll(async () => Math.abs((await W(page, 4, 4))[0] - x0)).toBeGreaterThan(50);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('guardar, volver a abrir, cambiar el nombre y borrar', async ({ page }) => {
  await abrirEditor(page);
  await ponerRaton(page, 'R', 4, 3);
  await ponerRaton(page, 'GND', 4, 6.4);
  await page.locator('.propiedades').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Escape');
  await page.locator('.propiedades [name="titulo"]').fill('Mi prueba');
  await page.locator('.propiedades [name="titulo"]').press('Enter');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.waitForURL(/#\/editor\/c[0-9a-z]+$/);
  const url = page.url();
  await expect(page.locator('.estado-guardado')).toContainText('Guardado');
  // A change after saving is saved by itself.
  await ponerRaton(page, 'C', 8, 3);
  await page.waitForTimeout(900);
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as { __epaEditor?: unknown }).__epaEditor);
  await expect(page.locator('[data-comp]')).toHaveCount(3);
  expect(page.url()).toBe(url);
  // The store holds one key with a timestamp per circuit.
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:editor-circuitos') ?? '{}'));
  const lista = Object.values(guardado.circuitos as Record<string, { nombre: string; actualizado: number; doc: { componentes: unknown[] } }>);
  expect(lista).toHaveLength(1);
  expect(lista[0]!.nombre).toBe('Mi prueba');
  expect(lista[0]!.doc.componentes).toHaveLength(3);
  expect(lista[0]!.actualizado).toBeGreaterThan(0);
  // «Mis circuitos»: rename, then delete (a tombstone stays).
  await page.getByRole('button', { name: 'Mis circuitos' }).click();
  await page.getByRole('button', { name: 'Cambiar el nombre de Mi prueba' }).click();
  await page.getByRole('textbox', { name: 'Nuevo nombre' }).fill('Otra prueba');
  await page.getByRole('button', { name: 'Cambiar' }).click();
  await expect(page.locator('.dialogo')).toContainText('Otra prueba');
  await page.getByRole('button', { name: 'Borrar Otra prueba' }).click();
  await page.locator('.dialogo').getByRole('button', { name: 'Borrar', exact: true }).click();
  await expect(page.locator('.dialogo')).toContainText('Todavía no hay circuitos guardados');
  const tras = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:editor-circuitos') ?? '{}'));
  expect(Object.values(tras.circuitos as Record<string, { borrado?: number }>)[0]!.borrado).toBeGreaterThan(0);
});

test('un rectificador del libro, dibujado, da los mismos resultados que su netlist', async ({ page }) => {
  test.setTimeout(240_000);
  for (const id of ['cap22/fig-22.9_puente', 'cap05/sec-5.6_puente_condensador']) {
    await page.goto(`/#/simulador/${id}`);
    const delTexto = await medidas(page);
    expect(delTexto.length).toBeGreaterThan(2);
    await page.locator('a.esquema', { hasText: 'Editar el esquema' }).click();
    await page.waitForFunction(() => (window as unknown as { __epaEditor?: { ed: { doc: { componentes: unknown[] } } } }).__epaEditor?.ed.doc.componentes.length);
    await expect(page).toHaveURL(/#\/editor$/);
    const n = (await componentes(page)).filter((c) => !['GND', 'RIEL', 'ETQ'].includes(c.tipo)).length;
    expect(n).toBeGreaterThan(3);
    await simular(page);
    const delDibujo = await medidas(page);
    expect(delDibujo.map(([k]) => k)).toEqual(delTexto.map(([k]) => k));
    delDibujo.forEach(([k, v], i) => expect(Math.abs(v - delTexto[i]![1]), k).toBeLessThanOrEqual(Math.abs(delTexto[i]![1]) * 1e-6 + 1e-12));
  }
});

test('exportar .cir y volver a importarlo da la misma netlist', async ({ page }) => {
  await abrirEditor(page);
  await divisorConRaton(page);
  const antes = await netlist(page);
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar .cir' }).click()]);
  const ruta = await descarga.path();
  const texto = fs.readFileSync(ruta!, 'utf8');
  expect(texto).toBe(antes);
  // Export SVG too (a standalone picture with its fonts).
  const [svg] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar SVG' }).click()]);
  const s = fs.readFileSync((await svg.path())!, 'utf8');
  expect(s.startsWith('<svg')).toBe(true);
  expect(s).toContain('@font-face');
  // «Ver como netlist»: the simulator page with the generated text, and back to the drawing.
  await page.getByRole('button', { name: 'Ver como netlist' }).click();
  await expect(page.locator('.pagina h1')).toContainText('Netlist del esquema');
  await expect(page.locator('.pagina textarea').first()).toHaveValue(antes);
  await page.locator('a.esquema', { hasText: 'Volver al esquema' }).click();
  await page.waitForFunction(() => (window as unknown as { __epaEditor?: { ed: { doc: { componentes: unknown[] } } } }).__epaEditor?.ed.doc.componentes.length === 6);
  // Import: a new drawing whose netlist has the same element lines.
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Nuevo' }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'divisor.cir', mimeType: 'text/plain', buffer: Buffer.from(texto) });
  await page.waitForFunction(() => (window as unknown as { __epaEditor: { ed: { doc: { componentes: unknown[] } } } }).__epaEditor.ed.doc.componentes.length > 2);
  const despues = await netlist(page);
  const elementos = (t: string) => t.split('\n').filter((l) => /^[A-Za-z]/.test(l)).sort();
  expect(elementos(despues)).toEqual(elementos(antes));
  await simular(page);
  const v = await vectores(page, /operating/);
  expect(v.find((x) => x.nombre === 'v(out)')!.re[0]).toBeCloseTo(4, 6);
});

// ------------------------------------------------------------------ screenshots

const PERFILES = {
  mac: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
  'tableta-vertical': { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;

for (const [perfil, opciones] of Object.entries(PERFILES)) {
  for (const tema of ['claro', 'oscuro'] as const) {
    test(`capturas del editor ${perfil} ${tema}`, async ({ browser }) => {
      test.setTimeout(120_000);
      fs.mkdirSync('tests/capturas/editor', { recursive: true });
      const ctx = await browser.newContext({ ...opciones, colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
      const page = await ctx.newPage();
      await abrirEditor(page, '#/editor/libro/cap22/fig-22.9_puente');
      await page.waitForFunction(() => (window as unknown as { __epaEditor?: { ed: { doc: { componentes: unknown[] } } } }).__epaEditor?.ed.doc.componentes.length);
      await page.waitForTimeout(400);
      // A part selected, to show the properties.
      await seleccionar(page, 'C1');
      await page.screenshot({ path: `tests/capturas/editor/${perfil}-${tema}-editar.png` });
      await page.locator('.propiedades').screenshot({ path: `tests/capturas/editor/${perfil}-${tema}-propiedades.png` });
      await simular(page);
      await expect(page.locator('.viva svg.valores text').first()).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(600);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `tests/capturas/editor/${perfil}-${tema}-resultados.png` });
      await page.locator('section.resultados').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `tests/capturas/editor/${perfil}-${tema}-graficas.png` });
      await ctx.close();
    });
  }
}
