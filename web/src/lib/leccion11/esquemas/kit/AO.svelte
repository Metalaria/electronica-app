<script lang="ts">
  // 1.2 schematic kit: an operational amplifier, a triangle with its left side at x, from y − 35 to y + 35, and its
  // output at the tip (x + 60, y). The inverting input (−) is at (x, y − 20) and the non-inverting one (+) at
  // (x, y + 20), or the other way round with `masArriba`. No leads: the wires end on its sides. The whole triangle's box
  // is the body the particles and the wires keep out of (data-cuerpo).
  // 1.2 (esquemas12): `alimentacion` draws the two supply pins, from the middle of the triangle's slanted sides up to
  // (x + 30, y − 45) (+V) and down to (x + 30, y + 45) (−V); their labels are the schematic's.
  let { x, y, color = 'tinta', masArriba = false, alimentacion = false, pieza }: { x: number; y: number; color?: string; masArriba?: boolean; alimentacion?: boolean; pieza?: string } = $props();
  const yMenos = $derived(masArriba ? y + 20 : y - 20);
  const yMas = $derived(masArriba ? y - 20 : y + 20);
</script>

<g data-pieza={pieza} data-cuerpo={`${x} ${y - 35} ${x + 60} ${y + 35}`}>
<path class={`pieza ${color}`} d={`M${x} ${y - 35} L${x + 60} ${y} L${x} ${y + 35} Z`}></path>
<path class={`pieza fina ${color}`} d={`M${x + 7} ${yMenos} H${x + 15} M${x + 7} ${yMas} H${x + 15} M${x + 11} ${yMas - 4} V${yMas + 4}`}></path>
{#if alimentacion}<path class={`pieza fina ${color}`} d={`M${x + 30} ${y - 17.5} V${y - 45} M${x + 30} ${y + 17.5} V${y + 45}`}></path>{/if}
</g>
