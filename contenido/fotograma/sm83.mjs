// SM83 core (the CPU of the Game Boy and Game Boy Color SoCs), exact to the machine cycle (M-cycle) for the
// «Un fotograma» traces: every M-cycle is one bus read, one bus write or one internal cycle, in the order of the
// real chip (Pan Docs «CPU Instruction Set», Gekkio's «Game Boy: Complete Technical Reference», appendix «Instruction
// set» with the cycle-by-cycle tables). Validated against SingleStepTests sm83 (registers, memory and the bus
// activity of every M-cycle): contenido/fotograma/validarSm83.mjs.
//
// Bus object: leer(dir, tipo) / escribir(dir, valor, tipo) / interno(tipo): one M-cycle each.
// `tipo` uses the trace flags: 2 opcode fetch, 4 internal cycle, 16 interrupt vector, 64 operand.

export const F_SYNC = 2;
export const F_INTERNO_CICLO = 4;
export const F_VECTOR = 16;
export const F_OPERANDO = 64;

const FZ = 0x80, FN = 0x40, FH = 0x20, FC = 0x10;

export class Sm83 {
  constructor(bus) {
    this.bus = bus;
    this.a = 0; this.f = 0; this.b = 0; this.c = 0; this.d = 0; this.e = 0; this.h = 0; this.l = 0;
    this.sp = 0; this.pc = 0;
    this.ime = 0;
    this.eiPendiente = false;
    this.halt = false;
    this.parado = false;
    this.cpuCgb = false;
    this.mciclos = 0;
    /** IE and IF live in the system; the system gives `interrupciones()` = IE & IF & 0x1F. */
    this.pendientes = () => 0;
    this.aceptar = () => {};
  }

  r(a, t = 0) {
    this.mciclos++;
    return this.bus.leer(a & 0xffff, t);
  }
  w(a, v, t = 0) {
    this.mciclos++;
    this.bus.escribir(a & 0xffff, v & 0xff, t);
  }
  i(t = F_INTERNO_CICLO) {
    this.mciclos++;
    this.bus.interno(t);
  }

  get bc() { return (this.b << 8) | this.c; }
  get de() { return (this.d << 8) | this.e; }
  get hl() { return (this.h << 8) | this.l; }
  set bc(v) { this.b = (v >> 8) & 0xff; this.c = v & 0xff; }
  set de(v) { this.d = (v >> 8) & 0xff; this.e = v & 0xff; }
  set hl(v) { this.h = (v >> 8) & 0xff; this.l = v & 0xff; }

  n8() {
    const v = this.r(this.pc, F_OPERANDO);
    this.pc = (this.pc + 1) & 0xffff;
    return v;
  }
  n16() {
    const lo = this.n8();
    return lo | (this.n8() << 8);
  }

  // r8 by index: B C D E H L (HL) A
  get8(k) {
    switch (k) {
      case 0: return this.b;
      case 1: return this.c;
      case 2: return this.d;
      case 3: return this.e;
      case 4: return this.h;
      case 5: return this.l;
      case 6: return this.r(this.hl);
      default: return this.a;
    }
  }
  set8(k, v) {
    v &= 0xff;
    switch (k) {
      case 0: this.b = v; break;
      case 1: this.c = v; break;
      case 2: this.d = v; break;
      case 3: this.e = v; break;
      case 4: this.h = v; break;
      case 5: this.l = v; break;
      case 6: this.w(this.hl, v); break;
      default: this.a = v;
    }
  }
  get16(p) {
    return [this.bc, this.de, this.hl, this.sp][p];
  }
  set16(p, v) {
    v &= 0xffff;
    if (p === 0) this.bc = v;
    else if (p === 1) this.de = v;
    else if (p === 2) this.hl = v;
    else this.sp = v;
  }

  cond(y) {
    switch (y & 3) {
      case 0: return !(this.f & FZ);
      case 1: return !!(this.f & FZ);
      case 2: return !(this.f & FC);
      default: return !!(this.f & FC);
    }
  }

  push16(v) {
    this.sp = (this.sp - 1) & 0xffff;
    this.w(this.sp, v >> 8);
    this.sp = (this.sp - 1) & 0xffff;
    this.w(this.sp, v & 0xff);
  }
  pop16() {
    const lo = this.r(this.sp);
    this.sp = (this.sp + 1) & 0xffff;
    const hi = this.r(this.sp);
    this.sp = (this.sp + 1) & 0xffff;
    return lo | (hi << 8);
  }

  alu(op, v) {
    const a = this.a;
    let r;
    switch (op) {
      case 0: // ADD
      case 1: { // ADC
        const c = op === 1 && this.f & FC ? 1 : 0;
        r = a + v + c;
        this.f = (r & 0xff ? 0 : FZ) | ((a & 0xf) + (v & 0xf) + c > 0xf ? FH : 0) | (r > 0xff ? FC : 0);
        this.a = r & 0xff;
        return;
      }
      case 2: // SUB
      case 3: // SBC
      case 7: { // CP
        const c = op === 3 && this.f & FC ? 1 : 0;
        r = a - v - c;
        this.f = (r & 0xff ? 0 : FZ) | FN | ((a & 0xf) - (v & 0xf) - c < 0 ? FH : 0) | (r < 0 ? FC : 0);
        if (op !== 7) this.a = r & 0xff;
        return;
      }
      case 4: this.a = a & v; this.f = (this.a ? 0 : FZ) | FH; return;
      case 5: this.a = a ^ v; this.f = this.a ? 0 : FZ; return;
      case 6: this.a = a | v; this.f = this.a ? 0 : FZ; return;
    }
  }

  cb(op) {
    const x = op >> 6;
    const y = (op >> 3) & 7;
    const z = op & 7;
    let v = this.get8(z);
    if (x === 1) {
      this.f = (this.f & FC) | FH | (v & (1 << y) ? 0 : FZ);
      return;
    }
    if (x === 2) v &= ~(1 << y);
    else if (x === 3) v |= 1 << y;
    else {
      let c = 0;
      switch (y) {
        case 0: c = v >> 7; v = ((v << 1) | c) & 0xff; break; // RLC
        case 1: c = v & 1; v = (v >> 1) | (c << 7); break; // RRC
        case 2: c = v >> 7; v = ((v << 1) | (this.f & FC ? 1 : 0)) & 0xff; break; // RL
        case 3: c = v & 1; v = (v >> 1) | (this.f & FC ? 0x80 : 0); break; // RR
        case 4: c = v >> 7; v = (v << 1) & 0xff; break; // SLA
        case 5: c = v & 1; v = (v >> 1) | (v & 0x80); break; // SRA
        case 6: c = 0; v = ((v << 4) | (v >> 4)) & 0xff; break; // SWAP
        case 7: c = v & 1; v >>= 1; break; // SRL
      }
      this.f = (v ? 0 : FZ) | (c ? FC : 0);
    }
    this.set8(z, v);
  }

  /** Interrupt dispatch: 2 internal M-cycles, push PC (high, low), jump: 5 M-cycles. Returns the vector. */
  despachar() {
    this.ime = 0;
    this.i();
    this.i();
    this.sp = (this.sp - 1) & 0xffff;
    this.w(this.sp, this.pc >> 8);
    // the interrupt is chosen after the high byte is pushed (IE may have been overwritten by that push)
    const p = this.pendientes();
    this.sp = (this.sp - 1) & 0xffff;
    this.w(this.sp, this.pc & 0xff);
    let vec = 0;
    if (p) {
      const bit = 31 - Math.clz32(p & -p);
      this.aceptar(bit);
      vec = 0x40 + bit * 8;
    }
    this.pc = vec;
    this.i(F_INTERNO_CICLO | F_VECTOR);
    return vec;
  }

  /** One instruction, interrupt dispatch or halted M-cycle. Returns {tipo: 'ins'|'int'|'halt', pc, op}. */
  paso() {
    if (this.halt) {
      if (this.pendientes()) {
        this.halt = false;
      } else {
        this.i();
        return { tipo: 'halt', pc: this.pc };
      }
    }
    if (this.ime && this.pendientes()) {
      const pc = this.pc;
      const vec = this.despachar();
      return { tipo: 'int', pc, vec };
    }
    if (this.eiPendiente) {
      this.eiPendiente = false;
      this.ime = 1;
    }
    const pc = this.pc;
    const op = this.r(this.pc, F_SYNC);
    this.pc = (this.pc + 1) & 0xffff;
    this.ejecutar(op);
    return { tipo: 'ins', pc, op };
  }

  ejecutar(op) {
    const x = op >> 6;
    const y = (op >> 3) & 7;
    const z = op & 7;
    const p = y >> 1;
    const q = y & 1;
    if (x === 1) {
      if (op === 0x76) {
        this.halt = true;
        return;
      }
      this.set8(y, this.get8(z));
      return;
    }
    if (x === 2) {
      this.alu(y, this.get8(z));
      return;
    }
    if (x === 0) {
      switch (z) {
        case 0:
          if (y === 0) return; // NOP
          if (y === 1) { // LD (nn),SP
            const a = this.n16();
            this.w(a, this.sp & 0xff);
            this.w(a + 1, this.sp >> 8);
            return;
          }
          if (y === 2) { // STOP
            this.n8();
            this.parado = true;
            return;
          }
          { // JR e / JR cc,e
            const e = this.n8();
            if (y === 3 || this.cond(y - 4)) {
              this.i();
              this.pc = (this.pc + (e < 0x80 ? e : e - 0x100)) & 0xffff;
            }
          }
          return;
        case 1:
          if (q === 0) this.set16(p, this.n16());
          else { // ADD HL,rr
            const hl = this.hl;
            const v = this.get16(p);
            const r = hl + v;
            this.f = (this.f & FZ) | ((hl & 0xfff) + (v & 0xfff) > 0xfff ? FH : 0) | (r > 0xffff ? FC : 0);
            this.i();
            this.hl = r & 0xffff;
          }
          return;
        case 2: {
          let a;
          if (p === 0) a = this.bc;
          else if (p === 1) a = this.de;
          else a = this.hl;
          if (q === 0) this.w(a, this.a);
          else this.a = this.r(a);
          if (p === 2) this.hl = (this.hl + 1) & 0xffff;
          if (p === 3) this.hl = (this.hl - 1) & 0xffff;
          return;
        }
        case 3:
          this.i();
          this.set16(p, this.get16(p) + (q ? -1 : 1));
          return;
        case 4:
        case 5: {
          const v = this.get8(y);
          const r = (v + (z === 4 ? 1 : -1)) & 0xff;
          if (z === 4) this.f = (this.f & FC) | (r ? 0 : FZ) | ((v & 0xf) === 0xf ? FH : 0);
          else this.f = (this.f & FC) | FN | (r ? 0 : FZ) | ((v & 0xf) === 0 ? FH : 0);
          this.set8(y, r);
          return;
        }
        case 6:
          this.set8(y, this.n8());
          return;
        case 7: {
          const a = this.a;
          switch (y) {
            case 0: { const c = a >> 7; this.a = ((a << 1) | c) & 0xff; this.f = c ? FC : 0; return; } // RLCA
            case 1: { const c = a & 1; this.a = (a >> 1) | (c << 7); this.f = c ? FC : 0; return; } // RRCA
            case 2: { const c = a >> 7; this.a = ((a << 1) | (this.f & FC ? 1 : 0)) & 0xff; this.f = c ? FC : 0; return; } // RLA
            case 3: { const c = a & 1; this.a = (a >> 1) | (this.f & FC ? 0x80 : 0); this.f = c ? FC : 0; return; } // RRA
            case 4: { // DAA
              let v = a;
              let c = this.f & FC;
              if (!(this.f & FN)) {
                if (c || v > 0x99) { v += 0x60; c = FC; }
                if (this.f & FH || (v & 0xf) > 9) v += 6;
              } else {
                if (c) v -= 0x60;
                if (this.f & FH) v -= 6;
              }
              v &= 0xff;
              this.a = v;
              this.f = (this.f & FN) | (v ? 0 : FZ) | c;
              return;
            }
            case 5: this.a = a ^ 0xff; this.f |= FN | FH; return; // CPL
            case 6: this.f = (this.f & FZ) | FC; return; // SCF
            case 7: this.f = (this.f & FZ) | (this.f & FC ? 0 : FC); return; // CCF
          }
        }
      }
    }
    // x === 3
    switch (z) {
      case 0:
        if (y < 4) { // RET cc
          this.i();
          if (this.cond(y)) {
            this.pc = this.pop16();
            this.i();
          }
          return;
        }
        if (y === 4) { this.w(0xff00 | this.n8(), this.a); return; } // LDH (n),A
        if (y === 6) { this.a = this.r(0xff00 | this.n8()); return; } // LDH A,(n)
        { // ADD SP,e (y=5) / LD HL,SP+e (y=7)
          const e = this.n8();
          const s = e < 0x80 ? e : e - 0x100;
          const sp = this.sp;
          const r = (sp + s) & 0xffff;
          this.f = ((sp & 0xf) + (e & 0xf) > 0xf ? FH : 0) | ((sp & 0xff) + e > 0xff ? FC : 0);
          this.i();
          if (y === 5) {
            this.i();
            this.sp = r;
          } else this.hl = r;
        }
        return;
      case 1:
        if (q === 0) { // POP rr
          const v = this.pop16();
          if (p === 3) { this.a = v >> 8; this.f = v & 0xf0; } else this.set16(p, v);
          return;
        }
        if (p === 0 || p === 1) { // RET / RETI
          this.pc = this.pop16();
          this.i();
          if (p === 1) this.ime = 1;
          return;
        }
        if (p === 2) { this.pc = this.hl; return; } // JP HL
        this.i(); // LD SP,HL
        this.sp = this.hl;
        return;
      case 2:
        if (y < 4) { // JP cc,nn
          const a = this.n16();
          if (this.cond(y)) {
            this.i();
            this.pc = a;
          }
          return;
        }
        if (y === 4) { this.w(0xff00 | this.c, this.a); return; } // LDH (C),A
        if (y === 6) { this.a = this.r(0xff00 | this.c); return; } // LDH A,(C)
        if (y === 5) { this.w(this.n16(), this.a); return; } // LD (nn),A
        this.a = this.r(this.n16()); // LD A,(nn)
        return;
      case 3:
        if (y === 0) { const a = this.n16(); this.i(); this.pc = a; return; } // JP nn
        if (y === 1) { this.cb(this.r(this.pc, F_OPERANDO)); this.pc = (this.pc + 1) & 0xffff; return; } // CB prefix
        if (y === 6) { this.ime = 0; this.eiPendiente = false; return; } // DI
        if (y === 7) { this.eiPendiente = true; return; } // EI
        throw new Error(`Código de operación inexistente $${op.toString(16)}`);
      case 4:
        if (y < 4) { // CALL cc,nn
          const a = this.n16();
          if (this.cond(y)) {
            this.i();
            this.push16(this.pc);
            this.pc = a;
          }
          return;
        }
        throw new Error(`Código de operación inexistente $${op.toString(16)}`);
      case 5:
        if (q === 0) { // PUSH rr
          this.i();
          this.push16(p === 3 ? (this.a << 8) | this.f : this.get16(p));
          return;
        }
        if (p === 0) { // CALL nn
          const a = this.n16();
          this.i();
          this.push16(this.pc);
          this.pc = a;
          return;
        }
        throw new Error(`Código de operación inexistente $${op.toString(16)}`);
      case 6:
        this.alu(y, this.n8());
        return;
      case 7: // RST
        this.i();
        this.push16(this.pc);
        this.pc = y * 8;
        return;
    }
  }
}

// ------------------------------------------------------------------ instruction lengths (for the explanations)
export function largoSm83(op) {
  if (op === 0xcb) return 2;
  const x = op >> 6;
  const z = op & 7;
  const y = (op >> 3) & 7;
  if (x === 0) {
    if (z === 0) return y === 1 ? 3 : y === 0 ? 1 : 2;
    if (z === 1) return y & 1 ? 1 : 3;
    if (z === 6) return 2;
    return 1;
  }
  if (x === 3) {
    if (z === 0) return y >= 4 ? 2 : 1;
    if (z === 2) return y < 4 || y === 5 || y === 7 ? 3 : 1;
    if (z === 3) return y === 0 ? 3 : 1;
    if (z === 4) return 3;
    if (z === 5) return y & 1 ? (y === 1 ? 3 : 1) : 1;
    if (z === 6) return 2;
  }
  return 1;
}
