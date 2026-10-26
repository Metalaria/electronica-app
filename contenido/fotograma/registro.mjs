// Recorder of the events of a trace while an emulator runs (only inside the recorded segments), turned into the
// arrays of an «EPAF» trace by `arrays()`. Shared by every generator (see ESQUEMA.md, «Un fotograma»).

export class Registro {
  constructor() {
    this.activo = false;
    this.buses = {}; // id -> {t, a, d, f, c, k}
    this.ins = { t: [], pc: [], ciclo: [], k: [], r: {} };
    this.fases = { t: [], k: [], linea: [] };
    this.sen = { t: [], k: [], v: [] };
    this.px = { t: [], c: [] };
    this.lin = { t: [], n: [] };
    this.segmentos = [];
  }

  bus(id, t, a, d, f, c, k = 0) {
    if (!this.activo) return;
    let b = this.buses[id];
    if (!b) b = this.buses[id] = { t: [], a: [], d: [], f: [], c: [], k: [] };
    b.t.push(t);
    b.a.push(a);
    b.d.push(d);
    b.f.push(f);
    b.c.push(c);
    b.k.push(k);
  }

  /** Index of the next event of a bus (the first cycle of an instruction). */
  siguiente(id) {
    return this.buses[id]?.t.length ?? 0;
  }

  instruccion(t, pc, k, regs, cpu = 'cpu') {
    if (!this.activo) return;
    this.ins.t.push(t);
    this.ins.pc.push(pc);
    this.ins.ciclo.push(this.siguiente(cpu));
    this.ins.k.push(k);
    for (const [n, v] of Object.entries(regs)) (this.ins.r[n] ??= []).push(v);
  }

  fase(t, k, linea) {
    if (!this.activo) return;
    this.fases.t.push(t);
    this.fases.k.push(k);
    this.fases.linea.push(linea);
  }

  senal(t, k, v) {
    if (!this.activo) return;
    this.sen.t.push(t);
    this.sen.k.push(k);
    this.sen.v.push(v);
  }

  /** Start (dot 0) of a video line. */
  lineaVideo(t, n) {
    if (!this.activo) return;
    this.lin.t.push(t);
    this.lin.n.push(n);
  }

  pixel(t, c) {
    if (!this.activo || !this.conPixeles) return;
    this.px.t.push(t);
    this.px.c.push(c);
  }

  /** Starts a segment at time t0 (an instruction boundary). `pixeles: false` leaves the picture out. */
  empezar(id, titulo, descripcion, t0, { pixeles = true } = {}) {
    this.activo = true;
    this.conPixeles = pixeles;
    this.segmentos.push({ id, titulo, descripcion, t0, t1: t0, pixel0: this.px.t.length, pixel1: this.px.t.length });
  }

  terminar(t1) {
    const s = this.segmentos.at(-1);
    s.t1 = t1;
    s.pixel1 = this.px.t.length;
    this.activo = false;
  }

  /**
   * Arrays and manifest fragments. `busesDef`: [{id, titulo, anchoDir, anchoDato, chips, tipos}]; `regs`: register
   * names in order; returns {arrays, buses, instrucciones, fases, senales, pixeles} for the manifest.
   */
  arrays(busesDef, regs, cpu = 'cpu') {
    const arrays = {};
    const buses = [];
    for (const b of busesDef) {
      const x = this.buses[b.id] ?? { t: [], a: [], d: [], f: [], c: [], k: [] };
      const p = b.id + '_';
      arrays[p + 't'] = { tipo: 'u32', cod: 'vlqd', datos: x.t };
      arrays[p + 'a'] = { tipo: b.anchoDir > 16 ? 'u32' : 'u16', cod: 'vlqd', datos: x.a };
      arrays[p + 'd'] = { tipo: b.anchoDato > 8 ? 'u16' : 'u8', cod: 'crudo', datos: x.d };
      arrays[p + 'f'] = { tipo: 'u8', cod: 'crudo', datos: x.f };
      arrays[p + 'c'] = { tipo: 'u8', cod: 'crudo', datos: x.c };
      const m = { ...b, t: p + 't', a: p + 'a', d: p + 'd', f: p + 'f', c: p + 'c' };
      if (b.tipos) {
        arrays[p + 'k'] = { tipo: 'u8', cod: 'crudo', datos: x.k };
        m.k = p + 'k';
      }
      buses.push(m);
    }
    arrays.ins_t = { tipo: 'u32', cod: 'vlqd', datos: this.ins.t };
    arrays.ins_pc = { tipo: 'u32', cod: 'vlqd', datos: this.ins.pc };
    arrays.ins_ciclo = { tipo: 'u32', cod: 'vlqd', datos: this.ins.ciclo };
    arrays.ins_k = { tipo: 'u8', cod: 'crudo', datos: this.ins.k };
    const r = [];
    for (const n of regs) {
      const nombre = 'ins_r_' + n;
      const datos = this.ins.r[n] ?? [];
      arrays[nombre] = { tipo: Math.max(0, ...datos) > 0xff ? 'u16' : 'u8', cod: 'crudo', datos };
      r.push(nombre);
    }
    arrays.fase_t = { tipo: 'u32', cod: 'vlqd', datos: this.fases.t };
    arrays.fase_k = { tipo: 'u8', cod: 'crudo', datos: this.fases.k };
    arrays.fase_linea = { tipo: 'u16', cod: 'vlqd', datos: this.fases.linea };
    // signals may be recorded slightly ahead of time (a pulse's end): sort them, stable
    const orden = this.sen.t.map((_, i) => i).sort((a, b) => this.sen.t[a] - this.sen.t[b] || a - b);
    this.sen = { t: orden.map((i) => this.sen.t[i]), k: orden.map((i) => this.sen.k[i]), v: orden.map((i) => this.sen.v[i]) };
    arrays.sen_t = { tipo: 'u32', cod: 'vlqd', datos: this.sen.t };
    arrays.sen_k = { tipo: 'u8', cod: 'crudo', datos: this.sen.k };
    arrays.sen_v = { tipo: 'u8', cod: 'crudo', datos: this.sen.v };
    arrays.px_t = { tipo: 'u32', cod: 'vlqd', datos: this.px.t };
    arrays.px_c = { tipo: Math.max(0, ...this.px.c.slice(0, 1000)) > 0xff || this.px16 ? 'u16' : 'u8', cod: 'vlqd', datos: this.px.c };
    arrays.lin_t = { tipo: 'u32', cod: 'vlqd', datos: this.lin.t };
    arrays.lin_n = { tipo: 'u16', cod: 'vlqd', datos: this.lin.n };
    return {
      arrays,
      lineas: { lineasT: 'lin_t', lineasN: 'lin_n' },
      buses,
      instrucciones: [{ cpu, t: 'ins_t', pc: 'ins_pc', ciclo: 'ins_ciclo', k: 'ins_k', r }],
      fases: { t: 'fase_t', k: 'fase_k', linea: 'fase_linea' },
      senales: { t: 'sen_t', k: 'sen_k', v: 'sen_v' },
      pixeles: { t: 'px_t', c: 'px_c' },
    };
  }
}
