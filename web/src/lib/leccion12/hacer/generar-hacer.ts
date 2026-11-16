// 1.2.1 (piloto121) in the generator: the instrument of a circuit widget, the steps answered by doing («medir»,
// «elegir», «marcar», «leer»), the goal («objetivo») of an explore, surprise or tuning card, and the lesson's mix of
// cards (doing against answering by choice; GUIA §13). lib/leccion11/generar.ts and lib/leccion12/generar12.ts call
// these. Pure.

import { contarPalabras, textoPlano } from '../../leccion11/texto';
import { enRango, type ModeloCompilado, type Valores } from '../../leccion11/modelo';
import { fraccionEje } from '../../leccion11/ejes';
import { resolverCC, type SolucionCC } from '../cc';
import { contextoNetlist, holguraNoLineal, medidaDePuntas, TOL_OP, type ComprobacionSpice, type ValorEsperado } from '../../leccion11/spice';
import type { DefinicionEsquema, Medible } from '../../leccion11/esquemas/tipos';
import { lineasOp, peticionMedida, type PeticionMedida } from './punto-trabajo';
import type { Condicion, Mando, Pista, Rango, Tarjeta, Texto, WidgetCircuito } from '../../leccion11/tipos';
import type { ErrorTipico } from '../tipos';
import { errorRelativo } from '../prediccion';
import type { Contexto12, Resultado12 } from '../generar12';
import { graficaDe, marcaBien, objetivoCumplido, posicionesMarca } from './motor-hacer';
import type { Elegir, Instrumento, Leer, Marcar, Medir, Objetivo } from './tipos';
import { buscarObjetivo, condicionLogica } from '../digital/objetivo-logico';
import { NOMBRE_PIEZA, type CircuitoLogico } from '../digital/logica';

const esObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const esNumero = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const MAX_PALABRAS = 40;
const MAX_ROTULO = 8;

// ------------------------------------------------------------------ the instrument

/** The netlist's nodes and its 0 V sources (the branches an ammeter can open). */
function partesNetlist(lineas: readonly string[]): { nodos: Set<string>; medidores: Set<string> } {
  const nodos = new Set<string>(['0']);
  const medidores = new Set<string>();
  for (const raw of lineas) {
    const s = raw.replace(/;.*$/, '').trim();
    if (!s || /^[.*+]/.test(s)) continue;
    const t = s.split(/\s+/);
    const tipo = t[0]![0]!.toUpperCase();
    if (/^bmed/i.test(t[0]!)) continue;
    if (t[1]) nodos.add(t[1].toLowerCase());
    if (t[2]) nodos.add(t[2].toLowerCase());
    if ((tipo === 'E' || tipo === 'G') && t[3] && t[4]) {
      nodos.add(t[3].toLowerCase());
      nodos.add(t[4].toLowerCase());
    }
    if (tipo === 'V' && t.length >= 4 && /^(dc\s+)?0$/i.test(t.slice(3).join(' '))) medidores.add(t[0]!.toLowerCase());
  }
  return { nodos, medidores };
}

/**
 * `widget.instrumento` of a circuit: its shape (checked against the netlist later, card by card: validarInstrumento).
 * motor121: `puntos` and `ramas` may be left out (the schematic's own, DefinicionEsquema.medible) or given as a list
 * of ids (the schematic's names for them); the oscilloscope's `curvas` may leave points out (their waveform comes
 * from the simulator).
 */
export function instrumentoDe(x: unknown, e: (m: string) => void, texto: (x: unknown, campo: string, obligatorio?: boolean) => Texto | undefined, curvas: number, medible?: Medible | null): Instrumento | null {
  if (!esObjeto(x)) {
    e('«widget.instrumento» debe ser { tipo: multimetro | osciloscopio, puntos, ramas? }');
    return null;
  }
  for (const k of Object.keys(x)) if (!['tipo', 'modos', 'puntos', 'ramas', 'curvas', 'negra'].includes(k)) e(`«widget.instrumento.${k}»: clave desconocida`);
  const tipo = x.tipo === 'osciloscopio' ? 'osciloscopio' : 'multimetro';
  if (x.tipo !== 'multimetro' && x.tipo !== 'osciloscopio') e('«widget.instrumento.tipo»: multimetro u osciloscopio');
  const lista = (o: unknown, campo: 'puntos' | 'ramas') => {
    const out: { id: string; rotulo: Texto }[] = [];
    const propios = medible?.[campo] ?? {};
    // (motor121: the schematic's own when left out; a list of ids takes the schematic's names)
    if (o == null) o = campo === 'ramas' && Array.isArray(x.modos) && !x.modos.includes('A') ? {} : propios;
    if (Array.isArray(o)) {
      const ids = o.map(String);
      o = {};
      for (const id of ids) {
        const k = Object.keys(propios).find((q) => q.toLowerCase() === id.toLowerCase());
        if (!k) e(`«widget.instrumento.${campo}»: «${id}» no tiene nombre en el esquema (${Object.keys(propios).join(', ') || 'ninguno'}); póngalo como { ${id}: «nombre» }`);
        else (o as Record<string, unknown>)[k] = propios[k];
      }
    }
    if (!esObjeto(o)) {
      e(`«widget.instrumento.${campo}»: { id: «nombre neutro» } o una lista de los del esquema`);
      return out;
    }
    for (const [id, r0] of Object.entries(o)) {
      // (an empty name takes the schematic's)
      const r = r0 == null || r0 === '' ? propios[id] : r0;
      const rot = texto(r, `widget.instrumento.${campo}.${id}`, true) ?? [];
      if (contarPalabras(rot) > MAX_ROTULO) e(`«widget.instrumento.${campo}.${id}»: más de ${MAX_ROTULO} palabras`);
      out.push({ id: id.toLowerCase(), rotulo: rot });
    }
    return out;
  };
  const puntos = lista(x.puntos, 'puntos');
  const ramas = tipo === 'osciloscopio' && x.ramas == null ? [] : lista(x.ramas, 'ramas');
  const i: Instrumento = { tipo, modos: [], puntos, ramas };
  if (tipo === 'osciloscopio') {
    if (ramas.length) e('«widget.instrumento.ramas»: el osciloscopio no mide corrientes');
    i.modos = ['V'];
    // (motor121: a point without a curve shows the simulator's waveform of its node: validarInstrumento checks it can)
    if (x.curvas != null && !esObjeto(x.curvas)) e('«widget.instrumento.curvas»: qué curva de la gráfica enseña cada punto ({ salida: 0 })');
    else {
      i.curvas = {};
      for (const [k, v] of Object.entries(esObjeto(x.curvas) ? x.curvas : {})) {
        if (!puntos.some((p) => p.id === k.toLowerCase())) e(`«widget.instrumento.curvas.${k}»: no es uno de los puntos`);
        if (!(typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < curvas)) e(`«widget.instrumento.curvas.${k}»: el número de una curva de la gráfica (0 a ${curvas - 1})`);
        else i.curvas[k.toLowerCase()] = v;
      }
    }
    if (puntos.length < 1) e('«widget.instrumento.puntos»: al menos un punto para la sonda');
    if (!curvas) e('el osciloscopio necesita la gráfica del circuito («widget.grafica»)');
  } else {
    const modos = Array.isArray(x.modos) ? x.modos : [...(puntos.length ? ['V'] : []), ...(ramas.length ? ['A'] : [])];
    i.modos = modos.filter((m): m is 'V' | 'A' => m === 'V' || m === 'A');
    if (i.modos.length !== modos.length || !i.modos.length) e('«widget.instrumento.modos»: V, A o los dos');
    if (i.modos.includes('V') && puntos.length < 2) e('«widget.instrumento.puntos»: al menos dos nodos para medir tensiones');
    if (i.modos.includes('A') && !ramas.length) e('«widget.instrumento.ramas»: al menos una rama para medir corrientes');
  }
  if (x.negra != null) {
    if (typeof x.negra !== 'string' || !puntos.some((p) => p.id === String(x.negra).toLowerCase())) e('«widget.instrumento.negra»: uno de los puntos');
    else i.negra = x.negra.toLowerCase();
  }
  return i;
}

/**
 * The instrument against the schematic's netlist in each state the generator checks: every point a node of it, every
 * branch one of its 0 V meters. A linear DC circuit is solved here (as the page does: lib/leccion12/cc.ts) and its
 * readings are returned (for the numbers rule); any other one (motor121: non-linear, or changing with time) is read
 * by the page on the app's ngspice (punto-trabajo.ts): the same netlist goes into `spice`, so the script checks the
 * simulator gives every point and branch the instrument offers. An oscilloscope's point without a curve needs a graph
 * against time whose curves the schematic simulates (its waveform comes from that run).
 */
export function validarInstrumento(def: DefinicionEsquema, w: WidgetCircuito, mc: ModeloCompilado, estados: readonly Valores[], e: (m: string) => void): { cifras: number[]; spice: ComprobacionSpice[] } {
  const i = w.instrumento!;
  const cifras: number[] = [];
  const spice: ComprobacionSpice[] = [];
  let dicho = false;
  for (const [k, st] of estados.entries()) {
    const r = mc.evaluar(st);
    let lineas: string[];
    try {
      lineas = def.netlist(contextoNetlist(w, r), 'op');
    } catch (err) {
      e(`«widget.instrumento»: el esquema no da su netlist (${err instanceof Error ? err.message : String(err)})`);
      return { cifras, spice };
    }
    const { nodos, medidores } = partesNetlist(lineas);
    if (!dicho) {
      for (const p of i.puntos) if (!nodos.has(p.id)) e(`«widget.instrumento.puntos.${p.id}»: no es un nodo del esquema ${def.nombre} (${[...nodos].sort().join(', ')})`);
      for (const b of i.ramas) if (!medidores.has(b.id)) e(`«widget.instrumento.ramas.${b.id}»: no es un medidor de 0 V del esquema ${def.nombre} (${[...medidores].sort().join(', ') || 'ninguno'})`);
      dicho = true;
    }
    const p = peticionMedida(w, r, def);
    if (i.tipo === 'osciloscopio') {
      const sinCurva = i.puntos.filter((q) => !(q.id in (i.curvas ?? {})));
      if (!sinCurva.length) continue;
      if (p?.analisis !== 'tran') {
        e(`«widget.instrumento.curvas»: falta la curva de ${sinCurva.map((q) => `«${q.id}»`).join(', ')} (sin ella, la onda la da el simulador, y eso pide una gráfica frente al tiempo con una curva que «mide» el esquema)`);
        return { cifras, spice };
      }
      if (k === 0) spice.push(existencia(p, sinCurva.filter((q) => q.id !== '0').map((q) => `v(${q.id})`), 'el osciloscopio'));
      continue;
    }
    if (!p) {
      const s = resolverCC(lineas);
      if (!s) {
        e('«widget.instrumento»: el punto de trabajo del circuito no tiene solución');
        return { cifras, spice };
      }
      for (const b of i.ramas) if (s.corrientes[b.id] != null) cifras.push(s.corrientes[b.id]!, Math.abs(s.corrientes[b.id]!));
      for (const a of i.puntos) for (const b of i.puntos) if (a.id !== b.id && s.nodos[a.id] != null && s.nodos[b.id] != null) cifras.push(s.nodos[a.id]! - s.nodos[b.id]!);
    } else if (k === 0) spice.push(existencia(p, [...i.puntos.filter((q) => q.id !== '0').map((q) => `v(${q.id})`), ...i.ramas.map((b) => `i(${b.id})`)], 'el multímetro'));
  }
  return { cifras, spice };
}

/** A check that the simulator gives these vectors (any value): what the page's instrument will read. */
function existencia(p: PeticionMedida, medidas: string[], quien: string): ComprobacionSpice {
  return {
    donde: `«widget.instrumento» (${quien}, lo que lee el simulador)`,
    netlist: p.netlist,
    analisis: p.analisis,
    valores: medidas.map((m): ValorEsperado => ({ medida: m, esperado: 0, tol: Infinity, ...(p.analisis === 'tran' ? { promedio: { desde: p.desde!, hasta: p.hasta! } } : {}) })),
    curvas: [],
  };
}

/** The nodes that are one in DC (joined by a 0 V source or a coil): a voltmeter across them always reads 0. */
function mismoNodo(lineas: readonly string[]): (a: string, b: string) => boolean {
  const padre = new Map<string, string>();
  const raiz = (x: string): string => {
    let y = x;
    while (padre.has(y) && padre.get(y) !== y) y = padre.get(y)!;
    return y;
  };
  for (const raw of lineas) {
    const s = raw.replace(/;.*$/, '').trim();
    if (!s || /^[.*+]/.test(s)) continue;
    const t = s.split(/\s+/);
    const tipo = t[0]![0]!.toUpperCase();
    const cero = tipo === 'V' && t.length >= 4 && /^(dc\s+)?0$/i.test(t.slice(3).join(' '));
    if ((cero || tipo === 'L') && t[1] && t[2]) {
      const a = raiz(t[1].toLowerCase().replace(/^gnd$/, '0'));
      const b = raiz(t[2].toLowerCase().replace(/^gnd$/, '0'));
      if (a !== b) padre.set(a, b);
    }
  }
  return (a, b) => raiz(a) === raiz(b);
}

/** A placement's reading in a linear DC solution (NaN when it has none). */
function leidaCC(s: SolucionCC | null, m: { entre?: [string, string]; rama?: string }): number {
  if (!s) return NaN;
  if (m.rama) return s.corrientes[m.rama] ?? NaN;
  if (m.entre) return (s.nodos[m.entre[0]] ?? NaN) - (s.nodos[m.entre[1]] ?? NaN);
  return NaN;
}

/**
 * The model's value of a placement checked against what the instrument reads: here when the page solves the circuit
 * (an error if it differs by more than `tolRel`), else a check for the script's ngspice run (the page's own reading).
 * `holgura`: add the book's constant-drop allowance (a «medir.valor»; not a «leer», whose tolerance is the reader's).
 */
function comprobarLectura(c: Contexto12, w: WidgetCircuito, m: { entre?: [string, string]; rama?: string }, expr: string, tolRel: number, donde: string, holgura: boolean, out: Resultado12): boolean {
  const def = c.esquema as DefinicionEsquema;
  const esperado = c.mc.funcion(expr)(c.mc.evaluar(c.inicial));
  if (!Number.isFinite(esperado)) return false;
  const p = peticionMedida(w, c.mc.evaluar(c.inicial), def);
  const medida = m.rama ? `i(${m.rama})` : m.entre ? medidaDePuntas(m.entre[0], m.entre[1]) : '';
  if (!medida) return false;
  if (!p) {
    const lineas = lineasOp(def, w, c.mc.evaluar(c.inicial)) ?? [];
    const leida = leidaCC(resolverCC(lineas), m);
    if (!Number.isFinite(leida)) c.e(`«${donde}»: el circuito no da esa medida`);
    else if (Math.abs(leida - esperado) > tolRel * Math.abs(esperado) + 1e-9) c.e(`«${donde}»: el multímetro marcaría ${leida} y el modelo da ${esperado}`);
    else return true;
    return false;
  }
  const extra = holgura ? holguraNoLineal(def, w, c.mc, c.inicial, (ev) => c.mc.funcion(expr)(ev)) : 0;
  const unidad = m.rama ? 'A' : 'V';
  const tol = Math.max(tolRel * Math.abs(esperado) + extra, unidad === 'A' ? 1e-9 : 1e-6);
  (out.spice ??= []).push({
    donde: `«${donde}» (lo que marcará el instrumento, del simulador)`,
    netlist: p.netlist,
    analisis: p.analisis,
    valores: [{ medida, esperado, tol, ...(p.analisis === 'tran' ? { promedio: { desde: p.desde!, hasta: p.hasta! } } : {}) }],
    curvas: [],
  });
  return true;
}

// ------------------------------------------------------------------ the steps

const IDZ = /^[a-z0-9][a-z0-9_-]*$|^red:[a-z0-9_]+$/;

export function actividadHacerDe(tipo: 'medir' | 'elegir' | 'marcar' | 'leer', x: Record<string, unknown>, c: Contexto12, out: Resultado12): void {
  const { e } = c;
  const claves = (permitidas: string[]) => {
    for (const k of Object.keys(x)) if (!permitidas.includes(k)) e(`«${tipo}.${k}»: clave desconocida`);
  };
  const explicacion = (v: unknown, campo: string, obligatorio = true): Texto | undefined => {
    const t = c.texto(v, campo, obligatorio);
    if (t && contarPalabras(t) > MAX_PALABRAS) e(`«${campo}»: ${contarPalabras(t)} palabras (máximo ${MAX_PALABRAS})`);
    if (t) out.textos.push([campo, t]);
    return t;
  };
  const porques = (o: unknown, campo: string): Record<string, Texto> => {
    const r: Record<string, Texto> = {};
    if (o == null) return r;
    if (!esObjeto(o)) {
      e(`«${campo}»: { id: «por qué no» }`);
      return r;
    }
    for (const [k, v] of Object.entries(o)) {
      const t = explicacion(v, `${campo}.${k}`);
      if (t) r[k.toLowerCase()] = t;
    }
    return r;
  };
  const r0 = c.mc.evaluar(c.inicial);
  const w = c.widget;

  if (tipo === 'medir') {
    claves(['magnitud', 'entre', 'rama', 'punto', 'polaridad', 'porque', 'valor']);
    const wc = w?.tipo === 'circuito' ? w : null;
    const i = wc?.instrumento;
    if (!wc || !i) {
      e('«medir» necesita un widget «circuito» con «instrumento»');
      return;
    }
    const magnitud = x.magnitud === 'corriente' ? 'corriente' : x.magnitud === 'senal' ? 'senal' : 'tension';
    if (!['tension', 'corriente', 'senal'].includes(String(x.magnitud))) e('«medir.magnitud»: tension, corriente o senal');
    const a: Medir = { tipo: 'medir', magnitud, polaridad: x.polaridad === true, porque: porques(x.porque, 'medir.porque') };
    const punto = (id: unknown, campo: string) => {
      const k = String(id ?? '').toLowerCase();
      if (!i.puntos.some((p) => p.id === k)) e(`«${campo}»: «${String(id)}» no es un punto del instrumento (${i.puntos.map((p) => p.id).join(', ')})`);
      return k;
    };
    if (magnitud === 'tension') {
      if (i.tipo !== 'multimetro' || !i.modos.includes('V')) e('«medir.magnitud: tension» necesita un multímetro con el modo V');
      if (!Array.isArray(x.entre) || x.entre.length !== 2) e('«medir.entre»: [punto de la roja, punto de la negra]');
      else {
        a.entre = [punto(x.entre[0], 'medir.entre'), punto(x.entre[1], 'medir.entre')];
        // (motor121: a measure that makes no sense — both probes on one node, which reads 0 whatever the circuit does)
        const lineas = c.esquema ? (lineasOp(c.esquema as DefinicionEsquema, wc, r0) ?? []) : [];
        if (a.entre[0] === a.entre[1] || mismoNodo(lineas)(a.entre[0], a.entre[1])) e('«medir.entre»: las dos puntas quedan en el mismo nodo: el multímetro marcaría siempre 0 V');
      }
    } else if (magnitud === 'corriente') {
      if (i.tipo !== 'multimetro' || !i.modos.includes('A')) e('«medir.magnitud: corriente» necesita un multímetro con el modo A');
      const k = String(x.rama ?? '').toLowerCase();
      if (!i.ramas.some((b) => b.id === k)) e(`«medir.rama»: una rama del instrumento (${i.ramas.map((b) => b.id).join(', ')})`);
      a.rama = k;
    } else {
      if (i.tipo !== 'osciloscopio') e('«medir.magnitud: senal» necesita un osciloscopio');
      a.punto = punto(x.punto, 'medir.punto');
    }
    // (every explanation is about a placement the reader can make)
    for (const k of Object.keys(a.porque)) {
      const par = k.split('/');
      const ok = par.length === 2 ? par.every((p) => i.puntos.some((q) => q.id === p)) : i.puntos.some((q) => q.id === k) || i.ramas.some((b) => b.id === k);
      if (!ok) e(`«medir.porque.${k}»: ni un punto, ni una rama, ni un par «a/b» del instrumento`);
    }
    const otras = magnitud === 'corriente' ? i.ramas.filter((b) => b.id !== a.rama) : magnitud === 'senal' ? i.puntos.filter((p) => p.id !== a.punto) : [];
    if (otras.length && !otras.some((o) => a.porque[o.id])) c.aviso('«medir.porque»: ninguna explicación para una medida equivocada (diga qué mide cada otra)');
    // (motor121: a branch that carries nothing in any state is not something to measure)
    if (magnitud === 'corriente' && a.rama && !peticionMedida(wc, r0, c.esquema as DefinicionEsquema)) {
      const estados = [c.inicial, ...c.mandos.flatMap((md) => [md.valores[0]!, md.valores[md.valores.length - 1]!].map((v) => ({ ...c.inicial, [md.valor]: v })))];
      const nada = estados.every((st) => {
        const ii = leidaCC(resolverCC(lineasOp(c.esquema as DefinicionEsquema, wc, c.mc.evaluar(st)) ?? []), { rama: a.rama });
        return Number.isFinite(ii) && Math.abs(ii) < 1e-10;
      });
      if (nada) e(`«medir.rama»: por «${a.rama}» no pasa corriente en ningún estado de la tarjeta: el amperímetro marcaría siempre 0`);
    }
    if (x.valor != null) {
      // the right reading is what the model says: against the page's DC solution of the netlist, or (motor121) the
      // simulator's reading, which the script checks (0,1 %, plus the book's constant drops' allowance)
      c.variables('medir.valor', x.valor);
      const esperado = c.mc.funcion(String(x.valor))(r0);
      if (magnitud === 'senal') e('«medir.valor»: solo en una medida del multímetro');
      else {
        if (comprobarLectura(c, wc, a, String(x.valor), TOL_OP, 'medir.valor', true, out) && Number.isFinite(esperado)) out.cifras.push(esperado);
      }
    }
    out.actividad = a;
    return;
  }

  if (tipo === 'elegir' && w?.tipo === 'logica') {
    // motor121 (autor121-digital): the pieces, LEDs and switches of a logic circuit are the zones
    claves(['zonas', 'bien', 'todas', 'porque']);
    const cl = w.circuito;
    const propias: Record<string, string> = {
      ...Object.fromEntries(cl.piezas.map((p) => [p.id, p.rotulo ? textoPlano(p.rotulo) : `${NOMBRE_PIEZA[p.tipo][0]!.toUpperCase()}${NOMBRE_PIEZA[p.tipo].slice(1)} ${p.id}`])),
      ...Object.fromEntries(cl.salidas.map((x) => [x.id, `LED ${textoPlano(x.rotulo)}`])),
      ...Object.fromEntries(cl.entradas.map((x) => [x.id, `${x.reloj ? 'Reloj' : 'Entrada'} ${textoPlano(x.rotulo)}`])),
    };
    let zs: unknown = x.zonas ?? Object.fromEntries(cl.piezas.map((p) => [p.id, propias[p.id]]));
    if (Array.isArray(zs)) zs = Object.fromEntries(zs.map(String).map((id) => [id, propias[id] ?? '']));
    const zonas: Elegir['zonas'] = [];
    if (!esObjeto(zs) || Object.keys(zs).length < 2 || Object.keys(zs).length > 12) e('«elegir.zonas»: de 2 a 12 piezas, LED o entradas del circuito lógico');
    else
      for (const [id, rv] of Object.entries(zs)) {
        if (!(id in propias)) e(`«elegir.zonas.${id}»: no es una pieza, un LED ni una entrada del circuito (${Object.keys(propias).join(', ')})`);
        const rot = c.texto(rv == null || rv === '' ? propias[id] : rv, `elegir.zonas.${id}`, true) ?? [];
        if (contarPalabras(rot) > MAX_ROTULO) e(`«elegir.zonas.${id}»: más de ${MAX_ROTULO} palabras`);
        zonas.push({ id, rotulo: rot });
      }
    const bien = (Array.isArray(x.bien) ? x.bien : [x.bien]).map(String);
    if (!bien.length || bien.some((b) => !zonas.some((z) => z.id === b))) e('«elegir.bien»: una o varias de las zonas');
    const porque: Record<string, Texto> = {};
    if (esObjeto(x.porque))
      for (const [k, v] of Object.entries(x.porque)) {
        const t = explicacion(v, `elegir.porque.${k}`);
        if (t) porque[k] = t;
        if (!zonas.some((z) => z.id === k) || bien.includes(k)) e(`«elegir.porque.${k}»: solo las zonas que no son la respuesta`);
      }
    for (const z of zonas) if (!bien.includes(z.id) && !porque[z.id]) e(`«elegir.porque.${z.id}»: cada zona que no es la respuesta dice por qué no`);
    out.actividad = { tipo: 'elegir', zonas, bien, todas: x.todas === true, porque } satisfies Elegir;
    return;
  }

  if (tipo === 'elegir') {
    claves(['zonas', 'bien', 'todas', 'porque']);
    const wc = w?.tipo === 'circuito' ? w : null;
    if (!wc) {
      e('«elegir» necesita un widget «circuito» o «logica» (lo que se toca es el esquema)');
      return;
    }
    const def = c.esquema as DefinicionEsquema;
    const zonas: Elegir['zonas'] = [];
    // (motor121: a list of ids, or none at all, takes the schematic's own names — its parts and its points as «red:»)
    const propias = (() => {
      try {
        const m = def.medible?.(contextoNetlist(wc, r0));
        return { ...(m?.zonas ?? {}), ...Object.fromEntries(Object.entries(m?.puntos ?? {}).map(([k, v]) => [`red:${k}`, v])) } as Record<string, string>;
      } catch {
        return {} as Record<string, string>;
      }
    })();
    if (x.zonas == null) x = { ...x, zonas: Object.fromEntries(Object.entries(propias).filter(([k]) => !k.startsWith('red:'))) };
    if (Array.isArray(x.zonas)) {
      const o: Record<string, unknown> = {};
      for (const id of x.zonas.map(String)) {
        if (!(id in propias)) e(`«elegir.zonas»: «${id}» no tiene nombre en el esquema (${Object.keys(propias).join(', ') || 'ninguno'}); póngalo como { ${id}: «nombre» }`);
        o[id] = propias[id] ?? id;
      }
      x = { ...x, zonas: o };
    }
    if (!esObjeto(x.zonas) || Object.keys(x.zonas).length < 2 || Object.keys(x.zonas).length > 12) e('«elegir.zonas»: de 2 a 12 { pieza o red:nodo: «nombre neutro» }, o una lista de las del esquema');
    else {
      let nodos: Set<string> = new Set();
      try {
        nodos = partesNetlist(def.netlist(contextoNetlist(wc, r0), 'op')).nodos;
      } catch {
        // (said by the circuit's own checks)
      }
      for (const [id, rv] of Object.entries(x.zonas)) {
        if (!IDZ.test(id)) e(`«elegir.zonas.${id}»: el nombre de una pieza («r1») o un nodo («red:n»)`);
        else if (id.startsWith('red:')) {
          if (!nodos.has(id.slice(4))) e(`«elegir.zonas.${id}»: «${id.slice(4)}» no es un nodo del esquema (${[...nodos].sort().join(', ')})`);
        } else if (!(id in wc.piezas) && !(id in (def.partes ?? {}))) e(`«elegir.zonas.${id}»: no es una pieza de este widget (${[...Object.keys(wc.piezas), ...Object.keys(def.partes ?? {})].join(', ')})`);
        const rot = c.texto(rv == null || rv === '' ? propias[id] : rv, `elegir.zonas.${id}`, true) ?? [];
        if (contarPalabras(rot) > MAX_ROTULO) e(`«elegir.zonas.${id}»: más de ${MAX_ROTULO} palabras`);
        zonas.push({ id, rotulo: rot });
      }
    }
    const bien = (Array.isArray(x.bien) ? x.bien : [x.bien]).map(String);
    if (!bien.length || bien.some((b) => !zonas.some((z) => z.id === b))) e('«elegir.bien»: una o varias de las zonas');
    const porque = (() => {
      const r: Record<string, Texto> = {};
      if (!esObjeto(x.porque)) return r;
      for (const [k, v] of Object.entries(x.porque)) {
        const t = explicacion(v, `elegir.porque.${k}`);
        if (t) r[k] = t;
        if (!zonas.some((z) => z.id === k) || bien.includes(k)) e(`«elegir.porque.${k}»: solo las zonas que no son la respuesta`);
      }
      return r;
    })();
    for (const z of zonas) if (!bien.includes(z.id) && !porque[z.id]) e(`«elegir.porque.${z.id}»: cada zona que no es la respuesta dice por qué no`);
    out.actividad = { tipo: 'elegir', zonas, bien, todas: x.todas === true, porque } satisfies Elegir;
    return;
  }

  if (tipo === 'marcar' && x.cronograma != null) {
    // motor121 (autor121-digital): the cursor of a logic circuit's timing diagram on the cycle where something happens
    claves(['cronograma', 'ciclo', 'senal', 'rotulo', 'porque']);
    const cr = w?.tipo === 'logica' ? w.cronograma : undefined;
    if (x.cronograma !== true) e('«marcar.cronograma»: true');
    if (!cr) {
      e('«marcar.cronograma» necesita un widget «logica» con su «cronograma»');
      return;
    }
    const ciclo = esNumero(x.ciclo) ? x.ciclo : NaN;
    if (!Number.isInteger(ciclo) || ciclo < 1 || ciclo > cr.ciclos) e(`«marcar.ciclo»: el número de un ciclo del cronograma (1 a ${cr.ciclos})`);
    else if (ciclo === 1) e('«marcar.ciclo»: el cursor empieza en el ciclo 1; pida otro, o el lector acertaría sin moverlo');
    if (x.senal != null && !cr.senales.includes(String(x.senal))) e(`«marcar.senal»: una fila del cronograma (${cr.senales.join(', ')})`);
    const porque: Record<string, Texto> = {};
    if (x.porque != null && !esObjeto(x.porque)) e('«marcar.porque»: { ciclo: «por qué no» }');
    for (const [k, v] of Object.entries(esObjeto(x.porque) ? x.porque : {})) {
      const n = Number(k);
      if (!Number.isInteger(n) || n < 1 || n > cr.ciclos || n === ciclo) e(`«marcar.porque.${k}»: un ciclo del cronograma que no es la respuesta`);
      const t = explicacion(v, `marcar.porque.${k}`);
      if (t) porque[String(n)] = t;
    }
    if (!Object.keys(porque).length) c.aviso('«marcar.porque»: ninguna explicación de un ciclo equivocado (diga qué pasa en los vecinos)');
    out.actividad = { tipo: 'marcar', modo: 'x', tol: 0.03, inicio: { x: 0, y: 0 }, rotulo: c.texto(x.rotulo, 'marcar.rotulo', true) ?? [], pasos: 120, cronograma: { ciclo, ...(x.senal != null ? { senal: String(x.senal) } : {}), porque } } satisfies Marcar;
    return;
  }

  if (tipo === 'marcar') {
    claves(['modo', 'curva', 'x', 'y', 'tol', 'inicio', 'rotulo', 'pasos']);
    const g = graficaDe(c.t);
    if (!g) {
      e('«marcar» necesita una gráfica (un widget «grafica» o la gráfica de un circuito)');
      return;
    }
    const modo = x.modo === 'y' ? 'y' : x.modo === 'xy' ? 'xy' : 'x';
    if (!['x', 'y', 'xy'].includes(String(x.modo ?? 'x'))) e('«marcar.modo»: x (sobre una curva), y (una línea horizontal) o xy (un punto libre)');
    const a: Marcar = {
      tipo: 'marcar',
      modo,
      tol: esNumero(x.tol) ? x.tol : 0.03,
      inicio: { x: g.x.min, y: g.y.min },
      rotulo: c.texto(x.rotulo, 'marcar.rotulo', true) ?? [],
      pasos: esNumero(x.pasos) && Number.isInteger(x.pasos) && x.pasos >= 10 && x.pasos <= 1000 ? x.pasos : 120,
    };
    if (x.pasos != null && a.pasos !== x.pasos) e('«marcar.pasos»: un entero de 10 a 1000');
    if (!(a.tol > 0 && a.tol <= 0.2)) e('«marcar.tol»: una fracción del eje entre 0 y 0,2 (0,03 = 3 %)');
    if (modo === 'x') {
      a.curva = esNumero(x.curva) ? x.curva : 0;
      if (!Number.isInteger(a.curva) || a.curva < 0 || a.curva >= g.curvas.length || g.curvas[a.curva]!.param || g.curvas[a.curva]!.palitos) e('«marcar.curva»: el número de una curva de la gráfica (ni paramétrica ni de palitos)');
    } else if (x.curva != null) e('«marcar.curva»: solo con «modo: x»');
    for (const q of ['x', 'y'] as const) {
      const pide = q === 'x' ? modo !== 'y' : modo !== 'x';
      if (pide && x[q] == null) e(`«marcar.${q}»: el objetivo (una expresión del modelo)`);
      else if (!pide && x[q] != null) e(`«marcar.${q}»: con «modo: ${modo}» no se marca en ${q}`);
      else if (pide) {
        c.variables(`marcar.${q}`, x[q]);
        a[q] = String(x[q]);
        const v = c.mc.funcion(a[q]!)(r0);
        const eje = q === 'x' ? g.x : g.y;
        if (!Number.isFinite(v)) e(`«marcar.${q}» no da un número (${v})`);
        else if (fraccionEje(eje, v) < 0 || fraccionEje(eje, v) > 1) e(`«marcar.${q}» (${v}) cae fuera del eje`);
        else out.cifras.push(v);
      }
    }
    if (esObjeto(x.inicio)) {
      if (esNumero(x.inicio.x)) a.inicio.x = x.inicio.x;
      if (esNumero(x.inicio.y)) a.inicio.y = x.inicio.y;
    } else if (x.inicio != null) e('«marcar.inicio»: { x, y }');
    if (fraccionEje(g.x, a.inicio.x) < 0 || fraccionEje(g.x, a.inicio.x) > 1 || fraccionEje(g.y, a.inicio.y) < 0 || fraccionEje(g.y, a.inicio.y) > 1) e('«marcar.inicio» cae fuera de los ejes');
    if (a.x != null || a.y != null) {
      if (marcaBien(c.mc, g, a, r0, a.inicio)) e('«marcar» empieza ya en el objetivo (cambie «inicio»)');
      // reachable from the keyboard (the positions the arrows give)
      const xs = modo === 'y' ? [a.inicio.x] : posicionesMarca(g.x, a.pasos);
      const ys = modo === 'x' ? [a.inicio.y] : posicionesMarca(g.y, a.pasos);
      if (!xs.some((px) => ys.some((py) => marcaBien(c.mc, g, a, r0, { x: px, y: py })))) e('ninguna posición del marcador cae dentro de la tolerancia (suba «pasos» o «tol»)');
    }
    out.actividad = a;
    return;
  }

  // leer
  claves(['objetivo', 'unidad', 'cifras', 'tol', 'rotulo', 'errores', 'medida', 'base']);
  if (!w) e('«leer» necesita un widget del que leer (un circuito con su instrumento o su lectura, una gráfica)');
  // (motor121: in hexadecimal or binary the target may be written as such: «0x3F», «0b0011»)
  if (x.base != null && typeof x.objetivo === 'string' && /^0x[0-9a-f]+$|^0b[01]+$/i.test(x.objetivo.trim())) {
    const t = x.objetivo.trim().toLowerCase();
    x = { ...x, objetivo: String(parseInt(t.slice(2), t[1] === 'x' ? 16 : 2)) };
  }
  c.variables('leer.objetivo', x.objetivo);
  const a: Leer = {
    tipo: 'leer',
    objetivo: String(x.objetivo ?? ''),
    unidad: typeof x.unidad === 'string' ? x.unidad : '',
    cifras: esNumero(x.cifras) ? x.cifras : 3,
    tol: esNumero(x.tol) ? x.tol : 0.02,
    rotulo: c.texto(x.rotulo, 'leer.rotulo', true) ?? [],
    errores: [],
  };
  if (!(a.tol > 0 && a.tol < 1)) e('«leer.tol»: una fracción entre 0 y 1 (0.02 = 2 %)');
  const obj = c.mc.funcion(a.objetivo)(r0);
  if (!Number.isFinite(obj)) e(`«leer.objetivo» no da un número (${obj})`);
  else out.cifras.push(obj);
  if (x.base != null) {
    // motor121: a whole number in hexadecimal or binary, checked exactly; «cifras» is its width in bits
    if (x.base !== 2 && x.base !== 16) e('«leer.base»: 16 (hexadecimal) o 2 (binario)');
    else a.base = x.base;
    if (!(Number.isInteger(obj) && obj >= 0)) e(`«leer.objetivo» en base ${String(x.base)}: un entero no negativo (da ${obj})`);
    const minimo = Math.max(1, Math.ceil(Math.log2(Math.max(obj, 1) + 1)));
    a.cifras = esNumero(x.cifras) ? x.cifras : Math.max(8, Math.ceil(minimo / 4) * 4);
    if (!Number.isInteger(a.cifras) || a.cifras < minimo || a.cifras > 32) e(`«leer.cifras» (los bits): de ${minimo} a 32`);
    if (x.unidad != null || x.tol != null) e('«leer.unidad» y «leer.tol» no van en base 2 o 16: se compara el número exacto');
  }
  if (x.errores != null) {
    if (!Array.isArray(x.errores)) e('«leer.errores»: una lista de { expr | razon, texto }');
    else
      x.errores.forEach((y: unknown, k: number) => {
        const d = `leer.errores ${k + 1}`;
        if (!esObjeto(y)) return e(`«${d}»: { expr | razon, texto }`);
        const et: ErrorTipico = { texto: explicacion(y.texto, `${d}.texto`) ?? [] };
        if (y.expr != null) {
          c.variables(`${d}.expr`, y.expr);
          et.expr = String(y.expr);
          const v = c.mc.funcion(et.expr)(r0);
          if (!Number.isFinite(v)) e(`«${d}.expr» no da un número`);
          // (motor121, autor121-digital: in base 2 or 16 the number is compared exactly — one LSB off is an error)
          else if (a.base ? Math.round(v) === Math.round(obj) || !Number.isInteger(v) : Number.isFinite(obj) && errorRelativo(v, obj) <= a.tol)
            e(a.base ? `«${d}.expr» da ${v}: ${Number.isInteger(v) ? 'es el número bueno' : 'no es un entero'}` : `«${d}.expr» da ${v}, dentro de la tolerancia: no es un error`);
          else out.cifras.push(v);
        } else if (esObjeto(y.razon)) {
          et.razon = {};
          if (esNumero(y.razon.min)) et.razon.min = y.razon.min;
          if (esNumero(y.razon.max)) et.razon.max = y.razon.max;
        } else e(`«${d}»: falta «expr» o «razon»`);
        a.errores.push(et);
      });
  }
  // (motor121: what the reader reads on the instrument, `medida: { entre: [roja, negra] }` or `{ rama }`: checked
  // against the model within the card's tolerance, less half a percent for the display's three figures)
  const wc = w?.tipo === 'circuito' ? w : null;
  if (x.medida != null) {
    const i = wc?.instrumento;
    const m = esObjeto(x.medida) ? x.medida : {};
    if (!wc || !i || i.tipo !== 'multimetro') e('«leer.medida» necesita un circuito con multímetro');
    else if (Array.isArray(m.entre) && m.entre.length === 2) {
      const par = m.entre.map((q) => String(q).toLowerCase()) as [string, string];
      for (const q of par) if (!i.puntos.some((p) => p.id === q)) e(`«leer.medida.entre»: «${q}» no es un punto del instrumento`);
      comprobarLectura(c, wc, { entre: par }, a.objetivo, Math.max(a.tol - 0.005, a.tol / 2), 'leer.medida', false, out);
    } else if (typeof m.rama === 'string') {
      if (!i.ramas.some((b) => b.id === String(m.rama).toLowerCase())) e(`«leer.medida.rama»: «${m.rama}» no es una rama del instrumento`);
      comprobarLectura(c, wc, { rama: String(m.rama).toLowerCase() }, a.objetivo, Math.max(a.tol - 0.005, a.tol / 2), 'leer.medida', false, out);
    } else e('«leer.medida»: { entre: [roja, negra] } o { rama }');
  } else if (wc?.instrumento?.tipo === 'multimetro' && c.esquema && peticionMedida(wc, r0, c.esquema as DefinicionEsquema))
    c.aviso('«leer» sobre un multímetro que lee el simulador: diga con «medida» qué lectura es ({ entre: [roja, negra] } o { rama }) para comprobar que el lector la verá dentro de la tolerancia');
  out.actividad = a;
}

// ------------------------------------------------------------------ the goal of an explore, surprise or tuning card

export interface ContextoObjetivo {
  mc: ModeloCompilado;
  inicial: Valores;
  mandos: Mando[];
  max: number;
  texto(x: unknown, campo: string, obligatorio?: boolean): Texto | undefined;
  rango(x: unknown, donde: string): Rango | null;
  e(m: string): void;
  /** motor121: the card's logic circuit (a goal on its LEDs, signals and counters: digital/objetivo-logico.ts). */
  logica?: CircuitoLogico;
}

/** `objetivo: { condiciones: [...], logrado, pistas? }`: reachable with the card's controls, not reached at the start. */
export function objetivoDe(x: unknown, c: ContextoObjetivo, t: Tarjeta): { objetivo: Objetivo | null; textos: [string, Texto][] } {
  const textos: [string, Texto][] = [];
  const { e } = c;
  if (!esObjeto(x)) {
    e('«objetivo» debe ser { condiciones: [...], logrado, pistas? }');
    return { objetivo: null, textos };
  }
  for (const k of Object.keys(x)) if (!['condiciones', 'logrado', 'pistas'].includes(k)) e(`«objetivo.${k}»: clave desconocida`);
  const condiciones: Condicion[] = [];
  // (motor121: on a logic circuit, a condition may look at a LED, a signal or a counter)
  const rangoDe = (y: unknown, donde: string): Rango | null => {
    if (c.logica && esObjeto(y) && ['led', 'senal', 'contador'].some((q) => y[q] != null)) {
      const r = condicionLogica(y, c.logica);
      if (typeof r === 'string') {
        e(`«${donde}»: ${r}`);
        return null;
      }
      return r;
    }
    return c.rango(y, donde);
  };
  if (!Array.isArray(x.condiciones) || !x.condiciones.length) e('«objetivo.condiciones»: una lista de { valor, objetivo + tol | min / max, rotulo }');
  else
    x.condiciones.forEach((y: unknown, k: number) => {
      const r = rangoDe(y, `objetivo.condicion ${k + 1}`);
      const rot = c.texto(esObjeto(y) ? y.rotulo : undefined, `objetivo.condicion ${k + 1}.rotulo`, true) ?? [];
      if (contarPalabras(rot) > 14) e(`objetivo.condicion ${k + 1}.rotulo: más de 14 palabras`);
      textos.push([`objetivo.condicion ${k + 1}`, rot]);
      if (r) condiciones.push({ ...r, rotulo: rot });
    });
  const logrado = c.texto(x.logrado, 'objetivo.logrado', true) ?? [];
  if (contarPalabras(logrado) > MAX_PALABRAS) e(`«objetivo.logrado»: más de ${MAX_PALABRAS} palabras`);
  textos.push(['objetivo.logrado', logrado]);
  const pistas: Pista[] = [];
  if (x.pistas != null) {
    if (!Array.isArray(x.pistas)) e('«objetivo.pistas»: una lista de { cuando?, texto }');
    else
      x.pistas.forEach((y: unknown, k: number) => {
        const p: Pista = { texto: c.texto(esObjeto(y) ? y.texto : y, `objetivo.pista ${k + 1}`, true) ?? [] };
        if (esObjeto(y) && y.cuando != null) {
          const r = rangoDe(y.cuando, `objetivo.pista ${k + 1}.cuando`);
          if (r) p.cuando = r;
        }
        if (contarPalabras(p.texto) > MAX_PALABRAS) e(`objetivo.pista ${k + 1}: más de ${MAX_PALABRAS} palabras`);
        textos.push([`objetivo.pista ${k + 1}`, p.texto]);
        pistas.push(p);
      });
  }
  const o: Objetivo = { condiciones, logrado, pistas };
  if (condiciones.length && c.logica) {
    // a logic circuit: reachable from power-on with the switches and the clock, not reached at power-on
    const b = buscarObjetivo(c.logica, condiciones);
    if (b.inicial) e('el objetivo se cumple ya al encender el circuito (cambie el valor inicial de una entrada)');
    else if (!b.camino) e(`el objetivo no se alcanza con las entradas y el reloj (${b.estados} estados del circuito probados)`);
  } else if (condiciones.length && c.mandos.length) {
    const total = c.mandos.reduce((a, m) => a * m.valores.length, 1);
    if (total > c.max) e(`el objetivo tiene ${total} posiciones (máximo ${c.max})`);
    else {
      let soluciones = 0;
      const pos = c.mandos.map(() => 0);
      for (let n = 0; n < total; n++) {
        const v: Valores = { ...c.inicial };
        c.mandos.forEach((m, k) => (v[m.valor] = m.valores[pos[k]!]!));
        if (condiciones.every((q) => enRango(q, c.mc.evaluar(v)))) soluciones++;
        for (let k = 0; k < pos.length; k++) {
          pos[k]!++;
          if (pos[k]! < c.mandos[k]!.valores.length) break;
          pos[k] = 0;
        }
      }
      if (!soluciones) e('el objetivo no se alcanza con los mandos de la tarjeta');
      if (objetivoCumplido({ ...t, objetivo: o }, c.mc.evaluar(c.inicial))) e('el objetivo se cumple ya al empezar (ponga «inicio»)');
    }
  } else if (condiciones.length) e('un «objetivo» necesita mandos en el widget');
  return { objetivo: o, textos };
}

// ------------------------------------------------------------------ the mix of a lesson (GUIA §13.6)

/** The step types and card kinds answered by doing (with the hands, on the widget). */
export const TIPOS_HACIENDO = new Set(['medir', 'elegir', 'marcar', 'leer', 'tocar', 'simular', 'ajuste', 'reto', 'dibujar', 'averia', 'diseno', 'banco', 'tabla', 'sql']);

export type ClaseTarjeta = 'hacer' | 'elegir' | 'mirar';

/** doing; answering by choice (options, an estimate's slider, an order, pairs); or looking (explore, formula, surprise). */
export function claseTarjeta(t: Pick<Tarjeta, 'tipo' | 'objetivo' | 'opciones' | 'estimar' | 'ordenar' | 'emparejar'>): ClaseTarjeta {
  if (TIPOS_HACIENDO.has(t.tipo) || ((t.tipo === 'explorar' || t.tipo === 'sorpresa') && t.objetivo)) return 'hacer';
  if (t.opciones || t.estimar || t.ordenar || t.emparejar) return 'elegir';
  return 'mirar';
}

export interface Mezcla {
  hacer: number;
  elegir: number;
  mirar: number;
  /** Cards that are not the summary. */
  total: number;
  /** Multiple-choice cards (options). */
  opciones: number;
}

export function mezclaDe(tarjetas: readonly Tarjeta[]): Mezcla {
  const m: Mezcla = { hacer: 0, elegir: 0, mirar: 0, total: 0, opciones: 0 };
  for (const t of tarjetas) {
    if (t.tipo === 'resumen') continue;
    m.total++;
    m[claseTarjeta(t)]++;
    if (t.opciones) m.opciones++;
  }
  return m;
}

/** The warning of a lesson whose doing cards are fewer than half of its cards (null when they are not). */
export function avisoMezcla(m: Mezcla): string | null {
  if (!m.total || m.hacer / m.total >= 0.5) return null;
  return `aprender haciendo: ${m.hacer} de ${m.total} tarjetas se responden haciendo (${Math.round((m.hacer / m.total) * 100)} %; el mínimo es la mitad), ${m.elegir} eligiendo y ${m.mirar} mirando`;
}

