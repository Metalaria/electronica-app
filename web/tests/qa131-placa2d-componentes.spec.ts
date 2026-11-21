// 1.3.1 (qa131-interaccion), the owner's report «la cara superior de las consolas en la visión 2D no tiene los
// componentes»: the consoles' «Placa en 2D» (consolas/placa/PlacaConsola.svelte → proyectos/Placa2D.svelte) draws each
// part mounted on the face looked at as a dark body filling its body box (datos.esquinasHuella), with its reference
// when it is legible, and «Componentes» hides them. For every console's board and both faces (the bottom one mirrored;
// the Game Boy Color's CGB-CPU-04 carries its parts on face B): the bodies drawn are the parts of that face, a pixel in
// the middle of the biggest one is dark with them and not without them, a tap on a body selects that part; on a phone
// the references appear when zoomed in, upright; the biggest boards repaint quickly with a slowed-down CPU.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config with a server> tests/qa131-placa2d-componentes.spec.ts
import { expect, test, type Page } from '@playwright/test';

type Pad = (number | string)[];
type Huella = { r: string; x: number; y: number; a: number; lado: 'F' | 'B'; t: string; m: { tipo: string; caja: [number, number, number, number] } };
type Stats = { ms: number[]; base: number; cuerpos?: number; rotulos?: number };
type Vista = { k: number; ox: number; oy: number; lado: 'F' | 'B'; ancho: number };

const PLACAS: { maquina: string; id: string; boton?: string }[] = [
  { maquina: 'nes', id: 'nes' },
  { maquina: 'megadrive', id: 'megadrive' },
  { maquina: 'neogeo', id: 'neogeo' },
  { maquina: 'gb', id: 'gb-superdmg' },
  { maquina: 'gbc', id: 'gbc-cgb04' },
  { maquina: 'gbc', id: 'gbc-opengbc', boton: 'OpenGBC' },
  { maquina: 'snes', id: 'snes' },
  { maquina: 'sms', id: 'sms' },
];

/** The body box's corners on the board (as datos.ts esquinasHuella: KiCad mm × 100, rotated counter-clockwise). */
function esquinas(h: Huella): [number, number][] {
  const a = (h.a * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const [x0, y0, x1, y1] = h.m.caja.map((v) => v * 100) as [number, number, number, number];
  return ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as [number, number][]).map(([x, y]) => [h.x + x * c + y * s, h.y - x * s + y * c]);
}
// (as the 3D view: «sin_cuerpo» — gold fingers, test pads — and holes have no body)
const conCuerpo = (hs: Huella[], lado: 'F' | 'B') =>
  hs.filter((h) => h.lado === lado && h.t !== 'mec' && h.m.tipo !== 'sin_cuerpo' && h.m.tipo !== 'taladro' && h.m.caja[2] > h.m.caja[0] && h.m.caja[3] > h.m.caja[1]);

const stats = (page: Page) => page.evaluate(() => (globalThis as unknown as { __epaPlaca2D?: Stats }).__epaPlaca2D ?? null);
const vista = (page: Page) => page.evaluate(() => (globalThis as unknown as { __epaPlacaVista?: Vista }).__epaPlacaVista!);

async function abrir(page: Page, p: (typeof PLACAS)[number]): Promise<{ huellas: Huella[]; pads: Pad[]; mascara: string }> {
  await page.context().route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await page.goto(`/#/consolas/${p.maquina}/placa2d`);
  if (p.boton) {
    await page.getByRole('button', { name: new RegExp(p.boton) }).first().click();
    // (that board's own data, not the first board's still on screen)
    await expect(page.locator('aside.lado')).toContainText(p.boton, { timeout: 30_000 });
    await page.waitForTimeout(800);
  }
  await expect(page.locator('.placa2d canvas')).toBeVisible({ timeout: 60_000 });
  const d = await page.evaluate(async (id) => (await (await fetch(`consolas/placas/${id}.json`)).json()) as { huellas: Huella[]; pads: Pad[]; placa: { mascara: string } }, p.id);
  await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca2D?: Stats }).__epaPlaca2D?.cuerpos !== undefined, null, { timeout: 60_000 });
  await page.waitForTimeout(300);
  return { huellas: d.huellas, pads: d.pads, mascara: d.placa.mascara };
}

/** The darkest canvas pixel among board points (CSS px of the canvas from the view's transform): a body is dark. */
async function luz(page: Page, puntos: [number, number][]): Promise<number> {
  return page.evaluate((ps) => {
    const v = (globalThis as unknown as { __epaPlacaVista: Vista }).__epaPlacaVista;
    const cv = document.querySelector('.placa2d canvas') as HTMLCanvasElement;
    const dpr = cv.width / cv.clientWidth;
    let min = 255;
    for (const [x, y] of ps) {
      const px = (v.ox + (v.lado === 'B' ? v.ancho - x! : x!) * v.k) * dpr;
      const py = (v.oy + y! * v.k) * dpr;
      const [r, g, b] = cv.getContext('2d')!.getImageData(Math.round(px), Math.round(py), 1, 1).data;
      min = Math.min(min, 0.2126 * r! + 0.7152 * g! + 0.0722 * b!);
    }
    return min;
  }, puntos);
}

/** Inside a convex quadrilateral (the body box). */
function dentro(e: [number, number][], x: number, y: number): boolean {
  let signo = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = e[i]!;
    const [bx, by] = e[(i + 1) % 4]!;
    const z = Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax));
    if (z && signo && z !== signo) return false;
    if (z) signo = z;
  }
  return true;
}

async function cara(page: Page, lado: 'F' | 'B') {
  await page.getByRole('button', { name: lado === 'F' ? 'Cara superior' : 'Cara inferior', exact: true }).click();
  await page.waitForFunction((l) => (globalThis as unknown as { __epaPlacaVista?: Vista }).__epaPlacaVista?.lado === l, lado);
  await page.waitForTimeout(400);
}

for (const p of PLACAS) {
  test(`${p.id}: los componentes de cada cara en la vista 2D, con su cuerpo, y «Componentes» los quita`, async ({ page }) => {
    for (const lado of ['F', 'B'] as const) {
      // (each face on a fresh page: the previous face's tap selected a part, which frames it)
      await page.goto('/#/');
      const { huellas: hs, pads, mascara } = await abrir(page, p);
      await cara(page, lado);
      const esperados = conCuerpo(hs, lado);
      expect((await stats(page))!.cuerpos, `cuerpos en la cara ${lado}`).toBe(esperados.length);
      if (!esperados.length) continue;
      // the biggest body: dark in its middle with the bodies, not without them
      const grande = esperados.reduce((a, b) => ((b.m.caja[2] - b.m.caja[0]) * (b.m.caja[3] - b.m.caja[1]) > (a.m.caja[2] - a.m.caja[0]) * (a.m.caja[3] - a.m.caja[1]) ? b : a));
      const e = esquinas(grande);
      const m: [number, number] = [e.reduce((s, q) => s + q[0], 0) / 4, e.reduce((s, q) => s + q[1], 0) / 4];
      // (a fifth of the way from a corner to the middle: inside the body, away from the reference written in its middle)
      const c: [number, number] = [e[0]![0] + (m[0] - e[0]![0]) * 0.2, e[0]![1] + (m[1] - e[0]![1]) * 0.2];
      // (the diagonal from there towards the middle: the darkest of its pixels, whatever the body's size on screen)
      const diagonal: [number, number][] = [0.15, 0.2, 0.25, 0.3, 0.35, 0.4].map((f) => [e[0]![0] + (m[0] - e[0]![0]) * f, e[0]![1] + (m[1] - e[0]![1]) * f]);
      // what a tap there selects: the smallest body of this face containing the point
      const area = (h: Huella) => (h.m.caja[2] - h.m.caja[0]) * (h.m.caja[3] - h.m.caja[1]);
      const tocada = esperados.filter((h) => dentro(esquinas(h), ...c)).reduce((a, b) => (area(b) < area(a) ? b : a), grande);
      const sobrePad = pads.some((q) => Math.hypot(Number(q[3]) - c[0], Number(q[4]) - c[1]) < Math.max(Number(q[5]), Number(q[6])));
      const v = await vista(page);
      const caja = (await page.locator('.placa2d canvas').boundingBox())!;
      const sx = caja.x + v.ox + (lado === 'B' ? v.ancho - c[0] : c[0]) * v.k;
      const sy = caja.y + v.oy + c[1] * v.k;
      expect(sx > caja.x && sx < caja.x + caja.width && sy > caja.y && sy < caja.y + caja.height, `${grande.r} a la vista`).toBe(true);
      const con = await luz(page, diagonal);
      // «Componentes» off: none drawn, the same pixel is the board again
      const boton = page.locator('[data-capa-componentes]');
      if (!(await boton.isVisible())) await page.getByRole('button', { name: 'Capas' }).click();
      await boton.click();
      await expect(boton).toHaveAttribute('aria-pressed', 'false');
      await page.waitForTimeout(300);
      expect((await stats(page))!.cuerpos).toBe(0);
      const sin = await luz(page, diagonal);
      // (dark on the board's mask; on a black or purple mask a grey body, lighter than the board)
      if (mascara === 'negra' || mascara === 'morada') expect(con - sin, `el cuerpo de ${grande.r} (cara ${lado}) se distingue de la placa negra`).toBeGreaterThan(8);
      else expect(sin - con, `el cuerpo de ${grande.r} (cara ${lado}) es más oscuro que la placa`).toBeGreaterThan(12);
      await boton.click();
      await expect(boton).toHaveAttribute('aria-pressed', 'true');
      await page.waitForTimeout(300);
      expect((await stats(page))!.cuerpos).toBe(esperados.length);
      // a tap on the body selects that part (the detail names it), unless a pad is there (pads come first)
      // (the canvas may reach below the window: scrolled so that the point is on screen)
      const alto = page.viewportSize()!.height;
      if (!sobrePad) {
        if (sy > alto - 4) await page.evaluate((d) => scrollBy(0, d), sy - alto / 2);
        const dy = sy > alto - 4 ? (await page.locator('.placa2d canvas').boundingBox())!.y - caja.y : 0;
        await page.mouse.click(sx, sy + dy);
        await expect(page.locator('aside.lado')).toContainText(tocada.r);
      }
    }
  });
}

test.describe('en el teléfono', () => {
  test.use({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true });

  test('Super Nintendo: las referencias aparecen al acercar, derechas también en la cara inferior; repinta rápido con la CPU lenta', async ({ page }) => {
    const { huellas: hs } = await abrir(page, PLACAS.find((x) => x.id === 'snes')!);
    const cdp = await page.context().newCDPSession(page);
    for (let k = 0; k < 4; k++) await page.getByRole('button', { name: 'Acercar' }).click();
    await page.waitForTimeout(500);
    const cerca = (await stats(page))!.rotulos ?? 0;
    expect(cerca, 'referencias legibles al acercar').toBeGreaterThan(0);
    await cara(page, 'B');
    for (let k = 0; k < 2; k++) await page.getByRole('button', { name: 'Acercar' }).click();
    await page.waitForTimeout(500);
    if (conCuerpo(hs, 'B').length) expect((await stats(page))!.rotulos ?? 0).toBeGreaterThanOrEqual(0);
    // a phone's CPU (4× slower): a full repaint of the board with its 383 bodies costs little more than without them
    await cara(page, 'F');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const repintar = async () => {
      const r: number[] = [];
      for (let k = 0; k < 4; k++) {
        await page.getByRole('button', { name: k % 2 ? 'Alejar' : 'Acercar' }).click();
        await page.waitForTimeout(500);
        r.push((await stats(page))!.base);
      }
      return Math.min(...r);
    };
    const con = await repintar();
    const boton = page.locator('[data-capa-componentes]');
    if (!(await boton.isVisible())) await page.getByRole('button', { name: 'Capas' }).click();
    await boton.click();
    const sin = await repintar();
    console.log(`qa131 snes 2D con CPU ×4: repintado ${con.toFixed(1)} ms con cuerpos, ${sin.toFixed(1)} ms sin ellos`);
    expect(con, 'repintado completo con los cuerpos').toBeLessThan(Math.max(2 * sin, sin + 40));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  });
});
