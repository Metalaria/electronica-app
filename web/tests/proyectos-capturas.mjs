#!/usr/bin/env node
// Screenshots of every «Proyectos KiCad» board in 3D and 2D (and the schematic of one), on the phone, the
// 1280 × 800 MacBook at DPR 2 and the tablet in portrait, light and dark, into tests/capturas/proyectos/.
// Serve the app first (npx vite preview --port 4189), then:
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/proyectos-capturas.mjs [--url http://localhost:4189]
//       [--perfiles movil,mac,tableta] [--temas claro,oscuro] [--placas sdr] [--vistas 3d,placa]
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = opt('--url', 'http://localhost:4189');
const PERFILES = {
  movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  mac: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
  tableta: { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const perfiles = opt('--perfiles', 'movil,mac,tableta').split(',');
const temas = opt('--temas', 'claro,oscuro').split(',');
const placas = opt('--placas', 'estacion_iot,fuente_laboratorio,hifi-potencia,hifi-preamplificador,hifi-fuente,hifi-proteccion,sdr').split(',');
const vistas = opt('--vistas', '3d,placa').split(',');
const SALIDA = new URL('./capturas/proyectos/', import.meta.url).pathname;
mkdirSync(SALIDA, { recursive: true });
const navegador = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const perfil of perfiles) {
  for (const tema of temas) {
    const ctx = await navegador.newContext(PERFILES[perfil]);
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 }));
      } catch {
        /* private mode */
      }
    }, tema);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('error:', e.message));
    for (const id of placas) {
      for (const v of vistas) {
        await page.goto(`${BASE}/#/proyectos/${id}/${v}`);
        if (v === '3d') await page.waitForFunction(() => globalThis.__epaPlaca3DListo === true, null, { timeout: 180000 });
        await page.waitForTimeout(v === '3d' ? 2500 : 1200);
        const f = `${SALIDA}${id}-${v}-${perfil}-${tema}.png`;
        await page.screenshot({ path: f, timeout: 240000 });
        console.log(f);
      }
    }
    await ctx.close();
  }
}
await navegador.close();
