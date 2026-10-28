<script lang="ts">
  // The new value of a changed part written over its label in the book figure (white patch + text in the
  // figure's colour and size), as a layer with the same viewBox as the live drawing under it.
  import type { Esquema } from '../figuras-vivas/tipos';
  import { etiquetaDeValor, type EtiquetaValor } from './etiquetas';
  import { valorTexto } from './variantes';

  let {
    src,
    esq,
    elemento,
    valor,
    unidad,
    vista,
  }: { src: string; esq: Esquema; elemento: string; valor: number; unidad: string; vista: [number, number, number, number] } = $props();

  let et = $state<EtiquetaValor | null>(null);
  $effect(() => {
    let vivo = true;
    void etiquetaDeValor(src, esq, elemento, vista).then((e) => {
      if (vivo) et = e;
    });
    return () => {
      vivo = false;
    };
  });

  const texto = $derived(et ? valorTexto(valor, unidad).replace(/ /g, et.separador) : '');
</script>

{#if et}
  <svg class="etiqueta-nueva" viewBox={vista.join(' ')} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <rect x={et.x - 1} y={et.y - 1} width={et.w + 2} height={et.h + 2} fill="#ffffff" />
    <text
      x={et.izquierda ? et.x + et.w : et.x}
      y={et.base}
      text-anchor={et.izquierda ? 'end' : 'start'}
      fill={et.color}
      font-size={et.h / 0.76}
      font-family="Source Sans 3, sans-serif"
      data-etiqueta-nueva={elemento}>{texto}</text
    >
  </svg>
{/if}

<style>
  .etiqueta-nueva {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
