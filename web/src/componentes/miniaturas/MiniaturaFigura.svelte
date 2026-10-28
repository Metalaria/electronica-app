<script lang="ts">
  // Thumbnail of a book figure (WebP pre-rendered by scripts/miniaturas.mjs, transparent, on the figure plate
  // of the theme): a fixed box whose image is requested only when it is about to be seen; decoded off the
  // main thread. Neutral placeholder when there is no figure or the file cannot be loaded. `src` gives the
  // image directly instead of a figure (e.g. a breadboard drawn as an SVG data URL).
  import { untrack } from 'svelte';
  import { urlFigura } from './datos';
  import { visible } from './visible';
  import Hueco from './Hueco.svelte';

  let {
    ruta = null,
    src: directa = undefined,
    icono = 'figura',
    ya = false,
  }: { ruta?: string | null; src?: string | null; icono?: 'figura' | 'seccion' | 'termino' | 'esquema'; ya?: boolean } = $props();

  let ver = $state(untrack(() => ya));
  const fuente = $derived(directa !== undefined ? directa : ruta ? urlFigura(ruta) : null);
  const src = $derived(ver && fuente ? fuente : undefined);
  /** The source that could not be loaded (a new one, e.g. a montage saved again, is tried). */
  let fallida = $state<string | null>(null);
  const fallo = $derived(!!fuente && fallida === fuente);
</script>

<span class="mini mini-figura" aria-hidden="true" data-miniatura="figura" data-estado={!fuente || fallo ? 'hueco' : src ? 'lista' : 'espera'} use:visible={() => (ver = true)}>
  {#if !fuente || fallo}
    <Hueco {icono} />
  {:else if src}
    <img {src} alt="" width="192" height="144" loading="lazy" decoding="async" onerror={() => (fallida = fuente)} />
  {/if}
</span>

<style>
  .mini {
    display: block;
    flex: none;
    box-sizing: border-box;
    width: var(--mini-w, 104px);
    height: var(--mini-h, 60px);
    padding: 3px;
    border: 1px solid var(--linea-suave);
    border-radius: var(--mini-radio, 10px);
    background: var(--mini-fondo, var(--superficie));
    overflow: hidden;
    contain: strict;
  }
  .mini[data-estado='lista'] {
    background: var(--placa);
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: var(--placa-filtro);
  }
</style>
