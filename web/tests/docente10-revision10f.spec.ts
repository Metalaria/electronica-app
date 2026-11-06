// 1.0 «modo docente», fixes of review 10f (besides the reviewer's own r10f·1–4 in tests/revision10f-navegador.spec.ts):
// numbers of an attempt's questions never move, an attempt at an exam deleted on another device stays submittable, the
// delete dialog names an attempt in progress, a draft that cannot be written is said, the paused tab's «Usar aquí»
// and «Reiniciar para terminar» ask the editor's guard first.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.docente10.config.ts tests/docente10-revision10f.spec.ts
import fs from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { cargarLibro } from './docente10/libro-node';
import { montarExamen, type ContextoExamen } from '../src/lib/docente/examen';

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

async function crearExamen(page: Page, titulo = 'Examen de diodos'): Promise<string> {
  await page.goto('#/docente');
  await page.locator('[data-nuevo-examen]').click();
  await expect(page.locator('[data-selector]')).toBeVisible();
  await page.locator('[data-titulo]').fill(titulo);
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

test('montar: un elemento que falta no renumera los demás y se nombra en «faltan»', () => {
  const L = cargarLibro();
  const sinCap05: ContextoExamen = { ...L.libro, pregunta: (id) => (id.startsWith('cap05-') ? undefined : L.libro.pregunta(id)) };
  const def = {
    items: [
      { k: 'pregunta' as const, ref: 'cap05-01', puntos: 1 },
      { k: 'ejercicio' as const, ref: 'ej-1.1', puntos: 2 },
      { k: 'pregunta' as const, ref: 'cap09-01', puntos: 1 },
    ],
    minutos: 0,
    variantes: false,
    barajar: false,
    semilla: 3,
    espacio: 'no' as const,
  };
  const todo = montarExamen(def, L.libro, 0);
  const parcial = montarExamen(def, sinCap05, 0);
  expect(parcial.faltan).toEqual(['pregunta:cap05-01']);
  expect(todo.faltan).toEqual([]);
  // the others keep their numbers: an answer stored under «2» is still ej-1.1's
  expect(parcial.items.map((m) => [m.n, m.ref])).toEqual([
    [2, 'ej-1.1'],
    [3, 'cap09-01'],
  ]);
  expect(todo.items.map((m) => [m.n, m.ref])).toEqual([
    [1, 'cap05-01'],
    [2, 'ej-1.1'],
    [3, 'cap09-01'],
  ]);
  // shuffled: the same order with or without the missing one
  const b = { ...def, barajar: true };
  const n = (x: ReturnType<typeof montarExamen>) => Object.fromEntries(x.items.map((m) => [m.ref, m.n]));
  const conTodo = n(montarExamen(b, L.libro, 1));
  const sinUno = n(montarExamen(b, sinCap05, 1));
  for (const [ref, k] of Object.entries(sinUno)) expect(k).toBe(conTodo[ref]);
});

test('un intento de un examen borrado en otro dispositivo se puede terminar y entregar; uno sin versión propia se limpia', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page);
  await page.locator('[data-empezar]').click();
  await page.locator('[data-item-examen="1"] [data-campo="r1"]').fill('11,75');
  await expect.poll(async () => (await borrador(page, id)) ?? '').toContain('11,75');
  // the exam is deleted on another device: its tombstone arrives (as the synchronisation stores it)
  await page.goto('#/');
  await page.evaluate((x) => {
    const d = JSON.parse(localStorage.getItem('epa:docente')!);
    const p = d.propios[x];
    const t = p.actualizado + 1000;
    d.propios[x] = { id: x, tipo: 'examen', titulo: p.titulo, notas: '', creado: p.creado, actualizado: t, borrado: t, version: 1 };
    localStorage.setItem('epa:docente', JSON.stringify(d));
    // and an old draft (without its own version) of another deleted exam
    d.propios.xviejo = { id: 'xviejo', tipo: 'examen', titulo: 'Viejo', notas: '', creado: 1, actualizado: 2, borrado: 2, version: 1 };
    localStorage.setItem('epa:docente', JSON.stringify(d));
    localStorage.setItem('epa:docente-en-curso:xviejo', JSON.stringify({ variante: 0, inicio: 1, respuestas: {}, actualizado: 1 }));
  }, id);
  await page.goto('#/docente');
  await page.reload();
  await expect(page.locator(`[data-intento-huerfano="${id}"]`)).toBeVisible();
  await expect.poll(() => borrador(page, 'xviejo')).toBeNull();
  expect(await borrador(page, id)).toContain('11,75');
  await page.locator(`[data-intento-huerfano="${id}"] a`).click();
  await expect(page.locator('[data-examen-borrado]')).toBeVisible();
  await expect(page.locator('[data-item-examen="1"] [data-campo="r1"]')).toHaveValue('11,75');
  await page.locator('[data-item-examen="2"]').getByRole('radio').nth(1).check();
  await page.locator('[data-entregar]').click();
  await expect(page).toHaveURL(/#\/docente\/resultado\//);
  await expect(page.locator('[data-nota-total]')).toContainText('de 3 puntos');
  await page.goto('#/docente');
  await expect(page.locator('[data-resultado-huerfano]')).toHaveCount(1);
  await expect(page.locator(`[data-intento-huerfano="${id}"]`)).toHaveCount(0);
});

test('borrar aquí un examen con un intento sin entregar lo dice en el diálogo', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page);
  await page.locator('[data-empezar]').click();
  await page.locator('[data-item-examen="1"] [data-campo="r1"]').fill('1');
  await page.goto('#/docente');
  await page.locator(`[data-propio="${id}"] [data-borrar]`).click();
  const d = page.getByRole('alertdialog', { name: '¿Borrar «Examen de diodos»?' });
  await expect(d).toContainText('Hay un intento de este examen sin entregar en este dispositivo');
  await d.getByRole('button', { name: 'Borrar' }).click();
  await expect.poll(() => borrador(page, id)).toBeNull();
});

test('si el borrador no se puede escribir, el examen lo dice', async ({ page }) => {
  await page.addInitScript(() => {
    const poner = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (this === localStorage && k.startsWith('epa:docente-en-curso:') && sessionStorage.getItem('lleno') === '1') throw new DOMException('lleno', 'QuotaExceededError');
      return poner.call(this, k, v);
    };
  });
  await limpio(page);
  await crearExamen(page);
  await page.locator('[data-empezar]').click();
  await page.locator('[data-item-examen="1"] [data-campo="r1"]').fill('1');
  await expect(page.locator('[data-fallo-borrador]')).toHaveCount(0);
  await page.evaluate(() => sessionStorage.setItem('lleno', '1'));
  await page.locator('[data-item-examen="1"] [data-campo="r1"]').fill('11,75');
  await expect(page.locator('[data-fallo-borrador]')).toContainText('no cierre ni recargue la página');
  await page.evaluate(() => sessionStorage.removeItem('lleno'));
  await page.locator('[data-item-examen="1"] [data-campo="r1"]').fill('11,7');
  await expect(page.locator('[data-fallo-borrador]')).toHaveCount(0);
});

test('«Usar aquí» de una pestaña en pausa pregunta antes si el editor tiene cambios sin guardar', async ({ context }) => {
  await context.route('https://api.github.com/**', (r) => r.fulfill({ status: 401, body: '{}' }));
  await context.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__epaPestanaUnica = true;
    w.__epaEsperasPestana = { ceder: 1500, propia: 1200, latido: 300 };
  });
  const estado = (p: Page) => p.evaluate(() => (window as unknown as { __epaEstadoPestana?: () => string }).__epaEstadoPestana?.() ?? '').catch(() => 'recargando');
  const a = await context.newPage();
  await a.goto('/#/');
  await expect.poll(() => estado(a)).toBe('activa');
  const id = await crearExamen(a);
  await a.goto(`#/docente/editar/${id}`);
  await a.locator('[data-titulo]').fill('Sin guardar');
  // another tab takes over: this one pauses
  const b = await abrirOtra(context);
  await b.locator('.epa-pestana').getByRole('button', { name: 'Usar aquí' }).click();
  await expect.poll(() => estado(b), { timeout: 20_000 }).toBe('activa');
  await expect.poll(() => estado(a), { timeout: 20_000 }).toBe('pausada');
  // «Usar aquí» in the paused editor asks; «Cancelar» keeps it paused, with the text as it was
  await a.locator('.epa-pestana').getByRole('button', { name: 'Usar aquí' }).click();
  const d = a.getByRole('alertdialog', { name: '¿Descartar los cambios?' });
  await expect(d).toBeVisible();
  await d.getByRole('button', { name: 'Cancelar' }).click();
  await expect(a.locator('.epa-pestana')).toBeVisible();
  expect(await estado(a)).toBe('pausada');
  await expect(a.locator('[data-titulo]')).toHaveValue('Sin guardar');
  // «Descartar»: it takes the app back (and reloads)
  await a.locator('.epa-pestana').getByRole('button', { name: 'Usar aquí' }).click();
  await a.getByRole('alertdialog', { name: '¿Descartar los cambios?' }).getByRole('button', { name: 'Descartar' }).click();
  await expect.poll(() => estado(a), { timeout: 20_000 }).toBe('activa');
});

async function abrirOtra(context: BrowserContext): Promise<Page> {
  const p = await context.newPage();
  await p.goto('/#/');
  await expect(p.locator('.epa-pestana')).toBeVisible();
  return p;
}

test('«Reiniciar para terminar» de una actualización pregunta antes a la página con cambios sin guardar', () => {
  const fuente = fs.readFileSync(new URL('../src/lib/sincronizacion/instalador.svelte.ts', import.meta.url), 'utf8');
  const f = fuente.slice(fuente.indexOf('export async function reiniciarParaTerminar'));
  expect(f.indexOf('if (!(await puedeSalir())) return;')).toBeGreaterThan(0);
  expect(f.indexOf('if (!(await puedeSalir())) return;')).toBeLessThan(f.indexOf("instalador.estado = 'instalando'"));
});
