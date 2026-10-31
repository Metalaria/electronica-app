// Sixth review, finding 2 (the reader's side): when «Mis circuitos» or «Mis montajes» cannot be read from this device,
// or a save fails, the editor and the breadboard say so (a non-blocking notice with «Reintentar») and never say
// «Guardado en este dispositivo»; a failed «Guardar» keeps the draft; «Reintentar» reads and writes again.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.revision.config.ts tests/revision11-avisos.spec.ts
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

type VentanaEditor = { __epaEditor?: { ed: { doc: { componentes: unknown[] } } } };
type VentanaProto = { __epaProtoboard?: { pb: { doc: { piezas: unknown[] } } } };
const NETLIST = '#/editor/libro/cap05/sec-5.3_led_150ohm';

/**
 * A context whose localStorage refuses the two libraries' keys while `prueba:fallar` (read with the original getItem)
 * says «leer» (getItem throws) or «escribir» (setItem throws, as a full storage does).
 */
async function contexto(browser: Browser): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    const modo = () => get.call(localStorage, 'prueba:fallar') ?? '';
    const biblioteca = (k: string) => k === 'epa:editor-circuitos' || k === 'epa:protoboard-circuitos';
    Storage.prototype.getItem = function (k: string) {
      if (modo().includes('leer') && biblioteca(k)) throw new DOMException('no disponible', 'SecurityError');
      return get.call(this, k);
    };
    Storage.prototype.setItem = function (k: string, v: string) {
      if (modo().includes('escribir') && biblioteca(k)) throw new DOMException('lleno', 'QuotaExceededError');
      return set.call(this, k, v);
    };
  });
  return ctx;
}

const fallar = (page: Page, modo: string) => page.evaluate((m) => (m ? localStorage.setItem('prueba:fallar', m) : localStorage.removeItem('prueba:fallar')), modo);
const guardados = (page: Page, clave: string) =>
  page.evaluate((k) => {
    localStorage.removeItem('prueba:fallar');
    return Object.keys((JSON.parse(localStorage.getItem(k) ?? '{}') as { circuitos?: object }).circuitos ?? {});
  }, clave);

async function abrirNetlist(page: Page) {
  await page.goto(NETLIST);
  await page.waitForFunction(() => ((window as unknown as VentanaEditor).__epaEditor?.ed.doc.componentes.length ?? 0) > 2, null, { timeout: 30_000 });
}

test.describe('sexta revisión: el lector sabe cuándo su biblioteca no se pudo leer o guardar', () => {
  test.setTimeout(150_000);

  test('editor: «Mis circuitos» ilegible → aviso con «Reintentar», nada dice «Guardado»; al reintentar se abre', async ({ browser }) => {
    const ctx = await contexto(browser);
    const page = await ctx.newPage();
    await abrirNetlist(page);
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.waitForURL(/#\/editor\/c[0-9a-z]+$/);
    const id = page.url().split('/').pop()!;
    await expect(page.locator('.estado-guardado')).toContainText('Guardado en este dispositivo');
    // the next session cannot read the library
    await fallar(page, 'leer');
    await page.reload();
    const aviso = page.locator('[data-aviso-guardado]');
    await expect(aviso).toHaveAttribute('data-aviso-guardado', 'lectura');
    await expect(aviso).toHaveAttribute('role', 'alert');
    await expect(aviso).toContainText('No se pudo leer «Mis circuitos» en este dispositivo');
    await expect(page.locator('.editor-pagina')).toContainText('no se puede abrir ahora');
    await expect(page.locator('.editor-pagina')).not.toContainText('Guardado en este dispositivo');
    // the storage works again: «Reintentar» reads it and opens the circuit
    await fallar(page, '');
    await aviso.getByRole('button', { name: 'Reintentar' }).click();
    await expect(aviso).toHaveCount(0);
    await expect(page.locator('.estado-guardado')).toContainText('Guardado en este dispositivo');
    expect(await guardados(page, 'epa:editor-circuitos')).toContain(id);
    await ctx.close();
  });

  test('editor: «Guardar» que falla → aviso, «Sin guardar», el borrador se conserva; al reintentar se guarda', async ({ browser }) => {
    const ctx = await contexto(browser);
    const page = await ctx.newPage();
    await abrirNetlist(page);
    await fallar(page, 'escribir');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.waitForURL(/#\/editor\/c[0-9a-z]+$/);
    const id = page.url().split('/').pop()!;
    const aviso = page.locator('[data-aviso-guardado]');
    await expect(aviso).toHaveAttribute('data-aviso-guardado', 'escritura');
    await expect(aviso).toContainText('No se pudieron guardar sus cambios en «Mis circuitos»');
    await expect(page.locator('.estado-guardado')).toContainText('Sin guardar en este dispositivo');
    await expect(page.locator('.estado-guardado')).not.toContainText('Guardado en este dispositivo');
    // the drawing is still kept somewhere that survives closing the page: the draft
    expect(await page.evaluate(() => !!localStorage.getItem('epa:editor-borrador'))).toBe(true);
    // the editor keeps working (non-blocking), and «Reintentar» writes once the storage takes it
    await expect(page.getByRole('button', { name: 'Mis circuitos' })).toBeEnabled();
    await fallar(page, '');
    await aviso.getByRole('button', { name: 'Reintentar' }).click();
    await expect(aviso).toHaveCount(0);
    await expect(page.locator('.estado-guardado')).toContainText('Guardado en este dispositivo');
    expect(await guardados(page, 'epa:editor-circuitos')).toContain(id);
    await ctx.close();
  });

  test('protoboard: «Mis montajes» ilegible o que no se guarda → aviso con «Reintentar»; nunca «Guardado»', async ({ browser }) => {
    const ctx = await contexto(browser);
    const page = await ctx.newPage();
    await abrirNetlist(page);
    await page.locator('button:has-text("Ver en protoboard")').first().click();
    await page.waitForFunction(() => !!(window as unknown as VentanaProto).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
    const cab = page.locator('.capa-protoboard header.cab');
    // «Guardar como montaje propio» with a storage that refuses it
    await fallar(page, 'escribir');
    await page.locator('.capa-protoboard button:has-text("Guardar")').click();
    await expect(cab.locator('[data-aviso-guardado]')).toContainText('no se pudo guardar en este dispositivo');
    await expect(cab).not.toContainText('Guardado en «Mis montajes»');
    await fallar(page, '');
    await cab.getByRole('button', { name: 'Reintentar' }).click();
    await expect(cab).toContainText('Guardado en «Mis montajes»');
    await page.locator('.capa-protoboard button:has-text("Abrirlo")').click();
    await expect(page).toHaveURL(/#\/protoboard\/m/);
    const id = page.url().split('/').pop()!;
    expect(await guardados(page, 'epa:protoboard-circuitos')).toContain(id);
    // the next session cannot read «Mis montajes»
    await fallar(page, 'leer');
    await page.reload();
    const aviso = page.locator('.pagina-protoboard [data-aviso-guardado]');
    await expect(aviso).toHaveAttribute('data-aviso-guardado', 'lectura');
    await expect(aviso).toContainText('No se pudo leer «Mis montajes» en este dispositivo');
    await expect(page.locator('.pagina-protoboard')).toContainText('no se puede abrir ahora');
    await expect(page.locator('.pagina-protoboard')).not.toContainText('Guardado en este dispositivo');
    await fallar(page, '');
    await aviso.getByRole('button', { name: 'Reintentar' }).click();
    await expect(aviso).toHaveCount(0);
    await page.waitForFunction(() => !!(window as unknown as VentanaProto).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
    await expect(page.locator('.pagina-protoboard header.cab')).toContainText('Guardado en este dispositivo');
    await expect(page.locator('.pagina-protoboard [role="alert"]')).toHaveCount(0);
    await ctx.close();
  });
});
