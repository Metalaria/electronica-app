// Game Boy (DMG-CPU-06 / -05 with the DMG-CPU B SoC): board and SoC-interior diagrams, address decoding and the
// timed scenarios. Helpers are exported for the Game Boy Color (gbc.ts).
//
// Timing figures:
//   - clock: crystal 4.194304 MHz (2^22 Hz) between CK1 and CK2; one machine cycle (M-cycle) = 4 clock periods
//     = 953.7 ns; PHI on the cartridge = 1.048576 MHz, high during the first half of the M-cycle.
//   - external bus (Gekkio, «Game Boy: Complete Technical Reference», appendix C, figures C.8–C.11, pp. 173–174):
//     idle cycle: A15 and CS high, RD low, WR high; read of 0x0000–0x7FFF: address from 1/8 of the cycle, A15 low
//     from 1/4 to the end, data valid from about 1/4 and sampled at 3/4; read of 0xA000–0xFDFF: the same with CS
//     low instead of A15; write: RD goes high at 1/4, WR low from 1/2 to 7/8, data from 1/2; 0xFE00–0xFFFF:
//     internal, the external bus stays idle; OAM DMA reads keep A15 (or CS) low for the whole cycle.
//   - PPU (Pan Docs «Rendering», «STAT»): 456 dots per line, 154 lines (144 visible + 10 of VBlank), 70224 dots
//     per frame (59.73 Hz); mode 2 (OAM scan) 80 dots, mode 3 (drawing) 172–289 dots, mode 0 (HBlank) the rest,
//     mode 1 (VBlank) lines 144–153; VBlank interrupt at LY = 144; STAT interrupt sources LYC = LY and modes 0/1/2.
//   - OAM DMA (Pan Docs «OAM DMA Transfer»; GBCTR ch. 8): writing $FF46 copies 160 bytes in 160 M-cycles from
//     $XX00; during it the CPU can only use HRAM.
//   - MBC1 (Pan Docs «MBC1»): writes to $2000–$3FFF select the 16 KB ROM bank seen at $4000–$7FFF.

import { Cronograma, hex, type Escenario } from './modelo';
import type { Decodificacion, Diagrama, Maquina, Opciones } from './diagrama';

export const FX = 4194304;
export const TC = 1 / FX; // dot / clock period (238.4 ns)
export const TMC = 4 * TC; // M-cycle (953.7 ns)

// ------------------------------------------------------------------ board diagram

const placa: Diagrama = {
  ancho: 1000,
  alto: 450,
  bloques: [
    { id: 'osc', x: 30, y: 18, w: 160, h: 56, titulo: 'Cristal', sub: 'X1 · 4,194304 MHz', foto: 'xtal', esquema: ['X1'],
      actividad: [{ pista: 'CLK', nivel: 1 }],
      info: '2²² Hz entre CK1 y CK2 del SoC, que genera el reloj de punto de la PPU (4 MHz) y PHI (1 MHz) para el cartucho.' },
    { id: 'soc', x: 250, y: 100, w: 260, h: 160, titulo: 'SoC DMG-CPU B', sub: 'U1 · SM83 + PPU + APU + HRAM', foto: 'soc', esquema: ['U1'],
      actividad: [{ pista: 'RD' }, { pista: 'MODO3', nivel: 1 }],
      info: 'Contiene la CPU, la PPU, el sonido, los temporizadores, la OAM, la HRAM y la ROM de arranque. Hacia fuera tiene dos buses: A0–A15/D0–D7 (cartucho y WRAM) y MA0–MA12/MD0–MD7 (VRAM), que trabajan a la vez.' },
    { id: 'vram', x: 600, y: 100, w: 170, h: 72, titulo: 'VRAM 8 KB', sub: 'U2 · LH5164 · $8000–$9FFF', foto: 'vram', esquema: ['U2'],
      actividad: [{ pista: 'MCS' }],
      info: 'Tiles y mapas de fondo. Solo la ve el SoC por MA/MD: la PPU la lee mientras dibuja (modo 3) y la CPU, en el resto de modos.' },
    { id: 'lcd', x: 600, y: 230, w: 190, h: 82, titulo: 'Pantalla', sub: 'placa DMG-LCD-06 · LH5076/LH5077', foto: 'f-lcd', esquema: ['J2'],
      actividad: [{ pista: 'CP', nivel: 1 }],
      info: 'El SoC le manda 2 bits por píxel (LD0, LD1) con el reloj CP, el pulso de línea CPL, el de cuadro S, la alternancia FR y el arranque de línea ST. Los drivers de columnas y filas reparten la tensión por la matriz de 160 × 144.' },
    { id: 'wram', x: 250, y: 350, w: 150, h: 72, titulo: 'WRAM 8 KB', sub: 'U3 · LH5164 · $C000–$DFFF', foto: 'wram', esquema: ['U3'],
      actividad: [{ pista: 'WRAMSEL', nivel: 1 }],
      info: 'En el bus del cartucho: /CE1 = /CS y CE2 = A14, así que solo responde en $C000–$FDFF (con espejo en $E000–$FDFF), no en la RAM del cartucho ($A000–$BFFF).' },
    { id: 'cart', x: 30, y: 350, w: 190, h: 72, titulo: 'Cartucho', sub: 'P1 · ROM + MBC + RAM', foto: 'cart', esquema: ['P1'], externo: true,
      actividad: [{ pista: 'A15' }, { pista: 'CARTRAM', nivel: 1 }],
      info: 'La ROM responde con A15 bajo ($0000–$7FFF); la RAM del cartucho con /CS bajo y A14 bajo ($A000–$BFFF). El MBC captura las escrituras en $0000–$7FFF como registros de banco.' },
    { id: 'mandos', x: 820, y: 230, w: 160, h: 82, titulo: 'Botones', sub: 'P10–P15 · $FF00', foto: 'f-dpad', esquema: ['LCD-SW1'],
      info: 'Matriz 2 × 4: el SoC baja P14 (dirección) o P15 (botones) y lee P10–P13.' },
    { id: 'link', x: 30, y: 110, w: 130, h: 64, titulo: 'Puerto de enlace', sub: 'P2', foto: 'link', esquema: ['P2'],
      actividad: [{ pista: 'SCK', nivel: 0 }],
      info: 'Puerto serie de 8 bits ($FF01–$FF02) a 8192 Hz con el reloj interno.' },
    { id: 'audio', x: 30, y: 200, w: 130, h: 64, titulo: 'Audio', sub: 'U4 IR3R40 · RV1', foto: 'amp', esquema: ['U4', 'RV1'],
      info: 'SO1 y SO2 del APU pasan por el volumen y el amplificador al altavoz y los auriculares. VIN trae audio del cartucho.' },
    { id: 'alim', x: 820, y: 360, w: 160, h: 62, titulo: 'Alimentación', sub: 'SW1 · DC1 · placa DC-DC', foto: 'sw', esquema: ['SW1', 'DC1'],
      info: 'Cuatro pilas AA o la toma de 6 V; la placa de alimentación saca +5 V y la tensión negativa de la pantalla.' },
  ],
  conexiones: [
    { id: 'clk', puntos: [[190, 46], [300, 46], [300, 100]], bits: 1, etiqueta: 'CK1/CK2', pos: [245, 40], clase: 'reloj', pista: 'CLK', nivel: 1, red: 'Net-(U1-CK1)' },
    { id: 'phi', puntos: [[270, 260], [270, 300], [150, 300], [150, 350]], bits: 1, etiqueta: 'PHI', pos: [200, 294], clase: 'reloj', pista: 'PHI', nivel: 1, red: '/PHI' },
    { id: 'bus-a', puntos: [[30, 330], [520, 330]], bits: 16, etiqueta: 'A0–A15', pos: [460, 324], clase: 'bus', pista: 'A', valor: true, red: '/A0' },
    { id: 'bus-d', puntos: [[30, 340], [520, 340]], bits: 8, etiqueta: 'D0–D7', pos: [470, 352], clase: 'dato', pista: 'D', valor: true, red: '/D0' },
    { id: 'soc-a', puntos: [[320, 260], [320, 330]], bits: 16, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'soc-d', puntos: [[360, 260], [360, 340]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'cart-a', puntos: [[80, 330], [80, 350]], bits: 16, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'wram-a', puntos: [[300, 330], [300, 350]], bits: 13, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'rd', puntos: [[400, 260], [400, 300], [560, 300], [560, 400], [400, 400]], bits: 1, etiqueta: '/RD', pos: [570, 380], clase: 'control', pista: 'RD', nivel: 0, red: '/~{RD}' },
    { id: 'wr', puntos: [[420, 260], [420, 290], [575, 290], [575, 415], [400, 415]], bits: 1, etiqueta: '/WR', pos: [590, 420], clase: 'control', pista: 'WR', nivel: 0, red: '/~{WR}' },
    { id: 'cs', puntos: [[440, 260], [440, 280], [540, 280], [540, 370], [400, 370]], bits: 1, etiqueta: '/CS', pos: [520, 362], clase: 'seleccion', pista: 'CS', nivel: 0, red: '/~{CS}' },
    { id: 'a15', puntos: [[260, 260], [260, 310], [200, 310], [200, 350]], bits: 1, etiqueta: 'A15', pos: [230, 318], clase: 'seleccion', pista: 'A15', nivel: 0, red: '/A15' },
    { id: 'ma', puntos: [[510, 120], [600, 120]], bits: 13, etiqueta: 'MA0–MA12', pos: [555, 112], clase: 'bus', pista: 'MA', valor: true, red: '/MA0' },
    { id: 'md', puntos: [[510, 145], [600, 145]], bits: 8, etiqueta: 'MD0–MD7', pos: [555, 157], clase: 'dato', pista: 'MD', valor: true, red: '/MD0' },
    { id: 'mcs', puntos: [[510, 168], [585, 168], [585, 160], [600, 160]], bits: 1, etiqueta: '', clase: 'seleccion', pista: 'MCS', nivel: 0, red: '/~{MCS}' },
    { id: 'lcdbus', puntos: [[510, 240], [600, 240]], bits: 2, etiqueta: 'LD0, LD1, CP', pos: [555, 232], clase: 'dato', pista: 'CP', nivel: 1, red: '/LD0' },
    { id: 'sync', puntos: [[510, 255], [600, 255]], bits: 4, etiqueta: 'CPL, ST, S, FR', pos: [555, 268], clase: 'control', pista: 'CPL', nivel: 1, red: '/CPL' },
    { id: 'joy', puntos: [[510, 205], [810, 205], [810, 260], [820, 260]], bits: 6, etiqueta: 'P10–P15', pos: [700, 198], clase: 'control', red: '/P10' },
    { id: 'ser', puntos: [[250, 140], [160, 140]], bits: 3, etiqueta: 'SCK, SIN, SOUT', pos: [205, 132], clase: 'control', pista: 'SCK', nivel: 0, red: '/SCK' },
    { id: 'so', puntos: [[250, 230], [160, 230]], bits: 2, etiqueta: 'SO1, SO2', pos: [205, 222], clase: 'control', red: '/SO1' },
  ],
};

// ------------------------------------------------------------------ inside the SoC (msinger, root sheet of dmg_cpu_b)

const interior: Diagrama = {
  ancho: 1000,
  alto: 560,
  bloques: [
    { id: 'clk', x: 20, y: 20, w: 170, h: 60, titulo: 'CLOCKS AND RESET', sub: 'fases del SM83, PHI', actividad: [{ pista: 'CLK', nivel: 1 }],
      info: 'Divide el reloj del cristal en las fases del ciclo de máquina y saca PHI. También genera el reset.' },
    { id: 'cpu', x: 20, y: 110, w: 170, h: 120, titulo: 'CPU SM83', sub: 'núcleo de 8 bits', actividad: [{ pista: 'A' }],
      info: 'Núcleo parecido al 8080/Z80 (sin IX/IY ni segundo banco de registros). Un ciclo de máquina por acceso a memoria.' },
    { id: 'boot', x: 220, y: 20, w: 140, h: 60, titulo: 'BOOT ROM', sub: '256 bytes · $0000–$00FF', info: 'Se ve en $0000–$00FF hasta que el programa escribe en $FF50.' },
    { id: 'dec', x: 220, y: 110, w: 140, h: 120, titulo: 'SYS DECODE', sub: 'qué responde a cada dirección', actividad: [{ pista: 'A' }],
      info: 'Elige entre la ROM de arranque, la HRAM, los registros de E/S, la VRAM, la OAM y el bus externo según la dirección.' },
    { id: 'hram', x: 390, y: 20, w: 120, h: 60, titulo: 'HRAM', sub: '127 B · $FF80–$FFFE', actividad: [{ pista: 'HRAM', nivel: 1 }],
      info: 'RAM interna, la única que la CPU puede usar durante la DMA de OAM.' },
    { id: 'ext', x: 220, y: 270, w: 140, h: 80, titulo: 'EXT ADDR/DATA BUSES', sub: 'A0–A15, D0–D7, RD, WR, CS', actividad: [{ pista: 'A15' }, { pista: 'CS' }, { pista: 'WR' }],
      info: 'Los buffers del bus del cartucho y la WRAM, con la temporización de las figuras C.9–C.11 de GBCTR.' },
    { id: 'int', x: 20, y: 270, w: 170, h: 80, titulo: 'FF0F INT / FFFF IE', sub: 'peticiones de interrupción', actividad: [{ pista: 'IRQ', nivel: 1 }],
      info: 'VBlank ($40), STAT ($48), temporizador ($50), serie ($58) y botones ($60).' },
    { id: 'timer', x: 20, y: 380, w: 110, h: 60, titulo: 'TIMER', sub: 'FF04–FF07', info: 'Divisor y temporizador programable.' },
    { id: 'serial', x: 140, y: 380, w: 110, h: 60, titulo: 'SERIAL', sub: 'FF01–FF02', info: 'Registro de desplazamiento del puerto de enlace.' },
    { id: 'joyp', x: 260, y: 380, w: 100, h: 60, titulo: 'JOYP', sub: 'FF00', info: 'Selección de fila (P14, P15) y lectura de P10–P13.' },
    { id: 'apu', x: 20, y: 470, w: 340, h: 66, titulo: 'APU', sub: '2 pulsos, onda, ruido · SO1, SO2', info: 'Cuatro canales y la mezcla estéreo hacia SO1 y SO2.' },
    { id: 'dma', x: 400, y: 110, w: 120, h: 70, titulo: 'DMA FF46', sub: 'OAM DMA', actividad: [{ pista: 'DMA', nivel: 1 }],
      info: 'Copia 160 bytes de $XX00 a la OAM, un byte por ciclo de máquina, por el bus externo o el de VRAM.' },
    { id: 'oam', x: 560, y: 110, w: 130, h: 70, titulo: 'OAM', sub: '160 B · 40 sprites', actividad: [{ pista: 'OAMB', nivel: 1 }],
      info: 'Atributos de los 40 sprites. La PPU la recorre en el modo 2 (80 puntos) y elige hasta 10 sprites de la línea.' },
    { id: 'vif', x: 560, y: 20, w: 200, h: 60, titulo: 'VRAM INTERFACE', sub: 'MA0–MA12, MD0–MD7', actividad: [{ pista: 'MCS' }],
      info: 'El bus de la VRAM. En el modo 3 lo usa la PPU (mapa, tiles, sprites); fuera de él, la CPU.' },
    { id: 'ppu', x: 560, y: 210, w: 230, h: 140, titulo: 'PPU', sub: 'fondo, ventana, 10 sprites, FIFO, paletas', actividad: [{ pista: 'MODO3', nivel: 1 }],
      info: 'Busca tiles del fondo y de la ventana, mezcla los sprites elegidos en el modo 2 en la cola de píxeles (FIFO) y aplica las paletas BGP/OBP0/OBP1.' },
    { id: 'stat', x: 820, y: 210, w: 160, h: 60, titulo: 'FF41 STAT', sub: 'modo y LYC = LY', actividad: [{ pista: 'STATI', nivel: 1 }],
      info: 'Lleva el modo actual y pide la interrupción STAT en los modos 0, 1, 2 o con LY = LYC.' },
    { id: 'lcdout', x: 820, y: 300, w: 160, h: 70, titulo: 'LCD', sub: 'LD0/LD1, CP, CPL, ST, S, FR', actividad: [{ pista: 'CP', nivel: 1 }],
      info: 'Saca los píxeles hacia los drivers de la pantalla.' },
  ],
  conexiones: [
    { id: 'ib', puntos: [[190, 170], [220, 170]], bits: 16, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'ib2', puntos: [[360, 140], [400, 140]], bits: 16, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'hr', puntos: [[360, 120], [380, 120], [380, 50], [390, 50]], bits: 8, etiqueta: '', clase: 'dato', pista: 'HRAM', nivel: 1 },
    { id: 'boot', puntos: [[290, 80], [290, 110]], bits: 8, etiqueta: '', clase: 'dato' },
    { id: 'ext', puntos: [[290, 230], [290, 270]], bits: 16, etiqueta: '', clase: 'bus', pista: 'A15', nivel: 0 },
    { id: 'pins', puntos: [[360, 310], [520, 310], [520, 545], [990, 545]], bits: 24, etiqueta: 'patillas A0–A15, D0–D7', pos: [760, 538], clase: 'bus', pista: 'A', valor: true },
    { id: 'dmaoam', puntos: [[520, 145], [560, 145]], bits: 8, etiqueta: '', clase: 'dato', pista: 'DMA', nivel: 1 },
    { id: 'dmaext', puntos: [[460, 180], [460, 300], [360, 300]], bits: 16, etiqueta: '', clase: 'bus', pista: 'DMA', nivel: 1 },
    { id: 'vif-ppu', puntos: [[660, 80], [660, 110]], bits: 8, etiqueta: '', clase: 'dato', pista: 'MCS', nivel: 0 },
    { id: 'vif-pins', puntos: [[760, 50], [990, 50]], bits: 21, etiqueta: 'patillas MA/MD', pos: [880, 42], clase: 'bus', pista: 'MA', valor: true },
    { id: 'oam-ppu', puntos: [[625, 180], [625, 210]], bits: 8, etiqueta: '', clase: 'dato', pista: 'OAMB', nivel: 1 },
    { id: 'vram-ppu', puntos: [[740, 80], [740, 210]], bits: 8, etiqueta: '', clase: 'dato', pista: 'MODO3', nivel: 1 },
    { id: 'ppu-lcd', puntos: [[790, 330], [820, 330]], bits: 2, etiqueta: '', clase: 'dato', pista: 'CP', nivel: 1 },
    { id: 'ppu-stat', puntos: [[790, 240], [820, 240]], bits: 2, etiqueta: '', clase: 'control' },
    { id: 'stat-int', puntos: [[900, 270], [900, 290], [800, 290], [800, 400], [540, 400], [540, 320], [190, 320]], bits: 1, etiqueta: 'VBlank, STAT', pos: [660, 393], clase: 'interrupcion', pista: 'IRQ', nivel: 1 },
    { id: 'int-cpu', puntos: [[100, 270], [100, 230]], bits: 1, etiqueta: '', clase: 'interrupcion', pista: 'IRQ', nivel: 1 },
    { id: 'clk-cpu', puntos: [[100, 80], [100, 110]], bits: 1, etiqueta: '', clase: 'reloj', pista: 'CLK', nivel: 1 },
    { id: 'io', puntos: [[290, 350], [290, 380]], bits: 8, etiqueta: 'registros $FF00–$FF7F', pos: [380, 368], clase: 'dato' },
  ],
};

// ------------------------------------------------------------------ decoding

export function zonaGB(a: number, cgb = false): { zona: string; bloque: string; bus: 'rom' | 'cram' | 'wram' | 'vram' | 'interno'; texto: string } {
  if (a < 0x4000) return { zona: 'ROM del cartucho, banco 0 ($0000–$3FFF)', bloque: 'cart', bus: 'rom', texto: 'A15 = 0: responde la ROM del cartucho (sin /CS). Al arrancar, $0000–$00FF es la ROM de arranque interna.' };
  if (a < 0x8000) return { zona: 'ROM del cartucho, banco conmutable ($4000–$7FFF)', bloque: 'cart', bus: 'rom', texto: 'A15 = 0 y A14 = 1: el MBC del cartucho pone las líneas altas del banco elegido.' };
  if (a < 0xa000) return { zona: 'VRAM ($8000–$9FFF)', bloque: 'vram', bus: 'vram', texto: cgb ? 'VRAM interna del CPU CGB (banco de VBK, $FF4F); fuera del modo 3 la CPU puede usarla. No sale por ninguna patilla.' : 'No pasa por el bus del cartucho: el SoC la busca en MA0–MA12 con /MCS y /MRD (o /MWR). Fuera del modo 3, la CPU puede usarla.' };
  if (a < 0xc000) return { zona: 'RAM del cartucho ($A000–$BFFF)', bloque: 'cart', bus: 'cram', texto: '/CS baja y A14 = 0: la RAM del cartucho (si existe y el MBC la ha habilitado).' };
  if (a < 0xfe00) {
    const esp = a >= 0xe000;
    if (cgb) {
      const b = a & 0x1000 ? 'el banco de SVBK ($FF70, 1–7)' : 'el banco 0';
      return { zona: esp ? 'Espejo de la WRAM ($E000–$FDFF)' : 'WRAM ($C000–$DFFF)', bloque: 'wram', bus: 'wram', texto: `WRAM de 32 KB en el bus MA/MD propio (U2): ${b}. Dirección de la SRAM = banco × 4096 + ${hex(a & 0xfff, 3)}.` };
    }
    return { zona: esp ? 'Espejo de la WRAM ($E000–$FDFF)' : 'WRAM ($C000–$DFFF)', bloque: 'wram', bus: 'wram', texto: `/CS baja y A14 = 1: CE2 de U3 está alto y la WRAM responde${esp ? ` (es ${hex(a - 0x2000, 4)})` : ''}. La RAM del cartucho no, porque mira A14 = 0.` };
  }
  if (a < 0xfea0) return { zona: 'OAM ($FE00–$FE9F)', bloque: 'soc', bus: 'interno', texto: 'Interna: atributos de los 40 sprites. El bus externo no se mueve.' };
  if (a < 0xff00) return { zona: 'Sin uso ($FEA0–$FEFF)', bloque: 'soc', bus: 'interno', texto: 'Zona prohibida.' };
  if (a < 0xff80) return { zona: 'Registros de E/S ($FF00–$FF7F)', bloque: 'soc', bus: 'interno', texto: `Registro interno ${hex(a, 4)}${a === 0xff00 ? ' (botones)' : a === 0xff46 ? ' (DMA de OAM)' : a === 0xff40 ? ' (LCDC)' : a === 0xff41 ? ' (STAT)' : a === 0xff44 ? ' (LY)' : ''}.` };
  if (a < 0xffff) return { zona: 'HRAM ($FF80–$FFFE)', bloque: 'soc', bus: 'interno', texto: 'RAM interna de 127 bytes.' };
  return { zona: 'IE ($FFFF)', bloque: 'soc', bus: 'interno', texto: 'Habilitación de interrupciones.' };
}

export function decodificar(dir: number, escritura: boolean): Decodificacion {
  const a = dir & 0xffff;
  const z = zonaGB(a);
  const a15 = z.bus === 'rom';
  const cs = z.bus === 'cram' || z.bus === 'wram';
  const tabla = [
    { etiqueta: 'A15 (patilla) baja: ROM del cartucho', valor: a15 ? 'baja' : 'alta', activa: a15 },
    { etiqueta: '/CS baja ($A000–$FDFF)', valor: cs ? 'baja' : 'alta', activa: cs },
    { etiqueta: 'A14 (WRAM con /CS)', valor: String((a >> 14) & 1), activa: z.bus === 'wram' },
    { etiqueta: '/MCS (bus de VRAM)', valor: z.bus === 'vram' ? 'baja' : 'alta', activa: z.bus === 'vram' },
  ];
  let texto = z.texto;
  if (escritura && a < 0x8000) texto = 'Escritura en la zona de ROM: la ROM no puede escribirse, pero el MBC del cartucho la captura como registro (por ejemplo, $2000–$3FFF elige el banco de ROM).';
  return { direccion: a, escritura, tabla, zona: z.zona, seleccion: a15 ? 'A15' : cs ? '/CS' : z.bus === 'vram' ? '/MCS' : null, bloque: z.bloque, texto,
    espejo: a >= 0xe000 && a < 0xfe00 ? hex(a - 0x2000, 4) : undefined };
}

// ------------------------------------------------------------------ external bus cycles (GBCTR figs. C.8–C.10)

export interface CicloGB {
  dir: number;
  escritura: boolean;
  dato: number;
  nota: string;
}

/** Declares the bus signals (ids CLK, PHI, A, D, RD, WR, A15, CS, WRAMSEL, CARTRAM, MA, MD, MCS, SEL). */
export function senalesGB(c: Cronograma, reloj = '4,194304 MHz', cgb = false): void {
  c.bit('CLK', `Reloj (${reloj})`, 1)
    .bit('PHI', 'PHI', 1, 'Ciclo de máquina; alto la primera mitad')
    .bus('A', 'A15–A0', 'Patillas de dirección')
    .bus('D', 'D7–D0')
    .bit('RD', '/RD', 0, 'Bajo salvo en las escrituras (GBCTR fig. C.8)')
    .bit('WR', '/WR', 1)
    .bit('A15', 'A15', 1, 'Patilla A15: baja para la ROM del cartucho')
    .bit('CS', '/CS', 1, '$A000–$FDFF')
    .bit(cgb ? 'WRAMSEL' : 'WRAMSEL', cgb ? 'WRAM (bus MA/MD)' : 'WRAM U3 (/CS · A14)', 0)
    .bit('CARTRAM', 'RAM del cartucho', 0)
    .bus('MA', cgb ? 'MA12–MA0 + RA (WRAM)' : 'MA12–MA0 (VRAM)')
    .bus('MD', 'MD7–MD0')
    .bit('MCS', cgb ? '/CS1 (WRAM)' : '/MCS', 1)
    .bus('SEL', 'Selección');
}

/** One CPU M-cycle on the buses, starting at t0, with M-cycle length tm (normal or double speed). */
export function cicloGB(c: Cronograma, t0: number, tm: number, x: CicloGB, cgb = false): number {
  const z = zonaGB(x.dir, cgb);
  const fin = t0 + tm;
  c.marca(t0);
  c.set('PHI', t0, 1);
  c.set('PHI', t0 + tm / 2, 0);
  if (z.bus === 'interno' || z.bus === 'vram' || (cgb && z.bus === 'wram')) {
    // the external cartridge bus stays idle (address may still change)
    c.set('A', t0 + tm / 8, hex(x.dir, 4));
    c.set('A15', t0, 1);
    c.set('CS', t0, 1);
    c.set('RD', t0, 0);
    c.set('WR', t0, 1);
    if (z.bus === 'vram' || (cgb && z.bus === 'wram')) {
      const ma = cgb && z.bus === 'wram' ? ((x.dir & 0x1000 ? 1 : 0) << 12) | (x.dir & 0xfff) : x.dir & 0x1fff;
      c.set('MA', t0 + tm / 8, hex(ma, 4));
      c.set('MCS', t0 + tm / 4, 0);
      c.set('MD', x.escritura ? t0 + tm / 2 : t0 + tm / 2, hex(x.dato, 2));
      c.set('MCS', fin, 1);
      c.set('MD', fin, null);
      c.set('MA', fin, null);
      if (cgb && z.bus === 'wram') {
        c.set('WRAMSEL', t0 + tm / 4, 1);
        c.set('WRAMSEL', fin, 0);
      }
      c.set('SEL', t0 + tm / 4, z.bus === 'vram' ? (cgb ? 'VRAM interna' : 'VRAM (MA/MD)') : 'WRAM (MA/MD)');
    } else c.set('SEL', t0, 'interno');
    c.set('SEL', fin, null);
    return fin;
  }
  c.set('A', t0 + tm / 8, hex(x.dir, 4));
  if (x.escritura) {
    c.set('RD', t0, 0);
    c.set('RD', t0 + tm / 4, 1);
    c.set('WR', t0 + tm / 2, 0);
    c.set('WR', t0 + (7 * tm) / 8, 1);
    c.set('D', t0 + tm / 2, hex(x.dato, 2));
  } else {
    c.set('RD', t0, 0);
    c.set('D', t0 + tm / 4 + 0.15 * tm, hex(x.dato, 2));
  }
  c.set('D', fin, null);
  if (z.bus === 'rom') {
    c.set('A15', t0 + tm / 4, 0);
    c.set('A15', fin, 1);
    c.set('SEL', t0 + tm / 4, x.escritura ? 'MBC' : 'ROM');
  } else {
    c.set('CS', t0 + tm / 4, 0);
    c.set('CS', fin, 1);
    if (z.bus === 'wram') {
      c.set('WRAMSEL', t0 + tm / 4, 1);
      c.set('WRAMSEL', fin, 0);
      c.set('SEL', t0 + tm / 4, 'WRAM');
    } else {
      c.set('CARTRAM', t0 + tm / 4, 1);
      c.set('CARTRAM', fin, 0);
      c.set('SEL', t0 + tm / 4, 'RAM del cartucho');
    }
  }
  c.set('SEL', fin, null);
  return fin;
}

export function ciclosGB(id: string, titulo: string, descripcion: string, lista: CicloGB[], tm = TMC, cgb = false, reloj = '4,194304 MHz'): Escenario {
  const c = new Cronograma();
  senalesGB(c, reloj, cgb);
  let t = 0;
  for (const x of lista) {
    const fin = cicloGB(c, t, tm, x, cgb);
    c.paso(t, fin, `${x.escritura ? 'Escritura' : 'Lectura'} en ${hex(x.dir, 4)}: ${x.nota}`);
    t = fin;
  }
  c.reloj('CLK', 0, t, tm / 4, 0.5);
  c.marca(t);
  return {
    id, titulo, descripcion, duracion: t, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: tm / 2.5,
    defecto: ['CLK', 'PHI', 'A', 'D', 'RD', 'WR', 'A15', 'CS', 'WRAMSEL', 'MA', 'MCS'],
    fidelidad: `Exacto: ciclo de máquina de ${(tm * 1e9).toFixed(1).replace('.', ',')} ns (4 periodos), y la forma de cada ciclo externo según GBCTR, figuras C.8–C.10 (pp. 173–174): /RD bajo salvo al escribir, A15 o /CS bajos desde 1/4 del ciclo, /WR de 1/2 a 7/8, dato desde 1/2 al escribir. Ilustrativo: el instante en que la memoria pone el dato (≈ 0,4 del ciclo) y la forma de los accesos al bus MA/MD, que GBCTR no dibuja.`,
  };
}

const PROGRAMA: CicloGB[] = [
  { dir: 0x0150, escritura: false, dato: 0xfa, nota: 'código de LD A,(a16) en la ROM del cartucho: A15 baja' },
  { dir: 0x0151, escritura: false, dato: 0x00, nota: 'byte bajo de la dirección' },
  { dir: 0x0152, escritura: false, dato: 0xc0, nota: 'byte alto' },
  { dir: 0xc000, escritura: false, dato: 0x42, nota: 'lectura de la WRAM: /CS baja con A14 = 1' },
  { dir: 0x0153, escritura: false, dato: 0xea, nota: 'LD (a16),A' },
  { dir: 0x0154, escritura: false, dato: 0x00, nota: 'byte bajo' },
  { dir: 0x0155, escritura: false, dato: 0x98, nota: 'byte alto' },
  { dir: 0x9800, escritura: true, dato: 0x42, nota: 'escritura en la VRAM: el bus del cartucho no se mueve; sale por MA/MD' },
  { dir: 0x0156, escritura: false, dato: 0xe0, nota: 'LDH (a8),A' },
  { dir: 0x0157, escritura: false, dato: 0x80, nota: 'dirección $FF80' },
  { dir: 0xff80, escritura: true, dato: 0x42, nota: 'escritura en la HRAM: todo interno' },
  { dir: 0x0158, escritura: false, dato: 0xea, nota: 'LD (a16),A' },
  { dir: 0x0159, escritura: false, dato: 0x00, nota: 'byte bajo' },
  { dir: 0x015a, escritura: false, dato: 0xa0, nota: 'byte alto' },
  { dir: 0xa000, escritura: true, dato: 0x42, nota: 'escritura en la RAM del cartucho: /CS y /WR' },
];

function escenarioDecodificar(op: Opciones): Escenario {
  const dir = Math.max(0, Math.min(0xffff, parseInt(op.dir ?? '0', 16) || 0));
  const w = op.escritura === '1';
  const lista: CicloGB[] = [
    { dir: 0x0200, escritura: false, dato: w ? 0xea : 0xfa, nota: w ? 'LD (a16),A' : 'LD A,(a16)' },
    { dir: 0x0201, escritura: false, dato: dir & 0xff, nota: 'byte bajo' },
    { dir: 0x0202, escritura: false, dato: dir >> 8, nota: 'byte alto' },
    { dir, escritura: w, dato: 0x5a, nota: decodificar(dir, w).zona },
  ];
  return ciclosGB('decodificar', `Acceso a ${hex(dir, 4)}`, 'Instrucción leída del cartucho y el acceso a la dirección elegida.', lista);
}

// ------------------------------------------------------------------ MBC1 bank switching

function escenarioMBC(op: Opciones): Escenario {
  const banco = Number(op.banco ?? '5');
  const lista: CicloGB[] = [
    { dir: 0x0300, escritura: false, dato: 0x3e, nota: `LD A,${banco}` },
    { dir: 0x0301, escritura: false, dato: banco, nota: 'número de banco' },
    { dir: 0x0302, escritura: false, dato: 0xea, nota: 'LD ($2000),A' },
    { dir: 0x0303, escritura: false, dato: 0x00, nota: 'byte bajo' },
    { dir: 0x0304, escritura: false, dato: 0x20, nota: 'byte alto' },
    { dir: 0x2000, escritura: true, dato: banco, nota: 'el MBC1 captura el banco (A15 bajo y /WR)' },
    { dir: 0x0305, escritura: false, dato: 0xfa, nota: 'LD A,($4123)' },
    { dir: 0x0306, escritura: false, dato: 0x23, nota: 'byte bajo' },
    { dir: 0x0307, escritura: false, dato: 0x41, nota: 'byte alto' },
    { dir: 0x4123, escritura: false, dato: 0x99, nota: `lectura en el banco ${banco}: la ROM ve ${hex(banco * 0x4000 + 0x0123, 6)}` },
  ];
  const e = ciclosGB('mbc', 'Cambio de banco (MBC1)', `Escribir ${banco} en $2000 hace que $4000–$7FFF muestre el banco ${banco} de la ROM: la dirección $4123 de la CPU es el byte ${hex(banco * 0x4000 + 0x123, 6)} de la ROM.`, lista);
  const c = new Cronograma();
  c.bus('BANCO', 'Banco de ROM (MBC1)').bus('ROMA', 'Dirección en la ROM');
  let t = 0;
  c.set('BANCO', 0, '1');
  for (const x of lista) {
    if (x.escritura && x.dir === 0x2000) c.set('BANCO', t + (7 * TMC) / 8, String(banco));
    if (!x.escritura && x.dir < 0x8000) c.set('ROMA', t + TMC / 4, hex(x.dir < 0x4000 ? x.dir : banco * 0x4000 + (x.dir & 0x3fff), 6));
    else c.set('ROMA', t, null);
    t += TMC;
  }
  e.pistas.push(...c.pistas());
  e.defecto = ['PHI', 'A', 'D', 'RD', 'WR', 'A15', 'BANCO', 'ROMA'];
  e.fidelidad += ' El MBC está en el cartucho: «Banco» y «Dirección en la ROM» son su registro y sus líneas internas (Pan Docs, MBC1).';
  return e;
}

// ------------------------------------------------------------------ PPU line

export function escenarioLineaPPU(op: Opciones, cgb = false): Escenario {
  const sprites = Number(op.sprites ?? '0');
  const m3 = Math.min(289, 172 + sprites * 11);
  const c = new Cronograma();
  c.bus('MODO', 'Modo de la PPU (STAT)').bit('OAMB', 'Lectura de la OAM', 0, 'Modo 2').bit('MODO3', 'Dibujando (modo 3)', 0)
    .bus('MA', cgb ? 'Dirección de VRAM (interna)' : 'MA12–MA0 (VRAM)').bit('MCS', cgb ? 'VRAM ocupada' : '/MCS', 1)
    .bit('CP', 'CP (reloj de píxel)', 0).bus('LD', cgb ? 'Color (15 bits)' : 'LD1–LD0 (píxel)')
    .bit('CPL', 'CPL (fin de línea)', 0).bit('STATI', 'Interrupción STAT (modo 0)', 0).bus('CPU', 'Acceso de la CPU a la VRAM');
  const t2 = 80 * TC;
  const t3 = t2 + m3 * TC;
  const fin = 456 * TC;
  c.set('MODO', 0, '2');
  c.set('OAMB', 0, 1);
  c.set('OAMB', t2, 0);
  c.set('MODO', t2, '3');
  c.set('MODO3', t2, 1);
  c.set('MODO3', t3, 0);
  c.set('MODO', t3, '0');
  c.set('CPU', 0, 'permitido');
  c.set('CPU', t2, 'bloqueado (la VRAM es de la PPU)');
  c.set('CPU', t3, 'permitido');
  // fetcher: 6-dot steps (map, tile low, tile high) with 2 dots each
  for (let k = 0; k * 8 * TC < m3 * TC; k++) {
    const tf = t2 + k * 8 * TC;
    if (tf >= t3) break;
    c.set('MA', tf, hex(0x1800 + k, 4));
    c.set('MCS', tf, 0);
    c.set('MA', tf + 2 * TC, hex(0x0100 + k * 16, 4));
    c.set('MA', tf + 4 * TC, hex(0x0101 + k * 16, 4));
    c.set('MCS', tf + 6 * TC, 1);
    c.set('MA', tf + 6 * TC, null);
  }
  // pixel output: 160 pixels during the second part of mode 3
  const tp = t3 - 160 * TC;
  for (let i = 0; i < 160; i++) {
    const tt = tp + i * TC;
    c.set('CP', tt, 1);
    c.set('CP', tt + TC / 2, 0);
    if (i % 8 === 0) c.set('LD', tt, cgb ? hex((i * 997) & 0x7fff, 4) : String((i >> 3) & 3));
  }
  c.set('LD', t3, null);
  c.set('CPL', t3 + 4 * TC, 1);
  c.set('CPL', t3 + 6 * TC, 0);
  c.set('STATI', t3, 1);
  c.set('STATI', t3 + 20 * TC, 0);
  for (const t of [0, t2, tp, t3, fin]) c.marca(t);
  c.paso(0, t2, 'Modo 2 (80 puntos): la PPU recorre los 40 sprites de la OAM y apunta hasta 10 que tocan esta línea. La CPU no puede leer la OAM.');
  c.paso(t2, t3, `Modo 3 (${m3} puntos${sprites ? `, ${sprites} sprites` : ''}): la PPU lee mapa y tiles por el bus de VRAM y saca 160 píxeles con CP. La CPU no puede usar la VRAM.`);
  c.paso(t3, fin, `Modo 0, borrado horizontal (${456 - 80 - m3} puntos): CPL cierra la línea; si STAT lo pide, interrupción. La CPU vuelve a tener la VRAM.`);
  return {
    id: 'ppu', titulo: 'Una línea de la PPU', descripcion: `Una línea de 456 puntos (${(456 * TC * 1e6).toFixed(2).replace('.', ',')} µs): modo 2, modo 3 y modo 0.`,
    duracion: fin, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 12,
    defecto: ['MODO', 'OAMB', 'MODO3', 'MA', 'MCS', 'CP', 'LD', 'CPL', 'STATI', 'CPU'],
    fidelidad: 'Exacto: 456 puntos por línea, modo 2 de 80 puntos, modo 3 de 172 a 289 puntos según los sprites (se suman ≈ 11 por sprite, valor medio de Pan Docs) y el resto de modo 0 (Pan Docs, «Rendering»). Ilustrativo: el orden y la duración de cada lectura de VRAM, la forma de CP, CPL y LD (la temporización de esas patillas no está publicada) y el momento exacto de la interrupción STAT.',
  };
}

// ------------------------------------------------------------------ frame

export function escenarioCuadroGB(op: Opciones): Escenario {
  const lyc = Number(op.lyc ?? '72');
  const TLn = 456 * TC;
  const c = new Cronograma();
  c.bus('LY', 'LY (línea)').bus('MODO', 'Modo').bit('IRQ', 'Petición de interrupción', 0).bit('VB', 'IF.0 VBlank', 0).bit('LYCI', 'STAT: LY = LYC', 0)
    .bit('S', 'S (inicio de cuadro)', 0).bus('CPU', 'CPU');
  for (let l = 0; l < 154; l++) {
    c.set('LY', l * TLn, String(l));
    c.set('MODO', l * TLn, l < 144 ? '2-3-0' : '1');
  }
  c.set('S', 0, 1);
  c.set('S', TLn, 0);
  c.set('CPU', 0, 'lógica del juego');
  const tl = lyc * TLn;
  c.set('LYCI', tl, 1);
  c.set('IRQ', tl, 1);
  c.set('CPU', tl + 5 * TMC, 'STAT ($48): cambia la ventana');
  c.set('LYCI', tl + 8 * TMC, 0);
  c.set('IRQ', tl + 8 * TMC, 0);
  c.set('CPU', tl + 60 * TMC, 'lógica del juego');
  const tv = 144 * TLn;
  c.set('VB', tv, 1);
  c.set('IRQ', tv, 1);
  c.set('CPU', tv + 5 * TMC, 'VBlank ($40): DMA de OAM, VRAM');
  c.set('VB', tv + 8 * TMC, 0);
  c.set('IRQ', tv + 8 * TMC, 0);
  c.set('CPU', tv + 4 * TLn, 'lógica del juego');
  const fin = 154 * TLn;
  for (const t of [0, tl, tv, fin]) c.marca(t);
  c.paso(0, tl, 'Líneas 0–143: cada una pasa por los modos 2, 3 y 0.');
  c.paso(tl, tl + 60 * TMC, `LY = LYC (${lyc}): interrupción STAT, por ejemplo para cambiar la posición de la ventana a mitad de pantalla.`);
  c.paso(tv, tv + 4 * TLn, 'LY = 144: empieza el modo 1 y la interrupción VBlank ($40). Es cuando el juego copia los sprites (DMA de OAM) y actualiza la VRAM.');
  c.paso(tv + 4 * TLn, fin, 'Líneas 144–153: borrado vertical (10 líneas, 4560 puntos).');
  return {
    id: 'cuadro', titulo: 'Cuadro e interrupciones', descripcion: '154 líneas de 456 puntos: 70 224 puntos por cuadro, 59,73 Hz.',
    duracion: fin, escala: 'ms', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 20, ventana: [0, fin],
    defecto: ['LY', 'MODO', 'IRQ', 'VB', 'LYCI', 'S', 'CPU'],
    fidelidad: 'Exacto: 154 × 456 puntos, VBlank en LY = 144 y la interrupción STAT con LY = LYC (Pan Docs). Ilustrativo: el pulso S y la duración de las rutinas.',
  };
}

// ------------------------------------------------------------------ OAM DMA

export function escenarioDMA(tm = TMC, cgb = false): Escenario {
  const c = new Cronograma();
  senalesGB(c, '4,194304 MHz', cgb);
  c.bit('DMA', 'DMA de OAM activa', 0).bus('OAMA', 'Destino en la OAM').bit('HRAM', 'CPU en la HRAM', 0).bus('CPU', 'CPU');
  let t = 0;
  // the program: LDH ($46),A from HRAM, then a wait loop in HRAM
  const pre: CicloGB[] = [
    { dir: 0xff80, escritura: false, dato: 0xe0, nota: 'LDH ($46),A en la HRAM' },
    { dir: 0xff81, escritura: false, dato: 0x46, nota: 'dirección $FF46' },
    { dir: 0xff46, escritura: true, dato: 0xc1, nota: 'escritura en DMA: copiar desde $C100' },
  ];
  for (const x of pre) {
    t = cicloGB(c, t, tm, x, cgb);
  }
  c.set('HRAM', 0, 1);
  c.set('CPU', 0, 'escribe $C1 en $FF46');
  c.paso(0, t, 'La rutina, copiada antes en la HRAM, escribe $C1 en $FF46.');
  const t0 = t + tm;
  c.set('DMA', t0, 1);
  c.set('CPU', t0, 'espera en un bucle de la HRAM');
  for (let i = 0; i < 160; i++) {
    const ti = t0 + i * tm;
    const src = 0xc100 + i;
    c.marca(ti);
    c.set('PHI', ti, 1);
    c.set('PHI', ti + tm / 2, 0);
    if (cgb) {
      c.set('MA', ti, hex((src & 0xfff), 4));
      c.set('MCS', ti, 0);
      c.set('WRAMSEL', ti, 1);
      c.set('MD', ti + tm / 4, hex((i * 37) & 0xff, 2));
    } else {
      c.set('A', ti, hex(src, 4));
      c.set('CS', ti, 0);
      c.set('WRAMSEL', ti, 1);
      c.set('D', ti + tm / 4, hex((i * 37) & 0xff, 2));
    }
    c.set('OAMA', ti + tm / 2, hex(0xfe00 + i, 4));
  }
  const tf = t0 + 160 * tm;
  c.set(cgb ? 'MCS' : 'CS', tf, 1);
  c.set('WRAMSEL', tf, 0);
  c.set(cgb ? 'MD' : 'D', tf, null);
  c.set(cgb ? 'MA' : 'A', tf, null);
  c.set('OAMA', tf, null);
  c.set('DMA', tf, 0);
  c.set('CPU', tf, 'RET: vuelve al programa');
  c.paso(t0, tf, `160 ciclos de máquina (${(160 * tm * 1e6).toFixed(1).replace('.', ',')} µs): un byte por ciclo de $C100–$C19F a $FE00–$FE9F. ${cgb ? 'En la CGB la WRAM está en el bus MA/MD.' : 'Durante la lectura de la WRAM, /CS se queda bajo todo el ciclo (GBCTR fig. C.11).'} La CPU sigue, pero solo puede usar la HRAM.`);
  const fin = tf + 2 * tm;
  c.reloj('CLK', 0, fin, tm / 4, 0.5);
  c.marca(fin);
  return {
    id: 'dma', titulo: 'DMA de OAM', descripcion: 'Escribir en $FF46 copia 160 bytes a la OAM (los atributos de los 40 sprites) en 160 ciclos de máquina.',
    duracion: fin, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 12, ventana: [0, t0 + 12 * tm],
    defecto: ['PHI', 'DMA', cgb ? 'MA' : 'A', cgb ? 'MD' : 'D', cgb ? 'MCS' : 'CS', 'OAMA', 'CPU'],
    fidelidad: 'Exacto: 160 ciclos de máquina de 1 byte (Pan Docs, «OAM DMA Transfer»), /CS o A15 bajos todo el ciclo en las lecturas de la DMA (GBCTR fig. C.11, p. 174). Ilustrativo: el retardo de un ciclo antes del primer byte y los datos copiados.',
  };
}

// ------------------------------------------------------------------ clocks

function escenarioRelojes(): Escenario {
  const c = new Cronograma();
  const fin = 2 * TMC;
  c.bit('CLK', 'Cristal 4,194304 MHz', 1, '238,4 ns: un punto de la PPU').bit('PHI', 'PHI 1,048576 MHz', 1, 'Ciclo de máquina de la CPU');
  c.reloj('CLK', 0, fin, TC);
  c.reloj('PHI', 0, fin, TMC);
  for (let k = 0; k <= 8; k++) c.marca(k * TC);
  c.paso(0, fin, 'Un ciclo de máquina son 4 puntos. De este reloj salen también el puerto serie (8192 Hz con el reloj interno = ÷ 512), el divisor DIV (16 384 Hz) y el temporizador (4096, 262 144, 65 536 o 16 384 Hz).');
  return {
    id: 'relojes', titulo: 'Relojes', descripcion: 'El cristal de 2²² Hz da el punto de la PPU; PHI, el ciclo de máquina.',
    duracion: fin, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 6,
    defecto: ['CLK', 'PHI'],
    fidelidad: 'Exacto: 4,194304 MHz y PHI = ÷ 4, alto la primera mitad del ciclo (GBCTR fig. C.8). Ilustrativo: nada.',
  };
}

export const GB: Maquina = {
  id: 'gb',
  diagrama: placa,
  interior: { titulo: 'Dentro del SoC', nota: 'Bloques de la hoja raíz del chip DMG-CPU B redibujado por Michael Singer a partir de las fotos del dado (msinger/dmg-schematics, CC BY-SA 4.0). Se iluminan con las mismas señales.', diagrama: interior },
  digitos: 4,
  dirInicial: 'C000',
  decodificar,
  escenarios: [
    { id: 'bus', titulo: 'Ciclos de bus', crear: () => ciclosGB('bus', 'Ciclos de bus de la CPU', 'Cuatro instrucciones: lectura de la WRAM, escritura en la VRAM (por el bus MA/MD), en la HRAM (interna) y en la RAM del cartucho. Cada ciclo de máquina son 953,7 ns.', PROGRAMA) },
    { id: 'decodificar', titulo: 'Decodificar una dirección', crear: escenarioDecodificar },
    { id: 'mbc', titulo: 'Cambio de banco (MBC1)', crear: escenarioMBC },
    { id: 'ppu', titulo: 'Una línea de la PPU', crear: (op) => escenarioLineaPPU(op) },
    { id: 'cuadro', titulo: 'Cuadro e interrupciones', crear: escenarioCuadroGB },
    { id: 'dma', titulo: 'DMA de OAM', crear: () => escenarioDMA() },
    { id: 'relojes', titulo: 'Relojes', crear: escenarioRelojes },
  ],
  ejemplos: [
    { dir: 0x0150, escritura: false, texto: 'ROM' },
    { dir: 0x4123, escritura: false, texto: 'banco' },
    { dir: 0x2000, escritura: true, texto: 'MBC' },
    { dir: 0x9800, escritura: true, texto: 'VRAM' },
    { dir: 0xa000, escritura: true, texto: 'RAM cartucho' },
    { dir: 0xc000, escritura: false, texto: 'WRAM' },
    { dir: 0xe123, escritura: false, texto: 'espejo' },
    { dir: 0xff46, escritura: true, texto: 'DMA' },
    { dir: 0xff80, escritura: false, texto: 'HRAM' },
  ],
  opciones: [
    { id: 'banco', titulo: 'Banco', escenarios: ['mbc'], valores: [{ v: '5', texto: '5' }, { v: '2', texto: '2' }, { v: '31', texto: '31' }] },
    { id: 'sprites', titulo: 'Sprites en la línea', escenarios: ['ppu'], valores: [{ v: '0', texto: 'ninguno' }, { v: '4', texto: '4' }, { v: '10', texto: '10' }] },
    { id: 'lyc', titulo: 'LYC', escenarios: ['cuadro'], valores: [{ v: '72', texto: '72' }, { v: '20', texto: '20' }, { v: '130', texto: '130' }] },
  ],
};
