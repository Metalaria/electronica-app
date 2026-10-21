<script lang="ts">
  // Display equation: an SVG rendered by Typst, painted with the text colour through a mask.
  import type { BEc } from '../lib/tipos';
  import { prepararHtml, url, urlCss } from '../lib/datos';

  let { bloque, indice }: { bloque: BEc; indice?: number } = $props();

  // Sizes are in points at the book's 10.5 pt text: in em they scale with the reader's font size.
  // The math font looks smaller than Source Serif at the same size, hence the small boost.
  const PT_TEXTO = 10.5 / 1.12;
  const src = $derived(url(bloque.svg));
  const estilo = $derived(
    `width:${(bloque.w / PT_TEXTO).toFixed(3)}em;height:${(bloque.h / PT_TEXTO).toFixed(3)}em;` +
      `-webkit-mask-image:${urlCss(src)};mask-image:${urlCss(src)}`,
  );
</script>

<div class="ec" id={bloque.label || undefined} data-b={indice}>
  {#if bloque.etiqueta}<div class="ec-etiqueta">{@html prepararHtml(bloque.etiqueta)}</div>{/if}
  <div class="ec-marco">
    <img class="m ec-img" {src} alt={bloque.fuente} title={bloque.fuente} style={estilo} draggable="false" />
  </div>
</div>
