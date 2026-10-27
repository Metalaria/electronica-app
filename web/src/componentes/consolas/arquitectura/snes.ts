// Super Nintendo, PAL board SNSP-CPU-01 (5A22 CPU, S-PPU1/S-PPU2, S-WRAM, S-SMP + S-DSP, S-CLK): block diagram,
// address decoding (CPU address and B bus) and the timed scenarios. Written from the nonSNES schematic, Copetti's
// «Super Nintendo Architecture» (cross-check only), anomie's «SNES memory mapping» and the SNESdev «Timing» page.
//
// Timing figures:
//   - clocks: master clock XIN 21.28137 MHz PAL (the S-CLK multiplies the 17.734475 MHz crystal X1, four times the
//     PAL subcarrier, by 6/5) or 21.477272 MHz NTSC (945/44 MHz, its own crystal, no S-CLK). Dot clock = XIN ÷ 4.
//     Sound: 24.576 MHz resonator X2; SPC700 = ÷ 24 = 1.024 MHz; samples = ÷ 768 = 32 kHz (SNESdev «Timing»).
//   - CPU accesses (memmap.txt): 6 master cycles («fast»: $2000–$3FFF incl. the B bus, $4200–$5FFF, internal
//     cycles, ROM in banks $80+ with FastROM), 8 («slow»: WRAM, ROM, $6000–$7FFF) or 12 («extra slow»:
//     $4000–$41FF, the serial joypad ports). The shape of /RD and /WR inside an access is drawn, not measured.
//   - line: 1364 master cycles (341 dots of 4); WRAM refresh: the CPU stops for 40 master cycles about 536 cycles
//     into each line; HDMA from dot 278, ~18 cycles of overhead plus 8 per channel and 8 per byte; DMA: 8 master
//     cycles per byte, 8 per channel and 8 per transfer of overhead (superfamicom.org «Timing», anomie).
//   - frame: 312 lines PAL (50.007 Hz) or 262 NTSC (60.10 Hz, ignoring the short line); V-blank from line 225 (or
//     240 with overscan, $2133 bit 2); NMI low from H = 0.5 of that line until $4210 is read; automatic joypad read
//     of 4224 master cycles that starts between dots 32.5 and 95.5 of the first V-blank line.

import { Cronograma, hex, type Escenario } from './modelo';
import type { Decodificacion, Diagrama, Maquina, Opciones } from './diagrama';

interface Norma {
  id: 'pal' | 'ntsc';
  nombre: string;
  xin: number;
  lineas: number;
}

const NORMAS: Record<'pal' | 'ntsc', Norma> = {
  pal: { id: 'pal', nombre: 'PAL', xin: 21.28137e6, lineas: 312 },
  ntsc: { id: 'ntsc', nombre: 'NTSC', xin: 21.477272e6, lineas: 262 },
};
const X1_PAL = 17.734475e6;
const APU = 24.576e6;

// Timing of the scenario being built (scenarios are created one at a time, see megadrive.ts).
let N: Norma = NORMAS.pal;
let TM = 1 / N.xin;
let TL = 1364 * TM;

function fijarNorma(id: string | undefined): void {
  N = id === 'ntsc' ? NORMAS.ntsc : NORMAS.pal;
  TM = 1 / N.xin;
  TL = 1364 * TM;
}

function conNorma(f: (op: Opciones) => Escenario): (op: Opciones) => Escenario {
  return (op) => {
    fijarNorma(op.norma);
    return f(op);
  };
}

const coma = (x: number, d: number): string => x.toFixed(d).replace('.', ',');
const mhz = (f: number, d = 2): string => `${coma(f / 1e6, d)} MHz`;
const ns = (t: number): string => `${coma(t * 1e9, 1)} ns`;
const us = (t: number): string => `${coma(t * 1e6, 2)} µs`;
const hz = (): string => `${coma(N.xin / (1364 * N.lineas), 3)} Hz`;

// ------------------------------------------------------------------ diagram

const base: Diagrama = {
  ancho: 1000,
  alto: 560,
  bloques: [
    { id: 'clk', x: 20, y: 14, w: 180, h: 56, titulo: 'Reloj PAL', sub: 'U18 S-CLK · X1', foto: 'sclk', esquema: ['U18', 'X1'],
      actividad: [{ pista: 'XIN', nivel: 1 }],
      info: 'El S-CLK convierte el cristal de 17,734475 MHz en el reloj maestro XIN de 21,28137 MHz (× 6/5), la subportadora PAL y el reloj del CIC. Las NTSC no lo llevan: su cristal ya es de 21,477 MHz.' },
    { id: 'mandos', x: 220, y: 14, w: 140, h: 56, titulo: 'Mandos', sub: 'P2 · $4016/$4017', foto: 'mandos', esquema: ['P2'],
      actividad: [{ pista: 'JOY', nivel: 1 }, { pista: 'JPCLK', nivel: 1 }, { pista: 'JPSTR', nivel: 1 }],
      info: 'Los mandos son registros de desplazamiento: la CPU los congela con JPSTR y saca los botones uno a uno con JPCLK, a mano (leyendo $4016/$4017) o sola, en cada borrado vertical.' },
    { id: 'vram', x: 380, y: 14, w: 160, h: 56, titulo: 'VRAM 64 KB', sub: 'U4, U5 · 2 × 32 KB', foto: 'vram', esquema: ['U4', 'U5'],
      actividad: [{ pista: 'VAWR' }, { pista: 'VBWR' }],
      info: 'Dos SRAM de 32 KB, cada una con su bus de 8 bits: la PPU1 lee 16 bits por acceso. La CPU solo llega a ellas a través de los registros de la PPU ($2115–$2119), o por DMA.' },
    { id: 'cpu', x: 20, y: 95, w: 180, h: 120, titulo: 'CPU 5A22', sub: 'U1 · 65C816 + DMA', foto: 'cpu', esquema: ['U1'],
      actividad: [{ pista: 'CA' }],
      info: 'Núcleo 65C816 con DMA/HDMA de 8 canales, multiplicador, divisor, contadores H/V y lectura automática de los mandos. Cada acceso dura 6, 8 o 12 ciclos de XIN según la zona. Saca el bus A (24 bits) y el bus B (8 bits) con los mismos datos D0–D7.' },
    { id: 'ppu1', x: 380, y: 95, w: 160, h: 110, titulo: 'PPU1', sub: 'U2 · S-PPU1', foto: 'ppu1', esquema: ['U2'],
      actividad: [{ pista: 'PPUSEL', nivel: 1 }, { pista: 'VAWR' }, { pista: 'VBWR' }],
      info: 'Lee fondos y sprites de la VRAM, guarda la tabla de sprites (OAM) y calcula el modo 7. Pasa cada píxel a la PPU2. Registros en $2100–$213F (bus B $00–$3F).' },
    { id: 'ppu2', x: 570, y: 95, w: 160, h: 110, titulo: 'PPU2', sub: 'U3 · S-PPU2', foto: 'ppu2', esquema: ['U3'],
      actividad: [{ pista: 'PPUSEL', nivel: 1 }, { pista: 'VBLANK', nivel: 1 }],
      info: 'Prioridades, ventanas, mezcla de color y brillo, paleta (CGRAM) y RGB analógico con su sincronismo. Avisa a la CPU de los borrados (HBLANK, VBLANK) y reparte el reset que le da el CIC.' },
    { id: 'enc', x: 760, y: 95, w: 220, h: 66, titulo: 'Vídeo', sub: 'U7 S-ENC · Multi Out · RF', foto: 'enc', esquema: ['U7', 'P4', 'J2'],
      info: 'El S-ENC convierte el RGB en S-vídeo y compuesto PAL. Salen por el Multi Out (con RGB y, en las PAL, 12 V en la patilla 3) y por el modulador de RF.' },
    { id: 'cart', x: 20, y: 330, w: 150, h: 66, titulo: 'Cartucho', sub: 'P1 · /ROMSEL', foto: 'cart', esquema: ['P1'], externo: true,
      actividad: [{ pista: 'ROMSEL' }],
      info: 'ROM (y a veces RAM o coprocesadores) en el bus A, con /ROMSEL para las zonas de ROM. Tiene también el bus B, /IRQ, el reloj maestro y una entrada de audio.' },
    { id: 'wram', x: 190, y: 330, w: 160, h: 66, titulo: 'WRAM 128 KB', sub: 'U6 · /RAMSEL · $2180', foto: 'wram', esquema: ['U6'],
      actividad: [{ pista: 'RAMSEL' }, { pista: 'WRAMB', nivel: 1 }, { pista: 'REFRESCO', nivel: 1 }],
      info: 'DRAM de 128 KB: en el bus A con /RAMSEL ($7E0000–$7FFFFF y $0000–$1FFF de los bancos bajos) y en el bus B por su puerto de $2180–$2183, con su propio contador de direcciones. La CPU para 40 ciclos maestros en cada línea para refrescarla.' },
    { id: 'exp', x: 370, y: 330, w: 140, h: 66, titulo: 'Expansión', sub: 'P5 · bus B', foto: 'exp', esquema: ['P5'], externo: true,
      info: 'El bus B con los datos, /IRQ, reset, los relojes del punto y del sonido y audio estéreo, por debajo de la consola.' },
    { id: 'smp', x: 560, y: 330, w: 160, h: 80, titulo: 'S-SMP', sub: 'U13 · SPC700 1,024 MHz', foto: 'smp', esquema: ['U13'],
      actividad: [{ pista: 'APUSEL', nivel: 1 }, { pista: 'SPCA' }],
      info: 'La CPU del sonido, con su propio reloj. La CPU principal solo le habla por cuatro puertos: $2140–$2143 en el bus B, $F4–$F7 para el SPC700.' },
    { id: 'dsp', x: 770, y: 330, w: 150, h: 80, titulo: 'S-DSP', sub: 'U14 · 8 voces · X2', foto: 'dsp', esquema: ['U14', 'X2'],
      actividad: [{ pista: 'ARAM' }, { pista: 'LRCK', nivel: 1 }],
      info: 'Lee las muestras BRR de la ARAM para ocho voces, aplica envolventes y eco y saca 32 000 muestras estéreo por segundo en serie hacia el DAC. Reparte la ARAM entre él y el SPC700.' },
    { id: 'aram', x: 770, y: 470, w: 150, h: 56, titulo: 'ARAM 64 KB', sub: 'U15, U16', foto: 'aram', esquema: ['U15', 'U16'],
      actividad: [{ pista: 'ARAM' }],
      info: 'Programa del SPC700, muestras y eco, en dos SRAM de 32 KB que el S-DSP elige con /SCE0 y /SCE1.' },
    { id: 'dac', x: 560, y: 470, w: 160, h: 56, titulo: 'DAC y mezcla', sub: 'U17 µPD6376 · U10', foto: 'dac', esquema: ['U17', 'U10'],
      actividad: [{ pista: 'DATA' }],
      info: 'El µPD6376 convierte las muestras en dos tensiones; el LM324 y sus transistores las filtran, les suman el audio del cartucho y de la expansión y las sacan por el Multi Out y el modulador.' },
    { id: 'cic', x: 190, y: 470, w: 160, h: 56, titulo: 'CIC', sub: 'U8 · bloqueo', foto: 'cic', esquema: ['U8'],
      info: 'Habla con el CIC del cartucho por CIC0–CIC3. Si no se reconocen, mantiene /RESET bajo en la PPU2, que tiene en reset a toda la consola. El botón de reset entra por aquí.' },
    { id: 'alim', x: 20, y: 470, w: 150, h: 56, titulo: 'Alimentación', sub: 'U12 7805 · +9 V', foto: 'alim', esquema: ['U12'],
      info: 'Puente rectificador, filtro y regulador de 5 V; un transistor saca los +9 V del audio.' },
  ],
  conexiones: [
    { id: 'xin', puntos: [[110, 70], [110, 95]], bits: 1, etiqueta: 'XIN', pos: [134, 84], clase: 'reloj', pista: 'XIN', nivel: 1, red: 'XIN' },
    { id: 'xin-ppu', puntos: [[200, 60], [210, 60], [210, 82], [650, 82], [650, 95]], bits: 1, etiqueta: '', clase: 'reloj', pista: 'XIN', nivel: 1 },
    { id: 'xin-ppu1', puntos: [[520, 82], [520, 95]], bits: 1, etiqueta: '', clase: 'reloj', pista: 'XIN', nivel: 1 },
    { id: 'mandos', puntos: [[290, 70], [290, 150], [200, 150]], bits: 6, etiqueta: 'JPCLK, JPSTR, D', pos: [250, 142], clase: 'control', pista: 'JPCLK', nivel: 1, red: 'JPCLK1' },
    { id: 'vram-a', puntos: [[420, 70], [420, 95]], bits: 15, etiqueta: 'VA', pos: [404, 86], clase: 'bus', pista: 'VAWR', nivel: 0, red: 'VAA0' },
    { id: 'vram-d', puntos: [[490, 70], [490, 95]], bits: 16, etiqueta: 'VD', pos: [474, 86], clase: 'dato', pista: 'VAWR', nivel: 0, red: 'VDA0' },
    { id: 'ppu12', puntos: [[540, 150], [570, 150]], bits: 12, etiqueta: 'CHR, COLOR', pos: [555, 140], clase: 'dato', red: 'CHR0' },
    { id: 'rgb', puntos: [[730, 128], [760, 128]], bits: 4, etiqueta: 'RGB', pos: [745, 120], clase: 'control', red: 'Net-(U3-CSYNC)' },
    { id: 'blank', puntos: [[590, 205], [590, 228], [130, 228], [130, 215]], bits: 2, etiqueta: 'HBLANK, VBLANK', pos: [360, 222], clase: 'interrupcion', pista: 'VBLANK', nivel: 1, red: 'Net-(U1-VBLANK)' },
    { id: 'bus-a', puntos: [[20, 248], [360, 248]], bits: 24, etiqueta: 'CA0–CA23', pos: [300, 242], clase: 'bus', pista: 'CA', valor: true, red: 'CA0' },
    { id: 'bus-d', puntos: [[20, 270], [940, 270]], bits: 8, etiqueta: 'D0–D7', pos: [880, 264], clase: 'dato', pista: 'D', valor: true, red: 'D0' },
    { id: 'bus-b', puntos: [[140, 292], [940, 292]], bits: 8, etiqueta: 'PA0–PA7 (bus B)', pos: [860, 286], clase: 'bus', pista: 'PA', valor: true, red: 'PA0' },
    { id: 'cpu-a', puntos: [[50, 215], [50, 248]], bits: 24, etiqueta: '', clase: 'bus', pista: 'CA' },
    { id: 'cpu-d', puntos: [[90, 215], [90, 270]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'cpu-b', puntos: [[160, 215], [160, 292]], bits: 8, etiqueta: '', clase: 'bus', pista: 'PA' },
    { id: 'romsel', puntos: [[30, 215], [30, 330]], bits: 1, etiqueta: '/ROMSEL', pos: [32, 316], clase: 'seleccion', pista: 'ROMSEL', nivel: 0, red: '{slash}ROMSEL' },
    { id: 'cart-a', puntos: [[60, 248], [60, 330]], bits: 24, etiqueta: '', clase: 'bus', pista: 'CA' },
    { id: 'cart-d', puntos: [[100, 270], [100, 330]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'cart-b', puntos: [[150, 292], [150, 330]], bits: 8, etiqueta: '', clase: 'bus', pista: 'PA' },
    { id: 'ramsel', puntos: [[190, 200], [345, 200], [345, 330]], bits: 1, etiqueta: '/RAMSEL', pos: [255, 194], clase: 'seleccion', pista: 'RAMSEL', nivel: 0, red: '{slash}RAMSEL' },
    { id: 'wram-a', puntos: [[210, 248], [210, 330]], bits: 17, etiqueta: '', clase: 'bus', pista: 'CA' },
    { id: 'wram-d', puntos: [[260, 270], [260, 330]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'wram-b', puntos: [[310, 292], [310, 330]], bits: 8, etiqueta: '', clase: 'bus', pista: 'PA' },
    { id: 'exp-d', puntos: [[400, 270], [400, 330]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'exp-b', puntos: [[460, 292], [460, 330]], bits: 8, etiqueta: '', clase: 'bus', pista: 'PA' },
    { id: 'ppu1-d', puntos: [[440, 205], [440, 270]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'ppu1-b', puntos: [[500, 205], [500, 292]], bits: 8, etiqueta: '', clase: 'bus', pista: 'PA' },
    { id: 'ppu2-d', puntos: [[630, 205], [630, 270]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'ppu2-b', puntos: [[700, 205], [700, 292]], bits: 8, etiqueta: '', clase: 'bus', pista: 'PA' },
    { id: 'smp-d', puntos: [[600, 270], [600, 330]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'smp-b', puntos: [[660, 292], [660, 330]], bits: 8, etiqueta: '', clase: 'bus', pista: 'PA' },
    { id: 'smp-dsp', puntos: [[720, 370], [770, 370]], bits: 24, etiqueta: 'CPUA, CPUD', pos: [745, 362], clase: 'bus', pista: 'SPCA', red: 'Net-(U13-CPUA0)' },
    { id: 'aram', puntos: [[845, 410], [845, 470]], bits: 23, etiqueta: 'MA, MD', pos: [872, 444], clase: 'bus', pista: 'ARAM', red: 'MA0' },
    { id: 'i2s', puntos: [[785, 410], [785, 440], [740, 440], [740, 498], [720, 498]], bits: 3, etiqueta: 'BCK, LRCK, DATA', pos: [700, 450], clase: 'dato', pista: 'DATA', red: 'Net-(U14-DATA)' },
    { id: 'cic', puntos: [[230, 470], [230, 440], [95, 440], [95, 396]], bits: 4, etiqueta: 'CIC0–CIC3', pos: [160, 434], clase: 'control', red: 'Net-(P1-CIC0)' },
  ],
};

const diagramas = new Map<string, Diagrama>();

/** The block diagram with the clock figures of a standard. */
function diagramaDe(id: string): Diagrama {
  const n = id === 'ntsc' ? NORMAS.ntsc : NORMAS.pal;
  let d = diagramas.get(n.id);
  if (!d) {
    const subs: Record<string, [string, string] | [string]> = {
      clk:
        n.id === 'pal'
          ? ['U18 S-CLK · X1 17,73 MHz']
          : ['X1 21,48 MHz · sin S-CLK', 'En las NTSC el cristal ya es el reloj maestro: XIN = 21,477272 MHz (945/44 MHz). No hay S-CLK.'],
      cpu: [`U1 · ${mhz(n.xin / 8)}–${mhz(n.xin / 6)}`],
    };
    d = {
      ...base,
      bloques: base.bloques.map((b) => {
        const s = subs[b.id];
        if (!s) return b;
        return { ...b, sub: s[0], titulo: b.id === 'clk' ? `Reloj ${n.nombre}` : b.titulo, info: s[1] ?? b.info };
      }),
    };
    diagramas.set(n.id, d);
  }
  return d;
}

// ------------------------------------------------------------------ decoding

interface Region {
  bus: 'A' | 'B' | 'interno';
  zona: string;
  sel: string | null;
  bloque: string | null;
  ciclos: 6 | 8 | 12;
  pa?: number;
  texto: string;
}

const PPU_REG: Record<number, string> = {
  0x00: 'INIDISP (brillo y pantalla apagada)', 0x05: 'BGMODE (modo de vídeo)', 0x15: 'VMAIN (incremento de la VRAM)',
  0x16: 'VMADDL (dirección de la VRAM)', 0x17: 'VMADDH (dirección de la VRAM)', 0x18: 'VMDATAL (byte bajo de la VRAM: U5)',
  0x19: 'VMDATAH (byte alto de la VRAM: U4)', 0x21: 'CGADD (dirección de la paleta)', 0x22: 'CGDATA (paleta)',
  0x2c: 'TM (capas de la pantalla principal)', 0x37: 'SLHV (captura los contadores H/V)', 0x3e: 'STAT77 (versión de la PPU1)',
  0x3f: 'STAT78 (versión de la PPU2 y PAL/NTSC)',
};

/** What a B-bus address (PA0–PA7) selects. */
function regionB(pa: number, w: boolean): Pick<Region, 'zona' | 'sel' | 'bloque' | 'texto'> {
  if (pa < 0x40) {
    const r = PPU_REG[pa];
    return { zona: `PPU ($21${hex(pa, 2).slice(1)})`, sel: 'PPU', bloque: pa >= 0x21 && pa <= 0x22 ? 'ppu2' : 'ppu1',
      texto: `${r ? `Registro ${r}` : 'Registro de las PPU'}: PA7 = PA6 = 0 eligen las dos PPU, que leen PA0–PA5 con ${w ? '/PAWR' : '/PARD'}.` };
  }
  if (pa < 0x80) {
    const p = pa & 3;
    return { zona: `Puerto ${p} del sonido ($214${p}, espejado hasta $217F)`, sel: 'APU', bloque: 'smp',
      texto: `PA7 = 0 y PA6 = 1 eligen el S-SMP (sus patillas /CS y CS) y PA0–PA1 el puerto. ${w ? `La CPU deja el byte en el puerto ${p}, que el SPC700 lee en $F${4 + p}` : `La CPU lee lo que el SPC700 escribió en $F${4 + p}`}: son dos registros distintos, uno en cada sentido.` };
  }
  if (pa <= 0x83) {
    const n = ['WMDATA (dato, y avanza la dirección)', 'WMADDL', 'WMADDM', 'WMADDH'][pa - 0x80]!;
    return { zona: `Puerto de la WRAM ($218${pa - 0x80})`, sel: 'WRAM B', bloque: 'wram',
      texto: `${n}: la S-WRAM compara PA2–PA7 con $80 y usa su propio contador de 17 bits; así una DMA puede llenar la WRAM desde la ROM.` };
  }
  return { zona: 'Bus B sin dispositivo en la placa', sel: null, bloque: null, texto: 'Ningún chip de la placa contesta; un periférico de la expansión o del cartucho podría hacerlo.' };
}

function region(dir: number, w: boolean): Region {
  const banco = dir >> 16;
  const off = dir & 0xffff;
  const wram = { bus: 'A' as const, sel: '/RAMSEL', bloque: 'wram', ciclos: 8 as const };
  if (banco === 0x7e || banco === 0x7f)
    return { ...wram, zona: 'WRAM ($7E0000–$7FFFFF)', texto: `Banco ${hex(banco, 2)} de la S-WRAM: la CPU baja /RAMSEL y la WRAM recibe CA0–CA16. 8 ciclos maestros.` };
  const rom = (rapida: boolean): Region => ({
    bus: 'A', sel: '/ROMSEL', bloque: 'cart', ciclos: rapida ? 6 : 8, zona: 'ROM del cartucho',
    texto: `/ROMSEL baja y el cartucho decide qué chip contesta (LoROM, HiROM…). ${rapida ? '6 ciclos con FastROM ($420D bit 0 = 1).' : `8 ciclos maestros (${mhz(N.xin / 8)}); en los bancos $80–$FF serían 6 si el juego activa FastROM.`}`,
  });
  if ((banco >= 0x40 && banco <= 0x7d) || banco >= 0xc0) return rom(false);
  // banks $00–$3F and $80–$BF
  if (off < 0x2000)
    return { ...wram, zona: 'WRAM, espejo de $7E0000–$7E1FFF', texto: `Los primeros 8 KB de la WRAM se ven en todos los bancos bajos: ${hex(dir, 6)} es ${hex(0x7e0000 | off, 6)}.` };
  if (off >= 0x2100 && off <= 0x21ff) {
    const b = regionB(off & 0xff, w);
    return { bus: 'B', ciclos: 6, pa: off & 0xff, ...b, texto: `Bus B: la CPU pone PA0–PA7 = ${hex(off & 0xff, 2)} y baja ${w ? '/PAWR' : '/PARD'}. ${b.texto}` };
  }
  if (off >= 0x4000 && off <= 0x41ff) {
    const mando = off === 0x4016 || off === 0x4017;
    return { bus: 'interno', sel: mando ? 'CPU interno' : null, bloque: mando ? 'mandos' : null, ciclos: 12,
      zona: mando ? `Puerto serie de mandos ($${off.toString(16).toUpperCase()})` : 'Zona lenta interna ($4000–$41FF)',
      texto: mando
        ? `Registro dentro de la CPU, el más lento: 12 ciclos maestros (${mhz(N.xin / 12)}). ${w ? 'Escribir $4016 mueve JPSTR (congela los botones de los dos mandos).' : `Leer da el bit del mando ${off === 0x4016 ? 1 : 2} y da un impulso de JPCLK${off === 0x4016 ? 1 : 2} para el siguiente botón.`}`
        : 'La dirección sale por el bus A, pero no contesta nadie de la placa.' };
  }
  if (off >= 0x4200 && off <= 0x43ff)
    return { bus: 'interno', sel: 'CPU interno', bloque: 'cpu', ciclos: 6, zona: off >= 0x4300 ? 'Registros de la DMA ($43xx)' : 'Registros de la CPU ($4200–$42FF)',
      texto: off >= 0x4300 ? `Canal ${(off >> 4) & 7} de la DMA/HDMA, registro ${hex(off & 0xf, 1)}.` : off === 0x420b ? 'MDMAEN: arranca la DMA de los canales marcados; la CPU se para hasta que acaba.' : off === 0x4210 ? 'RDNMI: leerlo suelta la NMI.' : 'NMI e IRQ, multiplicador y divisor, HDMA, FastROM ($420D)…' };
  if (off >= 0x6000 && off <= 0x7fff)
    return { bus: 'A', sel: null, bloque: 'cart', ciclos: 8, zona: 'Bus A sin /ROMSEL ($6000–$7FFF)',
      texto: 'La consola no baja ninguna selección; los cartuchos HiROM decodifican aquí su RAM con las líneas de dirección.' };
  if (off >= 0x8000) return rom(false);
  return { bus: 'A', sel: null, bloque: null, ciclos: 6, zona: 'Bus A sin dispositivo', texto: 'Nadie de la placa contesta; algunos cartuchos con coprocesador usan esta zona.' };
}

export function decodificar(dir: number, escritura: boolean, espacio?: string): Decodificacion {
  if (espacio === 'b') {
    const pa = dir & 0xff;
    const b = regionB(pa, escritura);
    const tabla = [
      { etiqueta: '$00–$3F: PPU1 y PPU2', activa: pa < 0x40 },
      { etiqueta: '$40–$7F: puertos del S-SMP', activa: pa >= 0x40 && pa < 0x80 },
      { etiqueta: '$80–$83: puerto de la WRAM', activa: pa >= 0x80 && pa <= 0x83 },
      { etiqueta: '$84–$FF: libre (cartucho, expansión)', activa: pa > 0x83 },
    ].map((x) => ({ ...x, valor: x.activa ? 'activa' : '' }));
    return { direccion: pa, escritura, tabla, zona: b.zona, seleccion: b.sel, bloque: b.bloque, texto: b.texto };
  }
  const r = region(dir & 0xffffff, escritura);
  const tabla = [
    { etiqueta: '/ROMSEL (ROM del cartucho)', activa: r.sel === '/ROMSEL' },
    { etiqueta: '/RAMSEL (WRAM)', activa: r.sel === '/RAMSEL' },
    { etiqueta: '/PARD, /PAWR (bus B)', activa: r.bus === 'B' },
    { etiqueta: 'Registro interno de la CPU', activa: r.bus === 'interno' },
    { etiqueta: `Velocidad: ${r.ciclos} ciclos maestros (${mhz(N.xin / r.ciclos)})`, activa: true },
  ].map((x) => ({ ...x, valor: x.activa ? 'activa' : '' }));
  const off = dir & 0xffff;
  return { direccion: dir, escritura, tabla, zona: r.zona, seleccion: r.sel, bloque: r.bloque, texto: r.texto,
    espejo: r.sel === '/RAMSEL' && dir >> 16 !== 0x7e && dir >> 16 !== 0x7f ? hex(0x7e0000 | off, 6) : undefined };
}

// ------------------------------------------------------------------ CPU accesses

interface Acceso {
  dir: number;
  escritura: boolean;
  dato: number;
  nota: string;
  /** Internal cycle (no memory access): 6 master cycles. */
  interno?: boolean;
}

function senalesCPU(c: Cronograma): void {
  c.bit('XIN', `XIN ${mhz(N.xin)}`, 1)
    .bus('VEL', 'Duración del acceso')
    .bus('CA', 'CA23–CA0 (bus A)')
    .bus('D', 'D7–D0')
    .bit('CPURD', '/CPURD', 1)
    .bit('CPUWR', '/CPUWR', 1)
    .bit('ROMSEL', '/ROMSEL', 1)
    .bit('RAMSEL', '/RAMSEL', 1)
    .bus('PA', 'PA7–PA0 (bus B)')
    .bit('PARD', '/PARD', 1)
    .bit('PAWR', '/PAWR', 1)
    .bit('PPUSEL', 'PPU elegidas', 0, 'PA7 = PA6 = 0 con /PARD o /PAWR')
    .bit('APUSEL', 'Puertos del sonido', 0, 'PA7 = 0, PA6 = 1')
    .bit('WRAMB', 'Puerto de la WRAM', 0, 'PA = $80–$83')
    .bit('JPCLK', 'JPCLK1', 0, 'Reloj del mando 1')
    .bus('SEL', 'Selección');
}

/** One access from t0; returns its end. Strobes from the 3rd master cycle to the end (drawn, not measured). */
function acceso(c: Cronograma, t0: number, x: Acceso): number {
  if (x.interno) {
    const fin = t0 + 6 * TM;
    c.marca(t0);
    c.set('VEL', t0, `6 · interno`);
    c.set('SEL', t0, 'ciclo interno');
    c.set('SEL', fin, null);
    return fin;
  }
  const r = region(x.dir, x.escritura);
  const fin = t0 + r.ciclos * TM;
  const tS = t0 + 2 * TM;
  c.marca(t0);
  c.set('VEL', t0, `${r.ciclos} · ${mhz(N.xin / r.ciclos)}`);
  c.set('CA', t0, hex(x.dir, 6));
  c.set('CA', fin, null);
  const d = hex(x.dato, 2);
  if (r.bus === 'B') {
    c.set('PA', t0, hex(r.pa ?? 0, 2));
    c.set('PA', fin, null);
    c.set(x.escritura ? 'PAWR' : 'PARD', tS, 0);
    c.set(x.escritura ? 'PAWR' : 'PARD', fin, 1);
    const s = r.sel === 'PPU' ? 'PPUSEL' : r.sel === 'APU' ? 'APUSEL' : r.sel === 'WRAM B' ? 'WRAMB' : null;
    if (s) {
      c.set(s, tS, 1);
      c.set(s, fin, 0);
    }
  } else if (r.bus === 'A') {
    c.set(x.escritura ? 'CPUWR' : 'CPURD', tS, 0);
    c.set(x.escritura ? 'CPUWR' : 'CPURD', fin, 1);
  } else if ((x.dir & 0xffff) === 0x4016 && !x.escritura) {
    // reading $4016 clocks the controller of port 1 to its next button
    c.set('JPCLK', fin - 2 * TM, 1);
    c.set('JPCLK', fin + 4 * TM, 0);
  }
  if (r.sel === '/ROMSEL' || r.sel === '/RAMSEL') {
    const p = r.sel === '/ROMSEL' ? 'ROMSEL' : 'RAMSEL';
    c.set(p, t0 + 10e-9, 0);
    c.set(p, fin, 1);
  }
  c.set('SEL', t0, r.sel ?? (r.bus === 'interno' ? 'CPU interno' : 'nadie'));
  c.set('SEL', fin, null);
  if (r.bus !== 'interno') {
    c.set('D', x.escritura ? tS : fin - 1.5 * TM, d);
    c.set('D', fin, null);
  }
  return fin;
}

function escenarioCPU(id: string, titulo: string, descripcion: string, lista: Acceso[]): Escenario {
  const c = new Cronograma();
  senalesCPU(c);
  let t = 0;
  for (const x of lista) {
    const fin = acceso(c, t, x);
    c.paso(t, fin, x.interno ? `Ciclo interno: ${x.nota}` : `${x.escritura ? 'Escritura' : 'Lectura'} en ${hex(x.dir, 6)}: ${x.nota}`);
    t = fin;
  }
  c.reloj('XIN', 0, t, TM, 0.5);
  c.marca(t);
  return {
    id, titulo, descripcion, duracion: t, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas,
    realPorSegundo: (8 * TM) / 2.5,
    defecto: ['XIN', 'VEL', 'CA', 'D', 'CPURD', 'CPUWR', 'ROMSEL', 'RAMSEL', 'PA', 'PARD', 'PAWR', 'SEL'],
    fidelidad: `Exacto (${N.nombre}): el reloj maestro (${ns(TM)}), la duración de cada acceso según su zona (6, 8 o 12 ciclos maestros: ${ns(6 * TM)}, ${ns(8 * TM)} y ${ns(12 * TM)}; memmap.txt de anomie), qué bus se usa y qué selección baja. Ilustrativo: dónde empiezan /RD y /WR dentro del acceso (dibujados desde el tercer ciclo maestro) y el instante en que el dato es válido.`,
  };
}

const PROGRAMA: Acceso[] = [
  { dir: 0x008000, escritura: false, dato: 0xa9, nota: 'código de LDA #$8F (ROM del cartucho, /ROMSEL)' },
  { dir: 0x008001, escritura: false, dato: 0x8f, nota: 'el dato inmediato' },
  { dir: 0x008002, escritura: false, dato: 0x8d, nota: 'código de STA $2100' },
  { dir: 0x008003, escritura: false, dato: 0x00, nota: 'dirección, byte bajo' },
  { dir: 0x008004, escritura: false, dato: 0x21, nota: 'dirección, byte alto' },
  { dir: 0x002100, escritura: true, dato: 0x8f, nota: 'INIDISP = $8F (pantalla apagada): por el bus B, PA = $00 y /PAWR, en 6 ciclos' },
  { dir: 0x008005, escritura: false, dato: 0xad, nota: 'código de LDA $4016' },
  { dir: 0x008006, escritura: false, dato: 0x16, nota: 'dirección, byte bajo' },
  { dir: 0x008007, escritura: false, dato: 0x40, nota: 'dirección, byte alto' },
  { dir: 0x004016, escritura: false, dato: 0x01, nota: 'un botón del mando 1: registro interno de 12 ciclos; JPCLK1 pasa al siguiente' },
  { dir: 0x008008, escritura: false, dato: 0xaf, nota: 'código de LDA $7E0010 (dirección larga)' },
  { dir: 0x008009, escritura: false, dato: 0x10, nota: 'dirección, byte bajo' },
  { dir: 0x00800a, escritura: false, dato: 0x00, nota: 'dirección, byte medio' },
  { dir: 0x00800b, escritura: false, dato: 0x7e, nota: 'banco' },
  { dir: 0x7e0010, escritura: false, dato: 0x42, nota: 'la WRAM contesta con /RAMSEL' },
];

function escenarioDecodificar(op: Opciones): Escenario {
  const w = op.escritura === '1';
  if (op.espacio === 'b') {
    const pa = Math.max(0, Math.min(0xff, parseInt(op.dir ?? '0', 16) || 0));
    const dir = 0x002100 | pa;
    return escenarioCPU('decodificar', `Bus B: ${hex(pa, 2)}`, `Acceso a ${hex(dir, 6)}, que la CPU convierte en PA = ${hex(pa, 2)} en el bus B.`, [
      { dir: 0x008100, escritura: false, dato: w ? 0x8d : 0xad, nota: w ? 'STA abs' : 'LDA abs' },
      { dir: 0x008101, escritura: false, dato: pa, nota: 'dirección, byte bajo' },
      { dir: 0x008102, escritura: false, dato: 0x21, nota: 'dirección, byte alto' },
      { dir, escritura: w, dato: 0x5a, nota: decodificar(pa, w, 'b').zona },
    ]);
  }
  const dir = Math.max(0, Math.min(0xffffff, parseInt(op.dir ?? '0', 16) || 0));
  return escenarioCPU('decodificar', `Acceso a ${hex(dir, 6)}`, 'Instrucción con dirección larga leída del cartucho y el acceso a la dirección elegida, con su selección y su velocidad.', [
    { dir: 0x008100, escritura: false, dato: w ? 0x8f : 0xaf, nota: w ? 'STA largo' : 'LDA largo' },
    { dir: 0x008101, escritura: false, dato: dir & 0xff, nota: 'dirección, byte bajo' },
    { dir: 0x008102, escritura: false, dato: (dir >> 8) & 0xff, nota: 'dirección, byte medio' },
    { dir: 0x008103, escritura: false, dato: dir >> 16, nota: 'banco' },
    { dir, escritura: w, dato: 0x5a, nota: decodificar(dir, w).zona },
  ]);
}

// ------------------------------------------------------------------ DMA

function escenarioDMA(op: Opciones): Escenario {
  const aWram = op.destino === 'wram';
  const c = new Cronograma();
  senalesCPU(c);
  c.bit('VAWR', '/VAWR (VRAM U5)', 1).bit('VBWR', '/VBWR (VRAM U4)', 1).bus('CPU', 'CPU');
  let t = 0;
  c.set('CPU', 0, 'ejecuta');
  for (const x of [
    { dir: 0x008200, escritura: false, dato: 0x8d, nota: 'código de STA $420B' },
    { dir: 0x008201, escritura: false, dato: 0x0b, nota: 'dirección, byte bajo' },
    { dir: 0x008202, escritura: false, dato: 0x42, nota: 'dirección, byte alto' },
    { dir: 0x00420b, escritura: true, dato: 0x01, nota: 'MDMAEN = 1: arranca el canal 0' },
  ] as Acceso[]) {
    const fin = acceso(c, t, x);
    c.paso(t, fin, `${x.escritura ? 'Escritura' : 'Lectura'} en ${hex(x.dir, 6)}: ${x.nota}`);
    t = fin;
  }
  // alignment to a multiple of 8 master cycles, then 8 per transfer and 8 per channel
  const t0 = Math.ceil(t / (8 * TM) + 0.25) * 8 * TM;
  c.set('CPU', t, 'parada: DMA');
  c.marca(t);
  c.paso(t, t0 + 16 * TM, 'La CPU se para; la DMA espera a un múltiplo de 8 ciclos maestros y gasta 8 por la transferencia y 8 por el canal.');
  t = t0 + 16 * TM;
  const n = 8;
  for (let k = 0; k < n; k++) {
    const src = 0xc10000 + k;
    const pa = aWram ? 0x80 : 0x18 + (k & 1);
    const fin = t + 8 * TM;
    const tS = t + 2 * TM;
    c.marca(t);
    c.set('VEL', t, `8 · DMA`);
    c.set('CA', t, hex(src, 6));
    c.set('ROMSEL', t + 10e-9, 0);
    c.set('CPURD', tS, 0);
    c.set('PA', t, hex(pa, 2));
    c.set('PAWR', tS, 0);
    c.set(aWram ? 'WRAMB' : 'PPUSEL', tS, 1);
    c.set('D', t + 5 * TM, hex(0x10 * k + 3, 2));
    c.set('SEL', t, aWram ? '/ROMSEL → WRAM B' : '/ROMSEL → PPU');
    if (!aWram) {
      const p = k & 1 ? 'VBWR' : 'VAWR';
      c.set(p, fin - 1 * TM, 0);
      c.set(p, fin + 2 * TM, 1);
    }
    for (const s of ['CPURD', 'PAWR', 'ROMSEL'] as const) c.set(s, fin, 1);
    c.set(aWram ? 'WRAMB' : 'PPUSEL', fin, 0);
    for (const s of ['CA', 'PA', 'D', 'SEL', 'VEL'] as const) c.set(s, fin, null);
    c.paso(t, fin, aWram
      ? `Byte ${k + 1}: en el mismo acceso, la ROM lo pone en D0–D7 (bus A, ${hex(src, 6)}) y la WRAM lo toma por su puerto ($2180, bus B) y avanza su dirección.`
      : `Byte ${k + 1}: la ROM lo pone en D0–D7 (bus A, ${hex(src, 6)}) y la PPU1 lo toma en ${k & 1 ? '$2119, el byte alto (VRAM U4)' : '$2118, el byte bajo (VRAM U5)'} en el mismo acceso.`);
    t = fin;
  }
  c.set('CPU', t, 'sigue');
  c.paso(t, t + 8 * TM, 'Fin de la DMA: la CPU sigue con la instrucción siguiente.');
  const finT = t + 8 * TM;
  c.reloj('XIN', 0, finT, TM, 0.5);
  c.marca(finT);
  return {
    id: 'dma', titulo: 'DMA', descripcion: `DMA del canal 0 de la ROM ${aWram ? 'a la WRAM por su puerto del bus B ($2180)' : 'a la VRAM ($2118/$2119, modo de dos registros)'}: cada byte se lee en el bus A y se escribe en el bus B en el mismo acceso de 8 ciclos maestros, con la CPU parada.`,
    duracion: finT, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: (8 * TM) / 2.5,
    defecto: ['VEL', 'CA', 'ROMSEL', 'CPURD', 'D', 'PA', 'PAWR', aWram ? 'WRAMB' : 'PPUSEL', ...(aWram ? [] : ['VAWR', 'VBWR']), 'CPU'],
    fidelidad: `Exacto (${N.nombre}): 8 ciclos maestros por byte (${ns(8 * TM)}, ${coma(N.xin / 8 / 1e6, 2)} MB/s), la espera hasta un múltiplo de 8 ciclos, 8 de más por canal y 8 por transferencia, y que el bus A y el bus B se usan a la vez (superfamicom.org, «Timing»). Ilustrativo: la forma de las señales dentro de cada acceso y el instante de la escritura en la VRAM.`,
  };
}

// ------------------------------------------------------------------ one line: refresh and HDMA

function escenarioLinea(op: Opciones): Escenario {
  const canales = Number(op.canales ?? '2');
  const c = new Cronograma();
  c.bus('H', 'Punto (H)').bit('HBLANK', 'HBLANK (PPU2 → CPU)', 1).bit('REFRESCO', 'Refresco de la WRAM', 0, '40 ciclos maestros')
    .bit('HDMA', 'HDMA', 0).bus('CA', 'CA23–CA0 (bus A)').bus('PA', 'PA7–PA0 (bus B)').bus('CPU', 'CPU');
  for (let h = 0; h < 341; h++) c.set('H', h * 4 * TM, String(h));
  // the visible pixels: drawn from dot 22 to 277 (256 dots); HBLANK outside them
  c.set('HBLANK', 22 * 4 * TM, 0);
  c.set('HBLANK', 278 * 4 * TM, 1);
  c.set('CPU', 0, 'ejecuta');
  const tR = 536 * TM;
  c.set('REFRESCO', tR, 1);
  c.set('REFRESCO', tR + 40 * TM, 0);
  c.set('CPU', tR, 'parada: refresco');
  c.set('CPU', tR + 40 * TM, 'ejecuta');
  c.marca(tR);
  c.paso(0, tR, 'Imagen: la PPU dibuja y la CPU ejecuta el programa.');
  c.paso(tR, tR + 40 * TM, 'Hacia el ciclo 536 la CPU se para 40 ciclos maestros y la S-WRAM se refresca: en todas las líneas, haya o no imagen.');
  let t = 278 * 4 * TM;
  c.marca(t);
  c.set('HDMA', t, 1);
  c.set('CPU', t, 'parada: HDMA');
  const t0 = t;
  t += 18 * TM;
  for (let k = 0; k < canales; k++) {
    t += 8 * TM;
    for (let b = 0; b < 2; b++) {
      c.set('CA', t, hex(0xc18000 + 0x100 * k + 2 * 7 + b, 6));
      c.set('PA', t, hex([0x0d, 0x0e, 0x0f, 0x10, 0x21, 0x22, 0x26, 0x27][k]!, 2));
      t += 8 * TM;
    }
    c.set('CA', t, null);
    c.set('PA', t, null);
  }
  c.set('HDMA', t, 0);
  c.set('CPU', t, 'ejecuta');
  c.paso(t0, t, `Punto 278: empieza el HDMA. ${canales} canal${canales > 1 ? 'es' : ''} × 2 bytes (por ejemplo, el desplazamiento de un fondo) de una tabla de la ROM a registros de la PPU: unos 18 ciclos fijos, 8 por canal y 8 por byte = ${Math.round((t - t0) / TM)} ciclos maestros.`);
  c.paso(t, TL, 'Borrado horizontal: los cambios del HDMA ya están hechos para la línea siguiente.');
  c.marca(t);
  c.marca(TL);
  return {
    id: 'linea', titulo: 'Una línea: refresco y HDMA', descripcion: `Una línea de 1364 ciclos maestros (${us(TL)} en ${N.nombre}): la imagen, la pausa del refresco de la WRAM y el HDMA del borrado horizontal.`,
    duracion: TL, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: TL / 12,
    defecto: ['H', 'HBLANK', 'REFRESCO', 'HDMA', 'CA', 'PA', 'CPU'],
    fidelidad: `Exacto: 1364 ciclos maestros por línea (341 puntos de 4), la pausa de 40 ciclos hacia el ciclo 536 y el HDMA desde el punto 278 con su coste (unos 18 ciclos, 8 por canal y 8 por byte). Ilustrativo: la zona visible dibujada del punto 22 al 277 y la señal HBLANK (su flanco exacto no está documentado aquí), y las direcciones de las tablas.`,
  };
}

// ------------------------------------------------------------------ frame, NMI and joypads

function escenarioCuadro(op: Opciones): Escenario {
  const sobre = op.overscan === '240';
  const nl = N.lineas;
  const vb = sobre ? 240 : 225;
  const c = new Cronograma();
  c.bus('LINEA', 'Línea (V)').bit('VBLANK', 'Borrado vertical', 0).bit('NMI', '/NMI (interna)', 1)
    .bit('JOY', 'Lectura automática de los mandos', 0, '4224 ciclos maestros').bit('JPSTR', 'JPSTR', 0).bus('CPU', 'CPU');
  for (let l = 0; l < nl; l++) c.set('LINEA', l * TL, String(l));
  c.set('CPU', 0, 'lógica del juego');
  const tv = vb * TL;
  c.set('VBLANK', tv, 1);
  c.set('NMI', tv + 2 * TM, 0);
  c.set('CPU', tv + 2 * TM, 'NMI: copia OAM, paleta y VRAM con DMA');
  const tLee = tv + 40 * 4 * TM;
  c.set('NMI', tLee, 1);
  const tJ = tv + 74.5 * 4 * TM;
  c.set('JOY', tJ, 1);
  c.set('JPSTR', tJ, 1);
  c.set('JPSTR', tJ + 12 * TM * 4, 0);
  c.set('JOY', tJ + 4224 * TM, 0);
  const tFin = tv + 12 * TL;
  c.set('CPU', tFin, 'espera');
  c.set('VBLANK', nl * TL - 1e-9, 0);
  c.marca(tv);
  c.marca(tJ);
  c.marca(tFin);
  c.paso(0, tv, `Líneas 0–${vb - 1}: imagen (${vb - 1} visibles; la 0 no se ve). La CPU ejecuta el juego; el HDMA se prepara en la línea 0.`);
  c.paso(tv, tJ, `Línea ${vb}: empieza el borrado y la CPU recibe la NMI. La rutina lee $4210 (suelta /NMI) y copia la OAM, la paleta y la VRAM, que solo se pueden tocar ahora.`);
  c.paso(tJ, tJ + 4224 * TM, `Mientras, la CPU lee sola los dos mandos: JPSTR los congela y 16 impulsos de JPCLK sacan los botones a $4218–$421B (${us(4224 * TM)}).`);
  c.paso(tJ + 4224 * TM, nl * TL, `Resto del borrado hasta la línea ${nl - 1}.`);
  const fin = nl * TL;
  c.marca(fin);
  return {
    id: 'cuadro', titulo: 'Cuadro, NMI y mandos', descripcion: `Un cuadro ${N.nombre} de ${nl} líneas de ${us(TL)} (${hz()}): imagen, NMI al empezar el borrado en la línea ${vb} y lectura automática de los mandos.`,
    duracion: fin, escala: 'ms', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 20, ventana: [(vb - 20) * TL, Math.min(nl, vb + 40) * TL],
    defecto: ['LINEA', 'VBLANK', 'NMI', 'JOY', 'JPSTR', 'CPU'],
    fidelidad: `Exacto: ${nl} líneas de 1364 ciclos maestros (${N.nombre}; en NTSC se ignora la línea corta), el borrado desde la línea 225 o 240 (bit 2 de $2133), /NMI bajo desde el punto 0,5 hasta leer $4210 y la lectura automática de 4224 ciclos que empieza entre los puntos 32,5 y 95,5 (aquí, 74,5, como en el primer cuadro). Ilustrativo: cuánto tarda la rutina de la NMI en leer $4210 y en acabar.`,
  };
}

// ------------------------------------------------------------------ CPU ↔ sound CPU ports

function escenarioPuertos(): Escenario {
  const c = new Cronograma();
  const TS = 24 / APU; // SPC700 cycle, 976.6 ns
  c.bus('PA', 'PA7–PA0 (bus B)').bus('D', 'D7–D0').bit('PAWR', '/PAWR', 1).bit('PARD', '/PARD', 1).bit('APUSEL', 'Puertos del sonido', 0)
    .bus('P0E', 'Puerto 0: CPU → SPC700', 'Lo escribe la CPU en $2140; el SPC700 lo lee en $F4')
    .bus('P0S', 'Puerto 0: SPC700 → CPU', 'Lo escribe el SPC700 en $F4; la CPU lo lee en $2140')
    .bit('SPCCLK', 'Reloj del SPC700 (1,024 MHz)', 1).bus('SPCA', 'Dirección del SPC700').bus('CPU', 'CPU').bus('SPC', 'SPC700');
  const acc = (t: number, w: boolean, v: number): number => {
    const fin = t + 6 * TM;
    c.set('PA', t, '$40');
    c.set(w ? 'PAWR' : 'PARD', t + 2 * TM, 0);
    c.set('APUSEL', t + 2 * TM, 1);
    c.set('D', w ? t + 2 * TM : fin - 1.5 * TM, hex(v, 2));
    for (const s of ['PAWR', 'PARD'] as const) c.set(s, fin, 1);
    c.set('APUSEL', fin, 0);
    c.set('PA', fin, null);
    c.set('D', fin, null);
    c.marca(t);
    return fin;
  };
  c.set('P0E', 0, '$00');
  c.set('P0S', 0, '$AA');
  c.set('CPU', 0, 'escribe $CC en $2140');
  let t = 0.2e-6;
  const tW = t;
  t = acc(t, true, 0xcc);
  c.set('P0E', t - 2 * TM, '$CC');
  c.paso(0, t, 'La CPU escribe $CC en $2140 (bus B, PA = $40, /PAWR): el byte se queda en el puerto 0 de entrada del S-SMP.');
  // the SPC700 polls $F4 in a loop of ~8 cycles; it sees $CC on its next read and echoes it
  let tVe = 0;
  for (let k = 0; tVe <= tW + 6 * TM; k++) {
    tVe = (2 + 8 * k) * TS;
    c.set('SPCA', tVe, '$00F4');
    c.set('SPCA', tVe + TS, null);
  }
  const tEco = tVe + 5 * TS;
  c.set('SPC', 0, 'espera: lee $F4');
  c.set('SPC', tVe, 've $CC');
  c.set('SPCA', tEco, '$00F4');
  c.set('SPCA', tEco + TS, null);
  c.set('P0S', tEco + 0.5 * TS, '$CC');
  c.set('SPC', tEco, 'escribe $CC en $F4');
  c.set('SPC', tEco + TS, 'empieza la carga');
  c.marca(tVe);
  c.marca(tEco);
  c.paso(tVe - 2 * TS, tEco, 'El SPC700 está en un bucle que lee $F4 cada pocos ciclos de su reloj (976,6 ns cada uno); en la siguiente lectura ve $CC.');
  c.paso(tEco, tEco + 2 * TS, 'Contesta escribiendo $CC en $F4: es otro registro, el de salida hacia la CPU.');
  // the CPU polls $2140 until it reads $CC
  c.set('CPU', t, 'lee $2140 hasta ver $CC');
  let tc = t + 0.6e-6;
  let visto = false;
  while (!visto) {
    const v = tc > tEco + 0.5 * TS ? 0xcc : 0xaa;
    tc = acc(tc, false, v);
    if (v === 0xcc) visto = true;
    else tc += 1.4e-6;
  }
  c.set('CPU', tc, 'sigue: el SPC700 está listo');
  c.paso(tEco + 2 * TS, tc, 'La CPU, que leía $2140 en bucle, ve por fin $CC: los dos lados están de acuerdo y puede empezar a mandarle el programa de sonido byte a byte con el mismo protocolo.');
  const fin = tc + 1e-6;
  c.reloj('SPCCLK', 0, fin, TS, 0.5);
  c.marca(fin);
  return {
    id: 'puertos', titulo: 'CPU ↔ CPU del sonido', descripcion: 'La CPU y el SPC700 tienen relojes distintos y no comparten memoria: se hablan por cuatro puertos de 8 bits, cada uno con un registro en cada sentido, preguntando en bucle.',
    duracion: fin, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 14,
    defecto: ['PA', 'D', 'PAWR', 'PARD', 'P0E', 'P0S', 'SPCCLK', 'SPCA', 'CPU', 'SPC'],
    fidelidad: `Exacto: los relojes (accesos de 6 ciclos maestros, ${ns(6 * TM)}, en el bus B; SPC700 a 24,576 MHz ÷ 24 = 1,024 MHz), las direcciones ($2140 y $F4, PA = $40) y que cada puerto son dos registros, uno por sentido. Ilustrativo: la duración de los bucles de espera de los dos programas.`,
  };
}

// ------------------------------------------------------------------ S-DSP to DAC

function escenarioSonido(): Escenario {
  const c = new Cronograma();
  const fs = APU / 768; // 32 kHz
  const T = 1 / fs;
  const TB = T / 32; // 16 bits per channel (drawn)
  c.bit('LRCK', 'LRCK (32 kHz)', 1, 'Izquierda arriba, derecha abajo').bit('BCK', 'BCK (reloj de bit)', 1).bus('DATA', 'DATA (serie)')
    .bus('ARAM', 'ARAM (S-DSP)', 'Lecturas de muestras BRR de cada voz').bus('VOZ', 'Voz');
  const muestras: [number, number][] = [[0x1a2b, 0xf3c4], [0x1c00, 0xf1e0]];
  for (let k = 0; k < 2; k++) {
    const t0 = k * T;
    c.set('LRCK', t0, 1);
    c.set('LRCK', t0 + T / 2, 0);
    const [l, r] = muestras[k]!;
    c.set('DATA', t0, `L ${hex(l, 4)}`);
    c.set('DATA', t0 + T / 2, `R ${hex(r, 4)}`);
    for (let v = 0; v < 8; v++) {
      const tv = t0 + (v * T) / 8;
      c.set('VOZ', tv, `voz ${v}`);
      c.set('ARAM', tv + T / 32, hex(0x2000 + 0x400 * v + 9 * k, 4));
      c.set('ARAM', tv + T / 32 + 0.5e-6, null);
      c.marca(tv);
    }
    c.paso(t0, t0 + T / 2, `Muestra ${k + 1}, izquierda: el S-DSP manda los 16 bits del canal izquierdo, un bit por cada flanco de BCK; mientras, ya calcula la siguiente leyendo de la ARAM las muestras BRR de las ocho voces.`);
    c.paso(t0 + T / 2, t0 + T, `Muestra ${k + 1}, derecha. El µPD6376 convierte cada palabra cuando cambia LRCK.`);
  }
  const fin = 2 * T;
  c.reloj('BCK', 0, fin, TB, 0.5);
  c.marca(fin);
  return {
    id: 'sonido', titulo: 'Del S-DSP al DAC', descripcion: 'Cada 31,25 µs (32 kHz) el S-DSP mezcla las ocho voces y manda una muestra estéreo de 16 bits por canal, en serie, al DAC.',
    duracion: fin, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 16,
    defecto: ['LRCK', 'BCK', 'DATA', 'VOZ', 'ARAM'],
    fidelidad: 'Exacto: 32 kHz = 24,576 MHz ÷ 768, 16 bits por canal, las ocho voces y el reparto izquierda/derecha por LRCK (redes BCK, LRCK y DATA del esquema). Ilustrativo: el reloj de bit dibujado a 32 periodos por muestra, el orden y el instante de las lecturas de la ARAM y los valores.',
  };
}

// ------------------------------------------------------------------ clocks

function escenarioRelojes(): Escenario {
  const c = new Cronograma();
  const fin = 24 * TM;
  const pal = N.id === 'pal';
  if (pal) c.bit('X1', `X1 ${mhz(X1_PAL, 6)}`, 1);
  c.bit('XIN', `XIN ${mhz(N.xin, 5)}${pal ? ' (× 6/5)' : ''}`, 1)
    .bit('PIX', `Punto (÷ 4) ${mhz(N.xin / 4)}`, 1)
    .bit('C6', `CPU rápida (÷ 6) ${mhz(N.xin / 6)}`, 1)
    .bit('C8', `CPU lenta (÷ 8) ${mhz(N.xin / 8)}`, 1)
    .bit('C12', `Mandos (÷ 12) ${mhz(N.xin / 12)}`, 1)
    .bit('SUB', `Subportadora ${mhz(pal ? X1_PAL / 4 : N.xin / 6, 4)}`, 1);
  if (pal) c.bit('CIC', `CIC (X1 ÷ 5) ${mhz(X1_PAL / 5, 4)}`, 1);
  c.bit('SPC', 'SPC700 (24,576 MHz ÷ 24) 1,024 MHz', 1);
  if (pal) c.reloj('X1', 0, fin, 1 / X1_PAL);
  c.reloj('XIN', 0, fin, TM);
  c.reloj('PIX', 0, fin, 4 * TM);
  c.reloj('C6', 0, fin, 6 * TM, 4 / 6);
  c.reloj('C8', 0, fin, 8 * TM, 4 / 8);
  c.reloj('C12', 0, fin, 12 * TM, 6 / 12);
  c.reloj('SUB', 0, fin, pal ? 4 / X1_PAL : 6 * TM);
  if (pal) c.reloj('CIC', 0, fin, 5 / X1_PAL);
  c.reloj('SPC', 0, fin, 24 / APU);
  for (let k = 0; k <= 24; k++) c.marca(k * TM);
  c.paso(0, fin, pal
    ? 'Un cristal de vídeo, X1, a cuatro veces la subportadora PAL. El S-CLK saca de él XIN (× 6/5), la subportadora (÷ 4) y el reloj del CIC (÷ 5). La CPU cuenta 6, 8 o 12 ciclos de XIN por acceso y la PPU 4 por punto. El sonido va con su propio resonador: no tiene relación con los demás.'
    : 'En las NTSC el cristal es directamente XIN (945/44 MHz = seis veces la subportadora NTSC): no hay S-CLK. La CPU cuenta 6, 8 o 12 ciclos por acceso y la PPU 4 por punto. El sonido va con su propio resonador.');
  return {
    id: 'relojes', titulo: 'Relojes', descripcion: pal ? 'Del cristal de 17,734475 MHz a todo lo demás, y el reloj aparte del sonido.' : 'El cristal de 21,477 MHz y sus divisiones, y el reloj aparte del sonido.',
    duracion: fin, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 8,
    defecto: pal ? ['X1', 'XIN', 'PIX', 'C6', 'C8', 'C12', 'SUB', 'CIC', 'SPC'] : ['XIN', 'PIX', 'C6', 'C8', 'C12', 'SUB', 'SPC'],
    fidelidad: pal
      ? 'Exacto: las frecuencias (X1 de 17,734475 MHz en el esquema; 21,28137 MHz = X1 × 6/5; subportadora X1 ÷ 4; CIC X1 ÷ 5 según las patillas del S-CLK; punto ÷ 4; accesos ÷ 6, 8 y 12; SPC700 a 1,024 MHz). Ilustrativo: la fase relativa y el ciclo de trabajo de cada reloj (la CPU no tiene un reloj cuadrado: alarga o acorta cada acceso).'
      : 'Exacto: 21,477272 MHz (945/44 MHz), punto ÷ 4, accesos ÷ 6, 8 y 12, subportadora ÷ 6 (3,579545 MHz) y SPC700 a 1,024 MHz. Ilustrativo: las fases relativas.',
  };
}

export const SNES: Maquina = {
  id: 'snes',
  diagrama: diagramaDe('pal'),
  diagramaDe,
  variantes: [
    { id: 'pal', titulo: 'PAL · 50 Hz', nota: 'PAL, como la placa de las fotos y la del esquema (SNSP-CPU-01, S-CLK con X1 de 17,734475 MHz): XIN de 21,28137 MHz, 312 líneas de 64,09 µs (50,007 Hz).' },
    { id: 'ntsc', titulo: 'NTSC · 60 Hz', nota: 'NTSC (Japón y América, placas SHVC-CPU-01): XIN de 21,477272 MHz con su propio cristal, sin S-CLK, 262 líneas de 63,51 µs (60,10 Hz).' },
  ],
  digitos: 6,
  dirInicial: '002118',
  espacios: [
    { id: 'a', titulo: 'CPU (24 bits)', digitos: 6 },
    { id: 'b', titulo: 'Bus B (PA0–PA7)', digitos: 2 },
  ],
  notaDecodificador: 'Las direcciones $2100–$21FF de los bancos bajos salen por el bus B: la CPU pone su byte bajo en PA0–PA7.',
  decodificar,
  escenarios: [
    { id: 'bus', titulo: 'Accesos de la CPU', crear: conNorma(() => escenarioCPU('bus', 'Accesos de la CPU', `Tres instrucciones: escribir un registro de la PPU por el bus B, leer el mando y leer la WRAM. Cada acceso dura 6, 8 o 12 ciclos de XIN (${ns(TM)} en ${N.nombre}) según la zona.`, PROGRAMA)) },
    { id: 'decodificar', titulo: 'Decodificar una dirección', crear: conNorma(escenarioDecodificar) },
    { id: 'dma', titulo: 'DMA', crear: conNorma(escenarioDMA) },
    { id: 'linea', titulo: 'Una línea: refresco y HDMA', crear: conNorma(escenarioLinea) },
    { id: 'cuadro', titulo: 'Cuadro, NMI y mandos', crear: conNorma(escenarioCuadro) },
    { id: 'puertos', titulo: 'CPU ↔ CPU del sonido', crear: conNorma(escenarioPuertos) },
    { id: 'sonido', titulo: 'Del S-DSP al DAC', crear: conNorma(escenarioSonido) },
    { id: 'relojes', titulo: 'Relojes', crear: conNorma(escenarioRelojes) },
  ],
  ejemplos: [
    { dir: 0x008000, escritura: false, texto: 'ROM', espacio: 'a' },
    { dir: 0x7e0010, escritura: true, texto: 'WRAM', espacio: 'a' },
    { dir: 0x801234, escritura: false, texto: 'espejo WRAM', espacio: 'a' },
    { dir: 0x002118, escritura: true, texto: 'VRAM', espacio: 'a' },
    { dir: 0x002140, escritura: true, texto: 'sonido', espacio: 'a' },
    { dir: 0x004016, escritura: false, texto: 'mando 1', espacio: 'a' },
    { dir: 0x00420b, escritura: true, texto: 'DMA', espacio: 'a' },
    { dir: 0x80, escritura: true, texto: 'WRAM', espacio: 'b' },
    { dir: 0x3f, escritura: false, texto: 'STAT78', espacio: 'b' },
  ],
  opciones: [
    { id: 'destino', titulo: 'Destino', escenarios: ['dma'], valores: [{ v: 'vram', texto: 'VRAM ($2118/$2119)' }, { v: 'wram', texto: 'WRAM ($2180)' }] },
    { id: 'canales', titulo: 'Canales de HDMA', escenarios: ['linea'], valores: [{ v: '2', texto: '2' }, { v: '4', texto: '4' }, { v: '8', texto: '8' }] },
    { id: 'overscan', titulo: 'Líneas visibles', escenarios: ['cuadro'], valores: [{ v: '224', texto: '224 (borrado en la 225)' }, { v: '240', texto: '239 (borrado en la 240)' }] },
  ],
};
