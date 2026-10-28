// Electrical rule check of a generated netlist, before simulating, explained in plain Spanish: nodes without a
// DC path to ground, voltage sources (and inductors, which are short circuits in DC) forming loops, current
// sources open or in series, op-amp, bridge and logic inputs left floating, and parts with every terminal on
// the same node. It reads the netlist text itself (the drawn parts, the lines of the directives and the
// library subcircuits it knows), so it sees what ngspice will see. Plain TypeScript.
//
// Also: the help shown when ngspice does not converge (what usually causes it, and the fixes the editor can
// apply to a copy of the circuit).

import { lineasNetlist } from '../../simulador/motor/netlist.ts';
import type { Netlist } from './netlist.ts';
import type { DocumentoEsquema } from './tipos.ts';

export interface Problema {
  nivel: 'error' | 'aviso';
  /** 1 DC path, 2 voltage-source loop, 3 current source, 4 floating input, 5 shorted part. */
  regla: 1 | 2 | 3 | 4 | 5;
  titulo: string;
  texto: string;
  /** Parts concerned (to select them). */
  ids: string[];
}

/**
 * How a terminal of an element behaves in DC: «conduce» joins it to the element's other conducting terminals,
 * «fuerza» is a driven output (an op-amp's, a DAC bridge's: a DC path to ground of its own), «entrada» draws no
 * current, «corriente» belongs to a current source.
 */
type Clase = 'conduce' | 'fuerza' | 'entrada' | 'corriente' | 'digital' | 'desconocido';

interface Terminal {
  nodo: string;
  clase: Clase;
  /** Name for the messages («entrada +»). */
  rotulo?: string;
}

interface Elemento {
  nombre: string;
  letra: string;
  linea: number;
  terminales: Terminal[];
  /** Pairs of terminal indices that form a voltage-source branch (V, E, H, B V=, L). */
  fuenteV?: [number, number];
  /** Current source branch (I, G, F, B I=). */
  fuenteI?: [number, number];
  /** XSPICE code model (A lines). */
  modelo?: string;
}

const ESCAPE = (s: string) => s.toLowerCase();

/** Pins of the library subcircuits: [class, label] in port order. */
const SUBCIRCUITOS: Record<string, [Clase, string][]> = {
  opamp: [
    ['entrada', 'entrada +'],
    ['entrada', 'entrada −'],
    ['fuerza', 'salida'],
  ],
  op741: [
    ['entrada', 'entrada +'],
    ['entrada', 'entrada −'],
    ['fuerza', 'salida'],
  ],
  opa5: [
    ['entrada', 'entrada +'],
    ['entrada', 'entrada −'],
    ['fuerza', 'salida'],
    ['entrada', 'alimentación +'],
    ['entrada', 'alimentación −'],
  ],
  ne555: [
    ['conduce', 'masa'],
    ['entrada', 'disparo'],
    ['conduce', 'salida'],
    ['entrada', 'reset'],
    ['conduce', 'control'],
    ['entrada', 'umbral'],
    ['conduce', 'descarga'],
    ['conduce', 'Vcc'],
  ],
  epa_lampara: [
    ['conduce', '1'],
    ['conduce', '2'],
  ],
  epa_zumbador: [
    ['conduce', '+'],
    ['conduce', '−'],
  ],
  epa_altavoz: [
    ['conduce', '1'],
    ['conduce', '2'],
  ],
  epa_motor: [
    ['conduce', '+'],
    ['conduce', '−'],
  ],
  // The crystal blocks DC (its motional branch has a series capacitor).
  epa_cristal: [
    ['entrada', '1'],
    ['entrada', '2'],
  ],
};
for (const r of ['rele5', 'rele12', 'rele24'])
  SUBCIRCUITOS[r] = [
    ['conduce', 'bobina 1'],
    ['conduce', 'bobina 2'],
    ['conduce', 'común'],
    ['conduce', 'contacto NC'],
    ['conduce', 'contacto NA'],
  ];
/** Op-amp subcircuits: their inputs are checked by rule 4. */
const OPERACIONALES = new Set(['opamp', 'op741', 'opa5']);

/** XSPICE code models by kind of node: «d» digital, «a» analog input, «s» analog output. */
function nodosXspice(modelo: string, n: number): ('d' | 'a' | 's')[] {
  const m = modelo.toLowerCase();
  if (m === 'adc_bridge') return Array.from({ length: n }, (_, i) => (i < n / 2 ? 'a' : 'd'));
  if (m === 'dac_bridge') return Array.from({ length: n }, (_, i) => (i < n / 2 ? 'd' : 's'));
  if (m === 'd_osc') return Array.from({ length: n }, (_, i) => (i === 0 ? 'a' : 'd'));
  if (m.startsWith('d_')) return Array.from({ length: n }, () => 'd');
  return [];
}

function partirLinea(texto: string): string[] {
  // «[a b]» groups of XSPICE become plain tokens; parentheses glued to a value stay with it.
  return texto
    .replace(/\n\s*\+/g, ' ')
    .replace(/\[/g, ' [ ')
    .replace(/\]/g, ' ] ')
    .trim()
    .split(/\s+/);
}

/** The elements of a netlist (top level only). */
function elementos(texto: string): { elems: Elemento[]; modelosXspice: Map<string, string>; subckts: Set<string>; rshunt: boolean; necesitaOp: boolean } {
  const { lineas, subckts } = lineasNetlist(texto);
  const modelosXspice = new Map<string, string>();
  let rshunt = false;
  // Does an analysis need a DC operating point that must be right (.op, .dc, a transient without UIC)? AC,
  // noise… compute one too, but ngspice carries on with a warning when it fails and the small-signal result of a
  // linear circuit is still good.
  let necesitaOp = false;
  for (const linea of texto.split('\n')) {
    const t = linea.trim().toLowerCase().replace(/^\./, '');
    if (/^(op|dc)\b/.test(t)) necesitaOp = true;
    if (/^tran\b/.test(t) && !/\buic\b/.test(t)) necesitaOp = true;
  }
  for (const l of lineas) {
    const t0 = l.tokens[0]?.toLowerCase() ?? '';
    if (t0 === '.model' && l.tokens[2]) modelosXspice.set(ESCAPE(l.tokens[1]!), l.tokens[2]!.replace(/\(.*$/, '').toLowerCase());
    if (t0 === '.options' || t0 === '.option') if (/\brshunt\s*=/i.test(l.texto)) rshunt = true;
  }
  const definidos = new Set(subckts.map((s) => (s.tokens[1] ?? '').toLowerCase()));
  const elems: Elemento[] = [];
  for (const l of lineas) {
    if (l.subckt || !l.tokens.length || l.tokens[0]!.startsWith('.')) continue;
    const tk = partirLinea(l.texto);
    const nombre = tk[0]!;
    const letra = nombre[0]!.toUpperCase();
    const n = (k: number) => (tk[k] ?? '').toLowerCase().replace(/^gnd$/, '0');
    const t = (nodo: string, clase: Clase, rotulo?: string): Terminal => ({ nodo, clase, ...(rotulo ? { rotulo } : {}) });
    const e: Elemento = { nombre, letra, linea: l.linea, terminales: [] };
    switch (letra) {
      case 'R':
      case 'D':
      case 'W':
        e.terminales = [t(n(1), 'conduce'), t(n(2), 'conduce')];
        break;
      case 'C':
        e.terminales = [t(n(1), 'entrada'), t(n(2), 'entrada')];
        break;
      case 'L':
      case 'V':
      case 'H':
        e.terminales = [t(n(1), 'conduce'), t(n(2), 'conduce')];
        e.fuenteV = [0, 1];
        break;
      case 'I':
      case 'F':
        e.terminales = [t(n(1), 'corriente'), t(n(2), 'corriente')];
        e.fuenteI = [0, 1];
        break;
      case 'E':
      case 'G': {
        const cuatro = tk[3] && tk[4] && !/[=({]/.test(tk[3]) && !/^(value|poly|table|laplace|freq|vol|cur)/i.test(tk[3]);
        if (letra === 'E') {
          e.terminales = [t(n(1), 'conduce'), t(n(2), 'conduce')];
          e.fuenteV = [0, 1];
        } else {
          e.terminales = [t(n(1), 'corriente'), t(n(2), 'corriente')];
          e.fuenteI = [0, 1];
        }
        if (cuatro) e.terminales.push(t(n(3), 'entrada'), t(n(4), 'entrada'));
        break;
      }
      case 'B': {
        const resto = tk.slice(3).join(' ');
        if (/^\s*i\s*=/i.test(resto)) {
          e.terminales = [t(n(1), 'corriente'), t(n(2), 'corriente')];
          e.fuenteI = [0, 1];
        } else {
          e.terminales = [t(n(1), 'conduce'), t(n(2), 'conduce')];
          e.fuenteV = [0, 1];
        }
        break;
      }
      case 'Q':
      case 'J':
      case 'Z':
        e.terminales = [t(n(1), 'conduce'), t(n(2), 'conduce'), t(n(3), 'conduce')];
        break;
      case 'M':
        e.terminales = [t(n(1), 'conduce'), t(n(2), 'entrada', 'puerta'), t(n(3), 'conduce'), t(n(4), 'conduce')];
        break;
      case 'S':
        e.terminales = [t(n(1), 'conduce'), t(n(2), 'conduce'), t(n(3), 'entrada'), t(n(4), 'entrada')];
        break;
      case 'T':
      case 'O':
        e.terminales = [1, 2, 3, 4].map((k) => t(n(k), 'conduce'));
        break;
      case 'U':
        e.terminales = [1, 2, 3].map((k) => t(n(k), 'conduce'));
        break;
      case 'K':
        break;
      case 'X': {
        const sin = tk.slice(1).filter((x) => !x.includes('=') && !/^params:$/i.test(x));
        const sub = (sin[sin.length - 1] ?? '').toLowerCase();
        const nodos = sin.slice(0, -1).map((x) => x.toLowerCase().replace(/^gnd$/, '0'));
        const conocido = definidos.has(sub) && !SUBCIRCUITOS[sub] ? null : SUBCIRCUITOS[sub];
        if (conocido && conocido.length === nodos.length) e.terminales = nodos.map((x, i) => t(x, conocido[i]![0], conocido[i]![1]));
        else e.terminales = nodos.map((x) => t(x, 'desconocido'));
        if (OPERACIONALES.has(sub)) e.letra = 'OA';
        break;
      }
      case 'A': {
        // A1 [a b] y mod | A1 a y mod | A1 [in] [out] mod
        const nodos: string[] = [];
        for (const x of tk.slice(1, -1)) if (x !== '[' && x !== ']' && x.toUpperCase() !== 'NULL' && !x.startsWith('%')) nodos.push(x.toLowerCase());
        const modelo = modelosXspice.get((tk[tk.length - 1] ?? '').toLowerCase()) ?? '';
        const tipos = nodosXspice(modelo, nodos.length);
        e.terminales = nodos.map((x, i) =>
          t(x, tipos[i] === 'd' ? 'digital' : tipos[i] === 'a' ? 'entrada' : tipos[i] === 's' ? 'fuerza' : 'desconocido', tipos[i] === 'a' ? 'entrada' : undefined),
        );
        if (/^d_(and|or|nand|nor|xor|xnor|inverter|buffer|dff|jkff|tff|srff)$/.test(modelo)) e.letra = 'AD';
        e.modelo = modelo;
        break;
      }
      default:
        // An element the check does not know: its nodes are left alone.
        e.terminales = tk.slice(1, 3).map((x) => t(x.toLowerCase(), 'desconocido'));
    }
    elems.push(e);
  }
  return { elems, modelosXspice, subckts: definidos, rshunt, necesitaOp };
}

class Uniones {
  private p = new Map<string, string>();
  raiz(a: string): string {
    let r = this.p.get(a) ?? a;
    if (r === a) {
      this.p.set(a, a);
      return a;
    }
    r = this.raiz(r);
    this.p.set(a, r);
    return r;
  }
  unir(a: string, b: string): boolean {
    const ra = this.raiz(a);
    const rb = this.raiz(b);
    if (ra === rb) return false;
    this.p.set(ra, rb);
    return true;
  }
}

function lista(nombres: string[]): string {
  const u = [...new Set(nombres)];
  if (u.length <= 1) return u[0] ?? '';
  return `${u.slice(0, -1).join(', ')} y ${u[u.length - 1]}`;
}

/**
 * The rule check of a netlist. `nl` maps lines to parts (to select them); `doc` says which analyses run (a
 * transient with UIC alone does not need a DC operating point).
 */
export function revisarCircuito(nl: Pick<Netlist, 'texto' | 'lineaDe'>, doc?: DocumentoEsquema): Problema[] {
  const { elems, rshunt, necesitaOp } = elementos(nl.texto);
  const nivelDC: Problema['nivel'] = necesitaOp ? 'error' : 'aviso';
  const res: Problema[] = [];
  const idsLinea = (e: Elemento) => {
    const id = nl.lineaDe.get(e.linea);
    return id ? [id] : [];
  };
  const nombreParte = (e: Elemento) => {
    const id = nl.lineaDe.get(e.linea);
    const c = id ? doc?.componentes.find((x) => x.id === id) : undefined;
    return c?.nombre || e.nombre;
  };

  // Nodes: terminals on each, digital nets aside.
  const enNodo = new Map<string, { e: Elemento; i: number }[]>();
  const digitales = new Set<string>();
  const desconocidos = new Set<string>();
  for (const e of elems)
    e.terminales.forEach((t, i) => {
      if (!t.nodo) return;
      (enNodo.get(t.nodo) ?? enNodo.set(t.nodo, []).get(t.nodo)!).push({ e, i });
      if (t.clase === 'digital') digitales.add(t.nodo);
      if (t.clase === 'desconocido') desconocidos.add(t.nodo);
    });
  const analogico = (n: string) => !digitales.has(n);
  if (!enNodo.has('0')) return res; // no ground: netlist.ts already says so

  // ---------------------------------------------------------------- rule 2: loops of voltage sources
  const uv = new Uniones();
  const ady = new Map<string, { a: string; e: Elemento }[]>();
  const camino = (a: string, b: string): Elemento[] => {
    // BFS in the forest of voltage branches already added.
    const prev = new Map<string, { de: string; e: Elemento } | null>([[a, null]]);
    const cola = [a];
    while (cola.length) {
      const x = cola.shift()!;
      if (x === b) break;
      for (const y of ady.get(x) ?? []) {
        if (prev.has(y.a)) continue;
        prev.set(y.a, { de: x, e: y.e });
        cola.push(y.a);
      }
    }
    const r: Elemento[] = [];
    for (let x = b; prev.get(x); x = prev.get(x)!.de) r.push(prev.get(x)!.e);
    return r;
  };
  const enLazo = new Set<Elemento>();
  for (const e of elems) {
    if (!e.fuenteV) continue;
    const a = e.terminales[e.fuenteV[0]]!.nodo;
    const b = e.terminales[e.fuenteV[1]]!.nodo;
    if (!a || !b || !analogico(a) || !analogico(b)) continue;
    if (a === b) {
      enLazo.add(e);
      const bobina = e.letra === 'L';
      res.push({
        nivel: bobina ? 'aviso' : 'error',
        regla: 2,
        titulo: bobina ? `${nombreParte(e)} está en cortocircuito` : `La fuente ${nombreParte(e)} está en cortocircuito`,
        texto: bobina
          ? `Los dos terminales de ${nombreParte(e)} están en el mismo nodo «${a}»: la bobina no hace nada. Revise los cables.`
          : `Los dos terminales de ${nombreParte(e)} están unidos (nodo «${a}»): una fuente de tensión ideal en cortocircuito daría una corriente infinita y ngspice no puede resolverlo. Quite el cable que la cortocircuita o ponga una resistencia en serie.`,
        ids: idsLinea(e),
      });
      continue;
    }
    if (!uv.unir(a, b)) {
      const lazo = [e, ...camino(a, b)].sort((x, y) => x.linea - y.linea);
      for (const x of lazo) enLazo.add(x);
      const nombres = lazo.map(nombreParte);
      const hayBobina = lazo.some((x) => x.letra === 'L');
      res.push({
        // With a coil, ngspice usually gets through (it warns of a singular matrix): a source whose DC value is
        // 0 V, such as a sine without offset driving a transformer, is consistent with the coil's 0 V.
        nivel: hayBobina ? 'aviso' : nivelDC,
        regla: 2,
        titulo: lazo.length === 2 && !hayBobina ? `Fuentes de tensión en paralelo: ${lista(nombres)}` : `Lazo de fuentes de tensión${hayBobina ? ' y bobinas' : ''}: ${lista(nombres)}`,
        texto:
          `${lista(nombres)} forman un lazo cerrado sin ninguna resistencia` +
          (hayBobina ? ' (en continua una bobina es un cortocircuito, como una fuente de 0 V)' : '') +
          ': cada fuente impone su tensión y la corriente que circula por el lazo queda indeterminada (o es infinita si las tensiones no coinciden), así que ngspice no puede resolver bien el punto de trabajo' +
          (hayBobina
            ? '. Si la fuente vale 0 V en continua (una senoidal sin nivel medio que alimenta un transformador) ngspice avisa y suele seguir; si no, ponga una resistencia pequeña en serie (la del devanado).'
            : `${necesitaOp ? '' : ' (en alterna lo intenta, avisa y sigue)'}. Ponga una resistencia pequeña en serie con una de ellas o quite una.`),
        ids: lazo.flatMap(idsLinea),
      });
    } else {
      (ady.get(a) ?? ady.set(a, []).get(a)!).push({ a: b, e });
      (ady.get(b) ?? ady.set(b, []).get(b)!).push({ a, e });
    }
  }

  // ---------------------------------------------------------------- rule 3: current sources open or in series
  const nodosI = new Set<string>();
  for (const [nodo, ts] of enNodo) {
    if (nodo === '0' || !analogico(nodo) || desconocidos.has(nodo)) continue;
    if (!ts.every((x) => x.e.terminales[x.i]!.clase === 'corriente')) continue;
    const fuentes = [...new Set(ts.map((x) => x.e))];
    nodosI.add(nodo);
    const nombres = fuentes.map(nombreParte);
    if (fuentes.length === 1)
      res.push({
        nivel: 'error',
        regla: 3,
        titulo: `La fuente de corriente ${nombres[0]} está en circuito abierto`,
        texto: `En el nodo «${nodo}» no hay nada más que ${nombres[0]}: su corriente no tiene por dónde volver. Una fuente de corriente ideal necesita un camino cerrado; conecte la carga o una resistencia entre ese nodo y el circuito.`,
        ids: fuentes.flatMap(idsLinea),
      });
    else
      res.push({
        nivel: 'error',
        regla: 3,
        titulo: `Fuentes de corriente en serie: ${lista(nombres)}`,
        texto: `Por el nodo «${nodo}» solo pasan ${lista(nombres)}. Si sus corrientes no son iguales, no se cumple la ley de Kirchhoff; si lo son, la tensión del nodo queda sin determinar. Ponga una resistencia en paralelo con una de ellas o quite una.`,
        ids: fuentes.flatMap(idsLinea),
      });
  }

  // ---------------------------------------------------------------- rule 4: floating inputs
  const entradasAvisadas = new Set<string>();
  for (const e of elems) {
    if (e.letra !== 'OA' && e.letra !== 'AD' && !(e.letra === 'A' && e.terminales.some((t) => t.clase === 'entrada'))) continue;
    e.terminales.forEach((t, i) => {
      if (!t.nodo) return;
      const esEntrada = e.letra === 'OA' ? t.clase === 'entrada' && /entrada/.test(t.rotulo ?? '') : e.letra === 'AD' ? i < e.terminales.length - (/ff$/.test(e.modelo ?? '') ? 2 : 1) : t.clase === 'entrada';
      if (!esEntrada) return;
      const otros = (enNodo.get(t.nodo) ?? []).filter((x) => !(x.e === e && x.i === i));
      if (otros.length) return;
      entradasAvisadas.add(t.nodo);
      const digital = t.clase === 'digital';
      res.push({
        nivel: 'error',
        regla: 4,
        titulo: `${digital ? 'Una entrada' : `La ${t.rotulo ?? 'entrada'}`} de ${nombreParte(e)} está al aire`,
        texto: digital
          ? `Una entrada de ${nombreParte(e)} (nodo «${t.nodo}») no está unida a nada: en lógica una entrada al aire no tiene ningún valor. Únala a la salida que debe gobernarla o a un nivel fijo.`
          : `La ${t.rotulo ?? 'entrada'} de ${nombreParte(e)} (nodo «${t.nodo}») no está conectada a nada. Una entrada de alta impedancia no consume corriente, así que su tensión no está definida y ngspice no puede calcularla. Conéctela a la señal o a masa con una resistencia.`,
        ids: idsLinea(e),
      });
    });
  }

  // ---------------------------------------------------------------- rule 1: DC path to ground
  const uc = new Uniones();
  const nodos = [...enNodo.keys()].filter(analogico);
  for (const n of nodos) uc.raiz(n);
  for (const e of elems) {
    const c = e.terminales.filter((t) => t.nodo && analogico(t.nodo) && (t.clase === 'conduce' || t.clase === 'desconocido')).map((t) => t.nodo);
    for (let i = 1; i < c.length; i++) uc.unir(c[0]!, c[i]!);
    for (const t of e.terminales) if (t.clase === 'fuerza' && t.nodo && analogico(t.nodo)) uc.unir(t.nodo, '0');
  }
  const masa = uc.raiz('0');
  const grupos = new Map<string, string[]>();
  for (const n of nodos) {
    const r = uc.raiz(n);
    if (r === masa) continue;
    (grupos.get(r) ?? grupos.set(r, []).get(r)!).push(n);
  }
  const soloUic = !necesitaOp && /^\s*\.?tran\b.*\buic\b/im.test(nl.texto);
  if (!rshunt)
    for (const g of grupos.values()) {
      if (g.some((n) => desconocidos.has(n))) continue;
      if (g.every((n) => nodosI.has(n) || entradasAvisadas.has(n))) continue;
      const partes = new Set<Elemento>();
      for (const n of g) for (const x of enNodo.get(n) ?? []) partes.add(x.e);
      const entradas = [...partes].flatMap((e) => e.terminales.filter((t) => g.includes(t.nodo) && t.rotulo && t.clase === 'entrada').map((t) => `la ${t.rotulo} de ${nombreParte(e)}`));
      res.push({
        nivel: nivelDC,
        regla: 1,
        titulo: g.length === 1 ? `El nodo «${g[0]}» no tiene camino de continua hasta masa` : `Los nodos ${lista(g.map((n) => `«${n}»`))} no tienen camino de continua hasta masa`,
        texto:
          `Entre ${g.length === 1 ? 'ese nodo' : 'esos nodos'} y la masa solo hay condensadores, fuentes de corriente o entradas que no consumen corriente` +
          (entradas.length ? ` (${lista(entradas)})` : '') +
          `, así que en continua ${g.length === 1 ? 'queda flotando' : 'quedan flotando'}: ngspice no puede calcular su tensión (matriz singular). Añada una resistencia grande a masa (por ejemplo 10 MΩ) o una resistencia que lo una al resto del circuito.` +
          (soloUic
            ? ' Con un transitorio con condiciones iniciales (UIC) y nada más se puede simular: el punto de partida lo ponen esas condiciones.'
            : !necesitaOp
              ? ' En alterna ngspice lo intenta, avisa y sigue: los resultados de pequeña señal suelen valer.'
              : ''),
        ids: [...new Set([...partes].flatMap(idsLinea))].slice(0, 12),
      });
    }

  // ---------------------------------------------------------------- rule 5: every terminal on one node
  for (const e of elems) {
    if (e.fuenteV || e.fuenteI || e.terminales.length < 2 || enLazo.has(e)) continue;
    const ns = e.terminales.map((t) => t.nodo).filter(Boolean);
    if (ns.length < 2 || new Set(ns).size !== 1 || !analogico(ns[0]!)) continue;
    res.push({
      nivel: 'aviso',
      regla: 5,
      titulo: `${nombreParte(e)} tiene todos sus terminales en el mismo nodo`,
      texto: `Todos los terminales de ${nombreParte(e)} están en el nodo «${ns[0]}»: está cortocircuitado y no hace nada. Puede que sobre un cable o que falte uno.`,
      ids: idsLinea(e),
    });
  }
  return res.sort((a, b) => (a.nivel === b.nivel ? a.regla - b.regla : a.nivel === 'error' ? -1 : 1));
}

// ------------------------------------------------------------------ convergence

/** ngspice could not solve the circuit (DC operating point or transient time step). */
export function noConverge(errores: string[], fallo?: string | null): 'op' | 'tran' | null {
  const t = [...errores, fallo ?? ''].join('\n');
  if (/operating point could not|dc solution failed|op failed|singular matrix|no convergence|gmin stepping failed|source stepping failed|iteration limit reached|failed to converge|doAnalyses: (op|dc)/i.test(t)) return 'op';
  if (/timestep too small|time step too small|trouble with .*-instance|transient .*fail/i.test(t)) return 'tran';
  return null;
}

export interface Arreglo {
  id: 'opciones' | 'uic' | 'rserie' | 'rshunt' | 'gear';
  titulo: string;
  texto: string;
}

/** The fixes offered (applied to a copy of the circuit by EditorEsquemas). */
export function arreglos(tipo: 'op' | 'tran', doc: DocumentoEsquema): Arreglo[] {
  const r: Arreglo[] = [];
  r.push({
    id: 'opciones',
    titulo: 'Más iteraciones y pasos de gmin y de fuentes',
    texto: 'Añade «.options itl1=500 gminsteps=100 srcsteps=100»: ngspice insiste más y, si no converge, arranca con todas las fuentes a cero y las sube poco a poco (source stepping) o con una conductancia en cada unión que va retirando (gmin stepping).',
  });
  if (doc.analisis.tran.activo || /\.tran\b/i.test(doc.directivas))
    r.push({
      id: 'uic',
      titulo: 'Transitorio con condiciones iniciales (UIC)',
      texto: 'El transitorio empieza desde las tensiones iniciales de los condensadores (0 V si no se dicen) sin calcular antes el punto de trabajo: así arrancan muchos osciladores y circuitos con realimentación positiva.',
    });
  r.push({
    id: 'rserie',
    titulo: 'Una resistencia diminuta en serie con bobinas y fuentes',
    texto: 'Pone 1 mΩ en serie con cada bobina y cada fuente de tensión: deshace los lazos de fuentes y bobinas sin cambiar apenas los resultados.',
  });
  r.push({
    id: 'rshunt',
    titulo: 'Una resistencia enorme de cada nodo a masa',
    texto: 'Añade «.options rshunt=1e12»: 1 TΩ de cada nodo a masa da camino de continua a los nodos flotantes (los que solo tocan condensadores o entradas).',
  });
  if (tipo === 'tran')
    r.push({
      id: 'gear',
      titulo: 'Integración de Gear y tolerancias algo más amplias',
      texto: 'Añade «.options method=gear reltol=0.003 itl4=100»: el método de Gear es más estable con conmutaciones bruscas y el paso de tiempo puede bajar menos.',
    });
  return r;
}

/** The copy of the drawing with a fix applied. */
export function aplicarArreglo(doc: DocumentoEsquema, id: Arreglo['id']): DocumentoEsquema {
  const d = JSON.parse(JSON.stringify(doc)) as DocumentoEsquema;
  const dir = (l: string) => (d.directivas = `${d.directivas.replace(/\s+$/, '')}${d.directivas.trim() ? '\n' : ''}${l}`);
  switch (id) {
    case 'opciones':
      dir('.options itl1=500 gminsteps=100 srcsteps=100');
      break;
    case 'uic':
      d.analisis.tran.activo = true;
      d.analisis.tran.uic = true;
      break;
    case 'rserie':
      d.ajustes = { ...(d.ajustes ?? {}), rserie: true };
      break;
    case 'rshunt':
      dir('.options rshunt=1e12');
      break;
    case 'gear':
      dir('.options method=gear reltol=0.003 itl4=100');
      break;
  }
  return d;
}

export const TITULO_ARREGLO: Record<Arreglo['id'], string> = {
  opciones: 'más iteraciones',
  uic: 'con UIC',
  rserie: 'con 1 mΩ en serie',
  rshunt: 'con rshunt',
  gear: 'con Gear',
};
