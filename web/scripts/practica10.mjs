#!/usr/bin/env node
// «Aprender haciendo» (0.10): generates the interactive items of the lessons from the book's own data and
// writes web/public/libro/practica/<parte>.json and practica/indice.json (see ESQUEMA.md, «Práctica»).
//
//   node scripts/practica10.mjs [--solo cap05] [--sin-simular] [--detalle]
//
// Nothing here writes text for the reader beyond short fixed sentences around book names and values
// («Toque R<sub>2</sub> en el esquema», «Si duplica R<sub>2</sub>, ¿…?»; «usted» since review 10d): statements, hints and explanations
// are the book's paragraphs, captions, lists, glossary definitions, equations, exercises and netlists.
// Predictions and slider targets come from simulating the changed circuit with the app's own ngspice
// (WebAssembly, the same build as the simulator's worker); breadboard puzzles are checked with the
// breadboard's own placement and verification code. The output is deterministic.
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

// Some app modules import their siblings without the «.ts» extension (Vite resolves it); Node needs a hint.
register(
  'data:text/javascript,' +
    encodeURIComponent(`
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export async function resolve(spec, ctx, next) {
  if ((spec.startsWith('./') || spec.startsWith('../')) && !/\\.[a-z]+$/i.test(spec) && ctx.parentURL?.startsWith('file:')) {
    const u = new URL(spec + '.ts', ctx.parentURL);
    if (existsSync(fileURLToPath(u))) return next(u.href, ctx);
  }
  return next(spec, ctx);
}`),
);

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// EPA_LIBRO: the tests' copy of the book folder (as libro-node.mjs)
const libro = process.env.EPA_LIBRO ? path.resolve(process.env.EPA_LIBRO) : path.join(web, 'public', 'libro');
const salidaDir = path.join(libro, 'practica');
const args = process.argv.slice(2);
const solo = args.includes('--solo') ? args[args.indexOf('--solo') + 1] : null;
const sinSimular = args.includes('--sin-simular');
const detalle = args.includes('--detalle');
// review 11a: «--registrar-ids» adds this run's «ordenar» ids to the registry (contenido/ids_practica.json)
const registrarIds = args.includes('--registrar-ids');

const src = (p) => path.join(web, 'src', p);
const { calcularPasos, finDeSeccion } = await import(src('lib/leccion-pasos.ts'));
const { calcular } = await import(src('componentes/calculadoras/motor.ts'));
const { variacionDe, variantes } = await import(src('componentes/practica/variantes.ts'));
const circ = await import(src('componentes/practica/circuito.ts'));
const { serieE12, listarParametros, lineasNetlist } = await import(src('simulador/motor/netlist.ts'));
const { elementosCircuito, ONDAS } = await import(src('componentes/figuras-vivas/esquema/netlist.ts'));
const { montajeCompleto, montajeIncompleto, pistaMontaje, verificarMontaje } = await import(src('componentes/practica/montaje.ts'));
const { esClaveSimbolo } = await import(src('componentes/glosario/simbolo.ts'));

const J = (p) => JSON.parse(fs.readFileSync(path.join(libro, p), 'utf8'));
const indice = J('indice.json');
const refs = J('refs.json');
const formulas = J('formulas.json');
const ejercicios = J('ejercicios.json');
const glosario = J('glosario.json');
const glosImagenes = J('glosario-imagenes.json').terminos;
const spice = J('spice.json');

// ------------------------------------------------------------------ simulation engine (Node)

let simularTexto = null;
if (!sinSimular) {
  const { compilar } = await import(src('simulador/motor/nucleo.ts'));
  const { simular } = await import(src('simulador/motor/simular.ts'));
  const wasm = path.join(web, 'public', 'ngspice', 'ngspice-xspice.wasm');
  if (!fs.existsSync(wasm)) {
    console.error('practica10: falta public/ngspice/ngspice-xspice.wasm (ejecute antes «node scripts/ngspice.mjs»).');
    process.exit(2);
  }
  const modulo = await compilar(fs.readFileSync(wasm));
  simularTexto = (t) => simular(modulo, t, undefined, 'xspice');
}
let simulaciones = 0;

// ------------------------------------------------------------------ text helpers

function plano(h) {
  if (!h) return '';
  return h
    .replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/g, ' $1 ')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const NBSP = '\u00a0';

/** «R1» → «R<sub>1</sub>», «RC» → «R<sub>C</sub>», «Rshunt» → «R<sub>shunt</sub>», «D» → «D». */
function designadorHtml(d) {
  const m = /^([A-Za-z])(.+)$/.exec(d);
  if (!m) return esc(d);
  return `${esc(m[1].toUpperCase())}<sub>${esc(m[2])}</sub>`;
}

/** «$V_{out}$» → «V<sub>out</sub>», «$+V_{CC}$» → «+V<sub>CC</sub>», «$V_{CC}$ = 12 V» → «V<sub>CC</sub> = 12 V». */
function etiquetaHtml(s) {
  return s
    .replace(/\$([^$]*)\$/g, (_m, t) =>
      esc(t)
        .replace(/\\mathrm\{([^}]*)\}/g, '$1')
        .replace(/_\{([^}]*)\}/g, '<sub>$1</sub>')
        .replace(/_([A-Za-z0-9])/g, '<sub>$1</sub>')
        .replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>')
        .replace(/\\[a-z]+/gi, ''),
    )
    .replace(/\n/g, ' ')
    .trim();
}

function primeraFrase(html, max = 190) {
  const t = plano(html);
  // first sentence: up to a period followed by a space and an upper-case letter (or the end)
  const m = /^(.+?[.;:])(?=\s+[A-ZÁÉÍÓÚÑ¿(«]|\s*$)/.exec(t);
  let f = (m ? m[1] : t).trim();
  if (f.length > max) {
    f = f.slice(0, max);
    f = f.slice(0, f.lastIndexOf(' ')).replace(/[,;:]$/, '') + '…';
  }
  return f;
}

function valorTexto(v, u) {
  // three significant figures, SI prefix, decimal comma (as formatoValor of the calculators)
  const P = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  const a = Math.abs(v);
  const [k, p] = a === 0 ? [1, ''] : (P.find(([k]) => a >= k * 0.9995) ?? P[P.length - 1]);
  const n = Number((v / k).toPrecision(3));
  return `${String(n).replace('.', ',').replace('-', '−')}\u202f${p}${u}`;
}

// ------------------------------------------------------------------ the book: parts, sections, labels

const ordenPartes = indice.tomos.flatMap((t) => t.partes).filter((p) => fs.existsSync(path.join(libro, 'partes', `${p}.json`)));
const partes = new Map();
const parte = (p) => {
  if (!partes.has(p)) partes.set(p, J(`partes/${p}.json`));
  return partes.get(p);
};

/** label → {parte, top (top-level block index), seccion (h2 label), h2 (index)} for every labelled block. */
const lugares = new Map();
/** parte → [{label, h2, fin, num, titulo}] */
const seccionesDe = new Map();
for (const p of ordenPartes) {
  const d = parte(p);
  const secs = [];
  let sec = null;
  const anotar = (b, top) => {
    if (b.label && !lugares.has(b.label)) lugares.set(b.label, { parte: p, top, seccion: sec?.label ?? null, h2: sec?.h2 ?? -1 });
    if (Array.isArray(b.bloques)) for (const x of b.bloques) anotar(x, top);
    if (b.t === 'ejercicios') for (const it of b.items) if (it.label && !lugares.has(it.label)) lugares.set(it.label, { parte: p, top, seccion: sec?.label ?? null, h2: sec?.h2 ?? -1 });
  };
  d.bloques.forEach((b, i) => {
    if (b.t === 'h2') {
      sec = { label: b.label, h2: i, fin: finDeSeccion(d.bloques, i), num: b.num ?? null, titulo: plano(b.html) };
      secs.push(sec);
    }
    anotar(b, i);
  });
  seccionesDe.set(p, secs);
}

const TIPO_DONDE = { sec: 'Sección', subsec: 'Apartado', fig: 'Figura', tab: 'Tabla', ej: 'Ejercicio', prob: 'Problema', cap: 'Capítulo', ap: 'Apéndice' };
const ARTICULO = { sec: 'la sección', subsec: 'el apartado', fig: 'la figura', tab: 'la tabla', ej: 'el ejercicio', prob: 'el problema', cap: 'el capítulo', ap: 'el apéndice' };
function donde(label) {
  const r = refs[label];
  if (!r) {
    const l = lugares.get(label);
    const s = l ? seccionesDe.get(l.parte).find((x) => x.label === label) : null;
    return s ? `Sección «${s.titulo}»` : 'Libro';
  }
  return `${TIPO_DONDE[r.tipo] ?? 'Sección'} ${r.num}`;
}
function verRef(label) {
  const r = refs[label];
  if (!r) return 'la sección en el libro';
  return `${ARTICULO[r.tipo] ?? 'la sección'} ${r.num}`;
}

/** The h3 (subsection) label that contains a top-level block of a section, or the section's label. */
function subDe(p, sec, top) {
  const bl = parte(p).bloques;
  for (let i = top; i > sec.h2; i--) if (bl[i].t === 'h3' && bl[i].label && refs[bl[i].label]) return bl[i].label;
  return sec.label;
}

function seccionDe(p, label) {
  return seccionesDe.get(p).find((s) => s.label === label);
}

/** Paragraphs (top level, or inside boxes) of a section with the top-level index that holds them. */
function* parrafos(p, sec) {
  const bl = parte(p).bloques;
  for (let i = sec.h2 + 1; i < sec.fin; i++) {
    const b = bl[i];
    if (b.t === 'p') yield { html: b.html, top: i };
    else if (b.t === 'caja' || b.t === 'deduccion') for (const x of b.bloques) if (x.t === 'p') yield { html: x.html, top: i };
    else if (b.t === 'lista') for (const it of b.items) yield { html: it, top: i, item: true };
  }
}

/** The book's paragraph that cites a label (a figure, an exercise…) inside a section; the nearest one to `cerca`. */
function parrafoQueCita(p, sec, label, cerca = null) {
  const marca = `data-ref="${label}"`;
  let mejor = null;
  for (const x of parrafos(p, sec)) {
    if (!x.html.includes(marca) || x.item) continue;
    const d = cerca == null ? 0 : Math.abs(x.top - cerca);
    if (!mejor || d < mejor.d) mejor = { ...x, d };
  }
  return mejor ? { html: mejor.html, ref: subDe(p, sec, mejor.top), donde: donde(subDe(p, sec, mejor.top)) } : null;
}

// ------------------------------------------------------------------ results

const items = new Map(); // parte → item[]
const descartes = {};
const descartar = (k) => (descartes[k] = (descartes[k] ?? 0) + 1);
function poner(it) {
  if (solo && it.parte !== solo) return;
  if (!items.has(it.parte)) items.set(it.parte, []);
  items.get(it.parte).push(it);
}

// ================================================================== 1. problems with changing values

function bloqueEc(p, sec, fuente) {
  const bl = parte(p).bloques;
  for (let i = sec.h2 + 1; i < sec.fin; i++) {
    const b = bl[i];
    if (b.t === 'ec' && b.fuente === fuente) return i;
    if ((b.t === 'tarjeta' || b.t === 'caja' || b.t === 'deduccion') && b.bloques.some((x) => x.t === 'ec' && x.fuente === fuente)) return i;
  }
  return -1;
}

/** The paragraph just before the equation in the book (what introduces it), if it is a paragraph. */
function introFormula(p, sec, top) {
  const bl = parte(p).bloques;
  for (let i = top - 1; i > sec.h2 && i >= top - 2; i--) {
    if (bl[i].t === 'p' && plano(bl[i].html).length > 30) return { html: bl[i].html, ref: subDe(p, sec, i), donde: donde(subDe(p, sec, i)) };
    if (bl[i].t === 'h3' || bl[i].t === 'h2') break;
  }
  return null;
}

/** The formula as the item carries it (the calculators' entry without the gallery's data). */
function formulaLigera(f) {
  const { id, nombre, parte: pf, cap, seccion, sub, fuente, svg, w, h, ecuacion, resultado, expr, vars, despejes, ejemplo } = f;
  return { id, nombre, parte: pf, cap, seccion, sub, fuente, svg, w, h, ecuacion, resultado, expr, vars, despejes, ejemplo };
}

// Exercises of the book reproduced by a formula with the numbers of their statement.
const PREF = { p: 1e-12, n: 1e-9, µ: 1e-6, μ: 1e-6, u: 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9 };
const reCant = /(?<![\w,.])((?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:,\d+)?)\s?(p|n|µ|μ|u|m|k|M|G)?(Ω|Hz|VA|Wh|Ah|V|A|W|F|H|s|J|C|S)(?![\wΩ])/g;
function cantidades(t) {
  const r = [];
  for (const m of t.matchAll(reCant)) {
    const v = Number(m[1].replace(/[ \u00a0\u202f]/g, '').replace(',', '.')) * (m[2] ? PREF[m[2]] : 1);
    r.push({ v, u: m[3], txt: m[0] });
  }
  return r;
}
function enunciadoEjercicio(it) {
  const d = parte(it.parte);
  let bs;
  if (it.tipo === 'ej') bs = d.bloques[it.pos[0]].items[it.pos[1]].bloques;
  else bs = d.bloques.slice(it.pos[0] + 1, it.pos[1] + 1);
  const out = [];
  for (const b of bs) {
    if (b.t === 'p') out.push(b.html);
    else if (b.t === 'lista') out.push(b.items.join('<br>'));
    else return null; // figures, tables, equations: not a plain statement
  }
  return out;
}
/** First paragraph of the book's solution of an exercise or problem. */
function solucionEjercicio(it) {
  const d = parte(it.parte);
  let bs;
  if (it.tipo === 'ej') bs = d.bloques[it.pos[0]].items[it.pos[1]].solucion ?? [];
  else bs = d.bloques.slice(it.pos[1] + 1, it.pos[2]);
  const p = bs.find((b) => b.t === 'p' && plano(b.html).length > 20);
  return p ? p.html : null;
}
/** Regex that finds a quantity's text inside HTML (spaces may be any kind of space). */
function reTexto(txt) {
  return new RegExp(
    '(?<![\\w,.])' + txt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[ \u00a0\u202f]/g, '[ \\u00a0\\u202f]?').replace(/µ|μ/g, '[µμ]') + '(?![\\wΩ])',
    'g',
  );
}

const enlaces = {}; // exercise label → item id
const usadas = new Set(); // formulas with an exercise-based item
const porParteF = new Map();
for (const f of formulas.formulas) (porParteF.get(f.parte) ?? porParteF.set(f.parte, []).get(f.parte)).push(f);

function enlazarEjercicio(id, it) {
  const parrs = enunciadoEjercicio(it);
  if (!parrs) return null;
  const html = parrs.join('<br>');
  const qs = cantidades(plano(html));
  for (const r of it.respuestas) {
    for (const f of porParteF.get(it.parte) ?? []) {
      for (const vo of f.vars) {
        if (vo.unidad !== r.unidad) continue;
        if (vo.id !== f.resultado && !(vo.id in f.despejes)) continue;
        const ins = f.vars.filter((v) => v.id !== vo.id);
        const cands = ins.map((v) => qs.filter((q) => q.u === v.unidad));
        if (cands.some((c) => !c.length)) continue;
        let combos = [[]];
        for (const c of cands) {
          const n = [];
          for (const a of combos) for (const q of c) if (!a.includes(q)) n.push([...a, q]);
          combos = n.slice(0, 2000);
        }
        for (const cmb of combos) {
          const env = {};
          ins.forEach((v, k) => (env[v.id] = cmb[k].v));
          const c = calcular(f, vo.id, env);
          if (!Number.isFinite(c.valor)) continue;
          const tol = Math.max(r.tol ?? 0.02, 0.01);
          const ok = r.tol_abs != null ? Math.abs(c.valor - r.valor) <= r.tol_abs : Math.abs(c.valor - r.valor) <= Math.abs(r.valor) * tol;
          if (!ok) continue;
          // The statement must not already contain the answer, and each quantity must be found in the HTML.
          if (qs.some((q) => q.u === r.unidad && Math.abs(q.v - r.valor) <= Math.abs(r.valor) * 0.005)) continue;
          let h = html;
          let bien = true;
          ins.forEach((v, k) => {
            const re = reTexto(cmb[k].txt);
            const n = (h.match(re) ?? []).length;
            if (n !== 1) bien = false;
            else h = h.replace(re, `{{${v.id}}}`);
          });
          if (!bien) continue;
          // (the book's text of each value, to find it again in what the field asks)
          const textos = Object.fromEntries(ins.map((v, k) => [v.id, cmb[k].txt]));
          return { f, objetivo: vo.id, env, html: h, r, textos };
        }
      }
    }
  }
  return null;
}

function itemNumerico(f, { objetivo, libro, ejercicio, r, idEj, ajuste }) {
  const sec = seccionDe(f.parte, f.seccion.label);
  if (!sec) return null;
  let top = bloqueEc(f.parte, sec, f.fuente);
  if (top < 0 && f.sub && lugares.get(f.sub)) top = lugares.get(f.sub).top;
  if (top < 0) top = sec.h2 + 1;
  const varia = {};
  for (const v of f.vars) {
    if (v.id === objetivo || libro[v.id] == null) continue;
    const x = variacionDe(v, libro[v.id]);
    if (x) varia[v.id] = x;
  }
  if (!Object.keys(varia).length) return descartar('numérico: ningún dato con valores realistas que variar'), null;
  const intro = introFormula(f.parte, sec, top);
  const vo = f.vars.find((v) => v.id === objetivo);
  const it = {
    id: `${f.parte}-num-${idEj ?? f.id}`,
    tipo: 'numerico',
    parte: f.parte,
    seccion: sec.label,
    bloque: top,
    ref: f.sub && refs[f.sub] ? f.sub : sec.label,
    verRef: verRef(f.sub && refs[f.sub] ? f.sub : sec.label),
    enunciado: '',
    citas: intro ? [intro] : [],
    pistas: [],
    formula: formulaLigera(f),
    objetivo,
    libro,
    varia,
    tol: Math.min(0.05, Math.max(0.02, r?.tol ?? 0.02)),
    intro: intro ?? undefined,
  };
  if (ejercicio) it.ejercicio = ejercicio;
  if (ajuste) {
    for (const id of ajuste.fijas ?? []) delete it.varia[id];
    for (const [id, valores] of Object.entries(ajuste.valores ?? {})) it.varia[id] = { serie: 'ajustada', valores };
    if (ajuste.condiciones?.length) it.condiciones = ajuste.condiciones;
    if (ajuste.normalizado) it.normalizado = ajuste.normalizado;
    if (!Object.keys(it.varia).length) return descartar('numérico: ningún dato que variar tras el ajuste'), null;
  }
  // At least 8 different valid variants.
  const vs = variantes(it);
  if (vs.length < 8) return descartar('numérico: menos de 8 variantes válidas'), null;
  it.enunciado = vo.nombre;
  return it;
}

// 1.0 (review 10e): what the automatic link of an exercise to a formula cannot know. Every one of the 41 linked
// exercises was audited for variants that contradict the statement or leave the circuit out of its regime:
//   fijas: inputs that keep the book's value (the statement fixes them elsewhere or derives other data from them);
//   valores: realistic lists instead of the generic ones; condiciones: expressions that must be positive;
//   intercambiar: two inputs the link swapped (a symmetric formula); excluir: a link to the wrong formula;
//   normalizado + pide (final QA 1.0): the statement asks for a standard value — graded as the series value nearest to
//   the result (variantes.ts pedidoDe), with the field's own text.
const AJUSTES = {
  // «a 50 Hz (onda completa, frecuencia de rizado …)»: the ripple of full-wave rectified 50 Hz mains is 100 Hz
  'ej-5.6': { fijas: ['f_r'] },
  // a blue LED (V_F 3,2 V) at usual currents, from a supply above it; «Elige valores comerciales»: the variant asks
  // for the E12 value nearest to the computed resistance (final QA: the computed one was graded, an E12 got «Cerca»)
  'ej-5.1': {
    valores: { I_F: [0.005, 0.01, 0.015, 0.02] },
    condiciones: ['V_CC - V_F - 1'],
    normalizado: 'E12',
    pide: 'Valor E12 más cercano a la resistencia limitadora',
  },
  // «¿Qué resistencia necesitas? Elige el valor E12 más cercano.» (linked to X_C = 1/(2πfC), the same expression)
  'ej-3.4': { normalizado: 'E12', pide: 'Valor E12 más cercano a la resistencia necesaria' },
  // the link took the load current for the Zener's and the reverse (the formula adds them); with headroom
  'ej-5.3': { intercambiar: ['I_Z', 'I_L'], condiciones: ['V_in - V_Z - 1'] },
  'ej-5.8': { intercambiar: ['I_Z', 'I_L'], condiciones: ['V_in - V_Z - 1'] },
  // divider bias with R_E = 470 Ω and R_C = 2,2 kΩ: the base above V_BE and V_CE above saturation
  'ej-6.2': { condiciones: ['V_CC*R_2/(R_1+R_2) - 0.7', 'V_CC - (V_CC*R_2/(R_1+R_2) - 0.7)/470*(2200 + 470) - 0.3'] },
  // «una carga de 24 Ω alimentada a 12 V» was linked to the Early resistance V_A/I_C
  'prob-6.C': { excluir: true },
  // «consume 2 A (su devanado tiene, por tanto, 6 Ω)» at 12 V: the current is fixed by the winding
  'prob-4.C': { fijas: ['I'] },
  // FM broadcast band with the 10,7 MHz IF of the TA7358 (the link named the station f_FI and the IF f_s)
  'ej-16.2': { fijas: ['f_s'], valores: { f_FI: [88e6, 90e6, 91.5e6, 94e6, 96e6, 98.5e6, 100e6, 102e6, 104e6, 106e6, 107.5e6] } },
  // a divider, a buck, a three-terminal regulator: the output below the input (with the regulator's dropout)
  'ej-1.4': { condiciones: ['V_in - V_out - 0.5'] },
  'prob-4.A': { condiciones: ['V_in - V_out - 1'] },
  // a TO-220 three-terminal regulator (Rjc 3 + Rcs 0,5 °C/W, Tj 125 °C at 40 °C, the book's derated 110 °C): it can
  // burn at most 70/3,5 = 20 W — beyond that no heatsink exists (review 10g); and currents up to 1,5 A
  'prob-8.A': { valores: { I: [0.5, 0.75, 1, 1.25, 1.5] }, condiciones: ['V_in - V_out - 2', '20 - (V_in - V_out)*I'] },
  // LM317: R₁ carries its minimum load current (1,25 V / R₁); the book's 240 Ω is the largest that keeps it (review 10g)
  'ej-8.4': { condiciones: ['240.5 - R_1'] },
  'ej-33.1': { condiciones: ['V_in - V_out - 1'] },
};

/** Applies an exercise's adjustments to its link (before the item is built). */
function ajustarEnlace(id, e) {
  const a = AJUSTES[id];
  if (!a?.intercambiar) return e;
  const [x, y] = a.intercambiar;
  const env = { ...e.env, [x]: e.env[y], [y]: e.env[x] };
  const html = e.html.split(`{{${x}}}`).join('\u0000').split(`{{${y}}}`).join(`{{${x}}}`).split('\u0000').join(`{{${y}}}`);
  const textos = { ...e.textos, [x]: e.textos[y], [y]: e.textos[x] };
  return { ...e, env, html, textos };
}

/**
 * What the field of a variant asks (final QA 1.0): the answer's name in the book (or the AJUSTES text) with every
 * value of a quantity the variant changes turned into its «{{id}}» placeholder («X<sub>C</sub> a 50 Hz» →
 * «X<sub>C</sub> a {{f}}»), so the app writes the variant's own value. A book value of a varied quantity that is
 * still in it stops the generation.
 */
function pideDe(id, e, item) {
  let pide = AJUSTES[id]?.pide ?? e.r.nombre;
  for (const v of Object.keys(item.varia)) {
    const txt = e.textos?.[v];
    if (txt) pide = pide.replace(reTexto(txt), `{{${v}}}`);
  }
  const unidades = new Map(Object.keys(item.varia).map((v) => [item.formula.vars.find((x) => x.id === v)?.unidad, v]));
  for (const q of cantidades(plano(pide))) {
    const v = unidades.get(q.u);
    if (v && Math.abs(q.v - item.libro[v]) <= Math.abs(item.libro[v]) * 0.005)
      throw new Error(`${id}: lo que se pide («${plano(pide)}») nombra el valor del libro de ${v}, que la variante cambia`);
  }
  return pide;
}

let nEjEnlazados = 0;
for (const [id, it] of Object.entries(ejercicios.items)) {
  // 1.0: exercises checked only by structured questions have no numeric answer to reproduce
  if (it.modo !== 'auto' || !it.respuestas?.length || (solo && it.parte !== solo)) continue;
  // 1.1: the new exercises not in the book yet (ejercicios_nuevos) are not the book's: no variants citing them as such
  if (it.nuevo) continue;
  if (AJUSTES[id]?.excluir) {
    descartar('ejercicio enlazado con una fórmula que no es la suya (revisado a mano)');
    continue;
  }
  const e0 = enlazarEjercicio(id, it);
  if (!e0) {
    descartar('ejercicio numérico sin fórmula del catálogo que lo reproduzca con los datos del enunciado');
    continue;
  }
  const e = ajustarEnlace(id, e0);
  const r = refs[id];
  const item = itemNumerico(e.f, {
    objetivo: e.objetivo,
    libro: e.env,
    r: e.r,
    idEj: id,
    ejercicio: { label: id, num: r?.num ?? it.num, html: e.html, pide: e.r.nombre },
    ajuste: AJUSTES[id],
  });
  if (!item) continue;
  item.ejercicio.pide = pideDe(id, e, item);
  // the book's exercise asks more than this one result: the variant says it asks only this
  if (it.respuestas.length + (it.preguntas?.length ?? 0) + (it.otras?.length ?? 0) > 1) item.ejercicio.solo = true;
  // the exercise's own solution in the book is cited too (its first paragraph)
  const sol = solucionEjercicio(it);
  if (sol) item.citas.push({ html: sol, ref: id, donde: `${donde(id)}, con los valores del libro` });
  poner(item);
  enlaces[id] = item.id;
  usadas.add(e.f.id);
  nEjEnlazados++;
}

for (const f of formulas.formulas) {
  if (solo && f.parte !== solo) continue;
  if (usadas.has(f.id)) continue;
  if (!f.ejemplo) {
    descartar('fórmula sin ejemplo del libro');
    continue;
  }
  if (f.ejemplo.errata) {
    descartar('fórmula con errata en el ejemplo');
    continue;
  }
  const item = itemNumerico(f, { objetivo: f.resultado, libro: { ...f.ejemplo.valores } });
  if (item) poner(item);
}

// ================================================================== 2. figures with schematics

const datosCache = new Map();
/** Every schematic of a figure knows its siblings: a name must be unique in the whole picture. */
const hermanos = new WeakMap();
const datosDe = (p) => {
  if (datosCache.has(p)) return datosCache.get(p);
  const d = J(p);
  const todos = d.esquemas ?? [];
  for (const e of todos) hermanos.set(e, todos);
  datosCache.set(p, d);
  return d;
};
const enFigura = (esq) => hermanos.get(esq) ?? [esq];

/** Every figure block with schematic data: {p, sec, top, fig}. */
const figurasEsquema = [];
for (const p of ordenPartes) {
  if (solo && p !== solo) continue;
  for (const sec of seccionesDe.get(p)) {
    const bl = parte(p).bloques;
    for (let i = sec.h2 + 1; i < sec.fin; i++) {
      const visitar = (b) => {
        if (b.t === 'figura' && b.datos && b.tipo_figura === 'esquema' && b.svg_vista && b.label) figurasEsquema.push({ p, sec, top: i, fig: b });
        if (Array.isArray(b.bloques)) b.bloques.forEach(visitar);
      };
      visitar(bl[i]);
    }
  }
}

const NOMBRE_ROL = {
  R: 'la resistencia', POT: 'el potenciómetro', C: 'el condensador', L: 'la bobina', D: 'el diodo', DZ: 'el diodo Zener',
  LED: 'el LED', PD: 'el fotodiodo', QN: 'el transistor', QP: 'el transistor', QPHOTO: 'el fototransistor', MN: 'el MOSFET',
  MP: 'el MOSFET', JN: 'el JFET', JP: 'el JFET', OA: 'el amplificador operacional', V: 'la fuente de tensión',
  BAT: 'la pila', I: 'la fuente de corriente', VSIN: 'el generador de señal', VPULSE: 'el generador de pulsos', SW: 'el interruptor',
  LAMP: 'la lámpara', SPK: 'el altavoz', FUSE: 'el fusible', XFMR: 'el transformador', AM: 'el amperímetro', VM: 'el voltímetro',
};
const SIMBOLO_ROL = {
  R: 'R', POT: 'POT', C: 'C', L: 'L', D: 'D', DZ: 'DZ', LED: 'LED', PD: 'FOTODIODO', QN: 'NPN', QP: 'PNP', QPHOTO: 'FOTOTRANSISTOR',
  MN: 'NMOS', MP: 'PMOS', JN: 'NJF', JP: 'PJF', OA: 'OPAMP', V: 'VDC', BAT: 'PILA', I: 'IDC', VSIN: 'VSIN', VPULSE: 'VPULSO',
  SW: 'SW', FUSE: 'FUSIBLE', XFMR: 'TRAFO',
};
const PIEZA = new Set(Object.keys(NOMBRE_ROL));

/** How a part of a schematic is named in a question: its designator, or its kind when it is the only one. */
function nombrePieza(esq, e) {
  const circuito = enFigura(esq).flatMap((q) => q.elementos).filter((x) => PIEZA.has(x.rol) && !x.discontinuo);
  if (e.designador && /^[A-Za-z][A-Za-z0-9]*$/.test(e.designador) && circuito.filter((x) => x.designador === e.designador).length === 1)
    return { html: designadorHtml(e.designador), unico: true };
  const mismos = circuito.filter((x) => grupoRol(x.rol) === grupoRol(e.rol));
  if (mismos.length === 1 && NOMBRE_ROL[e.rol]) return { html: NOMBRE_ROL[e.rol], unico: true };
  if (e.valor_texto && NOMBRE_ROL[e.rol]) {
    const igual = mismos.filter((x) => x.valor_texto === e.valor_texto);
    if (igual.length === 1) return { html: `${NOMBRE_ROL[e.rol]} de ${esc(e.valor_texto)}`, unico: true };
  }
  return { html: NOMBRE_ROL[e.rol] ?? '', unico: false };
}
function grupoRol(r) {
  return { QN: 'Q', QP: 'Q', MN: 'M', MP: 'M', JN: 'J', JP: 'J', V: 'F', BAT: 'F', 'V?': 'F' }[r] ?? r;
}
function etiquetaNodo(esq, n) {
  if (n.tierra) return null;
  for (const e of n.etiquetas ?? []) {
    const h = etiquetaHtml(e);
    if (!h || /^\d+$/.test(plano(h))) continue;
    // the label must name only this node
    const otros = enFigura(esq).flatMap((q) => q.nodos).filter((m) => m !== n && (m.etiquetas ?? []).some((x) => etiquetaHtml(x) === h));
    if (otros.length) continue;
    return h;
  }
  return null;
}
/** The schematic's own area of a figure (SVG units, padded), or null when it is most of the picture anyway. */
function recorteDe(fig, esq) {
  const A = esq.dibujo_a_svg;
  const xs = [];
  const ys = [];
  const poner = (p) => {
    xs.push(A.sx * p[0] + A.tx);
    ys.push(A.sy * p[1] + A.ty);
  };
  for (const p of esq.puntos) poner(p.xy);
  for (const e of esq.elementos) {
    if (e.caja) {
      poner([e.caja[0], e.caja[1]]);
      poner([e.caja[2], e.caja[3]]);
    }
    for (const a of Object.values(e.anclas ?? {})) poner(a);
  }
  if (!xs.length) return null;
  const [vx, vy, vw, vh] = fig.svg_vista;
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  // room for the value labels drawn beside the symbols
  const m = Math.max(22, 0.14 * Math.max(x1 - x0, y1 - y0));
  x0 = Math.max(vx, x0 - m);
  y0 = Math.max(vy, y0 - m);
  x1 = Math.min(vx + vw, x1 + m);
  y1 = Math.min(vy + vh, y1 + m);
  if ((x1 - x0) * (y1 - y0) > 0.8 * vw * vh) return null;
  return [x0, y0, x1 - x0, y1 - y0].map((v) => Number(v.toFixed(2)));
}

function nombreFigura(f) {
  return `la figura ${f.num}`;
}

/** The book's explanation for a figure: the paragraph that cites it (nearest), else its caption. */
function citaFigura(p, sec, fig, top) {
  const c = parrafoQueCita(p, sec, fig.label, top);
  const pie = { html: fig.pie, ref: fig.label, donde: donde(fig.label) };
  return c ? [c, pie] : [pie];
}

// ---------------------------------------------------------------- 2a. tap on the schematic

for (const { p, sec, top, fig } of figurasEsquema) {
  const d = datosDe(fig.datos);
  const vista = fig.svg_vista;
  if (!d.lienzo?.svg || Math.abs(d.lienzo.svg.ancho - vista[2]) > 0.5) continue;
  const candidatos = [];
  (d.esquemas ?? []).forEach((esq, k) => {
    for (const e of esq.elementos) {
      if (!PIEZA.has(e.rol) || e.discontinuo || !e.caja) continue;
      const n = nombrePieza(esq, e);
      if (!n.unico || !n.html) continue;
      // prefer parts named by kind (diode, LED, transistor…), then designators, then plain resistors
      const peso = e.designador ? 2 : ['R', 'V', 'BAT'].includes(e.rol) ? 1 : 3;
      candidatos.push({ k, pide: { k: 'elemento', id: e.id, nombre: n.html, rol: e.rol }, peso });
    }
    for (const n of esq.nodos) {
      const h = etiquetaNodo(esq, n);
      if (!h || !esq.tramos.some((t) => t.nodo === n.id)) continue;
      candidatos.push({ k, pide: { k: 'nodo', id: n.id, nombre: h }, peso: 2.5 });
    }
  });
  if (!candidatos.length) {
    descartar('figura de esquema sin pieza ni nodo que se pueda nombrar sin ambigüedad');
    continue;
  }
  candidatos.sort((a, b) => b.peso - a.peso || a.k - b.k || a.pide.id.localeCompare(b.pide.id));
  const c = candidatos[0];
  const ent = c.pide.k === 'nodo' ? `el nodo ${c.pide.nombre}` : c.pide.nombre;
  const pistas = [];
  const cf = citaFigura(p, sec, fig, top);
  pistas.push({ titulo: 'Lo que dice el libro', html: cf[0].html });
  poner({
    id: `${p}-toque-${fig.label}`,
    tipo: 'toque',
    parte: p,
    seccion: sec.label,
    bloque: top,
    ref: fig.label,
    verRef: verRef(fig.label),
    enunciado: `Toque ${ent} en el esquema de ${nombreFigura(fig)}.`,
    citas: cf,
    pistas,
    figura: { label: fig.label, num: fig.num, src: fig.src, vista, datos: fig.datos, esquema: c.k, pie: fig.pie },
    pide: { ...c.pide, simbolo: c.pide.rol ? SIMBOLO_ROL[c.pide.rol] : undefined },
  });
}

// ---------------------------------------------------------------- 2b. predictions and sliders (figures)

const CAMBIABLE = new Set(['R', 'V', 'BAT', 'RAIL', 'I']);
function observablesFigura(esq) {
  const r = [];
  for (const n of esq.nodos) {
    const h = etiquetaNodo(esq, n);
    if (h) r.push({ o: { k: 'nodo', id: n.id, nombre: `la tensión en ${h}`, unidad: 'V' }, peso: 3 });
  }
  for (const e of elementosCircuito(esq)) {
    if (e.discontinuo) continue;
    const n = nombrePieza(esq, e);
    if (!n.unico) continue;
    if (['LED', 'D', 'DZ'].includes(e.rol)) r.push({ o: { k: 'corriente', id: e.id, nombre: `la corriente por ${n.html}`, unidad: 'A' }, peso: 3 });
    else if (e.rol === 'R' && e.valor) {
      r.push({ o: { k: 'corriente', id: e.id, nombre: `la corriente por ${n.html}`, unidad: 'A' }, peso: e.designador ? 2 : 1.5 });
      r.push({ o: { k: 'tension', id: e.id, nombre: `la tensión en ${n.html}`, unidad: 'V' }, peso: e.designador ? 2 : 1.5 });
    }
  }
  return r;
}
function cambiablesFigura(esq) {
  const r = [];
  for (const e of elementosCircuito(esq)) {
    if (!CAMBIABLE.has(e.rol) || !e.valor || e.discontinuo) continue;
    const n = nombrePieza(esq, e);
    if (!n.unico) continue;
    const unidad = e.rol === 'R' ? 'Ω' : e.rol === 'I' ? 'A' : 'V';
    r.push({ c: { id: e.id, nombre: n.html, unidad, de: e.valor }, peso: e.rol === 'R' ? (e.designador ? 2 : 1.5) : 1, designado: !!e.designador && n.html.includes('<sub>') });
  }
  return r;
}

async function opFigura(esq, cambio) {
  const { texto, meta } = circ.netlistFigura(esq, cambio);
  simulaciones++;
  const sim = await simularTexto(texto);
  return circ.resultadoFigura(esq, meta, sim);
}

function preguntaPrediccion(c, factor, o) {
  const verbo = factor > 1 ? 'duplica' : 'reduce a la mitad';
  return `Si ${verbo} ${c.nombre} (de ${valorTexto(c.de, c.unidad)} a ${valorTexto(c.de * factor, c.unidad)}), ¿${o.nombre} aumenta, disminuye o se queda igual?`;
}

const RONDA = (x) => Number(x.toPrecision(2));

async function circuitoFigura({ p, sec, top, fig }, esq, k) {
  const fuente = { k: 'figura', datos: fig.datos, esquema: k, figura: fig.label, num: fig.num, src: fig.src, vista: fig.svg_vista, recorte: recorteDe(fig, esq) };
  const base = await opFigura(esq, null);
  if (!base) return null;
  const obs = observablesFigura(esq);
  const cams = cambiablesFigura(esq);
  const res = { pred: [], desl: [] };
  for (const { c, peso: pc } of cams) {
    for (const factor of [2, 0.5]) {
      const op = await opFigura(esq, { id: c.id, valor: c.de * factor });
      if (!op) continue;
      for (const { o, peso: po } of obs) {
        if (o.id === c.id) continue; // the changed part's own current or voltage: too obvious
        const a = circ.leerEnFigura(base, o);
        const b = circ.leerEnFigura(op, o);
        if (a == null || b == null || (a !== 0 && b !== 0 && Math.sign(a) !== Math.sign(b))) continue;
        if (o.unidad === 'A' && Math.max(Math.abs(a), Math.abs(b)) < 1e-6) continue;
        const s = circ.sentido(a, b, o.unidad);
        const rel = Math.abs(b - a) / Math.max(Math.abs(a), Math.abs(b), 1e-12);
        const peso = pc + po + (s === 'igual' ? 0.5 : rel >= 0.05 ? 2 : -5) + (s === 'sube' ? 0.6 : 0) + (factor > 1 ? 0.2 : 0);
        res.pred.push({ peso, c, factor, o, a, b, s });
      }
    }
  }
  // Sliders: resistors swept over E12 ×0,1…×10; a target that is reached by one to three values, not by the book's.
  for (const { c, peso: pc, designado } of cams) {
    if (c.unidad !== 'Ω' || !designado) continue;
    const valores = serieE12(c.de / 10, c.de * 10);
    if (valores.length < 8) continue;
    const lecturas = [];
    for (const v of valores) {
      const op = Math.abs(v - c.de) / c.de < 1e-6 ? base : await opFigura(esq, { id: c.id, valor: v });
      lecturas.push(op);
    }
    for (const { o, peso: po } of obs) {
      if (o.id === c.id) continue;
      const ys = lecturas.map((op) => (op ? circ.leerEnFigura(op, o) : null));
      const y0 = circ.leerEnFigura(base, o);
      if (y0 == null || ys.some((y) => y == null)) continue;
      const elegido = objetivoDeslizador(valores, ys, c.de, y0);
      if (elegido) res.desl.push({ peso: pc + po, c, o, valores, ...elegido, antes: y0 });
    }
  }
  return { fuente, res };
}

/** A target for a slider: the reading at an E12 value 3–6 steps away from the book's, rounded to 2 figures. */
function objetivoDeslizador(valores, ys, libro, y0) {
  const i0 = valores.findIndex((v) => Math.abs(v - libro) / libro < 0.02);
  const tol = 0.05;
  const rango = Math.max(...ys.map(Math.abs)) / Math.max(1e-15, Math.min(...ys.map(Math.abs)));
  if (!(rango >= 1.5)) return null;
  for (const paso of [4, -4, 5, -5, 3, -3, 6, -6]) {
    const j = (i0 < 0 ? Math.floor(valores.length / 2) : i0) + paso;
    if (j < 0 || j >= valores.length) continue;
    const objetivo = RONDA(ys[j]);
    if (!objetivo || Math.abs(objetivo - y0) / Math.abs(objetivo) < 0.2) continue;
    const aciertan = valores.filter((_, k) => Math.abs(ys[k] - objetivo) <= Math.abs(objetivo) * tol);
    if (!aciertan.length || aciertan.length > 3) continue;
    if (aciertan.some((v) => Math.abs(v - libro) / libro < 0.02)) continue;
    return { objetivo, aciertan, tol };
  }
  return null;
}

const circuitosPorSeccion = new Map(); // «parte/sec» → {pred:[], desl:[]} candidates with their placement
function anotarCircuito(p, sec, top, ref, fuente, res, citas) {
  const k = `${p}/${sec.label}`;
  const e = circuitosPorSeccion.get(k) ?? circuitosPorSeccion.set(k, { pred: [], desl: [] }).get(k);
  for (const x of res.pred) e.pred.push({ ...x, p, sec, top, ref, fuente, citas });
  for (const x of res.desl) e.desl.push({ ...x, p, sec, top, ref, fuente, citas });
}

if (simularTexto) {
  for (const f of figurasEsquema) {
    const d = datosDe(f.fig.datos);
    for (const [k, esq] of (d.esquemas ?? []).entries()) {
      if (!esq.simulacion?.simulable || !esq.simulacion.op) continue;
      if (esq.elementos.some((e) => ONDAS.has(e.rol))) {
        descartar('esquema simulable con fuentes alternas o de pulsos (su punto de trabajo no enseña nada)');
        continue;
      }
      const r = await circuitoFigura(f, esq, k);
      if (!r) continue;
      anotarCircuito(f.p, f.sec, f.top, f.fig.label, r.fuente, r.res, citaFigura(f.p, f.sec, f.fig, f.top));
    }
  }
}

// ---------------------------------------------------------------- 2c. predictions and sliders (book netlists)

/** Two-terminal elements, diodes and BJTs of a netlist (top level) with what can be observed of them. */
function elementosNetlist(texto) {
  const { lineas } = lineasNetlist(texto);
  const modelosLed = new Set();
  for (const l of lineas) {
    if (l.tokens[0]?.toLowerCase() === '.model' && /led/i.test(l.texto)) modelosLed.add(l.tokens[1]?.toLowerCase());
  }
  const r = [];
  for (const l of lineas) {
    if (l.subckt) continue;
    const n = l.tokens[0];
    if (!n || n.startsWith('.')) continue;
    const t = n[0].toUpperCase();
    if (t === 'R' && l.tokens.length >= 4) r.push({ nombre: n, tipo: 'R', nodos: [l.tokens[1], l.tokens[2]] });
    else if (t === 'D' && l.tokens.length >= 4) {
      const led = modelosLed.has(l.tokens[3]?.toLowerCase()) || /led/i.test(l.tokens[3] ?? '');
      r.push({ nombre: n, tipo: led ? 'LED' : 'D', nodos: [l.tokens[1], l.tokens[2]] });
    } else if (t === 'Q' && l.tokens.length >= 5) r.push({ nombre: n, tipo: 'Q', nodos: [l.tokens[1], l.tokens[2], l.tokens[3]] });
  }
  return r;
}

/** Netlist instance names that read as the book's designators (R1, RC, Rf, D1, Q2…), not variants (R1a, Rd_a). */
const nombreLibro = (n) => /^[A-Za-z][A-Za-z]{0,2}[0-9]{0,2}$/.test(n) && !/^[A-Za-z][0-9]+[a-z]$/.test(n);

function observablesNetlist(texto, vectores) {
  const els = elementosNetlist(texto).filter((e) => nombreLibro(e.nombre));
  const leds = els.filter((e) => e.tipo === 'LED');
  const r = [];
  for (const e of els) {
    const html = designadorHtml(e.nombre);
    if (e.tipo === 'LED' || e.tipo === 'D') {
      const vec = `i(@${e.nombre.toLowerCase()}[id])`;
      if (!vectores.has(vec)) continue;
      const nombre = e.tipo === 'LED' ? (leds.length === 1 ? `el LED ${html}` : `el LED ${html}`) : `el diodo ${html}`;
      r.push({ o: { k: 'corriente', id: e.nombre, vector: vec, nombre: `la corriente por ${nombre}`, unidad: 'A' }, peso: 3 });
    } else if (e.tipo === 'Q') {
      const vec = `i(@${e.nombre.toLowerCase()}[ic])`;
      if (vectores.has(vec)) r.push({ o: { k: 'corriente', id: e.nombre, vector: vec, nombre: `la corriente de colector de ${html}`, unidad: 'A' }, peso: 2.5 });
    } else if (e.tipo === 'R') {
      const vec = `i(@${e.nombre.toLowerCase()}[i])`;
      if (vectores.has(vec)) r.push({ o: { k: 'corriente', id: e.nombre, vector: vec, nombre: `la corriente por ${html}`, unidad: 'A' }, peso: 1.5 });
      r.push({ o: { k: 'tension', id: e.nombre, nodos: e.nodos, nombre: `la tensión en ${html}`, unidad: 'V' }, peso: 1.5 });
    }
  }
  for (const n of ['out', 'vout', 'salida', 'vo', 'sal', 'vsal']) {
    if (vectores.has(`v(${n})`)) {
      r.push({ o: { k: 'nodo', id: n, nombre: `la tensión de salida, v(${n})`, unidad: 'V' }, peso: 2.5 });
      break;
    }
  }
  return r;
}

async function opNetlist(texto, cambio) {
  simulaciones++;
  const sim = await simularTexto(circ.netlistLibroOp(texto, cambio));
  if (sim.ejecucion.fallo || sim.salida.errores.length) return null;
  const g = circ.graficaOp(sim);
  return g ? circ.vectoresOp(g) : null;
}

if (simularTexto) {
  for (const [id, nl] of Object.entries(spice.netlists)) {
    if (solo && nl.parte !== solo) continue;
    if (nl.motor?.estado !== 'ok' || nl.motor?.xspice || nl.motor?.pesada || (nl.motor?.ms ?? 0) > 3000) continue;
    if (!nl.analisis.includes('op')) continue;
    const ref = nl.ref;
    const lugar = ref ? lugares.get(ref) : null;
    if (!lugar || !lugar.seccion) {
      descartar('netlist con análisis op sin lugar en una sección');
      continue;
    }
    // 1.1: an expansion's netlist (contenido/ampliaciones.py) placed in a section of the book (a problem it inserts
    // there, prob-44.D) never competes for that section's items: their ids are the 1.0 ones, so their content stays
    // the 1.0 one (cap44-pred-sec-44.13 is about prob-44.B, not prob-44.D); in a section of its own it gives new items
    if (nl.ampliacion && !refs[lugar.seccion]?.ampliacion) {
      descartar('netlist de una ampliación en una sección del libro');
      continue;
    }
    const p = lugar.parte;
    const sec = seccionDe(p, lugar.seccion);
    // A section-level netlist goes after the section's last step; anything else after its block.
    const top = refs[ref]?.tipo === 'sec' ? sec.fin - 1 : lugar.top;
    const texto = fs.readFileSync(path.join(libro, nl.fichero), 'utf8');
    const base = await opNetlist(texto, null);
    if (!base) {
      descartar('netlist cuyo punto de trabajo no se resuelve solo');
      continue;
    }
    const obs = observablesNetlist(texto, base);
    const pars = listarParametros(texto).filter((x) => !x.subckt && nombreLibro(x.elemento) && (x.tipo === 'R' || (x.tipo === 'V' && x.campo === 'dc')) && x.valor > 0);
    if (!obs.length || !pars.length) continue;
    const fuente = { k: 'netlist', id, fichero: nl.fichero, titulo: nl.titulo || nl.nombre };
    const res = { pred: [], desl: [] };
    for (const x of pars.slice(0, 8)) {
      const c = { id: x.id, nombre: x.tipo === 'R' ? designadorHtml(x.elemento) : `la fuente ${designadorHtml(x.elemento)}`, unidad: x.unidad || (x.tipo === 'R' ? 'Ω' : 'V'), de: x.valor };
      for (const factor of [2, 0.5]) {
        const m = await opNetlist(texto, { id: x.id, valor: x.valor * factor });
        if (!m) continue;
        for (const { o, peso: po } of obs) {
          if (o.id.toLowerCase() === x.elemento.toLowerCase()) continue;
          const a = circ.leerEnNetlist(base, o);
          const b = circ.leerEnNetlist(m, o);
          if (a == null || b == null || (a !== 0 && b !== 0 && Math.sign(a) !== Math.sign(b))) continue;
          if (o.unidad === 'A' && Math.max(Math.abs(a), Math.abs(b)) < 1e-6) continue;
          const s = circ.sentido(a, b, o.unidad);
          const rel = Math.abs(b - a) / Math.max(Math.abs(a), Math.abs(b), 1e-12);
          res.pred.push({ peso: (x.tipo === 'R' ? 2 : 1) + po + (s === 'igual' ? 0.5 : rel >= 0.05 ? 2 : -5) + (s === 'sube' ? 0.6 : 0) + (factor > 1 ? 0.2 : 0), c, factor, o, a, b, s });
        }
      }
    }
    // Sliders on the first resistor whose sweep moves an LED/diode current or the output.
    for (const x of pars.filter((q) => q.tipo === 'R').slice(0, 2)) {
      const valores = serieE12(x.valor / 10, x.valor * 10);
      const fuertes = obs.filter((q) => q.peso >= 2.5 && q.o.id.toLowerCase() !== x.elemento.toLowerCase());
      if (!fuertes.length || valores.length < 8) continue;
      const lecturas = [];
      for (const v of valores) lecturas.push(Math.abs(v - x.valor) / x.valor < 1e-6 ? base : await opNetlist(texto, { id: x.id, valor: v }));
      for (const { o, peso: po } of fuertes) {
        const ys = lecturas.map((m) => (m ? circ.leerEnNetlist(m, o) : null));
        const y0 = circ.leerEnNetlist(base, o);
        if (y0 == null || ys.some((y) => y == null)) continue;
        const el = objetivoDeslizador(valores, ys, x.valor, y0);
        const c = { id: x.id, nombre: designadorHtml(x.elemento), unidad: 'Ω', de: x.valor };
        if (el) res.desl.push({ peso: 2 + po, c, o, valores, ...el, antes: y0 });
      }
    }
    const citas = [];
    const cita = refs[ref]?.tipo === 'fig' ? citaFigura(p, sec, (() => {
      const bl = parte(p).bloques;
      let f = null;
      const buscar = (b) => {
        if (b.t === 'figura' && b.label === ref) f = b;
        if (Array.isArray(b.bloques)) b.bloques.forEach(buscar);
      };
      buscar(bl[lugar.top]);
      return f ?? { label: ref, pie: '' };
    })(), lugar.top) : null;
    if (cita) citas.push(...cita.filter((c) => c.html));
    else {
      const prim = [...parrafos(p, sec)].find((x) => !x.item && x.top >= lugar.top) ?? [...parrafos(p, sec)][0];
      if (prim) citas.push({ html: prim.html, ref: subDe(p, sec, prim.top), donde: donde(subDe(p, sec, prim.top)) });
    }
    anotarCircuito(p, sec, top, ref, fuente, res, citas);
  }
}

// One prediction and one slider per section (the best candidates).
for (const [, e] of circuitosPorSeccion) {
  const pred = e.pred.filter((x) => x.peso > 0).sort((a, b) => b.peso - a.peso || String(a.c.id).localeCompare(String(b.c.id)) || a.o.id.localeCompare(b.o.id));
  // Prefer a figure (its live drawing shows the change); then the best netlist.
  const mejorP = pred.find((x) => x.fuente.k === 'figura') ?? pred[0];
  if (mejorP) {
    const x = mejorP;
    const antesT = valorTexto(x.a, x.o.unidad);
    poner({
      id: `${x.p}-pred-${x.sec.label}`,
      tipo: 'prediccion',
      parte: x.p,
      seccion: x.sec.label,
      bloque: x.top,
      ref: x.ref,
      verRef: verRef(x.ref),
      enunciado: preguntaPrediccion(x.c, x.factor, x.o),
      citas: x.citas,
      pistas: [
        { titulo: 'Lo que dice el libro', html: x.citas[0]?.html ?? '' },
        { titulo: 'El punto de partida', html: `Con los valores del libro, ${x.o.nombre} es ${antesT}.` },
      ].filter((q) => q.html),
      fuente: x.fuente,
      cambio: x.c,
      a: x.c.de * x.factor,
      observa: x.o,
      esperado: { antes: x.a, despues: x.b, respuesta: x.s },
    });
  }
  const desl = e.desl.sort((a, b) => b.peso - a.peso || String(a.c.id).localeCompare(String(b.c.id)) || a.o.id.localeCompare(b.o.id));
  const mejorD = desl.find((x) => x.fuente.k === 'figura') ?? desl[0];
  if (mejorD) {
    const x = mejorD;
    const objT = valorTexto(x.objetivo, x.o.unidad);
    const subir = Math.abs(x.objetivo) > Math.abs(x.antes);
    poner({
      id: `${x.p}-desl-${x.sec.label}`,
      tipo: 'deslizador',
      parte: x.p,
      seccion: x.sec.label,
      bloque: x.top,
      ref: x.ref,
      verRef: verRef(x.ref),
      enunciado: `Ajuste ${x.c.nombre} hasta que ${x.o.nombre} sea de ${objT}.`,
      citas: x.citas,
      pistas: [
        { titulo: 'Lo que dice el libro', html: x.citas[0]?.html ?? '' },
        { titulo: 'El punto de partida', html: `Con ${x.c.nombre} = ${valorTexto(x.c.de, x.c.unidad)} (el valor del libro), ${x.o.nombre} es ${valorTexto(x.antes, x.o.unidad)}: hay que ${subir ? 'subirla' : 'bajarla'}.` },
      ].filter((q) => q.html),
      fuente: x.fuente,
      cambio: x.c,
      valores: x.valores,
      observa: x.o,
      objetivo: x.objetivo,
      tol: x.tol,
      aciertan: x.aciertan,
      antes: x.antes,
    });
  }
}

// ---------------------------------------------------------------- 2d. breadboard: complete the circuit

for (const f of figurasEsquema) {
  const d = datosDe(f.fig.datos);
  for (const [k, esq] of (d.esquemas ?? []).entries()) {
    if (!esq.simulacion?.simulable) continue;
    const titulo = `Figura ${f.fig.num}`;
    let doc;
    try {
      doc = montajeCompleto(esq, titulo, f.fig.label);
    } catch {
      descartar('esquema que la protoboard no sabe montar');
      continue;
    }
    if (verificarMontaje(doc).length) {
      descartar('montaje automático que no verifica');
      continue;
    }
    // A two-leg part (LED, diode, resistor) lifted off the board, or a jumper between two holes of the board
    // whose absence splits a net; parts and wires alternate between figures so both kinds are practised.
    const opciones = [];
    const piezas = doc.piezas.filter((p) => p.pos.length === 2 && ['led', 'diodo', 'zener', 'resistencia'].includes(p.enc));
    piezas.sort((a, b) => ['led', 'diodo', 'zener', 'resistencia'].indexOf(a.enc) - ['led', 'diodo', 'zener', 'resistencia'].indexOf(b.enc));
    for (const p of piezas) opciones.push({ k: 'pieza', id: p.id, nombre: designadorHtml(p.comp.nombre) });
    doc.cables.forEach((w, i) => {
      if (w.a[1] >= 0 && w.b[1] >= 0) opciones.push({ k: 'cable', i });
    });
    const turno = figurasEsquema.indexOf(f) % 2 === 0 ? 'pieza' : 'cable';
    opciones.sort((a, b) => (a.k === turno ? 0 : 1) - (b.k === turno ? 0 : 1));
    const quitar = opciones.find((q) => montajeIncompleto(doc, q));
    if (!quitar) {
      descartar('montaje sin cable ni pieza que quitar');
      continue;
    }
    poner({
      id: `${f.p}-proto-${f.fig.label}-${k}`,
      tipo: 'protoboard',
      parte: f.p,
      seccion: f.sec.label,
      bloque: f.top,
      ref: f.fig.label,
      verRef: verRef(f.fig.label),
      enunciado:
        quitar.k === 'cable'
          ? `En este montaje del circuito de ${nombreFigura(f.fig)} falta un cable. Póngalo donde va.`
          : `En este montaje del circuito de ${nombreFigura(f.fig)} falta una pieza, ${quitar.nombre}: colóquela en su sitio.`,
      citas: citaFigura(f.p, f.sec, f.fig, f.top),
      pistas: [
        { titulo: 'El esquema del libro', html: `Figura ${f.fig.num}. ${f.fig.pie}` },
        { titulo: 'Dónde va', html: pistaMontaje(doc, quitar) },
      ],
      figura: { label: f.fig.label, num: f.fig.num, src: f.fig.src, vista: f.fig.svg_vista, datos: f.fig.datos, esquema: k, pie: f.fig.pie, titulo, recorte: recorteDe(f.fig, esq) },
      quitar,
    });
    break; // one per figure
  }
}

// Review 11a: the ids of «ordenar» items were `<parte>-orden-<section>-<index of the list in the part>`: an expansion
// that inserts blocks before a list (contenido/ampliaciones.py: cap24, cap31, cap33, cap44) changed it, and with it the
// keys of the reader's progress (store «practica», XP «pr:», mastery, spaced review). Now:
//   1. the registry contenido/ids_practica.json: the list's fingerprint (part, section, its steps as plain text with each
//      reference as its label, so a renumbering does not change it) → the id it was published with (seeded with every
//      id of 1.0 and of 1.1). When the author pastes an expansion into the book, its blocks lose their mark and the
//      indices after them shift, but the fingerprints do not: the published ids stay;
//   2. a list not in the registry (new content): a list of the book, the index counting only the book's own blocks —
//      blocks marked `ampliacion` are skipped, so it keeps its 1.0 index while an expansion is merged; a list of an
//      expansion (itself marked), its index in the part, as before (registered: it survives the paste). Such an id
//      (a list added after the registry was last updated) WOULD shift once an insertion before it becomes part of the
//      book: «node scripts/practica10.mjs --registrar-ids» adds the current ids to the registry (run it whenever new
//      content is published); the run says how many are not registered;
//   3. an id already given in the part (two identical lists, or an index id equal to a registered one) gets «-2», «-3»…
const REGISTRO_IDS = process.env.EPA_IDS_PRACTICA ? path.resolve(process.env.EPA_IDS_PRACTICA) : path.join(web, '..', 'contenido', 'ids_practica.json');
const registroIds = fs.existsSync(REGISTRO_IDS) ? JSON.parse(fs.readFileSync(REGISTRO_IDS, 'utf8')) : { version: 1, orden: {} };
const { createHash } = await import('node:crypto');
const huellaPasos = (pasos) =>
  pasos.map((x) => plano(String(x).replace(/<a class="ref" data-ref="([^"]+)">[^<]*<\/a>/g, '[$1]')).replace(/\s+/g, ' ').trim()).join('\n');
function huellaOrden(p, seccion, pasos) {
  return createHash('sha1').update(`${p}|${seccion}|${huellaPasos(pasos)}`).digest('hex').slice(0, 16);
}
/** Block index → its index among the book's own blocks (those without `ampliacion`); an expansion's block, its own. */
function indicesDelLibro(bl) {
  const r = [];
  let n = 0;
  bl.forEach((b, i) => {
    r.push(b.ampliacion ? i : n);
    if (!b.ampliacion) n++;
  });
  return r;
}
const huellasOrden = new Map(); // id → fingerprint (this run)
const sinRegistrar = [];
function idOrden(p, seccion, pasos, indice) {
  const h = huellaOrden(p, seccion, pasos);
  let id = registroIds.orden[h];
  if (!id) {
    id = `${p}-orden-${seccion}-${indice}`;
    sinRegistrar.push(h);
  }
  huellasOrden.set(id, h);
  return id;
}
/** Rule 3 above, per part: a registered id is never taken by another list. */
function idsUnicos(lista) {
  const registrados = new Set(lista.filter((x) => x.tipo === 'ordenar' && registroIds.orden[huellasOrden.get(x.id)] === x.id).map((x) => x.id));
  const usados = new Set();
  for (const x of lista) {
    if (x.tipo !== 'ordenar') continue;
    const propio = registrados.has(x.id) && !usados.has(x.id);
    if (!propio && (usados.has(x.id) || registrados.has(x.id))) {
      let k = 2;
      while (usados.has(`${x.id}-${k}`) || registrados.has(`${x.id}-${k}`)) k++;
      const h = huellasOrden.get(x.id);
      x.id = `${x.id}-${k}`;
      huellasOrden.set(x.id, h);
    }
    usados.add(x.id);
  }
}

// ================================================================== 3. ordered lists of the book

for (const p of ordenPartes) {
  if (solo && p !== solo) continue;
  const bl = parte(p).bloques;
  const delLibro = indicesDelLibro(bl);
  for (const sec of seccionesDe.get(p)) {
    for (let i = sec.h2 + 1; i < sec.fin; i++) {
      const b = bl[i];
      if (b.t !== 'lista' || !b.ordenada || b.nivel) continue;
      const largos = b.items.map((x) => plano(x).length);
      // a list of questions (the self-assessment appendix) is not a procedure
      if (b.items.some((x) => /\?\s*$/.test(plano(x)))) {
        descartar('lista numerada de preguntas, no de pasos');
        continue;
      }
      if (b.items.length < 3 || b.items.length > 8 || Math.max(...largos) > 260 || new Set(b.items.map(plano)).size !== b.items.length) {
        descartar('lista numerada demasiado corta, larga o con elementos repetidos');
        continue;
      }
      // nested items of the list (nivel 1 right after) would be lost: skip those lists
      if (bl[i + 1]?.t === 'lista' && bl[i + 1].nivel) continue;
      // context: the book's sentence that introduces the list, else the title of the (sub)section it is in
      let prev = null;
      for (let j = i - 1; j > sec.h2 && j >= i - 2; j--) {
        if (bl[j].t === 'p') {
          prev = bl[j].html;
          break;
        }
        if (bl[j].t === 'h3' || bl[j].t === 'h4') break;
      }
      if (!prev) for (let j = i - 1; j >= sec.h2; j--) if (['h2', 'h3', 'h4'].includes(bl[j].t)) {
        prev = `<strong>${bl[j].html}</strong>`;
        break;
      }
      const ref = subDe(p, sec, i);
      poner({
        // (review 11a: the id stays the one this list had — idOrden: the registry, else the index without expansions)
        id: idOrden(p, sec.label, b.items, delLibro[i]),
        tipo: 'ordenar',
        parte: p,
        seccion: sec.label,
        bloque: i,
        ref,
        verRef: verRef(ref),
        // the book's sentence that introduces the list (the app adds «Ordene los pasos como los da el libro»)
        enunciado: prev ?? '',
        citas: [{ html: b.items.map((x, k) => `${k + 1}. ${x}`).join('<br>'), ref, donde: donde(ref) }],
        pistas: [
          { titulo: 'El primer paso', html: b.items[0] },
          { titulo: 'El último paso', html: b.items[b.items.length - 1] },
        ],
        pasos: b.items,
      });
    }
  }
}

// ================================================================== 4. matching pairs from the glossary

const glosPorSeccion = new Map(); // «parte/sec» → [{entrada, top}]
glosario.forEach((e) => {
  const secs = new Map();
  for (const v of e.ver ?? []) {
    const l = lugares.get(v);
    if (!l?.seccion) continue;
    const k = `${l.parte}/${l.seccion}`;
    if (!secs.has(k)) secs.set(k, l.top);
  }
  for (const [k, top] of secs) (glosPorSeccion.get(k) ?? glosPorSeccion.set(k, []).get(k)).push({ e, top });
});

for (const [k, lista] of glosPorSeccion) {
  const [p, label] = k.split('/');
  if (solo && p !== solo) continue;
  const sec = seccionDe(p, label);
  if (!sec) continue;
  // terms ↔ definitions (first sentence of the glossary entry)
  const defs = [];
  const vistos = new Set();
  for (const { e } of lista) {
    const b = primeraFrase(e.html);
    if (b.length < 25 || vistos.has(b) || plano(e.termino_html ?? e.termino).length > 50) continue;
    // the definition must not give the term away
    if (b.toLowerCase().includes(plano(e.termino).toLowerCase())) continue;
    vistos.add(b);
    defs.push({ a: e.termino_html ?? esc(e.termino), b: esc(b), glosario: e.id });
    if (defs.length === 4) break;
  }
  if (defs.length >= 3) {
    poner({
      id: `${p}-parejas-${label}`,
      tipo: 'parejas',
      parte: p,
      seccion: label,
      bloque: sec.fin - 1,
      ref: label,
      verRef: verRef(label),
      enunciado: 'Una cada término con su definición del glosario del libro.',
      citas: defs.map((x) => ({ html: `<strong>${x.a}</strong>: ${glosario.find((g) => g.id === x.glosario).html}`, ref: label, donde: 'Glosario' })),
      pistas: [{ titulo: 'Una pareja resuelta', html: `<strong>${defs[0].a}</strong>: ${defs[0].b}` }],
      modo: 'definicion',
      pares: defs,
    });
  } else descartar('sección con menos de 3 términos del glosario para unir');
  // symbols ↔ components
  const sims = [];
  const claves = new Set();
  for (const { e } of lista) {
    const s = glosImagenes[e.id]?.s;
    if (!s || !esClaveSimbolo(s) || claves.has(s) || s === 'TIERRA') continue;
    claves.add(s);
    sims.push({ a: s, b: e.termino_html ?? esc(e.termino), simbolo: s, glosario: e.id });
    if (sims.length === 4) break;
  }
  if (sims.length >= 3) {
    poner({
      id: `${p}-simbolos-${label}`,
      tipo: 'parejas',
      parte: p,
      seccion: label,
      bloque: sec.fin - 1,
      ref: label,
      verRef: verRef(label),
      enunciado: 'Una cada símbolo con su componente.',
      citas: sims.map((x) => ({ html: `<strong>${x.b}</strong>: ${glosario.find((g) => g.id === x.glosario).html}`, ref: label, donde: 'Glosario' })),
      pistas: [{ titulo: 'Una pareja resuelta', html: `El primer símbolo es: <strong>${sims[0].b}</strong>` }],
      modo: 'simbolo',
      pares: sims,
    });
  }
}

// ================================================================== 5. key ideas of each section

function ideasDe(p, sec) {
  const bl = parte(p).bloques;
  const r = [];
  for (let i = sec.h2 + 1; i < sec.fin && r.length < 3; i++) {
    const b = bl[i];
    if (b.t === 'caja' && ['importante', 'nota', 'precaucion'].includes(b.tipo)) {
      const ps = b.bloques.filter((x) => x.t === 'p');
      if (!ps.length) continue;
      let html = ps[0].html;
      if (plano(html).length > 420) continue;
      r.push({ k: 'caja', tipo: b.tipo, html, ref: subDe(p, sec, i) });
    }
  }
  for (const f of porParteF.get(p) ?? []) {
    if (f.seccion.label !== sec.label || r.filter((x) => x.k === 'formula').length >= 3) continue;
    r.push({ k: 'formula', nombre: f.nombre, svg: f.svg, w: f.w, h: f.h, ref: f.sub && refs[f.sub] ? f.sub : sec.label, calc: f.id });
  }
  if (!r.some((x) => x.k === 'formula')) {
    for (let i = sec.h2 + 1; i < sec.fin; i++) {
      const b = bl[i];
      if (b.t !== 'tarjeta') continue;
      const svgs = b.bloques.filter((x) => x.t === 'ec').slice(0, 4).map((x) => ({ svg: x.svg, w: x.w, h: x.h }));
      if (svgs.length) r.push({ k: 'tarjeta', svgs, ref: subDe(p, sec, i) });
      break;
    }
  }
  const glos = (glosPorSeccion.get(`${p}/${sec.label}`) ?? []).slice(0, 6 - r.length > 3 ? 3 : Math.max(1, 6 - r.length));
  for (const { e } of glos) r.push({ k: 'definicion', termino: e.termino_html ?? esc(e.termino), html: esc(primeraFrase(e.html, 240)), glosario: e.id });
  return r.slice(0, 6);
}

// ================================================================== 6. lesson selection and output

const PRIORIDAD = { prediccion: 0, deslizador: 1, protoboard: 2, numerico: 3, toque: 4, ordenar: 5, parejas: 6 };
const MAX_LECCION = 4;

fs.mkdirSync(salidaDir, { recursive: true });
// The later steps' items (retos10, averias10) already in a part file are kept, with their place in the lessons, so
// that rerunning this step alone leaves the whole chain's output as it was (QA 1.0: idempotent, one order).
const { ordenarPractica, recontarIndice, TIPOS_POSTERIORES } = await import('./libro-node.mjs');
const heredadosDe = (p) => {
  const f = path.join(salidaDir, `${p}.json`);
  if (!fs.existsSync(f)) return { items: [], secciones: [] };
  const viejo = JSON.parse(fs.readFileSync(f, 'utf8'));
  const items = viejo.items.filter((x) => TIPOS_POSTERIORES.includes(x.tipo));
  const ids = new Set(items.map((x) => x.id));
  const secciones = Object.entries(viejo.secciones).map(([k, s]) => [k, s.items.filter((id) => ids.has(id))]).filter(([, xs]) => xs.length);
  return { items, secciones };
};
const contar = { numerico: 0, prediccion: 0, deslizador: 0, toque: 0, ordenar: 0, parejas: 0, protoboard: 0 };
const seccionesCon = { numerico: 0, prediccion: 0, deslizador: 0, toque: 0, ordenar: 0, parejas: 0, protoboard: 0, ideas: 0, alguno: 0 };
const escritas = [];
const porParte = {};
// 1.1: the practice items of a run of the book an expansion retired (contenido/ampliaciones.py, pieces «retirar»: P02
// absorbs 32.13) keep existing with their 1.0 ids while it is merged, so that what the reader answered (store
// «practica», XP «pr:», mastery, review) still has its item: the expansion's folder keeps them as published
// (practica-retirada.json); here they get the current numbers and «retirada». Not when the run is back (P02 undone).
const registroAmp = fs.existsSync(path.join(libro, 'ampliaciones.json')) ? J('ampliaciones.json') : {};
const AMPLIACIONES11 = process.env.EPA_AMPLIACIONES ? path.resolve(process.env.EPA_AMPLIACIONES) : path.join(web, '..', 'contenido', 'ampliaciones11');
function retiradosDe(p) {
  const out = [];
  for (const r of registroAmp.retiradas ?? []) {
    const f = path.join(AMPLIACIONES11, r.id, 'practica-retirada.json');
    if (r.parte !== p || r.solo_alias || !fs.existsSync(f)) continue;
    for (const x of JSON.parse(fs.readFileSync(f, 'utf8')).items) {
      if (!refs[x.seccion]?.retirada) continue;
      const it = structuredClone(x);
      it.retirada = r.id;
      it.bloque = r.pos;
      // («destinos» of the piece may say where an item's topic went: V/f to 34.6; else the alias, the destination)
      if (r.destinos?.[x.id] && refs[r.destinos[x.id]]) it.ref = r.destinos[x.id];
      it.verRef = verRef(it.ref);
      for (const c of it.citas ?? []) if (c.ref && refs[c.ref] && /^Sección /.test(c.donde ?? '')) c.donde = `Sección ${refs[c.ref].num}`;
      if (it.formula?.seccion && refs[it.formula.seccion.label]) it.formula.seccion.num = refs[it.formula.seccion.label].num;
      if (it.formula?.cap && refs[`cap-${Number(p.slice(3))}`]) it.formula.cap = refs[`cap-${Number(p.slice(3))}`].num;
      out.push(it);
    }
  }
  return out;
}
for (const p of ordenPartes) {
  if (solo && p !== solo) continue;
  const generados = items.get(p) ?? [];
  const lista = [...generados, ...retiradosDe(p).filter((x) => !generados.some((y) => y.id === x.id))].sort((a, b) => a.bloque - b.bloque || PRIORIDAD[a.tipo] - PRIORIDAD[b.tipo] || a.id.localeCompare(b.id));
  idsUnicos(lista);
  const secciones = {};
  for (const sec of seccionesDe.get(p)) {
    const suyos = lista.filter((x) => x.seccion === sec.label);
    // The lesson shows a few: one of each kind first (by priority), numeric problems with an exercise first.
    const elegidos = [];
    const porTipo = new Map();
    // symbols ↔ components and terms ↔ definitions are two kinds here (both may appear)
    const clase = (x) => (x.tipo === 'parejas' ? `parejas:${x.modo}` : x.tipo);
    for (const x of suyos) (porTipo.get(clase(x)) ?? porTipo.set(clase(x), []).get(clase(x))).push(x);
    for (const [, xs] of porTipo) xs.sort((a, b) => (b.ejercicio ? 1 : 0) - (a.ejercicio ? 1 : 0) || a.bloque - b.bloque);
    const prio = (k) => PRIORIDAD[k.split(':')[0]] + (k === 'parejas:simbolo' ? -0.5 : 0);
    const tipos = [...porTipo.keys()].sort((a, b) => prio(a) - prio(b));
    for (const t of tipos) if (elegidos.length < MAX_LECCION) elegidos.push(porTipo.get(t)[0]);
    elegidos.sort((a, b) => a.bloque - b.bloque || PRIORIDAD[a.tipo] - PRIORIDAD[b.tipo]);
    const ideas = ideasDe(p, sec);
    if (!elegidos.length && !ideas.length) continue;
    secciones[sec.label] = { items: elegidos.map((x) => x.id), ideas };
    for (const t of new Set(elegidos.map((x) => x.tipo))) seccionesCon[t]++;
    if (elegidos.some((x) => x.tipo === 'parejas' && x.modo === 'simbolo')) seccionesCon.simbolos = (seccionesCon.simbolos ?? 0) + 1;
    if (elegidos.length) seccionesCon.alguno++;
    if (ideas.length) seccionesCon.ideas++;
  }
  for (const x of lista) contar[x.tipo]++;
  if (lista.length) porParte[p] = lista.length;
  const heredados = heredadosDe(p);
  if (!lista.length && !Object.keys(secciones).length && !heredados.items.length) continue;
  for (const [k, ids] of heredados.secciones) (secciones[k] ??= { items: [], ideas: [] }).items.push(...ids);
  const doc = { version: 1, parte: p, items: [...lista, ...heredados.items], secciones };
  fs.writeFileSync(path.join(salidaDir, `${p}.json`), JSON.stringify(ordenarPractica(doc)));
  escritas.push(p);
}
if (!solo) {
  const ind = { version: 1, partes: escritas, porParte, items: contar, secciones: seccionesCon, ejercicios: enlaces, descartes };
  // the later steps' counts (and «alguno», porParte) over the kept items: the same keys, in the same place, as the chain
  recontarIndice(salidaDir, ind, TIPOS_POSTERIORES);
  fs.writeFileSync(path.join(salidaDir, 'indice.json'), JSON.stringify(ind));
}
if (registrarIds && !solo) {
  // (only adds: an id once published is never taken away; written only when it changes)
  const orden = { ...registroIds.orden };
  for (const [id, h] of huellasOrden) if (!orden[h]) orden[h] = id;
  const texto = `${JSON.stringify({ ...registroIds, version: 1, orden: Object.fromEntries(Object.entries(orden).sort(([a], [b]) => (a < b ? -1 : 1))) }, null, 1)}\n`;
  if (!fs.existsSync(REGISTRO_IDS) || fs.readFileSync(REGISTRO_IDS, 'utf8') !== texto) fs.writeFileSync(REGISTRO_IDS, texto);
} else if (sinRegistrar.length && !solo) {
  console.log(`  ids de «ordenar» sin registrar: ${sinRegistrar.length} (node scripts/practica10.mjs --registrar-ids los conserva para siempre)`);
}
const total = Object.values(contar).reduce((a, b) => a + b, 0);
console.log(`practica10: ${total} preguntas en ${escritas.length} partes · ${simulaciones} simulaciones · ejercicios enlazados ${nEjEnlazados}`);
console.log('  por tipo:', JSON.stringify(contar));
console.log('  secciones con cada tipo (lecciones):', JSON.stringify(seccionesCon));
if (detalle) console.log('  descartes:', JSON.stringify(descartes, null, 1));
