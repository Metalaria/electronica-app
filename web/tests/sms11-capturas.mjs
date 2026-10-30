#!/usr/bin/env node
// Screenshots of the Master System II board reconstructed from its photos (0.11): the 3D view inclined, zoomed
// on the Z80 (IC1) and on the VDP (IC5), and the 2D view, on the tablet in portrait (800 × 1280, DPR 2), light
// and dark, into tests/capturas/sms11/.
// Serve the app first (npx vite preview --port 4431), then:
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/sms11-capturas.mjs [--url http://localhost:4431] [--temas claro,oscuro]
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = opt('--url', 'http://localhost:4431');
const temas = opt('--temas', 'claro,oscuro').split(',');
const salida = new URL('./capturas/sms11/', import.meta.url).pathname;
mkdirSync(salida, { recursive: true });
const navegador = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const tema of temas) {
  const ctx = await navegador.newContext({ viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 }));
    } catch {
      /* private mode */
    }
  }, tema);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('error:', e.message));
  const foto = async (nombre) => {
    const f = `${salida}sms-${nombre}-tableta-${tema}.png`;
    await page.screenshot({ path: f, timeout: 240000 });
    console.log(f);
  };
  // inclined, the whole board
  await page.goto(`${BASE}/#/consolas/sms/placa3d`);
  await page.locator('.placa-consola').waitFor({ timeout: 240000 });
  await page.waitForFunction(() => globalThis.__epaPlaca3DListo === true, null, { timeout: 240000 });
  await page.waitForFunction(() => globalThis.__epaPlaca3D?.carasFinas !== undefined, null, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await foto('inclinada');
  // zoomed on a chip: chosen from the route (the view frames it), then closer with the wheel
  for (const [ref, nombre] of [
    ['IC1', 'z80'],
    ['IC5', 'vdp'],
  ]) {
    await page.goto(`${BASE}/#/consolas/sms/placa3d/${ref}`);
    await page.waitForFunction(() => globalThis.__epaPlaca3DListo === true, null, { timeout: 240000 });
    await page.waitForFunction(() => globalThis.__epaPlaca3D?.carasFinas !== undefined, null, { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(1500);
    // the view frames the chosen chip in its middle: closer with the wheel there
    const c = await page.locator('.placa-consola .vista canvas').first().boundingBox();
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
    // (the plain wheel only zooms a focused viewer: Ctrl + wheel, as a trackpad pinch)
    await page.keyboard.down('Control');
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, -60);
      await page.waitForTimeout(300);
    }
    await page.keyboard.up('Control');
    await page.mouse.move(c.x + 4, c.y + 4);
    await page.waitForTimeout(2500);
    await foto(`${nombre}`);
  }
  // 2D, the whole board and the net A0 (its pads lit, no tracks)
  await page.goto(`${BASE}/#/consolas/sms/placa2d/red%3AA0`);
  await page.locator('.placa2d canvas').waitFor({ timeout: 240000 });
  await page.waitForTimeout(2500);
  await foto('2d-red-a0');
  await ctx.close();
}
await navegador.close();
