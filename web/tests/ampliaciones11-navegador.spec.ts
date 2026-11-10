// 1.1: the book's expansions in the browser (contenido/ampliaciones11/, contenido/ampliaciones.py), short on purpose: the
// new chapter (P03) after chapter 30, numbered 31, with its «Aún no en el libro» mark; a new section (P01, 23.10) and
// the summary after it renumbered; an exercise of the expansion answered and checked; one of its circuits opened in the
// schematic editor and in the simulator; axe (contrast included) in the light and dark themes; and at 360 px, no
// horizontal scroll. Since the second batch: P02's chapter 34 (and 35 after it), the old 32.13 that P02 absorbs opening
// where its content went (book links, bookmarks, the 1.0 lesson's route), P08's new 0.13 with its 1.1 lesson, and the
// app's own texts that cite the book by number (a project stage, the simulator's search) in the current numbering.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.ampliaciones11.config.ts tests/ampliaciones11-navegador.spec.ts
import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

async function limpio(page: Page, tema: 'claro' | 'oscuro'): Promise<void> {
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

async function axe(page: Page, sel: string): Promise<string[]> {
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ path: AXE });
  return page.evaluate(async (s) => {
    const a = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
    const r = await a.run({ include: [[s]] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] });
    return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  }, sel);
}

test('el capítulo nuevo y una sección nueva, marcados; un ejercicio resuelto; un circuito en el editor; axe en claro y oscuro', async ({ browser }) => {
  test.setTimeout(240_000);
  for (const tema of ['claro', 'oscuro'] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    await limpio(page, tema);

    // the new chapter: after «Control y Comunicaciones» (30), numbered 31, with its mark under the title
    await page.goto('#/cap-new-automatas');
    const apertura = page.locator('header.apertura');
    await expect(apertura.locator('h1')).toHaveText('Automatismos y Autómatas Programables');
    await expect(apertura.locator('.rotulo .numero')).toHaveText('31');
    await expect(apertura.locator('.ampliacion-cap [data-nuevo]')).toHaveText('Aún no en el libro');
    await expect(page.locator('nav.en-este li')).toHaveCount(9);
    await expect(page.locator('[id="sec-new-automatas.1"]')).toContainText('31.1');
    // its first section carries its own mark too, and no loose mark before the chapter's blocks
    await expect(page.locator('.seccion-cab').first().locator('[data-nuevo]')).toBeVisible();
    await expect(page.locator('.ampliacion-bloque')).toHaveCount(0);
    expect(await axe(page, 'header.apertura'), `${tema}: apertura`).toEqual([]);
    expect(await axe(page, 'nav.en-este'), `${tema}: en este capítulo`).toEqual([]);
    expect(await axe(page, '.seccion-cab'), `${tema}: sección`).toEqual([]);

    // the chapter that followed it takes the next number
    await page.goto('#/cap32');
    await expect(page.locator('header.apertura .rotulo .numero')).toHaveText('32');
    await expect(page.locator('header.apertura [data-nuevo]')).toHaveCount(0);

    // P01: 23.10 Sistemas Trifásicos, marked; the summary after it is 23.11
    await page.goto('#/cap24/sec-new-24-trifasica');
    const sec = page.locator('.seccion-cab:has([id="sec-new-24-trifasica"])');
    await expect(sec.locator('h2')).toContainText('23.10');
    await expect(sec.locator('.ampliacion-sec [data-nuevo]')).toHaveText('Aún no en el libro');
    await expect(page.locator('[id="sec-24.10"]')).toContainText('23.11');
    await expect(page.locator('nav.en-este li', { hasText: 'Sistemas Trifásicos' }).locator('[data-nuevo]')).toBeVisible();
    expect(await axe(page, '.seccion-cab:has([id="sec-new-24-trifasica"])'), `${tema}: sección nueva`).toEqual([]);

    // an exercise of the expansion, marked, answered as on paper and checked
    await page.goto('#/cap24/ej-24.10');
    const ej = page.locator('.ejercicio[id="ej-24.10"]');
    await expect(ej.locator('.ejercicio-num')).toHaveText('Ejercicio 23.10.');
    await expect(ej.locator('[data-nuevo]')).toBeVisible();
    if (tema === 'claro') {
      const p = page.locator('.comprobador[data-label="ej-24.10"]');
      await p.locator('#cmp-ej-24_10-r1').fill('4,62 A');
      await p.locator('#cmp-ej-24_10-r2').fill('0,6');
      await p.locator('#cmp-ej-24_10-r3').fill('1920 W');
      await p.locator('#cmp-ej-24_10-r4').fill('2,56 kVAr');
      await p.locator('#cmp-ej-24_10-r5').fill('3200 VA');
      await p.getByRole('button', { name: 'Comprobar' }).click();
      await expect(p.locator('.fb-bien')).toHaveCount(5);
    }
    expect(await axe(page, '.ejercicio[id="ej-24.10"]'), `${tema}: ejercicio`).toEqual([]);

    if (tema === 'claro') {
      // one of its circuits: marked in the simulator, drawn in the schematic editor like the book's
      await page.goto('#/simulador/cap24/n7_ej10_estrella');
      await expect(page.locator('header.cab .meta [data-nuevo]')).toBeVisible();
      await page.goto('#/editor/libro/cap24/n7_ej10_estrella');
      await expect(page.locator('.lienzo')).toBeVisible();
      await page.waitForFunction(() => ((window as unknown as { __epaEditor?: { ed: { doc: { componentes: unknown[] } } } }).__epaEditor?.ed.doc.componentes.length ?? 0) >= 9);
      const tipos = await page.evaluate(() =>
        (window as unknown as { __epaEditor: { ed: { doc: { componentes: { tipo: string }[] } } } }).__epaEditor.ed.doc.componentes.map((c) => c.tipo).sort(),
      );
      expect(tipos.filter((t) => t === 'R')).toHaveLength(3);
      expect(tipos.filter((t) => t === 'L')).toHaveLength(3);
    }
    await ctx.close();
  }
});

test('a 360 px: el capítulo nuevo y la sección nueva, con su marca y sin desplazamiento horizontal', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await limpio(page, 'claro');
  for (const [hash, sel] of [
    ['#/cap-new-automatas', 'header.apertura [data-nuevo]'],
    ['#/cap24/sec-new-24-trifasica', '.seccion-cab:has([id="sec-new-24-trifasica"]) [data-nuevo]'],
    ['#/cap33/prob-33.D', '.ampliacion-bloque [data-nuevo]'],
  ] as const) {
    await page.goto(hash);
    await expect(page.locator(sel).first()).toBeVisible();
    await page.waitForTimeout(300);
    const { ancho, cliente } = await page.evaluate(() => ({ ancho: document.documentElement.scrollWidth, cliente: document.documentElement.clientWidth }));
    expect(ancho, hash).toBeLessThanOrEqual(cliente);
    const caja = await page.locator(sel).first().boundingBox();
    expect(caja!.x + caja!.width, hash).toBeLessThanOrEqual(360);
  }
  await ctx.close();
});

test('P02 y P08: el capítulo 34 nuevo, la 32.13 retirada lleva a su contenido, la 0.13 nueva con su lección; los números de la app al día', async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  await limpio(page, 'claro');
  // P02: after «Electrónica de Potencia» (33), numbered 34, marked; the chapter after it is 35
  await page.goto('#/cap-new-maquinas');
  const apertura = page.locator('header.apertura');
  await expect(apertura.locator('h1')).toHaveText('Máquinas Eléctricas y Accionamientos');
  await expect(apertura.locator('.rotulo .numero')).toHaveText('34');
  await expect(apertura.locator('.ampliacion-cap [data-nuevo]')).toHaveText('Aún no en el libro');
  await expect(page.locator('nav.en-este li')).toHaveCount(8);
  expect(await axe(page, 'header.apertura')).toEqual([]);
  await page.goto('#/cap34');
  await expect(page.locator('header.apertura .rotulo .numero')).toHaveText('35');
  // the old 32.13 (a bookmark, a note, an old link) opens where its content went, and so does its 1.0 lesson
  await page.goto('#/cap33/sec-33.13');
  await expect(page).toHaveURL(/#\/cap-new-maquinas\/sec-new-maquinas\.3$/);
  await expect(page.locator('[id="sec-new-maquinas.3"]')).toContainText('34.3');
  await page.goto('#/leccion/cap33/sec-33.13');
  await expect(page).toHaveURL(/#\/leccion\/cap-new-maquinas\/sec-new-maquinas\.3$/);
  // the book's own reference to it (34.5 of cap35, the BLDC's rotor position) goes to the right section
  await page.goto('#/cap35/sec-35.5');
  await expect(page.locator('a.ref[data-ref="sec-new-maquinas.5"]').first()).toHaveText('34.5');
  // P08: 0.13 new, marked, and the old 0.13 is 0.14; its 1.1 lesson opens
  await page.goto('#/cap00/sec-new-0-numericos');
  const sec = page.locator('.seccion-cab:has([id="sec-new-0-numericos"])');
  await expect(sec.locator('h2')).toContainText('0.13');
  await expect(sec.locator('.ampliacion-sec [data-nuevo]')).toBeVisible();
  await expect(page.locator('[id="sec-0.13"]')).toContainText('0.14');
  await page.goto('#/leccion/cap00/sec-new-0-numericos');
  await expect(page.locator('[data-leccion11]')).toBeVisible();
  await expect(page.locator('[data-leccion11] h2, [data-leccion11] h1').first()).toBeVisible();
  // the app's own texts quote the current numbers (ejercicio 49.5 of 1.0 is 51.5; figura 41.5 is 43.5)
  await page.goto('#/etapas/cap50/3');
  await expect(page.getByText('(ejercicio 51.5)')).toBeVisible();
  await page.goto('#/simulador');
  await expect(page.locator('input[type="search"][aria-label="Buscar netlists"]')).toHaveAttribute('placeholder', /figura 43\.5,/);
  await ctx.close();
});
