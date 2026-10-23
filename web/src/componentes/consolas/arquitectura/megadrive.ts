// Mega Drive / Genesis model 1 (VA5/VA6 generation: VDP 315-5313, I/O-arbiter 315-5402/5433, YM2612, Z80, 68000):
// block diagram, 68000 and Z80 address decoding and the timed scenarios.
//
// Timing figures:
//   - clocks: MCLK 53.203424 MHz PAL (12 × the 4.43361875 MHz PAL subcarrier; OSC1 «53.2034 MHz» on the VA6.8
//     photo, JP3 «PAL» bridged in stonedDiscord's «IC BD M5 PAL») or 53.693175 MHz NTSC (15 × 3.579545 MHz);
//     68000 = MCLK ÷ 7 (7.600489 / 7.670454 MHz, net VCLK from the 315-5402, also the YM2612's clock); Z80 and PSG
//     = MCLK ÷ 15 (3.546895 / 3.579545 MHz, CLK0 of the VDP → ZCLK); pixel clock MCLK ÷ 8 in H40 (320 px) and ÷ 10
//     in H32 (C. MacDonald, genvdp.txt; schematic nets). The scenarios take the standard from op.norma (PAL by
//     default, like the board shown).
//   - 68000 bus cycle (Motorola «M68000 8-/16-/32-Bit Microprocessors User's Manual», read and write cycle
//     timing): 8 states S0–S7 of half a clock; address from S1, /AS and (read) /UDS-/LDS from S2, /DTACK sampled at
//     the end of S4, data latched entering S7, strobes negated in S7; write: R/W low from S2, data from S3,
//     /UDS-/LDS from S4.
//   - Z80 cycles: Zilog UM0080 (z80.ts). BUSREQ is sampled at the last T state of each machine cycle and BUSACK
//     goes low in the next one; the 68000 asks for the Z80 bus by writing $0100 to $A11100 and waits for bit 0 of
//     $A11100 to read 0 (genvdp.txt / Sega documentation as summarised in INFORME_2 §6.2).
//   - video: 313 lines PAL (49.70 Hz) or 262 NTSC (59.92 Hz) of 3420 MCLK (64.28 / 63.70 µs); 224 active lines
//     (V28; PAL also allows 240, V30); V interrupt (level 6) at the
//     start of line 224 and the Z80 /INT at the same time; H interrupt (level 4) when the line counter of
//     register 10 underflows; DMA 68000 → VRAM at 205 bytes per line in blanking and 18 in active display (H40,
//     genvdp.txt).

import { Cronograma, hex, type Escenario } from './modelo';
import type { Decodificacion, Diagrama, Maquina, Opciones } from './diagrama';
import { cicloZ80, senalesZ80, type CicloZ80 } from './z80';

export interface Norma {
  id: 'pal' | 'ntsc';
  nombre: string;
  mclk: number;
  lineas: number;
  /** Where MCLK comes from (Spanish, shown in the diagram). */
  origen: string;
}

export const NORMAS: Record<'pal' | 'ntsc', Norma> = {
  pal: { id: 'pal', nombre: 'PAL', mclk: 53.203424e6, lineas: 313, origen: '12 × la subportadora PAL (4,43361875 MHz)' },
  ntsc: { id: 'ntsc', nombre: 'NTSC', mclk: 53.693175e6, lineas: 262, origen: '15 × la subportadora NTSC (3,579545 MHz)' },
};

// Timing of the scenario being built. Scenarios are created synchronously, one at a time, so `conNorma` sets these
// before each one instead of threading the standard through every helper.
let N: Norma = NORMAS.pal;
let TM = 1 / N.mclk;
let T68 = 7 * TM; // 131.6 ns PAL, 130.4 ns NTSC
let TZ = 15 * TM; // 281.9 / 279.4 ns
let TL = 3420 * TM; // 64.28 / 63.70 µs

function fijarNorma(id: string | undefined): void {
  N = id === 'ntsc' ? NORMAS.ntsc : NORMAS.pal;
  TM = 1 / N.mclk;
  T68 = 7 * TM;
  TZ = 15 * TM;
  TL = 3420 * TM;
}

function conNorma(f: (op: Opciones) => Escenario): (op: Opciones) => Escenario {
  return (op) => {
    fijarNorma(op.norma);
    return f(op);
  };
}

/** Spanish number formatting: MHz, ns and µs with a decimal comma. */
const coma = (x: number, d: number): string => x.toFixed(d).replace('.', ',');
const mhz = (div: number, d = 2): string => `${coma(N.mclk / div / 1e6, d)} MHz`;
const ns = (t: number): string => `${coma(t * 1e9, 1)} ns`;
const us = (t: number): string => `${coma(t * 1e6, 2)} µs`;
const hz = (): string => `${coma(N.mclk / (3420 * N.lineas), 2)} Hz`;

// ------------------------------------------------------------------ diagram

const base: Diagrama = {
  ancho: 1000,
  alto: 580,
  bloques: [
    { id: 'osc', x: 230, y: 14, w: 170, h: 54, titulo: 'Oscilador', sub: 'OSC1 · MCLK', foto: 'osc', esquema: ['OSC1'],
      actividad: [{ pista: 'MCLK', nivel: 1 }],
      info: 'Reloj maestro (MCLK). Lo reciben el VDP y el 315-5402/5433, que lo dividen para todo lo demás.' },
    { id: 'm68k', x: 20, y: 95, w: 175, h: 120, titulo: 'CPU 68000', sub: 'U1', foto: 'm68k', esquema: ['U1'],
      actividad: [{ pista: 'AS' }],
      info: 'CPU principal. Cada ciclo de bus son 4 relojes si /DTACK llega a tiempo. Cede el bus al VDP (DMA) y al Z80 (ventana) con /BR → /BG → /BGACK, y recibe VINT (nivel 6) y HINT (nivel 4) por /IPL1-/IPL2.' },
    { id: 'io', x: 230, y: 95, w: 175, h: 120, titulo: 'E/S y árbitro', sub: 'U4 · 315-5402 (VA5) / 315-5433 (VA6)', foto: 'io', esquema: ['U4'],
      actividad: [{ pista: 'CE0' }, { pista: 'IOSEL', nivel: 1 }, { pista: 'ZBR' }, { pista: 'BGACK' }],
      info: 'Decodifica el mapa del 68000, genera /DTACK, divide MCLK ÷ 7 (VCLK), lee los mandos, controla el bus y el reset del Z80 ($A11100, $A11200) y guarda el registro de banco de 9 bits con el que el Z80 ve 32 KB del espacio del 68000.' },
    { id: 'vdp', x: 470, y: 95, w: 190, h: 130, titulo: 'VDP 315-5313', sub: 'U8 · vídeo + PSG + DMA', foto: 'vdp', esquema: ['U8'],
      actividad: [{ pista: 'VDPSEL', nivel: 1 }, { pista: 'BR' }, { pista: 'IPL' }],
      info: 'Registros en $C00000–$C0001F. Genera el reloj del Z80 (÷ 15), refresca la RAM del 68000 (/RAS0, /CAS0), hace DMA desde el bus del 68000 y manda VINT/HINT al 68000 y /INT al Z80.' },
    { id: 'vram', x: 760, y: 95, w: 210, h: 72, titulo: 'VRAM 64 KB', sub: 'U9, U10 · DRAM de doble puerto', foto: 'vram', esquema: ['U9', 'U10'],
      actividad: [{ pista: 'VWR' }, { pista: 'SCK', nivel: 1 }],
      info: 'El VDP escribe por el puerto aleatorio (A0–A7 multiplexado con RAS/CAS) y lee líneas de tiles por el puerto serie (SD0–SD7, reloj SC), mucho más rápido.' },
    { id: 'av', x: 760, y: 200, w: 210, h: 66, titulo: 'Vídeo y audio', sub: 'U13 codificador · U12, U14', foto: 'enc', esquema: ['U13', 'U12', 'U14'],
      info: 'RGB y sincronismo del VDP a compuesto y RGB; mezcla del YM2612, el PSG y el audio del cartucho. El esquema lleva un Sony CXA1145; la VA6.8 PAL de la foto, un Fujitsu MB3514 de montaje superficial.' },
    { id: 'cart', x: 20, y: 330, w: 150, h: 66, titulo: 'Cartucho', sub: 'J3 · $000000–$3FFFFF', foto: 'cart', esquema: ['J3'], externo: true,
      actividad: [{ pista: 'CE0' }],
      info: 'ROM del juego en el bus del 68000 (16 bits). /CE0 la selecciona; la ROM no ve /UDS ni /LDS: siempre entrega la palabra entera.' },
    { id: 'wram', x: 185, y: 330, w: 150, h: 66, titulo: 'RAM 64 KB', sub: 'U2, U3 · $FF0000', foto: 'wram-h', esquema: ['U2', 'U3'],
      actividad: [{ pista: 'RAS0' }],
      info: 'Dos PSRAM de 32K × 8 (byte alto y bajo). El VDP genera /RAS0 y /CAS0 y su refresco; espejada en $E00000–$FFFFFF.' },
    { id: 'exp', x: 350, y: 330, w: 140, h: 66, titulo: 'Expansión', sub: 'J2 · Mega CD', foto: 'exp', esquema: ['J2'], externo: true,
      info: 'El bus del 68000 completo para el Mega CD en $400000–$7FFFFF.' },
    { id: 'z80', x: 470, y: 430, w: 160, h: 92, titulo: 'CPU Z80', sub: 'U6', foto: 'z80', esquema: ['U6'],
      actividad: [{ pista: 'ZA' }],
      info: 'Procesador de sonido: programa el YM2612 y el PSG. Puede leer y escribir el espacio del 68000 por la ventana $8000–$FFFF; mientras, espera con /WAIT.' },
    { id: 'zram', x: 650, y: 430, w: 130, h: 62, titulo: 'RAM del Z80', sub: 'U7 · 8 KB', foto: 'zram', esquema: ['U7'],
      actividad: [{ pista: 'ZRAM' }],
      info: '$0000–$1FFF del Z80; $A00000–$A01FFF para el 68000 cuando tiene el bus del Z80.' },
    { id: 'ym', x: 800, y: 430, w: 170, h: 62, titulo: 'YM2612', sub: 'U11 · FM 6 canales', foto: 'ym', esquema: ['U11'],
      actividad: [{ pista: 'YMSEL' }],
      info: 'En $4000–$4003 del Z80 ($A04000 del 68000). Su reloj es VCLK (MCLK ÷ 7).' },
    { id: 'mandos', x: 230, y: 470, w: 175, h: 56, titulo: 'Mandos y EXT', sub: 'J5, J6, J4 · $A10003–$A1000D', foto: 'pad1', esquema: ['J5', 'J6', 'J4'],
      actividad: [{ pista: 'IOSEL', nivel: 1 }],
      info: 'Tres puertos de 7 bits (PA, PB, PC) leídos por el 315-5402/5433; TH de un mando puede pedir la interrupción externa (nivel 2).' },
    { id: 'alim', x: 20, y: 470, w: 175, h: 56, titulo: 'Alimentación', sub: 'U15, U17 · 7805', foto: 'reg', esquema: ['U15', 'U17'],
      info: 'Dos reguladores lineales de 5 V.' },
  ],
  conexiones: [
    { id: 'mclk', puntos: [[315, 68], [315, 95]], bits: 1, etiqueta: 'MCLK', pos: [342, 82], clase: 'reloj', pista: 'MCLK', nivel: 1, red: 'MCLK' },
    { id: 'mclk-vdp', puntos: [[400, 40], [565, 40], [565, 95]], bits: 1, etiqueta: '', clase: 'reloj', pista: 'MCLK', nivel: 1 },
    { id: 'vclk', puntos: [[230, 120], [195, 120]], bits: 1, etiqueta: 'VCLK', pos: [212, 112], clase: 'reloj', pista: 'CLK68', nivel: 1, red: 'VCLK' },
    { id: 'zclk', puntos: [[640, 225], [640, 415], [550, 415], [550, 430]], bits: 1, etiqueta: 'ZCLK', pos: [668, 300], clase: 'reloj', pista: 'ZCLK', nivel: 1, red: 'ZCLK' },
    { id: 'ipl', puntos: [[470, 205], [440, 205], [440, 232], [108, 232], [108, 215]], bits: 2, etiqueta: '/IPL1, /IPL2', pos: [280, 226], clase: 'interrupcion', pista: 'IPL', nivel: 0, red: '~{IPL1}' },
    { id: 'br', puntos: [[470, 140], [430, 140], [430, 82], [140, 82], [140, 95]], bits: 1, etiqueta: '/BR', pos: [200, 76], clase: 'control', pista: 'BR', nivel: 0, red: '~{BR}' },
    { id: 'bg', puntos: [[195, 160], [230, 160]], bits: 1, etiqueta: '/BG', pos: [212, 152], clase: 'control', pista: 'BG', nivel: 0, red: '~{BG}' },
    { id: 'bus-a', puntos: [[20, 272], [700, 272]], bits: 23, etiqueta: 'VA1–VA23', pos: [610, 266], clase: 'bus', pista: 'A', valor: true, red: 'VA1' },
    { id: 'bus-d', puntos: [[20, 298], [700, 298]], bits: 16, etiqueta: 'VD0–VD15', pos: [620, 292], clase: 'dato', pista: 'D', valor: true, red: 'VD0' },
    { id: 'm68-a', puntos: [[50, 215], [50, 272]], bits: 23, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'm68-d', puntos: [[90, 215], [90, 298]], bits: 16, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'io-a', puntos: [[290, 215], [290, 272]], bits: 23, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'vdp-a', puntos: [[500, 225], [500, 272]], bits: 23, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'vdp-d', puntos: [[540, 225], [540, 298]], bits: 16, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'cart-a', puntos: [[60, 272], [60, 330]], bits: 23, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'cart-d', puntos: [[120, 298], [120, 330]], bits: 16, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'ram-a', puntos: [[220, 272], [220, 330]], bits: 15, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'ram-d', puntos: [[300, 298], [300, 330]], bits: 16, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'exp-a', puntos: [[380, 272], [380, 330]], bits: 23, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'exp-d', puntos: [[460, 298], [460, 330]], bits: 16, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'ce0', puntos: [[250, 215], [250, 318], [160, 318], [160, 330]], bits: 1, etiqueta: '/CE0', pos: [205, 312], clase: 'seleccion', pista: 'CE0', nivel: 0, red: '~{CE0}' },
    { id: 'ras0', puntos: [[600, 225], [600, 315], [320, 315], [320, 330]], bits: 1, etiqueta: '/RAS0, /CAS0', pos: [560, 322], clase: 'seleccion', pista: 'RAS0', nivel: 0, red: '~{RAS0}' },
    { id: 'vdpsel', puntos: [[405, 120], [470, 120]], bits: 1, etiqueta: 'VDP', pos: [437, 112], clase: 'seleccion', pista: 'VDPSEL', nivel: 1 },
    { id: 'dtack', puntos: [[230, 190], [195, 190]], bits: 1, etiqueta: '/DTACK', pos: [212, 200], clase: 'control', pista: 'DTACK', nivel: 0, red: '~{DTACK}' },
    { id: 'zbr', puntos: [[340, 215], [340, 410], [490, 410], [490, 430]], bits: 1, etiqueta: '/BUSREQ', pos: [395, 404], clase: 'control', pista: 'ZBR', nivel: 0 },
    { id: 'zbak', puntos: [[510, 430], [510, 418], [360, 418], [360, 215]], bits: 1, etiqueta: '/BUSACK', pos: [420, 424], clase: 'control', pista: 'ZBAK', nivel: 0, red: '~{ZBAK}' },
    { id: 'zwait', puntos: [[380, 215], [380, 312], [470, 312]], bits: 1, etiqueta: '', clase: 'control', pista: 'ZWAIT', nivel: 0 },
    { id: 'zbus', puntos: [[405, 540], [960, 540]], bits: 16, etiqueta: 'ZA0–ZA15', pos: [880, 534], clase: 'bus', pista: 'ZA', valor: true, red: 'ZA0' },
    { id: 'zdata', puntos: [[405, 560], [960, 560]], bits: 8, etiqueta: 'ZD0–ZD7', pos: [880, 554], clase: 'dato', pista: 'ZD', valor: true, red: 'ZD0' },
    { id: 'z-a', puntos: [[540, 522], [540, 540]], bits: 16, etiqueta: '', clase: 'bus', pista: 'ZA' },
    { id: 'zram-a', puntos: [[700, 492], [700, 540]], bits: 13, etiqueta: '', clase: 'bus', pista: 'ZA' },
    { id: 'ym-a', puntos: [[860, 492], [860, 540]], bits: 2, etiqueta: '', clase: 'bus', pista: 'ZA' },
    { id: 'io-z', puntos: [[395, 215], [395, 540], [405, 540]], bits: 16, etiqueta: '', clase: 'bus', pista: 'ZA' },
    { id: 'zint', puntos: [[620, 225], [620, 445], [630, 445]], bits: 1, etiqueta: '/INT', pos: [650, 380], clase: 'interrupcion', pista: 'ZINT', nivel: 0 },
    { id: 'vram-bus', puntos: [[660, 120], [760, 120]], bits: 8, etiqueta: 'A0–A7, RAS, CAS', pos: [710, 112], clase: 'bus', pista: 'VWR', nivel: 0 },
    { id: 'vram-sd', puntos: [[660, 150], [760, 150]], bits: 8, etiqueta: 'SD0–SD7, SC', pos: [710, 162], clase: 'dato', pista: 'SCK', nivel: 1 },
    { id: 'rgb', puntos: [[660, 215], [760, 215]], bits: 4, etiqueta: 'RGB, /SYNC', pos: [710, 207], clase: 'control' },
    { id: 'mandos', puntos: [[318, 470], [318, 215]], bits: 21, etiqueta: '', clase: 'control', pista: 'IOSEL', nivel: 1 },
  ],
};

const diagramas = new Map<string, Diagrama>();

/** The block diagram with the clock figures of a standard. */
export function diagramaDe(id: string): Diagrama {
  const n = id === 'ntsc' ? NORMAS.ntsc : NORMAS.pal;
  let d = diagramas.get(n.id);
  if (!d) {
    const f = (div: number) => `${coma(n.mclk / div / 1e6, 2)} MHz`;
    const subs: Record<string, string> = {
      osc: `OSC1 · MCLK ${coma(n.mclk / 1e6, 2)} MHz`,
      m68k: `U1 · ${f(7)}`,
      z80: `U6 · ${f(15)}`,
    };
    d = {
      ...base,
      bloques: base.bloques.map((b) =>
        b.id in subs ? { ...b, sub: subs[b.id]!, info: b.id === 'osc' ? `Reloj maestro (MCLK) ${n.nombre}: ${coma(n.mclk / 1e6, 6)} MHz, ${n.origen}. Lo reciben el VDP y el 315-5402/5433, que lo dividen para todo lo demás.` : b.info } : b,
      ),
    };
    diagramas.set(n.id, d);
  }
  return d;
}

// ------------------------------------------------------------------ decoding

interface Region {
  ini: number;
  fin: number;
  zona: string;
  sel: string | null;
  bloque: string | null;
  texto: (a: number, w: boolean) => string;
}

const MAPA68: Region[] = [
  { ini: 0x000000, fin: 0x3fffff, zona: 'Cartucho ($000000–$3FFFFF)', sel: '/CE0', bloque: 'cart',
    texto: () => 'El 315-5402/5433 baja /CE0 y la ROM del cartucho entrega la palabra; /DTACK lo genera el mismo chip sin esperas.' },
  { ini: 0x400000, fin: 0x7fffff, zona: 'Expansión ($400000–$7FFFFF)', sel: 'EXP', bloque: 'exp',
    texto: () => 'Zona del Mega CD (BIOS y RAM). Sin nada conectado, /DTACK no llega y el 68000 se quedaría esperando.' },
  { ini: 0xa00000, fin: 0xa0ffff, zona: 'Espacio del Z80 ($A00000–$A0FFFF)', sel: 'Z80', bloque: 'zram',
    texto: (a) => `Solo con el bus del Z80 cedido ($A11100). Es la dirección ${hex(a & 0xffff, 4)} del Z80: ${zonaZ80(a & 0xffff)}. El árbitro la pasa al bus ZA/ZD, de 8 bits.` },
  { ini: 0xa10000, fin: 0xa1001f, zona: 'E/S ($A10000–$A1001F)', sel: 'E/S', bloque: 'mandos',
    texto: (a) => `${['Versión (región, PAL/NTSC, expansión)', 'Datos del puerto 1', 'Datos del puerto 2', 'Datos del puerto EXT', 'Control del puerto 1', 'Control del puerto 2', 'Control del puerto EXT'][(a & 0x1f) >> 1] ?? 'Puertos serie'}: registro del 315-5402/5433 (en los bytes impares).` },
  { ini: 0xa11100, fin: 0xa11101, zona: 'Petición del bus del Z80 ($A11100)', sel: 'E/S', bloque: 'io',
    texto: (_a, w) => (w ? 'Escribir $0100 baja /BUSREQ del Z80; $0000 lo suelta.' : 'Al leer, el bit 0 vale 0 cuando el Z80 ya ha cedido el bus (/BUSACK bajo).') },
  { ini: 0xa11200, fin: 0xa11201, zona: 'Reset del Z80 ($A11200)', sel: 'E/S', bloque: 'io', texto: () => 'Escribir $0000 mantiene el Z80 (y el YM2612) en reset; $0100 lo suelta.' },
  { ini: 0xa13000, fin: 0xa130ff, zona: 'Registros del cartucho ($A130xx)', sel: '/TIME', bloque: 'cart', texto: () => '/TIME: el cartucho decide (RAM de partida, paginadores de los juegos grandes).' },
  { ini: 0xa14000, fin: 0xa14003, zona: 'TMSS ($A14000)', sel: 'E/S', bloque: 'io', texto: () => 'Solo desde la VA6 (315-5433): el juego escribe «SEGA» aquí para desbloquear el VDP.' },
  { ini: 0xc00000, fin: 0xdfffff, zona: 'VDP ($C00000–$C0001F, espejado)', sel: 'VDP', bloque: 'vdp',
    texto: (a) => `${['Datos', 'Datos', 'Control', 'Control', 'Contador HV', 'Contador HV', 'Contador HV', 'Contador HV', 'PSG', 'PSG'][(a & 0x1f) >> 1] ?? 'Sin uso'} del VDP. El VDP genera /DTACK.` },
  { ini: 0xe00000, fin: 0xffffff, zona: 'RAM de trabajo ($E00000–$FFFFFF)', sel: '/RAS0', bloque: 'wram',
    texto: (a) => `64 KB espejados en todo el bloque: ${hex(a, 6)} es ${hex(0xff0000 | (a & 0xffff), 6)}. El VDP genera /RAS0 y /CAS0; cada PSRAM da un byte.` },
];

function zonaZ80(a: number): string {
  if (a < 0x2000) return 'RAM del Z80';
  if (a < 0x4000) return 'espejo de la RAM';
  if (a < 0x6000) return 'YM2612';
  if (a < 0x6100) return 'registro de banco';
  if (a >= 0x7f00 && a < 0x7f20) return 'VDP (PSG en $7F11)';
  if (a >= 0x8000) return 'ventana al espacio del 68000';
  return 'sin uso';
}

export function decodificar(dir: number, escritura: boolean, espacio?: string): Decodificacion {
  if (espacio === 'z80') return decodificarZ80(dir & 0xffff, escritura);
  const a = dir & 0xfffffe;
  const r = MAPA68.find((x) => a >= x.ini && a <= x.fin);
  const tabla = MAPA68.map((x) => ({ etiqueta: `${hex(x.ini, 6)}–${hex(x.fin, 6)}: ${x.sel ?? '—'}`, valor: x === r ? 'activa' : '', activa: x === r }));
  if (!r) {
    return { direccion: dir, escritura, tabla, zona: 'Sin dispositivo', seleccion: null, bloque: null,
      texto: 'Ningún chip responde: sin /DTACK el 68000 espera para siempre (en la consola real se cuelga).' };
  }
  return { direccion: dir, escritura, tabla, zona: r.zona, seleccion: r.sel, bloque: r.bloque, texto: r.texto(dir, escritura),
    espejo: r.bloque === 'wram' ? hex(0xff0000 | (dir & 0xffff), 6) : undefined };
}

function decodificarZ80(a: number, w: boolean): Decodificacion {
  const z = zonaZ80(a);
  const tabla = [
    { etiqueta: '$0000–$1FFF RAM (/ZRAM)', valor: a < 0x4000 ? 'activa' : '', activa: a < 0x4000 },
    { etiqueta: '$4000–$5FFF YM2612 (/SOUND)', valor: a >= 0x4000 && a < 0x6000 ? 'activa' : '', activa: a >= 0x4000 && a < 0x6000 },
    { etiqueta: '$6000 banco', valor: a >= 0x6000 && a < 0x6100 ? 'activa' : '', activa: a >= 0x6000 && a < 0x6100 },
    { etiqueta: '$7F11 PSG (VDP)', valor: a >= 0x7f00 && a < 0x7f20 ? 'activa' : '', activa: a >= 0x7f00 && a < 0x7f20 },
    { etiqueta: '$8000–$FFFF ventana al 68000', valor: a >= 0x8000 ? 'activa' : '', activa: a >= 0x8000 },
  ];
  const base = { direccion: a, escritura: w, tabla };
  if (a < 0x4000) return { ...base, zona: 'RAM del Z80', seleccion: '/ZRAM', bloque: 'zram', espejo: hex(a & 0x1fff, 4), texto: `8 KB; ${hex(a, 4)} es ${hex(a & 0x1fff, 4)}.` };
  if (a < 0x6000) return { ...base, zona: 'YM2612 ($4000–$4003, espejado)', seleccion: '/SOUND', bloque: 'ym', espejo: hex(0x4000 + (a & 3), 4), texto: `${['Dirección de registro, parte I', 'Dato, parte I', 'Dirección de registro, parte II', 'Dato, parte II'][a & 3]} del YM2612.` };
  if (a < 0x6100) return { ...base, zona: 'Registro de banco ($6000)', seleccion: 'banco', bloque: 'io', texto: 'Cada escritura mete el bit 0 del dato en un registro de desplazamiento de 9 bits: nueve escrituras forman A15–A23 de la ventana.' };
  if (a >= 0x7f00 && a < 0x7f20) return { ...base, zona: 'VDP', seleccion: 'VDP', bloque: 'vdp', texto: a === 0x7f11 ? 'PSG (SN76489 dentro del VDP).' : 'Puertos del VDP vistos desde el Z80.' };
  if (a >= 0x8000) return { ...base, zona: 'Ventana al 68000 ($8000–$FFFF)', seleccion: '/BR (al 68000)', bloque: 'm68k', texto: `El árbitro pone al Z80 en espera, pide el bus del 68000 y lee en (banco × $8000) + ${hex(a & 0x7fff, 4)} del espacio del 68000.` };
  return { ...base, zona: z, seleccion: null, bloque: null, texto: 'Zona sin uso.' };
}

// ------------------------------------------------------------------ 68000 bus cycles

interface Ciclo68 {
  dir: number;
  escritura: boolean;
  dato: number;
  nota: string;
  esperas?: number;
}

function senales68(c: Cronograma): void {
  c.bit('MCLK', `MCLK ${mhz(1)}`, 1)
    .bit('CLK68', 'Reloj del 68000 (VCLK)', 1, `MCLK ÷ 7 = ${mhz(7)}`)
    .bus('A', 'VA23–VA1')
    .bus('D', 'VD15–VD0')
    .bit('AS', '/AS', 1)
    .bit('RW', 'R/W', 1)
    .bit('UDS', '/UDS, /LDS', 1)
    .bit('DTACK', '/DTACK', 1)
    .bit('CE0', '/CE0 (cartucho)', 1)
    .bit('RAS0', '/RAS0 (RAM)', 1)
    .bit('VDPSEL', 'VDP', 0)
    .bit('IOSEL', 'E/S (315-5433)', 0)
    .bus('SEL', 'Selección');
}

function ciclo68(c: Cronograma, t0: number, x: Ciclo68): number {
  const h = T68 / 2;
  const d = decodificar(x.dir, x.escritura);
  const w = (x.esperas ?? 0) * T68;
  const tAS = t0 + 2 * h;
  const tFin = t0 + 7 * h + w;
  const total = t0 + 4 * T68 + w;
  c.marca(t0);
  c.marca(tAS);
  c.set('A', t0 + h, hex(x.dir, 6));
  c.set('AS', tAS, 0);
  if (x.escritura) {
    c.set('RW', tAS, 0);
    c.set('D', t0 + 3 * h, hex(x.dato, 4));
    c.set('UDS', t0 + 4 * h, 0);
  } else c.set('UDS', tAS, 0);
  const sel = d.seleccion;
  const tSel = tAS + 25e-9;
  const pista = sel === '/CE0' ? 'CE0' : sel === '/RAS0' ? 'RAS0' : sel === 'VDP' ? 'VDPSEL' : sel === 'E/S' ? 'IOSEL' : null;
  if (pista) {
    c.set(pista, tSel, pista === 'VDPSEL' || pista === 'IOSEL' ? 1 : 0);
    c.set(pista, tFin + 20e-9, pista === 'VDPSEL' || pista === 'IOSEL' ? 0 : 1);
  }
  c.set('SEL', tSel, sel);
  c.set('SEL', tFin + 20e-9, null);
  // /DTACK must be low before the end of S4 for a cycle without waits
  c.set('DTACK', t0 + 4 * h + w - 15e-9, 0);
  c.set('DTACK', tFin + 15e-9, 1);
  if (!x.escritura) {
    c.set('D', t0 + 5 * h + w, hex(x.dato, 4));
  }
  c.set('AS', tFin, 1);
  c.set('UDS', tFin, 1);
  c.set('RW', tFin + h, 1);
  c.set('D', tFin + h, null);
  c.set('A', total, null);
  return total;
}

function ciclos68k(id: string, titulo: string, descripcion: string, lista: Ciclo68[]): Escenario {
  const c = new Cronograma();
  senales68(c);
  let t = 0;
  for (const x of lista) {
    const fin = ciclo68(c, t, x);
    c.paso(t, fin, `${x.escritura ? 'Escritura' : 'Lectura'} en ${hex(x.dir, 6)}: ${x.nota}`);
    t = fin;
  }
  c.reloj('CLK68', 0, t, T68, 4 / 7);
  c.reloj('MCLK', 0, t, TM, 0.5);
  c.marca(t);
  return {
    id, titulo, descripcion, duracion: t, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas,
    realPorSegundo: (4 * T68) / 2.5,
    defecto: ['CLK68', 'A', 'D', 'AS', 'RW', 'UDS', 'DTACK', 'CE0', 'RAS0', 'VDPSEL', 'IOSEL'],
    fidelidad:
      `Exacto (${N.nombre}): periodo del 68000 (${ns(T68)} = 7 periodos de MCLK), ciclo de 4 relojes (8 estados S0–S7) con /AS desde S2, /UDS-/LDS desde S2 al leer y desde S4 al escribir, /DTACK muestreado al final de S4 y dato capturado al entrar en S7 (manual de Motorola). Ilustrativo: el retardo de las selecciones (25 ns) y el instante exacto en que cada chip baja /DTACK.`,
  };
}

const PROGRAMA68: Ciclo68[] = [
  { dir: 0x000200, escritura: false, dato: 0x33fc, nota: 'código de MOVE.W #imm,(abs).L desde la ROM del cartucho (/CE0)' },
  { dir: 0x000202, escritura: false, dato: 0x8f02, nota: 'el dato inmediato' },
  { dir: 0x000204, escritura: false, dato: 0x00c0, nota: 'dirección, palabra alta' },
  { dir: 0x000206, escritura: false, dato: 0x0004, nota: 'dirección, palabra baja' },
  { dir: 0xc00004, escritura: true, dato: 0x8f02, nota: 'escritura en el puerto de control del VDP (registro 15 = 2)' },
  { dir: 0x000208, escritura: false, dato: 0x3039, nota: 'MOVE.W (abs).L,D0' },
  { dir: 0xff0010, escritura: false, dato: 0x1234, nota: 'lectura de la RAM de trabajo: el VDP genera /RAS0 y /CAS0' },
  { dir: 0xa10003, escritura: false, dato: 0x007f, nota: 'lectura del mando 1 en el 315-5433' },
];

function escenarioDecodificar(op: Opciones): Escenario {
  if (op.espacio === 'z80') return escenarioDecoZ80(op);
  const dir = Math.max(0, Math.min(0xffffff, parseInt(op.dir ?? '0', 16) || 0)) & 0xfffffe;
  const w = op.escritura === '1';
  const lista: Ciclo68[] = [
    { dir: 0x000300, escritura: false, dato: w ? 0x33c0 : 0x3039, nota: w ? 'MOVE.W D0,(abs).L' : 'MOVE.W (abs).L,D0' },
    { dir: 0x000302, escritura: false, dato: dir >> 16, nota: 'dirección, palabra alta' },
    { dir: 0x000304, escritura: false, dato: dir & 0xffff, nota: 'dirección, palabra baja' },
    { dir, escritura: w, dato: 0x5a5a, nota: decodificar(dir, w).zona },
  ];
  return ciclos68k('decodificar', `Acceso a ${hex(dir, 6)}`, 'Instrucción leída del cartucho y el acceso a la dirección elegida, con su selección.', lista);
}

function escenarioDecoZ80(op: Opciones): Escenario {
  const dir = Math.max(0, Math.min(0xffff, parseInt(op.dir ?? '0', 16) || 0));
  const w = op.escritura === '1';
  const c = new Cronograma();
  senalesZ80(c, mhz(15));
  c.bit('ZRAM', '/ZRAM', 1).bit('YMSEL', '/SOUND (YM2612)', 1).bus('SEL', 'Selección');
  const lista: CicloZ80[] = [
    { tipo: 'M1', dir: 0x0100, dato: w ? 0x32 : 0x3a, nota: w ? 'LD (nn),A' : 'LD A,(nn)' },
    { tipo: 'MR', dir: 0x0101, dato: dir & 0xff, nota: 'byte bajo' },
    { tipo: 'MR', dir: 0x0102, dato: dir >> 8, nota: 'byte alto' },
    { tipo: w ? 'MW' : 'MR', dir, dato: 0x5a, nota: decodificarZ80(dir, w).zona },
  ];
  let t = 0;
  let r = 1;
  for (const x of lista) {
    const { ini, fin, total } = cicloZ80(c, t, TZ, x, r++);
    const s = x.dir < 0x2000 ? 'ZRAM' : x.dir >= 0x4000 && x.dir < 0x6000 ? 'YMSEL' : null;
    if (s) {
      c.set(s, ini + 25e-9, 0);
      c.set(s, fin + 20e-9, 1);
    }
    c.set('SEL', ini, s === 'ZRAM' ? 'RAM' : s === 'YMSEL' ? 'YM2612' : x.dir >= 0x8000 ? 'ventana' : null);
    c.set('SEL', fin + 20e-9, null);
    c.paso(t, total, `${hex(x.dir, 4)}: ${x.nota}`);
    t = total;
  }
  c.reloj('CLK', 0, t, TZ, 0.5);
  c.marca(t);
  return {
    id: 'decodificar', titulo: `Z80: acceso a ${hex(dir, 4)}`, descripcion: 'Acceso del Z80 desde su propia RAM a la dirección elegida.',
    duracion: t, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: (4 * TZ) / 2.5,
    defecto: ['CLK', 'A', 'D', 'MREQ', 'RD', 'WR', 'ZRAM', 'YMSEL', 'SEL'],
    fidelidad: `Exacto (${N.nombre}): ciclos del Z80 a MCLK ÷ 15 (${ns(TZ)}). Ilustrativo: los retardos de /ZRAM y /SOUND.`,
  };
}

// ------------------------------------------------------------------ 68000 takes the Z80 bus

function escenarioBusreq(): Escenario {
  const c = new Cronograma();
  c.bit('CLK68', 'Reloj del 68000', 1)
    .bit('CLKZ', 'Reloj del Z80', 1)
    .bus('A', 'VA23–VA1')
    .bus('D', 'VD15–VD0')
    .bit('AS', '/AS', 1)
    .bit('ZBR', 'Z80 /BUSREQ', 1, 'Lo baja el 315-5433 al escribir $0100 en $A11100')
    .bit('ZBAK', 'Z80 /BUSACK', 1, 'El Z80 lo baja al acabar su ciclo de máquina')
    .bus('ZA', 'ZA15–ZA0', 'Bus del Z80')
    .bus('ZD', 'ZD7–ZD0')
    .bit('ZRAM', '/ZRAM', 1)
    .bus('Z80', 'Z80')
    .bus('M68', '68000');
  const h = T68 / 2;
  const cic = (t0: number, dir: number, w: boolean, dato: number) => {
    c.set('A', t0 + h, hex(dir, 6));
    c.set('AS', t0 + 2 * h, 0);
    c.set('D', t0 + (w ? 3 : 5) * h, hex(dato, 4));
    c.set('AS', t0 + 7 * h, 1);
    c.set('D', t0 + 8 * h, null);
    c.set('A', t0 + 8 * h, null);
    c.marca(t0);
    return t0 + 4 * T68;
  };
  // Z80 running M1 cycles from its RAM
  c.set('Z80', 0, 'ejecuta su programa');
  let t = cic(0, 0xa11100, true, 0x0100);
  const tReq = t - 2 * h;
  c.set('ZBR', tReq, 0);
  c.set('M68', 0, 'escribe $0100 en $A11100');
  // the Z80 finishes its current machine cycle (4 T) and grants
  const finZ = Math.ceil(tReq / (4 * TZ)) * 4 * TZ;
  const tAck = finZ + 0.5 * TZ;
  c.set('ZBAK', tAck, 0);
  c.set('Z80', tAck, 'cede el bus (alta impedancia)');
  for (let k = 0; k < Math.floor(finZ / (4 * TZ)); k++) {
    c.set('ZA', k * 4 * TZ, hex(0x0120 + k, 4));
    c.set('ZRAM', k * 4 * TZ + 0.5 * TZ, 0);
    c.set('ZRAM', k * 4 * TZ + 2 * TZ, 1);
  }
  c.set('ZA', finZ, null);
  c.marca(tReq);
  c.marca(tAck);
  c.paso(0, tAck, 'El 68000 escribe $0100 en $A11100: el 315-5433 baja /BUSREQ del Z80. El Z80 termina el ciclo de máquina en curso antes de ceder.');
  // 68000 polls bit 0
  c.set('M68', t, 'lee $A11100 hasta que el bit 0 = 0');
  while (t < tAck + 2 * T68) t = cic(t, 0xa11100, false, t < tAck ? 0x0001 : 0x0000);
  c.paso(tAck, t, 'Con /BUSACK bajo, la lectura de $A11100 devuelve el bit 0 a 0: el bus del Z80 es del 68000.');
  // 68000 writes the Z80 RAM through the arbiter
  const t1 = t;
  c.set('M68', t, 'escribe $C9 en $A00010');
  t = cic(t, 0xa00010, true, 0xc9c9);
  c.set('ZA', t1 + 2 * h + 20e-9, hex(0x0010, 4));
  c.set('ZD', t1 + 3 * h + 20e-9, '$C9');
  c.set('ZRAM', t1 + 2 * h + 40e-9, 0);
  c.set('ZRAM', t1 + 7 * h + 20e-9, 1);
  c.set('ZA', t1 + 8 * h, null);
  c.set('ZD', t1 + 8 * h, null);
  c.paso(t1, t, 'El árbitro traslada la escritura al bus del Z80: ZA = $0010, ZD = $C9 (el byte alto del 68000, porque la dirección es par) y /ZRAM.');
  const t2 = t;
  c.set('M68', t, 'escribe $0000 en $A11100');
  t = cic(t, 0xa11100, true, 0x0000);
  c.set('ZBR', t - 2 * h, 1);
  const tRel = Math.max(t, t - 2 * h + TZ);
  c.set('ZBAK', tRel, 1);
  c.set('Z80', tRel, 'sigue con su programa');
  c.paso(t2, tRel + 4 * TZ, 'Al escribir $0000 en $A11100 el Z80 recupera el bus y sigue donde estaba.');
  const fin = tRel + 4 * TZ;
  c.reloj('CLK68', 0, fin, T68, 4 / 7);
  c.reloj('CLKZ', 0, fin, TZ, 0.5);
  c.marca(fin);
  return {
    id: 'busreq', titulo: '68000 ↔ bus del Z80', descripcion: 'El 68000 pide el bus del Z80 para escribir en su RAM (por ejemplo, para cargarle el programa de sonido): BUSREQ, espera de BUSACK, escritura y devolución.',
    duracion: fin, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 10,
    defecto: ['CLK68', 'A', 'D', 'AS', 'ZBR', 'ZBAK', 'ZA', 'ZD', 'ZRAM', 'Z80', 'M68'],
    fidelidad: 'Exacto: los dos relojes (÷ 7 y ÷ 15 de MCLK), el protocolo de $A11100 (escribir $0100, leer el bit 0 hasta 0, escribir $0000) y que el Z80 solo cede al final de un ciclo de máquina. Ilustrativo: los ciclos de máquina del Z80 dibujados todos de 4 T y los retardos del árbitro.',
  };
}

// ------------------------------------------------------------------ Z80 reads the 68000 space through the window

function escenarioVentana(op: Opciones): Escenario {
  const banco = Number(op.bancoz ?? '0');
  const c = new Cronograma();
  senalesZ80(c, mhz(15));
  c.bit('BR', '/BR (al 68000)', 1).bit('BG', '/BG', 1).bit('BGACK', '/BGACK', 1)
    .bus('VA', 'VA23–VA1').bus('VD', 'VD15–VD0').bit('AS68', '/AS (árbitro)', 1).bit('CE0', '/CE0', 1)
    .bus('M68', '68000');
  const lista: CicloZ80[] = [
    { tipo: 'M1', dir: 0x0200, dato: 0x3a, nota: 'LD A,($8100)' },
    { tipo: 'MR', dir: 0x0201, dato: 0x00, nota: 'byte bajo' },
    { tipo: 'MR', dir: 0x0202, dato: 0x81, nota: 'byte alto' },
  ];
  let t = 0;
  let r = 1;
  for (const x of lista) {
    const { total } = cicloZ80(c, t, TZ, x, r++);
    c.paso(t, total, x.nota);
    t = total;
  }
  // window read with waits: illustrative 68000 hand-over
  const esperas = 10;
  const t0 = t;
  const { ini, total } = cicloZ80(c, t, TZ, { tipo: 'MR', dir: 0x8100, dato: 0x4e, nota: 'ventana', esperas, acceso: (esperas + 1.5) * TZ }, r++);
  const dir68 = banco * 0x8000 + 0x0100;
  c.set('BR', ini + 40e-9, 0);
  c.set('M68', 0, 'ejecuta su programa');
  const tBG = ini + 40e-9 + 3 * T68;
  c.set('BG', tBG, 0);
  c.set('M68', tBG, 'cede el bus');
  c.set('BGACK', tBG + T68, 0);
  c.set('BR', tBG + T68, 1);
  c.set('VA', tBG + 1.5 * T68, hex(dir68, 6));
  c.set('AS68', tBG + 2 * T68, 0);
  c.set('CE0', tBG + 2 * T68 + 25e-9, 0);
  c.set('VD', tBG + 3.5 * T68, '$4E75');
  c.set('AS68', tBG + 5.5 * T68, 1);
  c.set('CE0', tBG + 5.5 * T68 + 20e-9, 1);
  c.set('VD', tBG + 6 * T68, null);
  c.set('VA', tBG + 6 * T68, null);
  c.set('BGACK', tBG + 6 * T68, 1);
  c.set('BG', tBG + 6 * T68 + 20e-9, 1);
  c.set('M68', tBG + 6 * T68 + 20e-9, 'ejecuta su programa');
  c.marca(tBG);
  c.paso(t0, total, `Lectura de $8100 (ventana): el árbitro baja /WAIT del Z80 y pide el bus al 68000 (/BR). Cuando este termina su ciclo, contesta /BG; el árbitro toma el bus (/BGACK), pone la dirección (banco ${banco} × $8000 + $0100 = ${hex(dir68, 6)}) y /AS, el cartucho responde, el árbitro entrega el byte al Z80 y suelta /WAIT y el bus.`);
  t = total;
  c.reloj('CLK', 0, t, TZ, 0.5);
  c.marca(t);
  return {
    id: 'ventana', titulo: 'Z80 → ventana del 68000', descripcion: 'El Z80 lee el cartucho por su ventana de 32 KB ($8000–$FFFF): el árbitro lo detiene con /WAIT, toma prestado el bus del 68000 y forma la dirección con el registro de banco.',
    duracion: t, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: t / 10,
    defecto: ['CLK', 'A', 'MREQ', 'RD', 'WAIT', 'D', 'BR', 'BG', 'BGACK', 'VA', 'VD', 'CE0', 'M68'],
    fidelidad: 'Exacto: la secuencia /WAIT → /BR → /BG → /BGACK, la dirección (banco de 9 bits en VA15–VA23 y ZA0–ZA14) y que el Z80 espera con /WAIT. Ilustrativo: la duración de la espera (dibujada con 10 estados T); en la consola real depende de cuándo cede el bus el 68000 y es mayor si el VDP está haciendo DMA.',
  };
}

// ------------------------------------------------------------------ VDP DMA 68000 → VRAM

function escenarioDMA(op: Opciones): Escenario {
  const activa = op.zona === 'activa';
  const bytes = activa ? 18 : 205;
  const palabras = 6;
  const tPal = TL / (bytes / 2);
  const c = new Cronograma();
  c.bit('BR', '/BR', 1).bit('BG', '/BG', 1).bit('BGACK', '/BGACK', 1).bus('A', 'VA23–VA1 (VDP)').bus('D', 'VD15–VD0')
    .bit('AS', '/AS', 1).bit('CE0', '/CE0', 1).bit('VWR', 'VRAM: escritura', 1).bus('M68', '68000');
  const t0 = 0.3e-6;
  c.set('M68', 0, 'ejecuta su programa');
  c.set('BR', t0, 0);
  c.set('BG', t0 + 2 * T68, 0);
  c.set('M68', t0 + 2 * T68, 'detenido (sin bus)');
  c.set('BGACK', t0 + 3 * T68, 0);
  c.set('BR', t0 + 3 * T68, 1);
  c.marca(t0);
  c.paso(0, t0 + 3 * T68, 'El VDP pide el bus del 68000 (/BR); el 68000 acaba su ciclo y contesta /BG; el VDP lo toma con /BGACK.');
  let t = t0 + 4 * T68;
  for (let k = 0; k < palabras; k++) {
    const a = 0x012000 + 2 * k;
    c.set('A', t, hex(a, 6));
    c.set('AS', t + 0.5 * T68, 0);
    c.set('CE0', t + 0.5 * T68 + 25e-9, 0);
    c.set('D', t + 1.5 * T68, hex(0x1100 * (k + 1), 4));
    c.set('AS', t + 3 * T68, 1);
    c.set('CE0', t + 3 * T68 + 20e-9, 1);
    c.set('VWR', t + 3 * T68, 0);
    c.set('VWR', t + 3 * T68 + 4 * TM * 2, 1);
    c.set('D', t + 3.5 * T68, null);
    c.marca(t);
    c.paso(t, t + tPal, `Palabra ${k + 1}: el VDP lee ${hex(a, 6)} del cartucho y la escribe en la VRAM.`);
    t += tPal;
  }
  c.set('A', t, null);
  c.set('BGACK', t, 1);
  c.set('BG', t + 20e-9, 1);
  c.set('M68', t + 20e-9, 'sigue');
  c.paso(t, t + 4 * T68, 'Fin de la DMA: el VDP suelta /BGACK y el 68000 continúa.');
  const fin = t + 4 * T68;
  c.marca(fin);
  return {
    id: 'dma', titulo: 'DMA del VDP', descripcion: `DMA de la ROM a la VRAM ${activa ? 'durante la imagen visible' : 'en el borrado vertical'}: el VDP se queda con el bus del 68000 y copia palabras a ${bytes} bytes por línea (H40), mientras el 68000 está parado.`,
    duracion: fin, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 10,
    defecto: ['BR', 'BG', 'BGACK', 'A', 'D', 'AS', 'CE0', 'VWR', 'M68'],
    fidelidad: `Exacto: el reparto del bus (/BR → /BG → /BGACK) y el ritmo medio de ${bytes} bytes por línea de ${us(TL)} (genvdp.txt, H40; la cifra por línea es la misma en PAL y NTSC, pero PAL tiene más líneas de borrado). Ilustrativo: la forma de cada lectura del VDP (dibujada como un ciclo del 68000) y la duración de la escritura en la VRAM.`,
  };
}

// ------------------------------------------------------------------ frame

function escenarioCuadro(op: Opciones): Escenario {
  const n = Number(op.reg10 ?? '55');
  const c = new Cronograma();
  const nl = N.lineas;
  c.bus('LINEA', 'Línea').bit('ACTIVA', 'Zona activa', 1, '224 líneas').bit('HINT', 'HINT (nivel 4)', 1).bit('VINT', 'VINT (nivel 6)', 1)
    .bit('IPL', '/IPL1-/IPL2 (alguna baja)', 1).bit('ZINT', '/INT del Z80', 1).bus('M68', '68000');
  for (let l = 0; l < nl; l++) c.set('LINEA', l * TL, String(l));
  c.set('ACTIVA', 0, 1);
  c.set('ACTIVA', 224 * TL, 0);
  c.set('M68', 0, 'lógica del juego');
  for (let l = n; l < 224; l += n + 1) {
    const t = (l + 1) * TL - 30 * T68;
    c.set('HINT', t, 0);
    c.set('IPL', t, 0);
    c.set('HINT', t + 40 * T68, 1);
    c.set('IPL', t + 40 * T68, 1);
    c.set('M68', t, 'HINT: cambia el scroll');
    c.set('M68', t + 200 * T68, 'lógica del juego');
    c.marca(t);
  }
  const tv = 224 * TL;
  c.set('VINT', tv, 0);
  c.set('IPL', tv, 0);
  c.set('ZINT', tv, 0);
  c.set('ZINT', tv + TL, 1);
  c.set('VINT', tv + 60 * T68, 1);
  c.set('IPL', tv + 60 * T68, 1);
  c.set('M68', tv, 'VINT: DMA de sprites y paletas');
  c.set('M68', tv + 20 * TL, 'lógica del juego');
  c.marca(tv);
  c.paso(0, 224 * TL, `Líneas 0–223: imagen. Con el registro 10 = ${n}, HINT (nivel 4) cada ${n + 1} líneas.`);
  c.paso(tv, tv + TL, 'Línea 224: VINT (nivel 6) al 68000 y /INT al Z80, que lo mantiene durante una línea.');
  c.paso(tv + TL, nl * TL, 'Borrado vertical: es cuando se hace la DMA más rápida.');
  const fin = nl * TL;
  c.marca(fin);
  return {
    id: 'cuadro', titulo: 'Cuadro e interrupciones', descripcion: `Un cuadro ${N.nombre} de ${nl} líneas de ${us(TL)} (${hz()}) con 224 visibles. El VDP pide HINT (nivel 4) por el contador de líneas y VINT (nivel 6) al empezar el borrado; también interrumpe al Z80.`,
    duracion: fin, escala: 'ms', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 20, ventana: [200 * TL, nl * TL],
    defecto: ['LINEA', 'ACTIVA', 'HINT', 'VINT', 'IPL', 'ZINT', 'M68'],
    fidelidad: `Exacto: ${nl} líneas de 3420 MCLK (${N.nombre}), 224 visibles (modo V28; en PAL el modo V30 da 240), niveles 4 y 6, /IPL0 fijo a 5 V en el esquema (solo hay niveles 2, 4 y 6), /INT del Z80 en el VINT. Ilustrativo: cuándo reconoce el 68000 cada interrupción y cuánto tarda la rutina.`,
  };
}

// ------------------------------------------------------------------ clocks

function escenarioRelojes(): Escenario {
  const c = new Cronograma();
  const fin = 2 * 15 * TM;
  c.bit('MCLK', `MCLK ${mhz(1)}`, 1).bit('PIX', `Píxel H40 (÷ 8) ${mhz(8)}`, 1).bit('CLK68', `68000 / YM2612 (÷ 7) ${mhz(7)}`, 1)
    .bit('ZCLK', `Z80 / PSG (÷ 15) ${mhz(15)}`, 1);
  c.reloj('MCLK', 0, fin, TM);
  c.reloj('PIX', 0, fin, 8 * TM);
  c.reloj('CLK68', 0, fin, 7 * TM, 4 / 7);
  c.reloj('ZCLK', 0, fin, 15 * TM, 0.5);
  for (let k = 0; k <= 30; k++) c.marca(k * TM);
  c.paso(0, fin, 'Un solo cristal: el 315-5433 divide MCLK entre 7 para el 68000 y el YM2612 (VCLK); el VDP, entre 15 para el Z80 y el PSG (ZCLK) y entre 8 o 10 para el punto (EDCLK). Las tres CPU no tienen una relación entera sencilla: 7 y 15 solo coinciden cada 105 periodos de MCLK.');
  return {
    id: 'relojes', titulo: 'Relojes', descripcion: 'Todo sale de MCLK: ÷ 7, ÷ 8 (o ÷ 10) y ÷ 15.',
    duracion: fin, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 6,
    defecto: ['MCLK', 'PIX', 'CLK68', 'ZCLK'],
    fidelidad: `Exacto: ${coma(N.mclk / 1e6, 6)} MHz (${N.nombre}, ${N.origen}) y las divisiones ÷ 7, ÷ 8 y ÷ 15 (genvdp.txt; redes MCLK, VCLK, ZCLK y EDCK del esquema; OSC1 «53.2034 MHz» en la foto PAL). Ilustrativo: la fase relativa y el ciclo de trabajo de cada reloj.`,
  };
}

export const MEGADRIVE: Maquina = {
  id: 'megadrive',
  diagrama: diagramaDe('pal'),
  diagramaDe,
  variantes: [
    { id: 'pal', titulo: 'PAL · 50 Hz', nota: 'PAL, como la placa de la foto y la del esquema (OSC1 de 53,2034 MHz, puente JP3 «PAL»): MCLK 53,203424 MHz, 68000 a 7,60 MHz, Z80 a 3,55 MHz, 313 líneas de 64,28 µs (49,70 Hz).' },
    { id: 'ntsc', titulo: 'NTSC · 60 Hz', nota: 'NTSC (Japón y América, como la VA6 de EE. UU.): MCLK 53,693175 MHz, 68000 a 7,67 MHz, Z80 a 3,58 MHz, 262 líneas de 63,70 µs (59,92 Hz).' },
  ],
  digitos: 6,
  dirInicial: 'C00004',
  espacios: [
    { id: '68k', titulo: '68000', digitos: 6 },
    { id: 'z80', titulo: 'Z80', digitos: 4 },
  ],
  decodificar,
  escenarios: [
    { id: 'bus', titulo: 'Ciclos del 68000', crear: conNorma(() => ciclos68k('bus', 'Ciclos de bus del 68000', `Una instrucción que escribe en un registro del VDP, una lectura de la RAM y la del mando. Cada ciclo de bus son 4 relojes de ${ns(T68)} (${N.nombre}) si /DTACK llega a tiempo.`, PROGRAMA68)) },
    { id: 'decodificar', titulo: 'Decodificar una dirección', crear: conNorma(escenarioDecodificar) },
    { id: 'busreq', titulo: '68000 ↔ bus del Z80', crear: conNorma(escenarioBusreq) },
    { id: 'ventana', titulo: 'Z80 → ventana del 68000', crear: conNorma(escenarioVentana) },
    { id: 'dma', titulo: 'DMA del VDP', crear: conNorma(escenarioDMA) },
    { id: 'cuadro', titulo: 'Cuadro e interrupciones', crear: conNorma(escenarioCuadro) },
    { id: 'relojes', titulo: 'Relojes', crear: conNorma(escenarioRelojes) },
  ],
  ejemplos: [
    { dir: 0x000200, escritura: false, texto: 'cartucho', espacio: '68k' },
    { dir: 0xff0010, escritura: true, texto: 'RAM', espacio: '68k' },
    { dir: 0xe00010, escritura: false, texto: 'espejo', espacio: '68k' },
    { dir: 0xc00004, escritura: true, texto: 'VDP control', espacio: '68k' },
    { dir: 0xa10003, escritura: false, texto: 'mando 1', espacio: '68k' },
    { dir: 0xa11100, escritura: true, texto: 'BUSREQ', espacio: '68k' },
    { dir: 0xa04000, escritura: true, texto: 'YM2612', espacio: '68k' },
    { dir: 0x4001, escritura: true, texto: 'YM2612', espacio: 'z80' },
    { dir: 0x6000, escritura: true, texto: 'banco', espacio: 'z80' },
    { dir: 0x8100, escritura: false, texto: 'ventana', espacio: 'z80' },
  ],
  opciones: [
    { id: 'bancoz', titulo: 'Banco de la ventana', escenarios: ['ventana'], valores: [{ v: '0', texto: '0 ($000000)' }, { v: '4', texto: '4 ($020000)' }, { v: '127', texto: '127 ($3F8000)' }] },
    { id: 'zona', titulo: 'Momento', escenarios: ['dma'], valores: [{ v: 'borrado', texto: 'Borrado (205 B/línea)' }, { v: 'activa', texto: 'Imagen visible (18 B/línea)' }] },
    { id: 'reg10', titulo: 'Registro 10', escenarios: ['cuadro'], valores: [{ v: '55', texto: '55 (cada 56 líneas)' }, { v: '111', texto: '111' }, { v: '15', texto: '15' }] },
  ],
};
