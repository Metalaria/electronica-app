// The automatic schematic as plain, editable data (used by the schematic editor, componentes/editor/, to open
// any netlist as a drawing it can change). Only reads the layout of generar.ts; nothing here changes how the
// automatic schematics are placed or routed.
//   editableDeNetlist(texto) → EditableAuto | null   (call sembrarDibujos first to use precalculado.json)

import { generarEsquema, type EsquemaAuto } from './generar.ts';
import type { Dispositivo } from './modelo.ts';
import type { Pt } from './simbolos.ts';

/** What the editor needs of a device to draw it and to rewrite its netlist line. */
export interface DispositivoEditable {
  nombre: string;
  letra: string;
  simbolo: string;
  pines: { nombre: string; nodo: string; rotulo?: string; indice?: number }[];
  ocultos: { nombre: string; nodo: string; indice?: number }[];
  modelo: string | null;
  titulo?: string;
  /** 0-based physical line where its netlist line starts. */
  linea: number;
  bobinas?: DispositivoEditable[];
  clave: string;
  diodos?: { d: DispositivoEditable; anodo: 'a' | 'b' | 'n'; catodo: 'a' | 'b' | 'p' }[];
}

export interface ParteEditable {
  disp: DispositivoEditable;
  /** Origin of the symbol (world units, y down), orientation 0–7 and symbol variant. */
  x: number;
  y: number;
  o: number;
  v: number;
}

export interface EditableAuto {
  partes: ParteEditable[];
  cables: { red: string; runs: [number, number, number, number][] }[];
  /** Ground symbols: their lead from the pin (world) and the direction they hang. */
  tierras: { pata: Pt[]; dir: Pt }[];
  /** Supply symbols: lead, direction and the net they name. */
  rieles: { pata: Pt[]; dir: Pt; red: string; texto: string }[];
  /** Net labels: pin, direction and net. */
  etiquetas: { pin: Pt; dir: Pt; red: string }[];
  ignoradas: { linea: number; texto: string; motivo: string }[];
}

function plano(d: Dispositivo): DispositivoEditable {
  return {
    nombre: d.nombre,
    letra: d.letra,
    simbolo: d.simbolo,
    pines: d.pines.map((p) => ({ nombre: p.nombre, nodo: p.nodo, rotulo: p.rotulo, indice: p.indice })),
    ocultos: (d.ocultos ?? []).map((p) => ({ nombre: p.nombre, nodo: p.nodo, indice: p.indice })),
    modelo: d.modelo,
    titulo: d.titulo,
    linea: d.linea,
    clave: d.clave,
    bobinas: d.bobinas?.map(plano),
    diodos: d.diodos?.map((x) => ({ d: plano(x.d), anodo: x.anodo, catodo: x.catodo })),
  };
}

export function editableDe(a: EsquemaAuto): EditableAuto {
  const partes: ParteEditable[] = [];
  const tierras: EditableAuto['tierras'] = [];
  const rieles: EditableAuto['rieles'] = [];
  for (const ud of a.dibujo.unidades) {
    const u = ud.u;
    const v = u.vars[u.v]!;
    const W = (p: Pt): Pt => [p[0] + ud.x, p[1] + ud.y];
    for (const t of v.talones) {
      const pata = t.pata.map(W);
      if (t.tipo === 'tierra') tierras.push({ pata, dir: t.dir });
      else {
        const r = u.pines[t.pin]?.riel;
        rieles.push({ pata, dir: t.dir, red: r?.nodo ?? u.pines[t.pin]?.nodo ?? '', texto: r?.texto ?? '' });
      }
    }
    if (!u.disp) continue;
    const variante = u.disp.simbolo === 'OPAMP' && (v.def.pines['in1']?.y ?? -1) > 0 ? 1 : 0;
    partes.push({ disp: plano(u.disp), x: ud.x, y: ud.y, o: v.o, v: variante });
  }
  return {
    partes,
    cables: a.dibujo.cables.map((c) => ({ red: c.red, runs: c.runs.map((r) => [...r] as [number, number, number, number]) })),
    tierras,
    rieles,
    etiquetas: a.dibujo.etiquetas.map((e) => ({ pin: e.pin, dir: e.dir, red: e.red })),
    ignoradas: a.circuito.ignoradas,
  };
}

export function editableDeNetlist(texto: string, aspecto = 1.6): EditableAuto | null {
  const a = generarEsquema(texto, { aspecto });
  return a ? editableDe(a) : null;
}
