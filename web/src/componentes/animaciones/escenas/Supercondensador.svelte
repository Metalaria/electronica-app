<script lang="ts">
  // Electric double-layer capacitor (book 3.10): ions of the electrolyte pile up against porous carbon,
  // forming layers about a nanometre thick. 1 F at 2,7 V stores 3,6 J; with 100 mA it falls from 2,7 to
  // 1,8 V in 9 s. Above about 2,7 V per cell the electrolyte decomposes.
  import { untrack } from 'svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Selector from '../ui/Selector.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, azar, circulo, brillo, type Vista } from '../nucleo/dibujo';
  import { alfa, mezcla, paleta } from '../nucleo/paleta';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  const C = 1;
  let modo = $state<'carga' | 'descarga'>('carga');
  let Vmax = $state(2.7);
  let corriente = $state(0.1);

  let Vc = 0;
  let tiempo = 0;
  let serie = $state.raw<{ t: number[]; v: number[] }>({ t: [0], v: [0] });
  let vMostrada = $state(0);
  const muestreo = new Muestreo(100);
  const rnd = azar(13);
  const iones = Array.from({ length: 70 }, (_, i) => ({ s: i % 2 ? 1 : -1, x: rnd(), y: rnd(), f: rnd() * 6, k: rnd() }));

  $effect(() => {
    void modo;
    untrack(() => {
      tiempo = 0;
      serie = { t: [0], v: [Vc] };
    });
  });
  $effect(() => {
    if (reloj.reinicios > 0)
      untrack(() => {
        Vc = 0;
        tiempo = 0;
        modo = 'carga';
        serie = { t: [0], v: [0] };
      });
  });

  function paso(dt: number): void {
    tiempo += dt;
    // Charge with 1 A up to the chosen voltage; discharge at constant current: dV/dt = −I/C.
    if (modo === 'carga') Vc = Math.min(Vmax, Vc + (1 / C) * dt);
    else Vc = Math.max(0, Vc - (corriente / C) * dt);
    if (muestreo.toca()) {
      serie = { t: [...serie.t, tiempo].slice(-400), v: [...serie.v, Vc].slice(-400) };
      vMostrada = Vc;
    }
  }

  function dibujar(v: Vista): void {
    void [modo, Vmax];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const x0 = 40;
    const x1 = v.w - 40;
    const y0 = est ? 76 : 70;
    const y1 = est ? v.h - 90 : v.h - 70;
    const wE = (x1 - x0) * 0.24;
    const xs = (x0 + x1) / 2;
    // Current collectors, porous carbon, separator, electrolyte.
    ctx.fillStyle = mezcla(p.electrolito, p.fondo, 0.6);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    const k = Math.min(1, Vc / 2.7);
    const carbon = (xa: number, xb: number, lado: 1 | -1) => {
      ctx.fillStyle = p.aluminio;
      ctx.fillRect(lado < 0 ? xa : xb - 12, y0, 12, y1 - y0);
      // Carbon grains with pores.
      const r = 15;
      for (let gy = y0 + r; gy < y1; gy += r * 1.6)
        for (let gx = (lado < 0 ? xa + 12 : xa) + r; gx < (lado < 0 ? xb : xb - 12) - 4; gx += r * 1.75) {
          const g = ctx.createRadialGradient(gx - 4, gy - 4, 2, gx, gy, r);
          g.addColorStop(0, '#5a5a5a');
          g.addColorStop(1, '#222222');
          circulo(ctx, gx, gy, r * 0.82, undefined);
          ctx.fillStyle = g;
          ctx.fill();
        }
      // Electronic charge at the carbon surface (inner face).
      const xf = lado < 0 ? xb : xa;
      for (let n = 0; n < Math.round(14 * k); n++) {
        const y = y0 + 10 + ((y1 - y0 - 20) * (n + 0.5)) / Math.max(1, Math.round(14 * k));
        if (lado < 0) txt(v, '+', xf - 6, y, { tam: 12, peso: 800, color: p.positivo });
        else circulo(ctx, xf + 6, y, 3, p.electron);
      }
    };
    carbon(x0, x0 + wE, -1);
    carbon(x1 - wE, x1, 1);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = alfa(p.suave, 0.7);
    ctx.beginPath();
    ctx.moveTo(xs, y0);
    ctx.lineTo(xs, y1);
    ctx.stroke();
    ctx.setLineDash([]);
    txt(v, 'separador', xs, y1 + 20, { tam: 12, color: p.suave });
    // Ions: free in the bulk; with charge they pile up on the opposite electrode (double layer).
    for (const io of iones) {
      const libre = 1 - k * (io.k < 0.85 ? 1 : 0);
      const xb = x0 + wE + 14 + io.x * (x1 - x0 - 2 * wE - 28);
      const destino = io.s < 0 ? x0 + wE + 8 : x1 - wE - 8;
      const x = xb * libre + destino * (1 - libre) + Math.sin(v.t * 3 + io.f) * 4 * libre;
      const y = y0 + 10 + io.y * (y1 - y0 - 20) + Math.cos(v.t * 2.4 + io.f) * 3;
      const col = io.s > 0 ? '#e8833a' : '#21a09a';
      circulo(ctx, x, y, 6, alfa(col, 0.85));
      txt(v, io.s > 0 ? '+' : '−', x, y + 0.5, { tam: 10, peso: 800, color: '#ffffff' });
    }
    if (Vc > 2.75) {
      for (let n = 0; n < 8; n++) brillo(ctx, x0 + wE + 20 + ((n * 47) % (x1 - x0 - 2 * wE - 40)), y0 + 20 + ((n * 83 + v.t * 40) % (y1 - y0 - 40)), 10, '#ffffff', 0.6);
      txt(v, 'Sobretensión: el electrolito se descompone', xs, y1 + 22, { tam: 14, peso: 800, color: p.peligro });
    }
    txt(v, 'carbón activo (+)', x0 + wE / 2, y1 + (est ? 22 : 20), { tam: 12, color: p.suave });
    txt(v, 'carbón activo (−)', x1 - wE / 2, y1 + (est ? 22 : 20), { tam: 12, color: p.suave });
    txtRico(v, `V = ${num(Vc, 2)} V`, xs, est ? 30 : 26, { tam: 17, peso: 800, color: p.acento, fondo: alfa(p.acento, 0.1) });
    txt(v, 'doble capa ≈ 1 nm', x0 + wE - 4, y0 - 12, { tam: 12, alin: 'left', color: '#21a09a', peso: 800 });
  }

  const texto = $derived(
    `**Supercondensador de doble capa:** no hay dieléctrico convencional. Los iones del electrolito se apilan contra el carbón poroso, a apenas un nanómetro de las cargas del electrodo, y el carbón activado tiene de mil a dos mil metros cuadrados por gramo: de ahí los faradios.\n` +
      (modo === 'carga'
        ? `Cargando a 1 A: ${num(vMostrada, 2)} V y ${si(0.5 * C * vMostrada * vMostrada, 'J', 3)} almacenados (3,6 J a 2,7 V). No tolera pasar de 2,5–3 V por celda: el electrolito se descompone.`
        : `Descargando a ${si(corriente, 'A', 2)}: la tensión baja en línea recta, ΔV = I·t/C; con 100 mA, de 2,7 a 1,8 V en 9 s.`),
  );
  const lecturas = $derived([
    { e: 'Tensión', v: `${num(vMostrada, 2)} V`, c: pal.acento },
    { e: 'Energía ½·C·V²', v: si(0.5 * C * vMostrada * vMostrada, 'J', 3) },
    { e: 'Carga Q = C·V', v: si(C * vMostrada, 'C', 3) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 520] : [900, 400])} etiqueta="Supercondensador: iones formando la doble capa" />
  {/snippet}
  {#snippet controles()}
    <Selector bind:valor={modo} opciones={[{ valor: 'carga', texto: 'Cargar (1 A)' }, { valor: 'descarga', texto: 'Descargar' }]} />
    <Deslizador etiqueta="Tensión de carga" bind:valor={Vmax} min={1} max={3.2} paso={0.05} unidad="V" />
    <Deslizador etiqueta="Corriente de descarga" bind:valor={corriente} min={0.01} max={1} log unidad="A" />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Tensión del supercondensador de 1 F"
      x={{ etiqueta: 't', unidad: 's', min: 0, max: Math.max(10, serie.t[serie.t.length - 1] ?? 10) }}
      y={{ etiqueta: 'V', unidad: 'V', min: 0, max: 3.3 }}
      series={[{ x: serie.t, y: serie.v, color: pal.acento }]}
      lineas={[{ y: 2.7, etiqueta: '2,7 V máx.', color: pal.peligro }, { y: 1.8, etiqueta: '1,8 V', color: pal.suave }]}
    />
  {/snippet}
</Marco>
