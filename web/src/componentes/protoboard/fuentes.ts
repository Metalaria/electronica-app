// The circuit behind each kind of schematic, as the auto-placement takes it (CircuitoFuente): a schematic
// editor document (its parts and the nets of its wires), a netlist text (laid out by esquema-auto and
// turned into editor parts by editor/importar.ts, as «Editar el esquema» does), or a book figure's
// schematic («Datos de figuras», esquemas[], the same rules as its own simulation). Plain TypeScript,
// except circuitoDeNetlist(), which uses the editor's layout worker.

import { pinesDe, ES_CONEXION, PUENTE_DIODOS } from '../editor/catalogo.ts';
import { conectividad } from '../editor/conectividad.ts';
import { documentoDeEditable } from '../editor/importar.ts';
import { analisisPorDefecto, type Componente, type DocumentoEsquema } from '../editor/tipos.ts';
import { deSpice } from '../editor/valores.ts';
import type { EditableAuto } from '../esquema-auto/editable.ts';
import { lineasNetlist } from '../../simulador/motor/netlist.ts';
import { cargaDe, elementosCircuito, factorAmplitud, frecuenciaOriginal, sp } from '../figuras-vivas/esquema/netlist.ts';
import type { Elemento, Esquema } from '../figuras-vivas/tipos.ts';
import { partesXspice } from './logica.ts';
import type { CircuitoFuente, OrigenProtoboard, Pt } from './tipos.ts';

/**
 * An editor document (its wires give the nets). The XSPICE «A» lines its importer left in the directives
 * (gates, flip-flops, bridges of the book's digital netlists) become parts too, after the drawn ones.
 */
export function circuitoDeDocumento(doc: DocumentoEsquema, origen: OrigenProtoboard, refs: string[] = []): CircuitoFuente {
  const con = conectividad(doc);
  const componentes = doc.componentes.filter((c) => !ES_CONEXION.has(c.tipo)).map((c) => JSON.parse(JSON.stringify(c)) as Componente);
  const redes: Record<string, string> = {};
  const posiciones: Record<string, Pt> = {};
  for (const c of componentes) {
    posiciones[c.id] = [c.x, c.y];
    for (const p of pinesDe(c)) {
      const i = con.redDePin.get(`${c.id}.${p}`);
      if (i != null) redes[`${c.id}.${p}`] = con.redes[i]!.nombre;
    }
  }
  const xs = partesXspice(doc.directivas, 0);
  const x0 = Math.max(0, ...componentes.map((c) => c.x)) + 40;
  xs.componentes.forEach((c, i) => {
    componentes.push(c);
    posiciones[c.id] = [x0 + i * 40, 0];
  });
  Object.assign(redes, xs.redes);
  return { titulo: doc.titulo, componentes, redes, directivas: xs.directivas, analisis: JSON.parse(JSON.stringify(doc.analisis)) as DocumentoEsquema['analisis'], posiciones, refs, origen };
}

/** Pin order of each element letter on its netlist line, as the editor writes it. */
const PINES_LINEA: Record<string, string[]> = {
  R: ['start', 'end'],
  C: ['start', 'end'],
  L: ['start', 'end'],
  D: ['start', 'end'],
  V: ['end', 'start'],
  I: ['start', 'end'],
  Q: ['collector', 'base', 'emitter'],
  M: ['drain', 'gate', 'source'],
  J: ['drain', 'gate', 'source'],
};
const nodoSpice = (n: string) => (/^gnd$/i.test(n) ? '0' : n.toLowerCase());

/**
 * The node names of the netlist itself for every pin of the imported parts. The drawing keeps a name only
 * where a wire carries it, so a net whose pins touch directly would lose it (and with it the .control's
 * v(e)); the text has them all.
 */
export function redesDelTexto(texto: string, componentes: Componente[]): Record<string, string> {
  const lineas = new Map<string, string[]>();
  for (const l of lineasNetlist(texto).lineas) if (!l.subckt && l.tokens.length && !l.tokens[0]!.startsWith('.')) lineas.set(l.tokens[0]!.toLowerCase(), l.tokens);
  const res: Record<string, string> = {};
  for (const c of componentes) {
    if (c.lineas?.length) {
      for (const l of c.lineas) for (const [pin, i] of Object.entries(l.pines)) if (l.nodos[i]) res[`${c.id}.${pin}`] = nodoSpice(l.nodos[i]!);
      continue;
    }
    if (c.spice) {
      for (const [pin, i] of Object.entries(c.spice.pines)) if (c.spice.nodos[i]) res[`${c.id}.${pin}`] = nodoSpice(c.spice.nodos[i]!);
      continue;
    }
    // Palette transformers and bridges made from imported lines keep the names of those lines (0.10).
    const propios = (c.campos['_nombres'] ?? '').split(/\s+/).filter(Boolean);
    if (propios.length && (c.tipo === 'TRAFO' || c.tipo === 'PUENTE')) {
      const pinesLinea: [string, string][] =
        c.tipo === 'PUENTE'
          ? PUENTE_DIODOS
          : c.campos['toma'] === 'si'
            ? [
                ['p.start', 'p.end'],
                ['s.start', 's.mid'],
                ['s.mid', 's.end'],
              ]
            : [
                ['p.start', 'p.end'],
                ['s.start', 's.end'],
              ];
      pinesLinea.forEach(([a, b], i) => {
        const t = lineas.get((propios[i] ?? '').toLowerCase());
        if (t?.[1]) res[`${c.id}.${a}`] = nodoSpice(t[1]);
        if (t?.[2]) res[`${c.id}.${b}`] = nodoSpice(t[2]);
      });
      continue;
    }
    const t = lineas.get(c.nombre.toLowerCase());
    const orden = t ? PINES_LINEA[t[0]![0]!.toUpperCase()] : undefined;
    if (!t || !orden) continue;
    orden.forEach((pin, i) => {
      const n = t[1 + i];
      if (n) res[`${c.id}.${pin}`] = nodoSpice(n);
    });
  }
  return res;
}

/** A netlist already laid out by esquema-auto/editable.ts (Node tests; the app uses circuitoDeNetlist). */
export function circuitoDeEditable(texto: string, e: EditableAuto, origen: OrigenProtoboard, refs: string[] = []): CircuitoFuente {
  const doc = documentoDeEditable(texto, e, origen.tipo === 'libro' ? { tipo: 'libro', id: origen.id } : { tipo: 'texto' });
  const f = circuitoDeDocumento(doc, origen, refs);
  Object.assign(f.redes, redesDelTexto(texto, f.componentes));
  return f;
}

/** A netlist text (book, simulator page, free netlist). */
export async function circuitoDeNetlist(texto: string, origen: OrigenProtoboard, refs: string[] = []): Promise<CircuitoFuente> {
  const { importarNetlist } = await import('../editor/importar.ts');
  const doc = await importarNetlist(texto, origen.tipo === 'libro' ? { tipo: 'libro', id: origen.id } : { tipo: 'texto' });
  if (!doc || !doc.componentes.some((c) => !ES_CONEXION.has(c.tipo)))
    throw new Error('Esta netlist no tiene componentes que se puedan montar en una protoboard.');
  const f = circuitoDeDocumento(doc, origen, refs);
  Object.assign(f.redes, redesDelTexto(texto, f.componentes));
  return f;
}

// ------------------------------------------------------------------ book figures

/** Node name from a figure label («$V_{out}$» → «vout»). */
function nombreEtiqueta(s: string): string {
  return s
    .replace(/\\[a-z]+/gi, '')
    .replace(/[${}\\^_\s,;:()=]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+-]/g, '')
    .replace(/[+-]/g, (c) => (c === '+' ? 'p' : 'm'));
}

const MODELO_FIGURA: Record<string, string> = {
  DSCHOTTKY: '.model DSCHOTTKY D(IS=1u N=1.05 RS=0.05 BV=40 IBV=1m CJO=100p)',
  JNGEN: '.model JNGEN NJF(VTO=-2 BETA=1m LAMBDA=0.01)',
  JPGEN: '.model JPGEN PJF(VTO=2 BETA=1m LAMBDA=0.01)',
};

/**
 * A simulable schematic of a book figure, with the same interpretation as the book's generator
 * (figuras-vivas/esquema/netlist.ts): values, sources (peak amplitudes, 1 kHz or 50 Hz), models (1N4148,
 * 1N4007, Schottky, red LED, Zener of the labelled voltage, 2N3904/2N3906, level-1 MOSFETs, JFETs), op-amps
 * with ±14 V or their drawn supplies, Vdd/Vss rails as DC sources, switches as drawn, lamps and loads.
 */
export function circuitoDeEsquema(esq: Esquema, titulo: string, figura: string): CircuitoFuente {
  const els = elementosCircuito(esq);
  // Node names.
  const nombre = new Map<string, string>();
  const usados = new Set<string>(['0']);
  for (const n of esq.nodos) {
    if (n.tierra) {
      nombre.set(n.id, '0');
      continue;
    }
    let s = '';
    for (const e of n.etiquetas ?? []) {
      const t = nombreEtiqueta(e);
      if (t && !usados.has(t) && /^[a-z]/.test(t)) {
        s = t;
        break;
      }
    }
    if (!s) s = n.id.toLowerCase();
    while (usados.has(s)) s += '_';
    usados.add(s);
    nombre.set(n.id, s);
  }
  // Ground: a drawn ground symbol; else (no rails) the negative terminal of the first source.
  const hayTierra = els.some((e) => e.rol === 'GND');
  if (!hayTierra && !els.some((e) => e.rol === 'RAIL')) {
    const src = els.find((e) => ['V', 'V?', 'BAT', 'VSIN', 'VPULSE', 'VTRI'].includes(e.rol));
    const isrc = els.find((e) => e.rol === 'I');
    const ref = src ?? isrc;
    if (ref) {
      const term = src ? src.polaridad?.['negativo'] : isrc!.polaridad?.['entra'];
      const nodo = term ? ref.terminales?.[term] : undefined;
      if (nodo) {
        const viejo = nombre.get(nodo);
        for (const [k, v] of nombre) if (v === viejo) nombre.set(k, '0');
      }
    }
  }
  const red = (e: Elemento, t: string | undefined): string | undefined => {
    const n = t ? e.terminales?.[t] : undefined;
    return n ? nombre.get(n) : undefined;
  };

  const componentes: Componente[] = [];
  const redes: Record<string, string> = {};
  const posiciones: Record<string, Pt> = {};
  const directivas: string[] = [];
  const designadores = new Set<string>();
  let k = 0;
  let freq: number | null = null;
  const designador = (e: Elemento, prefijo: string): string => {
    let d = (e.designador ?? '').replace(/[^A-Za-z0-9_]/g, '');
    if (!d || d[0]!.toUpperCase() !== prefijo[0] || designadores.has(d.toUpperCase())) {
      let i = 1;
      while (designadores.has(`${prefijo}${i}`.toUpperCase())) i++;
      d = `${prefijo}${i}`;
    }
    designadores.add(d.toUpperCase());
    return d;
  };
  const poner = (e: Elemento, tipo: string, prefijo: string, campos: Record<string, string>, pines: Record<string, string | undefined>) => {
    const c: Componente = { id: `c${++k}`, tipo, nombre: designador(e, prefijo), x: 0, y: 0, o: 0, campos };
    componentes.push(c);
    const caja = e.caja ?? [0, 0, 0, 0];
    posiciones[c.id] = [(caja[0] + caja[2]) / 2, -(caja[1] + caja[3]) / 2];
    for (const [p, n] of Object.entries(pines)) if (n) redes[`${c.id}.${p}`] = n;
  };
  const v = (x: number) => deSpice(sp(x));

  for (const e of els) {
    const r = e.rol;
    const pol = e.polaridad ?? {};
    const val = e.valor ?? 0;
    switch (r) {
      case 'GND':
        break;
      case 'RAIL':
        poner(e, 'V', 'V', { forma: 'dc', dc: v(val) }, { end: red(e, 'start'), start: '0' });
        break;
      case 'R': {
        const carga = cargaDe(e);
        if (carga != null) poner(e, 'I', 'I', { forma: 'dc', dc: v(carga) }, { start: red(e, 'start'), end: red(e, 'end') });
        else poner(e, 'R', 'R', { valor: v(val) }, { start: red(e, 'start'), end: red(e, 'end') });
        break;
      }
      case 'LAMP':
        poner(e, 'R', 'R', { valor: v(val) }, { start: red(e, 'start'), end: red(e, 'end') });
        break;
      case 'SPK':
        poner(e, 'R', 'R', { valor: v(val) }, { start: red(e, 'in1'), end: red(e, 'in2') });
        break;
      case 'FUSE':
        poner(e, 'R', 'F', { valor: '10m' }, { start: red(e, 'start'), end: red(e, 'end') });
        break;
      case 'POT':
        poner(e, 'POT', 'P', { valor: v(val), pos: '50' }, { start: red(e, 'start'), tap: red(e, 'tap'), end: red(e, 'end') });
        break;
      case 'C':
      case 'VAR':
        poner(e, 'C', 'C', { valor: v(val) }, { start: red(e, 'start'), end: red(e, 'end') });
        break;
      case 'L':
        poner(e, 'L', 'L', { valor: v(val) }, { start: red(e, 'start'), end: red(e, 'end') });
        break;
      case 'V':
      case 'V?':
      case 'BAT':
        poner(e, 'V', 'V', { forma: 'dc', dc: v(val) }, { end: red(e, pol['positivo']), start: red(e, pol['negativo']) });
        break;
      case 'I':
        poner(e, 'I', 'I', { forma: 'dc', dc: v(val) }, { start: red(e, pol['entra']), end: red(e, pol['sale']) });
        break;
      case 'VSIN':
      case 'VPULSE':
      case 'VTRI': {
        const f = frecuenciaOriginal(e);
        const kk = factorAmplitud(e);
        const amp = kk === 0.5 ? val / 2 : kk === 1 ? val : val * Math.SQRT2;
        freq = freq == null ? f : Math.min(freq, f);
        const per = 1 / f;
        const pines = { end: red(e, pol['positivo']), start: red(e, pol['negativo']) };
        if (r === 'VSIN') poner(e, 'V', 'V', { forma: 'sin', dc: '0', vo: '0', va: v(amp), freq: v(f) }, pines);
        else if (r === 'VPULSE') poner(e, 'V', 'V', { forma: 'pulse', dc: '0', v1: '0', v2: v(amp), td: '0', tr: v(per / 1000), tf: v(per / 1000), pw: v(per / 2 - per / 1000), per: v(per) }, pines);
        else poner(e, 'V', 'V', { forma: 'texto', spec: `DC 0 PULSE(${sp(-amp)} ${sp(amp)} 0 ${sp(per / 2)} ${sp(per / 2)} 0 ${sp(per)})` }, pines);
        break;
      }
      case 'D':
      case 'DZ':
      case 'LED': {
        const ref = (e.referencia ?? '').toUpperCase();
        let modelo = 'D1N4148';
        let tipo = 'D';
        if (r === 'DZ') {
          tipo = 'DZ';
          modelo = `DZ${sp(val).replace('.', 'V')}`;
          directivas.push(`.model ${modelo} D(IS=1e-14 N=1 BV=${sp(val)} IBV=1m NBV=0.02 RS=0)`);
        } else if (r === 'LED') {
          tipo = 'LED';
          modelo = 'LEDR';
        } else if (ref.startsWith('1N400')) modelo = 'D1N4007';
        else if (e.clase === 'Schottky') {
          tipo = 'DS';
          modelo = 'DSCHOTTKY';
          directivas.push(MODELO_FIGURA['DSCHOTTKY']!);
        }
        poner(e, tipo, 'D', { modelo }, { start: red(e, pol['anodo']), end: red(e, pol['catodo']) });
        break;
      }
      case 'QN':
      case 'QP':
        poner(e, r, 'Q', { modelo: r === 'QN' ? 'Q2N3904' : 'Q2N3906' }, { collector: red(e, 'collector'), base: red(e, 'base'), emitter: red(e, 'emitter') });
        break;
      case 'MN':
      case 'MP':
        poner(e, r, 'M', { modelo: r === 'MN' ? 'NTY' : 'PTY' }, { drain: red(e, 'drain'), gate: red(e, 'gate'), source: red(e, 'source') });
        break;
      case 'JN':
      case 'JP': {
        const m = r === 'JN' ? 'JNGEN' : 'JPGEN';
        directivas.push(MODELO_FIGURA[m]!);
        poner(e, r, 'J', { modelo: m }, { drain: red(e, 'drain'), gate: red(e, 'gate'), source: red(e, 'source') });
        break;
      }
      case 'OA': {
        const tp = e.terminales ?? {};
        if ('vd' in tp && 'vs' in tp) poner(e, 'OA5', 'U', { modelo: 'opa5' }, { in1: red(e, 'in1'), in2: red(e, 'in2'), out: red(e, 'out'), vd: red(e, 'vd'), vs: red(e, 'vs') });
        else poner(e, 'OA', 'U', { modelo: 'opamp' }, { in1: red(e, 'in1'), in2: red(e, 'in2'), out: red(e, 'out') });
        break;
      }
      case 'SW':
        poner(e, 'SW', 'S', { estado: e.estado === 'cerrado' ? 'cerrado' : 'abierto' }, { start: red(e, 'start'), end: red(e, 'end') });
        break;
      case 'AM':
        poner(e, 'AMP', 'AM', {}, { start: red(e, 'start'), end: red(e, 'end') });
        break;
      case 'VM':
        poner(e, 'VM', 'VM', {}, { start: red(e, 'start'), end: red(e, 'end') });
        break;
      default:
        throw new Error(`El esquema tiene una pieza que la protoboard no sabe montar (${e.clase}).`);
    }
  }
  const analisis = analisisPorDefecto();
  if (freq) {
    const per = 1 / freq;
    analisis.tran = { activo: true, paso: v(per / 200), fin: v(5 * per), inicio: '0', uic: false };
  }
  return {
    titulo,
    componentes,
    redes,
    directivas: [...new Set(directivas)].join('\n'),
    analisis,
    posiciones,
    refs: [figura],
    origen: { tipo: 'figura', id: figura },
  };
}
