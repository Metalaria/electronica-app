<script lang="ts">
  // The biased junction (book 5.2 and 5.3): the barrier V₀ − V, the depletion width, injection and
  // recombination in forward bias, leakage I_S in reverse, avalanche breakdown, and the Shockley curve
  // I = I_S·(e^(V/(n·V_T)) − 1) traced live.
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { SimUnion } from '../nucleo/union';
  import { agotamiento, v0, diodoCompleto, vt } from '../nucleo/fisica';
  import { txt, txtRico, fondo, rr, flecha, Camino, electronesEnCamino, corrienteEnCamino, limitar, type Vista } from '../nucleo/dibujo';
  import { fuente } from '../nucleo/esquema';
  import { alfa, paleta } from '../nucleo/paleta';
  import { num, si, cientifica } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  const sim = new SimUnion();
  const NA = 1e17;
  const ND = 1e16;
  const VBR = 31;

  let v = $state(0.6);
  let n = $state(1);
  let is = $state(1e-12);
  let escala = $state<'lin' | 'log'>('lin');

  const V0 = v0(NA, ND);
  const corriente = (x: number) => diodoCompleto(x, { is, n, vbr: VBR, rz: 25 });
  const i = $derived(corriente(v));
  const dep = $derived(agotamiento(NA, ND, Math.min(v, V0 - 0.02)));
  const region = $derived(v > 0.05 ? 'directa' : v > -0.05 ? 'cero' : -v < VBR - 0.3 ? 'inversa' : 'ruptura');

  // Trace of the visited points (the curve «drawn» by the reader moving the slider).
  let traza = $state.raw<[number, number][]>([]);
  $effect(() => {
    const p: [number, number] = [v, i];
    const ult = traza[traza.length - 1];
    if (!ult || Math.abs(ult[0] - p[0]) > 1e-4) traza = [...traza.slice(-400), p].sort((a, b) => a[0] - b[0]);
  });
  $effect(() => {
    void n;
    void is;
    traza = [];
  });

  let fase = 0;
  const muestreo = new Muestreo(100);
  let cuenta = $state(0);

  function geometria(vw: Vista) {
    const est = vw.w < 700;
    const x0 = est ? 40 : 70;
    const x1 = vw.w - x0;
    const y0 = est ? 150 : 128;
    const y1 = est ? 390 : 318;
    return { x0, x1, y0, y1, xj: (x0 + x1) / 2, nmU: 4000 / (x1 - x0) };
  }

  function paso(dt: number): void {
    // Event rates follow the real current, compressed logarithmically so that they stay visible.
    const ia = Math.abs(i);
    sim.inyeccion = v > 0.05 ? limitar(7 * Math.log10(Math.max(ia, 1e-9) / 1e-7), 0, 48) : 0;
    sim.generacion = v < -0.05 ? 0.7 + (region === 'ruptura' ? 30 * limitar((-v - (VBR - 2)) / 3, 0, 1) : 0) : 0;
    sim.avalancha = region === 'ruptura' ? 9 * limitar((-v - (VBR - 1)) / 2, 0, 1) : 0;
    sim.paso(dt);
    fase += dt * limitar(Math.log10(Math.max(ia, 1e-12) / 1e-9) * 22, 0, 160) * Math.sign(i || 1);
    if (muestreo.toca()) cuenta = sim.cuentaRecomb;
  }

  function dibujar(vw: Vista): void {
    const { ctx } = vw;
    const p = pal;
    fondo(vw);
    const g = geometria(vw);
    sim.configurar(g, NA, ND);
    sim.v = Math.min(v, V0 - 0.02);
    const est = vw.w < 700;

    // Contacts.
    for (const [xa, xb] of [
      [g.x0 - 16, g.x0],
      [g.x1, g.x1 + 16],
    ] as const) {
      const gr = ctx.createLinearGradient(xa, 0, xb, 0);
      gr.addColorStop(0, p.aluminio);
      gr.addColorStop(0.5, '#e4e8ec');
      gr.addColorStop(1, p.aluminio);
      ctx.fillStyle = gr;
      rr(ctx, xa, g.y0 - 4, xb - xa, g.y1 - g.y0 + 8, 3);
      ctx.fill();
    }
    txt(vw, 'ánodo', g.x0 - 8, g.y1 + 22, { tam: 12, color: p.suave });
    txt(vw, 'cátodo', g.x1 + 8, g.y1 + 22, { tam: 12, color: p.suave });

    // External circuit: a source between the contacts (forward: + on the P side).
    const yTop = est ? 62 : 52;
    const xc = vw.w / 2;
    const circuito = new Camino([
      [g.x1 + 8, g.y0 - 4],
      [g.x1 + 8, yTop],
      [xc + 26, yTop],
      [xc - 26, yTop],
      [g.x0 - 8, yTop],
      [g.x0 - 8, g.y0 - 4],
    ]);
    ctx.strokeStyle = p.hilo;
    ctx.lineWidth = 2.4;
    circuito.trazar(ctx);
    ctx.stroke();
    // Source drawn horizontally: circle with + towards the side that is positive.
    ctx.save();
    ctx.translate(xc, yTop);
    ctx.rotate(-Math.PI / 2);
    fuente(vw, 0, 0, 22, 'dc', { color: p.tinta });
    ctx.restore();
    const masIzq = v >= 0;
    txt(vw, '+', xc + (masIzq ? -36 : 36), yTop - 14, { tam: 16, peso: 700, color: p.positivo });
    txt(vw, '−', xc + (masIzq ? 36 : -36), yTop - 14, { tam: 16, peso: 700, color: p.tinta });
    txtRico(vw, `V = ${num(v, Math.abs(v) < 2 ? 3 : 1)} V`, xc, yTop + 40, { tam: 15, peso: 700, color: p.acento, fondo: alfa(p.fondo, 0.9) });

    // Current in the wires: electrons (blue) against the conventional current (amber).
    const ia = Math.abs(i);
    if (ia > 1e-9) {
      const k = limitar(Math.log10(ia / 1e-9) / 8, 0.15, 1);
      // The path runs right contact → source → left contact: forward conventional current follows it.
      electronesEnCamino(ctx, circuito, -fase, 22, 3.6, p, k);
      corrienteEnCamino(ctx, circuito, fase * 0.6, 120, p, 11, k);
      txtRico(vw, `I = ${si(i, 'A', 3)}`, xc, yTop + 66, { tam: 14, peso: 700, color: p.corriente });
    } else {
      txtRico(vw, `I = ${si(i, 'A', 3)}`, xc, yTop + 66, { tam: 14, peso: 700, color: p.suave });
    }

    sim.dibujar(vw);
    txt(vw, 'P', g.x0 + 18, g.y0 + 18, { tam: 18, peso: 800, color: alfa(p.hueco, 0.8) });
    txt(vw, 'N', g.x1 - 18, g.y0 + 18, { tam: 18, peso: 800, color: alfa(p.electron, 0.8) });

    // Barrier for the electrons (energy profile), compressed logarithmically.
    const { a, b } = sim.limites();
    const yb0 = g.y1 + (est ? 78 : 66);
    const H = est ? 110 : 96;
    const barrera = V0 - Math.min(v, V0 - 0.02) * 1;
    const barreraReal = V0 - v;
    const hb = (H * Math.log10(1 + Math.max(0.005, barrera) * 9)) / Math.log10(1 + 36 * 9);
    const yN = yb0 + H;
    const yP = yN - hb;
    ctx.strokeStyle = p.electron;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(g.x0, yP);
    ctx.lineTo(a, yP);
    const m = (a + b) / 2;
    ctx.bezierCurveTo(m, yP, m, yN, b, yN);
    ctx.lineTo(g.x1, yN);
    ctx.stroke();
    ctx.fillStyle = alfa(p.electron, 0.08);
    ctx.lineTo(g.x1, yN + 14);
    ctx.lineTo(g.x0, yN + 14);
    ctx.closePath();
    ctx.fill();
    flecha(ctx, b + 30, yN, b + 30, yP + 2, p.hueco, 1.8, 8);
    flecha(ctx, b + 30, yP, b + 30, yN - 2, p.hueco, 1.8, 8);
    txtRico(vw, `barrera V_0 − V = ${num(Math.max(0, barreraReal), barreraReal < 2 ? 3 : 1)} V`, b + 42, (yN + yP) / 2, {
      tam: 13,
      peso: 700,
      alin: 'left',
      color: p.hueco,
    });
    txt(vw, 'Energía de los electrones (escala logarítmica)', g.x0, yb0 - 4, { tam: 12, alin: 'left', color: p.suave });

    // W readout under the slab.
    txtRico(vw, `W = ${si(dep.w, 'm', 3)}`, (a + b) / 2, g.y1 + 22, { tam: 13, peso: 700, color: p.tinta, fondo: alfa(p.fondo, 0.85) });
    if (region === 'ruptura') txt(vw, 'AVALANCHA', (a + b) / 2, g.y0 - 14, { tam: 13, peso: 800, color: p.peligro });
    if (ia > 1) txt(vw, '¡Corriente destructiva para un diodo de señal!', xc, g.y0 - 14, { tam: 13, peso: 800, color: p.peligro });
  }

  // Plot.
  const rango = $derived(v > -1 ? { x0: -1, x1: 0.8 } : { x0: -36, x1: 1 });
  const curva = $derived.by(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    const N = 400;
    for (let k = 0; k <= N; k++) {
      const x = rango.x0 + ((rango.x1 - rango.x0) * k) / N;
      xs.push(x);
      const c = corriente(x);
      ys.push(escala === 'log' ? Math.abs(c) : c);
    }
    return { xs, ys };
  });
  const ejeY = $derived(
    escala === 'log'
      ? { etiqueta: '|I|', unidad: 'A', min: 1e-13, max: 1, log: true }
      : v > -1
        ? { etiqueta: 'I', unidad: 'A', min: -0.01, max: 0.12 }
        : { etiqueta: 'I', unidad: 'A', min: -0.06, max: 0.02 },
  );

  const texto = $derived.by(() => {
    const vT = vt() * 1000 * n;
    if (region === 'directa')
      return (
        `**Polarización directa:** la barrera baja de ${num(V0, 2)} V a ${num(Math.max(0, V0 - v), 2)} V y la zona de agotamiento se estrecha a ${si(dep.w, 'm', 2)}. Los portadores la cruzan, se convierten en minoritarios al otro lado y se recombinan; el circuito repone los que se pierden.\n` +
        `La corriente es exponencial: I = ${si(i, 'A', 3)}. Cada ${num(vT * Math.log(10), 1)} mV más la multiplican por diez (n = ${num(n, 2)}); no hay umbral, solo una curva muy empinada.`
      );
    if (region === 'cero')
      return 'Sin tensión aplicada la difusión y el campo se compensan: la corriente neta es cero, aunque por dentro sigan ocurriendo dos procesos iguales y opuestos.';
    if (region === 'inversa')
      return (
        `**Polarización inversa:** la barrera sube a ${num(V0 - v, 1)} V y la zona de agotamiento se ensancha a ${si(dep.w, 'm', 3)}; ningún mayoritario puede cruzarla.\n` +
        `Solo circula la corriente de saturación, ${si(-i, 'A', 2)}: los pares que la agitación térmica genera dentro de la zona son barridos por el campo. Casi no depende de la tensión, sí de la temperatura.`
      );
    return (
      `**Ruptura por avalancha:** el campo máximo, ${cientifica(dep.emax, 2)} V/m, alcanza el valor crítico del silicio (unos 3×10⁷ V/m). Los portadores barridos arrancan otros al chocar con la red, y estos a otros más.\n` +
      `La corriente se multiplica sin que la tensión suba: I = ${si(i, 'A', 3)}. Con este dopaje la ruptura llega hacia los ${VBR} V.`
    );
  });

  const lecturas = $derived([
    { e: 'Corriente I', v: si(i, 'A', 3), c: pal.corriente },
    { e: 'Barrera V_0 − V', v: `${num(Math.max(0, V0 - v), 3)} V` },
    { e: 'Anchura W', v: si(dep.w, 'm', 3) },
    { e: 'r_d = n·V_T/I', v: i > 1e-9 ? si((n * vt()) / i, 'Ω', 3) : '—' },
    { e: 'Recombinaciones', v: String(cuenta) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['hueco', 'electron', 'ionA', 'ionD', 'campoE', 'corriente', 'calor']}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 690] : [900, 540])} etiqueta="Diodo polarizado: barrera, portadores y corriente" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Tensión aplicada V" bind:valor={v} min={-35} max={0.75} paso={0.005} unidad="V" formato={(x) => `${num(x, Math.abs(x) < 2 ? 3 : 1)} V`} />
    <div class="atajos">
      <button class="boton" onclick={() => (v = 0.6)}>0,6 V</button>
      <button class="boton" onclick={() => (v = 0.7)}>0,7 V</button>
      <button class="boton" onclick={() => (v = 0)}>0 V</button>
      <button class="boton" onclick={() => (v = -10)}>−10 V</button>
      <button class="boton" onclick={() => (v = -32)}>−32 V</button>
    </div>
    <Deslizador etiqueta="Factor de idealidad n" bind:valor={n} min={1} max={2} paso={0.01} formato={(x) => num(x, 2)} />
    <Deslizador etiqueta="Corriente de saturación I_S" bind:valor={is} min={1e-15} max={1e-9} log unidad="A" />
    <Selector etiqueta="Escala de la gráfica" bind:valor={escala} opciones={[{ valor: 'lin', texto: 'Lineal' }, { valor: 'log', texto: 'Logarítmica |I|' }]} />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Curva I-V (ecuación de Shockley)"
      x={{ etiqueta: 'V', unidad: 'V', min: rango.x0, max: rango.x1 }}
      y={ejeY}
      series={[
        { x: curva.xs, y: curva.ys, color: pal.tenue, ancho: 1.4, discontinua: true },
        { x: traza.map((q) => q[0]), y: traza.map((q) => (escala === 'log' ? Math.abs(q[1]) : q[1])), color: pal.acento, ancho: 3 },
      ]}
      puntos={[{ x: v, y: escala === 'log' ? Math.max(Math.abs(i), 1e-13) : i, color: pal.corriente, etiqueta: si(i, 'A', 3) }]}
      alto={230}
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
