// 1.2 «curado12»: what tests/ampliaciones11-*.spec.ts checked of the 1.1 expansions layer, ported to the native
// content of book 4.1 (the layer is retired: generar.py no longer merges contenido/ampliaciones11/, the book has them).
// In Node, no browser nor server:
//   - every exercise of the ten expansions (their manifests' `respuestas`, with the 4.1 ids) and every exercise new in
//     4.1 (17.9–17.11, 30.26–30.29, 34.10, 39.6–39.8, 48.14–48.16, chapter 54 and appendix K) is the book's own
//     (no «Aún no en el libro»), self-checkable, with two hints, and the checker accepts each answer as written and
//     rejects a wrong value;
//   - every netlist of the expansions is in spice.json, validated in the app's ngspice and linked from the book;
//   - every review question of the expansions keeps its (renamed) id;
//   - the sections new since 4.0 exist with their printed numbers.
//   EPA_SIN_SERVIDOR=1 npx playwright test -c playwright.sync41.config.ts tests/sync41-ampliaciones-unidad.spec.ts
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { comprobar } from '../src/lib/magnitudes';
import { comprobarPregunta, type Pregunta } from '../src/lib/preguntas-ejercicio';
import { renombrar41 } from '../src/lib/esquemas';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(WEB, '..');
const LIBRO = path.join(WEB, 'public', 'libro');
const AMP = path.join(APP, 'contenido', 'ampliaciones11');
const J = <T = any>(f: string): T => JSON.parse(readFileSync(f, 'utf8')) as T; // eslint-disable-line @typescript-eslint/no-explicit-any
const VIEJO = /new-(automatas|maquinas)/;

interface Manifiesto {
  id: string;
  respuestas: Record<string, unknown>;
  spice: Record<string, { parte?: string; refs: string[] }>;
  repaso: string;
}
const MANIFIESTOS: Manifiesto[] = readdirSync(AMP)
  .filter((d) => /^P\d+$/.test(d))
  .sort()
  .map((d) => J<Manifiesto>(path.join(AMP, d, 'ampliacion.json')));

interface Item {
  tipo: 'ej' | 'prob';
  parte: string;
  num: string;
  pos: number[];
  modo: string;
  pistas: string[];
  respuestas: { texto: string; valor: number; alternativas?: unknown[]; nombre: string }[];
  preguntas?: Pregunta[];
  ampliacion?: string;
  nuevo?: boolean;
  origen: string;
}
const ITEMS = J<{ items: Record<string, Item> }>(path.join(LIBRO, 'ejercicios.json')).items;
const REFS = J<Record<string, { num: string; parte?: string; ampliacion?: string }>>(path.join(LIBRO, 'refs.json'));

// exercises new in 4.1 (the book's integra-4.1: grado-4.1 and libro-p10)
const NUEVOS_41 = [
  'ej-18.9', 'ej-18.10', 'ej-18.11', 'ej-31.26', 'ej-31.27', 'ej-31.28', 'ej-31.29', 'ej-56.10', 'ej-38.6', 'ej-38.7',
  'ej-38.8', 'ej-47.14', 'ej-47.15', 'ej-47.16', 'prob-57.A', ...Array.from({ length: 10 }, (_, i) => `ej-57.${i + 1}`),
  ...Array.from({ length: 6 }, (_, i) => `ej-K.${i + 1}`),
];

/** An encoded right answer of a structured question (as tests/ejercicios10-contenido.spec.ts). */
function buena(p: Pregunta): string | null {
  switch (p.tipo) {
    case 'eleccion':
      return String(p.correcta);
    case 'clasificar':
      return p.elementos.map((e) => e.cat).join(',');
    case 'exacta':
      return p.aceptadas[0]!;
    default:
      return null;
  }
}

function comprobarEjercicio(label: string): string[] {
  const it = ITEMS[label];
  if (!it) return [`${label}: no está en ejercicios.json`];
  const mal: string[] = [];
  if (it.ampliacion || it.nuevo) mal.push(`${label}: marcado «Aún no en el libro»`);
  if (!it.pos?.length) mal.push(`${label}: sin sitio en el libro`);
  if (it.modo !== 'auto') mal.push(`${label}: no se comprueba solo (${it.modo})`);
  if (it.origen !== 'curado') mal.push(`${label}: respuestas del analizador, sin curar`);
  if (it.pistas.length < 2) mal.push(`${label}: menos de dos pistas`);
  if (!it.respuestas.length && !(it.preguntas ?? []).length) mal.push(`${label}: nada que comprobar`);
  for (const r of it.respuestas) {
    if (comprobar(r.texto, r as never, r.alternativas as never).tipo !== 'bien') mal.push(`${label}: «${r.texto}» no se acepta`);
    const otro = String(r.valor * 3 + 1).replace('.', ',');
    if (comprobar(otro, r as never, r.alternativas as never).tipo === 'bien') mal.push(`${label}: acepta ${otro}`);
  }
  for (const p of it.preguntas ?? []) {
    const b = buena(p);
    if (b != null && comprobarPregunta(p, b).tipo !== 'bien') mal.push(`${label}/${p.id}: no acepta su respuesta`);
    if (p.tipo === 'eleccion') {
      // every wrong option explained («porque N:» in ejercicios_curado.txt), exactly one accepted
      const malas = p.opciones.map((_, i) => i).filter((i) => i !== p.correcta);
      const exp = Object.keys(p.porque ?? {}).map(Number).sort((a, c) => a - c);
      if (JSON.stringify(exp) !== JSON.stringify(malas)) mal.push(`${label}/${p.id}: falta el «por qué no» de alguna opción`);
    }
  }
  return mal;
}

test('las diez ampliaciones de la 1.1 son del libro: sus 90 ejercicios se comprueban solos, con dos pistas y sus respuestas aceptadas', () => {
  expect(MANIFIESTOS.map((m) => m.id)).toEqual(['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P13']);
  const labels = MANIFIESTOS.flatMap((m) => Object.keys(m.respuestas).map(renombrar41));
  expect(labels).toHaveLength(90);
  expect(labels.filter((l) => VIEJO.test(l))).toEqual([]);
  expect(labels.flatMap(comprobarEjercicio)).toEqual([]);
  // nothing in the generated content is marked as an expansion any more
  expect(Object.entries(ITEMS).filter(([, it]) => it.ampliacion || it.nuevo).map(([l]) => l)).toEqual([]);
  expect(Object.entries(REFS).filter(([, r]) => r.ampliacion).map(([l]) => l)).toEqual([]);
});

test('los 31 ejercicios nuevos de la 4.1 están curados: se comprueban solos, con dos pistas y sus respuestas aceptadas', () => {
  expect(NUEVOS_41).toHaveLength(31);
  expect(NUEVOS_41.flatMap(comprobarEjercicio)).toEqual([]);
  // the whole book: no exercise left with only the parser's answers
  expect(Object.entries(ITEMS).filter(([, it]) => it.origen !== 'curado').map(([l]) => l)).toEqual([]);
  // a few values recomputed here, against the book's solutions (the rest: the curated file's own comments)
  const r = (l: string, n: number) => ITEMS[l]!.respuestas[n]!;
  expect(comprobar('24 464', r('ej-K.1', 0) as never).tipo).toBe('bien'); // 90 000 − 65 536
  expect(comprobar('90 000', r('ej-K.1', 0) as never).tipo).not.toBe('bien');
  expect(comprobar('−20,78 °', r('ej-57.1', 3) as never).tipo).toBe('bien'); // codo abajo
  expect(comprobar('20,78 °', r('ej-57.1', 3) as never).tipo).not.toBe('bien');
  expect(comprobar('1,608', r('ej-31.29', 0) as never, r('ej-31.29', 0).alternativas as never).tipo).toBe('bien'); // K_p = 1,60
  expect(comprobar('2,37', r('ej-47.15', 6) as never).tipo).toBe('bien'); // t de Student, ν = 8, 95,45 %
  expect(comprobar('2', r('ej-47.15', 6) as never).tipo).not.toBe('bien');
});

test('netlists de las ampliaciones: en spice.json, validadas en el ngspice de la app y enlazadas desde el libro', () => {
  const s = J<{ netlists: Record<string, { fichero: string; refs: string[]; ampliacion?: string; motor: { estado: string } }> }>(path.join(LIBRO, 'spice.json')).netlists;
  let n = 0;
  for (const m of MANIFIESTOS) {
    for (const [nombre, v] of Object.entries(m.spice)) {
      n++;
      const claves = Object.keys(s).filter((k) => k.endsWith(`/${nombre}`) && (!v.parte || k.split('/')[0] === renombrar41(v.parte)));
      expect(claves, `${m.id} ${nombre}`).toHaveLength(1);
      const x = s[claves[0]!]!;
      expect(x.ampliacion, nombre).toBeUndefined();
      expect(x.motor.estado, nombre).toBe('ok');
      expect(x.refs.length, nombre).toBeGreaterThan(0);
      for (const ref of x.refs) expect(REFS[ref], `${nombre} → ${ref}`).toBeTruthy();
      expect(existsSync(path.join(LIBRO, x.fichero)), x.fichero).toBe(true);
    }
  }
  expect(n).toBe(116);
});

test('las preguntas de repaso de las ampliaciones conservan su id (renombrado en la 4.1)', () => {
  const ids = new Set<string>();
  for (const f of readdirSync(path.join(LIBRO, 'repaso'))) {
    if (f === 'indice.json') continue;
    for (const q of J<{ preguntas: { id: string }[] }>(path.join(LIBRO, 'repaso', f)).preguntas) ids.add(q.id);
  }
  let n = 0;
  for (const m of MANIFIESTOS) {
    const r = J<{ preguntas: { id: string }[] } | { id: string }[]>(path.join(AMP, m.id, m.repaso));
    for (const q of Array.isArray(r) ? r : r.preguntas) {
      n++;
      expect(ids.has(renombrar41(q.id)), `${m.id} ${q.id}`).toBe(true);
    }
  }
  expect(n).toBeGreaterThanOrEqual(60);
});

test('las secciones nuevas desde la 4.0 existen con su número impreso', () => {
  const num: Record<string, string> = {
    'sec-new-24-trifasica': '23.10',
    'sec-55.1': '31.1',
    'sec-56.1': '34.1',
    'sec-new-18-datos': '17.10',
    'sec-new-31-muestreado': '30.17',
    'sec-new-47-gum': '48.4',
    'sec-new-38-ensamblador': '39.16',
    'sec-57.1': '54.1',
    'sec-57.9': '54.9',
    'sec-K.1': 'K.1',
  };
  for (const [l, n] of Object.entries(num)) expect(REFS[l]?.num, l).toBe(n);
});
