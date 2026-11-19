// 1.3: the real Brymen BM869s through its BU-86X USB cable — the packet decoder, shared by every platform (the
// native transports, src-tauri/plugins/brymen, and WebHID only move raw bytes; everything is decoded here).
//
// Sources (public; nothing here is guessed beyond what they say):
//   - libsigrok, src/dmm/bm86x.c (Aurelien Jacobs 2014, Gerhard Sittig 2019; git 0bc24877 of 2025-11-20): the
//     packet's validity check, the LCD segment code of each digit and every annunciator bit used below.
//   - libsigrok, src/serial_hid_bu86x.c: the cable is USB HID, VID 0x0820 PID 0x0001, report 0 only, the meter's
//     24-byte packet arrives as three 8-byte reports after the host sends the short request 00 86 66
//     (hid_write of {0x00 report id, 0x00, 0x86, 0x66}; sigrok's request in bm86x.c).
//   - libsigrok-0.4.0, src/hardware/brymen-bm86x/protocol.c (the earlier libusb driver): the same three request
//     bytes sent as a class SET_REPORT (bRequest 9) with wValue 0x0300 (feature report 0) to interface 0, and the
//     24 bytes read from interrupt endpoint 1 IN.
//   - Brymen, «BM860/BM860s 500000 count dual display DMMs protocol» (the vendor PDF those files cite).
// No real capture of this meter exists in sigrok-dumps (checked 2026-11-19): the unit tests build packets from the
// layout below, bit by bit.
//
// The packet (bytes 0…23):
//   1: 0x01 AUTO, 0x08 HOLD, 0x10 DC, 0x20 MAX, 0x40 MIN, 0x80 AVG (all three lit together: none of them)
//   2: 0x01 AC, 0x80 minus sign of the main display, 0x0a temperature
//   3…8: the main display's six digit cells; 3 bit 0 = Δ (REL), 8 bit 0 = V
//   9: 0x01 µ, 0x02 m, 0x04 A, 0x08 % (4–20 mA), 0x10 minus sign, 0x20 AC, 0x40 temperature (secondary display),
//      0x80 battery low
//   10…13: the secondary display's four digit cells; 10 bit 0 = continuity
//   14: secondary 0x01 M, 0x02 k, 0x04 Hz, 0x08 V; main 0x10 S, 0x20 F, 0x40 n, 0x80 A
//   15: main 0x01 Hz, 0x02 dBm, 0x04 m, 0x08 µ, 0x10 Ω, 0x20 M, 0x40 k, 0x80 % (duty)
//   16…19: 0x86 (the model id; sigrok synchronises on them)
// A digit cell holds the segments in bits 7…1 in the order b g c d a f e; its bit 0 is the decimal point BEFORE
// that digit (cells 2nd to 5th of a display) or an annunciator (the first and last cells).

import { celdas } from '../../componentes/instrumentos/brymen/siete.ts';

export const VID_BU86X = 0x0820;
export const PID_BU86X = 0x0001;
export const TAMANO_PAQUETE = 24;
/** The request's payload (report 0); hidapi and WebHID add/take the report id themselves. */
export const PETICION = [0x00, 0x86, 0x66] as const;

export type UnidadReal = 'V' | 'A' | 'Ω' | 'F' | 'Hz' | 'S' | '%' | 'dBm' | '°C' | '°F' | '';

export interface PantallaReal {
  /** The characters as the LCD shows them, with the sign and the decimal point («-4.8712», «0L», «diod»). */
  texto: string;
  /** In SI units (the prefix applied); null: OL, a word, or blank. */
  valor: number | null;
  unidad: UnidadReal;
  /** The prefix lit next to the unit. */
  prefijo: '' | 'n' | 'µ' | 'm' | 'k' | 'M';
  ac: boolean;
  dc: boolean;
  /** Over range (OL). */
  ol: boolean;
  /** Decimal places shown (the last digit's weight is 10^−decimales of the prefixed unit). */
  decimales: number;
}

export interface LecturaReal {
  principal: PantallaReal;
  /** Null when the secondary display is blank. */
  secundaria: PantallaReal | null;
  auto: boolean;
  hold: boolean;
  rel: boolean;
  max: boolean;
  min: boolean;
  media: boolean;
  diodo: boolean;
  continuidad: boolean;
  bateriaBaja: boolean;
}

// ------------------------------------------------------------------ the digits

/** Bits 7…1 of a cell, in this order (bit 7 first). */
const ORDEN = 'bgcdafe';
/** Characters the decoder recognises; their segments come from the simulated meter's LCD (siete.ts), plus «i». */
const CANDIDATOS = '0123456789-CFLdoEr';
const SEGMENTOS = new Map<string, string>();
for (const ch of CANDIDATOS) {
  const segs = [...(celdas(ch, 1).celdas[0]?.segs ?? '')].sort().join('');
  if (segs && !SEGMENTOS.has(segs)) SEGMENTOS.set(segs, ch);
}
// (sigrok: «i» of «diod» is segment c alone; siete.ts has no «i»)
SEGMENTOS.set('c', 'i');

/** The segments lit in a cell, as letters a…g (sorted). */
export function segmentosDe(byte: number): string {
  let s = '';
  for (let k = 0; k < 7; k++) if (byte & (0x80 >> k)) s += ORDEN[k];
  return [...s].sort().join('');
}

/** The character of a cell: '' blank, '?' an unknown pattern. */
export function caracter(byte: number): string {
  const segs = segmentosDe(byte);
  if (!segs) return '';
  return SEGMENTOS.get(segs) ?? '?';
}

/** The text of a display: its cells from `inicio`, `n` of them, with the sign bit given. */
function textoDisplay(p: ArrayLike<number>, inicio: number, n: number, signo: boolean): { texto: string; decimales: number; grados: '' | 'C' | 'F' } {
  let t = signo ? '-' : '';
  let decimales = -1;
  let grados: '' | 'C' | 'F' = '';
  for (let pos = 0; pos < n; pos++) {
    const byte = p[inicio + pos]!;
    if (pos > 0 && pos < 5 && byte & 0x01) {
      t += '.';
      decimales = 0;
    }
    const ch = caracter(byte);
    if (pos === 5 && (ch === 'C' || ch === 'F')) {
      grados = ch;
      continue;
    }
    if (ch) {
      t += ch;
      if (decimales >= 0) decimales++;
    }
  }
  return { texto: t, decimales: Math.max(0, decimales), grados };
}

function numero(texto: string): number | null {
  return /^-?(\d+\.?\d*|\.\d+)$/.test(texto) ? Number(texto) : null;
}

const ESCALA: Record<PantallaReal['prefijo'], number> = { '': 1, n: 1e-9, µ: 1e-6, m: 1e-3, k: 1e3, M: 1e6 };

// ------------------------------------------------------------------ the packet

/** A packet as sigrok accepts it: 24 bytes with 0x86 in bytes 16…19. */
export function paqueteValido(p: ArrayLike<number>, desde = 0): boolean {
  if (p.length - desde < TAMANO_PAQUETE) return false;
  for (let k = 16; k <= 19; k++) if (p[desde + k] !== 0x86) return false;
  return true;
}

/**
 * The first valid packet in a stream of received bytes (the reports may arrive shifted, as sigrok saw in the field):
 * the packet and the bytes after it, or null and the bytes worth keeping.
 */
export function buscarPaquete(bytes: ArrayLike<number>): { paquete: Uint8Array | null; resto: Uint8Array } {
  const b = Uint8Array.from(bytes as ArrayLike<number>);
  for (let i = 0; i + TAMANO_PAQUETE <= b.length; i++) {
    if (paqueteValido(b, i)) return { paquete: b.slice(i, i + TAMANO_PAQUETE), resto: b.slice(i + TAMANO_PAQUETE) };
  }
  // keep at most one packet's worth minus one byte: a packet starting there may still be completed
  return { paquete: null, resto: b.slice(Math.max(0, b.length - (TAMANO_PAQUETE - 1))) };
}

/** Decodes one valid 24-byte packet (paqueteValido) into the two displays. */
export function decodificar(p: ArrayLike<number>): LecturaReal {
  if (!paqueteValido(p)) throw new Error('Paquete del Brymen no válido');
  const sec = textoDisplay(p, 10, 4, !!(p[9]! & 0x10));
  const diodo = sec.texto === 'diod';
  const pri = textoDisplay(p, 3, 6, !!(p[2]! & 0x80));
  const ol = pri.texto.includes('0L') || pri.texto.includes('0.L');

  // main display: unit (sigrok's order of precedence), prefix
  let unidad: UnidadReal = '';
  if (p[8]! & 0x01) unidad = 'V';
  else if (p[14]! & 0x80) unidad = 'A';
  else if (p[14]! & 0x20) unidad = 'F';
  else if (p[14]! & 0x10) unidad = 'S';
  else if (p[15]! & 0x01) unidad = 'Hz';
  else if (p[10]! & 0x01) unidad = 'Ω';
  else if (p[15]! & 0x10) unidad = 'Ω';
  else if (p[15]! & 0x02) unidad = 'dBm';
  else if (p[15]! & 0x80) unidad = '%';
  else if (p[2]! & 0x0a && pri.grados) unidad = pri.grados === 'F' ? '°F' : '°C';
  // (dBm's «m» is not the milli prefix)
  const ind15 = p[15]! & 0x02 ? p[15]! & ~0x04 : p[15]!;
  let prefijo: PantallaReal['prefijo'] = '';
  if (p[14]! & 0x40) prefijo = 'n';
  if (p[15]! & 0x08) prefijo = 'µ';
  if (ind15 & 0x04) prefijo = 'm';
  if (p[15]! & 0x40) prefijo = 'k';
  if (p[15]! & 0x20) prefijo = 'M';
  const n = ol ? null : numero(pri.texto);
  const principal: PantallaReal = {
    texto: pri.texto,
    valor: n === null ? null : n * ESCALA[prefijo],
    unidad,
    prefijo,
    ac: !!(p[2]! & 0x01),
    dc: !!(p[1]! & 0x10) || diodo,
    ol,
    decimales: pri.decimales,
  };

  // secondary display
  let secundaria: PantallaReal | null = null;
  if (sec.texto.replace('-', '') !== '') {
    let u2: UnidadReal = '';
    if (p[14]! & 0x08) u2 = 'V';
    else if (p[9]! & 0x04) u2 = 'A';
    else if (p[9]! & 0x08) u2 = '%';
    else if (p[14]! & 0x04) u2 = 'Hz';
    else if (p[9]! & 0x40 && pri.grados) u2 = pri.grados === 'F' ? '°F' : '°C';
    let pf2: PantallaReal['prefijo'] = '';
    if (p[9]! & 0x01) pf2 = 'µ';
    if (p[9]! & 0x02) pf2 = 'm';
    if (p[14]! & 0x02) pf2 = 'k';
    if (p[14]! & 0x01) pf2 = 'M';
    const n2 = diodo ? null : numero(sec.texto);
    secundaria = {
      texto: sec.texto,
      valor: n2 === null ? null : n2 * ESCALA[pf2],
      unidad: u2,
      prefijo: pf2,
      ac: !!(p[9]! & 0x20),
      dc: false,
      ol: sec.texto.includes('0L'),
      decimales: sec.decimales,
    };
  }

  const ind1 = (p[1]! & 0xe0) === 0xe0 ? p[1]! & ~0xe0 : p[1]!;
  return {
    principal,
    secundaria,
    auto: !!(p[1]! & 0x01),
    hold: !!(p[1]! & 0x08),
    rel: !!(p[3]! & 0x01),
    max: !!(ind1 & 0x20),
    min: !!(ind1 & 0x40),
    media: !!(ind1 & 0x80),
    diodo,
    continuidad: !!(p[10]! & 0x01),
    bateriaBaja: !!(p[9]! & 0x80),
  };
}

// ------------------------------------------------------------------ the inverse (tests and the fake transport)

/** The cell byte of a character (the inverse of `caracter`), without the decimal point. */
export function byteDe(ch: string): number {
  if (ch === '' || ch === ' ') return 0;
  const segs = ch === 'i' ? 'c' : (celdas(ch, 1).celdas[0]?.segs ?? '');
  let b = 0;
  for (const s of segs) {
    const k = ORDEN.indexOf(s);
    if (k >= 0) b |= 0x80 >> k;
  }
  return b;
}

/** Writes a display's text («-4.8712») into cells from `inicio` (right-aligned in `n` cells); returns the sign. */
function escribirDisplay(p: Uint8Array, inicio: number, n: number, texto: string): boolean {
  let t = texto;
  const signo = t.startsWith('-');
  if (signo) t = t.slice(1);
  const cel: { ch: string; punto: boolean }[] = [];
  let punto = false;
  for (const ch of t) {
    if (ch === '.') {
      punto = true;
      continue;
    }
    cel.push({ ch, punto });
    punto = false;
  }
  while (cel.length < n) cel.unshift({ ch: '', punto: false });
  cel.slice(-n).forEach((c, k) => {
    p[inicio + k] = byteDe(c.ch) | (c.punto ? 0x01 : 0);
  });
  return signo;
}

export interface Simulacion {
  principal: string;
  /** The unit and prefix of the main display (V, mV, kΩ, µF, Hz, mA…; '' none). */
  unidad?: string;
  ac?: boolean;
  dc?: boolean;
  auto?: boolean;
  hold?: boolean;
  rel?: boolean;
  secundaria?: string;
  unidadSecundaria?: string;
  acSecundaria?: boolean;
  bateriaBaja?: boolean;
}

/**
 * A packet that shows what is given, built from the documented layout (the unit tests and the fake transport of the
 * browser tests use it; it does not guess anything the decoder does not read).
 */
export function construirPaquete(s: Simulacion): Uint8Array {
  const p = new Uint8Array(TAMANO_PAQUETE);
  p[16] = p[17] = p[18] = p[19] = 0x86;
  if (escribirDisplay(p, 3, 6, s.principal)) p[2]! |= 0x80;
  if (s.secundaria !== undefined && escribirDisplay(p, 10, 4, s.secundaria)) p[9]! |= 0x10;
  // (cell bit 0 of the first and last cells are annunciators, set after the digits)
  const u = s.unidad ?? '';
  const pf = u.length > 1 && 'nµmkM'.includes(u[0]!) && u !== 'dBm' ? u[0]! : '';
  const base = pf ? u.slice(1) : u;
  if (base === 'V') p[8]! |= 0x01;
  else if (base === 'A') p[14]! |= 0x80;
  else if (base === 'F') p[14]! |= 0x20;
  else if (base === 'S') p[14]! |= 0x10;
  else if (base === 'Hz') p[15]! |= 0x01;
  else if (base === 'Ω') p[15]! |= 0x10;
  else if (base === 'dBm') p[15]! |= 0x02;
  else if (base === '%') p[15]! |= 0x80;
  if (pf === 'n') p[14]! |= 0x40;
  if (pf === 'µ') p[15]! |= 0x08;
  if (pf === 'm') p[15]! |= 0x04;
  if (pf === 'k') p[15]! |= 0x40;
  if (pf === 'M') p[15]! |= 0x20;
  if (s.ac) p[2]! |= 0x01;
  if (s.dc) p[1]! |= 0x10;
  if (s.auto) p[1]! |= 0x01;
  if (s.hold) p[1]! |= 0x08;
  if (s.rel) p[3]! |= 0x01;
  const u2 = s.unidadSecundaria ?? '';
  const pf2 = u2.length > 1 && 'µmkM'.includes(u2[0]!) ? u2[0]! : '';
  const b2 = pf2 ? u2.slice(1) : u2;
  if (b2 === 'V') p[14]! |= 0x08;
  else if (b2 === 'A') p[9]! |= 0x04;
  else if (b2 === '%') p[9]! |= 0x08;
  else if (b2 === 'Hz') p[14]! |= 0x04;
  if (pf2 === 'µ') p[9]! |= 0x01;
  if (pf2 === 'm') p[9]! |= 0x02;
  if (pf2 === 'k') p[14]! |= 0x02;
  if (pf2 === 'M') p[14]! |= 0x01;
  if (s.acSecundaria) p[9]! |= 0x20;
  if (s.bateriaBaja) p[9]! |= 0x80;
  return p;
}

/** The packet in hex, for the diagnostic text («00 11 5f …»). */
export function hex(p: ArrayLike<number>): string {
  return Array.from(p as ArrayLike<number>, (x) => x.toString(16).padStart(2, '0')).join(' ');
}
