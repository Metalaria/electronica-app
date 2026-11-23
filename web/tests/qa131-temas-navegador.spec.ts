// 1.3.1 (qa131-temas): the owner reads almost only in the dark and sepia themes. What 1.3 and 1.3.1 added, in those
// themes, in the states a route sweep never reaches (a finger dragging, a lead off the holes, a fault being searched):
// text readable (WCAG AA 4.5:1, computed from the colours the browser applies) and drawings that follow the theme.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config with a server> tests/qa131-temas-navegador.spec.ts
import { expect, test, type Browser, type CDPSession, type Locator, type Page } from '@playwright/test';

type P = [number, number];
const ELEVACION = 56;
const TEMAS = ['oscuro', 'sepia'] as const;

interface Ventana {
  __epaProtoboard?: { pantalla: (x: number, y: number) => P; pb: { doc: { piezas: unknown[] } } };
  __epaMedida?: { medida: { puntas: Record<string, P | null> } };
}

async function telefono(browser: Browser, tema: string) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
  await ctx.route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await ctx.addInitScript((t) => {
    localStorage.setItem('epa:prefs', JSON.stringify({ tema: t }));
    localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false }));
    localStorage.setItem('epa:protoboard-recorrido', '1');
    localStorage.setItem('epa:protoboard-leccion', '1');
    localStorage.setItem('epa:medir-pista', 'vista');
  }, tema);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp };
}

/**
 * The contrast of an element's text against what is behind it: its colour over the first backgrounds up the tree,
 * composited (a translucent chip over a card over the page), as WCAG computes it.
 */
export async function contraste(l: Locator): Promise<{ ratio: number; color: string; fondo: string }> {
  return l.evaluate((el) => {
    const rgba = (s: string): number[] => {
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0, 0];
      const p = m[1]!.split(/[ ,/]+/).filter(Boolean).map(Number);
      return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
    };
    const sobre = (a: number[], b: number[]) => [0, 1, 2].map((i) => a[i]! * a[3]! + b[i]! * (1 - a[3]!)).concat(1);
    const capas: number[][] = [];
    for (let e: Element | null = el; e; e = e.parentElement) {
      const c = rgba(getComputedStyle(e).backgroundColor);
      if (c[3]! > 0) capas.push(c);
      if (c[3] === 1) break;
    }
    let fondo = rgba(getComputedStyle(document.body).backgroundColor);
    for (const c of capas.reverse()) fondo = sobre(c, fondo);
    const tinta = sobre(rgba(getComputedStyle(el).color), fondo);
    const lum = (c: number[]) => {
      const f = (v: number) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
    };
    const [a, b] = [lum(tinta), lum(fondo)].sort((x, y) => y - x);
    const hex = (c: number[]) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    return { ratio: Math.round(((a! + 0.05) / (b! + 0.05)) * 100) / 100, color: hex(tinta), fondo: hex(fondo) };
  });
}

const toques = (cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', puntos: P[]) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: puntos.map(([x, y], id) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
async function deslizar(page: Page, cdp: CDPSession, de: P, a: P, pasos = 10) {
  for (let k = 1; k <= pasos; k++) {
    await toques(cdp, 'touchMove', [[de[0] + ((a[0] - de[0]) * k) / pasos, de[1] + ((a[1] - de[1]) * k) / pasos]]);
    await page.waitForTimeout(16);
  }
}
const pantalla = (page: Page, q: P) => page.evaluate(([x, y]) => (window as unknown as Ventana).__epaProtoboard!.pantalla(x!, y!), q);
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

for (const tema of TEMAS) {
  test(`protoboard (${tema}): la etiqueta de la lupa se lee, también en rojo cuando la punta no cabe`, async ({ browser }, info) => {
    test.setTimeout(120_000);
    const { ctx, page, cdp } = await telefono(browser, tema);
    await page.goto('/#/protoboard');
    await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
    await expect(page.locator('html')).toHaveAttribute('data-tema', tema);
    await page.locator('[data-pestana="medir"]').first().tap();
    await page.waitForFunction(() => !!(window as unknown as Ventana).__epaMedida, null, { timeout: 30_000 });
    await page.waitForTimeout(600);
    const c12 = await pantalla(page, [12, 5]);
    await page.touchscreen.tap(c12[0], c12[1]);
    await page.waitForTimeout(250);
    // a good place: the label in the theme's ink
    await arrastrarHueco(page, cdp, [12, 5], [13, 4]);
    const bien = page.locator('[data-lupa] [data-destino]');
    await expect(bien).toHaveAttribute('data-destino', 'B13 · tira 13 de arriba');
    const cb = await contraste(bien);
    expect(cb.ratio, `etiqueta de la lupa ${JSON.stringify(cb)}`).toBeGreaterThanOrEqual(4.5);
    // off the holes: the red «se queda donde estaba» must read as well
    const q = await pantalla(page, [13, -6]);
    await deslizar(page, cdp, [q[0], q[1] + ELEVACION + 200], [q[0], q[1] + ELEVACION]);
    await page.waitForTimeout(150);
    const mal = page.locator('[data-lupa] [data-destino].mal');
    await expect(mal).toContainText('se queda donde estaba');
    await page.screenshot({ path: info.outputPath(`lupa-mal-${tema}.png`) });
    const cm = await contraste(mal);
    expect(cm.ratio, `etiqueta roja de la lupa ${JSON.stringify(cm)}`).toBeGreaterThanOrEqual(4.5);
    await toques(cdp, 'touchEnd', []);
    await ctx.close();
  });
}

// The 1.3 screens in the owner's themes, photographed for a human eye (TEMAS_GALERIA=1): the fine-adjust arrows and
// the «Medir» grip on the breadboard, the 3D board's buttons and a part's label, the 2D board's «Capas» with
// «Componentes». Assertions only where a defect was confirmed (tests above and below).
for (const tema of TEMAS) {
  test(`galería 1.3 (${tema})`, async ({ browser }, info) => {
    test.skip(!process.env.TEMAS_GALERIA, 'solo con TEMAS_GALERIA=1');
    test.setTimeout(240_000);
    const { ctx, page, cdp } = await telefono(browser, tema);
    const foto = (n: string) => page.screenshot({ path: info.outputPath(`${n}-${tema}.png`) });
    await page.goto('/#/protoboard');
    await page.waitForFunction(() => !!(window as unknown as Ventana).__epaProtoboard?.pb.doc.piezas.length, null, { timeout: 60_000 });
    await page.locator('[data-pestana="medir"]').first().tap();
    await page.waitForFunction(() => !!(window as unknown as Ventana).__epaMedida, null, { timeout: 30_000 });
    await page.waitForTimeout(600);
    const c12 = await pantalla(page, [12, 5]);
    await page.touchscreen.tap(c12[0], c12[1]);
    await page.waitForTimeout(250);
    await arrastrarHueco(page, cdp, [12, 5], [13, 4]);
    await foto('proto-lupa');
    await toques(cdp, 'touchEnd', []);
    await page.waitForTimeout(500);
    await expect(page.locator('[data-ajuste-fino] button').first()).toBeVisible();
    await foto('proto-flechas');
    await page.locator('[data-ajuste="derecha"]').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await foto('proto-flechas-foco');
    await page.locator('[data-tirador-dock]').focus();
    await foto('proto-tirador-foco');

    await page.goto('/#/proyectos/sdr/3d');
    await page.waitForTimeout(6000);
    await foto('sdr3d');
    const lienzo = (await page.locator('.v3d canvas, .marco canvas').first().boundingBox())!;
    await page.touchscreen.tap(lienzo.x + lienzo.width / 2, lienzo.y + lienzo.height / 2);
    await page.waitForTimeout(1500);
    await foto('sdr3d-toque');

    await page.goto('/#/consolas/snes/placa2d');
    await expect(page.locator('.placa2d canvas')).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /^Capas/ }).first().tap();
    await page.waitForTimeout(400);
    await foto('placa2d-capas');

    await page.goto('/#/consolas/snes/averia/fusible-abierto');
    await expect(page.locator('[data-averia-placa]')).toBeVisible({ timeout: 60_000 });
    await page.locator('[data-vista-averia="3d"]').tap();
    await page.waitForFunction(() => (window as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo === true, null, { timeout: 120_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.locator('.tres').evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(500);
    await foto('averia-3d');
    await ctx.close();
  });
}

for (const tema of TEMAS) {
  test(`placa 2D (${tema}): el rótulo «Vista desde arriba» sobre la placa se lee`, async ({ browser }) => {
    test.setTimeout(120_000);
    const { ctx, page } = await telefono(browser, tema);
    await page.goto('/#/consolas/snes/placa2d');
    await expect(page.locator('.placa2d canvas')).toBeVisible({ timeout: 60_000 });
    const marca = page.locator('.placa2d .lado-marca');
    await expect(marca).toHaveText('Vista desde arriba');
    // (composited over the frame's background, which the canvas repeats around the board: #e9e6de / #15191e)
    const c = await contraste(marca);
    expect(c.ratio, `rótulo de la cara ${JSON.stringify(c)}`).toBeGreaterThanOrEqual(4.5);
    await ctx.close();
  });
}

// (not a theme defect, found looking at the dark theme: a schematic check of the board's list took the padding of the
// «could not load» box, both being «.aviso»)
test('placa de la NES: la lista «Comprobaciones con el esquema» con sus avisos alineados, sin el relleno de la caja de error', async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page } = await telefono(browser, 'oscuro');
  await page.goto('/#/consolas/nes/placa3d');
  const avisos = page.locator('.comprobaciones li.aviso');
  await expect(avisos.first()).toBeVisible({ timeout: 60_000 });
  const rellenos = await avisos.evaluateAll((ls) => ls.map((l) => getComputedStyle(l).padding));
  expect(rellenos.every((p) => p === '0px'), `relleno de los avisos: ${rellenos.join(', ')}`).toBe(true);
  await ctx.close();
});

/** The theme's inks that are used for text, and the surfaces text sits on. */
const TINTAS_TEXTO = ['--tinta', '--tinta-suave', '--tinta-tenue', '--titulos', '--acento', '--c-nota', '--c-importante', '--c-precaucion', '--c-ejemplo', '--c-tarjeta-texto', '--ambar', '--bien-texto', '--mal-texto', '--lectura', '--v11-rojo', '--v11-naranja-texto'];
const SUPERFICIES = ['--fondo', '--superficie', '--superficie-2', '--fondo-lateral', '--tarjeta-fondo', '--codigo-fondo', '--tabla-par', '--bien-tinte', '--mal-tinte'];

async function tokensBajos(page: Page, tintas: string[], fondos: string[]): Promise<string[]> {
  return page.evaluate(
    ([T, F]) => {
      const rgb = (v: string) => {
        const d = document.createElement('i');
        d.style.color = `var(${v})`;
        document.body.append(d);
        const c = getComputedStyle(d).color.match(/[\d.]+/g)!.map(Number);
        d.remove();
        return c;
      };
      const L = (c: number[]) => {
        const f = (x: number) => ((x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
      };
      const r: string[] = [];
      for (const t of T!)
        for (const f of F!) {
          const a = L(rgb(t));
          const b = L(rgb(f));
          const c = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          if (c < 4.5) r.push(`${t} sobre ${f}: ${c.toFixed(2)}`);
        }
      return r;
    },
    [tintas, fondos],
  );
}

// The «important» amber is the ink of many warnings (the real Brymen's, the breadboard's «Medir», the bench's, the
// calculators' «out of the usual range», sync…): in sepia it was 4.25:1 on the page and 3.7–3.8:1 on the panels.
for (const tema of ['oscuro', 'sepia', 'claro'] as const) {
  test(`tema ${tema}: las tintas de texto se leen sobre todas las superficies del tema (AA)`, async ({ browser }) => {
    const { ctx, page } = await telefono(browser, tema);
    await page.goto('/#/');
    await expect(page.locator('html')).toHaveAttribute('data-tema', tema);
    // (light: only the amber, the theme the owner does not use keeps its other marginal pairs, reported apart)
    const bajos = await tokensBajos(page, tema === 'claro' ? ['--c-importante'] : TINTAS_TEXTO, SUPERFICIES);
    expect(bajos).toEqual([]);
    await ctx.close();
  });
}

for (const tema of TEMAS) {
  test(`calculadora (${tema}): el aviso «fuera de lo habitual en el libro» se lee`, async ({ browser }, info) => {
    const { ctx, page } = await telefono(browser, tema);
    await page.goto('/#/calculadoras/deslizamiento');
    const campo = page.locator('#calc1-n_s');
    await campo.fill('1e7');
    await campo.press('Enter');
    const aviso = page.locator('#calc1-n_s-aviso');
    await expect(aviso).toContainText('Fuera de lo habitual');
    await aviso.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`calc-aviso-${tema}.png`) });
    const c = await contraste(aviso);
    expect(c.ratio, `aviso de la calculadora ${JSON.stringify(c)}`).toBeGreaterThanOrEqual(4.5);
    await ctx.close();
  });
}
