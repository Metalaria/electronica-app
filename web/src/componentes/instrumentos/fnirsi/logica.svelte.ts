// The FNIRSI 2C53T as a state machine: three instruments (oscilloscope, multimeter, DDS generator) chosen with
// MENU, ten buttons and the arrow pad, as described in sections 21.3 and 21.17 of the book. The acquisition
// itself is in ../motor/osciloscopio.ts; the drawing in dibujo.ts.

import {
  adquirir,
  autoHorizontal,
  autoVertical,
  espectro,
  medir,
  S_DIV,
  V_DIV,
  type Captura,
  type CanalOsc,
  type Disparo,
  type Entrada,
  type Espectro,
  type MedidasCanal,
} from '../motor/osciloscopio.ts';
import { DDS_INICIAL, DDS_LIMITES, FORMAS, limitarDds, type Dds } from '../motor/generador.ts';
import {
  FN_FUNCIONES,
  FN_BORNES,
  autoRango,
  mostrar,
  rangosCorrienteFn,
  valorExacto,
  estadistica,
  type Borne,
  type Funcion,
  type Lectura,
  type SenalDmm,
} from '../motor/dmm.ts';
import type { ModeloDmm } from '../motor/montaje.ts';

export type Modo = 'osc' | 'dmm' | 'gen';
export type MenuOsc = null | 'ch1' | 'ch2' | 'disparo' | 'funciones' | 'principal';
export type Matematica = 'no' | 'suma' | 'resta' | 'producto' | 'fft1' | 'fft2';
export type Cursores = 'no' | 'tiempo' | 'tension';

export const MATES: { id: Matematica; nombre: string }[] = [
  { id: 'no', nombre: 'No' },
  { id: 'suma', nombre: 'CH1+CH2' },
  { id: 'resta', nombre: 'CH1−CH2' },
  { id: 'producto', nombre: 'CH1×CH2' },
  { id: 'fft1', nombre: 'FFT CH1' },
  { id: 'fft2', nombre: 'FFT CH2' },
];

export const FN_DMM_LISTA: { id: string; nombre: string }[] = [
  { id: 'auto', nombre: 'Auto' },
  { id: 'vdc', nombre: 'DCV' },
  { id: 'vac', nombre: 'ACV' },
  { id: 'ohm', nombre: 'Ω' },
  { id: 'cont', nombre: 'Continuidad' },
  { id: 'diodo', nombre: 'Diodo' },
  { id: 'cap', nombre: 'Capacidad' },
  { id: 'idc', nombre: 'DCA' },
  { id: 'iac', nombre: 'ACA' },
];

function canalInicial(on: boolean): CanalOsc {
  return { on, vDiv: 1, pos: 0, ac: false, sondaX10: true, menuX10: true, invertir: false };
}

export interface ItemMenu {
  nombre: string;
  valor: string;
  /** Changes the value one step (+1 / −1). */
  cambiar: (d: number) => void;
}

export class Fnirsi {
  encendido = $state(true);
  modo = $state<Modo>('osc');
  menu = $state<MenuOsc>(null);
  item = $state(0);

  // ---------------------------------------------------------------- oscilloscope
  canales = $state<CanalOsc[]>([canalInicial(true), canalInicial(false)]);
  activo = $state(0);
  /** MOVE held: the arrows move the trace instead of changing the scales. */
  mover = $state(false);
  sDiv = $state(1e-3);
  hpos = $state(0);
  disparo = $state<Disparo>({ modo: 'auto', fuente: 0, subida: true, nivel: 0 });
  run = $state(true);
  prm = $state(true);
  mates = $state<Matematica>('no');
  xy = $state(false);
  cursores = $state<Cursores>('no');
  /** Cursor positions in divisions (time: −6 … 6 from the centre; voltage: −4 … 4). */
  cur = $state({ a: -2, b: 2 });
  captura = $state.raw<Captura | null>(null);
  /** Single armed and waiting. */
  esperando = $state(false);

  // ---------------------------------------------------------------- generator
  dds = $state<Dds>({ ...DDS_INICIAL });
  itemGen = $state(0);

  // ---------------------------------------------------------------- multimeter
  fnDmm = $state(0);
  borne = $state<Borne>('V');
  rangoDmm = $state(0);
  fusibleMA = $state(true);
  lecturaDmm = $state<Lectura | null>(null);
  textoDmm = $state('');

  // ---------------------------------------------------------------- derived values
  get escalasV(): number[] {
    return V_DIV.map((v) => v * (this.canales[this.activo]!.menuX10 ? 10 : 1));
  }

  medidas(k: number): MedidasCanal | null {
    const c = this.captura;
    const y = c?.y[k];
    return c && y ? medir(y, c.dt) : null;
  }

  espectro(): Espectro | null {
    const c = this.captura;
    if (!c) return null;
    const k = this.mates === 'fft1' ? 0 : this.mates === 'fft2' ? 1 : -1;
    const y = k >= 0 ? c.y[k] : null;
    return y ? espectro(y, c.dt) : null;
  }

  /** Math trace (sum, difference, product), in displayed volts (V² for the product). */
  trazaMates(): Float64Array | null {
    const c = this.captura;
    const a = c?.y[0];
    const b = c?.y[1];
    if (!c || !a || !b) return null;
    const out = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) {
      out[i] = this.mates === 'suma' ? a[i]! + b[i]! : this.mates === 'resta' ? a[i]! - b[i]! : a[i]! * b[i]!;
    }
    return out;
  }

  /** Cursor readings: Δt and 1/Δt, or the two voltages of the active channel and ΔV. */
  lecturaCursores(): { a: number; b: number; delta: number; inversa: number | null; unidad: string } | null {
    if (this.cursores === 'no') return null;
    if (this.cursores === 'tiempo') {
      const ta = this.cur.a * this.sDiv + this.hpos;
      const tb = this.cur.b * this.sDiv + this.hpos;
      const d = tb - ta;
      return { a: ta, b: tb, delta: d, inversa: d !== 0 ? 1 / Math.abs(d) : null, unidad: 's' };
    }
    const c = this.canales[this.activo]!;
    const va = (this.cur.a - c.pos) * c.vDiv;
    const vb = (this.cur.b - c.pos) * c.vDiv;
    return { a: va, b: vb, delta: vb - va, inversa: null, unidad: 'V' };
  }

  // ---------------------------------------------------------------- acquisition

  adquirir(entradas: Entrada[], inicio: number, fin: number): void {
    if (!this.encendido || this.modo !== 'osc') return;
    if (!this.run && !this.esperando) return;
    const c = adquirir(this.canales, entradas, this.sDiv, this.hpos, this.disparo, inicio, fin);
    if (!c) return;
    this.captura = c;
    if (this.disparo.modo === 'single' && c.disparada) {
      this.run = false;
      this.esperando = false;
    }
  }

  // ---------------------------------------------------------------- buttons

  pulsarMenu(): void {
    if (!this.encendido) return;
    if (this.menu === 'principal') {
      this.menu = null;
      return;
    }
    this.menu = 'principal';
    this.item = ['osc', 'dmm', 'gen'].indexOf(this.modo);
  }

  pulsarCanal(k: 0 | 1): void {
    if (!this.encendido || this.modo !== 'osc') return;
    const id = k === 0 ? 'ch1' : 'ch2';
    if (this.menu === id) {
      this.menu = null;
      return;
    }
    if (!this.canales[k]!.on) this.canales[k]!.on = true;
    this.activo = k;
    this.menu = id;
    this.item = 0;
  }

  pulsarTrigger(): void {
    if (!this.encendido || this.modo !== 'osc') return;
    this.menu = this.menu === 'disparo' ? null : 'disparo';
    this.item = 3;
  }

  pulsarSelect(): void {
    if (!this.encendido) return;
    if (this.modo === 'gen') {
      this.itemGen = (this.itemGen + 1) % this.itemsGen().length;
      return;
    }
    if (this.modo === 'dmm') return;
    if (this.menu === 'principal') {
      this.elegirModo((['osc', 'dmm', 'gen'] as Modo[])[this.item] ?? 'osc');
      return;
    }
    if (this.menu) {
      const items = this.itemsMenu();
      this.item = (this.item + 1) % Math.max(1, items.length);
      return;
    }
    this.menu = 'funciones';
    this.item = 0;
  }

  pulsarPrm(): void {
    if (this.modo === 'osc') this.prm = !this.prm;
  }

  pulsarMove(): void {
    if (this.modo !== 'osc') return;
    this.activo = this.activo === 0 ? 1 : 0;
    if (!this.canales[this.activo]!.on) this.activo = this.activo === 0 ? 1 : 0;
  }

  moveLargo(): void {
    if (this.modo === 'osc') this.mover = !this.mover;
  }

  pulsarRun(): void {
    if (!this.encendido) return;
    if (this.modo !== 'osc') return;
    if (this.disparo.modo === 'single') {
      if (this.run || this.esperando) {
        this.run = false;
        this.esperando = false;
      } else {
        this.esperando = true;
        this.captura = null;
      }
      return;
    }
    this.run = !this.run;
  }

  pulsarAuto(entradas: Entrada[], fBase: number | null): void {
    if (this.modo !== 'osc') return;
    this.menu = null;
    if (fBase && fBase > 0) this.sDiv = autoHorizontal(fBase);
    const fuente = entradas.findIndex((e) => e !== null);
    for (let k = 0; k < 2; k++) {
      const e = entradas[k] ?? null;
      const c = this.canales[k]!;
      if (e === null) continue;
      c.on = true;
      const f = (c.menuX10 ? 10 : 1) / (c.sondaX10 ? 10 : 1) * (c.invertir ? -1 : 1);
      let max: number;
      let min: number;
      if (typeof e === 'number') max = min = e * f;
      else {
        const est = estadistica(e);
        const m1 = est.max * f;
        const m2 = est.min * f;
        max = Math.max(m1, m2);
        min = Math.min(m1, m2);
        if (c.ac) {
          const mid = (max + min) / 2;
          max -= mid;
          min -= mid;
        }
      }
      const v = autoVertical(max, min);
      c.vDiv = Math.max(v.vDiv, V_DIV[0]! * (c.menuX10 ? 10 : 1));
      c.pos = v.pos;
      if (k === Math.max(0, fuente)) this.disparo = { ...this.disparo, modo: 'auto', fuente: k as 0 | 1, nivel: (max + min) / 2 };
    }
    this.hpos = 0;
    this.run = true;
  }

  /** ▲ (+1) / ▼ (−1). */
  vertical(d: number): void {
    if (!this.encendido) return;
    if (this.modo === 'gen') {
      const n = this.itemsGen().length;
      this.itemGen = (this.itemGen - d + n) % n;
      return;
    }
    if (this.modo === 'dmm') {
      this.fnDmm = (this.fnDmm + (d > 0 ? -1 : 1) + FN_DMM_LISTA.length) % FN_DMM_LISTA.length;
      this.rangoDmm = 0;
      return;
    }
    if (this.menu) {
      const n = this.menu === 'principal' ? 3 : this.itemsMenu().length;
      this.item = (this.item - d + n) % n;
      return;
    }
    const c = this.canales[this.activo]!;
    if (this.mover) {
      c.pos = Math.max(-4, Math.min(4, c.pos + d * 0.25));
      return;
    }
    const lista = this.escalasV;
    const i = lista.findIndex((v) => v >= c.vDiv * 0.999);
    const j = Math.max(0, Math.min(lista.length - 1, (i < 0 ? lista.length - 1 : i) - d));
    c.vDiv = lista[j]!;
  }

  /** ◄ (−1) / ► (+1). */
  horizontal(d: number): void {
    if (!this.encendido) return;
    if (this.modo === 'gen') {
      this.itemsGen()[this.itemGen]?.cambiar(d);
      return;
    }
    if (this.modo === 'dmm') return;
    if (this.menu === 'principal') return;
    if (this.menu) {
      this.itemsMenu()[this.item]?.cambiar(d);
      return;
    }
    if (this.mover) {
      this.hpos = this.hpos - d * this.sDiv;
      return;
    }
    const i = S_DIV.findIndex((v) => v >= this.sDiv * 0.999);
    // ► shortens the time per division (expands the signal), ◄ lengthens it.
    const k = Math.max(0, Math.min(S_DIV.length - 1, (i < 0 ? S_DIV.length - 1 : i) - d));
    this.sDiv = S_DIV[k]!;
    this.hpos = 0;
  }

  elegirModo(m: Modo): void {
    this.modo = m;
    this.menu = null;
    this.item = 0;
  }

  // ---------------------------------------------------------------- menus

  itemsMenu(): ItemMenu[] {
    const m = this.menu;
    if (m === 'ch1' || m === 'ch2') {
      const k = m === 'ch1' ? 0 : 1;
      const c = this.canales[k]!;
      return [
        { nombre: 'Canal', valor: c.on ? 'ON' : 'OFF', cambiar: () => (c.on = !c.on) },
        { nombre: 'Acoplamiento', valor: c.ac ? 'AC' : 'DC', cambiar: () => (c.ac = !c.ac) },
        {
          nombre: 'Sonda (menú)',
          valor: c.menuX10 ? '×10' : '×1',
          cambiar: () => {
            c.menuX10 = !c.menuX10;
            c.vDiv = c.vDiv * (c.menuX10 ? 10 : 0.1);
          },
        },
        { nombre: 'Conmutador sonda', valor: c.sondaX10 ? '×10' : '×1', cambiar: () => (c.sondaX10 = !c.sondaX10) },
        { nombre: 'Invertir', valor: c.invertir ? 'Sí' : 'No', cambiar: () => (c.invertir = !c.invertir) },
      ];
    }
    if (m === 'disparo') {
      const d = this.disparo;
      const modos = ['auto', 'normal', 'single'] as const;
      const fuenteC = this.canales[d.fuente]!;
      return [
        {
          nombre: 'Modo',
          valor: { auto: 'Auto', normal: 'Normal', single: 'Single' }[d.modo],
          cambiar: (x) => {
            this.disparo = { ...d, modo: modos[(modos.indexOf(d.modo) + (x > 0 ? 1 : 2)) % 3]! };
            this.run = true;
            this.esperando = this.disparo.modo === 'single';
          },
        },
        { nombre: 'Fuente', valor: d.fuente === 0 ? 'CH1' : 'CH2', cambiar: () => (this.disparo = { ...d, fuente: d.fuente === 0 ? 1 : 0 }) },
        { nombre: 'Flanco', valor: d.subida ? '↑ subida' : '↓ bajada', cambiar: () => (this.disparo = { ...d, subida: !d.subida }) },
        {
          nombre: 'Nivel',
          valor: '',
          cambiar: (x) => (this.disparo = { ...d, nivel: Math.round((d.nivel + (x * fuenteC.vDiv) / 8) / (fuenteC.vDiv / 32)) * (fuenteC.vDiv / 32) }),
        },
      ];
    }
    if (m === 'funciones') {
      const ciclo = <T>(lista: T[], v: T, x: number) => lista[(lista.indexOf(v) + (x > 0 ? 1 : lista.length - 1)) % lista.length]!;
      return [
        {
          nombre: 'Math',
          valor: MATES.find((x) => x.id === this.mates)!.nombre,
          cambiar: (x) => (this.mates = ciclo(MATES.map((q) => q.id), this.mates, x)),
        },
        {
          nombre: 'Cursores',
          valor: { no: 'No', tiempo: 'Tiempo', tension: 'Tensión' }[this.cursores],
          cambiar: (x) => {
            this.cursores = ciclo<Cursores>(['no', 'tiempo', 'tension'], this.cursores, x);
            this.cur = this.cursores === 'tension' ? { a: -1, b: 1 } : { a: -2, b: 2 };
          },
        },
        { nombre: 'Pantalla', valor: this.xy ? 'X-Y' : 'Y-T', cambiar: () => (this.xy = !this.xy) },
      ];
    }
    return [];
  }

  itemsGen(): ItemMenu[] {
    const d = this.dds;
    const poner = (x: Partial<Dds>) => (this.dds = limitarDds({ ...this.dds, ...x }));
    const items: ItemMenu[] = [
      {
        nombre: 'Forma',
        valor: FORMAS.find((f) => f.id === d.forma)!.nombre,
        cambiar: (x) => {
          const i = FORMAS.findIndex((f) => f.id === d.forma);
          poner({ forma: FORMAS[(i + x + FORMAS.length) % FORMAS.length]!.id });
        },
      },
      { nombre: 'Frecuencia', valor: '', cambiar: (x) => poner({ frecuencia: pasoFrecuencia(d.frecuencia, x) }) },
      { nombre: 'Amplitud', valor: '', cambiar: (x) => poner({ amplitud: Math.round((d.amplitud + x * 0.1) * 10) / 10 }) },
    ];
    if (d.forma === 'cuadrada' || d.forma === 'pulso') items.push({ nombre: 'Ciclo', valor: `${d.ciclo} %`, cambiar: (x) => poner({ ciclo: d.ciclo + x * 5 }) });
    if (d.forma === 'sierra') items.push({ nombre: 'Simetría', valor: `${d.simetria} %`, cambiar: (x) => poner({ simetria: d.simetria + x * 5 }) });
    items.push({ nombre: 'Salida', valor: d.salida ? 'ON' : 'OFF', cambiar: () => poner({ salida: !d.salida }) });
    return items;
  }

  // ---------------------------------------------------------------- multimeter

  get funcionDmm(): Funcion | null {
    const id = FN_DMM_LISTA[this.fnDmm]!.id;
    if (id === 'auto') return FN_FUNCIONES.vdc!;
    const base = FN_FUNCIONES[id];
    if (!base) return null;
    if (base.medida === 'idc' || base.medida === 'iac') return { ...base, rangos: rangosCorrienteFn(this.borne, base.medida === 'iac') };
    return base;
  }

  /** What the multimeter is in the circuit (only in multimeter mode; otherwise its inputs are idle). */
  modeloDmm(): ModeloDmm {
    if (!this.encendido) return { tipo: 'abierto' };
    if (this.borne === 'mA') return this.fusibleMA ? { tipo: 'amperimetro', r: FN_BORNES.mA.r } : { tipo: 'abierto' };
    if (this.borne === 'A') return { tipo: 'amperimetro', r: FN_BORNES.A.r };
    if (this.modo !== 'dmm') return { tipo: 'abierto' };
    const fn = this.funcionDmm;
    if (!fn?.modelo) return { tipo: 'abierto' };
    return fn.modelo(Math.min(this.rangoDmm, fn.rangos.length - 1));
  }

  revisarFusible(irms: number): boolean {
    if (this.borne === 'mA' && this.fusibleMA && irms > FN_BORNES.mA.fusible) {
      this.fusibleMA = false;
      return true;
    }
    return false;
  }

  leerDmm(s: SenalDmm | null): void {
    if (this.modo !== 'dmm' || !this.encendido) return;
    const id = FN_DMM_LISTA[this.fnDmm]!.id;
    const senal = s ?? { v: 0, i: 0 };
    const opc = { rangoPrimario: this.rangoDmm, dbmRef: 600, modoTemp: 0 };
    const esI = id === 'idc' || id === 'iac';
    if (esI !== (this.borne !== 'V')) {
      this.lecturaDmm = null;
      this.textoDmm = esI ? 'Punta roja en mA o 10A' : 'Punta roja en VΩ';
      return;
    }
    let fn = this.funcionDmm!;
    let { x, f } = valorExacto(fn, senal, opc);
    this.textoDmm = FN_DMM_LISTA[this.fnDmm]!.nombre;
    if (id === 'auto') {
      // Auto-detection of DC or AC voltage (it does not work below about 0.7 V, section 21.15.1).
      const ac = valorExacto(FN_FUNCIONES.vac!, senal, opc);
      if (Math.abs(x ?? 0) < 0.7 && (ac.x ?? 0) < 0.7) {
        this.lecturaDmm = null;
        this.textoDmm = 'Auto: < 0,7 V, elija la función';
        return;
      }
      if ((ac.x ?? 0) > Math.abs(x ?? 0)) {
        fn = FN_FUNCIONES.vac!;
        x = ac.x;
        f = ac.f;
        this.textoDmm = 'Auto · ACV';
      } else this.textoDmm = 'Auto · DCV';
    }
    if (fn.medida === 'cap' && x !== null && x < 0) x = 0;
    this.rangoDmm = autoRango(fn.rangos, x, this.rangoDmm);
    const r = Math.min(this.rangoDmm, fn.rangos.length - 1);
    this.lecturaDmm = mostrar(`2c53t:${fn.medida}:${r}`, fn.rangos[r]!, x, f, { sinSigno: fn.medida === 'cap' });
  }
}

/** Frequency steps of the arrows: 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 per decade. */
const MANT = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
export function pasoFrecuencia(f: number, d: number): number {
  const lista: number[] = [];
  for (let e = 0; e <= 4; e++) for (const m of MANT) lista.push(Math.round(m * 10 ** e));
  lista.push(DDS_LIMITES.fMax);
  let i = lista.findIndex((v) => v >= f - 1e-9);
  if (i < 0) i = lista.length - 1;
  if (d > 0) i = lista[i]! > f + 1e-9 ? i : i + 1;
  else i = i - 1;
  return lista[Math.max(0, Math.min(lista.length - 1, i))]!;
}
