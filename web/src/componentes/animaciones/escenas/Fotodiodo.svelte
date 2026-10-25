<script lang="ts">
  // Photodiode (book 44.1 and 44.3): photons absorbed in or near the depletion region create electron-hole
  // pairs that the field separates; the photocurrent I_ph = R·P adds to the diode equation:
  // I = I_S·(e^(V/V_T) − 1) − I_ph. Reverse biased it is a light-controlled current source; open-circuited it
  // is a solar cell with V_oc = V_T·ln(I_ph/I_S + 1).
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Selector from '../ui/Selector.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj } from '../nucleo/reloj.svelte';
  import { SimUnion } from '../nucleo/union';
  import { txt, txtRico, fondo, foton, rr, azar, Camino, electronesEnCamino, corrienteEnCamino, type Vista } from '../nucleo/dibujo';
  import { fuente } from '../nucleo/esquema';
  import { paleta } from '../nucleo/paleta';
  import { shockley, vt } from '../nucleo/fisica';
  import { si, num } from '../nucleo/formato';
  import { app } from '../../../lib/estado.svelte';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  const sim = new SimUnion();
  const RESP = 0.5; // A/W at about 850 nm
  const AREA = 1e-6; // 1 mm²
  const IS = 1e-10;

  let E = $state(300);
  let modo = $state<'inversa' | 'circuito'>('inversa');
  let Vr = $state(5);

  const Iph = $derived(RESP * E * AREA);
  const V = $derived(modo === 'inversa' ? -Vr : vt() * Math.log(Iph / IS + 1));
  const I = $derived(modo === 'inversa' ? shockley(-Vr, IS) - Iph : 0);
  const Voc = $derived(vt() * Math.log(Iph / IS + 1));

  const rnd = azar(51);
  const lluvia = Array.from({ length: 30 }, () => ({ x: rnd(), t: rnd() * 1.2 }));
  let fase = 0;
  function paso(dt: number): void {
    sim.generacion = Math.min(26, E * 0.035);
    sim.paso(dt);
    fase += dt * Math.min(90, 10 + Math.abs(I) * 2e5);
  }

  function dibujar(v: Vista): void {
    void [E, modo, Vr];
    const { ctx } = v;
    const p = pal;
    fondo(v);
    const est = v.estrecho;
    const x0 = est ? 40 : 70;
    const x1 = v.w - x0;
    const y0 = est ? 200 : 170;
    const y1 = est ? v.h - 50 : v.h - 40;
    sim.configurar({ x0, x1, y0, y1, xj: x0 + (x1 - x0) * 0.2, nmU: 6000 / (x1 - x0) }, 1e18, 1e15);
    sim.v = Math.min(V, 0.55);
    // Light falling on the junction (top window).
    const n = Math.round(Math.min(30, E / 25));
    for (let k = 0; k < n; k++) {
      const q = lluvia[k]!;
      const u = ((q.t + v.t * 0.9) % 1.2) / 1.2;
      const x = x0 + 30 + q.x * (x1 - x0 - 60);
      const y = y0 - 110 + u * 120;
      if (y < y0 + 4) foton(ctx, x, y, Math.PI / 2, '#d4a017', 22, 3.5, Math.sin(Math.PI * Math.min(1, u * 1.05)));
    }
    sim.dibujar(v);
    // Both on one line: each keeps to its share of the width (narrow phones, wider fonts).
    txt(v, 'P⁺ (capa delgada, frente a la luz)', x0, y0 - 12, { tam: 12, peso: 700, color: p.hueco, alin: 'left', max: (x1 - x0) * 0.6 - 8 });
    txt(v, 'N (poco dopado)', x1, y0 - 12, { tam: 12, peso: 700, color: p.electron, alin: 'right', max: (x1 - x0) * 0.4 - 8 });
    // External circuit.
    const yTop = est ? 60 : 44;
    const xc = v.w / 2;
    const camino = new Camino([
      [x1 + 4, y0],
      [x1 + 4, yTop],
      [x0 - 4, yTop],
      [x0 - 4, y0],
    ]);
    ctx.strokeStyle = p.hilo;
    ctx.lineWidth = 2.4;
    camino.trazar(ctx);
    ctx.stroke();
    if (modo === 'inversa') {
      ctx.save();
      ctx.translate(xc, yTop);
      ctx.rotate(Math.PI / 2);
      fuente(v, 0, 0, 20, 'dc');
      ctx.restore();
      txtRico(v, `−${num(Vr, 1)} V (inversa)`, xc, yTop + 34, { tam: 13, peso: 700, color: p.acento });
      // Photocurrent flows reverse: out of the N contact through the circuit into P (electrons the other way).
      electronesEnCamino(ctx, camino, fase, 24, 3.2, p, Math.min(1, Math.abs(I) * 4e3 + 0.1));
      corrienteEnCamino(ctx, camino, -fase * 0.6, 120, p, 11, Math.min(1, Math.abs(I) * 4e3 + 0.1));
      txtRico(v, `I = ${si(I, 'A', 3)}`, xc, yTop + 56, { tam: 14, peso: 800, color: p.corriente });
    } else {
      rr(ctx, xc - 40, yTop - 16, 80, 32, 8);
      ctx.fillStyle = p.panel;
      ctx.fill();
      ctx.strokeStyle = p.tinta;
      ctx.stroke();
      txt(v, 'V', xc, yTop, { tam: 16, peso: 800 });
      txtRico(v, `V_oc = ${num(Voc, 3)} V`, xc, yTop + 34, { tam: 14, peso: 800, color: p.acento });
    }
  }

  const curvas = $derived.by(() => {
    const xs: number[] = [];
    const luz: number[] = [];
    const osc: number[] = [];
    for (let k = 0; k <= 200; k++) {
      const vv = -2 + (k / 200) * 2.6;
      xs.push(vv);
      osc.push(shockley(vv, IS));
      luz.push(shockley(vv, IS) - Iph);
    }
    return { xs, luz, osc };
  });

  const texto = $derived(
    `Cada fotón absorbido cerca de la unión crea un **par electrón-hueco**; el campo de la zona de agotamiento los separa enseguida (el electrón al N, el hueco al P) antes de que se recombinen. Con ${num(E, 0)} W/m² sobre 1 mm² y 0,5 A/W, I_ph = ${si(Iph, 'A', 3)}.\n` +
      (modo === 'inversa'
        ? `En **inversa** la zona es ancha y rápida: la corriente, ${si(I, 'A', 3)}, es proporcional a la luz y casi no depende de la tensión. Es el modo de los detectores.`
        : `En **circuito abierto** los portadores separados se acumulan y polarizan la unión en directa hasta que la fuga iguala a la fotocorriente: V_oc = V_T·ln(I_ph/I_S + 1) = ${num(Voc, 3)} V. Es una célula solar.`),
  );
  const lecturas = $derived([
    { e: 'Fotocorriente I_ph', v: si(Iph, 'A', 3), c: pal.corriente },
    { e: modo === 'inversa' ? 'Corriente del circuito' : 'Tensión en circuito abierto', v: modo === 'inversa' ? si(I, 'A', 3) : `${num(Voc, 3)} V`, c: pal.acento },
    { e: 'Corriente de oscuridad', v: si(IS, 'A', 2) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['foton', 'electron', 'hueco', 'campoE', 'corriente']}>
  {#snippet modos()}
    <Selector bind:valor={modo} opciones={[{ valor: 'inversa', texto: 'Polarizado en inversa' }, { valor: 'circuito', texto: 'Circuito abierto (célula solar)' }]} />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [560, 520] : [900, 420])} etiqueta="Fotodiodo: fotones creando pares en la unión" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Irradiancia" bind:valor={E} min={0} max={1000} paso={10} unidad="W/m²" formato={(x) => `${num(x, 0)} W/m²`} />
    {#if modo === 'inversa'}
      <Deslizador etiqueta="Tensión inversa" bind:valor={Vr} min={0} max={10} paso={0.5} unidad="V" />
    {/if}
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Curva I-V con luz y en oscuridad"
      x={{ etiqueta: 'V', unidad: 'V', min: -2, max: 0.6 }}
      y={{ etiqueta: 'I', unidad: 'A', min: -6e-4, max: 2e-4 }}
      series={[
        { x: curvas.xs, y: curvas.osc, color: pal.tenue, discontinua: true, nombre: 'oscuridad' },
        { x: curvas.xs, y: curvas.luz, color: pal.acento, nombre: 'con luz' },
      ]}
      puntos={[{ x: Math.max(-2, V), y: I, color: pal.corriente, etiqueta: modo === 'inversa' ? si(I, 'A', 3) : `V_oc` }]}
    />
  {/snippet}
</Marco>
