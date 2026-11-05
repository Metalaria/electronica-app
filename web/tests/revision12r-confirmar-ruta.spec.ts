// Third independent review of the 0.12 «platform» block: lifetime of the in-app confirmation (lib/confirmar.ts).
// The dialog is mounted on <body>, outside the page that asked, so it outlives that page: after a route change
// (Android's back button, a link, history.back()) it stays open over the new page, the new page stays inert, and
// answering «Borrar» still runs the old page's continuation (PaginaProtoboard.svelte `quitar`: borrarMontaje and
// `location.hash = '#/protoboard'`, which takes the reader back from wherever they went).
// Also: a double click on the button that asks lands its second click on the dialog's backdrop, which cancels.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision12r.config.ts revision12r-confirmar-ruta
import { test, expect, type Page } from '@playwright/test';

async function montajeGuardado(page: Page) {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
    }
  });
  await page.goto('./#/protoboard');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page).toHaveURL(/#\/protoboard\/.+/);
  await page.getByRole('button', { name: /Mis montajes|Montajes/ }).click();
  const lista = page.getByRole('region', { name: 'Mis montajes' });
  await expect(lista.getByRole('listitem')).toHaveCount(1);
  return lista;
}

test('al cambiar de página con la pregunta abierta, la pregunta se cierra (como «Cancelar»)', async ({ page }) => {
  const lista = await montajeGuardado(page);
  await lista.getByRole('button', { name: 'Borrar' }).click();
  const dialogo = page.getByRole('alertdialog');
  await expect(dialogo).toBeVisible();
  // what Android's back button or a link does: another route
  await page.evaluate(() => (location.hash = '#/'));
  await page.waitForTimeout(500);
  const estado = await page.evaluate(() => ({
    dialogo: !!document.querySelector('[role="alertdialog"]'),
    inertes: [...document.body.children].filter((e) => (e as HTMLElement).inert).length,
  }));
  expect(estado, 'tras cambiar de página').toEqual({ dialogo: false, inertes: 0 });
});

test('un doble clic en «Borrar» deja la pregunta abierta', async ({ page }) => {
  const lista = await montajeGuardado(page);
  await lista.getByRole('button', { name: 'Borrar' }).dblclick();
  await page.waitForTimeout(300);
  await expect(page.getByRole('alertdialog')).toBeVisible();
});
