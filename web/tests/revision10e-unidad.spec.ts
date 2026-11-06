// Review 10e (1.0 exercises: checking, «Resolver paso a paso», «Teoría que se mueve», «Practicar con otros valores»):
// findings that need neither a browser nor a server. Each test FAILS on the reviewed tree and states the expected
// behaviour.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.revision10e.config.ts tests/revision10e-unidad.spec.ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { comprobar } from '../src/lib/magnitudes';
import { variantes, enunciadoDe } from '../src/componentes/practica/variantes';
import type { ItemNumerico } from '../src/componentes/practica/tipos';

const LIBRO = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'libro');
const leer = (f: string) => JSON.parse(readFileSync(join(LIBRO, f), 'utf-8'));
const practica = (parte: string, id: string): ItemNumerico => leer(`practica/${parte}.json`).items.find((x: { id: string }) => x.id === id);
const plano = (h: string) => h.replace(/<[^>]+>/g, '');

test('r10e·4 «otros valores» de ej-5.6: con 50 Hz en onda completa el rizado es siempre de 100 Hz', () => {
  // The statement keeps «a 50 Hz (onda completa, frecuencia de rizado {{f_r}})» and the generator varies f_r over
  // 40…300 Hz: «a 50 Hz (onda completa, frecuencia de rizado 40 Hz)» contradicts itself, and it is exactly the confusion
  // the book's solution warns about («el error frecuente de usar f = 100 Hz … con el factor 2»). f_r must stay 100 Hz
  // (or the mains frequency vary with it: 50 Hz → 100 Hz, 60 Hz → 120 Hz).
  const it = practica('cap05', 'cap05-num-ej-5.6');
  const malas = variantes(it)
    .filter((v) => v.valores.f_r !== 100)
    .map((v) => plano(enunciadoDe(it, v)).replace(/^.*?a 50 Hz/, '… a 50 Hz').slice(0, 70));
  expect(malas).toEqual([]);
});

test('r10e·5 «otros valores» de ej-6.2: el transistor polarizado queda en zona activa (se piden V_E, I_C y V_CE)', () => {
  // The statement asks for V_B, V_E, I_C and V_CE with R_E = 470 Ω and R_C = 2,2 kΩ fixed, but V_CC, R_1 and R_2 are
  // drawn independently: many variants leave the base below V_BE (cut off: V_E would be negative) or saturate the
  // transistor (V_CE < 0 with the active-region formulas). Only variants with V_B > 0,7 V and V_CE > 0,3 V make sense.
  const it = practica('cap06', 'cap06-num-ej-6.2');
  const malas: string[] = [];
  for (const v of variantes(it)) {
    const { V_CC: vcc, R_1: r1, R_2: r2 } = v.valores as Record<string, number>;
    const vb = (vcc! * r2!) / (r1! + r2!);
    const ic = (vb - 0.7) / 470;
    const vce = vcc! - ic * (2200 + 470);
    if (vb <= 0.7 || vce <= 0.3) malas.push(`VCC=${vcc} R1=${r1} R2=${r2}: VB=${vb.toFixed(2)} V, VCE=${vce.toFixed(2)} V`);
  }
  expect(malas).toEqual([]);
});

test('r10e·6 (bajo) el último paso de ej-43.3 acepta lo mismo que el ejercicio (181 sin signo es alternativa del libro)', () => {
  // ejercicios_curado.txt accepts «181» for the gain (the book: «≈ 181 (unos 45 dB), con signo negativo»), but the
  // guided step that leads to that very result only takes −181 and counts 181 as a failed check («el signo no»).
  const ej = leer('ejercicios.json').items['ej-43.3'];
  const ult = leer('pasos.json').items['ej-43.3'].pasos.at(-1);
  const r = ej.respuestas[0];
  expect(comprobar('181', r, r.alternativas).tipo).toBe('bien');
  expect(comprobar('181', ult.respuesta, ult.alternativas).tipo).toBe('bien');
});

test('r10e·7 (bajo-medio) una respuesta en una unidad equivalente no se rechaza diciendo que «no es una unidad de esta magnitud»', () => {
  // Answers stored in a unit with a prefix glued in (mm, kg) or in one of two equivalent spellings (K/W ↔ °C/W,
  // S ↔ A/V) refuse the same value written in the other one, and the message is false: ««m» no es una unidad de esta
  // magnitud: se pide en mm». The reader is not penalised (the verdict «unidad» does not count) but is told something
  // wrong. Cases from the book: prob-36.C (165 mm), prob-39.C (0,96 kg), prob-13.A (31 K/W) next to ej-6.5 (°C/W),
  // ej-6.7 (38,5 mS) next to the step of ej-43.3 (38,5 mA/V).
  const casos: [string, { valor: number; unidad: string; texto: string }][] = [
    ['0,165 m', { valor: 165, unidad: 'mm', texto: '165 mm' }],
    ['16,5 cm', { valor: 165, unidad: 'mm', texto: '165 mm' }],
    ['960 g', { valor: 0.96, unidad: 'kg', texto: '0,96 kg' }],
    ['31 °C/W', { valor: 31, unidad: 'K/W', texto: '31 K/W' }],
    ['6,5 K/W', { valor: 6.5, unidad: '°C/W', texto: '6,5 °C/W' }],
    ['38,5 mS', { valor: 0.0385, unidad: 'A/V', texto: '38,5 mA/V' }],
    ['38,5 mA/V', { valor: 0.0385, unidad: 'S', texto: '38,5 mS' }],
  ];
  const fallos = casos.map(([t, e]) => [t, e.unidad, comprobar(t, e).tipo]).filter((x) => x[2] !== 'bien');
  expect(fallos).toEqual([]);
});
