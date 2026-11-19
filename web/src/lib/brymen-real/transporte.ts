// 1.3: how the bytes of the real Brymen's cable reach the page, by platform. Every transport only moves raw bytes;
// protocolo.ts decodes them. Which one is used:
//   - a fake one, when a test installed `window.__epaBrymenFalso` before the page loaded (never in normal use);
//   - the app's native plugin (src-tauri/plugins/brymen) inside the app: hidapi on Windows/macOS, android.hardware.usb
//     on Android (WKWebView and the Android WebView have no WebHID, so it cannot be done in the page);
//   - WebHID in a desktop browser that has it (Chrome, Edge);
//   - none: the feature is hidden.

import { PETICION, PID_BU86X, VID_BU86X } from './protocolo.ts';

export interface Transporte {
  readonly tipo: 'nativo' | 'webhid' | 'falso';
  /** Opens the cable (asking the user to pick it or allow it where the system does); its name. */
  abrir(): Promise<string>;
  /** Sends the request and returns the bytes received within `espera` ms per report (none: no answer). */
  leer(espera: number): Promise<Uint8Array>;
  cerrar(): Promise<void>;
}

/** What a test installs to stand in for the cable (tests/brymen13-navegador.spec.ts). */
export interface CableFalso {
  /** Error to throw on opening (a sentence), or nothing. */
  errorAbrir?: string;
  /** The next reply (24 bytes, or fewer), or null: the meter does not answer. Read once per request. */
  respuesta?: number[] | null;
  /** Keeps answering with the last reply. */
  fija?: boolean;
  /** Set: the cable is unplugged (the next read throws this sentence). */
  desenchufado?: string;
  /** Number of requests seen (the test reads it). */
  peticiones?: number;
}

declare global {
  interface Window {
    __epaBrymenFalso?: CableFalso;
  }
}

function enTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// ------------------------------------------------------------------ native (the app)

interface DispositivoNativo {
  nombre: string;
  id: string;
}

class Nativo implements Transporte {
  readonly tipo = 'nativo' as const;
  private async invocar<T>(orden: string, args?: Record<string, unknown>): Promise<T> {
    const { invoke } = await import('@tauri-apps/api/core');
    try {
      return await invoke<T>(`plugin:brymen|${orden}`, args);
    } catch (e) {
      throw new Error(typeof e === 'string' ? e : e instanceof Error ? e.message : 'El cable del Brymen no respondió.');
    }
  }
  async abrir(): Promise<string> {
    return (await this.invocar<DispositivoNativo>('abrir')).nombre;
  }
  async leer(espera: number): Promise<Uint8Array> {
    const r = await this.invocar<{ bytes: number[] }>('leer', { espera: Math.round(espera) });
    return Uint8Array.from(r.bytes ?? []);
  }
  async cerrar(): Promise<void> {
    await this.invocar('cerrar');
  }
}

// ------------------------------------------------------------------ WebHID (desktop Chrome, Edge)

interface DispositivoHid {
  opened: boolean;
  productName: string;
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(id: number, datos: BufferSource): Promise<void>;
  sendFeatureReport(id: number, datos: BufferSource): Promise<void>;
  addEventListener(tipo: 'inputreport', f: (e: { data: DataView }) => void): void;
  removeEventListener(tipo: 'inputreport', f: (e: { data: DataView }) => void): void;
}
interface Hid {
  requestDevice(o: { filters: { vendorId: number; productId: number }[] }): Promise<DispositivoHid[]>;
  addEventListener(tipo: 'disconnect', f: (e: { device: DispositivoHid }) => void): void;
  removeEventListener(tipo: 'disconnect', f: (e: { device: DispositivoHid }) => void): void;
}

function hid(): Hid | null {
  const n = typeof navigator !== 'undefined' ? (navigator as unknown as { hid?: Hid }).hid : undefined;
  return n ?? null;
}

class WebHid implements Transporte {
  readonly tipo = 'webhid' as const;
  private d: DispositivoHid | null = null;
  private cola: number[] = [];
  private avisar: (() => void) | null = null;
  private perdido = false;
  private caracteristica = false;
  private alRecibir = (e: { data: DataView }) => {
    for (let k = 0; k < e.data.byteLength; k++) this.cola.push(e.data.getUint8(k));
    this.avisar?.();
  };
  private alQuitar = (e: { device: DispositivoHid }) => {
    if (e.device === this.d) {
      this.perdido = true;
      this.avisar?.();
    }
  };
  async abrir(): Promise<string> {
    const h = hid()!;
    const [d] = await h.requestDevice({ filters: [{ vendorId: VID_BU86X, productId: PID_BU86X }] });
    if (!d) throw new Error('No se ha elegido el cable BU-86X.');
    if (!d.opened) await d.open();
    d.addEventListener('inputreport', this.alRecibir);
    h.addEventListener('disconnect', this.alQuitar);
    this.d = d;
    this.perdido = false;
    return d.productName || 'BU-86X';
  }
  async leer(espera: number): Promise<Uint8Array> {
    const d = this.d;
    if (!d || this.perdido) throw new Error('Se ha perdido la conexión con el cable del Brymen: ¿se ha desenchufado?');
    this.cola = [];
    const pet = Uint8Array.from(PETICION);
    try {
      if (this.caracteristica) await d.sendFeatureReport(0, pet);
      else await d.sendReport(0, pet);
    } catch {
      if (this.caracteristica) throw new Error('El cable BU-86X no acepta la petición de lectura.');
      this.caracteristica = true;
      await d.sendFeatureReport(0, pet);
    }
    const hasta = Date.now() + 3 * espera;
    while (this.cola.length < 24 && !this.perdido && Date.now() < hasta) {
      await new Promise<void>((r) => {
        const t = setTimeout(r, Math.max(1, hasta - Date.now()));
        this.avisar = () => {
          clearTimeout(t);
          r();
        };
      });
      this.avisar = null;
    }
    if (this.perdido) throw new Error('Se ha perdido la conexión con el cable del Brymen: ¿se ha desenchufado?');
    return Uint8Array.from(this.cola.splice(0, 24));
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

// ------------------------------------------------------------------ the fake cable (browser tests)

class Falso implements Transporte {
  readonly tipo = 'falso' as const;
  constructor(private c: CableFalso) {}
  async abrir(): Promise<string> {
    if (this.c.errorAbrir) throw new Error(this.c.errorAbrir);
    return 'BU-86X (simulado para pruebas)';
  }
  async leer(espera: number): Promise<Uint8Array> {
    await new Promise((r) => setTimeout(r, Math.min(espera, 30)));
    if (this.c.desenchufado) throw new Error(this.c.desenchufado);
    this.c.peticiones = (this.c.peticiones ?? 0) + 1;
    const r = this.c.respuesta;
    if (!this.c.fija) this.c.respuesta = null;
    return Uint8Array.from(r ?? []);
  }
  async cerrar(): Promise<void> {}
}

/** The transport this platform has, or null (the feature is then hidden). */
export function transporteDisponible(): Transporte | null {
  if (typeof window === 'undefined') return null;
  if (window.__epaBrymenFalso) return new Falso(window.__epaBrymenFalso);
  if (enTauri()) {
    // iOS has no USB host for this cable
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return null;
    return new Nativo();
  }
  if (hid() && window.isSecureContext) return new WebHid();
  return null;
}
