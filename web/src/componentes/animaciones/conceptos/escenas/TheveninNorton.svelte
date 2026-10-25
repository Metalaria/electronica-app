<script lang="ts">
  // Thévenin and Norton (book 22.6, 22.7, 1.5): the network of figure 22.6 (12 V, R₁ = 4 Ω in series and
  // R₂ = 12 Ω across the terminals) next to its two equivalents, all three with the same load. The load sees
  // the same voltage and current in the three: they are the same straight line V = V_Th − R_Th·I, which the
  // plot draws with the load line through the origin. The book's bench method R_Th = R_L·(V_vacío/V_carga − 1)
  // is computed from the two readings.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, type Vista } from '../../nucleo/dibujo';
  import { hilo, resistencia, fuente, terminal } from '../../nucleo/esquema';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, punto, X, Y, type Ejes } from '../nucleo/grafica';
  import { fuenteCorriente, corriente, chapa } from '../nucleo/simbolos';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let V = $state(12);
  let R1 = $state(4);
  let R2 = $state(12);
  let RL = $state(6);
  let carga = $state<'r' | 'vacio' | 'corto'>('r');

  const th = $derived({ vth: (V * R2) / (R1 + R2), rth: (R1 * R2) / (R1 + R2) });
  const IN = $derived(th.vth / th.rth);
  // Load point (vacío: open circuit; corto: short circuit).
  const op = $derived.by(() => {
    if (carga === 'vacio') return { vl: th.vth, il: 0 };
    if (carga === 'corto') return { vl: 0, il: IN };
    const il = th.vth / (th.rth + RL);
    return { vl: il * RL, il };
  });
  // Inside the original network.
  const red = $derived({ i1: (V - op.vl) / R1, i2: op.vl / R2 });

  const fases = { a: 0, b: 0, c: 0, d: 0, e: 0 };
  let tMostrado = $state(0);
  const muestreo = new Muestreo(100);
  function paso(dt: number): void {
    const k = 60 / Math.max(IN, V / R1, 1e-9);
    fases.a += dt * Math.abs(red.i1) * k;
    fases.b += dt * Math.abs(red.i2) * k;
    fases.c += dt * Math.abs(op.il) * k;
    fases.d += dt * IN * k;
    fases.e += dt * Math.abs(op.vl / th.rth) * k;
    if (muestreo.toca()) tMostrado++;
  }

  /** One small circuit in a 200 × 190 local frame. */
  function circuito(v: Vista, tipo: 'red' | 'th' | 'n', ox: number, oy: number, k: number): void {
    const { ctx } = v;
    const p = pal;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    const yT = 40;
    const yB = 160;
    const ym = (yT + yB) / 2;
    const xS = 30;
    const xT = 150;
    const xL = 182;
    const titulo = v.estrecho ? (tipo === 'red' ? 'Red original' : tipo === 'th' ? 'Thévenin' : 'Norton') : tipo === 'red' ? 'Red original' : tipo === 'th' ? 'Equivalente de Thévenin' : 'Equivalente de Norton';
    txt(v, titulo, 100, 7, { tam: 12.5, peso: 700, color: p.suave });
    // Wires.
    hilo(v, [[xS, yT], [xL, yT]]);
    hilo(v, [[xS, yB], [xL, yB]]);
    hilo(v, [[xS, yT], [xS, yB]]);
    hilo(v, [[xL, yT], [xL, yB]]);
    if (tipo === 'red') {
      fuente(v, xS, ym, 17, 'dc');
      resistencia(v, 50, yT, 110, yT, { largo: 40, alto: 14 });
      hilo(v, [[115, yT], [115, yB]]);
      resistencia(v, 115, ym - 30, 115, ym + 30, { largo: 40, alto: 14 });
      txtRico(v, `${num(V, 1)} V`, xS + 22, ym, { tam: 11.5, alin: 'left', color: p.suave });
      txtRico(v, `R_1 ${num(R1, 1)} Ω`, 80, yT - 14, { tam: 11.5 });
      txtRico(v, `R_2 ${num(R2, 1)} Ω`, 112, yB + 15, { tam: 11.5 });
      corriente(v, [[xS, yB], [xS, yT], [115, yT]], fases.a, red.i1, 34, 8);
      corriente(v, [[115, yT], [115, yB]], fases.b, red.i2, 34, 8);
    } else if (tipo === 'th') {
      fuente(v, xS, ym, 17, 'dc', { color: p.acento });
      resistencia(v, 55, yT, 125, yT, { largo: 40, alto: 14, color: p.acento });
      txtRico(v, `V_Th ${num(th.vth, 2)} V`, xS + 22, ym, { tam: 11.5, alin: 'left', color: p.acento, peso: 700 });
      txtRico(v, `R_Th ${num(th.rth, 2)} Ω`, 90, yT - 14, { tam: 11.5, color: p.acento, peso: 700 });
      corriente(v, [[xS, yB], [xS, yT], [xT, yT]], fases.c, op.il, 34, 8);
    } else {
      fuenteCorriente(v, xS, ym, 17, p.serie[2]);
      hilo(v, [[95, yT], [95, yB]]);
      resistencia(v, 95, ym - 30, 95, ym + 30, { largo: 40, alto: 14, color: p.serie[2] });
      txtRico(v, `I_N ${si(IN, 'A', 3)}`, xS + 22, yB + 15, { tam: 11.5, alin: 'center', color: p.serie[2], peso: 700 });
      txtRico(v, `R_N ${num(th.rth, 2)} Ω`, 100, yT - 14, { tam: 11.5, color: p.serie[2], peso: 700 });
      corriente(v, [[xS, yB], [xS, yT], [95, yT]], fases.d, IN, 34, 8);
      corriente(v, [[95, yT], [95, yB]], fases.e, op.vl / th.rth, 34, 8);
    }
    // Terminals and load.
    ctx.fillStyle = p.fondo;
    ctx.fillRect(xT - 6, yT - 3, 12, 6);
    terminal(v, xT, yT);
    terminal(v, xT, yB);
    if (carga === 'vacio') {
      ctx.fillStyle = p.fondo;
      ctx.fillRect(xT + 6, yT - 3, 40, 6);
      ctx.fillRect(xT + 6, yB - 3, 40, 6);
      ctx.fillRect(xL - 3, yT - 3, 6, yB - yT + 6);
      txt(v, 'vacío', xL - 4, ym, { tam: 11, color: p.suave, rot: -Math.PI / 2 });
    } else if (carga === 'r') {
      resistencia(v, xL, ym - 30, xL, ym + 30, { largo: 40, alto: 14, relleno: alfa(p.corriente, 0.15) });
      corriente(v, [[xT, yT], [xL, yT], [xL, yB], [xT, yB]], fases.c, op.il, 30, 8);
    } else {
      txt(v, 'corto', xL + 10, ym, { tam: 11, color: p.suave, rot: -Math.PI / 2 });
      corriente(v, [[xT, yT], [xL, yT], [xL, yB], [xT, yB]], fases.c, op.il, 30, 8);
    }
    chapa(v, `${num(op.vl, 2)} V · ${si(op.il, 'A', 3)}`, 100, yB + 36, p.corriente, 11.5);
    ctx.restore();
  }

  function dibujar(v: Vista): void {
    void tMostrado;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const k = v.w / 3 / 205;
    const altoC = 215 * k;
    const vmax = Math.max(th.vth, 0.1) * 1.15;
    const imax = Math.max(IN, 0.01) * 1.15;
    const e: Ejes = { x: 64, y: altoC + 40, w: v.w - 100, h: v.h - altoC - 80, x0: 0, x1: imax, y0: 0, y1: vmax };
    estatico(v, `tn:${est}:${vmax.toFixed(4)}:${imax.toFixed(4)}`, (vv) => {
      panel(vv, e, { titulo: 'Recta tensión–corriente en los terminales', ux: 'A', uy: 'V', etX: 'I', etY: 'V' });
    });
    circuito(v, 'red', 0, 0, k);
    circuito(v, 'th', v.w / 3, 0, k);
    circuito(v, 'n', (2 * v.w) / 3, 0, k);
    // Separators.
    ctx.strokeStyle = p.rejilla;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(v.w / 3, 10);
    ctx.lineTo(v.w / 3, altoC);
    ctx.moveTo((2 * v.w) / 3, 10);
    ctx.lineTo((2 * v.w) / 3, altoC);
    ctx.stroke();

    // V–I line, load line and the operating point.
    curva(ctx, e, [0, IN], [th.vth, 0], p.acento, 2.6);
    if (carga === 'r') curva(ctx, e, [0, imax], [0, imax * RL], alfa(p.corriente, 0.8), 1.8, [6, 5]);
    punto(ctx, e, 0, th.vth, p.acento, 5);
    punto(ctx, e, IN, 0, p.serie[2], 5);
    punto(ctx, e, op.il, op.vl, p.corriente, 7, p.fondo);
    txtRico(v, `vacío: V_Th = ${num(th.vth, 2)} V`, X(e, 0) + 24, Y(e, th.vth) - 12, { tam: 12, peso: 700, color: p.acento, alin: 'left' });
    txtRico(v, `cortocircuito: I_N = ${si(IN, 'A', 3)}`, X(e, IN) - 6, Y(e, 0) - 14, { tam: 12, peso: 700, color: p.serie[2], alin: 'right' });
    txtRico(v, `pendiente −R_Th = −${num(th.rth, 2)} Ω`, X(e, IN / 2) + 14, Y(e, th.vth / 2) + 4, { tam: 12, color: p.acento, alin: 'left' });
    const xo = X(e, op.il);
    const yo = Y(e, op.vl);
    if (carga === 'r')
      txtRico(v, `R_L = ${si(RL, 'Ω', 3)}`, Math.min(xo + 12, e.x + e.w - 70), Math.max(yo - 14, e.y + 10), { tam: 12, peso: 700, color: p.corriente, alin: 'left' });
  }

  const vacioMedido = $derived(th.vth);
  const rthMedida = $derived(carga === 'r' && op.vl > 0 ? RL * (vacioMedido / op.vl - 1) : NaN);

  const texto = $derived(
    `**Cualquier red lineal**, vista desde dos terminales, es una fuente con una resistencia. Thévenin: V_Th = ${num(V, 1)} × ${num(R2, 1)}/(${num(R1, 1)} + ${num(R2, 1)}) = ${num(th.vth, 2)} V en vacío y R_Th = R_1 ‖ R_2 = ${num(th.rth, 2)} Ω con la fuente anulada. Norton: la corriente de cortocircuito, I_N = ${num(th.vth, 2)}/${num(th.rth, 2)} = ${si(IN, 'A', 3)}, con la misma resistencia en paralelo.\n` +
      `Las tres cajas dan a la carga **lo mismo**: ${num(op.vl, 3)} V y ${si(op.il, 'A', 4)}. Son dos puntos (vacío y cortocircuito) de la misma recta, y ninguna medida en los terminales distingue lo que hay dentro.` +
      (carga === 'r' ? `\nEn el banco, sin conocer la red: R_Th = R_L·(V_vacío/V_carga − 1) = ${num(RL, 2)} × (${num(vacioMedido, 3)}/${num(op.vl, 3)} − 1) = ${num(rthMedida, 3)} Ω.` : ''),
  );

  const lecturas = $derived([
    { e: 'V_Th (vacío)', v: si(th.vth, 'V', 4), c: pal.acento },
    { e: 'R_Th = R_N', v: si(th.rth, 'Ω', 4), c: pal.acento },
    { e: 'I_N (cortocircuito)', v: si(IN, 'A', 4), c: pal.serie[2] },
    { e: 'Tensión en la carga', v: si(op.vl, 'V', 4), c: pal.corriente },
    { e: 'Corriente en la carga', v: si(op.il, 'A', 4), c: pal.corriente },
    { e: 'Potencia en la red original', v: si(red.i1 * red.i1 * R1 + red.i2 * red.i2 * R2, 'W', 3) },
    { e: 'Potencia en R_Th', v: si(op.il * op.il * th.rth, 'W', 3) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['corriente']}>
  {#snippet modos()}
    <Selector
      etiqueta="Carga en los terminales"
      bind:valor={carga}
      opciones={[
        { valor: 'r', texto: 'Resistencia R_L' },
        { valor: 'vacio', texto: 'Vacío' },
        { valor: 'corto', texto: 'Cortocircuito' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [620, 520] : [900, 520])} etiqueta="Red lineal y sus equivalentes de Thévenin y Norton con la misma carga" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="R_L (carga)" bind:valor={RL} min={0.5} max={200} log unidad="Ω" desactivado={carga !== 'r'} />
    <Deslizador etiqueta="Fuente V" bind:valor={V} min={1} max={24} paso={0.5} unidad="V" />
    <Deslizador etiqueta="R_1 (serie)" bind:valor={R1} min={0.5} max={50} log unidad="Ω" />
    <Deslizador etiqueta="R_2 (entre terminales)" bind:valor={R2} min={0.5} max={50} log unidad="Ω" />
    <p class="nota">La sección 1.5 usa la misma red con R₂ = 6 Ω: V<sub>Th</sub> = 7,2 V y R<sub>Th</sub> = 2,4 Ω.</p>
  {/snippet}
</Marco>

<style>
  .nota {
    margin: 0;
    font-size: 13.5px;
    color: var(--tinta-suave);
  }
</style>
