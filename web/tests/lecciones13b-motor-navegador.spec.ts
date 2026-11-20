// 1.3 (motor13b) in the browser, on the owner's phone (Pixel 8 Pro: 412×915, DPR 3.5, touch) and on a 360 px one: the
// «figura» widget's crop and starting zoom (`recorte`, `ampliar`). The catalogue lesson
// tests/lecciones12-catalogo/cap16/sec-16.16.yaml generated here with its explore cards changed and served in place of
// the published one: the SNES NTSC board photo cropped to the chips right of the cartridge slot and zoomed 1.5 times
// on a phone, and the book's figure 15.21 cropped. Every zone is at least 44 CSS px on the screen and a tap with the
// finger (CDP touch events) on its middle touches it; the goal is reached; the list of zones (keyboard, screen
// reader) is unchanged; on a desktop the zoom does not start; no horizontal scroll of the page.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config> tests/lecciones13b-motor-navegador.spec.ts
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
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
const contexto: ContextoLibro = {
  bloques: (p) => {
    const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
  },
  recursos: recursosLibro(path.join(web, 'public', 'libro'), path.join(web, 'public')),
};
const ID = 'cap16/sec-16.16';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fuente = parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', `${ID}.yaml`), 'utf8')) as { tarjetas: Record<string, any>[] };
const de = (id: string) => fuente.tarjetas.find((t) => t.id === id)!;
de('explore-equivalente').widget = {
  tipo: 'figura',
  consola: { maquina: 'snes' },
  recorte: [900, 100, 306, 830],
  ampliar: 1.5,
  zonas: [
    { id: 'coincidir', hotspot: 'n-cic' },
    { id: 'diferir', hotspot: 'n-x1' },
    { id: 'trampas', hotspot: 'n-reset' },
  ],
};
de('explore-orden').widget.recorte = [0, 0, 300, 201.6];
const r = generarLeccion(fuente, contexto, 'catalogo-motor13b');
if (r.errores.length) throw new Error(r.errores.join('\n'));
const leccion = r.leccion as Leccion11;
const n = (id: string) => leccion.tarjetas.findIndex((t) => t.id === id) + 1;

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
const sinScroll = async (page: Page, ancho: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);

/** The zone's rectangle on the screen, brought into view (the zoomed frame scrolls). */
async function caja(page: Page, id: string) {
  const z = page.locator(`[data-zona="${id}"] rect:not(.halo)`).first();
  await z.scrollIntoViewIfNeeded();
  return (await z.boundingBox())!;
}
/** A real tap with the finger (CDP Input.dispatchTouchEvent) on the middle of a zone of the picture. */
async function tocarDibujo(page: Page, id: string) {
  const b = await caja(page, id);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}

for (const [ancho, alto, dpr] of [
  [412, 915, 3.5],
  [360, 780, 3],
] as const)
  test.describe(`teléfono de ${ancho} px`, () => {
    test.use({ viewport: { width: ancho, height: alto }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });

    test('foto de la SNES recortada y ampliada: cada chip mide al menos 44 px y se toca con el dedo', async ({ page }) => {
      const errores: string[] = [];
      page.on('pageerror', (e) => errores.push(e.message));
      await abrir(page, 'explore-equivalente');
      const t = page.locator('[data-tarjeta="explore-equivalente"]');
      await expect(t.locator('.d12-lienzo')).toHaveAttribute('data-zoom', '1.5');
      await expect(t.locator('img[data-recorte]')).toHaveAttribute('data-recorte', '900 100 306 830');
      await expect(t.locator('img[data-recorte]')).toHaveAttribute('alt', /\(detalle\)$/);
      for (const id of ['coincidir', 'diferir', 'trampas']) {
        const b = await caja(page, id);
        expect(Math.min(b.width, b.height), `${id}: ${Math.round(b.width)} × ${Math.round(b.height)} px`).toBeGreaterThanOrEqual(44);
      }
      for (const id of ['diferir', 'coincidir', 'trampas']) {
        await tocarDibujo(page, id);
        await expect(page.locator(`[data-zona="${id}"]`)).toHaveAttribute('data-estado', 'vista');
      }
      await expect(page.locator('[data-objetivo]')).toHaveAttribute('data-objetivo', 'logrado');
      // the keyboard and screen reader list: the same three zones, with the explorer's names
      await expect(t.locator('[data-lista-zonas] [data-boton-zona]')).toHaveCount(3);
      // «Ver entera» goes back to the crop at the frame's width
      await t.locator('[data-entera]').click();
      await expect(t.locator('.d12-lienzo')).toHaveAttribute('data-zoom', '1');
      await sinScroll(page, ancho);
      expect(errores).toEqual([]);
    });

    test('figura del libro recortada: la zona cortada por el borde se toca en su parte visible; teclado igual', async ({ page }) => {
      await abrir(page, 'explore-orden');
      const t = page.locator('[data-tarjeta="explore-orden"]');
      await expect(t.locator('.d12-lienzo')).toHaveAttribute('data-zoom', '1');
      // the picture is wider than the frame (453.6 / 300) and the clipped zone ends at the frame's right edge
      const marco = (await t.locator('.d12-marco').boundingBox())!;
      const img = (await t.locator('img[data-recorte]').boundingBox())!;
      expect(img.width / marco.width).toBeGreaterThan(1.45);
      const d = await caja(page, 'diferir');
      expect(d.x + d.width).toBeLessThanOrEqual(marco.x + marco.width + 1);
      await tocarDibujo(page, 'coincidir');
      await tocarDibujo(page, 'diferir');
      await expect(page.locator('[data-zona="diferir"]')).toHaveAttribute('data-estado', 'vista');
      await page.locator('[data-boton-zona="trampas"]').focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('[data-objetivo]')).toHaveAttribute('data-objetivo', 'logrado');
      await sinScroll(page, ancho);
    });
  });

test.describe('escritorio', () => {
  test.use({ viewport: { width: 1366, height: 900 } });
  test('en una pantalla ancha, «ampliar» no se aplica (la foto recortada cabe)', async ({ page }) => {
    await abrir(page, 'explore-equivalente');
    await expect(page.locator('[data-tarjeta="explore-equivalente"] .d12-lienzo')).toHaveAttribute('data-zoom', '1');
  });
});
