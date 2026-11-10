<script lang="ts">
  // 1.1 schematic kit: an AC (sine) source on a vertical line from y1 to y2, leads included; a + mark at the top.
  let { x, y1, y2 }: { x: number; y1: number; y2: number } = $props();
  const m = $derived((y1 + y2) / 2);
</script>

<path class="hilo" d={`M${x} ${y1} V${m + 17} M${x} ${m - 17} V${y2}`}></path>
<circle class="hilo" cx={x} cy={m} r="17"></circle>
<path class="hilo fino" d={`M${x - 10} ${m} q5 -12 10 0 t10 0`}></path>
