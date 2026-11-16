<script lang="ts">
  // 1.2.1 (piloto121): where the ammeter of a card's instrument opens a branch (GUIA §13.1). Draws nothing: it marks,
  // for componentes/leccion12/CircuitoVivo.svelte, the point of the drawing where the reader taps to put the meter in
  // series with the branch whose 0 V meter source is `medidor` (the netlist's name, as `Flujo`'s `medidor`).
  let { x, y, medidor }: { x: number; y: number; medidor: string } = $props();
</script>

<g data-rama={medidor.toLowerCase()} data-punto={`${x} ${y}`}></g>
