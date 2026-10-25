// The drawing as a live schematic for figuras-vivas: its topology in the «Datos de figuras» format (drawing
// units, y up), its mapping onto the generated netlist and its SVG, so the overlay of the simulator page
// (EstadoEsquema, CapaEsquema, PanelEsquema, instrumentar/resultados) shows the results on it: node colours
// and voltages, wire and part currents, and the current flow of the transient.

import type { Correspondencia, DibujoConNetlist, Elemento, Esquema, Nodo, Punto, Tramo } from '../figuras-vivas/tipos';
import { tipoDe } from './catalogo.ts';
import { geometria, pinesMundo, S } from './geometria.ts';
import type { Netlist } from './netlist.ts';
import { svgDocumento } from './svg.ts';
import type { Componente, DocumentoEsquema } from './tipos.ts';

const ROL_GEN: Record<string, string> = {
  R: 'R', C: 'C', L: 'L', VDC: 'V', VSIN: 'VSIN', VPULSO: 'VPULSE', VPWL: 'V', IDC: 'I', ISIN: 'I', IPULSO: 'I',
  D: 'D', DZ: 'DZ', LED: 'LED', DS: 'D', NPN: 'QN', PNP: 'QP', NMOS: 'MN', PMOS: 'MP', NJF: 'JN', PJF: 'JP',
  DEPV: 'DEP', DEPI: 'DEP', SW: 'SW', OPAMP: 'OA', TRAFO: 'XFMR', PUENTE: 'D',
};

function rolDe(c: Componente): string {
  if (c.tipo === 'GEN') return ROL_GEN[c.forma?.simbolo ?? ''] ?? 'X';
  return tipoDe(c).rol;
}

function polaridad(rol: string): Record<string, string> | undefined {
  if (['V', 'VSIN', 'VPULSE', 'AM'].includes(rol)) return { positivo: 'end', negativo: 'start' };
  if (rol === 'I') return { entra: 'start', sale: 'end' };
  if (['D', 'DZ', 'LED'].includes(rol)) return { anodo: 'start', catodo: 'end' };
  return undefined;
}

const clave = (x: number, y: number) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;

export function dibujoVivo(doc: DocumentoEsquema, nl: Netlist): DibujoConNetlist {
  const con = nl.con;
  const sv = svgDocumento(doc, con, { paleta: 'libro' });
  const { x0, y0 } = sv;
  const U = (x: number, y: number): Punto => [Math.round(x * 1e4) / 1e4, Math.round(-y * 1e4) / 1e4];

  // Nodes.
  const idRed: string[] = [];
  let k = 1;
  con.redes.forEach((r, i) => (idRed[i] = r.nombre === '0' ? 'N0' : `N${k++}`));
  const nodos: Nodo[] = con.redes.map((r, i) => ({ id: idRed[i]!, tierra: r.nombre === '0', puntos: [], terminales: [], etiquetas: [r.nombre] }));
  const nodoDeRed = (i: number | undefined) => (i == null ? null : nodos[i]!);

  // Points.
  const puntos = new Map<string, { id: string; xy: Punto; nodo: string }>();
  const punto = (x: number, y: number, red: number | undefined): string => {
    const kk = clave(x, y);
    let p = puntos.get(kk);
    if (!p) {
      const nd = nodoDeRed(red);
      p = { id: `P${puntos.size}`, xy: U(x, y), nodo: nd?.id ?? '' };
      puntos.set(kk, p);
      nd?.puntos.push(p.id);
    }
    return p.id;
  };

  // Elements: one per netlist instance, plus the ground and label symbols.
  const elementos: Elemento[] = [];
  const corr: Correspondencia = { nodos: {}, elementos: {} };
  con.redes.forEach((r, i) => (corr.nodos[idRed[i]!] = r.nombre));
  let ne = 0;
  const porComp = new Map<string, Componente>(doc.componentes.map((c) => [c.id, c]));
  const cajaU = (c: Componente): [number, number, number, number] => {
    const g = geometria(c).cuerpo;
    return [g[0] + c.x, -(g[3] + c.y), g[2] + c.x, -(g[1] + c.y)].map((v) => Math.round(v * 1e4) / 1e4) as [number, number, number, number];
  };
  const centroU = (c: Componente): Punto => {
    const g = geometria(c).cuerpo;
    return U((g[0] + g[2]) / 2 + c.x, (g[1] + g[3]) / 2 + c.y);
  };
  for (const inst of nl.instancias) {
    const c = porComp.get(inst.comp);
    if (!c) continue;
    const id = `E${++ne}`;
    const pins = pinesMundo(c);
    const nombres = Object.keys(inst.pines);
    const dos = nombres.length === 2 && !(nombres.includes('start') && nombres.includes('end'));
    const ordenados = [...nombres].sort((a, b) => inst.pines[a]! - inst.pines[b]!);
    const terminal = (p: string) => (dos ? (p === ordenados[0] ? 'start' : 'end') : p);
    const anclas: Record<string, Punto> = { center: centroU(c) };
    const terminales: Record<string, string> = {};
    const puntosT: Record<string, string> = {};
    const pinesCorr: Record<string, number> = {};
    for (const p of nombres) {
      const pw = pins.find((x) => x.nombre === p);
      if (!pw) continue;
      const red = con.redDePin.get(`${c.id}.${p}`);
      const t = terminal(p);
      anclas[t] = U(pw.x, pw.y);
      const nd = nodoDeRed(red);
      if (nd) {
        terminales[t] = nd.id;
        nd.terminales.push(`${id}.${t}`);
      }
      puntosT[t] = punto(pw.x, pw.y, red);
      pinesCorr[t] = inst.pines[p]!;
    }
    const rol = rolDe(c);
    // Where the live view writes the part's current: the side of the body opposite to its label (parts that
    // are one netlist line only: a bridge's diodes or a potentiometer's halves would share one place).
    if (!c.lineas && c.tipo !== 'POT' && c.tipo !== 'TRAFO') {
      const g = geometria(c);
      const b = g.cuerpo;
      const cx = (b[0] + b[2]) / 2 + c.x;
      const cy = (b[1] + b[3]) / 2 + c.y;
      const e = g.etq;
      anclas['valor'] =
        e.dy !== 0 ? U(cx, e.dy < 0 ? b[3] + c.y + 0.55 : b[1] + c.y - 0.2) : U(e.dx > 0 ? b[0] + c.x - 0.2 : b[2] + c.x + 0.2, cy + 0.15);
    }
    elementos.push({
      id,
      clase: tipoDe(c).clase,
      rol,
      designador: inst.nombre.toUpperCase() === c.nombre.toUpperCase() ? c.nombre : inst.nombre.toUpperCase(),
      anclas,
      caja: cajaU(c),
      terminales,
      puntos_terminal: puntosT,
      polaridad: polaridad(rol),
    });
    corr.elementos[id] = { nombre: inst.nombre, pines: pinesCorr };
  }
  for (const c of doc.componentes) {
    if (c.tipo !== 'GND' && c.tipo !== 'RIEL' && c.tipo !== 'ETQ' && c.tipo !== 'SONDA' && c.tipo !== 'VM') continue;
    const id = `E${++ne}`;
    const anclas: Record<string, Punto> = { center: centroU(c) };
    const terminales: Record<string, string> = {};
    const puntosT: Record<string, string> = {};
    if (c.tipo === 'GND' || c.tipo === 'RIEL' || c.tipo === 'ETQ') {
      const pw = pinesMundo(c)[0]!;
      const red = con.redDePin.get(`${c.id}.start`);
      anclas['start'] = U(pw.x, pw.y);
      const nd = nodoDeRed(red);
      if (nd) {
        terminales['start'] = nd.id;
        nd.terminales.push(`${id}.start`);
      }
      puntosT['start'] = punto(pw.x, pw.y, red);
    }
    elementos.push({
      id,
      clase: tipoDe(c).clase,
      rol: c.tipo === 'GND' ? 'GND' : c.tipo === 'SONDA' || c.tipo === 'VM' ? 'ANOT' : 'RAIL',
      designador: c.tipo === 'GND' ? null : c.nombre,
      anclas,
      caja: cajaU(c),
      terminales,
      puntos_terminal: puntosT,
    });
  }

  // Wire segments, split where another wire ends on them.
  const extremos = doc.cables.flatMap((w) => [[w.p[0], w.p[1]] as [number, number], [w.p[2], w.p[3]] as [number, number]]);
  const tramos: Tramo[] = [];
  for (const w of doc.cables) {
    const red = con.redDeCable.get(w.id);
    const nd = nodoDeRed(red);
    const [ax, ay, bx, by] = w.p;
    const L = Math.hypot(bx - ax, by - ay);
    if (L < 1e-9) continue;
    const ts = new Set<number>([0, 1]);
    for (const [px, py] of extremos) {
      const t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (L * L);
      if (t <= 1e-6 || t >= 1 - 1e-6) continue;
      const d = Math.abs((px - ax) * (by - ay) - (py - ay) * (bx - ax)) / L;
      if (d < 1e-4) ts.add(Math.round(t * 1e6) / 1e6);
    }
    const orden = [...ts].sort((a, b) => a - b);
    for (let i = 0; i + 1 < orden.length; i++) {
      const p = [ax + (bx - ax) * orden[i]!, ay + (by - ay) * orden[i]!] as const;
      const q = [ax + (bx - ax) * orden[i + 1]!, ay + (by - ay) * orden[i + 1]!] as const;
      tramos.push({
        id: `T${tramos.length + 1}`,
        elemento: null,
        origen: 'editor',
        nodo: nd?.id ?? '',
        de: punto(p[0], p[1], red),
        a: punto(q[0], q[1], red),
        puntos: [U(p[0], p[1]), U(q[0], q[1])],
        longitud: Math.hypot(q[0] - p[0], q[1] - p[1]),
      });
    }
  }

  const esquema: Esquema = {
    eje: -1,
    tolerancia: 0.02,
    dibujo_a_svg: { sx: S, tx: -S * x0, sy: -S, ty: -S * y0 },
    puntos: [...puntos.values()],
    elementos,
    nodos,
    tramos,
  };
  return { origen: 'auto', svg: sv.svg, vista: sv.vista, esquemas: [esquema], correspondencia: [corr] };
}
