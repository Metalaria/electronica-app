// 1.2.1 (piloto121) in the generator: the instrument of a circuit widget, the steps answered by doing («medir»,
// «elegir», «marcar», «leer»), the goal («objetivo») of an explore, surprise or tuning card, and the lesson's mix of
// cards (doing against answering by choice; GUIA §13). lib/leccion11/generar.ts and lib/leccion12/generar12.ts call
// these. Pure.

import { contarPalabras } from '../../leccion11/texto';
import { enRango, type ModeloCompilado, type Valores } from '../../leccion11/modelo';
import { fraccionEje } from '../../leccion11/ejes';
import { esLineal, resolverCC } from '../cc';
import { contextoNetlist } from '../../leccion11/spice';
import type { DefinicionEsquema } from '../../leccion11/esquemas/tipos';
import type { Condicion, Mando, Pista, Rango, Tarjeta, Texto, WidgetCircuito } from '../../leccion11/tipos';
import type { ErrorTipico } from '../tipos';
import { errorRelativo } from '../prediccion';
import type { Contexto12, Resultado12 } from '../generar12';
import { graficaDe, marcaBien, objetivoCumplido, posicionesMarca } from './motor-hacer';
import type { Elegir, Instrumento, Leer, Marcar, Medir, Objetivo } from './tipos';

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

/** `widget.instrumento` of a circuit: its shape (checked against the netlist later, card by card: validarInstrumento). */
export function instrumentoDe(x: unknown, e: (m: string) => void, texto: (x: unknown, campo: string, obligatorio?: boolean) => Texto | undefined, curvas: number): Instrumento | null {
  if (!esObjeto(x)) {
    e('«widget.instrumento» debe ser { tipo: multimetro | osciloscopio, puntos, ramas? }');
    return null;
  }
  for (const k of Object.keys(x)) if (!['tipo', 'modos', 'puntos', 'ramas', 'curvas', 'negra'].includes(k)) e(`«widget.instrumento.${k}»: clave desconocida`);
  const tipo = x.tipo === 'osciloscopio' ? 'osciloscopio' : 'multimetro';
  if (x.tipo !== 'multimetro' && x.tipo !== 'osciloscopio') e('«widget.instrumento.tipo»: multimetro u osciloscopio');
  const lista = (o: unknown, campo: string) => {
    const out: { id: string; rotulo: Texto }[] = [];
    if (o == null) return out;
    if (!esObjeto(o)) {
      e(`«widget.instrumento.${campo}»: { id: «nombre neutro» }`);
      return out;
    }
    for (const [id, r] of Object.entries(o)) {
      const rot = texto(r, `widget.instrumento.${campo}.${id}`, true) ?? [];
      if (contarPalabras(rot) > MAX_ROTULO) e(`«widget.instrumento.${campo}.${id}»: más de ${MAX_ROTULO} palabras`);
      out.push({ id: id.toLowerCase(), rotulo: rot });
    }
    return out;
  };
  const puntos = lista(x.puntos, 'puntos');
  const ramas = lista(x.ramas, 'ramas');
  const i: Instrumento = { tipo, modos: [], puntos, ramas };
  if (tipo === 'osciloscopio') {
    if (ramas.length) e('«widget.instrumento.ramas»: el osciloscopio no mide corrientes');
    i.modos = ['V'];
    if (!esObjeto(x.curvas)) e('«widget.instrumento.curvas»: qué curva de la gráfica enseña cada punto ({ salida: 0 })');
    else {
      i.curvas = {};
      for (const [k, v] of Object.entries(x.curvas)) {
        if (!puntos.some((p) => p.id === k.toLowerCase())) e(`«widget.instrumento.curvas.${k}»: no es uno de los puntos`);
        if (!(typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < curvas)) e(`«widget.instrumento.curvas.${k}»: el número de una curva de la gráfica (0 a ${curvas - 1})`);
        else i.curvas[k.toLowerCase()] = v;
      }
      for (const p of puntos) if (!(p.id in i.curvas)) e(`«widget.instrumento.curvas»: falta la curva del punto «${p.id}»`);
    }
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
 * The instrument against the schematic's netlist in each state the generator checks: a linear DC circuit (the page
 * solves it: lib/leccion12/cc.ts), every point a node of it, every branch one of its 0 V meters. Returns the readings
 * the instrument can show (for the numbers rule).
 */
export function validarInstrumento(def: DefinicionEsquema, w: WidgetCircuito, mc: ModeloCompilado, estados: readonly Valores[], e: (m: string) => void): number[] {
  const i = w.instrumento!;
  const cifras: number[] = [];
  let dicho = false;
  for (const st of estados) {
    const r = mc.evaluar(st);
    let lineas: string[];
    try {
      lineas = def.netlist(contextoNetlist(w, r), 'op');
    } catch (err) {
      e(`«widget.instrumento»: el esquema no da su netlist (${err instanceof Error ? err.message : String(err)})`);
      return cifras;
    }
    const { nodos, medidores } = partesNetlist(lineas);
    if (!dicho) {
      for (const p of i.puntos) if (!nodos.has(p.id)) e(`«widget.instrumento.puntos.${p.id}»: no es un nodo del esquema ${def.nombre} (${[...nodos].sort().join(', ')})`);
      for (const b of i.ramas) if (!medidores.has(b.id)) e(`«widget.instrumento.ramas.${b.id}»: no es un medidor de 0 V del esquema ${def.nombre} (${[...medidores].sort().join(', ') || 'ninguno'})`);
      dicho = true;
    }
    if (i.tipo === 'osciloscopio') continue;
    if (!esLineal(lineas)) {
      e('«widget.instrumento»: el multímetro lee el punto de trabajo en continua de un circuito lineal; este esquema no lo es');
      return cifras;
    }
    const s = resolverCC(lineas);
    if (!s) {
      e('«widget.instrumento»: el punto de trabajo del circuito no tiene solución');
      return cifras;
    }
    for (const b of i.ramas) if (s.corrientes[b.id] != null) cifras.push(s.corrientes[b.id]!, Math.abs(s.corrientes[b.id]!));
    for (const a of i.puntos) for (const b of i.puntos) if (a.id !== b.id && s.nodos[a.id] != null && s.nodos[b.id] != null) cifras.push(s.nodos[a.id]! - s.nodos[b.id]!);
  }
  return cifras;
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
      else a.entre = [punto(x.entre[0], 'medir.entre'), punto(x.entre[1], 'medir.entre')];
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
    if (x.valor != null) {
      // the right reading is what the model says (the page's DC solution of the netlist against the author's model)
      c.variables('medir.valor', x.valor);
      const esperado = c.mc.funcion(String(x.valor))(r0);
      const lineas = (() => {
        try {
          return (c.esquema as DefinicionEsquema).netlist(contextoNetlist(wc, r0), 'op');
        } catch {
          return [];
        }
      })();
      const s = resolverCC(lineas);
      const leida = !s ? NaN : magnitud === 'corriente' ? (s.corrientes[a.rama ?? ''] ?? NaN) : magnitud === 'tension' && a.entre ? (s.nodos[a.entre[0]] ?? NaN) - (s.nodos[a.entre[1]] ?? NaN) : NaN;
      if (magnitud === 'senal') e('«medir.valor»: solo en una medida del multímetro');
      else if (!Number.isFinite(leida)) e('«medir.valor»: el circuito no da esa medida');
      else if (Math.abs(leida - esperado) > 1e-3 * Math.abs(esperado) + 1e-9) e(`«medir.valor»: el multímetro marcaría ${leida} y el modelo da ${esperado}`);
      else out.cifras.push(esperado);
    }
    out.actividad = a;
    return;
  }

  if (tipo === 'elegir') {
    claves(['zonas', 'bien', 'todas', 'porque']);
    const wc = w?.tipo === 'circuito' ? w : null;
    if (!wc) {
      e('«elegir» necesita un widget «circuito» (lo que se toca es el esquema)');
      return;
    }
    const def = c.esquema as DefinicionEsquema;
    const zonas: Elegir['zonas'] = [];
    if (!esObjeto(x.zonas) || Object.keys(x.zonas).length < 2 || Object.keys(x.zonas).length > 12) e('«elegir.zonas»: de 2 a 12 { pieza o red:nodo: «nombre neutro» }');
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
        const rot = c.texto(rv, `elegir.zonas.${id}`, true) ?? [];
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
  claves(['objetivo', 'unidad', 'cifras', 'tol', 'rotulo', 'errores']);
  if (!w) e('«leer» necesita un widget del que leer (un circuito con su instrumento o su lectura, una gráfica)');
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
          else if (Number.isFinite(obj) && errorRelativo(v, obj) <= a.tol) e(`«${d}.expr» da ${v}, dentro de la tolerancia: no es un error`);
          else out.cifras.push(v);
        } else if (esObjeto(y.razon)) {
          et.razon = {};
          if (esNumero(y.razon.min)) et.razon.min = y.razon.min;
          if (esNumero(y.razon.max)) et.razon.max = y.razon.max;
        } else e(`«${d}»: falta «expr» o «razon»`);
        a.errores.push(et);
      });
  }
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
  if (!Array.isArray(x.condiciones) || !x.condiciones.length) e('«objetivo.condiciones»: una lista de { valor, objetivo + tol | min / max, rotulo }');
  else
    x.condiciones.forEach((y: unknown, k: number) => {
      const r = c.rango(y, `objetivo.condicion ${k + 1}`);
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
          const r = c.rango(y.cuando, `objetivo.pista ${k + 1}.cuando`);
          if (r) p.cuando = r;
        }
        if (contarPalabras(p.texto) > MAX_PALABRAS) e(`objetivo.pista ${k + 1}: más de ${MAX_PALABRAS} palabras`);
        textos.push([`objetivo.pista ${k + 1}`, p.texto]);
        pistas.push(p);
      });
  }
  const o: Objetivo = { condiciones, logrado, pistas };
  if (condiciones.length && c.mandos.length) {
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

