// Navigation model shared by the icon rail (desktop), the bottom tabs (phone), the book index and the top bar:
//   - HERRAMIENTAS: the one registry of the app's sections (a new section adds one entry here);
//   - the book index panel, shown or hidden per view (remembered in the preferences);
//   - the reading sequence: previous/next section and chapter;
//   - the index filter (text without accents, section numbers «5.8», «cap 33», «ap B»).

import type { NombreIcono } from '../componentes/Icono.svelte';
import type { Indice } from './tipos';
import { app } from './estado.svelte';
import { ruta, type Vista } from './ruta.svelte';
import { usuario, ponerIndiceOculto } from './usuario.svelte';
import { abrirBuscador, abrirLateral } from './acciones';
import { normalizar, obtenerIndice, ordenLectura, rotuloParte, tomoDe } from './datos';

// ------------------------------------------------------------------ registry

export interface Herramienta {
  id: string;
  /** Hash route, or null for the two actions («libro» opens the index, «buscar» the search). */
  ruta: string | null;
  icono: NombreIcono;
  /** Full name (tooltips, «Más» menu, accessible name). */
  etiqueta: string;
  /** Short label under the rail icon and in the phone tabs (default: etiqueta). */
  corta?: string;
  /** Views where the entry is the current one (default: the view named like its id). */
  vistas?: Vista[];
  /** One of the phone's bottom tabs (the others go to «Más»). */
  pestana?: boolean;
  /** Keyboard shortcut shown in the tooltip. */
  atajo?: string;
  /** Small counter shown next to the icon. */
  cuenta?: () => number;
  /** Whether it is the current entry, when the view alone does not tell (the breadboard is a tab of the simulator). */
  activa?: () => boolean;
}

const enProtoboard = () => ruta.vista === 'simulador' && (ruta.sim === 'protoboard' || ruta.sim.startsWith('protoboard/'));

const esMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** The start page (0.9: the first tab and the first entry of the rail; the rail's logo also leads there). */
export const INICIO: Herramienta = { id: 'inicio', ruta: '#/', icono: 'inicio', etiqueta: 'Inicio', pestana: true };

/** Every section of the app, by frequency of use: the rail and the phone tabs follow this order. */
export const HERRAMIENTAS: Herramienta[] = [
  INICIO,
  { id: 'libro', ruta: null, icono: 'libro', etiqueta: 'Libro', vistas: ['parte'], pestana: true },
  { id: 'buscar', ruta: null, icono: 'buscar', etiqueta: 'Buscar', atajo: esMac ? '⌘ K' : 'Ctrl K', vistas: [] },
  { id: 'simulador', ruta: '#/simulador', icono: 'simulador', etiqueta: 'Simulador', pestana: true, activa: () => ruta.vista === 'simulador' && !enProtoboard() },
  { id: 'calculadoras', ruta: '#/calculadoras', icono: 'calculadora', etiqueta: 'Calculadoras' },
  { id: 'ejercicios', ruta: '#/ejercicios', icono: 'ejercicios', etiqueta: 'Ejercicios', pestana: true },
  { id: 'repaso', ruta: '#/repaso', icono: 'aprender', etiqueta: 'Repaso' },
  { id: 'componentes', ruta: '#/componentes', icono: 'componentes', etiqueta: 'Componentes animados', corta: 'Componentes' },
  { id: 'conceptos', ruta: '#/conceptos', icono: 'conceptos', etiqueta: 'Conceptos animados', corta: 'Conceptos' },
  { id: 'instrumentos', ruta: '#/instrumentos', icono: 'instrumentos', etiqueta: 'Instrumentos' },
  { id: 'protoboard', ruta: '#/protoboard', icono: 'protoboard', etiqueta: 'Protoboard', vistas: [], activa: enProtoboard },
  { id: 'fm7303', ruta: '#/fm7303', icono: 'radio', etiqueta: 'Kit FM7303' },
  { id: 'consolas', ruta: '#/consolas', icono: 'consolas', etiqueta: 'Consolas' },
  { id: 'proyectos', ruta: '#/proyectos', icono: 'placa', etiqueta: 'Proyectos KiCad', corta: 'Proyectos' },
  { id: 'glosario', ruta: '#/glosario', icono: 'glosario', etiqueta: 'Glosario' },
  {
    id: 'marcadores',
    ruta: '#/marcadores',
    icono: 'marcador',
    etiqueta: 'Marcadores y notas',
    corta: 'Marcadores',
    cuenta: () => Object.keys(usuario.marcadores).length + Object.keys(usuario.notas).length,
  },
];

export function esActiva(h: Herramienta): boolean {
  if (h.activa) return h.activa();
  return (h.vistas ?? [h.id as Vista]).includes(ruta.vista);
}

/** Runs an entry that is an action (the routes are plain links). */
export function activar(h: Herramienta): void {
  if (h.id === 'buscar') abrirBuscador();
  else if (h.id === 'libro') abrirLibro();
  else if (h.ruta) location.hash = h.ruta;
}

/** Route of the part read most recently (or the first chapter). */
export function rutaContinuar(): string {
  const i = app.indice;
  let mejor = '';
  let t = -1;
  for (const [id, p] of Object.entries(usuario.posiciones)) {
    if (i?.partes[id] && p.t > t) {
      t = p.t;
      mejor = id;
    }
  }
  if (!mejor && i) mejor = ordenLectura().find((id) => i.partes[id]?.tipo === 'capitulo') ?? ordenLectura()[0] ?? '';
  return mejor ? hrefParte(mejor) : '#/';
}

/**
 * «Libro»: on the phone it opens the index drawer; on the desktop it toggles the index panel while reading
 * (like an activity bar) and otherwise returns to the reading.
 */
export function abrirLibro(): void {
  if (app.movil) {
    abrirLateral();
    return;
  }
  if (ruta.vista === 'parte') {
    alternarIndice();
    return;
  }
  location.hash = rutaContinuar();
}

// ------------------------------------------------------------------ index panel (desktop)

/** Views where the index is shown unless the reader hides it; in the tools it starts hidden. */
const VISIBLE_POR_DEFECTO = new Set(['libro', 'inicio']);

export function claveIndice(v: Vista = ruta.vista): string {
  return v === 'parte' ? 'libro' : v;
}

export function indiceOculto(): boolean {
  const c = claveIndice();
  return usuario.prefs.indiceOculto?.[c] ?? !VISIBLE_POR_DEFECTO.has(c);
}

export function alternarIndice(): void {
  ponerIndiceOculto(claveIndice(), !indiceOculto());
}

export function mostrarIndice(): void {
  if (indiceOculto()) ponerIndiceOculto(claveIndice(), false);
}

// ------------------------------------------------------------------ reading sequence

export function hrefParte(id: string): string {
  return id === 'glosario' ? '#/glosario' : `#/${id}`;
}

export function hrefSeccion(parte: string, label: string): string {
  return parte === 'glosario' ? `#/glosario/${label}` : `#/${parte}/${label}`;
}

/** One stop of the reading sequence: the start of a part or one of its sections. */
export interface Paso {
  parte: string;
  /** Section label, or null for the start of the part. */
  label: string | null;
  num: string | null;
  titulo: string;
  href: string;
}

let cachePasos: { indice: Indice; lista: Paso[]; pos: Map<string, number> } | null = null;

function pasos(): { lista: Paso[]; pos: Map<string, number> } {
  const indice = obtenerIndice();
  if (cachePasos?.indice === indice) return cachePasos;
  const lista: Paso[] = [];
  const pos = new Map<string, number>();
  for (const id of ordenLectura()) {
    const p = indice.partes[id]!;
    pos.set(`${id}|`, lista.length);
    lista.push({
      parte: id,
      label: null,
      num: null,
      titulo: `${rotuloParte(id)}${p.num != null ? ` · ${corto(p.titulo)}` : ''}`,
      // the chapter's opening, not the last position: the sequence goes to the start
      href: p.label ? `${hrefParte(id)}/${p.label}` : hrefParte(id),
    });
    for (const s of p.secciones ?? []) {
      pos.set(`${id}|${s.label}`, lista.length);
      lista.push({ parte: id, label: s.label, num: s.num ?? null, titulo: s.titulo, href: hrefSeccion(id, s.label) });
    }
  }
  cachePasos = { indice, lista, pos };
  return cachePasos;
}

/** The stop before (−1) or after (+1) a section of a part (label null: the part's start). */
export function pasoVecino(parte: string, label: string | null, delta: -1 | 1): Paso | null {
  const { lista, pos } = pasos();
  const k = pos.get(`${parte}|${label ?? ''}`) ?? pos.get(`${parte}|`);
  if (k == null) return null;
  return lista[k + delta] ?? null;
}

/** The part before or after one, in reading order. */
export function parteVecina(parte: string, delta: -1 | 1): string | null {
  const orden = ordenLectura();
  const k = orden.indexOf(parte);
  return k < 0 ? null : (orden[k + delta] ?? null);
}

export function corto(titulo: string): string {
  return titulo.split(' — ')[0] ?? titulo;
}

// ------------------------------------------------------------------ index filter

export interface Coincidencia {
  parte: string;
  /** The part itself matches (title or number). */
  capitulo: boolean;
  /** Matching sections (labels), in book order. */
  secciones: string[];
}

export interface ResultadoFiltro {
  lista: Coincidencia[];
  /** Words to highlight (empty for number searches). */
  palabras: string[];
  /** The query is a number: the matching section or chapter is the obvious target. */
  numero: boolean;
  secciones: number;
}

interface Pajar {
  parte: string;
  num: string;
  tipo: string;
  texto: string;
  secciones: { label: string; num: string; texto: string }[];
}

let cachePajar: { indice: Indice; lista: Pajar[] } | null = null;

function pajar(): Pajar[] {
  const indice = obtenerIndice();
  if (cachePajar?.indice === indice) return cachePajar.lista;
  const lista = ordenLectura().map((id): Pajar => {
    const p = indice.partes[id]!;
    return {
      parte: id,
      num: normalizar(String(p.num ?? '')),
      tipo: p.tipo,
      texto: normalizar(`${rotuloParte(id)} ${p.titulo}`),
      secciones: (p.secciones ?? []).map((s) => ({
        label: s.label,
        num: normalizar(s.num ?? ''),
        texto: normalizar(`${s.num ?? ''} ${s.titulo}`),
      })),
    };
  });
  cachePajar = { indice, lista };
  return lista;
}

const RE_CAPITULO = /^(?:cap(?:itulo)?\.?\s*)?(\d+)$/;
const RE_APENDICE = /^ap(?:endice|\.)?\s*([a-z])$/;
const RE_SECCION = /^(?:(?:cap(?:itulo)?|ap(?:endice)?|sec(?:cion)?|§)\.?\s*)?([a-z]?\d*(?:\.\d+)+)\.?$/;

/** Filters the index; null for an empty query. */
export function filtrarIndice(consulta: string): ResultadoFiltro | null {
  const q = normalizar(consulta).trim().replace(/\s+/g, ' ');
  if (!q) return null;
  const todo = pajar();

  // «5.8», «A.3», «sec 12.4»: sections by number (exact, else those that start with it)
  let m = RE_SECCION.exec(q);
  if (m) {
    const n = m[1]!;
    for (const exacto of [true, false]) {
      const lista: Coincidencia[] = [];
      let total = 0;
      for (const p of todo) {
        const secs = p.secciones.filter((s) => (exacto ? s.num === n : s.num.startsWith(n))).map((s) => s.label);
        if (secs.length) {
          lista.push({ parte: p.parte, capitulo: false, secciones: secs });
          total += secs.length;
        }
      }
      if (lista.length) return { lista, palabras: [], numero: true, secciones: total };
    }
    return { lista: [], palabras: [], numero: true, secciones: 0 };
  }

  // «33», «cap 33», «capítulo 33», «ap B»: a chapter or appendix by number, with all its sections
  m = RE_CAPITULO.exec(q) ?? RE_APENDICE.exec(q);
  if (m) {
    const n = m[1]!;
    const apendice = RE_APENDICE.test(q);
    const lista = todo
      .filter((p) => p.num === n && (apendice ? p.tipo === 'apendice' : p.tipo === 'capitulo'))
      .map((p) => ({ parte: p.parte, capitulo: true, secciones: p.secciones.map((s) => s.label) }));
    // a bare number may also be a word of a title («555»): fall through when no chapter has it
    if (lista.length || !/^\d+$/.test(q)) {
      return { lista, palabras: [], numero: true, secciones: lista.reduce((a, c) => a + c.secciones.length, 0) };
    }
  }

  // words: every word must appear (accents and case ignored)
  const palabras = q.split(' ').filter(Boolean);
  const lista: Coincidencia[] = [];
  let total = 0;
  for (const p of todo) {
    const capitulo = palabras.every((w) => p.texto.includes(w));
    const secs = p.secciones.filter((s) => palabras.every((w) => s.texto.includes(w))).map((s) => s.label);
    if (capitulo || secs.length) {
      lista.push({ parte: p.parte, capitulo, secciones: secs });
      total += secs.length;
    }
  }
  return { lista, palabras, numero: false, secciones: total };
}

/** Splits a text into pieces, marking the words found (accent- and case-insensitive). */
export function resaltar(texto: string, palabras: string[]): { t: string; m: boolean }[] {
  if (!palabras.length) return [{ t: texto, m: false }];
  // normalised text with, for each of its characters, the index of the original character
  let norm = '';
  const origen: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    const n = normalizar(texto[i]!);
    for (let j = 0; j < n.length; j++) origen.push(i);
    norm += n;
  }
  const marca = new Uint8Array(texto.length);
  for (const w of palabras) {
    let k = norm.indexOf(w);
    while (k >= 0) {
      for (let j = k; j < k + w.length; j++) marca[origen[j]!] = 1;
      k = norm.indexOf(w, k + w.length);
    }
  }
  const trozos: { t: string; m: boolean }[] = [];
  for (let i = 0; i < texto.length; i++) {
    const m = marca[i] === 1;
    const ultimo = trozos[trozos.length - 1];
    if (ultimo && ultimo.m === m) ultimo.t += texto[i];
    else trozos.push({ t: texto[i]!, m });
  }
  return trozos;
}

/** The volume of the part on screen, or of the one read last. */
export function tomoActual(): string | undefined {
  if ((ruta.vista === 'parte' || ruta.vista === 'glosario') && ruta.parte) return tomoDe(ruta.parte);
  const r = rutaContinuar().replace(/^#\//, '');
  return r ? tomoDe(r) : undefined;
}
