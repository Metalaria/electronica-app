// «Estudiar por pasos» (0.9): a section of the book as a short lesson, one screen per step.
//
// Steps are automatic, «por subapartados» (lib/leccion-pasos.ts): each h3 of the h2 section is one step,
// and the blocks before the first h3 (if any) are step 0, the section's introduction. Sections without h3
// are split at their h4 headings or into runs of about one screen; a very long h3 subsection is split the
// same way into «continuación» steps. After the steps come the Repaso questions about that section
// (repaso/<parte>.json whose `ref` is the section or anything inside it: a subsection, a problem…).
//
// Progress per section is stored with the reader's other learning data (almacen key `lecciones`:
// «<parte>/<label>» → ProgresoGuardado) and synchronised (lib/sincronizacion/registro.svelte.ts).
//
// Contract with the start page (scratchpad contrato09.md): pasosDeSeccion, progresoLeccion, ultimaLeccion,
// rutaLeccion. Step indices are 0-based everywhere (the URL shows them 1-based).

import type { Bloque, BH2, Parte } from './tipos';
import { calcularPasos, finDeSeccion, type PasoLeccion } from './leccion-pasos';
import { cargarParte, infoParte, obtenerIndice, rotuloParte, textoPlano } from './datos';
import { obtenerAlmacen, type Almacen } from './almacen';
import { anotarCambio } from './sincronizacion/marcas';
import { corto, pasoVecino } from './navegacion.svelte';
import type { Pregunta } from '../componentes/repaso/datos';

export type { PasoLeccion };

// ------------------------------------------------------------------ lessons

export interface Leccion {
  parte: string;
  /** Section label (route segment). */
  seccion: string;
  num: string;
  titulo: string;
  html: string;
  /** «Capítulo 5 · Diodos». */
  capitulo: string;
  /** Block colour of the part (hex without #). */
  color: string;
  pasos: PasoLeccion[];
  /** Index of the section's h2 in the part. */
  h2: number;
}

/** «Capítulo 5 · Diodos», «Apéndice A · …», or the title of back matter. */
export function rotuloCapitulo(parte: string): string {
  const info = infoParte(parte);
  if (!info) return parte;
  const t = corto(info.titulo);
  return info.num != null && (info.tipo === 'capitulo' || info.tipo === 'apendice') ? `${rotuloParte(parte)} · ${t}` : t;
}

const cache = new Map<string, Promise<Leccion>>();

/** Steps of the sections computed this session (reactive: ultimaLeccion of a section not started yet). */
const conteos = $state<Record<string, number>>({});

/** The lesson of a section (the part is fetched once and cached by datos.ts). */
export function cargarLeccion(parte: string, seccion: string): Promise<Leccion> {
  const id = `${parte}/${seccion}`;
  let p = cache.get(id);
  if (!p) {
    p = cargarParte(parte).then((d: Parte) => {
      const h2 = d.bloques.findIndex((b) => b.t === 'h2' && b.label === seccion);
      if (h2 < 0) throw new Error(`No existe la sección «${seccion}» en «${parte}»`);
      const b = d.bloques[h2] as BH2;
      const pasos = calcularPasos(d.bloques, h2);
      conteos[id] = pasos.length;
      return {
        parte,
        seccion,
        num: b.num ?? '',
        titulo: textoPlano(b.html),
        html: b.html,
        capitulo: rotuloCapitulo(parte),
        color: d.color ?? infoParte(parte)?.color ?? '1A3A5C',
        pasos,
        h2,
      };
    });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/** Labels of every block inside a section (its h2, h3s, figures, problems…): what a question may cite. */
export function etiquetasDeSeccion(bloques: Bloque[], h2: number): Set<string> {
  const r = new Set<string>();
  const poner = (b: Bloque) => {
    if (b.label) r.add(b.label);
    if ('bloques' in b && Array.isArray(b.bloques)) for (const x of b.bloques) poner(x);
    if (b.t === 'ejercicios') for (const it of b.items) if (it.label) r.add(it.label);
  };
  const fin = finDeSeccion(bloques, h2);
  for (let i = h2; i < fin; i++) poner(bloques[i]!);
  return r;
}

/** The Repaso questions about the lesson's section, in the quiz's order (none when the part has no quiz). */
export async function preguntasDeLeccion(l: Leccion): Promise<Pregunta[]> {
  const [{ cargarCuestionario }, d] = await Promise.all([import('../componentes/repaso/datos'), cargarParte(l.parte)]);
  const c = await cargarCuestionario(l.parte).catch(() => null);
  if (!c) return [];
  const dentro = etiquetasDeSeccion(d.bloques, l.h2);
  return c.preguntas.filter((p) => dentro.has(p.ref));
}

/** Contract: the steps of a section's lesson and how many Repaso questions follow them. */
export async function pasosDeSeccion(
  parte: string,
  seccion: string,
): Promise<{ titulo: string; num: string; pasos: { titulo: string }[]; preguntas: number }> {
  const l = await cargarLeccion(parte, seccion);
  const preguntas = (await preguntasDeLeccion(l).catch(() => [])).length;
  return { titulo: l.titulo, num: l.num, pasos: l.pasos.map((p) => ({ titulo: p.titulo })), preguntas };
}

// ------------------------------------------------------------------ progress

/** Stored per section, key «<parte>/<label>». */
export interface ProgresoGuardado {
  /** Steps completed (0-based indices, sorted). */
  h: number[];
  /** Last screen shown (0-based step; the questions and the summary come after the last step). */
  u: number;
  /** Number of steps when last studied. */
  n: number;
  /** Time the lesson was completed (ms), 0 if never. */
  c: number;
  /** Modification time (ms). */
  t: number;
}

export const progresoLecciones = $state({
  listo: false,
  secciones: {} as Record<string, ProgresoGuardado>,
});

let almacen: Almacen | null = null;
let carga: Promise<void> | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;

function escribir(): void {
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  void almacen?.escribir('lecciones', $state.snapshot(progresoLecciones.secciones));
}

function guardar(): void {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(escribir, 400);
}

/** Loads the stored progress (once). */
export function cargarLecciones(): Promise<void> {
  carga ??= (async () => {
    almacen = await obtenerAlmacen();
    const v = await almacen.leer<Record<string, ProgresoGuardado>>('lecciones');
    // Changes made before the stored data arrived win (they are newer).
    if (v && typeof v === 'object') progresoLecciones.secciones = { ...v, ...progresoLecciones.secciones };
    progresoLecciones.listo = true;
    if (temporizador) escribir();
    if (typeof window !== 'undefined') {
      const volcar = () => {
        if (temporizador) escribir();
      };
      window.addEventListener('pagehide', volcar);
      window.addEventListener('epa:antes-de-sincronizar', volcar);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') volcar();
      });
    }
  })();
  return carga;
}

/** Starts loading from a reactive getter (the load mutates state later, never synchronously). */
function pedirCarga(): void {
  if (!carga && typeof window !== 'undefined') queueMicrotask(() => void cargarLecciones());
}

function asegurar(parte: string, seccion: string, n: number): ProgresoGuardado {
  const id = `${parte}/${seccion}`;
  progresoLecciones.secciones[id] ??= { h: [], u: 0, n, c: 0, t: 0 };
  const p = progresoLecciones.secciones[id]!;
  p.n = n;
  return p;
}

function cambiado(parte: string, seccion: string, p: ProgresoGuardado): void {
  p.t = Date.now();
  anotarCambio('lecciones', `${parte}/${seccion}`);
  if (almacen) guardar();
  else void cargarLecciones().then(guardar);
}

/** The screen on show: a step (0…n−1), a question or the summary (n and after). */
export function anotarPaso(parte: string, seccion: string, paso: number, n: number): void {
  const p = asegurar(parte, seccion, n);
  if (p.u === paso && p.t) return;
  p.u = paso;
  cambiado(parte, seccion, p);
}

/** A step completed («Continuar» on it). Returns true the first time. */
export function completarPaso(parte: string, seccion: string, paso: number, n: number): boolean {
  const p = asegurar(parte, seccion, n);
  if (p.h.includes(paso)) return false;
  p.h = [...p.h, paso].sort((a, b) => a - b);
  cambiado(parte, seccion, p);
  return true;
}

/** The whole lesson done (the summary screen). Returns true the first time. */
export function completarLeccion(parte: string, seccion: string, n: number): boolean {
  const p = asegurar(parte, seccion, n);
  const primera = !p.c;
  p.c = Date.now();
  p.h = Array.from({ length: n }, (_, k) => k);
  p.u = n;
  cambiado(parte, seccion, p);
  return primera;
}

/** Contract: progress of a section's lesson (reactive), null if never started. */
export function progresoLeccion(parte: string, seccion: string): { hechos: number; total: number; ultimo: number; completada: boolean } | null {
  pedirCarga();
  const p = progresoLecciones.secciones[`${parte}/${seccion}`];
  if (!p) return null;
  const total = Math.max(1, p.n);
  return { hechos: Math.min(total, p.h.length), total, ultimo: Math.min(p.u, total - 1), completada: !!p.c };
}

/**
 * Contract: the lesson to «Seguir» (reactive). The section studied last, at its last step; when that lesson
 * was completed, the next section of the book (at its first step, or where it was left). `paso` is 0-based;
 * `pasos` is 0 while the next section's steps are not known yet (they are computed in the background).
 */
export function ultimaLeccion(): { parte: string; seccion: string; num: string; titulo: string; capitulo: string; paso: number; pasos: number } | null {
  pedirCarga();
  let ultima: [string, ProgresoGuardado] | null = null;
  for (const e of Object.entries(progresoLecciones.secciones)) if (!ultima || e[1].t > ultima[1].t) ultima = e;
  if (!ultima) return null;
  let indice;
  try {
    indice = obtenerIndice();
  } catch {
    return null;
  }
  const [id, p] = ultima;
  const i = id.indexOf('/');
  let parte = id.slice(0, i);
  let seccion = id.slice(i + 1);
  let paso = Math.min(p.u, Math.max(0, p.n - 1));
  let pasos = p.n;
  if (p.c) {
    let v = pasoVecino(parte, seccion, 1);
    while (v && !v.label) v = pasoVecino(v.parte, v.label, 1);
    if (!v?.label) return null;
    parte = v.parte;
    seccion = v.label;
    const previo = progresoLecciones.secciones[`${parte}/${seccion}`];
    paso = previo && !previo.c ? Math.min(previo.u, Math.max(0, previo.n - 1)) : 0;
    pasos = previo?.n ?? conteos[`${parte}/${seccion}`] ?? 0;
    if (!pasos) {
      const [a, b] = [parte, seccion];
      queueMicrotask(() => void cargarLeccion(a, b).catch(() => undefined));
    }
  }
  const s = indice.partes[parte]?.secciones?.find((x) => x.label === seccion);
  if (!s) return null;
  return { parte, seccion, num: s.num ?? '', titulo: s.titulo, capitulo: rotuloCapitulo(parte), paso, pasos };
}

/** Contract: hash route of a lesson; `paso` is 0-based (the URL shows it 1-based). */
export function rutaLeccion(parte: string, seccion: string, paso?: number): string {
  const base = `#/leccion/${parte}/${encodeURIComponent(seccion)}`;
  return paso != null && paso > 0 ? `${base}/${paso + 1}` : base;
}
