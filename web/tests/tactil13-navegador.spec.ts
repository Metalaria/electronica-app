// 1.3 (tactil13) precise placement with a finger, on the owner's phone (Pixel 8 Pro: 412 × 915 CSS px, DPR 3.5, touch),
// with real touches through CDP. The breadboard (componentes/protoboard/Mesa.svelte): a meter lead, a resistor's leg
// and a wire's end dragged by a finger land in exactly the hole shown — the one next to where they were, which a pick
// under the finger would miss (the thing rides 56 px above the finger) —, the loupe and the label name it («D13 · tira
// 13 de arriba») while dragging, a trembling finger on the border does not make it flicker, a phone with small holes
// zooms in while dragging and back on release, a short vibration marks the changes and the landing, the fine-adjust
// arrows move it one hole, and released off the holes (or with a second finger) it stays where it was. The lesson's
// schematic (cap01/sec-1.5, the multimeter card) and the instruments' bench (Plano.svelte) the same with nodes.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config with a server> tests/tactil13-navegador.spec.ts
import { expect, test, type Browser, type CDPSession, type Page } from '@playwright/test';

type P = [number, number];
const ELEVACION = 56;

interface Ventana {
  __epaProtoboard?: {
    pb: {
      doc: { piezas: { id: string; comp: { nombre: string }; pos: P[] }[]; cables: { id: string; a: P; b: P }[] };
      sel: string[];
      componente: (t: string, c?: Record<string, string>) => unknown;
      anadirEn: (x: unknown, pos: P[]) => { id: string } | null;
      anadirCable: (a: P, b: P) => { id: string } | null;
    };
    pantalla: (x: number, y: number) => P;
    escala: () => number;
  };
  __epaMedida?: { medida: { puntas: Record<string, P> } };
  __vib?: unknown[];
}

async function telefono(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true });
  await ctx.route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await ctx.addInitScript(() => {
    // (the vibrations, recorded)
    const w = window as unknown as Ventana;
    w.__vib = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (p: unknown) => (w.__vib!.push(p), true) });
    localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
    if (sessionStorage.getItem('tactil13')) return;
    sessionStorage.setItem('tactil13', '1');
    localStorage.removeItem('epa:protoboard-borrador');
    localStorage.setItem('epa:protoboard-recorrido', '1');
    localStorage.setItem('epa:protoboard-leccion', '1');
    localStorage.setItem('epa:medir-pista', 'vista');
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp };
}

const toques = (cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', puntos: P[]) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: puntos.map(([x, y], id) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });

/** A finger from `de` to `a` in steps (still down at the end). */
async function deslizar(page: Page, cdp: CDPSession, de: P, a: P, pasos = 10) {
  for (let k = 1; k <= pasos; k++) {
    await toques(cdp, 'touchMove', [[de[0] + ((a[0] - de[0]) * k) / pasos, de[1] + ((a[1] - de[1]) * k) / pasos]]);
    await page.waitForTimeout(16);
  }
}

const pantalla = (page: Page, q: P) => page.evaluate(([x, y]) => (window as unknown as Ventana).__epaProtoboard!.pantalla(x!, y!), q);
const escala = (page: Page) => page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.escala());
const vibraciones = (page: Page) => page.evaluate(() => ((window as unknown as Ventana).__vib ?? []).map((x) => JSON.stringify(x)));
/** The hole a plain pick under the finger would take (what the bench did before 1.3). */
const bajoElDedo = async (page: Page, dedo: P): Promise<P> =>
  page.evaluate(([x, y]) => {
    const e = (window as unknown as Ventana).__epaProtoboard!;
    const o = e.pantalla(0, 0);
    const s = e.escala();
    return [Math.round((x! - o[0]) / s), Math.round((y! - o[1]) / s)] as P;
  }, dedo);

async function abrirProtoboard(page: Page) {
  await page.goto('/#/protoboard');
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
  await page.waitForTimeout(400);
}

/**
 * Drags whatever is at board point `de` by a finger to board point `a`: the finger goes down on it, moves a little (the
 * drag starts, and on a phone with small holes the view zooms in), and then to `a` lifted by ELEVACION px — reading `a`'s
 * place on the screen after the zoom, as the eye does. Does not lift the finger; returns where the finger is.
 */
async function arrastrarHueco(page: Page, cdp: CDPSession, de: P, a: P): Promise<P> {
  const p0 = await pantalla(page, de);
  await toques(cdp, 'touchStart', [p0]);
  await page.waitForTimeout(30);
  await deslizar(page, cdp, p0, [p0[0], p0[1] + 16], 3);
  await page.waitForTimeout(350);
  const q = await pantalla(page, a);
  const dedo: P = [q[0], q[1] + ELEVACION];
  await deslizar(page, cdp, [p0[0], p0[1] + 16], dedo);
  await page.waitForTimeout(120);
  return dedo;
}

test('protoboard en el teléfono: una punta del polímetro al agujero de al lado, con lupa, nombre, zoom, vibración, flechas y cancelar', async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page, cdp } = await telefono(browser);
  await abrirProtoboard(page);
  await page.locator('[data-pestana="medir"]').first().tap();
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaMedida, null, { timeout: 30_000 });
  await page.waitForTimeout(600);
  const puntas = () => page.evaluate(() => ({ ...(window as unknown as Ventana).__epaMedida!.medida.puntas }));
  // the tap–tap flow still works: a tap on C12 puts the red lead there (no arrows after a tap: the next tap goes near)
  const s0 = await escala(page);
  expect(s0).toBeLessThan(20);
  const c12 = await pantalla(page, [12, 5]);
  await page.touchscreen.tap(c12[0], c12[1]);
  await page.waitForTimeout(250);
  expect((await puntas()).bmRojo).toEqual([12, 5]);
  await expect(page.locator('[data-ajuste-fino]')).toHaveCount(0);

  // drag it to B13 (one hole up and one right): the loupe and the label show it before release
  const dedo = await arrastrarHueco(page, cdp, [12, 5], [13, 4]);
  expect(await escala(page)).toBeCloseTo(30, 0);
  await expect(page.locator('[data-lupa]')).toBeVisible();
  await expect(page.locator('[data-destino]')).toHaveAttribute('data-destino', 'B13 · tira 13 de arriba');
  await expect(page.locator('[data-destino-hueco]')).toHaveAttribute('data-destino-hueco', '13,4');
  // a pick under the finger would be two rows lower (the finger is 56 px under the lead)
  const ingenuo = await bajoElDedo(page, dedo);
  expect(ingenuo).not.toEqual([13, 4]);
  // the finger trembles on the border between B13 and B14 (± an eighth of a hole): no flicker
  const s = await escala(page);
  const vib0 = (await vibraciones(page)).length;
  const borde = await pantalla(page, [13.5, 4]);
  for (const dx of [-0.12, 0.1, -0.08, 0.12, -0.1, 0.08]) {
    await toques(cdp, 'touchMove', [[borde[0] + dx * s, borde[1] + ELEVACION]]);
    await page.waitForTimeout(20);
    await expect(page.locator('[data-destino]')).toHaveAttribute('data-destino', 'B13 · tira 13 de arriba');
  }
  expect((await vibraciones(page)).length, 'una mano temblorosa en el borde no hace vibrar').toBe(vib0);
  await toques(cdp, 'touchMove', [dedo]);
  await page.waitForTimeout(60);
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(400);
  expect((await puntas()).bmRojo).toEqual([13, 4]);
  await expect(page.locator('[data-lupa]')).toHaveCount(0);
  // the view goes back; a tick for each hole crossed and the landing
  expect(await escala(page)).toBeCloseTo(s0, 3);
  const vib = await vibraciones(page);
  expect(vib.length).toBeGreaterThan(vib0);
  expect(vib[vib.length - 1]).toBe('[15]');

  // the fine-adjust arrows around it: one hole right, one down
  await expect(page.locator('[data-ajuste-fino] button').first()).toBeVisible();
  await page.locator('[data-ajuste="derecha"]').tap();
  expect((await puntas()).bmRojo).toEqual([14, 4]);
  await page.locator('[data-ajuste="abajo"]').tap();
  expect((await puntas()).bmRojo).toEqual([14, 5]);
  await expect(page.locator('[data-anuncio-mesa]')).toContainText('C14');

  // cancel: dragged off the holes (far above the board) it stays where it was
  await arrastrarHueco(page, cdp, [14, 5], [14, -6]);
  await expect(page.locator('[data-destino]')).toContainText('se queda donde estaba');
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(300);
  expect((await puntas()).bmRojo).toEqual([14, 5]);
  // cancel: a second finger while dragging
  const uno = await arrastrarHueco(page, cdp, [14, 5], [16, 5]);
  await expect(page.locator('[data-destino]')).toContainText('C16');
  await toques(cdp, 'touchStart', [uno, [uno[0] - 120, uno[1]]]);
  await page.waitForTimeout(60);
  await expect(page.locator('[data-lupa]')).toHaveCount(0);
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(300);
  expect((await puntas()).bmRojo).toEqual([14, 5]);
  await ctx.close();
});

test('protoboard en el teléfono: la pata de una resistencia y el extremo de un cable al agujero de al lado', async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page, cdp } = await telefono(browser);
  await abrirProtoboard(page);
  const ids = await page.evaluate(() => {
    const pb = (window as unknown as Ventana).__epaProtoboard!.pb;
    const r = pb.anadirEn(pb.componente('R', { valor: '1k' }), [
      [10, 4],
      [14, 4],
    ]);
    const w = pb.anadirCable([8, 11], [8, 16]);
    return { r: r!.id, w: w!.id };
  });
  await page.waitForTimeout(200);
  const estado = () =>
    page.evaluate((x) => {
      const pb = (window as unknown as Ventana).__epaProtoboard!.pb;
      return { r: pb.doc.piezas.find((p) => p.id === x.r)!.pos, w: pb.doc.cables.find((c) => c.id === x.w)! };
    }, ids);
  // the resistor selected by a tap on its body: its legs' handles
  const cuerpo = await pantalla(page, [12, 4]);
  await page.touchscreen.tap(cuerpo[0], cuerpo[1]);
  await page.waitForTimeout(200);
  await expect(page.locator(`[data-asa="${ids.r}|1"]`)).toHaveCount(1);
  // its right leg from B14 to B15
  await arrastrarHueco(page, cdp, [14, 4], [15, 4]);
  await expect(page.locator('[data-destino]')).toHaveAttribute('data-destino', 'B15 · tira 15 de arriba');
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(300);
  expect((await estado()).r).toEqual([
    [10, 4],
    [15, 4],
  ]);
  await page.locator('[data-ajuste="derecha"]').tap();
  expect((await estado()).r[1]).toEqual([16, 4]);
  await page.locator('[data-ajuste="izquierda"]').tap();
  expect((await estado()).r[1]).toEqual([15, 4]);
  // cancel: dragged back off the holes
  await arrastrarHueco(page, cdp, [15, 4], [15, -5]);
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(300);
  expect((await estado()).r[1]).toEqual([15, 4]);

  // the wire's end at G8 (y 11) to G9 — the next column
  await arrastrarHueco(page, cdp, [8, 11], [9, 11]);
  await expect(page.locator('[data-destino]')).toHaveAttribute('data-destino', 'G9 · tira 9 de abajo');
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(300);
  expect((await estado()).w.a).toEqual([9, 11]);
  expect((await estado()).w.b).toEqual([8, 16]);
  await page.locator('[data-ajuste="abajo"]').tap();
  expect((await estado()).w.a).toEqual([9, 12]);
  await ctx.close();
});

test('lección cap01/sec-1.5 en el teléfono: la punta roja del multímetro se arrastra al nodo de al lado, con lupa y nombre, flechas y cancelar', async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page, cdp } = await telefono(browser);
  await page.goto('/#/leccion/cap01/sec-1.5/2');
  const diana = (id: string) => page.locator(`[data-diana="${id}"]`);
  await diana('n').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const pantallaI = page.locator('[data-display-instrumento]');
  // the tap still places the red probe (no arrows after a tap)
  await diana('n').tap();
  await expect(diana('n')).toHaveAttribute('data-diana-estado', 'roja');
  await expect(pantallaI).toHaveText('4,80 V');
  await expect(page.locator('[data-ajuste-fino]')).toHaveCount(0);
  const centro = async (id: string): Promise<P> => {
    const b = (await diana(id).boundingBox())!;
    return [b.x + b.width / 2, b.y + b.height / 2];
  };
  // dragged from n to f2: the label names the node before release
  const a = await centro('n');
  const f2 = await centro('f2');
  await toques(cdp, 'touchStart', [a]);
  await page.waitForTimeout(30);
  await deslizar(page, cdp, a, [f2[0], f2[1] + ELEVACION], 12);
  await expect(page.locator('[data-lupa]')).toBeVisible();
  await expect(page.locator('[data-destino]')).toHaveAttribute('data-destino', 'Arriba de la fuente de 6 V');
  // under the finger there is no node at all (it is 56 px under f2)
  const bajo = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest('[data-diana]')?.getAttribute('data-diana') ?? null, [f2[0], f2[1] + ELEVACION]);
  expect(bajo).not.toBe('f2');
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(300);
  await expect(diana('f2')).toHaveAttribute('data-diana-estado', 'roja');
  await expect(diana('n')).toHaveAttribute('data-diana-estado', '');
  await expect(page.locator('[data-punta-roja]')).toHaveValue('f2');
  const vib = await vibraciones(page);
  expect(vib[vib.length - 1]).toBe('[15]');
  // the arrows: back to the node on the left
  await page.locator('[data-ajuste="izquierda"]').tap();
  await expect(diana('n')).toHaveAttribute('data-diana-estado', 'roja');
  await expect(pantallaI).toHaveText('4,80 V');
  // cancel: dropped away from every node, it stays on n
  const n2 = await centro('n');
  await toques(cdp, 'touchStart', [n2]);
  await deslizar(page, cdp, n2, [n2[0] + 20, n2[1] + 140 + ELEVACION], 10);
  await expect(page.locator('[data-destino]')).toContainText('se queda donde estaba');
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(300);
  await expect(diana('n')).toHaveAttribute('data-diana-estado', 'roja');
  // nor onto the black probe's node
  await toques(cdp, 'touchStart', [n2]);
  const cero = await centro('0');
  await deslizar(page, cdp, n2, [cero[0], cero[1] + ELEVACION], 12);
  await expect(page.locator('[data-destino]')).toContainText('ahí está la otra punta');
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(300);
  await expect(diana('n')).toHaveAttribute('data-diana-estado', 'roja');
  await expect(diana('0')).toHaveAttribute('data-diana-estado', 'negra');
  await ctx.close();
});

test('banco de instrumentos en el teléfono: una punta puesta se arrastra a otro nodo del dibujo', async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page, cdp } = await telefono(browser);
  await page.goto('/#/instrumentos/practica/1');
  const nodos = page.locator('[data-nodo-plano]');
  await expect(nodos.first()).toBeVisible({ timeout: 30_000 });
  const ids = await nodos.evaluateAll((els) => els.map((e) => e.getAttribute('data-nodo-plano')!));
  expect(ids.length).toBeGreaterThan(1);
  // the red lead on the first node by a tap, as before
  await page.locator('.conexiones .punta').first().tap();
  const centroNodo = async (id: string): Promise<P> => {
    const b = (await page.locator(`[data-nodo-plano="${id}"] .anillo`).boundingBox())!;
    return [b.x + b.width / 2, b.y + b.height / 2];
  };
  await page.locator(`[data-nodo-plano="${ids[0]}"]`).scrollIntoViewIfNeeded();
  const n0 = await centroNodo(ids[0]!);
  await page.touchscreen.tap(n0[0], n0[1]);
  await page.waitForTimeout(200);
  const disco = page.locator('[data-punta-plano="bmRojo"]');
  await expect(disco).toHaveCount(1);
  // the nearest other node, and the lead dragged there by its disc
  const otros = await Promise.all(ids.slice(1).map(async (id) => ({ id, c: await centroNodo(id) })));
  otros.sort((u, v) => Math.hypot(u.c[0] - n0[0], u.c[1] - n0[1]) - Math.hypot(v.c[0] - n0[0], v.c[1] - n0[1]));
  const destino = otros[0]!;
  const d = (await page.locator('[data-asa-plano="bmRojo"]').boundingBox())!;
  const de: P = [d.x + d.width / 2, d.y + d.height / 2];
  await toques(cdp, 'touchStart', [de]);
  await page.waitForTimeout(30);
  await deslizar(page, cdp, de, [destino.c[0], destino.c[1] + ELEVACION], 12);
  await expect(page.locator('[data-destino]')).toHaveAttribute('data-destino', destino.id === '0' ? 'Masa (0)' : `Nodo ${destino.id}`);
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(300);
  await expect(page.locator(`[data-nodo-plano="${destino.id}"] [data-punta-plano="bmRojo"]`)).toHaveCount(1);
  await expect(page.locator('[data-ajuste-fino] button').first()).toBeVisible();
  await ctx.close();
});

test('protoboard en el teléfono con «reducir movimiento» y la vibración apagada en «Aa»: el zoom sin animación y ni un zumbido', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await ctx.route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await ctx.addInitScript(() => {
    const w = window as unknown as Ventana;
    w.__vib = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (p: unknown) => (w.__vib!.push(p), true) });
    localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
    localStorage.setItem('epa:protoboard-recorrido', '1');
    localStorage.setItem('epa:protoboard-leccion', '1');
    localStorage.setItem('epa:medir-pista', 'vista');
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  // «Sonido y vibración» in «Aa»: vibration off
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Tema y tamaño de letra' }).first().click();
  await page.locator('[data-ajuste-vibracion]').uncheck();
  await page.keyboard.press('Escape');
  await abrirProtoboard(page);
  await page.locator('[data-pestana="medir"]').first().tap();
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaMedida, null, { timeout: 30_000 });
  await page.waitForTimeout(600);
  const c12 = await pantalla(page, [12, 5]);
  await page.touchscreen.tap(c12[0], c12[1]);
  await page.waitForTimeout(200);
  const s0 = await escala(page);
  // the drag starts: the view is zoomed in at once (no animation to wait for)
  await toques(cdp, 'touchStart', [c12]);
  await page.waitForTimeout(30);
  await toques(cdp, 'touchMove', [[c12[0], c12[1] + 16]]);
  expect(await escala(page)).toBe(30);
  const q = await pantalla(page, [13, 4]);
  await deslizar(page, cdp, [c12[0], c12[1] + 16], [q[0], q[1] + ELEVACION]);
  await expect(page.locator('[data-destino]')).toHaveAttribute('data-destino', 'B13 · tira 13 de arriba');
  await toques(cdp, 'touchEnd', []);
  expect(await escala(page)).toBeCloseTo(s0, 6);
  expect(await page.evaluate(() => ({ ...(window as unknown as Ventana).__epaMedida!.medida.puntas }))).toEqual({ bmRojo: [13, 4] });
  expect(await vibraciones(page)).toEqual([]);
  await ctx.close();
});
