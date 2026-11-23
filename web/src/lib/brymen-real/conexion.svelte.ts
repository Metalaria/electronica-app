// 1.3: the connection to the real Brymen BM869s, one for the whole app (the bench, the practices and the lessons'
// «En el banco» cards all show the same meter). While connected it asks the meter for a packet about three times a
// second (the meter answers each request with one packet; sigrok polls the same way) and keeps the last reading.
// Nothing is stored: a reading is only good while it is fresh, and the page says so when it stops being.

import { buscarPaquete, decodificar, hex, type LecturaReal } from './protocolo.ts';
import { transporteDisponible, type Transporte } from './transporte.ts';
import { migaAccion } from '../informe-fallos';

export type EstadoConexion = 'desconectado' | 'conectando' | 'conectado' | 'sin-respuesta' | 'error';

/** Wait per report (ms) and pause between requests. */
const ESPERA = 400;
const PAUSA = 250;
/** No packet for this long: the meter is not answering. */
const SIN_RESPUESTA_MS = 2500;
/** A reading older than this is not shown as the current one. */
export const CADUCIDAD_MS = 3000;

class ConexionBrymen {
  /** The platform can read the cable (false: everything about it is hidden). */
  readonly disponible: boolean;
  estado = $state<EstadoConexion>('desconectado');
  /** What to tell the reader about the state (Spanish, «usted»). */
  mensaje = $state('');
  nombre = $state('');
  lectura = $state<LecturaReal | null>(null);
  /** When the last packet arrived (Date.now()). */
  hora = $state(0);
  /** The last packet, in hex (diagnostics). */
  crudo = $state('');
  paquetes = $state(0);

  private t: Transporte | null;
  private vuelta = 0;
  private resto: Uint8Array = new Uint8Array(0);

  constructor() {
    this.t = transporteDisponible();
    this.disponible = !!this.t;
  }

  get tipo(): Transporte['tipo'] | null {
    return this.t?.tipo ?? null;
  }

  /** The reading, if it is fresh (the meter answered within CADUCIDAD_MS). */
  vigente(ahora = Date.now()): LecturaReal | null {
    return this.estado === 'conectado' && this.lectura && ahora - this.hora <= CADUCIDAD_MS ? this.lectura : null;
  }

  async conectar(): Promise<void> {
    if (!this.t || this.estado === 'conectando' || this.estado === 'conectado' || this.estado === 'sin-respuesta') return;
    this.estado = 'conectando';
    this.mensaje = 'Buscando el cable BU-86X…';
    migaAccion('brymen real: conectar');
    this.lectura = null;
    this.resto = new Uint8Array(0);
    // 1.3.1: «Desconectar» while the cable is still opening (the system's permission dialog open) bumps `vuelta`: the
    // opening that finishes afterwards must not start the polling
    const v = ++this.vuelta;
    const t = this.t;
    let nombre: string;
    try {
      nombre = await t.abrir();
    } catch (e) {
      if (v !== this.vuelta) return;
      this.estado = 'error';
      this.mensaje = texto(e, 'No se pudo abrir el cable BU-86X.');
      return;
    }
    if (v !== this.vuelta) {
      // (closed again, unless a newer «Conectar» is opening it meanwhile)
      // (read again after the await: TypeScript keeps the narrowing of before it)
      if ((this.estado as EstadoConexion) === 'desconectado')
        try {
          await t.cerrar();
        } catch {
          // (already gone)
        }
      return;
    }
    this.nombre = nombre;
    this.estado = 'sin-respuesta';
    this.mensaje = 'Cable conectado. Esperando la primera lectura del Brymen…';
    this.hora = Date.now();
    void this.bucle(v);
  }

  async desconectar(): Promise<void> {
    migaAccion('brymen real: desconectar');
    this.vuelta++;
    const t = this.t;
    this.estado = 'desconectado';
    this.mensaje = '';
    this.lectura = null;
    try {
      await t?.cerrar();
    } catch {
      // (closing a cable already gone)
    }
  }

  private async bucle(v: number): Promise<void> {
    const t = this.t!;
    let inicio = Date.now();
    while (v === this.vuelta) {
      let bytes: Uint8Array;
      try {
        bytes = await t.leer(ESPERA);
      } catch (e) {
        if (v !== this.vuelta) return;
        this.vuelta++;
        migaAccion('brymen real: se perdió el cable');
        this.estado = 'error';
        this.lectura = null;
        this.mensaje = `${texto(e, 'Se ha perdido la conexión con el cable del Brymen.')} La última lectura ya no vale: conecte de nuevo cuando el cable esté enchufado.`;
        try {
          await t.cerrar();
        } catch {
          // (already gone)
        }
        return;
      }
      if (v !== this.vuelta) return;
      const junto = new Uint8Array(this.resto.length + bytes.length);
      junto.set(this.resto);
      junto.set(bytes, this.resto.length);
      const { paquete, resto } = buscarPaquete(junto);
      this.resto = resto;
      if (paquete) {
        try {
          this.lectura = decodificar(paquete);
          this.crudo = hex(paquete);
          this.hora = Date.now();
          this.paquetes++;
          inicio = this.hora;
          this.estado = 'conectado';
          this.mensaje = '';
        } catch {
          // (a packet that passed the check but does not decode: wait for the next)
        }
      } else if (Date.now() - inicio > SIN_RESPUESTA_MS) {
        this.estado = 'sin-respuesta';
        this.lectura = null;
        this.mensaje =
          'El cable responde, pero el Brymen no envía lecturas: compruebe que está encendido (no en OFF) y que el cable está bien encajado en su parte trasera. Si la luz del sol o una lámpara dan de lleno en el conector, tápelo.';
      }
      await new Promise((r) => setTimeout(r, PAUSA));
    }
  }
}

function texto(e: unknown, defecto: string): string {
  const m = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  return m.trim() || defecto;
}

export const brymenReal = new ConexionBrymen();
