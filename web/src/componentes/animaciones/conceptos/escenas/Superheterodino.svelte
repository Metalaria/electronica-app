<script lang="ts">
  // Mixing and the superheterodyne (book 15.3, 35.9, 35.7, 30.4): the mixer multiplies the antenna signal by the
  // local oscillator, cos a·cos b = ½cos(a − b) + ½cos(a + b), and every station moves to |f_LO − f|. The FM7303
  // tunes the oscillator 10,7 MHz above the station; the ceramic IF filters (10,7 MHz, about 280 kHz) give the
  // selectivity at a fixed frequency, where Q ≈ 53 suffices instead of 500 at 100 MHz. The price is the image,
  // 2·FI = 21,4 MHz above the station (121,4 MHz for 100 MHz), which only the input circuit can reject.
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
  import { estatico, panel, funcion, barras, guia, X, Y, type Ejes } from '../nucleo/grafica';
  import { dB } from '../nucleo/senal';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  const FI = 10.7e6;
  let sint = $state(100e6);
  let barrer = $state(true);
  let pre = $state<'ninguno' | 'bpf' | 'lc'>('bpf');
  let imagen = $state(true);

  // Fictitious stations (MHz, relative amplitude) plus a strong signal at the image of 100 MHz.
  const EMISORAS = [
    { f: 89.6e6, a: 0.7 },
    { f: 93.1e6, a: 0.45 },
    { f: 96.4e6, a: 0.85 },
    { f: 100e6, a: 0.6 },
    { f: 100.3e6, a: 0.35 },
    { f: 104.8e6, a: 0.75 },
  ];
  const IMAGEN = { f: 121.4e6, a: 0.9 };
  const lista = $derived(imagen ? [...EMISORAS, IMAGEN] : EMISORAS);
  const fLO = $derived(sint + FI);

  function hPre(f: number): number {
    if (pre === 'ninguno') return 1;
    if (pre === 'bpf') return 1 / Math.sqrt(1 + ((f - 97.5e6) / 10.5e6) ** 10);
    const Q = 25;
    return 1 / Math.sqrt(1 + Q * Q * (f / sint - sint / f) ** 2);
  }
  function hFI(f: number): number {
    return 1 / Math.sqrt(1 + ((f - FI) / 140e3) ** 6);
  }

  const salida = $derived(
    lista.map((e) => {
      const fd = Math.abs(fLO - e.f);
      return { ...e, fd, a2: e.a * hPre(e.f), oye: e.a * hPre(e.f) * hFI(fd) };
    }),
  );

  let fase = 0;
  let n = $state(0);
  const muestreo = new Muestreo(60);
  function paso(dt: number): void {
    if (barrer) {
      fase += dt / 30;
      const u = 0.5 - 0.5 * Math.cos(2 * Math.PI * fase);
      sint = Math.round((88e6 + u * 20e6) / 50e3) * 50e3;
    }
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const e1: Ejes = est ? { x: 50, y: 40, w: 520, h: 170, x0: 84e6, x1: 126e6, y0: 0, y1: 1.15 } : { x: 50, y: 40, w: 820, h: 140, x0: 84e6, x1: 126e6, y0: 0, y1: 1.15 };
    const e2: Ejes = est ? { x: 50, y: 290, w: 520, h: 170, x0: 0, x1: 26e6, y0: 0, y1: 1.15 } : { x: 50, y: 250, w: 520, h: 140, x0: 0, x1: 26e6, y0: 0, y1: 1.15 };
    estatico(v, `sh:${est}`, (vv) => {
      panel(vv, e1, { titulo: 'Antena: la banda de FM, el filtro de entrada y el oscilador local', ux: 'Hz', sinY: true, marcasY: [0, 1] });
      panel(vv, e2, { titulo: 'Salida del mezclador (diferencias) y el filtro cerámico de FI', ux: 'Hz', sinY: true, marcasY: [0, 1] });
    });
    // RF panel.
    funcion(ctx, e1, (f) => hPre(f), alfa(p.serie[2], 0.9), 2, 300);
    barras(ctx, e1, lista.map((e) => e.f), lista.map((e) => e.a), alfa(p.acento, 0.85), 4);
    guia(ctx, e1, 'x', sint, alfa(p.acento, 0.6));
    guia(ctx, e1, 'x', fLO, p.peligro, 2, [6, 3]);
    txt(v, `LO ${num(fLO / 1e6, 2)} MHz`, X(e1, fLO) + 4, e1.y + 12, { tam: 11.5, color: p.peligro, alin: 'left', peso: 700 });
    txt(v, `sintonía ${num(sint / 1e6, 2)} MHz`, X(e1, sint) - 4, e1.y + 12, { tam: 11.5, color: p.acento, alin: 'right', peso: 700 });
    const fim = sint + 2 * FI;
    if (fim < e1.x1) {
      ctx.fillStyle = alfa(p.corriente, 0.18);
      ctx.fillRect(X(e1, fim - 150e3), e1.y, Math.max(3, X(e1, fim + 150e3) - X(e1, fim - 150e3)), e1.h);
      txt(v, 'imagen', X(e1, fim), e1.y + e1.h - 10, { tam: 11.5, color: p.corriente, peso: 700 });
    }
    txt(v, pre === 'ninguno' ? 'sin filtro de entrada' : pre === 'bpf' ? 'BPF 87–108 MHz' : 'circuito sintonizado (Q ≈ 25)', e1.x + 6, Y(e1, 0.26), { tam: 11.5, color: p.serie[2], alin: 'left', peso: 700 });

    // IF panel: every station shifted to |f_LO − f|.
    funcion(ctx, e2, (f) => hFI(f), alfa(p.serie[4], 0.9), 2, 600);
    barras(ctx, e2, salida.map((s) => s.fd), salida.map((s) => s.a2), alfa(p.acento, 0.5), 4);
    barras(ctx, e2, salida.map((s) => s.fd), salida.map((s) => s.oye), p.acento, 4);
    const img = salida.find((s) => s.f === IMAGEN.f);
    if (img && img.fd < e2.x1) {
      barras(ctx, e2, [img.fd], [img.a2], alfa(p.corriente, 0.9), 4);
      if (img.oye > 0.05) txt(v, '¡la imagen cae en la FI!', X(e2, img.fd) + 6, Y(e2, img.a2) - 8, { tam: 11.5, color: p.corriente, peso: 700, alin: 'left' });
    }
    txt(v, 'FI 10,7 MHz', X(e2, FI), e2.y + 12, { tam: 11.5, color: p.serie[4], peso: 700 });
    txt(v, `y las sumas, a ≈ ${num((fLO + sint) / 1e6, 0)} MHz: fuera`, e2.x + e2.w - 6, e2.y + e2.h - 10, { tam: 11, color: p.suave, alin: 'right' });

    // What the receiver hears.
    const bx = est ? 50 : 620;
    const by = est ? 500 : 260;
    txt(v, 'Lo que pasa por la FI', bx, by, { tam: 12, peso: 700, color: p.suave, alin: 'left' });
    const oidas = salida.filter((s) => s.oye > 0.02).sort((a, b) => b.oye - a.oye);
    oidas.slice(0, 3).forEach((s, i) => {
      const esImg = s.f === IMAGEN.f;
      txt(v, `${num(s.f / 1e6, 1)} MHz${esImg ? ' (imagen)' : ''}: ${num(dB(s.oye), 1)} dB`, bx, by + 22 + i * 20, { tam: 12.5, peso: 700, color: esImg ? p.corriente : p.acento, alin: 'left' });
    });
    if (!oidas.length) txt(v, 'nada: entre emisoras', bx, by + 22, { tam: 12.5, color: p.suave, alin: 'left' });
  }

  const texto = $derived.by(() => {
    const img = salida.find((s) => s.f === IMAGEN.f);
    return (
      `**Mezclar es multiplicar:** cos a·cos b = ½cos(a − b) + ½cos(a + b). Con el oscilador local en ${num(fLO / 1e6, 2)} MHz (sintonía + 10,7 MHz), cada emisora sale del mezclador a |f_LO − f|; la sintonizada cae justo en 10,7 MHz y los filtros cerámicos de FI, fijos, dejan pasar solo esa. Separar emisoras a 200 kHz pide Q ≈ 53 a 10,7 MHz en lugar de 500 a 100 MHz: esa es la razón del superheterodino.\n` +
      `**La frecuencia imagen**, a f + 2·FI = ${num((sint + 2 * FI) / 1e6, 1)} MHz, también da 10,7 MHz. Solo el circuito de entrada puede rechazarla, porque después ya es indistinguible.` +
      (img ? ` Ahora llega a la FI con ${num(dB(img.oye + 1e-9), 1)} dB.` : '')
    );
  });

  const lecturas = $derived([
    { e: 'Sintonía', v: si(sint, 'Hz', 4), c: pal.acento },
    { e: 'Oscilador local', v: si(fLO, 'Hz', 4), c: pal.peligro },
    { e: 'Frecuencia imagen', v: si(sint + 2 * FI, 'Hz', 4), c: pal.corriente },
    { e: 'Rechazo de la imagen', v: `${num(-dB(hPre(sint + 2 * FI)), 1)} dB` },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet modos()}
    <Selector
      etiqueta="Filtro de entrada"
      bind:valor={pre}
      opciones={[
        { valor: 'bpf', texto: 'BPF 87–108 MHz' },
        { valor: 'lc', texto: 'Sintonizado (L1 + C4A)' },
        { valor: 'ninguno', texto: 'Ninguno' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 580] : [900, 410])} etiqueta="Receptor superheterodino: espectro de la antena, el oscilador local y la frecuencia intermedia" />
  {/snippet}
  {#snippet controles()}
    <Interruptor etiqueta="Recorrer el dial" bind:valor={barrer} />
    <Deslizador etiqueta="Sintonía" bind:valor={sint} min={88e6} max={108e6} paso={50e3} unidad="Hz" cifras={4} desactivado={barrer} />
    <Interruptor etiqueta="Señal fuerte en 121,4 MHz (imagen de 100 MHz)" bind:valor={imagen} />
  {/snippet}
</Marco>
