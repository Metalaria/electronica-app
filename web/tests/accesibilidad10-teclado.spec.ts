// 1.0 accessibility pass: the critical paths with the keyboard only (desktop), checking at every step that the focus
// is somewhere useful (never dropped to <body>) and that what changed is said (a live region or the focus):
//   - «Saltar al contenido» first, and the focus on the new page's heading after a route change;
//   - answer a question (the verdict takes the focus), check an exercise (one live line sums it up, the fields keep
//     their message through aria-describedby);
//   - take and hand in a teacher-mode exam (time warnings only at thresholds, the dialog, the result);
//   - build a circuit in the schematic editor (palette → canvas cursor → Enter) and on the breadboard (tray card →
//     bench cursor → Enter; a wire hole to hole);
//   - the multimeter (rotary selector with the arrows, the display read as text);
//   - export a backup and restore it (preview heading, «Importar y unir», the result);
//   - the in-app dialog (Escape, focus back to the button that asked).
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb nice npx playwright test -c playwright.accesibilidad10.config.ts tests/accesibilidad10-teclado.spec.ts --project=escritorio --workers=1
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { limpio, asentar } from './accesibilidad10-comun';

test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'keyboard flows run on the desktop'));
test.describe.configure({ timeout: 240_000 });

/** A short description of the focused element. */
const foco = (page: Page) =>
  page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    if (!a || a === document.body) return 'BODY';
    return `${a.tagName}${a.id ? `#${a.id}` : ''}${a.className && typeof a.className === 'string' ? `.${a.className.split(' ')[0]}` : ''}|${(a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 60)}`;
  });

/** Presses Tab until the focused element matches the selector (at most `max` times); fails if it never does. */
async function tabHasta(page: Page, selector: string, max = 120, atras = false): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await page.evaluate((s) => !!document.activeElement?.matches(s), selector)) return;
    await page.keyboard.press(atras ? 'Shift+Tab' : 'Tab');
  }
  throw new Error(`Tab no llega a ${selector} (foco en ${await foco(page)})`);
}

test('«Saltar al contenido» es la primera parada y lleva al título; tras cambiar de ruta el foco va al h1', async ({ page }) => {
  await limpio(page);
  await page.goto('#/');
  await asentar(page);
  await page.keyboard.press('Tab');
  const salto = page.locator('a[data-saltar-contenido]');
  await expect(salto).toBeFocused();
  const caja = (await salto.boundingBox())!;
  expect(caja.y, 'visible al recibir el foco').toBeGreaterThanOrEqual(0);
  await page.keyboard.press('Enter');
  await expect.poll(() => foco(page)).toMatch(/^H1/);
  expect(page.url()).toMatch(/#\/$/);

  // a rail entry by keyboard: the new page's heading takes the focus
  const carril = page.getByRole('navigation', { name: 'Secciones de la aplicación' });
  await carril.getByRole('link', { name: /Simulador/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/simulador$/);
  await expect.poll(() => foco(page)).toMatch(/^H1.*Simulador de circuitos/);
  // and Tab goes on from there into the page, not back to the top
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('main'))).toBe(true);

  // the book's index panel keeps the focus while it is walked with the keyboard
  await page.goto('#/cap05');
  await asentar(page);
  const enlace = page.getByRole('complementary', { name: 'Índice del libro' }).locator('a[href="#/cap05/sec-5.2"]').first();
  if (await enlace.isVisible()) {
    await enlace.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/sec-5\.2$/);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => !!document.activeElement?.closest('aside.lateral'))).toBe(true);
  }
});

test('responder una pregunta y comprobar un ejercicio solo con el teclado', async ({ page }) => {
  await limpio(page);
  // a choice question of a lesson: number keys or Tab + Enter; the verdict takes the focus
  await page.goto('#/leccion/cap05/sec-5.1/pregunta-1');
  await asentar(page, 1200);
  await expect(page.locator('[data-pregunta] button.opcion')).toHaveCount(4);
  await tabHasta(page, '[data-pregunta] button.opcion');
  await page.keyboard.press('Enter');
  // (before 1.0 the chosen option was disabled with the focus on it, and the focus fell to <body>)
  const veredicto = page.locator('[data-pregunta] [data-feedback]');
  await expect(veredicto).toBeVisible();
  await expect(veredicto).toBeFocused();
  await expect(veredicto).toHaveAttribute('role', 'status');
  // Tab goes on from the verdict (to its buttons or the lesson's «Continuar»), not from the top of the page
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('main, .leccion, [data-pregunta]') || document.activeElement?.tagName)).toBe(true);

  // a numeric question: type and Enter; the verdict takes the focus (the field is disabled once answered)
  await page.goto('#/leccion/cap01/sec-1.4/pregunta-1');
  await asentar(page, 1200);
  await tabHasta(page, '[data-pregunta] [data-numero]');
  await page.keyboard.type('1');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-pregunta] [data-feedback]')).toBeFocused();

  // an exercise of the book with self-check: a wrong value, Enter; one live line says it and the field is tied to its message
  await page.goto('#/cap02/ej-2.6');
  await asentar(page, 1200);
  const comp = page.locator('.comprobador form').first();
  await expect(comp).toBeVisible();
  const campo = comp.locator('input[type="text"]').first();
  await campo.focus();
  await page.keyboard.type('999999');
  await page.keyboard.press('Enter');
  const resumen = comp.locator('[data-resumen-comprobacion]');
  await expect(resumen).toHaveAttribute('aria-live', 'polite');
  await expect(resumen).toContainText(/de \d+ respuestas? correctas?/);
  // (a wrong value is aria-invalid; one without its unit gets the «falta la unidad» message: either way it is tied to the field)
  await expect(campo).toHaveAttribute('aria-describedby', /-fb$/);
  const fb = await campo.getAttribute('aria-describedby');
  expect(fb).toBeTruthy();
  await expect(page.locator(`[id="${fb}"]`)).toBeVisible();
  expect(await foco(page)).not.toBe('BODY');
});

/** The exam of the teacher-mode tests (no variants, no shuffling), set up with the mouse: the subject is taking it. */
async function crearExamen(page: Page, minutos: string): Promise<string> {
  await page.goto('#/docente');
  await page.locator('[data-nuevo-examen]').click();
  await expect(page.locator('[data-selector]')).toBeVisible();
  await page.locator('[data-titulo]').fill('Examen de teclado');
  await page.locator('[data-minutos]').fill(minutos);
  await page.locator('[data-variantes]').uncheck();
  await page.locator('[data-barajar]').uncheck();
  await page.locator('[data-filtro-parte]').selectOption('cap05');
  await page.locator('li[data-entrada="pregunta:cap05-01"] [data-anadir]').click();
  // an open exercise (1.1 «razonar»: ej-5.9, used until 1.0, is self-checked now; ej-12.8 is still self-assessed)
  await page.locator('[data-filtro-parte]').selectOption('cap12');
  await page.locator('li[data-entrada="ejercicio:ej-12.8"] [data-anadir]').click();
  await page.locator('[data-guardar]').click();
  await expect(page).toHaveURL(/#\/docente\/examen\/x[a-z0-9]+$/);
  return decodeURIComponent(new URL(page.url()).hash).split('/').pop()!;
}

test('hacer y entregar un examen con el teclado: avisos de tiempo, el diálogo y el resultado', async ({ page }) => {
  await limpio(page);
  await crearExamen(page, '30');
  await asentar(page);
  await tabHasta(page, '[data-empezar]');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-hacer-examen]')).toBeVisible();
  await expect.poll(() => foco(page)).not.toBe('BODY');
  // the time: readable at any moment, and the live line silent at the start (no announcement every minute)
  const reloj = page.locator('[data-reloj]');
  await expect(reloj).toContainText('Tiempo restante: 30 minutos');
  await expect(reloj.locator('[data-aviso-tiempo]')).toHaveText('');
  // answer the first question by keyboard
  await tabHasta(page, '[data-hacer-examen] input, [data-hacer-examen] textarea, [data-hacer-examen] button.opcion');
  const tipo = await page.evaluate(() => (document.activeElement as HTMLInputElement).type);
  if (tipo === 'radio' || tipo === 'checkbox') await page.keyboard.press('Space');
  else await page.keyboard.type('1');
  await tabHasta(page, '[data-entregar]');
  await page.keyboard.press('Enter');
  const dialogo = page.getByRole('alertdialog');
  await expect(dialogo).toBeVisible();
  // the safe option first; Escape closes it and the focus goes back to «Entregar»
  await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialogo).toHaveCount(0);
  await expect(page.locator('[data-entregar]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialogo).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(dialogo.getByRole('button', { name: 'Entregar' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-resultado-examen]')).toBeVisible();
  await expect.poll(() => foco(page)).toMatch(/^H1/);
});

test('el aviso de tiempo solo habla en los umbrales (no cada minuto)', async ({ page }) => {
  await limpio(page);
  await page.clock.install();
  await crearExamen(page, '12');
  await page.locator('[data-empezar]').click();
  const reloj = page.locator('[data-reloj]');
  const aviso = page.locator('[data-aviso-tiempo]');
  await expect(reloj).toContainText('Tiempo restante: 12 minutos');
  await expect(aviso).toHaveText('');
  // 11 minutes left: no threshold, silent; 10: spoken; 9: silent again; 6 (half of 12): spoken; then 5 and 2; the last minute
  const pasos: [string, string][] = [['01:00', ''], ['01:00', 'Quedan 10 minutos'], ['01:00', ''], ['03:00', 'Quedan 6 minutos'], ['01:00', 'Quedan 5 minutos'], ['01:00', ''], ['02:00', 'Quedan 2 minutos'], ['01:00', 'Queda menos de un minuto']];
  for (const [t, esperado] of pasos) {
    await page.clock.fastForward(t);
    await expect(aviso, `tras ${t}`).toHaveText(esperado);
  }
  await expect(reloj).toContainText('Tiempo restante: menos de un minuto');
});

/** Moves the editor's keyboard cursor to a grid point with the arrows. */
async function cursorA(page: Page, sel: string, x: number, y: number): Promise<void> {
  const leer = async () => ((await page.locator(sel).getAttribute('data-cursor-teclado')) ?? '0,0').split(',').map(Number) as [number, number];
  for (let i = 0; i < 400; i++) {
    const [cx, cy] = await leer();
    if (cx === x && cy === y) return;
    await page.keyboard.press(cx < x ? 'ArrowRight' : cx > x ? 'ArrowLeft' : cy < y ? 'ArrowDown' : 'ArrowUp');
  }
  throw new Error(`el cursor no llega a ${x},${y}`);
}

test('montar un circuito en el editor de esquemas solo con el teclado', async ({ page }) => {
  await limpio(page);
  await page.goto('#/editor');
  await asentar(page, 1500);
  const ed = () => page.evaluate(() => {
    const e = (globalThis as unknown as { __epaEditor: { ed: { doc: { componentes: { nombre: string; tipo: string; x: number; y: number }[]; cables: unknown[] } } } }).__epaEditor.ed;
    return { n: e.doc.componentes.length, w: e.doc.cables.length, nombres: e.doc.componentes.map((c) => c.nombre) };
  });
  const n0 = (await ed()).n;
  // the palette: «Resistencia» with Tab and Enter; the canvas takes the focus with its cursor
  await tabHasta(page, '.paleta button[data-tipo="R"]', 200);
  await page.keyboard.press('Enter');
  const lienzo = page.locator('.lienzo');
  await expect(lienzo).toBeFocused();
  await expect(page.locator('[data-anuncio-lienzo]')).toContainText('Resistencia');
  await expect(page.locator('[data-cursor-teclado]')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await ed()).n).toBe(n0 + 1);
  await expect(page.locator('[data-anuncio-lienzo]')).toContainText('colocado');
  // a ground with «g», then a wire from R's pin to the ground's pin: W, Enter, arrows, Enter
  await page.keyboard.press('g');
  await expect.poll(async () => (await ed()).n).toBe(n0 + 2);
  const pines = await page.evaluate(() => {
    const g = globalThis as unknown as { __epaEditor: { ed: { doc: { componentes: { nombre: string; tipo: string }[] } }; pines: (c: unknown) => { x: number; y: number }[] } };
    const cs = g.__epaEditor.ed.doc.componentes;
    const r = cs.find((c) => c.tipo === 'R')!;
    const t = cs.find((c) => c.tipo === 'GND')!;
    return { r: g.__epaEditor.pines(r)[1]!, t: g.__epaEditor.pines(t)[0]! };
  });
  await page.keyboard.press('w');
  const w0 = (await ed()).w;
  await cursorA(page, '[data-cursor-teclado]', pines.r.x, pines.r.y);
  await expect(page.locator('[data-anuncio-lienzo]')).toContainText('patilla');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-anuncio-lienzo]')).toContainText('Cable empezado');
  await cursorA(page, '[data-cursor-teclado]', pines.t.x, pines.t.y);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await ed()).w).toBeGreaterThan(w0);
  await page.keyboard.press('Escape');
  // N selects the parts in turn; Shift + arrows move the selection; Supr deletes it
  await page.keyboard.press('s');
  await page.keyboard.press('n');
  await expect(page.locator('[data-anuncio-lienzo]')).toContainText('seleccionado');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.locator('[data-anuncio-lienzo]')).toContainText('Movido');
  await expect(lienzo).toBeFocused();
});

test('montar en la protoboard solo con el teclado: una pieza de la bandeja y un cable', async ({ page }) => {
  await limpio(page);
  await page.goto('#/protoboard');
  await asentar(page, 2500);
  const pb = () => page.evaluate(() => {
    const g = (globalThis as unknown as { __epaProtoboard: { pb: { doc: { piezas: unknown[]; cables: unknown[] } } } }).__epaProtoboard.pb;
    return { n: g.doc.piezas.length, w: g.doc.cables.length };
  });
  const antes = await pb();
  await tabHasta(page, '.bandeja button.carta:not(.mas)', 200);
  await page.keyboard.press('Enter');
  const mesa = page.locator('.mesa');
  await expect(mesa).toBeFocused();
  await expect(page.locator('[data-anuncio-mesa]')).toContainText('elegida');
  // Enter where the cursor is; if it does not fit there, a few holes to the right
  for (let i = 0; i < 12 && (await pb()).n === antes.n; i++) {
    await page.keyboard.press('Enter');
    if ((await pb()).n === antes.n) for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowRight');
  }
  expect((await pb()).n).toBe(antes.n + 1);
  await expect(page.locator('[data-anuncio-mesa]')).toContainText('puesta');
  // a wire: a free hole further down, Enter, three holes right, Enter
  for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowDown');
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Enter');
    if (/Cable empezado/.test((await page.locator('[data-anuncio-mesa]').textContent()) ?? '')) break;
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowDown');
  }
  await expect(page.locator('[data-anuncio-mesa]')).toContainText('Cable empezado');
  for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await pb()).w).toBe(antes.w + 1);
  await expect(page.locator('[data-anuncio-mesa]')).toContainText('Cable puesto');
  // N goes through what is on the board
  await page.keyboard.press('n');
  await expect(page.locator('[data-anuncio-mesa]')).toContainText(/de \d+\)/);
  await expect(mesa).toBeFocused();
});

test('el multímetro con el teclado: el selector con las flechas y la pantalla leída como texto', async ({ page }) => {
  await limpio(page);
  await page.goto('#/instrumentos/libre');
  await asentar(page, 2500);
  const selector = page.getByRole('slider', { name: 'Selector giratorio' }).first();
  if (!(await selector.count())) test.skip(true, 'el banco libre no muestra el multímetro sin circuito');
  await tabHasta(page, '[role="slider"][aria-label="Selector giratorio"]', 200);
  const antes = await selector.getAttribute('aria-valuetext');
  await page.keyboard.press('ArrowRight');
  await expect(selector).not.toHaveAttribute('aria-valuetext', antes ?? '');
  const pantalla = page.locator('[data-lectura-brymen]').first();
  await expect(pantalla).toHaveAttribute('role', 'img');
  await expect(pantalla).toHaveAttribute('aria-label', /^Pantalla/);
});

test('exportar una copia y restaurarla con el teclado', async ({ page }, info) => {
  await limpio(page, 'claro', { 'epa:marcadores': {} });
  await page.goto('#/cap05');
  await asentar(page);
  await page.goto('#/sincronizacion/copia');
  await asentar(page, 1200);
  await tabHasta(page, '[data-copia-exportar]', 200);
  const [d] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
  const ruta = info.outputPath('copia.json');
  await d.saveAs(ruta);
  await expect(page.locator('[data-copia-exportar]')).toBeFocused();
  // the same backup on a fresh profile
  const ctx = await page.context().browser()!.newContext({ viewport: { width: 1366, height: 900 }, baseURL: info.project.use.baseURL });
  const p2 = await ctx.newPage();
  await limpio(p2);
  await p2.goto('#/sincronizacion/copia');
  await asentar(p2, 1200);
  await tabHasta(p2, '[data-copia-importar]', 200);
  // (the file-chooser interception is switched on asynchronously when the wait starts: a key pressed in the same tick
  // can beat it and the headless browser then drops the chooser — a test race, not the app's)
  const eleccion = p2.waitForEvent('filechooser', { timeout: 15_000 });
  await p2.waitForTimeout(300);
  await p2.keyboard.press('Enter');
  const elector = await eleccion;
  await elector.setFiles(ruta);
  const vista = p2.locator('[data-copia-vista]');
  await expect(vista).toBeVisible();
  await expect(vista.locator('h3')).toBeFocused();
  const cambios = Number(await vista.getAttribute('data-cambios'));
  if (cambios > 0) {
    await tabHasta(p2, '[data-copia-aplicar]');
    await p2.keyboard.press('Enter');
    const res = p2.locator('[data-copia-resultado]');
    await expect(res).toBeVisible();
    await expect(res).toBeFocused();
  }
  await ctx.close();
  fs.rmSync(ruta, { force: true });
});

test('los diálogos «Aa» y «Buscar»: el foco entra, Esc cierra y devuelve el foco, salir con Tab cierra «Aa»', async ({ page }) => {
  await limpio(page);
  await page.goto('#/cap05');
  await asentar(page);
  const aa = page.getByRole('button', { name: 'Tema y tamaño de letra' }).first();
  await aa.focus();
  await page.keyboard.press('Enter');
  const ajustes = page.getByRole('dialog', { name: 'Tema y tamaño de letra' });
  await expect(ajustes).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  // «Aa» is a popover, not a modal (0.11): Tab walks it and, leaving it, closes it — the focus never stays hidden under it
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(ajustes).toHaveCount(0);
  await expect(aa).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(ajustes).toBeVisible();
  for (let i = 0; i < 40 && (await ajustes.count()); i++) await page.keyboard.press('Tab');
  await expect(ajustes).toHaveCount(0);
  expect(await foco(page)).not.toBe('BODY');

  // the search: Ctrl+K, type, Escape; the focus back where it was
  await page.keyboard.press('Control+k');
  const buscar = page.getByRole('dialog', { name: 'Buscar en el libro' });
  await expect(buscar.locator('input')).toBeFocused();
  await page.keyboard.type('zener');
  await page.keyboard.press('Escape');
  await expect(buscar).toHaveCount(0);
  // (before 1.0 the focus fell to <body> here)
  expect(await foco(page)).not.toBe('BODY');

  // the figure viewer: opened with Enter on «Ampliar…», Escape, back on that button
  await page.goto('#/cap05/fig-5.1');
  await asentar(page, 1500);
  const ampliar = page.locator('[id="fig-5.1"]').getByRole('button', { name: /^(Ampliar|Abrir .* en grande)/ }).first();
  await ampliar.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[aria-modal="true"], [role="dialog"]'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(ampliar).toBeFocused();
});
