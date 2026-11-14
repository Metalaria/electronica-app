// QA 1.0 (findings 2 and 3): what a challenge («reto») or a fault case («avería») shows of a book figure. The crop
// used to add a margin that took in pieces of the book's notes («ma», «de l», «I₁ =», «Co») and, at sec 0.2, the
// challenge's own answer; a fault case showed the healthy circuit's readings (1,52 V, 3,34 V…). Node only:
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.brilliant10.config.ts \
//     tests/brilliant10-encuadre.spec.ts --workers=1
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { coloresDeRotulo, objetosDeSvg, textosCortados, type Caja, type ObjetosFigura } from '../src/componentes/practica/encuadre.ts';
import type { ItemPractica } from '../src/componentes/practica/tipos.ts';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// EPA_LIBRO: a regenerated copy of the book folder (as the generators take it)
const libro = process.env.EPA_LIBRO ?? path.join(web, 'public', 'libro');
const J = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(libro, p), 'utf8')) as T;
const ind = J<{ partes: string[] }>('practica/indice.json');
type ConFigura = ItemPractica & { fuente: { k: 'figura'; datos: string; esquema: number; src: string; vista: Caja; recorte?: Caja | null; ocultar?: Caja[] } };
const items = ind.partes
  .flatMap((p) => J<{ items: ItemPractica[] }>(`practica/${p}.json`).items)
  .filter((x): x is ConFigura => (x.tipo === 'reto' || x.tipo === 'averia') && (x as ConFigura).fuente?.k === 'figura');
const objetos = new Map<string, ObjetosFigura>();
const objetosDe = (src: string) => {
  if (!objetos.has(src)) objetos.set(src, objetosDeSvg(fs.readFileSync(path.join(libro, src), 'utf8')));
  return objetos.get(src)!;
};
const dentro = (b: Caja, r: Caja) => b[0] >= r[0] && b[1] >= r[1] && b[0] + b[2] <= r[0] + r[2] && b[1] + b[3] <= r[1] + r[3];
const toca = (b: Caja, r: Caja) => !(b[0] >= r[0] + r[2] || b[0] + b[2] <= r[0] || b[1] >= r[1] + r[3] || b[1] + b[3] <= r[1]);
// (1.2: book 4.0/4.1 writes the schematic's labels in the ink #1b1f27)
const NEUTROS = new Set(['#1a3a5c', '#000000', '#000', '#1b1f27']);

test('hay retos y averías con figura', () => {
  expect(items.filter((x) => x.tipo === 'reto').length).toBeGreaterThan(30);
  expect(items.filter((x) => x.tipo === 'averia').length).toBeGreaterThan(30);
});

test('ningún recorte de reto o avería corta un texto del libro sin taparlo', () => {
  const malos: string[] = [];
  for (const it of items) {
    const r = it.fuente.recorte;
    if (!r) {
      malos.push(`${it.id}: sin recorte`);
      continue;
    }
    const cortados = textosCortados(objetosDe(it.fuente.src), { recorte: r, ocultar: it.fuente.ocultar ?? [] });
    if (cortados.length) malos.push(`${it.id}: ${cortados.length} textos cortados en ${cortados.slice(0, 3).map((t) => `${t.x.toFixed(0)},${t.y.toFixed(0)}`).join(' ')}`);
  }
  expect(malos).toEqual([]);
});

test('dentro del recorte no queda ninguna anotación de color del libro (lecturas, resultados) sin tapar', () => {
  const malos: string[] = [];
  for (const it of items) {
    const r = it.fuente.recorte!;
    const tapas = it.fuente.ocultar ?? [];
    const esq = J<{ esquemas: { elementos: { color?: string | null }[] }[] }>(it.fuente.datos).esquemas[it.fuente.esquema]!;
    // a part drawn in a colour of its own (a highlighted Rₓ, a meter) may have its label and symbol in that colour
    // (in a 4.x figure, in the text shade of its new hue: the data keep the 3.0.2 colour)
    const propios = new Set(esq.elementos.flatMap((e) => coloresDeRotulo(e.color)));
    for (const t of objetosDe(it.fuente.src).textos) {
      const b: Caja = [t.x, t.y, t.w, t.h];
      if (!toca(b, r) || NEUTROS.has(t.color) || propios.has(t.color)) continue;
      if (!tapas.some((o) => dentro(b, o))) malos.push(`${it.id}: ${t.color} en ${t.x.toFixed(0)},${t.y.toFixed(0)}`);
    }
  }
  expect(malos).toEqual([]);
});

// suite 1.2: with book 4.0/4.1 the labels are in the ink #1b1f27, which the crop took for an annotation colour: 212
// part names and values (R₁, 1 kΩ…) were painted over in the challenges and fault cases, so they could not be solved
test('los rótulos del esquema en la tinta del libro (nombres y valores de las piezas) no se tapan', () => {
  const tapados: string[] = [];
  for (const it of items) {
    for (const t of objetosDe(it.fuente.src).textos) {
      if (NEUTROS.has(t.color) && (it.fuente.ocultar ?? []).some((o) => dentro([t.x, t.y, t.w, t.h], o))) tapados.push(`${it.id}: ${t.x.toFixed(0)},${t.y.toFixed(0)}`);
    }
  }
  expect(tapados).toEqual([]);
  // fig. 1.10 (Wheatstone bridge): only the meter's two marks are hidden, as in 1.1
  const puente = items.find((x) => x.id === 'cap01-reto-fig-1.10-0-1')!;
  expect(puente.fuente.ocultar).toHaveLength(2);
});

test('casos del informe: sec 0.2 sin la respuesta «I₁ = 2 A» ni restos de notas; sec 1.3 sin las tensiones del circuito sano', () => {
  const porId = new Map(items.map((x) => [x.id, x]));
  const reto = porId.get('cap00-reto-fig-0.2-0-1')!;
  const ob = objetosDe(reto.fuente.src);
  // the explanation column on the right of fig. 0.2 (its green «I₁ = 2 A» and «Comprobación») is outside the crop
  const columna = ob.textos.filter((t) => t.x > 245);
  expect(columna.length).toBeGreaterThan(10);
  for (const t of columna) expect(toca([t.x, t.y, t.w, t.h], reto.fuente.recorte!), `${t.x},${t.y}`).toBe(false);
  for (const id of ['cap01-averia-fig-1.3-0-E3-abierta', 'cap01-reto-fig-1.3-0-1']) {
    const it = porId.get(id)!;
    // the four readings (1,52 V, 3,34 V, 7,14 V, I = 15,2 mA) and the current's «I»: hidden (blue and red; in book
    // 4.0/4.1, #2150c5 and #a5231c)
    const azulesRojos = objetosDe(it.fuente.src)
      .textos.filter((t) => ['#2e6ea6', '#a93226', '#2150c5', '#a5231c'].includes(t.color) && toca([t.x, t.y, t.w, t.h], it.fuente.recorte!));
    expect(azulesRojos.length, id).toBeGreaterThanOrEqual(5);
    for (const t of azulesRojos) expect(it.fuente.ocultar!.some((o) => dentro([t.x, t.y, t.w, t.h], o)), `${id} ${t.x},${t.y}`).toBe(true);
  }
});
