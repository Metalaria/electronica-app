// 3D component models (componentes/tres): the «2D | 3D» switch of the animation pages and the gallery (and that
// the choice is remembered), a model that follows a scene's control, the model page's parameters, the cutaway
// and the explosion, the fallback to 2D without WebGL2, the catalogue and the reader's «Ver en 3D» button.
// Screenshots and contact sheets: tests/modelos3d-capturas.mjs; frame cost: tests/modelos3d-rendimiento.mjs.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fuente = readFileSync(new URL('../src/componentes/tres/modelos/paquetes.ts', import.meta.url), 'utf8');
const TIPOS = [...fuente.matchAll(/^\s+tipo: '([a-z0-9-]+)',$/gm)].map((m) => m[1]!);

type Datos = { tipo: string; parametros: Record<string, unknown>; marcado?: string; triangulos: number; cortes?: unknown[] };

async function datos(page: Page, tipo = ''): Promise<Datos> {
  await page.waitForFunction(
    (t) => {
      const d = (globalThis as { __epaVisor3d?: { datos?: { tipo: string } } }).__epaVisor3d?.datos;
      return !!d && (!t || d.tipo === t);
    },
    tipo,
    { timeout: 60_000 },
  );
  return page.evaluate(() => (globalThis as unknown as { __epaVisor3d: { datos: Datos } }).__epaVisor3d.datos);
}

async function deslizar(page: Page, selector: string, valor: number): Promise<void> {
  await page.locator(selector).evaluate((el: HTMLInputElement, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, valor);
}

test('el interruptor 2D | 3D de una animación cambia la vista y se recuerda', async ({ page }) => {
  await page.goto('/#/componentes/codigo-colores');
  await expect(page.locator('.escena canvas').first()).toBeVisible();
  await page.locator('[data-vista="3d"]').click();
  await expect(page.locator('canvas[data-tipo="resistencia-axial"]')).toBeVisible();
  const d = await datos(page);
  expect(d.tipo).toBe('resistencia-axial');
  // Remembered after a reload, and on another animation and in the gallery.
  await page.reload();
  await expect(page.locator('canvas[data-tipo="resistencia-axial"]')).toBeVisible();
  await expect(page.locator('[data-vista="3d"]')).toHaveAttribute('aria-checked', 'true');
  await page.goto('/#/componentes/led');
  await expect(page.locator('canvas[data-tipo="led-5mm"]')).toBeVisible();
  await page.goto('/#/componentes');
  await expect(page.locator('.catalogo3d')).toBeVisible();
  await page.locator('[data-vista="2d"]').click();
  await expect(page.getByRole('heading', { name: 'Cómo funcionan por dentro' })).toBeVisible();
  await page.goto('/#/componentes/codigo-colores');
  await expect(page.locator('.escena canvas').first()).toBeVisible();
  await expect(page.locator('canvas[data-tipo]')).toHaveCount(0);
});

test('el modelo sigue a los mandos de la escena (color del LED, bandas de la resistencia)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('epa:componentes-vista', JSON.stringify('3d')));
  await page.goto('/#/componentes/led');
  expect((await datos(page)).parametros.color).toBe('rojo');
  await page.getByRole('radio', { name: 'Verde' }).click();
  await expect.poll(async () => (await datos(page)).parametros.color).toBe('verde');
  // Model page: the value slider changes the colour bands.
  await page.goto('/#/componentes/3d/resistencia-axial');
  const antes = (await datos(page)).marcado;
  expect(antes).toBe('amarillo, violeta, rojo, dorado');
  await page.getByRole('radio', { name: '5 (E96)' }).click();
  await expect.poll(async () => (await datos(page)).marcado).toBe('amarillo, violeta, negro, marrón, marrón');
});

test('corte con su plano desplazable y explosión con etiquetas del interior', async ({ page }) => {
  await page.goto('/#/componentes/3d/electrolitico');
  const d = await datos(page);
  expect(d.cortes?.length).toBe(2);
  await expect(page.locator('.etiqueta3d.interior:not(.oculta)')).toHaveCount(0);
  await page.locator('[data-control="corte"]').click();
  await expect(page.locator('[data-control="corte"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.etiqueta3d.interior:not(.oculta)').first()).toBeVisible();
  const pos0 = await page.evaluate(() => (globalThis as unknown as { __epaVisor3d: { visor: { posicionCorte(): number } } }).__epaVisor3d.visor.posicionCorte());
  await deslizar(page, '[data-control="plano"]', 0.9);
  const pos1 = await page.evaluate(() => (globalThis as unknown as { __epaVisor3d: { visor: { posicionCorte(): number } } }).__epaVisor3d.visor.posicionCorte());
  expect(pos1).toBeGreaterThan(pos0);
  await page.getByRole('radio', { name: 'Transversal' }).click();
  await page.locator('[data-control="corte"]').click();
  await deslizar(page, '[data-control="explosion"]', 1);
  await expect(page.locator('.etiqueta3d.interior:not(.oculta)').first()).toBeVisible();
  await expect(page.locator('.etiqueta3d', { hasText: 'Lámina de ánodo' })).toBeVisible();
});

test('sin WebGL 2 la página vuelve a la animación 2D y lo dice', async ({ page }) => {
  await page.addInitScript(() => {
    (globalThis as { __epaSinWebGL?: boolean }).__epaSinWebGL = true;
    localStorage.setItem('epa:componentes-vista', JSON.stringify('3d'));
  });
  await page.goto('/#/componentes/led');
  await expect(page.locator('.aviso3d')).toContainText('WebGL 2');
  await expect(page.locator('.escena canvas').first()).toBeVisible();
  await expect(page.locator('[data-vista="3d"]')).toBeDisabled();
  await page.goto('/#/componentes/3d/mlcc');
  await expect(page.locator('.aviso3d')).toContainText('WebGL 2');
});

test('catálogo 3D: todos los modelos con miniatura, búsqueda y página de cada uno', async ({ page }) => {
  test.setTimeout(300_000);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/#/componentes/3d');
  await expect(page.locator('.catalogo3d a.tarjeta')).toHaveCount(TIPOS.length);
  expect(TIPOS.length).toBeGreaterThanOrEqual(38);
  await expect(page.locator('.catalogo3d a.tarjeta img').first()).toBeVisible({ timeout: 60_000 });
  await page.getByPlaceholder(/Buscar: MLCC/).fill('to-220');
  await expect(page.locator('.catalogo3d a.tarjeta')).toHaveCount(1);
  // Every model builds and renders without errors and stays within a sane triangle budget.
  // Every model builds (default parameters, loose and mounted, low detail with a shared cache) within a sane
  // triangle budget, with a footprint; a sample is also rendered through its page.
  await page.goto(`/#/componentes/3d/${TIPOS[0]}`);
  await datos(page);
  const informe = await page.evaluate((tipos) => {
    type G = { userData: { triangulos: number; huella: { pads: unknown[] }; tipo: string } };
    const h = (globalThis as unknown as { __epaVisor3d: { crearModelo: (t: string, p?: object, o?: object) => G; liberarModelo: (g: G) => void } }).__epaVisor3d;
    return tipos.map((t) => {
      const r: { t: string; tri: number[]; pads: number; error?: string } = { t, tri: [], pads: 0 };
      try {
        for (const o of [{ montaje: 'suelto' }, { montaje: 'placa' }, { montaje: 'placa', detalle: 'bajo' }]) {
          const g = h.crearModelo(t, {}, o);
          r.tri.push(g.userData.triangulos);
          r.pads = g.userData.huella.pads.length;
          h.liberarModelo(g);
        }
      } catch (e) {
        r.error = String(e);
      }
      return r;
    });
  }, TIPOS);
  for (const r of informe) {
    expect(r.error, r.t).toBeUndefined();
    expect(r.tri[0]!, r.t).toBeGreaterThan(50);
    expect(r.tri[0]!, r.t).toBeLessThan(60_000);
    expect(r.tri[2]!, r.t).toBeLessThanOrEqual(r.tri[1]!);
    expect(r.pads, r.t).toBeGreaterThan(0);
  }
  for (const t of ['electrolitico', 'qfp', 'rele', 'led-5mm']) {
    await page.evaluate((x) => (location.hash = `#/componentes/3d/${x}`), t);
    expect((await datos(page, t)).tipo).toBe(t);
  }
  expect(errores).toEqual([]);
});

test('«Ver en 3D» en el libro lleva al modelo y «Volver» regresa', async ({ page }) => {
  await page.goto('/#/cap02/fig-2.3');
  const boton = page.locator('#fig-2\\.3 [data-ver3d]');
  await expect(boton).toBeVisible();
  // Figure 2.3 shows axial and SMD resistors: a menu with both models.
  await boton.click();
  await page.locator('#fig-2\\.3 .menu a', { hasText: 'Resistencia axial' }).click();
  await expect(page).toHaveURL(/#\/componentes\/3d\/resistencia-axial/);
  await datos(page);
  await page.getByRole('button', { name: /Volver a la figura 2\.3/ }).click();
  await expect(page).toHaveURL(/#\/cap02/);
});
