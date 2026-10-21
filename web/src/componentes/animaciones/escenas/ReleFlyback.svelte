<script lang="ts">
  // Relay and the inductive kick (book 4.5 and 19.2): the coil pulls the armature and closes the contact;
  // at switch-off the coil keeps its current and, without a path, the collector voltage climbs until the
  // transistor breaks down. The freewheeling diode clamps it at V_CC + 0,7 V, at the price of a slower release.
  import { untrack } from 'svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Interruptor from '../ui/Interruptor.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, brillo, Camino, electronesEnCamino, corrienteEnCamino, flecha, type Vista } from '../nucleo/dibujo';
  import { hilo, resistencia, diodo, nodo, masa, lampara, bateria } from '../nucleo/esquema';
  import { solenoide } from '../nucleo/piezas';
  import { alfa, mezcla, paleta } from '../nucleo/paleta';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  const VCC = 12;
  const RB = 120;
  const L = 0.1;
  const VBR = 100;
  const INOM = VCC / RB;

  let on = $state(true);
  let conDiodo = $state(true);

  // Real time runs 1500 times slower than on screen (1 ms ↔ 1,5 s).
  const LENTO = 1500;
  let i = 0;
  let vc = VCC;
  let arm = 0;
  let tReal = 0;
  let avalancha = 0;
  let serie = $state.raw<{ t: number[]; v: number[]; i: number[] }>({ t: [], v: [], i: [] });
  let mostrado = $state({ i: 0, vc: VCC, arm: 0, t: 0 });
  let tt: number[] = [];
  let vv: number[] = [];
  let ii: number[] = [];
  const muestreo = new Muestreo(50);
  let fase = 0;

  $effect(() => {
    void on;
    void conDiodo;
    untrack(() => {
      tReal = 0;
      tt = [];
      vv = [];
      ii = [];
    });
  });
  $effect(() => {
    if (reloj.reinicios > 0)
      untrack(() => {
        i = 0;
        arm = 0;
        on = true;
      });
  });

  function paso(dtv: number): void {
    const dt = dtv / LENTO;
    // Sub-steps for the fast decay without a diode.
    const n = 20;
    const h = dt / n;
    for (let k = 0; k < n; k++) {
      if (on) {
        // Transistor saturated: coil across V_CC (V_CE(sat) ≈ 0,2 V).
        i += ((VCC - 0.2 - i * RB) / L) * h;
        vc = 0.2;
        avalancha = 0;
      } else if (i > 1e-5) {
        if (conDiodo) {
          // Freewheel: coil + diode loop, v_coil = −(0,7 + i·R).
          i += ((-0.7 - i * RB) / L) * h;
          vc = VCC + 0.7;
          avalancha = 0;
        } else {
          // No path: the collector rises to the breakdown voltage and the transistor absorbs the energy.
          i += ((VCC - VBR - i * RB) / L) * h;
          vc = VBR;
          avalancha = 1;
        }
      } else {
        i = 0;
        vc = VCC;
        avalancha = 0;
      }
      i = Math.max(0, i);
    }
    // Armature: pulls in above 60 % of the nominal current, drops out below 30 %.
    const objetivo = i > 0.6 * INOM ? 1 : i < 0.3 * INOM ? 0 : arm > 0.5 ? 1 : 0;
    arm += (objetivo - arm) * Math.min(1, dtv * 6);
    tReal += dt;
    fase += dtv * 90 * Math.min(1, i / INOM + 0.05);
    if (tReal < 4e-3) {
      tt.push(tReal);
      vv.push(vc);
      ii.push(i);
    }
    if (muestreo.toca()) {
      serie = { t: tt.slice(), v: vv.slice(), i: ii.slice() };
      mostrado = { i, vc, arm, t: tReal };
    }
  }

  function dibujar(v: Vista): void {
    void [on, conDiodo];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    // ---------------- driver schematic (left)
    const xL = est ? 150 : 200;
    const yT = 50;
    const yCo1 = 90;
    const yCo2 = 190;
    const yC = 230;
    const yE = 310;
    hilo(v, [
      [xL, yT],
      [xL, yCo1],
    ]);
    txtRico(v, `+${VCC} V`, xL, yT - 14, { tam: 13, peso: 800, color: p.positivo });
    // Coil symbol.
    rr(ctx, xL - 16, yCo1, 32, yCo2 - yCo1, 3);
    ctx.fillStyle = alfa(p.campoB, 0.08 + 0.3 * Math.min(1, i / INOM));
    ctx.fill();
    ctx.strokeStyle = p.tinta;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xL - 16, yCo1 + 10);
    ctx.lineTo(xL + 16, yCo2 - 10);
    ctx.stroke();
    txt(v, 'bobina', xL - 26, (yCo1 + yCo2) / 2, { tam: 12, alin: 'right', color: p.suave });
    hilo(v, [
      [xL, yCo2],
      [xL, yC],
    ]);
    nodo(v, xL, yC - 20);
    // Freewheel diode across the coil (cathode to +V_CC).
    if (conDiodo) {
      hilo(v, [
        [xL, yT + 20],
        [xL + 60, yT + 20],
        [xL + 60, yCo1 + 30],
      ]);
      diodo(v, xL + 60, yCo2 - 10, xL + 60, yCo1 + 30, { conduce: !on && i > 1e-4 ? Math.min(1, (i / INOM) * 1.5) : 0 });
      hilo(v, [
        [xL + 60, yCo2 - 10],
        [xL + 60, yC - 20],
        [xL, yC - 20],
      ]);
      nodo(v, xL, yT + 20);
    }
    // NPN transistor.
    const xt = xL;
    ctx.strokeStyle = p.tinta;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(xt - 6, (yC + yE) / 2, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(xt - 18, (yC + yE) / 2 - 16);
    ctx.lineTo(xt - 18, (yC + yE) / 2 + 16);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xt - 18, (yC + yE) / 2 - 7);
    ctx.lineTo(xt, yC + 12);
    ctx.lineTo(xt, yC);
    ctx.moveTo(xt - 18, (yC + yE) / 2 + 7);
    ctx.lineTo(xt, yE - 12);
    ctx.lineTo(xt, yE);
    ctx.stroke();
    flecha(ctx, xt - 10, yE - 18, xt, yE - 11, p.tinta, 2, 8);
    if (avalancha) brillo(ctx, xt - 6, (yC + yE) / 2, 60, '#ffef5a', 0.6 + 0.3 * Math.sin(v.t * 40));
    masa(v, xt, yE);
    hilo(v, [
      [xt - 18, (yC + yE) / 2],
      [xt - 60, (yC + yE) / 2],
    ]);
    resistencia(v, xt - 60, (yC + yE) / 2, xt - 120, (yC + yE) / 2, { largo: 40, alto: 14 });
    txt(v, on ? 'base: 5 V' : 'base: 0 V', xt - 126, (yC + yE) / 2 + 22, { tam: 12, alin: 'right', color: on ? p.bien : p.suave, peso: 700 });
    // Collector voltage.
    const col = vc > VCC + 2 ? p.peligro : p.acento;
    txtRico(v, `v_C = ${num(vc, 1)} V`, xL + 20, yC + 4, { alin: 'left', tam: 15, peso: 800, color: col, fondo: alfa(col, 0.1) });
    // Current loop: on → through transistor; off with diode → coil + diode.
    const k = Math.min(1, i / INOM);
    if (k > 0.02) {
      const lazo = on
        ? new Camino([
            [xL, yT],
            [xL, yE],
          ])
        : conDiodo
          ? new Camino(
              [
                [xL, yT + 20],
                [xL, yC - 20],
                [xL + 60, yC - 20],
                [xL + 60, yT + 20],
              ],
              true,
            )
          : new Camino([
              [xL, yT],
              [xL, yE],
            ]);
      electronesEnCamino(ctx, lazo, -fase, 20, 3.2, p, k);
      corrienteEnCamino(ctx, lazo, fase * 0.6, 90, p, 10, k);
    }
    if (avalancha) txt(v, 'pico de tensión: el transistor rompe en avalancha', est ? v.w / 2 : xL, yE + 40, { tam: 13, peso: 800, color: p.peligro });

    // ---------------- relay mechanism (right): clapper relay seen from the side
    const mx = est ? 60 : 450;
    const my = est ? 390 : 70;
    const sc = est ? 0.85 : 1;
    ctx.save();
    ctx.translate(mx, my);
    ctx.scale(sc, sc);
    const hierro = mezcla(p.hierro, p.fondo, 0.05);
    // Yoke: vertical bar and bottom plate.
    ctx.fillStyle = hierro;
    ctx.fillRect(0, 40, 16, 200);
    ctx.fillRect(0, 226, 120, 14);
    // Coil around the vertical core (drawn as a horizontal solenoid rotated).
    ctx.save();
    ctx.translate(76, 156);
    ctx.rotate(-Math.PI / 2);
    solenoide(ctx, p, { x0: -62, x1: 62, yc: 0, r: 40, n: 14, nucleo: p.hierro });
    ctx.restore();
    // Field lines through the magnetic circuit (core → armature → yoke → plate).
    if (k > 0.05) {
      ctx.save();
      ctx.strokeStyle = alfa(p.campoB, 0.3 + 0.6 * k);
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -fase * 0.5;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(76, 220);
      ctx.lineTo(76, 80);
      ctx.lineTo(8, 68);
      ctx.lineTo(8, 232);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    // Armature hinged at the top of the yoke; open = tilted up by the spring.
    const ang = -0.13 * (1 - arm);
    ctx.save();
    ctx.translate(8, 60);
    ctx.rotate(ang);
    ctx.fillStyle = mezcla(p.hierro, '#ffffff', 0.15);
    ctx.fillRect(0, 0, 250, 14);
    // Contact spring blade and moving contact at the end.
    ctx.fillStyle = p.cobreClaro;
    ctx.fillRect(250, 4, 60, 6);
    ctx.beginPath();
    ctx.arc(300, 16, 8, 0, Math.PI * 2);
    ctx.fillStyle = mezcla('#d9d9d9', p.cobreClaro, 0.3);
    ctx.fill();
    ctx.restore();
    // Fixed NO contact under the moving one.
    ctx.fillStyle = p.cobreClaro;
    ctx.fillRect(282, 96, 80, 6);
    ctx.beginPath();
    ctx.arc(306, 90, 8, 0, Math.PI * 2);
    ctx.fillStyle = mezcla('#d9d9d9', p.cobreClaro, 0.3);
    ctx.fill();
    // Return spring from the armature to a bracket.
    ctx.fillStyle = hierro;
    ctx.fillRect(150, -30, 70, 8);
    const yArm = 60 + Math.sin(ang) * 180;
    ctx.strokeStyle = p.suave;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let q = 0; q <= 40; q++) {
      const y = -22 + (q * (yArm - -22)) / 40;
      const x = 185 + Math.sin(q * 1.25) * 7;
      if (q === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    // Load circuit: lamp and battery through the contacts.
    const cerrado = arm > 0.8;
    const X = (x: number) => mx + x * sc;
    const Y = (y: number) => my + y * sc;
    hilo(v, [
      [X(362), Y(99)],
      [X(400), Y(99)],
      [X(400), Y(110)],
    ]);
    lampara(v, X(400), Y(110), X(400), Y(170), cerrado ? 1 : 0);
    hilo(v, [
      [X(400), Y(170)],
      [X(400), Y(260)],
      [X(240), Y(260)],
    ]);
    bateria(v, X(240), Y(260), X(200), Y(260), {});
    hilo(v, [
      [X(200), Y(260)],
      [X(-10), Y(260)],
      [X(-10), Y(150)],
      [X(0), Y(150)],
    ]);
    txt(v, cerrado ? 'contacto cerrado' : 'contacto abierto', X(330), Y(118), { tam: 13, peso: 700, color: cerrado ? p.bien : p.suave });
    txt(v, 'armadura', X(120), Y(28), { tam: 12, color: p.suave });
    if (!on && !conDiodo && avalancha) brillo(ctx, X(303), Y(70), 30, '#9fd0ff', 0.6);
  }

  const texto = $derived.by(() => {
    if (on)
      return (
        `**Excitado:** el transistor satura, la bobina queda a ${VCC} V y su corriente sube con τ = L/R = ${si(L / RB, 's', 2)} hasta ${si(INOM, 'A', 2)}. El campo atrae la armadura y el contacto cierra el circuito de la lámpara.\n` +
        'Pulse «Apagar» para ver qué pasa con la energía guardada en la bobina.'
      );
    if (conDiodo)
      return (
        `**Apagado con diodo de libre circulación:** la bobina invierte su tensión, el diodo conduce y la corriente sigue circulando en un lazo cerrado hasta extinguirse en la resistencia del devanado. El colector no pasa de V_CC + 0,7 V = ${num(VCC + 0.7, 1)} V.\n` +
        'El precio: la corriente decae con L/R, la armadura tarda más en soltar y el contacto se abre más despacio, con más arco.'
      );
    return (
      `**Apagado sin diodo:** la bobina genera la tensión que haga falta para mantener su corriente (v = L·di/dt). El colector sube hasta que algo cede: aquí, la ruptura del transistor a ${VBR} V, que absorbe los ${si(0.5 * L * INOM * INOM, 'J', 2)} de ½·L·I².\n` +
      'Ese pico, repetido en cada apagado, es lo que destruye el transistor que gobierna un relé sin protección.'
    );
  });

  const lecturas = $derived([
    { e: 'Corriente de la bobina', v: si(mostrado.i, 'A', 3), c: pal.corriente },
    { e: 'Tensión de colector', v: `${num(mostrado.vc, 1)} V`, c: mostrado.vc > VCC + 2 ? pal.peligro : pal.acento },
    { e: 'Tiempo real desde el cambio', v: si(mostrado.t, 's', 3) },
    { e: 'Armadura', v: mostrado.arm > 0.8 ? 'atraída' : mostrado.arm < 0.2 ? 'en reposo' : 'moviéndose' },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron', 'corriente', 'campoB']}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 640] : [900, 400])} etiqueta="Relé gobernado por un transistor, con y sin diodo de protección" />
  {/snippet}
  {#snippet controles()}
    <div class="botones">
      <button class="boton" class:primario={on} onclick={() => (on = true)}>Encender</button>
      <button class="boton" class:primario={!on} onclick={() => (on = false)}>Apagar</button>
    </div>
    <Interruptor etiqueta="Diodo de libre circulación" bind:valor={conDiodo} />
    <p class="nota">Cámara lenta: 1 ms del circuito dura 1,5 s en pantalla. Bobina de 0,1 H y 120 Ω a 12 V.</p>
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Tensión de colector tras el último cambio"
      x={{ etiqueta: 't', unidad: 's', min: 0, max: 4e-3 }}
      y={{ etiqueta: 'v_C', unidad: 'V', min: 0, max: 110 }}
      series={[{ x: serie.t, y: serie.v, color: pal.peligro }]}
      lineas={[{ y: VCC, etiqueta: 'V_CC', color: pal.suave }]}
    />
  {/snippet}
</Marco>

<style>
  .botones {
    display: flex;
    gap: 8px;
  }
  .nota {
    margin: 0;
    font-size: 13px;
    color: var(--tinta-suave);
  }
</style>
