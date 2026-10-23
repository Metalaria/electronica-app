#!/usr/bin/env node
// Screenshots of the calculators' illustrations: one formula per schematic template and per plot kind (or the
// formulas given), on the three target screens, light and dark, plus a contact sheet per screen and theme.
// Serve the app first:
//
//   npx vite build --outDir <dir> && npx vite preview --outDir <dir> --port 4183      (in another terminal)
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/calculadoras-capturas.mjs [--url http://localhost:4183]
//       [--solo id1,id2] [--perfil movil|mac|tableta-vertical] [--tema claro|oscuro] [--pagina]
//
// Output: tests/capturas/calculadoras/<perfil>-<tema>/<id>.png (the drawing and controls; with --pagina, the
// whole page) and tests/capturas/calculadoras/hoja-<perfil>-<tema>.png. Reports page errors and illustration
// slots that did not render.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = opt('--url', 'http://localhost:4183');
const cat = JSON.parse(readFileSync(new URL('../public/libro/formulas.json', import.meta.url), 'utf8'));

// one formula per template and per plot kind (the first in book order)
const vistos = new Set();
let ids = [];
for (const f of cat.formulas) {
  const k1 = f.figura?.esquema ? `e:${f.figura.esquema.p}` : null;
  const k2 = f.figura?.grafico ? `g:${f.figura.grafico.p}` : null;
  if ((k1 && !vistos.has(k1)) || (k2 && !vistos.has(k2))) {
    ids.push(f.id);
    if (k1) vistos.add(k1);
    if (k2) vistos.add(k2);
  }
}
const solo = opt('--solo', '');
if (solo) ids = solo.split(',');

const PERFILES = {
  movil: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  mac: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
  'tableta-vertical': { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const perfiles = opt('--perfil', '') ? [opt('--perfil', '')] : Object.keys(PERFILES);
const temas = opt('--tema', '') ? [opt('--tema', '')] : ['claro', 'oscuro'];
const pagina = args.includes('--pagina');
const SALIDA = new URL('capturas/calculadoras/', import.meta.url);

const navegador = await chromium.launch();
for (const perfil of perfiles)
  for (const tema of temas) {
    const dir = new URL(`${perfil}-${tema}/`, SALIDA);
    mkdirSync(dir, { recursive: true });
    const ctx = await navegador.newContext({ ...PERFILES[perfil], colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
    await ctx.addInitScript((t) => localStorage.setItem('epa:prefs', JSON.stringify({ tema: t, tam: 18 })), tema);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`ERROR ${perfil} ${tema}:`, e.message));
    const ficheros = [];
    for (const id of ids) {
      await page.goto(`${BASE}/#/calculadoras/${id}`);
      const calc = page.locator('.calculadora');
      await calc.locator('.visual svg').first().waitFor({ timeout: 20_000 }).catch(() => console.log(`SIN DIBUJO ${id}`));
      const f = cat.formulas.find((x) => x.id === id);
      const huecos = Object.keys(f?.figura?.esquema?.s ?? {}).length;
      const etiquetas = await calc.locator('.esquema-calc .etiqueta:not(.tenue)').count();
      if (huecos && etiquetas < 1) console.log(`ETIQUETAS ${id}: ${etiquetas} de ${huecos}`);
      await page.waitForTimeout(250);
      const ruta = new URL(`${id}.png`, dir).pathname;
      if (pagina) await page.screenshot({ path: ruta, fullPage: true });
      else await calc.locator('.cuerpo-calc').screenshot({ path: ruta });
      ficheros.push(ruta);
    }
    await ctx.close();
    if (!pagina && ficheros.length > 1) {
      const hoja = new URL(`hoja-${perfil}-${tema}.png`, SALIDA).pathname;
      execFileSync('python3', ['-c', `
import sys
from PIL import Image
fs = sys.argv[2:]
ims = [Image.open(f) for f in fs]
w = 760
col = 3
ims = [im.resize((w, int(im.height * w / im.width))) for im in ims]
filas = [ims[i:i + col] for i in range(0, len(ims), col)]
alto = sum(max(i.height for i in fila) for fila in filas)
hoja = Image.new('RGB', (w * col, alto), 'white')
y = 0
for fila in filas:
    for k, im in enumerate(fila):
        hoja.paste(im, (k * w, y))
    y += max(i.height for i in fila)
hoja.save(sys.argv[1])
`, hoja, ...ficheros]);
      console.log(hoja);
    }
  }
await navegador.close();
