// 1.1 hand-authored lessons in the browser: the two reference lessons end to end (gating, right and wrong answers with
// their explanation, the challenge's success and failure hints, estimate, order, match, the summary), keyboard only,
// dragging, the three themes (axe, contrast included), 360 px, reduced motion, and the integration with 1.0: the same
// progress key (a section completed with 1.0 stays completed), XP once, mastery and the review, the book's link, the
// 1.0 lesson at …/clasica and the leave guard.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones11.config.ts tests/lecciones11-navegador.spec.ts
import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
type Tema = 'claro' | 'sepia' | 'oscuro';

async function limpio(page: Page, tema: Tema = 'claro', datos: Record<string, unknown> = {}): Promise<void> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript(
    ({ t, d }) => {
      if (!sessionStorage.getItem('preparado')) {
        sessionStorage.setItem('preparado', '1');
        localStorage.clear();
        localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
        localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18, sonido: false, vibracion: false }));
        for (const [k, v] of Object.entries(d)) localStorage.setItem(`epa:${k}`, JSON.stringify(v));
      }
    },
    { t: tema, d: datos },
  );
}

const tarjeta = (page: Page, id: string) => expect(page.locator(`[data-tarjeta="${id}"]`)).toBeVisible();
const boton = (page: Page) => page.locator('[data-continuar]');
const aviso = (page: Page) => page.locator('[data-veredicto]');
const leer = <T>(page: Page, k: string) => page.evaluate((x) => JSON.parse(localStorage.getItem(`epa:${x}`) ?? 'null'), k) as Promise<T>;
async function slider(page: Page, sel: string, teclas: string[]) {
  const s = page.locator(sel);
  await s.focus();
  for (const t of teclas) await page.keyboard.press(t);
}
/** Tab (real keyboard navigation) until the focus is on `sel`. */
async function tabHasta(page: Page, sel: string, max = 60) {
  for (let k = 0; k < max; k++) {
    if (await page.evaluate((s) => !!document.activeElement?.matches(s), sel)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`El tabulador no llega a ${sel}`);
}
const veces = (t: string, n: number) => Array.from({ length: n }, () => t);
/** Goes to a route; a lesson left half done asks first (the leave guard): «Salir». */
async function irA(page: Page, ruta: string) {
  await page.goto(ruta);
  const d = page.getByRole('alertdialog');
  if (await d.isVisible({ timeout: 600 }).catch(() => false)) await d.getByRole('button', { name: 'Salir' }).click();
}

test('sec 1.4 entera: puertas, fallos y aciertos explicados, reto, carga, estimar, ordenar, resumen; progreso, XP, dominio y repaso', async ({ page }) => {
  await limpio(page);
  await page.goto('#/leccion/cap01/sec-1.4');
  // 1 · explore: «Continuar» opens only after moving R₁ and R₂
  await tarjeta(page, 'explore-serie');
  await expect(page.locator('[data-lectura="V_out"]')).toHaveText('4,00 V');
  await expect(boton(page)).toBeDisabled();
  await expect(page.locator('.falta')).toContainText('resistencia de arriba, resistencia de abajo');
  await slider(page, '[data-mando11="R_1"] [role="slider"]', veces('ArrowLeft', 50));
  await expect(boton(page)).toBeDisabled();
  await expect(page.locator('[data-lectura="V_out"]')).toHaveText('6,00 V');
  await slider(page, '[data-mando11="R_2"] [role="slider"]', ['ArrowRight']);
  await expect(boton(page)).toBeEnabled();
  await expect(page.locator('[data-barra="V_1"]')).toContainText('R₁ se queda');
  await boton(page).click();

  // 2 · predict: readings hidden; a wrong option explained and kept marked; the right one reveals the reading
  await tarjeta(page, 'prediga-salida');
  await expect(page).toHaveURL(/#\/leccion\/cap01\/sec-1\.4\/2$/);
  await expect(page.locator('[data-lectura="V_out"]')).toHaveText('¿? V');
  await expect(boton(page)).toHaveText('Comprobar');
  await expect(boton(page)).toBeDisabled();
  await page.locator('[data-opcion="1"]').click();
  await boton(page).click();
  await expect(aviso(page)).toHaveAttribute('data-veredicto', 'mal');
  await expect(aviso(page)).toContainText('Por qué no.');
  await expect(aviso(page)).toContainText('Esos 8 V son los que se queda R₁');
  await expect(boton(page)).toHaveText('Volver a intentarlo');
  await boton(page).click();
  await expect(page.locator('[data-opcion="1"]')).toHaveAttribute('aria-disabled', 'true');
  await page.locator('[data-opcion="0"]').click();
  await boton(page).click();
  await expect(aviso(page)).toContainText('Eso es.');
  await expect(aviso(page)).toContainText('la tercera parte de los 12 V');
  await expect(page.locator('[data-lectura="V_out"]')).toHaveText('4,00 V');
  await boton(page).click();

  // 3 · formula: the book's equation (spoken) and the reader's own values from card 1
  await tarjeta(page, 'regla-reparto');
  await expect(page.locator('[data-formula] img')).toHaveAttribute('alt', /V sub salida igual a V sub entrada por R sub 2/);
  await expect(page.locator('[data-sustitucion]')).toContainText('12 V · 5,1 kΩ / (5 kΩ + 5,1 kΩ) = 6,06 V');
  await boton(page).click();

  // 4 · challenge (ej. 1.4): failure hints both ways, the help after two failures, success
  await tarjeta(page, 'reto-33');
  await expect(page.locator('[data-condicion="0"]')).toHaveAttribute('data-cumple', 'no');
  await boton(page).click();
  await expect(aviso(page)).toContainText('Falta tensión');
  await boton(page).click();
  await slider(page, '[data-mando11="R_2"] [role="slider"]', veces('ArrowRight', 8));
  await expect(page.locator('[data-lectura="V_out"]')).toHaveText('3,44 V');
  await boton(page).click();
  await expect(aviso(page)).toContainText('Sobra tensión');
  await expect(aviso(page)).toContainText('R₂ = 1941 Ω');
  await expect(page.locator('[data-saltar]')).toBeVisible();
  // moving a value takes the verdict away
  await slider(page, '[data-mando11="R_2"] [role="slider"]', ['ArrowLeft']);
  await expect(aviso(page)).toHaveCount(0);
  await expect(page.locator('[data-condicion="0"]')).toHaveAttribute('data-cumple', 'si');
  await boton(page).click();
  await expect(aviso(page)).toContainText('¡Conseguido!');
  await expect(aviso(page)).toContainText('Su R₂ da 3,33 V');
  await boton(page).click();

  // 5 · surprise: connect the load
  await tarjeta(page, 'con-carga');
  await expect(boton(page)).toBeDisabled();
  await page.locator('[data-conectar="carga"]').click();
  await expect(page.locator('[data-lectura="V_out"]')).toHaveText('3,00 V');
  await expect(page.locator('[data-dato="error"]')).toContainText('25 %');
  await expect(page.locator('[data-carga="conectada"]')).toBeVisible();
  await boton(page).click();

  // 6 · why
  await tarjeta(page, 'por-que-baja');
  await page.locator('[data-opcion="0"]').click();
  await boton(page).click();
  await expect(aviso(page)).toContainText('5 ‖ 10 = 3,33 kΩ');
  await boton(page).click();

  // 7 · estimate: too much, too little, right
  await tarjeta(page, 'carga-minima');
  await expect(boton(page)).toBeDisabled();
  await slider(page, '[data-estimar] [role="slider"]', ['End']);
  await boton(page).click();
  await expect(aviso(page)).toContainText('Se ha pasado');
  await boton(page).click();
  await slider(page, '[data-estimar] [role="slider"]', ['Home']);
  await boton(page).click();
  await expect(aviso(page)).toContainText('Se ha quedado corto');
  await boton(page).click();
  await slider(page, '[data-estimar] [role="slider"]', veces('ArrowRight', 33));
  await boton(page).click();
  await expect(aviso(page)).toContainText('33,3 kΩ');
  await expect(page.locator('[data-cerca]')).toContainText('El valor: 33,3 kΩ');
  await boton(page).click();

  // 8 · estimate the parallel
  await tarjeta(page, 'paralelo-estime');
  await slider(page, '[data-estimar] [role="slider"]', veces('ArrowLeft', 59));
  await boton(page).click();
  await expect(aviso(page)).toContainText('90,9 Ω');
  await boton(page).click();

  // 9 · current divider: readings hidden until checked
  await tarjeta(page, 'divisor-corriente');
  await expect(page.locator('[data-lectura="I_t"]')).toHaveText('¿? A');
  await page.locator('[data-opcion="0"]').click();
  await boton(page).click();
  await expect(page.locator('[data-lectura="I_t"]')).toHaveText('132 mA');
  await boton(page).click();

  // 10 · order: wrong first (how many in place), then right with «Subir»
  await tarjeta(page, 'ordene-metodo');
  await boton(page).click();
  await expect(aviso(page)).toContainText('de 4 en su sitio');
  await boton(page).click();
  for (let k = 0; k < 4; k++) {
    for (let g = 0; g < 4; g++) {
      const orden = await page.locator('[data-ordenar] li').evaluateAll((xs) => xs.map((x) => Number((x as HTMLElement).dataset.elemento)));
      if (orden.indexOf(k) <= k) break;
      await page.locator(`[data-subir="${k}"]`).click();
    }
  }
  await boton(page).click();
  await expect(aviso(page)).toContainText('Ese es el orden');
  await boton(page).click();

  // 11 · power
  await tarjeta(page, 'potencia-serie');
  await page.locator('[data-opcion="0"]').click();
  await boton(page).click();
  await expect(aviso(page)).toContainText('P = I²·R');
  await boton(page).click();

  // 1.2 · the cards missed at the first check (2, 4, 7 and 10) come back once, fresh, before the summary
  // (lib/leccion12/ritmo.ts): their own segments in the bar, «Repaso» as the step, the prediction hidden again
  await tarjeta(page, 'prediga-salida');
  await expect(page.locator('[data-leccion11]')).toHaveAttribute('data-vuelta', '');
  await expect(page.locator('.etiqueta')).toHaveText('12 de 16 · Repaso');
  await expect(page.locator('[data-seg="vuelta"]')).toHaveCount(4);
  await expect(page.locator('[data-lectura="V_out"]')).toHaveText('¿? V');
  await page.locator('[data-opcion="0"]').click();
  await boton(page).click();
  await expect(aviso(page)).toContainText('Eso es.');
  await boton(page).click();
  await tarjeta(page, 'reto-33');
  await expect(page.locator('[data-condicion="0"]')).toHaveAttribute('data-cumple', 'no');
  await slider(page, '[data-mando11="R_2"] [role="slider"]', veces('ArrowRight', 7));
  await boton(page).click();
  await expect(aviso(page)).toContainText('¡Conseguido!');
  await boton(page).click();
  await tarjeta(page, 'carga-minima');
  await slider(page, '[data-estimar] [role="slider"]', ['Home', ...veces('ArrowRight', 33)]);
  await boton(page).click();
  await expect(aviso(page)).toContainText('33,3 kΩ');
  await boton(page).click();
  await tarjeta(page, 'ordene-metodo');
  for (let k = 0; k < 4; k++) {
    for (let g = 0; g < 4; g++) {
      const orden = await page.locator('[data-ordenar] li').evaluateAll((xs) => xs.map((x) => Number((x as HTMLElement).dataset.elemento)));
      if (orden.indexOf(k) <= k) break;
      await page.locator(`[data-subir="${k}"]`).click();
    }
  }
  await boton(page).click();
  await expect(aviso(page)).toContainText('Ese es el orden');
  await boton(page).click();

  // 12 · summary: completed with the same key as 1.0, XP once per card, mastery and the review
  await expect(page.locator('[data-resumen]')).toBeVisible();
  await expect(page.locator('[data-intentos]')).toHaveText('Con 6 intentos fallidos: lo repasará antes. 4 tarjetas volvieron al final para repasarlas.');
  await expect(page.locator('[data-repaso]')).toContainText(/Repaso programado|Para repasar/);
  await expect(page.locator('[data-repaso]')).toContainText('Siguiente: 1.5');
  await expect.poll(async () => (await leer<Record<string, { n: number; u: number }>>(page, 'lecciones'))?.['cap01/sec-1.4']).toMatchObject({ n: 12, u: 12 });
  const lec = await leer<Record<string, { c: number; n: number; h: number[]; u: number }>>(page, 'lecciones');
  expect(lec['cap01/sec-1.4']!.c).toBeGreaterThan(0);
  expect(lec['cap01/sec-1.4']!.h).toEqual([...Array(12).keys()]);
  // (the challenge and the load estimate were right only at the third attempt: their round closed at the second failure,
  // as the 1.0 practice — no XP then; 1.2: they came back at the end and were right at once, a new round: XP once now)
  await expect.poll(async () => Object.keys((await leer<{ xp: Record<string, unknown> }>(page, 'progreso-xp'))?.xp ?? {}).filter((k) => k.includes('l11') || k === 'l:cap01/sec-1.4').sort()).toEqual(
    [
      'l:cap01/sec-1.4',
      'pr:cap01-l11-sec-1.4-divisor-corriente',
      'pr:cap01-l11-sec-1.4-ordene-metodo',
      'pr:cap01-l11-sec-1.4-paralelo-estime',
      'pr:cap01-l11-sec-1.4-por-que-baja',
      'pr:cap01-l11-sec-1.4-potencia-serie',
      'pr:cap01-l11-sec-1.4-prediga-salida',
      'pr:cap01-l11-sec-1.4-reto-33',
      'pr:cap01-l11-sec-1.4-carga-minima',
    ].sort(),
  );
  await expect.poll(async () => Object.keys((await leer<{ items: Record<string, unknown> }>(page, 'dominio'))?.items ?? {}).filter((k) => k.includes('-l11-')).length).toBe(8);
  const xpAntes = JSON.stringify((await leer<{ xp: Record<string, unknown> }>(page, 'progreso-xp'))!.xp);
  // again from the start: the answers count as rounds for the review, but give no more XP
  await page.locator('[data-repetir]').click();
  await tarjeta(page, 'explore-serie');
  await page.goto('#/leccion/cap01/sec-1.4/2');
  await tarjeta(page, 'prediga-salida');
  await page.locator('[data-opcion="0"]').click();
  await boton(page).click();
  await expect(aviso(page)).toContainText('Eso es.');
  await page.waitForTimeout(600);
  expect(JSON.stringify((await leer<{ xp: Record<string, unknown> }>(page, 'progreso-xp'))!.xp)).toBe(xpAntes);
});

test('sec 0.3 solo con el teclado: mandos, asas de la gráfica, opciones con teclas, estimar, reto, emparejar', async ({ page }) => {
  await limpio(page);
  await page.goto('#/leccion/cap00/sec-0.3');
  await tarjeta(page, 'explore-senoide');
  await tabHasta(page, '[data-mando11="V_p"] [role="slider"]');
  await page.keyboard.press('ArrowRight');
  await tabHasta(page, '[data-mando11="f"] [role="slider"]');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-lectura="T"]')).toHaveText('22,2 ms');
  await expect(boton(page)).toBeDisabled();
  // the phase through the handle on the curve (a slider of its own)
  await page.keyboard.down('Shift');
  await tabHasta(page, '[data-asa="phi"]');
  await page.keyboard.up('Shift');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-asa="phi"]')).toHaveAttribute('aria-valuenow', '15');
  await expect(page.locator('[data-asa="phi"]')).toHaveAttribute('aria-valuetext', /^15\s°$/);
  await tabHasta(page, '[data-continuar]');
  await expect(boton(page)).toBeEnabled();
  await page.keyboard.press('Enter');

  // predict: «1» chooses, Intro checks and continues (the focus is on the card's heading)
  await tarjeta(page, 'prediga-periodo');
  await expect(page.locator('[data-lectura="T"]')).toHaveText('¿? s');
  await page.keyboard.press('2');
  await expect(page.locator('[data-opcion="1"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await expect(aviso(page)).toContainText('T = 1/f = 1/50 s = 20 ms');
  await page.keyboard.press('Enter');

  await tarjeta(page, 'regla-senoide');
  // (the frequency the reader left on the first card: 45 Hz)
  await expect(page.locator('[data-sustitucion]')).toContainText(/ω = 2π · 45\sHz = 283\srad\/s;\s+T = 1 \/ 45\sHz = 22,2\sms/);
  await page.keyboard.press('ArrowRight');

  // estimate with the keyboard
  await tarjeta(page, 'pico-red');
  await tabHasta(page, '[data-estimar] [role="slider"]');
  await page.keyboard.press('End');
  await tabHasta(page, '[data-continuar]');
  await page.keyboard.press('Enter');
  await expect(aviso(page)).toContainText('Se ha pasado');
  await page.keyboard.press('Enter');
  // «Volver a intentarlo» puts the focus back on the slider
  await expect(page.locator('[data-estimar] [role="slider"]')).toBeFocused();
  for (let k = 0; k < 15; k++) await page.keyboard.press('ArrowLeft');
  await tabHasta(page, '[data-continuar]');
  await page.keyboard.press('Enter');
  await expect(aviso(page)).toContainText('230 × √2 = 325 V');
  await page.keyboard.press('Enter');

  // challenge: the phase to 90° (six steps of 15°)
  await tarjeta(page, 'reto-fase');
  await tabHasta(page, '[data-mando11="phi"] [role="slider"]');
  for (let k = 0; k < 6; k++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-condicion="0"]')).toHaveAttribute('data-cumple', 'si');
  await tabHasta(page, '[data-continuar]');
  await page.keyboard.press('Enter');
  await expect(aviso(page)).toContainText('¡Conseguido!');
  await page.keyboard.press('Enter');

  await tarjeta(page, 'seno-coseno');
  await tabHasta(page, '[data-mando11="phi"] [role="slider"]');
  await page.keyboard.press('ArrowRight');
  await tabHasta(page, '[data-continuar]');
  await page.keyboard.press('Enter');

  // why: a wrong option by its letter, then the right one with Tab and Intro
  await tarjeta(page, 'por-que-radianes');
  await page.keyboard.press('b');
  await page.keyboard.press('Enter');
  await expect(aviso(page)).toContainText('un radián son 57,3°');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-opcion="0"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await tabHasta(page, '[data-continuar]');
  await page.keyboard.press('Enter');
  await expect(aviso(page)).toContainText('π/180');
  await page.keyboard.press('Enter');

  // match: choose a chip (Intro), then its slot (Intro)
  await tarjeta(page, 'simbolos');
  for (let k = 0; k < 4; k++) {
    await tabHasta(page, `[data-ficha="${k}"]`);
    await page.keyboard.press('Enter');
    await expect(page.locator(`[data-ficha="${k}"]`)).toHaveAttribute('aria-pressed', 'true');
    await tabHasta(page, `[data-hueco="${k}"]`);
    await page.keyboard.press('Enter');
  }
  await tabHasta(page, '[data-continuar]');
  await page.keyboard.press('Enter');
  await expect(aviso(page)).toContainText('ω = 314 rad/s');
  await page.keyboard.press('Enter');
  // 1.2 · the two cards missed at the first check come back before the summary, keyboard only
  await tarjeta(page, 'pico-red');
  await expect(page.locator('[data-leccion11]')).toHaveAttribute('data-vuelta', '');
  await tabHasta(page, '[data-estimar] [role="slider"]');
  await page.keyboard.press('End');
  for (let k = 0; k < 15; k++) await page.keyboard.press('ArrowLeft');
  await tabHasta(page, '[data-continuar]');
  await page.keyboard.press('Enter');
  await expect(aviso(page)).toContainText('230 × √2 = 325 V');
  await page.keyboard.press('Enter');
  await tarjeta(page, 'por-que-radianes');
  await page.keyboard.press('a');
  await page.keyboard.press('Enter');
  await expect(aviso(page)).toContainText('π/180');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-resumen]')).toBeVisible();
  await expect(page.locator('[data-resumen] h1')).toBeFocused();
  // Escape closes the lesson
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-leccion11]')).toHaveCount(0);
});

test('con el ratón: arrastrar las asas de la gráfica, las fichas a su hueco y los pasos a su sitio', async ({ page }) => {
  await limpio(page);
  await page.goto('#/leccion/cap00/sec-0.3');
  await tarjeta(page, 'explore-senoide');
  const asa = page.locator('[data-asa="V_p"]');
  const a = (await asa.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 60, { steps: 6 });
  await page.mouse.up();
  const vp = Number(await asa.getAttribute('aria-valuenow'));
  expect(vp).toBeLessThan(325);
  expect(vp).toBeGreaterThanOrEqual(50);
  await expect(page.locator('[data-mando11="V_p"] [role="slider"]')).toHaveAttribute('aria-valuenow', String(vp));

  // (half done: the leave guard asks first)
  await page.goto('#/leccion/cap00/sec-0.3/8');
  await expect(page.getByRole('alertdialog')).toContainText('¿Salir de la lección?');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Salir' }).click();
  await tarjeta(page, 'simbolos');
  for (let k = 0; k < 4; k++) {
    const f = (await page.locator(`[data-ficha="${k}"]`).boundingBox())!;
    const h = (await page.locator(`[data-hueco="${k}"]`).boundingBox())!;
    await page.mouse.move(f.x + 10, f.y + 10);
    await page.mouse.down();
    await page.mouse.move(h.x + 20, h.y + 15, { steps: 5 });
    await page.mouse.up();
  }
  await expect(page.locator('[data-ficha]')).toHaveCount(0);
  await boton(page).click();
  await expect(aviso(page)).toContainText('Eso es.');

  await irA(page, '#/leccion/cap01/sec-1.4/10');
  await tarjeta(page, 'ordene-metodo');
  // drag the item that goes first to the top by its grip
  const fila = page.locator('[data-ordenar] li[data-elemento="0"] .asa');
  const arriba = (await page.locator('[data-ordenar] li').first().boundingBox())!;
  const g = (await fila.boundingBox())!;
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + g.width / 2, arriba.y + 4, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('[data-ordenar] li').first()).toHaveAttribute('data-elemento', '0');
});

test('tres temas: axe (contraste incluido) en las tarjetas de las dos lecciones, con avisos y fichas', async ({ browser }) => {
  for (const tema of ['claro', 'sepia', 'oscuro'] as Tema[]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await limpio(page, tema);
    const pantallas: [string, (p: Page) => Promise<void>][] = [
      ['#/leccion/cap01/sec-1.4', async () => undefined],
      ['#/leccion/cap01/sec-1.4/2', async (p) => {
        await p.locator('[data-opcion="1"]').click();
        await boton(p).click();
        await expect(aviso(p)).toBeVisible();
      }],
      ['#/leccion/cap01/sec-1.4/3', async () => undefined],
      ['#/leccion/cap01/sec-1.4/4', async (p) => {
        await boton(p).click();
        await expect(aviso(p)).toBeVisible();
      }],
      ['#/leccion/cap01/sec-1.4/5', async (p) => {
        await p.locator('[data-conectar="carga"]').click();
      }],
      ['#/leccion/cap01/sec-1.4/6', async (p) => {
        await p.locator('[data-opcion="0"]').click();
        await boton(p).click();
        await expect(aviso(p)).toHaveAttribute('data-veredicto', 'bien');
      }],
      ['#/leccion/cap01/sec-1.4/7', async () => undefined],
      ['#/leccion/cap01/sec-1.4/10', async (p) => {
        await boton(p).click();
        await expect(aviso(p)).toBeVisible();
      }],
      ['#/leccion/cap01/sec-1.4/12', async () => undefined],
      ['#/leccion/cap00/sec-0.3', async () => undefined],
      ['#/leccion/cap00/sec-0.3/5', async (p) => {
        await slider(p, '[data-mando11="phi"] [role="slider"]', veces('ArrowRight', 6));
      }],
      ['#/leccion/cap00/sec-0.3/8', async (p) => {
        await p.locator('[data-ficha="0"]').click();
      }],
    ];
    for (const [ruta, preparar] of pantallas) {
      await irA(page, ruta);
      await expect(page.locator('[data-leccion11] [data-tarjeta]')).toBeVisible();
      await preparar(page);
      await page.waitForTimeout(400);
      await page.addScriptTag({ path: AXE });
      const fallos = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
        const r = await axe.run({ include: [['[data-leccion11]']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] });
        return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      });
      expect(fallos, `${ruta} ${tema}`).toEqual([]);
      // the theme's tokens are the ones in use
      const fondo = await page.locator('.hoja').evaluate((e) => getComputedStyle(e).backgroundColor);
      expect(fondo).toBe({ claro: 'rgb(255, 255, 255)', sepia: 'rgb(248, 241, 227)', oscuro: 'rgb(22, 26, 32)' }[tema]);
    }
    await ctx.close();
  }
});

test('360 px: sin desplazamiento horizontal y objetivos de 44 px en cada tarjeta; reducir movimiento para la corriente', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
  const page = await ctx.newPage();
  await limpio(page);
  for (const [l, n] of [['cap01/sec-1.4', 12], ['cap00/sec-0.3', 9]] as const) {
    for (let k = 1; k <= n; k++) {
      await page.goto(`#/leccion/${l}/${k}`);
      await expect(page.locator('[data-leccion11]')).toHaveAttribute('data-tarjeta-n', String(k - 1));
      await page.waitForTimeout(150);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${l}/${k}`).toBeLessThanOrEqual(360);
      const pequenos = await page.locator('[data-leccion11] button, [data-leccion11] a, [data-leccion11] [role="slider"]').evaluateAll((xs) =>
        xs
          .filter((x) => (x as HTMLElement).offsetParent !== null || x instanceof SVGElement)
          .map((x) => ({ r: x.getBoundingClientRect(), d: (x as HTMLElement).outerHTML.slice(0, 80) }))
          .filter(({ r }) => r.width > 0 && (r.width < 43.5 || r.height < 43.5))
          .map(({ r, d }) => `${Math.round(r.width)}×${Math.round(r.height)} ${d}`),
      );
      expect(pequenos, `${l}/${k}`).toEqual([]);
    }
  }
  // the moving current (1.2: the living circuit's particles, componentes/leccion12/CircuitoVivo.svelte): animated, and
  // still arrows with «reducir movimiento»
  await page.goto('#/leccion/cap01/sec-1.4');
  await expect(page.locator('[data-vivo]').first()).toHaveAttribute('data-vivo', 'animado');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-vivo]').first()).toHaveAttribute('data-vivo', 'quieto');
  // (the app's own reduced-motion rule leaves 0,01 ms)
  expect(parseFloat(await page.locator('.barra').first().evaluate((e) => getComputedStyle(e).transitionDuration))).toBeLessThan(0.001);
  await ctx.close();
});

test('1.0 → 1.1: una sección completada sigue completada (misma clave), el libro abre la lección nueva y la de la 1.0 sigue a mano', async ({ page }) => {
  const T0 = 1_761_400_000_000;
  await limpio(page, 'claro', {
    lecciones: {
      'cap01/sec-1.4': { h: [0, 1, 2, 3, 4], u: 5, n: 5, c: T0, t: T0 },
      'cap00/sec-0.3': { h: [0, 1], u: 2, n: 6, c: 0, t: T0 },
    },
  });
  // the course path: 1.4 done, 0.3 started
  await page.goto('#/cursos/fundamentos');
  await expect(page.locator('[data-nodo="cap01/sec-1.4"]')).toHaveAttribute('data-estado', 'hecho');
  await expect(page.locator('[data-nodo="cap00/sec-0.3"]')).toHaveAttribute('data-estado', 'en-curso');
  // the book's «Estudiar por pasos» opens the new lesson
  await page.goto('#/cap01/sec-1.4');
  await page.locator('[data-por-pasos]').first().click();
  await expect(page.locator('[data-leccion11="cap01/sec-1.4"]')).toBeVisible();
  // visiting a card keeps the completion (same key, now with the new number of cards)
  await expect.poll(async () => (await leer<Record<string, { c: number; n: number }>>(page, 'lecciones'))?.['cap01/sec-1.4']).toMatchObject({ c: T0, n: 12 });
  await expect(page.locator('[data-nodo]')).toHaveCount(0);
  // the 1.0 lesson, from the summary's link: its own screens under …/clasica
  await page.goto('#/leccion/cap01/sec-1.4/12');
  await page.locator('[data-clasica]').click();
  await expect(page.locator('[data-leccion="cap01/sec-1.4"]')).toBeVisible();
  await expect(page).toHaveURL(/\/clasica$/);
  await page.locator('[data-continuar]').click();
  await expect(page).toHaveURL(/\/clasica\/(2|practica-\d+)$/);
  const pantalla = await page.locator('[data-leccion]').getAttribute('data-pantalla');
  await page.reload();
  await expect(page.locator('[data-leccion="cap01/sec-1.4"]')).toBeVisible();
  await expect(page.locator('[data-leccion]')).toHaveAttribute('data-pantalla', pantalla!);
  // the 1.0 practice screens still open in the 1.0 lesson; a section without a new lesson opens the 1.0 one
  await page.goto('#/cap01');
  await page.goto('#/leccion/cap01/sec-1.4/practica-1');
  await expect(page.locator('[data-leccion="cap01/sec-1.4"]')).toBeVisible();
  await expect(page).toHaveURL(/\/clasica\/practica-1$/);
  // (chapter 7: outside the «Fundamentos» chapters 0–6 that get a new lesson; 1.5 has one now)
  await page.goto('#/leccion/cap07/sec-7.1');
  await expect(page.locator('[data-leccion="cap07/sec-7.1"]')).toBeVisible();
  await expect(page.locator('[data-leccion11]')).toHaveCount(0);
  // the 1.0 progress of 0.3 (6 steps, at the third): the course's «Continuar» (…/3, a 1.0 step) does not drop the
  // reader on a wrong card — the new lesson starts at its first card — and the new one writes the same key
  await page.goto('#/cursos/fundamentos');
  await page.goto('#/leccion/cap00/sec-0.3/3');
  await tarjeta(page, 'explore-senoide');
  await expect(page).toHaveURL(/#\/leccion\/cap00\/sec-0\.3$/);
  await expect.poll(async () => (await leer<Record<string, { c: number; n: number; u: number }>>(page, 'lecciones'))['cap00/sec-0.3']).toMatchObject({ c: 0, n: 9, u: 0 });
});

test('salir a medias pide confirmación (diálogo propio); sin empezar o terminada, no', async ({ page }) => {
  await limpio(page);
  await page.goto('#/cap01/sec-1.4');
  await page.goto('#/leccion/cap01/sec-1.4');
  await tarjeta(page, 'explore-serie');
  // untouched: closes at once
  await page.locator('[data-cerrar]').click();
  await expect(page.locator('[data-leccion11]')).toHaveCount(0);
  await page.goto('#/leccion/cap01/sec-1.4');
  await tarjeta(page, 'explore-serie');
  await slider(page, '[data-mando11="R_1"] [role="slider"]', ['ArrowRight']);
  await page.locator('[data-cerrar]').click();
  const dialogo = page.getByRole('alertdialog');
  await expect(dialogo).toContainText('¿Salir de la lección?');
  await dialogo.getByRole('button', { name: 'Seguir en la lección' }).click();
  await expect(page.locator('[data-leccion11]')).toBeVisible();
  // the browser's Back asks too
  await page.goBack();
  await expect(page.getByRole('alertdialog')).toContainText('¿Salir de la lección?');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Salir' }).click();
  await expect(page.locator('[data-leccion11]')).toHaveCount(0);
  // finished: no question
  await page.goto('#/leccion/cap01/sec-1.4/12');
  await expect(page.locator('[data-resumen]')).toBeVisible();
  await page.locator('[data-volver-libro]').click();
  await expect(page.locator('[data-leccion11]')).toHaveCount(0);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});
