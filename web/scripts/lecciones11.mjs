// 1.1 hand-authored lessons: contenido/lecciones11/<parte>/<label>.yaml → web/public/libro/lecciones11/<parte>/<label>.json
// and lecciones11/indice.json (ESQUEMA.md «Lecciones 1.1»; the authors' guide is contenido/lecciones11/GUIA.md).
// Every lesson is validated (src/lib/leccion11/generar.ts: words per card, an explanation for every option, references
// to the model, numbers from the book or from the model, the book blocks it quotes, reachable challenges) and the
// circuits it draws are simulated with the app's own ngspice (DC, transient or AC: lib/leccion11/spice.ts) and compared
// with what the lesson's model computes; the schematics are the folders of src/lib/leccion11/esquemas/
// (scripts/esquemas11.mjs).
// Any error stops the generation (exit code 1) and nothing is written.
//
// Idempotent and order-stable: the output depends only on the sources and the book; files are rewritten only when
// their content changes, and the outputs of lessons whose source was removed are deleted.
//   node scripts/lecciones11.mjs                    (also called by contenido/generar.py, after conceptos11.mjs)
//   node scripts/lecciones11.mjs --solo cap01/sec-1.4   (checks and writes only that lesson; the index is kept)
//   node scripts/lecciones11.mjs --comprobar        (checks everything, writes nothing)
// EPA_LECCIONES11=<folder> reads the sources from another folder (tests); EPA_LIBRO relocates the book (libro-node.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { J, libro, src, web, ordenPartes } from './libro-node.mjs';

const { generarLeccion } = await import(src('lib/leccion11/generar.ts'));
// each lesson's index entry: its cards and the ones «Práctica inteligente» asks on their own (motor fixes 1.1)
const { entradaIndice } = await import(src('lib/leccion11/motor.ts'));
const { compararSimulacion } = await import(src('lib/leccion11/spice.ts'));
// the circuit schematics: one folder each under src/lib/leccion11/esquemas/ (registered as the app does)
await (await import('./esquemas11.mjs')).cargarEsquemas11();

const FUENTES = process.env.EPA_LECCIONES11 ? path.resolve(process.env.EPA_LECCIONES11) : path.join(web, '..', 'contenido', 'lecciones11');
const SALIDA = path.join(libro, 'lecciones11');
const args = process.argv.slice(2);
const solo = args.includes('--solo') ? args[args.indexOf('--solo') + 1] : null;
const comprobarSolo = args.includes('--comprobar');

// 1.2: the SQL cards' reference queries run on the sample database of section 17.10 (sql.js, the same SQLite the
// app's worker runs; lib/leccion12/sql/muestra.ts builds it), so their expected results are stored with the lesson
const { sqlNode } = await import(src('lib/leccion12/sql/node.ts'));
const sql = await sqlNode();

// 1.2 (motor12c): book figures by label, photo sizes and the consoles' photos for the «figura» widget
const { recursosLibro } = await import('./recursos11.mjs');

// 1.2 (consolas-A): the «Consolas por dentro» lessons (parts consola-<maquina>, contenido/lecciones11/consolas.yaml):
// their sections and the consoles' sourced data as synthetic book blocks (scripts/consolas11.mjs, GUIA §12)
const consolas = await (await import('./consolas11.mjs')).consolas11({ fuentes: FUENTES, publico: path.join(web, 'public'), src });

const partes = new Map();
const contexto = {
  sql,
  recursos: recursosLibro(libro, path.join(web, 'public')),
  bloques(p) {
    const c = consolas.bloques(p);
    if (c !== undefined) return c;
    if (!partes.has(p)) {
      const f = path.join(libro, 'partes', `${p}.json`);
      partes.set(p, fs.existsSync(f) ? J(`partes/${p}.json`).bloques : null);
    }
    return partes.get(p);
  },
};

/** Sources in the book's order (part order of indice.json, then the section's position in its part). */
function fuentes() {
  if (!fs.existsSync(FUENTES)) return [];
  const out = [];
  for (const p of fs.readdirSync(FUENTES).sort()) {
    const dir = path.join(FUENTES, p);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).sort()) if (f.endsWith('.yaml')) out.push({ parte: p, label: f.slice(0, -5), fichero: path.join(dir, f) });
  }
  const posParte = (p) => {
    const k = ordenPartes.indexOf(p);
    // (the console parts after the book, in the course's order)
    return k < 0 ? 1e6 + Math.max(0, consolas.orden(p)) : k;
  };
  const posSeccion = (p, l) => {
    const b = contexto.bloques(p);
    const k = b ? b.findIndex((x) => x.t === 'h2' && x.label === l) : -1;
    return k < 0 ? 1e6 : k;
  };
  return out.sort((a, b) => posParte(a.parte) - posParte(b.parte) || posSeccion(a.parte, a.label) - posSeccion(b.parte, b.label) || a.label.localeCompare(b.label));
}

function escribir(f, texto) {
  if (fs.existsSync(f) && fs.readFileSync(f, 'utf8') === texto) return false;
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, texto);
  return true;
}

const errores = [...consolas.errores];
const avisos = [];
const hechas = [];
const lista = fuentes().filter((x) => !solo || `${x.parte}/${x.label}` === solo);
if (solo && !lista.length) errores.push(`no hay fuente para ${solo} en ${FUENTES}`);
const comprobaciones = [];

for (const x of lista) {
  const origen = path.relative(path.join(web, '..'), x.fichero);
  let datos;
  try {
    datos = parse(fs.readFileSync(x.fichero, 'utf8'), { strict: true, uniqueKeys: true, prettyErrors: true });
  } catch (e) {
    errores.push(`${origen}: YAML no válido: ${e instanceof Error ? e.message : String(e)}`);
    continue;
  }
  const r = generarLeccion(datos, contexto, origen);
  errores.push(...r.errores);
  avisos.push(...r.avisos);
  if (r.leccion && r.leccion.id !== `${x.parte}/${x.label}`) errores.push(`${origen}: «leccion: ${r.leccion.id}» no coincide con el nombre del fichero (${x.parte}/${x.label})`);
  comprobaciones.push(...r.spice);
  // (a console lesson carries its machine and the source of each citation: consolas11.mjs)
  if (r.leccion) hechas.push(consolas.completar(r.leccion, (p) => contexto.bloques(p)));
}

// the circuits against the app's ngspice (only when everything else is right: it takes a few seconds)
if (!errores.length && comprobaciones.length) {
  const { motor } = await import('./libro-node.mjs');
  const simular = await motor();
  // (tolerances: lib/leccion11/spice.ts — 0,1 % DC and AC, 1 % of the axis on a transient, plus the book's
  // constant-drop approximations of diodes and transistors)
  for (const c of comprobaciones) {
    const s = await simular(c.netlist);
    if (s.ejecucion.fallo) errores.push(`${c.donde}: el simulador ha fallado (${s.ejecucion.fallo})`);
    else errores.push(...compararSimulacion(c, s.ejecucion.graficas));
  }
}

for (const a of avisos) console.warn(`aviso: ${a}`);
if (errores.length) {
  for (const e of errores) console.error(`error: ${e}`);
  console.error(`lecciones11: ${errores.length} error(es); no se ha escrito nada`);
  process.exit(1);
}

if (comprobarSolo) {
  console.log(`lecciones11: ${hechas.length} lecciones correctas (${comprobaciones.length} comprobaciones con el simulador); nada escrito`);
  process.exit(0);
}

let cambios = 0;
let indiceCambiado = false;
for (const l of hechas) if (escribir(path.join(SALIDA, l.parte, `${l.seccion}.json`), `${JSON.stringify(l)}\n`)) cambios++;
if (!solo) {
  // the index, and no output left over from a source that is gone
  const indice = { version: 1, total: hechas.length, lecciones: Object.fromEntries(hechas.map((l) => [l.id, entradaIndice(l)])) };
  if (escribir(path.join(SALIDA, 'indice.json'), `${JSON.stringify(indice)}\n`)) {
    cambios++;
    indiceCambiado = true;
  }
  const vivas = new Set(hechas.map((l) => path.join(SALIDA, l.parte, `${l.seccion}.json`)));
  if (fs.existsSync(SALIDA))
    for (const p of fs.readdirSync(SALIDA)) {
      const dir = path.join(SALIDA, p);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const f of fs.readdirSync(dir)) {
        const ruta = path.join(dir, f);
        if (f.endsWith('.json') && !vivas.has(ruta)) {
          fs.rmSync(ruta);
          cambios++;
        }
      }
      if (!fs.readdirSync(dir).length) fs.rmdirSync(dir);
    }
} else {
  // one lesson: its entry in the index, the others as they were (in the book's order)
  const f = path.join(SALIDA, 'indice.json');
  const viejo = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).lecciones ?? {} : {};
  for (const l of hechas) viejo[l.id] = entradaIndice(l);
  const orden = fuentes().map((x) => `${x.parte}/${x.label}`);
  const claves = Object.keys(viejo).sort((a, b) => (orden.indexOf(a) + 1 || 1e9) - (orden.indexOf(b) + 1 || 1e9));
  const indice = { version: 1, total: claves.length, lecciones: Object.fromEntries(claves.map((k) => [k, viejo[k]])) };
  if (escribir(f, `${JSON.stringify(indice)}\n`)) {
    cambios++;
    indiceCambiado = true;
  }
}
// 1.2 (consolas-A): the parts that are not in the book (the consoles), merged into the book's index by the app and by
// conceptos11.mjs; no file when there are none
{
  const f = path.join(SALIDA, 'partes.json');
  const p = consolas.partes();
  if (p ? escribir(f, `${JSON.stringify(p)}\n`) : fs.existsSync(f) && (fs.rmSync(f), true)) {
    cambios++;
    indiceCambiado = true;
  }
}
// the lessons' questions are something to answer: the practicable sections (libro/conceptos.json, the denominator of
// the mastery bars) follow the index (conceptos11.mjs reads it; it is quick and only reads JSON)
if (indiceCambiado) {
  const r = spawnSync(process.execPath, [path.join(web, 'scripts', 'conceptos11.mjs')], { cwd: web, env: process.env, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`error: conceptos11.mjs: ${r.stderr || r.status}`);
    process.exit(1);
  }
}
console.log(`lecciones11: ${hechas.length} lecciones (${comprobaciones.length} comprobaciones con el simulador); ${cambios ? `${cambios} fichero(s) cambiado(s)` : 'sin cambios'}`);
