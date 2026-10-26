// 68000 disassembler (the whole 68000 set, Motorola syntax) with a generic Spanish explanation of every
// instruction, for the Mega Drive and the Neo Geo. `crearDesM68k(nombres)` adds the names of a machine's
// registers to the explanations when an instruction uses their absolute address.

import type { Desensamblador, InstruccionDesensamblada } from '../tipos';

const h = (v: number, n = 0) => '$' + (v >>> 0).toString(16).toUpperCase().padStart(n, '0');
const s8 = (v: number) => (v & 0x80 ? v - 0x100 : v);
const s16 = (v: number) => (v & 0x8000 ? v - 0x10000 : v);
const TAM = ['.b', '.w', '.l'];
const CC = ['T', 'F', 'HI', 'LS', 'CC', 'CS', 'NE', 'EQ', 'VC', 'VS', 'PL', 'MI', 'GE', 'LT', 'GT', 'LE'];
const CC_TXT = ['siempre', 'nunca', 'es mayor (sin signo)', 'es menor o igual (sin signo)', 'no hay acarreo', 'hay acarreo', 'no es igual (Z = 0)', 'es igual (Z = 1)', 'no hay desbordamiento', 'hay desbordamiento', 'es positivo', 'es negativo', 'es mayor o igual', 'es menor', 'es mayor', 'es menor o igual'];

interface Ctx {
  leer: (d: number) => number;
  pc: number;
  pos: number;
  etiquetas?: Record<string, string>;
  nombres: Record<number, string>;
  usadas: number[];
}

function w(c: Ctx): number {
  const a = (c.pc + c.pos) & 0xffffff;
  const v = (Math.max(0, c.leer(a)) << 8) | Math.max(0, c.leer(a + 1));
  c.pos += 2;
  return v;
}
function l32(c: Ctx): number {
  return ((w(c) << 16) | w(c)) >>> 0;
}
function conEtiqueta(c: Ctx, dir: number): string {
  const k = (dir & 0xffffff).toString(16).toUpperCase().padStart(4, '0');
  const e = c.etiquetas?.[k];
  return e ? `${h(dir)} (${e})` : h(dir);
}

/** Effective address text; reads its extension words. */
function ea(c: Ctx, modo: number, reg: number, tam: number): string {
  switch (modo) {
    case 0: return `D${reg}`;
    case 1: return `A${reg}`;
    case 2: return `(A${reg})`;
    case 3: return `(A${reg})+`;
    case 4: return `-(A${reg})`;
    case 5: return `${s16(w(c))}(A${reg})`;
    case 6: {
      const e = w(c);
      return `${s8(e & 0xff)}(A${reg},${e & 0x8000 ? 'A' : 'D'}${(e >> 12) & 7}${e & 0x800 ? '.l' : '.w'})`;
    }
    default:
      switch (reg) {
        case 0: { const a = s16(w(c)) & 0xffffff; c.usadas.push(a); return `(${conEtiqueta(c, a)}).w`; }
        case 1: { const a = l32(c) & 0xffffff; c.usadas.push(a); return `(${conEtiqueta(c, a)}).l`; }
        case 2: { const base = c.pc + c.pos; const d = s16(w(c)); return `${conEtiqueta(c, (base + d) & 0xffffff)}(PC)`; }
        case 3: { const e = w(c); return `${s8(e & 0xff)}(PC,${e & 0x8000 ? 'A' : 'D'}${(e >> 12) & 7}${e & 0x800 ? '.l' : '.w'})`; }
        case 4: return tam === 2 ? '#' + h(l32(c)) : tam === 1 ? '#' + h(w(c)) : '#' + h(w(c) & 0xff);
        default: return '?';
      }
  }
}

function listaRegs(m: number, pre: boolean): string {
  const out: string[] = [];
  for (let i = 0; i < 16; i++) {
    const bit = pre ? 15 - i : i;
    if (m & (1 << bit)) out.push((i < 8 ? 'D' : 'A') + (i & 7));
  }
  return out.join('/');
}

const TXT: Record<string, string> = {
  MOVE: 'Copia {s} en {d}.',
  MOVEA: 'Copia {s} en el registro de direcciones {d}.',
  MOVEQ: 'Carga {s} (extendido a 32 bits) en {d}: una sola palabra de código.',
  LEA: 'Calcula la dirección {s} y la guarda en {d}, sin leer la memoria.',
  PEA: 'Calcula la dirección {s} y la guarda en la pila.',
  CLR: 'Pone {d} a cero.',
  TST: 'Compara {d} con cero: solo cambian las banderas.',
  ADD: 'Suma {s} a {d}.', ADDA: 'Suma {s} a {d} (32 bits, sin banderas).', ADDQ: 'Suma {s} a {d}.', ADDI: 'Suma {s} a {d}.', ADDX: 'Suma {s} y la bandera X a {d}.',
  SUB: 'Resta {s} de {d}.', SUBA: 'Resta {s} de {d} (32 bits, sin banderas).', SUBQ: 'Resta {s} de {d}.', SUBI: 'Resta {s} de {d}.', SUBX: 'Resta {s} y la bandera X de {d}.',
  CMP: 'Compara {d} con {s}: resta sin guardar el resultado.', CMPA: 'Compara {d} con {s}.', CMPI: 'Compara {d} con {s}.', CMPM: 'Compara dos posiciones de memoria.',
  AND: 'Y lógico de {s} con {d}.', ANDI: 'Y lógico de {s} con {d}.', OR: 'O lógico de {s} con {d}.', ORI: 'O lógico de {s} con {d}.',
  EOR: 'O exclusivo de {s} con {d}.', EORI: 'O exclusivo de {s} con {d}.', NOT: 'Invierte los bits de {d}.', NEG: 'Cambia el signo de {d}.', NEGX: 'Cambia el signo de {d} con la bandera X.',
  EXT: 'Extiende el signo de {d}.', SWAP: 'Intercambia las dos mitades de 16 bits de {d}.', EXG: 'Intercambia {s} y {d}.',
  MULU: 'Multiplica (sin signo, 16 × 16 bits) {d} por {s}: tarda hasta 70 ciclos.', MULS: 'Multiplica (con signo) {d} por {s}.',
  DIVU: 'Divide (sin signo) {d} entre {s}: hasta 140 ciclos.', DIVS: 'Divide (con signo) {d} entre {s}.',
  BTST: 'Comprueba el bit {s} de {d}: Z = 1 si está a 0.', BSET: 'Pone a 1 el bit {s} de {d}.', BCLR: 'Pone a 0 el bit {s} de {d}.', BCHG: 'Invierte el bit {s} de {d}.',
  LSL: 'Desplaza {d} a la izquierda {s} bits.', LSR: 'Desplaza {d} a la derecha {s} bits (entran ceros).', ASL: 'Desplaza {d} a la izquierda {s} bits.', ASR: 'Desplaza {d} a la derecha {s} bits conservando el signo.',
  ROL: 'Gira {d} a la izquierda {s} bits.', ROR: 'Gira {d} a la derecha {s} bits.', ROXL: 'Gira {d} a la izquierda a través de X.', ROXR: 'Gira {d} a la derecha a través de X.',
  JMP: 'Salta a {d}: la cola de prebúsqueda se vacía y se llena desde allí.', JSR: 'Guarda la dirección de vuelta en la pila y salta a la subrutina {d}.',
  BRA: 'Salto relativo a {d}.', BSR: 'Guarda la dirección de vuelta en la pila y salta a la subrutina {d}.',
  RTS: 'Vuelve de la subrutina: lee la dirección de vuelta de la pila.', RTE: 'Vuelve de la excepción: recupera de la pila el registro de estado (SR) y el PC.', RTR: 'Recupera CCR y PC de la pila.',
  NOP: 'No hace nada (4 ciclos).', STOP: 'Carga {s} en SR y para la CPU sin usar el bus hasta que llega una interrupción permitida.',
  RESET: 'Activa la patilla /RESET para reiniciar los periféricos.', TRAP: 'Excepción de programa con el vector {s}.', TRAPV: 'Excepción si hay desbordamiento.',
  LINK: 'Reserva un marco de pila: guarda {s}, copia SP en él y resta {d}.', UNLK: 'Libera el marco de pila de {d}.',
  MOVEM: 'Copia varios registros ({s}) a o desde la memoria ({d}), una palabra o dos por registro.',
  MOVEP: 'Copia bytes alternos entre un registro y la memoria (para periféricos de 8 bits).',
  CHK: 'Excepción si {d} se sale del rango 0..{s}.', TAS: 'Comprueba y pone a 1 el bit 7 de {d} en un ciclo de lectura-modificación-escritura indivisible.',
  ABCD: 'Suma en BCD.', SBCD: 'Resta en BCD.', NBCD: 'Cambia el signo en BCD.',
  ILLEGAL: 'Instrucción ilegal: excepción.',
};

function decodificar(c: Ctx): { texto: string; explicacion: string } {
  const op = w(c);
  const top = op >> 12;
  const reg9 = (op >> 9) & 7;
  const modo = (op >> 3) & 7;
  const reg = op & 7;
  const tam6 = (op >> 6) & 3;
  const mk = (mn: string, suf: string, s: string, d: string, explicacion?: string) => {
    const base = mn.replace(/\..*$/, '');
    const t = s && d ? `${mn}${suf} ${s},${d}` : s || d ? `${mn}${suf} ${s || d}` : mn + suf;
    const e = explicacion ?? (TXT[base] ?? `Instrucción ${base}.`).replace('{s}', s).replace('{d}', d || s);
    return { texto: t, explicacion: e };
  };

  if (top === 0) {
    if (op & 0x100) {
      if (modo === 1) {
        const tamM = op & 0x40 ? '.l' : '.w';
        const desp = s16(w(c));
        const haciaMem = !!(op & 0x80);
        return mk('MOVEP', tamM, haciaMem ? `D${reg9}` : `${desp}(A${reg})`, haciaMem ? `${desp}(A${reg})` : `D${reg9}`);
      }
      const bop = ['BTST', 'BCHG', 'BCLR', 'BSET'][tam6]!;
      return mk(bop, '', `D${reg9}`, ea(c, modo, reg, 0));
    }
    if (reg9 === 4) {
      const n = w(c) & 0xff;
      const bop = ['BTST', 'BCHG', 'BCLR', 'BSET'][tam6]!;
      return mk(bop, '', '#' + n, ea(c, modo, reg, 0));
    }
    const nombre = ['ORI', 'ANDI', 'SUBI', 'ADDI', '', 'EORI', 'CMPI', ''][reg9]!;
    if (!nombre || tam6 === 3) return { texto: `DC.W ${h(op, 4)}`, explicacion: 'Palabra que no es una instrucción del 68000.' };
    if (modo === 7 && reg === 4) {
      const v = w(c);
      const dst = tam6 === 0 ? 'CCR' : 'SR';
      return mk(nombre, '', '#' + h(tam6 === 0 ? v & 0xff : v), dst);
    }
    const imm = tam6 === 2 ? l32(c) : tam6 === 1 ? w(c) : w(c) & 0xff;
    return mk(nombre, TAM[tam6]!, '#' + h(imm), ea(c, modo, reg, tam6));
  }
  if (top >= 1 && top <= 3) {
    const tam = top === 1 ? 0 : top === 3 ? 1 : 2;
    const s = ea(c, modo, reg, tam);
    const modoD = (op >> 6) & 7;
    if (modoD === 1) return mk('MOVEA', TAM[tam]!, s, `A${reg9}`);
    const d = ea(c, modoD, reg9, tam);
    return mk('MOVE', TAM[tam]!, s, d);
  }
  if (top === 4) {
    if (op === 0x4e71) return mk('NOP', '', '', '');
    if (op === 0x4e70) return mk('RESET', '', '', '');
    if (op === 0x4e72) return mk('STOP', '', '#' + h(w(c), 4), '');
    if (op === 0x4e73) return mk('RTE', '', '', '');
    if (op === 0x4e75) return mk('RTS', '', '', '');
    if (op === 0x4e76) return mk('TRAPV', '', '', '');
    if (op === 0x4e77) return mk('RTR', '', '', '');
    if (op === 0x4afc) return mk('ILLEGAL', '', '', '');
    if ((op & 0xfff0) === 0x4e40) return mk('TRAP', '', '#' + (op & 15), '');
    if ((op & 0xfff8) === 0x4e50) return mk('LINK', '', `A${reg}`, '#' + s16(w(c)));
    if ((op & 0xfff8) === 0x4e58) return mk('UNLK', '', '', `A${reg}`);
    if ((op & 0xfff0) === 0x4e60) return op & 8 ? mk('MOVE', '', 'USP', `A${reg}`, `Copia el puntero de pila de usuario en A${reg}.`) : mk('MOVE', '', `A${reg}`, 'USP', `Copia A${reg} en el puntero de pila de usuario.`);
    if ((op & 0xffc0) === 0x4e80) return mk('JSR', '', '', ea(c, modo, reg, 2));
    if ((op & 0xffc0) === 0x4ec0) return mk('JMP', '', '', ea(c, modo, reg, 2));
    if ((op & 0xfb80) === 0x4880 && modo !== 0) {
      const mascara = w(c);
      const tamM = op & 0x40 ? '.l' : '.w';
      const e = ea(c, modo, reg, 1);
      return op & 0x400 ? mk('MOVEM', tamM, e, listaRegs(mascara, false)) : mk('MOVEM', tamM, listaRegs(mascara, modo === 4), e);
    }
    if ((op & 0xfff8) === 0x4840) return mk('SWAP', '', '', `D${reg}`);
    if ((op & 0xfff8) === 0x4880) return mk('EXT', '.w', '', `D${reg}`);
    if ((op & 0xfff8) === 0x48c0) return mk('EXT', '.l', '', `D${reg}`);
    if ((op & 0xffc0) === 0x4840) return mk('PEA', '', ea(c, modo, reg, 2), '');
    if ((op & 0xffc0) === 0x4800) return mk('NBCD', '', '', ea(c, modo, reg, 0));
    if ((op & 0xffc0) === 0x40c0) return mk('MOVE', '', 'SR', ea(c, modo, reg, 1), 'Copia el registro de estado (SR) en el destino.');
    if ((op & 0xffc0) === 0x44c0) { const s = ea(c, modo, reg, 1); return mk('MOVE', '', s, 'CCR', `Carga las banderas (CCR) desde ${s}.`); }
    if ((op & 0xffc0) === 0x46c0) { const s = ea(c, modo, reg, 1); return mk('MOVE', '', s, 'SR', `Carga el registro de estado (SR) desde ${s}: cambia el modo y la máscara de interrupciones.`); }
    if ((op & 0xffc0) === 0x4ac0) return mk('TAS', '', '', ea(c, modo, reg, 0));
    if ((op & 0xf1c0) === 0x41c0) return mk('LEA', '', ea(c, modo, reg, 2), `A${reg9}`);
    if ((op & 0xf1c0) === 0x4180) return mk('CHK', '', ea(c, modo, reg, 1), `D${reg9}`);
    if (tam6 !== 3) {
      const nombre = { 0x4000: 'NEGX', 0x4200: 'CLR', 0x4400: 'NEG', 0x4600: 'NOT', 0x4a00: 'TST' }[op & 0xff00];
      if (nombre) return mk(nombre, TAM[tam6]!, '', ea(c, modo, reg, tam6));
    }
    return { texto: `DC.W ${h(op, 4)}`, explicacion: 'Palabra que no es una instrucción del 68000.' };
  }
  if (top === 5) {
    if (tam6 === 3) {
      const cc = (op >> 8) & 15;
      if (modo === 1) {
        const base = c.pc + c.pos;
        const dest = (base + s16(w(c))) & 0xffffff;
        return { texto: `DB${CC[cc]} D${reg},${conEtiqueta(c, dest)}`, explicacion: cc === 1 ? `Resta 1 a D${reg} y salta a ${h(dest)} mientras no pase de 0 a −1: el bucle de contador del 68000.` : `Si ${CC_TXT[cc]}, sigue; si no, resta 1 a D${reg} y salta a ${h(dest)} mientras no llegue a −1.` };
      }
      return { texto: `S${CC[cc]} ${ea(c, modo, reg, 0)}`, explicacion: `Pone el byte a $FF si ${CC_TXT[cc]}, si no a 0.` };
    }
    const n = reg9 || 8;
    return mk(op & 0x100 ? 'SUBQ' : 'ADDQ', TAM[tam6]!, '#' + n, ea(c, modo, reg, tam6));
  }
  if (top === 6) {
    const cc = (op >> 8) & 15;
    const base = c.pc + 2;
    let d = s8(op & 0xff);
    if (d === 0) d = s16(w(c));
    const dest = (base + d) & 0xffffff;
    const t = conEtiqueta(c, dest);
    if (cc === 0) return mk('BRA', '', '', t);
    if (cc === 1) return mk('BSR', '', '', t);
    return { texto: `B${CC[cc]} ${t}`, explicacion: `Salta a ${h(dest)} si ${CC_TXT[cc]}.` };
  }
  if (top === 7) return mk('MOVEQ', '', '#' + s8(op & 0xff), `D${reg9}`);
  if (top === 8 || top === 9 || top === 11 || top === 12 || top === 13) {
    const nombres: Record<number, string> = { 8: 'OR', 9: 'SUB', 11: 'CMP', 12: 'AND', 13: 'ADD' };
    const mn = nombres[top]!;
    const opm = (op >> 6) & 7;
    if (top === 8 && opm === 3) return mk('DIVU', '', ea(c, modo, reg, 1), `D${reg9}`);
    if (top === 8 && opm === 7) return mk('DIVS', '', ea(c, modo, reg, 1), `D${reg9}`);
    if (top === 12 && opm === 3) return mk('MULU', '', ea(c, modo, reg, 1), `D${reg9}`);
    if (top === 12 && opm === 7) return mk('MULS', '', ea(c, modo, reg, 1), `D${reg9}`);
    if ((top === 9 || top === 11 || top === 13) && (opm === 3 || opm === 7)) {
      const t = opm === 3 ? 1 : 2;
      return mk(mn + 'A', TAM[t]!, ea(c, modo, reg, t), `A${reg9}`);
    }
    if (top === 8 && (op & 0x1f0) === 0x100) return mk('SBCD', '', modo & 1 ? `-(A${reg})` : `D${reg}`, modo & 1 ? `-(A${reg9})` : `D${reg9}`);
    if (top === 12 && (op & 0x1f0) === 0x100) return mk('ABCD', '', modo & 1 ? `-(A${reg})` : `D${reg}`, modo & 1 ? `-(A${reg9})` : `D${reg9}`);
    if (top === 12 && (op & 0x1f8) === 0x140) return mk('EXG', '', `D${reg9}`, `D${reg}`);
    if (top === 12 && (op & 0x1f8) === 0x148) return mk('EXG', '', `A${reg9}`, `A${reg}`);
    if (top === 12 && (op & 0x1f8) === 0x188) return mk('EXG', '', `D${reg9}`, `A${reg}`);
    if ((top === 9 || top === 13) && (op & 0x130) === 0x100 && opm >= 4 && opm <= 6) {
      return mk(mn + 'X', TAM[opm - 4]!, modo & 1 ? `-(A${reg})` : `D${reg}`, modo & 1 ? `-(A${reg9})` : `D${reg9}`);
    }
    if (top === 11 && opm >= 4 && opm <= 6) {
      if (modo === 1) return mk('CMPM', TAM[opm - 4]!, `(A${reg})+`, `(A${reg9})+`);
      return mk('EOR', TAM[opm - 4]!, `D${reg9}`, ea(c, modo, reg, opm - 4));
    }
    const t = opm & 3;
    if (opm < 3) return mk(mn, TAM[t]!, ea(c, modo, reg, t), `D${reg9}`);
    return mk(mn, TAM[t]!, `D${reg9}`, ea(c, modo, reg, t));
  }
  if (top === 14) {
    if (tam6 === 3) {
      const tipo = (op >> 9) & 3;
      const mn = ['AS', 'LS', 'ROX', 'RO'][tipo]! + (op & 0x100 ? 'L' : 'R');
      return mk(mn, '.w', '', ea(c, modo, reg, 1));
    }
    const tipo = (op >> 3) & 3;
    const mn = ['AS', 'LS', 'ROX', 'RO'][tipo]! + (op & 0x100 ? 'L' : 'R');
    const cuenta = op & 0x20 ? `D${reg9}` : '#' + (reg9 || 8);
    return mk(mn, TAM[tam6]!, cuenta, `D${reg}`);
  }
  if (top === 10) return { texto: `DC.W ${h(op, 4)}`, explicacion: 'Línea A: excepción de instrucción no implementada (vector 10).' };
  return { texto: `DC.W ${h(op, 4)}`, explicacion: 'Línea F: excepción de instrucción no implementada (vector 11).' };
}

/** A 68000 disassembler that names the given absolute addresses (I/O registers of a machine) in its explanations. */
export function crearDesM68k(nombres: Record<number, string> = {}): Desensamblador {
  return {
    instruccion(leer, pc, etiquetas): InstruccionDesensamblada {
      const c: Ctx = { leer, pc, pos: 0, etiquetas, nombres, usadas: [] };
      const r = decodificar(c);
      let explicacion = r.explicacion;
      const n = c.usadas.map((a) => nombres[a] ?? nombres[a & ~1]).filter(Boolean);
      if (n.length) explicacion += ` ${h(c.usadas[0]!)}: ${n.join('; ')}.`;
      return { texto: r.texto, bytes: c.pos, explicacion };
    },
  };
}


export default crearDesM68k();
