#!/usr/bin/env node
// Frame cost of every component animation on a «mid-range phone» (Chromium with 4× CPU throttling and a
// 412×915 viewport, touch, DPR 2.6) or on the other target devices (--perfil). Serve the app first (dev or
// a production build):
//
//   npm run build && npx vite preview --port 4173      (in another terminal)
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/animaciones.mjs [--url http://localhost:4173] [--seg 3]
//       [--cpu 4] [--solo id1,id2] [--perfil movil|mac|tableta|tableta-vertical]
//
// For each animation it reports the mean and 95th percentile interval between frames (16,7 ms = 60 fps) and
// the mean and maximum cost of one simulation step plus drawing (window.__epaAnim, kept by Escena.svelte).
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = opt('--url', 'http://localhost:4173');
const SEG = Number(opt('--seg', '3'));
const CPU = Number(opt('--cpu', '4'));
const fuente = readFileSync(new URL('../src/componentes/animaciones/cargadores.ts', import.meta.url), 'utf8');
let ids = [...fuente.matchAll(/^\s+'?([a-z0-9-]+)'?: \(\) => import/gm)].map((m) => m[1]);
const solo = opt('--solo', '');
if (solo) ids = ids.filter((i) => solo.split(',').includes(i));

// Devices: a mid-range phone, the 13" MacBook Pro (1280 × 800 CSS at 2×) and an 11" 2880 × 1800 Android
// tablet in both orientations.
const PERFILES = {
  movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
  mac: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
  tableta: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2.25, isMobile: true, hasTouch: true },
  'tableta-vertical': { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2.25, isMobile: true, hasTouch: true },
};
const PERFIL = opt('--perfil', 'movil');
const navegador = await chromium.launch();
const ctx = await navegador.newContext(PERFILES[PERFIL]);
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const filas = [];
for (const id of ids) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.goto(`${BASE}/#/componentes/${id}`);
  await page.waitForSelector('.escena canvas', { timeout: 20000 });
  await page.waitForTimeout(800);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    globalThis.__epaAnim = { n: 0, total: 0, max: 0, marcas: [] };
  });
  await page.waitForTimeout(SEG * 1000);
  const r = await page.evaluate(() => {
    const s = globalThis.__epaAnim;
    const m = s.marcas;
    const d = [];
    for (let i = 1; i < m.length; i++) d.push(m[i] - m[i - 1]);
    d.sort((a, b) => a - b);
    const media = d.reduce((a, b) => a + b, 0) / Math.max(1, d.length);
    return { n: s.n, coste: s.total / Math.max(1, s.n), max: s.max, media, p95: d[Math.floor(d.length * 0.95)] ?? 0 };
  });
  filas.push({ id, ...r });
  console.log(
    `${id.padEnd(28)} ${String(r.n).padStart(4)} frames  intervalo ${r.media.toFixed(1).padStart(5)} ms (p95 ${r.p95.toFixed(1).padStart(5)})  coste ${r.coste.toFixed(2).padStart(5)} ms (máx ${r.max.toFixed(1)})`,
  );
}
await navegador.close();
const peor = filas.reduce((a, b) => (b.p95 > a.p95 ? b : a), filas[0]);
console.log(`\nPeor p95: ${peor.id} ${peor.p95.toFixed(1)} ms · coste medio global ${(filas.reduce((a, b) => a + b.coste, 0) / filas.length).toFixed(2)} ms`);
