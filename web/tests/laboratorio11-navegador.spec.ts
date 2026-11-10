// 1.1 «Laboratorio guiado» in the browser: lab 1 (Ohm's law and the divider) done end to end with the keyboard alone on
// the simulated Brymen (dial, jacks, leads on the nodes, in series, supply off for Ω), typing what the instrument shows;
// a wrong step answered with its hint; the learning events (XP once per step), the stored progress and the summary after
// a reload; axe (contrast included) on the lab panel in the three themes; 360 px without horizontal scroll; the
// links from the chapter, the instruments' page and the «Taller e instrumentos» course path.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.laboratorio11.config.ts tests/laboratorio11-navegador.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { asentar, axe, limpio, sinHallazgos, type Tema } from './accesibilidad10-comun';

const SELECTOR = ['OFF', 'VFD V∿', 'V∿', 'V⎓', 'mV⎓', 'mV∿', 'T1 T2', '⊣⊢ ⏵', 'Ω ·)))', 'A mA', 'µA'];

async function abrir(page: Page, tema: Tema = 'claro') {
  await limpio(page, tema);
  await page.addInitScript(() => ((window as unknown as { __epaEventos: unknown[] }).__epaEventos = []));
  await page.goto('/#/instrumentos/laboratorio/1');
  await expect(page.locator('section.lab h2')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.banco .estado')).toContainText('Simulado en', { timeout: 90_000 });
}

/** Keyboard: focus a control and press a key. */
async function pulsar(page: Page, sel: ReturnType<Page['locator']>, tecla = 'Enter') {
  await sel.focus();
  await page.keyboard.press(tecla);
}

async function girar(page: Page, rotulo: string) {
  const s = page.getByRole('slider', { name: 'Selector giratorio' });
  const objetivo = SELECTOR.indexOf(rotulo);
  await s.focus();
  for (let k = 0; k < 12; k++) {
    const ahora = Number(await s.getAttribute('aria-valuenow'));
    if (ahora === objetivo) return;
    await page.keyboard.press(ahora < objetivo ? 'ArrowRight' : 'ArrowLeft');
  }
  await expect(s).toHaveAttribute('aria-valuetext', rotulo);
}

async function punta(page: Page, nombre: RegExp, nodo: string) {
  const r = page.getByRole('radio', { name: nombre });
  if ((await r.getAttribute('aria-checked')) !== 'true') await pulsar(page, r);
  await pulsar(page, page.locator('.nodos .nodo-chip', { hasText: new RegExp(`^${nodo}$`) }));
}

/** What the Brymen shows («9,0000 V»), once the bench has simulated the change and the reading is steady. */
async function lecturaBrymen(page: Page): Promise<string> {
  await expect(page.locator('.banco .estado')).toContainText('Simulado en', { timeout: 60_000 });
  const cap = page.locator('figcaption', { hasText: 'Brymen:' });
  await expect(cap).toContainText('±', { timeout: 30_000 });
  // the change is simulated after a short pause: the same reading (units and first digits) twice, 600 ms apart
  const leer = async () => (/Brymen: (.+?) ±/.exec((await cap.textContent()) ?? '')?.[1] ?? '').trim();
  let antes = await leer();
  for (let k = 0; k < 40; k++) {
    await page.waitForTimeout(600);
    const ahora = await leer();
    if (ahora.split(' ')[1] === antes.split(' ')[1] && Math.abs(parseFloat(ahora.replace(',', '.')) / parseFloat(antes.replace(',', '.')) - 1) < 0.002) return ahora;
    antes = ahora;
  }
  return antes;
}

async function escribirYComprobar(page: Page) {
  const v = await lecturaBrymen(page);
  const campo = page.locator('[data-lectura]');
  await campo.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(v);
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-veredicto]')).toHaveAttribute('data-veredicto', 'bien', { timeout: 20_000 });
  await pulsar(page, page.locator('[data-continuar]'));
}

test('laboratorio 1 de principio a fin con el teclado: cada paso comprobado, pistas, XP una vez, avance guardado', async ({ page }) => {
  await abrir(page);
  await expect(page.locator('[data-paso]')).toHaveAttribute('data-paso', 'alimentacion');

  // nothing done yet: the hint names what is missing
  await pulsar(page, page.locator('[data-comprobar]'));
  await expect(page.locator('[data-veredicto="mal"]')).toContainText('apagado');

  // 1. the supply: V⎓, red on a, black on 0; a wrong selector first (alternating) gets its own hint
  await girar(page, 'V∿');
  await punta(page, /Brymen punta roja/, 'a');
  await punta(page, /Brymen punta negra/, '0');
  await pulsar(page, page.locator('[data-comprobar]'));
  await expect(page.locator('[data-veredicto="mal"]')).toContainText('V∿ (alterna)');
  await girar(page, 'V⎓');
  await escribirYComprobar(page);

  // 2. V_out
  await expect(page.locator('[data-paso]')).toHaveAttribute('data-paso', 'vout');
  await expect(page.locator('[data-paso] h3')).toBeFocused();
  await punta(page, /Brymen punta roja/, 'out');
  await escribirYComprobar(page);

  // 3. the current, in series with R1 on the mA jack
  await girar(page, 'A mA');
  await pulsar(page, page.getByRole('button', { name: 'Mover la punta roja al borne mA µA' }));
  const serie = page.locator('.serie select').first();
  const valor = await serie.locator('option', { hasText: 'R1' }).first().getAttribute('value');
  await serie.focus();
  await serie.selectOption(valor!);
  await escribirYComprobar(page);

  // 4. R_th: back to VΩ, the supply off, Ω between out and 0
  await pulsar(page, page.getByRole('button', { name: 'Mover la punta roja al borne ΩV⊣⊢' }));
  await serie.selectOption('');
  await girar(page, 'Ω ·)))');
  await punta(page, /Brymen punta roja/, 'out');
  await punta(page, /Brymen punta negra/, '0');
  await pulsar(page, page.locator('[data-comprobar]'));
  await expect(page.locator('[data-veredicto="mal"]')).toContainText('Quite la alimentación');
  await pulsar(page, page.getByRole('checkbox', { name: 'Circuito alimentado' }), 'Space');
  await escribirYComprobar(page);

  // 5 and 6: the meter loads 1 MΩ; the LED sinks the divider (the bench changes the circuit, the supply comes back)
  await expect(page.locator('[data-paso]')).toHaveAttribute('data-paso', 'carga');
  await girar(page, 'V⎓');
  await escribirYComprobar(page);
  await expect(page.locator('[data-paso]')).toHaveAttribute('data-paso', 'led');
  await escribirYComprobar(page);

  // the summary: the six readings against the book
  await expect(page.locator('[data-resumen] h3')).toHaveText('Laboratorio completado');
  await expect(page.locator('[data-resumen]')).toContainText('6 de 6 lecturas dentro');

  // learning events: one round per step
  const ev = await page.evaluate(() => ((window as unknown as { __epaEventos: { tipo: string; id: string; origen: string; correcta: boolean; final: boolean; intento: number }[] }).__epaEventos).filter((e) => e.tipo === 'respuesta' && e.origen === 'laboratorio'));
  const finales = ev.filter((e) => e.final);
  expect(finales.map((e) => e.id)).toEqual(['alimentacion', 'vout', 'corriente', 'rth', 'carga', 'led'].map((x) => `cap22-lab1-${x}`));
  // two failed checks close a step's round, as on a lesson card (no XP for it); one failed check, then right: half XP
  const fin = (x: string) => finales.find((e) => e.id === `cap22-lab1-${x}`)!;
  expect([fin('alimentacion').correcta, fin('alimentacion').intento]).toEqual([false, 2]);
  expect([fin('rth').correcta, fin('rth').intento]).toEqual([true, 2]);
  for (const x of ['vout', 'corriente', 'carga', 'led']) expect([fin(x).correcta, fin(x).intento], x).toEqual([true, 1]);
  // nothing after a round is closed: the third check of the first step sent no event
  expect(ev.filter((e) => e.id === 'cap22-lab1-alimentacion')).toHaveLength(2);

  // stored progress, and after a reload the lab opens on its summary
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('epa:laboratorio') ?? '{}')?.practicas?.p1?.h?.length ?? 0), { timeout: 10_000 }).toBe(6);
  const reg = await page.evaluate(() => JSON.parse(localStorage.getItem('epa:laboratorio')!).practicas.p1);
  expect(reg.c).toBeGreaterThan(0);
  expect(Object.keys(reg.l).sort()).toEqual(['alimentacion', 'carga', 'corriente', 'led', 'rth', 'vout']);
  await page.reload();
  await expect(page.locator('[data-resumen] h3')).toHaveText('Laboratorio completado', { timeout: 60_000 });
});

for (const tema of ['claro', 'sepia', 'oscuro'] as Tema[]) {
  test(`axe en el panel del laboratorio (${tema}), con una pista y un acierto en pantalla`, async ({ page }) => {
    await abrir(page, tema);
    await asentar(page);
    await pulsar(page, page.locator('[data-comprobar]'));
    await expect(page.locator('[data-veredicto="mal"]')).toBeVisible();
    sinHallazgos(await axe(page, 'section.lab'), `laboratorio ${tema}, pista`);
    await pulsar(page, page.locator('[data-hagalo]'));
    await page.locator('[data-lectura]').fill(await lecturaBrymen(page));
    await pulsar(page, page.locator('[data-comprobar]'));
    await expect(page.locator('[data-veredicto="bien"]')).toBeVisible({ timeout: 20_000 });
    sinHallazgos(await axe(page, 'section.lab'), `laboratorio ${tema}, acierto`);
  });
}

test('a 360 px no hay desplazamiento horizontal; enlaces desde el capítulo, la portada y el camino del curso', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  await limpio(page, 'oscuro');
  await page.goto('/#/instrumentos/laboratorio/1');
  await expect(page.locator('section.lab h2')).toBeVisible({ timeout: 60_000 });
  await asentar(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const caja = await page.locator('section.lab').boundingBox();
  expect(caja!.x).toBeGreaterThanOrEqual(0);
  expect(caja!.x + caja!.width).toBeLessThanOrEqual(360);
  // the 44 px targets of the panel
  for (const sel of ['[data-comprobar]', '[data-donde]', '[data-hagalo]']) expect((await page.locator(sel).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // on a narrow screen the instruments are tabs: the step's instrument is the one shown
  await page.locator('[data-donde]').click();
  await expect(page.getByRole('tab', { name: 'Brymen BM869s' })).toHaveAttribute('aria-selected', 'true');
  await ctx.close();

  const p2 = await browser.newPage();
  await limpio(p2, 'claro');
  await p2.goto('/#/cap22/sec-22.5');
  await expect(p2.locator('[data-laboratorio-enlace]').first()).toHaveAttribute('href', '#/instrumentos/laboratorio/5', { timeout: 60_000 });
  await p2.goto('/#/instrumentos');
  await expect(p2.locator('[data-laboratorio-enlace="12"]')).toHaveAttribute('href', '#/instrumentos/laboratorio/12');
  await p2.goto('/#/cursos/taller');
  await expect(p2.locator('[data-nodo="laboratorio/1"]')).toBeVisible({ timeout: 60_000 });
  await expect(p2.locator('[data-nodo="laboratorio/1"] a[data-abrir-nodo], [data-nodo="laboratorio/1"] .disco').first()).toBeVisible();
  await p2.close();
});
