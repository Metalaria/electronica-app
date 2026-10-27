// «Consolas» end to end: photo hotspot -> schematic, net highlight across sheets (by search and by tapping a
// pin on the canvas), address decoding in the architecture view, the extra photos and copper traces, footprint
// markers, I/O and Z80 address spaces, the SoC layer, the new machines' sources, and screenshots (phone, 1280 × 800 at DPR 2,
// tablet portrait; light and dark) into tests/capturas/.
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

test('un punto de la foto salta a su símbolo en el esquema', async ({ page }) => {
  await page.goto('#/consolas/nes/foto');
  await page.locator('button[data-hotspot="U3"]').click();
  const ficha = page.locator('.foto-vista .ficha');
  await expect(ficha).toContainText('SN74LS139N');
  await ficha.getByRole('button', { name: 'Ver en el esquema' }).click();
  await expect(page).toHaveURL(/#\/consolas\/nes\/esquema\/U3$/);
  await expect(page.locator('.marco')).toHaveAttribute('data-simbolo', 'U3');
  await expect(page.locator('.esquema .ficha')).toContainText('74HC139');
  await expect(page.locator('.esquema .ficha')).toContainText('16 pines');
  // and from the schematic back to the architecture block
  await page.locator('.esquema .ficha').getByRole('button', { name: 'Ver en la arquitectura' }).click();
  await expect(page).toHaveURL(/arquitectura\/bloque%3Adec$/);
  await expect(page.locator('.arquitectura .ficha').last()).toContainText('Decodificador');
});

test('una red se resalta en todas las hojas donde está', async ({ page }) => {
  await page.goto('#/consolas/neogeo/esquema');
  const buscar = page.getByRole('searchbox', { name: 'Buscar en el esquema' });
  await buscar.fill('PCK1');
  await buscar.press('Enter');
  const marco = page.locator('.marco');
  await expect(marco).toHaveAttribute('data-red', /\d+/);
  const red = await marco.getAttribute('data-red');
  const ficha = page.locator('.esquema .ficha');
  await expect(ficha).toContainText('Está en 2 hojas');
  await expect(ficha).toContainText('U21.103');
  const hoja1 = await marco.getAttribute('data-hoja');
  await ficha.locator('.chip:not(.activo)').first().click();
  await expect(marco).not.toHaveAttribute('data-hoja', hoja1 ?? '');
  await expect(marco).toHaveAttribute('data-red', red ?? '');
});

test('tocar un pin en el lienzo resalta su red', async ({ page, request }) => {
  await page.goto('#/consolas/nes/esquema');
  const marco = page.locator('.marco');
  await expect(marco.locator('canvas')).toBeVisible();
  await page.waitForFunction(() => !!(globalThis as unknown as { __epaEsquemaVista?: unknown }).__epaEsquemaVista);
  // zoom in on U6 (the CPU) so that its pins are far apart
  await page.getByRole('searchbox', { name: 'Buscar en el esquema' }).fill('U6');
  await page.getByRole('searchbox', { name: 'Buscar en el esquema' }).press('Enter');
  await expect(marco).toHaveAttribute('data-simbolo', 'U6');
  await page.waitForTimeout(300);
  const capa = (await (await request.get('consolas/nes/hoja-0.json')).json()) as { pines: [number, string, string, string, number, number, number, number][] };
  const pin = capa.pines.find((p) => p[1] === 'U6' && p[2] === '31')!; // M2
  const v = await page.evaluate(() => (globalThis as unknown as { __epaEsquemaVista: { k: number; ox: number; oy: number } }).__epaEsquemaVista);
  const caja = (await marco.locator('canvas').boundingBox())!;
  const x = caja.x + v.ox + ((pin[4] + pin[6]) / 2) * v.k;
  const y = caja.y + v.oy + ((pin[5] + pin[7]) / 2) * v.k;
  await page.mouse.click(x, y);
  await expect(page.locator('.esquema .ficha .nombre')).toHaveText('M2');
  await expect(page.locator('.esquema .ficha')).toContainText('U3.14');
});

test('la decodificación de direcciones baja la selección correcta', async ({ page }) => {
  await page.goto('#/consolas/nes/arquitectura');
  const dir = page.getByRole('textbox', { name: 'Dirección en hexadecimal' });
  await dir.fill('3FF2');
  await page.getByRole('button', { name: 'Decodificar', exact: true }).click();
  const res = page.locator('.resultado');
  await expect(res).toHaveAttribute('data-seleccion', 'PPU /CS');
  await expect(res).toContainText('$2002');
  await dir.fill('8000');
  await page.getByRole('button', { name: 'Decodificar', exact: true }).click();
  await expect(res).toHaveAttribute('data-seleccion', '/ROMSEL');
  // step to the access cycle: the narration names the chosen address
  for (let i = 0; i < 40; i++) {
    if ((await page.locator('.paso').textContent())?.includes('Ciclo 4')) break;
    await page.getByRole('button', { name: 'Paso adelante' }).click();
  }
  await expect(page.locator('.paso')).toContainText('$8000');

  await page.goto('#/consolas/neogeo/arquitectura');
  await page.getByRole('textbox', { name: 'Dirección en hexadecimal' }).fill('3C0002');
  await page.getByRole('combobox', { name: 'Lectura o escritura' }).selectOption({ label: 'Escritura' });
  await page.getByRole('button', { name: 'Decodificar', exact: true }).click();
  await expect(page.locator('.resultado')).toHaveAttribute('data-seleccion', 'LSPWE');
});

test('la Neo Geo cita los documentos de SNK en la foto y en las fuentes', async ({ page }) => {
  await page.goto('#/consolas/neogeo/foto');
  await page.locator('button[data-hotspot="proc0"]').click();
  const ficha = page.locator('.foto-vista .ficha');
  await expect(ficha.locator('.verificado')).toContainText('MV4 h.1');
  await expect(ficha).toContainText('PA0–PA3');
  await page.goto('#/consolas/neogeo/fuentes');
  const tabla = page.locator('.fuentes table');
  await expect(tabla).toContainText('LSPC2-A2 (U21)');
  await expect(tabla).toContainText('MV4 h.4');
  await expect(page.locator('.fuentes')).toContainText('Multi Video System (MV4)');
});

test('Game Boy: cambiar de foto y resaltar las pistas de una red', async ({ page }) => {
  await page.goto('#/consolas/gb/foto');
  const pestana = page.locator('button[data-foto="pistas"]');
  await pestana.click();
  await expect(pestana).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('combobox', { name: 'Resaltar un grupo de redes' }).selectOption('cpu_address');
  await expect(page.locator('.foto-vista .pistas')).toHaveAttribute('data-redes', /^[1-9]\d*$/);
  await page.locator('.chips-redes button').first().click();
  await expect(page.locator('.red-sel')).toContainText('resaltada');
  await page.getByRole('button', { name: 'Ver la red en el esquema' }).click();
  await expect(page).toHaveURL(/#\/consolas\/gb\/esquema\/red/);
  await expect(page.locator('.marco')).toHaveAttribute('data-red', /\d+/);
});

test('Mega Drive: un componente sin recuadro se marca en las dos fotos por su huella', async ({ page }) => {
  await page.goto('#/consolas/megadrive/foto/C40');
  await expect(page.locator('button[data-foto="va68"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.foto-vista .marcador')).toHaveAttribute('data-ref', 'C40');
  await expect(page.locator('.foto-vista .ficha')).toContainText('homografía');
  await page.locator('button[data-foto="va6"]').click();
  await expect(page.locator('.foto-vista .marcador')).toHaveAttribute('data-ref', 'C40');
  await expect(page.locator('.foto-vista .ficha')).toContainText('5.32 px/mm');
  // the aftermarket wires of the PAL board are marked as a modification
  await page.goto('#/consolas/megadrive/foto/foto%3Amod');
  await expect(page.locator('.foto-vista .ficha')).toContainText('no son de fábrica');
});

test('Mega Drive: los relojes son PAL por defecto y se pueden pasar a NTSC', async ({ page }) => {
  await page.goto('#/consolas/megadrive/arquitectura');
  await expect(page.locator('.nota-capa[data-norma]')).toHaveAttribute('data-norma', 'pal');
  await expect(page.locator('.descripcion')).toContainText('131,6 ns (PAL)');
  await page.getByRole('tab', { name: 'Cuadro e interrupciones' }).click();
  await expect(page.locator('.descripcion')).toContainText('313 líneas de 64,28 µs (49,70 Hz)');
  await page.getByRole('group', { name: 'Norma de vídeo' }).getByRole('button', { name: 'NTSC · 60 Hz' }).click();
  await expect(page.locator('.nota-capa[data-norma]')).toHaveAttribute('data-norma', 'ntsc');
  await expect(page.locator('.descripcion')).toContainText('262 líneas de 63,70 µs (59,92 Hz)');
  await page.getByRole('tab', { name: 'Ciclos del 68000' }).click();
  await expect(page.locator('.descripcion')).toContainText('130,4 ns (NTSC)');
});

test('decodificador con espacio de E/S (SMS) y del Z80 (Mega Drive)', async ({ page }) => {
  await page.goto('#/consolas/sms/arquitectura');
  const dir = page.getByRole('textbox', { name: 'Dirección en hexadecimal' });
  const res = page.locator('.resultado');
  await page.getByRole('combobox', { name: 'Espacio de direcciones' }).selectOption('io');
  await dir.fill('BE');
  await page.getByRole('combobox', { name: 'Lectura o escritura' }).selectOption({ label: 'Escritura' });
  await page.getByRole('button', { name: 'Decodificar', exact: true }).click();
  await expect(res).toHaveAttribute('data-seleccion', 'VDP');
  await dir.fill('DC');
  await page.getByRole('combobox', { name: 'Lectura o escritura' }).selectOption({ label: 'Lectura' });
  await page.getByRole('button', { name: 'Decodificar', exact: true }).click();
  await expect(res).toHaveAttribute('data-seleccion', 'IOSEL');

  await page.goto('#/consolas/megadrive/arquitectura');
  await page.getByRole('combobox', { name: 'Espacio de direcciones' }).selectOption('z80');
  await page.getByRole('textbox', { name: 'Dirección en hexadecimal' }).fill('4001');
  await page.getByRole('button', { name: 'Decodificar', exact: true }).click();
  await expect(page.locator('.resultado')).toHaveAttribute('data-seleccion', '/SOUND');
});

test('Game Boy: la capa «Dentro del SoC» y los escenarios de la GBC', async ({ page }) => {
  await page.goto('#/consolas/gb/arquitectura');
  const dentro = page.getByRole('button', { name: 'Dentro del SoC' });
  await dentro.click();
  await expect(dentro).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.nota-capa')).toContainText('msinger/dmg-schematics');
  await page.goto('#/consolas/gbc/arquitectura');
  await page.getByRole('tab', { name: 'HDMA por línea' }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Paso adelante' }).click();
  await expect(page.locator('.paso')).not.toBeEmpty();
});

test('las consolas nuevas buscan en su esquema y citan sus fuentes', async ({ page }) => {
  await page.goto('#/consolas/sms/esquema');
  const buscar = page.getByRole('searchbox', { name: 'Buscar en el esquema' });
  await buscar.fill('IC5');
  await buscar.press('Enter');
  await expect(page.locator('.marco')).toHaveAttribute('data-simbolo', 'IC5');
  await expect(page.locator('.esquema .ficha')).toContainText('64 pines');
  await page.goto('#/consolas/gbc/esquema');
  await page.getByRole('searchbox', { name: 'Buscar en el esquema' }).fill('U1');
  await page.getByRole('searchbox', { name: 'Buscar en el esquema' }).press('Enter');
  await expect(page.locator('.marco')).toHaveAttribute('data-simbolo', 'U1');
  await page.goto('#/consolas/gbc/fuentes');
  await expect(page.locator('.fuentes table').first()).toBeVisible();
  await expect(page.locator('.fuentes')).toContainText('118 de 118');
  await expect(page.locator('.fuentes')).toContainText('CC BY-NC-SA');
  await page.goto('#/consolas/sms/fuentes');
  await expect(page.locator('.fuentes')).toContainText('IC5');
  await expect(page.locator('.fuentes')).toContainText('43');
});

test('en el teléfono ninguna vista de ninguna consola desborda a lo ancho', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  for (const m of ['nes', 'neogeo', 'sms', 'megadrive', 'gb', 'gbc', 'snes']) {
    for (const v of ['foto', 'arquitectura', 'esquema', 'fuentes']) {
      await page.goto(`#/consolas/${m}/${v}`);
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${m}/${v}`).toBeLessThanOrEqual(390);
    }
  }
  await ctx.close();
});

const TAMANOS = [
  { nombre: 'movil', w: 390, h: 844, dpr: 3, tactil: true },
  { nombre: 'portatil', w: 1280, h: 800, dpr: 2, tactil: false },
  { nombre: 'tableta-vertical', w: 800, h: 1280, dpr: 2, tactil: true },
];

for (const t of TAMANOS) {
  for (const modo of ['claro', 'oscuro'] as const) {
    test(`capturas ${t.nombre} ${modo}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: t.dpr, hasTouch: t.tactil });
      const page = await ctx.newPage();
      await tema(page, modo);
      const vistas: [string, string][] = [
        ['nes-foto', '#/consolas/nes/foto/foto%3AU5'],
        ['nes-arquitectura', '#/consolas/nes/arquitectura'],
        ['nes-esquema', '#/consolas/nes/esquema/red%3A%2F~%7BNMI%7D'],
        ['neogeo-foto', '#/consolas/neogeo/foto/foto%3Alspc'],
        ['neogeo-arquitectura', '#/consolas/neogeo/arquitectura'],
        ['neogeo-esquema', '#/consolas/neogeo/esquema/red%3APCK1'],
        ['sms-foto', '#/consolas/sms/foto/foto%3Avdp'],
        ['sms-arquitectura', '#/consolas/sms/arquitectura'],
        ['sms-esquema', '#/consolas/sms/esquema/IC5'],
        ['megadrive-foto', '#/consolas/megadrive/foto/foto%3Avdp'],
        ['megadrive-arquitectura', '#/consolas/megadrive/arquitectura'],
        ['megadrive-esquema', '#/consolas/megadrive/esquema/U8'],
        ['gb-foto', '#/consolas/gb/foto/foto%3Asoc'],
        ['gb-arquitectura', '#/consolas/gb/arquitectura'],
        ['gb-esquema', '#/consolas/gb/esquema/U1'],
        ['gbc-foto', '#/consolas/gbc/foto/foto%3Asoc'],
        ['gbc-arquitectura', '#/consolas/gbc/arquitectura'],
        ['gbc-esquema', '#/consolas/gbc/esquema/U1'],
      ];
      for (const [nombre, ruta] of vistas) {
        await page.goto(ruta);
        await page.waitForTimeout(1200);
        if (nombre.endsWith('arquitectura')) {
          for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Paso adelante' }).click();
        }
        await page.screenshot({ path: `tests/capturas/consolas-${t.nombre}-${modo}-${nombre}.png` });
      }
      await ctx.close();
    });
  }
}
