// 1.3 (motor13b) «montar»: the rules of the card (GUIA §13.14) — what is wrong with the reader's board, first the most
// basic (a part missing, a leg out of the holes, two leads in a hole, a polarised part the wrong way round, a node of
// the schematic split over strips that nothing joins, two nodes joined, bodies on top of each other), said with the
// instrument's neutral names of the nodes; the electrical check (the board's operating point against the schematic's,
// node by node); the verdict «Comprobar» gives. A two-leg part that works either way round (a resistor, a ceramic
// capacitor) may go either way; a LED, a diode or an electrolytic the other way round is said as such (and its
// consequences on the nets are not counted twice). componentes/leccion12/Montar.svelte keeps the diagnosis up to
// date; lib/leccion12/motor12.ts calls these from the shell. Pure.

import { formatear } from '../../leccion11/modelo';
import type { Tarjeta, Texto } from '../../leccion11/tipos';
import { conexiones } from '../../../componentes/protoboard/conexiones';
import { bajoCuerpo, cuerpoDe, encapsuladoDe, EXTERNOS, solapan } from '../../../componentes/protoboard/encapsulados';
import { nombreAgujero } from '../../../componentes/protoboard/placa';
import { planDeMontaje } from '../../../componentes/protoboard/guia';
import type { DocumentoProtoboard, Pieza } from '../../../componentes/protoboard/tipos';
import type { DiagnosticoMontar, EstadoMontar, Montar, ProblemaMontar } from './tipos';

const T = (s: string): Texto => [{ t: 'txt', s }];
/** Polarised two-leg parts: the wrong way round is a fault of its own. */
const POLARES = new Set(['led', 'diodo', 'zener', 'electrolitico']);
/** Relative and absolute tolerance of the board's node voltages against the schematic's (the same ngspice). */
export const TOL_TENSION = { rel: 2e-3, abs: 2e-3 };

export function nuevoEstadoMontar(): EstadoMontar {
  return { tipo: 'montar', doc: null, diagnostico: null };
}

/** The board the card starts from: the supply with its leads and the rails bridged (the guide's start, guia.ts). */
export function placaInicial(a: Montar): DocumentoProtoboard {
  return JSON.parse(JSON.stringify(planDeMontaje(a.objetivo, a.objetivo.titulo).inicio)) as DocumentoProtoboard;
}

/** Whether the board has anything of the reader's on it (a part beyond the supply). */
export function placaVacia(doc: DocumentoProtoboard): boolean {
  return !doc.piezas.some((p) => !EXTERNOS.has(p.enc));
}

const lista = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : (xs[0] ?? ''));

/** «la pata K de D1», «una pata de R1». */
function pata(p: Pieza, i: number): string {
  const n = encapsuladoDe(p.comp).nombres[i] ?? '';
  return /^\d$/.test(n) || !n ? `una pata de ${p.comp.nombre}` : `la pata ${n} de ${p.comp.nombre}`;
}

/** «el LED D1», «la resistencia R1», «el electrolítico C1». */
function nombreCorto(p: Pieza): string {
  const ART: Record<string, string> = { resistencia: 'la resistencia', led: 'el LED', diodo: 'el diodo', zener: 'el zener', electrolitico: 'el electrolítico', bobina: 'la bobina', alimentacion: 'la fuente' };
  const a = ART[p.enc] ?? (p.comp.tipo === 'C' ? 'el condensador' : /^Q/.test(p.comp.tipo) ? 'el transistor' : 'la pieza');
  return `${a} ${p.comp.nombre}`;
}

/**
 * What is wrong with the board, in the order it should be fixed: the parts of the schematic missing, legs and wire
 * ends out of the holes, two leads in one hole, polarised parts the wrong way round, nodes split, nodes joined, bodies
 * on top of each other. Empty: the board is the schematic.
 */
export function diagnosticarMontaje(a: Montar, doc: DocumentoProtoboard): ProblemaMontar[] {
  const obj = a.objetivo;
  const orig = obj.original ?? {};
  const cfg = { placas: doc.placas, columnas: doc.columnas };
  const out: ProblemaMontar[] = [];
  const redes = (n: string) => `«${a.redes[n] ?? n}»`;
  // the reader's pieces by designator
  const deUsuario = new Map<string, Pieza>();
  for (const p of doc.piezas) if (!deUsuario.has(p.comp.nombre.toUpperCase())) deUsuario.set(p.comp.nombre.toUpperCase(), p);
  const pares: { p: Pieza; t: Pieza }[] = [];
  for (const t of obj.piezas) {
    const p = deUsuario.get(t.comp.nombre.toUpperCase());
    if (!p) out.push({ tipo: 'falta', texto: `Falta ${nombreCorto(t)}: llévelo de la bandeja a la placa.`, pieza: t.id });
    else pares.push({ p, t });
  }
  const con = conexiones(doc);
  for (const s of con.sueltas) {
    const p = doc.piezas.find((x) => x.id === s.pieza);
    if (p) out.push({ tipo: 'suelta', texto: `${pata(p, s.pata).replace(/^./, (c) => c.toUpperCase())} no está en ningún agujero.`, pieza: p.id });
  }
  for (const s of con.extremosSueltos) out.push({ tipo: 'suelta', texto: 'Un extremo de un cable no está en ningún agujero.', pieza: s.cable });
  for (const q of con.dobles) out.push({ tipo: 'doble', texto: `En el agujero ${nombreAgujero(cfg, q[0], q[1])} hay dos patas o cables: cada agujero lleva uno.` });
  // each pin's schematic node: by name, except two-leg parts that may be either way round (the way that fits wins)
  const redPin = (p: Pieza, pin: string) => con.redDePin.get(`${p.id}.${pin}`);
  const asignado = new Map<string, string>();
  const votos = new Map<number, Map<string, number>>();
  const votar = (i: number | undefined, n: string | undefined) => {
    if (i == null || !n) return;
    const m = votos.get(i) ?? votos.set(i, new Map()).get(i)!;
    m.set(n, (m.get(n) ?? 0) + 1);
  };
  const reversibles: { p: Pieza; t: Pieza }[] = [];
  for (const x of pares) {
    const dosPatas = x.t.pos.length === 2 && x.t.patas.every(Boolean) && !EXTERNOS.has(x.t.enc);
    if (dosPatas) {
      reversibles.push(x);
      continue;
    }
    for (const pin of x.t.patas) {
      if (!pin) continue;
      asignado.set(`${x.p.id}.${pin}`, orig[`${x.t.id}.${pin}`]!);
      votar(redPin(x.p, pin), orig[`${x.t.id}.${pin}`]);
    }
  }
  const alReves = new Set<string>();
  // (a few rounds: a chain of resistors gets its votes from the supply inwards)
  for (let ronda = 0; ronda < Math.max(1, reversibles.length); ronda++) {
    for (const { p, t } of reversibles) {
      const [a0, a1] = [t.patas[0]!, t.patas[1]!];
      const [na, nb] = [orig[`${t.id}.${a0}`]!, orig[`${t.id}.${a1}`]!];
      const [ia, ib] = [redPin(p, a0), redPin(p, a1)];
      const v = (i: number | undefined, n: string) => (i == null ? 0 : (votos.get(i)?.get(n) ?? 0));
      const derecho = v(ia, na) + v(ib, nb);
      const reves = v(ia, nb) + v(ib, na);
      if (reves > derecho) alReves.add(p.id);
      else alReves.delete(p.id);
    }
    votos.clear();
    for (const [k, n] of asignado) votar(con.redDePin.get(k), n);
    for (const { p, t } of reversibles) {
      const r = alReves.has(p.id);
      votar(redPin(p, t.patas[0]!), orig[`${t.id}.${t.patas[r ? 1 : 0]!}`]);
      votar(redPin(p, t.patas[1]!), orig[`${t.id}.${t.patas[r ? 0 : 1]!}`]);
    }
  }
  for (const { p, t } of reversibles) {
    const r = alReves.has(p.id);
    asignado.set(`${p.id}.${t.patas[0]}`, orig[`${t.id}.${t.patas[r ? 1 : 0]!}`]!);
    asignado.set(`${p.id}.${t.patas[1]}`, orig[`${t.id}.${t.patas[r ? 0 : 1]!}`]!);
    if (r && POLARES.has(t.enc)) {
      const texto =
        t.enc === 'led'
          ? `${nombreCorto(p).replace(/^./, (c) => c.toUpperCase())} está al revés: su pata larga (A, ánodo) va hacia ${redes(orig[`${t.id}.${t.patas[0]}`]!)} y la corta (K) hacia ${redes(orig[`${t.id}.${t.patas[1]}`]!)}. Al revés no conduce ni se enciende.`
          : t.enc === 'electrolitico'
            ? `${nombreCorto(p).replace(/^./, (c) => c.toUpperCase())} está al revés: su pata + va hacia ${redes(orig[`${t.id}.${t.patas[t.polo ?? 0]}`]!)} y la de la franja (−) hacia ${redes(orig[`${t.id}.${t.patas[1 - (t.polo ?? 0)]}`]!)}. Al revés se estropea.`
            : `${nombreCorto(p).replace(/^./, (c) => c.toUpperCase())} está al revés: su franja (K, cátodo) va hacia ${redes(orig[`${t.id}.${t.patas[1]}`]!)}.`;
      out.push({ tipo: 'reves', texto, pieza: p.id });
    }
  }
  // the nodes: each one a single net of the board, no two in one
  const porRed = new Map<string, Map<number, string[]>>();
  const porNet = new Map<number, Set<string>>();
  for (const [k, n] of asignado) {
    const i = con.redDePin.get(k);
    if (i == null) continue;
    const pinera = porRed.get(n) ?? porRed.set(n, new Map()).get(n)!;
    const [pid, pin] = k.split('.') as [string, string];
    const p = doc.piezas.find((x) => x.id === pid)!;
    const quien = p.patas.length === 2 && !EXTERNOS.has(p.enc) && !POLARES.has(p.enc) ? p.comp.nombre : `${p.comp.nombre} (${encapsuladoDe(p.comp).nombres[p.patas.indexOf(pin)] ?? pin})`;
    (pinera.get(i) ?? pinera.set(i, []).get(i)!).push(quien);
    (porNet.get(i) ?? porNet.set(i, new Set()).get(i)!).add(n);
  }
  for (const [n, nets] of porRed)
    if (nets.size > 1) {
      const grupos = [...nets.values()].map((g) => lista([...new Set(g)]));
      out.push({ tipo: 'partida', texto: `${redes(n)} no está unido: ${lista(grupos)} quedan en tiras distintas que nada une. Póngalos en la misma tira o únalos con un cable.`, red: n });
    }
  for (const [, ns] of porNet)
    if (ns.size > 1) {
      const l = [...ns];
      out.push({ tipo: 'unidas', texto: `${lista(l.map(redes))} quedan unidos en su placa, y en el esquema no lo están: hay una pata o un cable en una tira que no es la suya.`, red: l[0] });
    }
  // bodies on top of each other, a lead under a body
  const cuerpos = doc.piezas.map((p) => ({ p, b: cuerpoDe(p) })).filter((x) => x.b);
  for (let i = 0; i < cuerpos.length; i++)
    for (let j = i + 1; j < cuerpos.length; j++)
      if (solapan(cuerpos[i]!.b!, cuerpos[j]!.b!)) out.push({ tipo: 'solapa', texto: `${cuerpos[i]!.p.comp.nombre} y ${cuerpos[j]!.p.comp.nombre} están uno encima del otro: separe uno.`, pieza: cuerpos[j]!.p.id });
  for (const { p, b } of cuerpos)
    for (const q of doc.piezas)
      if (q.id !== p.id && q.pos.some((x) => bajoCuerpo(b!, x[0], x[1]))) out.push({ tipo: 'solapa', texto: `Una pata de ${q.comp.nombre} queda debajo de ${p.comp.nombre}: no se vería ni se podría soldar; muévala.`, pieza: q.id });
  return out;
}

/**
 * The electrical check: the board's node voltages (its own operating point on the app's ngspice) against the
 * schematic's, node by node. A node that differs is a problem (a value or a part the topology cannot see).
 */
export function compararTensiones(a: Montar, placa: Record<string, number>, esquema: Record<string, number>): { problemas: ProblemaMontar[]; tensiones: Record<string, { placa: number; esquema: number }> } {
  const problemas: ProblemaMontar[] = [];
  const tensiones: Record<string, { placa: number; esquema: number }> = {};
  const fmt = (x: number) => formatear({ sim: [], nombre: '', unidad: 'V', cifras: 3, recortar: false }, Math.abs(x) < 1e-7 ? 0 : x);
  for (const n of Object.keys(a.redes).sort()) {
    if (n === '0') continue;
    const vp = placa[n];
    const ve = esquema[n];
    if (vp == null || ve == null || !Number.isFinite(vp) || !Number.isFinite(ve)) continue;
    tensiones[n] = { placa: vp, esquema: ve };
    if (Math.abs(vp - ve) > TOL_TENSION.abs + TOL_TENSION.rel * Math.abs(ve))
      problemas.push({ tipo: 'tension', texto: `En «${a.redes[n] ?? n}» su montaje da ${fmt(vp)} y el esquema ${fmt(ve)}: algo no está como en el esquema.`, red: n });
  }
  return { problemas, tensiones };
}

/** The multimeter's reading of `medir` from node voltages. */
export function lecturaMedir(a: Montar, v: Record<string, number>): number | null {
  if (!a.medir) return null;
  const [r, n] = a.medir.entre;
  const x = (k: string) => (k === '0' ? 0 : v[k]);
  const vr = x(r);
  const vn = x(n);
  return vr == null || vn == null ? null : vr - vn;
}

export function puedeComprobarMontar(e: EstadoMontar | undefined): boolean {
  const d = e?.diagnostico;
  return !!d && !d.vacia && d.simulado !== 'pendiente';
}

export interface VeredictoMontar {
  bien: boolean;
  textos: Texto[];
}

export function comprobarMontar(t: Tarjeta, a: Montar, e: EstadoMontar | undefined): VeredictoMontar {
  const d: DiagnosticoMontar | null | undefined = e?.diagnostico;
  const exito = t.exito ? [t.exito] : [];
  if (!d) return { bien: false, textos: [] };
  if (d.problemas.length) {
    const p = d.problemas[0]!;
    const propio = p.red ? a.porque[p.red] : undefined;
    const quedan = d.problemas.length - 1;
    return { bien: false, textos: [T(p.texto), ...(propio ? [propio] : []), ...(quedan ? [T(quedan === 1 ? 'Después queda otra cosa por arreglar.' : `Después quedan ${quedan} cosas más por arreglar.`)] : [])] };
  }
  const fmt = (x: number) => formatear({ sim: [], nombre: '', unidad: a.medir?.unidad ?? 'V', cifras: 3, recortar: false }, Math.abs(x) < 1e-7 ? 0 : x);
  const linea =
    d.simulado === 'si'
      ? T('Su placa es el esquema: cada nudo del esquema es una sola tira (o tiras unidas por cables) y el simulador da en cada uno la misma tensión que en el esquema.')
      : T('Su placa es el esquema: cada nudo del esquema es una sola tira (o tiras unidas por cables). (El simulador no ha podido comprobar las tensiones aquí.)');
  const medida = a.medir && d.lectura != null ? [[...a.medir.rotulo, { t: 'txt' as const, s: `: el multímetro marca ${fmt(d.lectura)}.` }] as Texto] : [];
  return { bien: true, textos: [linea, ...medida, ...exito] };
}
