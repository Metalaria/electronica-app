<script lang="ts">
  // Oscillators and the Barkhausen criterion (book 27.1, 27.4, 27.7): a Wien bridge (10 kΩ and 10 nF, 1592 Hz)
  // has zero phase and gain 1/3 at f₀ = 1/(2πRC), so the amplifier needs a gain of exactly 3. With less the
  // oscillation dies; with more it grows from noise as e^((A−3)·t/(2RC)) until a non-linear mechanism stops it:
  // the supply rails (clipping, distortion of several %), two diodes (soft, about 1 %) or Hewlett's lamp
  // (slow and smooth, below 0,01 %). Integrated in time with the amplifier's real non-linearity; the THD is
  // computed from the last cycles with an FFT.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num, pct } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, type Ejes } from '../nucleo/grafica';
  import { fft, ventana } from '../nucleo/senal';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let A = $state(3.3);
  let mecanismo = $state<'railes' | 'diodos' | 'lampara'>('diodos');
  const VS = 13; // output swing limit with ±15 V supplies
  const VK = 1.2; // knee of the diode limiter (referred to the output)

  // State (time in units of τ = RC; ω₀ = 1/τ).
  let v = 1e-3;
  let dv = 0;
  let P = 0; // filtered output power (lamp)
  let tSim = 0;
  const REG = 1600;
  const regY = new Float64Array(REG);
  let iReg = 0;
  let acum = 0;
  let dec = 0;
  let lazo = 1;
  const DEC = 5; // one stored sample every 0,1 τ: 1600 samples hold about 25 periods

  function g1(x: number): number {
    // Small-signal derivative of the amplifier characteristic y = g(v) at v.
    if (mecanismo === 'railes') {
      const c = Math.cosh((A * x) / VS);
      return A / (c * c);
    }
    if (mecanismo === 'diodos') return 3 * 0.92 + (A - 3 * 0.92) / Math.sqrt(1 + ((A * x) / VK) ** 2);
    return 1 + (A - 1) / (1 + 0.05 * P);
  }
  function g(x: number): number {
    if (mecanismo === 'railes') return VS * Math.tanh((A * x) / VS);
    if (mecanismo === 'diodos') {
      const k = A - 3 * 0.92;
      return 3 * 0.92 * x + (VK / A) * k * Math.asinh((A * x) / VK);
    }
    return (1 + (A - 1) / (1 + 0.05 * P)) * x;
  }
  function deriv(x: number, y: number): [number, number] {
    return [y, (g1(x) - 3) * y - x];
  }
  function reiniciar(): void {
    v = 0.02;
    dv = 0;
    P = 0;
    tSim = 0;
    lazo = A / 3;
    regY.fill(0);
    iReg = 0;
  }
  $effect(() => {
    void reloj.reinicios;
    void mecanismo;
    reiniciar();
  });

  // One oscillation period (2π·τ) lasts 1,2 s on screen.
  const ESC = (2 * Math.PI) / 1.2;
  const H = 0.02;
  let n = $state(0);
  const muestreo = new Muestreo(80);
  function paso(dt: number): void {
    acum += dt * ESC;
    while (acum >= H) {
      acum -= H;
      const [k1a, k1b] = deriv(v, dv);
      const [k2a, k2b] = deriv(v + (H / 2) * k1a, dv + (H / 2) * k1b);
      const [k3a, k3b] = deriv(v + (H / 2) * k2a, dv + (H / 2) * k2b);
      const [k4a, k4b] = deriv(v + H * k3a, dv + H * k3b);
      v += (H / 6) * (k1a + 2 * k2a + 2 * k3a + k4a);
      dv += (H / 6) * (k1b + 2 * k2b + 2 * k3b + k4b);
      const y = g(v);
      // Thermal time constant of the lamp: about 15 periods.
      P += ((y * y - P) * H) / (15 * 2 * Math.PI);
      tSim += H;
      // Average loop gain over about one period (the instantaneous g(v)/v ripples within the cycle).
      if (Math.abs(v) > 1e-9) lazo += ((g(v) / v / 3 - lazo) * H) / (2 * Math.PI);
      if (++dec >= DEC) {
        dec = 0;
        regY[iReg % REG] = y;
        iReg++;
      }
      if (!Number.isFinite(v)) reiniciar();
    }
    if (muestreo.toca()) n++;
  }

  /** THD from the last 1024 samples (Hann window), harmonics found around multiples of the peak. */
  function thd(): { thd: number } {
    const N = 1024;
    if (iReg < N) return { thd: NaN };
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    const { w } = ventana('hann', N);
    for (let i = 0; i < N; i++) re[i] = regY[(iReg - N + i + REG) % REG]! * w[i]!;
    fft(re, im);
    const mag = (k: number) => Math.hypot(re[k]!, im[k]!);
    let k1 = 2;
    for (let k = 2; k < N / 2; k++) if (mag(k) > mag(k1)) k1 = k;
    const pot = (k: number) => {
      let s = 0;
      for (let j = Math.max(1, k - 2); j <= Math.min(N / 2 - 1, k + 2); j++) s += mag(j) ** 2;
      return s;
    };
    const p1 = pot(k1);
    let ph = 0;
    for (let h = 2; h * k1 < N / 2 - 3 && h <= 9; h++) ph += pot(h * k1);
    return { thd: Math.sqrt(ph / p1) };
  }

  let medida = $state<{ thd: number }>({ thd: NaN });
  let tMedida = 0;

  function dibujar(vw: Vista): void {
    void n;
    const { ctx } = vw;
    const p = pal;
    const est = vw.estrecho;
    const e: Ejes = est ? { x: 60, y: 40, w: 510, h: 250, x0: 0, x1: 24, y0: -15, y1: 15 } : { x: 60, y: 40, w: 560, h: 300, x0: 0, x1: 24, y0: -15, y1: 15 };
    estatico(vw, `os:${est}`, (vv) => {
      panel(vv, e, { titulo: 'Salida del amplificador: arranque desde el ruido', uy: 'V', fmtX: (x) => `${x} T`, marcasX: [0, 4, 8, 12, 16, 20, 24], marcasY: [-13, 0, 13], cero: true });
    });
    guia(ctx, e, 'y', VS, alfa(p.peligro, 0.5));
    guia(ctx, e, 'y', -VS, alfa(p.peligro, 0.5));
    // The record (right-aligned): the last 24 periods at most.
    const disp = Math.min(iReg, REG);
    const T = 2 * Math.PI; // period in τ
    const xs = new Float64Array(disp);
    const ys = new Float64Array(disp);
    for (let i = 0; i < disp; i++) {
      const edad = (disp - 1 - i) * H * DEC; // τ ago
      xs[i] = 24 - edad / T;
      ys[i] = regY[(iReg - disp + i + REG) % REG]!;
    }
    curva(ctx, e, xs, ys, p.acento, 1.8);
    // Envelope prediction of the linear start: e^((A−3)·t/2).
    const crec = (A - 3) / 2;
    txtRico(vw, crec > 0 ? `crece ×${num(Math.exp(crec * T), 3)} por ciclo` : crec < 0 ? `decae ×${num(Math.exp(crec * T), 3)} por ciclo` : 'ni crece ni decae', e.x + 8, e.y + 12, { tam: 12, peso: 700, color: crec > 0 ? p.bien : p.peligro, alin: 'left' });
    txt(vw, `t = ${num(tSim / T, 0)} periodos`, e.x + e.w - 6, e.y + 12, { tam: 12, color: p.suave, alin: 'right' });
    // Loop gain bar: |A·β| at f₀ = A_eff/3.
    const by = est ? 340 : 380;
    txt(vw, 'Ganancia de lazo |A·β| en f_0 (media de un ciclo)', 60, by, { tam: 12, peso: 700, color: p.suave, alin: 'left' });
    const W = est ? 400 : 480;
    const x0 = 60;
    ctx.fillStyle = alfa(p.tinta, 0.07);
    ctx.fillRect(x0, by + 12, W, 18);
    const k = (gg: number) => x0 + (W * (gg - 0.8)) / (1.6 - 0.8);
    ctx.fillStyle = lazo > 1.001 ? p.bien : lazo < 0.999 ? p.peligro : p.acento;
    ctx.fillRect(k(0.8), by + 12, Math.max(0, Math.min(W, k(lazo) - k(0.8))), 18);
    ctx.strokeStyle = p.tinta;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(k(1), by + 6);
    ctx.lineTo(k(1), by + 36);
    ctx.stroke();
    txt(vw, '1', k(1), by + 46, { tam: 11.5, peso: 700 });
    txt(vw, num(lazo, 3), Math.min(k(lazo), x0 + W) + 6, by + 21, { tam: 12, peso: 700, alin: 'left' });
  }

  $effect(() => {
    void n;
    const ahora = performance.now();
    if (ahora - tMedida > 600) {
      tMedida = ahora;
      medida = thd();
    }
  });

  const texto = $derived.by(() => {
    const exceso = A / 3 - 1;
    const est =
      A < 3
        ? `**Ganancia de lazo ${num(A / 3, 3)} < 1:** cualquier oscilación se extingue; el oscilador nunca arranca.`
        : `**Ganancia de lazo ${num(A / 3, 3)}** (un ${pct(exceso, 0)} de exceso; el libro recomienda del 5 al 20 % en el peor caso): la perturbación inicial crece exponencialmente.`;
    const mec =
      mecanismo === 'railes'
        ? 'Sin control de amplitud, crece hasta chocar con la alimentación y **recorta**: la senoide sale achatada y con varios por ciento de distorsión.'
        : mecanismo === 'diodos'
          ? 'Dos **diodos** en antiparalelo bajan la ganancia poco a poco conforme crece la amplitud: se estabiliza sin recortar, con distorsión del orden del 1 %.'
          : 'La **lámpara** de Hewlett se calienta con la amplitud, su resistencia sube y la ganancia baja; su inercia térmica hace la regulación suave y lenta: distorsión mínima, a costa de un arranque que «busca» la amplitud.';
    return (
      `**Barkhausen:** la red de Wien (10 kΩ y 10 nF) devuelve 1/3 de la salida con fase 0° a f_0 = 1/(2πRC) = 1592 Hz, así que el amplificador necesita ganancia exactamente 3. ${est}\n${mec}` +
      (Number.isFinite(medida.thd) && A >= 3 ? ` THD medida en los últimos ciclos: ${pct(medida.thd, medida.thd < 0.01 ? 3 : 2)}.` : '')
    );
  });

  const lecturas = $derived([
    { e: 'Ganancia del amplificador A', v: num(A, 2), c: pal.acento },
    { e: 'Ganancia de lazo en f_0', v: num(A / 3, 3) },
    { e: 'Frecuencia (10 kΩ, 10 nF)', v: si(1 / (2 * Math.PI * 1e4 * 1e-8), 'Hz', 4) },
    { e: 'THD', v: Number.isFinite(medida.thd) && A >= 3 ? pct(medida.thd, 3) : '—' },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet modos()}
    <Selector
      etiqueta="Control de amplitud"
      bind:valor={mecanismo}
      opciones={[
        { valor: 'railes', texto: 'Ninguno (recorta)' },
        { valor: 'diodos', texto: 'Diodos' },
        { valor: 'lampara', texto: 'Lámpara (Hewlett)' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 400] : [900, 430])} etiqueta="Arranque de un oscilador de puente de Wien desde el ruido" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Ganancia del amplificador A" bind:valor={A} min={2.7} max={4} paso={0.01} formato={(x) => num(x, 2)} />
    <button class="boton" onclick={() => reloj.reiniciar()}>Encender de nuevo</button>
  {/snippet}
</Marco>
