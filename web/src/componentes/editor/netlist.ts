// Drawing → SPICE netlist: one line per part (nets named by conectividad.ts, ground = 0), the models and
// subcircuits of the palette parts that use them, the directives kept verbatim, and the analyses chosen in
// the editor. Also: what each probe plots, and plain-Spanish checks before simulating.

import { conectividad, type Conectividad } from './conectividad.ts';
import { pinesDe, SIN_LINEA, tipoDe } from './catalogo.ts';
import { definidos, modeloPorNombre } from './modelos.ts';
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

export function generarNetlist(doc: DocumentoEsquema): Netlist {
  const con = conectividad(doc);
  const errores: Aviso[] = [];
  const avisos: Aviso[] = [];
  const lineas: string[] = [`* ${doc.titulo.trim() || 'Circuito del editor'}`];
  const lineaDe = new Map<number, string>();
  const instancias: LineaGenerada[] = [];
  const sondas: string[] = [];
  const modelosUsados = new Set<string>();
  const nombres = new Map<string, string>();

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
        if (n !== '0') sondas.push(`v(${n})`);
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
        const base = c.nombre.trim().replace(/\s+/g, '_');
        const k = leerValor(c.campos['k'] ?? '', '');
        if (!k.ok || k.v == null || k.v <= 0 || k.v > 1) errores.push({ id: c.id, texto: `${c.nombre}: el acoplamiento k debe estar entre 0 y 1 (por ejemplo 0,999).` });
        poner(c, `L${base}p ${red('p.start')} ${red('p.end')} ${valor(c, 'lp', 'H', errores)}`, { nombre: `L${base}p`, pines: { 'p.start': 0, 'p.end': 1 } });
        poner(c, `L${base}s ${red('s.start')} ${red('s.end')} ${valor(c, 'ls', 'H', errores)}`, { nombre: `L${base}s`, pines: { 's.start': 0, 's.end': 1 } });
        poner(c, `K${base} L${base}p L${base}s ${k.ok && k.v != null ? k.spice : '0.999'}`);
        break;
      }
      case 'V':
      case 'VSIN':
      case 'VPULSE': {
        const n = N('V');
        hayFuente = true;
        fuentes.add(n.toLowerCase());
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
      if (r && r.pines.length < 2 && !r.explicita) avisos.push({ id: c.id, texto: `${c.nombre}: un terminal (${nombrePin(pin)}) no está conectado a nada.` });
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
  'p.start': 'primario 1',
  'p.end': 'primario 2',
  's.start': 'secundario 1',
  's.end': 'secundario 2',
};

export function nombrePin(p: string): string {
  return NOMBRES_PIN[p] ?? p;
}
