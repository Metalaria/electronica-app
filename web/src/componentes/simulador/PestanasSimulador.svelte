<script lang="ts">
  // The simulator's tabs: the book's netlists, the free netlist, the schematic editor and the breadboard.
  import { ruta } from '../../lib/ruta.svelte';

  const actual = $derived(
    ruta.sim === 'nuevo' ? 'nuevo' : ruta.sim === 'editor' || ruta.sim.startsWith('editor/') ? 'editor' : ruta.sim === 'protoboard' || ruta.sim.startsWith('protoboard/') ? 'protoboard' : ruta.sim ? '' : 'libro',
  );
</script>

<!-- 2.1: the system's underline tabs (estilos/sistema21.css .pestanas21) -->
<nav class="pestanas-sim pestanas21" aria-label="Simulador">
  <a class="pestana21" href="#/simulador" aria-current={actual === 'libro' ? 'page' : undefined}>Netlists del libro</a>
  <a class="pestana21" href="#/simulador/nuevo" aria-current={actual === 'nuevo' ? 'page' : undefined}>Netlist libre</a>
  <a class="pestana21" href="#/editor" aria-current={actual === 'editor' ? 'page' : undefined}>Editor de esquemas</a>
  <a class="pestana21" href="#/protoboard" aria-current={actual === 'protoboard' ? 'page' : undefined}>Protoboard</a>
</nav>

<style>
  .pestanas-sim {
    font-family: var(--sans);
  }
</style>
