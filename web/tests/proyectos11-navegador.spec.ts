// 1.1 «Proyectos por etapas» in the browser (lib/proyectos11/, componentes/proyectos11/): the IoT station's first two
// stages done end to end with the keyboard only (a wrong design first, its hint, the right one, «Siguiente etapa»), the
// circuit kept in «Mis circuitos» and opened in the editor with the stage's band, the progress record and the XP event;
// the entry points (chapter card and section chip, course path, editor); axe in light and dark and 360 px.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.proyectos11.config.ts tests/proyectos11-navegador.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { asentar, axe, limpio, sinHallazgos, type Tema } from './accesibilidad10-comun';

async function abrir(page: Page, ruta: string, tema: Tema = 'claro') {
  await limpio(page, tema);
  await page.addInitScript(() => ((window as unknown as { __epaEventos: unknown[] }).__epaEventos = []));
  await page.goto(`/#/${ruta}`);
  await asentar(page, 300);
}

/** Tab (forward) until the element is focused; fails if it takes more than `max` presses. */
async function tabHasta(page: Page, sel: string, max = 40) {
  for (let k = 0; k < max; k++) {
    if (await page.evaluate((s) => document.activeElement?.matches(s) ?? false, sel)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`no se llega con el tabulador a ${sel}`);
}

/** Writes a field by keyboard: select its text and type. */
async function escribir(page: Page, componente: string, valor: string) {
  await tabHasta(page, `input[data-componente="${componente}"]`);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(valor);
}

const eventos = (page: Page) =>
  page.evaluate(() =>
    ((window as unknown as { __epaEventos: { tipo: string; id: string; origen: string; correcta: boolean; final: boolean; intento: number }[] }).__epaEventos).filter(
      (e) => e.tipo === 'respuesta' && e.origen === 'proyecto',
    ),
  );

test('estación IoT, etapas 1 y 2 con el teclado: pista del fallo, superada, siguiente; registro, XP y editor', async ({ page }) => {
  await abrir(page, 'etapas/cap49/1');
  const etapa = page.locator('article[data-etapa="cap49-1"]');
  await expect(etapa.locator('h1')).toBeFocused();
  await expect(etapa.locator('input[data-componente="RPU"]')).toHaveValue('10k', { timeout: 30_000 });

  // 1 kΩ: too much current with the line low — the hint says which way
  await escribir(page, 'RPU', '1k');
  await page.keyboard.press('Enter');
  const resultado = etapa.locator('[data-resultado]');
  await expect(resultado).toHaveAttribute('data-resultado', 'mal', { timeout: 60_000 });
  await expect(resultado.locator('[data-condicion="ibaja"]')).not.toHaveAttribute('data-ok', '');
  await expect(resultado.locator('[data-condicion="ibaja"]')).toContainText('suba R');
  await expect(resultado.locator('[data-condicion="tsub"]')).toHaveAttribute('data-ok', '');
  await expect(etapa.locator('[data-anuncio]')).toContainText('Aún no');

  // the book's 4,7 kΩ: passed
  await page.locator('input[data-componente="RPU"]').focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('4,7k');
  await page.keyboard.press('Enter');
  await expect(resultado).toHaveAttribute('data-resultado', 'bien', { timeout: 60_000 });
  await expect(etapa.locator('[data-anuncio]')).toContainText('Etapa superada');
  let ev = await eventos(page);
  expect(ev.map((e) => [e.id, e.correcta, e.intento, e.final])).toEqual([
    ['proy-cap49-1', false, 1, false],
    ['proy-cap49-1', true, 2, true],
  ]);

  // the record: the circuit, the pass and its values, two checks
  const reg = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:proyectos') ?? 'null'));
  const r1 = reg.etapas['cap49-1'];
  expect(r1.h).toBeGreaterThan(0);
  expect(r1.n).toBe(2);
  expect(r1.m.v.RPU).toBe(4700);
  expect(r1.c).toMatch(/^c/);
  const circuitos = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:editor-circuitos') ?? 'null'));
  const c1 = circuitos.circuitos[r1.c];
  expect(c1.doc.origen).toEqual({ tipo: 'proyecto', id: 'cap49-1' });
  expect(c1.doc.componentes.find((c: { nombre: string }) => c.nombre === 'RPU').campos.valor).toBe('4,7k');

  // «Siguiente etapa» by keyboard
  await tabHasta(page, 'a[data-siguiente-etapa]');
  await page.keyboard.press('Enter');
  const e2 = page.locator('article[data-etapa="cap49-2"]');
  await expect(e2.locator('h1')).toBeFocused({ timeout: 30_000 });
  await expect(e2.locator('input[data-componente="RF"]')).toHaveValue('10k', { timeout: 30_000 });
  // segmented progress: stage 1 done, stage 2 the current one
  await expect(e2.locator('.segmentos a').nth(0)).toHaveClass(/hecho/);
  await expect(e2.locator('.segmentos a').nth(1)).toHaveAttribute('aria-current', 'step');

  await escribir(page, 'RF', '100k');
  await escribir(page, 'RG', '1k');
  await escribir(page, 'RR1', '100k');
  await escribir(page, 'RR2', '100k');
  await page.keyboard.press('Enter');
  const res2 = e2.locator('[data-resultado]');
  await expect(res2).toHaveAttribute('data-resultado', 'bien', { timeout: 60_000 });
  await expect(res2.locator('[data-condicion="gdb"]')).toContainText('40');
  ev = await eventos(page);
  expect(ev.at(-1)).toMatchObject({ id: 'proy-cap49-2', correcta: true, intento: 1, final: true });

  // the stage's circuit in the editor, with the band and the way back
  await page.goto('/#/etapas/cap49/1');
  await page.locator('a[data-editor-etapa]').click();
  await expect(page.locator('[data-banda-etapa="cap49-1"]')).toBeVisible({ timeout: 60_000 });
  await page.locator('a[data-volver-etapa]').click();
  await expect(page.locator('article[data-etapa="cap49-1"] input[data-componente="RPU"]')).toHaveValue('4,7k', { timeout: 30_000 });
  // a stage passed stays passed; a check again gives no second award
  await expect(page.locator('article[data-etapa="cap49-1"] .segmentos a').nth(0)).toHaveClass(/hecho/);
});

test('entradas: tarjeta y chip en el capítulo, nodo del curso, editor, índice', async ({ page }) => {
  await abrir(page, 'cap50');
  await expect(page.locator('[data-proyecto-capitulo="cap50"]')).toContainText('Empezar la etapa 1', { timeout: 60_000 });
  await expect(page.locator('[data-ver-etapa="cap50-1"]').first()).toBeAttached();
  await page.goto('/#/cap48');
  await expect(page.locator('[data-proyecto-capitulo="cap48"] a')).toHaveCount(4, { timeout: 60_000 });
  await page.goto('/#/cursos/proyectos');
  await asentar(page, 300);
  await expect(page.locator('[data-nodo="proyecto/cap50"], [data-proyecto-curso="cap50"]').first()).toBeAttached({ timeout: 30_000 });
  await page.goto('/#/editor');
  await expect(page.locator('a[data-editor-proyectos]')).toBeVisible({ timeout: 60_000 });
  await page.goto('/#/etapas');
  await expect(page.locator('[data-proyecto-indice]')).toHaveCount(4);
});

for (const tema of ['claro', 'oscuro'] as Tema[])
  test(`accesibilidad (${tema}): índice, etapa con resultado y diseño de referencia`, async ({ page }) => {
    await abrir(page, 'etapas', tema);
    sinHallazgos(await axe(page, 'main'), `índice ${tema}`);
    await page.goto('/#/etapas/cap52/2');
    const e = page.locator('article[data-etapa="cap52-2"]');
    await expect(e.locator('input[data-componente="RG"]')).toHaveValue('1k', { timeout: 30_000 });
    // two failed checks: the result card and the reference design are offered
    await e.locator('[data-comprobar-etapa]').click();
    await expect(e.locator('[data-resultado]')).toHaveAttribute('data-resultado', 'mal', { timeout: 60_000 });
    await e.locator('[data-comprobar-etapa]').click();
    await expect(e.locator('[data-ver-referencia]')).toBeVisible({ timeout: 60_000 });
    await e.locator('[data-ver-referencia]').click();
    // (review 11c: seeing it is asked first — the stage gives no XP from then on)
    await page.getByRole('alertdialog').getByRole('button', { name: 'Ver el diseño' }).click();
    await expect(e.locator('[data-usar-referencia]')).toBeVisible();
    await asentar(page, 300);
    sinHallazgos(await axe(page, 'main'), `etapa ${tema}`);
  });

test('360 px: sin desbordes en el índice, la etapa y la lista del proyecto', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  for (const ruta of ['etapas', 'etapas/cap50/1', 'etapas/cap51']) {
    await abrir(page, ruta);
    if (ruta.endsWith('/1')) await expect(page.locator('input[data-componente="vsec"]')).toHaveValue('24', { timeout: 30_000 });
    const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vista: window.innerWidth }));
    expect(ancho.doc, ruta).toBeLessThanOrEqual(ancho.vista);
    // every control is at least 44 px high
    const bajos = await page.evaluate(() =>
      [...document.querySelectorAll('main a, main button, main input')]
        .filter((x) => (x as HTMLElement).offsetParent && !x.closest('nav.miga') && x.getBoundingClientRect().height < 43.5)
        .map((x) => x.outerHTML.slice(0, 80)),
    );
    expect(bajos, ruta).toEqual([]);
  }
});
