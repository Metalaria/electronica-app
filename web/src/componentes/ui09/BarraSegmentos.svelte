<script lang="ts">
  // 0.9 segmented progress bar: one segment per step; 1.1: the mock-up's colours (done green, current blue, to do grey,
  // ui09.css). Many steps (a long chapter) still fit: segments shrink to 2 px.
  let {
    total,
    hechos,
    actual = -1,
    etiqueta,
  }: {
    total: number;
    /** Segments done (the first `hechos`), or the exact set of indices done. */
    hechos: number | Set<number>;
    /** Index of the current segment (amber), -1 for none. */
    actual?: number;
    /** Accessible description («Paso 4 de 7»); without it the bar is decorative. */
    etiqueta?: string;
  } = $props();

  const hecho = (i: number) => (typeof hechos === 'number' ? i < hechos : hechos.has(i));
</script>

<div
  class="t09-segmentos"
  role={etiqueta ? 'img' : undefined}
  aria-label={etiqueta}
  aria-hidden={etiqueta ? undefined : 'true'}
>
  {#each { length: Math.max(0, total) }, i (i)}
    <i class:hecho={i !== actual && hecho(i)} class:actual={i === actual}></i>
  {/each}
</div>
