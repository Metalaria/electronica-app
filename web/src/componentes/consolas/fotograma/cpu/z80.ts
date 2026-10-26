// Z80 disassembler (the whole documented set plus the usual undocumented IXH/IXL forms) with a generic Spanish
// explanation of every instruction, for the Master System and the Mega Drive's sound CPU. Decoding follows the
// x/y/z/p/q fields of the opcode («Decoding Z80 opcodes», C. Young / z80.info).

import type { Desensamblador, InstruccionDesensamblada } from '../tipos';

const R = ['B', 'C', 'D', 'E', 'H', 'L', '(HL)', 'A'];
const RP = ['BC', 'DE', 'HL', 'SP'];
const RP2 = ['BC', 'DE', 'HL', 'AF'];
const CC = ['NZ', 'Z', 'NC', 'C', 'PO', 'PE', 'P', 'M'];
const CC_TXT = ['el resultado anterior no fue cero (Z = 0)', 'el resultado anterior fue cero (Z = 1)', 'no hubo acarreo (C = 0)', 'hubo acarreo (C = 1)', 'la paridad es impar (P/V = 0)', 'la paridad es par (P/V = 1)', 'el signo es positivo (S = 0)', 'el signo es negativo (S = 1)'];
const ALU = ['ADD A,', 'ADC A,', 'SUB ', 'SBC A,', 'AND ', 'XOR ', 'OR ', 'CP '];
const ALU_TXT = [
  'Suma {o} al acumulador A.',
  'Suma {o} y el acarreo al acumulador A.',
  'Resta {o} del acumulador A.',
  'Resta {o} y el acarreo del acumulador A.',
  'Y lógico bit a bit de A con {o}.',
  'O exclusivo bit a bit de A con {o} (XOR A pone A a cero).',
  'O lógico bit a bit de A con {o}.',
  'Compara A con {o}: resta sin guardar el resultado, solo cambian las banderas.',
];
const ROT = ['RLC', 'RRC', 'RL', 'RR', 'SLA', 'SRA', 'SLL', 'SRL'];
const ROT_TXT = [
  'Gira {o} un bit a la izquierda; el bit 7 pasa al bit 0 y al acarreo.',
  'Gira {o} un bit a la derecha; el bit 0 pasa al bit 7 y al acarreo.',
  'Gira {o} a la izquierda a través del acarreo.',
  'Gira {o} a la derecha a través del acarreo.',
  'Desplaza {o} a la izquierda; entra un 0 por el bit 0.',
  'Desplaza {o} a la derecha conservando el signo.',
  'Desplaza {o} a la izquierda metiendo un 1 (instrucción no documentada).',
  'Desplaza {o} a la derecha; entra un 0 por el bit 7.',
];
const BLOQUE: Record<number, [string, string]> = {
  0xa0: ['LDI', 'Copia el byte de (HL) en (DE), incrementa HL y DE y decrementa BC.'],
  0xa1: ['CPI', 'Compara A con (HL), incrementa HL y decrementa BC.'],
  0xa2: ['INI', 'Lee el puerto (C) y lo guarda en (HL); incrementa HL y decrementa B.'],
  0xa3: ['OUTI', 'Escribe el byte de (HL) en el puerto (C); incrementa HL y decrementa B.'],
  0xa8: ['LDD', 'Copia el byte de (HL) en (DE), decrementa HL, DE y BC.'],
  0xa9: ['CPD', 'Compara A con (HL), decrementa HL y BC.'],
  0xaa: ['IND', 'Lee el puerto (C) y lo guarda en (HL); decrementa HL y B.'],
  0xab: ['OUTD', 'Escribe el byte de (HL) en el puerto (C); decrementa HL y B.'],
  0xb0: ['LDIR', 'Repite LDI hasta que BC llega a 0: copia un bloque de memoria (21 ciclos por byte).'],
  0xb1: ['CPIR', 'Repite CPI hasta encontrar A o agotar BC.'],
  0xb2: ['INIR', 'Repite INI hasta que B llega a 0.'],
  0xb3: ['OTIR', 'Repite OUTI hasta que B llega a 0: cada vuelta lee un byte de la memoria y lo escribe en el puerto (C).'],
  0xb8: ['LDDR', 'Repite LDD hasta que BC llega a 0.'],
  0xb9: ['CPDR', 'Repite CPD hasta encontrar A o agotar BC.'],
  0xba: ['INDR', 'Repite IND hasta que B llega a 0.'],
  0xbb: ['OTDR', 'Repite OUTD hasta que B llega a 0.'],
};

const h2 = (v: number) => '$' + (v & 0xff).toString(16).toUpperCase().padStart(2, '0');
const h4 = (v: number) => '$' + (v & 0xffff).toString(16).toUpperCase().padStart(4, '0');
const s8 = (v: number) => (v & 0x80 ? v - 256 : v);

/** Names of the Master System's ports, used in the explanations. */
export const PUERTOS_SMS: Record<number, string> = {
  0x3e: 'control de memoria del 315-5237', 0x3f: 'control de E/S (TH, TR de los mandos)', 0x7e: 'contador V del VDP (lectura) o PSG (escritura)',
  0x7f: 'contador H del VDP (lectura) o PSG (escritura)', 0xbe: 'datos del VDP', 0xbf: 'control y estado del VDP', 0xdc: 'mando 1', 0xdd: 'mando 2 y extras',
};

/** The Master System decodes only A7, A6 and A0 of a port number: its canonical port. */
const CANONICO: Record<number, number> = { 0x00: 0x3e, 0x01: 0x3f, 0x40: 0x7e, 0x41: 0x7f, 0x80: 0xbe, 0x81: 0xbf, 0xc0: 0xdc, 0xc1: 0xdd };

function puerto(p: number): string {
  const n = PUERTOS_SMS[CANONICO[p & 0xc1]!];
  return n ? ` (${n})` : '';
}

interface Lector {
  b(): number;
  pos: number;
}

function etq(dir: number, etiquetas?: Record<string, string>): string {
  const n = etiquetas?.[(dir & 0xffff).toString(16).toUpperCase().padStart(4, '0')];
  return n ? `${h4(dir)} (${n})` : h4(dir);
}

function decodificar(l: Lector, pc: number, etiquetas?: Record<string, string>): { texto: string; explicacion: string } {
  let op = l.b();
  let ix: '' | 'IX' | 'IY' = '';
  while (op === 0xdd || op === 0xfd) {
    ix = op === 0xdd ? 'IX' : 'IY';
    op = l.b();
  }
  // operand names with the index register in place of HL
  const reg = (i: number, desp?: number): string => {
    if (!ix) return R[i]!;
    if (i === 6) return `(${ix}${desp! >= 0 ? '+' : ''}${desp})`;
    if (i === 4) return ix + 'H';
    if (i === 5) return ix + 'L';
    return R[i]!;
  };
  const rp = (i: number) => (i === 2 && ix ? ix : RP[i]!);
  const rp2 = (i: number) => (i === 2 && ix ? ix : RP2[i]!);
  const desp = () => s8(l.b());

  if (op === 0xcb) {
    let d = 0;
    if (ix) d = desp();
    const o = l.b();
    const x = o >> 6;
    const y = (o >> 3) & 7;
    const z = o & 7;
    const oper = ix ? `(${ix}${d >= 0 ? '+' : ''}${d})` : R[z]!;
    if (x === 0) return { texto: `${ROT[y]} ${oper}`, explicacion: ROT_TXT[y]!.replace('{o}', oper) };
    if (x === 1) return { texto: `BIT ${y},${oper}`, explicacion: `Comprueba el bit ${y} de ${oper}: Z = 1 si está a 0.` };
    if (x === 2) return { texto: `RES ${y},${oper}`, explicacion: `Pone a 0 el bit ${y} de ${oper}.` };
    return { texto: `SET ${y},${oper}`, explicacion: `Pone a 1 el bit ${y} de ${oper}.` };
  }
  if (op === 0xed) {
    const o = l.b();
    const x = o >> 6;
    const y = (o >> 3) & 7;
    const z = o & 7;
    const p = y >> 1;
    const q = y & 1;
    if (x === 1) {
      if (z === 0) return y === 6 ? { texto: 'IN (C)', explicacion: 'Lee el puerto (C) solo para cambiar las banderas.' } : { texto: `IN ${R[y]},(C)`, explicacion: `Lee el puerto cuyo número está en C (el byte alto del bus de direcciones lleva B) y lo guarda en ${R[y]}.` };
      if (z === 1) return y === 6 ? { texto: 'OUT (C),0', explicacion: 'Escribe 0 en el puerto (C) (no documentada).' } : { texto: `OUT (C),${R[y]}`, explicacion: `Escribe ${R[y]} en el puerto cuyo número está en C.` };
      if (z === 2) return { texto: `${q ? 'ADC' : 'SBC'} HL,${RP[p]}`, explicacion: `${q ? 'Suma' : 'Resta'} ${RP[p]} y el acarreo ${q ? 'a' : 'de'} HL (16 bits).` };
      if (z === 3) {
        const nn = l.b() | (l.b() << 8);
        return q
          ? { texto: `LD ${RP[p]},(${h4(nn)})`, explicacion: `Carga ${RP[p]} con los dos bytes de ${h4(nn)} y ${h4(nn + 1)}.` }
          : { texto: `LD (${h4(nn)}),${RP[p]}`, explicacion: `Guarda ${RP[p]} en ${h4(nn)} (byte bajo) y ${h4(nn + 1)} (byte alto).` };
      }
      if (z === 4) return { texto: 'NEG', explicacion: 'Cambia el signo de A (complemento a dos).' };
      if (z === 5) return y === 1 ? { texto: 'RETI', explicacion: 'Vuelve de una interrupción: saca de la pila la dirección de vuelta (y avisa a los periféricos Z80 que la escuchen).' } : { texto: 'RETN', explicacion: 'Vuelve de una NMI: saca la dirección de vuelta de la pila y recupera el estado de IFF1.' };
      if (z === 6) {
        const m = [0, 0, 1, 2, 0, 0, 1, 2][y]!;
        return { texto: `IM ${m}`, explicacion: m === 1 ? 'Modo de interrupción 1: cada /INT hace un RST $38.' : m === 2 ? 'Modo de interrupción 2: el vector se busca en la tabla que señala I.' : 'Modo de interrupción 0: el periférico pone la instrucción en el bus de datos.' };
      }
      const z7 = ['LD I,A', 'LD R,A', 'LD A,I', 'LD A,R', 'RRD', 'RLD', 'NOP', 'NOP'][y]!;
      const t7 = ['Copia A en I (base de la tabla del modo 2).', 'Copia A en R, el contador de refresco.', 'Copia I en A.', 'Copia R (el contador de refresco) en A.', 'Gira a la derecha un dígito BCD entre A y (HL).', 'Gira a la izquierda un dígito BCD entre A y (HL).', 'Sin efecto.', 'Sin efecto.'][y]!;
      return { texto: z7, explicacion: t7 };
    }
    if (x === 2 && BLOQUE[o]) return { texto: BLOQUE[o]![0], explicacion: BLOQUE[o]![1] };
    return { texto: `DB $ED,${h2(o)}`, explicacion: 'Código ED sin instrucción: el Z80 lo trata como dos NOP.' };
  }

  const x = op >> 6;
  const y = (op >> 3) & 7;
  const z = op & 7;
  const p = y >> 1;
  const q = y & 1;
  if (x === 0) {
    if (z === 0) {
      if (y === 0) return { texto: 'NOP', explicacion: 'No hace nada: solo un ciclo M1 de 4 estados con su refresco.' };
      if (y === 1) return { texto: "EX AF,AF'", explicacion: 'Intercambia A y F con su juego alternativo.' };
      const d = desp();
      const dest = (pc + l.pos + d) & 0xffff;
      if (y === 2) return { texto: `DJNZ ${etq(dest, etiquetas)}`, explicacion: `Resta 1 a B y salta a ${h4(dest)} si no ha llegado a 0.` };
      if (y === 3) return { texto: `JR ${etq(dest, etiquetas)}`, explicacion: `Salto relativo a ${h4(dest)} (desplazamiento ${d}).` };
      return { texto: `JR ${CC[y - 4]},${etq(dest, etiquetas)}`, explicacion: `Salta a ${h4(dest)} si ${CC_TXT[y - 4]}.` };
    }
    if (z === 1) {
      if (!q) {
        const nn = l.b() | (l.b() << 8);
        return { texto: `LD ${rp(p)},${h4(nn)}`, explicacion: `Carga el valor ${h4(nn)} en ${rp(p)}.` };
      }
      return { texto: `ADD ${rp(2)},${rp(p)}`, explicacion: `Suma ${rp(p)} a ${rp(2)} (16 bits).` };
    }
    if (z === 2) {
      if (p < 2) {
        const r = RP[p];
        return q ? { texto: `LD A,(${r})`, explicacion: `Lee en A el byte de la dirección que hay en ${r}.` } : { texto: `LD (${r}),A`, explicacion: `Escribe A en la dirección que hay en ${r}.` };
      }
      const nn = l.b() | (l.b() << 8);
      if (p === 2) return q ? { texto: `LD ${rp(2)},(${h4(nn)})`, explicacion: `Carga ${rp(2)} con los dos bytes de ${h4(nn)}.` } : { texto: `LD (${h4(nn)}),${rp(2)}`, explicacion: `Guarda ${rp(2)} en ${h4(nn)} y ${h4(nn + 1)}.` };
      return q ? { texto: `LD A,(${etq(nn, etiquetas)})`, explicacion: `Lee en A el byte de ${h4(nn)}.` } : { texto: `LD (${etq(nn, etiquetas)}),A`, explicacion: `Escribe A en ${h4(nn)}.` };
    }
    if (z === 3) return q ? { texto: `DEC ${rp(p)}`, explicacion: `Resta 1 a ${rp(p)} (16 bits, sin cambiar las banderas).` } : { texto: `INC ${rp(p)}`, explicacion: `Suma 1 a ${rp(p)} (16 bits, sin cambiar las banderas).` };
    if (z === 4 || z === 5) {
      const d = ix && y === 6 ? desp() : 0;
      const o = reg(y, d);
      return { texto: `${z === 4 ? 'INC' : 'DEC'} ${o}`, explicacion: `${z === 4 ? 'Suma' : 'Resta'} 1 ${z === 4 ? 'a' : 'de'} ${o}.` };
    }
    if (z === 6) {
      const d = ix && y === 6 ? desp() : 0;
      const n = l.b();
      return { texto: `LD ${reg(y, d)},${h2(n)}`, explicacion: `Carga el valor ${h2(n)} en ${reg(y, d)}.` };
    }
    const t = ['RLCA', 'RRCA', 'RLA', 'RRA', 'DAA', 'CPL', 'SCF', 'CCF'][y]!;
    const e = ['Gira A a la izquierda; el bit 7 va al acarreo.', 'Gira A a la derecha; el bit 0 va al acarreo.', 'Gira A a la izquierda a través del acarreo.', 'Gira A a la derecha a través del acarreo.', 'Ajusta A a BCD tras una suma o resta.', 'Invierte todos los bits de A.', 'Pone a 1 el acarreo.', 'Invierte el acarreo.'][y]!;
    return { texto: t, explicacion: e };
  }
  if (x === 1) {
    if (op === 0x76) return { texto: 'HALT', explicacion: 'Detiene la CPU: repite ciclos M1 (con su refresco de memoria) sin ejecutar nada hasta que llega una interrupción.' };
    const d = ix && (y === 6 || z === 6) ? desp() : 0;
    // with (IX+d) the other operand is the plain H or L
    const dst = ix && z === 6 ? R[y]! : reg(y, d);
    const src = ix && y === 6 ? R[z]! : reg(z, d);
    return { texto: `LD ${dst},${src}`, explicacion: `Copia ${src} en ${dst}.` };
  }
  if (x === 2) {
    const d = ix && z === 6 ? desp() : 0;
    const o = reg(z, d);
    return { texto: ALU[y] + o, explicacion: ALU_TXT[y]!.replace('{o}', o) };
  }
  // x === 3
  if (z === 0) return { texto: `RET ${CC[y]}`, explicacion: `Vuelve de la subrutina si ${CC_TXT[y]}.` };
  if (z === 1) {
    if (!q) return { texto: `POP ${rp2(p)}`, explicacion: `Saca dos bytes de la pila (en la RAM) y los carga en ${rp2(p)}.` };
    const t = ['RET', 'EXX', `JP (${rp(2)})`, `LD SP,${rp(2)}`][p]!;
    const e = ['Vuelve de la subrutina: lee la dirección de vuelta de la pila.', 'Intercambia BC, DE y HL con su juego alternativo.', `Salta a la dirección que hay en ${rp(2)}.`, `Copia ${rp(2)} en el puntero de pila.`][p]!;
    return { texto: t, explicacion: e };
  }
  if (z === 2) {
    const nn = l.b() | (l.b() << 8);
    return { texto: `JP ${CC[y]},${etq(nn, etiquetas)}`, explicacion: `Salta a ${h4(nn)} si ${CC_TXT[y]}.` };
  }
  if (z === 3) {
    if (y === 0) {
      const nn = l.b() | (l.b() << 8);
      return { texto: `JP ${etq(nn, etiquetas)}`, explicacion: `Salta a ${h4(nn)}: la siguiente lectura de código sale de allí.` };
    }
    if (y === 2) {
      const n = l.b();
      return { texto: `OUT (${h2(n)}),A`, explicacion: `Escribe A en el puerto ${h2(n)}${puerto(n)}: ciclo de E/S con /IORQ y /WR, A en el byte alto del bus de direcciones.` };
    }
    if (y === 3) {
      const n = l.b();
      return { texto: `IN A,(${h2(n)})`, explicacion: `Lee el puerto ${h2(n)}${puerto(n)} y lo guarda en A: ciclo de E/S con /IORQ y /RD.` };
    }
    const t = ['', '', '', '', `EX (SP),${rp(2)}`, 'EX DE,HL', 'DI', 'EI'][y]!;
    const e = ['', '', '', '', `Intercambia ${rp(2)} con los dos bytes de la cima de la pila.`, 'Intercambia DE y HL.', 'Desactiva las interrupciones enmascarables (/INT).', 'Activa las interrupciones enmascarables a partir de la instrucción siguiente.'][y]!;
    return { texto: t, explicacion: e };
  }
  if (z === 4) {
    const nn = l.b() | (l.b() << 8);
    return { texto: `CALL ${CC[y]},${etq(nn, etiquetas)}`, explicacion: `Llama a la subrutina de ${h4(nn)} si ${CC_TXT[y]}.` };
  }
  if (z === 5) {
    if (!q) return { texto: `PUSH ${rp2(p)}`, explicacion: `Guarda ${rp2(p)} en la pila: dos escrituras en la RAM.` };
    const nn = l.b() | (l.b() << 8);
    return { texto: `CALL ${etq(nn, etiquetas)}`, explicacion: `Guarda la dirección de vuelta en la pila (dos escrituras) y salta a la subrutina de ${h4(nn)}.` };
  }
  if (z === 6) {
    const n = l.b();
    const o = h2(n);
    return { texto: ALU[y] + o, explicacion: ALU_TXT[y]!.replace('{o}', o) };
  }
  return { texto: `RST ${h2(y * 8)}`, explicacion: `Llamada de un byte a la dirección ${h4(y * 8)}.` };
}

export const desZ80: Desensamblador = {
  instruccion(leer, pc, etiquetas): InstruccionDesensamblada {
    const l: Lector = {
      pos: 0,
      b() {
        const v = leer((pc + this.pos) & 0xffff);
        this.pos++;
        return v < 0 ? 0 : v;
      },
    };
    const r = decodificar(l, pc, etiquetas);
    return { texto: r.texto, bytes: l.pos, explicacion: r.explicacion };
  },
};

export default desZ80;
