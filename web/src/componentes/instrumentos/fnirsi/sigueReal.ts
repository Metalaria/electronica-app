// 2.1 (owner, 25-11): the drawn FNIRSI 2C53T follows the real one's mode (oscilloscope, multimeter, generator). The
// mode comes from the link's status stream (patch 3 of «stock-link»: lib/fnirsi-real/conexion.svelte.ts, modoFlujo);
// a link without that stream (patch 2, or the installed app with a link before patch 3) leaves the drawing alone, and
// one line says why. Read-only: only what the link already reports is used; nothing is sent to the instrument.

import type { EstadoFnirsi } from '../../../lib/fnirsi-real/conexion.svelte';
import type { ModoFnirsi } from '../../../lib/fnirsi-real/protocolo.ts';
import type { Modo } from './logica.svelte.ts';

export interface SigueFnirsi {
  /** The drawn instrument's mode to show; null: leave it as it is. */
  modo: Modo | null;
  /** One line for the reader under the drawing ('' says nothing). */
  texto: string;
}

const MODO: Record<ModoFnirsi, Modo | null> = { osciloscopio: 'osc', multimetro: 'dmm', generador: 'gen', otro: null };

export const SIN_FLUJO =
  'El dibujo no sigue el modo de su FNIRSI: su enlace no envía el flujo de estado (hace falta el parche 3 del firmware del enlace).';

/**
 * What the drawn FNIRSI does with the real one: `estadoEnFlujo` is the link's identification (null: not identified
 * yet), `modoFlujo` the mode the status stream shows (null: no block yet).
 */
export function modoQueSigue(estado: EstadoFnirsi, estadoEnFlujo: boolean | null, modoFlujo: ModoFnirsi | null): SigueFnirsi {
  if (estado !== 'conectado' || estadoEnFlujo === null) return { modo: null, texto: '' };
  if (!estadoEnFlujo) return { modo: null, texto: SIN_FLUJO };
  const m = modoFlujo ? MODO[modoFlujo] : null;
  return m ? { modo: m, texto: 'Modo como el de su FNIRSI.' } : { modo: null, texto: '' };
}

// ------------------------------------------------------------------ 2.1: the multimeter's function

/** The firmware's function codes (state byte [24+6], lib/fnirsi-real/multimetro.ts) → the drawn multimeter's list. */
const FUNCION_DIBUJADA: Record<number, { id: string | null; nombre: string }> = {
  1: { id: 'vdc', nombre: 'tensión continua' },
  2: { id: 'vac', nombre: 'tensión alterna' },
  3: { id: 'cont', nombre: 'continuidad' },
  4: { id: 'diodo', nombre: 'diodo' },
  5: { id: 'ohm', nombre: 'resistencia' },
  6: { id: 'cap', nombre: 'capacidad' },
  7: { id: 'temp', nombre: 'temperatura' },
  8: { id: 'idc', nombre: 'corriente continua (mA)' },
  9: { id: 'iac', nombre: 'corriente alterna (mA)' },
  10: { id: 'idc', nombre: 'corriente continua (A)' },
  11: { id: 'iac', nombre: 'corriente alterna (A)' },
};

export interface SigueFuncion {
  /** The id of the drawn multimeter's function (fnirsi/logica.svelte.ts FN_DMM_LISTA); null: leave it. */
  id: string | null;
  /** One line when the drawing cannot follow ('' says nothing). */
  texto: string;
}

/**
 * The drawn multimeter's function for the real one's menu state: Auto follows Auto (the drawing then finds the
 * function itself, as the instrument does); a function the drawing does not have, or a code not documented, leaves
 * it where it was and says so; «none yet» says nothing.
 */
export function funcionQueSigue(menu: { entrada: number; funcion: number; variante: number } | null): SigueFuncion {
  if (!menu) return { id: null, texto: '' };
  if (menu.entrada === 0) return { id: 'auto', texto: '' };
  if (menu.funcion === 0) return { id: null, texto: '' };
  const f = FUNCION_DIBUJADA[menu.funcion];
  if (!f) return { id: null, texto: `Su FNIRSI está en una función que la aplicación no conoce (código ${menu.funcion}): el dibujo no cambia.` };
  if (!f.id) return { id: null, texto: `El FNIRSI dibujado no mide ${f.nombre}: se queda en la función que tenía.` };
  return { id: f.id, texto: '' };
}
