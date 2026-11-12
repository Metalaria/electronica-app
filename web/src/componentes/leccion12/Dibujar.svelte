<script lang="ts">
  // 1.2 «Dibuje la forma de onda»: the reader draws the curve over the axes with a finger or the mouse (dragging sets
  // the points under the path), or with the keyboard: choose a point (◀ ▶, or the slider's own arrows with Shift) and
  // set its value with the slider. «Comprobar» compares it with the model's curve (lib/leccion12/dibujo.ts: a
  // normalised RMS error that forgives a small shift and offset) and then draws the right curve over the reader's.
  // 1.2: the x axis may be logarithmic (`escala: log`): the points are evenly spaced in log x, like its ticks.
  import { compilarModelo, formatear, type Valores } from '../../lib/leccion11/modelo';
  import { baseX, bajaY, geometriaGrafica, tamMarca } from '../../lib/leccion11/ejes';
  import type { EstadoTarjeta } from '../../lib/leccion11/motor';
  import { textoPlano } from '../../lib/leccion11/texto';
  import { leerUnidades } from '../../lib/habla-matematicas';
  import type { Leccion11 } from '../../lib/leccion11/tipos';
  import { curvaDe, rellenar, xEnFraccion, xsDibujo, yDeFraccion } from '../../lib/leccion12/dibujo';
  import type { Dibujar, EstadoDibujar } from '../../lib/leccion12/tipos';
  import TextoSvg from '../leccion11/TextoSvg.svelte';
  import TextoVivo from '../leccion11/TextoVivo.svelte';

  let {
    leccion,
    a,
    e,
    ea,
    efectivos,
    prefijo,
    cambiar,
  }: {
    leccion: Leccion11;
    a: Dibujar;
    e: EstadoTarjeta;
    ea: EstadoDibujar;
    efectivos: Valores;
    prefijo: string;
    cambiar: (c: Partial<EstadoTarjeta>) => void;
  } = $props();

  const mc = $derived(compilarModelo(leccion.modelo));
  let anchoPx = $state(0);
  const tam = $derived(tamMarca(anchoPx));
  const g = $derived(geometriaGrafica(a.x, a.y, tam));
  const xs = $derived(xsDibujo(a));
  const bloqueado = $derived(e.resuelta);
  // (the right curve only once the card is right or its round is closed: after a wrong check it would answer the retry)
  const verCurva = $derived(e.resuelta || e.cerrada);
  const f = $derived(curvaDe(mc, a, efectivos));
  const ref = $derived.by(() => {
    if (!verCurva) return '';
    const n = 200;
    let d = '';
    for (let k = 0; k <= n; k++) {
      const x = xEnFraccion(a.x, k / n);
      d += `${k ? 'L' : 'M'}${g.sx(x).toFixed(1)},${g.sy(f(x)).toFixed(1)}`;
    }
    return d;
  });
  const lleno = $derived(rellenar(ea.ys));
  const trazo = $derived(lleno ? lleno.map((y, k) => `${k ? 'L' : 'M'}${g.sx(xs[k]!).toFixed(1)},${g.sy(y).toFixed(1)}`).join('') : '');
  const pasoY = $derived((a.y.max - a.y.min) / 100);
  const yPunto = $derived(ea.ys[ea.punto] ?? lleno?.[ea.punto] ?? (a.y.min + a.y.max) / 2);
  const magX = $derived({ sim: [], nombre: '', unidad: a.x.unidad, cifras: 3, recortar: true });
  const magY = $derived({ sim: [], nombre: '', unidad: a.y.unidad, cifras: 3, recortar: true });

  let svg: SVGSVGElement | undefined = $state();
  $effect(() => {
    const el = svg;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => (anchoPx = el.getBoundingClientRect().width));
    ro.observe(el);
    return () => ro.disconnect();
  });

  function poner(ys: (number | null)[], punto = ea.punto) {
    cambiar({ actividad: { ...ea, ys, punto }, comprobado: false, bien: null });
  }

  let anterior: number | null = null;
  function enSvg(ev: PointerEvent): { k: number; y: number } | null {
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    const fx = (p.x - g.M.izq) / g.ancho;
    const k = Math.max(0, Math.min(a.puntos - 1, Math.round(fx * (a.puntos - 1))));
    return { k, y: yDeFraccion(a, (p.y - g.M.arr) / g.alto) };
  }
  function trazar(ev: PointerEvent) {
    const q = enSvg(ev);
    if (!q) return;
    const ys = [...ea.ys];
    // fill the points between the last one and this one (a fast stroke skips some)
    if (anterior != null && anterior !== q.k) {
      const y0 = ys[anterior] ?? q.y;
      const paso = q.k > anterior ? 1 : -1;
      for (let j = anterior + paso; j !== q.k; j += paso) ys[j] = Number((y0 + ((q.y - y0) * (j - anterior)) / (q.k - anterior)).toPrecision(12));
    }
    ys[q.k] = q.y;
    anterior = q.k;
    poner(ys, q.k);
  }
  function abajo(ev: PointerEvent) {
    if (bloqueado) return;
    (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
    anterior = null;
    trazar(ev);
  }
  function mover(ev: PointerEvent) {
    if (bloqueado || anterior == null || !(ev.buttons & 1 || ev.pointerType === 'touch' || ev.pointerType === 'pen')) return;
    trazar(ev);
  }
  function arriba() {
    anterior = null;
  }

  function elegirPunto(k: number) {
    cambiar({ actividad: { ...ea, punto: Math.max(0, Math.min(a.puntos - 1, k)) } });
  }
  function valorPunto(y: number) {
    if (bloqueado) return;
    const ys = [...ea.ys];
    ys[ea.punto] = Math.max(a.y.min, Math.min(a.y.max, Number(y.toPrecision(12))));
    poner(ys);
  }
  function teclaValor(ev: KeyboardEvent) {
    // Shift + ← → choose the point; the plain arrows are the slider's own
    if (ev.shiftKey && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
      ev.preventDefault();
      elegirPunto(ea.punto + (ev.key === 'ArrowRight' ? 1 : -1));
    }
  }
  const idValor = $derived(`${prefijo}-dibujo-valor`);
  const descripcion = $derived(`${textoPlano(a.rotulo)}. Eje x${a.x.escala === 'log' ? ' logarítmico' : ''} de ${formatear(magX, a.x.min)} a ${formatear(magX, a.x.max)}; eje y de ${formatear(magY, a.y.min)} a ${formatear(magY, a.y.max)}. ${ea.ys.filter((y) => y != null).length} de ${a.puntos} puntos dibujados.`);
</script>

<div class="a12 dibujar" data-dibujar>
  <p class="a12-suave"><TextoVivo texto={a.rotulo} valor={() => ''} /></p>
  <svg
    bind:this={svg}
    viewBox={`0 0 ${g.W} ${g.H}`}
    width="100%"
    role="img"
    aria-label={leerUnidades(descripcion)}
    class:bloqueado
    onpointerdown={abajo}
    onpointermove={mover}
    onpointerup={arriba}
    onpointercancel={arriba}
    style:--tam-marca={`${tam}px`}
    data-lienzo
  >
    {#each g.etqY as t (t.v)}
      <line class={t.v === 0 ? 'eje' : 'rejilla'} x1={g.M.izq} x2={g.W - g.M.der} y1={g.sy(t.v)} y2={g.sy(t.v)}></line>
      {#if t.visible}<text class="marca" x={g.M.izq - 6} y={g.sy(t.v) + bajaY(tam)} text-anchor="end">{t.texto}</text>{/if}
    {/each}
    {#each g.etqX as t (t.v)}
      <line class={t.v === 0 ? 'eje' : 'rejilla'} y1={g.M.arr} y2={g.H - g.M.aba} x1={g.sx(t.v)} x2={g.sx(t.v)}></line>
      {#if t.visible}<text class="marca" x={g.sx(t.v)} y={g.H - g.M.aba + baseX(tam)} text-anchor={t.ancla}>{t.texto}</text>{/if}
    {/each}
    <text class="marca" x={g.W - g.M.der} y={g.H - 2} text-anchor="end"><TextoSvg t={a.x.rotulo} valor={() => ''} /></text>
    <rect class="zona" x={g.M.izq} y={g.M.arr} width={g.ancho} height={g.alto}></rect>
    {#if ref}<path class="referencia" d={ref} data-curva-buena></path>{/if}
    {#if trazo}<path class="suya" d={trazo} data-curva-suya></path>{/if}
    {#each ea.ys as y, k (k)}
      {#if y != null}<circle class="punto" cx={g.sx(xs[k]!)} cy={g.sy(y)} r={k === ea.punto ? 6 : 3}></circle>{/if}
    {/each}
    {#if ea.ys[ea.punto] == null}<circle class="guia" cx={g.sx(xs[ea.punto]!)} cy={g.sy(yPunto)} r="6"></circle>{/if}
  </svg>
  {#if verCurva}
    <p class="a12-suave leyenda"><span class="muestra suya-m"></span> su curva · <span class="muestra buena-m"></span> la curva buena</p>
  {/if}
  <div class="teclado" role="group" aria-label="Dibujar con el teclado">
    <button type="button" class="a12-boton" aria-label="Punto anterior" disabled={ea.punto === 0} onclick={() => elegirPunto(ea.punto - 1)} data-punto-anterior>◀</button>
    <label for={idValor} class="etq">Punto {ea.punto + 1} de {a.puntos} · {formatear(magX, xs[ea.punto])}</label>
    <button type="button" class="a12-boton" aria-label="Punto siguiente" disabled={ea.punto === a.puntos - 1} onclick={() => elegirPunto(ea.punto + 1)} data-punto-siguiente>▶</button>
    <input
      id={idValor}
      class="valor"
      type="range"
      min={a.y.min}
      max={a.y.max}
      step={pasoY}
      value={yPunto}
      disabled={bloqueado}
      aria-valuetext={leerUnidades(`Punto ${ea.punto + 1}, ${formatear(magX, xs[ea.punto])}: ${ea.ys[ea.punto] == null ? 'sin dibujar' : formatear(magY, ea.ys[ea.punto]!)}`)}
      oninput={(ev) => valorPunto(Number((ev.currentTarget as HTMLInputElement).value))}
      onkeydown={teclaValor}
      data-valor-punto
    />
    <button type="button" class="a12-boton" disabled={bloqueado || ea.ys.every((y) => y == null)} onclick={() => poner(ea.ys.map(() => null), 0)} data-borrar>Borrar</button>
  </div>
</div>

<style>
  svg {
    display: block;
    touch-action: none;
    cursor: crosshair;
    user-select: none;
  }
  svg.bloqueado {
    cursor: default;
    touch-action: pan-y;
  }
  .rejilla {
    stroke: var(--v11-linea);
    stroke-width: 1;
  }
  .eje {
    stroke: var(--v11-tinta-suave);
    stroke-width: 1.5;
  }
  .marca {
    fill: var(--v11-tinta-suave);
    font: 500 var(--tam-marca, 12px) var(--v11-texto);
  }
  .zona {
    fill: transparent;
  }
  .referencia {
    fill: none;
    stroke: var(--v11-naranja);
    stroke-width: 3;
    stroke-dasharray: 7 5;
  }
  .suya {
    fill: none;
    stroke: var(--v11-azul);
    stroke-width: 3;
    stroke-linejoin: round;
  }
  .punto {
    fill: var(--v11-azul);
  }
  .guia {
    fill: none;
    stroke: var(--v11-azul);
    stroke-width: 2;
    stroke-dasharray: 3 3;
  }
  .leyenda {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .muestra {
    display: inline-block;
    width: 22px;
    height: 0;
    border-top: 3px solid var(--v11-azul);
  }
  .buena-m {
    border-top: 3px dashed var(--v11-naranja);
  }
  .teclado {
    display: grid;
    grid-template-columns: 44px 1fr 44px;
    gap: 8px;
    align-items: center;
  }
  .etq {
    font-size: 14px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .valor {
    grid-column: 1 / -1;
    min-height: 44px;
    accent-color: var(--v11-azul);
  }
  .teclado [data-borrar] {
    grid-column: 1 / -1;
    justify-self: start;
  }
</style>
