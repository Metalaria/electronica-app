// 6502 disassembler (official opcodes, the 2A03's set) with a generic Spanish explanation of every instruction.

import type { Desensamblador } from '../tipos';

type Modo = 'imp' | 'acc' | 'imm' | 'zp' | 'zpx' | 'zpy' | 'abs' | 'abx' | 'aby' | 'izx' | 'izy' | 'rel' | 'ind';

const TABLA: Record<string, [string, Modo][]> = {
  ADC: [['69', 'imm'], ['65', 'zp'], ['75', 'zpx'], ['6D', 'abs'], ['7D', 'abx'], ['79', 'aby'], ['61', 'izx'], ['71', 'izy']],
  AND: [['29', 'imm'], ['25', 'zp'], ['35', 'zpx'], ['2D', 'abs'], ['3D', 'abx'], ['39', 'aby'], ['21', 'izx'], ['31', 'izy']],
  ASL: [['0A', 'acc'], ['06', 'zp'], ['16', 'zpx'], ['0E', 'abs'], ['1E', 'abx']],
  BCC: [['90', 'rel']], BCS: [['B0', 'rel']], BEQ: [['F0', 'rel']], BMI: [['30', 'rel']], BNE: [['D0', 'rel']], BPL: [['10', 'rel']],
  BVC: [['50', 'rel']], BVS: [['70', 'rel']],
  BIT: [['24', 'zp'], ['2C', 'abs']],
  BRK: [['00', 'imp']],
  CLC: [['18', 'imp']], CLD: [['D8', 'imp']], CLI: [['58', 'imp']], CLV: [['B8', 'imp']],
  CMP: [['C9', 'imm'], ['C5', 'zp'], ['D5', 'zpx'], ['CD', 'abs'], ['DD', 'abx'], ['D9', 'aby'], ['C1', 'izx'], ['D1', 'izy']],
  CPX: [['E0', 'imm'], ['E4', 'zp'], ['EC', 'abs']],
  CPY: [['C0', 'imm'], ['C4', 'zp'], ['CC', 'abs']],
  DEC: [['C6', 'zp'], ['D6', 'zpx'], ['CE', 'abs'], ['DE', 'abx']],
  DEX: [['CA', 'imp']], DEY: [['88', 'imp']],
  EOR: [['49', 'imm'], ['45', 'zp'], ['55', 'zpx'], ['4D', 'abs'], ['5D', 'abx'], ['59', 'aby'], ['41', 'izx'], ['51', 'izy']],
  INC: [['E6', 'zp'], ['F6', 'zpx'], ['EE', 'abs'], ['FE', 'abx']],
  INX: [['E8', 'imp']], INY: [['C8', 'imp']],
  JMP: [['4C', 'abs'], ['6C', 'ind']],
  JSR: [['20', 'abs']],
  LDA: [['A9', 'imm'], ['A5', 'zp'], ['B5', 'zpx'], ['AD', 'abs'], ['BD', 'abx'], ['B9', 'aby'], ['A1', 'izx'], ['B1', 'izy']],
  LDX: [['A2', 'imm'], ['A6', 'zp'], ['B6', 'zpy'], ['AE', 'abs'], ['BE', 'aby']],
  LDY: [['A0', 'imm'], ['A4', 'zp'], ['B4', 'zpx'], ['AC', 'abs'], ['BC', 'abx']],
  LSR: [['4A', 'acc'], ['46', 'zp'], ['56', 'zpx'], ['4E', 'abs'], ['5E', 'abx']],
  NOP: [['EA', 'imp']],
  ORA: [['09', 'imm'], ['05', 'zp'], ['15', 'zpx'], ['0D', 'abs'], ['1D', 'abx'], ['19', 'aby'], ['01', 'izx'], ['11', 'izy']],
  PHA: [['48', 'imp']], PHP: [['08', 'imp']], PLA: [['68', 'imp']], PLP: [['28', 'imp']],
  ROL: [['2A', 'acc'], ['26', 'zp'], ['36', 'zpx'], ['2E', 'abs'], ['3E', 'abx']],
  ROR: [['6A', 'acc'], ['66', 'zp'], ['76', 'zpx'], ['6E', 'abs'], ['7E', 'abx']],
  RTI: [['40', 'imp']], RTS: [['60', 'imp']],
  SBC: [['E9', 'imm'], ['E5', 'zp'], ['F5', 'zpx'], ['ED', 'abs'], ['FD', 'abx'], ['F9', 'aby'], ['E1', 'izx'], ['F1', 'izy']],
  SEC: [['38', 'imp']], SED: [['F8', 'imp']], SEI: [['78', 'imp']],
  STA: [['85', 'zp'], ['95', 'zpx'], ['8D', 'abs'], ['9D', 'abx'], ['99', 'aby'], ['81', 'izx'], ['91', 'izy']],
  STX: [['86', 'zp'], ['96', 'zpy'], ['8E', 'abs']],
  STY: [['84', 'zp'], ['94', 'zpx'], ['8C', 'abs']],
  TAX: [['AA', 'imp']], TAY: [['A8', 'imp']], TSX: [['BA', 'imp']], TXA: [['8A', 'imp']], TXS: [['9A', 'imp']], TYA: [['98', 'imp']],
};

const OPS: ([string, Modo] | undefined)[] = new Array(256);
for (const [mn, lista] of Object.entries(TABLA)) for (const [h, m] of lista) OPS[parseInt(h, 16)] = [mn, m];

const LARGO: Record<Modo, number> = { imp: 1, acc: 1, imm: 2, zp: 2, zpx: 2, zpy: 2, izx: 2, izy: 2, rel: 2, abs: 3, abx: 3, aby: 3, ind: 3 };

/** Names of the NES registers, used in the explanations. */
const REGISTROS: Record<number, string> = {
  0x2000: 'PPUCTRL', 0x2001: 'PPUMASK', 0x2002: 'PPUSTATUS', 0x2003: 'OAMADDR', 0x2004: 'OAMDATA', 0x2005: 'PPUSCROLL',
  0x2006: 'PPUADDR', 0x2007: 'PPUDATA', 0x4014: 'OAMDMA', 0x4016: 'JOY1', 0x4017: 'JOY2',
};

const h2 = (v: number) => '$' + v.toString(16).toUpperCase().padStart(2, '0');
const h4 = (v: number) => '$' + v.toString(16).toUpperCase().padStart(4, '0');

const QUE: Record<string, string> = {
  ADC: 'Suma {o} y el acarreo al acumulador A.',
  SBC: 'Resta {o} (y el acarreo negado) del acumulador A.',
  AND: 'Hace el Y lógico de A con {o}.',
  ORA: 'Hace el O lógico de A con {o}.',
  EOR: 'Hace el O exclusivo de A con {o}.',
  ASL: 'Desplaza {o} un bit a la izquierda (el bit 7 va al acarreo).',
  LSR: 'Desplaza {o} un bit a la derecha (el bit 0 va al acarreo).',
  ROL: 'Rota {o} a la izquierda a través del acarreo.',
  ROR: 'Rota {o} a la derecha a través del acarreo.',
  BIT: 'Comprueba bits de {o}: N y V toman sus bits 7 y 6; Z, el resultado de A AND {o}.',
  CMP: 'Compara A con {o} (resta sin guardar el resultado; cambia N, Z y C).',
  CPX: 'Compara X con {o}.',
  CPY: 'Compara Y con {o}.',
  DEC: 'Resta 1 a {o} (lee, escribe el valor viejo y escribe el nuevo).',
  INC: 'Suma 1 a {o} (lee, escribe el valor viejo y escribe el nuevo).',
  LDA: 'Carga {o} en el acumulador A.',
  LDX: 'Carga {o} en el registro X.',
  LDY: 'Carga {o} en el registro Y.',
  STA: 'Guarda el acumulador A en {o}.',
  STX: 'Guarda X en {o}.',
  STY: 'Guarda Y en {o}.',
  JMP: 'Salta a {o}.',
  JSR: 'Llama a la subrutina {o}: guarda en la pila la dirección de vuelta.',
  RTS: 'Vuelve de la subrutina: saca de la pila la dirección de vuelta.',
  RTI: 'Vuelve de la interrupción: saca de la pila P y el contador de programa.',
  BRK: 'Interrupción por software: guarda PC y P en la pila y salta al vector de $FFFE.',
  BCC: 'Salta a {o} si no hay acarreo (C = 0).',
  BCS: 'Salta a {o} si hay acarreo (C = 1).',
  BEQ: 'Salta a {o} si el último resultado fue cero (Z = 1).',
  BNE: 'Salta a {o} si el último resultado no fue cero (Z = 0).',
  BMI: 'Salta a {o} si el último resultado fue negativo (N = 1).',
  BPL: 'Salta a {o} si el último resultado fue positivo (N = 0).',
  BVC: 'Salta a {o} si no hubo desbordamiento (V = 0).',
  BVS: 'Salta a {o} si hubo desbordamiento (V = 1).',
  CLC: 'Pone a 0 la bandera de acarreo.',
  SEC: 'Pone a 1 la bandera de acarreo.',
  CLI: 'Permite las interrupciones IRQ (I = 0).',
  SEI: 'Desactiva las interrupciones IRQ (I = 1).',
  CLV: 'Pone a 0 la bandera de desbordamiento.',
  CLD: 'Pone a 0 la bandera decimal.',
  SED: 'Pone a 1 la bandera decimal (el 2A03 no tiene modo decimal).',
  TAX: 'Copia A en X.', TAY: 'Copia A en Y.', TXA: 'Copia X en A.', TYA: 'Copia Y en A.',
  TSX: 'Copia el puntero de pila en X.', TXS: 'Copia X en el puntero de pila.',
  INX: 'Suma 1 a X.', INY: 'Suma 1 a Y.', DEX: 'Resta 1 a X.', DEY: 'Resta 1 a Y.',
  PHA: 'Guarda A en la pila.', PHP: 'Guarda P (las banderas) en la pila.',
  PLA: 'Saca un byte de la pila y lo pone en A.', PLP: 'Saca un byte de la pila y lo pone en P.',
  NOP: 'No hace nada (2 ciclos).',
};

function nombre(dir: number, etiquetas?: Record<string, string>): string {
  const e = etiquetas?.[dir.toString(16).toUpperCase().padStart(4, '0')];
  return e ?? REGISTROS[dir] ?? h4(dir);
}

export const des6502: Desensamblador = {
  instruccion(leer, pc, etiquetas) {
    const op = leer(pc);
    const d = op >= 0 ? OPS[op] : undefined;
    if (!d) return { texto: `.byte ${op >= 0 ? h2(op) : '??'}`, bytes: 1, explicacion: 'Byte que no es una instrucción oficial del 6502.' };
    const [mn, modo] = d;
    const b1 = leer((pc + 1) & 0xffff);
    const b2 = leer((pc + 2) & 0xffff);
    const w = b1 | (b2 << 8);
    let txt = '';
    let o = '';
    switch (modo) {
      case 'imp': break;
      case 'acc': txt = 'A'; o = 'el acumulador A'; break;
      case 'imm': txt = '#' + h2(b1); o = `el valor ${h2(b1)} (${b1})`; break;
      case 'zp': txt = nombre(b1, etiquetas).replace(/^\$00/, '$'); o = `la posición ${txt} de la página cero`; break;
      case 'zpx': txt = h2(b1) + ',X'; o = `la posición ${h2(b1)} + X de la página cero`; break;
      case 'zpy': txt = h2(b1) + ',Y'; o = `la posición ${h2(b1)} + Y de la página cero`; break;
      case 'abs': txt = nombre(w, etiquetas); o = txt === h4(w) ? txt : `${txt} (${h4(w)})`; break;
      case 'abx': txt = nombre(w, etiquetas) + ',X'; o = `la posición ${nombre(w, etiquetas)} + X`; break;
      case 'aby': txt = nombre(w, etiquetas) + ',Y'; o = `la posición ${nombre(w, etiquetas)} + Y`; break;
      case 'izx': txt = `(${h2(b1)},X)`; o = `la dirección guardada en ${h2(b1)} + X`; break;
      case 'izy': txt = `(${h2(b1)}),Y`; o = `la dirección guardada en ${h2(b1)}–${h2((b1 + 1) & 0xff)} más Y`; break;
      case 'rel': {
        const dest = (pc + 2 + (b1 < 0x80 ? b1 : b1 - 0x100)) & 0xffff;
        txt = nombre(dest, etiquetas);
        o = txt;
        break;
      }
      case 'ind': txt = `(${nombre(w, etiquetas)})`; o = `la dirección guardada en ${h4(w)}`; break;
    }
    const plantilla = QUE[mn] ?? mn;
    return { texto: txt ? `${mn} ${txt}` : mn, bytes: LARGO[modo], explicacion: plantilla.replace(/\{o\}/g, o) };
  },
};

export default des6502;
