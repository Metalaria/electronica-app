<script lang="ts">
  // 0.9 segmented progress bar: one segment per step, the done ones in the block colour, the current one amber.
  // Many steps (a long chapter) still fit: segments shrink to 2 px.
  let {
    total,
    hechos,
    actual = -1,
    color,
    etiqueta,
  }: {
    total: number;
    /** Segments done (the first `hechos`), or the exact set of indices done. */
    hechos: number | Set<number>;
    /** Index of the current segment (amber), -1 for none. */
    actual?: number;
    color?: string;
    /** Accessible description («Paso 4 de 7»); without it the bar is decorative. */
    etiqueta?: string;
  } = $props();

  const hecho = (i: number) => (typeof hechos === 'number' ? i < hechos : hechos.has(i));
</script>

<div
  class="t09-segmentos"
  style:--c09={color}
  role={etiqueta ? 'img' : undefined}
  aria-label={etiqueta}
  aria-hidden={etiqueta ? undefined : 'true'}
>
  {#each { length: Math.max(0, total) }, i (i)}
    <i class:hecho={i !== actual && hecho(i)} class:actual={i === actual}></i>
  {/each}
</div>
