<script lang="ts">
  // Power in AC and power-factor correction (book 23.5, 23.8, 1.6): p(t) = v·i has a mean value (P) and a part
  // at twice the frequency; the reactive part goes and comes back. The book's load: 230 V, 10 A, PF 0,8 →
  // S = 2300 VA, P = 1840 W, Q = 1380 VAr; 83 µF in parallel bring the line current to 8 A (46,6 µF for
  // PF 0,95, 8,42 A). With a rectifier and capacitor the current comes in narrow pulses in phase with the
  // voltage: cos φ ≈ 1 but PF ≈ 0,6, and a capacitor does not correct it (the problem is the harmonics).
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, flecha, rr, type Vista } from '../../nucleo/dibujo';
  import { hilo, condensador, fuente } from '../../nucleo/esquema';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, area, guia, punto, type Ejes } from '../nucleo/grafica';
  import { chapa } from '../nucleo/simbolos';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  const VEF = 230;
  const F = 50;
  const W = 2 * Math.PI * F;
  let carga = $state<'motor' | 'rectificador'>('motor');
  let fp0 = $state(0.8);
  let Cuf = $state(0);

  // Motor: R ‖ L drawing 10 A at the chosen PF. Rectifier: pulses with the same real power (1840 W).
  const N = 720;
  const datos = $derived.by(() => {
    const C = Cuf * 1e-6;
    const vp = VEF * Math.SQRT2;
    const t = new Float64Array(2 * N + 1);
    const v = new Float64Array(2 * N + 1);
    const i = new Float64Array(2 * N + 1);
    const pw = new Float64Array(2 * N + 1);
    let kpulso = 0;
    if (carga === 'rectificador') {
      // Scale the pulse so that P = 1840 W.
      let s = 0;
      for (let k = 0; k < N; k++) {
        const x = Math.sin((2 * Math.PI * k) / N);
        s += x * vp * Math.pow(Math.max(0, (Math.abs(x) - 0.92) / 0.08), 1.5) * Math.sign(x);
      }
      kpulso = 1840 / (s / N);
    }
    const P0 = VEF * 10 * fp0;
    const Q0 = VEF * 10 * Math.sqrt(1 - fp0 * fp0);
    const gR = P0 / (VEF * VEF);
    const bL = Q0 / (VEF * VEF);
    let P = 0;
    let I2 = 0;
    let a1 = 0;
    let b1 = 0;
    for (let k = 0; k <= 2 * N; k++) {
      const th = (2 * Math.PI * k) / N;
      const vv = vp * Math.sin(th);
      let ii: number;
      if (carga === 'motor') ii = vp * (gR * Math.sin(th) - bL * Math.cos(th));
      else {
        const x = Math.sin(th);
        ii = kpulso * Math.pow(Math.max(0, (Math.abs(x) - 0.92) / 0.08), 1.5) * Math.sign(x);
      }
      ii += vp * W * C * Math.cos(th);
      t[k] = th / W;
      v[k] = vv;
      i[k] = ii;
      pw[k] = vv * ii;
      if (k < N) {
        P += vv * ii;
        I2 += ii * ii;
        a1 += ii * Math.sin(th);
        b1 += ii * Math.cos(th);
      }
    }
    P /= N;
    const Ief = Math.sqrt(I2 / N);
    const S = VEF * Ief;
    const I1 = (Math.hypot(a1, b1) * 2) / N / Math.SQRT2;
    const fi1 = Math.atan2(b1, a1); // current fundamental phase relative to v (positive: leads)
    const Q1 = VEF * I1 * Math.sin(-fi1); // >0 inductive
    return { t, v, i, pw, P, Ief, S, FP: P / S, I1, cosfi: Math.cos(fi1), Q1, dist: I1 / Ief, imax: Math.max(...i.map(Math.abs)) };
  });

  // Slow motion: one period every 2,5 s.
  let u = 0;
  let fase = 0;
  let n = $state(0);
  const muestreo = new Muestreo(60);
  function paso(dt: number): void {
    u = (u + dt / 2.5) % 2;
    fase += dt;
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const d = datos;
    const T = 1 / F;
    const vmax = VEF * Math.SQRT2 * 1.1;
    const imax = Math.max(d.imax, 20) * 1.1;
    const pmax = Math.max(...d.pw.map(Math.abs)) * 1.1;
    const e1: Ejes = est
      ? { x: 70, y: 230, w: 500, h: 120, x0: 0, x1: 2 * T, y0: -1, y1: 1 }
      : { x: 400, y: 40, w: 470, h: 140, x0: 0, x1: 2 * T, y0: -1, y1: 1 };
    const e2: Ejes = est
      ? { x: 70, y: 400, w: 500, h: 120, x0: 0, x1: 2 * T, y0: -pmax * 0.4, y1: pmax }
      : { x: 400, y: 230, w: 470, h: 140, x0: 0, x1: 2 * T, y0: -pmax * 0.4, y1: pmax };
    estatico(v, `pa:${est}:${carga}:${pmax.toFixed(0)}`, (vv) => {
      panel(vv, e1, { titulo: 'v(t) e i(t), normalizadas', ux: 's', sinY: true, cero: true });
      panel(vv, e2, { titulo: 'p(t) = v·i', ux: 's', uy: 'W', cero: true });
      hilo(vv, [[60, 60], [300, 60]]);
      hilo(vv, [[60, 170], [300, 170]]);
      hilo(vv, [[60, 60], [60, 170]]);
      hilo(vv, [[220, 60], [220, 170]]);
      hilo(vv, [[300, 60], [300, 170]]);
    });
    // Circuit: source, line ammeter, load and capacitor bank.
    fuente(v, 60, 115, 22, 'ac');
    txt(v, '230 V', 30, 115, { tam: 12, color: p.suave, alin: 'right' });
    rr(ctx, 270, 92, 60, 46, 6);
    ctx.fillStyle = p.panel;
    ctx.fill();
    ctx.strokeStyle = p.tinta;
    ctx.lineWidth = 2;
    ctx.stroke();
    txt(v, carga === 'motor' ? 'motor' : 'fuente', 300, 108, { tam: 12, peso: 700 });
    txt(v, carga === 'motor' ? `FP ${num(fp0, 2)}` : 'conmut.', 300, 124, { tam: 11, color: p.suave });
    if (Cuf > 0) {
      condensador(v, 220, 95, 220, 135, { placa: 30, color: p.serie[1] });
      txtRico(v, `${num(Cuf, 1)} µF`, 212, 115, { tam: 12, peso: 700, color: p.serie[1], alin: 'right' });
    } else {
      ctx.fillStyle = p.fondo;
      ctx.fillRect(214, 70, 12, 90);
    }
    chapa(v, `línea: ${num(d.Ief, 2)} A`, 140, 36, p.corriente, 13);
    // Instantaneous power direction on the line: towards the load when p > 0, back when p < 0.
    const k = Math.round((u / 2) * 2 * N);
    const pAhora = d.pw[Math.min(k, 2 * N)]!;
    const fr = Math.min(1, Math.abs(pAhora) / pmax);
    if (fr > 0.03) {
      const x0 = pAhora > 0 ? 100 : 190;
      const x1 = pAhora > 0 ? 190 : 100;
      flecha(ctx, x0, 82, x1, 82, alfa(pAhora > 0 ? p.bien : p.peligro, 0.35 + 0.65 * fr), 2 + 4 * fr, 14);
      txt(v, pAhora > 0 ? 'energía → carga' : 'energía ← vuelve', 145, 98, { tam: 11.5, peso: 700, color: pAhora > 0 ? p.bien : p.peligro });
    }

    // Plots.
    const vn = new Float64Array(d.v.length);
    const inn = new Float64Array(d.i.length);
    for (let j = 0; j < d.v.length; j++) {
      vn[j] = d.v[j]! / vmax;
      inn[j] = d.i[j]! / imax;
    }
    curva(ctx, e1, d.t, vn, p.acento, 2.2);
    curva(ctx, e1, d.t, inn, p.corriente, 2.2);
    area(ctx, e2, d.t, d.pw, alfa(p.bien, 0.15));
    curva(ctx, e2, d.t, d.pw, p.serie[4], 2.2);
    guia(ctx, e2, 'y', d.P, p.bien, 1.6, [6, 4]);
    txt(v, `P = ${si(d.P, 'W', 3)} (media)`, e2.x + e2.w - 4, e2.y + 10, { tam: 11.5, color: p.bien, alin: 'right', peso: 700 });
    const tt = u * T;
    guia(ctx, e1, 'x', tt, alfa(p.tinta, 0.4));
    guia(ctx, e2, 'x', tt, alfa(p.tinta, 0.4));
    punto(ctx, e2, tt, pAhora, p.serie[4], 5, p.fondo);
    txtRico(v, 'v', e1.x + 8, e1.y + 10, { tam: 12, peso: 800, color: p.acento, alin: 'left' });
    txtRico(v, 'i', e1.x + 22, e1.y + 10, { tam: 12, peso: 800, color: p.corriente, alin: 'left' });

    // Power triangle (fundamental), drawn to scale.
    const ox = est ? 380 : 40;
    const oy = est ? 180 : 360;
    const esc = (est ? 160 : 230) / 2400;
    const Qv = carga === 'motor' ? d.Q1 : d.Q1;
    const Pp = d.P;
    ctx.save();
    flecha(ctx, ox, oy, ox + Pp * esc, oy, p.bien, 3, 11);
    if (Math.abs(Qv) * esc > 3) flecha(ctx, ox + Pp * esc, oy, ox + Pp * esc, oy - Qv * esc, p.serie[1], 2.6, 10);
    flecha(ctx, ox, oy, ox + Pp * esc, oy - Qv * esc, p.acento, 2.6, 11);
    ctx.restore();
    txtRico(v, `P ${si(Pp, 'W', 3)}`, ox + (Pp * esc) / 2, oy + 14, { tam: 11.5, peso: 700, color: p.bien });
    if (Math.abs(Qv) * esc > 3) txtRico(v, `Q ${si(Qv, 'VAr', 3)}`, ox + Pp * esc + 6, oy - (Qv * esc) / 2, { tam: 11.5, peso: 700, color: p.serie[1], alin: 'left' });
    // Phone: the triangle stands right of the load's box; the label must not reach it.
    const xS = ox + (Pp * esc) / 2 - 8;
    txtRico(v, `S ${si(d.S, 'VA', 3)}`, xS, oy - (Qv * esc) / 2 - 12, { tam: 11.5, peso: 700, color: p.acento, alin: 'right', max: est ? Math.max(56, xS - 338) : undefined });
  }

  // Capacitance that cancels the load's reactive power: C = Q/(ω·V²).
  const cOptimo = $derived(((VEF * 10 * Math.sqrt(1 - fp0 * fp0)) / (W * VEF * VEF)) * 1e6);

  const texto = $derived.by(() => {
    const d = datos;
    if (carga === 'motor')
      return (
        `**Tres potencias:** la activa P = ${si(d.P, 'W', 3)} es la media de p(t) y hace trabajo; la reactiva Q = ${si(d.Q1, 'VAr', 3)} va y vuelve dos veces por periodo (las zonas donde p(t) < 0: la energía regresa a la red); la aparente S = V·I = ${si(d.S, 'VA', 3)} es lo que deben soportar cables y transformadores. S² = P² + Q² y FP = P/S = ${num(d.FP, 3)}.\n` +
        `**Corregir** es poner en paralelo un condensador que aporte la reactiva en el sitio: con ${num(cOptimo, 1)} µF el FP llega a 1 y la corriente de línea baja de 10 A a ${num((VEF * 10 * fp0) / VEF, 2)} A sin cambiar la potencia útil. No se ahorra energía: se ahorran pérdidas I²·R en el camino. Por encima, la instalación queda capacitiva.`
      );
    return (
      `**Rectificador con condensador:** la corriente llega en pulsos estrechos en los picos de la tensión. Están en fase (cos φ = ${num(d.cosfi, 3)}), y aun así el factor de potencia es ${num(d.FP, 2)}: FP = (desplazamiento) × (distorsión) = ${num(d.cosfi, 3)} × ${num(d.dist, 3)}. Toda la corriente que no está en la fundamental son armónicos.\n` +
      `Un condensador no lo corrige (pruébalo): añade corriente reactiva y el FP empeora. Para esto hace falta corrección activa (PFC, sección 32.8), que obliga a la corriente a seguir la forma de la tensión.`
    );
  });

  const lecturas = $derived([
    { e: 'P (activa)', v: si(datos.P, 'W', 3), c: pal.bien },
    { e: 'Q (reactiva)', v: si(datos.Q1, 'VAr', 3), c: pal.serie[1] },
    { e: 'S (aparente)', v: si(datos.S, 'VA', 3), c: pal.acento },
    { e: 'Factor de potencia', v: num(datos.FP, 3) },
    { e: 'cos φ', v: num(datos.cosfi, 3) },
    { e: 'Corriente de línea', v: si(datos.Ief, 'A', 3), c: pal.corriente },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['corriente']}>
  {#snippet modos()}
    <Selector
      bind:valor={carga}
      opciones={[
        { valor: 'motor', texto: 'Carga inductiva (motor)' },
        { valor: 'rectificador', texto: 'Rectificador con condensador' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 560] : [900, 420])} etiqueta="Tensión, corriente y potencia instantánea de una carga en alterna, con el triángulo de potencias" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Condensador en paralelo" bind:valor={Cuf} min={0} max={150} paso={0.1} formato={(x) => `${num(x, 1)} µF`} />
    <div class="botones">
      <button class="boton" onclick={() => (Cuf = 0)}>Sin condensador</button>
      {#if carga === 'motor'}
        <button class="boton" onclick={() => (Cuf = Math.round(cOptimo * 10) / 10)}>FP = 1 ({num(cOptimo, 1)} µF)</button>
      {/if}
    </div>
    {#if carga === 'motor'}<Deslizador etiqueta="FP de la carga" bind:valor={fp0} min={0.3} max={1} paso={0.01} formato={(x) => num(x, 2)} />{/if}
  {/snippet}
</Marco>

<style>
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
