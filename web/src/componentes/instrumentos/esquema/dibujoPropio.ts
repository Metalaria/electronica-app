// A small schematic in the format of the book's figure data (ESQUEMA.md, «esquemas[]»): built by hand for the
// practices whose figure has no schematic, and drawn by Plano.svelte. Coordinates in drawing units, y up.

import type { Esquema, Elemento, Punto } from '../../figuras-vivas/tipos';

export interface Parte {
  id: string;
  rol: string;
  /** Text next to the symbol («R 100 Ω»). */
  etiqueta?: string;
  de: Punto;
  a: Punto;
  /** Net node at `de` (start) and `a` (end). */
  nodos: [string, string];
}

export interface Cable {
  puntos: Punto[];
  nodo: string;
}

/** Builds an Esquema (schemdraw units, 1 unit ≈ the length of a lead) from parts and wires. */
export function construir(partes: Parte[], cables: Cable[], masas: Punto[] = []): Esquema {
  const puntos: Esquema['puntos'] = [];
  const nodos = new Map<string, { puntos: string[]; terminales: string[] }>();
  const punto = (xy: Punto, nodo: string): string => {
    const ex = puntos.find((p) => Math.hypot(p.xy[0] - xy[0], p.xy[1] - xy[1]) < 1e-6);
    if (ex) return ex.id;
    const id = `P${puntos.length}`;
    puntos.push({ id, xy, nodo });
    if (!nodos.has(nodo)) nodos.set(nodo, { puntos: [], terminales: [] });
    nodos.get(nodo)!.puntos.push(id);
    return id;
  };
  const elementos: Elemento[] = partes.map((p) => {
    const p1 = punto(p.de, p.nodos[0]);
    const p2 = punto(p.a, p.nodos[1]);
    nodos.get(p.nodos[0])!.terminales.push(`${p.id}.start`);
    nodos.get(p.nodos[1])!.terminales.push(`${p.id}.end`);
    return {
      id: p.id,
      clase: p.rol,
      rol: p.rol,
      etiquetas_html: p.etiqueta ? [p.etiqueta] : [],
      anclas: { start: p.de, end: p.a },
      terminales: { start: p.nodos[0], end: p.nodos[1] },
      puntos_terminal: { start: p1, end: p2 },
    };
  });
  for (const [i, m] of masas.entries()) {
    punto(m, '0');
    elementos.push({ id: `G${i}`, clase: 'Ground', rol: 'GND', anclas: { start: m }, terminales: { start: '0' } });
  }
  const tramos: Esquema['tramos'] = cables.map((c, i) => {
    const ids = c.puntos.map((xy) => punto(xy, c.nodo));
    return { id: `T${i}`, elemento: null, origen: 'propio', nodo: c.nodo, de: ids[0]!, a: ids[ids.length - 1]!, puntos: c.puntos, longitud: null };
  });
  return {
    eje: 0,
    tolerancia: 0.02,
    dibujo_a_svg: { sx: 1, tx: 0, sy: -1, ty: 0 },
    puntos,
    elementos,
    nodos: [...nodos.entries()].map(([id, n]) => ({ id, tierra: id === '0', puntos: n.puntos, terminales: n.terminales })),
    tramos,
  };
}

/** Bounding box [x, y, w, h] of an Esquema in its own drawing units (y down: SVG). */
export function caja(e: Esquema, margen = 1.2): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const ver = ([x, y]: Punto) => {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, -y);
    y1 = Math.max(y1, -y);
  };
  for (const p of e.puntos) ver(p.xy);
  for (const el of e.elementos) for (const a of Object.values(el.anclas)) ver(a);
  return [x0 - margen, y0 - margen, x1 - x0 + 2 * margen, y1 - y0 + 2 * margen];
}
