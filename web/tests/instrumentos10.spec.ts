// Instruments on the user's own circuits (0.10): on the breadboard («Medir»: the Brymen BM869s, the FNIRSI
// 2C53T and an earphone, leads into holes) with the «¿Qué quieres medir?» tutor (each step detected as the
// user does it with the real controls, mistakes explained, the final reading right), the oscilloscope on a
// 555, the generator driving an RC, listening, touch at 412 and 800 px, the editor's «Medir», and screenshots
// in tests/capturas/instrumentos10/.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.protoboard10.config.ts tests/instrumentos10.spec.ts
import fs from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';

type P = [number, number];
const CAPTURAS = 'tests/capturas/instrumentos10';

interface Ventana {
  __epaProtoboard?: {
    pb: {
      doc: { piezas: { id: string; enc: string; comp: { nombre: string }; pos: P[] }[]; cables: { id: string; a: P; b: P }[] };
      moverPata: (id: string, i: number, q: P) => boolean;
      sel: string[];
    };
    pantalla: (x: number, y: number) => P;
    centro: (nombre: string) => P | null;
  };
  __epaMedida?: {
    medida: { puntas: Record<string, P>; activa: string | null; nodoEn: (q: P) => string | null };
    tutor: { tarea: string | null; actual: number; terminado: boolean; explicacion: string; pasos: { id: string; puntos?: () => P[] }[] };
    b: {
      alimentado: boolean;
      avisoFusible: string;
      version: number;
      brymen: { pantalla: { principal: { texto: string; valor: number | null; unidad: string; ol: boolean } | null }; borne: string; fusibleMA: boolean };
      fnirsi: { modo: string; sDiv: number; medidas: (k: number) => { f: number | null; vpp: number; vmedia: number } | null; dds: { frecuencia: number; amplitud: number; forma: string; salida: boolean } };
    };
  };
  __epaAuricular?: { nivel: () => number };
}

const DIVISOR = `* Divisor de tensión
V1 in 0 DC 9
R1 in out 1k
R2 out 0 2k
.op
.end
`;

const ASTABLE_555 = `* Astable con 555
V1 vcc 0 DC 9
RA vcc dis 1k
RB dis thr 10k
C1 thr 0 100n
X1 0 thr out vcc ctl thr dis vcc ne555
RL out 0 10k
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
.tran 10u 20m
.end
`;

const RC = `* Filtro RC
R1 a b 1k
C1 b 0 1u
RX a 0 1meg
.op
.end
`;

async function abrirLibre(page: Page, texto: string) {
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('epa:circuito', t), texto);
  await page.goto('/#/simulador/nuevo');
  const b = page.locator('.meta button:has-text("Ver en protoboard")');
  await expect(b).toBeVisible({ timeout: 30_000 });
  await b.click();
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
  await page.waitForTimeout(300);
}

async function abrirMedir(page: Page) {
  await page.locator('.pestanas button:has-text("Medir")').click();
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaMedida, null, { timeout: 30_000 });
}

const W = (page: Page) => page.evaluate(() => 1);
void W;

/** Screen point of a board point. */
const pantalla = (page: Page, q: P) => page.evaluate(([x, y]) => (window as unknown as Ventana).__epaProtoboard!.pantalla(x, y), q);

/** Taps a board point (mouse click, or a finger). */
async function tocar(page: Page, q: P, dedo = false) {
  const [x, y] = await pantalla(page, q);
  if (dedo) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await page.waitForTimeout(120);
}

/** Taps a piece by its name. */
async function tocarPieza(page: Page, nombre: string, dedo = false) {
  const c = await page.evaluate((n) => (window as unknown as Ventana).__epaProtoboard!.centro(n), nombre);
  if (dedo) await page.touchscreen.tap(c![0], c![1]);
  else await page.mouse.click(c![0], c![1]);
  await page.waitForTimeout(120);
}

/** The holes the tutor lights for the current step. */
const puntosGuia = (page: Page) =>
  page.evaluate(() => {
    const t = (window as unknown as Ventana).__epaMedida!.tutor;
    return t.pasos[t.actual]?.puntos?.() ?? [];
  });

const pasoActual = (page: Page) => page.evaluate(() => {
  const t = (window as unknown as Ventana).__epaMedida!.tutor;
  return t.actual < 0 ? 'fin' : t.pasos[t.actual]!.id;
});

const lecturaBm = (page: Page) => page.evaluate(() => (window as unknown as Ventana).__epaMedida!.b.brymen.pantalla.principal);

/** Waits for the Brymen to show a value near `v` (SI). */
async function esperarBm(page: Page, v: number, tol: number) {
  await expect
    .poll(async () => {
      const l = await lecturaBm(page);
      return l?.valor ?? null;
    }, { timeout: 60_000 })
    .not.toBeNull();
  await expect.poll(async () => Math.abs(((await lecturaBm(page))?.valor ?? NaN) - v) <= tol, { timeout: 60_000 }).toBe(true);
}

/** A leg's position on the board. */
const patas = (page: Page, nombre: string) =>
  page.evaluate((n) => (window as unknown as Ventana).__epaProtoboard!.pb.doc.piezas.find((p) => p.comp.nombre === n)!.pos, nombre);

/** A free hole on a net (strips and rails). */
const huecoDe = (page: Page, red: string) =>
  page.evaluate((r) => {
    const g = (window as unknown as Ventana).__epaProtoboard!;
    const m = (window as unknown as Ventana).__epaMedida!.medida;
    const oc = new Set<string>();
    for (const p of g.pb.doc.piezas) for (const q of p.pos) oc.add(q.join(','));
    for (const w of g.pb.doc.cables) for (const q of [w.a, w.b]) oc.add(q.join(','));
    for (const q of Object.values(m.puntas)) oc.add(q.join(','));
    for (let y = 0; y <= 17; y++) for (let x = 1; x <= 30; x++) if (!oc.has(`${x},${y}`) && m.nodoEn([x, y]) === r) return [x, y] as P;
    return null;
  }, red);

/** Shows the FNIRSI when the instruments are in tabs (narrow panel). */
async function verFnirsi(page: Page) {
  const t = page.locator('.aparatos .pestanas button', { hasText: 'FNIRSI' });
  if (await t.isVisible()) await t.click();
}

/** A free hole of the ground rail. */
const huecoMasa = (page: Page) =>
  page.evaluate(() => {
    const g = (window as unknown as Ventana).__epaProtoboard!;
    const m = (window as unknown as Ventana).__epaMedida!.medida;
    const oc = new Set<string>();
    for (const p of g.pb.doc.piezas) for (const q of p.pos) oc.add(q.join(','));
    for (const w of g.pb.doc.cables) for (const q of [w.a, w.b]) oc.add(q.join(','));
    for (const y of [1, 16]) for (let x = 2; x < 30; x++) if (!oc.has(`${x},${y}`) && m.nodoEn([x, y]) === '0') return [x, y] as P;
    return null;
  });

// ------------------------------------------------------------------ the tutor, step by step

test('tutor «Tensión de una pieza»: cada paso se detecta al hacerlo y la lectura es la de la simulación', async ({ page }) => {
  test.setTimeout(180_000);
  await abrirLibre(page, DIVISOR);
  await abrirMedir(page);
  await page.locator('[data-tarea="tensionPieza"]').click();
  expect(await pasoActual(page)).toBe('pieza');
  await tocarPieza(page, 'R2');
  // The dial is already on V⎓ and the red lead in ΩV (the Brymen's defaults): those steps are ticked.
  expect(await pasoActual(page)).toBe('roja');
  // A mistake first: the red lead in the A jack → explained, with what to do.
  await page.locator('svg.brymen [aria-label="Mover la punta roja al borne A"]').click();
  expect(await pasoActual(page)).toBe('borne');
  await expect(page.locator('.error-medida', { hasText: 'casi un cable' })).toBeVisible();
  await page.locator('.error-medida button', { hasText: 'Punta roja a ΩV' }).click();
  expect(await pasoActual(page)).toBe('roja');
  const [r] = await puntosGuia(page);
  await tocar(page, r!);
  expect(await pasoActual(page)).toBe('negra');
  const [n] = await puntosGuia(page);
  await tocar(page, n!);
  expect(await pasoActual(page)).toBe('fin');
  // 9 V × 2k/3k = 6 V, loaded by the meter's 10 MΩ.
  await esperarBm(page, 6, 0.01);
  await expect(page.locator('[data-explicacion]')).toContainText(/El Brymen marca [56],\d{3} V: la tensión en R2/);
});

test('tutor «Corriente por una pieza»: abrir el circuito y el polímetro en serie', async ({ page }) => {
  test.setTimeout(180_000);
  await abrirLibre(page, DIVISOR);
  await abrirMedir(page);
  await page.locator('[data-tarea="corriente"]').click();
  await tocarPieza(page, 'R2');
  expect(await pasoActual(page)).toBe('selector');
  await page.locator('svg.brymen [aria-label="Selector en A mA"]').click();
  expect(await pasoActual(page)).toBe('borne');
  await page.locator('svg.brymen [aria-label="Mover la punta roja al borne mA µA"]').click();
  expect(await pasoActual(page)).toBe('abrir');
  // Open the circuit by dragging a leg of R2 to the lit empty strip.
  const [destino] = await puntosGuia(page);
  const pos = await patas(page, 'R2');
  const pata = [...pos].filter((q) => q[1] === destino![1]).sort((u, v) => Math.abs(u[0] - destino![0]) - Math.abs(v[0] - destino![0]))[0]!;
  await tocarPieza(page, 'R2');
  const a = await pantalla(page, pata);
  const b = await pantalla(page, destino!);
  await page.mouse.move(a[0], a[1]);
  await page.mouse.down();
  await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { steps: 4 });
  await page.mouse.move(b[0], b[1], { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => pasoActual(page)).toBe('roja');
  await tocar(page, (await puntosGuia(page))[0]!);
  await tocar(page, (await puntosGuia(page))[0]!);
  expect(await pasoActual(page)).toBe('fin');
  // 9 V / 3 kΩ = 3 mA (the shunt adds 3,3 Ω).
  await esperarBm(page, 3e-3, 0.02e-3);
  await expect(page.locator('[data-explicacion]')).toContainText('la corriente que pasa por R2');
});

test('tutor «Resistencia de una pieza» con «Hazlo por mí»: los pasos uno a uno, sin alimentación', async ({ page }) => {
  test.setTimeout(180_000);
  await abrirLibre(page, DIVISOR);
  await abrirMedir(page);
  await page.locator('[data-tarea="resistencia"]').click();
  // «Hazlo por mí» cannot choose the piece: it is not offered until the user does.
  await expect(page.locator('.acciones-tutor button', { hasText: 'Hazlo por mí' })).toHaveCount(0);
  await tocarPieza(page, 'R2');
  expect(await pasoActual(page)).toBe('apagar');
  const vistos: string[] = [];
  const t0 = Date.now();
  await page.locator('.acciones-tutor button', { hasText: 'Hazlo por mí' }).click();
  // The steps are done one after another (not all at once): the current step changes over time.
  while (Date.now() - t0 < 15_000) {
    const p = await pasoActual(page);
    if (vistos[vistos.length - 1] !== p) vistos.push(p);
    if (p === 'fin') break;
    await page.waitForTimeout(100);
  }
  // (the first step, power off, is done at the tap; the red lead was already in ΩV)
  expect(vistos).toEqual(['selector', 'roja', 'negra', 'fin']);
  expect(vistos[vistos.length - 1]).toBe('fin');
  expect(await page.evaluate(() => (window as unknown as Ventana).__epaMedida!.b.alimentado)).toBe(false);
  await esperarBm(page, 666.67, 1);
  await expect(page.locator('[data-explicacion]')).toContainText('la resistencia entre las patas de R2');
});

test('errores explicados: amperímetro en paralelo (fusible, «Ponerlo en serie») y óhmetro con alimentación', async ({ page }) => {
  test.setTimeout(180_000);
  await abrirLibre(page, DIVISOR);
  await abrirMedir(page);
  // Ammeter across the supply by hand.
  await page.locator('svg.brymen [aria-label="Selector en A mA"]').click();
  await page.locator('svg.brymen [aria-label="Mover la punta roja al borne mA µA"]').click();
  await page.locator('.mano summary').click();
  await page.locator('[data-punta="bmRojo"]').click();
  await tocar(page, (await huecoDe(page, 'in'))!);
  await page.locator('[data-punta="bmNegro"]').click();
  await tocar(page, (await huecoMasa(page))!);
  await expect(page.locator('.error-medida', { hasText: 'fundido' })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.error-medida', { hasText: 'Un amperímetro se pone en serie' })).toBeVisible();
  await page.locator('.error-medida button', { hasText: 'Ponerlo en serie' }).click();
  expect(await page.evaluate(() => (window as unknown as Ventana).__epaMedida!.tutor.tarea)).toBe('corriente');
  expect(await page.evaluate(() => (window as unknown as Ventana).__epaMedida!.b.brymen.fusibleMA)).toBe(true);

  // Ohmmeter on the powered circuit: explained, «Medir sin alimentación».
  await page.locator('.acciones-tutor button', { hasText: 'Dejarlo' }).click();
  await page.locator('svg.brymen [aria-label="Mover la punta roja al borne ΩV⊣⊢"]').click();
  await page.locator('svg.brymen [aria-label="Selector en Ω ·)))"]').click();
  const r2 = await patas(page, 'R2');
  await page.locator('[data-punta="bmRojo"]').click();
  await tocar(page, r2[0]!);
  await page.locator('[data-punta="bmNegro"]').click();
  await tocar(page, r2[1]!);
  await expect(page.locator('.error-medida', { hasText: 'con el circuito alimentado' })).toBeVisible({ timeout: 30_000 });
  await page.locator('.error-medida button', { hasText: 'Medir sin alimentación' }).click();
  expect(await page.evaluate(() => (window as unknown as Ventana).__epaMedida!.b.alimentado)).toBe(false);
  // R2 with R1 in parallel through the (off) source: 2k ‖ 1k.
  await esperarBm(page, 666.67, 1);
});

test('tutor «Ver la señal en un punto»: el 555 en el osciloscopio con AUTO, a su frecuencia', async ({ page }) => {
  test.setTimeout(240_000);
  await abrirLibre(page, ASTABLE_555);
  await abrirMedir(page);
  await page.locator('[data-tarea="senal"]').click();
  // The FNIRSI starts in oscilloscope mode: the first step is ticked.
  expect(await pasoActual(page)).toBe('masa');
  await tocar(page, (await puntosGuia(page))[0]!);
  expect(await pasoActual(page)).toBe('ch1');
  const rl = await patas(page, 'RL');
  const out = await page.evaluate((qs) => qs.find((q) => (window as unknown as Ventana).__epaMedida!.medida.nodoEn(q) === 'out')!, rl);
  await tocar(page, out);
  expect(await pasoActual(page)).toBe('auto');
  // A mismatched probe would be explained (×10 probe, ×1 channel): not the case here.
  await expect(page.locator('.error-medida', { hasText: 'diez veces' })).toHaveCount(0);
  await page.waitForFunction(() => ((window as unknown as Ventana).__epaMedida?.b.version ?? 0) > 0, null, { timeout: 120_000 });
  await page.locator('.fnirsi [aria-label="AUTO: ajuste automático de escalas y disparo"]').click();
  await expect.poll(() => pasoActual(page), { timeout: 10_000 }).toBe('fin');
  // 1,44/((RA + 2 RB) C) ≈ 686 Hz.
  await expect
    .poll(async () => (await page.evaluate(() => (window as unknown as Ventana).__epaMedida!.b.fnirsi.medidas(0)?.f ?? 0)), { timeout: 120_000 })
    .toBeGreaterThan(640);
  const f = await page.evaluate(() => (window as unknown as Ventana).__epaMedida!.b.fnirsi.medidas(0)!.f!);
  expect(f).toBeLessThan(740);
  await expect(page.locator('[data-explicacion]')).toContainText('Hz');
});

test('el generador del FNIRSI alimenta un filtro RC por sus puntas', async ({ page }) => {
  test.setTimeout(240_000);
  await abrirLibre(page, RC);
  await abrirMedir(page);
  await page.locator('.mano summary').click();
  const r1 = await patas(page, 'R1');
  const c1 = await patas(page, 'C1');
  const a = await page.evaluate((qs) => qs.find((q) => (window as unknown as Ventana).__epaMedida!.medida.nodoEn(q) === 'a')!, r1);
  const b = await page.evaluate((qs) => qs.find((q) => (window as unknown as Ventana).__epaMedida!.medida.nodoEn(q) === 'b')!, c1);
  const lado = (q: P): P => [q[0], q[1] <= 7 ? (q[1] === 3 ? 4 : 3) : q[1] === 14 ? 13 : 14];
  await page.locator('[data-punta="genRojo"]').click();
  await tocar(page, lado(a));
  await page.locator('[data-punta="genNegro"]').click();
  await tocar(page, (await huecoMasa(page))!);
  await page.locator('[data-punta="ch1"]').click();
  await tocar(page, lado(b));
  await page.waitForFunction(() => ((window as unknown as Ventana).__epaMedida?.b.version ?? 0) > 0, null, { timeout: 120_000 });
  await verFnirsi(page);
  await page.locator('.fnirsi [aria-label="AUTO: ajuste automático de escalas y disparo"]').click();
  // A 1 kHz square of 0–3 V through τ = 1 ms: about 0,73 V peak to peak at the capacitor.
  await expect
    .poll(async () => (await page.evaluate(() => (window as unknown as Ventana).__epaMedida!.b.fnirsi.medidas(0)?.f ?? 0)), { timeout: 120_000 })
    .toBeGreaterThan(950);
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as Ventana).__epaMedida!.b.fnirsi.medidas(0)?.vpp ?? 0)), { timeout: 60_000 }).toBeGreaterThan(0.62);
  const m = await page.evaluate(() => (window as unknown as Ventana).__epaMedida!.b.fnirsi.medidas(0)!);
  expect(m.f!).toBeLessThan(1050);
  expect(m.vpp).toBeGreaterThan(0.62);
  expect(m.vpp).toBeLessThan(0.86);
});

test('escuchar un punto: el 555 suena por el altavoz', async ({ page }) => {
  test.setTimeout(240_000);
  await abrirLibre(page, ASTABLE_555);
  await abrirMedir(page);
  await page.locator('[data-tarea="escuchar"]').click();
  const rl = await patas(page, 'RL');
  const out = await page.evaluate((qs) => qs.find((q) => (window as unknown as Ventana).__epaMedida!.medida.nodoEn(q) === 'out')!, rl);
  await tocar(page, out);
  expect(await pasoActual(page)).toBe('oir');
  await page.locator('.escuchar button', { hasText: 'Escuchar auricular' }).click();
  await expect(page.locator('.escuchar .estado')).toContainText('Un tono de', { timeout: 150_000 });
  await expect.poll(() => page.evaluate(() => (window as unknown as Ventana).__epaAuricular!.nivel()), { timeout: 10_000 }).toBeGreaterThan(0.01);
  // Leaving the view stops it.
  await page.locator('.escuchar button', { hasText: 'Parar' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as Ventana).__epaAuricular!.nivel()), { timeout: 10_000 }).toBeLessThan(0.001);
});

// ------------------------------------------------------------------ touch

async function contextoTactil(browser: Browser, ancho: number, alto: number, oscuro = false) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 2, isMobile: ancho < 500, hasTouch: true, colorScheme: oscuro ? 'dark' : 'light' });
  return { ctx, page: await ctx.newPage() };
}

for (const [ancho, alto] of [
  [412, 915],
  [800, 1280],
] as const) {
  test(`táctil a ${ancho} px: el tutor de tensión con los dedos y una punta arrastrada`, async ({ browser }) => {
    test.setTimeout(180_000);
    const { ctx, page } = await contextoTactil(browser, ancho, alto);
    await abrirLibre(page, DIVISOR);
    await abrirMedir(page);
    await page.locator('[data-tarea="tension"]').tap();
    await tocar(page, (await patas(page, 'R2'))[0]!, true);
    expect(await pasoActual(page)).toBe('negra');
    await tocar(page, (await huecoMasa(page))!, true);
    expect(await pasoActual(page)).toBe('fin');
    await esperarBm(page, 6, 0.01);
    // Drag the black probe to the + rail: 9 V − 6 V.
    const negra = await page.evaluate(() => (window as unknown as Ventana).__epaMedida!.medida.puntas['bmNegro']!);
    const destino = await page.evaluate(() => {
      const m = (window as unknown as Ventana).__epaMedida!.medida;
      for (const y of [0, 17]) for (let x = 2; x < 30; x++) if (m.nodoEn([x, y]) === 'in') return [x, y] as P;
      return null;
    });
    const a = await pantalla(page, negra);
    const b = await pantalla(page, destino!);
    const cdp = await ctx.newCDPSession(page);
    const t = (type: string, pts: P[]) => cdp.send('Input.dispatchTouchEvent', { type: type as 'touchStart', touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
    await t('touchStart', [a]);
    for (let k = 1; k <= 8; k++) await t('touchMove', [[a[0] + ((b[0] - a[0]) * k) / 8, a[1] + ((b[1] - a[1]) * k) / 8]]);
    await t('touchEnd', []);
    await esperarBm(page, -3, 0.01);
    expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
    await ctx.close();
  });
}

// ------------------------------------------------------------------ the editor's «Medir»

test('el editor abre su circuito en el banco con su propio dibujo', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/#/editor/libro/cap05/sec-5.3_led_150ohm');
  await page.waitForFunction(() => ((window as unknown as { __epaEditor?: { ed: { doc: { componentes: unknown[] } } } }).__epaEditor?.ed.doc.componentes.length ?? 0) > 2, null, { timeout: 30_000 });
  await page.locator('button:has-text("Medir")').first().click();
  await expect(page).toHaveURL(/#\/instrumentos\/editor$/);
  await expect(page.locator('.cabecera h1')).toContainText('Medir ·');
  await expect(page.locator('.cabecera a.atras')).toHaveText('← Editor');
  // The leads go on the nodes of the editor's own drawing.
  await expect(page.locator('.banco .lamina .auto svg')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.banco .estado')).toContainText('Simulado en', { timeout: 90_000 });
});

// ------------------------------------------------------------------ screenshots

for (const [disp, ancho, alto] of [
  ['tableta', 800, 1280],
  ['movil', 412, 915],
] as const) {
  for (const tema of ['claro', 'oscuro'] as const) {
    test(`capturas del tutor ${disp} ${tema}`, async ({ browser }) => {
      test.setTimeout(300_000);
      fs.mkdirSync(CAPTURAS, { recursive: true });
      const { ctx, page } = await contextoTactil(browser, ancho, alto, tema === 'oscuro');
      // The multimeter: «Corriente por una pieza», at the step «turn the dial».
      await abrirLibre(page, DIVISOR);
      await abrirMedir(page);
      await page.locator('[data-tarea="corriente"]').tap();
      await tocarPieza(page, 'R2', true);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${CAPTURAS}/polimetro-paso-${disp}-${tema}.png` });
      await page.locator('div.medir').evaluate((e) => e.closest('.contenido')?.scrollTo(0, 0));
      // The voltage, done.
      await page.locator('[data-tarea="tensionPieza"]').tap();
      await tocarPieza(page, 'R2', true);
      await tocar(page, (await puntosGuia(page))[0]!, true);
      await tocar(page, (await puntosGuia(page))[0]!, true);
      await esperarBm(page, 6, 0.01);
      await page.locator('[data-explicacion]').evaluate((e) => e.scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${CAPTURAS}/polimetro-${disp}-${tema}.png` });
      // The oscilloscope on the 555.
      await page.locator('.capa-protoboard button[aria-label="Cerrar y volver al esquema"]').click();
      await abrirLibre(page, ASTABLE_555);
      await abrirMedir(page);
      await page.locator('[data-tarea="senal"]').tap();
      await tocar(page, (await puntosGuia(page))[0]!, true);
      const rl = await patas(page, 'RL');
      const out = await page.evaluate((qs) => qs.find((q) => (window as unknown as Ventana).__epaMedida!.medida.nodoEn(q) === 'out')!, rl);
      await tocar(page, out, true);
      await page.waitForFunction(() => ((window as unknown as Ventana).__epaMedida?.b.version ?? 0) > 0, null, { timeout: 120_000 });
      await page.locator('.fnirsi [aria-label="AUTO: ajuste automático de escalas y disparo"]').tap();
      await expect
        .poll(async () => (await page.evaluate(() => (window as unknown as Ventana).__epaMedida!.b.fnirsi.medidas(0)?.f ?? 0)), { timeout: 120_000 })
        .toBeGreaterThan(600);
      await page.locator('canvas.pantalla').evaluate((e) => e.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${CAPTURAS}/osciloscopio-${disp}-${tema}.png` });
      await ctx.close();
    });
  }
}
