// 1.1 errata of the exercise solutions, in the browser: the notice that the book's printed value differs (1.B, 3.B)
// and the datum the book's solution uses (5.B, 35.B) are shown by the problem's panel, with the solution hidden and
// shown; the corrected value is accepted and the book's is not; axe (contrast included) in light, sepia and dark.
// The 34 data lines (`dato:`) of the exercises whose statement leaves out a datum: each one in its panel, as published.
// 1.2 (motor12b): book 4.0/4.1 fixed both errata in its solutions and writes those data in its statements, so the
// app's notices and 33 of the 34 data lines are gone (tests/erratas11-unidad.spec.ts, the data). Ported: no notice,
// the book's solution says the corrected value (hidden and shown with the solution), the corrected value accepted and
// the old printed one not; 5.B and 35.B carry the datum in their statement, before «Se pide»; the one data line left
// (45.A, the I²C norm's 3 mA at 0,4 V) in its panel, also with the solution hidden; axe in the three themes.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.erratas11.config.ts tests/erratas11-navegador.spec.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

async function limpio(page: Page, tema: 'claro' | 'sepia' | 'oscuro' = 'claro'): Promise<void> {
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
const campo = (page: Page, label: string, r: string) => page.locator(`#cmp-${label.replace(/[^\w-]/g, '_')}-${r}`);

test('1.B y 3.B: el libro ya da el valor corregido (sin aviso), que se acepta, y no el de antes, con la solución oculta o a la vista', async ({ page }) => {
  await limpio(page);
  await page.goto('#/cap01/prob-1.B');
  const p = panel(page, 'prob-1.B');
  await expect(p).toBeVisible();
  await expect(page.locator('[data-errata]')).toHaveCount(0);
  const solucion = page.getByText('pérdida 1,33 W con el cable a 60 °C');
  await expect(solucion).toBeVisible();
  await p.getByRole('button', { name: 'Ocultar solución' }).click();
  await expect(solucion).toBeHidden();
  await campo(page, 'prob-1.B', 'r3').fill('1,15 W');
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await expect(p.locator('[data-r="r3"] .fb-bien')).toHaveCount(0);
  await campo(page, 'prob-1.B', 'r3').fill('1,33 W');
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await expect(p.locator('[data-r="r3"] .fb-bien')).toContainText('con 6 mm² a 60 °C');
  await p.getByRole('button', { name: 'Ver solución' }).click();
  await expect(solucion).toBeVisible();

  await page.goto('#/cap03/prob-3.B');
  const q = panel(page, 'prob-3.B');
  await expect(q.locator('label[for$="-r5"]')).toHaveText('Corriente eficaz por diodo');
  await expect(page.locator('[data-errata]')).toHaveCount(0);
  await expect(page.getByText('por cada diodo pasan 1,68/√2 = 1,19 A eficaces')).toBeVisible();
  await campo(page, 'prob-3.B', 'r5').fill('1,68 A');
  await q.getByRole('button', { name: 'Comprobar' }).click();
  await expect(q.locator('[data-r="r5"] .fb-bien')).toHaveCount(0);
  await campo(page, 'prob-3.B', 'r5').fill('1,19 A');
  await q.getByRole('button', { name: 'Comprobar' }).click();
  await expect(q.locator('[data-r="r5"] .fb-bien')).toBeVisible();
});

test('5.B y 35.B: el dato que usa la solución del libro, ya en su enunciado, antes de «Se pide»; axe en los tres temas', async ({ browser }) => {
  for (const tema of ['claro', 'sepia', 'oscuro'] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    await limpio(page, tema);
    for (const [ruta, label, dato] of [
      ['#/cap05/prob-5.B', 'prob-5.B', 'El transformador tiene 0,4 Ω de resistencia de devanado'],
      ['#/cap36/prob-36.B', 'prob-36.B', 'El enlace trabaja a 2,4 GHz'],
    ] as const) {
      await page.goto(ruta);
      const p = panel(page, label);
      await expect(p).toBeVisible();
      // no data line of the app: the book's statement says it, before its «Se pide» paragraph and the fields
      await expect(p.locator('[data-dato]')).toHaveCount(0);
      const sePide = p.locator('xpath=preceding::p[starts-with(normalize-space(.), "Se pide")][1]');
      await expect(sePide).toContainText(label === 'prob-5.B' ? 'calcular las corrientes media' : 'calcular el alcance en espacio libre');
      const d = sePide.locator(`xpath=preceding::p[contains(normalize-space(.), "${dato}")][1]`);
      await expect(d).toBeVisible();
      const yDato = (await d.boundingBox())!.y;
      const yPide = (await sePide.boundingBox())!.y;
      const yCampo = (await campo(page, label, 'r1').boundingBox())!.y;
      expect(yDato).toBeLessThan(yPide);
      expect(yPide).toBeLessThan(yCampo);
      await p.getByRole('button', { name: 'Ocultar solución' }).click();
      await expect(d).toBeVisible();
      await page.addScriptTag({ path: AXE });
      const v = await page.evaluate(async (sel) => {
        const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
        const r = await axe.run({ include: [[sel]] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
        return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      }, `.comprobador[data-label="${label}"]`);
      expect(v, `${tema} ${label}`).toEqual([]);
      await p.getByRole('button', { name: 'Ver solución' }).click();
    }
    await ctx.close();
  }
});

test('el dato que queda (45.A) se ve en su panel, también con la solución oculta', async ({ page }) => {
  test.setTimeout(300_000);
  const datos = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'libro', 'ejercicios.json'), 'utf8')) as {
    items: Record<string, { parte: string; tipo: string; dato?: string }>;
  };
  const conDato = Object.entries(datos.items).filter(([, x]) => x.dato);
  expect(conDato.map(([l]) => l)).toEqual(['prob-44.A']);
  const plano = (h: string) => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  await limpio(page);
  for (const [label, x] of conDato) {
    await page.goto(`#/${x.parte}/${label}`);
    const p = panel(page, label);
    await expect(p, label).toBeVisible();
    const d = p.locator('[data-dato]');
    await expect(d, label).toHaveText(`Dato que usa la solución del libro: ${plano(x.dato!)}`, { normalizeWhitespace: true });
    // it stays in view when the book's analysis is hidden (problems only)
    if (x.tipo === 'prob') {
      const ocultar = p.getByRole('button', { name: 'Ocultar solución' });
      if (await ocultar.isVisible()) await ocultar.click();
      await expect(d, label).toBeVisible();
    }
  }
});
