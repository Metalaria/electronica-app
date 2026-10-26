// Pictures of the glossary terms (lazy chunk of the glossary page): the circuit symbol, drawn here, and the
// 3D model of the gallery, whose thumbnail is rendered on this device only when the term comes into view
// (three.js is loaded then, never before). The mapping term → symbol / model is glosario-imagenes.json,
// written by contenido/glosario_imagenes.py.

import { leerJSON } from '../../lib/datos';
import type { TemaEfectivo } from '../../lib/color';
import { hrefModelo, modelo3d } from '../tres/catalogo3d';
import type { Parametros } from '../tres/modelos/tipos';
import { esClaveSimbolo, nombreSimbolo, svgSimbolo } from './simbolo';

interface Entrada {
  s?: string;
  m?: string;
  p?: Parametros;
}

interface Fichero {
  version: number;
  terminos: Record<string, Entrada>;
}

export interface ModeloTermino {
  tipo: string;
  p: Parametros;
  montaje: 'placa' | 'suelto';
  nombre: string;
  href: string;
}

export interface ImagenTermino {
  simbolo?: { svg: string; nombre: string };
  modelo?: ModeloTermino;
}

let carga: Promise<Map<string, ImagenTermino>> | null = null;

/** Pictures by glossary id (only terms that have something to show). */
export function cargarImagenes(): Promise<Map<string, ImagenTermino>> {
  carga ??= leerJSON<Fichero>('glosario-imagenes.json')
    .then((f) => {
      const m = new Map<string, ImagenTermino>();
      for (const [id, e] of Object.entries(f.terminos ?? {})) {
        const im: ImagenTermino = {};
        if (esClaveSimbolo(e.s)) im.simbolo = { svg: svgSimbolo(e.s), nombre: nombreSimbolo(e.s) };
        const mod = e.m ? modelo3d(e.m) : undefined;
        if (mod) {
          const p = { ...mod.defecto, ...(e.p ?? {}) };
          im.modelo = { tipo: mod.tipo, p, montaje: mod.montaje, nombre: mod.nombre, href: hrefModelo(mod.tipo, e.p) };
        }
        if (im.simbolo || im.modelo) m.set(id, im);
      }
      return m;
    })
    .catch(() => new Map<string, ImagenTermino>());
  return carga;
}

// ------------------------------------------------------------------ 3D thumbnails

/** Studio background of each theme (the 3D viewer's --fondo-3d). */
const FONDO_3D: Record<TemaEfectivo, string> = { claro: '#eeece6', sepia: '#ece2cc', oscuro: '#23272e' };

let webgl: boolean | null = null;

/** WebGL2 available (tests force it off with window.__epaSinWebGL = true, as the 3D pages do). */
export function hayWebGL2(): boolean {
  if ((globalThis as { __epaSinWebGL?: boolean }).__epaSinWebGL) return false;
  if (webgl != null) return webgl;
  try {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2');
    webgl = !!g;
    g?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl = false;
  }
  return webgl;
}

/** Thumbnails already made, by model, parameters and theme (object URLs, kept for the session). */
const hechas = new Map<string, Promise<string>>();

export function claveMiniatura(m: ModeloTermino, tema: TemaEfectivo): string {
  return `${m.tipo}|${JSON.stringify(m.p)}|${tema}`;
}

/** Object URL of a model's thumbnail for a theme (three.js is imported on the first call). */
export function miniaturaDe(m: ModeloTermino, tema: TemaEfectivo): Promise<string> {
  const clave = claveMiniatura(m, tema);
  let pr = hechas.get(clave);
  if (!pr) {
    pr = import('../tres/miniaturas').then(({ miniatura }) => miniatura(m.tipo, m.p, m.montaje, FONDO_3D[tema], tema === 'oscuro'));
    pr.catch(() => hechas.delete(clave));
    hechas.set(clave, pr);
  }
  return pr;
}
