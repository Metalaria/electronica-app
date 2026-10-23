<script lang="ts">
  // «Conceptos» view: the gallery of concept animations, or one of them (#/conceptos/<id>).
  import { ruta } from '../lib/ruta.svelte';
  import { CONCEPTOS_ANIMADOS } from './animaciones/coleccion';
  import Galeria from './animaciones/Galeria.svelte';
  import Pagina from './animaciones/Pagina.svelte';
</script>

{#if ruta.ancla}
  {#key ruta.ancla}<Pagina id={ruta.ancla} coleccion={CONCEPTOS_ANIMADOS} />{/key}
{:else}
  <Galeria coleccion={CONCEPTOS_ANIMADOS} />
{/if}
