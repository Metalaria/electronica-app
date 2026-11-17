// 1.2.1 (motor121): the authors' conversion helper (GUIA §13.11). From a lesson's YAML source (parsed) and the lesson
// the generator built from it, a DRAFT of the same lesson moved towards «aprender haciendo»:
//   - a numeric multiple-choice card (its right option is a number with the unit of a quantity of the model) or an
//     «estimar» card becomes «simular» (predict, then the app's ngspice or model answers) — or «leer» with the
//     schematic's multimeter when the card shows the circuit and the value is a reading the meter gives (a linear DC
//     circuit: checked here) —; its wrong numeric options become typical errors (`razon`: the ratio of what they say to
//     the right value), with their «porque» as the explanation;
//   - an «explorar» or «sorpresa» card with controls and no goal gets an «objetivo» taken from the next card that asks
//     about a value of the same circuit (its «fijar» state: «reach what the next card asks about»), marked «REVISAR»;
//   - every other card that is not done by doing is listed with a suggested type.
// Nothing here writes files (web/scripts/lecciones11.mjs --convertir does). Pure.

import { compilarModelo, valoresDeTarjeta, type Valores } from '../../leccion11/modelo';
import { valoresSueltos } from '../../leccion11/motor';
import { textoPlano } from '../../leccion11/texto';
import type { Leccion11, Tarjeta, WidgetCircuito } from '../../leccion11/tipos';
import { esLineal, resolverCC } from '../cc';
import { esquemaDe } from '../../leccion11/esquemas/registro';
import { contextoNetlist } from '../../leccion11/spice';
import { claseTarjeta } from './generar-hacer';

/** One card of the YAML source, as parsed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fuente = Record<string, any>;

export interface Conversion {
  /** The draft source (the same shape as the YAML; REVISAR in the texts the author must rewrite). */
  borrador: Fuente;
  /** What was changed, card by card. */
  cambios: string[];
  /** The cards left as they were that are not done by doing, each with a suggested type. */
  pendientes: string[];
}

const PREFIJOS: Record<string, number> = { T: 1e12, G: 1e9, M: 1e6, k: 1e3, m: 1e-3, µ: 1e-6, u: 1e-6, n: 1e-9, p: 1e-12 };

/** The first number with its unit in a text («5,24 µA: conduce», «1 000 Ω», «−2,28 mV/°C»): value in SI and unit. */
export function numeroConUnidad(texto: string): { valor: number; unidad: string } | null {
  const t = texto.replace(/ | /g, ' ');
  const re = /([−-]?\d{1,3}(?:[ .]\d{3})*(?:,\d+)?|[−-]?\d+(?:,\d+)?)(?:\s*·?\s*10\^?([−-]?\d+)|\s*×\s*10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+))?\s*(T|G|M|k|m|µ|u|n|p)?\s*(Ω|V|A|W|Hz|F|H|s|°C|J|dB|%)?(?![\p{L}])/u;
  const m = re.exec(t);
  if (!m) return null;
  let v = Number(m[1]!.replace(/[−]/g, '-').replace(/[ .](?=\d{3}\b)/g, '').replace(',', '.'));
  if (!Number.isFinite(v)) return null;
  if (m[2]) v *= 10 ** Number(m[2].replace('−', '-'));
  if (m[3]) {
    const sup = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    const e = Number([...m[3]].map((c) => (c === '⁻' ? '-' : String(sup.indexOf(c)))).join(''));
    if (Number.isFinite(e)) v *= 10 ** e;
  }
  const unidad = m[5] ?? '';
  if (m[4] && !unidad && m[4] !== 'm') return null;
  if (m[4] && unidad) v *= PREFIJOS[m[4]]!;
  return { valor: v, unidad };
}

const cerca = (a: number, b: number, rel = 0.015) => Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b)) + 1e-15;

/** The quantity of the model that is this value in this state (preferring the ones the card names). */
function variableDe(l: Leccion11, r: Valores, valor: number, unidad: string, preferidas: string[]): string | null {
  const todas = [...Object.keys(l.modelo.calculos), ...Object.keys(l.modelo.valores)];
  const de = (k: string) => (l.modelo.calculos[k] ?? l.modelo.valores[k])?.unidad ?? '';
  const buenas = todas.filter((k) => (!unidad || de(k) === unidad || (unidad === '%' && de(k) === '')) && Number.isFinite(r[k]!) && cerca(r[k]!, unidad === '%' && de(k) === '' ? valor / 100 : valor));
  if (!buenas.length) return null;
  return buenas.find((k) => preferidas.includes(k)) ?? buenas[0]!;
}

/** A multimeter placement of the circuit (linear DC, solved here) that reads `valor`: { entre } or { rama }. */
function lecturaDelCircuito(w: WidgetCircuito, r: Valores, valor: number, unidad: string, objetivo: string, mide: Record<string, string>): { entre?: [string, string]; rama?: string } | null {
  const def = esquemaDe(w.esquema);
  if (!def?.medible) return null;
  const c = contextoNetlist(w, r);
  let lineas: string[];
  try {
    lineas = def.netlist(c, 'op');
  } catch {
    return null;
  }
  if (!esLineal(lineas)) {
    // (a circuit the page reads on the simulator: a reading the widget's «mide» says is this value, if the meter can
    // be put there — the generator then checks it with ngspice, «leer.medida»)
    const m = def.medible(c);
    // (a node joined to a named point by a 0 V meter is that point: «a» behind the meter is «fte»)
    const junto = new Map<string, string>();
    for (const l of lineas) {
      const t = l.replace(/;.*$/, '').trim().split(/\s+/);
      if (/^v/i.test(t[0] ?? '') && t.length >= 4 && /^(dc\s+)?0$/i.test(t.slice(3).join(' '))) {
        junto.set(t[1]!.toLowerCase(), t[2]!.toLowerCase());
        junto.set(t[2]!.toLowerCase(), t[1]!.toLowerCase());
      }
    }
    const punto = (n: string) => (n in m.puntos ? n : junto.has(n) && junto.get(n)! in m.puntos ? junto.get(n)! : null);
    for (const [o, v] of Object.entries(mide)) {
      if (v !== objetivo || def.observables[o]?.analisis !== 'op') continue;
      const med = def.observables[o]!.medida.replace(/\s+/g, '').toLowerCase();
      const i = /^i\(([a-z0-9_]+)\)$/.exec(med);
      if (i && i[1]! in (m.ramas ?? {})) return { rama: i[1]! };
      const vv = /^v\(([a-z0-9_]+)\)(?:-v\(([a-z0-9_]+)\))?$/.exec(med);
      const [pa, pb] = vv ? [punto(vv[1]!), punto(vv[2] ?? '0')] : [null, null];
      if (pa && pb) return { entre: [pa, pb] };
    }
    return null;
  }
  const s = resolverCC(lineas);
  if (!s) return null;
  const m = def.medible(c);
  if (unidad === 'A') {
    for (const b of Object.keys(m.ramas ?? {})) if (s.corrientes[b] != null && cerca(Math.abs(s.corrientes[b]!), Math.abs(valor), 0.002)) return { rama: b };
    return null;
  }
  if (unidad !== 'V') return null;
  const ps = Object.keys(m.puntos);
  for (const a of ps) for (const b of ps) if (a !== b && s.nodos[a] != null && s.nodos[b] != null && cerca(s.nodos[a]! - s.nodos[b]!, valor, 0.002)) return { entre: [a, b] };
  return null;
}

/** What a card that is not done by doing could become (for the list of the remaining ones). */
export function sugerencia(t: Tarjeta): string {
  const w = t.widget;
  const textoOpciones = (t.opciones ?? []).map((o) => textoPlano(o.texto)).join(' ');
  if (t.ordenar) return '«tocar» con `orden: true` sobre una figura o el esquema, si el orden es un camino que se ve';
  if (t.emparejar) return 'mantener (emparejar) o, si son partes de un dibujo, «elegir»/«tocar» una a una';
  if (t.tipo === 'formula') return 'mantener la fórmula y añadir antes un «objetivo» o un «leer» que la use';
  if ((t.tipo === 'explorar' || t.tipo === 'sorpresa') && !t.objetivo) return 'añadir «objetivo» (consiga X) con una condición sobre la lectura';
  if (w?.tipo === 'circuito' && /\b(R|C|L|D|Q)[₀-₉\d]|resistencia|condensador|diodo|transistor|carga|fuente|bobina|nodo|rama/i.test(textoOpciones))
    return '«elegir» en el esquema (las opciones nombran partes del circuito) o «medir» si piden dónde se mide';
  if (w?.tipo === 'grafica' || (w?.tipo === 'circuito' && w.grafica)) return '«marcar» en la gráfica (un punto, un nivel) o «leer» lo que marca';
  if (w?.tipo === 'figura') return '«tocar» la zona de la figura';
  if (w?.tipo === 'logica') return '«tabla», «tocar» o un «objetivo» sobre el circuito lógico';
  if (t.tipo === 'porque' || t.opciones) return 'mantener como pregunta (como mucho dos por lección): un «por qué» o un hecho del libro';
  return 'revisar';
}

/** The draft of a lesson (its parsed YAML source `f` and the lesson the generator built from it, `l`). */
export function convertirLeccion(f: Fuente, l: Leccion11): Conversion {
  const borrador: Fuente = JSON.parse(JSON.stringify(f));
  const cambios: string[] = [];
  const pendientes: string[] = [];
  const mc = compilarModelo(l.modelo);
  const tarjetas: Fuente[] = borrador.tarjetas ?? [];
  const estadoDe = (t: Tarjeta) => mc.evaluar(valoresDeTarjeta(t, valoresSueltos(l, l.tarjetas.indexOf(t))));
  const unidadDe = (k: string) => (l.modelo.calculos[k] ?? l.modelo.valores[k])?.unidad ?? '';

  tarjetas.forEach((ft) => {
    const t = l.tarjetas.find((x) => x.id === ft.id);
    if (!t || t.tipo === 'resumen') return;
    if (claseTarjeta(t) === 'hacer') return;
    const r = estadoDe(t);
    const w = t.widget;

    // ---- numbers: an estimate, or options whose right one is a number of the model
    let objetivo: string | null = null;
    let unidad = '';
    let tol = 0.02;
    const errores: Fuente[] = [];
    if (t.estimar) {
      objetivo = t.estimar.objetivo;
      unidad = t.estimar.unidad;
      tol = t.estimar.tol;
      for (const p of t.pistas ?? []) {
        const c = p.cuando;
        if (!c || c.valor !== 'estimacion') continue;
        const obj = mc.funcion(objetivo)(r);
        if (!(obj > 0)) continue;
        // (a hint «mayor: x» is kept as min: x — the estimate too high —, «menor: x» as max: x)
        if (c.min != null && c.max == null) errores.push({ razon: { min: Number((c.min / obj).toPrecision(3)), max: 1000 }, texto: textoPlano(p.texto) });
        else if (c.max != null && c.min == null) errores.push({ razon: { min: 0.001, max: Number((c.max / obj).toPrecision(3)) }, texto: textoPlano(p.texto) });
      }
    } else if (t.opciones) {
      const buena = t.opciones.find((o) => o.bien);
      const n = buena ? numeroConUnidad(textoPlano(buena.texto)) : null;
      if (n) {
        const preferidas = [...Object.keys(ft.comprobar?.[0] ?? {}), ...(w && 'lectura' in w && w.lectura ? [w.lectura.valor] : []), ...Object.values((ft.widget?.mide ?? {}) as Record<string, string>)];
        objetivo = variableDe(l, r, n.valor, n.unidad, preferidas.map(String));
        unidad = objetivo ? unidadDe(objetivo) : '';
        if (objetivo) {
          const obj = r[objetivo]!;
          for (const o of t.opciones.filter((x) => !x.bien)) {
            const m = numeroConUnidad(textoPlano(o.texto));
            const v = m && (m.unidad === n.unidad || !m.unidad) ? m.valor : null;
            if (v != null && obj !== 0 && Number.isFinite(v / obj) && !cerca(v, obj, 0.05)) {
              const q = v / obj;
              const [a, b] = q > 0 ? [q * 0.97, q * 1.03] : [q * 1.03, q * 0.97];
              errores.push({ razon: { min: Number(a.toPrecision(3)), max: Number(b.toPrecision(3)) }, texto: textoPlano(o.porque) });
            } else errores.push({ razon: { min: 1.9, max: 2.1 }, texto: `REVISAR (de la opción «${textoPlano(o.texto)}»): ${textoPlano(o.porque)}` });
          }
        }
      }
    }
    if (objetivo) {
      const rotulo = t.estimar?.rotulo ? textoPlano(t.estimar.rotulo) : (l.modelo.calculos[objetivo] ?? l.modelo.valores[objetivo])?.nombre ?? objetivo;
      const obj = mc.funcion(objetivo)(r);
      const sinErrores = !errores.length;
      if (sinErrores) errores.push({ razon: { min: 1.9, max: 2.1 }, texto: 'REVISAR: el error típico de esta cuenta (por ejemplo, el doble) y por qué.' });
      const aLeer = t.tipo === 'pregunta' && w?.tipo === 'circuito' && !w.ocultar ? lecturaDelCircuito(w, r, obj, unidad, objetivo, (ft.widget?.mide ?? {}) as Record<string, string>) : null;
      // (the right option's explanation is what a step says when it is right)
      const buena = t.opciones?.find((o) => o.bien);
      if (!ft.exito && buena) ft.exito = textoPlano(buena.porque);
      // (an estimate's hints look at «estimacion», which «simular» also has: they stay)
      for (const q of ['opciones', 'estimar']) delete ft[q];
      if (aLeer) delete ft.pistas;
      if (aLeer && ft.widget) {
        ft.tipo = 'leer';
        ft.widget.instrumento = { tipo: 'multimetro' };
        ft.leer = { objetivo, unidad, tol, rotulo, medida: aLeer, errores };
        cambios.push(`${ft.id}: ${t.estimar ? 'estimar' : 'opciones numéricas'} → «leer» con el multímetro del esquema (${aLeer.rama ? `rama ${aLeer.rama}` : `entre ${aLeer.entre!.join(' y ')}`})`);
      } else {
        ft.tipo = 'simular';
        // (the widget's «mide» lives in the source: the generator keeps it apart)
        const mideObs = w?.tipo === 'circuito' ? Object.entries((ft.widget?.mide ?? {}) as Record<string, string>).find(([o, v]) => v === objetivo && esquemaDe(w.esquema)?.observables[o]?.analisis !== 'tran')?.[0] : undefined;
        ft.simular = { objetivo, unidad, tol, rotulo, ...(mideObs ? { medida: mideObs } : {}), errores };
        if (ft.widget && (ft.widget.tipo === 'circuito' || ft.widget.tipo === 'grafica') && ft.widget.lectura && !ft.widget.ocultar) ft.widget.ocultar = true;
        cambios.push(`${ft.id}: ${t.estimar ? 'estimar' : 'opciones numéricas'} → «simular» (objetivo ${objetivo}${mideObs ? `, simulado: ${mideObs}` : ', con el modelo'}; ${errores.length} error(es) típicos${sinErrores ? ', uno por REVISAR' : ''})`);
      }
      return;
    }

    // ---- an explore or surprise card with controls and no goal: the goal of the next card that asks about a value
    if ((t.tipo === 'explorar' || t.tipo === 'sorpresa') && !t.objetivo && w && 'mandos' in w && w.mandos.length) {
      const mandos = w.mandos;
      const lectura = 'lectura' in w && w.lectura ? w.lectura.valor : w.tipo === 'circuito' ? w.corriente : undefined;
      let propuesta: { valor: string; objetivo: number; de: string } | null = null;
      for (const sig of l.tarjetas.slice(l.tarjetas.indexOf(t) + 1, l.tarjetas.indexOf(t) + 4)) {
        const fijados = Object.entries(sig.fijar).filter(([v]) => mandos.some((m) => m.valor === v));
        if (!fijados.length || !lectura) continue;
        // (the state the next card asks about must be reachable with these controls)
        if (!fijados.every(([v, x]) => mandos.find((m) => m.valor === v)!.valores.some((p) => cerca(p, x, 1e-6)))) continue;
        const rs = mc.evaluar({ ...valoresDeTarjeta(t, valoresSueltos(l, l.tarjetas.indexOf(t))), ...Object.fromEntries(fijados) });
        const v = rs[lectura];
        if (v == null || !Number.isFinite(v) || cerca(v, r[lectura]!, 0.02)) continue;
        propuesta = { valor: lectura, objetivo: Number(v.toPrecision(4)), de: sig.id };
        break;
      }
      if (propuesta) {
        const ft2 = ft;
        const nombre = (l.modelo.calculos[propuesta.valor] ?? l.modelo.valores[propuesta.valor])?.nombre ?? propuesta.valor;
        ft2.objetivo = {
          condiciones: [{ valor: propuesta.valor, objetivo: propuesta.objetivo, tol: 0.02, rotulo: `${nombre[0]!.toUpperCase()}${nombre.slice(1)}: {{${propuesta.valor}}}` }],
          logrado: `REVISAR: lo que explica haberlo conseguido ({{${propuesta.valor}}}). Ojo: si «${propuesta.de}» pide predecir este valor, el objetivo le da la respuesta; elija otro estado.`,
          pistas: [
            { cuando: { valor: propuesta.valor, mayor: Number((propuesta.objetivo * 1.02).toPrecision(4)) }, texto: 'REVISAR: sobra; qué mover y hacia dónde.' },
            { texto: 'REVISAR: falta; qué mover y hacia dónde.' },
          ],
        };
        delete ft2.requiere;
        cambios.push(`${ft.id}: ${t.tipo} → con «objetivo» (${propuesta.valor} = ${propuesta.objetivo}, el estado que pregunta «${propuesta.de}»; REVISAR)`);
        return;
      }
    }
    pendientes.push(`${ft.id} (${t.tipo}${t.opciones ? ', opciones' : ''}): ${sugerencia(t)}`);
  });
  return { borrador, cambios, pendientes };
}
