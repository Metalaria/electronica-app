<script lang="ts">
  // AM and FM in time and frequency (book 30.4, 21.11, 15.3): AM varies the amplitude, (1 + m·cos ω_m t)·cos ω_c t,
  // giving the carrier and two sidebands of m/2 at f_c ± f_m (bandwidth 2·f_m; the carrier takes at least two
  // thirds of the power). FM varies the frequency by ±Δf; its spectrum has lines every f_m with amplitudes
  // J_n(β), β = Δf/f_m, and Carson's rule BW ≈ 2·(Δf + f_m): ±75 kHz and 15 kHz of audio → 180 kHz.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num, pct } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, barras, guia, X, type Ejes } from '../nucleo/grafica';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let tipo = $state<'am' | 'fm'>('am');
  let fm = $state(5000);
  let m = $state(0.5);
  let df = $state(75000);

  /** Bessel function of the first kind J_n(x) by numerical integration of its integral form. */
  function besselJ(nn: number, x: number): number {
    const K = 256;
    let s = 0;
    for (let i = 0; i <= K; i++) {
      const t = (Math.PI * i) / K;
      const w = i === 0 || i === K ? 0.5 : 1;
      s += w * Math.cos(nn * t - x * Math.sin(t));
    }
    return s / K;
  }

  const beta = $derived(df / fm);
  const lineas = $derived.by(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    if (tipo === 'am') {
      xs.push(-fm, 0, fm);
      ys.push(m / 2, 1, m / 2);
    } else {
      const nmax = Math.ceil(beta + 8);
      for (let k = -nmax; k <= nmax; k++) {
        const j = Math.abs(besselJ(Math.abs(k), beta));
        xs.push(k * fm);
        ys.push(j);
      }
    }
    return { xs, ys };
  });
  const carson = $derived(2 * (df + fm));

  // Visual time base: the carrier is drawn 24 times faster than the modulating signal.
  const RATIO = 24;
  let th = 0;
  let n = $state(0);
  const muestreo = new Muestreo(60);
  function paso(dt: number): void {
    th += (2 * Math.PI * dt) / 6; // one modulation period every 6 s
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const eT: Ejes = est ? { x: 50, y: 40, w: 520, h: 220, x0: 0, x1: 2, y0: -2.3, y1: 2.3 } : { x: 50, y: 40, w: 430, h: 300, x0: 0, x1: 2, y0: -2.3, y1: 2.3 };
    const ancho = tipo === 'am' ? Math.max(25e3, 3 * fm) : Math.max(130e3, 0.75 * carson);
    const eF: Ejes = est
      ? { x: 60, y: 320, w: 510, h: 200, x0: -ancho, x1: ancho, y0: 0, y1: 1.15 }
      : { x: 530, y: 40, w: 340, h: 300, x0: -ancho, x1: ancho, y0: 0, y1: 1.15 };
    const pasoM = ancho > 100e3 ? 100e3 : ancho > 40e3 ? 20e3 : 10e3;
    const marcas: number[] = [];
    for (let x = -Math.floor(ancho / pasoM) * pasoM; x <= ancho; x += pasoM) marcas.push(x);
    estatico(v, `mo:${est}:${tipo}:${ancho}`, (vv) => {
      panel(vv, eT, { titulo: 'Señal moduladora y portadora modulada (tiempo)', sinX: true, sinY: true, cero: true, marcasY: [] });
      panel(vv, eF, { titulo: 'Espectro alrededor de la portadora f_c', ux: 'Hz', fmtX: (x) => (x === 0 ? 'f_c' : `${x > 0 ? '+' : '−'}${num(Math.abs(x) / 1000, 0)} k`), marcasX: marcas, marcasY: [0, 0.5, 1] });
    });
    const M = 900;
    const xs = new Float64Array(M + 1);
    const ym = new Float64Array(M + 1);
    const yc = new Float64Array(M + 1);
    const env = new Float64Array(M + 1);
    for (let i = 0; i <= M; i++) {
      const u = (2 * i) / M; // in modulation periods
      const a = th - 2 * Math.PI * u;
      const mod = Math.cos(a);
      xs[i] = u;
      if (tipo === 'am') {
        const e = 1 + m * mod;
        ym[i] = mod * 0.6 + 1.7;
        env[i] = e;
        yc[i] = e * Math.cos(RATIO * a);
      } else {
        // Phase = ω_c t + β·sen(ω_m t); visual deviation compressed so the change of spacing stays visible.
        const bv = Math.min(beta, 15) * 0.35 + 0.2;
        ym[i] = mod * 0.6 + 1.7;
        yc[i] = Math.cos(RATIO * a + bv * Math.sin(a));
      }
    }
    curva(ctx, eT, xs, ym, p.serie[2], 2);
    curva(ctx, eT, xs, yc, p.acento, 1.4);
    if (tipo === 'am') {
      const yd = new Float64Array(M + 1);
      for (let i = 0; i <= M; i++) yd[i] = Math.max(0, env[i]!);
      curva(ctx, eT, xs, yd, alfa(p.corriente, 0.9), 1.8, [5, 4]);
      if (m > 1) txt(v, 'sobremodulación: la envolvente se dobla (distorsión)', eT.x + eT.w / 2, eT.y + eT.h - 12, { tam: 12, peso: 700, color: p.peligro });
    }
    txt(v, 'moduladora', eT.x + 6, eT.y + 12, { tam: 11.5, peso: 700, color: p.serie[2], alin: 'left' });
    // Spectrum.
    const w = Math.max(2, Math.min(7, ((eF.w * fm) / (2 * ancho)) * 0.5));
    barras(ctx, eF, lineas.xs, lineas.ys, p.acento, w);
    if (tipo === 'fm') {
      guia(ctx, eF, 'x', -carson / 2, alfa(p.peligro, 0.7));
      guia(ctx, eF, 'x', carson / 2, alfa(p.peligro, 0.7));
      txt(v, `Carson ${si(carson, 'Hz', 3)}`, X(eF, carson / 2) + 4, eF.y + 12, { tam: 11.5, color: p.peligro, alin: 'left', peso: 700 });
    } else {
      txt(v, `BW = 2·f_m = ${si(2 * fm, 'Hz', 3)}`, eF.x + eF.w - 6, eF.y + 12, { tam: 11.5, color: p.peligro, alin: 'right', peso: 700 });
    }
  }

  const potPort = $derived(tipo === 'am' ? 1 / (1 + (m * m) / 2) : besselJ(0, beta) ** 2);

  const texto = $derived.by(() => {
    if (tipo === 'am')
      return (
        `**AM:** la amplitud de la portadora sigue a la señal, (1 + m·cos ω_m t)·cos ω_c t, con índice m = ${num(m, 2)}. El espectro es la portadora y dos bandas laterales de m/2 a f_c ± f_m: ocupa 2·f_m = ${si(2 * fm, 'Hz', 3)} (una emisora de AM con 5 kHz de audio ocupa 10 kHz).\n` +
        `La portadora no lleva información y se lleva el ${pct(potPort, 1)} de la potencia (dos tercios con m = 1). ${m > 1 ? 'Con m > 1 la envolvente pasa por cero y se invierte: el detector de envolvente ya no recupera la señal.' : 'Un detector de envolvente (diodo y RC, práctica 21.11) recupera la señal.'}`
      );
    return (
      `**FM:** la frecuencia instantánea se desvía ±Δf = ${si(df, 'Hz', 3)} al ritmo de la señal (${si(fm, 'Hz', 3)}); índice β = Δf/f_m = ${num(beta, 2)}. El espectro tiene rayas cada f_m con amplitudes J_n(β): la portadora lleva ahora ${pct(potPort, 1)} de la potencia${Math.abs(besselJ(0, beta)) < 0.05 ? ', casi nada: es un cero de J_0' : ''}.\n` +
      `Regla de Carson: BW ≈ 2·(Δf + f_m) = ${si(carson, 'Hz', 3)}. Con los ±75 kHz y 15 kHz de la radio comercial son 180 kHz: el precio de la inmunidad al ruido, porque el receptor recorta la amplitud y solo mira la frecuencia.`
    );
  });

  const lecturas = $derived([
    { e: tipo === 'am' ? 'Índice m' : 'Índice β', v: tipo === 'am' ? num(m, 2) : num(beta, 2), c: pal.acento },
    { e: 'Ancho de banda', v: si(tipo === 'am' ? 2 * fm : carson, 'Hz', 3), c: pal.peligro },
    { e: 'Potencia en la portadora', v: pct(potPort, 1) },
    { e: 'Frecuencia moduladora', v: si(fm, 'Hz', 3), c: pal.serie[2] },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet modos()}
    <Selector
      bind:valor={tipo}
      opciones={[
        { valor: 'am', texto: 'AM (amplitud)' },
        { valor: 'fm', texto: 'FM (frecuencia)' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 560] : [900, 380])} etiqueta="Modulación de amplitud y de frecuencia en el tiempo y en el espectro" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Frecuencia moduladora f_m" bind:valor={fm} min={1000} max={20000} paso={500} unidad="Hz" />
    {#if tipo === 'am'}
      <Deslizador etiqueta="Índice de modulación m" bind:valor={m} min={0} max={1.4} paso={0.01} formato={(x) => num(x, 2)} />
    {:else}
      <Deslizador etiqueta="Desviación Δf" bind:valor={df} min={1000} max={100000} paso={500} unidad="Hz" />
      <button class="boton" onclick={() => ((df = 75000), (fm = 15000))}>Radio comercial: ±75 kHz, 15 kHz</button>
    {/if}
  {/snippet}
</Marco>
