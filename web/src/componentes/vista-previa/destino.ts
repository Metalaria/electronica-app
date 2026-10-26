// What a reference points to, for the preview card: the target block (figure, table, equation) or, for a
// section, chapter, exercise or problem, its title, its first paragraphs and its first figure. Read from the
// target part's JSON (datos.ts loads and caches it); the index of labels of each part is built once.

import type { BEc, BFigura, BTabla, Bloque, Parte } from '../../lib/tipos';
import { candidatosDeRef, cargarParte, infoParte, obtenerRefs, rotuloParte, textoPlano } from '../../lib/datos';

export type TipoDestino = 'fig' | 'tab' | 'ec' | 'sec' | 'cap' | 'ej' | 'otro';

export interface Destino {
  clave: string;
  tipo: TipoDestino;
  parte: string;
  /** Printed number («5.3», «A», «») of the target. */
  num: string;
  /** «Figura 5.3», «Sección 5.3», «Capítulo 5»… */
  rotulo: string;
  /** «la figura 5.3», «la sección 5.3»… (for «Ir a …»). */
  objeto: string;
  /** Part where it is («Capítulo 5»), shown when it is not the part being read. */
  enParte: string;
  /** Block colour of that part (hex without #). */
  color: string;
  titulo: string;
  figura: BFigura | null;
  tabla: BTabla | null;
  ecuacion: BEc | null;
  /** HTML of the first paragraphs (sections, chapters, exercises). */
  parrafos: string[];
}

interface Lugar {
  bloque: Bloque;
  /** Index of the top-level block that holds it. */
  top: number;
  /** For exercises: the item's blocks. */
  item?: Bloque[];
}

const indices = new WeakMap<Parte, Map<string, Lugar>>();

function indexar(p: Parte): Map<string, Lugar> {
  let m = indices.get(p);
  if (m) return m;
  m = new Map();
  const mapa = m;
  const recorrer = (bs: Bloque[], top: number | null) => {
    bs.forEach((b, i) => {
      const t = top ?? i;
      if (b.label && !mapa.has(b.label)) mapa.set(b.label, { bloque: b, top: t });
      if (b.t === 'caja' || b.t === 'deduccion' || b.t === 'tarjeta') recorrer(b.bloques, t);
      else if (b.t === 'ejercicios') {
        for (const it of b.items) {
          if (it.label && !mapa.has(it.label)) mapa.set(it.label, { bloque: b, top: t, item: it.bloques });
          recorrer(it.bloques, t);
        }
      }
    });
  };
  recorrer(p.bloques, null);
  indices.set(p, m);
  return m;
}

/** First figure among some blocks (looking inside boxes, not inside exercises). */
function primeraFigura(bs: Bloque[]): BFigura | null {
  for (const b of bs) {
    if (b.t === 'figura') return b;
    if (b.t === 'caja' || b.t === 'deduccion' || b.t === 'tarjeta') {
      const f = primeraFigura(b.bloques);
      if (f) return f;
    }
  }
  return null;
}

function parrafos(bs: Bloque[], n = 2): string[] {
  const out: string[] = [];
  for (const b of bs) {
    if (b.t === 'p' && b.html.trim() && !b.html.startsWith('<strong>Se pide')) out.push(b.html);
    else if (b.t === 'lista' && out.length) out.push(b.items.slice(0, 3).map((x) => `• ${x}`).join('<br>'));
    if (out.length >= n) break;
  }
  return out;
}

/** Blocks of a top-level heading up to the next heading of the same or a higher level. */
function rango(bs: Bloque[], desde: number, niveles: string[]): Bloque[] {
  let hasta = desde + 1;
  while (hasta < bs.length && !niveles.includes(bs[hasta]!.t)) hasta++;
  return bs.slice(desde + 1, hasta);
}

const NOMBRES: Record<string, [string, string, string]> = {
  // tipo de refs.json → [rotulo, objeto, tipo de destino]
  fig: ['Figura', 'la figura', 'fig'],
  tab: ['Tabla', 'la tabla', 'tab'],
  ec: ['Ecuación', 'la ecuación', 'ec'],
  sec: ['Sección', 'la sección', 'sec'],
  subsec: ['Apartado', 'el apartado', 'sec'],
  cap: ['Capítulo', 'el capítulo', 'cap'],
  ap: ['Apéndice', 'el apéndice', 'cap'],
  ej: ['Ejercicio', 'el ejercicio', 'ej'],
  prob: ['Problema', 'el problema', 'sec'],
};

/** «Figura 5.3» and «la figura 5.3» of a reference key, without loading anything. */
export function rotulosDe(clave: string, tipoBloque?: string): { rotulo: string; objeto: string; tipo: TipoDestino } {
  const r = obtenerRefs()[clave];
  const [nombre, objeto, tipo] = NOMBRES[tipoBloque ?? r?.tipo ?? ''] ?? ['Referencia', 'la referencia', 'otro'];
  const num = r?.num ?? '';
  return { rotulo: num ? `${nombre} ${num}` : nombre, objeto: num ? `${objeto} ${num}` : objeto, tipo: tipo as TipoDestino };
}

export async function resolver(clave: string, parteActual = ''): Promise<Destino | null> {
  const r = obtenerRefs()[clave];
  if (!r) return null;
  const parte = await cargarParte(r.parte);
  const info = infoParte(r.parte);
  const lugar = (() => {
    const m = indexar(parte);
    for (const id of candidatosDeRef(clave)) {
      const l = m.get(id);
      if (l) return l;
    }
    return null;
  })();
  // the type of the block found wins (a label of refs.json may be an alias)
  const { rotulo, objeto, tipo } = rotulosDe(clave, lugar?.bloque.t === 'ec' ? 'ec' : undefined);
  const d: Destino = {
    clave,
    tipo,
    parte: r.parte,
    num: r.num ?? '',
    rotulo,
    objeto,
    enParte: r.parte !== parteActual && tipo !== 'cap' ? rotuloParte(r.parte) : '',
    color: (info?.color ?? parte.color ?? '1A3A5C').replace('#', ''),
    titulo: '',
    figura: null,
    tabla: null,
    ecuacion: null,
    parrafos: [],
  };
  const bs = parte.bloques;
  if (tipo === 'cap') {
    d.titulo = (parte.titulo || info?.titulo || '').split(' — ')[0] ?? '';
    const primera = bs.findIndex((b) => b.t === 'h2');
    const intro = primera < 0 ? bs : bs.slice(0, primera);
    d.parrafos = parrafos(intro);
    if (!d.parrafos.length && primera >= 0) d.parrafos = parrafos(rango(bs, primera, ['h2']));
    d.figura = primeraFigura(bs);
    return d;
  }
  if (!lugar) return d;
  const b = lugar.bloque;
  if (tipo === 'ej' && lugar.item) {
    d.parrafos = parrafos(lugar.item, 2);
    d.figura = primeraFigura(lugar.item);
    return d;
  }
  if (b.t === 'figura') d.figura = b;
  else if (b.t === 'tabla') d.tabla = b;
  else if (b.t === 'ec') d.ecuacion = b;
  else if (b.t === 'h2' || b.t === 'h3') {
    const sec = info?.secciones?.find((s) => s.label === b.label);
    d.titulo = sec?.titulo ?? textoPlano(b.html);
    const dentro = rango(bs, lugar.top, b.t === 'h2' ? ['h2'] : ['h2', 'h3']);
    d.parrafos = parrafos(dentro);
    d.figura = primeraFigura(dentro);
  } else if (b.t === 'p') {
    d.parrafos = [b.html];
  }
  return d;
}
