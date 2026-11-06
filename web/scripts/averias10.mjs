#!/usr/bin/env node
// 1.0 «Encuentre la avería»: fault-finding cases on the live schematics of the book (libro/explorables.json: simulable
// in DC, values known). Each case is the figure's own circuit with one faulty part (open, short, value ×10 or ×0,1,
// reversed diode, open base-emitter junction); the reader measures with a virtual multimeter — the app simulates the
// faulty netlist with its ngspice (componentes/practica/averias.ts netlistAveria) — and names the part and the fault.
//
//   node scripts/averias10.mjs [--detalle] [--revision FICHERO]
//
// Runs after retos10.mjs (contenido/generar.py) and adds `averia` items to libro/practica/<parte>.json and the counts
// of practica/indice.json, removing the previous run's first (idempotent). Rules, all checked here with the app's
// ngspice in Node:
//   - the faulty circuit converges and gives sensible values (no node beyond 100 kV);
//   - it is diagnosable: some node voltage against ground, or some part's current, differs from the healthy circuit
//     by a clear margin (≥ 0,3 V and 15 %, or ≥ 10 µA and 15 %: averias.ts `difiere`);
//   - it is unambiguous: no other candidate fault of the same drawing (another part, or another fault of the same
//     part) gives the same readings everywhere (every node within 50 mV or 2 %, every current within 2 %);
//   - the book's stored simulation of the healthy figure (what the reader compares with) agrees with the app's.
// At most three cases per drawing (different parts and kinds first). Only the cases approved by hand in
// contenido/averias_curado.json are written; `--revision FICHERO` writes every candidate with its key symptom for that
// review. Deterministic.
import fs from 'node:fs';
import path from 'node:path';
import {
  J, libro, src, ordenPartes, parte, seccionesDe, citaFigura, verRef, plano, valorTexto, motor, nombrePieza, etiquetaNodo, recorteDe,
  ordenarPractica, recontarIndice, contenidoDir, encuadreDe,
} from './libro-node.mjs';

const args = process.argv.slice(2);
const detalle = args.includes('--detalle');
const revision = args.includes('--revision') ? args[args.indexOf('--revision') + 1] : null;
const circ = await import(src('componentes/practica/circuito.ts'));
const { netlistAveria, averiasDe, NOMBRE_AVERIA, difiere, tensionEntre, corrienteDe } = await import(src('componentes/practica/averias.ts'));
const { ONDAS } = await import(src('componentes/figuras-vivas/esquema/netlist.ts'));
const simularTexto = await motor();
const explorables = J('explorables.json').esquemas;
const curadoFich = path.join(contenidoDir, 'averias_curado.json');
const curado = fs.existsSync(curadoFich) ? JSON.parse(fs.readFileSync(curadoFich, 'utf8')).casos : {};
let simulaciones = 0;

async function op(esq, texto, meta) {
  simulaciones++;
  try {
    const r = circ.resultadoFigura(esq, meta, await simularTexto(texto));
    if (!r || Object.values(r.nodos).some((v) => v != null && Math.abs(v) > 1e5)) return null;
    return r;
  } catch {
    return null;
  }
}

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const ORDEN_TIPO = ['abierta', 'corto', 'reves', 'base-abierta', 'alto', 'bajo'];

/** Measurement points: every node of the drawing with a name (its label, «masa», or a letter) and a place. */
function puntosDe(todos, esq, base) {
  const A = esq.dibujo_a_svg;
  const r = [];
  let letra = 0;
  // without a ground symbol the netlist takes the source's negative terminal as reference: that node is «masa» here
  let refSinMasa = null;
  if (!esq.nodos.some((n) => n.tierra)) {
    const f = esq.elementos.find((e) => ['V', 'BAT', 'I'].includes(e.rol) && e.polaridad && e.puntos_terminal);
    const term = f ? (f.rol === 'I' ? f.polaridad.entra : f.polaridad.negativo) : null;
    const pid = term ? f.puntos_terminal[term] : null;
    refSinMasa = esq.puntos.find((q) => q.id === pid)?.nodo ?? null;
  }
  for (const n of esq.nodos) {
    if (base.nodos[n.id] == null) continue;
    // where to draw it: the middle of its longest wire, else one of its points (a terminal)
    const tramos = esq.tramos.filter((t) => t.nodo === n.id && t.puntos?.length);
    const suyos = esq.puntos.filter((q) => q.nodo === n.id);
    let p = null;
    if (tramos.length) {
      const t = tramos.reduce((a, b) => ((b.longitud ?? 0) > (a.longitud ?? 0) ? b : a));
      p = t.puntos[Math.floor(t.puntos.length / 2)];
    } else if (suyos.length) p = suyos[0].xy;
    if (!p) continue;
    const xy = [Number((A.sx * p[0] + A.tx).toFixed(2)), Number((A.sy * p[1] + A.ty).toFixed(2))];
    if (n.tierra || n.id === refSinMasa) {
      if (!r.some((x) => x.masa)) r.push({ nodo: n.id, nombre: n.tierra ? 'masa' : 'el borne − de la fuente', xy, masa: true });
      continue;
    }
    const h = etiquetaNodo(todos, n);
    r.push({ nodo: n.id, nombre: h ? plano(h) : `punto ${LETRAS[letra++]}`, xy });
  }
  return r;
}

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

const candidatos = []; // every case that passed the automatic checks
for (const { p, sec, top, fig } of figuras) {
  const figura = J(fig.datos).esquemas ?? [];
  for (const k of explorables[fig.datos]) {
    const esq = figura[k];
    if (!esq?.simulacion?.simulable || esq.elementos.some((e) => ONDAS.has(e.rol))) continue;
    const recorte = recorteDe(fig, esq);
    const todos = recorte ? [esq] : figura;
    const { texto: tSano, meta: mSano } = circ.netlistFiguraCon(esq, {});
    const base = await op(esq, tSano, mSano);
    if (!base) {
      if (detalle) console.log(`  ${fig.datos}#${k}: no simula`);
      continue;
    }
    const libroOp = esq.simulacion.op;
    const puntos = puntosDe(todos, esq, base);
    const masa = puntos.find((x) => x.masa);
    if (!masa || puntos.length < 3) {
      if (detalle) console.log(`  ${fig.datos}#${k}: ${masa ? 'menos de tres puntos' : 'sin masa'}`);
      continue;
    }
    // the book's healthy readings agree with the app's (what the reader compares with)
    if (puntos.some((x) => !(Math.abs((libroOp?.nodos?.[x.nodo] ?? NaN) - base.nodos[x.nodo]) <= Math.max(0.02, 0.01 * Math.abs(base.nodos[x.nodo]))))) {
      if (detalle) console.log(`  ${fig.datos}#${k}: la simulación del libro no coincide`, puntos.map((x) => [x.nodo, libroOp?.nodos?.[x.nodo], base.nodos[x.nodo]]));
      continue;
    }
    const piezas = [];
    for (const e of esq.elementos) {
      const tipos = averiasDe(e.rol);
      if (!tipos.length || e.discontinuo) continue;
      if (e.rol === 'R' && !e.valor) continue;
      const n = nombrePieza(todos, e);
      if (!n.unico || !n.html) continue;
      piezas.push({ id: e.id, nombre: plano(n.html), html: n.html, tipos, rol: e.rol });
    }
    if (piezas.length < 2) {
      if (detalle) console.log(`  ${fig.datos}#${k}: menos de dos piezas con nombre`);
      continue;
    }
    const ramas = piezas.filter((x) => x.rol !== 'QN' && x.rol !== 'QP').map((x) => ({ id: x.id, nombre: x.nombre }));
    const vector = (r) => [...puntos.map((x) => tensionEntre(r, x.nodo, masa.nodo) ?? NaN), ...ramas.map((x) => corrienteDe(r, x.id) ?? 0)];
    const vb = vector(base);
    const fallos = [];
    for (const pz of piezas) {
      for (const tipo of pz.tipos) {
        let r = null;
        try {
          const { texto, meta } = netlistAveria(esq, { elemento: pz.id, tipo });
          r = await op(esq, texto, meta);
        } catch {
          r = null;
        }
        if (r) fallos.push({ pz, tipo, r, v: vector(r) });
      }
    }
    const igual = (a, b) =>
      a.every((x, i) => {
        const y = b[i];
        const corriente = i >= puntos.length;
        return Math.abs(x - y) <= (corriente ? Math.max(1e-6, 0.02 * Math.abs(y)) : Math.max(0.05, 0.02 * Math.abs(y)));
      });
    for (const f of fallos) {
      // diagnosable: a clear difference from the healthy circuit somewhere
      const dif = f.v.map((x, i) => (difiere(vb[i], x, i >= puntos.length ? 'A' : 'V') ? Math.abs(x - vb[i]) / Math.max(Math.abs(vb[i]), i >= puntos.length ? 1e-4 : 0.1) : 0));
      if (!dif.some((x) => x > 0)) continue;
      // unambiguous: nothing else reads the same
      if (fallos.some((g) => g !== f && igual(f.v, g.v))) continue;
      const iv = dif.slice(0, puntos.length).reduce((m, x, i) => (x > dif[m] ? i : m), 0);
      const clave = dif[iv] > 0 ? puntos[iv] : null;
      if (!clave || clave.masa) continue;
      candidatos.push({ p, sec, top, fig, k, esq, recorte, puntos, ramas, piezas, f, clave, vb, masa });
    }
  }
}

// at most three per drawing: different parts and kinds first, then the clearest
const porDibujo = new Map();
for (const c of candidatos) {
  const key = `${c.fig.datos}#${c.k}`;
  (porDibujo.get(key) ?? porDibujo.set(key, []).get(key)).push(c);
}
const elegidos = [];
for (const lista of porDibujo.values()) {
  lista.sort((a, b) => ORDEN_TIPO.indexOf(a.f.tipo) - ORDEN_TIPO.indexOf(b.f.tipo) || a.f.pz.id.localeCompare(b.f.pz.id));
  const usadosPieza = new Set();
  const usadosTipo = new Set();
  const tomar = [];
  for (const c of lista) {
    if (tomar.length >= 3) break;
    if (usadosPieza.has(c.f.pz.id) || usadosTipo.has(c.f.tipo)) continue;
    tomar.push(c);
    usadosPieza.add(c.f.pz.id);
    usadosTipo.add(c.f.tipo);
  }
  elegidos.push(...tomar);
}

const idDe = (c) => `${c.p}-averia-${c.fig.label}-${c.k}-${c.f.pz.id}-${c.f.tipo}`;
function resumen(c) {
  const v = (n) => tensionEntre(c.f.r, n, c.masa.nodo);
  const s = (n) => tensionEntre({ nodos: c.esq.simulacion.op.nodos }, n, c.masa.nodo);
  return `${c.f.pz.nombre}: ${NOMBRE_AVERIA[c.f.tipo].toLowerCase()} → en ${c.clave.nombre} ${valorTexto(v(c.clave.nodo), 'V')} (sano ${valorTexto(s(c.clave.nodo), 'V')})`;
}
if (revision) {
  const out = elegidos.map((c) => {
    const lecturas = c.puntos.filter((x) => !x.masa).map((x) => `${x.nombre}: ${valorTexto(tensionEntre(c.f.r, x.nodo, c.masa.nodo), 'V')} (sano ${valorTexto(c.esq.simulacion.op.nodos[x.nodo] - c.esq.simulacion.op.nodos[c.masa.nodo], 'V')})`);
    const corrientes = c.ramas.map((x) => `I(${x.nombre}): ${valorTexto(corrienteDe(c.f.r, x.id), 'A')}`);
    return `${idDe(c)}\n  figura ${c.fig.num}; piezas: ${c.piezas.map((x) => x.nombre).join(', ')}\n  ${resumen(c)}\n  ${lecturas.join('; ')}\n  ${corrientes.join('; ')}`;
  });
  fs.writeFileSync(revision, out.join('\n') + '\n');
}

// ------------------------------------------------------------------ items (approved cases only) and merge

const items = new Map();
let pendientes = 0;
let aprobados = 0;
for (const c of elegidos) {
  const id = idDe(c);
  const d = curado[id];
  if (!d) {
    pendientes++;
    if (detalle) console.warn(`  sin revisar: ${id} — ${resumen(c)}`);
    continue;
  }
  if (!d.ok) continue;
  aprobados++;
  const cf = citaFigura(c.p, c.sec, c.fig, c.top);
  // what is shown: the schematic without cut texts, notes or the healthy circuit's readings (QA 1.0)
  const enc = encuadreDe(c.fig, c.esq);
  const fuente = { k: 'figura', datos: c.fig.datos, esquema: c.k, figura: c.fig.label, num: c.fig.num, src: c.fig.src, vista: c.fig.svg_vista, recorte: enc?.recorte ?? c.recorte, ...(enc?.ocultar.length ? { ocultar: enc.ocultar } : {}) };
  const it = {
    id,
    tipo: 'averia',
    parte: c.p,
    seccion: c.sec.label,
    bloque: c.top,
    ref: c.fig.label,
    verRef: verRef(c.fig.label),
    enunciado: `En este montaje de la figura ${c.fig.num} hay una pieza averiada. Mida con el polímetro y diga cuál es y qué le pasa.`,
    citas: cf,
    pistas: [
      { titulo: 'Lo que dice el libro', html: cf[0].html },
      { titulo: 'Por dónde empezar', html: `Mida la tensión en ${c.clave.nombre} respecto a masa y compárela con la del circuito sano de la figura.` },
      { titulo: 'La pieza', html: `Fíjese en ${c.f.pz.html}.` },
    ],
    fuente,
    averia: { elemento: c.f.pz.id, tipo: c.f.tipo },
    piezas: c.piezas.map((x) => ({ id: x.id, nombre: x.nombre, tipos: x.tipos })),
    puntos: c.puntos,
    ramas: c.ramas,
    clave: c.clave.nodo,
  };
  (items.get(c.p) ?? items.set(c.p, []).get(c.p)).push(it);
}

const dir = path.join(libro, 'practica');
const ind = JSON.parse(fs.readFileSync(path.join(dir, 'indice.json'), 'utf8'));
const tocar = new Set([...items.keys()]);
for (const p of ind.partes) if (JSON.parse(fs.readFileSync(path.join(dir, `${p}.json`), 'utf8')).items.some((x) => x.tipo === 'averia')) tocar.add(p);
for (const p of [...tocar].sort()) {
  const fichero = path.join(dir, `${p}.json`);
  const d = JSON.parse(fs.readFileSync(fichero, 'utf8'));
  const viejos = new Set(d.items.filter((x) => x.tipo === 'averia').map((x) => x.id));
  d.items = d.items.filter((x) => !viejos.has(x.id));
  for (const s of Object.values(d.secciones)) s.items = s.items.filter((id) => !viejos.has(id));
  for (const it of items.get(p) ?? []) {
    d.items.push(it);
    const s = (d.secciones[it.seccion] ??= { items: [], ideas: [] });
    // a lesson shows one fault-finding case
    if (!s.items.some((id) => id.includes('-averia-'))) s.items.push(it.id);
  }
  for (const [k, s] of Object.entries(d.secciones)) if (!s.items.length && !s.ideas.length) delete d.secciones[k];
  fs.writeFileSync(fichero, JSON.stringify(ordenarPractica(d)));
}
recontarIndice(dir, ind, ['averia']);
fs.writeFileSync(path.join(dir, 'indice.json'), JSON.stringify(ind));
console.log(
  `averias10: ${candidatos.length} averías diagnosticables y sin ambigüedad, ${elegidos.length} propuestas, ${aprobados} aprobadas en la revisión` +
    `${pendientes ? `, ${pendientes} sin revisar (contenido/averias_curado.json)` : ''}; ${simulaciones} simulaciones.`,
);
