// 2.0 (n64ps1): the Nintendo 64 (OpeN64, NUS-CPU-03) and the PlayStation (pu-18, PU-18) in «Consolas», in the
// browser. Their eight tabs; the photos of the real boards (iFixit's NUS-CPU-04; Antoinebercovici's two faces of a
// PU-18 and the pu-18 recreation) with their credits; photo → schematic → architecture; a footprint marked on the
// photo of its face; the address decoders; «Un fotograma»; the 2D board's +12V and +5V where OpeN64's schematic says
// +3.3V; «Busque la avería» on both boards; «Fuentes» with the licences; and, on the owner's phone (412×915, DPR 3.5,
// touch) in the dark and sepia themes, no view wider than the screen.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.n64ps1.config.ts tests/consolas-n64ps1.spec.ts
// (EPA_CAPTURAS=<folder>: screenshots of the phone views)
import { expect, test, type Page } from '@playwright/test';

const CAPTURAS = process.env.EPA_CAPTURAS;

/** Page errors and console errors of a page, to check that nothing breaks. */
function errores(page: Page): string[] {
  const lista: string[] = [];
  page.on('pageerror', (e) => lista.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') lista.push(m.text());
  });
  return lista;
}

const sinWebGL = (e: string) => !/WebGL|GPU stall|GL Driver/i.test(e);

async function sin3D(page: Page): Promise<void> {
  await page.addInitScript(() => ((globalThis as unknown as { __epaSinWebGL: boolean }).__epaSinWebGL = true));
}

async function tema(page: Page, t: 'oscuro' | 'sepia'): Promise<void> {
  await page.addInitScript((x) => {
    try {
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: x, tam: 18 }));
    } catch {
      /* private mode */
    }
  }, t);
}

const vista = (page: Page) => page.getByRole('navigation', { name: 'Vista' });

test.describe('escritorio', () => {
  test.skip(({ isMobile }) => isMobile, 'the phone has its own test below');

  test('las dos consolas: en la lista y con las ocho pestañas', async ({ page }) => {
    const err = errores(page);
    for (const [m, nombre] of [
      ['n64', 'Nintendo 64'],
      ['ps1', 'PlayStation'],
    ] as const) {
      await page.goto(`#/consolas/${m}/foto`);
      await expect(page.getByRole('navigation', { name: 'Consola' }).getByRole('link', { name: new RegExp(nombre) })).toHaveAttribute('aria-current', 'page');
      for (const t of ['Foto', 'Arquitectura', 'Un fotograma', 'Esquema', 'Placa en 3D', 'Placa en 2D', 'Busque la avería', 'Fuentes'])
        await expect(vista(page).getByRole('link', { name: t, exact: true }), `${m}: ${t}`).toBeVisible();
      await expect(page.getByTestId('sin-esquema')).toHaveCount(0);
    }
    expect(err).toEqual([]);
  });

  test('Nintendo 64: la foto de iFixit, del RCP al esquema y a la arquitectura', async ({ page }) => {
    await page.goto('#/consolas/n64/foto');
    await expect(page.locator('.foto-vista img')).toHaveAttribute('src', /foto-cpu04\.jpg$/);
    await expect(page.locator('.foto-vista .credito')).toContainText('Foto: iFixit, «Nintendo 64 Teardown», CC BY-NC-SA 3.0');
    await expect(page.locator('.foto-vista .lista button')).toHaveCount(18);
    await page.locator('button[data-hotspot="rcp"]').click();
    const ficha = page.locator('.foto-vista .ficha');
    await expect(ficha).toContainText('RCP');
    await ficha.getByRole('button', { name: 'Ver en el esquema' }).click();
    await expect(page).toHaveURL(/#\/consolas\/n64\/esquema\/U9$/);
    await expect(page.locator('.marco')).toHaveAttribute('data-simbolo', 'U9');
    await page.locator('.esquema .ficha').getByRole('button', { name: 'Ver en la arquitectura' }).click();
    await expect(page).toHaveURL(/#\/consolas\/n64\/arquitectura\/bloque%3Arcp$/);
    await expect(page.locator('.arquitectura .ficha').last()).toContainText('RCP');
    // a footprint of the board that no hotspot names, marked on the photo by its PCB position
    await page.goto('#/consolas/n64/foto/C130');
    await expect(page.locator('.foto-vista .marcador')).toHaveAttribute('data-ref', 'C130');
    await expect(page.locator('.foto-vista .ficha')).toContainText('OpeN64');
  });

  test('PlayStation: las dos caras de la PU-18 y la recreación, cada pieza en la foto de su cara', async ({ page }) => {
    await page.goto('#/consolas/ps1/foto');
    const tabs = page.getByRole('tablist', { name: 'Foto' }).getByRole('tab');
    await expect(tabs).toHaveCount(3);
    await expect(page.locator('button[data-foto="cara-a"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.foto-vista .credito')).toContainText('Foto: Antoinebercovici, Wikimedia Commons, CC BY-SA 4.0');
    await page.locator('button[data-hotspot="gpu"]').click();
    await expect(page.locator('.foto-vista .ficha')).toContainText('IC203');
    await page.locator('button[data-foto="cara-b"]').click();
    await expect(page.locator('.foto-vista img')).toHaveAttribute('src', /foto-cara-b\.jpg$/);
    await page.locator('button[data-foto="pu18"]').click();
    await expect(page.locator('.foto-vista .credito')).toContainText('CC0');
    // the controllers' fuse PS605 is on the component side (on a fresh load: an open photo that also shows the part,
    // here the recreation, stays)
    await page.goto('#/consolas/ps1/foto/PS605');
    await page.reload();
    await expect(page.locator('button[data-foto="cara-a"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.foto-vista .ficha')).toContainText('PS605');
    // a part no hotspot names: its marker, from pu-18's footprint
    await page.goto('#/consolas/ps1/foto/R33');
    await expect(page.locator('.foto-vista .marcador')).toHaveAttribute('data-ref', 'R33');
    // the block of a hotspot of the solder side, from the architecture
    await page.goto('#/consolas/ps1/arquitectura/foto%3Ab-mech');
    await expect(page.locator('.arquitectura .ficha').last()).toBeVisible();
  });

  test('arquitectura: los decodificadores de la N64 y de la PlayStation', async ({ page }) => {
    const res = page.locator('.resultado');
    const deco = async (d: string, sel: string): Promise<void> => {
      await page.getByRole('textbox', { name: 'Dirección en hexadecimal' }).fill(d);
      await page.getByRole('button', { name: 'Decodificar', exact: true }).click();
      await expect(res, d).toHaveAttribute('data-seleccion', sel);
    };
    await page.goto('#/consolas/n64/arquitectura');
    await deco('A4040010', 'RSP');
    await deco('BFC00000', 'PIF');
    await deco('B0001000', 'CART');
    await page.goto('#/consolas/ps1/arquitectura');
    await deco('BFC00000', '~CS2');
    await deco('1F801C00', '~CS4');
    await deco('1F801800', '~CS5');
    await deco('00345678', '/RAS, /CAS');
    await expect(res).toContainText('espejo');
  });

  test('«Un fotograma»: 13 pasos en la N64 y 12 en la PlayStation', async ({ page }) => {
    await page.goto('#/consolas/n64/fotograma');
    await expect(page.locator('[data-cuenta]')).toHaveText('1/13');
    await page.goto('#/consolas/n64/fotograma/7');
    await expect(page.locator('#fotograma-titulo')).toContainText('índice 6');
    await page.goto('#/consolas/ps1/fotograma');
    await expect(page.locator('[data-cuenta]')).toHaveText('1/12');
    await page.goto('#/consolas/ps1/fotograma/6');
    await expect(page.locator('#fotograma-titulo')).toContainText('índice 6');
  });

  test('la placa en 2D de la N64: el 78M05 entre +12V y +5V, como en la PCB', async ({ page }) => {
    await sin3D(page);
    const err = errores(page);
    await page.goto('#/consolas/n64/placa2d/U13');
    const lado = page.locator('.placa-consola .lado');
    await expect(lado.locator('.nombre')).toContainText('U13');
    await expect(lado).toContainText('+12V');
    await expect(lado).toContainText('+5V');
    await lado.getByRole('button', { name: 'Ver en el esquema' }).click();
    await expect(page).toHaveURL(/#\/consolas\/n64\/esquema\/U13$/);
    await page.goto('#/consolas/ps1/placa2d/PS605');
    await expect(lado.locator('.nombre')).toContainText('PS605');
    expect(err.filter(sinWebGL)).toEqual([]);
  });

  test('la placa en 3D abre con una pieza elegida, sin error', async ({ page }) => {
    const err = errores(page);
    for (const [m, r] of [
      ['n64', 'U9'],
      ['ps1', 'IC103'],
    ] as const) {
      await page.goto(`#/consolas/${m}/placa3d/${r}`);
      await expect(page.locator('.placa-consola .lado .nombre'), m).toContainText(r);
      await page.waitForTimeout(1500);
    }
    expect(err.filter(sinWebGL)).toEqual([]);
  });

  test('Busque la avería en la PU-18: PS605 abierto, medido en la placa', async ({ page }) => {
    await sin3D(page);
    await page.goto('#/consolas/ps1/averia/ps605-abierto');
    await expect(page.locator('[data-averia-placa]')).toBeVisible({ timeout: 60_000 });
    const lectura = page.locator('[data-lectura-averia]');
    const puntas = async (r: string, n: string) => {
      await page.locator('[data-select-punta="roja"]').selectOption(r);
      await page.locator('[data-select-punta="negra"]').selectOption(n);
    };
    // before the fuse the 3.3 V are there; at the controllers' connector they are not; the 8 V are
    await puntas('CN602.3', 'CN602.2');
    await expect(lectura).toContainText(': 3,30 V');
    await puntas('CN102.9', 'CN102.7');
    await expect(lectura).toContainText(': 0,00 V');
    await puntas('CN102.4', 'CN102.7');
    await expect(lectura).toContainText(': 8,00 V');
    // off and unplugged, across the fuse: open
    await page.locator('[data-funcion="Ω"]').click();
    await page.locator('[data-encendida="no"]').click();
    await puntas('PS605.1', 'PS605.2');
    await expect(lectura).toContainText('OL (abierto)');
    await page.locator('[data-sospechoso="ps602"]').click();
    await expect(page.locator('[data-diagnostico]')).toHaveAttribute('data-diagnostico', 'mal');
    await page.locator('[data-sospechoso="ps605"]').click();
    await expect(page.locator('[data-diagnostico]')).toHaveAttribute('data-diagnostico', 'bien');
    await expect(page.locator('[data-diagnostico]')).toContainText('PS605 abierto');
    await expect(page.locator('[data-fuentes-averia]')).toContainText('ConsoleMods');
  });

  test('Busque la avería en la N64: el 78M05 muerto, y la entrada de la fuente antes del interruptor', async ({ page }) => {
    await sin3D(page);
    await page.goto('#/consolas/n64/averia/regulador-muerto');
    await expect(page.locator('[data-averia-placa]')).toBeVisible({ timeout: 60_000 });
    const lectura = page.locator('[data-lectura-averia]');
    await page.locator('[data-select-punta="roja"]').selectOption('U13.1');
    await page.locator('[data-select-punta="negra"]').selectOption('U13.2');
    await expect(lectura).toContainText(': 12,00 V');
    await page.locator('[data-select-punta="roja"]').selectOption('U13.3');
    await expect(lectura).toContainText(': 0,00 V');
    // (P4.2 is /+3.3V Pre-Switch: before the fix it read «sin dato»)
    await page.locator('[data-select-punta="roja"]').selectOption('P4.2');
    await expect(lectura).toContainText(': 3,30 V');
    await page.locator('[data-sospechoso="regulador"]').click();
    await expect(page.locator('[data-diagnostico]')).toHaveAttribute('data-diagnostico', 'bien');
  });

  test('Fuentes: las licencias de las recreaciones y de las fotos, con sus enlaces', async ({ page }) => {
    await page.goto('#/consolas/n64/fuentes');
    let f = page.locator('.fuentes');
    await expect(f).toContainText('CERN-OHL-P v2');
    await expect(f).toContainText('CC BY-NC-SA 3.0');
    await expect(f.locator('a[href="https://github.com/cy-888/OpeN64"]').first()).toBeVisible();
    await page.goto('#/consolas/ps1/fuentes');
    f = page.locator('.fuentes');
    await expect(f).toContainText('CC0');
    await expect(f).toContainText('Antoinebercovici');
    await expect(f.locator('a[href="https://commons.wikimedia.org/wiki/File:Sony_Playstation_1_SCPH-5502_motherboard_top.jpg"]')).toHaveCount(1);
    await expect(f).toContainText('CC BY-SA 4.0');
  });
});

test('en el teléfono, oscuro y sepia: ninguna vista de la N64 ni de la PlayStation desborda a lo ancho', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone project only');
  test.setTimeout(400_000);
  await sin3D(page);
  const err = errores(page);
  for (const t of ['oscuro', 'sepia'] as const) {
    await tema(page, t);
    // (the views below change only the hash: a full load makes the new theme's init script run)
    await page.goto('#/consolas/n64/foto');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-tema', t);
    for (const m of ['n64', 'ps1'])
      for (const v of ['foto', 'arquitectura', 'fotograma', 'esquema', 'placa2d', 'placa3d', 'averia', 'fuentes']) {
        await page.goto(`#/consolas/${m}/${v}`);
        await page.waitForTimeout(700);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `${t} ${m}/${v}`).toBeLessThanOrEqual(412);
        if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${t}-${m}-${v}.png` });
      }
  }
  expect(err.filter(sinWebGL)).toEqual([]);
});
