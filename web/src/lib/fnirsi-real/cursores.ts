// The real FNIRSI 2C53T's oscilloscope: cursors on the trace the panel draws, read here in the application. Two in
// time and two in voltage, placed by the reader; what they give is the distance between each pair and what each
// trace is worth where the time cursors stand. The instrument has its own cursors on its own screen; these do
// not use them nor move them.
import { CUENTAS_POR_DIVISION, voltios, type Traza } from './osciloscopio';

export interface Cursores {
  activo: boolean;
  /** Time cursors, in samples of the window that is drawn (0 its left edge). */
  t1: number;
  t2: number;
  /** Voltage cursors, as sample values (128 is the middle of the screen). */
  v1: number;
  v2: number;
}

/** A trace as the panel draws it: its window of samples. */
export type Ventana = Pick<Traza, 'canal' | 'ajustes'> & { muestras: ArrayLike<number> };

export interface LecturaCursores {
  /** Seconds from cursor 1 to cursor 2 (negative when 2 is to the left of 1), and its inverse; null when they coincide. */
  dt: number;
  frecuencia: number | null;
  canales: {
    canal: 0 | 1;
    /** Volts from voltage cursor 1 to 2, in this channel's scale. */
    dv: number;
    /** Volts of the trace where each time cursor stands. */
    enT1: number;
    enT2: number;
  }[];
}

export function leerCursores(c: Cursores, ventanas: Ventana[]): LecturaCursores {
  const paso = ventanas[0]?.ajustes.periodoMuestra ?? 0;
  const dt = (c.t2 - c.t1) * paso;
  const en = (w: Ventana, t: number) => {
    const k = Math.min(w.muestras.length - 1, Math.max(0, Math.round(t)));
    return voltios(w as Traza, w.muestras[k] ?? 0);
  };
  return {
    dt,
    frecuencia: dt !== 0 ? 1 / Math.abs(dt) : null,
    canales: ventanas.map((w) => ({
      canal: w.canal,
      dv: ((c.v2 - c.v1) / CUENTAS_POR_DIVISION) * w.ajustes.canales[w.canal].voltiosDiv,
      enT1: en(w, c.t1),
      enT2: en(w, c.t2),
    })),
  };
}
