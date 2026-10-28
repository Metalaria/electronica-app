// A circuit of the schematic editor handed to the bench (0.10): «Medir» in the editor opens
// #/instrumentos/editor with its netlist and its own drawing, whose nodes take the leads and probes. Kept
// in sessionStorage too, so a reload of that page still finds it (a per-tab convenience).

import type { Fuente } from './esquema/Plano.svelte';

export interface CircuitoEditor {
  texto: string;
  titulo: string;
  plano: Fuente | null;
  /** Where «← Editor» goes back to. */
  volver: string;
}

const CLAVE = 'epa:instrumentos-editor';
let pendiente: CircuitoEditor | null = null;

export function medirCircuitoEditor(c: CircuitoEditor): void {
  pendiente = c;
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(c));
  } catch {
    /* private mode: the module copy is enough for this visit */
  }
  location.hash = '#/instrumentos/editor';
}

export function circuitoEditor(): CircuitoEditor | null {
  if (pendiente) return pendiente;
  try {
    const s = sessionStorage.getItem(CLAVE);
    return s ? (JSON.parse(s) as CircuitoEditor) : null;
  } catch {
    return null;
  }
}
