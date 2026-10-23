<script lang="ts">
  // The FFT as an instrument (book 20.13, 20.12, 29.6, 21.6): N samples captured during T give lines every
  // 1/T up to f_s/2. If the capture does not hold a whole number of cycles, the FFT (which assumes the block
  // repeats) sees a jump at the seam and the energy leaks over the whole spectrum, hiding the harmonics. A
  // window removes the jump at the price of a wider line; flat-top reads amplitudes right even between bins.
  // Signal: 1 kHz with the book's THD example (2nd harmonic at −60 dB, 3rd at −66 dB → THD 0,11 %).
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import Interruptor from '../../ui/Interruptor.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, X, Y, type Ejes } from '../nucleo/grafica';
  import { fft, ventana, generadorRuido, dB, type Ventana } from '../nucleo/senal';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  const N = 512;
  const FS = 51200;
  const T = N / FS; // 10 ms
  let tipo = $state<Ventana>('rectangular');
  let delta = $state(0); // Hz above 1 kHz
  let deslizar = $state(true);
  let armonicos = $state(true);

  const ruido = (() => {
    const g = generadorRuido(7);
    const r = new Float64Array(N);
    for (let i = 0; i < N; i++) r[i] = g() * 1e-5;
    return r;
  })();

  function senal(t: number, f: number): number {
    let x = Math.sin(2 * Math.PI * f * t);
    if (armonicos) x += 1e-3 * Math.sin(2 * Math.PI * 2 * f * t) + 10 ** (-66 / 20) * Math.sin(2 * Math.PI * 3 * f * t);
    return x;
  }

  const res = $derived.by(() => {
    const f = 1000 + delta;
    const { w, ganancia } = ventana(tipo, N);
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    const x = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      x[i] = senal(i / FS, f) + ruido[i]!;
      re[i] = x[i]! * w[i]!;
    }
    fft(re, im);
    const M = N / 2;
    const fr = new Float64Array(M);
    const db = new Float64Array(M);
    for (let k = 0; k < M; k++) {
      fr[k] = (k * FS) / N;
      db[k] = dB((Math.hypot(re[k]!, im[k]!) * 2) / (N * ganancia));
    }
    const pico = (fc: number) => {
      const k0 = Math.round((fc * N) / FS);
      let m = -300;
      for (let k = Math.max(1, k0 - 1); k <= Math.min(M - 1, k0 + 1); k++) m = Math.max(m, db[k]!);
      return m;
    };
    const a1 = pico(f);
    const a2 = pico(2 * f) - a1;
    const a3 = pico(3 * f) - a1;
    const thd = Math.sqrt(10 ** (a2 / 10) + 10 ** (a3 / 10));
    return { x, w, fr, db, a1, a2, a3, thd, f };
  });

  let fase = 0;
  let n = $state(0);
  const muestreo = new Muestreo(70);
  function paso(dt: number): void {
    if (deslizar) {
      fase += dt / 16;
      const d = 50 - 50 * Math.cos(2 * Math.PI * fase);
      delta = Math.round(d * 2) / 2;
    }
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const r = res;
    const eT: Ejes = est ? { x: 60, y: 40, w: 510, h: 150, x0: 0, x1: 1.4 * T, y0: -1.25, y1: 1.25 } : { x: 60, y: 40, w: 380, h: 280, x0: 0, x1: 1.4 * T, y0: -1.25, y1: 1.25 };
    const eF: Ejes = est ? { x: 60, y: 250, w: 510, h: 260, x0: 0, x1: 5000, y0: -130, y1: 5 } : { x: 500, y: 40, w: 370, h: 280, x0: 0, x1: 5000, y0: -130, y1: 5 };
    estatico(v, `ff:${est}`, (vv) => {
      panel(vv, eT, { titulo: 'Captura de 10 ms y su repetición (lo que supone la FFT)', ux: 's', cero: true, marcasY: [-1, 0, 1] });
      panel(vv, eF, { titulo: 'Espectro (dB respecto a la fundamental real)', ux: 'Hz', fmtY: (y) => `${num(y, 0)}`, etY: 'dB', marcasY: [0, -20, -40, -60, -80, -100, -120] });
      const c = vv.ctx;
      c.fillStyle = alfa(p.tinta, 0.05);
      c.fillRect(X(eT, T), eT.y, X(eT, 1.4 * T) - X(eT, T), eT.h);
    });
    // Time block, windowed, and its periodic continuation.
    const xs = new Float64Array(N);
    const ys = new Float64Array(N);
    const yw = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      xs[i] = i / FS;
      ys[i] = r.x[i]!;
      yw[i] = r.x[i]! * r.w[i]!;
    }
    curva(ctx, eT, xs, ys, alfa(p.acento, tipo === 'rectangular' ? 1 : 0.35), 1.6);
    if (tipo !== 'rectangular') {
      curva(ctx, eT, xs, yw, p.acento, 2);
      curva(ctx, eT, xs, r.w, alfa(p.serie[2], 0.8), 1.4, [5, 4]);
    }
    const n2 = Math.floor(0.4 * N);
    const xr = new Float64Array(n2);
    const yr = new Float64Array(n2);
    for (let i = 0; i < n2; i++) {
      xr[i] = T + i / FS;
      yr[i] = tipo === 'rectangular' ? r.x[i]! : r.x[i]! * r.w[i]!;
    }
    curva(ctx, eT, xr, yr, alfa(p.acento, 0.4), 1.6, [3, 3]);
    // The seam.
    const salto = Math.abs((tipo === 'rectangular' ? r.x[N - 1]! : 0) - (tipo === 'rectangular' ? r.x[0]! : 0));
    guia(ctx, eT, 'x', T, salto > 0.05 ? p.peligro : alfa(p.bien, 0.8), 1.8, [4, 3]);
    txt(v, salto > 0.05 ? 'salto en el empalme' : 'empalme limpio', X(eT, T) - 4, eT.y + eT.h - 10, { tam: 11.5, peso: 700, color: salto > 0.05 ? p.peligro : p.bien, alin: 'right' });

    // Spectrum as a line through the bins plus small stems.
    curva(ctx, eF, r.fr, r.db, p.acento, 1.8);
    for (const [m, et] of [
      [2, '2.º −60 dB'],
      [3, '3.º −66 dB'],
    ] as const) {
      if (!armonicos) break;
      const fx = m * r.f;
      ctx.fillStyle = p.peligro;
      const px = X(eF, fx);
      const py = Y(eF, m === 2 ? -60 : -66);
      ctx.beginPath();
      ctx.moveTo(px, py - 8);
      ctx.lineTo(px - 5, py - 16);
      ctx.lineTo(px + 5, py - 16);
      ctx.closePath();
      ctx.fill();
      txt(v, et, px + 7, py - 14, { tam: 11, color: p.peligro, alin: 'left', peso: 700 });
    }
    txt(v, `rayas cada 1/T = ${si(FS / N, 'Hz', 3)}`, eF.x + eF.w - 4, eF.y + eF.h - 10, { tam: 11.5, color: p.suave, alin: 'right' });
  }

  const ciclos = $derived(res.f * T);

  const texto = $derived.by(() => {
    const r = res;
    const entero = Math.abs(ciclos - Math.round(ciclos)) < 1e-6;
    const leak = !entero && tipo === 'rectangular';
    return (
      `**N = ${N} muestras en T = 10 ms** a ${si(FS, 'S/s', 3)}: rayas cada 1/T = 100 Hz hasta f_s/2 = ${si(FS / 2, 'Hz', 3)}. La resolución la fija el tiempo capturado, no la frecuencia de muestreo. La senoide de ${si(r.f, 'Hz', 4)} cabe ${num(ciclos, 2)} veces en la captura.\n` +
      (entero
        ? 'Con un número entero de ciclos el empalme es limpio y cada componente cae en una raya: hasta sin ventana se leen los armónicos.'
        : leak
          ? '**Fuga espectral:** la FFT supone que el bloque se repite, y en el empalme hay un salto; su energía se reparte por todo el espectro y las faldas tapan los armónicos a −60 y −66 dB.'
          : `La ventana ${tipo === 'hann' ? 'de Hann' : 'flat-top'} lleva la señal a cero en los extremos: sin salto no hay fuga, a cambio de una raya más ancha.`) +
      `\nLectura: fundamental a ${num(r.a1, 2)} dB (real: 0 dB)${tipo === 'flattop' ? ', la flat-top acierta aunque la raya caiga entre dos bins' : tipo === 'hann' ? ', la Hann puede leer hasta 1,4 dB bajo' : ''}; THD medida ${num(r.thd * 100, 3)} % (real: 0,112 %).`
    );
  });

  const lecturas = $derived([
    { e: 'Frecuencia de la señal', v: si(res.f, 'Hz', 4), c: pal.acento },
    { e: 'Ciclos en la captura', v: num(ciclos, 2) },
    { e: 'Fundamental leída', v: `${num(res.a1, 2)} dB` },
    { e: '2.º armónico leído', v: `${num(res.a2, 1)} dB`, c: pal.peligro },
    { e: 'THD leída', v: `${num(res.thd * 100, 3)} %` },
    { e: 'Resolución 1/T', v: si(FS / N, 'Hz', 3) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet modos()}
    <Selector
      etiqueta="Ventana"
      bind:valor={tipo}
      opciones={[
        { valor: 'rectangular', texto: 'Rectangular (ninguna)' },
        { valor: 'hann', texto: 'Hann' },
        { valor: 'flattop', texto: 'Flat-top' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 550] : [900, 360])} etiqueta="Captura de una senoide, su repetición periódica y el espectro calculado con la FFT" />
  {/snippet}
  {#snippet controles()}
    <Interruptor etiqueta="Deslizar la frecuencia entre dos rayas" bind:valor={deslizar} />
    <Deslizador etiqueta="Desplazamiento sobre 1 kHz" bind:valor={delta} min={0} max={100} paso={0.5} unidad="Hz" desactivado={deslizar} />
    <Interruptor etiqueta="Armónicos del ejemplo (−60 y −66 dB)" bind:valor={armonicos} />
  {/snippet}
</Marco>
