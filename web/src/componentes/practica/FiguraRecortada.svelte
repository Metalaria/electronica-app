<script lang="ts">
  // A book figure shown whole or cropped to one of its schematics (`recorte`, SVG units of its viewBox):
  // a picture with two circuits, or a circuit next to a plot, shows only the circuit the question is about.
  import { url } from '../../lib/datos';

  let { src, vista, recorte = null, alt }: { src: string; vista: [number, number, number, number]; recorte?: [number, number, number, number] | null; alt: string } = $props();

  const r = $derived(recorte ?? vista);
</script>

<div class="fig-recortada" style:aspect-ratio={`${r[2]} / ${r[3]}`} style:width={`min(100%, ${(320 * r[2]) / r[3]}px)`}>
  <img
    src={url(src)}
    {alt}
    decoding="async"
    draggable="false"
    style:width={`${(vista[2] / r[2]) * 100}%`}
    style:height={`${(vista[3] / r[3]) * 100}%`}
    style:left={`${((vista[0] - r[0]) / r[2]) * 100}%`}
    style:top={`${((vista[1] - r[1]) / r[3]) * 100}%`}
  />
</div>

<style>
  .fig-recortada {
    position: relative;
    overflow: hidden;
    margin: 0 auto;
  }
  img {
    position: absolute;
    max-width: none;
    user-select: none;
  }
</style>
