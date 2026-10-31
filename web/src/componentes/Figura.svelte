<script lang="ts">
  import type { BFigura } from '../lib/tipos';
  import { prepararHtml, textoPlano, url } from '../lib/datos';
  import { abrirFigura } from '../lib/acciones';
  import Icono from './Icono.svelte';
  import BotonSimular from './BotonSimular.svelte';
  import VerAnimacion from './animaciones/VerAnimacion.svelte';
  import VerEn3D from './tres/VerEn3D.svelte';
  import VerConsola from './consolas/VerConsola.svelte';
  import VerKit from './fm7303/VerKit.svelte';
  import VerPlaca from './proyectos/VerPlaca.svelte';
  import VerProtoboard from './protoboard/VerProtoboard.svelte';
  import FiguraViva from './figuras-vivas/FiguraViva.svelte';
  import { datosVivos } from './figuras-vivas';

  let { bloque, indice }: { bloque: BFigura; indice?: number } = $props();

  const src = $derived(url(bloque.src));
  const vectorial = $derived(/\.svg$/i.test(bloque.src));
  /**
   * Width and height before the image loads (its aspect ratio): a vector figure's viewBox (pt), rounded, or a
   * photo's pixels (`img_tam`, written by contenido/datos_figuras.py).
   */
  const tamano = $derived.by(() => {
    if (!vectorial) return bloque.img_tam?.length === 2 ? { w: bloque.img_tam[0]!, h: bloque.img_tam[1]! } : null;
    const v = bloque.svg_vista;
    const w = v?.[2];
    const h = v?.[3];
    return w && h ? { w: Math.round(w), h: Math.round(h) } : null;
  });
  const ancho = $derived(Math.min(1, Math.max(0.2, bloque.ancho ?? 1)));
  const alt = $derived(
    (bloque.num ? `Figura ${bloque.num}: ` : '') + (textoPlano(bloque.pie) || 'figura'),
  );

  // Plots and schematics with figure data get the live layer (figuras-vivas/).
  const viva = $derived(vectorial ? datosVivos(bloque) : null);

  function abrir() {
    abrirFigura({ src, num: bloque.num, pie: bloque.pie, credito: bloque.credito, alt });
  }
</script>

<figure class="figura" id={bloque.label || undefined} data-b={indice}>
  {#if viva}
    <FiguraViva {src} {alt} num={bloque.num} pie={bloque.pie} credito={bloque.credito} ruta={viva.ruta} vista={viva.vista} tipo={viva.tipo} {ancho} abrirVisor={abrir} />
  {:else}
  <button
    type="button"
    class="figura-placa"
    class:vectorial
    class:foto={!vectorial}
    style:--ancho={`${(ancho * 100).toFixed(1)}%`}
    aria-label={`Ampliar ${bloque.num ? `la figura ${bloque.num}` : 'la figura'}`}
    onclick={abrir}
  >
    <!-- 0.11: the viewBox's size as width/height, so the figure keeps its height before the image arrives (the text
         under it jumped down by the figure's height on the tablet, in the reader and in the lessons) -->
    <img {src} {alt} width={tamano?.w} height={tamano?.h} decoding="async" draggable="false" />
    <span class="lupa" aria-hidden="true"><Icono nombre="zoom-mas" tam={17} /></span>
  </button>
  {/if}
  {#if bloque.pie || bloque.num}
    <figcaption class="pie">
      {#if bloque.num}<span class="rot">Figura {bloque.num} —</span>{/if}
      {@html prepararHtml(bloque.pie)}
      {#if bloque.credito}<span class="credito">{@html prepararHtml(bloque.credito)}</span>{/if}
    </figcaption>
  {/if}
  {#if bloque.label}<div class="figura-simular"><BotonSimular label={bloque.label} /> <VerAnimacion label={bloque.label} /> <VerEn3D label={bloque.label} /> <VerConsola label={bloque.label} /> <VerKit label={bloque.label} /> <VerPlaca label={bloque.label} /> <VerProtoboard {bloque} /></div>{/if}
</figure>

<style>
  @media (max-width: 599px) {
    .figura-placa.vectorial {
      --ancho: 100% !important;
    }
  }
</style>
