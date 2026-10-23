// The Brymen BM869s as a state machine: selector, the six buttons (SELECT, RANGE, Δ/REL with the 500 000
// count mode on a long press, HOLD, CREST, REC), the red lead's jack, the fuses, and what the LCD shows for
// a signal. The book's description (section 53.7) and the manual's specifications (dmm.ts) are the reference.

import {
  BM_FUNCIONES,
  BM_POSICIONES,
  BM_BORNES,
  autoRango,
  mostrar,
  rangosCorriente,
  valorExacto,
  type Borne,
  type Funcion,
  type Lectura,
  type Rango,
  type SenalDmm,
} from '../motor/dmm.ts';
import type { ModeloDmm } from '../motor/montaje.ts';

export const DBM_REFERENCIAS = [4, 8, 16, 20, 32, 50, 75, 93, 110, 125, 135, 150, 200, 250, 300, 500, 600, 800, 900, 1000, 1200];
export const MODOS_TEMP = ['T1', 'T2', 'T1 T2', 'T1−T2'];

export interface PantallaBm {
  principal: Lectura | null;
  secundaria: Lectura | null;
  /** Bargraph (−1 … 1), null when hidden. */
  barra: number | null;
  /** Annunciators lit on the LCD. */
  marcas: string[];
  /** Text instead of digits (InErr, OFF…). */
  mensaje: string | null;
  /** Continuity beeper on. */
  pitido: boolean;
}

/** Function of the rotary position + SELECT, with its ranges (current ranges depend on the jack). */
export function funcionDe(posId: string, id: string | null, borne: Borne): Funcion | null {
  if (!id) return null;
  const base = BM_FUNCIONES[id];
  if (!base) return null;
  if (base.medida === 'idc' || base.medida === 'iac' || base.medida === 'iacdc') {
    const pos = posId === 'ua' ? 'ua' : 'amA';
    return { ...base, rangos: rangosCorriente(pos, borne, base.medida !== 'idc') };
  }
  return base;
}

export class Brymen {
  pos = $state(3);
  sub = $state(0);
  borne = $state<Borne>('V');
  manual = $state(false);
  /** Range index of the primary function (auto-ranging moves it). */
  rango = $state(0);
  rangoSec = $state(0);
  hold = $state(false);
  rel = $state<number | null>(null);
  alta = $state(false);
  rec = $state<{ max: number; min: number; suma: number; n: number; vista: number } | null>(null);
  crest = $state<{ max: number; min: number; vista: number } | null>(null);
  dbmRef = $state(16);
  modoTemp = $state(0);
  luz = $state(false);
  fusibleMA = $state(true);
  fusibleA = $state(true);
  /** Set when the selector is turned with the red lead in a current jack (BeepJack). */
  beepJack = $state(0);
  pantalla = $state<PantallaBm>({ principal: null, secundaria: null, barra: null, marcas: [], mensaje: null, pitido: false });

  get posicion() {
    return BM_POSICIONES[this.pos]!;
  }
  get ids(): [string, string | null] | null {
    return this.posicion.subs[this.sub] ?? null;
  }
  get primaria(): Funcion | null {
    const ids = this.ids;
    return ids ? funcionDe(this.posicion.id, ids[0], this.borne) : null;
  }
  get secundariaFn(): Funcion | null {
    const ids = this.ids;
    return ids ? funcionDe(this.posicion.id, ids[1], this.borne) : null;
  }
  get esCorriente(): boolean {
    return !!this.posicion.corriente;
  }
  /** Red lead in a current jack while the selector is not on a current function. */
  get errorBorne(): boolean {
    return this.borne !== 'V' && !this.esCorriente && this.posicion.id !== 'off';
  }

  // ---------------------------------------------------------------- controls

  girar(i: number): void {
    const n = BM_POSICIONES.length;
    const nuevo = Math.max(0, Math.min(n - 1, i));
    if (nuevo === this.pos) return;
    this.pos = nuevo;
    this.sub = 0;
    this.reiniciarModos();
    this.manual = false;
    this.rango = 0;
    this.rangoSec = 0;
    if (this.errorBorne) this.beepJack++;
  }

  private reiniciarModos(): void {
    this.hold = false;
    this.rel = null;
    this.alta = false;
    this.rec = null;
    this.crest = null;
  }

  select(): void {
    const subs = this.posicion.subs.filter((s) => this.borne === 'A' || this.posicion.id !== 'amA' || s[0] !== 'lazo' || true);
    if (!subs.length) return;
    let k = (this.sub + 1) % this.posicion.subs.length;
    // The 4–20 mA loop display only exists on the mA jack.
    if (this.posicion.subs[k]?.[0] === 'lazo' && this.borne !== 'mA') k = (k + 1) % this.posicion.subs.length;
    this.sub = k;
    this.reiniciarModos();
    this.manual = false;
  }

  selectLargo(): void {
    this.luz = !this.luz;
  }

  range(): void {
    const fn = this.primaria;
    if (!fn) return;
    if (fn.medida === 'dbm') {
      this.dbmRef = (this.dbmRef + 1) % DBM_REFERENCIAS.length;
      return;
    }
    if (fn.medida === 'temp') {
      this.modoTemp = (this.modoTemp + 1) % MODOS_TEMP.length;
      return;
    }
    if (fn.rangos.length < 2) return;
    if (!this.manual) this.manual = true;
    else this.rango = (this.rango + 1) % fn.rangos.length;
    this.rel = null;
  }

  rangeLargo(): void {
    this.manual = false;
  }

  delta(): void {
    if (this.rel !== null) this.rel = null;
    else this.rel = this.pantalla.principal?.valor ?? null;
  }

  /** Long press of Δ: 500 000 counts, only for direct DC voltage without the dual display. */
  deltaLargo(): void {
    const ids = this.ids;
    if (ids && (ids[0] === 'vdc' || ids[0] === 'mvdc') && !ids[1]) this.alta = !this.alta;
  }

  pulsarHold(): void {
    this.hold = !this.hold;
  }

  pulsarRec(): void {
    if (!this.rec) this.rec = { max: -Infinity, min: Infinity, suma: 0, n: 0, vista: 1 };
    else this.rec.vista = (this.rec.vista + 1) % 4;
  }

  recLargo(): void {
    this.rec = null;
  }

  pulsarCrest(): void {
    if (!this.crest) this.crest = { max: -Infinity, min: Infinity, vista: 0 };
    else this.crest.vista = (this.crest.vista + 1) % 2;
  }

  crestLargo(): void {
    this.crest = null;
  }

  ponerBorne(b: Borne): void {
    if (b === this.borne) return;
    this.borne = b;
    if (this.posicion.subs[this.sub]?.[0] === 'lazo' && b !== 'mA') this.sub = 0;
    this.rango = 0;
    this.manual = false;
  }

  cambiarFusibles(): void {
    this.fusibleMA = true;
    this.fusibleA = true;
  }

  // ---------------------------------------------------------------- what it is in the circuit

  /** Electrical model between the leads: decided by the jack first (a shunt is a shunt), then the function. */
  modelo(): ModeloDmm {
    if (this.borne === 'mA') return this.fusibleMA ? { tipo: 'amperimetro', r: BM_BORNES.mA.r(this.posicion.id) } : { tipo: 'abierto' };
    if (this.borne === 'A') return this.fusibleA ? { tipo: 'amperimetro', r: BM_BORNES.A.r('') } : { tipo: 'abierto' };
    const fn = this.primaria;
    if (!fn || this.posicion.id === 'off' || this.esCorriente) return { tipo: 'abierto' };
    if (!fn.modelo) return { tipo: 'voltimetro', r: 10e6, c: 60e-12, mv: this.posicion.id.startsWith('mv') };
    const r = Math.min(this.rango, Math.max(0, fn.rangos.length - 1));
    return fn.modelo(r);
  }

  /** Whether the current through the shunt blows its fuse (RMS over the reading). */
  revisarFusible(irms: number): boolean {
    if (this.borne === 'mA' && this.fusibleMA && irms > BM_BORNES.mA.fusible) {
      this.fusibleMA = false;
      return true;
    }
    if (this.borne === 'A' && this.fusibleA && irms > BM_BORNES.A.fusible * 1.5) {
      this.fusibleA = false;
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- one reading (5 per second)

  leer(s: SenalDmm | null): void {
    if (this.hold) return;
    const p = this.posicion;
    const marcas: string[] = [];
    if (p.id === 'off') {
      this.pantalla = { principal: null, secundaria: null, barra: null, marcas: [], mensaje: null, pitido: false };
      return;
    }
    if (this.errorBorne) {
      this.pantalla = { principal: null, secundaria: null, barra: null, marcas: ['!'], mensaje: 'InErr', pitido: true };
      return;
    }
    const fn = this.primaria;
    if (!fn) return;
    const senal: SenalDmm = s ?? { v: 0, i: 0, c: null };
    const opciones = { rangoPrimario: this.rango, dbmRef: DBM_REFERENCIAS[this.dbmRef]!, modoTemp: this.modoTemp };
    const clave = `bm869s:${this.ids?.[0]}:`;
    // Current functions without the lead on a current jack read nothing (the shunt is not in the circuit).
    const sinCorriente = this.esCorriente && this.borne === 'V';
    let { x, f } = sinCorriente ? { x: 0, f: null } : valorExacto(fn, senal, opciones);
    if (fn.medida === 'cap' && x !== null && x < 0) x = 0;
    if (!this.manual && fn.rangos.length > 1) {
      this.rango = autoRango(fn.rangos, x, this.rango);
    }
    const r = Math.min(this.rango, fn.rangos.length - 1);
    const rango: Rango = fn.rangos[r]!;
    let lectura = mostrar(clave + r, rango, x, f, { alta: this.alta, sinSigno: fn.medida === 'cap' });

    // Relative (Δ): the reading minus the stored value.
    if (this.rel !== null && lectura.valor !== null) {
      lectura = mostrar(clave + r + 'rel', rango, lectura.valor - this.rel, f, { alta: this.alta, ruido: false });
      marcas.push('Δ');
    }
    // REC: maximum, minimum, average of the readings.
    if (this.rec && lectura.valor !== null) {
      const v = lectura.valor;
      this.rec.max = Math.max(this.rec.max, v);
      this.rec.min = Math.min(this.rec.min, v);
      this.rec.suma += v;
      this.rec.n++;
      const vista = this.rec.vista;
      const val = [v, this.rec.max, this.rec.min, this.rec.suma / this.rec.n][vista]!;
      marcas.push(['REC', 'MAX', 'MIN', 'AVG'][vista]!);
      if (vista) lectura = mostrar(clave + r, rango, val, f, { ruido: false });
    }
    // CREST: instantaneous peaks (1 ms), 5 000-count resolution.
    if (this.crest && s) {
      const serie = this.esCorriente ? s.i : s.v;
      const pk = typeof serie === 'number' ? { max: serie, min: serie } : picos(serie);
      this.crest.max = Math.max(this.crest.max, pk.max);
      this.crest.min = Math.min(this.crest.min, pk.min);
      const val = this.crest.vista ? this.crest.min : this.crest.max;
      marcas.push('CREST', this.crest.vista ? 'MIN' : 'MAX');
      lectura = mostrar(clave + r + 'crest', { ...rango, res: rango.res * 10 }, val, null, { ruido: false });
    }

    // Secondary display.
    let secundaria: Lectura | null = null;
    const fn2 = this.secundariaFn;
    if (fn2) {
      const op2 = { ...opciones, rangoPrimario: fn.medida === 'hz' ? this.rangoSec : this.rango };
      const { x: x2, f: f2 } = sinCorriente ? { x: 0, f: null } : valorExacto(fn2, senal, op2);
      if (fn2.rangos.length > 1) this.rangoSec = autoRango(fn2.rangos, x2, this.rangoSec);
      const r2 = Math.min(this.rangoSec, fn2.rangos.length - 1);
      secundaria = mostrar(`bm869s:sec:${this.ids?.[1]}:${r2}`, fn2.rangos[r2]!, x2, f2);
    }

    // Annunciators.
    if (!this.manual && fn.rangos.length > 1) marcas.push('AUTO');
    if (this.manual) marcas.push('MANU');
    if (this.alta) marcas.push('500000');
    const m = fn.medida;
    if (m === 'vdc' || m === 'idc' || m === 'diodo') marcas.push('DC');
    if (m === 'vac' || m === 'iac' || m === 'vfd' || m === 'dbm') marcas.push('AC');
    if (m === 'vacdc' || m === 'iacdc') marcas.push('AC+DC');
    if (m === 'vfd') marcas.push('VFD');
    if (m === 'cont') marcas.push('·)))');
    if (m === 'diodo') marcas.push('⏵');
    if (m === 'temp') marcas.push(MODOS_TEMP[this.modoTemp]!);
    if (m === 'dbm') marcas.push(`${DBM_REFERENCIAS[this.dbmRef]} Ω`);
    if (this.luz) marcas.push('luz');

    // The bargraph hides when the secondary display shows a voltage or a current (book, section 53.7).
    const ocultaBarra = !!secundaria && /V|A$/.test(secundaria.unidad) && !/Hz/.test(secundaria.unidad);
    const pitido = m === 'cont' && lectura.valor !== null && lectura.valor < 94;
    this.pantalla = {
      principal: lectura,
      secundaria,
      barra: ocultaBarra || m === 'hz' || m === 'hzlog' || m === 'ciclo' || m === 'dbm' ? null : lectura.barra,
      marcas,
      mensaje: null,
      pitido,
    };
  }
}

function picos(s: { y: Float64Array }): { max: number; min: number } {
  let max = -Infinity;
  let min = Infinity;
  for (const v of s.y) {
    if (v > max) max = v;
    if (v < min) min = v;
  }
  return { max, min };
}
