// «Aprender con el libro» end to end: answers checked with prefixes and decimal comma, close answers, hints
// one by one, the book's solution, a problem panel that hides the analysis, step-by-step derivations, the
// review of failed exercises, sections read (by hand and automatically) and everything kept after a reload;
// screenshots (phone, 1280 × 800 at DPR 2, tablet portrait; light and dark) into tests/capturas/.
import { expect, test, type Page } from '@playwright/test';

async function tema(page: Page, t: 'claro' | 'oscuro'): Promise<void> {
  await page.addInitScript((x) => {
    try {
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: x, tam: 18 }));
    } catch {
      /* private mode */
    }
  }, t);
}

function campo(page: Page, label: string, r: string) {
  return page.locator(`#cmp-${label.replace(/[^\w-]/g, '_')}-${r}`);
}

function panel(page: Page, label: string) {
  return page.locator(`.comprobador[data-label="${label}"]`);
}

test('respuesta correcta con prefijos, código RKM y coma decimal', async ({ page }) => {
  await page.goto('#/cap05/ej-5.1');
  const p = panel(page, 'ej-5.1');
  await expect(p).toBeVisible();
  await campo(page, 'ej-5.1', 'r1').fill('0,44 k');
  await campo(page, 'ej-5.1', 'r2').fill('470');
  await campo(page, 'ej-5.1', 'r3').fill('165 mW');
  await campo(page, 'ej-5.1', 'r3').press('Enter');
  await expect(p.locator('.fb-bien')).toHaveCount(3);
  await expect(p.locator('.estado')).toContainText('Resuelto a la primera');
  await expect(page.locator('#ej-5\\.1 .marca-ok')).toBeVisible();
});

test('respuesta cercana: prefijo equivocado, a menos del 10 % y error', async ({ page }) => {
  await page.goto('#/cap01/ej-1.3');
  const p = panel(page, 'ej-1.3');
  await expect(p).toBeVisible();
  await campo(page, 'ej-1.3', 'r1').fill('0,132'); // 132 Ω written as if in kΩ
  await campo(page, 'ej-1.3', 'r2').fill('39 mA'); // 37,9 mA: 3 % off
  await campo(page, 'ej-1.3', 'r3').fill('4k7'); // a unit-less RKM for a current
  await campo(page, 'ej-1.3', 'r4').fill('5 mA');
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await expect(p.locator('[data-r="r1"] .fb-cerca')).toContainText('prefijo');
  await expect(p.locator('[data-r="r2"] .fb-cerca')).toContainText('Cerca');
  await expect(p.locator('[data-r="r4"] .fb-mal')).toBeVisible();
  await expect(p.locator('.estado')).toContainText('Pendiente de acertar');
  // a unit of another magnitude is not an attempt
  await campo(page, 'ej-1.3', 'r2').fill('37,9 mV');
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await expect(p.locator('[data-r="r2"] .fb-unidad')).toContainText('se pide en A');
});

test('pistas una a una y después la solución del libro', async ({ page }) => {
  await page.goto('#/cap01/ej-1.5');
  const p = panel(page, 'ej-1.5');
  await p.getByRole('button', { name: 'Pista 1 de 2' }).click();
  await expect(p.locator('.pistas li')).toHaveCount(1);
  await expect(p.locator('.pistas li').first()).toContainText('V');
  await p.getByRole('button', { name: 'Pista 2 de 2' }).click();
  await expect(p.locator('.pistas li')).toHaveCount(2);
  await expect(page.locator('#ej-1\\.5 .solucion')).toHaveCount(0);
  await p.getByRole('button', { name: 'Ver la solución' }).click();
  await expect(page.locator('#ej-1\\.5 .solucion')).toBeVisible();
  // solving it now counts as solved after seeing the solution
  await campo(page, 'ej-1.5', 'r1').fill('12,02');
  await campo(page, 'ej-1.5', 'r2').fill('1,45 W');
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await expect(p.locator('.estado')).toContainText('después de ver la solución');
});

test('problema: el análisis se oculta mientras se intenta y vuelve con «Ver solución»', async ({ page }) => {
  await page.goto('#/cap05/prob-5.A');
  const p = panel(page, 'prob-5.A');
  await expect(p).toBeVisible();
  const analisis = page.locator('#cap05 .trozo > p', { hasText: 'La resistencia serie debe cumplir' });
  await expect(analisis).toBeVisible();
  await p.getByRole('button', { name: 'Ocultar solución' }).click();
  await expect(analisis).toBeHidden();
  await campo(page, 'prob-5.A', 'r1').fill('136');
  await campo(page, 'prob-5.A', 'r2').fill('211 Ω');
  await campo(page, 'prob-5.A', 'r3').fill('120');
  await campo(page, 'prob-5.A', 'r4').fill('0,74');
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await expect(p.locator('.fb-bien')).toHaveCount(4);
  await p.getByRole('button', { name: 'Ver solución' }).click();
  await expect(analisis).toBeVisible();
});

test('deducción paso a paso con botón, teclado y toque, recordada al recargar', async ({ page }) => {
  await page.goto('#/cap05/sec-5.8');
  const d = page.locator('.deduccion.por-pasos').first();
  await d.scrollIntoViewIfNeeded();
  const visibles = d.locator('.paso:not([hidden])');
  await expect(visibles).toHaveCount(1);
  await d.getByRole('button', { name: 'Siguiente paso' }).click();
  await expect(visibles).toHaveCount(2);
  await d.focus();
  await page.keyboard.press('ArrowRight');
  await expect(visibles).toHaveCount(3);
  await page.keyboard.press(' ');
  await expect(visibles).toHaveCount(4);
  await page.keyboard.press('ArrowLeft');
  await expect(visibles).toHaveCount(3);
  // a tap on the derivation (here, its title) reveals the next one
  await d.locator('.deduccion-tit').click();
  await expect(visibles).toHaveCount(4);
  await expect(d.locator('.cuenta')).toContainText('Paso 4 de 7');
  await page.waitForTimeout(900); // debounced write
  await page.reload();
  const d2 = page.locator('.deduccion.por-pasos').first();
  await expect(d2.locator('.paso:not([hidden])')).toHaveCount(4);
  await d2.getByRole('button', { name: 'Ver todo' }).click();
  await expect(d2.locator('.paso:not([hidden])')).toHaveCount(7);
  await expect(d2.getByRole('button', { name: /desde el principio/ })).toBeVisible();
});

test('progreso guardado: ejercicio resuelto, sección leída, repaso de fallados', async ({ page }) => {
  await page.goto('#/cap01/ej-1.9');
  const p = panel(page, 'ej-1.9');
  await campo(page, 'ej-1.9', 'r1').fill('3 Ω');
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await expect(p.locator('.fb-cerca')).toBeVisible();
  await campo(page, 'ej-1.9', 'r1').fill('300 m');
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await expect(p.locator('.estado')).toContainText('Resuelto');
  // a wrong answer left as it is goes to the review
  const q = panel(page, 'ej-1.8');
  await campo(page, 'ej-1.8', 'r1').fill('5,7 W');
  await q.getByRole('button', { name: 'Comprobar' }).click();
  await expect(q.locator('.estado')).toContainText('Pendiente de acertar');
  // a section marked as read by hand
  await page.goto('#/cap01/sec-1.3');
  const marca = page.locator('.seccion-cab:has(#sec-1\\.3) button.leida');
  await marca.click();
  await expect(marca).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(1200);

  await page.reload();
  await expect(page.locator('.seccion-cab:has(#sec-1\\.3) button.leida')).toHaveAttribute('aria-pressed', 'true');
  await page.goto('#/cap01/ej-1.9');
  await expect(panel(page, 'ej-1.9').locator('.estado')).toContainText('Resuelto');
  await expect(campo(page, 'ej-1.9', 'r1')).toHaveValue('300 m');

  // start page: progress and the review
  await page.goto('#/');
  const prog = page.locator('.progreso-inicio');
  await expect(prog).toContainText('ejercicios y problemas resueltos');
  await expect(prog.locator('.cifra').nth(1)).toContainText('1');
  await expect(prog.getByRole('link', { name: /Repasar 1 fallados/ })).toBeVisible();

  // exercises page: filters and the review of the failed ones
  await page.goto('#/ejercicios');
  await page.getByRole('radio', { name: /Resueltos/ }).click();
  await expect(page.locator('.capitulo .fila')).toHaveCount(1);
  await expect(page.locator('.capitulo .fila')).toContainText('1.9');
  await page.getByRole('link', { name: /Repaso de fallados/ }).click();
  await expect(page.locator('.tarjeta-ej')).toContainText('Ejercicio 1.8');
  await campo(page, 'ej-1.8', 'r1').fill('2,85');
  await campo(page, 'ej-1.8', 'r2').fill('36,7 %');
  await page.locator('.tarjeta-ej').getByRole('button', { name: 'Comprobar' }).click();
  await expect(page.locator('.navegar .estado-r')).toHaveText('Resuelto');
});

test('una sección cuenta como leída tras estar a la vista el tiempo suficiente', async ({ browser }) => {
  // a very tall window: the whole section fits, so it only needs the minimum time on screen
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 6000 } });
  const page = await ctx.newPage();
  await page.goto('#/cap01/sec-1.13');
  const marca = page.locator('.seccion-cab:has(#sec-1\\.13) button.leida');
  await expect(marca).toHaveAttribute('aria-pressed', 'false');
  await expect(marca).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
  // the sidebar shows the chapter's progress ring
  await expect(page.locator('.lateral a.capitulo[aria-current="page"] .anillo')).toBeVisible();
  await ctx.close();
});

// ------------------------------------------------------------------ screenshots

const TAMANOS = [
  { nombre: 'movil', w: 390, h: 844, dpr: 3, tactil: true },
  { nombre: 'portatil', w: 1280, h: 800, dpr: 2, tactil: false },
  { nombre: 'tableta-vertical', w: 800, h: 1280, dpr: 2, tactil: true },
];

/** Some progress already stored, so that the screenshots show it. */
async function progresoDeEjemplo(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      const t = Date.now();
      localStorage.setItem(
        'epa:ejercicios',
        JSON.stringify({
          'ej-5.2': { intentos: 1, fallos: 0, resuelto: true, pistas: 0, solucion: false, t, valores: { r1: '12 mA' }, bien: ['r1'] },
          'ej-5.3': { intentos: 2, fallos: 2, resuelto: false, pistas: 1, solucion: false, t, valores: { r1: '276', r2: '270', r3: '0,2', r4: '13 mW' }, bien: ['r1', 'r2'] },
          'ej-1.1': { intentos: 1, fallos: 0, resuelto: true, pistas: 0, solucion: false, t },
          'ej-1.2': { intentos: 3, fallos: 1, resuelto: true, pistas: 2, solucion: false, t },
          'ej-1.4': { intentos: 1, fallos: 1, resuelto: false, pistas: 0, solucion: false, t },
          'prob-5.A': { intentos: 0, fallos: 0, resuelto: false, pistas: 1, solucion: false, t },
        }),
      );
      const leidas: Record<string, number> = {};
      for (let k = 1; k <= 9; k++) leidas[`sec-5.${k}`] = t - k * 1000;
      const cap1: Record<string, number> = {};
      for (let k = 1; k <= 13; k++) cap1[`sec-1.${k}`] = t - 1e6 - k;
      localStorage.setItem('epa:leidas', JSON.stringify({ cap05: leidas, cap01: cap1, cap00: { 'sec-0.1': t - 5e6 } }));
      localStorage.setItem('epa:deducciones', JSON.stringify({}));
    } catch {
      /* private mode */
    }
  });
}

for (const t of TAMANOS) {
  for (const modo of ['claro', 'oscuro'] as const) {
    test(`capturas ${t.nombre} ${modo}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: t.dpr, hasTouch: t.tactil });
      const page = await ctx.newPage();
      await tema(page, modo);
      await progresoDeEjemplo(page);
      const base = `tests/capturas/ejercicios-${t.nombre}-${modo}`;

      // an exercise with feedback and the first hint
      await page.goto('#/cap05/ej-5.3');
      const p = panel(page, 'ej-5.3');
      await expect(p).toBeVisible();
      await p.getByRole('button', { name: 'Comprobar' }).click();
      await page.locator('#ej-5\\.3').scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -70));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${base}-ejercicio.png` });

      // a problem with its panel
      await page.goto('#/cap05/prob-5.A');
      await expect(panel(page, 'prob-5.A')).toBeVisible();
      await page.locator('#resp-prob-5\\.A').scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -260));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${base}-problema.png` });

      // a derivation, three steps in
      await page.goto('#/cap05/sec-5.8');
      const d = page.locator('.deduccion.por-pasos').first();
      await d.scrollIntoViewIfNeeded();
      await d.getByRole('button', { name: 'Siguiente paso' }).click();
      await d.getByRole('button', { name: 'Siguiente paso' }).click();
      await d.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${base}-deduccion.png` });

      // the exercises page, a chapter open
      await page.goto('#/ejercicios');
      await page.locator('.cap-cab', { hasText: 'Capítulo 5 · ' }).click();
      await page.locator('.capitulo .fila', { hasText: '5.3' }).first().click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${base}-pagina.png` });

      // the review of failed ones
      await page.goto('#/ejercicios/repaso');
      await expect(page.locator('.tarjeta-ej')).toBeVisible();
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${base}-repaso.png` });

      // start page with the progress
      await page.goto('#/');
      await expect(page.locator('.progreso-inicio')).toBeVisible();
      await page.locator('.progreso-inicio').scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${base}-inicio.png` });

      // the sidebar with reading progress (the drawer on phones and tablets)
      await page.goto('#/cap05');
      if (t.w < 1024) await page.locator('nav.pestanas').getByRole('button', { name: 'Libro' }).click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${base}-indice.png` });
      await ctx.close();
    });
  }
}
