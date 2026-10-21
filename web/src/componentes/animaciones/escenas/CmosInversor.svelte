<script lang="ts">
  // The CMOS inverter (book 9.2 and 9.3): a P-channel MOSFET to the supply and an N-channel to ground, gates
  // tied. With the input low only the PMOS conducts (output high); with it high only the NMOS (output low);
  // in between both conduct a little: the shoot-through current. Square law for both, V_th = ±1 V.
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Interruptor from '../ui/Interruptor.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, Camino, electronesEnCamino, corrienteEnCamino, type Vista } from '../nucleo/dibujo';
  import { hilo, mosfetSimbolo, masa, nodo, condensador, terminal } from '../nucleo/esquema';
  import { alfa, paleta } from '../nucleo/paleta';
  import { mosfet, type ParamMOS } from '../nucleo/fisica';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  const VDD = 5;
  const P: ParamMOS = { k: 1e-3, vth: 1, lambda: 0.05 };
  let vin = $state(1.5);
  let barrido = $state(true);

  /** Solves I_DP = I_DN for the output voltage (no load current). */
  function vtc(x: number): { vout: number; i: number } {
    let lo = 0;
    let hi = VDD;
    for (let k = 0; k < 60; k++) {
      const m = (lo + hi) / 2;
      const ip = mosfet(VDD - x, VDD - m, P).id;
      const iN = mosfet(x, m, P).id;
      if (ip > iN) lo = m;
      else hi = m;
    }
    const vout = (lo + hi) / 2;
    return { vout, i: mosfet(x, vout, P).id };
  }
  const r = $derived(vtc(vin));

  let t = 0;
  let fase = 0;
  const muestreo = new Muestreo(40);
  function paso(dt: number): void {
    t += dt;
    if (barrido && muestreo.toca()) vin = 2.5 - 2.5 * Math.cos(t * 0.7);
    fase += dt * Math.min(100, 10 + r.i * 2e5);
  }

  function dibujar(v: Vista): void {
    void [vin];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const x = est ? 280 : 300;
    const yP = est ? 140 : 130;
    const yN = est ? 290 : 280;
    const conP = Math.min(1, mosfet(VDD - vin, VDD - r.vout, P).id / 4e-3 + (vin < 4 ? 0.3 * (1 - vin / 4) : 0));
    const conN = Math.min(1, mosfet(vin, r.vout, P).id / 4e-3 + (vin > 1 ? 0.3 * ((vin - 1) / 4) : 0));
    const mp = mosfetSimbolo(v, x, yP, { canalP: true, activo: vin < VDD - 1 ? conP : 0 });
    const mn = mosfetSimbolo(v, x, yN, { activo: vin > 1 ? conN : 0 });
    const xr = mp.d[0];
    // Supply and ground.
    hilo(v, [mp.d, [xr, 40]]);
    txtRico(v, `V_DD = ${VDD} V`, xr, 28, { tam: 13, peso: 800, color: p.positivo });
    hilo(v, [mn.s, [xr, yN + 70]]);
    masa(v, xr, yN + 70);
    // The helper names the top terminal «d»; for the PMOS that top terminal is its source, tied to V_DD.
    hilo(v, [mp.s, mn.d]);
    const yo = (yP + yN) / 2;
    const xc = xr + (est ? 70 : 110);
    const xt = xr + (est ? 110 : 160);
    nodo(v, xr, yo);
    hilo(v, [
      [xr, yo],
      [xc, yo],
    ]);
    condensador(v, xc, yo, xc, yo + 50, { placa: 26 });
    hilo(v, [
      [xc, yo + 50],
      [xc, yN + 70],
      [xr, yN + 70],
    ]);
    terminal(v, xt, yo);
    hilo(v, [
      [xc, yo],
      [xt - 4, yo],
    ]);
    txtRico(v, `V_out = ${num(r.vout, 2)} V`, xt + 10, yo - 4, { tam: 15, peso: 800, color: p.acento, alin: 'left' });
    txt(v, r.vout > 3.5 ? '«1»' : r.vout < 1.5 ? '«0»' : 'indefinido', xt + 10, yo + 20, { tam: 13, peso: 800, color: p.suave, alin: 'left' });
    // Gates tied to the input.
    const xg = mp.g[0] - 40;
    hilo(v, [mp.g, [xg, mp.g[1]], [xg, mn.g[1]], mn.g]);
    nodo(v, xg, yo);
    hilo(v, [
      [xg, yo],
      [xg - 60, yo],
    ]);
    terminal(v, xg - 64, yo);
    txtRico(v, `V_in = ${num(vin, 2)} V`, xg - 76, yo - 4, { tam: 15, peso: 800, color: p.serie[0], alin: 'right' });
    txt(v, vin > 3.5 ? '«1»' : vin < 1.5 ? '«0»' : 'transición', xg - 76, yo + 20, { tam: 13, peso: 800, color: p.suave, alin: 'right' });
    txt(v, 'PMOS', x + 40, yP - 20, { tam: 12, peso: 800, color: p.suave, alin: 'left' });
    txt(v, 'NMOS', x + 40, yN + 20, { tam: 12, peso: 800, color: p.suave, alin: 'left' });
    // Shoot-through current from V_DD to ground.
    const k = Math.min(1, r.i / 1.5e-3);
    if (k > 0.03) {
      const c = new Camino([
        [xr, 40],
        [xr, yN + 70],
      ]);
      electronesEnCamino(ctx, c, -fase, 18, 3, p, k);
      corrienteEnCamino(ctx, c, fase * 0.6, 80, p, 10, k);
      txtRico(v, `corriente de paso ${si(r.i, 'A', 2)}`, xr + 20, 60, { tam: 12.5, peso: 700, color: p.corriente, alin: 'left' });
    }
    if (!est) {
      rr(ctx, 30, v.h - 70, 200, 44, 10);
      ctx.fillStyle = alfa(p.acento, 0.08);
      ctx.fill();
      txt(v, vin < 1 ? 'Solo conduce el PMOS' : vin > 4 ? 'Solo conduce el NMOS' : 'Conducen los dos', 130, v.h - 48, { tam: 14, peso: 800, color: p.acento });
    }
  }

  const curvas = $derived.by(() => {
    const xs: number[] = [];
    const vo: number[] = [];
    const ii: number[] = [];
    for (let k = 0; k <= 200; k++) {
      const x = (k / 200) * VDD;
      const s = vtc(x);
      xs.push(x);
      vo.push(s.vout);
      ii.push(s.i);
    }
    return { xs, vo, ii };
  });

  const texto = $derived(
    (vin < 1
      ? `Con la entrada a ${num(vin, 2)} V (un «0») el NMOS está cortado y el PMOS, con V_SG = ${num(VDD - vin, 1)} V, conecta la salida a V_DD: «1». No circula corriente de alimentación a ninguna parte.`
      : vin > 4
        ? `Con la entrada a ${num(vin, 2)} V (un «1») el PMOS está cortado y el NMOS lleva la salida a masa: «0». Otra vez, consumo estático nulo.`
        : `En la transición (V_in = ${num(vin, 2)} V) **conducen los dos** a la vez y pasa una corriente de V_DD a masa de ${si(r.i, 'A', 2)}; la salida cae bruscamente alrededor de V_DD/2.`) +
      '\nPor eso un CMOS casi no consume en reposo y su consumo crece con la frecuencia: en cada flanco carga o descarga la capacidad de salida y pasa la corriente de paso. Y por eso una entrada flotante, a media tensión, lo calienta.',
  );
  const lecturas = $derived([
    { e: 'V_out', v: `${num(r.vout, 3)} V`, c: pal.acento },
    { e: 'Corriente de alimentación', v: si(r.i, 'A', 3), c: pal.corriente },
    { e: 'Ganancia dV_out/dV_in', v: num((vtc(vin + 0.005).vout - vtc(vin - 0.005).vout) / 0.01, 1) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron', 'corriente']}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 420] : [780, 380])} etiqueta="Inversor CMOS con un PMOS y un NMOS" />
  {/snippet}
  {#snippet controles()}
    <Interruptor etiqueta="Barrido automático de la entrada" bind:valor={barrido} />
    <Deslizador etiqueta="Tensión de entrada V_in" bind:valor={vin} min={0} max={5} paso={0.01} unidad="V" desactivado={barrido} />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Curva de transferencia y corriente de paso"
      x={{ etiqueta: 'V_in', unidad: 'V', min: 0, max: 5 }}
      y={{ etiqueta: 'V_out', unidad: 'V', min: 0, max: 5.2 }}
      series={[
        { x: curvas.xs, y: curvas.vo, color: pal.acento, nombre: 'V_out' },
        { x: curvas.xs, y: curvas.ii.map((i) => i * 2000), color: pal.corriente, discontinua: true, nombre: 'I_DD (1 mA ≙ 2 V)' },
      ]}
      puntos={[{ x: vin, y: r.vout, color: pal.acento }]}
    />
  {/snippet}
</Marco>
