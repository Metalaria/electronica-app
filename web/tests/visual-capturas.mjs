// Screenshots of the 0.8 visual improvements (start page map, reference previews, glossary pictures) on the
// owner's devices, light and dark: tests/capturas/visual/ (git-ignored). Needs a server with the build:
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/visual-capturas.mjs [--url http://localhost:4271/]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const i = process.argv.indexOf('--url');
const base = i > 0 ? process.argv[i + 1] : 'http://localhost:4271/';
const out = new URL('./capturas/visual/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const EQUIPOS = [
  { id: 'mac', w: 1280, h: 800, dpr: 2, tactil: false },
  { id: 'tableta', w: 800, h: 1100, dpr: 2, tactil: true },
  { id: 'movil', w: 412, h: 915, dpr: 2, tactil: true },
];

const browser = await chromium.launch();
for (const e of EQUIPOS) {
  for (const tema of ['claro', 'oscuro']) {
    const ctx = await browser.newContext({ viewport: { width: e.w, height: e.h }, deviceScaleFactor: e.dpr, hasTouch: e.tactil, isMobile: e.tactil });
    await ctx.addInitScript((t) => {
      const now = Date.now();
      localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 }));
      const leidas = { cap05: {}, cap01: {}, cap02: {}, cap26: {} };
      for (let k = 1; k <= 4; k++) leidas.cap05[`sec-5.${k}`] = now - k;
      for (let k = 1; k <= 14; k++) leidas.cap01[`sec-1.${k}`] = now - k;
      for (let k = 1; k <= 7; k++) leidas.cap02[`sec-2.${k}`] = now - k;
      leidas.cap26['sec-26.1'] = now;
      localStorage.setItem('epa:leidas', JSON.stringify(leidas));
      localStorage.setItem('epa:posiciones', JSON.stringify({ cap05: { b: 60, sec: 'sec-5.4', f: 0.3, t: now - 3600e3 }, cap02: { b: 3, sec: 'sec-2.1', f: 0.05, t: now - 86400e3 } }));
    }, tema);
    const page = await ctx.newPage();
    const n = `${e.id}-${tema}`;
    // start page
    await page.goto(base + '#/');
    await page.waitForSelector('.mapa .tesela');
    await page.waitForSelector('.repaso-hoy .cifra[data-pendientes]');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}${n}-inicio.png` });
    await page.locator('section.mapa').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}${n}-inicio-mapa.png` });
    // previews: figure, section
    for (const [ruta, clave, nombre] of [
      ['#/00_preliminares', 'fig-0.1', 'figura'],
      ['#/00_preliminares', 'tab-0.1', 'tabla'],
      ['#/cap05/sec-5.1', 'sec-5.2', 'seccion'],
    ]) {
      await page.goto(base + ruta);
      const a = page.locator(`a.ref[data-ref="${clave}"]`).first();
      await a.scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);
      await a.scrollIntoViewIfNeeded();
      if (e.tactil) await a.tap();
      else await a.hover();
      await page.waitForSelector('.vista-previa.colocada');
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${out}${n}-vista-${nombre}.png` });
      await page.keyboard.press('Escape');
    }
    // glossary
    await page.goto(base + '#/glosario/glos-condensador');
    await page.waitForSelector('#glos-condensador .simbolo svg');
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${out}${n}-glosario.png` });
    await ctx.close();
    console.log('ok', n);
  }
}
await browser.close();
