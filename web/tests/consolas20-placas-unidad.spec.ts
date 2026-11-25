// 2.0 (cierre20) in Node: the published KiCad boards linked to their schematic name each part after the photo
// hotspot that lists it, as contenido/consolas_pcb.py writes them (`f` of a footprint = the `nombre` of the first
// hotspot of the console's main photo whose `esquema` holds its reference). The Nintendo 64 and PlayStation boards had
// been generated before their hotspots were finished: 26 + 31 parts of the board panel had no function or an older one
// («Diodo LED entre GND y Net-(D3-A).» for the N64's power LED); regenerating them gives the shipped files.
//   EPA_SIN_SERVIDOR=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pwb npx playwright test -c playwright.n64ps1.config.ts tests/consolas20-placas-unidad.spec.ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publico = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'consolas');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = (r: string): any => JSON.parse(fs.readFileSync(path.join(publico, r), 'utf8'));

interface Placa {
  id: string;
  maquina: string;
  tipo: string;
  enlazada: boolean;
}

const placas = (json('placas/indice.json').placas as Placa[]).filter((p) => p.tipo === 'kicad' && p.enlazada);

test('hay placas KiCad enlazadas, entre ellas las de la Nintendo 64, la PlayStation y la Saturn', () => {
  expect(placas.map((p) => p.id)).toEqual(expect.arrayContaining(['nes', 'megadrive', 'neogeo', 'n64', 'ps1', 'saturn']));
});

for (const p of placas)
  test(`placa ${p.id}: cada pieza de una zona de la foto lleva la función de esa zona`, () => {
    const d = json(`${p.maquina}.json`);
    const funcion = new Map<string, string>();
    for (const h of d.hotspots ?? []) for (const r of h.esquema ?? []) if (!funcion.has(r)) funcion.set(r, h.nombre ?? '');
    const b = json(`placas/${p.id}.json`);
    const mal = (b.huellas as { r: string; f: string }[]).filter((h) => funcion.has(h.r) && h.f !== funcion.get(h.r)).map((h) => `${h.r}: «${h.f}» ≠ «${funcion.get(h.r)}»`);
    expect(mal).toEqual([]);
  });
