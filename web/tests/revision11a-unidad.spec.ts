// Review 11a (data side of 1.1), Node only: the evidence tests of the review (A1, A2, B1, B2, C1, D1) and the
// regression tests of its fixes. Each test states what the owner's rule expects.
//   NODE_PATH=web/node_modules npx playwright test -c <a config with testDir web/tests and no server> revision11a-unidad
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test, expect } from '@playwright/test';
import { cargarLibro, LIBRO } from './docente10/libro-node';
import { abiertaHeredada, calificarItem, claveCambiada, montadoDeResultado, recalificarGuardado, type ContextoExamen } from '../src/lib/docente/examen';
import type { ResultadoItem } from '../src/lib/docente/tipos';
import { fusionarColecciones, type Coleccion } from '../src/lib/sincronizacion/fusion';
import { anotarAyudaLab, anotarPasoLab, labCompletado, pasoDaXp, registroLabValido, unirRegistrosLab, type RegistroLab } from '../src/lib/laboratorio';
import { anotarSolucion, anotarComprobacion, etapaDaXp, unirRegistrosEtapa } from '../src/lib/proyectos11/registro';
import { progresoLeccionValido, unirProgresoLeccion, type ProgresoUnible } from '../src/lib/union-lecciones';
import { comprobarDiseno, faltaSimular } from '../src/lib/diseno-ejercicio';
import type { PDiseno, PEleccion } from '../src/lib/preguntas-ejercicio';

const L = cargarLibro();
const ctx: ContextoExamen = L.libro;
const WEB = path.resolve(LIBRO, '..', '..');
const REPO = path.resolve(WEB, '..');
const deHead = <T>(rel: string): T => JSON.parse(execFileSync('git', ['show', `HEAD:${rel}`], { cwd: REPO, encoding: 'utf8', maxBuffer: 256 << 20 })) as T;

// ------------------------------------------------------------------ A. exam results stored by 1.0

/** Exercises that 1.0 self-assessed and 1.1 checks automatically (razonar11). */
function convertidos(): string[] {
  const viejo = deHead<{ items: Record<string, { modo: string }> }>('web/public/libro/ejercicios.json').items;
  return Object.entries(L.ejercicios.items)
    .filter(([l, it]) => viejo[l]?.modo === 'comparar' && it.modo === 'auto')
    .map(([l]) => l);
}

test('A1 · resultado de examen de la 1.0 con un ejercicio autoevaluado aún pendiente: en la 1.1 sigue pudiendo autoevaluarse', () => {
  const lista = convertidos();
  expect(lista.length).toBe(181);
  // (the data marks exactly these: contenido/autoevaluados10.json → "comparar10")
  expect(Object.entries(L.ejercicios.items).filter(([, it]) => it.comparar10).map(([l]) => l).sort()).toEqual([...lista].sort());
  const malos: string[] = [];
  for (const ref of lista) {
    // what 1.0's HacerExamen stored for a self-assessed item handed in with a written answer: pending, 0 points
    const it: ResultadoItem = { k: 'ejercicio', ref, puntos: 0, maximo: 1, valores: { texto: 'Mi respuesta escrita en la 1.0' }, estado: 'pendiente' };
    const m = montadoDeResultado(it, 1);
    // ResultadoExamen.svelte shows the written text and the «Bien / A medias / Mal» buttons only if a part is «abierta»
    const visto = calificarItem(m, ctx, it.valores, it.autoeval);
    const conAbierta = visto.partes.some((p) => p.tipo === 'abierta');
    // the reader presses «Bien» (ResultadoExamen.svelte autoevaluar → recalificarGuardado and stores puntos/estado)
    const tras = recalificarGuardado(it, 1, ctx, { autoeval: 1 });
    if (!conAbierta || visto.estado !== 'pendiente' || tras.estado !== 'bien' || tras.puntos !== 1) malos.push(`${ref}: abierta ${conAbierta}, «Bien» → ${tras.estado} ${tras.puntos}`);
  }
  expect(malos.slice(0, 5), `${malos.length} de ${lista.length}`).toEqual([]);
});

test('A2 · resultado de examen de la 1.0 ya autoevaluado «Bien»: lo que se muestra en la 1.1 coincide con la nota guardada', () => {
  const malos: string[] = [];
  for (const ref of convertidos()) {
    const it: ResultadoItem = { k: 'ejercicio', ref, puntos: 2, maximo: 2, valores: { texto: 'Respuesta de la 1.0' }, estado: 'bien', autoeval: 1, autoevalT: 1 };
    const c = calificarItem(montadoDeResultado(it, 1), ctx, it.valores, it.autoeval);
    if (c.estado !== it.estado || c.puntos !== it.puntos || claveCambiada(it, 1, ctx)) malos.push(`${ref}: guardado ${it.estado} ${it.puntos}, mostrado ${c.estado} ${c.puntos}`);
  }
  expect(malos.slice(0, 3), `${malos.length}`).toEqual([]);
});

test('A3 · la parte abierta heredada solo vale para lo que la 1.0 autoevaluaba, y solo mientras no se responda a las preguntas nuevas', () => {
  const items = L.ejercicios.items;
  const conv = items['ej-4.6']!;
  expect(conv.comparar10).toBe(true);
  expect(abiertaHeredada(conv, { texto: 'algo' })).toBe(true);
  expect(abiertaHeredada(conv, { texto: '  ' })).toBe(false);
  // a 1.1 answer to the new question is graded by it: no open part, the text is not graded
  const m = montadoDeResultado({ k: 'ejercicio', ref: 'ej-4.6', puntos: 0, maximo: 1, valores: {}, estado: 'blanco' }, 1);
  const p1 = conv.preguntas![0] as PEleccion;
  const v11 = calificarItem(m, ctx, { texto: 'algo', p1: String(p1.correcta) });
  expect(v11.partes.map((p) => p.tipo)).toEqual(['pregunta']);
  expect(v11.estado).toBe('bien');
  // an exercise that 1.0 already checked by itself, with an open part too: a text-only answer is graded as 1.0 did
  // (its fields blank + the open part), never as an open part alone
  const [l10] = Object.entries(items).find(([, it]) => !it.comparar10 && it.modo === 'auto' && it.respuestas.length && it.otras?.length)!;
  const it10: ResultadoItem = { k: 'ejercicio', ref: l10, puntos: 0, maximo: 1, valores: { texto: 'solo el texto' }, estado: 'pendiente' };
  const c10 = calificarItem(montadoDeResultado(it10, 1), ctx, it10.valores, 1);
  expect(c10.partes.length).toBeGreaterThan(1);
  expect(c10.estado).toBe('parcial');
});

test('A4 · un resultado guardado no se recalifica con una clave que cambió después (erratas de prob-1.B r3 y prob-3.B r5)', () => {
  const viejo = deHead<{ items: Record<string, { respuestas: { id: string; texto: string }[] }> }>('web/public/libro/ejercicios.json').items;
  for (const [ref, rid] of [['prob-1.B', 'r3'], ['prob-3.B', 'r5']] as const) {
    const e = L.ejercicios.items[ref]!;
    // handed in with 1.0's key: every field right as 1.0 checked it, the open part still to self-assess
    const valores: Record<string, string> = { texto: 'Mi explicación' };
    for (const r of viejo[ref]!.respuestas) valores[r.id] = r.texto;
    expect(valores[rid]).not.toBe(e.respuestas.find((r) => r.id === rid)!.texto);
    const n = e.respuestas.length + 1;
    const it: ResultadoItem = { k: 'ejercicio', ref, puntos: Math.round((4 * (n - 1)) / n * 100) / 100, maximo: 4, valores, estado: 'pendiente' };
    // the page shows the stored grade with a note: with today's key it would be less
    const c = claveCambiada(it, 1, ctx)!;
    expect(c, ref).toBeTruthy();
    expect(c.puntos).toBeLessThan(it.puntos);
    // «Bien» moves only the open part: the field the erratum changed keeps the grade it had when handed in
    const tras = recalificarGuardado(it, 1, ctx, { autoeval: 1 });
    expect(tras, ref).toEqual({ puntos: 4, estado: 'bien' });
    expect(recalificarGuardado(it, 1, ctx, { autoeval: 0 })).toEqual({ puntos: it.puntos, estado: 'parcial' });
    // with the key unchanged (an answer right by today's key too), the usual grading
    const hoy: Record<string, string> = { texto: 'x' };
    for (const r of e.respuestas) hoy[r.id] = r.texto;
    const it2: ResultadoItem = { ...it, valores: hoy, puntos: calificarItem(montadoDeResultado(it, 1), ctx, hoy).puntos };
    expect(claveCambiada(it2, 1, ctx)).toBeNull();
    expect(recalificarGuardado(it2, 1, ctx, { autoeval: 0.5 }).puntos).toBe(calificarItem(montadoDeResultado(it2, 1), ctx, hoy, 0.5).puntos);
  }
});

test('A5 · un diseño que no se pudo simular al entregar (fallo pasajero de ngspice) se simula después y se vuelve a corregir', () => {
  const e = L.ejercicios.items['ej-25.9']!;
  const q = e.preguntas![0] as PDiseno;
  expect(q.tipo).toBe('diseno');
  const it: ResultadoItem = { k: 'ejercicio', ref: 'ej-25.9', puntos: 0, maximo: 2, valores: { p1: '3,3 k|47 n' }, estado: 'mal' };
  const antes = calificarItem(montadoDeResultado(it, 1), ctx, it.valores);
  expect([antes.puntos, antes.partes[0]!.mensaje]).toEqual([0, 'Falta simular este diseño: pulse «Comprobar».']);
  // ResultadoExamen.svelte offers «Simular ahora y corregir» while faltaSimular holds
  expect(faltaSimular(q, it.valores.p1!)).toBe(true);
  // what simularDiseno writes (lib/diseno-ejercicio.ts): the values simulated and the measurement
  const simulado = '3,3 k|47 n#3300,4.7e-8#fc=1026.14';
  expect(faltaSimular(q, simulado)).toBe(false);
  expect(recalificarGuardado(it, 1, ctx, { valores: { p1: simulado } })).toEqual({ puntos: 2, estado: 'bien' });
});

// ------------------------------------------------------------------ B. storage keys of generated content

test('B1 · los identificadores de práctica de la 1.0 siguen existiendo (claves de «practica», XP «pr:», dominio y repaso)', () => {
  const dir = path.join(LIBRO, 'practica');
  const perdidos: string[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json') || f === 'indice.json') continue;
    let viejo: { items: { id: string }[] };
    try {
      viejo = deHead(`web/public/libro/practica/${f}`);
    } catch {
      continue; // a new part of 1.1
    }
    const ahora = new Set((JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { items: { id: string }[] }).items.map((x) => x.id));
    for (const x of viejo.items) if (!ahora.has(x.id)) perdidos.push(x.id);
  }
  expect(perdidos).toEqual([]);
  // every «ordenar» id published is in the registry (contenido/ids_practica.json), by its fingerprint
  const registro = Object.values((JSON.parse(fs.readFileSync(path.join(REPO, 'contenido', 'ids_practica.json'), 'utf8')) as { orden: Record<string, string> }).orden);
  const ordenar = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'indice.json')
    .flatMap((f) => (JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { items: { id: string; tipo: string }[] }).items.filter((x) => x.tipo === 'ordenar').map((x) => x.id));
  expect(ordenar.filter((id) => !registro.includes(id))).toEqual([]);
});

test('B2 · las preguntas de repaso y las etiquetas de ejercicios de la 1.0 conservan su identificador', () => {
  const viejo = deHead<{ items: Record<string, unknown> }>('web/public/libro/ejercicios.json').items;
  expect(Object.keys(viejo).filter((l) => !L.ejercicios.items[l])).toEqual([]);
  const dir = path.join(LIBRO, 'repaso');
  const perdidas: string[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json') || f === 'indice.json') continue;
    let v: { preguntas: { id: string }[] };
    try {
      v = deHead(`web/public/libro/repaso/${f}`);
    } catch {
      continue;
    }
    const ahora = new Set((JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { preguntas: { id: string }[] }).preguntas.map((x) => x.id));
    for (const q of v.preguntas) if (!ahora.has(q.id)) perdidas.push(q.id);
  }
  expect(perdidas).toEqual([]);
});

/** A copy of the book (links, except what is written or changed) for a generator to run on. */
function copiaLibro(propios: string[], cambiar: Record<string, (v: any) => unknown>): string {
  const copia = fs.mkdtempSync(path.join(os.tmpdir(), 'epa-r11a-'));
  for (const e of fs.readdirSync(LIBRO)) {
    if (e === 'partes') continue;
    if (propios.includes(e)) fs.cpSync(path.join(LIBRO, e), path.join(copia, e), { recursive: true });
    else fs.symlinkSync(path.join(LIBRO, e), path.join(copia, e));
  }
  fs.mkdirSync(path.join(copia, 'partes'));
  for (const f of fs.readdirSync(path.join(LIBRO, 'partes'))) {
    const origen = path.join(LIBRO, 'partes', f);
    const k = f.replace(/\.json$/, '');
    if (cambiar[k]) fs.writeFileSync(path.join(copia, 'partes', f), JSON.stringify(cambiar[k]!(JSON.parse(fs.readFileSync(origen, 'utf8')))));
    else fs.symlinkSync(origen, path.join(copia, 'partes', f));
  }
  return copia;
}

/** Every `ampliacion` mark of a part removed: what the converter gives once the author pasted the expansion. */
function pegada(v: any): unknown {
  if (Array.isArray(v)) return v.map(pegada);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'ampliacion').map(([k, x]) => [k, pegada(x)]));
  return v;
}

test('B3 · el libro ya contiene las ampliaciones (cap31 y cap33 sin marca): los «ordenar» conservan su identificador; sin el registro, cambiaría', () => {
  test.setTimeout(900_000);
  const copia = copiaLibro(['practica'], { cap31: pegada, cap33: pegada });
  try {
    const ids = (p: string) => (JSON.parse(fs.readFileSync(path.join(copia, 'practica', `${p}.json`), 'utf8')) as { items: { id: string; tipo: string }[] }).items.filter((x) => x.tipo === 'ordenar').map((x) => x.id);
    const antes = { cap31: ids('cap31'), cap33: ids('cap33') };
    expect(antes.cap33).toContain('cap33-orden-sec-33.14-423');
    const correr = (env: Record<string, string>) => {
      for (const p of ['cap31', 'cap33']) execFileSync('nice', ['node', 'scripts/practica10.mjs', '--solo', p], { cwd: WEB, env: { ...process.env, EPA_LIBRO: copia, ...env }, encoding: 'utf8', maxBuffer: 64 << 20 });
    };
    correr({});
    expect({ cap31: ids('cap31'), cap33: ids('cap33') }).toEqual(antes);
    // (without the registry the book's list after the insertion takes its new index: the reader's progress would go)
    correr({ EPA_IDS_PRACTICA: path.join(copia, 'no-hay-registro.json') });
    expect(ids('cap33')).not.toContain('cap33-orden-sec-33.14-423');
  } finally {
    fs.rmSync(copia, { recursive: true, force: true });
  }
});

test('B4 · el libro ya contiene ej-25.9 y ej-22.4 (pegados con su bloque «Para el curado»): la pregunta de diseño p1 y los «porque» sobreviven', () => {
  test.setTimeout(600_000);
  const items = L.ejercicios.items;
  const nuevos = { 'ej-25.9': items['ej-25.9']!, 'ej-22.4': items['ej-22.4']! };
  // the book now has them: an «ejercicios» block at the end of their section, as the converter writes a pasted one
  const conEjercicio = (label: keyof typeof nuevos) => (d: { bloques: { t: string; label?: string }[] }) => {
    const e = nuevos[label];
    const h2 = d.bloques.findIndex((b) => b.t === 'h2' && b.label === e.seccion);
    let fin = d.bloques.findIndex((b, i) => i > h2 && b.t === 'h2');
    if (fin < 0) fin = d.bloques.length;
    d.bloques.splice(fin, 0, { t: 'ejercicios', items: [{ label, num: e.num, bloques: e.enunciado, solucion: e.solucion }] } as never);
    return d;
  };
  const copia = copiaLibro(['ejercicios.json', 'busqueda.json'], { cap25: conEjercicio('ej-25.9'), cap22: conEjercicio('ej-22.4') });
  try {
    // the curated file with the blocks that «ejercicios_nuevos.py --typst» gives for the book
    const md = path.join(copia, 'nuevos.md');
    execFileSync('python3', [path.join(REPO, 'contenido', 'ejercicios_nuevos.py'), '--comprobar', '--typst', md], { encoding: 'utf8' });
    const texto = fs.readFileSync(md, 'utf8');
    const bloque = (l: string) => texto.slice(texto.indexOf(`[${l}]\n`)).split('\n\n')[0]!;
    expect(bloque('ej-25.9')).toMatch(/^\? diseno: \{/m);
    expect(bloque('ej-22.4')).toMatch(/^porque \d+: /m);
    const curado = path.join(copia, 'curado.txt');
    fs.writeFileSync(curado, `${fs.readFileSync(path.join(REPO, 'contenido', 'ejercicios_curado.txt'), 'utf8')}\n${bloque('ej-25.9')}\n\n${bloque('ej-22.4')}\n`);
    execFileSync('python3', [path.join(REPO, 'contenido', 'ejercicios.py')], { env: { ...process.env, EPA_LIBRO: copia, EPA_CURADO: curado }, encoding: 'utf8' });
    const despues = (JSON.parse(fs.readFileSync(path.join(copia, 'ejercicios.json'), 'utf8')) as typeof L.ejercicios).items;
    for (const l of Object.keys(nuevos) as (keyof typeof nuevos)[]) {
      expect(despues[l]!.nuevo, `${l}: the book's item now`).toBeUndefined();
      expect(despues[l]!.preguntas!.map((p) => [p.id, p.tipo])).toEqual(nuevos[l].preguntas!.map((p) => [p.id, p.tipo]));
    }
    // the design question: the same question, so a stored answer gives the same verdict
    const [a, b] = [despues['ej-25.9']!.preguntas![0] as PDiseno, nuevos['ej-25.9'].preguntas![0] as PDiseno];
    expect(a).toEqual(b);
    expect(despues['ej-25.9']!.clase).toBe('diseno');
    for (const v of ['3,3 k|47 n#3300,4.7e-8#fc=1026.14', '3,3 k|4,7 n#3300,4.7e-9#fc=10261.4']) expect(comprobarDiseno(a, v)).toEqual(comprobarDiseno(b, v));
    // the choice question: the same options in the same shown order, the same right one, every «porque» kept
    const plano = (h: string) => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const [c, d] = [despues['ej-22.4']!.preguntas![0] as PEleccion, nuevos['ej-22.4'].preguntas![0] as PEleccion];
    expect(c.opciones.map(plano)).toEqual(d.opciones.map(plano));
    expect(c.correcta).toBe(d.correcta);
    expect(Object.fromEntries(Object.entries(c.porque ?? {}).map(([k, t]) => [k, plano(t)]))).toEqual(Object.fromEntries(Object.entries(d.porque ?? {}).map(([k, t]) => [k, plano(t)])));
    expect(Object.keys(c.porque ?? {}).length).toBe(c.opciones.length - 1);
  } finally {
    fs.rmSync(copia, { recursive: true, force: true });
  }
});

// ------------------------------------------------------------------ C. lesson progress on two devices

const UNION_LECCIONES = { unir: (a: unknown, b: unknown) => unirProgresoLeccion(a as ProgresoUnible, b as ProgresoUnible), valido: progresoLeccionValido };

test('C1 · lecciones en dos dispositivos: abrir en B una lección que A ya completó no borra la compleción (almacén «lecciones»)', () => {
  const T = Date.UTC(2026, 10, 10, 10);
  // A completes the 1.1 lesson cap01/sec-1.4 (10 cards): completarLeccion → h 0…9, u 10, c
  const a = { h: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], u: 10, n: 10, c: T, t: T };
  // B, offline, opened the same lesson an hour later and looked at its first card: { h: [], u: 0, n: 10, c: 0, t: now }
  const b = { h: [], u: 0, n: 10, c: 0, t: T + 3_600_000 };
  const fichero: Coleccion = { 'cap01/sec-1.4': { t: a.t, v: a } };
  const local: Coleccion = { 'cap01/sec-1.4': { t: b.t, v: b } };
  // (the synchronisation merges the file with the store's `unir`, as registro.svelte.ts registers it)
  const r = fusionarColecciones(fichero, local, UNION_LECCIONES) as Record<string, { v: typeof a }>;
  expect(r['cap01/sec-1.4']!.v.c, 'la compleción de A').toBe(T);
  expect(r['cap01/sec-1.4']!.v.h.length, 'las tarjetas hechas en A').toBe(10);
  expect(r['cap01/sec-1.4']!.v.u, 'la última pantalla, la más nueva').toBe(0);
  const registro = fs.readFileSync(path.join(WEB, 'src/lib/sincronizacion/registro.svelte.ts'), 'utf8');
  expect(registro).toMatch(/clave: 'lecciones',[\s\S]{0,400}unir: \(a, b\) => unirProgresoLeccion\(/);
  expect(fs.readFileSync(path.join(WEB, 'src/lib/lecciones.svelte.ts'), 'utf8')).toMatch(/guardadoDeRegistro<ProgresoGuardado>\(\{[\s\S]{0,500}unir: \(a, b\) =>/);
});

test('C2 · la unión de lecciones es conmutativa, asociativa e idempotente, y no resucita nada', () => {
  const muestras: ProgresoUnible[] = [];
  let s = 7;
  const azar = (n: number) => ((s = (s * 1103515245 + 12345) % 2 ** 31), s % n);
  for (let k = 0; k < 40; k++) {
    const h = [...new Set(Array.from({ length: azar(6) }, () => azar(8)))].sort((x, y) => x - y);
    muestras.push({ h, u: azar(9), n: 8 + azar(2), c: azar(3) ? 0 : 1000 + azar(5), t: 1000 + azar(6) });
  }
  const u = unirProgresoLeccion;
  for (const a of muestras)
    for (const b of muestras) {
      expect(u(a, b)).toEqual(u(b, a));
      expect(u(a, a)).toEqual({ ...a });
      expect(u(u(a, b), b)).toEqual(u(a, b));
    }
  for (const a of muestras.slice(0, 12)) for (const b of muestras.slice(0, 12)) for (const c of muestras.slice(0, 12)) expect(u(u(a, b), c)).toEqual(u(a, u(b, c)));
  // the first completion, never a later one, and never a completion that neither version had
  expect(u({ h: [], u: 0, n: 3, c: 5, t: 9 }, { h: [], u: 0, n: 3, c: 2, t: 1 }).c).toBe(2);
  expect(u({ h: [1], u: 0, n: 3, c: 0, t: 9 }, { h: [2], u: 0, n: 3, c: 0, t: 1 }).c).toBe(0);
  // a deletion of the item (the synchronisation's tombstone) is not given to the merge: it stays deleted
  const lapida: Coleccion = { x: { t: 50, x: 1 } };
  const vivo: Coleccion = { x: { t: 10, v: { h: [0], u: 0, n: 1, c: 0, t: 10 } } };
  expect(fusionarColecciones(vivo, lapida, UNION_LECCIONES).x).toEqual({ t: 50, x: 1 });
  expect(fusionarColecciones(lapida, vivo, UNION_LECCIONES).x).toEqual({ t: 50, x: 1 });
});

test('C3 · dos dispositivos reales (motor de sincronización en Node): lecciones y «Hágalo por mí» (escenarios r11a)', () => {
  test.setTimeout(600_000);
  const out = execFileSync('nice', ['node', '--experimental-transform-types', '--no-warnings', '--import', './tests/motor-real/registrar.mjs', 'tests/motor-real/correr.ts', 'casos', 'r11a'], { cwd: WEB, encoding: 'utf8', maxBuffer: 64 << 20 });
  const r = JSON.parse(out.trim().split('\n').pop()!) as { nombre: string; ok: boolean; error?: string }[];
  expect(r.length).toBe(2);
  expect(r.filter((x) => !x.ok)).toEqual([]);
});

// ------------------------------------------------------------------ D. guided labs and projects

test('D1 · laboratorio: dos dispositivos que hacen pasos distintos y juntos lo completan quedan «completado» en la portada', () => {
  const PASOS = ['a', 'b', 'c'];
  const A = anotarPasoLab(anotarPasoLab(undefined, 'a', 1, PASOS, 1000), 'b', 2, PASOS, 2000);
  const B = anotarPasoLab(undefined, 'c', 3, PASOS, 1500);
  const u = unirRegistrosLab(A, B);
  expect(u.h).toEqual(PASOS);
  // PanelLaboratorio says «Laboratorio completado» (h covers every step); Portada.svelte reads labCompletado
  expect(u.c).toBe(0);
  expect(labCompletado(u, PASOS)).toBe(true);
  expect(labCompletado(A, PASOS)).toBe(false);
  expect(labCompletado({ ...A, c: 5 }, PASOS)).toBe(true);
  expect(labCompletado(undefined, PASOS)).toBe(false);
  expect(fs.readFileSync(path.join(WEB, 'src/componentes/instrumentos/Portada.svelte'), 'utf8')).toContain('labCompletado(r,');
});

test('D2 · «Hágalo por mí» en un dispositivo: ese paso no da XP en otro ni en otra visita (marca `a`, unida como `_r`)', () => {
  const PASOS = ['a', 'b', 'c'];
  const A = anotarAyudaLab(undefined, 'b', 1000);
  expect(A).toEqual({ h: [], l: {}, c: 0, t: 1000, a: ['b'] });
  expect(registroLabValido(A)).toBe(true);
  expect(registroLabValido({ ...A, a: [1] })).toBe(false);
  const B = anotarPasoLab(undefined, 'a', 1, PASOS, 900);
  const u = unirRegistrosLab(A, B);
  expect(u.a).toEqual(['b']);
  expect(unirRegistrosLab(B, A)).toEqual(u);
  expect(unirRegistrosLab(u, u)).toEqual(u);
  expect(unirRegistrosLab(unirRegistrosLab(A, B), anotarAyudaLab(B, 'c', 2000))).toEqual(unirRegistrosLab(A, unirRegistrosLab(B, anotarAyudaLab(B, 'c', 2000))));
  expect(pasoDaXp(u, 'b')).toBe(false);
  expect(pasoDaXp(u, 'a')).toBe(true);
  // a later step keeps the mark; a record without it stays as before (no `a` key)
  expect(anotarPasoLab(u, 'b', null, PASOS, 3000).a).toEqual(['b']);
  expect('a' in B).toBe(false);
  // the projects: the book's design shown on one device (`s`, the earliest) stays after any merge: no XP
  const E = anotarSolucion(undefined, 100);
  const F = anotarComprobacion(undefined, false, {}, {}, 200);
  for (const r of [unirRegistrosEtapa(E, F), unirRegistrosEtapa(F, E)]) expect(etapaDaXp(r)).toBe(false);
  expect(etapaDaXp(F)).toBe(true);
  const panel = fs.readFileSync(path.join(WEB, 'src/componentes/instrumentos/practicas/PanelLaboratorio.svelte'), 'utf8');
  expect(panel).toContain('anotarAyudaLaboratorio(lab.n, paso.id)');
  expect(panel).toContain('pasoDaXp(registroLab(lab.n), x.id)');
  expect(fs.readFileSync(path.join(WEB, 'src/componentes/proyectos11/Etapa.svelte'), 'utf8')).toContain('etapaDaXp(antes)');
});
