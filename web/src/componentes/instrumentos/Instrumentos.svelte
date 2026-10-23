<script lang="ts">
  // «Instrumentos» view (#/instrumentos…): the virtual Brymen BM869s and FNIRSI 2C53T on a test bench.
  //   #/instrumentos                      practices of printed chapter 21 and the free bench
  //   #/instrumentos/practica/<n>         guided practice n (1 … 12)
  //   #/instrumentos/circuito/<parte>/<nombre>   a netlist of the simulator's catalogue on the bench
  //   #/instrumentos/libre                the free bench (choose any netlist)
  // Loaded on demand from App.svelte.
  import { ruta } from '../../lib/ruta.svelte';
  import Portada from './Portada.svelte';
  import VistaBanco from './VistaBanco.svelte';

  const partes = $derived(ruta.ancla.split('/'));
</script>

{#if !ruta.ancla}
  <Portada />
{:else}
  {#key ruta.ancla}
    <VistaBanco tipo={partes[0] ?? ''} id={partes.slice(1).join('/')} />
  {/key}
{/if}
