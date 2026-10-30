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
  huellas: {
    r: string;
    v: string;
    l: string;
    t: string;
    lado: string;
    dnp?: boolean;
    pads: [number, number];
    m: { tipo: string; marcado?: string; clasif?: string };
    rec?: { pos: string; cuerpo: string; nota: string };
  }[];
  pads: Pad[];
  redes: { n: string }[];
  consola: { enlazada: boolean; redes: Record<string, string>; refs: string[]; parcial?: { refs: string[]; texto: string } };
}

interface Stats3D {
  piezas: { biblioteca: number; propias: number };
  ladoComponentes?: string;
  llamadas?: number;
  fases?: { piezas: number; modelos: number; fusion: number; compilar: number };
  revision?: {
    plantillas: number;
    triangulos: number;
    noFinitas: string[];
    enormes: string[];
    pinesDistintos: string[];
    patasFuera: string[];
    maxDesvio: number;
    fusionNoFinitos: number;
    porTipo?: Record<string, { piezas: number; triangulos: number; biblioteca: number }>;
    genericos?: string[];
    sinRotulo?: string[];
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

test('las siete consolas tienen las pestañas de placa', async ({ page }) => {
  // (the NES has had a board since 0.8: OpenTendo; the Master System since 0.11, reconstructed from its photos)
  const pestanas = page.getByRole('navigation', { name: 'Vista' });
  for (const m of ['nes', 'neogeo', 'sms', 'megadrive', 'gb', 'gbc', 'snes']) {
    await page.goto(`#/consolas/${m}/foto`);
    await expect(pestanas.getByRole('link', { name: 'Esquema' }), m).toBeVisible();
    await expect(pestanas.getByRole('link', { name: 'Placa en 3D' }), m).toBeVisible();
    await expect(pestanas.getByRole('link', { name: 'Placa en 2D' }), m).toBeVisible();
  }
  await page.goto('#/consolas/sms/placa2d');
  await expect(pestanas.getByRole('link', { name: 'Placa en 2D', exact: true })).toHaveAttribute('aria-current', 'page');
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
  // the Master System's board is a reconstruction from ConsoleMods' photos (CC BY), both faces credited
  await page.goto('#/consolas/sms/fuentes');
  await expect(s).toContainText('reconstrucción a partir de fotos');
  await expect(s).toContainText('ConsoleMods');
  await expect(s).toContainText('171-5922ABottom.jpg');
  await expect(s).toContainText('Creative Commons Attribution');
  await expect(s).toContainText('enderezadas y reducidas');
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

// 0.9.1/0.9.2: on the Xiaomi Pad 6 the Neo Geo and Super Nintendo boards closed the app: in 0.9.0 at the
// direct full-resolution faces (4096 px), in 0.9.1 at the worker's quick pass. Android now paints directly
// (the quick pass that always worked there) with full faces of 2048 px, and a full pass that never ended halves
// the device's size the next time. Checked here with an Android WebView user agent.
const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; 23043RP34G Build/UKQ1.240624.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/135.0.7049.111 Safari/537.36';

interface StatsCaras {
  carasFinas?: number;
  ladoCaras?: number;
  fasesCaras?: { modo: string; completa?: { modo: string } };
}

async function carasAndroid(browser: import('@playwright/test').Browser, maquina: string, antes?: Record<string, string>) {
  const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL, userAgent: UA_ANDROID, viewport: { width: 800, height: 1280 } });
  if (antes) await ctx.addInitScript((kv) => {
    for (const [k, v] of Object.entries(kv)) if (!sessionStorage.getItem('puesto-' + k)) {
      localStorage.setItem(k, v);
      sessionStorage.setItem('puesto-' + k, '1');
    }
  }, antes);
  const page = await ctx.newPage();
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto(`./#/consolas/${maquina}/placa3d`);
  await expect(page.locator('.placa-consola')).toHaveAttribute('data-placa', maquina);
  await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3D?: StatsCaras }).__epaPlaca3D?.carasFinas != null, null, { timeout: 240_000 });
  const st = await page.evaluate(() => (globalThis as unknown as { __epaPlaca3D: StatsCaras }).__epaPlaca3D);
  const ls = await page.evaluate(() => ({ max: localStorage.getItem('epa-caras-max'), intento: localStorage.getItem('epa-caras-intento'), registro: localStorage.getItem('epa-registro') ?? '' }));
  return { ctx, st, ls, errores };
}

for (const maquina of ['neogeo', 'snes', 'sms']) {
  test(`en Android las caras de la placa ${maquina} se pintan directas a 2048 px`, async ({ browser }) => {
    test.setTimeout(300_000);
    const { ctx, st, ls, errores } = await carasAndroid(browser, maquina);
    expect(st.fasesCaras?.modo).toBe('directo');
    expect(st.fasesCaras?.completa?.modo).toBe('directo');
    expect(st.ladoCaras).toBe(2048);
    // the pass ended: nothing left marked
    expect(ls.intento).toBeNull();
    expect(ls.registro).toContain('caras a resolución completa: listas');
    expect(errores).toEqual([]);
    await ctx.close();
  });
}

test('una pasada de caras que no terminó (la aplicación se cerró) baja el tamaño de las caras del dispositivo', async ({ browser }) => {
  test.setTimeout(300_000);
  const { ctx, st, ls } = await carasAndroid(browser, 'neogeo', { 'epa-caras-intento': '2048' });
  expect(st.ladoCaras).toBe(1024);
  expect(ls.max).toBe('1024');
  expect(ls.intento).toBeNull();
  expect(ls.registro).toContain('no terminó');
  await ctx.close();
});

// 0.10: the consoles' boards drew most of their parts as plain grey boxes (footprint names of their own that the
// pipeline did not know: «Resistor1-5mm», «CAP3-5mm», «BF-2.5mm», «LSPC2»…) and their chips without markings.
// contenido/consolas_cuerpos.py classifies every footprint (a table of those names and the package inferred from
// the pads); escena3d counts what is drawn: by type, the plain boxes left (`genericos`) and the ICs without a
// printed marking (`sinRotulo`).
const PLACAS_3D: { maquina: string; boton?: RegExp; id: string }[] = [
  { maquina: 'neogeo', id: 'neogeo' },
  { maquina: 'snes', id: 'snes' },
  { maquina: 'megadrive', id: 'megadrive' },
  { maquina: 'nes', id: 'nes' },
  { maquina: 'gb', id: 'gb-superdmg' },
  { maquina: 'gbc', id: 'gbc-cgb04' },
  { maquina: 'gbc', boton: /OpenGBC/, id: 'gbc-opengbc' },
  { maquina: 'sms', id: 'sms' },
];

test('las placas de las consolas en 3D: ningún componente queda como caja gris y todos los chips llevan su rótulo', async ({ page }) => {
  test.setTimeout(900_000);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  for (const p of PLACAS_3D) {
    await page.goto('about:blank');
    const s = await placa3D(page, p.maquina, p.boton);
    await expect(page.locator('.placa-consola')).toHaveAttribute('data-placa', p.id);
    const r = s.revision!;
    // no plain box: every footprint got a body of its package (the list is in the message when it fails)
    expect(r.genericos, `${p.id}: cuerpos genéricos`).toEqual([]);
    expect(r.porTipo?.caja, `${p.id}: huellas sin clasificar`).toBeUndefined();
    // every IC (DIP, SOIC/SOP, QFP, SIP) prints its marking
    expect(r.sinRotulo, `${p.id}: chips sin rótulo`).toEqual([]);
    expect(r.noFinitas, p.id).toEqual([]);
    expect(r.fusionNoFinitos, p.id).toBe(0);
    expect(r.pinesDistintos, p.id).toEqual([]);
    expect(r.maxDesvio, p.id).toBeLessThanOrEqual(0.5);
    expect(r.triangulos, p.id).toBeLessThan(400_000);
  }
  // the data: the bodies from the table or the pads, the markings of the custom chips
  const ng = await placa(page, 'neogeo');
  const de = (d: Placa, ref: string) => d.huellas.find((h) => h.r === ref)!;
  expect(ng.huellas.filter((h) => h.t !== 'mec' && h.m.tipo === 'caja')).toEqual([]);
  expect(de(ng, 'R56').m.tipo).toBe('resistencia_axial');
  expect(de(ng, 'C124').m.tipo).toBe('condensador_disco');
  expect(de(ng, 'C37').m.tipo).toBe('electrolitico');
  expect(de(ng, 'BF27').m.tipo).toBe('radial');
  expect(de(ng, 'CR2').m).toMatchObject({ tipo: 'sip', marcado: 'CRE401' });
  expect(de(ng, 'H13').m.tipo).toBe('sin_cuerpo');
  for (const [ref, mk] of [
    ['U13', 'NEO-B1'],
    ['U21', 'LSPC2-A2'],
    ['U4', 'NEO-C1'],
    ['U3', 'HD68HC000P'],
    ['U18', '43256'],
  ])
    expect(de(ng, ref).m.marcado, ref).toBe(mk);
  const sn = await placa(page, 'snes');
  for (const [ref, mk] of [
    ['U1', 'S-CPU|5A22'],
    ['U2', 'S-PPU1|5C77'],
    ['U10', 'LM324'],
    ['U7', 'S-ENC'],
  ])
    expect(de(sn, ref).m.marcado, ref).toBe(mk);
  expect(de(sn, 'TP10').m.tipo).toBe('sin_cuerpo');
  expect(errores).toEqual([]);
});

test('Neo Geo en 3D con agente de Android: piezas con su cuerpo sin disparar la carga', async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL, userAgent: UA_ANDROID, viewport: { width: 800, height: 1280 } });
  const page = await ctx.newPage();
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('./#/consolas/neogeo/placa3d');
  await page.waitForFunction(() => !!(globalThis as unknown as { __epaPlaca3D?: Stats3D }).__epaPlaca3D?.fases?.piezas, null, { timeout: 240_000 });
  const s = await page.evaluate(() => (globalThis as unknown as { __epaPlaca3D: Stats3D }).__epaPlaca3D);
  const r = s.revision!;
  expect(s.piezas.biblioteca + s.piezas.propias).toBe(320);
  // most parts are the library's (resistors with their bands, ceramic discs, electrolytics, DIPs)
  expect(s.piezas.biblioteca).toBeGreaterThan(150);
  expect(r.genericos).toEqual([]);
  expect(r.sinRotulo).toEqual([]);
  // the parts' own work stays short: building, merging and compiling (0.9.2: about 0.2 s here, 0.10: about 0.6 s)
  const f = s.fases!;
  expect(f.modelos + f.fusion + f.compilar).toBeLessThan(4000);
  expect(r.triangulos).toBeLessThan(400_000);
  expect(errores).toEqual([]);
  await ctx.close();
});

// 0.11: the Master System II's 171-5922A has no published PCB: contenido/consolas_sms_placa.py rebuilds it from
// ConsoleMods' scans of the bare board (holes and parts measured on the photo, scaled by the 2.54 mm pin grid,
// the scans themselves as its faces, the schematic's nets on the pads, no vector copper).
interface PlacaFoto extends Placa {
  placa: { ancho: number; alto: number; fotos?: Record<string, { src: string; w: number; h: number }> };
  consola: Placa['consola'] & { tipo: string; alias?: Record<string, string> };
}

test('Master System II: placa reconstruida a partir de la foto, en 3D, con sus piezas, rótulos y el aviso', async ({ page }) => {
  test.setTimeout(300_000);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const st = await placa3D(page, 'sms');
  await expect(page.locator('.placa-consola')).toHaveAttribute('data-placa', 'sms');
  // the notice, above the view and in the board's summary
  await expect(page.locator('.aviso-foto')).toContainText('Reconstrucción a partir de la foto: las pistas solo se ven en la imagen');
  await expect(page.locator('.placa-consola .lado .aviso-placa')).toContainText('las pistas solo se ven en la imagen');
  const d = (await placa(page, 'sms')) as PlacaFoto;
  expect(d.consola.tipo).toBe('foto');
  expect(d.consola.enlazada).toBe(true);
  // two photo faces, within the 4096 px of the desktop faces; no copper of their own
  expect(Object.keys(d.placa.fotos ?? {}).sort()).toEqual(['B', 'F']);
  for (const f of Object.values(d.placa.fotos!)) expect(Math.max(f.w, f.h)).toBeLessThanOrEqual(4096);
  for (const f of Object.values(d.placa.fotos!)) expect((await page.request.get(f.src)).ok()).toBe(true);
  // board size from the 2.54 mm grid: about 191 × 152 mm
  expect(d.placa.ancho / 100).toBeGreaterThan(185);
  expect(d.placa.ancho / 100).toBeLessThan(196);
  expect(d.placa.alto / 100).toBeGreaterThan(146);
  expect(d.placa.alto / 100).toBeLessThan(157);
  // every part of the schematic is on the board but CS4 and R31 (not printed on it) and RA2 (half of RA1)
  expect(d.consola.refs.length).toBeGreaterThanOrEqual(150);
  for (const r of ['IC1', 'IC2', 'IC3', 'IC4', 'IC5', 'IC6', 'IC7', 'IC8', 'IC9', 'CN1', 'CN2', 'CN3', 'CN4', 'OSC1', 'RF1', 'SW1', 'SW2', 'RA1'])
    expect(d.consola.refs, r).toContain(r);
  expect(d.consola.alias).toEqual({ RA2: 'RA1' });
  // the parts drawn: every footprint that is not a hole and is mounted
  const cuerpos = d.huellas.filter((h) => h.t !== 'mec' && !h.dnp).length;
  expect(cuerpos).toBeGreaterThanOrEqual(150);
  expect(st.piezas.biblioteca + st.piezas.propias).toBe(cuerpos);
  const r = st.revision!;
  expect(r.genericos).toEqual([]);
  expect(r.porTipo?.caja).toBeUndefined();
  expect(r.sinRotulo).toEqual([]);
  expect(r.pinesDistintos).toEqual([]);
  expect(r.maxDesvio).toBeLessThanOrEqual(0.5);
  // the chips with the packages of the schematic and the markings of the M4Jr. photo
  const de = (ref: string) => d.huellas.find((h) => h.r === ref)!;
  for (const [ref, tipo, mk] of [
    ['IC1', 'dip', 'Z0840004PSC|Z80 CPU'],
    ['IC2', 'dip', 'MPR-12808'],
    ['IC3', 'dip', '4168'],
    ['IC4', 'dip', 'SEGA|315-5237'],
    ['IC5', 'dip', 'SEGA|315-5246'],
    ['IC6', 'dip', 'D4168C-15'],
    ['IC7', 'dip', 'D4168C-15'],
    ['IC9', 'dip', 'CXA1145P'],
    ['OSC1', 'lata', '53.2034'],
  ])
    expect(de(ref).m, ref).toMatchObject({ tipo, marcado: mk });
  expect(d.pads.filter((p) => d.huellas[p[0]]!.r === 'IC1').length).toBe(40);
  expect(d.pads.filter((p) => d.huellas[p[0]]!.r === 'IC5').length).toBe(64);
  expect(de('IC8').m.tipo).toBe('to');
  expect(de('CN1').m.tipo).toBe('conector');
  expect(de('RF1').m.tipo).toBe('lata');
  expect(de('C41').m.tipo).toBe('electrolitico');
  expect(de('R9').m.tipo).toBe('resistencia_axial');
  // every part says it was placed from the photo
  for (const h of d.huellas.filter((x) => x.t !== 'mec')) expect(h.rec?.pos, h.r).toBe('foto');
  expect(errores).toEqual([]);
});

test('Master System II: la placa reconstruida enlazada con el esquema, y las redes solo con sus pads', async ({ page }) => {
  await sin3D(page);
  // schematic → board (3D tab without WebGL: the 2D view)
  await page.goto('#/consolas/sms/esquema/IC5');
  await page.getByRole('button', { name: 'Ver en la placa', exact: true }).click();
  await expect(page).toHaveURL(/#\/consolas\/sms\/placa2d\/IC5$/);
  const lado = page.locator('.placa-consola .lado');
  await expect(lado.locator('.nombre')).toContainText('IC5');
  await expect(lado).toContainText('315-5246');
  await expect(lado.locator('.reconstruida')).toContainText('Posición reconstruida');
  await expect(page.locator('.aviso-foto')).toContainText('las pistas solo se ven en la imagen');
  // RA2 of the schematic is the other half of the board's RA1
  await page.goto('#/consolas/sms/esquema/RA2');
  await page.getByRole('button', { name: 'Ver en la placa', exact: true }).click();
  await expect(lado.locator('.nombre')).toContainText('RA1');
  // a pad → its net: the net's pads, listed; on this board there are no tracks
  await page.goto('#/consolas/sms/placa2d/IC1');
  await expect(lado.locator('.nombre')).toContainText('IC1');
  await lado.locator('.nodos button').filter({ hasText: 'A0' }).first().click();
  await expect(page).toHaveURL(/placa2d\/red%3AA0$/);
  await expect(lado.locator('.nombre')).toHaveText('A0');
  // A0: Z80, ROM, RAM, I/O chip, VDP, cartridge slot, RA1
  expect(await lado.locator('.nodos li').count()).toBeGreaterThanOrEqual(7);
  const d = (await placa(page, 'sms')) as PlacaFoto & { pistas: Record<string, number[]>; vias: number[] };
  expect(Object.values(d.pistas).flat()).toEqual([]);
  expect(d.vias).toEqual([]);
  await lado.getByRole('button', { name: 'Ver en el esquema' }).click();
  await expect(page).toHaveURL(/esquema\/red%3AA0$/);
});

test('Master System II en 2D: la foto es la cara, y tocar el Z80 lo elige también en el esquema', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('#/consolas/sms/placa2d');
  const lienzo = page.locator('.placa2d canvas');
  await expect(lienzo).toBeVisible();
  await expect(page.locator('.aviso-foto')).toBeVisible();
  await page.waitForFunction(() => !!(globalThis as unknown as { __epaPlacaVista?: unknown }).__epaPlacaVista);
  await page.waitForTimeout(500);
  // the face is the photo: many colours (a drawn face has a handful)
  const colores = await lienzo.evaluate((c: HTMLCanvasElement) => {
    const x = c.getContext('2d')!;
    const img = x.getImageData(Math.round(c.width * 0.35), Math.round(c.height * 0.35), Math.round(c.width * 0.3), Math.round(c.height * 0.3));
    const s = new Set<number>();
    for (let i = 0; i < img.data.length; i += 4) s.add((img.data[i]! >> 3) * 1024 + (img.data[i + 1]! >> 3) * 32 + (img.data[i + 2]! >> 3));
    return s.size;
  });
  expect(colores).toBeGreaterThan(300);
  // tap IC1's pin 21 (the Z80): selected here and in the schematic
  const d = await placa(page, 'sms');
  const h = d.huellas.find((x) => x.r === 'IC1')!;
  const pad = d.pads[h.pads[0] + 25]!;
  const v = (await page.evaluate(() => (globalThis as unknown as { __epaPlacaVista: Vista2D }).__epaPlacaVista)) as Vista2D;
  const caja = (await lienzo.boundingBox())!;
  await page.mouse.click(caja.x + v.ox + pad[3] * v.k, caja.y + v.oy + pad[4] * v.k);
  await expect(page.locator('.placa-consola .lado .nombre')).toContainText('IC1');
  await page.getByRole('navigation', { name: 'Vista' }).getByRole('link', { name: 'Esquema' }).click();
  await expect(page).toHaveURL(/esquema\/IC1$/);
  await expect(page.locator('h3.nombre')).toContainText('IC1');
  expect(errores).toEqual([]);
});

test('Master System II: el trabajador de las caras (WebKit) también pinta las fotos', async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  // the WebKit path (painted by a worker, which loads the photos itself from absolute URLs), forced in Chromium
  await ctx.addInitScript(() => localStorage.setItem('epa-caras', 'trabajador'));
  const page = await ctx.newPage();
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  const fotos: string[] = [];
  page.on('request', (r) => {
    if (/placas\/sms\/cara-[FB]\.jpg$/.test(r.url())) fotos.push(r.url());
  });
  await page.goto('./#/consolas/sms/placa3d');
  await page.waitForFunction(() => (globalThis as unknown as { __epaPlaca3D?: StatsCaras }).__epaPlaca3D?.carasFinas != null, null, { timeout: 240_000 });
  const st = await page.evaluate(() => (globalThis as unknown as { __epaPlaca3D: StatsCaras }).__epaPlaca3D);
  expect(st.fasesCaras?.completa?.modo).toBe('trabajador');
  // both faces fetched (by the page, and again by the worker unless the HTTP cache serves it)
  expect(new Set(fotos.map((u) => u.slice(-10))).size).toBe(2);
  const registro = await page.evaluate(() => localStorage.getItem('epa-registro') ?? '');
  expect(registro).not.toContain('sin la foto');
  expect(registro).not.toContain('el trabajador falló');
  expect(registro).toContain('caras a resolución completa: listas');
  expect(errores).toEqual([]);
  await ctx.close();
});
