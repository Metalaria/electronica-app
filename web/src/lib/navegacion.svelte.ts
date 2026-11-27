// Navigation model shared by the icon rail (desktop), the bottom bar (phone), the header and the book index:
//   - GRUPOS: the one registry of the app's sections (2.1: five groups, each with its parts; a new section adds one
//     part to a group here). The rail and the bottom bar show the groups; the header shows the current group's parts
//     as underline tabs. MAS: the three pages outside the groups, linked at the foot of the «Aa» panel;
//   - the book index panel, only while reading (remembered in the preferences);
//   - the reading sequence: previous/next section and chapter;
//   - the index filter (text without accents, section numbers «5.8», «cap 33», «ap B»).
// Every hash route stays as it was (lib/ruta.svelte.ts); only what is shown around it changed.

import type { NombreIcono } from '../componentes/Icono.svelte';
import type { Indice } from './tipos';
import { app } from './estado.svelte';
import { ruta, type Vista } from './ruta.svelte';
import { usuario, ponerIndiceOculto } from './usuario.svelte';
import { abrirLateral } from './acciones';
import { normalizar, obtenerIndice, ordenLectura, rotuloParte, tomoDe } from './datos';

// ------------------------------------------------------------------ registry

/** One part of a group (a tab of the header), or one of the pages of «Más». */
export interface Herramienta {
  id: string;
  /** Hash route, or null when it is computed (`href`). */
  ruta: string | null;
  /** The route when it depends on the reader (the book's «Índice»: the part read last). */
  href?: () => string;
  icono: NombreIcono;
  /** Full name (tooltips, accessible name, the header's title on its own). */
  etiqueta: string;
  /** Short label of the tab (default: etiqueta). */
  corta?: string;
  /** Views where the entry is the current one (default: the view named like its id). */
  vistas?: Vista[];
  /** Small counter shown next to the label. */
  cuenta?: () => number;
  /** Whether it is the current entry, when the view alone does not tell (the breadboard is a tab of the simulator). */
  activa?: () => boolean;
}

export type IdGrupo = 'inicio' | 'aprender' | 'libro' | 'taller' | 'proyectos';

export interface Grupo {
  id: IdGrupo;
  etiqueta: string;
  icono: NombreIcono;
  /** Its parts, in the order of the tabs; the first is where the group opens. */
  partes: Herramienta[];
  /** Views that belong to the group without being one of its tabs (no tab is marked on them). */
  vistas: Vista[];
}

const enProtoboard = () => ruta.vista === 'simulador' && (ruta.sim === 'protoboard' || ruta.sim.startsWith('protoboard/'));

const esMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
/** Shortcut of «Buscar», for its tooltip. */
export const ATAJO_BUSCAR = esMac ? '⌘ K' : 'Ctrl K';

/** The start page (the first group; the rail's logo also leads there). */
export const INICIO: Herramienta = { id: 'inicio', ruta: '#/', icono: 'inicio', etiqueta: 'Inicio' };

/** The book's «Índice»: the reader, at the part read most recently (the index panel beside it). */
export const INDICE: Herramienta = { id: 'indice', ruta: null, href: () => rutaContinuar(), icono: 'libro', etiqueta: 'Índice', vistas: ['parte'] };

const MARCADORES: Herramienta = {
  id: 'marcadores',
  ruta: '#/marcadores',
  icono: 'marcador',
  etiqueta: 'Marcadores y notas',
  corta: 'Marcadores',
  cuenta: () => Object.keys(usuario.marcadores).length + Object.keys(usuario.notas).length,
};

/** 2.1: the five groups of the navigation (Main.png of the 2.1 mock-ups), each with its parts as tabs. */
export const GRUPOS: Grupo[] = [
  { id: 'inicio', etiqueta: 'Inicio', icono: 'inicio', partes: [INICIO], vistas: [] },
  {
    id: 'aprender',
    etiqueta: 'Aprender',
    icono: 'aprender',
    partes: [
      { id: 'cursos', ruta: '#/cursos', icono: 'cursos', etiqueta: 'Cursos' },
      { id: 'repaso', ruta: '#/repaso', icono: 'repaso', etiqueta: 'Repaso' },
      { id: 'progreso', ruta: '#/progreso', icono: 'progreso', etiqueta: 'Progreso' },
    ],
    // reached from Inicio and the courses (and the diagnostic from «Aa»)
    vistas: ['practicar', 'problema', 'diagnostico', 'etapas'],
  },
  {
    id: 'libro',
    etiqueta: 'Libro',
    icono: 'libro',
    partes: [
      INDICE,
      { id: 'ejercicios', ruta: '#/ejercicios', icono: 'ejercicios', etiqueta: 'Ejercicios' },
      { id: 'conceptos', ruta: '#/conceptos', icono: 'conceptos', etiqueta: 'Conceptos animados', corta: 'Conceptos' },
      { id: 'glosario', ruta: '#/glosario', icono: 'glosario', etiqueta: 'Glosario' },
      MARCADORES,
    ],
    vistas: [],
  },
  {
    id: 'taller',
    etiqueta: 'Taller',
    icono: 'simulador',
    partes: [
      { id: 'simulador', ruta: '#/simulador', icono: 'simulador', etiqueta: 'Simulador', activa: () => ruta.vista === 'simulador' && !enProtoboard() },
      { id: 'protoboard', ruta: '#/protoboard', icono: 'protoboard', etiqueta: 'Protoboard', vistas: [], activa: enProtoboard },
      { id: 'instrumentos', ruta: '#/instrumentos', icono: 'instrumentos', etiqueta: 'Instrumentos' },
      { id: 'calculadoras', ruta: '#/calculadoras', icono: 'calculadora', etiqueta: 'Calculadoras' },
      { id: 'componentes', ruta: '#/componentes', icono: 'componentes', etiqueta: 'Componentes animados', corta: 'Componentes' },
    ],
    vistas: [],
  },
  {
    id: 'proyectos',
    etiqueta: 'Proyectos',
    icono: 'consolas',
    partes: [
      { id: 'fm7303', ruta: '#/fm7303', icono: 'radio', etiqueta: 'Kit FM7303' },
      { id: 'consolas', ruta: '#/consolas', icono: 'consolas', etiqueta: 'Consolas' },
      { id: 'proyectos', ruta: '#/proyectos', icono: 'placa', etiqueta: 'Proyectos del libro' },
    ],
    vistas: [],
  },
];

/** 2.1: the pages outside the five groups, linked at the foot of the «Aa» panel («Más: Guía de uso · …»). */
export const MAS: Herramienta[] = [
  { id: 'guia', ruta: '#/guia', icono: 'guia', etiqueta: 'Guía de uso' },
  { id: 'docente', ruta: '#/docente', icono: 'docente', etiqueta: 'Modo docente' },
  { id: 'sincronizacion', ruta: '#/sincronizacion', icono: 'repaso', etiqueta: 'Sincronización' },
];

/** Every page with an entry, groups' parts first (for whatever needs them all). */
export const HERRAMIENTAS: Herramienta[] = [...GRUPOS.flatMap((g) => g.partes), ...MAS];

export function esActiva(h: Herramienta): boolean {
  if (h.activa) return h.activa();
  return (h.vistas ?? [h.id as Vista]).includes(ruta.vista);
}

/** The route of an entry. */
export function hrefDe(h: Herramienta): string {
  return h.href ? h.href() : (h.ruta ?? '#/');
}

/** The group of a view (null: the lesson and the pages of «Más»). */
export function grupoDe(v: Vista = ruta.vista): Grupo | null {
  if (v === 'leccion') return null;
  return GRUPOS.find((g) => g.vistas.includes(v) || g.partes.some((h) => (h.vistas ?? [h.id as Vista]).includes(v))) ?? null;
}

/** The group on screen. */
export function grupoActual(): Grupo | null {
  return grupoDe(ruta.vista);
}

/** The part on screen within its group (null on the group's other views: practice, problem of the day…). */
export function parteActual(): Herramienta | null {
  return grupoActual()?.partes.find(esActiva) ?? null;
}

/** Where each group was left (this session only), so its rail entry returns there; the reader by its part. */
const ultimas = $state<Partial<Record<IdGrupo, string>>>({});

/** Notes the route on screen as its group's last one (App.svelte, on every route change). */
export function recordarRuta(): void {
  const g = grupoActual();
  if (!g || g.id === 'inicio') return;
  const h = ruta.vista === 'parte' ? (ruta.parte ? hrefParte(ruta.parte) : '') : location.hash;
  if (h) ultimas[g.id] = h;
}

/**
 * The route of a group's rail entry or bottom tab: where the group was left, or its first part; the group on screen
 * leads to its first part (the reader for «Libro»).
 */
export function hrefGrupo(g: Grupo): string {
  const primera = g.partes[0]!;
  if (grupoActual()?.id === g.id) return hrefDe(primera);
  return ultimas[g.id] ?? hrefDe(primera);
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
 * While reading, «Libro» (the rail, the bottom bar) and «Índice» (the header's tab) show the book's index: the
 * phone's drawer, or the desktop's panel (toggled from the rail, as an activity bar). Returns whether it acted (the
 * caller then cancels its link).
 */
export function indiceDesdeLibro(alternar: boolean): boolean {
  if (ruta.vista !== 'parte') return false;
  if (app.cajon) abrirLateral();
  else if (alternar) alternarIndice();
  else mostrarIndice();
  return true;
}

// ------------------------------------------------------------------ index panel (desktop)

/** 2.1: the index panel belongs to the reader only (not to Inicio or the tools); there it shows unless hidden. */
export function claveIndice(v: Vista = ruta.vista): string {
  return v === 'parte' ? 'libro' : v;
}

export function indiceOculto(): boolean {
  if (ruta.vista !== 'parte') return true;
  return usuario.prefs.indiceOculto?.libro ?? false;
}

export function alternarIndice(): void {
  if (ruta.vista !== 'parte') return;
  ponerIndiceOculto(claveIndice(), !indiceOculto());
}

export function mostrarIndice(): void {
  if (indiceOculto() && ruta.vista === 'parte') ponerIndiceOculto(claveIndice(), false);
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

let cacheConsolas: { indice: Indice; lista: Paso[]; pos: Map<string, number> } | null = null;

/**
 * 1.2 (consolas-A): the lessons of the «Consolas por dentro» parts (tipo «consola», lib/datos.ts mezclarPartes), one
 * after another in the course's order: a sequence of their own, apart from the book's (the last section of the book is
 * not followed by a console, nor a console lesson by the book). Each stop is a lesson (they have no page to read).
 */
function pasosConsola(): { lista: Paso[]; pos: Map<string, number> } {
  const indice = obtenerIndice();
  if (cacheConsolas?.indice === indice) return cacheConsolas;
  const lista: Paso[] = [];
  const pos = new Map<string, number>();
  for (const [id, p] of Object.entries(indice.partes)) {
    if (p.tipo !== 'consola') continue;
    for (const s of p.secciones ?? []) {
      pos.set(`${id}|${s.label}`, lista.length);
      lista.push({ parte: id, label: s.label, num: s.num ?? null, titulo: s.titulo, href: `#/leccion/${id}/${encodeURIComponent(s.label)}` });
    }
  }
  cacheConsolas = { indice, lista, pos };
  return cacheConsolas;
}

/** The stop before (−1) or after (+1) a section of a part (label null: the part's start). */
export function pasoVecino(parte: string, label: string | null, delta: -1 | 1): Paso | null {
  const { lista, pos } = obtenerIndice().partes[parte]?.tipo === 'consola' ? pasosConsola() : pasos();
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
