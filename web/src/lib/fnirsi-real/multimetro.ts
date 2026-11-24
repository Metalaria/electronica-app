// The real FNIRSI 2C53T's multimeter: one event of the link (protocolo.ts, kind 0x90) into what its screen shows.
//
// The instrument's multimeter is a separate chip that sends the main processor a 12-byte frame with its display
// (about six a second); the link forwards each frame as it arrived, with a few bytes of the firmware's own state
// next to it. The event's payload:
//   [2]      1 = a display frame (5A A5 …), 2 = the chip's echo of an order (AA 55 …: the function was changed)
//   [4…7]    tick (ms since the instrument started)
//   [8…19]   the frame
//   [20]     the last order the firmware sent the chip (the function: see FUNCIONES; 0 until a key chooses one)
//   [21]     the instrument's mode (1 = multimeter)
//   [24…63]  40 bytes of the firmware's multimeter state
//
// The display frame, established on a real unit (2026-11-23) with a 10 kΩ resistor, a 9 V battery and every
// function of the key cycle, each reading checked against the instrument's own screen value in the state bytes:
//   [2…6]  four seven-segment digits, each split across two bytes: digit i is the high nibble of byte 2+i and the
//          low nibble of byte 3+i. Segments: a 0x80, f 0x40, e 0x20, b 0x08, g 0x04, c 0x02, d 0x01; 0x10 is the
//          decimal point in front of digits 2 to 4.
//   [2]    low nibble side: 0x10 minus sign, 0x08 a leading «1» (the display is 4½ digits).
//   [6]    high nibble: 0x80 the diode function, 0x40 «k», 0x20 «n», 0x10 «µ».
//   [7]    0x20 Ω, 0x10 F, 0x08 continuity, 0x04 «M», 0x01 «m».
//   [8]    0x02 V, 0x01 A, 0x20 °C, 0x80 lowest range (no point bit: the reading is x.xxxx).
// The firmware state repeats the unit as a code of its own ([24+16]: 1 V, 2 Ω, 3 kΩ, 4 MΩ, 5 nF, 6 µF, 9 °C,
// 11 mA, 12 A) and the number of decimals ([24+12]). The two come from different places and are compared here: a
// reading is «fiable» only when the frame's annunciators and the firmware's unit agree, which also weeds out the
// frame or two around a change of function, when one of them is still the old one.
//
// Two more sessions on the same unit (2026-11-24) settled what the first left open:
//   - alternating voltage and current: the frame has no annunciator of its own for them (the bytes are those of
//     the direct function); what says «alternating» is the function, [20]. Checked with the probes shorted
//     (0.0000 V), with nothing in the current sockets (0.008 mA, 0.0007 A) and with the open probes held in the
//     hand (2.2 to 2.4 V of mains hum, in step with the firmware's own value): the digits are decoded as in any
//     other function.
//   - capacitance: «n» and «µ» ([6] 0x20 and 0x10) with F, firmware codes 5 and 6. Checked with the probes apart
//     (0.000 nF) and a 1 µF capacitor (1.02 to 1.045 µF; the screen's own MAX said 1.0450uF).
//   - the diode function lights [6] 0x80 and reads in volts (firmware code 1): «.0L» with the probes apart and
//     1.811 V across a LED, 279 frames and each one the firmware's own value.
//   - while the range changes the display may show its decimal point alone: that is a blank display.
//
//   - in alternating voltage the frame's [11] (and the firmware state's [24+18…19], one frame later) is the
//     frequency in Hz the screen shows above the reading (0 with the probes shorted; 57, 49… with them in the
//     hand). Read here from the state, which is a whole 16-bit number; in the other functions it is stale.
//   - HOLD: the firmware state's [24+20] is 1 while it is on. The chip is not told: its frames go on with the live
//     reading, while the firmware stops updating its state, and the instrument's screen keeps showing that frozen
//     value. So during HOLD the frame is the live reading and the state is what the screen shows: its value
//     ([24+8…11], a float), decimals ([24+12]) and unit ([24+16]); [24+13] is 0 for a number (2 overload, 3 blank).
//     Out of HOLD the value written with those decimals is the display's text (455 readings of every capture),
//     and [24+13] is 2 in every overload frame (133) and in no other.
//     The reading given here is always the instrument's screen, as with the real Brymen: during HOLD it is the
//     frozen one, built from the state, and the frame is left aside.
//
// Not established yet: °F, and the capacitance ranges beyond nF and µF (the firmware's code for them is not known,
// so they come out not «fiable» by themselves). A frame with any bit outside the list above is decoded as far as
// it goes and marked not «fiable».

import type { PantallaReal, UnidadReal } from '../brymen-real/protocolo.ts';
import { EVT_MULTIMETRO, hex, u32 } from './protocolo.ts';

export type FuncionFnirsi = 'auto' | 'vdc' | 'vac' | 'ohm' | 'diodo' | 'continuidad' | 'temperatura' | 'madc' | 'maac' | 'adc' | 'aac' | 'capacidad' | 'desconocida';

/** The order the firmware sends the chip for each function (seen as echoes while cycling the function key). */
const FUNCIONES: Record<number, FuncionFnirsi> = {
  0x00: 'auto', // (no order sent yet: the chip starts in Auto)
  0x14: 'auto',
  0x0c: 'vdc',
  0x0d: 'vac',
  0x0b: 'ohm',
  0x0e: 'diodo',
  0x17: 'continuidad',
  0x12: 'temperatura',
  0x11: 'madc',
  0x16: 'maac',
  0x10: 'adc',
  0x15: 'aac',
  0x0a: 'capacidad',
};

/** The firmware's unit code → unit and prefix (only the ones seen on the real unit). */
const UNIDAD_FIRMWARE: Record<number, { unidad: UnidadReal; prefijo: PantallaReal['prefijo'] }> = {
  1: { unidad: 'V', prefijo: '' },
  2: { unidad: 'Ω', prefijo: '' },
  3: { unidad: 'Ω', prefijo: 'k' },
  4: { unidad: 'Ω', prefijo: 'M' },
  5: { unidad: 'F', prefijo: 'n' },
  6: { unidad: 'F', prefijo: 'µ' },
  9: { unidad: '°C', prefijo: '' },
  11: { unidad: 'A', prefijo: 'm' },
  12: { unidad: 'A', prefijo: '' },
};

const ESCALA: Record<PantallaReal['prefijo'], number> = { '': 1, n: 1e-9, µ: 1e-6, m: 1e-3, k: 1e3, M: 1e6 };

// ------------------------------------------------------------------ the digits

const SEG: Record<string, number> = { a: 0x80, b: 0x08, c: 0x02, d: 0x01, e: 0x20, f: 0x40, g: 0x04 };
const PUNTO = 0x10;
const GLIFOS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc',
  '8': 'abcdefg', '9': 'abcdfg', A: 'abcefg', u: 'cde', t: 'defg', o: 'cdeg', L: 'def', '-': 'g', C: 'adef',
  P: 'abefg', E: 'adefg', r: 'eg', ' ': '',
};
const CARACTER = new Map<number, string>();
for (const [ch, segs] of Object.entries(GLIFOS)) {
  let m = 0;
  for (const s of segs) m |= SEG[s]!;
  CARACTER.set(m, ch);
}

/** The character of a digit's 8-bit mask (the decimal point bit apart): '?' for an unknown pattern. */
export function caracterFnirsi(mascara: number): string {
  return CARACTER.get(mascara & ~PUNTO & 0xff) ?? '?';
}

/** The display's characters as the screen shows them («9.827», «-0.006», «.0L», «Auto», «23»). */
export function textoTrama(t: ArrayLike<number>): string {
  const mascaras = [0, 1, 2, 3].map((i) => ((t[2 + i] ?? 0) & 0xf0) | ((t[3 + i] ?? 0) & 0x0f));
  const digitos = mascaras.map(caracterFnirsi);
  const puntos = mascaras.map((m, i) => i > 0 && (m & PUNTO) !== 0);
  const menos = ((t[2] ?? 0) & 0x10) !== 0;
  const uno = ((t[2] ?? 0) & 0x08) !== 0;
  const numerico = digitos.every((d) => d >= '0' && d <= '9');
  let cuerpo = digitos.map((d, i) => (puntos[i] ? '.' : '') + d).join('');
  if (numerico && !puntos.some(Boolean) && ((t[8] ?? 0) & 0x80) !== 0) cuerpo = `${uno ? '1' : '0'}.${cuerpo}`;
  else if (uno) cuerpo = `1${cuerpo}`;
  return ((menos ? '-' : '') + cuerpo).trim();
}

function numero(texto: string): number | null {
  return /^-?(\d+\.?\d*|\.\d+)$/.test(texto) ? Number(texto) : null;
}

// ------------------------------------------------------------------ the reading

export interface LecturaFnirsi {
  /** The display, in the same shape as the real Brymen's (so the same helpers format and compare it). */
  pantalla: PantallaReal;
  funcion: FuncionFnirsi;
  /** The screen shows «Auto» (smart mode, nothing detected at the probes). */
  esperando: boolean;
  /** Continuity function (the unit is Ω). */
  continuidad: boolean;
  /**
   * The frame's annunciators and the firmware's own unit agree and nothing unknown is lit: the reading can be
   * compared and copied into a field. False around a change of function or of range, and for anything not
   * established yet.
   */
  fiable: boolean;
  /** Why it is not «fiable» (a sentence for the diagnostics), or ''. */
  motivo: string;
  /** HOLD is on in the instrument: `pantalla` is its frozen screen, not the measurement of this moment. */
  hold: boolean;
  /** Alternating voltage only: the frequency the screen shows above the reading, in Hz; null in the rest. */
  frecuencia: number | null;
  /** Milliseconds since the instrument started. */
  tick: number;
  /** The frame in hex (diagnostics). */
  crudo: string;
}

const B6_CONOCIDOS = 0x80 | 0x40 | 0x20 | 0x10;
const B7_CONOCIDOS = 0x20 | 0x10 | 0x08 | 0x04 | 0x01;
const B8_CONOCIDOS = 0x80 | 0x20 | 0x02 | 0x01;

/** The unit and prefix the frame's annunciators give; `raro`: bits lit that are not in the list. */
function unidadDeTrama(t: ArrayLike<number>): { unidad: UnidadReal; prefijo: PantallaReal['prefijo']; continuidad: boolean; raro: boolean } {
  const b6 = (t[6] ?? 0) & 0xf0;
  const b7 = t[7] ?? 0;
  const b8 = t[8] ?? 0;
  const raro = (b6 & ~B6_CONOCIDOS) !== 0 || (b7 & ~B7_CONOCIDOS) !== 0 || (b8 & ~B8_CONOCIDOS) !== 0;
  let unidad: UnidadReal = '';
  if (b8 & 0x02) unidad = 'V';
  else if (b8 & 0x01) unidad = 'A';
  else if (b7 & 0x20) unidad = 'Ω';
  else if (b7 & 0x10) unidad = 'F';
  else if (b8 & 0x20) unidad = '°C';
  let prefijo: PantallaReal['prefijo'] = '';
  if (b6 & 0x40) prefijo = 'k';
  else if (b6 & 0x20) prefijo = 'n';
  else if (b6 & 0x10) prefijo = 'µ';
  else if (b7 & 0x04) prefijo = 'M';
  else if (b7 & 0x01) prefijo = 'm';
  return { unidad, prefijo, continuidad: (b7 & 0x08) !== 0, raro };
}

/** The display holds 4½ digits. */
const CUENTAS_MAXIMAS = 19999;

/**
 * What the instrument's screen keeps during HOLD, from the firmware's state (`e`: its 40 bytes): a number or an
 * overload, in a known unit. Null for anything else (a blank display, «Auto», a value that does not fit the
 * display): the app cannot tell what the screen shows then.
 */
function pantallaRetenida(e: ArrayLike<number>, ac: boolean): PantallaReal | null {
  const firmware = UNIDAD_FIRMWARE[e[16] ?? 0xff];
  const situacion = e[13] ?? 0xff;
  if (!firmware || (situacion !== 0 && situacion !== 2)) return null;
  const comun = { unidad: firmware.unidad, prefijo: firmware.prefijo, ac, dc: !ac && (firmware.unidad === 'V' || firmware.unidad === 'A') };
  if (situacion === 2) return { ...comun, texto: '0L', valor: null, ol: true, decimales: 0 };
  const decimales = e[12] ?? 0xff;
  if (decimales > 4) return null;
  const v = new DataView(Uint8Array.from({ length: 4 }, (_, k) => e[8 + k] ?? 0).buffer).getFloat32(0, true);
  if (!Number.isFinite(v) || Math.abs(v) * 10 ** decimales > CUENTAS_MAXIMAS + 0.5) return null;
  const texto = v.toFixed(decimales);
  return { ...comun, texto, valor: Number(texto) * ESCALA[firmware.prefijo], ol: false, decimales };
}

/** Whether `informe` is a multimeter display event (kind 0x90, sub-kind 1, a 5A A5 frame). */
export function esTramaMultimetro(informe: ArrayLike<number>): boolean {
  return informe[0] === EVT_MULTIMETRO && informe[2] === 1 && informe[8] === 0x5a && informe[9] === 0xa5;
}

/** A multimeter display event decoded. Throws on anything else. */
export function decodificarMultimetro(informe: ArrayLike<number>): LecturaFnirsi {
  if (!esTramaMultimetro(informe)) throw new Error('No es una trama de pantalla del multímetro del FNIRSI.');
  const t = Array.from({ length: 12 }, (_, k) => informe[8 + k] ?? 0);
  const texto = textoTrama(t);
  const funcion = FUNCIONES[informe[20] ?? 0] ?? 'desconocida';
  const codigo = informe[24 + 16] ?? 0xff;
  const firmware = UNIDAD_FIRMWARE[codigo] ?? null;
  const trama = unidadDeTrama(t);
  const estado = Array.from({ length: 40 }, (_, k) => informe[24 + k] ?? 0);
  const hold = estado[20] === 1;
  const esperando = !hold && texto === 'Auto';
  const ol = /^\.?0\.?L$/.test(texto);
  const valorMostrado = numero(texto);
  const punto = texto.indexOf('.');
  const decimales = valorMostrado !== null && punto >= 0 ? texto.length - punto - 1 : 0;
  const ac = funcion === 'vac' || funcion === 'maac' || funcion === 'aac';
  const conUnidad = trama.unidad !== '';
  const viva: PantallaReal = {
    texto,
    valor: valorMostrado !== null && conUnidad ? valorMostrado * ESCALA[trama.prefijo] : null,
    unidad: trama.unidad,
    prefijo: trama.prefijo,
    ac,
    dc: !ac && (trama.unidad === 'V' || trama.unidad === 'A'),
    ol,
    decimales,
  };
  // HOLD: the screen is the frozen state; the frame (the live reading) is not what the instrument shows
  const retenida = hold ? pantallaRetenida(estado, ac) : null;
  const pantalla: PantallaReal = hold ? (retenida ?? { texto: '', valor: null, unidad: '', prefijo: '', ac: false, dc: false, ol: false, decimales: 0 }) : viva;
  let motivo = '';
  if (hold) motivo = retenida ? '' : 'El FNIRSI está en HOLD y la aplicación no puede leer lo que tiene congelado en pantalla: quite el HOLD.';
  else if (esperando) motivo = 'El FNIRSI está en Auto y no detecta nada en las puntas.';
  else if (!/[^-. ]/.test(texto)) motivo = 'La pantalla está en blanco (cambio de función o de escala).';
  else if (texto.includes('?')) motivo = 'La pantalla muestra un símbolo que la aplicación no conoce.';
  else if (trama.raro) motivo = 'La pantalla tiene encendido un indicador que la aplicación todavía no conoce.';
  else if (!conUnidad) motivo = 'La trama no indica la unidad.';
  else if (!firmware) motivo = `El firmware da una unidad que la aplicación todavía no conoce (código ${codigo}).`;
  else if (firmware.unidad !== trama.unidad || firmware.prefijo !== trama.prefijo) motivo = 'La pantalla y el firmware no dan la misma unidad: el FNIRSI está cambiando de función o de escala.';
  return {
    pantalla,
    funcion,
    esperando,
    continuidad: trama.continuidad,
    fiable: motivo === '',
    motivo,
    hold,
    frecuencia: funcion === 'vac' ? estado[18]! | (estado[19]! << 8) : null,
    tick: u32(informe, 4),
    crudo: hex(t),
  };
}
