// «Un fotograma» of the Neo Geo AES (Board-Folk's NEO-AES3-5 schematic and board): which nets every bus access
// moves. 68000 (U3): /CPU/A1–A23, /CPU/D0–D15, AS, UDS, LDS, R/W, DTACK (from NEO-C1, U4), ROMOE for the
// cartridge's P ROM. LSPC2-A2 (U21): the slow VRAM (U17, U18) on /GRAPHICS/B0–B14 (address) and E0–E15 (data),
// the fast VRAM (U19, U20) on C0–C10 and F0–F15; the sprite and fix graphics addresses on the cartridge's P bus
// (P0–P23, latched with PCK1 for the C ROMs and PCK2 for the S ROM); the C ROM pixels come back already
// serialised by the cartridge (GAD0–3, GBD0–3, DOTA, DOTB) and the S ROM bytes on FIXD0–7, both into NEO-B1 (U13),
// which writes the line buffers and drives the palette RAM (U6, U7) (wiki.neogeodev.org).

import { crearDesM68k } from '../cpu/m68k';
import { bus, linea, nombres } from '../redes';
import type { AccesoBus, Adaptador, RedActiva } from '../tipos';

const A = ['', ...Array.from({ length: 23 }, (_, i) => `/CPU/A${i + 1}`)];
const D = nombres('/CPU/D', 16);
const VLA = nombres('/GRAPHICS/B', 15);
const VLD = nombres('/GRAPHICS/E', 16);
const VRA = nombres('/GRAPHICS/C', 11);
const VRD = nombres('/GRAPHICS/F', 16);
const P = nombres('/Cartridge Slots/P', 24);
const FIX = nombres('/Cartridge Slots/FIXD', 8);
const PC = nombres('/VIDEO/PC', 16);
const C68 = 4; // half master cycles per 68000 clock

const NOMBRES_NG: Record<number, string> = {
  0x300000: 'mando 1 (NEO-C1)', 0x300001: 'perro guardián (NEO-C1)', 0x320000: 'respuesta del Z80 (NEO-C1)', 0x380000: 'Start y Select (NEO-C1)',
  0x3a001b: 'REG_CRTFIX (sin efecto en la AES)', 0x3a000b: 'REG_BRDFIX (sin efecto en la AES)', 0x3a0013: 'REG_SWPROM: vectores del cartucho', 0x3a0003: 'REG_SWPBIOS: vectores de la ROM del sistema',
  0x3c0000: 'REG_VRAMADDR de la LSPC', 0x3c0002: 'REG_VRAMRW de la LSPC', 0x3c0004: 'REG_VRAMMOD de la LSPC', 0x3c0006: 'REG_LSPCMODE de la LSPC',
  0x3c000c: 'REG_IRQACK de la LSPC', 0x401ffe: 'color de fondo (RAM de paleta)', 0x100000: 'RAM del 68000',
};

const QUIEN: Record<string, string> = { prom: 'CN5', ram: 'U1', io: 'U4', sistema: 'U35', lspc: 'U21', paleta: 'U6', bios: 'U36' };

function acceso68k(ev: AccesoBus, out: RedActiva[]): void {
  const k = ev.k ?? '';
  const f = ev.fase;
  bus(out, A, ev.a, 'direccion', 'U3');
  if (k === 'iack') {
    linea(out, 'IPL0', 0, 'interrupcion', 'U21');
    linea(out, 'Net-(U3-VPA)', f >= C68 * 2 ? 0 : 1, 'control', 'U4');
    return;
  }
  const escritura = !!(ev.f & 1);
  const byte = k.endsWith('-byte');
  const as = f >= C68 / 2;
  linea(out, 'AS', as ? 0 : 1, 'control', 'U3');
  linea(out, 'R{slash}W', escritura ? 0 : 1, 'control', 'U3');
  const ds = escritura ? f >= C68 * 1.5 : as;
  linea(out, 'Net-(U3-UDS)', (!byte || !(ev.a & 1)) && ds ? 0 : 1, 'control', 'U3');
  linea(out, 'LDS', (!byte || !!(ev.a & 1)) && ds ? 0 : 1, 'control', 'U3');
  const listos = escritura ? f >= C68 : f >= C68 * 2;
  if (listos) {
    if (byte) bus(out, ev.a & 1 ? D.slice(0, 8) : D.slice(8), ev.d, 'datos', escritura ? 'U3' : QUIEN[ev.c] ?? 'U4');
    else bus(out, D, ev.d, 'datos', escritura ? 'U3' : QUIEN[ev.c] ?? 'U4');
  }
  if (as && ev.c === 'prom' && !escritura) linea(out, 'ROMOE', 0, 'seleccion', 'U4');
  if (f >= C68 * 2) linea(out, 'Net-(U3-DTACK)', 0, 'control', 'U4');
}

function accesoLenta(ev: AccesoBus, out: RedActiva[]): void {
  const escritura = !!(ev.f & 1);
  bus(out, VLA, ev.a, 'direccion', 'U21');
  if (ev.fase >= 3) bus(out, VLD, ev.d, 'datos', escritura ? 'U21' : 'U17');
}

function accesoRapida(ev: AccesoBus, out: RedActiva[]): void {
  const escritura = !!(ev.f & 1);
  bus(out, VRA, ev.a & 0x7ff, 'direccion', 'U21');
  if (ev.fase >= 1) bus(out, VRD, ev.d, 'datos', escritura ? 'U21' : 'U19');
}

function accesoCrom(ev: AccesoBus, out: RedActiva[]): void {
  // the LSPC puts the address on the P bus, the cartridge latches it with PCK1 and serialises the pixels
  if (ev.fase < 6) {
    bus(out, P, ev.a >> 2, 'direccion', 'U21');
    linea(out, 'PCK1', ev.fase >= 2 ? 1 : 0, 'control', 'U21');
  } else {
    for (const n of ['GAD0', 'GAD1', 'GAD2', 'GAD3', 'GBD0', 'GBD1', 'GBD2', 'GBD3', 'DOTA', 'DOTB']) linea(out, n, null, 'datos', 'CN4');
  }
}

function accesoSrom(ev: AccesoBus, out: RedActiva[]): void {
  if (ev.fase < 6) {
    bus(out, P, ev.a, 'direccion', 'U21');
    linea(out, 'PCK2', ev.fase >= 2 ? 1 : 0, 'control', 'U21');
  } else bus(out, FIX, ev.d, 'datos', 'CN4');
}

export const adaptador: Adaptador = {
  maquina: 'neogeo',
  cpus: { m68k: crearDesM68k(NOMBRES_NG) },
  redesAcceso(b, ev, out) {
    if (b === 'm68k') acceso68k(ev, out);
    else if (b === 'lenta') accesoLenta(ev, out);
    else if (b === 'rapida') accesoRapida(ev, out);
    else if (b === 'crom') accesoCrom(ev, out);
    else if (b === 'srom') accesoSrom(ev, out);
  },
  redesSenal(s, nivel, out) {
    if (s === 'ipl') linea(out, 'IPL0', nivel & 1 ? 0 : 1, 'interrupcion', 'U21');
    else if (s === 'hsync' || s === 'vsync') {
      linea(out, 'SYNC', nivel as 0 | 1, 'video', 'U21');
      linea(out, '/RGB VIDEO/CSYNC', nivel as 0 | 1, 'video', 'U21');
    }
  },
  redesPixel(_c, out) {
    // NEO-B1 reads the palette RAM with the colour of the pixel; the resistor networks turn it into R, G and B
    for (const n of PC) linea(out, n, null, 'video', 'U6');
    for (const n of ['/RGB VIDEO/R', '/RGB VIDEO/G', '/RGB VIDEO/B']) linea(out, n, null, 'video', 'U13');
  },
  relojes: [
    { red: '24M', grupo: 'reloj', nivel: null },
    { red: '12M', grupo: 'reloj', nivel: null, desde: 'U21' },
    { red: '68KCLK', grupo: 'reloj', nivel: null },
    { red: '6MB', grupo: 'reloj', nivel: null, desde: 'U21' },
  ],
  chips: {
    prom: ['CN5'], ram: ['U1', 'U2'], io: ['U4'], sistema: ['U35'], lspc: ['U21'], paleta: ['U6', 'U7'], bios: ['U36'],
    'vram-lenta': ['U17', 'U18'], 'vram-rapida': ['U19', 'U20'], crom: ['CN4', 'U13'], srom: ['CN4', 'U13'],
  },
  avisoPlaca:
    'La placa es la recreación KiCad de Board Folk de la NEO-AES3-5 (2.ª generación del chipset, mismas referencias y redes que el esquema); la foto del libro es una NEO-AES de 1.ª generación. Las ROM C y S están en el cartucho: en la placa solo se ven su bus de direcciones (P0–P23) y lo que vuelve ya convertido en puntos.',
  fases: {
    activa: 'Cada 16 ciclos del reloj maestro la LSPC analiza cinco sprites para la línea N + 2, lee de la VRAM la entrada de la lista, la reducción, la Y, la X y el patrón de un sprite de la línea N + 1 y pide 16 puntos a las ROM C; mientras, saca la línea actual con la capa fija encima.',
    borrado: 'Borrado: sin imagen (en NTSC los bordes van apagados); la LSPC sigue analizando y dibujando la línea siguiente en el búfer.',
    hsync: 'Sincronismo horizontal: 28 puntos.',
    vsync: 'Sincronismo vertical: las líneas $F8–$FF del contador.',
  },
  mapa: [
    { desde: 0x000000, hasta: 0x0fffff, chip: 'prom', titulo: 'ROM P del cartucho (vectores del cartucho tras REG_SWPROM)' },
    { desde: 0x100000, hasta: 0x10ffff, chip: 'ram', titulo: 'RAM de trabajo 64 KB (U1, U2)' },
    { desde: 0x300000, hasta: 0x39ffff, chip: 'io', titulo: 'NEO-C1: mandos, perro guardián, Z80' },
    { desde: 0x3a0000, hasta: 0x3a001f, chip: 'sistema', titulo: 'Registros del sistema (latch U35)' },
    { desde: 0x3c0000, hasta: 0x3c000f, chip: 'lspc', titulo: 'Registros de la LSPC: VRAM, modo, temporizador, IRQ' },
    { desde: 0x400000, hasta: 0x401fff, chip: 'paleta', titulo: 'RAM de paleta (U6, U7)' },
    { desde: 0xc00000, hasta: 0xc1ffff, chip: 'bios', titulo: 'ROM del sistema (U36): en «Un juego de verdad», nullbios, la libre de ngdevkit; la demo no la usa' },
  ],
  hojaInicial: 8,
  fidelidad:
    'Exacto: cada ciclo de bus del 68000 (Moira, validado con SingleStepTests 680x0) y el instante de cada píxel según el modelo. Modelo propio, no un emulador probado: la LSPC reparte sus accesos como describe wiki.neogeodev.org (ranuras de 16 ciclos con 4 accesos a la VRAM lenta y 10 a la rápida, 2 lecturas de la ROM C por línea de sprite, 4 de la ROM S por casilla fija; el análisis de sprites aún está en borrador allí) y el contenido de cada acceso sale de la VRAM real de la demostración; la imagen se compone con esos mismos datos. Ilustrativo: la fase exacta de cada ranura respecto al sincronismo y la forma de las líneas. La ROM del sistema de SNK no se incluye nunca: la demo empieza en USER con la VRAM ya borrada, y «Un juego de verdad» arranca desde el reset con nullbios, la ROM del sistema libre de ngdevkit (LGPL-3.0+), que hace lo mínimo (llamar a USER, conmutar vectores, leer los mandos en cada cuadro). Sin Z80 de sonido: el 68000 lee 0 en su puerto de respuesta. La señal es NTSC (264 líneas); las AES PAL tienen 312 líneas.',
  fuentes: [
    { titulo: 'wiki.neogeodev.org: «Rendering logic»', url: 'https://wiki.neogeodev.org/index.php/Rendering_logic', uso: 'Ranuras de la VRAM lenta y rápida, análisis de sprites, ROM C y S, búferes de línea.' },
    { titulo: 'wiki.neogeodev.org: «Display timing»', url: 'https://wiki.neogeodev.org/index.php/Display_timing', uso: 'Tramos de la línea y del cuadro, contador de líneas.' },
    { titulo: 'wiki.neogeodev.org: «Sprites», «Fix layer», «VRAM», «Memory mapped registers»', url: 'https://wiki.neogeodev.org/index.php/Sprites', uso: 'SCB1–SCB4, enganche, capa fija, registros de la LSPC.' },
    { titulo: 'MAME, src/mame/snk/neogeo.cpp (BSD-3)', url: 'https://github.com/mamedev/mame/tree/master/src/mame/snk', uso: 'Instante de la interrupción vertical y constantes de la pantalla.' },
    { titulo: 'ngdevkit, tiletool.py (LGPL-3)', url: 'https://github.com/dciabrin/ngdevkit', uso: 'Formato de las ROM C y S (la demostración las codifica con su propio guion).' },
    { titulo: 'Moira, 68000 de Dirk W. Hoffmann (MIT)', url: 'https://github.com/dirkwhoffmann/Moira', uso: '68000 ciclo a ciclo.' },
    { titulo: 'Damien Ciabrini, ngdevkit: nullbios (LGPL-3.0+)', url: 'https://github.com/dciabrin/ngdevkit', uso: 'nullbios (carpeta nullbios, commit 5106cbd): ROM del sistema libre con la que arranca «Un juego de verdad» (en vez de la de SNK, que no se puede distribuir).' },
    { titulo: 'Damien Ciabrini, ngdevkit-examples: 05-scrolling (LGPL-3.0+)', url: 'https://github.com/dciabrin/ngdevkit-examples', uso: '«Un juego de verdad» (05-scrolling, commit 4e7900b): paralaje con 78 sprites; compilado con contenido/consolas_juegos/neogeo/construir.sh.' },
    { titulo: 'ansimuz, «Country side platform tiles» (CC0)', url: 'https://opengameart.org/content/country-side-platform-tiles', uso: 'Fondos de «Un juego de verdad».' },
  ],
};

export default adaptador;
