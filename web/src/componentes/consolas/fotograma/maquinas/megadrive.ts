// «Un fotograma» of the Mega Drive (model 1, IC BD M5 PAL VA6.8; schematic and board: stonedDiscord's KiCad
// recreation): which nets every bus access moves.
// 68000 bus (U1): /VA1–/VA23, /VD0–/VD15, /AS, /UDS, /LDS, R/W, /DTACK (from the 315-5402 U4 or the VDP U8), FC0–1;
// the cartridge answers with /CE0 (U4), the work RAM with /RAS0 (from the VDP, U8) and /NOE, /LWR, /UWR; a DMA
// moves the same lines driven by the VDP after /BR and /BG. Z80 bus (U6): /ZA0–15, /ZD0–7, /MREQ, /ZRD, /ZWR,
// /M1, /REF, the RAM U7 with /ZRAM; /BUSRQ and /BUSACK with U4. VRAM (U9, U10, multiport): the VDP multiplexes row
// and column on /A0–/A7 with /RAS and /CAS; writes go through the random port (/WB/WE), the planes' and sprites'
// reads leave through the serial port SD0–SD7 after a transfer (/DT/OE) and SC pulses (68000UM, Sega «Genesis
// Technical Overview», Nemesis's VDP timing via BlastEm).

import { crearDesM68k } from '../cpu/m68k';
import desZ80 from '../cpu/z80';
import { bus, linea, nombres } from '../redes';
import type { AccesoBus, Adaptador, RedActiva } from '../tipos';

const VA = ['', ...Array.from({ length: 23 }, (_, i) => `/VA${i + 1}`)]; // bit 0 has no line: /UDS and /LDS
const VD = nombres('/VD', 16);
const ZA = nombres('/ZA', 16);
const ZD = nombres('/ZD', 8);
const RA = nombres('/A', 8); // VDP AD0–AD7 → VRAM A0–A7 / W0–W3
const SD = nombres('/SD', 8);
const C68 = 7; // master cycles per 68000 clock
const TZ = 15;

const NOMBRES_MD: Record<number, string> = {
  0xa10000: 'registro de versión del 315-5402', 0xa10001: 'registro de versión del 315-5402 (región, PAL/NTSC, revisión)',
  0xa11100: 'petición del bus del Z80 (/BUSREQ) y su estado', 0xa11200: 'reset del Z80', 0xa14000: 'TMSS: hay que escribir «SEGA»',
  0xa00000: 'RAM del Z80 vista desde el 68000', 0xa00001: 'RAM del Z80 vista desde el 68000',
  0xc00000: 'puerto de datos del VDP', 0xc00002: 'puerto de datos del VDP', 0xc00004: 'puerto de control del VDP', 0xc00006: 'puerto de control del VDP',
  0xc00008: 'contador HV del VDP', 0xc00011: 'PSG del VDP', 0xff0000: 'RAM del 68000', 0xff0006: 'RAM del 68000', 0xff0008: 'RAM del 68000',
};

const QUIEN68: Record<string, string> = { rom: 'J3', ram: 'U2', vdp: 'U8', io: 'U4', arbitro: 'U4', tmss: 'U4', zram: 'U4', ym: 'U11', psg: 'U8' };

function acceso68k(ev: AccesoBus, out: RedActiva[]): void {
  const k = ev.k ?? '';
  const f = ev.fase;
  const dma = k === 'dma';
  const amo = dma ? 'U8' : 'U1';
  if (k === 'iack') {
    // interrupt acknowledge: FC = 7, the level on A1–A3; /VPA from U4 (autovector)
    bus(out, VA, ev.a, 'direccion', 'U1');
    linea(out, '/FC0', 1, 'control', 'U1');
    linea(out, '/FC1', 1, 'control', 'U1');
    linea(out, '/~{INTAK}', 0, 'interrupcion', 'U4');
    linea(out, '/~{VPA}', f >= 2 * C68 ? 0 : 1, 'control', 'U4');
    return;
  }
  const escritura = !!(ev.f & 1);
  const byte = k.endsWith('-byte');
  // S0–S1: address out; /AS from S2 (half way through the first clock) to the end
  bus(out, VA, ev.a, 'direccion', amo);
  const as = f >= C68 / 2;
  linea(out, '/~{AS}', as ? 0 : 1, 'control', amo);
  linea(out, '/~{R{slash}W}', escritura ? 0 : 1, 'control', amo);
  const uds = !byte || !(ev.a & 1);
  const lds = !byte || !!(ev.a & 1);
  const ds = escritura ? f >= C68 * 1.5 : as;
  linea(out, '/~{UDS}', uds && ds ? 0 : 1, 'control', amo);
  linea(out, '/~{LDS}', lds && ds ? 0 : 1, 'control', amo);
  if (!dma) {
    const prog = k === 'programa';
    linea(out, '/FC0', prog ? 0 : 1, 'control', 'U1');
    linea(out, '/FC1', prog ? 1 : 0, 'control', 'U1');
  } else {
    linea(out, '/BG', 0, 'dma', 'U1');
    linea(out, '/BGACK', 0, 'dma', 'U8');
  }
  const datosListos = escritura ? f >= C68 : f >= C68 * 2;
  if (datosListos) {
    const v = byte ? (ev.a & 1 ? ev.d : ev.d << 8) : ev.d;
    const lineas = byte ? (ev.a & 1 ? VD.slice(0, 8) : VD.slice(8)) : VD;
    const valor = byte ? ev.d : v;
    bus(out, lineas, valor, 'datos', escritura ? 'U1' : QUIEN68[ev.c] ?? 'U4');
  }
  if (as) {
    if (ev.c === 'rom') {
      linea(out, '/~{CE0}', 0, 'seleccion', 'U4');
      if (!escritura) linea(out, '/~{OE0}', ds ? 0 : 1, 'seleccion', 'U4');
    } else if (ev.c === 'ram') {
      linea(out, '/~{RAS0}', 0, 'seleccion', 'U8');
      if (escritura) {
        if (uds && ds) linea(out, '/~{UWR}', 0, 'seleccion', 'U8');
        if (lds && ds) linea(out, '/~{LWR}', 0, 'seleccion', 'U8');
      } else linea(out, '/~{NOE}', 0, 'seleccion', 'U4');
    } else if (ev.c === 'zram') {
      // the 68000 reaches the Z80 RAM through the 315-5402, which drives the Z80 bus
      bus(out, ZA, ev.a & 0x1fff, 'direccion', 'U4');
      linea(out, '/~{ZRAM}', 0, 'seleccion', 'U4');
      linea(out, escritura ? '/~{ZWR}' : '/~{ZRD}', ds ? 0 : 1, 'control', 'U4');
      if (datosListos) bus(out, ZD, byte ? ev.d : ev.d >> 8, 'datos', escritura ? 'U4' : 'U7');
    } else if (ev.c === 'vdp' || ev.c === 'psg') {
      linea(out, '/~{VDPM}', 0, 'seleccion', 'U4');
    }
  }
  // /DTACK: the answering chip ends the cycle (the VDP holds it back while its FIFO is full)
  if (f >= C68 * 2) linea(out, '/~{DTAK}', 0, 'control', ev.c === 'vdp' || ev.c === 'psg' || dma ? 'U8' : 'U4');
}

function accesoZ80(ev: AccesoBus, out: RedActiva[]): void {
  const k = ev.k ?? '';
  const f = ev.fase;
  bus(out, ZA, ev.a, 'direccion', 'U6');
  if (k === 'refresco') {
    linea(out, '/~{REF}', 0, 'control', 'U6');
    linea(out, '/~{MREQ}', f >= TZ / 2 && f < TZ * 1.5 ? 0 : 1, 'control', 'U6');
    return;
  }
  if (k === 'm1' || k === 'int-ack') linea(out, '/~{M1}', 0, 'control', 'U6');
  const memoria = k === 'm1' || k === 'lectura' || k === 'escritura';
  const activa = memoria ? f >= TZ / 2 : f >= TZ;
  if (memoria) linea(out, '/~{MREQ}', activa ? 0 : 1, 'control', 'U6');
  else linea(out, '/~{IREQ}', activa ? 0 : 1, 'control', 'U6');
  const escritura = !!(ev.f & 1);
  linea(out, escritura ? '/~{ZWR}' : '/~{ZRD}', activa ? 0 : 1, 'control', 'U6');
  if (f >= TZ) bus(out, ZD, ev.d, 'datos', escritura ? 'U6' : ev.c === 'ram' ? 'U7' : 'U4');
  if (activa && ev.c === 'ram') linea(out, '/~{ZRAM}', 0, 'seleccion', 'U4');
}

function accesoVram(ev: AccesoBus, out: RedActiva[]): void {
  const k = ev.k ?? '';
  const f = ev.fase;
  if (k === 'refresco') {
    linea(out, 'Net-(U10-~{RAS})', f < 8 ? 0 : 1, 'control', 'U8');
    return;
  }
  const escritura = !!(ev.f & 1);
  // row (high byte) with /RAS, then column (low byte) with /CAS
  bus(out, RA, f < 4 ? ev.a >> 8 : ev.a & 0xff, 'direccion', 'U8');
  linea(out, 'Net-(U10-~{RAS})', f >= 2 ? 0 : 1, 'control', 'U8');
  linea(out, 'Net-(U10-~{CAS})', f >= 6 ? 0 : 1, 'control', 'U8');
  if (escritura) {
    if (f >= 8) bus(out, RA, ev.d & 0xff, ev.f & 8 ? 'dma' : 'datos', 'U8');
    linea(out, 'Net-(U10-~{WB}{slash}~{WE})', f >= 8 ? 0 : 1, 'control', 'U8');
  } else {
    // read transfer into the serial port, then SC pulses: the bytes leave on SD0–SD7
    linea(out, 'Net-(U10-~{DT}{slash}~{OE})', f >= 4 && f < 10 ? 0 : 1, 'control', 'U8');
    linea(out, 'Net-(U10-SC)', f >= 10 && (Math.floor(f) & 2) ? 1 : 0, 'reloj', 'U8');
    linea(out, 'Net-(U10-~{SE})', 0, 'control', 'U8');
    if (f >= 10) bus(out, SD, ev.d >>> 24, 'datos', 'U9');
  }
}

export const adaptador: Adaptador = {
  maquina: 'megadrive',
  cpus: { m68k: crearDesM68k(NOMBRES_MD), z80: desZ80 },
  redesAcceso(b, ev, out) {
    if (b === 'm68k') acceso68k(ev, out);
    else if (b === 'z80') accesoZ80(ev, out);
    else if (b === 'vram') accesoVram(ev, out);
  },
  redesSenal(s, nivel, out) {
    switch (s) {
      case 'ipl':
        // level 6 = /IPL1 and /IPL2 low, level 4 = /IPL2 low (/IPL0 is not wired on this board)
        linea(out, '/IPL1', nivel & 2 ? 0 : 1, 'interrupcion', 'U8');
        linea(out, '/IPL2', nivel & 4 ? 0 : 1, 'interrupcion', 'U8');
        break;
      case 'br':
        linea(out, '/BR', nivel as 0 | 1, 'dma', 'U8');
        if (!nivel) linea(out, '/BG', 0, 'dma', 'U1');
        break;
      case 'zbusreq':
        linea(out, 'Net-(U4-~{ZBR})', nivel as 0 | 1, 'control', 'U4');
        break;
      case 'zbusack':
        linea(out, '/~{ZBAK}', nivel as 0 | 1, 'control', 'U6');
        break;
      case 'zreset':
        linea(out, '/~{ZRES}', nivel as 0 | 1, 'control', 'U4');
        break;
      case 'hsync':
        linea(out, '/~{HSYNC}', nivel as 0 | 1, 'video', 'U8');
        linea(out, 'Net-(U13-C_SYNC_IN)', nivel as 0 | 1, 'video', 'U8');
        break;
      case 'vsync':
        linea(out, '/~{VSYNC}', nivel as 0 | 1, 'video', 'U8');
        break;
    }
  },
  redesPixel(_c, out) {
    for (const r of ['Net-(U8-R)', 'Net-(U8-G)', 'Net-(U8-B)']) linea(out, r, null, 'video', 'U8');
  },
  relojes: [
    { red: 'MCLK', grupo: 'reloj', nivel: null },
    { red: '/VCLK', grupo: 'reloj', nivel: null, desde: 'U4' },
    { red: '/ZCLK', grupo: 'reloj', nivel: null, desde: 'U8' },
    { red: '/EDCK', grupo: 'reloj', nivel: null, desde: 'U8' },
  ],
  chips: {
    rom: ['J3'], ram: ['U2', 'U3'], vdp: ['U8'], psg: ['U8'], io: ['U4'], arbitro: ['U4'], tmss: ['U4'], zram: ['U4', 'U7'], ym: ['U11'],
    vram: ['U9', 'U10'], banco: ['U4'], ventana: ['U4'],
  },
  avisoPlaca:
    'La placa es la recreación KiCad de stonedDiscord de la IC BD M5 PAL (generación VA5/VA6): mismas referencias y redes que el esquema, dibujada a partir de escaneos de la placa desnuda. La foto es la de una VA6.8 PAL.',
  fases: {
    activa: 'En cada ranura de 16 ciclos el VDP lee 4 bytes de la VRAM: nombres y patrones de los planos A y B, atributos y patrones de sprites, la tabla de desplazamiento; 18 de las 210 ranuras de la línea son para el 68000 (FIFO) o un DMA.',
    borde: 'Borde: el VDP saca el color de fondo y prepara los sprites de la línea siguiente.',
    borrado: 'Borrado: imagen en negro; en las líneas del borrado vertical casi todas las ranuras quedan para el 68000 y los DMA.',
    hsync: 'Sincronismo horizontal: 17 ranuras más largas (18–20 ciclos) con /HSYNC abajo.',
    vsync: 'Sincronismo vertical: posición aproximada (3 líneas dentro del borrado vertical): las fuentes consultadas no la documentan.',
  },
  mapa: [
    { desde: 0x000000, hasta: 0x3fffff, chip: 'rom', titulo: 'Cartucho (ROM, /CE0)' },
    { desde: 0xa00000, hasta: 0xa0ffff, chip: 'zram', titulo: 'Zona del Z80: su RAM (U7) y el YM2612, a través del 315-5402' },
    { desde: 0xa10000, hasta: 0xa1001f, chip: 'io', titulo: 'E/S del 315-5402: versión y mandos' },
    { desde: 0xa11100, hasta: 0xa11201, chip: 'arbitro', titulo: 'Bus y reset del Z80' },
    { desde: 0xa14000, hasta: 0xa14003, chip: 'tmss', titulo: 'TMSS' },
    { desde: 0xc00000, hasta: 0xc0001f, chip: 'vdp', titulo: 'VDP: datos, control, contador HV y PSG' },
    { desde: 0xe00000, hasta: 0xffffff, chip: 'ram', titulo: 'RAM de trabajo 64 KB (U2, U3), espejada' },
  ],
  hojaInicial: 0,
  fidelidad:
    'Exacto: cada ciclo de bus del 68000 (Moira en temporización precisa, con el mismo instante de inicio que SingleStepTests 680x0 en todos los accesos comparados) con las esperas de /DTACK del VDP; el DMA de la RAM a la VRAM con /BR y cada lectura del VDP; el IACK; los ciclos del Z80; cada ranura del VDP con lo que lee o escribe (núcleo de BlastEm, según las medidas de Nemesis); el instante de cada píxel. Ilustrativo: la forma de las líneas dentro de cada ciclo (68000 User\'s Manual), el reparto fila/columna y el puerto serie de la VRAM dentro de la ranura, la posición de /VSYNC. El Z80 cede su bus al terminar la instrucción en curso (el real, al terminar el ciclo de máquina). Sin sonido: el YM2612 y el PSG no se emulan (sus escrituras sí están en la traza; el estado del YM se lee como 0). En «Un juego de verdad» el mando del puerto 1 es uno de 3 botones que sigue un guion fijo.',
  fuentes: [
    { titulo: 'Moira, 68000 de Dirk W. Hoffmann (MIT)', url: 'https://github.com/dirkwhoffmann/Moira', uso: '68000 ciclo a ciclo; con tres correcciones del orden del bus (RTE, JSR, ADD/SUB.l en memoria).' },
    { titulo: 'SingleStepTests 680x0 (Thomas Harte, MIT)', url: 'https://github.com/SingleStepTests/680x0', uso: 'Validación del 68000: 282 275 pruebas, 707 752 accesos con su ciclo de inicio.' },
    { titulo: 'BlastEm, vdp.c y genesis.c (Michael Pavone, GPL-3)', url: 'https://github.com/libretro/blastem', uso: 'VDP ranura a ranura, FIFO, DMA y esperas del 68000; usado sin conexión.' },
    { titulo: 'Nemesis, «VDP VRAM access timing» (SpritesMind)', url: 'https://gendev.spritesmind.net/forum/viewtopic.php?p=12349', uso: 'Reparto de las ranuras de una línea H40.' },
    { titulo: 'Plutiedev: TMSS, bus del Z80, DMA, registros del VDP', url: 'https://plutiedev.com/', uso: 'Secuencia de arranque de la demostración.' },
    { titulo: 'Motorola, «M68000 Family Programmer\'s Reference Manual» y «MC68000 User\'s Manual»', url: 'https://www.nxp.com/docs/en/reference-manual/M68000PRM.pdf', uso: 'Instrucciones y forma de los ciclos de bus.' },
    { titulo: 'Werton y Stéphane Dallongeville, «Gentris», ejemplo de SGDK (MIT)', url: 'https://github.com/Stephane-D/SGDK', uso: '«Un juego de verdad»: la ROM que publica SGDK (sample/game/gentris/out/release/rom.bin, commit 9a78a44), con un guion de botones del mando de 3 botones.' },
  ],
};

export default adaptador;
