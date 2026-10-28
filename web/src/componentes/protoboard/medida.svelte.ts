// The instruments on the breadboard (0.10): the bench of componentes/instrumentos/ (Brymen BM869s, FNIRSI
// 2C53T, earphone) measuring the circuit that is plugged in. Leads and probes go into holes (or onto an
// equipment terminal) as real ones do; the net of that hole is the node the bench connects them to, so the
// bench's own models do the rest: a multimeter's leads across two nets (a voltmeter, an ohmmeter, or on a
// current jack its shunt: in series where the user opened the circuit, a short where they did not, and then
// the fuse blows), the oscilloscope's probes with their ground clip, and the FNIRSI generator's two leads,
// which add a source between their nets (`VFNGEN`, driven by the DDS). A lead in a strip with nothing on it
// touches nothing. The bench simulates the board's netlist (always with a transient: oscillators, edges).

import { Banco } from '../instrumentos/banco.svelte.ts';
import { NOMBRE_PUNTA_PROTO, PUNTAS_PROTO, type Punta, type PuntaProto } from '../instrumentos/puntas.ts';
import { redEn } from './conexiones.ts';
import type { Protoboard } from './estado.svelte';
import type { Pt } from './placa.ts';
import type { Tutor } from './tutor.svelte.ts';

export { NOMBRE_PUNTA_PROTO, PUNTAS_PROTO, type PuntaProto } from '../instrumentos/puntas.ts';

/** The source the generator's leads add to the circuit. */
export const GENERADOR = 'VFNGEN';

const DEL_BANCO: Punta[] = ['bmRojo', 'bmNegro', 'fnRojo', 'fnNegro', 'ch1', 'ch2', 'masa', 'esc'];

export class MedidaProtoboard {
  readonly b = new Banco();
  /** Where each lead is (a hole or an equipment terminal). */
  puntas = $state<Partial<Record<PuntaProto, Pt>>>({});
  /** The lead the next tap places. */
  activa = $state<PuntaProto | null>('bmRojo');
  /** «¿Qué quieres medir?» (tutor.svelte.ts), set by the panel. */
  tutor = $state.raw<Tutor | null>(null);
  readonly pb: Protoboard;

  constructor(pb: Protoboard) {
    this.pb = pb;
    this.b.dinamico = true;
    this.b.arranque = true;
  }

  /** Net of a point of the board, or null (an empty strip, off the board). */
  nodoEn(q: Pt): string | null {
    return redEn(this.pb.doc, this.pb.con, q[0], q[1]);
  }

  nodoDe(p: PuntaProto): string | null {
    const q = this.puntas[p];
    return q ? this.nodoEn(q) : null;
  }

  /** Places the active lead at a point; returns what it touches (Spanish). */
  colocar(q: Pt): string {
    const p = this.activa;
    if (!p) return 'Elija primero una punta en el panel «Medir».';
    for (const [k, v] of Object.entries(this.puntas)) if (k !== p && v && v[0] === q[0] && v[1] === q[1]) return 'Ya hay otra punta en ese agujero.';
    this.puntas = { ...this.puntas, [p]: q };
    const n = this.nodoEn(q);
    return `${NOMBRE_PUNTA_PROTO[p]}: ${n === null ? 'en una tira vacía (no toca nada)' : n === '0' ? 'en la masa' : `en la red ${n}`}.`;
  }

  quitar(p: PuntaProto): void {
    const r = { ...this.puntas };
    delete r[p];
    this.puntas = r;
  }

  /** Brings the bench up to date with the board and the leads (called by an effect of the panel). */
  sincronizar(): void {
    const b = this.b;
    const gr = this.nodoDe('genRojo');
    const gn = this.nodoDe('genNegro');
    const conGen = !!(gr && gn && gr !== gn);
    let texto = this.pb.nl.texto;
    if (conGen) {
      const l = texto.split('\n');
      l.splice(1, 0, `${GENERADOR} ${gr} ${gn} DC 0`);
      texto = l.join('\n');
    }
    if (texto !== b.texto) {
      b.texto = texto;
      b.original = texto;
    }
    const fg = conGen ? GENERADOR : null;
    if (b.fuenteGenerador !== fg) b.fuenteGenerador = fg;
    if (b.titulo !== this.pb.doc.titulo) b.titulo = this.pb.doc.titulo;
    for (const p of DEL_BANCO) {
      const n = this.nodoDe(p) ?? (p === 'masa' ? '0' : null);
      const actual =
        p === 'bmRojo' ? b.bm.rojo : p === 'bmNegro' ? b.bm.negro : p === 'fnRojo' ? b.fn.rojo : p === 'fnNegro' ? b.fn.negro : p === 'esc' ? b.auricular : b.sondas[p];
      if (actual !== n) b.poner(p, n);
    }
  }

  /** The leads drawn on the board. */
  get dibujo(): { p: PuntaProto; q: Pt }[] {
    return PUNTAS_PROTO.flatMap((p) => (this.puntas[p] ? [{ p, q: this.puntas[p]! }] : []));
  }
}
