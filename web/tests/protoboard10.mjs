// Auto-placement of every circuit that gets «Ver en protoboard» (componentes/protoboard/), in Node:
// the 313 book netlists (as the simulator and the editor open them) and the simulable schematics of the
// book's figures. For each: placed without an exception (or a clear Spanish message), every original net
// one net of the board and no two joined, every leg in a hole, one lead per hole, no overlapping bodies,
// and the board's netlist written without errors.
//
//   node tests/protoboard10.mjs [--solo texto] [--detalle] [--json fichero]
//   node tests/protoboard10.mjs --escribir dir           writes the board's netlists and the originals; then
//     node scripts/validar-spice.mjs --dir dir/original --salida dir/original.json  (and dir/montaje)
//     node tests/protoboard10-medidas.mjs dir           compares their measurements

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const solo = args.includes('--solo') ? args[args.indexOf('--solo') + 1] : null;
const detalle = args.includes('--detalle');
const salidaJson = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

const src = (p) => path.join(web, 'src/componentes', p);
const { sembrarDibujos } = await import(src('esquema-auto/generar.ts'));
const { editableDeNetlist } = await import(src('esquema-auto/editable.ts'));
const { circuitoDeEditable, circuitoDeEsquema } = await import(src('protoboard/fuentes.ts'));
const { colocarCircuito } = await import(src('protoboard/colocacion.ts'));
const { verificarMontaje } = await import(src('protoboard/verificar.ts'));
const { netlistProtoboard } = await import(src('protoboard/conexiones.ts'));
const pre = path.join(web, 'src/componentes/esquema-auto/precalculado.json');
if (fs.existsSync(pre)) sembrarDibujos(JSON.parse(fs.readFileSync(pre, 'utf8')));

const indice = JSON.parse(fs.readFileSync(path.join(web, 'public/libro/spice.json'), 'utf8'));
const resultados = [];
let fallos = 0;
let ms = 0;

function registrar(tipo, id, fn) {
  if (solo && !id.includes(solo)) return;
  const t0 = performance.now();
  const r = { tipo, id };
  try {
    const { doc, notas } = fn();
    r.ms = performance.now() - t0;
    r.placas = doc.placas;
    r.columnas = doc.columnas;
    r.piezas = doc.piezas.length;
    r.cables = doc.cables.length;
    r.chips = doc.piezas.filter((p) => p.chip).map((p) => p.comp.campos.modelo);
    r.notas = notas;
    r.problemas = verificarMontaje(doc);
    const nl = netlistProtoboard(doc);
    r.errores = nl.errores.map((e) => e.texto);
    r.doc = doc;
    r.netlist = nl.texto;
    if (r.problemas.length) fallos++;
  } catch (e) {
    r.ms = performance.now() - t0;
    r.error = e instanceof Error ? e.message : String(e);
    if (!(e instanceof Error) || /^[A-Z]/.test(e.message) === false || !/[áéíóúñ]|placa|protoboard|montar/.test(e.message)) r.inesperado = true;
    fallos++;
  }
  ms += r.ms;
  resultados.push(r);
  if (detalle || r.error || r.problemas?.length)
    console.log(`${r.error ? 'ERROR' : r.problemas?.length ? 'MAL  ' : 'ok   '} ${id} ${r.error ?? ''}${r.problemas?.length ? r.problemas.slice(0, 6).join(' · ') : ''} (${r.ms.toFixed(0)} ms${r.placas ? `, ${r.placas}×${r.columnas}` : ''})`);
}

// Book netlists (simulator pages, editor «libro» drawings).
for (const [id, n] of Object.entries(indice.netlists)) {
  const texto = fs.readFileSync(path.join(web, 'public/libro', n.fichero), 'utf8');
  registrar('netlist', id, () => {
    const e = editableDeNetlist(texto);
    if (!e) throw new Error('Esta netlist no tiene componentes que se puedan montar en una protoboard.');
    return colocarCircuito(circuitoDeEditable(texto, e, { tipo: 'libro', id }, n.refs ?? []));
  });
}

// Figures with a simulable schematic.
const dirDatos = path.join(web, 'public/libro/datos');
let figurasEsquema = 0;
let esquemasSinCircuito = 0;
for (const f of fs.readdirSync(dirDatos).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(dirDatos, f), 'utf8'));
  if (d.tipo !== 'esquema') continue;
  figurasEsquema++;
  (d.esquemas ?? []).forEach((esq, i) => {
    if (!esq.simulacion?.simulable) {
      esquemasSinCircuito++;
      return;
    }
    const nombre = f.replace(/\.json$/, '');
    registrar('figura', `fig-${nombre}#${i}`, () => colocarCircuito(circuitoDeEsquema(esq, `Figura ${nombre}`, `fig-${nombre}`)));
  });
}

const n = (t) => resultados.filter((r) => r.tipo === t);
const resumen = (t) => {
  const l = n(t);
  return `${l.length} (${l.filter((r) => !r.error && !r.problemas?.length).length} bien, ${l.filter((r) => r.error).length} con mensaje, ${l.filter((r) => r.problemas?.length).length} con problemas)`;
};
console.log(`\nNetlists del libro: ${resumen('netlist')}`);
console.log(`Esquemas simulables de figuras: ${resumen('figura')}; figuras de esquema: ${figurasEsquema}, esquemas sin circuito: ${esquemasSinCircuito}`);
const tam = new Map();
for (const r of resultados) if (r.placas) tam.set(`${r.placas}×${r.columnas}`, (tam.get(`${r.placas}×${r.columnas}`) ?? 0) + 1);
console.log(`Placas: ${[...tam].map(([k, v]) => `${k}: ${v}`).join(', ')}`);
const lentos = [...resultados].sort((a, b) => b.ms - a.ms).slice(0, 5);
console.log(`Tiempo total ${ms.toFixed(0)} ms; los más lentos: ${lentos.map((r) => `${r.id} ${r.ms.toFixed(0)} ms`).join(', ')}`);
const conChips = resultados.filter((r) => r.chips?.length);
if (conChips.length) {
  const modelos = new Map();
  for (const r of conChips) for (const m of r.chips) modelos.set(m, (modelos.get(m) ?? 0) + 1);
  console.log(`Circuitos con chips 74HC: ${conChips.length} (${conChips.map((r) => r.id).join(', ')}); chips: ${[...modelos].map(([m, k]) => `${m}×${k}`).join(', ')}`);
}
const conErrores = resultados.filter((r) => r.errores?.length);
if (conErrores.length) console.log(`Netlists del montaje con errores del escritor: ${conErrores.length} (${conErrores.slice(0, 5).map((r) => `${r.id}: ${r.errores[0]}`).join(' | ')})`);
if (salidaJson) fs.writeFileSync(salidaJson, JSON.stringify(resultados.map(({ doc, ...r }) => r), null, 1));

// --escribir dir: the board's netlist of every book netlist (not the heavy ones) in dir/montaje/<id>.cir and
// the original in dir/original/<id>.cir, to run both through scripts/validar-spice.mjs and compare.
if (args.includes('--escribir')) {
  const dir = args[args.indexOf('--escribir') + 1];
  for (const r of resultados) {
    if (r.tipo !== 'netlist' || !r.netlist) continue;
    const n = indice.netlists[r.id];
    if (n.motor?.pesada || (n.motor?.ms ?? 0) > 8000 || n.motor?.estado !== 'ok') continue;
    for (const [sub, texto] of [['montaje', r.netlist], ['original', fs.readFileSync(path.join(web, 'public/libro', n.fichero), 'utf8')]]) {
      const f = path.join(dir, sub, `${r.id}.cir`);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, texto);
    }
  }
}
process.exitCode = fallos ? 1 : 0;

// --volcar id: the board of one circuit as text (debugging).
if (args.includes('--volcar')) {
  const id = args[args.indexOf('--volcar') + 1];
  const r = resultados.find((x) => x.id === id);
  if (r?.doc) {
    for (const p of r.doc.piezas) console.log(p.comp.nombre.padEnd(8), p.enc.padEnd(13), p.pos.map((q) => q.join(',')).join(' '), p.patas.map((x) => `${x}=${r.doc.original[x?.includes("|") ? x.replace("|", ".") : `${p.id}.${x}`] ?? "-"}`).join(" "));
    for (const w of r.doc.cables) console.log('cable', w.id, w.a.join(','), '→', w.b.join(','));
    console.log(r.problemas);
  }
}

// --svg dir: every board (or those of --solo) as an SVG file, and --png: rendered with Chromium.
if (args.includes('--svg')) {
  const dir = args[args.indexOf('--svg') + 1];
  fs.mkdirSync(dir, { recursive: true });
  const { svgMontaje } = await import(src('protoboard/dibujo.ts'));
  const ficheros = [];
  for (const r of resultados) {
    if (!r.doc) continue;
    const nombre = r.id.replace(/[^a-z0-9.-]+/gi, '_');
    fs.writeFileSync(path.join(dir, `${nombre}.svg`), svgMontaje(r.doc));
    ficheros.push(nombre);
  }
  if (args.includes('--png')) {
    const { chromium } = await import('@playwright/test');
    const nav = await chromium.launch();
    const pag = await nav.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
    for (const n of ficheros) {
      const svg = fs.readFileSync(path.join(dir, `${n}.svg`), 'utf8');
      await pag.setContent(`<html><body style="margin:0;background:#20242a">${svg.replace('<svg ', '<svg style="width:1400px;height:auto;display:block" ')}</body></html>`);
      await pag.locator('svg').screenshot({ path: path.join(dir, `${n}.png`) });
    }
    await nav.close();
  }
}
