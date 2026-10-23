<script lang="ts">
  // Transmission lines: incident and reflected waves (book 35.1, 35.2, 40.3, 40.1): a step launched into a line of
  // impedance Z₀ travels at its own speed; at the load a fraction Γ = (Z_L − Z₀)/(Z_L + Z₀) comes back (+1 open:
  // the voltage doubles; −1 short: it cancels; 75 Ω on 50 Ω: +0,2) and at the source it reflects again with
  // Γ_s. Series termination at the source (R_s = Z₀) launches half the step, lets the open end double it and
  // absorbs the return. Exact superposition of every wavefront; one metre of coaxial cable (5 ns, v = 0,66·c).
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, rr, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, punto, area, type Ejes } from '../nucleo/grafica';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  const Z0 = 50;
  const TD = 5e-9;
  const VS = 2;
  let Rs = $state(10);
  let RL = $state(1e9);
  let forma = $state<'escalon' | 'pulso'>('escalon');

  const gL = $derived(RL > 1e8 ? 1 : (RL - Z0) / (RL + Z0));
  const gS = $derived((Rs - Z0) / (Rs + Z0));
  const A0 = $derived((VS * Z0) / (Rs + Z0));

  /** Input shape s(τ) in units of T_d, with a rise time of 0,06·T_d. */
  function s(tau: number): number {
    const tr = 0.06;
    const sub = (x: number) => (x <= 0 ? 0 : x >= tr ? 1 : (x / tr) * (x / tr) * (3 - (2 * x) / tr));
    return forma === 'escalon' ? sub(tau) : sub(tau) - sub(tau - 0.5);
  }

  /** Voltage at position x (0 source … 1 load) and time t (both in T_d units). */
  function vxt(x: number, t: number): { v: number; inc: number; ref: number } {
    let inc = 0;
    let ref = 0;
    let a = A0;
    for (let k = 0; k < 40; k++) {
      const t0 = 2 * k;
      if (t - t0 - x < -0.1) break;
      inc += a * s(t - t0 - x);
      ref += a * gL * s(t - t0 - 1 - (1 - x));
      a *= gL * gS;
      if (Math.abs(a) < 1e-5) break;
    }
    return { v: inc + ref, inc, ref };
  }

  // Animation: 10 T_d in 10 s, then a new step.
  const TFIN = 10;
  let t = 0;
  let n = $state(0);
  const muestreo = new Muestreo(50);
  $effect(() => {
    void [Rs, RL, forma, reloj.reinicios];
    t = 0;
  });
  function paso(dt: number): void {
    t += dt;
    if (t > TFIN + 1) t = 0;
    if (muestreo.toca()) n++;
  }

  const trazas = $derived.by(() => {
    const N = 500;
    const ts = new Float64Array(N + 1);
    const v0 = new Float64Array(N + 1);
    const v1 = new Float64Array(N + 1);
    for (let k = 0; k <= N; k++) {
      const tt = (TFIN * k) / N;
      ts[k] = tt;
      v0[k] = vxt(0, tt).v;
      v1[k] = vxt(1, tt).v;
    }
    return { ts, v0, v1 };
  });

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const tt = Math.min(t, TFIN);
    const vmax = Math.max(2.2, ...trazas.v0, ...trazas.v1) * 1.08;
    const vmin = Math.min(-0.3, ...trazas.v0, ...trazas.v1) * 1.08;
    const eL: Ejes = { x: 110, y: 60, w: v.w - 200, h: est ? 170 : 160, x0: 0, x1: 1, y0: vmin, y1: vmax };
    const eS: Ejes = est ? { x: 60, y: 340, w: 510, h: 160, x0: 0, x1: TFIN, y0: vmin, y1: vmax } : { x: 60, y: 300, w: 810, h: 100, x0: 0, x1: TFIN, y0: vmin, y1: vmax };
    estatico(v, `rf:${est}:${vmax}:${vmin}`, (vv) => {
      panel(vv, eL, { titulo: 'Tensión a lo largo de la línea (1 m de coaxial, Z₀ = 50 Ω)', sinX: true, uy: 'V', cero: true });
      panel(vv, eS, { titulo: 'Lo que ve el osciloscopio en el origen y en la carga', fmtX: (x) => `${x * 5} ns`, marcasX: [0, 2, 4, 6, 8, 10], uy: 'V', cero: true });
    });
    // Source and load blocks at each end of the line.
    const yLin = eL.y + eL.h + 26;
    ctx.strokeStyle = p.tinta;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(eL.x, yLin);
    ctx.lineTo(eL.x + eL.w, yLin);
    ctx.moveTo(eL.x, yLin + 8);
    ctx.lineTo(eL.x + eL.w, yLin + 8);
    ctx.stroke();
    rr(ctx, eL.x - 86, yLin - 18, 70, 44, 8);
    ctx.fillStyle = p.panel;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.stroke();
    txt(v, 'fuente', eL.x - 51, yLin - 4, { tam: 11, color: p.suave });
    txtRico(v, `R_s ${si(Rs, 'Ω', 2)}`, eL.x - 51, yLin + 12, { tam: 11.5, peso: 700 });
    rr(ctx, eL.x + eL.w + 14, yLin - 18, 70, 44, 8);
    ctx.fillStyle = p.panel;
    ctx.fill();
    ctx.stroke();
    txt(v, 'carga', eL.x + eL.w + 49, yLin - 4, { tam: 11, color: p.suave });
    txt(v, RL > 1e8 ? 'abierta' : si(RL, 'Ω', 2), eL.x + eL.w + 49, yLin + 12, { tam: 11.5, peso: 700 });
    // Voltage profile, with the incident and reflected parts.
    const M = 240;
    const xs = new Float64Array(M + 1);
    const yv = new Float64Array(M + 1);
    const yi = new Float64Array(M + 1);
    const yr = new Float64Array(M + 1);
    for (let k = 0; k <= M; k++) {
      const x = k / M;
      const r = vxt(x, tt);
      xs[k] = x;
      yv[k] = r.v;
      yi[k] = r.inc;
      yr[k] = r.ref;
    }
    area(ctx, eL, xs, yv, alfa(p.acento, 0.12));
    curva(ctx, eL, xs, yi, alfa(p.serie[0], 0.8), 1.4, [5, 4]);
    curva(ctx, eL, xs, yr, alfa(p.serie[1], 0.8), 1.4, [5, 4]);
    curva(ctx, eL, xs, yv, p.acento, 2.6);
    txt(v, `t = ${si(tt * TD, 's', 3)}`, eL.x + eL.w - 6, eL.y + 12, { tam: 12, peso: 700, color: p.suave, alin: 'right' });
    const wInc = txt(v, 'incidente', eL.x + 8, eL.y + 12, { tam: 11, peso: 700, color: p.serie[0], alin: 'left' });
    txt(v, 'reflejada', eL.x + 20 + wInc, eL.y + 12, { tam: 11, peso: 700, color: p.serie[1], alin: 'left' });
    // Scope traces.
    curva(ctx, eS, trazas.ts, trazas.v0, p.serie[2], 2.2);
    curva(ctx, eS, trazas.ts, trazas.v1, p.corriente, 2.2);
    guia(ctx, eS, 'x', tt, alfa(p.tinta, 0.4));
    punto(ctx, eS, tt, vxt(0, tt).v, p.serie[2], 5, p.fondo);
    punto(ctx, eS, tt, vxt(1, tt).v, p.corriente, 5, p.fondo);
    txt(v, 'origen', eS.x + eS.w - 70, eS.y + 12, { tam: 11.5, peso: 700, color: p.serie[2], alin: 'right' });
    txt(v, 'carga', eS.x + eS.w - 6, eS.y + 12, { tam: 11.5, peso: 700, color: p.corriente, alin: 'right' });
  }

  const texto = $derived.by(() => {
    const final = RL > 1e8 ? VS : (VS * RL) / (Rs + RL);
    return (
      `**El flanco viaja:** al entrar, la línea solo ve Z₀ = 50 Ω, así que la fuente lanza ${num(A0, 2)} V (divisor entre R_s y Z₀), sin saber aún qué hay al final. Tarda T_d = 5 ns en recorrer el metro de coaxial.\n` +
      `**En la carga** vuelve Γ_L = ${num(gL, 3)} de la onda${gL === 1 ? ': abierta, la tensión se duplica' : gL === -1 ? ': cortocircuito, vuelve invertida y la anula' : Math.abs(gL) < 1e-3 ? ': adaptada, nada vuelve' : ''}; **en la fuente**, Γ_s = ${num(gS, 3)}${Math.abs(gS) < 1e-3 ? ' (terminación serie: absorbe lo que vuelve)' : ''}. Las idas y vueltas se suman hasta el valor de continua, ${num(final, 2)} V. ${Math.abs(gS) > 0.3 && gL > 0.5 ? 'Con una fuente de baja impedancia y la línea abierta aparece el **timbre**: el sobreimpulso puede llevar una entrada lógica por encima de su máximo.' : ''}`
    );
  });

  const lecturas = $derived([
    { e: 'Γ en la carga', v: num(gL, 3), c: pal.serie[1] },
    { e: 'Γ en la fuente', v: num(gS, 3) },
    { e: 'Escalón lanzado', v: si(A0, 'V', 3), c: pal.serie[0] },
    { e: 'VSWR de la carga', v: Math.abs(gL) >= 0.999 ? '∞' : num((1 + Math.abs(gL)) / (1 - Math.abs(gL)), 2) },
    { e: 'Potencia reflejada', v: `${num(gL * gL * 100, 1)} %` },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet modos()}
    <Selector
      etiqueta="Señal"
      bind:valor={forma}
      opciones={[
        { valor: 'escalon', texto: 'Escalón' },
        { valor: 'pulso', texto: 'Pulso de 2,5 ns' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 540] : [900, 430])} etiqueta="Un escalón que recorre una línea de transmisión y sus reflexiones" />
  {/snippet}
  {#snippet controles()}
    <div class="botones">
      <button class="boton" onclick={() => (RL = 1e9)}>Abierta</button>
      <button class="boton" onclick={() => (RL = 0.01)}>Cortocircuito</button>
      <button class="boton" onclick={() => (RL = 50)}>50 Ω</button>
      <button class="boton" onclick={() => (RL = 75)}>75 Ω</button>
      <button class="boton" onclick={() => (Rs = 50)}><span>Terminación serie (R<sub>s</sub> = Z₀)</span></button>
    </div>
    <Deslizador etiqueta="Carga R_L" bind:valor={RL} min={1} max={1e4} log unidad="Ω" />
    <Deslizador etiqueta="Resistencia de la fuente R_s" bind:valor={Rs} min={1} max={500} log unidad="Ω" />
  {/snippet}
</Marco>

<style>
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
