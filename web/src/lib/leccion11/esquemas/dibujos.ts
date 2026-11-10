// 1.1 lessons, in the app: every schematic folder's drawing (<nombre>/Dibujo.svelte) by name, and the definitions
// registered (definiciones.ts). The drawing receives the props of PropsDibujo.

import type { Component } from 'svelte';
import './definiciones';
import { carpetaDe } from './registro';
import type { ContextoDibujo } from './tipos';
import type { WidgetCircuito } from '../tipos';

export interface PropsDibujo {
  c: ContextoDibujo;
  widget: WidgetCircuito;
  /** Seconds per lap of the moving current for a current (A): faster with more current, still with reduced motion. */
  vuelta: (i: number | undefined) => number;
  /** Seconds per lap of the widget's «corriente». */
  dur: number;
  /** The screen-reader description (role="img" label of the drawing). */
  descripcion: string;
}

const modulos = import.meta.glob<Component<PropsDibujo>>('./*/Dibujo.svelte', { eager: true, import: 'default' });
const dibujos = new Map(Object.entries(modulos).map(([ruta, d]) => [carpetaDe(ruta), d]));

export function dibujoDe(nombre: string): Component<PropsDibujo> | undefined {
  return dibujos.get(nombre);
}
