// NES (NES-CPU-07): block diagram, address decoding and the timed scenarios.
//
// Timing figures (NESdev Wiki: «CPU pinout», «PPU pinout», «Timing», «PPU rendering»):
//   master clock 21.477272 MHz; CPU = master / 12 (558.7 ns per cycle); M2 duty 15/24 on the 2A03G, a cycle
//   begins when M2 falls and reads happen while M2 is high; PPU dot = master / 4 (186.2 ns); each PPU memory
//   access takes 2 dots, ALE high for the first one; 341 dots x 262 lines per frame; the vblank flag (and /NMI
//   when enabled) at line 241, dot 1. Device delays: 74LS139 ~20 ns per level (TI data sheet, typical),
//   MB8416A-15 access 150 ns (part number). Other delays are marked as illustrative in `fidelidad`.

import { Cronograma, hex, type Escenario } from './modelo';
import type { Decodificacion, Diagrama, Maquina, Opciones } from './diagrama';

const FM = 21.477272e6;
const TM = 1 / FM;
const TC = 12 * TM; // CPU cycle
const TD = 4 * TM; // PPU dot
const T139 = 20e-9; // 74LS139 propagation delay (typical)

// ------------------------------------------------------------------ diagram

const diagrama: Diagrama = {
  ancho: 1000,
  alto: 560,
  bloques: [
    { id: 'osc', x: 250, y: 18, w: 180, h: 62, titulo: 'Oscilador maestro', sub: 'X1 21,477 MHz · Q2, Q3', foto: 'X1',
      esquema: ['X1', 'Q2', 'Q3'], actividad: [{ pista: 'CLK', nivel: 1 }],
      info: 'Cristal de 21,477272 MHz (6 × 3,579545 MHz) con el oscilador Q2 y el seguidor Q3. La CPU divide entre 12 y la PPU entre 4: 3 puntos de PPU por ciclo de CPU, sin deriva.' },
    { id: 'cpu', x: 20, y: 118, w: 190, h: 122, titulo: 'CPU RP2A03G', sub: 'U6 · 6502 + APU + E/S', foto: 'U6', esquema: ['U6'],
      actividad: [{ pista: 'A' }],
      info: 'Saca la dirección y R/W al empezar cada ciclo (cuando M2 baja). Lee el bus de datos durante la fase alta de M2 y escribe en ella. Recibe /NMI de la PPU.' },
    { id: 'dec', x: 240, y: 138, w: 130, h: 82, titulo: 'Decodificador', sub: 'U3 · 74LS139', foto: 'U3', esquema: ['U3'],
      actividad: [{ pista: 'ROMSEL' }, { pista: 'WRAMCS' }, { pista: 'PPUCS' }],
      info: 'Mitad B: entradas M2 y A15 → /ROMSEL ($8000–$FFFF) o habilitación de la mitad A. Mitad A: A13 y A14 → WRAM /CS ($0000–$1FFF) o PPU /CS ($2000–$3FFF). Cada nivel añade unos 20 ns.' },
    { id: 'ppu', x: 480, y: 118, w: 190, h: 122, titulo: 'PPU RP2C02G', sub: 'U5 · vídeo NTSC', foto: 'U5', esquema: ['U5'],
      actividad: [{ pista: 'PPUCS' }, { pista: 'ALE', nivel: 1 }, { pista: 'RD' }],
      info: 'Para la CPU son 8 registros ($2000–$2007). Hacia su memoria tiene un bus propio de 14 bits con los 8 bajos multiplexados (AD0–AD7) y ALE para separarlos.' },
    { id: 'wram', x: 20, y: 350, w: 140, h: 78, titulo: 'WRAM 2 KB', sub: 'U1 · MB8416A-15', foto: 'U1', esquema: ['U1'],
      actividad: [{ pista: 'WRAMCS' }],
      info: '$0000–$07FF, espejada cuatro veces hasta $1FFF. /OE a masa, /WE = R/W: manda /CS, que solo baja con M2 alto.' },
    { id: 'prg', x: 180, y: 350, w: 150, h: 78, titulo: 'PRG-ROM', sub: 'cartucho (P1)', foto: 'P1', esquema: ['P1'], externo: true,
      actividad: [{ pista: 'ROMSEL' }],
      info: 'El programa del juego, en $8000–$FFFF. El cartucho recibe /ROMSEL ya combinado con M2; con mappers, además decodifica él mismo $4020–$7FFF.' },
    { id: 'mandos', x: 350, y: 350, w: 150, h: 78, titulo: 'Mandos', sub: 'U7, U8 · 74HC368', foto: 'U7', esquema: ['U7', 'U8'],
      actividad: [{ pista: 'OE1' }],
      info: 'Leer $4016 baja /OE1 y el 74HC368 pone en D0–D4 el bit serie del mando I; escribir en $4016 cambia OUT0, el strobe de los dos mandos.' },
    { id: 'av', x: 520, y: 350, w: 150, h: 78, titulo: 'Vídeo y audio', sub: 'Q1 · U9 · modulador RF', foto: 'P3', esquema: ['Q1', 'P3'],
      info: 'La PPU entrega vídeo compuesto ya generado; Q1 lo separa. El audio de la APU (SOUND-1, SOUND-2) se mezcla con R7–R9 y se amplifica con un inversor de U9.' },
    { id: 'cic', x: 180, y: 462, w: 150, h: 62, titulo: 'CIC 3193A', sub: 'U10 · X2 4 MHz', foto: 'U10', esquema: ['U10', 'X2'],
      info: 'Bloqueo regional: dialoga con la CIC del cartucho con su propio reloj de 4 MHz (no sincronizado con el maestro) y mantiene /RST mientras no se entienden.' },
    { id: 'latch', x: 790, y: 26, w: 150, h: 64, titulo: 'Latch', sub: 'U2 · 74LS373', foto: 'U2', esquema: ['U2'],
      actividad: [{ pista: 'ALE', nivel: 1 }],
      info: 'Transparente con ALE alto, retiene con ALE bajo: guarda PA0–PA7 mientras AD0–AD7 transporta el dato.' },
    { id: 'vram', x: 700, y: 320, w: 130, h: 80, titulo: 'CIRAM 2 KB', sub: 'U4 · nametables', foto: 'U4', esquema: ['U4'],
      actividad: [{ pista: 'CIRAMCE' }],
      info: 'Dos nametables de 1 KB. /CE = /PA13 (activa en $2000–$3FFF) y A10 los decide el cartucho: unido a PA10 → espejado vertical; a PA11 → horizontal.' },
    { id: 'chr', x: 845, y: 320, w: 135, h: 80, titulo: 'CHR (cartucho)', sub: 'tablas de patrones', foto: 'P1', esquema: ['P1'], externo: true,
      actividad: [{ pista: 'CHRCE' }],
      info: 'ROM o RAM de gráficos en $0000–$1FFF del bus de la PPU. Se habilita con PA13 bajo. El cartucho también fija CIRAM A10 y CIRAM /CE.' },
    { id: 'u9', x: 700, y: 452, w: 130, h: 60, titulo: 'Inversor U9', sub: '74HCU04 · PA13 → /A13', foto: 'U9', esquema: ['U9'],
      info: 'Invierte PA13. La mayoría de cartuchos devuelven /A13 como CIRAM /CE, así la CIRAM responde solo en $2000–$3FFF.' },
  ],
  conexiones: [
    { id: 'clk-cpu', puntos: [[250, 49], [115, 49], [115, 118]], bits: 1, etiqueta: 'CLK', clase: 'reloj', pista: 'CLK', nivel: 1, red: '/CPU-CLK' },
    { id: 'clk-ppu', puntos: [[430, 49], [575, 49], [575, 118]], bits: 1, etiqueta: 'CLK', clase: 'reloj', pista: 'CLK', nivel: 1, red: '/PPU-CLK' },
    { id: 'nmi', puntos: [[480, 128], [210, 128]], bits: 1, etiqueta: '/NMI', pos: [345, 122], clase: 'interrupcion', pista: 'NMI', nivel: 0, red: '/~{NMI}' },
    { id: 'm2', puntos: [[210, 178], [240, 178]], bits: 1, etiqueta: 'M2', pos: [225, 170], clase: 'reloj', pista: 'M2', nivel: 1, red: '/M2' },
    { id: 'a-dec', puntos: [[330, 286], [330, 220]], bits: 3, etiqueta: 'A13–15', pos: [352, 262], clase: 'bus', pista: 'A', red: '/CPU-A15' },
    { id: 'ppucs', puntos: [[370, 178], [480, 178]], bits: 1, etiqueta: 'PPU /CS', pos: [425, 170], clase: 'seleccion', pista: 'PPUCS', nivel: 0, red: '/PPU-~{CE}' },
    { id: 'wramcs', puntos: [[240, 205], [225, 205], [225, 338], [90, 338], [90, 350]], bits: 1, etiqueta: 'WRAM /CS', pos: [150, 332], clase: 'seleccion', pista: 'WRAMCS', nivel: 0, red: '/WRAM-~{CE}' },
    { id: 'romsel', puntos: [[300, 220], [300, 350]], bits: 1, etiqueta: '/ROMSEL', pos: [300, 336], clase: 'seleccion', pista: 'ROMSEL', nivel: 0, red: '/~{ROMSEL}' },
    { id: 'bus-a', puntos: [[20, 286], [690, 286]], bits: 16, etiqueta: 'A0–A15', pos: [420, 280], clase: 'bus', pista: 'A', valor: true, red: '/CPU-A0' },
    { id: 'bus-d', puntos: [[20, 310], [690, 310]], bits: 8, etiqueta: 'D0–D7', pos: [600, 304], clase: 'dato', pista: 'D', valor: true, red: '/CPU-D0' },
    { id: 'cpu-a', puntos: [[60, 240], [60, 286]], bits: 16, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'cpu-d', puntos: [[150, 240], [150, 310]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'wram-a', puntos: [[45, 286], [45, 350]], bits: 11, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'wram-d', puntos: [[130, 310], [130, 350]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'prg-a', puntos: [[200, 286], [200, 350]], bits: 15, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'prg-d', puntos: [[255, 310], [255, 350]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'mandos-d', puntos: [[425, 310], [425, 350]], bits: 5, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'oe1', puntos: [[190, 240], [190, 330], [470, 330], [470, 350]], bits: 1, etiqueta: '/OE1, OUT0', pos: [400, 324], clase: 'seleccion', pista: 'OE1', nivel: 0, red: '/~{OE1}' },
    { id: 'ppu-a', puntos: [[500, 286], [500, 240]], bits: 3, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'ppu-d', puntos: [[545, 310], [545, 240]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'video', puntos: [[610, 240], [610, 350]], bits: 1, etiqueta: 'VIDEO', pos: [636, 334], clase: 'control', red: 'Net-(Q1-B)' },
    { id: 'ale', puntos: [[670, 136], [760, 136], [760, 58], [790, 58]], bits: 1, etiqueta: 'ALE', pos: [720, 130], clase: 'control', pista: 'ALE', nivel: 1, red: '/ALE' },
    { id: 'bus-ad', puntos: [[670, 180], [985, 180]], bits: 8, etiqueta: 'AD0–AD7', pos: [700, 174], clase: 'dato', pista: 'AD', valor: true, red: '/PPU-D0' },
    { id: 'ad-latch', puntos: [[850, 180], [850, 90]], bits: 8, etiqueta: '', clase: 'dato', pista: 'AD' },
    { id: 'ad-vram', puntos: [[760, 180], [760, 320]], bits: 8, etiqueta: '', clase: 'dato', pista: 'AD' },
    { id: 'ad-chr', puntos: [[900, 180], [900, 320]], bits: 8, etiqueta: '', clase: 'dato', pista: 'AD' },
    { id: 'bus-pa', puntos: [[940, 58], [975, 58], [975, 262], [640, 262], [640, 240]], bits: 14, etiqueta: 'PA0–PA13', pos: [690, 256], clase: 'bus', pista: 'PA', valor: true, red: '/PPU-A0' },
    { id: 'pa-vram', puntos: [[800, 262], [800, 320]], bits: 11, etiqueta: '', clase: 'bus', pista: 'PA' },
    { id: 'pa-chr', puntos: [[945, 262], [945, 320]], bits: 13, etiqueta: '', clase: 'bus', pista: 'PA' },
    { id: 'rd', puntos: [[660, 240], [660, 298], [720, 298], [720, 320]], bits: 1, etiqueta: '/RD', pos: [690, 292], clase: 'control', pista: 'RD', nivel: 0, red: '/PPU-~{RD}' },
    { id: 'rd-chr', puntos: [[720, 298], [865, 298], [865, 320]], bits: 1, etiqueta: '', clase: 'control', pista: 'RD', nivel: 0 },
    { id: 'ciramce', puntos: [[845, 345], [830, 345]], bits: 1, etiqueta: '/CE', pos: [838, 338], clase: 'seleccion', pista: 'CIRAMCE', nivel: 0, red: '/VRAM-~{CE}' },
    { id: 'a10', puntos: [[845, 380], [830, 380]], bits: 1, etiqueta: 'A10', pos: [838, 373], clase: 'control', pista: 'A10', nivel: 1, red: '/VRAM-A10' },
    { id: 'a13', puntos: [[912, 400], [912, 482], [830, 482]], bits: 1, etiqueta: 'PA13 ↔ /A13', pos: [900, 476], clase: 'control', red: '/PPU-~{A13}' },
    { id: 'cic-cart', puntos: [[255, 462], [255, 428]], bits: 2, etiqueta: 'CIC', pos: [275, 446], clase: 'control', red: '/CIC-TO-CART' },
    { id: 'rst', puntos: [[180, 493], [8, 493], [8, 170], [20, 170]], bits: 1, etiqueta: '/RST', pos: [40, 486], clase: 'control', red: '/~{RST}' },
  ],
};

// ------------------------------------------------------------------ address decoding

export function decodificar(dir: number, escritura: boolean): Decodificacion {
  const a = dir & 0xffff;
  const a15 = (a >> 15) & 1;
  const a14 = (a >> 14) & 1;
  const a13 = (a >> 13) & 1;
  const tabla = [
    { etiqueta: 'U3B (A0 = M2, A1 = A15) → Y1: habilita U3A', valor: a15 === 0 ? 'baja' : 'alta', activa: a15 === 0 },
    { etiqueta: 'U3B → Y3 = /ROMSEL', valor: a15 === 1 ? 'baja' : 'alta', activa: a15 === 1 },
    { etiqueta: 'U3A (A13, A14) → Y0 = WRAM /CS', valor: !a15 && !a14 && !a13 ? 'baja' : 'alta', activa: !a15 && !a14 && !a13 },
    { etiqueta: 'U3A → Y1 = PPU /CS', valor: !a15 && !a14 && a13 ? 'baja' : 'alta', activa: !a15 && !a14 && a13 === 1 },
    { etiqueta: 'U3A → Y2, Y3 (sin conectar)', valor: !a15 && a14 ? 'baja' : 'alta', activa: !a15 && a14 === 1 },
  ];
  const base = { direccion: a, escritura, tabla };
  if (a < 0x2000) {
    return { ...base, zona: 'RAM interna ($0000–$1FFF)', seleccion: 'WRAM /CS', bloque: 'wram', espejo: hex(a & 0x7ff, 4),
      texto: `A15 = A14 = A13 = 0: con M2 alto, U3B habilita U3A y su salida Y0 baja WRAM /CS (unos 40 ns después del flanco de M2, dos niveles del 74LS139). La RAM solo tiene A0–A10, así que ${hex(a, 4)} es la celda ${hex(a & 0x7ff, 4)} (espejo ×4).` };
  }
  if (a < 0x4000) {
    return { ...base, zona: 'Registros de la PPU ($2000–$3FFF)', seleccion: 'PPU /CS', bloque: 'ppu', espejo: hex(0x2000 + (a & 7), 4),
      texto: `A13 = 1, A14 = A15 = 0: U3A da PPU /CS. La PPU solo mira A0–A2: ${hex(a, 4)} es el registro ${hex(0x2000 + (a & 7), 4)} (${['PPUCTRL', 'PPUMASK', 'PPUSTATUS', 'OAMADDR', 'OAMDATA', 'PPUSCROLL', 'PPUADDR', 'PPUDATA'][a & 7]}).` };
  }
  if (a <= 0x4017) {
    if (a === 0x4016 && !escritura) {
      return { ...base, zona: 'E/S del 2A03', seleccion: '/OE1', bloque: 'mandos',
        texto: 'Lectura de $4016: la decodificación es interna al 2A03, que baja /OE1; U7 (74HC368) pone el bit del mando I en D0. U3A habilita su Y2, pero no está conectada.' };
    }
    if (a === 0x4017 && !escritura) {
      return { ...base, zona: 'E/S del 2A03', seleccion: '/OE2', bloque: 'mandos',
        texto: 'Lectura de $4017: el 2A03 baja /OE2 y U8 pone el bit del mando II en D0.' };
    }
    if (a === 0x4016 && escritura) {
      return { ...base, zona: 'E/S del 2A03', seleccion: 'OUT0–OUT2', bloque: 'mandos',
        texto: 'Escritura en $4016: el 2A03 copia D0–D2 en sus patillas OUT0–OUT2; OUT0 es el strobe de los dos mandos.' };
    }
    return { ...base, zona: 'APU y E/S internos ($4000–$4017)', seleccion: null, bloque: 'cpu',
      texto: 'Registro interno del 2A03 (APU, DMA de sprites): la dirección sale al bus, pero ningún chip externo se selecciona (U3A Y2 no está conectada).' };
  }
  if (a < 0x4020) {
    return { ...base, zona: 'Modo de prueba ($4018–$401F)', seleccion: null, bloque: 'cpu',
      texto: 'Registros de prueba del 2A03, normalmente desactivados. Ningún chip externo responde.' };
  }
  if (a < 0x8000) {
    return { ...base, zona: 'Cartucho, sin /ROMSEL ($4020–$7FFF)', seleccion: null, bloque: 'prg',
      texto: 'Ningún chip de la placa base se selecciona: A14 = 1 activa Y2 o Y3 de U3A, que no están conectadas. Si el cartucho tiene RAM de partida o registros de mapper aquí, los decodifica él con M2, A13, A14 y /ROMSEL alto.' };
  }
  return { ...base, zona: 'PRG-ROM del cartucho ($8000–$FFFF)', seleccion: '/ROMSEL', bloque: 'prg',
    texto: 'A15 = 1: con M2 alto, U3B pone /ROMSEL a nivel bajo (≈ 20 ns tras el flanco de subida de M2). /ROMSEL = NAND(M2, A15), así que el cartucho no ve un /ROMSEL falso mientras la dirección todavía cambia.' };
}

// ------------------------------------------------------------------ CPU bus cycles

interface Acceso {
  dir: number;
  escritura: boolean;
  dato: number;
  nota: string;
}

function datoLeido(dir: number): number {
  if (dir < 0x2000) return 0x5a;
  if (dir < 0x4000) return (dir & 7) === 2 ? 0x80 : 0x00;
  if (dir === 0x4016) return 0x41;
  if (dir === 0x4017) return 0x40;
  if (dir < 0x8000) return 0x00;
  return 0xea;
}

function ciclosCPU(id: string, titulo: string, descripcion: string, accesos: Acceso[]): Escenario {
  const c = new Cronograma();
  const n = accesos.length;
  const fin = n * TC;
  c.bit('CLK', 'Reloj maestro', 1, '21,477 MHz (46,6 ns)')
    .bit('M2', 'M2 (φ2)', 0, 'Ciclo de CPU = 12 periodos; alto 15/24')
    .bit('RW', 'R/W', 1, 'Alto = lectura')
    .bus('A', 'A15–A0', 'Dirección de la CPU')
    .bit('A15', 'A15', 0)
    .bit('A14', 'A14', 0)
    .bit('A13', 'A13', 0)
    .bus('D', 'D7–D0', 'Bus de datos (null = alta impedancia)')
    .bit('ROMSEL', '/ROMSEL', 1, 'U3B Y3')
    .bit('WRAMCS', 'WRAM /CS', 1, 'U3A Y0')
    .bit('PPUCS', 'PPU /CS', 1, 'U3A Y1')
    .bit('OE1', '/OE1', 1, 'Lectura de $4016')
    .bit('OUT0', 'OUT0', 0, 'Strobe de los mandos')
    .bus('SEL', 'Selección', 'Chip seleccionado');
  c.reloj('CLK', 0, fin, TM, 0.5);
  for (let k = 0; k < n; k++) {
    const x = accesos[k]!;
    const t0 = k * TC;
    const tAlto = t0 + 4.5 * TM; // M2 rises after 9 of the 24 half periods
    const tFin = t0 + TC;
    c.marca(t0);
    c.marca(tAlto);
    c.set('M2', t0, 0);
    c.set('M2', tAlto, 1);
    c.set('RW', t0, x.escritura ? 0 : 1);
    c.set('A', t0, hex(x.dir, 4));
    c.set('A15', t0, ((x.dir >> 15) & 1) as 0 | 1);
    c.set('A14', t0, ((x.dir >> 14) & 1) as 0 | 1);
    c.set('A13', t0, ((x.dir >> 13) & 1) as 0 | 1);
    const d = decodificar(x.dir, x.escritura);
    // data bus: written during φ2; read from the device's access time to the end of φ2
    let tDato = tAlto + 100e-9;
    let sel: string | null = null;
    if (d.seleccion === '/ROMSEL') {
      c.set('ROMSEL', tAlto + T139, 0);
      c.set('ROMSEL', tFin + T139, 1);
      tDato = tAlto + T139 + 200e-9;
      sel = 'PRG-ROM';
    } else if (d.seleccion === 'WRAM /CS') {
      c.set('WRAMCS', tAlto + 2 * T139, 0);
      c.set('WRAMCS', tFin + 2 * T139, 1);
      tDato = tAlto + 2 * T139 + 150e-9;
      sel = 'WRAM';
    } else if (d.seleccion === 'PPU /CS') {
      c.set('PPUCS', tAlto + 2 * T139, 0);
      c.set('PPUCS', tFin + 2 * T139, 1);
      tDato = tAlto + 2 * T139 + 100e-9;
      sel = 'PPU';
    } else if (d.seleccion === '/OE1') {
      c.set('OE1', tAlto, 0);
      c.set('OE1', tFin, 1);
      tDato = tAlto + 20e-9;
      sel = 'Mando I';
    }
    c.set('SEL', t0, null);
    if (sel) c.set('SEL', tAlto, sel);
    c.set('SEL', tFin, null);
    if (x.escritura) {
      c.set('D', tAlto, hex(x.dato, 2));
      c.set('D', tFin, null);
      if (x.dir === 0x4016) c.set('OUT0', tFin, (x.dato & 1) as 0 | 1);
    } else {
      c.set('D', t0, null);
      c.set('D', Math.min(tDato, tFin - 10e-9), hex(x.dato, 2));
      c.set('D', tFin, null);
    }
    c.paso(t0, tFin, `Ciclo ${k + 1}: ${x.escritura ? 'escritura' : 'lectura'} en ${hex(x.dir, 4)} — ${x.nota}`);
  }
  c.marca(fin);
  return {
    id,
    titulo,
    descripcion,
    duracion: fin,
    escala: 'ns',
    pistas: c.pistas(),
    pasos: c.pasos,
    marcas: c.marcas,
    realPorSegundo: TC / 2.5,
    defecto: ['CLK', 'M2', 'RW', 'A', 'D', 'ROMSEL', 'WRAMCS', 'PPUCS', 'OE1'],
    fidelidad:
      'Exacto: periodo maestro (46,56 ns), ciclo de CPU (558,7 ns = 12 periodos), M2 alto 15/24 (349 ns), lectura y escritura en la fase alta de M2, /ROMSEL = NAND(M2, A15), retardo típico del 74LS139 (≈ 20 ns por nivel) y acceso de la MB8416A-15 (150 ns). Ilustrativo: el retardo de la dirección tras el flanco de M2 (no se dibuja), el acceso de la ROM del cartucho (200 ns) y de los registros de la PPU (100 ns), y /OE1 durante la fase alta de M2.',
  };
}

const PROGRAMA: Acceso[] = [
  { dir: 0xc000, escritura: false, dato: 0xad, nota: 'búsqueda del código de operación LDA abs ($AD)' },
  { dir: 0xc001, escritura: false, dato: 0x16, nota: 'byte bajo de la dirección' },
  { dir: 0xc002, escritura: false, dato: 0x40, nota: 'byte alto de la dirección' },
  { dir: 0x4016, escritura: false, dato: 0x41, nota: 'lee el mando I: /OE1 baja y U7 pone el botón en D0' },
  { dir: 0xc003, escritura: false, dato: 0x8d, nota: 'STA abs ($8D)' },
  { dir: 0xc004, escritura: false, dato: 0x00, nota: 'byte bajo' },
  { dir: 0xc005, escritura: false, dato: 0x03, nota: 'byte alto' },
  { dir: 0x0300, escritura: true, dato: 0x41, nota: 'guarda el valor en la WRAM: WRAM /CS y R/W bajos' },
  { dir: 0xc006, escritura: false, dato: 0xad, nota: 'LDA abs' },
  { dir: 0xc007, escritura: false, dato: 0x02, nota: 'byte bajo' },
  { dir: 0xc008, escritura: false, dato: 0x20, nota: 'byte alto' },
  { dir: 0x2002, escritura: false, dato: 0x80, nota: 'lee PPUSTATUS: PPU /CS baja (bit 7 = vblank)' },
];

function escenarioDecodificar(op: Opciones): Escenario {
  const dir = Math.max(0, Math.min(0xffff, parseInt(op.dir ?? 'C000', 16) || 0));
  const w = op.escritura === '1';
  const lo = dir & 0xff;
  const hi = dir >> 8;
  const acc: Acceso[] = [
    { dir: 0xc000, escritura: false, dato: w ? 0x8d : 0xad, nota: w ? 'STA abs ($8D)' : 'LDA abs ($AD)' },
    { dir: 0xc001, escritura: false, dato: lo, nota: 'byte bajo de la dirección elegida' },
    { dir: 0xc002, escritura: false, dato: hi, nota: 'byte alto' },
    { dir, escritura: w, dato: w ? 0x5a : datoLeido(dir), nota: decodificar(dir, w).zona },
  ];
  return ciclosCPU('decodificar', `Acceso a ${hex(dir, 4)}`, `Instrucción ${w ? 'STA' : 'LDA'} ${hex(dir, 4)} ejecutada desde la ROM: tres lecturas de la PRG-ROM y el acceso a la dirección elegida, con su decodificación.`, acc);
}

// ------------------------------------------------------------------ PPU fetches

function escenarioPPU(op: Opciones): Escenario {
  const c = new Cronograma();
  const vertical = (op.espejado ?? 'vertical') === 'vertical';
  const nt = Number(op.nametable ?? '0') & 3;
  const tx = 4;
  const ty = 2;
  const fy = 3;
  const tiles = [0x24, 0x31];
  const accesos: { dir: number; dato: number; nota: string }[] = [];
  for (let k = 0; k < 2; k++) {
    const x = tx + k;
    const ntDir = 0x2000 + nt * 0x400 + ty * 32 + x;
    const atDir = 0x23c0 + nt * 0x400 + (ty >> 2) * 8 + (x >> 2);
    const pt = tiles[k]! * 16 + fy;
    accesos.push({ dir: ntDir, dato: tiles[k]!, nota: `nametable: número de tile de la columna ${x}` });
    accesos.push({ dir: atDir, dato: 0x55, nota: 'tabla de atributos: paleta del bloque de 4 × 4 tiles' });
    accesos.push({ dir: pt, dato: 0x3c, nota: 'patrón, plano bajo (CHR del cartucho)' });
    accesos.push({ dir: pt + 8, dato: 0x7e, nota: 'patrón, plano alto' });
  }
  const fin = accesos.length * 2 * TD;
  c.bit('DOT', 'Reloj de punto', 1, 'Maestro ÷ 4 = 5,369 MHz (186,2 ns)')
    .bit('ALE', 'ALE', 0, 'Alto durante el primer punto del acceso')
    .bit('RD', '/RD', 1)
    .bit('WE', '/WE', 1, 'Sin escrituras durante el renderizado')
    .bus('AD', 'AD7–AD0', 'Dirección baja y luego dato')
    .bus('PAL', 'PA7–PA0 (U2)', 'Salida del 74LS373')
    .bus('PA', 'PA13–PA0', 'Dirección completa que ven las memorias')
    .bit('PA13', 'PA13', 0)
    .bit('CHRCE', 'CHR /CE (= PA13)', 1, 'Cartucho: CHR activa con PA13 bajo')
    .bit('CIRAMCE', 'CIRAM /CE (= /PA13)', 1, 'Por U9 y el cartucho')
    .bit('A10', 'CIRAM A10', 0, vertical ? 'Espejado vertical: = PA10' : 'Espejado horizontal: = PA11')
    .bus('SEL', 'Selección');
  c.reloj('DOT', 0, fin, TD, 0.5);
  accesos.forEach((x, k) => {
    const t0 = k * 2 * TD;
    const t1 = t0 + TD;
    const t2 = t0 + 2 * TD;
    c.marca(t0);
    c.marca(t1);
    const lo = x.dir & 0xff;
    c.set('ALE', t0, 1);
    c.set('ALE', t1, 0);
    c.set('AD', t0, hex(lo, 2));
    c.set('PAL', t0, hex(lo, 2));
    c.set('PA', t0, hex(x.dir, 4));
    const p13 = ((x.dir >> 13) & 1) as 0 | 1;
    c.set('PA13', t0, p13);
    c.set('CHRCE', t0, p13);
    c.set('CIRAMCE', t0, (1 - p13) as 0 | 1);
    const a10 = (vertical ? (x.dir >> 10) & 1 : (x.dir >> 11) & 1) as 0 | 1;
    if (p13) c.set('A10', t0, a10);
    c.set('RD', t1, 0);
    c.set('RD', t2, 1);
    c.set('AD', t1, null);
    c.set('AD', t1 + 60e-9, hex(x.dato, 2));
    c.set('AD', t2, null);
    const quien = p13 ? `CIRAM (página ${a10})` : 'CHR';
    c.set('SEL', t0, quien);
    c.set('SEL', t2, null);
    c.paso(t0, t2, `Acceso ${k + 1}: ${hex(x.dir, 4)} — ${x.nota}. ${p13 ? `CIRAM A10 = ${vertical ? 'PA10' : 'PA11'} = ${a10}` : 'PA13 = 0: responde el cartucho'}.`);
  });
  c.marca(fin);
  return {
    id: 'ppu',
    titulo: 'Lecturas de la PPU',
    descripcion: `Dos tiles del fondo durante el renderizado (8 puntos por tile): nametable, atributo y los dos planos del patrón, cada lectura en 2 puntos. Nametable ${nt} (${hex(0x2000 + nt * 0x400, 4)}), espejado ${vertical ? 'vertical' : 'horizontal'}.`,
    duracion: fin,
    escala: 'ns',
    pistas: c.pistas(),
    pasos: c.pasos,
    marcas: c.marcas,
    realPorSegundo: (2 * TD) / 2.5,
    defecto: ['DOT', 'ALE', 'RD', 'AD', 'PAL', 'PA', 'CHRCE', 'CIRAMCE', 'A10'],
    fidelidad:
      'Exacto: punto = 4 periodos maestros (186,2 ns), 2 puntos por acceso, ALE alto durante el primer punto (NESdev, «PPU pinout»), orden nametable → atributo → patrón bajo → patrón alto, y CIRAM A10 = PA10 o PA11 según el cartucho. Ilustrativo: /RD bajo durante todo el segundo punto y el dato válido 60 ns después (tiempo de habilitación típico de una SRAM de 150 ns).',
  };
}

// ------------------------------------------------------------------ frame and NMI

function escenarioCuadro(): Escenario {
  const c = new Cronograma();
  const TL = 341 * TD; // 63.56 µs
  const fin = 262 * TL;
  c.bus('LINEA', 'Línea', 'Contador de líneas de la PPU')
    .bit('REND', 'Renderizando', 1, 'Líneas 0–239 (y la 261, de preparación)')
    .bit('VBL', 'Bandera vblank', 0, 'PPUSTATUS bit 7')
    .bit('NMI', '/NMI', 1, '/INT de la PPU, drenador abierto')
    .bus('CPU', 'CPU', 'Qué ejecuta la CPU');
  for (let l = 0; l < 262; l++) c.set('LINEA', l * TL, String(l));
  c.set('REND', 0, 1);
  c.set('REND', 240 * TL, 0);
  c.set('REND', 261 * TL, 1);
  const tV = 241 * TL + 1 * TD;
  c.set('VBL', tV, 1);
  c.set('NMI', tV, 0);
  const tEntra = tV + 14 * TC; // finishes the current instruction and runs the 7-cycle interrupt sequence
  const tLee = tEntra + 20 * TC; // the handler saves registers and reads $2002
  c.set('CPU', 0, 'bucle principal');
  c.set('CPU', tV, 'termina la instrucción');
  c.set('CPU', tEntra, 'rutina NMI');
  c.set('CPU', tLee, 'NMI: lee $2002');
  c.set('VBL', tLee + TC, 0);
  c.set('NMI', tLee + TC, 1);
  const tDma = tLee + 4 * TC;
  c.set('CPU', tLee + TC, 'NMI: guarda registros');
  c.set('CPU', tDma, 'NMI: DMA de OAM (513 ciclos)');
  const tVram = tDma + 513 * TC;
  c.set('CPU', tVram, 'NMI: actualiza VRAM');
  const tRti = tV + 1900 * TC;
  c.set('CPU', tRti, 'bucle principal');
  for (const t of [0, 240 * TL, tV, tEntra, tLee, tDma, tVram, tRti, 261 * TL]) c.marca(t);
  c.paso(0, 240 * TL, 'Líneas 0–239: la PPU dibuja; la CPU ejecuta la lógica del juego.');
  c.paso(240 * TL, tV, 'Línea 240: posrenderizado, la PPU no accede a la memoria.');
  c.paso(tV, tEntra, 'Línea 241, punto 1: la PPU activa la bandera de vblank y, con PPUCTRL.7 = 1, baja /INT → /NMI. La CPU acaba la instrucción en curso y salta por el vector $FFFA.');
  c.paso(tEntra, tLee + TC, 'La rutina NMI lee PPUSTATUS ($2002): la lectura borra la bandera y la PPU suelta /NMI.');
  c.paso(tLee + TC, tRti, 'Durante el vblank (20 líneas, ≈ 2270 ciclos) la CPU puede escribir en la VRAM: DMA de sprites y nametables.');
  c.paso(tRti, 261 * TL, 'Vuelve al bucle principal.');
  c.paso(261 * TL, fin, 'Línea 261 (preparación): la PPU borra la bandera y recarga el scroll para el cuadro siguiente.');
  c.marca(fin);
  return {
    id: 'cuadro',
    titulo: 'Cuadro y NMI',
    descripcion: 'Un cuadro completo: 262 líneas de 341 puntos (16,64 ms, 60,10 Hz). En la línea 241 empieza el retrazado vertical y la PPU interrumpe a la CPU con /NMI.',
    duracion: fin,
    escala: 'ms',
    pistas: c.pistas(),
    pasos: c.pasos,
    marcas: c.marcas,
    realPorSegundo: fin / 20,
    defecto: ['LINEA', 'REND', 'VBL', 'NMI', 'CPU'],
    ventana: [239 * TL, 262 * TL],
    fidelidad:
      'Exacto: 341 × 262 puntos de 186,2 ns (16,64 ms), bandera de vblank y /NMI en la línea 241, punto 1, borrado al leer $2002 o en la línea 261, DMA de OAM de 513 ciclos. Ilustrativo: cuántos ciclos tarda la rutina en leer $2002 y en volver (dependen del juego).',
  };
}

// ------------------------------------------------------------------ clocks

function escenarioRelojes(): Escenario {
  const c = new Cronograma();
  const fin = 2 * TC;
  const TCIC = 1 / 4e6;
  c.bit('CLK', 'Reloj maestro', 1, '21,477272 MHz')
    .bit('DOT', 'Punto de la PPU', 1, '÷ 4 → 5,369 MHz')
    .bit('M2', 'M2 de la CPU', 0, '÷ 12 → 1,790 MHz, alto 15/24')
    .bit('CIC', 'Reloj de la CIC', 1, '4 MHz, oscilador propio (X2)');
  c.reloj('CLK', 0, fin, TM);
  c.reloj('DOT', 0, fin, TD);
  for (let k = 0; k < 2; k++) {
    c.set('M2', k * TC, 0);
    c.set('M2', k * TC + 4.5 * TM, 1);
    c.marca(k * TC);
  }
  c.reloj('CIC', 0, fin, TCIC, 0.5, 17e-9);
  for (let k = 0; k <= 24; k++) c.marca(k * TM);
  c.paso(0, fin, 'Un ciclo de CPU (12 periodos maestros) dura exactamente 3 puntos de la PPU (4 periodos cada uno). El reloj de la CIC es independiente: no guarda relación de fase con los demás.');
  return {
    id: 'relojes',
    titulo: 'Relojes',
    descripcion: 'El cristal X1 alimenta a la CPU y a la PPU, que dividen internamente: ÷ 12 y ÷ 4. La CIC usa su propio cristal de 4 MHz.',
    duracion: fin,
    escala: 'ns',
    pistas: c.pistas(),
    pasos: c.pasos,
    marcas: c.marcas,
    realPorSegundo: TC / 4,
    defecto: ['CLK', 'DOT', 'M2', 'CIC'],
    fidelidad: 'Exacto: 21,477272 MHz, ÷ 4 y ÷ 12, M2 alto 15/24 (2A03G). La fase del reloj de la CIC es arbitraria.',
  };
}

export const NES: Maquina = {
  id: 'nes',
  diagrama,
  digitos: 4,
  decodificar,
  escenarios: [
    { id: 'bus', titulo: 'Ciclos de la CPU', crear: () => ciclosCPU('bus', 'Ciclos de bus de la CPU', 'Tres instrucciones (LDA $4016, STA $0300, LDA $2002), doce ciclos de 558,7 ns: cada uno empieza al bajar M2, y el 74LS139 baja la selección que corresponde a la dirección mientras M2 está alto.', PROGRAMA) },
    { id: 'decodificar', titulo: 'Decodificar una dirección', crear: escenarioDecodificar },
    { id: 'ppu', titulo: 'Lecturas de la PPU', crear: escenarioPPU },
    { id: 'cuadro', titulo: 'Cuadro y NMI', crear: escenarioCuadro },
    { id: 'relojes', titulo: 'Relojes', crear: escenarioRelojes },
  ],
  ejemplos: [
    { dir: 0x0300, escritura: false, texto: 'RAM' },
    { dir: 0x1b00, escritura: true, texto: 'espejo de la RAM' },
    { dir: 0x2007, escritura: true, texto: 'PPUDATA' },
    { dir: 0x3ff2, escritura: false, texto: 'espejo de PPUSTATUS' },
    { dir: 0x4016, escritura: false, texto: 'mando I' },
    { dir: 0x6000, escritura: true, texto: 'RAM del cartucho' },
    { dir: 0xfffa, escritura: false, texto: 'vector NMI' },
  ],
  opciones: [
    { id: 'espejado', titulo: 'Espejado del cartucho', escenarios: ['ppu'],
      valores: [{ v: 'vertical', texto: 'Vertical (A10 = PA10)' }, { v: 'horizontal', texto: 'Horizontal (A10 = PA11)' }] },
    { id: 'nametable', titulo: 'Nametable', escenarios: ['ppu'],
      valores: [{ v: '0', texto: '$2000' }, { v: '1', texto: '$2400' }, { v: '2', texto: '$2800' }, { v: '3', texto: '$2C00' }] },
  ],
};
