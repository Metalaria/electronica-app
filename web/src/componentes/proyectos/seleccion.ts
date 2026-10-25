// The selection shared by the 2D, 3D and schematic views: a footprint, a net or a pad, resolved to indices.

import type { DatosPlaca } from './datos';
import type { Seleccion } from './estado';

export interface Resuelta {
  huella: number | null;
  red: number | null;
  pad: number | null;
}

const vacia: Resuelta = { huella: null, red: null, pad: null };

export function resolver(d: DatosPlaca, s: Seleccion | null): Resuelta {
  if (!s) return vacia;
  if (s.tipo === 'huella') {
    const i = d.huellas.findIndex((h) => h.r === s.id);
    return i >= 0 ? { huella: i, red: null, pad: null } : vacia;
  }
  if (s.tipo === 'red') {
    const i = d.redes.findIndex((r) => r.n === s.id);
    return i >= 0 ? { huella: null, red: i, pad: null } : vacia;
  }
  const k = s.id.lastIndexOf('.');
  const ref = s.id.slice(0, k);
  const num = s.id.slice(k + 1);
  const h = d.huellas.findIndex((x) => x.r === ref);
  if (h < 0) return vacia;
  const [a, n] = d.huellas[h]!.pads;
  for (let i = a; i < a + n; i++) {
    const p = d.pads[i]!;
    if (p[1] === num) return { huella: h, red: p[12] >= 0 ? p[12] : null, pad: i };
  }
  return { huella: h, red: null, pad: null };
}

export function deHuella(d: DatosPlaca, i: number): Seleccion {
  return { tipo: 'huella', id: d.huellas[i]!.r };
}

export function deRed(d: DatosPlaca, i: number): Seleccion {
  return { tipo: 'red', id: d.redes[i]!.n };
}

export function dePad(d: DatosPlaca, i: number): Seleccion {
  const p = d.pads[i]!;
  return { tipo: 'pad', id: `${d.huellas[p[0]]!.r}.${p[1]}` };
}

/** Pads of a net, as [pad index] sorted by reference. */
export function padsDeRed(d: DatosPlaca, red: number): number[] {
  const out: number[] = [];
  d.pads.forEach((p, i) => {
    if (p[12] === red) out.push(i);
  });
  const nat = (s: string) => s.replace(/\d+/g, (m) => m.padStart(5, '0'));
  return out.sort((a, b) => {
    const ra = d.huellas[d.pads[a]![0]]!.r;
    const rb = d.huellas[d.pads[b]![0]]!.r;
    return nat(ra).localeCompare(nat(rb)) || nat(d.pads[a]![1]).localeCompare(nat(d.pads[b]![1]));
  });
}
