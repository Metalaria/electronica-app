// The 3D component viewer on touch screens and small GPUs (0.7): a two-finger pinch on the model (also when it
// starts on a label) zooms the model and never the page; the camera never gets inside the model; the depth
// range is tight (depth precision on mobile GPUs); a label keeps its side while the model turns (no flicker);
// the cut faces are drawn (flat caps) and every model passes the coplanar-faces audit
// (tests/modelos3d-auditoria.mjs, run separately).
import { expect, test, type Page } from '@playwright/test';

type Visor = {
  orbita: { distancia: number; azimut: number; solido: { centro: { x: number; y: number; z: number }; radio: number } | null; aplicar(): void };
  camara: { near: number; far: number; position: { x: number; y: number; z: number } };
  etiquetas: { lado: number; visible: boolean; el: HTMLElement }[];
  pedir(): void;
};

async function abrir(page: Page, tipo: string): Promise<void> {
  await page.goto(`/#/componentes/3d/${tipo}`);
  await page.waitForFunction((t) => (globalThis as { __epaVisor3d?: { datos?: { tipo: string } } }).__epaVisor3d?.datos?.tipo === t, tipo, { timeout: 60_000 });
  await page.waitForTimeout(600);
}

test.describe('pantalla táctil', () => {
  test.use({ viewport: { width: 800, height: 1100 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test('pellizcar sobre el modelo (o sobre una etiqueta) acerca el modelo, no la página', async ({ page }) => {
    await abrir(page, 'resistencia-smd');
    const cdp = await page.context().newCDPSession(page);
    const distancia = () => page.evaluate(() => (globalThis as unknown as { __epaVisor3d: { visor: Visor } }).__epaVisor3d.visor.orbita.distancia);
    const escala = () => page.evaluate(() => window.visualViewport?.scale ?? 1);
    const pellizco = async (x: number, y: number) => {
      const puntos = (d: number) => [
        { x: x - d, y, id: 1 },
        { x: x + d, y, id: 2 },
      ];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: puntos(30) });
      for (let d = 30; d <= 150; d += 10) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: puntos(d) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(300);
    };
    const caja = (await page.locator('.visor3d .lienzo').boundingBox())!;
    const d0 = await distancia();
    await pellizco(caja.x + caja.width / 2, caja.y + caja.height / 2);
    const d1 = await distancia();
    expect(d1, 'el modelo se acerca').toBeLessThan(d0 * 0.9);
    expect(await escala(), 'la página no se amplía').toBe(1);
    // Starting on a label: the page still does not zoom.
    const etiqueta = page.locator('.visor3d .etiqueta3d:not(.oculta)').first();
    if (await etiqueta.count()) {
      const b = (await etiqueta.boundingBox())!;
      await pellizco(b.x + b.width / 2, b.y + b.height / 2);
      expect(await escala(), 'la página no se amplía desde una etiqueta').toBe(1);
    }
  });
});

test('la cámara no entra en el modelo y el rango de profundidad es estrecho', async ({ page }) => {
  await abrir(page, 'resistencia-smd');
  const canvas = page.locator('.visor3d canvas');
  const b = (await canvas.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.keyboard.down('Control');
  for (let i = 0; i < 40; i++) await page.mouse.wheel(0, -400);
  await page.keyboard.up('Control');
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const v = (globalThis as unknown as { __epaVisor3d: { visor: Visor } }).__epaVisor3d.visor;
    const s = v.orbita.solido!;
    const p = v.camara.position;
    return { d: Math.hypot(p.x - s.centro.x, p.y - s.centro.y, p.z - s.centro.z), radio: s.radio, near: v.camara.near, far: v.camara.far };
  });
  expect(r.d).toBeGreaterThanOrEqual(r.radio * 0.999);
  // At the default view far/near was 6000 in 0.6 (16-bit depth buffers fought); now a few units.
  await page.keyboard.press('0');
  await page.locator('.visor3d canvas').focus();
  await page.keyboard.press('0');
  // The reset is animated (about 0.6 s, longer on a busy machine with SwiftShader): wait for it to land.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const v = (globalThis as unknown as { __epaVisor3d: { visor: Visor } }).__epaVisor3d.visor;
          return v.camara.far / v.camara.near;
        }),
      { timeout: 15_000 },
    )
    .toBeLessThan(20);
});

test('una etiqueta no cambia de lado a cada paso al girar el modelo (LDR)', async ({ page }) => {
  await abrir(page, 'ldr');
  const cambios = await page.evaluate(async () => {
    const v = (globalThis as unknown as { __epaVisor3d: { visor: Visor } }).__epaVisor3d.visor;
    const lados = new Map<number, number[]>();
    const a0 = v.orbita.azimut;
    for (let k = 0; k <= 60; k++) {
      v.orbita.azimut = a0 + (k * 2 * Math.PI) / 180;
      v.orbita.aplicar();
      v.pedir();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      v.etiquetas.forEach((e, i) => {
        if (!e.visible) return;
        const l = lados.get(i) ?? [];
        if (l[l.length - 1] !== e.lado) l.push(e.lado);
        lados.set(i, l);
      });
    }
    return [...lados.values()].map((l) => l.length - 1);
  });
  expect(cambios.length).toBeGreaterThan(0);
  for (const c of cambios) expect(c).toBeLessThanOrEqual(1);
});

test('el corte dibuja las caras cortadas (tapas) del SMD', async ({ page }) => {
  await abrir(page, 'resistencia-smd');
  await page.click('[data-control="corte"]');
  await page.waitForTimeout(800);
  const tapas = await page.evaluate(() => {
    type Nodo = { name: string; parent: Nodo | null };
    const v = (globalThis as unknown as { __epaVisor3d: { visor: { tapas: (Nodo & { visible: boolean })[] } } }).__epaVisor3d.visor;
    // The part a cap belongs to: the nearest named ancestor of the cap.
    const nombres: string[] = [];
    for (const t of v.tapas.filter((t) => t.visible)) for (let n = t.parent; n; n = n.parent) if (n.name) nombres.push(n.name);
    return [...new Set(nombres)];
  });
  expect(tapas).toEqual(expect.arrayContaining(['sustrato', 'recubrimiento', 'terminacion-1', 'terminacion-2']));
});
