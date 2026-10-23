<script lang="ts">
  // Switching converters (book 32.1–32.3, 52.18): buck, boost and inverting buck-boost with an ideal switch and
  // diode. The inductor's volt-seconds must balance over a period, which fixes the conversion ratio: buck
  // V_o = D·V_in (12 V → 5 V needs D = 0,417), boost V_o = V_in/(1 − D) (3,7 V → 5 V, D = 0,26), buck-boost
  // V_o = −V_in·D/(1 − D). With little load the current reaches zero before the end of the period
  // (discontinuous mode) and the ratio then depends on the load. Book example: 47 µH at 300 kHz → ΔI = 207 mA;
  // output ripple ΔI/(8·C·f) plus ESR·ΔI (100 µF, 50 mΩ: 0,9 mV and 10 mV). Shown in slow motion.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, type Vista } from '../../nucleo/dibujo';
  import { hilo, bobina, condensador, diodo, resistencia, fuente, interruptor, masa } from '../../nucleo/esquema';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num, pct } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, punto, type Ejes } from '../nucleo/grafica';
  import { corriente } from '../nucleo/simbolos';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  type Topo = 'buck' | 'boost' | 'buckboost';
  let topo = $state<Topo>('buck');
  let Vin = $state(12);
  let D = $state(0.417);
  let L = $state(47e-6);
  let fs = $state(300e3);
  let Io = $state(1);
  const C = 100e-6;
  const ESR = 0.05;

  $effect(() => {
    if (topo === 'buck') {
      Vin = 12;
      D = 0.417;
      Io = 1;
    } else if (topo === 'boost') {
      Vin = 3.7;
      D = 0.26;
      Io = 1;
    } else {
      Vin = 3.7;
      D = 0.47;
      Io = 0.5;
    }
  });

  /** Steady state of the ideal converter (CCM or DCM) with a resistive load drawing Io at the CCM voltage. */
  const ss = $derived.by(() => {
    const T = 1 / fs;
    const ratioCCM = topo === 'buck' ? D : topo === 'boost' ? 1 / (1 - D) : D / (1 - D);
    const R = (ratioCCM * Vin) / Io; // load resistance chosen for the requested current in CCM
    const K = (2 * L * fs) / R;
    const kcrit = topo === 'buck' ? 1 - D : topo === 'boost' ? D * (1 - D) ** 2 : (1 - D) ** 2;
    const dcm = K < kcrit;
    let M: number;
    if (!dcm) M = ratioCCM;
    else if (topo === 'buck') M = 2 / (1 + Math.sqrt(1 + (4 * K) / (D * D)));
    else if (topo === 'boost') M = (1 + Math.sqrt(1 + (4 * D * D) / K)) / 2;
    else M = D / Math.sqrt(K);
    const Vo = M * Vin; // magnitude (buck-boost output is negative)
    const vOn = topo === 'buck' ? Vin - Vo : Vin;
    const vOff = topo === 'buck' ? -Vo : topo === 'boost' ? Vin - Vo : -Vo;
    const dI = (vOn * D * T) / L;
    const io = Vo / R;
    const iMedL = topo === 'buck' ? io : io / (1 - D);
    let i0: number;
    let D2: number;
    if (!dcm) {
      i0 = iMedL - dI / 2;
      D2 = 1 - D;
    } else {
      i0 = 0;
      D2 = (dI * L) / (-vOff * T);
    }
    const ripC = topo === 'buck' ? dI / (8 * C * fs) : (io * D) / (C * fs);
    return { T, R, Vo, vOn, vOff, dI, i0, D2, dcm, io, iMedL, ripC, ripESR: ESR * (topo === 'buck' ? dI : io + dI / 2 + io) };
  });

  function iL(u: number): number {
    // u: fraction of the period.
    const s = ss;
    const T = s.T;
    if (u < D) return s.i0 + (s.vOn * u * T) / L;
    const ipk = s.i0 + (s.vOn * D * T) / L;
    if (s.dcm && u > D + s.D2) return 0;
    return Math.max(0, ipk + (s.vOff * (u - D) * T) / L);
  }

  // One switching period every 2,2 s on screen.
  let u = 0;
  const fases = { a: 0, b: 0, c: 0 };
  let n = $state(0);
  const muestreo = new Muestreo(50);
  function paso(dt: number): void {
    u = (u + dt / 2.2) % 3;
    const i = iL(u % 1);
    const k = 50 / Math.max(ss.i0 + ss.dI, 1e-6);
    fases.a += dt * i * k;
    fases.b += dt * ss.io * k;
    fases.c += dt * i * k;
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const s = ss;
    const fr = u % 1;
    const on = fr < D;
    const conduceD = !on && iL(fr) > 1e-9;
    const i = iL(fr);
    // Circuit geometry.
    const yT = 60;
    const yB = 200;
    const ym = (yT + yB) / 2;
    const xV = 40;
    const xX = 200;
    const xO = 360;
    const xR = 470;
    // Plots: inductor current over three periods and the switch-node (or inductor) voltage.
    const e1: Ejes = est ? { x: 60, y: 270, w: 510, h: 150, x0: 0, x1: 3, y0: 0, y1: Math.max(s.i0 + s.dI, 0.01) * 1.2 } : { x: 600, y: 40, w: 275, h: 150, x0: 0, x1: 3, y0: 0, y1: Math.max(s.i0 + s.dI, 0.01) * 1.2 };
    const vmax = Math.max(Math.abs(s.vOn), Math.abs(s.vOff)) * 1.2;
    const e2: Ejes = est ? { x: 60, y: 470, w: 510, h: 110, x0: 0, x1: 3, y0: -vmax, y1: vmax } : { x: 600, y: 240, w: 275, h: 130, x0: 0, x1: 3, y0: -vmax, y1: vmax };
    estatico(v, `cv:${est}:${topo}:${e1.y1}:${vmax}`, (vv) => {
      hilo(vv, [[xV, yT], [xV, yB], [xR, yB]]);
      hilo(vv, [[xR, yB], [xR, yT], [xO, yT]]);
      masa(vv, xX, yB + 2);
      panel(vv, e1, { titulo: 'Corriente de la bobina i_L', uy: 'A', fmtX: (x) => `${x} T`, marcasX: [0, 1, 2, 3] });
      panel(vv, e2, { titulo: 'Tensión en la bobina v_L', uy: 'V', fmtX: (x) => `${x} T`, marcasX: [0, 1, 2, 3], cero: true });
    });
    // Circuit.
    fuente(v, xV, ym, 22, 'dc');
    txt(v, `${num(Vin, 1)} V`, xV + 28, ym, { tam: 12, alin: 'left', color: p.suave });
    const verde = alfa(p.bien, 0.9);
    if (topo === 'buck') {
      interruptor(v, xV, yT, xX, yT, on ? 1 : 0, { color: on ? verde : p.tinta });
      bobina(v, xX, yT, xO, yT, { largo: 70 });
      diodo(v, xX, yB, xX, yT, { color: conduceD ? verde : p.tinta });
      corriente(v, on ? [[xV, yB], [xV, yT], [xO, yT]] : [[xX, yB], [xX, yT], [xO, yT]], fases.a, i, 40, 9);
    } else if (topo === 'boost') {
      bobina(v, xV, yT, xX, yT, { largo: 70 });
      interruptor(v, xX, yB, xX, yT, on ? 1 : 0, { color: on ? verde : p.tinta });
      diodo(v, xX, yT, xO, yT, { color: conduceD ? verde : p.tinta });
      corriente(v, on ? [[xV, yB], [xV, yT], [xX, yT], [xX, yB]] : [[xV, yB], [xV, yT], [xO, yT]], fases.a, i, 40, 9);
    } else {
      interruptor(v, xV, yT, xX, yT, on ? 1 : 0, { color: on ? verde : p.tinta });
      bobina(v, xX, yT, xX, yB, { largo: 70 });
      diodo(v, xO, yT, xX, yT, { color: conduceD ? verde : p.tinta });
      corriente(v, on ? [[xV, yB], [xV, yT], [xX, yT], [xX, yB]] : [[xO, yT], [xX, yT], [xX, yB]], fases.a, i, 40, 9);
    }
    condensador(v, xO, ym - 12, xO, ym + 12, { placa: 30 });
    hilo(v, [[xO, yT], [xO, ym - 12]]);
    hilo(v, [[xO, ym + 12], [xO, yB]]);
    resistencia(v, xR, ym - 40, xR, ym + 40, { largo: 56, alto: 18 });
    txtRico(v, `${topo === 'buckboost' ? '−' : ''}${num(s.Vo, 2)} V`, xR + 18, ym, { tam: 13, peso: 800, color: p.acento, alin: 'left' });
    txt(v, on ? 'interruptor cerrado: la bobina se carga' : conduceD ? 'abierto: la bobina se descarga por el diodo' : 'abierto y bobina vacía (discontinuo)', (xV + xR) / 2, 22, { tam: 12.5, peso: 700, color: on ? p.bien : conduceD ? p.corriente : p.suave });

    const M = 600;
    const xs = new Float64Array(M + 1);
    const yi = new Float64Array(M + 1);
    const yv = new Float64Array(M + 1);
    for (let k = 0; k <= M; k++) {
      const uu = (3 * k) / M;
      const f = uu % 1;
      xs[k] = uu;
      yi[k] = iL(f);
      yv[k] = f < D ? s.vOn : s.dcm && f > D + s.D2 ? 0 : s.vOff;
    }
    curva(ctx, e1, xs, yi, p.corriente, 2.2);
    curva(ctx, e2, xs, yv, p.acento, 2);
    guia(ctx, e1, 'y', s.iMedL, alfa(p.tinta, 0.4));
    guia(ctx, e1, 'x', u, alfa(p.tinta, 0.35));
    guia(ctx, e2, 'x', u, alfa(p.tinta, 0.35));
    punto(ctx, e1, u, i, p.corriente, 5.5, p.fondo);
  }

  const texto = $derived.by(() => {
    const s = ss;
    const ley =
      topo === 'buck'
        ? `V_o = D·V_in = ${num(D, 3)} × ${num(Vin, 1)}`
        : topo === 'boost'
          ? `V_o = V_in/(1 − D) = ${num(Vin, 1)}/${num(1 - D, 3)}`
          : `V_o = −V_in·D/(1 − D) = −${num(Vin, 1)} × ${num(D, 3)}/${num(1 - D, 3)}`;
    return (
      `**Balance de voltios-segundos:** en régimen la corriente de la bobina acaba cada periodo donde empezó, así que la tensión por tiempo en las dos fases se anula. Sale ${ley}, ${s.dcm ? 'pero ahora está en **modo discontinuo** y la salida sube a ' + num(s.Vo, 2) + ' V: depende de la carga' : 'es decir ' + num(s.Vo, 2) + ' V, sin depender de la carga ni de la bobina'}.\n` +
      `Rizado de corriente ΔI = ${si(s.dI, 'A', 3)} (${pct(s.dI / Math.max(s.iMedL, 1e-9), 0)} de la media; el libro aconseja del 20 al 40 %). Rizado de salida: ${si(s.ripC, 'V', 2)} por la capacidad (100 µF) y ${si(s.ripESR, 'V', 2)} por la ESR de 50 mΩ: lo fija la ESR.` +
      (topo === 'boost' ? ' En el elevador la corriente de salida llega a pulsos y la de entrada es mayor que la de salida.' : '')
    );
  });

  const lecturas = $derived([
    { e: 'Tensión de salida', v: `${topo === 'buckboost' ? '−' : ''}${si(ss.Vo, 'V', 3)}`, c: pal.acento },
    { e: 'Modo', v: ss.dcm ? 'discontinuo' : 'continuo' },
    { e: 'ΔI de la bobina', v: si(ss.dI, 'A', 3), c: pal.corriente },
    { e: 'Corriente media de la bobina', v: si(ss.iMedL, 'A', 3) },
    { e: 'Pico de corriente', v: si(ss.i0 + ss.dI, 'A', 3) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['corriente']}>
  {#snippet modos()}
    <Selector
      bind:valor={topo}
      opciones={[
        { valor: 'buck', texto: 'Reductor (buck)' },
        { valor: 'boost', texto: 'Elevador (boost)' },
        { valor: 'buckboost', texto: 'Reductor-elevador' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 600] : [900, 400])} etiqueta="Convertidor conmutado con la corriente de la bobina en cámara lenta" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Ciclo de trabajo D" bind:valor={D} min={0.05} max={0.9} paso={0.001} formato={(x) => num(x, 3)} />
    <Deslizador etiqueta="Tensión de entrada" bind:valor={Vin} min={2} max={24} paso={0.1} unidad="V" />
    <Deslizador etiqueta="Corriente de carga (en continuo)" bind:valor={Io} min={0.01} max={3} log unidad="A" />
    <Deslizador etiqueta="Bobina L" bind:valor={L} min={1e-6} max={470e-6} log unidad="H" />
    <Deslizador etiqueta="Frecuencia de conmutación" bind:valor={fs} min={20e3} max={2e6} log unidad="Hz" />
  {/snippet}
</Marco>
