// 2.1 (owner's item 10): «Novedades de la 2.1» — shown once on a device an earlier version used (the data's seal says
// 2.0 or older, and there is some progress or preference), never on a fresh install, never over a lesson; a non-modal
// dialog that takes the focus, closed with «Entendido» or Esc for good (the device-local key epa:novedades-21, outside
// the synchronised data).
import { expect, test, type Browser, type Page } from '@playwright/test';
import { ESQUEMAS } from '../src/lib/esquemas';

const CLAVE = 'epa:novedades-21';

/** A device a 2.0 app used: its seal and some reading progress (once per context: reloads keep what the app wrote). */
async function usado(page: Page, app = '2.0.0', tema = 'oscuro'): Promise<void> {
  await page.addInitScript(
    ({ app, almacenes, tema }) => {
      if (sessionStorage.getItem('sembrado21')) return;
      sessionStorage.setItem('sembrado21', '1');
      localStorage.setItem('epa:esquemas', JSON.stringify({ formato: 'epa-esquemas', app, almacenes }));
      localStorage.setItem('epa:prefs', JSON.stringify({ tema, tam: 18 }));
      localStorage.setItem('epa:leidas', JSON.stringify({ cap05: { 'sec-5.1': Date.now() - 1000 } }));
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
    },
    { app, almacenes: ESQUEMAS, tema },
  );
}

const nota = (page: Page) => page.getByRole('dialog', { name: 'La 2.1 ordena la aplicación' });

test('instalación nueva: no aparece, y queda marcada para no aparecer después', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('#/');
  await expect(page.locator('nav.carril')).toBeVisible();
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), CLAVE)).toBe('1');
  await expect(nota(page)).toHaveCount(0);
  // the reader reads a little: on the next start it still does not appear
  await page.goto('#/cap05');
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.locator('nav.carril')).toBeVisible();
  await page.waitForTimeout(800);
  await expect(nota(page)).toHaveCount(0);
});

test('un dispositivo de la 2.0: aparece una vez, con el foco, y Esc la cierra para siempre', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await usado(page);
  await page.goto('#/');
  const n = nota(page);
  await expect(n).toBeVisible();
  // a screen reader gets its title and its text: the dialog has the focus, a name and a description
  await expect(n).toBeFocused();
  await expect(n).toHaveAttribute('aria-describedby', 'novedades21-texto');
  await expect(n).toContainText('Cinco grupos');
  await expect(n).toContainText('al pie de «Aa»');
  await expect(n).toContainText('Buscar');
  await expect(n).toContainText('recuerda la última pestaña');
  // not modal: the page stays usable behind it
  await expect(n).toHaveAttribute('aria-modal', 'false');
  // the keyboard reaches its buttons
  await page.keyboard.press('Tab');
  await expect(n.getByRole('button', { name: 'Entendido' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(n).toHaveCount(0);
  // the focus goes to the page, not to <body>
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('main'))).toBe(true);
  expect(await page.evaluate((k) => localStorage.getItem(k), CLAVE)).toBe('1');
  await page.reload();
  await expect(page.locator('nav.carril')).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(nota(page)).toHaveCount(0);
});

test('«Entendido» la cierra; «Ver la guía» lleva a la navegación de la guía; nada entra en los datos sincronizados', async ({ browser }) => {
  for (const boton of ['Entendido', 'Ver la guía'] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    await usado(page, '2.0.0', 'sepia');
    await page.goto('#/');
    await expect(nota(page)).toBeVisible();
    if (boton === 'Entendido') await nota(page).getByRole('button', { name: 'Entendido' }).click();
    else {
      await nota(page).getByRole('link', { name: 'Ver la guía' }).click();
      await expect(page).toHaveURL(/#\/guia\/primeros-pasos\/navegar$/);
    }
    await expect(nota(page)).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), CLAVE)).toBe('1');
    // the mark is not a store of the app's data: not in the seal's list
    const sello = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:esquemas') ?? '{}'));
    expect(Object.keys(sello.almacenes ?? {})).not.toContain('novedades-21');
    await ctx.close();
  }
});

test('datos ya de la 2.1, o de la 2.0 sin nada del lector: no aparece', async ({ browser }) => {
  for (const caso of ['2.1', 'vacio'] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    if (caso === '2.1') await usado(page, '2.1.0');
    else {
      await page.addInitScript((almacenes) => {
        if (sessionStorage.getItem('sembrado21')) return;
        sessionStorage.setItem('sembrado21', '1');
        localStorage.setItem('epa:esquemas', JSON.stringify({ formato: 'epa-esquemas', app: '2.0.0', almacenes }));
      }, ESQUEMAS);
    }
    await page.goto('#/');
    await expect(page.locator('nav.carril')).toBeVisible();
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), CLAVE)).toBe('1');
    await expect(nota(page), caso).toHaveCount(0);
    await ctx.close();
  }
});

async function telefono(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true });
  return { ctx, page: await ctx.newPage() };
}

test('nunca encima de una lección: espera a que termine; en el teléfono, sobre la barra de abajo', async ({ browser }) => {
  const { ctx, page } = await telefono(browser);
  await usado(page);
  await page.goto('#/leccion/cap01/sec-1.4');
  await expect(page.locator('main h1, main [data-paso], main .leccion').first()).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1000);
  await expect(nota(page)).toHaveCount(0);
  // out of the lesson: it appears, above the bottom bar, inside the screen
  await page.evaluate(() => (location.hash = '#/'));
  const n = nota(page);
  await expect(n).toBeVisible();
  const caja = (await n.boundingBox())!;
  const barra = (await page.locator('nav.pestanas[aria-label="Secciones de la aplicación"]').boundingBox())!;
  expect(caja.y + caja.height).toBeLessThanOrEqual(barra.y);
  expect(caja.x).toBeGreaterThanOrEqual(0);
  expect(caja.x + caja.width).toBeLessThanOrEqual(412);
  for (const b of await n.locator('a, button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await n.getByRole('button', { name: 'Entendido' }).tap();
  await expect(n).toHaveCount(0);
  await ctx.close();
});

test('axe (contraste incluido) en la nota, en claro, sepia y oscuro', async ({ browser }) => {
  const { axe, sinHallazgos } = await import('./accesibilidad10-comun');
  for (const tema of ['claro', 'sepia', 'oscuro']) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    await usado(page, '2.0.0', tema);
    await page.goto('#/');
    await expect(nota(page)).toBeVisible();
    await page.waitForTimeout(400);
    sinHallazgos(await axe(page, '[data-novedades21]'), `novedades · ${tema}`);
    await ctx.close();
  }
});
