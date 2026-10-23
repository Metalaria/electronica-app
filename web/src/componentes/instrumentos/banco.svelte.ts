// The test bench: a circuit, the instruments and where their leads are. Any change that alters the circuit
// (a component value, a lead, a function of a meter, the generator, the probe, the coupling, the time base)
// writes a new bench netlist and runs it in the simulator's Web Worker (debounced); the instruments then read
// the result with their own limitations, several times per second while the page is visible.

import { leerCircuito, esMasa, type Circuito } from './motor/circuito.ts';
import { planificar, type Conexion, type PlanSimulacion } from './motor/montaje.ts';
import { recortar, frecuencia, media, type Serie } from './motor/senal.ts';
import { estadistica, type SenalDmm } from './motor/dmm.ts';
import type { Entrada } from './motor/osciloscopio.ts';
import { Brymen } from './brymen/logica.svelte.ts';
import { Fnirsi } from './fnirsi/logica.svelte.ts';
import { simularTexto, SimulacionCancelada, motor } from '../../simulador/cliente.svelte';
import type { Simulacion } from '../../simulador/motor/simular.ts';

/** A lead or probe that can be placed on a node. */
export type Punta = 'bmRojo' | 'bmNegro' | 'fnRojo' | 'fnNegro' | 'ch1' | 'ch2' | 'masa';

export const NOMBRE_PUNTA: Record<Punta, string> = {
  bmRojo: 'Brymen · punta roja',
  bmNegro: 'Brymen · punta negra (COM)',
  fnRojo: 'FNIRSI multímetro · roja',
  fnNegro: 'FNIRSI multímetro · negra',
  ch1: 'Sonda CH1',
  ch2: 'Sonda CH2',
  masa: 'Pinza de masa (CH1 y CH2)',
};

export interface Datos {
  plan: PlanSimulacion;
  op: Map<string, number>;
  t: Float64Array | null;
  tran: Map<string, Float64Array>;
  ac: Map<string, { re: number; im: number }>;
  ms: number;
  errores: string[];
}

export class Banco {
  /** Circuit netlist as edited (parameters applied). */
  texto = $state('');
  /** The netlist as loaded (reference for the sliders' ranges). */
  original = $state('');
  titulo = $state('');
  circuito: Circuito = $derived(leerCircuito(this.texto));
  alimentado = $state(true);
  /** Voltage source driven by the DDS generator, or null. */
  fuenteGenerador = $state<string | null>(null);
  asentamiento = $state(0);
  dinamico = $state(false);
  /** Variant of the guided practice on the bench ('' in free mode). */
  variante = $state('');
  /** Rows noted in the practice's table. */
  anotaciones = $state<Record<string, number>[]>([]);
  t1 = $state(22);
  t2 = $state(22);

  bm = $state<{ rojo: string | null; negro: string | null; serie: { elemento: string; terminal: number } | null }>({
    rojo: null,
    negro: null,
    serie: null,
  });
  fn = $state<{ rojo: string | null; negro: string | null; serie: { elemento: string; terminal: number } | null }>({
    rojo: null,
    negro: null,
    serie: null,
  });
  sondas = $state<{ ch1: string | null; ch2: string | null; masa: string }>({ ch1: null, ch2: null, masa: '0' });

  brymen = new Brymen();
  fnirsi = new Fnirsi();

  datos = $state.raw<Datos | null>(null);
  simulando = $state(false);
  error = $state('');
  /** Increments with every new result (the views redraw). */
  version = $state(0);
  /** Increments with every multimeter reading (5 per second): live checks follow it. */
  tic = $state(0);
  /** Result version the instruments have read last. */
  leido = $state(0);
  avisoFusible = $state('');

  // ---------------------------------------------------------------- the plan

  conexionDe(c: { rojo: string | null; negro: string | null; serie: { elemento: string; terminal: number } | null }): Conexion | null {
    if (c.serie) return { tipo: 'serie', elemento: c.serie.elemento, terminal: c.serie.terminal };
    if (c.rojo && c.negro && c.rojo !== c.negro) return { tipo: 'nodos', rojo: c.rojo, negro: c.negro };
    return null;
  }

  plan: PlanSimulacion = $derived.by(() => {
    const f = this.fnirsi;
    const osc = f.encendido && f.modo === 'osc';
    return planificar({
      circuito: this.circuito,
      alimentado: this.alimentado,
      dmms: [
        { id: 'bm', conexion: this.conexionDe(this.bm), modelo: this.brymen.modelo() },
        { id: 'fn', conexion: this.conexionDe(this.fn), modelo: f.modeloDmm() },
      ],
      canales: [
        { id: 'ch1', punta: this.sondas.ch1, masa: this.sondas.masa, x10: f.canales[0]!.sondaX10, ac: f.canales[0]!.ac },
        { id: 'ch2', punta: this.sondas.ch2, masa: this.sondas.masa, x10: f.canales[1]!.sondaX10, ac: f.canales[1]!.ac },
      ],
      osciloscopio: osc && (this.sondas.ch1 || this.sondas.ch2) ? { sDiv: f.sDiv } : null,
      generador: this.fuenteGenerador ? { fuente: this.fuenteGenerador, dds: f.encendido ? f.dds : { ...f.dds, salida: false } } : null,
      asentamiento: this.asentamiento,
      ventanaDmm: 0.2,
      dinamico: this.dinamico,
    });
  });

  // ---------------------------------------------------------------- loading a circuit

  cargar(netlist: string, titulo: string, opciones: { generador?: string | null; asentamiento?: number; dinamico?: boolean } = {}): void {
    this.texto = netlist;
    this.original = netlist;
    this.titulo = titulo;
    this.fuenteGenerador = opciones.generador ?? null;
    this.asentamiento = opciones.asentamiento ?? (this.circuito.tran?.inicio ?? 0);
    this.dinamico = opciones.dinamico ?? false;
    this.datos = null;
    this.bm = { rojo: null, negro: null, serie: null };
    this.fn = { rojo: null, negro: null, serie: null };
    this.sondas = { ch1: null, ch2: null, masa: '0' };
  }

  /** Places a lead on a node (or removes it with null). */
  poner(p: Punta, nodo: string | null): void {
    switch (p) {
      case 'bmRojo':
        this.bm = { ...this.bm, rojo: nodo, serie: null };
        break;
      case 'bmNegro':
        this.bm = { ...this.bm, negro: nodo, serie: null };
        break;
      case 'fnRojo':
        this.fn = { ...this.fn, rojo: nodo, serie: null };
        break;
      case 'fnNegro':
        this.fn = { ...this.fn, negro: nodo, serie: null };
        break;
      case 'ch1':
        this.sondas = { ...this.sondas, ch1: nodo };
        break;
      case 'ch2':
        this.sondas = { ...this.sondas, ch2: nodo };
        break;
      case 'masa':
        this.sondas = { ...this.sondas, masa: nodo ?? '0' };
        break;
    }
  }

  /** Meter in series with one terminal of an element (current measurement). */
  enSerie(medidor: 'bm' | 'fn', elemento: string, terminal: number): void {
    const v = { rojo: null, negro: null, serie: { elemento, terminal } };
    if (medidor === 'bm') this.bm = v;
    else this.fn = v;
  }

  /** Where each lead is (for the drawing). */
  get puntas(): { p: Punta; nodo: string }[] {
    const res: { p: Punta; nodo: string }[] = [];
    if (this.bm.rojo) res.push({ p: 'bmRojo', nodo: this.bm.rojo });
    if (this.bm.negro) res.push({ p: 'bmNegro', nodo: this.bm.negro });
    if (this.fn.rojo) res.push({ p: 'fnRojo', nodo: this.fn.rojo });
    if (this.fn.negro) res.push({ p: 'fnNegro', nodo: this.fn.negro });
    if (this.sondas.ch1) res.push({ p: 'ch1', nodo: this.sondas.ch1 });
    if (this.sondas.ch2) res.push({ p: 'ch2', nodo: this.sondas.ch2 });
    if (this.sondas.ch1 || this.sondas.ch2) res.push({ p: 'masa', nodo: this.sondas.masa });
    return res;
  }

  // ---------------------------------------------------------------- running

  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private ultimo = '';

  /** Called by the view whenever the plan changes: simulate after a short pause. */
  pedir(netlist: string, inmediato = false): void {
    if (netlist === this.ultimo && this.datos) return;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.correr(netlist), inmediato ? 0 : 250);
  }

  cancelar(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
  }

  private async correr(netlist: string): Promise<void> {
    this.temporizador = null;
    this.ultimo = netlist;
    const plan = this.plan;
    this.simulando = true;
    try {
      const sim = await simularTexto(netlist);
      if (netlist !== this.ultimo) return;
      this.datos = leerDatos(sim, plan);
      this.error = this.datos.errores.length && !this.datos.op.size && !this.datos.t ? this.datos.errores.join('\n') : '';
      this.version++;
      this.comprobarFusibles();
    } catch (e) {
      if (e instanceof SimulacionCancelada) return;
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      if (netlist === this.ultimo) this.simulando = false;
    }
  }

  /** The last result belongs to the bench as it is now (not to the previous connections or values). */
  get vigente(): boolean {
    return !!this.datos && this.datos.plan.netlist === this.plan.netlist && this.leido === this.version;
  }

  get fase() {
    return motor.fase;
  }

  private comprobarFusibles(): void {
    for (const [id, m] of [
      ['bm', this.brymen],
      ['fn', this.fnirsi],
    ] as const) {
      const s = this.senalDmm(id);
      if (!s) continue;
      const e = estadistica(s.i);
      if (m.revisarFusible(e.acdc)) {
        this.avisoFusible = `Se ha fundido el fusible del ${id === 'bm' ? 'Brymen' : 'FNIRSI'}: pasaban ${e.acdc.toFixed(2).replace('.', ',')} A por el borne de corriente.`;
      }
    }
  }

  // ---------------------------------------------------------------- what each instrument sees

  /** Signal between a multimeter's leads, over whole periods of the last stretch of the transient. */
  senalDmm(id: 'bm' | 'fn'): SenalDmm | null {
    const d = this.datos;
    if (!d) return null;
    const pk = d.plan.nodos[`${id}.p`];
    const nk = d.plan.nodos[`${id}.n`];
    const ik = d.plan.nodos[`${id}.i`];
    if (!pk || !nk || !ik) return null;
    const cache = this.cacheDmm.get(id);
    if (cache && cache.datos === d) return cache.senal;
    let senal: SenalDmm;
    const cap = capacidadAc(d, pk, nk);
    if (d.t && d.tran.get(`v(${pk})`)) {
      const t = d.t;
      const vp = d.tran.get(`v(${pk})`)!;
      const vn = d.tran.get(`v(${nk})`)!;
      const ii = d.tran.get(ik)!;
      const v = new Float64Array(t.length);
      for (let k = 0; k < t.length; k++) v[k] = vp[k]! - vn[k]!;
      const sv: Serie = { t, y: v };
      const si: Serie = { t, y: ii };
      const [a, b] = ventanaEntera(d, sv, si);
      senal = { v: recortar(sv, a, b), i: recortar(si, a, b), c: cap };
    } else {
      const v = (d.op.get(`v(${pk})`) ?? 0) - (d.op.get(`v(${nk})`) ?? 0);
      senal = { v, i: d.op.get(ik) ?? 0, c: cap };
    }
    senal.t1 = this.t1;
    senal.t2 = this.t2;
    this.cacheDmm.set(id, { datos: d, senal });
    return senal;
  }
  private cacheDmm = new Map<string, { datos: Datos; senal: SenalDmm }>();

  /** Signals at the oscilloscope's inputs (after probe, coupling and bandwidth), and the simulated span. */
  entradasOsc(): { entradas: Entrada[]; inicio: number; fin: number } {
    const d = this.datos;
    const entradas: Entrada[] = [null, null];
    if (!d) return { entradas, inicio: 0, fin: 0 };
    (['ch1', 'ch2'] as const).forEach((k, i) => {
      const nodo = d.plan.nodos[k];
      if (!nodo) return;
      const y = d.t ? d.tran.get(`v(${nodo})`) : undefined;
      if (d.t && y) entradas[i] = { t: d.t, y };
      else entradas[i] = d.op.get(`v(${nodo})`) ?? 0;
    });
    const inicio = d.plan.tran?.inicio ?? 0;
    const fin = d.t ? d.t[d.t.length - 1]! : 0;
    return { entradas, inicio, fin };
  }

  /** Nodes of the circuit with ground first. */
  get nodos(): string[] {
    return ['0', ...this.circuito.nodos.filter((n) => !esMasa(n))];
  }
}

/** Reads the plots of a bench run. */
export function leerDatos(sim: Simulacion, plan: PlanSimulacion): Datos {
  const op = new Map<string, number>();
  const tran = new Map<string, Float64Array>();
  const ac = new Map<string, { re: number; im: number }>();
  let t: Float64Array | null = null;
  for (const g of sim.ejecucion.graficas) {
    const a = g.analisis.toLowerCase();
    if (a.startsWith('operating')) for (const v of g.vectores) op.set(v.nombre.toLowerCase(), v.re[0] ?? 0);
    else if (a.startsWith('transient')) {
      t = g.vectores[0]?.re ?? null;
      for (const v of g.vectores.slice(1)) tran.set(v.nombre.toLowerCase(), v.re);
    } else if (a.startsWith('ac')) {
      for (const v of g.vectores.slice(1)) ac.set(v.nombre.toLowerCase(), { re: v.re[0] ?? 0, im: v.im?.[0] ?? 0 });
    }
  }
  return { plan, op, t, tran, ac, ms: sim.ejecucion.ms, errores: sim.salida.errores };
}

/** Capacitance between the leads from the 1 A small-signal test: C = Im(1/Z)/ω. */
function capacidadAc(d: Datos, pk: string, nk: string): number | null {
  if (!d.plan.ac) return null;
  const p = d.ac.get(`v(${pk})`);
  const n = d.ac.get(`v(${nk})`);
  if (!p || !n) return null;
  const zr = p.re - n.re;
  const zi = p.im - n.im;
  const m2 = zr * zr + zi * zi;
  if (m2 === 0) return Infinity;
  // Y = 1/Z = (zr − j zi)/|Z|²
  const yi = -zi / m2;
  return yi / (2 * Math.PI * d.plan.ac.f);
}

/** Window of whole periods at the end of the transient (so averages and RMS do not depend on the phase). */
function ventanaEntera(d: Datos, v: Serie, i: Serie): [number, number] {
  const t = v.t;
  const fin = t[t.length - 1]!;
  const ini = Math.max(d.plan.tran?.inicio ?? t[0]!, t[0]!);
  // At most two seconds of signal, and the period from the signal itself (oscillators have no known f).
  const desde = Math.max(ini, fin - 2);
  const base = recortar(v, desde, fin);
  const amp = Math.max(...base.y) - Math.min(...base.y);
  let serie = base;
  if (amp < 1e-9) {
    const bi = recortar(i, desde, fin);
    serie = bi;
  }
  const m = media(serie);
  const a2 = Math.max(...serie.y) - Math.min(...serie.y);
  const r = a2 > 1e-12 ? frecuencia(serie, m, a2 * 0.1) : null;
  if (!r || r.n < 1) return [desde, fin];
  const T = 1 / r.f;
  const n = Math.floor((fin - r.t0) / T + 1e-6);
  if (n < 1) return [desde, fin];
  return [r.t0, r.t0 + n * T];
}
