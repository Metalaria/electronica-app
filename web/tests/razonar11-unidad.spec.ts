// 1.1 «razonar» (aprender haciendo): the book's self-assessed exercises whose key reasoning a choice, an order, a
// matching or a value can check faithfully became self-checked (contenido/ejercicios_curado.txt: «?» questions, «>»
// literal quotes of the solution, «porque N:» why each wrong option is wrong, «=» values). No browser nor server:
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.razonar11.config.ts tests/razonar11-unidad.spec.ts
// The browser part (one converted item solved with the keyboard, XP, axe, 360 px) is razonar11-navegador.spec.ts.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { cargarLibro, LIBRO, recursosNode } from './docente10/libro-node';
import { leerPdf, plano as planoPdf } from './docente10/leer-pdf';
import { calificarItem, montarExamen, preguntaVista, type ContextoExamen } from '../src/lib/docente/examen';
import { documentoSoluciones } from '../src/lib/docente/pdf/documento';
import { generarPdf } from '../src/lib/docente/pdf/maquetar';
import { comprobar } from '../src/lib/magnitudes';
import { comprobarPregunta, escribirLista, type Pregunta } from '../src/lib/preguntas-ejercicio';
import { XP, xpEjercicio } from '../src/lib/aprendizaje/niveles';

/** The 181 of the 186 self-assessed exercises of 1.0 that the app checks now (book order). */
export const CONVERTIDOS = [
  'ej-4.6', 'ej-4.8', 'ej-4.9', 'ej-5.4', 'ej-5.7', 'ej-5.9', 'ej-6.4', 'ej-6.6', 'ej-6.9', 'ej-7.5', 'ej-7.8',
  'ej-7.9', 'ej-8.6', 'ej-8.9', 'ej-9.3', 'ej-9.6', 'ej-9.7', 'ej-9.9', 'ej-10.2', 'ej-10.4', 'ej-10.5',
  'ej-10.7', 'ej-10.8', 'ej-10.9', 'prob-11.B', 'ej-11.7', 'ej-11.8', 'ej-12.1', 'ej-12.3', 'ej-12.5', 'ej-12.6',
  'ej-12.7', 'ej-13.1', 'ej-13.2', 'ej-13.3', 'ej-13.7', 'ej-13.8', 'ej-15.1', 'ej-15.2', 'ej-15.3', 'ej-15.4',
  'ej-15.6', 'ej-15.7', 'ej-15.8', 'prob-16.B', 'ej-16.3', 'ej-16.4', 'ej-16.5', 'ej-16.7', 'ej-16.8', 'ej-16.10',
  'ej-16.11', 'ej-16.12', 'ej-16.13', 'ej-16.14', 'ej-17.1', 'ej-17.5', 'ej-17.6', 'ej-17.7', 'ej-17.8',
  'ej-17.9', 'ej-18.1', 'ej-18.2', 'ej-18.3', 'ej-18.4', 'ej-18.6', 'ej-18.7', 'ej-18.8', 'ej-19.1', 'ej-19.2',
  'ej-19.3', 'ej-19.4', 'ej-19.5', 'ej-19.7', 'ej-19.8', 'ej-20.5', 'ej-20.6', 'ej-20.7', 'ej-20.8', 'ej-21.8',
  'ej-21.10', 'ej-21.11', 'ej-23.5', 'ej-23.7', 'ej-23.8', 'ej-24.6', 'ej-24.7', 'ej-26.5', 'ej-26.6', 'ej-26.7',
  'ej-26.8', 'ej-27.7', 'ej-27.9', 'ej-28.6', 'ej-28.7', 'prob-29.C', 'ej-29.5', 'ej-29.7', 'ej-30.5', 'ej-30.6',
  'ej-30.7', 'ej-31.2', 'ej-31.3', 'ej-31.4', 'ej-31.6', 'ej-31.7', 'ej-31.8', 'ej-32.4', 'ej-32.5', 'ej-33.4',
  'ej-33.5', 'ej-28.5', 'ej-36.4', 'ej-37.1', 'ej-37.2', 'ej-37.3', 'ej-37.5', 'ej-38.2', 'ej-38.3', 'ej-38.5',
  'ej-39.2', 'ej-39.5', 'ej-40.1', 'ej-40.2', 'ej-40.4', 'ej-41.1', 'ej-41.2', 'ej-41.3', 'ej-41.4', 'ej-41.5',
  'prob-42.A', 'prob-42.C', 'ej-42.3', 'ej-42.5', 'ej-43.1', 'ej-43.4', 'ej-43.5', 'ej-44.2', 'ej-44.3',
  'ej-44.4', 'ej-44.5', 'ej-45.2', 'prob-46.A', 'prob-46.C', 'ej-46.2', 'ej-46.5', 'ej-47.1', 'ej-47.2',
  'ej-47.4', 'ej-47.5', 'ej-48.1', 'ej-48.2', 'ej-48.3', 'ej-48.4', 'ej-49.1', 'ej-49.2', 'ej-49.3', 'ej-49.4',
  'ej-49.5', 'ej-50.1', 'ej-50.3', 'ej-50.4', 'ej-51.2', 'ej-51.3', 'ej-51.5', 'ej-52.1', 'ej-52.2', 'ej-52.3',
  'ej-52.4', 'ej-52.5', 'ej-14.1', 'ej-14.2', 'ej-14.3', 'ej-14.4', 'ej-14.5', 'ej-14.6', 'ej-14.8', 'ej-14.9',
  'prob-54.A', 'prob-54.B', 'prob-54.C',
];
/** The ones left self-assessed, and why (also in the owner's review list). */
export const QUEDAN: Record<string, string> = {
  'ej-12.8': 'enumeración abierta de ventajas (control de versiones)',
  'ej-40.5': 'enumeración de recursos de la PCB; una elección sería un sustituto trivial',
  'ej-42.2': 'pide dar tres razones (enumeración); reconocerlas sería un sustituto',
  'ej-46.4': 'pide tres decisiones de diseño (enumeración abierta)',
  'ej-48.5': 'respuesta abierta (cualquier elección razonada vale)',
};
/** The converted ones that keep an optional open part («También se pide»): one point each, as in 1.0 (key c1). */
const CON_PARTE_ABIERTA = ['ej-9.3', 'ej-10.4', 'ej-12.1', 'prob-29.C', 'ej-41.2', 'ej-41.3', 'ej-41.5', 'ej-42.5'];

const L = cargarLibro();
const ctx: ContextoExamen = L.libro;
const items = L.ejercicios.items as Record<string, any>;
const sinEtiquetas = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const texto = (bs: any[]): string =>
  (bs ?? [])
    .map((b) => (b.html ? sinEtiquetas(b.html) : b.t === 'lista' ? b.items.map(sinEtiquetas).join(' ') : b.bloques ? texto(b.bloques) : ''))
    .join(' ');
const preguntas = (l: string) => (items[l]!.preguntas ?? []) as Pregunta[];
const todas = () => CONVERTIDOS.flatMap((l) => preguntas(l).map((p) => ({ l, p })));

test('los 186 autoevaluados de la 1.0: 181 se comprueban solos y 5 siguen autoevaluados, con las mismas etiquetas', () => {
  expect(new Set(CONVERTIDOS).size).toBe(181);
  expect(CONVERTIDOS.filter((l) => l in QUEDAN)).toEqual([]);
  for (const l of CONVERTIDOS) {
    const it = items[l]!;
    expect(it, l).toBeTruthy();
    expect(it.modo, l).toBe('auto');
    expect(it.respuestas.length + preguntas(l).length, l).toBeGreaterThan(0);
    // ids stay the 1.0 scheme (r1…, p1…): saved values of other items are untouched, these had none
    preguntas(l).forEach((p, k) => expect(p.id, l).toBe(`p${k + 1}`));
    (it.respuestas as { id: string }[]).forEach((r, k) => expect(r.id, l).toBe(`r${k + 1}`));
    // the open part is kept only where the answer also needs prose, with the same single checklist point (c1)
    expect((it.otras ?? []).length, l).toBe(CON_PARTE_ABIERTA.includes(l) ? 1 : 0);
  }
  // (the new exercises and the expansions' ones, «Aún no en el libro», are not 1.0's: their own tests)
  const comparar = Object.entries(items).filter(([, it]) => !it.nuevo && !it.ampliacion && it.modo === 'comparar').map(([l]) => l);
  expect(comparar.sort()).toEqual(Object.keys(QUEDAN).sort());
  for (const l of Object.keys(QUEDAN)) expect([items[l]!.respuestas.length, preguntas(l).length], l).toEqual([0, 0]);
});

test('cada elección: una sola correcta, opciones distintas y una explicación para cada opción (por qué sí y por qué no)', () => {
  let n = 0;
  for (const { l, p } of todas()) {
    if (p.tipo !== 'eleccion') continue;
    n++;
    const d = `${l}/${p.id}`;
    expect(Number.isInteger(p.correcta) && p.correcta >= 0 && p.correcta < p.opciones.length, d).toBe(true);
    expect(new Set(p.opciones.map(sinEtiquetas)).size, d).toBe(p.opciones.length);
    // why the right one is right: the book's sentence («Del libro») or the app's checked working («Desarrollo»)
    expect(sinEtiquetas(p.explicacion ?? '').length, d).toBeGreaterThan(10);
    // why each wrong one is wrong, keyed by the shown index; nothing for the right one
    const malas = p.opciones.map((_, i) => i).filter((i) => i !== p.correcta);
    expect(Object.keys(p.porque ?? {}).map(Number).sort((a, b) => a - b), d).toEqual(malas);
    for (const i of malas) expect(sinEtiquetas(p.porque![String(i)]!).length, `${d}/${i}`).toBeGreaterThan(10);
    // exactly one option is accepted
    const aceptadas = p.opciones.map((_, i) => comprobarPregunta(p, String(i)).tipo).filter((t) => t === 'bien');
    expect(aceptadas, d).toEqual(['bien']);
    expect(comprobarPregunta(p, String(p.correcta)).tipo, d).toBe('bien');
  }
  expect(n).toBe(280);
});

test('cada orden tiene una sola solución y cada emparejamiento usa todas sus categorías', () => {
  let no = 0;
  let nc = 0;
  for (const { l, p } of todas()) {
    const d = `${l}/${p.id}`;
    if (p.tipo === 'orden') {
      no++;
      expect(p.elementos.length, d).toBeGreaterThanOrEqual(3);
      expect(new Set(p.elementos.map(sinEtiquetas)).size, d).toBe(p.elementos.length);
      expect([...p.mezcla].sort((a, b) => a - b), d).toEqual(p.elementos.map((_, i) => i));
      expect(p.mezcla.every((x, i) => x === i), d).toBe(false);
      const bien = p.elementos.map((_, i) => i);
      expect(comprobarPregunta(p, escribirLista(bien)).tipo, d).toBe('bien');
      // any other order is not accepted (every swap of two places)
      for (let a = 0; a < bien.length; a++)
        for (let b = a + 1; b < bien.length; b++) {
          const o = [...bien];
          [o[a], o[b]] = [o[b]!, o[a]!];
          expect(comprobarPregunta(p, escribirLista(o)).tipo, `${d} ${o}`).not.toBe('bien');
        }
      expect(sinEtiquetas(p.explicacion ?? '').length, d).toBeGreaterThan(10);
    }
    if (p.tipo === 'clasificar') {
      nc++;
      expect(new Set(p.categorias.map(sinEtiquetas)).size, d).toBe(p.categorias.length);
      expect(new Set(p.elementos.map((e) => sinEtiquetas(e.texto))).size, d).toBe(p.elementos.length);
      expect(new Set(p.elementos.map((e) => e.cat)).size, `${d}: una categoría sin elementos`).toBe(p.categorias.length);
      const bien = p.elementos.map((e) => e.cat);
      expect(comprobarPregunta(p, escribirLista(bien)).tipo, d).toBe('bien');
      for (let k = 0; k < bien.length; k++) {
        const o = [...bien];
        o[k] = (o[k]! + 1) % p.categorias.length;
        expect(comprobarPregunta(p, escribirLista(o)).tipo, `${d} ${o}`).not.toBe('bien');
      }
      expect(sinEtiquetas(p.explicacion ?? '').length, d).toBeGreaterThan(10);
    }
  }
  expect([no, nc]).toEqual([20, 54]);
});

test('los valores numéricos salen del enunciado (o de lo que se pide) por otro camino', () => {
  const esperado = (l: string, k: number) => items[l]!.respuestas[k] as { valor: number; unidad: string; tol?: number; tol_abs?: number; texto: string };
  const bloques = (l: string) => L.libro.bloques(l)!;
  // ej-52.1: Nyquist, twice the highest frequency of the statement
  const e52 = texto(bloques('ej-52.1').enunciado);
  const f = Number(/(\d+)\s*MHz/.exec(e52)![1]) * 1e6;
  expect(f).toBe(100e6);
  expect(esperado('ej-52.1', 0).valor).toBeCloseTo(2 * f, 0);
  expect(esperado('ej-52.1', 0).unidad).toBe('S/s');
  expect(comprobar('200 MS/s', esperado('ej-52.1', 0) as any).tipo).toBe('bien');
  expect(comprobar('100 MS/s', esperado('ej-52.1', 0) as any).tipo).not.toBe('bien');
  // ej-20.8: a 1 % error over one day, in minutes; the book's «un cuarto de hora» is inside the tolerance
  expect(texto(bloques('ej-20.8').solucion)).toContain('un cuarto de hora');
  expect(esperado('ej-20.8', 0).valor).toBeCloseTo(0.01 * 24 * 60, 6);
  expect(esperado('ej-20.8', 0).unidad).toBe('min');
  expect(comprobar('15 min', esperado('ej-20.8', 0) as any).tipo).toBe('bien');
  expect(comprobar('14,4 min', esperado('ej-20.8', 0) as any).tipo).toBe('bien');
  expect(comprobar('864 s', esperado('ej-20.8', 0) as any).tipo).toBe('bien');
  expect(comprobar('2,4 h', esperado('ej-20.8', 0) as any).tipo).not.toBe('bien');
  // ej-14.1: halving 16 stages takes log2(16) measurements; one by one, half of them on average
  const s14 = texto(bloques('ej-14.1').solucion);
  expect(s14).toContain('4 medidas para 16 etapas frente a 8 de media una a una');
  let etapas = 16;
  let medidas = 0;
  while (etapas > 1) {
    etapas = Math.ceil(etapas / 2);
    medidas++;
  }
  expect(esperado('ej-14.1', 0).valor).toBe(medidas);
  expect(esperado('ej-14.1', 1).valor).toBe(16 / 2);
  expect(comprobar('4', esperado('ej-14.1', 0) as any).tipo).toBe('bien');
  expect(comprobar('5', esperado('ej-14.1', 0) as any).tipo).not.toBe('bien');
  // only these three carry numeric fields among the converted ones
  expect(CONVERTIDOS.filter((l) => items[l]!.respuestas.length)).toEqual(['ej-20.8', 'ej-52.1', 'ej-14.1']);
});

test('XP: un convertido sigue las reglas de los autocomprobables; uno autoevaluado no da XP', () => {
  // the check that solves it: every part right is «completo» (Comprobador) and gives the auto rules' XP
  for (const l of CONVERTIDOS) {
    const it = items[l]!;
    for (const p of preguntas(l)) {
      const v = p.tipo === 'eleccion' ? String(p.correcta) : p.tipo === 'orden' ? escribirLista(p.elementos.map((_, i) => i)) : p.tipo === 'clasificar' ? escribirLista(p.elementos.map((e) => e.cat)) : '';
      expect(comprobarPregunta(p, v).tipo, `${l}/${p.id}`).toBe('bien');
    }
    for (const r of it.respuestas) expect(comprobar(r.texto, r, r.alternativas).tipo, `${l}/${r.id}`).toBe('bien');
  }
  expect(xpEjercicio({ fallos: 0, pistas: 0, solucion: false })).toBe(XP.ejercicio);
  expect(xpEjercicio({ fallos: 1, pistas: 0, solucion: false })).toBe(XP.ejercicioConAyuda);
  expect(xpEjercicio({ fallos: 0, pistas: 2, solucion: false })).toBe(XP.ejercicioConAyuda);
  // opening the solution cancels it, and a self-assessment always counts as an opened solution (aprendizaje.svelte.ts
  // autoevaluar; browser test in razonar11-navegador.spec.ts)
  expect(xpEjercicio({ fallos: 0, pistas: 0, solucion: true })).toBe(0);
  const fuente = fs.readFileSync(path.join(LIBRO, '..', '..', 'src', 'lib', 'aprendizaje.svelte.ts'), 'utf8');
  const auto = fuente.slice(fuente.indexOf('export function autoevaluar'), fuente.indexOf('export function', fuente.indexOf('export function autoevaluar') + 10));
  expect(auto).toMatch(/e\.solucion = true;[\s\S]*marcarResuelto\(e, bien, ahora\)/);
});

test('práctica inteligente, problema del día, dominio y variantes: los convertidos son candidatos y no tienen variante', () => {
  const conceptos = JSON.parse(fs.readFileSync(path.join(LIBRO, 'conceptos.json'), 'utf8')) as { partes: Record<string, string[]> };
  const variantes = JSON.parse(fs.readFileSync(path.join(LIBRO, 'practica', 'indice.json'), 'utf8')).ejercicios as Record<string, string>;
  for (const l of CONVERTIDOS) {
    const it = items[l]!;
    // lib/aprendizaje/catalogo.ts: modo auto, something to check and a section (its concept)
    expect(it.seccion, l).toBeTruthy();
    expect(conceptos.partes[it.parte] ?? [], l).toContain(it.seccion);
    // practica10 links no formula to them: no «Practicar con otros valores», nor variants in the exams
    expect(variantes[l], l).toBeUndefined();
  }
});

test('modo docente: el examen los califica solos (sin parte pendiente) y las soluciones explican cada opción incorrecta', async () => {
  const sinAbierta = CONVERTIDOS.filter((l) => !CON_PARTE_ABIERTA.includes(l));
  const ex = montarExamen({ items: sinAbierta.map((ref) => ({ k: 'ejercicio' as const, ref, puntos: 1 })), minutos: 0, variantes: true, barajar: true, semilla: 7, espacio: 'no' }, ctx, 0);
  for (const m of ex.items) {
    const it = items[m.ref]!;
    expect(m.variante ?? null, m.ref).toBeNull();
    const vacio = calificarItem(m, ctx, {});
    expect(vacio.estado, m.ref).toBe('blanco');
    const valores: Record<string, string> = {};
    for (const p0 of (it.preguntas ?? []) as Pregunta[]) {
      const p = preguntaVista(p0, m.opciones?.[p0.id]);
      valores[p.id] = p.tipo === 'eleccion' ? String(p.correcta) : p.tipo === 'orden' ? escribirLista(p.elementos.map((_, i) => i)) : escribirLista((p as any).elementos.map((e: any) => e.cat));
      // a shuffled choice keeps each explanation with its own option
      if (p.tipo === 'eleccion' && p0.tipo === 'eleccion' && m.opciones?.[p0.id]) {
        const orden = m.opciones[p0.id]!;
        orden.forEach((k, i) => expect(p.porque?.[String(i)], `${m.ref}/${p.id}`).toBe(p0.porque?.[String(k)]));
      }
    }
    for (const r of it.respuestas) valores[r.id] = r.texto;
    expect(calificarItem(m, ctx, valores).estado, m.ref).toBe('bien');
  }
  // the 8 with an open part: graded right, the open part waits for the self-assessment (as the 125 of 1.0)
  for (const l of CON_PARTE_ABIERTA) {
    const [m] = montarExamen({ items: [{ k: 'ejercicio', ref: l, puntos: 1 }], minutos: 0, variantes: false, barajar: false, semilla: 1, espacio: 'no' }, ctx, 0).items;
    expect(calificarItem(m!, ctx, { texto: 'algo' }).estado, l).toBe('pendiente');
  }
  // the solutions PDF prints «Por qué no …» for each wrong option (here, ej-4.8: two questions of three options)
  const muestra = montarExamen({ items: [{ k: 'ejercicio', ref: 'ej-4.8', puntos: 2 }, { k: 'ejercicio', ref: 'ej-10.2', puntos: 2 }], minutos: 0, variantes: false, barajar: false, semilla: 1, espacio: 'no' }, ctx, 0);
  const O = { titulo: 'Razonar', notas: '', fecha: '10 de noviembre de 2026', espacio: 'no' as const, creado: Date.UTC(2026, 10, 10) };
  const sol = planoPdf((await leerPdf((await generarPdf(documentoSoluciones(muestra, L.libro, O), recursosNode)).bytes)).texto.join(' ').replace(/[   ]/g, ' '));
  expect(sol.match(/Por qué no [A-D]\):/g) ?? []).toHaveLength(4 + 2);
  expect(sol).toContain(planoPdf('Saturado, el flujo deja de crecer con la corriente'));
  expect(sol).toContain('Del libro');
});
