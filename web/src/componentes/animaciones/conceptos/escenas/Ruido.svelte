<script lang="ts">
  // Noise and its sum in quadrature (book 31.2, 31.3, 31.5): thermal noise of a resistance √(4kTR) (4,1 nV/√Hz for
  // 1 kΩ at 300 K), the op-amp's voltage and current noise, the 1/f region below the corner frequency, and the
  // total in a bandwidth. Independent sources add in power: 10 µV and 3 µV give 10,4 µV, so the dominant one is
  // the one to attack. Book example: 1 kΩ source, 5 nV/√Hz and 1 pA/√Hz, 10 kHz → 6,5 nV/√Hz and 0,65 µV at the
  // input. The traces are white Gaussian noise with those rms values; the bell is the distribution of the sum.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, pct } from '../../nucleo/formato';
  import { KB } from '../../nucleo/fisica';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, area, guia, X, Y, type Ejes } from '../nucleo/grafica';
  import { generadorRuido } from '../nucleo/senal';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let R = $state(1000);
  let en = $state(5e-9);
  let iN = $state(1e-12);
  let BW = $state(10e3);
  let disp = $state<'bipolar' | 'jfet' | 'mosfet'>('bipolar');
  const TK = 300;
  const F_BAJA = 1; // lower end of the band (Hz)

  const esquina = $derived(disp === 'bipolar' ? 10 : disp === 'jfet' ? 300 : 10e3);
  const dens = $derived({ r: Math.sqrt(4 * KB * TK * R), e: en, i: iN * R });
  /** Integrated rms of the op-amp voltage noise with its 1/f region: e²·(f_c·ln(f_H/f_L) + f_H − f_L). */
  const rms = $derived.by(() => {
    const r = dens.r * Math.sqrt(BW - F_BAJA);
    const e = en * Math.sqrt(esquina * Math.log(BW / F_BAJA) + BW - F_BAJA);
    const i = dens.i * Math.sqrt(BW - F_BAJA);
    return { r, e, i, total: Math.hypot(r, e, i) };
  });

  const TAM = 4096;
  const tablas = [1, 2, 3].map((s) => {
    const g = generadorRuido(s * 101);
    const t = new Float64Array(TAM);
    for (let k = 0; k < TAM; k++) t[k] = g();
    return t;
  });

  // Samples scroll at 60 per second on screen, whatever the frame rate.
  let pos = 0;
  let n = $state(0);
  const muestreo = new Muestreo(60);
  function paso(dt: number): void {
    pos += dt * 60;
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const tot = rms.total;
    const esc = 4 * tot;
    const N = 240;
    const i0 = Math.floor(pos);
    const fuentes: [string, number, string, Float64Array][] = [
      ['R (térmico)', rms.r, p.serie[0], tablas[0]!],
      ['e_n del operacional', rms.e, p.serie[1], tablas[1]!],
      ['i_n·R', rms.i, p.serie[2], tablas[2]!],
    ];
    const eT: Ejes = est ? { x: 60, y: 40, w: 330, h: 230, x0: 0, x1: N, y0: -esc * 4.2, y1: esc } : { x: 60, y: 40, w: 420, h: 250, x0: 0, x1: N, y0: -esc * 4.2, y1: esc };
    const eH: Ejes = est ? { x: 410, y: 40, w: 160, h: 230, x0: 0, x1: 1.1, y0: -esc * 4.2, y1: esc } : { x: 500, y: 40, w: 110, h: 250, x0: 0, x1: 1.1, y0: -esc * 4.2, y1: esc };
    const eD: Ejes = est
      ? { x: 70, y: 330, w: 500, h: 170, x0: 1, x1: 1e6, y0: 0.5e-9, y1: 300e-9, logX: true, logY: true }
      : { x: 660, y: 40, w: 210, h: 250, x0: 1, x1: 1e6, y0: 0.5e-9, y1: 300e-9, logX: true, logY: true };
    estatico(v, `ru:${est}:${esc}`, (vv) => {
      panel(vv, eT, { titulo: 'Cada fuente y su suma (entrada)', sinX: true, sinY: true, marcasY: [] });
      panel(vv, eH, { titulo: 'Distribución', sinX: true, sinY: true, marcasY: [], marcasX: [] });
      panel(vv, eD, { titulo: 'Densidad de ruido', ux: 'Hz', uy: 'V', fmtY: (y) => `${si(y, 'V', 1).replace(' ', ' ')}/√Hz`, marcasX: [1, 100, 1e4, 1e6] });
    });
    // Each source on its own lane (offset), the sum at the top.
    const lanes = [-esc * 1.2, -esc * 2.2, -esc * 3.2];
    const xs = new Float64Array(N);
    const suma = new Float64Array(N);
    fuentes.forEach(([, s, c, t], j) => {
      const ys = new Float64Array(N);
      for (let k = 0; k < N; k++) {
        const val = t[(i0 + k) % TAM]! * s;
        xs[k] = k;
        ys[k] = lanes[j]! + val;
        suma[k] = (suma[k] ?? 0) + val;
      }
      curva(ctx, eT, xs, ys, alfa(c, 0.9), 1.2);
      txtRico(v, `${fuentes[j]![0]}: ${si(s, 'V', 2)}`, eT.x + 6, Y(eT, lanes[j]! + esc * 0.42), { tam: 11, peso: 700, color: c, alin: 'left' });
    });
    curva(ctx, eT, xs, suma, p.acento, 1.6);
    txtRico(v, `suma: ${si(tot, 'V', 3)} ef.`, eT.x + 6, Y(eT, esc * 0.8), { tam: 11.5, peso: 800, color: p.acento, alin: 'left' });
    // Bell of the sum with ±σ and ±3σ.
    const bx: number[] = [];
    const by: number[] = [];
    for (let k = 0; k <= 80; k++) {
      const y = -esc + (2 * esc * k) / 80;
      bx.push(Math.exp(-((y / tot) ** 2) / 2));
      by.push(y);
    }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(X(eH, 0), Y(eH, by[0]!));
    for (let k = 0; k <= 80; k++) ctx.lineTo(X(eH, bx[k]!), Y(eH, by[k]!));
    ctx.lineTo(X(eH, 0), Y(eH, by[80]!));
    ctx.fillStyle = alfa(p.acento, 0.18);
    ctx.fill();
    ctx.strokeStyle = p.acento;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
    for (const m of [1, 3]) {
      guia(ctx, eH, 'y', m * tot, alfa(p.tinta, 0.4));
      guia(ctx, eH, 'y', -m * tot, alfa(p.tinta, 0.4));
      txt(v, `${m}σ`, eH.x + eH.w - 4, Y(eH, m * tot) - 7, { tam: 10.5, color: p.suave, alin: 'right' });
    }
    // Density plot.
    const fx: number[] = [];
    const yr: number[] = [];
    const ye: number[] = [];
    const yt: number[] = [];
    for (let k = 0; k <= 120; k++) {
      const f = 10 ** ((6 * k) / 120);
      fx.push(f);
      yr.push(dens.r);
      const e = en * Math.sqrt(1 + esquina / f);
      ye.push(e);
      yt.push(Math.hypot(dens.r, e, dens.i));
    }
    const banda = fx.map((f, k) => (f >= F_BAJA && f <= BW ? yt[k]! : NaN));
    area(ctx, eD, fx.filter((f) => f <= BW), banda.filter((b) => Number.isFinite(b)), alfa(p.acento, 0.12), eD.y0);
    curva(ctx, eD, fx, yr, p.serie[0], 1.6, [5, 4]);
    curva(ctx, eD, fx, ye, p.serie[1], 1.6, [5, 4]);
    curva(ctx, eD, fx, yt, p.acento, 2.2);
    guia(ctx, eD, 'x', BW, alfa(p.acento, 0.7));
    guia(ctx, eD, 'x', esquina, alfa(p.serie[1], 0.6), 1, [2, 3]);
    txt(v, 'esquina 1/f', X(eD, esquina) + 3, eD.y + eD.h - 10, { tam: 10.5, color: p.serie[1], alin: 'left' });

    // Power shares.
    const sx = est ? 70 : 60;
    const sy = est ? 556 : 340;
    const sw = est ? 500 : 810;
    const pt = tot * tot;
    let x = sx;
    txt(v, 'Reparto de la potencia de ruido (suma en cuadratura)', sx, sy - 12, { tam: 12, peso: 700, color: p.suave, alin: 'left' });
    for (const [et, s, c] of fuentes) {
      const w = (sw * s * s) / pt;
      ctx.fillStyle = c;
      ctx.fillRect(x, sy, w, 20);
      if (w > 60) txt(v, `${et.split(' ')[0]} ${pct((s * s) / pt, 0)}`, x + 5, sy + 10, { tam: 11, peso: 700, color: '#fff', alin: 'left' });
      x += w;
    }
  }

  const dominante = $derived.by(() => {
    const l: [string, number][] = [
      ['el ruido térmico de la fuente', rms.r],
      ['el ruido de tensión del operacional', rms.e],
      ['el ruido de corriente sobre R', rms.i],
    ];
    return l.sort((a, b) => b[1] - a[1])[0]!;
  });

  const texto = $derived(
    `**Ruido térmico:** √(4kTR) = ${si(dens.r, 'V', 3)}/√Hz para ${si(R, 'Ω', 3)} a 300 K (4,1 nV/√Hz con 1 kΩ). El operacional añade ${si(en, 'V', 2)}/√Hz, que crece por debajo de su esquina 1/f (${si(esquina, 'Hz', 2)} en un ${disp === 'bipolar' ? 'bipolar' : disp === 'jfet' ? 'JFET' : 'MOSFET'}), y su ruido de corriente cae sobre R: ${si(dens.i, 'V', 2)}/√Hz.\n` +
      `**Se suman en cuadratura:** en ${si(BW, 'Hz', 2)} de banda dan ${si(rms.r, 'V', 2)}, ${si(rms.e, 'V', 2)} y ${si(rms.i, 'V', 2)}, y el total es ${si(rms.total, 'V', 3)} eficaces, no ${si(rms.r + rms.e + rms.i, 'V', 3)}. Domina ${dominante[0]}: mejorar las demás apenas cambia nada. El pico a pico ronda 6,6 veces el eficaz (±3,3σ).`,
  );

  const lecturas = $derived([
    { e: 'Total eficaz (entrada)', v: si(rms.total, 'V', 3), c: pal.acento },
    { e: 'Densidad blanca total', v: `${si(Math.hypot(dens.r, en, dens.i), 'V', 3)}/√Hz` },
    { e: 'Térmico de R', v: si(rms.r, 'V', 3), c: pal.serie[0] },
    { e: 'e_n (con 1/f)', v: si(rms.e, 'V', 3), c: pal.serie[1] },
    { e: 'i_n·R', v: si(rms.i, 'V', 3), c: pal.serie[2] },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet modos()}
    <Selector
      etiqueta="Entrada del operacional"
      bind:valor={disp}
      opciones={[
        { valor: 'bipolar', texto: 'Bipolar (esquina 10 Hz)' },
        { valor: 'jfet', texto: 'JFET (300 Hz)' },
        { valor: 'mosfet', texto: 'MOSFET (10 kHz)' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 600] : [900, 380])} etiqueta="Fuentes de ruido, su suma en cuadratura y la densidad espectral" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Resistencia de la fuente R" bind:valor={R} min={10} max={1e6} log unidad="Ω" />
    <Deslizador etiqueta="e_n del operacional" bind:valor={en} min={1e-9} max={50e-9} log formato={(x) => `${si(x, 'V', 2)}/√Hz`} />
    <Deslizador etiqueta="i_n del operacional" bind:valor={iN} min={1e-15} max={10e-12} log formato={(x) => `${si(x, 'A', 2)}/√Hz`} />
    <Deslizador etiqueta="Ancho de banda" bind:valor={BW} min={100} max={1e6} log unidad="Hz" />
    <button class="boton" onclick={() => ((R = 1000), (en = 5e-9), (iN = 1e-12), (BW = 10e3), (disp = 'bipolar'))}>Ejemplo 31.3: 1 kΩ, 5 nV/√Hz, 1 pA/√Hz, 10 kHz</button>
  {/snippet}
</Marco>
