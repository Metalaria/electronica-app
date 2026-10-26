// «Un fotograma» of the Game Boy (DMG-CPU-06, Gekkio's schematic) and the Game Boy Color (CGB-CPU-04, Natalie the
// Nerd's schematic): which nets every bus access moves. Cartridge bus: A0–A15 from the SoC (U1), /RD low on reads,
// /WR low on writes, D0–D7 from whoever answers (GBCTR appendix C, Pan Docs «Memory Map»). DMG: the VRAM is a chip on
// the board (U2) on MA0–MA12 / MD0–MD7 with /MCS, /MRD, /MWR, and the WRAM (U3) shares the cartridge bus with /CS.
// CGB: the VRAM is inside the SoC; the WRAM (U2, 32 KB) has the MA/MD bus with CS1, MRD, MWR and RA0–RA1.

import desSm83 from './cpu/sm83';
import { bus, linea, nombres } from './redes';
import type { AccesoBus, Adaptador, RedActiva } from './tipos';

export function crearAdaptadorGb(cgb: boolean): Adaptador {
  const A = nombres('/A', 16);
  const D = nombres('/D', 8);
  const RD = cgb ? '/RD' : '/~{RD}';
  const WR = cgb ? '/WR' : '/~{WR}';
  const CS = cgb ? '/CS' : '/~{CS}';
  // DMG VRAM bus / CGB WRAM bus
  const MA = cgb ? nombres('Net-(U1B-MA', 13, ')') : nombres('/MA', 13);
  const MD = cgb ? nombres('Net-(U1B-MD', 8, ')') : nombres('/MD', 8);
  const MCS = cgb ? 'Net-(U1B-CS1)' : '/~{MCS}';
  const MRD = cgb ? 'Net-(U1B-MRD)' : '/~{MRD}';
  const MWR = cgb ? 'Net-(U1B-MWR)' : '/~{MWR}';
  const RA = ['Net-(U1B-RA0)', 'Net-(U1B-RA1)'];
  const RAM_W = cgb ? 'U2' : 'U3';

  /** External cartridge-bus cycle (GBCTR fig. C.8–C.10: /RD low except on writes, /WR low in the middle of writes). */
  function cartucho(ev: AccesoBus, out: RedActiva[], desdeDato: string): void {
    const escritura = !!(ev.f & 1);
    bus(out, A, ev.a, 'direccion', 'U1');
    linea(out, RD, escritura ? 1 : 0, 'control', 'U1');
    const fase = ev.fase / 4; // fraction of the machine cycle
    linea(out, WR, escritura && fase >= 0.5 && fase < 0.875 ? 0 : 1, 'control', 'U1');
    if (!escritura || fase >= 0.5) bus(out, D, ev.d, 'datos', escritura ? 'U1' : desdeDato);
    const sel = ev.c === 'sram' || (!cgb && ev.c === 'wram');
    if (sel) linea(out, CS, fase >= 0.25 ? 0 : 1, 'seleccion', 'U1');
  }

  /** CGB WRAM bus: offset in the 32 KB from the address and the bank (RA0–RA1 = bank bits 1–2). */
  function wramCgb(ev: AccesoBus, out: RedActiva[]): void {
    const escritura = !!(ev.f & 1);
    const off = ev.a & 0x1fff;
    bus(out, MA, off, 'direccion', 'U1');
    linea(out, MCS, 0, 'seleccion', 'U1');
    linea(out, escritura ? MWR : MRD, 0, 'control', 'U1');
    bus(out, MD, ev.d, 'datos', escritura ? 'U1' : 'U2');
    void RA;
  }

  function accesoCpu(ev: AccesoBus, out: RedActiva[]): void {
    if (ev.f & 32) return; // inside the SoC: the pins do not move
    if (ev.c === 'rom' || ev.c === 'sram') cartucho(ev, out, 'P1');
    else if (ev.c === 'wram') {
      if (cgb) wramCgb(ev, out);
      else cartucho(ev, out, RAM_W);
    } else if (ev.c === 'vram' && !cgb) {
      // DMG: the CPU reaches the VRAM chip through the SoC's VRAM bus
      const escritura = !!(ev.f & 1);
      bus(out, MA, ev.a & 0x1fff, 'direccion', 'U1');
      bus(out, MD, ev.d, 'datos', escritura ? 'U1' : 'U2');
      linea(out, MCS, 0, 'seleccion', 'U1');
      linea(out, escritura ? MWR : MRD, 0, 'control', 'U1');
    }
  }

  function accesoVram(ev: AccesoBus, out: RedActiva[]): void {
    if (cgb || ev.f & 32 || ev.k === 'cpu') return; // CGB: inside the SoC; OAM: inside; CPU accesses: on the cpu bus
    // a PPU read of the VRAM chip: address on MA, /MCS and /MRD low, the chip drives MD
    bus(out, MA, ev.a & 0x1fff, 'direccion', 'U1');
    linea(out, MCS, 0, 'seleccion', 'U1');
    linea(out, MRD, 0, 'control', 'U1');
    if (ev.fase >= 1) bus(out, MD, ev.d, 'datos', 'U2');
  }

  function accesoDma(ev: AccesoBus, out: RedActiva[]): void {
    if (ev.f & 32) return;
    const r: RedActiva[] = [];
    if (ev.c === 'wram' && cgb) wramCgb(ev, r);
    else if (ev.c === 'rom' || ev.c === 'sram' || ev.c === 'wram') cartucho(ev, r, ev.c === 'wram' ? RAM_W : 'P1');
    // the DMA owns the bus: drawn in the DMA colour for the address and control lines
    for (const x of r) out.push(x.grupo === 'datos' ? x : { ...x, grupo: 'dma' });
  }

  const LCD = cgb
    ? { cp: ['/CGB_Screen/DCK'], cpl: ['/CGB_Screen/SPL', '/CGB_Screen/LP'], st: ['/CGB_Screen/SPS'], fr: ['/CGB_Screen/MOD'] }
    : { cp: ['/CP', '/DMG-LCD-06/CP'], cpl: ['/CPL', '/ST', '/DMG-LCD-06/CPL'], st: ['/S', '/DMG-LCD-06/S'], fr: ['/FR', '/DMG-LCD-06/FR'] };
  const LD = cgb ? null : [['/LD0', '/DMG-LCD-06/LD0'], ['/LD1', '/DMG-LCD-06/LD1']];
  const RGB = cgb ? (['R', 'G', 'B'] as const).map((c) => nombres(`/CGB_Screen/LD${c}`, 6)) : null;

  return {
    maquina: cgb ? 'gbc' : 'gb',
    cpus: { cpu: desSm83 },
    redesAcceso(b, ev, out) {
      if (b === 'cpu') accesoCpu(ev, out);
      else if (b === 'vram') accesoVram(ev, out);
      else if (b === 'dma') accesoDma(ev, out);
    },
    redesSenal(s, nivel, out) {
      const lista = (LCD as Record<string, string[]>)[s];
      if (lista) for (const r of lista) linea(out, r, nivel as 0 | 1, 'video', 'U1');
    },
    redesPixel(c, out) {
      if (LD) {
        // DMG: the shade (0–3) on LD0/LD1 (the LCD shows 3 = darkest)
        linea(out, LD[0]![0]!, (c & 1) as 0 | 1, 'video', 'U1');
        linea(out, LD[0]![1]!, (c & 1) as 0 | 1, 'video', 'J2');
        linea(out, LD[1]![0]!, ((c >> 1) & 1) as 0 | 1, 'video', 'U1');
        linea(out, LD[1]![1]!, ((c >> 1) & 1) as 0 | 1, 'video', 'J2');
      } else if (RGB) {
        // CGB: 5 bits per channel, sent as 6 (the LCD's LD?0 is the extra low bit: drawn as a copy of bit 4)
        const ch = [c & 31, (c >> 5) & 31, (c >> 10) & 31];
        for (let k = 0; k < 3; k++) bus(out, RGB[k]!, (ch[k]! << 1) | (ch[k]! >> 4), 'video', 'U1');
      }
    },
    relojes: cgb
      ? [
          { red: 'Net-(U1A-XTAL1)', grupo: 'reloj', nivel: null, desde: 'X1' },
          { red: 'Net-(P1-Pin_2)', grupo: 'reloj', nivel: null, desde: 'U1' },
        ]
      : [
          { red: 'Net-(U1-CK1)', grupo: 'reloj', nivel: null, desde: 'X1' },
          { red: '/PHI', grupo: 'reloj', nivel: null, desde: 'U1' },
        ],
    chips: cgb
      ? { rom: ['P1'], sram: ['P1'], wram: ['U2'], vram: ['U1'], oam: ['U1'], io: ['U1'], hram: ['U1'] }
      : { rom: ['P1'], sram: ['P1'], wram: ['U3'], vram: ['U2'], oam: ['U1'], io: ['U1'], hram: ['U1'] },
    avisoPlaca: cgb
      ? 'La placa es la CGB-CPU-04 de los Gerber de Natalie the Nerd, la misma que el esquema: el cobre, con cada pad en su red. En la Game Boy Color la VRAM y la OAM están dentro de la CPU, así que las lecturas de la PPU no salen a la placa: por fuera solo se ven el bus del cartucho, el de la WRAM y la pantalla.'
      : 'La Game Boy no tiene placa en 3D (Gekkio solo publica los esquemas), pero sí el escaneo del cobre de la DMG-CPU-06 con el nombre de cada pista: el recorrido se ve sobre ese cobre real y sobre el esquema.',
    fases: {
      modo2: 'La PPU recorre la OAM: compara la Y de los 40 sprites con la línea y se queda con hasta 10.',
      modo3: 'La FIFO de píxeles: el buscador lee de la VRAM el número de tesela y sus dos planos y cada punto sale un píxel hacia la pantalla. Los sprites detienen la FIFO.',
      modo0: 'Borrado horizontal: la PPU espera al final de la línea; la CPU puede usar la VRAM.',
      modo1: 'Borrado vertical: diez líneas sin dibujo; la interrupción VBlank despierta a la CPU.',
      apagada: 'Pantalla apagada: la PPU no lee nada.',
    },
    mapa: [
      { desde: 0x0000, hasta: 0x7fff, chip: 'rom', titulo: 'ROM del cartucho' },
      { desde: 0x8000, hasta: 0x9fff, chip: 'vram', titulo: cgb ? 'VRAM (dentro de la CPU, 2 bancos)' : 'VRAM (U2, bus MA/MD)' },
      { desde: 0xa000, hasta: 0xbfff, chip: 'sram', titulo: 'RAM del cartucho (/CS)' },
      { desde: 0xc000, hasta: 0xdfff, chip: 'wram', titulo: cgb ? 'WRAM (U2, bus MA/MD, 8 bancos)' : 'WRAM (U3, bus del cartucho con /CS)' },
      { desde: 0xfe00, hasta: 0xfe9f, chip: 'oam', titulo: 'OAM (dentro de la CPU)' },
      { desde: 0xff00, hasta: 0xff7f, chip: 'io', titulo: 'Registros de E/S' },
      { desde: 0xff80, hasta: 0xfffe, chip: 'hram', titulo: 'HRAM (dentro de la CPU)' },
    ],
    hojaInicial: 0,
    fidelidad: cgb
      ? 'Exacto: cada ciclo de máquina de la CPU (núcleo SM83 validado con SingleStepTests y las ROM de blargg), el DMA de OAM, los bloques del HDMA (2 bytes por ciclo con la CPU parada), las lecturas de la PPU en la VRAM y la OAM y el píxel de cada punto (FIFO de Pan Docs). El cuadro de la demostración coincide con el de PyBoy salvo los 360 píxeles del agua que anima el HDMA de borrado horizontal, que PyBoy 2.8 no ejecuta. En Tobu Tobu Girl Deluxe las pantallas que no dependen del azar (logotipos, escena inicial, título, menú) coinciden píxel a píxel con PyBoy; el cuadro de juego grabado difiere en 417 píxeles (murciélagos y barra lateral) porque el juego siembra su azar con DIV al pulsar START (title.c, initrand(DIV_REG)) y DIV depende de la ROM de arranque, que en PyBoy es otra. Ilustrativo: la forma de /RD, /WR y /CS dentro del ciclo (la de la DMG según GBCTR), el reparto de los 5 bits de color en las 6 líneas por canal de la pantalla y la temporización de DCK, SPL, SPS y MOD, que no está publicada.'
      : 'Exacto: cada ciclo de máquina de la CPU (núcleo SM83 validado con SingleStepTests y las ROM de blargg cpu_instrs, instr_timing y mem_timing), el DMA de OAM, cada lectura de la PPU en la VRAM (U2) y la OAM y el píxel de cada punto, con la FIFO de Pan Docs (modo 3 de 172 puntos más las paradas de los sprites). Los cuadros de la demostración y de Libbet coinciden píxel a píxel con los de PyBoy. Ilustrativo: la forma de /RD, /WR y /CS dentro del ciclo (GBCTR, figuras C.8–C.10) y la temporización de CP, CPL, ST, S y FR hacia la pantalla, que no está publicada.',
    fuentes: [
      { titulo: 'Pan Docs: «Rendering», «Pixel FIFO», «OAM DMA Transfer», «LCD VRAM DMA Transfers»', url: 'https://gbdev.io/pandocs/', uso: 'Modos de la PPU, la FIFO, la duración del modo 3, el DMA de OAM y el HDMA.' },
      { titulo: 'Gekkio, «Game Boy: Complete Technical Reference» (GBCTR)', url: 'https://gekkio.fi/files/gb-docs/gbctr.pdf', uso: 'Ciclos de máquina de cada instrucción y forma de los ciclos del bus externo.' },
      { titulo: 'SingleStepTests sm83, MIT', url: 'https://github.com/SingleStepTests/sm83', uso: 'Validación del SM83 ciclo a ciclo.' },
      { titulo: "blargg's Game Boy test ROMs", url: 'https://github.com/retrio/gb-test-roms', uso: 'Validación: cpu_instrs, instr_timing, mem_timing.' },
      { titulo: 'PyBoy (Mads Ynddal y colaboradores), LGPL-3.0', url: 'https://github.com/Baekalfen/PyBoy', uso: 'Contraste del cuadro final con otro emulador.' },
    ],
  };
}
