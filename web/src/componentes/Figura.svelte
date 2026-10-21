<script lang="ts">
  import type { BFigura } from '../lib/tipos';
  import { prepararHtml, textoPlano, url } from '../lib/datos';
  import { abrirFigura } from '../lib/acciones';
  import Icono from './Icono.svelte';
  import BotonSimular from './BotonSimular.svelte';
  import VerAnimacion from './animaciones/VerAnimacion.svelte';

  let { bloque, indice }: { bloque: BFigura; indice?: number } = $props();

  const src = $derived(url(bloque.src));
  const vectorial = $derived(/\.svg$/i.test(bloque.src));
  const ancho = $derived(Math.min(1, Math.max(0.2, bloque.ancho ?? 1)));
  const alt = $derived(
    (bloque.num ? `Figura ${bloque.num}: ` : '') + (textoPlano(bloque.pie) || 'figura'),
  );

  function abrir() {
    abrirFigura({ src, num: bloque.num, pie: bloque.pie, credito: bloque.credito, alt });
  }
</script>

<figure class="figura" id={bloque.label || undefined} data-b={indice}>
  <button
    type="button"
    class="figura-placa"
    class:vectorial
    class:foto={!vectorial}
    style:--ancho={`${(ancho * 100).toFixed(1)}%`}
    aria-label={`Ampliar ${bloque.num ? `la figura ${bloque.num}` : 'la figura'}`}
    onclick={abrir}
  >
    <img {src} {alt} decoding="async" draggable="false" />
    <span class="lupa" aria-hidden="true"><Icono nombre="zoom-mas" tam={17} /></span>
  </button>
  {#if bloque.pie || bloque.num}
    <figcaption class="pie">
      {#if bloque.num}<span class="rot">Figura {bloque.num} —</span>{/if}
      {@html prepararHtml(bloque.pie)}
      {#if bloque.credito}<span class="credito">{@html prepararHtml(bloque.credito)}</span>{/if}
    </figcaption>
  {/if}
  {#if bloque.label}<div class="figura-simular"><BotonSimular label={bloque.label} /> <VerAnimacion label={bloque.label} /></div>{/if}
</figure>

<style>
  @media (max-width: 599px) {
    .figura-placa.vectorial {
      --ancho: 100% !important;
    }
  }
</style>
