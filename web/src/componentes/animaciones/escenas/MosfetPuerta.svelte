<script lang="ts">
  // Gate charge and the Miller plateau (book 7.8, fig. 7.10): the driver pushes charge into the gate; V_GS
  // rises while C_gs charges, stops on the plateau while the drain falls and C_gd absorbs Q_gd, then rises
  // again. During the plateau the transistor has voltage and current at once: that is where switching losses
  // are made, and the driver current decides how long it lasts (20 nC at 1 A: 20 ns; at 0,1 A: 200 ns).
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, circulo, brillo, flecha, type Vista } from '../nucleo/dibujo';
  import { hilo, resistencia, mosfetSimbolo, condensador, masa, nodo } from '../nucleo/esquema';
  import { alfa, paleta } from '../nucleo/paleta';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  const QGS = 8e-9;
  const QGD = 20e-9;
  const QG = 60e-9;
  const VPL = 4.5;
  const VTH = 3;
  const VG = 10;
  const VDS0 = 24;
  const ID0 = 8;
  let idrv = $state(0.1);
  let f = $state(100e3);

  /** V_GS, V_DS and I_D as functions of the gate charge Q (piecewise, as in the datasheet curve). */
  function estado(q: number): { vgs: number; vds: number; id: number } {
    if (q <= QGS) {
      const vgs = (q / QGS) * VPL;
      const id = vgs <= VTH ? 0 : (ID0 * (vgs - VTH)) / (VPL - VTH);
      return { vgs, vds: VDS0, id };
    }
    if (q <= QGS + QGD) {
      const u = (q - QGS) / QGD;
      return { vgs: VPL, vds: VDS0 * (1 - u) + 0.2 * u, id: ID0 };
    }
    const u = (q - QGS - QGD) / (QG - QGS - QGD);
    return { vgs: VPL + (VG - VPL) * u, vds: 0.2 - 0.1 * u, id: ID0 };
  }
  const tMeseta = $derived(QGD / idrv);
  const tSubida = $derived(QG / idrv);
  // Switching energy (turn-on): ½·V·I·t for the current rise and the voltage fall.
  const eOn = $derived(0.5 * VDS0 * ID0 * ((QGS * (VPL - VTH)) / VPL / idrv + tMeseta));
  const pConm = $derived(eOn * 2 * f);
  const pDriver = $derived(QG * VG * f);

  const CICLO = 4;
  let q = 0;
  let t = 0;
  let qM = $state(0);
  const muestreo = new Muestreo(40);
  function paso(dt: number): void {
    t = (t + dt) % CICLO;
    q = Math.min(QG, (t / 3) * QG);
    if (muestreo.toca()) qM = q;
  }

  function dibujar(v: Vista): void {
    void [idrv, f];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const e = estado(q);
    const enMeseta = q > QGS && q < QGS + QGD;
    // Circuit.
    const xt = est ? 300 : 280;
    const yt = est ? 200 : 210;
    const m = mosfetSimbolo(v, xt, yt, { activo: e.id / ID0 });
    const xD = m.d[0];
    hilo(v, [m.d, [xD, 70]]);
    txtRico(v, `+${VDS0} V · carga de ${ID0} A`, xD, 56, { tam: 13, peso: 800, color: p.positivo });
    hilo(v, [m.s, [xD, yt + 90]]);
    masa(v, xD, yt + 90);
    // Parasitic capacitances.
    ctx.save();
    ctx.globalAlpha = 0.8;
    hilo(v, [[m.g[0] + 6, m.g[1]], [m.g[0] + 6, m.g[1] - 70], [xD - 40, m.g[1] - 70]], p.campoB, 1.4);
    condensador(v, xD - 40, m.g[1] - 70, xD - 6, m.g[1] - 70, { color: p.campoB, placa: 18, sep: 6, ancho: 1.6 });
    hilo(v, [[xD - 6, m.g[1] - 70], [xD, m.g[1] - 70]], p.campoB, 1.4);
    hilo(v, [[m.g[0] + 6, m.g[1]], [m.g[0] + 6, m.g[1] + 60]], p.campoB, 1.4);
    condensador(v, m.g[0] + 6, m.g[1] + 60, m.g[0] + 6, m.g[1] + 84, { color: p.campoB, placa: 18, sep: 6, ancho: 1.6 });
    hilo(v, [[m.g[0] + 6, m.g[1] + 84], [m.g[0] + 6, yt + 70], [xD, yt + 70]], p.campoB, 1.4);
    ctx.restore();
    txtRico(v, 'C_gd', xD - 24, m.g[1] - 90, { tam: 12.5, peso: 800, color: enMeseta ? p.peligro : p.campoB });
    txtRico(v, 'C_gs', m.g[0] - 12, m.g[1] + 72, { tam: 12.5, peso: 800, color: !enMeseta && q < QGS ? p.peligro : p.campoB, alin: 'right' });
    if (enMeseta) brillo(ctx, xD - 24, m.g[1] - 70, 30, p.peligro, 0.35);
    // Driver.
    const xd = est ? 60 : 70;
    rr(ctx, xd - 30, m.g[1] - 26, 70, 52, 8);
    ctx.fillStyle = p.panel;
    ctx.fill();
    ctx.strokeStyle = p.tinta;
    ctx.lineWidth = 2;
    ctx.stroke();
    txt(v, 'driver', xd + 5, m.g[1], { tam: 13, peso: 800 });
    hilo(v, [[xd + 40, m.g[1]], [xd + 60, m.g[1]]]);
    resistencia(v, xd + 60, m.g[1], m.g[0] - 20, m.g[1], { largo: 40, alto: 14 });
    hilo(v, [[m.g[0] - 20, m.g[1]], m.g]);
    nodo(v, m.g[0] + 6, m.g[1]);
    // Charge packets flowing into the gate while charging.
    if (q < QG) {
      for (let k = 0; k < 6; k++) {
        const u = (t * 1.6 + k / 6) % 1;
        const x = xd + 44 + u * (m.g[0] - xd - 44);
        circulo(ctx, x, m.g[1] - 10, 3.2, p.corriente);
      }
      flecha(ctx, xd + 70, m.g[1] - 26, xd + 120, m.g[1] - 26, p.corriente, 2.2, 9);
      txtRico(v, `${si(idrv, 'A', 2)}`, xd + 126, m.g[1] - 26, { alin: 'left', tam: 12.5, peso: 800, color: p.corriente });
    }
    // Gauges.
    txtRico(v, `Q_G = ${si(q, 'C', 3)}`, xt, yt + 130, { tam: 14, peso: 800, color: p.acento });
    txtRico(v, `t = ${si(q / idrv, 's', 3)}`, xt, yt + 152, { tam: 13, color: p.suave });
    // Scope with V_GS, V_DS, I_D against charge (time).
    if (!est) {
      const sx0 = 470;
      const sx1 = v.w - 20;
      const sy0 = 40;
      const sy1 = v.h - 40;
      rr(ctx, sx0, sy0, sx1 - sx0, sy1 - sy0, 10);
      ctx.fillStyle = p.panel;
      ctx.fill();
      ctx.strokeStyle = p.linea;
      ctx.stroke();
      const X = (qq: number) => sx0 + 14 + (qq / QG) * (sx1 - sx0 - 28);
      const Y = (val: number, max: number) => sy1 - 20 - (val / max) * (sy1 - sy0 - 50);
      ctx.fillStyle = alfa(p.peligro, 0.1);
      ctx.fillRect(X(QGS), sy0 + 6, X(QGS + QGD) - X(QGS), sy1 - sy0 - 12);
      txt(v, 'meseta de Miller', (X(QGS) + X(QGS + QGD)) / 2, sy0 + 18, { tam: 12, peso: 800, color: p.peligro });
      const curva = (fn: (s: { vgs: number; vds: number; id: number }) => number, max: number, c: string) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let k = 0; k <= 120; k++) {
          const qq = (k / 120) * QG;
          const yy = Y(fn(estado(qq)), max);
          if (k) ctx.lineTo(X(qq), yy);
          else ctx.moveTo(X(qq), yy);
        }
        ctx.stroke();
      };
      curva((s) => s.vgs, 12, p.acento);
      curva((s) => s.vds, 26, p.hueco);
      curva((s) => s.id, 9, p.corriente);
      ctx.strokeStyle = alfa(p.tinta, 0.4);
      ctx.beginPath();
      ctx.moveTo(X(q), sy0 + 6);
      ctx.lineTo(X(q), sy1 - 6);
      ctx.stroke();
      circulo(ctx, X(q), Y(e.vgs, 12), 4.5, p.acento);
      circulo(ctx, X(q), Y(e.vds, 26), 4.5, p.hueco);
      circulo(ctx, X(q), Y(e.id, 9), 4.5, p.corriente);
      txtRico(v, `V_GS ${num(e.vgs, 1)} V`, sx0 + 14, sy1 - 46, { tam: 12, alin: 'left', peso: 800, color: p.acento });
      txtRico(v, `V_DS ${num(e.vds, 1)} V`, sx0 + 14, sy0 + 40, { tam: 12, alin: 'left', peso: 800, color: p.hueco });
      txtRico(v, `I_D ${num(e.id, 1)} A`, sx1 - 14, sy0 + 40, { tam: 12, alin: 'right', peso: 800, color: p.corriente });
      txt(v, 'carga de puerta →', sx1 - 14, sy1 - 10, { tam: 11.5, alin: 'right', color: p.suave });
    }
  }

  const curvaQ = $derived.by(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let k = 0; k <= 120; k++) {
      const qq = (k / 120) * QG;
      xs.push(qq);
      ys.push(estado(qq).vgs);
    }
    return { xs, ys };
  });

  const texto = $derived.by(() => {
    const e = estado(qM);
    const fase =
      qM < QGS
        ? '**Primer tramo:** el driver carga C_gs; V_GS sube y, al pasar V_th, el transistor empieza a tomar la corriente de la carga.'
        : qM < QGS + QGD
          ? `**Meseta de Miller:** V_GS se detiene en ${num(VPL, 1)} V. Toda la carga va a C_gd, porque el drenador está cayendo de 24 V a casi cero; mientras, el transistor tiene tensión y corriente a la vez (ahora ${num(e.vds, 1)} V y ${ID0} A).`
          : '**Tercer tramo:** el drenador ya está abajo; V_GS sube hasta 10 V cargando C_gs y C_gd y R_DS(on) baja a su mínimo.';
    return (
      fase +
      `\nCon ${si(idrv, 'A', 2)} de driver la meseta (Q_gd = 20 nC) dura ${si(tMeseta, 's', 2)}: a ${si(f, 'Hz', 2)} eso son unos ${si(pConm, 'W', 2)} de pérdidas de conmutación (encendido y apagado). **El driver decide las pérdidas del transistor.**`
    );
  });
  const lecturas = $derived([
    { e: 'Duración de la meseta', v: si(tMeseta, 's', 3), c: pal.peligro },
    { e: 'Encendido completo', v: si(tSubida, 's', 3) },
    { e: 'Pérdidas de conmutación', v: si(pConm, 'W', 3), c: pal.calor },
    { e: 'Consumo del driver Q_G·V_G·f', v: si(pDriver, 'W', 3) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 400] : [900, 400])} etiqueta="Carga de la puerta de un MOSFET y meseta de Miller" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Corriente del driver" bind:valor={idrv} min={0.05} max={3} log unidad="A" />
    <Deslizador etiqueta="Frecuencia de conmutación" bind:valor={f} min={10e3} max={1e6} log unidad="Hz" />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Curva de carga de puerta (Q_G total 60 nC)"
      x={{ etiqueta: 'Q_G', unidad: 'C', min: 0, max: QG }}
      y={{ etiqueta: 'V_GS', unidad: 'V', min: 0, max: 11 }}
      zonas={[{ x0: QGS, x1: QGS + QGD, color: pal.peligro, etiqueta: 'Q_gd' }]}
      series={[{ x: curvaQ.xs, y: curvaQ.ys, color: pal.acento }]}
      lineas={[{ y: VTH, etiqueta: 'V_th', color: pal.suave }]}
      puntos={[{ x: qM, y: estado(qM).vgs, color: pal.corriente }]}
    />
  {/snippet}
</Marco>
