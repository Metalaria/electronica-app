// «Kit FM7303» end to end: the simulated voltage map against the book's values, a test point's waveform with
// the book's settings, one step of the guided alignment (W3 to 38 kHz at TP4), the diagnosis of a hidden fault
// with the multimeter on the schematic, the reader's button, and screenshots (phone, 1280 × 800 at DPR 2, tablet
// portrait; light and dark) into tests/capturas/.
import { expect, test, type Page } from '@playwright/test';

async function tema(page: Page, t: 'claro' | 'oscuro'): Promise<void> {
  await page.addInitScript((x) => {
    try {
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: x, tam: 18 }));
    } catch {
      /* private mode */
    }
  }, t);
}

/** Taps a point of the schematic given in drawing units (the viewer exposes its visible window). */
async function tocarDibujo(page: Page, X: number, Y: number): Promise<void> {
  const visor = page.locator('.visor');
  const caja = await visor.boundingBox();
  const v = ((await visor.getAttribute('data-vista')) ?? '0 0 1 1').split(' ').map(Number);
  if (!caja) throw new Error('sin visor');
  await page.mouse.click(caja.x + ((X - v[0]!) / v[2]!) * caja.width, caja.y + ((Y - v[1]!) / v[3]!) * caja.height);
}

async function simulado(page: Page, punto: string): Promise<number> {
  const fila = page.locator(`[data-punto="${punto}"]`);
  await expect(fila).toHaveAttribute('data-simulado', /\d/);
  return Number(await fila.getAttribute('data-simulado'));
}

test('el mapa de tensiones simulado coincide con el del libro', async ({ page }) => {
  await page.goto('#/fm7303/esquema');
  await expect(page.locator('[data-mapa]')).toBeVisible();
  // Section 15.11.2: 12 V after K4, about 8 V at IC4, 6 V from the 78L06, 5,9 V at pin 9 of IC1, 3,3 V and 3,1 V.
  const esperado: [string, number, number][] = [
    ['entrada', 12, 0.05],
    ['ic4', 8, 0.05],
    ['78l06', 6, 0.05],
    ['ic1', 5.9, 0.05],
    ['ams', 3.3, 0.05],
    ['display', 3.1, 0.05],
    ['tp1', 4.6, 0.1],
    ['tp3', 4.6, 0.1],
    ['tea_o1', 6, 0.1],
  ];
  for (const [id, v, tol] of esperado) {
    const s = await simulado(page, id);
    expect(Math.abs(s - v), `${id}: ${s} V frente a ${v} V`).toBeLessThanOrEqual(v * tol);
  }
  // each book value carries its citation (printed section numbers)
  await expect(page.locator('[data-punto="ic1"] .cita')).toContainText('15.11.2');
  // the multimeter: the map row puts the red probe there and shows the book's value next to the reading
  await page.locator('[data-punto="ic1"] button.medir').click();
  await expect(page.locator('[data-lectura]')).toHaveAttribute('data-lectura', /^5\.9/);
  await expect(page.locator('[data-multimetro]')).toContainText('dentro de la tolerancia');
});

test('TP3 muestra la señal MPX con el piloto de 19 kHz en la FFT', async ({ page }) => {
  await page.goto('#/fm7303/senal/TP3');
  const osc = page.locator('[data-osciloscopio="TP3"]');
  await expect(osc).toBeVisible();
  await expect(osc).toContainText('4,6 V de continua con la señal MPX');
  await expect(osc).toContainText('piloto en 19 kHz');
  await expect(osc.locator('canvas').first()).toBeVisible();
  expect(await osc.locator('canvas').count()).toBeGreaterThanOrEqual(2);
  await osc.getByRole('button', { name: 'Acoplo DC' }).click();
  await expect(osc).toContainText('Media: 4,6');
});

test('alineación: W3 hasta 38 kHz en TP4 con el puente «Monitor»', async ({ page }) => {
  await page.goto('#/fm7303/alineacion');
  await page.locator('[data-paso="estereo"]').click();
  await page.getByRole('button', { name: 'Sintonizar entre emisoras (93,0 MHz)' }).click();
  await page.locator('[data-mando="monitor"]').first().click();
  await page.getByRole('tab', { name: 'TP4' }).click();
  // the kit comes out of the bag with the VCO far from 38 kHz
  const prm = page.locator('[data-prm]');
  await expect(prm).toHaveAttribute('data-prm', /\d/);
  expect(Math.abs(Number(await prm.getAttribute('data-prm')) - 38000)).toBeGreaterThan(1000);
  await page.locator('#fm-w3').fill('0.5');
  await expect(prm).toHaveAttribute('data-prm', /^380\d\d|^379\d\d/);
  await expect(page.locator('[data-estado-paso]')).toContainText('vuelva a abrir el puente');
  await page.locator('[data-mando="monitor"]').first().click();
  await expect(page.locator('[data-estado-paso]')).toHaveAttribute('data-estado-paso', 'ok');
});

test('avería: R13 abierta se localiza con el multímetro', async ({ page }) => {
  await page.goto('#/fm7303/averias');
  await page.locator('[data-averia="r13"]').click();
  await expect(page.locator('.sintoma')).toContainText('no se oye nada');
  // the radio still tunes: the display shows the station
  await expect(page.locator('[data-display]')).toHaveAttribute('data-display', /^98\./);
  // zoom to the supply block and measure the 8 V rail below R13
  await page.getByRole('button', { name: /^Bloque 6/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Punta roja/ }).click();
  await tocarDibujo(page, 1560, 640);
  const lectura = page.locator('[data-lectura]');
  await expect(lectura).toHaveAttribute('data-lectura', /\d/);
  expect(Number(await lectura.getAttribute('data-lectura'))).toBeLessThan(0.5);
  await expect(page.locator('[data-multimetro]')).toContainText('fuera de la tolerancia');
  // a wrong guess, then the right part
  await page.locator('[data-senalar]').click();
  await tocarDibujo(page, 1600, 666);
  await expect(page.locator('.intento')).toContainText('No es C33');
  await page.locator('[data-senalar]').click();
  await tocarDibujo(page, 1560, 610);
  await expect(page.locator('[data-resuelta="si"]')).toContainText('R13 abierta');
});

test('el lector enlaza el kit desde el esquema del capítulo', async ({ page }) => {
  await page.goto('#/cap16/fig-16.25');
  const boton = page.locator('#fig-16\\.25 a.ver-kit');
  await expect(boton).toBeVisible();
  await boton.click();
  await expect(page).toHaveURL(/#\/fm7303\/esquema$/);
  await expect(page.locator('[data-kit-fm7303]')).toBeVisible();
});

/** Where the drawing sits inside the viewer: free px above, below, left and right of the drawn sheet. */
async function encuadre(page: Page): Promise<{ arriba: number; abajo: number; izq: number; der: number; alto: number; ancho: number }> {
  return page.evaluate(() => {
    const v = document.querySelector('[data-kit-fm7303] .visor')!;
    const r = v.getBoundingClientRect();
    const g = v.querySelector('svg.dibujo > g')!.getBoundingClientRect();
    return { arriba: g.top - r.top, abajo: r.bottom - g.bottom, izq: g.left - r.left, der: r.right - g.right, alto: r.height, ancho: r.width };
  });
}

/** Waits until the drawing is vertically centred in the viewer (within 3 % of its height); with `ambos`, also
 *  horizontally. */
async function centrado(page: Page, que: string, ambos = false): Promise<void> {
  await expect
    .poll(async () => {
      const e = await encuadre(page);
      const v = Math.abs(e.arriba - e.abajo) / e.alto;
      const h = ambos ? Math.abs(e.izq - e.der) / e.ancho : 0;
      return v < 0.03 && h < 0.03 ? 'centrado' : `${que}: arriba ${e.arriba.toFixed(0)} abajo ${e.abajo.toFixed(0)} izq ${e.izq.toFixed(0)} der ${e.der.toFixed(0)}`;
    }, { timeout: 10_000 })
    .toBe('centrado');
}

const ENCUADRES = [
  { nombre: 'móvil', w: 390, h: 844, tactil: true },
  { nombre: 'portátil', w: 1280, h: 800, tactil: false },
  { nombre: 'tableta vertical', w: 800, h: 1280, tactil: true },
  { nombre: 'tableta horizontal', w: 1280, h: 800, tactil: true },
];

for (const t of ENCUADRES) {
  test(`el esquema queda centrado en vertical en cada pestaña (${t.nombre})`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: 1, hasTouch: t.tactil });
    const page = await ctx.newPage();
    await tema(page, 'claro');
    const pestanas = ['esquema', 'senal', 'alineacion', 'averias'];
    for (const p of pestanas) {
      await page.goto(`#/fm7303/${p}`);
      await page.waitForSelector('[data-kit-fm7303] .visor');
      await centrado(page, `al abrir ${p}`);
    }
    // Switching tabs, also after a stage of the signal path was brought into view.
    await page.goto('#/fm7303/senal/mpx');
    await centrado(page, 'etapa mpx');
    for (const p of [...pestanas].reverse()) {
      await page.click(`[data-pestana="${p}"]`);
      await centrado(page, `pestaña ${p}`);
    }
    // «Ver todo» centres the drawing both ways.
    await page.click('button[aria-label="Ver todo el esquema"]');
    await centrado(page, 'ver todo', true);
    // Pan and zoom still work, and the view stays inside its limits.
    await page.click('button[aria-label="Acercar"]');
    await page.click('button[aria-label="Acercar"]');
    const antes = await page.locator('.visor').getAttribute('data-vista');
    const caja = (await page.locator('.visor').boundingBox())!;
    await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
    await page.mouse.down();
    await page.mouse.move(caja.x + caja.width / 2 - 80, caja.y + caja.height / 2 - 60, { steps: 6 });
    await page.mouse.up();
    expect(await page.locator('.visor').getAttribute('data-vista')).not.toBe(antes);
    await page.click('button[aria-label="Ver todo el esquema"]');
    await centrado(page, 'ver todo tras desplazar', true);
    // Rotation / resize: the automatic view is redone for the new box.
    await page.setViewportSize({ width: t.h, height: t.w });
    await centrado(page, 'tras girar', true);
    await page.click('[data-pestana="alineacion"]');
    await centrado(page, 'alineación tras girar');
    await page.setViewportSize({ width: t.w, height: t.h });
    await centrado(page, 'tras volver a girar');
    await ctx.close();
  });
}

const TAMANOS = [
  { nombre: 'movil', w: 390, h: 844, dpr: 3, tactil: true },
  { nombre: 'portatil', w: 1280, h: 800, dpr: 2, tactil: false },
  { nombre: 'tableta-vertical', w: 800, h: 1280, dpr: 2, tactil: true },
];

for (const t of TAMANOS) {
  for (const modo of ['claro', 'oscuro'] as const) {
    test(`capturas ${t.nombre} ${modo}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: t.dpr, hasTouch: t.tactil });
      const page = await ctx.newPage();
      await tema(page, modo);
      const vistas: [string, string][] = [
        ['esquema', '#/fm7303/esquema'],
        ['bloque', '#/fm7303/esquema/b2'],
        ['senal', '#/fm7303/senal/mpx'],
        ['alineacion', '#/fm7303/alineacion'],
        ['averias', '#/fm7303/averias'],
      ];
      for (const [nombre, ruta] of vistas) {
        await page.goto(ruta);
        await page.waitForSelector('[data-kit-fm7303] .visor');
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `tests/capturas/fm7303-${t.nombre}-${modo}-${nombre}.png` });
      }
      await ctx.close();
    });
  }
}
