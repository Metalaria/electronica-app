// The connection to the real FNIRSI 2C53T, one for the whole app. Once connected the link streams what the
// instrument measures — its multimeter's display about six times a second, or its oscilloscope's acquisitions — and
// this keeps the last reading and the last trace of each channel. Nothing is stored: a reading is only good while
// it is fresh.
//
// The instrument leaves the USB bus at every change of mode (multimeter, oscilloscope, generator) and comes back
// about a second later: that is FNIRSI's own firmware. So a lost link is not an error at first: the connection
// waits for it and takes it up again («reconectando»); only when it does not come back is the reader told.

import { decodificarMultimetro, esTramaMultimetro, type LecturaFnirsi } from './multimetro.ts';
import { EnsambladorOsciloscopio, type Traza } from './osciloscopio.ts';
import {
  FLUJO_MULTIMETRO,
  FLUJO_OSCILOSCOPIO,
  ORDEN_INFO,
  ORDEN_SUSCRIBIR,
  PROTOCOLO,
  leerInfo,
  partir,
  peticion,
  respuestaA,
  type InfoEnlace,
  type ModoFnirsi,
} from './protocolo.ts';
import { transporteFnirsiDisponible, type TransporteFnirsi } from './transporte.ts';

export type EstadoFnirsi = 'desconectado' | 'conectando' | 'conectado' | 'reconectando' | 'error';

/** Wait for the first report of a read (ms) and most reports taken by one read. */
const ESPERA = 150;
const MAXIMO = 256;
/** How long the link has to answer a request. */
const RESPUESTA_MS = 1500;
/** How long a link that left the bus is waited for (a change of mode takes about two seconds), and the pause between tries. */
const RECONEXION_MS = 20_000;
const PAUSA_RECONEXION = 600;
/** No measurement for this long while the instrument is in a measuring mode: the reader is told. */
const SIN_MEDIDAS_MS = 3000;
/** A reading or a trace older than this is not shown as the current one. */
export const CADUCIDAD_FNIRSI_MS = 2000;

const pausa = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function texto(e: unknown, defecto: string): string {
  const m = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  return m.trim() || defecto;
}

export class ConexionFnirsi {
  /** The platform can read the link (false: everything about it is hidden). */
  readonly disponible: boolean;
  estado = $state<EstadoFnirsi>('desconectado');
  /** What to tell the reader about the state (Spanish, «usted»). */
  mensaje = $state('');
  nombre = $state('');
  info = $state<InfoEnlace | null>(null);
  /** The instrument's mode when the link was last identified. */
  modo = $state<ModoFnirsi>('otro');
  /** The multimeter's last display and when it arrived (Date.now()). */
  multimetro = $state<LecturaFnirsi | null>(null);
  horaMultimetro = $state(0);
  /** The last trace of each channel and when the last one arrived. */
  trazas = $state<[Traza | null, Traza | null]>([null, null]);
  horaTraza = $state(0);
  /** Reports received and reports the transport had to drop (diagnostics). */
  informes = $state(0);
  perdidos = $state(0);

  private t: TransporteFnirsi | null;
  private vuelta = 0;
  private secuencia = 0;
  private ensamblador = new EnsambladorOsciloscopio();

  constructor(t: TransporteFnirsi | null = transporteFnirsiDisponible()) {
    this.t = t;
    this.disponible = !!t;
  }

  get tipo(): TransporteFnirsi['tipo'] | null {
    return this.t?.tipo ?? null;
  }

  /** The multimeter's reading, if it is fresh. */
  multimetroVigente(ahora = Date.now()): LecturaFnirsi | null {
    return this.estado === 'conectado' && this.multimetro && ahora - this.horaMultimetro <= CADUCIDAD_FNIRSI_MS ? this.multimetro : null;
  }

  /** The channels' traces, if they are fresh (each may be null: channel off). */
  trazasVigentes(ahora = Date.now()): [Traza | null, Traza | null] {
    return this.estado === 'conectado' && ahora - this.horaTraza <= CADUCIDAD_FNIRSI_MS ? this.trazas : [null, null];
  }

  async conectar(): Promise<void> {
    if (!this.t || this.estado === 'conectando' || this.estado === 'conectado' || this.estado === 'reconectando') return;
    const v = ++this.vuelta;
    this.estado = 'conectando';
    this.mensaje = 'Buscando el FNIRSI…';
    this.olvidar();
    try {
      this.nombre = await this.t.abrir();
      await this.sesion(v);
    } catch (e) {
      if (v !== this.vuelta) return;
      this.vuelta++;
      this.estado = 'error';
      this.mensaje = texto(e, 'No se pudo abrir el FNIRSI.');
      await this.cerrarCallado();
      return;
    }
    if (v !== this.vuelta) return;
    this.estado = 'conectado';
    this.mensaje = '';
    void this.bucle(v);
  }

  async desconectar(): Promise<void> {
    this.vuelta++;
    this.estado = 'desconectado';
    this.mensaje = '';
    this.olvidar();
    await this.cerrarCallado();
  }

  private olvidar(): void {
    this.multimetro = null;
    this.trazas = [null, null];
    this.ensamblador.reiniciar();
  }

  private async cerrarCallado(): Promise<void> {
    try {
      await this.t?.cerrar();
    } catch {
      // (closing a link already gone)
    }
  }

  /** Sends a request and waits for its response, handling the events that arrive before it. */
  private async pedir(v: number, orden: number, argumento = 0): Promise<Uint8Array> {
    const t = this.t!;
    const sec = (this.secuencia = (this.secuencia + 1) & 0xff);
    await t.enviar(peticion(orden, sec, argumento));
    const hasta = Date.now() + RESPUESTA_MS;
    while (Date.now() < hasta && v === this.vuelta) {
      const r = await t.leer(ESPERA, MAXIMO);
      this.perdidos += r.perdidos;
      let respuesta: Uint8Array | null = null;
      for (const informe of partir(r.bytes)) {
        this.informes++;
        const a = respuestaA(informe, orden, sec);
        if (a) {
          if (a.estado !== 0) throw new Error('El FNIRSI ha rechazado una petición de la aplicación: su firmware con el enlace no es el que esta versión espera.');
          respuesta = informe.slice();
        } else this.atender(informe);
      }
      if (respuesta) return respuesta;
    }
    throw new Error('El FNIRSI está enchufado, pero su enlace no responde. Apáguelo, enciéndalo de nuevo y vuelva a conectar.');
  }

  /** Identifies the link and subscribes to both streams (each only flows in its own mode). */
  private async sesion(v: number): Promise<void> {
    const info = leerInfo(await this.pedir(v, ORDEN_INFO));
    if (!info) throw new Error('El dispositivo no se identifica como el enlace del FNIRSI 2C53T.');
    if (info.protocolo !== PROTOCOLO)
      throw new Error(`El enlace del FNIRSI habla la versión ${info.protocolo} de su protocolo y esta aplicación conoce la ${PROTOCOLO}: actualice la aplicación o el firmware del enlace.`);
    await this.pedir(v, ORDEN_SUSCRIBIR, FLUJO_MULTIMETRO | FLUJO_OSCILOSCOPIO);
    if (v !== this.vuelta) return;
    this.info = info;
    this.modo = info.modo;
  }

  /** One report of the stream. */
  private atender(informe: Uint8Array, nuevas?: [Traza | null, Traza | null]): void {
    if (esTramaMultimetro(informe)) {
      try {
        this.multimetro = decodificarMultimetro(informe);
        this.horaMultimetro = Date.now();
      } catch {
        // (not a display frame after all: wait for the next)
      }
      return;
    }
    const traza = this.ensamblador.recibir(informe);
    if (traza && nuevas) nuevas[traza.canal] = traza;
  }

  private async bucle(v: number): Promise<void> {
    const t = this.t!;
    let ultima = Date.now();
    while (v === this.vuelta) {
      let bytes: Uint8Array;
      try {
        const r = await t.leer(ESPERA, MAXIMO);
        bytes = r.bytes;
        this.perdidos += r.perdidos;
      } catch (e) {
        if (v !== this.vuelta) return;
        if (!(await this.reconectar(v, texto(e, 'Se ha perdido la conexión con el FNIRSI.')))) return;
        ultima = Date.now();
        continue;
      }
      if (v !== this.vuelta) return;
      const nuevas: [Traza | null, Traza | null] = [null, null];
      const antes = this.horaMultimetro;
      for (const informe of partir(bytes)) {
        this.informes++;
        this.atender(informe, nuevas);
      }
      if (nuevas[0] || nuevas[1]) {
        // a channel that sends nothing in this batch keeps its last trace only while it is still on
        const activo = (nuevas[0] ?? nuevas[1])!.ajustes.canales;
        this.trazas = [nuevas[0] ?? (activo[0].activo ? this.trazas[0] : null), nuevas[1] ?? (activo[1].activo ? this.trazas[1] : null)];
        this.horaTraza = Date.now();
      }
      const ahora = Date.now();
      if (nuevas[0] || nuevas[1] || this.horaMultimetro !== antes) {
        ultima = ahora;
        if (this.mensaje) this.mensaje = '';
      } else if (ahora - ultima > SIN_MEDIDAS_MS && !this.mensaje) {
        this.mensaje =
          this.modo === 'generador'
            ? 'El FNIRSI está en el generador de señales: ahí no hay medidas que leer. Páselo a multímetro u osciloscopio.'
            : this.modo === 'osciloscopio'
              ? 'El FNIRSI no envía trazas: compruebe que el osciloscopio está en RUN.'
              : 'El FNIRSI no envía lecturas: compruebe que está en multímetro u osciloscopio.';
      }
    }
  }

  /** The link went away: waits for it to come back (a change of mode). False: it did not, and the loop must end. */
  private async reconectar(v: number, motivo: string): Promise<boolean> {
    const t = this.t!;
    this.estado = 'reconectando';
    this.mensaje = 'El FNIRSI ha dejado el USB un momento (lo hace cada vez que cambia de modo). Esperando a que vuelva…';
    this.olvidar();
    const hasta = Date.now() + RECONEXION_MS;
    let ultimo = motivo;
    while (v === this.vuelta && Date.now() < hasta) {
      await this.cerrarCallado();
      await pausa(PAUSA_RECONEXION);
      if (v !== this.vuelta) return false;
      try {
        this.nombre = await t.abrir();
        await this.sesion(v);
        if (v !== this.vuelta) return false;
        this.estado = 'conectado';
        this.mensaje = '';
        return true;
      } catch (e) {
        ultimo = texto(e, motivo);
      }
    }
    if (v !== this.vuelta) return false;
    this.vuelta++;
    this.estado = 'error';
    this.mensaje = `${ultimo} Las últimas medidas ya no valen: conecte de nuevo cuando el FNIRSI esté enchufado y en multímetro u osciloscopio.`;
    await this.cerrarCallado();
    return false;
  }
}

export const fnirsiReal = new ConexionFnirsi();
