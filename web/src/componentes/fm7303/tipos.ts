// Types of web/public/fm7303/kit.json (written by contenido/fm7303.py).

import type { Correspondencia, Esquema } from '../figuras-vivas/tipos';

export interface Cita {
  /** Book label (sec-16.11.2, fig-16.28…). */
  ref: string;
  /** Printed number («15.11.2», «15.28»). */
  num: string | null;
  tipo: string | null;
  /** Literal quote (checked against cap16.typ at build time) or, for figures, what the figure shows. */
  texto: string;
}

export interface FichaComponente {
  id: string;
  funcion: string;
  seccion: string;
  num: string;
  animacion: string | null;
  bloque: number;
  valor: string | null;
}

export interface Bloque {
  nombre: string;
  color: string;
  seccion: string;
  num: string;
  caja: [number, number, number, number];
}

export interface PuntoMapa {
  id: string;
  nombre: string;
  red: string;
  nodo: string;
  pieza?: string;
  pin?: string;
  esperado: number;
  tol: number;
  aprox?: boolean;
  cita: string;
}

export interface PuntoPrueba {
  id: 'TP1' | 'TP2' | 'TP3' | 'TP4';
  red: string;
  nodo: string;
  xy: [number, number];
  que: string;
  pregunta: string;
  esperado: string;
  cita: string;
  instrumento: 'multimetro' | 'osciloscopio';
  ajustes: [string, string][];
}

export interface Etapa {
  id: string;
  nombre: string;
  bloque: number;
  senal: string;
  cita: string;
  trazos: [number, number][][];
  piezas: string[];
}

export interface Paso {
  id: string;
  seccion: string;
  titulo: string;
  cita: string;
  texto: string;
}

export interface EfectoAveria {
  antena?: boolean;
  front_end?: boolean;
  display?: boolean;
  w1?: number;
  w3?: number;
  l1?: number;
  decodificador?: boolean;
  canal_r?: boolean;
  oscilador?: boolean;
  alimentacion?: boolean;
}

export interface Averia {
  id: string;
  titulo: string;
  pieza: string;
  aceptar: string[];
  cita: string;
  sintoma: string;
  explicacion: string;
  dc: Record<string, string | number>;
  senal: EfectoAveria;
}

export interface EmisoraSimulada {
  f: number;
  nivel: number;
  estereo: boolean;
  nombre: string;
}

export interface ModeloDC {
  plantilla: string;
  parametros: Record<string, string | number>;
  correspondencia: Correspondencia;
  sin_modelo: string[];
  sin_modelo_segun: Record<string, string>;
}

export interface Kit {
  version: number;
  vista: [number, number, number, number];
  esquema: Esquema & { nodos: (Esquema['nodos'][number] & { red: string })[] };
  modelo: ModeloDC;
  citas: Record<string, Cita>;
  componentes: Record<string, FichaComponente>;
  bloques: Record<string, Bloque>;
  mapa: PuntoMapa[];
  tps: PuntoPrueba[];
  etapas: Etapa[];
  pasos: Paso[];
  averias: Averia[];
  emisoras: EmisoraSimulada[];
  constantes: Record<string, { valor: number | number[]; origen: 'libro' | 'modelo'; cita?: string; nota?: string }>;
}
