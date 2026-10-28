// Thumbnail of one of the reader's circuits («Mis circuitos»): the editor's own drawing (the placed parts'
// symbols as geometria.ts orients them, the wires and the junction dots of conectividad.ts) reduced to the
// list thumbnail's paths (esquema-auto/miniatura.ts, no texts). Cached per circuit and its last save, so a
// circuit edited and saved again is drawn again, the others never.

import { girar, type Pt } from '../esquema-auto/simbolos.ts';
import { Trazador, type TrazosMiniatura } from '../esquema-auto/miniatura.ts';
import { conectividad } from './conectividad.ts';
import { geometria } from './geometria.ts';
import type { CircuitoGuardado, DocumentoEsquema } from './tipos.ts';

export function trazosDocumento(doc: DocumentoEsquema): TrazosMiniatura | null {
  if (!doc.componentes.length && !doc.cables.length) return null;
  const t = new Trazador();
  for (const w of doc.cables) t.cable([w.p[0], w.p[1]], [w.p[2], w.p[3]]);
  for (const c of doc.componentes) {
    const g = geometria(c);
    t.simbolo(g.def.prims, (p: Pt): Pt => {
      const [x, y] = girar(c.o, p[0], p[1]);
      return [x + c.x, y + c.y];
    });
  }
  for (const p of conectividad(doc).uniones) t.union(p);
  return t.terminar();
}

const hechas = new Map<string, { t: number; trazos: TrazosMiniatura | null }>();

/** The thumbnail of a saved circuit, drawn again only when it has been saved since. */
export function miniaturaCircuito(c: CircuitoGuardado): TrazosMiniatura | null {
  const h = hechas.get(c.id);
  if (h && h.t === c.actualizado) return h.trazos;
  let trazos: TrazosMiniatura | null = null;
  try {
    trazos = trazosDocumento(c.doc);
  } catch {
    // a drawing this version cannot read keeps the placeholder
  }
  hechas.set(c.id, { t: c.actualizado, trazos });
  return trazos;
}
