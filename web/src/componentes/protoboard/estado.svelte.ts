// State of a breadboard being edited: the document, the selection, undo/redo (snapshots), and the
// operations of the canvas, the toolbar and the panels (move, stretch a leg, turn, reverse, wire, add,
// delete, change a value). The nets, the netlist and the checks are derived from the document, so the
// live schematic and the warnings follow every change. `edicion` is the same object seen as the schematic
// editor's panels expect (editor/Propiedades.svelte, editor/Paleta.svelte).

import { analisisPorDefecto, type Componente, type DocumentoEsquema } from '../editor/tipos.ts';
import type { EdicionPaleta, EdicionPropiedades } from '../editor/estado.svelte';
import type { Conectividad } from '../editor/conectividad.ts';
import { conmutado } from '../editor/catalogo.ts';
import { CABLE } from './colores.ts';
import { comprobar, type PuntoTrabajo } from './comprobaciones.ts';
import { conexiones, netlistProtoboard } from './conexiones.ts';
import { componenteNuevo, girarPos, huecoCercano, invertirPos, motivoExtremo, motivoInvalida, nuevaPieza, nuevoChip, cablesDeBornes } from './edicion.ts';
import { tieneChip } from './logica.ts';
import { bornesExterno, encapsuladoDe, EXTERNOS } from './encapsulados.ts';
import { columnasRiel, type Pt } from './placa.ts';
import { compsDe, type CableProto, type DocumentoProtoboard, type Pieza } from './tipos.ts';

const MAX_HISTORIA = 150;

/** An empty board with a bench supply wired to the top rails (and the rails bridged to the bottom ones). */
export function montajeVacio(titulo = 'Montaje nuevo'): DocumentoProtoboard {
  const comp: Componente = { id: 'v1', tipo: 'V', nombre: 'V1', x: 0, y: 0, o: 3, campos: { forma: 'dc', dc: '5' } };
  const pos = bornesExterno([3, -3]);
  const rc = columnasRiel(30);
  const fin = rc[rc.length - 1]!;
  return {
    version: 1,
    titulo,
    placas: 1,
    columnas: 30,
    piezas: [{ id: 'v1', comp, enc: 'alimentacion', pos, patas: ['end', 'start'] }],
    cables: [
      { id: 'w1', a: pos[0]!, b: [2, 0], color: CABLE.rojo },
      { id: 'w2', a: pos[1]!, b: [5, 1], color: CABLE.negro },
      { id: 'w3', a: [fin, 0], b: [fin, 17], color: CABLE.rojo },
      { id: 'w4', a: [fin - 1, 1], b: [fin - 1, 16], color: CABLE.negro },
    ],
    analisis: analisisPorDefecto(),
    directivas: '',
    origen: { tipo: 'propio' },
  };
}

export class Protoboard {
  doc = $state<DocumentoProtoboard>(montajeVacio());
  /** Selected pieces and wires. */
  sel = $state<string[]>([]);
  /** «medir» (0.10): a tap places the chosen lead of the instruments (medida.svelte.ts). */
  herramienta = $state<'seleccionar' | 'cable' | 'colocar' | 'medir'>('seleccionar');
  /** Palette kind chosen (the editor's palette sets it; the board adds the part at once). */
  colocando = $state<string | null>(null);
  version = $state(0);
  puedeDeshacer = $state(false);
  puedeRehacer = $state(false);
  /** Last message of an operation that could not be done (Spanish). */
  mensaje = $state('');
  /** Operating point of the last simulation (LEDs, voltages under the finger, checks). */
  op = $state.raw<PuntoTrabajo | null>(null);
  /** Gate of the selected chip whose properties are shown. */
  puerta = $state<string | null>(null);
  /** Centre of what the canvas shows (new parts go near it). */
  vista: Pt = [10, 8];

  readonly con = $derived(conexiones(this.doc));
  readonly nl = $derived(netlistProtoboard(this.doc, this.con));
  readonly obs = $derived(comprobar(this.doc, this.con, this.op));

  private pasado: string[] = [];
  private futuro: string[] = [];
  private inicial = '';
  private ultimoId = 0;

  cargar(doc: DocumentoProtoboard, comoInicial = true): void {
    this.doc = doc;
    this.sel = [];
    this.pasado = [];
    this.futuro = [];
    this.puedeDeshacer = this.puedeRehacer = false;
    if (comoInicial) this.inicial = JSON.stringify(doc);
    this.ultimoId = 0;
    for (const x of [...doc.piezas, ...doc.piezas.flatMap((p) => p.chip?.comps ?? []), ...doc.cables]) {
      const n = Number(/(\d+)$/.exec(x.id)?.[1] ?? 0);
      if (n > this.ultimoId) this.ultimoId = n;
    }
    this.op = null;
    this.version++;
  }

  /** Back to the board as it was opened (the auto-placement). */
  restaurar(): void {
    if (!this.inicial) return;
    const d = JSON.parse(this.inicial) as DocumentoProtoboard;
    this.cambiar(() => {
      this.doc = d;
    });
    this.sel = [];
  }

  get modificado(): boolean {
    return !!this.inicial && this.puedeDeshacer;
  }

  nuevoId(p: string): string {
    return `${p}${++this.ultimoId}`;
  }

  cambiar(fn: () => void, fusionar = false): void {
    // fusionar: part of the previous change (a knob being dragged): no new step in the history.
    if (!fusionar || !this.pasado.length) {
      this.pasado.push(JSON.stringify($state.snapshot(this.doc)));
      if (this.pasado.length > MAX_HISTORIA) this.pasado.shift();
    }
    this.futuro = [];
    fn();
    this.puedeDeshacer = true;
    this.puedeRehacer = false;
    this.mensaje = '';
    this.version++;
  }

  deshacer(): void {
    const s = this.pasado.pop();
    if (!s) return;
    this.futuro.push(JSON.stringify($state.snapshot(this.doc)));
    this.doc = JSON.parse(s) as DocumentoProtoboard;
    this.sel = this.sel.filter((id) => this.existe(id));
    this.puedeDeshacer = this.pasado.length > 0;
    this.puedeRehacer = true;
    this.version++;
  }

  rehacer(): void {
    const s = this.futuro.pop();
    if (!s) return;
    this.pasado.push(JSON.stringify($state.snapshot(this.doc)));
    this.doc = JSON.parse(s) as DocumentoProtoboard;
    this.sel = this.sel.filter((id) => this.existe(id));
    this.puedeRehacer = this.futuro.length > 0;
    this.puedeDeshacer = true;
    this.version++;
  }

  existe(id: string): boolean {
    return this.doc.piezas.some((p) => p.id === id) || this.doc.cables.some((w) => w.id === id);
  }

  pieza(id: string): Pieza | undefined {
    return this.doc.piezas.find((p) => p.id === id);
  }

  cable(id: string): CableProto | undefined {
    return this.doc.cables.find((w) => w.id === id);
  }

  /** The only selected piece. */
  get piezaSel(): Pieza | null {
    return this.sel.length === 1 ? (this.pieza(this.sel[0]!) ?? null) : null;
  }

  /** The part the properties panel edits: the piece's, or the chosen gate of a chip. */
  get unico(): Componente | null {
    const p = this.piezaSel;
    if (p?.chip) {
      const ps = this.puertasDe(p);
      return ps.find((c) => c.id === this.puerta) ?? ps[0] ?? null;
    }
    return p?.comp ?? null;
  }

  /**
   * The parts a chip serves: its own gates and flip-flops, and the T flip-flops whose XOR it holds (they
   * belong to their 74HC74).
   */
  puertasDe(p: Pieza): Componente[] {
    if (!p.chip) return [];
    const ids = new Set(p.chip.comps.map((c) => c.id));
    for (const x of p.patas) if (x) ids.add(x.split('|')[0]!);
    for (const t of Object.values(p.chip.ataduras)) if (t && typeof t === 'object' && !('igual' in t)) ids.add(('pin' in t ? t.pin.split('.') : t.interna.split(':'))[0]!);
    const todos = this.doc.piezas.flatMap(compsDe);
    return [...ids].flatMap((id) => todos.filter((c) => c.id === id));
  }

  /** The piece holding an editor part (itself, or the chip of a gate). */
  piezaDeComp(id: string): Pieza | undefined {
    return this.doc.piezas.find((p) => p.id === id || p.chip?.comps.some((c) => c.id === id));
  }

  private nombresUsados(): Set<string> {
    return new Set(this.doc.piezas.flatMap((p) => [p.comp, ...(p.chip?.comps ?? [])]).map((c) => c.nombre.toUpperCase()));
  }

  private rechazar(m: string): false {
    this.mensaje = m;
    return false;
  }

  // ---------------------------------------------------------------- moving

  /** Can these pieces go to these legs? (ignoring the pieces moved together) */
  probar(cambios: Map<string, Pt[]>): string | null {
    const ignorar = new Set(cambios.keys());
    // Wires that move with equipment terminals.
    for (const [id] of cambios) {
      const p = this.pieza(id);
      if (p && EXTERNOS.has(p.enc)) for (const { cable, extremo } of cablesDeBornes(this.doc, p)) ignorar.add(`${cable.id}:${extremo}`);
    }
    const doc = { ...this.doc, piezas: this.doc.piezas.map((p) => (cambios.has(p.id) ? { ...p, pos: cambios.get(p.id)! } : p)) };
    for (const [id, pos] of cambios) {
      const p = this.pieza(id);
      if (!p) continue;
      const m = motivoInvalida(doc, { ...p, pos }, ignorar);
      if (m) return `${p.comp.nombre || 'La pieza'}: ${m}`;
    }
    return null;
  }

  moverPiezas(ids: string[], dx: number, dy: number): boolean {
    if (!dx && !dy) return true;
    const cambios = new Map<string, Pt[]>();
    for (const id of ids) {
      const p = this.pieza(id);
      if (p) cambios.set(id, p.pos.map(([x, y]) => [x + dx, y + dy] as Pt));
    }
    const m = this.probar(cambios);
    if (m) return this.rechazar(m);
    this.cambiar(() => {
      for (const [id, pos] of cambios) {
        const p = this.pieza(id)!;
        if (EXTERNOS.has(p.enc))
          for (const { cable, extremo } of cablesDeBornes(this.doc, p)) {
            const q = cable[extremo];
            cable[extremo] = [q[0] + dx, q[1] + dy];
          }
        p.pos = pos;
      }
      for (const id of ids) {
        const w = this.cable(id);
        if (w) {
          w.a = [w.a[0] + dx, w.a[1] + dy];
          w.b = [w.b[0] + dx, w.b[1] + dy];
        }
      }
    });
    return true;
  }

  /** A two-leg part with one leg moved (legs bend). */
  moverPata(id: string, i: number, q: Pt): boolean {
    const p = this.pieza(id);
    if (!p || p.pos.length !== 2) return false;
    const e = encapsuladoDe(p.comp);
    const pos = p.pos.map((x, k) => (k === i ? q : x)) as Pt[];
    const L = Math.hypot(pos[1]![0] - pos[0]![0], pos[1]![1] - pos[0]![1]);
    const [smin, smax] = e.span ?? [1, 10];
    if (L < smin - 1e-9) return this.rechazar('Las patas no pueden quedar tan juntas.');
    if (L > smax + 0.5) return this.rechazar(`Las patas de ${p.comp.nombre} no llegan tan lejos (como mucho ${smax} agujeros).`);
    const m = this.probar(new Map([[id, pos]]));
    if (m) return this.rechazar(m);
    this.cambiar(() => {
      p.pos = pos;
    });
    return true;
  }

  moverExtremo(id: string, e: 'a' | 'b', q: Pt): boolean {
    const w = this.cable(id);
    if (!w) return false;
    const otro = e === 'a' ? w.b : w.a;
    if (otro[0] === q[0] && otro[1] === q[1]) return this.rechazar('Un cable necesita dos agujeros distintos.');
    const m = motivoExtremo(this.doc, q, new Set([`${id}:${e}`]));
    if (m) return this.rechazar(m);
    this.cambiar(() => {
      w[e] = q;
    });
    return true;
  }

  moverCable(id: string, dx: number, dy: number): boolean {
    const w = this.cable(id);
    if (!w) return false;
    for (const e of ['a', 'b'] as const) {
      const m = motivoExtremo(this.doc, [w[e][0] + dx, w[e][1] + dy], new Set([id]));
      if (m) return this.rechazar(m);
    }
    return this.moverPiezas([id], dx, dy);
  }

  anadirCable(a: Pt, b: Pt, color?: string): CableProto | null {
    if (a[0] === b[0] && a[1] === b[1]) return null;
    for (const q of [a, b]) {
      const m = motivoExtremo(this.doc, q, new Set());
      if (m) {
        this.rechazar(m);
        return null;
      }
    }
    // Colour: red/black/blue for wires into the rails, then a cycle.
    const usados = this.doc.cables.length;
    const ciclo = [CABLE.amarillo, CABLE.verde, CABLE.naranja, CABLE.azul, CABLE.blanco, CABLE.violeta];
    const w: CableProto = { id: this.nuevoId('w'), a, b, color: color ?? ciclo[usados % ciclo.length]! };
    this.cambiar(() => this.doc.cables.push(w));
    this.sel = [w.id];
    return w;
  }

  colorCable(id: string, color: string): void {
    const w = this.cable(id);
    if (w) this.cambiar(() => (w.color = color));
  }

  // ---------------------------------------------------------------- turning

  private reubicar(p: Pieza, pos: Pt[], que: string): boolean {
    let m = this.probar(new Map([[p.id, pos]]));
    let final = pos;
    if (m) {
      const otra = huecoCercano(this.doc, { ...p, pos }, 4);
      if (otra) {
        final = otra;
        m = null;
      }
    }
    if (m) return this.rechazar(`No se puede ${que} ${p.comp.nombre} ahí: ${m.replace(/^[^:]*: /, '')}`);
    this.cambiar(() => {
      p.pos = final;
    });
    return true;
  }

  girar(id: string): boolean {
    const p = this.pieza(id);
    if (!p || EXTERNOS.has(p.enc) || p.pos.length < 2) return false;
    return this.reubicar(p, girarPos(p), 'girar');
  }

  invertir(id: string): boolean {
    const p = this.pieza(id);
    if (!p || EXTERNOS.has(p.enc) || p.pos.length < 2) return false;
    return this.reubicar(p, invertirPos(p), 'dar la vuelta a');
  }

  transformar(ids: string[], modo: 'girar' | 'reflejar'): void {
    for (const id of ids) {
      if (modo === 'girar') this.girar(id);
      else this.invertir(id);
    }
  }

  /** Switch, changeover or push button: its next state (tap on the board, toolbar button). */
  conmutar(id: string): void {
    const p = this.pieza(id);
    const x = p ? conmutado(p.comp) : null;
    if (!x) return;
    this.cambiarCampo(id, x[0], x[1]);
  }

  // ---------------------------------------------------------------- adding and removing

  anadir(tipo: string, cerca: Pt = this.vista): Pieza | null {
    if (tipo === 'GND' || tipo === 'RIEL' || tipo === 'ETQ' || tipo === 'NOTA') {
      this.rechazar(
        tipo === 'GND'
          ? 'En la protoboard la masa es el carril azul (−) unido al borne negro de la fuente: lleve allí las masas con un cable.'
          : tipo === 'NOTA'
            ? 'Las notas de texto son del esquema: en la protoboard no hacen falta.'
            : 'En la protoboard una red es lo que unen las tiras y los cables: no hacen falta símbolos de alimentación ni etiquetas.',
      );
      return null;
    }
    const comp = componenteNuevo(this.doc, tipo, this.nuevoId('p'));
    if (!comp) return null;
    // A logic gate or flip-flop comes in its 74HC chip (the other gates free, to be wired by hand).
    const p = tieneChip(comp) ? nuevoChip(this.doc, [comp], this.nuevoId('p'), cerca) : nuevaPieza(this.doc, comp, cerca);
    if (!p) {
      this.rechazar('No queda sitio libre en la protoboard para esta pieza.');
      return null;
    }
    this.cambiar(() => this.doc.piezas.push(p));
    this.sel = [p.id];
    return p;
  }

  borrar(ids: string[] = this.sel): void {
    if (!ids.length) return;
    const s = new Set(ids);
    this.cambiar(() => {
      this.doc.piezas = this.doc.piezas.filter((p) => !s.has(p.id));
      this.doc.cables = this.doc.cables.filter((w) => !s.has(w.id));
    });
    this.sel = [];
  }

  duplicar(): void {
    const p = this.piezaSel;
    if (!p) return;
    const usados = this.nombresUsados();
    const libre = (nombre: string): string => {
      const prefijo = nombre.replace(/\d+$/, '') || 'X';
      let k = 1;
      while (usados.has(`${prefijo}${k}`.toUpperCase())) k++;
      usados.add(`${prefijo}${k}`.toUpperCase());
      return `${prefijo}${k}`;
    };
    const copia = (c: Componente): Componente => ({ ...(JSON.parse(JSON.stringify(c)) as Componente), id: this.nuevoId('p'), nombre: libre(c.nombre) });
    let nueva: Pieza | null;
    if (p.chip) {
      // A chip with its gates: new parts, the legs pointing at them.
      const ids = new Map<string, string>();
      const comps = p.chip.comps.map((c) => {
        const n = copia(c);
        ids.set(c.id, n.id);
        return n;
      });
      const comp = copia(p.comp);
      nueva = nuevaPieza(this.doc, comp, p.pos[0]!);
      if (nueva) {
        nueva.patas = p.patas.map((x) => (x ? `${ids.get(x.split('|')[0]!) ?? ''}|${x.split('|')[1]}` : null));
        // (the ties of a T flip-flop follow its copy; those of another chip's T flip-flop stay as they were)
        const otro = (k: string, sep: string) => {
          const [id, resto] = [k.slice(0, k.indexOf(sep)), k.slice(k.indexOf(sep))];
          return `${ids.get(id) ?? id}${resto}`;
        };
        const ataduras = Object.fromEntries(
          Object.entries(p.chip.ataduras).map(([i, t]) => [i, t && typeof t === 'object' && 'pin' in t ? { pin: otro(t.pin, '.') } : t && typeof t === 'object' && 'interna' in t ? { interna: otro(t.interna, ':') } : t]),
        );
        nueva.chip = { comps, roles: [...p.chip.roles], ataduras };
      }
    } else nueva = nuevaPieza(this.doc, copia(p.comp), p.pos[0]!);
    if (!nueva) {
      this.rechazar('No queda sitio libre para la copia.');
      return;
    }
    nueva.pos = huecoCercano(this.doc, { ...nueva, pos: p.pos.map(([x, y]) => [x, y + 1] as Pt) }, 30) ?? nueva.pos;
    const n = nueva;
    this.cambiar(() => this.doc.piezas.push({ ...n, ...(p.polo != null ? { polo: p.polo } : {}) }));
    this.sel = [n.id];
  }

  // ---------------------------------------------------------------- properties

  cambiarCampo(id: string, campo: string, valor: string, fusionar = false): void {
    const p = this.pieza(id);
    if (!p) {
      // A gate of a chip: only its own fields (its package is the chip's).
      const g = this.piezaDeComp(id)?.chip?.comps.find((c) => c.id === id);
      if (g && g.campos[campo] !== valor) this.cambiar(() => (g.campos[campo] = valor), fusionar);
      return;
    }
    if (p.comp.campos[campo] === valor) return;
    this.cambiar(() => {
      p.comp.campos[campo] = valor;
      if (fusionar) return;
      // The package may change with the value (a 100 nF ceramic becomes a 10 µF electrolytic) or the
      // pinout with the model (a BC547 has its collector where a 2N3904 has its emitter).
      const e = encapsuladoDe(p.comp);
      if (e.id !== p.enc || e.patas.join('|') !== p.patas.join('|')) {
        if (e.patas.length === p.pos.length && (EXTERNOS.has(e.id) === EXTERNOS.has(p.enc))) {
          p.enc = e.id;
          p.patas = e.patas;
          if (e.polar && p.polo == null) p.polo = 0;
        } else {
          const n = nuevaPieza({ ...this.doc, piezas: this.doc.piezas.filter((x) => x.id !== id) }, p.comp, p.pos[0]!);
          if (n) {
            p.enc = n.enc;
            p.patas = n.patas;
            p.pos = n.pos;
          }
        }
      }
    }, fusionar);
  }

  renombrar(id: string, nombre: string): void {
    const c = this.pieza(id)?.comp ?? this.piezaDeComp(id)?.chip?.comps.find((x) => x.id === id);
    if (!c || c.nombre === nombre) return;
    this.cambiar(() => {
      c.nombre = nombre;
    });
  }

  // ---------------------------------------------------------------- the editor's panels

  /** The board seen as the schematic editor's properties panel and palette expect it. */
  readonly edicion: EdicionPropiedades & EdicionPaleta = crearFachada(this);
}

function crearFachada(pb: Protoboard): EdicionPropiedades & EdicionPaleta {
  return {
    get unico() {
      return pb.unico;
    },
    get sel() {
      return pb.sel;
    },
    set sel(v: string[]) {
      pb.sel = v;
    },
    get herramienta() {
      return pb.herramienta === 'medir' ? 'seleccionar' : pb.herramienta;
    },
    set herramienta(v) {
      pb.herramienta = v;
    },
    get colocando() {
      return pb.colocando;
    },
    set colocando(v) {
      pb.colocando = v;
    },
    get doc(): DocumentoEsquema {
      return { version: 1, titulo: pb.doc.titulo, componentes: pb.doc.piezas.flatMap(compsDe), cables: [], analisis: pb.doc.analisis, directivas: pb.doc.directivas };
    },
    get con(): Conectividad {
      return pb.nl.con;
    },
    get nl() {
      return pb.nl;
    },
    cambiarCampo: (id: string, campo: string, valor: string, fusionar?: boolean) => pb.cambiarCampo(id, campo, valor, fusionar),
    renombrar: (id: string, nombre: string) => pb.renombrar(id, nombre),
    transformar: (ids: string[], modo: 'girar' | 'reflejar') => pb.transformar([...new Set(ids.map((id) => pb.piezaDeComp(id)?.id ?? id))], modo),
    duplicar: () => pb.duplicar(),
    borrar: (ids?: string[]) => pb.borrar(ids),
    cambiar: (fn: () => void, fusionar?: boolean) => pb.cambiar(fn, fusionar),
  } as EdicionPropiedades & EdicionPaleta;
}
