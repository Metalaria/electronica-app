<script lang="ts">
  // The simulator's tabs: the book's netlists, the free netlist, and the schematic editor.
  import { ruta } from '../../lib/ruta.svelte';

  const actual = $derived(ruta.sim === 'nuevo' ? 'nuevo' : ruta.sim === 'editor' || ruta.sim.startsWith('editor/') ? 'editor' : ruta.sim ? '' : 'libro');
</script>

<nav class="pestanas-sim" aria-label="Simulador">
  <a href="#/simulador" aria-current={actual === 'libro' ? 'page' : undefined}>Netlists del libro</a>
  <a href="#/simulador/nuevo" aria-current={actual === 'nuevo' ? 'page' : undefined}>Netlist libre</a>
  <a href="#/editor" aria-current={actual === 'editor' ? 'page' : undefined}>Editor de esquemas</a>
</nav>

<style>
  .pestanas-sim {
    display: flex;
    gap: 2px;
    overflow-x: auto;
    border-bottom: 1px solid var(--linea-suave);
    font-family: var(--sans);
    scrollbar-width: none;
  }
  a {
    flex: none;
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 14px;
    border-bottom: 2.5px solid transparent;
    color: var(--tinta-suave);
    font-size: 14.5px;
    font-weight: 600;
    text-decoration: none;
  }
  a:hover {
    color: var(--tinta);
  }
  a[aria-current='page'] {
    color: var(--acento);
    border-bottom-color: var(--acento);
  }
</style>
