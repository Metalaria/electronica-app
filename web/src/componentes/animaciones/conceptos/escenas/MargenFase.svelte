<script lang="ts">
  // Stability of a feedback loop and the phase margin (book 26.8–26.10, 30.9): every pole of the loop gain adds
  // up to −90°; where |A·β| = 1 the phase must stay away from −180°. Book example: A = 10⁵ with poles at 10 Hz and
  // 1 MHz: gain 100 → 89,5°, gain 11 → 84,8°, follower → 52° at 786 kHz (the follower is the hardest case).
  // A capacitive load adds a third pole with the output resistance (R_o = 100 Ω here). The closed-loop step
  // response is computed exactly from the closed-loop poles (roots of the characteristic polynomial).
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num, pct } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, punto, type Ejes } from '../nucleo/grafica';
  import { Grafica, PlotLink, type Series } from '../../../grafica';
  import { c as cx, suma, resta, mul, div, esc, type C } from '../nucleo/complejo';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  const enlace = new PlotLink();

  let G = $state(1);
  let f2 = $state(1e6);
  let CL = $state(0);
  const A0 = 1e5;
  const f1 = 10;
  const RO = 100;

  const polos = $derived.by(() => {
    const ws = [2 * Math.PI * f1, 2 * Math.PI * f2];
    if (CL > 1e-13) ws.push(1 / (RO * CL));
    return ws;
  });
  const beta = $derived(1 / G);

  function L(f: number): C {
    let r: C = cx(A0 * beta);
    for (const w of polos) r = div(r, cx(1, (2 * Math.PI * f) / w));
    return r;
  }

  const margen = $derived.by(() => {
    // Crossover |L| = 1 by bisection on log f.
    let lo = 0;
    let hi = 10;
    for (let k = 0; k < 80; k++) {
      const m = (lo + hi) / 2;
      const z = L(10 ** m);
      if (Math.hypot(z.re, z.im) > 1) lo = m;
      else hi = m;
    }
    const fc = 10 ** ((lo + hi) / 2);
    let fase = 0;
    for (const w of polos) fase -= Math.atan((2 * Math.PI * fc) / w);
    return { fc, fase: (fase * 180) / Math.PI, pm: 180 + (fase * 180) / Math.PI };
  });

  /** Roots of a monic polynomial (coefficients from the highest power) by Durand–Kerner. */
  function raices(coef: number[]): C[] {
    const n = coef.length - 1;
    const evalp = (z: C): C => {
      let r = cx(1);
      for (let i = 1; i <= n; i++) r = suma(mul(r, z), cx(coef[i]!));
      return r;
    };
    const escala = Math.max(...coef.slice(1).map((a, i) => Math.abs(a) ** (1 / (i + 1))));
    let z: C[] = Array.from({ length: n }, (_, k) => esc({ re: Math.cos(0.4 + (2 * Math.PI * k) / n), im: Math.sin(0.4 + (2 * Math.PI * k) / n) }, escala));
    for (let it = 0; it < 500; it++) {
      const nz = z.map((zi, i) => {
        let d = cx(1);
        z.forEach((zj, j) => {
          if (j !== i) d = mul(d, resta(zi, zj));
        });
        return resta(zi, div(evalp(zi), d));
      });
      z = nz;
    }
    return z;
  }

  // Closed loop: T(s) = A0·Πw / (Π(s + w) + A0·β·Πw). Step response from the residues.
  const escalon = $derived.by(() => {
    const ws = polos;
    let poli: number[] = [1];
    for (const w of ws) {
      const nuevo = new Array(poli.length + 1).fill(0);
      for (let i = 0; i < poli.length; i++) {
        nuevo[i] += poli[i]!;
        nuevo[i + 1] += poli[i]! * w;
      }
      poli = nuevo;
    }
    const prod = ws.reduce((a, b) => a * b, 1);
    const K = A0 * prod;
    poli[poli.length - 1] = poli[poli.length - 1]! + A0 * beta * prod;
    const p = raices(poli);
    const T0 = K / poli[poli.length - 1]!;
    const res = p.map((pi, i) => {
      // Residue of K/(s·D(s)) at pi: K/(pi·Π(pi − pj)).
      let d = pi;
      p.forEach((pj, j) => {
        if (j !== i) d = mul(d, resta(pi, pj));
      });
      return div(cx(K), d);
    });
    const inestable = p.some((z) => z.re > 0);
    const lento = Math.min(...p.map((z) => Math.abs(z.re)).filter((x) => x > 0));
    const tFin = Math.min(12 / lento, 30 / (2 * Math.PI * margen.fc));
    const N = 500;
    const t = new Float64Array(N + 1);
    const y = new Float64Array(N + 1);
    let max = 0;
    for (let k = 0; k <= N; k++) {
      const tt = (tFin * k) / N;
      let s = T0;
      p.forEach((pi, i) => {
        const e = Math.exp(pi.re * tt);
        const r = res[i]!;
        s += e * (r.re * Math.cos(pi.im * tt) - r.im * Math.sin(pi.im * tt));
      });
      t[k] = tt;
      y[k] = s / T0;
      if (Number.isFinite(y[k]!)) max = Math.max(max, y[k]!);
    }
    return { t, y, max, inestable, p, tFin };
  });

  let u = 0;
  let n = $state(0);
  const muestreo = new Muestreo(60);
  function paso(dt: number): void {
    u = (u + dt / 5) % 1.25;
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const es = escalon;
    const ymax = Math.min(Math.max(1.6, es.max * 1.1), 2.6);
    const e: Ejes = est ? { x: 60, y: 40, w: 510, h: 220, x0: 0, x1: es.tFin, y0: -0.1, y1: ymax } : { x: 60, y: 40, w: 520, h: 300, x0: 0, x1: es.tFin, y0: -0.1, y1: ymax };
    estatico(v, `mf:${est}:${es.tFin}:${ymax}`, (vv) => {
      panel(vv, e, { titulo: 'Respuesta al escalón en lazo cerrado (normalizada)', ux: 's', marcasY: [0, 0.5, 1, 1.5, 2].filter((m) => m < ymax) });
    });
    guia(ctx, e, 'y', 1, alfa(p.tinta, 0.4));
    curva(ctx, e, es.t, es.y, es.inestable ? p.peligro : p.acento, 2.4);
    const k = Math.min(es.t.length - 1, Math.floor(Math.min(u, 1) * (es.t.length - 1)));
    guia(ctx, e, 'x', es.t[k]!, alfa(p.tinta, 0.35));
    punto(ctx, e, es.t[k]!, Math.max(e.y0, Math.min(e.y1, es.y[k]!)), es.inestable ? p.peligro : p.acento, 6, p.fondo);
    if (es.inestable) txt(v, 'inestable: la oscilación crece', e.x + e.w / 2, e.y + 16, { tam: 13, peso: 800, color: p.peligro });

    // Phase-margin gauge.
    const gx = est ? 300 : 740;
    const gy = est ? 470 : 230;
    const R = est ? 110 : 120;
    ctx.lineWidth = 14;
    for (const [a0, a1, c] of [
      [0, 30, p.peligro],
      [30, 45, p.aviso],
      [45, 70, p.bien],
      [70, 90, alfa(p.acento, 0.7)],
    ] as const) {
      ctx.strokeStyle = alfa(c as string, 0.35);
      ctx.beginPath();
      ctx.arc(gx, gy, R, Math.PI + (a0 / 90) * Math.PI, Math.PI + (a1 / 90) * Math.PI, false);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    const pm = Math.max(-20, Math.min(95, margen.pm));
    const ang = Math.PI + (pm / 90) * Math.PI;
    ctx.strokeStyle = p.tinta;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + (R - 4) * Math.cos(ang), gy + (R - 4) * Math.sin(ang));
    ctx.stroke();
    ctx.lineWidth = 1;
    txt(v, `${num(margen.pm, 1)}°`, gx, gy + 24, { tam: 18, peso: 800, color: margen.pm < 30 ? p.peligro : margen.pm < 45 ? p.aviso : p.bien });
    txt(v, 'margen de fase', gx, gy + 46, { tam: 12, color: p.suave });
    for (const m of [0, 30, 45, 60, 90]) {
      const a = Math.PI + (m / 90) * Math.PI;
      txt(v, `${m}°`, gx + (R + 22) * Math.cos(a), gy + (R + 22) * Math.sin(a), { tam: 11, color: p.suave });
    }
    txtRico(v, `cruce de 0 dB: ${si(margen.fc, 'Hz', 3)}`, gx, gy - R - 36, { tam: 12.5, peso: 700, color: p.suave });
  }

  const bode = $derived.by((): { m: Series[]; f: Series[] } => {
    const N = 300;
    const fr = new Float64Array(N);
    const mg = new Float64Array(N);
    const fs = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const f = 10 ** ((8.5 * i) / (N - 1));
      fr[i] = f;
      const z = L(f);
      mg[i] = 20 * Math.log10(Math.hypot(z.re, z.im));
      let ph = 0;
      for (const w of polos) ph -= Math.atan((2 * Math.PI * f) / w);
      fs[i] = (ph * 180) / Math.PI;
    }
    return { m: [{ name: '|A·β|', unit: 'dB', x: fr, y: mg, color: pal.acento }], f: [{ name: 'fase de A·β', unit: '°', x: fr, y: fs, color: pal.serie[1] }] };
  });

  const sobre = $derived(Math.max(0, escalon.max - 1));
  const texto = $derived.by(() => {
    const pm = margen.pm;
    const veredicto = pm < 0 ? '**oscila**' : pm < 30 ? 'estable pero con mucho timbre' : pm < 45 ? 'justo' : pm <= 70 ? 'el compromiso recomendado (45–60°)' : 'muy estable y algo lento';
    return (
      `**Ganancia de lazo A·β** con polos a 10 Hz y ${si(f2, 'Hz', 3)}${CL > 1e-13 ? ` y otro a ${si(polos[2]! / (2 * Math.PI), 'Hz', 3)} por la carga de ${si(CL, 'F', 2)} sobre R_o = 100 Ω` : ''}: cruza 0 dB a ${si(margen.fc, 'Hz', 3)} con ${num(margen.fase, 1)}° de fase. Faltan ${num(pm, 1)}° para −180°: ${veredicto}.\n` +
      `La respuesta al escalón lo confirma: sobreimpulso ${pct(sobre, 0)}${escalon.inestable ? ' y creciendo' : ''}. Con menos ganancia, la realimentación es más fuerte, el cruce sube en frecuencia y llega con más fase acumulada: el **seguidor** es la configuración más difícil de estabilizar (52° en el ejemplo del libro, a 786 kHz).`
    );
  });

  const lecturas = $derived([
    { e: 'Margen de fase', v: `${num(margen.pm, 1)}°`, c: margen.pm < 45 ? pal.peligro : pal.bien },
    { e: 'Cruce de 0 dB', v: si(margen.fc, 'Hz', 3) },
    { e: 'Sobreimpulso', v: escalon.inestable ? '∞' : pct(sobre, 1), c: pal.acento },
    { e: 'Ganancia en lazo cerrado', v: num(G, 1) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 600] : [900, 380])} etiqueta="Respuesta al escalón de un amplificador realimentado y su margen de fase" />
  {/snippet}
  {#snippet controles()}
    <div class="botones">
      <button class="boton" onclick={() => ((G = 100), (f2 = 1e6), (CL = 0))}>Ganancia 100</button>
      <button class="boton" onclick={() => ((G = 11), (f2 = 1e6), (CL = 0))}>Ganancia 11</button>
      <button class="boton" onclick={() => ((G = 1), (f2 = 1e6), (CL = 0))}>Seguidor</button>
    </div>
    <Deslizador etiqueta="Ganancia en lazo cerrado 1/β" bind:valor={G} min={1} max={100} log formato={(x) => num(x, x < 10 ? 2 : 1)} />
    <Deslizador etiqueta="Segundo polo del operacional" bind:valor={f2} min={100e3} max={100e6} log unidad="Hz" />
    <Deslizador etiqueta="Carga capacitiva C_L" bind:valor={CL} min={0} max={10e-9} paso={10e-12} unidad="F" />
  {/snippet}
  {#snippet grafica()}
    <div class="bode">
      <Grafica series={bode.m} xAxis={{ label: 'Frecuencia', unit: 'Hz', scale: 'log' }} yAxis={{ label: 'Ganancia de lazo', unit: 'dB', scale: 'linear', min: -60, max: 110 }} link={enlace} height={200} title="Bode de la ganancia de lazo A·β" />
      <Grafica series={bode.f} xAxis={{ label: 'Frecuencia', unit: 'Hz', scale: 'log' }} yAxis={{ label: 'Fase', unit: '°', scale: 'linear', min: -270, max: 0 }} link={enlace} height={170} />
    </div>
  {/snippet}
</Marco>

<style>
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .bode {
    display: grid;
    gap: 8px;
  }
</style>
