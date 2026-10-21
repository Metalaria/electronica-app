<script lang="ts">
  // Surge protection (book 10.4, 5.5 and 2.6): a transient of about 1 kV arrives on a 24 V line through the
  // line's impedance. A varistor (MOV) and a TVS diode both conduct steeply above their threshold and clamp
  // the voltage the load sees; the TVS has the sharper knee. Each surge wears a varistor a little.
  import { untrack } from 'svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, brillo, Camino, corrienteEnCamino, type Vista } from '../nucleo/dibujo';
  import { hilo, resistencia, diodo, masa, nodo } from '../nucleo/esquema';
  import { alfa, paleta } from '../nucleo/paleta';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  type Prot = 'nada' | 'varistor' | 'tvs';
  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  let prot = $state<Prot>('tvs');
  let vpico = $state(1000);
  const RS = 20;
  const VLINEA = 24;
  let desgaste = $state(0);

  function iDisp(v: number, tipo: Prot, d: number): number {
    if (tipo === 'varistor') {
      const vv = 33 * (1 - d * 0.04);
      return 1e-3 * Math.pow(Math.max(0, v) / vv, 22);
    }
    if (tipo === 'tvs') return v > 26.7 ? (v - 26.7) / 0.8 : 1e-9;
    return 0;
  }
  /** Load voltage for a source voltage (solves v = vs − R_S·(i_device + v/R_load)). */
  function sujetar(vs: number, tipo: Prot, d: number): number {
    if (tipo === 'nada') return vs * (1000 / (1000 + RS));
    let lo = 0;
    let hi = vs;
    for (let k = 0; k < 60; k++) {
      const m = (lo + hi) / 2;
      if (vs - RS * (iDisp(m, tipo, d) + m / 1000) > m) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  }
  // Surge: 1,2/50-like double exponential, time in µs.
  const surge = (t: number) => (t < 0 ? 0 : 1.04 * vpico * (Math.exp(-t / 68) - Math.exp(-t / 0.4)));

  const ondas = $derived.by(() => {
    const xs: number[] = [];
    const sin: number[] = [];
    const con: number[] = [];
    let vmax = 0;
    let imax = 0;
    for (let k = 0; k <= 300; k++) {
      const t = -10 + (k / 300) * 160;
      xs.push(t * 1e-6);
      const vs = VLINEA + surge(t);
      sin.push(sujetar(vs, 'nada', desgaste));
      const vl = sujetar(vs, prot, desgaste);
      con.push(vl);
      vmax = Math.max(vmax, vl);
      imax = Math.max(imax, iDisp(vl, prot, desgaste));
    }
    return { xs, sin, con, vmax, imax };
  });

  let t = 0;
  const PERIODO = 5;
  let ultimo = 0;
  $effect(() => {
    void prot;
    untrack(() => (desgaste = 0));
  });
  function paso(dt: number): void {
    t += dt;
    const ciclo = Math.floor(t / PERIODO);
    if (ciclo !== ultimo) {
      ultimo = ciclo;
      if (prot === 'varistor') desgaste = Math.min(10, desgaste + 1);
    }
  }

  function dibujar(v: Vista): void {
    void [prot, vpico, desgaste];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    // Surge travelling along the line, slowed: the 150 µs of the event last 3 s, then a pause.
    const fase = (t % PERIODO) / 3;
    const tus = -10 + fase * 160;
    const vs = VLINEA + surge(tus);
    const vl = sujetar(vs, prot, desgaste);
    const id = iDisp(vl, prot, desgaste);
    const x0 = 40;
    const xR = est ? 200 : 260;
    const xP = est ? 280 : 430;
    const xL = est ? 490 : 620;
    const yT = 110;
    const yB = est ? 300 : 290;
    // Line from the left, with the surge bump.
    hilo(v, [
      [x0, yT],
      [xR - 30, yT],
    ]);
    resistencia(v, xR - 30, yT, xR + 30, yT, { largo: 44 });
    txtRico(v, `línea ${RS} Ω`, xR, yT + 24, { tam: 12.5, color: p.suave });
    hilo(v, [
      [xR + 30, yT],
      [xL, yT],
      [xL, (yT + yB) / 2 - 30],
    ]);
    hilo(v, [
      [x0, yB],
      [xL, yB],
      [xL, (yT + yB) / 2 + 30],
    ]);
    masa(v, xP, yB);
    // Surge pulse drawn on the incoming line.
    const k = Math.min(1, (vs - VLINEA) / Math.max(vpico, 1));
    if (k > 0.02) {
      const xp = x0 + 30 + Math.min(1, fase * 6) * (xR - x0 - 60);
      ctx.strokeStyle = p.peligro;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) {
        const u = i / 30;
        const xx = xp - 30 + u * 60;
        const yy = yT - Math.exp(-Math.pow((u - 0.4) / 0.18, 2)) * 60 * k;
        if (i) ctx.lineTo(xx, yy);
        else ctx.moveTo(xx, yy);
      }
      ctx.stroke();
      txtRico(v, `${si(vs, 'V', 3)}`, xp, yT - 70 * k - 12, { tam: 13, peso: 800, color: p.peligro });
    }
    // Protection device.
    if (prot !== 'nada') {
      nodo(v, xP, yT);
      nodo(v, xP, yB);
      hilo(v, [
        [xP, yT],
        [xP, (yT + yB) / 2 - 30],
      ]);
      hilo(v, [
        [xP, (yT + yB) / 2 + 30],
        [xP, yB],
      ]);
      const kd = Math.min(1, id / 30);
      if (kd > 0.02) brillo(ctx, xP, (yT + yB) / 2, 60, p.corriente, 0.6 * kd);
      if (prot === 'tvs') diodo(v, xP, (yT + yB) / 2 + 30, xP, (yT + yB) / 2 - 30, { tipo: 'zener', conduce: kd, tam: 22 });
      else {
        resistencia(v, xP, (yT + yB) / 2 - 30, xP, (yT + yB) / 2 + 30, { largo: 50, relleno: alfa(p.corriente, 0.15 + 0.6 * kd) });
        ctx.strokeStyle = p.tinta;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(xP - 22, (yT + yB) / 2 + 30);
        ctx.lineTo(xP - 14, (yT + yB) / 2 + 30);
        ctx.lineTo(xP + 16, (yT + yB) / 2 - 32);
        ctx.stroke();
      }
      txt(v, prot === 'tvs' ? 'TVS 24 V' : `varistor 33 V${desgaste ? ` (−${num(desgaste * 4, 0)} %)` : ''}`, xP + 24, (yT + yB) / 2, { tam: 12.5, alin: 'left', peso: 700 });
      if (kd > 0.02) {
        const c = new Camino([
          [xR + 30, yT],
          [xP, yT],
          [xP, yB],
        ]);
        corrienteEnCamino(ctx, c, t * 120, 60, p, 11, kd);
        txtRico(v, est ? `${si(id, 'A', 2)} a masa` : `${si(id, 'A', 2)} derivados a masa`, xP + 24, (yT + yB) / 2 + 24, { tam: 12.5, alin: 'left', peso: 800, color: p.corriente });
      }
    }
    // Load: a delicate circuit.
    rr(ctx, xL - 40, (yT + yB) / 2 - 30, 80, 60, 8);
    const danado = vl > 60;
    ctx.fillStyle = danado ? alfa(p.peligro, 0.25) : p.panel;
    ctx.fill();
    ctx.strokeStyle = p.tinta;
    ctx.lineWidth = 2;
    ctx.stroke();
    txt(v, 'circuito', xL, (yT + yB) / 2 - 8, { tam: 12.5, peso: 800 });
    txt(v, 'máx. 60 V', xL, (yT + yB) / 2 + 12, { tam: 11.5, color: p.suave });
    if (danado) brillo(ctx, xL, (yT + yB) / 2, 50, p.peligro, 0.5);
    txtRico(v, `v_carga = ${si(vl, 'V', 3)}`, xL, yT - 26, { tam: 15, peso: 800, color: danado ? p.peligro : p.acento });
  }

  const texto = $derived(
    (prot === 'nada'
      ? `**Sin protección:** el transitorio de ${si(vpico, 'V', 2)} llega casi entero al circuito, que solo admite 60 V: se destruye.`
      : prot === 'tvs'
        ? `**TVS:** un diodo de avalancha de área enorme. Por encima de su ruptura (26,7 V) conduce de golpe y deriva hasta ${si(ondas.imax, 'A', 2)} a masa: la carga no pasa de ${num(ondas.vmax, 1)} V. Responde en picosegundos y se especifica por la energía del pulso.`
        : `**Varistor:** óxido de cinc cuya resistencia cae bruscamente por encima de su tensión: recorta a ${num(ondas.vmax, 1)} V, con un codo más suave que el TVS. Cada actuación lo desgasta y baja su umbral (aquí, ${desgaste} pulsos): al final conduce a la tensión normal y arde, por eso los buenos llevan un fusible térmico.`) +
      `\nLa resistencia de la línea, ${RS} Ω, es la que «absorbe» la diferencia: el protector necesita algo de impedancia delante para poder recortar.`,
  );
  const lecturas = $derived([
    { e: 'Pico en la carga', v: si(ondas.vmax, 'V', 3), c: ondas.vmax > 60 ? pal.peligro : pal.acento },
    { e: 'Corriente de pico en el protector', v: si(ondas.imax, 'A', 3), c: pal.corriente },
    { e: 'Transitorio', v: si(vpico, 'V', 3) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['corriente']}>
  {#snippet modos()}
    <Selector
      bind:valor={prot}
      opciones={[
        { valor: 'nada', texto: 'Sin protección' },
        { valor: 'varistor', texto: 'Varistor' },
        { valor: 'tvs', texto: 'TVS' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 360] : [760, 360])} etiqueta="Transitorio de tensión recortado por un protector" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Pico del transitorio" bind:valor={vpico} min={100} max={4000} log unidad="V" />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Tensión en la carga durante el transitorio"
      x={{ etiqueta: 't', unidad: 's', min: -10e-6, max: 150e-6 }}
      y={{ etiqueta: 'v', unidad: 'V', min: 1, max: 5000, log: true }}
      series={[
        { x: ondas.xs, y: ondas.sin, color: pal.tenue, discontinua: true, nombre: 'sin protección' },
        { x: ondas.xs, y: ondas.con, color: pal.acento, nombre: prot === 'nada' ? 'en la carga' : 'con protección' },
      ]}
      lineas={[{ y: 60, etiqueta: 'límite del circuito', color: pal.peligro }]}
    />
  {/snippet}
</Marco>
