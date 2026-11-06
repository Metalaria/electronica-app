// Fixes of the final QA 1.0, part B (variants, standard values, teacher-mode exams), without a browser: what the field
// of «Practicar con otros valores» / the exams asks is written with the variant's own values; a statement that asks
// for a standard value is graded against the E12 value; the exam and its PDF say what is asked; the bank's «solo lo que
// la aplicación corrige sola» leaves out every exercise with a self-assessed part.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.ejercicios10.config.ts tests/ejercicios10-qa10b.spec.ts
// (EPA_LIBRO=<copy of web/public/libro> reads a regenerated copy instead of the tree's content.)
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { cargarLibro, LIBRO, recursosNode } from './docente10/libro-node';
import { leerPdf, plano } from './docente10/leer-pdf';
import { bancoDe, filtrar, FILTROS_VACIOS } from '../src/lib/docente/banco';
import { calificarItem, esperadoVariante, montarExamen, varianteDe, type ContextoExamen } from '../src/lib/docente/examen';
import type { DefinicionExamen } from '../src/lib/docente/tipos';
import { documentoExamen, documentoSoluciones } from '../src/lib/docente/pdf/documento';
import { generarPdf } from '../src/lib/docente/pdf/maquetar';
import { comprobarPedido, enunciadoDe, normalizado, pedidoDe, valorTexto, variantes } from '../src/componentes/practica/variantes';
import type { ItemNumerico } from '../src/componentes/practica/tipos';

const DIR = path.join(LIBRO, 'practica');
const enlazados: ItemNumerico[] = fs
  .readdirSync(DIR)
  .filter((f) => /^(cap|ap).*\.json$/.test(f))
  .flatMap((f) => (JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as { items: ItemNumerico[] }).items)
  .filter((it) => it.tipo === 'numerico' && !!it.ejercicio);
const porLabel = (l: string) => enlazados.find((it) => it.ejercicio!.label === l)!;
const sinEtiquetas = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
const L = cargarLibro();
const ctx: ContextoExamen = L.libro;

test('qa10b·a1 lo que se pide en cada variante lleva sus valores, nunca el del libro de un dato que cambia', () => {
  expect(enlazados.length).toBe(40);
  const malos: string[] = [];
  for (const it of enlazados) {
    for (const v of variantes(it)) {
      const p = pedidoDe(it, v);
      const textos = [sinEtiquetas(p.nombre), sinEtiquetas(enunciadoDe(it, v))];
      if (textos.some((t) => t.includes('{{'))) malos.push(`${it.id}: hueco sin rellenar`);
      for (const id of Object.keys(it.varia)) {
        const x = it.formula.vars.find((y) => y.id === id)!;
        const delLibro = valorTexto(it.libro[id]!, x.unidad);
        if (valorTexto(v.valores[id]!, x.unidad) === delLibro) continue;
        if (new RegExp(`(?<![\\d,])${delLibro.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(sinEtiquetas(p.nombre))) malos.push(`${it.id}: «${sinEtiquetas(p.nombre)}» nombra ${delLibro} (${id} = ${valorTexto(v.valores[id]!, x.unidad)})`);
      }
    }
  }
  expect([...new Set(malos)]).toEqual([]);
  // the two the QA found: the frequency and the inductance of the variant
  const e33 = porLabel('ej-3.3');
  const v33 = variantes(e33).find((v) => v.valores.f !== e33.libro.f)!;
  expect(sinEtiquetas(pedidoDe(e33, v33).nombre)).toBe(`XC a ${valorTexto(v33.valores.f!, 'Hz')}`);
  const e4a = porLabel('prob-4.A');
  const v4a = variantes(e4a).find((v) => v.valores.L !== e4a.libro.L)!;
  expect(sinEtiquetas(pedidoDe(e4a, v4a).nombre)).toBe(`Rizado con ${valorTexto(v4a.valores.L!, 'H')}`);
  // «solo» when the book's exercise asks more than the one result
  expect(e33.ejercicio!.solo).toBe(true);
  expect(porLabel('ej-5.6').ejercicio!.solo).toBeUndefined();
});

test('qa10b·a2 un valor normalizado (E12) se corrige con el valor E12 más cercano, exacto; el calculado es «cerca»', () => {
  // every statement that asks for a standard value is graded as one (or its field says it asks the computed value)
  const pide = enlazados.filter((it) => /E12|E24|comercial|normalizad/i.test(it.ejercicio!.html));
  expect(pide.map((it) => it.ejercicio!.label).sort()).toEqual(['ej-3.4', 'ej-5.1']);
  for (const it of pide) {
    expect(it.normalizado, it.id).toBe('E12');
    expect(sinEtiquetas(it.ejercicio!.pide)).toMatch(/^Valor E12 más cercano a la resistencia/);
    const vs = variantes(it);
    expect(vs.length).toBeGreaterThanOrEqual(8);
    for (const v of vs) {
      const p = pedidoDe(it, v);
      const n = normalizado(v.resultado, 'E12')!;
      expect(p.valor).toBe(n.valor);
      expect(comprobarPedido(p.texto, p).tipo, `${it.id} ${p.texto}`).toBe('bien');
      expect(comprobarPedido(valorTexto(n.otro, 'Ω'), p).tipo).toBe('mal');
      const calc = comprobarPedido(valorTexto(v.resultado, 'Ω'), p);
      if (Math.abs(v.resultado - n.valor) / n.valor > 0.006) expect(calc).toEqual({ tipo: 'cerca', mensaje: 'Ese es el valor calculado; se pide el valor E12 más cercano a él.' });
      // a clear choice: never a near tie between two E12 values
      expect(Math.abs(n.otro - v.resultado) - Math.abs(n.valor - v.resultado)).toBeGreaterThan(2 * it.tol * v.resultado);
    }
  }
  // the QA's case: 1,5 kHz and 47 nF → 2,26 kΩ: «2,2 kΩ» is right, in practice and in an exam
  const e34 = porLabel('ej-3.4');
  const v = variantes(e34).find((x) => x.valores.f === 1500 && x.valores.C === 4.7e-8);
  if (v) expect(comprobarPedido('2,2 kΩ', pedidoDe(e34, v)).tipo).toBe('bien');
  const def: DefinicionExamen = { items: [{ k: 'ejercicio', ref: 'ej-3.4', puntos: 2 }], minutos: 0, variantes: true, barajar: false, semilla: 5, espacio: 'no' };
  for (let n = 0; n < 6; n++) {
    const m = montarExamen(def, ctx, n).items[0]!;
    const vr = varianteDe(m, ctx)!;
    const esp = esperadoVariante(vr.item, vr.v);
    expect(sinEtiquetas(esp.nombre)).toBe('Valor E12 más cercano a la resistencia necesaria');
    expect(calificarItem(m, ctx, { r1: esp.texto }).puntos).toBe(2);
    if (Math.abs(vr.v.resultado - esp.valor) / esp.valor > 0.006) expect(calificarItem(m, ctx, { r1: valorTexto(vr.v.resultado, 'Ω') }).puntos).toBe(1);
  }
});

test('qa10b·a3 el examen y su PDF dicen lo que se pide en cada variante (el mismo texto que la práctica)', async () => {
  const def: DefinicionExamen = {
    items: ['ej-3.3', 'ej-3.4', 'prob-4.A'].map((ref) => ({ k: 'ejercicio' as const, ref, puntos: 2 })),
    minutos: 0,
    variantes: true,
    barajar: false,
    semilla: 41,
    espacio: 'no',
  };
  const ex = montarExamen(def, ctx, 1);
  const pedidos = ex.items.map((m) => {
    const vr = varianteDe(m, ctx)!;
    const esp = esperadoVariante(vr.item, vr.v);
    // never the formula's variable («Reactancia capacitiva (XC)»)
    expect(esp.nombre).toBe(pedidoDe(vr.item, vr.v).nombre);
    expect(esp.nombre).not.toMatch(/Reactancia|\(/);
    return { esp, vr };
  });
  const O = { titulo: 'Examen', notas: '', fecha: '6 de noviembre de 2026', espacio: 'no' as const, creado: Date.UTC(2026, 10, 6) };
  const examen = plano((await leerPdf((await generarPdf(documentoExamen(ex, L.libro, O), recursosNode)).bytes)).texto.join(' ').replace(/[   ]/g, ' '));
  const soluciones = plano((await leerPdf((await generarPdf(documentoSoluciones(ex, L.libro, O), recursosNode)).bytes)).texto.join(' ').replace(/[   ]/g, ' '));
  for (const { esp } of pedidos) {
    const n = plano(sinEtiquetas(esp.nombre).replace(/[   ]/g, ' '));
    expect(examen, n).toContain(`En esta variante se pide solo: ${n}`);
    expect(soluciones, n).toContain(n);
  }
  const e34 = pedidos[1]!.esp;
  expect(soluciones).toContain(plano(`(el valor E12 más cercano a ${e34.calculado!.texto})`.replace(/[   ]/g, ' ')));
});

test('qa10b·a4 «Solo lo que la aplicación corrige sola» deja fuera todo ejercicio con una parte autoevaluada', () => {
  const banco = bancoDe(L.banco);
  const auto = filtrar(banco, { ...FILTROS_VACIOS, tipos: ['ejercicio', 'problema'], soloAuto: true });
  const conAbierta = auto.filter((e) => {
    const it = ctx.ejercicio(e.ref)!;
    return it.modo === 'comparar' || (it.otras?.length ?? 0) > 0;
  });
  expect(conAbierta.map((e) => e.ref)).toEqual([]);
  expect(auto).toHaveLength(175);
  // and each of them is graded without a self-assessment: answering nothing leaves no part pending
  for (const e of auto.slice(0, 60)) {
    const m = montarExamen({ items: [{ k: 'ejercicio', ref: e.ref, puntos: 1 }], minutos: 0, variantes: false, barajar: false, semilla: 1, espacio: 'no' }, ctx, 0).items[0]!;
    expect(calificarItem(m, ctx, { texto: 'algo' }).estado, e.ref).not.toBe('pendiente');
  }
  expect(banco.filter((e) => e.mixto)).toHaveLength(125);
});
