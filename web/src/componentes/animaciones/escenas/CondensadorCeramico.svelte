<script lang="ts">
  // Ceramic capacitors (book 3.4.1 and 3.7): the disc, the multilayer chip (MLCC) with its interleaved
  // electrodes, and the DC-bias effect of class 2 dielectrics: ferroelectric domains aligned by the DC field
  // stop contributing, and a 10 µF X7R 0805 of 16 V keeps only 30–50 % of its capacitance at 5 V.
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, etiqueta, gradCilindro, gradCilindroX, flecha, azar, type Vista } from '../nucleo/dibujo';
  import { alfa, mezcla, paleta } from '../nucleo/paleta';
  import { si, num, pct } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let modo = $state<'disco' | 'mlcc'>('mlcc');
  let clase = $state<'C0G' | 'X7R' | 'Y5V'>('X7R');
  let vr = $state(16);
  let vdc = $state(5);
  let corte = $state(0.6);

  /** Fraction of the nominal capacitance left at a DC bias (fit to the book's figures). */
  function fraccion(v: number, cl: string, nominal: number): number {
    if (cl === 'C0G') return 1;
    const vk = (cl === 'X7R' ? 3.9 : 2.2) * (nominal / 16);
    const e = cl === 'X7R' ? 1.6 : 1.4;
    return 1 / (1 + Math.pow(Math.max(0, v) / vk, e));
  }
  const C0 = $derived(clase === 'C0G' ? 100e-9 : 10e-6);
  const k = $derived(fraccion(Math.min(vdc, vr), clase, vr));
  const espesor = $derived(vr <= 6.3 ? 1.5e-6 : vr <= 16 ? 3e-6 : 8e-6);
  const campoDC = $derived(Math.min(vdc, vr) / espesor);

  const rnd = azar(9);
  const dominios = Array.from({ length: 400 }, () => ({ a: rnd() * Math.PI * 2, u: rnd(), w: rnd() }));
  let t = 0;
  function paso(dt: number): void {
    t += dt;
  }

  function mlcc(v: Vista): void {
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const x0 = est ? 70 : 120;
    const x1 = est ? v.w - 70 : v.w - 120;
    const y0 = est ? 70 : 60;
    const y1 = est ? 360 : 310;
    const wt = (x1 - x0) * 0.1;
    // Ceramic body.
    ctx.fillStyle = gradCilindro(ctx, y0, y1, mezcla(p.ceramica, '#b8a27a', 0.35), p.oscuro);
    ctx.fillRect(x0 + wt * 0.6, y0, x1 - x0 - wt * 1.2, y1 - y0);
    const n = 14;
    const paso = (y1 - y0 - 30) / n;
    const vista = Math.min(vdc, vr);
    // Dielectric layers: domains (class 2) or plain dipoles (C0G), aligned by the DC field.
    const alin = 1 - k;
    for (let i = 0; i < n - 1; i++) {
      const ya = y0 + 15 + paso * (i + 0.5);
      const yb = ya + paso;
      const sentido = i % 2 === 0 ? 1 : -1; // field direction alternates layer to layer
      if (clase !== 'C0G') {
        const cols = 16;
        for (let c = 0; c < cols; c++) {
          const dm = dominios[(i * cols + c) % dominios.length]!;
          const x = x0 + wt * 1.7 + ((x1 - x0 - wt * 3.4) * (c + 0.5)) / cols;
          const y = (ya + yb) / 2 + (dm.u - 0.5) * paso * 0.25;
          const objetivo = sentido > 0 ? Math.PI / 2 : -Math.PI / 2;
          const a = dm.a + (objetivo - dm.a) * alin + Math.sin(t * 2 + dm.w * 6) * 0.25 * (1 - alin);
          const L = Math.min(9, paso * 0.32);
          const fijo = alin > 0.02 && dm.w < alin;
          flecha(
            ctx,
            x - Math.cos(a) * L,
            y - Math.sin(a) * L,
            x + Math.cos(a) * L,
            y + Math.sin(a) * L,
            fijo ? alfa(p.peligro, 0.75) : alfa(p.campoB, 0.8),
            1.5,
            5,
          );
        }
      } else if (vista > 0) {
        for (let c = 0; c < 6; c++) {
          const x = x0 + wt * 2 + ((x1 - x0 - wt * 4) * (c + 0.5)) / 6;
          flecha(ctx, x, (ya + yb) / 2 - sentido * paso * 0.25, x, (ya + yb) / 2 + sentido * paso * 0.25, alfa(p.campoE, 0.7), 1.4, 6);
        }
      }
    }
    // Interleaved electrodes.
    for (let i = 0; i < n; i++) {
      const y = y0 + 15 + paso * (i + 0.5);
      const izq = i % 2 === 0;
      const xa = izq ? x0 + wt * 0.6 : x0 + wt * 1.5;
      const xb = izq ? x1 - wt * 1.5 : x1 - wt * 0.6;
      ctx.fillStyle = mezcla('#8a9099', p.fondo, 0.1);
      ctx.fillRect(xa, y - 2, xb - xa, 4);
      if (vista > 0) {
        txt(v, izq ? '+' : '−', izq ? xb + 6 : xa - 6, y, { tam: 10, peso: 800, color: izq ? p.positivo : p.electron });
      }
    }
    // Terminations Cu / Ni / Sn.
    for (const lado of [0, 1]) {
      const xa = lado ? x1 - wt * 0.6 : x0 - wt * 0.4;
      ctx.fillStyle = gradCilindroX(ctx, xa, xa + wt, p.estano, p.oscuro);
      rr(ctx, xa, y0 - 6, wt, y1 - y0 + 12, 6);
      ctx.fill();
      ctx.fillStyle = mezcla(p.cobre, p.fondo, 0.2);
      ctx.fillRect(lado ? xa : xa + wt - 5, y0, 5, y1 - y0);
    }
    txt(v, vista > 0 ? `+${num(vista, 1)} V` : '', x0 - wt * 0.4 + wt / 2, y1 + 24, { tam: 13, peso: 800, color: p.positivo });
    txt(v, vista > 0 ? '0 V' : '', x1 - wt * 0.6 + wt / 2, y1 + 24, { tam: 13, peso: 800 });
    if (!est) {
      etiqueta(v, 'electrodos de níquel', x1 - wt * 2.2, y0 - 26, x1 - wt * 2.4, y0 + 15 + paso * 1.5, { alin: 'right' });
      etiqueta(v, 'terminación Cu/Ni/Sn', x0 + wt * 1.4, y0 - 26, x0 + wt * 0.1, y0 + 20, { alin: 'left' });
    }
    txt(
      v,
      clase === 'C0G' ? 'Clase 1: sin dominios, capacidad estable' : est ? 'Rojos: dominios bloqueados por la continua' : 'Dominios ferroeléctricos: rojos = bloqueados por la tensión continua',
      v.w / 2,
      v.h - (est ? 58 : 46),
      { tam: 13, color: clase === 'C0G' ? p.campoE : p.suave, peso: 700 },
    );
    txtRico(v, `C = ${si(C0 * k, 'F', 3)} de ${si(C0, 'F', 2)} nominales`, v.w / 2, v.h - (est ? 28 : 20), {
      tam: 15,
      peso: 800,
      color: p.acento,
      fondo: alfa(p.acento, 0.1),
    });
  }

  function disco(v: Vista): void {
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const cx = v.w / 2;
    const cy = est ? 200 : 170;
    const R = est ? 130 : 120;
    const d = 26;
    // Leads.
    ctx.fillStyle = p.estano;
    ctx.fillRect(cx - R * 0.5 - 3, cy + R * 0.4, 6, v.h - cy - R * 0.4 - 20);
    ctx.fillRect(cx + R * 0.5 - 3, cy + R * 0.4, 6, v.h - cy - R * 0.4 - 20);
    // Coating (cut away on the right: section view of the disc).
    const xc = cx - R + 2 * R * corte;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, xc, v.h);
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(cx, cy, R + 12, R * 0.82 + 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = gradCilindro(ctx, cy - R, cy + R, '#d38a3a', p.oscuro);
    ctx.fill();
    txt(v, '104', cx - R * 0.35, cy, { tam: 26, peso: 800, color: '#5a2f0e' });
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(xc, 0, v.w, v.h);
    ctx.clip();
    // Cross-section: silver electrode, ceramic, silver electrode (seen edge-on, exaggerated thickness).
    const yt = cy - d;
    ctx.fillStyle = mezcla(p.estano, '#ffffff', 0.3);
    ctx.fillRect(cx - R, yt - 6, 2 * R, 6);
    ctx.fillStyle = gradCilindro(ctx, yt, yt + 2 * d, p.ceramica, p.oscuro);
    ctx.fillRect(cx - R, yt, 2 * R, 2 * d);
    ctx.fillStyle = mezcla(p.estano, '#ffffff', 0.3);
    ctx.fillRect(cx - R, yt + 2 * d, 2 * R, 6);
    const vista = Math.min(vdc, 50);
    if (vista > 0)
      for (let c = 0; c < 10; c++) {
        const x = cx - R + 10 + ((2 * R - 20) * (c + 0.5)) / 10;
        if (x > xc) flecha(ctx, x, yt + 4, x, yt + 2 * d - 4, alfa(p.campoE, 0.4 + 0.5 * Math.min(1, vista / 20)), 1.6, 7);
      }
    ctx.restore();
    if (xc < cx + R - 40) {
      etiqueta(v, 'electrodo de plata', Math.min(cx + R + 10, xc + 120), yt - 50, Math.min(cx + R - 20, xc + 60), yt - 3, { alin: 'left' });
      etiqueta(v, 'disco cerámico', Math.min(cx + R + 10, xc + 140), yt + d + 70, Math.min(cx + R - 20, xc + 70), yt + d, { alin: 'left' });
    }
    etiqueta(v, 'recubrimiento de resina', cx - R - 10, cy - R * 0.9, cx - R * 0.7, cy - R * 0.5, { alin: 'right' });
    txt(v, '«104» = 10 × 10⁴ pF = 100 nF', cx, v.h - 20, { tam: 14, peso: 700, color: p.acento });
  }

  function dibujar(v: Vista): void {
    void [modo, clase, vr, vdc, corte];
    fondo(v);
    if (modo === 'mlcc') mlcc(v);
    else disco(v);
  }

  const curvas = $derived.by(() => {
    const xs: number[] = [];
    const r: Record<number, number[]> = { 6.3: [], 16: [], 50: [] };
    for (let k2 = 0; k2 <= 100; k2++) {
      const vv = (k2 / 100) * 50;
      xs.push(vv);
      for (const n of [6.3, 16, 50]) r[n]!.push(vv <= n ? fraccion(vv, clase, n) : NaN);
    }
    return { xs, r };
  });

  const texto = $derived.by(() => {
    if (modo === 'disco')
      return (
        '**Cerámico de disco:** un disco de cerámica con una capa de plata en cada cara, las patillas soldadas y un baño de resina. Es el condensador de placas planas en su forma más directa: C = ε_0·ε_r·A/d.\n' +
        'El código «104» son dos cifras y el número de ceros en picofaradios: 100 000 pF = 100 nF.'
      );
    if (clase === 'C0G')
      return (
        '**MLCC de clase 1 (C0G/NP0):** cientos de láminas de cerámica y electrodos alternos, conectados por los extremos: es un condensador con un área enorme en un milímetro cúbico.\n' +
        'Su dieléctrico no es ferroeléctrico: la capacidad no cambia con la tensión ni apenas con la temperatura. El precio es una permitividad baja: valores de picofaradios a unos cientos de nanofaradios.'
      );
    return (
      `**MLCC de clase 2 (${clase}), ${si(C0, "F", 2)} y ${String(vr).replace(".", ",")} V:** su alta permitividad viene de dominios ferroeléctricos que se orientan con el campo. Con ${num(Math.min(vdc, vr), 1)} V de continua (${si(campoDC, 'V/m', 2)} en cada lámina de unos ${si(espesor, 'm', 1)}), los dominios alineados ya no responden.\n` +
      `Quedan ${si(C0 * k, 'F', 3)}: ha perdido el ${pct(1 - k, 0)}. ` +
      (vr < 50 ? 'Elegir una tensión nominal dos o tres veces mayor (lámina más gruesa) reduce mucho la pérdida.' : 'Con 50 V nominales la lámina es más gruesa y el campo menor: pierde mucho menos.')
    );
  });

  const lecturas = $derived(
    modo === 'mlcc'
      ? [
          { e: 'Capacidad efectiva', v: si(C0 * k, 'F', 3), c: pal.acento },
          { e: 'Pérdida por DC bias', v: pct(1 - k, 0), c: k < 0.5 ? pal.peligro : pal.tinta },
          { e: 'Campo en la lámina', v: si(campoDC, 'V/m', 2) },
          { e: 'Espesor de lámina', v: si(espesor, 'm', 2) },
        ]
      : [
          { e: 'Capacidad nominal', v: '100 nF', c: pal.acento },
          { e: 'Dieléctrico', v: 'cerámica de clase 2' },
        ],
  );
</script>

<Marco {reloj} {texto} {lecturas} leyenda={modo === 'mlcc' ? ['campoE'] : ['campoE']}>
  {#snippet modos()}
    <Selector bind:valor={modo} opciones={[{ valor: 'mlcc', texto: 'Multicapa (MLCC)' }, { valor: 'disco', texto: 'De disco' }]} />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 470] : [900, 400])} etiqueta="Condensador cerámico en corte" />
  {/snippet}
  {#snippet controles()}
    {#if modo === 'mlcc'}
      <Selector etiqueta="Dieléctrico" bind:valor={clase} opciones={[{ valor: 'C0G', texto: 'C0G' }, { valor: 'X7R', texto: 'X7R' }, { valor: 'Y5V', texto: 'Y5V' }]} />
      <Selector etiqueta="Tensión nominal" bind:valor={vr} opciones={[{ valor: 6.3, texto: '6,3 V' }, { valor: 16, texto: '16 V' }, { valor: 50, texto: '50 V' }]} />
      <Deslizador etiqueta="Tensión continua aplicada" bind:valor={vdc} min={0} max={vr} paso={0.1} unidad="V" />
    {:else}
      <Deslizador etiqueta="Retirar el recubrimiento" bind:valor={corte} min={0} max={1} paso={0.01} formato={(x) => pct(x, 0)} />
      <Deslizador etiqueta="Tensión aplicada" bind:valor={vdc} min={0} max={50} paso={0.5} unidad="V" />
    {/if}
  {/snippet}
  {#snippet grafica()}
    {#if modo === 'mlcc'}
      <Grafica
        titulo={`Capacidad frente a la tensión continua (${clase}, 0805)`}
        x={{ etiqueta: 'V_DC', unidad: 'V', min: 0, max: 50 }}
        y={{ etiqueta: 'C/C_nominal', unidad: '', min: 0, max: 1.05 }}
        series={[
          { x: curvas.xs, y: curvas.r[6.3]!, color: pal.hueco, nombre: '6,3 V', alfa: vr === 6.3 ? 1 : 0.45 },
          { x: curvas.xs, y: curvas.r[16]!, color: pal.acento, nombre: '16 V', alfa: vr === 16 ? 1 : 0.45 },
          { x: curvas.xs, y: curvas.r[50]!, color: pal.bien, nombre: '50 V', alfa: vr === 50 ? 1 : 0.45 },
        ]}
        puntos={[{ x: Math.min(vdc, vr), y: k, color: pal.corriente, etiqueta: pct(k, 0) }]}
      />
    {/if}
  {/snippet}
</Marco>
