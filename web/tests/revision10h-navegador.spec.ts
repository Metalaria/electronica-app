// Review 10h (third and last review of the teacher mode / failure report block of 1.0): findings of medium or higher
// severity (and one lower one that was cheap to prove), each a test that fails with the code as reviewed.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision10h.config.ts tests/revision10h-navegador.spec.ts --workers=1
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

/** An exam with exercise 1.1 (cap01, it has changing values) and, unless `soloEjercicio`, test question cap05-01. */
async function crearExamen(page: Page, op: { variantes?: boolean; soloEjercicio?: boolean; minutos?: number } = {}): Promise<string> {
  await page.goto('#/docente');
  await page.locator('[data-nuevo-examen]').click();
  await expect(page.locator('[data-selector]')).toBeVisible();
  await page.locator('[data-titulo]').fill('Examen de diodos');
  await page.locator('[data-minutos]').fill(String(op.minutos ?? 30));
  if (op.variantes) await page.locator('[data-variantes]').check();
  else await page.locator('[data-variantes]').uncheck();
  await page.locator('[data-barajar]').uncheck();
  await page.locator('[data-filtro-parte]').selectOption('cap01');
  await page.locator('li[data-entrada="ejercicio:ej-1.1"] [data-anadir]').click();
  if (!op.soloEjercicio) {
    await page.locator('[data-filtro-parte]').selectOption('cap05');
    await page.locator('li[data-entrada="pregunta:cap05-01"] [data-anadir]').click();
  }
  await page.locator('[data-guardar]').click();
  await expect(page).toHaveURL(/#\/docente\/examen\/x[a-z0-9]+$/);
  return decodeURIComponent(new URL(page.url()).hash).split('/').pop()!;
}

const borrador = (page: Page, id: string) => page.evaluate((k) => localStorage.getItem(k), `epa:docente-en-curso:${id}`);

// r10h·1 (medium, data loss with storage full): when the draft cannot be written the exam says «no cierre ni recargue
// la página hasta entregar el examen» — the answers live only in the page —, but nothing holds the reader on it: the
// rail, a link or Android's «Atrás» leave HacerExamen (unmounted) and every answer typed is gone without a question.
// lib/salida.ts already gives the editor that guard; the exam page registers none.
test('r10h·1 con el borrador sin poder escribirse, salir del examen pregunta antes (las respuestas solo están en la página)', async ({ page }) => {
  await page.addInitScript(() => {
    const poner = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (this === localStorage && k.startsWith('epa:docente-en-curso:') && sessionStorage.getItem('lleno') === '1') throw new DOMException('lleno', 'QuotaExceededError');
      return poner.call(this, k, v);
    };
  });
  await limpio(page);
  const id = await crearExamen(page);
  await page.locator('[data-empezar]').click();
  await expect(page.locator('[data-item-examen="1"] [data-campo="r1"]')).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem('lleno', '1'));
  await page.locator('[data-item-examen="1"] [data-campo="r1"]').fill('11,75');
  await expect(page.locator('[data-fallo-borrador]')).toContainText('no cierre ni recargue la página');
  // the rail's «Libro» (a button that sets location.hash), as in r10f·2 for the editor
  await page.locator('[data-herramienta="libro"]').first().click();
  await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5000 });
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(new RegExp(`#/docente/examen/${id}/hacer$`));
  await expect(page.locator('[data-item-examen="1"] [data-campo="r1"]')).toHaveValue('11,75');
});

// r10h·2 (medium, silent misgrade): an attempt with changing values («variantes») reopened while
// libro/practica/indice.json does not load. cargarIndicePractica() turns that failure into null, prepararItems() then
// loads no practice item, montarExamen() gives the exercise no `variante` and reports nothing in `faltan`: the attempt
// opens with the BOOK's values instead of the ones the reader was answering, and the hand-in grades the answer against
// the book's result. (The same silent fallback reaches exportar.ts: an exam paper printed then has the book's values while
// the solutions printed later have the variant's.) Either the attempt must not open, or it must show the same question.
test('r10h·2 un intento con variantes no se abre con los valores del libro si no carga el índice de práctica', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page, { variantes: true, soloEjercicio: true });
  await page.locator('[data-empezar]').click();
  const item = page.locator('[data-item-examen="1"]');
  await expect(item.locator('[data-campo="r1"]')).toBeVisible();
  const antes = (await item.innerText()).replace(/\s+/g, ' ');
  await item.locator('[data-campo="r1"]').fill('12');
  await expect.poll(async () => (await borrador(page, id)) ?? '').toContain('"r1":"12"');
  // the reader comes back later; this time the practice index does not arrive
  await page.route('**/libro/practica/indice.json', (r) => r.abort());
  await page.reload();
  const abierto = page.locator('[data-item-examen="1"] [data-campo="r1"]');
  const noAbre = page.locator('.hacer [role="alert"]');
  await expect(abierto.or(noAbre).first()).toBeVisible({ timeout: 30_000 });
  if (await noAbre.isVisible()) return; // refusing to open is fine: the draft is kept
  const despues = (await page.locator('[data-item-examen="1"]').innerText()).replace(/\s+/g, ' ');
  expect(despues, 'the attempt shows another statement (the book values) than the one being answered').toBe(antes);
});

// r10h·3 (medium, an exam graded that was never seen): «Empezar» (ExamenPropio) writes the draft with `inicio = now`
// before HacerExamen has loaded anything, and HacerExamen leaves it there when the attempt cannot be opened (a part or a
// quiz that does not load: «No se han podido cargar…», or the loader's own message). The clock of a timed exam runs
// while the reader cannot see a single question; ExamenPropio offers «Seguir con el examen empezado», and coming back
// after the limit hands in a BLANK exam at once — a stored, synchronised result of 0 points. Here the passing of time is
// the draft's `inicio` moved 31 minutes back (what coming back 31 minutes later gives).
test('r10h·3 un intento que no se pudo abrir no gasta su tiempo ni se entrega en blanco al volver', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page);
  // a fresh start of the app on the exam's page (the editor already had every quiz in memory)
  await page.reload();
  await page.route('**/libro/repaso/cap05.json', (r) => r.abort());
  await page.locator('[data-empezar]').click();
  await expect(page.locator('.hacer [role="alert"]')).toBeVisible({ timeout: 30_000 });
  console.log('mensaje al no abrir:', await page.locator('.hacer [role="alert"]').innerText());
  await page.unroute('**/libro/repaso/cap05.json');
  await page.evaluate((k) => {
    const b = JSON.parse(localStorage.getItem(k) ?? 'null') as { inicio: number } | null;
    if (b) localStorage.setItem(k, JSON.stringify({ ...b, inicio: b.inicio - 31 * 60_000 }));
  }, `epa:docente-en-curso:${id}`);
  await page.goto(`#/docente/examen/${id}`);
  await page.reload();
  const seguir = page.locator('[data-seguir]');
  const empezar = page.locator('[data-empezar]');
  await expect(seguir.or(empezar).first()).toBeVisible();
  await (await seguir.isVisible() ? seguir : empezar).click();
  await expect(page.locator('[data-item-examen="1"]')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  await expect(page, 'a blank exam was handed in by itself').toHaveURL(new RegExp(`#/docente/examen/${id}/hacer`));
  await expect(page.locator('[data-tiempo-agotado]')).toHaveCount(0);
});

// r10h·5 (low-medium, double prompt): the failure notice's «Ver el informe» asks the editor's guard (puedeSalir) and,
// on «Descartar», sets location.hash; the editor is still mounted with `cambiado` true, so the router's hashchange guard
// (retenerSalida) puts the editor's address back and asks the same question a second time.
test('r10h·5 «Ver el informe» con cambios sin guardar pregunta una sola vez', async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __epaInformeAviso?: boolean }).__epaInformeAviso = true));
  await limpio(page);
  const id = await crearExamen(page);
  await page.goto(`#/docente/editar/${id}`);
  await page.locator('[data-titulo]').fill('Cambiado sin guardar');
  await page.evaluate(() => setTimeout(() => { throw new Error('fallo de prueba r10h5'); }, 0));
  await page.locator('[data-ver-informe]').click();
  const dialogo = page.getByRole('alertdialog', { name: '¿Descartar los cambios?' });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('button', { name: 'Descartar' }).click();
  await expect(page).toHaveURL(/#\/diagnostico\/informe$/, { timeout: 5000 });
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

// r10h·6 (low, a dead «Atrás»): leaving the editor with «Atrás» and «Descartar» leaves two entries of the page left
// to (retenerSalida pushes the editor's address back and then replaces it with the destination), so the next «Atrás»
// stays on the same page — on Android the reader presses it again thinking it did not work.
test('r10h·6 tras salir del editor con «Atrás» y descartar, el siguiente «Atrás» no se queda en la misma página', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page);
  await page.goto(`#/docente/editar/${id}`);
  await page.locator('[data-titulo]').fill('Cambiado sin guardar');
  await page.goBack();
  const dialogo = page.getByRole('alertdialog', { name: '¿Descartar los cambios?' });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('button', { name: 'Descartar' }).click();
  await expect(page).toHaveURL(new RegExp(`#/docente/examen/${id}$`));
  await page.goBack();
  await page.waitForTimeout(500);
  expect(page.url(), 'the second «Atrás» stayed on the same page').not.toMatch(new RegExp(`#/docente/examen/${id}$`));
});

test('verificado: «Atrás» repetido con el diálogo abierto no abre dos diálogos ni atrapa; cancelar conserva los cambios', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page);
  await page.goto(`#/docente/editar/${id}`);
  await page.locator('[data-titulo]').fill('Cambiado sin guardar');
  await page.goBack();
  await expect(page.getByRole('alertdialog')).toHaveCount(1);
  await page.goBack();
  await page.goBack();
  await page.waitForTimeout(300);
  await expect(page.getByRole('alertdialog')).toHaveCount(1);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(new RegExp(`#/docente/editar/${id}$`));
  await expect(page.locator('[data-titulo]')).toHaveValue('Cambiado sin guardar');
  // saved: the guard is no longer armed — «Atrás» from the exam's page and from the editor go without a question
  await page.locator('[data-guardar]').click();
  await expect(page).toHaveURL(new RegExp(`#/docente/examen/${id}$`));
  await page.goto('#/docente');
  await page.goto(`#/docente/editar/${id}`);
  await expect(page.locator('[data-titulo]')).toHaveValue('Cambiado sin guardar');
  await page.goBack();
  await expect(page).toHaveURL(/#\/docente$/);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  // and elsewhere in the app nothing asks
  await page.goto('#/glosario');
  await page.goBack();
  await expect(page).toHaveURL(/#\/docente$/);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

// r10h·4 (low-medium, an attempt that becomes unreachable): the attempts at exams deleted elsewhere are offered only
// while the exam's tombstone is known (`intentosDeBorrados(borrado)`, HacerExamen `lapida?.borrado`). Tombstones are
// pruned after PODA_DIAS (90) by the synchronisation (sincronizar.svelte.ts: a tombstone older than the file's horizon
// is dropped, and an unchanged live copy of a pruned item too), and then the attempt — with its own `def`, still in
// localStorage — is listed nowhere and «Este examen ya no existe»: its answers can no longer be handed in nor seen.
// Here the prune is the exam removed from the local store, exactly what the synchronisation leaves.
test('r10h·4 un intento con su versión sigue accesible aunque el examen desaparezca (lápida podada)', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page);
  await page.locator('[data-empezar]').click();
  await page.locator('[data-item-examen="1"] [data-campo="r1"]').fill('11,75');
  await expect.poll(async () => (await borrador(page, id)) ?? '').toContain('11,75');
  await page.goto('#/docente');
  const quitado = await page.evaluate((x) => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith('epa:docente-en-curso:')) continue;
      const v = localStorage.getItem(k) ?? '';
      if (!v.includes(x) || !v.includes('"propios"')) continue;
      const d = JSON.parse(v) as { propios?: Record<string, unknown> };
      if (!d.propios?.[x]) continue;
      delete d.propios[x];
      localStorage.setItem(k, JSON.stringify(d));
      return k;
    }
    return '';
  }, id);
  expect(quitado).toBe('epa:docente');
  await page.reload();
  await expect(page.locator('[data-docente]')).toBeVisible();
  expect(await borrador(page, id), 'the draft is still on the device').toContain('11,75');
  await expect(page.locator(`[data-intento-huerfano="${id}"]`), 'the attempt is listed nowhere').toBeVisible({ timeout: 10_000 });
});
