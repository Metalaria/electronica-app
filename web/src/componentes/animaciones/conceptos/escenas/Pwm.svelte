<script lang="ts">
  // PWM (book 16.5, 37.5, 14.5, 7.5): analogWrite() gives a square wave of variable duty cycle (value/255) at
  // 490 Hz, not a voltage; the load averages it: the eye for an LED, the inertia for a motor, an RC filter for
  // an analog input. The RC is solved exactly (piecewise exponentials): its ripple is about V·D·(1 − D)·T/τ, and
  // with τ = 10 ms at 490 Hz and 50 % about 0,25 V peak to peak, as the book says. Shown in slow motion.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, brillo, circulo, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num, pct } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, Y, type Ejes } from '../nucleo/grafica';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  const VCC = 5;
  let valor = $state(128);
  let fpwm = $state(490);
  let tau = $state(10e-3);

  const D = $derived(valor / 255);
  const T = $derived(1 / fpwm);
  const estable = $derived.by(() => {
    const a = Math.exp((-D * T) / tau);
    const b = Math.exp((-(1 - D) * T) / tau);
    const vmax = (VCC * (1 - a)) / (1 - a * b);
    return { vmax, vmin: vmax * b };
  });

  // Process time: one PWM period lasts 0,9 s on screen.
  let tp = 0; // process time (s)
  let vc = 0;
  let w = 0; // motor speed (fraction)
  let ang = 0;
  const HIST = 900;
  const hV = new Float64Array(HIST);
  const hP = new Float64Array(HIST);
  let ih = 0;
  let acum = 0;
  let n = $state(0);
  const muestreo = new Muestreo(60);
  $effect(() => {
    void reloj.reinicios;
    vc = 0;
    w = 0;
    hV.fill(0);
    hP.fill(0);
  });

  function paso(dt: number): void {
    // One PWM period every 0,9 s, but fast enough that the filter settles (5τ) in about 10 s.
    const esc = Math.max(T / 0.9, (5 * tau) / 10);
    acum += dt * esc;
    const h = T / 60; // 60 steps per PWM period
    while (acum >= h) {
      acum -= h;
      const fase = (tp % T) / T;
      const alto = fase < D;
      const vin = alto ? VCC : 0;
      vc = vin + (vc - vin) * Math.exp(-h / tau);
      // Motor: mechanical time constant of 1,5 s on screen (many periods).
      w += (((alto ? 1 : 0) - w) * h) / (1.5 * esc);
      tp += h;
      hV[ih % HIST] = vc;
      hP[ih % HIST] = vin;
      ih++;
    }
    ang += dt * w * 6;
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const e: Ejes = est ? { x: 60, y: 40, w: 510, h: 230, x0: -15, x1: 0, y0: -0.3, y1: 5.6 } : { x: 60, y: 40, w: 560, h: 300, x0: -15, x1: 0, y0: -0.3, y1: 5.6 };
    estatico(v, `pw:${est}`, (vv) => {
      panel(vv, e, { titulo: 'Salida PWM y tensión tras el filtro RC', fmtX: (x) => `${num(x, 0)} T`, marcasX: [-15, -10, -5, 0], uy: 'V', marcasY: [0, 1, 2, 3, 4, 5] });
    });
    const M = Math.min(ih, HIST);
    const xs = new Float64Array(M);
    const yv = new Float64Array(M);
    const yp = new Float64Array(M);
    for (let k = 0; k < M; k++) {
      const j = (ih - M + k + HIST) % HIST;
      xs[k] = -(M - 1 - k) / 60;
      yv[k] = hV[j]!;
      yp[k] = hP[j]!;
    }
    curva(ctx, e, xs, yp, alfa(p.acento, 0.7), 1.8);
    curva(ctx, e, xs, yv, p.corriente, 2.6);
    guia(ctx, e, 'y', D * VCC, alfa(p.bien, 0.8), 1.4);
    txt(v, `media D·V = ${num(D * VCC, 2)} V`, e.x + e.w - 4, Y(e, D * VCC) - 9, { tam: 11.5, peso: 700, color: p.bien, alin: 'right' });

    // LED (averaged by the eye) and motor (averaged by its inertia).
    const lx = est ? 130 : 700;
    const ly = est ? 340 : 110;
    const mx = est ? 400 : 780;
    const my = est ? 340 : 260;
    brillo(ctx, lx, ly, 60, '#ff3b30', 0.75 * D);
    circulo(ctx, lx, ly, 18, alfa('#ff3b30', 0.2 + 0.8 * D), p.tinta, 2);
    txt(v, 'LED: promedia el ojo', lx, ly + 44, { tam: 12, peso: 700, color: p.suave });
    circulo(ctx, mx, my, 34, p.panel, p.tinta, 2.5);
    for (let k = 0; k < 3; k++) {
      const a = ang + (k * 2 * Math.PI) / 3;
      ctx.strokeStyle = p.acento;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + 28 * Math.cos(a), my + 28 * Math.sin(a));
      ctx.stroke();
    }
    txt(v, `motor: ${pct(w, 0)} de la velocidad`, mx, my + 56, { tam: 12, peso: 700, color: p.suave });
  }

  const texto = $derived(
    `**analogWrite(${valor})** da un ciclo de trabajo de ${valor}/255 = ${pct(D, 1)}: la salida está a 5 V durante ${si(D * T, 's', 3)} de cada periodo de ${si(T, 's', 3)} (${si(fpwm, 'Hz', 3)}). No es una tensión: la media, ${num(D * VCC, 2)} V, solo aparece si alguien promedia.\n` +
      `El filtro RC de τ = ${si(tau, 's', 2)} deja un rizado de ${num(estable.vmax - estable.vmin, 3)} V pico a pico (≈ V·D·(1−D)·T/τ) y tarda unos 5τ = ${si(5 * tau, 's', 2)} en asentarse: menos rizado exige más τ y responde más despacio. Subir la frecuencia ayuda, pero con un reloj de 16 MHz a 20 kHz solo quedan 800 pasos: frecuencia y resolución compiten.`,
  );

  const lecturas = $derived([
    { e: 'Ciclo de trabajo', v: pct(D, 1), c: pal.acento },
    { e: 'Tensión media', v: si(D * VCC, 'V', 3), c: pal.bien },
    { e: 'Rizado tras el RC', v: si(estable.vmax - estable.vmin, 'V', 3), c: pal.corriente },
    { e: 'Periodo', v: si(T, 's', 3) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet modos()}
    <Selector
      etiqueta="Frecuencia del PWM"
      bind:valor={fpwm}
      opciones={[
        { valor: 490, texto: '490 Hz (Arduino)' },
        { valor: 980, texto: '980 Hz (pines 5 y 6)' },
        { valor: 20000, texto: '20 kHz (motores)' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 430] : [900, 380])} etiqueta="Señal PWM, su filtrado RC y dos cargas que la promedian" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="analogWrite(valor)" bind:valor min={0} max={255} paso={1} formato={(x) => String(x)} />
    <Deslizador etiqueta="Constante de tiempo del filtro τ = RC" bind:valor={tau} min={0.1e-3} max={100e-3} log unidad="s" />
  {/snippet}
</Marco>
