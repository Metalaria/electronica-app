<script lang="ts">
  // Maximum power transfer (book 22.9 and 1.5): P(R_L) = [V_Th/(R_Th + R_L)]²·R_L peaks at R_L = R_Th with
  // V_Th²/(4·R_Th), and there the efficiency is exactly 50 %: the source dissipates as much as the load.
  // The maximum is flat (half or double the load still gives 88,9 %). Book examples: the network of figure
  // 22.6 (9 V, 3 Ω → 6,75 W), the table of 22.9 (10 V, 50 Ω → 0,5 W) and section 1.5 (7,2 V, 2,4 Ω → 5,4 W).
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import Interruptor from '../../ui/Interruptor.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, brillo, type Vista } from '../../nucleo/dibujo';
  import { hilo, resistencia, fuente } from '../../nucleo/esquema';
  import { alfa, paleta, colorCalor } from '../../nucleo/paleta';
  import { si, num, pct } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, funcion, punto, guia, X, Y, type Ejes } from '../nucleo/grafica';
  import { corriente, barra } from '../nucleo/simbolos';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let VTh = $state(9);
  let RTh = $state(3);
  let RL = $state(1);
  let barrer = $state(true);
  let ejemplo = $state<'22.6' | '22.9' | '1.5' | 'libre'>('22.6');

  $effect(() => {
    if (ejemplo === '22.6') {
      VTh = 9;
      RTh = 3;
    } else if (ejemplo === '22.9') {
      VTh = 10;
      RTh = 50;
    } else if (ejemplo === '1.5') {
      VTh = 7.2;
      RTh = 2.4;
    }
  });

  // Sweep: log(R_L/R_Th) goes back and forth between −2 and +2 decades... limited to ±1,3 decades.
  let fase = 0;
  let faseI = 0;
  let n = $state(0);
  const muestreo = new Muestreo(60);
  function paso(dt: number): void {
    if (barrer) {
      fase += dt / 9;
      const r = RTh * 10 ** (1.3 * Math.sin(2 * Math.PI * fase));
      RL = Number(r.toPrecision(3));
    }
    const i = VTh / (RTh + RL);
    faseI += dt * i * 70 / (VTh / RTh);
    if (muestreo.toca()) n++;
  }

  const I = $derived(VTh / (RTh + RL));
  const PL = $derived(I * I * RL);
  const PTh = $derived(I * I * RTh);
  const Pmax = $derived((VTh * VTh) / (4 * RTh));
  const eta = $derived(RL / (RL + RTh));

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const e: Ejes = est
      ? { x: 60, y: 350, w: 510, h: 200, x0: RTh / 30, x1: RTh * 30, y0: 0, y1: 105, logX: true }
      : { x: 470, y: 50, w: 400, h: 270, x0: RTh / 30, x1: RTh * 30, y0: 0, y1: 105, logX: true };
    estatico(v, `mp:${est}:${RTh}:${p.fondo}`, (vv) => {
      panel(vv, e, { titulo: 'Potencia en la carga y rendimiento frente a R_L', ux: 'Ω', fmtY: (y) => `${num(y, 0)} %`, etX: 'R_L' });
      const xs = 40;
      const xd = est ? 330 : 330;
      const yT = 60;
      const yB = 230;
      hilo(vv, [[xs + 40, yT], [xd, yT], [xd, yB], [xs + 40, yB], [xs + 40, yT]]);
      // Curves in % of the maximum and the efficiency: they depend only on R_Th (static).
      const c = vv.ctx;
      funcion(c, e, (r) => (100 * 4 * r * RTh) / ((r + RTh) * (r + RTh)), p.corriente, 2.6);
      funcion(c, e, (r) => (100 * r) / (r + RTh), p.serie[2], 2.2);
      funcion(c, e, (r) => (100 * 4 * RTh * RTh) / ((r + RTh) * (r + RTh)), p.peligro, 1.6, 240, [5, 4]);
    });
    guia(ctx, e, 'x', RTh, alfa(p.tinta, 0.4));
    guia(ctx, e, 'y', 50, alfa(p.tinta, 0.25));
    punto(ctx, e, RL, (100 * PL) / Pmax, p.corriente, 6.5, p.fondo);
    punto(ctx, e, RL, 100 * eta, p.serie[2], 5.5, p.fondo);
    txtRico(v, 'P_L / P_máx', X(e, RTh * 0.06), Y(e, 22), { tam: 12, peso: 700, color: p.corriente, alin: 'left' });
    txtRico(v, 'rendimiento η', X(e, RTh * 3.2), Y(e, 88), { tam: 12, peso: 700, color: p.serie[2], alin: 'left' });
    txtRico(v, 'P_Th / P_máx', X(e, RTh * 0.045), Y(e, 82), { tam: 12, peso: 700, color: p.peligro, alin: 'left' });
    txtRico(v, 'R_L = R_Th', X(e, RTh) + 4, e.y + 12, { tam: 11.5, alin: 'left', color: p.suave });

    // Circuit: V_Th, R_Th (heats up), R_L (heats up), with the current.
    const xs = 80;
    const xd = 330;
    const yT = 60;
    const yB = 230;
    const ym = (yT + yB) / 2;
    const fTh = Math.min(1, PTh / Pmax / 1.8);
    const fL = Math.min(1, PL / Pmax);
    if (fTh > 0.02) brillo(ctx, 190, yT, 60, p.calor, 0.55 * fTh);
    if (fL > 0.02) brillo(ctx, xd, ym, 60, p.calor, 0.55 * fL);
    fuente(v, xs, ym, 26, 'dc');
    resistencia(v, 140, yT, 240, yT, { largo: 80, alto: 24, relleno: colorCalor(fTh * 0.8) });
    resistencia(v, xd, ym - 50, xd, ym + 50, { largo: 80, alto: 24, relleno: colorCalor(fL * 0.8) });
    txtRico(v, `V_Th = ${num(VTh, 2)} V`, xs, ym + 46, { tam: 12.5, peso: 700 });
    txtRico(v, `R_Th = ${si(RTh, 'Ω', 3)}`, 190, yT - 28, { tam: 12.5, peso: 700 });
    txtRico(v, `R_L = ${si(RL, 'Ω', 3)}`, xd - 50, ym, { tam: 12.5, peso: 700, alin: 'right', color: p.corriente });
    corriente(v, [[xs, yB], [xs, yT], [xd, yT], [xd, yB], [xs, yB]], faseI, I, 50, 11);
    // Where the power goes.
    const by = 262;
    txt(v, 'Reparto de la potencia de la fuente', 40, by, { tam: 12, peso: 700, color: p.suave, alin: 'left' });
    const tot = PL + PTh;
    const w = 290;
    barra(v, 40, by + 14, w, 18, 1, alfa(p.peligro, 0.65));
    v.ctx.fillStyle = p.corriente;
    v.ctx.fillRect(40, by + 14, w * (PL / tot), 18);
    txt(v, `carga ${pct(PL / tot, 0)}`, 44, by + 23, { tam: 11.5, peso: 700, color: '#fff', alin: 'left' });
    if (est) txt(v, `fuente ${pct(PTh / tot, 0)}`, 40 + w + 6, by + 23, { tam: 11.5, peso: 700, color: p.peligro, alin: 'left' });
    else txt(v, `R_Th ${pct(PTh / tot, 0)}`, 40 + w + 6, by + 23, { tam: 11.5, peso: 700, color: p.peligro, alin: 'left' });
  }

  const texto = $derived(
    `**Máxima transferencia:** P_L = [V_Th/(R_Th + R_L)]²·R_L es máxima cuando R_L = R_Th = ${si(RTh, 'Ω', 3)}, y vale V_Th²/(4·R_Th) = ${si(Pmax, 'W', 3)}. Ahora, con R_L = ${si(RL, 'Ω', 3)}, la carga recibe ${si(PL, 'W', 3)}, el ${pct(PL / Pmax, 1)} del máximo.\n` +
      `**El dato incómodo:** en ese punto el rendimiento es del 50 %: R_Th disipa tanto como la carga. Por eso se adapta en RF, en la entrada de un receptor o con sensores diminutos (señal escasa), y nunca en fuentes ni amplificadores de potencia, que buscan R_Th lo más baja posible. El máximo es plano: con R_L al doble se pierde un 11 % y el rendimiento sube al 67 %.`,
  );

  const lecturas = $derived([
    { e: 'Potencia en la carga', v: si(PL, 'W', 3), c: pal.corriente },
    { e: 'Potencia en R_Th', v: si(PTh, 'W', 3), c: pal.peligro },
    { e: '% del máximo', v: pct(PL / Pmax, 1), c: pal.corriente },
    { e: 'Rendimiento η', v: pct(eta, 1), c: pal.serie[2] },
    { e: 'Máximo posible', v: si(Pmax, 'W', 3) },
    { e: 'Corriente', v: si(I, 'A', 3) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['corriente', 'calor']}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 590] : [900, 360])} etiqueta="Fuente con resistencia interna y carga variable, con la curva de potencia y el rendimiento" />
  {/snippet}
  {#snippet controles()}
    <Selector
      etiqueta="Fuente"
      bind:valor={ejemplo}
      opciones={[
        { valor: '22.6', texto: 'Figura 22.6' },
        { valor: '22.9', texto: 'Tabla 22.9' },
        { valor: '1.5', texto: 'Sección 1.5' },
        { valor: 'libre', texto: 'Libre' },
      ]}
    />
    <Interruptor etiqueta="Barrer la carga automáticamente" bind:valor={barrer} />
    <Deslizador etiqueta="R_L (carga)" bind:valor={RL} min={RTh / 30} max={RTh * 30} log unidad="Ω" desactivado={barrer} />
    <Deslizador etiqueta="V_Th" bind:valor={VTh} min={1} max={24} paso={0.1} unidad="V" desactivado={ejemplo !== 'libre'} />
    <Deslizador etiqueta="R_Th" bind:valor={RTh} min={0.5} max={100} log unidad="Ω" desactivado={ejemplo !== 'libre'} />
  {/snippet}
</Marco>
