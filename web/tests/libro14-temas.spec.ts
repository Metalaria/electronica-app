// 1.4 (libro14): in the sepia theme the empty part of the browser's own sliders (input type=range: the text size in
// «Aa», the calculators' and the simulator's parameters, the lessons' native sliders…) was the light theme's white-grey
// track, a white bar on the warm page. Now it takes the theme's tone. The dark theme keeps its dark track. Measured on
// the pixels the browser paints (the track is drawn by the browser, it has no computed style).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.libro14.config.ts tests/libro14-temas.spec.ts
import { expect, test, type Browser, type Page } from '@playwright/test';

type RGB = [number, number, number];

async function telefono(browser: Browser, tema: string): Promise<Page> {
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: tema === 'oscuro' ? 'dark' : 'light',
  });
  await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await ctx.addInitScript((t) => {
    localStorage.setItem('epa:prefs', JSON.stringify({ tema: t }));
    localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
  }, tema);
  const page = await ctx.newPage();
  await page.goto('#/inicio');
  return page;
}

/** The colour of one CSS pixel of the page as painted (from a screenshot, decoded by the page itself). */
async function pixel(page: Page, x: number, y: number): Promise<RGB> {
  const png = await page.screenshot({ clip: { x: Math.round(x) - 1, y: Math.round(y) - 1, width: 3, height: 3 } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1).data;
    return [d[0]!, d[1]!, d[2]!] as RGB;
  }, png.toString('base64'));
}

const lum = (c: RGB) => {
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};

/** The empty part of the «Aa» text-size slider (its right end: the size is below the middle) and the panel behind it. */
async function pistaDeAa(page: Page): Promise<{ pista: RGB; fondo: RGB }> {
  await page.getByRole('button', { name: 'Tema y tamaño de letra' }).first().click();
  const r = page.getByRole('slider', { name: 'Tamaño del texto en píxeles' });
  await r.waitFor();
  await r.evaluate((el: HTMLInputElement) => {
    el.blur();
  });
  const b = (await r.boundingBox())!;
  const pista = await pixel(page, b.x + b.width - 14, b.y + b.height / 2);
  const fondo = await pixel(page, b.x + b.width - 14, b.y - 10);
  return { pista, fondo };
}

test('sepia: la pista vacía del deslizador tiene el tono del tema, no el blanco del tema claro', async ({ browser }) => {
  const page = await telefono(browser, 'sepia');
  const { pista, fondo } = await pistaDeAa(page);
  // warm like the page (red above blue), and not lighter than the panel it sits on
  expect(pista[0] - pista[2], `pista rgb(${pista.join(', ')}) sobre rgb(${fondo.join(', ')})`).toBeGreaterThanOrEqual(8);
  expect(lum(pista)).toBeLessThanOrEqual(lum(fondo) + 0.005);
  await page.context().close();
});

test('oscuro: la pista vacía del deslizador sigue siendo oscura', async ({ browser }) => {
  const page = await telefono(browser, 'oscuro');
  const { pista } = await pistaDeAa(page);
  expect(lum(pista), `pista rgb(${pista.join(', ')})`).toBeLessThan(0.15);
  await page.context().close();
});
