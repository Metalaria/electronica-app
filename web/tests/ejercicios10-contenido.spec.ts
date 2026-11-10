// 1.0 «todos los ejercicios del libro resolubles en la app»: content and checker tests that need no browser.
//   PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.ejercicios10.config.ts tests/ejercicios10-contenido.spec.ts
// (the configuration builds and serves the app first; these tests only read web/public/libro/ and import lib/ modules)
//  * every exercise and problem of the book: a statement, a check (numeric fields or structured questions) or a
//    self-assessment, and a development (the book's solution); every question well formed and its own right answer
//    accepted; every «Del libro» explanation literally in the book's solution;
//  * property tests of the numeric checker (units, prefixes, decimal comma, tolerance, equivalent forms) and of the
//    structured one (boolean equivalence, standard series, orders, classifications, exact answers);
//  * the written-answer store writer (vt only for changed keys, text cap);
//  * «usted» in the new UI text and in the questions.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { comprobar, type Esperado } from '../src/lib/magnitudes';
import {
  analizarLogica,
  comprobarPregunta,
  esDeSerie,
  escribirCombinacion,
  escribirLista,
  respuestaCorrecta,
  type Pregunta,
} from '../src/lib/preguntas-ejercicio';
import { MAX_TEXTO_EJERCICIO, normalizarTextoEjercicio, ponerValores } from '../src/lib/valores-ejercicio';
import type { EstadoEjercicio } from '../src/lib/aprendizaje.svelte';

const AQUI = dirname(fileURLToPath(import.meta.url));
const LIBRO = join(AQUI, '..', 'public', 'libro');
// 1.1: only the book's items; the new exercises that are not in the book yet («nuevo») have their own tests
// (tests/ejnuevos11-unidad.spec.ts)
const ej = ((d) => ({ ...d, items: Object.fromEntries(Object.entries(d.items).filter(([, it]) => !(it as { nuevo?: boolean }).nuevo)) }))(
  JSON.parse(readFileSync(join(LIBRO, 'ejercicios.json'), 'utf-8')) as { items: Record<string, unknown> },
) as any;
const partes = new Map<string, { bloques: any[] }>();
const parte = (id: string) => {
  if (!partes.has(id)) partes.set(id, JSON.parse(readFileSync(join(LIBRO, 'partes', `${id}.json`), 'utf-8')));
  return partes.get(id)!;
};

function plano(h: string): string {
  // the same plain text as contenido/ejercicios.py (plano + normalizar_cita): inline maths by its source, _x / ^x marks
  return h
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, (_, a: string) => a.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
    .replace(/<sub>(.*?)<\/sub>/g, (_, x: string) => (/^\w+$/.test(x) ? `_${x}` : `_{${x}}`))
    .replace(/<sup>(.*?)<\/sup>/g, (_, x: string) => (/^\w+$/.test(x) ? `^${x}` : `^{${x}}`))
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'");
}
const norm = (t: string) => t.replace(/[\s   ]+/g, ' ').replace(/’/g, "'").trim();
function textoBloques(bs: any[]): string {
  const out: string[] = [];
  for (const b of bs ?? []) {
    if (b.html) out.push(plano(b.html));
    else if (b.t === 'lista') out.push(...b.items.map(plano));
    else if (b.t === 'tabla') for (const f of b.filas) out.push(f.map(plano).join(' | '));
    if (b.bloques && b.t !== 'ejercicios') out.push(textoBloques(b.bloques));
  }
  return out.join(' ');
}
/** Statement and solution blocks of an item, located by its `pos` the same way the app does. */
function enunciadoYSolucion(it: any): { enunciado: any[]; solucion: any[] } {
  const bl = parte(it.parte).bloques;
  if (it.tipo === 'ej') {
    const b = bl[it.pos[0]];
    const e = b?.t === 'ejercicios' ? b.items[it.pos[1]] : undefined;
    return { enunciado: e?.bloques ?? [], solucion: e?.solucion ?? [] };
  }
  const [h, pide, fin] = it.pos;
  return { enunciado: bl.slice(h + 1, pide + 1), solucion: bl.slice(pide + 1, fin) };
}

/** An encoded right answer for a question (what a reader who knows it would enter). */
function respuestaBuena(p: Pregunta): string {
  switch (p.tipo) {
    case 'eleccion':
      return String(p.correcta);
    case 'orden':
      return escribirLista(p.elementos.map((_, i) => i));
    case 'clasificar':
      return escribirLista(p.elementos.map((e) => e.cat));
    case 'exacta':
      return p.aceptadas[0]!;
    case 'logica':
      return p.expresion;
    case 'combinacion':
      return escribirCombinacion('15 k', '15 k', 'paralelo');
  }
}
/** An encoded wrong answer. */
function respuestaMala(p: Pregunta): string {
  switch (p.tipo) {
    case 'eleccion':
      return String((p.correcta + 1) % p.opciones.length);
    case 'orden':
      return escribirLista(p.mezcla);
    case 'clasificar':
      return escribirLista(p.elementos.map((e) => (e.cat + 1) % p.categorias.length));
    case 'exacta':
      return 'zzz';
    case 'logica':
      return `(${p.expresion})'`;
    case 'combinacion':
      return escribirCombinacion('3,3 k', '4,7 k', 'serie');
  }
}

// ---------------------------------------------------------------------------------------------------- content

test('cada ejercicio y problema del libro tiene enunciado, comprobación o autoevaluación y desarrollo', () => {
  // (the book's own: the new exercises and the expansions' ones, «Aún no en el libro», have their own tests)
  const items = (Object.entries(ej.items) as [string, any][]).filter(([, it]) => !it.nuevo && !it.ampliacion);
  expect(items.length).toBe(486);
  expect(ej.version).toBe(2);
  // every exercise block item and every problem of the parts is in ejercicios.json (none forgotten)
  const delLibro = new Set<string>();
  for (const f of readdirSync(join(LIBRO, 'partes'))) {
    for (const b of parte(f.replace(/\.json$/, '')).bloques) {
      if (b.t === 'ejercicios') for (const it of b.items) delLibro.add(it.label);
      if (b.t === 'h3' && (b.label ?? '').startsWith('prob-')) delLibro.add(b.label);
    }
  }
  expect([...delLibro].filter((l) => !ej.items[l])).toEqual([]);
  const sinAlgo: string[] = [];
  let auto = 0;
  let autoev = 0;
  for (const [label, it] of items) {
    const { enunciado, solucion } = enunciadoYSolucion(it);
    if (norm(textoBloques(enunciado)).length < 15) sinAlgo.push(`${label}: sin enunciado`);
    // the development is the book's own solution (every item of the book has one)
    if (norm(textoBloques(solucion)).length < 15) sinAlgo.push(`${label}: sin desarrollo`);
    const preguntas: Pregunta[] = it.preguntas ?? [];
    if (it.modo === 'auto') {
      auto++;
      if (!it.respuestas.length && !preguntas.length) sinAlgo.push(`${label}: auto sin nada que comprobar`);
    } else {
      autoev++;
      // self-assessed: the list of what is asked (the checklist) and the solution to compare with
      if (!it.otras?.length) sinAlgo.push(`${label}: autoevaluación sin lista de lo que se pide`);
    }
    if (it.clase === 'sin-solucion') sinAlgo.push(`${label}: sin solución`);
    if (it.pistas.length < 2) sinAlgo.push(`${label}: menos de dos pistas`);
    for (const r of it.respuestas) {
      if (!Number.isFinite(r.valor) || !r.nombre) sinAlgo.push(`${label}/${r.id}: respuesta numérica mal formada`);
      // the expected value written as the book does is accepted by the checker
      if (comprobar(r.texto, r, r.alternativas).tipo !== 'bien') sinAlgo.push(`${label}/${r.id}: «${r.texto}» no se acepta`);
    }
  }
  expect(sinAlgo).toEqual([]);
  expect(auto + autoev).toBe(486);
  expect(auto).toBeGreaterThanOrEqual(300);
});

test('cada pregunta estructurada está bien formada, acepta su respuesta y rechaza otra', () => {
  const fallos: string[] = [];
  let n = 0;
  for (const [label, it] of Object.entries(ej.items) as [string, any][]) {
    const ids = new Set<string>();
    for (const p of (it.preguntas ?? []) as Pregunta[]) {
      n++;
      const donde = `${label}/${p.id}`;
      if (ids.has(p.id)) fallos.push(`${donde}: id repetido`);
      ids.add(p.id);
      if (!p.enunciado) fallos.push(`${donde}: sin enunciado`);
      if (p.tipo === 'eleccion') {
        if (p.opciones.length < 2 || new Set(p.opciones).size !== p.opciones.length) fallos.push(`${donde}: opciones`);
        if (!(p.correcta >= 0 && p.correcta < p.opciones.length)) fallos.push(`${donde}: correcta fuera de rango`);
      }
      if (p.tipo === 'orden') {
        const m = [...p.mezcla].sort((a, b) => a - b);
        if (m.join() !== p.elementos.map((_, i) => i).join() || p.mezcla.every((x, i) => x === i)) fallos.push(`${donde}: mezcla`);
      }
      if (p.tipo === 'clasificar' && p.elementos.some((e) => !(e.cat >= 0 && e.cat < p.categorias.length))) fallos.push(`${donde}: categoría`);
      if (comprobarPregunta(p, respuestaBuena(p)).tipo !== 'bien') fallos.push(`${donde}: no acepta su respuesta`);
      if (comprobarPregunta(p, respuestaMala(p)).tipo === 'bien') fallos.push(`${donde}: acepta una respuesta mala`);
      if (comprobarPregunta(p, '').tipo !== 'vacio') fallos.push(`${donde}: vacío no es vacío`);
      if (!respuestaCorrecta(p)) fallos.push(`${donde}: sin texto de la respuesta`);
      // fidelity: an explanation attributed to the book is in the book's solution word for word
      if (p.explicacion && !p.calculo) {
        const sol = norm(textoBloques(enunciadoYSolucion(it).solucion));
        const cita = norm(plano(p.explicacion));
        if (!sol.includes(cita)) fallos.push(`${donde}: la cita no está en la solución: ${cita.slice(0, 80)}`);
      }
      if (!p.explicacion) fallos.push(`${donde}: sin desarrollo`);
    }
  }
  expect(fallos).toEqual([]);
  expect(n).toBeGreaterThanOrEqual(95);
});

test('las respuestas calculadas por la aplicación se verifican por un segundo camino', () => {
  // ej-9.1: the truth table of Y = A·B + C, from the expression parser, equals the table of the solution text
  const t = ej.items['ej-9.1'].preguntas[0];
  const { f } = analizarLogica('A·B + C');
  const calc = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => f({ A: (k >> 2) & 1, B: (k >> 1) & 1, C: k & 1 }));
  expect(t.elementos.map((e: { cat: number }) => e.cat)).toEqual(calc);
  const sol = norm(textoBloques(enunciadoYSolucion(ej.items['ej-9.1']).solucion));
  const delLibro = [...sol.matchAll(/→ \d\+\d = (\d)/g)].map((m) => Number(m[1]));
  expect(delLibro).toEqual(calc);
  // ej-9.2: (A'·B')' and A + B agree on every combination (De Morgan), and the book's form is the simplest
  const p92 = ej.items['ej-9.2'].preguntas[0];
  expect(comprobarPregunta(p92, "(A'·B')'").tipo).toBe('cerca');
  expect(comprobarPregunta(p92, 'B+A').tipo).toBe('bien');
  // ej-2.9: both of the book's combinations and the app's extra example are accepted; 3,3 k + 4,7 k is not (6,7 %)
  const p29 = ej.items['ej-2.9'].preguntas[0];
  expect(comprobarPregunta(p29, escribirCombinacion('15k', '15k', 'paralelo')).tipo).toBe('bien');
  expect(comprobarPregunta(p29, escribirCombinacion('6k8', '680', 'serie')).tipo).toBe('bien');
  expect(comprobarPregunta(p29, escribirCombinacion('8,2 k', '82 k', 'paralelo')).tipo).toBe('bien');
  expect(comprobarPregunta(p29, escribirCombinacion('3,3 k', '4,7 k', 'serie')).tipo).toBe('cerca');
  expect(comprobarPregunta(p29, escribirCombinacion('7,5 k', '1 M', 'paralelo')).tipo).toBe('mal'); // 7,5 k is E24
  // ej-0.1: the two values with their prefixes
  const r01 = ej.items['ej-0.1'].respuestas;
  expect(comprobar('4,7 µF', r01[0]).tipo).toBe('bien');
  expect(comprobar('4,7 × 10^-6', r01[0]).tipo).toBe('bien');
  expect(comprobar('2,2 MΩ', r01[1]).tipo).toBe('bien');
  expect(comprobar('2,2 kΩ', r01[1]).tipo).toBe('cerca');
});

// ---------------------------------------------------------------------------------------------------- properties

/** Small deterministic generator (mulberry32). */
function azar(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const PREF: [string, number][] = [
  ['p', 1e-12],
  ['n', 1e-9],
  ['µ', 1e-6],
  ['u', 1e-6],
  ['m', 1e-3],
  ['', 1],
  ['k', 1e3],
  ['M', 1e6],
];
/** Spanish writing of x with `dec` decimals: comma, no thousands separator. */
const es = (x: number, dec: number) => x.toFixed(dec).replace('.', ',');

test('propiedad: un valor escrito con cualquier prefijo, coma decimal o exponente se acepta', () => {
  const r = azar(12345);
  for (let n = 0; n < 600; n++) {
    const unidad = ['Ω', 'V', 'A', 'F', 'Hz', 'W'][Math.floor(r() * 6)]!;
    const mant = 1 + r() * 899; // 1 … 900
    const [p, f] = PREF[Math.floor(r() * PREF.length)]!;
    const valor = Number((mant * f).toPrecision(4));
    const e: Esperado = { valor, unidad, tol: 0.02, texto: '' };
    const m = valor / f;
    const formas = [`${es(m, 3)} ${p}${unidad}`, `${es(m, 3)}${p}`, `${es(m, 3)} ${p}`, `${valor.toExponential(3).replace('.', ',')}`, `${valor.toExponential(3)} ${unidad}`];
    if (p === 'u') formas.push(`${es(m, 3)} µ${unidad}`);
    for (const t of formas) expect(comprobar(t, e).tipo, `${t} para ${valor} ${unidad}`).toBe('bien');
  }
});

test('propiedad: la tolerancia se respeta en sus bordes, y el prefijo o el signo equivocados son «casi»', () => {
  const r = azar(777);
  for (let n = 0; n < 500; n++) {
    const tol = [0.01, 0.02, 0.03, 0.05][Math.floor(r() * 4)]!;
    const valor = Number(((1 + r() * 98) * 10 ** Math.floor(r() * 6 - 3)).toPrecision(6));
    const e: Esperado = { valor, unidad: 'V', tol, texto: '' };
    const dentroArriba = valor * (1 + tol * 0.98);
    const dentroAbajo = valor * (1 - tol * 0.98);
    const fuera = valor * (1 + tol * 1.6);
    expect(comprobar(dentroArriba.toPrecision(10).replace('.', ','), e).tipo).toBe('bien');
    expect(comprobar(dentroAbajo.toPrecision(10).replace('.', ','), e).tipo).toBe('bien');
    expect(comprobar(fuera.toPrecision(10).replace('.', ','), e).tipo).toBe('cerca'); // within 10 %
    expect(comprobar((valor * 1.5).toPrecision(10).replace('.', ','), e).tipo).toBe('mal');
    expect(comprobar((valor * 1000).toPrecision(10).replace('.', ','), e).tipo).toBe('cerca'); // a prefix too many
    expect(comprobar((-valor).toPrecision(10).replace('.', ','), e).tipo).toBe('cerca'); // sign
    expect(comprobar(`${valor.toPrecision(6).replace('.', ',')} A`, e).tipo).toBe('unidad');
    expect(comprobar('', e).tipo).toBe('vacio');
  }
});

test('propiedad: las formas equivalentes de una respuesta (RKM, alias, alternativas) se aceptan', () => {
  const e: Esperado = { valor: 4700, unidad: 'Ω', tol: 0.02, texto: '4,7 kΩ' };
  for (const t of ['4k7', '4K7', '4,7k', '4.7 kΩ', '4 700', '4700 ohm', '4,7 kohm', '4,7·10^3', '4,7 × 10³', '4,7e3 Ω']) {
    expect(comprobar(t, e).tipo, t).toBe('bien');
  }
  expect(comprobar('2R2', { valor: 2.2, unidad: 'Ω', tol: 0.02, texto: '' }).tipo).toBe('bien');
  const alt: Esperado = { valor: 470, unidad: 'Ω', tol: 0.005, texto: '470 Ω', nota: 'E12' };
  const v = comprobar('470', { valor: 440, unidad: 'Ω', tol: 0.02, texto: '440 Ω' }, [alt]);
  expect(v.tipo).toBe('bien');
  expect(v.tipo === 'bien' && v.nota).toBe('E12');
});

test('propiedad: la equivalencia lógica es la de la tabla de verdad', () => {
  const r = azar(99);
  const vars = ['A', 'B', 'C'];
  const gen = (d: number): string => {
    const x = r();
    if (d <= 0 || x < 0.3) return vars[Math.floor(r() * 3)]! + (r() < 0.3 ? "'" : '');
    const a = gen(d - 1);
    const b = gen(d - 1);
    return x < 0.55 ? `(${a})·(${b})` : x < 0.8 ? `(${a}) + (${b})` : `(${a})'`;
  };
  const tabla = (t: string) => {
    const { f } = analizarLogica(t);
    return [0, 1, 2, 3, 4, 5, 6, 7].map((k) => f({ A: (k >> 2) & 1, B: (k >> 1) & 1, C: k & 1 }));
  };
  for (let n = 0; n < 300; n++) {
    const a = gen(3);
    const ta = tabla(a);
    const p: Pregunta = { id: 'p1', tipo: 'logica', enunciado: 'x', expresion: a, variables: vars, tabla: ta, complejidad: 99 };
    // De Morgan forms and double negation are equivalent; the negation never is
    expect(comprobarPregunta(p, `((${a})')'`).tipo).toBe('bien');
    expect(comprobarPregunta(p, `(${a})'`).tipo).toBe('mal');
    // juxtaposition and the other spellings of AND / OR / NOT read the same
    const otra = a.replace(/·/g, '').replace(/\+/g, '|').replace(/'/g, '’');
    expect(tabla(otra)).toEqual(ta);
  }
  expect(() => analizarLogica('A +')).toThrow();
  expect(() => analizarLogica('(A·B')).toThrow();
  expect(comprobarPregunta({ id: 'p', tipo: 'logica', enunciado: '', expresion: 'A+B', variables: ['A', 'B'], tabla: [0, 1, 1, 1], complejidad: 2 }, 'A+$').tipo).toBe('ilegible');
});

test('propiedad: series normalizadas, órdenes, clasificaciones y respuestas exactas', () => {
  for (const b of [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2]) for (let d = 0; d <= 6; d++) expect(esDeSerie(Number((b * 10 ** d).toPrecision(3)), 'E12')).toBe(true);
  for (const v of [7500, 2000, 9100, 1300, 0.5, 2e7]) expect(esDeSerie(v, 'E12')).toBe(false);
  const r = azar(5);
  for (let n = 0; n < 200; n++) {
    const k = 3 + Math.floor(r() * 5);
    const el = Array.from({ length: k }, (_, i) => `paso ${i}`);
    const p: Pregunta = { id: 'p1', tipo: 'orden', enunciado: '', elementos: el, mezcla: el.map((_, i) => (i + 1) % k) };
    expect(comprobarPregunta(p, escribirLista(el.map((_, i) => i))).tipo).toBe('bien');
    const l = el.map((_, i) => i);
    const i = Math.floor(r() * (k - 1));
    [l[i], l[i + 1]] = [l[i + 1]!, l[i]!];
    const v = comprobarPregunta(p, escribirLista(l));
    expect(v.tipo).toBe('mal');
    expect(v.tipo === 'mal' && v.mensaje).toBe(`${k - 2} de ${k} están en su sitio.`);
    expect(comprobarPregunta(p, escribirLista([0, 0, ...l.slice(2)])).tipo).toBe('ilegible');
  }
  const c: Pregunta = { id: 'p1', tipo: 'clasificar', enunciado: '', categorias: ['Sí', 'No'], elementos: [{ texto: 'a', cat: 0 }, { texto: 'b', cat: 1 }, { texto: 'c', cat: 1 }] };
  expect(comprobarPregunta(c, '0,1,1').tipo).toBe('bien');
  expect(comprobarPregunta(c, '0,1,').tipo).toBe('ilegible');
  expect(comprobarPregunta(c, '1,1,1').tipo).toBe('mal');
  const x: Pregunta = { id: 'p1', tipo: 'exacta', enunciado: '', aceptadas: ['0001 0011'] };
  expect(comprobarPregunta(x, ' 00010011 ').tipo).toBe('bien');
  expect(comprobarPregunta(x, '0001 0011').tipo).toBe('bien');
  const h: Pregunta = { id: 'p1', tipo: 'exacta', enunciado: '', aceptadas: ['MΩ'] };
  expect(comprobarPregunta(h, 'mΩ').tipo).toBe('cerca');
});

// ---------------------------------------------------------------------------------------------------- store writer

test('el escritor de valores marca vt solo en las claves que cambian y limita el texto', () => {
  const e: EstadoEjercicio = { intentos: 1, fallos: 0, resuelto: false, pistas: 0, solucion: false, t: 5, valores: { r1: '4k7', p1: '2' }, vt: { r1: 100, p1: 100 } };
  expect(ponerValores(e, { r1: '4k7', p1: '1', texto: 'hola' }, 200)).toBe(true);
  expect(e.valores).toEqual({ r1: '4k7', p1: '1', texto: 'hola' });
  expect(e.vt).toEqual({ r1: 100, p1: 200, texto: 200 });
  // nothing changes: no new stamp, nothing to write
  expect(ponerValores(e, { r1: '4k7', texto: 'hola' }, 300)).toBe(false);
  expect(e.vt).toEqual({ r1: 100, p1: 200, texto: 200 });
  expect(e.t).toBe(5);
  // clearing a value is a change (it must reach the other devices)
  expect(ponerValores(e, { texto: '' }, 400)).toBe(true);
  expect(e.vt!.texto).toBe(400);
  // an item without vt (0.12 data) gets one
  const viejo: EstadoEjercicio = { intentos: 1, fallos: 1, resuelto: false, pistas: 0, solucion: false, t: 1, valores: { r1: '1' } };
  ponerValores(viejo, { r1: '2' }, 50);
  expect(viejo.vt).toEqual({ r1: 50 });
  expect(normalizarTextoEjercicio('  a\r\n\r\n\r\n\r\nb  \n')).toBe('a\n\nb');
  expect(normalizarTextoEjercicio('x'.repeat(MAX_TEXTO_EJERCICIO + 50)).length).toBe(MAX_TEXTO_EJERCICIO);
});

// ---------------------------------------------------------------------------------------------------- «usted»

test('el texto nuevo de la interfaz y las preguntas tratan de usted', () => {
  const TU = /\b(tienes|quieres|puedes|debes|elige|escribe|ordena|coloca|toca|marca|tu|tus|usarías|elegirías|harías|sabes)\b/i;
  const fuentes = ['src/componentes/aprender/PreguntaEjercicio.svelte', 'src/componentes/aprender/Comprobador.svelte', 'src/lib/preguntas-ejercicio.ts',
    'src/componentes/aprender/ResolverPasos.svelte', 'src/componentes/teoria/TeoriaViva.svelte', 'src/componentes/teoria/MandoValor.svelte'];
  for (const f of fuentes) {
    const t = readFileSync(join(AQUI, '..', f), 'utf-8');
    // only the Spanish strings: quoted text and markup text, not the code comments (in English)
    const cadenas = [...t.matchAll(/'([^'\n]*[áéíóúñ¿¡][^'\n]*)'|`([^`\n]*)`|>([^<>{}\n]*[a-záéíóú][^<>{}\n]*)</g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '');
    for (const c of cadenas) expect(TU.test(c), `${f}: «${c}»`).toBe(false);
  }
  // the guided steps' questions, hints and «por qué no», and the titles of the moving formulas
  const pasos = JSON.parse(readFileSync(join(LIBRO, 'pasos.json'), 'utf-8'));
  for (const [label, it] of Object.entries(pasos.items) as [string, any][]) {
    for (const p of it.pasos) for (const t of [p.pregunta, p.pista ?? '', ...Object.values(p.porque ?? {})] as string[]) expect(TU.test(plano(t)), `${label}: «${t}»`).toBe(false);
  }
  const teoria = JSON.parse(readFileSync(join(LIBRO, 'teoria-viva.json'), 'utf-8'));
  for (const p of Object.values(teoria.partes).flat() as any[]) expect(TU.test(p.titulo), p.titulo).toBe(false);
  for (const [label, it] of Object.entries(ej.items) as [string, any][]) {
    for (const p of it.preguntas ?? []) {
      const textos = [p.enunciado, ...(p.opciones ?? []), ...(p.elementos ?? []).map((e: any) => (typeof e === 'string' ? e : e.texto)), ...(p.categorias ?? [])];
      for (const t of textos) expect(TU.test(plano(t)), `${label}/${p.id}: «${t}»`).toBe(false);
    }
  }
});
