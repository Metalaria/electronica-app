<script lang="ts">
  // 1.1 schematic kit: a DC source (battery) on a vertical line from y1 (−, bottom) to y2 (+, top), leads included.
  let { x, y1, y2, pieza, nodos }: { x: number; y1: number; y2: number; pieza?: string; nodos?: [string, string] } = $props();
  const m = $derived((y1 + y2) / 2);
</script>

<!-- 1.2: each lead is a wire of its own node (`nodos`: the y1 end, the y2 end), for the living circuit's colours -->
<path class="hilo" d={`M${x} ${y1} V${m + 6}`} data-red={nodos?.[0]}></path>
<path class="hilo" d={`M${x} ${m - 6} V${y2}`} data-red={nodos?.[1]}></path>
<g data-pieza={pieza} data-cuerpo={`${x - 16} ${m - 6} ${x + 16} ${m + 4}`}>
<path class="hilo" d={`M${x - 16} ${m - 6} H${x + 16}`}></path>
<path class="hilo gordo" d={`M${x - 8} ${m + 4} H${x + 8}`}></path>
</g>
