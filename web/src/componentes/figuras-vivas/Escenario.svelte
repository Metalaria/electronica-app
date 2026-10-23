<script lang="ts">
  // The book's figure exactly as drawn (the SVG as an image) with the live layers stacked over it, in the
  // figure's own coordinates (viewBox = svg_vista), so they scale with it at any size.
  import type { Caja, DatosFigura } from './tipos';
  import type { Grupo } from './grafica/lectura';
  import type { EstadoGraficas } from './grafica/estado.svelte';
  import type { EstadoEsquema } from './esquema/modelo.svelte';
  import CapaGraficas from './grafica/CapaGraficas.svelte';
  import CapaEsquema from './esquema/CapaEsquema.svelte';

  let {
    src,
    alt,
    vista,
    datos,
    grupos,
    esquemas,
    estadoG,
    activo,
    alFondo,
    imagen,
    visible = null,
    ancho = $bindable(0),
  }: {
    src: string;
    alt: string;
    vista: Caja;
    datos: DatosFigura | null;
    grupos: Grupo[];
    esquemas: EstadoEsquema[];
    estadoG: EstadoGraficas;
    activo: boolean;
    /** Click on the figure outside the live regions. */
    alFondo?: () => void;
    /** viewBox of the whole picture when `vista` shows only a part of it (a crop). */
    imagen?: Caja;
    /** Part of `vista` on screen when zoomed (passed to the particle layer). */
    visible?: Caja | null;
    ancho?: number;
  } = $props();

  const k = $derived(ancho > 0 ? ancho / vista[2] : 0);

  function clic(ev: MouseEvent) {
    const t = ev.target as HTMLElement;
    if (t.closest('.zona-g, .zona-e, .ficha, .lectura-fv, a, button')) return;
    alFondo?.();
  }
</script>

<!-- Clicks outside the live regions open the full-screen view (keyboard: the «Abrir en grande» button). -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="escenario-fv" bind:clientWidth={ancho} onclick={clic} style:aspect-ratio={`${vista[2]} / ${vista[3]}`}>
  {#if imagen}
    <div class="recorte">
      <img
        {src}
        {alt}
        decoding="async"
        draggable="false"
        style:position="absolute"
        style:width={`${(imagen[2] / vista[2]) * 100}%`}
        style:height={`${(imagen[3] / vista[3]) * 100}%`}
        style:left={`${((imagen[0] - vista[0]) / vista[2]) * 100}%`}
        style:top={`${((imagen[1] - vista[1]) / vista[3]) * 100}%`}
      />
    </div>
  {:else}
    <img {src} {alt} decoding="async" draggable="false" />
  {/if}
  {#if datos && k > 0}
    {#if esquemas.length}
      <CapaEsquema {esquemas} {vista} {k} {activo} {visible} />
    {/if}
    {#if grupos.length}
      <CapaGraficas {datos} {grupos} {vista} {k} estado={estadoG} />
    {/if}
  {/if}
</div>

<style>
  .escenario-fv {
    position: relative;
    width: 100%;
  }
  .recorte {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    filter: var(--placa-filtro);
    -webkit-user-drag: none;
    user-select: none;
  }
</style>
