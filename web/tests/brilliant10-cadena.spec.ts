// QA 1.0 (finding 1): the content chain practica10 → retos10 → averias10 → porque10 → teoria10 → conceptos11 is
// idempotent and keeps one order whichever steps are rerun. retos10 used to remove its items and append them at the
// end, so running it alone after averias10 put the faults before the challenges in eight part files.
// Node only, on a copy of web/public/libro (EPA_LIBRO), never on the tree's own files:
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.brilliant10.config.ts \
//     tests/brilliant10-cadena.spec.ts --workers=1
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libro = path.join(web, 'public', 'libro');
const ejecutar = promisify(execFile);
// what the chain writes (copied); everything else of the book folder is linked
const SALIDAS = ['practica', 'porque', 'conceptos.json', 'explorables.json', 'teoria-viva.json'];
const CADENA = ['practica10', 'retos10', 'averias10', 'porque10', 'teoria10', 'conceptos11'];
const GRUPO: Record<string, number> = { reto: 1, construye: 1, averia: 2 };

type Parte = { items: { id: string; tipo: string }[]; secciones: Record<string, { items: string[] }> };

function foto(dir: string): Map<string, string> {
  const r = new Map<string, string>();
  for (const s of SALIDAS) {
    const p = path.join(dir, s);
    if (!fs.existsSync(p)) continue;
    const ficheros = fs.statSync(p).isDirectory() ? fs.readdirSync(p).map((f) => path.join(s, f)) : [s];
    for (const f of ficheros.sort()) r.set(f, fs.readFileSync(path.join(dir, f), 'utf8'));
  }
  return r;
}

function diferencias(a: Map<string, string>, b: Map<string, string>): string[] {
  return [...new Set([...a.keys(), ...b.keys()])].filter((f) => a.get(f) !== b.get(f)).sort();
}

/** Parts whose items or lesson lists are not in the chain's order (practica10's, then retos10's, then averias10's). */
function fueraDeOrden(dir: string): string[] {
  const malos: string[] = [];
  const ind = JSON.parse(fs.readFileSync(path.join(dir, 'practica', 'indice.json'), 'utf8')) as { partes: string[] };
  for (const p of ind.partes) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, 'practica', `${p}.json`), 'utf8')) as Parte;
    const g = new Map(d.items.map((x) => [x.id, GRUPO[x.tipo] ?? 0]));
    const ordenado = (xs: number[]) => xs.every((v, i) => i === 0 || xs[i - 1] <= v);
    if (!ordenado(d.items.map((x) => g.get(x.id)!))) malos.push(`${p}: ítems`);
    for (const [k, s] of Object.entries(d.secciones)) if (!ordenado(s.items.map((id) => g.get(id) ?? 0))) malos.push(`${p}/${k}`);
  }
  return malos;
}

test('el contenido de práctica del árbol está en el orden de la cadena (retos antes que averías)', () => {
  expect(fueraDeOrden(libro)).toEqual([]);
});

test('la cadena de generadores es idempotente y estable al repetir cualquier paso suelto', async () => {
  test.setTimeout(900_000);
  const copia = fs.mkdtempSync(path.join(os.tmpdir(), 'epa-cadena-'));
  try {
    for (const e of fs.readdirSync(libro)) {
      if (SALIDAS.includes(e)) fs.cpSync(path.join(libro, e), path.join(copia, e), { recursive: true });
      else fs.symlinkSync(path.join(libro, e), path.join(copia, e));
    }
    const paso = async (s: string) => {
      await ejecutar('nice', ['node', path.join('scripts', `${s}.mjs`)], { cwd: web, env: { ...process.env, EPA_LIBRO: copia }, maxBuffer: 64 << 20 });
    };
    for (const s of CADENA) await paso(s);
    const base = foto(copia);
    expect(fueraDeOrden(copia)).toEqual([]);
    // the reported case first (retos10 alone after averias10), then every other step alone, then the chain again
    for (const s of ['retos10', 'averias10', 'practica10', 'porque10', 'teoria10', 'conceptos11', 'retos10']) {
      await paso(s);
      expect(diferencias(base, foto(copia)), `tras ${s} solo`).toEqual([]);
    }
    for (const s of CADENA) await paso(s);
    expect(diferencias(base, foto(copia)), 'tras la cadena otra vez').toEqual([]);
  } finally {
    fs.rmSync(copia, { recursive: true, force: true });
  }
});
