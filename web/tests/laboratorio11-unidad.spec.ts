// 1.1 «Laboratorio guiado» (the practices of printed chapter 21 as guided labs), in Node, no browser:
//   - every lab on a REAL bench (tests/laboratorio11/banco-node.ts: Banco, the Brymen and FNIRSI state machines, the
//     instruments' loads, the app's WebAssembly ngspice): each step is refused before it is done, passes once its
//     settings are made and the reading is typed as the instrument shows it, refuses that reading ten times off (and
//     without its prefix), and its reading agrees with the book's expected value within the practice's tolerance;
//     each typical mistake the book warns about, made on top of the right settings, is refused with its own hint;
//   - the definitions: circuits that exist (regression: the loose diode of practice 3 had none), stable unique ids,
//     readings tied to the practice's checks, the shared map and step counts;
//   - progress: the stored record, its merge (commutative, associative, idempotent; two devices synchronised), the
//     schema key, XP once per step (`pr:cap22-lab<n>-<step>`, 10 / 5 with a hint / none with help).
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.laboratorio11.config.ts tests/laboratorio11-unidad.spec.ts
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { LABORATORIOS, cruce } from '../src/componentes/instrumentos/practicas/laboratorios';
import type { Banco } from '../src/componentes/instrumentos/banco.svelte';
import { idPaso, pasoPendiente, textoTolerancia } from '../src/componentes/instrumentos/practicas/laboratorio';
import { PRACTICAS } from '../src/componentes/instrumentos/practicas/practicas';
import { CIRCUITOS } from '../src/componentes/instrumentos/practicas/circuitos';
import { PASOS_LAB, PRACTICA_DE_SECCION } from '../src/componentes/instrumentos/practicas/mapa';
import { anotarPasoLab, claveLab, registroLabValido, unirRegistrosLab, type RegistroLab } from '../src/lib/laboratorio';
import { ESQUEMAS, migracionesDe } from '../src/lib/esquemas';
import { fusionarColecciones } from '../src/lib/sincronizacion/fusion';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

interface PasoInforme {
  i: number;
  id: string;
  antes: string;
  sinLectura: string;
  despues: string;
  pista: string;
  texto: string;
  lectura: number | null;
  diez: string | null;
  prefijo: string | null;
  libro: { id: string; esperado: number; tol: number } | null;
}
interface Informe {
  n: number;
  pasos: PasoInforme[];
  errores: { paso: string; nombre: string; esperada: string; antes: string; estado: string; pista: string }[];
}

let informes: Informe[] = [];
test.beforeAll(() => {
  test.setTimeout(600_000);
  const out = execFileSync('nice', ['node', '--no-warnings', '--import', './tests/laboratorio11/registrar.mjs', 'tests/laboratorio11/banco-node.ts'], {
    cwd: WEB,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 580_000,
  });
  informes = out
    .split('\n')
    .filter((l) => l.startsWith('{'))
    .map((l) => JSON.parse(l) as Informe);
});

test('las doce prácticas tienen su laboratorio, con el circuito montado y pasos de identificador estable', () => {
  expect(LABORATORIOS.map((l) => l.n)).toEqual(PRACTICAS.map((p) => p.n));
  for (const lab of LABORATORIOS) {
    const p = PRACTICAS.find((x) => x.n === lab.n)!;
    const ids = lab.pasos.map((x) => x.id);
    expect(new Set(ids).size, `lab ${lab.n}`).toBe(ids.length);
    for (const id of ids) expect(id, `lab ${lab.n}`).toMatch(/^[a-z0-9-]+$/);
    expect(PASOS_LAB[lab.n], `lab ${lab.n}: mapa.ts PASOS_LAB`).toBe(lab.pasos.length);
    expect(PRACTICA_DE_SECCION[p.label]).toBe(lab.n);
    expect(p.variantes.some((v) => v.id === (lab.inicial.variante ?? p.variantes[0]!.id))).toBe(true);
    for (const x of lab.pasos) {
      expect(x.requisitos.length + (x.lectura ? 1 : 0), `${lab.n}/${x.id} comprueba algo`).toBeGreaterThan(0);
      if (x.lectura?.libro) expect(p.comprobaciones.some((c) => c.id === x.lectura!.libro), `${lab.n}/${x.id}`).toBe(true);
      if (x.preparar?.variante) expect(p.variantes.some((v) => v.id === x.preparar!.variante)).toBe(true);
      // short, as the lesson cards: a step is one thing to do
      const palabras = `${x.titulo} ${x.texto}`.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length;
      expect(palabras, `${lab.n}/${x.id}: ${palabras} palabras`).toBeLessThanOrEqual(50);
      expect(idPaso(lab.n, x.id)).toBe(`cap22-lab${lab.n}-${x.id}`);
      if (x.lectura) expect(textoTolerancia(x.lectura)).toMatch(/^± /);
    }
  }
  // the summary has something to compare with the book in every lab
  for (const lab of LABORATORIOS) expect(lab.pasos.some((x) => x.lectura?.libro), `lab ${lab.n}`).toBe(true);
});

test('regresión: cada montaje de las prácticas tiene su circuito (el diodo suelto de la práctica 3 no lo tenía)', () => {
  for (const p of PRACTICAS) for (const v of p.variantes) expect(CIRCUITOS[v.circuito], `${p.n} ${v.id} → ${v.circuito}`).toBeTruthy();
});

test('cada paso, en un banco real: rechazado antes de hacerlo, aceptado al hacerlo, con la lectura del instrumento y la del libro', () => {
  expect(informes.map((r) => r.n)).toEqual(LABORATORIOS.map((l) => l.n));
  let lecturas = 0;
  for (const r of informes) {
    for (const x of r.pasos) {
      const nombre = `lab ${r.n} · ${x.id}`;
      expect(x.antes, `${nombre}: sin hacer nada no se da por bueno`).toBe('mal');
      expect(x.despues, `${nombre}: ${x.pista}`).toBe('bien');
      if (x.lectura === null) continue;
      lecturas++;
      // with the settings right but nothing typed, it asks for the reading; ten times off is named as such
      expect(x.sinLectura, nombre).toMatch(/^Escriba el valor/);
      expect(x.diez, nombre).toMatch(/diez veces/);
      if (x.prefijo !== null) expect(x.prefijo, `${nombre}: sin el prefijo`).toMatch(/prefijo/);
      if (x.libro) expect(Math.abs(x.lectura - x.libro.esperado), `${nombre}: ${x.lectura} frente a ${x.libro.esperado} ± ${x.libro.tol}`).toBeLessThanOrEqual(x.libro.tol);
    }
  }
  expect(lecturas).toBeGreaterThanOrEqual(35);
});

test('los errores típicos que nombra el libro se rechazan con su pista', () => {
  let n = 0;
  for (const r of informes)
    for (const e of r.errores) {
      n++;
      expect(e.antes, `lab ${r.n} · ${e.paso}: el paso bien hecho pasa`).toBe('bien');
      expect(e.estado, `lab ${r.n} · ${e.paso} · ${e.nombre}`).toBe('mal');
      expect(e.pista, `lab ${r.n} · ${e.paso} · ${e.nombre}`).toContain(e.esperada);
    }
  expect(n).toBeGreaterThanOrEqual(20);
  // the ×1/×10 mismatch, AC/DC coupling, trigger source, ground clip, meter in parallel and ohmmeter on a live circuit
  const pistas = informes.flatMap((r) => r.errores.map((e) => e.pista)).join('\n');
  for (const f of ['no coinciden', 'acoplamiento <strong>AC</strong>', 'acoplamiento <strong>DC</strong>', 'disparo', 'pinza de masa', 'fusible', 'Quite la alimentación']) expect(pistas).toContain(f);
});

test('regresión: el ruido de un paso de bajada no es un paso de subida (el cursor del desfase caía medio periodo tarde)', () => {
  // a sine of 1 kHz sampled every 10 µs from its peak, falling through 0 with a 2-LSB wiggle up at the crossing
  const y = new Float64Array(200);
  for (let i = 0; i < y.length; i++) y[i] = Math.cos(2 * Math.PI * 1000 * i * 1e-5);
  // just after the falling crossing at 250 µs the noise lifts one sample back above 0
  y[25] = -0.01;
  y[26] = 0.02;
  const b = { fnirsi: { captura: { t0: 0, dt: 1e-5, y: [y, null] }, hpos: 0, sDiv: 1e-4 } } as unknown as Banco;
  // the first real rising crossing is at 750 µs (7,5 div); before the fix the wiggle at 250 µs was taken
  expect(cruce(b, 0, 0, true)).toBeCloseTo(7.5, 1);
  expect(cruce(b, 0, 0, false)).toBeCloseTo(2.5, 1);
});

// ------------------------------------------------------------------ progress

const reg = (h: string[], l: Record<string, [number, number]>, c: number, t: number): RegistroLab => ({ h, l, c, t });

test('el registro de un laboratorio: pasos, lecturas, completado una vez y tiempos que nunca retroceden', () => {
  const pasos = ['a', 'b', 'c'];
  let r = anotarPasoLab(undefined, 'b', 2.88, pasos, 1000);
  expect(r).toEqual({ h: ['b'], l: { b: [2.88, 1000] }, c: 0, t: 1000 });
  r = anotarPasoLab(r, 'a', null, pasos, 500); // clock set back
  expect(r.t).toBe(1001);
  expect(r.h).toEqual(['a', 'b']);
  r = anotarPasoLab(r, 'c', 1e-3, pasos, 2000);
  expect(r.c).toBe(2000);
  r = anotarPasoLab(r, 'b', 2.9, pasos, 3000);
  expect(r.c).toBe(2000);
  expect(r.l.b).toEqual([2.9, 3000]);
  expect(registroLabValido(r)).toBe(true);
  for (const malo of [null, [], { h: 'a', l: {}, c: 0, t: 0 }, { h: [], l: { a: [1] }, c: 0, t: 0 }, { h: [1], l: {}, c: 0, t: 0 }, { h: [], l: {}, c: NaN, t: 0 }]) expect(registroLabValido(malo)).toBe(false);
  expect(claveLab(7)).toBe('p7');
  const lab = LABORATORIOS[0]!;
  expect(pasoPendiente(lab, [])).toBe(0);
  expect(pasoPendiente(lab, [lab.pasos[0]!.id, lab.pasos[2]!.id])).toBe(1);
  expect(pasoPendiente(lab, lab.pasos.map((x) => x.id))).toBe(lab.pasos.length);
});

test('la fusión de dos dispositivos: unión de pasos, la lectura más nueva, el primer completado; conmutativa, asociativa e idempotente', () => {
  const a = reg(['a', 'b'], { a: [1, 10], b: [2, 20] }, 0, 20);
  const b = reg(['b', 'c'], { b: [2.5, 30], c: [3, 25] }, 0, 30);
  const c = reg(['a', 'b', 'c', 'd'], { a: [1.1, 10], d: [4, 5] }, 40, 40);
  const ab = unirRegistrosLab(a, b);
  expect(ab).toEqual({ h: ['a', 'b', 'c'], l: { a: [1, 10], b: [2.5, 30], c: [3, 25] }, c: 0, t: 30 });
  expect(unirRegistrosLab(b, a)).toEqual(ab);
  expect(unirRegistrosLab(ab, ab)).toEqual(ab);
  expect(unirRegistrosLab(unirRegistrosLab(a, b), c)).toEqual(unirRegistrosLab(a, unirRegistrosLab(b, c)));
  // same time on both sides: the larger value, the same on every device
  expect(unirRegistrosLab(reg(['a'], { a: [1, 10] }, 0, 10), reg(['a'], { a: [1.1, 10] }, 0, 10)).l.a).toEqual([1.1, 10]);
  expect(unirRegistrosLab(reg([], {}, 50, 50), reg([], {}, 40, 40)).c).toBe(40);
  // the synchronisation file: the device's entry and the file's, merged by the store's `unir`
  const union = { unir: (x: unknown, y: unknown) => unirRegistrosLab(x as RegistroLab, y as RegistroLab), valido: registroLabValido };
  const f = fusionarColecciones({ p1: { t: 20, v: a } } as never, { p1: { t: 30, v: b }, p2: { t: 5, v: c } } as never, union);
  const fp1 = (f as Record<string, { v: RegistroLab }>).p1!.v;
  expect(fp1.h).toEqual(['a', 'b', 'c']);
  expect((f as Record<string, unknown>).p2).toBeTruthy();
});

test('almacén y sincronización: clave nueva sin migración, registrada como almacén «laboratorio»', () => {
  expect(ESQUEMAS.laboratorio).toBe(1);
  expect(migracionesDe('laboratorio', 1)).toEqual([]);
  const registro = fs.readFileSync(path.join(WEB, 'src/lib/sincronizacion/registro.svelte.ts'), 'utf8');
  expect(registro).toMatch(/sincronizableGuardado\(guardadoLab, \{\s*clave: 'laboratorio'/);
  expect(registro).toContain('unir: (a, b) => unirRegistrosLab(');
});

test('XP una vez por paso, como una tarjeta de lección: 10 a la primera, 5 con «Mostrar dónde», nada con «Hágalo por mí»', () => {
  // the app's own rule (a rune module), run in Node with the loader
  const out = execFileSync('node', ['--no-warnings', '--import', './tests/laboratorio11/registrar.mjs', 'tests/laboratorio11/xp-node.ts'], { cwd: WEB, encoding: 'utf8' });
  const r = JSON.parse(out.trim().split('\n').pop()!) as Record<string, { id: string; x: number } | null>;
  expect(r.primera).toEqual({ id: 'pr:cap22-lab1-vout', x: 10 });
  expect(r.conGuia).toEqual({ id: 'pr:cap22-lab1-vout', x: 5 });
  expect(r.segunda).toEqual({ id: 'pr:cap22-lab1-vout', x: 5 });
  // «Hágalo por mí» closes the round as not answered
  expect(r.hagalo).toBeNull();
  expect(r.fallo).toBeNull();
});
