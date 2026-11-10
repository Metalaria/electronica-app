#!/usr/bin/env node
// 1.0 «Explicación de cada respuesta incorrecta»: for every wrong option of the app's choice questions — the Repaso
// questions (lessons, tests), the choice questions of the exercises (ejercicios.json `preguntas`, tipo eleccion) and
// the «Predice y comprueba» items — the passage of the book that speaks to what that option says, or «general» when
// the book gives no specific basis (the app then shows the question's general explanation; nothing is invented).
//
//   node scripts/porque10.mjs [--detalle] [--muestra N]
//
// Writes web/public/libro/porque/<parte>.json and porque/indice.json (see ESQUEMA.md, «Por qué no»). Retrieval only:
// the text shown is a sentence of the book copied as it is (HTML), with where it is. How a sentence is chosen:
//   - the option's own words: its content words (accents and case folded, a crude 5-letter stem, numbers with their
//     decimal comma) minus the words of the right answer and of the statement — what makes THIS option different;
//   - the candidates: the sentences of the section the question refers to (paragraphs, boxes, list items, captions);
//     for an exercise, its solution first; never the sentence the general explanation already quotes;
//   - the score: the inverse document frequency (over the chapter's sentences) of the option's own words found in the
//     sentence, plus a little for the statement's words and for a contrast in it («no», «sino», «en cambio»…);
//   - proposed only above a threshold: two of the option's own words (idf ≥ 4,5 together) and one of the statement's in a
//     sentence of at most 360 characters, or three own words (idf ≥ 6); tuned by reading samples (--muestra N);
//   - shown only when reviewed by hand and approved (contenido/porque_curado.json; review 10d rejected those that,
//     out of context, have no subject or argue for the option; «previa» adds the sentence before); otherwise «general». A Yes/No option has no words of its own: always «general».
// A prediction (sube / baja / igual) keeps the sentence of its section that names the changed part and says how
// something changes; the app adds the simulated numbers. Deterministic.
import fs from 'node:fs';
import path from 'node:path';
import { J, libro, ordenPartes, parte, seccionesDe, lugares, subDe, donde, plano, contenidoDir } from './libro-node.mjs';

const detalle = process.argv.includes('--detalle');
const muestra = process.argv.includes('--muestra') ? Number(process.argv[process.argv.indexOf('--muestra') + 1]) : 0;

// ------------------------------------------------------------------ words

const VACIAS = new Set(
  ('a al algo algun alguna algunas alguno algunos ante antes aqui asi aun cada casi como con contra cual cuales cuando de del desde donde dos e el ' +
    'ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estan estas este esto estos fue fueron ha han hasta hay la las le les lo ' +
    'los mas me mi mismo mucho muy nada ni o os otra otras otro otros para pero poco por porque pues que se segun ser si sin sobre solo son su sus ' +
    'tambien tan tanto te tiene tienen todo todos tras tu un una unas uno unos usted y ya vez veces cuanto cual puede pueden debe deben hace hacen ' +
    'dicho decir mientras bien mal parte forma tipo caso cosa manera mayor menor')
    .split(' '),
);
const CONTRASTE = /\b(no|sino|nunca|error|falso|en cambio|a diferencia|aunque|pero|mito|confund|equivoc|ni siquiera|en realidad|no es|no hay)\b/i;

function normal(t) {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(\d),(\d)/g, '$1.$2');
}
/** Content words of a plain text: stems of 5 letters, numbers as «#0.7». */
function palabras(texto) {
  const r = new Set();
  for (const m of normal(texto).matchAll(/[a-z0-9.ñ]+/g)) {
    let w = m[0].replace(/^\.+|\.+$/g, '');
    if (!w) continue;
    if (/^\d+(\.\d+)?$/.test(w)) {
      r.add(`#${Number(w)}`);
      continue;
    }
    if (VACIAS.has(w) || w.length < 3) continue;
    r.add(w.length > 5 ? w.slice(0, 5) : w);
  }
  return r;
}

// ------------------------------------------------------------------ sentences of the book

/** Splits a paragraph's HTML into sentences (HTML kept); a piece with unbalanced tags stays joined to the next. */
function frases(html) {
  return frasesTodas(html).filter((x) => plano(x).length >= 30);
}
/**
 * The sentences with the one before each in the same paragraph (`previa`, null for the first): a reviewed sentence
 * whose subject is only in the previous one is shown with it (porque_curado.json «previa»; review 10d).
 */
function conPrevia(html) {
  const todas = frasesTodas(html);
  return todas.map((h, i) => ({ html: h, previa: i ? todas[i - 1] : null })).filter((x) => plano(x.html).length >= 30);
}
function frasesTodas(html) {
  const r = [];
  const corte = /([.;!?])(\s+)(?=[A-ZÁÉÍÓÚÑ¿¡«(])/g;
  let ini = 0;
  let m;
  const piezas = [];
  while ((m = corte.exec(html))) {
    piezas.push(html.slice(ini, m.index + 1));
    ini = m.index + m[1].length + m[2].length;
  }
  piezas.push(html.slice(ini));
  let acc = '';
  for (const p of piezas) {
    acc = acc ? `${acc} ${p}` : p;
    if (equilibrada(acc)) {
      r.push(acc.trim());
      acc = '';
    }
  }
  if (acc) r.push(acc.trim());
  return r;
}
function equilibrada(h) {
  const pila = [];
  for (const m of h.matchAll(/<(\/?)([a-z0-9]+)\b[^>]*?(\/?)>/gi)) {
    const [, cierra, tag, auto] = m;
    if (auto || /^(br|img|hr|wbr)$/i.test(tag)) continue;
    if (cierra) {
      if (pila.pop() !== tag.toLowerCase()) return false;
    } else pila.push(tag.toLowerCase());
  }
  return pila.length === 0;
}

/** Every sentence of a section with where it is: paragraphs, boxes, list items and figure captions. */
function frasesSeccion(p, sec) {
  const bl = parte(p).bloques;
  const r = [];
  const anotar = (html, top) => {
    for (const f of conPrevia(html)) r.push({ html: f.html, previa: f.previa, top, w: palabras(plano(f.html)) });
  };
  const visitar = (b, top) => {
    if (b.t === 'p') anotar(b.html, top);
    else if (b.t === 'lista') for (const it of b.items) anotar(it, top);
    else if (b.t === 'figura' && b.pie) anotar(b.pie, top);
    if ((b.t === 'caja' || b.t === 'deduccion') && Array.isArray(b.bloques)) for (const x of b.bloques) visitar(x, top);
  };
  for (let i = sec.h2 + 1; i < sec.fin; i++) visitar(bl[i], i);
  return r.map((x) => ({ ...x, ref: subDe(p, sec, x.top) }));
}

const cacheSec = new Map();
function frasesDe(p, secLabel) {
  const k = `${p}/${secLabel}`;
  if (!cacheSec.has(k)) {
    const sec = seccionesDe.get(p).find((s) => s.label === secLabel);
    cacheSec.set(k, sec ? frasesSeccion(p, sec) : []);
  }
  return cacheSec.get(k);
}

/** idf over the chapter's sentences. */
const cacheIdf = new Map();
function idfDe(p) {
  if (cacheIdf.has(p)) return cacheIdf.get(p);
  const df = new Map();
  let n = 0;
  for (const sec of seccionesDe.get(p)) {
    for (const f of frasesDe(p, sec.label)) {
      n++;
      for (const w of f.w) df.set(w, (df.get(w) ?? 0) + 1);
    }
  }
  const idf = (w) => Math.log((n + 1) / ((df.get(w) ?? 0) + 0.5));
  cacheIdf.set(p, idf);
  return idf;
}

function seccionDeRef(p, ref) {
  const l = lugares.get(ref);
  if (l?.seccion && l.parte === p) return l.seccion;
  const s = seccionesDe.get(p).find((x) => x.label === ref);
  if (s) return s.label;
  // an appendix section «apG-4» or an unknown label: none
  return null;
}

const mismo = (a, b) => normal(plano(a)).replace(/\W+/g, ' ').trim() === normal(plano(b)).replace(/\W+/g, ' ').trim();
const contiene = (a, b) => {
  const x = normal(plano(a)).replace(/\W+/g, ' ').trim();
  const y = normal(plano(b)).replace(/\W+/g, ' ').trim();
  return !!y && y.length >= 25 && (x.includes(y) || y.includes(x));
};

/**
 * The book sentence for one wrong option, or null. `candidatos`: sentences in preference order (an exercise's solution
 * first); `evitar`: what the general explanation already quotes.
 */
function elegir(p, opcion, correcta, enunciado, candidatos, evitar) {
  const idf = idfDe(p);
  const propias = [...palabras(plano(opcion))];
  const fuera = new Set([...palabras(plano(correcta)), ...palabras(plano(enunciado))]);
  const D = propias.filter((w) => !fuera.has(w));
  if (!D.length) return null;
  const Q = [...palabras(plano(enunciado))];
  let mejor = null;
  for (const [orden, f] of candidatos.entries()) {
    if (evitar.some((e) => e && (mismo(f.html, e) || contiene(f.html, e)))) continue;
    const L = plano(f.html).length;
    if (L < 40 || L > 480) continue;
    const m = D.filter((w) => f.w.has(w));
    if (!m.length) continue;
    const sm = m.reduce((s, w) => s + idf(w), 0);
    const q = Q.filter((w) => f.w.has(w)).length;
    // the option's own words AND the question's topic: two and two, or three and one
    const vale = (m.length >= 2 && sm >= 4.5 && q >= 1 && L <= 360) || (m.length >= 3 && sm >= 6);
    if (!vale) continue;
    const puntos = sm + 0.35 * q + (CONTRASTE.test(plano(f.html)) ? 0.6 : 0) - 0.02 * orden + (f.solucion ? 0.8 : 0);
    if (!mejor || puntos > mejor.puntos) mejor = { f, puntos, m };
  }
  return mejor;
}

const porParte = new Map(); // parte → {repaso, ejercicios, prediccion}
const salida = (p) => {
  if (!porParte.has(p)) porParte.set(p, { version: 1, parte: p, repaso: {}, ejercicios: {}, prediccion: {} });
  return porParte.get(p);
};
const cuenta = { repaso: [0, 0], ejercicios: [0, 0], prediccion: [0, 0] };
const muestras = [];

// 1.0 review: every proposed sentence was read by hand against its question and option; only those that explain
// why THAT option is wrong are shown (contenido/porque_curado.json, «ok»). A proposal not reviewed yet — or whose
// sentence changed since — falls back to the general explanation and is listed so that it can be reviewed.
const curado = JSON.parse(fs.readFileSync(path.join(contenidoDir, 'porque_curado.json'), 'utf8')).pares;
const huella = (t) => normal(t).replace(/[^a-z0-9]+/g, '');
const pendientes = [];
const rechazadas = { n: 0 };

/** The explanation of one wrong option: the reviewed book sentence, or «general». `clave` = «R|id|i», «E|…», «P|…». */
function entrada(clave, r) {
  if (!r) return { k: 'general' };
  const c = curado[clave];
  if (!c || huella(c.frase) !== huella(plano(r.f.html).slice(0, 80))) {
    pendientes.push(`${clave}: ${plano(r.f.html).slice(0, 80)}`);
    return { k: 'general' };
  }
  if (!c.ok) {
    rechazadas.n++;
    return { k: 'general' };
  }
  // «previa»: the sentence's subject is in the one before it (same paragraph): both are shown, as the book has them
  if (c.previa && !r.f.previa) throw new Error(`porque10: ${clave} pide la frase anterior y no la hay`);
  const html = c.previa ? `${r.f.previa} ${r.f.html}` : r.f.html;
  return { k: 'libro', html, ref: r.f.ref, donde: r.f.donde ?? donde(r.f.ref) };
}
const libroDe = (x) => x.k === 'libro';

// ------------------------------------------------------------------ 1. Repaso questions

const repasoDir = path.join(libro, 'repaso');
for (const p of ordenPartes) {
  const f = path.join(repasoDir, `${p}.json`);
  if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const q of d.preguntas) {
    if (q.tipo !== 'opcion') continue;
    const secLabel = seccionDeRef(p, q.ref);
    const cand = secLabel ? frasesDe(p, secLabel) : [];
    const porOpcion = {};
    q.opciones.forEach((o, i) => {
      if (i === q.correcta) return;
      const r = cand.length ? elegir(p, o, q.opciones[q.correcta], q.enunciado, cand, [q.cita]) : null;
      porOpcion[i] = entrada(`R|${q.id}|${i}`, r);
      cuenta.repaso[libroDe(porOpcion[i]) ? 0 : 1]++;
      if (r && muestras.length < 100000) muestras.push({ id: q.id, enunciado: plano(q.enunciado), opcion: plano(o), frase: plano(r.f.html), m: r.m });
    });
    salida(p).repaso[q.id] = porOpcion;
  }
}

// ------------------------------------------------------------------ 2. choice questions of the exercises

const ejercicios = J('ejercicios.json').items;
function bloqueEjercicio(label) {
  const l = lugares.get(label);
  if (!l) return null;
  let hallado = null;
  const visitar = (b) => {
    if (b.t === 'ejercicios') for (const it of b.items) if (it.label === label) hallado = it;
    for (const x of b.bloques ?? []) visitar(x);
  };
  visitar(parte(l.parte).bloques[l.top]);
  return hallado;
}
for (const [label, ej] of Object.entries(ejercicios)) {
  // 1.1: a new exercise (not in the book yet) explains each wrong option itself (`porque` in its question)
  if (ej.nuevo) continue;
  const qs = (ej.preguntas ?? []).filter((q) => q.tipo === 'eleccion');
  if (!qs.length) continue;
  const p = ej.parte;
  const b = bloqueEjercicio(label);
  const num = b?.num ?? ej.num;
  const tipo = label.startsWith('prob') ? 'Problema' : 'Ejercicio';
  // the exercise's solution first, then its section
  const sol = [];
  const solucionDe = (bl) => {
    for (const x of bl ?? []) {
      const poner = (s) => sol.push({ html: s.html, previa: s.previa, ref: label, donde: `${tipo} ${num} · solución`, w: palabras(plano(s.html)), solucion: true });
      if (x.t === 'p') for (const s of conPrevia(x.html)) poner(s);
      else if (x.t === 'lista') for (const it of x.items) for (const s of conPrevia(it)) poner(s);
      if (Array.isArray(x.bloques)) solucionDe(x.bloques);
    }
  };
  solucionDe(b?.solucion);
  const cand = [...sol, ...(ej.seccion ? frasesDe(p, ej.seccion) : [])];
  for (const q of qs) {
    // 1.1 («razonar»): a question whose wrong options are all explained by the curated layer («porque N:» in
    // ejercicios_curado.txt → q.porque) keeps only those explanations; no automatic book sentence is proposed
    if (q.porque && q.opciones.every((_, i) => i === q.correcta || q.porque[i])) continue;
    const porOpcion = {};
    q.opciones.forEach((o, i) => {
      if (i === q.correcta) return;
      const r = elegir(p, o, q.opciones[q.correcta], q.enunciado, cand, [q.explicacion]);
      porOpcion[i] = entrada(`E|${label}/${q.id}|${i}`, r);
      cuenta.ejercicios[libroDe(porOpcion[i]) ? 0 : 1]++;
      if (r) muestras.push({ id: `${label}/${q.id}`, enunciado: plano(q.enunciado), opcion: plano(o), frase: plano(r.f.html), m: r.m });
    });
    salida(p).ejercicios[`${label}/${q.id}`] = porOpcion;
  }
}

// ------------------------------------------------------------------ 3. predictions

const CAMBIA = /\b(aument|dismin|sube|suben|baja|bajan|crece|crecen|cae|caen|mayor|menor|duplic|mitad|proporcional|inversamente|se reduce|se queda|no cambia|constante)/i;
const indPractica = J('practica/indice.json');
for (const p of indPractica.partes) {
  const d = J(`practica/${p}.json`);
  for (const it of d.items) {
    if (it.tipo !== 'prediccion') continue;
    const nombre = plano(it.cambio.nombre);
    // the part as the book writes it: «R2», «R₂», «la fuente»
    const clave = normal(nombre).replace(/[^a-z0-9]/g, '');
    const sub = nombre.replace(/^([A-Za-z])(\w+)$/, (_, a, b) => a + b.replace(/\d/g, (c) => '₀₁₂₃₄₅₆₇₈₉'[c]));
    const obs = palabras(plano(it.observa.nombre));
    let mejor = null;
    for (const f of frasesDe(p, it.seccion)) {
      const t = plano(f.html);
      const nombra = /^[A-Z]\w{0,4}$/.test(nombre) ? new RegExp(`(^|[^A-Za-z0-9])(${nombre}|${sub})(?![A-Za-z0-9])`).test(t.replace(/\s+/g, '')) || t.includes(nombre) || t.includes(sub) : false;
      if (!nombra || !CAMBIA.test(t)) continue;
      const q = [...obs].filter((w) => f.w.has(w)).length;
      const puntos = q + (f.ref && t.length < 400 ? 0.5 : 0) - Math.abs(f.top - it.bloque) * 0.01;
      if (!mejor || puntos > mejor.puntos) mejor = { f, puntos };
    }
    if (clave && mejor && it.citas.some((c) => contiene(c.html, mejor.f.html))) mejor = null;
    const porOpcion = {};
    for (const s of ['sube', 'baja', 'igual']) {
      if (s === it.esperado.respuesta) continue;
      porOpcion[s] = entrada(`P|${it.id}|${s}`, mejor);
      cuenta.prediccion[libroDe(porOpcion[s]) ? 0 : 1]++;
    }
    salida(p).prediccion[it.id] = porOpcion;
  }
}

// ------------------------------------------------------------------ write

const dir = path.join(libro, 'porque');
fs.mkdirSync(dir, { recursive: true });
for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
const partes = [];
for (const p of ordenPartes) {
  const d = porParte.get(p);
  if (!d) continue;
  fs.writeFileSync(path.join(dir, `${p}.json`), JSON.stringify(d));
  partes.push(p);
}
const total = (c) => c[0] + c[1];
fs.writeFileSync(
  path.join(dir, 'indice.json'),
  JSON.stringify({ version: 1, partes, libro: { repaso: cuenta.repaso[0], ejercicios: cuenta.ejercicios[0], prediccion: cuenta.prediccion[0] }, general: { repaso: cuenta.repaso[1], ejercicios: cuenta.ejercicios[1], prediccion: cuenta.prediccion[1] } }),
);
console.log(
  `porque10: opciones incorrectas con su frase del libro — repaso ${cuenta.repaso[0]}/${total(cuenta.repaso)}, ejercicios ${cuenta.ejercicios[0]}/${total(cuenta.ejercicios)}, predicciones ${cuenta.prediccion[0]}/${total(cuenta.prediccion)}; el resto, la explicación general (${rechazadas.n} propuestas descartadas en la revisión).`,
);
if (pendientes.length) {
  console.warn(`porque10: ${pendientes.length} propuestas sin revisar en contenido/porque_curado.json (se muestran con la explicación general):`);
  for (const x of pendientes) console.warn(`  ${x}`);
}
if (muestra) {
  // a deterministic sample for reviewing the matches by hand
  const paso = Math.max(1, Math.floor(muestras.length / muestra));
  for (let i = 0; i < muestras.length && i / paso < muestra; i += paso) {
    const x = muestras[i];
    console.log(`\n[${x.id}] ${x.enunciado}\n  ✗ ${x.opcion}\n  → ${x.frase}\n  (${x.m.join(', ')})`);
  }
}
if (detalle) console.log(JSON.stringify(cuenta));
