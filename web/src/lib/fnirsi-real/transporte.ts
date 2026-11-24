// How the reports of the real FNIRSI's link reach the page, by platform. Every transport only moves raw 64-byte
// reports; protocolo.ts, multimetro.ts and osciloscopio.ts decode them. Which one is used (the same choice as the
// real Brymen's, lib/brymen-real/transporte.ts):
//   - a fake one, when a test installed `window.__epaFnirsiFalso` before the page loaded (never in normal use);
//   - the app's native plugin (src-tauri/plugins/fnirsi) inside the app: hidapi on Windows/macOS, android.hardware.usb
//     on Android (WKWebView and the Android WebView have no WebHID, so it cannot be done in the page);
//   - WebHID in a desktop browser that has it (Chrome, Edge);
//   - none: the feature is hidden.

import { INFORME, ORDEN_INFO, ORDEN_LEER, ORDEN_SUSCRIBIR, PID_ENLACE, PRODUCTO_ENLACE, PROTOCOLO, VID_ENLACE, u32 } from './protocolo.ts';

export interface Recibido {
  /** Whole reports, 64 bytes each, oldest first. */
  bytes: Uint8Array;
  /** Reports dropped since the last read because nobody asked in time. */
  perdidos: number;
}

export interface TransporteFnirsi {
  readonly tipo: 'nativo' | 'webhid' | 'falso';
  /** Opens the link (asking the user to pick it or allow it where the system does); its name. */
  abrir(): Promise<string>;
  /** Sends one request (a 64-byte report). */
  enviar(informe: Uint8Array): Promise<void>;
  /** The reports received since the last call (at most `maximo`), waiting at most `espera` ms for the first. */
  leer(espera: number, maximo: number): Promise<Recibido>;
  cerrar(): Promise<void>;
}

/** What a test installs to stand in for the instrument (tests/fnirsi-real-*.spec.ts). */
export interface EnlaceFalso {
  /** Error to throw on opening (a sentence), or nothing. */
  errorAbrir?: string;
  /** The instrument's mode in the identification response (1 multimeter, 2 oscilloscope, 3 generator). */
  modo?: number;
  /** Protocol version in the identification response (default: the one the app knows). */
  protocolo?: number;
  /** Event reports to hand out, in order, a few per read. */
  eventos?: number[][];
  /** Starts over when `eventos` runs out. */
  repetir?: boolean;
  /** Set: the link has gone (the next read or request throws this sentence). */
  desenchufado?: string;
  /** Number of times the link was opened and the subscription masks received (the test reads them). */
  aperturas?: number;
  suscripciones?: number[];
  /** The instrument's memory a read request finds, by address (hex text, as JSON keys are); any other is refused. */
  memoria?: Record<string, number[]>;
  /** Addresses read so far (the test reads them). */
  lecturas?: number[];
}

declare global {
  interface Window {
    __epaFnirsiFalso?: EnlaceFalso;
  }
}

const PERDIDO = 'Se ha perdido la conexión con el FNIRSI: ¿ha cambiado de modo, se ha apagado o se ha desenchufado?';

function enTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// ------------------------------------------------------------------ native (the app)

class Nativo implements TransporteFnirsi {
  readonly tipo = 'nativo' as const;
  private async invocar<T>(orden: string, args?: Record<string, unknown>): Promise<T> {
    const { invoke } = await import('@tauri-apps/api/core');
    try {
      return await invoke<T>(`plugin:fnirsi|${orden}`, args);
    } catch (e) {
      throw new Error(typeof e === 'string' ? e : e instanceof Error ? e.message : 'El FNIRSI no respondió.');
    }
  }
  async abrir(): Promise<string> {
    return (await this.invocar<{ nombre: string }>('abrir')).nombre;
  }
  async enviar(informe: Uint8Array): Promise<void> {
    await this.invocar('enviar', { bytes: Array.from(informe) });
  }
  async leer(espera: number, maximo: number): Promise<Recibido> {
    const r = await this.invocar<{ bytes: number[]; perdidos?: number }>('leer', { espera: Math.round(espera), maximo: Math.round(maximo) });
    return { bytes: Uint8Array.from(r.bytes ?? []), perdidos: r.perdidos ?? 0 };
  }
  async cerrar(): Promise<void> {
    await this.invocar('cerrar');
  }
}

// ------------------------------------------------------------------ WebHID (desktop Chrome, Edge)

interface DispositivoHid {
  opened: boolean;
  productName: string;
  vendorId: number;
  productId: number;
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(id: number, datos: BufferSource): Promise<void>;
  addEventListener(tipo: 'inputreport', f: (e: { data: DataView }) => void): void;
  removeEventListener(tipo: 'inputreport', f: (e: { data: DataView }) => void): void;
}
interface Hid {
  getDevices(): Promise<DispositivoHid[]>;
  requestDevice(o: { filters: { vendorId: number; productId: number }[] }): Promise<DispositivoHid[]>;
  addEventListener(tipo: 'disconnect', f: (e: { device: DispositivoHid }) => void): void;
  removeEventListener(tipo: 'disconnect', f: (e: { device: DispositivoHid }) => void): void;
}

function hid(): Hid | null {
  const n = typeof navigator !== 'undefined' ? (navigator as unknown as { hid?: Hid }).hid : undefined;
  return n ?? null;
}

/** Reports kept for the page between reads; a full queue is emptied whole (as the native side does). */
const COLA_MAXIMA = 4096;

class WebHid implements TransporteFnirsi {
  readonly tipo = 'webhid' as const;
  private d: DispositivoHid | null = null;
  private cola: Uint8Array[] = [];
  private perdidos = 0;
  private avisar: (() => void) | null = null;
  private perdido = false;
  private alRecibir = (e: { data: DataView }) => {
    if (e.data.byteLength !== INFORME) return;
    if (this.cola.length >= COLA_MAXIMA) {
      this.perdidos += this.cola.length;
      this.cola = [];
    }
    this.cola.push(new Uint8Array(e.data.buffer.slice(e.data.byteOffset, e.data.byteOffset + INFORME)));
    this.avisar?.();
  };
  private alQuitar = (e: { device: DispositivoHid }) => {
    if (e.device === this.d) {
      this.perdido = true;
      this.avisar?.();
    }
  };
  private esEnlace(d: DispositivoHid): boolean {
    return d.vendorId === VID_ENLACE && d.productId === PID_ENLACE && d.productName.trim() === PRODUCTO_ENLACE;
  }
  async abrir(): Promise<string> {
    const h = hid()!;
    await this.cerrar();
    // a link the user already allowed (it comes back by itself after a change of mode) needs no new choice
    let d = (await h.getDevices()).find((x) => this.esEnlace(x));
    if (!d) {
      let elegido: DispositivoHid | undefined;
      try {
        [elegido] = await h.requestDevice({ filters: [{ vendorId: VID_ENLACE, productId: PID_ENLACE }] });
      } catch {
        // (the browser only shows its chooser after a click: a reconnection by itself cannot open it)
        throw new Error('El navegador necesita que elija el FNIRSI: pulse «Conectar el FNIRSI real».');
      }
      if (!elegido) throw new Error('No se ha elegido el FNIRSI.');
      // (1209:0001 is a shared test id: the name tells the link from anything else)
      if (!this.esEnlace(elegido)) throw new Error('El dispositivo elegido no es el enlace del FNIRSI 2C53T («2C53T stock-link»).');
      d = elegido;
    }
    if (!d.opened) await d.open();
    d.addEventListener('inputreport', this.alRecibir);
    h.addEventListener('disconnect', this.alQuitar);
    this.d = d;
    this.perdido = false;
    this.cola = [];
    this.perdidos = 0;
    return d.productName || PRODUCTO_ENLACE;
  }
  async enviar(informe: Uint8Array): Promise<void> {
    const d = this.d;
    if (!d || this.perdido) throw new Error(PERDIDO);
    try {
      await d.sendReport(0, informe.slice());
    } catch {
      throw new Error(PERDIDO);
    }
  }
  async leer(espera: number, maximo: number): Promise<Recibido> {
    if (!this.d) throw new Error('El FNIRSI no está abierto.');
    if (!this.cola.length && !this.perdido && espera > 0) {
      await new Promise<void>((r) => {
        const t = setTimeout(r, espera);
        this.avisar = () => {
          clearTimeout(t);
          r();
        };
      });
      this.avisar = null;
    }
    if (!this.cola.length && this.perdido) throw new Error(PERDIDO);
    const tomados = this.cola.splice(0, Math.max(1, maximo));
    const bytes = new Uint8Array(tomados.length * INFORME);
    tomados.forEach((r, k) => bytes.set(r, k * INFORME));
    const perdidos = this.perdidos;
    this.perdidos = 0;
    return { bytes, perdidos };
  }
  async cerrar(): Promise<void> {
    const d = this.d;
    this.d = null;
    hid()?.removeEventListener('disconnect', this.alQuitar);
    if (!d) return;
    d.removeEventListener('inputreport', this.alRecibir);
    try {
      await d.close();
    } catch {
      // (already gone)
    }
  }
}

// ------------------------------------------------------------------ the fake link (tests)

/** The fake link: answers the requests as the real one does and hands out the scripted events. */
export class Falso implements TransporteFnirsi {
  readonly tipo = 'falso' as const;
  private pendientes: Uint8Array[] = [];
  private k = 0;
  private flujo = 0;
  constructor(private c: EnlaceFalso) {}
  async abrir(): Promise<string> {
    if (this.c.errorAbrir) throw new Error(this.c.errorAbrir);
    this.c.aperturas = (this.c.aperturas ?? 0) + 1;
    this.pendientes = [];
    this.flujo = 0;
    return `${PRODUCTO_ENLACE} (simulado para pruebas)`;
  }
  async enviar(informe: Uint8Array): Promise<void> {
    if (this.c.desenchufado) throw new Error(this.c.desenchufado);
    const r = new Uint8Array(INFORME);
    r[0] = (informe[0] ?? 0) | 0x80;
    r[1] = informe[1] ?? 0;
    if (informe[0] === ORDEN_INFO) {
      r[3] = 36;
      r.set(Array.from('2C53LINK', (ch) => ch.charCodeAt(0)), 8);
      r[16] = this.c.protocolo ?? PROTOCOLO;
      r[17] = 2;
      r[18] = this.c.modo ?? 1;
      r[19] = this.flujo;
    } else if (informe[0] === ORDEN_SUSCRIBIR) {
      this.flujo = informe[2] ?? 0;
      (this.c.suscripciones ??= []).push(this.flujo);
    } else if (informe[0] === ORDEN_LEER) {
      const direccion = u32(informe, 4);
      const largo = informe[2] ?? 0;
      const bloque = this.c.memoria?.[direccion.toString(16)];
      (this.c.lecturas ??= []).push(direccion);
      r.set(informe.subarray(4, 8), 4);
      if (bloque && largo >= 1 && largo <= bloque.length) {
        r[3] = largo;
        r.set(bloque.slice(0, largo), 8);
      } else r[2] = 2;
    } else {
      r[2] = 1;
    }
    this.pendientes.push(r);
  }
  async leer(espera: number, maximo: number): Promise<Recibido> {
    await new Promise((r) => setTimeout(r, Math.min(espera, 20)));
    if (this.c.desenchufado) throw new Error(this.c.desenchufado);
    const v = this.pendientes.splice(0, maximo);
    const eventos = this.c.eventos ?? [];
    // (events only once subscribed, a few dozen per read, as the real link's pace gives)
    while (this.flujo && v.length < Math.min(maximo, 48) && eventos.length) {
      if (this.k >= eventos.length) {
        if (!this.c.repetir) break;
        this.k = 0;
      }
      v.push(Uint8Array.from(eventos[this.k++]!));
    }
    const bytes = new Uint8Array(v.length * INFORME);
    v.forEach((r, k) => bytes.set(r.subarray(0, INFORME), k * INFORME));
    return { bytes, perdidos: 0 };
  }
  async cerrar(): Promise<void> {}
}

/** The transport this platform has, or null (the feature is then hidden). */
export function transporteFnirsiDisponible(): TransporteFnirsi | null {
  if (typeof window === 'undefined') return null;
  if (window.__epaFnirsiFalso) return new Falso(window.__epaFnirsiFalso);
  if (enTauri()) {
    // iOS has no USB host for this instrument
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return null;
    return new Nativo();
  }
  if (hid() && window.isSecureContext) return new WebHid();
  return null;
}
