// «Un fotograma» trace of the NES: builds the demo (ca65/ld65 if available), runs it (or a homebrew game of
// juegos.json) on nes.mjs and writes web/public/consolas/fotograma/nes/<programa>.bin.

import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ejecutar, explicacionesPorDireccion, herramienta, hex4, leerExplicaciones } from './comun.mjs';
import { OPCODES_6502 } from './cpu6502.mjs';
import { CHIPS_CPU, CHIPS_PPU, FASES, Nes, paletaNes, SENALES, TIPOS_PPU } from './nes.mjs';
import { Registro } from './registro.mjs';
import { escribirTraza } from './traza.mjs';

const LARGO = { imp: 1, acc: 1, imm: 2, zp: 2, zpx: 2, zpy: 2, izx: 2, izy: 2, rel: 2, abs: 3, abx: 3, aby: 3, ind: 3 };

/** Assembles contenido/consolas_demos/nes/demo.s when cc65 is installed (CC65_BIN = its bin folder); else the
 * versioned demo.nes, demo.lbl and demo.dbg are used as they are. */
export function construirDemoNes(raiz, tmp) {
  const dir = join(raiz, 'contenido/consolas_demos/nes');
  const ca65 = herramienta('ca65', 'CC65_BIN');
  const ld65 = herramienta('ld65', 'CC65_BIN');
  if (ca65 && ld65) {
    ejecutar(ca65, ['demo.s', '-g', '-o', join(tmp, 'demo.o')], dir);
    ejecutar(ld65, ['-C', 'nes.cfg', join(tmp, 'demo.o'), '-o', join(tmp, 'demo.nes'), '-Ln', join(tmp, 'demo.lbl'), '--dbgfile', join(tmp, 'demo.dbg')], dir);
    for (const f of ['demo.nes', 'demo.lbl', 'demo.dbg']) copyFileSync(join(tmp, f), join(dir, f));
    console.log('nes: demo.s ensamblado con ca65/ld65');
  } else console.log('nes: sin ca65/ld65 (CC65_BIN): se usa el demo.nes guardado');
  return { rom: readFileSync(join(dir, 'demo.nes')), lbl: readFileSync(join(dir, 'demo.lbl'), 'utf8'), dbg: readFileSync(join(dir, 'demo.dbg'), 'utf8'), dir };
}

/** Labels of the VICE label file (code, data and RAM variables). */
function etiquetasLbl(lbl) {
  const out = {};
  for (const l of lbl.split('\n')) {
    const m = /^al ([0-9A-F]{6}) \.(\w+)/.exec(l);
    // code and data labels, and the zero-page and RAM variables (for the operands of the disassembly)
    if (m) out[hex4(parseInt(m[1], 16))] = m[2];
  }
  return out;
}

/** Address -> source line (text) of the main source file, from ld65's debug file. */
function lineasDbg(dbg, dir, fuente) {
  const segs = {};
  const spans = {};
  const files = {};
  const lines = [];
  for (const l of dbg.split('\n')) {
    const [tipo, resto] = l.split('\t');
    if (!resto) continue;
    const o = Object.fromEntries(resto.split(',').map((kv) => kv.split('=')));
    if (tipo === 'seg') segs[o.id] = parseInt(o.start, 16);
    else if (tipo === 'span') spans[o.id] = { seg: o.seg, start: Number(o.start), size: Number(o.size) };
    else if (tipo === 'file') files[o.id] = o.name.replace(/"/g, '');
    else if (tipo === 'line' && o.span) lines.push({ file: o.file, line: Number(o.line), spans: o.span.split('+') });
  }
  const texto = readFileSync(join(dir, fuente), 'utf8').split('\n');
  const out = {};
  for (const ln of lines) {
    if (files[ln.file] !== fuente) continue;
    for (const s of ln.spans) {
      const sp = spans[s];
      if (!sp) continue;
      const a = segs[sp.seg] + sp.start;
      if (a >= 0x8000 && !(hex4(a) in out)) out[hex4(a)] = [ln.line, texto[ln.line - 1].trim()];
    }
  }
  return out;
}

const BOTONES_NES = { a: 1, b: 2, select: 4, start: 8, arriba: 16, abajo: 32, izquierda: 64, derecha: 128 };

/** Input script of a game (juegos.json): [[VBlank number since reset, 'start+a'], …]; each entry holds until the next. */
function pulsar(nes, entradas) {
  if (!entradas.length) return;
  const n = nes.vblanks ?? 0;
  let b = 0;
  for (const [desde, botones] of entradas) if (n >= desde) b = String(botones).split('+').filter(Boolean).reduce((x, k) => x | (BOTONES_NES[k] ?? 0), 0);
  nes.mandos[0] = b;
}

/** Runs the machine and returns the instruction-start times of the window: the instruction in progress when the
 * VBlank number `k0` starts, and the one when VBlank k0 + 1 starts. */
function ventana(rom, cuadroTras, entradas, desdeReset = false) {
  const nes = new Nes(rom, new Registro());
  nes.reset();
  let encendido = -1;
  let t0 = -1;
  for (let i = 0; i < 4e7; i++) {
    const t = nes.t;
    const vb = nes.vblanks ?? 0;
    nes.paso();
    pulsar(nes, entradas);
    if (encendido < 0 && (desdeReset || nes.renderOn())) encendido = desdeReset ? 0 : (nes.vblanks ?? 0);
    if (encendido >= 0 && (nes.vblanks ?? 0) !== vb) {
      const n = (nes.vblanks ?? 0) - encendido;
      if (n === cuadroTras) t0 = t;
      if (n === cuadroTras + 1) return { t0, t1: t, encendido };
    }
  }
  throw new Error('nes: el programa no llegó a dibujar');
}

export function generarNes({ raiz, tmp, salida, programa, rom, lbl, dbg, dir, fuente, meta, cuadroTras = 8, cicloArranque = 2400, entradas = [], desdeReset = false }) {
  const etiquetas = lbl ? etiquetasLbl(lbl) : {};
  const lineas = dbg ? lineasDbg(dbg, dir, fuente) : {};
  const prg = rom.subarray(16, 16 + rom[4] * 16384);
  const base = 0x10000 - prg.length;
  const leer = (a) => (a >= 0x8000 ? prg[(a - 0x8000) % prg.length] : 0);
  const largo = (a) => LARGO[OPCODES_6502[leer(a)]?.[1]] ?? 1;
  const explicaciones = dir && existsSync(join(dir, 'explicaciones.es.txt')) ? explicacionesPorDireccion(leerExplicaciones(join(dir, 'explicaciones.es.txt')), etiquetas, largo) : {};

  const { t0, t1 } = ventana(rom, cuadroTras, entradas, desdeReset);
  const reg = new Registro();
  const nes = new Nes(rom, reg);
  reg.empezar('arranque', 'Tras el reset', 'Las primeras instrucciones desde que se suelta /RST: el vector de $FFFC, la preparación de la pila y de la PPU y la espera del primer VBlank.', 0, { pixeles: false });
  nes.reset();
  for (;;) {
    if (reg.activo && reg.segmentos.length === 1 && nes.ciclo >= cicloArranque) reg.terminar(nes.t);
    if (nes.t === t0) {
      reg.empezar('fotograma', 'Un cuadro completo', `Del VBlank del cuadro ${cuadroTras - 1} al del cuadro ${cuadroTras} ${desdeReset ? 'desde el reset' : 'tras encender el dibujo'}: la NMI y el DMA de OAM, la línea de preparación y las 240 líneas visibles, punto a punto.`, t0);
    }
    if (nes.t >= t1) break;
    nes.paso();
    pulsar(nes, entradas);
  }
  if (reg.segmentos.length !== 2 || nes.t !== t1) throw new Error('nes: la ventana del cuadro no cae en límites de instrucción');
  reg.terminar(t1);
  const fbCuadro = nes.fb.slice();

  const d = reg.arrays(
    [
      { id: 'cpu', titulo: 'Bus de la CPU (2A03)', anchoDir: 16, anchoDato: 8, chips: CHIPS_CPU },
      { id: 'ppu', titulo: 'Bus de la PPU (2C02)', anchoDir: 14, anchoDato: 8, chips: CHIPS_PPU, tipos: TIPOS_PPU },
    ],
    ['A', 'X', 'Y', 'P', 'S'],
  );
  // the framebuffer of the emulator for the recorded frame: lines 0–239 drawn inside the window
  const fb = Array.from(fbCuadro);
  const manifiesto = {
    maquina: 'nes',
    idPrograma: programa,
    titulo: meta.titulo,
    tipo: meta.tipo,
    generador: {
      emulador: 'contenido/fotograma/nes.mjs + cpu6502.mjs',
      detalle: '6502 exacto ciclo a ciclo (SingleStepTests nes6502 y nestest sin diferencias) y PPU 2C02 punto a punto según la wiki de NESdev.',
    },
    reloj: { hz: 21477272 / 4, nombre: 'punto de la PPU' },
    cpus: [{ id: 'cpu', tipo: '6502', titulo: 'CPU 6502 del 2A03', hz: 21477272 / 12, unidadesPorCiclo: 3, registros: ['A', 'X', 'Y', 'P', 'S'] }],
    buses: d.buses,
    instrucciones: d.instrucciones,
    video: { ancho: 256, alto: 240, puntosPorLinea: 341, lineas: 262, primeraVisible: 0, formato: 'indice', paleta: paletaNes(), ...d.lineas },
    fases: { tipos: FASES, ...d.fases },
    senales: { tipos: SENALES, ...d.senales },
    pixeles: d.pixeles,
    fb: 'fb',
    segmentos: reg.segmentos,
    memoria: [{ nombre: 'PRG-ROM', array: 'mem_prg', base }],
    programa: { ...meta.programa, etiquetas, explicaciones, lineas },
  };
  const bytes = escribirTraza(salida, manifiesto, {
    ...d.arrays,
    fb: { tipo: 'u8', cod: 'crudo', datos: fb },
    mem_prg: { tipo: 'u8', cod: 'crudo', datos: prg },
  });
  const nIns = reg.ins.t.length;
  console.log(`nes/${programa}: ${reg.buses.cpu.t.length} ciclos de CPU, ${reg.buses.ppu.t.length} accesos de la PPU, ${nIns} instrucciones, ${reg.px.t.length} píxeles, ${(bytes / 1024).toFixed(0)} kB`);
  return { bytes, fb: fbCuadro, nes };
}
