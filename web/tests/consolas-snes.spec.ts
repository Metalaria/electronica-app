// «Consolas»: the Super Nintendo (PAL SNSP-CPU-01, stonedDiscord's nonSNES). Tabs (with «Un fotograma», 0.9), photo
// hotspots placed from the PCB footprints, address decoding on the A and B buses, PAL/NTSC, schematic ↔ board,
// the GPL text in «Fuentes», no horizontal overflow on a phone, and screenshots of every tab (tablet portrait
// 800 × 1280 and phone 412 × 915, light and dark) into tests/capturas/consolas-snes/.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.snes.config.ts tests/consolas-snes.spec.ts
import { expect, test, type Page } from '@playwright/test';

async function tema(page: Page, t: 'claro' | 'oscuro'): Promise<void> {
  await page.addInitScript((x) => {
    try {
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: x, tam: 18 }));
    } catch {
      /* private mode */
    }
  }, t);
}

test('Super Nintendo: sus pestañas, con «Un fotograma»', async ({ page }) => {
  await page.goto('#/consolas/snes/foto');
  const pestanas = page.getByRole('navigation', { name: 'Vista' });
  for (const p of ['Foto', 'Arquitectura', 'Un fotograma', 'Esquema', 'Placa en 3D', 'Placa en 2D', 'Fuentes'])
    await expect(pestanas.getByRole('link', { name: p, exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Consola' }).getByRole('link', { name: /Super Nintendo/ })).toHaveAttribute('aria-current', 'page');
  // «Un fotograma» opens on its first step (the steps themselves: tests/fotograma09.spec.ts)
  await page.goto('#/consolas/snes/fotograma');
  await expect(pestanas.getByRole('link', { name: 'Un fotograma', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-fotograma="snes"]')).toHaveAttribute('data-paso', '1');
});

test('Super Nintendo: un chip de la foto salta al esquema y a la arquitectura', async ({ page }) => {
  await page.goto('#/consolas/snes/foto');
  await page.locator('button[data-hotspot="cpu"]').click();
  const ficha = page.locator('.foto-vista .ficha');
  await expect(ficha).toContainText('5A22');
  await ficha.getByRole('button', { name: 'Ver en el esquema' }).click();
  await expect(page).toHaveURL(/#\/consolas\/snes\/esquema\/U1$/);
  await expect(page.locator('.marco')).toHaveAttribute('data-simbolo', 'U1');
  await expect(page.locator('.esquema .ficha')).toContainText('100 pines');
  await page.locator('.esquema .ficha').getByRole('button', { name: 'Ver en la arquitectura' }).click();
  await expect(page).toHaveURL(/arquitectura\/bloque%3Acpu$/);
  await expect(page.locator('.arquitectura .ficha').last()).toContainText('65C816');
});

test('Super Nintendo: cualquier componente se marca en la foto de su cara por su huella', async ({ page }) => {
  // R30 is on the solder side: the second photo opens with a marker on it
  await page.goto('#/consolas/snes/foto/R30');
  await expect(page.locator('button[data-foto="cara-b"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.foto-vista .marcador')).toHaveAttribute('data-ref', 'R30');
  await expect(page.locator('.foto-vista .ficha')).toContainText('ajuste afín');
  // C73 is on the component side
  await page.goto('#/consolas/snes/foto/C73');
  await expect(page.locator('button[data-foto="cara-a"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.foto-vista .marcador')).toHaveAttribute('data-ref', 'C73');
  // a hotspot of the solder side
  await page.goto('#/consolas/snes/foto/foto%3Ab-rgb');
  await expect(page.locator('.foto-vista .ficha')).toContainText('Q3');
});

test('Super Nintendo: el decodificador distingue el bus A, el bus B y los registros internos', async ({ page }) => {
  await page.goto('#/consolas/snes/arquitectura');
  const dir = page.getByRole('textbox', { name: 'Dirección en hexadecimal' });
  const res = page.locator('.resultado');
  const deco = async (d: string, w: boolean, sel: string): Promise<void> => {
    await dir.fill(d);
    await page.getByRole('combobox', { name: 'Lectura o escritura' }).selectOption({ label: w ? 'Escritura' : 'Lectura' });
    await page.getByRole('button', { name: 'Decodificar', exact: true }).click();
    await expect(res).toHaveAttribute('data-seleccion', sel);
  };
  await deco('008000', false, '/ROMSEL');
  await deco('7E0010', true, '/RAMSEL');
  await deco('801234', false, '/RAMSEL');
  await expect(res).toContainText('$7E1234');
  await deco('002118', true, 'PPU');
  await deco('002141', false, 'APU');
  await deco('004016', false, 'CPU interno');
  await expect(res).toContainText('12 ciclos');
  await page.getByRole('combobox', { name: 'Espacio de direcciones' }).selectOption('b');
  await deco('80', true, 'WRAM B');
});

test('Super Nintendo: PAL por defecto, NTSC a elegir', async ({ page }) => {
  await page.goto('#/consolas/snes/arquitectura');
  await expect(page.locator('.nota-capa[data-norma]')).toHaveAttribute('data-norma', 'pal');
  await page.getByRole('tab', { name: 'Cuadro, NMI y mandos' }).click();
  await expect(page.locator('.descripcion')).toContainText('312 líneas de 64,09 µs (50,007 Hz)');
  await page.getByRole('group', { name: 'Norma de vídeo' }).getByRole('button', { name: 'NTSC · 60 Hz' }).click();
  await expect(page.locator('.nota-capa[data-norma]')).toHaveAttribute('data-norma', 'ntsc');
  await expect(page.locator('.descripcion')).toContainText('262 líneas');
  await page.getByRole('tab', { name: 'DMA', exact: true }).click();
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Paso adelante' }).click();
  await expect(page.locator('.paso')).toContainText('Byte');
});

test('Super Nintendo: del esquema a la placa y vuelta', async ({ page }) => {
  await page.addInitScript(() => ((globalThis as unknown as { __epaSinWebGL: boolean }).__epaSinWebGL = true));
  await page.goto('#/consolas/snes/esquema');
  const buscar = page.getByRole('searchbox', { name: 'Buscar en el esquema' });
  await buscar.fill('U14');
  await buscar.press('Enter');
  await expect(page.locator('.marco')).toHaveAttribute('data-simbolo', 'U14');
  await expect(page.locator('.esquema .ficha')).toContainText('S-DSP');
  await page.getByRole('button', { name: 'Ver en la placa', exact: true }).click();
  await expect(page).toHaveURL(/#\/consolas\/snes\/placa2d\/U14$/);
  const lado = page.locator('.placa-consola .lado');
  await expect(lado.locator('.nombre')).toContainText('U14');
  const d = (await page.evaluate(async () => (await fetch('consolas/placas/snes.json')).json())) as {
    consola: { enlazada: boolean; refs: string[] };
  };
  expect(d.consola.enlazada).toBe(true);
  expect(d.consola.refs.length).toBe(400);
  await lado.locator('.nodos button').filter({ hasText: 'MA0' }).first().click();
  await expect(page).toHaveURL(/placa2d\/red%3A%2FMA0$/);
  await lado.getByRole('button', { name: 'Ver en el esquema' }).click();
  await expect(page).toHaveURL(/esquema\/red%3A%2FMA0$/);
  await expect(page.locator('.marco')).toHaveAttribute('data-red', /\d+/);
});

test('Super Nintendo: las fuentes llevan la licencia GPL-3.0 completa', async ({ page }) => {
  await page.goto('#/consolas/snes/fuentes');
  const f = page.locator('.fuentes');
  await expect(f).toContainText('stonedDiscord/nonSNES');
  await expect(f).toContainText('cf2e70b');
  await expect(f).toContainText('arzi84');
  await expect(page.locator('.placas-fuentes')).toContainText('GPL-3.0');
  await f.getByText('Texto completo de la licencia').first().click();
  await expect(f.locator('.texto-licencia pre').first()).toContainText('GNU GENERAL PUBLIC LICENSE');
  await expect(f).toContainText('P6, J3, P7, J4, J5');
});

test('Super Nintendo en el teléfono: ninguna pestaña desborda a lo ancho', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => ((globalThis as unknown as { __epaSinWebGL: boolean }).__epaSinWebGL = true));
  for (const v of ['foto', 'arquitectura', 'esquema', 'placa3d', 'placa2d', 'fuentes']) {
    await page.goto(`#/consolas/snes/${v}`);
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), v).toBeLessThanOrEqual(412);
  }
  await ctx.close();
});

const TAMANOS = [
  { nombre: 'tableta-vertical', w: 800, h: 1280, dpr: 2 },
  { nombre: 'movil', w: 412, h: 915, dpr: 2.625 },
];

for (const t of TAMANOS) {
  for (const modo of ['claro', 'oscuro'] as const) {
    test(`capturas Super Nintendo ${t.nombre} ${modo}`, async ({ browser }) => {
      test.setTimeout(600_000);
      const ctx = await browser.newContext({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: t.dpr, hasTouch: true });
      const page = await ctx.newPage();
      await tema(page, modo);
      const vistas: [string, string][] = [
        ['foto', '#/consolas/snes/foto/foto%3Acpu'],
        ['foto-soldadura', '#/consolas/snes/foto/foto%3Ab-rgb'],
        ['arquitectura', '#/consolas/snes/arquitectura'],
        ['esquema', '#/consolas/snes/esquema/U13'],
        ['placa3d', '#/consolas/snes/placa3d/U1'],
        ['placa2d', '#/consolas/snes/placa2d/U2'],
        ['fuentes', '#/consolas/snes/fuentes'],
      ];
      for (const [nombre, ruta] of vistas) {
        if (nombre === 'placa3d') await page.evaluate(() => ((globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo = false));
        await page.goto(ruta);
        if (nombre === 'placa3d') {
          await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo === true, null, { timeout: 240_000 });
        }
        await page.waitForTimeout(1500);
        if (nombre === 'arquitectura') {
          for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Paso adelante' }).click();
        }
        await page.screenshot({ path: `tests/capturas/consolas-snes/${t.nombre}-${modo}-${nombre}.png` });
      }
      await ctx.close();
    });
  }
}
