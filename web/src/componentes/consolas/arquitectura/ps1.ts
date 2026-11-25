// PlayStation, PU-18 (pu-18 schematic): block diagram, address decoding and the timed scenarios. Written from the
// pu-18 netlist (IC103 CPU with the chip selects ~CS0 → PIO, ~CS2 → BIOS /CE, ~CS4 → SPU, ~CS5 → CD controller
// /HCS, ~CS7 → GPU /CS; VBLANK → ~INTIN0, GPU -IREQ → ~INTIN1, CD HINT → ~INTIN2, SPU /IRQ → ~INTIN9; DMA2 GPU,
// DMA4 SPU) and these sources:
//   - Copetti, «PlayStation Architecture»: R3000A-compatible CPU at 33.87 MHz, 4 KB instruction cache, 1 KB
//     scratchpad, GTE, MDEC; 2 MB EDO RAM in four 512 KB chips; GPU with 1 MB, ordering table sent by DMA; SPU 24
//     channels, 44.1 kHz, 512 KB; CD: 68HC05 sub-CPU, controller with 32 KB SRAM; BIOS 512 KB on an 8-bit bus;
//     reset vector $BFC00000.
//   - psx-spx (nocash): memory map (KUSEG/KSEG0/KSEG1, 2 MB RAM mirrored in the first 8 MB, scratchpad, I/O, DEV0,
//     DEV1, DEV8, BIOS), I/O map (SIO0 $1F801040, SIO1 $1F801050, DRAM controller $1F801060, interrupts
//     $1F801070, DMA $1F801080–$1F8010FF, timers $1F801100, CD-ROM $1F801800, GP0 $1F801810, GP1 $1F801814,
//     MDEC $1F801820, SPU $1F801C00–$1F801DFF, DEV8 $1F802000), GPU timing (53.693175 MHz NTSC, 53.203425 MHz PAL;
//     263/314 lines; 3413/3406 video cycles per line; CPU 33.8688 MHz = 44100 Hz × 300h), the DMA2 linked list
//     and the controller protocol (~250 kHz, LSB first, /ACK ≥ 2 µs, 01 42 → 41 5A + two button bytes).

import { Cronograma, hex, type Escenario } from './modelo';
import type { Decodificacion, Diagrama, Maquina, Opciones } from './diagrama';

const CPU = 33.8688e6;
const TC = 1 / CPU;

interface Norma {
  id: 'ntsc' | 'pal';
  nombre: string;
  video: number;
  lineas: number;
  ciclos: number;
}

const NORMAS: Record<'ntsc' | 'pal', Norma> = {
  ntsc: { id: 'ntsc', nombre: 'NTSC', video: 53.693175e6, lineas: 263, ciclos: 3413 },
  pal: { id: 'pal', nombre: 'PAL', video: 53.203425e6, lineas: 314, ciclos: 3406 },
};

let N: Norma = NORMAS.pal;
function conNorma(f: (op: Opciones) => Escenario): (op: Opciones) => Escenario {
  return (op) => {
    N = op.norma === 'ntsc' ? NORMAS.ntsc : NORMAS.pal;
    return f(op);
  };
}

const coma = (x: number, d: number): string => x.toFixed(d).replace('.', ',');
const mhz = (f: number, d = 2): string => `${coma(f / 1e6, d)} MHz`;
const ns = (t: number): string => `${coma(t * 1e9, 1)} ns`;
const us = (t: number, d = 2): string => `${coma(t * 1e6, d)} µs`;

// ------------------------------------------------------------------ diagram

const base: Diagrama = {
  ancho: 1000,
  alto: 560,
  bloques: [
    { id: 'clk', x: 20, y: 14, w: 170, h: 56, titulo: 'Relojes', sub: 'X101 · X201', foto: 'xgpu', esquema: ['X101', 'X201'],
      actividad: [{ pista: 'RELOJ', nivel: 1 }],
      info: 'X101 (67,73 MHz) da el reloj de la CPU, la mitad: 33,8688 MHz, 768 veces 44 100 Hz. X201 da el reloj de la GPU y del vídeo (53,69 MHz en esta placa; en las PAL el vídeo va a 53,203425 MHz).' },
    { id: 'mandos', x: 210, y: 14, w: 170, h: 56, titulo: 'Mandos y tarjetas', sub: 'CN102 · SIO0', foto: 'mandos', esquema: ['CN102'],
      actividad: [{ pista: 'SEL', nivel: 0 }],
      info: 'Un bus serie a unos 250 kHz para los dos mandos y las dos tarjetas: datos en los dos sentidos, reloj, una selección por puerto y /ACK, con el que el dispositivo pide el byte siguiente.' },
    { id: 'puertos', x: 400, y: 14, w: 180, h: 56, titulo: 'Puertos de expansión', sub: 'CN103 paralelo · CN104 serie', foto: 'pio', esquema: ['CN103', 'CN104'], externo: true,
      info: 'El puerto paralelo saca el bus de sistema (SA, SD, /RD, /WR y la selección ~CS0 de la CPU); el serie es el segundo puerto serie de la CPU (SIO1).' },
    { id: 'cpu', x: 20, y: 110, w: 190, h: 130, titulo: 'CPU', sub: 'IC103 CXD8606Q · R3000A 33,87 MHz', foto: 'cpu', esquema: ['IC103'],
      actividad: [{ pista: 'RD' }, { pista: 'WR' }],
      info: 'Núcleo compatible con el R3000A con 4 KB de caché de instrucciones y 1 KB de scratchpad, el GTE (geometría), la DMA, el controlador de la RAM, las interrupciones, los temporizadores y los puertos serie. Decodifica ella misma las direcciones: saca una selección por chip (~CS2 BIOS, ~CS4 SPU, ~CS5 CD, ~CS7 GPU).' },
    { id: 'gpu', x: 330, y: 100, w: 180, h: 100, titulo: 'GPU', sub: 'IC203 CXD8561BQ', foto: 'gpu', esquema: ['IC203'],
      actividad: [{ pista: 'GPUCS', nivel: 0 }, { pista: 'GPUD' }],
      info: 'Recibe órdenes de dibujo por GP0 ($1F801810) y de pantalla por GP1 ($1F801814), casi siempre por DMA (canal 2), y dibuja en la VRAM triángulos, rectángulos y líneas. Saca cada punto en RGB digital y avisa del borrado vertical (VBLANK).' },
    { id: 'vram', x: 560, y: 100, w: 140, h: 60, titulo: 'VRAM 1 MB', sub: 'IC201 · SGRAM', foto: 'vram', esquema: ['IC201'],
      actividad: [{ pista: 'FD' }],
      info: 'El cuadro que se ve, el que se dibuja y las texturas, en un bus de 32 bits solo de la GPU.' },
    { id: 'dacrgb', x: 560, y: 190, w: 140, h: 56, titulo: 'DAC RGB', sub: 'IC202 MC141685', foto: 'rgb', esquema: ['IC202'],
      actividad: [{ pista: 'PIX' }],
      info: 'Tres convertidores de 8 bits: los colores digitales de la GPU pasan a RGB analógico.' },
    { id: 'enc', x: 760, y: 190, w: 220, h: 56, titulo: 'Codificador y Multi Out', sub: 'IC501 CXA1645M · CN502', foto: 'b-enc', esquema: ['IC501', 'CN502'],
      info: 'El CXA1645M saca de RGB el vídeo compuesto y el S-vídeo; el Multi Out lleva además el RGB y el audio.' },
    { id: 'ram', x: 20, y: 300, w: 190, h: 60, titulo: 'RAM 2 MB', sub: 'IC106–IC109 · 4 × 512 KB', foto: 'ram', esquema: ['IC106', 'IC107', 'IC108', 'IC109'],
      actividad: [{ pista: 'RAS' }],
      info: 'Cuatro DRAM EDO de 8 bits que forman la palabra de 32 bits; dirección multiplexada (fila con /RAS, columna con /CAS0–/CAS3, una por byte).' },
    { id: 'bios', x: 240, y: 300, w: 150, h: 56, titulo: 'BIOS 512 KB', sub: 'IC102 · ~CS2', foto: 'bios', esquema: ['IC102'],
      actividad: [{ pista: 'CS2', nivel: 0 }],
      info: 'El arranque y el núcleo del sistema, en una ROM de 8 bits del bus de sistema. La CPU empieza en $BFC00000.' },
    { id: 'spu', x: 420, y: 300, w: 170, h: 80, titulo: 'SPU', sub: 'IC308 CXD2925Q · ~CS4', foto: 'spu', esquema: ['IC308'],
      actividad: [{ pista: 'CS4', nivel: 0 }, { pista: 'LRCK', nivel: 1 }],
      info: '24 voces ADPCM de 16 bits a 44,1 kHz con envolventes y reverberación, y el audio del CD que le pasa el controlador. Manda la mezcla en serie al DAC.' },
    { id: 'spuram', x: 420, y: 430, w: 170, h: 50, titulo: 'RAM del sonido', sub: 'IC310 · 512 KB', foto: 'spuram', esquema: ['IC310'],
      info: 'Muestras, reverberación y búferes de la SPU, en una DRAM de 16 bits.' },
    { id: 'dacaudio', x: 240, y: 430, w: 150, h: 56, titulo: 'DAC de audio', sub: 'IC402 AK4309A', foto: 'dac', esquema: ['IC402'],
      actividad: [{ pista: 'LRCK', nivel: 1 }],
      info: 'Convierte la serie de la SPU (BICK, LRCK, SDATA) en audio estéreo; va a 5 V, del 78M05.' },
    { id: 'cdc', x: 640, y: 300, w: 170, h: 70, titulo: 'Controlador del CD', sub: 'IC305 CXD1815Q · IC303 32 KB', foto: 'cdc', esquema: ['IC305', 'IC303'],
      actividad: [{ pista: 'CS5', nivel: 0 }, { pista: 'SECTOR' }],
      info: 'Recibe del DSP los datos del disco, los guarda por sectores en su SRAM de 32 KB, los corrige y se los da a la CPU por el bus de sistema (~CS5, interrupción en ~INTIN2). El audio del CD sale de aquí hacia la SPU.' },
    { id: 'mech', x: 850, y: 300, w: 130, h: 70, titulo: 'Sub-CPU', sub: 'IC304 MC68HC05G6', foto: 'b-mech', esquema: ['IC304'],
      info: 'Un 68HC05 que gobierna el lector: lee el subcódigo (SUBQ), la tapa (S301) y el final de carrera, enciende el láser y hace la comprobación de protección del disco.' },
    { id: 'servo', x: 640, y: 430, w: 170, h: 70, titulo: 'DSP y servo', sub: 'IC701 · IC703 · IC704', foto: 'dsp', esquema: ['IC701', 'IC703', 'IC704'],
      actividad: [{ pista: 'SECTOR' }],
      info: 'El CXA1791N amplifica la señal de la cabeza; el CXD2545Q la demodula y lleva los servos de foco, seguimiento, carro y giro, que el BA6392FP convierte en corriente para las bobinas y los motores.' },
    { id: 'lector', x: 850, y: 430, w: 130, h: 70, titulo: 'Lector', sub: 'CN701 · CN702', foto: 'cd', esquema: ['CN701', 'CN702'], externo: true,
      info: 'La cabeza óptica (láser, fotodiodos, bobinas de foco y seguimiento) y los motores del disco y del carro.' },
    { id: 'alim', x: 20, y: 470, w: 190, h: 60, titulo: 'Alimentación', sub: 'CN602 · IC601 78M05', foto: 'alim', esquema: ['CN602', 'IC601'],
      info: 'La fuente da 3,3 V y 8 V; fusibles SMD (PS601–PS605) los reparten y el 78M05 hace los 5 V del audio.' },
  ],
  conexiones: [
    { id: 'xcpu', puntos: [[100, 70], [100, 110]], bits: 1, etiqueta: '67,74 MHz', pos: [134, 92], clase: 'reloj', pista: 'RELOJ', nivel: 1, red: '/IC103_CRYSTALP' },
    { id: 'xgpu', puntos: [[190, 60], [300, 60], [300, 84], [420, 84], [420, 100]], bits: 1, etiqueta: 'X201', pos: [330, 78], clase: 'reloj', red: '/GPU_OSC' },
    { id: 'sio0', puntos: [[295, 70], [295, 95], [180, 95], [180, 110]], bits: 6, etiqueta: 'SIO0', pos: [236, 90], clase: 'control', pista: 'SEL', nivel: 0, red: '/CONT_TXD' },
    { id: 'gpud', puntos: [[210, 150], [330, 150]], bits: 32, etiqueta: 'D0–31 (GPU)', pos: [270, 143], clase: 'dato', pista: 'GPUD', valor: true, red: '/GPUD0' },
    { id: 'gpucs', puntos: [[210, 175], [330, 175]], bits: 4, etiqueta: '/CS, /RD, /WR, DACK', pos: [270, 168], clase: 'seleccion', pista: 'GPUCS', nivel: 0, red: '/GPUCS' },
    { id: 'vblank', puntos: [[340, 200], [340, 222], [210, 222]], bits: 1, etiqueta: 'VBLANK', pos: [276, 216], clase: 'interrupcion', pista: 'VBLANK', nivel: 1, red: '/VBLANK' },
    { id: 'vram', puntos: [[510, 130], [560, 130]], bits: 42, etiqueta: 'FD, LA', pos: [535, 123], clase: 'bus', pista: 'FD', valor: true, red: '/FD0' },
    { id: 'rgb', puntos: [[510, 185], [535, 185], [535, 218], [560, 218]], bits: 24, etiqueta: 'R, G, B', pos: [540, 240], clase: 'dato', pista: 'PIX', valor: true, red: '/SR0' },
    { id: 'analog', puntos: [[700, 218], [760, 218]], bits: 3, etiqueta: 'RGB', pos: [730, 211], clase: 'dato', red: '/VID_QPR' },
    { id: 'ram', puntos: [[100, 240], [100, 300]], bits: 42, etiqueta: 'DA0–9, DD0–31', pos: [140, 262], clase: 'bus', pista: 'RAMA', valor: true, red: '/CPMA0' },
    { id: 'sbus', puntos: [[180, 240], [180, 275], [960, 275]], bits: 40, etiqueta: 'SA, SD, /RD, /WR', pos: [880, 268], clase: 'bus', pista: 'SA', valor: true, red: '/SA1' },
    { id: 'pio', puntos: [[530, 70], [530, 275]], bits: 40, etiqueta: '', clase: 'bus', pista: 'SA', red: '/CART_A0' },
    { id: 'bios', puntos: [[315, 275], [315, 300]], bits: 32, etiqueta: '', clase: 'bus', pista: 'SA' },
    { id: 'spu', puntos: [[505, 275], [505, 300]], bits: 40, etiqueta: '', clase: 'bus', pista: 'SA' },
    { id: 'cdc', puntos: [[725, 275], [725, 300]], bits: 10, etiqueta: '', clase: 'bus', pista: 'SA' },
    { id: 'spuram', puntos: [[505, 380], [505, 430]], bits: 25, etiqueta: 'MA, MD', pos: [532, 405], clase: 'bus', red: '/MD0' },
    { id: 'i2s', puntos: [[420, 365], [405, 365], [405, 458], [390, 458]], bits: 3, etiqueta: 'BICK, LRCK, DATA', pos: [350, 412], clase: 'dato', pista: 'LRCK', nivel: 1, red: '/SPU_DATO' },
    { id: 'cdaudio', puntos: [[640, 345], [590, 345]], bits: 3, etiqueta: 'audio del CD', pos: [615, 338], clase: 'dato', red: 'Net-(IC305-BCKO)' },
    { id: 'deco', puntos: [[810, 330], [850, 330]], bits: 12, etiqueta: 'DECD', pos: [830, 323], clase: 'control', red: '/MCD0' },
    { id: 'cddata', puntos: [[725, 430], [725, 370]], bits: 3, etiqueta: 'DATA, BCLK, LRCK', pos: [760, 412], clase: 'dato', pista: 'SECTOR', valor: true, red: '/CDDATA' },
    { id: 'subq', puntos: [[915, 370], [915, 400], [790, 400], [790, 430]], bits: 4, etiqueta: 'SUBQ, SQCK, SENS', pos: [860, 394], clase: 'control', red: '/MECH_SUBQ' },
    { id: 'optica', puntos: [[810, 465], [850, 465]], bits: 16, etiqueta: 'cabeza, motores', pos: [830, 490], clase: 'control', red: '/OPT_FCS+' },
  ],
};

const diagramas = new Map<string, Diagrama>();

function diagramaDe(id: string): Diagrama {
  const n = id === 'ntsc' ? NORMAS.ntsc : NORMAS.pal;
  let d = diagramas.get(n.id);
  if (!d) {
    d = { ...base, bloques: base.bloques.map((b) => (b.id === 'clk' ? { ...b, sub: `X101 · X201 · vídeo ${mhz(n.video)}` } : b)) };
    diagramas.set(n.id, d);
  }
  return d;
}

// ------------------------------------------------------------------ decoding (psx-spx)

interface Region {
  ini: number;
  fin: number;
  zona: string;
  sel: string | null;
  bloque: string | null;
  texto: string;
}

const IO: Region[] = [
  { ini: 0x1f801000, fin: 0x1f80103f, zona: 'Control del bus de sistema', sel: 'CPU interno', bloque: 'cpu', texto: 'Los retardos y el ancho de cada zona del bus de sistema (DEV0, DEV1, BIOS, SPU, CD, DEV8).' },
  { ini: 0x1f801040, fin: 0x1f80104f, zona: 'SIO0: mandos y tarjetas', sel: 'CPU interno', bloque: 'mandos', texto: 'El puerto serie de los mandos y las tarjetas de memoria, dentro de la CPU; sale por CN102.' },
  { ini: 0x1f801050, fin: 0x1f80105f, zona: 'SIO1: puerto serie', sel: 'CPU interno', bloque: 'puertos', texto: 'El segundo puerto serie, dentro de la CPU; sale por CN104.' },
  { ini: 0x1f801060, fin: 0x1f80106f, zona: 'Controlador de la DRAM', sel: 'CPU interno', bloque: 'ram', texto: 'Configura la RAM principal.' },
  { ini: 0x1f801070, fin: 0x1f80107f, zona: 'Interrupciones', sel: 'CPU interno', bloque: 'cpu', texto: 'Estado y máscara de las interrupciones: VBLANK entra por ~INTIN0, la GPU por ~INTIN1, el CD por ~INTIN2 y la SPU por ~INTIN9.' },
  { ini: 0x1f801080, fin: 0x1f8010ff, zona: 'DMA', sel: 'CPU interno', bloque: 'cpu', texto: 'Los canales de DMA 0–6 y su control: el 2 es la GPU (DREQ2/DACK2) y el 4 la SPU (DREQ4/DACK4).' },
  { ini: 0x1f801100, fin: 0x1f80112f, zona: 'Temporizadores', sel: 'CPU interno', bloque: 'cpu', texto: 'Los tres contadores de la CPU.' },
  { ini: 0x1f801800, fin: 0x1f801803, zona: 'Controlador del CD', sel: '~CS5', bloque: 'cdc', texto: 'Cuatro registros del CXD1815Q: la CPU baja ~CS5, que llega a su /HCS, con la dirección en SA0–SA1 y el dato en SD0–SD7.' },
  { ini: 0x1f801810, fin: 0x1f801813, zona: 'GPU: GP0', sel: '~CS7', bloque: 'gpu', texto: 'Órdenes de dibujo y de VRAM (y su respuesta): ~CS7 baja el /CS de la GPU, que toma la palabra por D0–D31.' },
  { ini: 0x1f801814, fin: 0x1f801817, zona: 'GPU: GP1', sel: '~CS7', bloque: 'gpu', texto: 'Órdenes de pantalla y estado de la GPU, por la misma selección.' },
  { ini: 0x1f801820, fin: 0x1f801827, zona: 'MDEC', sel: 'CPU interno', bloque: 'cpu', texto: 'El descompresor de vídeo (órdenes, datos y estado).' },
  { ini: 0x1f801c00, fin: 0x1f801dff, zona: 'SPU', sel: '~CS4', bloque: 'spu', texto: 'Registros de las 24 voces (16 bytes cada una) y el control y la reverberación de la SPU: ~CS4 baja su /SPU; dato de 16 bits en SD0–SD15.' },
];

function region(v: number): { r: Region | null; fis: number; seg: string } {
  let fis = v;
  let seg = 'KUSEG';
  if (v >= 0x80000000 && v < 0xa0000000) {
    fis = v - 0x80000000;
    seg = 'KSEG0';
  } else if (v >= 0xa0000000 && v < 0xc0000000) {
    fis = v - 0xa0000000;
    seg = 'KSEG1';
  } else if (v >= 0xfffe0000) {
    return { r: { ini: 0xfffe0000, fin: 0xfffe01ff, zona: 'Control de la caché (KSEG2)', sel: 'CPU interno', bloque: 'cpu', texto: 'Registros internos de la CPU, como el de configuración de la caché ($FFFE0130).' }, fis: v, seg: 'KSEG2' };
  } else if (v >= 0xc0000000) return { r: null, fis: v, seg: 'KSEG2' };
  if (fis < 0x00800000) {
    const espejo = fis >= 0x00200000;
    return { r: { ini: 0, fin: 0x007fffff, zona: espejo ? 'RAM principal (espejo)' : 'RAM principal', sel: '/RAS, /CAS', bloque: 'ram',
      texto: `Los 2 MB de la RAM${espejo ? ` se repiten en los primeros 8 MB: ${hex(fis, 8)} es ${hex(fis & 0x1fffff, 8)}` : ''}; la CPU los pide por su propio bus (DA0–DA9, DD0–DD31) con /RAS y la /CAS de cada byte. Los primeros 64 KB los usa la BIOS.` }, fis, seg };
  }
  if (fis >= 0x1f000000 && fis <= 0x1f7fffff)
    return { r: { ini: 0x1f000000, fin: 0x1f7fffff, zona: 'DEV0: expansión', sel: '~CS0', bloque: 'puertos', texto: 'La expansión de 8 MB (ROM o RAM): la CPU baja ~CS0, que en esta placa sale por el puerto paralelo (CART_CS0, CN103) con el bus de sistema.' }, fis, seg };
  if (fis >= 0x1f800000 && fis <= 0x1f8003ff) {
    if (seg === 'KSEG1') return { r: null, fis, seg };
    return { r: { ini: 0x1f800000, fin: 0x1f8003ff, zona: 'Scratchpad (1 KB)', sel: 'CPU interno', bloque: 'cpu', texto: 'La caché de datos usada como RAM rápida, dentro de la CPU; no se ve en KSEG1.' }, fis, seg };
  }
  if (fis >= 0x1f801000 && fis <= 0x1f801fff) {
    const r = IO.find((x) => fis >= x.ini && fis <= x.fin);
    return { r: r ?? { ini: 0x1f801000, fin: 0x1f801fff, zona: 'Puertos de E/S', sel: 'CPU interno', bloque: 'cpu', texto: 'Un puerto de E/S sin uso conocido.' }, fis, seg };
  }
  if (fis >= 0x1f802000 && fis <= 0x1f803fff)
    return { r: { ini: 0x1f802000, fin: 0x1f803fff, zona: 'DEV8: expansión 2', sel: null, bloque: 'puertos', texto: 'Puertos de E/S de expansión (antes «EXP2»): ningún chip de esta placa contesta.' }, fis, seg };
  if (fis >= 0x1fa00000 && fis <= 0x1fbfffff)
    return { r: { ini: 0x1fa00000, fin: 0x1fbfffff, zona: 'DEV1: expansión', sel: null, bloque: null, texto: 'Zona de BIOS en SRAM de las tarjetas de desarrollo: nada en esta placa.' }, fis, seg };
  if (fis >= 0x1fc00000 && fis <= 0x1fc7ffff)
    return { r: { ini: 0x1fc00000, fin: 0x1fc7ffff, zona: 'BIOS (512 KB)', sel: '~CS2', bloque: 'bios', texto: 'La ROM del sistema: la CPU baja ~CS2, que es el /CE de IC102, y lee bytes por SD0–SD7. Tras el reset empieza en $BFC00000.' }, fis, seg };
  return { r: null, fis, seg };
}

export function decodificar(dir: number, escritura: boolean): Decodificacion {
  const v = dir >>> 0;
  const { r, fis, seg } = region(v);
  const tabla = [
    { etiqueta: '/RAS, /CAS0–3 (RAM principal)', activa: r?.bloque === 'ram' && r.sel !== 'CPU interno' },
    { etiqueta: '~CS2 → /CE de la BIOS', activa: r?.sel === '~CS2' },
    { etiqueta: '~CS4 → /SPU', activa: r?.sel === '~CS4' },
    { etiqueta: '~CS5 → /HCS del controlador del CD', activa: r?.sel === '~CS5' },
    { etiqueta: '~CS7 → /CS de la GPU', activa: r?.sel === '~CS7' },
    { etiqueta: '~CS0 → puerto paralelo', activa: r?.sel === '~CS0' },
    { etiqueta: 'Dentro de la CPU (E/S, DMA, interrupciones, scratchpad)', activa: r?.sel === 'CPU interno' },
    { etiqueta: `Segmento ${seg}${seg !== 'KUSEG' && seg !== 'KSEG2' ? `: física ${hex(fis, 8)}` : ''}`, activa: seg === 'KSEG0' || seg === 'KSEG1' },
  ].map((x) => ({ ...x, valor: x.activa ? 'activa' : '' }));
  return { direccion: v, escritura, tabla, zona: r?.zona ?? 'Sin dispositivo', seleccion: r?.sel ?? null, bloque: r?.bloque ?? null,
    texto: r ? r.texto : 'Ningún dispositivo contesta en esa dirección.',
    espejo: r?.bloque === 'ram' && fis >= 0x200000 ? hex(fis & 0x1fffff, 8) : seg === 'KSEG0' || seg === 'KSEG1' ? hex(fis, 8) : undefined };
}

// ------------------------------------------------------------------ CPU accesses

interface Acceso {
  dir: number;
  escritura: boolean;
  dato: string;
  nota: string;
  ciclos: number;
}

function senalesCPU(c: Cronograma): void {
  c.bit('SYSCLK', 'Reloj de la CPU 33,8688 MHz', 1)
    .bus('A', 'Dirección')
    .bus('D', 'Dato')
    .bit('RD', '/RD', 1)
    .bit('WR', '/WR', 1)
    .bit('RAS', '/RAS (RAM)', 1)
    .bit('CS2', '~CS2 (BIOS)', 1)
    .bit('CS4', '~CS4 (SPU)', 1)
    .bit('CS5', '~CS5 (CD)', 1)
    .bit('GPUCS', '~CS7 (GPU)', 1)
    .bus('SEL', 'Selección');
}

function acceso(c: Cronograma, t0: number, x: Acceso): number {
  const d = decodificar(x.dir, x.escritura);
  const fin = t0 + x.ciclos * TC;
  const s = t0 + TC;
  c.marca(t0);
  c.set('A', t0, hex(x.dir, 8));
  c.set('A', fin, null);
  c.set(x.escritura ? 'WR' : 'RD', s, 0);
  c.set(x.escritura ? 'WR' : 'RD', fin, 1);
  const pista = d.seleccion === '~CS2' ? 'CS2' : d.seleccion === '~CS4' ? 'CS4' : d.seleccion === '~CS5' ? 'CS5' : d.seleccion === '~CS7' ? 'GPUCS' : d.bloque === 'ram' ? 'RAS' : null;
  if (pista) {
    c.set(pista, s, 0);
    c.set(pista, fin, 1);
  }
  c.set('SEL', t0, d.seleccion ?? 'nadie');
  c.set('SEL', fin, null);
  c.set('D', x.escritura ? s : fin - TC, x.dato);
  c.set('D', fin, null);
  return fin;
}

function escenarioCPU(id: string, titulo: string, descripcion: string, lista: Acceso[]): Escenario {
  const c = new Cronograma();
  senalesCPU(c);
  let t = 0;
  for (const x of lista) {
    const fin = acceso(c, t, x);
    c.paso(t, fin, `${x.escritura ? 'Escritura' : 'Lectura'} en ${hex(x.dir, 8)}: ${x.nota}`);
    t = fin + TC;
  }
  c.reloj('SYSCLK', 0, t, TC);
  c.marca(t);
  return {
    id, titulo, descripcion, duracion: t, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: (6 * TC) / 2,
    defecto: ['SYSCLK', 'A', 'D', 'RD', 'WR', 'RAS', 'CS2', 'CS4', 'GPUCS', 'SEL'],
    fidelidad: `Exacto: el reloj de la CPU (33,8688 MHz, ${ns(TC)}), las direcciones (psx-spx) y qué selección de la CPU baja en cada una (redes del esquema de pu-18: ~CS2 → /CE de IC102, ~CS4 → /SPU, ~CS5 → /HCS, ~CS7 → /CS de la GPU). Ilustrativo: cuántos ciclos dura cada acceso (los retardos de cada zona se fijan en los registros de $1F801000), la forma de /RD y /WR y los datos.`,
  };
}

const ARRANQUE: Acceso[] = [
  { dir: 0xbfc00000, escritura: false, dato: '$3C080013', nota: 'la primera instrucción tras el reset, en la BIOS (~CS2): la ROM es de 8 bits, así que una palabra son cuatro lecturas', ciclos: 24 },
  { dir: 0xa0000100, escritura: true, dato: '$00000000', nota: 'la RAM principal, por su propio bus con /RAS y /CAS', ciclos: 6 },
  { dir: 0x1f801810, escritura: true, dato: '$E1000600', nota: 'una orden a la GPU por GP0 (~CS7)', ciclos: 5 },
  { dir: 0x1f801c00, escritura: true, dato: '$3FFF', nota: 'el volumen de la voz 0 de la SPU (~CS4, 16 bits)', ciclos: 8 },
  { dir: 0x1f801800, escritura: false, dato: '$18', nota: 'el estado del controlador del CD (~CS5, 8 bits)', ciclos: 8 },
];

function escenarioDecodificar(op: Opciones): Escenario {
  const dir = (parseInt(op.dir ?? '0', 16) || 0) >>> 0;
  const w = op.escritura === '1';
  const d = decodificar(dir, w);
  return escenarioCPU('decodificar', `Acceso a ${hex(dir, 8)}`, `${d.zona}: la CPU decodifica la dirección y baja su selección.`, [
    { dir, escritura: w, dato: '$12345678', nota: d.texto, ciclos: 8 },
  ]);
}

// ------------------------------------------------------------------ GPU DMA (ordering table)

function escenarioDMA(): Escenario {
  const c = new Cronograma();
  c.bit('DREQ2', 'DREQ2 (GPU lista)', 0).bit('DACK2', 'DACK2', 0).bus('RAMA', 'RAM principal').bus('GPUD', 'D0–31 → GP0').bit('GPUCS', '/CS de la GPU', 1).bus('CPU', 'CPU');
  const paquetes: [number, string, string[]][] = [
    [0x1ffffc, 'una entrada vacía de la tabla: su cabecera solo enlaza con la siguiente', []],
    [0x1ff800, 'la cabecera enlaza con el siguiente paquete y detrás van las palabras de una orden de dibujo', ['$2C808080', '$00500040', '$7C3C0000', '$00500060', '$0010001C']],
    [0x1ff7e0, 'la cabecera lleva el código de fin: la DMA para', []],
  ];
  let t = 0;
  c.set('CPU', 0, 'escribe D2_CHCR = $01000401');
  t += 8 * TC;
  c.paso(0, t, 'La CPU apunta D2_MADR al final de la tabla de orden, deja D2_BCR a 0 y arranca el canal 2 en modo lista enlazada.');
  c.set('CPU', t, 'sigue con el juego');
  c.set('DREQ2', t, 1);
  for (const [dir, nota, palabras] of paquetes) {
    const a = t;
    c.marca(a);
    c.set('DACK2', a, 1);
    c.set('RAMA', a, hex(dir, 6));
    t += 2 * TC;
    c.set('RAMA', t, null);
    for (const p of palabras) {
      c.set('GPUD', t, p);
      c.set('GPUCS', t, 0);
      t += TC;
      c.set('GPUCS', t, 1);
    }
    c.set('GPUD', t, null);
    c.set('DACK2', t, 0);
    c.paso(a, t, `Paquete en ${hex(dir, 6)}: ${nota}.${palabras.length ? ' Sus palabras van a GP0, una tras otra.' : ''}`);
    t += 2 * TC;
  }
  c.set('DREQ2', t, 0);
  c.marca(t);
  return {
    id: 'dma', titulo: 'DMA de la tabla de orden a la GPU',
    descripcion: 'La CPU ordena los polígonos en una tabla de listas enlazadas en la RAM y la DMA del canal 2 la recorre, mandando cada paquete a GP0 mientras la GPU puede tomarlo.',
    duracion: t, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: t / 12,
    defecto: ['DREQ2', 'DACK2', 'RAMA', 'GPUD', 'GPUCS', 'CPU'],
    fidelidad: 'Exacto: el modo lista enlazada del canal 2 (D2_MADR al último elemento, D2_BCR = 0, D2_CHCR = $01000401), que cada paquete enlaza con el siguiente y que la lista acaba en un código de fin (psx-spx); DREQ2 y DACK2 son las redes del esquema. Ilustrativo: las direcciones, los ciclos de cada palabra y las palabras.',
  };
}

// ------------------------------------------------------------------ frame

function escenarioCuadro(): Escenario {
  const TL = N.ciclos / N.video;
  const fin = N.lineas * TL;
  const vis = N.id === 'ntsc' ? [16, 256] : [20, 308];
  const c = new Cronograma();
  c.bus('LINEA', 'Línea').bit('VBLANK', 'VBLANK (GPU → ~INTIN0)', 0).bit('IMAGEN', 'Imagen', 0).bus('CPU', 'CPU');
  for (let l = 0; l < N.lineas; l++) c.set('LINEA', l * TL, String(l));
  c.set('IMAGEN', vis[0]! * TL, 1);
  c.set('IMAGEN', vis[1]! * TL, 0);
  c.set('VBLANK', vis[1]! * TL, 1);
  c.set('VBLANK', fin - 1e-9, 0);
  c.set('CPU', 0, 'lógica y tabla de orden');
  c.set('CPU', vis[1]! * TL, 'interrupción: cambia el cuadro mostrado (GP1)');
  c.set('CPU', vis[1]! * TL + 3 * TL, 'lanza la DMA del cuadro siguiente');
  c.marca(vis[1]! * TL);
  c.paso(0, vis[1]! * TL, 'La GPU saca el cuadro que se ve desde la VRAM mientras dibuja el siguiente en otra zona, con las órdenes que le llegan por DMA.');
  c.paso(vis[1]! * TL, fin, 'Borrado vertical: la GPU avisa por VBLANK (~INTIN0 de la CPU). El juego cambia por GP1 la zona de la VRAM que se muestra y prepara la siguiente.');
  c.marca(fin);
  return {
    id: 'cuadro', titulo: 'Un cuadro y el borrado vertical',
    descripcion: `Un cuadro ${N.nombre}: ${N.lineas} líneas de unos ${N.ciclos} ciclos del reloj de vídeo de ${mhz(N.video, 3)} (${us(TL)}): ${coma(1 / fin, 2)} cuadros por segundo.`,
    duracion: fin, escala: 'ms', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 16,
    defecto: ['LINEA', 'VBLANK', 'IMAGEN', 'CPU'],
    fidelidad: `Exacto: ${N.lineas} líneas por cuadro y ${N.ciclos} ciclos por línea (psx-spx los da como aproximados) del reloj de vídeo nominal (${mhz(N.video, 6)}), y VBLANK de la GPU a ~INTIN0 de la CPU (esquema). Ilustrativo: las líneas visibles y lo que hace la CPU.`,
  };
}

// ------------------------------------------------------------------ controller

function escenarioMando(): Escenario {
  const c = new Cronograma();
  const TB = 1 / 250e3;
  c.bit('SEL', '/CS del puerto 1', 1).bit('SCK', 'SCK', 1).bus('TX', 'CPU → mando').bus('RX', 'mando → CPU').bit('ACK', '/ACK', 1);
  const pares: [string, string, string][] = [
    ['$01', 'Hi-Z', 'La CPU baja la selección del puerto 1 y manda $01: «el mando» (las tarjetas usan $81).'],
    ['$42', '$41', 'Orden $42, «leer»; el mando contesta $41: mando digital.'],
    ['$00', '$5A', 'La CPU manda relleno; el mando, $5A.'],
    ['$00', '$FF', 'Primer byte de botones.'],
    ['$00', '$F7', 'Segundo byte de botones.'],
  ];
  let t = 4e-6;
  c.set('SEL', 2e-6, 0);
  pares.forEach(([tx, rx, nota], k) => {
    const a = t;
    c.marca(a);
    c.set('TX', a, tx);
    c.set('RX', a, rx);
    for (let b = 0; b < 8; b++) {
      c.set('SCK', a + b * TB, 0);
      c.set('SCK', a + (b + 0.5) * TB, 1);
    }
    t += 8 * TB;
    c.set('TX', t, null);
    c.set('RX', t, null);
    if (k < pares.length - 1) {
      c.set('ACK', t + 6e-6, 0);
      c.set('ACK', t + 8e-6, 1);
      c.paso(a, t + 10e-6, `${nota} Ocho bits a unos 250 kHz, el menos significativo primero; el mando baja /ACK al menos 2 µs para pedir el siguiente.`);
      t += 14e-6;
    } else c.paso(a, t + 4e-6, `${nota} Sin /ACK: es el último byte.`);
  });
  t += 4e-6;
  c.set('SEL', t, 1);
  t += 2e-6;
  c.marca(t);
  return {
    id: 'mando', titulo: 'Leer un mando', descripcion: 'La CPU lee el mando del puerto 1 por SIO0: cinco bytes en cada sentido a la vez.',
    duracion: t, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: t / 14,
    defecto: ['SEL', 'SCK', 'TX', 'RX', 'ACK'],
    fidelidad: 'Exacto: unos 250 kHz, el bit menos significativo primero, /ACK bajo al menos 2 µs tras cada byte menos el último, y la secuencia $01 $42 → $41 $5A y dos bytes de botones (psx-spx, «Controllers and Memory Cards»). Ilustrativo: el retardo de /ACK y los botones.',
  };
}

// ------------------------------------------------------------------ SPU to DAC

function escenarioSonido(): Escenario {
  const fs = 44100;
  const T = 1 / fs;
  const TB = T / 32;
  const c = new Cronograma();
  c.bit('LRCK', 'LRCK (44,1 kHz)', 1).bit('BICK', 'BICK (bit)', 1).bus('DATA', 'SDATA').bus('VOZ', 'Voces mezcladas');
  for (let k = 0; k < 2; k++) {
    const a = k * T;
    c.set('LRCK', a, 1);
    c.set('LRCK', a + T / 2, 0);
    c.set('DATA', a, `L ${hex(0x1200 + 0x40 * k, 4)}`);
    c.set('DATA', a + T / 2, `R ${hex(0xedc0 - 0x40 * k, 4)}`);
    c.set('VOZ', a, '24 voces + CD');
    c.marca(a);
    c.paso(a, a + T, `Muestra ${k + 1}: la SPU suma las 24 voces y el audio del CD y manda los 16 bits de cada canal en serie al AK4309A.`);
  }
  const fin = 2 * T;
  c.reloj('BICK', 0, fin, TB);
  c.marca(fin);
  return {
    id: 'sonido', titulo: 'De la SPU al DAC', descripcion: 'Cada 22,7 µs (44,1 kHz) la SPU entrega una muestra estéreo al DAC: 44 100 = 33 868 800 ÷ 768, el mismo cristal que la CPU.',
    duracion: fin, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 12,
    defecto: ['LRCK', 'BICK', 'DATA', 'VOZ'],
    fidelidad: 'Exacto: 44,1 kHz, 16 bits por canal, 24 voces (Copetti), la relación con el reloj de la CPU (psx-spx) y las redes SPU_BCKO, SPU_LRCO y SPU_DATO hacia BICK, LRCK y SDATA del AK4309A (esquema). Ilustrativo: 32 flancos de bit por muestra y los valores.',
  };
}

// ------------------------------------------------------------------ clocks

function escenarioRelojes(): Escenario {
  const c = new Cronograma();
  const fin = 4 * TC;
  c.bit('X101', 'X101 67,7376 MHz', 1).bit('CPU', 'CPU 33,8688 MHz (÷ 2)', 1).bit('VIDEO', `Vídeo ${mhz(N.video, 3)} (${N.nombre})`, 1)
    .bit('PUNTO', `Punto de 320 (vídeo × 11/7 ÷ 8) ${mhz((N.video * 11) / 7 / 8)}`, 1);
  c.reloj('X101', 0, fin, 1 / (2 * CPU));
  c.reloj('CPU', 0, fin, TC);
  c.reloj('VIDEO', 0, fin, 1 / N.video);
  c.reloj('PUNTO', 0, fin, (7 * 8) / (11 * N.video));
  for (let k = 0; k <= 4; k++) c.marca(k * TC);
  c.paso(0, fin, `X101 da 67,7376 MHz y la CPU va a la mitad, 33,8688 MHz = 44 100 Hz × 768: del mismo reloj salen las muestras de sonido. El vídeo va aparte (X201): ${mhz(N.video, 6)} en ${N.nombre}; el reloj de punto es ese × 11/7 dividido por 10, 8, 7, 5 o 4 según el ancho (256, 320, 368, 512 o 640 puntos).`);
  return {
    id: 'relojes', titulo: 'Relojes', descripcion: 'El cristal de la CPU y del sonido y el del vídeo.',
    duracion: fin, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 8,
    defecto: ['X101', 'CPU', 'VIDEO', 'PUNTO'],
    fidelidad: 'Exacto: 33,8688 MHz = 44 100 × 768, los relojes de vídeo NTSC y PAL y los divisores del punto (psx-spx); X101 de 67,73 MHz en el esquema. Ilustrativo: las fases.',
  };
}

export const PS1: Maquina = {
  id: 'ps1',
  diagrama: diagramaDe('pal'),
  diagramaDe,
  variantes: [
    { id: 'pal', titulo: 'PAL · 50 Hz', nota: 'PAL (SCPH-5502): vídeo a 53,203425 MHz, 314 líneas de unos 3406 ciclos.' },
    { id: 'ntsc', titulo: 'NTSC · 60 Hz', nota: 'NTSC (el cristal X201 de 53,69 MHz de la recreación): 263 líneas de unos 3413 ciclos.' },
  ],
  digitos: 8,
  dirInicial: '1F801810',
  notaDecodificador: 'KUSEG ($00000000), KSEG0 ($80000000) y KSEG1 ($A0000000) llevan a la misma memoria física.',
  decodificar,
  escenarios: [
    { id: 'bus', titulo: 'Accesos de la CPU', crear: conNorma(() => escenarioCPU('bus', 'Accesos de la CPU', 'La primera instrucción de la BIOS y cuatro accesos: la RAM, la GPU, la SPU y el CD, cada uno con su selección.', ARRANQUE)) },
    { id: 'decodificar', titulo: 'Decodificar una dirección', crear: conNorma(escenarioDecodificar) },
    { id: 'dma', titulo: 'DMA a la GPU', crear: conNorma(escenarioDMA) },
    { id: 'cuadro', titulo: 'Un cuadro y el borrado vertical', crear: conNorma(escenarioCuadro) },
    { id: 'mando', titulo: 'Leer un mando', crear: conNorma(escenarioMando) },
    { id: 'sonido', titulo: 'De la SPU al DAC', crear: conNorma(escenarioSonido) },
    { id: 'relojes', titulo: 'Relojes', crear: conNorma(escenarioRelojes) },
  ],
  ejemplos: [
    { dir: 0xbfc00000, escritura: false, texto: 'BIOS' },
    { dir: 0x80010000, escritura: true, texto: 'RAM' },
    { dir: 0x00345678, escritura: false, texto: 'espejo RAM' },
    { dir: 0x1f801810, escritura: true, texto: 'GP0' },
    { dir: 0x1f801c00, escritura: true, texto: 'SPU' },
    { dir: 0x1f801800, escritura: false, texto: 'CD' },
    { dir: 0x1f801040, escritura: true, texto: 'mandos' },
    { dir: 0x1f000000, escritura: false, texto: 'paralelo' },
  ],
  opciones: [],
};
