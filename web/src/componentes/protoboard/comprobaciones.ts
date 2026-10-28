// Didactic checks of a breadboard, in plain Spanish, that never block anything: a source with its two
// terminals joined (a short across the supply), a part shorted by its own strip, an LED, diode or
// electrolytic the wrong way round (against the schematic it came from, or by the voltages), a transistor
// or IC turned round, a pin of an IC left floating, legs out of the holes, two leads in one hole, and how
// the board compares with its original schematic. With an operating point (after «Simular»), LEDs in
// reverse and electrolytics with reverse voltage are named too. Plain TypeScript.

import { nombrePin } from '../editor/netlist.ts';
import { type ConexionesProto } from './conexiones.ts';
import { encapsuladoDe, EXTERNOS, rotuloPin } from './encapsulados.ts';
import { agujero, nombreAgujero, type Pt } from './placa.ts';
import { clavePin, compsDe, type DocumentoProtoboard, type Pieza } from './tipos.ts';

export type Nivel = 'error' | 'aviso' | 'info' | 'bien';

export interface Observacion {
  nivel: Nivel;
  texto: string;
  /** Pieces concerned (to select them). */
  piezas: string[];
  /** Holes to point at. */
  puntos?: Pt[];
}

/** Operating point: node voltages (net name → V) and LED/diode currents (instance → A). */
export interface PuntoTrabajo {
  v: Record<string, number>;
  i: Record<string, number>;
}

const POLARES = new Set(['led', 'diodo', 'zener']);

function nombrePinPieza(p: Pieza, pin: string): string {
  const e = encapsuladoDe(p.comp);
  const i = p.patas.indexOf(pin);
  if (p.chip && i >= 0) {
    const [id, pn] = pin.split('|');
    const g = p.chip.comps.find((c) => c.id === id);
    return `la patilla ${i + 1} (${rotuloPin(pn ?? '').toUpperCase()} de ${g?.nombre ?? 'una puerta'})`;
  }
  if (p.enc === 'dip' && i >= 0) return `la patilla ${i + 1} (${nombrePin(pin)})`;
  if (p.enc === 'to92' || p.enc === 'to220' || p.enc === 'to126') return `el ${nombrePin(pin)}`;
  if (POLARES.has(p.enc)) return pin === 'start' ? 'el ánodo' : 'el cátodo';
  return `la pata ${e.nombres[i] ?? nombrePin(pin)}`;
}

/** Same conductor (strip or rail) for two legs? */
function mismaTira(doc: DocumentoProtoboard, a: Pt, b: Pt): string | null {
  const cfg = { placas: doc.placas, columnas: doc.columnas };
  const x = agujero(cfg, a[0], a[1]);
  const y = agujero(cfg, b[0], b[1]);
  return x && y && x.nodo === y.nodo ? (x.tipo === 'riel' ? 'el mismo carril' : `la misma tira (columna ${x.x})`) : null;
}

export function comprobar(doc: DocumentoProtoboard, con: ConexionesProto, op: PuntoTrabajo | null = null): Observacion[] {
  const res: Observacion[] = [];
  const cfg = { placas: doc.placas, columnas: doc.columnas };
  const orig = doc.original ?? {};
  const hayOriginal = Object.keys(orig).length > 0;
  const red = (p: Pieza, pin: string) => {
    const i = con.redDePin.get(clavePin(p, pin));
    return i == null ? null : con.redes[i]!;
  };
  const tension = (nombre: string | undefined | null): number | null => (nombre != null && op && nombre in op.v ? op.v[nombre]! : nombre === '0' ? 0 : null);

  for (const p of doc.piezas) {
    const externo = EXTERNOS.has(p.enc);
    // Shorts across sources.
    if (externo && (p.enc === 'alimentacion' || p.enc === 'generador')) {
      const a = red(p, 'end');
      const b = red(p, 'start');
      if (a && b && a === b)
        res.push({
          nivel: 'error',
          texto: `Cortocircuito: los dos bornes de ${p.comp.nombre} están unidos${a.nombre === '0' ? ' a la masa' : ''}. Una fuente real se calentaría o saltaría su protección; ngspice no podrá resolverlo.`,
          piezas: [p.id],
        });
      continue;
    }
    if (externo) continue;
    const pines = [...new Set(p.patas.filter((x): x is string => !!x))];

    // Pins joined that the schematic keeps apart.
    for (let i = 0; i < pines.length; i++)
      for (let j = i + 1; j < pines.length; j++) {
        const [a, b] = [pines[i]!, pines[j]!];
        const ra = red(p, a);
        if (!ra || ra !== red(p, b)) continue;
        const oa = orig[clavePin(p, a)];
        const ob = orig[clavePin(p, b)];
        if (hayOriginal && oa != null && oa === ob) continue;
        const la = p.pos[p.patas.indexOf(a)]!;
        const lb = p.pos[p.patas.indexOf(b)]!;
        const donde = mismaTira(doc, la, lb);
        if (!donde && !hayOriginal) continue;
        const quien = p.patas.length === 2 && pines.length === 2 ? `${p.comp.nombre} está cortocircuitado: sus dos patas` : `${p.comp.nombre}: ${nombrePinPieza(p, a)} y ${nombrePinPieza(p, b)}`;
        res.push({ nivel: 'aviso', texto: `${quien} están en ${donde ?? 'la misma red (las une un cable)'}.`, piezas: [p.id], puntos: [la, lb] });
      }

    // Turned round against the schematic: the same nets, in another order.
    if (hayOriginal && pines.length >= 2) {
      const actuales = pines.map((x) => red(p, x)?.nombre ?? '');
      const originales = pines.map((x) => orig[clavePin(p, x)] ?? '');
      const iguales = actuales.every((n, k) => n === originales[k]);
      const mismas = [...actuales].sort().join('|') === [...originales].sort().join('|') && new Set(actuales).size === actuales.length;
      if (!iguales && mismas && originales.every(Boolean)) {
        let texto: string;
        if (p.enc === 'led') texto = `El LED ${p.comp.nombre} está al revés: la pata larga (ánodo) debe ir a «${orig[`${p.id}.start`]}». Así no se enciende.`;
        else if (POLARES.has(p.enc)) texto = `El diodo ${p.comp.nombre} está al revés: la franja (cátodo) debe ir a «${orig[`${p.id}.end`]}».`;
        else if (p.enc === 'dip') texto = `${p.comp.nombre} está girado: la muesca y la patilla 1 deben quedar al otro lado.`;
        else if (p.enc === 'to92' || p.enc === 'to220' || p.enc === 'to126') texto = `${p.comp.nombre} tiene las patas cambiadas respecto al esquema (está girado o su modelo tiene otro patillaje: ${encapsuladoDe(p.comp).nombres.join('-')}).`;
        else if (p.enc === 'trimmer') texto = `${p.comp.nombre} está girado: sus extremos están cambiados (el cursor se mueve al revés).`;
        else texto = `${p.comp.nombre} está conectado al revés respecto al esquema.`;
        res.push({ nivel: POLARES.has(p.enc) || p.enc === 'dip' ? 'aviso' : 'info', texto, piezas: [p.id] });
      }
    }

    // LEDs and electrolytics by the voltages (operating point, or the supplies).
    if (p.enc === 'led') {
      const va = tension(red(p, p.patas[0]!)?.nombre);
      const vk = tension(red(p, p.patas[1]!)?.nombre);
      if (va != null && vk != null && va - vk < -0.5)
        res.push({ nivel: 'aviso', texto: `El LED ${p.comp.nombre} está polarizado en inversa (${(va - vk).toFixed(2).replace('.', ',')} V entre ánodo y cátodo): no se enciende. ¿Está al revés?`, piezas: [p.id] });
      else if (red(p, p.patas[0]!)?.nombre === '0' && !hayOriginal)
        res.push({ nivel: 'aviso', texto: `El ánodo (pata larga) del LED ${p.comp.nombre} está en la masa: así no puede encenderse.`, piezas: [p.id] });
    }
    if (p.enc === 'electrolitico') {
      const mas = p.patas[p.polo ?? 0]!;
      const menos = p.patas[1 - (p.polo ?? 0)]!;
      const vm = tension(red(p, mas)?.nombre);
      const vn = tension(red(p, menos)?.nombre);
      if (vm != null && vn != null && vm - vn < -0.3)
        res.push({ nivel: 'aviso', texto: `El electrolítico ${p.comp.nombre} está polarizado al revés (${(vm - vn).toFixed(2).replace('.', ',')} V): la franja (−) debe ir a la tensión más baja. Uno real puede hincharse o reventar.`, piezas: [p.id] });
    }

    // 74HC chips: inputs in the air (CMOS) and the supply.
    if (p.chip) {
      const c = chipSinConectar(doc, con, p);
      const modelo = p.comp.campos['modelo'] ?? '';
      if (c.flotantes.length) {
        const n = c.flotantes.map((i) => i + 1);
        const lista = n.length === 1 ? `la entrada de la patilla ${n[0]} está` : `las entradas de las patillas ${n.slice(0, -1).join(', ')} y ${n[n.length - 1]} están`;
        res.push({
          nivel: 'aviso',
          texto: `${p.comp.nombre} (${modelo}): ${lista} al aire. Una entrada CMOS al aire capta ruido, cambia sola y hace que el chip consuma y se caliente: llévela a un carril (+ o −) o a una señal. El simulador no lo nota.`,
          piezas: [p.id],
          puntos: c.flotantes.map((i) => p.pos[i]!),
        });
      }
      for (const x of c.rotas) res.push({ nivel: 'aviso', texto: x.texto, piezas: [p.id], puntos: [p.pos[x.pata]!] });
      if (c.sinVcc || c.sinGnd) {
        const iv = p.chip.roles.indexOf('vcc');
        const ig = p.chip.roles.indexOf('gnd');
        const falta = c.sinVcc && c.sinGnd ? 'no está alimentado' : c.sinVcc ? 'no tiene Vcc' : 'no tiene masa';
        res.push({
          nivel: 'aviso',
          texto: `${p.comp.nombre} (${modelo}) ${falta}: la patilla ${iv + 1} (Vcc) va al carril + de 5 V y la ${ig + 1} (GND) al carril − (masa). El simulador no lo necesita, pero un chip real sin alimentar no funciona.`,
          piezas: [p.id],
          puntos: [...(c.sinVcc ? [p.pos[iv]!] : []), ...(c.sinGnd ? [p.pos[ig]!] : [])],
        });
      }
    }

    // Floating pins.
    for (const pin of p.chip ? [] : pines) {
      const r = red(p, pin);
      if (!r) continue;
      if (r.pines.length + r.bornes.length > 1) continue;
      const k = clavePin(p, pin);
      const o = orig[k];
      if (o != null && Object.values(orig).filter((x) => x === o).length < 2) continue;
      const ic = p.enc === 'dip';
      res.push({
        nivel: ic ? 'aviso' : 'info',
        texto: ic ? `${p.comp.nombre}: ${nombrePinPieza(p, pin)} está al aire (no la toca nada). Una entrada al aire capta ruido y el integrado hace cosas raras.` : `${p.comp.nombre}: ${nombrePinPieza(p, pin)} no está conectada a nada.`,
        piezas: [p.id],
        puntos: [p.pos[p.patas.indexOf(pin)]!],
      });
    }
    // Ideal op-amps: the supply legs.
    const e = encapsuladoDe(p.comp);
    if (e.alimentacion) {
      const sin = Object.keys(e.alimentacion).filter((i) => {
        const q = p.pos[Number(i)];
        const a = q ? agujero(cfg, q[0], q[1]) : null;
        return !a || con.redDeConductor.get(a.nodo) == null;
      });
      if (sin.length)
        res.push({ nivel: 'info', texto: `${p.comp.nombre} es un operacional ideal: el simulador no necesita su alimentación, pero en un montaje real la patilla 7 va a +V y la 4 a −V (o a masa).`, piezas: [p.id] });
    }
  }

  // Equipment leads.
  for (const p of doc.piezas) {
    if (!EXTERNOS.has(p.enc)) continue;
    p.patas.forEach((pin, i) => {
      if (!pin) return;
      const r = red(p, pin);
      if (r && r.pines.length + r.bornes.length > 1) return;
      const q = p.pos[i]!;
      const conCable = doc.cables.some((w) => (w.a[0] === q[0] && w.a[1] === q[1]) || (w.b[0] === q[0] && w.b[1] === q[1]));
      res.push({ nivel: 'aviso', texto: `${conCable ? 'La punta' : 'El borne'} ${encapsuladoDe(p.comp).nombres[i]} de ${p.comp.nombre} no llega a ningún punto del circuito.`, piezas: [p.id] });
    });
  }

  // Mechanics.
  for (const s of con.sueltas) {
    const p = doc.piezas.find((x) => x.id === s.pieza);
    if (p) res.push({ nivel: 'aviso', texto: `${p.comp.nombre}: una pata no está metida en ningún agujero.`, piezas: [p.id], puntos: [p.pos[s.pata]!] });
  }
  if (con.extremosSueltos.length) res.push({ nivel: 'aviso', texto: `Hay ${con.extremosSueltos.length === 1 ? 'un extremo de cable' : `${con.extremosSueltos.length} extremos de cable`} fuera de los agujeros.`, piezas: con.extremosSueltos.map((x) => x.cable) });
  for (const q of con.dobles) res.push({ nivel: 'aviso', texto: `Dos patas o cables en el mismo agujero (${nombreAgujero(cfg, q[0], q[1])}): en una protoboard real no caben.`, piezas: [], puntos: [q] });

  // Against the original schematic.
  if (hayOriginal) {
    const porOriginal = new Map<string, Set<string>>();
    const porActual = new Map<string, Set<string>>();
    const vivos = new Set(doc.piezas.flatMap((p) => [p.id, ...compsDe(p).map((c) => c.id)]));
    for (const [pin, nombre] of Object.entries(orig)) {
      if (!vivos.has(pin.split('.')[0]!)) continue;
      const i = con.redDePin.get(pin);
      if (i == null) continue;
      const actual = con.redes[i]!.nombre;
      (porOriginal.get(nombre) ?? porOriginal.set(nombre, new Set()).get(nombre)!).add(actual);
      (porActual.get(actual) ?? porActual.set(actual, new Set()).get(actual)!).add(nombre);
    }
    const partidas = [...porOriginal].filter(([, s]) => s.size > 1).map(([n]) => n);
    const unidas = [...porActual].filter(([, s]) => s.size > 1).map(([, s]) => [...s]);
    const quitadas = [...new Set(Object.keys(orig).map((k) => k.split('.')[0]!))].filter((id) => !vivos.has(id));
    const nombre = (n: string) => (n === '0' ? 'masa (0)' : `«${n}»`);
    if (!partidas.length && !unidas.length && !quitadas.length) res.push({ nivel: 'bien', texto: 'El montaje corresponde al esquema original.', piezas: [] });
    for (const n of partidas.slice(0, 4)) res.push({ nivel: 'aviso', texto: `La red ${nombre(n)} del esquema está partida en la protoboard: falta algún cable entre sus tiras.`, piezas: [] });
    for (const s of unidas.slice(0, 4)) res.push({ nivel: 'aviso', texto: `Las redes ${s.map(nombre).join(' y ')} del esquema están unidas en la protoboard.`, piezas: [] });
    if (quitadas.length) res.push({ nivel: 'info', texto: `Se han quitado ${quitadas.length === 1 ? 'una pieza' : `${quitadas.length} piezas`} del esquema original.`, piezas: [] });
  }
  const orden: Record<Nivel, number> = { error: 0, aviso: 1, info: 2, bien: 3 };
  return res.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}

/**
 * What a 74HC chip lacks on the board: inputs touching nothing (a used input alone in its net, a spare one
 * whose tie was removed: leg indices), Vcc not on a bench supply's + and GND not on ground, and the board-only
 * wires of a T flip-flop (74HC74 + XOR of a 74HC86, D = T ⊕ Q) that are missing (Spanish texts).
 */
export function chipSinConectar(doc: DocumentoProtoboard, con: ConexionesProto, p: Pieza): { flotantes: number[]; sinVcc: boolean; sinGnd: boolean; rotas: { pata: number; texto: string }[] } {
  const cfg = { placas: doc.placas, columnas: doc.columnas };
  const mas = new Set(doc.piezas.filter((x) => x.enc === 'alimentacion').map((x) => `${x.id}.end`));
  const res = { flotantes: [] as number[], sinVcc: false, sinGnd: false, rotas: [] as { pata: number; texto: string }[] };
  const grupoDe = (x: Pieza, i: number): number | undefined => {
    const q = x.pos[i];
    const a = q ? agujero(cfg, q[0], q[1]) : null;
    return a ? con.grupo.get(a.nodo) : undefined;
  };
  const nombreDe = (id: string) => doc.piezas.flatMap(compsDe).find((c) => c.id === id)?.nombre ?? id;
  p.chip?.roles.forEach((rol, i) => {
    const q = p.pos[i];
    const a = q ? agujero(cfg, q[0], q[1]) : null;
    const ri = a ? con.redDeConductor.get(a.nodo) : undefined;
    const r = ri == null ? null : con.redes[ri]!;
    const pin = p.patas[i];
    const t = p.chip!.ataduras[i];
    if (t && typeof t === 'object' && 'pin' in t) {
      // Q of a T flip-flop into its XOR.
      const g = grupoDe(p, i);
      if (g == null || g !== con.grupo.get(`P:${t.pin}`)) {
        const [id, qpin] = t.pin.split('.') as [string, string];
        const dueno = doc.piezas.find((x) => x.patas.includes(`${id}|${qpin}`));
        const donde = dueno ? ` (patilla ${dueno.patas.indexOf(`${id}|${qpin}`) + 1} del ${dueno.comp.nombre})` : '';
        res.rotas.push({
          pata: i,
          texto: `Falta el cable de Q del biestable T ${nombreDe(id)}${donde} a la patilla ${i + 1} del ${p.comp.nombre}, entrada de su XOR: el biestable T se monta con D = T ⊕ Q y sin ese cable no cambia como debe.`,
        });
      }
      return;
    }
    if (t && typeof t === 'object' && 'interna' in t) {
      // XOR output → D of a T flip-flop: reported once, from the XOR's side (or from D when its XOR is gone).
      const otros = doc.piezas.flatMap((x) => (x.chip ? x.chip.roles.flatMap((ro, j) => (x === p && j === i ? [] : (() => { const u = x.chip!.ataduras[j]; return u && typeof u === 'object' && 'interna' in u && u.interna === t.interna ? [{ x, j, ro }] : []; })())) : []));
      const id = t.interna.split(':')[0]!;
      if (rol === 'in' && otros.some((o) => o.ro === 'out')) return;
      const o = otros[0];
      if (o && grupoDe(p, i) != null && grupoDe(p, i) === grupoDe(o.x, o.j)) return;
      const salida = rol === 'out' ? { x: p, j: i } : o ? { x: o.x, j: o.j } : null;
      const d = rol === 'in' ? { x: p, j: i } : o ? { x: o.x, j: o.j } : null;
      res.rotas.push({
        pata: i,
        texto:
          salida && d
            ? `Falta el cable entre la salida de la XOR (patilla ${salida.j + 1} del ${salida.x.comp.nombre}) y D del biestable T ${nombreDe(id)} (patilla ${d.j + 1} del ${d.x.comp.nombre}): el 74HC74 solo hace de biestable T con D = T ⊕ Q.`
            : `${p.comp.nombre}: el biestable T ${nombreDe(id)} necesita su XOR (D = T ⊕ Q) y ${rol === 'out' ? 'su D' : 'esa XOR'} ya no está en la placa.`,
      });
      return;
    }
    if (rol === 'in') {
      if (!r || (pin && r.pines.length + r.bornes.length <= 1)) res.flotantes.push(i);
    } else if (rol === 'vcc') {
      if (!r || !r.pines.some((k) => mas.has(k))) res.sinVcc = true;
    } else if (rol === 'gnd') {
      if (!r || r.nombre !== '0') res.sinGnd = true;
    }
  });
  return res;
}

/** LED brightness 0–1 from the operating point (current, or the voltage across it). */
export function brillos(doc: DocumentoProtoboard, con: ConexionesProto, op: PuntoTrabajo | null, instancias: Map<string, string>): Record<string, number> {
  const res: Record<string, number> = {};
  if (!op) return res;
  for (const p of doc.piezas) {
    if (p.enc !== 'led') continue;
    const inst = instancias.get(p.id);
    let i = inst ? op.i[inst.toLowerCase()] : undefined;
    if (i == null) {
      const ra = con.redDePin.get(`${p.id}.${p.patas[0]}`);
      const rk = con.redDePin.get(`${p.id}.${p.patas[1]}`);
      const va = ra != null ? op.v[con.redes[ra]!.nombre] : undefined;
      const vk = rk != null ? op.v[con.redes[rk]!.nombre] : undefined;
      if (va == null || vk == null) continue;
      const d = va - vk;
      i = d > 1.6 ? Math.min(0.03, (d - 1.6) * 0.05) : 0;
    }
    if (i > 2e-4) res[p.id] = Math.max(0.15, Math.min(1, Math.log10(i / 2e-4) / Math.log10(100)));
  }
  return res;
}
