<script lang="ts">
  // Impedance matching with an L network on the Smith chart (book 35.5, 35.4): a shunt element moves the point
  // along a constant-conductance circle, a series one along a constant-resistance circle; two moves take any
  // load to the centre (50 Ω). The network's Q = √(R_mayor/R_menor − 1) is fixed by the step, and the bandwidth
  // is about 1/Q: matching a 2 Ω antenna to 50 Ω is narrow and touchy. Element values at 100 MHz, and the exact
  // VSWR against frequency of the network actually designed, with the band measured on that curve using the
  // book's criterion (VSWR < 2,5, i.e. about 1 dB of mismatch loss; 1/Q is only the estimate).
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, circulo, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num, pct } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, X as eX, type Ejes } from '../nucleo/grafica';
  import { c as cx, suma, inv, mod, esc, type C } from '../nucleo/complejo';
  import { gamma, zDeGamma, cartaSmith, aPunto, type Carta } from '../nucleo/smith';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  const Z0 = 50;
  const F0 = 100e6;
  const W0 = 2 * Math.PI * F0;
  let RL = $state(10);
  let XL = $state(0);

  /** L network (Pozar's formulas), choosing the solution with a shunt capacitor when possible. */
  const red = $derived.by(() => {
    if (RL > Z0) {
      const den = RL * RL + XL * XL;
      const raiz = Math.sqrt(RL / Z0) * Math.sqrt(Math.max(0, RL * RL + XL * XL - Z0 * RL));
      const opciones = [1, -1].map((sg) => {
        const B = (XL + sg * raiz) / den;
        const X = 1 / B + (XL * Z0) / RL - Z0 / (B * RL);
        return { B, X };
      });
      const o = opciones.find((q) => q.B > 0) ?? opciones[0]!;
      return { paraleloEnCarga: true, ...o };
    }
    const opciones = [1, -1].map((sg) => ({ X: sg * Math.sqrt(RL * (Z0 - RL)) - XL, B: (sg * Math.sqrt((Z0 - RL) / RL)) / Z0 }));
    const o = opciones.find((q) => q.B > 0) ?? opciones[0]!;
    return { paraleloEnCarga: false, ...o };
  });

  const Q = $derived(Math.sqrt(Math.max(RL, Z0) / Math.min(RL, Z0) - 1));
  /** Book's bandwidth criterion for the L network (section 35.5): VSWR below 2,5 (about 1 dB mismatch loss). */
  const VSWR_MAX = 2.5;

  /** Element of reactance X (series) or susceptance B (shunt) at 100 MHz, as L or C. */
  function serie(X: number): { tipo: 'L' | 'C'; valor: number } {
    return X >= 0 ? { tipo: 'L', valor: X / W0 } : { tipo: 'C', valor: -1 / (X * W0) };
  }
  function paralelo(B: number): { tipo: 'L' | 'C'; valor: number } {
    return B >= 0 ? { tipo: 'C', valor: B / W0 } : { tipo: 'L', valor: -1 / (B * W0) };
  }

  /** Input impedance at frequency f with the designed elements (their reactances scale with f). */
  function zIn(f: number): C {
    const k = f / F0;
    const es = serie(red.X);
    const ep = paralelo(red.B);
    const w = 2 * Math.PI * f;
    const Xs = Math.abs(red.X) < 1e-9 ? 0 : es.tipo === 'L' ? w * es.valor : -1 / (w * es.valor);
    const Bp = Math.abs(red.B) < 1e-12 ? 0 : ep.tipo === 'C' ? w * ep.valor : -1 / (w * ep.valor);
    // The load's reactance is taken as an inductance (X > 0) or a capacitance (X < 0) at 100 MHz.
    const zl = cx(RL, XL >= 0 ? XL * k : XL / k);
    if (red.paraleloEnCarga) {
      const y = suma(inv(zl), cx(0, Bp));
      return suma(inv(y), cx(0, Xs));
    }
    const z1 = suma(zl, cx(0, Xs));
    return inv(suma(inv(z1), cx(0, Bp)));
  }

  function vswr(f: number): number {
    const g = mod(gamma(esc(zIn(f), 1 / Z0)));
    return g >= 0.999 ? 99 : (1 + g) / (1 - g);
  }
  const F_MIN = 50e6;
  const F_MAX = 150e6;
  /** VSWR curve over the plotted span. */
  const curvaSw = $derived.by(() => {
    void [RL, XL];
    const N = 200;
    const fs = new Float64Array(N + 1);
    const sw = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) {
      fs[i] = F_MIN + ((F_MAX - F_MIN) * i) / N;
      sw[i] = vswr(fs[i]!);
    }
    return { fs, sw };
  });
  /** Band edges where the actual curve crosses VSWR_MAX, searched outwards from 100 MHz (null: beyond the search). */
  const banda = $derived.by(() => {
    void [RL, XL];
    const borde = (sentido: 1 | -1): number | null => {
      const pasoF = 0.0005 * F0;
      let fa = F0;
      let sa = vswr(fa);
      for (let i = 1; i <= 4000; i++) {
        const fb = F0 + sentido * i * pasoF;
        if (fb <= 0.02 * F0) return null;
        const sb = vswr(fb);
        if (sb >= VSWR_MAX) return fa + ((fb - fa) * (VSWR_MAX - sa)) / (sb - sa);
        fa = fb;
        sa = sb;
      }
      return null;
    };
    const bajo = borde(-1);
    const alto = borde(1);
    return { bajo, alto, rel: bajo !== null && alto !== null ? (alto - bajo) / F0 : null };
  });
  const bandaTxt = $derived(banda.rel === null ? 'más de lo barrido' : pct(banda.rel, 0));

  /** Path on the chart: load → after the first element → centre, as a polyline of Γ values. */
  const camino = $derived.by(() => {
    const pts: C[] = [];
    const zl = cx(RL / Z0, XL / Z0);
    const N = 60;
    if (red.paraleloEnCarga) {
      const yl = inv(zl);
      for (let i = 0; i <= N; i++) pts.push(gamma(inv(suma(yl, cx(0, (red.B * Z0 * i) / N)))));
      const z1 = inv(suma(yl, cx(0, red.B * Z0)));
      for (let i = 0; i <= N; i++) pts.push(gamma(suma(z1, cx(0, (red.X / Z0) * (i / N)))));
    } else {
      for (let i = 0; i <= N; i++) pts.push(gamma(suma(zl, cx(0, (red.X / Z0) * (i / N)))));
      const y1 = inv(suma(zl, cx(0, red.X / Z0)));
      for (let i = 0; i <= N; i++) pts.push(gamma(inv(suma(y1, cx(0, (red.B * Z0 * i) / N)))));
    }
    return pts;
  });

  let u = 0;
  let n = $state(0);
  const muestreo = new Muestreo(50);
  function paso(dt: number): void {
    u = (u + dt / 6) % 1.25;
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const k: Carta = est ? { cx: 300, cy: 160, R: 130 } : { cx: 190, cy: 190, R: 160 };
    const e: Ejes = est ? { x: 60, y: 360, w: 510, h: 150, x0: 50e6, x1: 150e6, y0: 1, y1: 6 } : { x: 430, y: 200, w: 440, h: 170, x0: 50e6, x1: 150e6, y0: 1, y1: 6 };
    estatico(v, `as:${est}`, (vv) => {
      cartaSmith(vv, k);
      panel(vv, e, { titulo: 'VSWR de la red diseñada frente a la frecuencia', ux: 'Hz', marcasY: [1, 2, 3, 4, 5, 6], fmtY: (y) => num(y, 0) });
      guia(vv.ctx, e, 'y', VSWR_MAX, alfa(p.bien, 0.8));
      txt(vv, `VSWR ${num(VSWR_MAX, 1)}`, e.x + e.w - 4, e.y + e.h * (1 - (VSWR_MAX - 1) / 5) - 8, { tam: 10.5, peso: 700, color: p.bien, alin: 'right' });
    });
    // Path: both arcs faintly in full, then each one drawn in turn (first element, then second).
    const mitad = camino.length / 2;
    const prog = Math.min(1, u);
    const m = Math.min(camino.length - 1, Math.floor(prog * camino.length));
    const tramoDe = (desde: number, hasta: number, color: string, ancho: number, trazos: number[]) => {
      if (hasta <= desde) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = ancho;
      ctx.setLineDash(trazos);
      ctx.beginPath();
      for (let i = desde; i <= hasta; i++) {
        const [x, y] = aPunto(k, camino[i]!);
        if (i === desde) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    };
    const colores = [p.serie[1], p.serie[2]] as const;
    for (let tramo = 0; tramo < 2; tramo++) {
      const a = tramo * mitad;
      const b = (tramo + 1) * mitad - 1;
      tramoDe(a, b, alfa(colores[tramo]!, 0.45), 2, [5, 4]);
      tramoDe(a, Math.min(m, b), colores[tramo]!, 3.2, []);
    }
    // Load, intermediate point (on the first circle and on the second) and centre, with labels kept off the
    // real axis, its tick labels and the path.
    const [lx, ly] = aPunto(k, camino[0]!);
    const [dx0, dy0] = aPunto(k, camino[Math.min(6, mitad - 1)]!);
    const subeCamino = dy0 < ly;
    circulo(ctx, lx, ly, 6, p.corriente, p.fondo, 2);
    // On the real axis: above or below it, on the side the path does not take (the tick labels sit below the
    // axis, to the right of each circle). Off the axis: level with the point, beside it.
    const yCarga = Math.abs(ly - k.cy) < 16 ? ly + (subeCamino ? 16 : -16) : ly;
    const izq = dx0 >= lx - 1;
    txt(v, 'carga', lx + (izq ? -9 : 9), yCarga, { tam: 11, peso: 800, color: p.corriente, alin: izq ? 'right' : 'left' });
    const gi = camino[mitad - 1]!;
    const [ix, iy] = aPunto(k, gi);
    const zi = zDeGamma(gi);
    circulo(ctx, ix, iy, 6, colores[0], p.fondo, 2.4);
    const fz = (z: C) => `z = ${num(z.re, 2)} ${z.im >= 0 ? '+' : '−'} j${num(Math.abs(z.im), 2)}`;
    // Above (or below) the point, away from the real axis (both arcs leave it sideways), and shifted outwards
    // so that it clears the «inductiva» / «capacitiva» labels in the middle of the chart.
    const fuera = ix <= k.cx;
    txt(v, fz(zi), ix + (fuera ? 20 : -20), iy + (iy <= k.cy ? -15 : 15), { tam: 11, peso: 800, color: colores[0], alin: fuera ? 'right' : 'left' });
    circulo(ctx, k.cx, k.cy, 5, p.bien, p.fondo, 2);
    txt(v, '50 Ω', k.cx + 8, k.cy - 11, { tam: 11, peso: 800, color: p.bien, alin: 'left' });
    if (u < 1) {
      const [mx, my] = aPunto(k, camino[m]!);
      circulo(ctx, mx, my, 4, p.tinta);
    }
    // Element list.
    const es = serie(red.X);
    const ep = paralelo(red.B);
    const fmt = (q: { tipo: 'L' | 'C'; valor: number }) => `${q.tipo === 'L' ? 'bobina' : 'condensador'} de ${si(q.valor, q.tipo === 'L' ? 'H' : 'F', 3)}`;
    const tx = est ? 60 : 430;
    const ty = est ? 320 : 50;
    const orden = red.paraleloEnCarga
      ? [`1.º en paralelo con la carga: ${fmt(ep)}`, `2.º en serie: ${fmt(es)}`]
      : [`1.º en serie con la carga: ${fmt(es)}`, `2.º en paralelo: ${fmt(ep)}`];
    if (!est) {
      txt(v, 'Red en L a 100 MHz', tx, ty, { tam: 12, peso: 700, color: p.suave, alin: 'left' });
      txt(v, orden[0]!, tx, ty + 24, { tam: 12.5, peso: 700, color: p.serie[1], alin: 'left' });
      txt(v, orden[1]!, tx, ty + 46, { tam: 12.5, peso: 700, color: p.serie[2], alin: 'left' });
      txtRico(v, `Q = √(R_mayor/R_menor − 1) = ${num(Q, 2)}: estimación 1/Q ≈ ${pct(1 / Math.max(Q, 1e-3), 0)}`, tx, ty + 72, { tam: 12.5, peso: 700, alin: 'left' });
      txt(v, `Medida en la curva (VSWR < ${num(VSWR_MAX, 1)}): ${bandaTxt}`, tx, ty + 96, { tam: 12.5, peso: 700, color: p.bien, alin: 'left' });
    }
    // Measured band (shaded), then the VSWR curve.
    const xa = eX(e, Math.max(F_MIN, banda.bajo ?? F_MIN));
    const xb = eX(e, Math.min(F_MAX, banda.alto ?? F_MAX));
    ctx.fillStyle = alfa(p.bien, 0.16);
    ctx.fillRect(xa, e.y, xb - xa, e.h);
    curva(ctx, e, curvaSw.fs, curvaSw.sw, p.acento, 2.4);
    guia(ctx, e, 'x', F0, alfa(p.tinta, 0.35));
  }

  const texto = $derived.by(() => {
    const es = serie(red.X);
    const ep = paralelo(red.B);
    return (
      `**Adaptar sin disipar:** la carga de ${num(RL, 1)} ${XL >= 0 ? '+' : '−'} j${num(Math.abs(XL), 1)} Ω se lleva al centro de la carta (50 Ω, Γ = 0) con dos elementos reactivos. ${red.paraleloEnCarga ? 'Primero uno en paralelo (el punto se mueve por un círculo de conductancia constante, en rojo), después uno en serie (por un círculo de resistencia constante, en verde).' : 'Primero uno en serie (el punto se mueve por un círculo de resistencia constante, en rojo) hasta cortar el círculo g = 1; después uno en paralelo, que lo lleva por ese círculo hasta el centro (en verde).'} A 100 MHz: ${es.tipo === 'L' ? 'bobina' : 'condensador'} en serie de ${si(es.valor, es.tipo === 'L' ? 'H' : 'F', 3)} y ${ep.tipo === 'L' ? 'bobina' : 'condensador'} en paralelo de ${si(ep.valor, ep.tipo === 'L' ? 'H' : 'F', 3)}.\n` +
      `**El salto fija el Q**: Q = √(R_mayor/R_menor − 1) = ${num(Q, 2)}, y 1/Q estima la banda en un ${pct(1 / Math.max(Q, 1e-3), 0)} de la frecuencia. Con el criterio del libro (VSWR < 2,5, menos de 1 dB de pérdida por desadaptación), la curva real da ${banda.rel === null ? 'una banda más ancha que lo barrido' : `un ${pct(banda.rel, 0)} (de ${si(banda.bajo!, 'Hz', 3)} a ${si(banda.alto!, 'Hz', 3)}, sombreada)`}. Cuanto mayor el salto, más estrecha: una antena diminuta de 2 Ω solo se adapta en una banda estrecha y sensible a las tolerancias.`
    );
  });

  const lecturas = $derived([
    { e: 'Q de la red', v: num(Q, 2), c: pal.acento },
    { e: 'Banda estimada 1/Q', v: pct(1 / Math.max(Q, 1e-3), 0) },
    { e: `Banda medida (VSWR < ${num(VSWR_MAX, 1)})`, v: bandaTxt, c: pal.bien },
    { e: 'X en serie', v: si(red.X, 'Ω', 3), c: red.paraleloEnCarga ? pal.serie[2] : pal.serie[1] },
    { e: 'B en paralelo', v: si(red.B, 'S', 3), c: red.paraleloEnCarga ? pal.serie[1] : pal.serie[2] },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 540] : [900, 390])} etiqueta="Red de adaptación en L dibujada como un camino en la carta de Smith" />
  {/snippet}
  {#snippet controles()}
    <div class="botones">
      <button class="boton" onclick={() => ((RL = 2), (XL = 0))}>Antena diminuta: 2 Ω</button>
      <button class="boton" onclick={() => ((RL = 10), (XL = 0))}>10 Ω</button>
      <button class="boton" onclick={() => ((RL = 200), (XL = 0))}>200 Ω</button>
      <button class="boton" onclick={() => ((RL = 25), (XL = -30))}>25 − j30 Ω</button>
    </div>
    <Deslizador etiqueta="Resistencia de la carga" bind:valor={RL} min={1} max={1000} log unidad="Ω" />
    <Deslizador etiqueta="Reactancia de la carga" bind:valor={XL} min={-100} max={100} paso={1} unidad="Ω" />
  {/snippet}
</Marco>

<style>
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
