<script lang="ts">
  // Self-induction and Lenz's law (book 4.1 and 4.3): closing the switch, the field builds up and the coil
  // develops v_L = L·di/dt against the change; i(t) = V/R·(1 − e^(−t/τ)) with τ = L/R. Opening it, the coil
  // keeps its current through the discharge resistor, with a peak of I·R_d. L = µ₀·µ_r·N²·A/l
  // (book: 100 turns, 5 cm, 1 cm² → 25,1 µH in air, 50,3 mH with µ_r = 2000).
  import { untrack } from 'svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, flecha, Camino, electronesEnCamino, corrienteEnCamino, type Vista } from '../nucleo/dibujo';
  import { bateria, hilo, resistencia, interruptor, nodo } from '../nucleo/esquema';
  import { solenoide } from '../nucleo/piezas';
  import { alfa, paleta } from '../nucleo/paleta';
  import { MU0 } from '../nucleo/fisica';
  import { si } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let N = $state(100);
  let mur = $state(2000);
  let R = $state(100);
  let cerrado = $state(true);
  const V = 12;
  const RD = 1000;
  const L = $derived((MU0 * mur * N * N * 1e-4) / 0.05);
  // While closed R_d sits across the coil: the Thevenin resistance seen by L is R‖R_d.
  const tauOn = $derived(L / ((R * RD) / (R + RD)));
  const tauOff = $derived(L / (R + RD));

  // Simulation in units of the time constant of the present path; one τ lasts 1,5 s on screen.
  let i = 0;
  let vL = 0;
  let u = 0;
  let fase = 0;
  let tt: number[] = [0];
  let ii: number[] = [0];
  let vv: number[] = [0];
  let serie = $state.raw({ t: [0], i: [0], v: [0] });
  let mostrado = $state({ i: 0, vL: 0, u: 0 });
  const muestreo = new Muestreo(60);

  $effect(() => {
    void cerrado;
    untrack(() => {
      u = 0;
      tt = [0];
      ii = [i];
      vv = [vL];
    });
  });
  $effect(() => {
    if (reloj.reinicios > 0)
      untrack(() => {
        i = 0;
        cerrado = true;
        u = 0;
        tt = [0];
        ii = [0];
        vv = [0];
      });
  });

  function paso(dt: number): void {
    const tau = cerrado ? tauOn : tauOff;
    const dtau = dt / 1.5;
    u += dtau;
    const iFin = cerrado ? V / R : 0;
    const iAntes = i;
    i = iFin + (i - iFin) * Math.exp(-dtau);
    // v_L = L·di/dt, with dt real = dtau·τ.
    vL = (L * (i - iAntes)) / Math.max(dtau * tau, 1e-12);
    fase += dt * 80 * Math.min(1, (i * R) / V + 0.05);
    if (u < 6) {
      tt.push(u * tau);
      ii.push(i / (V / R));
      vv.push(vL / V);
    }
    if (muestreo.toca()) {
      serie = { t: tt.slice(), i: ii.slice(), v: vv.slice() };
      mostrado = { i, vL, u };
    }
  }

  function dibujar(v: Vista): void {
    void [N, mur, R, cerrado];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const iMax = V / R;
    const k = Math.min(1, i / Math.max(iMax, 1e-9));
    const xB = est ? 60 : 80;
    const yT = est ? 70 : 70;
    const yB = est ? 330 : 330;
    const xc0 = est ? 170 : 300;
    const xc1 = est ? 470 : 640;
    const yc = (yT + yB) / 2 + 10;
    const rc = est ? 50 : 56;
    // Magnetic field lines (closed loops through the solenoid), strength ∝ i.
    if (k > 0.01) {
      ctx.save();
      ctx.strokeStyle = alfa(p.campoB, 0.25 + 0.6 * k);
      ctx.lineWidth = 1.8;
      ctx.setLineDash([7, 6]);
      ctx.lineDashOffset = -fase * 0.6;
      const n = Math.max(1, Math.round(1 + 4 * k));
      for (let m = 1; m <= n; m++) {
        const ex = (xc1 - xc0) / 2 + 30 + m * 24;
        const ey = rc + m * 20;
        ctx.beginPath();
        ctx.ellipse((xc0 + xc1) / 2, yc, ex, Math.min(ey, yc - yT + 30), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      // Field direction inside: arrow along the axis.
      flecha(ctx, xc0 - 40, yc, xc1 + 40, yc, alfa(p.campoB, 0.4 + 0.6 * k), 2.4, 12);
      txt(v, 'B', est ? xc1 + 26 : xc1 + 52, est ? yc - 18 : yc, { tam: 16, peso: 800, color: p.campoB });
    }
    solenoide(ctx, p, { x0: xc0, x1: xc1, yc, r: rc, n: Math.max(6, Math.min(24, Math.round(N / 10))), nucleo: mur > 1 ? p.ferrita : null });
    // Circuit: battery, switch, R, the coil, and the discharge resistor across the coil.
    hilo(v, [
      [xB, yc - 24],
      [xB, yT],
      [xB + 40, yT],
    ]);
    interruptor(v, xB + 40, yT, xB + 100, yT, cerrado ? 1 : 0);
    hilo(v, [
      [xB + 100, yT],
      [xB + 130, yT],
    ]);
    resistencia(v, xB + 130, yT, xB + 200, yT, { largo: 52 });
    hilo(v, [
      [xB + 200, yT],
      [xc0, yT],
      [xc0, yc - rc],
    ]);
    nodo(v, xc0, yT);
    hilo(v, [
      [xc1, yc - rc],
      [xc1, yB],
      [xB, yB],
      [xB, yc + 24],
    ]);
    nodo(v, xc1, yB);
    bateria(v, xB, yc - 24, xB, yc + 24, {});
    txtRico(v, `${V} V`, xB - 22, yc, { alin: 'right', tam: 14, peso: 700, color: p.acento });
    txtRico(v, `R = ${si(R, 'Ω', 3)}`, xB + 165, yT - 22, { tam: 13, peso: 700 });
    // Discharge resistor in parallel with the coil.
    const xd = est ? xc1 + 40 : xc1 + 110;
    hilo(v, [
      [xc0, yT],
      [xd, yT],
      [xd, yc - 30],
    ]);
    resistencia(v, xd, yc - 30, xd, yc + 30, { largo: 50 });
    hilo(v, [
      [xd, yc + 30],
      [xd, yB],
      [xc1, yB],
    ]);
    if (est) txtRico(v, `R_d = ${si(RD, 'Ω', 2)}`, xd, yB + 18, { tam: 12.5 });
    else txtRico(v, `R_d = ${si(RD, 'Ω', 2)}`, xd + 16, yc, { alin: 'left', tam: 12.5 });
    // Currents: through the battery loop when closed; around coil + R_d when open.
    const lazo = cerrado
      ? new Camino([
          [xB, yc - 24],
          [xB, yT],
          [xc0, yT],
          [xc0, yc - rc],
          [xc1, yc - rc],
          [xc1, yB],
          [xB, yB],
          [xB, yc + 24],
        ])
      : new Camino(
          [
            [xc0, yc - rc],
            [xc1, yc - rc],
            [xc1, yB],
            [xd, yB],
            [xd, yT],
            [xc0, yT],
          ],
          true,
        );
    if (k > 0.02) {
      electronesEnCamino(ctx, lazo, -fase, 24, 3.3, p, k);
      corrienteEnCamino(ctx, lazo, fase * 0.6, 120, p, 11, k);
    }
    // Induced emf with its polarity opposing the change.
    const vrel = Math.min(1, Math.abs(vL) / Math.max(V, 1));
    if (Math.abs(vL) > 0.05) {
      const subiendo = vL > 0;
      txt(v, subiendo ? '+' : '−', xc0 - 12, yc - rc - 14, { tam: 18, peso: 900, color: p.peligro });
      txt(v, subiendo ? '−' : '+', xc1 + 12, yc - rc - 14, { tam: 18, peso: 900, color: p.peligro });
      txtRico(v, `fem inducida v_L = ${si(vL, 'V', 3)}`, (xc0 + xc1) / 2, yc + rc + 30, {
        tam: 14,
        peso: 800,
        color: p.peligro,
        fondo: alfa(p.peligro, 0.08 + 0.12 * vrel),
      });
    }
    txtRico(v, `i = ${si(i, 'A', 3)}`, (xc0 + xc1) / 2, yc - rc - 26, { tam: 14, peso: 800, color: p.corriente });
    txtRico(v, `L = ${si(L, 'H', 3)}`, (xc0 + xc1) / 2, yB + 24, { tam: 13.5, peso: 700, color: p.campoB });
  }

  const texto = $derived.by(() => {
    const t = cerrado ? tauOn : tauOff;
    if (cerrado)
      return (
        `**Al cerrar:** la corriente quiere crecer, el campo que crea crece con ella y ese campo variable induce en la propia bobina una tensión que **se opone al cambio** (ley de Lenz): v_L = L·di/dt. Por eso la corriente sube despacio, con τ = L/(R‖R_d) ≈ L/R = ${si(t, 's', 3)}.\n` +
        `Cuando deja de cambiar, v_L = 0: la bobina es un simple hilo. La energía, ½·L·I² = ${si(0.5 * L * (V / R) ** 2, 'J', 3)}, queda en el campo.`
      );
    return (
      `**Al abrir:** la bobina intenta mantener su corriente y genera la tensión que haga falta: aquí la empuja por R_d, con un pico de I·R_d = ${si((V / R) * RD, 'V', 3)}, mucho más que los ${V} V de la pila.\n` +
      `La corriente se extingue con τ = L/(R + R_d) = ${si(t, 's', 3)}. Sin ningún camino, la tensión subiría hasta romper algo (sección 4.5).`
    );
  });
  const lecturas = $derived([
    { e: 'Inductancia L', v: si(L, 'H', 3), c: pal.campoB },
    { e: 'Constante de tiempo τ', v: si(cerrado ? tauOn : tauOff, 's', 3) },
    { e: 'Corriente', v: si(mostrado.i, 'A', 3), c: pal.corriente },
    { e: 'v_L', v: si(mostrado.vL, 'V', 3), c: pal.peligro },
    { e: 'Energía ½·L·i²', v: si(0.5 * L * mostrado.i * mostrado.i, 'J', 3) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron', 'corriente', 'campoB']}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 400] : [900, 400])} etiqueta="Bobina con su campo y la fem inducida" />
  {/snippet}
  {#snippet controles()}
    <div class="botones">
      <button class="boton" class:primario={cerrado} onclick={() => (cerrado = true)}>Cerrar</button>
      <button class="boton" class:primario={!cerrado} onclick={() => (cerrado = false)}>Abrir</button>
    </div>
    <Deslizador etiqueta="Espiras N" bind:valor={N} min={20} max={400} paso={10} formato={(x) => String(x)} />
    <Selector etiqueta="Núcleo" bind:valor={mur} opciones={[{ valor: 1, texto: 'Aire' }, { valor: 2000, texto: 'Ferrita (µ_r = 2000)' }]} />
    <Deslizador etiqueta="Resistencia R" bind:valor={R} min={10} max={1000} log unidad="Ω" />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo={cerrado ? 'Al cerrar: corriente y fem (normalizadas)' : 'Al abrir: corriente y fem (normalizadas)'}
      x={{ etiqueta: 't', unidad: 's', min: 0, max: 6 * (cerrado ? tauOn : tauOff) }}
      y={{ etiqueta: 'fracción', unidad: '', min: cerrado ? -0.05 : -Math.max(1.1, RD / R + 0.2), max: 1.1 }}
      series={[
        { x: serie.t, y: serie.i, color: pal.corriente, nombre: 'i / (V/R)' },
        { x: serie.t, y: serie.v, color: pal.peligro, nombre: 'v_L / V' },
      ]}
      lineas={[{ x: cerrado ? tauOn : tauOff, etiqueta: 'τ', color: pal.suave }]}
    />
  {/snippet}
</Marco>

<style>
  .botones {
    display: flex;
    gap: 8px;
  }
</style>
