<script lang="ts">
  // The skin effect (book 1.14, 40.8, 4.8, 32.14): AC current crowds towards the surface of a conductor; the
  // density decays inwards with the penetration depth δ = √(ρ/(π·f·µ)) (copper: 9,33 mm at 50 Hz, 66 µm at 1 MHz).
  // The cross-section shows the exact density of a round wire, J(r) ∝ J₀(k·r) with k = (1 − j)/δ, oscillating in
  // time (the phase lags inwards: the field diffuses into the metal), and R_ac/R_dc from the same solution
  // (≈ a/(2δ) when a ≫ δ: Ø 1 mm at 1 MHz → 3,79).
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, type Ejes } from '../nucleo/grafica';
  import { c as cx, mul, div, esc, suma, mod, type C } from '../nucleo/complejo';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  const RHO = 1.72e-8;
  const MU = 4e-7 * Math.PI;
  let f = $state(1e6);
  let d = $state(1e-3);

  const delta = $derived(Math.sqrt(RHO / (Math.PI * f * MU)));
  const a = $derived(d / 2);
  const kk = $derived(cx(1 / delta, -1 / delta)); // k = (1 − j)/δ

  /** J₀ and J₁ of a complex argument by their power series (|z| ≤ ~14 in practice). */
  function bessel(z: C): { j0: C; j1: C } {
    const q = esc(mul(z, z), -0.25);
    let t0: C = cx(1);
    let j0: C = cx(1);
    let t1: C = esc(z, 0.5);
    let j1: C = t1;
    for (let m = 1; m < 120; m++) {
      t0 = esc(mul(t0, q), 1 / (m * m));
      j0 = suma(j0, t0);
      t1 = esc(mul(t1, q), 1 / (m * (m + 1)));
      j1 = suma(j1, t1);
      if (mod(t0) < 1e-16 * mod(j0) && m > 4) break;
    }
    return { j0, j1 };
  }
  const exacto = $derived(a / delta <= 12);

  /** Complex current density at radius r relative to the surface value. */
  function J(r: number): C {
    if (exacto) return div(bessel(mul(kk, cx(r))).j0, bessel(mul(kk, cx(a))).j0);
    // Plane approximation: e^{−(a−r)(1+j)/δ}... with the lag sign of e^{jωt}.
    const x = (a - r) / delta;
    const m = Math.exp(-x);
    return { re: m * Math.cos(-x), im: m * Math.sin(-x) };
  }
  const ratio = $derived.by(() => {
    if (!exacto) return a / (2 * delta) + 0.25;
    // Internal impedance: Z = (k·a/2)·J₀(ka)/J₁(ka)·R_dc  →  R_ac/R_dc = Re{(k·a/2)·J₀/J₁}.
    const b = bessel(mul(kk, cx(a)));
    const z = mul(esc(kk, a / 2), div(b.j0, b.j1));
    // With J₀(ka)/J₁(ka) for k = (1 − j)/δ the real part is the resistance ratio.
    return Math.abs(z.re) < 1e-9 ? 1 : Math.max(1, z.re);
  });

  // Complex density on the rings of the cross-section and along the radius (independent of time).
  const ANILLOS = 36;
  const NPERFIL = 160;
  const tablas = $derived.by(() => {
    const anillos: C[] = [];
    for (let i = 1; i <= ANILLOS; i++) anillos.push(J(((i - 0.5) / ANILLOS) * a));
    const perfil: C[] = [];
    for (let i = 0; i <= NPERFIL; i++) perfil.push(J((i / NPERFIL) * a));
    return { anillos, perfil };
  });

  let wt = 0;
  let n = $state(0);
  const muestreo = new Muestreo(50);
  function paso(dt: number): void {
    wt += (2 * Math.PI * dt) / 2.5;
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const cxp = est ? 160 : 200;
    const cyp = est ? 180 : 200;
    const R = est ? 130 : 160;
    const e: Ejes = est ? { x: 340, y: 60, w: 230, h: 240, x0: 0, x1: 1, y0: -1.1, y1: 1.1 } : { x: 450, y: 50, w: 420, h: 300, x0: 0, x1: 1, y0: -1.1, y1: 1.1 };
    estatico(v, `ep:${est}`, (vv) => {
      panel(vv, e, { titulo: 'Densidad de corriente del centro (0) a la superficie (1)', fmtX: (x) => (x === 0 ? 'centro' : x === 1 ? 'borde' : num(x, 1)), marcasX: [0, 0.5, 1], marcasY: [-1, 0, 1], cero: true });
    });
    // Cross-section: rings coloured by the instantaneous density Re{J·e^{jωt}}.
    const anillos = ANILLOS;
    for (let i = anillos; i >= 1; i--) {
      const j = tablas.anillos[i - 1]!;
      const inst = j.re * Math.cos(wt) - j.im * Math.sin(wt);
      const m = Math.max(-1, Math.min(1, inst));
      ctx.beginPath();
      ctx.arc(cxp, cyp, (R * i) / anillos, 0, Math.PI * 2);
      ctx.fillStyle = m >= 0 ? alfa(p.corriente, 0.08 + 0.9 * m) : alfa(p.electron, 0.08 + 0.9 * -m);
      ctx.fill();
    }
    ctx.strokeStyle = p.cobre;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cxp, cyp, R, 0, Math.PI * 2);
    ctx.stroke();
    // δ ring.
    if (delta < a) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = alfa(p.tinta, 0.6);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cxp, cyp, R * (1 - delta / a), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      txtRico(v, 'δ', cxp + R * (1 - delta / (2 * a)), cyp - 6, { tam: 13, peso: 800 });
    }
    txt(v, `Ø ${si(d, 'm', 2)}`, cxp, cyp + R + 20, { tam: 12.5, peso: 700, color: p.suave });
    // Radial profile: instantaneous density, and its envelope.
    const N = NPERFIL;
    const xs = new Float64Array(N + 1);
    const yi = new Float64Array(N + 1);
    const ye = new Float64Array(N + 1);
    const yn = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const r = i / N;
      const j = tablas.perfil[i]!;
      xs[i] = r;
      yi[i] = j.re * Math.cos(wt) - j.im * Math.sin(wt);
      ye[i] = mod(j);
      yn[i] = -mod(j);
    }
    curva(ctx, e, xs, ye, alfa(p.corriente, 0.7), 1.6, [5, 4]);
    curva(ctx, e, xs, yn, alfa(p.corriente, 0.7), 1.6, [5, 4]);
    curva(ctx, e, xs, yi, p.corriente, 2.6);
    if (delta < a) guia(ctx, e, 'x', 1 - delta / a, alfa(p.tinta, 0.5));
  }

  const texto = $derived(
    `**δ = √(ρ/(π·f·µ)) = ${si(delta, 'm', 3)}** en cobre a ${si(f, 'Hz', 3)}. La corriente alterna induce en el propio conductor corrientes parásitas que se oponen a ella en el centro y la refuerzan en la superficie: la densidad decae hacia dentro y se retrasa en fase (el campo se difunde en el metal).\n` +
      `Con Ø ${si(d, 'm', 2)} el radio es ${num(a / delta, 2)} δ y R_ac/R_dc = ${num(ratio, 2)}${a > 2 * delta ? ` (solución exacta con funciones de Bessel; la aproximación a/(2δ) del libro da ${num(a / (2 * delta), 2)})` : ''}. Engordar el hilo deja de servir a alta frecuencia: crece la periferia, no la sección útil. De ahí el hilo de Litz.`,
  );

  const lecturas = $derived([
    { e: 'Profundidad δ', v: si(delta, 'm', 3), c: pal.corriente },
    { e: 'Radio / δ', v: num(a / delta, 2) },
    { e: 'R_ac / R_dc', v: num(ratio, 3), c: pal.acento },
    { e: 'R_dc por metro', v: si(RHO / (Math.PI * a * a), 'Ω', 3) },
    { e: 'R_ac por metro', v: si((ratio * RHO) / (Math.PI * a * a), 'Ω', 3) },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['corriente']}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 360] : [900, 400])} etiqueta="Sección de un conductor con la densidad de corriente alterna concentrada en la superficie" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Frecuencia" bind:valor={f} min={10} max={1e9} log unidad="Hz" />
    <Deslizador etiqueta="Diámetro del hilo" bind:valor={d} min={0.05e-3} max={20e-3} log unidad="m" />
    <div class="botones">
      <button class="boton" onclick={() => ((f = 50), (d = 1e-3))}>Ø 1 mm a 50 Hz</button>
      <button class="boton" onclick={() => ((f = 1e6), (d = 1e-3))}>Ø 1 mm a 1 MHz</button>
      <button class="boton" onclick={() => ((f = 1e6), (d = 2e-3))}>Ø 2 mm a 1 MHz</button>
    </div>
  {/snippet}
</Marco>

<style>
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
