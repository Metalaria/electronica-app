// 1.2.1 «aprender haciendo» (piloto121, contenido/lecciones11/GUIA.md §13): the pieces that let a card be answered
// by DOING on the live widget instead of choosing an option —
//   - an instrument on a live circuit (a multimeter: V between two nodes, A by opening a branch; an oscilloscope probe)
//     whose reading comes from the schematic's own netlist (lib/leccion12/cc.ts), and the «medir» step (place the
//     probes where you would measure X);
//   - «elegir»: tap a part or a node of the live schematic as the answer;
//   - «objetivo» on an explore, surprise or tuning card: a goal on the model's state that completes the card;
//   - «marcar»: drag a marker on a graph to a target (the −3 dB point, the knee);
//   - «leer»: type the value read on the live widget (checked against the model, with units).
// The data the generator (lib/leccion12/hacer/generar-hacer.ts) writes and the reader's state of it. Types only.

import type { Condicion, Pista, Texto } from '../../leccion11/tipos';
import type { ErrorTipico } from '../tipos';

/** A virtual instrument on a circuit widget (WidgetCircuito.instrumento). */
export interface Instrumento {
  tipo: 'multimetro' | 'osciloscopio';
  /** Multimeter: the modes it offers (V: two probes on two nodes; A: the meter in series in one branch). */
  modos: ('V' | 'A')[];
  /** Nodes of the schematic's netlist the probes can touch, with a neutral name (list, screen readers). */
  puntos: { id: string; rotulo: Texto }[];
  /** Branches the ammeter can open: a 0 V meter source of the netlist (its name, lower case), with a neutral name. */
  ramas: { id: string; rotulo: Texto }[];
  /** Oscilloscope: the curve of the widget's graph each point shows (index of grafica.curvas). */
  curvas?: Record<string, number>;
  /** Where the black (COM) probe starts: a point id (default «0» when it is one of the points). */
  negra?: string;
}

/** Where the reader has put the instrument (EstadoTarjeta.medida; in memory only). */
export interface EstadoMedida {
  modo: 'V' | 'A';
  /** The red probe's node (multimeter V; the oscilloscope's probe). */
  roja: string | null;
  /** The black probe's node (COM). */
  negra: string | null;
  /** The branch the ammeter is in. */
  rama: string | null;
  /** Which probe the next tap on a node places. */
  activa: 'roja' | 'negra';
}

/** «Mida»: put the instrument where X is measured; the placement is the answer. */
export interface Medir {
  tipo: 'medir';
  magnitud: 'tension' | 'corriente' | 'senal';
  /** tension: [red, black] nodes. */
  entre?: [string, string];
  /** corriente: the branch. */
  rama?: string;
  /** senal: the oscilloscope's point. */
  punto?: string;
  /** tension: the probes' order counts (else the reversed pair is right too, its reading negative). */
  polaridad: boolean;
  /** Why each wrong placement is not it: by branch id, by point id (the red probe's, or the pair «a/b»). */
  porque: Record<string, Texto>;
}

/** «Elija en el esquema»: tap the part or node of the live schematic that answers. */
export interface ZonaEsquema {
  /** A piece of the drawing (`data-pieza`: a schematic piece or a drawn part of DefinicionEsquema.partes), or a node «red:n». */
  id: string;
  rotulo: Texto;
}

export interface Elegir {
  tipo: 'elegir';
  zonas: ZonaEsquema[];
  bien: string[];
  /** Every right zone must be chosen (and no wrong one). */
  todas: boolean;
  porque: Record<string, Texto>;
}

/** «Marque en la gráfica»: a marker dragged to a target point of the graph. */
export interface Marcar {
  tipo: 'marcar';
  /** x: a point that rides a curve, moved along x; y: a horizontal line moved along y; xy: a free point. */
  modo: 'x' | 'y' | 'xy';
  /** modo x: the index of the curve it rides. */
  curva?: number;
  /** Targets: expressions of the model (x for modo x and xy; y for modo y and xy). */
  x?: string;
  y?: string;
  /** Tolerance: a fraction of each axis, along its own scale (a log axis: a fraction of its decades). */
  tol: number;
  /** Where the marker starts (axis units). */
  inicio: { x: number; y: number };
  rotulo: Texto;
  /** Keyboard positions along each axis. */
  pasos: number;
}

export interface EstadoMarcar {
  tipo: 'marcar';
  x: number;
  y: number;
  movida: boolean;
}

/** «Lea y escriba»: type a value read on the live widget; checked against the model with its units. */
export interface Leer {
  tipo: 'leer';
  objetivo: string;
  unidad: string;
  cifras: number;
  tol: number;
  rotulo: Texto;
  errores: ErrorTipico[];
}

export interface EstadoLeer {
  tipo: 'leer';
  texto: string;
  valor: number | null;
}

/** «Elija en el esquema» keeps what «tocar» keeps. */
export interface EstadoElegir {
  tipo: 'elegir';
  elegidas: string[];
  descartadas: string[];
}

export type ActividadHacer = Medir | Elegir | Marcar | Leer;
export type EstadoActividadHacer = { tipo: 'medir' } | EstadoElegir | EstadoMarcar | EstadoLeer;

/** «Objetivo» of an explore, surprise or tuning card: reached when every condition holds; then the card is done. */
export interface Objetivo {
  condiciones: Condicion[];
  /** Said when reached (with live values). */
  logrado: Texto;
  /** Live advice while not reached: the first whose `cuando` holds (by the model's state). */
  pistas: Pista[];
}
