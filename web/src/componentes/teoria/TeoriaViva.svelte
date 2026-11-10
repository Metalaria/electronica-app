<script lang="ts">
  // 1.0 «Teoría que se mueve»: under one of the book's equations (reviewed by hand, lib/teoria-viva.ts), a slider per
  // quantity, the result and a small graph of the result along one of them, all recomputed at once while dragging (the
  // calculators' own expression engine; nothing is simulated, nothing is stored). In a lesson it is open; in the reader
  // it starts as a discreet «Mover los valores» button. Nothing moves by itself; no animation at all.
  import { onMount } from 'svelte';
  import { formatoValor } from '../calculadoras/unidades';
  import { curva, piezaEn, resultadoDe, type PiezaViva } from '../../lib/teoria-viva';
  import { cargarTeoriaViva } from '../../lib/teoria-viva-lugares.svelte';
  import MandoValor from './MandoValor.svelte';

  let { parte, indice }: { parte: string; indice: number } = $props();

  let pieza = $state<PiezaViva | null>(null);
  let pos = $state<Record<string, number>>({});
  let abierto = $state(false);
  let enLeccion = $state(false);
  let raiz: HTMLDivElement | undefined = $state();
  const uid = $props.id();

  onMount(() => {
    let vivo = true;
    void cargarTeoriaViva().then((d) => {
      const p = piezaEn(d, parte, indice);
      if (!vivo || !p) return;
      pieza = p;
      pos = Object.fromEntries(p.entradas.map((e) => [e.id, e.inicio]));
    });
    return () => {
      vivo = false;
    };
  });
  // inside a lesson the piece is part of the step: open from the start
  $effect(() => {
    if (pieza && raiz?.closest('.leccion')) abierto = enLeccion = true;
  });

  const plano = (h: string) => h.replace(/<sub>(.*?)<\/sub>/g, '$1').replace(/<[^>]+>/g, '');
  const resultado = $derived(pieza ? resultadoDe(pieza, pos) : NaN);
  // a result that is a vanishing fraction of the curve's scale (a discharge after many time constants: «1,86 × 10⁻⁴³ V»)
  // reads «≈ 0 V» (review 10e)
  const textoResultado = $derived.by(() => {
    if (!pieza) return '';
    const escala = g ? Math.max(Math.abs(g.ymin), Math.abs(g.ymax)) : 0;
    if (resultado !== 0 && Number.isFinite(resultado) && escala > 0 && Math.abs(resultado) < escala * 1e-6) return `≈ ${formatoValor(0, pieza.resultado.unidad, 3, true)}`;
    return formatoValor(resultado, pieza.resultado.unidad, 3, true);
  });
  let titulo: HTMLElement | undefined = $state();
  const cambiado = $derived(!!pieza && pieza.entradas.some((e) => pos[e.id] !== e.inicio));

  // ---------------------------------------------------------------- graph
  const W = 300;
  const H = 150;
  const M = { i: 8, d: 8, a: 10, b: 10 };
  const g = $derived.by(() => {
    if (!pieza) return null;
    const c = curva(pieza, pos);
    const ylog = pieza.grafica.ylog && c.ys.every((y) => y > 0);
    const fy = (y: number) => (ylog ? Math.log10(y) : y);
    const fx = (x: number) => (c.xlog ? Math.log10(x) : x);
    const finitos = c.ys.filter(Number.isFinite).map(fy);
    let y0 = Math.min(...finitos, ylog ? Infinity : 0);
    let y1 = Math.max(...finitos, ylog ? -Infinity : 0);
    if (!(y1 > y0)) [y0, y1] = [y0 - 1, y1 + 1];
    const x0 = fx(c.xs[0]!);
    const x1 = fx(c.xs[c.xs.length - 1]!);
    const px = (x: number) => M.i + ((fx(x) - x0) / (x1 - x0 || 1)) * (W - M.i - M.d);
    const py = (y: number) => H - M.b - ((fy(y) - y0) / (y1 - y0)) * (H - M.a - M.b);
    const puntos = c.xs.map((x, k) => (Number.isFinite(c.ys[k]!) ? `${px(x).toFixed(1)},${py(c.ys[k]!).toFixed(1)}` : '')).filter(Boolean).join(' ');
    const cero = !ylog && y0 < 0 && y1 > 0 ? py(0) : null;
    return { puntos, cx: px(c.x), cy: py(c.y), cero, xmin: c.xs[0]!, xmax: c.xs[c.xs.length - 1]!, ymin: ylog ? 10 ** y0 : y0, ymax: ylog ? 10 ** y1 : y1 };
  });
  const ex = $derived(pieza?.entradas.find((e) => e.id === pieza?.grafica.x));
  const descripcion = $derived(
    pieza && ex
      ? `Gráfica de ${plano(pieza.resultado.sim)} frente a ${plano(ex.sim)}; punto actual: ${plano(ex.sim)} = ${formatoValor(ex.valores[pos[ex.id] ?? ex.inicio]!, ex.unidad, 3, true)}, ${plano(pieza.resultado.sim)} = ${textoResultado}`
      : '',
  );

  function libro() {
    if (pieza) pos = Object.fromEntries(pieza.entradas.map((e) => [e.id, e.inicio]));
    // the button goes away with the book's values back: the focus goes to the piece's title, not to <body> (review 10e)
    titulo?.focus();
  }
</script>

<div class="teoria-viva" bind:this={raiz} data-teoria={pieza?.id}>
  {#if pieza}
    {#if !abierto}
      <button type="button" class="abrir" aria-expanded="false" onclick={() => (abierto = true)}>Mover los valores de esta fórmula</button>
    {:else}
      <section class="caja" aria-labelledby={`${uid}-tit`}>
        <header>
          <h4 id={`${uid}-tit`} tabindex="-1" bind:this={titulo}>{pieza.titulo}</h4>
          {#if !enLeccion}
            <button type="button" class="cerrar" aria-expanded="true" onclick={() => (abierto = false)}>Ocultar</button>
          {/if}
        </header>
        <div class="cuerpo">
          <div class="mandos">
            {#each pieza.entradas as e (e.id)}
              <MandoValor id={`${uid}-${e.id}`} sim={e.sim} nombre={e.nombre} unidad={e.unidad} valores={e.valores} pos={pos[e.id] ?? e.inicio} alMover={(k) => (pos[e.id] = k)} />
            {/each}
          </div>
          <div class="salida">
            <p class="res" aria-live="polite">
              <span class="sim">{@html pieza.resultado.sim}</span> = <output>{textoResultado}</output>
              <span class="nom">{pieza.resultado.nombre}</span>
            </p>
            {#if g && ex}
              <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={descripcion}>
                <rect class="marco" x={M.i} y={M.a} width={W - M.i - M.d} height={H - M.a - M.b} />
                {#if g.cero != null}<line class="cero" x1={M.i} x2={W - M.d} y1={g.cero} y2={g.cero} />{/if}
                <polyline class="linea" points={g.puntos} />
                <line class="guia" x1={g.cx} x2={g.cx} y1={M.a} y2={H - M.b} />
                <circle class="punto" cx={g.cx} cy={g.cy} r="5" />
              </svg>
              <p class="ejes" aria-hidden="true">
                <span>{@html ex.sim}: {formatoValor(g.xmin, ex.unidad, 2, true)} … {formatoValor(g.xmax, ex.unidad, 2, true)}{ex.log ? ' (escala logarítmica)' : ''}</span>
                <span>{@html pieza.resultado.sim}: {formatoValor(g.ymin, pieza.resultado.unidad, 2, true)} … {formatoValor(g.ymax, pieza.resultado.unidad, 2, true)}{pieza.grafica.ylog ? ' (logarítmica)' : ''}</span>
              </p>
            {/if}
            {#if cambiado}
              <button type="button" class="libro" onclick={libro}>Volver a los valores del libro</button>
            {/if}
          </div>
        </div>
      </section>
    {/if}
  {/if}
</div>

<style>
  .teoria-viva {
    margin: 0.2em 0 1em;
    font-family: var(--sans);
  }
  .teoria-viva:empty {
    display: none;
  }
  .abrir,
  .cerrar,
  .libro {
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 8px;
    background: var(--superficie);
    color: var(--tinta);
    font-size: 14.5px;
    cursor: pointer;
  }
  .abrir:focus-visible,
  .cerrar:focus-visible,
  .libro:focus-visible {
    outline: 2px solid var(--acento);
    outline-offset: 2px;
  }
  .caja {
    padding: 10px 14px 12px;
    border: 1px solid var(--linea);
    border-left: 3px solid var(--acento);
    border-radius: 8px;
    background: var(--superficie);
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px 12px;
  }
  h4:focus {
    outline: none;
  }
  h4:focus-visible {
    outline: 2px solid var(--acento);
    outline-offset: 2px;
  }
  h4 {
    margin: 0;
    color: var(--tinta);
    font-size: 15.5px;
  }
  .cuerpo {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: 10px 18px;
    margin-top: 6px;
  }
  .mandos {
    display: grid;
    gap: 2px;
  }
  .salida {
    display: grid;
    align-content: start;
    gap: 6px;
  }
  .res {
    margin: 0;
    color: var(--tinta);
    font-size: 18px;
  }
  .res .sim {
    font-family: var(--serif);
    font-style: italic;
    font-weight: 600;
  }
  /* 1.1: the live result in the mock-up's reading type */
  output {
    font-family: var(--titular);
    font-size: 1.15em;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .res .nom {
    display: block;
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
  svg {
    width: 100%;
    max-width: 420px;
    height: auto;
  }
  .marco {
    fill: none;
    stroke: var(--linea);
  }
  .cero {
    stroke: var(--linea);
    stroke-dasharray: 3 3;
  }
  .linea {
    fill: none;
    stroke: var(--acento);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }
  .guia {
    stroke: var(--tinta-tenue);
    stroke-dasharray: 2 3;
    vector-effect: non-scaling-stroke;
  }
  .punto {
    fill: var(--acento);
    stroke: var(--superficie);
    stroke-width: 2;
  }
  .ejes {
    display: grid;
    gap: 2px;
    margin: 0;
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .libro {
    justify-self: start;
  }
  @media (max-width: 720px) {
    .cuerpo {
      grid-template-columns: 1fr;
    }
  }
</style>
