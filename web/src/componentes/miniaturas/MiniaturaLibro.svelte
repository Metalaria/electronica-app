<script lang="ts">
  // Thumbnail of a book item by its label (a section of the search results, an exercise or problem, a
  // glossary term): the figure it refers to (public/miniaturas/indice.json), else the schematic of its
  // netlist (spice-refs.json), else the glossary symbol, else a neutral placeholder. Nothing is resolved
  // or requested until the box is about to be seen.
  import { cargarRefsSpice, spice } from '../../simulador/datos.svelte';
  import { cargarIndiceFiguras, figuraYa, simboloDeTermino } from './datos';
  import { visible } from './visible';
  import Hueco from './Hueco.svelte';
  import MiniaturaFigura from './MiniaturaFigura.svelte';
  import MiniaturaEsquema from './MiniaturaEsquema.svelte';

  type Que = { t: 'fig'; ruta: string } | { t: 'esq'; id: string } | { t: 'sim'; svg: string } | null;

  let { clave, icono = 'seccion' }: { clave: string; icono?: 'figura' | 'seccion' | 'termino' } = $props();

  let que = $state<Que | undefined>(undefined);
  let pedido = '';

  async function resolver(c: string): Promise<Que> {
    const ya = figuraYa(c);
    const fig = ya !== undefined ? ya : (await cargarIndiceFiguras())[c];
    if (fig) return { t: 'fig', ruta: fig };
    if (!spice.listo) await cargarRefsSpice();
    const nl = spice.porRef[c]?.[0];
    if (nl) return { t: 'esq', id: nl };
    if (c.startsWith('glos-')) {
      const s = await simboloDeTermino(c);
      if (s) {
        const m = await import('../glosario/simbolo');
        if (m.esClaveSimbolo(s)) return { t: 'sim', svg: m.svgSimbolo(s) };
      }
    }
    return null;
  }

  function alVer() {
    if (pedido === clave) return;
    const c = (pedido = clave);
    void resolver(c)
      .catch(() => null)
      .then((q) => {
        if (c === clave) que = q;
      });
  }

  // A row reused for another item: resolve again (at once, it is in view already).
  $effect(() => {
    if (pedido && clave !== pedido) {
      que = undefined;
      alVer();
    }
  });
</script>

{#if que?.t === 'fig'}
  <MiniaturaFigura ruta={que.ruta} ya />
{:else if que?.t === 'esq'}
  <MiniaturaEsquema id={que.id} />
{:else}
  <span class="mini" aria-hidden="true" data-miniatura={que?.t === 'sim' ? 'simbolo' : 'libro'} data-estado={que === undefined ? 'espera' : que ? 'lista' : 'hueco'} use:visible={alVer}>
    {#if que?.t === 'sim'}
      <span class="simbolo">{@html que.svg}</span>
    {:else if que === null}
      <Hueco icono={clave.startsWith('glos-') ? 'termino' : icono} />
    {/if}
  </span>
{/if}

<style>
  .mini {
    display: block;
    flex: none;
    box-sizing: border-box;
    width: var(--mini-w, 104px);
    height: var(--mini-h, 60px);
    padding: 6px;
    border: 1px solid var(--linea-suave);
    border-radius: var(--mini-radio, 10px);
    background: var(--mini-fondo, var(--superficie));
    overflow: hidden;
    contain: strict;
  }
  .simbolo {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    color: var(--titulos);
    --simbolo-fondo: var(--mini-fondo, var(--superficie));
  }
  .simbolo :global(svg) {
    width: 100%;
    height: 100%;
  }
  .simbolo :global(.t) {
    fill: currentColor;
  }
  .simbolo :global(.f) {
    fill: var(--simbolo-fondo);
  }
  .simbolo :global(text) {
    fill: currentColor;
    stroke: none;
    font-family: var(--sans);
  }
</style>
