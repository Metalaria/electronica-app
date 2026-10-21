// Types of web/public/libro/spice.json (written by contenido/spice.py; format in ESQUEMA.md).

import type { CampoParametro, TipoParametro, TipoAnalisis } from './motor/netlist.ts';

export interface ParametroSpice {
  id: string;
  elemento: string;
  subckt: string | null;
  campo: CampoParametro;
  tipo: TipoParametro;
  valor: number;
  texto: string;
  unidad: string;
  min: number;
  max: number;
  e12: boolean;
  linea: number;
}

export type EstadoMotor = 'ok' | 'errores' | 'fallo' | 'tiempo' | 'no-disponible' | 'sin-validar';

export interface NetlistSpice {
  fichero: string;
  parte: string;
  nombre: string;
  titulo: string;
  ref: string | null;
  refs: string[];
  descripcion: string;
  analisis: TipoAnalisis[];
  control: boolean;
  parametros: ParametroSpice[];
  motor: {
    estado: EstadoMotor;
    ms?: number | null;
    medidas?: number;
    graficas?: number;
    errores?: string[];
    pesada?: boolean;
    nota?: string;
  };
}

export interface CapituloSpice {
  parte: string;
  tipo: string;
  num: string | null;
  titulo: string;
  color: string | null;
  tomo: string | null;
  netlists: string[];
}

export interface IndiceSpice {
  version: number;
  motor: { paquete: string; version?: string };
  total: number;
  capitulos: CapituloSpice[];
  netlists: Record<string, NetlistSpice>;
  porRef: Record<string, string[]>;
}
