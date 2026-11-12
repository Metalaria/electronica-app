<script lang="ts">
  // 1.1 schematic kit: an AC (sine) source on a vertical line from y1 to y2, leads included; a + mark at the top.
  let { x, y1, y2, pieza, nodos }: { x: number; y1: number; y2: number; pieza?: string; nodos?: [string, string] } = $props();
  const m = $derived((y1 + y2) / 2);
</script>

<!-- 1.2: each lead is a wire of its own node (`nodos`: the y1 end, the y2 end), for the living circuit's colours -->
<path class="hilo" d={`M${x} ${y1} V${m + 17}`} data-red={nodos?.[0]}></path>
<path class="hilo" d={`M${x} ${m - 17} V${y2}`} data-red={nodos?.[1]}></path>
<g data-pieza={pieza} data-alterna>
<circle class="hilo" cx={x} cy={m} r="17"></circle>
<path class="hilo fino" d={`M${x - 10} ${m} q5 -12 10 0 t10 0`}></path>
</g>
