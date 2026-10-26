// Cross-check of the NES trace against an independent emulator (run by hand):
//   node contenido/fotograma/contrastar_nes.mjs <carpeta con node_modules/jsnes> [traza.bin] [rom.nes] [entradas JSON] [cuadros]
// (entradas: the same button script as juegos.json, applied at the same VBlank numbers)
// Runs the ROM in jsnes (Ben Firshman's JavaScript NES emulator, Apache-2.0) and looks, among its first 60 frames,
// for one equal pixel for pixel to the framebuffer stored in the trace (colours compared through a one-to-one map
// between the trace's palette indices and jsnes's RGB values). jsnes blanks an 8-pixel border (overscan), so the
// comparison covers x 8–247, y 8–231 (240 × 224 pixels).
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { leerTraza } from './traza.mjs';

const [dirJsnes, ruta = 'web/public/consolas/fotograma/nes/demo.bin', rutaRom = 'contenido/consolas_demos/nes/demo.nes', entradasJson = '[]', nCuadros = '60'] = process.argv.slice(2);
const entradas = JSON.parse(entradasJson);
const jsnes = await import(pathToFileURL(join(dirJsnes, 'node_modules/jsnes/src/index.js')).href);
const { arrays } = leerTraza(readFileSync(ruta));
const fb = arrays.fb;
const rom = readFileSync(rutaRom);
const cuadros = [];
const nes = new jsnes.NES({ onFrame: (b) => cuadros.push(Uint32Array.from(b)), emulateSound: false });
nes.loadROM(rom.toString('binary'));
const C = jsnes.Controller;
const BOTON = { a: C.BUTTON_A, b: C.BUTTON_B, select: C.BUTTON_SELECT, start: C.BUTTON_START, arriba: C.BUTTON_UP, abajo: C.BUTTON_DOWN, izquierda: C.BUTTON_LEFT, derecha: C.BUTTON_RIGHT };
let pulsados = [];
const total = Number(nCuadros);
const desde = Math.max(0, total - 60);
for (let i = 0; i < total; i++) {
  let b = [];
  // jsnes's frame i runs after its i-th VBlank: our VBlank n is its frame n + 1
  for (const [n, k] of entradas) if (i >= n + 1) b = String(k).split('+').filter(Boolean);
  for (const k of pulsados) if (!b.includes(k)) nes.buttonUp(1, BOTON[k]);
  for (const k of b) if (!pulsados.includes(k)) nes.buttonDown(1, BOTON[k]);
  pulsados = b;
  nes.frame();
  if (i < desde) cuadros.length = 0;
}
let mejor = { k: -1, dif: Infinity };
for (const [k, c] of cuadros.entries()) {
  const mapa = new Map();
  const inverso = new Map();
  let dif = 0;
  for (let i = 0; i < 256 * 240; i++) {
    const x = i & 255;
    const y = i >> 8;
    if (x < 8 || x > 247 || y < 8 || y > 231) continue;
    const a = fb[i];
    const b = c[i] & 0xffffff;
    if (!mapa.has(a) && !inverso.has(b)) {
      mapa.set(a, b);
      inverso.set(b, a);
    }
    if (mapa.get(a) !== b) dif++;
  }
  if (dif < mejor.dif) mejor = { k, dif };
}
console.log(`jsnes: el cuadro ${mejor.k + Math.max(0, Number(nCuadros) - 60)} difiere en ${mejor.dif} de ${240 * 224} píxeles del cuadro de la traza`);
process.exit(mejor.dif ? 1 : 0);
