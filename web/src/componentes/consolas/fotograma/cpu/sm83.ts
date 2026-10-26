// SM83 disassembler (Game Boy / Game Boy Color CPU) with a generic Spanish explanation of every instruction.

import type { Desensamblador } from '../tipos';

const R8 = ['B', 'C', 'D', 'E', 'H', 'L', '[HL]', 'A'];
const R16 = ['BC', 'DE', 'HL', 'SP'];
const R16P = ['BC', 'DE', 'HL', 'AF'];
const CC = ['NZ', 'Z', 'NC', 'C'];
const CC_ES = ['si el resultado no fue cero (Z = 0)', 'si el resultado fue cero (Z = 1)', 'si no hubo acarreo (C = 0)', 'si hubo acarreo (C = 1)'];
const ALU = ['ADD A,', 'ADC A,', 'SUB', 'SBC A,', 'AND', 'XOR', 'OR', 'CP'];
const ALU_ES = [
  'Suma {o} a A.',
  'Suma {o} y el acarreo a A.',
  'Resta {o} de A.',
  'Resta {o} y el acarreo de A.',
  'Hace el Y lógico de A con {o}.',
  'Hace el O exclusivo de A con {o}{xor}.',
  'Hace el O lógico de A con {o}.',
  'Compara A con {o} (resta sin guardar el resultado).',
];
const ROT = ['RLC', 'RRC', 'RL', 'RR', 'SLA', 'SRA', 'SWAP', 'SRL'];
const ROT_ES = [
  'Rota {o} a la izquierda (el bit 7 va al acarreo y al bit 0).',
  'Rota {o} a la derecha (el bit 0 va al acarreo y al bit 7).',
  'Rota {o} a la izquierda a través del acarreo.',
  'Rota {o} a la derecha a través del acarreo.',
  'Desplaza {o} a la izquierda (el bit 7 va al acarreo).',
  'Desplaza {o} a la derecha conservando el signo.',
  'Intercambia los dos nibbles de {o}.',
  'Desplaza {o} a la derecha (el bit 0 va al acarreo).',
];

/** Game Boy I/O registers for the explanations ($FF00 + n). */
const IO: Record<number, string> = {
  0x00: 'P1', 0x01: 'SB', 0x02: 'SC', 0x04: 'DIV', 0x05: 'TIMA', 0x06: 'TMA', 0x07: 'TAC', 0x0f: 'IF',
  0x40: 'LCDC', 0x41: 'STAT', 0x42: 'SCY', 0x43: 'SCX', 0x44: 'LY', 0x45: 'LYC', 0x46: 'DMA', 0x47: 'BGP', 0x48: 'OBP0',
  0x49: 'OBP1', 0x4a: 'WY', 0x4b: 'WX', 0x4d: 'KEY1', 0x4f: 'VBK', 0x51: 'HDMA1', 0x52: 'HDMA2', 0x53: 'HDMA3', 0x54: 'HDMA4',
  0x55: 'HDMA5', 0x68: 'BCPS', 0x69: 'BCPD', 0x6a: 'OCPS', 0x6b: 'OCPD', 0x70: 'SVBK', 0xff: 'IE',
};

const h2 = (v: number) => '$' + v.toString(16).toUpperCase().padStart(2, '0');
const h4 = (v: number) => '$' + v.toString(16).toUpperCase().padStart(4, '0');

function nombre(dir: number, etiquetas?: Record<string, string>): string {
  if (dir >= 0xff00 && IO[dir & 0xff]) return IO[dir & 0xff]!;
  return etiquetas?.[dir.toString(16).toUpperCase().padStart(4, '0')] ?? h4(dir);
}

function r8es(r: string): string {
  return r === '[HL]' ? 'el byte de memoria apuntado por HL' : `el registro ${r}`;
}

export const desSm83: Desensamblador = {
  instruccion(leer, pc, etiquetas) {
    const op = leer(pc);
    const n = leer((pc + 1) & 0xffff);
    const nn = n | (leer((pc + 2) & 0xffff) << 8);
    const e = n < 0x80 ? n : n - 0x100;
    const res = (texto: string, bytes: number, explicacion: string) => ({ texto, bytes, explicacion });
    if (op < 0) return res('??', 1, '');
    const x = op >> 6;
    const y = (op >> 3) & 7;
    const z = op & 7;
    const p = y >> 1;
    const q = y & 1;
    if (op === 0xcb) {
      const x2 = n >> 6;
      const y2 = (n >> 3) & 7;
      const r = R8[n & 7]!;
      if (x2 === 0) return res(`${ROT[y2]} ${r}`, 2, ROT_ES[y2]!.replace('{o}', r8es(r)));
      if (x2 === 1) return res(`BIT ${y2},${r}`, 2, `Comprueba el bit ${y2} de ${r8es(r)}: Z = 1 si vale 0.`);
      if (x2 === 2) return res(`RES ${y2},${r}`, 2, `Pone a 0 el bit ${y2} de ${r8es(r)}.`);
      return res(`SET ${y2},${r}`, 2, `Pone a 1 el bit ${y2} de ${r8es(r)}.`);
    }
    if (x === 1) {
      if (op === 0x76) return res('HALT', 1, 'Detiene la CPU hasta que llegue una interrupción.');
      const d = R8[y]!;
      const s = R8[z]!;
      return res(`LD ${d},${s}`, 1, `Copia ${r8es(s)} en ${r8es(d)}.`);
    }
    if (x === 2) {
      const r = R8[z]!;
      return res(`${ALU[y]} ${r}`.replace(', ', ','), 1, ALU_ES[y]!.replace('{o}', r8es(r)).replace('{xor}', y === 5 && z === 7 ? ': A queda a 0' : ''));
    }
    if (x === 3 && z === 6) return res(`${ALU[y]} ${h2(n)}`.replace(', ', ','), 2, ALU_ES[y]!.replace('{o}', `el valor ${h2(n)} (${n})`).replace('{xor}', ''));
    if (x === 0) {
      switch (z) {
        case 0:
          if (y === 0) return res('NOP', 1, 'No hace nada (un ciclo de máquina).');
          if (y === 1) return res(`LD [${h4(nn)}],SP`, 3, `Guarda el puntero de pila en ${h4(nn)}–${h4(nn + 1)}.`);
          if (y === 2) return res('STOP', 2, 'Para la CPU y el reloj (en la CGB, también cambia de velocidad si se pidió en KEY1).');
          {
            const dest = (pc + 2 + e) & 0xffff;
            if (y === 3) return res(`JR ${nombre(dest, etiquetas)}`, 2, `Salta a ${nombre(dest, etiquetas)} (${e >= 0 ? '+' : ''}${e} bytes).`);
            return res(`JR ${CC[y - 4]},${nombre(dest, etiquetas)}`, 2, `Salta a ${nombre(dest, etiquetas)} ${CC_ES[y - 4]}.`);
          }
        case 1:
          if (q === 0) return res(`LD ${R16[p]},${nombre(nn, etiquetas)}`, 3, `Carga ${nombre(nn, etiquetas)}${nombre(nn, etiquetas) === h4(nn) ? '' : ` (${h4(nn)})`} en el par ${R16[p]}.`);
          return res(`ADD HL,${R16[p]}`, 1, `Suma ${R16[p]} a HL.`);
        case 2: {
          const dir = ['[BC]', '[DE]', '[HL+]', '[HL-]'][p]!;
          const extra = p === 2 ? ' y suma 1 a HL' : p === 3 ? ' y resta 1 a HL' : '';
          if (q === 0) return res(`LD ${dir},A`, 1, `Guarda A en la posición apuntada por ${dir.slice(1, 3)}${extra}.`);
          return res(`LD A,${dir}`, 1, `Carga en A el byte apuntado por ${dir.slice(1, 3)}${extra}.`);
        }
        case 3:
          return res(`${q ? 'DEC' : 'INC'} ${R16[p]}`, 1, `${q ? 'Resta' : 'Suma'} 1 al par ${R16[p]} (no cambia las banderas).`);
        case 4:
          return res(`INC ${R8[y]}`, 1, `Suma 1 a ${r8es(R8[y]!)}.`);
        case 5:
          return res(`DEC ${R8[y]}`, 1, `Resta 1 a ${r8es(R8[y]!)}.`);
        case 6:
          return res(`LD ${R8[y]},${h2(n)}`, 2, `Carga el valor ${h2(n)} (${n}) en ${r8es(R8[y]!)}.`);
        case 7:
          return res(['RLCA', 'RRCA', 'RLA', 'RRA', 'DAA', 'CPL', 'SCF', 'CCF'][y]!, 1, [
            'Rota A a la izquierda.', 'Rota A a la derecha.', 'Rota A a la izquierda a través del acarreo.', 'Rota A a la derecha a través del acarreo.',
            'Ajusta A a decimal codificado en binario tras una suma o resta.', 'Invierte todos los bits de A.', 'Pone a 1 el acarreo.', 'Invierte el acarreo.',
          ][y]!);
      }
    }
    // x === 3
    switch (z) {
      case 0:
        if (y < 4) return res(`RET ${CC[y]}`, 1, `Vuelve de la subrutina ${CC_ES[y]}.`);
        if (y === 4) return res(`LDH [${nombre(0xff00 | n, etiquetas)}],A`, 2, `Guarda A en el registro ${nombre(0xff00 | n, etiquetas)} (${h4(0xff00 | n)}).`);
        if (y === 6) return res(`LDH A,[${nombre(0xff00 | n, etiquetas)}]`, 2, `Carga en A el registro ${nombre(0xff00 | n, etiquetas)} (${h4(0xff00 | n)}).`);
        if (y === 5) return res(`ADD SP,${e}`, 2, `Suma ${e} al puntero de pila.`);
        return res(`LD HL,SP${e >= 0 ? '+' : ''}${e}`, 2, `Carga en HL el puntero de pila más ${e}.`);
      case 1:
        if (q === 0) return res(`POP ${R16P[p]}`, 1, `Saca dos bytes de la pila y los pone en ${R16P[p]}.`);
        if (p === 0) return res('RET', 1, 'Vuelve de la subrutina: saca de la pila la dirección de vuelta.');
        if (p === 1) return res('RETI', 1, 'Vuelve de la interrupción y reactiva las interrupciones (IME = 1).');
        if (p === 2) return res('JP HL', 1, 'Salta a la dirección que hay en HL.');
        return res('LD SP,HL', 1, 'Copia HL en el puntero de pila.');
      case 2:
        if (y < 4) return res(`JP ${CC[y]},${nombre(nn, etiquetas)}`, 3, `Salta a ${nombre(nn, etiquetas)} ${CC_ES[y]}.`);
        if (y === 4) return res('LDH [C],A', 1, 'Guarda A en el registro $FF00 + C.');
        if (y === 6) return res('LDH A,[C]', 1, 'Carga en A el registro $FF00 + C.');
        if (y === 5) return res(`LD [${nombre(nn, etiquetas)}],A`, 3, `Guarda A en ${nombre(nn, etiquetas)}${nombre(nn, etiquetas) === h4(nn) ? '' : ` (${h4(nn)})`}.`);
        return res(`LD A,[${nombre(nn, etiquetas)}]`, 3, `Carga en A el byte de ${nombre(nn, etiquetas)}${nombre(nn, etiquetas) === h4(nn) ? '' : ` (${h4(nn)})`}.`);
      case 3:
        if (y === 0) return res(`JP ${nombre(nn, etiquetas)}`, 3, `Salta a ${nombre(nn, etiquetas)}.`);
        if (y === 6) return res('DI', 1, 'Desactiva las interrupciones (IME = 0).');
        if (y === 7) return res('EI', 1, 'Activa las interrupciones tras la instrucción siguiente.');
        return res(`.db ${h2(op)}`, 1, 'Código de operación que no existe en el SM83.');
      case 4:
        if (y < 4) return res(`CALL ${CC[y]},${nombre(nn, etiquetas)}`, 3, `Llama a ${nombre(nn, etiquetas)} ${CC_ES[y]}.`);
        return res(`.db ${h2(op)}`, 1, 'Código de operación que no existe en el SM83.');
      case 5:
        if (q === 0) return res(`PUSH ${R16P[p]}`, 1, `Guarda ${R16P[p]} en la pila.`);
        if (p === 0) return res(`CALL ${nombre(nn, etiquetas)}`, 3, `Llama a la subrutina ${nombre(nn, etiquetas)}: guarda en la pila la dirección de vuelta.`);
        return res(`.db ${h2(op)}`, 1, 'Código de operación que no existe en el SM83.');
      default:
        return res(`RST ${h2(y * 8)}`, 1, `Llama a la subrutina de ${h4(y * 8)}.`);
    }
  },
};

export default desSm83;
