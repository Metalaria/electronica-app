// «Completa el circuito en la protoboard» (0.10): the breadboard's own auto-placement of a book figure's
// schematic (componentes/protoboard: circuitoDeEsquema → colocarCircuito, the board that «Ver en protoboard»
// opens) with one jumper wire taken out, or one part lifted off its holes and left beside the board. The
// reader's board is right when verificarMontaje() finds nothing: every original net is one net of the board,
// none are joined, every leg in a hole. Plain TypeScript (the generator checks every puzzle in Node).

import { circuitoDeEsquema } from '../protoboard/fuentes.ts';
import { colocarCircuito } from '../protoboard/colocacion.ts';
import { verificarMontaje } from '../protoboard/verificar.ts';
import { nombreAgujero } from '../protoboard/placa.ts';
import type { DocumentoProtoboard, Pt } from '../protoboard/tipos.ts';
import type { Esquema } from '../figuras-vivas/tipos.ts';

export type Quitar = { k: 'cable'; i: number } | { k: 'pieza'; id: string; nombre: string };

/** The complete board of a figure's schematic, as «Ver en protoboard» lays it out. */
export function montajeCompleto(esq: Esquema, titulo: string, figura: string): DocumentoProtoboard {
  return colocarCircuito(circuitoDeEsquema(esq, titulo, figura)).doc;
}

const copia = (d: DocumentoProtoboard): DocumentoProtoboard => JSON.parse(JSON.stringify(d)) as DocumentoProtoboard;

/** Where a lifted part waits: beside the board (vertical parts) or in the central channel (the rest). */
function aparcar(doc: DocumentoProtoboard, id: string): Pt[] | null {
  const p = doc.piezas.find((x) => x.id === id);
  if (!p || p.pos.length !== 2) return null;
  const [a, b] = p.pos as [Pt, Pt];
  const largo = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
  const sitios: Pt[][] = [];
  if (a[0] === b[0]) sitios.push([[doc.columnas + 1, a[1]], [doc.columnas + 1, b[1]]]);
  for (const y of [8, 9])
    for (let x = doc.columnas - largo; x >= 1; x--) sitios.push([[x, y], [x + largo, y]]);
  for (const pos of sitios) {
    const prueba = copia(doc);
    prueba.piezas.find((x) => x.id === id)!.pos = pos;
    const m = verificarMontaje(prueba);
    if (m.every((t) => !/solapan|debajo|dos patas/.test(t))) return pos;
  }
  return null;
}

/** The board with the piece or wire taken out (null when it cannot be done cleanly). */
export function montajeIncompleto(completo: DocumentoProtoboard, q: Quitar): DocumentoProtoboard | null {
  const doc = copia(completo);
  if (q.k === 'cable') {
    if (!doc.cables[q.i]) return null;
    doc.cables.splice(q.i, 1);
  } else {
    const pos = aparcar(doc, q.id);
    if (!pos) return null;
    doc.piezas.find((x) => x.id === q.id)!.pos = pos;
  }
  return verificarMontaje(doc).length ? doc : null;
}

/** The set-up hint: the holes of the missing wire, or where the part's legs go. */
export function pistaMontaje(completo: DocumentoProtoboard, q: Quitar): string {
  const cfg = { placas: completo.placas, columnas: completo.columnas };
  if (q.k === 'cable') {
    const w = completo.cables[q.i];
    return w ? `El cable que falta va del agujero ${nombreAgujero(cfg, w.a[0], w.a[1])} al ${nombreAgujero(cfg, w.b[0], w.b[1])}.` : '';
  }
  const p = completo.piezas.find((x) => x.id === q.id);
  return p ? `Sus patas van en los agujeros ${p.pos.map((x) => nombreAgujero(cfg, x[0], x[1])).join(' y ')}.` : '';
}

export { verificarMontaje };
