#!/usr/bin/env node
// Screenshots of the consoles' boards in 3D with their parts (Game Boy Color: CGB-CPU-04 reconstructed from the
// Gerbers and OpenGBC; Game Boy: Super DMG-01), inclined and from above, light and dark, on the tablet in
// portrait (800 × 1280, DPR 2), into tests/capturas/consolas-gbc/ and tests/capturas/consolas-gb/.
// Serve the app first (npx vite preview --port 4291), then:
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/consolas-placas-capturas.mjs [--url http://localhost:4291]
//       [--temas claro,oscuro] [--placas gbc-cgb04,gbc-opengbc,gb-superdmg]
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = opt('--url', 'http://localhost:4291');
const temas = opt('--temas', 'claro,oscuro').split(',');
// board → machine, button of the board selector, views (the CGB-CPU-04 carries its parts on the bottom face:
// the inclined view shows that face, «Abajo» shows it from above, «Arriba» the buttons' face)
const PLACAS = {
  'gbc-cgb04': { maquina: 'gbc', boton: /CGB-CPU-04/, vistas: ['Inclinada', 'Abajo', 'Arriba'] },
  'gbc-opengbc': { maquina: 'gbc', boton: /OpenGBC/, vistas: ['Inclinada', 'Arriba'] },
  'gb-superdmg': { maquina: 'gb', boton: null, vistas: ['Inclinada', 'Arriba'] },
};
const placas = opt('--placas', Object.keys(PLACAS).join(',')).split(',');
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
  for (const id of placas) {
    const c = PLACAS[id];
    const salida = new URL(`./capturas/consolas-${c.maquina}/`, import.meta.url).pathname;
    mkdirSync(salida, { recursive: true });
    await page.goto(`${BASE}/#/consolas/${c.maquina}/placa3d`);
    await page.locator('.placa-consola').waitFor({ timeout: 240000 });
    if (c.boton) {
      await page.evaluate(() => (globalThis.__epaPlaca3DListo = false));
      await page.locator('.placas').getByRole('button', { name: c.boton }).click({ timeout: 240000 });
    }
    await page.waitForFunction((i) => document.querySelector('.placa-consola')?.getAttribute('data-placa') === i, id, { timeout: 240000 });
    await page.waitForFunction(() => globalThis.__epaPlaca3DListo === true, null, { timeout: 240000 });
    // the faces at full resolution come after the frame with the parts
    await page.waitForFunction(() => globalThis.__epaPlaca3D?.carasFinas !== undefined, null, { timeout: 120000 }).catch(() => {});
    for (const v of c.vistas) {
      await page.getByRole('toolbar', { name: 'Opciones de la vista 3D' }).getByRole('button', { name: v, exact: true }).click({ timeout: 240000 });
      await page.waitForTimeout(4000);
      const f = `${salida}${id}-${v.toLowerCase()}-tableta-${tema}.png`;
      await page.screenshot({ path: f, timeout: 240000 });
      console.log(f);
    }
  }
  await ctx.close();
}
await navegador.close();
