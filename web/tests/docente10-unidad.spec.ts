// 1.0 «modo docente», without a browser: the bank and its filters, the assembly of an exam (seeded order, options and
// values of each variant), its grading over every item of the book, and the PDFs — built in Node with the same code
// and the same font files as the app, then read back with pdf.js: pages, text (every statement), fonts embedded, no
// character without a glyph, every formula drawn, the same bytes for the same variant.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.docente10.config.ts tests/docente10-unidad.spec.ts
// EPA_PDF_SALIDA=<folder> also writes the PDFs there (to look at them).
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { cargarLibro, LIBRO, recursosNode } from './docente10/libro-node';
import { leerPdf, plano } from './docente10/leer-pdf';
import { bancoDe, elegirPorFiltros, filtrar, FILTROS_VACIOS, puntosPorDefecto } from '../src/lib/docente/banco';
import {
  calificarExamen,
  calificarItem,
  esperadoVariante,
  letraVariante,
  montadoDeResultado,
  montarExamen,
  preguntaVista,
  semillaVariante,
  varianteDe,
  type ContextoExamen,
  type ItemMontado,
} from '../src/lib/docente/examen';
import { escribirCombinacion, escribirLista, type Pregunta as PreguntaEjercicio } from '../src/lib/preguntas-ejercicio';
import type { DefinicionExamen } from '../src/lib/docente/tipos';
import { documentoCurso, documentoExamen, documentoSoluciones } from '../src/lib/docente/pdf/documento';
import { generarPdf, type Documento } from '../src/lib/docente/pdf/maquetar';
import { convertirSvg } from '../src/lib/docente/pdf/svg';
import { variantes } from '../src/componentes/practica/variantes';

const L = cargarLibro();
const ctx: ContextoExamen = L.libro;
const banco = bancoDe(L.banco);
const SALIDA = process.env.EPA_PDF_SALIDA;
const O = { titulo: 'Examen de prueba', notas: 'Conteste en el espacio reservado.', fecha: '6 de noviembre de 2026', espacio: 'corto' as const, creado: Date.UTC(2026, 10, 6) };

// ------------------------------------------------------------------ bank

test('banco: los 486 ejercicios y problemas y las 1028 preguntas, en el orden del libro, con su concepto', () => {
  expect(banco.filter((e) => e.k === 'ejercicio')).toHaveLength(486);
  expect(banco.filter((e) => e.tipo === 'problema')).toHaveLength(113);
  expect(banco.filter((e) => e.k === 'pregunta')).toHaveLength(1028);
  expect(new Set(banco.map((e) => `${e.k}:${e.ref}`)).size).toBe(banco.length);
  expect([...banco].sort((a, b) => a.orden - b.orden).map((e) => e.ref)).toEqual(banco.map((e) => e.ref));
  // every exercise has its section; the questions too, except a few whose reference the book does not place in one
  expect(banco.filter((e) => e.k === 'ejercicio' && !e.concepto)).toEqual([]);
  expect(banco.filter((e) => !e.concepto).length).toBeLessThan(banco.length * 0.05);
  expect(banco.filter((e) => e.variable).length).toBe(Object.keys(L.banco.variables).length);
  // final QA 1.0: «auto» = checked by the app entirely (an exercise with a self-assessed part is `mixto`: 125 of 300)
  expect(banco.filter((e) => e.k === 'ejercicio' && e.auto)).toHaveLength(175);
  expect(banco.filter((e) => e.k === 'ejercicio' && e.mixto)).toHaveLength(125);
});

test('filtros: capítulo, concepto, tipo y «solo lo que se corrige solo»', () => {
  const cap05 = filtrar(banco, { ...FILTROS_VACIOS, partes: ['cap05'] });
  expect(cap05.length).toBeGreaterThan(20);
  expect(cap05.every((e) => e.parte === 'cap05')).toBe(true);
  const conc = cap05.find((e) => e.k === 'ejercicio')!.concepto!;
  const porConcepto = filtrar(banco, { ...FILTROS_VACIOS, partes: ['cap05'], conceptos: [conc] });
  expect(porConcepto.length).toBeGreaterThan(0);
  expect(porConcepto.every((e) => e.concepto === conc)).toBe(true);
  expect(filtrar(banco, { ...FILTROS_VACIOS, tipos: ['problema'] })).toHaveLength(113);
  expect(filtrar(banco, { ...FILTROS_VACIOS, tipos: ['ejercicio', 'problema'], soloAuto: true })).toHaveLength(175);
  expect(filtrar(banco, { ...FILTROS_VACIOS, tipos: ['pregunta'], partes: ['cap05', 'cap09'] }).every((e) => e.k === 'pregunta')).toBe(true);
});

test('elegir al azar: misma semilla, mismo examen; otra semilla, otro; repartido por capítulos, sin repetir y en orden del libro', () => {
  const f = { ...FILTROS_VACIOS, partes: ['cap05', 'cap09', 'cap23'], cantidad: 12 };
  const a = elegirPorFiltros(banco, f, 42);
  expect(elegirPorFiltros(banco, f, 42)).toEqual(a);
  expect(elegirPorFiltros(banco, f, 43)).not.toEqual(a);
  expect(a).toHaveLength(12);
  expect(new Set(a.map((i) => i.ref)).size).toBe(12);
  const partes = a.map((i) => banco.find((e) => e.ref === i.ref)!.parte);
  for (const p of f.partes) expect(partes.filter((x) => x === p).length).toBe(4);
  const orden = a.map((i) => banco.find((e) => e.ref === i.ref)!.orden);
  expect([...orden].sort((x, y) => x - y)).toEqual(orden);
  for (const i of a) expect(i.puntos).toBe(puntosPorDefecto(banco.find((e) => e.ref === i.ref)!));
  // what is already in the exam is left out; asking for more than there is gives what there is
  const b = elegirPorFiltros(banco, f, 42, new Set(a.map((i) => `${i.k}:${i.ref}`)));
  expect(b.some((i) => a.some((x) => x.ref === i.ref))).toBe(false);
  const pocos = { ...FILTROS_VACIOS, partes: ['cap05'], tipos: ['problema' as const] };
  expect(elegirPorFiltros(banco, { ...pocos, cantidad: 500 }, 1).length).toBe(filtrar(banco, pocos).length);
});

// ------------------------------------------------------------------ assembly

const todo = (variantesSi: boolean, barajar: boolean, semilla = 2026): DefinicionExamen => ({
  items: banco.map((e) => ({ k: e.k, ref: e.ref, puntos: puntosPorDefecto(e) })),
  minutos: 90,
  variantes: variantesSi,
  barajar,
  semilla,
  espacio: 'corto',
});

test('montar: cada variante es siempre la misma; otra variante cambia el orden, las opciones y los valores', () => {
  const def = todo(true, true);
  const a = montarExamen(def, ctx, 0);
  expect(montarExamen(structuredClone(def), ctx, 0)).toEqual(a);
  const b = montarExamen(def, ctx, 1);
  expect(a.letra).toBe('A');
  expect(b.letra).toBe('B');
  expect(letraVariante(25)).toBe('Z');
  expect(semillaVariante(def.semilla, 0)).not.toBe(semillaVariante(def.semilla, 1));
  expect(a.items.map((m) => m.ref)).not.toEqual(b.items.map((m) => m.ref));
  expect(new Set(a.items.map((m) => m.ref))).toEqual(new Set(def.items.map((i) => i.ref)));
  expect(a.items.map((m) => m.n)).toEqual(a.items.map((_, i) => i + 1));
  expect(a.maximo).toBe(Math.round(def.items.reduce((s, i) => s + i.puntos, 0) * 100) / 100);
  // options: permutations; Yes/No questions keep the book's order
  let distintas = 0;
  for (const m of a.items) {
    if (m.orden) expect([...m.orden].sort((x, y) => x - y)).toEqual(m.orden.map((_, k) => k));
    for (const [pid, o] of Object.entries(m.opciones ?? {})) {
      const p = ctx.ejercicio(m.ref)!.preguntas!.find((x) => x.id === pid)! as Extract<PreguntaEjercicio, { tipo: 'eleccion' }>;
      expect([...o].sort((x, y) => x - y)).toEqual(p.opciones.map((_, k) => k));
      expect(p.opciones.map((x) => x.replace(/<[^>]+>/g, ''))).not.toEqual(['Sí', 'No']);
    }
    const mb = b.items.find((x) => x.ref === m.ref)!;
    if (JSON.stringify(m.orden) !== JSON.stringify(mb.orden) || m.variante !== mb.variante) distintas++;
  }
  expect(distintas).toBeGreaterThan(300);
  // variants only where a formula of the book reproduces the exercise, and always a valid one
  const conVariante = a.items.filter((m) => m.variante != null);
  expect(conVariante.length).toBe(banco.filter((e) => e.variable && variantes(ctx.numerico(e.ref)!).length).length);
  for (const m of conVariante) expect(varianteDe(m, ctx)).not.toBeNull();
  // without shuffling or variants: the order chosen and the book's values
  const c = montarExamen(todo(false, false), ctx, 3);
  expect(c.items.map((m) => m.ref)).toEqual(banco.map((e) => e.ref));
  expect(c.items.some((m) => m.orden || m.opciones || m.variante != null)).toBe(false);
});

// ------------------------------------------------------------------ grading

/** A right answer to a structured question, in the order shown. */
function respuestaBuena(p: PreguntaEjercicio): string {
  switch (p.tipo) {
    case 'eleccion':
      return String(p.correcta);
    case 'orden':
      return escribirLista(p.elementos.map((_, k) => k));
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

function respuestasBuenas(m: ItemMontado): Record<string, string> {
  if (m.k === 'pregunta') {
    const p = ctx.pregunta(m.ref)!;
    if (p.tipo === 'opcion') return { r: String(m.orden ? m.orden.indexOf(p.correcta) : p.correcta) };
    return { r: p.valor_texto };
  }
  const vr = varianteDe(m, ctx);
  if (vr) return { r1: esperadoVariante(vr.item, vr.v).texto };
  const e = ctx.ejercicio(m.ref)!;
  const v: Record<string, string> = {};
  for (const r of e.respuestas) v[r.id] = r.texto;
  for (const p of e.preguntas ?? []) v[p.id] = respuestaBuena(preguntaVista(p, m.opciones?.[p.id]));
  if (e.modo === 'comparar' || e.otras?.length) v.texto = 'Mi respuesta, para compararla con el libro.';
  return v;
}

const tieneAbierta = (m: ItemMontado) => {
  const e = m.k === 'ejercicio' ? ctx.ejercicio(m.ref)! : null;
  return !!e && m.variante == null && (e.modo === 'comparar' || (e.otras?.length ?? 0) > 0);
};

test('calificar: con las respuestas del libro, todo bien (las partes abiertas esperan la autoevaluación); en blanco, cero', () => {
  for (const def of [todo(false, false), todo(true, true, 7)]) {
    const ex = montarExamen(def, ctx, 1);
    const resp: Record<number, Record<string, string>> = {};
    const auto: Record<number, number> = {};
    for (const m of ex.items) {
      resp[m.n] = respuestasBuenas(m);
      auto[m.n] = 1;
    }
    const sinAuto = calificarExamen(ex, ctx, resp);
    for (const [i, c] of sinAuto.items.entries()) {
      const m = ex.items[i]!;
      expect(c.estado, `${m.ref}: ${c.partes.map((p) => p.mensaje).join(' / ')}`).toBe(tieneAbierta(m) ? 'pendiente' : 'bien');
      if (!tieneAbierta(m)) expect(c.puntos).toBe(m.puntos);
    }
    expect(sinAuto.pendientes).toBe(ex.items.filter(tieneAbierta).length);
    const conAuto = calificarExamen(ex, ctx, resp, auto);
    expect(conAuto.pendientes).toBe(0);
    expect(conAuto.puntos).toBe(ex.maximo);
    expect(conAuto.items.every((c) => c.estado === 'bien')).toBe(true);
    const blanco = calificarExamen(ex, ctx, {}, {});
    expect(blanco.puntos).toBe(0);
    expect(blanco.items.every((c) => c.estado === 'blanco' || c.estado === 'mal')).toBe(true);
    expect(blanco.items.filter((c) => c.estado === 'blanco').length).toBeGreaterThan(ex.items.length * 0.9);
  }
});

test('calificar: «casi» vale la mitad, lo mal cero, la autoevaluación a medias la mitad de esa parte; los puntos se redondean', () => {
  const e = ctx.ejercicio('ej-1.1')!;
  const m: ItemMontado = { k: 'ejercicio', ref: 'ej-1.1', puntos: 3, n: 1 };
  const bien = respuestasBuenas(m);
  const partes = e.respuestas.length + (e.preguntas?.length ?? 0) + (e.modo === 'comparar' || e.otras?.length ? 1 : 0);
  const r1 = e.respuestas[0]!;
  // a wrong power of ten: «casi»
  const c = calificarItem(m, ctx, { ...bien, [r1.id]: String(r1.valor * 1000).replace('.', ',') }, 1);
  expect(c.estado).toBe('parcial');
  expect(c.partes.find((p) => p.id === r1.id)!.nota).toBe(0.5);
  expect(c.puntos).toBe(Math.round(((3 * (partes - 0.5)) / partes) * 100) / 100);
  expect(calificarItem(m, ctx, { ...bien, [r1.id]: '12345' }, 1).partes.find((p) => p.id === r1.id)!.nota).toBe(0);
  // an open exercise: only the self-assessment
  const abierto = banco.find((x) => x.k === 'ejercicio' && !x.auto && !x.mixto)!;
  const ma: ItemMontado = { k: 'ejercicio', ref: abierto.ref, puntos: 2, n: 1 };
  expect(calificarItem(ma, ctx, { texto: 'algo' }).estado).toBe('pendiente');
  expect(calificarItem(ma, ctx, { texto: 'algo' }, 0.5).puntos).toBe(1);
  expect(calificarItem(ma, ctx, {}, 0).estado).toBe('mal');
  // nothing written: blank (0), not waiting for a self-assessment
  expect(calificarItem(ma, ctx, {}).estado).toBe('blanco');
  // a test question: the position shown, not the book's
  expect(L.porId.get('cap05-01')!.tipo).toBe('opcion');
  const mq: ItemMontado = { k: 'pregunta', ref: 'cap05-01', puntos: 1, n: 1, orden: [3, 1, 0, 2] };
  expect(calificarItem(mq, ctx, { r: '1' }).estado).toBe('bien');
  expect(calificarItem(mq, ctx, { r: '0' }).estado).toBe('mal');
  // a stored result is regraded as it was shown
  const guardado = montadoDeResultado({ k: 'pregunta', ref: 'cap05-01', puntos: 0, maximo: 1, valores: { r: '1' }, estado: 'mal', orden: [3, 1, 0, 2] }, 1);
  expect(calificarItem(guardado, ctx, { r: '1' }).estado).toBe('bien');
});

test('variantes: el valor del libro no vale en otra variante; el de la variante sí', () => {
  const ex = montarExamen(todo(true, false, 99), ctx, 0);
  let comprobadas = 0;
  for (const m of ex.items) {
    const vr = varianteDe(m, ctx);
    if (!vr) continue;
    const esp = esperadoVariante(vr.item, vr.v);
    expect(calificarItem(m, ctx, { r1: esp.texto }).estado).toBe('bien');
    const libro = ctx.ejercicio(m.ref)!.respuestas.find((r) => r.unidad === esp.unidad && Math.abs(r.valor - esp.valor) / Math.abs(esp.valor) > 0.15);
    if (libro) {
      expect(calificarItem(m, ctx, { r1: libro.texto }).estado).not.toBe('bien');
      comprobadas++;
    }
  }
  expect(comprobadas).toBeGreaterThan(10);
});

// ------------------------------------------------------------------ PDF

/** Plain text of the start of an exercise's statement (up to its first formula), as it must appear in the PDF. */
function inicioEnunciado(ref: string): string {
  const b = L.libro.bloques(ref)!.enunciado.find((x) => x.t === 'p') as { html: string } | undefined;
  if (!b) return '';
  const html = b.html.split('<img')[0]!;
  const t = plano(html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[   ]/g, ' '));
  return t.split(' ').slice(0, 6).join(' ');
}

const contarGraficos = (d: Documento) => {
  let n = 0;
  for (const b of d.bloques) {
    if (b.k === 'ecuacion' || b.k === 'figura') n++;
    const trozos = b.k === 'parrafo' ? [...b.trozos, ...(b.etiqueta ?? [])] : b.k === 'tabla' ? [...b.filas.flat(2), ...(b.pie ?? [])] : b.k === 'figura' ? b.pie : [];
    n += trozos.filter((t) => t.t === 'mate').length;
  }
  return n;
};

test('PDF de todo el libro (examen y soluciones, con variantes): ningún carácter sin glifo, todas las fórmulas, todos los enunciados', async () => {
  test.setTimeout(900_000);
  const ex = montarExamen(todo(true, true, 31), ctx, 0);
  for (const [nombre, d] of [
    ['examen', documentoExamen(ex, L.libro, O)],
    ['soluciones', documentoSoluciones(ex, L.libro, O)],
  ] as const) {
    const r = await generarPdf(d, recursosNode);
    if (SALIDA) fs.writeFileSync(`${SALIDA}/libro-${nombre}.pdf`, r.bytes);
    expect(r.faltan, nombre).toEqual([]);
    expect(r.graficos.fallidos, nombre).toEqual([]);
    expect(r.graficos.aproximados, nombre).toBe(0);
    expect(r.graficos.vector + r.graficos.raster + r.graficos.fotos, nombre).toBe(contarGraficos(d));
    const l = await leerPdf(r.bytes);
    expect(l.paginas).toBe(r.paginas);
    expect(l.fuentes.length).toBeGreaterThan(3);
    expect(l.fuentes.filter((f) => !f.incrustada)).toEqual([]);
    // the formulas are drawn: fills on the pages, at least one per formula drawn as a vector
    expect(l.rellenos.reduce((a, x) => a + x, 0)).toBeGreaterThanOrEqual(r.graficos.vector);
    const texto = plano(l.texto.join(' ').replace(/[   ]/g, ' '));
    for (const m of ex.items) expect(texto.includes(`${m.n}. `), m.ref).toBe(true);
    if (nombre === 'examen') {
      let vistos = 0;
      for (const m of ex.items) {
        if (m.k === 'pregunta') {
          const ini = plano(ctx.pregunta(m.ref)!.enunciado.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')).split(' ').slice(0, 6).join(' ');
          expect(texto.includes(ini), `${m.ref}: ${ini}`).toBe(true);
        } else if (m.variante == null) {
          const ini = inicioEnunciado(m.ref);
          if (ini.split(' ').length >= 3) {
            expect(texto.includes(ini), `${m.ref}: ${ini}`).toBe(true);
            vistos++;
          }
        }
      }
      expect(vistos).toBeGreaterThan(300);
      for (const t of ['Nombre:', 'Fecha: 6 de noviembre de 2026', 'Variante A', 'Calificación:']) expect(texto.includes(t), t).toBe(true);
    } else {
      expect(texto.includes('Del libro · Sección')).toBe(true);
      expect(/Solución \d+\.\d+ del libro/.test(texto)).toBe(true);
      expect(texto.includes('Desarrollo del libro (con los valores del enunciado original)')).toBe(true);
    }
  }
});

test('PDF reproducible: la misma variante da los mismos bytes; otra variante, otros', async () => {
  const items = elegirPorFiltros(banco, { ...FILTROS_VACIOS, partes: ['cap03', 'cap05', 'cap09'], cantidad: 15 }, 5);
  const def: DefinicionExamen = { items, minutos: 45, variantes: true, barajar: true, semilla: 777, espacio: 'corto' };
  const pdf = async (v: number, tipo: 'examen' | 'soluciones') => {
    const ex = montarExamen(def, ctx, v);
    return Buffer.from((await generarPdf(tipo === 'examen' ? documentoExamen(ex, L.libro, O) : documentoSoluciones(ex, L.libro, O), recursosNode)).bytes);
  };
  const a = await pdf(0, 'examen');
  expect((await pdf(0, 'examen')).equals(a)).toBe(true);
  expect((await pdf(1, 'examen')).equals(a)).toBe(false);
  const s = await pdf(0, 'soluciones');
  expect((await pdf(0, 'soluciones')).equals(s)).toBe(true);
  // no clock in the file: the exam's own date
  expect(a.toString('latin1')).toContain('/CreationDate (D:20261106');
  if (SALIDA) fs.writeFileSync(`${SALIDA}/reproducible-A.pdf`, a);
});

test('PDF del índice de un curso', async () => {
  const d = documentoCurso(
    {
      titulo: 'Diodos',
      notas: 'Estudie primero la teoría.',
      elementos: [{ k: 'seccion', parte: 'cap05', label: 'sec-5.1' }, { k: 'ejercicio', label: 'ej-5.1' }, { k: 'pregunta', id: 'cap05-01' }],
      creado: 0,
    },
    L.libro,
  );
  const r = await generarPdf(d, recursosNode);
  expect(r.faltan).toEqual([]);
  const l = await leerPdf(r.bytes);
  const texto = plano(l.texto.join(' '));
  expect(l.paginas).toBe(1);
  for (const t of ['Diodos', 'Estudie primero la teoría.', 'Sección 5.1', 'Ejercicio 5.1', 'Pregunta de test 1']) expect(texto).toContain(t);
  expect(l.titulo).toBe('Diodos');
});

test('SVG del libro: las 795 ecuaciones y las 880 figuras se convierten a vectores (las de tramas o máscaras se rasterizan en la aplicación)', () => {
  const aproximadas: string[] = [];
  let n = 0;
  for (const dir of ['ec', 'fig']) {
    for (const f of fs.readdirSync(`${LIBRO}/${dir}`)) {
      if (!f.endsWith('.svg')) continue;
      const c = convertirSvg(fs.readFileSync(`${LIBRO}/${dir}/${f}`, 'utf8'), { transparencia: () => 'G', imagen: () => 'I' });
      expect(c.pintados, f).toBeGreaterThan(0);
      expect(c.ops, f).not.toMatch(/NaN|undefined|Infinity/);
      if (c.noSoportado.length) aproximadas.push(`${dir}/${f}: ${c.noSoportado.join(',')}`);
      n++;
    }
  }
  expect(n).toBe(795 + 880);
  // only figures (never an equation) use patterns or a mask
  expect(aproximadas.every((x) => x.startsWith('fig/'))).toBe(true);
  expect(aproximadas.length).toBeLessThanOrEqual(19);
});
