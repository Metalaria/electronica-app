// Lazy loaders of the scenes (each animation is its own chunk, fetched when opened).

import type { Component } from 'svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cargador = () => Promise<{ default: Component<any> }>;

export const CARGADORES: Record<string, Cargador> = {
  'union-pn': () => import('./escenas/UnionPN.svelte'),
  'diodo-polarizacion': () => import('./escenas/DiodoPolarizacion.svelte'),
  'resistencia-construccion': () => import('./escenas/ResistenciaConstruccion.svelte'),
  'resistencia-ohm': () => import('./escenas/ResistenciaOhm.svelte'),
  'resistencia-potencia': () => import('./escenas/ResistenciaPotencia.svelte'),
  'codigo-colores': () => import('./escenas/CodigoColores.svelte'),
  potenciometro: () => import('./escenas/Potenciometro.svelte'),
  'sensores-resistivos': () => import('./escenas/SensoresResistivos.svelte'),
  'condensador-placas': () => import('./escenas/CondensadorPlacas.svelte'),
  'condensador-ceramico': () => import('./escenas/CondensadorCeramico.svelte'),
  'condensador-electrolitico': () => import('./escenas/CondensadorElectrolitico.svelte'),
  'condensador-pelicula': () => import('./escenas/CondensadorPelicula.svelte'),
  supercondensador: () => import('./escenas/Supercondensador.svelte'),
  'rc-carga': () => import('./escenas/RcCarga.svelte'),
  'condensador-alterna': () => import('./escenas/CondensadorAlterna.svelte'),
  'esr-autorresonancia': () => import('./escenas/EsrAutorresonancia.svelte'),
  'bobina-lenz': () => import('./escenas/BobinaLenz.svelte'),
  'nucleo-saturacion': () => import('./escenas/NucleoSaturacion.svelte'),
  transformador: () => import('./escenas/Transformador.svelte'),
  'rele-flyback': () => import('./escenas/ReleFlyback.svelte'),
  zener: () => import('./escenas/Zener.svelte'),
  led: () => import('./escenas/Led.svelte'),
  fotodiodo: () => import('./escenas/Fotodiodo.svelte'),
  schottky: () => import('./escenas/Schottky.svelte'),
  rectificador: () => import('./escenas/Rectificador.svelte'),
  'bjt-portadores': () => import('./escenas/BjtPortadores.svelte'),
  'bjt-curvas': () => import('./escenas/BjtCurvas.svelte'),
  'mosfet-canal': () => import('./escenas/MosfetCanal.svelte'),
  'mosfet-curvas': () => import('./escenas/MosfetCurvas.svelte'),
  'mosfet-puerta': () => import('./escenas/MosfetPuerta.svelte'),
  'cmos-inversor': () => import('./escenas/CmosInversor.svelte'),
  jfet: () => import('./escenas/Jfet.svelte'),
  tiristor: () => import('./escenas/Tiristor.svelte'),
  fusible: () => import('./escenas/Fusible.svelte'),
  supresor: () => import('./escenas/Supresor.svelte'),
  optoacoplador: () => import('./escenas/Optoacoplador.svelte'),
  cristal: () => import('./escenas/Cristal.svelte'),
  hall: () => import('./escenas/Hall.svelte'),
  opamp: () => import('./escenas/Opamp.svelte'),
};

export function disponible(id: string): boolean {
  return id in CARGADORES;
}
