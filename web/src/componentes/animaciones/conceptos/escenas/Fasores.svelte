<script lang="ts">
  // Phasors (book 0.3, 0.5, 0.9 and 23.4): a sinusoid is the projection of a rotating vector; its amplitude
  // and phase are one complex number. Sums of sinusoids of the same frequency are vector sums (the RC of
  // section 0.9 at 1 kHz: 0,532 V on R and 0,847 V on C add up to 1 V, not 1,38 V), and differentiating is
  // multiplying by jω: a turn of +90° and a factor ω.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txtRico, flecha, circulo, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { num } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, type Ejes } from '../nucleo/grafica';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  let modo = $state<'uno' | 'suma' | 'derivada'>('uno');
  let A = $state(1);
  let fa = $state(30);
  let B = $state(0.847);
  let fb = $state(-32.1);
  let A2 = $state(0.532);
  let fa2 = $state(57.9);

  function rc(): void {
    A2 = 0.532;
    fa2 = 57.9;
    B = 0.847;
    fb = -32.1;
  }

  // One turn every 4 s on screen (slow motion of the real 1 kHz or 50 Hz).
  const PER = 4;
  let th = 0;
  let n = $state(0);
  const muestreo = new Muestreo(80);
  $effect(() => {
    if (reloj.reinicios >= 0) th = 0;
  });
  function paso(dt: number): void {
    th = (th + (2 * Math.PI * dt) / PER) % (2 * Math.PI);
    if (muestreo.toca()) n++;
  }

  interface Fasor {
    r: number;
    a: number; // degrees
    color: string;
    nombre: string;
  }

  const fasores = $derived.by((): Fasor[] => {
    const p = pal;
    if (modo === 'uno') return [{ r: A, a: fa, color: p.acento, nombre: 'V' }];
    if (modo === 'suma') {
      const re = A2 * Math.cos((fa2 * Math.PI) / 180) + B * Math.cos((fb * Math.PI) / 180);
      const im = A2 * Math.sin((fa2 * Math.PI) / 180) + B * Math.sin((fb * Math.PI) / 180);
      return [
        { r: A2, a: fa2, color: p.serie[0], nombre: 'V_R' },
        { r: B, a: fb, color: p.serie[1], nombre: 'V_C' },
        { r: Math.hypot(re, im), a: (Math.atan2(im, re) * 180) / Math.PI, color: p.acento, nombre: 'V' },
      ];
    }
    return [
      { r: A, a: fa, color: p.acento, nombre: 'v' },
      { r: A, a: fa + 90, color: p.serie[1], nombre: 'dv/dt ÷ ω' },
    ];
  });

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const R = est ? 120 : 140;
    const cx = est ? 160 : 175;
    const cy = est ? 175 : 190;
    const rmax = Math.max(1, ...fasores.map((f) => f.r)) * 1.08;
    const k = R / rmax;
    const e: Ejes = est
      ? { x: 340, y: 55, w: 240, h: 240, x0: 0, x1: 2, y0: -rmax, y1: rmax }
      : { x: 370, y: 50, w: 500, h: 280, x0: 0, x1: 2, y0: -rmax, y1: rmax };
    // Keep the time plot's vertical scale equal to the circle's so the projection lines are horizontal.
    e.y = cy - R * (e.y1 / rmax);
    e.h = 2 * R;
    estatico(v, `fa:${est}:${rmax.toFixed(3)}`, (vv) => {
      const c = vv.ctx;
      c.strokeStyle = p.rejilla;
      c.lineWidth = 1;
      c.beginPath();
      c.arc(cx, cy, R, 0, Math.PI * 2);
      c.moveTo(cx - R - 12, cy);
      c.lineTo(cx + R + 12, cy);
      c.moveTo(cx, cy - R - 12);
      c.lineTo(cx, cy + R + 12);
      c.stroke();
      txtRico(vv, 'Re', cx + R + 16, cy + 12, { tam: 11.5, color: p.suave, alin: 'right' });
      txtRico(vv, 'Im', cx + 8, cy - R + 2, { tam: 11.5, color: p.suave, alin: 'left' });
      panel(vv, e, { titulo: 'Proyección: Im{V·e^{jωt}} = V·sen(ωt + φ)', fmtX: (x) => `${num(x, 1).replace(',0', '')} T`, uy: 'V', cero: true });
    });

    // Rotating phasors.
    const rot = th;
    const pts = fasores.map((f) => {
      const a = (f.a * Math.PI) / 180 + rot;
      return { f, x: cx + f.r * k * Math.cos(a), y: cy - f.r * k * Math.sin(a), a };
    });
    if (modo === 'suma') {
      // Parallelogram: V_C drawn from the tip of V_R.
      const a0 = pts[0]!;
      const b0 = pts[1]!;
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = alfa(p.serie[1], 0.7);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(a0.x, a0.y);
      ctx.lineTo(a0.x + (b0.x - cx), a0.y + (b0.y - cy));
      ctx.stroke();
      ctx.restore();
    }
    for (const q of pts) {
      flecha(ctx, cx, cy, q.x, q.y, q.f.color, q.f.nombre === 'V' && modo === 'suma' ? 3.4 : 2.6, 12);
      // Projection to the time plot.
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = alfa(q.f.color, 0.55);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(e.x, q.y);
      ctx.stroke();
      ctx.restore();
      circulo(ctx, e.x, q.y, 3.5, q.f.color);
    }
    // Time traces, «now» at the left edge travelling right (as a chart recorder).
    const N = 200;
    for (const f of fasores) {
      const xs = new Float64Array(N + 1);
      const ys = new Float64Array(N + 1);
      for (let i = 0; i <= N; i++) {
        const tt = (2 * i) / N;
        xs[i] = tt;
        ys[i] = f.r * Math.sin((f.a * Math.PI) / 180 + rot - 2 * Math.PI * tt);
      }
      curva(ctx, e, xs, ys, f.color, f.nombre === 'V' && modo === 'suma' ? 2.8 : 2.2);
    }
    guia(ctx, e, 'x', 0, alfa(p.tinta, 0.3));
    // Labels at the tips.
    for (const q of pts) {
      const ex = cx + (q.x - cx) * 1.0 + Math.cos(q.a) * 16;
      const ey = q.y - Math.sin(q.a) * 16;
      txtRico(v, q.f.nombre, ex, ey, { tam: 12.5, peso: 800, color: q.f.color });
    }
    txtRico(v, `ωt = ${num(((rot * 180) / Math.PI) % 360, 0)}°`, cx, cy + R + 28, { tam: 12.5, peso: 700, color: p.suave });
  }

  const texto = $derived.by(() => {
    if (modo === 'uno')
      return (
        `**El fasor** es un vector que gira a ω radianes por segundo; su proyección dibuja la senoide. Toda la información que importa en alterna está en dos números, el módulo y el ángulo: V = ${num(A, 2)}∠${num(fa, 1)}°. El ωt, común a todo el circuito, se olvida.\n` +
        `Si es el valor de pico, el eficaz es V_p/√2 = ${num(A / Math.SQRT2, 3)}; el ángulo φ adelanta la onda ${num(fa, 1)}° (${num(fa / 360, 3)} de periodo).`
      );
    if (modo === 'suma') {
      const s = fasores[2]!;
      return (
        `**Senoides de la misma frecuencia se suman como vectores.** El ejemplo de las secciones 0.9 y 23.4: un RC de 1 kΩ y 100 nF a 1 kHz con 1 V eficaz. Sobre R caen 0,532 V (en fase con la corriente, que adelanta 57,9°) y sobre C 0,847 V, retrasados 90° respecto a ella.\n` +
        `Sumados como números darían ${num(A2 + B, 2)} V; como vectores dan ${num(s.r, 3)}∠${num(s.a, 1)}°. Ese es el error clásico de quien mide con el multímetro las dos tensiones y no entiende por qué no suman la de la fuente.`
      );
    }
    return (
      `**Derivar es multiplicar por jω.** La derivada de V_p·sen(ωt + φ) es ω·V_p·cos(ωt + φ): la misma senoide, ω veces mayor y adelantada 90°. En el plano complejo, multiplicar por j es girar 90°, y por eso la bobina (v = L·di/dt) tiene Z = jωL y el condensador (i = C·dv/dt) Z = 1/(jωC).\n` +
      `Con fasores, las ecuaciones diferenciales del circuito se vuelven álgebra con números complejos: esa es toda la ventaja del método.`
    );
  });

  const lecturas = $derived.by(() => {
    if (modo === 'suma') {
      const s = fasores[2]!;
      return [
        { e: 'V_R', v: `${num(A2, 3)}∠${num(fa2, 1)}°`, c: pal.serie[0] },
        { e: 'V_C', v: `${num(B, 3)}∠${num(fb, 1)}°`, c: pal.serie[1] },
        { e: 'V = V_R + V_C', v: `${num(s.r, 3)}∠${num(s.a, 1)}°`, c: pal.acento },
        { e: 'Suma aritmética (errónea)', v: num(A2 + B, 3), c: pal.peligro },
      ];
    }
    return [
      { e: 'Módulo', v: num(A, 3), c: pal.acento },
      { e: 'Ángulo φ', v: `${num(fa, 1)}°`, c: pal.acento },
      { e: 'Forma binómica', v: `${num(A * Math.cos((fa * Math.PI) / 180), 3)} ${fa < 0 || Math.sin((fa * Math.PI) / 180) < 0 ? '−' : '+'} j${num(Math.abs(A * Math.sin((fa * Math.PI) / 180)), 3)}` },
      { e: 'Eficaz (si es de pico)', v: num(A / Math.SQRT2, 3) },
    ];
  });
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet modos()}
    <Selector
      bind:valor={modo}
      opciones={[
        { valor: 'uno', texto: 'Un fasor' },
        { valor: 'suma', texto: 'Suma de fasores' },
        { valor: 'derivada', texto: 'Derivar = ×jω' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 400] : [900, 400])} etiqueta="Fasores que giran y su proyección como senoides" />
  {/snippet}
  {#snippet controles()}
    {#if modo === 'suma'}
      <button class="boton" onclick={rc}>Ejemplo RC de 1 kHz (sección 0.9)</button>
      <Deslizador etiqueta="Módulo de V_R" bind:valor={A2} min={0} max={1.5} paso={0.001} unidad="V" cifras={3} />
      <Deslizador etiqueta="Ángulo de V_R" bind:valor={fa2} min={-180} max={180} paso={0.1} unidad="°" />
      <Deslizador etiqueta="Módulo de V_C" bind:valor={B} min={0} max={1.5} paso={0.001} unidad="V" cifras={3} />
      <Deslizador etiqueta="Ángulo de V_C" bind:valor={fb} min={-180} max={180} paso={0.1} unidad="°" />
    {:else}
      <Deslizador etiqueta="Módulo" bind:valor={A} min={0.1} max={2} paso={0.01} unidad="" />
      <Deslizador etiqueta="Ángulo φ" bind:valor={fa} min={-180} max={180} paso={1} unidad="°" />
    {/if}
  {/snippet}
</Marco>
