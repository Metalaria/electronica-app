// 1.3 (motor13b) in Node (no browser, no server). The «figura» widget's crop and starting zoom (`recorte`, `ampliar`,
// GUIA §11.1, asked for by contenido13 so that a table's rows and a board's chips reach 44 px on a phone): on the
// catalogue lesson tests/lecciones12-catalogo/cap16/sec-16.16.yaml (a book SVG figure) and on the SNES NTSC photo of
// the «Consolas» explorer, the generator keeps the zones in the picture's own coordinates, clips a rectangle to the
// crop, sizes its phone warnings with the crop and the zoom, and refuses what makes no sense (each rule broken on
// purpose). Deterministic.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.lecciones12.config.ts tests/lecciones13b-motor-unidad.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { generarLeccion, type ContextoLibro } from '../src/lib/leccion11/generar.ts';
import type { Leccion11 } from '../src/lib/leccion11/tipos.ts';
import type { WidgetFigura } from '../src/lib/leccion12/digital/tipos.ts';
import { ANCHO_TELEFONO } from '../src/lib/leccion12/digital/generar-digital.ts';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { cargarEsquemas11 } from '../scripts/esquemas11.mjs';
// @ts-expect-error (a plain .mjs module of the scripts: no types)
import { recursosLibro } from '../scripts/recursos11.mjs';

await cargarEsquemas11();
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contexto: ContextoLibro = {
  bloques: (p) => {
    const f = path.join(web, 'public', 'libro', 'partes', `${p}.json`);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as { bloques: unknown[] }).bloques : null;
  },
  recursos: recursosLibro(path.join(web, 'public', 'libro'), path.join(web, 'public')),
};
const FUENTE = parse(fs.readFileSync(path.join(web, 'tests', 'lecciones12-catalogo', 'cap16', 'sec-16.16.yaml'), 'utf8'));
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type F = { modelo: any; tarjetas: Record<string, any>[] };
const tarjetaDe = (f: F, id: string) => f.tarjetas.find((t) => t.id === id)!;
function generar(cambio: (f: F) => void) {
  const f = copia(FUENTE) as F;
  cambio(f);
  return generarLeccion(f, contexto, 'catalogo-motor13b');
}
const widget = (r: ReturnType<typeof generar>, id: string) => (r.leccion as Leccion11).tarjetas.find((t) => t.id === id)!.widget as unknown as WidgetFigura;

/** The SNES NTSC board photo (1206 × 1046) with three small chips as the explore card's zones (the CIC, the crystal, reset). */
const SNES = {
  tipo: 'figura',
  consola: { maquina: 'snes' },
  zonas: [
    { id: 'coincidir', hotspot: 'n-cic' },
    { id: 'diferir', hotspot: 'n-x1' },
    { id: 'trampas', hotspot: 'n-reset' },
  ],
};

test.describe('figura con recorte y ampliar', () => {
  test('el recorte se guarda; las zonas siguen en las coordenadas de la figura, recortadas al borde', () => {
    const r = generar((f) => Object.assign(tarjetaDe(f, 'explore-equivalente').widget, { recorte: [100, 0, 250, 201.6], ampliar: 1.5 }));
    expect(r.errores).toEqual([]);
    const w = widget(r, 'explore-equivalente');
    expect(w.recorte).toEqual([100, 0, 250, 201.6]);
    expect(w.ampliar).toBe(1.5);
    expect(w.fuente.vista).toEqual([0, 0, 453.6, 201.6]);
    expect(w.zonas.map((z) => [z.id, z.rects])).toEqual([
      ['coincidir', [[100, 2, 122, 92]]],
      ['diferir', [[230, 2, 120, 92]]],
      ['trampas', [[100, 102, 250, 98]]],
    ]);
    // (the goal of zones still generates on it, and a widget without the keys has neither)
    expect((r.leccion as Leccion11).tarjetas.find((t) => t.id === 'explore-equivalente')!.objetivo).toBeTruthy();
    expect(widget(r, 'explore-orden').recorte).toBeUndefined();
    expect(widget(r, 'explore-orden').ampliar).toBeUndefined();
    expect(r.avisos.filter((a) => /px/.test(a))).toEqual([]);
  });

  test('los avisos de tamaño cuentan el recorte y el zoom: la foto de la SNES entera, recortada y ampliada', () => {
    const avisos = (extra: Record<string, unknown>) =>
      generar((f) => (tarjetaDe(f, 'explore-equivalente').widget = { ...SNES, ...extra })).avisos.filter((a) => /widget.zonas \d.*px/.test(a));
    // whole photo: the 40-pixel crystal is 10 px wide on a 360 px phone
    expect(avisos({}).join('\n')).toMatch(/zonas 2»: en un teléfono mide menos de 24 px .*pruebe «recorte» o «ampliar»/);
    // cropped to the right of the cartridge slot: 41 px, under a finger's 44
    const recorte = [900, 100, 306, 830];
    expect(Math.round((40 * ANCHO_TELEFONO) / 306)).toBe(41);
    expect(avisos({ recorte })).toEqual([expect.stringMatching(/«widget.zonas 2»: en un teléfono de 360 px mide 41 px \(con «recorte» y «ampliar», al menos 44/)]);
    // and zoomed in 1.5 times: every chip over 44 px, no warning
    expect(avisos({ recorte, ampliar: 1.5 })).toEqual([]);
    const r = generar((f) => (tarjetaDe(f, 'explore-equivalente').widget = { ...SNES, recorte, ampliar: 1.5 }));
    expect(r.errores).toEqual([]);
    // (a hotspot's boxes are the explorer's, in the photo's pixels)
    expect(widget(r, 'explore-equivalente').zonas.find((z) => z.id === 'diferir')!.rects).toEqual([[1116, 835, 40, 73]]);
  });

  const reglas: [string, (f: F) => void, RegExp][] = [
    ['un recorte que no es un rectángulo', (f) => (tarjetaDe(f, 'explore-equivalente').widget.recorte = [0, 0, 100]), /«widget.recorte»: \[x, y, ancho, alto\] en las coordenadas de la figura/],
    ['un recorte de ancho cero', (f) => (tarjetaDe(f, 'explore-equivalente').widget.recorte = [0, 0, 0, 100]), /«widget.recorte»: \[x, y, ancho, alto\]/],
    ['un recorte fuera de la figura', (f) => (tarjetaDe(f, 'explore-equivalente').widget.recorte = [300, 0, 300, 100]), /«widget.recorte»: se sale de la figura \(0…453.6 × 0…201.6\)/],
    ['un recorte que es la figura entera', (f) => (tarjetaDe(f, 'explore-equivalente').widget.recorte = [0, 0, 453.6, 201.6]), /«widget.recorte»: es la figura entera/],
    ['una zona que queda fuera del recorte', (f) => (tarjetaDe(f, 'explore-equivalente').widget.recorte = [0, 0, 453.6, 100]), /«widget.zonas 3»: queda fuera del recorte \(0…453.6 × 0…100\)/],
    [
      'un polígono que cruza el borde del recorte',
      (f) => {
        const w = tarjetaDe(f, 'explore-equivalente').widget;
        w.recorte = [0, 0, 300, 201.6];
        w.zonas[1] = { id: 'diferir', rotulo: 'Arriba a la derecha', poligono: [[230, 2], [452, 2], [452, 94]] };
      },
      /«widget.zonas 2.poligono»: se sale del recorte \(0…300 × 0…201.6\)/,
    ],
    ['ampliar 1 (no amplía)', (f) => (tarjetaDe(f, 'explore-equivalente').widget.ampliar = 1), /«widget.ampliar»: un número mayor que 1 y como mucho 4/],
    ['ampliar más que el «+»', (f) => (tarjetaDe(f, 'explore-equivalente').widget.ampliar = 5), /«widget.ampliar»: un número mayor que 1 y como mucho 4/],
    ['ampliar en letra', (f) => (tarjetaDe(f, 'explore-equivalente').widget.ampliar = 'dos'), /«widget.ampliar»: un número/],
    [
      'un recorte en un listado',
      (f) =>
        (tarjetaDe(f, 'explore-equivalente').widget = {
          tipo: 'figura',
          codigo: { lenguaje: 'c', texto: 'int a;\nint b;\nint c;' },
          recorte: [0, 0, 10, 10],
          zonas: [
            { id: 'coincidir', rotulo: 'Uno', lineas: [1] },
            { id: 'diferir', rotulo: 'Dos', lineas: [2] },
            { id: 'trampas', rotulo: 'Tres', lineas: [3] },
          ],
        }),
      /«widget.recorte»: no en un listado/,
    ],
  ];
  for (const [nombre, cambio, error] of reglas)
    test(`error: ${nombre}`, () => {
      expect(generar(cambio).errores.join('\n')).toMatch(error);
    });
});
