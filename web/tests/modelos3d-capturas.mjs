#!/usr/bin/env node
// Screenshots of the 3D component models (serve a build first):
//
//   npm run build && npx vite preview --port 4173      (in another terminal)
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/modelos3d-capturas.mjs [--url http://localhost:4173]
//       [--solo tipo1,tipo2] [--hoja] [--paginas] [--salida tests/capturas/modelos3d]
//
//   --hoja      contact sheet of every model (one tile each, default parameters, light theme) plus a second
//               sheet with the cutaway or the explosion of the models that have an inside.
//   --paginas   the catalogue, a model page and a scene page in 3D on the phone, the 13" Mac (1280 × 800 at 2×)
//               and the tablet in portrait, light and dark.
//   --modelo t  one model page with ?corte=… (quick look while iterating).
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = opt('--url', 'http://localhost:4173');
const SALIDA = opt('--salida', new URL('./capturas/modelos3d/', import.meta.url).pathname);
mkdirSync(SALIDA, { recursive: true });

const fuente = readFileSync(new URL('../src/componentes/tres/modelos/paquetes.ts', import.meta.url), 'utf8');
let tipos = [...fuente.matchAll(/^\s+tipo: '([a-z0-9-]+)',$/gm)].map((m) => m[1]);
const solo = opt('--solo', '');
if (solo) tipos = tipos.filter((t) => solo.split(',').includes(t));

const navegador = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function preparar(ctx, tema = 'claro') {
  await ctx.addInitScript((t) => {
    localStorage.setItem('epa:componentes-vista', JSON.stringify('3d'));
    localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 }));
  }, tema);
}

async function esperarModelo(page, tipo) {
  await page.waitForFunction((t) => globalThis.__epaVisor3d?.datos && (!t || globalThis.__epaVisor3d.datos.tipo === t), tipo ?? '', { timeout: 30000 });
  await page.waitForTimeout(400);
}

async function deslizar(page, sel, v) {
  await page.$eval(sel, (el, x) => {
    el.value = String(x);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
}

if (args.includes('--hoja')) {
  const ctx = await navegador.newContext({ viewport: { width: 900, height: 760 }, deviceScaleFactor: 1 });
  await preparar(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('error:', e.message));
  await page.goto(`${BASE}/#/componentes/3d/${tipos[0]}`);
  const tiles = [];
  let cuenta = 0;
  for (const modo of ['normal', 'interior']) {
    for (const t of tipos) {
      // Same page, new hash: the app swaps the model without reloading (a fresh page now and then, and a
      // retry with a reload if SwiftShader falls behind).
      if (++cuenta % 12 === 0) await page.reload();
      await page.evaluate((x) => (location.hash = `#/componentes/3d/${x}`), t);
      try {
        await esperarModelo(page, t);
      } catch {
        await page.goto(`${BASE}/#/componentes/3d/${t}`);
        await page.reload();
        await esperarModelo(page, t);
      }
      const d = await page.evaluate(() => {
        const v = globalThis.__epaVisor3d;
        return { cortes: v.datos.cortes?.length ?? 0, explosion: !!v.datos.explosionable, tri: v.datos.triangulos, marcado: v.datos.marcado ?? '' };
      });
      if (modo === 'interior') {
        if (d.cortes) await page.click('[data-control="corte"]');
        else if (d.explosion) {
          await deslizar(page, '[data-control="explosion"]', 1);
          await page.waitForTimeout(900);
        } else continue;
        await page.waitForTimeout(700);
      }
      const el = await page.$('.visor3d .lienzo');
      const png = await el.screenshot();
      tiles.push({ t, modo, png: png.toString('base64'), ...d });
      process.stdout.write(modo === 'normal' ? '·' : '+');
    }
  }
  console.log('');
  for (const modo of ['normal', 'interior']) {
    const lista = tiles.filter((x) => x.modo === modo);
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#fff;font:13px 'Source Sans 3',sans-serif}
      .g{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:6px}.c{border:1px solid #ddd;border-radius:6px;overflow:hidden}
      img{display:block;width:100%}p{margin:2px 6px 4px;color:#333}</style><div class="g">${lista
        .map((x) => `<div class="c"><img src="data:image/png;base64,${x.png}"><p><b>${x.t}</b> · ${x.tri} tri ${x.marcado ? '· ' + x.marcado : ''}</p></div>`)
        .join('')}</div>`;
    const hp = await ctx.newPage();
    await hp.setViewportSize({ width: 2400, height: 800 });
    await hp.setContent(html);
    await hp.waitForTimeout(300);
    await hp.screenshot({ path: `${SALIDA}hoja-${modo}.png`, fullPage: true });
    await hp.close();
    console.log(`${SALIDA}hoja-${modo}.png (${lista.length} modelos)`);
  }
  await ctx.close();
}

const PERFILES = {
  movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
  mac: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
  'tableta-vertical': { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

if (args.includes('--paginas')) {
  for (const [nombre, perfil] of Object.entries(PERFILES)) {
    for (const tema of ['claro', 'oscuro']) {
      const ctx = await navegador.newContext(perfil);
      await preparar(ctx, tema);
      const page = await ctx.newPage();
      await page.goto(`${BASE}/#/componentes`);
      await page.waitForSelector('.catalogo3d .tarjeta img', { timeout: 60000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${SALIDA}catalogo-${nombre}-${tema}.png` });
      await page.goto(`${BASE}/#/componentes/3d/electrolitico`);
      await esperarModelo(page);
      await page.click('[data-control="corte"]');
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${SALIDA}modelo-${nombre}-${tema}.png` });
      await page.goto(`${BASE}/#/componentes/codigo-colores`);
      await esperarModelo(page);
      await page.screenshot({ path: `${SALIDA}escena-${nombre}-${tema}.png` });
      await ctx.close();
      console.log(`${nombre} ${tema}`);
    }
  }
}

const uno = opt('--modelo', '');
if (uno) {
  const [t, q] = uno.split('?');
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  await preparar(ctx, opt('--tema', 'claro'));
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && console.log('consola:', m.text()));
  page.on('pageerror', (e) => console.log('error:', e.message));
  await page.goto(`${BASE}/#/componentes/3d/${t}${q ? '?' + q : ''}`);
  await esperarModelo(page);
  if (args.includes('--corte')) await page.click('[data-control="corte"]');
  if (args.includes('--explosion')) {
    await deslizar(page, '[data-control="explosion"]', 1);
    await page.waitForTimeout(900);
  }
  const az = opt('--azimut', '');
  if (az) await page.evaluate((a) => globalThis.__epaVisor3d.visor.girar?.(Number(a)), az);
  await page.waitForTimeout(500);
  const el = await page.$('.visor3d .lienzo');
  await el.screenshot({ path: `${SALIDA}uno-${t}.png` });
  console.log(`${SALIDA}uno-${t}.png`);
  await ctx.close();
}
await navegador.close();
