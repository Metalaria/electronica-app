// Types of a guided practice on the test bench.

import type { Banco } from '../banco.svelte.ts';
import type { Borne } from '../motor/dmm.ts';
import type { Dds } from '../motor/generador.ts';
import type { Disparo } from '../motor/osciloscopio.ts';
import type { Matematica, Cursores, Modo } from '../fnirsi/logica.svelte.ts';

export interface AjusteCanal {
  on?: boolean;
  vDiv?: number;
  pos?: number;
  ac?: boolean;
  x10?: boolean;
  invertir?: boolean;
}

/** Instrument settings and connections that a step applies (everything optional). */
export interface Ajustes {
  variante?: string;
  alimentado?: boolean;
  bm?: {
    pos?: string;
    sub?: number;
    borne?: Borne;
    rojo?: string | null;
    negro?: string | null;
    serie?: { elemento: string; terminal: number } | null;
  };
  fnDmm?: { funcion?: string; borne?: Borne; rojo?: string | null; negro?: string | null; serie?: { elemento: string; terminal: number } | null };
  sondas?: { ch1?: string | null; ch2?: string | null; masa?: string };
  fn?: {
    modo?: Modo;
    ch?: [AjusteCanal | null, AjusteCanal | null];
    sDiv?: number;
    hpos?: number;
    disparo?: Partial<Disparo>;
    mates?: Matematica;
    cursores?: Cursores;
    cur?: { a: number; b: number };
    xy?: boolean;
    prm?: boolean;
    dds?: Partial<Dds>;
    run?: boolean;
  };
  /** Parameter values (ids of the simulator's sliders: «r1», «v1.dc», «param:vcc»). */
  parametros?: Record<string, number>;
}

export interface Variante {
  id: string;
  nombre: string;
  /** Key in CIRCUITOS. */
  circuito: string;
  /** Source driven by the DDS generator. */
  generador?: string;
  /** Book figure with schematic data: «22.1» → fig/22.1.svg + datos/22.1.json; mapa: figure node → net node. */
  figura?: { num: string; mapa: Record<string, string> };
  /** Key in DIBUJOS when the app draws the circuit. */
  dibujo?: string;
  asentamiento?: number;
  dinamico?: boolean;
}

export interface Paso {
  /** HTML (strong, em, sub, sup only). */
  texto: string;
  aplicar?: Ajustes;
}

export interface Comprobacion {
  id: string;
  /** What is measured. */
  que: string;
  /** Where to read it on the instrument. */
  donde: string;
  esperado: number;
  unidad: string;
  /** Tolerance: relative (0.02 = 2 %) or absolute in the unit. */
  tol: { rel?: number; abs?: number };
  /** The book's statement of the expected value. */
  libro: string;
  medir: (b: Banco) => number | null;
}

export interface ColumnaTabla {
  id: string;
  nombre: string;
  unidad: string;
}

export interface Tabla {
  titulo: string;
  columnas: ColumnaTabla[];
  /** Values to note from the instruments now (or null with a reason). */
  anotar: (b: Banco) => Record<string, number> | string;
  grafica?: { x: string; y: string; xLog?: boolean; yLog?: boolean; teoria?: (x: number) => number; nombreTeoria?: string };
}

export interface Practica {
  n: number;
  /** Book section label (sec-22.x). */
  label: string;
  titulo: string;
  objetivo: string;
  variantes: Variante[];
  inicial: Ajustes;
  pasos: Paso[];
  comprobaciones: Comprobacion[];
  tabla?: Tabla;
  /** Closing remark from the book. */
  leccion: string;
}
