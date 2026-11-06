// 1.0 «Teoría que se mueve»: formulas of the lesson text whose values the reader drags (or moves with the keyboard)
// while the result and a small graph follow at once. Only the pieces reviewed by hand in
// contenido/teoria_viva_curado.json are emitted, to web/public/libro/teoria-viva.json (ESQUEMA.md «Teoría que se
// mueve»). The formula, its quantities and units come from the calculators' catalogue (libro/formulas.json, made from
// the book's equations); the place is the book's own equation block (libro/formulas-ec.json maps it to the formula).
// The value lists (E12 for resistors and capacitors, round series, logarithmic or linear steps) are computed here,
// and every combination is evaluated with the app's own expression engine, so the app only looks things up.
//   node scripts/teoria10.mjs              (also called by contenido/generar.py; rewrites the file only when it changes)
//   node scripts/teoria10.mjs --revisar    (prints the book's text around each equation, for the review)
import fs from 'node:fs';
import path from 'node:path';
import { J, libro, src, web } from './libro-node.mjs';

const { compilar } = await import(src('componentes/calculadoras/expresion.ts'));
const { aSerie } = await import(src('componentes/calculadoras/eseries.ts'));

// (TEORIA_CURADO: another curated file, for the tests)
const CURADO = process.env.TEORIA_CURADO ?? path.join(web, '..', 'contenido', 'teoria_viva_curado.json');
const SALIDA = path.join(libro, 'teoria-viva.json');
const revisar = process.argv.includes('--revisar');

const formulas = new Map(J('formulas.json').formulas.map((f) => [f.id, f]));
const ecs = J('formulas-ec.json');
const curado = JSON.parse(fs.readFileSync(CURADO, 'utf8'));
const problemas = [];
const plano = (h) => (h ?? '').replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, '$$$1$$').replace(/<[^>]+>/g, '');

/**
 * The top-level equation blocks of a part (the place is the block's index, as the reader and the lessons number them:
 * the same equation drawing can appear several times, and one inside a box has no index), with the text around it.
 */
function ecuaciones(parte) {
  const bl = J(`partes/${parte}.json`).bloques;
  const out = [];
  let seccion = null;
  bl.forEach((b, i) => {
    if (b.t === 'h2') seccion = b.label;
    if (b.t === 'ec') out.push({ svg: b.svg, bloque: i, seccion, antes: plano(bl[i - 1]?.html), despues: plano(bl[i + 1]?.html) });
  });
  return out;
}

const SERIE_DECADAS = (min, max, serie) => {
  const out = new Set();
  for (let d = -13; d <= 9; d++) for (let k = 0; k < 60; k++) {
    const v = aSerie(10 ** (d + k / 60), serie);
    if (v >= min * (1 - 1e-9) && v <= max * (1 + 1e-9)) out.add(v);
  }
  return [...out].sort((a, b) => a - b);
};
const redondo = (v) => Number(v.toPrecision(3));

/** The list of values a slider walks through. */
function valoresDe(e, donde) {
  if (Array.isArray(e.valores)) return e.valores.slice().sort((a, b) => a - b);
  const { min, max } = e;
  if (!(min < max)) problemas.push(`${donde}: min < max`);
  if (e.serie) return SERIE_DECADAS(min, max, e.serie);
  if (e.paso) {
    const out = [];
    for (let v = min; v <= max + e.paso / 1e6; v += e.paso) out.push(Number(v.toFixed(10)));
    return out;
  }
  // logarithmic, 24 steps per decade, three significant digits
  const n = Math.max(2, Math.round(Math.log10(max / min) * 24));
  return [...new Set(Array.from({ length: n + 1 }, (_, k) => redondo(min * (max / min) ** (k / n))))];
}

const piezas = {};
let total = 0;
for (const [n, c] of (curado.piezas ?? []).entries()) {
  const donde = `pieza ${n + 1} (${c.formula})`;
  if (!c.aprobado) continue;
  const f = formulas.get(c.formula);
  if (!f) {
    problemas.push(`${donde}: fórmula desconocida`);
    continue;
  }
  // the formula's equations in its own section (where the book presents it), not a later reminder
  const lista = ecuaciones(f.parte).filter((e) => (ecs[e.svg] ?? []).includes(f.id) && e.seccion === f.seccion.label);
  const ec = lista[c.ec ?? 0];
  if (!ec) {
    problemas.push(`${donde}: no hay ecuación ${c.ec ?? 0} de esa fórmula en ${f.parte}`);
    continue;
  }
  if (revisar) {
    console.log(`\n## ${f.id} (${f.parte}, ${f.seccion.num}) ${f.nombre}\n  antes: ${ec.antes.slice(-300)}\n  después: ${ec.despues.slice(0, 300)}`);
  }
  const resultado = f.vars.find((v) => v.id === f.resultado);
  const entradas = [];
  for (const v of f.vars) {
    if (v.id === f.resultado) continue;
    const e = c.entradas?.[v.id];
    if (!e) {
      problemas.push(`${donde}: falta el rango de ${v.id}`);
      continue;
    }
    // the starting value (the book's, where it gives one) is always reachable, even off the series
    const valores = [...new Set([...valoresDe(e, `${donde} ${v.id}`), e.inicio])].sort((a, b) => a - b);
    if (valores.length < 2 || valores.length > 400) problemas.push(`${donde} ${v.id}: ${valores.length} valores`);
    let inicio = 0;
    valores.forEach((x, k) => {
      if (Math.abs(Math.log(x / e.inicio)) < Math.abs(Math.log(valores[inicio] / e.inicio))) inicio = k;
    });
    if (Math.abs(valores[inicio] - e.inicio) > 1e-9 * Math.abs(e.inicio)) problemas.push(`${donde} ${v.id}: el valor inicial ${e.inicio} no está en la lista`);
    entradas.push({ id: v.id, sim: v.sim, nombre: v.nombre, unidad: v.unidad, valores, inicio, log: !e.paso && !Array.isArray(e.valores) ? true : !!e.log });
  }
  const g = c.grafica;
  if (!entradas.some((x) => x.id === g?.x)) problemas.push(`${donde}: la gráfica necesita una de las entradas en x`);
  // every combination along each slider (the others at their start) gives a finite result
  const fn = compilar(f.expr);
  const base = Object.fromEntries(entradas.map((x) => [x.id, x.valores[x.inicio]]));
  for (const x of entradas) for (const v of x.valores) {
    const r = fn({ ...base, [x.id]: v });
    if (!Number.isFinite(r)) problemas.push(`${donde}: resultado no finito con ${x.id} = ${v}`);
  }
  const pieza = {
    id: `${f.id}${c.ec ? `-${c.ec}` : ''}`,
    bloque: ec.bloque,
    svg: ec.svg,
    titulo: c.titulo ?? f.nombre,
    formula: f.id,
    expr: f.expr,
    resultado: { id: resultado.id, sim: resultado.sim, nombre: resultado.nombre, unidad: resultado.unidad },
    entradas,
    grafica: { x: g?.x, ylog: !!g?.ylog },
  };
  if ((piezas[f.parte] ?? []).some((x) => x.bloque === ec.bloque)) problemas.push(`${donde}: ya hay otra fórmula en ese bloque`);
  (piezas[f.parte] ??= []).push(pieza);
  total++;
}

for (const p of problemas) console.error(`  teoria10: ${p}`);
if (problemas.length) process.exit(1);
if (!revisar) {
  const texto = JSON.stringify({ version: 1, total, partes: piezas });
  const antes = fs.existsSync(SALIDA) ? fs.readFileSync(SALIDA, 'utf8') : '';
  if (antes !== texto) fs.writeFileSync(SALIDA, texto);
  console.log(`teoria-viva.json: ${total} fórmulas que se mueven en ${Object.keys(piezas).length} partes${antes === texto ? ' (sin cambios)' : ''}`);
}
