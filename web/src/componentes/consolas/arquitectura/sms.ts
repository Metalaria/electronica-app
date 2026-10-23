// Master System II (PAL board 171-5922A): block diagram, Z80 memory and I/O decoding, and the timed scenarios.
//
// Timing figures:
//   - clocks (SMS Power «ClockRate»; manual sheet 2): oscillator 53.203424 MHz (PAL) / 53.693175 MHz (NTSC); the
//     315-5237 divides by 5 for the VDP (10.64 MHz, net «10.7M») and by 12 for the colour subcarrier SC
//     (4.4336 MHz); the VDP divides by 3 for the Z80 (CLOCK pin 33 → «3.58M»: 3.546895 MHz PAL).
//   - Z80 cycles: Zilog UM0080 (see z80.ts); I/O cycles have one automatic wait state.
//   - video: 342 pixels per line = 228 Z80 cycles; 313 lines PAL (262 NTSC); 192 active lines; frame interrupt
//     when the V counter reaches $C1 (line 193); line interrupt when the line counter (reloaded from register
//     10 outside the active area) underflows; /INT stays low until the Z80 reads the control port $BF
//     (SMS Power «VDP» documentation).
//   - memory: port $3E enables BIOS (bit 3 = 0), RAM (bit 4), cartridge (bit 6), card (bit 5), expansion (bit 7),
//     I/O (bit 2); Sega mapper registers $FFFC–$FFFF (SMS Power «MemoryMap», «Mappers»).
//   - I/O ports: only A7, A6 and A0 are decoded: $3E/$3F (315-5237), $7E/$7F V/H counters and PSG, $BE/$BF VDP,
//     $DC/$DD controllers (SMS Power «Port mapping»).
//   - device delays: 4168/LC3664 RAM 120–150 ns, mask ROM ≈ 200 ns: illustrative where stated.

import { Cronograma, hex, type Escenario } from './modelo';
import type { Decodificacion, Diagrama, Maquina, Opciones } from './diagrama';
import { cicloZ80, senalesZ80, type CicloZ80 } from './z80';

const OSC = 53.203424e6;
const TV = 5 / OSC; // VDP clock period (10.64 MHz)
const T = 15 / OSC; // Z80 T state (3.546895 MHz, 281.9 ns)
const TL = 228 * T; // one line (64.28 µs)
const T_NTSC = 15 / 53.693175e6;

// ------------------------------------------------------------------ diagram

const diagrama: Diagrama = {
  ancho: 1000,
  alto: 560,
  bloques: [
    { id: 'osc', x: 225, y: 16, w: 170, h: 56, titulo: 'Oscilador', sub: '53,203424 MHz', foto: 'osc', esquema: ['OSC1'],
      actividad: [{ pista: 'OSC', nivel: 1 }],
      info: 'Oscilador de 4 patas: 12 veces la subportadora PAL (4,43361875 MHz). En NTSC, 53,693175 MHz (15 × 3,579545 MHz).' },
    { id: 'z80', x: 20, y: 100, w: 175, h: 128, titulo: 'CPU Z80A', sub: 'IC1 · 3,546895 MHz', foto: 'z80', esquema: ['IC1'],
      actividad: [{ pista: 'A' }],
      info: 'Ejecuta el código de la ROM de arranque o del cartucho. Ve el VDP, el PSG y los mandos como puertos de E/S (IN/OUT), y recibe /INT del VDP (modo IM 1, salta a $0038) y /NMI con el botón de pausa ($0066).' },
    { id: 'io', x: 225, y: 100, w: 170, h: 128, titulo: '315-5237', sub: 'IC4 · selecciones, mandos, relojes', foto: 'io', esquema: ['IC4'],
      actividad: [{ pista: 'CE0' }, { pista: 'CE1' }, { pista: 'CE3' }, { pista: 'IOSEL', nivel: 1 }],
      info: 'Divide el oscilador (10,64 MHz al VDP y la subportadora SC), guarda el puerto $3E y con él convierte /MREQ y las líneas de dirección en /CE0 (BIOS), /CE1 (RAM, a partir de /CSRAM del VDP) y /CE3 (cartucho). También lee los mandos ($DC/$DD) y lleva el reset.' },
    { id: 'vdp', x: 470, y: 100, w: 190, h: 140, titulo: 'VDP 315-5246', sub: 'IC5 · vídeo + PSG SN76489', foto: 'vdp', esquema: ['IC5'],
      actividad: [{ pista: 'VDPSEL', nivel: 1 }, { pista: 'VCE' }, { pista: 'INT' }],
      info: 'Decodifica sus puertos con A0, A6, A7 e /IOREQ: $7E/$7F (contadores V y H al leer, PSG al escribir) y $BE/$BF (datos y control). Saca CLOCK para el Z80 (÷ 3), /CSRAM para $C000–$FFFF, /INT y /NMI, y gobierna los 16 KB de VRAM por un bus AD multiplexado.' },
    { id: 'vram', x: 760, y: 100, w: 210, h: 80, titulo: 'VRAM 16 KB', sub: 'IC6, IC7 · 2 × 4168 (PSRAM 8K × 8)', foto: 'vram1', esquema: ['IC6', 'IC7'],
      actividad: [{ pista: 'VCE' }],
      info: 'Dos PSRAM que retienen la dirección al bajar /CE: por eso AD0–AD12 lleva primero la dirección y después el dato. IC6 guarda los bytes pares (AD0–AD7, /WE0) e IC7 los impares (AD8–AD15, /WE1): el VDP lee 16 bits a la vez.' },
    { id: 'bios', x: 20, y: 350, w: 135, h: 72, titulo: 'ROM de arranque', sub: 'IC2 · 128 KB + paginador', foto: 'bios', esquema: ['IC2'],
      actividad: [{ pista: 'CE0' }],
      info: 'MPR-12808: el arranque de Sega y un juego integrado, con su propio paginador ($FFFC–$FFFF). Responde con /CE0 mientras el bit 3 de $3E está a 0.' },
    { id: 'ram', x: 170, y: 350, w: 135, h: 72, titulo: 'RAM 8 KB', sub: 'IC3 · $C000–$DFFF', foto: 'ram', esquema: ['IC3'],
      actividad: [{ pista: 'CE1' }],
      info: 'Espejada en $E000–$FFFF porque no se decodifica A13. Las escrituras en $FFFC–$FFFF llegan a la vez a la RAM y a los registros del paginador del cartucho.' },
    { id: 'cart', x: 320, y: 350, w: 160, h: 72, titulo: 'Cartucho', sub: 'CN1 · ROM + paginador Sega', foto: 'cart', esquema: ['CN1'], externo: true,
      actividad: [{ pista: 'CE3' }],
      info: 'Recibe el bus completo. Su paginador divide $0000–$BFFF en tres ventanas de 16 KB (bancos en $FFFD, $FFFE y $FFFF; el primer KB es fijo) y saca las líneas altas de la ROM.' },
    { id: 'mandos', x: 225, y: 470, w: 170, h: 62, titulo: 'Mandos', sub: 'CN2, CN3 · puertos $DC/$DD', foto: 'pad1', esquema: ['CN2', 'CN3'],
      actividad: [{ pista: 'IOSEL', nivel: 1 }],
      info: 'Siete líneas por mando (arriba, abajo, izquierda, derecha, TL, TR, TH) con filtros EMI. El 315-5237 las pone en el bus de datos al leer $DC o $DD; TH y TR también pueden ser salidas (puerto $3F).' },
    { id: 'av', x: 760, y: 300, w: 210, h: 78, titulo: 'Vídeo y RF', sub: 'IC9 CXA1145 · modulador', foto: 'enc', esquema: ['IC9', 'RF1'],
      info: 'El VDP saca R, G y B analógicos (2 bits por canal), /SYNC y el audio del PSG. El CXA1145 los convierte en vídeo compuesto PAL con la subportadora SC, y el modulador en una señal de antena.' },
    { id: 'pausa', x: 520, y: 470, w: 140, h: 62, titulo: 'Botón de pausa', sub: '/NMI-IN → /NMI', foto: 'pausa', esquema: ['SW2'],
      actividad: [{ pista: 'NMI' }],
      info: 'Lleva /NMI-IN del VDP a masa; el VDP genera un flanco en /NMI y el Z80 salta a $0066.' },
    { id: 'alim', x: 20, y: 470, w: 175, h: 62, titulo: 'Alimentación', sub: 'CN4, SW1 · IC8 7805', foto: 'reg', esquema: ['IC8', 'CN4', 'SW1'],
      info: 'La fuente externa (9 V de continua) entra por CN4 y el interruptor SW1; el regulador 7805 (IC8) da los +5 V de toda la placa.' },
  ],
  conexiones: [
    { id: 'osc-io', puntos: [[310, 72], [310, 100]], bits: 1, etiqueta: '53M', pos: [338, 86], clase: 'reloj', pista: 'OSC', nivel: 1, red: '53M' },
    { id: 'io-vdp-clk', puntos: [[395, 120], [470, 120]], bits: 1, etiqueta: '10,7M', pos: [432, 112], clase: 'reloj', pista: 'CLKV', nivel: 1, red: '10.7M' },
    { id: 'vdp-z80-clk', puntos: [[565, 100], [565, 86], [108, 86], [108, 100]], bits: 1, etiqueta: 'CLOCK 3,55 MHz', pos: [205, 80], clase: 'reloj', pista: 'CLK', nivel: 1, red: '3.58M' },
    { id: 'int', puntos: [[470, 205], [430, 205], [430, 245], [195, 245], [195, 215]], bits: 1, etiqueta: '/INT', pos: [300, 239], clase: 'interrupcion', pista: 'INT', nivel: 0, red: '~{INT}' },
    { id: 'nmi', puntos: [[590, 470], [590, 440], [440, 440], [440, 255], [150, 255], [150, 228]], bits: 1, etiqueta: '/NMI', pos: [500, 434], clase: 'interrupcion', pista: 'NMI', nivel: 0, red: '~{NMI}' },
    { id: 'bus-a', puntos: [[20, 290], [700, 290]], bits: 16, etiqueta: 'A0–A15', pos: [600, 284], clase: 'bus', pista: 'A', valor: true, red: 'A0' },
    { id: 'bus-d', puntos: [[20, 315], [700, 315]], bits: 8, etiqueta: 'D0–D7', pos: [640, 309], clase: 'dato', pista: 'D', valor: true, red: 'D0' },
    { id: 'z80-a', puntos: [[50, 228], [50, 290]], bits: 16, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'z80-d', puntos: [[80, 228], [80, 315]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'ctl', puntos: [[195, 140], [225, 140]], bits: 4, etiqueta: '', clase: 'control', pista: 'MREQ', nivel: 0, red: '~{MREQ}' },
    { id: 'iorq', puntos: [[195, 160], [210, 160], [210, 60], [450, 60], [450, 160], [470, 160]], bits: 1, etiqueta: '/IOREQ', pos: [440, 52], clase: 'control', pista: 'IORQ', nivel: 0, red: '~{IOREQ}' },
    { id: 'a-io', puntos: [[300, 290], [300, 228]], bits: 3, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'a-vdp', puntos: [[500, 290], [500, 240]], bits: 5, etiqueta: 'A0, A6, A7, A14, A15', pos: [560, 262], clase: 'bus', pista: 'A' },
    { id: 'd-vdp', puntos: [[620, 315], [620, 240]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'd-io', puntos: [[360, 315], [360, 228]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'csram', puntos: [[470, 225], [395, 225]], bits: 1, etiqueta: '/CSRAM', pos: [432, 218], clase: 'seleccion', pista: 'CSRAM', nivel: 0, red: '~{CSRAM}' },
    { id: 'ce0', puntos: [[240, 228], [240, 330], [88, 330], [88, 350]], bits: 1, etiqueta: '/CE0', pos: [160, 324], clase: 'seleccion', pista: 'CE0', nivel: 0, red: '~{CE0}' },
    { id: 'ce1', puntos: [[260, 228], [260, 338], [238, 338], [238, 350]], bits: 1, etiqueta: '/CE1', pos: [235, 344], clase: 'seleccion', pista: 'CE1', nivel: 0, red: '~{CE1}' },
    { id: 'ce3', puntos: [[380, 228], [380, 350]], bits: 1, etiqueta: '/CE3', pos: [405, 340], clase: 'seleccion', pista: 'CE3', nivel: 0, red: '~{CE3}' },
    { id: 'mem-a', puntos: [[60, 290], [60, 350]], bits: 15, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'mem-d', puntos: [[130, 315], [130, 350]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'ram-a', puntos: [[200, 290], [200, 350]], bits: 13, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'ram-d', puntos: [[285, 315], [285, 350]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'cart-a', puntos: [[340, 290], [340, 350]], bits: 16, etiqueta: '', clase: 'bus', pista: 'A' },
    { id: 'cart-d', puntos: [[460, 315], [460, 350]], bits: 8, etiqueta: '', clase: 'dato', pista: 'D' },
    { id: 'mandos', puntos: [[310, 470], [310, 228]], bits: 14, etiqueta: '1UP…2TH', pos: [300, 455], clase: 'control', pista: 'IOSEL', nivel: 1, red: '1UP' },
    { id: 'ad', puntos: [[660, 135], [760, 135]], bits: 16, etiqueta: 'AD0–AD15', pos: [710, 128], clase: 'dato', pista: 'AD', valor: true, red: 'AD0' },
    { id: 'vce', puntos: [[660, 160], [760, 160]], bits: 1, etiqueta: '/CE, /OE, /WE', pos: [710, 172], clase: 'seleccion', pista: 'VCE', nivel: 0, red: 'VRAM-~{CE}' },
    { id: 'rgb', puntos: [[660, 220], [720, 220], [720, 330], [760, 330]], bits: 5, etiqueta: 'R, G, B, /SYNC, AUDIO', pos: [705, 345], clase: 'control', red: 'R' },
    { id: 'sc', puntos: [[395, 200], [445, 200], [445, 395], [865, 395], [865, 378]], bits: 1, etiqueta: 'SC 4,43 MHz', pos: [640, 389], clase: 'reloj', red: 'SC' },
  ],
};

// ------------------------------------------------------------------ decoding

export function decodificar(dir: number, escritura: boolean, espacio?: string): Decodificacion {
  if (espacio === 'io') return decodificarES(dir & 0xff, escritura);
  const a = dir & 0xffff;
  const base = { direccion: a, escritura };
  const ram = a >= 0xc000;
  const tabla = [
    { etiqueta: 'VDP: /CSRAM = /MREQ · A15 · A14', valor: ram ? 'baja' : 'alta', activa: ram },
    { etiqueta: '315-5237: /CE1 = /CSRAM con $3E bit 4 = 0 (RAM)', valor: ram ? 'baja' : 'alta', activa: ram },
    { etiqueta: '315-5237: /CE3 = $0000–$BFFF con $3E bit 6 = 0 (cartucho)', valor: !ram ? 'baja' : 'alta', activa: !ram },
    { etiqueta: '315-5237: /CE0 = $0000–$BFFF con $3E bit 3 = 0 (BIOS)', valor: 'alta (BIOS apagada)', activa: false },
  ];
  if (ram) {
    const espejo = 0xc000 | (a & 0x1fff);
    let texto = `A15 = A14 = 1: el VDP baja /CSRAM y el 315-5237, con la RAM activa en $3E, baja /CE1. La RAM no ve A13, así que ${hex(a, 4)} es la celda ${hex(espejo, 4)}.`;
    if (a >= 0xfffc && escritura) {
      const reg = ['control ($FFFC)', 'banco de la ventana 0 ($FFFD)', 'banco de la ventana 1 ($FFFE)', 'banco de la ventana 2 ($FFFF)'][a - 0xfffc];
      texto += ` Además, el paginador del cartucho (o el de la ROM de arranque) captura el dato como registro de ${reg}.`;
    }
    return { ...base, tabla, zona: a < 0xe000 ? 'RAM de trabajo ($C000–$DFFF)' : 'Espejo de la RAM ($E000–$FFFF)', seleccion: '/CE1', bloque: 'ram', espejo: hex(espejo, 4), texto };
  }
  const ventana = a < 0x400 ? 'los 1 KB fijos (siempre el banco 0)' : a < 0x4000 ? 'la ventana 0 (banco de $FFFD)' : a < 0x8000 ? 'la ventana 1 (banco de $FFFE)' : 'la ventana 2 (banco de $FFFF)';
  return {
    ...base,
    tabla,
    zona: a < 0x4000 ? 'Cartucho, ventana 0 ($0000–$3FFF)' : a < 0x8000 ? 'Cartucho, ventana 1 ($4000–$7FFF)' : 'Cartucho, ventana 2 ($8000–$BFFF)',
    seleccion: '/CE3',
    bloque: 'cart',
    texto: `Con el cartucho activo (bit 6 de $3E a 0, lo normal tras el arranque), el 315-5237 baja /CE3. ${hex(a, 4)} cae en ${ventana}: el paginador del cartucho pone en su ROM las líneas altas del banco elegido y A0–A13 del Z80. Durante el arranque es la ROM de arranque (/CE0) la que responde a estas direcciones.`,
  };
}

function decodificarES(p: number, escritura: boolean): Decodificacion {
  const a7 = (p >> 7) & 1;
  const a6 = (p >> 6) & 1;
  const a0 = p & 1;
  const tabla = [
    { etiqueta: 'A7 A6 = 00 → 315-5237 ($3E/$3F)', valor: !a7 && !a6 ? 'sí' : 'no', activa: !a7 && !a6 },
    { etiqueta: 'A7 A6 = 01 → VDP: contadores / PSG', valor: !a7 && a6 ? 'sí' : 'no', activa: !a7 && a6 === 1 },
    { etiqueta: 'A7 A6 = 10 → VDP: datos / control', valor: a7 && !a6 ? 'sí' : 'no', activa: a7 === 1 && !a6 },
    { etiqueta: 'A7 A6 = 11 → 315-5237: mandos', valor: a7 && a6 ? 'sí' : 'no', activa: a7 === 1 && a6 === 1 },
    { etiqueta: 'A0 (par / impar)', valor: String(a0), activa: false },
  ];
  const base = { direccion: p, escritura, tabla };
  if (!a7 && !a6) {
    const canon = a0 ? 0x3f : 0x3e;
    return { ...base, zona: 'Control de memoria y de E/S ($00–$3F)', seleccion: escritura ? 'IOSEL' : null, bloque: 'io', espejo: hex(canon, 2),
      texto: escritura ? (a0 ? `Escritura en ${hex(canon, 2)}: control de E/S del 315-5237 (dirección y nivel de TH y TR de los dos mandos; con ellos se detecta la región).` : `Escritura en ${hex(canon, 2)}: control de memoria del 315-5237. Cada bit a 0 activa una selección: bit 3 BIOS (/CE0), bit 4 RAM (/CE1), bit 6 cartucho (/CE3), bit 5 tarjeta, bit 7 expansión, bit 2 los mandos.`) : 'Las lecturas de $00–$3F no seleccionan nada útil en el SMS II.' };
  }
  if (!a7 && a6) {
    const canon = a0 ? 0x7f : 0x7e;
    return { ...base, zona: 'Contadores V/H y PSG ($40–$7F)', seleccion: 'VDP', bloque: 'vdp', espejo: hex(canon, 2),
      texto: escritura ? `Escritura: el byte va al generador de sonido SN76489 que hay dentro del VDP (los dos puertos son el mismo).` : `Lectura de ${hex(canon, 2)}: el VDP devuelve el contador ${a0 ? 'horizontal (H, retenido al cambiar TH)' : 'vertical (V, la línea actual)'}.` };
  }
  if (a7 && !a6) {
    const canon = a0 ? 0xbf : 0xbe;
    return { ...base, zona: 'VDP ($80–$BF)', seleccion: 'VDP', bloque: 'vdp', espejo: hex(canon, 2),
      texto: a0 ? (escritura ? 'Puerto de control $BF: dos escrituras forman una dirección de VRAM o CRAM de 14 bits con su orden (leer, escribir VRAM, registro, escribir CRAM).' : 'Lectura de $BF: estado del VDP (bit 7 = interrupción de cuadro, bit 6 = más de 8 sprites, bit 5 = colisión). Leerlo suelta /INT.') : (escritura ? 'Puerto de datos $BE: el byte se escribe en la VRAM (o la CRAM) en la dirección actual, que avanza sola.' : 'Puerto de datos $BE: devuelve el byte leído por adelantado de la VRAM y pide el siguiente.') };
  }
  const canon = a0 ? 0xdd : 0xdc;
  return { ...base, zona: 'Mandos ($C0–$FF)', seleccion: escritura ? null : 'IOSEL', bloque: 'mandos', espejo: hex(canon, 2),
    texto: escritura ? 'Las escrituras en $C0–$FF no tienen efecto.' : a0 ? 'Lectura de $DD: las líneas restantes del mando 2 (izquierda, derecha, TL, TR), TH de los dos mandos y el botón de reset (solo en el SMS1).' : 'Lectura de $DC: mando 1 (arriba, abajo, izquierda, derecha, TL, TR) y arriba y abajo del mando 2. Un 0 es una tecla pulsada.' };
}

// ------------------------------------------------------------------ CPU bus cycles

interface Acceso extends CicloZ80 {
  sel?: 'cart' | 'ram' | 'bios' | 'vdp' | 'io';
}

function seleccionDe(x: CicloZ80): Acceso['sel'] | undefined {
  if (x.tipo === 'IOR' || x.tipo === 'IOW') {
    const p = x.dir & 0xff;
    if (p & 0x80) return p & 0x40 ? 'io' : 'vdp';
    return p & 0x40 ? 'vdp' : 'io';
  }
  return x.dir >= 0xc000 ? 'ram' : 'cart';
}

function ciclos(id: string, titulo: string, descripcion: string, lista: CicloZ80[]): Escenario {
  const c = new Cronograma();
  c.bit('OSC', 'Oscilador 53,2 MHz', 1);
  senalesZ80(c, '3,55 MHz');
  c.bit('CSRAM', '/CSRAM', 1, 'VDP: $C000–$FFFF')
    .bit('CE0', '/CE0', 1, 'ROM de arranque')
    .bit('CE1', '/CE1', 1, 'RAM')
    .bit('CE3', '/CE3', 1, 'Cartucho')
    .bit('VDPSEL', 'VDP (puerto)', 0, 'Acceso del Z80 a un puerto del VDP')
    .bit('IOSEL', '315-5237 (puerto)', 0, '$3E/$3F o mandos')
    .bit('INT', '/INT', 1)
    .bit('NMI', '/NMI', 1)
    .bit('VCE', 'VRAM /CE', 1)
    .bus('AD', 'AD15–AD0')
    .bit('CLKV', 'Reloj del VDP 10,64 MHz', 1)
    .bus('SEL', 'Selección');
  let t = 0;
  let r = 0x10;
  for (const x of lista) {
    const sel = seleccionDe(x);
    const acc = sel === 'ram' ? 150e-9 : sel === 'vdp' ? 80e-9 : sel === 'io' ? 60e-9 : 200e-9;
    const { ini, fin, total } = cicloZ80(c, t, T, { ...x, acceso: acc }, r++);
    const finSel = x.tipo === 'M1' ? fin : fin;
    if (sel === 'ram') {
      c.set('CSRAM', ini + 25e-9, 0);
      c.set('CSRAM', finSel + 20e-9, 1);
      c.set('CE1', ini + 45e-9, 0);
      c.set('CE1', finSel + 40e-9, 1);
      c.set('SEL', ini, 'RAM');
    } else if (sel === 'cart') {
      c.set('CE3', ini + 30e-9, 0);
      c.set('CE3', finSel + 30e-9, 1);
      c.set('SEL', ini, 'Cartucho');
    } else if (sel === 'vdp') {
      c.set('VDPSEL', ini + 20e-9, 1);
      c.set('VDPSEL', fin + 20e-9, 0);
      c.set('SEL', ini, 'VDP');
    } else if (sel === 'io') {
      c.set('IOSEL', ini + 30e-9, 1);
      c.set('IOSEL', fin + 30e-9, 0);
      c.set('SEL', ini, '315-5237');
    }
    c.set('SEL', fin + 40e-9, null);
    const tipo = { M1: 'búsqueda de código', MR: 'lectura', MW: 'escritura', IOR: 'IN', IOW: 'OUT' }[x.tipo];
    c.paso(t, total, `${tipo} ${x.tipo === 'IOR' || x.tipo === 'IOW' ? `del puerto ${hex(x.dir & 0xff, 2)}` : `en ${hex(x.dir, 4)}`}: ${x.nota}`);
    t = total;
  }
  c.reloj('CLK', 0, t, T, 0.5);
  c.reloj('OSC', 0, t, 1 / OSC, 0.5);
  c.reloj('CLKV', 0, t, TV, 0.5);
  c.marca(t);
  return {
    id, titulo, descripcion, duracion: t, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas,
    realPorSegundo: (4 * T) / 2.5,
    defecto: ['CLK', 'A', 'D', 'M1', 'MREQ', 'IORQ', 'RD', 'WR', 'CE3', 'CE1', 'VDPSEL', 'IOSEL'],
    fidelidad:
      'Exacto: periodo del Z80 en PAL (281,9 ns = 15 periodos del oscilador), duración de cada ciclo (búsqueda 4 T con refresco, memoria 3 T, E/S 4 T con su espera automática) y flancos de /MREQ, /IORQ, /RD, /WR, /M1 y /RFSH según el manual de Zilog. Ilustrativo: los retardos de /CSRAM y /CE0–/CE3 (20–45 ns, no publicados) y los tiempos de acceso (ROM 200 ns, RAM 150 ns).',
  };
}

const PROGRAMA: CicloZ80[] = [
  { tipo: 'M1', dir: 0x0200, dato: 0xdb, nota: 'IN A,($DC): código de operación' },
  { tipo: 'MR', dir: 0x0201, dato: 0xdc, nota: 'número de puerto' },
  { tipo: 'IOR', dir: 0xdcdc, dato: 0xef, nota: 'el 315-5237 pone el mando 1 en el bus (bit 4 = 0: botón 1 pulsado)' },
  { tipo: 'M1', dir: 0x0202, dato: 0x32, nota: 'LD ($C010),A' },
  { tipo: 'MR', dir: 0x0203, dato: 0x10, nota: 'byte bajo' },
  { tipo: 'MR', dir: 0x0204, dato: 0xc0, nota: 'byte alto' },
  { tipo: 'MW', dir: 0xc010, dato: 0xef, nota: 'escritura en la RAM: /CSRAM del VDP y /CE1 del 315-5237' },
  { tipo: 'M1', dir: 0x0205, dato: 0xd3, nota: 'OUT ($BE),A' },
  { tipo: 'MR', dir: 0x0206, dato: 0xbe, nota: 'número de puerto' },
  { tipo: 'IOW', dir: 0xefbe, dato: 0xef, nota: 'el VDP recibe un byte para la VRAM por su puerto de datos' },
];

function escenarioDecodificar(op: Opciones): Escenario {
  const io = op.espacio === 'io';
  const dir = Math.max(0, Math.min(io ? 0xff : 0xffff, parseInt(op.dir ?? '0', 16) || 0));
  const w = op.escritura === '1';
  const d = decodificar(dir, w, io ? 'io' : 'mem');
  let lista: CicloZ80[];
  if (io) {
    lista = [
      { tipo: 'M1', dir: 0x0300, dato: w ? 0xd3 : 0xdb, nota: w ? 'OUT (n),A' : 'IN A,(n)' },
      { tipo: 'MR', dir: 0x0301, dato: dir, nota: 'número de puerto' },
      { tipo: w ? 'IOW' : 'IOR', dir: (0x5a << 8) | dir, dato: 0x5a, nota: d.zona },
    ];
  } else {
    lista = [
      { tipo: 'M1', dir: 0x0300, dato: w ? 0x32 : 0x3a, nota: w ? 'LD (nn),A' : 'LD A,(nn)' },
      { tipo: 'MR', dir: 0x0301, dato: dir & 0xff, nota: 'byte bajo de la dirección' },
      { tipo: 'MR', dir: 0x0302, dato: dir >> 8, nota: 'byte alto' },
      { tipo: w ? 'MW' : 'MR', dir, dato: 0x5a, nota: d.zona },
    ];
  }
  return ciclos('decodificar', `Acceso a ${io ? 'puerto ' + hex(dir, 2) : hex(dir, 4)}`, `Instrucción ${io ? (w ? 'OUT' : 'IN') : 'LD'} ejecutada desde el cartucho y el acceso a la dirección elegida, con su decodificación.`, lista);
}

// ------------------------------------------------------------------ paging (Sega mapper)

function escenarioPaginador(op: Opciones): Escenario {
  const banco = Number(op.banco ?? '5') & 0x3f;
  const lista: CicloZ80[] = [
    { tipo: 'M1', dir: 0x0400, dato: 0x3e, nota: `LD A,${banco}` },
    { tipo: 'MR', dir: 0x0401, dato: banco, nota: 'número de banco' },
    { tipo: 'M1', dir: 0x0402, dato: 0x32, nota: 'LD ($FFFF),A' },
    { tipo: 'MR', dir: 0x0403, dato: 0xff, nota: 'byte bajo' },
    { tipo: 'MR', dir: 0x0404, dato: 0xff, nota: 'byte alto' },
    { tipo: 'MW', dir: 0xffff, dato: banco, nota: 'el paginador guarda el banco de la ventana 2; la RAM recibe el mismo byte en $DFFF' },
    { tipo: 'M1', dir: 0x0405, dato: 0x3a, nota: 'LD A,($8123)' },
    { tipo: 'MR', dir: 0x0406, dato: 0x23, nota: 'byte bajo' },
    { tipo: 'MR', dir: 0x0407, dato: 0x81, nota: 'byte alto' },
    { tipo: 'MR', dir: 0x8123, dato: 0x77, nota: `lectura en la ventana 2: la ROM ve la dirección ${hex(banco * 0x4000 + 0x0123, 6)}` },
  ];
  const e = ciclos('paginador', 'Paginador de Sega', `Cambio de banco en $FFFF y lectura en la ventana 2 ($8000–$BFFF). Con el banco ${banco}, la dirección $8123 del Z80 es el byte ${hex(banco * 0x4000 + 0x0123, 6)} de la ROM del cartucho (16 KB × banco + A0–A13).`, lista);
  // the mapper's ROM address lines (inside the cartridge)
  const c = new Cronograma();
  c.bus('BANCO2', 'Banco de la ventana 2').bus('ROMA', 'Dirección en la ROM');
  let t = 0;
  for (const x of lista) {
    const n = x.tipo === 'M1' ? 4 : 3;
    if (x.tipo === 'MR' && x.dir >= 0x8000 && x.dir < 0xc000) c.set('ROMA', t + 0.5 * T, hex(banco * 0x4000 + (x.dir & 0x3fff), 6));
    else if (x.dir < 0x8000) c.set('ROMA', t + 0.5 * T, hex(x.dir, 6));
    else c.set('ROMA', t, null);
    if (x.tipo === 'MW' && x.dir === 0xffff) c.set('BANCO2', t + 2.5 * T, String(banco));
    t += n * T;
  }
  c.set('BANCO2', 0, '2');
  e.pistas.push(...c.pistas());
  e.defecto = ['CLK', 'A', 'D', 'MREQ', 'RD', 'WR', 'CE3', 'CE1', 'BANCO2', 'ROMA'];
  e.fidelidad += ' El paginador está en el cartucho: «Banco de la ventana 2» y «Dirección en la ROM» son sus registros y sus líneas internas (16 KB por banco, SMS Power «Mappers»).';
  return e;
}

// ------------------------------------------------------------------ VRAM write through the data port

function escenarioVRAM(): Escenario {
  const c = new Cronograma();
  senalesZ80(c, '3,55 MHz');
  c.bit('VDPSEL', 'VDP (puerto)', 0)
    .bit('CLKV', 'Reloj del VDP 10,64 MHz', 1)
    .bus('AD', 'AD15–AD0', 'Bus multiplexado de la VRAM: dirección y después dato')
    .bit('VCE', 'VRAM /CE', 1, 'Al bajar, las 4168 retienen la dirección')
    .bit('VOE', 'VRAM /OE', 1)
    .bit('WE0', '/WE0 (IC6, pares)', 1)
    .bit('WE1', '/WE1 (IC7, impares)', 1)
    .bus('VADDR', 'Dirección de VRAM (VDP)');
  const lista: CicloZ80[] = [
    { tipo: 'M1', dir: 0x0500, dato: 0xd3, nota: 'OUT ($BE),A con A = $3C' },
    { tipo: 'MR', dir: 0x0501, dato: 0xbe, nota: 'número de puerto' },
    { tipo: 'IOW', dir: 0x3cbe, dato: 0x3c, nota: 'el VDP guarda el byte en su búfer y lo escribirá en la VRAM en el siguiente hueco de acceso' },
  ];
  let t = 0;
  let r = 0x20;
  for (const x of lista) {
    const { ini, fin, total } = cicloZ80(c, t, T, { ...x, acceso: 80e-9 }, r++);
    if (x.tipo === 'IOW') {
      c.set('VDPSEL', ini + 20e-9, 1);
      c.set('VDPSEL', fin + 20e-9, 0);
    }
    c.paso(t, total, x.nota);
    t = total;
  }
  // VDP side: a write slot after the Z80 cycle (illustrative position), byte address $1A35 (odd → IC7)
  const dirV = 0x1a35;
  const t0 = t + 2 * TV;
  c.set('VADDR', 0, hex(dirV, 4));
  c.set('AD', t0, hex(dirV >> 1, 4));
  c.set('VCE', t0 + TV, 0);
  c.set('AD', t0 + 2 * TV, hex(0x3c << 8, 4));
  c.set('WE1', t0 + 2 * TV, 0);
  c.set('WE1', t0 + 4 * TV, 1);
  c.set('VCE', t0 + 4.5 * TV, 1);
  c.set('AD', t0 + 5 * TV, null);
  c.set('VADDR', t0 + 5 * TV, hex(dirV + 1, 4));
  c.marca(t0);
  c.marca(t0 + TV);
  c.marca(t0 + 2 * TV);
  c.paso(t, t0 + 6 * TV, `Hueco de acceso del VDP: pone en AD0–AD12 la dirección de palabra ${hex(dirV >> 1, 4)} y baja /CE (las PSRAM la retienen); después pone el dato en AD8–AD15 y baja /WE1, porque ${hex(dirV, 4)} es impar (IC7). La dirección de VRAM avanza sola a ${hex(dirV + 1, 4)}.`);
  const fin = t0 + 7 * TV;
  c.reloj('CLK', 0, fin, T, 0.5);
  c.reloj('CLKV', 0, fin, TV, 0.5);
  c.marca(fin);
  return {
    id: 'vram', titulo: 'Escritura en la VRAM', descripcion: 'El Z80 no ve la VRAM: escribe un byte en el puerto de datos del VDP ($BE) y el VDP lo lleva a la VRAM en uno de sus huecos de acceso, con la dirección y el dato por las mismas líneas AD.',
    duracion: fin, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: (4 * T) / 2.5,
    defecto: ['CLK', 'IORQ', 'WR', 'D', 'VDPSEL', 'CLKV', 'AD', 'VCE', 'WE0', 'WE1', 'VADDR'],
    fidelidad: 'Exacto: el ciclo OUT del Z80 y el reparto de bytes entre las dos 4168 (pares con /WE0 en AD0–AD7, impares con /WE1 en AD8–AD15) según el manual de Sega (hoja 1). Ilustrativo: la posición del hueco de acceso dentro de la línea y la duración de cada fase en el bus AD, que el manual no da (dibujadas con periodos del reloj de 10,64 MHz).',
  };
}

// ------------------------------------------------------------------ one line and the line interrupt

function escenarioLinea(op: Opciones): Escenario {
  const c = new Cronograma();
  const n = Number(op.reg10 ?? '3');
  const lineas = 6;
  c.bus('LINEA', 'Línea (contador V)')
    .bus('CONT', 'Contador de líneas', 'Se recarga con el registro 10 fuera de la zona activa')
    .bit('ACTIVA', 'Píxeles visibles', 0, '256 de los 342 puntos de cada línea')
    .bit('INT', '/INT', 1, 'Interrupción de línea (IE1 = 1)')
    .bus('CPU', 'Z80');
  let cont = n;
  let pend = false;
  const L0 = 20;
  for (let k = 0; k < lineas; k++) {
    const t0 = k * TL;
    c.set('LINEA', t0, String(L0 + k));
    c.set('ACTIVA', t0 + 13 * 2 * TV * 1.5, 1);
    c.set('ACTIVA', t0 + (13 + 256) * 2 * TV * 1.5, 0);
    c.marca(t0);
    cont -= 1;
    if (cont < 0) {
      cont = n;
      pend = true;
      c.set('INT', t0 + 2 * T, 0);
      c.set('CPU', t0 + 2 * T, 'acaba la instrucción');
      c.set('CPU', t0 + 20 * T, 'RST $38: rutina de interrupción');
      c.set('CPU', t0 + 40 * T, 'lee $BF (estado)');
      c.set('INT', t0 + 52 * T, 1);
      c.set('CPU', t0 + 52 * T, 'cambia el scroll o la paleta');
      c.set('CPU', t0 + 120 * T, 'bucle principal');
      c.marca(t0 + 2 * T);
      c.paso(t0, t0 + TL, `Línea ${L0 + k}: el contador pasa de 0 a −1 → interrupción de línea. El VDP baja /INT; el Z80 (modo IM 1) salta a $0038 y, al leer el puerto de control $BF, el VDP suelta /INT. El contador se recarga con ${n}.`);
    } else {
      c.paso(t0, t0 + TL, `Línea ${L0 + k}: el contador baja a ${cont}.`);
    }
    c.set('CONT', t0, String(cont));
  }
  void pend;
  c.set('CPU', 0, 'bucle principal');
  const fin = lineas * TL;
  c.marca(fin);
  return {
    id: 'linea', titulo: 'Interrupción de línea', descripcion: `Seis líneas de 342 puntos (228 ciclos del Z80, ${(TL * 1e6).toFixed(2).replace('.', ',')} µs en PAL). Con el registro 10 = ${n}, el contador del VDP llega a −1 cada ${n + 1} líneas y pide /INT: así se cambia el scroll a mitad de pantalla.`,
    duracion: fin, escala: 'µs', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: TL / 3,
    defecto: ['LINEA', 'CONT', 'ACTIVA', 'INT', 'CPU'],
    fidelidad: 'Exacto: 342 puntos y 228 ciclos de Z80 por línea, recarga del contador con el registro 10 y petición al pasar de 0 a −1, /INT a nivel hasta que se lee $BF (SMS Power, documentación del VDP). Ilustrativo: cuántos ciclos tarda la rutina en leer $BF y la posición de los píxeles visibles dentro de la línea.',
  };
}

// ------------------------------------------------------------------ frame

function escenarioCuadro(op: Opciones): Escenario {
  const pal = (op.norma ?? 'pal') === 'pal';
  const tl = pal ? TL : 228 * T_NTSC;
  const nl = pal ? 313 : 262;
  const c = new Cronograma();
  c.bus('LINEA', 'Línea').bit('ACTIVA', 'Zona activa', 1, 'Líneas 0–191').bit('VBL', 'Bandera de cuadro', 0, 'Bit 7 del estado ($BF)')
    .bit('INT', '/INT', 1).bit('NMI', '/NMI', 1, 'Botón de pausa').bus('CPU', 'Z80');
  for (let l = 0; l < nl; l++) c.set('LINEA', l * tl, String(l));
  c.set('ACTIVA', 0, 1);
  c.set('ACTIVA', 192 * tl, 0);
  const tv = 193 * tl;
  c.set('VBL', tv, 1);
  c.set('INT', tv, 0);
  c.set('CPU', 0, 'lógica del juego');
  c.set('CPU', tv, 'RST $38');
  c.set('CPU', tv + 40 * T, 'lee $BF: suelta /INT');
  c.set('VBL', tv + 50 * T, 0);
  c.set('INT', tv + 50 * T, 1);
  c.set('CPU', tv + 60 * T, 'copia sprites y tiles a la VRAM');
  c.set('CPU', tv + 30 * tl, 'lógica del juego');
  const tp = 240 * tl;
  c.set('NMI', tp, 0);
  c.set('NMI', tp + 2 * T, 1);
  c.set('CPU', tp + 4 * T, 'NMI: $0066 (pausa)');
  c.set('CPU', tp + 120 * T, 'lógica del juego');
  for (const t of [0, 192 * tl, tv, tv + 50 * T, tp, (nl - 1) * tl]) c.marca(t);
  c.paso(0, 192 * tl, 'Líneas 0–191: el VDP dibuja; el Z80 ejecuta la lógica del juego.');
  c.paso(192 * tl, tv, 'Línea 192: borde inferior.');
  c.paso(tv, tv + 60 * T, 'Línea 193 (contador V = $C1): bandera de cuadro y /INT. El Z80 salta a $0038 y lee el estado en $BF, que borra la bandera y suelta /INT.');
  c.paso(tv + 60 * T, tp, `Retrazado vertical (${nl - 193} líneas): es cuando se actualiza la VRAM sin estropear la imagen.`);
  c.paso(tp, tp + 120 * T, 'Botón de pausa: el VDP convierte el flanco de /NMI-IN en /NMI; el Z80 salta a $0066.');
  c.paso(tp + 120 * T, nl * tl, 'Hasta el final del cuadro.');
  const fin = nl * tl;
  c.marca(fin);
  return {
    id: 'cuadro', titulo: 'Cuadro, INT y pausa', descripcion: `Un cuadro ${pal ? 'PAL' : 'NTSC'}: ${nl} líneas de ${(tl * 1e6).toFixed(2).replace('.', ',')} µs (${(1 / (nl * tl)).toFixed(2).replace('.', ',')} Hz), 192 visibles. La interrupción de cuadro llega en la línea 193; la pausa es una NMI.`,
    duracion: fin, escala: 'ms', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 20, ventana: [185 * tl, 250 * tl],
    defecto: ['LINEA', 'ACTIVA', 'VBL', 'INT', 'NMI', 'CPU'],
    fidelidad: 'Exacto: 313 líneas en PAL y 262 en NTSC de 228 ciclos de Z80, 192 líneas visibles, bandera de cuadro e /INT al llegar el contador V a $C1, /INT liberado al leer $BF, pausa por NMI a $0066. Ilustrativo: los ciclos de la rutina y el momento en que se pulsa la pausa.',
  };
}

// ------------------------------------------------------------------ clocks

function escenarioRelojes(): Escenario {
  const c = new Cronograma();
  const fin = 2 * 15 / OSC;
  c.bit('OSC', 'Oscilador 53,2 MHz', 1, '18,8 ns')
    .bit('CLKV', 'VDP (÷ 5) 10,64 MHz', 1, '315-5237 → XTAL1 del VDP')
    .bit('CLK', 'Z80 (÷ 15) 3,547 MHz', 1, 'CLOCK del VDP')
    .bit('SC', 'Subportadora (÷ 12) 4,434 MHz', 1, '315-5237 → CXA1145');
  c.reloj('OSC', 0, fin, 1 / OSC, 0.5);
  c.reloj('CLKV', 0, fin, 5 / OSC, 0.5);
  c.reloj('CLK', 0, fin, 15 / OSC, 0.5);
  c.reloj('SC', 0, fin, 12 / OSC, 0.5);
  for (let k = 0; k <= 30; k++) c.marca(k / OSC);
  c.paso(0, fin, 'Todo sale del oscilador de 53,203424 MHz: ÷ 5 para el VDP (10,64 MHz; su punto es la mitad, 5,32 MHz), ÷ 15 para el Z80 y el PSG y ÷ 12 para la subportadora PAL. En NTSC las mismas divisiones del oscilador de 53,693175 MHz dan 10,74, 3,58 y 4,47 MHz, pero la subportadora NTSC (3,58 MHz) es la del Z80.');
  return {
    id: 'relojes', titulo: 'Relojes', descripcion: 'Las cuatro frecuencias del SMS II PAL salen del mismo oscilador y guardan una relación fija.',
    duracion: fin, escala: 'ns', pistas: c.pistas(), pasos: c.pasos, marcas: c.marcas, realPorSegundo: fin / 6,
    defecto: ['OSC', 'CLKV', 'CLK', 'SC'],
    fidelidad: 'Exacto: 53,203424 MHz y las divisiones ÷ 5, ÷ 15 y ÷ 12 (SMS Power «ClockRate»; redes 53M, 10.7M, 3.58M y SC de la hoja 2). Ilustrativo: la fase relativa y el ciclo de trabajo (dibujados al 50 %).',
  };
}

export const SMS: Maquina = {
  id: 'sms',
  diagrama,
  digitos: 4,
  dirInicial: 'C010',
  espacios: [
    { id: 'mem', titulo: 'Memoria', digitos: 4 },
    { id: 'io', titulo: 'Puertos de E/S', digitos: 2 },
  ],
  notaDecodificador: 'Memoria: configuración normal tras el arranque (cartucho y RAM activos en $3E). Puertos: solo cuentan A7, A6 y A0.',
  decodificar,
  escenarios: [
    { id: 'bus', titulo: 'Ciclos del Z80', crear: () => ciclos('bus', 'Ciclos de bus del Z80', 'Tres instrucciones: IN A,($DC) lee el mando, LD ($C010),A lo guarda en la RAM y OUT ($BE),A lo manda al VDP. Cada ciclo de máquina dura 3 o 4 periodos de 281,9 ns.', PROGRAMA) },
    { id: 'decodificar', titulo: 'Decodificar una dirección', crear: escenarioDecodificar },
    { id: 'paginador', titulo: 'Paginador', crear: escenarioPaginador },
    { id: 'vram', titulo: 'Escritura en la VRAM', crear: escenarioVRAM },
    { id: 'linea', titulo: 'Interrupción de línea', crear: escenarioLinea },
    { id: 'cuadro', titulo: 'Cuadro, INT y pausa', crear: escenarioCuadro },
    { id: 'relojes', titulo: 'Relojes', crear: escenarioRelojes },
  ],
  ejemplos: [
    { dir: 0x0100, escritura: false, texto: 'cartucho', espacio: 'mem' },
    { dir: 0x8123, escritura: false, texto: 'ventana 2', espacio: 'mem' },
    { dir: 0xc010, escritura: true, texto: 'RAM', espacio: 'mem' },
    { dir: 0xe010, escritura: false, texto: 'espejo', espacio: 'mem' },
    { dir: 0xffff, escritura: true, texto: 'banco', espacio: 'mem' },
    { dir: 0xbe, escritura: true, texto: 'VDP datos', espacio: 'io' },
    { dir: 0xbf, escritura: false, texto: 'VDP estado', espacio: 'io' },
    { dir: 0x7f, escritura: true, texto: 'PSG', espacio: 'io' },
    { dir: 0xdc, escritura: false, texto: 'mando 1', espacio: 'io' },
    { dir: 0x3e, escritura: true, texto: 'control', espacio: 'io' },
  ],
  opciones: [
    { id: 'banco', titulo: 'Banco', escenarios: ['paginador'], valores: [{ v: '5', texto: '5' }, { v: '2', texto: '2' }, { v: '15', texto: '15' }, { v: '31', texto: '31' }] },
    { id: 'reg10', titulo: 'Registro 10', escenarios: ['linea'], valores: [{ v: '3', texto: '3 (cada 4 líneas)' }, { v: '1', texto: '1 (cada 2)' }, { v: '0', texto: '0 (todas)' }] },
    { id: 'norma', titulo: 'Norma', escenarios: ['cuadro'], valores: [{ v: 'pal', texto: 'PAL (313 líneas)' }, { v: 'ntsc', texto: 'NTSC (262 líneas)' }] },
  ],
};
