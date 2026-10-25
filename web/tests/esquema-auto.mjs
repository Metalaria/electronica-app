// Automatic schematics of every netlist of the book (web/src/componentes/esquema-auto/): validation and
// contact sheets.
//
//   node tests/esquema-auto.mjs                      validate all netlists, print statistics
//   node tests/esquema-auto.mjs --hojas              also render contact sheets (Playwright Chromium) to
//                                                    tests/capturas/esquema-auto/hoja-NN.png
//   node tests/esquema-auto.mjs --solo cap22         only netlists whose id contains «cap22»
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers  when the browsers live there
//
// Checks for each netlist: no exception; every device of the netlist (main circuit) is drawn; every node is
// in the topology with at least one terminal; no overlapping symbols or labels; every part label at least
// HOLGURA_ETIQUETA (0,15) from any wire; the topology is consistent
// (terminal points belong to their node, wire segments join points of their node). Reports crossings, net
// labels, wire length, bends and the generation time.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const hojas = args.includes('--hojas');
const solo = args.includes('--solo') ? args[args.indexOf('--solo') + 1] : null;
const esfuerzo = args.includes('--esfuerzo') ? Number(args[args.indexOf('--esfuerzo') + 1]) : 1;
const salida = path.join(web, 'tests/capturas/esquema-auto');

const { generarEsquema, olvidarDibujos, sembrarDibujos } = await import(path.join(web, 'src/componentes/esquema-auto/generar.ts'));
// As in the app: the book's layouts come precomputed (unless --en-vivo); a second pass times the live layout.
const enVivo = args.includes('--en-vivo');
const precalculado = path.join(web, 'src/componentes/esquema-auto/precalculado.json');
if (!enVivo && fs.existsSync(precalculado)) sembrarDibujos(JSON.parse(fs.readFileSync(precalculado, 'utf8')));
const { svgEsquema } = await import(path.join(web, 'src/componentes/esquema-auto/svg.ts'));
const indice = JSON.parse(fs.readFileSync(path.join(web, 'public/libro/spice.json'), 'utf8'));

// Netlists whose schematic the book draws (the live layer shows the book's figure for them).
const conFigura = new Set();
for (const [id, n] of Object.entries(indice.netlists)) {
  for (const r of n.refs ?? []) {
    if (!r.startsWith('fig-')) continue;
    const f = path.join(web, 'public/libro/datos', `${r.slice(4)}.json`);
    if (!fs.existsSync(f)) continue;
    try {
      if (JSON.parse(fs.readFileSync(f, 'utf8')).tipo === 'esquema') conFigura.add(id);
    } catch {
      /* ignore */
    }
  }
}

const ids = Object.keys(indice.netlists).filter((id) => !solo || id.includes(solo));
const filas = [];
const fallos = [];
const svgs = [];
let tiempos = [];

// Warm-up (JIT) so that the timings below are those of a running app.
generarEsquema('* calentamiento\nV1 a 0 1\nR1 a b 1k\nC1 b 0 1n\n.end\n');

for (const id of ids) {
  const n = indice.netlists[id];
  const texto = fs.readFileSync(path.join(web, 'public/libro', n.fichero), 'utf8');
  olvidarDibujos();
  let a;
  const t0 = performance.now();
  try {
    a = generarEsquema(texto, { esfuerzo });
  } catch (e) {
    fallos.push(`${id}: excepción ${e instanceof Error ? e.stack : e}`);
    continue;
  }
  const ms = performance.now() - t0;
  if (!a) {
    fallos.push(`${id}: sin esquema (null)`);
    continue;
  }
  tiempos.push({ id, ms, u: a.estadisticas.unidades });
  const e = a.esquema;
  const c = a.circuito;
  const problemas = [];
  // Every device drawn.
  const dibujados = new Set(Object.values(a.correspondencia.elementos).map((x) => x.nombre));
  for (const d of [...c.dispositivos, ...c.fuentesRiel]) {
    if (d.simbolo === 'PUENTE') {
      for (const x of d.diodos ?? []) if (!dibujados.has(x.d.clave)) problemas.push(`falta ${x.d.nombre}`);
    } else if (d.simbolo === 'TRAFO') {
      for (const b of d.bobinas ?? []) if (!dibujados.has(b.clave)) problemas.push(`falta ${b.nombre}`);
    } else if (!dibujados.has(d.clave)) problemas.push(`falta ${d.nombre}`);
  }
  // Every node present with a terminal.
  const nodos = new Map(e.nodos.map((x) => [x.id, x]));
  const porNombre = new Map(Object.entries(a.correspondencia.nodos).map(([k, v]) => [v, k]));
  for (const nombre of c.nodos) {
    const nid = porNombre.get(nombre);
    const nd = nid ? nodos.get(nid) : null;
    if (!nd || !nd.terminales.length) problemas.push(`nodo ${nombre} sin dibujar`);
  }
  // Topology consistency.
  const puntos = new Map(e.puntos.map((p) => [p.id, p]));
  for (const el of e.elementos)
    for (const [t, nd] of Object.entries(el.terminales ?? {})) {
      const pid = el.puntos_terminal?.[t];
      const p = pid ? puntos.get(pid) : null;
      if (!p || p.nodo !== nd) problemas.push(`${el.id}.${t}: punto de otro nodo`);
      else if (Math.abs(p.xy[0] - el.anclas[t][0]) > 1e-3 || Math.abs(p.xy[1] - el.anclas[t][1]) > 1e-3) problemas.push(`${el.id}.${t}: ancla fuera de su punto`);
    }
  for (const t of e.tramos) {
    if (puntos.get(t.de)?.nodo !== t.nodo || puntos.get(t.a)?.nodo !== t.nodo) problemas.push(`${t.id}: extremos de otro nodo`);
  }
  if (a.estadisticas.solapes) problemas.push(`${a.estadisticas.solapes} solapes`);
  // Every part label keeps its distance from the wires (generar.ts HOLGURA_ETIQUETA).
  if (a.estadisticas.etiquetasPegadas) problemas.push(`${a.estadisticas.etiquetasPegadas} etiquetas pegadas a un cable (holgura ${a.estadisticas.holguraEtiquetas})`);
  if (problemas.length) fallos.push(`${id}: ${problemas.slice(0, 6).join('; ')}`);
  filas.push({ id, figura: conFigura.has(id), ...a.estadisticas, ms: Math.round(ms * 10) / 10, problemas: problemas.length });
  if (hojas) svgs.push({ id, svg: svgEsquema(a, { paleta: 'libro' }), figura: conFigura.has(id), st: a.estadisticas });
}

// ---------------------------------------------------------------- report
const suma = (k) => filas.reduce((s, f) => s + f[k], 0);
const conCruces = filas.filter((f) => f.cruces > 0);
const conEtiquetas = filas.filter((f) => f.etiquetasRed > 0);
tiempos.sort((a, b) => a.ms - b.ms);
const pct = (p) => tiempos[Math.min(tiempos.length - 1, Math.floor(p * tiempos.length))]?.ms ?? 0;
console.log(`Netlists: ${ids.length} · con esquema: ${filas.length} · fallos: ${fallos.length}`);
console.log(`Dispositivos: ${suma('dispositivos')} · componentes conexas: ${suma('componentes')} · nodos: ${suma('nodos')}`);
console.log(`Solapes: ${suma('solapes')} · cruces: ${suma('cruces')} (en ${conCruces.length} netlists) · etiquetas de red: ${suma('etiquetasRed')} (en ${conEtiquetas.length})`);
console.log(`Longitud de cable: ${suma('longitud')} · codos: ${suma('codos')}`);
console.log(`Etiquetas de pieza apartadas de los cables: ${suma('etiquetasMovidas')} (en ${filas.filter((f) => f.etiquetasMovidas).length} netlists) · holgura mínima etiqueta–cable: ${Math.min(...filas.map((f) => f.holguraEtiquetas)).toFixed(2)}`);
console.log(`Tiempo (Node, ${enVivo ? 'trazado en vivo' : 'con los trazados precalculados'}): mediana ${pct(0.5).toFixed(1)} ms · p90 ${pct(0.9).toFixed(1)} ms · máx ${pct(1).toFixed(1)} ms (${tiempos.at(-1)?.id})`);
const sinFig = filas.filter((f) => !f.figura);
console.log(`Sin figura en el libro: ${sinFig.length} · cruces ${sinFig.reduce((s, f) => s + f.cruces, 0)} · etiquetas ${sinFig.reduce((s, f) => s + f.etiquetasRed, 0)}`);
if (conCruces.length) console.log('Más cruces:', [...conCruces].sort((a, b) => b.cruces - a.cruces).slice(0, 8).map((f) => `${f.id} (${f.cruces})`).join(', '));
if (conEtiquetas.length) console.log('Más etiquetas:', [...conEtiquetas].sort((a, b) => b.etiquetasRed - a.etiquetasRed).slice(0, 8).map((f) => `${f.id} (${f.etiquetasRed})`).join(', '));
console.log('Más lentas:', tiempos.slice(-6).reverse().map((t) => `${t.id} ${t.ms.toFixed(0)} ms (${t.u} u.)`).join(', '));
if (!enVivo) {
  // Live layout (an edited netlist): structures not precomputed.
  olvidarDibujos(true);
  const vivos = [];
  for (const id of ids) {
    const texto = fs.readFileSync(path.join(web, 'public/libro', indice.netlists[id].fichero), 'utf8');
    olvidarDibujos();
    const t0 = performance.now();
    try {
      generarEsquema(texto, { esfuerzo });
    } catch {
      continue;
    }
    vivos.push(performance.now() - t0);
  }
  vivos.sort((a, b) => a - b);
  const q = (p) => vivos[Math.min(vivos.length - 1, Math.floor(p * vivos.length))] ?? 0;
  console.log(`Tiempo (Node, trazado en vivo, p. ej. netlist editada): mediana ${q(0.5).toFixed(1)} ms · p90 ${q(0.9).toFixed(1)} ms · máx ${q(1).toFixed(1)} ms`);
}
for (const f of fallos) console.log('FALLO', f);
fs.mkdirSync(salida, { recursive: true });
fs.writeFileSync(path.join(salida, 'estadisticas.json'), JSON.stringify(filas, null, 1));

// ---------------------------------------------------------------- contact sheets
if (hojas) {
  const { chromium } = await import('@playwright/test');
  const fuente = path.join(web, 'node_modules/@fontsource/source-sans-3/files/');
  const ff = (f, r) =>
    `@font-face{font-family:'Source Sans 3';src:url(data:font/woff2;base64,${fs.readFileSync(fuente + f).toString('base64')}) format('woff2');unicode-range:${r}}`;
  const css =
    ff('source-sans-3-latin-400-normal.woff2', 'U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+2212') + ff('source-sans-3-greek-400-normal.woff2', 'U+0370-03FF');
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 1 });
  const POR_HOJA = 16;
  for (const f of fs.readdirSync(salida)) if (/^hoja-\d+\.png$/.test(f)) fs.unlinkSync(path.join(salida, f));
  for (let h = 0; h * POR_HOJA < svgs.length; h++) {
    const grupo = svgs.slice(h * POR_HOJA, (h + 1) * POR_HOJA);
    const celdas = grupo
      .map(
        (s) =>
          `<div class="c${s.figura ? ' fig' : ''}"><div class="t">${s.id}${s.figura ? ' · (figura del libro)' : ''} · ${s.st.dispositivos} disp. · ${s.st.cruces} cruces · ${s.st.etiquetasRed} etiq.</div><div class="d">${s.svg}</div></div>`,
      )
      .join('');
    await pagina.setContent(
      `<style>${css} body{margin:0;background:#d9d9d9;font-family:'Source Sans 3';display:flex;flex-wrap:wrap;align-items:flex-start;width:1800px}
      .c{margin:5px;background:#fff;border:1px solid #999;max-width:880px}
      .c.fig{border-color:#b9770e}
      .t{font:12px/1.3 sans-serif;background:#eee;padding:2px 5px;color:#333}
      .d{padding:4px;overflow:hidden} .d svg{display:block;max-width:870px;height:auto}</style>${celdas}`,
    );
    await pagina.waitForTimeout(150);
    const nombre = path.join(salida, `hoja-${String(h + 1).padStart(2, '0')}.png`);
    await pagina.screenshot({ path: nombre, fullPage: true });
  }
  await navegador.close();
  console.log(`Hojas de contactos: ${Math.ceil(svgs.length / POR_HOJA)} en ${salida}`);
}
process.exit(fallos.length ? 1 : 0);
