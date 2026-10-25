// Web Worker of the editor: lays out a netlist with the automatic schematic generator (the book's layouts of
// precalculado.json first) and returns it as editable data. Runs off the page's thread because the annealing
// of a large netlist takes tens to hundreds of milliseconds.

import { sembrarDibujos } from '../esquema-auto/generar.ts';
import { editableDeNetlist, type EditableAuto } from '../esquema-auto/editable.ts';
import urlPrecalculado from '../esquema-auto/precalculado.json?url';

export interface PeticionEditable {
  id: number;
  texto: string;
}
export type RespuestaEditable = { id: number; ok: true; r: EditableAuto | null } | { id: number; ok: false; error: string };

let listo: Promise<void> | null = null;
function preparar(): Promise<void> {
  listo ??= fetch(urlPrecalculado)
    .then((r) => r.json() as Promise<Parameters<typeof sembrarDibujos>[0]>)
    .then(sembrarDibujos)
    .catch(() => {
      /* every layout is computed live */
    });
  return listo;
}

self.onmessage = async (ev: MessageEvent<PeticionEditable>) => {
  const p = ev.data;
  await preparar();
  let r: RespuestaEditable;
  try {
    r = { id: p.id, ok: true, r: editableDeNetlist(p.texto) };
  } catch (e) {
    r = { id: p.id, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  (self as unknown as Worker).postMessage(r);
};
