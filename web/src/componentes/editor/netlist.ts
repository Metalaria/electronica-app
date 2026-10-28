// Drawing → SPICE netlist: one line per part (nets named by conectividad.ts, ground = 0), the models and
// subcircuits of the palette parts that use them, the directives kept verbatim, and the analyses chosen in
// the editor. Also: what each probe plots, and plain-Spanish checks before simulating.

import { conectividad, type Conectividad } from './conectividad.ts';
import { conduce, pinesDe, PUENTE_DIODOS, PUERTAS_DIGITALES, SIN_LINEA, tipoDe } from './catalogo.ts';
import { definidos, modeloPorNombre } from './modelos.ts';
import { numeroSpiceCorto, resistenciaSensor } from './sensores.ts';
import type { Componente, DocumentoEsquema } from './tipos.ts';
import { leerValor } from './valores.ts';

export interface Aviso {
  /** Part concerned (to select it), if any. */
  id?: string;
  texto: string;
}

export interface LineaGenerada {
  /** Instance name (lower case) → part id and the pin index of each terminal. */
  nombre: string;
  comp: string;
  pines: Record<string, number>;
}

export interface Netlist {
  texto: string;
  errores: Aviso[];
  avisos: Aviso[];
  con: Conectividad;
  /** Element lines generated, with their instance and pins (for the live overlay). */
  instancias: LineaGenerada[];
  /** Vectors chosen by the probes (v(out), i(vam1)…). */
  sondas: string[];
  /** Part id of each line of `texto` (0-based), for ngspice errors. */
  lineaDe: Map<number, string>;
}

/** The SPICE name of a part: its designator, with the element letter in front when it does not start with it. */
export function instancia(letra: string, nombre: string): string {
  const n = nombre.trim().replace(/\s+/g, '_') || '?';
  return n[0]!.toUpperCase() === letra ? n : `${letra}${n}`;
}

function valor(c: Componente, campo: string, unidad: string, errores: Aviso[], opcional = false): string {
  const t = c.campos[campo] ?? '';
  const l = leerValor(t, unidad, { vacio: opcional });
  if (!l.ok) {
    const nombreCampo = tipoDe(c).campos.find((x) => x.id === campo)?.etiqueta ?? campo;
    errores.push({ id: c.id, texto: `${c.nombre}: ${nombreCampo.toLowerCase()} — ${l.error}` });
    return '0';
  }
  return l.spice;
}

/** «0 0; 1m 5; 2m 5» → «0 0 1m 5 2m 5» (SPICE numbers). */
function puntosPwl(c: Componente, unidad: string, errores: Aviso[]): string {
  const t = (c.campos['pwl'] ?? '').trim();
  const pares = t.split(/[;\n]/).map((x) => x.trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of pares) {
    const [a, b, ...resto] = p.split(/\s+/);
    const la = leerValor(a ?? '', 's');
    const lb = leerValor(b ?? '', unidad);
    if (!la.ok || !lb.ok || resto.length) {
      errores.push({ id: c.id, texto: `${c.nombre}: el punto «${p}» no se entiende; escriba «tiempo valor», por ejemplo «1m 5».` });
      continue;
    }
    out.push(`${la.spice} ${lb.spice}`);
  }
  if (!out.length) errores.push({ id: c.id, texto: `${c.nombre}: la fuente PWL no tiene puntos.` });
  return out.join(' ');
}

function especFuente(c: Componente, u: 'V' | 'A', errores: Aviso[]): string {
  const f = c.campos['forma'] ?? 'dc';
  if (f === 'texto') {
    const s = (c.campos['spec'] ?? '').trim();
    if (!s) errores.push({ id: c.id, texto: `${c.nombre}: falta la especificación SPICE de la fuente.` });
    return s || '0';
  }
  const partes: string[] = [];
  const dc = valor(c, 'dc', u, errores, true);
  if (dc) partes.push(`DC ${dc}`);
  else if (f === 'dc') partes.push('DC 0');
  const ac = valor(c, 'ac', u, errores, true);
  if (ac) partes.push(`AC ${ac}`);
  if (f === 'sin') {
    const a = [valor(c, 'vo', u, errores), valor(c, 'va', u, errores), valor(c, 'freq', 'Hz', errores)];
    const td = valor(c, 'td', 's', errores, true);
    const fase = valor(c, 'fase', '', errores, true);
    if (td || fase) a.push(td || '0', '0', fase || '0');
    partes.push(`SIN(${a.join(' ')})`);
  } else if (f === 'pulse') {
    const a = [valor(c, 'v1', u, errores), valor(c, 'v2', u, errores), valor(c, 'td', 's', errores, true) || '0'];
    for (const k of ['tr', 'tf', 'pw', 'per']) a.push(valor(c, k, 's', errores));
    partes.push(`PULSE(${a.join(' ')})`);
  } else if (f === 'pwl') {
    partes.push(`PWL(${puntosPwl(c, u, errores)})`);
  }
  return partes.join(' ');
}

function extra(c: Componente): string {
  const e = (c.campos['extra'] ?? '').trim();
  return e ? ` ${e}` : '';
}

/** Nodes of an imported line: drawn pins from the drawing, hidden ones following the pin they were tied to. */
function nodosImportados(l: { nodos: string[]; pines: Record<string, number> }, red: (pin: string) => string): string[] {
  const res = [...l.nodos];
  const porIndice = new Map<number, string>();
  for (const [pin, k] of Object.entries(l.pines)) porIndice.set(k, pin);
  for (let k = 0; k < res.length; k++) {
    const pin = porIndice.get(k);
    if (pin) res[k] = red(pin);
    else {
      // Hidden pin (a MOSFET bulk on its source…): it follows the drawn pin that had the same node.
      const j = [...porIndice.keys()].find((i) => l.nodos[i] === l.nodos[k]);
      if (j != null) res[k] = red(porIndice.get(j)!);
    }
  }
  return res;
}

/**
 * The netlist of a drawing. `con` gives the nets when they do not come from the drawing's wires (the
 * breadboard, componentes/protoboard/, passes the nets of its holes, strips and jumpers).
 */
export function generarNetlist(doc: DocumentoEsquema, con: Conectividad = conectividad(doc)): Netlist {
  const errores: Aviso[] = [];
  const avisos: Aviso[] = [];
  const lineas: string[] = [`* ${doc.titulo.trim() || 'Circuito del editor'}`];
  const lineaDe = new Map<number, string>();
  const instancias: LineaGenerada[] = [];
  const sondas: string[] = [];
  const modelosUsados = new Set<string>();
  const nombres = new Map<string, string>();
  /** .model lines of the digital (XSPICE) parts, one per part. */
  const modelosDigitales: string[] = [];
  /** Nets driven or read by digital pins (they have no voltage). */
  const redesDigitales = new Set<string>();
  /** Probes, checked against redesDigitales at the end: [part id, net]. */
  const sondasRed: [string, string][] = [];

  const poner = (c: Componente, l: string, inst?: { nombre: string; pines: Record<string, number> }) => {
    lineaDe.set(lineas.length, c.id);
    lineas.push(l);
    if (inst) {
      const k = inst.nombre.toLowerCase();
      if (nombres.has(k)) errores.push({ id: c.id, texto: `Hay dos componentes llamados ${inst.nombre}: cambie el nombre de uno.` });
      nombres.set(k, c.id);
      instancias.push({ nombre: k, comp: c.id, pines: inst.pines });
    }
  };

  const fuentes = new Set<string>();
  const rserie = !!doc.ajustes?.rserie;
  let hayMasa = false;
  let hayFuente = false;
  for (const c of doc.componentes) {
    const red = (pin: string) => {
      const i = con.redDePin.get(`${c.id}.${pin}`);
      return i == null ? `nc_${c.id}_${pin}` : con.redes[i]!.nombre;
    };
    if (c.tipo === 'GND') hayMasa = true;
    if (SIN_LINEA.has(c.tipo)) {
      if (c.tipo === 'SONDA') {
        const n = red('start');
        if (n !== '0') {
          sondas.push(`v(${n})`);
          sondasRed.push([c.id, n]);
        }
      }
      continue;
    }
    const usarModelo = () => {
      const m = (c.campos['modelo'] ?? '').trim();
      if (!m) errores.push({ id: c.id, texto: `${c.nombre}: elija un modelo.` });
      else modelosUsados.add(m.toLowerCase());
      return m || '?';
    };
    const N = (letra: string) => instancia(letra, c.nombre);
    switch (c.tipo) {
      case 'R': {
        const n = N('R');
        poner(c, `${n} ${red('start')} ${red('end')} ${valor(c, 'valor', 'Ω', errores)}${extra(c)}`, { nombre: n, pines: { start: 0, end: 1 } });
        break;
      }
      case 'C':
      case 'L': {
        const n = N(c.tipo);
        const ic = valor(c, 'ic', c.tipo === 'C' ? 'V' : 'A', errores, true);
        if (c.tipo === 'L' && rserie) {
          // Convergence copy: a 1 mΩ resistor in series with the coil.
          const x = `${n.toLowerCase()}_rs`;
          poner(c, `${n} ${red('start')} ${x} ${valor(c, 'valor', 'H', errores)}${ic ? ` ic=${ic}` : ''}${extra(c)}`, { nombre: n, pines: { start: 0 } });
          poner(c, `R${n}_rs ${x} ${red('end')} 1m`, { nombre: `R${n}_rs`, pines: { end: 1 } });
          break;
        }
        poner(c, `${n} ${red('start')} ${red('end')} ${valor(c, 'valor', c.tipo === 'C' ? 'F' : 'H', errores)}${ic ? ` ic=${ic}` : ''}${extra(c)}`, {
          nombre: n,
          pines: { start: 0, end: 1 },
        });
        break;
      }
      case 'POT': {
        const r = leerValor(c.campos['valor'] ?? '', 'Ω');
        const p = leerValor(c.campos['pos'] ?? '', '%');
        if (!r.ok || r.v == null) errores.push({ id: c.id, texto: `${c.nombre}: la resistencia total ${r.ok ? 'debe ser un número' : '— ' + r.error}` });
        let a = 0.5;
        if (!p.ok || p.v == null || p.v < 0 || p.v > 100) errores.push({ id: c.id, texto: `${c.nombre}: la posición del cursor va de 0 a 100 %.` });
        else a = p.v / 100;
        const R = r.ok && r.v ? r.v : 1000;
        const ra = Math.max(R * a, R * 1e-6);
        const rb = Math.max(R * (1 - a), R * 1e-6);
        const n = N('R');
        poner(c, `${n}a ${red('start')} ${red('tap')} ${ra.toPrecision(8).replace(/\.?0+$/, '')}`, { nombre: `${n}a`, pines: { start: 0, tap: 1 } });
        poner(c, `${n}b ${red('tap')} ${red('end')} ${rb.toPrecision(8).replace(/\.?0+$/, '')}`, { nombre: `${n}b`, pines: { tap: 0, end: 1 } });
        break;
      }
      case 'TRAFO': {
        const base = c.nombre.trim().replace(/\s+/g, '_') || 'T';
        const toma = c.campos['toma'] === 'si';
        // Imported transformers keep the names of their lines (coils, then couplings).
        const propios = (c.campos['_nombres'] ?? '').split(/\s+/).filter(Boolean);
        const nombresL = toma ? [`L${base}p`, `L${base}s1`, `L${base}s2`] : [`L${base}p`, `L${base}s`];
        const nombresK = toma ? [`K${base}a`, `K${base}b`, `K${base}c`] : [`K${base}`];
        if (propios.length === nombresL.length + nombresK.length) {
          propios.slice(0, nombresL.length).forEach((x, i) => (nombresL[i] = x));
          propios.slice(nombresL.length).forEach((x, i) => (nombresK[i] = x));
        }
        const k = leerValor(c.campos['k'] ?? '', '');
        if (!k.ok || (k.v != null && (k.v <= 0 || k.v > 1))) errores.push({ id: c.id, texto: `${c.nombre}: el acoplamiento k debe estar entre 0 y 1 (por ejemplo 0,999).` });
        // A plain decimal («0.999», not «999m»), as the book writes couplings.
        const kk = k.ok && k.v != null && k.v > 0 && k.v <= 1 ? String(k.v) : k.ok && k.v == null ? k.spice : '0.999';
        const lp = valor(c, 'lp', 'H', errores);
        let ls: string;
        if ((c.campos['modo'] ?? 'inductancias') === 'relacion') {
          const n = leerValor(c.campos['n'] ?? '', '');
          const L = leerValor(c.campos['lp'] ?? '', 'H');
          if (!n.ok || n.v == null || n.v <= 0) {
            errores.push({ id: c.id, texto: `${c.nombre}: la relación de espiras debe ser un número positivo (10 para 10 : 1).` });
            ls = '1';
          } else ls = L.ok && L.v != null ? numeroSpiceCorto(L.v / (n.v * n.v) / (toma ? 4 : 1)) : '1';
        } else ls = valor(c, 'ls', 'H', errores);
        poner(c, `${nombresL[0]} ${red('p.start')} ${red('p.end')} ${lp}`, { nombre: nombresL[0]!, pines: { 'p.start': 0, 'p.end': 1 } });
        if (toma) {
          poner(c, `${nombresL[1]} ${red('s.start')} ${red('s.mid')} ${ls}`, { nombre: nombresL[1]!, pines: { 's.start': 0, 's.mid': 1 } });
          poner(c, `${nombresL[2]} ${red('s.mid')} ${red('s.end')} ${ls}`, { nombre: nombresL[2]!, pines: { 's.mid': 0, 's.end': 1 } });
          poner(c, `${nombresK[0]} ${nombresL[0]} ${nombresL[1]} ${kk}`);
          poner(c, `${nombresK[1]} ${nombresL[0]} ${nombresL[2]} ${kk}`);
          poner(c, `${nombresK[2]} ${nombresL[1]} ${nombresL[2]} ${kk}`);
        } else {
          poner(c, `${nombresL[1]} ${red('s.start')} ${red('s.end')} ${ls}`, { nombre: nombresL[1]!, pines: { 's.start': 0, 's.end': 1 } });
          poner(c, `${nombresK[0]} ${nombresL[0]} ${nombresL[1]} ${kk}`);
        }
        break;
      }
      case 'PUENTE': {
        const m = usarModelo();
        const propios = (c.campos['_nombres'] ?? '').split(/\s+/).filter(Boolean);
        const base = N('D');
        PUENTE_DIODOS.forEach(([an, ca], i) => {
          const n = propios.length === 4 ? propios[i]! : `${base}${'abcd'[i]}`;
          poner(c, `${n} ${red(an)} ${red(ca)} ${m}`, { nombre: n, pines: { [an]: 0, [ca]: 1 } });
        });
        break;
      }
      case 'CONM': {
        const n = N('R');
        const b = c.campos['posicion'] === 'b';
        poner(c, `${n}1 ${red('com')} ${red('c1')} ${b ? '1g' : '1m'}`, { nombre: `${n}1`, pines: { com: 0, c1: 1 } });
        poner(c, `${n}2 ${red('com')} ${red('c2')} ${b ? '1m' : '1g'}`, { nombre: `${n}2`, pines: { com: 0, c2: 1 } });
        break;
      }
      case 'PULNA':
      case 'PULNC': {
        const n = N('R');
        poner(c, `${n} ${red('start')} ${red('end')} ${conduce(c) ? '1m' : '1g'}`, { nombre: n, pines: { start: 0, end: 1 } });
        break;
      }
      case 'RELE': {
        const n = N('X');
        const orden = ['b1', 'b2', 'com', 'nc', 'no'];
        const pines: Record<string, number> = {};
        orden.forEach((x, i) => (pines[x] = i));
        poner(c, `${n} ${orden.map(red).join(' ')} ${usarModelo()}`, { nombre: n, pines });
        break;
      }
      case 'LDR':
      case 'NTC':
      case 'PTC': {
        const n = N('R');
        const r = resistenciaSensor(c);
        if (r == null) errores.push({ id: c.id, texto: `${c.nombre}: revise sus valores (${c.tipo === 'LDR' ? 'la iluminación no puede ser negativa' : 'temperatura, resistencia y constante'}).` });
        poner(c, `${n} ${red('start')} ${red('end')} ${r != null ? numeroSpiceCorto(r) : '1k'}`, { nombre: n, pines: { start: 0, end: 1 } });
        break;
      }
      case 'LAMP':
      case 'ZUMB':
      case 'ALTAVOZ':
      case 'MOTOR':
      case 'XTAL': {
        const n = N('X');
        const [sub, params] = parametrosCarga(c, errores);
        modelosUsados.add(sub);
        poner(c, `${n} ${red('start')} ${red('end')} ${sub} params: ${params}`, { nombre: n, pines: { start: 0, end: 1 } });
        break;
      }
      case 'V':
      case 'VSIN':
      case 'VPULSE': {
        const n = N('V');
        hayFuente = true;
        fuentes.add(n.toLowerCase());
        if (rserie) {
          const x = `${n.toLowerCase()}_rs`;
          poner(c, `${n} ${red('end')} ${x} ${especFuente(c, 'V', errores)}`, { nombre: n, pines: { end: 0 } });
          poner(c, `R${n}_rs ${x} ${red('start')} 1m`, { nombre: `R${n}_rs`, pines: { start: 1 } });
          break;
        }
        poner(c, `${n} ${red('end')} ${red('start')} ${especFuente(c, 'V', errores)}`, { nombre: n, pines: { end: 0, start: 1 } });
        break;
      }
      case 'I': {
        const n = N('I');
        hayFuente = true;
        fuentes.add(n.toLowerCase());
        poner(c, `${n} ${red('start')} ${red('end')} ${especFuente(c, 'A', errores)}`, { nombre: n, pines: { start: 0, end: 1 } });
        break;
      }
      case 'E':
      case 'G': {
        const n = N(c.tipo);
        poner(c, `${n} ${red('p')} ${red('n')} ${red('cp')} ${red('cn')} ${valor(c, 'valor', c.tipo === 'E' ? '' : 'S', errores)}`, {
          nombre: n,
          pines: { p: 0, n: 1, cp: 2, cn: 3 },
        });
        break;
      }
      case 'D':
      case 'DZ':
      case 'LED':
      case 'DS': {
        const n = N('D');
        poner(c, `${n} ${red('start')} ${red('end')} ${usarModelo()}${extra(c)}`, { nombre: n, pines: { start: 0, end: 1 } });
        break;
      }
      case 'QN':
      case 'QP': {
        const n = N('Q');
        poner(c, `${n} ${red('collector')} ${red('base')} ${red('emitter')} ${usarModelo()}${extra(c)}`, { nombre: n, pines: { collector: 0, base: 1, emitter: 2 } });
        break;
      }
      case 'MN':
      case 'MP': {
        const n = N('M');
        poner(c, `${n} ${red('drain')} ${red('gate')} ${red('source')} ${red('source')} ${usarModelo()}${extra(c)}`, { nombre: n, pines: { drain: 0, gate: 1, source: 2 } });
        break;
      }
      case 'JN':
      case 'JP': {
        const n = N('J');
        poner(c, `${n} ${red('drain')} ${red('gate')} ${red('source')} ${usarModelo()}${extra(c)}`, { nombre: n, pines: { drain: 0, gate: 1, source: 2 } });
        break;
      }
      case 'OA':
      case 'OA5': {
        const n = N('X');
        const pines: Record<string, number> = { in2: 0, in1: 1, out: 2 };
        let nodos = `${red('in2')} ${red('in1')} ${red('out')}`;
        if (c.tipo === 'OA5') {
          nodos += ` ${red('vd')} ${red('vs')}`;
          pines['vd'] = 3;
          pines['vs'] = 4;
        }
        poner(c, `${n} ${nodos} ${usarModelo()}`, { nombre: n, pines });
        break;
      }
      case 'T555': {
        const n = N('X');
        const orden = ['gnd', 'trig', 'out', 'reset', 'ctrl', 'thres', 'dis', 'vcc'];
        const pines: Record<string, number> = {};
        orden.forEach((p, i) => (pines[p] = i));
        poner(c, `${n} ${orden.map(red).join(' ')} ${usarModelo()}`, { nombre: n, pines });
        break;
      }
      case 'DAND':
      case 'DOR':
      case 'DNAND':
      case 'DNOR':
      case 'DXOR':
      case 'DNOT': {
        const n = N('A');
        const m = `${n.toLowerCase()}_mod`;
        const td = valor(c, 'retardo', 's', errores);
        const [a, b, y] = [red('a'), c.tipo === 'DNOT' ? '' : red('b'), red('y')];
        for (const x of [a, b, y]) if (x) redesDigitales.add(x);
        const ent = c.tipo === 'DNOT' ? a : `[${a} ${b}]`;
        poner(c, `${n} ${ent} ${y} ${m}`, { nombre: n, pines: c.tipo === 'DNOT' ? { a: 0, y: 1 } : { a: 0, b: 1, y: 2 } });
        modelosDigitales.push(`.model ${m} ${PUERTAS_DIGITALES[c.tipo]!.modelo}(rise_delay=${td} fall_delay=${td})`);
        break;
      }
      case 'DFF':
      case 'DJK': {
        const n = N('A');
        const m = `${n.toLowerCase()}_mod`;
        const td = valor(c, 'retardo', 's', errores);
        // Set and reset may stay unconnected (NULL); the other pins are required.
        const opcional = (pin: string) => {
          const i = con.redDePin.get(`${c.id}.${pin}`);
          const r = i == null ? null : con.redes[i]!;
          return r && (r.pines.length >= 2 || r.explicita) ? r.nombre : 'NULL';
        };
        const entradas = c.tipo === 'DFF' ? [red('d')] : [red('j'), red('k')];
        const nodos = [...entradas, red('clk'), opcional('set'), opcional('reset'), red('q'), red('nq')];
        for (const x of nodos) if (x !== 'NULL') redesDigitales.add(x);
        const pines: Record<string, number> = {};
        (c.tipo === 'DFF' ? ['d', 'clk', 'set', 'reset', 'q', 'nq'] : ['j', 'k', 'clk', 'set', 'reset', 'q', 'nq']).forEach((p, i) => {
          if (nodos[i] !== 'NULL') pines[p] = i;
        });
        poner(c, `${n} ${nodos.join(' ')} ${m}`, { nombre: n, pines });
        const ic = c.campos['ic'] === '1' ? 1 : 0;
        modelosDigitales.push(
          `.model ${m} ${c.tipo === 'DFF' ? 'd_dff' : 'd_jkff'}(clk_delay=${td} set_delay=${td} reset_delay=${td} ic=${ic} rise_delay=1p fall_delay=1p)`,
        );
        break;
      }
      case 'DCLK': {
        const n = N('A');
        const m = `${n.toLowerCase()}_mod`;
        const f = valor(c, 'freq', 'Hz', errores);
        const ciclo = leerValor(c.campos['ciclo'] ?? '', '%');
        if (!ciclo.ok || ciclo.v == null || ciclo.v <= 0 || ciclo.v >= 100) errores.push({ id: c.id, texto: `${c.nombre}: el ciclo de trabajo va de 1 a 99 %.` });
        const dc = ciclo.ok && ciclo.v != null && ciclo.v > 0 && ciclo.v < 100 ? ciclo.v / 100 : 0.5;
        const y = red('out');
        redesDigitales.add(y);
        // d_osc is controlled by an analog voltage: tied to ground, with the same frequency at both ends. So the
        // netlist has a node 0 and a source even in a purely digital circuit.
        poner(c, `${n} 0 ${y} ${m}`, { nombre: n, pines: { out: 1 } });
        hayMasa = true;
        hayFuente = true;
        modelosDigitales.push(`.model ${m} d_osc(cntl_array=[-1 1] freq_array=[${f} ${f}] duty_cycle=${dc} init_phase=0 rise_delay=1p fall_delay=1p)`);
        break;
      }
      case 'ADC':
      case 'DAC': {
        const n = N('A');
        const m = `${n.toLowerCase()}_mod`;
        const ent = red('in');
        const sal = red('out');
        redesDigitales.add(c.tipo === 'ADC' ? sal : ent);
        poner(c, `${n} [${ent}] [${sal}] ${m}`, { nombre: n, pines: { in: 0, out: 1 } });
        const bajo = valor(c, 'bajo', 'V', errores);
        const alto = valor(c, 'alto', 'V', errores);
        modelosDigitales.push(
          c.tipo === 'ADC'
            ? `.model ${m} adc_bridge(in_low=${bajo} in_high=${alto} rise_delay=1p fall_delay=1p)`
            : `.model ${m} dac_bridge(out_low=${bajo} out_high=${alto} t_rise=${valor(c, 'flanco', 's', errores)} t_fall=${valor(c, 'flanco', 's', errores)})`,
        );
        break;
      }
      case 'SW': {
        const n = N('R');
        poner(c, `${n} ${red('start')} ${red('end')} ${c.campos['estado'] === 'abierto' ? '1g' : '1m'}`, { nombre: n, pines: { start: 0, end: 1 } });
        break;
      }
      case 'AMP': {
        const n = N('V');
        poner(c, `${n} ${red('start')} ${red('end')} DC 0`, { nombre: n, pines: { start: 0, end: 1 } });
        sondas.push(`i(${n.toLowerCase()})`);
        break;
      }
      case 'VM': {
        const n = N('B');
        const nodo = `vm_${c.nombre.trim().toLowerCase().replace(/\s+/g, '_')}`;
        const a = red('end');
        const b = red('start');
        const expr = a === '0' ? `-v(${b})` : b === '0' ? `v(${a})` : `v(${a})-v(${b})`;
        poner(c, `${n} ${nodo} 0 V=${expr}`);
        sondas.push(`v(${nodo})`);
        break;
      }
      default: {
        // Imported part kept as its SPICE line(s).
        if (c.lineas?.length) {
          for (const l of c.lineas) {
            const nodos = nodosImportados(l, red);
            poner(c, `${l.nombre}${nodos.length ? ' ' + nodos.join(' ') : ''}${l.resto ? ' ' + l.resto : ''}`, l.letra === 'K' ? undefined : { nombre: l.nombre, pines: l.pines });
          }
        } else if (c.spice?.plantilla) {
          const nodos = nodosImportados(c.spice, red);
          const plantilla = c.spice.plantilla;
          poner(c, plantilla.replace(/\{(\d+)\}/g, (_, k: string) => nodos[Number(k)] ?? '0'), { nombre: plantilla.split(/\s+/)[0]!, pines: c.spice.pines });
        } else if (c.spice) {
          const nodos = nodosImportados(c.spice, red);
          const resto = (c.campos['resto'] ?? c.spice.resto).trim();
          const nombre = instancia(c.spice.letra, c.nombre);
          if ('VI'.includes(c.spice.letra)) {
            hayFuente = true;
            fuentes.add(nombre.toLowerCase());
          }
          poner(c, `${nombre} ${nodos.join(' ')}${resto ? ' ' + resto : ''}`, { nombre, pines: c.spice.pines });
        }
      }
    }
    // Pins left unconnected.
    for (const pin of pinesDe(c)) {
      const i = con.redDePin.get(`${c.id}.${pin}`);
      const r = i == null ? null : con.redes[i]!;
      // Pins that may stay free: set/reset of the flip-flops, the unused contact of a relay or changeover.
      const opcional = ((c.tipo === 'DFF' || c.tipo === 'DJK') && (pin === 'set' || pin === 'reset')) || (c.tipo === 'RELE' && (pin === 'nc' || pin === 'no')) || (c.tipo === 'CONM' && (pin === 'c1' || pin === 'c2'));
      if (r && r.pines.length < 2 && !r.explicita && !opcional) avisos.push({ id: c.id, texto: `${c.nombre}: un terminal (${nombrePin(pin, c.tipo)}) no está conectado a nada.` });
    }
  }

  if (doc.componentes.some((c) => !SIN_LINEA.has(c.tipo))) {
    const definidas = definidos(doc.directivas);
    if (!hayMasa && !con.redes.some((r) => r.nombre === '0'))
      errores.push({ texto: 'Falta la masa: añada un símbolo de masa (nodo 0); ngspice mide todas las tensiones respecto a ella.' });
    if (!hayFuente && !/^\s*[vi]\S*\s/im.test(doc.directivas)) avisos.push({ texto: 'El circuito no tiene ninguna fuente: todas las tensiones serán cero.' });
    for (const c of con.conflictos) avisos.push({ texto: `Una red tiene dos nombres (${c.join(', ')}); se usa «${c[0]}».` });

    // Models and subcircuits of the library that the parts use.
    const libreria: string[] = [];
    for (const m of modelosUsados) {
      if (definidas.has(m)) continue;
      const lm = modeloPorNombre(m);
      if (lm) libreria.push(lm.texto);
      else {
        const c = doc.componentes.find((x) => (x.campos['modelo'] ?? '').toLowerCase() === m);
        errores.push({ id: c?.id, texto: `El modelo «${m}» no existe: elija uno de la lista o defínalo en las directivas (.model ${m} …).` });
      }
    }
    if (libreria.length) lineas.push('* modelos de la biblioteca del editor', ...libreria);
    if (modelosDigitales.length) lineas.push('* modelos XSPICE de las piezas digitales', ...modelosDigitales);
    for (const [id, r] of sondasRed)
      if (redesDigitales.has(r))
        errores.push({ id, texto: `La red ${r} es digital y no tiene tensión: para verla, pásela por un puente digital → analógico (DAC) y ponga la sonda a su salida.` });
  }
  const dir = doc.directivas.replace(/\s+$/, '');
  if (dir) lineas.push(...dir.split('\n').filter((l) => !/^\s*\.end\s*$/i.test(l)));

  // Analyses chosen in the editor.
  const a = doc.analisis;
  const an: string[] = [];
  const err = (texto: string) => errores.push({ texto });
  const v = (t: string, u: string, que: string) => {
    const l = leerValor(t, u);
    if (!l.ok) {
      err(`${que}: ${l.error}`);
      return '0';
    }
    return l.spice;
  };
  if (a.op) an.push('.op');
  if (a.tran.activo) {
    const paso = v(a.tran.paso, 's', 'Transitorio, paso');
    const fin = v(a.tran.fin, 's', 'Transitorio, tiempo final');
    const ini = a.tran.inicio.trim() && leerValor(a.tran.inicio, 's').ok ? leerValor(a.tran.inicio, 's') : null;
    const inicio = ini && ini.ok && ini.v ? ` ${ini.spice}` : '';
    an.push(`.tran ${paso} ${fin}${inicio}${a.tran.uic ? ' uic' : ''}`);
  }
  if (a.ac.activo) {
    const n = Math.round(Number(a.ac.puntos.replace(',', '.')));
    if (!Number.isFinite(n) || n < 1) err('Alterna: el número de puntos debe ser un entero positivo.');
    an.push(`.ac ${a.ac.tipo} ${Math.max(1, n || 1)} ${v(a.ac.fini, 'Hz', 'Alterna, frecuencia inicial')} ${v(a.ac.ffin, 'Hz', 'Alterna, frecuencia final')}`);
    if (!doc.componentes.some((c) => (c.campos['ac'] ?? '').trim()) && !/\bac\b/i.test(doc.directivas) && !doc.componentes.some((c) => /\bac\b/i.test(c.campos['spec'] ?? c.spice?.resto ?? '')))
      avisos.push({ texto: 'Ninguna fuente tiene amplitud para .ac: escriba 1 en «Amplitud para .ac» de la fuente de entrada.' });
  }
  if (a.dc.activo) {
    const f = a.dc.fuente.trim().toLowerCase();
    if (!f) err('Barrido DC: elija la fuente que se barre.');
    else if (!fuentes.has(f)) err(`Barrido DC: no hay ninguna fuente llamada ${a.dc.fuente}.`);
    const u = f.startsWith('i') ? 'A' : 'V';
    an.push(`.dc ${f || 'v1'} ${v(a.dc.ini, u, 'Barrido DC, inicio')} ${v(a.dc.fin, u, 'Barrido DC, final')} ${v(a.dc.paso, u, 'Barrido DC, paso')}`);
  }
  const tieneAnalisis = an.length || /^\s*\.(op|tran|ac|dc|noise|tf)\b/im.test(doc.directivas) || /^\s*\.control/im.test(doc.directivas);
  if (an.length) lineas.push('* análisis elegidos en el editor', ...an);
  if (!tieneAnalisis && doc.componentes.length) errores.push({ texto: 'Elija al menos un análisis (punto de trabajo, transitorio, alterna o barrido DC).' });
  lineas.push('.end');
  return { texto: lineas.join('\n') + '\n', errores, avisos, con, instancias, sondas, lineaDe };
}

const NOMBRES_PIN: Record<string, string> = {
  start: '1',
  end: '2',
  tap: 'cursor',
  base: 'base',
  collector: 'colector',
  emitter: 'emisor',
  gate: 'puerta',
  drain: 'drenador',
  source: 'fuente',
  in1: 'entrada −',
  in2: 'entrada +',
  out: 'salida',
  vd: 'alimentación +',
  vs: 'alimentación −',
  p: '+',
  n: '−',
  cp: 'control +',
  cn: 'control −',
  com: 'común',
  c1: 'contacto 1',
  c2: 'contacto 2',
  b1: 'bobina 1',
  b2: 'bobina 2',
  nc: 'contacto NC',
  no: 'contacto NA',
  's.mid': 'toma central',
  'p.start': 'primario 1',
  'p.end': 'primario 2',
  's.start': 'secundario 1',
  's.end': 'secundario 2',
  a: 'entrada A',
  b: 'entrada B',
  y: 'salida',
  d: 'D',
  j: 'J',
  k: 'K',
  clk: 'reloj',
  set: 'S (puesta a 1)',
  reset: 'R (puesta a 0)',
  q: 'Q',
  nq: 'Q negada',
  in: 'entrada',
  gnd: 'masa',
  trig: 'disparo',
  ctrl: 'control',
  thres: 'umbral',
  dis: 'descarga',
  vcc: 'Vcc',
};

export function nombrePin(p: string, tipo?: string): string {
  if (tipo === 'PUENTE') return p === 'p' ? '+' : p === 'n' ? '−' : p === 'a' ? '∿ 1' : '∿ 2';
  return NOMBRES_PIN[p] ?? p;
}

/** Subcircuit of a load or crystal of the palette and its parameters («vn=12 p=5»). */
function parametrosCarga(c: Componente, errores: Aviso[]): [string, string] {
  const v = (campo: string, unidad: string) => valor(c, campo, unidad, errores);
  switch (c.tipo) {
    case 'LAMP':
      return ['epa_lampara', `vn=${v('vn', 'V')} p=${v('p', 'W')}`];
    case 'ZUMB':
      return ['epa_zumbador', `vn=${v('vn', 'V')} inom=${v('in', 'A')}`];
    case 'ALTAVOZ':
      return ['epa_altavoz', `z=${v('z', 'Ω')} fs=${v('fs', 'Hz')}`];
    case 'MOTOR':
      return ['epa_motor', `ra=${v('ra', 'Ω')} kt=${v('k', '')} jm=${v('j', '')} bm=${v('b', '')} tl=${v('carga', '')}`];
    default:
      return ['epa_cristal', `f=${v('f', 'Hz')} rs=${v('rs', 'Ω')} cm=${v('cm', '')}e-15 c0=${v('c0', 'F')}`];
  }
}
