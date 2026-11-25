// 1.3 (averias13) «Busque la avería» on a console's board (componentes/consolas/averia/), on the owner's phone (Pixel 8
// Pro: 412 × 915 CSS px, DPR 3.5, touch) with real touches through CDP: the Super Nintendo's «No enciende» (the
// lesson consola-snes/snes-averias, card averia-no-enciende) with the fuse open. On the photo of the bare PAL board
// the leads go on the pads by a tap (zooming in first where the pads are too small for a finger) and are dragged with
// the precise gesture (56 px above the finger, the pad named before release); the meter reads the fault's values;
// the list of test points does the same from the keyboard; naming a wrong part says which measurement tells them
// apart, the right one explains the fault with its sources. The same leads on the board in 3D (a tap on a pad, the
// lead's handle dragged). Only consoles with a documented fault get the tab.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c <config with a server> tests/averias13-navegador.spec.ts
import { expect, test, type Browser, type CDPSession, type Page } from '@playwright/test';
import { axe, sinHallazgos } from './accesibilidad10-comun';

type P = [number, number];
const ELEVACION = 56;
const CAPTURAS = process.env.EPA_CAPTURAS ?? '';

interface Ventana {
  __epaAveriaPlaca?: { fallo: () => string; puntas: () => { roja: string | null; negra: string | null }; pad3D: (id: string) => P | null };
  __epaFotoAveria?: { pantalla: (id: string) => { x: number; y: number } | null; escala: () => number; paso: () => number };
  __epaPlaca3DListo?: boolean;
}

async function telefono(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true });
  await ctx.route('https://api.github.com/**', (x) => x.fulfill({ status: 404, body: '{}' }));
  await ctx.addInitScript(() => localStorage.setItem('epa:sinc-ajustes', JSON.stringify({ auto: false })));
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp };
}

const toques = (cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', puntos: P[]) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: puntos.map(([x, y], id) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
async function tocar(page: Page, cdp: CDPSession, p: P) {
  await toques(cdp, 'touchStart', [p]);
  await page.waitForTimeout(40);
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(150);
}
async function deslizar(page: Page, cdp: CDPSession, de: P, a: P, pasos = 12) {
  for (let k = 1; k <= pasos; k++) {
    await toques(cdp, 'touchMove', [[de[0] + ((a[0] - de[0]) * k) / pasos, de[1] + ((a[1] - de[1]) * k) / pasos]]);
    await page.waitForTimeout(16);
  }
}

const puntas = (page: Page) => page.evaluate(() => (window as unknown as Ventana).__epaAveriaPlaca!.puntas());
const enFoto = async (page: Page, id: string): Promise<P> => {
  const q = await page.evaluate((x) => (window as unknown as Ventana).__epaFotoAveria!.pantalla(x), id);
  return [q!.x, q!.y];
};
/** A tap on a pad of the photo with the lead in hand; a first tap may only zoom in (pads too small): then again. */
async function ponerEnFoto(page: Page, cdp: CDPSession, id: string, punta: 'roja' | 'negra') {
  await page.locator(`[data-mano="${punta}"]`).tap();
  for (let i = 0; i < 3; i++) {
    await tocar(page, cdp, await enFoto(page, id));
    if ((await puntas(page))[punta] === id) return;
  }
  expect((await puntas(page))[punta]).toBe(id);
}

async function abrir(page: Page, averia = 'fusible-abierto') {
  await page.goto(`/#/consolas/snes/averia/${averia}`);
  await expect(page.locator('[data-averia-placa]')).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => !!(window as unknown as Ventana).__epaFotoAveria, null, { timeout: 30_000 });
  await page.locator('[data-foto-averia]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
}

test('Super Nintendo en el teléfono, sobre la foto: medir con las puntas, arrastrar una con precisión y encontrar el fusible abierto', async ({ browser }) => {
  test.setTimeout(150_000);
  const { ctx, page, cdp } = await telefono(browser);
  await abrir(page);
  expect(await page.evaluate(() => (window as unknown as Ventana).__epaAveriaPlaca!.fallo())).toBe('fusible-abierto');
  const lectura = page.locator('[data-lectura-averia]');
  // V⎓, console on: red on the 7805's output, black on its ground → 0 V (the fuse cuts everything)
  await ponerEnFoto(page, cdp, 'U12.3', 'roja');
  await ponerEnFoto(page, cdp, 'U12.2', 'negra');
  await expect(lectura).toContainText('Roja en U12, pata 3 (5 V de la lógica, salida del 7805)');
  await expect(lectura).toContainText(': 0,00 V');
  await expect(lectura).toContainText('«Salida del 7805»');
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/averia-foto-medir.png` });

  // the red lead dragged by a finger to the fuse's input side: it rides 56 px above the finger, the pad is named
  // in the loupe before release, and nothing is under the finger
  const de = await enFoto(page, 'U12.3');
  await toques(cdp, 'touchStart', [de]);
  await page.waitForTimeout(30);
  const destino = await enFoto(page, 'F1.1');
  await deslizar(page, cdp, de, [destino[0], destino[1] + ELEVACION]);
  await page.waitForTimeout(80);
  await expect(page.locator('[data-lupa]')).toBeVisible();
  await expect(page.locator('[data-destino]')).toHaveAttribute('data-destino', 'F1, pata 1 (salida del puente DB1, antes del fusible)');
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/averia-foto-lupa.png` });
  await toques(cdp, 'touchEnd', []);
  await page.waitForTimeout(300);
  expect((await puntas(page)).roja).toBe('F1.1');
  await expect(lectura).toContainText(': 10,00 V');
  await expect(page.locator('[data-ajuste-fino] button').first()).toBeVisible();
  // and after the fuse: 0 V
  await ponerEnFoto(page, cdp, 'F1.2', 'roja');
  await expect(lectura).toContainText(': 0,00 V');

  // a wrong part named after measuring: the measurement that tells them apart
  await page.locator('[data-sospechoso="regulador"]').tap();
  await expect(page.locator('[data-diagnostico]')).toHaveAttribute('data-diagnostico', 'mal');

  // Ω needs the console off: said; off and unplugged, across the fuse: OL
  await page.locator('[data-funcion="Ω"]').tap();
  await ponerEnFoto(page, cdp, 'F1.1', 'roja');
  await expect(lectura).toContainText('apáguela y desenchúfela');
  await page.locator('[data-encendida="no"]').tap();
  await ponerEnFoto(page, cdp, 'F1.2', 'negra');
  await expect(lectura).toContainText('OL (abierto)');
  await expect(lectura).toContainText('«Fusible F1, apagada»');

  // the fuse: found, explained with the lesson's sources
  await page.locator('[data-sospechoso="fusible"]').tap();
  await expect(page.locator('[data-diagnostico]')).toHaveAttribute('data-diagnostico', 'bien');
  await expect(page.locator('[data-diagnostico]')).toContainText('F1 abierto');
  const fuentes = page.locator('[data-fuentes-averia]');
  await expect(fuentes.getByRole('link', { name: 'ConsoleMods, «SNES:Power Supply Fuse»' })).toHaveAttribute('href', 'https://consolemods.org/wiki/SNES:Power_Supply_Fuse');
  await expect(fuentes).toContainText('Chromagi');
  await expect(fuentes).toContainText('Del libro: sección');
  await fuentes.scrollIntoViewIfNeeded();
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/averia-encontrada.png` });
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(ancho).toBeLessThanOrEqual(0);
  await ctx.close();
});

test('con el teclado y el lector de pantalla: la lista de puntos de prueba, las funciones y el diagnóstico', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/#/consolas/snes/averia/regulador-muerto');
  await expect(page.locator('[data-averia-placa]')).toBeVisible({ timeout: 60_000 });
  const lectura = page.locator('[data-lectura-averia]');
  // naming before measuring is refused
  await page.locator('[data-sospechoso="regulador"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-diagnostico]')).toContainText('Mida antes de señalar');
  await page.locator('[data-select-punta="roja"]').selectOption('U12.1');
  await page.locator('[data-select-punta="negra"]').selectOption('U12.2');
  await expect(lectura).toContainText(': 10,00 V');
  await expect(page.locator('.porque')).toContainText('recibe la entrada');
  await page.locator('[data-select-punta="roja"]').selectOption('U12.3');
  await expect(lectura).toContainText(': 0,00 V');
  // the clamp: no sign (polarity not in the sources)
  await page.locator('[data-select-punta="roja"]').selectOption('J1.2');
  await page.locator('[data-select-punta="negra"]').selectOption('J1.1');
  await expect(lectura).toContainText(': 10,00 V');
  // a net the fault says nothing about: no number
  await page.locator('[data-select-punta="roja"]').selectOption('J1.1');
  await page.locator('[data-select-punta="negra"]').selectOption('U12.2');
  await expect(lectura).toContainText('sin dato');
  await page.locator('[data-sospechoso="regulador"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-diagnostico]')).toHaveAttribute('data-diagnostico', 'bien');
  await expect(page.locator('[data-diagnostico]')).toContainText('El 7805 recibe la entrada');
  sinHallazgos(await axe(page, '[data-averia-placa]'), 'Busque la avería');
});

test('la placa en 3D en el teléfono: una punta por un toque en un pad y la otra arrastrada por su asa', async ({ browser }) => {
  test.setTimeout(180_000);
  const { ctx, page, cdp } = await telefono(browser);
  await abrir(page, 'adaptador-muerto');
  await page.locator('[data-vista-averia="3d"]').tap();
  await page.waitForFunction(() => (window as unknown as Ventana).__epaPlaca3DListo === true, null, { timeout: 120_000 });
  await page.waitForTimeout(1500);
  await page.locator('.tres').evaluate((e) => e.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(500);
  const pad3D = (id: string) => page.evaluate((x) => (window as unknown as Ventana).__epaAveriaPlaca!.pad3D(x), id);
  // red: a tap on the jack's contact (a first tap may only zoom in)
  for (let i = 0; i < 4 && (await puntas(page)).roja !== 'J1.1'; i++) {
    await tocar(page, cdp, (await pad3D('J1.1'))!);
    await page.waitForTimeout(900);
  }
  expect((await puntas(page)).roja).toBe('J1.1');
  await expect(page.locator('[data-asa-3d="roja"]')).toHaveCount(1);
  // black: the other contact
  for (let i = 0; i < 4 && (await puntas(page)).negra !== 'J1.2'; i++) {
    await tocar(page, cdp, (await pad3D('J1.2'))!);
    await page.waitForTimeout(900);
  }
  expect((await puntas(page)).negra).toBe('J1.2');
  await expect(page.locator('[data-lectura-averia]')).toContainText(': 0,00 V');
  // the red lead's handle dragged to the other contact of the jack... is the black's: to the fuse instead
  const asa = (await page.locator('[data-asa-3d="roja"]').boundingBox())!;
  const de: P = [asa.x + asa.width / 2, asa.y + asa.height / 2];
  const a = (await pad3D('DB1.1'))!;
  if (a[1] > 0 && a[1] + ELEVACION < 915) {
    await toques(cdp, 'touchStart', [de]);
    await deslizar(page, cdp, de, [a[0], a[1] + ELEVACION], 14);
    await page.waitForTimeout(100);
    await expect(page.locator('.etiqueta-3d')).toBeVisible();
    if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/averia-3d-arrastre.png` });
    await toques(cdp, 'touchEnd', []);
    await page.waitForTimeout(300);
    expect((await puntas(page)).roja).not.toBe('J1.1');
  }
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/averia-3d.png` });
  await ctx.close();
});

test('solo las consolas con una avería documentada con números (y sus piezas en la placa) tienen la pestaña', async ({ page }) => {
  for (const [m, n] of [
    ['snes', 1],
    ['sms', 1],
    ['nes', 1],
    ['megadrive', 0],
    ['neogeo', 0],
    ['gb', 0],
    ['gbc', 0],
    ['n64', 1], // (n64ps1)
    ['ps1', 1], // (n64ps1)
    ['saturn', 1], // (saturn20)
    ['gamecube', 0], // (gamecube20: no schematic, no board nets: the tab is hidden)
  ] as const) {
    await page.goto(`/#/consolas/${m}/foto`);
    await expect(page.locator('.pestanas a').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.pestanas a', { hasText: 'Busque la avería' }), m).toHaveCount(n);
  }
  // the NES: its fault in 3D only (no photo with the board's positions), the list works
  await page.goto('/#/consolas/nes/averia/c16-corto');
  await expect(page.locator('[data-averia-placa]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-vista-averia="foto"]')).toHaveCount(0);
  await page.locator('[data-select-punta="roja"]').selectOption('U6.40');
  await page.locator('[data-select-punta="negra"]').selectOption('U6.20');
  await expect(page.locator('[data-lectura-averia]')).toContainText(': 0,00 V');
  await page.locator('[data-select-punta="roja"]').selectOption('P3.4');
  await expect(page.locator('[data-lectura-averia]')).toContainText(': 9,00 V');
  await page.locator('[data-sospechoso="c16"]').click();
  await expect(page.locator('[data-diagnostico]')).toHaveAttribute('data-diagnostico', 'bien');
});
