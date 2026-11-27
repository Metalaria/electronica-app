// 1.4 (libro14): on the phone the console's 3D board ran under the bottom tab bar (at the top of the page the canvas
// ended 180 px below the bar's top edge), so a tap near the board's bottom edge landed on «Inicio». Now the view is
// brought up to end above the bar when it opens. Tablet and desktop keep their layout (no scroll, same height).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.libro14.config.ts tests/libro14-placa3d.spec.ts
import { expect, test, type Browser, type Page } from '@playwright/test';

interface Medidas {
  canvas: { top: number; bottom: number; left: number; width: number; height: number } | null;
  barra: { top: number; display: string } | null;
  vistaTop: number;
  scrollY: number;
  alto: number;
}

async function abrir(browser: Browser, ancho: number, alto: number, movil: boolean): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: ancho, height: alto },
    deviceScaleFactor: movil ? 3.5 : 1,
    isMobile: movil,
    hasTouch: movil,
  });
  await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await ctx.addInitScript(() => {
    localStorage.setItem('epa:prefs', JSON.stringify({ tema: 'oscuro' }));
    localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
  });
  const page = await ctx.newPage();
  await page.goto('#/consolas/nes/placa3d');
  await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo === true, null, {
    timeout: 180_000,
  });
  await page.locator('.placa-consola canvas').first().waitFor();
  // (let a scroll triggered by the opening settle)
  await page.waitForTimeout(400);
  return page;
}

function medir(page: Page): Promise<Medidas> {
  return page.evaluate(() => {
    const c = document.querySelector('.placa-consola .vista canvas');
    // (2.2: the side rail has the same name; the bottom bar is nav.pestanas)
    const n = document.querySelector('nav.pestanas[aria-label="Secciones de la aplicación"]');
    const v = document.querySelector('.placa-consola .vista');
    const rc = c?.getBoundingClientRect();
    const rn = n?.getBoundingClientRect();
    return {
      canvas: rc ? { top: rc.top, bottom: rc.bottom, left: rc.left, width: rc.width, height: rc.height } : null,
      barra: rn && n ? { top: rn.top, display: getComputedStyle(n).display } : null,
      vistaTop: v?.getBoundingClientRect().top ?? 0,
      scrollY: window.scrollY,
      alto: window.innerHeight,
    };
  });
}

test('teléfono: la placa 3D termina encima de la barra de pestañas y su borde de abajo no lleva a Inicio', async ({ browser }) => {
  const page = await abrir(browser, 412, 915, true);
  const m = await medir(page);
  expect(m.canvas, 'hay lienzo 3D').not.toBeNull();
  expect(m.barra?.display, 'la barra de pestañas se ve').toBe('flex');
  const c = m.canvas!;
  const barraTop = m.barra!.top;
  expect(c.bottom, `el lienzo acaba en ${c.bottom} y la barra empieza en ${barraTop}`).toBeLessThanOrEqual(barraTop);
  // the whole view (its buttons on top) stays below the app's top bar (56 px)
  expect(m.vistaTop).toBeGreaterThanOrEqual(56);
  // what is under a finger 6 px above the canvas' bottom edge is the canvas, and tapping there keeps the page
  const x = c.left + c.width * 0.15;
  const y = c.bottom - 6;
  const debajo = await page.evaluate(([px, py]) => document.elementFromPoint(px!, py!)?.tagName ?? '', [x, y]);
  expect(debajo).toBe('CANVAS');
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(300);
  expect(new URL(page.url()).hash).toBe('#/consolas/nes/placa3d');
  await page.context().close();
});

test('tableta y escritorio: la placa 3D no se mueve ni cambia de tamaño', async ({ browser }) => {
  // (measured before the change: tablet 800×1280, canvas 572 px high ending at 1082, bar at 1216; desktop 1366×900,
  // canvas 464 px high; neither scrolls. 2.2: at 800 px the bottom bar became the 80 px side rail, so the page is
  // 720 px wide and the canvas, which keeps its proportions, 560 px high)
  for (const [ancho, alto, movil, altoLienzo] of [
    [800, 1280, true, 560],
    [1366, 900, false, 464],
  ] as const) {
    const page = await abrir(browser, ancho, alto, movil);
    const m = await medir(page);
    expect(m.scrollY, `${ancho}×${alto}: sin desplazar la página`).toBe(0);
    expect(Math.abs(m.canvas!.height - altoLienzo), `${ancho}×${alto}: alto del lienzo ${m.canvas!.height}`).toBeLessThan(2);
    if (m.barra && m.barra.display !== 'none' && movil) expect(m.canvas!.bottom).toBeLessThanOrEqual(m.barra.top);
    await page.context().close();
  }
});
