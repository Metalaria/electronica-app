// 1.3.1 (qa131-interaccion): the breadboard on the owner's phone (Pixel 8 Pro: 412 × 915, DPR 3.5, touch) while
// nothing happens. With «Medir» open the page kept asking for an animation frame 60 times a second for the level
// meter of «Escuchar» (instrumentos/banco/Escuchar.svelte) even with nothing to listen to: the phone never rested
// while the panel was open. Idle now means no frames.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config with a server> tests/qa131-protoboard-navegador.spec.ts
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true });

test('protoboard con «Medir» abierto y sin tocar nada: no pide cuadros de animación', async ({ page }) => {
  await page.context().route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript(() => {
    localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
    localStorage.setItem('epa:protoboard-recorrido', '1');
    localStorage.setItem('epa:protoboard-leccion', '1');
    const w = window as unknown as { __cuadros: number };
    w.__cuadros = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (f: FrameRequestCallback) => raf((t) => (w.__cuadros++, f(t)));
  });
  await page.goto('/#/protoboard');
  await page.waitForFunction(() => !!(globalThis as unknown as { __epaProtoboard?: unknown }).__epaProtoboard, null, { timeout: 60_000 });
  await page.locator('[data-pestana="medir"]').first().tap();
  await page.waitForFunction(() => !!(globalThis as unknown as { __epaMedida?: unknown }).__epaMedida, null, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  const n0 = await page.evaluate(() => (window as unknown as { __cuadros: number }).__cuadros);
  await page.waitForTimeout(2000);
  const n = (await page.evaluate(() => (window as unknown as { __cuadros: number }).__cuadros)) - n0;
  expect(n, 'cuadros de animación en 2 s sin tocar nada').toBeLessThan(5);
});

// The owner's crash on the phone (1.3.0): «intentaba quitar y recolocar un cable», «intentar cerrar la lupa». With
// «Medir» open or a wire being laid, a finger held on a wire (a long press, to take it away) showed the aiming loupe
// after 120 ms and, lifted, put the probe or the wire's end there; every new attempt opened it again. Now a finger held
// on a wire, a part or a handle never aims: a long press on a wire removes it (also while a wire is being laid). The
// aiming hold stays for a free hole with something to place, and lifting puts it on the hole the loupe showed.

type P = [number, number];
type Ventana = {
  __epaProtoboard: { pb: { doc: { cables: { id: string; a: P; b: P }[] } }; pantalla: (x: number, y: number) => P };
  __epaMedida?: { medida: { puntas: Record<string, P | null>; activa: string | null } };
};

async function banco(page: import('@playwright/test').Page, medir: boolean) {
  await page.context().route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await page.addInitScript(() => {
    localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
    if (sessionStorage.getItem('qa131-proto')) return;
    sessionStorage.setItem('qa131-proto', '1');
    localStorage.removeItem('epa:protoboard-borrador');
    localStorage.setItem('epa:protoboard-recorrido', '1');
    localStorage.setItem('epa:protoboard-leccion', '1');
    localStorage.setItem('epa:medir-pista', 'vista');
  });
  await page.goto('/#/protoboard');
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboard?.pb.doc.cables.length, null, { timeout: 60_000 });
  await page.waitForTimeout(500);
  if (medir) {
    await page.locator('[data-pestana="medir"]').first().tap();
    await page.waitForFunction(() => !!(window as unknown as Ventana).__epaMedida, null, { timeout: 30_000 });
    await page.waitForTimeout(600);
  }
  const cdp = await page.context().newCDPSession(page);
  const toque = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: P[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  return { cdp, toque };
}

/** On screen, inside the bench and not covered: the middle of a wire with nothing else under it, or a free hole. */
async function sitio(page: import('@playwright/test').Page, que: 'cable' | 'hueco', no: string[] = []): Promise<{ p: P; id?: string; q?: P } | null> {
  return page.evaluate(
    ([que, no]) => {
      const w = window as unknown as Ventana;
      const e = w.__epaProtoboard;
      const mesa = document.querySelector('.mesa')!.getBoundingClientRect();
      const dentro = (p: P) => p[0] > mesa.left + 10 && p[0] < mesa.right - 10 && p[1] > mesa.top + 10 && p[1] < mesa.bottom - 60 && p[1] < innerHeight - 90;
      const bajo = (p: P) => document.elementFromPoint(p[0], p[1]);
      if (que === 'cable') {
        for (const c of e.pb.doc.cables) {
          if (no.includes(c.id)) continue;
          const a = e.pantalla(c.a[0], c.a[1]);
          const b = e.pantalla(c.b[0], c.b[1]);
          for (const f of [0.5, 0.35, 0.65]) {
            const p: P = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
            if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 40 || !dentro(p)) continue;
            if ((bajo(p)?.closest('[data-cable]') as SVGElement | null)?.dataset['cable'] === c.id) return { p, id: c.id };
          }
        }
        return null;
      }
      // (the strips' holes: rows A–E are y 3…7, F–J y 9…13; the channel between)
      for (const y of [4, 5, 6, 10, 11, 12])
        for (let x = 2; x <= 16; x++) {
          if (no.includes(`${x},${y}`)) continue;
          const p = e.pantalla(x, y);
          const el = bajo(p);
          if (dentro(p) && el?.closest('.mesa svg') && !el.closest('[data-pieza], [data-cable], [data-asa]')) return { p, q: [x, y] as P };
        }
      return null;
    },
    [que, no] as const,
  );
}

const lupas = (page: import('@playwright/test').Page) => page.locator('[data-lupa]').count();
const cables = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as Ventana).__epaProtoboard.pb.doc.cables.map((c) => c.id));
const puntas = (page: import('@playwright/test').Page) => page.evaluate(() => JSON.stringify((window as unknown as Ventana).__epaMedida?.medida.puntas ?? {}));

/** A finger held still for `ms`, the loupe looked for while it is down; returns how many times it was seen. */
async function mantener(page: import('@playwright/test').Page, toque: (t: 'touchStart' | 'touchMove' | 'touchEnd', p: P[]) => Promise<unknown>, p: P, ms = 800): Promise<number> {
  await toque('touchStart', [p]);
  let vista = 0;
  for (let t = 0; t < ms; t += 150) {
    await page.waitForTimeout(150);
    vista += await lupas(page);
  }
  await toque('touchEnd', []);
  await page.waitForTimeout(300);
  return vista;
}

test('un dedo quieto sobre un cable lo quita sin lupa: sin nada más, con «Medir» abierto y con un cable a medio tender', async ({ page }) => {
  test.setTimeout(120_000);
  // without anything in hand
  let { toque } = await banco(page, false);
  let c = (await sitio(page, 'cable'))!;
  expect(c, 'un cable a la vista').not.toBeNull();
  expect(await mantener(page, toque, c.p), 'lupa sobre el cable').toBe(0);
  expect(await cables(page)).not.toContain(c.id);

  // a wire being laid (a tap on a free hole), then a finger held on another wire: no loupe, that wire goes, the start too
  const h = (await sitio(page, 'hueco'))!;
  await toque('touchStart', [h.p]);
  await page.waitForTimeout(40);
  await toque('touchEnd', []);
  await page.waitForTimeout(250);
  await expect(page.locator('.mesa circle.pendiente')).toHaveCount(1);
  c = (await sitio(page, 'cable'))!;
  const antes = (await cables(page)).length;
  expect(await mantener(page, toque, c.p), 'lupa sobre el cable con un cable a medio tender').toBe(0);
  expect(await cables(page)).not.toContain(c.id);
  expect((await cables(page)).length).toBe(antes - 1);
  await expect(page.locator('.mesa circle.pendiente')).toHaveCount(0);

  // «Medir» open with a probe in hand: held on a wire, no loupe and the probe does not move
  await page.reload();
  ({ toque } = await banco(page, true));
  const h2 = (await sitio(page, 'hueco'))!;
  await page.touchscreen.tap(h2.p[0], h2.p[1]);
  await page.waitForTimeout(300);
  const p0 = await puntas(page);
  expect(p0).toContain(JSON.stringify(h2.q));
  c = (await sitio(page, 'cable'))!;
  expect(await mantener(page, toque, c.p), 'lupa sobre el cable con «Medir»').toBe(0);
  expect(await puntas(page), 'la punta no se mueve').toBe(p0);
  await expect(page.locator('[data-lupa]')).toHaveCount(0);
});

test('con «Medir», un dedo quieto en un agujero libre sigue apuntando, y al soltar la punta va al agujero que enseñó la lupa', async ({ page }) => {
  test.setTimeout(120_000);
  const { toque } = await banco(page, true);
  const h = (await sitio(page, 'hueco'))!;
  await page.touchscreen.tap(h.p[0], h.p[1]);
  await page.waitForTimeout(300);
  // another free hole: the probe in hand aims there
  // (well away from the first one: a lead's drawing rises above its hole, and a finger on it drags that lead)
  const cerca = [];
  for (let dx = -5; dx <= 5; dx++) for (let dy = -3; dy <= 3; dy++) cerca.push(`${h.q![0] + dx},${h.q![1] + dy}`);
  const otro = (await sitio(page, 'hueco', cerca))!;
  const p = otro.p;
  await toque('touchStart', [p]);
  await page.waitForTimeout(250);
  await expect(page.locator('[data-lupa]')).toHaveCount(1);
  const mostrado = await page.locator('[data-destino-hueco]').getAttribute('data-destino-hueco');
  await toque('touchEnd', []);
  await page.waitForTimeout(300);
  await expect(page.locator('[data-lupa]')).toHaveCount(0);
  const ps = JSON.parse(await puntas(page)) as Record<string, P | null>;
  expect(Object.values(ps).map((q) => q?.join(','))).toContain(mostrado);
});

test('muchas pulsaciones largas seguidas sobre cables y piezas, con «Medir»: ni lupa, ni memoria ni cuadros que crecen', async ({ page }) => {
  test.setTimeout(180_000);
  const { toque, cdp } = await banco(page, true);
  await cdp.send('Performance.enable');
  const heap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    return ((await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0) / 1e6;
  };
  const h0 = await heap();
  let vistas = 0;
  for (let k = 0; k < 16; k++) {
    const c = await page.evaluate((k) => {
      const els = [...document.querySelectorAll('.mesa [data-cable], .mesa [data-pieza]')].filter((e) => {
        const r = e.getBoundingClientRect();
        const m = document.querySelector('.mesa')!.getBoundingClientRect();
        return r.width > 4 && r.top > m.top + 10 && r.bottom < Math.min(m.bottom, innerHeight - 90);
      });
      const e = els[k % Math.max(1, els.length)];
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2] as P;
    }, k);
    if (!c) break;
    vistas += await mantener(page, toque, c, 700);
  }
  expect(vistas, 'lupa al mantener el dedo sobre cables y piezas').toBe(0);
  const h1 = await heap();
  expect(h1 - h0, `memoria tras 16 pulsaciones largas (${h0.toFixed(1)} → ${h1.toFixed(1)} MB)`).toBeLessThan(3);
});
