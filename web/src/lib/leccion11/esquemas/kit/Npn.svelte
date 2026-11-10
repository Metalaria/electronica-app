<script lang="ts">
  // 1.1 schematic kit: an NPN transistor centred at (x, y): base lead from (x − 34, y), collector up to (x + 12, y − 40),
  // emitter down to (x + 12, y + 40), the arrow on the emitter pointing out.
  let { x, y, color = 'tinta' }: { x: number; y: number; color?: string } = $props();
</script>

<circle class="cuerpo" cx={x + 2} cy={y} r="22"></circle>
<path class={`pieza ${color}`} d={`M${x - 34} ${y} H${x - 8} M${x - 8} ${y - 14} V${y + 14}`}></path>
<path class={`pieza ${color}`} d={`M${x - 8} ${y - 6} L${x + 12} ${y - 20} V${y - 40} M${x - 8} ${y + 6} L${x + 12} ${y + 20} V${y + 40}`}></path>
<path class={`pieza relleno ${color}`} d={`M${x + 12} ${y + 20} l-10 -2 l5 -7 Z`}></path>
