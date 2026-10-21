// Book references of the animations: number, title and route of each label, from the loaded index.

import { app } from '../../lib/estado.svelte';
import { rutaDeRef } from '../../lib/datos';

/** Titles of the subsections the catalogue cites (the index only lists level-2 sections). */
const SUBTITULOS: Record<string, string> = {
  'sec-2.2.2': 'Resistencias de película de carbón',
  'sec-2.2.3': 'Resistencias de película metálica',
  'sec-2.2.4': 'Resistencias bobinadas',
  'sec-2.2.5': 'Resistencias SMD',
  'sec-3.4.1': 'Condensadores cerámicos multicapa (MLCC)',
  'sec-3.4.2': 'Condensadores electrolíticos de aluminio',
  'sec-3.4.3': 'Condensadores de película plástica',
  'sec-3.4.4': 'Condensadores de tántalo y supercondensadores',
};

export interface RefLibro {
  label: string;
  num: string;
  tipo: string;
  titulo: string;
  href: string;
}

export function referencia(label: string): RefLibro | null {
  const r = app.refs[label];
  const href = rutaDeRef(label);
  if (!r || !href) return null;
  let titulo = '';
  if (r.tipo === 'sec') {
    const s = app.indice?.partes[r.parte]?.secciones?.find((x) => x.label === label);
    titulo = s?.titulo ?? '';
  } else if (r.tipo === 'subsec') titulo = SUBTITULOS[label] ?? '';
  const prefijo = r.tipo === 'fig' ? 'Figura ' : r.tipo === 'prob' ? 'Problema ' : r.tipo === 'tab' ? 'Tabla ' : '';
  return { label, num: prefijo + r.num, tipo: r.tipo, titulo, href };
}
