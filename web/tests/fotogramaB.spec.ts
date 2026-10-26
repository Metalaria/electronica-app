// «Un fotograma» of the Master System II, Mega Drive and Neo Geo: the frame replayed by the app equals the
// emulator's framebuffer pixel for pixel (data and screen canvas), step by step through every recorded
// instruction, the player's controls, and the nets lit on the schematic and on the board by a known access; the
// same for «Un juego de verdad» (Food Fighter, Gentris PAL/NTSC, ngdevkit's 05-scrolling booted by nullbios).
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.fotogramaB.config.ts
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
// the generators' own reader (contenido/fotograma/traza.mjs), independent of the app's traza.ts
import { leerTraza } from '../../contenido/fotograma/traza.mjs';

interface Hook {
  rep: {
    t: number;
    jugando: boolean;
    seg: { id: string; t0: number; t1: number; pixel0: number; pixel1: number };
    unidadesCiclo: number;
    pasoInstruccion(d: 1 | -1): void;
    indiceInstruccion(t?: number): number;
    irA(t: number): void;
    cambiarSegmento?(s: unknown): void;
  };
  traza: {
    m: { idPrograma: string; fb?: string; pixeles: { c: string }; video: { ancho: number; alto: number; formato: string; paleta?: number[] }; segmentos: { id: string }[]; instrucciones: { t: string }[] };
    arrays: Record<string, ArrayLike<number>>;
  };
  ir(t: number): void;
}
type Redes = { dibujadas: string[]; chips: string[] };

const g = () => globalThis as unknown as { __epaFotograma: Hook; __epaFotogramaRedes?: Redes };

async function abrir(page: Page, m: string): Promise<void> {
  await page.goto(`#/consolas/${m}/fotograma`);
  await page.waitForFunction(() => !!(globalThis as unknown as { __epaFotograma?: Hook }).__epaFotograma, null, { timeout: 60_000 });
}

async function elegirJuego(page: Page, id: string, norma?: string): Promise<void> {
  await page.getByRole('tab', { name: 'Un juego de verdad', exact: true }).click();
  if (norma) await page.getByRole('button', { name: norma }).click();
  await page.waitForFunction((x) => (globalThis as unknown as { __epaFotograma?: Hook }).__epaFotograma?.traza.m.idPrograma === x, id, { timeout: 60_000 });
}

function trazaNode(m: string, archivo = 'demo.bin') {
  return leerTraza(readFileSync(new URL(`../public/consolas/fotograma/${m}/${archivo}`, import.meta.url)));
}

async function redesEn(page: Page, t: number, vista: string, debe: string): Promise<Redes> {
  await page.evaluate((x) => (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma.ir(x), t);
  await page.getByRole('tab', { name: vista, exact: true }).click();
  await page.waitForFunction(
    (r) => ((globalThis as unknown as { __epaFotogramaRedes?: Redes }).__epaFotogramaRedes?.dibujadas ?? []).includes(r),
    debe,
    { timeout: 30_000 },
  );
  return page.evaluate(() => (globalThis as unknown as { __epaFotogramaRedes: Redes }).__epaFotogramaRedes);
}

const PROGRAMAS = [
  { m: 'sms', id: 'demo' }, { m: 'megadrive', id: 'demo' }, { m: 'neogeo', id: 'demo' },
  { m: 'sms', id: 'foodfighter', juego: true }, { m: 'megadrive', id: 'gentris', juego: true },
  { m: 'megadrive', id: 'gentris-ntsc', juego: true, norma: 'NTSC · 60 Hz' }, { m: 'neogeo', id: 'scrolling', juego: true },
];
for (const { m, id, juego, norma } of PROGRAMAS) {
  const nombre = juego ? `${m} (${id})` : m;
  const preparar = async (page: Page) => {
    await abrir(page, m);
    if (juego) await elegirJuego(page, id, norma);
  };
  test(`${nombre}: la traza reproduce el cuadro del emulador píxel a píxel`, async ({ page }) => {
    await preparar(page);
    const datos = await page.evaluate(() => {
      const h = (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma;
      const { m: man, arrays } = h.traza;
      const s = h.rep.seg;
      const pc = arrays[man.pixeles.c]!;
      const fb = arrays[man.fb!]!;
      let dif = 0;
      for (let i = 0; i < fb.length; i++) if (pc[s.pixel0 + i] !== fb[i]) dif++;
      return { seg: s.id, n: s.pixel1 - s.pixel0, total: fb.length, dif, ancho: man.video.ancho, alto: man.video.alto };
    });
    expect(datos.seg).toBe('fotograma');
    expect(datos.n).toBe(datos.ancho * datos.alto);
    expect(datos.total).toBe(datos.ancho * datos.alto);
    expect(datos.dif).toBe(0);
    // the screen canvas at the end of the frame
    const pant = await page.evaluate(async () => {
      const h = (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma;
      h.ir(h.rep.seg.t1);
      await new Promise((r) => setTimeout(r, 400));
      const c = document.querySelector('.pantalla canvas') as HTMLCanvasElement;
      const img = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      const man = h.traza.m;
      const fb = h.traza.arrays[man.fb!]!;
      let dif = 0;
      for (let i = 0; i < fb.length; i++) {
        const x = man.video.paleta![fb[i]!]!;
        if (img[i * 4] !== x >> 16 || img[i * 4 + 1] !== ((x >> 8) & 255) || img[i * 4 + 2] !== (x & 255)) dif++;
      }
      return { dif, w: c.width, h: c.height };
    });
    expect(pant.w).toBe(datos.ancho);
    expect(pant.h).toBe(datos.alto);
    expect(pant.dif).toBe(0);
    // the generator's reader decodes the same file to the same pixels
    const nodo = trazaNode(m, `${id}.bin`);
    const seg = nodo.manifiesto.segmentos.find((s: { id: string }) => s.id === 'fotograma');
    const fbNodo = Array.from(nodo.arrays[nodo.manifiesto.fb] as ArrayLike<number>);
    const pcNodo = Array.from(nodo.arrays[nodo.manifiesto.pixeles.c] as ArrayLike<number>).slice(seg.pixel0, seg.pixel1);
    expect(pcNodo).toEqual(fbNodo);
  });

  test(`${nombre}: paso a paso por instrucciones, tantas como grabó el emulador`, async ({ page }) => {
    await preparar(page);
    const nodo = trazaNode(m, `${id}.bin`);
    const seg = nodo.manifiesto.segmentos.find((s: { id: string }) => s.id === 'fotograma');
    const it = nodo.arrays[nodo.manifiesto.instrucciones[0].t] as ArrayLike<number>;
    let esperadas = 0;
    for (let i = 0; i < it.length; i++) if (it[i]! >= seg.t0 && it[i]! <= seg.t1) esperadas++;
    expect(esperadas).toBeGreaterThan(m === 'sms' && !juego ? 1000 : 5);
    await page.getByRole('button', { name: 'Al principio del tramo' }).click();
    const idx = () => page.evaluate(() => (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma.rep.indiceInstruccion());
    const i0 = await idx();
    for (let k = 1; k <= 3; k++) {
      await page.getByRole('button', { name: 'Instrucción siguiente' }).click();
      expect(await idx()).toBe(i0 + k);
    }
    await page.getByRole('button', { name: 'Instrucción anterior' }).click();
    expect(await idx()).toBe(i0 + 2);
    await expect(page.locator('[data-prueba="explicacion"]')).not.toBeEmpty();
    // step from the start of the frame through (up to) 1500 instructions: each step lands on the next recorded
    // instruction start; then the last one of the frame, and no further
    const tiempos: number[] = [];
    for (let i = 0; i < it.length; i++) if (it[i]! >= seg.t0 && it[i]! <= seg.t1) tiempos.push(it[i]!);
    const r = await page.evaluate(([n, ultimo]) => {
      const h = (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma;
      const rep = h.rep;
      rep.irA(rep.seg.t0);
      const vistos: number[] = [];
      for (let k = 0; k < n; k++) {
        rep.pasoInstruccion(1);
        vistos.push(rep.t);
      }
      rep.irA(ultimo);
      rep.pasoInstruccion(1);
      return { vistos, despues: rep.t };
    }, [Math.min(1500, tiempos.length), tiempos.at(-1)!] as const);
    const desde = tiempos[0] === seg.t0 ? 1 : 0;
    expect(r.vistos).toEqual(tiempos.slice(desde, desde + r.vistos.length));
    expect(r.despues).toBe(tiempos.at(-1));
  });
}

test('sms: reproducir, pausar, avanzar ciclo a ciclo y la explicación de cada instrucción', async ({ page }) => {
  await abrir(page, 'sms');
  const t = () => page.evaluate(() => (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma.rep.t);
  const t0 = await t();
  await page.getByRole('button', { name: 'Reproducir' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Pausar' }).click();
  const t1 = await t();
  expect(t1).toBeGreaterThan(t0);
  await page.waitForTimeout(400);
  expect(await t()).toBe(t1);
  await page.getByRole('button', { name: 'Ciclo siguiente' }).click();
  const a = await t();
  await page.getByRole('button', { name: 'Ciclo siguiente' }).click();
  expect(await t()).toBeGreaterThan(a);
  await page.getByRole('button', { name: 'Ciclo anterior' }).click();
  expect(await t()).toBe(a);
  // in the frame interrupt the demo's own explanation shows (not the generic one)
  const tVb = await page.evaluate(() => {
    const h = (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma;
    const pc = h.traza.arrays.ins_pc!;
    const it = h.traza.arrays.ins_t!;
    for (let i = 0; i < pc.length; i++) if (pc[i] === 0x38 && it[i]! >= h.rep.seg.t0) return it[i]!;
    return -1;
  });
  expect(tVb).toBeGreaterThan(0);
  await page.evaluate((x) => (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma.ir(x), tVb);
  await expect(page.locator('[data-prueba="instruccion"]')).toContainText('JP $00EF');
  await expect(page.locator('[data-prueba="explicacion"]')).toContainText('interrupción del VDP');
});

test('sms: OUT al puerto de control del VDP ilumina /IOREQ, /WR, A0–A7 y D0–D7 en el esquema', async ({ page }) => {
  await abrir(page, 'sms');
  await page.getByRole('button', { name: 'Desde la entrada del cartucho' }).click();
  // the I/O write cycle of the first OUT ($BF),A, in the middle of its T2–T3
  const t = await page.evaluate(() => {
    const h = (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma;
    const { z80_a: a, z80_k: k, z80_t: tt } = h.traza.arrays as Record<string, ArrayLike<number>>;
    for (let i = 0; i < a.length; i++) if (k[i] === 4 && (a[i]! & 0xff) === 0xbf) return tt[i]! + 30;
    return -1;
  });
  expect(t).toBeGreaterThan(0);
  const r = await redesEn(page, t, 'Esquema', '~{IOREQ}');
  for (const red of ['~{WR}', 'A0', 'A7', 'D0', 'D7']) expect(r.dibujadas).toContain(red);
  expect(r.dibujadas).not.toContain('~{CE3}');
  expect(r.chips).toContain('IC5');
});

test('megadrive: el DMA de la RAM a la VRAM ilumina /BR y el bus del 68000 en la placa y en el esquema', async ({ page }) => {
  await abrir(page, 'megadrive');
  const t = await page.evaluate(() => {
    const h = (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma;
    const { m68k_k: k, m68k_t: tt } = h.traza.arrays as Record<string, ArrayLike<number>>;
    for (let i = 0; i < k.length; i++) if (k[i] === 6 && tt[i]! >= h.rep.seg.t0) return tt[i]! + 16;
    return -1;
  });
  expect(t).toBeGreaterThan(0);
  for (const vista of ['Placa', 'Esquema']) {
    const r = await redesEn(page, t, vista, '/~{RAS0}');
    for (const red of ['/BR', '/VA1', '/~{AS}', '/VD0']) expect(r.dibujadas).toContain(red);
    expect(r.chips).toContain('U2');   // the work RAM answers the VDP's read
  }
  await expect(page.locator('[data-prueba="instruccion"]')).toContainText('MOVE.l #$70000083,(A5)');
});

test('megadrive: una ranura del VDP lee el patrón del plano B por el puerto serie de la VRAM', async ({ page }) => {
  await abrir(page, 'megadrive');
  const t = await page.evaluate(() => {
    const h = (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma;
    const { vram_k: k, vram_t: tt } = h.traza.arrays as Record<string, ArrayLike<number>>;
    for (let i = 0; i < k.length; i++) if (k[i] === 3 && tt[i]! >= h.rep.seg.t0 + 40000) return tt[i]! + 14;
    return -1;
  });
  const r = await redesEn(page, t, 'Placa', '/SD0');
  expect(r.dibujadas).toContain('Net-(U10-~{SE})');   // SC is a clock: drawn, but not listed
  expect(r.dibujadas).toContain('/A0');
});

test('neogeo: la LSPC pide la ROM C por el bus P del cartucho, en la placa', async ({ page }) => {
  await abrir(page, 'neogeo');
  const t = await page.evaluate(() => {
    const h = (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma;
    const tt = h.traza.arrays.crom_t!;
    for (let i = 0; i < tt.length; i++) if (tt[i]! >= h.rep.seg.t0 + 100000) return tt[i]! + 2;
    return -1;
  });
  const r = await redesEn(page, t, 'Placa', 'PCK1');
  expect(r.dibujadas.some((x) => x.startsWith('/Cartridge Slots/P'))).toBe(true);
  expect(r.chips).toContain('CN4');
});

test('neogeo: la escritura en REG_IRQACK de la interrupción vertical ilumina el bus del 68000', async ({ page }) => {
  await abrir(page, 'neogeo');
  const t = await page.evaluate(() => {
    const h = (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma;
    const { m68k_a: a, m68k_f: f, m68k_t: tt } = h.traza.arrays as Record<string, ArrayLike<number>>;
    for (let i = 0; i < a.length; i++) if (a[i] === 0x3c000c && f[i]! & 1 && tt[i]! >= h.rep.seg.t0) return tt[i]! + 10;
    return -1;
  });
  expect(t).toBeGreaterThan(0);
  const r = await redesEn(page, t, 'Esquema', 'AS');
  for (const red of ['/CPU/A2', '/CPU/A3', '/CPU/D2', 'R{slash}W']) expect(r.dibujadas).toContain(red);
  await expect(page.locator('[data-prueba="instruccion"]')).toContainText('MOVE.w #$4,($3C000C).l');
});

test('neogeo (scrolling): arranca desde el reset con nullbios: vectores y código de la ROM del sistema (U36)', async ({ page }) => {
  await abrir(page, 'neogeo');
  await elegirJuego(page, 'scrolling');
  await page.getByRole('button', { name: 'Tras el reset' }).click();
  const r = await page.evaluate(() => {
    const h = (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma;
    const { m68k_a: a, m68k_c: c } = h.traza.arrays as Record<string, ArrayLike<number>>;
    const pc = h.traza.arrays.i68_pc!;
    return { a0: a[0], c0: c[0], a2: a[2], pc0: pc[0], usaUser: Array.prototype.includes.call(pc, 0x122) };
  });
  expect(r.a0).toBe(0);              // SSP from the vector table, which the system ROM covers after reset
  expect(r.c0).toBe(7);              // chip «bios»
  expect(r.pc0).toBe(0xc04300);      // nullbios's RESET
  expect(r.usaUser).toBe(true);      // it calls the cartridge's USER ($122)
  const t = await page.evaluate(() => (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma.traza.arrays.m68k_t![0]! + 10);
  const redes = await redesEn(page, t, 'Esquema', 'AS');
  expect(redes.chips).toContain('U36');
  await expect(page.getByText('nullbios').first()).toBeVisible();
});

test('megadrive (gentris): el conmutador PAL/NTSC cambia de traza', async ({ page }) => {
  await abrir(page, 'megadrive');
  await elegirJuego(page, 'gentris');
  await page.getByRole('button', { name: 'NTSC · 60 Hz' }).click();
  await page.waitForFunction(() => (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma.traza.m.idPrograma === 'gentris-ntsc');
  await page.getByRole('button', { name: 'PAL · 50 Hz' }).click();
  await page.waitForFunction(() => (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma.traza.m.idPrograma === 'gentris');
});
