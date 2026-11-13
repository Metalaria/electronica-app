// The concepts that can be practised (0.11, group B): for every part, the h2 sections that have something to answer
// in the app — an «Aprender haciendo» item, a Repaso question (its `ref` is the section, something inside it or a
// problem), a self-checked exercise or (1.1) a question of its hand-authored lesson. The mastery bars of chapters and courses use it as their denominator, so a
// section with nothing to answer never counts as «sin practicar». Reads only the generated JSON (no ngspice):
//   node web/scripts/conceptos11.mjs      → web/public/libro/conceptos.json
// contenido/generar.py runs it after practica10.mjs. Deterministic; the same rules as lib/aprendizaje/catalogo.ts.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// EPA_LIBRO: the tests' copy of the book folder (as libro-node.mjs)
const LIBRO = process.env.EPA_LIBRO || join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'libro');
const leer = (r) => JSON.parse(readFileSync(join(LIBRO, r), 'utf8'));

const indice = leer('indice.json');
// 1.2 (consolas-A): the parts that are not in the book (the «Consolas por dentro» course), as the app merges them
// (lib/datos.ts): their lessons' questions make their sections practicable
if (existsSync(join(LIBRO, 'lecciones11', 'partes.json'))) {
  for (const [p, info] of Object.entries(leer(join('lecciones11', 'partes.json')).partes ?? {})) if (!indice.partes[p]) indice.partes[p] = info;
}
const ejercicios = existsSync(join(LIBRO, 'ejercicios.json')) ? leer('ejercicios.json').items : {};

/** Same as catalogo.ts conceptoDeRef. */
function seccionDe(parte, ref) {
  const secs = indice.partes[parte]?.secciones ?? [];
  if (secs.some((s) => s.label === ref)) return ref;
  const ej = ejercicios[ref];
  if (ej?.seccion && ej.parte === parte) return ej.seccion;
  let mejor = null;
  for (const s of secs) if (ref.startsWith(`${s.label}.`) && (!mejor || s.label.length > mejor.length)) mejor = s.label;
  return mejor;
}

const porParte = new Map();
const anotar = (parte, label) => {
  if (!label || !(indice.partes[parte]?.secciones ?? []).some((s) => s.label === label)) return;
  if (!porParte.has(parte)) porParte.set(parte, new Set());
  porParte.get(parte).add(label);
};

const dirPractica = join(LIBRO, 'practica');
if (existsSync(dirPractica)) {
  for (const f of readdirSync(dirPractica)) {
    if (!f.endsWith('.json') || f === 'indice.json') continue;
    for (const it of leer(join('practica', f)).items ?? []) anotar(it.parte, it.seccion);
  }
}
const dirRepaso = join(LIBRO, 'repaso');
if (existsSync(dirRepaso)) {
  for (const f of readdirSync(dirRepaso)) {
    if (!f.endsWith('.json') || f === 'indice.json') continue;
    const d = leer(join('repaso', f));
    for (const q of d.preguntas ?? []) anotar(d.parte, seccionDe(d.parte, q.ref));
  }
}
for (const it of Object.values(ejercicios)) if (it.modo === 'auto' && (it.respuestas?.length || it.preguntas?.length) && it.seccion) anotar(it.parte, it.seccion);
// 1.1: the hand-authored lessons' questions, predictions and challenges (lecciones11/indice.json «preguntas», written
// by lecciones11.mjs, which runs this script again whenever that index changes)
if (existsSync(join(LIBRO, 'lecciones11', 'indice.json'))) {
  for (const [id, e] of Object.entries(leer(join('lecciones11', 'indice.json')).lecciones ?? {})) {
    if (!e?.preguntas?.length) continue;
    const i = id.indexOf('/');
    anotar(id.slice(0, i), id.slice(i + 1));
  }
}

// in the index's order, parts and sections
const partes = {};
let total = 0;
for (const [p, info] of Object.entries(indice.partes)) {
  const s = porParte.get(p);
  if (!s) continue;
  partes[p] = (info.secciones ?? []).map((x) => x.label).filter((l) => s.has(l));
  total += partes[p].length;
}
writeFileSync(join(LIBRO, 'conceptos.json'), JSON.stringify({ version: 1, total, partes }) + '\n');
console.log(`conceptos: ${total} secciones con algo que responder en ${Object.keys(partes).length} partes`);

// The live schematics a lesson makes explorable (figuras-vivas/esquema/ExploraEsquema.svelte): simulable, DC only
// (no transient), with a resistor, capacitor or inductor of known value. A lesson reads this list before showing a
// step so it can keep the room of the «explore» row while the figure's data load (nothing pushes the text later).
const CON_VALOR = new Set(['R', 'POT', 'C', 'L']);
const explorables = {};
const dirDatos = join(LIBRO, 'datos');
if (existsSync(dirDatos)) {
  for (const f of readdirSync(dirDatos).sort()) {
    if (!f.endsWith('.json')) continue;
    const d = leer(join('datos', f));
    const idx = [];
    (d.esquemas ?? []).forEach((e, i) => {
      const sim = e.simulacion ?? {};
      if (!sim.simulable || !sim.op || sim.tran) return;
      const excl = new Set(sim.excluidos ?? []);
      if (e.elementos.some((x) => CON_VALOR.has(x.rol) && x.valor && !excl.has(x.id) && !x.discontinuo)) idx.push(i);
    });
    if (idx.length) explorables[`datos/${f}`] = idx;
  }
}
writeFileSync(join(LIBRO, 'explorables.json'), JSON.stringify({ version: 1, esquemas: explorables }) + '\n');
console.log(`explorables: ${Object.values(explorables).flat().length} esquemas en ${Object.keys(explorables).length} figuras`);
