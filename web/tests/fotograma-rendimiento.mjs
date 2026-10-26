// Cost of an animation frame of «Un fotograma» while playing (state of the player + every canvas: screen, timeline,
// journey on the board / photo / schematic): node tests/fotograma-rendimiento.mjs --url http://localhost:4231/
// [--lento 4] (CPU throttling factor of Chromium, to imitate a slower device). Prints median and 95th percentile.
import { chromium } from '@playwright/test';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const url = arg('url', 'http://localhost:4231/');
const lento = Number(arg('lento', '1'));
const CASOS = [
  ['nes', 'Placa'],
  ['nes', 'Esquema'],
  ['gb', 'Cobre (foto)'],
  ['gbc', 'Placa'],
];
const b = await chromium.launch();
for (const [m, vista] of CASOS) {
  for (const nivel of ['Cuadro entero', 'Una línea']) {
    const p = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const cdp = await p.context().newCDPSession(p);
    await p.goto(`${url}#/consolas/${m}/fotograma`);
    await p.waitForFunction(() => !!globalThis.__epaFotograma, null, { timeout: 60000 });
    await p.getByRole('tab', { name: vista, exact: true }).click();
    await p.waitForTimeout(2500);
    if (lento > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: lento });
    await p.getByRole('button', { name: nivel }).click();
    await p.evaluate(() => {
      globalThis.__epaFotogramaMs = [];
      globalThis.__epaFotogramaPlacaMs = [];
      // wall-clock interval between animation frames
      globalThis.__epaIntervalos = [];
      let u = 0;
      const f = (t) => {
        if (u) globalThis.__epaIntervalos.push(t - u);
        u = t;
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    await p.getByRole('button', { name: 'Reproducir' }).click();
    await p.waitForTimeout(5000);
    const orden = (a) => (a ?? []).slice(5).sort((x, y) => x - y);
    const q = (a, f) => (a.length ? a[Math.min(a.length - 1, Math.floor(a.length * f))].toFixed(1) : '–');
    const ms = orden(await p.evaluate(() => globalThis.__epaFotogramaMs));
    const placa = orden(await p.evaluate(() => globalThis.__epaFotogramaPlacaMs));
    const iv = orden(await p.evaluate(() => globalThis.__epaIntervalos));
    console.log(`${m.padEnd(4)} ${vista.padEnd(13)} ${nivel.padEnd(14)} estado+lienzos ${q(ms, 0.5)}/${q(ms, 0.95)} ms · placa o foto ${q(placa, 0.5)}/${q(placa, 0.95)} ms · intervalo ${q(iv, 0.5)}/${q(iv, 0.95)} ms (mediana/p95)`);
    await p.close();
  }
}
await b.close();
