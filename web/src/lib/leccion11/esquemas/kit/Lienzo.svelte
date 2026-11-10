<script lang="ts">
  // 1.1 schematic kit: the drawing's <svg> (the schematic's viewBox, its description for screen readers).
  import type { Snippet } from 'svelte';
  let { ancho = 380, alto = 240, descripcion, children }: { ancho?: number; alto?: number; descripcion: string; children: Snippet } = $props();
  // Review 11c: on a phone the drawing scales down and its 13 px labels rendered at about 10 px; `--k` enlarges the
  // labels (esquemas11.css) just enough to render at 11 px or more (at most 25 %), and is 1 on wider screens.
  let svg: SVGSVGElement | undefined = $state();
  let k = $state(1);
  $effect(() => {
    const el = svg;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      k = w > 0 ? Math.min(1.25, Math.max(1, Math.ceil(((11.2 * ancho) / (13 * w)) * 50) / 50)) : 1;
    });
    ro.observe(el);
    return () => ro.disconnect();
  });
</script>

<svg bind:this={svg} class="e11" viewBox={`0 0 ${ancho} ${alto}`} width="100%" role="img" aria-label={descripcion} data-descripcion style:--k={k}>
  {@render children()}
</svg>
