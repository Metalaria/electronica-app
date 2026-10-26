// «Un fotograma» of the NES (NES-CPU-11 schematic of OpenTendo, board OpenTendo v1.4): which nets every bus access
// moves. CPU bus: A0–A15 and R/W from the 2A03 (U6), D0–D7 from whoever answers, /ROMSEL, WRAM /CE and PPU /CE from
// the 74HC139 (U3) (NESdev Wiki, «CPU pin-out», «74139»). PPU bus: in the first dot of every fetch the 2C02 (U5)
// puts the low address byte on AD0–AD7 with ALE high and the 74HC373 (U2) latches it onto PA0–PA7; in the second
// dot /RD goes low and CHR-ROM (cartridge) or CIRAM (U4) drives AD0–AD7 (NESdev, «PPU pin-out», «PPU rendering»).

import des6502 from '../cpu/6502';
import { bus, linea, nombres } from '../redes';
import type { AccesoBus, Adaptador, RedActiva } from '../tipos';

const A = nombres('/CPU-A', 16);
const D = nombres('/CPU-D', 8);
const PA_BAJA = nombres('/PPU-A', 8); // latch outputs PA0–PA7
const PA_ALTA = ['/PPU-A8', '/PPU-A9', '/PPU-A10', '/PPU-A11', '/PPU-A12', '/PPU-A13'];
const AD = nombres('/PPU-D', 8);
const RW = '/CPU-R~{W}';

const QUIEN: Record<string, string> = { wram: 'U1', ppu: 'U5', prg: 'P1', mandos: 'U7', apu: 'U6' };

function accesoCpu(ev: AccesoBus, out: RedActiva[]): void {
  const escritura = !!(ev.f & 1);
  bus(out, A, ev.a, 'direccion', 'U6');
  linea(out, RW, escritura ? 0 : 1, 'control', 'U6');
  const interno = !!(ev.f & 32);
  if (!interno) bus(out, D, ev.d, 'datos', escritura ? 'U6' : QUIEN[ev.c] ?? 'U6');
  // M2 is high in the second half of the cycle; the 74HC139 decodes A13–A15 while M2 is high
  const m2 = ev.fase >= 1.5 ? 1 : 0;
  linea(out, '/M2', m2 as 0 | 1, 'reloj', 'U6');
  if (ev.c === 'prg') linea(out, '/~{ROMSEL}', m2 ? 0 : 1, 'seleccion', 'U3');
  else if (ev.c === 'wram') linea(out, '/WRAM-~{CE}', m2 ? 0 : 1, 'seleccion', 'U3');
  else if (ev.c === 'ppu') linea(out, '/PPU-~{CE}', m2 ? 0 : 1, 'seleccion', 'U3');
  else if (ev.c === 'mandos') linea(out, ev.a === 0x4016 ? '/~{OE1}' : '/~{OE2}', 0, 'seleccion', 'U6');
}

function accesoPpu(ev: AccesoBus, out: RedActiva[]): void {
  if (ev.f & 32) return; // palette RAM: inside the PPU
  const escritura = !!(ev.f & 1);
  const a = ev.a;
  bus(out, PA_ALTA, a >> 8, 'direccion', 'U5');
  if (ev.fase < 1) {
    // first dot: address on AD0–AD7, ALE high, the latch follows
    linea(out, '/ALE', 1, 'control', 'U5');
    bus(out, AD, a & 0xff, 'direccion', 'U5');
    bus(out, PA_BAJA, a & 0xff, 'direccion', 'U2');
  } else {
    // second dot: the latch holds PA0–PA7, the memory drives the data
    linea(out, '/ALE', 0, 'control', 'U5');
    bus(out, PA_BAJA, a & 0xff, 'direccion', 'U2');
    bus(out, AD, ev.d, 'datos', escritura ? 'U5' : ev.c === 'chr' ? 'P1' : 'U4');
    linea(out, escritura ? '/PPU-~{WE}' : '/PPU-~{RD}', 0, 'control', 'U5');
  }
  if (ev.c === 'ciram') {
    linea(out, '/VRAM-~{CE}', 0, 'seleccion', 'P1');
    linea(out, '/VRAM-A10', ((a >> 10) & 1) as 0 | 1, 'direccion', 'P1');
  }
  linea(out, '/PPU-~{A13}', a & 0x2000 ? 0 : 1, 'seleccion', 'U5');
}

export const adaptador: Adaptador = {
  maquina: 'nes',
  cpus: { cpu: des6502 },
  redesAcceso(b, ev, out) {
    if (b === 'cpu') accesoCpu(ev, out);
    else if (b === 'ppu') accesoPpu(ev, out);
  },
  redesSenal(s, nivel, out) {
    if (s === 'nmi') linea(out, '/~{NMI}', nivel as 0 | 1, 'interrupcion', 'U5');
    else if (s === 'dma' && nivel) linea(out, RW, null, 'dma', 'U6');
  },
  redesPixel(_c, out) {
    linea(out, '/VIDEO', null, 'video', 'U5');
  },
  relojes: [
    { red: '/SYSTEM-CLK', grupo: 'reloj', nivel: null, desde: 'X1' },
    { red: '/CPU-CLK', grupo: 'reloj', nivel: null },
    { red: '/PPU-CLK', grupo: 'reloj', nivel: null },
  ],
  chips: { wram: ['U1'], ppu: ['U5'], apu: ['U6'], mandos: ['U7', 'U8'], prg: ['P1'], chr: ['P1'], ciram: ['U4'], paleta: ['U5'] },
  avisoPlaca:
    'La placa es la recreación OpenTendo de la NES-CPU-11 (las mismas referencias y redes que el esquema); la foto de la pestaña «Foto» es de una NES-CPU-07, con el mismo circuito.',
  fases: {
    visible: 'La PPU saca un píxel por punto y, cada 8 puntos, lee el número de tesela, el atributo y los dos planos de la siguiente.',
    sprites: 'Con la búsqueda de sprites hecha, la PPU lee los planos de los hasta 8 sprites de la línea siguiente.',
    precarga: 'Lee las dos primeras teselas de la línea siguiente para tener los registros de desplazamiento llenos.',
    relleno: 'Dos lecturas de la tabla de nombres que no se usan; el punto 0 es ocioso.',
    postrender: 'Línea 240: la PPU no lee nada; la CPU sigue con su bucle.',
    vblank: 'Borrado vertical: la PPU pone la bandera de VBlank y baja /NMI. La CPU puede escribir en la VRAM.',
    prerender: 'Línea de preparación: borra las banderas, recarga el desplazamiento vertical y lee como una línea normal.',
  },
  mapa: [
    { desde: 0x0000, hasta: 0x1fff, chip: 'wram', titulo: 'WRAM 2 KB (U1) y sus espejos' },
    { desde: 0x2000, hasta: 0x3fff, chip: 'ppu', titulo: 'Registros de la PPU (U5), cada 8 bytes' },
    { desde: 0x4000, hasta: 0x401f, chip: 'apu', titulo: 'APU, DMA y mandos (dentro del 2A03)' },
    { desde: 0x4020, hasta: 0x7fff, chip: 'nada', titulo: 'Cartucho (sin uso en NROM)' },
    { desde: 0x8000, hasta: 0xffff, chip: 'prg', titulo: 'PRG-ROM del cartucho (/ROMSEL)' },
  ],
  hojaInicial: 0,
  fidelidad:
    'Exacto: cada ciclo de bus de la CPU (dirección, dato, lectura o escritura, ciclos fantasma y los 513 o 514 del DMA de OAM) del núcleo 6502 validado con SingleStepTests y nestest; cada lectura de la PPU en su punto, 2 puntos por lectura con ALE en el primero; el píxel de cada punto; la NMI. El cuadro de la demostración y el de robotfindskitten coinciden píxel a píxel con los de jsnes (240 × 224 píxeles: jsnes oculta un borde de 8). Ilustrativo: M2 dibujado en la segunda mitad del ciclo (su flanco real cae a 5/8 del ciclo), las selecciones de chip durante toda esa mitad y los sincronismos del vídeo compuesto (posiciones de la wiki de NESdev).',
  fuentes: [
    { titulo: 'NESdev Wiki: «PPU rendering» y «PPU frame timing»', url: 'https://www.nesdev.org/wiki/PPU_rendering', uso: 'Orden y punto de cada lectura de la PPU, VBlank, línea de preparación y cuadros impares.' },
    { titulo: 'NESdev Wiki: «PPU scrolling»', url: 'https://www.nesdev.org/wiki/PPU_scrolling', uso: 'Registros v, t, x y w y sus incrementos.' },
    { titulo: 'NESdev Wiki: «PPU pin-out and signal description»', url: 'https://www.nesdev.org/wiki/PPU_pinout', uso: 'Bus multiplexado AD0–AD7, ALE, /RD, /WE.' },
    { titulo: 'NESdev Wiki: «CPU pin-out and signal description» y «DMA»', url: 'https://www.nesdev.org/wiki/CPU_pinout', uso: 'M2, R/W, /ROMSEL y el DMA de OAM.' },
    { titulo: 'NESdev Wiki: «NTSC video»', url: 'https://www.nesdev.org/wiki/NTSC_video', uso: 'Sincronismos y colores de la paleta.' },
    { titulo: 'SingleStepTests 65x02 (Tom Harte), MIT', url: 'https://github.com/SingleStepTests/65x02', uso: 'Validación del 6502 ciclo a ciclo.' },
    { titulo: 'nestest (kevtris)', url: 'https://github.com/christopherpow/nes-test-roms', uso: 'Validación del 6502 por instrucciones.' },
    { titulo: 'jsnes (Ben Firshman), Apache-2.0', url: 'https://github.com/bfirsh/jsnes', uso: 'Contraste del cuadro final con otro emulador.' },
  ],
};

export default adaptador;
