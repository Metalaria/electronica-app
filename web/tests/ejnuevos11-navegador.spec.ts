// 1.1 new exercises not in the book yet, in the browser (short on purpose): at the end of chapter 25 the block of new
// exercises with its «Aún no en el libro» mark (also in the «Ejercicios» page), a numeric answer accepted, a design
// problem checked by simulating it with the app's ngspice (a wrong design first, with its hint, then a valid one), and
// axe (contrast included) on the block in the light and dark themes.
// 1.2 (motor12b): book 4.0/4.1 prints them with the same labels, so they are the book's own exercises block of the
// chapter and nothing says «Aún no en el libro» (tests/ejnuevos11-unidad.spec.ts, the data); the rest, as before.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.ejnuevos11.config.ts tests/ejnuevos11-navegador.spec.ts
import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

async function limpio(page: Page, tema: 'claro' | 'oscuro'): Promise<void> {
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

async function axe(page: Page, sel: string): Promise<string[]> {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async (s) => {
    const a = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
    const r = await a.run({ include: [[s]] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] });
    return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  }, sel);
}

test('capítulo 24: los ejercicios de la 1.1, ya del libro y sin marca; una respuesta aceptada y un diseño comprobado simulándolo; axe en claro y oscuro', async ({ browser }) => {
  test.setTimeout(150_000);
  for (const tema of ['claro', 'oscuro'] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    await limpio(page, tema);
    // the anchor of the exercise (as the search and «Abrir en el capítulo» link it) brings it into view, in the book's
    // own block of the chapter, without the 1.1 mark
    await page.goto('#/cap25/ej-25.1');
    const bloque = page.locator('.ejercicios:has([id="ej-25.1"])');
    await expect(bloque).toBeVisible();
    await expect(page.locator('[data-nuevos], [data-nuevo]')).toHaveCount(0);
    await expect(page.getByText('Aún no en el libro')).toHaveCount(0);
    await expect(bloque.locator('.ejercicio')).toHaveCount(11);
    await expect(page.locator('[id="ej-25.1"]')).toBeInViewport();
    await expect(bloque.locator('.ejercicio-num').first()).toHaveText('Ejercicio 24.1.');
    if (tema === 'claro') {
      // a numeric answer, typed as on paper
      const p = panel(page, 'ej-25.1');
      await p.locator('#cmp-ej-25_1-r1').fill('37 dB');
      await p.locator('#cmp-ej-25_1-r2').fill('-3 dBm');
      await p.locator('#cmp-ej-25_1-r3').fill('70,8');
      await p.getByRole('button', { name: 'Comprobar' }).click();
      await expect(p.locator('.fb-bien')).toHaveCount(3);
      // the design problem: a wrong design is simulated and told what to change, then a valid one is accepted
      const d = panel(page, 'ej-25.9');
      await d.scrollIntoViewIfNeeded();
      await d.locator('[data-componente="R"]').fill('1,5 k');
      await d.locator('[data-componente="C"]').fill('100 n');
      await d.getByRole('button', { name: 'Comprobar' }).click();
      await expect(d.locator('.preg[data-tipo="diseno"] .fb-mal')).toContainText('para bajarla, aumente R o C', { timeout: 90_000 });
      await expect(d.locator('[data-medido]')).toContainText('1,06');
      await d.locator('[data-componente="R"]').fill('3,3 k');
      await d.locator('[data-componente="C"]').fill('47 n');
      await d.getByRole('button', { name: 'Comprobar' }).click();
      await expect(d.locator('.preg[data-tipo="diseno"] .fb-bien')).toContainText('Correcto: simulado', { timeout: 60_000 });
      await expect(d.locator('[data-medido]')).toContainText('1,03');
      await expect(d.locator('.desarrollo')).toContainText('Desarrollo');
      // the «Ejercicios» page lists them as the book's, without the mark
      await page.goto('#/ejercicios');
      await page.getByRole('button', { name: /Capítulo 24/ }).click();
      await expect(page.locator('.pagina-ej li .fila').first()).toBeVisible();
      await expect(page.locator('.pagina-ej [data-nuevo]')).toHaveCount(0);
      await page.goto('#/cap25/ej-25.9');
      await expect(bloque).toBeVisible();
    }
    expect(await axe(page, '.ejercicios:has([id="ej-25.1"])'), tema).toEqual([]);
    await ctx.close();
  }
});
