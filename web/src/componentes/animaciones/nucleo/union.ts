// Particle picture of a PN junction, shared by the junction, diode, Zener, LED and photodiode scenes.
//
// The depletion width and its split come from the book's equations (5.2): W = √(2ε/q·(1/N_A + 1/N_D)·(V₀ − V))
// with N_D·x_n = N_A·x_p. The particles are a picture, not a simulation of every carrier: majority carriers
// random-walk in their neutral regions and are pushed back by the field when they enter the depletion
// region; «events» show the processes the book describes at rates that follow the real current:
//   · formation: diffusion across the junction and recombination while the depletion region grows;
//   · forward bias: injection of minority carriers that diffuse and recombine (heat, or a photon in a LED),
//     with new majority carriers entering from the contacts (the current is continuous);
//   · reverse bias: thermal (or optical) generation of pairs inside the depletion region, swept by the field;
//   · breakdown: avalanche multiplication of the swept carriers.

import { agotamiento } from './fisica';
import type { Vista } from './dibujo';
import { azar, brillo, electrones, foton, huecos, iones, limitar } from './dibujo';
import { alfa, mezcla } from './paleta';

export type TipoPortador = 'e' | 'h';

/** 0 majority in its region, 1 injected minority, 2 generated (swept by the field), 3 entering, 4 meeting. */
type Modo = 0 | 1 | 2 | 3 | 4;

export interface Portador {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tipo: TipoPortador;
  modo: Modo;
  vida: number;
  /** Meeting point and partner while recombining. */
  mx: number;
  my: number;
  pareja: Portador | null;
}

interface Destello {
  x: number;
  y: number;
  t: number;
  /** Photon colour (LED) or null for heat. */
  luz: string | null;
  a: number;
}

interface Ion {
  x: number;
  y: number;
}

export interface GeomUnion {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Metallurgical junction. */
  xj: number;
  /** Nanometres represented by one logical unit. */
  nmU: number;
}

export interface OpcDibujoUnion {
  /** Show the ions of the neutral regions faintly. */
  ionesNeutros?: boolean;
  /** Draw the field arrows inside the depletion region. */
  campo?: boolean;
  /** Colour of the light emitted on recombination (LED). */
  luz?: string | null;
  /** Hide the region labels drawn inside the slab. */
  sinRotulos?: boolean;
}

export class SimUnion {
  g: GeomUnion = { x0: 0, x1: 100, y0: 0, y1: 100, xj: 50, nmU: 1 };
  na = 1e17;
  nd = 1e16;
  /** Applied junction voltage (forward positive). */
  v = 0;
  /** Formation progress 0 → 1 (scales the depletion width while it grows). */
  f = 1;
  /** Event rates (per second). */
  inyeccion = 0;
  generacion = 0;
  avalancha = 0;
  /** Recombinations emit photons of this colour (LED); null = heat. */
  luz: string | null = null;
  /** Fraction of recombinations that emit light (radiative efficiency). */
  radiativa = 1;

  portadores: Portador[] = [];
  destellos: Destello[] = [];
  fotones: { x: number; y: number; a: number; t: number; c: string }[] = [];
  private ionesP: Ion[] = [];
  private ionesN: Ion[] = [];
  private claveRed = '';
  private rnd = azar(7);
  private acumIny = 0;
  private acumGen = 0;
  private acumForm = 0;
  private fAnterior = 1;
  /** Counters for readouts. */
  cuentaRecomb = 0;
  cuentaFotones = 0;

  /** Depletion limits in logical x for the current state. */
  limites(): { a: number; b: number; w: number; xp: number; xn: number } {
    const d = agotamiento(this.na, this.nd, this.v);
    const k = this.f;
    const xp = (d.xp * 1e9 * k) / this.g.nmU;
    const xn = (d.xn * 1e9 * k) / this.g.nmU;
    // Keep at least a sliver visible on each side.
    const xpv = Math.max(xp, k > 0.02 ? 3 : 0);
    const xnv = Math.max(xn, k > 0.02 ? 3 : 0);
    // Never wider than the slab (contacts keep a margin).
    const a = Math.max(this.g.x0 + 8, this.g.xj - xpv);
    const b = Math.min(this.g.x1 - 8, this.g.xj + xnv);
    return { a, b, w: b - a, xp: this.g.xj - a, xn: b - this.g.xj };
  }

  /** Rebuilds the ion lattice and the carrier populations (geometry or doping changed). */
  configurar(g: GeomUnion, na: number, nd: number, semilla = 7): void {
    const clave = `${g.x0},${g.x1},${g.y0},${g.y1},${g.xj},${g.nmU},${na},${nd}`;
    if (clave === this.claveRed) return;
    this.claveRed = clave;
    this.g = g;
    this.na = na;
    this.nd = nd;
    this.rnd = azar(semilla);
    const r = Math.max(na, nd) / Math.min(na, nd);
    const sDenso = Math.max(6, 16 / Math.pow(r, 0.25));
    const sP = na >= nd ? sDenso : sDenso * Math.sqrt(r);
    const sN = nd >= na ? sDenso : sDenso * Math.sqrt(r);
    this.ionesP = this.red(g.x0 + 4, g.xj, sP);
    this.ionesN = this.red(g.xj, g.x1 - 4, sN);
    this.poblar();
  }

  private red(xa: number, xb: number, s: number): Ion[] {
    const res: Ion[] = [];
    const h = this.g.y1 - this.g.y0;
    const filas = Math.max(1, Math.floor((h - 8) / s));
    const dy = (h - 8) / filas;
    for (let i = 0; i < filas; i++) {
      const y = this.g.y0 + 4 + dy * (i + 0.5);
      const desp = (i % 2) * s * 0.5;
      for (let x = xa + s * 0.5 + desp; x < xb; x += s) {
        res.push({ x: x + (this.rnd() - 0.5) * s * 0.3, y: y + (this.rnd() - 0.5) * dy * 0.3 });
      }
    }
    return res;
  }

  private cuenta(n: number): number {
    return Math.round(limitar(20 + 12 * Math.log10(n / 1e15), 16, 60));
  }

  /** Majority carriers spread over the neutral regions of the current state. */
  poblar(): void {
    const { a, b } = this.limites();
    const g = this.g;
    this.portadores = [];
    this.destellos = [];
    this.fotones = [];
    const nh = this.cuenta(this.na);
    const ne = this.cuenta(this.nd);
    for (let i = 0; i < nh; i++) this.portadores.push(this.nuevo('h', g.x0 + 6 + this.rnd() * Math.max(4, a - g.x0 - 12), 0));
    for (let i = 0; i < ne; i++) this.portadores.push(this.nuevo('e', b + 6 + this.rnd() * Math.max(4, g.x1 - b - 12), 0));
  }

  private nuevo(tipo: TipoPortador, x: number, modo: Modo, y?: number): Portador {
    const g = this.g;
    return {
      x,
      y: y ?? g.y0 + 8 + this.rnd() * (g.y1 - g.y0 - 16),
      vx: (this.rnd() - 0.5) * 60,
      vy: (this.rnd() - 0.5) * 60,
      tipo,
      modo,
      vida: 0,
      mx: 0,
      my: 0,
      pareja: null,
    };
  }

  /** Restarts the formation of the junction (diffusion → equilibrium). */
  reiniciarFormacion(): void {
    this.f = 0;
    this.fAnterior = 0;
    this.acumForm = 0;
    this.poblarUniforme();
  }

  /** Before contact: carriers fill each region up to the junction. */
  private poblarUniforme(): void {
    const g = this.g;
    this.portadores = [];
    this.destellos = [];
    const nh = this.cuenta(this.na);
    const ne = this.cuenta(this.nd);
    for (let i = 0; i < nh; i++) this.portadores.push(this.nuevo('h', g.x0 + 6 + this.rnd() * (g.xj - g.x0 - 10), 0));
    for (let i = 0; i < ne; i++) this.portadores.push(this.nuevo('e', g.xj + 4 + this.rnd() * (g.x1 - g.xj - 10), 0));
  }

  private gauss(): number {
    return (this.rnd() + this.rnd() + this.rnd() - 1.5) * 1.4;
  }

  private masCercano(tipo: TipoPortador, x: number, y: number, lado: 'P' | 'N', radio: number): Portador | null {
    let mejor: Portador | null = null;
    let d = radio * radio;
    for (const p of this.portadores) {
      if (p.tipo !== tipo || p.modo !== 0) continue;
      if (lado === 'P' && p.x > this.g.xj) continue;
      if (lado === 'N' && p.x < this.g.xj) continue;
      const dd = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (dd < d) {
        d = dd;
        mejor = p;
      }
    }
    return mejor;
  }

  /** The majority carrier of a type that is closest to the junction. */
  private junto(tipo: TipoPortador): Portador | null {
    let mejor: Portador | null = null;
    let d = Infinity;
    for (const p of this.portadores) {
      if (p.tipo !== tipo || p.modo !== 0) continue;
      const dd = Math.abs(p.x - this.g.xj) + this.rnd() * 30;
      if (dd < d) {
        d = dd;
        mejor = p;
      }
    }
    return mejor;
  }

  private unir(a: Portador, b: Portador, x: number, y: number): void {
    a.modo = 4;
    b.modo = 4;
    a.pareja = b;
    b.pareja = a;
    a.mx = b.mx = x;
    a.my = b.my = y;
    a.vida = b.vida = 0;
  }

  paso(dt: number): void {
    if (dt <= 0) return;
    const g = this.g;
    const { a, b } = this.limites();
    const sigma = 170;
    const amort = Math.exp(-dt / 0.22);
    const raiz = Math.sqrt(dt);

    // Formation: pairs diffuse across and recombine while the depletion region grows.
    if (this.f < 1) {
      this.f = Math.min(1, this.f + dt / 2.6);
      const crece = this.f - this.fAnterior;
      this.fAnterior = this.f;
      this.acumForm += crece * 26 * (1 - this.f * 0.4);
      while (this.acumForm >= 1) {
        this.acumForm -= 1;
        const e = this.junto('e');
        const h = this.junto('h');
        if (e && h) {
          const enP = this.rnd() < 0.5;
          const x = g.xj + (enP ? -1 : 1) * (8 + this.rnd() * 26);
          this.unir(e, h, x, (e.y + h.y) / 2);
        }
      }
    }

    // Forward bias: injection of minority carriers (holes into N in proportion to N_A, electrons into P to N_D).
    this.acumIny += this.inyeccion * dt;
    while (this.acumIny >= 1) {
      this.acumIny -= 1;
      const huecoAN = this.rnd() < this.na / (this.na + this.nd);
      const p = this.junto(huecoAN ? 'h' : 'e');
      if (p) {
        p.modo = 1;
        p.vida = 0;
        p.vx = huecoAN ? 120 : -120;
      }
    }

    // Generation inside the depletion region (thermal leakage, light, avalanche seeds).
    this.acumGen += this.generacion * dt;
    while (this.acumGen >= 1) {
      this.acumGen -= 1;
      this.par(a + this.rnd() * Math.max(2, b - a), g.y0 + 10 + this.rnd() * (g.y1 - g.y0 - 20));
    }

    const vivos: Portador[] = [];
    const nuevos: Portador[] = [];
    for (const p of this.portadores) {
      p.vida += dt;
      if (p.modo === 4) {
        // Moving to the meeting point, then recombining.
        const k = Math.min(1, dt * 7);
        p.x += (p.mx - p.x) * k;
        p.y += (p.my - p.y) * k;
        if (p.vida > 0.32) {
          if (p.tipo === 'e') this.recombinar(p.mx, p.my);
          continue;
        }
        vivos.push(p);
        continue;
      }
      if (p.modo === 2) {
        // Swept by the field: electrons to N (right), holes to P (left), then out through the contact.
        const dir = p.tipo === 'e' ? 1 : -1;
        const dentro = p.x > a && p.x < b;
        p.vx += dir * (dentro ? 900 : 260) * dt;
        p.vx = limitar(p.vx, -260, 260);
        p.vy = p.vy * amort + this.gauss() * sigma * 0.4 * raiz;
        if (dentro && this.avalancha > 0 && this.rnd() < this.avalancha * dt) nuevos.push(...this.parEn(p.x, p.y));
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.y = limitar(p.y, g.y0 + 5, g.y1 - 5);
        if (p.x < g.x0 + 2 || p.x > g.x1 - 2) {
          // Leaves through the contact; the majority population is kept by the external circuit.
          continue;
        }
        vivos.push(p);
        continue;
      }

      // Random walk (thermal motion).
      p.vx = p.vx * amort + this.gauss() * sigma * raiz;
      p.vy = p.vy * amort + this.gauss() * sigma * raiz;

      if (p.modo === 0 || p.modo === 3) {
        // The field of the depletion region pushes majority carriers back to their side.
        if (p.tipo === 'e' && p.x < b + 3) p.vx += (p.x < a ? 3000 : 1600) * dt;
        if (p.tipo === 'h' && p.x > a - 3) p.vx -= (p.x > b ? 3000 : 1600) * dt;
        if (p.modo === 3 && p.vida > 0.5) p.modo = 0;
      } else if (p.modo === 1) {
        // Injected minority: crosses the depletion region quickly, then diffuses away and recombines.
        const dir = p.tipo === 'e' ? -1 : 1;
        if (p.x > a - 2 && p.x < b + 2) p.vx = dir * Math.max(Math.abs(p.vx), 140);
        else p.vx += dir * 40 * dt;
        const enRegion = p.tipo === 'e' ? p.x < a - 4 : p.x > b + 4;
        if (enRegion && p.vida > 0.35 + this.rnd() * 0.05) {
          if (this.rnd() < dt * 2.2) {
            const otro = this.masCercano(p.tipo === 'e' ? 'h' : 'e', p.x, p.y, p.tipo === 'e' ? 'P' : 'N', 90);
            if (otro) this.unir(p, otro, (p.x + otro.x) / 2, (p.y + otro.y) / 2);
          }
        }
      }
      p.vx = limitar(p.vx, -320, 320);
      p.vy = limitar(p.vy, -200, 200);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Walls.
      if (p.y < g.y0 + 5) {
        p.y = g.y0 + 5;
        p.vy = Math.abs(p.vy);
      } else if (p.y > g.y1 - 5) {
        p.y = g.y1 - 5;
        p.vy = -Math.abs(p.vy);
      }
      if (p.x < g.x0 + 5) {
        p.x = g.x0 + 5;
        p.vx = Math.abs(p.vx);
      } else if (p.x > g.x1 - 5) {
        p.x = g.x1 - 5;
        p.vx = -Math.abs(p.vx);
      }
      vivos.push(p);
    }
    this.portadores = vivos.concat(nuevos);

    for (const d of this.destellos) d.t += dt;
    this.destellos = this.destellos.filter((d) => d.t < 0.7);
    for (const f of this.fotones) {
      f.t += dt;
      f.x += Math.cos(f.a) * 260 * dt;
      f.y += Math.sin(f.a) * 260 * dt;
    }
    this.fotones = this.fotones.filter((f) => f.t < 1.6);
  }

  private par(x: number, y: number): void {
    this.portadores.push(...this.parEn(x, y));
  }

  private parEn(x: number, y: number): Portador[] {
    const e = this.nuevo('e', x + 2, 2, y);
    const h = this.nuevo('h', x - 2, 2, y);
    e.vx = 40;
    h.vx = -40;
    this.destellos.push({ x, y, t: 0.25, luz: null, a: 0.5 });
    return [e, h];
  }

  private recombinar(x: number, y: number): void {
    this.cuentaRecomb++;
    const radiativa = this.luz !== null && this.rnd() < this.radiativa;
    this.destellos.push({ x, y, t: 0, luz: radiativa ? this.luz : null, a: 1 });
    if (radiativa && this.luz) {
      this.cuentaFotones++;
      const ang = -Math.PI / 2 + (this.rnd() - 0.5) * 1.6;
      this.fotones.push({ x, y, a: ang, t: 0, c: this.luz });
    }
    // The external circuit replaces the two carriers: an electron enters at the N contact, a hole at the P one,
    // but only while there is a current; at equilibrium (formation) nothing enters.
    if (this.inyeccion > 0) {
      const g = this.g;
      const e = this.nuevo('e', g.x1 - 6, 3);
      e.vx = -90;
      const h = this.nuevo('h', g.x0 + 6, 3);
      h.vx = 90;
      this.portadores.push(e, h);
    }
  }

  // ------------------------------------------------------------------ drawing

  dibujar(v: Vista, o: OpcDibujoUnion = {}): void {
    const { ctx, pal } = v;
    const g = this.g;
    const { a, b } = this.limites();
    const h = g.y1 - g.y0;

    // Slab: P and N regions with the faint neutral ions, cached as one layer (one blit per frame).
    const neutros = o.ionesNeutros !== false;
    v.capa(`union-losa@${g.x0},${g.y0}:${g.x1},${g.y1},${g.xj}:${neutros ? this.claveRed : ''}:${pal.oscuro}`, (c) => {
      c.save();
      c.shadowColor = pal.oscuro ? 'rgba(0,0,0,0.5)' : 'rgba(30,40,60,0.16)';
      c.shadowBlur = 14;
      c.shadowOffsetY = 4;
      c.fillStyle = pal.siP;
      c.fillRect(g.x0, g.y0, g.xj - g.x0, h);
      c.fillStyle = pal.siN;
      c.fillRect(g.xj, g.y0, g.x1 - g.xj, h);
      c.restore();
      // Subtle top-light gradient for depth.
      const gr = c.createLinearGradient(0, g.y0, 0, g.y1);
      gr.addColorStop(0, 'rgba(255,255,255,0.22)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.06)');
      c.fillStyle = gr;
      c.fillRect(g.x0, g.y0, g.x1 - g.x0, h);
      if (neutros) {
        iones(c, this.ionesP, Math.min(6.5, this.tamIon(true) * 0.8), -1, pal, 0.13);
        iones(c, this.ionesN, Math.min(6.5, this.tamIon(false) * 0.8), 1, pal, 0.13);
      }
    });
    // Depletion region.
    if (b - a > 0.5) {
      ctx.fillStyle = alfa(pal.agotamiento, 0.92);
      ctx.fillRect(a, g.y0, b - a, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(a, g.y0, b - a, h);
      ctx.clip();
      ctx.strokeStyle = alfa(pal.tenue, 0.16);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = a - h; x < b; x += 10) {
        ctx.moveTo(x, g.y1);
        ctx.lineTo(x + h, g.y0);
      }
      ctx.stroke();
      ctx.restore();
      // Uncovered ions, bold.
      const enP = this.ionesP.filter((i) => i.x > a);
      const enN = this.ionesN.filter((i) => i.x < b);
      iones(ctx, enP, this.tamIon(true), -1, pal, 1);
      iones(ctx, enN, this.tamIon(false), 1, pal, 1);
      ctx.strokeStyle = alfa(pal.suave, 0.55);
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a, g.y0);
      ctx.lineTo(a, g.y1);
      ctx.moveTo(b, g.y0);
      ctx.lineTo(b, g.y1);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Metallurgical junction.
    ctx.strokeStyle = alfa(pal.tinta, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g.xj, g.y0 - 6);
    ctx.lineTo(g.xj, g.y0);
    ctx.moveTo(g.xj, g.y1);
    ctx.lineTo(g.xj, g.y1 + 6);
    ctx.stroke();

    // Field arrows (from N to P) across the depletion region.
    if (o.campo !== false && b - a > 26) {
      const n = Math.max(1, Math.min(4, Math.floor(h / 70)));
      for (let i = 0; i < n; i++) {
        const y = g.y0 + (h * (i + 0.5)) / n;
        const l = b - a - 10;
        drawFlechaCampo(ctx, b - 5, y, b - 5 - l, y, pal.campoE);
      }
    }

    // Recombination flashes (heat) and light.
    for (const d of this.destellos) {
      const k = 1 - d.t / 0.7;
      if (d.luz) brillo(ctx, d.x, d.y, 26 + 10 * (1 - k), d.luz, 0.85 * k);
      else brillo(ctx, d.x, d.y, 16 + 8 * (1 - k), pal.calor, 0.5 * k * d.a);
    }

    // Carriers.
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.x0, g.y0, g.x1 - g.x0, h);
    ctx.clip();
    const r = 4.2;
    huecos(
      ctx,
      this.portadores.filter((p) => p.tipo === 'h'),
      r,
      pal,
    );
    electrones(
      ctx,
      this.portadores.filter((p) => p.tipo === 'e'),
      r,
      pal,
    );
    // Minority carriers get a halo so they can be followed.
    for (const p of this.portadores) {
      if (p.modo === 1 || p.modo === 2) {
        ctx.strokeStyle = alfa(p.tipo === 'e' ? pal.electron : pal.hueco, 0.45);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 3.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
    for (const f of this.fotones) {
      const k = 1 - f.t / 1.6;
      foton(ctx, f.x, f.y, f.a, f.c, 28, 4, Math.min(1, k * 1.5));
    }

    // Outline.
    ctx.strokeStyle = mezcla(pal.linea, pal.tinta, 0.2);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(g.x0, g.y0, g.x1 - g.x0, h);
  }

  private tamIon(p: boolean): number {
    const r = Math.max(this.na, this.nd) / Math.min(this.na, this.nd);
    const sDenso = Math.max(6, 16 / Math.pow(r, 0.25));
    const denso = p ? this.na >= this.nd : this.nd >= this.na;
    const s = denso ? sDenso : sDenso * Math.sqrt(r);
    return Math.max(5, Math.min(9, s * 0.72));
  }
}

function drawFlechaCampo(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number, _y2: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = alfa(color, 0.85);
  ctx.fillStyle = alfa(color, 0.85);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2 + 7, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y);
  ctx.lineTo(x2 + 9, y - 4.5);
  ctx.lineTo(x2 + 9, y + 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
