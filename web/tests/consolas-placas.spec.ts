// «Placa en 3D / 2D» of the consoles (contenido/consolas_pcb.py → public/consolas/placas/, drawn by the
// «Proyectos KiCad» viewer) and its link with the console's schematic.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.placas.config.ts tests/consolas-placas.spec.ts
import { test, expect, type Page } from '@playwright/test';

interface Vista2D {
  k: number;
  ox: number;
  oy: number;
}

type Pad = [number, string, string, number, number];
interface Placa {
  huellas: { r: string; t: string; lado: string; dnp?: boolean; pads: [number, number]; m: { tipo: string }; rec?: { pos: string; cuerpo: string; nota: string } }[];
  pads: Pad[];
  redes: { n: string }[];
  consola: { enlazada: boolean; redes: Record<string, string>; refs: string[]; parcial?: { refs: string[]; texto: string } };
}

interface Stats3D {
  piezas: { biblioteca: number; propias: number };
  ladoComponentes?: string;
  fases?: { piezas: number };
  revision?: {
    plantillas: number;
    triangulos: number;
    noFinitas: string[];
    enormes: string[];
    pinesDistintos: string[];
    patasFuera: string[];
    maxDesvio: number;
    fusionNoFinitos: number;
  };
}

/** Opens a console's board in 3D with WebGL (optionally choosing it) and waits for its parts. */
async function placa3D(page: Page, maquina: string, boton?: RegExp): Promise<Stats3D> {
  await page.goto(`#/consolas/${maquina}/placa3d`);
  await expect(page.locator('.placa-consola')).toBeVisible();
  if (boton) {
    await page.evaluate(() => ((globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo = false));
    await page.locator('.placas').getByRole('button', { name: boton }).click({ timeout: 120_000 });
  }
  await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo === true, null, {
    timeout: 180_000,
  });
  return page.evaluate(() => (globalThis as unknown as { __epaPlaca3D: Stats3D }).__epaPlaca3D);
}

async function placa(page: Page, id: string): Promise<Placa> {
  return page.evaluate(async (i) => (await fetch(`consolas/placas/${i}.json`)).json(), id) as Promise<Placa>;
}

/** Forces the 2D fallback of the 3D tab (fast, no WebGL in the test browser needed). */
async function sin3D(page: Page): Promise<void> {
  await page.addInitScript(() => ((globalThis as unknown as { __epaSinWebGL: boolean }).__epaSinWebGL = true));
}

test('las pestañas de placa solo aparecen en las consolas con placa', async ({ page }) => {
  // (the NES has had a board since 0.8: OpenTendo; the Master System has none)
  await page.goto('#/consolas/sms/foto');
  const pestanas = page.getByRole('navigation', { name: 'Vista' });
  await expect(pestanas.getByRole('link', { name: 'Esquema' })).toBeVisible();
  await expect(pestanas.getByRole('link', { name: 'Placa en 3D' })).toHaveCount(0);
  await page.goto('#/consolas/megadrive/foto');
  await expect(pestanas.getByRole('link', { name: 'Placa en 3D' })).toBeVisible();
  await expect(pestanas.getByRole('link', { name: 'Placa en 2D' })).toBeVisible();
  // a machine without a board opened on a board tab falls back to the photo
  await page.goto('#/consolas/sms/placa2d');
  await expect(pestanas.getByRole('link', { name: 'Foto', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('Mega Drive: del esquema a la placa y de la placa al esquema', async ({ page }) => {
  await sin3D(page);
  await page.goto('#/consolas/megadrive/esquema/U1');
  await page.getByRole('button', { name: 'Ver en la placa', exact: true }).click();
  await expect(page).toHaveURL(/#\/consolas\/megadrive\/placa2d\/U1$/);
  const lado = page.locator('.placa-consola .lado');
  await expect(lado.locator('.nombre')).toContainText('U1');
  await expect(lado).toContainText('HD68HC000P8');
  await expect(lado).toContainText('DIP-64');
  // every pad of the board on the schematic's net (checked by the pipeline, shown in the summary)
  const d = await placa(page, 'megadrive');
  expect(d.consola.enlazada).toBe(true);
  expect(d.consola.refs.length).toBe(291);
  // a pad from the list → its net, the same net in the schematic
  await lado.locator('.nodos button').filter({ hasText: 'VD4' }).first().click();
  await expect(page).toHaveURL(/placa2d\/red%3A%2FVD4$/);
  await expect(lado.locator('.nombre')).toHaveText('VD4');
  await lado.getByRole('button', { name: 'Ver en el esquema' }).click();
  await expect(page).toHaveURL(/esquema\/red%3A%2FVD4$/);
  await expect(page.locator('.lado, aside').filter({ hasText: 'pines conectados' }).first()).toBeVisible();
});

test('Mega Drive: tocar un pad en la placa 2D lo elige, también para el esquema', async ({ page }) => {
  await page.goto('#/consolas/megadrive/placa2d');
  const lienzo = page.locator('.placa2d canvas');
  await expect(lienzo).toBeVisible();
  await page.waitForFunction(() => !!(globalThis as unknown as { __epaPlacaVista?: unknown }).__epaPlacaVista);
  await page.waitForTimeout(400);
  const d = await placa(page, 'megadrive');
  const h = d.huellas.find((x) => x.r === 'U8')!;
  const pad = d.pads[h.pads[0]]!;
  const v = (await page.evaluate(() => (globalThis as unknown as { __epaPlacaVista: Vista2D }).__epaPlacaVista)) as Vista2D;
  const caja = (await lienzo.boundingBox())!;
  await page.mouse.click(caja.x + v.ox + pad[3] * v.k, caja.y + v.oy + pad[4] * v.k);
  await expect(page.locator('.placa-consola .lado .nombre')).toContainText('U8');
  await expect(page).toHaveURL(/placa2d\/U8$/);
  await page.getByRole('navigation', { name: 'Vista' }).getByRole('link', { name: 'Esquema' }).click();
  await expect(page).toHaveURL(/esquema\/U8$/);
  await expect(page.locator('h3.nombre')).toContainText('U8');
});

test('Game Boy Color: la CGB-CPU-04 del Gerber enlazada y OpenGBC enlazada solo en parte', async ({ page }) => {
  await sin3D(page);
  await page.goto('#/consolas/gbc/placa3d/U1');
  await expect(page.locator('.placa-consola')).toHaveAttribute('data-placa', 'gbc-cgb04');
  const lado = page.locator('.placa-consola .lado');
  await expect(lado.locator('.nombre')).toContainText('U1');
  // a Gerber has no placement: the part's sheet says its position is reconstructed, and from what (0.8.2)
  await expect(lado.locator('.reconstruida')).toContainText('Posición reconstruida');
  await expect(lado.locator('.reconstruida')).toContainText('pads del Gerber');
  await expect(lado.locator('.reconstruida')).toContainText('serigrafía');
  await expect(lado.locator('.nodos')).toContainText('ø');
  const d = await placa(page, 'gbc-cgb04');
  expect(d.consola.refs.length).toBeGreaterThan(120);
  expect(d.pads.length).toBeGreaterThan(500);
  // every part with a body has its placement flagged as reconstructed; most of them sit on the bottom face
  const conCuerpo = d.huellas.filter((h) => h.t !== 'mec' && !h.dnp);
  expect(conCuerpo.length).toBeGreaterThan(100);
  expect(conCuerpo.every((h) => h.rec?.pos === 'pads' && h.rec.nota.length > 20)).toBe(true);
  expect(conCuerpo.filter((h) => h.rec!.cuerpo === 'huella').length).toBeGreaterThan(90);
  expect(conCuerpo.filter((h) => h.lado === 'B').length).toBeGreaterThan(100);
  // a library part: its KiCad footprint from the schematic, fitted to the pads
  await page.goto('#/consolas/gbc/placa3d/C32');
  await expect(lado.locator('.nombre')).toContainText('C32');
  await expect(lado).toContainText('CP_Elec_6.3x5.4');
  await expect(lado.locator('.reconstruida')).toContainText('biblioteca de KiCad');
  // the board's note
  await page.goto('#/consolas/gbc/placa3d');
  await expect(lado.locator('.nota-placa')).toContainText('Posiciones reconstruidas a partir de la serigrafía y los pads');
  // the modern board: not the original, linked only through the parts it shares with it
  await page.getByRole('button', { name: /OpenGBC/ }).click();
  await expect(page.locator('.placa-consola')).toHaveAttribute('data-placa', 'gbc-opengbc');
  await expect(page.locator('.placas')).toContainText('enlazada en parte');
  await expect(lado).toContainText('Enlazada en parte con el esquema');
  await expect(lado).toContainText('no es la placa de Nintendo');
  const o = await placa(page, 'gbc-opengbc');
  expect(o.consola.enlazada).toBe(false);
  expect(o.consola.parcial?.refs).toEqual(['P1', 'P2', 'U1', 'U2']);
  expect(o.huellas.filter((h) => h.t !== 'mec').length).toBeGreaterThan(60);
  // U1 is the same CPU: linked; R12 names another part on the CGB-CPU-04: not linked
  await page.goto('#/consolas/gbc/placa3d/U1');
  await expect(page.locator('.placa-consola')).toHaveAttribute('data-placa', 'gbc-opengbc');
  await expect(lado.locator('.nombre')).toContainText('U1');
  await expect(lado.getByRole('button', { name: 'Ver en el esquema' })).toBeVisible();
  await page.goto('#/consolas/gbc/placa3d/R12');
  await expect(lado.locator('.nombre')).not.toContainText('R12');
  // the choice is kept while switching tabs
  await page.getByRole('navigation', { name: 'Vista' }).getByRole('link', { name: 'Placa en 2D' }).click();
  await expect(page.locator('.placa-consola')).toHaveAttribute('data-placa', 'gbc-opengbc');
});

test('las fuentes dicen de dónde sale cada placa y su licencia', async ({ page }) => {
  await page.goto('#/consolas/gbc/fuentes');
  const s = page.locator('.placas-fuentes');
  await expect(s).toContainText('CC BY-NC-SA 4.0');
  await expect(s).toContainText('no es la placa original');
  await expect(s).toContainText('CC BY-SA 4.0');
  await page.goto('#/consolas/megadrive/fuentes');
  await expect(s).toContainText('stonedDiscord');
  await expect(s).toContainText('uso privado');
  await page.goto('#/consolas/nes/fuentes');
  await expect(s).toContainText('OpenTendo');
  await expect(s).toContainText('TAPR Open Hardware License 1.0');
  await page.goto('#/consolas/sms/fuentes');
  await expect(page.locator('.fuentes')).toBeVisible();
  await expect(s).toHaveCount(0);
});

test('la placa en 3D de la CGB-CPU-04 se monta con WebGL', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('#/consolas/gbc/placa3d/U3');
  await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo === true, null, {
    timeout: 180_000,
  });
  await expect(page.locator('.placa-consola .lado .nombre')).toContainText('U3');
  await expect(page.locator('.placa-consola canvas').first()).toBeVisible();
});

test('Game Boy Color en 3D: la CGB-CPU-04 con sus componentes y OpenGBC con los suyos', async ({ page }) => {
  test.setTimeout(420_000);
  const s = await placa3D(page, 'gbc');
  await expect(page.locator('.placa-consola')).toHaveAttribute('data-placa', 'gbc-cgb04');
  // the «Componentes» toggle is on and the parts are there (0.8.1 drew none: a Gerber has no placement)
  await expect(page.getByRole('button', { name: 'Componentes' })).toHaveAttribute('aria-pressed', 'true');
  expect(s.piezas.biblioteca + s.piezas.propias).toBeGreaterThan(100);
  // nearly all of them on the bottom face: the inclined view shows that face
  expect(s.ladoComponentes).toBe('B');
  const o = await placa3D(page, 'gbc', /OpenGBC/);
  await expect(page.locator('.placa-consola')).toHaveAttribute('data-placa', 'gbc-opengbc');
  expect(o.piezas.biblioteca + o.piezas.propias).toBeGreaterThan(60);
  expect(o.ladoComponentes).toBe('F');
});

test('Game Boy: Super DMG-01, recreación moderna en 3D con sus componentes, enlazada solo en parte', async ({ page }) => {
  test.setTimeout(300_000);
  const s = await placa3D(page, 'gb');
  await expect(page.locator('.placa-consola')).toHaveAttribute('data-placa', 'gb-superdmg');
  await expect(page.locator('.placas')).toContainText('Super DMG-01 · recreación moderna');
  await expect(page.locator('.placas')).toContainText('enlazada en parte');
  expect(s.piezas.biblioteca + s.piezas.propias).toBeGreaterThan(40);
  const lado = page.locator('.placa-consola .lado');
  await expect(lado).toContainText('no es la placa de Nintendo');
  await expect(lado).toContainText('USB-C');
  const d = await placa(page, 'gb-superdmg');
  expect(d.consola.enlazada).toBe(false);
  // linked only where reference and nets agree with Gekkio's DMG-CPU schematic: the CPU and both RAMs among them
  for (const r of ['U1', 'U2', 'U3', 'X1']) expect(d.consola.parcial?.refs).toContain(r);
  expect(d.consola.parcial?.refs).not.toContain('U4');
  expect(d.consola.parcial?.refs).not.toContain('DA1');
  await page.goto('#/consolas/gb/placa3d/U1');
  await expect(lado.locator('.nombre')).toContainText('U1');
  await lado.getByRole('button', { name: 'Ver en el esquema' }).click();
  await expect(page).toHaveURL(/#\/consolas\/gb\/esquema\/U1$/);
  // the sources: author, licence and the pinned commit
  await page.goto('#/consolas/gb/fuentes');
  const f = page.locator('.placas-fuentes');
  await expect(f).toContainText('kamicane');
  await expect(f).toContainText('CC BY-SA 4.0');
  await expect(f).toContainText('bf540dd');
});

// 0.9: the Neo Geo board froze the Xiaomi Pad 6 (Chromium rasterises 2D canvases on the GPU there; painting its
// faces with every net clipped by 2286 mask openings held the GPU thread for minutes). Its parts are checked
// while they load (escena3d → stats.revision): finite geometry, the library models' pin counts against the
// footprints' pads and their leads on those pads; the 5-lead TO-220 (U37, LM2576T-5) gets its own body.
test('Neo Geo y Mega Drive en 3D: geometría de las piezas válida y patillas sobre sus pads', async ({ page }) => {
  test.setTimeout(480_000);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  for (const [maquina, n] of [
    ['neogeo', 320],
    ['megadrive', 257],
  ] as const) {
    await page.evaluate(() => ((globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo = false));
    const s = await placa3D(page, maquina);
    const r = s.revision!;
    expect(s.piezas.biblioteca + s.piezas.propias, maquina).toBe(n);
    expect(r.noFinitas, maquina).toEqual([]);
    expect(r.enormes, maquina).toEqual([]);
    expect(r.fusionNoFinitos, maquina).toBe(0);
    // no library model with another pin count than its footprint; the accepted ones on their pads
    expect(r.pinesDistintos, maquina).toEqual([]);
    expect(r.maxDesvio, maquina).toBeLessThanOrEqual(0.5);
    expect(r.triangulos, maquina).toBeGreaterThan(1000);
    expect(r.triangulos, maquina).toBeLessThan(400_000);
    if (maquina === 'neogeo') {
      // the 5-lead regulator is not drawn as the library's 3-lead TO-220, nor refused for it
      expect([...r.pinesDistintos, ...r.patasFuera].join(' ')).not.toContain('U37');
      expect(r.patasFuera).toEqual([]);
    } else {
      // Mega Drive: models that did not fit their footprints (vertical ferrite beads, a 2 mm header, a double
      // DIP-28) get a simple body instead of leads beside their pads
      expect(r.patasFuera.map((x) => x.split(' ')[0])).toEqual(expect.arrayContaining(['FB1', 'J110', 'U7']));
    }
  }
  expect(errores).toEqual([]);
});

test('con «Componentes» apagado la placa en 3D no carga las piezas, y al encenderlo las carga', async ({ page }) => {
  test.setTimeout(360_000);
  // A small board first, to switch the toggle off (it is kept while moving between boards).
  await page.goto('#/proyectos/estacion_iot/3d');
  await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo === true, null, { timeout: 180_000 });
  const comp = page.getByRole('button', { name: 'Componentes' });
  await comp.click();
  await expect(comp).toHaveAttribute('aria-pressed', 'false');
  await page.goto('#/consolas/neogeo/placa3d');
  await expect(page.locator('.placa-consola')).toHaveAttribute('data-placa', 'neogeo');
  // ready with the board alone: no parts built, no load phases, no progress overlay
  await page.waitForFunction(
    () => {
      const g = globalThis as unknown as { __epaPlaca3DListo?: boolean; __epaPlaca3D?: { cuadros: number; piezas: { propias: number } } };
      return g.__epaPlaca3DListo === true && (g.__epaPlaca3D?.cuadros ?? 0) > 0;
    },
    null,
    { timeout: 180_000 },
  );
  await page.waitForTimeout(1500);
  const sin = await page.evaluate(() => (globalThis as unknown as { __epaPlaca3D: Stats3D }).__epaPlaca3D);
  expect(sin.piezas).toEqual({ biblioteca: 0, propias: 0 });
  expect(sin.fases).toBeUndefined();
  expect(sin.revision).toBeUndefined();
  await expect(page.locator('.v3d .carga')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Componentes' })).toHaveAttribute('aria-pressed', 'false');
  // turned on: now they are built, once
  await page.getByRole('button', { name: 'Componentes' }).click();
  await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3D?: Stats3D }).__epaPlaca3D?.fases?.piezas != null, null, { timeout: 180_000 });
  await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3DListo?: boolean }).__epaPlaca3DListo === true, null, { timeout: 180_000 });
  const con = await page.evaluate(() => (globalThis as unknown as { __epaPlaca3D: Stats3D }).__epaPlaca3D);
  expect(con.piezas.biblioteca + con.piezas.propias).toBe(320);
  // off and on again: nothing is built twice
  await page.getByRole('button', { name: 'Componentes' }).click();
  await page.getByRole('button', { name: 'Componentes' }).click();
  await page.waitForTimeout(500);
  const otra = await page.evaluate(() => (globalThis as unknown as { __epaPlaca3D: Stats3D }).__epaPlaca3D);
  expect(otra.piezas.biblioteca + otra.piezas.propias).toBe(320);
});
