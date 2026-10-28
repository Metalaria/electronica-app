// «¿Qué quieres medir?» on the breadboard (0.10): a tutor, not an autopilot. For each measurement it lists
// what you would do with the real Brymen BM869s or FNIRSI 2C53T, step by step (turn the dial to…, move the
// red lead to the … jack, put the red probe on…, open the circuit here and put the meter in series…), shows
// where (the dial position or the jack lit on the instrument, the holes lit on the board), ticks each step as
// the user does it with the real controls, and explains mistakes as a teacher would, with what to do
// instead. «Hazlo por mí» exists only as a last resort: it does the remaining steps one by one, visibly.

import { BM_POSICIONES, type Borne } from '../instrumentos/motor/dmm.ts';
import type { GuiaBrymen, GuiaFnirsi } from '../instrumentos/guia.ts';
import { nombrePin } from '../editor/netlist.ts';
import { agujero, agujerosDe, clavePt, type Pt } from './placa.ts';
import { encapsuladoDe, EXTERNOS } from './encapsulados.ts';
import { clavePin, type Pieza } from './tipos.ts';
import type { Protoboard } from './estado.svelte';
import type { MedidaProtoboard, PuntaProto } from './medida.svelte.ts';

export type Tarea = 'tension' | 'tensionPieza' | 'corriente' | 'resistencia' | 'senal' | 'escuchar';

export const TAREAS: { id: Tarea; titulo: string; detalle: string }[] = [
  { id: 'tension', titulo: 'Tensión entre dos puntos', detalle: 'Con el polímetro, en paralelo' },
  { id: 'tensionPieza', titulo: 'Tensión de una pieza', detalle: 'Las puntas en sus dos patas' },
  { id: 'corriente', titulo: 'Corriente por una pieza', detalle: 'Abriendo el circuito: en serie' },
  { id: 'resistencia', titulo: 'Resistencia de una pieza', detalle: 'Sin alimentación' },
  { id: 'senal', titulo: 'Ver la señal en un punto', detalle: 'Con el osciloscopio' },
  { id: 'escuchar', titulo: 'Escuchar un punto', detalle: 'Con un auricular' },
];

export type { GuiaBrymen, GuiaFnirsi };

export interface Paso {
  id: string;
  /** What to do (Spanish, may contain the instrument's own names). */
  texto: string;
  /** Why, in one line (optional). */
  porque?: string;
  hecho: () => boolean;
  /** The lead the user is «holding» in this step (the chooser selects it). */
  punta?: PuntaProto;
  /** Holes lit on the board for this step. */
  puntos?: () => Pt[];
  bm?: GuiaBrymen;
  fn?: GuiaFnirsi;
  /** «Hazlo por mí»: do this step (null when it is the user's choice). */
  hacer?: (() => void) | null;
}

export interface ErrorMedida {
  texto: string;
  /** A button with what to do instead. */
  accion?: { etiqueta: string; hacer: () => void };
}

const posIndice = (id: string) => BM_POSICIONES.findIndex((p) => p.id === id);
const TENSION = new Set(['vdc', 'vac', 'vfd', 'mvdc', 'mvac']);

/** Name of a leg of a piece, for the texts («la pata 1», «el colector», «el ánodo», «el borne +»). */
export function nombrePata(p: Pieza, i: number): string {
  const e = encapsuladoDe(p.comp);
  const pin = p.patas[i];
  if (EXTERNOS.has(p.enc)) return `el borne ${e.nombres[i] ?? i + 1}`;
  if (p.enc === 'led' || p.enc === 'diodo' || p.enc === 'zener') return i === 0 ? 'el ánodo' : 'el cátodo';
  if (p.enc === 'electrolitico') return i === (p.polo ?? 0) ? 'la pata +' : 'la pata −';
  if (pin && ['collector', 'base', 'emitter', 'gate', 'drain', 'source'].includes(pin)) return `${pin === 'base' || pin === 'gate' || pin === 'source' ? 'la' : 'el'} ${nombrePin(pin)}`;
  if (p.enc === 'dip') return `la patilla ${i + 1}`;
  return `la pata ${e.nombres[i] ?? i + 1}`;
}

export class Tutor {
  tarea = $state<Tarea | null>(null);
  /** The piece (or wire) the measurement is about. */
  objetivo = $state<{ tipo: 'pieza' | 'cable'; id: string } | null>(null);
  /** Current measurement: the net of each leg when it was chosen (to know where the opened leg came from). */
  private redesAntes = $state<string[]>([]);
  private posAntes: Pt[] = [];
  /** AUTO pressed on the oscilloscope since the probe was placed. */
  autoPulsado = $state(false);
  /** «Hazlo por mí» running. */
  haciendo = $state(false);
  private pb: Protoboard;
  private m: MedidaProtoboard;

  constructor(pb: Protoboard, m: MedidaProtoboard) {
    this.pb = pb;
    this.m = m;
  }

  get b() {
    return this.m.b;
  }

  empezar(t: Tarea | null): void {
    this.tarea = t;
    this.objetivo = null;
    this.redesAntes = [];
    this.posAntes = [];
    this.cableAntes = null;
    this.autoPulsado = false;
  }

  /** The piece of the measurement, when it is one. */
  get pieza(): Pieza | null {
    const o = this.objetivo;
    return o?.tipo === 'pieza' ? (this.pb.pieza(o.id) ?? null) : null;
  }

  /** Waiting for the user to choose a piece. */
  get esperaObjetivo(): boolean {
    return (this.tarea === 'tensionPieza' || this.tarea === 'resistencia' || this.tarea === 'corriente') && !this.objetivo;
  }

  /** A tap on a piece or a wire while the tutor waits for one. Returns a message, or null if not taken. */
  elegir(o: { t: 'pieza' | 'cable'; id: string }): string | null {
    if (!this.esperaObjetivo) return null;
    if (o.t === 'cable') {
      if (this.tarea !== 'corriente') return 'Elija una pieza (un cable no tiene tensión ni resistencia que medir).';
      this.objetivo = { tipo: 'cable', id: o.id };
      this.cableAntes = this.extremoCable();
      return 'Cable elegido: se medirá la corriente que pasa por él.';
    }
    const p = this.pb.pieza(o.id);
    if (!p) return null;
    if (p.chip) return `${p.comp.nombre} es un chip: elija dos puntos con «Tensión entre dos puntos».`;
    if (this.tarea === 'corriente' && (p.pos.length !== 2 || EXTERNOS.has(p.enc)))
      return EXTERNOS.has(p.enc) ? `Para la corriente de ${p.comp.nombre} elija uno de sus cables (el rojo o el negro).` : `Elija una pieza de dos patas (o un cable): en ${p.comp.nombre} la corriente de cada pata es distinta.`;
    this.objetivo = { tipo: 'pieza', id: p.id };
    this.redesAntes = p.pos.map((q) => this.m.nodoEn(q) ?? '');
    this.posAntes = p.pos.map((q) => [q[0], q[1]] as Pt);
    return `${p.comp.nombre} elegida.`;
  }

  /** The two points of the piece the probes go to (red first). */
  private patasObjetivo(): Pt[] {
    const p = this.pieza;
    if (!p) return [];
    if (p.pos.length === 2) {
      // Electrolytics: red on +.
      if (p.enc === 'electrolitico' && (p.polo ?? 0) === 1) return [p.pos[1]!, p.pos[0]!];
      return [p.pos[0]!, p.pos[1]!];
    }
    // Transistors: collector–emitter (drain–source); the first two legs otherwise.
    const i = p.patas.findIndex((x) => x === 'collector' || x === 'drain');
    const j = p.patas.findIndex((x) => x === 'emitter' || x === 'source');
    if (i >= 0 && j >= 0) return [p.pos[i]!, p.pos[j]!];
    return [p.pos[0]!, p.pos[1]!];
  }

  private indicePata(q: Pt): number {
    const p = this.pieza;
    return p ? p.pos.findIndex((x) => x[0] === q[0] && x[1] === q[1]) : -1;
  }

  // ---------------------------------------------------------------- the board

  /** Points taken by legs, wire ends and probes. */
  private ocupados(): Set<string> {
    const s = new Set<string>();
    for (const p of this.pb.doc.piezas) if (!EXTERNOS.has(p.enc)) for (const q of p.pos) s.add(clavePt(q[0], q[1]));
    for (const w of this.pb.doc.cables) for (const q of [w.a, w.b]) s.add(clavePt(q[0], q[1]));
    for (const q of Object.values(this.m.puntas)) if (q) s.add(clavePt(q[0], q[1]));
    return s;
  }

  /** Free holes of the conductor (strip or rail) at a point; an equipment terminal is its own point. */
  huecosJunto(q: Pt): Pt[] {
    const cfg = { placas: this.pb.doc.placas, columnas: this.pb.doc.columnas };
    const a = agujero(cfg, q[0], q[1]);
    if (!a) return [q];
    const oc = this.ocupados();
    const libres = agujerosDe(cfg, a.nodo).filter(([x, y]) => !oc.has(clavePt(x, y)));
    return libres.sort((u, v) => Math.hypot(u[0] - q[0], u[1] - q[1]) - Math.hypot(v[0] - q[0], v[1] - q[1])).slice(0, a.tipo === 'riel' ? 4 : 5);
  }

  /** Holes of the ground rails (for the ground clip and the black probe). */
  private huecosMasa(): Pt[] {
    const cfg = { placas: this.pb.doc.placas, columnas: this.pb.doc.columnas };
    const oc = this.ocupados();
    const res: Pt[] = [];
    for (const i of [1, 2]) for (const q of agujerosDe(cfg, `R0:${i}`)) if (!oc.has(clavePt(q[0], q[1])) && this.m.nodoEn(q) === '0') res.push(q);
    return res.slice(0, 6);
  }

  /** An empty strip next to a leg (or wire end), for opening the circuit there. */
  private tiraLibreCerca(q: Pt, alcance: number, ancla?: Pt): Pt | null {
    const cfg = { placas: this.pb.doc.placas, columnas: this.pb.doc.columnas };
    const oc = this.ocupados();
    let mejor: { p: Pt; d: number } | null = null;
    for (let dx = -8; dx <= 8; dx++) {
      if (!dx) continue;
      const x = q[0] + dx;
      const a = agujero(cfg, x, q[1]);
      if (!a || a.tipo !== 'tira') continue;
      if (this.pb.con.redDeConductor.has(a.nodo)) continue;
      const huecos = agujerosDe(cfg, a.nodo);
      if (huecos.some(([hx, hy]) => oc.has(clavePt(hx, hy)))) continue;
      const p: Pt = [x, q[1]];
      if (ancla && Math.hypot(p[0] - ancla[0], p[1] - ancla[1]) > alcance) continue;
      const d = Math.abs(dx);
      if (!mejor || d < mejor.d) mejor = { p, d };
    }
    return mejor?.p ?? null;
  }

  /** «la pata 1 de R1», «masa», «la red out», for a point of the board. */
  describir(q: Pt | undefined): string {
    if (!q) return '—';
    const n = this.m.nodoEn(q);
    if (n === '0') return 'masa';
    const cfg = { placas: this.pb.doc.placas, columnas: this.pb.doc.columnas };
    const a = agujero(cfg, q[0], q[1]);
    for (const p of this.pb.doc.piezas)
      for (let i = 0; i < p.pos.length; i++) {
        const l = p.pos[i]!;
        const mismo = a ? agujero(cfg, l[0], l[1])?.nodo === a.nodo : l[0] === q[0] && l[1] === q[1];
        if (mismo && p.patas[i] && !p.chip) return `${nombrePata(p, i)} de ${p.comp.nombre}`;
      }
    return n ? `la red ${n}` : 'una tira vacía';
  }

  // ---------------------------------------------------------------- opening the circuit (current)

  /** Index of the leg that was taken out of its strip (alone now), or −1. */
  private pataAbierta(): number {
    const p = this.pieza;
    if (!p) return -1;
    for (let i = 0; i < p.patas.length; i++) {
      const pin = p.patas[i];
      if (!pin) continue;
      const r = this.pb.con.redes[this.pb.con.redDePin.get(clavePin(p, pin)) ?? -1];
      if (r && r.pines.length === 1 && !r.bornes.length && this.redesAntes[i]) return i;
    }
    return -1;
  }

  private cableAbierto(): { e: 'a' | 'b'; antes: string; ahora: string | null } | null {
    const o = this.objetivo;
    if (o?.tipo !== 'cable') return null;
    const w = this.pb.cable(o.id);
    if (!w) return null;
    // The end that was moved: its old strip (remembered) no longer has the wire's net.
    const ant = this.cableAntes;
    if (!ant) return null;
    const viejo = this.m.nodoEn(ant.q);
    const ahora = this.m.nodoEn(w[ant.e]);
    if (w[ant.e][0] === ant.q[0] && w[ant.e][1] === ant.q[1]) return null;
    if (viejo && ahora && viejo !== ahora) return { e: ant.e, antes: viejo, ahora };
    return null;
  }
  /** The board end of the chosen wire before it was moved. */
  private cableAntes: { e: 'a' | 'b'; q: Pt } | null = null;

  private extremoCable(): { e: 'a' | 'b'; q: Pt } | null {
    const o = this.objetivo;
    if (o?.tipo !== 'cable') return null;
    const w = this.pb.cable(o.id);
    if (!w) return null;
    const cfg = { placas: this.pb.doc.placas, columnas: this.pb.doc.columnas };
    // The end in a hole (an equipment lead has its other end on a terminal).
    const e: 'a' | 'b' = agujero(cfg, w.b[0], w.b[1]) ? 'b' : 'a';
    return { e, q: w[e] };
  }

  /** The leg to take out for an ammeter: one in a strip (a leg in a rail would leave its strip), the second if both. */
  private pataParaAbrir(p: Pieza): number {
    const cfg = { placas: this.pb.doc.placas, columnas: this.pb.doc.columnas };
    const enTira = (i: number) => agujero(cfg, p.pos[i]![0], p.pos[i]![1])?.tipo === 'tira';
    return enTira(1) ? 1 : enTira(0) ? 0 : 1;
  }

  /** Where the leg would go (an empty strip within reach of the other leg). */
  private destinoAbrir(p: Pieza): { i: number; q: Pt } | null {
    const i = this.pataParaAbrir(p);
    const q = this.tiraLibreCerca(p.pos[i]!, encapsuladoDe(p.comp).span?.[1] ?? 6, p.pos[1 - i]!);
    return q ? { i, q } : null;
  }

  private abrir(): void {
    const o = this.objetivo;
    if (!o) return;
    if (o.tipo === 'pieza') {
      const p = this.pieza;
      if (!p) return;
      const d = this.destinoAbrir(p);
      const i = d?.i ?? 1;
      const q = d?.q;
      if (q) this.pb.moverPata(p.id, i, q);
      else this.pb.mensaje = 'No hay una tira libre al lado: deje sitio y saque la pata a mano.';
    } else {
      const ex = this.extremoCable();
      if (!ex) return;
      this.cableAntes = ex;
      const q = this.tiraLibreCerca(ex.q, 99);
      if (q) this.pb.moverExtremo(o.id, ex.e, q);
    }
  }

  // ---------------------------------------------------------------- the steps

  get pasos(): Paso[] {
    const t = this.tarea;
    if (!t) return [];
    const b = this.m.b;
    const bm = b.brymen;
    const f = b.fnirsi;
    const nodo = (p: PuntaProto) => this.m.nodoDe(p);
    const poner = (p: PuntaProto, q: Pt | undefined) => {
      if (!q) return;
      this.m.activa = p;
      this.m.colocar(q);
    };
    const pasos: Paso[] = [];
    const elegirPieza: Paso = {
      id: 'pieza',
      texto: t === 'corriente' ? 'Toque en la protoboard la pieza (o el cable) cuya corriente quiere medir.' : 'Toque en la protoboard la pieza que quiere medir.',
      hecho: () => !!this.objetivo,
      hacer: null,
    };
    const selector = (id: string, rotulo: string, porque: string): Paso => ({
      id: 'selector',
      texto: `Gire el selector del Brymen a ${rotulo}.`,
      porque,
      bm: { posicion: id },
      hecho: () => (id === 'vdc' ? TENSION.has(bm.posicion.id) : id === 'amA' ? bm.posicion.id === 'amA' || bm.posicion.id === 'ua' : bm.posicion.id === id),
      hacer: () => bm.girar(posIndice(id)),
    });
    const borne = (j: Borne, porque: string): Paso => ({
      id: 'borne',
      texto: j === 'V' ? 'La punta roja va en el borne ΩV (el de la derecha); la negra, en COM.' : 'Pase la punta roja al borne mA µA (hasta 0,44 A; para más, el de 10 A); la negra sigue en COM.',
      porque,
      bm: { borne: j },
      hecho: () => (j === 'V' ? bm.borne === 'V' : bm.borne !== 'V'),
      hacer: () => bm.ponerBorne(j),
    });

    if (t === 'tension' || t === 'tensionPieza' || t === 'resistencia') {
      if (t !== 'tension') pasos.push(elegirPieza);
      if (t === 'resistencia')
        pasos.push({
          id: 'apagar',
          texto: 'Quite la alimentación del circuito (desactive «Alimentación encendida»).',
          porque: 'El óhmetro mide con su propia corriente: las fuentes del circuito la falsearían y podrían dañarlo.',
          hecho: () => !b.alimentado,
          hacer: () => (b.alimentado = false),
        });
      pasos.push(
        t === 'resistencia'
          ? selector('ohm', 'Ω ·)))', 'Es la posición de resistencia (y continuidad con SELECT).')
          : selector('vdc', 'V⎓ (o V∿ si la tensión es alterna)', 'V⎓ da el valor medio; V∿, el eficaz de una alterna.'),
      );
      pasos.push(borne('V', 'Por ese borne entra la tensión; por los de corriente el polímetro sería casi un cable.'));
      const [qa, qb] = t === 'tension' ? [undefined, undefined] : this.patasObjetivo();
      const pieza = this.pieza;
      pasos.push({
        id: 'roja',
        punta: 'bmRojo',
        texto:
          t === 'tension'
            ? 'Toque con la punta roja el primer punto (el de más tensión).'
            : `Ponga la punta roja en la tira de ${pieza && qa ? nombrePata(pieza, this.indicePata(qa)) : 'una pata'} de ${pieza?.comp.nombre ?? 'la pieza'}.`,
        puntos: () => (qa ? this.huecosJunto(qa) : []),
        hecho: () => (qa ? !!nodo('bmRojo') && nodo('bmRojo') === this.m.nodoEn(qa) : !!nodo('bmRojo')),
        hacer: qa ? () => poner('bmRojo', this.huecosJunto(qa)[0]) : null,
      });
      pasos.push({
        id: 'negra',
        punta: 'bmNegro',
        texto:
          t === 'tension'
            ? 'Ahora la punta negra en el segundo punto. Para la tensión «de un punto», la masa: el carril azul.'
            : `Y la punta negra en la tira de ${pieza && qb ? nombrePata(pieza, this.indicePata(qb)) : 'la otra pata'}.`,
        puntos: () => (qb ? this.huecosJunto(qb) : this.huecosMasa()),
        hecho: () => (qb ? !!nodo('bmNegro') && nodo('bmNegro') === this.m.nodoEn(qb) : !!nodo('bmNegro') && nodo('bmNegro') !== nodo('bmRojo')),
        hacer: qb ? () => poner('bmNegro', this.huecosJunto(qb)[0]) : null,
      });
    } else if (t === 'corriente') {
      pasos.push(elegirPieza);
      pasos.push(selector('amA', 'A mA (o µA para corrientes muy pequeñas)', 'Son las posiciones de corriente.'));
      pasos.push(borne('mA', 'En los bornes de corriente el polímetro es un amperímetro: casi un cable (0,03 a 3 Ω).'));
      const pieza = this.pieza;
      pasos.push({
        id: 'abrir',
        texto: pieza
          ? `Abra el circuito: toque ${pieza.comp.nombre} y arrastre el círculo de una de sus patas a una tira libre.`
          : 'Abra el circuito: toque el cable y arrastre uno de sus extremos a una tira libre.',
        porque: 'Un amperímetro mide la corriente que pasa por él: hay que hacerla pasar, en serie. Puesto en paralelo cortocircuitaría el circuito.',
        puntos: () => {
          const p = this.pieza;
          if (p) {
            const d = this.destinoAbrir(p);
            return d ? [d.q] : [];
          }
          const e = this.extremoCable();
          const q = e ? this.tiraLibreCerca(e.q, 99) : null;
          return q ? [q] : [];
        },
        hecho: () => (this.objetivo?.tipo === 'cable' ? !!this.cableAbierto() : this.pataAbierta() >= 0),
        hacer: () => this.abrir(),
      });
      const lados = (): { rojo: Pt[]; negro: Pt[] } => {
        const p = this.pieza;
        if (p) {
          const i = this.pataAbierta();
          if (i < 0) return { rojo: [], negro: [] };
          const antes = this.posAntes[i];
          return { rojo: antes ? this.huecosJunto(antes) : [], negro: this.huecosJunto(p.pos[i]!) };
        }
        const c = this.cableAbierto();
        const w = this.objetivo ? this.pb.cable(this.objetivo.id) : undefined;
        if (!c || !w || !this.cableAntes) return { rojo: [], negro: [] };
        return { rojo: this.huecosJunto(this.cableAntes.q), negro: this.huecosJunto(w[c.e]) };
      };
      const redRoja = () => {
        const p = this.pieza;
        if (p) {
          const i = this.pataAbierta();
          return i >= 0 ? this.redesAntes[i]! : null;
        }
        return this.cableAbierto()?.antes ?? null;
      };
      const redNegra = () => {
        const p = this.pieza;
        if (p) {
          const i = this.pataAbierta();
          return i >= 0 ? this.m.nodoEn(p.pos[i]!) : null;
        }
        return this.cableAbierto()?.ahora ?? null;
      };
      pasos.push({
        id: 'roja',
        punta: 'bmRojo',
        texto: 'Ponga la punta roja en la tira de donde ha salido la pata (o el cable).',
        puntos: () => lados().rojo,
        hecho: () => !!redRoja() && (nodo('bmRojo') === redRoja() || nodo('bmRojo') === redNegra()),
        hacer: () => poner('bmRojo', lados().rojo[0]),
      });
      pasos.push({
        id: 'negra',
        punta: 'bmNegro',
        texto: 'Y la punta negra en la tira donde ha quedado la pata: el polímetro cierra el circuito y la corriente pasa por él.',
        puntos: () => lados().negro,
        hecho: () => !!redNegra() && (nodo('bmNegro') === redNegra() || nodo('bmNegro') === redRoja()) && nodo('bmNegro') !== nodo('bmRojo'),
        hacer: () => poner('bmNegro', lados().negro[0]),
      });
    } else if (t === 'senal') {
      pasos.push({
        id: 'osc',
        texto: f.encendido ? 'Ponga el FNIRSI en osciloscopio: pulse MENU y elija Osciloscopio.' : 'Encienda el FNIRSI (botón rojo) y elija Osciloscopio con MENU.',
        fn: { boton: f.encendido ? 'menu' : 'power' },
        hecho: () => f.encendido && f.modo === 'osc',
        hacer: () => {
          f.encendido = true;
          f.elegirModo('osc');
        },
      });
      pasos.push({
        id: 'masa',
        punta: 'masa',
        texto: 'Enganche la pinza de masa (⏚) de la sonda en la masa: el carril azul.',
        porque: 'El osciloscopio mide la tensión de la punta respecto a su pinza de masa.',
        puntos: () => this.huecosMasa(),
        hecho: () => !!this.m.puntas.masa && nodo('masa') === '0',
        hacer: () => poner('masa', this.huecosMasa()[0]),
      });
      pasos.push({
        id: 'ch1',
        punta: 'ch1',
        texto: 'Toque con la punta de la sonda CH1 el punto que quiere ver.',
        hecho: () => !!nodo('ch1'),
        hacer: null,
      });
      pasos.push({
        id: 'x10',
        texto: 'Compruebe que el conmutador de la sonda y el menú de CH1 dicen lo mismo (×10 los dos).',
        porque: 'Si no coinciden, la pantalla da tensiones diez veces mayores o menores.',
        fn: { boton: 'ch1' },
        hecho: () => f.canales[0]!.sondaX10 === f.canales[0]!.menuX10,
        hacer: () => {
          const c = f.canales[0]!;
          if (c.menuX10 !== c.sondaX10) {
            c.menuX10 = c.sondaX10;
            c.vDiv = c.vDiv * (c.menuX10 ? 10 : 0.1);
          }
        },
      });
      pasos.push({
        id: 'auto',
        texto: 'Pulse AUTO: elige la base de tiempos, los voltios por división y el disparo para que la señal quede quieta.',
        porque: 'Luego puede afinar a mano con las flechas y TRIGGER; PRM muestra frecuencia, periodo, Vpp y media.',
        fn: { boton: 'auto' },
        hecho: () => this.autoPulsado,
        hacer: null,
      });
    } else if (t === 'escuchar') {
      pasos.push({
        id: 'auricular',
        punta: 'esc',
        texto: 'Toque con el auricular (♪) el punto que quiere oír. Su otro cable va a la masa.',
        hecho: () => !!nodo('esc'),
        hacer: null,
      });
      pasos.push({
        id: 'oir',
        texto: 'Pulse «Escuchar auricular» (abajo, en «Escuchar») y ajuste el volumen.',
        hecho: () => b.escucha === 'esc',
        hacer: null,
      });
    }
    return pasos;
  }

  /** Index of the step to do now (the first one not done), or −1 when all are done. */
  get actual(): number {
    return this.pasos.findIndex((p) => !p.hecho());
  }

  get terminado(): boolean {
    return !!this.tarea && this.pasos.length > 0 && this.actual < 0;
  }

  /** One line about what the instrument shows, once every step is done (Spanish). */
  get explicacion(): string {
    const t = this.tarea;
    if (!this.terminado || !t) return '';
    const b = this.m.b;
    const l = b.brymen.pantalla.principal;
    const lectura = l ? (l.ol ? 'OL' : `${l.texto.replace('.', ',')} ${l.unidad}`) : '…';
    const p = this.pieza;
    if (t === 'tension') return `El Brymen marca ${lectura}: la tensión entre ${this.describir(this.m.puntas.bmRojo)} (roja) y ${this.describir(this.m.puntas.bmNegro)} (negra).`;
    if (t === 'tensionPieza') return `El Brymen marca ${lectura}: la tensión en ${p?.comp.nombre ?? 'la pieza'}, de ${this.describir(this.m.puntas.bmRojo)} a ${this.describir(this.m.puntas.bmNegro)}.`;
    if (t === 'resistencia') return `El Brymen marca ${lectura}: la resistencia entre las patas de ${p?.comp.nombre ?? 'la pieza'}, con lo que esté en paralelo con ella en el circuito.`;
    if (t === 'corriente') return `El Brymen marca ${lectura}: la corriente que pasa por ${p?.comp.nombre ?? 'el cable'}, entrando por la punta roja.`;
    if (t === 'senal') {
      const m = b.fnirsi.medidas(0);
      const fmt = (v: number | null, u: string, d = 3) => (v == null ? '—' : `${(Math.abs(v) >= 1000 ? v / 1000 : v).toPrecision(d).replace('.', ',')} ${Math.abs(v) >= 1000 ? 'k' + u : u}`);
      return m ? `La señal en ${this.describir(this.m.puntas.ch1)}: ${m.f ? `${fmt(m.f, 'Hz')}, ` : ''}${fmt(m.vpp, 'V')} pico a pico, media ${fmt(m.vmedia, 'V')} (PRM en la pantalla).` : `La señal en ${this.describir(this.m.puntas.ch1)}.`;
    }
    return `Se oye ${this.describir(this.m.puntas.esc)}.`;
  }

  // ---------------------------------------------------------------- «Hazlo por mí»

  /** Does the remaining steps one by one (700 ms apart), as far as they can be done for the user. */
  async hazloPorMi(): Promise<void> {
    if (this.haciendo) return;
    this.haciendo = true;
    try {
      for (let n = 0; n < 12; n++) {
        const i = this.actual;
        if (i < 0) break;
        const p = this.pasos[i]!;
        if (!p.hacer) break;
        p.hacer();
        await new Promise((r) => setTimeout(r, 700));
        if (!p.hecho()) break;
      }
    } finally {
      this.haciendo = false;
    }
  }
}

/**
 * Mistakes with the instruments on the board, explained (Spanish), whatever the tutor is doing: the red
 * lead in a current jack with the dial elsewhere, an ammeter across a circuit (fuse), an ohmmeter on a
 * powered circuit, OL, a ×10 probe with a ×1 channel, a trigger level outside the signal.
 */
export function erroresMedida(m: MedidaProtoboard, acciones: { enSerie: (pieza: string | null) => void }): ErrorMedida[] {
  const b = m.b;
  const bm = b.brymen;
  const f = b.fnirsi;
  const res: ErrorMedida[] = [];
  if (bm.errorBorne)
    res.push({
      texto: `La punta roja del Brymen está en el borne ${bm.borne === 'A' ? 'A' : 'mA µA'}, pero el selector está en ${bm.posicion.rotulo}: por ahí el polímetro es un amperímetro (casi un cable), no puede medir eso. Por eso pita y marca «InErr». Pase la punta roja al borne ΩV o gire el selector a una posición de corriente.`,
      accion: { etiqueta: 'Punta roja a ΩV', hacer: () => bm.ponerBorne('V') },
    });
  if (bm.esCorriente && bm.borne === 'V' && b.bm.rojo && b.bm.negro)
    res.push({
      texto: 'El selector está en corriente pero la punta roja sigue en el borne ΩV: así no pasa corriente por el medidor y marca cero. Pásela al borne mA µA (o al de 10 A).',
      accion: { etiqueta: 'Punta roja a mA', hacer: () => bm.ponerBorne('mA') },
    });
  if (b.avisoFusible) {
    // Where the leads are: the part between them is what to put the meter in series with.
    const entre = parteEntre(m);
    res.push({
      texto: `${b.avisoFusible} El amperímetro estaba en paralelo: como es casi un cable, cortocircuitó lo que había entre las puntas y pasó toda la corriente que podía dar la fuente. Un amperímetro se pone en serie: abriendo el circuito y cerrándolo con él.`,
      accion: { etiqueta: 'Ponerlo en serie', hacer: () => acciones.enSerie(entre) },
    });
  }
  const OHM = new Set(['ohm', 'cont', 'ns', 'diodo', 'cap']);
  const ohm = (bm.borne === 'V' && OHM.has(bm.primaria?.medida ?? '') && b.bm.rojo && b.bm.negro) || (f.modo === 'dmm' && f.borne === 'V' && OHM.has(f.funcionDmm?.medida ?? '') && b.fn.rojo && b.fn.negro);
  if (ohm && b.alimentado)
    res.push({
      texto: 'Está midiendo resistencia (o continuidad, diodo, capacidad) con el circuito alimentado: el óhmetro mide con la pequeña corriente que él mismo inyecta, y las fuentes del circuito la falsean; la lectura no significa nada y, con tensiones altas, un polímetro real puede dañarse. Quite la alimentación.',
      accion: { etiqueta: 'Medir sin alimentación', hacer: () => (b.alimentado = false) },
    });
  const l = bm.pantalla.principal;
  if (l?.ol && b.bm.rojo && b.bm.negro)
    res.push({
      texto: bm.manual
        ? 'OL: el valor no cabe en el rango manual elegido. Pulse RANGE hasta un rango mayor (o manténgalo pulsado para volver al automático).'
        : bm.primaria?.medida === 'ohm' || bm.primaria?.medida === 'cont'
          ? 'OL: entre las puntas no hay camino (o la resistencia supera el rango máximo): circuito abierto.'
          : 'OL: el valor supera el rango máximo de esta posición.',
    });
  const c = f.canales[0]!;
  if (f.modo === 'osc' && b.sondas.ch1 && c.sondaX10 !== c.menuX10)
    res.push({
      texto: `La sonda está en ${c.sondaX10 ? '×10' : '×1'} y el menú de CH1 en ${c.menuX10 ? '×10' : '×1'}: la pantalla da tensiones ${c.menuX10 ? 'diez veces mayores' : 'diez veces menores'} de las reales. Póngalos igual (CH1 → Sonda).`,
    });
  if (f.modo === 'osc' && f.encendido && (b.sondas.ch1 || b.sondas.ch2)) {
    const k = f.disparo.fuente;
    const { entradas } = b.entradasOsc();
    const e = entradas[k];
    const ch = f.canales[k]!;
    if (e && typeof e !== 'number' && ch.on) {
      const fac = (ch.menuX10 ? 10 : 1) / (ch.sondaX10 ? 10 : 1);
      let max = -Infinity;
      let min = Infinity;
      for (const v of e.y) {
        if (v > max) max = v;
        if (v < min) min = v;
      }
      const nivel = f.disparo.nivel;
      if (max - min > 1e-6 && (nivel > max * fac || nivel < min * fac))
        res.push({
          texto: `El nivel de disparo (${nivel.toFixed(2).replace('.', ',')} V) está fuera de la señal de CH${k + 1} (de ${(min * fac).toFixed(2).replace('.', ',')} a ${(max * fac).toFixed(2).replace('.', ',')} V): el osciloscopio no sabe cuándo empezar cada barrido y la imagen no se queda quieta. Pulse AUTO o lleve el nivel dentro de la señal con TRIGGER.`,
        });
    }
  }
  return res;
}

/** A two-leg part whose legs are on the nets of the Brymen's leads (or touches one of them), or null. */
function parteEntre(m: MedidaProtoboard): string | null {
  const a = m.b.bm.rojo;
  const z = m.b.bm.negro;
  if (!a || !z) return null;
  const pb = m.pb;
  let parcial: string | null = null;
  for (const p of pb.doc.piezas) {
    if (p.pos.length !== 2 || EXTERNOS.has(p.enc) || p.chip) continue;
    const n = p.pos.map((q) => m.nodoEn(q));
    if ((n[0] === a && n[1] === z) || (n[0] === z && n[1] === a)) return p.id;
    if (!parcial && (n.includes(a) || n.includes(z)) && !n.includes('0')) parcial = p.id;
  }
  return parcial;
}
