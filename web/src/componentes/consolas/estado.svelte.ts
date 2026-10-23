// Shared state of the «Consolas» views and their routes:
//   #/consolas/<maquina>/<pestana>[/<seleccion>]
//   maquina: nes | neogeo; pestana: foto | arquitectura | esquema | fuentes
//   seleccion: a component reference («U6»), «red:<net name>» or «bloque:<id>» (URI-encoded)

import type { IdMaquina } from './datos';

export type Pestana = 'foto' | 'arquitectura' | 'esquema' | 'fuentes';

export interface Seleccion {
  tipo: 'componente' | 'red' | 'bloque' | 'foto';
  id: string;
}

export const PESTANAS: { id: Pestana; titulo: string }[] = [
  { id: 'foto', titulo: 'Foto' },
  { id: 'arquitectura', titulo: 'Arquitectura' },
  { id: 'esquema', titulo: 'Esquema' },
  { id: 'fuentes', titulo: 'Fuentes' },
];

export function leerAncla(ancla: string): { maquina: IdMaquina; pestana: Pestana; sel: Seleccion | null } {
  const [m = '', p = '', ...resto] = ancla.split('/');
  const maquina: IdMaquina = m === 'neogeo' ? 'neogeo' : 'nes';
  const pestana: Pestana = (['foto', 'arquitectura', 'esquema', 'fuentes'] as const).find((x) => x === p) ?? 'foto';
  const s = resto.join('/');
  let sel: Seleccion | null = null;
  if (s) {
    const d = decodeURIComponent(s);
    if (d.startsWith('red:')) sel = { tipo: 'red', id: d.slice(4) };
    else if (d.startsWith('bloque:')) sel = { tipo: 'bloque', id: d.slice(7) };
    else if (d.startsWith('foto:')) sel = { tipo: 'foto', id: d.slice(5) };
    else sel = { tipo: 'componente', id: d };
  }
  return { maquina, pestana, sel };
}

export function enlace(maquina: IdMaquina, pestana: Pestana, sel?: Seleccion | null): string {
  let s = '';
  if (sel) {
    const pre = sel.tipo === 'componente' ? '' : `${sel.tipo}:`;
    s = '/' + encodeURIComponent(pre + sel.id);
  }
  return `#/consolas/${maquina}/${pestana}${s}`;
}
