// The virtual breadboard (componentes/protoboard/): «Ver en protoboard» on the book's netlists, the free
// netlist and the editor's drawings; the auto-placement (every part on the board, every net of the schematic
// one net of the board, no shorts); editing (moving a leg changes the netlist and the live schematic),
// simulating the modified circuit, the reversed-LED warning, closing back to the untouched schematic, no
// option on drawing-only figures nor on the consoles, saving as an own circuit, the «Protoboard» tab, touch
// (tap, drag, pinch at 412 and 800 px), the «Protoboard» entry of the tools menu, logic gates mounted as real
// 74HC chips (supply and spare inputs tied to the rails, the floating CMOS input warning) and the screenshots
// of tests/capturas/protoboard10/.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.protoboard10.config.ts tests/protoboard10.spec.ts
// The check over every circuit (313 book netlists, 31 figure schematics) runs in Node: node tests/protoboard10.mjs
import fs from 'node:fs';
import { expect, test, type Browser, type CDPSession, type Page } from '@playwright/test';

type P = [number, number];
const CAPTURAS = 'tests/capturas/protoboard10';

interface Ventana {
  __epaProtoboard?: {
    pb: {
      doc: {
        piezas: { id: string; enc: string; comp: { nombre: string; tipo: string; campos: Record<string, string> }; pos: P[]; patas: (string | null)[]; chip?: { comps: { nombre: string }[]; roles: string[]; ataduras: Record<number, unknown> } }[];
        cables: { id: string; a: P; b: P }[];
        placas: number;
        columnas: number;
      };
      sel: string[];
      nl: { texto: string; errores: { texto: string }[] };
      obs: { nivel: string; texto: string }[];
      op: unknown;
      con: { redDeConductor: Map<string, number> };
    };
    pantalla: (x: number, y: number) => P;
    verificar: () => string[];
    pata: (nombre: string, i: number) => P | null;
    centro: (nombre: string) => P | null;
    escala: () => number;
    ajustar: () => void;
  };
  __epaProtoboardSim?: { salida: { texto: string; errores: string[] } };
}

const LED = `* LED con su resistencia
V1 vcc 0 DC 5
R1 vcc a 330
D1 a 0 LEDR
.model LEDR D(IS=1e-18 N=1.9 RS=5)
.op
.end
`;

const ASTABLE_555 = `* Astable con 555 y LED
VCC vcc 0 DC 9
RA vcc dis 1k
RB dis thr 10k
C1 thr 0 10u
C2 ctl 0 10n
X1 0 thr out vcc ctl thr dis vcc ne555
R1 out led 470
D1 led 0 LEDR
.model LEDR D(IS=1e-18 N=1.9 RS=5)
.subckt ne555 g tr o rs ct th ds vc
R1 vc ct 5k
R2 ct lo 5k
R3 lo g 5k
Bs s g V = 0.5*(1+tanh(40*(v(lo,g)-v(tr,g))))
Br r g V = 0.5*(1+tanh(40*(v(th,g)-v(ct,g))))
Bk k g V = 0.5*(1+tanh(20*(v(rs,g)-0.7)))
Bq qd g V = v(k,g)*(v(s,g) + (1-v(s,g))*(1-v(r,g))*0.5*(1+tanh(12*(v(q,g)-0.5))))
Rq qd q 1k
Cq q g 1p
Bo oi g V = v(q,g)*max(v(vc,g)-1.7, 0) + 0.05
Ro oi o 10
Bn nq g V = 1-v(q,g)
Sd ds g nq g sdis555
Ri vc g 15k
.model sdis555 sw(vt=0.5 vh=0.1 ron=10 roff=1g)
.ends ne555
.tran 1m 1.5
.end
`;

async function listo(page: Page) {
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
  await page.waitForTimeout(300);
}

async function abrirNetlist(page: Page, id: string) {
  await page.goto(`/#/simulador/${id}`);
  const b = page.locator('.meta button:has-text("Ver en protoboard")');
  await expect(b).toBeVisible({ timeout: 30_000 });
  await b.click();
  await listo(page);
}

async function abrirLibre(page: Page, texto: string) {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('epa:circuito', t), texto);
  await page.goto('/#/simulador/nuevo');
  const b = page.locator('.meta button:has-text("Ver en protoboard")');
  await expect(b).toBeVisible({ timeout: 30_000 });
  await b.click();
  await listo(page);
}

const pbDe = (page: Page) => page.evaluate(() => {
  const g = (window as unknown as Ventana).__epaProtoboard!;
  return {
    piezas: g.pb.doc.piezas.map((p) => ({ id: p.id, enc: p.enc, nombre: p.comp.nombre, pos: p.pos, modelo: p.chip ? p.comp.campos['modelo'] : undefined, puertas: p.chip?.comps.map((c) => c.nombre) })),
    cables: g.pb.doc.cables.length,
    netlist: g.pb.nl.texto,
    errores: g.pb.nl.errores.map((e) => e.texto),
    obs: g.pb.obs.map((o) => `${o.nivel}: ${o.texto}`),
    problemas: g.verificar(),
    sel: [...g.pb.sel],
  };
});

/** A free hole near (x, y) whose strip has nothing on it. */
async function huecoLibre(page: Page, cerca: P, distancia: number): Promise<P> {
  return page.evaluate(
    ([c, d]) => {
      const g = (window as unknown as Ventana).__epaProtoboard!;
      const ocupados = new Set<string>();
      for (const p of g.pb.doc.piezas) for (const q of p.pos) ocupados.add(q.join(','));
      for (const w of g.pb.doc.cables) for (const q of [w.a, w.b]) ocupados.add(q.join(','));
      for (let dx = d; dx >= 2; dx--)
        for (const s of [1, -1])
          for (const y of [c[1], 3, 4, 5, 6, 7, 10, 11, 12, 13, 14]) {
            const x = c[0] + s * dx;
            if (x < 1 || x > g.pb.doc.columnas) continue;
            const tira = `T0:${x}:${y <= 7 ? 'a' : 'b'}`;
            if (g.pb.con.redDeConductor.has(tira) || ocupados.has(`${x},${y}`)) continue;
            return [x, y] as [number, number];
          }
      return null;
    },
    [cerca, distancia] as [P, number],
  ) as Promise<P>;
}

async function cerrar(page: Page) {
  await page.locator('.capa-protoboard button[aria-label="Cerrar y volver al esquema"]').click();
  await expect(page.locator('.capa-protoboard')).toHaveCount(0);
}

// ------------------------------------------------------------------ auto-placement

test('coloca en la protoboard circuitos del libro, del simulador y del editor sin cortos ni redes partidas', async ({ page }) => {
  test.setTimeout(300_000);
  const ids = [
    'cap05/sec-5.3_led_150ohm',
    'cap42/fig-42.3_op_emisor_comun',
    'cap27/fig-27.7',
    'cap22/fig-22.14_555_astable',
    'cap08/fig-8.3',
    'cap33/fig-33.10_puente_h',
    'cap43/fig-43.6_configuraciones',
    'cap50/rectificador',
    'cap36/sonda_1k',
    'cap20/fig-20.2_optoacoplador',
  ];
  for (const id of ids) {
    await abrirNetlist(page, id);
    const r = await pbDe(page);
    expect(r.problemas, id).toEqual([]);
    expect(r.errores, id).toEqual([]);
    expect(r.obs.some((o) => o === 'bien: El montaje corresponde al esquema original.'), `${id}: ${r.obs.join(' | ')}`).toBe(true);
    expect(r.obs.filter((o) => o.startsWith('error')), id).toEqual([]);
    await cerrar(page);
  }
  // A drawing of the editor (a book netlist opened as a drawing).
  await page.goto('/#/editor/libro/cap42/fig-42.3_op_emisor_comun');
  await expect(page.locator('.lienzo')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => ((window as unknown as { __epaEditor?: { ed: { doc: { componentes: unknown[] } } } }).__epaEditor?.ed.doc.componentes.length ?? 0) > 5);
  await page.locator('button:has-text("Ver en protoboard")').first().click();
  await listo(page);
  const r = await pbDe(page);
  expect(r.problemas).toEqual([]);
  expect(r.obs).toContain('bien: El montaje corresponde al esquema original.');
  // A book figure's own schematic (figure data, no netlist of the book).
  await cerrar(page);
});

test('la figura con esquema simulable, la figura que es solo un dibujo y las consolas', async ({ page }) => {
  // fig-23.3 has a netlist; fig-23.4 is a schematic without values (only a drawing).
  await page.goto('/#/cap23/fig-23.3');
  const conBoton = page.locator('#fig-23\\.3 .ver-protoboard button');
  await expect(conBoton).toBeVisible({ timeout: 30_000 });
  await page.goto('/#/cap23/fig-23.4');
  await expect(page.locator('#fig-23\\.4')).toBeVisible({ timeout: 30_000 });
  await page.locator('#fig-23\\.4').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await expect(page.locator('#fig-23\\.4 .ver-protoboard button')).toHaveCount(0);
  // A figure whose circuit comes only from its figure data (no book netlist): fig-23.5.
  await page.goto('/#/cap23/fig-23.5');
  const fig = page.locator('#fig-23\\.5');
  await expect(fig).toBeVisible({ timeout: 30_000 });
  await fig.scrollIntoViewIfNeeded();
  // Two simulable schematics in that figure: a menu.
  const b = page.locator('#fig-23\\.5 .ver-protoboard button.boton-pb');
  await expect(b).toBeVisible({ timeout: 30_000 });
  await expect(b).toContainText('2');
  await b.click();
  await page.locator('#fig-23\\.5 .ver-protoboard .menu button').first().click();
  await listo(page);
  const r = await pbDe(page);
  expect(r.problemas).toEqual([]);
  expect(r.obs).toContain('bien: El montaje corresponde al esquema original.');
  await cerrar(page);
  // The consoles never offer it.
  await page.goto('/#/consolas');
  await page.waitForTimeout(2500);
  await expect(page.getByText('Ver en protoboard')).toHaveCount(0);
});

// ------------------------------------------------------------------ editing and simulating

test('mover una pata cambia la netlist y el esquema en vivo; se simula el circuito modificado', async ({ page }) => {
  test.setTimeout(180_000);
  await abrirNetlist(page, 'cap42/fig-42.3_op_emisor_comun');
  // The original circuit simulated.
  await page.locator('.herramientas button:has-text("Simular")').click();
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboardSim, null, { timeout: 90_000 });
  const antes = await page.evaluate(() => (window as unknown as Ventana).__epaProtoboardSim!.salida.texto);
  expect(antes).toMatch(/v\(e\)\s*=\s*[\d.]/);
  await page.locator('.pestanas button:has-text("Esquema")').click();
  const esquema = page.locator('.esquema-vivo .escenario-fv img').first();
  await expect(esquema).toBeVisible({ timeout: 30_000 });
  const dibujoAntes = await esquema.getAttribute('src');
  const r0 = await pbDe(page);
  const re = r0.piezas.find((p) => p.nombre === 'RE')!;
  // Select RE and drag its second leg to a free strip: its emitter end is no longer on ground.
  const c = await page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.centro('RE'));
  await page.mouse.click(c![0], c![1]);
  expect((await pbDe(page)).sel).toEqual([re.id]);
  const destino = await huecoLibre(page, re.pos[0]!, 6);
  const de = await page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.pata('RE', 1));
  const a = await page.evaluate(([x, y]) => (window as unknown as Ventana).__epaProtoboard!.pantalla(x, y), destino);
  await page.mouse.move(de![0], de![1]);
  await page.mouse.down();
  await page.mouse.move((de![0] + a[0]) / 2, (de![1] + a[1]) / 2, { steps: 4 });
  await page.mouse.move(a[0], a[1], { steps: 4 });
  await page.mouse.up();
  const r1 = await pbDe(page);
  expect(r1.piezas.find((p) => p.nombre === 'RE')!.pos[1]).toEqual(destino);
  const lineaRE = (t: string) => t.split('\n').find((l) => /^RE\s/.test(l));
  expect(lineaRE(r1.netlist)).not.toEqual(lineaRE(r0.netlist));
  expect(r1.obs.some((o) => /partida/.test(o))).toBe(true);
  // The live schematic is drawn again from the new netlist.
  await expect.poll(async () => (await esquema.getAttribute('src')) !== dibujoAntes, { timeout: 30_000 }).toBe(true);
  // Simulating the modified circuit: the emitter no longer goes to ground through RE.
  await page.evaluate(() => delete (window as unknown as Ventana).__epaProtoboardSim);
  await page.locator('.herramientas button:has-text("Simular")').click();
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboardSim, null, { timeout: 90_000 });
  const despues = await page.evaluate(() => (window as unknown as Ventana).__epaProtoboardSim!);
  expect(despues.salida.errores).toEqual([]);
  const ve = (t: string) => Number(/v\(e\)\s*=\s*([-\d.e+]+)/.exec(t)?.[1]);
  expect(Math.abs(ve(despues.salida.texto) - ve(antes))).toBeGreaterThan(0.05);
  // Undo puts it back.
  await page.keyboard.press('Control+z');
  expect((await pbDe(page)).obs).toContain('bien: El montaje corresponde al esquema original.');
});

test('un LED al revés se avisa y deja de encenderse', async ({ page }) => {
  test.setTimeout(150_000);
  await abrirLibre(page, LED);
  const r0 = await pbDe(page);
  const d1 = r0.piezas.find((p) => p.nombre === 'D1')!;
  expect(d1.enc).toBe('led');
  await page.locator('.herramientas button:has-text("Simular")').click();
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboardSim, null, { timeout: 90_000 });
  const led = page.locator(`[data-pieza="${d1.id}"]`);
  await expect.poll(async () => (await led.innerHTML()).includes('pb-luz'), { timeout: 30_000 }).toBe(true);
  // Turned round with «Dar la vuelta».
  const c = await page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.centro('D1'));
  await page.mouse.click(c![0], c![1]);
  await page.locator('.herramientas button[aria-label="Dar la vuelta"]').click();
  const r1 = await pbDe(page);
  expect(r1.obs.some((o) => /LED D1 está al revés/.test(o))).toBe(true);
  await page.locator('.pestanas button:has-text("Avisos")').click();
  await expect(page.locator('.avisos li.aviso').filter({ hasText: 'al revés' }).first()).toBeVisible();
  // The live operating point puts it out.
  await expect.poll(async () => (await led.innerHTML()).includes('pb-luz'), { timeout: 30_000 }).toBe(false);
  await expect.poll(async () => (await pbDe(page)).obs.some((o) => /polarizado en inversa/.test(o)), { timeout: 30_000 }).toBe(true);
});

test('cerrar devuelve el esquema intacto (simulador y editor)', async ({ page }) => {
  await page.goto('/#/simulador/cap05/sec-5.3_led_150ohm');
  const texto = page.locator('textarea').first();
  await expect(texto).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await texto.inputValue()).length, { timeout: 30_000 }).toBeGreaterThan(100);
  const antes = await texto.inputValue();
  const hash = await page.evaluate(() => location.hash);
  await page.locator('.meta button:has-text("Ver en protoboard")').click();
  await listo(page);
  // Change the board a lot: delete a resistor.
  const c = await page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.centro('R1'));
  await page.mouse.click(c![0], c![1]);
  await page.keyboard.press('Delete');
  expect((await pbDe(page)).piezas.some((p) => p.nombre === 'R1')).toBe(false);
  // «Atrás» closes it too.
  await page.goBack();
  await expect(page.locator('.capa-protoboard')).toHaveCount(0);
  expect(await page.evaluate(() => location.hash)).toBe(hash);
  expect(await texto.inputValue()).toBe(antes);

  await page.goto('/#/editor/libro/cap05/sec-5.3_led_150ohm');
  await page.waitForFunction(() => ((window as unknown as { __epaEditor?: { ed: { doc: { componentes: unknown[] } } } }).__epaEditor?.ed.doc.componentes.length ?? 0) > 2, null, { timeout: 30_000 });
  const doc = () => page.evaluate(() => JSON.stringify((window as unknown as { __epaEditor: { ed: { doc: unknown } } }).__epaEditor.ed.doc));
  const d0 = await doc();
  await page.locator('button:has-text("Ver en protoboard")').first().click();
  await listo(page);
  const c2 = await page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.centro('R2'));
  await page.mouse.click(c2![0], c2![1]);
  await page.keyboard.press('Delete');
  await cerrar(page);
  expect(await doc()).toBe(d0);
});

test('guardar como montaje propio y la pestaña «Protoboard»', async ({ page }) => {
  await abrirLibre(page, LED);
  await page.locator('.capa-protoboard button:has-text("Guardar")').click();
  await expect(page.locator('.capa-protoboard header.cab')).toContainText('Guardado en «Mis montajes»');
  await page.locator('.capa-protoboard button:has-text("Abrirlo")').click();
  await expect(page.locator('.capa-protoboard')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/protoboard\/m/);
  await listo(page);
  expect((await pbDe(page)).piezas.map((p) => p.nombre).sort()).toEqual(['D1', 'R1', 'V1']);
  // Kept after a reload, listed in «Mis montajes».
  await page.reload();
  await listo(page);
  await page.locator('button:has-text("Mis montajes")').click();
  await expect(page.locator('.lista li')).toHaveCount(1);
  // An empty board: add a resistor from the palette and a jumper with the wire tool.
  await page.goto('/#/protoboard');
  await listo(page);
  await page.locator('button:has-text("Nuevo")').click();
  await page.locator('.pestanas button:has-text("Añadir")').click();
  await page.locator('.paleta [data-tipo="R"]').click();
  await expect.poll(async () => (await pbDe(page)).piezas.length).toBe(2);
  const r = await pbDe(page);
  const res = r.piezas.find((p) => p.enc === 'resistencia')!;
  const a = await huecoLibre(page, [20, 5], 6);
  const [x, y] = res.pos[0]!;
  await page.locator('.herramientas button[aria-label="Cable"]').click();
  const pa = await page.evaluate(([x0, y0]) => (window as unknown as Ventana).__epaProtoboard!.pantalla(x0, y0), [x, y - 1 >= 3 ? y - 1 : y + 1] as P);
  const pb2 = await page.evaluate(([x0, y0]) => (window as unknown as Ventana).__epaProtoboard!.pantalla(x0, y0), a);
  await page.mouse.click(pa[0], pa[1]);
  await page.mouse.click(pb2[0], pb2[1]);
  expect((await pbDe(page)).cables).toBe(r.cables + 1);
  expect((await pbDe(page)).netlist).toMatch(/^R1 /m);
});

// ------------------------------------------------------------------ logic: 74HC chips

test('las puertas lógicas se montan en chips 74HC reales, con su alimentación y las entradas libres a un carril', async ({ page }) => {
  test.setTimeout(150_000);
  await abrirNetlist(page, 'cap29/sec-29.2-or-con-nand');
  const r = await pbDe(page);
  // Three NAND in a 74HC00, the OR in a 74HC32; the ADC and DAC bridges (no real part) stay modules.
  const chips = r.piezas.filter((p) => p.modelo);
  expect(chips.map((p) => p.modelo).sort()).toEqual(['74HC00', '74HC32']);
  expect(chips.find((p) => p.modelo === '74HC00')!.puertas).toEqual(['An1', 'An2', 'An3']);
  expect(chips.every((p) => p.enc === 'dip' && p.pos.length === 14)).toBe(true);
  expect(r.piezas.filter((p) => p.enc === 'modulo').map((p) => p.nombre).sort()).toEqual(['Aad', 'Ada']);
  expect(r.problemas).toEqual([]);
  expect(r.obs).toContain('bien: El montaje corresponde al esquema original.');
  // The netlist keeps the XSPICE digital models.
  expect(r.netlist).toMatch(/^An1 \[\S+ \S+\] \S+ nand8$/m);
  expect(r.netlist).toMatch(/^Aor \[\S+ \S+\] \S+ or8$/m);
  expect(r.netlist).toMatch(/^\.model nand8 d_nand/m);
  expect(r.errores).toEqual([]);
  // Vcc (14) on the red rail and GND (7) on the blue one; the chip's pinout in the «Pieza» tab.
  const c = await page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.centro('CI2'));
  await page.mouse.click(c![0], c![1]);
  await page.locator('.pestanas button:has-text("Pieza")').click();
  const dip = page.locator('.dip');
  await expect(dip).toContainText('74HC32');
  await expect(dip).toContainText('Vcc');
  await expect(dip).toContainText('GND');
  await expect(dip).toContainText('libre → −');
  // Pull out the wire tying a spare input of the 74HC32: the floating CMOS input is named.
  const cable = await page.evaluate(() => {
    const g = (window as unknown as Ventana).__epaProtoboard!;
    const p = g.pb.doc.piezas.find((x) => x.comp.nombre === 'CI2')!;
    const i = p.chip!.roles.findIndex((rol, k) => rol === 'in' && !p.patas[k]);
    const [x, y] = p.pos[i]!;
    const tira = (q: P) => q[0] === x && (y <= 7 ? q[1] >= 3 && q[1] <= 7 : q[1] >= 10 && q[1] <= 14);
    return g.pb.doc.cables.find((w) => tira(w.a) || tira(w.b))?.id ?? null;
  });
  expect(cable).not.toBeNull();
  await page.evaluate((id) => ((window as unknown as Ventana).__epaProtoboard!.pb.sel = [id]), cable!);
  await page.keyboard.press('Delete');
  const r2 = await pbDe(page);
  expect(r2.obs.some((o) => /^aviso: CI2 \(74HC32\): la entrada de la patilla \d+ está al aire\. Una entrada CMOS al aire/.test(o) || /^aviso: CI2 \(74HC32\): las entradas de las patillas .* están al aire/.test(o))).toBe(true);
  // The simulation does not change: the tie is not in the netlist.
  expect(r2.netlist).toBe(r.netlist);
  await page.locator('.pestanas button:has-text("Avisos")').click();
  await expect(page.locator('.avisos li.aviso').filter({ hasText: 'CMOS' })).toBeVisible();
  await page.keyboard.press('Control+z');
  expect((await pbDe(page)).obs.some((o) => /CMOS/.test(o))).toBe(false);
});

test('el contador asíncrono: cada biestable T es un 74HC74 con una XOR del 74HC86 y, simulado desde la placa, cuenta hacia arriba', async ({ page }) => {
  test.setTimeout(240_000);
  await abrirNetlist(page, 'cap29/sec-29.7-contador-asincrono');
  const r = await pbDe(page);
  expect(r.piezas.filter((p) => p.modelo).map((p) => p.modelo).sort()).toEqual(['74HC4078', '74HC74', '74HC74', '74HC74', '74HC74', '74HC86', '74HC86']);
  expect(r.problemas).toEqual([]);
  expect(r.obs).toContain('bien: El montaje corresponde al esquema original.');
  // The netlist keeps the book's d_tff lines.
  expect(r.netlist).toMatch(/^A0 hi clkd NULL NULL q0 nq0 tff10$/m);
  expect(r.netlist).toMatch(/^A7 hi nq6 NULL NULL q7 nq7 tff10$/m);
  // Edge 128 (0111 1111 → 1000 0000): bit 0 falls 10 ns after it and bit 7 rises 80 ns after: it counts up.
  await page.locator('.herramientas button:has-text("Simular")').click();
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboardSim, null, { timeout: 120_000 });
  const salida = await page.evaluate(() => (window as unknown as Ventana).__epaProtoboardSim!.salida);
  expect(salida.errores).toEqual([]);
  expect(salida.texto).toMatch(/r_b0\s*=\s*1\.00\d*e\+0?1/);
  expect(salida.texto).toMatch(/r_b7\s*=\s*8\.00\d*e\+0?1/);
  // Pull out the wire from an XOR's output to its D: the checker names it; the netlist does not change.
  const cable = await page.evaluate(() => {
    const g = (window as unknown as Ventana).__epaProtoboard!;
    const p = g.pb.doc.piezas.find((x) => x.comp.campos['modelo'] === '74HC86')!;
    const i = p.chip!.roles.findIndex((rol, k) => rol === 'out' && !p.patas[k] && typeof p.chip!.ataduras[k] === 'object');
    const [x, y] = p.pos[i]!;
    const tira = (q: P) => q[0] === x && (y <= 7 ? q[1] >= 3 && q[1] <= 7 : q[1] >= 10 && q[1] <= 14);
    return g.pb.doc.cables.find((w) => tira(w.a) || tira(w.b))?.id ?? null;
  });
  expect(cable).not.toBeNull();
  await page.evaluate((id) => ((window as unknown as Ventana).__epaProtoboard!.pb.sel = [id]), cable!);
  await page.keyboard.press('Delete');
  const r2 = await pbDe(page);
  expect(r2.obs.some((o) => /^aviso: Falta el cable entre la salida de la XOR \(patilla \d+ del CI\d\) y D del biestable T A\d \(patilla \d+ del CI\d\)/.test(o))).toBe(true);
  expect(r2.netlist).toBe(r.netlist);
});

test('una puerta añadida a mano llega en su chip y avisa de lo que falta por cablear', async ({ page }) => {
  await page.goto('/#/protoboard');
  await listo(page);
  await page.locator('button:has-text("Nuevo")').click();
  await page.locator('.pestanas button:has-text("Añadir")').click();
  await page.locator('.paleta [data-tipo="DNAND"]').click();
  await expect.poll(async () => (await pbDe(page)).piezas.length).toBe(2);
  const r = await pbDe(page);
  const chip = r.piezas.find((p) => p.modelo)!;
  expect(chip.modelo).toBe('74HC00');
  expect(r.obs.some((o) => /^aviso: CI1 \(74HC00\) no está alimentado/.test(o))).toBe(true);
  expect(r.obs.some((o) => /^aviso: CI1 \(74HC00\): las entradas de las patillas 1, 2, 4, 5, 9, 10, 12 y 13 están al aire/.test(o))).toBe(true);
  expect(r.netlist).toMatch(/^A\S+ \[\S+ \S+\] \S+ \S+_mod$/m);
});

test('la entrada «Protoboard» del menú de herramientas abre la protoboard', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('/#/simulador');
  await page.locator('[data-herramienta="mas"]').click();
  const item = page.locator('[role="menu"] [data-herramienta="protoboard"]');
  await expect(item).toHaveText(/Protoboard/);
  await item.click();
  await expect(page).toHaveURL(/#\/protoboard$/);
  await listo(page);
  await expect(page.locator('.barra')).toContainText('Protoboard');
  await ctx.close();
});

// ------------------------------------------------------------------ touch

async function contextoTactil(browser: Browser, ancho: number, alto: number) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp };
}
async function toques(cdp: CDPSession, tipo: 'touchStart' | 'touchMove' | 'touchEnd', puntos: P[]) {
  await cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: puntos.map(([x, y], id) => ({ x, y, id })) });
}
async function arrastreTactil(page: Page, cdp: CDPSession, de: P, a: P) {
  await toques(cdp, 'touchStart', [de]);
  for (let k = 1; k <= 8; k++) await toques(cdp, 'touchMove', [[de[0] + ((a[0] - de[0]) * k) / 8, de[1] + ((a[1] - de[1]) * k) / 8]]);
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(80);
}

for (const [ancho, alto] of [
  [412, 915],
  [800, 1280],
] as const) {
  test(`táctil a ${ancho} px: tocar, arrastrar una pieza, desplazar y pellizcar`, async ({ browser }) => {
    test.setTimeout(150_000);
    const { ctx, page, cdp } = await contextoTactil(browser, ancho, alto);
    await abrirLibre(page, LED);
    const mesa = await page.locator('.mesa').boundingBox();
    expect(mesa!.width).toBeLessThanOrEqual(ancho);
    // Tap selects the bench supply; a finger drag moves it (its leads follow).
    const r0 = await pbDe(page);
    const v1 = r0.piezas.find((p) => p.nombre === 'V1')!;
    const c = await page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.centro('V1'));
    await page.touchscreen.tap(c![0], c![1]);
    await page.waitForTimeout(100);
    expect((await pbDe(page)).sel).toEqual([v1.id]);
    const s = await page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.escala());
    await arrastreTactil(page, cdp, c!, [c![0] + 9 * s, c![1]]);
    const r1 = await pbDe(page);
    expect(r1.piezas.find((p) => p.nombre === 'V1')!.pos[0]![0]).toBe(v1.pos[0]![0] + 9);
    expect(r1.problemas).toEqual([]);
    // A finger on empty bench pans; two fingers zoom the bench, never the page.
    const vacio: P = [mesa!.x + mesa!.width - 10, mesa!.y + mesa!.height - 40];
    const antes = await page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.pantalla(0, 0));
    await arrastreTactil(page, cdp, vacio, [vacio[0] - 60, vacio[1] - 30]);
    const despues = await page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.pantalla(0, 0));
    expect(Math.round(despues[0] - antes[0])).toBe(-60);
    const cx = mesa!.x + mesa!.width / 2;
    const cy = mesa!.y + mesa!.height / 2;
    await toques(cdp, 'touchStart', [[cx - 40, cy], [cx + 40, cy]]);
    for (let k = 1; k <= 6; k++) await toques(cdp, 'touchMove', [[cx - 40 - k * 12, cy], [cx + 40 + k * 12, cy]]);
    await toques(cdp, 'touchEnd', []);
    const s2 = await page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.escala());
    expect(s2).toBeGreaterThan(s * 1.5);
    expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
    await ctx.close();
  });
}

// ------------------------------------------------------------------ screenshots

const CIRCUITOS: { nombre: string; abrir: (page: Page) => Promise<void> }[] = [
  { nombre: 'led', abrir: (page) => abrirNetlist(page, 'cap17/led-150') },
  { nombre: 'transistor', abrir: (page) => abrirNetlist(page, 'cap42/fig-42.3_op_emisor_comun') },
  { nombre: 'operacional', abrir: (page) => abrirNetlist(page, 'cap27/fig-27.7') },
  { nombre: '555', abrir: (page) => abrirLibre(page, ASTABLE_555) },
  { nombre: 'logica', abrir: (page) => abrirNetlist(page, 'cap29/sec-29.2-or-con-nand') },
  { nombre: 'contador', abrir: (page) => abrirNetlist(page, 'cap29/sec-29.7-contador-asincrono') },
];

for (const [disp, ancho, alto] of [
  ['tableta', 800, 1280],
  ['movil', 412, 915],
] as const) {
  for (const tema of ['claro', 'oscuro'] as const) {
    test(`capturas ${disp} ${tema}`, async ({ browser }) => {
      test.setTimeout(240_000);
      fs.mkdirSync(CAPTURAS, { recursive: true });
      const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 2, isMobile: ancho < 500, hasTouch: true, colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
      const page = await ctx.newPage();
      for (const c of CIRCUITOS) {
        await c.abrir(page);
        if (c.nombre === '555' || c.nombre === 'led') {
          await page.locator('.herramientas button:has-text("Simular")').click();
          await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboardSim, null, { timeout: 120_000 });
          await page.waitForTimeout(1200);
          await page.evaluate(() => delete (window as unknown as Ventana).__epaProtoboardSim);
          await page.locator('.pestanas button:has-text("Esquema")').click();
        }
        if (c.nombre === 'logica' || c.nombre === 'contador') {
          // The 74HC00 (or the counter's first 74HC86) chosen: its pinout in the «Pieza» tab.
          const q = await page.evaluate((n) => (window as unknown as Ventana).__epaProtoboard!.centro(n), c.nombre === 'logica' ? 'CI1' : 'CI2');
          await page.mouse.click(q![0], q![1]);
          await page.locator('.pestanas button:has-text("Pieza")').click();
        }
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${CAPTURAS}/${c.nombre}-${disp}-${tema}.png` });
        await cerrar(page);
      }
      await ctx.close();
    });
  }
}
