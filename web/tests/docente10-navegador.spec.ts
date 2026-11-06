// 1.0 «modo docente» in the browser: create an exam by hand and with the filters, take it (answers kept across a
// reload, no hints, the clock), hand it in, the grade per item and the total with the book's development, the
// self-assessment of an open part, the PDFs downloaded and read back (pages, text, no character without a glyph, every
// formula; the same bytes as the same exam made in Node), a course played like the thematic ones and its outline,
// edit / duplicate / delete with the app's dialog, the time running out, keyboard, 44 px and axe in three themes.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.docente10.config.ts tests/docente10-navegador.spec.ts
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { cargarLibro, recursosNode } from './docente10/libro-node';
import { leerPdf, plano } from './docente10/leer-pdf';
import { montarExamen } from '../src/lib/docente/examen';
import { documentoExamen, documentoSoluciones } from '../src/lib/docente/pdf/documento';
import { generarPdf } from '../src/lib/docente/pdf/maquetar';
import type { ExamenPropio } from '../src/lib/docente/tipos';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const L = cargarLibro();
const FECHA = '6 de noviembre de 2026';

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

const entrada = (page: Page, clave: string) => page.locator(`li[data-entrada="${clave}"] [data-anadir]`);

async function anadir(page: Page, parte: string, claves: string[]) {
  await page.locator('[data-filtro-parte]').selectOption(parte);
  for (const c of claves) await entrada(page, c).click();
}

/** Creates the exam of the first tests by hand: no variants, no shuffling (its answers are known). */
async function crearExamen(page: Page, titulo = 'Examen de diodos'): Promise<string> {
  await page.goto('#/docente');
  await page.locator('[data-nuevo-examen]').click();
  await expect(page.locator('[data-selector]')).toBeVisible();
  await page.locator('[data-titulo]').fill(titulo);
  await page.locator('[data-notas]').fill('Responda con las unidades.');
  await page.locator('[data-minutos]').fill('30');
  await page.locator('[data-variantes]').uncheck();
  await page.locator('[data-barajar]').uncheck();
  await anadir(page, 'cap01', ['ejercicio:ej-1.1']);
  await anadir(page, 'cap05', ['pregunta:cap05-01', 'pregunta:cap05-02', 'ejercicio:ej-5.9']);
  await expect(page.locator('[data-elegido]')).toHaveCount(4);
  await expect(page.locator('#h-elegidos')).toContainText('6 puntos');
  await page.locator('[data-guardar]').click();
  await expect(page).toHaveURL(/#\/docente\/examen\/x[a-z0-9]+$/);
  return decodeURIComponent(new URL(page.url()).hash).split('/').pop()!;
}

async function descargarPdf(page: Page): Promise<Uint8Array> {
  const [d] = await Promise.all([page.waitForEvent('download'), page.locator('[data-pdf-generar]').click()]);
  await expect(page.locator('[data-pdf-estado]')).toContainText('PDF descargado');
  const ruta = await d.path();
  return new Uint8Array(fs.readFileSync(ruta!));
}

const informe = (page: Page) => page.evaluate(() => (window as unknown as { __epaUltimoPdf: { paginas: number; faltan: string[]; graficos: { fallidos: string[]; aproximados: number } } }).__epaUltimoPdf);

test('examen: crear, hacer (sin pistas, con el borrador tras recargar), entregar, nota por pregunta, autoevaluar', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page);
  await expect(page.locator('h1')).toHaveText('Examen de diodos');
  await page.locator('[data-empezar]').click();
  await expect(page).toHaveURL(new RegExp(`#/docente/examen/${id}/hacer$`));
  await expect(page.locator('[data-reloj]')).toContainText(/^\s*(30:00|29:5\d)/);
  const item = (n: number) => page.locator(`[data-item-examen="${n}"]`);
  // no hints, no checking, no solution while it is taken
  await expect(page.getByRole('button', { name: /Pista|Comprobar|Ver solución/ })).toHaveCount(0);
  await item(1).locator('[data-campo="r1"]').fill('11,75');
  await item(1).locator('[data-campo="r2"]').fill('294 mW');
  await item(1).getByRole('radio', { name: 'No' }).check();
  // the draft survives a reload, with the clock's start
  await page.reload();
  await expect(item(1).locator('[data-campo="r1"]')).toHaveValue('11,75');
  await expect(item(1).getByRole('radio', { name: 'No' })).toBeChecked();
  await item(2).getByRole('radio', { name: /estructura de bandas/ }).check();
  await item(3).locator('[data-campo="r"]').fill('1,12');
  // handing in with an unanswered question asks first (the app's dialog)
  await page.locator('[data-entregar]').click();
  const dialogo = page.getByRole('alertdialog', { name: '¿Entregar el examen?' });
  await expect(dialogo).toContainText('Hay 1 pregunta sin responder');
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await item(4).locator('[data-campo="texto"]').fill('Un diodo hacia +3,3 V y otro desde masa.');
  await page.locator('[data-entregar]').click();
  await expect(page).toHaveURL(/#\/docente\/resultado\/r[a-z0-9]+$/);
  await expect(page.locator('[data-nota-total]')).toContainText('4 de 6 puntos');
  await expect(page.locator('[data-item-resultado="1"]')).toHaveAttribute('data-estado', 'bien');
  await expect(page.locator('[data-item-resultado="2"]')).toHaveAttribute('data-estado', 'bien');
  await expect(page.locator('[data-item-resultado="3"]')).toHaveAttribute('data-estado', 'bien');
  await expect(page.locator('[data-item-resultado="4"]')).toHaveAttribute('data-estado', 'pendiente');
  await expect(page.locator('[data-pendientes]')).toBeVisible();
  // the book's development of each item
  await expect(page.locator('[data-item-resultado="1"] .desarrollo-libro')).toContainText('Solución 1.1 del libro');
  await expect(page.locator('[data-item-resultado="2"] .cita')).toContainText('Del libro · Sección 5.1');
  await expect(page.locator('[data-item-resultado="4"] .escrita')).toContainText('Un diodo hacia +3,3 V');
  await page.locator('[data-autoeval="4"]').getByRole('button', { name: 'A medias' }).click();
  await expect(page.locator('[data-nota-total]')).toContainText('5 de 6 puntos');
  await page.locator('[data-autoeval="4"]').getByRole('button', { name: 'Bien' }).click();
  await expect(page.locator('[data-nota-total]')).toContainText('6 de 6 puntos');
  await expect(page.locator('[data-pendientes]')).toHaveCount(0);
  // stored (and synchronised as «docente-resultados»): kept after a reload
  await page.reload();
  await expect(page.locator('[data-nota-total]')).toContainText('6 de 6 puntos');
  const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:docente-resultados') ?? '{}'));
  const rs = Object.values(guardado.resultados) as { examen: string; puntos: number; items: { estado: string; autoeval?: number }[] }[];
  expect(rs).toHaveLength(1);
  expect(rs[0]!.examen).toBe(id);
  expect(rs[0]!.puntos).toBe(6);
  expect(rs[0]!.items[3]!.autoeval).toBe(1);
  // the draft is gone; the exam page lists the result
  expect(await page.evaluate((i) => localStorage.getItem(`epa:docente-en-curso:${i}`), id)).toBeNull();
  await page.goto(`#/docente/examen/${id}`);
  await expect(page.locator('[data-resultado]')).toHaveCount(1);
  await expect(page.locator('[data-resultado]')).toContainText('6 de 6');
});

test('PDF del examen y de las soluciones: se descargan, se leen y son los mismos bytes que en Node', async ({ page }) => {
  test.setTimeout(240_000);
  await limpio(page);
  const id = await crearExamen(page, 'Examen para imprimir');
  await page.locator('[data-pdf-fecha]').fill(FECHA);
  const bytes = await descargarPdf(page);
  const inf = await informe(page);
  expect(inf.faltan).toEqual([]);
  expect(inf.graficos.fallidos).toEqual([]);
  const l = await leerPdf(bytes);
  expect(l.paginas).toBe(inf.paginas);
  expect(l.fuentes.filter((f) => !f.incrustada)).toEqual([]);
  const texto = plano(l.texto.join(' '));
  for (const t of ['Examen para imprimir', 'Nombre:', `Fecha: ${FECHA}`, 'Variante A', '4 preguntas', '6 puntos', '30 minutos', 'Responda con las unidades.', '1. Ejercicio 1.1 (2 puntos)', '¿Qué criterio usa el libro para distinguir conductores']) expect(texto.includes(t), t).toBe(true);
  // the same exam made in Node with the same code and fonts: byte for byte
  const p = (await page.evaluate((i) => JSON.parse(localStorage.getItem('epa:docente') ?? '{}').propios[i], id)) as ExamenPropio;
  const ex = montarExamen(p.examen!, L.libro, 0);
  const o = { titulo: p.titulo, notas: p.notas, fecha: FECHA, espacio: p.examen!.espacio, creado: p.actualizado };
  const nodo = await generarPdf(documentoExamen(ex, L.libro, o), recursosNode);
  expect(Buffer.from(nodo.bytes).equals(Buffer.from(bytes))).toBe(true);
  // again: the same file
  expect(Buffer.from(await descargarPdf(page)).equals(Buffer.from(bytes))).toBe(true);
  // the solutions
  await page.locator('[data-pdf-tipo="soluciones"]').check();
  const sol = await descargarPdf(page);
  const ls = await leerPdf(sol);
  const ts = plano(ls.texto.join(' '));
  for (const t of ['Soluciones', 'Solución 1.1 del libro', 'Respuesta: B)', 'Del libro · Sección 5.1', 'Respuesta: 1,12 eV']) expect(ts.includes(t), t).toBe(true);
  expect((await informe(page)).faltan).toEqual([]);
  const nodoSol = await generarPdf(documentoSoluciones(ex, L.libro, o), recursosNode);
  expect(Buffer.from(nodoSol.bytes).equals(Buffer.from(sol))).toBe(true);
});

test('examen por filtros con variantes: elegir al azar, cada variante su PDF, la B distinta de la A', async ({ page }) => {
  test.setTimeout(240_000);
  await limpio(page);
  await page.goto('#/docente/nuevo/examen');
  await expect(page.locator('[data-selector]')).toBeVisible();
  await page.locator('[data-titulo]').fill('Condensadores al azar');
  await page.locator('[data-filtro-parte]').selectOption('cap03');
  await page.locator('[data-filtro-tipo="ejercicio"]').click();
  await page.locator('[data-filtro-auto]').check();
  const n = Number((await page.locator('[data-cuenta-filtro]').textContent())!.match(/\d+/)![0]);
  expect(n).toBeGreaterThan(5);
  await page.locator('[data-cantidad]').fill('5');
  await page.locator('[data-cantidad]').dispatchEvent('change');
  await page.locator('[data-elegir-azar]').click();
  await expect(page.locator('[data-elegido]')).toHaveCount(5);
  // the concept filter narrows the list to one section
  await page.locator('[data-filtro-concepto]').selectOption({ index: 1 });
  expect(Number((await page.locator('[data-cuenta-filtro]').textContent())!.match(/\d+/)![0])).toBeLessThan(n);
  await page.locator('[data-guardar]').click();
  await expect(page).toHaveURL(/#\/docente\/examen\//);
  await page.locator('[data-pdf-fecha]').fill(FECHA);
  const a = await descargarPdf(page);
  await page.locator('[data-pdf-variante]').selectOption('1');
  const b = await descargarPdf(page);
  expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  expect(plano((await leerPdf(b)).texto.join(' ')).includes('Variante B')).toBe(true);
  await page.locator('[data-pdf-variante]').selectOption('0');
  expect(Buffer.from(await descargarPdf(page)).equals(Buffer.from(a))).toBe(true);
});

test('el tiempo se acaba: el examen se entrega solo', async ({ page }) => {
  await limpio(page);
  await page.clock.install();
  await page.goto('#/docente/nuevo/examen');
  await expect(page.locator('[data-selector]')).toBeVisible();
  await page.locator('[data-titulo]').fill('Un minuto');
  await page.locator('[data-minutos]').fill('1');
  await anadir(page, 'cap05', ['pregunta:cap05-01']);
  await page.locator('[data-guardar]').click();
  await page.locator('[data-empezar]').click();
  await expect(page.locator('[data-reloj]')).toBeVisible();
  await page.locator('[data-item-examen="1"]').getByRole('radio').first().check();
  await page.clock.fastForward('01:05');
  await expect(page).toHaveURL(/#\/docente\/resultado\//);
  await expect(page.locator('.meta')).toContainText('se acabó el tiempo');
});

test('curso propio: crear, seguirlo como los cursos temáticos y exportar su índice', async ({ page }) => {
  await limpio(page);
  await page.goto('#/docente');
  await page.locator('[data-nuevo-curso]').click();
  await expect(page.locator('[data-selector]')).toBeVisible();
  await page.locator('[data-titulo]').fill('Diodos a mi manera');
  await page.locator('[data-filtro-parte]').selectOption('cap05');
  await page.locator('[data-anadir-seccion="cap05/sec-5.1"]').click();
  await entrada(page, 'ejercicio:ej-5.9').click();
  await entrada(page, 'pregunta:cap05-01').click();
  await expect(page.locator('[data-elegido]')).toHaveCount(3);
  await page.locator('[data-guardar]').click();
  await expect(page).toHaveURL(/#\/docente\/curso\/c[a-z0-9]+$/);
  await expect(page.locator('[data-avance-curso]')).toHaveText('0 de 3 hechos');
  await expect(page.locator('[data-continuar]')).toHaveAttribute('href', /^#\/leccion\/cap05\/sec-5\.1/);
  // 1.0 (Brilliant): a course opens as a path; the list view keeps the element links used here
  await page.locator('[data-vista="lista"]').click();
  // the question, one per screen, with the Repaso component: answering it right marks it done
  await page.locator('[data-elemento="2"]').click();
  await expect(page.getByText('Pregunta 3 de 3')).toBeVisible();
  await page.getByRole('button', { name: /estructura de bandas/ }).click();
  await page.locator('[data-anterior]').click();
  await expect(page.locator('.tarjeta-ej[data-label="ej-5.9"]')).toBeVisible();
  await page.goto(page.url().replace(/\/\d+$/, ''));
  await expect(page.locator('[data-elemento="2"]')).toHaveAttribute('data-estado', 'hecho', { timeout: 15_000 });
  await expect(page.locator('[data-avance-curso]')).toHaveText('1 de 3 hechos');
  await expect(page.locator('[data-continuar]')).toHaveText(/Continuar/);
  const bytes = await descargarPdf(page);
  const t = plano((await leerPdf(bytes)).texto.join(' '));
  for (const x of ['Diodos a mi manera', 'Sección 5.1', 'Ejercicio 5.9', 'Pregunta de test 1']) expect(t.includes(x), x).toBe(true);
  expect((await informe(page)).faltan).toEqual([]);
});

test('editar, duplicar y borrar (con el diálogo propio); Intro en el buscador no guarda; el teclado mueve los elementos', async ({ page }) => {
  await limpio(page);
  const id = await crearExamen(page, 'Original');
  await page.goto(`#/docente/editar/${id}`);
  await expect(page.locator('[data-elegido]')).toHaveCount(4);
  // Intro in the search box filters, it does not save
  await page.locator('[data-filtro-texto]').fill('diodo');
  await page.locator('[data-filtro-texto]').press('Enter');
  await expect(page).toHaveURL(new RegExp(`#/docente/editar/${id}$`));
  // move the second item up with the keyboard: the focus follows it
  const sube = page.locator('#mover-1-sube');
  await sube.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-elegido]').first()).toHaveAttribute('data-elegido', 'pregunta:cap05-01');
  await expect(page.locator('#mover-0-sube')).toBeDisabled();
  await page.locator('[data-elegido]').nth(1).locator('[data-puntos]').fill('3');
  await page.locator('[data-titulo]').fill('Original cambiado');
  await page.locator('[data-guardar]').click();
  await expect(page.locator('h1')).toHaveText('Original cambiado');
  await expect(page.locator('.meta').first()).toContainText('7 puntos');
  // duplicate
  await page.goto('#/docente');
  await page.locator(`[data-propio="${id}"] [data-duplicar]`).click();
  await expect(page).toHaveURL(/#\/docente\/editar\//);
  await expect(page.locator('[data-titulo]')).toHaveValue('Original cambiado (copia)');
  // cancel with changes asks first
  await page.locator('[data-titulo]').fill('Otro');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('alertdialog', { name: '¿Descartar los cambios?' }).getByRole('button', { name: 'Descartar' }).click();
  await page.goto('#/docente');
  await expect(page.locator('[data-propio]')).toHaveCount(2);
  // delete: the app's dialog, a tombstone kept for the synchronisation
  await page.locator(`[data-propio="${id}"] [data-borrar]`).click();
  const d = page.getByRole('alertdialog', { name: '¿Borrar «Original cambiado»?' });
  await d.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('[data-propio]')).toHaveCount(2);
  await page.locator(`[data-propio="${id}"] [data-borrar]`).click();
  await d.getByRole('button', { name: 'Borrar' }).click();
  await expect(page.locator('[data-propio]')).toHaveCount(1);
  const g = await page.evaluate((i) => JSON.parse(localStorage.getItem('epa:docente') ?? '{}').propios[i], id);
  expect(g.borrado).toBeGreaterThan(g.creado);
  expect(g.borrado).toBe(g.actualizado);
  expect(g.examen).toBeUndefined();
});

test('el modo docente está en el menú de herramientas («Más») y en el carril', async ({ page }) => {
  await limpio(page);
  // a tall window: in the rail
  await page.setViewportSize({ width: 1366, height: 1100 });
  await page.goto('#/');
  await expect(page.locator('a[href="#/docente"]:visible')).toHaveCount(1);
  // a low one: the least used entries go to «Más», this one first
  await page.setViewportSize({ width: 1366, height: 640 });
  await page.reload();
  await expect(page.locator('a[href="#/docente"]:visible')).toHaveCount(0);
  await page.getByRole('button', { name: 'Más' }).first().click();
  await page.locator('a[href="#/docente"]:visible').click();
  await expect(page).toHaveURL(/#\/docente$/);
  await expect(page.locator('h1')).toHaveText('Modo docente');
});

async function tactil(browser: Browser, tema: 'claro' | 'sepia' | 'oscuro') {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await limpio(page, tema);
  return { ctx, page };
}

test('teléfono: 44 px, sin desbordar, y axe (contraste incluido) en claro, sepia y oscuro', async ({ browser }) => {
  test.setTimeout(300_000);
  for (const tema of ['claro', 'sepia', 'oscuro'] as const) {
    const { ctx, page } = await tactil(browser, tema);
    const id = await crearExamen(page, `Examen ${tema}`);
    const paginas: [string, string][] = [
      ['#/docente', '[data-docente]'],
      [`#/docente/editar/${id}`, '[data-editor]'],
      [`#/docente/examen/${id}`, '[data-examen-propio]'],
    ];
    for (const [ruta, sel] of paginas) {
      await page.goto(ruta);
      await expect(page.locator(sel)).toBeVisible();
      if (ruta.includes('editar')) await page.locator('[data-filtro-parte]').selectOption('cap05');
      await revisar(page, sel, `${tema} ${ruta}`);
    }
    await page.locator('[data-empezar]').click();
    await expect(page.locator('[data-hacer-examen]')).toBeVisible();
    await page.locator('[data-item-examen="4"] [data-campo="texto"]').fill('Algo');
    await revisar(page, '[data-hacer-examen]', `${tema} hacer`);
    await page.locator('[data-entregar]').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Entregar' }).click();
    await expect(page.locator('[data-resultado-examen]')).toBeVisible();
    await expect(page.locator('[data-nota-total]')).toBeVisible();
    await revisar(page, '[data-resultado-examen]', `${tema} resultado`);
    await ctx.close();
  }
});

async function revisar(page: Page, sel: string, nombre: string) {
  const pequenos = await page.locator(sel).evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>('a, button, input, select, textarea, label.opcion, .t09-chip')]
      .filter((x) => x.offsetParent && !(x instanceof HTMLInputElement && (x.type === 'radio' || x.type === 'checkbox')) && !x.closest('.texto-libro'))
      .map((x) => ({ n: (x.textContent || x.getAttribute('aria-label') || x.tagName).trim().slice(0, 30), r: x.getBoundingClientRect(), ok: getComputedStyle(x, '::after').width }))
      .filter((x) => (x.r.height < 44 || x.r.width < 44) && !(parseFloat(x.ok) >= 44))
      .map((x) => `${x.n} ${Math.round(x.r.width)}×${Math.round(x.r.height)}`),
  );
  expect(pequenos, nombre).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), nombre).toBeLessThanOrEqual(0);
  await page.addScriptTag({ path: AXE });
  const v = await page.evaluate(async (s) => {
    const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
    const r = await axe.run({ include: [[s]] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
    return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(', ')}`);
  }, sel);
  expect(v, nombre).toEqual([]);
}
