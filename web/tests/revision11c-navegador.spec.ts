// Independent review 11c (functional and UI QA of what is new in 1.1): regression tests for the confirmed defects.
// Each test fails on the version-1.1 tree reviewed on 2026-11-10 and passes with the fixes (fix 11c); the tests after
// the reviewer's ones are the fix's own (the minor points of the review). Unit-level ones: revision11c-unidad.spec.ts.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision11c.config.ts tests/revision11c-navegador.spec.ts
// (any config whose baseURL serves a build of web/; light theme, 1366×900 unless the test says otherwise)
import { expect, test, type Page } from '@playwright/test';
import { limpio } from './accesibilidad10-comun';

const tarjetaN = (page: Page) => page.locator('[data-leccion11]').getAttribute('data-tarjeta-n');
const continuar = (page: Page) => page.locator('[data-continuar]');

/** Lesson 1.4 from the book's section (as a reader arrives), walked to its 4th card (the challenge). */
async function leccion14HastaTarjeta4(page: Page) {
  await page.goto('#/cap01/sec-1.4');
  await page.waitForTimeout(800);
  await page.evaluate(() => { location.hash = '#/leccion/cap01/sec-1.4'; });
  await expect(page.locator('[data-tarjeta="explore-serie"]')).toBeVisible();
  for (const s of ['R_1', 'R_2']) {
    await page.locator(`[data-mando11="${s}"] [role="slider"]`).focus();
    await page.keyboard.press('ArrowRight');
  }
  await continuar(page).click();
  await page.locator('[data-opcion="0"]').click();
  await continuar(page).click();
  await continuar(page).click();
  await continuar(page).click();
  await expect(page.locator('[data-tarjeta="reto-33"]')).toBeVisible();
  await expect(page).toHaveURL(/#\/leccion\/cap01\/sec-1\.4\/4$/);
}

test('lección: «Seguir en la lección» tras la X deja la dirección en la tarjeta que se ve (recargar no la cambia)', async ({ page }) => {
  await limpio(page);
  await leccion14HastaTarjeta4(page);
  await page.locator('[data-cerrar]').click();
  const d = page.getByRole('alertdialog');
  await expect(d).toContainText('Va por la tarjeta 4 de 12');
  await d.getByRole('button', { name: 'Seguir en la lección' }).click();
  expect(await tarjetaN(page)).toBe('3');
  // reviewed: the address had gone back to #/leccion/cap01/sec-1.4 (card 1) while card 4 was on screen
  await expect(page).toHaveURL(/#\/leccion\/cap01\/sec-1\.4\/4$/);
  await page.reload();
  await expect(page.locator('[data-leccion11]')).toHaveAttribute('data-tarjeta-n', '3');
});

test('lección: «Al volver, seguirá aquí» también desde el libro y el camino del curso', async ({ page }) => {
  await limpio(page);
  await leccion14HastaTarjeta4(page);
  await page.locator('[data-cerrar]').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Salir' }).click();
  await expect(page).not.toHaveURL(/leccion/);
  // the book's «Estudiar por pasos» (reviewed: it opened card 1 and overwrote the saved card)
  await page.goto('#/cap01/sec-1.4');
  // (the chapter page shows every section: the icon of 1.4)
  await page.locator('a[data-por-pasos][href="#/leccion/cap01/sec-1.4"]').first().click();
  await expect(page.locator('[data-leccion11="cap01/sec-1.4"]')).toBeVisible();
  await expect(page.locator('[data-leccion11]')).toHaveAttribute('data-tarjeta-n', '3');
});

test('lección: una predicción fallada no enseña la lectura oculta antes de reintentar', async ({ page }) => {
  await limpio(page);
  await page.goto('#/leccion/cap01/sec-1.4/2');
  await expect(page.locator('[data-tarjeta="prediga-salida"]')).toBeVisible();
  await expect(page.locator('[data-lectura="V_out"]')).toHaveText('¿? V');
  await page.locator('[data-opcion="1"]').click();
  await continuar(page).click();
  await expect(page.locator('[data-veredicto]')).toHaveAttribute('data-veredicto', 'mal');
  // reviewed: «4,00 V» (the answer) appeared with the «Por qué no»; the second try was then free (and gave 5 XP)
  await expect(page.locator('[data-lectura="V_out"]')).toHaveText('¿? V');
});

test('laboratorio 5, paso «fase»: un solo «Hágalo por mí» deja los cursores donde el paso los pide', async ({ page }) => {
  test.setTimeout(240_000);
  await limpio(page);
  await page.goto('#/instrumentos/laboratorio/5');
  const simulado = () => expect(page.locator('.banco .estado')).toContainText('Simulado en', { timeout: 90_000 });
  await simulado();
  await page.locator('[data-hagalo]').click();
  await simulado();
  await page.locator('[data-comprobar]').click();
  await page.locator('[data-continuar]').click();
  await page.locator('[data-hagalo]').click();
  await page.waitForTimeout(2500);
  await page.locator('[data-lectura]').fill('-3');
  await page.locator('[data-comprobar]').click();
  await page.locator('[data-continuar]').click();
  await expect(page.locator('[data-paso]')).toHaveAttribute('data-paso', 'fase');
  await page.locator('[data-hagalo]').click();
  await page.waitForTimeout(3000);
  // reviewed: cursor B landed at 64 µs (its position in divisions computed at 200 µs/div, applied at 100 µs/div);
  // «Comprobar» then asked to move cursor B, and only a second «Hágalo por mí» put it at 124 µs (44,6°)
  await page.locator('[data-lectura]').fill('45');
  await page.locator('[data-comprobar]').click();
  await expect(page.locator('[data-veredicto]')).toHaveAttribute('data-veredicto', 'bien', { timeout: 20_000 });
});

test('problema de diseño: un valor fuera de su serie no gasta un intento ni enseña la solución', async ({ page }) => {
  await limpio(page);
  await page.goto('#/cap25/ej-25.9');
  const d = page.locator('.comprobador[data-label="ej-25.9"]');
  for (const [r, c] of [['3,4k', '47n'], ['3,3k', '4,6n']]) {
    await d.locator('[data-componente="R"]').fill(r);
    await d.locator('[data-componente="C"]').fill(c);
    await d.getByRole('button', { name: 'Comprobar' }).click();
    await expect(d).toContainText('no es un valor de la serie E12');
  }
  // reviewed: two typos (nothing simulated) counted as two failures and revealed «Respuesta: … R = 3,3 kΩ y C = 47 nF»
  await expect(d.getByText(/^Respuesta/)).toHaveCount(0);
  const e = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:ejercicios') ?? '{}')['ej-25.9']);
  expect(e?.fallos ?? 0).toBe(0);
});

test('360 px: el campo de la lectura del laboratorio cabe en su tarjeta', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await limpio(page);
  await page.goto('#/instrumentos/laboratorio/12');
  await expect(page.locator('[data-paso]')).toBeVisible({ timeout: 60_000 });
  const r = await page.evaluate(() => {
    const p = document.querySelector('[data-paso]')!.getBoundingClientRect();
    const i = document.querySelector('[data-lectura]')!.getBoundingClientRect();
    return { paso: p.right, campo: i.right };
  });
  // reviewed: the input ended at 339 px, past the card's edge at 331 px (clipped)
  expect(r.campo).toBeLessThanOrEqual(r.paso);
});

test('gráficas de las lecciones: los rótulos del eje logarítmico no se pisan ni salen de la tarjeta', async ({ page }) => {
  await limpio(page);
  // (at 360 px the drawing scales down: cap01/sec-1.14 ran «10 kHz100 kHz1 MHz 10 MHz100 MHz1 GHz» together)
  for (const [ruta, ancho] of [['#/leccion/cap05/sec-5.1/1', 1366], ['#/leccion/cap04/sec-4.9/1', 1366], ['#/leccion/cap05/sec-5.1/1', 360], ['#/leccion/cap04/sec-4.9/1', 360], ['#/leccion/cap01/sec-1.14/1', 360]] as const) {
    await page.setViewportSize({ width: ancho, height: ancho === 360 ? 780 : 900 });
    await page.goto(ruta);
    await expect(page.locator('[data-leccion11] [data-tarjeta] svg text').first()).toBeVisible();
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const caja = document.querySelector('[data-leccion11] [data-tarjeta]')!.getBoundingClientRect();
      const ts = [...document.querySelectorAll('[data-leccion11] [data-tarjeta] svg text')].filter((t) => t.textContent!.trim()).map((t) => t.getBoundingClientRect());
      let solapes = 0;
      for (let i = 0; i < ts.length; i++)
        for (let j = i + 1; j < ts.length; j++) {
          const a = ts[i]!, b = ts[j]!;
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 3) solapes++;
        }
      const fuera = ts.filter((a) => a.left < caja.left - 1 || a.right > caja.right + 1).length;
      return { solapes, fuera };
    });
    // reviewed: 5.1 had 30 overlapping pairs and 14 labels outside the card; 4.9 had 6 «… veces» labels cut on the left
    expect(r, `${ruta} a ${ancho} px`).toEqual({ solapes: 0, fuera: 0 });
  }
});

test('editor: las fuentes trifásicas de las ampliaciones se rotulan con su valor y su fase, no con el texto crudo', async ({ page }) => {
  await limpio(page);
  await page.goto('#/editor/libro/cap24/n7_ej10_estrella');
  await expect(page.getByText('Ejercicio: estrella con Z = 30 + j40 Ω').first()).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  // reviewed: V1 read «AC 231 V» but V2 and V3 read «AC 230.940108 -120» and «AC 230.940108 120»
  await expect(page.locator('main svg text', { hasText: '230.940108' })).toHaveCount(0);
});

// ---------------------------------------------------------------------------------------------- fix 11c's own tests

test('lección: el nodo del camino del curso también abre la tarjeta guardada', async ({ page }) => {
  await limpio(page);
  await leccion14HastaTarjeta4(page);
  await page.locator('[data-cerrar]').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Salir' }).click();
  await page.goto('#/cursos/fundamentos');
  await page.locator('[data-nodo="cap01/sec-1.4"] a[data-abrir-nodo]').click();
  await expect(page.locator('[data-leccion11="cap01/sec-1.4"]')).toHaveAttribute('data-tarjeta-n', '3');
  await expect(page).toHaveURL(/#\/leccion\/cap01\/sec-1\.4\/4$/);
});

test('lección: tras «Volver a intentarlo», 1–5 y A–E siguen eligiendo opción (el foco está en una opción)', async ({ page }) => {
  await limpio(page);
  await page.goto('#/leccion/cap01/sec-1.4/2');
  await expect(page.locator('[data-tarjeta="prediga-salida"]')).toBeVisible();
  await page.locator('[data-opcion="1"]').click();
  await continuar(page).click();
  await expect(page.locator('[data-veredicto]')).toHaveAttribute('data-veredicto', 'mal');
  await continuar(page).click();
  await expect(page.locator('[data-tarjeta] .opcion').first()).toBeFocused();
  await page.keyboard.press('1');
  await expect(page.locator('[data-opcion="0"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('c');
  await expect(page.locator('[data-opcion="2"]')).toHaveAttribute('aria-pressed', 'true');
});

test('lección: una tarjeta respondida en otra visita se ve respondida al volver a ella tras recargar', async ({ page }) => {
  await limpio(page);
  await leccion14HastaTarjeta4(page);
  await page.reload();
  await expect(page.locator('[data-leccion11]')).toHaveAttribute('data-tarjeta-n', '3');
  await page.locator('[data-atras]').click();
  await page.locator('[data-atras]').click();
  await expect(page.locator('[data-tarjeta="prediga-salida"]')).toBeVisible();
  await expect(page.locator('[data-veredicto]')).toHaveAttribute('data-veredicto', 'bien');
  await expect(page.locator('[data-opcion="0"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-lectura="V_out"]')).not.toHaveText('¿? V');
  await expect(continuar(page)).toBeEnabled();
});

test('laboratorio: «Repetir el laboratorio» sobrevive a una recarga', async ({ page }) => {
  const ids = ['capacimetro', 'divisor', 'impedancia'];
  await limpio(page, 'claro', { 'epa:laboratorio': { version: 1, practicas: { p12: { h: ids, l: {}, c: 1_790_000_000_000, t: 1_790_000_000_000 } } } });
  await page.goto('#/instrumentos/laboratorio/12');
  await expect(page.locator('[data-resumen]')).toBeVisible({ timeout: 60_000 });
  await page.locator('[data-repetir]').click();
  await expect(page.locator('[data-paso]')).toHaveAttribute('data-paso', ids[0]!);
  await page.locator('[data-continuar]').click();
  await expect(page.locator('[data-paso]')).toHaveAttribute('data-paso', ids[1]!);
  await page.reload();
  // reviewed: the reload went back to the summary
  await expect(page.locator('[data-paso]')).toHaveAttribute('data-paso', ids[1]!, { timeout: 60_000 });
  await expect(page.locator('.lab .aviso')).toContainText('Repaso del laboratorio');
});

test('360 px: el paso del laboratorio va arriba y, junto al instrumento, una barra fija con «Comprobar»', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await limpio(page);
  await page.goto('#/instrumentos/laboratorio/12');
  await expect(page.locator('[data-paso]')).toBeVisible({ timeout: 60_000 });
  // reviewed: the step card sat about 2 200 px down the page, under the circuit and the instruments
  const arriba = await page.evaluate(() => document.querySelector('[data-paso]')!.getBoundingClientRect().top + scrollY);
  expect(arriba).toBeLessThan(700);
  await expect(page.locator('[data-barra-paso]')).toHaveCount(0);
  await page.locator('.instrumentos').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 400));
  const barra = page.locator('[data-barra-paso]');
  await expect(barra).toBeVisible();
  await expect(barra).toContainText('Paso 1 de 3');
  const caja = await barra.boundingBox();
  expect(caja!.y + caja!.height).toBeLessThanOrEqual(780);
  expect(caja!.x + caja!.width).toBeLessThanOrEqual(360);
  await barra.locator('[data-comprobar-barra]').click();
  await expect(page.locator('[data-veredicto]')).toHaveAttribute('data-veredicto', 'mal');
  await expect(barra.locator('.pista-barra')).not.toBeEmpty();
  // wide screens: no bar (the step is next to the instruments)
  await page.setViewportSize({ width: 1366, height: 900 });
  await expect(page.locator('[data-barra-paso]')).toBeHidden();
});

test('escritorio: ninguna etiqueta del carril se corta («Componentes»)', async ({ page }) => {
  await limpio(page);
  await page.goto('#/');
  await expect(page.locator('nav.carril')).toBeVisible();
  const cortadas = await page.evaluate(() =>
    [...document.querySelectorAll('nav.carril .etiqueta')].filter((e) => e.scrollWidth > e.clientWidth + 0.5).map((e) => e.textContent),
  );
  expect(cortadas).toEqual([]);
});

test('lecciones a 360 px: los rótulos de las gráficas y los esquemas se ven a 11 px o más', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await limpio(page);
  for (const ruta of ['#/leccion/cap05/sec-5.1/1', '#/leccion/cap06/sec-6.11/1', '#/leccion/cap01/sec-1.4/1', '#/leccion/cap03/sec-3.9/6']) {
    await page.goto(ruta);
    await expect(page.locator('[data-leccion11] [data-tarjeta] svg text').first()).toBeVisible();
    await page.waitForTimeout(400);
    const min = await page.evaluate(() => {
      let m = 99;
      for (const svg of document.querySelectorAll<SVGSVGElement>('[data-leccion11] [data-tarjeta] svg')) {
        const vb = svg.viewBox.baseVal;
        if (!vb?.width) continue;
        const k = svg.getBoundingClientRect().width / vb.width;
        for (const t of svg.querySelectorAll('text')) {
          if (!t.textContent!.trim() || t.closest('tspan')) continue;
          m = Math.min(m, parseFloat(getComputedStyle(t).fontSize) * k);
        }
      }
      return m;
    });
    // reviewed: 9,3 px (graph ticks) and 10 px (schematic values)
    expect(min, ruta).toBeGreaterThanOrEqual(11);
  }
});

test('esquemas de las lecciones: los rótulos no se pisan (espejo de 6.11 y 6.15, condensadores de 3.9)', async ({ page }) => {
  await limpio(page);
  for (const [ruta, ancho] of [['#/leccion/cap06/sec-6.11/1', 1366], ['#/leccion/cap06/sec-6.15/7', 1366], ['#/leccion/cap03/sec-3.9/6', 1366], ['#/leccion/cap06/sec-6.11/1', 360], ['#/leccion/cap03/sec-3.9/6', 360]] as const) {
    await page.setViewportSize({ width: ancho, height: ancho === 360 ? 780 : 900 });
    await page.goto(ruta);
    const d = page.getByRole('alertdialog');
    if (await d.isVisible({ timeout: 300 }).catch(() => false)) await d.getByRole('button', { name: 'Salir' }).click();
    await expect(page.locator('[data-leccion11] [data-tarjeta] svg.e11 text').first()).toBeVisible();
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const svg = document.querySelector('[data-leccion11] [data-tarjeta] svg.e11')!;
      const ts = [...svg.querySelectorAll(':scope text')].filter((t) => t.textContent!.trim()).map((t) => ({ t: t.textContent, r: t.getBoundingClientRect() }));
      const malos: string[] = [];
      for (let i = 0; i < ts.length; i++)
        for (let j = i + 1; j < ts.length; j++) {
          const a = ts[i]!.r, b = ts[j]!.r;
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 3) malos.push(`${ts[i]!.t} × ${ts[j]!.t}`);
        }
      // the load's label must not cross the supply's wire on the right (x = 340 of 380)
      const caja = svg.getBoundingClientRect();
      const k = caja.width / (svg as SVGSVGElement).viewBox.baseVal.width;
      const cruza = ts.filter((x) => x.r.left < caja.left + 340 * k && x.r.right > caja.left + 340 * k).map((x) => x.t);
      return { malos, cruza };
    });
    expect(r.malos, `${ruta} a ${ancho} px`).toEqual([]);
    if (ruta.includes('6.1')) expect(r.cruza, `${ruta} a ${ancho} px`).toEqual([]);
  }
});

test('etapa del SDR: ver el diseño de referencia deja la etapa sin XP aunque luego se escriba a mano', async ({ page }) => {
  test.setTimeout(240_000);
  await limpio(page);
  await page.goto('#/etapas/cap52/2');
  const e = page.locator('article[data-etapa="cap52-2"]');
  await expect(e.locator('input[data-componente="RG"]')).toHaveValue('1k', { timeout: 60_000 });
  await e.locator('[data-comprobar-etapa]').click();
  await expect(e.locator('[data-resultado]')).toHaveAttribute('data-resultado', 'mal', { timeout: 60_000 });
  await e.locator('[data-comprobar-etapa]').click();
  await expect(e.locator('[data-ver-referencia]')).toBeVisible({ timeout: 60_000 });
  await e.locator('[data-ver-referencia]').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Ver el diseño' }).click();
  await expect(e.locator('.referencia')).toBeVisible();
  // reviewed: nothing was recorded, so typing the values shown gave the stage's full XP
  await expect
    .poll(async () => page.evaluate(() => (JSON.parse(localStorage.getItem('epa:proyectos') ?? '{}') as { etapas?: Record<string, { s?: number }> }).etapas?.['cap52-2']?.s ?? 0))
    .toBeGreaterThan(0);
});

test('cursos: los dos capítulos nuevos de las ampliaciones están en su curso, con «Aún no en el libro»', async ({ page }) => {
  await limpio(page);
  for (const [curso, parte, antes] of [['digital', 'cap-new-automatas', 'cap29'], ['potencia', 'cap-new-maquinas', 'cap33']] as const) {
    await page.goto(`#/cursos/${curso}`);
    const tramo = page.locator(`[data-tramo="${parte}"]`);
    await expect(tramo).toBeVisible({ timeout: 30_000 });
    await expect(tramo.locator('h2 [data-nuevo]')).toHaveText('Aún no en el libro');
    expect(await tramo.locator('[data-nodo]').count()).toBeGreaterThan(3);
    // where the book places it: right after the chapter it follows
    const orden = await page.locator('[data-tramo]').evaluateAll((ts) => ts.map((t) => t.getAttribute('data-tramo')));
    expect(orden[orden.indexOf(parte) - 1], curso).toBe(antes);
    // the list view too
    await page.locator('[data-vista="lista"]').click();
    await expect(page.locator(`[data-capitulo="${parte}"] [data-nuevo]`)).toHaveText('Aún no en el libro');
    await page.locator('[data-vista="camino"]').click();
  }
});
