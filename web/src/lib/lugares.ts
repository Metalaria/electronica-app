// 2.1 (owner's item 6): «Buscar» also takes the reader to the app's tools and places, not only to the book: each part
// of the five groups (lib/navegacion GRUPOS) and the pages of «Más», the two instruments, each console by name, the
// FM7303 kit, the book's KiCad projects (proyectos/indice.json) and each calculator (formulas.json). Spanish without
// accents or case, every word of the query the beginning of a word of the place's name or of one of its synonyms
// («osciloscopio» → the FNIRSI, «multimetro» → the Brymen, «snes» → Super Nintendo).
// The fixed places are here; the projects and the calculators are fetched the first time the search opens (the
// calculators' catalogue is the one the «Calculadoras» page caches).

import { normalizar } from './datos';
import { GRUPOS, MAS, hrefDe, rutaContinuar } from './navegacion.svelte';

export type TipoLugar = 'seccion' | 'instrumento' | 'consola' | 'proyecto' | 'calculadora';

export interface Lugar {
  id: string;
  titulo: string;
  /** Where it is («Taller · Instrumentos»), shown under the title. */
  donde: string;
  href: string;
  tipo: TipoLugar;
  /** Other names a reader may type (accents and case do not matter). */
  sinonimos?: string[];
}

/** Synonyms of the groups' parts and the pages of «Más», by the part's id. */
const SINONIMOS_PARTE: Record<string, string[]> = {
  inicio: ['portada', 'principio', 'hoy'],
  cursos: ['curso', 'aprender', 'temario'],
  repaso: ['tarjetas', 'test', 'examen', 'repasar'],
  progreso: ['logros', 'nivel', 'racha', 'puntos', 'dominio', 'estadisticas'],
  indice: ['libro', 'leer', 'lectura', 'capitulos', 'tabla de contenidos'],
  ejercicios: ['problemas', 'ejercicio', 'problema'],
  conceptos: ['animaciones', 'fasores', 'fourier'],
  glosario: ['terminos', 'diccionario', 'vocabulario'],
  marcadores: ['notas', 'favoritos', 'marcador'],
  simulador: ['spice', 'ngspice', 'circuito', 'simulacion', 'editor de esquemas', 'esquema'],
  protoboard: ['placa de pruebas', 'breadboard', 'montaje'],
  instrumentos: ['banco', 'medir', 'aparatos', 'laboratorio', 'practicas'],
  calculadoras: ['formulas', 'calculadora', 'calcular'],
  componentes: ['animaciones de componentes', 'transistor', 'diodo'],
  fm7303: ['radio', 'fm', 'kit de radio', 'receptor'],
  consolas: ['videojuegos', 'retro', 'placas de consolas'],
  proyectos: ['kicad', 'placas', 'pcb', 'proyectos kicad'],
  guia: ['ayuda', 'manual', 'instrucciones', 'como se usa'],
  docente: ['profesor', 'examenes', 'clase', 'cursos propios'],
  sincronizacion: ['github', 'copia de seguridad', 'sincronizar', 'actualizaciones', 'token'],
};

/** The eleven consoles of «Consolas» (componentes/consolas: IDS_MAQUINA), with the names people also give them. */
export const CONSOLAS_LUGAR: { id: string; titulo: string; sinonimos: string[] }[] = [
  { id: 'nes', titulo: 'NES', sinonimos: ['Nintendo Entertainment System', 'Famicom', 'Nintendo NES'] },
  { id: 'neogeo', titulo: 'Neo Geo AES', sinonimos: ['Neo-Geo', 'SNK'] },
  { id: 'sms', titulo: 'Master System II', sinonimos: ['Sega Master System', 'SMS'] },
  { id: 'megadrive', titulo: 'Mega Drive', sinonimos: ['Sega Mega Drive', 'Genesis', 'Megadrive'] },
  { id: 'gb', titulo: 'Game Boy', sinonimos: ['DMG', 'Gameboy'] },
  { id: 'gbc', titulo: 'Game Boy Color', sinonimos: ['GBC', 'Gameboy Color'] },
  { id: 'snes', titulo: 'Super Nintendo', sinonimos: ['SNES', 'Super Famicom', 'Super NES'] },
  { id: 'n64', titulo: 'Nintendo 64', sinonimos: ['N64'] },
  { id: 'ps1', titulo: 'PlayStation', sinonimos: ['PS1', 'PSX', 'PSOne', 'Play Station', 'Sony PlayStation'] },
  { id: 'gamecube', titulo: 'GameCube', sinonimos: ['Game Cube', 'Nintendo GameCube', 'NGC'] },
  { id: 'saturn', titulo: 'Sega Saturn', sinonimos: ['Saturn', 'Saturno'] },
];

function fijos(): Lugar[] {
  const lista: Lugar[] = [];
  for (const g of GRUPOS) {
    for (const h of g.partes) {
      lista.push({
        id: `parte:${h.id}`,
        titulo: h.etiqueta,
        donde: g.partes.length > 1 ? `${g.etiqueta} · ${h.corta ?? h.etiqueta}` : g.etiqueta,
        href: hrefDe(h),
        tipo: 'seccion',
        sinonimos: [...(h.corta && h.corta !== h.etiqueta ? [h.corta] : []), ...(SINONIMOS_PARTE[h.id] ?? [])],
      });
    }
  }
  for (const h of MAS) {
    lista.push({ id: `parte:${h.id}`, titulo: h.etiqueta, donde: 'Más', href: hrefDe(h), tipo: 'seccion', sinonimos: SINONIMOS_PARTE[h.id] ?? [] });
  }
  lista.push(
    {
      id: 'instrumento:brymen',
      titulo: 'Brymen BM869s',
      donde: 'Taller · Instrumentos',
      href: '#/instrumentos/libre',
      tipo: 'instrumento',
      sinonimos: ['multimetro', 'polimetro', 'tester', 'voltimetro', 'amperimetro', 'ohmetro', 'BM869'],
    },
    {
      id: 'instrumento:fnirsi',
      titulo: 'FNIRSI 2C53T',
      donde: 'Taller · Instrumentos',
      href: '#/instrumentos/libre',
      tipo: 'instrumento',
      sinonimos: ['osciloscopio', 'generador de señales', 'generador de funciones', '2C53T', 'scope'],
    },
  );
  for (const c of CONSOLAS_LUGAR) {
    lista.push({ id: `consola:${c.id}`, titulo: c.titulo, donde: 'Proyectos · Consolas', href: `#/consolas/${c.id}/foto`, tipo: 'consola', sinonimos: [...c.sinonimos, 'consola'] });
  }
  return lista;
}

let cacheFijos: Lugar[] | null = null;
let cargados: Lugar[] = [];
let cargando: Promise<void> | null = null;

/** Fetches the projects and the calculators once (the search calls it when it opens); failures leave them out. */
export function prepararLugares(): Promise<void> {
  cargando ??= (async () => {
    const extra: Lugar[] = [];
    const [proyectos, calculadoras] = await Promise.allSettled([
      import('../componentes/proyectos/datos').then((m) => m.cargarIndice()),
      import('../componentes/calculadoras/datos.svelte').then((m) => m.cargarCatalogo()),
    ]);
    if (proyectos.status === 'fulfilled') {
      for (const p of proyectos.value.proyectos) {
        for (const pl of p.placas) {
          extra.push({
            id: `proyecto:${pl.id}`,
            titulo: p.placas.length > 1 ? `${p.titulo}: ${pl.titulo}` : p.titulo,
            donde: `Proyectos · Proyectos del libro · capítulo ${p.capitulo}`,
            href: `#/proyectos/${pl.id}/placa`,
            tipo: 'proyecto',
            sinonimos: ['placa', 'kicad', 'proyecto'],
          });
        }
      }
    }
    if (calculadoras.status === 'fulfilled' && calculadoras.value) {
      for (const f of calculadoras.value.formulas) {
        extra.push({ id: `calculadora:${f.id}`, titulo: f.nombre, donde: `Taller · Calculadoras · ${f.seccion.num}`, href: `#/calculadoras/${f.id}`, tipo: 'calculadora', sinonimos: ['calculadora', 'formula', 'calcular'] });
      }
    }
    cargados = extra;
  })();
  return cargando;
}

/** Words of a text as the search compares them: no accents or case, split at anything that is not a letter or digit. */
function palabras(s: string): string[] {
  return normalizar(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

interface Indexado {
  lugar: Lugar;
  titulo: string[];
  todos: string[][];
}

let indexados: { n: number; lista: Indexado[] } | null = null;

function indice(): Indexado[] {
  cacheFijos ??= fijos();
  const total = cacheFijos.length + cargados.length;
  if (indexados?.n === total) return indexados.lista;
  const lista = [...cacheFijos, ...cargados].map((lugar) => ({
    lugar,
    titulo: palabras(lugar.titulo),
    todos: [palabras(lugar.titulo), ...(lugar.sinonimos ?? []).map(palabras)],
  }));
  indexados = { n: total, lista };
  return lista;
}

/** Each query word starts a word of the name (or of one synonym, all words in that same name). */
function encaja(q: string[], nombre: string[]): boolean {
  return q.every((w) => nombre.some((p) => p.startsWith(w)));
}

const ORDEN_TIPO: Record<TipoLugar, number> = { seccion: 0, instrumento: 1, consola: 2, proyecto: 3, calculadora: 4 };

/** The places that match a query, the best first (at most `max`). */
export function buscarLugares(consulta: string, max = 6): Lugar[] {
  const q = palabras(consulta);
  if (!q.length) return [];
  // one letter alone matches too much; a number («64», «2c53t») is fine
  if (q.length === 1 && q[0]!.length < 2) return [];
  const puntuados: { l: Lugar; p: number }[] = [];
  for (const x of indice()) {
    let p = -1;
    const exacto = x.titulo.join(' ') === q.join(' ');
    if (exacto) p = 100;
    else if (encaja(q, x.titulo)) p = 60 + (x.titulo[0]!.startsWith(q[0]!) ? 10 : 0);
    // a synonym typed whole («osciloscopio», «snes») is as good as the name: above a name that merely contains it
    else if (x.todos.slice(1).some((n) => n.join(' ') === q.join(' '))) p = 80;
    else if (x.todos.slice(1).some((n) => encaja(q, n))) p = 30;
    if (p < 0) continue;
    puntuados.push({ l: x.lugar, p: p - ORDEN_TIPO[x.lugar.tipo] * 2 });
  }
  puntuados.sort((a, b) => b.p - a.p || a.l.titulo.length - b.l.titulo.length);
  // the book's «Índice» goes to the part read last, which changes while the app is open
  return puntuados.slice(0, max).map((x) => (x.l.id === 'parte:indice' ? { ...x.l, href: rutaContinuar() } : x.l));
}
