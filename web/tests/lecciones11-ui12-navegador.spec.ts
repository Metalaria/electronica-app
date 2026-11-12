// 1.2 «Brilliant-style» lesson UI in the browser (agent ui12): the living circuit (particles, wires by voltage with
// legend and values, a prediction that gives nothing away, reduced motion), direct manipulation on the schematic
// (keyboard, drag, tap and − / +), the shell (visual on top, transition, the cue of every check), the course map's
// legend, axe in the dark theme, and the frame rate of the particles on a 4× slower CPU (reported, see README).
//   EPA_DIST=… EPA_PUERTO=… PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones11.config.ts tests/lecciones11-ui12-navegador.spec.ts
import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

async function limpio(page: Page, tema = 'claro', vibracion = false): Promise<void> {
  await page.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript(
    ({ t, v }) => {
      const w = window as unknown as { __vibraciones: unknown[] };
      w.__vibraciones = [];
      Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (p: unknown) => (w.__vibraciones.push(p), true) });
      if (!sessionStorage.getItem('preparado')) {
        sessionStorage.setItem('preparado', '1');
        localStorage.clear();
        localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
        localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18, sonido: false, vibracion: v }));
      }
    },
    { t: tema, v: vibracion },
  );
}

/** Lit pixels of the particles' canvas (alpha > 0) and a cheap fingerprint of where they are. */
const lienzo = (page: Page) =>
  page.locator('[data-vivo] canvas').first().evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    let h = 0;
    for (let i = 3; i < d.length; i += 4)
      if (d[i]! > 0) {
        n++;
        h = (h * 31 + i) % 1_000_003;
      }
    return { n, h };
  });

test('circuito vivo: partículas, hilos por tensión con leyenda y valores, manipulación directa; predicción sin pistas', async ({ page }) => {
  await limpio(page);
  await page.goto('#/leccion/cap01/sec-1.4');
  await expect(page.locator('[data-tarjeta="explore-serie"]')).toBeVisible();
  const vivo = page.locator('[data-vivo]').first();
  await expect(vivo).toHaveAttribute('data-vivo', 'animado');
  await expect(vivo).toHaveAttribute('data-vivo-tensiones', 'exactas');
  // visual on top: the drawing comes before the card's text
  expect(await page.evaluate(() => {
    const c = document.querySelector('[data-circuito]')!;
    const t = document.querySelector('.texto')!;
    return !!(c.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  // particles drawn and moving
  await expect.poll(async () => (await lienzo(page)).n).toBeGreaterThan(50);
  const a = await lienzo(page);
  await page.waitForTimeout(300);
  expect((await lienzo(page)).h).not.toBe(a.h);
  // wires coloured by voltage: the output node and the source's are different colours; ground is the scale's middle
  const trazo = (r: string) => page.locator(`[data-red="${r}"]`).first().evaluate((e) => (e as SVGElement).style.stroke);
  const [fte, sal] = [await trazo('fte'), await trazo('salida')];
  expect(fte).not.toBe('');
  expect(sal).not.toBe(fte);
  await expect(page.locator('[data-leyenda-tension]')).toContainText('12 V');
  // «Ver valores»: each node's voltage written on the drawing (colour is not the only cue)
  await page.locator('[data-ver-tensiones]').click();
  await expect(page.locator('[data-ver-tensiones]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-tension-nodo="salida"]')).toHaveText('4 V');
  await expect(page.locator('[data-tension-nodo="fte"]')).toHaveText('12 V');

  // direct manipulation: the lower resistor is a slider on the drawing (keyboard), with its value spoken
  const asa = page.locator('[data-asa="abajo"]');
  await expect(asa).toHaveAttribute('role', 'slider');
  await expect(asa).toHaveAttribute('aria-valuetext', '5 kiloohmios');
  const box = await asa.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await asa.focus();
  await page.keyboard.press('ArrowUp');
  await expect(asa).not.toHaveAttribute('aria-valuetext', '5 kiloohmios');
  const v1 = await page.locator('[data-lectura="V_out"]').textContent();
  expect(parseFloat(v1!.replace(',', '.'))).toBeGreaterThan(4);
  await expect(page.locator('[data-tension-nodo="salida"]')).not.toHaveText('4 V');
  // the control below follows the same value
  await expect(page.locator('[data-mando11="R_2"] [role="slider"]')).toHaveAttribute('aria-valuetext', (await asa.getAttribute('aria-valuetext'))!);
  // drag: up raises the value, down lowers it
  await page.keyboard.press('Home');
  const bajo = await asa.getAttribute('aria-valuenow');
  const b = (await asa.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - 80, { steps: 8 });
  await page.mouse.up();
  expect(Number(await asa.getAttribute('aria-valuenow'))).toBeGreaterThan(Number(bajo));
  // tap: − / + buttons
  const b2 = (await asa.boundingBox())!;
  await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);
  const pasos = page.locator('[data-pasos="abajo"]');
  await expect(pasos).toBeVisible();
  const antes = Number(await asa.getAttribute('aria-valuenow'));
  await pasos.getByRole('button', { name: /Subir/ }).click();
  expect(Number(await asa.getAttribute('aria-valuenow'))).toBeGreaterThan(antes);

  // a prediction gives nothing away: no voltages, no legend, readings hidden
  await page.goto('#/leccion/cap01/sec-1.4/2');
  const d = page.getByRole('alertdialog');
  if (await d.isVisible({ timeout: 800 }).catch(() => false)) await d.getByRole('button', { name: 'Salir' }).click();
  await page.goto('#/leccion/cap01/sec-1.4/2');
  await page.reload();
  await expect(page.locator('[data-tarjeta="prediga-salida"]')).toBeVisible();
  await expect(page.locator('[data-vivo]').first()).toHaveAttribute('data-vivo-tensiones', 'no');
  await expect(page.locator('[data-leyenda-tension]')).toHaveCount(0);
  expect(await trazo('salida')).toBe('');
});

test('ritmo: transición, vibración en cada comprobación (también con la ronda cerrada) y mapa con sus cuatro estados', async ({ page }) => {
  await limpio(page, 'claro', true);
  await page.goto('#/leccion/cap01/sec-1.4/4');
  await expect(page.locator('[data-tarjeta="reto-33"]')).toBeVisible();
  const vib = () => page.evaluate(() => (window as unknown as { __vibraciones: unknown[] }).__vibraciones.length);
  const n0 = await vib();
  for (let k = 0; k < 3; k++) {
    await page.locator('[data-continuar]').click();
    await expect(page.locator('[data-veredicto]')).toHaveAttribute('data-veredicto', 'mal');
    await page.locator('[data-continuar]').click();
  }
  // three failed checks, the third after the round closed (no event): three cues
  expect(await vib()).toBe(n0 + 3);
  // the course map: legend with the four states
  await page.goto('#/cursos/fundamentos');
  const d = page.getByRole('alertdialog');
  if (await d.isVisible({ timeout: 600 }).catch(() => false)) await d.getByRole('button', { name: 'Salir' }).click();
  await expect(page.locator('[data-leyenda-camino]')).toContainText('Por hacer');
  await expect(page.locator('[data-leyenda-camino]')).toContainText('Dominada');
});

test('reducir movimiento: flechas quietas en lugar de partículas', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await limpio(page);
  await page.goto('#/leccion/cap01/sec-1.4');
  await expect(page.locator('[data-vivo]').first()).toHaveAttribute('data-vivo', 'quieto');
  await expect.poll(async () => (await lienzo(page)).n).toBeGreaterThan(20);
  const a = await lienzo(page);
  await page.waitForTimeout(400);
  expect((await lienzo(page)).h).toBe(a.h);
});

test('oscuro: axe (contraste incluido) con los valores de los nodos a la vista', async ({ page }) => {
  await limpio(page, 'oscuro');
  await page.goto('#/leccion/cap01/sec-1.4');
  await expect(page.locator('[data-tarjeta="explore-serie"]')).toBeVisible();
  await page.locator('[data-ver-tensiones]').click();
  await expect(page.locator('[data-tension-nodo="salida"]')).toBeVisible();
  await page.addScriptTag({ path: AXE });
  const fallos = await page.evaluate(async () => {
    const a = (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
    const r = await a.run({ include: [['[data-leccion11]']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] });
    return r.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  });
  expect(fallos).toEqual([]);
});

test('rendimiento: partículas con la CPU 4× y 6× más lenta (mide y se rebaja si hace falta)', async ({ page }) => {
  await limpio(page);
  await page.setViewportSize({ width: 412, height: 860 });
  await page.goto('#/leccion/cap01/sec-1.4');
  await expect(page.locator('[data-vivo]').first()).toHaveAttribute('data-vivo', 'animado');
  const cdp = await page.context().newCDPSession(page);
  const medidas: Record<string, unknown> = {};
  for (const tasa of [1, 4, 6]) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: tasa });
    await page.reload();
    const v = page.locator('[data-vivo]').first();
    await expect(v).toHaveAttribute('data-vivo-fps', /\d+/, { timeout: 20_000 });
    await page.waitForTimeout(4000);
    medidas[`${tasa}x`] = await v.evaluate((e) => ({ fps: Number(e.getAttribute('data-vivo-fps')), ms: Number(e.getAttribute('data-vivo-ms')), nivel: Number(e.getAttribute('data-vivo-nivel')) }));
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log('circuito vivo, rendimiento:', JSON.stringify(medidas));
  const x1 = medidas['1x'] as { fps: number; nivel: number };
  expect(x1.fps).toBeGreaterThan(20);
});
