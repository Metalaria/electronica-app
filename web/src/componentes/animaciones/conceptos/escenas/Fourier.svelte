<script lang="ts">
  // Fourier series (book 0.11, 20.12, 21.6): a periodic wave as the sum of its fundamental and harmonics. The
  // harmonics are drawn as a chain of rotating phasors (epicycles) whose tip traces the partial sum; the
  // spectrum shows each amplitude. Square: odd harmonics 4/(nπ); triangle: odd, 8/(π²n²); sawtooth: all,
  // 2/(nπ); pulse of duty cycle D: 2·sen(nπD)/(nπ). Near the jumps the partial sum overshoots about 9 % of the
  // jump however many harmonics are added (Gibbs).
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import Interruptor from '../../ui/Interruptor.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, circulo, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { num, pct } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, barras, type Ejes } from '../nucleo/grafica';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  type Forma = 'cuadrada' | 'triangular' | 'sierra' | 'pulso';
  let forma = $state<Forma>('cuadrada');
  let N = $state(9);
  let D = $state(0.25);
  let construir = $state(false);

  /** Mean value and harmonics c·sen(nθ + φ) of the chosen wave (unit amplitude). */
  function coefs(f: Forma, n: number): { a0: number; c: number[]; fi: number[] } {
    const c: number[] = [0];
    const fi: number[] = [0];
    let a0 = 0;
    for (let k = 1; k <= n; k++) {
      let ck = 0;
      let fk = 0;
      if (f === 'cuadrada') ck = k % 2 ? 4 / (k * Math.PI) : 0;
      else if (f === 'triangular') {
        ck = k % 2 ? 8 / (Math.PI * Math.PI * k * k) : 0;
        fk = k % 4 === 3 ? Math.PI : 0;
      } else if (f === 'sierra') {
        ck = 2 / (k * Math.PI);
        fk = k % 2 ? 0 : Math.PI;
      } else {
        a0 = D;
        const a = (2 * Math.sin(k * Math.PI * D)) / (k * Math.PI);
        ck = Math.abs(a);
        fk = a >= 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      c.push(ck);
      fi.push(fk);
    }
    if (f === 'pulso') a0 = D;
    return { a0, c, fi };
  }

  function ideal(f: Forma, th: number): number {
    const u = (((th / (2 * Math.PI)) % 1) + 1) % 1;
    if (f === 'cuadrada') return u < 0.5 ? 1 : -1;
    if (f === 'triangular') return u < 0.25 ? 4 * u : u < 0.75 ? 2 - 4 * u : 4 * u - 4;
    if (f === 'sierra') return u < 0.5 ? 2 * u : 2 * u - 2;
    const w = Math.min(u, 1 - u);
    return w < D / 2 ? 1 : 0;
  }

  // Number of harmonics shown: N, or growing one by one in «construir» mode.
  let nVis = $state(9);
  let tC = 0;
  let th = 0;
  let n = $state(0);
  const muestreo = new Muestreo(60);
  $effect(() => {
    if (!construir) nVis = N;
  });
  $effect(() => {
    void forma;
    tC = 0;
  });
  function paso(dt: number): void {
    th = (th + (2 * Math.PI * dt) / 5) % (2 * Math.PI);
    if (construir) {
      tC += dt;
      const k = 1 + Math.floor(tC / 1.1);
      const nn = k > N + 2 ? 1 : k;
      if (k > N + 2) tC = 0;
      if (Math.min(nn, N) !== nVis) nVis = Math.min(nn, N);
    }
    if (muestreo.toca()) n++;
  }

  const datos = $derived.by(() => {
    const cf = coefs(forma, nVis);
    const M = 600;
    const xs = new Float64Array(M + 1);
    const ys = new Float64Array(M + 1);
    const yi = new Float64Array(M + 1);
    let max = -1e9;
    for (let i = 0; i <= M; i++) {
      const tt = (2 * i) / M;
      const a = 2 * Math.PI * tt;
      let s = cf.a0;
      for (let k = 1; k < cf.c.length; k++) if (cf.c[k]) s += cf.c[k]! * Math.sin(k * a + cf.fi[k]!);
      xs[i] = tt;
      ys[i] = s;
      yi[i] = ideal(forma, a);
      max = Math.max(max, s);
    }
    // Power of the partial sum vs the ideal (Parseval): fraction of the signal's power captured.
    let pIdeal = 0;
    for (let i = 0; i < M; i++) pIdeal += yi[i]! * yi[i]!;
    pIdeal /= M;
    let pSum = cf.a0 * cf.a0;
    for (let k = 1; k < cf.c.length; k++) pSum += (cf.c[k]! * cf.c[k]!) / 2;
    return { cf, xs, ys, yi, max, frac: pSum / pIdeal };
  });

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const cf = datos.cf;
    const lim = forma === 'pulso' ? [-0.3, 1.35] : [-1.35, 1.35];
    const R = est ? 95 : 105;
    const k = R / 1.35;
    const cx = est ? 125 : 140;
    const eT: Ejes = est ? { x: 260, y: 0, w: 320, h: 0, x0: 0, x1: 2, y0: lim[0]!, y1: lim[1]! } : { x: 300, y: 0, w: 330, h: 0, x0: 0, x1: 2, y0: lim[0]!, y1: lim[1]! };
    const cyRef = est ? 150 : 175;
    // Equal scales: one unit of amplitude is k logical units in both the circles and the plot.
    eT.h = (lim[1]! - lim[0]!) * k;
    eT.y = cyRef - lim[1]! * k;
    const eS: Ejes = est
      ? { x: 70, y: 340, w: 500, h: 170, x0: 0, x1: Math.max(N, 9) + 1, y0: 0, y1: 1.35 }
      : { x: 680, y: 60, w: 190, h: 260, x0: 0, x1: Math.max(N, 9) + 1, y0: 0, y1: 1.35 };
    estatico(v, `fo:${est}:${forma}:${N}`, (vv) => {
      panel(vv, eT, { titulo: 'Suma parcial (y la onda ideal)', fmtX: (x) => `${num(x, 1).replace(',0', '')} T`, cero: true, marcasY: forma === 'pulso' ? [0, 1] : [-1, 0, 1] });
      panel(vv, eS, { titulo: 'Espectro: amplitud de cada armónico', fmtX: (x) => `${num(x, 0)}f`, marcasX: [1, 3, 5, 7, 9, 15, 25, 35, 45].filter((m) => m <= Math.max(N, 9)), cero: true });
    });
    // Ideal wave and partial sum («now» at the left edge, as in the phasor scene).
    const M = datos.xs.length;
    const xs = new Float64Array(M);
    const ys = new Float64Array(M);
    const yi = new Float64Array(M);
    // The table holds two periods of the sum at θ = 2π·tt: shift it by the present angle.
    const P = (M - 1) / 2;
    for (let i = 0; i < M; i++) {
      const tt = datos.xs[i]!;
      const u = (((th / (2 * Math.PI) - tt) % 1) + 1) % 1;
      const j = Math.min(P - 1, Math.floor(u * P));
      const f = u * P - j;
      xs[i] = tt;
      ys[i] = datos.ys[j]! * (1 - f) + datos.ys[j + 1]! * f;
      yi[i] = datos.yi[j]! * (1 - f) + datos.yi[j + 1]! * f;
    }
    curva(ctx, eT, xs, yi, alfa(p.tinta, 0.35), 1.4, [5, 4]);
    curva(ctx, eT, xs, ys, p.acento, 2.4);

    // Epicycles.
    let x = cx;
    let y = cyRef - cf.a0 * k;
    ctx.lineWidth = 1;
    for (let kk = 1; kk < cf.c.length; kk++) {
      const c = cf.c[kk]!;
      if (c * k < 0.4) continue;
      const a = kk * th + cf.fi[kk]!;
      const nx = x + c * k * Math.cos(a);
      const ny = y - c * k * Math.sin(a);
      ctx.strokeStyle = alfa(p.serie[kk === 1 ? 0 : 4], kk === 1 ? 0.5 : 0.28);
      ctx.beginPath();
      ctx.arc(x, y, c * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = kk === 1 ? p.serie[0] : alfa(p.serie[4], 0.9);
      ctx.lineWidth = kk === 1 ? 2.2 : 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      ctx.lineWidth = 1;
      x = nx;
      y = ny;
    }
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = alfa(p.acento, 0.6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(eT.x, y);
    ctx.stroke();
    ctx.restore();
    circulo(ctx, x, y, 3.6, p.acento);
    circulo(ctx, eT.x, y, 3.6, p.acento);
    txt(v, `${nVis} ${nVis === 1 ? 'armónico' : 'armónicos'}`, cx, cyRef + R + 30, { tam: 12.5, peso: 700, color: p.suave });

    // Spectrum.
    const hx: number[] = [];
    const hy: number[] = [];
    for (let kk = 1; kk < cf.c.length; kk++) {
      hx.push(kk);
      hy.push(cf.c[kk]!);
    }
    const w = Math.max(2, Math.min(9, (eS.w / (Math.max(N, 9) + 1)) * 0.5));
    // Harmonics not yet added: faint.
    const todos = coefs(forma, N);
    barras(ctx, eS, todos.c.map((_, i) => i).slice(1), todos.c.slice(1), alfa(p.tinta, 0.15), w);
    barras(ctx, eS, hx, hy, p.acento, w);
    if (cf.a0) barras(ctx, eS, [0], [cf.a0], p.serie[2], w);
  }

  const gibbs = $derived(forma === 'cuadrada' || forma === 'sierra' ? (datos.max - 1) / 2 : NaN);

  const texto = $derived.by(() => {
    const desc =
      forma === 'cuadrada'
        ? 'La **onda cuadrada** es la fundamental más los armónicos impares, con amplitudes 4/(nπ): el tercero vale 1/3 de la fundamental, el quinto 1/5…'
        : forma === 'triangular'
          ? 'La **triangular** solo tiene armónicos impares y caen con 1/n²: con tres o cuatro ya se parece mucho. Sin saltos, la serie converge deprisa.'
          : forma === 'sierra'
            ? 'El **diente de sierra** tiene todos los armónicos, pares e impares, con amplitudes 2/(nπ).'
            : `Un **tren de pulsos** con ciclo de trabajo ${pct(D, 0)} tiene un valor medio (componente continua) de ${num(D, 2)} y armónicos 2·sen(nπD)/(nπ): los múltiplos de 1/D = ${num(1 / D, 1)} desaparecen.`;
    return (
      `${desc}\n` +
      `Con ${nVis} armónicos la suma lleva el ${pct(Math.min(1, datos.frac), 1)} de la potencia de la onda ideal (Parseval). ` +
      (Number.isFinite(gibbs)
        ? `Junto a los saltos la suma se pasa un ${pct(gibbs, 1)} del salto, y añadir armónicos estrecha el rebote pero no lo baja: es el **fenómeno de Gibbs**. Los flancos rápidos exigen armónicos de frecuencia muy alta, y esos son los que radian.`
        : 'Cada armónico es una senoide que gira n veces más deprisa que la fundamental: un circuito lineal trata cada una por separado.')
    );
  });

  const lecturas = $derived([
    { e: 'Armónicos sumados', v: String(nVis), c: pal.acento },
    { e: 'Fundamental (amplitud)', v: num(datos.cf.c[1] ?? 0, 3), c: pal.serie[0] },
    { e: 'Potencia recogida', v: pct(Math.min(1, datos.frac), 2) },
    { e: 'Máximo de la suma', v: num(datos.max, 3) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet modos()}
    <Selector
      bind:valor={forma}
      opciones={[
        { valor: 'cuadrada', texto: 'Cuadrada' },
        { valor: 'triangular', texto: 'Triangular' },
        { valor: 'sierra', texto: 'Diente de sierra' },
        { valor: 'pulso', texto: 'Pulsos' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 540] : [900, 360])} etiqueta="Síntesis de una onda por sus armónicos, con los fasores giratorios y el espectro" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Armónicos (hasta el n)" bind:valor={N} min={1} max={49} paso={1} formato={(x) => String(x)} />
    <Interruptor etiqueta="Construir armónico a armónico" bind:valor={construir} />
    {#if forma === 'pulso'}<Deslizador etiqueta="Ciclo de trabajo D" bind:valor={D} min={0.05} max={0.95} paso={0.01} formato={(x) => pct(x, 0)} />{/if}
  {/snippet}
</Marco>
