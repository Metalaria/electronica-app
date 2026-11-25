// Sega Saturn, model-1 main board VA0.5 (RGBeter's reproduction) plus the SH-1 board of the CD block: block diagram,
// SH-2 address decoding and the timed scenarios.
//
// Timing figures:
//   - clocks (Sega «SMPC User's Manual» ST-169-R1, «DOT SEL» status; «Saturn Overview Manual» ST-103-R1, table 2.1):
//     the PLL (315-5746, IC20) runs the SH-2s, VDP1 and VDP2 at 26.8741 MHz NTSC / 26.6875 MHz PAL in the 320-dot
//     mode and 28.6364 / 28.4375 MHz in the 352-dot mode (SMPC command CKCHG352; DOTSEL from the SMPC to the PLL in
//     the schematic); 68EC000 11.3 MHz; SCSP master clock 512 fs = 22.58 MHz (PAL service manual, IC17 pin 14 «MACK»);
//     SH-1 of the CD block 20 MHz (X101, sheet 7); SMPC 4 MHz (X3). The board shown is Japanese: X1 14.31818 MHz
//     (NTSC); the PAL board fits a 17.7344 MHz crystal (service manual parts list) and the NTSC/PAL jumper.
//   - SH-2 bus cycle (Hitachi SH7604 hardware manual, basic bus cycle): two states T1, T2 of CKIO plus the wait
//     states the selected device asks for with /WAIT; the device delays drawn here are illustrative where stated.
//   - memory map: SCU User's Manual ST-097-R5, figure 1.3 (cache addresses; +$20000000 = cache-through); SH-2 areas
//     (SH7604 manual, table 7.3): CS0 $00000000-$01FFFFFF, CS1 $02000000-, CS2 $04000000-, CS3 $06000000-; chip
//     selects from the schematic: /CS0 of the SH-2s goes to the 315-5778 (ROM, SMPC, backup RAM, WORK RAM-L), /CS3
//     to the WORK RAM-H SDRAMs, /CS1 and /CS2 to the SCU (A-bus and B-bus).
//   - MINIT/SINIT: «Dual CPU User's Guide» ST-202-R1 (16-bit write to $21000000 → FRT input capture of the slave,
//     $21800000 → of the master); SMPC registers on odd bytes ($20100001 IREG0 … $2010001F COMREG, ST-169).
//   - interrupts (ST-097, table 2.1): V-Blank-IN level F (vector $40), V-Blank-OUT level E ($41), H-Blank-IN level D
//     ($42), from the VDP2 (/VINT, /HINT → SCU /IRQV, /IRQH) to the master SH-2 by /IRL1–/IRL3 of the SCU.
//   - video: 224 visible lines (VDP2 manual ST-058: 224, 240 or 256 in PAL); lines per frame and line period from
//     the TV standards (NTSC 263 lines of 63.6 µs, PAL 313 of 64 µs): illustrative to the microsecond.

import { Cronograma, hex, type Escenario } from './modelo';
import type { Decodificacion, Diagrama, Maquina, Opciones } from './diagrama';

export interface Norma {
  id: 'ntsc' | 'pal';
  nombre: string;
  /** SH-2 / VDP clock in the 320-dot and 352-dot modes (Hz). */
  f320: number;
  f352: number;
  cristal: string;
  lineas: number;
  linea: number;
}

export const NORMAS: Record<'ntsc' | 'pal', Norma> = {
  ntsc: { id: 'ntsc', nombre: 'NTSC', f320: 26.8741e6, f352: 28.6364e6, cristal: '14,31818 MHz', lineas: 263, linea: 63.56e-6 },
  pal: { id: 'pal', nombre: 'PAL', f320: 26.6875e6, f352: 28.4375e6, cristal: '17,7344 MHz', lineas: 313, linea: 64e-6 },
};

let N: Norma = NORMAS.ntsc;
let TC = 1 / N.f352; // SH-2 CKIO period in the 352 mode (34.9 ns NTSC)

function fijarNorma(id: string | undefined): void {
  N = id === 'pal' ? NORMAS.pal : NORMAS.ntsc;
  TC = 1 / N.f352;
}

function conNorma(f: (op: Opciones) => Escenario): (op: Opciones) => Escenario {
  return (op) => {
    fijarNorma(op.norma);
    return f(op);
  };
}

const coma = (x: number, d: number): string => x.toFixed(d).replace('.', ',');
const mhz = (f: number, d = 4): string => `${coma(f / 1e6, d)} MHz`;
const ns = (t: number): string => `${coma(t * 1e9, 1)} ns`;
const us = (t: number): string => `${coma(t * 1e6, 2)} µs`;

// ------------------------------------------------------------------ diagram

const base: Diagrama = {
  ancho: 1000,
  alto: 600,
  bloques: [
    { id: 'pll', x: 20, y: 14, w: 140, h: 62, titulo: 'Relojes', sub: 'X1 · PLL 315-5746 (IC20)', foto: 'pll', esquema: ['IC20', 'X1'],
      actividad: [{ pista: 'CLK', nivel: 1 }],
      info: 'El PLL multiplica el cristal X1 y da el reloj de las SH-2, del VDP1 y del VDP2 (dos frecuencias: modo de 320 o de 352 puntos, que elige el SMPC con DOTSEL), el de la SCSP y el del 68EC000.' },
    { id: 'sh2m', x: 180, y: 14, w: 140, h: 84, titulo: 'SH-2 maestra', sub: 'IC1', foto: 'sh2m', esquema: ['IC1'],
      actividad: [{ pista: 'MAESTRA', nivel: 1 }],
      info: 'CPU RISC de 32 bits con 4 KB de caché. Arranca en la ROM ($00000000) y es la única que recibe las interrupciones de la SCU (/IRL1–/IRL3). Bus de 27 bits de dirección y 32 de datos, compartido con la esclava.' },
    { id: 'sh2s', x: 340, y: 14, w: 140, h: 84, titulo: 'SH-2 esclava', sub: 'IC2', foto: 'sh2s', esquema: ['IC2'],
      actividad: [{ pista: 'ESCLAVA', nivel: 1 }],
      info: 'La misma CPU en modo esclavo: el SMPC la mantiene en reset hasta que el programa la enciende (orden SSHON). Pide el bus a la maestra para cada acceso que no resuelve su caché.' },
    { id: 'wramh', x: 500, y: 14, w: 130, h: 62, titulo: 'WORK RAM-H', sub: '1 MB SDRAM · IC3, IC4', foto: 'wramh', esquema: ['IC3', 'IC4'],
      actividad: [{ pista: 'CS3' }],
      info: 'La RAM rápida ($06000000): SDRAM con su propia selección /CS3 de las SH-2. La SCU también la lee y escribe con su DMA.' },
    { id: 'scu', x: 660, y: 14, w: 150, h: 120, titulo: 'SCU', sub: '315-5688 (IC5)', foto: 'scu', esquema: ['IC5'],
      actividad: [{ pista: 'CS2' }, { pista: 'IRL' }],
      info: 'Une el bus de la CPU con el bus A (cartucho y CD) y el bus B (VDP1, VDP2 y SCSP). Lleva tres canales de DMA, un DSP de cálculo y el controlador de interrupciones: convierte las peticiones de los VDP, la SCSP y el SMPC en un nivel en /IRL1–/IRL3 de la SH-2 maestra.' },
    { id: 'cart', x: 845, y: 14, w: 145, h: 50, titulo: 'Cartucho', sub: 'CN1 · bus A, CS0/CS1', foto: 'cart', esquema: ['CN1'], externo: true,
      actividad: [{ pista: 'ACS0' }],
      info: 'Cartuchos de memoria de respaldo o de RAM en las zonas CS0 ($02000000) y CS1 ($04000000) del bus A.' },
    { id: 'ygr', x: 845, y: 76, w: 70, h: 64, titulo: 'YGR019', sub: 'SH1-IC103', foto: 'ygr', esquema: ['SH1-IC103'], externo: true,
      actividad: [{ pista: 'ACS2' }],
      info: 'Matriz de puertas del bloque de CD (en la placa SH-1): recibe los datos serie de la unidad, los guarda en el búfer y los ofrece a las SH-2 por la zona CS2 del bus A. Avisa al SH-1 con SIRQL y SIRQH.' },
    { id: 'sh1', x: 920, y: 76, w: 70, h: 64, titulo: 'SH-1', sub: 'SH1-IC101 · 20 MHz', foto: 'sh1', esquema: ['SH1-IC101'], externo: true,
      info: 'El procesador del bloque de CD, con su programa en ROM interna: manda a la unidad por COMCLK/HDATA/CDATA, comprueba el disco y atiende las órdenes de las SH-2 a través del YGR019.' },
    { id: 'cdbuf', x: 845, y: 150, w: 70, h: 50, titulo: 'Búfer', sub: '512 KB · SH1-IC102', foto: 'b-cdbuf', esquema: ['SH1-IC102'], externo: true,
      info: 'DRAM HM514260 donde el YGR019 y el SH-1 guardan los sectores leídos.' },
    { id: 'cd', x: 920, y: 150, w: 70, h: 50, titulo: 'Unidad de CD', sub: 'E102 · E101/CN4', foto: 'cdconn', esquema: ['SH1-E102', 'CN4'], externo: true,
      info: 'La unidad de CD de doble velocidad se une a la placa SH-1 por E102 (datos y audio serie, órdenes); la placa SH-1, a la principal por E101/CN4 (bus A, audio del CD, vídeo MPEG).' },
    { id: 'dcc', x: 20, y: 180, w: 150, h: 62, titulo: 'Controlador', sub: '315-5778 (IC6)', foto: 'dcc', esquema: ['IC6'],
      actividad: [{ pista: 'CS0' }],
      info: 'Recibe /CS0 de las SH-2 y lo reparte: /ROMCE para la ROM, /SMPCCE para el SMPC, /SRAMCE para la RAM de respaldo y /DRAS0–/DRAS1, /DUCAS, /DLCAS para la WORK RAM-L, que direcciona por filas y columnas (DA0–DA8). Los 74LS245 separan este bus lento del de la CPU.' },
    { id: 'ipl', x: 20, y: 290, w: 110, h: 58, titulo: 'ROM 512 KB', sub: 'IC7 · $00000000', foto: 'ipl', esquema: ['IC7'],
      actividad: [{ pista: 'ROMCE' }],
      info: 'La ROM de arranque (IPL): pantalla de Sega, comprobación del disco, gestor de partidas y bibliotecas.' },
    { id: 'bram', x: 140, y: 290, w: 110, h: 58, titulo: 'Respaldo 32 KB', sub: 'IC8 · $00180000', foto: 'bram', esquema: ['IC8'],
      actividad: [{ pista: 'SRAMCE' }],
      info: 'SRAM con pila para las partidas, vista en los bytes impares de $00180000–$0018FFFF.' },
    { id: 'smpc', x: 260, y: 290, w: 110, h: 70, titulo: 'SMPC', sub: '315-5744 (IC9) · 4 MHz', foto: 'smpc', esquema: ['IC9'],
      actividad: [{ pista: 'SMPCCE' }],
      info: 'Microcontrolador de 4 bits: reset de toda la consola (SYSRES), de la SH-2 esclava y del 68EC000, NMI de la maestra, los mandos, el reloj de tiempo real y DOTSEL para el PLL. Las SH-2 le dan órdenes por sus registros en $00100000.' },
    { id: 'wraml', x: 380, y: 290, w: 100, h: 58, titulo: 'WORK RAM-L', sub: '1 MB · IC31, IC32', foto: 'wraml', esquema: ['IC31', 'IC32'],
      actividad: [{ pista: 'DRAS' }],
      info: 'DRAM normal en $00200000, más lenta que la WORK RAM-H.' },
    { id: 'pads', x: 260, y: 380, w: 110, h: 42, titulo: 'Mandos', sub: 'CN2A, CN2B', foto: 'mandos', esquema: ['CN2A1', 'CN2B1'],
      info: 'Dos puertos de mando con siete líneas cada uno, leídos por el SMPC.' },
    { id: 'alim', x: 20, y: 470, w: 180, h: 62, titulo: 'Alimentación', sub: 'CN3 · +9 V, +5 V, +3,3 V', foto: 'alim', esquema: ['CN3', 'IC34'],
      info: 'La fuente interna da +9 V (unidad de CD y PLL), +5 V (VCC, todos los chips salvo la SDRAM) y +3,3 V (LVCC, la SDRAM), según el diagrama de bloques del manual de servicio de Sega.' },
    { id: 'av', x: 240, y: 470, w: 200, h: 62, titulo: 'Vídeo y audio', sub: 'CXA1645 (IC21) · TDA1386 (IC22)', foto: 'enc', esquema: ['IC21', 'IC22', 'CN5'],
      actividad: [{ pista: 'RGB' }],
      info: 'El codificador convierte el RGB y el sincronismo del VDP2 en vídeo compuesto y S-vídeo; el DAC convierte el audio serie de la SCSP. Salen por el conector de A/V (CN5).' },
    { id: 'vdp1', x: 500, y: 430, w: 150, h: 58, titulo: 'VDP1', sub: '315-5689 (IC10)', foto: 'vdp1', esquema: ['IC10'],
      actividad: [{ pista: 'BCS1' }],
      info: 'Lee una lista de órdenes de su VRAM y dibuja sprites y polígonos en uno de los dos búferes de imagen; al acabar el cuadro los intercambia y el VDP2 lee el que está terminado.' },
    { id: 'vram1', x: 500, y: 510, w: 150, h: 62, titulo: 'VRAM 512 KB + 2 × 256 KB', sub: 'IC11 · IC12, IC13', foto: 'b-vram', esquema: ['IC11', 'IC12', 'IC13'],
      info: 'SDRAM del VDP1: la VRAM con las órdenes y texturas y los dos búferes de imagen.' },
    { id: 'vdp2', x: 670, y: 430, w: 150, h: 58, titulo: 'VDP2', sub: '315-5690 (IC14)', foto: 'vdp2', esquema: ['IC14'],
      actividad: [{ pista: 'BCS2' }, { pista: 'VINT' }],
      info: 'Compone la imagen al ritmo del barrido: hasta cinco planos de fondo con su prioridad, mezclados con el búfer del VDP1, y el color de su CRAM. Saca RGB y sincronismos, y pide las interrupciones de borrado al SCU.' },
    { id: 'vram2', x: 670, y: 510, w: 150, h: 62, titulo: 'VRAM 512 KB', sub: 'IC15, IC16 · bancos A y B', foto: 'b-vram2', esquema: ['IC15', 'IC16'],
      info: 'Dos bancos de SDRAM que el VDP2 lee a la vez en cada ciclo de punto para los distintos planos.' },
    { id: 'scsp', x: 840, y: 430, w: 150, h: 58, titulo: 'SCSP', sub: '315-5687 (IC17)', foto: 'scsp', esquema: ['IC17'],
      actividad: [{ pista: 'BCSS' }],
      info: 'Sonido de Yamaha: 32 canales PCM/FM y un DSP de efectos. Gobierna la RAM de sonido y el bus del 68EC000, mezcla el audio del CD y saca el audio digital hacia el DAC.' },
    { id: 'm68k', x: 840, y: 510, w: 70, h: 62, titulo: '68EC000', sub: 'IC18 · 11,3 MHz', foto: 'm68k', esquema: ['IC18'],
      info: 'Ejecuta el programa de sonido desde la RAM de sonido y programa la SCSP. El SMPC lo tiene en reset hasta que el juego lo enciende.' },
    { id: 'sram', x: 920, y: 510, w: 70, h: 62, titulo: 'RAM sonido', sub: 'IC19 · 512 KB', foto: 'b-snd', esquema: ['IC19'],
      info: 'DRAM de 4 Mbit compartida por la SCSP y el 68EC000; las SH-2 la ven en $05A00000.' },
  ],
  conexiones: [
    { id: 'clk', puntos: [[160, 40], [180, 40]], bits: 1, etiqueta: 'CKIO', pos: [170, 30], clase: 'reloj', pista: 'CLK', nivel: 1, red: 'MCLK3' },
    { id: 'clk-s', puntos: [[90, 76], [90, 106], [340, 106], [340, 90]], bits: 1, etiqueta: '', clase: 'reloj', pista: 'CLK', nivel: 1 },
    { id: 'bus-a', puntos: [[20, 150], [740, 150]], bits: 27, etiqueta: 'CA1–CA26', pos: [600, 144], clase: 'bus', pista: 'A', valor: true, red: 'CA1' },
    { id: 'bus-d', puntos: [[20, 166], [740, 166]], bits: 32, etiqueta: 'CD0–CD31', pos: [600, 160], clase: 'dato', pista: 'D', valor: true, red: 'CD0' },
    { id: 'm-a', puntos: [[220, 98], [220, 150]], bits: 27, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'm-d', puntos: [[260, 98], [260, 166]], bits: 32, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 's-a', puntos: [[380, 98], [380, 150]], bits: 27, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 's-d', puntos: [[420, 98], [420, 166]], bits: 32, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'h-a', puntos: [[540, 76], [540, 150]], bits: 20, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'h-d', puntos: [[590, 76], [590, 166]], bits: 32, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'cs3', puntos: [[300, 98], [300, 124], [565, 124], [565, 76]], bits: 1, etiqueta: '/CS3', pos: [480, 118], clase: 'seleccion', pista: 'CS3', nivel: 0, red: 'CCS3' },
    { id: 'scu-a', puntos: [[700, 134], [700, 150]], bits: 27, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'scu-d', puntos: [[730, 134], [730, 166]], bits: 32, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'cs2', puntos: [[320, 60], [660, 60]], bits: 1, etiqueta: '/CS1, /CS2', pos: [620, 54], clase: 'seleccion', pista: 'CS2', nivel: 0, red: 'CCS2' },
    { id: 'irl', puntos: [[660, 100], [640, 100], [640, 84], [320, 84]], bits: 3, etiqueta: '/IRL1–/IRL3', pos: [600, 94], clase: 'interrupcion', pista: 'IRL', nivel: 0, red: 'CIRL1' },
    { id: 'abus', puntos: [[810, 40], [830, 40], [830, 230]], bits: 16, etiqueta: 'bus A', pos: [812, 220], clase: 'bus', pista: 'AB', valor: true, red: 'AD0' },
    { id: 'a-cart', puntos: [[830, 40], [845, 40]], bits: 16, etiqueta: '', clase: 'bus', pista: 'AB' },
    { id: 'a-ygr', puntos: [[830, 108], [845, 108]], bits: 16, etiqueta: '', clase: 'bus', pista: 'AB' },
    { id: 'acs2', puntos: [[810, 124], [822, 124], [822, 132], [845, 132]], bits: 1, etiqueta: '/ACS2', pos: [800, 140], clase: 'seleccion', pista: 'ACS2', nivel: 0, red: 'ACS2' },
    { id: 'cd-ser', puntos: [[955, 150], [955, 140]], bits: 8, etiqueta: '', clase: 'dato' },
    { id: 'ygr-sh1', puntos: [[915, 108], [920, 108]], bits: 16, etiqueta: '', clase: 'bus' },
    { id: 'ygr-buf', puntos: [[880, 140], [880, 150]], bits: 16, etiqueta: '', clase: 'dato' },
    { id: 'dcc-c', puntos: [[95, 166], [95, 180]], bits: 32, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'cs0', puntos: [[200, 98], [200, 120], [140, 120], [140, 180]], bits: 1, etiqueta: '/CS0', pos: [150, 114], clase: 'seleccion', pista: 'CS0', nivel: 0, red: 'CCS0' },
    { id: 'bus-l', puntos: [[20, 270], [480, 270]], bits: 16, etiqueta: 'ECA, ECD', pos: [440, 264], clase: 'bus', pista: 'EA', valor: true, red: 'ECA1' },
    { id: 'dcc-l', puntos: [[95, 242], [95, 270]], bits: 16, etiqueta: '', clase: 'bus', pista: 'EA' },
    { id: 'l-ipl', puntos: [[75, 270], [75, 290]], bits: 16, etiqueta: '', clase: 'bus', pista: 'EA' },
    { id: 'l-bram', puntos: [[195, 270], [195, 290]], bits: 8, etiqueta: '', clase: 'bus', pista: 'EA' },
    { id: 'l-smpc', puntos: [[315, 270], [315, 290]], bits: 8, etiqueta: '', clase: 'bus', pista: 'EA' },
    { id: 'l-wraml', puntos: [[430, 270], [430, 290]], bits: 16, etiqueta: '', clase: 'bus', pista: 'EA' },
    { id: 'romce', puntos: [[40, 242], [40, 290]], bits: 1, etiqueta: '/ROMCE', pos: [46, 256], clase: 'seleccion', pista: 'ROMCE', nivel: 0, red: 'ROMCE' },
    { id: 'dras', puntos: [[170, 225], [455, 225], [455, 290]], bits: 2, etiqueta: '/DRAS0, /DRAS1', pos: [330, 219], clase: 'seleccion', pista: 'DRAS', nivel: 0, red: 'DRAS0' },
    { id: 'smpcce', puntos: [[170, 205], [345, 205], [345, 290]], bits: 1, etiqueta: '/SMPCCE', pos: [260, 199], clase: 'seleccion', pista: 'SMPCCE', nivel: 0, red: 'SMPCCE' },
    { id: 'sramce', puntos: [[170, 248], [230, 248], [230, 290]], bits: 1, etiqueta: '', clase: 'seleccion', pista: 'SRAMCE', nivel: 0, red: 'SRAMCE' },
    { id: 'pads', puntos: [[315, 360], [315, 380]], bits: 14, etiqueta: '', clase: 'control' },
    { id: 'dotsel', puntos: [[370, 325], [490, 325], [490, 196], [170, 196], [170, 76]], bits: 1, etiqueta: 'DOTSEL', pos: [440, 319], clase: 'control', red: 'DOTSEL' },
    { id: 'bbus-scu', puntos: [[780, 134], [780, 410]], bits: 16, etiqueta: '', clase: 'bus', pista: 'BD' },
    { id: 'bbus', puntos: [[540, 410], [990, 410]], bits: 16, etiqueta: 'BD0–BD15 (bus B)', pos: [880, 404], clase: 'bus', pista: 'BD', valor: true, red: 'BD0' },
    { id: 'b-vdp1', puntos: [[575, 410], [575, 430]], bits: 16, etiqueta: '', clase: 'bus', pista: 'BD' },
    { id: 'b-vdp2', puntos: [[745, 410], [745, 430]], bits: 16, etiqueta: '', clase: 'bus', pista: 'BD' },
    { id: 'b-scsp', puntos: [[915, 410], [915, 430]], bits: 16, etiqueta: '', clase: 'bus', pista: 'BD' },
    { id: 'bcs2', puntos: [[795, 134], [795, 420], [800, 420], [800, 430]], bits: 1, etiqueta: '/BCS1, /BCS2, /BCSS', pos: [870, 395], clase: 'seleccion', pista: 'BCS2', nivel: 0, red: 'BCS2' },
    { id: 'vint', puntos: [[810, 430], [810, 300], [760, 300], [760, 134]], bits: 2, etiqueta: '/VINT, /HINT', pos: [700, 296], clase: 'interrupcion', pista: 'VINT', nivel: 0, red: 'IRQV' },
    { id: 'vram1-bus', puntos: [[575, 488], [575, 510]], bits: 16, etiqueta: 'VRA, VRD, F0, F1', pos: [520, 500], clase: 'bus', pista: 'VR1' },
    { id: 'fb', puntos: [[650, 540], [660, 540], [660, 470], [670, 470]], bits: 16, etiqueta: 'FBD', pos: [652, 462], clase: 'dato', pista: 'FB', red: 'FBD0' },
    { id: 'vram2-bus', puntos: [[745, 488], [745, 510]], bits: 32, etiqueta: 'RAA/RAD, RBA/RBD', pos: [748, 500], clase: 'bus', pista: 'VR2', valor: true },
    { id: 'snd-bus', puntos: [[875, 488], [875, 510]], bits: 16, etiqueta: '', clase: 'bus' },
    { id: 'snd-ram', puntos: [[955, 488], [955, 510]], bits: 16, etiqueta: 'MA, MD', pos: [958, 500], clase: 'bus' },
    { id: 'rgb', puntos: [[700, 488], [700, 590], [440, 590], [440, 532]], bits: 3, etiqueta: 'RGB, CSYNC', pos: [560, 584], clase: 'control', pista: 'RGB', red: 'RED' },
    { id: 'audio', puntos: [[990, 460], [995, 460], [995, 596], [330, 596], [330, 532]], bits: 3, etiqueta: 'audio serie', pos: [880, 592], clase: 'dato', red: 'DSO' },
  ],
};

const diagramas = new Map<string, Diagrama>();

export function diagramaDe(id: string): Diagrama {
  const n = id === 'pal' ? NORMAS.pal : NORMAS.ntsc;
  let d = diagramas.get(n.id);
  if (!d) {
    d = {
      ...base,
      bloques: base.bloques.map((b) =>
        b.id === 'pll'
          ? { ...b, sub: `X1 ${n.cristal} · IC20`, info: `${b.info} ${n.nombre}: cristal de ${n.cristal}; SH-2 y VDP a ${mhz(n.f320)} (320 puntos) o ${mhz(n.f352)} (352 puntos).` }
          : b.id === 'sh2m' || b.id === 'sh2s'
            ? { ...b, sub: `${b.esquema![0]} · ${mhz(n.f352, 2)}` }
            : b,
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
  cs: string;
  sel: string;
  bloque: string | null;
  texto: (a: number, w: boolean) => string;
}

const MAPA: Region[] = [
  { ini: 0x00000000, fin: 0x0007ffff, zona: 'ROM de arranque ($00000000–$0007FFFF)', cs: '/CS0', sel: '/ROMCE', bloque: 'ipl',
    texto: (_a, w) => (w ? 'Es ROM: la escritura se pierde.' : 'El 315-5778 recibe /CS0 y baja /ROMCE; la palabra pasa por los 74LS245 al bus de la CPU.') },
  { ini: 0x00100000, fin: 0x0010007f, zona: 'SMPC ($00100000–$0010007F)', cs: '/CS0', sel: '/SMPCCE', bloque: 'smpc',
    texto: () => 'Registros del SMPC en los bytes impares: órdenes (reset, SSHON, CKCHG352…), resultados y los puertos de los mandos.' },
  { ini: 0x00180000, fin: 0x0018ffff, zona: 'RAM de respaldo ($00180000–$0018FFFF)', cs: '/CS0', sel: '/SRAMCE', bloque: 'bram',
    texto: () => 'Los 32 KB de la SRAM con pila, uno por cada byte impar.' },
  { ini: 0x00200000, fin: 0x002fffff, zona: 'WORK RAM-L ($00200000–$002FFFFF)', cs: '/CS0', sel: '/DRAS0, /DRAS1', bloque: 'wraml',
    texto: () => 'El 315-5778 parte la dirección en fila y columna (DA0–DA8) y baja /DRAS y /DUCAS, /DLCAS de la DRAM.' },
  { ini: 0x01000000, fin: 0x01000003, zona: 'MINIT ($01000000)', cs: '/CS0', sel: 'MINIT', bloque: 'sh2s',
    texto: () => 'La maestra escribe aquí para avisar a la esclava: le llega como «captura de entrada» de su temporizador FRT, que puede pedir una interrupción.' },
  { ini: 0x01800000, fin: 0x01800003, zona: 'SINIT ($01800000)', cs: '/CS0', sel: 'SINIT', bloque: 'sh2m',
    texto: () => 'La esclava escribe aquí para avisar a la maestra (captura de entrada del FRT de la maestra).' },
  { ini: 0x02000000, fin: 0x03ffffff, zona: 'Bus A, CS0: cartucho ($02000000–$03FFFFFF)', cs: '/CS1', sel: '/ACS0', bloque: 'cart',
    texto: () => 'La SCU traslada el acceso al bus A y baja /ACS0 de la ranura de cartucho.' },
  { ini: 0x04000000, fin: 0x04ffffff, zona: 'Bus A, CS1 ($04000000–$04FFFFFF)', cs: '/CS2', sel: '/ACS1', bloque: 'cart',
    texto: () => 'Segunda zona del cartucho (identificación y RAM de los cartuchos de ampliación).' },
  { ini: 0x05800000, fin: 0x058fffff, zona: 'Bus A, CS2: bloque de CD ($05800000–$058FFFFF)', cs: '/CS2', sel: '/ACS2', bloque: 'ygr',
    texto: () => 'La SCU baja /ACS2 y la señal llega por CN4/E101 al YGR019 de la placa SH-1: registros de órdenes y la ventana de datos del búfer.' },
  { ini: 0x05a00000, fin: 0x05a7ffff, zona: 'RAM de sonido ($05A00000–$05A7FFFF)', cs: '/CS2', sel: '/BCSS', bloque: 'sram',
    texto: () => 'Por el bus B: la SCSP atiende /BCSS y pasa el acceso a su RAM de 512 KB.' },
  { ini: 0x05b00000, fin: 0x05b00ee3, zona: 'Registros de la SCSP ($05B00000–$05B00EE3)', cs: '/CS2', sel: '/BCSS', bloque: 'scsp',
    texto: () => 'Los 32 canales, el DSP y el control del 68EC000.' },
  { ini: 0x05c00000, fin: 0x05cbffff, zona: 'VDP1: VRAM y búfer de imagen ($05C00000–$05CBFFFF)', cs: '/CS2', sel: '/BCS1', bloque: 'vdp1',
    texto: (a) => (a < 0x05c80000 ? 'VRAM del VDP1: lista de órdenes y texturas.' : 'El búfer de imagen que el VDP1 no está mostrando.') },
  { ini: 0x05d00000, fin: 0x05d00017, zona: 'Registros del VDP1 ($05D00000–$05D00017)', cs: '/CS2', sel: '/BCS1', bloque: 'vdp1',
    texto: () => 'Modo de dibujo, cambio de búfer y estado.' },
  { ini: 0x05e00000, fin: 0x05e7ffff, zona: 'VRAM del VDP2 ($05E00000–$05E7FFFF)', cs: '/CS2', sel: '/BCS2', bloque: 'vdp2',
    texto: (a) => `Banco ${a < 0x05e40000 ? 'A' : 'B'}${(a & 0x20000) ? '1' : '0'} de la VRAM del VDP2: patrones, mapas y tablas.` },
  { ini: 0x05f00000, fin: 0x05f00fff, zona: 'CRAM del VDP2 ($05F00000–$05F00FFF)', cs: '/CS2', sel: '/BCS2', bloque: 'vdp2',
    texto: () => 'La paleta: 4 KB de colores dentro del VDP2.' },
  { ini: 0x05f80000, fin: 0x05f8011f, zona: 'Registros del VDP2 ($05F80000–$05F8011F)', cs: '/CS2', sel: '/BCS2', bloque: 'vdp2',
    texto: () => 'Modo de pantalla, planos, desplazamientos, prioridades.' },
  { ini: 0x05fe0000, fin: 0x05fe00cf, zona: 'Registros de la SCU ($05FE0000–$05FE00CF)', cs: '/CS2', sel: 'SCU', bloque: 'scu',
    texto: () => 'DMA, DSP, temporizadores y máscara de interrupciones.' },
  { ini: 0x06000000, fin: 0x07ffffff, zona: 'WORK RAM-H ($06000000–$060FFFFF, espejada)', cs: '/CS3', sel: '/CS3', bloque: 'wramh',
    texto: (a) => `La SDRAM responde directamente a /CS3; ${hex(a, 8)} es ${hex(0x06000000 | (a & 0xfffff), 8)}.` },
];

export function decodificar(dir: number, escritura: boolean): Decodificacion {
  const sinCache = (dir & 0xe0000000) === 0x20000000;
  const a = dir & 0x07ffffff;
  const r = MAPA.find((x) => a >= x.ini && a <= x.fin);
  const tabla = MAPA.map((x) => ({ etiqueta: `${hex(x.ini, 8)}: ${x.cs} → ${x.sel}`, valor: x === r ? 'activa' : '', activa: x === r }));
  if (!r) {
    return { direccion: dir, escritura, tabla, zona: 'Zona sin dispositivo', seleccion: null, bloque: null,
      texto: 'Ninguna selección responde: en la consola real el acceso devuelve basura o detiene el bus.' };
  }
  const nota = sinCache ? ' Dirección «sin caché» (+$20000000): la SH-2 va siempre al bus.' : (dir & 0xe0000000) === 0 ? ' Con caché: si el dato está en la caché, la SH-2 ni siquiera sale al bus.' : '';
  return { direccion: dir, escritura, tabla, zona: r.zona, seleccion: `${r.cs} → ${r.sel}`, bloque: r.bloque, texto: r.texto(a, escritura) + nota,
    espejo: r.bloque === 'wramh' ? hex(0x06000000 | (a & 0xfffff), 8) : undefined };
}

// ------------------------------------------------------------------ SH-2 bus cycles

interface CicloSH {
  dir: number;
  escritura: boolean;
  dato: number;
  nota: string;
}

/** Wait states drawn for each region (illustrative except the SDRAM's burst, see «fidelidad»). */
function esperas(a: number): number {
  const z = a & 0x07ffffff;
  if (z < 0x00080000) return 3;
  if (z < 0x00200000) return 6;
  if (z < 0x00300000) return 2;
  if (z >= 0x06000000) return 0;
  return 4;
}

function senalesSH(c: Cronograma): void {
  c.bit('CLK', `CKIO ${mhz(N.f352, 2)}`, 1)
    .bus('A', 'CA26–CA1')
    .bus('D', 'CD31–CD0')
    .bit('RD', '/RD', 1)
    .bit('WE', '/WE (/DQM)', 1)
    .bit('CS0', '/CS0 (315-5778)', 1)
    .bit('CS2', '/CS1, /CS2 (SCU)', 1)
    .bit('CS3', '/CS3 (SDRAM)', 1)
    .bit('WAIT', '/WAIT', 1)
    .bit('ROMCE', '/ROMCE', 1)
    .bit('SMPCCE', '/SMPCCE', 1)
    .bit('SRAMCE', '/SRAMCE', 1)
    .bit('DRAS', '/DRAS0', 1)
    .bit('BCS2', '/BCS2 (VDP2)', 1)
    .bit('BCS1', '/BCS1 (VDP1)', 1)
    .bit('BCSS', '/BCSS (SCSP)', 1)
    .bit('ACS2', '/ACS2 (CD)', 1)
    .bit('MAESTRA', 'Maestra usa el bus', 0)
    .bus('SEL', 'Selección');
}

function cicloSH(c: Cronograma, t0: number, x: CicloSH): number {
  const d = decodificar(x.dir, x.escritura);
  const w = esperas(x.dir);
  const fin = t0 + (2 + w) * TC;
  const a = x.dir & 0x07ffffff;
  c.marca(t0);
  c.set('MAESTRA', t0, 1);
  c.set('A', t0, hex(x.dir, 8));
  const cs = a >= 0x06000000 ? 'CS3' : a < 0x02000000 ? 'CS0' : 'CS2';
  c.set(cs, t0 + 0.5 * TC, 0);
  c.set(cs, fin, 1);
  c.set(x.escritura ? 'WE' : 'RD', t0 + 0.5 * TC, 0);
  c.set(x.escritura ? 'WE' : 'RD', fin, 1);
  if (x.escritura) c.set('D', t0 + 0.5 * TC, hex(x.dato, 8));
  if (w > 0) {
    c.set('WAIT', t0 + TC, 0);
    c.set('WAIT', t0 + (1 + w) * TC, 1);
  }
  const pista = { '/ROMCE': 'ROMCE', '/SMPCCE': 'SMPCCE', '/SRAMCE': 'SRAMCE', '/DRAS0, /DRAS1': 'DRAS', '/BCS2': 'BCS2', '/BCS1': 'BCS1', '/BCSS': 'BCSS', '/ACS2': 'ACS2' }[d.seleccion?.split(' → ')[1] ?? ''];
  if (pista) {
    c.set(pista, t0 + TC, 0);
    c.set(pista, fin, 1);
  }
  c.set('SEL', t0 + 0.5 * TC, d.seleccion);
  c.set('SEL', fin, null);
  if (!x.escritura) c.set('D', fin - 0.4 * TC, hex(x.dato, 8));
  c.set('D', fin + 0.2 * TC, null);
  c.set('A', fin, null);
  return fin;
}

function ciclos(id: string, titulo: string, descripcion: string, lista: CicloSH[]): Escenario {
  const c = new Cronograma();
  senalesSH(c);
  let t = 0;
  for (const x of lista) {
    const fin = cicloSH(c, t, x);
    c.paso(t, fin + TC, `${x.escritura ? 'Escritura' : 'Lectura'} en ${hex(x.dir, 8)}: ${x.nota}`);
    t = fin + TC;
  }
  c.reloj('CLK', 0, t, TC, 0.5);
  c.marca(t);
  return {
    id, titulo, descripcion, duracion: t, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas,
    realPorSegundo: (6 * TC) / 2.5,
    defecto: ['CLK', 'A', 'D', 'RD', 'WE', 'CS0', 'CS2', 'CS3', 'WAIT', 'SEL'],
    fidelidad: `Exacto (${N.nombre}, modo de 352 puntos): periodo de CKIO ${ns(TC)} (${mhz(N.f352)}, manual del SMPC), ciclo básico de la SH-2 de dos estados más las esperas que pide /WAIT (manual del SH7604), y qué selección baja en cada zona (esquema: /CS0 al 315-5778, /CS1–/CS2 a la SCU, /CS3 a la SDRAM). Ilustrativo: el número de esperas de cada dispositivo (3 la ROM, 6 el SMPC y la RAM de respaldo, 2 la WORK RAM-L, 4 el bus B o A; la SDRAM va sin esperas y en ráfaga) y los retardos de las selecciones.`,
  };
}

const PROGRAMA: CicloSH[] = [
  { dir: 0x00000000, escritura: false, dato: 0x06000600, nota: 'el vector de arranque: la maestra lee de la ROM a través del 315-5778 (/CS0 → /ROMCE)' },
  { dir: 0x06000100, escritura: true, dato: 0x00000001, nota: 'una variable en la WORK RAM-H: la SDRAM responde a /CS3' },
  { dir: 0x2010001f, escritura: false, dato: 0x00000000, nota: 'estado del SMPC (sin caché): /CS0 → /SMPCCE' },
  { dir: 0x25f80000, escritura: true, dato: 0x00008000, nota: 'registro TVMD del VDP2 por la SCU y el bus B (/BCS2): enciende la imagen' },
];

function escenarioDecodificar(op: Opciones): Escenario {
  const dir = (parseInt(op.dir ?? '0', 16) || 0) >>> 0;
  const w = op.escritura === '1';
  return ciclos('decodificar', `Acceso a ${hex(dir, 8)}`, 'La SH-2 maestra lee o escribe la dirección elegida: qué selección baja y cuántas esperas pide el dispositivo.', [
    { dir: dir & ~3, escritura: w, dato: 0x12345678, nota: decodificar(dir, w).zona },
  ]);
}

// ------------------------------------------------------------------ frame and interrupts

function escenarioCuadro(): Escenario {
  const c = new Cronograma();
  const TL = N.linea;
  const nl = N.lineas;
  c.bus('LINEA', 'Línea').bit('ACTIVA', 'Imagen (224 líneas)', 1).bit('HINT', '/HINT del VDP2 (H-Blank-IN)', 1)
    .bit('VINT', '/VINT del VDP2', 1).bus('IRL', 'Nivel en /IRL de la maestra').bus('M', 'SH-2 maestra');
  for (let l = 0; l < nl; l++) c.set('LINEA', l * TL, String(l));
  c.set('ACTIVA', 0, 1);
  c.set('ACTIVA', 224 * TL, 0);
  c.set('M', 0, 'lógica del juego');
  c.set('IRL', 0, null);
  for (let l = 0; l < 224; l += 56) {
    const t = l * TL + 0.8 * TL;
    c.set('HINT', t, 0);
    c.set('HINT', t + 0.2 * TL, 1);
    c.marca(t);
  }
  const tv = 224 * TL;
  c.set('VINT', tv, 0);
  c.set('IRL', tv + 0.05 * TL, 'F (V-Blank-IN)');
  c.set('M', tv + 0.1 * TL, 'rutina del vector $40');
  c.set('IRL', tv + TL, null);
  c.set('VINT', tv + TL, 1);
  c.set('M', tv + 30 * TL, 'prepara el cuadro siguiente');
  const tout = (nl - 1) * TL;
  c.set('IRL', tout, 'E (V-Blank-OUT)');
  c.set('IRL', tout + 0.5 * TL, null);
  c.marca(tv);
  c.marca(tout);
  c.paso(0, tv, `Líneas 0–223: el VDP2 compone la imagen. Al final de cada línea baja /HINT (H-Blank-IN, nivel D); la SCU solo lo pasa a la SH-2 si el programa no lo enmascara (aquí se dibuja cada 56 líneas).`);
  c.paso(tv, tv + TL, 'Línea 224: /VINT. La SCU lo convierte en el nivel F en /IRL1–/IRL3 y la SH-2 maestra salta a la rutina del vector $40.');
  c.paso(tv + TL, nl * TL, `Borrado vertical: el programa cambia los búferes del VDP1, escribe en la VRAM y la CRAM del VDP2 y, al acabar, V-Blank-OUT (nivel E, vector $41).`);
  const fin = nl * TL;
  c.marca(fin);
  return {
    id: 'cuadro', titulo: 'Cuadro e interrupciones', descripcion: `Un cuadro ${N.nombre} (${nl} líneas de ${us(TL)}) con 224 líneas visibles, y las interrupciones de borrado que el VDP2 pide a la SCU.`,
    duracion: fin, escala: 'ms', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 20, ventana: [200 * TL, nl * TL],
    defecto: ['LINEA', 'ACTIVA', 'HINT', 'VINT', 'IRL', 'M'],
    fidelidad: `Exacto: niveles y vectores de V-Blank-IN (F, $40), V-Blank-OUT (E, $41) y H-Blank-IN (D, $42) (manual de la SCU) y el camino /VINT, /HINT del VDP2 → /IRQV, /IRQH de la SCU → /IRL1–/IRL3 de la SH-2 maestra (esquema). Ilustrativo: ${nl} líneas de ${us(TL)} tomadas de la norma de TV, y cuándo reconoce la CPU cada interrupción.`,
  };
}

// ------------------------------------------------------------------ clocks

function escenarioRelojes(op: Opciones): Escenario {
  const f = op.modo === '320' ? N.f320 : N.f352;
  const c = new Cronograma();
  const fs = 22.5792e6;
  const f68 = fs / 2;
  const fin = 24 / f;
  c.bit('SH', `SH-2, VDP1, VDP2: ${mhz(f)}`, 1).bit('SCSP', `SCSP (512 fs): ${mhz(fs)}`, 1).bit('M68', `68EC000: ${mhz(f68)}`, 1)
    .bit('SH1', 'SH-1 del CD: 20 MHz', 1);
  c.reloj('SH', 0, fin, 1 / f);
  c.reloj('SCSP', 0, fin, 1 / fs);
  c.reloj('M68', 0, fin, 1 / f68);
  c.reloj('SH1', 0, fin, 1 / 20e6);
  for (let k = 0; k <= 24; k++) c.marca(k / f);
  c.paso(0, fin, `Cuatro relojes que no guardan una relación sencilla: el PLL saca el de las SH-2 y los VDP (${op.modo === '320' ? 'modo de 320 puntos' : 'modo de 352 puntos, tras la orden CKCHG352 del SMPC'}) y el del sonido (44,1 kHz × 512); el bloque de CD lleva su propio cristal de 20 MHz.`);
  return {
    id: 'relojes', titulo: 'Relojes', descripcion: `Los relojes de la consola ${N.nombre}, a partir del cristal X1 (${N.cristal}) y de X101.`,
    duracion: fin, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 6,
    defecto: ['SH', 'SCSP', 'M68', 'SH1'],
    fidelidad: `Exacto: ${mhz(N.f320)} y ${mhz(N.f352)} (${N.nombre}, manual del SMPC), SCSP a 512 fs = 22,5792 MHz (manual de servicio, patilla MACK de la SCSP), 68EC000 a 11,3 MHz (manual de introducción de Sega; aquí la mitad de la SCSP, 11,2896 MHz) y SH-1 a 20 MHz (X101). Ilustrativo: la fase relativa.`,
  };
}

// ------------------------------------------------------------------ the CD block on the A-bus

function escenarioCD(): Escenario {
  const c = new Cronograma();
  const TA = 1 / N.f352;
  c.bit('SIRQ', 'SIRQH del YGR019 al SH-1', 1).bus('SH1', 'SH-1').bit('ACS2', '/ACS2 (bus A, CS2)', 1).bit('ARD', '/ARD', 1)
    .bit('AWAIT', '/AWAIT', 1).bus('AD', 'AD0–AD15').bus('M', 'SH-2 maestra');
  c.set('SH1', 0, 'espera datos de la unidad');
  c.set('M', 0, 'pide un sector (orden en los registros del CD)');
  const t1 = 0.4e-6;
  c.set('SIRQ', t1, 0);
  c.set('SH1', t1, 'sector en el búfer: lo anuncia');
  c.set('SIRQ', t1 + 0.3e-6, 1);
  c.paso(0, t1 + 0.4e-6, 'La unidad manda el sector en serie (SDAS, SCKX, SMPX) por E102; el YGR019 lo guarda en el búfer y avisa al SH-1 con SIRQH; el SH-1 actualiza los registros que ve la SH-2.');
  let t = t1 + 0.6e-6;
  c.set('M', t, 'lee la ventana de datos');
  for (let k = 0; k < 4; k++) {
    c.set('ACS2', t, 0);
    c.set('ARD', t + TA, 0);
    c.set('AWAIT', t + 1.5 * TA, 0);
    c.set('AWAIT', t + 5 * TA, 1);
    c.set('AD', t + 5 * TA, hex(0x1234 + 0x1111 * k, 4));
    c.set('ARD', t + 6 * TA, 1);
    c.set('ACS2', t + 6 * TA, 1);
    c.set('AD', t + 6.5 * TA, null);
    c.marca(t);
    t += 8 * TA;
  }
  c.paso(t1 + 0.6e-6, t, 'Cada palabra: la SCU baja /ACS2 y /ARD en el bus A; el YGR019 retiene el ciclo con /AWAIT hasta tener el dato y lo pone en AD0–AD15, que viaja por E101/CN4 hasta la SCU y la SH-2.');
  c.marca(t);
  return {
    id: 'cd', titulo: 'Bloque de CD → SH-2', descripcion: 'Un sector llega de la unidad de CD a la placa SH-1 y la SH-2 maestra lo lee por el bus A, palabra a palabra.',
    duracion: t, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: t / 10,
    defecto: ['SIRQ', 'SH1', 'ACS2', 'ARD', 'AWAIT', 'AD', 'M'],
    fidelidad: 'Exacto: el camino de las señales (E102 → YGR019 → E101/CN4 → SCU) y sus nombres en el esquema, que el bus A del CD es de 16 bits en la zona CS2 y que el YGR019 tiene /AWAIT para alargar el ciclo. Ilustrativo: todas las duraciones (la espera de 3,5 ciclos y los tiempos del sector).',
  };
}

export const SATURN: Maquina = {
  id: 'saturn',
  diagrama: diagramaDe('ntsc'),
  diagramaDe,
  variantes: [
    { id: 'ntsc', titulo: 'NTSC · 60 Hz', nota: 'NTSC, como la placa japonesa VA0.5 del esquema (X1 de 14,31818 MHz): SH-2 y VDP a 26,8741 MHz (320 puntos) o 28,6364 MHz (352 puntos).' },
    { id: 'pal', titulo: 'PAL · 50 Hz', nota: 'PAL (placa VA0 europea, manual de servicio 013-1): X1 de 17,7344 MHz, SH-2 y VDP a 26,6875 MHz o 28,4375 MHz; 313 líneas.' },
  ],
  digitos: 8,
  dirInicial: '25E00000',
  notaDecodificador: 'Las direcciones con +$20000000 son las mismas zonas «sin caché»: la SH-2 va siempre al bus.',
  decodificar,
  escenarios: [
    { id: 'bus', titulo: 'Ciclos de la SH-2', crear: conNorma(() => ciclos('bus', 'Ciclos de bus de la SH-2 maestra', 'Cuatro accesos típicos: el vector de arranque de la ROM, la WORK RAM-H, el SMPC y un registro del VDP2. Cada uno baja otra selección y espera lo que pida su dispositivo.', PROGRAMA)) },
    { id: 'decodificar', titulo: 'Decodificar una dirección', crear: conNorma(escenarioDecodificar) },
    { id: 'cuadro', titulo: 'Cuadro e interrupciones', crear: conNorma(escenarioCuadro) },
    { id: 'cd', titulo: 'Bloque de CD → SH-2', crear: conNorma(escenarioCD) },
    { id: 'relojes', titulo: 'Relojes', crear: conNorma(escenarioRelojes) },
  ],
  ejemplos: [
    { dir: 0x00000000, escritura: false, texto: 'ROM' },
    { dir: 0x20100001, escritura: true, texto: 'SMPC' },
    { dir: 0x00200000, escritura: true, texto: 'WORK RAM-L' },
    { dir: 0x06000000, escritura: true, texto: 'WORK RAM-H' },
    { dir: 0x25890000, escritura: false, texto: 'CD' },
    { dir: 0x25c00000, escritura: true, texto: 'VDP1' },
    { dir: 0x25e00000, escritura: true, texto: 'VRAM VDP2' },
    { dir: 0x25f00000, escritura: true, texto: 'CRAM' },
    { dir: 0x25a00000, escritura: true, texto: 'sonido' },
  ],
  opciones: [{ id: 'modo', titulo: 'Modo de puntos', escenarios: ['relojes'], valores: [{ v: '352', texto: '352 puntos' }, { v: '320', texto: '320 puntos' }] }],
};
