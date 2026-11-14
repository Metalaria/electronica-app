// 1.1 errata of the book's exercise solutions (independent recalculation, scratchpad libro11/recalculo.md): problems
// 1.B and 3.B (probable errata of the book: the app accepts the right value, never the printed one, and says why),
// 33.A (12,3 bits or the integer 13), 43.B (one answer only: what the book recommends; a note on 10⁸ vs 1,2·10⁸),
// 5.B and 35.B (the datum the book's solution uses and the statement leaves out, curated `dato:`), and then the same
// `dato:` in all 34 exercises the recalculation classed «ambigüedad del enunciado» (data-driven). Each test fails on
// the 1.0 data and passes once fixed. Checked in Node with the app's own code: the field checker (lib/magnitudes.ts),
// the structured questions (lib/preguntas-ejercicio.ts), the exam grading and the teacher-mode PDFs.
// 1.2 (motor12b): book 4.0/4.1 fixed the two errata (1.B and 3.B: its solution now gives 1,33 W at 60 °C and 1,19 A per
// diode) and writes in each statement the datum its solution uses, so the app's «errata» notes and 33 of the 34 curated
// `dato:` lines are gone (README «El libro 4.1 en la aplicación»: what the book already fixes). The checks are ported to
// that native content: the right values accepted and the wrong ones rejected as before, now with the book's own
// solution saying them and no «Aviso sobre el libro»; each of the 34 data is in the book's statement (the exam paper
// prints it), and only 45.A keeps a curated `dato` (the I²C norm's 3 mA at 0,4 V, which its statement does not give).
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
import type { BEjercicios, Bloque, Parte } from '../src/lib/tipos';

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
/** Plain text of blocks, math included (the images keep their Typst source in `alt`), spaces collapsed. */
const textoDe = (bs: Bloque[]) =>
  bs
    .map((b) => (b.t === 'p' ? b.html : ''))
    .join(' ')
    .replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/g, ' $1 ')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '')
    .replace(/&amp;/g, '&')
    .replace(/[\s\u00a0\u202f]+/g, ' ');
const partes = new Map<string, Parte>();
/** The book's statement and solution of an exercise or problem (as lib/ejercicios.svelte.ts bloquesEjercicio). */
function libro(label: string): { enunciado: string; solucion: string } {
  const it = item(label);
  if (!partes.has(it.parte)) partes.set(it.parte, JSON.parse(fs.readFileSync(path.join(LIBRO, 'partes', `${it.parte}.json`), 'utf8')) as Parte);
  const p = partes.get(it.parte)!;
  if (it.tipo === 'ej') {
    const e = (p.bloques[it.pos[0]!] as BEjercicios).items[it.pos[1]!]!;
    return { enunciado: textoDe(e.bloques), solucion: textoDe(e.solucion ?? []) };
  }
  const [h, pide, fin] = it.pos as [number, number, number];
  return { enunciado: textoDe(p.bloques.slice(h + 1, pide + 1)), solucion: textoDe(p.bloques.slice(pide + 1, fin)) };
}

test('1.B: la pérdida del cable de 6 mm² a 60 °C es 1,33 W; los 1,15 W (a 20 °C) no valen, y el libro ya lo dice', () => {
  const e = item('prob-1.B');
  expect(veredicto('prob-1.B', 'r3', '1,33 W').tipo).toBe('bien');
  expect(veredicto('prob-1.B', 'r3', '1,327').tipo).toBe('bien');
  expect(veredicto('prob-1.B', 'r3', '1,72 W')).toMatchObject({ tipo: 'bien', nota: 'con 4 mm² a 20 °C' });
  expect(veredicto('prob-1.B', 'r3', '1,15 W').tipo).toBe('mal');
  const r3 = e.respuestas.find((r) => r.id === 'r3')!;
  expect([r3.valor, ...r3.alternativas.map((a) => a.valor)]).not.toContain(1.15);
  // 4.1: the book's solution gives 1,33 W with the cable at 60 °C (and 1,15 W only at 20 °C): no errata note
  expect(e.errata).toBeUndefined();
  expect(libro('prob-1.B').solucion).toContain('pérdida 1,33 W con el cable a 60 °C (0,23 V y 1,15 W a 20 °C)');
});

test('3.B: la eficaz por diodo es 1,19 A (1,68 A es la del secundario); 1,68 A no vale, y el libro ya lo dice', () => {
  const e = item('prob-3.B');
  const r5 = e.respuestas.find((r) => r.id === 'r5')!;
  expect(r5.nombre).toBe('Corriente eficaz por diodo');
  expect(veredicto('prob-3.B', 'r5', '1,19 A').tipo).toBe('bien');
  expect(veredicto('prob-3.B', 'r5', '1188 mA').tipo).toBe('bien');
  expect(veredicto('prob-3.B', 'r5', '1,68 A').tipo).toBe('mal');
  expect([r5.valor, ...r5.alternativas.map((a) => a.valor)]).not.toContain(1.68);
  // 4.1: the book's solution divides the secondary's 1,68 A by √2: no errata note
  expect(e.errata).toBeUndefined();
  expect(libro('prob-3.B').solucion).toContain('por cada diodo pasan 1,68/√2 = 1,19 A eficaces');
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

test('5.B y 35.B: el dato que usa la solución del libro (0,4 Ω de devanado; 2,4 GHz) está en su enunciado', () => {
  expect(libro('prob-5.B').enunciado).toContain('El transformador tiene 0,4 Ω de resistencia de devanado');
  expect(libro('prob-36.B').enunciado).toContain('El enlace trabaja a 2,4 GHz');
  expect(item('prob-5.B').dato).toBeUndefined();
  expect(item('prob-36.B').dato).toBeUndefined();
  // with that datum the book's answers are the accepted ones
  expect(veredicto('prob-5.B', 'r2', '13 VA').tipo).toBe('bien');
  expect(veredicto('prob-5.B', 'r4', '39 A').tipo).toBe('bien');
  expect(veredicto('prob-36.B', 'r2', '4986 m').tipo).toBe('bien');
  // only 45.A still carries a curated datum (next test)
  expect(Object.entries(datos.items).filter(([, x]) => x.dato).map(([l]) => l)).toEqual(['prob-44.A']);
});

// The 34 exercises the recalculation classed «ambigüedad del enunciado»: the book's solution used a datum its statement
// did not give. Each label (app id; 1.1 book number in the comment) with a fragment of that datum; with it the book's
// values follow (recalculo.md). Book 4.0/4.1 added each one to its statement (1.2: the fragment is the statement's
// wording where it differs from the 1.1 `dato:`); 45.A also keeps the curated datum of the I²C norm.
const DATOS: Record<string, string> = {
  'prob-1.A': '100 ppm/°C', // 1.A
  'prob-3.C': '30 % de la corriente de salida', // 3.C
  'prob-4.B': 'primario de 1000 espiras y secundario de 110', // 4.B
  'prob-5.B': '0,4 Ω de resistencia de devanado', // 5.B
  'prob-6.A': 'R₁ = 47 kΩ', // 6.A
  'prob-8.C': 'con la Ron nominal', // 8.C
  'prob-10.A': '0,1 Ω', // 10.A
  'prob-10.B': '0,7 eV', // 10.B
  'prob-10.C': 'mayor que 5τ', // 10.C
  'prob-11.A': 'Clasifica estos ocho errores', // 11.A
  'prob-12.B': '0,05 % típico y 0,5 % garantizado', // 12.B
  'prob-13.A': 'junta a 220 °C, placa a 25 °C', // 13.A
  'prob-15.A': '10 nH/cm', // 14.A
  'prob-17.A': 'condensador de muestreo de 14 pF', // 16.A
  'prob-18.A': 'también en el de alta CTR', // 17.A
  'prob-19.A': 'bytes totales de la trama', // 18.A
  'prob-19.B': '200 µs', // 18.B
  'prob-19.C': 'cristales de ±20 ppm', // 18.C
  'prob-20.B': '100 pF por metro', // 19.B
  'prob-27.A': '4,5 V', // 26.A
  'prob-28.B': 't ≈ 1,4/BW', // 27.B
  'prob-33.B': '0,15 W de pérdidas en el núcleo', // 32.B
  'prob-34.B': 'convierte en 10 µs', // 33.B
  'prob-36.B': '2,4 GHz', // 35.B
  'prob-36.C': 'εeff ≈ 3,3', // 35.C
  'prob-38.C': 'dos ciclos de reloj', // 37.C
  'prob-39.A': 'rinde un 92 %', // 38.A
  'prob-39.B': '0,05 C', // 38.B
  'prob-39.C': 'plomo AGM 35 Wh/kg, 3 %/mes', // 38.C
  'prob-40.A': 'εr ≈ 4,5', // 39.A
  'prob-40.B': '25 µm de metalizado', // 39.B
  'prob-44.A': '10 pF por dispositivo', // 43.A
  'prob-47.B': '0,7 °C/W con ventilador rápido', // 46.B
  'ej-53.4': 'dos veces la potencia del equipo', // 52.12
};

test('los 34 datos que usa la solución del libro: en su enunciado, en el examen y en las soluciones del modo docente; 45.A con el suyo', async () => {
  test.setTimeout(240_000);
  const refs = Object.keys(DATOS);
  expect(refs).toHaveLength(34);
  const compacto = (s: string) => plano(sinHtml(s)).replace(/\s+/g, '');
  for (const [label, trozo] of Object.entries(DATOS)) expect(libro(label).enunciado, label).toContain(trozo);
  // the one curated datum left: a data line, not a hidden answer key nor a stray mark-up, and not in the list summary
  const d = item('prob-44.A').dato!;
  expect(sinHtml(d)).toContain('3 mA a 0,4 V');
  expect(d).not.toMatch(/[_^]|\*\*/);
  expect(item('prob-44.A').resumen ?? '').not.toContain(sinHtml(d).slice(0, 30));
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
  for (const [label, trozo] of Object.entries(DATOS)) {
    expect(examen, `${label} en el examen`).toContain(compacto(trozo));
    expect(sol, `${label} en las soluciones`).toContain(compacto(trozo));
  }
  const linea = compacto(`Dato que usa la solución del libro: ${item('prob-44.A').dato}`);
  expect(examen).toContain(linea);
  expect(sol).toContain(linea);
  // (only that one: the book's statements give the rest)
  expect(examen.split(compacto('Dato que usa la solución del libro'))).toHaveLength(2);
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
  // (1.2: the 4.1 practice has no prediction tied to 44.B any more)
  expect(deEstos.map((x) => x.id).sort()).toEqual(['cap01-num-cable-seccion', 'cap03-num-descarga-lineal', 'cap03-num-rizado-tcond', 'cap03-num-tiempo-conduccion']);
  for (const x of deEstos) expect(x.enunciado, x.id).not.toMatch(/potencia perdida|eficaz|bits|velocidad/i);
});

test('PDF del modo docente: el dato en el enunciado del examen y de las soluciones; los valores corregidos y la nota en las soluciones', async () => {
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
  expect(examen).toContain('El transformador tiene 0,4 Ω de resistencia de devanado');
  expect(examen).toContain('El enlace trabaja a 2,4 GHz');
  expect(examen).not.toContain('Dato que usa la solución del libro');
  expect(examen).toContain('¿Qué velocidad recomienda el libro para los 100 m de cable?');
  // the exam paper does not give the answers away
  expect(examen).not.toContain('Aviso sobre el libro');
  const sol = await textoDe(documentoSoluciones(ex, L.libro, O));
  expect(sol).toContain('El transformador tiene 0,4 Ω');
  expect(sol).toContain('El enlace trabaja a 2,4 GHz');
  // (4.1: the book fixed both errata, so there is no warning about it)
  expect(sol).not.toContain('Aviso sobre el libro');
  expect(sol).toContain('pérdida 1,33 W con el cable a 60 °C');
  expect(sol).toContain('1,19 A eficaces');
  expect(sol).toContain('Potencia perdida en el cable: 1,33 W');
  expect(sol).toContain('Corriente eficaz por diodo: 1,19 A');
  expect(sol).toMatch(/Bits de resolución para 1 g en 5 kg: 12,3 \(también vale: 13, número entero de bits del convertidor\)/);
  expect(sol).toContain('Nota: El libro dice que el producto longitud × velocidad de RS-485');
  expect(sol).not.toContain(': 1,15 W');
  expect(sol).not.toContain('Corriente eficaz en los diodos');
});
