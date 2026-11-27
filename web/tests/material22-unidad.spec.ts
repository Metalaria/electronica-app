// 2.2 in Node (no browser, no server): the simulator's start jump (since 2.0; the QA's CLS 0.11 on
// #/simulador/cap00/a3_negativa on the tablet). The automatic schematic of a netlist was laid out from the circuits
// drawn before it in the same session (esquema-auto/generar.ts: `recientes` and the per-structure cache), so the size
// scripts/circuitos-proporciones.mjs reserved for it — computed right after the previous netlist of the book — was not
// the drawing the page got when it opened that netlist first: a3_negativa after a2_rlc is 314 × 140, on its own
// 173 × 212, and the circuit's place grew 349 px on the tablet when the drawing came. Now a page's first drawing is laid
// out «deNuevo» (as on a fresh start: only the precomputed layouts or from scratch), the table is computed the same way,
// and the two agree whatever was opened before.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.material22.config.ts tests/material22-unidad.spec.ts --project=escritorio
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarEsquema, olvidarDibujos, sembrarDibujos } from '../src/componentes/esquema-auto/generar.ts';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spice = path.join(web, 'public/libro/spice');
const tabla = JSON.parse(fs.readFileSync(path.join(web, 'src/componentes/figuras-vivas/circuito/proporciones.json'), 'utf8')) as Record<string, { l?: number[]; a: number[] | null | Record<string, number[] | null> }>;
sembrarDibujos(JSON.parse(fs.readFileSync(path.join(web, 'src/componentes/esquema-auto/precalculado.json'), 'utf8')));
const leer = (id: string) => fs.readFileSync(path.join(spice, `${id}.cir`), 'utf8');
const tam = (id: string, aspecto: number, deNuevo: boolean) => {
  const e = generarEsquema(leer(id), { subckt: null, aspecto, deNuevo });
  return e ? [e.vista[2], e.vista[3]] : null;
};
const reservado = (id: string, aspecto: number) => {
  const a = tabla[id]!.a;
  return a === null || Array.isArray(a) ? a : a[String(aspecto)];
};

test.beforeEach(({}, info) => test.skip(info.project.name !== 'escritorio', 'Node only, once'));

test('cap00/a3_negativa: el sitio reservado es el del dibujo que la página hace, se abra lo que se abra antes', () => {
  olvidarDibujos();
  for (const aspecto of [1.1, 1.5, 2]) {
    // on its own
    olvidarDibujos();
    expect(tam('cap00/a3_negativa', aspecto, true), `solo, aspecto ${aspecto}`).toEqual(reservado('cap00/a3_negativa', aspecto));
    // after a2_rlc (the netlist before it in the book): laid out «deNuevo», the same
    olvidarDibujos();
    tam('cap00/a2_rlc', aspecto, true);
    expect(tam('cap00/a3_negativa', aspecto, true), `después de a2_rlc, aspecto ${aspecto}`).toEqual(reservado('cap00/a3_negativa', aspecto));
  }
  // (an edit of the circuit on screen still starts from the drawing before: without «deNuevo» the history counts)
  olvidarDibujos();
  tam('cap00/a2_rlc', 2, false);
  expect(tam('cap00/a3_negativa', 2, false)).not.toEqual(reservado('cap00/a3_negativa', 2));
});

test('cada netlist del capítulo 0: la tabla de tamaños es la del dibujo «deNuevo», en las tres formas de hoja', () => {
  const ids = fs.readdirSync(path.join(spice, 'cap00')).filter((f) => f.endsWith('.cir')).map((f) => `cap00/${f.slice(0, -4)}`);
  expect(ids.length).toBeGreaterThan(20);
  const mal: string[] = [];
  olvidarDibujos();
  // (in the book's order, one after another: the history must not matter)
  for (const id of ids) {
    if (!tabla[id] || tabla[id]!.l) continue;
    for (const aspecto of [1.1, 1.5, 2]) {
      const t = tam(id, aspecto, true);
      if (JSON.stringify(t) !== JSON.stringify(reservado(id, aspecto))) mal.push(`${id} ${aspecto}: ${JSON.stringify(t)} ≠ ${JSON.stringify(reservado(id, aspecto))}`);
    }
  }
  expect(mal).toEqual([]);
});
