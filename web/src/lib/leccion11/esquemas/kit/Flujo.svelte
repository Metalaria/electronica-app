<script lang="ts">
  // 1.1 schematic kit: the moving current along a path (one lap every `dur` seconds; still with reduced motion).
  // 1.2: the living circuit (componentes/leccion12/CircuitoVivo.svelte) moves particles along it instead, with the
  // current `i` (A, signed: positive goes the way the path is drawn) or, when the netlist is solved, the current of the
  // 0 V meter `medidor` (SPICE sign); without either, the widget's «corriente».
  let { d, dur, i, medidor }: { d: string; dur: number; i?: number; medidor?: string } = $props();
</script>

<path class="flujo" {d} style:animation-duration={`${dur.toFixed(2)}s`} data-i={i} data-medidor={medidor}></path>
