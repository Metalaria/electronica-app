// 1.0 exercises in the browser: structured questions (choice, order, truth table, boolean expression, pair of E12
// resistors) checked in the reader and on the «Ejercicios» page, settled with the development quoted from the book;
// the self-assessment of open questions (written answer kept after a reload and a navigation, checklist, «¿Lo tenía
// bien?» counting the same as before); keyboard use; 44 px targets on a touch screen; axe (contrast included) in light,
// sepia and dark.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.ejercicios10.config.ts tests/ejercicios10-navegador.spec.ts
import { createRequire } from 'node:module';
import { expect, test, type Browser, type Page } from '@playwright/test';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

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
const panel = (page: Page, label: string) => page.locator(`.comprobador[data-label="${label}"]`);
const campo = (page: Page, label: string, r: string) => page.locator(`#cmp-${label.replace(/[^\w-]/g, '_')}-${r}`);
const pregunta = (page: Page, label: string, p: string) => panel(page, label).locator(`.preg[data-p="${p}"]`);

test('elección junto a los campos numéricos: se comprueba todo a la vez y se ve el desarrollo del libro', async ({ page }) => {
  await limpio(page);
  await page.goto('#/cap01/ej-1.1');
  const p = panel(page, 'ej-1.1');
  await expect(p).toBeVisible();
  await campo(page, 'ej-1.1', 'r1').fill('11,75');
  await campo(page, 'ej-1.1', 'r2').fill('294 mW');
  // the wrong choice first: the numbers are right, the item is not solved yet
  await pregunta(page, 'ej-1.1', 'p1').getByRole('radio', { name: 'Sí' }).check();
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await expect(p.locator('[data-r] .fb-bien')).toHaveCount(2);
  await expect(pregunta(page, 'ej-1.1', 'p1').locator('.fb-mal')).toContainText('No es la respuesta correcta');
  await expect(p.locator('.estado')).toContainText('Pendiente de acertar');
  // no development yet after one failed check
  await expect(pregunta(page, 'ej-1.1', 'p1').locator('.desarrollo')).toHaveCount(0);
  await pregunta(page, 'ej-1.1', 'p1').getByRole('radio', { name: 'No' }).check();
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await expect(pregunta(page, 'ej-1.1', 'p1').locator('.fb-bien')).toBeVisible();
  await expect(p.locator('.estado')).toContainText('Resuelto');
  const des = pregunta(page, 'ej-1.1', 'p1').locator('.desarrollo');
  await expect(des).toContainText('Del libro');
  await expect(des).toContainText('NO sería suficiente');
  // the full development of the book is one tap away
  await p.getByRole('button', { name: 'Ver el desarrollo' }).click();
  await expect(page.locator('#ej-1\\.1 .solucion')).toBeVisible();
  // everything is kept after a reload
  await page.reload();
  await expect(pregunta(page, 'ej-1.1', 'p1').getByRole('radio', { name: 'No' })).toBeChecked();
  await expect(panel(page, 'ej-1.1').locator('.estado')).toContainText('Resuelto');
});

test('ordenar con el teclado; tras dos intentos fallidos se ve el orden del libro', async ({ page }) => {
  await limpio(page);
  await page.goto('#/cap11/ej-11.5');
  const q = pregunta(page, 'ej-11.5', 'p1');
  await expect(q).toBeVisible();
  const p = panel(page, 'ej-11.5');
  const textos = async () => (await q.locator('.orden li .txt').allTextContents()).map((t) => t.trim());
  const antes = await textos();
  expect(antes).toHaveLength(5);
  expect(antes[0]).not.toBe('Localizar la alimentación y la masa');
  // move the first step down with the keyboard: the focus follows the moved step
  await q.getByRole('button', { name: `Bajar «${antes[0]}»` }).focus();
  await page.keyboard.press('Enter');
  expect((await textos())[1]).toBe(antes[0]);
  await expect(q.getByRole('button', { name: `Bajar «${antes[0]}»` })).toBeFocused();
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await expect(q.locator('.fb-mal')).toContainText('están en su sitio');
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await expect(q.locator('.desarrollo')).toContainText('Respuesta:');
  await expect(q.locator('.desarrollo')).toContainText('1. Localizar la alimentación y la masa');
  // put them in the book's order with the buttons and solve it
  const correcto = ['Localizar la alimentación y la masa', 'Identificar los bloques funcionales', 'Seguir el camino de la señal desde la entrada hasta la salida', 'Distinguir señal de servicio', 'Analizar bloque a bloque'];
  for (let i = 0; i < correcto.length; i++) {
    for (;;) {
      const t = await textos();
      const j = t.indexOf(correcto[i]!);
      if (j === i) break;
      await q.getByRole('button', { name: `Subir «${correcto[i]}»` }).click();
    }
  }
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await expect(q.locator('.fb-bien')).toContainText('orden del libro');
  await expect(p.locator('.estado')).toContainText('Resuelto');
});

test('tabla de verdad, expresión lógica y pareja E12 en la página «Ejercicios»', async ({ page }) => {
  await limpio(page);
  // truth table of Y = A·B + C (ej-9.1), in the reader
  await page.goto('#/cap09/ej-9.1');
  const t = pregunta(page, 'ej-9.1', 'p1');
  await expect(t).toBeVisible();
  const y = [0, 1, 0, 1, 0, 1, 1, 1];
  for (let i = 0; i < 8; i++) await t.locator(`.fila[data-elemento="${i}"]`).getByRole('radio', { name: String(y[i]) }).check();
  await panel(page, 'ej-9.1').getByRole('button', { name: 'Comprobar' }).click();
  await expect(t.locator('.fb-bien')).toBeVisible();

  // De Morgan (ej-9.2): an equivalent but unsimplified expression is «casi»; A + B is right; then the gate
  await page.goto('#/cap09/ej-9.2');
  const l = pregunta(page, 'ej-9.2', 'p1');
  await l.getByRole('textbox').fill("(A'B')'");
  await panel(page, 'ej-9.2').getByRole('button', { name: 'Comprobar' }).click();
  await expect(l.locator('.fb-cerca')).toContainText('simplificar');
  await l.getByRole('textbox').fill('A + B');
  await pregunta(page, 'ej-9.2', 'p2').getByRole('radio', { name: 'OR', exact: true }).check();
  await l.getByRole('textbox').press('Enter');
  await expect(panel(page, 'ej-9.2').locator('.fb-bien')).toHaveCount(2);

  // a pair of E12 resistors (ej-2.9) on the «Ejercicios» page: an E24 value is refused, 6,8 k + 680 in series is right
  await page.goto('#/ejercicios');
  const cap2 = page.locator('section.capitulo', { has: page.locator('.cap-tit', { hasText: /^Capítulo 2 ·/ }) }).locator('button.cap-cab');
  if ((await cap2.getAttribute('aria-expanded')) !== 'true') await cap2.click();
  await page.locator('li', { has: page.locator('.num', { hasText: /^2\.9$/ }) }).locator('button.fila').click();
  const c = pregunta(page, 'ej-2.9', 'p1');
  await expect(c).toBeVisible();
  await c.getByLabel('R1').fill('7,5 k');
  await c.getByLabel('R2').fill('1 M');
  await c.getByRole('radio', { name: 'En paralelo' }).check();
  await panel(page, 'ej-2.9').getByRole('button', { name: 'Comprobar' }).click();
  await expect(c.locator('.fb-mal')).toContainText('no es un valor de la serie E12');
  await c.getByLabel('R1').fill('6k8');
  await c.getByLabel('R2').fill('680');
  await c.getByRole('radio', { name: 'En serie' }).check();
  await panel(page, 'ej-2.9').getByRole('button', { name: 'Comprobar' }).click();
  await expect(c.locator('.fb-bien')).toContainText('7,48 kΩ');
  await expect(c.locator('.desarrollo')).toContainText('15 kΩ en paralelo');
});

test('autoevaluación: la respuesta escrita se guarda (recarga y navegación), la lista de lo que se pide y «¿Lo tenía bien?»', async ({ page }) => {
  await limpio(page);
  // (1.1 «razonar»: ej-4.8, used in this file until 1.0, is self-checked now; ej-12.8 is one of the five left self-assessed)
  await page.goto('#/cap12/ej-12.8');
  const p = panel(page, 'ej-12.8');
  await expect(p).toBeVisible();
  const caja = p.getByRole('textbox', { name: /Su respuesta/ });
  await caja.fill('Historial de cambios y trabajo en equipo.');
  await expect(p.locator('.cuenta')).toContainText('41 / 4000');
  // navigating away at once (before the 800 ms debounced write) stores it: the panel flushes the store when it goes
  await page.goto('#/cap05');
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('epa:ejercicios') ?? '{}')['ej-12.8']?.valores?.texto ?? null), { timeout: 500, intervals: [50] })
    .toBe('Historial de cambios y trabajo en equipo.');
  await page.goto('#/cap12/ej-12.8');
  await expect(panel(page, 'ej-12.8').getByRole('textbox', { name: /Su respuesta/ })).toHaveValue('Historial de cambios y trabajo en equipo.');
  await page.reload();
  const p2 = panel(page, 'ej-12.8');
  await expect(p2.getByRole('textbox', { name: /Su respuesta/ })).toHaveValue('Historial de cambios y trabajo en equipo.');
  // not an attempt: nothing solved or failed yet
  await expect(p2.locator('.estado')).toHaveCount(0);
  await p2.getByRole('button', { name: 'Ver solución' }).click();
  const lista = p2.getByRole('group', { name: /Lo que se pide/ });
  await expect(lista.getByRole('checkbox')).toHaveCount(1);
  await lista.getByRole('checkbox').check();
  await p2.getByRole('group', { name: 'Autoevaluación' }).getByRole('button', { name: 'Sí' }).click();
  await expect(p2.locator('.estado')).toContainText('Autoevaluado: lo tenía bien');
  await page.reload();
  await expect(panel(page, 'ej-12.8').locator('.estado')).toContainText('Autoevaluado: lo tenía bien');
  // the stored state: the text and the mark with their own times (vt), the format of 0.12 otherwise
  const e = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:ejercicios') ?? '{}')['ej-12.8']);
  expect(e.valores.texto).toBe('Historial de cambios y trabajo en equipo.');
  expect(e.valores.c1).toBe('1');
  expect(typeof e.vt.texto).toBe('number');
  expect(e.resuelto).toBe(true);
  expect(e.intentos).toBe(1);
});

async function tactil(browser: Browser, tema: 'claro' | 'sepia' | 'oscuro') {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await limpio(page, tema);
  return { ctx, page };
}

test('en una pantalla táctil (teléfono) los controles de las preguntas miden al menos 44 px y no desbordan', async ({ browser }) => {
  const { ctx, page } = await tactil(browser, 'claro');
  for (const [ruta, label] of [['#/cap01/ej-1.1', 'ej-1.1'], ['#/cap11/ej-11.5', 'ej-11.5'], ['#/cap09/ej-9.1', 'ej-9.1'], ['#/cap02/ej-2.9', 'ej-2.9'], ['#/cap12/ej-12.8', 'ej-12.8']] as const) {
    await page.goto(ruta);
    const p = panel(page, label);
    await expect(p).toBeVisible();
    await p.scrollIntoViewIfNeeded();
    const pequenos = await p.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>('.preg label.opcion, .preg label.chip, .preg button, .preg input[type=text], .preg select, textarea, .criterio, button')]
        .filter((x) => x.offsetParent)
        .map((x) => ({ n: (x.textContent || x.getAttribute('aria-label') || x.tagName).trim().slice(0, 30), r: x.getBoundingClientRect() }))
        .filter((x) => x.r.height < 44 || x.r.width < 44)
        .map((x) => `${x.n} ${Math.round(x.r.width)}×${Math.round(x.r.height)}`),
    );
    expect(pequenos, label).toEqual([]);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(ancho, label).toBeLessThanOrEqual(0);
  }
  await ctx.close();
});

test('accesibilidad (axe, contraste incluido) de las preguntas, su desarrollo y la autoevaluación en claro, sepia y oscuro', async ({ browser }) => {
  for (const tema of ['claro', 'sepia', 'oscuro'] as const) {
    const { ctx, page } = await tactil(browser, tema);
    for (const [ruta, label] of [['#/cap11/ej-11.4', 'ej-11.4'], ['#/cap09/ej-9.2', 'ej-9.2'], ['#/cap12/ej-12.8', 'ej-12.8']] as const) {
      await page.goto(ruta);
      const p = panel(page, label);
      await expect(p).toBeVisible();
      // settle the questions (two failed checks show the answer and the development) and open the self-assessment
      if (label !== 'ej-12.8') {
        // a readable (wrong or right) answer in every question, checked twice
        for (const g of await p.locator('.preg fieldset .fila, .preg fieldset .opciones').all()) await g.locator('input[type=radio]').first().check();
        for (const t of await p.locator('.preg input[type=text]').all()) await t.fill('A');
        await p.getByRole('button', { name: 'Comprobar' }).click();
        await p.getByRole('button', { name: 'Comprobar' }).click();
        await expect(p.locator('.desarrollo').first()).toBeVisible();
      } else {
        await p.getByRole('textbox', { name: /Su respuesta/ }).fill('Algo');
        await p.getByRole('button', { name: 'Ver solución' }).click();
        await expect(p.getByRole('group', { name: 'Autoevaluación' })).toBeVisible();
      }
      await page.addScriptTag({ path: AXE });
      const v = await page.evaluate(async (sel) => {
        const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
        const r = await axe.run({ include: [[sel]] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
        return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      }, `.comprobador[data-label="${label}"]`);
      expect(v, `${tema} ${label}`).toEqual([]);
    }
    await ctx.close();
  }
});

/** Plays a «Practicar esto» session of section 11.11 up to its first exercise checked by questions; returns its label. */
async function sesionConPreguntas(page: Page, semilla?: number): Promise<string> {
  await limpio(page);
  if (semilla != null) await page.addInitScript((s) => ((window as unknown as { __epaSemillaPractica?: number }).__epaSemillaPractica = s), semilla);
  // «Practicar esto» of the exercises section of chapter 11: six of its exercises are checked only by questions
  await page.goto('#/practicar/cap11/sec-11.11');
  await page.locator('[data-empezar-sesion]').click();
  for (let k = 0; k < 12; k++) {
    const cuerpo = page.locator('.cuerpo[data-item]');
    await expect(cuerpo).toBeVisible();
    if ((await cuerpo.getAttribute('data-item-tipo')) === 'ejercicio' && (await cuerpo.locator('.preg').count())) {
      const label = (await cuerpo.getAttribute('data-item'))!;
      const p = panel(page, label);
      // an answer to every question: a radio in each choice/classification, one move in each ordering (final QA 1.0:
      // ej-11.5 is an ordering — no radios —, and «Comprobar» with nothing answered is not an attempt)
      for (const g of await p.locator('.preg fieldset .fila, .preg fieldset .opciones').all()) await g.locator('input[type=radio]').first().check();
      for (const o of await p.locator('.preg ol.orden').all()) await o.locator('button.flecha:not([disabled])').first().click();
      // two wrong-or-right checks settle every question; then the shown answers solve it
      await p.getByRole('button', { name: 'Comprobar' }).click();
      await p.getByRole('button', { name: 'Comprobar' }).click();
      await expect(p.locator('.desarrollo').first()).toBeVisible();
      return label;
    }
    const saltar = page.locator('[data-saltar]');
    if (await saltar.count()) await saltar.click();
    else break;
  }
  return '';
}

test('práctica inteligente: los ejercicios de preguntas estructuradas entran en la sesión y se resuelven ahí', async ({ page }) => {
  expect(await sesionConPreguntas(page)).not.toBe('');
});

test('práctica inteligente (semilla 12): la sesión saca primero ej-11.5, de ordenar, y también se resuelve', async ({ page }) => {
  // final QA 1.0: the test above failed whenever the random session drew this ordering exercise
  expect(await sesionConPreguntas(page, 12)).toBe('ej-11.5');
});

test('ordenar (ej-11.5): «Comprobar» sin mover nada dice qué falta y no cuenta como intento', async ({ page }) => {
  await limpio(page);
  await page.goto('#/cap11/ej-11.5');
  const p = panel(page, 'ej-11.5');
  await expect(p).toBeVisible();
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await expect(p.locator('[data-aviso-vacio]')).toHaveText('Ordene los elementos con las flechas antes de comprobar.');
  await expect(p.locator('[data-resumen-comprobacion]')).toHaveText('Ordene los elementos con las flechas antes de comprobar.');
  await expect(p.locator('.desarrollo')).toHaveCount(0);
  // a move hides it; a check then counts
  await p.locator('ol.orden button.flecha:not([disabled])').first().click();
  await expect(p.locator('[data-aviso-vacio]')).toHaveCount(0);
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await expect(p.locator('[data-resumen-comprobacion]')).toContainText('en su sitio');
});

test('otros valores de ej-3.4: se pide el valor E12 más cercano, el campo lo dice y solo ese valor vale', async ({ page }) => {
  await limpio(page);
  await page.goto('#/cap03/ej-3.4');
  await page.locator('[data-otros-valores="ej-3.4"] [data-practicar-ej]').click();
  const n = page.locator('[data-otros-valores="ej-3.4"] .numerico');
  await expect(n).toBeVisible();
  await expect(n.locator('[data-pide]')).toHaveText('En esta variante se pide solo: Valor E12 más cercano a la resistencia necesaria');
  // the field says what is asked (it was «XC =»)
  await expect(n.locator('[data-etiqueta-campo]')).toHaveText('Valor E12 más cercano a la resistencia necesaria');
  const valores = JSON.parse((await n.getAttribute('data-valores'))!) as { f: number; C: number };
  const r = 1 / (2 * Math.PI * valores.f * valores.C);
  const e12 = Number(await n.getAttribute('data-resultado'));
  expect([1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2].some((m) => Math.abs(e12 / 10 ** Math.floor(Math.log10(e12)) - m) < 1e-6)).toBe(true);
  // the computed value is not the answer (unless it is the E12 value itself)
  if (Math.abs(r - e12) / e12 > 0.006) {
    await n.locator('input[data-numero]').fill(String(Math.round(r)));
    await n.locator('[data-comprobar]').click();
    await expect(page.getByText('Ese es el valor calculado; se pide el valor E12 más cercano a él.')).toBeVisible();
  }
  await n.locator('input[data-numero]').fill(String(e12));
  await n.locator('[data-comprobar]').click();
  await expect(n.locator('[data-solucion]')).toContainText('(solo se acepta ese valor)');
});
