// 1.3 (motor13b) «montar» in the generator (GUIA §13.14): from the card's circuit widget — the schematic's netlist with
// the card's values (contextoNetlist) — to the breadboard the reader builds. The netlist is folded for a real board
// (its 0 V meters joined into wires, an open load dropped, what is left hanging removed), turned into the protoboard's
// circuit (esquema-auto lays it out as «Editar el esquema» does, componentes/protoboard/fuentes.ts), placed
// automatically (colocacion.ts) and checked clean (verificar.ts) with parts the protoboard has; with `medir`, the
// placed board's own netlist goes to the script's ngspice, which must read the model's value on it. Node only (it
// lays the schematic out): lib/leccion12/generar12.ts calls `actividadMontarDe`.

import { contextoNetlist, holguraNoLineal, TOL_OP, type ComprobacionSpice } from '../../leccion11/spice';
import { contarPalabras } from '../../leccion11/texto';
import type { Texto, WidgetCircuito } from '../../leccion11/tipos';
import { editableDeNetlist } from '../../../componentes/esquema-auto/editable';
import { circuitoDeEditable } from '../../../componentes/protoboard/fuentes';
import { colocarCircuito } from '../../../componentes/protoboard/colocacion';
import { verificarMontaje } from '../../../componentes/protoboard/verificar';
import { netlistProtoboard } from '../../../componentes/protoboard/conexiones';
import { netlistPuntoTrabajo } from '../../../componentes/protoboard/simulacion';
import { EXTERNOS } from '../../../componentes/protoboard/encapsulados';
import type { DocumentoProtoboard } from '../../../componentes/protoboard/tipos';
import type { Contexto12, Resultado12 } from '../generar12';
import type { Montar } from './tipos';

const esObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const esNumero = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Element letters a «montar» card can have (what the protoboard's tray and packages hold). */
const LETRAS = new Set(['R', 'C', 'L', 'D', 'V', 'Q']);
/** Packages that are not a part one puts in a breadboard by hand (a module, a meter, a transformer…). */
const NO_MONTABLES = new Set(['modulo', 'medida', 'generador', 'corriente', 'voltimetro', 'sonda', 'trafo', 'motor', 'altavoz', 'lampara', 'rele', 'puente']);
/** Resistances from here up are an open circuit (a load the switch disconnects: «1e15»). */
const ABIERTO = 1e12;

/** A SPICE number («8000.000000», «1e-4», «4k7») in the book's style («8k», «100u»): the tray shows it. */
export function numeroSpice(s: string): string {
  const m = /^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)(meg|[tgkmunpf])?$/i.exec(s.trim());
  if (!m) return s;
  const MULT: Record<string, number> = { t: 1e12, g: 1e9, meg: 1e6, k: 1e3, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 };
  const v = Number(m[1]) * (m[2] ? MULT[m[2].toLowerCase()]! : 1);
  if (!Number.isFinite(v) || v === 0) return s;
  const PREF: [number, string][] = [[1e9, 'g'], [1e6, 'meg'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'u'], [1e-9, 'n'], [1e-12, 'p']];
  const [f, p] = PREF.find(([f]) => Math.abs(v) >= f * 0.999999) ?? PREF[PREF.length - 1]!;
  return `${Number((v / f).toPrecision(6))}${p}`;
}

const valorSpice = (s: string): number => {
  const m = /^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)(meg|[tgkmunpf])?/i.exec(s.trim());
  if (!m) return NaN;
  const MULT: Record<string, number> = { t: 1e12, g: 1e9, meg: 1e6, k: 1e3, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 };
  return Number(m[1]) * (m[2] ? MULT[m[2].toLowerCase()]! : 1);
};

export interface NetlistPlegada {
  /** The board's lines: elements and .model cards. */
  lineas: string[];
  /** Every node of the schematic's netlist → the node it is on the board. */
  nodo: Map<string, string>;
  /** What could not go on a board (Spanish). */
  errores: string[];
}

/**
 * The schematic's netlist as a real board has it: each 0 V meter (a «VMED a b 0» the instrument opens) becomes a wire
 * (its two nodes one), a resistor of 1 TΩ or more (an open load) goes, and so does whatever is left on a node of its
 * own (the constant-drop reference of a reversed diode); the joined nodes take the name the instrument gives one of
 * them (`nombres`), ground first. Analyses and other dot cards go; .model cards stay.
 */
export function plegarNetlist(lineas: readonly string[], nombres: ReadonlySet<string>, medidores: ReadonlySet<string> = new Set()): NetlistPlegada {
  const errores: string[] = [];
  const padre = new Map<string, string>();
  const raiz = (x: string): string => {
    let y = x;
    while (padre.has(y) && padre.get(y) !== y) y = padre.get(y)!;
    return y;
  };
  const unir = (a: string, b: string) => {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra === rb) return;
    // (ground wins, then a node the instrument names)
    const peso = (x: string) => (x === '0' ? 2 : nombres.has(x) ? 1 : 0);
    if (peso(ra) >= peso(rb)) padre.set(rb, ra);
    else padre.set(ra, rb);
  };
  const modelos: string[] = [];
  let elementos: string[][] = [];
  const todos = new Set<string>();
  for (const raw of lineas) {
    const s = raw.replace(/;.*$/, '').trim();
    if (!s || s.startsWith('*')) continue;
    if (s.startsWith('.')) {
      if (/^\.model\b/i.test(s)) modelos.push(s);
      continue;
    }
    const t = s.split(/\s+/);
    const letra = t[0]![0]!.toUpperCase();
    if (!LETRAS.has(letra)) {
      errores.push(`«${t[0]}» (${letra}) no es una pieza que se pueda montar en la protoboard de la lección (resistencias, condensadores, bobinas, diodos, LED, transistores y una fuente de continua)`);
      continue;
    }
    const nodos = letra === 'Q' ? t.slice(1, 4) : t.slice(1, 3);
    for (const n of nodos) todos.add(n.toLowerCase());
    if (letra === 'V') {
      const resto = t.slice(3).join(' ');
      if (/\b(sin|pulse|pwl|exp|sffm|ac)\b/i.test(resto)) {
        errores.push(`«${t[0]}» no es una fuente de continua: en la protoboard de la lección solo hay la de continua`);
        continue;
      }
      const v = valorSpice(resto.replace(/^dc\s+/i, ''));
      // (a 0 V meter the instrument opens is a wire on the board; any other 0 V source is a supply turned down)
      if (v === 0 && (medidores.has(t[0]!.toLowerCase()) || /^vm/i.test(t[0]!))) {
        unir(t[1]!.toLowerCase(), t[2]!.toLowerCase());
        continue;
      }
      // (a schematic writes a supply turned to 0 as 1 nV: lib/leccion11/esquemas/comun.ts `ng`)
      if (Math.abs(v) < 1e-6) {
        errores.push(`la fuente «${t[0]}» está a 0 V con los valores de la tarjeta: monte el circuito con la fuente encendida`);
        continue;
      }
    }
    if (letra === 'R' && valorSpice(t[3] ?? '') >= ABIERTO) continue;
    elementos.push(t);
  }
  const de = (n: string) => raiz(n.toLowerCase());
  // (whatever hangs on a node of its own goes, until nothing does)
  for (;;) {
    const uso = new Map<string, number>();
    for (const t of elementos) for (const n of new Set((t[0]![0]!.toUpperCase() === 'Q' ? t.slice(1, 4) : t.slice(1, 3)).map(de))) uso.set(n, (uso.get(n) ?? 0) + 1);
    const antes = elementos.length;
    elementos = elementos.filter((t) => {
      const ns = (t[0]![0]!.toUpperCase() === 'Q' ? t.slice(1, 4) : t.slice(1, 3)).map(de).filter((n) => n !== '0');
      return !ns.length || ns.some((n) => (uso.get(n) ?? 0) > 1);
    });
    if (elementos.length === antes) break;
  }
  const nodo = new Map([...todos].map((n) => [n, raiz(n)]));
  const salida = elementos.map((t) => {
    const letra = t[0]![0]!.toUpperCase();
    const k = letra === 'Q' ? 4 : 3;
    const nodos = t.slice(1, k).map(de);
    const resto = t.slice(k);
    if ('RCL'.includes(letra) && resto[0]) resto[0] = numeroSpice(resto[0]);
    return [t[0]!, ...nodos, ...resto].join(' ');
  });
  // (only the models that something still uses)
  const usados = new Set(elementos.map((t) => (t[0]![0]!.toUpperCase() === 'Q' ? t[4] : t[3])?.toLowerCase()).filter(Boolean));
  return { lineas: [...salida, ...modelos.filter((m) => usados.has(m.split(/\s+/)[1]!.toLowerCase()))], nodo, errores };
}

/** The automatic placement of a folded netlist: the board and what went wrong (Spanish). */
export function montajeDe(lineas: readonly string[], titulo: string): { doc: DocumentoProtoboard | null; errores: string[] } {
  const texto = [`* ${titulo}`, ...lineas, '.op', '.end'].join('\n');
  const ed = editableDeNetlist(texto);
  if (!ed) return { doc: null, errores: ['el esquema no se puede dibujar para la protoboard (esquema-auto)'] };
  let doc: DocumentoProtoboard;
  try {
    doc = colocarCircuito(circuitoDeEditable(texto, ed, { tipo: 'texto' })).doc;
  } catch (err) {
    return { doc: null, errores: [`la colocación automática falla: ${err instanceof Error ? err.message : String(err)}`] };
  }
  const errores = verificarMontaje(doc).map((x) => `la colocación automática no queda limpia: ${x}`);
  for (const p of doc.piezas) if (NO_MONTABLES.has(p.enc)) errores.push(`${p.comp.nombre} no es una pieza de la bandeja de la protoboard (${p.enc})`);
  doc.titulo = titulo;
  return { doc, errores };
}

/** «el nudo de R1 y D1»: a node the instrument does not name, by the parts on it. */
function nombrePorPiezas(doc: DocumentoProtoboard, red: string): string {
  const piezas = doc.piezas.filter((p) => p.patas.some((pin) => pin && doc.original?.[`${p.id}.${pin}`] === red)).map((p) => p.comp.nombre);
  const l = [...new Set(piezas)];
  return l.length ? `Nudo de ${l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}` : l[0]}` : `Nudo ${red}`;
}

export function actividadMontarDe(x: Record<string, unknown>, c: Contexto12, out: Resultado12): void {
  const { e } = c;
  for (const k of Object.keys(x)) if (!['ayuda', 'medir', 'porque'].includes(k)) e(`«montar.${k}»: clave desconocida`);
  const w = c.widget;
  const def = c.esquema;
  if (w?.tipo !== 'circuito' || !def) {
    e('«montar»: la tarjeta lleva un widget «circuito» (el esquema que se monta)');
    return;
  }
  const wc = w as WidgetCircuito;
  if (wc.ocultar) e('«montar»: el esquema de referencia no puede ir oculto');
  const ayuda = x.ayuda ?? 'guiada';
  if (ayuda !== 'guiada' && ayuda !== 'libre') e('«montar.ayuda»: guiada (los agujeros se iluminan paso a paso) o libre');
  const r0 = c.mc.evaluar(c.inicial);
  let lineas: string[];
  try {
    lineas = def.netlist(contextoNetlist(wc, r0), 'op');
  } catch (err) {
    e(`«montar»: el esquema no da su netlist (${err instanceof Error ? err.message : String(err)})`);
    return;
  }
  const med = def.medible?.(contextoNetlist(wc, r0));
  const puntos = med?.puntos ?? {};
  const p = plegarNetlist(lineas, new Set(Object.keys(puntos)), new Set(Object.keys(med?.ramas ?? {}).map((k) => k.toLowerCase())));
  for (const m of p.errores) e(`«montar»: ${m}`);
  if (p.errores.length) return;
  const m = montajeDe(p.lineas, def.titulo);
  for (const x2 of m.errores) e(`«montar»: ${x2}`);
  if (!m.doc || m.errores.length) return;
  const objetivo = m.doc;
  // neutral names of the board's nodes: the instrument's (any node folded into it), ground, else by its parts
  const redes: Record<string, string> = {};
  for (const red of new Set(Object.values(objetivo.original ?? {}))) {
    const propio = Object.entries(puntos).find(([n]) => p.nodo.get(n.toLowerCase()) === red)?.[1];
    redes[red] = propio ?? (red === '0' ? 'Masa' : nombrePorPiezas(objetivo, red));
  }
  const enPlaca = (n: string) => p.nodo.get(n.toLowerCase());
  // the author's «why» of a node split or joined
  const porque: Record<string, Texto> = {};
  if (x.porque != null) {
    if (!esObjeto(x.porque)) e('«montar.porque»: { nodo: texto } (un nodo del esquema)');
    else
      for (const [k, v] of Object.entries(x.porque)) {
        const red = enPlaca(k);
        if (!red || !(red in redes)) {
          e(`«montar.porque.${k}»: no es un nodo del esquema montado (${Object.keys(redes).sort().join(', ')})`);
          continue;
        }
        const t = c.texto(v, `montar.porque.${k}`, true);
        if (!t) continue;
        if (contarPalabras(t) > 40) e(`«montar.porque.${k}»: más de 40 palabras`);
        porque[red] = t;
        out.textos.push([`montar.porque.${k}`, t]);
      }
  }
  // the reading on the finished board, checked on the placed board's own netlist by the script's ngspice
  let medir: Montar['medir'];
  if (x.medir != null) {
    const o = esObjeto(x.medir) ? x.medir : {};
    for (const k of Object.keys(o)) if (!['entre', 'valor', 'tol', 'rotulo'].includes(k)) e(`«montar.medir.${k}»: clave desconocida`);
    const entre = Array.isArray(o.entre) && o.entre.length === 2 ? (o.entre as unknown[]).map((y) => String(y)) : null;
    if (!entre) e('«montar.medir.entre»: [roja, negra], dos nodos del esquema (los del instrumento)');
    const nodos = entre?.map(enPlaca);
    if (entre && nodos) entre.forEach((n, k) => !nodos[k] && e(`«montar.medir.entre»: «${n}» no es un nodo del esquema (${Object.keys(puntos).join(', ')})`));
    if (nodos?.[0] && nodos[0] === nodos[1]) e('«montar.medir.entre»: las dos puntas en el mismo nodo del montaje');
    const valor = typeof o.valor === 'string' ? o.valor : null;
    if (!valor || !c.enModelo(valor)) e('«montar.medir.valor»: un valor del modelo (lo que debe marcar el multímetro)');
    const tol = o.tol == null ? 0.02 : o.tol;
    if (!esNumero(tol) || tol <= 0 || tol > 0.2) e('«montar.medir.tol»: tolerancia relativa, de 0 a 0,2');
    const rot = o.rotulo != null ? c.texto(o.rotulo, 'montar.medir.rotulo', true) : undefined;
    if (rot) out.textos.push(['montar.medir.rotulo', rot]);
    if (entre && nodos?.[0] && nodos[1] && nodos[0] !== nodos[1] && valor && c.enModelo(valor) && esNumero(tol)) {
      const mag = c.mc.magnitud(valor);
      const esperado = c.mc.funcion(valor)(r0);
      const rotulo: Texto = rot ?? [{ t: 'txt', s: `Entre «${redes[nodos[0]]}» y «${redes[nodos[1]]}»` }];
      medir = { entre: [nodos[0], nodos[1]], valor, unidad: mag?.unidad ?? 'V', tol, rotulo };
      const medida = ['0'].includes(nodos[1]) ? `v(${nodos[0]})` : nodos[0] === '0' ? `-v(${nodos[1]})` : `v(${nodos[0]})-v(${nodos[1]})`;
      const holgura = holguraNoLineal(def, wc, c.mc, c.inicial, (r) => c.mc.funcion(valor)(r));
      const placa = netlistPuntoTrabajo(netlistProtoboard(objetivo).texto, []);
      out.spice = [
        ...(out.spice ?? []),
        {
          donde: '«montar.medir» (el multímetro sobre el montaje de la protoboard)',
          netlist: placa,
          analisis: 'op',
          valores: [{ medida, esperado, tol: Math.max(Math.abs(esperado) * Math.max(tol, TOL_OP), 1e-6) + holgura }],
          curvas: [],
        } satisfies ComprobacionSpice,
      ];
      out.cifras.push(esperado);
    }
  }
  const externos = objetivo.piezas.filter((q) => EXTERNOS.has(q.enc)).length;
  if (objetivo.piezas.length - externos < 1) e('«montar»: el esquema no tiene ninguna pieza que poner en la placa');
  out.actividad = {
    tipo: 'montar',
    ayuda: ayuda === 'libre' ? 'libre' : 'guiada',
    objetivo,
    redes,
    netlist: [`* ${def.titulo} (esquema)`, ...p.lineas, '.op', '.end'].join('\n'),
    ...(medir ? { medir } : {}),
    porque,
  };
}
