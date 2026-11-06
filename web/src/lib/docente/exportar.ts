// «Modo docente» (1.0): builds and saves the PDFs — the exam, its solutions and a course's outline — on every
// platform the same way: generated here, in JavaScript (Android's WebView cannot print, and the system's «print to
// PDF» would not give the same file on each device), then saved with the system's dialog (Tauri: the app's own
// command, the PDF as base64) or downloaded (browser). pdf-lib and the fonts are loaded only when a PDF is made.

import { guardarBinario, CANCELADO } from '../sincronizacion/fichero';
import { libro, prepararItems, recursos } from './fuentes';
import { montarExamen } from './examen';
import type { CursoPropio, EspacioRespuesta, ExamenPropio } from './tipos';
import type { InformePdf } from './pdf/maquetar';

export type TipoPdf = 'examen' | 'soluciones' | 'curso';

export interface PedidoPdf {
  tipo: TipoPdf;
  variante: number;
  fecha: string;
  espacio: EspacioRespuesta;
}

/** «Examen de diodos — variante A.pdf» without characters that file systems refuse. */
export function nombreFichero(titulo: string, tipo: TipoPdf, letra: string): string {
  const base = (titulo || (tipo === 'curso' ? 'Curso' : 'Examen')).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (tipo === 'curso') return `${base} — índice.pdf`;
  return `${base} — ${tipo === 'soluciones' ? 'soluciones, ' : ''}variante ${letra}.pdf`;
}

/** Makes the PDF of an own exam or course (does not save it). */
export async function generar(p: ExamenPropio | CursoPropio, pedido: PedidoPdf): Promise<InformePdf & { nombre: string }> {
  const [{ generarPdf }, doc] = await Promise.all([import('./pdf/maquetar'), import('./pdf/documento')]);
  if (p.tipo === 'curso') {
    const elementos = p.curso?.elementos ?? [];
    await prepararItems(elementos.map((e) => (e.k === 'seccion' ? { k: 'seccion' as const, ref: e.label, parte: e.parte } : e.k === 'ejercicio' ? { k: 'ejercicio' as const, ref: e.label } : { k: 'pregunta' as const, ref: e.id })));
    const r = await generarPdf(doc.documentoCurso({ titulo: p.titulo, notas: p.notas, elementos, creado: p.creado }, libro), recursos);
    anotarParaPruebas(r);
    return { ...r, nombre: nombreFichero(p.titulo, 'curso', '') };
  }
  const def = p.examen!;
  await prepararItems(def.items);
  const ex = montarExamen({ ...def, espacio: pedido.espacio }, libro, pedido.variante);
  // (review 10h, r10h·2: never a paper with the book's values where the variant's go, nor one with fewer questions)
  if (ex.faltan.length) throw new Error(`faltan ${ex.faltan.length === 1 ? 'una pregunta' : `${ex.faltan.length} preguntas`} del examen en el contenido de la aplicación`);
  const o = { titulo: p.titulo, notas: p.notas, fecha: pedido.fecha, espacio: pedido.espacio, creado: p.actualizado };
  const modelo = pedido.tipo === 'soluciones' ? doc.documentoSoluciones(ex, libro, o) : doc.documentoExamen(ex, libro, o);
  const r = await generarPdf(modelo, recursos);
  anotarParaPruebas(r);
  return { ...r, nombre: nombreFichero(p.titulo, pedido.tipo, ex.letra) };
}

/** For the tests: what the last PDF made reports (pages, characters without a font, formulas and figures). */
export function anotarParaPruebas(r: InformePdf): void {
  if (typeof window !== 'undefined') (window as unknown as { __epaUltimoPdf?: unknown }).__epaUltimoPdf = { paginas: r.paginas, faltan: r.faltan, graficos: r.graficos };
}

/** Saves a generated PDF: «guardado» / «descargado» / CANCELADO; throws if it could not be written. */
export async function guardarPdf(nombre: string, bytes: Uint8Array) {
  const r = await guardarBinario(nombre, bytes, 'application/pdf', ['Documento PDF', ['pdf']]);
  return r;
}

export { CANCELADO };
