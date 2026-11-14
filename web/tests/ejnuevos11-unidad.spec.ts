// 1.1: the new exercises of chapters 22, 25 and 35 that the book did not have yet (contenido/ejercicios_nuevos11/,
// merged by contenido/ejercicios_nuevos.py; ESQUEMA.md «Ejercicios nuevos (1.1)»).
// 1.2 (motor12b): book 4.0/4.1 prints the thirty with the same labels, so they are now the book's own exercises (their
// statement and solution in the part, `pos`; their answers and hints curated in ejercicios_curado.txt) and the merge
// step drops all of them. What this spec checked of the 1.1 layer is ported to that native content: no «Aún no en el
// libro» flag anywhere (data, search, teacher-mode bank and PDFs); the merge leaves the files byte-identical and says
// why; and, as before, in Node, no browser: every numeric answer reproduced from the statement's data by a second,
// independent method (complex arithmetic, numeric integration, Fourier coefficients, the exact bridge… and, for the
// ones measured on the test bench, the bench's own circuit simulated with the app's ngspice) and written in the book's
// solution; every answer accepted as written and a wrong one rejected; the choice questions with an explanation per
// wrong option; the design checker (valid designs accepted, invalid ones rejected with a useful hint), the exam grading
// and the teacher-mode PDFs; the Typst text the 1.1 tool wrote for the book.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.ejnuevos11.config.ts tests/ejnuevos11-unidad.spec.ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { cargarLibro, LIBRO, recursosNode } from './docente10/libro-node';
import { leerPdf, plano as planoPdf } from './docente10/leer-pdf';
import { comprobar } from '../src/lib/magnitudes';
import { comprobarPregunta, respuestaCorrecta, type PDiseno, type Pregunta } from '../src/lib/preguntas-ejercicio';
import { comprobarDiseno, escribirDiseno, faltaSimular, leerDiseno, netlistDiseno, simularDiseno, type Simulador } from '../src/lib/diseno-ejercicio';
import { calificarItem, montarExamen, type ContextoExamen } from '../src/lib/docente/examen';
import { documentoExamen, documentoSoluciones } from '../src/lib/docente/pdf/documento';
import { generarPdf } from '../src/lib/docente/pdf/maquetar';
import { bancoDe } from '../src/lib/docente/banco';
import { compilar } from '../src/simulador/motor/nucleo.ts';
import { simular } from '../src/simulador/motor/simular.ts';
import { todasLasMedidas } from '../src/simulador/motor/salida.ts';
import { CIRCUITOS } from '../src/componentes/instrumentos/practicas/circuitos.ts';
import type { DatosEjercicios, ItemEjercicio } from '../src/lib/ejercicios.svelte';
import type { BEjercicios, Bloque, DocBusqueda, Parte } from '../src/lib/tipos';

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const raiz = path.join(web, '..');
const L = cargarLibro();
const ctx: ContextoExamen = L.libro;
const datos = JSON.parse(fs.readFileSync(path.join(LIBRO, 'ejercicios.json'), 'utf8')) as DatosEjercicios;
const busqueda = JSON.parse(fs.readFileSync(path.join(LIBRO, 'busqueda.json'), 'utf8')) as (DocBusqueda & { nuevo?: boolean })[];
// the thirty exercises of the 1.1, by chapter (1.2: the book's own, same labels)
const ESPERADOS: Record<string, number> = { cap22: 10, cap25: 11, cap35: 9 };
const nuevos = Object.entries(ESPERADOS)
  .flatMap(([parte, n]) => Array.from({ length: n }, (_, k) => `ej-${Number(parte.slice(3))}.${k + 1}`))
  .map((l) => [l, datos.items[l]!] as [string, ItemEjercicio]);
const item = (label: string): ItemEjercicio => datos.items[label]!;
// (the math images keep their Typst source in `alt`: a number of the solution may be inside one)
const plano = (h: string | undefined) =>
  (h ?? '')
    .replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/g, ' $1 ')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
const partes = new Map<string, Parte>();
/** Statement and solution of an exercise, from its part (the book's, `pos`). */
const bloques = (l: string) => {
  const it = item(l);
  if (!partes.has(it.parte)) partes.set(it.parte, JSON.parse(fs.readFileSync(path.join(LIBRO, 'partes', `${it.parte}.json`), 'utf8')) as Parte);
  // (as lib/ejercicios.svelte.ts bloquesEjercicio, which Node cannot import: its module state is a rune)
  const b = partes.get(it.parte)!.bloques[it.pos[0] ?? -1] as BEjercicios | undefined;
  const e = b?.t === 'ejercicios' ? b.items[it.pos[1] ?? -1] : undefined;
  if (it.tipo !== 'ej' || !e) throw new Error(`${l}: sin enunciado en su parte`);
  return { enunciado: e.bloques, solucion: e.solucion ?? [] };
};
const textoDe = (bs: Bloque[]) => bs.map((b) => (b.t === 'p' ? plano(b.html) : '')).join(' ');
const sp = (t: string) => t.replace(/[  ]/g, ' ');

let simularTexto: (t: string) => ReturnType<typeof simular>;
const medir: Simulador = async (t) => {
  const r = await simularTexto(t);
  expect(r.ejecucion.fallo).toBeNull();
  return todasLasMedidas(r.salida);
};
/** One measurement of a netlist with a .control block. */
async function medida(t: string, nombre: string): Promise<number> {
  const m = (await medir(t)).find((x) => x.nombre.toLowerCase() === nombre);
  if (!m) throw new Error(`sin la medida ${nombre}`);
  return m.valor;
}
test.beforeAll(async () => {
  const modulo = await compilar(fs.readFileSync(path.join(web, 'public', 'ngspice', 'ngspice-xspice.wasm')));
  simularTexto = (t) => simular(modulo, t, undefined, 'xspice');
});

// ------------------------------------------------------------------ the data: the book's own, without the flag

test('los 30 ejercicios nuevos de la 1.1 (capítulos 22, 25 y 35) son del libro: misma etiqueta, curados y sin la marca', () => {
  expect(nuevos).toHaveLength(30);
  // no exercise is «Aún no en el libro» any more (the merge step adds none: test «fusión» below)
  expect(Object.values(datos.items).filter((it) => it.nuevo || it.ampliacion)).toHaveLength(0);
  expect((datos.resumen as unknown as Record<string, unknown>).nuevos11).toBeUndefined();
  for (const [parte, n] of Object.entries(ESPERADOS)) {
    const cap = datos.capitulos.find((c) => c.parte === parte)!;
    const num = L.indice.partes[parte]!.num;
    expect(cap.items, parte).toEqual(Array.from({ length: n }, (_, k) => `ej-${Number(parte.slice(3))}.${k + 1}`));
    cap.items.forEach((l, k) => {
      const it = item(l);
      expect(it.nuevo, l).toBeUndefined();
      expect(it, l).toMatchObject({ tipo: 'ej', parte, num: `${num}.${k + 1}`, modo: 'auto', origen: 'curado' });
      // the statement and the solution are the book's, in the part
      expect(it.enunciado, l).toBeUndefined();
      const b = bloques(l);
      expect(b.enunciado.length, l).toBeGreaterThan(0);
      expect(b.solucion.length, l).toBeGreaterThan(0);
      expect(it.pistas, l).toHaveLength(2);
      expect(it.respuestas.length + (it.preguntas?.length ?? 0), l).toBeGreaterThan(0);
      expect(L.indice.partes[parte]!.secciones.some((s) => s.label === it.seccion), l).toBe(true);
      // the statement asks something («Se pide»)
      expect(textoDe(b.enunciado), l).toContain('Se pide');
    });
  }
  const orden = L.indice.tomos.flatMap((t) => t.partes);
  const posiciones = datos.capitulos.map((c) => orden.indexOf(c.parte));
  expect(posiciones).toEqual([...posiciones].sort((a, b) => a - b));
  // all the book's exercises and problems of 4.1: 518 + 119
  expect(Object.keys(datos.items)).toHaveLength(637);
});

test('ni la búsqueda ni el banco del modo docente los marcan «Aún no en el libro»', () => {
  // (the book's exercises are searched in their section's text, like every exercise of the book)
  expect(busqueda.filter((x) => x.nuevo || /Aún no en el libro/.test(x.titulo))).toHaveLength(0);
  for (const [l] of nuevos) expect(busqueda.some((x) => x.id === l), l).toBe(false);
  expect(new Set(busqueda.map((x) => x.id)).size).toBe(busqueda.length);
  const banco = bancoDe(L.banco).filter((e) => e.k === 'ejercicio');
  for (const [l] of nuevos) expect(banco.find((e) => e.ref === l), l).toMatchObject({ auto: true });
  expect(banco.filter((e) => e.nuevo)).toHaveLength(0);
  // the design questions are checked by the app (simulation): in «solo lo que se corrige solo»
  // (its concept is the book's section that prints it, as for every exercise of the book)
  expect(banco.find((e) => e.ref === 'ej-25.9')).toMatchObject({ auto: true, concepto: `cap25/${item('ej-25.9').seccion}` });
});

// ------------------------------------------------------------------ every answer, by a second method

const ln = Math.log;
const log10 = Math.log10;
const db = (x: number) => 20 * log10(x);
type C = { re: number; im: number };
const cx = (re: number, im = 0): C => ({ re, im });
const sum = (a: C, b: C): C => cx(a.re + b.re, a.im + b.im);
const mul = (a: C, b: C): C => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a: C, b: C): C => {
  const d = b.re * b.re + b.im * b.im;
  return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
};
const abs = (a: C) => Math.hypot(a.re, a.im);
const arg = (a: C) => (Math.atan2(a.im, a.re) * 180) / Math.PI;
/** RC low-pass through its impedances: Zc / (R + Zc). */
const rcBajo = (R: number, Cf: number, f: number) => {
  const zc = div(cx(1), cx(0, 2 * Math.PI * f * Cf));
  return div(zc, sum(cx(R), zc));
};
/** Bisection of a monotonic function. */
function biseccion(fn: (x: number) => number, a: number, b: number): number {
  let fa = fn(a);
  for (let k = 0; k < 200; k++) {
    const m = (a + b) / 2;
    const fm = fn(m);
    if (fa * fm <= 0) b = m;
    else [a, fa] = [m, fm];
  }
  return (a + b) / 2;
}
/** Fourier sine coefficient n of an odd periodic waveform over one period (numerical integration). */
function armonico(forma: (t: number) => number, n: number): number {
  const N = 20000;
  let s = 0;
  for (let k = 0; k < N; k++) {
    const t = (k + 0.5) / N;
    s += forma(t) * Math.sin(2 * Math.PI * n * t);
  }
  return Math.abs((2 * s) / N);
}
const cuadrada = (t: number) => (t < 0.5 ? 1 : -1);
const triangular = (t: number) => (t < 0.25 ? 4 * t : t < 0.75 ? 2 - 4 * t : 4 * t - 4);
/** RC charge integrated step by step (Euler), from 0 V towards V. */
function cargaRC(R: number, Cf: number, V: number, hasta: (t: number, v: number) => boolean): { t: number; v: number } {
  const dt = R * Cf * 1e-5;
  let t = 0;
  let v = 0;
  while (!hasta(t, v)) {
    v += ((V - v) / (R * Cf)) * dt;
    t += dt;
  }
  return { t, v };
}
/** The worst-case common-mode error of a unity-gain difference amplifier: R1, R4 at +tol, R2, R3 at −tol, 1 V in. */
const errorModoComun = (tol: number) => {
  const [r1, r2, r3, r4] = [1 + tol, 1 - tol, 1 - tol, 1 + tol];
  return (r4 / (r3 + r4)) * (1 + r2 / r1) - r2 / r1;
};

const SEGUNDO: Record<string, Record<string, () => number>> = {
  'ej-22.1': {
    // Thévenin by conductances, then the instrument's divider
    r1: () => 1 / (1 / 1e6 + 1 / 1e6),
    r2: () => (9 * 0.5 * 1e6) / (1e6 + 1 / (1 / 1e6 + 1 / 1e6)),
    r3: () => (9 * 0.5 * 10e6) / (10e6 + 1 / (1 / 1e6 + 1 / 1e6)),
  },
  'ej-22.2': {
    r1: () => cargaRC(10e3, 100e-9, 3, (t) => t >= 2e-3).v,
    r2: () => cargaRC(10e3, 100e-9, 3, (_, v) => v >= 2.4).t,
    r3: () => cargaRC(10e3, 100e-9, 3, (_, v) => v >= 2.7).t - cargaRC(10e3, 100e-9, 3, (_, v) => v >= 0.3).t,
  },
  'ej-22.3': {
    // Shockley with n·V_T = 59,5 mV / ln 10
    r1: () => 0.57 + (0.0595 / ln(10)) * ln(4e-3 / 1e-3),
    r2: () => 0.57 + (0.0595 / ln(10)) * ln(50e-6 / 1e-3),
    r3: () => (0.725 - 0.62) / (0.0595 / ln(10)) / ln(10),
  },
  'ej-22.4': {
    r1: () => Math.max(...Array.from({ length: 2001 }, (_, k) => 12 * Math.SQRT2 * Math.sin((2 * Math.PI * k) / 2000))) - 0.7,
    // the charge the load takes in one period, over C
    r2: () => (0.15 * (1 / 50)) / 2200e-6,
    r3: () => (0.15 * (1 / 100)) / 2200e-6,
  },
  'ej-22.5': {
    r1: () => db(abs(rcBajo(1600, 100e-9, 500))),
    r2: () => db(abs(rcBajo(1600, 100e-9, 4000))),
    r3: () => -arg(rcBajo(1600, 100e-9, 4000)),
  },
  'ej-22.6': {
    // only odd harmonics: the third line is the fifth harmonic
    r1: () => 1000 * [1, 2, 3, 4, 5].filter((n) => armonico(cuadrada, n) > 1e-3)[2]!,
    r2: () => db(armonico(cuadrada, 9) / armonico(cuadrada, 1)),
    r3: () => db(armonico(triangular, 5) / armonico(triangular, 1)),
  },
  'ej-22.7': {
    // the exponential between 1/3 and 2/3 of V_CC: ln((V − V/3)/(V − 2V/3)) = ln 2
    r1: () => ln(2) * (4.7e3 + 22e3) * 470e-9,
    r2: () => ln(2) * 22e3 * 470e-9,
    r3: () => 1 / (ln(2) * (4.7e3 + 22e3) * 470e-9 + ln(2) * 22e3 * 470e-9),
    r4: () => (100 * (4.7e3 + 22e3)) / (4.7e3 + 2 * 22e3),
  },
  'ej-22.8': (() => {
    const L = 10e-3;
    const Cf = 100e-9;
    const R = 170;
    const I = (f: number) => abs(div(cx(1), sum(cx(R), cx(0, 2 * Math.PI * f * L - 1 / (2 * Math.PI * f * Cf)))));
    const f0 = 1 / (2 * Math.PI * Math.sqrt(L * Cf));
    const media = I(f0) / Math.SQRT2;
    const f1 = biseccion((f) => I(f) - media, 100, f0);
    const f2 = biseccion((f) => I(f) - media, f0, 1e6);
    return { r1: () => f0 / (f2 - f1), r2: () => f2 - f1, r3: () => (100 * I(f0)) / 1 };
  })(),
  'ej-22.9': { r1: () => 0.35 / 50e6, r2: () => Math.hypot(5e-9, 0.35 / 50e6), r3: () => 0.35 / 70e-9 },
  'ej-22.10': {
    r1: () => (2.6 - (2.6 + 1.4) / 2) / ((2.6 + 1.4) / 2),
    r2: () => 40e3 + 2e3,
    r3: () => 42e3 - 38e3,
    r4: () => 2 * (6e3 + 2e3),
  },
  'ej-25.1': {
    r1: () => 10 * log10(10 ** 2.6 * 10 ** -0.3 * 10 ** 1.4),
    r2: () => 10 * log10((1e-7 * 10 ** 3.7) / 1e-3),
    r3: () => Math.sqrt(10 ** 2.6 * 10 ** -0.3 * 10 ** 1.4),
  },
  'ej-25.2': {
    r1: () => 1e-3 * 10 ** (-10 / 10),
    // the chapter's equivalence: 224 mV for 0 dBm on 50 Ω (√(1 mW · 50 Ω))
    r2: () => Math.sqrt(1e-3 * 50) * 10 ** (-10 / 20),
    r3: () => 10 * log10(2 * 10 ** -1),
  },
  'ej-25.3': {
    r1: () => db(abs(div(cx(1), cx(1, 1000 / 2000)))),
    r2: () => db(abs(div(cx(1), cx(1, 20000 / 2000)))),
    r3: () => arg(div(cx(1), cx(1, 200 / 2000))),
    r4: () => arg(div(cx(1), cx(1, 20000 / 2000))),
  },
  'ej-25.4': (() => {
    const orden = (A: number, r: number) => {
      let n = 1;
      while (n * 20 * log10(r) < A) n++;
      return n;
    };
    return { r1: () => orden(72, 8), r2: () => 20 * orden(72, 8), r3: () => orden(72, 32) };
  })(),
  'ej-25.5': {
    r1: () => Math.exp((ln(1800) + ln(2200)) / 2),
    r2: () => 400,
    r3: () => Math.exp((ln(1800) + ln(2200)) / 2) / 400,
    r4: () => 50 / 25,
  },
  'ej-25.7': { r1: () => 100 * 20e3 * 2 },
  'ej-25.8': {
    // charge C·ΔV per cycle, f cycles per second: I = C·ΔV·f, R = ΔV/I
    r1: () => 1 / (2e-12 * 1 * 250e3),
    r2: () => 250e3 / 100,
    r3: () => 400 * 100,
  },
  'ej-35.1': {
    r1: () => Math.hypot(0.3, 0.2, 0.1, 0.1, 0.05),
    r2: () => (100 * Math.hypot(0.3, 0.2) ** 2) / Math.hypot(0.3, 0.2, 0.1, 0.1, 0.05) ** 2,
    r3: () => Math.hypot(0.3, 0.2, 0.1, 0.1),
  },
  'ej-35.2': {
    r1: () => 100 * (1 + (0.385 / 100) * 25),
    r2: () => 1e-3 * 100 * (1 + (0.385 / 100) * 25),
    r3: () => (0.4 + 0.4) / 0.385,
    r4: () => 1e-3 * (1e-3 * 100 * (1 + (0.385 / 100) * 25)),
  },
  'ej-35.3': (() => {
    const R = (T: number) => 10e3 * Math.exp(3950 * (1 / T - 1 / 298.15));
    const h = 1e-3;
    return {
      r1: () => R(323.15),
      r2: () => (100 * (R(298.15 + h) - R(298.15 - h))) / (2 * h * R(298.15)),
      r3: () => 41e-6 * 300 - 41e-6 * 25,
    };
  })(),
  'ej-35.4': {
    r1: () => 120 * 2.1 * 500e-6,
    // the exact quarter bridge: V·(R + ΔR)/(2R + ΔR) − V/2
    r2: () => 10 * ((120 + 0.126) / (240 + 0.126)) - 5,
    r3: () => 10 * (0.126 / 120),
    r4: () => 2 / (10 * (0.126 / 120)),
  },
  'ej-35.5': { r1: () => 20 * 5e-3, r2: () => 20 * (20 * 5e-3), r3: () => 0.5 / 400, r4: () => 0.5 / 20 },
  'ej-35.6': {
    // the exact worst-case circuit, not the proportional rule of the statement
    r1: () => errorModoComun(0.001),
    r2: () => db(1 / errorModoComun(0.001)),
    r3: () => 48 * errorModoComun(0.01),
  },
  'ej-35.7': { r1: () => 5e-3 * 5e-3 * 100 * 100, r2: () => 1e-3 * 1e-3 * 100 * 1000, r3: () => Math.round((0.5 * 4.75 * 65536) / 5) },
  'ej-35.8': {
    r1: () => 0.1 + ((1.3 - 0.1) / 100) * 50,
    r2: () => ((0.82 - 0.1) / (1.3 - 0.1)) * 100,
    r3: () => ((0.82 - 0.1) / (1.3 - 0.1)) * (100 - (0.3 * 650) / 100),
  },
};

test('cada respuesta numérica sale de los datos del enunciado por un segundo camino, y se acepta escrita como en la solución', () => {
  let n = 0;
  for (const [l, it] of nuevos) {
    for (const r of it.respuestas) {
      const f = SEGUNDO[l]?.[r.id];
      expect(f, `${l} ${r.id}: falta su segundo cálculo`).toBeTruthy();
      const v = f!();
      const tol = r.tol_abs ?? (r.tol ?? 0.02) * Math.abs(r.valor);
      expect(Math.abs(v - r.valor), `${l} ${r.id} ${plano(r.nombre)}: ${v} frente a ${r.valor}`).toBeLessThanOrEqual(tol * (1 + 1e-9));
      // as written in the solution, and with another spelling of the unit
      expect(comprobar(r.texto, r, r.alternativas).tipo, `${l} ${r.texto}`).toBe('bien');
      expect(comprobar(String(r.valor).replace('.', ','), r, r.alternativas).tipo, `${l} ${r.valor}`).toBe('bien');
      // and a wrong answer is not accepted
      expect(comprobar(String(r.valor * 3 + 1).replace('.', ','), r, r.alternativas).tipo, `${l} ×3`).not.toBe('bien');
      n++;
    }
  }
  expect(n).toBe(80);
  // the book's solution writes each answer's value (the worked development leads to it)
  for (const [l, it] of nuevos) {
    const sol = textoDe(bloques(l).solucion);
    for (const r of it.respuestas) {
      const num = r.texto.replace(/\s.*$/, '').replace(/^−/, '');
      expect(sol.replace(/\s/g, ''), `${l} ${r.texto}`).toContain(num.replace(/\s/g, ''));
    }
  }
});

test('lo que se mide en el banco de pruebas sale también simulando el circuito de su práctica', async () => {
  // practice 1, R1 = R2 = 1 MΩ, loaded by the ×1 (1 MΩ) and ×10 (10 MΩ) inputs
  for (const [carga, r] of [['1meg', 'r2'], ['10meg', 'r3']] as const) {
    const t = `${CIRCUITOS.p1_alta}RX out 0 ${carga}\n.control\nop\nlet vo = v(out)\nmeas dc dummy find vo at=0\nprint vo\n.endc\n.end\n`;
    const out = (await simularTexto(t)).salida.texto;
    const v = Number(/vo\s*=\s*([-\d.e+]+)/i.exec(out)?.[1]);
    const x = item('ej-22.1').respuestas.find((y) => y.id === r)!;
    expect(Math.abs(v - x.valor) / x.valor, `ej-22.1 ${r}: ${v}`).toBeLessThan(x.tol!);
  }
  // practice 2: the generator's 0–3 V square (5 τ per half period) on R = 10 kΩ, C = 100 nF
  const p2 = CIRCUITOS.p2!.replace('VG g 0 DC 0', 'VG g 0 PULSE(0 3 0 1n 1n 5m 10m)');
  const v2 = await medida(`${p2}.control\ntran 2u 22m\nmeas tran v2 find v(c) at=12m\nmeas tran t24 when v(c)=2.4 rise=2\n.endc\n.end\n`, 'v2');
  expect(Math.abs(v2 - item('ej-22.2').respuestas[0]!.valor) / item('ej-22.2').respuestas[0]!.valor).toBeLessThan(0.02);
  const t24 = (await medida(`${p2}.control\ntran 2u 22m\nmeas tran t24 when v(c)=2.4 rise=2\n.endc\n.end\n`, 't24')) - 10e-3;
  expect(Math.abs(t24 - item('ej-22.2').respuestas[1]!.valor) / item('ej-22.2').respuestas[1]!.valor).toBeLessThan(0.03);
  // practice 5: the RC on the bench, with the ×10 probe (10 MΩ ∥ 20 pF) on the output
  const p5 = `${CIRCUITOS.p5!.replace('VG in 0 DC 0', 'VG in 0 DC 0 AC 1')}RS out 0 10meg\nCS out 0 20p\n`;
  const ac5 = `${p5}.control\nac lin 351 500 4000\nlet g = db(v(out))\nlet fase = 180/pi*ph(v(out))\nmeas ac g500 find g at=500\nmeas ac g4k find g at=4000\nmeas ac f4k find fase at=4000\n.endc\n.end\n`;
  const m5 = await medir(ac5);
  const val = (n: string) => m5.find((x) => x.nombre.toLowerCase() === n)!.valor;
  const r5 = item('ej-22.5').respuestas;
  expect(Math.abs(val('g500') - r5[0]!.valor)).toBeLessThanOrEqual(r5[0]!.tol_abs!);
  expect(Math.abs(val('g4k') - r5[1]!.valor)).toBeLessThanOrEqual(r5[1]!.tol_abs!);
  expect(Math.abs(-val('f4k') - r5[2]!.valor)).toBeLessThanOrEqual(r5[2]!.tol_abs!);
  // practice 9: the RLC with its 20 Ω of copper, fed through the generator's 50 Ω
  const p9 = `${CIRCUITOS.p9!.replace('VG in 0 DC 0', 'VG g 0 DC 0 AC 1\nRG g in 50')}`;
  const m9 = await medir(`${p9}.control\nac dec 2000 500 50k\nlet vr = mag(v(n2))\nmeas ac pico max vr\nlet media = pico/sqrt(2)\nmeas ac f1 when vr=media rise=1\nmeas ac f2 when vr=media fall=1\n.endc\n.end\n`);
  const v9 = (n: string) => m9.find((x) => x.nombre.toLowerCase() === n)!.valor;
  const r9 = item('ej-22.8').respuestas;
  expect(Math.abs(v9('pico') - r9[2]!.valor) / r9[2]!.valor).toBeLessThan(r9[2]!.tol!);
  expect(Math.abs(v9('f2') - v9('f1') - r9[1]!.valor) / r9[1]!.valor).toBeLessThan(r9[1]!.tol!);
});

// ------------------------------------------------------------------ structured questions

test('cada pregunta de elección acepta su opción, rechaza las demás y explica por qué no cada una; orden y clasificación', () => {
  let elecciones = 0;
  for (const [l, it] of nuevos) {
    for (const q of it.preguntas ?? []) {
      expect(q.explicacion, `${l} ${q.id}`).toBeTruthy();
      if (q.tipo === 'eleccion') {
        elecciones++;
        q.opciones.forEach((_, k) => {
          const v = comprobarPregunta(q, String(k));
          if (k === q.correcta) expect(v.tipo).toBe('bien');
          else {
            expect(v.tipo, `${l} ${q.id} ${k}`).toBe('mal');
            expect(q.porque?.[String(k)], `${l} ${q.id}: «por qué no» de la opción ${k}`).toBeTruthy();
          }
        });
        expect(Object.keys(q.porque ?? {})).toHaveLength(q.opciones.length - 1);
        // the right option is not always the first one shown
      } else if (q.tipo === 'orden') {
        expect(comprobarPregunta(q, q.elementos.map((_, i) => i).join(',')).tipo).toBe('bien');
        expect(comprobarPregunta(q, q.mezcla.join(',')).tipo).toBe('mal');
      } else if (q.tipo === 'clasificar') {
        expect(comprobarPregunta(q, q.elementos.map((e) => e.cat).join(',')).tipo).toBe('bien');
        expect(comprobarPregunta(q, q.elementos.map((e) => 1 - e.cat).join(',')).tipo).toBe('mal');
      }
    }
  }
  expect(elecciones).toBe(11);
  const primeras = nuevos.flatMap(([, it]) => (it.preguntas ?? []).filter((q) => q.tipo === 'eleccion').map((q) => (q as { correcta: number }).correcta));
  expect(new Set(primeras).size).toBeGreaterThan(1);
});

// ------------------------------------------------------------------ the design problems, checked by simulation

const disenos = (): { l: string; q: PDiseno }[] =>
  nuevos.flatMap(([l, it]) => (it.preguntas ?? []).filter((q): q is PDiseno => q.tipo === 'diseno').map((q) => ({ l, q })));
const q = (l: string) => item(l).preguntas!.find((x): x is PDiseno => x.tipo === 'diseno')!;
async function veredicto(l: string, textos: string[]) {
  const v = await simularDiseno(q(l), escribirDiseno(textos), medir);
  return { v, r: comprobarDiseno(q(l), v) };
}

test('los tres problemas de diseño: la solución del libro (y otras válidas) se aceptan, simuladas', async () => {
  expect(disenos().map((d) => d.l)).toEqual(['ej-25.9', 'ej-25.10', 'ej-25.11']);
  for (const { l, q: p } of disenos()) {
    const textos = p.componentes.map((c) => p.referencia[c.id]!.texto.replace(/\s*[ΩF]$/, ''));
    const { r } = await veredicto(l, textos);
    expect(r.tipo, `${l} ${textos.join(' ')}: ${'mensaje' in r ? r.mensaje : ''}`).toBe('bien');
    expect(respuestaCorrecta(p)).toContain('por ejemplo');
  }
  for (const [l, textos] of [
    ['ej-25.9', ['33 k', '4,7 n']],
    ['ej-25.9', ['39k', '3n9']],
    ['ej-25.9', ['3300 Ω', '0,047 µF']],
    ['ej-25.10', ['33 k', '100 n']],
    ['ej-25.10', ['680 k', '4,7 n']],
    ['ej-25.11', ['5,1 k', '47 n', '22 n']],
  ] as const) {
    const { r } = await veredicto(l, [...textos]);
    expect(r.tipo, `${l} ${textos.join(' ')}: ${'mensaje' in r ? r.mensaje : ''}`).toBe('bien');
  }
});

test('lo que mide la simulación coincide con la teoría: f_c = 1/(2πRC) y, en el Sallen-Key, f0, Q y el corte a −3 dB', async () => {
  const { v } = await veredicto('ej-25.9', ['3,3 k', '47 n']);
  const fc = leerDiseno(v, 2).medicion!.medidas.fc!;
  expect(Math.abs(fc - 1 / (2 * Math.PI * 3300 * 47e-9)) / fc).toBeLessThan(0.002);
  const { v: v2 } = await veredicto('ej-25.10', ['68 k', '47 n']);
  expect(Math.abs(leerDiseno(v2, 2).medicion!.medidas.fc! - 1 / (2 * Math.PI * 68e3 * 47e-9))).toBeLessThan(0.15);
  const { v: v3 } = await veredicto('ej-25.11', ['11 k', '22 n', '10 n']);
  const m = leerDiseno(v3, 3).medicion!.medidas;
  const Q = Math.sqrt(22e-9 / 10e-9) / 2;
  const f0 = 1 / (2 * Math.PI * 11e3 * Math.sqrt(22e-9 * 10e-9));
  // |H(jω)|² = 1/2 for a second-order low-pass: x² = ((2 − 1/Q²) + √((2 − 1/Q²)² + 4))/2
  const a = 2 - 1 / Q ** 2;
  const f3 = f0 * Math.sqrt((a + Math.sqrt(a * a + 4)) / 2);
  expect(Math.abs(m.q! - Q) / Q).toBeLessThan(0.01);
  expect(Math.abs(m.fc! - f3) / f3).toBeLessThan(0.01);
});

test('los diseños que no cumplen se rechazan y la pista dice qué cambiar', async () => {
  const caso = async (l: string, textos: string[]) => {
    const { r } = await veredicto(l, textos);
    return { tipo: r.tipo, mensaje: sp('mensaje' in r ? r.mensaje : '') };
  };
  expect(await caso('ej-25.9', ['1,5 k', '100 n'])).toMatchObject({ tipo: 'mal', mensaje: expect.stringMatching(/f_?c = 1,06 kHz, por encima de 1 kHz ± 5 %: para bajarla, aumente R o C/) });
  expect(await caso('ej-25.9', ['33 k', '10 n'])).toMatchObject({ tipo: 'mal', mensaje: expect.stringMatching(/por debajo de 1 kHz ± 5 %: para subirla, disminuya R o C/) });
  // (review 11c: a value outside its series or its range is told before simulating and is not an attempt: `ilegible`)
  expect(await caso('ej-25.9', ['1,6 k', '100 n'])).toMatchObject({ tipo: 'ilegible', mensaje: '1,6 kΩ no es un valor de la serie E12: elija R de esa serie. Corríjalo antes de simular (no cuenta como intento).' });
  expect(await caso('ej-25.9', ['470', '330 n'])).toMatchObject({ tipo: 'ilegible', mensaje: expect.stringContaining('fuera del margen pedido (de 1 kΩ a 100 kΩ)') });
  expect(await caso('ej-25.9', ['3,3 k', ''])).toMatchObject({ tipo: 'ilegible', mensaje: 'Escriba también el valor de C.' });
  expect(await caso('ej-25.9', ['tres', '47 n'])).toMatchObject({ tipo: 'ilegible', mensaje: expect.stringContaining('No se entiende el valor de R') });
  expect(await caso('ej-25.9', ['3,3 kV', '47 n'])).toMatchObject({ tipo: 'ilegible', mensaje: expect.stringContaining('esa unidad no es de esta magnitud') });
  expect((await caso('ej-25.9', ['', ''])).tipo).toBe('vacio');
  expect(await caso('ej-25.10', ['3,3 k', '1 µ'])).toMatchObject({ tipo: 'ilegible', mensaje: expect.stringContaining('fuera del margen pedido (de 10 kΩ a 1 MΩ)') });
  // the Sallen-Key: the capacitors the wrong way round give a low Q; one condition can fail alone
  const sk = await caso('ej-25.11', ['11 k', '10 n', '22 n']);
  expect(sk.tipo).toBe('mal');
  expect(sk.mensaje).toMatch(/El circuito simulado da Q = 0,3\d+, por debajo de entre 0,65 y 0,75: para subirlo, aumente C1 respecto a C2/);
  expect(await caso('ej-25.11', ['10 k', '22 n', '10 n'])).toMatchObject({ tipo: 'mal', mensaje: expect.stringMatching(/1,12 kHz, por encima de 1 kHz ± 5 %: para bajarla, aumente R/) });
  expect(await caso('ej-25.11', ['11 k', '22 n', '10 n'])).toMatchObject({ tipo: 'bien' });
  // far away: the cut-off falls outside the sweep and the message says so
  expect(await caso('ej-25.9', ['1 k', '1 n'])).toMatchObject({ tipo: 'mal', mensaje: expect.stringMatching(/por encima|fuera del barrido/) });
});

test('lo simulado se guarda con sus valores: sin volver a simular lo mismo, y cambiar un valor obliga a simular de nuevo', async () => {
  const p = q('ej-25.9');
  let llamadas = 0;
  const contar: Simulador = async (t) => {
    llamadas++;
    return medir(t);
  };
  const v = await simularDiseno(p, escribirDiseno(['3,3 k', '47 n']), contar);
  expect(v).toMatch(/^3,3 k\|47 n#3300,4\.7e-8#fc=10\d\d\.\d+$/);
  expect(await simularDiseno(p, v, contar)).toBe(v);
  expect(llamadas).toBe(1);
  expect(faltaSimular(p, v)).toBe(false);
  // the same values written another way still match; another value does not
  expect(faltaSimular(p, v.replace('3,3 k', '3k3'))).toBe(false);
  const otro = v.replace('3,3 k', '33 k');
  expect(faltaSimular(p, otro)).toBe(true);
  expect(comprobarDiseno(p, otro)).toMatchObject({ tipo: 'ilegible', mensaje: 'Falta simular este diseño: pulse «Comprobar».' });
  // a forged measurement for other values never counts
  expect(comprobarDiseno(p, '33 k|47 n#3300,4.7e-8#fc=1000').tipo).toBe('ilegible');
  // the netlist is the circuit with the values put in, plus the measurement
  const nl = netlistDiseno(p, [3300, 47e-9]);
  expect(nl).toContain('R1 in out 3300');
  expect(nl).toContain('C1 out 0 4.7e-8');
  expect(nl).toMatch(/\.control\n[\s\S]*meas ac fc WHEN gdb=-3.0103 FALL=1\n\.endc\n\.end\n$/);
});

test('modo docente: el examen califica el diseño con lo simulado al entregar, y los PDF los dan como del libro', async () => {
  const def = { items: [{ k: 'ejercicio' as const, ref: 'ej-25.9', puntos: 2 }, { k: 'ejercicio' as const, ref: 'ej-22.5', puntos: 1 }], minutos: 0, variantes: false, barajar: false, semilla: 7, espacio: 'corto' as const };
  const ex = montarExamen(def, ctx, 0);
  expect(ex.faltan).toEqual([]);
  const [m1, m2] = ex.items as [(typeof ex.items)[0], (typeof ex.items)[0]];
  const simulado = await simularDiseno(q('ej-25.9'), escribirDiseno(['3,3 k', '47 n']), medir);
  expect(calificarItem(m1, ctx, { p1: simulado })).toMatchObject({ puntos: 2, estado: 'bien' });
  expect(calificarItem(m1, ctx, { p1: escribirDiseno(['3,3 k', '47 n']) }).puntos).toBe(0);
  const malo = await simularDiseno(q('ej-25.9'), escribirDiseno(['1,5 k', '100 n']), medir);
  expect(calificarItem(m1, ctx, { p1: malo })).toMatchObject({ puntos: 0, estado: 'mal' });
  expect(calificarItem(m2, ctx, { r1: '-0,98 dB', r2: '-12,3 dB', r3: '76' })).toMatchObject({ puntos: 1, estado: 'bien' });
  const O = { titulo: 'Filtros', notas: '', fecha: '', espacio: 'corto' as const, creado: Date.UTC(2026, 10, 9) };
  const texto = async (d: Parameters<typeof generarPdf>[0]) => {
    const r = await generarPdf(d, recursosNode);
    expect(r.faltan).toEqual([]);
    return planoPdf((await leerPdf(r.bytes)).texto.join(' ').replace(/[  ]/g, ' '));
  };
  const examen = await texto(documentoExamen(ex, L.libro, O));
  expect(examen).not.toContain('aún no en el libro');
  expect(examen).toContain('Se quiere un filtro paso bajo RC de primer orden');
  expect(examen).toContain('(serie E12)');
  const soluciones = await texto(documentoSoluciones(ex, L.libro, O));
  expect(soluciones).not.toContain('aún no en el libro');
  expect(soluciones).toContain(`Solución ${item('ej-25.9').num} del libro`);
  expect(soluciones).toContain('cualquier diseño que cumpla');
  expect(soluciones).toContain('3,3 kΩ');
});

// ------------------------------------------------------------------ the merge: the book wins, idempotent

test('fusión: el libro ya trae los 30 con la misma etiqueta, así que el paso los descarta todos y deja los ficheros idénticos', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ejnuevos11-'));
  try {
    for (const f of ['ejercicios.json', 'busqueda.json', 'indice.json', 'refs.json']) fs.copyFileSync(path.join(LIBRO, f), path.join(tmp, f));
    const correr = () => execFileSync('python3', [path.join(raiz, 'contenido', 'ejercicios_nuevos.py')], { env: { ...process.env, EPA_LIBRO: tmp }, encoding: 'utf8' });
    const leer = (f: string) => fs.readFileSync(path.join(tmp, f), 'utf8');
    const original = { ej: leer('ejercicios.json'), bu: leer('busqueda.json') };
    for (let k = 0; k < 2; k++) {
      const salida = correr();
      expect(salida).toContain('0 ejercicios nuevos añadidos');
      expect(salida).toContain(`30 descartados porque el libro ya los trae: ${nuevos.map(([l]) => l).join(', ')}`);
      expect(salida).toContain('sin cambios');
      expect(leer('ejercicios.json')).toBe(original.ej);
      expect(leer('busqueda.json')).toBe(original.bu);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('el texto Typst para el libro: cada ejercicio con su etiqueta y su solución, fórmulas en Typst y cerradas', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ejnuevos11-typ-'));
  try {
    const f = path.join(tmp, 'ejercicios-nuevos.typ.md');
    execFileSync('python3', [path.join(raiz, 'contenido', 'ejercicios_nuevos.py'), '--comprobar', '--typst', f], { encoding: 'utf8' });
    const md = fs.readFileSync(f, 'utf8');
    const bloques = [...md.matchAll(/```typst\n([\s\S]*?)```/g)].map((m) => m[1]!);
    expect(bloques).toHaveLength(3);
    for (const [l, it] of nuevos) {
      const b = bloques.find((x) => x.includes(`<${l}>`))!;
      expect(b, l).toBeTruthy();
      expect(b.split(`] <${l}>`)).toHaveLength(2);
      expect(b.split(`#solucion("${l}")[`)).toHaveLength(2);
      expect(md).toContain(`[${l}]`);
      void it;
    }
    for (const b of bloques) {
      expect(b.startsWith('#ejercicios[')).toBe(true);
      expect(b).toContain('#soluciones[');
      // math closed on every line, decimals quoted inside it, no HTML left
      for (const linea of b.split('\n')) {
        expect((linea.match(/(?<!\\)\$/g) ?? []).length % 2, linea).toBe(0);
        for (const m of linea.matchAll(/(?<!\\)\$([^$]*)\$/g)) expect(m[1]!.replace(/"[^"]*"/g, '""'), linea).not.toMatch(/\d,\d/);
      }
      expect(b).not.toMatch(/<\/?(sub|sup|strong|a)\b/);
      expect((b.match(/\[/g) ?? []).length - (b.match(/\\\[/g) ?? []).length).toBe((b.match(/\]/g) ?? []).length - (b.match(/\\\]/g) ?? []).length);
    }
    expect(md).toContain('Dónde pegarlo: al final de cap25.typ');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('el motor de las preguntas conoce el diseño: sin simulación no hay acierto, y la respuesta correcta da un ejemplo', () => {
  const p: Pregunta = q('ej-25.11');
  expect(comprobarPregunta(p, '').tipo).toBe('vacio');
  expect(comprobarPregunta(p, escribirDiseno(['11 k', '22 n', '10 n'])).tipo).toBe('ilegible');
  expect(sp(plano(respuestaCorrecta(p)))).toContain('R = 11 kΩ, C1 = 22 nF y C2 = 10 nF');
});
