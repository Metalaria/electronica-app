// State of the «Kit FM7303» page: the kit data, the position of every control, the fault being simulated, the
// radio as the alignment model sees it (fisica.ts), the DC operating point from ngspice (dc.ts) driving the live
// overlay, the instruments (multimeter probes, oscilloscope channel) and what has been measured.

import { EstadoEsquema } from '../figuras-vivas/esquema/modelo.svelte';
import { radio, fB1, fB2, FI, TP_OBJETIVO, RECIEN_MONTADO, dialPara, type Controles, type EstadoRadio } from './fisica';
import { nodosSinModelo, parametros, simularDC, type ResultadoDC } from './dc';
import type { Averia, Kit } from './tipos';

/** The kit aligned as the book's procedure leaves it. */
export function alineado(): Controles {
  const c: Controles = {
    ...RECIEN_MONTADO,
    dial: 0.57,
    c4a: 0.5,
    c4b: 0.5,
    l1: 0,
    l2: 0,
    b1: (fB1(0) / FI) ** 2 - 1,
    b2: (fB2(0) / FI) ** 2 - 1,
    w1: TP_OBJETIVO / 6,
    w2: 0.65,
    w3: 0.5,
  };
  // The strong reference station (98,0 MHz) tuned exactly.
  c.dial = dialPara(c, 98.0e6) ?? 0.57;
  return c;
}

export type Pestana = 'esquema' | 'senal' | 'alineacion' | 'averias';
export type Modo = 'normal' | 'multimetro' | 'senalar';

export interface Medida {
  /** What was measured, as text («TP3», «IC4, patilla 3»…). */
  donde: string;
  valor: string;
  t: number;
}

export class EstadoKit {
  readonly kit: Kit;
  readonly est: EstadoEsquema;
  /** Node id by net name, and net name by node id. */
  readonly nodoDeRed = new Map<string, string>();
  readonly redDeNodo = new Map<string, string>();
  /** Element id by designator. */
  readonly elemDeRef = new Map<string, string>();
  readonly refDeElem = new Map<string, string>();

  c = $state<Controles>({ ...RECIEN_MONTADO });
  averia = $state.raw<Averia | null>(null);
  pestana = $state<Pestana>('esquema');
  modo = $state<Modo>('normal');
  /** Selected part (designator), block, stage, test point. */
  pieza = $state<string | null>(null);
  bloque = $state<number | null>(null);
  etapa = $state<string | null>(null);
  tp = $state<string>('TP3');
  /** Multimeter probes: node ids (black defaults to ground). */
  roja = $state<string | null>(null);
  negra = $state<string>('N0');
  /** Which probe the next tap places. */
  siguiente = $state<'roja' | 'negra'>('roja');
  /** Nets measured with the multimeter (black on ground), for the supply step. */
  medidas = $state<Medida[]>([]);
  redesMedidas = $state<string[]>([]);
  /** Test points looked at with the oscilloscope. */
  tpsVistos = $state<string[]>([]);

  dc = $state.raw<ResultadoDC | null>(null);
  dcEstado = $state<'simulando' | 'listo' | 'error'>('simulando');
  dcError = $state('');
  /** Parameters of the last DC run (to know when a re-run is needed). */
  private firmaDC = '';

  readonly radio: EstadoRadio = $derived.by(() => radio(this.c, { emisoras: this.kit.emisoras, averia: this.averia?.senal ?? null }));

  constructor(kit: Kit) {
    this.kit = kit;
    this.est = new EstadoEsquema(kit.esquema, 0, true);
    this.est.reproduciendo = true;
    for (const n of kit.esquema.nodos) {
      this.nodoDeRed.set(n.red, n.id);
      this.redDeNodo.set(n.id, n.red);
    }
    for (const e of kit.esquema.elementos) {
      if (e.designador) {
        this.elemDeRef.set(e.designador, e.id);
        this.refDeElem.set(e.id, e.designador);
      }
    }
  }

  // ---------------------------------------------------------------- DC model
  /** Placeholders of the DC netlist for the present state (changes trigger a new operating point). */
  readonly valoresDC = $derived.by(() => parametros(this.kit, this.c, this.radio, this.averia));

  /** Runs the operating point if the parameters changed since the last run. */
  async actualizarDC(): Promise<void> {
    const valores = this.valoresDC;
    const firma = JSON.stringify(valores);
    if (firma === this.firmaDC && this.dc) return;
    this.firmaDC = firma;
    this.dcEstado = 'simulando';
    const sinModelo = nodosSinModelo(this.kit, this.c);
    try {
      const r = await simularDC(this.kit, valores, sinModelo);
      if (firma !== this.firmaDC) return;
      this.dc = r;
      this.est.op = r.op;
      this.dcEstado = 'listo';
      this.dcError = '';
    } catch (e) {
      if ((e as Error)?.name === 'SimulacionCancelada' || /sustituida/.test(String(e))) return;
      if (firma !== this.firmaDC) return;
      this.dcEstado = 'error';
      this.dcError = e instanceof Error ? e.message : String(e);
    }
  }

  /** Simulated DC voltage of a node (V), or null (not modelled or not simulated yet). */
  tension(nodo: string | null): number | null {
    if (!nodo) return null;
    if (nodo === 'N0') return 0;
    return this.dc?.op.nodos[nodo] ?? null;
  }

  tensionRed(red: string): number | null {
    return this.tension(this.nodoDeRed.get(red) ?? null);
  }

  /** Multimeter reading V(red) − V(black), or null. */
  readonly lectura = $derived.by(() => {
    const a = this.tension(this.roja);
    const b = this.tension(this.negra);
    return a == null || b == null ? null : a - b;
  });

  // ---------------------------------------------------------------- actions
  ponerPunta(nodo: string): void {
    if (this.siguiente === 'roja') this.roja = nodo;
    else {
      this.negra = nodo;
      this.siguiente = 'roja';
    }
  }

  /** Records a multimeter measurement (called when the reading settles). */
  anotar(donde: string, valor: string): void {
    const ultima = this.medidas[this.medidas.length - 1];
    if (ultima && ultima.donde === donde && ultima.valor === valor) return;
    this.medidas = [...this.medidas.slice(-39), { donde, valor, t: Date.now() }];
    const red = this.roja ? this.redDeNodo.get(this.roja) : null;
    if (red && this.negra === 'N0' && !this.redesMedidas.includes(red)) this.redesMedidas = [...this.redesMedidas, red];
  }

  verTP(id: string): void {
    this.tp = id;
    if (!this.tpsVistos.includes(id)) this.tpsVistos = [...this.tpsVistos, id];
  }

  /** Puts a fault in an aligned kit (or removes it). */
  inyectar(a: Averia | null): void {
    const c = alineado();
    if (a?.senal.w1 != null) c.w1 = a.senal.w1;
    if (a?.senal.w3 != null) c.w3 = a.senal.w3;
    if (a?.senal.l1 != null) c.l1 = a.senal.l1;
    // A strong station tuned, as when the reader turns the radio on.
    c.dial = dialPara(c, 98.0e6) ?? c.dial;
    this.c = c;
    this.averia = a;
    this.limpiarSeleccion();
    this.medidas = [];
    this.redesMedidas = [];
    this.tpsVistos = [];
    this.roja = null;
    this.negra = 'N0';
  }

  reiniciar(alinear: boolean): void {
    this.c = alinear ? alineado() : { ...RECIEN_MONTADO };
    this.averia = null;
  }

  // ---------------------------------------------------------------- bringing things into view
  /** Region the viewer should show (a new object each time). */
  enfoque = $state.raw<{ caja: [number, number, number, number] } | null>(null);

  enfocarCaja(c: [number, number, number, number], margen = 60): void {
    this.enfoque = { caja: [c[0] - margen, c[1] - margen, c[2] + margen, c[3] + margen] };
  }

  /** Selects a part (designator) and brings it into view. */
  elegirPieza(ref: string | null, enfocar = true): void {
    this.pieza = ref;
    if (!ref) return;
    const el = this.kit.esquema.elementos.find((e) => e.designador === ref);
    if (el?.caja && enfocar) {
      // Not closer than a useful neighbourhood of the part.
      const [x0, y0, x1, y1] = el.caja as [number, number, number, number];
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const m = Math.max(150, (x1 - x0) / 2 + 60, (y1 - y0) / 2 + 60);
      this.enfocarCaja([cx - m, cy - m * 0.65, cx + m, cy + m * 0.65], 0);
    }
    if (el) this.est.seleccion = { k: 'elem', id: el.id };
  }

  limpiarSeleccion(): void {
    this.pieza = null;
    this.bloque = null;
    this.est.seleccion = null;
    this.est.hover = null;
  }

  /** Selects a stage of the signal path and brings it into view. */
  elegirEtapa(id: string | null): void {
    this.etapa = id;
    const e = id ? this.kit.etapas.find((x) => x.id === id) : null;
    if (!e) return;
    const pts = e.trazos.flat();
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    this.enfocarCaja([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], 50);
    if (id === 'mpx' || id === 'detector') this.verTP('TP3');
    else if (id === 'fi') this.verTP('TP2');
    else if (id === 'potencia' || id === 'volumen') this.verTP('audio');
  }

  enfocarBloque(n: number): void {
    const b = this.kit.bloques[String(n)];
    this.bloque = n;
    if (b) this.enfocarCaja(b.caja, 10);
  }

  enfocarNodo(nodo: string): void {
    const n = this.kit.esquema.nodos.find((x) => x.id === nodo);
    if (!n) return;
    const pts = this.kit.esquema.puntos.filter((p) => p.nodo === nodo).map((p) => p.xy);
    if (!pts.length) return;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    this.enfocarCaja([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], 80);
  }
}

/** Nearest net of a schematic point, for a probe (wire, node, or the nearest terminal of a part). */
export function nodoEn(k: EstadoKit, X: number, Y: number, radio: number): string | null {
  const s = k.est.buscar(X, Y, radio);
  if (!s) return null;
  if (s.k !== 'elem') return k.est.nodoDe(s);
  const e = k.kit.esquema.elementos.find((x) => x.id === s.id);
  if (!e) return null;
  let mejor: string | null = null;
  let d = Infinity;
  for (const [t, n] of Object.entries(e.terminales ?? {})) {
    const a = e.anclas[t];
    if (!a) continue;
    const dd = Math.hypot(a[0] - X, a[1] - Y);
    if (dd < d) {
      d = dd;
      mejor = n;
    }
  }
  return mejor;
}

/** A readable name for a node: its label, or the parts and pins it joins. */
export function nombreNodo(k: EstadoKit, nodo: string | null): string {
  if (!nodo) return '—';
  if (nodo === 'N0') return 'masa';
  const n = k.kit.esquema.nodos.find((x) => x.id === nodo);
  if (!n) return nodo;
  if (n.etiquetas?.length) return n.etiquetas[0]!;
  const partes: string[] = [];
  for (const t of n.terminales) {
    const [el, term] = t.split('.') as [string, string];
    const ref = k.refDeElem.get(el);
    if (!ref || /^(G|V)\d+$/.test(ref)) continue;
    partes.push(/^p\d+$/.test(term) ? `${ref} (${term.slice(1)})` : ref);
    if (partes.length >= 3) break;
  }
  return partes.length ? partes.join(', ') : nodo;
}
