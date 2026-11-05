// 0.12 fix round 2: the destructive confirmations («Borrar» a breadboard, «Nuevo» over an unsaved circuit) use an
// in-app dialog (src/lib/confirmar.ts + src/componentes/Confirmacion.svelte) instead of window.confirm: on desktop
// tauri-plugin-dialog replaces window.confirm with an async function (a Promise, always truthy), WKWebView without a
// confirm delegate (wry) answers false, and Android's depends on the WebChromeClient. The in-app one behaves the same
// everywhere and needs no permission. Checked here: it asks, «Cancelar»/Escape keep the item, the destructive button
// does it, the default focus is on the safe option, Tab stays inside, the focus returns to the trigger, 44 px targets on
// touch screens, and axe (contrast included) in the three themes.
//   PLAYWRIGHT_BROWSERS_PATH=… npx playwright test -c playwright.plataforma12.config.ts confirmacion12
import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

async function preparar(page: Page): Promise<string[]> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
    }
  });
  // any native dialog is a failure: none must appear
  const nativos: string[] = [];
  page.on('dialog', (d) => {
    nativos.push(d.message());
    void d.dismiss();
  });
  return nativos;
}

async function montajeGuardado(page: Page) {
  await page.goto('./#/protoboard');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page).toHaveURL(/#\/protoboard\/.+/);
  await page.getByRole('button', { name: /Mis montajes|Montajes/ }).click();
  const lista = page.getByRole('region', { name: 'Mis montajes' });
  await expect(lista.getByRole('listitem')).toHaveCount(1);
  return lista;
}

test('Protoboard «Borrar»: pregunta dentro de la app; Escape y «Cancelar» lo conservan; «Borrar» lo borra', async ({ page }) => {
  const nativos = await preparar(page);
  const lista = await montajeGuardado(page);
  const borrar = lista.getByRole('button', { name: 'Borrar' });
  await borrar.click();
  const dialogo = page.getByRole('alertdialog', { name: '¿Borrar «Montaje nuevo»?' });
  await expect(dialogo).toBeVisible();
  // the safe option has the focus; Tab stays inside the dialog
  await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialogo.getByRole('button', { name: 'Borrar' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialogo.getByRole('button', { name: 'Borrar' })).toBeFocused();
  // Escape cancels, and the focus goes back to the button that asked
  await page.keyboard.press('Escape');
  await expect(dialogo).toHaveCount(0);
  await expect(borrar).toBeFocused();
  await expect(lista.getByRole('listitem')).toHaveCount(1);
  // «Cancelar» keeps it too
  await borrar.click();
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo).toHaveCount(0);
  await page.waitForTimeout(300);
  await expect(lista.getByRole('listitem')).toHaveCount(1);
  // «Borrar» does it
  await borrar.click();
  await dialogo.getByRole('button', { name: 'Borrar' }).click();
  await expect(lista.getByRole('listitem')).toHaveCount(0);
  expect(nativos).toEqual([]);
});

test('Editor «Nuevo» con un circuito sin guardar: «Cancelar» lo conserva; «Descartar» empieza uno vacío', async ({ page }) => {
  const nativos = await preparar(page);
  await page.goto('./#/editor');
  await expect(page.locator('.lienzo')).toBeVisible();
  await page.waitForFunction(() => !!(window as unknown as { __epaEditor?: unknown }).__epaEditor);
  await page.locator('.paleta [data-tipo="R"]').click();
  const [x, y] = await page.evaluate(() => (window as unknown as { __epaEditor: { pantalla: (x: number, y: number) => [number, number] } }).__epaEditor.pantalla(5, 3));
  await page.mouse.click(x, y);
  const n = () => page.evaluate(() => (window as unknown as { __epaEditor: { ed: { doc: { componentes: unknown[] } } } }).__epaEditor.ed.doc.componentes.length);
  await expect.poll(n).toBe(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Nuevo' }).click();
  const dialogo = page.getByRole('alertdialog', { name: '¿Empezar un circuito nuevo?' });
  await expect(dialogo).toContainText('El que está dibujando no se ha guardado y se perderá.');
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo).toHaveCount(0);
  expect(await n()).toBe(1);
  await page.getByRole('button', { name: 'Nuevo' }).click();
  await dialogo.getByRole('button', { name: 'Descartar' }).click();
  await expect.poll(n).toBe(0);
  expect(nativos).toEqual([]);
});

test('en una pantalla táctil los botones del diálogo miden al menos 44 px', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await preparar(page);
  const lista = await montajeGuardado(page);
  await lista.getByRole('button', { name: 'Borrar' }).tap();
  const dialogo = page.getByRole('alertdialog');
  for (const nombre of ['Cancelar', 'Borrar']) {
    const caja = await dialogo.getByRole('button', { name: nombre }).boundingBox();
    expect(caja!.height, nombre).toBeGreaterThanOrEqual(44);
    expect(caja!.width, nombre).toBeGreaterThanOrEqual(44);
  }
  await ctx.close();
});

test('accesibilidad (axe, contraste incluido) del diálogo en claro, sepia y oscuro', async ({ browser }) => {
  for (const tema of ['claro', 'sepia', 'oscuro']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript((t) => {
      const p = JSON.parse(localStorage.getItem('epa:prefs') ?? '{}');
      localStorage.setItem('epa:prefs', JSON.stringify({ ...p, tema: t }));
    }, tema);
    const page = await ctx.newPage();
    await preparar(page);
    const lista = await montajeGuardado(page);
    await lista.getByRole('button', { name: 'Borrar' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    // (after its short fade-in: mid-animation the colours are blended and axe would measure them)
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    await page.addScriptTag({ path: AXE });
    const v = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
      const r = await axe.run(
        { include: [['[role="alertdialog"]']] },
        { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] },
      );
      return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    });
    expect(v, tema).toEqual([]);
    await ctx.close();
  }
});

test('con la pregunta abierta el teclado no llega a la página (Ctrl+S, Ctrl+K) y Enter sigue pulsando el botón enfocado', async ({ page }) => {
  await preparar(page);
  const lista = await montajeGuardado(page);
  const url = page.url();
  await lista.getByRole('button', { name: 'Borrar' }).click();
  const dialogo = page.getByRole('alertdialog');
  await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  // the breadboard's Ctrl+S and the search's Ctrl+K would act on the page behind
  await page.keyboard.press('Control+s');
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(300);
  expect(page.url()).toBe(url);
  await expect(page.getByRole('dialog', { name: /Buscar/ })).toHaveCount(0);
  await expect(dialogo).toBeVisible();
  // Enter on «Cancelar» cancels
  await page.keyboard.press('Enter');
  await expect(dialogo).toHaveCount(0);
  await expect(lista.getByRole('listitem')).toHaveCount(1);
  // Tab to «Borrar» and Enter deletes
  await lista.getByRole('button', { name: 'Borrar' }).click();
  await page.keyboard.press('Tab');
  await expect(dialogo.getByRole('button', { name: 'Borrar' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(lista.getByRole('listitem')).toHaveCount(0);
});

test('un clic de verdad fuera del diálogo cancela; el atrás del navegador también', async ({ page }) => {
  await preparar(page);
  const lista = await montajeGuardado(page);
  await lista.getByRole('button', { name: 'Borrar' }).click();
  const dialogo = page.getByRole('alertdialog');
  await expect(dialogo).toBeVisible();
  await page.waitForTimeout(400);
  await page.mouse.click(5, 5);
  await expect(dialogo).toHaveCount(0);
  await expect(lista.getByRole('listitem')).toHaveCount(1);
  // back: the question closes as «Cancelar», nothing is deleted and nothing stays inert
  await lista.getByRole('button', { name: 'Borrar' }).click();
  await expect(dialogo).toBeVisible();
  await page.goBack();
  await expect(dialogo).toHaveCount(0);
  expect(await page.evaluate(() => [...document.body.children].filter((e) => (e as HTMLElement).inert).length)).toBe(0);
  // (the breadboard is still saved: a fresh load lists it)
  await page.goto('./#/protoboard');
  await page.reload();
  await page.getByRole('button', { name: /Mis montajes|Montajes/ }).click();
  await expect(page.getByRole('region', { name: 'Mis montajes' }).getByRole('listitem')).toHaveCount(1);
});
