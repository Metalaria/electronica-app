<script lang="ts">
  // RC charge and discharge (book 3.2, fig. 3.4): v_C(t) = V_CC·(1 − e^(−t/RC)) and V₀·e^(−t/RC), traced live
  // with the milestones at 1τ (63,2 %), 2τ (86,5 %), 3τ (95 %) and 5τ (99,3 %). Book example: 10 kΩ, 100 µF, 9 V.
  import { untrack } from 'svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Interruptor from '../ui/Interruptor.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, Camino, electronesEnCamino, corrienteEnCamino, type Vista } from '../nucleo/dibujo';
  import { bateria, hilo, resistencia, condensador, nodo } from '../nucleo/esquema';
  import { alfa, paleta } from '../nucleo/paleta';
  import { si, num, pct } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let R = $state(10e3);
  let C = $state(100e-6);
  let VCC = $state(9);
  let cargando = $state(true);
  let auto = $state(true);
  const tau = $derived(R * C);

  // Dimensionless time since the last switching (in units of τ): one τ lasts 1 s on screen at 1×.
  let u = 0;
  let v0 = 0;
  let vc = 0;
  let fase = 0;
  let traza = $state.raw<{ t: number[]; v: number[] }>({ t: [], v: [] });
  let vcMostrada = $state(0);
  let uMostrada = $state(0);
  const muestreo = new Muestreo(50);
  let tt: number[] = [];
  let vv: number[] = [];

  function conmutar(a: boolean): void {
    cargando = a;
  }
  // Every switching restarts the clock from the present voltage.
  $effect(() => {
    void cargando;
    untrack(() => {
      v0 = vc;
      u = 0;
      tt = [0];
      vv = [vc];
      traza = { t: tt.slice(), v: vv.slice() };
    });
  });
  $effect(() => {
    if (reloj.reinicios > 0)
      untrack(() => {
        vc = 0;
        v0 = 0;
        u = 0;
        cargando = true;
        tt = [0];
        vv = [0];
      });
  });

  function paso(dt: number): void {
    u += dt;
    const fin = cargando ? VCC : 0;
    vc = fin + (v0 - fin) * Math.exp(-u);
    const i = (cargando ? VCC - vc : -vc) / R;
    // Each loop path is drawn in the direction of its conventional current.
    fase += dt * 90 * Math.min(1, Math.abs(i * R) / VCC + 0.02);
    if (u < 7.5) {
      tt.push(u * tau);
      vv.push(vc);
    }
    if (auto && u > 6) conmutar(!cargando);
    if (muestreo.toca()) {
      traza = { t: tt.slice(), v: vv.slice() };
      vcMostrada = vc;
      uMostrada = u;
    }
  }

  function dibujar(v: Vista): void {
    void [R, C, VCC, cargando];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const xB = est ? 70 : 100;
    const xS = est ? 150 : 200;
    const xC = est ? 360 : 470;
    const yT = est ? 80 : 60;
    const yB = est ? 320 : 300;
    const ym = (yT + yB) / 2;
    const i = (cargando ? VCC - vc : -vc) / R;

    // Battery branch.
    hilo(v, [
      [xB, ym - 26],
      [xB, yT],
      [xS - 30, yT],
    ]);
    bateria(v, xB, ym - 26, xB, ym + 26, {});
    hilo(v, [
      [xB, ym + 26],
      [xB, yB],
      [xC, yB],
      [xC, ym + 14],
    ]);
    if (est) {
      txtRico(v, 'V_CC', xB - 26, ym - 9, { alin: 'right', tam: 12.5, peso: 700, color: p.acento });
      txt(v, `${num(VCC, 1)} V`, xB - 26, ym + 9, { alin: 'right', tam: 12.5, peso: 700, color: p.acento });
    } else txtRico(v, `V_CC = ${num(VCC, 1)} V`, xB - 24, ym, { alin: 'right', tam: 13, peso: 700, color: p.acento });
    // Changeover switch: position «carga» connects to the battery, «descarga» to the bottom rail.
    const piv: [number, number] = [xS + 10, yT];
    const aCarga: [number, number] = [xS - 30, yT];
    const aDesc: [number, number] = [xS - 30, yT + 50];
    hilo(v, [aDesc, [xS - 30, yB]]);
    nodo(v, xS - 30, yB);
    const destino = cargando ? aCarga : aDesc;
    ctx.strokeStyle = p.tinta;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(piv[0], piv[1]);
    ctx.lineTo(destino[0] + 4, destino[1]);
    ctx.stroke();
    for (const q of [piv, aCarga, aDesc]) {
      ctx.beginPath();
      ctx.arc(q[0], q[1], 3.4, 0, Math.PI * 2);
      ctx.fillStyle = p.fondo;
      ctx.fill();
      ctx.stroke();
    }
    txt(v, 'carga', xS - 36, yT - 16, { tam: 12, color: cargando ? p.acento : p.suave, alin: 'right', peso: 700 });
    if (est) txt(v, 'descarga', xS - 22, yT + 66, { tam: 12, color: !cargando ? p.acento : p.suave, alin: 'left', peso: 700 });
    else txt(v, 'descarga', xS - 36, yT + 50, { tam: 12, color: !cargando ? p.acento : p.suave, alin: 'right', peso: 700 });
    hilo(v, [
      [xS + 10, yT],
      [xS + 50, yT],
    ]);
    resistencia(v, xS + 50, yT, xC - 40, yT, { largo: 70, alto: 22 });
    txtRico(v, `R = ${si(R, 'Ω', 3)}`, (xS + xC) / 2 + 5, yT - 26, { tam: 13, peso: 700 });
    hilo(v, [
      [xC - 40, yT],
      [xC, yT],
      [xC, ym - 14],
    ]);
    condensador(v, xC, ym - 14, xC, ym + 14, { placa: 60, sep: 18, ancho: 2 });
    txtRico(v, `C = ${si(C, 'F', 3)}`, xC + 44, ym - 34, { alin: 'left', tam: 13, peso: 700 });
    // Charges on the plates.
    const n = Math.round((vc / 20) * 14);
    for (let k = 0; k < n; k++) {
      const x = xC - 26 + (52 * (k + 0.5)) / Math.max(n, 1);
      txt(v, '+', x, ym - 24, { tam: 11, peso: 800, color: p.positivo });
      ctx.fillStyle = p.electron;
      ctx.beginPath();
      ctx.arc(x, ym + 23, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Electrons and conventional current in the loop that is active.
    const lazo = cargando
      ? new Camino([
          [xB, ym - 26],
          [xB, yT],
          [xC, yT],
          [xC, ym - 14],
          [xC, ym + 14],
          [xC, yB],
          [xB, yB],
          [xB, ym + 26],
        ])
      : new Camino([
          [xC, ym - 14],
          [xC, yT],
          [xS - 30, yT],
          [xS - 30, yB],
          [xC, yB],
          [xC, ym + 14],
        ]);
    const k = Math.min(1, (Math.abs(i) * R) / Math.max(VCC, 0.1) * 1.5);
    if (k > 0.02) {
      electronesEnCamino(ctx, lazo, -fase, 22, 3.4, p, k);
      corrienteEnCamino(ctx, lazo, fase * 0.6, 120, p, 11, k);
    }

    // Charge meter.
    const mx = est ? v.w - 54 : 600;
    const my0 = yT;
    const my1 = yB;
    rr(ctx, mx, my0, 44, my1 - my0, 10);
    ctx.fillStyle = p.panel;
    ctx.fill();
    ctx.strokeStyle = p.linea;
    ctx.stroke();
    const fr = vc / Math.max(VCC, 0.01);
    rr(ctx, mx + 6, my1 - 6 - (my1 - my0 - 12) * Math.min(1, fr), 32, (my1 - my0 - 12) * Math.min(1, fr), 6);
    ctx.fillStyle = alfa(p.acento, 0.75);
    ctx.fill();
    for (const [f, et] of [
      [0.632, '1τ · 63,2 %'],
      [0.865, '2τ · 86,5 %'],
      [0.95, '3τ · 95 %'],
    ] as const) {
      const ff = cargando ? f : 1 - f;
      const y = my1 - 6 - (my1 - my0 - 12) * ff;
      ctx.strokeStyle = alfa(p.tinta, 0.5);
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(mx - 6, y);
      ctx.lineTo(mx + 50, y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (!est) txt(v, cargando ? et : et.replace(/ · .*/, ` · ${pct(1 - f, 1)}`), mx + 56, y, { tam: 11.5, alin: 'left', color: p.suave });
    }
    txtRico(v, `v_C = ${num(vc, 2)} V`, mx + 22, my0 - 16, { tam: 14, peso: 800, color: p.acento });
    txtRico(v, `t = ${num(u, 2)} τ = ${si(u * tau, 's', 3)}`, est ? v.w / 2 : (xB + xC) / 2, yB + 40, { tam: 14, peso: 700 });
    txtRico(v, `i = ${si(i, 'A', 3)}`, est ? v.w / 2 : (xB + xC) / 2, yB + 64, { tam: 13.5, peso: 700, color: p.corriente });
  }

  const texto = $derived.by(() => {
    const s = `τ = R·C = ${si(R, 'Ω', 3)} × ${si(C, 'F', 3)} = ${si(tau, 's', 3)}.`;
    if (cargando)
      return (
        `**Carga:** al principio el condensador descargado se comporta como un cortocircuito y pasa toda la corriente, V_CC/R; a medida que se carga, la tensión que queda sobre R baja y la corriente se apaga. ${s}\n` +
        `Tras 1τ está al 63,2 %, tras 5τ al 99,3 %: ahora, a ${num(uMostrada, 1)} τ, lleva ${pct(vcMostrada / Math.max(VCC, 1e-9), 1)}. Cargado, es un circuito abierto.`
      );
    return (
      `**Descarga:** el condensador hace ahora de fuente y empuja la corriente en sentido contrario a través de R; su tensión decae como V_0·e^{−t/τ}. ${s}\n` +
      `Cada τ pierde el 63,2 % de lo que le quedaba: ahora, a ${num(uMostrada, 1)} τ, conserva ${num(vcMostrada, 2)} V.`
    );
  });

  const lecturas = $derived([
    { e: 'Constante de tiempo τ', v: si(tau, 's', 3), c: pal.acento },
    { e: 'v_C', v: `${num(vcMostrada, 3)} V` },
    { e: 't / τ', v: num(uMostrada, 2) },
    { e: 'Corriente inicial', v: si(VCC / R, 'A', 3) },
    { e: 'Energía final ½·C·V²', v: si(0.5 * C * VCC * VCC, 'J', 3) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron', 'corriente']}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 440] : [780, 400])} etiqueta="Circuito RC cargándose y descargándose" />
  {/snippet}
  {#snippet controles()}
    <div class="botones">
      <button class="boton" class:primario={cargando} onclick={() => conmutar(true)}>Cargar</button>
      <button class="boton" class:primario={!cargando} onclick={() => conmutar(false)}>Descargar</button>
    </div>
    <Interruptor etiqueta="Conmutar solo cada 6τ" bind:valor={auto} />
    <Deslizador etiqueta="Resistencia R" bind:valor={R} min={100} max={1e6} log unidad="Ω" />
    <Deslizador etiqueta="Capacidad C" bind:valor={C} min={1e-6} max={10e-3} log unidad="F" />
    <Deslizador etiqueta="Tensión de la pila V_CC" bind:valor={VCC} min={1} max={20} paso={0.5} unidad="V" />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo={cargando ? 'Carga: v_C(t)' : 'Descarga: v_C(t)'}
      x={{ etiqueta: 't', unidad: 's', min: 0, max: 7 * tau }}
      y={{ etiqueta: 'v_C', unidad: 'V', min: 0, max: Math.max(VCC, 1) * 1.05 }}
      series={[{ x: traza.t, y: traza.v, color: pal.acento, ancho: 2.6 }]}
      lineas={[
        { x: tau, etiqueta: 'τ', color: pal.suave },
        { x: 2 * tau, etiqueta: '2τ', color: pal.suave },
        { x: 3 * tau, etiqueta: '3τ', color: pal.suave },
        { x: 5 * tau, etiqueta: '5τ', color: pal.suave },
        { y: VCC * (cargando ? 0.632 : 0.368), etiqueta: cargando ? '63,2 %' : '36,8 %', color: pal.hueco },
      ]}
      puntos={[{ x: uMostrada * tau, y: vcMostrada, color: pal.corriente }]}
    />
  {/snippet}
</Marco>

<style>
  .botones {
    display: flex;
    gap: 8px;
  }
</style>
