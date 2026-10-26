// XSPICE engine (0.8): the book's digital netlists (chapter 28 of the printed book, folder cap29) run in the
// browser with the values the book gives, their analog twins are linked both ways, the fallback engine
// (eecircuit-engine, no XSPICE) still explains why they cannot run, and the schematic editor's digital parts
// (gates, flip-flops, bridges, clock) generate a netlist that simulates.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.xspice.config.ts tests/xspice.spec.ts
import { expect, test, type Page } from '@playwright/test';

async function abrir(page: Page, id: string) {
  await page.goto(`/#/simulador/${id}`);
  await expect(page.locator('.pagina h1')).toBeVisible();
}

/** Values of the measurements table, by name, in order. */
async function medidas(page: Page): Promise<Map<string, number>> {
  await expect(page.locator('table.medidas td.n').first()).toBeVisible({ timeout: 90_000 });
  const filas = await page.locator('table.medidas tbody tr').evaluateAll((fs) =>
    fs.flatMap((f) => {
      const n = f.querySelector('td.n')?.textContent?.trim();
      const v = f.querySelector('td.v')?.getAttribute('title');
      return n && v ? [[n, Number(v)] as [string, number]] : [];
    }),
  );
  return new Map(filas);
}

/** Book values: [netlist, measurement → value, absolute tolerance]. */
const LIBRO: [string, Record<string, number>, number][] = [
  // Figure 29.4: two 6 ns glitches, 50 ns apart.
  ['cap29/fig-29.4-glitch', { ancho1: 6e-9, ancho2: 6e-9, inicio1: 22.033e-9, inicio2: 72.033e-9 }, 0.05e-9],
  // Section 29.2: an OR made of three NANDs gives 0, 5, 5, 5 V for AB = 00, 01, 10, 11.
  ['cap29/sec-29.2-or-con-nand', { 'y_0.5u': 0, 'y_1.5u': 5, 'y_2.5u': 5, 'y_3.5u': 5 }, 1e-6],
  // Section 29.7: ripple counter, bit 0 at 10 ns, bit 7 at 80 ns, a false 10 ns pulse of the decoder.
  ['cap29/sec-29.7-contador-asincrono', { r_b0: 10, r_b7: 80, b7_b0: 70, pulso_cero: 10e-9 }, 0.05],
  // Problem 29.C: true pulse 18.5 ns, three 0.5 ns glitches in counter A, one 1.5 ns glitch in counter B.
  ['cap29/prob-29.C-decodificador', { a_ancho1: 18.5e-9, a_ancho2: 0.5e-9, a_ancho3: 0.5e-9, a_ancho4: 0.5e-9, b_ancho2: 1.5e-9 }, 0.02e-9],
];

for (const [id, esperado, tol] of LIBRO) {
  test(`XSPICE en el navegador: ${id}`, async ({ page }) => {
    await abrir(page, id);
    const m = await medidas(page);
    for (const [k, v] of Object.entries(esperado)) {
      expect(m.has(k), `medida ${k}`).toBe(true);
      // Measurements in ns are compared with a tolerance in ns (the r_* ones are already in ns).
      const t = Math.abs(v) < 1e-6 ? tol : k.startsWith('r_') || k.startsWith('b7') ? tol : Math.max(tol, 1e-6);
      expect(Math.abs(m.get(k)! - v), `${k} = ${m.get(k)} (libro: ${v})`).toBeLessThanOrEqual(t);
    }
    // The page says it is a digital circuit and links to the analog equivalent.
    await expect(page.getByRole('link', { name: 'Ver la versión analógica' })).toBeVisible();
  });
}

test('el reloj, las puertas y los biestables del editor se simulan', async ({ page }) => {
  await page.goto('/#/editor');
  await expect(page.locator('.lienzo')).toBeVisible();
  await page.waitForFunction(() => !!(window as unknown as { __epaEditor?: unknown }).__epaEditor);
  // The digital group of the palette.
  for (const t of ['DAND', 'DOR', 'DNAND', 'DNOR', 'DXOR', 'DNOT', 'DFF', 'DJK', 'ADC', 'DAC', 'DCLK'])
    await expect(page.locator(`.paleta [data-tipo="${t}"]`)).toBeAttached();

  // A pulse source → ADC → NOT → DAC, and a clock driving a D flip-flop wired as a toggle (D = nQ) → DAC.
  // Every pin gets a net label (or a ground) on it, so no wires are needed.
  await page.evaluate(() => {
    type C = { id: string; tipo: string; nombre: string; x: number; y: number; o: number; campos: Record<string, string> };
    const h = (window as unknown as {
      __epaEditor: {
        ed: { cargar: (d: unknown) => void };
        pines: (c: C) => { nombre: string; x: number; y: number }[];
      };
    }).__epaEditor;
    const comps: C[] = [];
    let n = 0;
    const poner = (tipo: string, nombre: string, x: number, y: number, o: number, campos: Record<string, string>, redes: Record<string, string>) => {
      const c: C = { id: `c${++n}`, tipo, nombre, x, y, o, campos };
      comps.push(c);
      for (const p of h.pines(c)) {
        const r = redes[p.nombre];
        if (!r) continue;
        comps.push(
          r === '0'
            ? { id: `c${++n}`, tipo: 'GND', nombre: '', x: p.x, y: p.y, o: 0, campos: {} }
            : { id: `c${++n}`, tipo: 'ETQ', nombre: '', x: p.x, y: p.y, o: 0, campos: { red: r } },
        );
      }
    };
    poner('VPULSE', 'V1', 0, 0, 3, { forma: 'pulse', v1: '0', v2: '5', td: '0', tr: '1n', tf: '1n', pw: '0,5µ', per: '1µ' }, { start: '0', end: 'a' });
    poner('ADC', 'U1', 8, 0, 0, { bajo: '2,4', alto: '2,6' }, { in: 'a', out: 'ad' });
    poner('DNOT', 'U2', 16, 0, 0, { retardo: '10n' }, { a: 'ad', y: 'yd' });
    poner('DAC', 'U3', 24, 0, 0, { bajo: '0', alto: '5', flanco: '1n' }, { in: 'yd', out: 'y' });
    poner('DCLK', 'CLK1', 0, 12, 0, { freq: '1Meg', ciclo: '50' }, { out: 'ck' });
    poner('DFF', 'U4', 10, 12, 0, { retardo: '10n', ic: '0' }, { d: 'nq', clk: 'ck', q: 'q', nq: 'nq' });
    poner('DAC', 'U5', 24, 12, 0, { bajo: '0', alto: '5', flanco: '1n' }, { in: 'q', out: 'qa' });
    h.ed.cargar({
      version: 1,
      titulo: 'Prueba XSPICE',
      componentes: comps,
      cables: [],
      analisis: {
        op: false,
        tran: { activo: true, paso: '1n', fin: '6µ', inicio: '0', uic: false },
        ac: { activo: false, tipo: 'dec', puntos: '50', fini: '10', ffin: '1M' },
        dc: { activo: false, fuente: '', ini: '0', fin: '10', paso: '0,1' },
      },
      directivas: [
        '.meas tran y_bajo find v(y) at=0.3u',
        '.meas tran y_alto find v(y) at=0.7u',
        '.meas tran retardo trig v(a) val=2.5 rise=2 targ v(y) val=2.5 fall=2',
        '.meas tran periodo_q trig v(qa) val=2.5 rise=1 targ v(qa) val=2.5 rise=2',
      ].join('\n'),
    });
  });
  const nl = await page.evaluate(() => (window as unknown as { __epaEditor: { ed: { nl: { texto: string; errores: unknown[] } } } }).__epaEditor.ed.nl);
  expect(nl.errores).toEqual([]);
  expect(nl.texto).toMatch(/^AU2 ad yd au2_mod$/m);
  expect(nl.texto).toMatch(/^\.model au2_mod d_inverter\(rise_delay=10n fall_delay=10n\)$/m);
  expect(nl.texto).toMatch(/^AU4 nq ck NULL NULL q nq au4_mod$/m);
  expect(nl.texto).toMatch(/^AU1 \[a\] \[ad\] au1_mod$/m);

  await page.evaluate(() => delete (window as unknown as { __epaEditorSim?: unknown }).__epaEditorSim);
  await page.locator('button.simular').click();
  await page.waitForFunction(() => !!(window as unknown as { __epaEditorSim?: unknown }).__epaEditorSim, null, { timeout: 90_000 });
  const m = await medidas(page);
  expect(m.get('y_bajo')).toBeCloseTo(0, 6);
  expect(m.get('y_alto')).toBeCloseTo(5, 6);
  // The inverter's output falls 10 ns (its delay) after the input crosses 2.5 V, plus the bridges' edges
  // (the ADC switches at 2.6 V on a 1 ns ramp, the DAC output takes 0.5 ns to fall to 2.5 V): 10.7 ns.
  expect(Math.abs(m.get('retardo')! - 10.7e-9)).toBeLessThan(0.1e-9);
  // A toggling flip-flop halves the 1 MHz clock: Q has a 2 µs period.
  expect(Math.abs(m.get('periodo_q')! - 2e-6)).toBeLessThan(1e-9);
});

test('con el motor de reserva, las netlists digitales no se simulan y las analógicas sí', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('epa:motor-spice', 'eecircuit'));
  await abrir(page, 'cap29/sec-29.2-or-con-nand');
  await expect(page.getByText('No se puede simular en la aplicación')).toBeVisible();
  await page.getByRole('link', { name: 'Abrir la versión analógica' }).click();
  const m = await medidas(page);
  expect(m.get('y_1.5u')).toBeCloseTo(5, 3);
});
