// 2.0 (cierre20): the phone's bottom tab bar hides while a text box has the focus (the keyboard is up) and comes
// back when the box loses it. A tap on a control lying where the bar would be (the «Decodificar» button of a
// console's «Arquitectura» right after typing an address) blurred the box on its mousedown, the bar came back
// at once, and the tap's mouseup and click landed on the bar: the control never got its click. The bar now stays
// hidden until that tap is over.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test tests/pestanas20-tactil.spec.ts
import { expect, test, type Page } from '@playwright/test';

const TELEFONO = { viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, hasTouch: true, isMobile: true };

function errores(page: Page): string[] {
  const err: string[] = [];
  page.on('pageerror', (e) => err.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') err.push(m.text());
  });
  return err;
}

/** Scrolls the page (or the element's scrolling ancestor) so the centre of `sel` sits `desdeAbajo` px above the
 *  bottom of the viewport, and returns that centre in viewport coordinates. */
async function llevarAbajo(page: Page, sel: string, desdeAbajo: number): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ([s, d]) => {
      const el = document.querySelector(s as string) as HTMLElement;
      let p: HTMLElement | null = el.parentElement;
      while (p && !(p.scrollHeight > p.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
      const scroller = p ?? (document.scrollingElement as HTMLElement);
      // room to scroll the control that far down, whatever the page's length
      const relleno = document.createElement('div');
      relleno.style.height = '2000px';
      relleno.dataset.relleno20 = '';
      el.closest('form')?.parentElement?.prepend(relleno);
      const r0 = el.getBoundingClientRect();
      scroller.scrollTop += r0.top + r0.height / 2 - (innerHeight - (d as number));
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    },
    [sel, desdeAbajo] as const,
  );
}

test('teléfono: un toque donde estaría la barra de pestañas, justo tras escribir, llega al control y no a la barra', async ({ browser }) => {
  const ctx = await browser.newContext(TELEFONO);
  const page = await ctx.newPage();
  const err = errores(page);
  await page.goto('#/consolas/saturn/arquitectura');
  const barra = page.getByRole('navigation', { name: 'Secciones de la aplicación' });
  await expect(barra).toBeVisible();
  const caja = page.getByRole('textbox', { name: 'Dirección en hexadecimal' });
  await caja.tap();
  await expect(caja).toBeFocused();
  // the keyboard is up: no bar
  await expect(barra).toBeHidden();
  await caja.pressSequentially('25E00000');
  // the button in the middle of the 64 px band the bar takes when it is shown
  const p = await llevarAbajo(page, '.decodificador button[type="submit"]', 32);
  expect(p.y).toBeGreaterThan(915 - 64);
  const ruta = await page.evaluate(() => location.hash);
  await page.touchscreen.tap(p.x, p.y);
  await expect(page.locator('.resultado')).toHaveAttribute('data-seleccion', '/CS2 → /BCS2');
  expect(await page.evaluate(() => location.hash)).toBe(ruta);
  // once the tap is over, the bar is back
  await expect(barra).toBeVisible();
  expect(err).toEqual([]);
  await ctx.close();
});

test('teléfono: la barra vuelve al perder el foco el campo (sin toque, o con un toque fuera de la barra) y responde a sus toques', async ({ browser }) => {
  const ctx = await browser.newContext(TELEFONO);
  const page = await ctx.newPage();
  await page.goto('#/consolas/saturn/arquitectura');
  const barra = page.getByRole('navigation', { name: 'Secciones de la aplicación' });
  const caja = page.getByRole('textbox', { name: 'Dirección en hexadecimal' });
  await caja.tap();
  await expect(barra).toBeHidden();
  await caja.evaluate((e: HTMLElement) => e.blur());
  await expect(barra).toBeVisible();
  // a tap on a plain area away from the bar blurs the box and brings the bar back
  await caja.tap();
  await expect(barra).toBeHidden();
  await page.touchscreen.tap(206, 200);
  await expect(barra).toBeVisible({ timeout: 3000 });
  // and a tap on the bar itself, with no text box focused, still works
  await page.getByRole('navigation', { name: 'Secciones de la aplicación' }).locator('[data-herramienta="inicio"]').tap();
  await expect.poll(() => page.evaluate(() => location.hash)).not.toContain('consolas');
  await ctx.close();
});
