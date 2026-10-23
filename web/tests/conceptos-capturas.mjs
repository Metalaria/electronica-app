#!/usr/bin/env node
// Screenshots of every concept animation on the three target screens (phone, 13" MacBook Pro at 1280 × 800 and
// DPR 2, tablet portrait), light and dark, and one contact sheet per screen and theme. Serve the app first:
//
//   npm run build && npx vite preview --port 4173      (in another terminal)
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/conceptos-capturas.mjs [--url http://localhost:4173]
//       [--solo id1,id2] [--perfil movil|mac|tableta-vertical] [--tema claro|oscuro]
//
// Output: tests/capturas/conceptos/<perfil>-<tema>/<id>.png and tests/capturas/conceptos/hoja-<perfil>-<tema>.png
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = opt('--url', 'http://localhost:4173');
const fuente = readFileSync(new URL('../src/componentes/animaciones/conceptos/cargadores.ts', import.meta.url), 'utf8');
const todos = [...fuente.matchAll(/^\s+'?([a-z0-9-]+)'?: \(\) => import/gm)].map((m) => m[1]);
let ids = todos;
const solo = opt('--solo', '');
if (solo) ids = ids.filter((i) => solo.split(',').includes(i));

const PERFILES = {
  movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
  mac: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
  'tableta-vertical': { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2.25, isMobile: true, hasTouch: true },
};
const perfiles = opt('--perfil', '') ? [opt('--perfil', '')] : Object.keys(PERFILES);
const temas = opt('--tema', '') ? [opt('--tema', '')] : ['claro', 'oscuro'];
const SALIDA = new URL('capturas/conceptos/', import.meta.url);
const ESPERA = { 'fuente-lineal': 6000, 'adaptacion-smith': 6800 };

const navegador = await chromium.launch();
for (const perfil of perfiles)
  for (const tema of temas) {
    const dir = new URL(`${perfil}-${tema}/`, SALIDA);
    mkdirSync(dir, { recursive: true });
    const ctx = await navegador.newContext({ ...PERFILES[perfil], colorScheme: tema === 'oscuro' ? 'dark' : 'light', reducedMotion: 'no-preference' });
    await ctx.addInitScript((t) => localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 })), tema);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`ERROR ${perfil} ${tema}:`, e.message));
    for (const id of ids) {
      await page.goto(`${BASE}/#/conceptos/${id}`);
      await page.waitForSelector('.escena canvas', { timeout: 30000 });
      // The sticky top bar and the phone's bottom tab bar would otherwise be painted over tall element screenshots.
      await page.addStyleTag({ content: '.barra, .pestanas { position: static !important; } html { scroll-behavior: auto !important; }' });
      // Let the animation run a little (the ngspice scene simulate, the Smith path reach the centre).
      await page.waitForTimeout(ESPERA[id] ?? 2200);
      const ruta = new URL(`${id}.png`, dir);
      // A full-page capture clipped to the scene: element screenshots of elements taller than an emulated
      // phone's viewport come out shifted.
      const caja = await page.evaluate(() => {
        const r = document.querySelector('.animacion').getBoundingClientRect();
        return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
      });
      await page.screenshot({ path: ruta.pathname, fullPage: true, clip: caja });
    }
    // The sheet always shows every scene that has a screenshot (so --solo refreshes some without losing the rest).
    const fotos = todos
      .filter((id) => existsSync(new URL(`${id}.png`, dir)))
      .map((id) => ({ id, png: readFileSync(new URL(`${id}.png`, dir)).toString('base64') }));
    // Contact sheet: thumbnails in a grid, rendered by the browser itself.
    const col = perfil === 'movil' ? 6 : 4;
    const html = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;padding:16px;background:${tema === 'oscuro' ? '#111' : '#ddd'};font:600 14px system-ui;color:${tema === 'oscuro' ? '#eee' : '#222'}}
      .g{display:grid;grid-template-columns:repeat(${col},1fr);gap:12px}
      figure{margin:0;background:${tema === 'oscuro' ? '#000' : '#fff'};padding:6px;border-radius:6px}
      img{width:100%;display:block}
      figcaption{padding:4px 2px 0}
    </style><h1>Conceptos animados · ${perfil} · ${tema}</h1><div class="g">${fotos
      .map((f) => `<figure><img src="data:image/png;base64,${f.png}"><figcaption>${f.id}</figcaption></figure>`)
      .join('')}</div>`;
    const hoja = await navegador.newPage({ viewport: { width: 1800, height: 1200 } });
    await hoja.setContent(html, { waitUntil: 'load' });
    await hoja.screenshot({ path: new URL(`hoja-${perfil}-${tema}.png`, SALIDA).pathname, fullPage: true });
    await hoja.close();
    await ctx.close();
    console.log(`${perfil} ${tema}: ${ids.length} capturas, hoja con ${fotos.length}`);
  }
await navegador.close();
