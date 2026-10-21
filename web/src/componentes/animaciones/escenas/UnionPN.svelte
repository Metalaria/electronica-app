<script lang="ts">
  // Formation of the PN junction (book 5.2, figs. 5.5 and 5.7): diffusion, recombination, uncovered ions,
  // built-in field and the equilibrium barrier V₀ = V_T·ln(N_A·N_D/n_i²).
  import { untrack } from 'svelte';
  import Escena from '../ui/Escena.svelte';
  import Marco from '../ui/Marco.svelte';
  import Deslizador from '../ui/Deslizador.svelte';
  import Grafica from '../ui/Grafica.svelte';
  import { Reloj, Muestreo } from '../nucleo/reloj.svelte';
  import { SimUnion } from '../nucleo/union';
  import { agotamiento, v0, EPS_SI, Q } from '../nucleo/fisica';
  import { txt, txtRico, fondo, rr, type Vista } from '../nucleo/dibujo';
  import { alfa, paleta } from '../nucleo/paleta';
  import { app } from '../../../lib/estado.svelte';
  import { num, si, cientifica } from '../nucleo/formato';

  const reloj = new Reloj();
  const pal = $derived(paleta(app.tema));
  const sim = new SimUnion();

  let na = $state(1e17);
  let nd = $state(1e16);
  /** Formation progress copied from the simulation for the DOM (throttled). */
  let fase = $state(1);
  const muestreo = new Muestreo(80);

  const V0 = $derived(v0(na, nd));
  const eq = $derived(agotamiento(na, nd, 0));
  const ANCHO_NM = 2000;

  function geometria(v: Vista) {
    const estrecho = v.w < 700;
    const x0 = estrecho ? 20 : 40;
    const x1 = v.w - x0;
    const y0 = estrecho ? 70 : 66;
    const y1 = estrecho ? v.h - 170 : v.h - 140;
    return { x0, x1, y0, y1, xj: (x0 + x1) / 2, nmU: ANCHO_NM / (x1 - x0) };
  }

  // Changing the doping rebuilds the slab at equilibrium; «Reiniciar» replays the formation.
  let ultimaGeom = '';
  function asegurar(v: Vista): void {
    const g = geometria(v);
    const clave = `${g.x0},${g.x1},${g.y0},${g.y1},${na},${nd}`;
    if (clave !== ultimaGeom) {
      ultimaGeom = clave;
      sim.configurar(g, na, nd);
      sim.f = 1;
      sim.poblar();
    }
  }

  $effect(() => {
    if (reloj.reinicios > 0) {
      untrack(() => {
        sim.reiniciarFormacion();
        fase = 0;
      });
    }
  });

  function paso(dt: number): void {
    sim.paso(dt);
    if (muestreo.toca()) fase = sim.f;
  }

  function dibujar(v: Vista): void {
    void na;
    void nd;
    asegurar(v);
    const { ctx, pal } = v;
    fondo(v);
    const g = sim.g;
    const est = v.w < 700;

    // Region titles.
    txtRico(v, 'Lado P', g.x0, 22, { alin: 'left', tam: 16, peso: 700, color: pal.hueco });
    txtRico(v, `N_A = ${cientifica(na, 2)} cm^{−3}`, g.x0, 45, { alin: 'left', tam: 13, color: pal.suave });
    txtRico(v, 'Lado N', g.x1, 22, { alin: 'right', tam: 16, peso: 700, color: pal.electron });
    txtRico(v, `N_D = ${cientifica(nd, 2)} cm^{−3}`, g.x1, 45, { alin: 'right', tam: 13, color: pal.suave });

    sim.dibujar(v);

    const { a, b, w } = sim.limites();
    const h = g.y1 - g.y0;
    if (w > 70) {
      txt(v, 'campo E', (a + b) / 2, g.y0 + h / 2 - 16, {
        tam: 13,
        peso: 700,
        color: pal.campoE,
        fondo: alfa(pal.agotamiento, 0.85),
      });
    }

    // Bracket for W.
    const yb = g.y1 + 18;
    ctx.strokeStyle = pal.suave;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(a, yb - 6);
    ctx.lineTo(a, yb);
    ctx.lineTo(b, yb);
    ctx.lineTo(b, yb - 6);
    ctx.moveTo(g.xj, yb);
    ctx.lineTo(g.xj, yb + 5);
    ctx.stroke();
    const d = agotamiento(na, nd, 0);
    const wNm = d.w * 1e9 * sim.f;
    txtRico(v, `zona de agotamiento  W = ${si(wNm * 1e-9, 'm', 3)}`, g.xj, yb + 20, { tam: 14, peso: 700 });
    txtRico(v, `${si(d.xp * sim.f, 'm', 2)} en el lado P + ${si(d.xn * sim.f, 'm', 3)} en el lado N`, g.xj, yb + 42, {
      tam: 12.5,
      color: pal.suave,
    });

    // Scale bar.
    const ys = v.h - (est ? 40 : 24);
    const l200 = 200 / g.nmU;
    ctx.strokeStyle = pal.tinta;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.x0, ys);
    ctx.lineTo(g.x0 + l200, ys);
    ctx.moveTo(g.x0, ys - 4);
    ctx.lineTo(g.x0, ys + 4);
    ctx.moveTo(g.x0 + l200, ys - 4);
    ctx.lineTo(g.x0 + l200, ys + 4);
    ctx.stroke();
    txt(v, '200 nm', g.x0 + l200 + 8, ys, { alin: 'left', tam: 12, color: pal.suave });

    // Phase pill.
    const formando = sim.f < 1;
    const etiquetaFase = formando ? 'Difusión y recombinación…' : 'Equilibrio dinámico';
    const colorFase = formando ? pal.calor : pal.campoE;
    ctx.save();
    ctx.font = v.fuente(13, 700);
    const anchoP = ctx.measureText(etiquetaFase).width + v.f(13) * 1.6;
    ctx.restore();
    const xp = g.x1 - anchoP;
    rr(ctx, xp, ys - v.f(13) * 0.85, anchoP, v.f(13) * 1.7, v.f(13) * 0.85);
    ctx.fillStyle = alfa(colorFase, pal.oscuro ? 0.2 : 0.12);
    ctx.fill();
    txt(v, etiquetaFase, xp + anchoP / 2, ys, { tam: 13, peso: 700, color: colorFase });
  }

  // Potential profile V(x) for the plot (depletion approximation), scaled by the formation progress.
  const perfil = $derived.by(() => {
    const k = fase;
    const xp = eq.xp * k;
    const xn = eq.xn * k;
    const naM = na * 1e6;
    const ndM = nd * 1e6;
    const xs: number[] = [];
    const ys: number[] = [];
    const Vb = V0 * k * k;
    for (let i = 0; i <= 240; i++) {
      const x = (-1000 + (2000 * i) / 240) * 1e-9;
      let vv = 0;
      if (x <= -xp) vv = 0;
      else if (x <= 0) vv = ((Q * naM) / (2 * EPS_SI)) * (x + xp) ** 2;
      else if (x < xn) vv = Vb - ((Q * ndM) / (2 * EPS_SI)) * (xn - x) ** 2;
      else vv = Vb;
      xs.push(x);
      ys.push(vv);
    }
    return { xs, ys, Vb };
  });

  const texto = $derived.by(() => {
    if (fase < 1)
      return (
        '**Difusión.** Al ponerse en contacto, los electrones del lado N y los huecos del lado P cruzan la frontera por pura estadística, de donde hay más a donde hay menos, y se recombinan con los portadores del otro lado.\n' +
        'Cada portador que se va deja atrás su **ion fijo**: positivo en el N, negativo en el P. Esa carga descubierta crea un campo que frena la difusión.'
      );
    return (
      `**Equilibrio dinámico.** El campo de los iones descubiertos (de N a P) devuelve a cada portador que intenta cruzar: la difusión y el arrastre se igualan y la corriente neta es cero.\n` +
      `La barrera vale V_0 = ${num(V0, 3)} V y la zona mide W = ${si(eq.w, 'm', 3)}: ${si(eq.xp, 'm', 2)} en P y ${si(eq.xn, 'm', 3)} en N. ` +
      (Math.abs(Math.log10(na / nd)) < 0.05
        ? 'Con el mismo dopaje se reparte por igual.'
        : `Penetra más en el lado ${na > nd ? 'N' : 'P'}, el menos dopado (N_D·x_n = N_A·x_p).`)
    );
  });

  const lecturas = $derived([
    { e: 'Potencial de contacto V_0', v: `${num(V0, 3)} V`, c: 'var(--acento)' },
    { e: 'Anchura W', v: si(eq.w, 'm', 3) },
    { e: 'x_p / x_n', v: `${si(eq.xp, 'm', 2)} / ${si(eq.xn, 'm', 3)}` },
    { e: 'Campo máximo', v: si(eq.emax, 'V/m', 3) },
    { e: 'Capacidad por área', v: `${num((EPS_SI / eq.w) * 1e9 * 1e-4, 1)} nF/cm²` },
  ]);
</script>

<Marco {reloj} {texto} {lecturas} leyenda={['hueco', 'electron', 'ionA', 'ionD', 'campoE', 'calor']}>
  {#snippet escena()}
    <Escena
      {reloj}
      {paso}
      {dibujar}
      dims={(a) => (a < 560 ? [560, 620] : [900, 480])}
      etiqueta="Unión PN: portadores, iones fijos y zona de agotamiento"
    />
  {/snippet}
  {#snippet controles()}
    <Deslizador etiqueta="Dopaje del lado P, N_A" bind:valor={na} min={1e15} max={1e18} log unidad="" formato={(x) => `${cientifica(x, 2)} cm⁻³`} color="var(--c-precaucion)" />
    <Deslizador etiqueta="Dopaje del lado N, N_D" bind:valor={nd} min={1e15} max={1e18} log unidad="" formato={(x) => `${cientifica(x, 2)} cm⁻³`} color="var(--c-nota)" />
    <p class="nota">Pulse «Reiniciar» para ver otra vez cómo se forma la unión desde el contacto. Los puntos no están a escala: el lado más dopado tiene muchos más portadores.</p>
  {/snippet}
  {#snippet grafica()}
    <Grafica
      titulo="Perfil del potencial"
      x={{ etiqueta: 'posición x', unidad: 'm', min: -1e-6, max: 1e-6 }}
      y={{ etiqueta: 'V(x)', unidad: 'V', min: -0.05, max: 1.05 }}
      series={[{ x: perfil.xs, y: perfil.ys, color: pal.acento }]}
      lineas={[{ y: perfil.Vb, etiqueta: `V₀ = ${num(perfil.Vb, 3)} V`, color: pal.hueco }]}
      alto={200}
    />
  {/snippet}
</Marco>

<style>
  .nota {
    margin: 0;
    font-size: 13px;
    color: var(--tinta-suave);
  }
</style>
