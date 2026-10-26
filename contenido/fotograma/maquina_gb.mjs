// «Un fotograma» traces of the Game Boy and the Game Boy Color: builds the demos (rgbds if available), runs them on
// gb.mjs and writes web/public/consolas/fotograma/<gb|gbc>/<programa>.bin.

import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ejecutar, explicacionesPorDireccion, herramienta, hex4, leerExplicaciones } from './comun.mjs';
import { CHIPS_CPU, CHIPS_VRAM, FASES, GameBoy, SENALES, TIPOS_VRAM } from './gb.mjs';
import { largoSm83 } from './sm83.mjs';
import { Registro } from './registro.mjs';
import { escribirTraza } from './traza.mjs';

export const PALETA_DMG = [0xe0f0c8, 0x98b878, 0x4c7050, 0x1c2c24]; // the DMG's greenish LCD, light to dark

/** Assembles contenido/consolas_demos/<gb|gbc>/demo.asm when rgbds is installed (RGBDS_BIN = its folder); else the
 * versioned ROM and symbol file are used. */
export function construirDemoGb(raiz, tmp, maquina) {
  const dir = join(raiz, 'contenido/consolas_demos', maquina);
  const ext = maquina === 'gbc' ? 'gbc' : 'gb';
  const asm = herramienta('rgbasm', 'RGBDS_BIN');
  const link = herramienta('rgblink', 'RGBDS_BIN');
  const fix = herramienta('rgbfix', 'RGBDS_BIN');
  if (asm && link && fix) {
    ejecutar(asm, ['-I', '../gb', '-o', join(tmp, `${maquina}.o`), 'demo.asm'], dir);
    ejecutar(link, ['-n', join(tmp, `${maquina}.sym`), '-o', join(tmp, `demo.${ext}`), join(tmp, `${maquina}.o`)], dir);
    ejecutar(fix, [...(maquina === 'gbc' ? ['-C'] : []), '-v', '-p', '0xFF', join(tmp, `demo.${ext}`)], dir);
    copyFileSync(join(tmp, `demo.${ext}`), join(dir, `demo.${ext}`));
    copyFileSync(join(tmp, `${maquina}.sym`), join(dir, 'demo.sym'));
    console.log(`${maquina}: demo.asm ensamblado con rgbds`);
  } else console.log(`${maquina}: sin rgbds (RGBDS_BIN): se usa la ROM guardada`);
  return { rom: readFileSync(join(dir, `demo.${ext}`)), sym: readFileSync(join(dir, 'demo.sym'), 'utf8'), dir };
}

function etiquetasSym(sym) {
  const out = {};
  for (const l of sym.split('\n')) {
    const m = /^([0-9a-f]{2}):([0-9a-f]{4}) (\S+)/i.exec(l);
    if (m) {
      const a = hex4(parseInt(m[2], 16));
      if (!(a in out)) out[a] = m[3];
    }
  }
  return out;
}

const BOTONES_GB = { derecha: 1, izquierda: 2, arriba: 4, abajo: 8, a: 16, b: 32, select: 64, start: 128 };

/** Input script of a game (juegos.json): [[VBlank number since reset, 'start+a'], …]; each entry holds until the next. */
function pulsar(gb, entradas) {
  if (!entradas.length) return;
  let b = 0;
  for (const [desde, botones] of entradas) if (gb.vblanks >= desde) b = String(botones).split('+').filter(Boolean).reduce((x, k) => x | (BOTONES_GB[k] ?? 0), 0);
  gb.botones = b;
}

function ventana(rom, cgb, cuadroTras, entradas, desdeReset = false) {
  const gb = new GameBoy(rom, new Registro(), { cgb });
  let encendido = -1;
  let t0 = -1;
  for (let i = 0; i < 4e7; i++) {
    const t = gb.t;
    const vb = gb.vblanks;
    gb.paso();
    pulsar(gb, entradas);
    if (encendido < 0 && (desdeReset || (gb.lcdOn() && gb.io[0x40] & 0x02))) encendido = desdeReset ? 0 : gb.vblanks;
    if (encendido >= 0 && gb.vblanks !== vb) {
      const n = gb.vblanks - encendido;
      if (n === cuadroTras) t0 = t;
      if (n === cuadroTras + 1) return { t0, t1: t };
    }
  }
  throw new Error('gb: el programa no llegó a dibujar');
}

export function generarGb({ salida, programa, maquina, rom, sym, dir, meta, cuadroTras = 8, cicloArranque = 1500, entradas = [], desdeReset = false }) {
  const cgb = maquina === 'gbc';
  const etiquetas = sym ? etiquetasSym(sym) : {};
  const leer = (a) => rom[a] ?? 0;
  const largo = (a) => (leer(a) === 0xcb ? 2 : largoSm83(leer(a)));
  let explicaciones = {};
  if (dir && existsSync(join(dir, 'explicaciones.es.txt'))) {
    explicaciones = explicacionesPorDireccion(leerExplicaciones(join(dir, 'explicaciones.es.txt')), etiquetas, largo);
    // the OAM DMA routine runs from its copy in HRAM: same explanations at hOamDma + offset
    const porNombre = Object.fromEntries(Object.entries(etiquetas).map(([a, n]) => [n, parseInt(a, 16)]));
    if (porNombre.OamDmaRoutine !== undefined && porNombre.hOamDma !== undefined) {
      for (let a = porNombre.OamDmaRoutine; a < porNombre.OamDmaRoutineEnd; a++) {
        const e = explicaciones[hex4(a)];
        if (e) explicaciones[hex4(porNombre.hOamDma + a - porNombre.OamDmaRoutine)] = e;
      }
    }
  }

  const { t0, t1 } = ventana(rom, cgb, cuadroTras, entradas, desdeReset);
  const reg = new Registro();
  const gb = new GameBoy(rom, reg, { cgb });
  reg.empezar(
    'arranque',
    'Tras la ROM de arranque',
    `Desde $0100, donde la ROM de arranque de Nintendo (no incluida) entrega el control: el salto al programa, la espera del VBlank para apagar la pantalla y, en la demostración, la copia de las teselas${cgb && meta.tipo === 'demo' ? ' con el HDMA' : ''}.`,
    0,
    { pixeles: false },
  );
  let hram0 = null;
  let mciclos = 0;
  for (;;) {
    if (reg.activo && reg.segmentos.length === 1 && mciclos >= cicloArranque) reg.terminar(gb.t);
    if (gb.t === t0) {
      hram0 = gb.hram.slice();
      reg.empezar(
        'fotograma',
        'Un cuadro completo',
        `Del VBlank del cuadro ${cuadroTras - 1} al del cuadro ${cuadroTras} ${desdeReset ? 'desde el reset' : 'tras encender la pantalla'}: la interrupción, el DMA de OAM${cgb && meta.tipo === 'demo' ? ', el HDMA del agua' : ''} y las 144 líneas visibles con sus modos 2, 3 y 0, punto a punto.`,
        t0,
      );
    }
    if (gb.t >= t1) break;
    const c0 = gb.cpu.mciclos;
    gb.paso();
    pulsar(gb, entradas);
    mciclos += gb.cpu.mciclos - c0;
  }
  if (reg.segmentos.length !== 2 || gb.t !== t1) throw new Error(`${maquina}: la ventana del cuadro no cae en límites de instrucción (${gb.t} ≠ ${t1})`);
  reg.terminar(t1);
  const fb = Array.from(gb.fb);
  if (cgb) reg.px16 = true;

  const d = reg.arrays(
    [
      { id: 'cpu', titulo: cgb ? 'Bus de la CPU (SM83 de la CGB)' : 'Bus de la CPU (SM83 del DMG-CPU)', anchoDir: 16, anchoDato: 8, chips: CHIPS_CPU },
      { id: 'dma', titulo: cgb ? 'Lecturas del DMA de OAM y del HDMA' : 'Lecturas del DMA de OAM', anchoDir: 16, anchoDato: 8, chips: CHIPS_CPU },
      { id: 'vram', titulo: cgb ? 'VRAM y OAM (dentro de la CPU CGB)' : 'Bus de la VRAM (MA0–MA12, MD0–MD7) y OAM', anchoDir: 16, anchoDato: 8, chips: CHIPS_VRAM, tipos: TIPOS_VRAM },
    ],
    ['A', 'F', 'B', 'C', 'D', 'E', 'H', 'L', 'SP'],
  );
  const manifiesto = {
    maquina,
    idPrograma: programa,
    titulo: meta.titulo,
    tipo: meta.tipo,
    generador: {
      emulador: 'contenido/fotograma/gb.mjs + sm83.mjs',
      detalle: 'SM83 exacto ciclo de máquina a ciclo (SingleStepTests sm83 sin fallos; blargg cpu_instrs, instr_timing y mem_timing superadas) y PPU punto a punto con la FIFO de píxeles según Pan Docs.',
    },
    reloj: { hz: 4194304, nombre: 'punto' },
    cpus: [{ id: 'cpu', tipo: 'sm83', titulo: cgb ? 'SM83 de la CPU CGB' : 'SM83 del DMG-CPU', hz: 1048576, unidadesPorCiclo: 4, registros: ['A', 'F', 'B', 'C', 'D', 'E', 'H', 'L', 'SP'] }],
    buses: d.buses,
    instrucciones: d.instrucciones,
    video: cgb
      ? { ancho: 160, alto: 144, puntosPorLinea: 456, lineas: 154, primeraVisible: 0, formato: 'rgb555', ...d.lineas }
      : { ancho: 160, alto: 144, puntosPorLinea: 456, lineas: 154, primeraVisible: 0, formato: 'indice', paleta: PALETA_DMG, ...d.lineas },
    fases: { tipos: FASES, ...d.fases },
    senales: { tipos: SENALES, ...d.senales },
    pixeles: d.pixeles,
    fb: 'fb',
    segmentos: reg.segmentos,
    memoria: [
      { nombre: 'ROM', array: 'mem_rom', base: 0 },
      { nombre: 'HRAM', array: 'mem_hram', base: 0xff80 },
    ],
    programa: { ...meta.programa, etiquetas, explicaciones },
  };
  const arrays = {
    ...d.arrays,
    fb: { tipo: cgb ? 'u16' : 'u8', cod: 'crudo', datos: fb },
    mem_rom: { tipo: 'u8', cod: 'crudo', datos: rom.subarray(0, Math.min(rom.length, 0x8000)) },
    mem_hram: { tipo: 'u8', cod: 'crudo', datos: hram0 },
  };
  if (cgb) arrays.px_c.tipo = 'u16';
  const bytes = escribirTraza(salida, manifiesto, arrays);
  console.log(`${maquina}/${programa}: ${reg.buses.cpu.t.length} ciclos de CPU, ${reg.buses.vram?.t.length ?? 0} accesos a VRAM/OAM, ${reg.buses.dma?.t.length ?? 0} de DMA, ${reg.ins.t.length} instrucciones, ${reg.px.t.length} píxeles, ${(bytes / 1024).toFixed(0)} kB`);
  return { bytes, fb: gb.fb, gb };
}
