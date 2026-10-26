// Cycle-exact 6502 core (NES 2A03 flavour: no decimal mode) for the «Un fotograma» traces.
// Every CPU cycle is exactly one bus access, in the order of the real chip, dummy reads and writes included
// (John West & Marko Mäkelä, «6502_cpu.txt»; NESdev Wiki «CPU unofficial opcodes» for the cycle tables).
// Validated against Tom Harte's SingleStepTests (65x02/nes6502: registers, memory and the bus access of every
// cycle) and nestest.nes's reference log: see contenido/fotograma/validar6502.mjs.
//
// The bus object gives `leer(dir, tipo)` and `escribir(dir, valor, tipo)`; every call is one cycle. `tipo` is a
// bit mask of the trace flags (ESQUEMA.md, «Un fotograma»): 2 opcode fetch, 4 dummy cycle, 16 vector, 64 operand.

export const F_SYNC = 2;
export const F_FANTASMA = 4;
export const F_VECTOR = 16;
export const F_OPERANDO = 64;

const C = 1, Z = 2, I = 4, D = 8, B = 16, U = 32, V = 64, N = 128;

// opcode -> [mnemonic, addressing mode]; modes: imp acc imm zp zpx zpy abs abx aby izx izy rel ind
const OPS = {};
function def(mn, pares) {
  for (const [op, modo] of pares) OPS[op] = [mn, modo];
}
def('ADC', [[0x69, 'imm'], [0x65, 'zp'], [0x75, 'zpx'], [0x6d, 'abs'], [0x7d, 'abx'], [0x79, 'aby'], [0x61, 'izx'], [0x71, 'izy']]);
def('AND', [[0x29, 'imm'], [0x25, 'zp'], [0x35, 'zpx'], [0x2d, 'abs'], [0x3d, 'abx'], [0x39, 'aby'], [0x21, 'izx'], [0x31, 'izy']]);
def('ASL', [[0x0a, 'acc'], [0x06, 'zp'], [0x16, 'zpx'], [0x0e, 'abs'], [0x1e, 'abx']]);
def('BCC', [[0x90, 'rel']]); def('BCS', [[0xb0, 'rel']]); def('BEQ', [[0xf0, 'rel']]); def('BMI', [[0x30, 'rel']]);
def('BNE', [[0xd0, 'rel']]); def('BPL', [[0x10, 'rel']]); def('BVC', [[0x50, 'rel']]); def('BVS', [[0x70, 'rel']]);
def('BIT', [[0x24, 'zp'], [0x2c, 'abs']]);
def('BRK', [[0x00, 'imp']]);
def('CLC', [[0x18, 'imp']]); def('CLD', [[0xd8, 'imp']]); def('CLI', [[0x58, 'imp']]); def('CLV', [[0xb8, 'imp']]);
def('CMP', [[0xc9, 'imm'], [0xc5, 'zp'], [0xd5, 'zpx'], [0xcd, 'abs'], [0xdd, 'abx'], [0xd9, 'aby'], [0xc1, 'izx'], [0xd1, 'izy']]);
def('CPX', [[0xe0, 'imm'], [0xe4, 'zp'], [0xec, 'abs']]);
def('CPY', [[0xc0, 'imm'], [0xc4, 'zp'], [0xcc, 'abs']]);
def('DEC', [[0xc6, 'zp'], [0xd6, 'zpx'], [0xce, 'abs'], [0xde, 'abx']]);
def('DEX', [[0xca, 'imp']]); def('DEY', [[0x88, 'imp']]);
def('EOR', [[0x49, 'imm'], [0x45, 'zp'], [0x55, 'zpx'], [0x4d, 'abs'], [0x5d, 'abx'], [0x59, 'aby'], [0x41, 'izx'], [0x51, 'izy']]);
def('INC', [[0xe6, 'zp'], [0xf6, 'zpx'], [0xee, 'abs'], [0xfe, 'abx']]);
def('INX', [[0xe8, 'imp']]); def('INY', [[0xc8, 'imp']]);
def('JMP', [[0x4c, 'abs'], [0x6c, 'ind']]);
def('JSR', [[0x20, 'abs']]);
def('LDA', [[0xa9, 'imm'], [0xa5, 'zp'], [0xb5, 'zpx'], [0xad, 'abs'], [0xbd, 'abx'], [0xb9, 'aby'], [0xa1, 'izx'], [0xb1, 'izy']]);
def('LDX', [[0xa2, 'imm'], [0xa6, 'zp'], [0xb6, 'zpy'], [0xae, 'abs'], [0xbe, 'aby']]);
def('LDY', [[0xa0, 'imm'], [0xa4, 'zp'], [0xb4, 'zpx'], [0xac, 'abs'], [0xbc, 'abx']]);
def('LSR', [[0x4a, 'acc'], [0x46, 'zp'], [0x56, 'zpx'], [0x4e, 'abs'], [0x5e, 'abx']]);
def('NOP', [[0xea, 'imp']]);
def('ORA', [[0x09, 'imm'], [0x05, 'zp'], [0x15, 'zpx'], [0x0d, 'abs'], [0x1d, 'abx'], [0x19, 'aby'], [0x01, 'izx'], [0x11, 'izy']]);
def('PHA', [[0x48, 'imp']]); def('PHP', [[0x08, 'imp']]); def('PLA', [[0x68, 'imp']]); def('PLP', [[0x28, 'imp']]);
def('ROL', [[0x2a, 'acc'], [0x26, 'zp'], [0x36, 'zpx'], [0x2e, 'abs'], [0x3e, 'abx']]);
def('ROR', [[0x6a, 'acc'], [0x66, 'zp'], [0x76, 'zpx'], [0x6e, 'abs'], [0x7e, 'abx']]);
def('RTI', [[0x40, 'imp']]); def('RTS', [[0x60, 'imp']]);
def('SBC', [[0xe9, 'imm'], [0xe5, 'zp'], [0xf5, 'zpx'], [0xed, 'abs'], [0xfd, 'abx'], [0xf9, 'aby'], [0xe1, 'izx'], [0xf1, 'izy']]);
def('SEC', [[0x38, 'imp']]); def('SED', [[0xf8, 'imp']]); def('SEI', [[0x78, 'imp']]);
def('STA', [[0x85, 'zp'], [0x95, 'zpx'], [0x8d, 'abs'], [0x9d, 'abx'], [0x99, 'aby'], [0x81, 'izx'], [0x91, 'izy']]);
def('STX', [[0x86, 'zp'], [0x96, 'zpy'], [0x8e, 'abs']]);
def('STY', [[0x84, 'zp'], [0x94, 'zpx'], [0x8c, 'abs']]);
def('TAX', [[0xaa, 'imp']]); def('TAY', [[0xa8, 'imp']]); def('TSX', [[0xba, 'imp']]); def('TXA', [[0x8a, 'imp']]);
def('TXS', [[0x9a, 'imp']]); def('TYA', [[0x98, 'imp']]);

export const OPCODES_6502 = OPS;

const LECTURA = new Set(['ADC', 'AND', 'BIT', 'CMP', 'CPX', 'CPY', 'EOR', 'LDA', 'LDX', 'LDY', 'ORA', 'SBC']);
const ESCRITURA = new Set(['STA', 'STX', 'STY']);
const RMW = new Set(['ASL', 'LSR', 'ROL', 'ROR', 'INC', 'DEC']);

export class Cpu6502 {
  constructor(bus) {
    this.bus = bus;
    this.a = 0; this.x = 0; this.y = 0; this.s = 0; this.p = I | U; this.pc = 0;
    this.ciclos = 0;
    /** NMI edge latched by the system (set on the falling edge of /NMI). */
    this.nmiFlanco = false;
    /** Edge as seen at the end of the penultimate cycle of the last instruction (the 6502's poll point). */
    this.nmiSondeo = false;
    /** /IRQ level (true = asserted). */
    this.irq = false;
    this.irqSondeo = false;
  }

  // one cycle each
  r(dir, tipo = 0) {
    this.nmiSondeo = this.nmiFlanco;
    this.irqSondeo = this.irq && !(this.p & I);
    this.ciclos++;
    return this.bus.leer(dir & 0xffff, tipo);
  }
  w(dir, v, tipo = 0) {
    this.nmiSondeo = this.nmiFlanco;
    this.irqSondeo = this.irq && !(this.p & I);
    this.ciclos++;
    this.bus.escribir(dir & 0xffff, v & 0xff, tipo);
  }

  nz(v) {
    this.p = (this.p & ~(N | Z)) | (v & 0x80) | (v & 0xff ? 0 : Z);
    return v & 0xff;
  }

  push(v) {
    this.w(0x100 | this.s, v);
    this.s = (this.s - 1) & 0xff;
  }

  /** Reset sequence: 7 cycles, three suppressed stack «pushes» (reads), vector at $FFFC. */
  reset() {
    this.r(this.pc, F_FANTASMA);
    this.r(this.pc, F_FANTASMA);
    for (let i = 0; i < 3; i++) {
      this.r(0x100 | this.s, F_FANTASMA);
      this.s = (this.s - 1) & 0xff;
    }
    this.p |= I;
    const lo = this.r(0xfffc, F_VECTOR);
    const hi = this.r(0xfffd, F_VECTOR);
    this.pc = lo | (hi << 8);
    this.nmiFlanco = false;
    this.nmiSondeo = false;
  }

  interrupcion(vector, brk) {
    if (!brk) {
      this.r(this.pc, F_FANTASMA);
      this.r(this.pc, F_FANTASMA);
    }
    this.push(this.pc >> 8);
    this.push(this.pc & 0xff);
    // NMI hijacking: an NMI edge seen while pushing turns a BRK/IRQ into an NMI
    let vec = vector;
    if (vec !== 0xfffa && this.nmiFlanco) {
      vec = 0xfffa;
    }
    this.push(brk ? this.p | B | U : (this.p & ~B) | U);
    this.p |= I;
    if (vec === 0xfffa) this.nmiFlanco = false;
    const lo = this.r(vec, F_VECTOR);
    const hi = this.r(vec + 1, F_VECTOR);
    this.pc = lo | (hi << 8);
    return vec;
  }

  /**
   * Runs one instruction (or the interrupt sequence that replaces it). Returns
   * {tipo: 'ins'|'nmi'|'irq', pc, op} for the trace.
   */
  paso() {
    if (this.nmiSondeo) {
      this.nmiSondeo = false;
      const pc = this.pc;
      this.interrupcion(0xfffa, false);
      return { tipo: 'nmi', pc };
    }
    if (this.irqSondeo) {
      this.irqSondeo = false;
      const pc = this.pc;
      const v = this.interrupcion(0xfffe, false);
      return { tipo: v === 0xfffa ? 'nmi' : 'irq', pc };
    }
    const pc = this.pc;
    const op = this.r(this.pc, F_SYNC);
    this.pc = (this.pc + 1) & 0xffff;
    const d = OPS[op];
    if (!d) throw new Error(`Código de operación no implementado $${op.toString(16)} en $${pc.toString(16)}`);
    this.ejecutar(d[0], d[1], op);
    return { tipo: 'ins', pc, op };
  }

  op8() {
    const v = this.r(this.pc, F_OPERANDO);
    this.pc = (this.pc + 1) & 0xffff;
    return v;
  }

  /** Effective address for the memory modes; `escribe` forces the dummy read of indexed modes. */
  direccion(modo, escribe) {
    switch (modo) {
      case 'zp':
        return this.op8();
      case 'zpx':
      case 'zpy': {
        const b = this.op8();
        this.r(b, F_FANTASMA);
        return (b + (modo === 'zpx' ? this.x : this.y)) & 0xff;
      }
      case 'abs': {
        const lo = this.op8();
        const hi = this.op8();
        return lo | (hi << 8);
      }
      case 'abx':
      case 'aby': {
        const lo = this.op8();
        const hi = this.op8();
        const i = modo === 'abx' ? this.x : this.y;
        const sin = (hi << 8) | ((lo + i) & 0xff);
        const dir = ((hi << 8) + lo + i) & 0xffff;
        if (escribe || sin !== dir) this.r(sin, F_FANTASMA);
        return dir;
      }
      case 'izx': {
        const b = this.op8();
        this.r(b, F_FANTASMA);
        const p = (b + this.x) & 0xff;
        const lo = this.r(p);
        const hi = this.r((p + 1) & 0xff);
        return lo | (hi << 8);
      }
      case 'izy': {
        const b = this.op8();
        const lo = this.r(b);
        const hi = this.r((b + 1) & 0xff);
        const sin = (hi << 8) | ((lo + this.y) & 0xff);
        const dir = ((hi << 8) + lo + this.y) & 0xffff;
        if (escribe || sin !== dir) this.r(sin, F_FANTASMA);
        return dir;
      }
      default:
        throw new Error('modo ' + modo);
    }
  }

  adc(v) {
    const r = this.a + v + (this.p & C);
    this.p = (this.p & ~(C | V)) | (r > 0xff ? C : 0) | (~(this.a ^ v) & (this.a ^ r) & 0x80 ? V : 0);
    this.a = this.nz(r);
  }

  cmp(reg, v) {
    const r = reg - v;
    this.p = (this.p & ~C) | (r >= 0 ? C : 0);
    this.nz(r);
  }

  alu(mn, v) {
    switch (mn) {
      case 'ADC': return this.adc(v);
      case 'SBC': return this.adc(v ^ 0xff);
      case 'AND': this.a = this.nz(this.a & v); return;
      case 'ORA': this.a = this.nz(this.a | v); return;
      case 'EOR': this.a = this.nz(this.a ^ v); return;
      case 'LDA': this.a = this.nz(v); return;
      case 'LDX': this.x = this.nz(v); return;
      case 'LDY': this.y = this.nz(v); return;
      case 'CMP': return this.cmp(this.a, v);
      case 'CPX': return this.cmp(this.x, v);
      case 'CPY': return this.cmp(this.y, v);
      case 'BIT':
        this.p = (this.p & ~(N | V | Z)) | (v & 0xc0) | (this.a & v ? 0 : Z);
        return;
    }
  }

  desplazar(mn, v) {
    let r;
    switch (mn) {
      case 'ASL': this.p = (this.p & ~C) | (v >> 7); r = v << 1; break;
      case 'LSR': this.p = (this.p & ~C) | (v & 1); r = v >> 1; break;
      case 'ROL': r = (v << 1) | (this.p & C); this.p = (this.p & ~C) | (v >> 7); break;
      case 'ROR': r = (v >> 1) | ((this.p & C) << 7); this.p = (this.p & ~C) | (v & 1); break;
      case 'INC': r = v + 1; break;
      case 'DEC': r = v - 1; break;
    }
    return this.nz(r);
  }

  ejecutar(mn, modo) {
    if (modo === 'imm') {
      this.alu(mn, this.op8());
      return;
    }
    if (modo === 'acc') {
      this.r(this.pc, F_FANTASMA);
      this.a = this.desplazar(mn, this.a);
      return;
    }
    if (LECTURA.has(mn)) {
      const dir = this.direccion(modo, false);
      this.alu(mn, this.r(dir));
      return;
    }
    if (ESCRITURA.has(mn)) {
      const dir = this.direccion(modo, true);
      this.w(dir, mn === 'STA' ? this.a : mn === 'STX' ? this.x : this.y);
      return;
    }
    if (RMW.has(mn)) {
      const dir = this.direccion(modo, true);
      const v = this.r(dir);
      this.w(dir, v, F_FANTASMA);
      this.w(dir, this.desplazar(mn, v));
      return;
    }
    if (modo === 'rel') {
      const off = this.op8();
      const cond = {
        BCC: !(this.p & C), BCS: !!(this.p & C), BNE: !(this.p & Z), BEQ: !!(this.p & Z),
        BPL: !(this.p & N), BMI: !!(this.p & N), BVC: !(this.p & V), BVS: !!(this.p & V),
      }[mn];
      if (!cond) return;
      // a taken branch without page crossing does not poll interrupts on its last cycle
      const sondeoN = this.nmiSondeo;
      const sondeoI = this.irqSondeo;
      this.r(this.pc, F_FANTASMA);
      const dest = (this.pc + (off < 0x80 ? off : off - 0x100)) & 0xffff;
      if ((dest & 0xff00) !== (this.pc & 0xff00)) {
        this.r((this.pc & 0xff00) | (dest & 0xff), F_FANTASMA);
      } else {
        this.nmiSondeo = sondeoN;
        this.irqSondeo = sondeoI;
      }
      this.pc = dest;
      return;
    }
    switch (mn) {
      case 'JMP':
        if (modo === 'abs') {
          const lo = this.op8();
          const hi = this.r(this.pc, F_OPERANDO);
          this.pc = lo | (hi << 8);
        } else {
          const lo = this.op8();
          const hi = this.op8();
          const p = lo | (hi << 8);
          const plo = this.r(p);
          const phi = this.r((p & 0xff00) | ((p + 1) & 0xff));
          this.pc = plo | (phi << 8);
        }
        return;
      case 'JSR': {
        const lo = this.op8();
        this.r(0x100 | this.s, F_FANTASMA);
        this.push(this.pc >> 8);
        this.push(this.pc & 0xff);
        const hi = this.r(this.pc, F_OPERANDO);
        this.pc = lo | (hi << 8);
        return;
      }
      case 'RTS': {
        this.r(this.pc, F_FANTASMA);
        this.r(0x100 | this.s, F_FANTASMA);
        this.s = (this.s + 1) & 0xff;
        const lo = this.r(0x100 | this.s);
        this.s = (this.s + 1) & 0xff;
        const hi = this.r(0x100 | this.s);
        this.pc = lo | (hi << 8);
        this.r(this.pc, F_FANTASMA);
        this.pc = (this.pc + 1) & 0xffff;
        return;
      }
      case 'RTI': {
        this.r(this.pc, F_FANTASMA);
        this.r(0x100 | this.s, F_FANTASMA);
        this.s = (this.s + 1) & 0xff;
        this.p = (this.r(0x100 | this.s) & ~B) | U;
        this.s = (this.s + 1) & 0xff;
        const lo = this.r(0x100 | this.s);
        this.s = (this.s + 1) & 0xff;
        const hi = this.r(0x100 | this.s);
        this.pc = lo | (hi << 8);
        return;
      }
      case 'BRK':
        this.r(this.pc, F_OPERANDO);
        this.pc = (this.pc + 1) & 0xffff;
        this.interrupcion(0xfffe, true);
        return;
      case 'PHA':
      case 'PHP':
        this.r(this.pc, F_FANTASMA);
        this.push(mn === 'PHA' ? this.a : this.p | B | U);
        return;
      case 'PLA':
      case 'PLP': {
        this.r(this.pc, F_FANTASMA);
        this.r(0x100 | this.s, F_FANTASMA);
        this.s = (this.s + 1) & 0xff;
        const v = this.r(0x100 | this.s);
        if (mn === 'PLA') this.a = this.nz(v);
        else this.p = (v & ~B) | U;
        return;
      }
    }
    // two-cycle implied instructions
    this.r(this.pc, F_FANTASMA);
    switch (mn) {
      case 'CLC': this.p &= ~C; break;
      case 'SEC': this.p |= C; break;
      case 'CLI': this.p &= ~I; break;
      case 'SEI': this.p |= I; break;
      case 'CLV': this.p &= ~V; break;
      case 'CLD': this.p &= ~D; break;
      case 'SED': this.p |= D; break;
      case 'TAX': this.x = this.nz(this.a); break;
      case 'TAY': this.y = this.nz(this.a); break;
      case 'TXA': this.a = this.nz(this.x); break;
      case 'TYA': this.a = this.nz(this.y); break;
      case 'TSX': this.x = this.nz(this.s); break;
      case 'TXS': this.s = this.x; break;
      case 'INX': this.x = this.nz(this.x + 1); break;
      case 'INY': this.y = this.nz(this.y + 1); break;
      case 'DEX': this.x = this.nz(this.x - 1); break;
      case 'DEY': this.y = this.nz(this.y - 1); break;
      case 'NOP': break;
      default: throw new Error('sin implementar ' + mn);
    }
  }
}
