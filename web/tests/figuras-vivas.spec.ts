// Live figures (componentes/figuras-vivas): plot readout and A/B cursors, a simulable schematic with moving
// charge particles and a re-simulation from a slider, a schematic that can only show its connections, the live
// circuit of the simulator page, and the netlist generator against the book's own. Screenshots of each at
// phone, 1280 × 800 (DPR 2) and tablet portrait size, light and dark, go to tests/capturas/.
import { expect, test, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { generarNetlist } from '../src/componentes/figuras-vivas/esquema/netlist.ts';
import type { DatosFigura } from '../src/componentes/figuras-vivas/tipos.ts';

const LIBRO = new URL('../public/libro/', import.meta.url);

async function abrirFigura(page: Page, parte: string, label: string) {
  await page.goto(`/#/${parte}/${label}`);
  const fig = page.locator(`figure[id="${label}"]`);
  await expect(fig).toBeVisible();
  await fig.scrollIntoViewIfNeeded();
  // The live layer appears once the figure data are loaded.
  await expect(fig.locator('.viva.lista')).toBeVisible();
  return fig;
}

/** Particle frames drawn so far (CapaEsquema keeps the count for the performance test). */
const frames = (page: Page) => page.evaluate(() => (globalThis as unknown as { __epaFiguras?: { n: number } }).__epaFiguras?.n ?? 0);

test('las netlists generadas desde la topología coinciden con las del libro', () => {
  let n = 0;
  for (const f of readdirSync(new URL('datos/', LIBRO))) {
    const d = JSON.parse(readFileSync(new URL(`datos/${f}`, LIBRO), 'utf8')) as DatosFigura;
    for (const e of d.esquemas ?? []) {
      if (!e.simulacion?.simulable) continue;
      expect(generarNetlist(e).texto, `${f}`).toBe(e.simulacion.netlist);
      n++;
    }
  }
  expect(n).toBeGreaterThan(25);
});

test('gráfica: lectura con el puntero, fijada con clic, y cursores A/B', async ({ page }) => {
  const fig = await abrirFigura(page, 'cap05', 'fig-5.1');
  const zona = fig.locator('.zona-g').first();
  const caja = (await zona.boundingBox())!;
  await page.mouse.move(caja.x + caja.width * 0.6, caja.y + caja.height * 0.5);
  const lectura = fig.locator('.lectura-fv');
  await expect(lectura).toBeVisible();
  // x in volts, y in amperes with SI prefixes and decimal comma.
  await expect(lectura.locator('.lx')).toContainText(/\d,\d+\s?mV|\d,\d+\s?V/);
  await expect(lectura.locator('.ly strong').first()).toContainText(/A$/);
  await page.mouse.click(caja.x + caja.width * 0.6, caja.y + caja.height * 0.5);
  await page.mouse.move(0, 0);
  await expect(lectura).toBeVisible();
  await expect(lectura).toContainText('Clic para soltar');
  await fig.getByRole('button', { name: 'Cursores A y B' }).click();
  await expect(fig.locator('.cursores-fv table').first()).toContainText('B − A');
});

test('esquema simulable: partículas en movimiento, ficha y nueva simulación con un deslizador', async ({ page }) => {
  const fig = await abrirFigura(page, 'cap22', 'fig-22.3');
  await expect(fig.locator('.capa-p')).toBeAttached();
  const f0 = await frames(page);
  await page.waitForTimeout(700);
  expect(await frames(page)).toBeGreaterThan(f0 + 10);
  // Something is drawn on the particle canvas.
  const pintados = await fig.locator('.capa-p').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
    return n;
  });
  expect(pintados).toBeGreaterThan(50);
  // Hover the resistor: its card shows V, I and P.
  const zona = fig.locator('.zona-e').first();
  await zona.hover({ position: { x: 5, y: 5 } });
  const e = fig.locator('.zona-e').first();
  const caja = (await e.boundingBox())!;
  const ficha = fig.locator('.ficha');
  for (const [fx, fy] of [[0.5, 0.06], [0.45, 0.08], [0.5, 0.1]] as const) {
    await page.mouse.move(caja.x + caja.width * fx, caja.y + caja.height * fy);
    if (await ficha.isVisible()) break;
  }
  await expect(ficha).toBeVisible();
  // Values from the sliders: re-simulated in the ngspice worker.
  await fig.getByRole('button', { name: 'Valores' }).click();
  const r = fig.locator('.valor', { hasText: 'Resistencia' }).locator('input');
  await r.focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(fig.locator('.panel-e .estado')).toContainText('valores cambiados', { timeout: 60_000 });
  await expect(fig.locator('.valor', { hasText: 'Resistencia' }).locator('output')).toContainText('kΩ');
  await fig.getByRole('button', { name: 'Valores del libro' }).click();
  await expect(fig.locator('.panel-e .estado')).toHaveCount(0);
});

test('esquema no simulable: solo conexiones, con el motivo y la red resaltada', async ({ page }) => {
  const fig = await abrirFigura(page, 'cap01', 'fig-1.12');
  await expect(fig.locator('.motivo')).toContainText('no se puede simular');
  await expect(fig.locator('.capa-p')).toHaveCount(0);
  const caja = (await fig.locator('.zona-e').first().boundingBox())!;
  // Sweep until a net is highlighted.
  let hallado = false;
  for (let fx = 0.05; fx < 0.95 && !hallado; fx += 0.05) {
    for (const fy of [0.2, 0.5, 0.8]) {
      await page.mouse.move(caja.x + caja.width * fx, caja.y + caja.height * fy);
      if (await fig.locator('.marca-red.topologia, .marca-term.topologia').count()) {
        hallado = true;
        break;
      }
    }
  }
  expect(hallado).toBe(true);
});

test('simulador: el circuito de la netlist se dibuja vivo con sus resultados', async ({ page }) => {
  await page.goto('/#/simulador/cap23/fig-23.3');
  const c = page.locator('.circuito-vivo');
  await expect(c).toBeVisible({ timeout: 60_000 });
  await expect(c.locator('.leyenda')).toBeVisible({ timeout: 60_000 });
  const f0 = await frames(page);
  await page.waitForTimeout(700);
  expect(await frames(page)).toBeGreaterThan(f0 + 10);
});

test('simulador: tocar un componente del circuito lleva a su control deslizante', async ({ page }) => {
  await page.goto('/#/simulador/cap23/fig-23.3');
  const c = page.locator('.circuito-vivo');
  await expect(c.locator('.leyenda')).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() =>
    window.addEventListener('epa:elegir-componente', (ev) => {
      (globalThis as unknown as { __elegido?: string }).__elegido = (ev as CustomEvent<{ nombre: string }>).detail.nombre;
    }),
  );
  const zona = c.locator('.zona-e').first();
  await zona.scrollIntoViewIfNeeded();
  const b = (await zona.boundingBox())!;
  // Tap across the drawing until a part is chosen.
  let nombre: string | undefined;
  for (let fy = 0.1; fy < 0.95 && !nombre; fy += 0.1) {
    for (let fx = 0.1; fx < 0.95 && !nombre; fx += 0.1) {
      await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
      nombre = await page.evaluate(() => (globalThis as unknown as { __elegido?: string }).__elegido);
      if (!nombre) await page.keyboard.press('Escape');
    }
  }
  expect(nombre).toMatch(/^[rv]\d/);
  // The page brings up that part's slider.
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.closest('li[data-elemento]')?.getAttribute('data-elemento') ?? ''))
    .toBe(nombre);
});

test('simulador: zoom del circuito sin agrandar el lienzo de partículas', async ({ page }) => {
  await page.goto('/#/simulador/cap23/fig-23.3');
  const c = page.locator('.circuito-vivo');
  await expect(c.locator('.leyenda')).toBeVisible({ timeout: 60_000 });
  const ventana = c.locator('.ventana');
  const w0 = (await ventana.boundingBox())!.width;
  await c.getByRole('button', { name: 'Acercar' }).click();
  await c.getByRole('button', { name: 'Acercar' }).click();
  await expect(c.locator('.nivel')).toHaveText('225 %');
  const lienzo = await c.locator('.capa-p').evaluate((e: HTMLCanvasElement) => e.width);
  expect(lienzo).toBeLessThanOrEqual(Math.ceil(w0 * 2 * 1.05) + 4);
  await c.getByRole('button', { name: 'Ver todo el circuito' }).click();
  await expect(c.locator('.nivel')).toHaveCount(0);
});

const TAMANOS = {
  movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  mac: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
  'tableta-vertical': { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;

for (const [tam, opciones] of Object.entries(TAMANOS)) {
  for (const tema of ['claro', 'oscuro'] as const) {
    test(`capturas de figuras vivas ${tam} ${tema}`, async ({ browser }) => {
      const ctx = await browser.newContext({ ...opciones, colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
      await ctx.addInitScript((t) => localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 })), tema);
      const page = await ctx.newPage();
      for (const [parte, label, nombre] of [
        ['cap22', 'fig-22.3', 'esquema-transitorio'],
        ['cap23', 'fig-23.6', 'esquema-continua'],
        ['cap01', 'fig-1.12', 'esquema-conexiones'],
        ['cap05', 'fig-5.1', 'grafica'],
      ] as const) {
        const fig = await abrirFigura(page, parte, label);
        const z = fig.locator('.zona-g, .zona-e').first();
        const b = (await z.boundingBox())!;
        if (tam === 'mac') await page.mouse.move(b.x + b.width * 0.55, b.y + b.height * 0.45);
        else await page.touchscreen.tap(b.x + b.width * 0.55, b.y + b.height * 0.45);
        await page.waitForTimeout(400);
        await fig.screenshot({ path: `tests/capturas/figuras-vivas-${tam}-${tema}-${nombre}.png` });
      }
      // A large automatic schematic, zoomed in.
      await page.goto('/#/simulador/cap50/rectificador');
      const auto = page.locator('.circuito-vivo');
      await expect(auto.locator('.zona-e').first()).toBeAttached({ timeout: 60_000 });
      await auto.getByRole('button', { name: 'Acercar' }).click();
      await auto.getByRole('button', { name: 'Acercar' }).click();
      await page.waitForTimeout(500);
      await auto.screenshot({ path: `tests/capturas/figuras-vivas-${tam}-${tema}-simulador-auto-zoom.png` });
      await page.goto('/#/simulador/cap22/fig-22.3_carga_rc');
      await expect(page.locator('.circuito-vivo .leyenda')).toBeVisible({ timeout: 60_000 });
      await page.locator('.circuito-vivo').screenshot({ path: `tests/capturas/figuras-vivas-${tam}-${tema}-simulador.png` });
      await ctx.close();
    });
  }
}
