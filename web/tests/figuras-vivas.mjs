#!/usr/bin/env node
// Frame cost of the live schematics in the reader (figuras-vivas), like tests/animaciones.mjs: Chromium with
// CPU throttling on the target devices. Serve the app first (npx vite preview --port 4173), then:
//
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/figuras-vivas.mjs [--url http://localhost:4173]
//       [--seg 3] [--cpu 4] [--perfil movil|mac|tableta|tableta-vertical]
//
// For each figure it reports the interval between frames (mean and 95th percentile; 16,7 ms = 60 fps) and the
// cost of one step + drawing of the particle layer (window.__epaFiguras, kept by CapaEsquema.svelte), and
// checks that nothing animates once the figure is off screen.
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = opt('--url', 'http://localhost:4173');
const SEG = Number(opt('--seg', '3'));
const CPU = Number(opt('--cpu', '4'));
const PERFILES = {
  movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
  mac: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
  tableta: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2.25, isMobile: true, hasTouch: true },
  'tableta-vertical': { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2.25, isMobile: true, hasTouch: true },
};
// Live schematics: transients (22.3, 22.7, 22.16), a large drawing (49.8) and several drawings (23.9).
const FIGURAS = [
  ['cap22', 'fig-22.3'],
  ['cap22', 'fig-22.7'],
  ['cap22', 'fig-22.16'],
  ['cap23', 'fig-23.6'],
  ['cap23', 'fig-23.9'],
  ['cap49', 'fig-49.8'],
  ['cap53', 'fig-53.12'],
];
const PERFIL = opt('--perfil', 'mac');
const navegador = await chromium.launch();
const ctx = await navegador.newContext(PERFILES[PERFIL]);
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const filas = [];
const medir = () =>
  page.evaluate(() => {
    const s = globalThis.__epaFiguras ?? { n: 0, total: 0, max: 0, marcas: [] };
    const m = s.marcas;
    const d = [];
    for (let i = 1; i < m.length; i++) d.push(m[i] - m[i - 1]);
    d.sort((a, b) => a - b);
    const media = d.reduce((a, b) => a + b, 0) / Math.max(1, d.length);
    return { n: s.n, coste: s.total / Math.max(1, s.n), max: s.max, media, p95: d[Math.floor(d.length * 0.95)] ?? 0 };
  });
const reiniciar = () => page.evaluate(() => (globalThis.__epaFiguras = { n: 0, total: 0, max: 0, marcas: [] }));
for (const [parte, label] of FIGURAS) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.goto(`${BASE}/#/${parte}/${label}`);
  const fig = page.locator(`figure#${label.replace('.', '\\.')}`);
  await fig.waitFor({ timeout: 20000 });
  await fig.scrollIntoViewIfNeeded();
  await page.waitForSelector(`figure#${label.replace('.', '\\.')} .capa-p`, { timeout: 20000 });
  // Let the reader finish laying out the rest of the chapter in idle time (not part of this measure).
  await page.waitForTimeout(4000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await page.waitForTimeout(500);
  await reiniciar();
  await page.waitForTimeout(SEG * 1000);
  const r = await medir();
  // Off screen: scroll far away; the loop must stop.
  await page.evaluate(() => window.scrollBy(0, 6000));
  await page.waitForTimeout(600);
  await reiniciar();
  await page.waitForTimeout(1000);
  const fuera = (await medir()).n;
  filas.push({ label, ...r, fuera });
  console.log(
    `${label.padEnd(11)} ${String(r.n).padStart(4)} frames  intervalo ${r.media.toFixed(1).padStart(5)} ms (p95 ${r.p95.toFixed(1).padStart(5)})  coste ${r.coste.toFixed(2).padStart(5)} ms (máx ${r.max.toFixed(1)})  fuera de pantalla: ${fuera} frames`,
  );
}
await navegador.close();
const peor = filas.reduce((a, b) => (b.p95 > a.p95 ? b : a), filas[0]);
console.log(`\nPerfil ${PERFIL}, CPU ×${CPU}. Peor p95: ${peor.label} ${peor.p95.toFixed(1)} ms · coste medio ${(filas.reduce((a, b) => a + b.coste, 0) / filas.length).toFixed(2)} ms`);
