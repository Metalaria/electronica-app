// The book's data read from web/public/libro for the «modo docente» tests in Node: the bank, the exam context, the
// PDF's book data and its resources (fonts from node_modules/@fontsource, equations and figures from the files).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatosEjercicios } from '../../src/lib/ejercicios.svelte';
import type { Bloque, Indice } from '../../src/lib/tipos';
import type { Pregunta } from '../../src/componentes/repaso/datos';
import type { ItemNumerico, ItemPractica } from '../../src/componentes/practica/tipos';
import type { DatosBanco } from '../../src/lib/docente/banco';
import type { LibroPdf } from '../../src/lib/docente/pdf/documento';
import type { Recursos } from '../../src/lib/docente/pdf/maquetar';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
// EPA_LIBRO: a copy of the book folder (as scripts/libro-node.mjs), e.g. content regenerated outside the tree
export const LIBRO = process.env.EPA_LIBRO ? path.resolve(process.env.EPA_LIBRO) : path.join(AQUI, '..', '..', 'public', 'libro');
const MODULOS = path.join(AQUI, '..', '..', 'node_modules');
const json = <T>(r: string): T => JSON.parse(fs.readFileSync(path.join(LIBRO, r), 'utf8')) as T;

export function cargarLibro() {
  const indice = json<Indice>('indice.json');
  const ejercicios = json<DatosEjercicios>('ejercicios.json');
  const preguntas: Record<string, Pregunta[]> = {};
  for (const f of fs.readdirSync(path.join(LIBRO, 'repaso'))) {
    if (f === 'indice.json' || !f.endsWith('.json')) continue;
    const d = json<{ parte: string; preguntas: Pregunta[] }>(`repaso/${f}`);
    preguntas[d.parte] = d.preguntas;
  }
  const porId = new Map<string, Pregunta>();
  for (const l of Object.values(preguntas)) for (const p of l) porId.set(p.id, p);
  const indicePractica = json<{ ejercicios: Record<string, string> }>('practica/indice.json');
  const practicas = new Map<string, ItemPractica[]>();
  const numerico = (label: string): ItemNumerico | undefined => {
    const id = indicePractica.ejercicios[label];
    const it = ejercicios.items[label];
    if (!id || !it) return undefined;
    let l = practicas.get(it.parte);
    if (!l) practicas.set(it.parte, (l = json<{ items: ItemPractica[] }>(`practica/${it.parte}.json`).items));
    const x = l.find((p) => p.id === id);
    return x?.tipo === 'numerico' ? x : undefined;
  };
  const partes = new Map<string, { bloques: Bloque[] }>();
  const parte = (id: string) => {
    let p = partes.get(id);
    if (!p) partes.set(id, (p = json<{ bloques: Bloque[] }>(`partes/${id}.json`)));
    return p;
  };
  const banco: DatosBanco = { indice, ejercicios, preguntas, variables: indicePractica.ejercicios };
  const libro: LibroPdf = {
    ejercicio: (l) => ejercicios.items[l],
    pregunta: (id) => porId.get(id),
    numerico,
    variable: (label) => !!indicePractica.ejercicios[label],
    bloques: (label) => {
      const it = ejercicios.items[label];
      if (!it) return undefined;
      // 1.1: a new exercise (not in the book yet) carries its own statement and solution (lib/ejercicios.svelte.ts)
      if (it.nuevo) return { enunciado: it.enunciado ?? [], solucion: it.solucion ?? [] };
      const B = parte(it.parte).bloques;
      if (it.tipo === 'ej') {
        const b = B[it.pos[0]!] as { items: { bloques: Bloque[]; solucion?: Bloque[] | null }[] };
        const e = b.items[it.pos[1]!]!;
        return { enunciado: e.bloques, solucion: e.solucion ?? [] };
      }
      const [h, pide, fin] = it.pos as [number, number, number];
      return { enunciado: B.slice(h + 1, pide + 1), solucion: B.slice(pide + 1, fin) };
    },
    rotulo: (p) => {
      const i = indice.partes[p];
      if (!i) return p;
      const n = i.tipo === 'capitulo' ? `Capítulo ${i.num}` : i.tipo === 'apendice' ? `Apéndice ${i.num}` : '';
      return n ? `${n} · ${i.titulo}` : i.titulo;
    },
    seccion: (p, label) => indice.partes[p]?.secciones.find((s) => s.label === label) as { num: string | null; titulo: string } | undefined,
  };
  return { indice, ejercicios, preguntas, banco, libro, porId };
}

export const recursosNode: Recursos = {
  texto: async (r) => fs.readFileSync(path.join(LIBRO, r), 'utf8'),
  binario: async (r) => new Uint8Array(fs.readFileSync(path.join(LIBRO, r))),
  fuente: async (id) => {
    const [paquete, nombre] = id.split('/');
    return new Uint8Array(fs.readFileSync(path.join(MODULOS, '@fontsource', paquete!, 'files', `${paquete}-${nombre}.woff`)));
  },
};
