#!/usr/bin/env node
// Frame-rate independence of the component animations (144 Hz screens such as the Xiaomi Pad 6 would run
// anything that advances per frame 2,4 times too fast). requestAnimationFrame and performance.now are
// replaced by a fake clock; every scene first runs 2 s stepped at 144 Hz (6,94 ms), then the test checks,
// through the hook Escena.svelte leaves in window.__epaEscena, that:
//   1. drawing twice without advancing gives the same picture (nothing moves inside the drawing code);
//   2. 240 simulation steps of 10 µs (2,4 ms in all) barely change it, compared with 240 steps of 1/60 s
//      (4 s): what moves does so in proportion to the elapsed time, not to the number of calls.
//
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/animaciones-hz.mjs [--url http://localhost:4173]
//       [--solo id1,id2] [--coleccion componentes|conceptos]
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = opt('--url', 'http://localhost:4173');
// Both collections: component animations (#/componentes/<id>) and concept animations (#/conceptos/<id>);
// --coleccion componentes|conceptos restricts the run to one of them.
const leer = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const idsDe = (txt) => [...txt.matchAll(/^\s+'?([a-z0-9-]+)'?: \(\) => import/gm)].map((m) => m[1]);
const coleccion = opt('--coleccion', 'todas');
const rutas = {};
if (coleccion !== 'conceptos') for (const i of idsDe(leer('../src/componentes/animaciones/cargadores.ts'))) rutas[i] = 'componentes';
if (coleccion !== 'componentes') for (const i of idsDe(leer('../src/componentes/animaciones/conceptos/cargadores.ts'))) rutas[i] = 'conceptos';
let ids = Object.keys(rutas);
const solo = opt('--solo', '');
if (solo) ids = ids.filter((i) => solo.split(',').includes(i));

// Fake clock: rAF callbacks and performance.now only advance when the test pumps frames.
const reloj = () => {
  const cola = [];
  let ahora = 1000;
  let id = 0;
  window.requestAnimationFrame = (f) => {
    cola.push({ f, id: ++id });
    return id;
  };
  window.cancelAnimationFrame = (n) => {
    const i = cola.findIndex((c) => c.id === n);
    if (i >= 0) cola.splice(i, 1);
  };
  performance.now = () => ahora;
  window.__bombear = async (ms, paso) => {
    let n = 0;
    for (let t = 0; t < ms; t += paso) {
      ahora += paso;
      const lote = cola.splice(0);
      for (const c of lote) c.f(ahora);
      n += lote.length ? 1 : 0;
      await Promise.resolve();
    }
    return n;
  };
  // Picture reduced to 8 × 8 px cells, so that the comparison measures where things are, not single pixels.
  window.__foto = () => {
    const src = document.querySelector('.escena canvas');
    const w = Math.ceil(src.width / 8);
    const h = Math.ceil(src.height / 8);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.drawImage(src, 0, 0, w, h);
    return Array.from(g.getImageData(0, 0, w, h).data);
  };
};
const dif = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
  return s / ((a.length / 4) * 3);
};

const navegador = await chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
await ctx.addInitScript(reloj);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('ERROR', e.message));

const filas = [];
for (const id of ids) {
  await page.goto(`${BASE}/#/${rutas[id]}/${id}`);
  await page.waitForSelector('.escena canvas', { timeout: 20000 });
  await page.waitForTimeout(300);
  const fotogramas = await page.evaluate(() => window.__bombear(2000, 1000 / 144));
  // Canvas text requests its font weights on first use (during the frames above): wait for them and draw a
  // few more frames, so that a late font swap is not taken for movement.
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.__bombear(50, 1000 / 144));
  const a = await page.evaluate(() => window.__foto());
  const b = await page.evaluate(() => (window.__epaEscena.dibujar(), window.__foto()));
  const c = await page.evaluate(() => (window.__epaEscena.pasos(240, 1e-5), window.__foto()));
  const r = await page.evaluate(() => (window.__epaEscena.pasos(240, 1 / 60), window.__foto()));
  const dDib = dif(a, b);
  const dPas = dif(b, c);
  const ref = dif(c, r);
  const mal = dDib > 0.05 || (dPas > 0.2 && dPas > 0.25 * ref);
  filas.push({ id, mal });
  console.log(
    `${id.padEnd(28)} ${String(fotogramas).padStart(3)} fotogramas en 2 s · redibujar ${dDib.toFixed(3)} · 240 pasos cortos ${dPas.toFixed(3)} (4 s: ${ref.toFixed(2)})${mal ? '  ← revisar' : ''}`,
  );
}
await navegador.close();
const malas = filas.filter((f) => f.mal);
console.log(malas.length ? `\nRevisar: ${malas.map((f) => f.id).join(', ')}` : '\nTodas las escenas avanzan con el tiempo, no con los fotogramas.');
