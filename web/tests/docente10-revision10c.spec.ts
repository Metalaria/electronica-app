// 1.0 «modo docente», fixes of review 10c (besides the reviewer's own r10c·1/4/5 in tests/revision10c-*.spec.ts):
// an attempt keeps the version it started with (title/notes edits, «Guardar» without changes, a real change), drafts of
// before the fix whose exam changed wait for the reader, the chosen variant survives a draft that cannot be written, the
// clock and the limit after a failed automatic hand-in, write errors said in the editor and the self-assessment, the
// editor asks before leaving with unsaved changes, drafts of deleted exams go, an exam deleted meanwhile is offered as
// a new one, and a PDF with characters no font has says so.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.docente10.config.ts tests/docente10-revision10c.spec.ts
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

/** Writes of keys whose name starts with sessionStorage «fallar» fail (storage full) while it is set. */
async function fallosDeEscritura(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const poner = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      const f = sessionStorage.getItem('fallar');
      if (this === localStorage && f && k.startsWith(f)) throw new DOMException('lleno', 'QuotaExceededError');
      return poner.call(this, k, v);
    };
  });
}
const fallar = (page: Page, prefijo: string | null) =>
  page.evaluate((p) => (p ? sessionStorage.setItem('fallar', p) : sessionStorage.removeItem('fallar')), prefijo);

async function crearExamen(page: Page, o: { titulo?: string; minutos?: string; variantes?: boolean } = {}): Promise<string> {
  await page.goto('#/docente');
  await page.locator('[data-nuevo-examen]').click();
  await expect(page.locator('[data-selector]')).toBeVisible();
  await page.locator('[data-titulo]').fill(o.titulo ?? 'Examen de diodos');
  await page.locator('[data-minutos]').fill(o.minutos ?? '30');
  if (!o.variantes) await page.locator('[data-variantes]').uncheck();
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

test('un intento sigue con su versión: cambiar el título no lo toca; un cambio de preguntas vale para el próximo, con aviso', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page);
  await page.locator('[data-empezar]').click();
  await page.locator('[data-item-examen="1"] [data-campo="r1"]').fill('11,75');
  await expect.poll(async () => (await borrador(page, id)) ?? '').toContain('11,75');
  // the editor says an attempt is in progress; the title changes
  await page.goto(`#/docente/editar/${id}`);
  await expect(page.locator('[data-intento-en-curso]')).toBeVisible();
  await page.locator('[data-titulo]').fill('Examen de diodos (revisado)');
  await page.locator('[data-guardar]').click();
  await page.locator('[data-seguir]').click();
  await expect(page.locator('[data-item-examen="1"] [data-campo="r1"]')).toHaveValue('11,75');
  await expect(page.locator('[data-version-inicial]')).toHaveCount(0);
  // a real change (one more question): the attempt goes on with its two, and says so
  await page.goto(`#/docente/editar/${id}`);
  await page.locator('[data-filtro-parte]').selectOption('cap05');
  await page.locator('li[data-entrada="pregunta:cap05-02"] [data-anadir]').click();
  await page.locator('[data-guardar]').click();
  await page.locator('[data-seguir]').click();
  await expect(page.locator('[data-version-inicial]')).toBeVisible();
  await expect(page.locator('[data-item-examen]')).toHaveCount(2);
  await expect(page.locator('[data-item-examen="1"] [data-campo="r1"]')).toHaveValue('11,75');
  // the next attempt has the three
  await page.locator('[data-item-examen="2"]').getByRole('radio').first().check();
  await page.locator('[data-entregar]').click();
  await expect(page).toHaveURL(/#\/docente\/resultado\//);
  await expect(page.locator('[data-item-resultado]')).toHaveCount(2);
  await page.goto(`#/docente/examen/${id}`);
  await page.locator('[data-empezar]').click();
  await expect(page.locator('[data-item-examen]')).toHaveCount(3);
});

test('un borrador de antes del arreglo cuyo examen cambió espera a que el lector decida', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page);
  // a draft as review 10b wrote it, of an older version of the exam
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ variante: 0, inicio: Date.now() - 60_000, respuestas: { 1: { r1: '11,75' } }, actualizado: 1 })), `epa:docente-en-curso:${id}`);
  await page.goto(`#/docente/examen/${id}/hacer`);
  await expect(page.locator('[data-examen-cambiado]')).toBeVisible();
  expect(await borrador(page, id)).toContain('11,75');
  await page.locator('[data-empezar-de-nuevo]').click();
  await page.getByRole('alertdialog', { name: '¿Empezar de nuevo?' }).getByRole('button', { name: 'Empezar de nuevo' }).click();
  await expect(page.locator('[data-item-examen]')).toHaveCount(2);
  await expect(page.locator('[data-item-examen="1"] [data-campo="r1"]')).toHaveValue('');
  expect(await borrador(page, id)).not.toContain('11,75');
});

test('la variante elegida se mantiene aunque el borrador no se pueda escribir', async ({ page }) => {
  await fallosDeEscritura(page);
  await limpio(page);
  const id = await crearExamen(page, { variantes: true });
  await fallar(page, 'epa:docente-en-curso:');
  await page.locator('[data-variante-hacer]').selectOption('1');
  await page.locator('[data-empezar]').click();
  await expect(page).toHaveURL(new RegExp(`#/docente/examen/${id}/hacer/1$`));
  await expect(page.locator('.hacer .meta')).toContainText('Variante B');
});

test('tiempo agotado y entrega automática fallida: el reloj sigue, no se puede responder y se reintenta', async ({ page }) => {
  await fallosDeEscritura(page);
  await limpio(page);
  await page.clock.install();
  const id = await crearExamen(page, { minutos: '1' });
  await page.locator('[data-empezar]').click();
  await page.locator('[data-item-examen="2"]').getByRole('radio').first().check();
  await fallar(page, 'epa:docente-resultados');
  await page.clock.fastForward('01:05');
  await expect(page.locator('[data-fallo-entrega]')).toBeVisible();
  await expect(page.locator('[data-reloj]')).toContainText('0:00');
  await expect(page.locator('[data-tiempo-agotado]')).toBeVisible();
  await expect(page.locator('[data-item-examen="1"] [data-campo="r1"]')).toBeDisabled();
  expect(await borrador(page, id)).not.toBeNull();
  // storage works again: the automatic hand-in is retried and marked as out of time
  await fallar(page, null);
  await page.clock.fastForward('00:16');
  await expect(page).toHaveURL(/#\/docente\/resultado\//);
  await expect(page.locator('.meta')).toContainText('se acabó el tiempo');
  expect(await borrador(page, id)).toBeNull();
});

test('errores de escritura a la vista: guardar en el editor y autoevaluar', async ({ page }) => {
  await fallosDeEscritura(page);
  await limpio(page);
  const id = await crearExamen(page);
  await page.goto(`#/docente/editar/${id}`);
  await page.locator('[data-titulo]').fill('Otro título');
  await fallar(page, 'epa:docente');
  await page.locator('[data-guardar]').click();
  await expect(page.locator('[data-fallo-guardar]')).toContainText('No se ha podido guardar');
  await expect(page).toHaveURL(new RegExp(`#/docente/editar/${id}$`));
  await fallar(page, null);
  await page.locator('[data-guardar]').click();
  await expect(page.locator('h1')).toHaveText('Otro título');
  // the self-assessment: an open exercise answered, then its write fails
  await page.goto('#/docente/nuevo/examen');
  await page.locator('[data-titulo]').fill('Abierto');
  // (1.1 «razonar»: ej-5.9, used until 1.0, is self-checked now; ej-12.8 is still self-assessed)
  await page.locator('[data-filtro-parte]').selectOption('cap12');
  await page.locator('li[data-entrada="ejercicio:ej-12.8"] [data-anadir]').click();
  await page.locator('[data-guardar]').click();
  await page.locator('[data-empezar]').click();
  await page.locator('[data-item-examen="1"] [data-campo="texto"]').fill('Dos diodos.');
  await page.locator('[data-entregar]').click();
  await expect(page.locator('[data-nota-total]')).toContainText('0 de 2');
  await fallar(page, 'epa:docente-resultados');
  await page.locator('[data-autoeval="1"]').getByRole('button', { name: 'Bien' }).click();
  await expect(page.locator('[data-fallo-autoeval]')).toBeVisible();
  await expect(page.locator('[data-nota-total]')).toContainText('0 de 2');
  await fallar(page, null);
  await page.locator('[data-autoeval="1"]').getByRole('button', { name: 'Bien' }).click();
  await expect(page.locator('[data-nota-total]')).toContainText('2 de 2');
  await expect(page.locator('[data-fallo-autoeval]')).toHaveCount(0);
});

test('el editor pregunta antes de salir con cambios sin guardar por un enlace de la aplicación', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page);
  await page.goto(`#/docente/editar/${id}`);
  await page.locator('[data-titulo]').fill('Cambiado sin guardar');
  await page.locator('a[href="#/docente"]').first().click();
  const d = page.getByRole('alertdialog', { name: '¿Descartar los cambios?' });
  await d.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(new RegExp(`#/docente/editar/${id}$`));
  await expect(page.locator('[data-titulo]')).toHaveValue('Cambiado sin guardar');
  await page.locator('a[href="#/docente"]').first().click();
  await d.getByRole('button', { name: 'Descartar' }).click();
  await expect(page).toHaveURL(/#\/docente$/);
  // without changes nothing is asked
  await page.goto(`#/docente/editar/${id}`);
  await expect(page.locator('[data-guardar]')).toBeVisible();
  await page.locator('a[href="#/docente"]').first().click();
  await expect(page).toHaveURL(/#\/docente$/);
});

test('los borradores de exámenes borrados se limpian (aquí o por sincronización)', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page);
  await page.locator('[data-empezar]').click();
  await page.locator('[data-item-examen="1"] [data-campo="r1"]').fill('1');
  await expect.poll(() => borrador(page, id)).not.toBeNull();
  await page.goto('#/docente');
  await page.locator(`[data-propio="${id}"] [data-borrar]`).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Borrar' }).click();
  await expect.poll(() => borrador(page, id)).toBeNull();
  // a draft left by an exam deleted elsewhere (its tombstone arrived by synchronisation) goes when the list opens
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ variante: 0, inicio: 1, respuestas: {}, actualizado: 1 })), `epa:docente-en-curso:${id}`);
  await page.reload();
  await expect(page.locator('[data-docente]')).toBeVisible();
  await expect.poll(() => borrador(page, id)).toBeNull();
});

test('guardar un examen que se borró mientras se editaba ofrece guardarlo como nuevo', async ({ page, context }) => {
  await limpio(page);
  const id = await crearExamen(page);
  await page.goto(`#/docente/editar/${id}`);
  await page.locator('[data-titulo]').fill('Lo que estaba escribiendo');
  // another tab deletes it
  const otra = await context.newPage();
  await otra.goto(page.url().replace(/#.*$/, '#/docente'));
  await otra.locator(`[data-propio="${id}"] [data-borrar]`).click();
  await otra.getByRole('alertdialog').getByRole('button', { name: 'Borrar' }).click();
  await expect(otra.locator(`[data-propio="${id}"]`)).toHaveCount(0);
  await otra.close();
  await page.locator('[data-guardar]').click();
  const d = page.getByRole('alertdialog', { name: 'Este examen se ha borrado' });
  await d.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('[data-fallo-guardar]')).toContainText('se había borrado');
  await page.locator('[data-guardar]').click();
  await d.getByRole('button', { name: 'Guardar como nuevo' }).click();
  await expect(page).toHaveURL(/#\/docente\/examen\/x[a-z0-9]+$/);
  expect(page.url()).not.toContain(id);
  await expect(page.locator('h1')).toHaveText('Lo que estaba escribiendo');
  const g = await page.evaluate((i) => JSON.parse(localStorage.getItem('epa:docente') ?? '{}').propios[i], id);
  expect(g.borrado).toBeGreaterThan(0);
});

test('un PDF con caracteres que ninguna fuente tiene lo dice en la página', async ({ page }) => {
  await limpio(page);
  await crearExamen(page, { titulo: 'Examen ⏸ con símbolo raro' });
  const [d] = await Promise.all([page.waitForEvent('download'), page.locator('[data-pdf-generar]').click()]);
  await d.path();
  await expect(page.locator('[data-pdf-sin-glifo]')).toContainText('U+23F8');
});
