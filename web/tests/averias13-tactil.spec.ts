// 1.3 (averias13) follow-ups of the precise placement with a finger (tactil13), on the owner's phone (Pixel 8 Pro:
// 412 × 915 CSS px, DPR 3.5, touch), with real touches through CDP, on the breadboard (componentes/protoboard/):
//  - «Medir» leaves the bench a usable height on a phone (about 300 px, it was 200) and a grip resizes the split; a
//    tablet keeps its layout and a wide screen has no grip;
//  - what a tap places (a meter lead, the start of a wire) shows its hole in the loupe while the finger is down, and
//    a finger held still aims it: sliding moves that hole (no pan, no wire laid) and lifting places it there; a
//    quick tap is as before (the tutors' tap-tap flow);
//  - a part dragged in from the tray by a finger has the loupe and a label with the holes its legs take.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config with a server> tests/averias13-tactil.spec.ts
import { expect, test, type Browser, type CDPSession, type Page } from '@playwright/test';

type P = [number, number];

interface Ventana {
  __epaProtoboard?: {
    pb: {
      doc: { piezas: { id: string; comp: { nombre: string }; pos: P[] }[]; cables: { id: string; a: P; b: P }[] };
    };
    pantalla: (x: number, y: number) => P;
    escala: () => number;
  };
  __epaMedida?: { medida: { puntas: Record<string, P> } };
  __vib?: unknown[];
}

async function telefono(browser: Browser, viewport = { width: 412, height: 915 }, movil = true) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: movil ? 3.5 : 2, isMobile: movil, hasTouch: true });
  await ctx.route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await ctx.addInitScript(() => {
    const w = window as unknown as Ventana;
    w.__vib = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (p: unknown) => (w.__vib!.push(p), true) });
    localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
    if (sessionStorage.getItem('averias13')) return;
    sessionStorage.setItem('averias13', '1');
    localStorage.removeItem('epa:protoboard-borrador');
    localStorage.removeItem('epa:protoboard-dock');
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

async function deslizar(page: Page, cdp: CDPSession, de: P, a: P, pasos = 8) {
  for (let k = 1; k <= pasos; k++) {
    await toques(cdp, 'touchMove', [[de[0] + ((a[0] - de[0]) * k) / pasos, de[1] + ((a[1] - de[1]) * k) / pasos]]);
    await page.waitForTimeout(16);
  }
}

const pantalla = (page: Page, q: P) => page.evaluate(([x, y]) => (window as unknown as Ventana).__epaProtoboard!.pantalla(x!, y!), q);
const alto = (page: Page, sel: string) => page.locator(sel).first().evaluate((e) => Math.round(e.getBoundingClientRect().height));

async function abrirProtoboard(page: Page) {
  await page.goto('/#/protoboard');
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
  await page.waitForTimeout(400);
}
async function abrirMedir(page: Page) {
  await page.locator('[data-pestana="medir"]').first().tap();
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaMedida, null, { timeout: 30_000 });
  await page.waitForTimeout(600);
}

/** Free holes of row y (no leg, no wire end), left to right. */
const libres = (page: Page, y: number) =>
  page.evaluate((fila) => {
    const pb = (window as unknown as Ventana).__epaProtoboard!.pb;
    const usado = new Set<string>();
    for (const p of pb.doc.piezas) for (const q of p.pos) usado.add(`${q[0]},${q[1]}`);
    for (const c of pb.doc.cables) for (const q of [c.a, c.b]) usado.add(`${q[0]},${q[1]}`);
    const res: number[] = [];
    for (let x = 1; x <= 30; x++) if (!usado.has(`${x},${fila}`)) res.push(x);
    return res;
  }, y);

test('«Medir» en el teléfono: la placa con altura para colocar, y el tirador cambia el reparto', async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page, cdp } = await telefono(browser);
  await abrirProtoboard(page);
  await abrirMedir(page);
  // (1.2.1: 200 px)
  const h0 = await alto(page, '.mesa');
  expect(h0).toBeGreaterThanOrEqual(280);
  // the panel still has room for the instruments
  expect(await alto(page, '.dock')).toBeGreaterThanOrEqual(280);
  // the grip: dragged up, the panel grows; with the keys, down
  const t = (await page.locator('[data-tirador-dock]').boundingBox())!;
  const c: P = [t.x + t.width / 2, t.y + t.height / 2];
  await toques(cdp, 'touchStart', [c]);
  await deslizar(page, cdp, c, [c[0], c[1] - 120]);
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(200);
  const h1 = await alto(page, '.mesa');
  expect(h1).toBeLessThan(h0 - 80);
  const v1 = Number(await page.locator('[data-tirador-dock]').getAttribute('aria-valuenow'));
  await page.locator('[data-tirador-dock]').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-tirador-dock]')).toHaveAttribute('aria-valuenow', String(v1 - 10));
  expect(await alto(page, '.mesa')).toBeGreaterThan(h1 + 40);
  // remembered on this device
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
  await abrirMedir(page);
  await expect(page.locator('[data-tirador-dock]')).toHaveAttribute('aria-valuenow', String(v1 - 10));
  await ctx.close();
});

test('«Medir» en la tableta y en el escritorio: el reparto de siempre', async ({ browser }) => {
  test.setTimeout(120_000);
  const tab = await telefono(browser, { width: 800, height: 1280 }, false);
  await abrirProtoboard(tab.page);
  await abrirMedir(tab.page);
  // (the dock keeps its 52 % on a tablet: 1.2.1 gave the bench 393 px. 2.2: at 800 px the app's bottom bar became the
  // side rail, so the workbench is taller and the bench gets 420 px; the share is what stays, and never less bench)
  const reparto = await tab.page.evaluate(() => {
    const h = (s: string) => document.querySelector(s)!.getBoundingClientRect().height;
    return h('section.dock') / h('.protoboard');
  });
  expect(Math.abs(reparto - 0.52)).toBeLessThanOrEqual(0.02);
  expect(await alto(tab.page, '.mesa')).toBeGreaterThanOrEqual(393 - 12);
  await tab.ctx.close();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  await ctx.addInitScript(() => {
    localStorage.setItem('epa:protoboard-recorrido', '1');
    localStorage.setItem('epa:protoboard-leccion', '1');
    localStorage.setItem('epa:medir-pista', 'vista');
  });
  await abrirProtoboard(page);
  await page.locator('[data-pestana="medir"]').first().click();
  await page.waitForTimeout(600);
  await expect(page.locator('[data-tirador-dock]')).toHaveCount(0);
  expect(await alto(page, '.mesa')).toBeGreaterThan(600);
  await ctx.close();
});

test('la punta del polímetro por un toque: la lupa enseña el agujero, y con el dedo quieto se afina deslizándolo', async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page, cdp } = await telefono(browser);
  await abrirProtoboard(page);
  await abrirMedir(page);
  const puntas = () => page.evaluate(() => ({ ...(window as unknown as Ventana).__epaMedida!.medida.puntas }));
  const o0 = await pantalla(page, [0, 0]);
  // the finger down on C12: the loupe names it at once (before lifting)
  const c12 = await pantalla(page, [12, 5]);
  await toques(cdp, 'touchStart', [c12]);
  await page.waitForTimeout(220);
  await expect(page.locator('[data-lupa]')).toBeVisible();
  await expect(page.locator('[data-destino]')).toHaveAttribute('data-destino', 'C12 · tira 12 de arriba');
  await expect(page.locator('[data-mira]')).toHaveAttribute('data-mira', 'vista');
  // held still: it aims; sliding one hole down and one right moves the hole, not the view
  await page.waitForTimeout(300);
  await expect(page.locator('[data-mira]')).toHaveAttribute('data-mira', 'armada');
  const d13 = await pantalla(page, [13, 6]);
  await deslizar(page, cdp, c12, d13);
  await page.waitForTimeout(60);
  await expect(page.locator('[data-destino]')).toHaveAttribute('data-destino', 'D13 · tira 13 de arriba');
  expect(await pantalla(page, [0, 0])).toEqual(o0);
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(300);
  expect((await puntas()).bmRojo).toEqual([13, 6]);
  await expect(page.locator('[data-lupa]')).toHaveCount(0);
  const vib = await page.evaluate(() => ((window as unknown as Ventana).__vib ?? []).map((x) => JSON.stringify(x)));
  expect(vib[vib.length - 1]).toBe('[15]');
  // a quick tap is as before: the hole under the finger, no loupe left, no arrows
  const c15 = await pantalla(page, [15, 5]);
  await page.touchscreen.tap(c15[0], c15[1]);
  await page.waitForTimeout(250);
  expect((await puntas()).bmRojo).toEqual([15, 5]);
  await expect(page.locator('[data-lupa]')).toHaveCount(0);
  await expect(page.locator('[data-ajuste-fino]')).toHaveCount(0);
  // a quick slide away from the leads still pans the view (no aim)
  const o1 = await pantalla(page, [0, 0]);
  const c22 = await pantalla(page, [22, 5]);
  await toques(cdp, 'touchStart', [c22]);
  await deslizar(page, cdp, c22, [c22[0] - 60, c22[1]], 4);
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(200);
  expect((await pantalla(page, [0, 0]))[0]).toBeLessThan(o1[0] - 30);
  expect((await puntas()).bmRojo).toEqual([15, 5]);
  await ctx.close();
});

test('un cable nuevo: el agujero donde empieza se ve en la lupa y se afina con el dedo quieto', async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page, cdp } = await telefono(browser);
  await abrirProtoboard(page);
  // three free holes of row b (y 4) next to each other
  const xs = await libres(page, 4);
  const x0 = xs.find((x) => xs.includes(x + 1) && xs.includes(x + 4))!;
  expect(x0).toBeTruthy();
  const n0 = await page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.pb.doc.cables.length);
  const a = await pantalla(page, [x0, 4]);
  await toques(cdp, 'touchStart', [a]);
  await page.waitForTimeout(200);
  await expect(page.locator('[data-destino]')).toHaveAttribute('data-destino', `B${x0} · tira ${x0} de arriba`);
  await page.waitForTimeout(350);
  await expect(page.locator('[data-mira]')).toHaveAttribute('data-mira', 'armada');
  // slid one hole right: the start moves there; no wire is laid while aiming
  const b = await pantalla(page, [x0 + 1, 4]);
  await deslizar(page, cdp, a, b);
  await expect(page.locator('[data-destino]')).toHaveAttribute('data-destino', `B${x0 + 1} · tira ${x0 + 1} de arriba`);
  await expect(page.locator('.fantasma')).toHaveCount(0);
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.pb.doc.cables.length)).toBe(n0);
  await expect(page.locator('.mesa .info')).toContainText('Toque el agujero donde acaba el cable');
  // the end by a quick tap, as before
  const e = await pantalla(page, [x0 + 4, 4]);
  await page.touchscreen.tap(e[0], e[1]);
  await page.waitForTimeout(250);
  const cables = await page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.pb.doc.cables.map((c) => [c.a, c.b]));
  expect(cables.length).toBe(n0 + 1);
  expect(cables[cables.length - 1]).toEqual([
    [x0 + 1, 4],
    [x0 + 4, 4],
  ]);
  await ctx.close();
});

test('una pieza arrastrada desde la bandeja: lupa y nombre de los agujeros de sus patas', async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page, cdp } = await telefono(browser);
  await abrirProtoboard(page);
  const n0 = await page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.pb.doc.piezas.length);
  const carta = page.locator('.bandeja .carta[data-carta]').first();
  const nombre = (await carta.getAttribute('aria-label'))!.split(/[,:]/)[0]!;
  const r = (await carta.boundingBox())!;
  const c0: P = [r.x + r.width / 2, r.y + r.height / 2];
  const mesa = (await page.locator('.mesa').boundingBox())!;
  const destino: P = [mesa.x + mesa.width / 2, mesa.y + mesa.height * 0.55];
  await toques(cdp, 'touchStart', [c0]);
  await deslizar(page, cdp, c0, [c0[0], c0[1] - 30], 3);
  await deslizar(page, cdp, [c0[0], c0[1] - 30], destino, 12);
  await page.waitForTimeout(150);
  await expect(page.locator('[data-lupa]')).toBeVisible();
  const etiqueta = (await page.locator('[data-destino]').getAttribute('data-destino'))!;
  // «R3 · B10 y B14», «C2 · …», or «…: no cabe»
  expect(etiqueta).toMatch(/^\S+ · .*[A-J]\d+|no cabe|carril/);
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(300);
  await expect(page.locator('[data-lupa]')).toHaveCount(0);
  if (!etiqueta.includes('no cabe')) expect(await page.evaluate(() => (window as unknown as Ventana).__epaProtoboard!.pb.doc.piezas.length)).toBe(n0 + 1);
  expect(nombre.length).toBeGreaterThan(0);
  await ctx.close();
});
