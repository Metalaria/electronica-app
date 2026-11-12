<script lang="ts">
  // 1.2 schematic kit (esquemas12): an enhancement MOSFET centred at (x, y), the same terminals as kit/Npn.svelte: gate
  // lead from (x − 34, y), drain up to (x + 12, y − 40), source down to (x + 12, y + 40). N channel: the arrow on the
  // body points in; P channel (`canal="p"`): out, and the source is at the top (x + 12, y − 40) and the drain at the
  // bottom. The body is tied to the source. `diodo` draws the body diode (anode on the source for N, cathode on the
  // source for P) to the right of the channel. The channel, gate and diode box is the body the particles and the wires
  // keep out of (data-cuerpo); the drain–source line runs through it, as through a transistor's circle.
  let { x, y, color = 'tinta', canal = 'n', diodo = false, pieza }: { x: number; y: number; color?: string; canal?: 'n' | 'p'; diodo?: boolean; pieza?: string } = $props();
  // the source is the terminal the body is tied to: at the bottom for N, at the top for P
  const ys = $derived(canal === 'n' ? y + 14 : y - 14);
  const terminales = $derived(`M${x + 12} ${y - 40} V${y - 14} H${x - 4} M${x + 12} ${y + 40} V${y + 14} H${x - 4} M${x - 4} ${y} H${x + 12} V${ys}`);
  // N: the arrow points into the channel (towards x − 4); P: out of it
  const flecha = $derived(canal === 'n' ? `M${x - 3} ${y} l8 -4.5 v9 Z` : `M${x + 9} ${y} l-8 -4.5 v9 Z`);
  // the body diode, between y ∓ 28 on the drain and source leads; its triangle points from anode to cathode
  const dio = $derived.by(() => {
    const xa = x + 30;
    // N: anode at the source (bottom), cathode at the drain (top); P: anode at the drain (bottom), cathode at the
    // source (top) — the triangle points up either way
    const arriba = y - 28;
    const abajo = y + 28;
    return {
      hilos: `M${x + 12} ${arriba} H${xa} V${y - 7} M${xa} ${y + 7} V${abajo} H${x + 12}`,
      triangulo: `M${xa - 7} ${y + 6} H${xa + 7} L${xa} ${y - 6} Z`,
      barra: `M${xa - 7} ${y - 6} H${xa + 7}`,
    };
  });
</script>

<g data-pieza={pieza} data-cuerpo={`${x - 12} ${y - 22} ${diodo ? x + 38 : x + 18} ${y + 22}`}>
<path class={`pieza ${color}`} d={`M${x - 34} ${y} H${x - 10} M${x - 10} ${y - 15} V${y + 15}`}></path>
<path class={`pieza ${color}`} d={`M${x - 4} ${y - 18} V${y - 9} M${x - 4} ${y - 5} V${y + 5} M${x - 4} ${y + 9} V${y + 18}`}></path>
<path class={`pieza fina ${color}`} d={terminales}></path>
<path class={`pieza relleno ${color}`} d={flecha}></path>
{#if diodo}
  <path class={`pieza fina ${color}`} d={dio.hilos}></path>
  <path class={`pieza relleno ${color}`} d={dio.triangulo}></path>
  <path class={`pieza ${color}`} d={dio.barra}></path>
{/if}
</g>
