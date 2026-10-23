// Neo Geo AES (first NEO-AES board): block diagram, 68000 address decoding and the timed scenarios.
//
// Timing figures: 24 MHz master clock (24,000 MHz NTSC; the AES3-5 schematic gives 24,167829 MHz for PAL);
// 68000 at 12 MHz, 4 clocks (8 states S0-S7) per bus cycle, AS/UDS/LDS from S2 to S7, data latched entering
// S7, DTACK sampled at the end of S4 (Motorola M68000 user's manual); Z80 at 4 MHz with its standard M1 (4 T),
// memory (3 T) and I/O (4 T, one automatic wait) cycles and the 11 T NMI response (Zilog Z80 user manual);
// YM2610 at 8 MHz; pixel clock 6 MHz, 384 pixels per line (64 us), 264 lines, 320 x 224 visible; up to 96
// sprites of 16 pixels per line, written 2 pixels per 12 MHz cycle (96 x 16 = 1536 = 4 x 384 pixels: the
// line buffer is filled at 24 Mpixel/s); fix layer 8 x 8 tiles (neogeodev wiki, SNK hardware specification).

import { Cronograma, hex, type Escenario } from './modelo';
import type { Decodificacion, Diagrama, Maquina, Opciones } from './diagrama';

const T24 = 1 / 24e6;
const T12 = 2 * T24;
const TZ = 1 / 4e6;

// ------------------------------------------------------------------ diagram

const diagrama: Diagrama = {
  ancho: 1000,
  alto: 580,
  bloques: [
    { id: 'reloj', x: 20, y: 18, w: 170, h: 60, titulo: 'Oscilador 24 MHz', sub: 'X1 · 12 MHz al 68000', foto: 'reloj', esquema: ['X1'],
      actividad: [{ pista: '24M', nivel: 1 }],
      info: 'Cristal de 24 MHz. El 68000 recibe la mitad (12 MHz); el LSPC genera 8 MHz para el YM2610, 4 MHz para el Z80 y el reloj de píxel de 6 MHz.' },
    { id: 'm68k', x: 20, y: 104, w: 180, h: 116, titulo: 'CPU 68000', sub: 'TMP68HC000N-12 · 12 MHz', foto: '68k', esquema: ['U3'],
      actividad: [{ pista: 'AS' }],
      info: 'Bus de 24 bits de dirección (A1–A23 más /UDS y /LDS para los bytes) y 16 de datos. Cada ciclo de bus dura 4 ciclos de reloj (333 ns) más las esperas que pida el chipset retrasando /DTACK.' },
    { id: 'proc0', x: 230, y: 140, w: 150, h: 72, titulo: 'PRO-C0', sub: 'decodificación 68k · watchdog', foto: 'proc0', esquema: ['U4'],
      actividad: [{ pista: 'SEL' }],
      info: 'Decodifica la dirección del 68000 y baja la selección del chip que corresponde (ROM, RAM, paleta, LSPC, puertos, BIOS, tarjeta); genera /DTACK. En la 2.ª generación lo hace el NEO-C1.' },
    { id: 'lspc', x: 480, y: 104, w: 170, h: 116, titulo: 'LSPC-A0', sub: 'sprites · vídeo · IRQ', foto: 'lspc', esquema: ['U21'],
      actividad: [{ pista: 'LSPSEL' }, { pista: 'PCK1', nivel: 1 }, { pista: 'PCK2', nivel: 1 }, { pista: 'IPL' }],
      info: 'Recorre las VRAM, decide qué sprites hay en cada línea y saca por el bus P las direcciones de las ROM C, S y L0. Genera el sincronismo y las interrupciones del 68000 (IPL0, IPL1).' },
    { id: 'svram', x: 690, y: 18, w: 140, h: 60, titulo: 'VRAM lenta', sub: '32 K × 16 · SCB1, fix', foto: 'svram', esquema: ['U17', 'U18'],
      actividad: [{ pista: 'SVRAM' }],
      info: 'Tiles y atributos de los sprites (SCB1) y mapa de la capa fija.' },
    { id: 'fvram', x: 845, y: 18, w: 135, h: 60, titulo: 'VRAM rápida', sub: '2 K × 16 · SCB2–4', foto: 'fvram', esquema: ['U19', 'U20'],
      actividad: [{ pista: 'FVRAM' }],
      info: 'Reducción, posición Y/altura y posición X de los sprites, y la lista de sprites de la línea.' },
    { id: 'l0', x: 690, y: 200, w: 90, h: 56, titulo: 'ROM L0', sub: 'reducción', foto: 'l0', esquema: ['U16'],
      actividad: [{ pista: 'L0' }],
      info: 'Tabla de reducción vertical: qué línea del tile toca con cada factor de reducción.' },
    { id: 'crom', x: 790, y: 200, w: 110, h: 56, titulo: 'ROM C', sub: '+ NEO-ZMC2 (CHA)', foto: 'cart', esquema: ['CN4'], externo: true,
      actividad: [{ pista: 'LOAD', nivel: 1 }],
      info: 'Gráficos de los sprites, 4 bits por píxel. El NEO-ZMC2 del cartucho serializa 32 bits (8 píxeles) en dos píxeles por ciclo de 12 MHz (GAD, GBD).' },
    { id: 'srom', x: 910, y: 200, w: 75, h: 56, titulo: 'ROM S', sub: 'capa fija', foto: 'cart', esquema: ['CN4'], externo: true,
      actividad: [{ pista: 'PCK2', nivel: 1 }],
      info: 'Tiles de 8 × 8 de la capa fija (textos, marcadores), siempre encima de los sprites.' },
    { id: 'buf', x: 690, y: 300, w: 180, h: 70, titulo: 'Buffers de línea ×2', sub: 'PRO-B0 (paleta) + PRO-C0 (color)', foto: 'prob0', esquema: ['U13'],
      actividad: [{ pista: 'GAD' }],
      info: 'Mientras uno se escribe con los sprites de la línea siguiente, el otro se lee para mostrar la actual; se intercambian en cada línea. Cada entrada guarda paleta (8 bits, PRO-B0) y color (4 bits, PRO-C0).' },
    { id: 'wram', x: 20, y: 310, w: 125, h: 70, titulo: 'RAM de usuario', sub: '64 KB · $100000', foto: 'wram', esquema: ['U1', 'U2'],
      actividad: [{ pista: 'RAMSEL' }], info: 'Dos SRAM de 32K × 8 (byte alto y byte bajo).' },
    { id: 'bios', x: 160, y: 310, w: 125, h: 70, titulo: 'BIOS', sub: 'NEO-EP0 · $C00000', foto: 'bios', esquema: ['U36'],
      actividad: [{ pista: 'SROMOE' }], info: 'ROM del sistema de 128 KB.' },
    { id: 'prom', x: 300, y: 310, w: 130, h: 70, titulo: 'ROM P', sub: 'cartucho (PROG)', foto: 'cart', esquema: ['CN5'], externo: true,
      actividad: [{ pista: 'ROMOE' }], info: 'Programa del juego: banco fijo de 1 MB en $000000 y ventana conmutable en $200000.' },
    { id: 'palram', x: 480, y: 310, w: 120, h: 70, titulo: 'RAM de paleta', sub: '8 K × 16 · $400000', foto: 'palram', esquema: ['U6', 'U7'],
      actividad: [{ pista: 'PAL' }, { pista: 'PA' }],
      info: 'La direcciona el buffer de línea durante la imagen y el 68000 durante el borrado (o con espera).' },
    { id: 'dac', x: 480, y: 420, w: 120, h: 60, titulo: 'Latches + DAC', sub: '74LS273 · resistencias', foto: 'latch', esquema: ['U9', 'U10'],
      actividad: [{ pista: 'RGB' }], info: 'Los 74LS273 retienen el color con el reloj de píxel; las resistencias lo convierten en R, G y B.' },
    { id: 'enc', x: 480, y: 510, w: 120, h: 56, titulo: 'Codificador', sub: 'CXA1145 → A/V', foto: 'enc', esquema: ['U32'],
      actividad: [{ pista: 'SYNC' }], info: 'RGB y sincronismo → vídeo compuesto y RGB para el conector DIN.' },
    { id: 'z80', x: 20, y: 425, w: 140, h: 70, titulo: 'Z80', sub: '4 MHz · sonido', foto: 'z80', esquema: ['U24'],
      actividad: [{ pista: 'ZA' }], info: 'Programa en la ROM M1 del cartucho; RAM de 2 KB; habla con el YM2610 por puertos de E/S.' },
    { id: 'ym', x: 180, y: 425, w: 140, h: 70, titulo: 'YM2610', sub: '8 MHz · FM + ADPCM', foto: 'ym2610', esquema: ['U27'],
      actividad: [{ pista: 'YMCS' }], info: 'Sus registros se escriben por los puertos $04–$07 del Z80; lee las muestras ADPCM de las ROM V él solo.' },
    { id: 'prob0', x: 330, y: 425, w: 130, h: 70, titulo: 'PRO-B0', sub: 'código 68k ↔ Z80 · mandos', foto: 'prob0', esquema: ['U4'],
      actividad: [{ pista: 'SDZ80' }, { pista: 'ZNMI' }],
      info: 'Contiene el latch de un byte entre las dos CPU y lee los mandos. Escribir en $320000 deja el código y dispara la NMI del Z80.' },
    { id: 'z80ram', x: 20, y: 520, w: 120, h: 50, titulo: 'RAM del Z80', sub: '2 KB · $F800', foto: 'z80ram', esquema: ['U23'],
      actividad: [{ pista: 'ZRAM' }], info: 'BR6116.' },
    { id: 'vrom', x: 180, y: 520, w: 140, h: 50, titulo: 'ROM M1 y V', sub: 'cartucho (PROG)', foto: 'cart', esquema: ['CN4'], externo: true,
      actividad: [{ pista: 'ZROM' }], info: 'M1: programa del Z80. V: muestras ADPCM que lee el YM2610.' },
  ],
  conexiones: [
    { id: 'clk68', puntos: [[60, 78], [60, 104]], bits: 1, etiqueta: '12 MHz', pos: [92, 92], clase: 'reloj', pista: 'CLK68', nivel: 1, red: '68KCLK' },
    { id: 'clk24', puntos: [[190, 48], [565, 48], [565, 104]], bits: 1, etiqueta: '24 MHz', pos: [380, 42], clase: 'reloj', pista: '24M', nivel: 1, red: '24M' },
    { id: 'ipl', puntos: [[480, 118], [200, 118]], bits: 2, etiqueta: '/IPL0–1', pos: [430, 112], clase: 'interrupcion', pista: 'IPL', nivel: 0, red: 'IPL0' },
    { id: 'dtack', puntos: [[230, 196], [200, 196]], bits: 1, etiqueta: '/DTACK', pos: [215, 206], clase: 'control', pista: 'DTACK', nivel: 0, red: 'PDTACK' },
    { id: 'bus-a', puntos: [[20, 246], [660, 246]], bits: 23, etiqueta: 'A1–A23', pos: [420, 240], clase: 'bus', pista: 'A', valor: true, red: '/CPU/A1' },
    { id: 'bus-d', puntos: [[20, 268], [660, 268]], bits: 16, etiqueta: 'D0–D15', pos: [420, 262], clase: 'dato', pista: 'D', valor: true, red: '/CPU/D0' },
    { id: 'bus-sel', puntos: [[40, 292], [600, 292]], bits: 1, etiqueta: 'selecciones', pos: [470, 287], clase: 'seleccion', pista: 'SEL', valor: true },
    { id: 'm-a', puntos: [[60, 220], [60, 246]], bits: 23, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'm-d', puntos: [[150, 220], [150, 268]], bits: 16, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'p-a', puntos: [[260, 246], [260, 212]], bits: 23, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'p-sel', puntos: [[350, 212], [350, 292]], bits: 1, etiqueta: '', clase: 'seleccion', pista: 'SEL' },
    { id: 'lspsel', puntos: [[380, 176], [480, 176]], bits: 2, etiqueta: 'LSPOE/WE', pos: [430, 170], clase: 'seleccion', pista: 'LSPSEL', nivel: 0, red: 'LSPWE' },
    { id: 'w-a', puntos: [[35, 246], [35, 310]], bits: 15, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'w-d', puntos: [[75, 268], [75, 310]], bits: 16, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'w-s', puntos: [[115, 292], [115, 310]], bits: 1, etiqueta: '', clase: 'seleccion', pista: 'RAMSEL', nivel: 0 },
    { id: 'b-a', puntos: [[175, 246], [175, 310]], bits: 16, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'b-d', puntos: [[215, 268], [215, 310]], bits: 16, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'b-s', puntos: [[255, 292], [255, 310]], bits: 1, etiqueta: '', clase: 'seleccion', pista: 'SROMOE', nivel: 0 },
    { id: 'r-a', puntos: [[315, 246], [315, 310]], bits: 19, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'r-d', puntos: [[355, 268], [355, 310]], bits: 16, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'r-s', puntos: [[400, 292], [400, 310]], bits: 1, etiqueta: '', clase: 'seleccion', pista: 'ROMOE', nivel: 0, red: 'ROMOE' },
    { id: 'pal-a', puntos: [[495, 246], [495, 310]], bits: 12, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'pal-d', puntos: [[535, 268], [535, 310]], bits: 16, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'pal-s', puntos: [[575, 292], [575, 310]], bits: 1, etiqueta: '', clase: 'seleccion', pista: 'PAL', nivel: 0 },
    { id: 'l-a', puntos: [[500, 246], [500, 220]], bits: 3, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'l-d', puntos: [[620, 268], [620, 220]], bits: 16, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'svram', puntos: [[640, 104], [640, 48], [690, 48]], bits: 31, etiqueta: 'B, E', pos: [665, 42], clase: 'bus', pista: 'SVRAM', red: '/GRAPHICS/B0' },
    { id: 'fvram', puntos: [[650, 132], [912, 132], [912, 78]], bits: 27, etiqueta: 'C, F', pos: [780, 126], clase: 'bus', pista: 'FVRAM' },
    { id: 'bus-p', puntos: [[650, 168], [985, 168]], bits: 24, etiqueta: 'P0–P23', pos: [700, 162], clase: 'bus', pista: 'P', valor: true, red: '/Cartridge Slots/P0' },
    { id: 'p-l0', puntos: [[735, 168], [735, 200]], bits: 24, etiqueta: '', clase: 'bus', pista: 'L0' },
    { id: 'p-c', puntos: [[845, 168], [845, 200]], bits: 24, etiqueta: '', clase: 'bus', pista: 'P' },
    { id: 'p-s', puntos: [[960, 168], [960, 200]], bits: 16, etiqueta: '', clase: 'bus', pista: 'P' },
    { id: 'pck1', puntos: [[650, 188], [822, 188], [822, 200]], bits: 1, etiqueta: 'PCK1', pos: [770, 183], clase: 'control', pista: 'PCK1', nivel: 1, red: 'PCK1' },
    { id: 'pck2', puntos: [[822, 188], [930, 188], [930, 200]], bits: 1, etiqueta: 'PCK2', pos: [880, 183], clase: 'control', pista: 'PCK2', nivel: 1, red: 'PCK2' },
    { id: 'gad', puntos: [[845, 256], [845, 300]], bits: 10, etiqueta: 'GAD/GBD', pos: [812, 280], clase: 'dato', pista: 'GAD', valor: true, red: 'GAD0' },
    { id: 'fix', puntos: [[965, 256], [965, 335], [870, 335]], bits: 8, etiqueta: 'FIXD', pos: [940, 300], clase: 'dato', pista: 'FIX', red: '/Cartridge Slots/FIXD0' },
    { id: 'pa', puntos: [[690, 335], [600, 335]], bits: 12, etiqueta: 'PA0–11', pos: [645, 329], clase: 'bus', pista: 'PA', valor: true, red: '/VIDEO/PA0' },
    { id: 'color', puntos: [[540, 380], [540, 420]], bits: 16, etiqueta: 'PC0–15', pos: [570, 402], clase: 'dato', pista: 'RGB', red: '/VIDEO/PC0' },
    { id: 'rgb', puntos: [[540, 480], [540, 510]], bits: 3, etiqueta: 'R, G, B', pos: [570, 497], clase: 'dato', pista: 'RGB' },
    { id: 'sdz80', puntos: [[448, 268], [448, 425]], bits: 8, etiqueta: '$320000', pos: [455, 410], clase: 'seleccion', pista: 'SDZ80', nivel: 0, red: 'SDZ80W' },
    { id: 'znmi', puntos: [[360, 425], [360, 410], [100, 410], [100, 425]], bits: 1, etiqueta: '/NMI', pos: [230, 404], clase: 'interrupcion', pista: 'ZNMI', nivel: 0 },
    { id: 'bus-z', puntos: [[20, 508], [460, 508]], bits: 24, etiqueta: 'SDA, SDD', pos: [400, 503], clase: 'bus', pista: 'ZA', valor: true, red: '/CPU/SDD0' },
    { id: 'z-z', puntos: [[120, 495], [120, 508]], bits: 24, etiqueta: '', clase: 'bus', pista: 'ZA' },
    { id: 'z-ym', puntos: [[260, 495], [260, 508]], bits: 8, etiqueta: '', clase: 'bus', pista: 'YMCS', nivel: 0 },
    { id: 'z-b0', puntos: [[400, 495], [400, 508]], bits: 8, etiqueta: '', clase: 'bus', pista: 'ZLATCH', nivel: 0 },
    { id: 'z-ram', puntos: [[60, 508], [60, 520]], bits: 11, etiqueta: '', clase: 'bus', pista: 'ZRAM', nivel: 0 },
    { id: 'z-rom', puntos: [[220, 508], [220, 520]], bits: 16, etiqueta: '', clase: 'bus', pista: 'ZROM', nivel: 0 },
    { id: 'adpcm', puntos: [[300, 495], [300, 520]], bits: 8, etiqueta: 'ADPCM', pos: [300, 515], clase: 'bus', red: '/YM2610 AUDIO/SDRAD0' },
    { id: 'zint', puntos: [[180, 470], [160, 470]], bits: 1, etiqueta: '/INT', pos: [170, 462], clase: 'interrupcion', pista: 'ZINT', nivel: 0, red: 'Z80INT' },
  ],
};

// ------------------------------------------------------------------ address decoding

interface Region {
  desde: number;
  hasta: number;
  zona: string;
  bloque: string | null;
  lectura: string | null;
  escritura: string | null;
  texto: string;
}

const MAPA: Region[] = [
  { desde: 0x000000, hasta: 0x0fffff, zona: 'ROM P, banco fijo (1 MB)', bloque: 'prom', lectura: 'ROMOE', escritura: null,
    texto: 'ROM de programa del cartucho. Los primeros 128 bytes (vectores) pueden venir de la BIOS o del cartucho según el registro de cambio de vectores.' },
  { desde: 0x100000, hasta: 0x1fffff, zona: 'RAM de usuario (64 KB, espejada)', bloque: 'wram', lectura: 'RAM /OE', escritura: 'RAM /WE',
    texto: 'Dos SRAM de 32K × 8: /UDS elige la del byte alto y /LDS la del bajo. Solo se decodifican A1–A15: el resto de la zona son espejos.' },
  { desde: 0x200000, hasta: 0x2fffff, zona: 'ROM P conmutable / E/S del cartucho', bloque: 'prom', lectura: 'PORTADRS', escritura: 'PORTADRS',
    texto: 'Ventana de 1 MB sobre el resto de la ROM P; los cartuchos grandes ponen aquí su registro de banco (PORTWEL/U).' },
  { desde: 0x300000, hasta: 0x31ffff, zona: 'Mando 1 / watchdog', bloque: 'prob0', lectura: 'mando 1', escritura: 'watchdog',
    texto: 'Lectura en $300000: mando 1 (PRO-B0). Escritura en $300001: reinicia el watchdog (PRO-C0); si el programa no lo hace, la consola se reinicia.' },
  { desde: 0x320000, hasta: 0x33ffff, zona: 'Código de sonido (68000 ↔ Z80)', bloque: 'prob0', lectura: 'SDZ80R', escritura: 'SDZ80W',
    texto: 'Escritura: deja un byte para el Z80 y le provoca una NMI. Lectura: la respuesta del Z80 (más las entradas de monedas en el MVS).' },
  { desde: 0x340000, hasta: 0x35ffff, zona: 'Mando 2', bloque: 'prob0', lectura: 'mando 2', escritura: null, texto: 'Lectura del mando 2 (PRO-B0).' },
  { desde: 0x360000, hasta: 0x37ffff, zona: 'Sin uso en el AES', bloque: null, lectura: null, escritura: null, texto: 'Nada responde.' },
  { desde: 0x380000, hasta: 0x39ffff, zona: 'Estado y salidas', bloque: 'prob0', lectura: 'estado', escritura: 'salidas',
    texto: 'Lectura: botones Start/Select y estado de la tarjeta. Escritura: salidas de los puertos de mando.' },
  { desde: 0x3a0000, hasta: 0x3bffff, zona: 'Latch del sistema', bloque: 'proc0', lectura: null, escritura: 'latch del sistema',
    texto: 'Bits de control (vectores BIOS/cartucho, banco de paleta, protección de la tarjeta…); en la 3-5, el 74HC259 U35.' },
  { desde: 0x3c0000, hasta: 0x3dffff, zona: 'Registros del LSPC', bloque: 'lspc', lectura: 'LSPOE', escritura: 'LSPWE',
    texto: 'VRAMADDR ($3C0000), VRAMRW ($3C0002), VRAMMOD ($3C0004), LSPCMODE ($3C0006), TIMER ($3C0008–A), IRQACK ($3C000C). El 68000 solo ve la VRAM a través de ellos.' },
  { desde: 0x3e0000, hasta: 0x3fffff, zona: 'Sin uso', bloque: null, lectura: null, escritura: null, texto: 'Nada responde.' },
  { desde: 0x400000, hasta: 0x7fffff, zona: 'RAM de paleta ($400000–$401FFF, espejada)', bloque: 'palram', lectura: 'PAL', escritura: 'PAL',
    texto: '4096 colores de 16 bits por banco; el banco activo lo elige el latch del sistema (PALBNK).' },
  { desde: 0x800000, hasta: 0xbfffff, zona: 'Tarjeta de memoria', bloque: null, lectura: 'CARDCS', escritura: 'CARDCS',
    texto: 'Tarjeta de 8 bits: solo los bytes impares (/LDS).' },
  { desde: 0xc00000, hasta: 0xcfffff, zona: 'BIOS (128 KB, espejada)', bloque: 'bios', lectura: 'SROMOE', escritura: null,
    texto: 'ROM del sistema NEO-EP0.' },
  { desde: 0xd00000, hasta: 0xdfffff, zona: 'RAM de respaldo (solo MVS)', bloque: null, lectura: null, escritura: null,
    texto: 'El AES no tiene RAM de respaldo ni reloj: nada responde.' },
  { desde: 0xe00000, hasta: 0xffffff, zona: 'Sin uso', bloque: null, lectura: null, escritura: null, texto: 'Nada responde.' },
];

export function decodificar(dir: number, escritura: boolean): Decodificacion {
  const a = dir & 0xffffff;
  const r = MAPA.find((m) => a >= m.desde && a <= m.hasta)!;
  const sel = escritura ? r.escritura : r.lectura;
  const byte = a & 1 ? '/LDS (byte impar, D0–D7)' : '/UDS (byte par, D8–D15)';
  const tabla = MAPA.map((m) => ({
    etiqueta: `${hex(m.desde, 6)}–${hex(m.hasta, 6)}`,
    valor: m.zona,
    activa: m === r,
  }));
  let espejo: string | undefined;
  if (r.bloque === 'wram') espejo = hex(0x100000 + (a & 0xffff), 6);
  if (r.bloque === 'palram') espejo = hex(0x400000 + (a & 0x1fff), 6);
  if (r.bloque === 'bios') espejo = hex(0xc00000 + (a & 0x1ffff), 6);
  return {
    direccion: a,
    escritura,
    zona: r.zona,
    seleccion: sel,
    bloque: sel ? r.bloque : null,
    espejo,
    texto: `${r.texto} ${sel ? `Selección: ${sel}, con ${byte} en un acceso de byte.` : escritura && r.lectura ? 'En escritura no se selecciona nada.' : ''} En la placa de la foto decodifica el PRO-C0 (en la 3-5, el NEO-C1).`,
    tabla,
  };
}

// ------------------------------------------------------------------ 68000 bus cycles

interface Ciclo68 {
  dir: number;
  escritura: boolean;
  dato: number;
  /** 'W' word, 'U' upper byte, 'L' lower byte. */
  ancho: 'W' | 'U' | 'L';
  esperas: number;
  nota: string;
}

function bitDeSeleccion(sel: string | null): string | null {
  if (!sel) return null;
  if (sel === 'ROMOE') return 'ROMOE';
  if (sel.startsWith('RAM')) return 'RAMSEL';
  if (sel.startsWith('LSP')) return 'LSPSEL';
  if (sel.startsWith('SDZ80')) return 'SDZ80';
  if (sel === 'PAL') return 'PAL';
  if (sel === 'SROMOE') return 'SROMOE';
  if (sel === 'PORTADRS') return 'PORT';
  if (sel === 'CARDCS') return 'CARDCS';
  return null;
}

function ciclos68k(id: string, titulo: string, descripcion: string, lista: Ciclo68[]): Escenario {
  const c = new Cronograma();
  c.bit('CLK68', 'Reloj 68000', 1, '12 MHz (83,3 ns)')
    .bit('AS', '/AS', 1)
    .bit('RW', 'R/W', 1)
    .bit('UDS', '/UDS', 1)
    .bit('LDS', '/LDS', 1)
    .bus('A', 'A23–A1', 'Dirección (con UDS/LDS)')
    .bus('D', 'D15–D0', 'Datos')
    .bit('DTACK', '/DTACK', 1, 'Del chipset; si llega tarde, esperas')
    .bus('SEL', 'Selección', 'Selección activa (nombre de la red en la 3-5)')
    .bit('ROMOE', 'ROMOE', 1)
    .bit('RAMSEL', 'RAM /OE·/WE', 1)
    .bit('LSPSEL', 'LSPOE/LSPWE', 1)
    .bit('SDZ80', 'SDZ80W/R', 1)
    .bit('PAL', 'PAL', 1)
    .bit('SROMOE', 'SROMOE', 1)
    .bit('PORT', 'PORTADRS', 1)
    .bit('CARDCS', 'CARDCS', 1)
    .bit('ZNMI', '/NMI del Z80', 1);
  let t = 0;
  for (const [k, x] of lista.entries()) {
    const s = (n: number) => t + n * (T12 / 2) + (n >= 5 ? x.esperas * T12 : 0);
    const fin = s(8);
    c.marca(t);
    c.marca(s(2));
    c.marca(s(4));
    c.marca(s(7));
    c.set('RW', t, 1);
    c.set('A', s(1), hex(x.dir & 0xfffffe, 6));
    c.set('AS', s(2), 0);
    if (x.escritura) c.set('RW', s(2), 0);
    const strobe = x.escritura ? s(4) : s(2);
    if (x.ancho !== 'L') c.set('UDS', strobe, 0);
    if (x.ancho !== 'U') c.set('LDS', strobe, 0);
    c.set('AS', s(7), 1);
    c.set('UDS', s(7), 1);
    c.set('LDS', s(7), 1);
    c.set('RW', s(8) - 1e-12, 1);
    const d = decodificar(x.dir, x.escritura);
    const b = bitDeSeleccion(d.seleccion);
    if (b) {
      c.set(b, s(2), 0);
      c.set(b, s(7), 1);
    }
    c.set('SEL', s(2), d.seleccion ?? '—');
    c.set('SEL', s(7), null);
    c.set('DTACK', s(3) + x.esperas * T12, 0);
    c.set('DTACK', s(7) + T24 / 2, 1);
    const txt = x.ancho === 'W' ? hex(x.dato, 4) : x.ancho === 'U' ? hex(x.dato, 2) + '··' : '··' + hex(x.dato, 2);
    if (x.escritura) {
      c.set('D', s(3), txt);
      c.set('D', fin, null);
    } else {
      c.set('D', s(5), txt);
      c.set('D', s(7) + T24, null);
    }
    if (x.escritura && b === 'SDZ80') c.set('ZNMI', s(7), 0);
    c.paso(t, fin, `Ciclo ${k + 1}: ${x.escritura ? 'escritura' : 'lectura'} ${x.ancho === 'W' ? 'de palabra' : 'de byte'} en ${hex(x.dir, 6)} — ${x.nota}${x.esperas ? ` (${x.esperas} espera${x.esperas > 1 ? 's' : ''})` : ''}.`);
    t = fin;
  }
  c.reloj('CLK68', 0, t, T12);
  c.marca(t);
  return {
    id,
    titulo,
    descripcion,
    duracion: t,
    escala: 'ns',
    pistas: c.pistas(),
    pasos: c.pasos,
    marcas: [...new Set(c.marcas)].sort((a, b) => a - b),
    realPorSegundo: (4 * T12) / 3,
    defecto: ['CLK68', 'AS', 'RW', 'UDS', 'LDS', 'A', 'D', 'DTACK', 'SEL'],
    fidelidad:
      'Exacto: reloj de 12 MHz, ciclo de 4 periodos (8 estados) más las esperas, /AS y /UDS·/LDS bajos de S2 a S7 (en escritura los strobes bajan en S4), dato capturado al entrar en S7 y /DTACK muestreado al final de S4 (manual del M68000). Ilustrativo: los retardos de decodificación del PRO-C0 (no documentados: la selección se dibuja con /AS) y cuándo deja el dato cada memoria (se dibuja desde S5).',
  };
}

function programa68(op: Opciones): Ciclo68[] {
  const esp = Number(op.esperas ?? '0');
  return [
    { dir: 0x000400, escritura: false, dato: 0x33fc, ancho: 'W', esperas: esp, nota: 'busca la instrucción en la ROM P' },
    { dir: 0x10f000, escritura: false, dato: 0x1234, ancho: 'W', esperas: 0, nota: 'lee la RAM de usuario' },
    { dir: 0x3c0000, escritura: true, dato: 0x7000, ancho: 'W', esperas: 0, nota: 'VRAMADDR ← $7000 (registro del LSPC)' },
    { dir: 0x3c0002, escritura: true, dato: 0x0f0f, ancho: 'W', esperas: 0, nota: 'VRAMRW: el LSPC escribirá el dato en la VRAM' },
    { dir: 0x320000, escritura: true, dato: 0x07, ancho: 'U', esperas: 0, nota: 'código de sonido $07 para el Z80 (dispara su NMI)' },
    { dir: 0x400002, escritura: false, dato: 0x7fff, ancho: 'W', esperas: 0, nota: 'lee un color de la paleta' },
    { dir: 0xc00402, escritura: false, dato: 0x4e75, ancho: 'W', esperas: 0, nota: 'lee la BIOS' },
  ];
}

function escenarioDecodificar(op: Opciones): Escenario {
  const dir = Math.max(0, Math.min(0xffffff, parseInt(op.dir ?? '100000', 16) || 0));
  const w = op.escritura === '1';
  const lista: Ciclo68[] = [
    { dir: 0x000400, escritura: false, dato: w ? 0x33fc : 0x3039, ancho: 'W', esperas: Number(op.esperas ?? '0'), nota: w ? 'MOVE.W #imm, abs.L' : 'MOVE.W abs.L, D0' },
    { dir: 0x000402, escritura: false, dato: dir >> 16, ancho: 'W', esperas: Number(op.esperas ?? '0'), nota: 'mitad alta de la dirección' },
    { dir: 0x000404, escritura: false, dato: dir & 0xffff, ancho: 'W', esperas: Number(op.esperas ?? '0'), nota: 'mitad baja' },
    { dir, escritura: w, dato: w ? 0x5a5a : 0x1234, ancho: dir & 1 ? 'L' : 'W', esperas: 0, nota: decodificar(dir, w).zona },
  ];
  return ciclos68k('decodificar', `Acceso a ${hex(dir, 6)}`, `El 68000 lee la instrucción (tres palabras de la ROM P) y accede a ${hex(dir, 6)}; el PRO-C0 baja la selección que corresponde.`, lista);
}

// ------------------------------------------------------------------ 68000 <-> Z80

function escenarioZ80(): Escenario {
  const c = new Cronograma();
  c.bit('AS', '68000 /AS', 1)
    .bus('A', '68000 A23–A1')
    .bus('D', '68000 D15–D0')
    .bit('SDZ80', 'SDZ80W/R', 1, 'Acceso a $320000')
    .bus('LATCH', 'Latch 68k → Z80', 'Byte guardado en PRO-B0')
    .bit('ZNMI', 'Z80 /NMI', 1)
    .bit('ZCLK', 'Reloj Z80', 1, '4 MHz (250 ns)')
    .bit('M1', '/M1', 1)
    .bit('MREQ', '/MREQ', 1)
    .bit('IORQ', '/IORQ', 1)
    .bit('RD', '/RD', 1)
    .bit('WR', '/WR', 1)
    .bus('ZA', 'Z80 A15–A0 (SDA)')
    .bus('ZD', 'Z80 D7–D0 (SDD)')
    .bit('ZRAM', 'RAM Z80 /CE', 1)
    .bit('ZROM', 'ROM M1 /OE', 1)
    .bit('YMCS', '2610 /CS', 1)
    .bit('YMWR', '2610 /WR', 1)
    .bit('ZLATCH', 'Puertos $00/$0C', 1)
    .bit('ZINT', 'Z80 /INT', 1, '/IRQ del YM2610');

  // 68000 writes the sound code
  const ciclo68 = (t: number, dir: number, w: boolean, dato: string): number => {
    const s = (n: number) => t + n * (T12 / 2);
    c.set('A', s(1), hex(dir, 6));
    c.set('AS', s(2), 0);
    c.set('SDZ80', s(2), 0);
    c.set('AS', s(7), 1);
    c.set('SDZ80', s(7), 1);
    c.set('D', w ? s(3) : s(5), dato);
    c.set('D', s(8), null);
    c.set('A', s(8), null);
    return s(7);
  };
  const tCodigo = ciclo68(0, 0x320000, true, '07··');
  c.set('LATCH', tCodigo, '$07');
  c.set('ZNMI', tCodigo, 0);
  c.paso(0, 4 * T12, 'El 68000 escribe el código $07 en $320000: el PRO-B0 lo guarda y baja /NMI del Z80.');

  // Z80 bus cycles; T-states start on rising clock edges
  let t = 0;
  const T = (n: number) => t + n * TZ;
  const zsel = (dir: number, io: boolean): string => {
    if (io) {
      const p = dir & 0xff;
      return p >= 4 && p <= 7 ? 'YMCS' : 'ZLATCH';
    }
    return dir >= 0xf800 ? 'ZRAM' : 'ZROM';
  };
  const m1 = (dir: number, dato: number, extra = 0) => {
    c.marca(t);
    c.set('ZA', T(0), hex(dir, 4));
    c.set('M1', T(0), 0);
    c.set('MREQ', T(0.5), 0);
    c.set('RD', T(0.5), 0);
    c.set('ZROM', T(0.5), 0);
    c.set('ZD', T(1.6), hex(dato, 2));
    c.set('MREQ', T(2), 1);
    c.set('RD', T(2), 1);
    c.set('ZROM', T(2), 1);
    c.set('M1', T(2), 1);
    c.set('ZD', T(2), null);
    c.set('ZA', T(2), 'refresco');
    c.set('MREQ', T(2.5), 0);
    c.set('MREQ', T(3.5), 1);
    c.set('ZA', T(4), null);
    t = T(4 + extra);
  };
  const mem = (dir: number, dato: number, escribe: boolean) => {
    c.marca(t);
    const sel = zsel(dir, false);
    c.set('ZA', T(0), hex(dir, 4));
    c.set('MREQ', T(0.5), 0);
    c.set(sel, T(0.5), 0);
    if (escribe) {
      c.set('ZD', T(0.5), hex(dato, 2));
      c.set('WR', T(1.5), 0);
      c.set('WR', T(2.5), 1);
    } else {
      c.set('RD', T(0.5), 0);
      c.set('ZD', T(1.8), hex(dato, 2));
      c.set('RD', T(2.5), 1);
    }
    c.set('MREQ', T(2.5), 1);
    c.set(sel, T(2.5), 1);
    c.set('ZD', T(2.5), null);
    c.set('ZA', T(3), null);
    t = T(3);
  };
  const io = (puerto: number, a: number, dato: number, escribe: boolean) => {
    c.marca(t);
    const sel = zsel(puerto, true);
    c.set('ZA', T(0), hex((a << 8) | puerto, 4));
    c.set('IORQ', T(1), 0);
    c.set(sel, T(1), 0);
    if (escribe) {
      c.set('ZD', T(0.5), hex(dato, 2));
      c.set('WR', T(1), 0);
      if (sel === 'YMCS') c.set('YMWR', T(1), 0);
      c.set('WR', T(3.5), 1);
      c.set('YMWR', T(3.5), 1);
    } else {
      c.set('RD', T(1), 0);
      c.set('ZD', T(2.8), hex(dato, 2));
      c.set('RD', T(3.5), 1);
    }
    c.set('IORQ', T(3.5), 1);
    c.set(sel, T(3.5), 1);
    c.set('ZD', T(3.5), null);
    c.set('ZA', T(4), null);
    t = T(4);
  };

  // JR $ (12 T) running when the code arrives: M1 + operand read + 5 internal T-states
  const t0 = t;
  m1(0x0120, 0x18);
  mem(0x0121, 0xfe, false);
  t += 5 * TZ;
  c.paso(t0, t, 'El Z80 espera en un bucle (JR $, 12 T). La NMI se atiende al acabar la instrucción en curso.');
  const tNmi = t;
  m1(0x0120, 0x18, 1); // NMI acknowledge: an M1 cycle whose opcode is ignored, 5 T
  mem(0xfffd, 0x01, true); // push PC high
  mem(0xfffc, 0x20, true); // push PC low
  c.paso(tNmi, t, 'Respuesta a la NMI (11 T): un ciclo M1 cuyo código se ignora y dos escrituras en la pila (RAM del Z80, $FFFD y $FFFC) con la dirección de vuelta; salta a $0066.');
  const tIn = t;
  m1(0x0066, 0xdb);
  mem(0x0067, 0x00, false);
  io(0x00, 0x00, 0x07, false);
  c.set('ZNMI', t - 0.5 * TZ, 1);
  c.set('LATCH', t, null);
  c.paso(tIn, t, 'IN A,($00): ciclo de E/S de 4 T (con una espera automática); /IORQ y /RD bajos leen el código $07 del latch.');
  const tYm = t;
  m1(0x0069, 0x3e);
  mem(0x006a, 0x28, false);
  m1(0x006b, 0xd3);
  mem(0x006c, 0x04, false);
  io(0x04, 0x28, 0x28, true);
  m1(0x006d, 0x3e);
  mem(0x006e, 0xf0, false);
  m1(0x006f, 0xd3);
  mem(0x0070, 0x05, false);
  io(0x05, 0xf0, 0xf0, true);
  c.paso(tYm, t, 'OUT ($04),A y OUT ($05),A: escribe el registro $28 del YM2610 (key-on FM). Los puertos $04–$07 bajan 2610 /CS.');
  const tResp = t;
  m1(0x0071, 0xd3);
  mem(0x0072, 0x0c, false);
  io(0x0c, 0x07, 0x07, true);
  c.set('LATCH', t - TZ, 'resp. $07');
  c.paso(tResp, t, 'OUT ($0C),A: deja la respuesta para el 68000.');
  const tLee = t + 0.5e-6;
  const fin68 = ciclo68(tLee, 0x320000, false, '07··');
  c.paso(tLee, tLee + 4 * T12, 'El 68000 lee $320000 y recibe la respuesta: la orden ha llegado.');
  c.marca(tLee);
  const fin = Math.max(fin68 + T12, t) + 0.25e-6;
  c.reloj('ZCLK', 0, fin, TZ);
  c.marca(fin);
  return {
    id: 'z80',
    titulo: '68000 ↔ Z80',
    descripcion: 'El 68000 manda una orden de sonido de un byte; el Z80 la recibe por NMI, programa el YM2610 y contesta.',
    duracion: fin,
    escala: 'µs',
    pistas: c.pistas(),
    pasos: c.pasos,
    marcas: [...new Set(c.marcas)].sort((a, b) => a - b),
    realPorSegundo: TZ / 1.2,
    defecto: ['AS', 'SDZ80', 'ZNMI', 'ZCLK', 'M1', 'MREQ', 'IORQ', 'RD', 'WR', 'ZA', 'ZD', 'YMCS'],
    fidelidad:
      'Exacto: reloj del Z80 de 4 MHz, ciclos M1 de 4 T (con refresco en T3–T4), de memoria de 3 T y de E/S de 4 T con espera automática, respuesta a la NMI de 11 T (manual del Z80), puertos $00, $04–$05 y $0C, ciclo del 68000 de 333 ns. Ilustrativo: el programa (bucle JR $, rutina mínima) y cuándo suelta /NMI el chipset.',
  };
}

// ------------------------------------------------------------------ sprite / fix pipeline of one line

function escenarioLinea(): Escenario {
  const c = new Cronograma();
  const TL = 384 * 4 * T24; // 64 µs
  c.bit('24M', '24 MHz', 1)
    .bit('6MB', 'Reloj de píxel 6MB', 1, '6 MHz (166,7 ns)')
    .bus('X', 'Píxel', 'Contador horizontal (0–383)')
    .bit('BNKB', 'Borrado (BNKB/CHBL)', 1, 'Bajo fuera de los 320 píxeles visibles')
    .bit('SYNC', 'SYNC', 1)
    .bus('P', 'Bus P', 'Direcciones multiplexadas')
    .bit('PCK1', 'PCK1', 0, 'Captura la dirección de las ROM C')
    .bit('PCK2', 'PCK2', 0, 'Captura la dirección de la ROM S')
    .bus('L0', 'ROM L0', 'Consulta de reducción')
    .bit('LOAD', 'LOAD', 0, 'NEO-ZMC2 carga 32 bits (8 píxeles)')
    .bit('CA4', 'CA4', 0, 'Mitad izquierda/derecha del sprite')
    .bus('GAD', 'GAD/GBD', '2 píxeles por ciclo de 12 MHz')
    .bus('FIX', 'FIXD', 'Byte de la ROM S')
    .bus('BUFW', 'Buffer en escritura', 'Sprites de la línea siguiente')
    .bus('BUFR', 'Buffer en lectura', 'Píxel que se muestra')
    .bus('PA', 'PA0–PA11', 'Dirección de paleta')
    .bus('RGB', 'Color (74LS273)', 'Capturado con 6MB')
    .bus('SVRAM', 'VRAM lenta')
    .bus('FVRAM', 'VRAM rápida');
  c.reloj('24M', 0, TL, T24);
  c.reloj('6MB', 0, TL, 4 * T24);
  for (let x = 0; x < 384; x++) {
    const t = x * 4 * T24;
    c.set('X', t, String(x));
    if (x < 320) {
      c.set('BUFR', t, `px ${x}`);
      c.set('PA', t, hex((((x >> 4) * 7) & 0xff) * 16 + (x & 15), 3));
      c.set('RGB', t + 4 * T24, hex(((x * 37) & 0x7fff) | 0x8000, 4));
    } else {
      c.set('BUFR', t, null);
      c.set('PA', t, null);
      c.set('RGB', t + 4 * T24, null);
    }
  }
  c.set('BNKB', 0, 1);
  c.set('BNKB', 320 * 4 * T24, 0);
  c.set('SYNC', 0, 1);
  c.set('SYNC', 340 * 4 * T24, 0);
  c.set('SYNC', 369 * 4 * T24, 1);
  // 48 slots of 32 ticks of 24 MHz (8 screen pixels): two sprites and one fix tile per slot
  for (let k = 0; k < 48; k++) {
    const t0 = k * 32 * T24;
    const s1 = 2 * k;
    const s2 = 2 * k + 1;
    c.set('P', t0, `C: sprite ${s1}`);
    c.set('PCK1', t0 + 6 * T24, 1);
    c.set('PCK1', t0 + 7 * T24, 0);
    c.set('P', t0 + 8 * T24, `S: fix ${k}`);
    c.set('PCK2', t0 + 14 * T24, 1);
    c.set('PCK2', t0 + 15 * T24, 0);
    c.set('P', t0 + 16 * T24, `C: sprite ${s2}`);
    c.set('PCK1', t0 + 22 * T24, 1);
    c.set('PCK1', t0 + 23 * T24, 0);
    c.set('P', t0 + 24 * T24, `L0: sprite ${s2 + 1}`);
    c.set('L0', t0 + 24 * T24, `sprite ${s2 + 1}`);
    c.set('L0', t0 + 32 * T24, null);
    c.set('SVRAM', t0, `SCB1 spr ${s1}`);
    c.set('SVRAM', t0 + 16 * T24, `SCB1 spr ${s2}`);
    c.set('FVRAM', t0 + 8 * T24, `SCB2–4 spr ${s2 + 1}`);
    c.set('FVRAM', t0 + 24 * T24, `lista ${s2 + 2}`);
    c.set('FIX', t0 + 16 * T24, `fix ${k}`);
    c.marca(t0);
    // the serializer: 8 pixels per LOAD, CA4 selects the half of the 16-pixel sprite line
    for (let h = 0; h < 4; h++) {
      const tl = t0 + h * 8 * T24;
      c.set('LOAD', tl, 1);
      c.set('LOAD', tl + T24, 0);
      c.set('CA4', tl, (h & 1) as 0 | 1);
      const spr = h < 2 ? s1 : s2;
      c.set('BUFW', tl, `spr ${spr} (${(h & 1) * 8}–${(h & 1) * 8 + 7})`);
      for (let q = 0; q < 4; q++) c.set('GAD', tl + q * 2 * T24, `px ${(h & 1) * 8 + 2 * q},${(h & 1) * 8 + 2 * q + 1}`);
    }
  }
  c.marca(TL);
  c.paso(0, 32 * T24, 'Ranura de 8 píxeles de pantalla (1,33 µs = 32 ciclos de 24 MHz): dos sprites (PCK1 captura cada dirección de ROM C) y un tile de la capa fija (PCK2).');
  c.paso(32 * T24, 320 * 4 * T24, 'Mientras el buffer de lectura saca un píxel cada 166,7 ns hacia la paleta, el otro se llena con los 96 sprites de la línea siguiente, 2 píxeles por ciclo de 12 MHz.');
  c.paso(320 * 4 * T24, TL, 'Borrado horizontal (64 píxeles) con el pulso de sincronismo: el LSPC sigue llenando el buffer; al acabar la línea los buffers se intercambian.');
  return {
    id: 'linea',
    titulo: 'Línea: sprites y capa fija',
    descripcion: 'Una línea de 64 µs (384 píxeles de 6 MHz): el LSPC prepara la línea siguiente en un buffer mientras el otro se muestra. 96 sprites × 16 píxeles = 1536 = 4 × 384: el buffer se escribe a 24 Mpíxel/s.',
    duracion: TL,
    escala: 'µs',
    pistas: c.pistas(),
    pasos: c.pasos,
    marcas: c.marcas,
    realPorSegundo: (32 * T24) / 4,
    defecto: ['6MB', 'P', 'PCK1', 'PCK2', 'LOAD', 'CA4', 'GAD', 'BUFW', 'BUFR', 'PA', 'BNKB'],
    ventana: [0, 64 * T24],
    fidelidad:
      'Exacto: 384 píxeles de 166,7 ns (64 µs), 320 visibles, 96 sprites de 16 píxeles por línea a 2 píxeles por ciclo de 12 MHz, un tile fijo cada 8 píxeles, doble buffer de línea, color capturado con el reloj de píxel. Esquemático: el reparto del bus P dentro de cada ranura (C, S, C, L0), la posición de los pulsos PCK y de SYNC en la línea, y los valores mostrados.',
  };
}

// ------------------------------------------------------------------ frame and interrupts

function escenarioCuadro(): Escenario {
  const c = new Cronograma();
  const TL = 64e-6;
  const N = 264;
  const fin = N * TL;
  c.bus('LINEA', 'Línea', '0–223 visibles, 224–263 retrazado')
    .bit('VIS', 'Imagen', 1)
    .bit('IPL0', '/IPL0', 1, 'Nivel 1: vblank')
    .bit('IPL1', '/IPL1', 1, 'Nivel 2: temporizador')
    .bit('IPL', 'IRQ pendiente', 1)
    .bus('CPU', '68000');
  for (let l = 0; l < N; l++) c.set('LINEA', l * TL, String(l));
  c.set('VIS', 0, 1);
  c.set('VIS', 224 * TL, 0);
  c.set('CPU', 0, 'juego');
  const tT = 112 * TL + 10e-6;
  c.set('IPL1', tT, 0);
  c.set('IPL', tT, 0);
  c.set('CPU', tT + 3e-6, 'IRQ2: cambia el scroll');
  c.set('IPL1', tT + 8e-6, 1);
  c.set('IPL', tT + 8e-6, 1);
  c.set('CPU', tT + 20e-6, 'juego');
  const tV = 224 * TL;
  c.set('IPL0', tV, 0);
  c.set('IPL', tV, 0);
  c.set('CPU', tV + 3e-6, 'IRQ1: escribe IRQACK');
  c.set('IPL0', tV + 8e-6, 1);
  c.set('IPL', tV + 8e-6, 1);
  c.set('CPU', tV + 10e-6, 'IRQ1: copia sprites a la VRAM');
  c.set('CPU', tV + 1.5e-3, 'juego');
  for (const t of [0, tT, tT + 8e-6, tV, tV + 8e-6, fin]) c.marca(t);
  c.paso(0, tT, 'Líneas visibles: el LSPC dibuja; el juego corre en el 68000.');
  c.paso(tT, tT + 20e-6, 'El temporizador del LSPC (TIMER, programable en ciclos de píxel) baja /IPL1: interrupción de nivel 2, útil para efectos de raster a mitad de pantalla. El 68000 la reconoce escribiendo en IRQACK ($3C000C).');
  c.paso(tT + 20e-6, tV, 'Sigue la imagen.');
  c.paso(tV, tV + 1.5e-3, 'Empieza el retrazado vertical: /IPL0 baja (nivel 1, vblank). La rutina reconoce la IRQ y actualiza la VRAM y la paleta sin interferir con la imagen.');
  c.paso(tV + 1.5e-3, fin, 'Fin del retrazado: 264 líneas, ≈ 59,19 Hz.');
  return {
    id: 'cuadro',
    titulo: 'Cuadro e interrupciones',
    descripcion: 'Un cuadro de 264 líneas de 64 µs (16,9 ms, ≈ 59,19 Hz), 224 visibles. El LSPC genera las dos interrupciones del 68000: vblank (nivel 1) y temporizador (nivel 2).',
    duracion: fin,
    escala: 'ms',
    pistas: c.pistas(),
    pasos: c.pasos,
    marcas: c.marcas,
    realPorSegundo: fin / 20,
    defecto: ['LINEA', 'VIS', 'IPL0', 'IPL1', 'CPU'],
    ventana: [222 * TL, 236 * TL],
    fidelidad:
      'Exacto: 264 líneas de 64 µs, 224 visibles, IRQ1 = vblank por IPL0, IRQ2 = temporizador por IPL1, reconocimiento en IRQACK. Ilustrativo: la línea elegida para el temporizador, la numeración de líneas (empieza en la primera visible) y la duración de las rutinas.',
  };
}

// ------------------------------------------------------------------ clocks

function escenarioRelojes(): Escenario {
  const c = new Cronograma();
  const fin = 24 * T24;
  c.bit('24M', '24M', 1, 'Maestro, 24 MHz')
    .bit('CLK68', '68KCLK', 1, '÷ 2 → 12 MHz (68000)')
    .bit('8M', '8M', 1, '÷ 3 → 8 MHz (YM2610)')
    .bit('6MB', '6MB', 1, '÷ 4 → 6 MHz (píxel)')
    .bit('4M', '4M', 1, '÷ 6 → 4 MHz (Z80)');
  c.reloj('24M', 0, fin, T24);
  c.reloj('CLK68', 0, fin, 2 * T24);
  c.reloj('8M', 0, fin, 3 * T24);
  c.reloj('6MB', 0, fin, 4 * T24);
  c.reloj('4M', 0, fin, 6 * T24);
  for (let k = 0; k <= 24; k++) c.marca(k * T24);
  c.paso(0, fin, 'Todo sale del mismo cristal: 1 µs contiene 24 ciclos maestros, 12 del 68000, 8 del YM2610, 6 píxeles y 4 ciclos del Z80.');
  return {
    id: 'relojes',
    titulo: 'Relojes',
    descripcion: '24 MHz divididos entre 2 (68000), 3 (YM2610), 4 (píxel) y 6 (Z80). El 68000 lo toma de NEO-D0/la lógica de reloj; 8M y 4M los da el LSPC.',
    duracion: fin,
    escala: 'ns',
    pistas: c.pistas(),
    pasos: c.pasos,
    marcas: c.marcas,
    realPorSegundo: fin / 8,
    defecto: ['24M', 'CLK68', '8M', '6MB', '4M'],
    fidelidad: 'Exacto: frecuencias y relaciones. Ilustrativo: la fase relativa y el ciclo de trabajo de 8M y 4M (dibujados al 50 %).',
  };
}

export const NEOGEO: Maquina = {
  id: 'neogeo',
  diagrama,
  digitos: 6,
  decodificar,
  escenarios: [
    { id: 'bus', titulo: 'Ciclos del 68000', crear: (op) => ciclos68k('bus', 'Ciclos de bus del 68000', 'Siete accesos típicos: ROM P, RAM, registros del LSPC, código de sonido, paleta y BIOS. Cada uno dura 4 ciclos de 12 MHz (333 ns) si /DTACK llega a tiempo.', programa68(op)) },
    { id: 'decodificar', titulo: 'Decodificar una dirección', crear: escenarioDecodificar },
    { id: 'z80', titulo: '68000 ↔ Z80', crear: escenarioZ80 },
    { id: 'linea', titulo: 'Línea de sprites', crear: escenarioLinea },
    { id: 'cuadro', titulo: 'Cuadro e IRQ', crear: escenarioCuadro },
    { id: 'relojes', titulo: 'Relojes', crear: escenarioRelojes },
  ],
  ejemplos: [
    { dir: 0x000100, escritura: false, texto: 'ROM P' },
    { dir: 0x10fd80, escritura: true, texto: 'RAM' },
    { dir: 0x1ff000, escritura: false, texto: 'espejo de la RAM' },
    { dir: 0x320000, escritura: true, texto: 'código de sonido' },
    { dir: 0x3c0002, escritura: true, texto: 'VRAMRW' },
    { dir: 0x401ffe, escritura: true, texto: 'paleta' },
    { dir: 0x800001, escritura: false, texto: 'tarjeta' },
    { dir: 0xc00402, escritura: false, texto: 'BIOS' },
  ],
  opciones: [
    { id: 'esperas', titulo: 'Esperas de la ROM P', escenarios: ['bus', 'decodificar'],
      valores: [{ v: '0', texto: 'Ninguna' }, { v: '1', texto: '1 ciclo' }, { v: '2', texto: '2 ciclos' }] },
  ],
};

