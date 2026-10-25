<script lang="ts">
  // «Ver en 3D» button that the reader shows next to sections and figures about how a component is built
  // (catalogo3d.ts: libro). With several models it opens a short menu. Same look as «Ver animación».
  import Box from '@lucide/svelte/icons/box';
  import { modelosDe, hrefModelo } from './catalogo3d';
  import { app } from '../../lib/estado.svelte';
  import { prepararSalto } from '../../lib/ruta.svelte';
  import { ponerVista } from './compartir.svelte';

  let { label, compacto = false }: { label: string; compacto?: boolean } = $props();

  const lista = $derived(modelosDe(label));
  let abierto = $state(false);

  function salto(): void {
    const r = app.refs[label];
    prepararSalto({ texto: r ? `Volver a ${r.tipo === 'fig' ? 'la figura ' : ''}${r.num}` : 'Volver al libro' });
    ponerVista('3d');
  }
</script>

{#if lista.length === 1}
  <a class="ver" class:compacto href={hrefModelo(lista[0]!.tipo)} onclick={salto} title={`${lista[0]!.nombre} en 3D`} data-ver3d>
    <Box size={16} strokeWidth={2.2} /><span class="texto">Ver en 3D</span>
  </a>
{:else if lista.length > 1}
  <span class="grupo">
    <button type="button" class="ver" class:compacto aria-expanded={abierto} aria-label={`Ver en 3D (${lista.length} modelos)`} onclick={() => (abierto = !abierto)} data-ver3d>
      <Box size={16} strokeWidth={2.2} /><span class="texto">Ver en 3D</span><span class="n">{lista.length}</span>
    </button>
    {#if abierto}
      <ul class="menu">
        {#each lista as m (m.tipo)}
          <li><a href={hrefModelo(m.tipo)} onclick={salto}><span>{m.nombre}</span><small>{m.encapsulado}</small></a></li>
        {/each}
      </ul>
    {/if}
  </span>
{/if}

<style>
  .ver {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    padding: 0 12px;
    border: 1px solid var(--acento-borde);
    border-radius: 999px;
    background: var(--acento-tinte);
    color: var(--acento);
    font-family: var(--sans);
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
  }
  .ver:hover {
    background: var(--acento-suave);
    border-color: var(--acento);
  }
  .n {
    min-width: 18px;
    padding: 1px 5px;
    border-radius: 999px;
    background: var(--acento-suave);
    font-size: 12px;
    text-align: center;
  }
  @media (max-width: 640px) {
    .compacto .texto {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .ver.compacto {
      padding: 0 8px;
    }
  }
  .compacto {
    min-height: 28px;
    padding: 0 10px;
    font-size: 13px;
  }
  .grupo {
    position: relative;
    display: inline-block;
  }
  .menu {
    position: absolute;
    z-index: 12;
    top: calc(100% + 6px);
    left: 0;
    display: grid;
    gap: 2px;
    width: max-content;
    max-width: min(86vw, 360px);
    margin: 0;
    padding: 6px;
    list-style: none;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
  }
  .menu a {
    display: grid;
    gap: 1px;
    min-height: 40px;
    padding: 6px 10px;
    border-radius: 8px;
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 14.5px;
    font-weight: 600;
    text-decoration: none;
  }
  .menu small {
    font-size: 12.5px;
    font-weight: 500;
    color: var(--tinta-suave);
  }
  .menu a:hover {
    background: var(--hover);
  }
  @media (pointer: coarse) {
    .ver {
      position: relative;
      min-height: 40px;
    }
    .ver.compacto {
      min-height: 32px;
    }
    .ver.compacto::after {
      content: '';
      position: absolute;
      inset: -6px -2px;
    }
    .menu a {
      min-height: 44px;
    }
  }
</style>
