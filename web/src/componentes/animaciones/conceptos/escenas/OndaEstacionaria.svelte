<script lang="ts">
  // Standing waves, VSWR and the Smith chart (book 35.2, 35.4, 35.3): in sinusoidal steady state the incident
  // and reflected waves add to V(d) = V⁺·(e^{jβd} + Γ·e^{−jβd}), whose envelope swings between 1 − |Γ| and
  // 1 + |Γ|: VSWR = (1 + |Γ|)/(1 − |Γ|). Seen from a point d towards the source, the impedance is the load's
  // Γ turned by −2βd: on the Smith chart the point goes round the centre (a full turn every half wavelength).
  // Drag along the line to move the observation point. Book: 75 Ω on 50 Ω → Γ = 0,2, 4 % reflected;
  // VSWR 2 loses 11 % (half a decibel).
  import Escena, { type EventoPuntero } from '../../ui/Escena.svelte';
  import Marco from '../../ui/Marco.svelte';
  import Deslizador from '../../ui/Deslizador.svelte';
  import Interruptor from '../../ui/Interruptor.svelte';
  import { Reloj, Muestreo } from '../../nucleo/reloj.svelte';
  import { txt, txtRico, circulo, flecha, type Vista } from '../../nucleo/dibujo';
  import { alfa, paleta } from '../../nucleo/paleta';
  import { num, pct } from '../../nucleo/formato';
  import { app } from '../../../../lib/estado.svelte';
  import { estatico, panel, curva, guia, deX, X, type Ejes } from '../nucleo/grafica';
  import { c as cx, mod, arg, mul, polar, type C } from '../nucleo/complejo';
  import { gamma, zDeGamma, cartaSmith, aPunto, type Carta } from '../nucleo/smith';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));

  const Z0 = 50;
  const LONG = 1.25; // wavelengths shown
  let R = $state(75);
  let Xl = $state(0);
  let dObs = $state(0.125);
  let barrer = $state(false);

  const abierta = $derived(R >= 4999);
  const G = $derived(abierta ? cx(1) : gamma(cx(R / Z0, Xl / Z0)));
  const modG = $derived(mod(G));
  const vswr = $derived(modG >= 0.9999 ? Infinity : (1 + modG) / (1 - modG));

  function Vd(d: number): C {
    const b = 2 * Math.PI * d;
    const inc = polar(1, b);
    const ref = mul(G, polar(1, -b));
    return { re: inc.re + ref.re, im: inc.im + ref.im };
  }

  let wt = 0;
  let fase = 0;
  let n = $state(0);
  const muestreo = new Muestreo(50);
  function paso(dt: number): void {
    wt = (wt + (2 * Math.PI * dt) / 2) % (2 * Math.PI);
    if (barrer && !arrastre) {
      fase += dt / 12;
      dObs = Number(((fase % 1) * LONG).toFixed(4));
    }
    if (muestreo.toca()) n++;
  }

  let eLin: Ejes | null = null;
  let arrastre = false;
  function puntero(ev: EventoPuntero): boolean | void {
    if (!eLin) return;
    const dentro = ev.x >= eLin.x - 10 && ev.x <= eLin.x + eLin.w + 10 && ev.y >= eLin.y - 10 && ev.y <= eLin.y + eLin.h + 30;
    if (ev.tipo === 'abajo' && dentro) {
      arrastre = true;
      barrer = false;
    }
    if (arrastre && ev.tipo !== 'arriba') dObs = Math.min(LONG, Math.max(0, deX(eLin, ev.x)));
    if (ev.tipo === 'arriba') arrastre = false;
    return arrastre;
  }

  function dibujar(v: Vista): void {
    void n;
    const { ctx } = v;
    const p = pal;
    const est = v.estrecho;
    // x axis: distance from the load, increasing to the left (source on the left, load on the right).
    const e: Ejes = est ? { x: 50, y: 50, w: 500, h: 180, x0: LONG, x1: 0, y0: -2.2, y1: 2.2 } : { x: 50, y: 50, w: 480, h: 250, x0: LONG, x1: 0, y0: -2.2, y1: 2.2 };
    eLin = e;
    const k: Carta = est ? { cx: 300, cy: 410, R: 120 } : { cx: 720, cy: 190, R: 140 };
    estatico(v, `oe:${est}`, (vv) => {
      panel(vv, e, { titulo: 'Tensión a lo largo de la línea (fuente ← · → carga)', fmtX: (x) => `${num(x, 2)} λ`, marcasX: [1.25, 1, 0.75, 0.5, 0.25, 0], marcasY: [-2, -1, 0, 1, 2], cero: true });
      cartaSmith(vv, k);
    });
    const N = 300;
    const xs = new Float64Array(N + 1);
    const yi = new Float64Array(N + 1);
    const env = new Float64Array(N + 1);
    const envN = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const d = (LONG * i) / N;
      const V = Vd(d);
      xs[i] = d;
      yi[i] = V.re * Math.cos(wt) - V.im * Math.sin(wt);
      env[i] = mod(V);
      envN[i] = -mod(V);
    }
    curva(ctx, e, xs, env, alfa(p.corriente, 0.85), 1.8, [5, 4]);
    curva(ctx, e, xs, envN, alfa(p.corriente, 0.85), 1.8, [5, 4]);
    curva(ctx, e, xs, yi, p.acento, 2.6);
    guia(ctx, e, 'x', dObs, p.serie[4], 2, [3, 3]);
    const px = X(e, dObs);
    circulo(ctx, px, e.y + e.h + 18, 8, p.serie[4], p.fondo, 2);
    txt(v, 'arrastra el punto', px, e.y + e.h + 36, { tam: 10.5, color: p.suave });
    txt(v, 'carga', e.x + e.w - 4, e.y + 12, { tam: 11, peso: 700, color: p.suave, alin: 'right' });

    // Smith chart: VSWR circle, load point, observation point.
    ctx.strokeStyle = alfa(p.serie[4], 0.6);
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(k.cx, k.cy, Math.min(1, modG) * k.R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const [lx, ly] = aPunto(k, G);
    circulo(ctx, lx, ly, 6, p.corriente, p.fondo, 2);
    txtRico(v, 'Z_L', lx + 8, ly - 10, { tam: 11, peso: 800, color: p.corriente, alin: 'left' });
    const Gd = mul(G, polar(1, -4 * Math.PI * dObs));
    const [ox, oy] = aPunto(k, Gd);
    flecha(ctx, k.cx, k.cy, ox, oy, p.serie[4], 2.2, 9);
    circulo(ctx, ox, oy, 6, p.serie[4], p.fondo, 2);
    const z = modG >= 0.9999 && Math.abs(Gd.re - 1) < 1e-6 ? null : zDeGamma(Gd);
    txtRico(v, z ? `Z(d) = ${num(z.re * Z0, 1)} ${z.im >= 0 ? '+' : '−'} j${num(Math.abs(z.im * Z0), 1)} Ω` : 'Z(d) = ∞', k.cx, k.cy + k.R + 22, { tam: 12.5, peso: 800, color: p.serie[4] });
  }

  const texto = $derived(
    `**Onda estacionaria:** la incidente y la reflejada (Γ = ${num(modG, 3)}∠${num((arg(G) * 180) / Math.PI, 0)}°) se suman con fases que cambian a lo largo de la línea; la envolvente oscila entre 1 − |Γ| y 1 + |Γ| con un periodo de media longitud de onda. VSWR = (1 + |Γ|)/(1 − |Γ|) = ${Number.isFinite(vswr) ? num(vswr, 2) : '∞'}, y se refleja el ${pct(modG * modG, 1)} de la potencia.\n` +
      `**En la carta de Smith** la impedancia vista a una distancia d de la carga es el mismo |Γ| girado −2βd: el punto recorre el círculo de VSWR constante, una vuelta cada λ/2. A λ/4 una impedancia se invierte (Z² = Z₀²/Z_L): el transformador de cuarto de onda.`,
  );

  const lecturas = $derived([
    { e: '|Γ|', v: num(modG, 3), c: pal.corriente },
    { e: 'VSWR', v: Number.isFinite(vswr) ? num(vswr, 2) : '∞' },
    { e: 'Potencia reflejada', v: pct(modG * modG, 1) },
    { e: 'Pérdida de retorno', v: modG > 1e-6 ? `${num(-20 * Math.log10(modG), 1)} dB` : '∞' },
    { e: 'Punto observado', v: `${num(dObs, 3)} λ`, c: pal.serie[4] },
  ]);
</script>

<Marco {reloj} {texto} {lecturas}>
  {#snippet escena()}
    <Escena {reloj} {paso} {dibujar} {puntero} dims={(a) => (a < 560 ? [600, 580] : [900, 380])} etiqueta="Onda estacionaria en una línea desadaptada y la carta de Smith" />
  {/snippet}
  {#snippet controles()}
    <div class="botones">
      <button class="boton" onclick={() => ((R = 50), (Xl = 0))}>50 Ω (adaptada)</button>
      <button class="boton" onclick={() => ((R = 75), (Xl = 0))}>75 Ω</button>
      <button class="boton" onclick={() => ((R = 5000), (Xl = 0))}>Abierta</button>
      <button class="boton" onclick={() => ((R = 0.01), (Xl = 0))}>Cortocircuito</button>
      <button class="boton" onclick={() => ((R = 25), (Xl = 25))}>25 + j25 Ω</button>
    </div>
    <Deslizador etiqueta="Resistencia de la carga" bind:valor={R} min={0.01} max={5000} log unidad="Ω" />
    <Deslizador etiqueta="Reactancia de la carga" bind:valor={Xl} min={-200} max={200} paso={1} unidad="Ω" />
    <Interruptor etiqueta="Recorrer la línea" bind:valor={barrer} />
    <Deslizador etiqueta="Distancia a la carga" bind:valor={dObs} min={0} max={LONG} paso={0.005} formato={(x) => `${num(x, 3)} λ`} />
  {/snippet}
</Marco>

<style>
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
