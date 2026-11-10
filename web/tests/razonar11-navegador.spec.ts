// 1.1 «razonar» in the browser: a self-assessed exercise of 1.0 turned into choices (ej-4.8) is solved with the keyboard
// only — a wrong pick shows «Por qué no …» with the curated explanation, the right ones «Del libro» — and gives the XP
// of the self-checked rules; a self-assessed problem answered «Sí» with its solution on show (as problems open) gives
// none (regression: it used to give 15 XP without `verSolucion`); axe (contrast included) in light and dark, 360 px.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.razonar11.config.ts tests/razonar11-navegador.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { axe as axeComun } from './accesibilidad10-comun';

async function limpio(page: Page, tema: 'claro' | 'oscuro' = 'claro'): Promise<void> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript((t) => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 }));
    }
  }, tema);
}
const panel = (page: Page, label: string) => page.locator(`.comprobador[data-label="${label}"]`);
const xp = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('epa:progreso-xp') ?? '{}').xp ?? {}) as Record<string, { x: number }>);

/** axe (WCAG 2.2 AA, contrast included) on one panel, with the shared filter of targets only covered by the fixed bars. */
async function axe(page: Page, sel: string): Promise<string[]> {
  const out: string[] = [];
  for (const v of await axeComun(page, sel))
    for (const n of v.nodos) {
      // a tall panel on a phone: a target scrolled under the fixed top bar has «too little space» around it; measured
      // again with that target in the middle of the view
      if (v.regla === 'target-size') {
        await page.locator(n.sel).evaluate((el) => el.scrollIntoView({ block: 'center' }));
        if (!(await axeComun(page, n.sel)).some((o) => o.regla === 'target-size')) continue;
      }
      out.push(`${v.regla}: ${n.sel} ${n.resumen}`);
    }
  return out;
}

test('ej-4.8 se resuelve solo con el teclado: «Por qué no» de la opción elegida, «Del libro» al acertar y los XP de un autocomprobable', async ({ page }) => {
  await limpio(page);
  await page.goto('#/cap04/ej-4.8');
  const p = panel(page, 'ej-4.8');
  await expect(p).toBeVisible();
  // no self-assessment any more: two questions and «Comprobar»
  await expect(p.getByRole('group', { name: 'Autoevaluación' })).toHaveCount(0);
  await expect(p.locator('.preg')).toHaveCount(2);
  const g1 = p.locator('.preg').nth(0);
  const g2 = p.locator('.preg').nth(1);
  // first question, shown order: «Se desploma» (right), «Aumenta…», «Se mantiene…»; second: «Se queda en 2 A…»,
  // «Baja…», «Sube de golpe…» (right). Into the first group with the keyboard, then arrows only
  await g1.locator('input[type=radio]').first().focus();
  await page.keyboard.press('ArrowDown'); // «Aumenta…»: wrong
  await expect(g1.locator('input[type=radio]').nth(1)).toBeChecked();
  await page.keyboard.press('Tab'); // into the second group
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown'); // «Sube de golpe…»: right
  await expect(g2.locator('input[type=radio]').nth(2)).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(p.getByRole('button', { name: 'Comprobar' })).toBeFocused();
  await page.keyboard.press('Enter');
  // the wrong pick: why not, in the curated words taken from the book's solution
  const porque = g1.locator('.porque');
  await expect(porque).toContainText('Por qué no «Aumenta, porque hay más corriente y más flujo»');
  await expect(porque).toContainText('Saturado, el flujo deja de crecer con la corriente');
  await expect(g2.locator('.fb-bien')).toBeVisible();
  expect((await xp(page))['e:ej-4.8']).toBeUndefined();
  // back to the first group (Shift+Tab from the button through the second group), the right option, check again
  await p.getByRole('button', { name: 'Comprobar' }).focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(g1.locator('input[type=radio]').nth(1)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(g1.locator('input[type=radio]').nth(0)).toBeChecked();
  await p.getByRole('button', { name: 'Comprobar' }).focus();
  await page.keyboard.press('Enter');
  await expect(g1.locator('.desarrollo')).toContainText('Del libro');
  await expect(g1.locator('.desarrollo')).toContainText('Al saturar, la inductancia se desploma');
  await expect(p.locator('.estado')).toContainText(/Resuelto/);
  // the self-checked rules: solved after a failed check, no solution opened → «con ayuda» XP (8), not 0
  await expect.poll(async () => (await xp(page))['e:ej-4.8']?.x ?? null, { timeout: 5000 }).toBe(8);
  const guardado = () => page.evaluate(() => JSON.parse(localStorage.getItem('epa:ejercicios') ?? '{}')['ej-4.8'] ?? null);
  await expect.poll(async () => (await guardado())?.resuelto ?? null, { timeout: 5000 }).toBe(true);
  const e = await guardado();
  expect([e.resuelto, e.solucion, e.intentos, e.fallos]).toEqual([true, false, 2, 1]);
  expect([e.valores.p1, e.valores.p2]).toEqual(['0', '2']);
  expect(await axe(page, '.comprobador[data-label="ej-4.8"]')).toEqual([]);
});

test('regresión: un problema autoevaluado con la solución a la vista no da XP al decir «Sí» (cuenta como solución vista)', async ({ browser }) => {
  // prob-11.B as 1.0 had it (self-assessed): problems show the book's analysis unless hidden, so «¿Lo tenía bien?»
  // is there without «Ver solución»; the award used to be 15 XP because `solucion` stayed false
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1366, height: 900 } });
  await ctx.route('**/libro/ejercicios.json*', async (r) => {
    const res = await r.fetch();
    const d = await res.json();
    const it = d.items['prob-11.B'];
    it.modo = 'comparar';
    it.clase = 'razonamiento';
    delete it.preguntas;
    it.otras = [{ clase: 'razonamiento', texto: 'comparar ambos métodos, identificar el riesgo de cada uno y establecer una regla' }];
    await r.fulfill({ response: res, json: d });
  });
  const page = await ctx.newPage();
  await limpio(page);
  await page.goto('#/cap11/prob-11.B');
  const p = panel(page, 'prob-11.B');
  await expect(p).toBeVisible();
  const auto = p.getByRole('group', { name: 'Autoevaluación' });
  await expect(auto).toBeVisible();
  await auto.getByRole('button', { name: 'Sí' }).click();
  await expect(p.locator('.estado')).toContainText('Autoevaluado: lo tenía bien');
  // give a possible award time to land, then: none (before the fix, 15)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('epa:ejercicios') ?? '{}')['prob-11.B']?.resuelto ?? null)).toBe(true);
  await page.waitForTimeout(400);
  expect((await xp(page))['e:prob-11.B']?.x ?? 0).toBe(0);
  // stored as a solution seen, so no later reconciliation awards it either
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('epa:ejercicios') ?? '{}')['prob-11.B']?.solucion ?? null)).toBe(true);
  await ctx.close();
});

test('teléfono de 360 px en oscuro: 44 px, sin desbordar y axe con «Por qué no» y el desarrollo a la vista', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await limpio(page, 'oscuro');
  for (const label of ['ej-4.8', 'prob-11.B'] as const) {
    await page.goto(label === 'ej-4.8' ? '#/cap04/ej-4.8' : '#/cap11/prob-11.B');
    const p = panel(page, label);
    await expect(p).toBeVisible();
    await p.scrollIntoViewIfNeeded();
    // a wrong pick in every choice question, checked once: «Por qué no» on show
    for (const g of await p.locator('.preg').all()) {
      const radios = g.locator('input[type=radio]');
      if ((await radios.count()) && !(await g.locator('.clasificar').count())) await radios.last().check();
    }
    await p.getByRole('button', { name: 'Comprobar' }).click();
    await expect(p.locator('.porque').first()).toBeVisible();
    const pequenos = await p.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>('.preg label.opcion, .preg label.chip, .preg button, button')]
        .filter((x) => x.offsetParent)
        .map((x) => ({ n: (x.textContent || x.tagName).trim().slice(0, 30), r: x.getBoundingClientRect() }))
        .filter((x) => x.r.height < 44 || x.r.width < 44)
        .map((x) => `${x.n} ${Math.round(x.r.width)}×${Math.round(x.r.height)}`),
    );
    expect(pequenos, label).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), label).toBeLessThanOrEqual(0);
    expect(await axe(page, `.comprobador[data-label="${label}"]`), label).toEqual([]);
    // a second failed check settles the questions: the answer and «Del libro»
    await p.getByRole('button', { name: 'Comprobar' }).click();
    await expect(p.locator('.desarrollo').first()).toBeVisible();
    expect(await axe(page, `.comprobador[data-label="${label}"]`), `${label} resuelta`).toEqual([]);
  }
  await ctx.close();
});
