// «La protoboard por dentro» (0.11) on a board being edited: the screen shown, what the last tap lit up, the
// answers to the questions (a second try after a wrong one), and what comes after (the guided circuit chosen).
// The board is an empty one while it lasts; the one before comes back at the end.

import { encapsuladoDe, patasDip } from './encapsulados.ts';
import { agujero, type Pt } from './placa.ts';
import { explicarGrupo, grupoDe, marcarLeccion, pantallasLeccion, respuesta, unidos, nombre, type PantallaLeccion } from './leccion.ts';
import { montajeVacio } from './vacio.ts';
import type { Protoboard } from './estado.svelte';
import type { PlanGuia } from './guia.ts';
import { empezarGuia } from './guia.svelte.ts';
import type { DocumentoProtoboard, Pieza } from './tipos.ts';

export class Leccion {
  private readonly pb: Protoboard;
  readonly pantallas: PantallaLeccion[];
  /** The board before the lesson. */
  readonly anterior: DocumentoProtoboard;
  /** The guided circuit that follows (null: back to the board). */
  readonly siguiente: PlanGuia | null;
  i = $state(0);
  /** Holes lit (the strips or rails tapped). */
  luces = $state.raw<Pt[]>([]);
  /** Holes to look at (the question's). */
  marcas = $state.raw<Pt[]>([]);
  /** A DIP drawn across the channel (the channel screen). */
  silueta = $state.raw<Pieza | null>(null);
  texto = $state('');
  resultado = $state<'bien' | 'mal' | 'visto' | null>(null);
  intentos = $state(0);
  private canal: { e?: number; f?: number } = {};

  constructor(pb: Protoboard, siguiente: PlanGuia | null, anterior: DocumentoProtoboard) {
    this.pb = pb;
    this.siguiente = siguiente;
    this.anterior = anterior;
    this.pantallas = pantallasLeccion({ placas: 1, columnas: 30 });
    this.preparar();
  }

  get cfg() {
    return { placas: this.pb.doc.placas, columnas: this.pb.doc.columnas };
  }

  get pantalla(): PantallaLeccion {
    return this.pantallas[this.i]!;
  }

  /** The screen is done: «Siguiente» may be pressed. */
  get listo(): boolean {
    return this.pantalla.tipo === 'final' || this.resultado === 'bien' || this.resultado === 'visto';
  }

  private preparar() {
    const p = this.pantalla;
    this.luces = [];
    this.silueta = null;
    this.texto = '';
    this.resultado = null;
    this.intentos = 0;
    this.canal = {};
    this.marcas = p.tipo === 'pregunta' ? [p.a, p.b] : p.tipo === 'tocar' ? [p.a] : p.tipo === 'explorar' && p.pide === 'canal' ? [[8, 7], [8, 10]] : p.tipo === 'explorar' && p.pide === 'riel' ? [[14, 0]] : [];
  }

  avanzar(): void {
    if (this.i < this.pantallas.length - 1) {
      this.i++;
      this.preparar();
    }
  }

  /** A tap on the board (snapped to the nearest hole). */
  tocar(q: Pt | null): void {
    const p = this.pantalla;
    if (!q) return;
    const a = agujero(this.cfg, q[0], q[1]);
    if (!a) return;
    if (p.tipo === 'explorar') {
      if (p.pide === 'canal') {
        const fila = a.fila;
        if (a.tipo === 'tira' && (fila === 'e' || fila === 'f')) {
          if (fila === 'e') this.canal = { e: a.x, ...(this.canal.f === a.x ? { f: a.x } : {}) };
          else this.canal = { f: a.x, ...(this.canal.e === a.x ? { e: a.x } : {}) };
          const { e, f } = this.canal;
          if (e != null && f != null && e === f) {
            this.luces = [...grupoDe(this.cfg, [e, 7]), ...grupoDe(this.cfg, [e, 10])];
            this.texto = `e${e} y f${e} no se encienden juntos: son dos tiras, una a cada lado del canal. ${p.texto}`;
            const x = Math.min(Math.max(e - 1, 1), this.cfg.columnas - 3);
            const comp = { id: 'leccion-dip', tipo: 'T555', nombre: '', x: 0, y: 0, o: 0, campos: { modelo: 'ne555' } };
            this.silueta = { id: 'leccion-dip', comp, enc: 'dip', pos: patasDip([x, 10], [1, 0], 8), patas: encapsuladoDe(comp).patas };
            this.resultado = 'bien';
          } else {
            this.luces = grupoDe(this.cfg, q);
            this.texto = `${explicarGrupo(this.cfg, q)} Ahora toque el de la fila ${fila === 'e' ? 'f' : 'e'} de la columna ${a.x}.`;
          }
        } else {
          this.luces = grupoDe(this.cfg, q);
          this.texto = `${explicarGrupo(this.cfg, q)} Pruebe con un agujero de la fila e, junto al canal central.`;
        }
        return;
      }
      this.luces = grupoDe(this.cfg, q);
      if (p.pide === 'riel') {
        if (a.tipo === 'riel') {
          this.texto = `${explicarGrupo(this.cfg, q)} ${p.texto}`;
          this.resultado = 'bien';
        } else this.texto = 'Eso es una tira de cinco. El carril es la fila del borde de la placa, marcada con + (o con −).';
        return;
      }
      this.texto = `${explicarGrupo(this.cfg, q)} ${p.texto}`;
      this.resultado = 'bien';
      return;
    }
    if (p.tipo === 'pregunta') {
      // Looking before answering: what a tap lights up.
      this.luces = grupoDe(this.cfg, q);
      return;
    }
    if (p.tipo === 'tocar' && this.resultado !== 'bien' && this.resultado !== 'visto') {
      const ok = unidos(this.cfg, q, p.a) && (q[0] !== p.a[0] || q[1] !== p.a[1]);
      this.luces = grupoDe(this.cfg, q);
      if (ok) {
        this.resultado = 'bien';
        this.texto = `Sí: ${nombre(this.cfg, q)} está en la misma tira que ${nombre(this.cfg, p.a)}.`;
      } else if (++this.intentos < 2) {
        this.resultado = 'mal';
        this.texto = q[0] === p.a[0] && q[1] === p.a[1] ? 'Ese es el mismo agujero: toque otro que esté unido a él.' : `No: ${nombre(this.cfg, q)} no está en la tira de ${nombre(this.cfg, p.a)}. Mire qué se ha encendido y pruebe otra vez.`;
      } else {
        this.resultado = 'visto';
        this.luces = grupoDe(this.cfg, p.a);
        this.texto = `Los que están unidos a ${nombre(this.cfg, p.a)} son los que brillan ahora: su misma columna, en la misma mitad.`;
      }
    }
  }

  /** «Sí» / «No» to a question. */
  responder(si: boolean): void {
    const p = this.pantalla;
    if (p.tipo !== 'pregunta' || this.resultado === 'bien' || this.resultado === 'visto') return;
    const r = respuesta(this.cfg, p.a, p.b);
    if (si === r.si) {
      this.resultado = 'bien';
      this.texto = r.texto;
      this.luces = [...grupoDe(this.cfg, p.a), ...(r.si ? [] : grupoDe(this.cfg, p.b))];
    } else if (++this.intentos < 2) {
      this.resultado = 'mal';
      this.texto = 'No es eso. Piense por dónde van las pinzas de metal por dentro (toque los agujeros para verlo) y pruebe otra vez.';
    } else {
      this.resultado = 'visto';
      this.texto = r.texto;
      this.luces = [...grupoDe(this.cfg, p.a), ...(r.si ? [] : grupoDe(this.cfg, p.b))];
    }
  }

  /** Seen once, whether finished or skipped. */
  marcar(): void {
    marcarLeccion();
  }
}

/** The board of the lesson: the empty one. */
export const tableroLeccion = (): DocumentoProtoboard => montajeVacio('La protoboard por dentro');

/** Starts the lesson (then `siguiente`, if any) on an empty board; the board before it is kept. */
export function empezarLeccion(pb: Protoboard, siguiente: PlanGuia | null): Leccion {
  const anterior = JSON.parse(JSON.stringify($state.snapshot(pb.doc))) as DocumentoProtoboard;
  pb.guia = null;
  pb.cargar(tableroLeccion(), false);
  const l = new Leccion(pb, siguiente, anterior);
  pb.leccion = l;
  pb.sel = [];
  pb.armada = null;
  pb.herramienta = 'explorar';
  return l;
}

/** Ends the lesson: on to its guided circuit, or back to the board before it. */
export function terminarLeccion(pb: Protoboard, seguir: boolean): void {
  const l = pb.leccion;
  if (!l) return;
  pb.leccion = null;
  pb.herramienta = 'seleccionar';
  if (seguir && l.siguiente) empezarGuia(pb, l.siguiente, l.anterior);
  else pb.cargar(l.anterior, false);
}
