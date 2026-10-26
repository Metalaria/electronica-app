// The player of «Un fotograma»: the time cursor over a segment of the trace, the playback speeds and steps, and
// what is alive at every instant (the bus accesses in progress and the nets they move, with an «energy» that fades
// so that fast playback still shows where the signals went). Plain class, no Svelte state: the canvases read it
// every animation frame; the panels get a snapshot (`foto()`) a few times per second.

import { Traza, ultimoHasta, type BusDecodificado } from './traza';
import type { AccesoBus, Adaptador, GrupoSenal, RedActiva, SegmentoTraza } from './tipos';

export type Nivel = 'cuadro' | 'linea' | 'puntos' | 'ciclo';

export const NIVELES: { id: Nivel; titulo: string; ayuda: string }[] = [
  { id: 'cuadro', titulo: 'Cuadro entero', ayuda: 'Todo el tramo en unos 30 s' },
  { id: 'linea', titulo: 'Una línea', ayuda: 'Una línea de vídeo en unos 8 s' },
  { id: 'puntos', titulo: 'Unos puntos', ayuda: 'Unos pocos puntos por segundo: se ve cada lectura' },
  { id: 'ciclo', titulo: 'Un ciclo', ayuda: 'Un ciclo de la CPU por segundo; los botones avanzan ciclo a ciclo' },
];

export interface RedViva {
  red: string;
  grupo: GrupoSenal;
  nivel: 0 | 1 | null;
  energia: number;
  desde?: string;
}

export interface FotoEstado {
  t: number;
  /** Position inside the segment, 0–1. */
  x: number;
  linea: number;
  punto: number;
  fase: string;
  faseTitulo: string;
  /** Index of the current instruction in the trace (-1 before the first). */
  ins: number;
  pc: number;
  regs: { nombre: string; valor: number }[];
  /** Current access of every bus (null when the bus is idle). */
  accesos: { bus: string; titulo: string; ev: AccesoBus; chip: string; tipo?: string }[];
  senales: { id: string; titulo: string; nivel: number; activa: boolean }[];
  /** Pixels drawn so far in the segment. */
  pixeles: number;
}

export class Reproductor {
  readonly traza: Traza;
  readonly ad: Adaptador;
  seg: SegmentoTraza;
  t: number;
  jugando = false;
  nivel: Nivel = 'linea';
  /** Distance the pulses have moved (CSS px); grows with wall time even when paused. */
  avance = 0;
  readonly redes = new Map<string, RedViva>();
  private readonly cpuBus: BusDecodificado;
  private readonly duraciones: number[];
  private readonly durMax: number[];
  /** Time units per video dot. */
  readonly upp: number;
  private readonly linT: ArrayLike<number> | null;
  private readonly linN: ArrayLike<number> | null;
  private readonly tmp: RedActiva[] = [];
  /** Called after every change of time (canvases redraw). */
  readonly oyentes = new Set<() => void>();

  constructor(traza: Traza, ad: Adaptador, seg: SegmentoTraza) {
    this.traza = traza;
    this.ad = ad;
    this.seg = seg;
    this.t = seg.t0;
    const cpu = traza.m.cpus[0]!;
    this.cpuBus = traza.buses.find((b) => b.def.id === cpu.id) ?? traza.buses[0]!;
    this.duraciones = traza.buses.map((b) => b.def.duracion ?? (b === this.cpuBus || b.def.id === 'dma' ? cpu.unidadesPorCiclo : 2));
    this.durMax = traza.buses.map((b, i) => Math.max(this.duraciones[i]!, ...(b.def.duraciones ?? [])));
    this.upp = traza.m.video.unidadesPorPunto ?? 1;
    const v = traza.m.video;
    this.linT = v.lineasT ? traza.array(v.lineasT) : null;
    this.linN = v.lineasN ? traza.array(v.lineasN) : null;
    this.actualizar(this.t, this.t, 0, true);
  }

  /** Units the access i of bus bi lasts (BusTraza.duraciones by kind, else duracion, else the default). */
  duracion(bi: number, i: number): number {
    const b = this.traza.buses[bi]!;
    const porTipo = b.def.duraciones;
    if (porTipo && b.k) return porTipo[b.k[i]!] ?? this.duraciones[bi]!;
    return this.duraciones[bi]!;
  }

  get unidadesCiclo(): number {
    return this.traza.m.cpus[0]!.unidadesPorCiclo;
  }

  /** Units per second of wall time at the current level. */
  velocidad(): number {
    const v = this.traza.m.video;
    switch (this.nivel) {
      case 'cuadro':
        return (this.seg.t1 - this.seg.t0) / 30;
      case 'linea':
        return (v.puntosPorLinea * this.upp) / 8;
      case 'puntos':
        return 5 * this.upp;
      default:
        return this.unidadesCiclo;
    }
  }

  /** Slow-down factor against the real hardware (real units per second / shown units per second). */
  ralentizacion(): number {
    return this.traza.m.reloj.hz / this.velocidad();
  }

  cambiarSegmento(seg: SegmentoTraza): void {
    this.seg = seg;
    this.jugando = false;
    this.irA(seg.t0);
  }

  /** One animation frame of `dt` seconds. Returns true while something moves. */
  tick(dt: number): boolean {
    this.avance += dt * 46;
    const t0 = this.t;
    if (this.jugando) {
      this.t = Math.min(this.seg.t1, this.t + this.velocidad() * dt);
      if (this.t >= this.seg.t1) this.jugando = false;
    }
    this.actualizar(t0, this.t, dt, false);
    this.avisar();
    return true;
  }

  avisar(): void {
    for (const f of this.oyentes) f();
  }

  irA(t: number): void {
    const tt = Math.max(this.seg.t0, Math.min(this.seg.t1, t));
    this.t = tt;
    this.actualizar(tt, tt, 0, true);
    this.avisar();
  }

  // ---------------------------------------------------------------- steps

  /** Start of the CPU cycle after (dir 1) or before (dir -1) the current one. */
  pasoCiclo(dir: 1 | -1): void {
    const b = this.cpuBus;
    const i = ultimoHasta(b.t, this.t);
    let j = dir > 0 ? i + 1 : this.t > b.t[i]! + 1e-9 ? i : i - 1;
    j = Math.max(0, Math.min(b.t.length - 1, j));
    const t = b.t[j]!;
    if (dir > 0 && t <= this.t) {
      // the CPU is stopped (HALT, DMA…): one cycle of time
      this.irA(this.t + this.unidadesCiclo);
      return;
    }
    this.irA(t);
  }

  pasoInstruccion(dir: 1 | -1): void {
    const ins = this.traza.ins;
    const i = ultimoHasta(ins.t, this.t);
    let j = dir > 0 ? i + 1 : this.t > ins.t[i]! + 1e-9 ? i : i - 1;
    j = Math.max(0, Math.min(ins.t.length - 1, j));
    const t = ins.t[j]!;
    if (t < this.seg.t0 || t > this.seg.t1) return;
    this.irA(t);
  }

  pasoLinea(dir: 1 | -1): void {
    if (!this.linT) return this.irA(this.t + dir * this.traza.m.video.puntosPorLinea * this.upp);
    const i = ultimoHasta(this.linT, this.t);
    let j = dir > 0 ? i + 1 : this.t > this.linT[i]! + 1e-9 ? i : i - 1;
    j = Math.max(0, Math.min(this.linT.length - 1, j));
    this.irA(this.linT[j]!);
  }

  /** Next or previous access of a bus. */
  pasoAcceso(bus: string, dir: 1 | -1): void {
    const b = this.traza.buses.find((x) => x.def.id === bus);
    if (!b) return;
    const i = ultimoHasta(b.t, this.t);
    let j = dir > 0 ? i + 1 : this.t > b.t[i]! + 1e-9 ? i : i - 1;
    j = Math.max(0, Math.min(b.t.length - 1, j));
    this.irA(b.t[j]!);
  }

  /** Index of the instruction in progress (the last one started at or before t). */
  indiceInstruccion(t = this.t): number {
    return ultimoHasta(this.traza.ins.t, t);
  }

  lineaPunto(t = this.t): { linea: number; punto: number } {
    if (this.linT && this.linN) {
      const i = ultimoHasta(this.linT, t);
      if (i >= 0) return { linea: this.linN[i]!, punto: Math.floor((t - this.linT[i]!) / this.upp) };
    }
    const v = this.traza.m.video;
    const n = Math.floor(t / (v.puntosPorLinea * this.upp));
    return { linea: n % v.lineas, punto: Math.floor((t - n * v.puntosPorLinea * this.upp) / this.upp) };
  }

  fase(t = this.t): { id: string; titulo: string; k: number } {
    const f = this.traza.m.fases;
    const ft = this.traza.array(f.t);
    const fk = this.traza.array(f.k);
    const i = ultimoHasta(ft, t);
    const tipo = i >= 0 ? f.tipos[fk[i]!] : undefined;
    return { id: tipo?.id ?? '', titulo: tipo?.titulo ?? '', k: i >= 0 ? fk[i]! : -1 };
  }

  /** Pixels output up to t (index into pixeles.*). */
  pixelesHasta(t = this.t): number {
    const pt = this.traza.array(this.traza.m.pixeles.t);
    return Math.max(this.seg.pixel0, Math.min(this.seg.pixel1, ultimoHasta(pt, t, this.seg.pixel0, this.seg.pixel1 - 1) + 1));
  }

  // ---------------------------------------------------------------- live nets

  private poner(r: RedActiva, energia: number): void {
    const e = this.redes.get(r.red);
    if (e) {
      e.grupo = r.grupo;
      e.nivel = r.nivel;
      e.desde = r.desde ?? e.desde;
      e.energia = Math.max(e.energia, energia);
    } else this.redes.set(r.red, { red: r.red, grupo: r.grupo, nivel: r.nivel, energia, desde: r.desde });
  }

  private actualizar(ta: number, tb: number, dt: number, salto: boolean): void {
    if (salto) this.redes.clear();
    else {
      const f = Math.exp(-dt / 0.45);
      for (const [k, e] of this.redes) {
        e.energia *= f;
        if (e.energia < 0.02) this.redes.delete(k);
      }
    }
    const tr = this.traza;
    const out = this.tmp;
    for (let bi = 0; bi < tr.buses.length; bi++) {
      const b = tr.buses[bi]!;
      const fin = ultimoHasta(b.t, tb);
      if (fin < 0) continue;
      let ini = ultimoHasta(b.t, Math.min(ta, tb) - this.durMax[bi]!);
      ini = Math.max(ini, fin - 160, 0);
      for (let i = ini; i <= fin; i++) {
        const tev = b.t[i]!;
        const dur = this.duracion(bi, i);
        const actual = i === fin && tb - tev < dur;
        if (!actual && tev + dur <= ta && !salto) continue;
        if (!actual && salto) continue;
        out.length = 0;
        const ev = tr.acceso(b, i, tb);
        if (actual) {
          ev.fase = tb - tev;
          this.ad.redesAcceso(b.def.id, ev, out);
        } else {
          ev.fase = 0;
          this.ad.redesAcceso(b.def.id, ev, out);
          ev.fase = dur - 0.5;
          this.ad.redesAcceso(b.def.id, ev, out);
        }
        for (const r of out) this.poner(r, 1);
      }
    }
    // signals: the active ones stay visible, a change lights them up
    const tipos = tr.m.senales.tipos;
    for (let k = 0; k < tipos.length; k++) {
      const s = tr.senales[k]!;
      if (!s.t.length) continue;
      const nivel = tr.nivel(k, tb);
      const activa = tipos[k]!.activaBaja ? nivel === 0 : nivel === 1;
      const ib = ultimoHasta(s.t, tb);
      const cambio = ib >= 0 && s.t[ib]! > Math.min(ta, tb) - (salto ? 1 : 0) && s.t[ib]! <= tb;
      if (!activa && !cambio) continue;
      out.length = 0;
      this.ad.redesSenal(tipos[k]!.id, nivel, out);
      for (const r of out) this.poner(r, cambio ? 1 : 0.7);
    }
    // the pixel going out
    if (this.ad.redesPixel) {
      const pt = tr.array(tr.m.pixeles.t);
      const pc = tr.array(tr.m.pixeles.c);
      const i = ultimoHasta(pt, tb, this.seg.pixel0, this.seg.pixel1 - 1);
      if (i >= this.seg.pixel0 && pt[i]! > Math.min(ta, tb) - 1.5) {
        out.length = 0;
        this.ad.redesPixel(pc[i]!, out);
        for (const r of out) this.poner(r, 1);
      }
    }
    for (const r of this.ad.relojes) this.poner(r, 0.3);
  }

  /** Snapshot for the panels. */
  foto(): FotoEstado {
    const tr = this.traza;
    const t = this.t;
    const { linea, punto } = this.lineaPunto(t);
    const f = this.fase(t);
    const ins = tr.ins;
    const ii = this.indiceInstruccion(t);
    const regs = ins.nombres.map((nombre, k) => ({ nombre, valor: ii >= 0 ? ins.r[k]![ii]! : 0 }));
    const accesos: FotoEstado['accesos'] = [];
    for (let bi = 0; bi < tr.buses.length; bi++) {
      const b = tr.buses[bi]!;
      const i = ultimoHasta(b.t, t);
      if (i < 0 || t - b.t[i]! >= this.duracion(bi, i)) continue;
      const ev = tr.acceso(b, i, t);
      accesos.push({
        bus: b.def.id,
        titulo: b.def.titulo,
        ev,
        chip: b.def.chips[b.c[i]!]?.titulo ?? '',
        tipo: b.k && b.def.tipos ? b.def.tipos[b.k[i]!]?.titulo : undefined,
      });
    }
    const senales = tr.m.senales.tipos.map((s, k) => {
      const nivel = tr.nivel(k, t);
      return { id: s.id, titulo: s.titulo, nivel, activa: s.activaBaja ? nivel === 0 : nivel === 1 };
    });
    return {
      t,
      x: (t - this.seg.t0) / Math.max(1, this.seg.t1 - this.seg.t0),
      linea,
      punto,
      fase: f.id,
      faseTitulo: f.titulo,
      ins: ii,
      pc: ii >= 0 ? ins.pc[ii]! : 0,
      regs,
      accesos,
      senales,
      pixeles: this.pixelesHasta(t) - this.seg.pixel0,
    };
  }
}
