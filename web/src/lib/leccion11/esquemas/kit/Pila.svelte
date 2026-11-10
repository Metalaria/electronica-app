<script lang="ts">
  // 1.1 schematic kit: a DC source (battery) on a vertical line from y1 (−, bottom) to y2 (+, top), leads included.
  let { x, y1, y2 }: { x: number; y1: number; y2: number } = $props();
  const m = $derived((y1 + y2) / 2);
</script>

<path class="hilo" d={`M${x} ${y1} V${m + 6} M${x} ${m - 6} V${y2}`}></path>
<path class="hilo" d={`M${x - 16} ${m - 6} H${x + 16}`}></path>
<path class="hilo gordo" d={`M${x - 8} ${m + 4} H${x + 8}`}></path>
