<script lang="ts">
  // Quantisation, ADC and DAC (book 33.1, 33.2, 33.9, 29.4): each sample takes the nearest of 2ⁿ codes; the
  // error is at most ½ LSB, with an rms value of LSB/√12, and an ideal n-bit converter with a full-scale sine
  // gives SNR = 6,02·n + 1,76 dB. With a small signal the error follows the signal and shows as harmonics;
  // about 1 LSB of dither turns them into a flat noise floor (figure 33.2). The DAC holds each code (zero-order
  // hold) and a reconstruction filter smooths the staircase.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Interruptor from '../../ui/Interruptor.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, rr, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num, pct } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, punto, Y, type Ejes } from '../nucleo/grafica';
  import { fft, ventana, generadorRuido, dB } from '../nucleo/senal';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let bits = $state(3);
  let amp = $state(0.95); // fraction of full scale (±1)
  let dither = $state(false);
  const VREF = 3.3; // the full scale of the book's microcontroller ADCs (0 … 3,3 V)

  const niveles = $derived(2 ** bits);
  const lsb = $derived(2 / niveles);

  // Deterministic dither of about 1 LSB peak to peak.
  const tabla = (() => {
    const g = generadorRuido(3);
    const r = new Float64Array(4096);
    for (let i = 0; i < r.length; i++) r[i] = g() * 0.5;
    return r;
  })();

  function cuantizar(x: number, i: number): number {
    const d = dither ? tabla[i & 4095]! * lsb : 0;
    let c = Math.floor((x + d + 1) / lsb);
    c = Math.max(0, Math.min(niveles - 1, c));
    return -1 + (c + 0.5) * lsb;
  }

  // Coherent capture for the spectrum: 1024 samples holding 31 cycles.
  const NF = 1024;
  const CICLOS = 31;
  const espectro = $derived.by(() => {
    void dither;
    const re = new Float64Array(NF);
    const im = new Float64Array(NF);
    const { w, ganancia } = ventana('rectangular', NF);
    let ps = 0;
    let pe = 0;
    for (let i = 0; i < NF; i++) {
      const x = amp * Math.sin((2 * Math.PI * CICLOS * i) / NF);
      const q = cuantizar(x, i * 7);
      re[i] = q * w[i]!;
      ps += x * x;
      pe += (q - x) * (q - x);
    }
    fft(re, im);
    const M = NF / 2;
    const fr = new Float64Array(M);
    const db = new Float64Array(M);
    let pTot = 0;
    let pSen = 0;
    for (let k = 1; k < M; k++) {
      const a = (Math.hypot(re[k]!, im[k]!) * 2) / (NF * ganancia);
      fr[k] = k / CICLOS;
      db[k] = dB(a);
      pTot += (a * a) / 2;
      if (k === CICLOS) pSen = (a * a) / 2;
    }
    fr[0] = 0;
    db[0] = -200;
    return { fr, db, snr: 10 * Math.log10(pSen / Math.max(pTot - pSen, 1e-30)), qef: Math.sqrt(pe / NF), ps: ps / NF };
  });

  // Animation: the sampler walks along the waveform, 32 samples per period, one sample every 0,22 s.
  const SPP = 32;
  let k = 0;
  let acum = 0;
  let n = $state(0);
  const muestreo = new Muestreo(60);
  function paso(dt: number): void {
    acum += dt;
    while (acum > 0.22) {
      acum -= 0.22;
      k++;
    }
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const eT: Ejes = est ? { x: 60, y: 40, w: 420, h: 200, x0: 0, x1: 2, y0: -1.1, y1: 1.1 } : { x: 60, y: 40, w: 450, h: 210, x0: 0, x1: 2, y0: -1.1, y1: 1.1 };
    const eE: Ejes = est ? { x: 60, y: 290, w: 420, h: 80, x0: 0, x1: 2, y0: -1, y1: 1 } : { x: 60, y: 300, w: 450, h: 80, x0: 0, x1: 2, y0: -1, y1: 1 };
    const eF: Ejes = est ? { x: 60, y: 430, w: 510, h: 150, x0: 0, x1: 16, y0: -130, y1: 5 } : { x: 570, y: 150, w: 300, h: 230, x0: 0, x1: 16, y0: -130, y1: 5 };
    estatico(v, `qz:${est}:${bits}`, (vv) => {
      panel(vv, eT, { titulo: 'Entrada, muestras cuantificadas y salida del DAC', sinX: true, uy: 'V', fmtY: (y) => si(((y + 1) / 2) * VREF, 'V', 2), marcasY: [-1, 0, 1] });
      panel(vv, eE, { titulo: 'Error de cuantificación (en LSB)', sinX: true, fmtY: (y) => `${num(y, 1).replace(',0', '')}`, marcasY: [-0.5, 0, 0.5], cero: true });
      panel(vv, eF, { titulo: 'Espectro (dB, escala completa = 0)', fmtX: (x) => (x === 0 ? '0' : `${num(x, 0)}f`), marcasX: [1, 3, 5, 7, 9, 11, 13, 15], marcasY: [0, -40, -80, -120] });
      // Code thresholds (only when they are few enough to see).
      if (2 ** bits <= 64) {
        const c = vv.ctx;
        c.strokeStyle = alfa(p.serie[4], 0.18);
        c.lineWidth = 1;
        c.beginPath();
        for (let j = 1; j < 2 ** bits; j++) {
          const y = Y(eT, -1 + j * (2 / 2 ** bits));
          c.moveTo(eT.x, y);
          c.lineTo(eT.x + eT.w, y);
        }
        c.stroke();
      }
    });
    // Two periods ending at the present sample (scrolls like a chart recorder).
    const ini = k - 2 * SPP;
    const M = 2 * SPP;
    const xs: number[] = [];
    const ys: number[] = [];
    const ws: number[] = [];
    for (let i = 0; i <= 400; i++) {
      const u = (2 * i) / 400;
      xs.push(u);
      ys.push(amp * Math.sin(2 * Math.PI * ((ini + u * SPP) / SPP)));
    }
    curva(ctx, eT, xs, ys, alfa(p.acento, 0.6), 1.6);
    // Staircase (zero-order hold) and the error.
    const sx: number[] = [];
    const sy: number[] = [];
    const ex: number[] = [];
    const ey: number[] = [];
    for (let j = 0; j <= M; j++) {
      const idx = ini + j;
      const x = amp * Math.sin((2 * Math.PI * idx) / SPP);
      const q = cuantizar(x, idx * 13);
      const u = j / SPP;
      sx.push(u, u + 1 / SPP);
      sy.push(q, q);
      ex.push(u);
      ey.push((q - x) / lsb);
      ws.push(q);
    }
    curva(ctx, eT, sx, sy, p.corriente, 2.2);
    curva(ctx, eE, ex, ey, p.serie[4], 1.8);
    for (let j = 0; j <= M; j++) punto(ctx, eT, j / SPP, ws[j]!, p.corriente, 2.8);
    const xNow = amp * Math.sin((2 * Math.PI * k) / SPP);
    const qNow = cuantizar(xNow, k * 13);
    guia(ctx, eT, 'x', 2, alfa(p.tinta, 0.4));
    punto(ctx, eT, 2, qNow, p.corriente, 6, p.fondo);
    // Code readout.
    const code = Math.max(0, Math.min(niveles - 1, Math.round((qNow + 1) / lsb - 0.5)));
    const bin = code.toString(2).padStart(bits, '0');
    const bx = est ? 492 : 570;
    const by = est ? 70 : 50;
    rr(ctx, bx, by, est ? 96 : 300, 70, 10);
    ctx.fillStyle = p.panel;
    ctx.fill();
    ctx.strokeStyle = p.linea;
    ctx.lineWidth = 1;
    ctx.stroke();
    txt(v, 'código', bx + 10, by + 14, { tam: 11.5, color: p.suave, alin: 'left' });
    txt(v, bits <= 8 || !est ? bin : `${code}`, bx + 10, by + 36, { tam: est ? 14 : 18, peso: 800, color: p.corriente, alin: 'left' });
    txt(v, si(((qNow + 1) / 2) * VREF, 'V', 4), bx + 10, by + 56, { tam: 12, color: p.suave, alin: 'left' });
    // Spectrum.
    curva(ctx, eF, espectro.fr, espectro.db, p.acento, 1.4);
    guia(ctx, eF, 'y', -(6.02 * bits + 1.76), alfa(p.peligro, 0.6));
  }

  const snrTeo = $derived(6.02 * bits + 1.76);
  const texto = $derived.by(() => {
    const e = espectro;
    const pocos = amp / lsb < 4;
    return (
      `**${bits} bits = ${niveles} códigos** sobre ${si(VREF, 'V', 2)}: 1 LSB = ${si((VREF / niveles), 'V', 3)}. Cada muestra toma el código más próximo y el error queda entre −½ y +½ LSB; su valor eficaz es LSB/√12 = 0,29 LSB (medido: ${num(e.qef / lsb, 3)} LSB).\n` +
      `SNR ideal a fondo de escala: 6,02·n + 1,76 = ${num(snrTeo, 1)} dB; con esta amplitud (${pct(amp, 0)} de la escala) se mide ${num(e.snr, 1)} dB: cada mitad de margen desaprovechado cuesta 6 dB, un bit.` +
      (pocos && !dither
        ? '\n**Señal pequeña sin dither:** recorre pocos códigos, el error se repite con la señal y sale en el espectro como **armónicos**, no como ruido.'
        : dither
          ? '\n**Con dither** (≈ 1 LSB de ruido añadido antes de convertir) el error deja de seguir a la señal: los armónicos se disuelven en un fondo plano, más benigno y promediable.'
          : '')
    );
  });

  const lecturas = $derived([
    { e: 'LSB', v: si(VREF / niveles, 'V', 3), c: pal.corriente },
    { e: 'SNR teórica', v: `${num(snrTeo, 1)} dB` },
    { e: 'SNR medida', v: `${num(espectro.snr, 1)} dB`, c: pal.acento },
    { e: 'Error eficaz', v: `${num(espectro.qef / lsb, 3)} LSB` },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 600] : [900, 410])} etiqueta="Conversión analógico-digital: muestras cuantificadas, error y espectro" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Resolución" bind:valor={bits} min={1} max={12} paso={1} formato={(x) => `${x} bits`} />
    <Deslizador etiqueta="Amplitud de la entrada" bind:valor={amp} min={0.02} max={1} paso={0.01} formato={(x) => pct(x, 0)} />
    <Interruptor etiqueta="Dither (≈ 1 LSB de ruido)" bind:valor={dither} />
    <button class="boton" onclick={() => ((bits = 8), (amp = 0.02), (dither = false))}>Señal pequeña: 8 bits, 2 % (figura 33.2)</button>
  {/snippet}
</Marco>
