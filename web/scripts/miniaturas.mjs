#!/usr/bin/env node
// Pre-renders the thumbnails of the app's lists into web/public/miniaturas/ (versioned, like public/libro):
//   esquemas/<parte>.json  automatic schematic of every book netlist as four compact paths (no text), drawn
//                          inline by componentes/miniaturas (themed, ≈ 10 kB per chapter);
//   fig/<n>.webp, img/<n>.webp
//                          the book figure that a search result (a section: its first figure) or an exercise
//                          (a figure inside it or the first one it links to) refers to, ≤ 192 × 144 px with a
//                          transparent background (shown on the figure plate of each theme);
//   indice.json            { version, w, h, figuras: { section id or exercise label → "fig/<n>" } };
//   3d/<tipo>.webp         every model of the 3D catalogue at its defaults, 384 × 288 px, transparent
//                          background (the card's studio colour shows through, one image for all themes).
//
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/miniaturas.mjs [--esquemas] [--figuras] [--modelos]
//       [--forzar] [--solo tipo1,tipo2]
// Without a part flag it does all three. Figure thumbnails are made again only for new figures or figures
// newer than their thumbnail; model images that exist are kept: --forzar redoes everything (after changing
// the thumbnails' look, or the models). Run it after contenido/generar.py (figures),
// contenido/spice.py or scripts/esquema-auto-precalcular.mjs (netlists, layouts) and after changing
// componentes/tres/modelos. Schematics need only Node; figures and models need Playwright's Chromium (the
// models also start a Vite dev server to import them, as tests/modelos3d-auditoria.mjs does).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libro = path.join(web, 'public/libro');
const destino = path.join(web, 'public/miniaturas');
const args = process.argv.slice(2);
const forzar = args.includes('--forzar');
const solo = args.includes('--solo') ? args[args.indexOf('--solo') + 1].split(',') : null;
const partes = ['--esquemas', '--figuras', '--modelos'].filter((a) => args.includes(a));
const hacer = (k) => !partes.length || partes.includes(k);

const FIG_W = 192;
const FIG_H = 144;
const M3D_W = 384;
const M3D_H = 288;

const leer = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const kB = (n) => `${(n / 1024).toFixed(0)} kB`;
function tamDir(d) {
  let t = 0;
  if (!fs.existsSync(d)) return 0;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) t += e.isDirectory() ? tamDir(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size;
  return t;
}

// ------------------------------------------------------------------------------------------------ schematics
async function esquemas() {
  const t0 = performance.now();
  const { generarEsquema, sembrarDibujos } = await import(path.join(web, 'src/componentes/esquema-auto/generar.ts'));
  const { trazosMiniatura } = await import(path.join(web, 'src/componentes/esquema-auto/miniatura.ts'));
  sembrarDibujos(leer(path.join(web, 'src/componentes/esquema-auto/precalculado.json')));
  const indice = leer(path.join(libro, 'spice.json'));
  const porParte = {};
  let n = 0;
  const fallos = [];
  for (const [id, nl] of Object.entries(indice.netlists)) {
    const texto = fs.readFileSync(path.join(libro, nl.fichero), 'utf8');
    // Same sheet aspect as the app's worker (esquema-auto/trabajador.ts), so the precomputed layouts apply.
    const a = generarEsquema(texto, { aspecto: 1.8 });
    if (!a) {
      fallos.push(id);
      continue;
    }
    (porParte[nl.parte] ??= {})[nl.nombre] = trazosMiniatura(a);
    n++;
  }
  const dir = path.join(destino, 'esquemas');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const [parte, d] of Object.entries(porParte)) fs.writeFileSync(path.join(dir, `${parte}.json`), JSON.stringify({ version: 1, esquemas: d }));
  console.log(`esquemas: ${n} netlists en ${Object.keys(porParte).length} ficheros, ${kB(tamDir(dir))}, ${((performance.now() - t0) / 1000).toFixed(1)} s${fallos.length ? `; sin dibujo: ${fallos.join(', ')}` : ''}`);
}

// ------------------------------------------------------------------------------------------------ figures
const CONTENEDORES = new Set(['caja', 'deduccion', 'tarjeta']);
function primeraFigura(bs) {
  for (const b of bs) {
    if (b.t === 'figura') return b;
    if (CONTENEDORES.has(b.t)) {
      const f = primeraFigura(b.bloques);
      if (f) return f;
    }
  }
  return null;
}

/** Which figure each search document (h2 section) and each exercise refers to: label → figure src. */
function indiceFiguras() {
  const figuras = new Map(); // label → figure block
  const porSrc = new Map(); // src → figure block
  const res = {};
  const cache = new Map();
  const parte = (stem) => {
    if (!cache.has(stem)) cache.set(stem, leer(path.join(libro, 'partes', `${stem}.json`)));
    return cache.get(stem);
  };
  for (const f of fs.readdirSync(path.join(libro, 'partes'))) {
    const p = parte(f.replace(/\.json$/, ''));
    const rec = (bs) => {
      for (const b of bs) {
        if (b.t === 'figura') {
          if (b.label) figuras.set(b.label, b);
          porSrc.set(b.src, b);
        }
        if (CONTENEDORES.has(b.t)) rec(b.bloques);
        if (b.t === 'ejercicios') for (const it of b.items) rec(it.bloques);
      }
    };
    rec(p.bloques);
  }
  // Sections (the documents of busqueda.json): the first figure up to the next h2, as the reference preview.
  const docs = new Set(leer(path.join(libro, 'busqueda.json')).map((d) => d.id));
  for (const f of fs.readdirSync(path.join(libro, 'partes'))) {
    const bs = parte(f.replace(/\.json$/, '')).bloques;
    bs.forEach((b, i) => {
      if (b.t !== 'h2' || !b.label || !docs.has(b.label)) return;
      let j = i + 1;
      while (j < bs.length && bs[j].t !== 'h2') j++;
      const fig = primeraFigura(bs.slice(i + 1, j));
      if (fig) res[b.label] = fig.src;
    });
  }
  // Exercises and problems: a figure inside the statement, else the first figure it links to.
  const ejercicios = fs.existsSync(path.join(libro, 'ejercicios.json')) ? leer(path.join(libro, 'ejercicios.json')).items : {};
  for (const [label, it] of Object.entries(ejercicios)) {
    const bs = parte(it.parte).bloques;
    const enunciado = it.tipo === 'ej' ? bs[it.pos[0]]?.items?.[it.pos[1]]?.bloques ?? [] : bs.slice(it.pos[0] + 1, it.pos[2]);
    const fig = primeraFigura(enunciado) ?? figuras.get(/data-ref="(fig-[^"]+)"/.exec(JSON.stringify(enunciado).replace(/\\"/g, '"'))?.[1] ?? '');
    if (fig) res[label] = fig.src;
  }
  return { res, porSrc };
}

const sinExt = (src) => src.replace(/\.[a-z0-9]+$/i, '');

async function figuras() {
  const t0 = performance.now();
  const { res } = indiceFiguras();
  const figurasUsadas = [...new Set(Object.values(res))];
  const indice = { version: 1, w: FIG_W, h: FIG_H, figuras: Object.fromEntries(Object.entries(res).map(([k, v]) => [k, sinExt(v)])) };
  fs.mkdirSync(destino, { recursive: true });
  fs.writeFileSync(path.join(destino, 'indice.json'), JSON.stringify(indice));
  // Thumbnails no longer referenced go away.
  const quedan = new Set(figurasUsadas.map((s) => `${sinExt(s)}.webp`));
  for (const sub of ['fig', 'img']) {
    const d = path.join(destino, sub);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) if (!quedan.has(`${sub}/${f}`)) fs.rmSync(path.join(d, f));
  }
  // New figures, and figures changed since their thumbnail was made.
  const pendientes = figurasUsadas.filter((s) => {
    const f = path.join(destino, `${sinExt(s)}.webp`);
    return forzar || !fs.existsSync(f) || fs.statSync(path.join(libro, s)).mtimeMs > fs.statSync(f).mtimeMs;
  });
  if (pendientes.length) {
    const { chromium } = await import('@playwright/test');
    const navegador = await chromium.launch();
    const pagina = await navegador.newPage();
    // A made-up origin serves public/libro, so the canvas is not tainted and nothing listens on a port.
    const ORIGEN = 'http://miniaturas.local/';
    await pagina.route(`${ORIGEN}**`, (ruta) => {
      const rel = decodeURIComponent(new URL(ruta.request().url()).pathname.slice(1));
      const f = path.join(libro, rel);
      if (!rel || !f.startsWith(libro) || !fs.existsSync(f)) return ruta.fulfill({ status: rel ? 404 : 200, contentType: 'text/html', body: '' });
      const tipo = f.endsWith('.svg') ? 'image/svg+xml' : f.endsWith('.png') ? 'image/png' : 'image/jpeg';
      return ruta.fulfill({ status: 200, contentType: tipo, body: fs.readFileSync(f) });
    });
    await pagina.goto(ORIGEN);
    let hechas = 0;
    for (const src of pendientes) {
      const datos = await pagina.evaluate(
        async ({ src, W, H }) => {
          const img = new Image();
          img.src = src;
          await img.decode();
          const iw = img.naturalWidth || W;
          const ih = img.naturalHeight || H;
          const k = Math.min(W / iw, H / ih);
          const w = Math.max(1, Math.round(iw * k));
          const h = Math.max(1, Math.round(ih * k));
          // Drawn at 2× and halved: thin lines keep more contrast than a direct small rasterisation.
          const c2 = document.createElement('canvas');
          c2.width = w * 2;
          c2.height = h * 2;
          const g2 = c2.getContext('2d');
          g2.imageSmoothingQuality = 'high';
          g2.drawImage(img, 0, 0, w * 2, h * 2);
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const g = c.getContext('2d');
          g.imageSmoothingQuality = 'high';
          g.drawImage(c2, 0, 0, w, h);
          return c.toDataURL('image/webp', 0.8);
        },
        { src: ORIGEN + src, W: FIG_W, H: FIG_H },
      );
      const salida = path.join(destino, `${sinExt(src)}.webp`);
      fs.mkdirSync(path.dirname(salida), { recursive: true });
      fs.writeFileSync(salida, Buffer.from(datos.split(',')[1], 'base64'));
      if (++hechas % 100 === 0) console.log(`  ${hechas}/${pendientes.length}`);
    }
    await navegador.close();
  }
  const tam = tamDir(path.join(destino, 'fig')) + tamDir(path.join(destino, 'img'));
  console.log(`figuras: ${Object.keys(res).length} entradas, ${figurasUsadas.length} miniaturas (${pendientes.length} nuevas), ${kB(tam)}, ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}

// ------------------------------------------------------------------------------------------------ 3D models
async function modelos() {
  const t0 = performance.now();
  const { createServer } = await import('vite');
  const { chromium } = await import('@playwright/test');
  const servidor = await createServer({ root: web, configFile: path.join(web, 'vite.config.ts'), server: { port: 0, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
  await servidor.listen();
  const dir = servidor.resolvedUrls?.local?.[0] ?? `http://127.0.0.1:${servidor.config.server.port}/`;
  const navegador = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pagina = await navegador.newPage();
  await pagina.goto(dir + 'index.html').catch(() => {});
  const salida = path.join(destino, '3d');
  fs.mkdirSync(salida, { recursive: true });
  const modelosCat = await pagina.evaluate(async () => {
    const { MODELOS_3D } = await import('/src/componentes/tres/catalogo3d.ts');
    return MODELOS_3D.map((m) => ({ tipo: m.tipo, defecto: m.defecto, montaje: m.montaje }));
  });
  const tipos = new Set(modelosCat.map((m) => m.tipo));
  for (const f of fs.readdirSync(salida)) if (!tipos.has(f.replace(/\.webp$/, ''))) fs.rmSync(path.join(salida, f));
  let hechas = 0;
  for (const m of modelosCat) {
    if (solo && !solo.includes(m.tipo)) continue;
    const f = path.join(salida, `${m.tipo}.webp`);
    if (!forzar && fs.existsSync(f)) continue;
    const datos = await pagina.evaluate(async (m) => {
      const { miniatura } = await import('/src/componentes/tres/miniaturas.ts');
      const url = await miniatura(m.tipo, m.defecto, m.montaje, null, false);
      const b = await (await fetch(url)).blob();
      return await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(b);
      });
    }, m);
    if (!datos.startsWith('data:image/webp')) throw new Error(`${m.tipo}: el navegador no codificó WebP`);
    fs.writeFileSync(f, Buffer.from(datos.split(',')[1], 'base64'));
    hechas++;
  }
  await navegador.close();
  await servidor.close();
  console.log(`modelos 3D: ${modelosCat.length} (${hechas} nuevos), ${M3D_W} × ${M3D_H}, ${kB(tamDir(salida))}, ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}

if (hacer('--esquemas')) await esquemas();
if (hacer('--figuras')) await figuras();
if (hacer('--modelos')) await modelos();
console.log(`total public/miniaturas: ${kB(tamDir(destino))}`);
