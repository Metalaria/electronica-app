// 1.4 (contenido14) in the browser, on the owner's phone (Pixel 8 Pro: 412×915, DPR 3.5, touch): a sample of the
// published lesson cards whose zones were 3–24 px on a phone and now start cropped and/or zoomed (`recorte`,
// `ampliar`) — the book's tables (rows over their line pitch), crossed arrows, console board photos with tiny parts
// (a larger target around the part) and a whole-photo zoom. Each zone's largest rectangle is at least 44 CSS px on
// the screen, a real tap with the finger on its middle selects it, and the page does not scroll sideways.
// The unit spec contenido14-zonas-unidad measures every published card the same way, without a browser.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.contenido14.config.ts tests/contenido14-zonas-navegador.spec.ts
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leccion = (id: string) =>
  JSON.parse(fs.readFileSync(path.join(web, 'public', 'libro', 'lecciones11', `${id}.json`), 'utf8')) as {
    tarjetas: { id: string; widget?: { zonas: { id: string }[]; recorte?: number[]; ampliar?: number } }[];
  };

const MUESTRA: [string, string][] = [
  ['cap46/sec-46.10', 'toque-revision'],
  ['cap46/sec-46.2', 'pregunta-esd'],
  ['cap41/sec-41.5', 'toque-isi'],
  ['cap40/sec-40.9', 'toque-transitorio'],
  ['consola-nes/nes-video-audio', 'toque-q1'],
  ['consola-nes/nes-alimentacion', 'prediga-regulador'],
  ['consola-sms/sms-averias', 'toque-mando'],
  ['consola-megadrive/megadrive-relojes', 'toque-sin-color'],
  ['consola-nes/nes-video-audio', 'empareje-sonido'],
  // (2.0, gamecube20: the smallest zones of the GameCube lessons, U10 and the controller connector)
  ['consola-gamecube/gamecube-bloqueo', 'toque-disco'],
  ['consola-gamecube/gamecube-averias', 'averia-mandos'],
  // (2.0, n64ps1: the smallest zones of the Nintendo 64 and PlayStation lessons, the N64's LED across the whole
  // board and the PU-18's two controller fuses)
  ['consola-n64/n64-averias', 'ordene-simple'],
  ['consola-ps1/ps1-averias', 'averia-mandos'],
];

async function abrir(page: Page, id: string, tarjeta: string) {
  await page.context().route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript(() => {
    localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
  });
  const n = leccion(id).tarjetas.findIndex((t) => t.id === tarjeta) + 1;
  expect(n).toBeGreaterThan(0);
  await page.goto(`#/leccion/${id}/${n}`);
  await expect(page.locator(`[data-tarjeta="${tarjeta}"]`)).toBeVisible();
}

/** The zone's largest rectangle on the screen, brought into view first (the zoomed frame scrolls). */
async function caja(page: Page, t: string, z: string) {
  const rs = page.locator(`[data-tarjeta="${t}"] [data-zona="${z}"] rect:not(.halo)`);
  let mejor = { x: 0, y: 0, width: 0, height: 0 };
  for (let k = 0; k < (await rs.count()); k++) {
    await rs.nth(k).scrollIntoViewIfNeeded();
    const b = (await rs.nth(k).boundingBox())!;
    if (Math.min(b.width, b.height) > Math.min(mejor.width, mejor.height)) mejor = b;
  }
  return mejor;
}

for (const [id, tarjeta] of MUESTRA)
  test(`${id} ${tarjeta}: cada zona mide al menos 44 px en el teléfono y se toca con el dedo`, async ({ page }, info) => {
    // (cierre14: the config's desktop project is there for other specs; these sizes are the phone's)
    test.skip(info.project.name !== 'telefono', 'the owner\'s phone');
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await abrir(page, id, tarjeta);
    const w = leccion(id).tarjetas.find((t) => t.id === tarjeta)!.widget!;
    const t = page.locator(`[data-tarjeta="${tarjeta}"]`);
    // the starting zoom applies on the phone
    if (w.ampliar) await expect(t.locator('.d12-lienzo')).toHaveAttribute('data-zoom', String(w.ampliar));
    if (w.recorte) await expect(t.locator('img[data-recorte]')).toHaveAttribute('data-recorte', w.recorte.join(' '));
    for (const z of w.zonas) {
      const b = await caja(page, tarjeta, z.id);
      expect(Math.min(b.width, b.height), `${z.id}: ${Math.round(b.width)} × ${Math.round(b.height)} px`).toBeGreaterThanOrEqual(44);
    }
    // a real tap (CDP touch) on the last zone selects it (a fifth in from its left edge: crossed zones — the two arrows
    // of 41.8 — share their middles, where the smaller one wins the tap)
    const ultima = w.zonas[w.zonas.length - 1]!.id;
    const b = await caja(page, tarjeta, ultima);
    await page.touchscreen.tap(b.x + b.width / 5, b.y + b.height / 2);
    await expect(t.locator(`[data-zona="${ultima}"]`)).toHaveAttribute('data-estado', /elegida|vista/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412);
    expect(errores).toEqual([]);
  });
