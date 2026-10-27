// Screenshots of «Un fotograma» (0.9): three steps of each console on the owner's tablet in portrait (800 × 1280)
// and phone (412 × 915), light and dark, whole page, into tests/capturas/fotograma09/ (git-ignored). Needs a server
// with the build (playwright.fotograma09.config.ts starts one on :4341):
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/fotograma09-capturas.mjs [--url http://localhost:4341/]
// The sticky step controls are laid out in place so that they show once, at the end of the page.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const i = process.argv.indexOf('--url');
const base = i > 0 ? process.argv[i + 1] : 'http://localhost:4341/';
const out = new URL('./capturas/fotograma09/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const EQUIPOS = [
  { id: 'tableta', w: 800, h: 1280 },
  { id: 'movil', w: 412, h: 915 },
];
// a step on the CPU's or the DMA's buses, the row's bytes being read, the pixel leaving for the screen
const PASOS = {
  nes: [1, 10, 14],
  neogeo: [4, 9, 13],
  sms: [4, 8, 12],
  megadrive: [4, 8, 12],
  gb: [4, 9, 13],
  gbc: [5, 9, 13],
  snes: [4, 9, 12],
};

const browser = await chromium.launch();
for (const e of EQUIPOS) {
  for (const tema of ['claro', 'oscuro']) {
    const ctx = await browser.newContext({ viewport: { width: e.w, height: e.h }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    await ctx.addInitScript((t) => localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 })), tema);
    const page = await ctx.newPage();
    for (const [m, pasos] of Object.entries(PASOS)) {
      for (const n of pasos) {
        await page.goto(`${base}#/consolas/${m}/fotograma/${n}`);
        await page.reload();
        await page.locator(`[data-fotograma="${m}"][data-paso="${n}"] h2`).waitFor();
        await page.addStyleTag({ content: '.pie-acciones { position: static !important; }' });
        // the photo and the frame tween settle
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${out}${m}-${String(n).padStart(2, '0')}-${e.id}-${tema}.png`, fullPage: true });
      }
    }
    await ctx.close();
    console.log(`${e.id}-${tema}`);
  }
}
await browser.close();
