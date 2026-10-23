<script lang="ts">
  // Negative feedback and the gain–bandwidth trade-off (book 26.2, 26.5, 8.6): A_f = A/(1 + A·β) ≈ 1/β when the
  // loop gain A·β ≫ 1. Every defect of the amplifier is divided by the desensitisation factor F = 1 + A·β; with
  // A = 10⁵ and β = 1/11, F = 9092 and a 50 % change of A moves the gain only 0,0055 %. With one dominant pole
  // the gain–bandwidth product is constant: GBW = 1 MHz and gain 11 give 91 kHz. The loop is drawn as a block
  // diagram with the signals moving round it; the error at the input is microvolts.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, flecha, rr, circulo, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num, pct } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, punto, type Ejes } from '../nucleo/grafica';
  import { Grafica, type Series } from '../../../grafica';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let G = $state(11); // 1/β
  let A0n = $state(1e5);
  let cambio = $state(0); // relative change of A (−0,5 … +0,5)
  const GBW = 1e6;

  const A0 = $derived(A0n * (1 + cambio));
  const beta = $derived(1 / G);
  const F = $derived(1 + A0 * beta);
  const Af = $derived(A0 / F);
  const AfNom = $derived(A0n / (1 + A0n * beta));
  const fp = $derived(GBW / A0n); // dominant pole
  const BWcl = $derived(fp * (1 + A0 * beta));

  let th = 0;
  let n = $state(0);
  const muestreo = new Muestreo(60);
  function paso(dt: number): void {
    th = (th + (2 * Math.PI * dt) / 4) % (2 * Math.PI);
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const vin = 0.1 * Math.sin(th); // 100 mV peak at the input
    const vout = Af * vin;
    const err = vin - beta * vout;
    // Block diagram.
    const y0 = 110;
    const xIn = 30;
    const xS = est ? 120 : 140;
    const xA0 = est ? 200 : 240;
    const xA1 = est ? 330 : 380;
    const xO = est ? 560 : 560;
    const yB = 220;
    const e: Ejes = est ? { x: 60, y: 300, w: 510, h: 150, x0: 0, x1: 2, y0: -1.2, y1: 1.2 } : { x: 60, y: 300, w: 480, h: 110, x0: 0, x1: 2, y0: -1.2, y1: 1.2 };
    const eS: Ejes = est ? { x: 60, y: 510, w: 510, h: 90, x0: 0, x1: 5, y0: 0, y1: 1.15 } : { x: 610, y: 300, w: 260, h: 110, x0: 0, x1: 5, y0: 0, y1: 1.15 };
    estatico(v, `rf:${est}`, (vv) => {
      panel(vv, e, { titulo: 'v_in, v_out/G y el error ε ampliado', sinX: true, sinY: true, cero: true, marcasY: [] });
      panel(vv, eS, { titulo: 'Escalón: tiempo en τ = 1/(2π·BW)', marcasX: [0, 1, 2, 3, 4, 5], fmtX: (x) => `${x}τ`, marcasY: [0, 1], sinY: true });
      const c = vv.ctx;
      c.strokeStyle = p.tinta;
      c.lineWidth = 2;
      // Amplifier triangle.
      c.beginPath();
      c.moveTo(xA0, y0 - 50);
      c.lineTo(xA1, y0);
      c.lineTo(xA0, y0 + 50);
      c.closePath();
      c.fillStyle = p.panel;
      c.fill();
      c.stroke();
      // β block.
      rr(c, (xA0 + xA1) / 2 - 50, yB - 26, 100, 52, 8);
      c.fill();
      c.stroke();
      flecha(c, xIn, y0, xS - 18, y0, p.tinta, 2, 9);
      flecha(c, xS + 18, y0, xA0, y0, p.tinta, 2, 9);
      flecha(c, xA1, y0, xO, y0, p.tinta, 2, 9);
      c.beginPath();
      c.moveTo(xO - 60, y0);
      c.lineTo(xO - 60, yB);
      c.lineTo((xA0 + xA1) / 2 + 50, yB);
      c.stroke();
      flecha(c, (xA0 + xA1) / 2 - 50, yB, xS, yB, p.tinta, 2, 0.1);
      flecha(c, xS, yB, xS, y0 + 18, p.tinta, 2, 9);
      circulo(c, xS, y0, 18, p.panel, p.tinta, 2);
      txt(vv, '+', xS - 28, y0 - 12, { tam: 14, peso: 800 });
      txt(vv, '−', xS - 10, y0 + 32, { tam: 16, peso: 800 });
      txt(vv, 'Σ', xS, y0, { tam: 15, peso: 800 });
    });
    txtRico(v, `A = ${si(A0, '', 3)}`, (xA0 * 2 + xA1) / 3 + 4, y0, { tam: 13, peso: 800 });
    txtRico(v, `β = 1/${num(G, 1)}`, (xA0 + xA1) / 2, yB, { tam: 13, peso: 800 });
    // Live values on the wires.
    const lab = (s: string, x: number, y: number, c: string) => txtRico(v, s, x, y, { tam: 12, peso: 700, color: c, fondo: alfa(c, p.oscuro ? 0.18 : 0.1) });
    lab(`v_in ${si(vin, 'V', 3)}`, (xIn + xS) / 2, y0 - 30, p.serie[0]);
    lab(`ε ${si(err, 'V', 3)}`, (xS + xA0) / 2, y0 + 34, p.peligro);
    lab(`v_out ${si(vout, 'V', 3)}`, (xA1 + xO) / 2 + 10, y0 - 30, p.acento);
    lab(`β·v_out ${si(beta * vout, 'V', 3)}`, (xS + xA0) / 2 + 20, yB + 40, p.serie[2]);

    // Time traces: v_in, v_out/G and the error magnified by F.
    // The error is v_in/F: magnified by the power of ten nearest to F so that it can be seen.
    const K = 10 ** Math.round(Math.log10(F));
    const N = 200;
    const xs = new Float64Array(N + 1);
    const a = new Float64Array(N + 1);
    const b = new Float64Array(N + 1);
    const c = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const u = (2 * i) / N;
      const s = Math.sin(th - 2 * Math.PI * u);
      xs[i] = u;
      a[i] = s;
      b[i] = (s * Af) / G;
      c[i] = s * (1 - beta * Af) * K;
    }
    curva(ctx, e, xs, a, p.serie[0], 2.4);
    curva(ctx, e, xs, b, p.acento, 2, [6, 4]);
    curva(ctx, e, xs, c, alfa(p.peligro, 0.8), 1.6);
    txtRico(v, `ε × 10^${Math.round(Math.log10(F))}`, e.x + e.w - 6, e.y + 10, { tam: 11.5, peso: 700, color: p.peligro, alin: 'right' });
    // Step response (single pole of the closed loop).
    const ts = new Float64Array(101);
    const ys = new Float64Array(101);
    for (let i = 0; i <= 100; i++) {
      ts[i] = (5 * i) / 100;
      ys[i] = 1 - Math.exp(-ts[i]!);
    }
    curva(ctx, eS, ts, ys, p.acento, 2.2);
    const tt = (th / (2 * Math.PI)) * 5;
    guia(ctx, eS, 'x', tt, alfa(p.tinta, 0.35));
    punto(ctx, eS, tt, 1 - Math.exp(-tt), p.acento, 4.5, p.fondo);
  }

  const bode = $derived.by((): Series[] => {
    const N = 300;
    const f = new Float64Array(N);
    const ol = new Float64Array(N);
    const cl = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const fr = 10 ** (0 + (7.3 * i) / (N - 1));
      f[i] = fr;
      const re = 1;
      const im = fr / fp;
      const m = A0 / Math.hypot(re, im);
      ol[i] = 20 * Math.log10(m);
      // A_f(jω) = A(jω)/(1 + β·A(jω)) with A = A0/(1 + jf/fp).
      const dr = 1 + beta * A0;
      const di = fr / fp;
      cl[i] = 20 * Math.log10(A0 / Math.hypot(dr, di));
    }
    return [
      { name: 'Lazo abierto A', unit: 'dB', x: f, y: ol, color: pal.tenue },
      { name: 'Lazo cerrado A_f', unit: 'dB', x: f, y: cl, color: pal.acento },
    ];
  });

  const texto = $derived(
    `**A_f = A/(1 + A·β)**: con A·β = ${si(A0 * beta, '', 3)} ≫ 1 la ganancia es casi 1/β = ${num(G, 2)} (exacta: ${num(Af, 4)}) y ya no depende del amplificador sino de las resistencias. La realimentación «gasta» ganancia: el factor de desensibilización F = 1 + A·β = ${si(F, '', 4)} divide todos los defectos.\n` +
      `${cambio !== 0 ? `A ha cambiado un ${pct(cambio, 0)} y la ganancia realimentada solo un ${pct((Af - AfNom) / AfNom, 4)}. ` : 'Mueve «Variación de A» y verás que la ganancia apenas cambia. '}En la entrada, el error ε es v_out/A: ${si(Math.abs((0.1 * Af) / A0), 'V', 2)} de pico, por eso las entradas «parecen» iguales.\n` +
      `**Ganancia por ancho de banda constante:** con GBW = 1 MHz y ganancia ${num(G, 1)}, el ancho de banda en lazo cerrado es ${si(BWcl, 'Hz', 3)}; el de lazo abierto, solo ${si(fp, 'Hz', 2)}.`,
  );

  const lecturas = $derived([
    { e: 'Ganancia A_f', v: num(Af, 4), c: pal.acento },
    { e: 'Ganancia de lazo A·β', v: si(A0 * beta, '', 4) },
    { e: 'F = 1 + A·β', v: si(F, '', 4) },
    { e: 'Ancho de banda (lazo cerrado)', v: si(BWcl, 'Hz', 3), c: pal.acento },
    { e: 'GBW', v: si(Af * BWcl, 'Hz', 3) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 620] : [900, 430])} etiqueta="Lazo de realimentación negativa con sus señales y la respuesta al escalón" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Ganancia pedida 1/β" bind:valor={G} min={1} max={1000} log formato={(x) => num(x, x < 10 ? 2 : 1)} />
    <Deslizador etiqueta="Ganancia en lazo abierto A_0" bind:valor={A0n} min={100} max={1e6} log formato={(x) => si(x, '', 3)} />
    <Deslizador etiqueta="Variación de A (temperatura, ejemplar)" bind:valor={cambio} min={-0.5} max={0.5} paso={0.01} formato={(x) => pct(x, 0)} />
    <div class="botones">
      <button class="boton" onclick={() => ((G = 11), (A0n = 1e5), (cambio = 0))}>Ejemplo 26.2: A = 10⁵, ganancia 11</button>
    </div>
  {/snippet}
  {#snippet grafica()}
    <Grafica series={bode} xAxis={{ label: 'Frecuencia', unit: 'Hz', scale: 'log' }} yAxis={{ label: 'Ganancia', unit: 'dB', scale: 'linear', min: -20, max: 125 }} height={240} title="Bode de la ganancia: lazo abierto y lazo cerrado" />
  {/snippet}
</Marco>

<style>
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
