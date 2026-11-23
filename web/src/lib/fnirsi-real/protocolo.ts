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
// Orders used here: 0x01 identification, 0x03 subscription ([2] = bit 0 multimeter, bit 1 oscilloscope). The link
// answers each request with exactly one response; events may arrive before it. A session starts unsubscribed.
// Events: 0x90 multimeter frame, 0xA0 oscilloscope record header, 0xA1 oscilloscope record data (see the two
// decoders). The link never writes anything in the instrument.
//
// The link is only on the bus while the instrument is in one of its three measuring modes; FNIRSI's firmware
// disconnects USB at every mode change, so the link disappears for about a second and comes back (conexion.svelte.ts
// reconnects by itself). In «USB Sharing» the instrument is its factory mass-storage drive and there is no link.

export const VID_ENLACE = 0x1209;
export const PID_ENLACE = 0x0001;
export const PRODUCTO_ENLACE = '2C53T stock-link';
export const INFORME = 64;

export const ORDEN_INFO = 0x01;
export const ORDEN_SUSCRIBIR = 0x03;
export const FLUJO_MULTIMETRO = 0x01;
export const FLUJO_OSCILOSCOPIO = 0x02;

export const EVT_MULTIMETRO = 0x90;
export const EVT_OSC_CABECERA = 0xa0;
export const EVT_OSC_DATOS = 0xa1;

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

/** The whole reports in `bytes` (what a transport's read returns); a trailing partial one is dropped. */
export function partir(bytes: Uint8Array): Uint8Array[] {
  const v: Uint8Array[] = [];
  for (let k = 0; k + INFORME <= bytes.length; k += INFORME) v.push(bytes.subarray(k, k + INFORME));
  return v;
}

export function esEvento(informe: ArrayLike<number>): boolean {
  const k = informe[0];
  return k === EVT_MULTIMETRO || k === EVT_OSC_CABECERA || k === EVT_OSC_DATOS;
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
  };
}

export function hex(p: ArrayLike<number>): string {
  return Array.from(p as ArrayLike<number>, (x) => x.toString(16).padStart(2, '0')).join(' ');
}
