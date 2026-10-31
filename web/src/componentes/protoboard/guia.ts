// «Monta este circuito» (0.11), the logic: a finished board (a built-in circuit or the auto-placement of a
// book circuit) becomes a plan of steps — put this part with its legs in these strips, lay a wire from this
// strip to that one, simulate — and every change of the board is checked against it: which steps are done,
// which one comes next, and, for a part or wire that does not fit the plan, what is wrong in one Spanish
// sentence (a reversed LED, a leg one strip off, a wire to the wrong rail) and how to fix it. A step is done
// by the strips (conductors) its legs or ends are in, not the exact holes, as on a real board. Plain
// TypeScript: the page (guia.svelte.ts) and the Node checks share it.

import { textoValor } from '../editor/catalogo.ts';
import { conductorEn, conexiones, type ConexionesProto } from './conexiones.ts';
import { encapsuladoDe, EXTERNOS } from './encapsulados.ts';
import { agujero, ALTO_PLACA, SIGNO_RIEL, type Pt } from './placa.ts';
import { clavePin, type CableProto, type DocumentoProtoboard, type Pieza } from './tipos.ts';
import { GUIADOS, objetivoGuiado, type CircuitoGuiado } from './guiados.ts';

export type PasoGuia =
  | { tipo: 'pieza'; clave: string; pieza: Pieza; texto: string; porQue: string }
  | { tipo: 'cable'; clave: string; a: Pt; b: Pt; color: string; texto: string; porQue: string }
  | { tipo: 'simular'; clave: 'simular'; texto: string; porQue: string };

/** A step before its «why» is written. */
type SinPorQue<T> = T extends unknown ? Omit<T, 'porQue'> : never;

export interface PlanGuia {
  /** Built-in circuit id, or «libro» for the circuit the board was opened with. */
  id: string;
  titulo: string;
  /** The board the user starts from (supply and its leads; the rails bridged). */
  inicio: DocumentoProtoboard;
  objetivo: DocumentoProtoboard;
  pasos: PasoGuia[];
  /** What the simulation shows when it works. */
  final: string;
  prueba: { led?: string; red?: string };
}

export interface EstadoGuia {
  /** Done or not, per step (the «simular» step is the page's to mark). */
  hechos: boolean[];
  /** First step not done (pasos.length when all are). */
  actual: number;
  /** The piece or wire put last that fits no step, and why (Spanish), with a fix. */
  error: { texto: string; id: string; arreglo: 'voltear' | 'quitar' | 'mover' } | null;
}

// ------------------------------------------------------------------ words

const cfgDe = (d: DocumentoProtoboard) => ({ placas: d.placas, columnas: d.columnas });

/** «la resistencia R1 de 330 Ω», «el LED D1», «el chip 74HC00 (CI1)». */
export function nombrePieza(p: Pieza): string {
  const c = p.comp;
  if (p.chip) return `el chip ${c.campos['modelo'] ?? ''} (${c.nombre})`;
  const valor = ['R', 'C', 'L', 'POT', 'V'].includes(c.tipo) ? textoValor(c) : '';
  const de = valor ? ` de ${valor}` : '';
  const color = c.tipo === 'LED' ? (/v/i.test(c.campos['modelo'] ?? '') ? ' verde' : /a|b/i.test((c.campos['modelo'] ?? '').replace(/^LED/i, '')) ? '' : ' rojo') : '';
  const ARTICULO: Record<string, string> = {
    R: 'la resistencia', C: p.enc === 'electrolitico' ? 'el electrolítico' : 'el condensador', L: 'la bobina', LED: 'el LED', D: 'el diodo', DZ: 'el zener',
    QN: 'el transistor', QP: 'el transistor', MN: 'el MOSFET', MP: 'el MOSFET', PULNA: 'el pulsador', PULNC: 'el pulsador', SW: 'el interruptor',
    CONM: 'el conmutador', POT: 'el potenciómetro', LDR: 'la LDR', T555: 'el 555', OA: 'el operacional', OA5: 'el operacional', ZUMB: 'el zumbador',
  };
  const art = ARTICULO[c.tipo] ?? 'la pieza';
  const modelo = c.tipo === 'QN' || c.tipo === 'QP' ? ` ${(c.campos['modelo'] ?? '').replace(/^Q/, '')}` : '';
  return `${art}${color}${modelo} ${c.nombre}${de}`;
}

/** «a10», «el carril + (rojo) de arriba», «el borne + de la fuente». */
export function nombreHueco(doc: DocumentoProtoboard, q: Pt): string {
  const a = agujero(cfgDe(doc), q[0], q[1]);
  if (!a) {
    for (const p of doc.piezas)
      if (EXTERNOS.has(p.enc)) {
        const i = p.pos.findIndex((t) => t[0] === q[0] && t[1] === q[1]);
        if (i >= 0) return `el borne ${encapsuladoDe(p.comp).nombres[i]} de ${p.comp.nombre}`;
      }
    return 'fuera de la placa';
  }
  if (a.tipo === 'riel') {
    const f = Number(a.fila);
    return `el carril ${SIGNO_RIEL[f]} (${SIGNO_RIEL[f] === '+' ? 'rojo' : 'azul'}) de ${f < 2 ? 'arriba' : 'abajo'}`;
  }
  return `${a.fila}${a.x}`;
}

/** Where a conductor is, for the error messages: «la columna 12 (filas a–e)», «el carril −…». */
function nombreTira(doc: DocumentoProtoboard, q: Pt): string {
  const a = agujero(cfgDe(doc), q[0], q[1]);
  if (!a || a.tipo === 'riel') return nombreHueco(doc, q);
  return `la columna ${a.x} (filas ${(a.y % ALTO_PLACA) <= 7 ? 'a–e' : 'f–j'})`;
}

function textoPieza(doc: DocumentoProtoboard, p: Pieza): string {
  const e = encapsuladoDe(p.comp);
  const h = (q: Pt) => nombreHueco(doc, q);
  let donde: string;
  if (p.enc === 'dip') {
    const xs = p.pos.map((q) => q[0]);
    donde = `a caballo del canal central, de la columna ${Math.min(...xs)} a la ${Math.max(...xs)}, con la muesca a la ${p.pos[0]![0] <= p.pos[p.pos.length / 2 - 1]![0] ? 'izquierda' : 'derecha'}`;
  } else if (p.enc === 'led') donde = `la pata larga (ánodo) en ${h(p.pos[0]!)} y la corta en ${h(p.pos[1]!)}`;
  else if (p.enc === 'electrolitico') {
    const mas = p.polo ?? 0;
    donde = `la pata + en ${h(p.pos[mas]!)} y la de la franja (−) en ${h(p.pos[1 - mas]!)}`;
  } else if (p.pos.length === 2) donde = `con las patas en ${h(p.pos[0]!)} y ${h(p.pos[1]!)}`;
  else {
    const usadas = p.pos.map((q, i) => ({ q, n: e.nombres[i] ?? '' })).filter((_, i) => !!p.patas[i]);
    const conNombre = usadas.every((x) => /[a-z]/i.test(x.n));
    const partes = usadas.map((x) => (conNombre ? `${x.n} en ${h(x.q)}` : h(x.q)));
    const lista = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : (partes[0] ?? '');
    donde = conNombre ? lista : `con las patas en ${lista}`;
  }
  return `Coloque ${nombrePieza(p)}${donde.startsWith('con ') ? ' ' : ': '}${donde}.`;
}

// ------------------------------------------------------------------ plans

/** Symmetric parts: their legs may go either way round. */
function simetrica(p: Pieza): boolean {
  if (p.enc === 'electrolitico') return false;
  return ['R', 'C', 'L', 'LDR', 'NTC', 'PTC', 'PULNA', 'PULNC', 'XTAL', 'LAMP'].includes(p.comp.tipo);
}

const esPunta = (doc: DocumentoProtoboard, w: CableProto) =>
  doc.piezas.some((p) => EXTERNOS.has(p.enc) && p.pos.some((t) => (t[0] === w.a[0] && t[1] === w.a[1]) || (t[0] === w.b[0] && t[1] === w.b[1])));
const esPuente = (doc: DocumentoProtoboard, w: CableProto) => {
  const cfg = cfgDe(doc);
  return agujero(cfg, w.a[0], w.a[1])?.tipo === 'riel' && agujero(cfg, w.b[0], w.b[1])?.tipo === 'riel';
};

/** Names of the schematic nets of a part's legs: «vcc» and «b». */
function redesDe(con: ConexionesProto, p: Pieza): string[] {
  const n = new Set<string>();
  for (const pin of p.patas) {
    if (!pin) continue;
    const r = con.redes[con.redDePin.get(clavePin(p, pin)) ?? -1]?.nombre;
    if (r) n.add(r === '0' ? 'masa' : `«${r}»`);
  }
  return [...n];
}

function crearPlan(id: string, titulo: string, objetivo: DocumentoProtoboard, orden: string[] | null, porQue: (clave: string, paso: SinPorQue<PasoGuia>) => string, final: string, prueba: PlanGuia['prueba']): PlanGuia {
  const inicio: DocumentoProtoboard = JSON.parse(JSON.stringify(objetivo)) as DocumentoProtoboard;
  inicio.piezas = inicio.piezas.filter((p) => EXTERNOS.has(p.enc));
  inicio.cables = inicio.cables.filter((w) => !w.id.startsWith('g:') && (esPunta(objetivo, w) || esPuente(objetivo, w)));
  const enPlaca = objetivo.piezas.filter((p) => !EXTERNOS.has(p.enc));
  const cables = objetivo.cables.filter((w) => !inicio.cables.some((x) => x.id === w.id));
  const pasoPieza = (p: Pieza): PasoGuia => {
    const base = { tipo: 'pieza' as const, clave: p.comp.nombre, pieza: p, texto: textoPieza(objetivo, p) };
    return { ...base, porQue: porQue(p.comp.nombre, base) };
  };
  const pasoCable = (w: CableProto): PasoGuia => {
    const clave = w.id.startsWith('g:') ? w.id.slice(2) : w.id;
    const base = { tipo: 'cable' as const, clave, a: w.a, b: w.b, color: w.color, texto: `Tienda un cable desde ${nombreHueco(objetivo, w.a)} hasta ${nombreHueco(objetivo, w.b)}: toque un agujero y luego el otro.` };
    return { ...base, porQue: porQue(clave, base) };
  };
  const pasos: PasoGuia[] = [];
  if (orden) {
    for (const k of orden) {
      const p = enPlaca.find((x) => x.comp.nombre === k);
      const w = cables.find((x) => x.id === `g:${k}`);
      if (p) pasos.push(pasoPieza(p));
      else if (w) pasos.push(pasoCable(w));
    }
  } else {
    // Each part, then the wires both of whose strips already have something (a leg, a rail, a lead).
    const cfg = cfgDe(objetivo);
    const activos = new Set<string>();
    for (const w of inicio.cables) for (const q of [w.a, w.b]) {
      const a = agujero(cfg, q[0], q[1]);
      if (a) activos.add(a.nodo);
    }
    const tiene = (q: Pt) => {
      const a = agujero(cfg, q[0], q[1]);
      return !a || a.tipo === 'riel' || activos.has(a.nodo);
    };
    const pendientes = [...cables];
    for (const p of enPlaca) {
      pasos.push(pasoPieza(p));
      for (const q of p.pos) {
        const a = agujero(cfg, q[0], q[1]);
        if (a) activos.add(a.nodo);
      }
      for (let i = 0; i < pendientes.length; ) {
        const w = pendientes[i]!;
        if (tiene(w.a) && tiene(w.b)) {
          pasos.push(pasoCable(w));
          for (const q of [w.a, w.b]) {
            const a = agujero(cfg, q[0], q[1]);
            if (a) activos.add(a.nodo);
          }
          pendientes.splice(i, 1);
        } else i++;
      }
    }
    for (const w of pendientes) pasos.push(pasoCable(w));
  }
  const pulsar = enPlaca.find((p) => (p.comp.tipo === 'PULNA' && p.comp.campos['pulsado'] !== 'si') || (p.comp.tipo === 'PULNC' && p.comp.campos['pulsado'] === 'si'));
  pasos.push({
    tipo: 'simular',
    clave: 'simular',
    texto: pulsar && prueba.led ? `Pulse «Simular» y después toque dos veces el pulsador ${pulsar.comp.nombre} para apretarlo.` : 'Pulse «Simular» para ver si funciona.',
    porQue: 'La simulación resuelve el circuito tal como está montado: si algo no estuviera bien unido, se notaría.',
  });
  inicio.titulo = titulo;
  return { id, titulo, inicio, objetivo, pasos, final, prueba };
}

/** The plan of a built-in circuit. */
export function planGuiado(g: CircuitoGuiado): PlanGuia {
  const objetivo = objetivoGuiado(g);
  return crearPlan(g.id, g.titulo, objetivo, g.montaje?.orden ?? null, (k) => g.porQue[k] ?? '', g.final, g.prueba);
}

export const planPorId = (id: string): PlanGuia | null => {
  const g = GUIADOS.find((x) => x.id === id);
  return g ? planGuiado(g) : null;
};

/** The plan of the circuit a board was opened with («Ver en protoboard»): the auto-placement is the target. */
export function planDeMontaje(objetivo: DocumentoProtoboard, titulo: string): PlanGuia {
  const obj = JSON.parse(JSON.stringify(objetivo)) as DocumentoProtoboard;
  const con = conexiones(obj);
  const porQue = (_: string, paso: SinPorQue<PasoGuia>): string => {
    if (paso.tipo === 'pieza') {
      const r = redesDe(con, paso.pieza);
      return r.length > 1
        ? `En el esquema, ${paso.pieza.comp.nombre} une ${r.slice(0, -1).join(', ')} y ${r[r.length - 1]}: cada pata va a una tira de ese nudo, porque una tira es un nudo del esquema.`
        : `Cada pata de ${paso.pieza.comp.nombre} va a la tira de su nudo del esquema.`;
    }
    if (paso.tipo === 'cable') {
      const c = conductorEn(obj, paso.a[0], paso.a[1]);
      const i = c ? con.redDeConductor.get(c) : undefined;
      const r = i != null ? con.redes[i]?.nombre : undefined;
      return `Un nudo del esquema${r ? ` («${r === '0' ? 'masa' : r}»)` : ''} puede ocupar varias tiras: el cable las une.`;
    }
    return '';
  };
  return crearPlan('libro', titulo, obj, null, porQue, 'El montaje corresponde al esquema del libro.', {});
}

// ------------------------------------------------------------------ checking

function equivalentes(cu: string | null, ct: string | null, con: ConexionesProto): boolean {
  if (!cu || !ct) return false;
  if (cu === ct) return true;
  // Rails count by what they are joined to (the empty board bridges the top rails to the bottom ones).
  if (cu.startsWith('R') && ct.startsWith('R')) {
    const a = con.redDeConductor.get(cu);
    return a != null && a === con.redDeConductor.get(ct);
  }
  return false;
}

/** Legs of a placed part against the plan's (null when they match; else the first leg out of place). */
function comparar(doc: DocumentoProtoboard, con: ConexionesProto, objetivo: DocumentoProtoboard, p: Pieza, t: Pieza, alReves: boolean): number | null {
  const n = t.pos.length;
  if (p.pos.length !== n) return 0;
  for (let i = 0; i < n; i++) {
    const j = alReves ? n - 1 - i : i;
    if (!t.patas[j] && !p.patas[i]) continue;
    const cu = conductorEn(doc, p.pos[i]![0], p.pos[i]![1]);
    const ct = conductorEn(objetivo, t.pos[j]![0], t.pos[j]![1]);
    if (!equivalentes(cu, ct, con)) return i;
  }
  return null;
}

function cableHace(doc: DocumentoProtoboard, con: ConexionesProto, objetivo: DocumentoProtoboard, w: CableProto, paso: { a: Pt; b: Pt }): boolean {
  const ua = conductorEn(doc, w.a[0], w.a[1]);
  const ub = conductorEn(doc, w.b[0], w.b[1]);
  const ta = conductorEn(objetivo, paso.a[0], paso.a[1]);
  const tb = conductorEn(objetivo, paso.b[0], paso.b[1]);
  return (equivalentes(ua, ta, con) && equivalentes(ub, tb, con)) || (equivalentes(ua, tb, con) && equivalentes(ub, ta, con));
}

/** Done steps, the next one and what is wrong with the last thing put that fits no step. */
export function evaluar(plan: PlanGuia, doc: DocumentoProtoboard, con: ConexionesProto = conexiones(doc), simulado = false, recientes: string[] = []): EstadoGuia {
  const base = new Set([...plan.inicio.piezas.map((p) => p.id), ...plan.inicio.cables.map((w) => w.id)]);
  const usados = new Set<string>();
  const hechos = plan.pasos.map((paso) => {
    if (paso.tipo === 'simular') return simulado;
    if (paso.tipo === 'pieza') {
      const t = paso.pieza;
      const p = doc.piezas.find((x) => !base.has(x.id) && !usados.has(x.id) && x.comp.nombre.toUpperCase() === t.comp.nombre.toUpperCase() && (comparar(doc, con, plan.objetivo, x, t, false) == null || (simetrica(t) && comparar(doc, con, plan.objetivo, x, t, true) == null)));
      if (p) usados.add(p.id);
      return !!p;
    }
    const w = doc.cables.find((x) => !base.has(x.id) && !usados.has(x.id) && cableHace(doc, con, plan.objetivo, x, paso));
    if (w) usados.add(w.id);
    return !!w;
  });
  // Steps go in order, but a later one done early still counts.
  const k = hechos.findIndex((h) => !h);
  const actual = k < 0 ? plan.pasos.length : k;
  // The last thing put that is not part of a done step.
  let error: EstadoGuia['error'] = null;
  const extras = [...doc.piezas.filter((p) => !base.has(p.id) && !usados.has(p.id)), ...doc.cables.filter((w) => !base.has(w.id) && !usados.has(w.id))];
  // (`recientes`: ids in the order they were put, newest last; else by the number in the id)
  const orden = (id: string) => {
    const i = recientes.lastIndexOf(id);
    return i >= 0 ? 1e9 + i : numero(id);
  };
  const ultimo = extras.sort((a, b) => orden(b.id) - orden(a.id))[0];
  if (ultimo) error = explicar(plan, doc, con, ultimo, actual);
  return { hechos, actual, error };
}

const numero = (id: string) => Number(/(\d+)$/.exec(id)?.[1] ?? 0);

function explicar(plan: PlanGuia, doc: DocumentoProtoboard, con: ConexionesProto, x: Pieza | CableProto, actual: number): EstadoGuia['error'] {
  const paso = plan.pasos[actual];
  if ('comp' in x) {
    const t = plan.pasos.find((s): s is Extract<PasoGuia, { tipo: 'pieza' }> => s.tipo === 'pieza' && s.pieza.comp.nombre.toUpperCase() === x.comp.nombre.toUpperCase())?.pieza;
    if (!t) return { texto: `${x.comp.nombre} no forma parte de este montaje: quítela.`, id: x.id, arreglo: 'quitar' };
    if (!simetrica(t) && comparar(doc, con, plan.objetivo, x, t, true) == null) {
      const texto =
        t.enc === 'led'
          ? `${x.comp.nombre} está al revés: la pata larga (ánodo) va en ${nombreTira(plan.objetivo, t.pos[0]!)}. Un LED al revés no se enciende. Pulse «Voltear».`
          : t.enc === 'electrolitico'
            ? `${x.comp.nombre} está al revés: la franja (−) va hacia ${nombreTira(plan.objetivo, t.pos[1 - (t.polo ?? 0)]!)}. Un electrolítico al revés se estropea. Pulse «Voltear».`
            : t.enc === 'diodo' || t.enc === 'zener'
              ? `${x.comp.nombre} está al revés: la franja (cátodo) va en ${nombreTira(plan.objetivo, t.pos[1]!)}. Pulse «Voltear».`
              : t.enc === 'dip'
                ? `${x.comp.nombre} está girado: la muesca (y la patilla 1) va al otro lado. Pulse «Voltear».`
                : `${x.comp.nombre} está al revés: sus patas van en el orden contrario (${encapsuladoDe(t.comp).nombres.filter(Boolean).join('-')}). Pulse «Voltear».`;
      return { texto, id: x.id, arreglo: 'voltear' };
    }
    const i = comparar(doc, con, plan.objetivo, x, t, false) ?? 0;
    const nombres = encapsuladoDe(t.comp).nombres;
    const pata = x.pos.length === 2 ? (i === 0 ? 'una pata' : 'la otra pata') : `la pata ${nombres[i] || i + 1}`;
    const destino = t.pos[i] ? nombreTira(plan.objetivo, t.pos[i]!) : 'su sitio';
    const aqui = nombreTira(doc, x.pos[i]!);
    return { texto: `Casi: ${pata} de ${x.comp.nombre} está en ${aqui} y va en ${destino}, donde brillan los agujeros. Arrástrela allí.`, id: x.id, arreglo: 'mover' };
  }
  const une = `Ese cable une ${nombreTira(doc, x.a)} con ${nombreTira(doc, x.b)}`;
  if (paso?.tipo === 'cable') return { texto: `${une}; este paso pide unir ${nombreTira(plan.objetivo, paso.a)} con ${nombreTira(plan.objetivo, paso.b)}. Quítelo y pruebe otra vez.`, id: x.id, arreglo: 'quitar' };
  return { texto: `${une}, y ningún paso lo pide${paso?.tipo === 'pieza' ? `: ahora toca colocar ${paso.pieza.comp.nombre}` : ''}.`, id: x.id, arreglo: 'quitar' };
}
