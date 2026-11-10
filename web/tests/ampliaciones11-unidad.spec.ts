// 1.1: the book's expansions shown in the app before the book has them (contenido/ampliaciones11/, merged by
// contenido/ampliaciones.py; ESQUEMA.md «Ampliaciones del libro (1.1)»). In Node, no browser. Every test works on a copy
// of the generated book (the JSON files) and of the curated sources, never on the real ones:
//   - the ten expansions convert with the app's own converter and nothing is left unresolved;
//   - the merge puts each piece where its notes say, with the numbering they give (sections, figures, exercises and,
//     after each of the two new chapters, every later chapter shifted), and every reference of the book prints
//     refs.json's number; storage keys (part stems, labels) of the existing content do not change;
//   - P02 absorbs 32.13 (a piece «retirar»): its run leaves cap33 while P02 is merged, its label stays as an alias of
//     where its content went (links, bookmarks, the review question and the netlist keep their keys), and it all comes
//     back on undo;
//   - idempotent (a second run leaves every file byte-identical), undone exactly (the book byte for byte), the parts it
//     does not touch byte-identical and, in the ones it does, only numbers change besides what it adds;
//   - when the book already has an expansion (simulated: a book regenerated with it inside) the book's version wins,
//     with no duplicates; also when it has only one of them;
//   - the printed numbers that the curated sources quote follow their label, there and back;
//   - the exercises' answers come from the expansion's data and must be in the solution; the app accepts them;
//   - netlists, review questions, search, glossary links and the classic per-section lessons of the new sections;
//   - the 1.1 lessons of cap00 cite book blocks by index: P08 inserts 41 blocks before 0.13 and every citation still
//     finds its block (by its quote), in the merged book and in the book without the expansions.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.ampliaciones11.config.ts tests/ampliaciones11-unidad.spec.ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { comprobar } from '../src/lib/magnitudes';
import { calcularPasos } from '../src/lib/leccion-pasos';
import type { Bloque, Indice, Parte, Refs } from '../src/lib/tipos';
import type { DatosEjercicios } from '../src/lib/ejercicios.svelte';
import { parse as parseYaml } from 'yaml';
import { generarLeccion, textoDeBloque, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
// @ts-expect-error (a plain .mjs script with no declarations)
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';

await cargarEsquemas11();

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const raiz = path.join(web, '..');
const LIBRO = path.join(web, 'public', 'libro');
const CONTENIDO = path.join(raiz, 'contenido');
const SCRIPT = path.join(CONTENIDO, 'ampliaciones.py');
const AMPLIACIONES = path.join(CONTENIDO, 'ampliaciones11');
const IDS = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P13'];

test.describe.configure({ mode: 'serial' });

// ------------------------------------------------------------------ helpers

function copiarDir(de: string, a: string, filtro: (rel: string) => boolean = () => true, rel = ''): void {
  fs.mkdirSync(a, { recursive: true });
  for (const e of fs.readdirSync(de, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (!filtro(r)) continue;
    if (e.isDirectory()) copiarDir(path.join(de, e.name), path.join(a, e.name), filtro, r);
    else fs.copyFileSync(path.join(de, e.name), path.join(a, e.name));
  }
}

/** The book's JSON (not the figures, equations, data or practice files: the step does not read them). */
function copiarLibro(de: string, a: string): void {
  copiarDir(de, a, (r) => !/^(fig|img|ec|datos|practica|porque|lecciones11|kicad|spice)(\/|$)/.test(r) || r === 'spice');
  fs.mkdirSync(path.join(a, 'fig'), { recursive: true });
  fs.mkdirSync(path.join(a, 'ec'), { recursive: true });
}

interface Entorno {
  libro: string;
  curadas: string;
  ampliaciones: string;
}

function entorno(nombre: string, ids: string[] = IDS, desde = LIBRO): Entorno {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), `epa-amp-${nombre}-`));
  const e = { libro: path.join(base, 'libro'), curadas: path.join(base, 'curadas'), ampliaciones: path.join(base, 'amp') };
  copiarLibro(desde, e.libro);
  fs.mkdirSync(e.curadas, { recursive: true });
  for (const f of ['ejercicios_curado.txt', 'porque_curado.json', 'pasos_curado.json', 'teoria_viva_curado.json', 'averias_curado.json']) {
    if (fs.existsSync(path.join(CONTENIDO, f))) fs.copyFileSync(path.join(CONTENIDO, f), path.join(e.curadas, f));
  }
  copiarDir(path.join(CONTENIDO, 'repaso'), path.join(e.curadas, 'repaso'));
  copiarDir(AMPLIACIONES, e.ampliaciones, (r) => !/^P\d+/.test(r) || ids.includes(r.split('/')[0]!));
  return e;
}

function py(e: Entorno, args: string[], esperado = 0): string {
  const r = spawnSync('python3', [SCRIPT, ...args], {
    env: { ...process.env, EPA_LIBRO: e.libro, EPA_CURADAS: e.curadas, EPA_AMPLIACIONES: e.ampliaciones },
    encoding: 'utf8',
    timeout: 600_000,
  });
  const salida = `${r.stdout}${r.stderr}`;
  expect(r.status, salida).toBe(esperado);
  return salida;
}

function huellas(dir: string, rel = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) for (const [k, v] of huellas(dir, r)) out.set(k, v);
    else if (r.endsWith('.json')) out.set(r, fs.readFileSync(path.join(dir, r), 'utf8'));
  }
  return out;
}

const leer = <T>(dir: string, rel: string): T => JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')) as T;
const parte = (dir: string, stem: string) => leer<Parte>(dir, `partes/${stem}.json`);

function recorrer(o: unknown, f: (d: Record<string, unknown>) => void): void {
  if (Array.isArray(o)) for (const x of o) recorrer(x, f);
  else if (o && typeof o === 'object') {
    f(o as Record<string, unknown>);
    for (const v of Object.values(o)) recorrer(v, f);
  }
}
const figuras = (p: Parte) => {
  const out: { num: string; label?: string }[] = [];
  recorrer(p.bloques, (d) => {
    if (d.t === 'figura') out.push({ num: d.num as string, label: (d.label as string) ?? undefined });
  });
  return out;
};
const h2 = (p: Parte) => p.bloques.filter((b) => b.t === 'h2').map((b) => [(b as { num: string }).num, b.label]);
const ejercicios = (p: Parte) => p.bloques.flatMap((b) => (b.t === 'ejercicios' ? b.items : [])).map((it) => [it.num, it.label]);

/** A book as the author would regenerate it with these expansions pasted in: the merge without its marks. */
function comoLibro(dir: string): void {
  const limpiar = (o: unknown): unknown => {
    if (Array.isArray(o)) return o.map(limpiar);
    if (o && typeof o === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o)) {
        if (k === 'ampliacion' || k === 'num_libro' || k === 'ver_ampliacion' || k === 'ver_retirada' || k.endsWith('_libro')) continue;
        out[k] = limpiar(v);
      }
      return out;
    }
    return o;
  };
  // a label the author retired with the expansion (P02's 32.13) is no longer in the book
  const refs = leer<Refs>(dir, 'refs.json');
  for (const [k, r] of Object.entries(refs)) if (r.retirada) delete refs[k];
  fs.writeFileSync(path.join(dir, 'refs.json'), JSON.stringify(refs));
  for (const [rel] of huellas(dir)) {
    if (rel === 'ampliaciones.json') continue;
    if (!/^(partes\/|indice|refs|busqueda|glosario\.json)/.test(rel)) continue;
    fs.writeFileSync(path.join(dir, rel), JSON.stringify(limpiar(leer(dir, rel))));
  }
  fs.rmSync(path.join(dir, 'ampliaciones.json'));
}

// The pristine book: the real one undone (the undo is exact, see below), shared by the tests.
let LIMPIO = '';
test.beforeAll(() => {
  const e = entorno('limpio');
  py(e, ['--deshacer']);
  LIMPIO = e.libro;
});

// ------------------------------------------------------------------ conversion and merge

test('las diez ampliaciones se convierten con el conversor de la app sin ningún problema', () => {
  const e = entorno('comprobar', IDS, LIMPIO);
  const s = py(e, ['--comprobar']);
  expect(s).toMatch(/10 ampliaciones correctas, 176 etiquetas nuevas/);
  // --comprobar writes nothing
  expect(fs.existsSync(path.join(e.libro, 'ampliaciones.json'))).toBe(false);
  expect(fs.readdirSync(path.join(e.libro, 'fig'))).toHaveLength(0);
});

test('fusión: cada pieza en su sitio y con la numeración de sus notas; dos capítulos nuevos, el 31 y el 34, y los siguientes suben', () => {
  const e = entorno('fusion', IDS, LIMPIO);
  py(e, ['--fase', 'partes']);
  const ind = leer<Indice>(e.libro, 'indice.json');
  const refs = leer<Refs>(e.libro, 'refs.json');
  // P03 in option A, right after cap31 (printed 30), and P02 right after cap33: both in volume V, with their colour; the
  // chapters after each one take the next numbers (32-33 after P03, 35-55 after both)
  expect(ind.tomos.find((t) => t.id === 'V')!.partes).toEqual(['cap30', 'cap31', 'cap-new-automatas', 'cap32', 'cap33', 'cap-new-maquinas', 'cap34', 'cap35', 'cap36']);
  expect(ind.partes['cap-new-automatas']).toMatchObject({ num: '31', label: 'cap-new-automatas', color: 'A6552B', tomo: 'V', ampliacion: 'P03' });
  expect(ind.partes['cap-new-maquinas']).toMatchObject({ num: '34', label: 'cap-new-maquinas', color: 'A6552B', tomo: 'V', ampliacion: 'P02' });
  expect(['cap00', 'cap31', 'cap32', 'cap33', 'cap34', 'cap36', 'cap44', 'cap47', 'cap54'].map((s) => ind.partes[s]!.num)).toEqual(['0', '30', '32', '33', '35', '37', '45', '48', '55']);
  const orden = Object.keys(ind.partes);
  expect(orden.indexOf('cap-new-automatas')).toBe(orden.indexOf('cap31') + 1);
  expect(orden.indexOf('cap-new-maquinas')).toBe(orden.indexOf('cap33') + 1);
  // the storage keys of existing content do not change: same stems, same labels, only their numbers
  expect(orden.filter((s) => !s.startsWith('cap-new-'))).toEqual(Object.keys(leer<Indice>(LIMPIO, 'indice.json').partes));
  expect(refs['cap-32']).toMatchObject({ num: '32', num_libro: '31', parte: 'cap32' });
  expect(refs['cap-35']).toMatchObject({ num: '36', num_libro: '34', parte: 'cap35' });
  // P01: 23.10 Sistemas Trifásicos before the summary, which becomes 23.11; figures 23.17-23.22, exercises 23.9-23.16
  const c24 = parte(e.libro, 'cap24');
  expect(h2(c24).slice(-3)).toEqual([['23.9', 'sec-24.9'], ['23.10', 'sec-new-24-trifasica'], ['23.11', 'sec-24.10']]);
  expect(figuras(c24).slice(15).map((f) => f.num)).toEqual(['23.16', '23.17', '23.18', '23.19', '23.20', '23.21', '23.22']);
  expect(ejercicios(c24).slice(7)).toEqual([['23.8', 'ej-24.8'], ...Array.from({ length: 8 }, (_, k) => [`23.${9 + k}`, `ej-24.${9 + k}`])]);
  // P05 and P06 in the same chapter: 30.10-30.12 and 30.15; the old 30.10-30.11 → 30.13-30.14, 30.12-30.14 → 30.16-30.18;
  // new figures 30.19-30.24 (P05) and 30.27-30.30 (P06), old 30.19-30.20 → 30.25-30.26 and 30.21-30.22 → 30.31-30.32
  const c31 = parte(e.libro, 'cap31');
  expect(h2(c31).slice(9).map((x) => x[1])).toEqual(['sec-new-31-respuesta', 'sec-new-31-estabilidad', 'sec-new-31-compensacion', 'sec-31.10', 'sec-31.11', 'sec-new-31-modelado', 'sec-31.12', 'sec-31.13', 'sec-31.14']);
  expect(h2(c31).slice(9).map((x) => x[0])).toEqual(Array.from({ length: 9 }, (_, k) => `30.${10 + k}`));
  expect(refs['sec-31.10']).toMatchObject({ num: '30.13', num_libro: '30.10' });
  expect(refs['sec-31.12']).toMatchObject({ num: '30.16', num_libro: '30.12' });
  expect(refs['fig-31.19']).toMatchObject({ num: '30.25', num_libro: '30.19' });
  expect(refs['fig-31.21']).toMatchObject({ num: '30.31', num_libro: '30.21' });
  expect(figuras(c31).filter((f) => f.label?.startsWith('fig-new')).map((f) => f.num)).toEqual(['30.19', '30.20', '30.21', '30.22', '30.23', '30.24', '30.27', '30.28', '30.29', '30.30']);
  expect(refs['prob-31.D']).toMatchObject({ num: '30.D', ampliacion: 'P05' });
  expect(ejercicios(c31).filter((x) => /^ej-31\.(9|17|18|25)$/.test(x[1]!))).toEqual([['30.9', 'ej-31.9'], ['30.17', 'ej-31.17'], ['30.18', 'ej-31.18'], ['30.25', 'ej-31.25']]);
  // P04 (32 → 33) with 32.13 retired by P02: 33.10-33.11, the old 32.10-32.12 → 33.12-33.14, 32.14-32.17 → 33.15-33.18;
  // figures 33.12-33.18 and 33.27 (32.13 had none)
  const c33 = parte(e.libro, 'cap33');
  expect(refs['sec-new-33-inversor']!.num).toBe('33.10');
  expect(refs['sec-33.10']).toMatchObject({ num: '33.12', num_libro: '32.10' });
  expect(refs['sec-33.14']).toMatchObject({ num: '33.15', num_libro: '32.14' });
  expect(refs['sec-33.17']).toMatchObject({ num: '33.18', num_libro: '32.17' });
  expect(figuras(c33).filter((f) => f.label?.startsWith('fig-new')).map((f) => f.num)).toEqual(['33.12', '33.13', '33.14', '33.15', '33.16', '33.17', '33.18', '33.27']);
  expect(figuras(c33).find((f) => f.label === 'fig-33.11')!.num).toBe('33.19');
  expect(refs['prob-33.D']!.num).toBe('33.D');
  // the card: P04's five formulas at its end, marked; the five motor formulas of 32.13 went with P02
  const tarjeta = c33.bloques.find((b) => b.t === 'tarjeta')! as { bloques: (Bloque & { fuente?: string })[] };
  expect(tarjeta.bloques.filter((b) => b.ampliacion === 'P04')).toHaveLength(5);
  expect(tarjeta.bloques.filter((b) => !b.ampliacion)).toHaveLength(5);
  expect(tarjeta.bloques.some((b) => b.fuente?.startsWith('V = E + I'))).toBe(false);
  // P13 (43 → 45): 45.6-45.7, the old 43.6-43.13 → 45.8-45.15; figures 45.9-45.11 and 45.19; exercises 45.6-45.14
  const c44 = parte(e.libro, 'cap44');
  expect(refs['sec-new-44-modbus']!.num).toBe('45.6');
  expect(refs['sec-44.13']).toMatchObject({ num: '45.15', num_libro: '43.13' });
  expect(refs['prob-44.D']!.num).toBe('45.D');
  expect(figuras(c44).filter((f) => f.label?.startsWith('fig-new')).map((f) => f.num)).toEqual(['45.9', '45.10', '45.11', '45.19']);
  expect(ejercicios(c44).filter((x) => /^ej-44\.(6|14)$/.test(x[1]!))).toEqual([['45.6', 'ej-44.6'], ['45.14', 'ej-44.14']]);
  // P07 (46 → 48): 48.8 before «Seguridad en el Laboratorio», which becomes 48.9; figures 48.14-48.17, old 46.14 → 48.18
  expect(refs['sec-new-47-instalaciones']).toMatchObject({ num: '48.8', ampliacion: 'P07' });
  expect(refs['sec-47.8']).toMatchObject({ num: '48.9', num_libro: '46.8' });
  expect(figuras(parte(e.libro, 'cap47')).filter((f) => f.label?.startsWith('fig-new')).map((f) => f.num)).toEqual(['48.14', '48.15', '48.16', '48.17']);
  expect(refs['fig-47.14']).toMatchObject({ num: '48.18', num_libro: '46.14' });
  expect([refs['ej-47.6']!.num, refs['ej-47.13']!.num]).toEqual(['48.6', '48.13']);
  // P09 (35 → 37): a new first section, 37.1, after the chapter's opening; 35.1-35.13 → 37.2-37.14, figures 35.1 → 37.4
  const c36 = parte(e.libro, 'cap36');
  expect(h2(c36).slice(0, 2)).toEqual([['37.1', 'sec-new-36-maxwell'], ['37.2', 'sec-36.1']]);
  expect(figuras(c36).slice(0, 4).map((f) => [f.num, f.label])).toEqual([['37.1', 'fig-new-36-gauss'], ['37.2', 'fig-new-36-onda'], ['37.3', 'fig-new-36-cercano'], ['37.4', 'fig-36.1']]);
  expect([refs['ej-36.6']!.num, refs['ej-36.14']!.num]).toEqual(['37.6', '37.14']);
  // P08 (cap00): the end of 0.12 (no new section) and a new 0.13; 0.13-0.21 → 0.14-0.22; figures 0.13 (in 0.12),
  // 0.14-0.15, and the old 0.13-0.16 → 0.16-0.19; exercises 0.11-0.19
  const c00 = parte(e.libro, 'cap00');
  const k012 = c00.bloques.findIndex((b) => b.label === 'sec-0.12');
  const k013 = c00.bloques.findIndex((b) => b.label === 'sec-new-0-numericos');
  expect(c00.bloques.slice(k012 + 1, k013).filter((b) => b.t === 'h2')).toHaveLength(0);
  expect(c00.bloques.slice(k012, k013 + 32).filter((b) => b.ampliacion === 'P08')).toHaveLength(41);
  expect(c00.bloques[k013 + 32]).toMatchObject({ t: 'h2', label: 'sec-0.13', num: '0.14', num_libro: '0.13' });
  expect(refs['sec-new-0-resumen']).toMatchObject({ num: '0.22', num_libro: '0.21' });
  expect(['fig-new-0-modos', 'fig-new-0-newton', 'fig-new-0-compania', 'fig-0.14', 'fig-0.17'].map((l) => refs[l]!.num)).toEqual(['0.13', '0.14', '0.15', '0.16', '0.19']);
  expect(ejercicios(c00).slice(9).map((x) => x[0])).toEqual(Array.from({ length: 10 }, (_, k) => `0.${10 + k}`));
  // P03: the whole chapter, 9 sections, 8 figures, problem 31.A, 8 exercises with their solutions
  const nuevo = parte(e.libro, 'cap-new-automatas');
  expect(nuevo).toMatchObject({ id: 'cap-new-automatas', num: '31', ampliacion: 'P03', titulo: 'Automatismos y Autómatas Programables' });
  expect(h2(nuevo).map((x) => x[0])).toEqual(Array.from({ length: 9 }, (_, k) => `31.${k + 1}`));
  expect(figuras(nuevo).map((f) => f.num)).toEqual(Array.from({ length: 8 }, (_, k) => `31.${k + 1}`));
  expect(nuevo.bloques.flatMap((b) => (b.t === 'ejercicios' ? b.items : [])).every((it) => it.solucion?.length)).toBe(true);
  // P02: the whole chapter 34, 8 sections, 9 figures, problem 34.A, 9 exercises with their solutions
  const maq = parte(e.libro, 'cap-new-maquinas');
  expect(maq).toMatchObject({ id: 'cap-new-maquinas', num: '34', ampliacion: 'P02', titulo: 'Máquinas Eléctricas y Accionamientos' });
  expect(h2(maq).map((x) => x[1])).toEqual(Array.from({ length: 8 }, (_, k) => `sec-new-maquinas.${k + 1}`));
  expect(h2(maq).map((x) => x[0])).toEqual(Array.from({ length: 8 }, (_, k) => `34.${k + 1}`));
  expect(figuras(maq).map((f) => f.num)).toEqual(Array.from({ length: 9 }, (_, k) => `34.${k + 1}`));
  expect(refs['prob-new-maquinas.A']!.num).toBe('34.A');
  expect(ejercicios(maq).map((x) => x[1])).toEqual(Array.from({ length: 9 }, (_, k) => `ej-new-maquinas.${k + 1}`));
  // figures and equations exist; the figures have their glyphs as paths (no <text>), equations their size
  for (const f of figuras(nuevo)) expect(f.label).toMatch(/^fig-new-automatas\.\d$/);
  recorrer([c00, c24, c31, c33, c36, c44, parte(e.libro, 'cap47'), nuevo, maq], (d) => {
    if (d.t === 'figura' && String(d.src).startsWith('fig/') && (d.label as string)?.startsWith('fig-new')) {
      const svg = fs.readFileSync(path.join(e.libro, d.src as string), 'utf8');
      expect(svg).not.toContain('<text');
      expect(d).toMatchObject({ tipo_figura: 'diagrama' });
      expect((d.svg_vista as number[]).length).toBe(4);
    }
    if (d.t === 'ec' && d.ampliacion) {
      expect(fs.existsSync(path.join(e.libro, d.svg as string)), d.svg as string).toBe(true);
      expect(d.w as number).toBeGreaterThan(0);
    }
  });
  // the one equation of the book that prints a shifted number (cap32, problem 31.A → 32.A) is drawn again
  let rehecha = 0;
  recorrer(parte(e.libro, 'cap32').bloques, (d) => {
    if (d.svg_libro) {
      rehecha++;
      expect(fs.existsSync(path.join(e.libro, d.svg as string))).toBe(true);
    }
  });
  expect(rehecha).toBe(1);
});

test('P02 absorbe la 32.13: sale de cap33 mientras P02 está fusionada, su etiqueta lleva a su contenido nuevo y todo vuelve al deshacer', () => {
  const e = entorno('retirar', IDS, LIMPIO);
  const original = huellas(e.libro);
  py(e, ['--fase', 'partes']);
  const refs = leer<Refs>(e.libro, 'refs.json');
  const c33 = parte(e.libro, 'cap33');
  const limpio33 = parte(LIMPIO, 'cap33');
  // the run (the section's 26 blocks, h2 to the paragraph before the card) is out, the card stays where it was
  const k = limpio33.bloques.findIndex((b) => b.label === 'sec-33.13');
  expect(limpio33.bloques.slice(k, k + 27).map((b) => b.t).slice(-1)).toEqual(['tarjeta']);
  expect(c33.bloques.some((b) => b.label === 'sec-33.13')).toBe(false);
  expect(leer<Indice>(e.libro, 'indice.json').partes.cap33!.secciones!.map((s) => s.label)).not.toContain('sec-33.13');
  expect(leer<{ id: string }[]>(e.libro, 'busqueda.json').some((d) => d.id === 'sec-33.13')).toBe(false);
  // its label stays as an alias of where its content went (the app's candidatosDeRef honours «label»): links,
  // bookmarks, notes and progress keyed by it keep working; «libro» is the book's entry
  expect(refs['sec-33.13']).toEqual({ num: '34.3', parte: 'cap-new-maquinas', tipo: 'sec', label: 'sec-new-maquinas.3', retirada: 'P02', libro: { num: '32.13', parte: 'cap33', tipo: 'sec' } });
  // every reference that pointed to it now points to where each topic went: none is left
  for (const f of fs.readdirSync(path.join(e.libro, 'partes'))) expect(fs.readFileSync(path.join(e.libro, 'partes', f), 'utf8'), f).not.toContain('data-ref=\\"sec-33.13\\"');
  const s35 = JSON.stringify(parte(e.libro, 'cap35'));
  expect(s35).toContain('data-ref=\\"sec-new-maquinas.5\\">34.5<');            // the BLDC's rotor position (book: marked)
  expect(s35).toContain('"refs_libro":{"sec-new-maquinas.5":"sec-33.13"}');
  expect(JSON.stringify(parte(e.libro, 'cap-new-automatas'))).toContain('data-ref=\\"sec-new-maquinas.4\\">34.4<');   // P03: direct starting
  expect(JSON.stringify(c33)).toContain('data-ref=\\"sec-new-maquinas.6\\">34.6<');                                      // P04: V/f
  expect(JSON.stringify(parte(e.libro, 'cap31'))).toContain('data-ref=\\"sec-new-maquinas.3\\">34.3<');                 // P06: the DC motor
  const glos = leer<{ id: string; ver: string[]; ver_retirada?: unknown }[]>(e.libro, 'glosario.json');
  expect(glos.find((g) => g.id === 'glos-fuerza-contraelectromotriz')).toMatchObject({ ver: ['sec-4.1', 'sec-new-maquinas.3'] });
  expect(glos.find((g) => g.id === 'glos-motor-paso-a-paso')!.ver).toEqual(['sec-new-maquinas.5']);
  // the registry keeps what it took out, for the undo
  const reg = leer<{ retiradas: { id: string; parte: string; pos: number; bloques: unknown[]; tarjeta: unknown[] }[] }>(e.libro, 'ampliaciones.json');
  expect(reg.retiradas.map((r) => [r.id, r.parte, r.pos, r.bloques.length, r.tarjeta.length])).toEqual([['P02', 'cap33', k, 26, 5]]);
  // undo: the book exactly as generated
  py(e, ['--deshacer']);
  const deshecho = huellas(e.libro);
  for (const [rel, antes] of original) expect(deshecho.get(rel), rel).toBe(antes);
  // without P02 nothing is retired (and P04's card piece still finds the card); P07 cites P02's sections, so it goes too
  const sin = entorno('sinp02', IDS.filter((x) => x !== 'P02' && x !== 'P07'), LIMPIO);
  py(sin, ['--fase', 'partes']);
  expect(parte(sin.libro, 'cap33').bloques.find((b) => b.label === 'sec-33.13')).toMatchObject({ num: '33.15', num_libro: '32.13' });
  expect(leer<Refs>(sin.libro, 'refs.json')['sec-33.13']).toEqual({ num: '33.15', parte: 'cap33', tipo: 'sec', num_libro: '32.13' });
});

test('referencias: cada enlace de cada parte imprime el número de refs.json y todas tienen destino', () => {
  const e = entorno('refs', IDS, LIMPIO);
  py(e, ['--fase', 'partes']);
  const refs = leer<Refs>(e.libro, 'refs.json');
  const malos: string[] = [];
  let n = 0;
  for (const f of fs.readdirSync(path.join(e.libro, 'partes'))) {
    const s = fs.readFileSync(path.join(e.libro, 'partes', f), 'utf8');
    for (const m of s.matchAll(/data-ref=\\"([^"\\]+)\\">([^<]*)</g)) {
      n++;
      const r = refs[m[1]!];
      if (!r) malos.push(`${f}: ${m[1]} sin destino`);
      else if (r.num !== m[2]) malos.push(`${f}: ${m[1]} imprime ${m[2]} y es ${r.num}`);
    }
    expect(s).not.toMatch(/[]|ec\/T\d+\.svg/);
  }
  expect(n).toBeGreaterThan(5_000);
  expect(malos).toEqual([]);
  // P03 cites P13's sections and P01's: «secciones 45.6 y 45.7», «sección 23.10»; P07 cites P02's: «sección 34.4»
  const s = JSON.stringify(parte(e.libro, 'cap-new-automatas'));
  expect(s).toContain('data-ref=\\"sec-new-44-modbus\\">45.6<');
  expect(JSON.stringify(parte(e.libro, 'cap47'))).toContain('data-ref=\\"sec-new-maquinas.4\\">34.4<');
  expect(s).toContain('data-ref=\\"sec-new-24-trifasica\\">23.10<');
});

test('idempotente, se deshace byte a byte y lo que no toca queda idéntico; donde toca solo cambian números', () => {
  const e = entorno('idem', IDS, LIMPIO);
  const original = huellas(e.libro);
  py(e, ['--fase', 'partes']);
  const una = huellas(e.libro);
  py(e, ['--fase', 'partes']);
  expect(huellas(e.libro)).toEqual(una);
  // untouched parts: byte-identical; touched ones differ only in numbers (num/num_libro, the anchors' text, the one
  // equation drawn again) besides what is marked as added and the run P02 retires (with the references to it, marked)
  const ind = leer<Indice>(e.libro, 'indice.json');
  const refs = leer<Refs>(e.libro, 'refs.json');
  const retiradas = leer<{ retiradas: { parte: string; pos: number; bloques: unknown[]; tarjeta: [number, { fuente: string }][] }[] }>(e.libro, 'ampliaciones.json').retiradas;
  const sinRetirado = (rel: string, a: Parte): Parte => {
    for (const r of retiradas.filter((x) => `partes/${x.parte}.json` === rel)) {
      a.bloques.splice(r.pos, r.bloques.length);
      const tarjeta = a.bloques.slice(r.pos).find((b) => b.t === 'tarjeta') as { bloques: { fuente?: string }[] };
      const fuera = new Set(r.tarjeta.map(([, l]) => l.fuente));
      tarjeta.bloques = tarjeta.bloques.filter((l) => !fuera.has(l.fuente));
    }
    return a;
  };
  let iguales = 0;
  for (const [rel, antes] of original) {
    if (!rel.startsWith('partes/')) continue;
    const despues = una.get(rel)!;
    if (despues === antes) {
      iguales++;
      continue;
    }
    const a = sinRetirado(rel, JSON.parse(antes) as Parte) as unknown;
    const b = JSON.parse(despues) as unknown;
    const raros: string[] = [];
    // (a reference redirected away from a retired label: «refs_libro» {new: old} of the dict that holds it)
    const volver = (s: string, mapa: Record<string, string>) => s.replace(/data-ref="([^"]+)">/g, (m, l: string) => (mapa[l] ? `data-ref="${mapa[l]}">` : m));
    const comparar = (x: unknown, y: unknown, donde: string, mapa: Record<string, string> = {}): void => {
      if (Array.isArray(x) && Array.isArray(y)) {
        const ys = (y as unknown[]).filter((v) => !(v && typeof v === 'object' && 'ampliacion' in v));
        if (ys.length !== x.length) return void raros.push(`${donde}: longitud`);
        x.forEach((v, k) => comparar(v, ys[k], `${donde}[${k}]`, mapa));
        return;
      }
      if (x && typeof x === 'object' && y && typeof y === 'object') {
        const xo = x as Record<string, unknown>;
        const yo = y as Record<string, unknown>;
        const suyo = { ...mapa, ...((yo.refs_libro as Record<string, string>) ?? {}) };
        for (const k of Object.keys(yo)) {
          if (k in xo) {
            if (k === 'num' && yo.num_libro === xo.num) continue;
            if (['svg', 'w', 'h'].includes(k) && 'svg_libro' in yo) continue;
            // a glossary term that an expansion treats links to it as well (ver_ampliacion says which), and one that
            // sent the reader to a retired label sends him where its content went (ver_retirada)
            if (k === 'ver' && (Array.isArray(yo.ver_ampliacion) || Array.isArray(yo.ver_retirada))) {
              const ver = (yo.ver as string[]).filter((v) => !((yo.ver_ampliacion as string[] | undefined) ?? []).includes(v));
              for (const [i, lab, d] of [...((yo.ver_retirada as [number, string, string | null][] | undefined) ?? [])].reverse()) {
                if (d === null) ver.splice(i, 0, lab);
                else ver[i] = lab;
              }
              comparar(xo.ver, ver, `${donde}.ver`);
              continue;
            }
            comparar(xo[k], yo[k], `${donde}.${k}`, suyo);
          } else if (!['num_libro', 'svg_libro', 'w_libro', 'h_libro', 'ver_ampliacion', 'ver_retirada', 'refs_libro'].includes(k)) raros.push(`${donde}.${k}: nuevo`);
        }
        return;
      }
      if (typeof x === 'string' && typeof y === 'string' && x !== y) {
        // only anchors' numbers may change, to refs.json's (and a retired label's anchors, to where it went)
        const sinNumeros = (s: string) => s.replace(/(data-ref="([^"]+)">)[^<]*</g, '$1<');
        if (sinNumeros(x) !== sinNumeros(volver(y, mapa))) return void raros.push(`${donde}: texto`);
        for (const m of y.matchAll(/data-ref="([^"]+)">([^<]*)</g)) if (refs[m[1]!]?.num !== m[2]) raros.push(`${donde}: ${m[1]}`);
        return;
      }
      if (x !== y) raros.push(`${donde}: ${String(x)} → ${String(y)}`);
    };
    comparar(a, b, rel);
    expect(raros, rel).toEqual([]);
  }
  expect(iguales).toBeGreaterThanOrEqual(5);
  expect(ind.tomos.flatMap((t) => t.partes).filter((s) => !original.has(`partes/${s}.json`))).toEqual(['cap-new-automatas', 'cap-new-maquinas']);
  // undo: the book exactly as generated, every JSON file
  py(e, ['--deshacer']);
  const deshecho = huellas(e.libro);
  for (const [rel, antes] of original) expect(deshecho.get(rel), rel).toBe(antes);
  expect([...deshecho.keys()].filter((k) => !original.has(k))).toEqual([]);
  expect(fs.readdirSync(path.join(e.libro, 'fig'))).toEqual([]);
  expect(fs.readdirSync(path.join(e.libro, 'ec'))).toEqual([]);
  // and with no expansion at all the merge changes nothing either
  const sin = entorno('sin', [], LIMPIO);
  const antesSin = huellas(sin.libro);
  py(sin, ['--fase', 'partes']);
  expect(huellas(sin.libro)).toEqual(antesSin);
});

test('el libro ya trae las ampliaciones: gana el libro, sin duplicados; y si solo trae una, solo esa se omite', () => {
  // the author pasted all five and regenerated: the book is the merge without its marks
  const e = entorno('conlibro', IDS, LIMPIO);
  py(e, ['--fase', 'partes']);
  const fusion = huellas(e.libro);
  comoLibro(e.libro);
  const libro = huellas(e.libro);
  const s = py(e, ['--fase', 'partes']);
  expect(s).toMatch(/se queda el del libro/);
  const despues = huellas(e.libro);
  for (const [rel, v] of libro) if (rel !== 'ampliaciones.json') expect(despues.get(rel), rel).toBe(v);
  const reg = leer<{ ampliaciones: { id: string; etiquetas: string[]; omitidas: string[] }[] }>(e.libro, 'ampliaciones.json');
  expect(reg.ampliaciones.every((a) => a.etiquetas.length === 0 && a.omitidas.length > 0)).toBe(true);
  const refs = leer<Refs>(e.libro, 'refs.json');
  expect(Object.values(refs).some((r) => r.ampliacion || r.retirada)).toBe(false);
  expect(refs['sec-33.13']).toBeUndefined();
  // no label twice anywhere
  for (const f of fs.readdirSync(path.join(e.libro, 'partes'))) {
    const vistos = new Set<string>();
    recorrer(leer(e.libro, `partes/${f}`), (d) => {
      if (typeof d.label === 'string' && ('t' in d || 'bloques' in d)) {
        expect(vistos.has(d.label), `${f} ${d.label}`).toBe(false);
        vistos.add(d.label);
      }
    });
  }
  expect(despues.get('busqueda.json')).toBe(libro.get('busqueda.json'));
  void fusion;

  // the book has only P01 (sections, exercises): the other four are added, P01 is not, cap24 keeps the book's numbers
  const solo = entorno('solop01', ['P01'], LIMPIO);
  py(solo, ['--fase', 'partes']);
  comoLibro(solo.libro);
  const conP01 = huellas(solo.libro);
  fs.rmSync(solo.ampliaciones, { recursive: true });
  copiarDir(AMPLIACIONES, solo.ampliaciones);
  py(solo, ['--fase', 'partes']);
  // cap24 keeps the book's sections, figures and exercises, unmarked (only its references to later chapters move)
  const antes24 = JSON.parse(conP01.get('partes/cap24.json')!) as Parte;
  const despues24 = parte(solo.libro, 'cap24');
  expect(h2(despues24)).toEqual(h2(antes24));
  expect(figuras(despues24)).toEqual(figuras(antes24));
  expect(ejercicios(despues24)).toEqual(ejercicios(antes24));
  expect(JSON.stringify(despues24)).not.toContain('"ampliacion"');
  expect(h2(despues24).filter((x) => x[1] === 'sec-new-24-trifasica')).toHaveLength(1);
  const r2 = leer<Refs>(solo.libro, 'refs.json');
  expect(r2['sec-new-24-trifasica']).toEqual({ num: '23.10', parte: 'cap24', tipo: 'sec' });
  expect(r2['sec-new-44-modbus']).toMatchObject({ num: '45.6', ampliacion: 'P13' });
  expect(r2['cap-new-automatas']).toMatchObject({ num: '31', ampliacion: 'P03' });
  // and the result is what the five merged into the plain book give, but without P01's marks
  const todo = entorno('todo', IDS, LIMPIO);
  py(todo, ['--fase', 'partes']);
  expect(leer<Refs>(todo.libro, 'refs.json')['sec-24.10']!.num).toBe(r2['sec-24.10']!.num);

  // the book has P01-P04 and P13 (P02 cites P01, P03 and P04; P03, P13): the author pasted the chapter and removed 32.13. The chapter is
  // the book's, nothing is retired again, the alias is gone, and the card is the book's (P04's lines, not the motor's)
  const p02 = entorno('solop02', ['P01', 'P02', 'P03', 'P04', 'P13'], LIMPIO);
  py(p02, ['--fase', 'partes']);
  comoLibro(p02.libro);
  fs.rmSync(p02.ampliaciones, { recursive: true });
  copiarDir(AMPLIACIONES, p02.ampliaciones);
  const s2 = py(p02, ['--fase', 'partes']);
  expect(s2).toMatch(/P02 retirar sec-33\.13: el libro ya trae sec-new-maquinas\.3; se queda el del libro/);
  const r3 = leer<Refs>(p02.libro, 'refs.json');
  expect(r3['cap-new-maquinas']).toEqual({ num: '34', parte: 'cap-new-maquinas', tipo: 'cap' });
  // P06, still an expansion, cites 32.13: the label is an alias again (with no book entry) and its anchors go to 34.3
  expect(r3['sec-33.13']).toEqual({ num: '34.3', parte: 'cap-new-maquinas', tipo: 'sec', label: 'sec-new-maquinas.3', retirada: 'P02', libro: null });
  expect(JSON.stringify(parte(p02.libro, 'cap31'))).toContain('data-ref=\\"sec-new-maquinas.3\\">34.3<');
  expect(JSON.stringify(parte(p02.libro, 'cap31'))).not.toContain('data-ref=\\"sec-33.13\\"');
  expect(JSON.stringify(parte(p02.libro, 'cap-new-maquinas'))).not.toContain('"ampliacion"');
  const t33 = parte(p02.libro, 'cap33').bloques.find((b) => b.t === 'tarjeta') as { bloques: (Bloque & { fuente?: string })[] };
  expect(t33.bloques.filter((b) => b.ampliacion)).toHaveLength(0);
  expect(t33.bloques).toHaveLength(10);
  expect(t33.bloques.some((b) => b.fuente?.startsWith('V = E + I'))).toBe(false);
  expect(parte(p02.libro, 'cap33').bloques.some((b) => b.label === 'sec-33.13')).toBe(false);
  expect(leer<{ retiradas: { bloques: unknown[]; solo_alias?: boolean }[] }>(p02.libro, 'ampliaciones.json').retiradas).toMatchObject([{ bloques: [], solo_alias: true }]);
});

test('las citas de las fuentes curadas siguen a su etiqueta: se renumeran, no dos veces, y vuelven al deshacer', () => {
  // sources with no record yet (as the first time): their mentions are in the book's numbering
  const e = entorno('citas', IDS, LIMPIO);
  fs.rmSync(e.curadas, { recursive: true });
  fs.mkdirSync(path.join(e.curadas, 'repaso'), { recursive: true });
  fs.rmSync(path.join(e.ampliaciones, 'numeracion.json'), { force: true });
  const f = path.join(e.curadas, 'repaso', 'prueba.json');
  const texto = 'Véanse la sección 31.10, las figuras 32.12 y 32.19, el capítulo 31, el problema 43.A, la sección 23.10 y el apartado 4.2 de la norma IEC 60204-1.';
  fs.writeFileSync(f, JSON.stringify({ t: texto }));
  py(e, ['--fase', 'partes']);
  const una = (JSON.parse(fs.readFileSync(f, 'utf8')) as { t: string }).t;
  expect(una).toBe('Véanse la sección 32.10, las figuras 33.19 y 33.26, el capítulo 32, el problema 45.A, la sección 23.11 y el apartado 4.2 de la norma IEC 60204-1.');
  py(e, ['--fase', 'partes']);
  expect((JSON.parse(fs.readFileSync(f, 'utf8')) as { t: string }).t).toBe(una);
  py(e, ['--deshacer']);
  expect((JSON.parse(fs.readFileSync(f, 'utf8')) as { t: string }).t).toBe(texto);
  // a mention added afterwards, copied from the merged app, is taken as current: «sección 33.10» stays
  py(e, ['--fase', 'partes']);
  fs.writeFileSync(f, JSON.stringify({ t: una + ' Y la sección 33.10.' }));
  py(e, ['--fase', 'partes']);
  expect((JSON.parse(fs.readFileSync(f, 'utf8')) as { t: string }).t).toBe(una + ' Y la sección 33.10.');
});

// ------------------------------------------------------------------ exercises, netlists, review, search, lessons (real data)

test('ejercicios de las ampliaciones: marcados, con respuestas de sus datos que la app acepta; un dato que no cuadra se rechaza', () => {
  const datos = leer<DatosEjercicios>(LIBRO, 'ejercicios.json');
  const amp = Object.entries(datos.items).filter(([, it]) => it.ampliacion);
  expect(amp).toHaveLength(90);
  expect(amp.filter(([l]) => l.startsWith('prob-')).map(([l]) => l).sort()).toEqual(['prob-31.D', 'prob-33.D', 'prob-44.D', 'prob-new-automatas.A', 'prob-new-maquinas.A']);
  // hints from their own solution (its first substitution, its first intermediate result), never one of the answers
  const conPistas = amp.filter(([, it]) => it.pistas.length);
  expect(conPistas.length).toBeGreaterThanOrEqual(40);
  for (const [l, it] of conPistas) {
    expect(it.pistas[0], l).toMatch(/^(Empiece por|Resultado intermedio): /);
    for (const r of it.respuestas) for (const p of it.pistas) expect(p.includes(` ${r.texto}`), `${l}: ${p}`).toBe(false);
  }
  expect(datos.items['ej-0.15']!.pistas).toEqual(['Empiece por: I₀ = 10⁻¹²·(e<sup>0,6/0,02585</sup> − 1).', 'Resultado intermedio: I₀ = 12,03 mA.']);
  const ind = leer<Indice>(LIBRO, 'indice.json');
  let campos = 0;
  for (const [l, it] of amp) {
    expect(it.nuevo, l).toBeUndefined();
    expect(it.origen, l).toBe('ampliacion');
    expect(it.num.startsWith(`${ind.partes[it.parte]!.num}.`), l).toBe(true);
    const p = parte(LIBRO, it.parte);
    if (it.tipo === 'ej') {
      const b = p.bloques[it.pos[0]!]!;
      expect(b.t === 'ejercicios' && b.items[it.pos[1]!]!.label, l).toBe(l);
    }
    for (const r of it.respuestas) {
      campos++;
      expect(comprobar(r.texto, r, r.alternativas).tipo, `${l} ${r.texto}`).toBe('bien');
      expect(comprobar(String(r.valor * 3 + 1).replace('.', ','), r, r.alternativas).tipo, `${l} ×3`).not.toBe('bien');
    }
    expect(it.modo, l).toBe(it.respuestas.length ? 'auto' : 'comparar');
  }
  expect(campos).toBeGreaterThan(100);
  // the check behind them: a value that is not the datum rounded, or that is not in the solution, stops the step
  const prueba = (escrito: string) =>
    spawnSync('python3', ['-c', `
import sys, json
sys.path.insert(0, ${JSON.stringify(CONTENIDO)})
import ampliaciones as A
man = [m for m in A.cargar_manifiestos() if m['id'] == 'P01'][0]
sol = 'Cada impedancia recibe 230,9 V: I_L = I_f = 230,9/50 = 4,62 A. Otra cifra: 4,70 A.'
try:
    print(json.dumps(A.respuestas_de(man, 'ej-24.10', [['I', ${JSON.stringify(escrito)}, 'calculos:ejercicios.e10.I']], sol)))
except A.Fallo as e:
    print('FALLO', e)
`], { encoding: 'utf8' }).stdout;
  expect(prueba('4,62 A')).toContain('"valor": 4.62');
  expect(prueba('4,70 A')).toContain('no es el dato');
  expect(prueba('4,63 A')).toContain('no aparece en la solución');
});

test('netlists de las ampliaciones: copiadas, validadas en el ngspice de la app y enlazadas desde sus secciones y ejercicios', () => {
  const s = leer<{ netlists: Record<string, { fichero: string; refs: string[]; ampliacion?: string; motor: { estado: string }; parte: string }>; porRef: Record<string, string[]>; capitulos: { parte: string; num: string; ampliacion?: string; netlists: string[] }[]; total: number }>(LIBRO, 'spice.json');
  const amp = Object.entries(s.netlists).filter(([, n]) => n.ampliacion);
  expect(amp).toHaveLength(116);
  expect(s.total).toBe(Object.keys(s.netlists).length);
  for (const [id, n] of amp) {
    expect(fs.existsSync(path.join(LIBRO, n.fichero)), id).toBe(true);
    expect(n.motor.estado, id).toBe('ok');
    expect(n.refs.length, id).toBeGreaterThan(0);
  }
  expect(s.porRef['ej-24.10']).toContain('cap24/n7_ej10_estrella');
  expect(s.porRef['sec-new-automatas.3']).toContain('cap-new-automatas/s1_off_sin_rp');
  expect(leer<Record<string, string[]>>(LIBRO, 'spice-refs.json')).toEqual(s.porRef);
  const caps = s.capitulos.map((c) => c.parte);
  expect(caps.indexOf('cap-new-automatas')).toBe(caps.indexOf('cap31') + 1);
  expect(s.capitulos.find((c) => c.parte === 'cap-new-automatas')).toMatchObject({ num: '31', ampliacion: 'P03' });
  expect(s.capitulos.find((c) => c.parte === 'cap33')!.num).toBe('33');
  expect(caps.indexOf('cap-new-maquinas')).toBe(caps.indexOf('cap33') + 1);
  expect(s.capitulos.find((c) => c.parte === 'cap-new-maquinas')).toMatchObject({ num: '34', ampliacion: 'P02' });
  // the book's netlist of the retired 32.13 keeps its id (its saved state, the live figure's layout) and is shown in
  // 34.3, where the DC motor went; «refs_libro» and «porRef_libro» keep the book's
  const motor = s.netlists['cap33/sec-33.13_motor_cc'] as (typeof s.netlists)[string] & { ref: string; refs_libro: unknown; ampliacion?: string };
  expect(motor).toMatchObject({ ref: 'sec-new-maquinas.3', refs: ['sec-new-maquinas.3'], refs_libro: { ref: 'sec-33.13', refs: ['sec-33.13'] } });
  expect(motor.ampliacion).toBeUndefined();
  expect(s.porRef['sec-new-maquinas.3']![0]).toBe('cap33/sec-33.13_motor_cc');
  expect(s.porRef['sec-33.13']).toBeUndefined();
  expect((s as unknown as { porRef_libro: Record<string, string[]> }).porRef_libro['sec-33.13']).toEqual(['cap33/sec-33.13_motor_cc']);
});

test('repaso, búsqueda, glosario y lecciones clásicas de las secciones nuevas', () => {
  const ind = leer<{ total: number; partes: { parte: string; preguntas: number; ampliacion?: number; num: string }[] }>(LIBRO, 'repaso/indice.json');
  const conAmp = ind.partes.filter((p) => p.ampliacion);
  expect(conAmp.map((p) => [p.parte, p.ampliacion])).toEqual([['cap00', 6], ['cap24', 6], ['cap31', 12], ['cap-new-automatas', 6], ['cap33', 6], ['cap-new-maquinas', 6], ['cap36', 6], ['cap44', 6], ['cap47', 6]]);
  expect(ind.partes.find((p) => p.parte === 'cap-new-maquinas')!.num).toBe('34');
  // the book's question about the retired 32.13 (V/f) keeps its id, so its review history goes on, and quotes 34.6
  const c33 = leer<{ preguntas: { id: string; ref: string; ref_num: string; ref_libro?: string }[] }>(LIBRO, 'repaso/cap33.json').preguntas;
  expect(c33.find((q) => q.id === 'cap33-18')).toMatchObject({ ref: 'sec-new-maquinas.6', ref_num: '34.6', ref_libro: 'sec-33.13' });
  // two of P08's questions are about what it adds to the book's 0.12
  const c00 = leer<{ preguntas: { id: string; ref: string; ampliacion?: string }[] }>(LIBRO, 'repaso/cap00.json').preguntas.filter((q) => q.ampliacion);
  expect(c00.map((q) => q.ref).filter((r) => r === 'sec-0.12')).toHaveLength(2);
  expect(ind.partes.find((p) => p.parte === 'cap-new-automatas')!.num).toBe('31');
  const refs = leer<Refs>(LIBRO, 'refs.json');
  for (const { parte: stem } of conAmp) {
    const q = leer<{ preguntas: { id: string; ampliacion?: string; ref: string; ref_num: string | null }[] }>(LIBRO, `repaso/${stem}.json`).preguntas;
    // (a question about what an expansion adds to a section of the book refers to that section: P08's two on 0.12)
    for (const p of q.filter((x) => x.ampliacion)) expect(refs[p.ref]!.ampliacion ?? (p.ref === 'sec-0.12' ? 'P08' : undefined), p.id).toBe(p.ampliacion);
    for (const p of q) if (p.ref_num) expect(p.ref_num, p.id).toBe(refs[p.ref]!.num);
  }
  // search: the new sections and the new chapter, marked, with their printed numbers
  const busq = leer<{ id: string; titulo: string; ampliacion?: string }[]>(LIBRO, 'busqueda.json');
  expect(busq.find((d) => d.id === 'sec-new-24-trifasica')).toMatchObject({ titulo: '23.10 Sistemas Trifásicos', ampliacion: 'P01' });
  expect(busq.find((d) => d.id === 'cap-new-automatas')).toMatchObject({ ampliacion: 'P03' });
  expect(busq.find((d) => d.id === 'sec-33.10')!.titulo.startsWith('33.12 ')).toBe(true);
  // glossary: the terms the expansions treat link to them (and the term is in the section)
  const glos = leer<{ id: string; ver: string[]; ver_ampliacion?: string[] }[]>(LIBRO, 'glosario.json');
  expect(glos.find((g) => g.id === 'glos-modbus')).toMatchObject({ ver: ['sec-44.7', 'sec-new-44-modbus'], ver_ampliacion: ['sec-new-44-modbus'] });
  expect(glos.filter((g) => g.ver_ampliacion).length).toBeGreaterThanOrEqual(15);
  // the classic «Estudiar por pasos» lesson of a new section is built from its blocks like any other
  for (const [stem, label] of [['cap24', 'sec-new-24-trifasica'], ['cap-new-automatas', 'sec-new-automatas.4'], ['cap33', 'sec-new-33-inversor']] as const) {
    const p = parte(LIBRO, stem);
    const k = p.bloques.findIndex((b) => b.t === 'h2' && b.label === label);
    const pasos = calcularPasos(p.bloques, k);
    expect(pasos.length, label).toBeGreaterThan(2);
  }
  // the index keeps its sections marked
  const indice = leer<Indice>(LIBRO, 'indice.json');
  expect(indice.partes.cap31!.secciones!.filter((s) => s.ampliacion).map((s) => s.num)).toEqual(['30.10', '30.11', '30.12', '30.15']);
  void execFileSync;
});

test('lecciones 1.1 de cap00: P08 inserta 41 bloques antes de la 0.13 y cada cita sigue encontrando su bloque, con la ampliación y sin ella', () => {
  const contexto = (dir: string): ContextoLibro => ({ bloques: (p) => (fs.existsSync(path.join(dir, 'partes', `${p}.json`)) ? (parte(dir, p).bloques as unknown[]) : null) });
  const fuentes = path.join(CONTENIDO, 'lecciones11', 'cap00');
  const normal = (s: string) => s.replace(/\s+/g, ' ').trim();
  let desplazadas = 0;
  for (const f of fs.readdirSync(fuentes).filter((x) => x.endsWith('.yaml'))) {
    const fuente = parseYaml(fs.readFileSync(path.join(fuentes, f), 'utf8')) as { libro: Record<string, string> };
    const con = generarLeccion(fuente, contexto(LIBRO), f);
    expect(con.errores, f).toEqual([]);
    // the index written in the source is the merged book's, and every quote is in the block it resolves to
    for (const [k, c] of Object.entries(con.leccion!.libro)) {
      expect(normal(textoDeBloque(parte(LIBRO, c.parte).bloques[c.bloque]))).toContain(normal(c.cita));
      expect(`${c.parte}#${c.bloque}`, `${f} ${k}`).toBe(k);
    }
    if (f === 'sec-new-0-numericos.yaml') {
      // the new section's lesson: only in the merged book
      expect(generarLeccion(fuente, contexto(LIMPIO), f).errores.join(' ')).toMatch(/no existe la sección «sec-new-0-numericos»/);
      continue;
    }
    // the book without the expansion: the same blocks, found by their quotes 41 places earlier (those after 0.12); the
    // cards of 0.12 about what P08 adds to it need P08 (the generator says which quotes it misses and writes nothing)
    const sin = generarLeccion(fuente, contexto(LIMPIO), f);
    if (f === 'sec-0.12.yaml') {
      expect(sin.errores.filter((x) => /libro: .*(bloque |cap00#)17[4-7]\b/.test(x)).length, sin.errores.join('\n')).toBe(sin.errores.filter((x) => /libro: /.test(x)).length);
      expect(sin.errores.some((x) => /libro: cap00#174/.test(x))).toBe(true);
      continue;
    }
    expect(sin.errores, f).toEqual([]);
    for (const [k, c] of Object.entries(sin.leccion!.libro)) {
      const antes = con.leccion!.libro[k]!;
      if (c.parte === 'cap00' && antes.bloque >= 211) {
        expect(c.bloque, `${f} ${k}`).toBe(antes.bloque - 41);
        desplazadas++;
      } else if (!(antes.parte === 'cap00' && antes.bloque >= 170)) expect(c.bloque, `${f} ${k}`).toBe(antes.bloque);
    }
  }
  expect(desplazadas).toBeGreaterThan(40);
  // a quote that two blocks of the section have is resolved by how far the lesson's other quotes moved
  const f013 = parseYaml(fs.readFileSync(path.join(fuentes, 'sec-0.13.yaml'), 'utf8')) as { libro: Record<string, string> };
  const r = generarLeccion(f013, contexto(LIMPIO), 'sec-0.13');
  expect(r.errores).toEqual([]);
  expect(r.leccion!.libro['cap00#216']!.bloque).toBe(175);
});
