// «Modo docente» (1.0): everything of the book an exam or a course can use, as one list — the 486 exercises and
// problems (ejercicios.json) and the 1028 Repaso questions (repaso/<parte>.json) — and the filters to choose from it
// (chapter, concept = h2 section, kind, «only what the app checks by itself»). Pure: the caller passes the data it
// loaded (lib/docente/fuentes.ts in the app, the JSON files in the tests). Nothing here is invented: every entry is an
// item of the book, with its own statement and solution. The book gives no difficulty, so there is no difficulty
// filter (the kinds exercise / problem / test question are the book's own).

import type { DatosEjercicios } from '../ejercicios.svelte';
import type { Indice } from '../tipos';
import type { Pregunta as PreguntaRepaso } from '../../componentes/repaso/datos';
import { generador, hash } from '../../componentes/practica/azar';
import type { FiltrosExamen, ItemExamen } from './tipos';

export type TipoEntrada = 'ejercicio' | 'problema' | 'pregunta';

export interface EntradaBanco {
  k: 'ejercicio' | 'pregunta';
  /** The exercise's label («ej-5.1», «prob-5.A») or the question's id («cap05-03»). */
  ref: string;
  parte: string;
  /** «<parte>/<label of its h2 section>», or null when the book does not place it in one. */
  concepto: string | null;
  tipo: TipoEntrada;
  /** Checked by the app entirely (numeric fields, structured questions, test questions); false if any part is self-assessed. */
  auto: boolean;
  /** Part checked by the app and part self-assessed (an exercise with numeric fields or questions and `otras`). */
  mixto: boolean;
  /** «5.1», «5.A»; for a question its number inside the chapter's test. */
  num: string;
  /** Plain-text start of the statement. */
  resumen: string;
  /** Position in the book (for the book order of a selection). */
  orden: number;
  /** A numeric exercise that a formula of the book reproduces: it can take other values. */
  variable: boolean;
}

export interface DatosBanco {
  indice: Indice;
  ejercicios: DatosEjercicios;
  /** Repaso questions by part (only the parts loaded; a missing part simply has none). */
  preguntas: Record<string, PreguntaRepaso[]>;
  /** practica/indice.json `ejercicios`: exercise label → practice item with changing values. */
  variables: Record<string, string>;
}

/** The h2 section of a reference inside a part (the same rule as aprendizaje/catalogo.ts conceptoDeRef). */
export function conceptoEn(indice: Indice, ejercicios: DatosEjercicios | null, parte: string, ref: string): string | null {
  const secs = indice.partes[parte]?.secciones ?? [];
  if (secs.some((s) => s.label === ref)) return `${parte}/${ref}`;
  const ej = ejercicios?.items[ref];
  if (ej?.seccion && ej.parte === parte) return `${parte}/${ej.seccion}`;
  let mejor: string | null = null;
  for (const s of secs) if (ref.startsWith(`${s.label}.`) && (!mejor || s.label.length > mejor.length)) mejor = s.label;
  return mejor ? `${parte}/${mejor}` : null;
}

/** Order of the parts in the book. */
export function ordenPartes(indice: Indice): string[] {
  return indice.tomos.flatMap((t) => t.partes);
}

const plano = (h: string) =>
  h
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

/** Number of a question inside its chapter's test: «cap05-03» → «3». */
export function numeroPregunta(id: string): string {
  const m = /-(\d+)$/.exec(id);
  return m ? String(Number(m[1])) : id;
}

/** Every entry, in book order (by part; inside a part: exercises and problems, then the test questions). */
export function bancoDe(d: DatosBanco): EntradaBanco[] {
  const partes = ordenPartes(d.indice);
  const pos = new Map(partes.map((p, i) => [p, i]));
  const r: EntradaBanco[] = [];
  for (const parte of partes) {
    const base = (pos.get(parte) ?? 0) * 10_000;
    const cap = d.ejercicios.capitulos.find((c) => c.parte === parte);
    let k = 0;
    for (const label of cap?.items ?? []) {
      const it = d.ejercicios.items[label];
      if (!it) continue;
      r.push({
        k: 'ejercicio',
        ref: label,
        parte,
        concepto: it.seccion ? `${parte}/${it.seccion}` : conceptoEn(d.indice, d.ejercicios, parte, label),
        tipo: it.tipo === 'prob' ? 'problema' : 'ejercicio',
        // final QA 1.0: an exercise that also asks to explain or design (`otras`) has a self-assessed part
        auto: it.modo === 'auto' && !(it.otras?.length ?? 0),
        mixto: it.modo === 'auto' && !!(it.otras?.length ?? 0),
        num: it.num,
        resumen: plano(it.titulo ? `${it.titulo}. ${it.resumen ?? ''}` : (it.resumen ?? '')),
        orden: base + k++,
        variable: !!d.variables[label],
      });
    }
    for (const p of d.preguntas[parte] ?? []) {
      r.push({
        k: 'pregunta',
        ref: p.id,
        parte,
        concepto: conceptoEn(d.indice, d.ejercicios, parte, p.ref),
        tipo: 'pregunta',
        auto: true,
        mixto: false,
        num: numeroPregunta(p.id),
        resumen: plano(p.enunciado),
        orden: base + 5_000 + k++,
        variable: false,
      });
    }
  }
  return r;
}

export const FILTROS_VACIOS: FiltrosExamen = { partes: [], conceptos: [], tipos: [], soloAuto: false, cantidad: 10 };

/** The entries that pass the filters (book order). Empty lists mean «any». */
export function filtrar(banco: readonly EntradaBanco[], f: FiltrosExamen): EntradaBanco[] {
  const partes = new Set(f.partes);
  const conceptos = new Set(f.conceptos);
  const tipos = new Set(f.tipos);
  return banco.filter(
    (e) =>
      (!partes.size || partes.has(e.parte)) &&
      (!conceptos.size || (e.concepto != null && conceptos.has(e.concepto))) &&
      (!tipos.size || tipos.has(e.tipo)) &&
      (!f.soloAuto || e.auto),
  );
}

/** Default points of an item (the reader changes them in the editor). */
export function puntosPorDefecto(e: Pick<EntradaBanco, 'tipo'>): number {
  return e.tipo === 'pregunta' ? 1 : e.tipo === 'problema' ? 3 : 2;
}

/**
 * Chooses `f.cantidad` entries that pass the filters, with a seeded draw (the same filters and seed always give the
 * same exam), spread over the chosen chapters as evenly as they allow, returned in book order.
 */
export function elegirPorFiltros(banco: readonly EntradaBanco[], f: FiltrosExamen, semilla: number, excluir: ReadonlySet<string> = new Set()): ItemExamen[] {
  const candidatos = filtrar(banco, f).filter((e) => !excluir.has(`${e.k}:${e.ref}`));
  const n = Math.max(0, Math.min(Math.floor(f.cantidad), candidatos.length));
  const porParte = new Map<string, EntradaBanco[]>();
  for (const e of candidatos) {
    let l = porParte.get(e.parte);
    if (!l) porParte.set(e.parte, (l = []));
    l.push(e);
  }
  // each part's entries shuffled with its own stream; then round robin over the parts (book order)
  const colas = [...porParte.entries()].map(([parte, l]) => {
    const rnd = generador(hash(`${semilla}|${parte}`));
    const a = [...l];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  });
  const elegidas: EntradaBanco[] = [];
  for (let ronda = 0; elegidas.length < n; ronda++) {
    let alguna = false;
    for (const c of colas) {
      if (elegidas.length >= n) break;
      const e = c[ronda];
      if (!e) continue;
      elegidas.push(e);
      alguna = true;
    }
    if (!alguna) break;
  }
  return elegidas.sort((a, b) => a.orden - b.orden).map((e) => ({ k: e.k, ref: e.ref, puntos: puntosPorDefecto(e) }));
}

/** The entry of an item, if the book still has it. */
export function entradaDe(banco: readonly EntradaBanco[], k: 'ejercicio' | 'pregunta', ref: string): EntradaBanco | undefined {
  return banco.find((e) => e.k === k && e.ref === ref);
}
