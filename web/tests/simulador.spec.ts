// Simulator end to end: book netlists of every analysis type run in the browser (WebAssembly ngspice in a
// worker), their plots are drawn, and the measurements match the numbers the netlist headers (the book) give.
// Screenshots at phone and desktop size go to tests/capturas/.
import { expect, test, type Page } from '@playwright/test';

interface Esperado {
  id: string;
  tipo: string;
  /** measurement name → value stated by the header (or the book), relative tolerance */
  medidas: [string, number, number?][];
  /** at least one plot is drawn */
  grafica?: boolean;
  /** an operating-point table is shown */
  op?: boolean;
}

const CASOS: Esperado[] = [
  { id: 'cap42/fig-42.5_filtro_rc', tipo: '.ac + .meas', grafica: true,
    medidas: [['fc', 1591.5], ['fase_fc_grados', -45], ['g100k', -36.0], ['g500k', -49.9]] },
  { id: 'cap24/fig-0.10', tipo: '.ac (control)', grafica: true,
    medidas: [['zmag', 1880], ['iang', 57.9], ['vr', 0.532], ['vc', 0.847], ['f3db', 1592]] },
  { id: 'cap42/fig-42.12_barrido_rc', tipo: '.ac con foreach/alter', grafica: true,
    medidas: [['fc', 15.9e3], ['fc', 7.23e3], ['fc', 3.39e3], ['fc', 1.59e3], ['fc', 723]] },
  { id: 'cap05/fig-5.13_prob-5.A_zener', tipo: '.op con alter', op: true,
    medidas: [['iz_hi', 78.3e-3], ['pz_hi', 0.44, 0.01], ['prs_hi', 0.74, 0.01], ['iz53', 5.6e-3, 0.02], ['pr53', 0.176], ['iz58', 11.4e-3], ['pr58', 0.216]] },
  { id: 'cap23/mallas_23.4', tipo: '.op', op: true,
    medidas: [['i1', 1.8], ['i2', 1.2], ['icomp', 0.6], ['pfuente', 21.6]] },
  { id: 'cap02/fig-2.13_potenciometro_cargado', tipo: '.dc', grafica: true,
    medidas: [['sal_50', 0.4], ['desv_max', 12.2, 0.01]] },
  { id: 'cap01/fig-1.11', tipo: '.op + .dc', grafica: true,
    medidas: [['i45', 0.18], ['rint', 5], ['pmax', 4.05], ['v5', 4.5], ['v500', 8.91]] },
  { id: 'cap01/ejemplo_1.1.4', tipo: '.tran + .meas', grafica: true,
    medidas: [['imed', 54.5e-3], ['pmed', 0.655], ['energia', 1178], ['wh', 0.327]] },
  { id: 'cap22/fig-22.14_555_astable', tipo: '.tran (555)', grafica: true,
    medidas: [['thigh', 39.5e-3], ['tlow', 32.6e-3], ['tper', 72.1e-3, 0.01], ['frec', 13.9], ['ciclo', 55, 0.01]] },
  { id: 'cap30/rc_digital_1ms', tipo: '.tran + .ac', grafica: true,
    medidas: [['v_rc', 0.632], ['v_rc3', 0.950], ['fc', 159.2]] },
  { id: 'cap32/ruido_ejemplo_32.3', tipo: '.noise', grafica: true,
    medidas: [['ein', 6.53]] },
];

async function abrir(page: Page, id: string) {
  await page.goto(`/#/simulador/${id}`);
  await expect(page.locator('.pagina h1')).toBeVisible();
}

/** Values of the measurements table, by name, in order. */
async function medidas(page: Page): Promise<[string, number][]> {
  await expect(page.locator('table.medidas td.n').first()).toBeVisible();
  return page.locator('table.medidas tbody tr').evaluateAll((filas) =>
    filas.flatMap((f) => {
      const n = f.querySelector('td.n')?.textContent?.trim();
      const v = f.querySelector('td.v')?.getAttribute('title');
      return n && v ? [[n, Number(v)] as [string, number]] : [];
    }),
  );
}

/** Coloured pixels drawn in the first plot (the curves are not the background/grid greys). */
async function pixelesDeCurva(page: Page): Promise<number> {
  return page.locator('.resultados .zona canvas').first().evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const [r, g, b, a] = [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!];
      if (a > 200 && Math.max(r, g, b) - Math.min(r, g, b) > 60) n++;
    }
    return n;
  });
}

for (const c of CASOS) {
  test(`${c.tipo}: ${c.id}`, async ({ page }) => {
    await abrir(page, c.id);
    await expect(page.locator('.estado')).toContainText('Simulado en', { timeout: 90_000 });
    const m = await medidas(page);
    const usadas = new Set<number>();
    for (const [nombre, valor, tol = 0.006] of c.medidas) {
      // The k-th expectation with a name matches the k-th measurement with that name.
      const k = m.findIndex(([n], i) => n === nombre && !usadas.has(i));
      expect(k, `medida ${nombre}`).toBeGreaterThanOrEqual(0);
      usadas.add(k);
      const v = Math.abs(m[k]![1]);
      expect(Math.abs(v - Math.abs(valor)) / Math.abs(valor), `${nombre} = ${m[k]![1]} (libro: ${valor})`).toBeLessThan(tol);
    }
    if (c.grafica) expect(await pixelesDeCurva(page)).toBeGreaterThan(200);
    if (c.op) await expect(page.getByRole('heading', { name: /Punto de trabajo|un solo punto/ })).toBeVisible();
  });
}

test('un control deslizante cambia el circuito y vuelve a simular', async ({ page }) => {
  await abrir(page, 'cap42/fig-42.5_filtro_rc');
  await expect(page.locator('.estado')).toContainText('Simulado en');
  const campo = page.getByLabel('Valor de R1');
  await campo.fill('2k');
  await campo.press('Enter');
  await expect(page.locator('textarea')).toHaveValue(/R1 in out 2k/);
  // fc = 1/(2π · 2 kΩ · 100 nF) = 795,8 Hz
  await expect
    .poll(async () => {
      const fc = (await medidas(page)).find(([n]) => n === 'fc')?.[1] ?? 0;
      return Math.abs(fc - 795.8) / 795.8;
    }, { timeout: 30_000 })
    .toBeLessThan(0.003);
  // Pin the result as a reference, move the slider: the reference stays as a faint trace.
  await page.getByRole('button', { name: 'Fijar referencia' }).click();
  await page.getByLabel('Valor de R1').fill('4,7k');
  await page.getByLabel('Valor de R1').press('Enter');
  await expect(page.locator('textarea')).toHaveValue(/R1 in out 4\.7k/);
  await expect(page.getByText('La referencia fijada')).toBeVisible();
});

test('una netlist con XSPICE explica que no se puede simular', async ({ page }) => {
  await abrir(page, 'cap29/fig-29.4-glitch');
  await expect(page.getByText('No se puede simular en la aplicación')).toBeVisible();
});

test('los errores de ngspice se explican en español', async ({ page }) => {
  await abrir(page, 'cap42/fig-42.6_error4_modelo_no_encontrado');
  await expect(page.getByRole('alert').filter({ hasText: 'ngspice ha dado errores' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('alert')).toContainText('Falta el .model');
  await expect(page.getByRole('alert')).toContainText('could not find a valid modelname');
});

test('nuevo circuito: ejemplo, simulación y gráfica interactiva', async ({ page }) => {
  await page.goto('/#/simulador/nuevo');
  await page.getByRole('button', { name: 'Insertar un ejemplo' }).click();
  await page.getByRole('button', { name: 'Simular' }).first().click();
  await expect(page.locator('.estado')).toContainText('Simulado en');
  await page.getByRole('tab', { name: /Transitorio/ }).click();
  const zona = page.locator('.resultados .zona').first();
  const caja = (await zona.boundingBox())!;
  await page.mouse.move(caja.x + caja.width * 0.5, caja.y + caja.height * 0.5);
  await expect(page.locator('.lectura')).toContainText('ms');
  await page.getByRole('button', { name: 'Cursores' }).first().click();
  await expect(page.locator('table.cursores')).toContainText('1/Δ');
  // Box zoom, then double click resets.
  await page.mouse.move(caja.x + caja.width * 0.2, caja.y + caja.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(caja.x + caja.width * 0.5, caja.y + caja.height * 0.6, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Restablecer' }).first()).toBeVisible();
  await zona.dblclick();
  await expect(page.getByRole('button', { name: 'Restablecer' })).toHaveCount(0);
});

test('el lector enlaza cada figura con su netlist', async ({ page }) => {
  await page.goto('/#/cap42/fig-42.5');
  const figura = page.locator('#fig-42\\.5');
  await expect(figura.getByRole('link', { name: 'Simular' })).toBeVisible({ timeout: 30_000 });
  await figura.getByRole('link', { name: 'Simular' }).click();
  await expect(page).toHaveURL(/#\/simulador\/cap42\/fig-42\.5_filtro_rc/);
  await expect(page.locator('.pagina h1')).toContainText('Figura 41.5');
  await page.goBack();
  await expect(page.locator('#fig-42\\.5')).toBeInViewport();
});

// ------------------------------------------------------------------ screenshots

const CAPTURAS: [string, string][] = [
  ['indice', ''],
  ['filtro-rc', 'cap42/fig-42.5_filtro_rc'],
  ['zener', 'cap05/fig-5.13_prob-5.A_zener'],
  ['astable-555', 'cap22/fig-22.14_555_astable'],
  ['barrido-rc', 'cap42/fig-42.12_barrido_rc'],
];

for (const [tam, ancho, alto, movil] of [
  ['movil', 390, 844, true],
  ['escritorio', 1366, 900, false],
] as const) {
  for (const tema of ['claro', 'oscuro'] as const) {
    test(`capturas ${tam} ${tema}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: ancho, height: alto },
        deviceScaleFactor: movil ? 2 : 1,
        isMobile: movil,
        hasTouch: movil,
      });
      await ctx.addInitScript((t) => localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 })), tema);
      const page = await ctx.newPage();
      for (const [nombre, id] of CAPTURAS) {
        await page.goto(id ? `/#/simulador/${id}` : '/#/simulador');
        if (id) await expect(page.locator('.estado')).toContainText('Simulado en', { timeout: 90_000 });
        else await expect(page.locator('.indice-sim .capitulo').first()).toBeVisible();
        await page.waitForTimeout(700);
        await page.screenshot({ path: `tests/capturas/${tam}-${tema}-${nombre}.png`, fullPage: true });
      }
      await ctx.close();
    });
  }
}
