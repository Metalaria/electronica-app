<script lang="ts">
  // Sampling and aliasing (book 29.4, 20.20, 51.3): samples at f_s; above f_s/2 a component reappears at
  // |f − k·f_s| and the samples are exactly those of the false, lower frequency. Book example: 700 Hz sampled
  // at 1000 Hz looks like 300 Hz. The folding diagram (figure 29.7) shows the apparent frequency going down
  // as the real one goes up past f_s/2; the spectrum shows the replicas around every multiple of f_s.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Interruptor from '../../ui/Interruptor.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, circulo, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, punto, barras, X, Y, type Ejes } from '../nucleo/grafica';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let f = $state(700);
  let fs = $state(1000);
  let barrer = $state(false);

  const alias = $derived.by(() => {
    const r = ((f % fs) + fs) % fs;
    const plegada = r > fs / 2;
    return { fa: plegada ? fs - r : r, signo: plegada ? -1 : 1 };
  });

  // Time on screen: one sampling period every 0,45 s. The plot shows 10 sampling periods ending «now».
  let t = 0;
  let fase = 0;
  let n = $state(0);
  const muestreo = new Muestreo(70);
  function paso(dt: number): void {
    t += (dt / 0.45) * (1 / fs);
    if (barrer) {
      fase += dt / 24;
      f = Math.round((1550 - 1450 * Math.cos(2 * Math.PI * fase)) / 5) * 5;
    }
    if (muestreo.toca()) n++;
  }
  $effect(() => {
    void fs;
    t = 0;
  });

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const Ts = 1 / fs;
    const span = 10 * Ts;
    const t0 = t - span;
    const eT: Ejes = est ? { x: 60, y: 40, w: 510, h: 170, x0: t0, x1: t, y0: -1.25, y1: 1.25 } : { x: 60, y: 40, w: 500, h: 190, x0: t0, x1: t, y0: -1.25, y1: 1.25 };
    const fmax = 3000;
    const eP: Ejes = est ? { x: 60, y: 270, w: 510, h: 150, x0: 0, x1: fmax, y0: 0, y1: 2500 / 2 } : { x: 630, y: 40, w: 240, h: 330, x0: 0, x1: fmax, y0: 0, y1: 2500 / 2 };
    const eS: Ejes = est ? { x: 60, y: 480, w: 510, h: 110, x0: 0, x1: 2.6 * fs, y0: 0, y1: 1.2 } : { x: 60, y: 290, w: 500, h: 80, x0: 0, x1: 2.6 * fs, y0: 0, y1: 1.2 };
    eP.y1 = Math.max(fs / 2, 500) * 1.1;
    estatico(v, `ma:${est}:${fs}`, (vv) => {
      panel(vv, eT, { titulo: 'Señal real, muestras y lo que reconstruyen', sinX: true, cero: true, marcasY: [-1, 0, 1] });
      panel(vv, eP, { titulo: 'Frecuencia aparente', ux: 'Hz', uy: 'Hz', etX: 'f real' });
      panel(vv, eS, { titulo: 'Espectro tras muestrear', ux: 'Hz', sinY: true, marcasY: [] });
      const c = vv.ctx;
      c.fillStyle = alfa(p.bien, 0.1);
      c.fillRect(eS.x, eS.y, X(eS, fs / 2) - eS.x, eS.h);
      c.fillRect(eP.x, eP.y, X(eP, fs / 2) - eP.x, eP.h);
      // Folding line: apparent frequency against real frequency.
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 0; i <= 600; i++) {
        const fr = (fmax * i) / 600;
        const r = ((fr % fs) + fs) % fs;
        xs.push(fr);
        ys.push(r > fs / 2 ? fs - r : r);
      }
      curva(c, eP, xs, ys, p.serie[4], 2);
      guia(c, eP, 'y', fs / 2, alfa(p.tinta, 0.4));
      for (const m of [1, 2, 3]) guia(c, eS, 'x', m * fs, alfa(p.tinta, 0.3));
      txt(vv, 'f_s/2', X(eS, fs / 2), eS.y + 10, { tam: 11, color: p.bien, peso: 700 });
    });

    // Continuous signal.
    const M = 500;
    const xs = new Float64Array(M + 1);
    const ys = new Float64Array(M + 1);
    const ya = new Float64Array(M + 1);
    for (let i = 0; i <= M; i++) {
      const tt = t0 + (span * i) / M;
      xs[i] = tt;
      ys[i] = Math.sin(2 * Math.PI * f * tt);
      // Folded alias: the samples are those of sen(2π·(−f_a)·t).
      ya[i] = Math.sin(2 * Math.PI * alias.fa * alias.signo * tt);
    }
    curva(ctx, eT, xs, ys, alfa(p.acento, 0.8), 1.6);
    const falso = Math.abs(alias.fa - f) > 1e-6;
    curva(ctx, eT, xs, ya, falso ? p.peligro : p.bien, 2.4, [6, 4]);
    // Samples with stems.
    const k0 = Math.ceil(t0 / Ts);
    for (let k = k0; k * Ts <= t + 1e-12; k++) {
      const ts = k * Ts;
      const val = Math.sin(2 * Math.PI * f * ts);
      ctx.strokeStyle = alfa(p.tinta, 0.4);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(X(eT, ts), Y(eT, 0));
      ctx.lineTo(X(eT, ts), Y(eT, val));
      ctx.stroke();
      circulo(ctx, X(eT, ts), Y(eT, val), 5, p.corriente, p.fondo, 1.5);
    }
    txt(v, `${si(f, 'Hz', 3)} real`, eT.x + 8, eT.y + 10, { tam: 12, peso: 700, color: p.acento, alin: 'left' });
    txt(v, falso ? `${si(alias.fa, 'Hz', 3)} aparente (alias)` : 'reconstrucción correcta', eT.x + 8, eT.y + 28, { tam: 12, peso: 700, color: falso ? p.peligro : p.bien, alin: 'left' });

    // Folding diagram point.
    guia(ctx, eP, 'x', f, alfa(p.acento, 0.5));
    punto(ctx, eP, f, alias.fa, falso ? p.peligro : p.bien, 6.5, p.fondo);

    // Spectrum: the line and its replicas k·f_s ± f.
    const lx: number[] = [];
    const ly: number[] = [];
    for (let k = 0; k <= 3; k++)
      for (const s of [-1, 1]) {
        const fr = k * fs + s * f;
        if (fr > 0 && fr < 2.6 * fs) {
          lx.push(fr);
          ly.push(1);
        }
      }
    barras(ctx, eS, lx, ly.map(() => 0.65), alfa(p.acento, 0.45), 3);
    barras(ctx, eS, [f], [1], p.acento, 4);
    if (falso && alias.fa < fs / 2) barras(ctx, eS, [alias.fa], [0.65], p.peligro, 4);
  }

  const texto = $derived.by(() => {
    const { fa } = alias;
    const ok = f < fs / 2;
    return (
      `**Muestrear a f_s = ${si(fs, 'Hz', 3)}** solo distingue frecuencias por debajo de f_s/2 = ${si(fs / 2, 'Hz', 3)} (frecuencia de Nyquist). ` +
      (ok
        ? `La señal de ${si(f, 'Hz', 3)} cumple f_s > 2·f: sus muestras determinan la senoide y se reconstruye exacta.\n`
        : `La señal de ${si(f, 'Hz', 3)} no lo cumple: sus muestras son exactamente las de una senoide de ${si(fa, 'Hz', 3)} = |f − k·f_s|, y una vez dentro es indistinguible de una señal legítima.\n`) +
      'Al muestrear, el espectro se repite alrededor de cada múltiplo de f_s; si una réplica cae en la banda útil, ningún procesado posterior la separa. Por eso el **filtro antialiasing** va antes del convertidor, es analógico y no tiene sustituto. En el banco: con 1 000 puntos a 1 ms/div el 2C53T muestrea a 83,3 kS/s y una conmutada de 251 kHz parece de 1 kHz.'
    );
  });

  const lecturas = $derived([
    { e: 'Frecuencia real', v: si(f, 'Hz', 4), c: pal.acento },
    { e: 'Frecuencia aparente', v: si(alias.fa, 'Hz', 4), c: Math.abs(alias.fa - f) > 1e-6 ? pal.peligro : pal.bien },
    { e: 'f_s / 2 (Nyquist)', v: si(fs / 2, 'Hz', 4) },
    { e: 'Muestras por periodo', v: num(fs / f, 2) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 620] : [900, 400])} etiqueta="Muestreo de una senoide, la frecuencia aparente y las réplicas del espectro" />
  {/snippet}
  {#snippet controles()}
    <div class="botones">
      <button class="boton" onclick={() => ((f = 700), (fs = 1000), (barrer = false))}>700 Hz a 1 kHz (figura 29.7)</button>
      <button class="boton" onclick={() => ((f = 500), (fs = 1000), (barrer = false))}>Justo f_s/2</button>
    </div>
    <Interruptor etiqueta="Barrer la frecuencia de la señal" bind:valor={barrer} />
    <Deslizador etiqueta="Frecuencia de la señal f" bind:valor={f} min={50} max={3000} paso={5} unidad="Hz" desactivado={barrer} />
    <Deslizador etiqueta="Frecuencia de muestreo f_s" bind:valor={fs} min={300} max={5000} paso={50} unidad="Hz" />
  {/snippet}
</Marco>

<style>
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
