<script lang="ts">
  // Zener and avalanche breakdown (book 5.2, 5.5 and 5.8): below about 5 V the electrons tunnel through a very
  // thin junction (negative temperature coefficient), above it they multiply by impact (positive); near
  // 5,6 V both compensate. The shunt regulator: V_out stays near V_Z while the input or the load change.
  import { compartir3d } from '../../tres/compartir.svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, flecha, tarjeta, electrones, huecos, azar, brillo, Camino, electronesEnCamino, corrienteEnCamino, type Vista } from '../nucleo/dibujo';
  import { fuente, hilo, resistencia, diodo, nodo, masa } from '../nucleo/esquema';
  import { alfa, paleta } from '../nucleo/paleta';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  const TIPOS = {
    3.3: { rz: 20, vk: 0.22, tc: -0.0006, mec: 'tunel' },
    5.6: { rz: 6, vk: 0.12, tc: 0.0001, mec: 'ambos' },
    12: { rz: 9, vk: 0.08, tc: 0.0007, mec: 'avalancha' },
  } as const;
  type Vz = keyof typeof TIPOS;
  let vz = $state<Vz>(5.6);
  let Vin = $state(12);
  let RL = $state(470);
  let T = $state(25);
  const RS = 220;

  const z = $derived(TIPOS[vz]);
  const vzT = $derived(vz * (1 + z.tc * (T - 25)));
  const iz = (v: number) => (z.vk / z.rz) * Math.log1p(Math.exp(Math.min(60, (v - vzT) / z.vk)));

  const punto = $derived.by(() => {
    let lo = 0;
    let hi = Vin;
    for (let k = 0; k < 60; k++) {
      const m = (lo + hi) / 2;
      const f = (Vin - m) / RS - (RL > 0 ? m / RL : 0) - iz(m);
      if (f > 0) lo = m;
      else hi = m;
    }
    const vo = (lo + hi) / 2;
    return { vo, iz: iz(vo), il: RL > 0 ? vo / RL : 0, is: (Vin - vo) / RS };
  });

  const rnd = azar(31);
  let t = 0;
  let fase = 0;
  const cascada: { x: number; y: number; vx: number; vy: number; tipo: 'e' | 'h'; vida: number }[] = [];
  let acum = 0;
  function paso(dt: number): void {
    t += dt;
    fase += dt * 60;
    // Breakdown events at a rate that follows I_Z.
    acum += dt * Math.min(12, punto.iz * 600);
    while (acum >= 1) {
      acum -= 1;
      cascada.push({ x: 0, y: rnd() * 0.8 + 0.1, vx: 1, vy: 0, tipo: 'e', vida: 0 });
    }
    for (const c of cascada) c.vida += dt;
    while (cascada.length && cascada[0]!.vida > 1.6) cascada.shift();
  }

  function bandas(v: Vista, x0: number, y0: number, w: number, h: number): void {
    const { ctx } = v;
    const p = pal;
    tarjeta(v, x0, y0, w, h, z.mec === 'tunel' ? 'Dentro: efecto túnel' : z.mec === 'avalancha' ? 'Dentro: avalancha' : 'Dentro: túnel y avalancha a la vez');
    // Band diagram under reverse bias: bands drop from P (left) to N (right).
    const ix0 = x0 + 20;
    const ix1 = x0 + w - 20;
    const xm = (ix0 + ix1) / 2;
    const anchoW = z.mec === 'tunel' ? 18 : z.mec === 'ambos' ? 46 : 120;
    const gap = 40;
    const caida = h * 0.42;
    const yc0 = y0 + 50;
    const banda = (desp: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(ix0, yc0 + desp);
      ctx.lineTo(xm - anchoW / 2, yc0 + desp);
      ctx.bezierCurveTo(xm, yc0 + desp, xm, yc0 + desp + caida, xm + anchoW / 2, yc0 + desp + caida);
      ctx.lineTo(ix1, yc0 + desp + caida);
      ctx.stroke();
    };
    banda(0, p.electron);
    banda(gap, p.hueco);
    txtRico(v, 'E_C', ix0 + 4, yc0 - 10, { tam: 11.5, alin: 'left', color: p.electron });
    txtRico(v, 'E_V', ix0 + 4, yc0 + gap + 12, { tam: 11.5, alin: 'left', color: p.hueco });
    txt(v, 'P', ix0 + 30, y0 + h - 14, { tam: 13, peso: 800, color: p.hueco });
    txt(v, 'N', ix1 - 30, y0 + h - 14, { tam: 13, peso: 800, color: p.electron });
    // Valence electrons on the P side (filled band) and conduction electrons on the N side.
    const llenos: { x: number; y: number }[] = [];
    for (let k = 0; k < 10; k++) llenos.push({ x: ix0 + 14 + k * ((xm - anchoW / 2 - ix0 - 20) / 10), y: yc0 + gap + 10 });
    electrones(ctx, llenos, 3, p);
    const k = Math.min(1, punto.iz * 80);
    for (const c of cascada) {
      const u = c.vida / 1.6;
      if (z.mec !== 'avalancha') {
        // Tunnelling: horizontal crossing from the P valence band to the N conduction band.
        const y = yc0 + gap + 10;
        const xa = xm - anchoW / 2 - 6;
        const xb = xm + anchoW / 2 + 6;
        const x = xa + (xb - xa) * Math.min(1, u * 2.5);
        electrones(ctx, [{ x, y }], 3.4, p);
        if (u < 0.4) brillo(ctx, x, y, 10, p.electron, 0.4);
      }
      if (z.mec !== 'tunel') {
        // Avalanche: an electron slides down the slope and knocks out pairs.
        const xs = xm - anchoW / 2 + anchoW * Math.min(1, u * 1.4);
        const ys = yc0 - 6 + caida * Math.min(1, u * 1.4) * 0.9;
        electrones(ctx, [{ x: xs, y: ys }], 3.4, p);
        if (u > 0.35 && u < 0.8) {
          const xc = xm;
          brillo(ctx, xc, yc0 + caida * 0.5, 14, p.corriente, 0.5);
          electrones(ctx, [{ x: xc + (u - 0.35) * 120, y: yc0 + caida * 0.5 + (u - 0.35) * 60 }], 3, p);
          huecos(ctx, [{ x: xc - (u - 0.35) * 120, y: yc0 + caida * 0.5 + gap - (u - 0.35) * 40 }], 3, p);
        }
      }
    }
    if (z.mec !== 'avalancha') flecha(ctx, xm - anchoW / 2 - 12, yc0 + gap + 26, xm + anchoW / 2 + 12, yc0 + gap + 26, alfa(p.electron, 0.4 + 0.6 * k), 1.6, 7, [4, 3]);
    txt(v, `W ≈ ${z.mec === 'tunel' ? 'nanómetros' : z.mec === 'ambos' ? 'decenas de nm' : 'cientos de nm'}`, xm, y0 + h - 14, { tam: 11.5, color: p.suave });
  }

  function dibujar(v: Vista): void {
    void [vz, Vin, RL, T];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const xs = est ? 70 : 90;
    const xn = est ? 250 : 270;
    const xl = est ? 380 : 400;
    const yT = 70;
    const yB = est ? 270 : 300;
    const ym = (yT + yB) / 2;
    fuente(v, xs, ym, 24, 'dc', { rotulo: `${num(Vin, 1)} V`, lado: -1 });
    hilo(v, [
      [xs, ym - 24],
      [xs, yT],
      [xs + 40, yT],
    ]);
    resistencia(v, xs + 40, yT, xn - 40, yT, { largo: 60 });
    txtRico(v, `R_S = ${RS} Ω`, (xs + xn) / 2 - 20, yT - 22, { tam: 13 });
    hilo(v, [
      [xn - 40, yT],
      [xl, yT],
    ]);
    nodo(v, xn, yT);
    // Zener: cathode up (reverse biased).
    hilo(v, [
      [xn, yT],
      [xn, ym - 20],
    ]);
    diodo(v, xn, ym + 20, xn, ym - 20, { tipo: 'zener', conduce: Math.min(1, punto.iz * 60) });
    hilo(v, [
      [xn, ym + 20],
      [xn, yB],
    ]);
    txtRico(v, `V_Z = ${num(vz, 1)} V`, xn + 22, ym, { alin: 'left', tam: 13, peso: 700 });
    if (RL > 0) {
      hilo(v, [
        [xl, yT],
        [xl, ym - 30],
      ]);
      resistencia(v, xl, ym - 30, xl, ym + 30, { largo: 56 });
      hilo(v, [
        [xl, ym + 30],
        [xl, yB],
      ]);
      txtRico(v, `R_L = ${si(RL, 'Ω', 2)}`, xl + 18, ym, { alin: 'left', tam: 13 });
    }
    hilo(v, [
      [xs, ym + 24],
      [xs, yB],
      [xl, yB],
    ]);
    masa(v, xn, yB);
    nodo(v, xn, yB);
    txtRico(v, `V_out = ${num(punto.vo, 3)} V`, xn + 60, yT - 24, { tam: 15, peso: 800, color: p.acento });
    // Current flows: source loop (I_S) splitting into Zener (I_Z) and load (I_L).
    const kz = Math.min(1, punto.iz * 40);
    const kl = Math.min(1, punto.il * 40);
    const cz = new Camino([
      [xs, ym - 24],
      [xs, yT],
      [xn, yT],
      [xn, yB],
      [xs, yB],
      [xs, ym + 24],
    ]);
    const cl = new Camino([
      [xn, yT],
      [xl, yT],
      [xl, yB],
      [xn, yB],
    ]);
    if (kz > 0.03) {
      electronesEnCamino(ctx, cz, -fase, 22, 3.2, p, kz);
      corrienteEnCamino(ctx, cz, fase * 0.6, 120, p, 10, kz);
    }
    if (kl > 0.03) {
      electronesEnCamino(ctx, cl, -fase, 22, 3.2, p, kl);
      corrienteEnCamino(ctx, cl, fase * 0.6, 120, p, 10, kl);
    }
    txtRico(v, `I_Z = ${si(punto.iz, 'A', 3)}`, xn - 14, yB + 26, { tam: 13, peso: 700, color: p.corriente, alin: 'right' });
    txtRico(v, `I_L = ${si(punto.il, 'A', 3)}`, xl + 14, yB + 26, { tam: 13, peso: 700, color: p.corriente, alin: 'left' });
    if (est) bandas(v, 20, yB + 50, v.w - 40, v.h - yB - 60);
    else bandas(v, 530, 30, v.w - 550, v.h - 60);
  }

  const curva = $derived.by(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let k = 0; k <= 200; k++) {
      const vv = (k / 200) * 16;
      xs.push(vv);
      ys.push(iz(vv));
    }
    return { xs, ys };
  });
  const recta = $derived.by(() => {
    const vth = RL > 0 ? (Vin * RL) / (RS + RL) : Vin;
    const rth = RL > 0 ? (RS * RL) / (RS + RL) : RS;
    return { x: [0, vth], y: [vth / rth, 0] };
  });

  const texto = $derived.by(() => {
    const mec =
      z.mec === 'tunel'
        ? `Con V_Z = ${num(vz, 1)} V la unión es tan delgada que el campo arranca electrones de la banda de valencia y los hace **atravesar la barrera por efecto túnel**. Su coeficiente de temperatura es negativo: a ${num(T, 0)} °C, V_Z = ${num(vzT, 3)} V.`
        : z.mec === 'avalancha'
          ? `Con V_Z = ${num(vz, 0)} V la zona es más ancha: los electrones se aceleran, chocan con la red y **arrancan pares** que a su vez se aceleran (avalancha). Coeficiente positivo: a ${num(T, 0)} °C, V_Z = ${num(vzT, 3)} V.`
          : `Hacia 5,6 V conviven el túnel (coeficiente negativo) y la avalancha (positivo) y **se compensan**: a ${num(T, 0)} °C, V_Z = ${num(vzT, 3)} V.`;
    const reg =
      punto.iz > 1e-3
        ? `**Regulando:** R_S toma la diferencia entre ${num(Vin, 1)} V y V_Z, y el Zener absorbe la corriente que la carga no usa (${si(punto.iz, 'A', 3)}).`
        : `**Sin regular:** con ${num(Vin, 1)} V a la entrada no queda corriente para el Zener; la salida, ${num(punto.vo, 2)} V, la fija el divisor R_S–R_L.`;
    return reg + '\n' + mec;
  });
  const lecturas = $derived([
    { e: 'V_out', v: `${num(punto.vo, 3)} V`, c: pal.acento },
    { e: 'I_Z', v: si(punto.iz, 'A', 3), c: pal.corriente },
    { e: 'I_L', v: si(punto.il, 'A', 3) },
    { e: 'Potencia en el Zener', v: si(punto.vo * punto.iz, 'W', 3) },
    { e: 'Potencia en R_S', v: si(punto.is * punto.is * RS, 'W', 3) },
  ]);

  // 3D view of the page (componentes/tres): the model follows these controls.
  compartir3d(() => ({ vz }));
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['electron', 'hueco', 'corriente']}>
  {#snippet modos()}
    <Selector
      bind:valor={vz}
      opciones={[
        { valor: 3.3, texto: 'Zener de 3,3 V' },
        { valor: 5.6, texto: 'Zener de 5,6 V' },
        { valor: 12, texto: 'Zener de 12 V' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 620] : [900, 400])} etiqueta="Regulador Zener y mecanismo de ruptura" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Tensión de entrada" bind:valor={Vin} min={0} max={20} paso={0.1} unidad="V" />
    <Selector
      etiqueta="Carga R_L"
      bind:valor={RL}
      opciones={[
        { valor: 0, texto: 'Sin carga' },
        { valor: 2200, texto: '2,2 kΩ' },
        { valor: 470, texto: '470 Ω' },
        { valor: 150, texto: '150 Ω' },
      ]}
    />
    <Deslizador etiqueta="Temperatura" bind:valor={T} min={-20} max={120} paso={1} formato={(x) => `${num(x, 0)} °C`} />
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Curva del Zener en inversa y recta de carga"
      x={{ etiqueta: 'V_Z', unidad: 'V', min: 0, max: 16 }}
      y={{ etiqueta: 'I_Z', unidad: 'A', min: 0, max: 0.1 }}
      series={[
        { x: curva.xs, y: curva.ys, color: pal.acento, nombre: 'Zener' },
        { x: recta.x, y: recta.y, color: pal.tenue, discontinua: true, nombre: 'recta de carga' },
      ]}
      puntos={[{ x: punto.vo, y: punto.iz, color: pal.corriente, etiqueta: `${num(punto.vo, 2)} V` }]}
    />
  {/snippet}
</Marco>
