// «Monta este circuito» (0.11) on a board being edited: the plan (guia.ts), the board it replaced (restored on
// leaving), the state of every step after each change, the moment a step is done (to say why that part goes
// there) and the end (after a simulation that proves it: the LED lit, the voltage of the output).

import { evaluar, type EstadoGuia, type PasoGuia, type PlanGuia } from './guia.ts';
import type { Protoboard } from './estado.svelte';
import type { DocumentoProtoboard } from './tipos.ts';

export class Guia {
  readonly plan: PlanGuia;
  private readonly pb: Protoboard;
  /** The board before the guide started (back to it on «Salir»). */
  readonly anterior: DocumentoProtoboard;
  /** The page's simulation proved it works. */
  probado = $state(false);
  /** The last step done (its «why» is shown until the next one is done). */
  ultimo = $state<PasoGuia | null>(null);
  /** Board version when `ultimo` was set: its «why» shows until the next change. */
  versionUltimo = $state(-1);
  /** Shown once all is done and proved. */
  celebrado = $state(false);

  /** Ids of the pieces and wires in the order they appeared (the newest wrong one is explained). */
  private vistos: string[] = [];

  readonly estado: EstadoGuia = $derived.by(() => {
    void this.pb.version;
    const doc = this.pb.doc;
    const ahora = new Set([...doc.piezas.map((p) => p.id), ...doc.cables.map((w) => w.id)]);
    this.vistos = this.vistos.filter((id) => ahora.has(id));
    for (const id of ahora) if (!this.vistos.includes(id)) this.vistos.push(id);
    return evaluar(this.plan, doc, this.pb.con, this.probado, this.vistos);
  });

  constructor(pb: Protoboard, plan: PlanGuia, anterior?: DocumentoProtoboard) {
    this.pb = pb;
    this.plan = plan;
    this.anterior = anterior ?? (JSON.parse(JSON.stringify($state.snapshot(pb.doc))) as DocumentoProtoboard);
  }

  get paso(): PasoGuia | null {
    return this.plan.pasos[this.estado.actual] ?? null;
  }

  /** Steps of the board done (the simulation not counted). */
  get montados(): number {
    return this.estado.hechos.filter((h, i) => h && this.plan.pasos[i]!.tipo !== 'simular').length;
  }

  get total(): number {
    return this.plan.pasos.filter((p) => p.tipo !== 'simular').length;
  }

  /** Every part and wire in place (the simulation still to do). */
  get montado(): boolean {
    return this.montados === this.total;
  }

  /** Parts still to put, in plan order (the tray shows them). */
  get pendientes(): Extract<PasoGuia, { tipo: 'pieza' }>[] {
    return this.plan.pasos.filter((p, i): p is Extract<PasoGuia, { tipo: 'pieza' }> => p.tipo === 'pieza' && !this.estado.hechos[i]);
  }

  /** Does the current step for the user (the last resort, as the instruments' tutor). */
  hacerPaso(): void {
    const p = this.paso;
    if (!p || p.tipo === 'simular') return;
    const pb = this.pb;
    if (p.tipo === 'cable') {
      pb.anadirCable(p.a, p.b, p.color);
      return;
    }
    // A misplaced copy of that part goes first.
    const mal = pb.doc.piezas.find((x) => x.comp.nombre.toUpperCase() === p.pieza.comp.nombre.toUpperCase());
    if (mal) pb.borrar([mal.id]);
    pb.anadirEn(p.pieza, p.pieza.pos);
  }
}

/** Starts a guided circuit on the board (the board before it — or `anterior` — comes back on «Salir»). */
export function empezarGuia(pb: Protoboard, plan: PlanGuia, anterior?: DocumentoProtoboard): Guia {
  const g = new Guia(pb, plan, anterior);
  pb.cargar(JSON.parse(JSON.stringify(plan.inicio)) as DocumentoProtoboard, false);
  pb.guia = g;
  pb.sel = [];
  pb.armada = null;
  pb.herramienta = 'seleccionar';
  return g;
}
