// 1.3.1 (qa131-plataforma): browser checks of the platform review, on the production build.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test tests/qa131-plataforma-navegador.spec.ts
import { expect, test, type Page } from '@playwright/test';

async function medir(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector('section.panel')?.getBoundingClientRect();
    return { inner: innerWidth, scroll: document.documentElement.scrollWidth, panel: panel ? Math.round(panel.right) : null };
  });
}

// The whole-app monkey (tests/monos, seed 3000 on the tablet) found it: Mesa's <svg width={ancho}> keeps the width
// measured before, and the bench (a flex item with min-width: auto) could not get narrower than that svg, so the
// measured width never went down — after making the app's window narrower, or turning the tablet, the breadboard's
// panel stayed past the right edge (a tablet showed the page zoomed out).
test.describe('protoboard: el banco se estrecha con la ventana', () => {
  test('ventana de escritorio de 1920 a 1100 px: el panel sigue a la vista', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await page.goto('/#/protoboard');
    await expect(page.locator('section.panel')).toBeVisible();
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect.poll(async () => (await medir(page)).scroll, { timeout: 10_000 }).toBeLessThanOrEqual(1100);
    const m = await medir(page);
    expect(m.panel).not.toBeNull();
    expect(m.panel!).toBeLessThanOrEqual(1100);
    await ctx.close();
  });

  test('tableta girada de vertical a apaisada: la página no se ensancha', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 834, height: 1334 }, deviceScaleFactor: 2.25, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto('/#/protoboard');
    await expect(page.locator('.protoboard .banco')).toBeVisible();
    await page.waitForTimeout(1500);
    await page.setViewportSize({ width: 1334, height: 834 });
    await expect(page.locator('section.panel')).toBeVisible();
    await expect.poll(async () => (await medir(page)).inner, { timeout: 10_000 }).toBe(1334);
    const m = await medir(page);
    expect(m.scroll).toBeLessThanOrEqual(1334);
    expect(m.panel!).toBeLessThanOrEqual(1334);
    await ctx.close();
  });
});

interface SesionInforme {
  b: string[];
  m?: string[];
}
const sesiones = (page: Page) => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('epa-informe-sesion') ?? '{}')) as SesionInforme[]);

// The owner's «Informe de fallos» from 1.3.0 on Android: «Cierre inesperado» in #/protoboard with breadcrumbs that end
// ten minutes before, at the console's 3D board — nothing about entering the breadboard. The route crumb was written
// only on «hashchange», and a navigation from an overlay (the «Más» sheet, the search, the drawer:
// navegarDesdeCapa) replaces the address without one.
test.describe('informe de fallos: migas que explican un cierre', () => {
  // (2.1: the phone's «Más» menu went; the breadboard is a tab of the Taller group, under the header)
  test('entrar en la protoboard desde las pestañas de Taller deja su miga de ruta', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.route('https://api.github.com/**', (r) => r.abort());
    await page.goto('/#/cap05');
    await expect(page.locator('#contenido .cargando')).toHaveCount(0);
    await page.getByRole('navigation', { name: 'Secciones de la aplicación' }).getByRole('link', { name: 'Taller' }).tap();
    await page.getByRole('navigation', { name: 'Partes de Taller' }).getByRole('link', { name: 'Protoboard' }).tap();
    await expect(page).toHaveURL(/#\/protoboard$/);
    await expect.poll(async () => (await sesiones(page)).flatMap((s) => s.b).some((x) => / ruta #\/protoboard$/.test(x) || / ruta #\/protoboard /.test(x)), { timeout: 10_000 }).toBe(true);
    // and what the breadboard holds (counts only)
    await expect.poll(async () => (await sesiones(page)).flatMap((s) => s.b).some((x) => / protoboard: \d+ piezas, \d+ cables$/.test(x)), { timeout: 10_000 }).toBe(true);
    await ctx.close();
  });

  test('cada miga y cada latido guardan una muestra de memoria (montón de JS, nodos, lienzos, WebGL)', async ({ page }) => {
    await page.addInitScript(() => ((window as unknown as { __epaInformeSinLatido: number }).__epaInformeSinLatido = 6000));
    await page.goto('/#/cap05');
    await expect(page.locator('#contenido .cargando')).toHaveCount(0);
    await page.evaluate(() => (location.hash = '#/consolas/nes/placa3d'));
    await expect.poll(async () => (await sesiones(page)).flatMap((s) => s.m ?? []).length, { timeout: 15_000 }).toBeGreaterThan(1);
    const m = (await sesiones(page)).flatMap((s) => s.m ?? []);
    // «20:29:55 montón 85 MB · 1234 nodos · 3 lienzos 2,1 Mpx · WebGL 1»
    expect(m.at(-1)).toMatch(/^\d\d:\d\d:\d\d montón \d+ MB · \d+ nodos · \d+ lienzos? [\d,]+ Mpx · WebGL \d+/);
    await expect.poll(async () => (await sesiones(page)).flatMap((s) => s.m ?? []).at(-1) ?? '', { timeout: 30_000 }).toMatch(/WebGL [1-9]/);
  });
});

// The monkey's long run on the phone (seed 9000, step 620) found the page of a concept animation wider than the
// screen: in «En el libro», each link is a flex item of a wrapping list that could not shrink below its title (kept on
// one line up to 26em), so a long title («23.2 La Señal Senoidal: Valores Eficaces…») stuck out by 16 px and the phone
// showed the whole page zoomed out.
test('animaciones: los enlaces «En el libro» caben en un teléfono de 412 px', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const h of ['#/conceptos/fasores', '#/componentes/led']) {
    await page.goto(`/${h}`);
    await expect(page.locator('.libro a').first()).toBeVisible();
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth, enlaces: Math.max(...[...document.querySelectorAll('.libro a')].map((a) => a.getBoundingClientRect().right)) }));
    expect(m, h).toEqual({ inner: 412, scroll: 412, enlaces: expect.any(Number) });
    expect(m.enlaces, h).toBeLessThanOrEqual(412);
  }
  await ctx.close();
});

// The route sweep (tests/monos/barrido.spec.ts, phone, dark theme) with axe: the FM7303 faults panel's main buttons
// kept white text on the accent, which the dark theme makes light (#8aaaff): contrast 2,26:1.
test('FM7303 · averías: los botones principales se leen en el tema oscuro (contraste ≥ 4,5:1)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, colorScheme: 'dark' });
  await ctx.addInitScript(() => localStorage.setItem('epa:prefs', JSON.stringify({ tema: 'oscuro' })));
  const page = await ctx.newPage();
  await page.goto('/#/fm7303/averias');
  const boton = page.getByRole('button', { name: 'Caso al azar' });
  await expect(boton).toBeVisible();
  const contraste = await boton.evaluate((b) => {
    const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (x: number) => ((x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const cs = getComputedStyle(b);
    const [a, c] = [lum(rgb(cs.color)), lum(rgb(cs.backgroundColor))];
    return (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
  });
  expect(contraste).toBeGreaterThanOrEqual(4.5);
  await ctx.close();
});
