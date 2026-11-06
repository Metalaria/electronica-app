// Review 10e (1.0 exercises: checking, «Resolver paso a paso», «Teoría que se mueve»): findings that need the browser.
// Each test FAILS on the reviewed tree and states the expected behaviour.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision10e.config.ts tests/revision10e-navegador.spec.ts
import { expect, test, type Page } from '@playwright/test';

async function limpio(page: Page): Promise<void> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: 'claro', tam: 18 }));
    }
  });
}
const panel = (page: Page, label: string) => page.locator(`.comprobador[data-label="${label}"]`);
const campo = (page: Page, label: string, r: string) => page.locator(`#cmp-${label.replace(/[^\w-]/g, '_')}-${r}`);

/** The stored state of one exercise (localStorage `epa:ejercicios`, the browser's storage layer). */
async function guardado(page: Page, label: string): Promise<Record<string, unknown> | undefined> {
  return page.evaluate((l) => {
    const t = localStorage.getItem('epa:ejercicios');
    const d = t ? JSON.parse(t) : {};
    return (d.items ?? d)[l];
  }, label);
}

test('r10e·1 paso a paso recorrido entero y el ejercicio comprobado con el panel aún abierto: cuenta como ayuda', async ({ page }) => {
  // The guided mode ends with «Ha llegado al resultado … Escriba ahora las respuestas del ejercicio y compruébelas»
  // while the exercise's own fields stay visible just above. Typing them there and pressing «Comprobar» (instead of
  // «Volver al ejercicio» first) records the exercise as solved «a la primera», without hints, and the help is only
  // counted when the reader later presses «Salir…»/«Volver…»; leaving the page instead never counts it.
  await limpio(page);
  await page.goto('#/cap01/ej-1.1');
  const p = panel(page, 'ej-1.1');
  await p.locator('[data-pasos-boton]').click();
  const g = p.locator('[data-pasos="ej-1.1"]');
  await g.getByRole('textbox').fill('11,75 V');
  await g.getByRole('button', { name: 'Comprobar el paso' }).click();
  await g.getByRole('button', { name: 'Siguiente paso' }).click();
  await g.getByRole('textbox').fill('0,294 W');
  await g.getByRole('button', { name: 'Comprobar el paso' }).click();
  await g.getByRole('button', { name: 'Ver el resultado' }).click();
  await expect(g.locator('.final')).toContainText('Escriba ahora las respuestas del ejercicio');
  // the reader does what the panel says, in the fields right above it
  await campo(page, 'ej-1.1', 'r1').fill('11,75');
  await campo(page, 'ej-1.1', 'r2').fill('0,294');
  await p.locator('[data-p="p1"]').getByRole('radio', { name: 'No' }).check();
  await p.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(p.locator('.estado')).toBeVisible();
  // solved with the whole guided mode as help: never «a la primera»
  await expect.soft(p.locator('.estado')).not.toContainText('a la primera', { timeout: 1500 });
  // and it stays so after leaving the page without pressing «Volver al ejercicio»
  await page.goto('#/cap02');
  await page.waitForTimeout(600);
  const e = await guardado(page, 'ej-1.1');
  expect(e?.resuelto).toBe(true);
  expect(Number(e?.pistas ?? 0)).toBeGreaterThan(0);
});

test('r10e·2 lo escrito en los campos numéricos y las preguntas sin comprobar no se pierde al ir a otro capítulo', async ({ page }) => {
  // ESQUEMA: «r1… lo escrito en cada campo numérico; p1… la respuesta de cada pregunta estructurada». The written answer
  // («texto») is stored as it is typed and flushed when the panel goes away, but numeric fields and structured answers
  // only reach EstadoEjercicio.valores on «Comprobar»: a reader who fills them, goes to look something up in another
  // chapter and comes back finds them empty.
  await limpio(page);
  await page.goto('#/cap01/ej-1.1');
  const p = panel(page, 'ej-1.1');
  await campo(page, 'ej-1.1', 'r1').fill('11,75 V');
  await p.locator('[data-p="p1"]').getByRole('radio', { name: 'No' }).check();
  await page.goto('#/cap02');
  await expect(page.locator('.comprobador[data-label="ej-1.1"]')).toHaveCount(0);
  await page.goto('#/cap01/ej-1.1');
  await expect(campo(page, 'ej-1.1', 'r1')).toHaveValue('11,75 V');
  await expect(p.locator('[data-p="p1"]').getByRole('radio', { name: 'No' })).toBeChecked();
});

test('r10e·3 (bajo) «Volver a los valores del libro» no deja el foco del teclado en el vacío', async ({ page }) => {
  // The button disappears as soon as the values are the book's again, and the focus falls back to <body>: a keyboard
  // or screen-reader user loses the place in the piece.
  await limpio(page);
  await page.goto('#/cap01/sec-1.4');
  const t = page.locator('[data-teoria="divisor"]');
  await t.scrollIntoViewIfNeeded();
  await t.getByRole('button', { name: 'Mover los valores de esta fórmula' }).click();
  const r2 = t.getByRole('slider', { name: /R2|R₂/ });
  await r2.focus();
  await page.keyboard.press('ArrowRight');
  await t.getByRole('button', { name: 'Volver a los valores del libro' }).focus();
  await page.keyboard.press('Enter');
  await expect(t.locator('output')).toHaveText(/^4\sV$/);
  expect(await page.evaluate(() => !!document.activeElement?.closest('[data-teoria="divisor"]'))).toBe(true);
});
