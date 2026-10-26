// Colours of the signal groups of «Un fotograma»: the same in the schematic, the board, the photo, the timeline and
// the legend. Chosen to stay apart from each other on the white schematic and on the dark board, light and dark theme.

import type { GrupoSenal } from './tipos';

export const GRUPOS: { id: GrupoSenal; titulo: string }[] = [
  { id: 'direccion', titulo: 'Direcciones' },
  { id: 'datos', titulo: 'Datos' },
  { id: 'control', titulo: 'Control (lectura/escritura)' },
  { id: 'seleccion', titulo: 'Selección de chip' },
  { id: 'reloj', titulo: 'Relojes' },
  { id: 'video', titulo: 'Vídeo' },
  { id: 'interrupcion', titulo: 'Interrupciones' },
  { id: 'dma', titulo: 'DMA' },
];

const CLARO: Record<GrupoSenal, string> = {
  direccion: '#1f6fd1',
  datos: '#d98200',
  control: '#8a3fd1',
  seleccion: '#1e9e4a',
  reloj: '#6b7280',
  video: '#d6337a',
  interrupcion: '#d62d20',
  dma: '#0aa3b5',
};

const OSCURO: Record<GrupoSenal, string> = {
  direccion: '#5aa2ff',
  datos: '#ffb340',
  control: '#c08cff',
  seleccion: '#4fd47d',
  reloj: '#a3aab5',
  video: '#ff6fae',
  interrupcion: '#ff6a5c',
  dma: '#3fd7e8',
};

export function colorGrupo(g: GrupoSenal, oscuro: boolean): string {
  return (oscuro ? OSCURO : CLARO)[g];
}

/** On the board (always a dark green mask) the dark-theme colours read better. */
export function colorGrupoPlaca(g: GrupoSenal): string {
  return OSCURO[g];
}
