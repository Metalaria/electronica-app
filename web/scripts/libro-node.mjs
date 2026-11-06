// Shared helpers of the 1.0 «Brilliant» content scripts (retos10.mjs, porque10.mjs): the book's parts, sections and
// labels from web/public/libro, the plain-text and naming rules of practica10.mjs (copied here so that script keeps
// running unchanged), and the app's WebAssembly ngspice in Node. Importing this module registers the «.ts» resolver
// the app's TypeScript modules need (Node ≥ 22.6 strips the types).
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

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

export const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// EPA_LIBRO relocates the book folder (tests run the generator chain on a copy, never on web/public/libro)
export const libro = process.env.EPA_LIBRO ? path.resolve(process.env.EPA_LIBRO) : path.join(web, 'public', 'libro');
/** The repository's contenido/ folder (curated reviews), independent of EPA_LIBRO. */
export const contenidoDir = path.join(web, '..', 'contenido');
export const src = (p) => path.join(web, 'src', p);
export const J = (p) => JSON.parse(fs.readFileSync(path.join(libro, p), 'utf8'));

const { finDeSeccion } = await import(src('lib/leccion-pasos.ts'));

export const indice = J('indice.json');
export const refs = J('refs.json');

// ------------------------------------------------------------------ text helpers (as practica10.mjs)

export function plano(h) {
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
export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** «R1» → «R<sub>1</sub>». */
export function designadorHtml(d) {
  const m = /^([A-Za-z])(.+)$/.exec(d);
  if (!m) return esc(d);
  return `${esc(m[1].toUpperCase())}<sub>${esc(m[2])}</sub>`;
}

/** «$V_{out}$» → «V<sub>out</sub>». */
export function etiquetaHtml(s) {
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

/** Three significant figures, SI prefix, decimal comma, narrow space before the unit. */
export function valorTexto(v, u) {
  const P = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  const a = Math.abs(v);
  const [k, p] = a === 0 ? [1, ''] : (P.find(([k]) => a >= k * 0.9995) ?? P[P.length - 1]);
  const n = Number((v / k).toPrecision(3));
  return `${String(n).replace('.', ',').replace('-', '−')} ${p}${u}`;
}

// ------------------------------------------------------------------ the book: parts, sections, labels

export const ordenPartes = indice.tomos.flatMap((t) => t.partes).filter((p) => fs.existsSync(path.join(libro, 'partes', `${p}.json`)));
const partes = new Map();
export const parte = (p) => {
  if (!partes.has(p)) partes.set(p, J(`partes/${p}.json`));
  return partes.get(p);
};

/** label → {parte, top, seccion, h2} for every labelled block (also exercises). */
export const lugares = new Map();
/** parte → [{label, h2, fin, num, titulo}] */
export const seccionesDe = new Map();
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
export function donde(label) {
  const r = refs[label];
  if (!r) {
    const l = lugares.get(label);
    const s = l ? seccionesDe.get(l.parte).find((x) => x.label === label) : null;
    return s ? `Sección «${s.titulo}»` : 'Libro';
  }
  return `${TIPO_DONDE[r.tipo] ?? 'Sección'} ${r.num}`;
}
export function verRef(label) {
  const r = refs[label];
  if (!r) return 'la sección en el libro';
  return `${ARTICULO[r.tipo] ?? 'la sección'} ${r.num}`;
}

/** The h3 label that contains a top-level block of a section, or the section's label. */
export function subDe(p, sec, top) {
  const bl = parte(p).bloques;
  for (let i = top; i > sec.h2; i--) if (bl[i].t === 'h3' && bl[i].label && refs[bl[i].label]) return bl[i].label;
  return sec.label;
}

export function seccionDe(p, label) {
  return seccionesDe.get(p).find((s) => s.label === label);
}

/** Paragraphs (top level, inside boxes and derivations, list items) of a section with their top-level index. */
export function* parrafos(p, sec) {
  const bl = parte(p).bloques;
  for (let i = sec.h2 + 1; i < sec.fin; i++) {
    const b = bl[i];
    if (b.t === 'p') yield { html: b.html, top: i };
    else if (b.t === 'caja' || b.t === 'deduccion') {
      for (const x of b.bloques) if (x.t === 'p') yield { html: x.html, top: i };
    } else if (b.t === 'lista') for (const it of b.items) yield { html: it, top: i, item: true };
  }
}

/** The paragraph that cites a label inside a section (the nearest to `cerca`). */
export function parrafoQueCita(p, sec, label, cerca = null) {
  const marca = `data-ref="${label}"`;
  let mejor = null;
  for (const x of parrafos(p, sec)) {
    if (!x.html.includes(marca) || x.item) continue;
    const d = cerca == null ? 0 : Math.abs(x.top - cerca);
    if (!mejor || d < mejor.d) mejor = { ...x, d };
  }
  return mejor ? { html: mejor.html, ref: subDe(p, sec, mejor.top), donde: donde(subDe(p, sec, mejor.top)), top: mejor.top } : null;
}

/** The book's explanation for a figure: the paragraph that cites it (nearest), and its caption. */
export function citaFigura(p, sec, fig, top) {
  const c = parrafoQueCita(p, sec, fig.label, top);
  const pie = { html: fig.pie, ref: fig.label, donde: donde(fig.label) };
  if (!c) return [pie];
  const { top: _t, ...cita } = c;
  return [cita, pie];
}

// ------------------------------------------------------------------ quantities written in the book

const PREF = { p: 1e-12, n: 1e-9, µ: 1e-6, μ: 1e-6, u: 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9 };
const reCant = /(?<![\w,.])((?:\d{1,3}(?:[   ]\d{3})+|\d+)(?:,\d+)?)\s?(p|n|µ|μ|u|m|k|M|G)?(Ω|Hz|VA|Wh|Ah|V|A|W|F|H|s|J|C|S)(?![\wΩ])/g;
/** Every «3,3 V», «10 mA», «4,7 kΩ» of a plain text: [{valor, unidad, texto}]. */
export function cantidades(t) {
  const r = [];
  for (const m of t.replace(/[  ]/g, ' ').matchAll(reCant)) {
    const n = Number(m[1].replace(/[   ]/g, '').replace(',', '.'));
    r.push({ valor: n * (m[2] ? PREF[m[2]] : 1), unidad: m[3], texto: m[0] });
  }
  return r;
}

// ------------------------------------------------------------------ names (the rules of practica10.mjs)

export const NOMBRE_ROL = {
  R: 'la resistencia', POT: 'el potenciómetro', C: 'el condensador', L: 'la bobina', D: 'el diodo', DZ: 'el diodo Zener',
  LED: 'el LED', PD: 'el fotodiodo', QN: 'el transistor', QP: 'el transistor', QPHOTO: 'el fototransistor', MN: 'el MOSFET',
  MP: 'el MOSFET', JN: 'el JFET', JP: 'el JFET', OA: 'el amplificador operacional', V: 'la fuente de tensión',
  BAT: 'la pila', I: 'la fuente de corriente', VSIN: 'el generador de señal', VPULSE: 'el generador de pulsos', SW: 'el interruptor',
  LAMP: 'la lámpara', SPK: 'el altavoz', FUSE: 'el fusible', XFMR: 'el transformador', AM: 'el amperímetro', VM: 'el voltímetro',
};
export const PIEZA = new Set(Object.keys(NOMBRE_ROL));
export const grupoRol = (r) => ({ QN: 'Q', QP: 'Q', MN: 'M', MP: 'M', JN: 'J', JP: 'J', V: 'F', BAT: 'F', 'V?': 'F' })[r] ?? r;

export function nombrePieza(todos, e) {
  // a resistor drawn as a load labelled by its voltage and current («2,8 V / 50 mA») is not named by that label
  if (e.rol === 'R' && !e.designador && e.valor_texto && !/Ω/.test(e.valor_texto)) return { html: '', unico: false, designado: false };
  const circuito = todos.flatMap((q) => q.elementos).filter((x) => PIEZA.has(x.rol) && !x.discontinuo);
  if (e.designador && /^[A-Za-z][A-Za-z0-9]*$/.test(e.designador) && circuito.filter((x) => x.designador === e.designador).length === 1)
    return { html: designadorHtml(e.designador), unico: true, designado: e.designador.length > 1 };
  const mismos = circuito.filter((x) => grupoRol(x.rol) === grupoRol(e.rol));
  if (mismos.length === 1 && NOMBRE_ROL[e.rol]) return { html: NOMBRE_ROL[e.rol], unico: true, designado: false };
  if (e.valor_texto && NOMBRE_ROL[e.rol]) {
    const igual = mismos.filter((x) => x.valor_texto === e.valor_texto);
    if (igual.length === 1) return { html: `${NOMBRE_ROL[e.rol]} de ${esc(e.valor_texto)}`, unico: true, designado: false };
  }
  return { html: NOMBRE_ROL[e.rol] ?? '', unico: false, designado: false };
}
export function etiquetaNodo(todos, n) {
  if (n.tierra) return null;
  for (const e of n.etiquetas ?? []) {
    const h = etiquetaHtml(e);
    if (!h || /^\d+$/.test(plano(h))) continue;
    const otros = todos.flatMap((q) => q.nodos).filter((m) => m !== n && (m.etiquetas ?? []).some((x) => etiquetaHtml(x) === h));
    if (!otros.length) return h;
  }
  return null;
}
export function recorteDe(fig, esq) {
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
  const m = Math.max(22, 0.14 * Math.max(x1 - x0, y1 - y0));
  x0 = Math.max(vx, x0 - m);
  y0 = Math.max(vy, y0 - m);
  x1 = Math.min(vx + vw, x1 + m);
  y1 = Math.min(vy + vh, y1 + m);
  if ((x1 - x0) * (y1 - y0) > 0.8 * vw * vh) return null;
  return [x0, y0, x1 - x0, y1 - y0].map((v) => Number(v.toFixed(2)));
}

// QA 1.0 (findings 2 and 3): the crop a challenge or a fault case SHOWS, with the book's annotations to hide in it
// (src/componentes/practica/encuadre.ts). recorteDe above still decides the naming scope (which drawings count).
const { objetosDeSvg, encuadre } = await import(src('componentes/practica/encuadre.ts'));
const objetosFig = new Map();
export function encuadreDe(fig, esq) {
  if (!objetosFig.has(fig.src)) objetosFig.set(fig.src, objetosDeSvg(fs.readFileSync(path.join(libro, fig.src), 'utf8')));
  return encuadre(fig.svg_vista, esq, objetosFig.get(fig.src));
}

// ------------------------------------------------------------------ practice files: one canonical order

// Every step of practica10 → retos10 → averias10 owns some item types and rewrites only those; whichever steps are
// rerun, a part file must come out the same. The order is the chain's: practica10's items, then retos10's (construye,
// reto, in its generation order), then averias10's. Array.prototype.sort is stable, so each group keeps its order.
// (key order = the order the chain adds their counts to practica/indice.json)
const GRUPO_TIPO = { reto: 1, construye: 1, averia: 2 };
export const grupoTipo = (t) => GRUPO_TIPO[t] ?? 0;
/** Types written by retos10/averias10 (practica10 keeps them when it rewrites a part). */
export const TIPOS_POSTERIORES = Object.keys(GRUPO_TIPO);

export function ordenarPractica(d) {
  d.items.sort((a, b) => grupoTipo(a.tipo) - grupoTipo(b.tipo));
  const tipo = new Map(d.items.map((x) => [x.id, x.tipo]));
  for (const s of Object.values(d.secciones)) s.items.sort((a, b) => grupoTipo(tipo.get(a)) - grupoTipo(tipo.get(b)));
  return d;
}

/**
 * Recount practica/indice.json after a step changed part files: `items[t]` and `secciones[t]` for the step's types
 * (keys keep their place when present), `secciones.alguno` and `porParte` (parts with items, in `partes` order).
 */
export function recontarIndice(dir, ind, tipos) {
  const contar = {};
  const secCon = {};
  const alguno = new Set();
  const porParte = {};
  for (const p of ind.partes) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, `${p}.json`), 'utf8'));
    const porId = new Map(d.items.map((x) => [x.id, x]));
    for (const x of d.items) contar[x.tipo] = (contar[x.tipo] ?? 0) + 1;
    if (d.items.length) porParte[p] = d.items.length;
    for (const [k, s] of Object.entries(d.secciones)) {
      for (const t of new Set(s.items.map((id) => porId.get(id)?.tipo).filter(Boolean))) secCon[t] = (secCon[t] ?? 0) + 1;
      if (s.items.length) alguno.add(`${p}/${k}`);
    }
  }
  ind.porParte = porParte;
  ind.items = { ...ind.items, ...Object.fromEntries(tipos.map((t) => [t, contar[t] ?? 0])) };
  ind.secciones = { ...ind.secciones, ...Object.fromEntries(tipos.map((t) => [t, secCon[t] ?? 0])), alguno: alguno.size };
  return contar;
}


// ------------------------------------------------------------------ the app's ngspice in Node

let modulo = null;
/** simularTexto(netlist) with the same WebAssembly ngspice the app runs in its worker. */
export async function motor() {
  const { compilar } = await import(src('simulador/motor/nucleo.ts'));
  const { simular } = await import(src('simulador/motor/simular.ts'));
  const wasm = path.join(web, 'public', 'ngspice', 'ngspice-xspice.wasm');
  if (!fs.existsSync(wasm)) throw new Error('falta public/ngspice/ngspice-xspice.wasm (ejecute antes «node scripts/ngspice.mjs»)');
  modulo ??= await compilar(fs.readFileSync(wasm));
  return (t) => simular(modulo, t, undefined, 'xspice');
}
