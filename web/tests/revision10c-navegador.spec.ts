// Review 10c (1.0, teacher mode) in the browser: findings proved on the real build.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision10c.config.ts tests/revision10c-navegador.spec.ts
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
  await expect(page.locator('[data-elegido]')).toHaveCount(2);
  await page.locator('[data-guardar]').click();
  await expect(page).toHaveURL(/#\/docente\/examen\/x[a-z0-9]+$/);
  return decodeURIComponent(new URL(page.url()).hash).split('/').pop()!;
}

// r10c·4 (medium): the draft of an exam being taken is tied to the exam's `actualizado`; any «Guardar» in the editor
// bumps it — even with nothing changed (or only the title or notes, or such an edit arriving by synchronisation) —
// and the answers typed so far are dropped without a word: «Seguir con el examen empezado» disappears and taking the
// exam again starts from blank with a new clock.
test('r10c·4 guardar el examen sin cambios no tira las respuestas del examen empezado', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page);
  await page.locator('[data-empezar]').click();
  await expect(page).toHaveURL(new RegExp(`#/docente/examen/${id}/hacer$`));
  const campo = page.locator('[data-item-examen="1"] [data-campo="r1"]');
  await campo.fill('11,75');
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k) ?? '', `epa:docente-en-curso:${id}`)).toContain('11,75');
  // back to the exam's page, «Editar», and «Guardar» without touching anything
  await page.goto(`#/docente/editar/${id}`);
  await expect(page.locator('[data-guardar]')).toBeVisible();
  await page.locator('[data-guardar]').click();
  await expect(page).toHaveURL(new RegExp(`#/docente/examen/${id}$`));
  await expect(page.locator('[data-seguir]'), 'el examen empezado sigue ahí').toBeVisible();
  await page.locator('[data-seguir]').click();
  await expect(campo).toHaveValue('11,75');
});

// r10c·5 (medium): a hand-in whose result could not be written says «Sus respuestas siguen guardadas en este
// dispositivo: vuelva a entregar el examen», but the unwritten result stays in memory; going back to the exam and
// «Seguir con el examen empezado» finds that in-memory result as if it were stored (review 10b's «already handed in»
// check), REMOVES the draft and shows the result. With the write still failing, closing or reloading the app loses
// both: the exam's answers are gone.
test('r10c·5 una entrega que no se pudo guardar no pierde el borrador al volver al examen', async ({ page }) => {
  await page.addInitScript(() => {
    const poner = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k === 'epa:docente-resultados' && sessionStorage.getItem('fallar-resultados') === '1') throw new DOMException('lleno', 'QuotaExceededError');
      return poner.call(this, k, v);
    };
  });
  await limpio(page);
  const id = await crearExamen(page);
  await page.locator('[data-empezar]').click();
  await expect(page).toHaveURL(new RegExp(`#/docente/examen/${id}/hacer$`));
  const campo = page.locator('[data-item-examen="1"] [data-campo="r1"]');
  await campo.fill('11,75');
  const borrador = () => page.evaluate((k) => localStorage.getItem(k) ?? '', `epa:docente-en-curso:${id}`);
  await expect.poll(borrador).toContain('11,75');
  // the result cannot be written from now on (storage full)
  await page.evaluate(() => sessionStorage.setItem('fallar-resultados', '1'));
  await page.locator('[data-entregar]').click();
  const dialogo = page.getByRole('alertdialog', { name: '¿Entregar el examen?' });
  await dialogo.getByRole('button', { name: 'Entregar' }).click();
  await expect(page.locator('[data-fallo-entrega]')).toContainText('Sus respuestas siguen guardadas en este dispositivo');
  // the reader goes back to the exam and takes it up again
  await page.goto(`#/docente/examen/${id}`);
  await page.locator('[data-seguir]').click();
  // either the exam again (fixed) or, with the bug, the in-memory result shown after the draft was removed
  await expect(page.locator('[data-resultado-examen] [data-nota-total], [data-item-examen="1"] [data-campo="r1"]').first()).toBeVisible();
  // the app is closed and opened again (the write still failing until then)
  await page.reload();
  await page.evaluate(() => sessionStorage.removeItem('fallar-resultados'));
  const resultados = await page.evaluate(() => localStorage.getItem('epa:docente-resultados') ?? '');
  const queda = (await borrador()).includes('11,75') || resultados.includes('11,75');
  expect(queda, 'las respuestas siguen en el borrador o en un resultado guardado').toBe(true);
});
