<script lang="ts">
  // 1.2 schematic kit: a dependent (controlled) source on a vertical line from y1 (bottom) to y2 (top), drawn as a
  // diamond: `corriente` with an arrow pointing to y2 (VCCS, CCCS), `tension` with + towards y2 and − towards y1
  // (VCVS, CCVS). Each lead is a wire of its own node (`nodos`: the y1 end, the y2 end), for the living circuit's
  // colours; the diamond is the body the particles keep out of (data-cuerpo).
  let { x, y1, y2, tipo = 'corriente', color = 'tinta', pieza, nodos }: { x: number; y1: number; y2: number; tipo?: 'corriente' | 'tension'; color?: string; pieza?: string; nodos?: [string, string] } = $props();
  const m = $derived((y1 + y2) / 2);
  const s = $derived(y2 < y1 ? 1 : -1);
</script>

<path class="hilo" d={`M${x} ${y1} V${m + 18 * s}`} data-red={nodos?.[0]}></path>
<path class="hilo" d={`M${x} ${m - 18 * s} V${y2}`} data-red={nodos?.[1]}></path>
<g data-pieza={pieza} data-cuerpo={`${x - 18} ${m - 18} ${x + 18} ${m + 18}`}>
<path class={`pieza ${color}`} d={`M${x} ${m - 18} L${x + 18} ${m} L${x} ${m + 18} L${x - 18} ${m} Z`}></path>
{#if tipo === 'corriente'}
  <path class={`pieza fina ${color}`} d={`M${x} ${m + 9 * s} V${m - 9 * s} M${x - 5} ${m - 3 * s} L${x} ${m - 10 * s} L${x + 5} ${m - 3 * s}`}></path>
{:else}
  <path class={`pieza fina ${color}`} d={`M${x - 4} ${m - 7 * s} H${x + 4} M${x} ${m - 11 * s} V${m - 3 * s} M${x - 4} ${m + 7 * s} H${x + 4}`}></path>
{/if}
</g>
