// Third independent review of the 0.12 «platform» block: the in-app confirmation (lib/confirmar.ts +
// componentes/Confirmacion.svelte) replaced window.confirm, which blocked the page while it was open. The new dialog
// makes the rest of the page inert, but inert does not stop key events: a key pressed in the dialog (focus on
// «Cancelar») bubbles to the window, where the editor's shortcuts (EditorEsquemas.svelte `<svelte:window
// onkeydown={teclas}>`, Protoboard.svelte too) act on the drawing behind the modal: Supr deletes the selection,
// «g» places a ground, Ctrl+Z undoes. Confirmacion.svelte only stops the propagation of Escape.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision12r.config.ts revision12r-teclas
import { test, expect, type Page } from '@playwright/test';

type Ed = { __epaEditor: { pantalla: (x: number, y: number) => [number, number]; ed: { doc: { componentes: { tipo: string }[] } } } };

async function editorConUnaResistencia(page: Page) {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('preparado')) {
      sessionStorage.setItem('preparado', '1');
      localStorage.clear();
      localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
    }
  });
  await page.goto('./#/editor');
  await expect(page.locator('.lienzo')).toBeVisible();
  await page.waitForFunction(() => !!(window as unknown as { __epaEditor?: unknown }).__epaEditor);
  await page.locator('.paleta [data-tipo="R"]').click();
  const [x, y] = await page.evaluate(() => (window as unknown as Ed).__epaEditor.pantalla(5, 3));
  await page.mouse.click(x, y);
  await expect.poll(() => tipos(page)).toEqual(['R']);
  await page.keyboard.press('Escape');
}

const tipos = (page: Page) => page.evaluate(() => (window as unknown as Ed).__epaEditor.ed.doc.componentes.map((c) => c.tipo));

for (const [tecla, que] of [
  ['Delete', 'Supr borra la selección'],
  ['g', '«g» coloca una masa'],
] as const) {
  test(`con «¿Empezar un circuito nuevo?» abierto, ${que} del dibujo de detrás: no debe`, async ({ page }) => {
    await editorConUnaResistencia(page);
    // select everything (the shortcut of the editor itself), then ask for «Nuevo»
    await page.keyboard.press('Control+a');
    await page.getByRole('button', { name: 'Nuevo' }).click();
    const dialogo = page.getByRole('alertdialog', { name: '¿Empezar un circuito nuevo?' });
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await page.keyboard.press(tecla);
    await page.waitForTimeout(200);
    // the reader then keeps the circuit: it must be exactly what it was
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toHaveCount(0);
    expect(await tipos(page)).toEqual(['R']);
  });
}
