// «Un fotograma» of the Master System II (board 171-5922A, schematic transcribed from Sega's service manual): which
// nets every bus access moves. Z80 bus: A0–A15, /M1, /MREQ, /IOREQ, /RD, /WR, /REFSH from the Z80 (IC1), D0–D7
// from whoever answers; /CE3 (cartridge) and /CE1 (RAM) from the 315-5237 (IC4), /CSRAM from the VDP (IC5)
// (Zilog UM0080 for the machine cycles; SMS Power «Port mapping» and «Memory map» for the decoding).
// VRAM bus: the 315-5246 puts the word address on AD0–AD12 and latches it in both 4168 PSRAMs with VRAM /CE; then
// /OE (read: IC6 drives AD0–AD7, IC7 AD8–AD15) or /WE0 or /WE1 (write of one byte).

import desZ80 from '../cpu/z80';
import { bus, linea, nombres } from '../redes';
import type { AccesoBus, Adaptador, RedActiva } from '../tipos';

const A = nombres('A', 16);
const D = nombres('D', 8);
const AD = nombres('AD', 16);
const T = 15; // master cycles per Z80 T state

const QUIEN: Record<string, string> = { cartucho: 'CN1', ram: 'IC3', vdp: 'IC5', psg: 'IC5', io: 'IC4' };

function accesoZ80(ev: AccesoBus, out: RedActiva[]): void {
  const k = ev.k ?? '';
  const f = ev.fase;
  const escritura = !!(ev.f & 1);
  if (k === 'refresco') {
    // T3–T4 of an opcode fetch: the refresh address (register R) with /MREQ and /REFSH
    bus(out, A, ev.a, 'direccion', 'IC1');
    linea(out, '~{REFSH}', 0, 'control', 'IC1');
    linea(out, '~{MREQ}', f >= T / 2 && f < T * 1.5 ? 0 : 1, 'control', 'IC1');
    linea(out, '~{M1}', 1, 'control', 'IC1');
    return;
  }
  bus(out, A, ev.a, 'direccion', 'IC1');
  if (k === 'm1' || k === 'int-ack') linea(out, '~{M1}', 0, 'control', 'IC1');
  if (k === 'int-ack') {
    // M1 with /IORQ instead of /MREQ: nobody puts a vector (IM 1); /INT is released by the status read
    linea(out, '~{IOREQ}', f >= T * 2.5 ? 0 : 1, 'control', 'IC1');
    return;
  }
  const memoria = k === 'm1' || k === 'lectura' || k === 'escritura';
  const activa = memoria ? f >= T / 2 : f >= T; // /MREQ from the middle of T1, /IORQ from T2
  if (memoria) linea(out, '~{MREQ}', activa ? 0 : 1, 'control', 'IC1');
  else linea(out, '~{IOREQ}', activa ? 0 : 1, 'control', 'IC1');
  if (escritura) {
    linea(out, '~{WR}', (memoria ? f >= T * 1.5 : f >= T) ? 0 : 1, 'control', 'IC1');
    bus(out, D, ev.d, 'datos', 'IC1');
  } else {
    linea(out, '~{RD}', activa ? 0 : 1, 'control', 'IC1');
    if (f >= T) bus(out, D, ev.d, 'datos', QUIEN[ev.c] ?? 'IC1');
  }
  if (memoria && activa) {
    if (ev.c === 'cartucho') linea(out, '~{CE3}', 0, 'seleccion', 'IC4');
    else if (ev.c === 'ram') {
      linea(out, '~{CSRAM}', 0, 'seleccion', 'IC5');
      linea(out, '~{CE1}', 0, 'seleccion', 'IC4');
    }
  }
}

function accesoVram(ev: AccesoBus, out: RedActiva[]): void {
  const k = ev.k ?? '';
  if (k === 'refresco') {
    linea(out, 'VRAM-~{CE}', ev.fase < 10 ? 0 : 1, 'control', 'IC5');
    return;
  }
  const escritura = !!(ev.f & 1);
  if (ev.fase < 6) {
    // address phase: the word address on AD0–AD12, latched when VRAM /CE falls
    bus(out, AD.slice(0, 13), ev.a >> 1, 'direccion', 'IC5');
    linea(out, 'VRAM-~{CE}', 1, 'control', 'IC5');
    return;
  }
  linea(out, 'VRAM-~{CE}', 0, 'seleccion', 'IC5');
  if (escritura) {
    const impar = ev.a & 1;
    bus(out, impar ? AD.slice(8) : AD.slice(0, 8), ev.d, 'datos', 'IC5');
    linea(out, impar ? '~{WE1}' : '~{WE0}', ev.fase >= 10 ? 0 : 1, 'control', 'IC5');
  } else {
    linea(out, 'VRAM-~{OE}', ev.fase >= 10 ? 0 : 1, 'control', 'IC5');
    if (ev.fase >= 10) {
      bus(out, AD.slice(0, 8), ev.d & 0xff, 'datos', 'IC6');
      bus(out, AD.slice(8), ev.d >> 8, 'datos', 'IC7');
    }
  }
}

export const adaptador: Adaptador = {
  maquina: 'sms',
  cpus: { z80: desZ80 },
  redesAcceso(b, ev, out) {
    if (b === 'z80') accesoZ80(ev, out);
    else if (b === 'vram') accesoVram(ev, out);
  },
  redesSenal(s, nivel, out) {
    if (s === 'int') linea(out, '~{INT}', nivel as 0 | 1, 'interrupcion', 'IC5');
    else if (s === 'sync') linea(out, '~{SYNC}', nivel as 0 | 1, 'video', 'IC5');
  },
  redesPixel(_c, out) {
    for (const r of ['R', 'G', 'B']) linea(out, r, null, 'video', 'IC5');
  },
  relojes: [
    { red: '53M', grupo: 'reloj', nivel: null },
    { red: '10.7M', grupo: 'reloj', nivel: null, desde: 'IC4' },
    { red: 'VDP-CLOCK', grupo: 'reloj', nivel: null, desde: 'IC5' },
    { red: '3.58M', grupo: 'reloj', nivel: null },
  ],
  chips: { cartucho: ['CN1'], ram: ['IC3'], vdp: ['IC5'], psg: ['IC5'], io: ['IC4'], vram: ['IC6', 'IC7'], 'vram-par': ['IC6'], 'vram-impar': ['IC7'] },
  avisoPlaca:
    'La Master System II no tiene una placa publicada en formato abierto (el .kicad_pcb de slowcoder está vacío y no hay otra recreación de la 171-5922A): el recorrido se ve en el esquema transcrito del manual de servicio de Sega.',
  fases: {
    activa: 'El VDP saca un punto cada 10 ciclos del oscilador mientras lee, para cada casilla de 8 puntos, su entrada de la tabla de nombres y las dos palabras del patrón; cada 4 casillas deja un hueco al Z80.',
    borde: 'Borde: el VDP saca el color de borde (registro 7) y sigue leyendo la VRAM para la línea siguiente (búsqueda de sprites).',
    borrado: 'Borrado: la señal de vídeo se queda en negro; el VDP deja casi todas las ranuras al Z80.',
    hsync: 'Sincronismo horizontal: /SYNC baja 26 puntos (unos 4,9 µs).',
    salva: 'Salva de color: el codificador CXA1145 mete la subportadora para que la tele enganche el color.',
    vsync: 'Sincronismo vertical: 3 líneas con /SYNC casi siempre abajo.',
  },
  mapa: [
    { desde: 0x0000, hasta: 0xbfff, chip: 'cartucho', titulo: 'ROM del cartucho (/CE3), 3 ventanas de 16 KB del paginador' },
    { desde: 0xc000, hasta: 0xdfff, chip: 'ram', titulo: 'RAM de trabajo 8 KB (IC3: /CSRAM y /CE1)' },
    { desde: 0xe000, hasta: 0xffff, chip: 'ram', titulo: 'Espejo de la RAM; $FFFC–$FFFF también al paginador' },
  ],
  hojaInicial: 2,
  fidelidad:
    'Exacto: cada ciclo de máquina del Z80 (dirección, dato, tipo y su instante) del núcleo z80.h de floooh, que coincide con SingleStepTests/z80 en dirección, dato y ciclo de cada acceso; cada ranura del VDP en modo 4 y su dirección de la VRAM, del núcleo de BlastEm (con el contador V de PAL); la interrupción de cuadro; el punto de cada píxel. Ilustrativo: la forma de /MREQ, /RD y /WR dentro de cada ciclo (según el manual de Zilog, no medida), el reparto dirección/dato del bus AD dentro de cada ranura, y los tramos del sincronismo, tomados de msvdp.txt. Durante HALT, z80.h repite la lectura en la dirección de HALT; según otras fuentes el Z80 lee la siguiente (el dato se ignora en ambos casos). Sin sonido (el PSG no se emula). En «Un juego de verdad» el mando 1 sigue un guion fijo de botones.',
  fuentes: [
    { titulo: 'Charles MacDonald, «Sega Master System VDP documentation» (msvdp.txt)', url: 'https://www.smspower.org/Development/', uso: 'Modo 4, 342 puntos y 313 líneas en PAL, contador V, interrupciones, tramos del sincronismo.' },
    { titulo: 'SMS Power: «Port mapping», «Memory map», «Mappers», «VDP»', url: 'https://www.smspower.org/Development/', uso: 'Decodificación de puertos y memoria, paginador, cabecera «TMR SEGA».' },
    { titulo: 'floooh/chips, z80.h (zlib)', url: 'https://github.com/floooh/chips', uso: 'Z80 ciclo a ciclo (contenido/fotograma/sms/sms_traza.c).' },
    { titulo: 'BlastEm, vdp.c (Michael Pavone, GPL-3)', url: 'https://github.com/libretro/blastem', uso: 'VDP ranura a ranura, usado sin conexión para generar la traza.' },
    { titulo: 'SingleStepTests/z80 (MIT)', url: 'https://github.com/SingleStepTests/z80', uso: 'Validación del Z80: 50 000 pruebas de 50 códigos, 130 000 accesos al bus.' },
    { titulo: 'Zilog, «Z80 CPU User Manual» (UM0080)', url: 'https://www.zilog.com/docs/z80/um0080.pdf', uso: 'Forma de los ciclos de máquina: M1, lectura, escritura, E/S, reconocimiento de interrupción.' },
    { titulo: 'Haroldo O. Pinheiro, «Food Fighter» (MIT)', url: 'https://github.com/haroldo-ok/food-fighter', uso: '«Un juego de verdad» (commit 48fe2ea); compilado con contenido/consolas_juegos/sms/construir.sh (SDCC 4.0.0, devkitSMS de sverx).' },
    { titulo: 'Henry Software, «64 16x16 food sprites» (CC0)', url: 'https://opengameart.org/node/64948', uso: 'Sprites de Food Fighter.' },
  ],
};

export default adaptador;
