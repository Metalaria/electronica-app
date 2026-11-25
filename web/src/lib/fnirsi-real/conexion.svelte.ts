// The connection to the real FNIRSI 2C53T, one for the whole app. Once connected the link streams what the
// instrument measures — its multimeter's display about six times a second, or its oscilloscope's acquisitions — and
// this keeps the last reading and the last trace of each channel. Nothing is stored: a reading is only good while
// it is fresh.
//
// The instrument leaves the USB bus at every change of mode (multimeter, oscilloscope, generator) and comes back
// about a second later: that is FNIRSI's own firmware. So a lost link is not an error at first: the connection
// waits for it and takes it up again («reconectando»); only when it does not come back is the reader told.
//
// A few things the instrument knows are not in the two measuring streams: its generator's settings, its
// oscilloscope's own measurements and whether it is running or stopped (estado.ts). A link with the status
// stream (patch 3) sends them by itself several times a second. One without it reads the instrument's memory on
// request, so the loop asks for them a couple of times a second, between two reads of the stream; the answers
// come back in the stream and are told apart by their sequence number. The same questions are asked of a link
// that announces the status stream and then sends nothing of it.

import {
  DIR_ESTADO_OSCILOSCOPIO,
  DIR_GENERADOR,
  DIR_MEDIDAS_CH1,
  LARGO_ESTADO_OSCILOSCOPIO,
  LARGO_GENERADOR,
  LARGO_MEDIDAS,
  decodificarGenerador,
  decodificarMedidas,
  osciloscopioEnMarcha,
  type AjustesGenerador,
  type MedidasOsciloscopio,
} from './estado.ts';
import { decodificarMultimetro, esTramaMultimetro, type LecturaFnirsi } from './multimetro.ts';
import { EnsambladorOsciloscopio, type Traza } from './osciloscopio.ts';
import {
  ESTADO_GENERADOR,
  ESTADO_MEDIDAS_CH1,
  ESTADO_MEDIDAS_CH2,
  ESTADO_MULTIMETRO,
  EVT_ESTADO,
  FLUJO_ESTADO,
  FLUJO_MULTIMETRO,
  FLUJO_OSCILOSCOPIO,
  ORDEN_INFO,
  ORDEN_LEER,
  ORDEN_ONDA,
  ORDEN_SUSCRIBIR,
  PROTOCOLO,
  leerEstado,
  leerInfo,
  partir,
  peticion,
  peticionLeer,
  peticionOnda,
  respuestaA,
  respuestaLeer,
  respuestaOnda,
  type InfoEnlace,
  type ModoFnirsi,
} from './protocolo.ts';
import { transporteFnirsiDisponible, type TransporteFnirsi } from './transporte.ts';
import { DIR_TABLA_ONDA, MUESTRAS_POR_PETICION, PUNTOS_ONDA, guardadas, muestrasValidas } from './ondas.ts';

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
/** Pause between two rounds of questions about what is not in the stream, and how long an answer is waited for. */
const CONSULTA_MS = 400;
const CONSULTA_CADUCA_MS = 2000;
/** A link with the status stream that sends none of it for this long is asked instead (it sends one block every 100 ms). */
const ESTADO_CALLADO_MS = 2000;

const pausa = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** What a stored waveform leaves to tell: the amplitude the instrument scaled it by and the waveform it goes back to. */
export interface OndaEnviada {
  /** Volts. */
  amplitud: number;
  /** The waveform selected on the instrument when it was sent (its index in the menu; estado.ts names it). */
  forma: number;
  /** The instrument is playing it (and the table was read back). False: it was only kept for `entrada`. */
  sonando: boolean;
  /** Index of the entry of the instrument's menu that plays it until power-off, or 0 when the link has none. */
  entrada: number;
}

const SIN_CONEXION_ONDA = 'Se ha perdido la conexión con el FNIRSI mientras se enviaba la onda: no se sabe cuánta ha llegado. Vuelva a enviarla.';

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
  /**
   * 2.1: the mode the status stream (patch 3) shows, by the blocks it sends: the multimeter's (4), the oscilloscope's
   * measurements (2, 3), or the generator's alone (1, in the generator the identification named). Null until a block
   * arrives, and in a link without the stream.
   */
  modoFlujo = $state<ModoFnirsi | null>(null);
  /** The multimeter's last display and when it arrived (Date.now()). */
  multimetro = $state<LecturaFnirsi | null>(null);
  horaMultimetro = $state(0);
  /** The last trace of each channel and when the last one arrived. */
  trazas = $state<[Traza | null, Traza | null]>([null, null]);
  horaTraza = $state(0);
  /** Reports received and reports the transport had to drop (diagnostics). */
  informes = $state(0);
  perdidos = $state(0);
  /** The generator's settings (in the generator and in the oscilloscope), or null while not known. */
  generador = $state<AjustesGenerador | null>(null);
  /** The oscilloscope's own measurements of CH1, and whether it runs (true), is stopped (false) or is not known. */
  medidas = $state<MedidasOsciloscopio | null>(null);
  /**
   * 2.1: the oscilloscope's own measurements of CH2: block 3 of the status stream, the same 48 bytes as CH1's (seen
   * with the channel on by the owner, 2026-11-25). Only with the stream: a link without it is not asked for them.
   */
  medidasCh2 = $state<MedidasOsciloscopio | null>(null);
  enMarcha = $state<boolean | null>(null);

  private t: TransporteFnirsi | null;
  private vuelta = 0;
  private secuencia = 0;
  private ensamblador = new EnsambladorOsciloscopio();
  /** Read requests waiting for their answer, by sequence number. */
  private consultas = new Map<number, { direccion: number; largo: number; hasta: number }>();
  private proximaConsulta = 0;
  /** The link refused a read: it is not asked again in this session. */
  /** The link's memory is not read in this session (the link refused it, or the installed app's plugin never lets it through). */
  sinLectura = $state(false);
  /** The session is subscribed to the status stream, and when its last block arrived (or the session started). */
  private conEstado = false;
  private horaEstado = 0;
  /** Requests made outside the session's start, waiting for their response among the stream's reports. */
  private esperadas = new Map<number, { orden: number; resolver: (informe: Uint8Array) => void; rechazar: (e: Error) => void; hasta: number }>();
  /** A waveform is being sent (one at a time). */
  enviandoOnda = $state(false);

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
    this.generador = null;
    this.medidas = null;
    this.medidasCh2 = null;
    this.enMarcha = null;
    this.modoFlujo = null;
    this.consultas.clear();
    this.proximaConsulta = 0;
    this.sinLectura = false;
    this.ensamblador.reiniciar();
    for (const e of this.esperadas.values()) e.rechazar(new Error(SIN_CONEXION_ONDA));
    this.esperadas.clear();
  }

  /** Sends a request while the stream flows; its response is picked up by the reading loop. */
  private preguntar(orden: number, hacer: (secuencia: number) => Uint8Array): Promise<{ secuencia: number; informe: Uint8Array }> {
    const secuencia = (this.secuencia = (this.secuencia + 1) & 0xff);
    return new Promise((resolver, rechazar) => {
      this.esperadas.set(secuencia, { orden, resolver: (informe) => resolver({ secuencia, informe }), rechazar, hasta: Date.now() + RESPUESTA_MS });
      this.t!.enviar(hacer(secuencia)).catch((e: unknown) => {
        if (this.esperadas.delete(secuencia)) rechazar(new Error(texto(e, SIN_CONEXION_ONDA)));
      });
    });
  }

  /** The response to a request made with `preguntar`: true when `informe` was one. */
  private atenderEsperada(informe: Uint8Array): boolean {
    const e = this.esperadas.get(informe[1] ?? 0);
    if (!e || informe[0] !== ((e.orden | 0x80) & 0xff)) return false;
    this.esperadas.delete(informe[1] ?? 0);
    e.resolver(informe.slice());
    return true;
  }

  private caducarEsperadas(): void {
    const ahora = Date.now();
    for (const [sec, e] of this.esperadas)
      if (e.hasta < ahora) {
        this.esperadas.delete(sec);
        e.rechazar(new Error('El FNIRSI no ha respondido a tiempo al envío de la onda. Vuelva a enviarla.'));
      }
  }

  /**
   * Stores one period (100 samples from 0 to 4094, lib/fnirsi-real/ondas.ts) in the table the instrument's signal
   * generator plays, and reads the table back to check it. It is the only thing this application writes in the
   * instrument, and it takes a link with patch 4.
   */
  async enviarOnda(muestras: ArrayLike<number>): Promise<OndaEnviada> {
    if (!this.t || this.estado !== 'conectado') throw new Error('El FNIRSI no está conectado.');
    if (!this.info?.ondasAMedida)
      throw new Error(`El enlace de este FNIRSI (parche ${this.info?.parche ?? '?'}) no admite ondas a medida: hace falta el parche 4.`);
    // (2.1: the installed app's USB plugin lets the wave and the read of its table through, and nothing more)
    if (!muestrasValidas(muestras)) throw new Error(`Una onda son ${PUNTOS_ONDA} muestras enteras de 0 a 4094.`);
    if (this.enviandoOnda) throw new Error('Ya se está enviando una onda.');
    const m = Array.from(muestras);
    this.enviandoOnda = true;
    try {
      let dicho: { amplitud: number; forma: number } | null = null;
      for (let primera = 0; primera < PUNTOS_ONDA; primera += MUESTRAS_POR_PETICION) {
        const trozo = m.slice(primera, primera + MUESTRAS_POR_PETICION);
        const { secuencia, informe } = await this.preguntar(ORDEN_ONDA, (sec) => peticionOnda(sec, primera, trozo));
        const r = respuestaOnda(informe, secuencia, primera);
        if (!r || r === 'rechazada') throw new Error('El FNIRSI ha rechazado la onda: su firmware con el enlace no es el que esta versión espera.');
        if (dicho && (dicho.amplitud !== r.amplitud || dicho.forma !== r.forma))
          throw new Error('Se ha cambiado un ajuste del generador en el FNIRSI mientras se enviaba la onda. Vuelva a enviarla.');
        dicho = r;
      }
      // A link from patch 6 on with an entry of its own for what is sent only plays it while that entry is the
      // one selected: otherwise the table still holds the instrument's waveform and there is nothing to read back.
      const entrada = this.info.entradaUsb;
      if (entrada && this.info.parche >= 6 && dicho!.forma !== entrada)
        return { amplitud: dicho!.amplitud / 10, forma: dicho!.forma, sonando: false, entrada };
      // Read back: what is in the table must be what was sent, scaled by the amplitude the link reported.
      const leida: number[] = [];
      for (let desde = 0; desde < 2 * PUNTOS_ONDA; desde += 56) {
        const largo = Math.min(56, 2 * PUNTOS_ONDA - desde);
        const { secuencia, informe } = await this.preguntar(ORDEN_LEER, (sec) => peticionLeer(sec, DIR_TABLA_ONDA + desde, largo));
        const bytes = respuestaLeer(informe, secuencia, DIR_TABLA_ONDA + desde, largo);
        if (!bytes || bytes === 'rechazada') throw new Error('El FNIRSI no ha dejado leer la tabla de su generador para comprobar la onda.');
        leida.push(...bytes);
      }
      const quiere = guardadas(m, dicho!.amplitud);
      const distintas = quiere.filter((x, k) => x !== ((leida[2 * k] ?? 0) | ((leida[2 * k + 1] ?? 0) << 8))).length;
      if (distintas)
        throw new Error(
          `La tabla del generador no coincide con la onda enviada en ${distintas} de ${PUNTOS_ONDA} muestras: puede que se haya tocado un ajuste del generador entretanto. Vuelva a enviarla.`,
        );
      return { amplitud: dicho!.amplitud / 10, forma: dicho!.forma, sonando: true, entrada };
    } finally {
      this.enviandoOnda = false;
    }
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
    // (a link without the status stream refuses a mask with its bit: it is only asked for when announced)
    await this.pedir(v, ORDEN_SUSCRIBIR, FLUJO_MULTIMETRO | FLUJO_OSCILOSCOPIO | (info.estadoEnFlujo ? FLUJO_ESTADO : 0));
    if (v !== this.vuelta) return;
    this.info = info;
    this.modo = info.modo;
    this.modoFlujo = null;
    this.conEstado = info.estadoEnFlujo;
    this.horaEstado = Date.now();
  }

  /** Asks for what is not in the stream, when it is time: the answers arrive among the stream's reports. */
  private async consultar(): Promise<void> {
    const ahora = Date.now();
    if (this.conEstado && ahora - this.horaEstado <= ESTADO_CALLADO_MS) return;
    if (this.sinLectura || ahora < this.proximaConsulta || (this.modo !== 'osciloscopio' && this.modo !== 'generador')) return;
    // 1.4.3: the installed app's USB plugin lets through only the link's identification and subscription
    // (src-tauri/plugins/fnirsi, informe_de: the link stays read-only there). A memory read would fail there, be
    // taken for a lost link and reconnect every 0.4 s; through the plugin these values come only with the status
    // stream (patch 3 of the link).
    if (this.t!.tipo === 'nativo') {
      this.sinLectura = true;
      return;
    }
    this.proximaConsulta = ahora + CONSULTA_MS;
    for (const [sec, c] of this.consultas) if (c.hasta < ahora) this.consultas.delete(sec);
    // (answers still on their way: this round is skipped rather than piling questions up)
    if (this.consultas.size) return;
    const bloques: [number, number][] = [[DIR_GENERADOR, LARGO_GENERADOR]];
    if (this.modo === 'osciloscopio') bloques.push([DIR_ESTADO_OSCILOSCOPIO, LARGO_ESTADO_OSCILOSCOPIO], [DIR_MEDIDAS_CH1, LARGO_MEDIDAS]);
    for (const [direccion, largo] of bloques) {
      const sec = (this.secuencia = (this.secuencia + 1) & 0xff);
      this.consultas.set(sec, { direccion, largo, hasta: ahora + CONSULTA_CADUCA_MS });
      await this.t!.enviar(peticionLeer(sec, direccion, largo));
    }
  }

  /** The answer to a read request: true when `informe` was one. */
  private atenderLectura(informe: Uint8Array): boolean {
    if (informe[0] !== (ORDEN_LEER | 0x80)) return false;
    const sec = informe[1] ?? 0;
    const c = this.consultas.get(sec);
    if (!c) return true;
    this.consultas.delete(sec);
    const bytes = respuestaLeer(informe, sec, c.direccion, c.largo);
    if (bytes === 'rechazada') {
      this.sinLectura = true;
      this.consultas.clear();
    } else if (bytes) {
      if (c.direccion === DIR_GENERADOR) this.generador = decodificarGenerador(bytes);
      else if (c.direccion === DIR_ESTADO_OSCILOSCOPIO) this.enMarcha = osciloscopioEnMarcha(bytes);
      else if (c.direccion === DIR_MEDIDAS_CH1) this.medidas = decodificarMedidas(bytes);
    }
    return true;
  }

  /**
   * A block of the status stream: true when `informe` was one. The multimeter's extra state arrives too and is not
   * used here (the multimeter frames carry their own). 2.1: CH2's measurements are kept (`medidasCh2`).
   */
  private atenderEstado(informe: Uint8Array): boolean {
    if (informe[0] !== EVT_ESTADO) return false;
    const e = leerEstado(informe);
    if (!e) return true;
    this.horaEstado = Date.now();
    if (e.bloque === ESTADO_MULTIMETRO) this.modoFlujo = 'multimetro';
    else if (e.bloque === ESTADO_MEDIDAS_CH1 || e.bloque === ESTADO_MEDIDAS_CH2) this.modoFlujo = 'osciloscopio';
    else if (e.bloque === ESTADO_GENERADOR && this.modo === 'generador') this.modoFlujo = 'generador';
    if (e.bloque === ESTADO_GENERADOR && e.bytes.length === LARGO_GENERADOR) this.generador = decodificarGenerador(e.bytes);
    else if (e.bloque === ESTADO_MEDIDAS_CH1 && e.bytes.length === LARGO_MEDIDAS + 1) {
      this.medidas = decodificarMedidas(e.bytes);
      const marcha = e.bytes[LARGO_MEDIDAS];
      this.enMarcha = marcha === 1 ? true : marcha === 0 ? false : null;
    } else if (e.bloque === ESTADO_MEDIDAS_CH2 && e.bytes.length >= LARGO_MEDIDAS) this.medidasCh2 = decodificarMedidas(e.bytes);
    return true;
  }

  /** One report of the stream. */
  private atender(informe: Uint8Array, nuevas?: [Traza | null, Traza | null]): void {
    if (this.atenderEsperada(informe) || this.atenderLectura(informe) || this.atenderEstado(informe)) return;
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
      this.caducarEsperadas();
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
      } else if (ahora - ultima > SIN_MEDIDAS_MS) {
        const m =
          this.modo === 'generador'
            ? 'El FNIRSI está en el generador de señales: ahí no hay medidas que leer. Páselo a multímetro u osciloscopio.'
            : this.modo === 'osciloscopio'
              ? this.enMarcha === false
                ? 'El osciloscopio del FNIRSI está en STOP: no envía trazas hasta que vuelva a RUN.'
                : 'El FNIRSI no envía trazas: compruebe que el osciloscopio está en RUN.'
              : 'El FNIRSI no envía lecturas: compruebe que está en multímetro u osciloscopio.';
        if (this.mensaje !== m) this.mensaje = m;
      }
      try {
        await this.consultar();
      } catch (e) {
        if (v !== this.vuelta) return;
        if (!(await this.reconectar(v, texto(e, 'Se ha perdido la conexión con el FNIRSI.')))) return;
        ultima = Date.now();
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
