// «Ver en protoboard»: which circuit the full-screen breadboard shows (App.svelte loads its chunk only
// when one is opened). It is an overlay of ruta.svelte.ts: «Atrás» (or its close button) returns to the
// schematic exactly as it was; nothing of the sandbox is kept unless it is saved as an own circuit.

import type { DocumentoEsquema } from '../componentes/editor/tipos';
import type { OrigenProtoboard } from '../componentes/protoboard/tipos';
import { abrirCapa, cerrarCapa } from './ruta.svelte';

export type FuenteProtoboard =
  /** A netlist text: a book netlist, the simulator's page as it is, the free netlist. */
  | { tipo: 'netlist'; texto: string; titulo: string; origen: OrigenProtoboard; refs?: string[] }
  /** A drawing of the schematic editor. */
  | { tipo: 'documento'; doc: DocumentoEsquema; titulo: string }
  /** The schematic of a book figure (datos/NAME.json, esquemas[indice]). */
  | { tipo: 'figura'; ruta: string; indice: number; titulo: string; label: string };

export const capaProtoboard = $state({ fuente: null as FuenteProtoboard | null, n: 0 });

const CAPA = 'protoboard';

export function abrirProtoboard(f: FuenteProtoboard): void {
  if (capaProtoboard.fuente) return;
  capaProtoboard.fuente = f;
  capaProtoboard.n++;
  abrirCapa(CAPA, () => (capaProtoboard.fuente = null));
}

export function cerrarProtoboard(): void {
  if (capaProtoboard.fuente) cerrarCapa(CAPA);
}
