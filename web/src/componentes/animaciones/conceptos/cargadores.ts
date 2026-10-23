// Lazy loaders of the concept scenes (each one is its own chunk, fetched when opened).

import type { Component } from 'svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cargador = () => Promise<{ default: Component<any> }>;

export const CARGADORES_CONCEPTOS: Record<string, Cargador> = {
  kirchhoff: () => import('./escenas/Kirchhoff.svelte'),
  'thevenin-norton': () => import('./escenas/TheveninNorton.svelte'),
  superposicion: () => import('./escenas/Superposicion.svelte'),
  'maxima-potencia': () => import('./escenas/MaximaPotencia.svelte'),
  fasores: () => import('./escenas/Fasores.svelte'),
  impedancia: () => import('./escenas/Impedancia.svelte'),
  'transitorio-rlc': () => import('./escenas/TransitorioRlc.svelte'),
  resonancia: () => import('./escenas/Resonancia.svelte'),
  'potencia-alterna': () => import('./escenas/PotenciaAlterna.svelte'),
  fourier: () => import('./escenas/Fourier.svelte'),
  'fft-ventanas': () => import('./escenas/FftVentanas.svelte'),
  'muestreo-aliasing': () => import('./escenas/MuestreoAliasing.svelte'),
  cuantizacion: () => import('./escenas/Cuantizacion.svelte'),
  modulacion: () => import('./escenas/Modulacion.svelte'),
  superheterodino: () => import('./escenas/Superheterodino.svelte'),
  realimentacion: () => import('./escenas/Realimentacion.svelte'),
  'margen-fase': () => import('./escenas/MargenFase.svelte'),
  'bode-polos-ceros': () => import('./escenas/BodePolosCeros.svelte'),
  oscilador: () => import('./escenas/OsciladorWien.svelte'),
  ruido: () => import('./escenas/Ruido.svelte'),
  pid: () => import('./escenas/Pid.svelte'),
  'fuente-lineal': () => import('./escenas/FuenteLineal.svelte'),
  conmutadas: () => import('./escenas/Conmutadas.svelte'),
  pwm: () => import('./escenas/Pwm.svelte'),
  'niveles-logicos': () => import('./escenas/NivelesLogicos.svelte'),
  glitch: () => import('./escenas/Glitch.svelte'),
  metaestabilidad: () => import('./escenas/Metaestabilidad.svelte'),
  reflexiones: () => import('./escenas/Reflexiones.svelte'),
  'onda-estacionaria': () => import('./escenas/OndaEstacionaria.svelte'),
  'adaptacion-smith': () => import('./escenas/AdaptacionSmith.svelte'),
  antena: () => import('./escenas/Antena.svelte'),
  'efecto-pelicular': () => import('./escenas/EfectoPelicular.svelte'),
  'campo-potencial': () => import('./escenas/CampoPotencial.svelte'),
  induccion: () => import('./escenas/Induccion.svelte'),
};
