// NES (NTSC, NES-CPU-xx with an NROM cartridge) for the «Un fotograma» traces: the 2A03's 6502 (cpu6502.mjs)
// on its bus with the address decoder of the board (74HC139: WRAM /CE, PPU /CE, /ROMSEL), OAM DMA, and a
// dot-exact 2C02 PPU: every pattern/nametable/attribute fetch on the PPU bus (2 dots each, ALE in the first),
// loopy scroll registers, sprite evaluation and fetches, the background and sprite shifters, the pixel of every dot,
// VBlank and NMI. Timing from the NESdev Wiki («PPU rendering», «PPU frame timing», «PPU scrolling», «PPU OAM»,
// «DMA», «CPU pin-out and signal description», «PPU pin-out and signal description», «NTSC video»).
//
// Time unit: one PPU dot (master clock / 4 = 5 369 318 Hz); a CPU cycle is 3 dots.

import { Cpu6502 } from './cpu6502.mjs';

export const F_ESCRITURA = 1;
export const F_DMA = 8;
export const F_INTERNO = 32;

export const CHIPS_CPU = [
  { id: 'wram', titulo: 'WRAM 2 KB (U1, 6116)' },
  { id: 'ppu', titulo: 'Registros de la PPU (U5, 2C02)' },
  { id: 'apu', titulo: 'APU y E/S del 2A03 (U6)' },
  { id: 'mandos', titulo: 'Mandos ($4016/$4017, U7/U8)' },
  { id: 'prg', titulo: 'PRG-ROM del cartucho (P1, /ROMSEL)' },
  { id: 'nada', titulo: 'Nadie responde (bus abierto)' },
];
export const CHIPS_PPU = [
  { id: 'chr', titulo: 'CHR-ROM del cartucho (P1)' },
  { id: 'ciram', titulo: 'VRAM 2 KB (U4, CIRAM)' },
  { id: 'paleta', titulo: 'RAM de paletas (dentro de la PPU)' },
];
export const TIPOS_PPU = [
  { id: 'nt', titulo: 'Tabla de nombres (número de tesela)' },
  { id: 'at', titulo: 'Tabla de atributos (paleta)' },
  { id: 'bg-bajo', titulo: 'Patrón del fondo, plano bajo' },
  { id: 'bg-alto', titulo: 'Patrón del fondo, plano alto' },
  { id: 'spr-nt', titulo: 'Lectura de relleno (tabla de nombres) durante los sprites' },
  { id: 'spr-bajo', titulo: 'Patrón de sprite, plano bajo' },
  { id: 'spr-alto', titulo: 'Patrón de sprite, plano alto' },
  { id: 'nt-relleno', titulo: 'Lectura de relleno al final de la línea' },
  { id: 'cpu', titulo: 'Acceso de la CPU por $2007' },
];
const K = Object.fromEntries(TIPOS_PPU.map((x, i) => [x.id, i]));
const CC = Object.fromEntries(CHIPS_CPU.map((x, i) => [x.id, i]));
const CP = Object.fromEntries(CHIPS_PPU.map((x, i) => [x.id, i]));

export const FASES = [
  { id: 'visible', titulo: 'Líneas visibles: un píxel por punto y lecturas de fondo' },
  { id: 'sprites', titulo: 'Lectura de los sprites de la línea siguiente (puntos 257–320)' },
  { id: 'precarga', titulo: 'Precarga de las dos primeras teselas (puntos 321–336)' },
  { id: 'relleno', titulo: 'Lecturas de relleno (puntos 337–340) y punto 0 ocioso' },
  { id: 'postrender', titulo: 'Línea 240: la PPU descansa' },
  { id: 'vblank', titulo: 'Borrado vertical (VBlank, líneas 241–260)' },
  { id: 'prerender', titulo: 'Línea de preparación (261)' },
];
const FK = Object.fromEntries(FASES.map((x, i) => [x.id, i]));

export const SENALES = [
  { id: 'nmi', titulo: '/NMI', activaBaja: true },
  { id: 'vblank', titulo: 'Bandera VBlank ($2002 bit 7)' },
  { id: 'hsync', titulo: 'Sincronismo horizontal (vídeo compuesto)' },
  { id: 'vsync', titulo: 'Sincronismo vertical (vídeo compuesto)' },
  { id: 'dma', titulo: 'DMA de OAM en curso ($4014)' },
  { id: 'render', titulo: 'Dibujo activado (PPUMASK bits 3–4)' },
];
const SK = Object.fromEntries(SENALES.map((x, i) => [x.id, i]));

export class Nes {
  constructor(rom, registro) {
    if (rom[0] !== 0x4e || rom[1] !== 0x45 || rom[2] !== 0x53 || rom[3] !== 0x1a) throw new Error('No es una ROM iNES');
    const nprg = rom[4];
    const nchr = rom[5];
    this.mapper = (rom[6] >> 4) | (rom[7] & 0xf0);
    if (this.mapper !== 0) throw new Error(`Solo NROM (mapper 0); esta ROM usa el mapper ${this.mapper}`);
    this.vertical = !!(rom[6] & 1);
    const off = 16 + (rom[6] & 4 ? 512 : 0);
    this.prg = rom.subarray(off, off + nprg * 16384);
    this.chr = nchr ? rom.subarray(off + nprg * 16384, off + nprg * 16384 + nchr * 8192) : new Uint8Array(8192);
    this.chrRam = !nchr;
    this.reg = registro;
    this.ram = new Uint8Array(0x800);
    this.ciram = new Uint8Array(0x800);
    this.paleta = new Uint8Array(32);
    this.oam = new Uint8Array(256);
    this.t = 0; // dots since reset
    this.ciclo = 0; // CPU cycles
    this.busAbierto = 0;
    this.mandos = [0, 0];
    this.mandoBits = [0, 0];
    this.mandoLatch = 0;
    // PPU state
    this.linea = 0;
    this.punto = 0;
    this.impar = false;
    this.ctrl = 0;
    this.mask = 0;
    this.status = 0;
    this.oamAddr = 0;
    this.v = 0;
    this.tt = 0;
    this.fx = 0;
    this.w = 0;
    this.lectura = 0; // $2007 buffer
    this.latchPpu = 0;
    this.nmiLinea = 1; // /NMI level (1 = high)
    this.ntByte = 0;
    this.atByte = 0;
    this.bgLo = 0;
    this.bgHi = 0;
    this.shPatLo = 0;
    this.shPatHi = 0;
    this.shAtLo = 0;
    this.shAtHi = 0;
    this.spr = []; // sprites of the current line: {x, lo, hi, attr, cero}
    this.sprSig = []; // evaluated for the next line
    this.fb = new Uint8Array(256 * 240);
    this.cuadros = 0;
    this.sync = { h: 0, v: 0 };
    this.cpu = new Cpu6502({ leer: (a, f) => this.leerCpu(a, f), escribir: (a, v, f) => this.escribirCpu(a, v, f) });
  }

  renderOn() {
    return (this.mask & 0x18) !== 0;
  }

  // ---------------------------------------------------------------- CPU bus

  chipCpu(a) {
    if (a < 0x2000) return CC.wram;
    if (a < 0x4000) return CC.ppu;
    if (a === 0x4016 || a === 0x4017) return CC.mandos;
    if (a < 0x4020) return CC.apu;
    if (a >= 0x8000) return CC.prg;
    return CC.nada;
  }

  leerCpu(a, f) {
    const t = this.t;
    const c = this.chipCpu(a);
    let v;
    if (c === CC.wram) v = this.ram[a & 0x7ff];
    else if (c === CC.ppu) v = this.leerPpuReg(a & 7);
    else if (c === CC.mandos) {
      const i = a & 1;
      v = (this.busAbierto & 0xe0) | (this.mandoBits[i] & 1);
      if (!this.mandoLatch) this.mandoBits[i] = (this.mandoBits[i] >> 1) | 0x80;
    } else if (c === CC.apu) v = a === 0x4015 ? 0 : this.busAbierto;
    else if (c === CC.prg) v = this.prg[(a - 0x8000) % this.prg.length];
    else v = this.busAbierto;
    // $4015 is read inside the 2A03: the external data bus keeps its old value
    this.reg.bus('cpu', t, a, v, f | (c === CC.apu ? F_INTERNO : 0), c);
    if (c !== CC.apu) this.busAbierto = v;
    this.avanzar(3);
    return v;
  }

  escribirCpu(a, v, f) {
    const t = this.t;
    const c = this.chipCpu(a);
    this.reg.bus('cpu', t, a, v, f | F_ESCRITURA, c);
    this.busAbierto = v;
    if (c === CC.wram) this.ram[a & 0x7ff] = v;
    else if (c === CC.ppu) this.escribirPpuReg(a & 7, v);
    else if (a === 0x4016) {
      this.mandoLatch = v & 1;
      if (this.mandoLatch) this.mandoBits = [...this.mandos];
    }
    this.avanzar(3);
    if (a === 0x4014) this.dmaOam(v);
  }

  /** OAM DMA: 1 halt cycle (+1 on an odd cycle), then 256 × (read $XX00+i, write $2004). */
  dmaOam(pagina) {
    this.reg.senal(this.t, SK.dma, 1);
    const espera = 1 + (this.ciclo & 1);
    for (let i = 0; i < espera; i++) {
      this.reg.bus('cpu', this.t, this.cpu.pc, this.busAbierto, F_DMA | 4, this.chipCpu(this.cpu.pc));
      this.avanzar(3);
    }
    for (let i = 0; i < 256; i++) {
      const a = (pagina << 8) | i;
      const c = this.chipCpu(a);
      const v = c === CC.wram ? this.ram[a & 0x7ff] : c === CC.prg ? this.prg[(a - 0x8000) % this.prg.length] : this.busAbierto;
      this.reg.bus('cpu', this.t, a, v, F_DMA, c);
      this.busAbierto = v;
      this.avanzar(3);
      this.reg.bus('cpu', this.t, 0x2004, v, F_DMA | F_ESCRITURA, CC.ppu);
      this.oam[this.oamAddr] = v;
      this.oamAddr = (this.oamAddr + 1) & 0xff;
      this.avanzar(3);
    }
    this.reg.senal(this.t, SK.dma, 0);
  }

  // ---------------------------------------------------------------- PPU registers

  leerPpuReg(r) {
    switch (r) {
      case 2: {
        const v = (this.status & 0xe0) | (this.latchPpu & 0x1f);
        this.status &= ~0x80;
        this.w = 0;
        this.ponerNmi();
        this.reg.senal(this.t, SK.vblank, 0);
        this.latchPpu = v;
        return v;
      }
      case 4:
        this.latchPpu = this.oam[this.oamAddr];
        return this.latchPpu;
      case 7: {
        const a = this.v & 0x3fff;
        let v;
        if (a >= 0x3f00) {
          v = this.leerPaleta(a);
          this.lectura = this.leerVram(a - 0x1000, K.cpu, this.t, true);
        } else {
          v = this.lectura;
          this.lectura = this.leerVram(a, K.cpu, this.t, false);
        }
        this.v = (this.v + (this.ctrl & 4 ? 32 : 1)) & 0x7fff;
        this.latchPpu = v;
        return v;
      }
      default:
        return this.latchPpu;
    }
  }

  escribirPpuReg(r, v) {
    this.latchPpu = v;
    switch (r) {
      case 0:
        this.ctrl = v;
        this.tt = (this.tt & 0xf3ff) | ((v & 3) << 10);
        this.ponerNmi();
        break;
      case 1: {
        const antes = this.renderOn();
        this.mask = v;
        if (antes !== this.renderOn()) this.reg.senal(this.t, SK.render, this.renderOn() ? 1 : 0);
        break;
      }
      case 3:
        this.oamAddr = v;
        break;
      case 4:
        this.oam[this.oamAddr] = v;
        this.oamAddr = (this.oamAddr + 1) & 0xff;
        break;
      case 5:
        if (!this.w) {
          this.tt = (this.tt & 0xffe0) | (v >> 3);
          this.fx = v & 7;
        } else {
          this.tt = (this.tt & 0x8c1f) | ((v & 7) << 12) | ((v & 0xf8) << 2);
        }
        this.w ^= 1;
        break;
      case 6:
        if (!this.w) this.tt = (this.tt & 0x00ff) | ((v & 0x3f) << 8);
        else {
          this.tt = (this.tt & 0xff00) | v;
          this.v = this.tt;
        }
        this.w ^= 1;
        break;
      case 7: {
        const a = this.v & 0x3fff;
        if (a >= 0x3f00) this.escribirPaleta(a, v);
        else this.escribirVram(a, v);
        this.v = (this.v + (this.ctrl & 4 ? 32 : 1)) & 0x7fff;
        break;
      }
    }
  }

  ponerNmi() {
    const nivel = this.status & 0x80 && this.ctrl & 0x80 ? 0 : 1;
    if (nivel !== this.nmiLinea) {
      this.nmiLinea = nivel;
      this.reg.senal(this.t, SK.nmi, nivel);
      if (nivel === 0) this.cpu.nmiFlanco = true;
    }
  }

  // ---------------------------------------------------------------- PPU memory (the PPU bus)

  dirCiram(a) {
    const n = (a >> 10) & 3;
    // VRAM A10 = PA10 (vertical mirroring) or PA11 (horizontal), wired on the cartridge
    const a10 = this.vertical ? n & 1 : n >> 1;
    return (a10 << 10) | (a & 0x3ff);
  }

  /** One read on the PPU bus, recorded with its kind (2 dots: address with ALE, then /RD). */
  leerVram(a, k, t, interno = false) {
    a &= 0x3fff;
    let v;
    let c;
    if (a < 0x2000) {
      v = this.chr[a];
      c = CP.chr;
    } else {
      v = this.ciram[this.dirCiram(a)];
      c = CP.ciram;
    }
    this.reg.bus('ppu', t, a, v, interno ? F_INTERNO : 0, c, k);
    return v;
  }

  escribirVram(a, v) {
    a &= 0x3fff;
    let c;
    if (a < 0x2000) {
      c = CP.chr;
      if (this.chrRam) this.chr[a] = v;
    } else {
      c = CP.ciram;
      this.ciram[this.dirCiram(a)] = v;
    }
    this.reg.bus('ppu', this.t, a, v, F_ESCRITURA, c, K.cpu);
  }

  dirPaleta(a) {
    let i = a & 0x1f;
    if ((i & 0x13) === 0x10) i &= 0x0f;
    return i;
  }

  leerPaleta(a) {
    const v = this.paleta[this.dirPaleta(a)] & 0x3f;
    this.reg.bus('ppu', this.t, a & 0x3fff, v, F_INTERNO, CP.paleta, K.cpu);
    return v;
  }

  escribirPaleta(a, v) {
    this.paleta[this.dirPaleta(a)] = v & 0x3f;
    this.reg.bus('ppu', this.t, a & 0x3fff, v & 0x3f, F_INTERNO | F_ESCRITURA, CP.paleta, K.cpu);
  }

  // ---------------------------------------------------------------- PPU rendering, one dot at a time

  avanzar(n) {
    for (let i = 0; i < n; i++) this.puntoPpu();
    this.ciclo += n / 3;
  }

  incX() {
    if ((this.v & 0x1f) === 31) {
      this.v &= ~0x1f;
      this.v ^= 0x400;
    } else this.v++;
  }

  incY() {
    if ((this.v & 0x7000) !== 0x7000) this.v += 0x1000;
    else {
      this.v &= ~0x7000;
      let y = (this.v & 0x3e0) >> 5;
      if (y === 29) {
        y = 0;
        this.v ^= 0x800;
      } else if (y === 31) y = 0;
      else y++;
      this.v = (this.v & ~0x3e0) | (y << 5);
    }
  }

  cargarShifters() {
    this.shPatLo = (this.shPatLo & 0xff00) | this.bgLo;
    this.shPatHi = (this.shPatHi & 0xff00) | this.bgHi;
    const at = this.atByte;
    this.shAtLo = (this.shAtLo & 0xff00) | (at & 1 ? 0xff : 0);
    this.shAtHi = (this.shAtHi & 0xff00) | (at & 2 ? 0xff : 0);
  }

  /** Background fetch of the dot (the 8-dot pattern of NESdev «PPU rendering»). */
  fetchFondo(p) {
    const fase = (p - 1) & 7;
    const t = this.t;
    if (fase === 0) this.ntByte = this.leerVram(0x2000 | (this.v & 0x0fff), K.nt, t);
    else if (fase === 2) {
      const a = 0x23c0 | (this.v & 0x0c00) | ((this.v >> 4) & 0x38) | ((this.v >> 2) & 7);
      let at = this.leerVram(a, K.at, t);
      if (this.v & 0x40) at >>= 4;
      if (this.v & 0x02) at >>= 2;
      this.atByte = at & 3;
    } else if (fase === 4) {
      const a = ((this.ctrl & 0x10) << 8) | (this.ntByte << 4) | ((this.v >> 12) & 7);
      this.bgLo = this.leerVram(a, K['bg-bajo'], t);
    } else if (fase === 6) {
      const a = ((this.ctrl & 0x10) << 8) | (this.ntByte << 4) | ((this.v >> 12) & 7) | 8;
      this.bgHi = this.leerVram(a, K['bg-alto'], t);
    } else if (fase === 7) {
      this.incX();
    }
  }

  /** Sprite evaluation for the next line (the result of dots 65–256; done at once at dot 257). */
  evaluarSprites(lineaSig) {
    const alto = this.ctrl & 0x20 ? 16 : 8;
    const out = [];
    for (let i = 0; i < 64 && out.length < 8; i++) {
      const y = this.oam[i * 4];
      const fila = lineaSig - y - 1;
      if (fila >= 0 && fila < alto) out.push({ i, y, tile: this.oam[i * 4 + 1], attr: this.oam[i * 4 + 2], x: this.oam[i * 4 + 3], fila });
    }
    // more than 8: sprite overflow flag (without the hardware's diagonal bug, harmless here)
    let n = 0;
    for (let i = 0; i < 64; i++) {
      const fila = lineaSig - this.oam[i * 4] - 1;
      if (fila >= 0 && fila < alto) n++;
    }
    if (n > 8) this.status |= 0x20;
    this.eval = out;
  }

  /** Sprite fetches of dots 257–320: per slot, 2 garbage nametable reads, then the pattern's low and high planes. */
  fetchSprite(p) {
    const slot = (p - 257) >> 3;
    const fase = (p - 257) & 7;
    const t = this.t;
    const s = this.eval?.[slot];
    if (fase === 0 || fase === 2) {
      this.leerVram(0x2000 | (this.v & 0x0fff), K['spr-nt'], t);
      return;
    }
    if (fase !== 4 && fase !== 6) return;
    const alto = this.ctrl & 0x20 ? 16 : 8;
    let a;
    if (s) {
      let fila = s.fila;
      if (s.attr & 0x80) fila = alto - 1 - fila;
      if (alto === 16) a = ((s.tile & 1) << 12) | ((s.tile & 0xfe) << 4) | (fila >= 8 ? 16 : 0) | (fila & 7);
      else a = ((this.ctrl & 0x08) << 9) | (s.tile << 4) | fila;
    } else {
      // empty slots fetch tile $FF (NESdev «PPU rendering»)
      a = alto === 16 ? 0x1ff0 : ((this.ctrl & 0x08) << 9) | 0xff0;
    }
    if (fase === 4) {
      const v = this.leerVram(a, K['spr-bajo'], t);
      if (s) (this.sprSig[slot] = { x: s.x, attr: s.attr, cero: s.i === 0, lo: v, hi: 0 });
    } else {
      const v = this.leerVram(a | 8, K['spr-alto'], t);
      if (s) this.sprSig[slot].hi = v;
    }
  }

  pixel(x) {
    let bg = 0;
    let bgPal = 0;
    if (this.mask & 0x08 && (x >= 8 || this.mask & 0x02)) {
      const b = 15 - this.fx;
      bg = (((this.shPatHi >> b) & 1) << 1) | ((this.shPatLo >> b) & 1);
      bgPal = (((this.shAtHi >> b) & 1) << 1) | ((this.shAtLo >> b) & 1);
    }
    let sp = 0;
    let spPal = 0;
    let spDetras = false;
    let spCero = false;
    if (this.mask & 0x10 && (x >= 8 || this.mask & 0x04)) {
      for (const s of this.spr) {
        const d = x - s.x;
        if (d < 0 || d > 7) continue;
        const bit = s.attr & 0x40 ? d : 7 - d;
        const c = (((s.hi >> bit) & 1) << 1) | ((s.lo >> bit) & 1);
        if (!c) continue;
        sp = c;
        spPal = (s.attr & 3) + 4;
        spDetras = !!(s.attr & 0x20);
        spCero = s.cero;
        break;
      }
    }
    if (spCero && bg && sp && x !== 255) this.status |= 0x40;
    let i;
    if (!bg && !sp) i = 0;
    else if (!bg) i = spPal * 4 + sp;
    else if (!sp) i = bgPal * 4 + bg;
    else i = spDetras ? bgPal * 4 + bg : spPal * 4 + sp;
    return this.paleta[this.dirPaleta(0x3f00 + i)] & (this.mask & 1 ? 0x30 : 0x3f);
  }

  /** Composite sync per line (NESdev «NTSC video»): hsync at dots 277–301; vsync during lines 245–247. */
  sincronismos(l, p) {
    const h = p >= 277 && p <= 301 ? 1 : 0;
    if (h !== this.sync.h) {
      this.sync.h = h;
      this.reg.senal(this.t, SK.hsync, h);
    }
    const v = l >= 245 && l <= 247 ? 1 : 0;
    if (v !== this.sync.v) {
      this.sync.v = v;
      this.reg.senal(this.t, SK.vsync, v);
    }
  }

  faseDe(l, p) {
    if (l === 240) return p === 0 ? FK.postrender : -1;
    if (l >= 241 && l <= 260) return l === 241 && p === 0 ? FK.vblank : -1;
    const base = l === 261 ? FK.prerender : FK.visible;
    if (p === 1) return base;
    if (p === 257) return FK.sprites;
    if (p === 321) return FK.precarga;
    if (p === 337) return FK.relleno;
    if (p === 0 && l === 261) return -1;
    if (p === 0) return FK.relleno;
    return -1;
  }

  puntoPpu() {
    const l = this.linea;
    const p = this.punto;
    if (p === 0) this.reg.lineaVideo(this.t, l);
    const f = this.faseDe(l, p);
    if (f >= 0) this.reg.fase(this.t, f, l);
    this.sincronismos(l, p);
    const render = this.renderOn();
    const pre = l === 261;
    if (l < 240 || pre) {
      if (pre && p === 1) {
        this.status &= ~0xe0;
        this.ponerNmi();
        this.reg.senal(this.t, SK.vblank, 0);
      }
      if (render) {
        if ((p >= 2 && p <= 257) || (p >= 322 && p <= 337)) {
          this.shPatLo = (this.shPatLo << 1) & 0xffff;
          this.shPatHi = (this.shPatHi << 1) & 0xffff;
          this.shAtLo = (this.shAtLo << 1) & 0xffff;
          this.shAtHi = (this.shAtHi << 1) & 0xffff;
        }
        if ((p >= 1 && p <= 256) || (p >= 321 && p <= 336)) {
          if (((p - 1) & 7) === 0 && p > 1 && p !== 321) this.cargarShifters();
          this.fetchFondo(p);
        }
        if (p === 257) this.cargarShifters();
        if (p === 256) this.incY();
        if (p === 257) {
          this.v = (this.v & ~0x041f) | (this.tt & 0x041f);
          this.sprSig = [];
          this.evaluarSprites(pre ? 0 : l + 1);
          if (pre) this.eval = [];
        }
        if (p >= 257 && p <= 320) {
          this.oamAddr = 0;
          this.fetchSprite(p);
        }
        if (p === 329 || p === 337) this.cargarShifters();
        if (pre && p >= 280 && p <= 304) this.v = (this.v & ~0x7be0) | (this.tt & 0x7be0);
        if (p === 337 || p === 339) this.leerVram(0x2000 | (this.v & 0x0fff), K['nt-relleno'], this.t);
      }
      // the pixel of the dot, from the shifters as they are after this dot's shift and reload
      if (l < 240 && p >= 1 && p <= 256) {
        const x = p - 1;
        const c = render ? this.pixel(x) : this.paleta[(this.v & 0x3f00) === 0x3f00 ? this.dirPaleta(this.v) : 0] & 0x3f;
        this.fb[l * 256 + x] = c;
        this.reg.pixel(this.t, c);
      }
    }
    if (l === 241 && p === 1) {
      this.vblanks = (this.vblanks ?? 0) + 1;
      this.status |= 0x80;
      this.reg.senal(this.t, SK.vblank, 1);
      this.ponerNmi();
    }
    // next dot
    this.t++;
    this.punto++;
    if (pre && p === 339 && this.impar && render) this.punto++; // odd frames skip dot 340 of the pre-render line
    if (this.punto > 340) {
      this.punto = 0;
      // the sprites fetched in dots 257–320 are drawn on the next line
      if (this.linea < 240 || this.linea === 261) this.spr = this.sprSig.filter(Boolean);
      this.linea++;
      if (this.linea > 261) {
        this.linea = 0;
        this.impar = !this.impar;
        this.cuadros++;
      }
    }
  }

  reset() {
    const t = this.t;
    this.reg.instruccion(t, this.cpu.pc, 3, this.regs());
    this.cpu.reset();
  }

  regs() {
    const c = this.cpu;
    return { A: c.a, X: c.x, Y: c.y, P: c.p, S: c.s };
  }

  /** One instruction (or interrupt); records its start. */
  paso() {
    const t = this.t;
    const regs = this.regs();
    const ciclo = this.reg.siguiente('cpu');
    const r = this.cpu.paso();
    if (this.reg.activo) {
      // recorded after running so that the first cycle index is the one of this instruction
      this.reg.ins.t.push(t);
      this.reg.ins.pc.push(r.pc);
      this.reg.ins.ciclo.push(ciclo);
      this.reg.ins.k.push(r.tipo === 'ins' ? 0 : r.tipo === 'nmi' ? 1 : 2);
      for (const [n, v] of Object.entries(regs)) (this.reg.ins.r[n] ??= []).push(v);
    }
    return r;
  }
}

/** NES colours (2C02, NTSC) computed from the composite signal levels of the NESdev Wiki «NTSC video» (Bisqwit's
 * palette generator: 12 phases per colour cycle, YIQ decoding, no gamma correction). */
export function paletaNes() {
  const niveles = [0.35, 0.518, 0.962, 1.55, 1.094, 1.506, 1.962, 1.962];
  const negro = 0.518;
  const blanco = 1.962;
  const out = [];
  for (let i = 0; i < 64; i++) {
    const color = i & 0x0f;
    let nivel = (i >> 4) & 3;
    if (color > 13) nivel = 1;
    let lo = niveles[nivel];
    let hi = niveles[nivel + 4];
    if (color === 0) lo = hi;
    if (color > 12) hi = lo;
    let y = 0;
    let ii = 0;
    let q = 0;
    for (let p = 0; p < 12; p++) {
      const v = ((color + p) % 12 < 6 ? hi : lo);
      const s = (v - negro) / (blanco - negro);
      y += s;
      ii += s * Math.cos((Math.PI * (p + 3.9)) / 6);
      q += s * Math.sin((Math.PI * (p + 3.9)) / 6);
    }
    y /= 12;
    ii /= 12;
    q /= 12;
    const g = (x) => Math.round(255 * (Math.min(1, Math.max(0, x))));
    const r = y + 0.946882 * ii + 0.623557 * q;
    const gg = y - 0.274788 * ii - 0.635691 * q;
    const b = y - 1.108545 * ii + 1.709007 * q;
    out.push((g(r) << 16) | (g(gg) << 8) | g(b));
  }
  return out;
}
