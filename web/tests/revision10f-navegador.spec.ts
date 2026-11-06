// Review 10f (second review of the teacher mode / failure report block of 1.0): findings of medium or higher severity,
// each a test that fails with the code as reviewed.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision10f.config.ts tests/revision10f-navegador.spec.ts
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

/** An exam with exercise 1.1 (cap01) and test question cap05-01, 30 minutes, no variants, not shuffled. */
async function crearExamen(page: Page): Promise<string> {
  await page.goto('#/docente');
  await page.locator('[data-nuevo-examen]').click();
  await expect(page.locator('[data-selector]')).toBeVisible();
  await page.locator('[data-titulo]').fill('Examen de diodos');
  await page.locator('[data-minutos]').fill('30');
  await page.locator('[data-variantes]').uncheck();
  await page.locator('[data-barajar]').uncheck();
  await page.locator('[data-filtro-parte]').selectOption('cap01');
  await page.locator('li[data-entrada="ejercicio:ej-1.1"] [data-anadir]').click();
  await page.locator('[data-filtro-parte]').selectOption('cap05');
  await page.locator('li[data-entrada="pregunta:cap05-01"] [data-anadir]').click();
  await page.locator('[data-guardar]').click();
  await expect(page).toHaveURL(/#\/docente\/examen\/x[a-z0-9]+$/);
  return decodeURIComponent(new URL(page.url()).hash).split('/').pop()!;
}

const borrador = (page: Page, id: string) => page.evaluate((k) => localStorage.getItem(k), `epa:docente-en-curso:${id}`);

test('r10f·1 un intento sigue con sus preguntas tras recargar aunque el examen ya no tenga las de esa parte', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page);
  await page.locator('[data-empezar]').click();
  await page.locator('[data-item-examen="1"] [data-campo="r1"]').fill('11,75');
  await page.locator('[data-item-examen="2"]').getByRole('radio').nth(1).check();
  await expect.poll(async () => (await borrador(page, id)) ?? '').toContain('"2":{"r":"1"}');
  // the test question of cap05 is taken out of the exam (here, or the same change arriving by synchronisation)
  await page.goto(`#/docente/editar/${id}`);
  await expect(page.locator('[data-intento-en-curso]')).toBeVisible();
  await page.locator('[data-elegido="pregunta:cap05-01"] button[aria-label^="Quitar"]').click();
  await page.locator('[data-guardar]').click();
  await expect(page).toHaveURL(new RegExp(`#/docente/examen/${id}$`));
  // a reload (or the app opened again later): the attempt promises to go on with the questions it started with
  await page.goto(`#/docente/examen/${id}/hacer`);
  await page.reload();
  await expect(page.locator('[data-version-inicial]')).toBeVisible();
  await expect(page.locator('[data-item-examen]')).toHaveCount(2);
  await expect(page.locator('[data-item-examen="1"] [data-campo="r1"]')).toHaveValue('11,75');
  await expect(page.locator('[data-item-examen="2"]').getByRole('radio').nth(1)).toBeChecked();
  // and its hand-in grades both
  await page.locator('[data-entregar]').click();
  await expect(page).toHaveURL(/#\/docente\/resultado\//);
  await expect(page.locator('[data-item-resultado]')).toHaveCount(2);
});

test('r10f·2 el editor pregunta antes de salir también por «Libro» del carril (un botón, no un enlace)', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page);
  await page.goto(`#/docente/editar/${id}`);
  await page.locator('[data-titulo]').fill('Cambiado sin guardar');
  await page.locator('[data-herramienta="libro"]').first().click();
  await expect(page.getByRole('alertdialog', { name: '¿Descartar los cambios?' })).toBeVisible();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(new RegExp(`#/docente/editar/${id}$`));
  await expect(page.locator('[data-titulo]')).toHaveValue('Cambiado sin guardar');
});

test('r10f·3 el editor pregunta antes de salir también al elegir un resultado de «Buscar» con Intro', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page);
  await page.goto(`#/docente/editar/${id}`);
  await page.locator('[data-titulo]').fill('Cambiado sin guardar');
  await page.locator('[data-herramienta="buscar"]').first().click();
  const buscador = page.getByRole('dialog', { name: 'Buscar en el libro' });
  const campo = buscador.getByRole('searchbox', { name: 'Buscar en el libro' });
  await campo.fill('diodo zener');
  await expect(buscador.getByRole('option').first()).toBeVisible();
  await campo.press('Enter');
  await expect(page.getByRole('alertdialog', { name: '¿Descartar los cambios?' })).toBeVisible();
});

// Documented as a limitation in review 10c («el botón Atrás del navegador no se puede retener»), but in a hash router it
// can: on Android the system back button / gesture is the usual way out of a page, and it drops the editor's work.
test('r10f·4 el editor pregunta antes de salir también con «Atrás» del sistema (Android) o del navegador', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page);
  await page.goto(`#/docente/editar/${id}`);
  await page.locator('[data-titulo]').fill('Cambiado sin guardar');
  await page.goBack();
  await expect(page.getByRole('alertdialog', { name: '¿Descartar los cambios?' })).toBeVisible();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(new RegExp(`#/docente/editar/${id}$`));
  await expect(page.locator('[data-titulo]')).toHaveValue('Cambiado sin guardar');
});
