// Nets of a drawing. Connection rules (as in KiCad): pins and wire ends that meet at a point are joined; a
// wire end on the inside of another wire joins it (T junction, drawn with a dot); wires that cross do not
// connect, nor does a pin lying on the inside of a wire. Net labels and supply symbols with the same name
// join their pieces; every ground symbol is node 0. Names: ground «0», then labels, then the names kept by
// imported wires, then n1, n2…

import type { Pt } from '../esquema-auto/simbolos.ts';
import { pinesMundo } from './geometria.ts';
import type { DocumentoEsquema } from './tipos.ts';

export interface Red {
  nombre: string;
  /** «compId.pin» of every pin on the net. */
  pines: string[];
  cables: string[];
  /** Named by a label or a supply symbol (not a generated name). */
  explicita: boolean;
}

export interface Conectividad {
  redes: Red[];
  /** «compId.pin» → net index. */
  redDePin: Map<string, number>;
  /** Wire id → net index. */
  redDeCable: Map<string, number>;
  /** Junction dots. */
  uniones: Pt[];
  /** Pins and wire ends connected to nothing. */
  sueltos: Pt[];
  /** Nets with two different label names (they are one net: the first name wins). */
  conflictos: string[][];
}

const clave = (x: number, y: number) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;

/** A valid SPICE node name from a label. */
export function nombreNodo(s: string): string {
  const t = s.trim().toLowerCase().replace(/\s+/g, '_').replace(/[(){}=,;]/g, '');
  return t === 'gnd' ? '0' : t;
}

function dentro(px: number, py: number, p: [number, number, number, number]): boolean {
  const [x0, y0, x1, y1] = p;
  const e = 1e-6;
  if (Math.abs(x0 - x1) < e) {
    if (Math.abs(px - x0) > e) return false;
    return py > Math.min(y0, y1) + e && py < Math.max(y0, y1) - e;
  }
  if (Math.abs(y0 - y1) < e) {
    if (Math.abs(py - y0) > e) return false;
    return px > Math.min(x0, x1) + e && px < Math.max(x0, x1) - e;
  }
  // Oblique wire (rare: while dragging): distance to the segment.
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L = dx * dx + dy * dy;
  const t = ((px - x0) * dx + (py - y0) * dy) / L;
  if (t <= 1e-6 || t >= 1 - 1e-6) return false;
  return Math.abs((px - x0) * dy - (py - y0) * dx) / Math.sqrt(L) < 1e-4;
}

export function conectividad(doc: DocumentoEsquema): Conectividad {
  const pines: { k: string; x: number; y: number; tipo: string; red?: string }[] = [];
  for (const c of doc.componentes) {
    for (const p of pinesMundo(c)) pines.push({ k: `${c.id}.${p.nombre}`, x: p.x, y: p.y, tipo: c.tipo, red: c.tipo === 'ETQ' || c.tipo === 'RIEL' ? c.campos['red'] : undefined });
  }
  const P = pines.length;
  const W = doc.cables.length;
  const padre = new Int32Array(P + W).map((_, i) => i);
  const raiz = (i: number): number => {
    while (padre[i] !== i) {
      padre[i] = padre[padre[i]!]!;
      i = padre[i]!;
    }
    return i;
  };
  const unir = (a: number, b: number) => {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) padre[ra] = rb;
  };

  // Everything that ends at each point.
  const en = new Map<string, { pt: Pt; pines: number[]; extremos: number[] }>();
  const sitio = (x: number, y: number) => {
    const k = clave(x, y);
    let s = en.get(k);
    if (!s) en.set(k, (s = { pt: [x, y], pines: [], extremos: [] }));
    return s;
  };
  pines.forEach((p, i) => sitio(p.x, p.y).pines.push(i));
  doc.cables.forEach((w, j) => {
    sitio(w.p[0], w.p[1]).extremos.push(P + j);
    sitio(w.p[2], w.p[3]).extremos.push(P + j);
  });
  const interiores = new Map<string, number[]>();
  for (const [k, s] of en) {
    const todos = [...s.pines, ...s.extremos];
    for (let i = 1; i < todos.length; i++) unir(todos[0]!, todos[i]!);
    // T junctions: a wire end on the inside of another wire.
    if (!s.extremos.length) continue;
    const [x, y] = s.pt;
    doc.cables.forEach((w, j) => {
      if (dentro(x, y, w.p)) {
        unir(s.extremos[0]!, P + j);
        (interiores.get(k) ?? interiores.set(k, []).get(k)!).push(j);
      }
    });
  }
  // Labels with the same name, and every ground.
  const porNombre = new Map<string, number>();
  pines.forEach((p, i) => {
    const n = p.tipo === 'GND' ? '0' : p.red != null ? nombreNodo(p.red) : null;
    if (n == null || n === '') return;
    const prev = porNombre.get(n);
    if (prev == null) porNombre.set(n, i);
    else unir(prev, i);
  });

  // Groups → nets.
  const grupos = new Map<number, { pines: number[]; cables: number[] }>();
  const grupo = (r: number) => grupos.get(r) ?? grupos.set(r, { pines: [], cables: [] }).get(r)!;
  for (let i = 0; i < P; i++) grupo(raiz(i)).pines.push(i);
  for (let j = 0; j < W; j++) grupo(raiz(P + j)).cables.push(j);
  const lista = [...grupos.values()];

  const usados = new Set<string>();
  const nombres: (string | null)[] = lista.map(() => null);
  const explicitas: boolean[] = lista.map(() => false);
  const conflictos: string[][] = [];
  lista.forEach((g, gi) => {
    const exp = new Set<string>();
    for (const i of g.pines) {
      const p = pines[i]!;
      if (p.tipo === 'GND') exp.add('0');
      else if (p.red != null && nombreNodo(p.red)) exp.add(nombreNodo(p.red));
    }
    if (!exp.size) return;
    const orden = [...exp].sort((a, b) => (a === '0' ? -1 : b === '0' ? 1 : a.localeCompare(b)));
    if (orden.length > 1) conflictos.push(orden);
    nombres[gi] = orden[0]!;
    explicitas[gi] = true;
    usados.add(orden[0]!);
  });
  // Names kept by imported wires (the most frequent one of the net), bigger nets first.
  const porTamano = lista.map((_, i) => i).sort((a, b) => lista[b]!.cables.length - lista[a]!.cables.length);
  for (const gi of porTamano) {
    if (nombres[gi] != null) continue;
    const cuenta = new Map<string, number>();
    for (const j of lista[gi]!.cables) {
      const r = doc.cables[j]!.red;
      if (r) cuenta.set(r, (cuenta.get(r) ?? 0) + 1);
    }
    const mejor = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).find(([n]) => !usados.has(n));
    if (mejor) {
      nombres[gi] = mejor[0];
      usados.add(mejor[0]);
    }
  }
  let k = 1;
  lista.forEach((_, gi) => {
    if (nombres[gi] != null) return;
    while (usados.has(`n${k}`)) k++;
    nombres[gi] = `n${k}`;
    usados.add(`n${k}`);
  });

  const redes: Red[] = lista.map((g, gi) => ({
    nombre: nombres[gi]!,
    pines: g.pines.map((i) => pines[i]!.k),
    cables: g.cables.map((j) => doc.cables[j]!.id),
    explicita: explicitas[gi]!,
  }));
  const redDePin = new Map<string, number>();
  const redDeCable = new Map<string, number>();
  redes.forEach((r, i) => {
    for (const p of r.pines) redDePin.set(p, i);
    for (const c of r.cables) redDeCable.set(c, i);
  });

  // Junction dots and loose ends.
  const uniones: Pt[] = [];
  const sueltos: Pt[] = [];
  for (const [k2, s] of en) {
    const n = s.pines.length + s.extremos.length + 2 * (interiores.get(k2)?.length ?? 0);
    if (n >= 3 && (s.extremos.length || interiores.has(k2))) uniones.push(s.pt);
    if (n === 1) {
      const i = s.pines[0];
      // A single pin of a connection symbol or probe is not «loose» in a way worth marking twice.
      if (i == null || pines[i]!.tipo !== 'SONDA') sueltos.push(s.pt);
    }
  }
  return { redes, redDePin, redDeCable, uniones, sueltos, conflictos };
}
