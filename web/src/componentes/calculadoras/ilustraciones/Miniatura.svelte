<script lang="ts">
  // Thumbnail of a family for the «Calculadoras» gallery: its representative drawing or curve, without values.
  import type { Formula } from '../tipos';
  import { valoresPorDefecto, calcular } from '../motor';
  import { GRAFICOS } from './graficos';
  import { contextoGrafico } from './contexto';
  import Esquema from './Esquema.svelte';
  import Grafico from './Grafico.svelte';

  let { f, tipo }: { f: Formula; tipo: 'esq' | 'graf' } = $props();

  const valores = $derived.by(() => {
    const v = valoresPorDefecto(f);
    v[f.resultado] = calcular(f, f.resultado, v).valor;
    return v;
  });
  const escena = $derived.by(() => {
    const g = f.figura?.grafico;
    if (tipo !== 'graf' || !g) return null;
    const k = GRAFICOS[g.p];
    return k ? k(contextoGrafico(f, g.s, valores, '')) : null;
  });
</script>

<div class="miniatura" aria-hidden="true">
  {#if tipo === 'esq' && f.figura?.esquema}
    <Esquema f={null} plantilla={f.figura.esquema.p} huecos={{}} valores={{}} miniatura />
  {:else if escena}
    <Grafico {escena} miniatura />
  {/if}
</div>

<style>
  .miniatura {
    pointer-events: none;
  }
  .miniatura :global(svg) {
    max-height: 88px;
  }
</style>
