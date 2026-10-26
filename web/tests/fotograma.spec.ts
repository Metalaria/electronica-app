// «Un fotograma» (NES, Game Boy, Game Boy Color): trace integrity (the frame replayed by the app equals the
// emulator's framebuffer pixel for pixel, also on the screen canvas), player controls, step by step instruction
// count, net highlighting on the schematic and on the board, touch, no page zoom on pinch.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test -c playwright.fotogramaA.config.ts tests/fotograma.spec.ts
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
    nivel: string;
    pasoInstruccion(d: 1 | -1): void;
    indiceInstruccion(t?: number): number;
    irA(t: number): void;
  };
  traza: { m: { fb?: string; pixeles: { c: string }; video: { ancho: number; alto: number; formato: string; paleta?: number[] } }; arrays: Record<string, ArrayLike<number>> };
  ir(t: number): void;
}

async function abrir(page: Page, m: string, juego = false): Promise<void> {
  await page.goto(`#/consolas/${m}/fotograma`);
  await page.waitForFunction(() => !!(globalThis as unknown as { __epaFotograma?: Hook }).__epaFotograma, null, { timeout: 60_000 });
  if (juego) {
    await page.getByRole('tab', { name: 'Un juego de verdad' }).click();
    await page.waitForFunction(() => (globalThis as unknown as { __epaFotograma?: { traza: { m: { tipo: string } } } }).__epaFotograma?.traza.m.tipo === 'juego', null, {
      timeout: 60_000,
    });
  }
}

// the homebrew game of each console (contenido/fotograma/juegos.json)
const JUEGO: Record<string, string> = { nes: 'rfk', gb: 'libbet', gbc: 'tobudx' };

function trazaNode(m: string, programa = 'demo') {
  return leerTraza(readFileSync(new URL(`../public/consolas/fotograma/${m}/${programa}.bin`, import.meta.url)));
}

for (const [m, juego] of ['nes', 'gb', 'gbc'].flatMap((x) => [[x, false], [x, true]] as [string, boolean][])) {
  test(`${m}${juego ? ' (juego)' : ''}: la traza reproduce el cuadro del emulador píxel a píxel`, async ({ page }) => {
    await abrir(page, m, juego);
    // data: the pixel stream of the frame segment against the emulator's framebuffer
    const datos = await page.evaluate(() => {
      const h = (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma;
      const { m: man, arrays } = h.traza;
      const s = h.rep.seg;
      const pc = arrays[man.pixeles.c]!;
      const fb = arrays[man.fb!]!;
      let dif = 0;
      for (let i = 0; i < fb.length; i++) if (pc[s.pixel0 + i] !== fb[i]) dif++;
      return { n: s.pixel1 - s.pixel0, total: fb.length, dif, ancho: man.video.ancho, alto: man.video.alto };
    });
    expect(datos.n).toBe(datos.ancho * datos.alto);
    expect(datos.total).toBe(datos.ancho * datos.alto);
    expect(datos.dif).toBe(0);
    // screen: jump to the end of the frame and read the canvas back
    const pant = await page.evaluate(async () => {
      const h = (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma;
      h.ir(h.rep.seg.t1);
      await new Promise((r) => setTimeout(r, 300));
      const c = document.querySelector('.pantalla canvas') as HTMLCanvasElement;
      const img = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      const man = h.traza.m;
      const fb = h.traza.arrays[man.fb!]!;
      let dif = 0;
      for (let i = 0; i < fb.length; i++) {
        const v = fb[i]!;
        let r: number;
        let g: number;
        let b: number;
        if (man.video.formato === 'rgb555') {
          r = Math.round(((v & 31) * 255) / 31);
          g = Math.round((((v >> 5) & 31) * 255) / 31);
          b = Math.round((((v >> 10) & 31) * 255) / 31);
        } else {
          const x = man.video.paleta![v]!;
          r = x >> 16;
          g = (x >> 8) & 255;
          b = x & 255;
        }
        if (img[i * 4] !== r || img[i * 4 + 1] !== g || img[i * 4 + 2] !== b) dif++;
      }
      return { dif, w: c.width, h: c.height };
    });
    expect(pant.dif).toBe(0);
    // the generator's reader decodes the same file to the same pixels
    const nodo = trazaNode(m, juego ? JUEGO[m] : 'demo');
    const seg = nodo.manifiesto.segmentos.find((s: { id: string }) => s.id === 'fotograma');
    const fbNodo = Array.from(nodo.arrays[nodo.manifiesto.fb] as ArrayLike<number>);
    const pcNodo = Array.from(nodo.arrays[nodo.manifiesto.pixeles.c] as ArrayLike<number>).slice(seg.pixel0, seg.pixel1);
    expect(pcNodo).toEqual(fbNodo);
  });
}

test('nes: reproducir, pausar y avanzar ciclo a ciclo', async ({ page }) => {
  await abrir(page, 'nes');
  const t = () => page.evaluate(() => (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma.rep.t);
  const t0 = await t();
  await page.getByRole('button', { name: 'Reproducir' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Pausar' }).click();
  const t1 = await t();
  expect(t1).toBeGreaterThan(t0);
  await page.waitForTimeout(400);
  expect(await t()).toBe(t1);
  // one CPU cycle = 3 PPU dots, from a cycle boundary
  await page.getByRole('button', { name: 'Ciclo siguiente' }).click();
  const a = await t();
  await page.getByRole('button', { name: 'Ciclo siguiente' }).click();
  const b = await t();
  expect(b - a).toBe(3);
  await page.getByRole('button', { name: 'Ciclo anterior' }).click();
  expect(await t()).toBe(a);
  // the speed levels change the zoomed timeline and the slow-down factor
  await page.getByRole('button', { name: 'Un ciclo' }).click();
  await expect(page.locator('.factor')).toContainText('10⁶');
  await page.getByRole('button', { name: 'Cuadro entero' }).click();
  await expect(page.locator('.factor')).toContainText('10³');
  // the timeline seeks when dragged
  const lienzo = page.getByLabel(/Línea de tiempo/);
  await lienzo.scrollIntoViewIfNeeded();
  const caja = (await lienzo.boundingBox())!;
  await page.mouse.click(caja.x + caja.width * 0.75, caja.y + 10);
  const tl = await page.evaluate(() => {
    const r = (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma.rep;
    return (r.t - r.seg.t0) / (r.seg.t1 - r.seg.t0);
  });
  expect(tl).toBeGreaterThan(0.6);
  expect(tl).toBeLessThan(0.85);
});

for (const [m, juego] of ['nes', 'gb', 'gbc'].flatMap((x) => [[x, false], [x, true]] as [string, boolean][])) {
  test(`${m}${juego ? ' (juego)' : ''}: paso a paso por instrucciones, tantas como grabó el emulador`, async ({ page }) => {
    await abrir(page, m, juego);
    // the generator's count of instructions (and interrupt entries) inside the frame segment
    const nodo = trazaNode(m, juego ? JUEGO[m] : 'demo');
    const seg = nodo.manifiesto.segmentos.find((s: { id: string }) => s.id === 'fotograma');
    const it = nodo.arrays[nodo.manifiesto.instrucciones[0].t] as ArrayLike<number>;
    let esperadas = 0;
    for (let i = 0; i < it.length; i++) if (it[i]! >= seg.t0 && it[i]! <= seg.t1) esperadas++;
    expect(esperadas).toBeGreaterThan(100);
    // a few steps through the button, checking the index moves one by one
    await page.getByRole('button', { name: 'Al principio del tramo' }).click();
    const idx = () => page.evaluate(() => (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma.rep.indiceInstruccion());
    const i0 = await idx();
    for (let k = 1; k <= 5; k++) {
      await page.getByRole('button', { name: 'Instrucción siguiente' }).click();
      expect(await idx()).toBe(i0 + k);
    }
    await page.getByRole('button', { name: 'Instrucción anterior' }).click();
    expect(await idx()).toBe(i0 + 4);
    await expect(page.locator('[data-prueba="explicacion"]')).not.toBeEmpty();
    // then the whole segment with the player's step, counting
    const n = await page.evaluate(() => {
      const r = (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma.rep;
      const h = (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma;
      r.irA(r.seg.t0);
      // the window starts at an instruction (or, on the Game Boy, maybe inside HALT, before the first one)
      let pasos = Array.prototype.includes.call(h.traza.arrays.ins_t!, r.seg.t0) ? 1 : 0;
      let t = r.t;
      for (;;) {
        r.pasoInstruccion(1);
        if (r.t === t) break;
        t = r.t;
        pasos++;
      }
      return pasos;
    });
    expect(n).toBe(esperadas);
  });
}

test('nes: el ciclo de escritura en $4014 ilumina el bus en el esquema y en la placa', async ({ page }) => {
  await abrir(page, 'nes');
  // the cycle of the write to OAMDMA ($4014) inside the frame
  const t = await page.evaluate(() => {
    const h = (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma;
    const a = h.traza.arrays.cpu_a!;
    const f = h.traza.arrays.cpu_f!;
    const tt = h.traza.arrays.cpu_t!;
    for (let i = 0; i < a.length; i++) if (a[i] === 0x4014 && f[i]! & 1 && tt[i]! >= h.rep.seg.t0) return tt[i]! + 2;
    return -1;
  });
  expect(t).toBeGreaterThan(0);
  await page.evaluate((x) => (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma.ir(x), t);
  await expect(page.locator('[data-prueba="instruccion"]')).toContainText('STA OAMDMA');
  for (const vista of ['Esquema', 'Placa']) {
    await page.getByRole('tab', { name: vista, exact: true }).click();
    await page.waitForFunction(
      () => ((globalThis as unknown as { __epaFotogramaRedes?: { dibujadas: string[] } }).__epaFotogramaRedes?.dibujadas.length ?? 0) > 10,
      null,
      { timeout: 30_000 },
    );
    const r = await page.evaluate(() => (globalThis as unknown as { __epaFotogramaRedes: { dibujadas: string[]; chips: string[] } }).__epaFotogramaRedes);
    expect(r.dibujadas).toContain('/CPU-A14');
    expect(r.dibujadas).toContain('/CPU-R~{W}');
    expect(r.dibujadas).toContain('/CPU-D0');
    // $4014 is inside the 2A03: no chip select of the 74HC139
    expect(r.dibujadas).not.toContain('/~{ROMSEL}');
  }
  // a fetch of the PPU: ALE and the multiplexed bus
  const tp = await page.evaluate(() => {
    const h = (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma;
    const tt = h.traza.arrays.ppu_t!;
    for (let i = 0; i < tt.length; i++) if (tt[i]! >= h.rep.seg.t0 + 30000) return tt[i]!;
    return -1;
  });
  await page.evaluate((x) => (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma.ir(x), tp);
  await page.waitForTimeout(300);
  const r2 = await page.evaluate(() => (globalThis as unknown as { __epaFotogramaRedes: { dibujadas: string[] } }).__epaFotogramaRedes);
  expect(r2.dibujadas).toContain('/ALE');
  expect(r2.dibujadas).toContain('/PPU-A0');
});

test('gb: una lectura de la VRAM de la PPU ilumina MA/MD en el cobre de la foto', async ({ page }) => {
  await abrir(page, 'gb');
  const t = await page.evaluate(() => {
    const h = (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma;
    const tt = h.traza.arrays.vram_t!;
    const f = h.traza.arrays.vram_f!;
    for (let i = 0; i < tt.length; i++) if (tt[i]! >= h.rep.seg.t0 + 20000 && !(f[i]! & 32)) return tt[i]! + 1;
    return -1;
  });
  await page.evaluate((x) => (globalThis as unknown as { __epaFotograma: Hook }).__epaFotograma.ir(x), t);
  await page.getByRole('tab', { name: 'Cobre (foto)' }).click();
  await page.waitForFunction(
    () => ((globalThis as unknown as { __epaFotogramaRedes?: { dibujadas: string[] } }).__epaFotogramaRedes?.dibujadas ?? []).includes('/~{MRD}'),
    null,
    { timeout: 30_000 },
  );
  const r = await page.evaluate(() => (globalThis as unknown as { __epaFotogramaRedes: { dibujadas: string[]; chips: string[] } }).__epaFotogramaRedes);
  expect(r.dibujadas).toContain('/~{MCS}');
  expect(r.dibujadas.some((x) => x.startsWith('/MA'))).toBe(true);
  expect(r.chips).toContain('U2');
});

test.describe('táctil', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });

  test('gbc: tocar los controles y pellizcar la placa no amplía la página', async ({ page }) => {
    await abrir(page, 'gbc');
    await page.getByRole('button', { name: 'Reproducir' }).tap();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Pausar' }).tap();
    await page.getByRole('button', { name: 'Instrucción siguiente' }).tap();
    const placa = page.getByLabel(/Placa con el recorrido/);
    await placa.scrollIntoViewIfNeeded();
    const b = (await placa.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const toque = (d: number) => [
      { x: cx - d, y: cy, id: 0 },
      { x: cx + d, y: cy, id: 1 },
    ];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: toque(20) });
    for (let d = 24; d <= 100; d += 8) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: toque(d) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412);
    expect(await placa.evaluate((e) => getComputedStyle(e).touchAction)).toBe('none');
  });
});

test('las fuentes acreditan los juegos homebrew y enlazan su licencia', async ({ page }) => {
  for (const [m, nombre, autor, licencia, texto] of [
    ['nes', 'robotfindskitten', 'Damian Yerrick', 'zlib', 'zlib'],
    ['gb', 'Libbet', 'Damian Yerrick', 'zlib', 'zlib'],
    ['gbc', 'Tobu Tobu Girl Deluxe', 'Tangram Games', 'CC BY 4.0', 'Creative Commons Attribution 4.0'],
  ]) {
    await page.goto(`#/consolas/${m}/fuentes`);
    const f = page.locator('.fotograma-fuentes');
    await expect(f).toContainText(nombre!);
    await expect(f).toContainText(autor!);
    await expect(f).toContainText(licencia!);
    const href = await f.getByRole('link', { name: 'texto de la licencia' }).getAttribute('href');
    const txt = await page.evaluate(async (h) => (await fetch(h!)).text(), href);
    expect(txt).toContain(texto!);
    if (m === 'gbc') expect(txt).toContain('MIT License');
  }
});
