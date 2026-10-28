// Schematic editor, 0.10 part 3 (componentes/editor/): the new palette parts against hand calculations (LDR,
// NTC, PTC, lamp, motor, buzzer, loudspeaker, relay, transformer with and without centre tap, bridge, crystal,
// switches and push buttons), the book's transformer and bridge netlists opened as the new parts with the same
// measurements as their text, switches toggled and knobs moved while simulating, the parameter sweep, align /
// distribute / «Ordenar el esquema» / automatic routing, text notes (saved, exported), each rule of the
// electrical check and the convergence help, the new parts on the breadboard (toggled there) and its tab bar on
// a 412 px phone, touch at 412 and 800 px, and the screenshots of tests/capturas/editor10/.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.editor10.config.ts tests/editor10.spec.ts
import fs from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';

type P = [number, number];
const CAPTURAS = 'tests/capturas/editor10';

/** A part to build: kind, designator, fields, and the net of each pin (labels or grounds put on the pins). */
type Parte = [string, string, Record<string, string>, Record<string, string>];

interface Ventana {
  __epaEditor: {
    ed: {
      doc: { componentes: Comp[]; cables: { id: string; p: number[] }[]; analisis: Record<string, unknown>; directivas: string; barrido?: unknown };
      sel: string[];
      nl: { texto: string; errores: { texto: string }[]; avisos: { texto: string }[] };
      colocar: (tipo: string, x: number, y: number) => Comp;
      cambiar: (fn: () => void) => void;
      nuevoId: (p: string) => string;
      componente: (id: string) => Comp | undefined;
    };
    pantalla: (x: number, y: number) => P;
    pines: (c: Comp) => { nombre: string; x: number; y: number }[];
    centroDe: (n: string) => P | null;
  };
  __epaEditorSim?: { ejecucion: { graficas: { id: string; analisis: string; vectores: { nombre: string; re: Float64Array; im?: Float64Array }[] }[] }; salida: { errores: string[] } };
}
interface Comp {
  id: string;
  tipo: string;
  nombre: string;
  x: number;
  y: number;
  o: number;
  campos: Record<string, string>;
}

async function abrirEditor(page: Page, hash = '#/editor') {
  await page.goto(`/${hash}`);
  await expect(page.locator('.lienzo')).toBeVisible();
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaEditor);
}

/** Builds a circuit from parts placed side by side; each pin gets a net label (or a ground) on it. */
async function montar(page: Page, partes: Parte[], analisis?: Record<string, unknown>) {
  await page.evaluate(
    ([ps, an]) => {
      const g = (window as unknown as Ventana).__epaEditor;
      const ed = g.ed;
      let x = 2;
      for (const [tipo, nombre, campos, redes] of ps) {
        const c = ed.colocar(tipo, x, 4);
        x += 7;
        const comp = ed.componente(c.id)!;
        ed.cambiar(() => {
          comp.nombre = nombre;
          Object.assign(comp.campos, campos);
        });
        for (const p of g.pines(comp)) {
          const r = redes[p.nombre];
          if (r == null) continue;
          ed.cambiar(() =>
            ed.doc.componentes.push(r === '0' ? { id: ed.nuevoId('c'), tipo: 'GND', nombre: '', x: p.x, y: p.y, o: 0, campos: {} } : { id: ed.nuevoId('c'), tipo: 'ETQ', nombre: '', x: p.x, y: p.y, o: 0, campos: { red: r } }),
          );
        }
      }
      if (an) ed.cambiar(() => Object.assign(ed.doc.analisis, JSON.parse(JSON.stringify(an))));
      ed.sel = [];
    },
    [partes, analisis ?? null] as [Parte[], Record<string, unknown> | null],
  );
}

async function netlist(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as Ventana).__epaEditor.ed.nl.texto);
}

async function simular(page: Page, forzar = false) {
  await page.evaluate(() => delete (window as unknown as Ventana).__epaEditorSim);
  await page.locator('button.simular').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.locator('button.simular').click();
  if (forzar) await page.locator('.erc button', { hasText: 'Simular de todos modos' }).click();
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaEditorSim, null, { timeout: 90_000 });
}

/** Value of a vector in the first plot of an analysis (index 0, or the max/min of the whole run). */
async function vector(page: Page, analisis: RegExp, nombre: string): Promise<number[]> {
  return page.evaluate(
    ([a, n]) => {
      const r = (window as unknown as Ventana).__epaEditorSim!;
      const g = r.ejecucion.graficas.find((x) => new RegExp(a, 'i').test(x.analisis));
      const v = g?.vectores.find((x) => x.nombre.toLowerCase() === n.toLowerCase());
      if (!v) return [];
      return Array.from(v.re).map((re, i) => (v.im ? Math.hypot(re, v.im[i]!) : re));
    },
    [analisis.source, nombre] as [string, string],
  );
}
async function op(page: Page, nombre: string): Promise<number> {
  const v = await vector(page, /operating/, nombre);
  expect(v.length, nombre).toBeGreaterThan(0);
  return v[0]!;
}
const cerca = (a: number, b: number, rel = 1e-3) => expect(Math.abs(a - b), `${a} ≈ ${b}`).toBeLessThanOrEqual(Math.abs(b) * rel + 1e-12);

/** Measurements table (name → value). */
async function medidas(page: Page): Promise<[string, number][]> {
  await expect(page.locator('table.medidas td.n').first()).toBeVisible({ timeout: 90_000 });
  return page.locator('table.medidas tbody tr').evaluateAll((filas) =>
    filas.flatMap((f) => {
      const n = f.querySelector('td.n')?.textContent?.trim();
      const v = f.querySelector('td.v')?.getAttribute('title');
      return n && v ? [[n, Number(v)] as [string, number]] : [];
    }),
  );
}

const V = (nombre: string, v: string, mas: string, menos = '0'): Parte => ['V', nombre, { forma: 'dc', dc: v }, { end: mas, start: menos }];

test.beforeEach(async ({ page }) => {
  await page.goto('/#/');
  await page.evaluate(() => {
    localStorage.removeItem('epa:editor-borrador');
    localStorage.removeItem('epa:editor-circuitos');
  });
});

// ------------------------------------------------------------------ new parts against hand calculations

test('sensores: LDR con dos luces, NTC y PTC con dos temperaturas, como las fórmulas', async ({ page }) => {
  await abrirEditor(page);
  await montar(page, [V('V1', '5', 'vcc'), ['R', 'R1', { valor: '10k' }, { start: 'vcc', end: 'out' }], ['LDR', 'LDR1', { luz: '100' }, { start: 'out', end: '0' }], ['R', 'R2', { valor: '10k' }, { start: 'vcc', end: 't' }], ['NTC', 'RT1', { temp: '25' }, { start: 't', end: '0' }], ['R', 'R3', { valor: '100' }, { start: 'vcc', end: 'p' }], ['PTC', 'RT2', { temp: '25' }, { start: 'p', end: '0' }]]);
  await simular(page);
  // LDR: 20 kΩ · (100/10)^−0,7 = 3,9905 kΩ → 5 · 3,9905 / 13,9905 = 1,4262 V. NTC at 25 °C: 10 kΩ → 2,5 V.
  const rl = 20e3 * Math.pow(10, -0.7);
  cerca(await op(page, 'v(out)'), (5 * rl) / (10e3 + rl));
  cerca(await op(page, 'v(t)'), 2.5);
  cerca(await op(page, 'v(p)'), 2.5);
  // 10 lx: 20 kΩ → 3,333 V; 50 °C: 10 kΩ · e^(3950·(1/323,15 − 1/298,15)) = 3,588 kΩ; PTC at Tref = 80 °C ≈ 2·R25.
  await page.evaluate(() => {
    const ed = (window as unknown as Ventana).__epaEditor.ed;
    ed.cambiar(() => {
      ed.doc.componentes.find((c) => c.nombre === 'LDR1')!.campos['luz'] = '10';
      ed.doc.componentes.find((c) => c.nombre === 'RT1')!.campos['temp'] = '50';
      ed.doc.componentes.find((c) => c.nombre === 'RT2')!.campos['temp'] = '80';
    });
  });
  await simular(page);
  cerca(await op(page, 'v(out)'), 5 * (20 / 30));
  const rn = 10e3 * Math.exp(3950 * (1 / 323.15 - 1 / 298.15));
  cerca(await op(page, 'v(t)'), (5 * rn) / (10e3 + rn));
  const rp = (100 * 2) / (1 + Math.exp(0.2 * (25 - 80)));
  cerca(await op(page, 'v(p)'), (5 * rp) / (100 + rp));
});

test('cargas: bombilla, motor, zumbador y altavoz con sus corrientes calculadas a mano', async ({ page }) => {
  await abrirEditor(page);
  await montar(page, [V('V1', '6', 'a'), ['LAMP', 'H1', {}, { start: 'a', end: '0' }], V('V2', '6', 'm'), ['MOTOR', 'M1', {}, { start: 'm', end: '0' }], V('V3', '5', 'z'), ['ZUMB', 'BZ1', {}, { start: 'z', end: '0' }], V('V4', '1', 'l'), ['ALTAVOZ', 'LS1', {}, { start: 'l', end: '0' }]]);
  expect(await netlist(page)).toMatch(/^XH1 a 0 epa_lampara params: vn=12 p=5$/m);
  await simular(page);
  // Lamp 12 V 5 W at 6 V: R = 2,88 + 25,92·√0,5 = 21,21 Ω → 0,2829 A.
  cerca(-(await op(page, 'i(v1)')), 6 / (2.88 + 25.92 * Math.sqrt(0.5)), 1e-4);
  // Motor: i = V / (Ra + k²/b) = 6 / (2 + 100) = 58,82 mA at no load.
  cerca(-(await op(page, 'i(v2)')), 6 / 102, 1e-4);
  // Active buzzer 5 V 25 mA: 25 mA (+ 5 nA of its 1 GΩ).
  cerca(-(await op(page, 'i(v3)')), 0.025, 1e-4);
  // Loudspeaker 8 Ω: in DC its voice-coil resistance 0,8·8 = 6,4 Ω.
  cerca(-(await op(page, 'i(v4)')), 1 / 6.4, 1e-4);
});

test('relé: la bobina con 12 V cierra el contacto NA y con 3 V queda en el NC', async ({ page }) => {
  await abrirEditor(page);
  await montar(page, [V('V1', '12', 'b1'), ['RELE', 'K1', {}, { b1: 'b1', b2: '0', com: 'c', nc: 'nc', no: 'no' }], V('V2', '5', 'c'), ['R', 'R1', { valor: '100' }, { start: 'no', end: '0' }], ['R', 'R2', { valor: '100' }, { start: 'nc', end: '0' }]]);
  await simular(page);
  // Contact 50 mΩ: 5 · 100 / 100,05 on NA; the coil takes 12 V / 400 Ω = 30 mA.
  cerca(await op(page, 'v(no)'), (5 * 100) / 100.05, 1e-4);
  expect(Math.abs(await op(page, 'v(nc)'))).toBeLessThan(1e-3);
  cerca(-(await op(page, 'i(v1)')), 0.03, 1e-4);
  await page.evaluate(() => {
    const ed = (window as unknown as Ventana).__epaEditor.ed;
    ed.cambiar(() => (ed.doc.componentes.find((c) => c.nombre === 'V1')!.campos['dc'] = '3'));
  });
  await simular(page);
  // 7,5 mA < 70 % of 30 mA: released, the load is on the NC contact.
  cerca(await op(page, 'v(nc)'), (5 * 100) / 100.05, 1e-4);
  expect(Math.abs(await op(page, 'v(no)'))).toBeLessThan(1e-3);
});

test('transformador por relación de espiras (con y sin toma central) y puente rectificador', async ({ page }) => {
  test.setTimeout(180_000);
  await abrirEditor(page);
  const tran = { op: false, tran: { activo: true, paso: '50u', fin: '60m', inicio: '0', uic: false } };
  await montar(
    page,
    [
      ['VSIN', 'V1', { vo: '0', va: '10', freq: '50' }, { end: 'p', start: '0' }],
      ['TRAFO', 'T1', { n: '10' }, { 'p.start': 'p', 'p.end': '0', 's.start': 's', 's.end': '0' }],
      ['R', 'R1', { valor: '1k' }, { start: 's', end: '0' }],
      ['VSIN', 'V2', { vo: '0', va: '10', freq: '50' }, { end: 'q', start: '0' }],
      ['TRAFO', 'T2', { n: '10', toma: 'si' }, { 'p.start': 'q', 'p.end': '0', 's.start': 's1', 's.mid': '0', 's.end': 's2' }],
      ['R', 'R2', { valor: '1k' }, { start: 's1', end: '0' }],
      ['R', 'R3', { valor: '1k' }, { start: 's2', end: '0' }],
      ['VSIN', 'V3', { vo: '0', va: '12', freq: '50' }, { end: 'a', start: 'b' }],
      ['PUENTE', 'BR1', {}, { a: 'a', b: 'b', p: 'pp', n: '0' }],
      ['R', 'R4', { valor: '1k' }, { start: 'pp', end: '0' }],
      ['R', 'R5', { valor: '1meg' }, { start: 'b', end: '0' }],
    ],
    tran,
  );
  const nl = await netlist(page);
  expect(nl).toMatch(/^LT1s s 0 0\.1$/m);
  expect(nl).toMatch(/^KT1 LT1p LT1s 0\.999$/m);
  expect(nl).toMatch(/^LT2s1 s1 0 0\.025$/m);
  expect(nl).toMatch(/^DBR1a a pp D1N4007$/m);
  // A sine source straight on a primary: the check only warns (a loop of a source and a coil).
  await expect(page.locator('.erc li.aviso').first()).toContainText('bobina');
  await simular(page);
  const t = await vector(page, /transient/, 'time');
  const pico = async (n: string, signo = 1) => {
    const y = await vector(page, /transient/, n);
    return Math.max(...y.filter((_, i) => t[i]! > 0.04).map((v) => signo * v));
  };
  // 10 : 1 → 1 V peak (k = 0,999, Lp = 10 H: the load hardly matters); each half of the tapped one 0,5 V.
  cerca(await pico('v(s)'), 1, 0.01);
  cerca(await pico('v(s1)'), 0.5, 0.01);
  cerca(await pico('v(s2)', -1), 0.5, 0.01);
  // Bridge: 12 V peak minus two diode drops (≈ 0,66 V each at 10 mA for the 1N4007).
  const vp = await pico('v(pp)');
  expect(vp).toBeGreaterThan(10.4);
  expect(vp).toBeLessThan(10.9);
});

test('cristal: resonancia serie a su frecuencia; interruptores y pulsadores', async ({ page }) => {
  await abrirEditor(page);
  await montar(
    page,
    [
      ['V', 'V1', { forma: 'dc', dc: '0', ac: '1' }, { end: 'x', start: '0' }],
      ['XTAL', 'Y1', {}, { start: 'x', end: 'y' }],
      ['R', 'R1', { valor: '1' }, { start: 'y', end: '0' }],
    ],
    { op: false, ac: { activo: true, tipo: 'lin', puntos: '2001', fini: '3,99M', ffin: '4,01M' } },
  );
  await simular(page);
  const f = await vector(page, /ac/, 'frequency');
  const y = await vector(page, /ac/, 'v(y)');
  const k = y.indexOf(Math.max(...y));
  // fs = 1/(2π√(Lm·Cm)) = 4 MHz; at resonance only Rs = 50 Ω and the 1 Ω: 1/51 V.
  cerca(f[k]!, 4e6, 2e-4);
  cerca(y[k]!, 1 / 51, 0.01);

  await page.evaluate(() => {
    const ed = (window as unknown as Ventana).__epaEditor.ed;
    ed.cambiar(() => (ed.doc.componentes = []));
  });
  await montar(
    page,
    [
    V('V1', '5', 'a'),
    ['CONM', 'S1', { posicion: 'b' }, { com: 'a', c1: 'x1', c2: 'x2' }],
    ['R', 'R1', { valor: '1k' }, { start: 'x1', end: '0' }],
    ['R', 'R2', { valor: '1k' }, { start: 'x2', end: '0' }],
    ['PULNA', 'S2', {}, { start: 'a', end: 'na' }],
    ['R', 'R3', { valor: '1k' }, { start: 'na', end: '0' }],
    ['PULNC', 'S3', {}, { start: 'a', end: 'nc' }],
    ['R', 'R4', { valor: '1k' }, { start: 'nc', end: '0' }],
    ],
    { op: true, ac: { activo: false, tipo: 'lin', puntos: '10', fini: '1', ffin: '10' } },
  );
  await simular(page);
  expect(await op(page, 'v(x1)')).toBeLessThan(1e-4);
  cerca(await op(page, 'v(x2)'), 5, 1e-5);
  expect(await op(page, 'v(na)')).toBeLessThan(1e-4);
  cerca(await op(page, 'v(nc)'), 5, 1e-5);
});

// ------------------------------------------------------------------ the book's transformers and bridges

test('los transformadores y puentes del libro se abren como piezas de la paleta y miden lo mismo que su texto', async ({ page }) => {
  test.setTimeout(300_000);
  for (const [id, tipo, n] of [
    ['cap24/transformador_24.9', 'TRAFO', 2],
    ['cap52/detector_cuadratura', 'TRAFO', 1],
    ['cap22/fig-22.9_puente', 'PUENTE', 1],
  ] as [string, string, number][]) {
    await page.goto(`/#/simulador/${id}`);
    // Long netlists do not run by themselves on the simulator page.
    const boton = page.getByRole('button', { name: 'Simular', exact: true });
    await page.waitForTimeout(1500);
    if (!(await page.locator('table.medidas td.n').count()) && (await boton.count())) await boton.first().click();
    const delTexto = await medidas(page);
    expect(delTexto.length).toBeGreaterThan(2);
    await page.locator('a.esquema', { hasText: 'Editar el esquema' }).click();
    await page.waitForFunction(() => (window as unknown as Partial<Ventana>).__epaEditor?.ed.doc.componentes.length);
    const comps = await page.evaluate(() => (window as unknown as Ventana).__epaEditor.ed.doc.componentes.map((c) => ({ tipo: c.tipo, campos: c.campos })));
    expect(comps.filter((c) => c.tipo === tipo).length, id).toBe(n);
    if (id.includes('detector')) expect(comps.find((c) => c.tipo === 'TRAFO')!.campos['toma']).toBe('si');
    await simular(page, (await page.locator('.erc li.error').count()) > 0);
    const delDibujo = await medidas(page);
    expect(delDibujo.map(([k]) => k)).toEqual(delTexto.map(([k]) => k));
    delDibujo.forEach(([k, v], i) => expect(Math.abs(v - delTexto[i]![1]), `${id} ${k}`).toBeLessThanOrEqual(Math.abs(delTexto[i]![1]) * 1e-6 + 1e-12));
  }
});

// ------------------------------------------------------------------ while simulating

test('un interruptor tocado durante la simulación cambia el resultado (punto de trabajo y transitorio)', async ({ page }) => {
  await abrirEditor(page);
  await montar(page, [V('V1', '5', 'a'), ['SW', 'S1', { estado: 'cerrado' }, { start: 'a', end: 'out' }], ['R', 'R1', { valor: '1k' }, { start: 'out', end: '0' }], ['C', 'C1', { valor: '1µ' }, { start: 'out', end: '0' }]], {
    tran: { activo: true, paso: '10u', fin: '2m', inicio: '0', uic: false },
  });
  await simular(page);
  cerca(await op(page, 'v(out)'), 5 * (1000 / 1000.001), 1e-5);
  await expect(page.locator('.viva .conmutable[data-conmutar="S1"]')).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => delete (window as unknown as Ventana).__epaEditorSim);
  await page.locator('.viva .conmutable[data-conmutar="S1"]').click();
  // The live values first (operating point), then the whole simulation again.
  await expect(page.locator('.toast')).toContainText('S1: abierto');
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaEditorSim, null, { timeout: 60_000 });
  expect(await op(page, 'v(out)')).toBeLessThan(1e-4);
  const t = await vector(page, /transient/, 'v(out)');
  expect(Math.max(...t)).toBeLessThan(1e-3);
  await expect(page.locator('.viva svg.valores text.v', { hasText: /^0,00 V|µV|nV/ }).first()).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as unknown as Ventana).__epaEditor.ed.doc.componentes.find((c) => c.nombre === 'S1')!.campos['estado'])).toBe('abierto');
});

test('el mando de un potenciómetro cambia el punto de trabajo al momento y el resto al soltarlo', async ({ page }) => {
  await abrirEditor(page);
  await montar(page, [V('V1', '10', 'vcc'), ['POT', 'P1', { pos: '50' }, { start: '0', end: 'vcc', tap: 'out' }]]);
  await simular(page);
  cerca(await op(page, 'v(out)'), 5);
  const mando = page.locator('.mandos input[name="mando-P1-pos"]');
  await expect(mando).toBeVisible();
  // Moving (input events only): the drawing shows the new voltage before any «Simular».
  await page.evaluate(() => delete (window as unknown as Ventana).__epaEditorSim);
  await mando.evaluate((el: HTMLInputElement) => {
    el.value = '750';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('.viva svg.valores text.v', { hasText: '7,50 V' })).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => !!(window as unknown as Ventana).__epaEditorSim)).toBe(false);
  // Released: the whole simulation (and its tables) again.
  await mando.evaluate((el: HTMLInputElement) => el.dispatchEvent(new Event('change', { bubbles: true })));
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaEditorSim, null, { timeout: 60_000 });
  cerca(await op(page, 'v(out)'), 7.5);
  // One step in the history for the whole movement.
  await page.getByRole('button', { name: 'Editar' }).click();
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => (window as unknown as Ventana).__epaEditor.ed.doc.componentes.find((c) => c.nombre === 'P1')!.campos['pos'])).toBe('50');
});

test('barrido de un valor: una curva por valor con su leyenda', async ({ page }) => {
  await abrirEditor(page);
  await montar(page, [['V', 'V1', { forma: 'dc', dc: '0', ac: '1' }, { end: 'in', start: '0' }], ['R', 'R1', { valor: '1k' }, { start: 'in', end: 'out' }], ['C', 'C1', { valor: '100n' }, { start: 'out', end: '0' }]], {
    op: true,
    ac: { activo: true, tipo: 'dec', puntos: '20', fini: '10', ffin: '100k' },
  });
  await page.locator('[name="barrido-activo"]').check();
  await page.locator('[name="barrido-comp"]').selectOption({ label: 'R1' });
  await page.locator('[name="barrido-lista"]').fill('1k; 2,2k; 4,7k');
  await page.locator('[name="barrido-lista"]').press('Enter');
  await expect(page.locator('.nota-barrido')).toContainText('3 simulaciones');
  await simular(page);
  const ids = await page.evaluate(() => (window as unknown as Ventana).__epaEditorSim!.ejecucion.graficas.filter((g) => /ac/i.test(g.analisis)).map((g) => g.id));
  expect(ids).toEqual(['R1 = 1 kΩ', 'R1 = 2,2 kΩ', 'R1 = 4,7 kΩ']);
  // −3 dB at 1/(2πRC) for each value: 1592, 723, 339 Hz.
  for (const [i, r] of [1e3, 2.2e3, 4.7e3].entries()) {
    const g = await page.evaluate((k) => {
      const gr = (window as unknown as Ventana).__epaEditorSim!.ejecucion.graficas.filter((x) => /ac/i.test(x.analisis))[k]!;
      const f = Array.from(gr.vectores[0]!.re);
      const v = gr.vectores.find((x) => x.nombre === 'v(out)')!;
      const m = Array.from(v.re).map((re, j) => Math.hypot(re, v.im![j]!));
      const j = m.findIndex((x) => x < Math.SQRT1_2);
      return f[j - 1]! + ((f[j]! - f[j - 1]!) * (m[j - 1]! - Math.SQRT1_2)) / (m[j - 1]! - m[j]!);
    }, i);
    cerca(g, 1 / (2 * Math.PI * r * 100e-9), 0.03);
  }
  const leyenda = page.locator('section.resultados .grafica').first().locator('.leyenda .serie .nombre');
  await expect(leyenda.filter({ hasText: 'R1 = 2,2 kΩ' }).first()).toBeVisible();
  expect(await leyenda.filter({ hasText: /v\(out\) · R1 = / }).count()).toBe(3);
  // The operating point: one column per value.
  await expect(page.locator('table.op thead th')).toHaveText(['Vector', 'R1 = 1 kΩ', 'R1 = 2,2 kΩ', 'R1 = 4,7 kΩ']);
});

// ------------------------------------------------------------------ tidying up

async function pinDe(page: Page, nombre: string, pin: string): Promise<P> {
  return page.evaluate(
    ([n, p]) => {
      const g = (window as unknown as Ventana).__epaEditor;
      const c = g.ed.doc.componentes.find((x) => x.nombre === n)!;
      const q = g.pines(c).find((x) => x.nombre === p)!;
      return g.pantalla(q.x, q.y);
    },
    [nombre, pin] as [string, string],
  );
}

test('alinear y repartir, ruta automática entre dos patillas y «Ordenar el esquema»', async ({ page }) => {
  await abrirEditor(page);
  // Three resistors at uneven heights.
  await page.evaluate(() => {
    const ed = (window as unknown as Ventana).__epaEditor.ed;
    for (const [x, y] of [
      [3, 3],
      [8, 6],
      [16, 4],
    ])
      ed.colocar('R', x, y);
    ed.sel = ed.doc.componentes.map((c) => c.id);
  });
  await page.getByRole('button', { name: 'Alinear', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Alinear arriba' }).click();
  const ys = await page.evaluate(() => (window as unknown as Ventana).__epaEditor.ed.doc.componentes.map((c) => c.y));
  expect(new Set(ys).size).toBe(1);
  await page.getByRole('button', { name: 'Alinear', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Repartir en horizontal' }).click();
  const xs = await page.evaluate(() => (window as unknown as Ventana).__epaEditor.ed.doc.componentes.map((c) => c.x).sort((a, b) => a - b));
  // Evenly on the grid (a unit of rounding at most).
  expect(Math.abs(xs[1]! - xs[0]! - (xs[2]! - xs[1]!))).toBeLessThanOrEqual(1);
  // Automatic wire from R1's right pin to R3's left pin, around R2.
  await page.getByRole('button', { name: 'Ruta automática' }).click();
  const a = await pinDe(page, 'R1', 'end');
  const b = await pinDe(page, 'R3', 'start');
  await page.mouse.click(a[0], a[1]);
  await page.mouse.click(b[0], b[1]);
  const nl = await netlist(page);
  const nodo = (n: string, i: number) => new RegExp(`^${n} (\\S+) (\\S+) `, 'm').exec(nl)![i + 1]!;
  expect(nodo('R1', 1)).toBe(nodo('R3', 0));
  expect([nodo('R2', 0), nodo('R2', 1)]).not.toContain(nodo('R1', 1));
  const cables = await page.evaluate(() => (window as unknown as Ventana).__epaEditor.ed.doc.cables.map((w) => w.p));
  expect(cables.length).toBeGreaterThanOrEqual(2);
  for (const p of cables) expect(p[0] === p[2] || p[1] === p[3]).toBe(true);

  // «Ordenar el esquema» on a drawn circuit with new parts: same connections and the same operating point.
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const ed = (window as unknown as Ventana).__epaEditor.ed;
    ed.cambiar(() => {
      ed.doc.componentes = [];
      ed.doc.cables = [];
    });
  });
  await montar(page, [V('V1', '12', 'vcc'), ['R', 'R1', { valor: '1k' }, { start: 'vcc', end: 'b' }], ['LDR', 'LDR1', { luz: '50' }, { start: 'b', end: '0' }], ['POT', 'P1', { pos: '30' }, { start: 'vcc', end: '0', tap: 'c' }], ['LAMP', 'H1', {}, { start: 'c', end: '0' }], ['RELE', 'K1', {}, { b1: 'vcc', b2: '0', com: 'vcc', no: 'm', nc: 'nc' }], ['MOTOR', 'M1', {}, { start: 'm', end: '0' }]]);
  await page.evaluate(() => {
    const ed = (window as unknown as Ventana).__epaEditor.ed;
    // A probe too: it must come back on its net.
    const c = ed.colocar('SONDA', 2, 12);
    void c;
  });
  await simular(page);
  const antes = { b: await op(page, 'v(b)'), c: await op(page, 'v(c)'), m: await op(page, 'v(m)') };
  await page.getByRole('button', { name: 'Editar' }).click();
  await page.getByRole('button', { name: 'Ordenar el esquema' }).click();
  await expect(page.locator('.toast')).toContainText('Esquema ordenado', { timeout: 30_000 });
  fs.mkdirSync(CAPTURAS, { recursive: true });
  await page.locator('.lienzo').scrollIntoViewIfNeeded();
  await page.locator('.lienzo').screenshot({ path: `${CAPTURAS}/escritorio-ordenado.png` });
  const elementos = (t: string) => t.split('\n').filter((l) => /^[A-Z]/.test(l)).length;
  expect(elementos(await netlist(page))).toBeGreaterThan(6);
  await simular(page);
  cerca(await op(page, 'v(b)'), antes.b, 1e-6);
  cerca(await op(page, 'v(c)'), antes.c, 1e-6);
  cerca(await op(page, 'v(m)'), antes.m, 1e-6);
  // No loose wire ends (every routed wire reaches its pins).
  const avisos = await page.evaluate(() => (window as unknown as Ventana).__epaEditor.ed.nl.avisos.map((a) => a.texto));
  expect(avisos.filter((t) => /no está conectado/.test(t) && !/SV1/.test(t))).toEqual([]);
});

test('notas de texto: se mueven, se editan, se guardan y salen en el SVG', async ({ page }) => {
  await abrirEditor(page);
  await page.locator('.paleta [data-tipo="NOTA"]').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  const [x, y] = await page.evaluate(() => (window as unknown as Ventana).__epaEditor.pantalla(5, 3));
  await page.mouse.click(x, y);
  await page.locator('.propiedades textarea[name="texto"]').fill('Fuente de 5 V\nfiltro de red');
  await page.locator('.propiedades textarea[name="texto"]').blur();
  const nota = () => page.evaluate(() => (window as unknown as Ventana).__epaEditor.ed.doc.componentes.find((c) => c.tipo === 'NOTA')!);
  expect((await nota()).campos['texto']).toBe('Fuente de 5 V\nfiltro de red');
  await expect(page.locator('.lienzo text', { hasText: 'filtro de red' })).toBeVisible();
  // Move it by dragging its text.
  const x0 = (await nota()).x;
  const t = await page.locator('.lienzo text', { hasText: 'Fuente de 5 V' }).boundingBox();
  await page.mouse.move(t!.x + 10, t!.y + t!.height / 2);
  await page.mouse.down();
  await page.mouse.move(t!.x + 60, t!.y + t!.height / 2, { steps: 6 });
  await page.mouse.move(t!.x + 110, t!.y + t!.height / 2, { steps: 6 });
  await page.mouse.up();
  expect((await nota()).x).toBeGreaterThan(x0);
  // It is not part of the netlist; it stays in the saved draft and in the exported SVG.
  expect(await netlist(page)).not.toContain('filtro');
  await page.waitForTimeout(900);
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Partial<Ventana>).__epaEditor?.ed.doc.componentes.length);
  expect((await nota()).campos['texto']).toBe('Fuente de 5 V\nfiltro de red');
  await page.locator('.paleta [data-tipo="R"]').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  const [rx, ry] = await page.evaluate(() => (window as unknown as Ventana).__epaEditor.pantalla(4, 8));
  await page.mouse.click(rx, ry);
  const [svg] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar SVG' }).click()]);
  const s = fs.readFileSync((await svg.path())!, 'utf8');
  expect(s).toContain('Fuente de 5 V');
  expect(s).toContain('filtro de red');
});

// ------------------------------------------------------------------ electrical rule check

test('revisión eléctrica: cada regla en un circuito hecho para ella, explicada', async ({ page }) => {
  await abrirEditor(page);
  const casos: [Parte[], RegExp, RegExp][] = [
    // 1. A node joined to the rest only by capacitors.
    [[V('V1', '5', 'a'), ['C', 'C1', { valor: '1µ' }, { start: 'a', end: 'x' }], ['C', 'C2', { valor: '1µ' }, { start: 'x', end: '0' }], ['R', 'R1', { valor: '1k' }, { start: 'a', end: '0' }]], /«x» no tiene camino de continua hasta masa/, /solo hay condensadores.*matriz singular/],
    // 2. Two voltage sources in parallel.
    [[V('V1', '5', 'a'), V('V2', '3', 'a'), ['R', 'R1', { valor: '1k' }, { start: 'a', end: '0' }]], /Fuentes de tensión en paralelo: V2 y V1|Fuentes de tensión en paralelo: V1 y V2/, /lazo cerrado sin ninguna resistencia/],
    // 3. A current source with nothing to return through, and two in series.
    [[V('V1', '5', 'a'), ['R', 'R1', { valor: '1k' }, { start: 'a', end: '0' }], ['I', 'I1', { forma: 'dc', dc: '1m' }, { start: '0', end: 'q' }]], /I1 está en circuito abierto/, /no tiene por dónde volver/],
    [[['I', 'I1', { forma: 'dc', dc: '1m' }, { start: '0', end: 'q' }], ['I', 'I2', { forma: 'dc', dc: '2m' }, { start: 'q', end: 'w' }], ['R', 'R1', { valor: '1k' }, { start: 'w', end: '0' }]], /Fuentes de corriente en serie: I1 y I2/, /ley de Kirchhoff/],
    // 4. An op-amp input in the air.
    [[V('V1', '1', 'in'), ['OA', 'U1', {}, { in1: 'out', out: 'out' }], ['R', 'R1', { valor: '1k' }, { start: 'in', end: '0' }], ['R', 'R2', { valor: '1k' }, { start: 'out', end: '0' }]], /La entrada \+ de U1 está al aire/, /alta impedancia no consume corriente/],
    // 5. A part with both ends on one node.
    [[V('V1', '5', 'a'), ['R', 'R1', { valor: '1k' }, { start: 'a', end: 'a' }], ['R', 'R2', { valor: '1k' }, { start: 'a', end: '0' }]], /R1 tiene todos sus terminales en el mismo nodo/, /cortocircuitado/],
  ];
  for (const [partes, titulo, texto] of casos) {
    await page.evaluate(() => {
      const ed = (window as unknown as Ventana).__epaEditor.ed;
      ed.cambiar(() => {
        ed.doc.componentes = [];
        ed.doc.cables = [];
      });
    });
    await montar(page, partes);
    const li = page.locator('.erc li', { hasText: titulo });
    await expect(li).toBeVisible();
    await expect(li).toContainText(texto);
  }
  // «Simular» stops on an error of the check and explains it; «Señalar» selects the parts.
  await page.evaluate(() => {
    const ed = (window as unknown as Ventana).__epaEditor.ed;
    ed.cambiar(() => (ed.doc.componentes = []));
  });
  await montar(page, [V('V1', '5', 'a'), V('V2', '3', 'a'), ['R', 'R1', { valor: '1k' }, { start: 'a', end: '0' }]]);
  await page.locator('button.simular').click();
  await expect(page.locator('.erc.parado h4')).toContainText('antes de simular');
  await page.locator('.erc li', { hasText: 'paralelo' }).getByRole('button', { name: 'Señalar en el esquema' }).click();
  expect((await page.evaluate(() => (window as unknown as Ventana).__epaEditor.ed.sel)).length).toBe(2);
});

test('si ngspice no converge, la ayuda explica por qué y un arreglo se prueba en una copia', async ({ page }) => {
  await abrirEditor(page);
  await montar(page, [V('V1', '5', 'a'), V('V2', '3', 'a'), ['R', 'R1', { valor: '1k' }, { start: 'a', end: '0' }]]);
  await simular(page, true);
  const ayuda = page.locator('section.convergencia');
  await expect(ayuda).toBeVisible();
  await expect(ayuda).toContainText('no ha conseguido calcular el punto de trabajo');
  await expect(ayuda).toContainText('lazos de fuentes de tensión');
  await expect(ayuda.locator('.arreglo')).toHaveCount(3);
  // The tiny series resistance: a copy, saved and simulated; the original stays as it was.
  await page.evaluate(() => delete (window as unknown as Ventana).__epaEditorSim);
  await ayuda.locator('.arreglo[data-arreglo="rserie"]').click();
  await page.waitForURL(/#\/editor\/c[0-9a-z]+$/);
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaEditorSim, null, { timeout: 60_000 });
  expect(await netlist(page)).toMatch(/^RV1_rs v1_rs 0 1m$/m);
  await expect(page.locator('h1')).toContainText('con 1 mΩ en serie');
  expect(await page.evaluate(() => (window as unknown as Ventana).__epaEditorSim!.salida.errores.length)).toBe(0);
  // Two sources of 5 and 3 V through 2 mΩ: 4 V in the middle.
  cerca(await op(page, 'v(a)'), 4, 1e-3);
  const guardados = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('epa:editor-circuitos') ?? '{}').circuitos ?? {}).length);
  expect(guardados).toBe(1);
});

// ------------------------------------------------------------------ breadboard

const PARTES_PROTOBOARD: Parte[] = [
  V('V1', '12', 'vcc'),
  ['SW', 'S1', {}, { start: 'vcc', end: 'a' }],
  ['PULNA', 'S2', {}, { start: 'a', end: 'b' }],
  ['LAMP', 'H1', {}, { start: 'b', end: '0' }],
  ['RELE', 'K1', {}, { b1: 'a', b2: '0', com: 'vcc', no: 'm', nc: 'nc' }],
  ['MOTOR', 'M1', {}, { start: 'm', end: '0' }],
  ['LDR', 'LDR1', {}, { start: 'vcc', end: 'l' }],
  ['NTC', 'RT1', {}, { start: 'l', end: '0' }],
];

async function verEnProtoboard(page: Page) {
  await page.getByRole('button', { name: 'Ver en protoboard' }).click();
  await page.waitForFunction(() => !!(window as unknown as { __epaProtoboard?: { pb: { doc: { piezas: unknown[] } } } }).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
  await page.waitForTimeout(300);
}

test('en la protoboard: piezas con su encapsulado, interruptor y pulsador que se conmutan con dos toques', async ({ page }) => {
  await abrirEditor(page);
  await montar(page, PARTES_PROTOBOARD);
  await verEnProtoboard(page);
  const piezas = await page.evaluate(() =>
    (window as unknown as { __epaProtoboard: { pb: { doc: { piezas: { enc: string; comp: { nombre: string } }[] } }; verificar: () => string[] } }).__epaProtoboard.pb.doc.piezas.map((p) => `${p.comp.nombre}:${p.enc}`),
  );
  for (const x of ['S1:conmutador', 'S2:pulsador', 'H1:lampara', 'K1:rele', 'M1:motor', 'LDR1:ldr', 'RT1:termistor']) expect(piezas).toContain(x);
  expect(await page.evaluate(() => (window as unknown as { __epaProtoboard: { verificar: () => string[] } }).__epaProtoboard.verificar())).toEqual([]);
  const estado = (n: string) =>
    page.evaluate(
      (nombre) => (window as unknown as { __epaProtoboard: { pb: { doc: { piezas: { comp: { nombre: string; campos: Record<string, string> } }[] } } } }).__epaProtoboard.pb.doc.piezas.find((p) => p.comp.nombre === nombre)!.comp.campos,
      n,
    );
  for (const [n, campo, antes, despues] of [
    ['S2', 'pulsado', 'no', 'si'],
    ['S1', 'estado', 'cerrado', 'abierto'],
  ] as const) {
    expect((await estado(n))[campo] ?? antes).toBe(antes);
    const c = await page.evaluate((nombre) => (window as unknown as { __epaProtoboard: { centro: (n: string) => P | null } }).__epaProtoboard.centro(nombre), n);
    await page.mouse.dblclick(c![0], c![1]);
    await expect.poll(async () => (await estado(n))[campo]).toBe(despues);
  }
});

for (const ancho of [412, 800]) {
  test(`táctil a ${ancho} px: paleta nueva, conmutar al simular y la barra de pestañas de la protoboard`, async ({ browser }) => {
    test.setTimeout(150_000);
    const ctx = await browser.newContext({ viewport: { width: ancho, height: ancho === 412 ? 915 : 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto('/#/');
    await page.evaluate(() => localStorage.removeItem('epa:editor-borrador'));
    await abrirEditor(page);
    // The new parts are in the phone's palette strip.
    for (const t of ['CONM', 'PULNA', 'RELE', 'LDR', 'NTC', 'LAMP', 'MOTOR', 'XTAL', 'PUENTE', 'NOTA']) await expect(page.locator(`.paleta [data-tipo="${t}"]`)).toHaveCount(1);
    await montar(page, [V('V1', '5', 'a'), ['PULNA', 'S1', {}, { start: 'a', end: 'out' }], ['R', 'R1', { valor: '1k' }, { start: 'out', end: '0' }]]);
    await page.locator('button.simular').tap();
    await page.waitForFunction(() => !!(window as unknown as Ventana).__epaEditorSim, null, { timeout: 60_000 });
    expect(await op(page, 'v(out)')).toBeLessThan(1e-4);
    await page.evaluate(() => delete (window as unknown as Ventana).__epaEditorSim);
    const r = page.locator('.viva .conmutable[data-conmutar="S1"]');
    await r.scrollIntoViewIfNeeded();
    await r.tap();
    await page.waitForFunction(() => !!(window as unknown as Ventana).__epaEditorSim, null, { timeout: 60_000 });
    cerca(await op(page, 'v(out)'), 5, 1e-5);
    // The breadboard: its six tabs fit without scrolling sideways.
    await page.getByRole('button', { name: 'Editar' }).tap();
    await verEnProtoboard(page);
    const barra = page.locator('.capa-protoboard .pestanas').first();
    await expect(barra).toBeVisible();
    const medidasBarra = await barra.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, botones: [...el.querySelectorAll('button')].map((b) => b.getBoundingClientRect().right) }));
    expect(medidasBarra.sw).toBeLessThanOrEqual(medidasBarra.cw + 1);
    expect(Math.max(...medidasBarra.botones)).toBeLessThanOrEqual(ancho + 1);
    await ctx.close();
  });
}

// ------------------------------------------------------------------ screenshots

const PERFILES = {
  tableta: { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;

async function capturas(browser: Browser, perfil: keyof typeof PERFILES, tema: 'claro' | 'oscuro') {
  fs.mkdirSync(CAPTURAS, { recursive: true });
  const ctx = await browser.newContext({ ...PERFILES[perfil], colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
  const page = await ctx.newPage();
  await page.goto('/#/');
  await page.evaluate(() => {
    localStorage.removeItem('epa:editor-borrador');
    localStorage.removeItem('epa:editor-circuitos');
  });
  const base = `${CAPTURAS}/${perfil}-${tema}`;
  // The new palette parts, placed and wired by labels.
  await abrirEditor(page);
  await montar(page, PARTES_PROTOBOARD);
  await page.evaluate(() => {
    const ed = (window as unknown as Ventana).__epaEditor.ed;
    for (const [t, x, y] of [
      ['CONM', 3, 13],
      ['PULNC', 10, 13],
      ['TRAFO', 17, 13],
      ['PUENTE', 25, 13],
      ['XTAL', 33, 13],
      ['ZUMB', 3, 19],
      ['ALTAVOZ', 10, 19],
      ['PTC', 17, 19],
      ['NOTA', 25, 19],
    ] as [string, number, number][])
      ed.colocar(t, x, y);
    ed.sel = [];
  });
  await page.locator('.lienzo').scrollIntoViewIfNeeded();
  await page.keyboard.press('f');
  await page.waitForTimeout(300);
  await page.locator('.lienzo').screenshot({ path: `${base}-piezas.png` });
  await page.locator('.paleta').first().screenshot({ path: `${base}-paleta.png` });
  // ERC panel.
  await page.evaluate(() => {
    const ed = (window as unknown as Ventana).__epaEditor.ed;
    ed.cambiar(() => {
      ed.doc.componentes = [];
      ed.doc.cables = [];
    });
  });
  await montar(page, [V('V1', '5', 'a'), V('V2', '3', 'a'), ['C', 'C1', { valor: '1µ' }, { start: 'a', end: 'x' }], ['C', 'C2', { valor: '1µ' }, { start: 'x', end: '0' }], ['OA', 'U1', {}, { in1: 'o', out: 'o' }], ['R', 'R1', { valor: '1k' }, { start: 'o', end: '0' }]]);
  await page.locator('button.simular').click();
  await expect(page.locator('.erc.parado')).toBeVisible();
  await page.locator('.erc').scrollIntoViewIfNeeded();
  await page.locator('.erc').screenshot({ path: `${base}-erc.png` });
  await page.locator('.erc button', { hasText: 'Simular de todos modos' }).click();
  await expect(page.locator('section.convergencia')).toBeVisible({ timeout: 60_000 });
  await page.locator('section.convergencia').screenshot({ path: `${base}-convergencia.png` });
  // A sweep plot.
  await page.evaluate(() => {
    const ed = (window as unknown as Ventana).__epaEditor.ed;
    ed.cambiar(() => {
      ed.doc.componentes = [];
      ed.doc.cables = [];
    });
  });
  await montar(page, [['V', 'V1', { forma: 'dc', dc: '0', ac: '1' }, { end: 'in', start: '0' }], ['R', 'R1', { valor: '1k' }, { start: 'in', end: 'out' }], ['C', 'C1', { valor: '100n' }, { start: 'out', end: '0' }]], {
    op: false,
    ac: { activo: true, tipo: 'dec', puntos: '20', fini: '10', ffin: '100k' },
  });
  await page.locator('[name="barrido-activo"]').check();
  await expect(page.locator('[name="barrido-comp"]')).toHaveValue(await page.evaluate(() => (window as unknown as Ventana).__epaEditor.ed.doc.componentes.find((c) => c.nombre === 'R1')!.id));
  await page.locator('[name="barrido-lista"]').fill('470; 1k; 2,2k; 4,7k');
  await page.locator('[name="barrido-lista"]').press('Enter');
  await simular(page);
  await page.locator('section.resultados').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.locator('section.resultados .bloque').first().screenshot({ path: `${base}-barrido.png` });
  // Knobs and switches in the results.
  await page.evaluate(() => {
    const ed = (window as unknown as Ventana).__epaEditor.ed;
    ed.cambiar(() => {
      ed.doc.componentes = [];
      ed.doc.cables = [];
      ed.doc.barrido = undefined;
      ed.doc.analisis['ac'] = { activo: false, tipo: 'dec', puntos: '20', fini: '10', ffin: '100k' };
      ed.doc.analisis['op'] = true;
    });
  });
  await montar(page, [V('V1', '9', 'vcc'), ['SW', 'S1', {}, { start: 'vcc', end: 'a' }], ['POT', 'P1', { pos: '40' }, { start: 'a', end: '0', tap: 'b' }], ['LDR', 'LDR1', {}, { start: 'b', end: 'c' }], ['LAMP', 'H1', {}, { start: 'c', end: '0' }]]);
  await page.locator('button.simular').click();
  await expect(page.locator('.viva .conmutable').first()).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(800);
  await page.locator('.centro').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${base}-mandos.png` });
  // The breadboard with the new parts, and its tab bar.
  await page.getByRole('button', { name: 'Editar' }).click();
  await page.evaluate(() => {
    const ed = (window as unknown as Ventana).__epaEditor.ed;
    ed.cambiar(() => {
      ed.doc.componentes = [];
      ed.doc.cables = [];
    });
  });
  await montar(page, PARTES_PROTOBOARD);
  await verEnProtoboard(page);
  await page.screenshot({ path: `${base}-protoboard.png` });
  await page.locator('.capa-protoboard .pestanas').first().screenshot({ path: `${base}-pestanas.png` });
  await ctx.close();
}

for (const perfil of Object.keys(PERFILES) as (keyof typeof PERFILES)[])
  for (const tema of ['claro', 'oscuro'] as const)
    test(`capturas ${perfil} ${tema}`, async ({ browser }) => {
      test.setTimeout(240_000);
      await capturas(browser, perfil, tema);
    });
