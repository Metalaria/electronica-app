<script lang="ts">
  // The MOSFET in a circuit (book 7.2, fig. 7.3, 7.5): as a switch it must sit deep in the ohmic region
  // (R_DS(on) ≈ 1/(k·V_ov): 250 mΩ at V_GS = 10 V with k = 0,5 A/V²); with too little gate drive it stays in
  // saturation, V_DS rises to volts and it overheats. As an amplifier it is biased in saturation and a small
  // gate signal moves the point along the load line (g_m = k·V_ov).
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, circulo, brillo, Camino, electronesEnCamino, corrienteEnCamino, type Vista } from '../nucleo/dibujo';
  import { hilo, resistencia, mosfetSimbolo, fuente, masa, lampara, nodo } from '../nucleo/esquema';
  import { ondasCalor } from '../nucleo/piezas';
  import { alfa, paleta } from '../nucleo/paleta';
  import { mosfet, puntoMOS, MOS_LIBRO } from '../nucleo/fisica';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  type Modo = 'interruptor' | 'amplificador';
  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  const VDD = 12;
  let modo = $state<Modo>('interruptor');
  let vg = $state(10);
  let vbias = $state(2.8);
  let amp = $state(0.2);
  const RD = $derived(modo === 'interruptor' ? 4 : 20);

  const N = 96;
  const ciclo = $derived.by(() => {
    const r: { vgs: number; id: number; vds: number; region: string }[] = [];
    for (let k = 0; k < N; k++) {
      const f = (k / N) * Math.PI * 2;
      const vgs = modo === 'interruptor' ? (k < N / 2 ? vg : 0) : vbias + amp * Math.sin(f);
      const q = puntoMOS(vgs, VDD, RD);
      r.push({ vgs, id: q.id, vds: q.vds, region: q.region });
    }
    return r;
  });
  const encendido = $derived(puntoMOS(vg, VDD, RD));
  const reposo = $derived(puntoMOS(vbias, VDD, RD));

  const familias = $derived.by(() => {
    const res: { x: number[]; y: number[] }[] = [];
    const lista = modo === 'interruptor' ? [3, 3.3, 4, 5, 6, 10] : [2.4, 2.6, 2.8, 3, 3.2, 3.4];
    for (const g of lista) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let k = 0; k <= 100; k++) {
        const x = (k / 100) * 12.5;
        xs.push(x);
        ys.push(mosfet(g, x).id);
      }
      res.push({ x: xs, y: ys });
    }
    return res;
  });

  let idx = 0;
  let idxM = $state(0);
  let t = 0;
  let fase = 0;
  const muestreo = new Muestreo(40);
  function paso(dt: number): void {
    t += dt;
    const periodo = modo === 'interruptor' ? 4 : 2.5;
    idx = Math.floor(((t / periodo) % 1) * N);
    const q = ciclo[idx] ?? ciclo[0]!;
    fase += dt * Math.min(140, 20 + q.id * 40);
    if (muestreo.toca()) idxM = idx;
  }

  function dibujar(v: Vista): void {
    void [modo, vg, vbias, amp];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const q = ciclo[idx] ?? ciclo[0]!;
    const xt = est ? 270 : 290;
    const yt = est ? 220 : 210;
    const xR = xt + 14;
    const yTop = 50;
    const yG = est ? 370 : 360;
    txtRico(v, `+${VDD} V`, xR, yTop - 16, { tam: 13, peso: 800, color: p.positivo });
    hilo(v, [
      [xR, yTop],
      [xR, yTop + 14],
    ]);
    const imax = VDD / RD;
    if (modo === 'interruptor') lampara(v, xR, yTop + 14, xR, yt - 70, Math.min(1, q.id / imax));
    else resistencia(v, xR, yTop + 14, xR, yt - 70, { largo: 56 });
    txtRico(v, modo === 'interruptor' ? `carga 4 Ω (${si(imax, 'A', 2)})` : `R_D = ${RD} Ω`, xR + 20, (yTop + yt - 56) / 2, { alin: 'left', tam: 12.5 });
    hilo(v, [
      [xR, yt - 70],
      [xR, yt - 44],
    ]);
    nodo(v, xR, yt - 56);
    hilo(v, [
      [xR, yt - 56],
      [xR + 70, yt - 56],
    ]);
    txtRico(v, `V_DS = ${num(q.vds, 2)} V`, xR + 76, yt - 56, { alin: 'left', tam: 14, peso: 800, color: p.acento });
    const m = mosfetSimbolo(v, xt, yt, { activo: Math.min(1, q.id / imax), diodoCuerpo: true });
    hilo(v, [m.s, [xR, yG]]);
    masa(v, xR, yG);
    const xs = est ? 60 : 80;
    hilo(v, [m.g, [m.g[0] - 40, m.g[1]]]);
    resistencia(v, m.g[0] - 40, m.g[1], m.g[0] - 100, m.g[1], { largo: 36, alto: 14 });
    hilo(v, [
      [m.g[0] - 100, m.g[1]],
      [xs, m.g[1]],
      [xs, m.g[1] + 30],
    ]);
    fuente(v, xs, m.g[1] + 56, 24, modo === 'amplificador' ? 'ac' : 'dc', { lado: -1 });
    hilo(v, [
      [xs, m.g[1] + 80],
      [xs, yG],
      [xR, yG],
    ]);
    txtRico(v, `V_GS = ${num(q.vgs, 2)} V`, xs + 30, m.g[1] + 56, { alin: 'left', tam: 13.5, peso: 800, color: p.acento });
    // Dissipation in the transistor.
    const pd = q.vds * q.id;
    if (pd > 1) {
      brillo(ctx, xt + 4, yt, 60, p.calor, Math.min(0.6, pd / 20));
      ondasCalor(ctx, xt - 20, xt + 30, yt - 40, Math.min(1, pd / 15), t, p.calor);
    }
    const kc = Math.min(1, q.id / Math.max(imax * 0.5, 0.1));
    if (q.id > 0.005) {
      const cc = new Camino([
        [xR, yTop],
        [xR, yG],
      ]);
      electronesEnCamino(ctx, cc, -fase, 20, 3.2, p, kc);
      corrienteEnCamino(ctx, cc, fase * 0.6, 90, p, 10, kc);
    }
    txtRico(v, `I_D = ${si(q.id, 'A', 3)}`, xR + 40, yt + 28, { alin: 'left', tam: 13.5, peso: 800, color: p.corriente });
    txtRico(v, `P_D = ${si(pd, 'W', 3)}`, xR + 40, yt + 50, { alin: 'left', tam: 13, peso: 700, color: pd > 2 ? p.peligro : p.suave });
    const reg = q.region === 'ohmica' ? 'ÓHMICA' : q.region === 'saturacion' ? 'SATURACIÓN' : 'CORTE';
    const col = q.region === 'ohmica' ? p.bien : q.region === 'saturacion' ? p.aviso : p.suave;
    rr(ctx, xt - 70, yG + 26, 140, 30, 15);
    ctx.fillStyle = alfa(col, 0.15);
    ctx.fill();
    txt(v, reg, xt, yG + 41, { tam: 14, peso: 800, color: col });
    if (!est) {
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
      const Yv = (val: number) => sy1 - 16 - (val / VDD) * (sy1 - sy0 - 50);
      const gmax = modo === 'interruptor' ? 10 : 4;
      const Yg = (val: number) => sy0 + 40 + (1 - val / gmax) * 60;
      ctx.strokeStyle = p.serie[0];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ciclo.forEach((c, k) => (k ? ctx.lineTo(X(k), Yg(c.vgs)) : ctx.moveTo(X(k), Yg(c.vgs))));
      ctx.stroke();
      ctx.strokeStyle = p.acento;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ciclo.forEach((c, k) => (k ? ctx.lineTo(X(k), Yv(c.vds)) : ctx.moveTo(X(k), Yv(c.vds))));
      ctx.stroke();
      ctx.strokeStyle = alfa(p.tinta, 0.35);
      ctx.beginPath();
      ctx.moveTo(X(idx), sy0 + 6);
      ctx.lineTo(X(idx), sy1 - 6);
      ctx.stroke();
      circulo(ctx, X(idx), Yv(q.vds), 4.5, p.acento);
      txtRico(v, 'V_GS (puerta)', sx0 + 12, sy0 + 16, { tam: 12, alin: 'left', peso: 700, color: p.serie[0] });
      txtRico(v, 'V_DS (drenador)', sx0 + 12, sy1 - 120, { tam: 12, alin: 'left', peso: 700, color: p.acento });
    }
  }

  const traza = $derived({ x: ciclo.map((c) => c.vds), y: ciclo.map((c) => c.id) });
  const actual = $derived(ciclo[idxM] ?? ciclo[0]!);

  const texto = $derived.by(() => {
    if (modo === 'interruptor') {
      const e = encendido;
      if (e.region === 'ohmica')
        return (
          `**Interruptor bien excitado:** con ${num(vg, 1)} V en la puerta (V_ov = ${num(vg - MOS_LIBRO.vth, 1)} V) el MOSFET queda en la región **óhmica**: R_DS(on) ≈ 1/(k·V_ov) = ${si(1 / (0.5 * (vg - MOS_LIBRO.vth)), 'Ω', 3)}, V_DS = ${num(e.vds, 2)} V y solo disipa ${si(e.vds * e.id, 'W', 3)} con ${si(e.id, 'A', 3)}.\n` +
          'Por eso la puerta se lleva a la tensión más alta disponible: más V_ov es menos resistencia y menos pérdida.'
        );
      return (
        `**Puerta insuficiente:** con ${num(vg, 1)} V la corriente que el canal admite (½·k·V_ov² = ${si(0.5 * 0.5 * Math.max(0, vg - 2) ** 2, 'A', 2)}) es menor que la que pide la carga: el MOSFET se queda en **saturación**, V_DS sube a ${num(e.vds, 1)} V y disipa ${si(e.vds * e.id, 'W', 3)}.\n` +
        'Es el fallo típico al gobernar un MOSFET estándar desde la salida de 3,3 V de un microcontrolador: hace falta uno de nivel lógico o un driver.'
      );
    }
    const gm = 0.5 * Math.max(0, vbias - MOS_LIBRO.vth);
    const vmin = Math.min(...ciclo.map((c) => c.vds));
    const vmax = Math.max(...ciclo.map((c) => c.vds));
    return (
      `**Amplificador:** polarizado en **saturación** (I_D = ${si(reposo.id, 'A', 3)}, V_DS = ${num(reposo.vds, 2)} V), la corriente solo depende de la puerta. La transconductancia es g_m = k·V_ov = ${si(gm, 'S', 3)} y la ganancia, −g_m·R_D ≈ ${num(-gm * RD, 1)}.\n` +
      `La salida va de ${num(vmin, 2)} a ${num(vmax, 2)} V, invertida; ` +
      (vmin < 0.5 || ciclo.some((c) => c.region !== 'saturacion') ? 'el punto sale de la saturación y la onda se deforma.' : 'la ley cuadrática ya la deforma algo: el semiciclo que sube la corriente crece más que el otro.')
    );
  });

  const lecturas = $derived([
    { e: 'V_GS', v: `${num(actual.vgs, 2)} V` },
    { e: 'I_D', v: si(actual.id, 'A', 3), c: pal.corriente },
    { e: 'V_DS', v: `${num(actual.vds, 2)} V`, c: pal.acento },
    { e: 'Disipación', v: si(actual.vds * actual.id, 'W', 3) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron', 'corriente', 'calor']}>
  {#snippet modos()}
    <Selector bind:valor={modo} opciones={[{ valor: 'interruptor', texto: 'Interruptor' }, { valor: 'amplificador', texto: 'Amplificador' }]} />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 460] : [900, 440])} etiqueta="MOSFET gobernando una carga" />
  {/snippet}
  {#snippet controles()}
    {#if modo === 'interruptor'}
      <Deslizador etiqueta="Tensión de puerta en encendido" bind:valor={vg} min={2} max={12} paso={0.1} unidad="V" />
      <div class="atajos">
        <button class="boton" onclick={() => (vg = 3.3)}>3,3 V (microcontrolador)</button>
        <button class="boton" onclick={() => (vg = 5)}>5 V</button>
        <button class="boton" onclick={() => (vg = 10)}>10 V (driver)</button>
      </div>
    {:else}
      <Deslizador etiqueta="Polarización de puerta" bind:valor={vbias} min={2} max={3.6} paso={0.01} unidad="V" />
      <Deslizador etiqueta="Amplitud de la señal" bind:valor={amp} min={0} max={0.6} paso={0.01} unidad="V" />
    {/if}
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Curvas de salida, recta de carga y punto de trabajo"
      x={{ etiqueta: 'V_DS', unidad: 'V', min: 0, max: 12.5 }}
      y={{ etiqueta: 'I_D', unidad: 'A', min: 0, max: modo === 'interruptor' ? 3.4 : 0.7 }}
      series={[
        ...familias.map((f) => ({ x: f.x, y: f.y, color: pal.tenue, ancho: 1.3 })),
        { x: [0, VDD], y: [VDD / RD, 0], color: pal.hueco, discontinua: true, ancho: 1.8, nombre: 'recta de carga' },
        { x: traza.x, y: traza.y, color: pal.acento, ancho: 4, alfa: 0.5 },
      ]}
      puntos={[{ x: actual.vds, y: actual.id, color: pal.corriente, etiqueta: 'Q' }]}
      alto={250}
    />
  {/snippet}
</Marco>

<style>
  .atajos {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: -6px;
  }
  .atajos .boton {
    min-height: 30px;
    padding: 0 10px;
    font-size: 13px;
  }
</style>
