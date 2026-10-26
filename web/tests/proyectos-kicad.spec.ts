// «Proyectos KiCad» end to end: the data of the seven boards (checks without errors), the start page, a pad
// tapped in the 2D view selects it in every view, a schematic pin selects the same pad, the 3D view builds the
// board with a few draw calls and its modes, the 2D fallback without WebGL, the simulator links and the DC
// voltages, the checks page and the reader's «Ver la placa» buttons.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.proyectos.config.ts
import { expect, test, type Page } from '@playwright/test';

const PLACAS = ['estacion_iot', 'fuente_laboratorio', 'hifi-potencia', 'hifi-preamplificador', 'hifi-fuente', 'hifi-proteccion', 'sdr'];

interface Vista2D {
  k: number;
  ox: number;
  oy: number;
  lado: 'F' | 'B';
  ancho: number;
}

async function datos(page: Page, id: string): Promise<{ huellas: { r: string; pads: [number, number] }[]; pads: (string | number)[][]; redes: { n: string }[] }> {
  return page.evaluate(async (x) => (await fetch(`proyectos/${x}.json`)).json(), id);
}

test('los datos de las siete placas están completos y sin errores', async ({ page }) => {
  await page.goto('#/');
  const indice = await page.evaluate(async () => (await fetch('proyectos/indice.json')).json());
  const ids = indice.proyectos.flatMap((p: { placas: { id: string }[] }) => p.placas.map((x) => x.id));
  expect(ids.sort()).toEqual([...PLACAS].sort());
  for (const id of PLACAS) {
    const d = await page.evaluate(async (x) => (await fetch(`proyectos/${x}.json`)).json(), id);
    expect(d.comprobaciones.filter((c: { tipo: string }) => c.tipo === 'error')).toEqual([]);
    expect(d.comprobaciones.map((c: { texto: string }) => c.texto).join('\n')).toContain('coinciden con las redes del esquema');
    expect(d.huellas.length).toBeGreaterThan(40);
    expect(d.pads.length).toBeGreaterThan(100);
  }
});

test('la portada presenta los cuatro proyectos y el carril tiene su entrada', async ({ page }) => {
  await page.goto('#/proyectos');
  await expect(page.locator('.portada article')).toHaveCount(4);
  await expect(page.locator('.portada article li a')).toHaveCount(7);
  await expect(page.getByRole('link', { name: /Proyectos/ }).first()).toBeVisible();
});

test('un pad tocado en 2D se selecciona en todas las vistas', async ({ page }) => {
  await page.goto('#/proyectos/estacion_iot/placa');
  const lienzo = page.locator('.placa2d canvas');
  await expect(lienzo).toBeVisible();
  await page.waitForFunction(() => !!(globalThis as unknown as { __epaPlacaVista?: unknown }).__epaPlacaVista);
  await page.waitForTimeout(300);
  const d = await datos(page, 'estacion_iot');
  const h = d.huellas.find((x) => x.r === 'R7')!;
  const pad = d.pads[h.pads[0]]!;
  const v = (await page.evaluate(() => (globalThis as unknown as { __epaPlacaVista: unknown }).__epaPlacaVista)) as Vista2D;
  const caja = (await lienzo.boundingBox())!;
  await page.mouse.click(caja.x + v.ox + (pad[3] as number) * v.k, caja.y + v.oy + (pad[4] as number) * v.k);
  const ficha = page.locator('.lado .ficha');
  await expect(ficha.locator('.ref')).toContainText('R7');
  await expect(ficha).toContainText('antialiasing');
  await expect(page).toHaveURL(/placa\/pad%3AR7\.\d$/);
  // the same pad in the schematic, then its net
  await ficha.getByRole('button', { name: 'Ver en el esquema' }).click();
  await expect(page).toHaveURL(/esquema\/pad%3AR7\.\d$/);
  await expect(page.locator('.lado .ficha .ref')).toContainText('R7');
  await page.locator('.lado .ficha button.red').click();
  await expect(page.locator('.lado .ficha .ref')).toHaveText(/MIC_ADC|MIC_OUT/);
  // flip to the bottom side: the board view says so
  await page.goto('#/proyectos/estacion_iot/placa');
  await page.getByRole('button', { name: 'Cara inferior' }).click();
  await expect(lienzo).toHaveAttribute('data-lado', 'B');
});

test('un pin del esquema selecciona el pad de la placa', async ({ page }) => {
  await page.goto('#/proyectos/hifi-potencia/esquema');
  await page.waitForFunction(() => !!(globalThis as unknown as { __epaEsquemaVista?: unknown }).__epaEsquemaVista);
  await page.waitForTimeout(400);
  const capa = await page.evaluate(async () => (await fetch('proyectos/hifi-potencia/hoja-0.json')).json());
  const pin = capa.pines.find((p: (string | number)[]) => p[1] === 'Q9' && p[2] === '2');
  // frame the symbol by selecting it first, then tap its pin
  await page.goto('#/proyectos/hifi-potencia/esquema/Q9');
  await page.waitForTimeout(600);
  const v = (await page.evaluate(() => (globalThis as unknown as { __epaEsquemaVista: unknown }).__epaEsquemaVista)) as { k: number; ox: number; oy: number };
  const caja = (await page.locator('.esquema canvas').boundingBox())!;
  const x = (pin[4] + pin[6]) / 2;
  const y = (pin[5] + pin[7]) / 2;
  await page.mouse.click(caja.x + v.ox + x * v.k, caja.y + v.oy + y * v.k);
  await expect(page).toHaveURL(/esquema\/pad%3AQ9\.2$/);
  await expect(page.locator('.lado .ficha')).toContainText('multiplicador de VBE');
});

test('la vista 3D monta la placa con pocas llamadas de dibujo y sus modos', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('#/proyectos/sdr/3d/U1');
  await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo === true, null, { timeout: 90_000 });
  const st = await page.evaluate(() => (globalThis as unknown as { __epaPlaca3D: { llamadas: number; triangulos: number; piezas: { biblioteca: number; propias: number } } }).__epaPlaca3D);
  expect(st.llamadas).toBeLessThan(150);
  expect(st.piezas.biblioteca + st.piezas.propias).toBeGreaterThan(120);
  await expect(page.locator('.v3d .etiqueta')).toContainText('U1');
  await expect(page.locator('.lado .ficha')).toContainText('Tayloe');
  for (const b of ['Arriba', 'Abajo', 'Canto', 'Rayos X']) {
    const boton = page.getByRole('button', { name: b, exact: true });
    await boton.click();
    await expect(boton).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(page.locator('.v3d .nota')).toContainText('Rayos X');
  await page.locator('.explosion input').fill('1');
  expect(errores).toEqual([]);
});

test('sin WebGL la vista 3D cae a la placa en 2D', async ({ page }) => {
  await page.addInitScript(() => ((globalThis as unknown as { __epaSinWebGL: boolean }).__epaSinWebGL = true));
  await page.goto('#/proyectos/fuente_laboratorio/3d');
  await expect(page.getByText('no ofrece WebGL 2')).toBeVisible();
  await expect(page.locator('.placa2d canvas')).toBeVisible();
});

test('la simulación enlaza las netlists del capítulo y da las tensiones de la placa', async ({ page }) => {
  await page.goto('#/proyectos/hifi-potencia/simulacion');
  const enlaces = page.locator('.netlists a');
  await expect(enlaces).toHaveCount(4);
  await expect(enlaces.first()).toHaveAttribute('href', /#\/simulador\/cap51\//);
  const fila = page.locator('tr', { has: page.getByRole('button', { name: 'NA', exact: true }) });
  await expect(fila.locator('td.v')).toHaveText(/^1,16\d?\s?V$/);
  await page.getByRole('button', { name: 'NA', exact: true }).click();
  await expect(page).toHaveURL(/placa\/red%3ANA$/);
  await expect(page.getByRole('button', { name: 'Tensiones' })).toHaveAttribute('aria-pressed', 'true');
  // a board without a reliable mapping says so
  await page.goto('#/proyectos/sdr/simulacion');
  await expect(page.getByText('emparejarlas no sería fiable')).toBeVisible();
});

test('las comprobaciones cruzan la placa con el libro impreso', async ({ page }) => {
  // Book 3.0.2 fixed every errata these checks had found (silkscreen chapter numbers, SH1, the 48.23 caption),
  // so the boards now pass them all and the «posibles erratas» list is gone.
  await page.goto('#/proyectos/sdr/comprobaciones');
  await expect(page.locator('.comp')).toContainText('coinciden con las redes del esquema');
  await expect(page.locator('.comp li.aviso, .comp li.error')).toHaveCount(0);
  await expect(page.getByText('Posibles erratas para la próxima edición')).toHaveCount(0);
  await page.goto('#/proyectos/estacion_iot/comprobaciones');
  await expect(page.locator('.comp')).toContainText('El pie de la figura 48.23 («el ESP32-DevKitC a la derecha») coincide con la placa');
});

test('el libro ofrece «Ver la placa» junto a las figuras de los proyectos', async ({ page }) => {
  await page.goto('#/cap49/fig-new-49-placa');
  await expect(page.locator('a.ver-placa[href="#/proyectos/estacion_iot/3d"]').first()).toBeVisible();
  await page.goto('#/cap52/fig-new-52-placa');
  await expect(page.locator('a.ver-placa[href="#/proyectos/sdr/3d"]').first()).toBeVisible();
});
