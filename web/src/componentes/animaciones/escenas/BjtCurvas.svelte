<script lang="ts">
  // Regions of the BJT (book 6.2, 6.5, 6.7, 25.3): output characteristics I_C(V_CE) for several I_B (simplified
  // Ebers-Moll with Early effect), the load line V_CE = V_CC − I_C·R_C and the operating point. As an amplifier
  // a small signal moves it along the line (and clips when it reaches cut-off or saturation); as a switch it
  // jumps between cut-off and saturation. Book example: 12 V, R_C = 1 kΩ, base from 5 V, β = 100.
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, circulo, Camino, electronesEnCamino, corrienteEnCamino, type Vista } from '../nucleo/dibujo';
  import { hilo, resistencia, bjt, fuente, masa, lampara, nodo } from '../nucleo/esquema';
  import { alfa, paleta } from '../nucleo/paleta';
  import { icDeIb, puntoBJT } from '../nucleo/fisica';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  type Modo = 'punto' | 'amplificador' | 'interruptor';
  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  const VCC = 12;
  const RC = 1000;
  let modo = $state<Modo>('punto');
  let RB = $state(100e3);
  let VBB = $state(5);
  let amp = $state(1);

  const N = 96;
  // Base drive over one period for the current mode.
  const ciclo = $derived.by(() => {
    const r: { vbb: number; ib: number; ic: number; vce: number }[] = [];
    for (let k = 0; k < N; k++) {
      const fase = (k / N) * Math.PI * 2;
      const vb =
        modo === 'punto' ? VBB : modo === 'amplificador' ? VBB + amp * Math.sin(fase) : k < N / 2 ? 5 : 0;
      const q = puntoBJT(vb, RB, VCC, RC);
      r.push({ vbb: vb, ib: q.ib, ic: q.ic, vce: q.vce });
      if (modo === 'punto') {
        while (r.length < N) r.push(r[0]!);
        break;
      }
    }
    return r;
  });
  const reposo = $derived(puntoBJT(VBB, RB, VCC, RC));

  const familias = $derived.by(() => {
    const res: { x: number[]; y: number[]; ib: number }[] = [];
    for (const ib of [10e-6, 20e-6, 30e-6, 40e-6, 50e-6, 60e-6, 80e-6, 100e-6]) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let k = 0; k <= 80; k++) {
        const vce = (k / 80) * VCC * 1.05;
        xs.push(vce);
        ys.push(icDeIb(ib, vce).ic);
      }
      res.push({ x: xs, y: ys, ib });
    }
    return res;
  });

  let idx = 0;
  let idxMostrado = $state(0);
  let fase = 0;
  let t = 0;
  const muestreo = new Muestreo(40);
  function paso(dt: number): void {
    t += dt;
    const periodo = modo === 'interruptor' ? 4 : 2.5;
    idx = Math.floor(((t / periodo) % 1) * N);
    const q = ciclo[idx] ?? ciclo[0]!;
    fase += dt * Math.min(140, 20 + q.ic * 9000);
    if (muestreo.toca()) idxMostrado = idx;
  }

  function region(ic: number, vce: number, ib: number): 'corte' | 'activa' | 'saturacion' {
    if (ib < 0.3e-6 || ic < 5e-6) return 'corte';
    if (vce < 0.35) return 'saturacion';
    return 'activa';
  }

  function dibujar(v: Vista): void {
    void [modo, RB, VBB, amp];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const q = ciclo[idx] ?? ciclo[0]!;
    const reg = region(q.ic, q.vce, q.ib);
    const xt = est ? 280 : 300;
    const yt = est ? 220 : 210;
    const xRail = xt + 14;
    const yTop = 50;
    const yGnd = est ? 370 : 360;
    // Collector branch: V_CC → R_C (or a lamp in switch mode) → collector.
    txtRico(v, `+${VCC} V`, xRail, yTop - 16, { tam: 13, peso: 800, color: p.positivo });
    hilo(v, [
      [xRail, yTop],
      [xRail, yTop + 14],
    ]);
    if (modo === 'interruptor') lampara(v, xRail, yTop + 14, xRail, yt - 70, Math.min(1, q.ic / 0.0118));
    else resistencia(v, xRail, yTop + 14, xRail, yt - 70, { largo: 56 });
    txtRico(v, modo === 'interruptor' ? 'lámpara ≈ 1 kΩ' : `R_C = 1 kΩ`, xRail + 18, (yTop + yt - 56) / 2, { alin: 'left', tam: 12.5 });
    hilo(v, [
      [xRail, yt - 70],
      [xRail, yt - 44],
    ]);
    nodo(v, xRail, yt - 56);
    hilo(v, [
      [xRail, yt - 56],
      [xRail + 80, yt - 56],
    ]);
    txtRico(v, `V_CE = ${num(q.vce, 2)} V`, xRail + 86, yt - 56, { alin: 'left', tam: 14, peso: 800, color: p.acento });
    const t3 = bjt(v, xt, yt, { activo: reg === 'corte' ? 0 : Math.min(1, q.ic / 0.012) });
    hilo(v, [t3.e, [xRail, yGnd]]);
    masa(v, xRail, yGnd);
    // Base drive.
    const xs = est ? 60 : 80;
    resistencia(v, t3.b[0] - 20, yt, t3.b[0] - 100, yt, { largo: 50 });
    hilo(v, [t3.b, [t3.b[0] - 20, yt]]);
    hilo(v, [
      [t3.b[0] - 100, yt],
      [xs, yt],
      [xs, yt + 30],
    ]);
    fuente(v, xs, yt + 56, 24, modo === 'amplificador' ? 'ac' : 'dc', { lado: -1 });
    hilo(v, [
      [xs, yt + 80],
      [xs, yGnd],
      [xRail, yGnd],
    ]);
    txtRico(v, `R_B = ${si(RB, 'Ω', 2)}`, t3.b[0] - 60, yt - 22, { tam: 12.5 });
    txtRico(v, `${num(q.vbb, 2)} V`, xs + 30, yt + 56, { alin: 'left', tam: 13, peso: 700, color: p.acento });
    // Currents.
    const kc = Math.min(1, q.ic / 0.006);
    if (kc > 0.02) {
      const cc = new Camino([
        [xRail, yTop],
        [xRail, yGnd],
      ]);
      electronesEnCamino(ctx, cc, -fase, 20, 3.2, p, kc);
      corrienteEnCamino(ctx, cc, fase * 0.6, 90, p, 10, kc);
      const cb = new Camino([
        [xs, yt + 30],
        [xs, yt],
        t3.b,
      ]);
      corrienteEnCamino(ctx, cb, fase * 0.3, 90, p, 8, Math.min(1, q.ib / 50e-6));
    }
    txtRico(v, `I_C = ${si(q.ic, 'A', 3)}`, xRail + 18, yt + 26, { alin: 'left', tam: 13.5, peso: 800, color: p.corriente });
    txtRico(v, `I_B = ${si(q.ib, 'A', 3)}`, t3.b[0] - 60, yt + 22, { tam: 13, peso: 700, color: p.corriente });
    // Region badge.
    const col = reg === 'corte' ? p.suave : reg === 'activa' ? p.bien : p.aviso;
    const nombre = reg === 'corte' ? 'CORTE' : reg === 'activa' ? 'ACTIVA' : 'SATURACIÓN';
    rr(ctx, xt - 70, yGnd + 26, 140, 30, 15);
    ctx.fillStyle = alfa(col, 0.15);
    ctx.fill();
    txt(v, nombre, xt, yGnd + 41, { tam: 14, peso: 800, color: col });
    // Scope: input drive and V_CE over the period.
    if (!est && modo !== 'punto') {
      const sx0 = 560;
      const sx1 = v.w - 24;
      const sy0 = 50;
      const sy1 = 330;
      rr(ctx, sx0, sy0, sx1 - sx0, sy1 - sy0, 10);
      ctx.fillStyle = p.panel;
      ctx.fill();
      ctx.strokeStyle = p.linea;
      ctx.stroke();
      const X = (k: number) => sx0 + 10 + (k / (N - 1)) * (sx1 - sx0 - 20);
      const Yv = (val: number) => sy1 - 16 - (val / VCC) * (sy1 - sy0 - 50);
      const Yb = (val: number) => sy0 + 40 + (1 - val / 6) * 60;
      ctx.strokeStyle = p.serie[0];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ciclo.forEach((c2, k) => (k ? ctx.lineTo(X(k), Yb(c2.vbb)) : ctx.moveTo(X(k), Yb(c2.vbb))));
      ctx.stroke();
      ctx.strokeStyle = p.acento;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ciclo.forEach((c2, k) => (k ? ctx.lineTo(X(k), Yv(c2.vce)) : ctx.moveTo(X(k), Yv(c2.vce))));
      ctx.stroke();
      ctx.strokeStyle = alfa(p.tinta, 0.35);
      ctx.beginPath();
      ctx.moveTo(X(idx), sy0 + 6);
      ctx.lineTo(X(idx), sy1 - 6);
      ctx.stroke();
      circulo(ctx, X(idx), Yv(q.vce), 4.5, p.acento);
      txtRico(v, 'entrada (base)', sx0 + 12, sy0 + 16, { tam: 12, alin: 'left', peso: 700, color: p.serie[0] });
      txtRico(v, 'V_CE (salida)', sx0 + 12, sy1 - 110, { tam: 12, alin: 'left', peso: 700, color: p.acento });
    }
  }

  const traza = $derived({ x: ciclo.map((c) => c.vce), y: ciclo.map((c) => c.ic) });
  const actual = $derived(ciclo[idxMostrado] ?? ciclo[0]!);

  const texto = $derived.by(() => {
    if (modo === 'interruptor')
      return (
        `**Interruptor:** con 0 V en la base el transistor está en **corte** (V_CE ≈ 12 V, la lámpara apagada). Con 5 V y R_B = ${si(RB, 'Ω', 2)}, I_B = ${si((5 - 0.7) / RB, 'A', 2)}: β·I_B pediría ${si((100 * 4.3) / RB, 'A', 2)}, pero la carga solo admite unos 11,8 mA, así que ${(100 * 4.3) / RB > 0.0118 ? `**satura** (V_CE ≈ ${num(puntoBJT(5, RB, VCC, RC).vce, 2)} V). Factor de saturación forzada: ${num((100 * 4.3) / RB / 0.0118, 1)}.` : 'se queda en activa: no satura y disipa mucho. Hace falta más corriente de base.'}\n` +
        'Los puntos de trabajo del interruptor son los dos extremos de la recta de carga; el tránsito entre ellos es donde disipa.'
      );
    const r = region(reposo.ic, reposo.vce, reposo.ib);
    const base =
      r === 'activa'
        ? `**Activa:** I_B = ${si(reposo.ib, 'A', 3)} y I_C ≈ β·I_B = ${si(reposo.ic, 'A', 3)}; V_CE = 12 − I_C·R_C = ${num(reposo.vce, 2)} V, en la recta de carga.`
        : r === 'saturacion'
          ? `**Saturación:** β·I_B pediría más corriente de la que cabe por R_C; V_CE cae a ${num(reposo.vce, 2)} V y I_C = ${si(reposo.ic, 'A', 3)} ya no depende de β.`
          : '**Corte:** sin corriente de base no hay inyección: I_C ≈ 0 y V_CE = V_CC.';
    if (modo === 'amplificador') {
      const vmax = Math.max(...ciclo.map((c) => c.vce));
      const vmin = Math.min(...ciclo.map((c) => c.vce));
      const recorta = vmin < 0.4 || vmax > VCC - 0.2;
      return (
        base +
        `\n**Amplificador:** la señal mueve el punto arriba y abajo **a lo largo de la recta de carga**: la salida va de ${num(vmin, 2)} a ${num(vmax, 2)} V, invertida. ` +
        (recorta ? 'El punto toca la saturación o el corte y la salida **se recorta**: hay que centrar la polarización o reducir la señal.' : 'Sin recorte: el punto no llega a los extremos.')
      );
    }
    return base + '\nMueva la tensión de base o R_B para recorrer las tres regiones.';
  });

  const lecturas = $derived([
    { e: 'I_B', v: si(actual.ib, 'A', 3) },
    { e: 'I_C', v: si(actual.ic, 'A', 3), c: pal.corriente },
    { e: 'V_CE', v: `${num(actual.vce, 2)} V`, c: pal.acento },
    { e: 'I_C / I_B', v: actual.ib > 1e-7 ? num(actual.ic / actual.ib, 0) : '—' },
    { e: 'Disipación V_CE·I_C', v: si(actual.vce * actual.ic, 'W', 3) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron', 'corriente']}>
  {#snippet modos()}
    <Selector
      bind:valor={modo}
      opciones={[
        { valor: 'punto', texto: 'Punto de trabajo' },
        { valor: 'amplificador', texto: 'Amplificador' },
        { valor: 'interruptor', texto: 'Interruptor' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 460] : [900, 440])} etiqueta="Etapa de emisor común con su punto de trabajo" />
  {/snippet}
  {#snippet controles()}
    <Selector
      etiqueta="Resistencia de base R_B"
      bind:valor={RB}
      opciones={[
        { valor: 100e3, texto: '100 kΩ' },
        { valor: 47e3, texto: '47 kΩ' },
        { valor: 22e3, texto: '22 kΩ' },
        { valor: 10e3, texto: '10 kΩ' },
      ]}
    />
    {#if modo !== 'interruptor'}
      <Deslizador etiqueta="Tensión de base (continua)" bind:valor={VBB} min={0} max={8} paso={0.05} unidad="V" />
    {/if}
    {#if modo === 'amplificador'}
      <Deslizador etiqueta="Amplitud de la señal" bind:valor={amp} min={0} max={4} paso={0.05} unidad="V" />
    {/if}
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Curvas de salida, recta de carga y punto de trabajo"
      x={{ etiqueta: 'V_CE', unidad: 'V', min: 0, max: 12.6 }}
      y={{ etiqueta: 'I_C', unidad: 'A', min: 0, max: 0.013 }}
      zonas={[
        { x0: 0, x1: 0.35, color: pal.aviso, etiqueta: 'sat.' },
        { x0: 0.35, x1: 12.6, y0: 0, y1: 0.00025, color: pal.suave },
      ]}
      series={[
        ...familias.map((f) => ({ x: f.x, y: f.y, color: pal.tenue, ancho: 1.3 })),
        { x: [0, VCC], y: [VCC / RC, 0], color: pal.hueco, ancho: 1.8, discontinua: true, nombre: 'recta de carga' },
        ...(modo !== 'punto' ? [{ x: traza.x, y: traza.y, color: pal.acento, ancho: 4, alfa: 0.5 }] : []),
      ]}
      puntos={[{ x: actual.vce, y: actual.ic, color: pal.corriente, etiqueta: 'Q' }]}
      alto={250}
    />
  {/snippet}
</Marco>
