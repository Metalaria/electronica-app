<script lang="ts">
  // The capacitor in AC (book 3.3): i = C·dv/dt, so the current leads the voltage by 90° and the reactance
  // X_C = 1/(2π·f·C) falls with frequency. Shown in slow motion: one period lasts two seconds on screen.
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, flecha, circulo, Camino, electronesEnCamino, type Vista } from '../nucleo/dibujo';
  import { fuente, hilo, condensador } from '../nucleo/esquema';
  import { alfa, paleta } from '../nucleo/paleta';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  let f = $state(1000);
  let C = $state(1e-6);
  let Vp = $state(10);
  const Xc = $derived(1 / (2 * Math.PI * f * C));
  const Ip = $derived(Vp / Xc);

  const PERIODO = 2;
  let fase = 0;
  let desplaz = 0;
  function paso(dt: number): void {
    fase += (dt / PERIODO) * Math.PI * 2;
    // Electron displacement follows the charge (∝ −cos), so they oscillate back and forth.
    desplaz = -Math.cos(fase);
  }

  function dibujar(v: Vista): void {
    void [f, C, Vp];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const vin = Math.sin(fase);
    const ii = Math.cos(fase);
    // Circuit.
    const xs = est ? 70 : 80;
    const xc = est ? 230 : 250;
    const yT = est ? 60 : 70;
    const yB = est ? 250 : 300;
    const ym = (yT + yB) / 2;
    fuente(v, xs, ym, 26, 'ac', { rotulo: `${num(Vp, 1)} V`, lado: est ? 1 : -1 });
    hilo(v, [
      [xs, ym - 26],
      [xs, yT],
      [xc, yT],
      [xc, ym - 12],
    ]);
    hilo(v, [
      [xs, ym + 26],
      [xs, yB],
      [xc, yB],
      [xc, ym + 12],
    ]);
    condensador(v, xc, ym - 12, xc, ym + 12, { placa: 66, sep: 22 });
    // Plate charges follow v.
    const n = Math.round(Math.abs(vin) * 10);
    const arriba = vin >= 0;
    for (let k = 0; k < n; k++) {
      const x = xc - 28 + (56 * (k + 0.5)) / Math.max(n, 1);
      txt(v, '+', x, arriba ? ym - 22 : ym + 22, { tam: 11, peso: 800, color: p.positivo });
      circulo(ctx, x, arriba ? ym + 22 : ym - 22, 2.6, p.electron);
    }
    const lazo = new Camino([
      [xs, ym - 26],
      [xs, yT],
      [xc, yT],
      [xc, ym - 12],
      [xc, ym + 12],
      [xc, yB],
      [xs, yB],
      [xs, ym + 26],
    ]);
    // Electrons oscillate: their position follows the charge (integral of the current).
    electronesEnCamino(ctx, lazo, 30 + desplaz * 22, 22, 3.3, p, 0.9);
    if (Math.abs(ii) > 0.1) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.abs(ii) * 1.4);
      const dir = ii > 0 ? 1 : -1;
      const pa = lazo.en(lazo.largo * 0.18);
      flecha(ctx, pa.x - dir * 22 * Math.cos(pa.a), pa.y - dir * 22 * Math.sin(pa.a), pa.x + dir * 22 * Math.cos(pa.a), pa.y + dir * 22 * Math.sin(pa.a), p.corriente, 3, 12);
      ctx.restore();
    }
    txtRico(v, `X_C = ${si(Xc, 'Ω', 3)}`, xc + 44, ym, { alin: 'left', tam: 14, peso: 800, color: p.acento });

    // Phasor diagram.
    const pcx = est ? v.w - 110 : 440;
    const pcy = est ? 150 : ym;
    const pr = est ? 80 : 92;
    circulo(ctx, pcx, pcy, pr, undefined, alfa(p.suave, 0.35), 1);
    ctx.strokeStyle = alfa(p.suave, 0.3);
    ctx.beginPath();
    ctx.moveTo(pcx - pr - 8, pcy);
    ctx.lineTo(pcx + pr + 8, pcy);
    ctx.moveTo(pcx, pcy - pr - 8);
    ctx.lineTo(pcx, pcy + pr + 8);
    ctx.stroke();
    const av = fase - Math.PI / 2;
    const ai = fase;
    flecha(ctx, pcx, pcy, pcx + Math.cos(av) * pr * 0.95, pcy - Math.sin(av) * pr * 0.95, p.serie[0], 3, 12);
    flecha(ctx, pcx, pcy, pcx + Math.cos(ai) * pr * 0.72, pcy - Math.sin(ai) * pr * 0.72, p.corriente, 3, 12);
    txt(v, 'V', pcx + Math.cos(av) * (pr + 14), pcy - Math.sin(av) * (pr + 14), { tam: 15, peso: 800, color: p.serie[0] });
    txt(v, 'I', pcx + Math.cos(ai) * (pr * 0.72 + 14), pcy - Math.sin(ai) * (pr * 0.72 + 14), { tam: 15, peso: 800, color: p.corriente });
    // 90° arc.
    ctx.strokeStyle = p.suave;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(pcx, pcy, 26, -ai, -av, false);
    ctx.stroke();
    txt(v, '90°', pcx + Math.cos((ai + av) / 2) * 40, pcy - Math.sin((ai + av) / 2) * 40, { tam: 12, color: p.suave });
    txt(v, 'fasores', pcx, pcy + pr + 24, { tam: 12, color: p.suave });

    // Scope traces.
    const sx0 = est ? 30 : 560;
    const sx1 = est ? v.w - 30 : v.w - 24;
    const sy0 = est ? 300 : 70;
    const sy1 = est ? v.h - 40 : 350;
    rr(ctx, sx0, sy0, sx1 - sx0, sy1 - sy0, 10);
    ctx.fillStyle = p.panel;
    ctx.fill();
    ctx.strokeStyle = p.linea;
    ctx.stroke();
    const syc = (sy0 + sy1) / 2;
    const amp = (sy1 - sy0) * 0.38;
    ctx.strokeStyle = alfa(p.suave, 0.4);
    ctx.beginPath();
    ctx.moveTo(sx0 + 8, syc);
    ctx.lineTo(sx1 - 8, syc);
    ctx.stroke();
    const traza = (fn: (a: number) => number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let k = 0; k <= 120; k++) {
        const u = k / 120;
        const a = fase - (1 - u) * Math.PI * 4;
        const x = sx0 + 10 + u * (sx1 - sx0 - 20);
        const y = syc - fn(a) * amp;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      circulo(ctx, sx1 - 10, syc - fn(fase) * amp, 4.5, color);
    };
    traza(Math.sin, p.serie[0]);
    traza(Math.cos, p.corriente);
    txt(v, 'v(t)', sx0 + 14, sy0 + 14, { tam: 12, peso: 800, color: p.serie[0], alin: 'left' });
    txt(v, 'i(t)', sx0 + 50, sy0 + 14, { tam: 12, peso: 700, color: p.corriente, alin: 'left' });
    txtRico(v, `f = ${si(f, 'Hz', 3)} (en cámara lenta)`, (sx0 + sx1) / 2, sy1 - 14, { tam: 12, color: p.suave });
  }

  const curva = $derived.by(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let k = 0; k <= 120; k++) {
      const ff = 10 * Math.pow(10, (6 * k) / 120);
      xs.push(ff);
      ys.push(1 / (2 * Math.PI * ff * C));
    }
    return { xs, ys };
  });

  const texto = $derived(
    `La corriente de un condensador es i = C·dv/dt: es **máxima cuando la tensión cruza por cero** (cambia más deprisa) y nula en los picos (deja de cambiar). Por eso la corriente **adelanta 90°** a la tensión.\n` +
      `A ${si(f, 'Hz', 3)}, X_C = 1/(2π·f·C) = ${si(Xc, 'Ω', 3)} y el pico de corriente es ${si(Ip, 'A', 3)}. ` +
      (Xc > 1e5
        ? 'A baja frecuencia la reactancia es enorme: el condensador bloquea lo lento.'
        : Xc < 10
          ? 'A alta frecuencia la reactancia es casi nula: el condensador deja pasar lo rápido.'
          : 'Doblar la frecuencia o la capacidad divide la reactancia por dos.') +
      ' No disipa potencia: la energía entra y sale en cada ciclo.',
  );

  const lecturas = $derived([
    { e: 'Reactancia X_C', v: si(Xc, 'Ω', 3), c: pal.acento },
    { e: 'Corriente de pico', v: si(Ip, 'A', 3), c: pal.corriente },
    { e: 'Desfase de I sobre V', v: '+90°' },
    { e: 'Potencia media', v: '0 W' },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron', 'corriente']}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 540] : [960, 380])} etiqueta="Condensador en alterna con fasores y formas de onda" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Frecuencia f" bind:valor={f} min={10} max={1e6} log unidad="Hz" />
    <Deslizador etiqueta="Capacidad C" bind:valor={C} min={1e-9} max={1e-3} log unidad="F" />
    <Deslizador etiqueta="Tensión de pico V_p" bind:valor={Vp} min={1} max={20} paso={0.5} unidad="V" />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Reactancia frente a la frecuencia"
      x={{ etiqueta: 'f', unidad: 'Hz', min: 10, max: 1e6, log: true }}
      y={{ etiqueta: 'X_C', unidad: 'Ω', min: 1e-3, max: 1e7, log: true }}
      series={[{ x: curva.xs, y: curva.ys, color: pal.acento }]}
      puntos={[{ x: f, y: Xc, color: pal.corriente, etiqueta: si(Xc, 'Ω', 3) }]}
    />
  {/snippet}
</Marco>
