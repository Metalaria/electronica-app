// The recorder's bookkeeping, without the page: each step it asks the two connections for their current reading
// (through `Fuentes`, so the tests can stand in for them), takes each new reading once, keeps the last few of each
// instrument to know when it has settled, adds them to the record while recording, and holds what the comparison
// needs: the settled reading of each instrument (live, or held by the reader) and the table of comparisons written
// down. registrador.svelte.ts wraps it for the page.

import type { LecturaReal } from '../brymen-real/protocolo.ts';
import type { LecturaFnirsi } from '../fnirsi-real/multimetro.ts';
import { comparar, filaDe, medidaBrymen, medidaFnirsi, noComparables, type Comparacion, type FilaComparacion, type Medida } from './comparar.ts';
import { LECTURAS_ESTABLES, Serie, estable, muestraDe, type InstrumentoReal, type Muestra } from './registro.ts';

/** Each connection's current reading (fresh: the connection's own «vigente») and when it arrived; null: none. */
export interface Fuentes {
  brymen(ahora: number): { lectura: LecturaReal; hora: number } | null;
  fnirsi(ahora: number): { lectura: LecturaFnirsi; hora: number } | null;
}

/** Most rows of the comparison table. */
export const MAXIMO_FILAS = 200;

/** The Brymen's modes in which its display is not the measurement of this moment. */
function modosBrymen(l: LecturaReal): string[] {
  const v: string[] = [];
  if (l.hold) v.push('HOLD');
  if (l.rel) v.push('REL');
  if (l.max) v.push('MAX');
  if (l.min) v.push('MIN');
  if (l.media) v.push('AVG');
  return v;
}

export class NucleoRegistro {
  readonly series: Record<InstrumentoReal, Serie> = { brymen: new Serie(), fnirsi: new Serie() };
  grabando = false;
  /** When the record under way (or the last one) started. */
  inicio = 0;
  /** The record stopped by itself: a series reached its limit. */
  lleno = false;
  readonly retenidas: Record<InstrumentoReal, Medida | null> = { brymen: null, fnirsi: null };
  readonly filas: FilaComparacion[] = [];

  private recientes: Record<InstrumentoReal, Muestra[]> = { brymen: [], fnirsi: [] };
  private vista: Record<InstrumentoReal, number> = { brymen: 0, fnirsi: 0 };
  /** When recording was last started or taken up again: a reading that arrived before is not of this record. */
  private desde = 0;
  private brymen: LecturaReal | null = null;
  private fnirsi: LecturaFnirsi | null = null;

  /** Takes what is new from the connections; true when anything changed (the page then looks again). */
  paso(f: Fuentes, ahora: number): boolean {
    let cambio = false;
    const b = f.brymen(ahora);
    if (!b) cambio = this.sinLectura('brymen') || cambio;
    else if (b.hora !== this.vista.brymen) {
      this.brymen = b.lectura;
      const modos = modosBrymen(b.lectura);
      const m = muestraDe(b.lectura.principal, b.hora);
      if (modos.length) m.texto = `${m.texto} (${modos.join(', ')})`;
      this.tomar('brymen', m, b.hora);
      cambio = true;
    }
    const n = f.fnirsi(ahora);
    if (!n) cambio = this.sinLectura('fnirsi') || cambio;
    else if (n.hora !== this.vista.fnirsi) {
      this.fnirsi = n.lectura;
      const m = muestraDe(n.lectura.pantalla, n.hora, n.lectura.fiable, n.lectura.esperando ? 'Auto' : undefined);
      if (n.lectura.hold && n.lectura.fiable) m.texto = `${m.texto} (HOLD)`;
      this.tomar('fnirsi', m, n.hora);
      cambio = true;
    }
    return cambio;
  }

  private sinLectura(i: InstrumentoReal): boolean {
    const habia = this.recientes[i].length > 0;
    this.recientes[i] = [];
    this.vista[i] = 0;
    if (i === 'brymen') this.brymen = null;
    else this.fnirsi = null;
    return habia;
  }

  private tomar(i: InstrumentoReal, m: Muestra, hora: number): void {
    this.vista[i] = hora;
    const r = this.recientes[i];
    r.push(m);
    if (r.length > LECTURAS_ESTABLES) r.shift();
    if (this.grabando && hora >= this.desde && !this.series[i].anadir(m)) {
      this.grabando = false;
      this.lleno = true;
    }
  }

  /** The instrument is handing over readings right now. */
  conLectura(i: InstrumentoReal): boolean {
    return this.recientes[i].length > 0;
  }

  /** The last reading taken from the instrument, as its display shows it; '' when it is giving none. */
  ultima(i: InstrumentoReal): string {
    const r = this.recientes[i];
    return r.length ? r[r.length - 1]!.texto : '';
  }

  /** The unit of the instrument's last reading ('' none). */
  unidadActual(i: InstrumentoReal): string {
    const r = this.recientes[i];
    return r.length ? r[r.length - 1]!.unidad : '';
  }

  /** The instrument's settled live reading; null while it is moving, has no number, or gives none. */
  enVivo(i: InstrumentoReal): Medida | null {
    const m = estable(this.recientes[i]);
    if (!m) return null;
    if (i === 'brymen') return this.brymen && !modosBrymen(this.brymen).length ? medidaBrymen(this.brymen, m) : null;
    return this.fnirsi && !this.fnirsi.hold ? medidaFnirsi(this.fnirsi, m) : null;
  }

  /** Why the instrument has no settled reading to compare (a sentence), or ''. */
  motivo(i: InstrumentoReal): string {
    if (this.retenidas[i] || this.enVivo(i)) return '';
    if (!this.conLectura(i)) return 'Sin lectura: conéctelo y póngalo a medir.';
    if (i === 'brymen' && this.brymen) {
      const modos = modosBrymen(this.brymen);
      if (modos.length) return `El Brymen está en ${modos.join(', ')}: su pantalla no es la medida de este momento. Quite ese modo para comparar.`;
    }
    if (i === 'fnirsi' && this.fnirsi?.hold && this.fnirsi.fiable) return 'El FNIRSI está en HOLD: su pantalla no es la medida de este momento. Quite el HOLD para comparar.';
    if (i === 'fnirsi' && this.fnirsi && !this.fnirsi.fiable) return this.fnirsi.motivo || 'El FNIRSI no muestra un número que se pueda usar.';
    const r = this.recientes[i];
    if (r.length && r[r.length - 1]!.valor === null) return 'La pantalla no muestra un número (fuera de escala o sin medida).';
    return 'La lectura todavía se mueve: espere a que se quede quieta.';
  }

  /** What the comparison uses of the instrument: the held reading, or else the live settled one. */
  medida(i: InstrumentoReal): Medida | null {
    return this.retenidas[i] ?? this.enVivo(i);
  }

  /** Holds the instrument's settled reading (to measure the same part with the other one afterwards). */
  retener(i: InstrumentoReal): boolean {
    const m = this.enVivo(i);
    if (!m) return false;
    this.retenidas[i] = { ...m, retenida: true };
    return true;
  }

  soltar(i: InstrumentoReal): void {
    this.retenidas[i] = null;
  }

  /** The FNIRSI against the Brymen with what each has now; null when either is missing; a sentence when they differ in kind. */
  comparacion(): Comparacion | string | null {
    const fn = this.medida('fnirsi');
    const br = this.medida('brymen');
    if (!fn || !br) return null;
    return noComparables(fn, br) || comparar(fn, br);
  }

  /** Writes the current comparison down in the table; null when there is none to write (or the table is full). */
  anotar(ahora: number): FilaComparacion | null {
    const fn = this.medida('fnirsi');
    const br = this.medida('brymen');
    if (!fn || !br || noComparables(fn, br) || this.filas.length >= MAXIMO_FILAS) return null;
    const fila = filaDe(fn, br, comparar(fn, br), ahora);
    this.filas.push(fila);
    // held readings were for this comparison: the next one starts from the live ones
    this.retenidas.brymen = null;
    this.retenidas.fnirsi = null;
    return fila;
  }

  vaciarTabla(): void {
    this.filas.length = 0;
  }

  /**
   * Starts recording, or goes on with the record there is (erasing it is `borrar`, asked for apart). False when a
   * series is already full.
   */
  iniciar(ahora: number): boolean {
    if (this.series.brymen.llena || this.series.fnirsi.llena) {
      this.lleno = true;
      return false;
    }
    if (!this.muestras) this.inicio = ahora;
    else {
      this.series.brymen.cortar();
      this.series.fnirsi.cortar();
    }
    this.desde = ahora;
    this.lleno = false;
    this.grabando = true;
    return true;
  }

  detener(): void {
    this.grabando = false;
  }

  /** The figures and the drawings of both instruments start again from now; the record keeps everything. */
  reiniciarCifras(): void {
    this.series.brymen.reiniciar();
    this.series.fnirsi.reiniciar();
  }

  borrar(): void {
    this.grabando = false;
    this.lleno = false;
    this.series.brymen.borrar();
    this.series.fnirsi.borrar();
  }

  get muestras(): number {
    return this.series.brymen.muestras.length + this.series.fnirsi.muestras.length;
  }
}
