<script lang="ts">
  // 1.1 schematic kit: a current source on a vertical line from y1 (bottom) to y2 (top); the arrow points to y2.
  let { x, y1, y2 }: { x: number; y1: number; y2: number } = $props();
  const m = $derived((y1 + y2) / 2);
</script>

<path class="hilo" d={`M${x} ${y1} V${m + 17} M${x} ${m - 17} V${y2}`}></path>
<circle class="hilo" cx={x} cy={m} r="17"></circle>
<path class="hilo fino" d={`M${x} ${m + 10} V${m - 9} M${x - 5} ${m - 3} L${x} ${m - 10} L${x + 5} ${m - 3}`}></path>
