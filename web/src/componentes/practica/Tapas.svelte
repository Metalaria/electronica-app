<script lang="ts">
  // QA 1.0: the book texts a challenge or a fault case must not show (`fuente.ocultar`: cut by the crop, side notes,
  // the readings that give the answer away or show the healthy circuit's values), painted over with the plate's
  // colour as a layer with the same viewBox as the figure under it. Inside an SVG (`dentro`) it draws only the rects.
  let { cajas, vista, dentro = false }: { cajas: [number, number, number, number][]; vista: [number, number, number, number]; dentro?: boolean } = $props();
</script>

{#if dentro}
  {#each cajas as c, i (i)}<rect class="tapa" x={c[0]} y={c[1]} width={c[2]} height={c[3]} data-tapa="" />{/each}
{:else if cajas.length}
  <svg class="tapas" viewBox={vista.join(' ')} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    {#each cajas as c, i (i)}<rect class="tapa" x={c[0]} y={c[1]} width={c[2]} height={c[3]} data-tapa="" />{/each}
  </svg>
{/if}

<style>
  .tapas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .tapa {
    fill: var(--placa, #ffffff);
  }
</style>
