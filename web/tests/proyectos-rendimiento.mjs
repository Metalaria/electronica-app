#!/usr/bin/env node
// Cost of the «Proyectos KiCad» views while interacting: orbiting the 3D board and panning the 2D board, per
// device profile. Serve the app first (npx vite preview --port 4189), then:
//
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/proyectos-rendimiento.mjs [--url http://localhost:4189]
//       [--perfil mac|tableta|movil] [--seg 3] [--cpu 1] [--placas sdr,hifi-fuente]
//
// For each board: time until the 3D board is up (textures + parts), draw calls and triangles, then while the mouse
// drags for --seg seconds: interval between frames (mean, 95th percentile) and the CPU time of renderer.render();
// for the 2D view the cost of one repaint of the cached bitmap and of one blit while panning.
// Without a GPU, Chromium renders WebGL with SwiftShader (on the CPU): the 3D numbers here are far slower than on
// the Iris Plus 640 or a phone GPU and only useful to compare boards and versions.
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = opt('--url', 'http://localhost:4189');
const SEG = Number(opt('--seg', '3'));
const CPU = Number(opt('--cpu', '1'));
const PERFILES = {
  movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
  mac: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
  tableta: { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2.25, isMobile: true, hasTouch: true },
};
const PERFIL = opt('--perfil', 'mac');
const PLACAS = opt('--placas', 'estacion_iot,fuente_laboratorio,hifi-potencia,hifi-preamplificador,hifi-fuente,hifi-proteccion,sdr').split(',');
const navegador = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await navegador.newContext({ ...PERFILES[PERFIL], reducedMotion: 'reduce' });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);

const pct = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0;
};
const media = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

async function arrastrar(selector, dx, dy) {
  const c = await page.locator(selector).boundingBox();
  const x0 = c.x + c.width / 2;
  const y0 = c.y + c.height / 2;
  await page.evaluate(() => {
    const m = (globalThis.__marcas = []);
    globalThis.__seguir = true;
    const f = (t) => {
      m.push(t);
      if (globalThis.__seguir) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < SEG * 1000) {
    i++;
    await page.mouse.move(x0 + Math.sin(i / 9) * dx, y0 + Math.cos(i / 13) * dy);
  }
  await page.mouse.up();
  const m = await page.evaluate(() => {
    globalThis.__seguir = false;
    return globalThis.__marcas;
  });
  const d = [];
  for (let k = 1; k < m.length; k++) d.push(m[k] - m[k - 1]);
  return d;
}

console.log(`perfil ${PERFIL}, CPU ×${CPU}, ${SEG} s por medida (WebGL por SwiftShader: cifras 3D pesimistas)`);
console.log('placa                  listo(s) llamadas triángulos textura(ms) | 3D intervalo media/p95 (ms) render CPU media/p95 | 2D repintado(ms) blit media/p95');
for (const id of PLACAS) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const t0 = Date.now();
  await page.goto(`${BASE}/?n=${Date.now()}#/proyectos/${id}/3d`, { waitUntil: 'commit', timeout: 300000 });
  await page.waitForFunction(() => globalThis.__epaPlaca3DListo === true, null, { timeout: 180000 });
  const listo = (Date.now() - t0) / 1000;
  await page.waitForTimeout(800);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const n0 = await page.evaluate(() => globalThis.__epaPlaca3D.ms.length);
  const d3 = await arrastrar('.v3d canvas', 160, 60);
  const st = await page.evaluate(() => globalThis.__epaPlaca3D);
  const render = st.ms.slice(Math.min(n0, st.ms.length));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.goto(`${BASE}/?n=${Date.now()}#/proyectos/${id}/placa`, { waitUntil: 'commit', timeout: 300000 });
  await page.waitForFunction(() => !!globalThis.__epaPlaca2D, null, { timeout: 180000 });
  await page.waitForTimeout(500);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const base = await page.evaluate(() => globalThis.__epaPlaca2D.base);
  await page.evaluate(() => (globalThis.__epaPlaca2D.ms = []));
  await arrastrar('.placa2d canvas', 120, 80);
  const blit = await page.evaluate(() => globalThis.__epaPlaca2D.ms);
  console.log(
    `${id.padEnd(22)} ${listo.toFixed(1).padStart(7)} ${String(st.llamadas).padStart(8)} ${String(st.triangulos).padStart(10)} ${st.textura.toFixed(0).padStart(11)} | ` +
      `${media(d3).toFixed(1).padStart(8)} / ${pct(d3, 0.95).toFixed(1).padEnd(14)} ${media(render).toFixed(1).padStart(8)} / ${pct(render, 0.95).toFixed(1).padEnd(6)} | ` +
      `${base.toFixed(0).padStart(10)} ${media(blit).toFixed(1).padStart(8)} / ${pct(blit, 0.95).toFixed(1)}`,
  );
}
await navegador.close();
