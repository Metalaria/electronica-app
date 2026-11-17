<script lang="ts">
  // 1.2.1 (motor121): where the probes of a card's instrument touch a node (GUIA §13.1). Draws nothing: it marks, for
  // componentes/leccion12/CircuitoVivo.svelte, the point of the drawing where the reader taps to put a probe on the
  // netlist node `red` (lower case, as the schematic's `medible().puntos`). Without it the probe goes on the node's
  // dot (`circle[data-red]`) or the middle of its longest wire (`path[data-red]`).
  let { x, y, red }: { x: number; y: number; red: string } = $props();
</script>

<g data-sonda={red.toLowerCase()} data-punto={`${x} ${y}`}></g>
