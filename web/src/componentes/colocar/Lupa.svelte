<script lang="ts">
  // 1.3 (tactil13): the loupe of a placement drag. A round window near the finger with the area around the target
  // magnified — a live <use> of the drawing (a breadboard's group or a schematic's <svg>), so it shows what is being
  // dragged as it moves —, a ring on the snapped hole or node, and under it the name of that place (the preview of
  // where it will land). Hidden from screen readers: the hosts announce the result in words. Fixed to the window, it
  // corrects for a transformed ancestor (which would make it relative to that ancestor).
  import { posicionLupa } from './precision';

  let {
    origen,
    objetivo,
    marca = null,
    etiqueta = '',
    mal = false,
    zoom = 2.5,
    radio = 64,
    fondo = 'var(--superficie, #fff)',
    color = '#f2b705',
  }: {
    /** What is magnified: an SVG <g> (its parent's screen transform is used) or an <svg>. */
    origen: SVGGraphicsElement | null;
    /** The point the loupe is centred on (client px): where the lifted tip is. */
    objetivo: { x: number; y: number };
    /** The snapped place (client px), ringed; null: nothing to snap to (off the holes). */
    marca?: { x: number; y: number } | null;
    /** The place's name («C12 · tira 12 de arriba»). */
    etiqueta?: string;
    /** It cannot go there (red ring and label). */
    mal?: boolean;
    zoom?: number;
    radio?: number;
    fondo?: string;
    color?: string;
  } = $props();

  const uid = $props.id();
  let caja: HTMLDivElement | undefined = $state();
  /** Offset of the fixed box's containing block (a transformed ancestor), measured once. */
  let base = $state({ x: 0, y: 0 });
  $effect(() => {
    const el = caja;
    if (!el) return;
    const l = el.style.left;
    const t = el.style.top;
    el.style.left = '0px';
    el.style.top = '0px';
    const r = el.getBoundingClientRect();
    el.style.left = l;
    el.style.top = t;
    base = { x: r.left, y: r.top };
  });

  const ref = $derived.by(() => {
    const o = origen;
    if (!o) return null;
    if (!o.id) o.id = `lupa-${uid}`;
    return o.id;
  });

  /** How the <use> sits in client px: an <svg> by its box, a <g> by its parent's screen matrix. */
  function colocacion(o: SVGGraphicsElement | null, _t: unknown): { svg?: DOMRect; m?: string } {
    if (!o) return {};
    if (o instanceof SVGSVGElement) return { svg: o.getBoundingClientRect() };
    const p = o.parentNode as SVGGraphicsElement | null;
    const m = p?.getScreenCTM?.();
    return m ? { m: `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})` } : {};
  }
  const geo = $derived(colocacion(origen, objetivo));
  const centro = $derived(posicionLupa(objetivo, { ancho: typeof innerWidth === 'number' ? innerWidth : 400, alto: typeof innerHeight === 'number' ? innerHeight : 800 }, radio));
  const lado = $derived((2 * radio) / zoom);
  // (the name goes above the loupe, which is above the target, so it never covers the target; below at the top edge)
  const arriba = $derived(centro.y - radio > 44);
  // 1.3 (averias13): a long name (a console's pad with its net) stays inside the window: shifted sideways
  // (1.3.1: the label's width is read only when its text changes — reading it on every move of the finger forced a
  // layout of the whole page per pointermove, the main cost of a drag on a phone)
  let rotulo: HTMLParagraphElement | undefined = $state();
  let anchoRotulo = $state(0);
  $effect(() => {
    void etiqueta;
    const el = rotulo;
    if (el) anchoRotulo = el.offsetWidth;
  });
  const corrimiento = $derived.by(() => {
    const w = anchoRotulo;
    const ancho = typeof innerWidth === 'number' ? innerWidth : 400;
    const izq = centro.x - w / 2;
    return izq < 8 ? 8 - izq : izq + w > ancho - 8 ? ancho - 8 - (izq + w) : 0;
  });
</script>

<div
  class="lupa"
  bind:this={caja}
  aria-hidden="true"
  data-lupa
  style:left={`${centro.x - radio - base.x}px`}
  style:top={`${centro.y - radio - base.y}px`}
  style:--r={`${radio}px`}
  style:--c={mal ? '#d93025' : color}
>
  <div class="ventana" style:background={fondo}>
    <svg width={2 * radio} height={2 * radio} viewBox={`${objetivo.x - lado / 2} ${objetivo.y - lado / 2} ${lado} ${lado}`}>
      {#if ref}
        {#if geo.svg}
          <use href={`#${ref}`} x={geo.svg.left} y={geo.svg.top} width={geo.svg.width} height={geo.svg.height} />
        {:else if geo.m}
          <g transform={geo.m}><use href={`#${ref}`} /></g>
        {/if}
      {/if}
      {#if marca}
        <circle class="anillo" cx={marca.x} cy={marca.y} r={9 / zoom} stroke-width={3 / zoom} />
      {/if}
      <!-- the crosshair: where the lifted tip is -->
      <path class="cruz" d={`M${objetivo.x - 5 / zoom} ${objetivo.y}h${10 / zoom}M${objetivo.x} ${objetivo.y - 5 / zoom}v${10 / zoom}`} stroke-width={1.2 / zoom} />
    </svg>
  </div>
  {#if etiqueta}
    <p class="etiqueta" class:mal class:arriba data-destino={etiqueta} bind:this={rotulo} style:--dx={`${corrimiento}px`}>{etiqueta}</p>
  {/if}
</div>

<style>
  .lupa {
    position: fixed;
    z-index: 60;
    width: calc(2 * var(--r));
    pointer-events: none;
  }
  .ventana {
    width: calc(2 * var(--r));
    height: calc(2 * var(--r));
    border: 3px solid var(--c);
    border-radius: 50%;
    overflow: hidden;
    box-sizing: content-box;
    margin: -3px;
    box-shadow: 0 6px 22px rgba(0, 0, 0, 0.32);
  }
  svg {
    display: block;
  }
  .anillo {
    fill: color-mix(in srgb, var(--c) 22%, transparent);
    stroke: var(--c);
  }
  .cruz {
    stroke: #d93025;
    fill: none;
  }
  .etiqueta {
    position: absolute;
    left: 50%;
    top: calc(2 * var(--r) + 8px);
    transform: translateX(calc(-50% + var(--dx, 0px)));
    margin: 0;
    padding: 4px 10px;
    border-radius: 10px;
    background: var(--superficie, #fff);
    color: var(--tinta, #1d2a3a);
    border: 2px solid var(--c);
    font: 700 14px/1.25 var(--sans, sans-serif);
    white-space: nowrap;
    max-width: calc(100vw - 16px);
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
  }
  .etiqueta.arriba {
    top: auto;
    bottom: calc(2 * var(--r) + 8px);
  }
  .etiqueta.mal {
    /* 1.3.1 (qa131-temas): the theme's red — a fixed #b3261e was 2.4:1 on the dark theme's surface */
    color: var(--v11-rojo, #b3261e);
  }
</style>
