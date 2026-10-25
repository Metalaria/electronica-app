<script lang="ts">
  // «Componentes» view: the gallery of component animations or, with the «2D | 3D» switch on 3D, the
  // catalogue of 3D models (remembered per reader); one animation (#/componentes/<id>) or one 3D model
  // (#/componentes/3d/<tipo>).
  import { onMount } from 'svelte';
  import { ruta } from '../lib/ruta.svelte';
  import Galeria from './animaciones/Galeria.svelte';
  import Pagina from './animaciones/Pagina.svelte';
  import Catalogo3D from './tres/Catalogo3D.svelte';
  import Pagina3D from './tres/Pagina3D.svelte';
  import { cargarVista, vista3d } from './tres/compartir.svelte';

  onMount(() => void cargarVista());
</script>

{#if ruta.ancla.startsWith('3d/')}
  {#key ruta.ancla}<Pagina3D ancla={ruta.ancla.slice(3)} />{/key}
{:else if ruta.ancla === '3d'}
  <Catalogo3D />
{:else if ruta.ancla}
  {#key ruta.ancla}<Pagina id={ruta.ancla} />{/key}
{:else if vista3d.modo === '3d'}
  <Catalogo3D />
{:else}
  <Galeria />
{/if}
