<script lang="ts">
  // The operational amplifier with negative feedback (book 26.1–26.3): with enormous open-loop gain A₀ the
  // output moves until the inputs are almost equal (v_d = v_out/A₀, microvolts). Inverting: G = −R_f/R_in and
  // the inverting input is a virtual ground; non-inverting: G = 1 + R_f/R_in; without feedback it is a
  // comparator that slams into the rails.
  import { compartir3d } from '../../tres/compartir.svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { txt, txtRico, fondo, rr, circulo, Camino, corrienteEnCamino, type Vista } from '../nucleo/dibujo';
  import { hilo, resistencia, fuente, masa, nodo, terminal } from '../nucleo/esquema';
  import { alfa, paleta } from '../nucleo/paleta';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  type Modo = 'inversor' | 'noinversor' | 'seguidor' | 'comparador';
  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  let modo = $state<Modo>('inversor');
  let rin = $state(10e3);
  let rf = $state(47e3);
  let amp = $state(1);
  const A0 = 2e5;
  const VSAT = 13.5;

  const G = $derived(modo === 'inversor' ? -rf / rin : modo === 'noinversor' ? 1 + rf / rin : modo === 'seguidor' ? 1 : A0);
  // Exact closed loop with finite A₀ (then clipped to the rails).
  function salida(vin: number): { vo: number; vd: number } {
    let vo: number;
    if (modo === 'inversor') {
      const b = rin / (rin + rf);
      vo = (-(rf / rin) * vin) / (1 + 1 / (A0 * b));
    } else if (modo === 'noinversor') {
      const b = rin / (rin + rf);
      vo = (A0 * vin) / (1 + A0 * b);
    } else if (modo === 'seguidor') vo = (A0 * vin) / (1 + A0);
    else vo = A0 * (vin - 0.0);
    vo = Math.max(-VSAT, Math.min(VSAT, vo));
    const vd =
      modo === 'comparador'
        ? vin
        : modo === 'inversor'
          ? 0 - (vin * rf + vo * rin) / (rin + rf)
          : modo === 'noinversor'
            ? vin - (vo * rin) / (rin + rf)
            : vin - vo;
    return { vo, vd };
  }

  const PERIODO = 3;
  let t = 0;
  function paso(dt: number): void {
    t += dt;
  }

  function dibujar(v: Vista): void {
    void [modo, rin, rf, amp];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const th = ((t / PERIODO) % 1) * 2 * Math.PI;
    const vin = amp * Math.sin(th);
    const { vo, vd } = salida(vin);
    // Op-amp triangle.
    const ox = est ? 300 : 330;
    const oy = 200;
    const W = 120;
    const H = 130;
    ctx.beginPath();
    ctx.moveTo(ox - W / 2, oy - H / 2);
    ctx.lineTo(ox + W / 2, oy);
    ctx.lineTo(ox - W / 2, oy + H / 2);
    ctx.closePath();
    ctx.fillStyle = p.panel;
    ctx.fill();
    ctx.strokeStyle = p.tinta;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    const yInv = oy - 30;
    const yNo = oy + 30;
    txt(v, '−', ox - W / 2 + 14, yInv, { tam: 18, peso: 800 });
    txt(v, '+', ox - W / 2 + 14, yNo, { tam: 18, peso: 800 });
    txtRico(v, `A_0 = 2×10⁵`, ox - 8, oy, { tam: 11.5, color: p.suave });
    const xo = ox + W / 2;
    const xOut = xo + (est ? 60 : 110);
    hilo(v, [
      [xo, oy],
      [xOut, oy],
    ]);
    terminal(v, xOut + 4, oy);
    const sat = Math.abs(vo) >= VSAT - 0.01;
    txtRico(v, `v_out = ${num(vo, 2)} V`, xOut + 12, oy - 20, { tam: 15, peso: 800, color: sat ? p.peligro : p.acento, alin: 'left' });
    if (sat) txt(v, 'saturada', xOut + 12, oy + 4, { tam: 12.5, peso: 800, color: p.peligro, alin: 'left' });
    const xIn = est ? 60 : 80;
    // Input source.
    const yS = modo === 'inversor' ? yInv : yNo;
    fuente(v, xIn, oy + 70, 22, 'ac', { lado: -1 });
    masa(v, xIn, oy + 92);
    hilo(v, [
      [xIn, oy + 48],
      [xIn, yS],
    ]);
    if (modo === 'inversor') {
      hilo(v, [
        [xIn, yInv],
        [xIn + 40, yInv],
      ]);
      resistencia(v, xIn + 40, yInv, xIn + 110, yInv, { largo: 46 });
      hilo(v, [
        [xIn + 110, yInv],
        [ox - W / 2, yInv],
      ]);
      hilo(v, [
        [ox - W / 2 - 30, yNo],
        [ox - W / 2, yNo],
      ]);
      masa(v, ox - W / 2 - 30, yNo);
      txtRico(v, `R_in ${si(rin, 'Ω', 2)}`, xIn + 75, yInv + 24, { tam: 12.5 });
      txt(v, 'masa virtual', ox - W / 2 - 28, yInv - 20, { tam: 12.5, peso: 800, color: p.campoE, alin: 'right' });
    } else {
      hilo(v, [
        [xIn, yNo],
        [ox - W / 2, yNo],
      ]);
    }
    // Feedback network.
    const yF = oy - H / 2 - 40;
    if (modo !== 'comparador') {
      const xn = ox - W / 2 - 20;
      nodo(v, xn, yInv);
      if (modo === 'seguidor')
        hilo(v, [
          [xn, yInv],
          [xn, yF],
          [xOut - 30, yF],
          [xOut - 30, oy],
        ]);
      else {
        hilo(v, [
          [xn, yInv],
          [xn, yF],
          [xn + 40, yF],
        ]);
        resistencia(v, xn + 40, yF, xn + 130, yF, { largo: 54 });
        hilo(v, [
          [xn + 130, yF],
          [xOut - 30, yF],
          [xOut - 30, oy],
        ]);
        txtRico(v, `R_f ${si(rf, 'Ω', 2)}`, xn + 85, yF - 22, { tam: 12.5 });
        if (modo === 'noinversor') {
          hilo(v, [
            [xn, yInv],
            [xn - 40, yInv],
            [xn - 40, yInv + 10],
          ]);
          resistencia(v, xn - 40, yInv + 10, xn - 40, yInv + 70, { largo: 40 });
          masa(v, xn - 40, yInv + 70);
          txtRico(v, `R_in ${si(rin, 'Ω', 2)}`, xn - 56, yInv + 40, { tam: 12.5, alin: 'right' });
        }
        // Feedback current (conventional), its size tied to v_out.
        const cam = new Camino([
          [xOut - 30, oy],
          [xOut - 30, yF],
          [xn, yF],
          [xn, yInv],
        ]);
        const k = Math.min(1, Math.abs(vo) / 10);
        corrienteEnCamino(ctx, cam, (vo >= 0 ? 1 : -1) * t * 60, 60, p, 10, k);
      }
      nodo(v, xOut - 30, oy);
    }
    // Input values and the tiny differential voltage.
    txtRico(v, `v_in = ${num(vin, 2)} V`, xIn - 10, oy + 120, { tam: 14, peso: 800, color: p.serie[0], alin: 'left' });
    rr(ctx, ox - 90, oy + H / 2 + 28, 180, 34, 17);
    ctx.fillStyle = alfa(p.campoE, 0.1);
    ctx.fill();
    txtRico(v, `v_{+} − v_{−} = ${si(vd, 'V', 2)}`, ox, oy + H / 2 + 45, { tam: 13.5, peso: 800, color: p.campoE });
    // Rails.
    txt(v, '+15 V', ox, oy - H / 2 - 8, { tam: 11.5, color: p.positivo });
    txt(v, '−15 V', ox, oy + H / 2 + 12, { tam: 11.5, color: p.suave });
    // Mini scope.
    if (!est) {
      const sx0 = 620;
      const sx1 = v.w - 20;
      const sy0 = 60;
      const sy1 = 340;
      rr(ctx, sx0, sy0, sx1 - sx0, sy1 - sy0, 10);
      ctx.fillStyle = p.panel;
      ctx.fill();
      ctx.strokeStyle = p.linea;
      ctx.stroke();
      const Y = (val: number) => (sy0 + sy1) / 2 - (val / 15) * ((sy1 - sy0) / 2 - 10);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = alfa(p.peligro, 0.5);
      ctx.beginPath();
      ctx.moveTo(sx0 + 6, Y(VSAT));
      ctx.lineTo(sx1 - 6, Y(VSAT));
      ctx.moveTo(sx0 + 6, Y(-VSAT));
      ctx.lineTo(sx1 - 6, Y(-VSAT));
      ctx.stroke();
      ctx.setLineDash([]);
      const traza = (fn: (a: number) => number, c: string) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let k = 0; k <= 120; k++) {
          const a = th - (1 - k / 120) * Math.PI * 4;
          const x = sx0 + 10 + (k / 120) * (sx1 - sx0 - 20);
          const y = Y(fn(a));
          if (k) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
      };
      traza((a) => amp * Math.sin(a), p.serie[0]);
      traza((a) => salida(amp * Math.sin(a)).vo, p.acento);
      circulo(ctx, sx1 - 10, Y(vo), 4.5, p.acento);
      txtRico(v, 'v_in', sx0 + 12, sy0 + 14, { tam: 12, alin: 'left', peso: 800, color: p.serie[0] });
      txtRico(v, 'v_out', sx0 + 50, sy0 + 14, { tam: 12, alin: 'left', peso: 800, color: p.acento });
    }
  }

  const ondas = $derived.by(() => {
    const xs: number[] = [];
    const a: number[] = [];
    const b: number[] = [];
    for (let k = 0; k <= 200; k++) {
      const x = (k / 200) * 2 * Math.PI;
      xs.push(x / (2 * Math.PI));
      a.push(amp * Math.sin(x));
      b.push(salida(amp * Math.sin(x)).vo);
    }
    return { xs, a, b };
  });

  const texto = $derived.by(() => {
    if (modo === 'comparador')
      return '**Sin realimentación** la ganancia es la de lazo abierto, 200 000: cualquier microvoltio de diferencia lleva la salida a una de las tensiones de saturación. Es un comparador, no un amplificador lineal.\nLas «reglas de oro» (entradas iguales) solo valen cuando hay realimentación negativa.';
    const g = modo === 'inversor' ? `G = −R_f/R_in = ${num(G, 2)}` : modo === 'noinversor' ? `G = 1 + R_f/R_in = ${num(G, 2)}` : 'G = 1';
    const sat = Math.max(...ondas.b.map(Math.abs)) >= VSAT - 0.01;
    return (
      `**Realimentación negativa:** la salida se mueve justo lo necesario para que las dos entradas casi se igualen; la diferencia que queda es v_out/A_0, microvoltios. El resultado lo fijan las resistencias, no el operacional: ${g}.` +
      (modo === 'inversor' ? ' La entrada inversora está a 0 V sin estar conectada a masa: es la **masa virtual**.' : modo === 'seguidor' ? ' El seguidor copia la entrada con impedancia de entrada altísima y de salida casi nula.' : ' La entrada ve la impedancia altísima de la entrada no inversora.') +
      (sat ? `\nCon ${num(amp, 1)} V de pico la salida pediría ${num(Math.abs(G) * amp, 1)} V: **recorta** en la saturación (unos ±13,5 V con ±15 V de alimentación).` : '')
    );
  });
  const lecturas = $derived([
    { e: 'Ganancia', v: modo === 'comparador' ? '2×10⁵ (lazo abierto)' : num(G, 2), c: pal.acento },
    { e: 'Pico de salida', v: `${num(Math.max(...ondas.b.map(Math.abs)), 2)} V` },
    { e: 'Diferencia entre entradas (pico)', v: si(modo === 'comparador' ? amp : Math.max(...ondas.b.map(Math.abs)) / A0, 'V', 2) },
  ]);

  // 3D view of the page (componentes/tres): the model follows these controls.
  compartir3d(() => ({ modo }));
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['corriente']}>
  {#snippet modos()}
    <Selector
      bind:valor={modo}
      opciones={[
        { valor: 'inversor', texto: 'Inversor' },
        { valor: 'noinversor', texto: 'No inversor' },
        { valor: 'seguidor', texto: 'Seguidor' },
        { valor: 'comparador', texto: 'Sin realimentación' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 440] : [900, 400])} etiqueta="Amplificador operacional con realimentación" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Amplitud de entrada" bind:valor={amp} min={0.01} max={5} log unidad="V" />
    {#if modo === 'inversor' || modo === 'noinversor'}
      <Deslizador etiqueta="R_in" bind:valor={rin} min={1e3} max={100e3} log unidad="Ω" />
      <Deslizador etiqueta="R_f" bind:valor={rf} min={1e3} max={1e6} log unidad="Ω" />
    {/if}
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Entrada y salida durante un periodo"
      x={{ etiqueta: 'fracción del periodo', unidad: '', min: 0, max: 1 }}
      y={{ etiqueta: 'v', unidad: 'V', min: -15, max: 15 }}
      series={[
        { x: ondas.xs, y: ondas.a, color: pal.serie[0], nombre: 'v_in' },
        { x: ondas.xs, y: ondas.b, color: pal.acento, nombre: 'v_out' },
      ]}
      lineas={[{ y: VSAT, color: pal.peligro }, { y: -VSAT, color: pal.peligro }]}
    />
  {/snippet}
</Marco>
