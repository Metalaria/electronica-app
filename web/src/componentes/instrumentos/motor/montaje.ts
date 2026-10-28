// The test bench netlist: the circuit, the instruments inserted where their leads are, and the analyses that
// the instruments need. Every instrument is an electrical part of the circuit, as on a real bench:
//
//   multimeter on VΩ, voltage functions   10 MΩ ‖ 60 pF between the leads (mV ranges: the impedance falls
//                                          above about 3 V, as the BM869s manual and the book warn)
//   multimeter on VΩ, Ω / continuity / ⏵  Thévenin test source (open-circuit voltage, internal resistance)
//   multimeter on VΩ, capacitance         an AC current source of 1 A (small-signal .ac at one frequency)
//   multimeter on a current jack          the shunt (burden) of that jack, whatever the selector says
//   oscilloscope probe                    10 MΩ ‖ 20 pF (×10) or 1 MΩ ‖ 100 pF (×1) between tip and ground clip,
//                                          then (inside the instrument) the AC coupling high-pass (10 Hz) and the
//                                          bandwidth (50 MHz, or 6 MHz with the probe on ×1) as RC stages
//   the two ground clips                   joined inside the oscilloscope (they short what is between them)
//   DDS generator                          replaces a voltage source of the circuit, with 50 Ω in series
//   earphone («escuchar», 0.10)             nothing electrical (an ideal listener): its node (and reference) are
//                                          saved, and the transient is long and fine enough to be heard
//
// The bench then reads node voltages and the current through each multimeter (a 0 V source in series).

import { esMasa, type Circuito } from './circuito.ts';
import { fuenteDds, fMaxDds, DDS_LIMITES, type Dds } from './generador.ts';
import { textoSpice } from '../../../simulador/motor/netlist.ts';

/** Where a pair of leads is. */
export type Conexion =
  | { tipo: 'nodos'; rojo: string; negro: string }
  /** In series: the terminal of an element is disconnected from its node, and the meter goes in between
   *  (red lead on the node, black lead on the element's terminal). */
  | { tipo: 'serie'; elemento: string; terminal: number };

/** What a multimeter is, electrically, between its red and black leads. */
export type ModeloDmm =
  | { tipo: 'abierto' }
  | { tipo: 'voltimetro'; r: number; c: number; mv: boolean }
  | { tipo: 'ohmimetro'; voc: number; rs: number }
  | { tipo: 'capacimetro'; f: number }
  | { tipo: 'amperimetro'; r: number };

export interface DmmEnBanco {
  /** «bm» (Brymen) or «fn» (FNIRSI's multimeter): prefix of the inserted parts. */
  id: string;
  conexion: Conexion | null;
  modelo: ModeloDmm;
}

export interface CanalEnBanco {
  id: 'ch1' | 'ch2';
  punta: string | null;
  masa: string | null;
  x10: boolean;
  ac: boolean;
}

export interface Banco {
  circuito: Circuito;
  /** Circuit powered (independent sources as written) or off (all set to zero: Ω, diode and C measurements). */
  alimentado: boolean;
  dmms: DmmEnBanco[];
  canales: CanalEnBanco[];
  /** The oscilloscope acquires (needs a transient): time per division, or null. */
  osciloscopio: { sDiv: number } | null;
  /** The DDS generator drives this voltage source of the circuit (or null). */
  generador: { fuente: string; dds: Dds } | null;
  /** Time to let the circuit settle before the instruments look (s). */
  asentamiento: number;
  /** Seconds of signal the multimeters average over (5 readings per second: about 0.2 s, at most). */
  ventanaDmm: number;
  /** Run a transient even without time-varying sources (an oscillator). */
  dinamico?: boolean;
  /**
   * Power-up (0.10, the breadboard and the editor): with a transient, the DC sources rise from 0 in 1 µs at
   * t = 0, as when the supply is switched on, instead of starting from the operating point (an oscillator
   * such as a 555 may sit forever at its balanced operating point; a real one starts at power-up).
   */
  arranque?: boolean;
  /** Listening to a node (0.10): the node and its reference; the transient covers `ESCUCHA` at audio rate. */
  escucha?: { punta: string; masa: string } | null;
}

/** What listening asks of the transient: at least this long (s), with this step at most (s): 48 kHz. */
export const ESCUCHA = { span: 0.06, paso: 1 / 48000 };

export interface PlanSimulacion {
  netlist: string;
  /** Names of the vectors the bench reads (lower case, as ngspice writes them). */
  nodos: Record<string, string>;
  tran: { inicio: number; fin: number; paso: number } | null;
  ac: { f: number } | null;
  /** Frequency of the slowest periodic source, if known (for the multimeters' averaging). */
  fBase: number | null;
  avisos: string[];
}

const n = (v: number) => textoSpice(v, 6);

/** Internal node and part names: two underscores, so they never collide with the circuit's names. */
export const NODO = {
  dmmP: (id: string) => `__${id}_p`,
  dmmN: (id: string) => `__${id}_n`,
  canal: (id: string) => `__${id}_o`,
};

interface Edicion {
  ini: number;
  fin: number;
  texto: string;
}

function aplicar(texto: string, eds: Edicion[]): string {
  let res = texto;
  for (const e of [...eds].sort((a, b) => b.ini - a.ini)) res = res.slice(0, e.ini) + e.texto + res.slice(e.fin);
  return res;
}

/** The analyses each part of the bench needs, and the netlist that does them. */
export function planificar(b: Banco): PlanSimulacion {
  const c = b.circuito;
  const avisos: string[] = [];
  const eds: Edicion[] = [];
  const extra: string[] = ['', '* ---- banco de pruebas (añadido por la aplicación) ----'];
  const nodos: Record<string, string> = {};

  // Multimeters in series cut a terminal: the element's node token is replaced by the meter's node.
  const cortes = new Map<string, string>();
  for (const d of b.dmms) {
    if (d.conexion?.tipo !== 'serie') continue;
    cortes.set(`${d.conexion.elemento.toLowerCase()}#${d.conexion.terminal}`, `__${d.id}_corte`);
  }
  const nodoDe = (e: Circuito['elementos'][number], i: number) =>
    cortes.get(`${e.nombre.toLowerCase()}#${i}`) ?? e.terminales[i]?.nodo ?? '0';
  const reescritos = new Set<string>();

  // Sources: AC magnitudes removed (the bench runs its own .ac), sources off when the circuit is unpowered,
  // and the generator's source replaced by the DDS.
  // (computed here too: power-up rewrites the DC sources only when there will be a transient)
  const conTransitorio =
    b.alimentado && (c.variables.some((v) => v.elemento.toLowerCase() !== b.generador?.fuente.toLowerCase()) || !!(b.generador && b.generador.dds.salida) || !!c.tran || !!b.dinamico || !!b.escucha);
  const variables = new Set(c.variables.map((v) => v.elemento.toLowerCase()));
  for (const e of c.elementos) {
    if (e.tipo !== 'V' && e.tipo !== 'I' && e.tipo !== 'B') continue;
    const nodosTxt = e.terminales.map((_, i) => nodoDe(e, i)).join(' ');
    if (b.generador && e.nombre.toLowerCase() === b.generador.fuente.toLowerCase()) {
      const p = nodoDe(e, 0);
      const q = nodoDe(e, 1);
      const dds = b.alimentado ? b.generador.dds : { ...b.generador.dds, salida: false };
      const f = fuenteDds(dds);
      const interno = `__dds_${e.nombre}`;
      const linea =
        (f.tipo === 'V' ? `${e.nombre} ${interno} ${q} ${f.texto}` : `B${e.nombre.slice(1)}__dds ${interno} ${q} ${f.texto}`) +
        `\nR__dds_${e.nombre} ${interno} ${p} ${n(DDS_LIMITES.rSalida)}`;
      eds.push({ ini: e.ini, fin: e.fin, texto: linea });
      reescritos.add(e.nombre.toLowerCase());
      continue;
    }
    if (!b.alimentado) {
      const cero = e.tipo === 'B' ? (/\bi\s*=/i.test(e.linea) ? 'I = 0' : 'V = 0') : 'DC 0';
      eds.push({ ini: e.ini, fin: e.fin, texto: `${e.nombre} ${nodosTxt} ${cero}` });
      reescritos.add(e.nombre.toLowerCase());
      continue;
    }
    if (b.arranque && conTransitorio && e.tipo !== 'B' && !variables.has(e.nombre.toLowerCase()) && !/\bac\b/i.test(e.linea)) {
      // A plain DC source: «DC 9», «9», «dc=9».
      const resto = e.linea.split(/\s+/).slice(1 + e.terminales.length).join(' ').trim();
      const m = /^(?:dc\s*=?\s*)?([-+]?[0-9.]+(?:e[-+]?\d+)?[a-zµ]*)$/i.exec(resto);
      if (m) {
        eds.push({ ini: e.ini, fin: e.fin, texto: `${e.nombre} ${nodosTxt} PWL(0 0 1u ${m[1]})` });
        reescritos.add(e.nombre.toLowerCase());
        continue;
      }
    }
    if (e.tipo !== 'B' && /\bac\b/i.test(e.linea)) {
      // Rebuilt from the logical line: name, nodes, and the rest without «AC mag [phase]».
      const resto = e.linea
        .split(/\s+/)
        .slice(1 + e.terminales.length)
        .join(' ')
        .replace(/\bac\s+[-+0-9.eE]+[a-zµ]*(\s+[-+0-9.eE]+[a-zµ]*)?(?![^(]*\))/i, '')
        .trim();
      eds.push({ ini: e.ini, fin: e.fin, texto: `${e.nombre} ${nodosTxt} ${resto || 'DC 0'}` });
      reescritos.add(e.nombre.toLowerCase());
    }
  }
  // Cuts on elements that were not rewritten: replace the node token in place.
  for (const [clave, nuevo] of cortes) {
    const [nombre, iTxt] = clave.split('#');
    if (reescritos.has(nombre!)) continue;
    const el = c.elementos.find((e) => e.nombre.toLowerCase() === nombre);
    const t = el?.terminales[Number(iTxt)];
    if (t) eds.push({ ini: t.ini, fin: t.fin, texto: nuevo });
  }

  // Multimeters.
  let ac: PlanSimulacion['ac'] = null;
  for (const d of b.dmms) {
    if (!d.conexion) continue;
    const P = NODO.dmmP(d.id);
    const N = NODO.dmmN(d.id);
    let rojo: string;
    let negro: string;
    if (d.conexion.tipo === 'nodos') {
      rojo = d.conexion.rojo;
      negro = d.conexion.negro;
    } else {
      const { elemento, terminal } = d.conexion;
      const el = c.elementos.find((e) => e.nombre.toLowerCase() === elemento.toLowerCase());
      const t = el?.terminales[terminal];
      if (!el || !t) {
        avisos.push(`No se encuentra el terminal de ${elemento} donde estaba el amperímetro.`);
        continue;
      }
      rojo = t.nodo;
      negro = `__${d.id}_corte`;
    }
    // Sense source: current entering the red lead. Both lead nodes are saved.
    extra.push(`V__${d.id}_s ${rojo} ${P} DC 0`);
    extra.push(`R__${d.id}_cn ${negro} ${N} 1e-6`);
    nodos[`${d.id}.p`] = P.toLowerCase();
    nodos[`${d.id}.n`] = N.toLowerCase();
    nodos[`${d.id}.i`] = `i(v__${d.id}_s)`;
    const m = d.modelo;
    switch (m.tipo) {
      case 'abierto':
        extra.push(`R__${d.id}_x ${P} ${N} 1e12`);
        break;
      case 'voltimetro':
        extra.push(`R__${d.id}_r ${P} ${N} ${n(m.r)}`);
        extra.push(`C__${d.id}_c ${P} ${N} ${n(m.c)}`);
        if (m.mv) {
          // mV ranges: the input protection starts to conduct above about 3 V (≈ 20 kΩ at 10 V, 4 kΩ at 35 V).
          extra.push(`B__${d.id}_mv ${P} ${N} I = (v(${P},${N})>3 ? (v(${P},${N})-3)/14k : (v(${P},${N})<-3 ? (v(${P},${N})+3)/14k : 0))`);
        }
        break;
      case 'ohmimetro':
        extra.push(`R__${d.id}_rs ${P} __${d.id}_t ${n(m.rs)}`);
        extra.push(`V__${d.id}_o __${d.id}_t ${N} DC ${n(m.voc)}`);
        break;
      case 'capacimetro':
        extra.push(`R__${d.id}_x ${P} ${N} 1e12`);
        extra.push(`I__${d.id}_c ${N} ${P} DC 0 AC 1`);
        ac = { f: m.f };
        break;
      case 'amperimetro':
        extra.push(`R__${d.id}_sh ${P} ${N} ${n(m.r)}`);
        break;
    }
  }

  // Oscilloscope channels.
  const masas: string[] = [];
  for (const ch of b.canales) {
    if (!ch.punta) continue;
    const masa = ch.masa ?? '0';
    if (!masas.some((m) => m.toLowerCase() === masa.toLowerCase())) masas.push(masa);
    const k = ch.id;
    const [rp, cp, bw] = ch.x10 ? [10e6, 20e-12, 50e6] : [1e6, 100e-12, 6e6];
    extra.push(`R__${k}_p ${ch.punta} ${masa} ${n(rp)}`);
    extra.push(`C__${k}_p ${ch.punta} ${masa} ${n(cp)}`);
    extra.push(`E__${k}_e __${k}_e 0 ${ch.punta} ${masa} 1`);
    let entrada = `__${k}_e`;
    if (ch.ac) {
      // AC coupling: about 10 Hz (1 MΩ and 16 nF, the book's estimate), then a buffer.
      extra.push(`C__${k}_ac __${k}_e __${k}_x 15.9n`);
      extra.push(`R__${k}_ac __${k}_x 0 1meg`);
      extra.push(`E__${k}_b __${k}_y 0 __${k}_x 0 1`);
      entrada = `__${k}_y`;
    }
    const cbw = 1 / (2 * Math.PI * 1000 * bw);
    extra.push(`R__${k}_bw ${entrada} ${NODO.canal(k)} 1k`);
    extra.push(`C__${k}_bw ${NODO.canal(k)} 0 ${n(cbw)}`);
    nodos[`${k}`] = NODO.canal(k).toLowerCase();
  }
  // The earphone: its node and reference are read (as v(…), ground excluded).
  if (b.escucha) {
    nodos['esc'] = b.escucha.punta.toLowerCase();
    if (!esMasa(b.escucha.masa)) nodos['esc.m'] = b.escucha.masa.toLowerCase();
  }
  // The ground clips are one node inside the instrument.
  for (let i = 1; i < masas.length; i++) {
    extra.push(`R__masas_${i} ${masas[0]} ${masas[i]} 1m`);
    avisos.push(
      `Las pinzas de masa de los dos canales están en nodos distintos (${masas[0]} y ${masas[i]}): dentro del osciloscopio son el mismo punto, así que cortocircuitan lo que haya entre ellos.`,
    );
  }

  // Which analyses.
  const fuentes = b.alimentado ? c.variables.filter((v) => v.elemento.toLowerCase() !== b.generador?.fuente.toLowerCase()) : [];
  const conGenerador = !!(b.generador && b.generador.dds.salida && b.alimentado);
  // A transient is needed with time-varying sources, and also for circuits that move by themselves
  // (oscillators: the book's netlist ran a .tran) or when the bench asks for it.
  const variable = b.alimentado && (fuentes.length > 0 || conGenerador || !!c.tran || !!b.dinamico || !!b.escucha);
  const frecuencias = fuentes.map((v) => v.frecuencia).filter((f): f is number => !!f && f > 0);
  if (conGenerador) frecuencias.push(b.generador!.dds.frecuencia);
  const fBase = frecuencias.length ? Math.min(...frecuencias) : null;
  const fMax = Math.max(
    0,
    ...frecuencias.map((f) => f * 10),
    // Behavioural sources (AM, sums of sines) need fewer points per cycle than edges: four times f.
    ...fuentes.map((v) => (v.fMax ?? 0) * 4),
    conGenerador ? fMaxDds(b.generador!.dds) : 0,
  );

  let tran: PlanSimulacion['tran'] = null;
  if (variable) {
    // From power-up, a periodic circuit needs some periods to reach its steady state (a capacitor charging
    // to its mean): the instruments look after twenty periods (at most 0,2 s).
    const inicio = Math.max(0, b.asentamiento, b.arranque && fBase ? Math.min(20 / fBase, 0.2) : 0);
    const W = b.osciloscopio ? 12 * b.osciloscopio.sDiv : 0;
    // Oscilloscope: room to find a trigger in the first 1.2 windows and to show the next one.
    const spanOsc = b.osciloscopio ? 2.4 * W : 0;
    // Multimeters: several periods of the slowest source (or the requested window).
    const sinF = Math.max(b.ventanaDmm, c.tran ? Math.min(2, c.tran.fin - inicio) : 0);
    // Twenty periods of the slowest source, or the requested window when f is not known.
    const spanDmm = b.dmms.some((d) => d.conexion) ? (fBase ? Math.min(Math.max(1e-5, 20 / fBase), 4) : sinF) : 0;
    // Listening: a stretch long enough for several periods of a tone, at an audio sampling rate.
    const spanEsc = b.escucha ? Math.max(ESCUCHA.span, fBase && fBase >= 20 ? Math.min(0.25, 20 / fBase) : 0) : 0;
    let span = Math.max(spanOsc, spanDmm, spanEsc, fBase ? 3 / fBase : 1e-3);
    // Step: fine enough for the screen (2 points per sample of 1 000) and for the fastest source.
    let paso = Math.min(W > 0 ? W / 2000 : Infinity, fMax > 0 ? 1 / (40 * fMax) : Infinity, (inicio + span) / 400, b.escucha ? ESCUCHA.paso : Infinity);
    const MAX_PUNTOS = 4e5;
    if (span / paso > MAX_PUNTOS) {
      // Too many points: keep the oscilloscope's window resolved, shorten the multimeter's.
      const spanMin = Math.max(spanOsc, fBase ? 3 / fBase : 0);
      if (spanMin / paso <= MAX_PUNTOS) span = Math.max(spanMin, paso * MAX_PUNTOS);
      else {
        paso = span / MAX_PUNTOS;
        avisos.push('La simulación se ha hecho con menos resolución temporal de la que pide la pantalla (demasiados puntos).');
      }
    }
    tran = { inicio, fin: inicio + span, paso };
  }

  // Netlist.
  let texto = aplicar(c.texto, eds);
  texto = texto.replace(/\s+$/, '') + '\n' + extra.join('\n') + '\n';
  const guardar = Object.values(nodos)
    .map((v) => (v.startsWith('i(') ? v : `v(${v})`))
    .join(' ');
  if (guardar) texto += `.save ${guardar}\n`;
  texto += '.op\n';
  if (tran) {
    texto += `.tran ${n(tran.paso)} ${n(tran.fin)} ${n(tran.inicio)} ${n(tran.paso)}${c.uic ? ' uic' : ''}\n`;
  }
  if (ac) texto += `.ac lin 1 ${n(ac.f)} ${n(ac.f)}\n`;
  texto += '.end\n';
  return { netlist: texto, nodos, tran, ac, fBase, avisos };
}

/** Whether a node exists in the circuit (or is ground). */
export function existeNodo(c: Circuito, nodo: string): boolean {
  return esMasa(nodo) || c.nodos.some((x) => x.toLowerCase() === nodo.toLowerCase());
}
