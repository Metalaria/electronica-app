// Game Boy (DMG-CPU-0x) and Game Boy Color (CGB-CPU-0x) for the «Un fotograma» traces: the SM83 (sm83.mjs) on the
// SoC's buses — the cartridge bus (A0–A15, D0–D7, /RD, /WR, /CS), the VRAM bus (MA/MD, external on the DMG, inside
// the SoC on the CGB) and, on the CGB, the WRAM bus (MA/MD to the external WRAM) — the timer, interrupts, OAM DMA,
// CGB HDMA, VRAM/WRAM banks and palettes, and a dot-level PPU: OAM scan (mode 2), the pixel FIFO with its
// background fetcher and sprite fetches (mode 3, variable length), HBlank (mode 0), VBlank (mode 1), STAT/LYC.
// Timing from Pan Docs («Rendering», «Pixel FIFO», «OAM DMA Transfer», «LCD VRAM DMA Transfers», «Timer and
// Divider Registers», «Interrupts», «CGB Registers») and Gekkio's «Game Boy: Complete Technical Reference».
//
// Time unit: one dot (4 194 304 Hz). A machine cycle is 4 dots (2 in CGB double speed).
// The boot ROMs (Nintendo's) are not used: the run starts at $0100 with the registers and I/O they leave.

import { Sm83 } from './sm83.mjs';

export const F_ESCRITURA = 1;
export const F_FANTASMA = 4;
export const F_DMA = 8;
export const F_INTERNO = 32;

export const CHIPS_CPU = [
  { id: 'rom', titulo: 'ROM del cartucho (P1)' },
  { id: 'sram', titulo: 'RAM del cartucho (P1, /CS)' },
  { id: 'wram', titulo: 'WRAM' },
  { id: 'vram', titulo: 'VRAM' },
  { id: 'oam', titulo: 'OAM (dentro del SoC)' },
  { id: 'io', titulo: 'Registros de E/S (dentro del SoC)' },
  { id: 'hram', titulo: 'HRAM (dentro del SoC)' },
  { id: 'nada', titulo: 'Ningún acceso (ciclo interno)' },
];
export const CHIPS_VRAM = [
  { id: 'vram', titulo: 'VRAM' },
  { id: 'oam', titulo: 'OAM' },
];
export const TIPOS_VRAM = [
  { id: 'mapa', titulo: 'Mapa del fondo (número de tesela)' },
  { id: 'bg-bajo', titulo: 'Tesela del fondo, plano bajo' },
  { id: 'bg-alto', titulo: 'Tesela del fondo, plano alto' },
  { id: 'atrib', titulo: 'Atributos del fondo (banco 1 de la VRAM, CGB)' },
  { id: 'oam-y', titulo: 'Búsqueda en la OAM: Y y X del sprite' },
  { id: 'spr-bajo', titulo: 'Tesela de sprite, plano bajo' },
  { id: 'spr-alto', titulo: 'Tesela de sprite, plano alto' },
  { id: 'cpu', titulo: 'Acceso de la CPU' },
  { id: 'hdma', titulo: 'Escritura del HDMA (CGB)' },
  { id: 'dma', titulo: 'Escritura del DMA de OAM' },
];
const CC = Object.fromEntries(CHIPS_CPU.map((x, i) => [x.id, i]));
const KV = Object.fromEntries(TIPOS_VRAM.map((x, i) => [x.id, i]));

export const FASES = [
  { id: 'modo2', titulo: 'Modo 2: búsqueda en la OAM (80 puntos)' },
  { id: 'modo3', titulo: 'Modo 3: la FIFO de píxeles envía la línea a la pantalla' },
  { id: 'modo0', titulo: 'Modo 0: borrado horizontal (HBlank)' },
  { id: 'modo1', titulo: 'Modo 1: borrado vertical (VBlank, líneas 144–153)' },
  { id: 'apagada', titulo: 'Pantalla apagada (LCDC bit 7 = 0)' },
];
const FK = Object.fromEntries(FASES.map((x, i) => [x.id, i]));

export const SENALES = [
  { id: 'int-vblank', titulo: 'Interrupción VBlank (IF bit 0)' },
  { id: 'int-stat', titulo: 'Interrupción STAT (IF bit 1)' },
  { id: 'int-timer', titulo: 'Interrupción del temporizador (IF bit 2)' },
  { id: 'dma', titulo: 'DMA de OAM en curso' },
  { id: 'hdma', titulo: 'HDMA en curso (CGB): la CPU espera' },
  { id: 'halt', titulo: 'CPU en HALT' },
  { id: 'cpl', titulo: 'CPL / SPL: fin de línea hacia la pantalla' },
  { id: 'st', titulo: 'ST / SPS: principio de cuadro hacia la pantalla' },
  { id: 'fr', titulo: 'FR / MOD: polaridad alterna de la pantalla' },
  { id: 'cp', titulo: 'CP / DCK: reloj de píxel (activo mientras salen píxeles)' },
];
const SK = Object.fromEntries(SENALES.map((x, i) => [x.id, i]));

export class GameBoy {
  constructor(rom, registro, { cgb = false } = {}) {
    this.rom = rom;
    this.reg = registro;
    this.cgb = cgb;
    this.tipoCart = rom[0x147];
    this.nRom = Math.max(2, rom.length >> 14);
    this.bancoRom = 1;
    this.bancoRam = 0;
    this.ramOn = false;
    this.modoMbc1 = 0;
    this.sram = new Uint8Array(0x8000);
    this.vram = new Uint8Array(cgb ? 0x4000 : 0x2000);
    this.bancoVram = 0;
    this.wram = new Uint8Array(cgb ? 0x8000 : 0x2000);
    this.bancoWram = 1;
    this.oam = new Uint8Array(160);
    this.hram = new Uint8Array(127);
    this.io = new Uint8Array(128);
    this.ie = 0;
    this.t = 0;
    this.div = 0xabcc; // internal 16-bit divider (DIV = its high byte)
    this.serie = '';
    // palettes (CGB)
    this.palBg = new Uint8Array(64).fill(0xff);
    this.palObj = new Uint8Array(64).fill(0xff);
    this.bcps = 0;
    this.ocps = 0;
    // DMA
    this.dmaFuente = -1;
    this.dmaI = 0;
    this.dmaRetardo = 0;
    this.hdma = { fuente: 0, destino: 0, bloques: 0, activa: false, hblank: false };
    this.hdmaPendiente = false;
    // PPU
    this.ly = 0;
    this.punto = 0;
    this.modo = 2;
    this.lcdcPrev = 0;
    this.fb = new Uint16Array(160 * 144);
    this.cuadros = 0;
    this.vblanks = 0;
    this.lineaVentana = 0;
    this.statLinea = false;
    this.fr = 0;
    this.cpu = new Sm83({
      leer: (a, f) => this.leerCpu(a, f),
      escribir: (a, v, f) => this.escribirCpu(a, v, f),
      interno: (f) => this.cicloInterno(f),
    });
    this.cpu.pendientes = () => this.ie & this.io[0x0f] & 0x1f;
    this.cpu.aceptar = (bit) => {
      this.io[0x0f] &= ~(1 << bit);
      if (bit <= 2) this.reg.senal(this.t, [SK['int-vblank'], SK['int-stat'], SK['int-timer']][bit], 0);
    };
    // A monochrome-only game (header $0143 bit 7 = 0) on a CGB runs in DMG compatibility mode: BGP/OBP0/OBP1 index
    // into CGB palettes 0 (and 1 for objects) that the boot ROM fills; no attributes, no VRAM banks, DMG object
    // priority (Pan Docs «Power Up Sequence», «Compatibility palettes»).
    this.compat = cgb && !(rom[0x143] & 0x80);
    if (this.compat) this.paletasCompatibles();
    this.estadoTrasArranque();
  }

  /** Palettes ID $00 of the CGB boot ROM (a game whose licensee is not Nintendo): BG 7FFF 1BEF 6180 0000, OBJ0 and
   * OBJ1 7FFF 421F 1CF2 0000 (table of SameBoy's free reimplementation of the boot ROM, cgb_boot.asm). */
  paletasCompatibles() {
    const poner = (tabla, pal, colores) => colores.forEach((c, i) => {
      tabla[pal * 8 + i * 2] = c & 0xff;
      tabla[pal * 8 + i * 2 + 1] = c >> 8;
    });
    poner(this.palBg, 0, [0x7fff, 0x1bef, 0x6180, 0x0000]);
    poner(this.palObj, 0, [0x7fff, 0x421f, 0x1cf2, 0x0000]);
    poner(this.palObj, 1, [0x7fff, 0x421f, 0x1cf2, 0x0000]);
  }

  /** Registers and I/O as the boot ROM leaves them (Pan Docs «Power Up Sequence»). */
  estadoTrasArranque() {
    const c = this.cpu;
    if (this.cgb) Object.assign(c, { a: 0x11, f: 0x80, b: 0x00, c: 0x00, d: 0xff, e: 0x56, h: 0x00, l: 0x0d });
    else Object.assign(c, { a: 0x01, f: 0xb0, b: 0x00, c: 0x13, d: 0x00, e: 0xd8, h: 0x01, l: 0x4d });
    c.sp = 0xfffe;
    c.pc = 0x0100;
    const io = this.io;
    io[0x00] = 0xcf;
    io[0x0f] = 0xe1;
    io[0x40] = 0x91; // LCDC: on, BG on, tiles at $8000
    io[0x41] = 0x85;
    io[0x47] = 0xfc; // BGP
    io[0x48] = 0xff;
    io[0x49] = 0xff;
    this.lcdcPrev = 0x91;
    // the boot ROM hands over at the start of a frame's VBlank
    this.ly = 144;
    this.punto = 0;
    this.modo = 1;
  }

  // ---------------------------------------------------------------- the cartridge (ROM only, MBC1, MBC3, MBC5)

  leerRom(a) {
    if (a < 0x4000) return this.rom[a] ?? 0xff;
    return this.rom[((this.bancoRom % this.nRom) << 14) | (a & 0x3fff)] ?? 0xff;
  }

  escribirMbc(a, v) {
    const t = this.tipoCart;
    if (t === 0) return;
    if (a < 0x2000) this.ramOn = (v & 0x0f) === 0x0a;
    else if (a < 0x4000) {
      if (t >= 0x19 && t <= 0x1e) {
        if (a < 0x3000) this.bancoRom = (this.bancoRom & 0x100) | v;
        else this.bancoRom = (this.bancoRom & 0xff) | ((v & 1) << 8);
      } else if (t >= 0x0f && t <= 0x13) this.bancoRom = v & 0x7f || 1;
      else this.bancoRom = (this.bancoRom & 0x60) | (v & 0x1f || 1);
    } else if (a < 0x6000) this.bancoRam = v & 0x0f;
    else this.modoMbc1 = v & 1;
  }

  // ---------------------------------------------------------------- the CPU's machine cycles

  chip(a) {
    if (a < 0x8000) return CC.rom;
    if (a < 0xa000) return CC.vram;
    if (a < 0xc000) return CC.sram;
    if (a < 0xfe00) return CC.wram;
    if (a < 0xfea0) return CC.oam;
    if (a < 0xff00) return CC.nada;
    if (a < 0xff80 || a === 0xffff) return CC.io;
    return CC.hram;
  }

  /** Flags for the board: internal accesses do not drive the pins (VRAM is external on the DMG). */
  interno(c) {
    if (c === CC.oam || c === CC.io || c === CC.hram || c === CC.nada) return F_INTERNO;
    if (c === CC.vram && this.cgb) return F_INTERNO;
    return 0;
  }

  leerCpu(a, f) {
    const c = this.chip(a);
    const v = this.leer(a);
    this.reg.bus('cpu', this.t, a, v, f | this.interno(c), c);
    if (c === CC.vram) this.reg.bus('vram', this.t, (a & 0x1fff) | (this.cgb ? this.bancoVram << 13 : 0), v, 0, 0, KV.cpu);
    this.avanzarCiclo();
    return v;
  }

  escribirCpu(a, v, f) {
    const c = this.chip(a);
    this.reg.bus('cpu', this.t, a, v, f | F_ESCRITURA | this.interno(c), c);
    if (c === CC.vram) this.reg.bus('vram', this.t, (a & 0x1fff) | (this.cgb ? this.bancoVram << 13 : 0), v, F_ESCRITURA, 0, KV.cpu);
    this.escribir(a, v);
    this.avanzarCiclo();
  }

  cicloInterno(f) {
    // halted machine cycles are not recorded one by one (the «halt» signal covers them)
    if (!this.cpu.halt) this.reg.bus('cpu', this.t, this.cpu.pc, 0, f | F_INTERNO, CC.nada);
    this.avanzarCiclo();
  }

  leer(a) {
    if (this.dmaFuente >= 0 && this.dmaRetardo === 0 && !(a >= 0xff80 && a <= 0xfffe) && a < 0xff00) return 0xff; // OAM DMA bus conflict
    if (a < 0x8000) return this.leerRom(a);
    if (a < 0xa000) return this.modo === 3 && this.lcdOn() ? 0xff : this.vram[(this.bancoVram << 13) | (a & 0x1fff)];
    if (a < 0xc000) return this.ramOn ? this.sram[((this.bancoRam & 3) << 13) | (a & 0x1fff)] : 0xff;
    if (a < 0xfe00) return this.wram[this.dirWram(a)];
    if (a < 0xfea0) return this.modo >= 2 && this.lcdOn() ? 0xff : this.oam[a - 0xfe00];
    if (a < 0xff00) return 0;
    if (a === 0xffff) return this.ie;
    if (a >= 0xff80) return this.hram[a - 0xff80];
    return this.leerIo(a & 0x7f);
  }

  dirWram(a) {
    const o = a & 0x1fff;
    if (o < 0x1000) return o;
    const b = this.cgb ? this.bancoWram || 1 : 1;
    return (b << 12) | (o & 0xfff);
  }

  escribir(a, v) {
    if (a < 0x8000) return this.escribirMbc(a, v);
    if (a < 0xa000) {
      if (!(this.modo === 3 && this.lcdOn())) this.vram[(this.bancoVram << 13) | (a & 0x1fff)] = v;
      return;
    }
    if (a < 0xc000) {
      if (this.ramOn) this.sram[((this.bancoRam & 3) << 13) | (a & 0x1fff)] = v;
      return;
    }
    if (a < 0xfe00) {
      this.wram[this.dirWram(a)] = v;
      return;
    }
    if (a < 0xfea0) {
      if (!(this.modo >= 2 && this.lcdOn())) this.oam[a - 0xfe00] = v;
      return;
    }
    if (a < 0xff00) return;
    if (a === 0xffff) {
      this.ie = v;
      return;
    }
    if (a >= 0xff80) {
      this.hram[a - 0xff80] = v;
      return;
    }
    this.escribirIo(a & 0x7f, v);
  }

  leerIo(r) {
    const io = this.io;
    switch (r) {
      case 0x00: {
        // joypad matrix: P14 low selects the directions, P15 low the buttons (Pan Docs «Joypad Input»)
        const sel = io[0] & 0x30;
        let bajos = 0x0f;
        const b = this.botones ?? 0; // bits 0–3 right left up down, 4–7 A B select start
        if (!(sel & 0x10)) bajos &= ~(b & 0x0f);
        if (!(sel & 0x20)) bajos &= ~((b >> 4) & 0x0f);
        return 0xc0 | sel | bajos;
      }
      case 0x04: return this.div >> 8;
      case 0x0f: return io[0x0f] | 0xe0;
      case 0x41: return 0x80 | (io[0x41] & 0x78) | (this.ly === io[0x45] ? 4 : 0) | (this.lcdOn() ? this.modo : 0);
      case 0x44: return this.lcdOn() ? this.ly : 0;
      case 0x4f: return this.cgb ? 0xfe | this.bancoVram : 0xff;
      case 0x55: return this.cgb ? (this.hdma.activa ? (this.hdma.bloques - 1) & 0x7f : 0xff) : 0xff;
      case 0x68: return this.bcps;
      case 0x69: return this.palBg[this.bcps & 0x3f];
      case 0x6a: return this.ocps;
      case 0x6b: return this.palObj[this.ocps & 0x3f];
      case 0x70: return this.cgb ? 0xf8 | this.bancoWram : 0xff;
      default: return io[r];
    }
  }

  escribirIo(r, v) {
    const io = this.io;
    switch (r) {
      case 0x01:
        io[1] = v;
        return;
      case 0x02:
        io[2] = v;
        if ((v & 0x81) === 0x81) {
          // serial transfer with the internal clock: the byte goes out (blargg's tests print through it)
          this.serie += String.fromCharCode(io[1]);
          io[1] = 0xff;
          io[2] &= 0x7f;
          this.pedirInt(3);
        }
        return;
      case 0x04:
        this.cambiarDiv(0);
        return;
      case 0x0f:
        for (let bit = 0; bit <= 2; bit++) {
          if (((io[0x0f] ^ v) >> bit) & 1) this.reg.senal(this.t, [SK['int-vblank'], SK['int-stat'], SK['int-timer']][bit], (v >> bit) & 1);
        }
        io[0x0f] = v & 0x1f;
        return;
      case 0x40: {
        const antes = this.lcdOn();
        io[0x40] = v;
        if (antes && !this.lcdOn()) {
          this.ly = 0;
          this.punto = 0;
          this.modo = 0;
          this.reg.fase(this.t, FK.apagada, 0);
        } else if (!antes && this.lcdOn()) {
          this.ly = 0;
          this.punto = 4; // the first line after switching on is shorter (the PPU starts in mode 0)
          this.modo = 0;
          this.primerCuadro = true;
          this.reg.fase(this.t, FK.modo0, 0);
        }
        return;
      }
      case 0x41:
        io[0x41] = (io[0x41] & 0x87) | (v & 0x78);
        return;
      case 0x44:
        return;
      case 0x46:
        io[0x46] = v;
        this.dmaFuente = v << 8;
        this.dmaI = 0;
        this.dmaRetardo = 1;
        this.reg.senal(this.t, SK.dma, 1);
        return;
      case 0x4f:
        if (this.cgb && !this.compat) this.bancoVram = v & 1;
        return;
      case 0x51: this.hdma.fuente = (this.hdma.fuente & 0x00ff) | (v << 8); return;
      case 0x52: this.hdma.fuente = (this.hdma.fuente & 0xff00) | (v & 0xf0); return;
      case 0x53: this.hdma.destino = (this.hdma.destino & 0x00ff) | ((v & 0x1f) << 8); return;
      case 0x54: this.hdma.destino = (this.hdma.destino & 0xff00) | (v & 0xf0); return;
      case 0x55:
        if (!this.cgb) return;
        if (this.hdma.activa && !(v & 0x80)) {
          this.hdma.activa = false;
          return;
        }
        this.hdma.bloques = (v & 0x7f) + 1;
        this.hdma.hblank = !!(v & 0x80);
        this.hdma.activa = true;
        if (!this.hdma.hblank) {
          // general-purpose DMA: the CPU stops until every block is copied
          while (this.hdma.activa) this.bloqueHdma();
        }
        return;
      case 0x68: this.bcps = v; return;
      case 0x69:
        this.palBg[this.bcps & 0x3f] = v;
        if (this.bcps & 0x80) this.bcps = 0x80 | ((this.bcps + 1) & 0x3f);
        return;
      case 0x6a: this.ocps = v; return;
      case 0x6b:
        this.palObj[this.ocps & 0x3f] = v;
        if (this.ocps & 0x80) this.ocps = 0x80 | ((this.ocps + 1) & 0x3f);
        return;
      case 0x70:
        if (this.cgb) this.bancoWram = v & 7;
        return;
      default:
        io[r] = v;
    }
  }

  pedirInt(bit) {
    if (!(this.io[0x0f] & (1 << bit))) {
      this.io[0x0f] |= 1 << bit;
      if (bit <= 2) this.reg.senal(this.t, [SK['int-vblank'], SK['int-stat'], SK['int-timer']][bit], 1);
    }
  }

  // ---------------------------------------------------------------- timer

  cambiarDiv(nuevo) {
    const tac = this.io[0x07];
    if (tac & 4) {
      const bit = [9, 3, 5, 7][tac & 3];
      const antes = (this.div >> bit) & 1;
      const despues = (nuevo >> bit) & 1;
      if (antes && !despues) {
        this.io[0x05] = (this.io[0x05] + 1) & 0xff;
        if (this.io[0x05] === 0) {
          this.io[0x05] = this.io[0x06];
          this.pedirInt(2);
        }
      }
    }
    this.div = nuevo & 0xffff;
  }

  /** One machine cycle of everything but the CPU: DMA, timer, PPU (4 dots). */
  avanzarCiclo() {
    if (this.dmaFuente >= 0) {
      if (this.dmaRetardo > 0) this.dmaRetardo--;
      else {
        const a = this.dmaFuente + this.dmaI;
        const fuente = a >= 0xe000 ? a - 0x2000 : a;
        const c = this.chip(fuente);
        const v = fuente < 0x8000 ? this.leerRom(fuente) : fuente < 0xa000 ? this.vram[(this.bancoVram << 13) | (fuente & 0x1fff)] : fuente < 0xc000 ? 0xff : this.wram[this.dirWram(fuente)];
        this.reg.bus('dma', this.t, fuente, v, F_DMA | this.interno(c), c);
        this.reg.bus('vram', this.t, 0xfe00 + this.dmaI, v, F_ESCRITURA | F_DMA | F_INTERNO, 1, KV.dma);
        this.oam[this.dmaI] = v;
        this.dmaI++;
        if (this.dmaI >= 160) {
          this.dmaFuente = -1;
          this.reg.senal(this.t + 4, SK.dma, 0);
        }
      }
    }
    this.cambiarDiv(this.div + 4);
    for (let i = 0; i < 4; i++) this.puntoPpu();
    if (this.hdmaPendiente) {
      this.hdmaPendiente = false;
      this.bloqueHdma();
    }
  }

  /** One 16-byte HDMA block: 8 machine cycles in normal speed with the CPU stopped (Pan Docs). */
  bloqueHdma() {
    const h = this.hdma;
    this.reg.senal(this.t, SK.hdma, 1);
    for (let i = 0; i < 16; i++) {
      const a = h.fuente;
      const c = this.chip(a);
      const v = a < 0x8000 ? this.leerRom(a) : a >= 0xc000 && a < 0xe000 ? this.wram[this.dirWram(a)] : a >= 0xa000 && a < 0xc000 ? this.sram[a & 0x1fff] : 0xff;
      const d = 0x8000 | (h.destino & 0x1ff0) | (h.destino & 0xf);
      this.reg.bus('dma', this.t, a, v, F_DMA | this.interno(c), c);
      this.reg.bus('vram', this.t, (d & 0x1fff) | (this.bancoVram << 13), v, F_ESCRITURA | F_DMA | F_INTERNO, 0, KV.hdma);
      this.vram[(this.bancoVram << 13) | (d & 0x1fff)] = v;
      h.fuente = (h.fuente + 1) & 0xffff;
      h.destino = (h.destino + 1) & 0x1fff;
      // two bytes per machine cycle
      if (i & 1) {
        this.cambiarDiv(this.div + 4);
        for (let k = 0; k < 4; k++) this.puntoPpu();
      }
    }
    h.bloques--;
    if (h.bloques <= 0) h.activa = false;
    this.reg.senal(this.t, SK.hdma, 0);
  }

  // ---------------------------------------------------------------- PPU

  lcdOn() {
    return !!(this.io[0x40] & 0x80);
  }

  colorDmg(paleta, c) {
    return (paleta >> (c * 2)) & 3;
  }

  colorCgb(tabla, pal, c) {
    const i = pal * 8 + c * 2;
    return tabla[i] | ((tabla[i + 1] & 0x7f) << 8);
  }

  /** Reads of the PPU on the VRAM bus (address in the 16 KB of VRAM: bank * 8192 + offset). */
  leerVramPpu(dir, k) {
    const v = this.vram[dir];
    this.reg.bus('vram', this.t, dir, v, this.cgb ? F_INTERNO : 0, 0, k);
    return v;
  }

  empezarLinea() {
    this.modo = 2;
    this.reg.fase(this.t, FK.modo2, this.ly);
    this.sprites = [];
  }

  /** Mode 2: one OAM entry every 2 dots (Y and X compared with LY; at most 10 sprites per line). */
  busquedaOam(p) {
    if (p & 1) return;
    const i = p >> 1;
    const y = this.oam[i * 4];
    const x = this.oam[i * 4 + 1];
    this.reg.bus('vram', this.t, 0xfe00 + i * 4, y, F_INTERNO, 1, KV['oam-y']);
    const alto = this.io[0x40] & 4 ? 16 : 8;
    if (this.sprites.length < 10 && this.ly + 16 >= y && this.ly + 16 < y + alto) {
      this.sprites.push({ i, y, x, tile: this.oam[i * 4 + 2], attr: this.oam[i * 4 + 3], lo: 0, hi: 0, hecho: false });
    }
  }

  empezarModo3() {
    this.modo = 3;
    this.reg.fase(this.t, FK.modo3, this.ly);
    const scx = this.io[0x43];
    this.fifo = []; // background pixels {c, pal, prio}
    this.fifoSpr = new Array(8).fill(null);
    this.pasoFetch = 0;
    this.fetchX = 0;
    this.descartar = scx & 7;
    this.x = 0;
    this.primerFetch = true;
    this.parada = 0;
    this.espPendiente = null;
    this.enVentana = false;
    this.teselasPenalizadas = new Set();
    this.sprites.sort((a, b) => (this.cgb && !this.compat ? a.i - b.i : a.x - b.x || a.i - b.i));
    this.reg.senal(this.t, SK.cp, 1);
  }

  /** Background/window fetcher: 2 dots per step: tile number, low plane, high plane; then push when the FIFO is empty. */
  pasoFondo() {
    const lcdc = this.io[0x40];
    const s = this.pasoFetch;
    if (s === 0 || s === 2 || s === 4) {
      if (s === 0) {
        let mapa;
        let tx;
        let ty;
        if (this.enVentana) {
          mapa = lcdc & 0x40 ? 0x1c00 : 0x1800;
          tx = this.fetchX & 31;
          ty = this.lineaVentana;
        } else {
          mapa = lcdc & 0x08 ? 0x1c00 : 0x1800;
          tx = ((this.io[0x43] >> 3) + this.fetchX) & 31;
          ty = (this.ly + this.io[0x42]) & 255;
        }
        const dir = mapa + ((ty >> 3) << 5) + tx;
        this.fTile = this.leerVramPpu(dir, KV.mapa);
        this.fAttr = this.cgb && !this.compat ? this.leerVramPpu(0x2000 + dir, KV.atrib) : 0;
        this.fFila = ty & 7;
      } else {
        const t = this.fTile;
        let base = lcdc & 0x10 ? t * 16 : 0x1000 + ((t << 24) >> 24) * 16;
        let fila = this.fFila;
        if (this.fAttr & 0x40) fila = 7 - fila;
        if (this.fAttr & 0x08) base += 0x2000;
        const dir = base + fila * 2 + (s === 4 ? 1 : 0);
        if (s === 2) this.fLo = this.leerVramPpu(dir, KV['bg-bajo']);
        else this.fHi = this.leerVramPpu(dir, KV['bg-alto']);
      }
      this.pasoFetch++;
      return;
    }
    if (s === 1 || s === 3 || s === 5) {
      this.pasoFetch++;
      return;
    }
    // s === 6: push
    if (this.fifo.length) return;
    if (this.primerFetch) {
      // the first fetch of the line is thrown away and repeated (Pan Docs «Pixel FIFO»: 12 dots before the first pixel)
      this.primerFetch = false;
      this.pasoFetch = 0;
      return;
    }
    const xflip = this.fAttr & 0x20;
    for (let b = 0; b < 8; b++) {
      const bit = xflip ? b : 7 - b;
      const c = (((this.fHi >> bit) & 1) << 1) | ((this.fLo >> bit) & 1);
      this.fifo.push({ c, pal: this.fAttr & 7, prio: !!(this.fAttr & 0x80) });
    }
    this.fetchX++;
    this.pasoFetch = 0;
  }

  /** Sprite fetch (the stall of Pan Docs «Mode 3 length»): the tile's low plane 4 dots before the end of the
   * stall, the high plane 2 dots before, then the pixels are merged into the sprite FIFO. */
  pasoSprite(s, quedan) {
    const lcdc = this.io[0x40];
    const alto = lcdc & 4 ? 16 : 8;
    if (quedan === 4 || quedan === 2) {
      let fila = this.ly + 16 - s.y;
      if (s.attr & 0x40) fila = alto - 1 - fila;
      let tile = s.tile;
      if (alto === 16) tile &= 0xfe;
      let base = tile * 16 + fila * 2;
      if (this.cgb && !this.compat && s.attr & 0x08) base += 0x2000;
      if (quedan === 4) s.lo = this.leerVramPpu(base, KV['spr-bajo']);
      else s.hi = this.leerVramPpu(base + 1, KV['spr-alto']);
    }
    if (quedan !== 1) return;
    // merge into the sprite FIFO (DMG: the sprite fetched first keeps its pixels; CGB: OAM order)
    const xflip = s.attr & 0x20;
    for (let b = 0; b < 8; b++) {
      const sx = s.x - 8 + b;
      if (sx < this.x) continue;
      const k = sx - this.x;
      if (k >= 8) continue;
      const bit = xflip ? b : 7 - b;
      const c = (((s.hi >> bit) & 1) << 1) | ((s.lo >> bit) & 1);
      if (!this.fifoSpr[k] || this.fifoSpr[k].c === 0) {
        if (c || !this.fifoSpr[k]) this.fifoSpr[k] = { c, attr: s.attr };
      }
    }
  }

  puntoModo3() {
    if (this.parada > 0) {
      this.pasoSprite(this.espPendiente, this.parada);
      this.parada--;
      return;
    }
    const lcdc = this.io[0x40];
    // window start
    if (!this.enVentana && lcdc & 0x20 && this.ly >= this.io[0x4a] && this.x >= this.io[0x4b] - 7 && this.io[0x4b] <= 166 && !this.primerFetch) {
      this.enVentana = true;
      this.fifo = [];
      this.fetchX = 0;
      this.pasoFetch = 0;
      this.descartar = 0;
    }
    this.pasoFondo();
    if (!this.fifo.length || this.primerFetch) return;
    // a sprite starts here: stop the FIFO and fetch it
    if (lcdc & 0x02 || this.cgb) {
      const s = this.sprites.find((q) => !q.hecho && q.x - 8 <= this.x && this.descartar === 0);
      if (s && lcdc & 0x02) {
        // penalty: 6 dots, plus up to 5 more for the first sprite in a background tile (Pan Docs «Mode 3 length»)
        let pen = 6;
        const tileBg = (s.x - 8 + this.io[0x43]) >> 3;
        if (s.x === 0) pen += 5;
        else if (!this.teselasPenalizadas.has(tileBg)) {
          this.teselasPenalizadas.add(tileBg);
          pen += Math.max(0, 5 - (7 - ((s.x - 8 + this.io[0x43]) & 7)));
        }
        s.hecho = true;
        this.espPendiente = s;
        this.parada = pen;
        this.pasoSprite(s, this.parada);
        this.parada--;
        return;
      }
    }
    const bg = this.fifo.shift();
    const sp = this.fifoSpr.shift();
    this.fifoSpr.push(null);
    if (this.descartar > 0) {
      this.descartar--;
      return;
    }
    // mix
    let color;
    const nativo = this.cgb && !this.compat;
    const bgOn = nativo || lcdc & 0x01;
    const cbg = bgOn ? bg.c : 0;
    const usarSpr = sp && sp.c && lcdc & 0x02 && !(nativo && lcdc & 1 && cbg && bg.prio) && !(sp.attr & 0x80 && cbg);
    if (this.compat) {
      if (usarSpr) color = this.colorCgb(this.palObj, sp.attr & 0x10 ? 1 : 0, this.colorDmg(this.io[sp.attr & 0x10 ? 0x49 : 0x48], sp.c));
      else color = this.colorCgb(this.palBg, 0, this.colorDmg(this.io[0x47], cbg));
    } else if (this.cgb) {
      if (usarSpr) color = this.colorCgb(this.palObj, sp.attr & 7, sp.c);
      else color = this.colorCgb(this.palBg, bg.pal, bg.c);
    } else if (usarSpr) color = this.colorDmg(this.io[sp.attr & 0x10 ? 0x49 : 0x48], sp.c);
    else color = this.colorDmg(this.io[0x47], cbg);
    if (!this.primerCuadro) {
      this.fb[this.ly * 160 + this.x] = color;
      this.reg.pixel(this.t, color);
    } else {
      // the first frame after switching the LCD on is not shown
      this.fb[this.ly * 160 + this.x] = this.cgb ? 0x7fff : 0;
      this.reg.pixel(this.t, this.cgb ? 0x7fff : 0);
    }
    this.x++;
    if (this.x >= 160) {
      if (this.enVentana) this.lineaVentana++;
      this.modo = 0;
      this.reg.fase(this.t + 1, FK.modo0, this.ly);
      this.reg.senal(this.t + 1, SK.cp, 0);
      this.reg.senal(this.t + 1, SK.cpl, 1);
      this.reg.senal(this.t + 3, SK.cpl, 0);
      if (this.io[0x41] & 0x08) this.pedirInt(1);
      if (this.hdma.activa && this.hdma.hblank) this.hdmaPendiente = true;
    }
  }

  statLy() {
    const igual = this.ly === this.io[0x45];
    if (igual && !this.statLinea && this.io[0x41] & 0x40) this.pedirInt(1);
    this.statLinea = igual;
  }

  puntoPpu() {
    if (!this.lcdOn()) {
      this.t++;
      return;
    }
    const p = this.punto;
    if (p === 0) this.reg.lineaVideo(this.t, this.ly);
    if (this.ly < 144) {
      if (p === 0) {
        this.empezarLinea();
        this.statLy();
        if (this.io[0x41] & 0x20) this.pedirInt(1);
      }
      if (this.modo === 2 && p < 80) this.busquedaOam(p);
      if (p === 80 && this.modo === 2) this.empezarModo3();
      if (this.modo === 3) this.puntoModo3();
    } else if (this.ly === 144 && p === 0) {
      this.modo = 1;
      this.reg.fase(this.t, FK.modo1, this.ly);
      this.pedirInt(0);
      if (this.io[0x41] & 0x10) this.pedirInt(1);
      this.vblanks++;
      this.primerCuadro = false;
      this.statLy();
    } else if (p === 0) this.statLy();
    this.t++;
    this.punto++;
    if (this.punto >= 456) {
      this.punto = 0;
      this.ly++;
      if (this.ly === 154) {
        this.ly = 0;
        this.lineaVentana = 0;
        this.cuadros++;
        this.fr ^= 1;
        this.reg.senal(this.t, SK.st, 1);
        this.reg.senal(this.t + 4, SK.st, 0);
        this.reg.senal(this.t, SK.fr, this.fr);
      }
    }
  }

  regs() {
    const c = this.cpu;
    return { A: c.a, F: c.f, B: c.b, C: c.c, D: c.d, E: c.e, H: c.h, L: c.l, SP: c.sp };
  }

  paso() {
    const t = this.t;
    const regs = this.regs();
    const ciclo = this.reg.siguiente('cpu');
    const enHalt = this.cpu.halt;
    const r = this.cpu.paso();
    if (r.tipo === 'halt') {
      if (!enHalt) this.reg.senal(t, SK.halt, 1);
      return r;
    }
    if (enHalt) this.reg.senal(t, SK.halt, 0);
    if (this.reg.activo) {
      this.reg.ins.t.push(t);
      this.reg.ins.pc.push(r.pc);
      this.reg.ins.ciclo.push(ciclo);
      this.reg.ins.k.push(r.tipo === 'ins' ? 0 : 2);
      for (const [n, v] of Object.entries(regs)) (this.reg.ins.r[n] ??= []).push(v);
    }
    if (r.tipo === 'ins' && this.cpu.halt) this.reg.senal(this.t, SK.halt, 1);
    return r;
  }
}
