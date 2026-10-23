<script lang="ts">
  // Antennas and wavelength (book 35.8, 30.4, 15.18): λ = c/f; a dipole carries a standing wave of current
  // I(z) ∝ sen(k·(L/2 − |z|)) and radiates in a doughnut perpendicular to its axis, with nulls along the wire.
  // The pattern F(θ) = [cos(kL/2·cos θ) − cos(kL/2)]/sen θ and the radiation resistance
  // R_rad = 60·∫F²·sen θ dθ (73 Ω for half a wavelength, fractions of an ohm when it is short) are computed
  // numerically; with the copper loss (skin effect) they give the efficiency. Book table: 433 MHz → λ = 69,3 cm.
  import Escena from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Selector from '../../ui/Selector.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { si, num, pct } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico } from '../nucleo/grafica';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  const C0 = 299792458;
  let f = $state(433e6);
  let L = $state(0.5); // in wavelengths
  const DIAM = 1e-3; // 1 mm copper wire
  const RHO = 1.72e-8;

  const lambda = $derived(C0 / f);
  function F(th: number, l: number): number {
    const kl = Math.PI * l; // k·L/2
    const s = Math.sin(th);
    if (Math.abs(s) < 1e-6) return 0;
    return (Math.cos(kl * Math.cos(th)) - Math.cos(kl)) / s;
  }
  const patron = $derived.by(() => {
    const N = 360;
    let max = 1e-12;
    const val = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const th = ((i + 0.5) * Math.PI) / N;
      const v = F(th, L);
      val[i] = Math.abs(v);
      max = Math.max(max, Math.abs(v));
    }
    // R_rad referred to the current maximum: 60·∫ F²/sen θ dθ (F already contains 1/sen θ once).
    let r = 0;
    for (let i = 0; i < N; i++) {
      const th = ((i + 0.5) * Math.PI) / N;
      r += ((F(th, L) ** 2) * Math.sin(th)) * (Math.PI / N);
    }
    return { val, max, rrad: 60 * r };
  });
  // Referred to the feed point (centre): divide by sen²(kL/2) when it is not a current null.
  const rEntrada = $derived.by(() => {
    const s = Math.sin(Math.PI * L);
    return s * s > 1e-3 ? patron.rrad / (s * s) : Infinity;
  });
  const perdidas = $derived.by(() => {
    const delta = Math.sqrt(RHO / (Math.PI * f * 4e-7 * Math.PI));
    const rPorM = RHO / (Math.PI * DIAM * delta);
    return 0.5 * rPorM * L * lambda; // average of sin² along the wire
  });
  const rendimiento = $derived(patron.rrad / (patron.rrad + perdidas));

  let wt = 0;
  let n = $state(0);
  const muestreo = new Muestreo(50);
  function paso(dt: number): void {
    wt += (2 * Math.PI * dt) / 1.6;
    if (muestreo.toca()) n++;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    const cx = est ? 300 : 300;
    const cy = est ? 220 : 200;
    const R = est ? 190 : 180;
    estatico(v, `an:${est}`, () => {});
    // Wavefronts leaving the antenna: rings every λ, brightness by the pattern.
    const lamPx = R / 2.4;
    const desplaza = ((wt / (2 * Math.PI)) % 1) * lamPx;
    for (let k = 0; k < 3; k++) {
      const r = 30 + desplaza + k * lamPx;
      if (r > R) continue;
      for (let i = 0; i < 72; i++) {
        const th0 = (i * Math.PI) / 36;
        // θ measured from the antenna axis (vertical).
        const th = Math.abs(((th0 + Math.PI) % (2 * Math.PI)) - Math.PI);
        const idx = Math.min(359, Math.floor((th / Math.PI) * 360));
        const a = (patron.val[idx]! / patron.max) * (1 - r / (R * 1.05));
        if (a < 0.03) continue;
        ctx.strokeStyle = alfa(p.campoE, a);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2 + th0 - Math.PI / 72, -Math.PI / 2 + th0 + Math.PI / 72);
        ctx.stroke();
      }
    }
    // Polar pattern.
    ctx.strokeStyle = p.serie[4];
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i <= 720; i++) {
      const th0 = (i * Math.PI) / 360;
      const th = Math.abs(((th0 + Math.PI) % (2 * Math.PI)) - Math.PI);
      const idx = Math.min(359, Math.floor((th / Math.PI) * 360));
      const r = (patron.val[idx]! / patron.max) * R * 0.85;
      const x = cx + r * Math.sin(th0);
      const y = cy - r * Math.cos(th0);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // The dipole with its current distribution (amplitude ∝ |I|, animated with cos ωt).
    const h = Math.min(R * 0.95, 60 + L * 140);
    ctx.strokeStyle = p.tinta;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2);
    ctx.lineTo(cx, cy - 4);
    ctx.moveTo(cx, cy + 4);
    ctx.lineTo(cx, cy + h / 2);
    ctx.stroke();
    ctx.fillStyle = alfa(p.corriente, 0.45);
    ctx.beginPath();
    const M = 60;
    for (let i = 0; i <= M; i++) {
      const z = -0.5 + i / M; // in units of L
      const I = Math.sin(Math.PI * L * 2 * (0.5 - Math.abs(z))) * Math.cos(wt);
      const x = cx + 26 * I;
      const y = cy + z * h;
      if (i === 0) ctx.moveTo(cx, y);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(cx, cy + h / 2);
    ctx.closePath();
    ctx.fill();
    txt(v, 'corriente', cx + 32, cy - h / 2 + 10, { tam: 11, color: p.corriente, peso: 700, alin: 'left' });
    txt(v, 'diagrama de radiación', cx + R * 0.6, cy + R * 0.85, { tam: 11, color: p.serie[4], peso: 700 });
    // Sizes.
    const tx = est ? 30 : 540;
    const ty = est ? 440 : 60;
    txtRico(v, `λ = c/f = ${si(lambda, 'm', 3)}`, tx, ty, { tam: 13, peso: 800, alin: 'left' });
    txtRico(v, `λ/4 = ${si(lambda / 4, 'm', 3)} · λ/2 = ${si(lambda / 2, 'm', 3)}`, tx, ty + 22, { tam: 12, alin: 'left', color: p.suave });
    txtRico(v, `dipolo de ${num(L, 2)} λ = ${si(L * lambda, 'm', 3)}`, tx, ty + 44, { tam: 12.5, peso: 700, alin: 'left', color: p.acento });
  }

  const texto = $derived(
    `**λ = c/f = ${si(lambda, 'm', 3)}** a ${si(f, 'Hz', 3)}. Una antena eficiente mide una fracción apreciable de λ: para 1 kHz serían 300 km, por eso se modula a radiofrecuencia.\n` +
      `El dipolo de ${num(L, 2)} λ tiene una onda estacionaria de corriente, máxima en el centro y nula en las puntas; radia en un toroide perpendicular al hilo, con nulos en su dirección. Resistencia de radiación: ${si(patron.rrad, 'Ω', 3)} (en el máximo de corriente; 73 Ω en el de media onda). Con las pérdidas del cobre de 1 mm (${si(perdidas, 'Ω', 2)} por efecto pelicular), el rendimiento es del ${pct(rendimiento, 1)}${L < 0.15 ? ': una antena corta tiene una R_rad diminuta y se gasta en calentar el hilo' : ''}.`,
  );

  const lecturas = $derived([
    { e: 'Longitud de onda', v: si(lambda, 'm', 3), c: pal.acento },
    { e: 'R_rad', v: si(patron.rrad, 'Ω', 3), c: pal.serie[4] },
    { e: 'R en el centro', v: Number.isFinite(rEntrada) ? si(rEntrada, 'Ω', 3) : 'muy alta' },
    { e: 'Pérdidas del cobre', v: si(perdidas, 'Ω', 2) },
    { e: 'Rendimiento', v: pct(rendimiento, 1), c: rendimiento > 0.9 ? pal.bien : pal.peligro },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['campoE']}>
  {#snippet modos()}
    <Selector
      etiqueta="Frecuencia"
      bind:valor={f}
      opciones={[
        { valor: 100e6, texto: '100 MHz (FM)' },
        { valor: 433e6, texto: '433 MHz' },
        { valor: 868e6, texto: '868 MHz' },
        { valor: 2.4e9, texto: '2,4 GHz' },
      ]}
    />
  {/snippet}
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} dims={(a) => (a < 560 ? [600, 520] : [900, 400])} etiqueta="Dipolo con su distribución de corriente, las ondas que radia y su diagrama de radiación" />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Longitud del dipolo" bind:valor={L} min={0.05} max={1.5} paso={0.01} formato={(x) => `${num(x, 2)} λ`} />
    <div class="botones">
      <button class="boton" onclick={() => (L = 0.5)}>Media onda</button>
      <button class="boton" onclick={() => (L = 0.1)}>Corta (λ/10)</button>
      <button class="boton" onclick={() => (L = 1.25)}>1,25 λ</button>
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
