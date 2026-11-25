// The real FNIRSI 2C53T through «stock-link» — the reports of the link, shared by every platform (the native
// transports, src-tauri/plugins/fnirsi, and WebHID only move raw 64-byte reports; everything is decoded here and in
// multimetro.ts / osciloscopio.ts).
//
// «stock-link» is a small patch on FNIRSI's own V1.2.0 firmware (github.com/Metalaria/fnirsi-2c53t-link): the
// instrument keeps its factory measurements and calibration and gains a vendor HID interface (USB 1209:0001,
// product «2C53T stock-link») that reports what its own firmware has just measured. The format below is the one
// that project documents (its README, «Protocol»), checked against a real unit on 2026-11-23.
//
// Every report is 64 bytes, without a report id, little-endian numbers:
//   request   (host → link): [0] order, [1] sequence, [2] argument, [3] 0, [4…7] address
//   response  (link → host): [0] order | 0x80, [1] sequence, [2] status (0 = fine), [3] payload bytes, [4…7] address,
//                            [8…] payload
//   event     (link → host): [0] kind, [1] sequence, [2] sub-kind or channel, [3] payload bytes, [4…7] tick (ms since
//                            the instrument started) or offset, [8…] payload
// Orders used here: 0x01 identification, 0x02 read ([2] = bytes wanted, at most 56, of the instrument's own memory
// at [4…7]: the link only reads, and answers with a status other than 0 for an address outside the processor's
// flash and RAM), 0x03 subscription ([2] = bit 0 multimeter, bit 1 oscilloscope, bit 2 status; a link without the
// status stream refuses a mask with its bit). The link answers each request with exactly one response; events may
// arrive before it. A session starts unsubscribed.
// Events: 0x90 multimeter frame, 0xA0 oscilloscope record header, 0xA1 oscilloscope record data (see the two
// decoders), 0xB0 status. Up to patch 3 the link never writes anything in the instrument. Patch 4 (on the real
// unit since 2026-11-25) adds order 0x04, which stores samples in the table its signal generator plays and in
// nothing else ([2] = samples, 1 to 28; [4…7] = position of the first in the table, 0 to 99; from [8] the samples,
// 16 bits each). A link says it has it with bit 1 of the same byte that announces the status stream. See ondas.ts.
//
// The status stream (patch 3 of the link, on the real unit since 2026-11-24) carries what the other two do not:
// every 100 ms one block of the instrument's memory, taking turns among those of the mode it is in ([2] says
// which): 1 the generator's ten bytes (generator and oscilloscope), 2 and 3 the oscilloscope's own measurements
// of CH1 and CH2, 48 bytes and one more that is 1 while it runs (oscilloscope), 4 sixteen more bytes of the
// multimeter's state (multimeter). Their layouts are in estado.ts. A link says it has this stream in its
// identification: one more byte after the counters, bit 0. The protocol version is still 1: a link without the
// stream is asked for the same blocks with order 0x02 instead.
//
// The link is only on the bus while the instrument is in one of its three measuring modes; FNIRSI's firmware
// disconnects USB at every mode change, so the link disappears for about a second and comes back (conexion.svelte.ts
// reconnects by itself). In «USB Sharing» the instrument is its factory mass-storage drive and there is no link.

export const VID_ENLACE = 0x1209;
export const PID_ENLACE = 0x0001;
export const PRODUCTO_ENLACE = '2C53T stock-link';
export const INFORME = 64;

export const ORDEN_INFO = 0x01;
export const ORDEN_LEER = 0x02;
export const ORDEN_SUSCRIBIR = 0x03;
export const ORDEN_ONDA = 0x04;
/** Most bytes one report carries after its eight-byte head. */
export const CARGA_MAXIMA = 56;
export const FLUJO_MULTIMETRO = 0x01;
export const FLUJO_OSCILOSCOPIO = 0x02;
export const FLUJO_ESTADO = 0x04;

export const EVT_MULTIMETRO = 0x90;
export const EVT_OSC_CABECERA = 0xa0;
export const EVT_OSC_DATOS = 0xa1;
export const EVT_ESTADO = 0xb0;

/** The blocks of the status stream ([2] of its events). */
export const ESTADO_GENERADOR = 1;
export const ESTADO_MEDIDAS_CH1 = 2;
export const ESTADO_MEDIDAS_CH2 = 3;
export const ESTADO_MULTIMETRO = 4;

/** The protocol version this decoder was written for. */
export const PROTOCOLO = 1;
const FIRMA = '2C53LINK';

/** The instrument's mode (FNIRSI's own state byte). */
export type ModoFnirsi = 'multimetro' | 'osciloscopio' | 'generador' | 'otro';

export function modoDe(n: number): ModoFnirsi {
  return n === 1 ? 'multimetro' : n === 2 ? 'osciloscopio' : n === 3 ? 'generador' : 'otro';
}

export interface InfoEnlace {
  protocolo: number;
  parche: number;
  modo: ModoFnirsi;
  /** Subscription mask in force. */
  flujo: number;
  /** Milliseconds since the instrument started. */
  ticks: number;
  /** Counters since the instrument started (diagnostics). */
  tramasMultimetro: number;
  registrosOsciloscopio: number;
  registrosSaltados: number;
  /** The link has the status stream (patch 3 on). */
  estadoEnFlujo: boolean;
  /** The link can store a waveform in the generator's table (patch 4 on). */
  ondasAMedida: boolean;
}

export function u32(p: ArrayLike<number>, i: number): number {
  return ((p[i] ?? 0) | ((p[i + 1] ?? 0) << 8) | ((p[i + 2] ?? 0) << 16) | ((p[i + 3] ?? 0) << 24)) >>> 0;
}

/** A request's report. */
export function peticion(orden: number, secuencia: number, argumento = 0): Uint8Array {
  const r = new Uint8Array(INFORME);
  r[0] = orden & 0xff;
  r[1] = secuencia & 0xff;
  r[2] = argumento & 0xff;
  return r;
}

/** A request to read `largo` bytes (1 to 56) of the instrument's memory at `direccion`. */
export function peticionLeer(secuencia: number, direccion: number, largo: number): Uint8Array {
  if (!Number.isInteger(largo) || largo < 1 || largo > CARGA_MAXIMA) throw new Error('Una lectura del enlace del FNIRSI lleva de 1 a 56 bytes.');
  const r = peticion(ORDEN_LEER, secuencia, largo);
  for (let k = 0; k < 4; k++) r[4 + k] = (direccion >>> (8 * k)) & 0xff;
  return r;
}

/**
 * A request to store `muestras` (1 to 28 of them, each from 0 to 4094) in the generator's table from position
 * `primera` on (0 to 99, and the last one inside the table).
 */
export function peticionOnda(secuencia: number, primera: number, muestras: ArrayLike<number>): Uint8Array {
  const n = muestras.length;
  if (n < 1 || n > 28) throw new Error('Una petición de onda del enlace del FNIRSI lleva de 1 a 28 muestras.');
  if (!Number.isInteger(primera) || primera < 0 || primera + n > 100) throw new Error('La tabla del generador del FNIRSI tiene 100 posiciones.');
  const r = peticion(ORDEN_ONDA, secuencia, n);
  r[4] = primera;
  for (let k = 0; k < n; k++) {
    const x = muestras[k]!;
    if (!Number.isInteger(x) || x < 0 || x > 4094) throw new Error('Una muestra de la onda va de 0 a 4094.');
    r[8 + 2 * k] = x & 0xff;
    r[9 + 2 * k] = x >> 8;
  }
  return r;
}

/**
 * What `informe` is to a waveform request: the amplitude the link scaled by (tenths of a volt) and the waveform the
 * instrument will go back to, 'rechazada', or null when it is another report.
 */
export function respuestaOnda(informe: ArrayLike<number>, secuencia: number, primera: number): { amplitud: number; forma: number } | 'rechazada' | null {
  const a = respuestaA(informe, ORDEN_ONDA, secuencia);
  if (!a || u32(informe, 4) !== primera) return null;
  if (a.estado !== 0 || informe[3] !== 2) return 'rechazada';
  return { amplitud: informe[8] ?? 0, forma: informe[9] ?? 0 };
}

/**
 * What `informe` is to a read request: its bytes, 'rechazada' when the link refused it, or null when it is another
 * report (an event, or the response to another request).
 */
export function respuestaLeer(informe: ArrayLike<number>, secuencia: number, direccion: number, largo: number): Uint8Array | 'rechazada' | null {
  const a = respuestaA(informe, ORDEN_LEER, secuencia);
  if (!a || u32(informe, 4) !== direccion >>> 0) return null;
  if (a.estado !== 0 || informe[3] !== largo) return 'rechazada';
  return Uint8Array.from({ length: largo }, (_, k) => informe[8 + k] ?? 0);
}

/** The whole reports in `bytes` (what a transport's read returns); a trailing partial one is dropped. */
export function partir(bytes: Uint8Array): Uint8Array[] {
  const v: Uint8Array[] = [];
  for (let k = 0; k + INFORME <= bytes.length; k += INFORME) v.push(bytes.subarray(k, k + INFORME));
  return v;
}

export function esEvento(informe: ArrayLike<number>): boolean {
  const k = informe[0];
  return k === EVT_MULTIMETRO || k === EVT_OSC_CABECERA || k === EVT_OSC_DATOS || k === EVT_ESTADO;
}

/** A status event's block and its bytes; null when `informe` is not one. */
export function leerEstado(informe: ArrayLike<number>): { bloque: number; bytes: Uint8Array } | null {
  const n = informe[3] ?? 0;
  if (informe[0] !== EVT_ESTADO || n < 1 || n > CARGA_MAXIMA) return null;
  return { bloque: informe[2] ?? 0, bytes: Uint8Array.from({ length: n }, (_, k) => informe[8 + k] ?? 0) };
}

/** Whether `informe` is the response to the request `orden`/`secuencia`; its status when it is. */
export function respuestaA(informe: ArrayLike<number>, orden: number, secuencia: number): { estado: number } | null {
  if (informe[0] !== ((orden | 0x80) & 0xff) || informe[1] !== (secuencia & 0xff)) return null;
  return { estado: informe[2] ?? 0xff };
}

/** The identification response decoded; null when it is not one from a stock-link. */
export function leerInfo(informe: ArrayLike<number>): InfoEnlace | null {
  if (informe[0] !== (ORDEN_INFO | 0x80) || informe[2] !== 0 || (informe[3] ?? 0) < 24) return null;
  let firma = '';
  for (let k = 0; k < FIRMA.length; k++) firma += String.fromCharCode(informe[8 + k] ?? 0);
  if (firma !== FIRMA) return null;
  const largo = informe[3] ?? 0;
  return {
    protocolo: informe[16] ?? 0,
    parche: informe[17] ?? 0,
    modo: modoDe(informe[18] ?? 0),
    flujo: informe[19] ?? 0,
    ticks: u32(informe, 20),
    tramasMultimetro: largo >= 36 ? u32(informe, 32) : 0,
    registrosOsciloscopio: largo >= 36 ? u32(informe, 36) : 0,
    registrosSaltados: largo >= 36 ? u32(informe, 40) : 0,
    estadoEnFlujo: largo >= 37 && ((informe[44] ?? 0) & 0x01) !== 0,
    ondasAMedida: largo >= 37 && ((informe[44] ?? 0) & 0x02) !== 0,
  };
}

export function hex(p: ArrayLike<number>): string {
  return Array.from(p as ArrayLike<number>, (x) => x.toString(16).padStart(2, '0')).join(' ');
}
