// Every route of the app, enumerated from its data (Node side): the book's parts, sections, figures and
// glossary, the simulator's netlists, the editor, the breadboard, instruments, consoles × tabs, KiCad boards ×
// views, animations, 3D models, calculators, exercises, Repaso, diagnostics, settings and synchronisation.
// The lessons («Estudiar por pasos») are walked screen by screen by barridos.spec.ts (pantallasDeLeccion below).
import { readFileSync } from 'node:fs';
import { ANIMACIONES } from '../../src/componentes/animaciones/catalogo.ts';
import { CONCEPTOS } from '../../src/componentes/animaciones/conceptos/catalogo.ts';
import { MODELOS_3D } from '../../src/componentes/tres/catalogo3d.ts';
import { IDS_MAQUINA } from '../../src/componentes/consolas/datos.ts';
import { PLACAS_DE } from '../../src/componentes/consolas/placa/datos.ts';
import { PESTANAS as PESTANAS_CONSOLA } from '../../src/componentes/consolas/estado.svelte.ts';
import { VISTAS as VISTAS_PROYECTO } from '../../src/componentes/proyectos/estado.ts';
import { calcularPasos } from '../../src/lib/leccion-pasos.ts';
import type { Bloque, Indice } from '../../src/lib/tipos.ts';
import type { PracticaParte } from '../../src/componentes/practica/tipos.ts';
import { CURSOS } from '../../src/lib/aprendizaje/cursos.ts';
import { MODO, type Perfil } from './perfiles.ts';
import type { Accion012 } from './novedades.ts';

const PUBLICO = new URL('../../public/', import.meta.url);
export const leerJson = <T>(ruta: string): T => JSON.parse(readFileSync(new URL(ruta, PUBLICO), 'utf8')) as T;

/** What to do on the page besides looking at it. */
export type Accion = 'visor' | 'ajustes' | 'buscar' | 'menu' | Accion012;

export interface Ruta {
  /** Stable id (also the sampling key). */
  id: string;
  /** Location hash, «#/…». */
  hash: string;
  grupo: string;
  accion?: Accion;
  /** 3D or heavy page: waits longer and counts WebGL contexts. */
  pesada?: boolean;
  /** Always visited, even in the quick mode (index pages of each group). */
  siempre?: boolean;
  /** Long page: the checks cover the whole document, not only the viewport. */
  completa?: boolean;
}

/** Stable pseudo-random number in [0, 1) from a string (FNV-1a), for deterministic samples. */
export function azarDe(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

interface SpiceIndice {
  netlists: Record<string, { parte: string; motor: { estado: string; pesada?: boolean; xspice?: boolean; alternativa?: string; original?: string; nota?: string }; refs: string[]; titulo: string }>;
  porRef: Record<string, string[]>;
}

export const indice = (): Indice => leerJson<Indice>('libro/indice.json');
export const spice = (): SpiceIndice => leerJson<SpiceIndice>('libro/spice.json');

/** Blocks of a part, with the nested ones (boxes, deductions, exercises and their solutions). */
export function recorrer(bloques: Bloque[], f: (b: Bloque) => void): void {
  for (const b of bloques) {
    f(b);
    const x = b as unknown as { bloques?: Bloque[]; items?: { bloques?: Bloque[]; solucion?: Bloque[] | null }[]; t: string };
    if (Array.isArray(x.bloques)) recorrer(x.bloques, f);
    if (x.t === 'ejercicios' && Array.isArray(x.items))
      for (const it of x.items) {
        if (it.bloques) recorrer(it.bloques, f);
        if (it.solucion) recorrer(it.solucion, f);
      }
  }
}

export function bloquesDe(parte: string): Bloque[] {
  return leerJson<{ bloques: Bloque[] }>(`libro/partes/${parte}.json`).bloques;
}

export function todasLasRutas(): Ruta[] {
  const r: Ruta[] = [];
  const ind = indice();
  const orden = ind.tomos.flatMap((t) => t.partes);
  const partes = [...orden, ...Object.keys(ind.partes).filter((p) => !orden.includes(p))];

  // ---- start, reader, glossary, bookmarks, search, settings
  r.push({ id: 'inicio', hash: '#/', grupo: 'inicio', siempre: true, completa: true });
  r.push({ id: 'ajustes', hash: '#/', grupo: 'inicio', accion: 'ajustes', siempre: true });
  r.push({ id: 'buscar', hash: '#/', grupo: 'inicio', accion: 'buscar', siempre: true });
  r.push({ id: 'menu-herramientas', hash: '#/', grupo: 'inicio', accion: 'menu', siempre: true });
  r.push({ id: 'marcadores', hash: '#/marcadores', grupo: 'inicio', siempre: true });
  for (const p of partes) {
    if (p === 'glosario') continue;
    r.push({ id: `parte:${p}`, hash: `#/${p}`, grupo: 'libro', completa: true, siempre: p === 'cap05' });
    for (const s of ind.partes[p]?.secciones ?? []) r.push({ id: `seccion:${p}/${s.label}`, hash: `#/${p}/${s.label}`, grupo: 'secciones' });
    recorrer(bloquesDe(p), (b) => {
      if (b.t === 'figura' && b.label) r.push({ id: `figura:${p}/${b.label}`, hash: `#/${p}/${b.label}`, grupo: 'figuras', accion: 'visor' });
    });
  }
  r.push({ id: 'glosario', hash: '#/glosario', grupo: 'glosario', siempre: true, completa: true });
  const glos = bloquesDe('glosario').flatMap((b) => (b.t === 'glosario' ? (b as unknown as { entradas: { id: string }[] }).entradas : []));
  // one entry in ten: the page check above already covers the whole list
  glos.forEach((e, k) => {
    if (k % 10 === 0) r.push({ id: `glosario:${e.id}`, hash: `#/glosario/${e.id}`, grupo: 'glosario' });
  });

  // ---- simulator, editor, breadboard
  const sp = spice();
  r.push({ id: 'simulador', hash: '#/simulador', grupo: 'simulador', siempre: true, completa: true });
  r.push({ id: 'simulador:nuevo', hash: '#/simulador/nuevo', grupo: 'simulador', siempre: true });
  for (const id of Object.keys(sp.netlists)) r.push({ id: `simulador:${id}`, hash: `#/simulador/${id}`, grupo: 'simulador' });
  r.push({ id: 'editor', hash: '#/editor', grupo: 'editor', siempre: true });
  r.push({ id: 'editor:importar', hash: '#/editor/importar', grupo: 'editor' });
  for (const id of Object.keys(sp.netlists)) r.push({ id: `editor:${id}`, hash: `#/editor/libro/${id}`, grupo: 'editor' });
  r.push({ id: 'protoboard', hash: '#/protoboard', grupo: 'protoboard', siempre: true });

  // ---- instruments and the FM7303 kit
  r.push({ id: 'instrumentos', hash: '#/instrumentos', grupo: 'instrumentos', siempre: true });
  for (let n = 1; n <= 12; n++) r.push({ id: `instrumentos:practica/${n}`, hash: `#/instrumentos/practica/${n}`, grupo: 'instrumentos', pesada: true });
  r.push({ id: 'instrumentos:libre', hash: '#/instrumentos/libre', grupo: 'instrumentos', siempre: true });
  const ids = Object.keys(sp.netlists).filter((id) => sp.netlists[id]!.motor.estado === 'ok' && !sp.netlists[id]!.motor.pesada);
  for (const id of ids.filter((id) => azarDe(id) < 0.06)) r.push({ id: `instrumentos:circuito/${id}`, hash: `#/instrumentos/circuito/${id}`, grupo: 'instrumentos', pesada: true });
  for (const c of ['esquema', 'senal', 'alineacion', 'averias']) r.push({ id: `fm7303:${c}`, hash: `#/fm7303/${c}`, grupo: 'fm7303', siempre: c === 'esquema' });

  // ---- consoles × tabs (no board tabs where there is no board; the Master System's is the reconstructed one, 0.11)
  r.push({ id: 'consolas', hash: '#/consolas', grupo: 'consolas', siempre: true });
  for (const m of IDS_MAQUINA)
    for (const p of PESTANAS_CONSOLA) {
      if ((p.id === 'placa3d' || p.id === 'placa2d') && !PLACAS_DE[m]?.length) continue;
      r.push({ id: `consolas:${m}/${p.id}`, hash: `#/consolas/${m}/${p.id}`, grupo: 'consolas', pesada: p.id === 'placa3d' || p.id === 'placa2d' });
    }

  // ---- KiCad projects × views
  r.push({ id: 'proyectos', hash: '#/proyectos', grupo: 'proyectos', siempre: true });
  const proy = leerJson<{ proyectos: { placas: { id: string }[] }[] }>('proyectos/indice.json');
  for (const p of proy.proyectos)
    for (const pl of p.placas)
      for (const v of VISTAS_PROYECTO) r.push({ id: `proyectos:${pl.id}/${v.id}`, hash: `#/proyectos/${pl.id}/${v.id}`, grupo: 'proyectos', pesada: v.id === '3d' || v.id === 'placa' });

  // ---- animations and 3D models
  r.push({ id: 'componentes', hash: '#/componentes', grupo: 'componentes', siempre: true, completa: true });
  for (const a of ANIMACIONES) r.push({ id: `componentes:${a.id}`, hash: `#/componentes/${a.id}`, grupo: 'componentes' });
  r.push({ id: 'componentes:3d', hash: '#/componentes/3d', grupo: 'modelos3d', siempre: true, completa: true });
  for (const m of MODELOS_3D) r.push({ id: `modelos3d:${m.tipo}`, hash: `#/componentes/3d/${m.tipo}`, grupo: 'modelos3d', pesada: true });
  r.push({ id: 'conceptos', hash: '#/conceptos', grupo: 'conceptos', siempre: true, completa: true });
  for (const c of CONCEPTOS) r.push({ id: `conceptos:${c.id}`, hash: `#/conceptos/${c.id}`, grupo: 'conceptos' });

  // ---- calculators, exercises, Repaso
  r.push({ id: 'calculadoras', hash: '#/calculadoras', grupo: 'calculadoras', siempre: true, completa: true });
  for (const f of leerJson<{ formulas: { id: string }[] }>('libro/formulas.json').formulas)
    r.push({ id: `calculadoras:${f.id}`, hash: `#/calculadoras/${f.id}`, grupo: 'calculadoras' });
  r.push({ id: 'ejercicios', hash: '#/ejercicios', grupo: 'ejercicios', siempre: true, completa: true });
  r.push({ id: 'ejercicios:repaso', hash: '#/ejercicios/repaso', grupo: 'ejercicios', siempre: true });
  r.push({ id: 'repaso', hash: '#/repaso', grupo: 'repaso', siempre: true, completa: true });
  for (const v of ['tarjetas', 'examen', 'repasar']) r.push({ id: `repaso:${v}`, hash: `#/repaso/${v}`, grupo: 'repaso', siempre: true });
  for (const p of leerJson<{ partes: string[] }>('libro/practica/indice.json').partes) r.push({ id: `repaso:practica/${p}`, hash: `#/repaso/practica/${p}`, grupo: 'repaso' });
  for (const p of partes) {
    try {
      leerJson(`libro/repaso/${p}.json`);
      r.push({ id: `repaso:test/${p}`, hash: `#/repaso/test/${p}`, grupo: 'repaso' });
    } catch {
      /* the part has no quiz */
    }
  }

  // ---- the rest
  r.push({ id: 'diagnostico', hash: '#/diagnostico', grupo: 'otros', siempre: true });
  r.push({ id: 'sincronizacion', hash: '#/sincronizacion', grupo: 'otros', siempre: true });

  // ---- 0.11 group A: thematic courses (each one and its placement test's intro) and «Progreso y logros»
  r.push({ id: 'cursos', hash: '#/cursos', grupo: 'cursos', siempre: true, completa: true });
  for (const c of CURSOS) {
    r.push({ id: `cursos:${c.id}`, hash: `#/cursos/${c.id}`, grupo: 'cursos', completa: true });
    r.push({ id: `cursos:${c.id}/prueba`, hash: `#/cursos/${c.id}/prueba`, grupo: 'cursos' });
  }
  r.push({ id: 'progreso', hash: '#/progreso', grupo: 'cursos', siempre: true, completa: true });

  // ---- 0.11 group B: mastery per concept, «Práctica inteligente» (global, a chapter, a section), problem of the day
  r.push({ id: 'progreso:dominio', hash: '#/progreso/dominio', grupo: 'aprendizaje', siempre: true, completa: true });
  r.push({ id: 'practicar', hash: '#/practicar', grupo: 'aprendizaje', siempre: true, completa: true });
  r.push({ id: 'practicar:cap05', hash: '#/practicar/cap05', grupo: 'aprendizaje' });
  r.push({ id: 'practicar:cap05/sec-5.1', hash: '#/practicar/cap05/sec-5.1', grupo: 'aprendizaje' });
  r.push({ id: 'practicar:cap23', hash: '#/practicar/cap23', grupo: 'aprendizaje' });
  r.push({ id: 'problema', hash: '#/problema', grupo: 'aprendizaje', siempre: true, completa: true });
  r.push({ id: 'problema:ayer', hash: '#/problema/ayer', grupo: 'aprendizaje', siempre: true });
  // lesson steps with an explorable live schematic (figuras-vivas/esquema/ExploraEsquema.svelte)
  r.push({ id: 'leccion-explora:cap01/sec-1.4/5', hash: '#/leccion/cap01/sec-1.4/clasica/5', grupo: 'aprendizaje' }); // 1.1: the 1.0 lesson of 1.4
  r.push({ id: 'leccion-explora:cap22/sec-22.1', hash: '#/leccion/cap22/sec-22.1', grupo: 'aprendizaje' });

  // ---- 0.12 (novedades.ts): every state of the new interface, in every profile and layout variant
  // the backup card (#/sincronizacion/copia), its preview, «Sustituir todo», the result, the files it refuses and the
  // undo of a replacement; «Aa» → «Exportar copia»
  r.push({ id: 'copia', hash: '#/sincronizacion/copia', grupo: 'copia', siempre: true });
  r.push({ id: 'copia:aa-exportar', hash: '#/', grupo: 'copia', accion: 'aa-exportar', siempre: true });
  for (const a of ['copia-unir', 'copia-sustituir', 'copia-resultado', 'copia-danada', 'copia-ajena', 'copia-nueva', 'copia-deshacer'] as const)
    r.push({ id: `copia:${a}`, hash: '#/sincronizacion/copia', grupo: 'copia', accion: a, siempre: true });
  // the in-app confirmation (Confirmacion.svelte): «Borrar» a montage, «Nuevo» over an unsaved circuit
  r.push({ id: 'confirmacion:protoboard', hash: '#/protoboard', grupo: 'confirmacion', accion: 'confirmar-borrar', siempre: true });
  r.push({ id: 'confirmacion:editor', hash: '#/editor/libro/cap05/sec-5.3_led_150ohm', grupo: 'confirmacion', accion: 'confirmar-nuevo', siempre: true });
  // the signed updater (Windows and macOS through the test bridge): «Aa», the notice and the synchronisation page
  for (const a of ['actualizador-disponible', 'actualizador-descargando', 'actualizador-listo', 'actualizador-error', 'actualizador-mac'] as const)
    r.push({ id: `actualizador:${a.slice(13)}`, hash: '#/', grupo: 'actualizador', accion: a, siempre: true });
  r.push({ id: 'actualizador:aviso', hash: '#/cap05', grupo: 'actualizador', accion: 'actualizador-aviso', siempre: true });
  r.push({ id: 'actualizador:pagina', hash: '#/sincronizacion', grupo: 'actualizador', accion: 'actualizador-pagina', siempre: true });
  // the day's activity summed across devices (lib/progreso-dias.ts): the start page's goal and «Progreso y logros»
  r.push({ id: 'actividad:inicio', hash: '#/', grupo: 'actividad', accion: 'dias-sumados', siempre: true, completa: true });
  r.push({ id: 'actividad:progreso', hash: '#/progreso', grupo: 'actividad', accion: 'dias-sumados', siempre: true, completa: true });
  return r;
}

/** The routes a profile visits: all in the tablet, a sample elsewhere; the quick mode samples ~1 in 12. */
export function rutasDe(perfil: Perfil): Ruta[] {
  const filtro = process.env.QA_FILTRO ? new RegExp(process.env.QA_FILTRO) : null;
  const factor = MODO === 'rapido' ? 0.08 : 1;
  return todasLasRutas().filter((r) => {
    if (filtro && !filtro.test(r.id)) return false;
    if (filtro) return true;
    if (r.siempre) return true;
    return azarDe(`${perfil.id}:${r.id}`) < perfil.fraccion * factor;
  });
}

// ------------------------------------------------------------------ lessons

export interface Leccion {
  parte: string;
  seccion: string;
  /** Screens, as the lesson routes name them: «1», «practica-2», «pregunta-1», «fin». */
  pantallas: string[];
  /** Practice item ids, in order. */
  items: string[];
  preguntas: number;
}

/** Every lesson of the book with its screens (same rules as practica/datos.ts pantallasLeccion). */
export function lecciones(): Leccion[] {
  const ind = indice();
  const r: Leccion[] = [];
  const practicas = new Set(leerJson<{ partes: string[] }>('libro/practica/indice.json').partes);
  for (const parte of ind.tomos.flatMap((t) => t.partes)) {
    if (parte === 'glosario') continue;
    const bl = bloquesDe(parte);
    const pr = practicas.has(parte) ? leerJson<PracticaParte>(`libro/practica/${parte}.json`) : null;
    let quiz: { ref: string }[] = [];
    try {
      quiz = leerJson<{ preguntas: { ref: string }[] }>(`libro/repaso/${parte}.json`).preguntas;
    } catch {
      /* no quiz */
    }
    bl.forEach((b, h2) => {
      if (b.t !== 'h2' || !b.label) return;
      const pasos = calcularPasos(bl, h2);
      // labels inside the section (lecciones.svelte.ts etiquetasDeSeccion)
      let fin = bl.findIndex((x, k) => k > h2 && x.t === 'h2');
      if (fin < 0) fin = bl.length;
      const dentro = new Set<string>();
      recorrer(bl.slice(h2, fin), (x) => {
        if (x.label) dentro.add(x.label);
      });
      const preguntas = quiz.filter((q) => dentro.has(q.ref)).length;
      const items = pr?.secciones[b.label]?.items ?? [];
      const bloques = items.map((id) => pr!.items.find((x) => x.id === id)?.bloque ?? 0);
      const tras = new Map<number, number[]>();
      bloques.forEach((bq, i) => {
        let k = pasos.length - 1;
        const dentroDe = pasos.findIndex((p) => bq >= p.desde && bq < p.hasta);
        if (dentroDe >= 0) k = dentroDe;
        else {
          let mejor = pasos.length - 1;
          for (let j = 0; j < pasos.length; j++) if (pasos[j]!.desde <= bq) mejor = j;
          k = Math.max(0, mejor);
        }
        (tras.get(k) ?? tras.set(k, []).get(k)!).push(i);
      });
      const pantallas: string[] = [];
      for (let k = 0; k < pasos.length; k++) {
        pantallas.push(String(k + 1));
        for (const i of tras.get(k) ?? []) pantallas.push(`practica-${i + 1}`);
      }
      for (let i = 0; i < preguntas; i++) pantallas.push(`pregunta-${i + 1}`);
      pantallas.push('fin');
      r.push({ parte, seccion: b.label, pantallas, items, preguntas });
    });
  }
  return r;
}
