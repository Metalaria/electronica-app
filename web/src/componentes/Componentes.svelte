<script lang="ts">
  // «Componentes» view: the gallery of component animations, or one animation (#/componentes/<id>).
  import { ruta } from '../lib/ruta.svelte';
  import Galeria from './animaciones/Galeria.svelte';
  import Pagina from './animaciones/Pagina.svelte';
</script>

{#if ruta.ancla}
  {#key ruta.ancla}<Pagina id={ruta.ancla} />{/key}
{:else}
  <Galeria />
{/if}
