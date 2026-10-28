<script lang="ts">
  // An equation of the book (Typst SVG) painted with the text colour through a mask, as Ecuacion.svelte does,
  // without the calculator button: for hints, key ideas and worked solutions.
  import { url, urlCss } from '../../lib/datos';

  let { svg, w, h, alt = '' }: { svg: string; w: number; h: number; alt?: string } = $props();

  const PT_TEXTO = 10.5 / 1.12;
  const src = $derived(url(svg));
  const estilo = $derived(
    `width:${(w / PT_TEXTO).toFixed(3)}em;height:${(h / PT_TEXTO).toFixed(3)}em;` + `-webkit-mask-image:${urlCss(src)};mask-image:${urlCss(src)}`,
  );
</script>

<span class="ec-libro"><img class="m" {src} {alt} style={estilo} draggable="false" /></span>

<style>
  .ec-libro {
    display: block;
    max-width: 100%;
    overflow-x: auto;
    padding: 4px 0;
    font-size: 18px;
    text-align: center;
  }
  img {
    display: inline-block;
    max-width: none;
    background: currentColor;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    vertical-align: middle;
  }
</style>
