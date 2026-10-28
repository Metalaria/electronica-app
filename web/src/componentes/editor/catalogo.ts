// The palette: every kind of part the editor can place, with its symbol (the book's symbols of
// esquema-auto/simbolos.ts, plus a few of the editor's own drawn in the same style), its editable fields
// and how it is written in the netlist.

import type { Dispositivo } from '../esquema-auto/modelo.ts';
import { simboloDe, type DefSimbolo, type Prim, type Pt } from '../esquema-auto/simbolos.ts';
import { formatoCorto } from '../grafica/formato.ts';
import type { FamiliaModelo } from './modelos.ts';
import type { Componente } from './tipos.ts';
import { leerValor } from './valores.ts';

export type TipoCampo = 'valor' | 'texto' | 'modelo' | 'opcion' | 'red' | 'pwl';

export interface Campo {
  id: string;
  etiqueta: string;
  tipo: TipoCampo;
  unidad?: string;
  opcional?: boolean;
  opciones?: [string, string][];
  familia?: FamiliaModelo;
  ayuda?: string;
  /** Shown only when this returns true (source waveform fields). */
  si?: (c: Componente) => boolean;
}

export type Grupo = 'Pasivos' | 'Fuentes' | 'Semiconductores' | 'Integrados' | 'Digital' | 'Conexiones' | 'Medida';

export interface Tipo {
  id: string;
  nombre: string;
  grupo: Grupo;
  /** Designator prefix («R» → R1, R2…). */
  prefijo: string;
  /** Topology role (ESQUEMA.md «elementos[]») and schemdraw-like class. */
  rol: string;
  clase: string;
  campos: Campo[];
  inicial: Record<string, string>;
  /** Orientation when placed (sources upright with + up). */
  o: number;
  /** Search words for the palette filter. */
  claves?: string;
}

const vf = (forma: string) => (c: Componente) => (c.campos['forma'] ?? 'dc') === forma;
const noTexto = (c: Componente) => (c.campos['forma'] ?? 'dc') !== 'texto';

const CAMPOS_FUENTE = (u: 'V' | 'A'): Campo[] => [
  {
    id: 'forma',
    etiqueta: 'Forma de onda',
    tipo: 'opcion',
    opciones: [
      ['dc', 'Continua'],
      ['sin', 'Senoidal (SIN)'],
      ['pulse', 'Pulsos (PULSE)'],
      ['pwl', 'Por tramos (PWL)'],
      ['texto', 'Texto SPICE'],
    ],
  },
  { id: 'dc', etiqueta: u === 'V' ? 'Tensión continua' : 'Corriente continua', tipo: 'valor', unidad: u, opcional: true, si: noTexto },
  { id: 'ac', etiqueta: 'Amplitud para .ac', tipo: 'valor', unidad: u, opcional: true, si: noTexto, ayuda: 'Magnitud de la señal en el análisis de alterna (normalmente 1).' },
  { id: 'vo', etiqueta: 'Nivel medio', tipo: 'valor', unidad: u, si: vf('sin') },
  { id: 'va', etiqueta: 'Amplitud (pico)', tipo: 'valor', unidad: u, si: vf('sin') },
  { id: 'freq', etiqueta: 'Frecuencia', tipo: 'valor', unidad: 'Hz', si: vf('sin') },
  { id: 'td', etiqueta: 'Retardo', tipo: 'valor', unidad: 's', opcional: true, si: (c) => vf('sin')(c) || vf('pulse')(c) },
  { id: 'fase', etiqueta: 'Fase (grados)', tipo: 'valor', unidad: '', opcional: true, si: vf('sin') },
  { id: 'v1', etiqueta: 'Nivel inicial', tipo: 'valor', unidad: u, si: vf('pulse') },
  { id: 'v2', etiqueta: 'Nivel del pulso', tipo: 'valor', unidad: u, si: vf('pulse') },
  { id: 'tr', etiqueta: 'Tiempo de subida', tipo: 'valor', unidad: 's', si: vf('pulse') },
  { id: 'tf', etiqueta: 'Tiempo de bajada', tipo: 'valor', unidad: 's', si: vf('pulse') },
  { id: 'pw', etiqueta: 'Anchura del pulso', tipo: 'valor', unidad: 's', si: vf('pulse') },
  { id: 'per', etiqueta: 'Periodo', tipo: 'valor', unidad: 's', si: vf('pulse') },
  { id: 'pwl', etiqueta: 'Puntos (tiempo valor; …)', tipo: 'pwl', unidad: u, si: vf('pwl'), ayuda: 'Pares «tiempo valor» separados por punto y coma: 0 0; 1m 5; 2m 5; 2,1m 0' },
  { id: 'spec', etiqueta: 'Especificación SPICE', tipo: 'texto', si: vf('texto'), ayuda: 'Lo que va tras los nodos, tal cual: DC 0 AC 1 SIN(0 1 1k)…' },
];

// Digital parts (XSPICE code models of ngspice: d_and…, d_dff, d_jkff, adc_bridge, dac_bridge, d_osc). Their
// nets are digital (0/1 events, no voltage): an ADC bridge brings an analog signal in, a DAC bridge takes a
// digital one out to be measured or plotted. Each part writes its own .model line (netlist.ts).
const RETARDO: Campo = { id: 'retardo', etiqueta: 'Retardo de propagación', tipo: 'valor', unidad: 's', ayuda: 'Retardo de subida y de bajada de la salida (rise_delay, fall_delay).' };
const AYUDA_DIGITAL = 'Las redes digitales no tienen tensión: para medir o dibujar una salida, pásela por un puente DAC.';
function puertaDigital(id: string, nombre: string, claves: string): Tipo {
  return { id, nombre, grupo: 'Digital', prefijo: 'U', rol: 'X', clase: 'Gate', o: 0, inicial: { retardo: '10n' }, campos: [{ ...RETARDO, ayuda: `${RETARDO.ayuda} ${AYUDA_DIGITAL}` }], claves: `xspice digital logica puerta ${claves}` };
}
const CAMPOS_BIESTABLE: Campo[] = [
  { id: 'retardo', etiqueta: 'Retardo reloj → salida', tipo: 'valor', unidad: 's', ayuda: `clk_delay del modelo; S y R (activos a nivel alto) pueden quedar sin conectar. ${AYUDA_DIGITAL}` },
  { id: 'ic', etiqueta: 'Estado inicial de Q', tipo: 'opcion', opciones: [['0', '0'], ['1', '1']] },
];

const EXTRA: Campo = { id: 'extra', etiqueta: 'Parámetros SPICE adicionales', tipo: 'texto', opcional: true, ayuda: 'Se añaden al final de la línea tal cual (por ejemplo tc1=0.001).' };

export const TIPOS: Tipo[] = [
  { id: 'R', nombre: 'Resistencia', grupo: 'Pasivos', prefijo: 'R', rol: 'R', clase: 'ResistorIEC', o: 0, inicial: { valor: '1k' }, campos: [{ id: 'valor', etiqueta: 'Resistencia', tipo: 'valor', unidad: 'Ω' }, EXTRA], claves: 'resistor' },
  {
    id: 'POT',
    nombre: 'Potenciómetro',
    grupo: 'Pasivos',
    prefijo: 'P',
    rol: 'POT',
    clase: 'Potentiometer',
    o: 0,
    inicial: { valor: '10k', pos: '50' },
    campos: [
      { id: 'valor', etiqueta: 'Resistencia total', tipo: 'valor', unidad: 'Ω' },
      { id: 'pos', etiqueta: 'Posición del cursor (%)', tipo: 'valor', unidad: '%', ayuda: '0 % = cursor junto al terminal 1; 100 % = junto al terminal 2.' },
    ],
    claves: 'potenciometro trimmer divisor',
  },
  { id: 'C', nombre: 'Condensador', grupo: 'Pasivos', prefijo: 'C', rol: 'C', clase: 'Capacitor', o: 0, inicial: { valor: '100n' }, campos: [{ id: 'valor', etiqueta: 'Capacidad', tipo: 'valor', unidad: 'F' }, { id: 'ic', etiqueta: 'Tensión inicial (con UIC)', tipo: 'valor', unidad: 'V', opcional: true }, EXTRA], claves: 'capacitor' },
  { id: 'L', nombre: 'Bobina', grupo: 'Pasivos', prefijo: 'L', rol: 'L', clase: 'Inductor2', o: 0, inicial: { valor: '10m' }, campos: [{ id: 'valor', etiqueta: 'Inductancia', tipo: 'valor', unidad: 'H' }, { id: 'ic', etiqueta: 'Corriente inicial (con UIC)', tipo: 'valor', unidad: 'A', opcional: true }, EXTRA], claves: 'inductor inductancia' },
  {
    id: 'TRAFO',
    nombre: 'Transformador',
    grupo: 'Pasivos',
    prefijo: 'T',
    rol: 'XFMR',
    clase: 'Transformer',
    o: 0,
    inicial: { lp: '100m', ls: '1m', k: '0,999' },
    campos: [
      { id: 'lp', etiqueta: 'Inductancia del primario', tipo: 'valor', unidad: 'H' },
      { id: 'ls', etiqueta: 'Inductancia del secundario', tipo: 'valor', unidad: 'H', ayuda: 'Relación de espiras n = √(Lp/Ls).' },
      { id: 'k', etiqueta: 'Coeficiente de acoplamiento k', tipo: 'valor', unidad: '' },
    ],
    claves: 'bobinas acopladas trafo',
  },
  { id: 'V', nombre: 'Fuente de tensión', grupo: 'Fuentes', prefijo: 'V', rol: 'V', clase: 'SourceV', o: 3, inicial: { forma: 'dc', dc: '5' }, campos: CAMPOS_FUENTE('V'), claves: 'pila bateria generador senoidal pulso' },
  {
    id: 'VSIN',
    nombre: 'Generador senoidal',
    grupo: 'Fuentes',
    prefijo: 'V',
    rol: 'VSIN',
    clase: 'SourceSin',
    o: 3,
    inicial: { forma: 'sin', vo: '0', va: '1', freq: '1k', ac: '1' },
    campos: CAMPOS_FUENTE('V'),
    claves: 'alterna sin seno',
  },
  {
    id: 'VPULSE',
    nombre: 'Generador de pulsos',
    grupo: 'Fuentes',
    prefijo: 'V',
    rol: 'VPULSE',
    clase: 'SourceSquare',
    o: 3,
    inicial: { forma: 'pulse', v1: '0', v2: '5', td: '0', tr: '1µ', tf: '1µ', pw: '0,5m', per: '1m' },
    campos: CAMPOS_FUENTE('V'),
    claves: 'cuadrada reloj escalon pulse pwl',
  },
  { id: 'I', nombre: 'Fuente de corriente', grupo: 'Fuentes', prefijo: 'I', rol: 'I', clase: 'SourceI', o: 3, inicial: { forma: 'dc', dc: '1m' }, campos: CAMPOS_FUENTE('A'), claves: 'corriente' },
  {
    id: 'E',
    nombre: 'Fuente E (tensión controlada)',
    grupo: 'Fuentes',
    prefijo: 'E',
    rol: 'DEP',
    clase: 'SourceControlledV',
    o: 0,
    inicial: { valor: '10' },
    campos: [{ id: 'valor', etiqueta: 'Ganancia (V/V)', tipo: 'valor', unidad: '' }],
    claves: 'dependiente vcvs controlada',
  },
  {
    id: 'G',
    nombre: 'Fuente G (corriente controlada)',
    grupo: 'Fuentes',
    prefijo: 'G',
    rol: 'DEP',
    clase: 'SourceControlledI',
    o: 0,
    inicial: { valor: '1m' },
    campos: [{ id: 'valor', etiqueta: 'Transconductancia', tipo: 'valor', unidad: 'S' }],
    claves: 'dependiente vccs transconductancia controlada',
  },
  { id: 'D', nombre: 'Diodo', grupo: 'Semiconductores', prefijo: 'D', rol: 'D', clase: 'Diode', o: 0, inicial: { modelo: 'D1N4148' }, campos: [{ id: 'modelo', etiqueta: 'Modelo', tipo: 'modelo', familia: 'D' }, EXTRA], claves: 'rectificador 1n4148 1n4007' },
  { id: 'DZ', nombre: 'Diodo Zener', grupo: 'Semiconductores', prefijo: 'D', rol: 'DZ', clase: 'Zener', o: 0, inicial: { modelo: 'DZ56' }, campos: [{ id: 'modelo', etiqueta: 'Modelo', tipo: 'modelo', familia: 'DZ' }, EXTRA], claves: 'zener regulador' },
  { id: 'LED', nombre: 'LED', grupo: 'Semiconductores', prefijo: 'D', rol: 'LED', clase: 'LED', o: 0, inicial: { modelo: 'LEDR' }, campos: [{ id: 'modelo', etiqueta: 'Modelo', tipo: 'modelo', familia: 'LED' }, EXTRA], claves: 'diodo luz' },
  { id: 'DS', nombre: 'Diodo Schottky', grupo: 'Semiconductores', prefijo: 'D', rol: 'D', clase: 'Schottky', o: 0, inicial: { modelo: 'DSCH' }, campos: [{ id: 'modelo', etiqueta: 'Modelo', tipo: 'modelo', familia: 'DS' }, EXTRA], claves: 'schottky' },
  { id: 'QN', nombre: 'Transistor NPN', grupo: 'Semiconductores', prefijo: 'Q', rol: 'QN', clase: 'BjtNpn', o: 0, inicial: { modelo: 'Q2N3904' }, campos: [{ id: 'modelo', etiqueta: 'Modelo', tipo: 'modelo', familia: 'QN' }, EXTRA], claves: 'bjt bipolar 2n3904' },
  { id: 'QP', nombre: 'Transistor PNP', grupo: 'Semiconductores', prefijo: 'Q', rol: 'QP', clase: 'BjtPnp', o: 4, inicial: { modelo: 'Q2N3906' }, campos: [{ id: 'modelo', etiqueta: 'Modelo', tipo: 'modelo', familia: 'QP' }, EXTRA], claves: 'bjt bipolar 2n3906' },
  { id: 'MN', nombre: 'MOSFET de canal N', grupo: 'Semiconductores', prefijo: 'M', rol: 'MN', clase: 'NFet', o: 0, inicial: { modelo: 'NTY' }, campos: [{ id: 'modelo', etiqueta: 'Modelo', tipo: 'modelo', familia: 'MN' }, EXTRA], claves: 'nmos fet' },
  { id: 'MP', nombre: 'MOSFET de canal P', grupo: 'Semiconductores', prefijo: 'M', rol: 'MP', clase: 'PFet', o: 4, inicial: { modelo: 'PTY' }, campos: [{ id: 'modelo', etiqueta: 'Modelo', tipo: 'modelo', familia: 'MP' }, EXTRA], claves: 'pmos fet' },
  { id: 'JN', nombre: 'JFET de canal N', grupo: 'Semiconductores', prefijo: 'J', rol: 'JN', clase: 'JFetN', o: 0, inicial: { modelo: 'JN' }, campos: [{ id: 'modelo', etiqueta: 'Modelo', tipo: 'modelo', familia: 'JN' }, EXTRA], claves: 'jfet' },
  { id: 'JP', nombre: 'JFET de canal P', grupo: 'Semiconductores', prefijo: 'J', rol: 'JP', clase: 'JFetP', o: 4, inicial: { modelo: 'JP' }, campos: [{ id: 'modelo', etiqueta: 'Modelo', tipo: 'modelo', familia: 'JP' }, EXTRA], claves: 'jfet' },
  { id: 'OA', nombre: 'Amplificador operacional', grupo: 'Integrados', prefijo: 'U', rol: 'OA', clase: 'Opamp', o: 0, inicial: { modelo: 'opamp' }, campos: [{ id: 'modelo', etiqueta: 'Modelo', tipo: 'modelo', familia: 'OA' }], claves: 'opamp 741 comparador' },
  { id: 'OA5', nombre: 'Operacional con alimentación', grupo: 'Integrados', prefijo: 'U', rol: 'OA', clase: 'Opamp', o: 0, inicial: { modelo: 'opa5' }, campos: [{ id: 'modelo', etiqueta: 'Modelo', tipo: 'modelo', familia: 'OA5' }], claves: 'opamp raíles alimentacion' },
  {
    id: 'T555',
    nombre: 'Temporizador 555',
    grupo: 'Integrados',
    prefijo: 'U',
    rol: 'X',
    clase: 'Ic',
    o: 0,
    inicial: { modelo: 'ne555' },
    campos: [{ id: 'modelo', etiqueta: 'Modelo', tipo: 'modelo', familia: 'T555', ayuda: 'Modelo de comportamiento: comparadores a 1/3 y 2/3 de Vcc, biestable, salida y transistor de descarga.' }],
    claves: '555 ne555 temporizador timer astable monoestable',
  },
  puertaDigital('DAND', 'Puerta AND', 'and y'),
  puertaDigital('DOR', 'Puerta OR', 'or o'),
  puertaDigital('DNAND', 'Puerta NAND', 'nand'),
  puertaDigital('DNOR', 'Puerta NOR', 'nor'),
  puertaDigital('DXOR', 'Puerta XOR', 'xor o exclusiva'),
  puertaDigital('DNOT', 'Inversor (NOT)', 'not inversor negador'),
  { id: 'DFF', nombre: 'Biestable D', grupo: 'Digital', prefijo: 'U', rol: 'X', clase: 'Ic', o: 0, inicial: { retardo: '10n', ic: '0' }, campos: CAMPOS_BIESTABLE, claves: 'xspice digital flip-flop biestable d registro' },
  { id: 'DJK', nombre: 'Biestable JK', grupo: 'Digital', prefijo: 'U', rol: 'X', clase: 'Ic', o: 0, inicial: { retardo: '10n', ic: '0' }, campos: CAMPOS_BIESTABLE, claves: 'xspice digital flip-flop biestable jk contador' },
  {
    id: 'DCLK',
    nombre: 'Reloj digital',
    grupo: 'Digital',
    prefijo: 'CLK',
    rol: 'X',
    clase: 'Ic',
    o: 0,
    inicial: { freq: '1Meg', ciclo: '50' },
    campos: [
      { id: 'freq', etiqueta: 'Frecuencia', tipo: 'valor', unidad: 'Hz', ayuda: `Oscilador digital d_osc: empieza en 0 y pasa a 1 al acabar la parte baja del primer periodo (en T/2 con un ciclo del 50 %). ${AYUDA_DIGITAL}` },
      { id: 'ciclo', etiqueta: 'Ciclo de trabajo (%)', tipo: 'valor', unidad: '%' },
    ],
    claves: 'xspice digital reloj clock oscilador d_osc',
  },
  {
    id: 'ADC',
    nombre: 'Puente analógico → digital',
    grupo: 'Digital',
    prefijo: 'U',
    rol: 'X',
    clase: 'Ic',
    o: 0,
    inicial: { bajo: '2,4', alto: '2,6' },
    campos: [
      { id: 'bajo', etiqueta: 'Umbral del 0 (por debajo)', tipo: 'valor', unidad: 'V', ayuda: 'adc_bridge: por debajo de este valor la salida es 0, por encima del umbral del 1 es 1; entre ambos, desconocida.' },
      { id: 'alto', etiqueta: 'Umbral del 1 (por encima)', tipo: 'valor', unidad: 'V' },
    ],
    claves: 'xspice digital adc puente bridge conversor entrada',
  },
  {
    id: 'DAC',
    nombre: 'Puente digital → analógico',
    grupo: 'Digital',
    prefijo: 'U',
    rol: 'X',
    clase: 'Ic',
    o: 0,
    inicial: { bajo: '0', alto: '5', flanco: '1n' },
    campos: [
      { id: 'bajo', etiqueta: 'Tensión del 0', tipo: 'valor', unidad: 'V', ayuda: 'dac_bridge: la salida analógica de una red digital, para medirla o dibujarla.' },
      { id: 'alto', etiqueta: 'Tensión del 1', tipo: 'valor', unidad: 'V' },
      { id: 'flanco', etiqueta: 'Tiempo de subida y bajada', tipo: 'valor', unidad: 's' },
    ],
    claves: 'xspice digital dac puente bridge conversor salida',
  },
  {
    id: 'SW',
    nombre: 'Interruptor',
    grupo: 'Pasivos',
    prefijo: 'S',
    rol: 'SW',
    clase: 'Switch',
    o: 0,
    inicial: { estado: 'cerrado' },
    campos: [{ id: 'estado', etiqueta: 'Estado', tipo: 'opcion', opciones: [['cerrado', 'Cerrado (1 mΩ)'], ['abierto', 'Abierto (1 GΩ)']] }],
    claves: 'pulsador conmutador',
  },
  { id: 'GND', nombre: 'Masa', grupo: 'Conexiones', prefijo: '', rol: 'GND', clase: 'Ground', o: 0, inicial: {}, campos: [], claves: 'tierra gnd 0' },
  { id: 'RIEL', nombre: 'Alimentación', grupo: 'Conexiones', prefijo: '', rol: 'RAIL', clase: 'Vdd', o: 0, inicial: { red: 'vcc' }, campos: [{ id: 'red', etiqueta: 'Nombre de la red', tipo: 'red', ayuda: 'Todos los símbolos con el mismo nombre están unidos.' }], claves: 'vcc vdd raíl' },
  { id: 'ETQ', nombre: 'Etiqueta de red', grupo: 'Conexiones', prefijo: '', rol: 'RAIL', clase: 'Label', o: 0, inicial: { red: 'out' }, campos: [{ id: 'red', etiqueta: 'Nombre de la red', tipo: 'red', ayuda: 'Da nombre al nodo (v(out) en las gráficas) y une los puntos con la misma etiqueta.' }], claves: 'nombre nodo red' },
  { id: 'SONDA', nombre: 'Sonda de tensión', grupo: 'Medida', prefijo: 'SV', rol: 'ANOT', clase: 'Probe', o: 0, inicial: {}, campos: [], claves: 'voltimetro sonda tension grafica' },
  { id: 'VM', nombre: 'Voltímetro entre dos puntos', grupo: 'Medida', prefijo: 'VM', rol: 'ANOT', clase: 'MeterV', o: 3, inicial: {}, campos: [], claves: 'voltimetro diferencial' },
  { id: 'AMP', nombre: 'Amperímetro', grupo: 'Medida', prefijo: 'AM', rol: 'AM', clase: 'MeterA', o: 0, inicial: {}, campos: [], claves: 'corriente amperimetro' },
];

export const TIPO = new Map(TIPOS.map((t) => [t.id, t]));
/** The kind of an imported part kept as its SPICE line. */
export const TIPO_GEN: Tipo = { id: 'GEN', nombre: 'Componente importado', grupo: 'Integrados', prefijo: 'X', rol: 'X', clase: 'Box', o: 0, inicial: {}, campos: [{ id: 'resto', etiqueta: 'Resto de la línea SPICE', tipo: 'texto' }] };

export function tipoDe(c: Componente): Tipo {
  return TIPO.get(c.tipo) ?? TIPO_GEN;
}

/** XSPICE gate kinds → IEC symbol kind and code model. */
export const PUERTAS_DIGITALES: Record<string, { iec: string; modelo: string }> = {
  DAND: { iec: 'AND', modelo: 'd_and' },
  DOR: { iec: 'OR', modelo: 'd_or' },
  DNAND: { iec: 'NAND', modelo: 'd_nand' },
  DNOR: { iec: 'NOR', modelo: 'd_nor' },
  DXOR: { iec: 'XOR', modelo: 'd_xor' },
  DNOT: { iec: 'NOT', modelo: 'd_inverter' },
};

/** Box pins of the other digital parts: [pin name, label drawn in the box]. */
export const PINES_DIGITALES: Record<string, [string, string][]> = {
  DFF: [['d', 'D'], ['clk', 'C'], ['set', 'S'], ['reset', 'R'], ['q', 'Q'], ['nq', 'nQ']],
  DJK: [['j', 'J'], ['k', 'K'], ['clk', 'C'], ['set', 'S'], ['reset', 'R'], ['q', 'Q'], ['nq', 'nQ']],
  ADC: [['in', 'in'], ['out', 'out']],
  DAC: [['in', 'in'], ['out', 'out']],
  DCLK: [['out', 'out']],
};
const TITULO_DIGITAL: Record<string, string> = { DFF: 'DFF', DJK: 'JKFF', ADC: 'ADC', DAC: 'DAC', DCLK: 'CLK' };

/** Pins of the 555 in the order of its netlist line (DIP pins 1–8) with the label drawn in the box. */
export const PINES_555: [string, string][] = [
  ['gnd', 'GND'],
  ['trig', 'TRIG'],
  ['out', 'OUT'],
  ['reset', 'RESET'],
  ['ctrl', 'CTRL'],
  ['thres', 'THR'],
  ['dis', 'DIS'],
  ['vcc', 'VCC'],
];

/** Kinds that are not parts of the netlist (connections and probes). */
export const SIN_LINEA = new Set(['GND', 'RIEL', 'ETQ', 'SONDA']);
export const ES_CONEXION = new Set(['GND', 'RIEL', 'ETQ']);

// ------------------------------------------------------------------ symbols

function disp(simbolo: string, pines: string[], extra: Partial<Dispositivo> = {}): Dispositivo {
  return {
    nombre: '',
    clave: '',
    letra: '',
    simbolo: simbolo as Dispositivo['simbolo'],
    rol: '',
    clase: '',
    pines: pines.map((nombre) => ({ nombre, nodo: '' })),
    valor: '',
    extra: '',
    numero: null,
    unidad: '',
    modelo: null,
    linea: 0,
    ...extra,
  };
}

function texto(c: Pt, s: string, tam = 0.4): Prim {
  return { t: 'texto', c, s, ancla: 'middle', tam };
}

function masa(): DefSimbolo {
  return {
    pines: { start: { x: 0, y: 0, dx: 0, dy: -1 } },
    cuerpo: [-0.3, 0.05, 0.3, 0.72],
    patas: [],
    prims: [
      { t: 'l', p: [[0, 0], [0, 0.45]] },
      { t: 'l', p: [[-0.3, 0.45], [0.3, 0.45]] },
      { t: 'l', p: [[-0.19, 0.57], [0.19, 0.57]] },
      { t: 'l', p: [[-0.08, 0.69], [0.08, 0.69]] },
    ],
    etq: { x: 0.35, y: 0.45, dx: 1, dy: 0 },
    dos: false,
  };
}

function riel(): DefSimbolo {
  return {
    pines: { start: { x: 0, y: 0, dx: 0, dy: 1 } },
    cuerpo: [-0.3, -0.55, 0.3, -0.05],
    patas: [],
    prims: [
      { t: 'l', p: [[0, 0], [0, -0.5]] },
      { t: 'l', p: [[-0.3, -0.5], [0.3, -0.5]] },
    ],
    etq: { x: 0, y: -0.58, dx: 0, dy: -1 },
    dos: false,
  };
}

function etiquetaRed(): DefSimbolo {
  return {
    pines: { start: { x: 0, y: 0, dx: -1, dy: 0 } },
    cuerpo: [-0.1, -0.12, 0.25, 0.12],
    patas: [],
    prims: [
      { t: 'l', p: [[0, 0], [0.18, 0]] },
      { t: 'c', c: [0.18, 0], r: 0.07, relleno: 'tinta' },
    ],
    etq: { x: 0.28, y: 0, dx: 1, dy: 0 },
    dos: false,
  };
}

function sonda(): DefSimbolo {
  return {
    pines: { start: { x: 0, y: 0, dx: 0, dy: 1 } },
    cuerpo: [-0.32, -1.24, 0.32, -0.6],
    patas: [],
    prims: [{ t: 'l', p: [[0, 0], [0, -0.6]] }, { t: 'c', c: [0, -0.92], r: 0.32, relleno: 'fondo' }, texto([0, -0.92], 'V', 0.38)],
    etq: { x: 0.36, y: -0.92, dx: 1, dy: 0 },
    dos: false,
  };
}

function medidor(letra: string, signos: boolean): DefSimbolo {
  const prims: Prim[] = [
    { t: 'l', p: [[0, 0], [0.6, 0]] },
    { t: 'l', p: [[1.4, 0], [2, 0]] },
    { t: 'c', c: [1, 0], r: 0.4, relleno: 'fondo' },
    texto([1, 0], letra, 0.42),
  ];
  if (signos) prims.push({ t: 'signo', c: [1.62, -0.28], s: '+' });
  return {
    pines: { start: { x: 0, y: 0, dx: -1, dy: 0 }, end: { x: 2, y: 0, dx: 1, dy: 0 } },
    cuerpo: [0.6, -0.4, 1.4, 0.4],
    patas: [
      [[0, 0], [0.6, 0]],
      [[1.4, 0], [2, 0]],
    ],
    prims,
    etq: { x: 1, y: -0.42, dx: 0, dy: -1 },
    dos: true,
  };
}

function potenciometro(): DefSimbolo {
  return {
    pines: { start: { x: 0, y: 0, dx: -1, dy: 0 }, end: { x: 2, y: 0, dx: 1, dy: 0 }, tap: { x: 1, y: 1, dx: 0, dy: 1 } },
    cuerpo: [0.5, -0.18, 1.5, 0.18],
    patas: [
      [[0, 0], [0.5, 0]],
      [[1.5, 0], [2, 0]],
      [[1, 1], [1, 0.2]],
    ],
    prims: [
      { t: 'l', p: [[0, 0], [0.5, 0]] },
      { t: 'l', p: [[1.5, 0], [2, 0]] },
      { t: 'l', p: [[0.5, -0.18], [1.5, -0.18], [1.5, 0.18], [0.5, 0.18]], cerrado: true },
      { t: 'l', p: [[1, 1], [1, 0.38]] },
      { t: 'l', p: [[1, 0.2], [0.9, 0.4], [1.1, 0.4]], cerrado: true, relleno: 'tinta' },
    ],
    etq: { x: 1, y: -0.2, dx: 0, dy: -1 },
    dos: true,
  };
}

/** Controlled source with its control pins: output «p» (+) at the top, «n» at the bottom; control on the left. */
function controlada(tension: boolean): DefSimbolo {
  const prims: Prim[] = [
    { t: 'l', p: [[2, -2], [2, -0.5]] },
    { t: 'l', p: [[2, 0.5], [2, 2]] },
    { t: 'l', p: [[2, -0.5], [2.5, 0], [2, 0.5], [1.5, 0]], cerrado: true, relleno: 'fondo' },
    { t: 'l', p: [[0, -1], [0.55, -1]] },
    { t: 'l', p: [[0, 1], [0.55, 1]] },
    { t: 'c', c: [0.62, -1], r: 0.07, relleno: 'fondo' },
    { t: 'c', c: [0.62, 1], r: 0.07, relleno: 'fondo' },
    { t: 'signo', c: [0.62, -0.62], s: '+' },
    { t: 'signo', c: [0.62, 0.62], s: '-' },
  ];
  if (tension) prims.push({ t: 'signo', c: [2, -0.2], s: '+' }, { t: 'signo', c: [2, 0.24], s: '-' });
  else prims.push({ t: 'l', p: [[2, 0.28], [2, -0.18]] }, { t: 'l', p: [[2, -0.32], [1.9, -0.14], [2.1, -0.14]], cerrado: true, relleno: 'tinta' });
  return {
    pines: {
      p: { x: 2, y: -2, dx: 0, dy: -1 },
      n: { x: 2, y: 2, dx: 0, dy: 1 },
      cp: { x: 0, y: -1, dx: -1, dy: 0 },
      cn: { x: 0, y: 1, dx: -1, dy: 0 },
    },
    cuerpo: [1.5, -0.5, 2.5, 0.5],
    patas: [],
    prims,
    etq: { x: 2.55, y: 0, dx: 1, dy: 0 },
    dos: false,
  };
}

/** The esquema-auto device that draws an imported part. */
export function dispositivoImportado(c: Componente): Dispositivo {
  const f = c.forma!;
  return disp(f.simbolo, [], {
    pines: f.pines.map((p) => ({ nombre: p.nombre, nodo: '', rotulo: p.rotulo })),
    titulo: f.titulo,
    bobinas: f.bobinas?.map((k) => disp('L', [], { clave: k })),
    diodos: f.diodos?.map((x) => ({ d: disp('D', [], { nombre: x.nombre }), anodo: x.anodo, catodo: x.catodo })),
  });
}

function formaFuente(c: Componente, corriente: boolean): string {
  const f = c.campos['forma'] ?? 'dc';
  if (corriente) return f === 'sin' ? 'ISIN' : f === 'pulse' ? 'IPULSO' : 'IDC';
  return f === 'sin' ? 'VSIN' : f === 'pulse' ? 'VPULSO' : f === 'pwl' ? 'VPWL' : 'VDC';
}

/** Symbol of a part (cached by its shape: kind, waveform, variant). */
const cacheDef = new Map<string, DefSimbolo>();
export function claveForma(c: Componente): string {
  if (c.tipo === 'GEN') return `GEN|${JSON.stringify(c.forma)}|${c.v ?? 0}`;
  if (c.tipo === 'V' || c.tipo === 'VSIN' || c.tipo === 'VPULSE' || c.tipo === 'I') return `${c.tipo}|${c.campos['forma'] ?? 'dc'}`;
  if (c.tipo === 'OA' || c.tipo === 'OA5') return `${c.tipo}|${c.v ?? 0}`;
  return c.tipo;
}

export function defDe(c: Componente): DefSimbolo {
  const k = claveForma(c);
  let d = cacheDef.get(k);
  if (!d) {
    d = construirDef(c);
    cacheDef.set(k, d);
  }
  return d;
}

function construirDef(c: Componente): DefSimbolo {
  const dos = ['start', 'end'];
  switch (c.tipo) {
    case 'R':
      return simboloDe(disp('R', dos));
    case 'C':
      return simboloDe(disp('C', dos));
    case 'L':
      return simboloDe(disp('L', dos));
    case 'POT':
      return potenciometro();
    case 'TRAFO':
      return simboloDe(disp('TRAFO', [], { bobinas: [disp('L', [], { clave: 'p' }), disp('L', [], { clave: 's' })] }));
    case 'V':
    case 'VSIN':
    case 'VPULSE':
      return simboloDe(disp(formaFuente(c, false), dos));
    case 'I':
      return simboloDe(disp(formaFuente(c, true), dos));
    case 'E':
      return controlada(true);
    case 'G':
      return controlada(false);
    case 'D':
      return simboloDe(disp('D', dos));
    case 'DZ':
      return simboloDe(disp('DZ', dos));
    case 'LED':
      return simboloDe(disp('LED', dos));
    case 'DS':
      return simboloDe(disp('DS', dos));
    case 'QN':
      return simboloDe(disp('NPN', ['base', 'collector', 'emitter']));
    case 'QP':
      return simboloDe(disp('PNP', ['base', 'collector', 'emitter']));
    case 'MN':
      return simboloDe(disp('NMOS', ['gate', 'drain', 'source']));
    case 'MP':
      return simboloDe(disp('PMOS', ['gate', 'drain', 'source']));
    case 'JN':
      return simboloDe(disp('NJF', ['gate', 'drain', 'source']));
    case 'JP':
      return simboloDe(disp('PJF', ['gate', 'drain', 'source']));
    case 'OA':
      return simboloDe(disp('OPAMP', ['in1', 'in2', 'out']), c.v ?? 0);
    case 'OA5':
      return simboloDe(disp('OPAMP', ['in1', 'in2', 'out', 'vd', 'vs']), c.v ?? 0);
    case 'SW':
      return simboloDe(disp('SW', dos));
    case 'DAND':
    case 'DOR':
    case 'DNAND':
    case 'DNOR':
    case 'DXOR':
    case 'DNOT':
      return simboloDe(disp('PUERTA', c.tipo === 'DNOT' ? ['a', 'y'] : ['a', 'b', 'y'], { titulo: PUERTAS_DIGITALES[c.tipo]!.iec }));
    case 'DFF':
    case 'DJK':
    case 'ADC':
    case 'DAC':
    case 'DCLK':
      return simboloDe(
        disp('CAJA', [], {
          pines: PINES_DIGITALES[c.tipo]!.map(([nombre, rotulo]) => ({ nombre, nodo: '', rotulo })),
          titulo: TITULO_DIGITAL[c.tipo],
        }),
      );
    case 'T555':
      return simboloDe(disp('CAJA', [], { pines: PINES_555.map(([nombre, rotulo]) => ({ nombre, nodo: '', rotulo })), titulo: '555' }));
    case 'GND':
      return masa();
    case 'RIEL':
      return riel();
    case 'ETQ':
      return etiquetaRed();
    case 'SONDA':
      return sonda();
    case 'VM':
      return medidor('V', true);
    case 'AMP':
      return medidor('A', false);
    default:
      if (c.forma) return simboloDe(dispositivoImportado(c), c.v ?? 0);
      return medidor('?', false);
  }
}

/** Pin names of a part, in the symbol's order. */
export function pinesDe(c: Componente): string[] {
  return Object.keys(defDe(c).pines);
}

// ------------------------------------------------------------------ label

/** Value text shown next to the symbol («4,7 kΩ», «∿ 1 V · 1 kHz», «D1N4148»). */
export function textoValor(c: Componente): string {
  const f = c.campos;
  const num = (k: string, u: string) => {
    const l = leerValor(f[k] ?? '', u);
    return l.ok && l.v != null ? formatoCorto(l.v, u) : (f[k] ?? '').trim();
  };
  switch (c.tipo) {
    case 'R':
    case 'POT':
      return num('valor', 'Ω');
    case 'C':
      return num('valor', 'F');
    case 'L':
      return num('valor', 'H');
    case 'TRAFO':
      return `${num('lp', 'H')} : ${num('ls', 'H')}`;
    case 'E':
      return `×${num('valor', '')}`;
    case 'G':
      return num('valor', 'S');
    case 'V':
    case 'VSIN':
    case 'VPULSE':
    case 'I': {
      const u = c.tipo === 'I' ? 'A' : 'V';
      const forma = f['forma'] ?? 'dc';
      if (forma === 'sin') return `∿ ${num('va', u)} · ${num('freq', 'Hz')}`;
      if (forma === 'pulse') {
        const per = leerValor(f['per'] ?? '', 's');
        const fr = per.ok && per.v ? ` · ${formatoCorto(1 / per.v, 'Hz')}` : '';
        return `${num('v1', u).replace(/\s.*$/, '')}/${num('v2', u)}${fr}`;
      }
      if (forma === 'pwl') return 'PWL';
      if (forma === 'texto') return (f['spec'] ?? '').slice(0, 18);
      return f['dc']?.trim() ? num('dc', u) : f['ac']?.trim() ? `AC ${num('ac', u)}` : '';
    }
    case 'SW':
      return f['estado'] === 'abierto' ? 'abierto' : 'cerrado';
    case 'DAND':
    case 'DOR':
    case 'DNAND':
    case 'DNOR':
    case 'DXOR':
    case 'DNOT':
    case 'DFF':
    case 'DJK':
      return num('retardo', 's');
    case 'DCLK':
      return num('freq', 'Hz');
    case 'ADC':
      return `${num('bajo', 'V').replace(/\s.*$/, '')}/${num('alto', 'V')}`;
    case 'DAC':
      return `${num('bajo', 'V').replace(/\s.*$/, '')}/${num('alto', 'V')}`;
    case 'RIEL':
    case 'ETQ':
      return f['red'] ?? '';
    case 'GND':
    case 'SONDA':
    case 'VM':
    case 'AMP':
      return '';
    case 'GEN':
      return c.forma?.simbolo === 'OPAMP' || c.forma?.simbolo === 'CAJA' ? (c.forma.titulo ?? '') : resumenResto(c);
    default:
      return f['modelo'] ?? '';
  }
}

function resumenResto(c: Componente): string {
  const r = (c.spice?.resto ?? '').trim();
  return r.length > 16 ? r.slice(0, 15) + '…' : r;
}
