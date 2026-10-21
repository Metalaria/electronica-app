#!/usr/bin/env node
// Benchmark of a reference jump to another chapter on a «slow phone»: Chromium with 6× CPU throttling and a
// 412×915 viewport (touch, DPR 2.6). Serve a production build first:
//
//   npm run build && npx vite preview --port 4173      (in another terminal)
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/rendimiento.mjs [--url http://localhost:4173] [--veces 3]
//
// For each jump it reports, from the click: «visible» (target element in the DOM) and «colocado» (target
// positioned under the top bar and stable for 3 frames). Medians over --veces runs, each in a fresh page.
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = opt('--url', 'http://localhost:4173');
const VECES = Number(opt('--veces', '3'));

const SALTOS = [
  // [starting part, reference key clicked, description]
  ['cap05', 'sec-53.4', 'cap05 → cap53 (la parte más grande)'],
  ['cap05', 'sec-26.8', 'cap05 → cap26'],
  ['cap05', 'sec-6.1', 'cap05 → cap06 (la siguiente)'],
];

const navegador = await chromium.launch();
const resultados = [];
for (const [desde, clave, nombre] of SALTOS) {
  const medidas = [];
  for (let k = 0; k < VECES; k++) {
    const ctx = await navegador.newContext({
      viewport: { width: 412, height: 915 },
      deviceScaleFactor: 2.6,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await page.goto(`${BASE}/#/${desde}`);
    await page.waitForSelector('.cuerpo .trozo');
    // Let the start-up settle (and idle prefetching, if any, happen) like a reader who reads for a while.
    await page.waitForTimeout(2500);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    const enlace = page.locator(`a.ref[data-ref="${clave}"]`).first();
    await enlace.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const medida = page.evaluate(
      (id) =>
        new Promise((resolve) => {
          let t0 = 0;
          let visible = 0;
          let estable = 0;
          let ultimo = NaN;
          document.addEventListener('click', () => (t0 = performance.now()), { capture: true, once: true });
          const paso = () => {
            if (t0) {
              const el = document.getElementById(id);
              if (el && !visible) visible = performance.now() - t0;
              if (el) {
                const barra = document.querySelector('header.barra')?.offsetHeight ?? 56;
                const top = el.getBoundingClientRect().top;
                if (Math.abs(top - (barra + 8)) < 6 && Math.abs(top - ultimo) < 1) estable++;
                else estable = 0;
                ultimo = top;
                if (estable >= 3) return resolve({ visible, colocado: performance.now() - t0 });
              }
              if (performance.now() - t0 > 30000) return resolve({ visible, colocado: NaN });
            }
            requestAnimationFrame(paso);
          };
          requestAnimationFrame(paso);
        }),
      clave,
    );
    await enlace.click();
    medidas.push(await medida);
    await ctx.close();
  }
  const mediana = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const r = {
    salto: nombre,
    visible: Math.round(mediana(medidas.map((m) => m.visible))),
    colocado: Math.round(mediana(medidas.map((m) => m.colocado))),
    todas: medidas.map((m) => Math.round(m.colocado)),
  };
  resultados.push(r);
  console.log(`${r.salto.padEnd(36)} visible ${String(r.visible).padStart(5)} ms   colocado ${String(r.colocado).padStart(5)} ms   (${r.todas.join(', ')})`);
}
await navegador.close();
