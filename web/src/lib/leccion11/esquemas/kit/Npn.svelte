<script lang="ts">
  // 1.1 schematic kit: an NPN transistor centred at (x, y): base lead from (x − 34, y), collector up to (x + 12, y − 40),
  // emitter down to (x + 12, y + 40), the arrow on the emitter pointing out.
  // 1.2 (esquemas12c): `espejo` mirrors it about x (base lead from (x + 34, y), collector and emitter at x − 12: the
  // right-hand transistor of a differential pair); `pnp` draws a PNP — the emitter is then the top terminal, its arrow
  // pointing in towards the base, and the collector the bottom one (a complementary output stage's lower transistor).
  let { x, y, color = 'tinta', pieza, espejo = false, pnp = false }: { x: number; y: number; color?: string; pieza?: string; espejo?: boolean; pnp?: boolean } = $props();
</script>

<g data-pieza={pieza} transform={espejo ? `translate(${2 * x} 0) scale(-1 1)` : undefined}>
<circle class="cuerpo" cx={x + 2} cy={y} r="22"></circle>
<path class={`pieza ${color}`} d={`M${x - 34} ${y} H${x - 8} M${x - 8} ${y - 14} V${y + 14}`}></path>
<path class={`pieza ${color}`} d={`M${x - 8} ${y - 6} L${x + 12} ${y - 20} V${y - 40} M${x - 8} ${y + 6} L${x + 12} ${y + 20} V${y + 40}`}></path>
{#if pnp}
<path class={`pieza relleno ${color}`} d={`M${x - 1} ${y - 10.9} L${x + 8.7} ${y - 12.8} L${x + 4.1} ${y - 19.4} Z`}></path>
{:else}
<path class={`pieza relleno ${color}`} d={`M${x + 12} ${y + 20} l-10 -2 l5 -7 Z`}></path>
{/if}
</g>
