#!/usr/bin/env node
// 1.0 «Retos manipulando la figura»: challenges where the reader moves one or two values of a live figure of the book
// (a resistor, a source) until a quantity of the circuit meets a target, checked by simulating with the app's ngspice.
//
//   node scripts/retos10.mjs [--detalle]
//
// Runs after practica10.mjs (contenido/generar.py calls it) and adds `reto` items to web/public/libro/practica/
// <parte>.json and to practica/indice.json; it first removes the `reto` items of a previous run, so it can be run again
// on its own. Sources and rules (see ESQUEMA.md, «Retos»):
//   - circuits: the live schematics that a lesson can explore (libro/explorables.json: simulable in DC, values known);
//   - target: the book's own value of the observed quantity. When the section's text writes that value («la tensión de
//     salida es 6 V»), the target is the number the book writes and that paragraph is the source; otherwise it is the
//     reading of the book's own simulation of the figure (the values it stores), and the figure is the source;
//   - start: the book's value of the knob ×2, ×½, ×3 or ×⅓ (the first that moves the reading ≥ 15 % away);
//   - kept only if the reading is monotonic in each knob over its whole range (the «which way» hint must be right),
//     the start is outside the tolerance and the book's values meet it (all simulated here);
//   - at most two per drawing: the best single knob and, with two designated knobs, one with both (any combination
//     that meets the target is right).
// Nothing is written for the reader beyond fixed sentences around book names and values. Deterministic.
import fs from 'node:fs';
import path from 'node:path';
import {
  J, libro, src, ordenPartes, parte, seccionesDe, lugares, citaFigura, parrafos, subDe, donde, verRef, plano, esc,
  valorTexto, cantidades, motor, nombrePieza, etiquetaNodo, recorteDe, encuadreDe, ordenarPractica, recontarIndice,
} from './libro-node.mjs';

const detalle = process.argv.includes('--detalle');
const circ = await import(src('componentes/practica/circuito.ts'));
const { elementosCircuito, ONDAS, cargaDe } = await import(src('componentes/figuras-vivas/esquema/netlist.ts'));
const { posicionesMando, posicionDe } = await import(src('componentes/practica/retos.ts'));
const simularTexto = await motor();

const TOL = 0.02;
const explorables = J('explorables.json').esquemas;
let simulaciones = 0;

const mayus = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ------------------------------------------------------------------ the circuits

/** Every figure block of the explorable drawings: {p, sec, top, fig}. */
const figuras = [];
for (const p of ordenPartes) {
  for (const sec of seccionesDe.get(p)) {
    const bl = parte(p).bloques;
    for (let i = sec.h2 + 1; i < sec.fin; i++) {
      const visitar = (b) => {
        if (b.t === 'figura' && b.datos && explorables[b.datos] && b.svg_vista && b.label) figuras.push({ p, sec, top: i, fig: b });
        if (Array.isArray(b.bloques)) b.bloques.forEach(visitar);
      };
      visitar(bl[i]);
    }
  }
}

async function op(esq, valores) {
  simulaciones++;
  const { texto, meta } = circ.netlistFiguraCon(esq, valores);
  try {
    return circ.resultadoFigura(esq, meta, await simularTexto(texto));
  } catch {
    return null;
  }
}

function observables(todos, esq) {
  const r = [];
  const fuentes = esq.elementos.filter((e) => ['V', 'BAT', 'RAIL', 'V?'].includes(e.rol) && e.valor != null).map((e) => Math.abs(e.valor));
  const opLibro = esq.simulacion?.op;
  for (const n of esq.nodos) {
    const h = etiquetaNodo(todos, n);
    if (!h) continue;
    const v = opLibro?.nodos?.[n.id];
    // a node held by a supply teaches nothing
    if (v != null && fuentes.some((f) => Math.abs(Math.abs(v) - f) <= 0.01 * f)) continue;
    r.push({ o: { k: 'nodo', id: n.id, nombre: `la tensión en ${h}`, unidad: 'V' }, peso: 3 });
  }
  for (const e of elementosCircuito(esq)) {
    if (e.discontinuo) continue;
    const n = nombrePieza(todos, e);
    if (!n.unico || !n.html) continue;
    if (['LED', 'D', 'DZ'].includes(e.rol)) r.push({ o: { k: 'corriente', id: e.id, nombre: `la corriente por ${n.html}`, unidad: 'A' }, peso: 3 });
    else if (e.rol === 'R' && e.valor && cargaDe(e) == null) {
      r.push({ o: { k: 'corriente', id: e.id, nombre: `la corriente por ${n.html}`, unidad: 'A' }, peso: n.designado ? 2 : 1.4 });
      r.push({ o: { k: 'tension', id: e.id, nombre: `la tensión en ${n.html}`, unidad: 'V' }, peso: n.designado ? 2 : 1.4 });
    }
  }
  return r;
}

function mandosPosibles(todos, esq) {
  const excl = new Set(esq.simulacion?.excluidos ?? []);
  const r = [];
  for (const e of elementosCircuito(esq)) {
    if (excl.has(e.id) || e.discontinuo || !e.valor || cargaDe(e) != null) continue;
    if (!['R', 'POT', 'V', 'BAT', 'I'].includes(e.rol)) continue;
    const n = nombrePieza(todos, e);
    if (!n.unico || !n.html) continue;
    const unidad = e.rol === 'R' || e.rol === 'POT' ? 'Ω' : e.rol === 'I' ? 'A' : 'V';
    r.push({ m: { id: e.id, nombre: n.html, unidad, de: e.valor }, peso: unidad === 'Ω' ? (n.designado ? 2 : 1.3) : 1.2, designado: n.designado });
  }
  return r;
}

/** The book's text writes the target? The paragraph of the section (or the caption) that gives |y0| within 1,5 %. */
function objetivoEnTexto(p, sec, fig, top, y0, unidad) {
  const a = Math.abs(y0);
  const candidatos = [];
  for (const x of parrafos(p, sec)) {
    if (x.item) continue;
    for (const c of cantidades(plano(x.html))) {
      if (c.unidad !== unidad || c.valor === 0) continue;
      if (Math.abs(c.valor - a) <= 0.015 * a) candidatos.push({ x, c, cita: x.html.includes(`data-ref="${fig.label}"`), d: Math.abs(x.top - top) });
    }
  }
  for (const c of cantidades(plano(fig.pie ?? ''))) {
    if (c.unidad === unidad && c.valor && Math.abs(c.valor - a) <= 0.015 * a) candidatos.push({ x: { html: fig.pie, top }, c, cita: true, d: -1, pie: true });
  }
  if (!candidatos.length) return null;
  // the paragraph that cites the figure first, then the nearest one
  candidatos.sort((u, v) => Number(v.cita) - Number(u.cita) || u.d - v.d);
  const b = candidatos[0];
  const ref = b.pie ? fig.label : subDe(p, sec, b.x.top);
  return { valor: b.c.valor, texto: b.c.texto, cita: { html: b.x.html, ref, donde: donde(ref) } };
}

const leer = (o, r) => (r ? circ.leerEnFigura(r, o) : null);

/** Sign of the change of |y| over the knob's range (5 samples), or null when not monotonic or flat. */
async function efectoDe(esq, base, m, o) {
  const pos = posicionesMando(m.unidad, m.de);
  const muestras = [0, 0.25, 0.5, 0.75, 1].map((f) => pos[Math.round(f * (pos.length - 1))]);
  const ys = [];
  for (const v of muestras) {
    const y = leer(o, await op(esq, { ...base, [m.id]: v }));
    if (y == null || !Number.isFinite(y)) return null;
    ys.push(Math.abs(y));
  }
  const d = ys.slice(1).map((y, i) => y - ys[i]);
  const escala = Math.max(...ys, 1e-15);
  if (d.every((x) => x >= -1e-6 * escala) && ys.at(-1) - ys[0] > 0.05 * escala) return 'sube';
  if (d.every((x) => x <= 1e-6 * escala) && ys[0] - ys.at(-1) > 0.05 * escala) return 'baja';
  return null;
}

const FACTORES = [2, 0.5, 3, 1 / 3];

async function retosDe({ p, sec, top, fig }, figura, esq, k) {
  // Names must be unique in what the reader sees: the drawing alone when the figure is cropped to it.
  const recorte = recorteDe(fig, esq);
  const todos = recorte ? [esq] : figura;
  const base = await op(esq, {});
  if (!base) return [];
  const obs = observables(todos, esq);
  const mandos = mandosPosibles(todos, esq);
  const solos = [];
  const efectos = new Map(); // «mando|obs» → sube|baja|null
  for (const { m, peso: pm, designado } of mandos) {
    for (const { o, peso: po } of obs) {
      if (o.id === m.id) continue; // the knob's own current or voltage: too direct
      const y0 = leer(o, base);
      if (y0 == null || (o.unidad === 'A' ? Math.abs(y0) < 1e-6 : Math.abs(y0) < 1e-3)) continue;
      const ef = await efectoDe(esq, {}, m, o);
      efectos.set(`${m.id}|${o.id}`, ef);
      if (!ef) continue;
      const valores = posicionesMando(m.unidad, m.de);
      let inicio = null;
      for (const f of FACTORES) {
        const v = valores[posicionDe(valores, m.de * f)];
        const y = leer(o, await op(esq, { [m.id]: v }));
        if (y == null) continue;
        if (Math.abs(Math.abs(y) - Math.abs(y0)) / Math.abs(y0) >= 0.15) {
          inicio = { v, y };
          break;
        }
      }
      if (!inicio) continue;
      // the reading IS the knob (a source's own current or voltage passed straight through): nothing to find out
      if (m.unidad === o.unidad && Math.abs(Math.abs(y0) - Math.abs(m.de)) <= 0.01 * Math.abs(m.de) && Math.abs(Math.abs(inicio.y) - Math.abs(inicio.v)) <= 0.01 * Math.abs(inicio.v)) continue;
      const texto = objetivoEnTexto(p, sec, fig, top, y0, o.unidad);
      const peso = pm + po + (texto ? 4 : 0) + (designado ? 0.5 : 0) + (m.unidad === 'V' ? 0.3 : 0);
      solos.push({ m, o, y0, ef, inicio, texto, valores, peso });
    }
  }
  if (!solos.length) return [];
  solos.sort((a, b) => b.peso - a.peso || a.m.id.localeCompare(b.m.id) || a.o.id.localeCompare(b.o.id));
  const elegidos = [{ mandos: [solos[0]], o: solos[0].o, y0: solos[0].y0, texto: solos[0].texto }];
  // A second one: two designated knobs on the best observable, else another knob and another quantity.
  const o1 = solos[0].o;
  const otro = solos.find((s) => s.o.id === o1.id && s.m.id !== solos[0].m.id && s.m.unidad === 'Ω');
  if (otro && solos[0].m.unidad === 'Ω') {
    const vals = { [solos[0].m.id]: solos[0].inicio.v, [otro.m.id]: otro.valores[posicionDe(otro.valores, otro.m.de * (otro.ef === solos[0].ef ? 1 / 3 : 3))] };
    // both moved the same way for the reading: the start is far off target
    const y = leer(o1, await op(esq, vals));
    if (y != null && Math.abs(Math.abs(y) - Math.abs(solos[0].y0)) / Math.abs(solos[0].y0) >= 0.15)
      elegidos.push({ mandos: [{ ...solos[0] }, { ...otro, inicio: { v: vals[otro.m.id], y } }], o: o1, y0: solos[0].y0, texto: solos[0].texto, dos: { y } });
  }
  if (elegidos.length < 2) {
    const s2 = solos.find((s) => s.m.id !== solos[0].m.id && s.o.id !== o1.id);
    if (s2) elegidos.push({ mandos: [s2], o: s2.o, y0: s2.y0, texto: s2.texto });
  }
  // 1.0 (coverage): up to two more single-knob challenges whose target the section's text writes (same rules)
  const usados = new Set(elegidos.flatMap((e) => e.mandos.map((x) => `${x.m.id}|${e.o.id}`)));
  const quantities = new Set(elegidos.map((e) => e.o.id));
  let extra = 0;
  for (const s of solos) {
    if (extra >= 2) break;
    if (!s.texto || usados.has(`${s.m.id}|${s.o.id}`) || quantities.has(s.o.id)) continue;
    // not the same physical quantity under another name (the voltage across R2 is Vsal; a series current twice)
    if (elegidos.some((e) => e.o.unidad === s.o.unidad && Math.abs(Math.abs(e.y0) - Math.abs(s.y0)) <= 0.01 * Math.abs(s.y0))) continue;
    elegidos.push({ mandos: [s], o: s.o, y0: s.y0, texto: s.texto });
    usados.add(`${s.m.id}|${s.o.id}`);
    quantities.add(s.o.id);
    extra++;
  }

  // what is shown: the schematic without cut texts, notes or the book's readings (QA 1.0)
  const enc = encuadreDe(fig, esq);
  const fuente = { k: 'figura', datos: fig.datos, esquema: k, figura: fig.label, num: fig.num, src: fig.src, vista: fig.svg_vista, recorte: enc?.recorte ?? recorte, ...(enc?.ocultar.length ? { ocultar: enc.ocultar } : {}) };
  const cf = citaFigura(p, sec, fig, top);
  const items = [];
  for (const [n, e] of elegidos.entries()) {
    const objetivo = e.texto ? e.texto.valor : Number(Math.abs(e.y0).toPrecision(3));
    // the book's values must meet it (simulated), the start must not
    const lectura = Math.abs(e.y0);
    if (Math.abs(lectura - objetivo) > TOL * objetivo) continue;
    const inicios = Object.fromEntries(e.mandos.map((s) => [s.m.id, s.inicio.v]));
    const yIni = e.dos ? e.dos.y : e.mandos[0].inicio.y;
    if (Math.abs(Math.abs(yIni) - objetivo) <= TOL * objetivo) continue;
    const nombres = e.mandos.map((s) => s.m.nombre);
    const unidad = e.o.unidad;
    const obj = valorTexto(objetivo, unidad);
    const varios = e.mandos.length > 1;
    const enunciado = varios
      ? `Ajuste ${nombres[0]} y ${nombres[1]} hasta que ${e.o.nombre} sea ${obj}\u00a0±\u00a0${TOL * 100}\u00a0%. Vale cualquier combinación que lo consiga.`
      : `Ajuste ${nombres[0]} hasta que ${e.o.nombre} sea ${obj}\u00a0±\u00a0${TOL * 100}\u00a0%.`;
    const efecto = Object.fromEntries(e.mandos.map((s) => [s.m.id, s.ef]));
    const frasesEfecto = e.mandos.map((s) => `Si ${s.m.nombre} aumenta, ${e.o.nombre} ${s.ef === 'sube' ? 'sube' : 'baja'}.`);
    const valoresLibro = e.mandos.map((s) => `${s.m.nombre} = ${valorTexto(s.m.de, s.m.unidad)}`).join(' y ');
    const citas = e.texto ? [e.texto.cita, ...cf.filter((c) => c.html !== e.texto.cita.html)] : cf;
    const desarrollo = [
      e.texto
        ? `El objetivo lo da el libro: ${e.o.nombre} = ${esc(e.texto.texto)} (${e.texto.cita.donde}).`
        : `El objetivo es el valor que da la simulación del libro de la figura ${fig.num} con sus propios valores.`,
      `Con los valores del libro (${valoresLibro}), la simulación da ${e.o.nombre} = ${valorTexto(lectura, unidad)}.`,
      ...frasesEfecto,
    ];
    const pistas = [
      { titulo: 'Lo que dice el libro', html: cf[0].html },
      { titulo: 'Hacia dónde', html: frasesEfecto.join(' ') },
      { titulo: 'El valor del libro', html: `En la figura ${fig.num}, ${valoresLibro}.` },
    ];
    items.push({
      id: `${p}-reto-${fig.label}-${k}-${n + 1}`,
      tipo: 'reto',
      parte: p,
      seccion: sec.label,
      bloque: top,
      ref: fig.label,
      verRef: verRef(fig.label),
      enunciado,
      citas,
      pistas,
      fuente,
      mandos: e.mandos.map((s) => ({ ...s.m, inicio: inicios[s.m.id], valores: s.valores })),
      observa: e.o,
      objetivo,
      tol: TOL,
      origen: e.texto ? 'texto' : 'simulacion',
      efecto,
      solucion: { valores: Object.fromEntries(e.mandos.map((s) => [s.m.id, s.m.de])), lectura: Number(lectura.toPrecision(6)) },
      inicioLectura: Number(Math.abs(yIni).toPrecision(6)),
      desarrollo,
    });
    if (detalle) console.log(`  ${items.at(-1).id}: ${plano(enunciado)} [${e.texto ? 'texto' : 'simulación'}]`);
  }
  return items;
}

// ------------------------------------------------------------------ building challenges («Monte el circuito»)

const nuevos = new Map(); // parte → items

const { netlistMedida, medidaDeOp, comprobarConstruccion } = await import(src('componentes/practica/construye.ts'));
const { MODELOS } = await import(src('componentes/editor/modelos.ts'));
const ejercicios = J('ejercicios.json').items;

// The book's design exercises that a breadboard circuit answers: the specification is the exercise's statement
// (every number of it is checked to be written there), the tolerances the book's own (ej-2.4 accepts the 2,7 % of its
// E12 pair; the LED ones the step between neighbouring E12 values), and the lesson is the section that teaches it.
const CONSTRUYE = [
  {
    ej: 'ej-1.4', seccion: 'sec-1.4', alimentacion: 5, cartas: ['R'], textos: ['3,3 V', '5 V', '1 kΩ'],
    // R₁ = 1 kΩ is the upper one (+ to the output) and the divider has two resistors (review 10g)
    condiciones: [{ k: 'fuente', valor: 5 }, { k: 'nodo', valor: 3.3, tol: 0.03, nombre: 'la salida' }, { k: 'divisor', n: 2, arriba: 1000 }, { k: 'sobrantes' }],
    ref: { descripcion: 'R<sub>1</sub> = 1 kΩ del + a la salida y R<sub>2</sub> = 2 kΩ de la salida al −', netlist: 'V1 1 0 dc 5\nR1 1 2 1k\nR2 2 0 2k\n' },
  },
  {
    ej: 'ej-2.4', seccion: 'sec-2.7', alimentacion: 12, cartas: ['R'], textos: ['12 V', '5 V', 'E12'],
    condiciones: [{ k: 'fuente', valor: 12 }, { k: 'nodo', valor: 5, tol: 0.03, nombre: 'la salida' }, { k: 'e12' }, { k: 'divisor', n: 2 }, { k: 'sobrantes' }],
    ref: { descripcion: 'R<sub>1</sub> = 2,2 kΩ del + a la salida y R<sub>2</sub> = 1,5 kΩ de la salida al −', netlist: 'V1 1 0 dc 12\nR1 1 2 2.2k\nR2 2 0 1.5k\n' },
  },
  {
    ej: 'ej-2.6', seccion: null, alimentacion: 5, cartas: ['R', 'LEDR', 'LEDV'], textos: ['2 V', '15 mA', '5 V', 'E12'],
    condiciones: [{ k: 'fuente', valor: 5 }, { k: 'led', corriente: 0.015, tol: 0.12 }, { k: 'e12' }, { k: 'sobrantes' }],
    ref: { descripcion: 'una resistencia de 220 Ω en serie con el LED rojo', netlist: 'V1 1 0 dc 5\nR1 1 2 220\nD1 2 0 LEDR\n', modelos: ['LEDR'] },
  },
  {
    ej: 'ej-5.3', seccion: 'sec-5.8', alimentacion: 12, cartas: ['R', 'DZ51'], textos: ['5,1 V', '20 mA', '12 V', '5 mA'],
    condiciones: [
      { k: 'fuente', valor: 12 }, { k: 'nodo', valor: 5.1, tol: 0.05, nombre: 'la salida regulada' },
      { k: 'carga', corriente: 0.02, tol: 0.1 }, { k: 'zener', min: 0.005 }, { k: 'sobrantes' },
    ],
    ref: {
      descripcion: 'R<sub>s</sub> = 270 Ω del + a la salida, el Zener de 5,1 V de la salida al − (la franja hacia la salida) y una carga de 270 Ω en paralelo con él',
      netlist: 'V1 1 0 dc 12\nRS 1 2 270\nDZ1 0 2 DZ51\nRL 2 0 270\n', modelos: ['DZ51'],
    },
  },
  {
    ej: 'ej-26.3', seccion: null, alimentacion: 5, cartas: ['R', 'LEDR', 'LEDV'], textos: ['5 V', '2 V', '10 mA'],
    condiciones: [{ k: 'fuente', valor: 5 }, { k: 'led', corriente: 0.01, tol: 0.1 }, { k: 'sobrantes' }],
    ref: { descripcion: 'una resistencia de 330 Ω en serie con el LED rojo', netlist: 'V1 1 0 dc 5\nR1 1 2 330\nD1 2 0 LEDR\n', modelos: ['LEDR'] },
  },
  {
    ej: 'ej-2.5', seccion: null, alimentacion: 5, cartas: ['R'], textos: ['1 kΩ'],
    // R₄ = 1 kΩ is the exercise's answer: the four arms of 1 kΩ (review 10d, 10g); balanced within 5 mV, well under the
    // 12 mV of the 1010 Ω sensor that, as the exercise says, breaks the balance
    condiciones: [{ k: 'puente', tol: 0.001, valor: 1000 }, { k: 'sobrantes' }],
    ref: { descripcion: 'dos ramas de dos resistencias de 1 kΩ entre el + y el −, una al lado de la otra', netlist: 'V1 1 0 dc 5\nR1 1 a 1k\nR2 a 0 1k\nR3 1 b 1k\nR4 b 0 1k\n' },
  },
  {
    ej: 'ej-2.8', seccion: 'sec-2.7', alimentacion: 10, cartas: ['R'], textos: ['10 kΩ', '10 V'],
    // the load across the lower resistor: three in series also give 3,33 V (review 10d, 10g)
    condiciones: [{ k: 'fuente', valor: 10 }, { k: 'nodo', valor: 3.33, tol: 0.03, nombre: 'la salida con la carga' }, { k: 'divisor', n: 3, valor: 10000 }, { k: 'sobrantes' }],
    ref: { descripcion: 'R<sub>1</sub> = 10 kΩ del + a la salida, R<sub>2</sub> = 10 kΩ de la salida al − y la carga de 10 kΩ en paralelo con R<sub>2</sub>', netlist: 'V1 1 0 dc 10\nR1 1 2 10k\nR2 2 0 10k\nRL 2 0 10k\n' },
  },
  {
    // the book picks 220 Ω for the series resistor; with an E12 load of 270 Ω (18,9 mA) the Zener takes 12,5 mA:
    // its 10 mA are asked within ±30 % so that the book's own choice passes
    ej: 'ej-5.8', seccion: null, alimentacion: 12, cartas: ['R', 'DZ51'], textos: ['12 V', '5,1 V', '20 mA', '10 mA'],
    condiciones: [
      { k: 'fuente', valor: 12 }, { k: 'nodo', valor: 5.1, tol: 0.05, nombre: 'la salida regulada' },
      { k: 'carga', corriente: 0.02, tol: 0.1 }, { k: 'zener', min: 0.007, max: 0.013 }, { k: 'sobrantes' },
    ],
    ref: {
      descripcion: 'R<sub>s</sub> = 220 Ω (el valor comercial del libro) del + a la salida, el Zener de 5,1 V de la salida al − con la franja hacia la salida y una carga de 270 Ω en paralelo con él',
      netlist: 'V1 1 0 dc 12\nRS 1 2 220\nDZ1 0 2 DZ51\nRL 2 0 270\n', modelos: ['DZ51'],
    },
  },
  {
    // the book's own approximation (VB from the unloaded divider) «es buena al 10 %»: that is the tolerance
    ej: 'ej-6.2', seccion: 'sec-6.5', alimentacion: 9, cartas: ['R', 'QN'], textos: ['9 V', '22 kΩ', '4,7 kΩ', '470 Ω', '2,2 kΩ'],
    condiciones: [
      // V_CE = 3,98 V from the book's solution: without R_C the collector current is the same (review 10d)
      // biased by a divider, as the exercise says (review 10g: one base resistor gave the same current)
      { k: 'fuente', valor: 9 }, { k: 'transistor', ic: 0.00188, tol: 0.1, vce: 3.98, divisor: true },
      { k: 'nodo', valor: 1.584, tol: 0.1, nombre: 'la base' }, { k: 'nodo', valor: 0.884, tol: 0.1, nombre: 'el emisor' }, { k: 'sobrantes' },
    ],
    ref: {
      descripcion: 'R<sub>1</sub> = 22 kΩ del + a la base, R<sub>2</sub> = 4,7 kΩ de la base al −, R<sub>C</sub> = 2,2 kΩ del + al colector y R<sub>E</sub> = 470 Ω del emisor al −, con el 2N3904',
      netlist: 'V1 v 0 dc 9\nR1 v b 22k\nR2 b 0 4.7k\nRC v c 2.2k\nRE e 0 470\nQ1 c b e Q2N3904\n', modelos: ['Q2N3904'],
    },
  },
  {
    ej: 'ej-45.1', seccion: 'sec-45.2', alimentacion: 5, cartas: ['R', 'LEDR'], textos: ['2,0 V', '10 mA', '5 V'],
    condiciones: [{ k: 'fuente', valor: 5 }, { k: 'led', corriente: 0.01, tol: 0.1 }, { k: 'sobrantes' }],
    ref: { descripcion: 'una resistencia de 330 Ω en serie con el LED rojo', netlist: 'V1 1 0 dc 5\nR1 1 2 330\nD1 2 0 LEDR\n', modelos: ['LEDR'] },
  },
];

/** The exercise block of the book: statement and solution blocks. */
function ejercicioDelLibro(label) {
  const l = lugares.get(label);
  let hallado = null;
  const visitar = (b) => {
    if (b.t === 'ejercicios') for (const it of b.items) if (it.label === label) hallado = it;
    for (const x of b.bloques ?? []) visitar(x);
  };
  visitar(parte(l.parte).bloques[l.top]);
  return hallado ? { ...hallado, parte: l.parte } : null;
}

async function construyeDe(c) {
  const ej = ejercicios[c.ej];
  const libroEj = ejercicioDelLibro(c.ej);
  if (!ej || !libroEj) throw new Error(`retos10: no está el ${c.ej}`);
  const enunciado = libroEj.bloques.filter((b) => b.t === 'p').map((b) => b.html).join(' ');
  for (const x of c.textos) if (!plano(enunciado).includes(x)) throw new Error(`retos10: «${x}» no está en el enunciado del ${c.ej}`);
  const p = libroEj.parte;
  const sec = c.seccion ? seccionesDe.get(p).find((x) => x.label === c.seccion) : seccionesDe.get(p).find((x) => x.label === ej.seccion);
  if (!sec) throw new Error(`retos10: sección ${c.seccion ?? ej.seccion} de ${p}`);
  const modelos = (c.ref.modelos ?? []).map((n) => MODELOS.find((m) => m.nombre === n).texto).join('\n');
  const texto = netlistMedida(`* referencia ${c.ej}\n${c.ref.netlist}${modelos}\n`);
  simulaciones++;
  const sim = await simularTexto(texto);
  const g = circ.graficaOp(sim);
  if (!g) throw new Error(`retos10: la referencia del ${c.ej} no simula`);
  const r = comprobarConstruccion(c.condiciones, medidaDeOp(texto, circ.vectoresOp(g)));
  if (!r.bien) throw new Error(`retos10: la referencia del ${c.ej} no cumple: ${r.resultados.filter((x) => !x.bien).map((x) => x.mensaje).join(' ')}`);
  const solucion = (libroEj.solucion ?? []).filter((b) => b.t === 'p').map((b) => b.html);
  const donde = `Ejercicio ${libroEj.num}`;
  const l = lugares.get(c.ej);
  return {
    id: `${p}-construye-${c.ej}`,
    tipo: 'construye',
    parte: p,
    seccion: sec.label,
    bloque: c.seccion ? sec.fin - 1 : l.top,
    ref: c.ej,
    verRef: `el ejercicio ${libroEj.num}`,
    enunciado: `Monte en la protoboard un circuito que cumpla el ejercicio ${libroEj.num}.`,
    citas: solucion.length ? [{ html: solucion[0], ref: c.ej, donde: `${donde} · solución` }] : [],
    pistas: [
      ...(ej.pistas ?? []).slice(0, 2).map((h, i) => ({ titulo: i === 0 ? 'El planteamiento del libro' : 'Un resultado intermedio', html: h })),
      { titulo: 'Una solución que cumple', html: `Por ejemplo, ${c.ref.descripcion}.` },
    ],
    ejercicio: { label: c.ej, num: libroEj.num, html: enunciado },
    alimentacion: c.alimentacion,
    cartas: c.cartas,
    condiciones: c.condiciones,
    referencia: { descripcion: c.ref.descripcion, netlist: c.ref.netlist, lecturas: r.resultados.map((x) => x.mensaje) },
  };
}

for (const c of CONSTRUYE) {
  const it = await construyeDe(c);
  if (detalle) console.log(`  ${it.id}: ${it.referencia.lecturas.join(' ')}`);
  (nuevos.get(it.parte) ?? nuevos.set(it.parte, []).get(it.parte)).push(it);
}

// ------------------------------------------------------------------ run and merge

for (const f of figuras) {
  const d = J(f.fig.datos);
  const todos = d.esquemas ?? [];
  for (const k of explorables[f.fig.datos]) {
    const esq = todos[k];
    if (!esq?.simulacion?.simulable || esq.elementos.some((e) => ONDAS.has(e.rol))) continue;
    const its = await retosDe(f, todos, esq, k);
    if (!its.length) console.warn(`retos10: sin reto para ${f.fig.datos}#${k}`);
    for (const it of its) (nuevos.get(it.parte) ?? nuevos.set(it.parte, []).get(it.parte)).push(it);
  }
}

const dir = path.join(libro, 'practica');
const ind = JSON.parse(fs.readFileSync(path.join(dir, 'indice.json'), 'utf8'));
const partesTocadas = new Set([...nuevos.keys()]);
for (const p of ind.partes) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, `${p}.json`), 'utf8'));
  if (d.items.some((x) => x.tipo === 'reto' || x.tipo === 'construye')) partesTocadas.add(p);
}
let total = 0;
for (const p of [...partesTocadas].sort()) {
  const fichero = path.join(dir, `${p}.json`);
  const d = fs.existsSync(fichero) ? JSON.parse(fs.readFileSync(fichero, 'utf8')) : { version: 1, parte: p, items: [], secciones: {} };
  const viejos = new Set(d.items.filter((x) => x.tipo === 'reto' || x.tipo === 'construye').map((x) => x.id));
  d.items = d.items.filter((x) => !viejos.has(x.id));
  for (const s of Object.values(d.secciones)) s.items = s.items.filter((id) => !viejos.has(id));
  for (const it of nuevos.get(p) ?? []) {
    d.items.push(it);
    const s = (d.secciones[it.seccion] ??= { items: [], ideas: [] });
    // a lesson shows at most two challenges, never one that repeats the section's slider (same knob and quantity)
    const repite = s.items.some((id) => {
      const x = d.items.find((y) => y.id === id);
      return x?.tipo === 'deslizador' && it.tipo === 'reto' && it.mandos.length === 1 && x.cambio.id === it.mandos[0].id && x.observa.id === it.observa.id && x.fuente.k === 'figura' && x.fuente.datos === it.fuente.datos;
    });
    if (it.tipo === 'construye' || (!repite && s.items.filter((id) => id.includes('-reto-')).length < 2)) s.items.push(it.id);
    total++;
  }
  for (const [k, s] of Object.entries(d.secciones)) if (!s.items.length && !s.ideas.length) delete d.secciones[k];
  // canonical order: rerunning this step alone after averias10 must not move its items after the faults (QA 1.0)
  fs.writeFileSync(fichero, JSON.stringify(ordenarPractica(d)));
  if (!ind.partes.includes(p) && d.items.length) ind.partes.push(p);
}
ind.partes.sort((a, b) => ordenPartes.indexOf(a) - ordenPartes.indexOf(b));
// counts of the index (the whole set, as practica10.mjs writes them)
const contar = recontarIndice(dir, ind, ['reto', 'construye']);
fs.writeFileSync(path.join(dir, 'indice.json'), JSON.stringify(ind));
const capitulos = new Set([...nuevos.keys()]);
console.log(`retos10: ${contar.reto ?? 0} retos con la figura y ${contar.construye ?? 0} de montar; ${total} en ${capitulos.size} partes (${[...capitulos].join(', ')}), ${simulaciones} simulaciones.`);
