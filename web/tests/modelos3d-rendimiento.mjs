#!/usr/bin/env node
// Frame cost of the 3D viewer while orbiting (serve a build first, see modelos3d-capturas.mjs):
//
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/modelos3d-rendimiento.mjs [--url http://localhost:4173]
//       [--perfil mac|tableta|movil|todos] [--cpu 4] [--seg 3] [--solo tipo1,tipo2]
//
// For each model it drags the camera round continuously (synthetic pointer events every animation frame) and
// reports the mean and 95th percentile interval between frames and the mean CPU cost of renderer.render()
// (window.__epa3d, kept by motor/visor.ts), with the triangles and draw calls of the last frame. Headless
// Chromium renders WebGL with SwiftShader (on the CPU), so the absolute numbers are pessimistic: compare models
// and profiles with each other, not with a real GPU.
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = opt('--url', 'http://localhost:4173');
const CPU = Number(opt('--cpu', '4'));
const SEG = Number(opt('--seg', '3'));
const PERFILES = {
  mac: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
  tableta: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2.25, isMobile: true, hasTouch: true },
  movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
};
const perfil = opt('--perfil', 'todos');
const perfiles = perfil === 'todos' ? Object.keys(PERFILES) : [perfil];
const solo = opt('--solo', '');
const MODELOS = solo
  ? solo.split(',').map((t) => [t, ''])
  : [
      ['resistencia-axial', ''],
      ['electrolitico', 'corte'],
      ['dip', 'corte'],
      ['qfp', ''],
      ['toroide', ''],
      ['transformador', 'explosion'],
      ['led-5mm', ''],
    ];

const navegador = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const resumen = [];
for (const nombre of perfiles) {
  const ctx = await navegador.newContext(PERFILES[nombre]);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  console.log(`\n${nombre} (CPU ×${CPU})`);
  for (const [tipo, modo] of MODELOS) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.goto(`${BASE}/#/componentes/3d/${tipo}`);
    await page.waitForFunction(() => globalThis.__epaVisor3d?.datos, null, { timeout: 30000 });
    if (modo === 'corte') await page.click('[data-control="corte"]');
    if (modo === 'explosion')
      await page.$eval('[data-control="explosion"]', (el) => {
        el.value = '1';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
    await page.waitForTimeout(800);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    const r = await page.evaluate(async (seg) => {
      const c = document.querySelector('.visor3d canvas');
      const b = c.getBoundingClientRect();
      const x0 = b.left + b.width / 2;
      const y0 = b.top + b.height / 2;
      const ev = (t, x, y) => c.dispatchEvent(new PointerEvent(t, { pointerId: 7, clientX: x, clientY: y, bubbles: true, button: 0, pointerType: 'mouse' }));
      globalThis.__epa3d = { n: 0, total: 0, max: 0, cuadro: 0, marcas: [], triangulos: 0, llamadas: 0 };
      ev('pointerdown', x0, y0);
      const t0 = performance.now();
      await new Promise((res) => {
        const f = () => {
          const t = performance.now() - t0;
          ev('pointermove', x0 + Math.sin(t / 700) * 200, y0 + Math.sin(t / 1100) * 60);
          if (t < seg * 1000) requestAnimationFrame(f);
          else res();
        };
        requestAnimationFrame(f);
      });
      ev('pointerup', x0, y0);
      const s = globalThis.__epa3d;
      const m = s.marcas;
      const d = [];
      for (let i = 1; i < m.length; i++) d.push(m[i] - m[i - 1]);
      d.sort((a, b) => a - b);
      return {
        n: s.n,
        coste: s.total / Math.max(1, s.n),
        cuadro: s.cuadro / Math.max(1, s.n),
        max: s.max,
        media: d.reduce((a, b) => a + b, 0) / Math.max(1, d.length),
        p95: d[Math.floor(d.length * 0.95)] ?? 0,
        tri: s.triangulos,
        llamadas: s.llamadas,
        px: `${c.width}×${c.height}`,
      };
    }, SEG);
    resumen.push({ perfil: nombre, tipo, ...r });
    console.log(
      `${(tipo + (modo ? ` (${modo})` : '')).padEnd(26)} ${String(r.n).padStart(4)} cuadros  intervalo ${r.media.toFixed(1).padStart(5)} ms (p95 ${r.p95.toFixed(1).padStart(5)})  render ${r.coste.toFixed(2).padStart(5)} ms (máx ${r.max.toFixed(1)}), cuadro ${r.cuadro.toFixed(2)} ms  ${String(r.tri).padStart(6)} triángulos  ${r.llamadas} llamadas  ${r.px} px`,
    );
  }
  await ctx.close();
}
await navegador.close();
for (const p of perfiles) {
  const f = resumen.filter((x) => x.perfil === p);
  console.log(`${p}: intervalo medio ${(f.reduce((a, b) => a + b.media, 0) / f.length).toFixed(1)} ms, render medio ${(f.reduce((a, b) => a + b.coste, 0) / f.length).toFixed(2)} ms, cuadro medio ${(f.reduce((a, b) => a + b.cuadro, 0) / f.length).toFixed(2)} ms, peor p95 ${Math.max(...f.map((x) => x.p95)).toFixed(1)} ms`);
}
