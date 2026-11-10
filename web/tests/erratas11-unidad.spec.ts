// 1.1 errata of the book's exercise solutions (independent recalculation, scratchpad libro11/recalculo.md): problems
// 1.B and 3.B (probable errata of the book: the app accepts the right value, never the printed one, and says why),
// 33.A (12,3 bits or the integer 13), 43.B (one answer only: what the book recommends; a note on 10⁸ vs 1,2·10⁸),
// 5.B and 35.B (the datum the book's solution uses and the statement leaves out, curated `dato:`), and then the same
// `dato:` in all 34 exercises the recalculation classed «ambigüedad del enunciado» (data-driven). Each test fails on
// the 1.0 data and passes once fixed. Checked in Node with the app's own code: the field checker (lib/magnitudes.ts),
// the structured questions (lib/preguntas-ejercicio.ts), the exam grading and the teacher-mode PDFs.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.docente10.config.ts tests/erratas11-unidad.spec.ts
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { cargarLibro, LIBRO, recursosNode } from './docente10/libro-node';
import { leerPdf, plano } from './docente10/leer-pdf';
import { comprobar } from '../src/lib/magnitudes';
import { comprobarPregunta } from '../src/lib/preguntas-ejercicio';
import { calificarItem, montarExamen, type ContextoExamen } from '../src/lib/docente/examen';
import { documentoExamen, documentoSoluciones } from '../src/lib/docente/pdf/documento';
import { generarPdf } from '../src/lib/docente/pdf/maquetar';
import type { DatosEjercicios, ItemEjercicio } from '../src/lib/ejercicios.svelte';
import type { ItemPractica } from '../src/componentes/practica/tipos';

const L = cargarLibro();
const ctx: ContextoExamen = L.libro;
const datos = JSON.parse(fs.readFileSync(path.join(LIBRO, 'ejercicios.json'), 'utf8')) as DatosEjercicios;
const item = (label: string): ItemEjercicio => datos.items[label]!;
/** The verdict of what the reader types in one field, as Comprobador.svelte checks it. */
const veredicto = (label: string, r: string, texto: string) => {
  const x = item(label).respuestas.find((y) => y.id === r)!;
  return comprobar(texto, x, x.alternativas);
};
const sinHtml = (s: string | undefined) => (s ?? '').replace(/<[^>]+>/g, '');

test('1.B: la pérdida del cable de 6 mm² a 60 °C es 1,33 W; los 1,15 W del libro (a 20 °C) no valen y se avisa', () => {
  const e = item('prob-1.B');
  expect(veredicto('prob-1.B', 'r3', '1,33 W').tipo).toBe('bien');
  expect(veredicto('prob-1.B', 'r3', '1,327').tipo).toBe('bien');
  expect(veredicto('prob-1.B', 'r3', '1,72 W')).toMatchObject({ tipo: 'bien', nota: 'con 4 mm² a 20 °C' });
  expect(veredicto('prob-1.B', 'r3', '1,15 W').tipo).toBe('mal');
  const r3 = e.respuestas.find((r) => r.id === 'r3')!;
  expect([r3.valor, ...r3.alternativas.map((a) => a.valor)]).not.toContain(1.15);
  expect(e.errata).toContain('1,15 W');
  expect(e.errata).toContain('20 °C');
  expect(e.errata).toContain('1,33 W');
});

test('3.B: la eficaz por diodo es 1,19 A (1,68 A es la del secundario); 1,68 A no vale y se avisa', () => {
  const e = item('prob-3.B');
  const r5 = e.respuestas.find((r) => r.id === 'r5')!;
  expect(r5.nombre).toBe('Corriente eficaz por diodo');
  expect(veredicto('prob-3.B', 'r5', '1,19 A').tipo).toBe('bien');
  expect(veredicto('prob-3.B', 'r5', '1188 mA').tipo).toBe('bien');
  expect(veredicto('prob-3.B', 'r5', '1,68 A').tipo).toBe('mal');
  expect([r5.valor, ...r5.alternativas.map((a) => a.valor)]).not.toContain(1.68);
  expect(e.errata).toContain('1,68 A');
  expect(e.errata).toContain('secundario');
  expect(e.errata).toContain('1,19 A');
  // the other fields are the book's, unchanged
  expect(veredicto('prob-3.B', 'r4', '8,39 A').tipo).toBe('bien');
});

test('33.A: valen 12,3 bits (log₂ 5000, el libro) y 13, el número entero de bits; 12 no llega', () => {
  expect(veredicto('prob-34.A', 'r1', '12,3')).toMatchObject({ tipo: 'bien', nota: 'log₂ 5000' });
  expect(veredicto('prob-34.A', 'r1', '13')).toMatchObject({ tipo: 'bien', nota: 'número entero de bits del convertidor' });
  expect(veredicto('prob-34.A', 'r1', '12').tipo).not.toBe('bien');
  expect(veredicto('prob-34.A', 'r1', '14').tipo).not.toBe('bien');
  // the exam grading (modo docente) uses the same answers
  const m = montarExamen({ items: [{ k: 'ejercicio', ref: 'prob-34.A', puntos: 1 }], minutos: 0, variantes: false, barajar: false, semilla: 1, espacio: 'no' }, ctx, 0).items[0]!;
  expect(calificarItem(m, ctx, { r1: '13' }).partes.find((p) => p.id === 'r1')!.nota).toBe(1);
  expect(calificarItem(m, ctx, { r1: '12' }).partes.find((p) => p.id === 'r1')!.nota).toBeLessThan(1);
});

test('43.B: la pregunta es qué velocidad recomienda el libro (una sola respuesta) y una nota cuenta lo de 10⁸ y 1,2·10⁸', () => {
  const e = item('prob-44.B');
  const p = e.preguntas!.find((q) => q.id === 'p1')!;
  expect(p.tipo).toBe('eleccion');
  if (p.tipo !== 'eleccion') return;
  expect(p.enunciado).toContain('recomienda el libro');
  const correctas = p.opciones.map((_, k) => k).filter((k) => comprobarPregunta(p, String(k)).tipo === 'bien');
  expect(correctas.map((k) => p.opciones[k])).toEqual(['500 kbit/s, con margen']);
  expect(comprobarPregunta(p, String(p.opciones.indexOf('1 Mbit/s, al límite'))).tipo).not.toBe('bien');
  expect(e.nota).toContain('10⁸');
  expect(e.nota).toContain('1,2·10⁸');
  // the reviewed «por qué no» of the wrong option still fits the question (porque10.mjs, key unchanged)
  const porque = JSON.parse(fs.readFileSync(path.join(LIBRO, 'porque', 'cap44.json'), 'utf8')) as { ejercicios: Record<string, Record<string, { k: string; html?: string }>> };
  const k = String(p.opciones.indexOf('1 Mbit/s, al límite'));
  expect(sinHtml(porque.ejercicios['prob-44.B/p1']?.[k]?.html)).toContain('muy poco margen');
});

test('5.B y 35.B: el dato que usa la solución del libro (0,4 Ω de devanado; 2,4 GHz) está junto a lo que se pide', () => {
  expect(item('prob-5.B').dato).toContain('0,4 Ω');
  expect(item('prob-36.B').dato).toContain('2,4 GHz');
  // with that datum the book's answers are the accepted ones
  expect(veredicto('prob-5.B', 'r2', '13 VA').tipo).toBe('bien');
  expect(veredicto('prob-5.B', 'r4', '39 A').tipo).toBe('bien');
  expect(veredicto('prob-36.B', 'r2', '4986 m').tipo).toBe('bien');
  // only the 34 «ambigüedad del enunciado» items carry a datum (next test), these two among them
  expect(Object.entries(datos.items).filter(([, x]) => x.dato).map(([l]) => l).sort()).toEqual(Object.keys(DATOS).sort());
});

// The 34 exercises the recalculation classed «ambigüedad del enunciado»: the book's solution uses a datum its statement
// does not give. Each label (app id; book number in the comment) with a fragment of the curated `dato:` taken from the
// book's own solution; with it the book's values follow (recalculo.md). Scratchpad datos-enunciados.md lists the line
// each statement should gain in the next edition.
const DATOS: Record<string, string> = {
  'prob-1.A': '100 ppm/°C', // 1.A
  'prob-3.C': '30 % de la corriente de salida', // 3.C
  'prob-4.B': 'N1 = 1000 y N2 = 110', // 4.B
  'prob-5.B': '0,4 Ω de resistencia de devanado', // 5.B
  'prob-6.A': 'R1 = 47 kΩ', // 6.A
  'prob-8.C': 'Ron nominal (100 Ω)', // 8.C
  'prob-10.A': '0,1 Ω', // 10.A
  'prob-10.B': '0,7 eV', // 10.B
  'prob-10.C': 'mayor que 5τ', // 10.C
  'prob-11.A': 'tiene ocho', // 11.A
  'prob-12.B': '0,05 % típico y 0,5 % garantizado', // 12.B
  'prob-13.A': 'junta a 220 °C y placa a 25 °C', // 13.A
  'prob-15.A': '10 nH/cm', // 14.A
  'prob-17.A': 'condensador de muestreo de 14 pF', // 16.A
  'prob-18.A': 'también la del optoacoplador de 300 %', // 17.A
  'prob-19.A': 'bytes totales de la trama', // 18.A
  'prob-19.B': '200 µs', // 18.B
  'prob-19.C': '±20 ppm cada una', // 18.C
  'prob-20.B': '100 pF por metro', // 19.B
  'prob-27.A': '4,5 V', // 26.A
  'prob-28.B': 't ≈ 1,4/BW', // 27.B
  'prob-33.B': '0,15 W de pérdidas en el núcleo', // 32.B
  'prob-34.B': 'convierte en 10 µs', // 33.B
  'prob-36.B': '2,4 GHz', // 35.B
  'prob-36.C': 'permitividad efectiva de unos 3,3', // 35.C
  'prob-38.C': 'dos ciclos de reloj', // 37.C
  'prob-39.A': 'rinde un 92 %', // 38.A
  'prob-39.B': '0,05 C', // 38.B
  'prob-39.C': 'plomo AGM 35 Wh/kg y 3 %/mes', // 38.C
  'prob-40.A': 'εr ≈ 4,5', // 39.A
  'prob-40.B': '25 µm de metalizado', // 39.B
  'prob-44.A': '10 pF por dispositivo', // 43.A
  'prob-47.B': '0,7 °C/W con ventilador rápido', // 46.B
  'ej-53.4': 'dos veces la potencia del equipo', // 52.12
};

test('los 34 datos que usa la solución del libro: presentes, no vacíos, fuera del resumen, en el examen y en las soluciones del modo docente', async () => {
  test.setTimeout(240_000);
  const refs = Object.keys(DATOS);
  expect(refs).toHaveLength(34);
  const compacto = (s: string) => plano(sinHtml(s)).replace(/\s+/g, '');
  for (const [label, trozo] of Object.entries(DATOS)) {
    const d = item(label).dato;
    expect(d, label).toBeTruthy();
    expect(sinHtml(d).trim().length, label).toBeGreaterThan(10);
    expect(sinHtml(d), label).toContain(trozo);
    // a data line, not a hidden answer key nor a stray mark-up
    expect(d, label).not.toMatch(/[_^]|\*\*/);
    // not part of the list summary (the panel shows it: erratas11-navegador.spec.ts, the same 34)
    expect(item(label).resumen ?? '', label).not.toContain(sinHtml(d).slice(0, 30));
  }
  const ex = montarExamen({ items: refs.map((ref) => ({ k: 'ejercicio' as const, ref, puntos: 1 })), minutos: 0, variantes: false, barajar: false, semilla: 3, espacio: 'no' }, ctx, 0);
  expect(ex.items.map((m) => m.ref)).toEqual(refs);
  const O = { titulo: 'Datos', notas: '', fecha: '9 de noviembre de 2026', espacio: 'no' as const, creado: Date.UTC(2026, 10, 9) };
  // the text of every page without its furniture (running title and «Página n de N»), so a datum may cross a page
  const textoDe = async (doc: Parameters<typeof generarPdf>[0]) => {
    const r = await generarPdf(doc, recursosNode);
    expect(r.faltan).toEqual([]);
    const pdf = await leerPdf(r.bytes);
    const cab = compacto(doc.cabecera);
    return pdf.texto.map((t, i) => compacto(t).replace(`Página${i + 1}de${pdf.paginas}`, '').replace(i > 0 ? cab : '\u0000', '')).join('');
  };
  const examen = await textoDe(documentoExamen(ex, L.libro, O));
  const sol = await textoDe(documentoSoluciones(ex, L.libro, O));
  for (const label of refs) {
    const linea = compacto(`Dato que usa la solución del libro: ${item(label).dato}`);
    expect(examen, `${label} en el examen`).toContain(linea);
    expect(sol, `${label} en las soluciones`).toContain(linea);
  }
});

test('los valores que cambian de estos problemas no tocan lo corregido (ninguna variante pide la pérdida, la eficaz por diodo, los bits ni la velocidad)', () => {
  const refs = ['prob-1.B', 'prob-3.B', 'prob-5.B', 'prob-34.A', 'prob-44.B', 'prob-36.B'];
  const indice = JSON.parse(fs.readFileSync(path.join(LIBRO, 'practica', 'indice.json'), 'utf8')) as { partes: string[]; ejercicios: Record<string, string> };
  // no practice item reproduces one of these exercises' answers (so no exam variant of them)
  for (const r of refs) expect(indice.ejercicios[r], r).toBeUndefined();
  const items = ['cap01', 'cap03', 'cap05', 'cap34', 'cap36', 'cap44'].flatMap(
    (p) => (JSON.parse(fs.readFileSync(path.join(LIBRO, 'practica', `${p}.json`), 'utf8')) as { items: ItemPractica[] }).items,
  );
  const deEstos = items.filter((x) => refs.includes((x as { ref?: string }).ref ?? ''));
  expect(deEstos.map((x) => x.id).sort()).toEqual(['cap01-num-cable-seccion', 'cap03-num-descarga-lineal', 'cap03-num-rizado-tcond', 'cap03-num-tiempo-conduccion', 'cap44-pred-sec-44.13']);
  for (const x of deEstos) expect(x.enunciado, x.id).not.toMatch(/potencia perdida|eficaz|bits|velocidad/i);
});

test('PDF del modo docente: el dato en el examen y en las soluciones; el aviso de errata y la nota en las soluciones', async () => {
  test.setTimeout(120_000);
  const refs = ['prob-1.A', 'prob-1.B', 'prob-3.B', 'prob-5.B', 'prob-6.A', 'prob-34.A', 'prob-44.B', 'prob-36.B'];
  const ex = montarExamen({ items: refs.map((ref) => ({ k: 'ejercicio' as const, ref, puntos: 1 })), minutos: 60, variantes: true, barajar: false, semilla: 7, espacio: 'corto' }, ctx, 0);
  expect(ex.items.map((m) => m.ref)).toEqual(refs);
  const O = { titulo: 'Erratas', notas: '', fecha: '9 de noviembre de 2026', espacio: 'corto' as const, creado: Date.UTC(2026, 10, 9) };
  const textoDe = async (d: Parameters<typeof generarPdf>[0]) => {
    const r = await generarPdf(d, recursosNode);
    expect(r.faltan).toEqual([]);
    return plano((await leerPdf(r.bytes)).texto.join(' ').replace(/[   ]/g, ' '));
  };
  const examen = await textoDe(documentoExamen(ex, L.libro, O));
  expect(examen).toContain('Dato que usa la solución del libro: el transformador tiene 0,4 Ω de resistencia de devanado');
  expect(examen).toContain('Dato que usa la solución del libro: el enlace trabaja a 2,4 GHz');
  expect(examen).toContain('¿Qué velocidad recomienda el libro para los 100 m de cable?');
  // the exam paper does not give the answers away
  expect(examen).not.toContain('Aviso sobre el libro');
  const sol = await textoDe(documentoSoluciones(ex, L.libro, O));
  expect(sol).toContain('Dato que usa la solución del libro: el transformador tiene 0,4 Ω');
  expect(sol).toContain('Dato que usa la solución del libro: el enlace trabaja a 2,4 GHz');
  expect(sol).toContain('Aviso sobre el libro: El resultado del libro (caída de 0,23 V, pérdida de 1,15 W)');
  expect(sol).toContain('Aviso sobre el libro: El libro dimensiona los diodos para 1,68 A eficaces');
  expect(sol).toContain('Potencia perdida en el cable: 1,33 W');
  expect(sol).toContain('Corriente eficaz por diodo: 1,19 A');
  expect(sol).toMatch(/Bits de resolución para 1 g en 5 kg: 12,3 \(también vale: 13, número entero de bits del convertidor\)/);
  expect(sol).toContain('Nota: El libro dice que el producto longitud × velocidad de RS-485');
  expect(sol).not.toContain(': 1,15 W');
  expect(sol).not.toContain('Corriente eficaz en los diodos');
});
