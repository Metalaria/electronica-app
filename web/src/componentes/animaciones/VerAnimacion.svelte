<script lang="ts">
  // «Ver animación» button that the reader shows next to a section heading or a figure illustrated by one
  // or more component animations. With several, it opens a short menu.
  import Play from '@lucide/svelte/icons/circle-play';
  import { animacionesDe } from './catalogo';
  import { disponible } from './cargadores';
  import { app } from '../../lib/estado.svelte';
  import { prepararSalto } from '../../lib/ruta.svelte';
  import Simbolo from './ui/Simbolo.svelte';

  let { label, compacto = false }: { label: string; compacto?: boolean } = $props();

  const lista = $derived(animacionesDe(label).filter((a) => disponible(a.id)));
  let abierto = $state(false);

  function salto(): void {
    const r = app.refs[label];
    prepararSalto({ texto: r ? `Volver a ${r.tipo === 'fig' ? 'la figura ' : ''}${r.num}` : 'Volver al libro' });
  }
</script>

{#if lista.length === 1}
  <a class="ver" class:compacto href={`#/componentes/${lista[0]!.id}`} onclick={salto} title={lista[0]!.titulo}>
    <Play size={16} strokeWidth={2.2} /><span class="texto">Ver animación</span>
  </a>
{:else if lista.length > 1}
  <span class="grupo">
    <button type="button" class="ver" class:compacto aria-expanded={abierto} aria-label={`Ver animaciones (${lista.length})`} onclick={() => (abierto = !abierto)}>
      <Play size={16} strokeWidth={2.2} /><span class="texto">Ver animaciones</span><span class="n">{lista.length}</span>
    </button>
    {#if abierto}
      <ul class="menu">
        {#each lista as a (a.id)}
          <li>
            <a href={`#/componentes/${a.id}`} onclick={salto}>
              <span class="arte"><Simbolo s={a.simbolo} tam={52} /></span>
              <span>{a.titulo}</span>
            </a>
          </li>
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
    transition:
      background 0.15s,
      border-color 0.15s;
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
  /* Next to a heading on a phone, only the icon (and the count): the title keeps the width. */
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
    max-width: min(86vw, 380px);
    margin: 0;
    padding: 6px;
    list-style: none;
    border: 1px solid var(--linea);
    border-radius: 12px;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
  }
  .menu a {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px 6px 6px;
    border-radius: 8px;
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 14.5px;
    font-weight: 600;
    text-decoration: none;
  }
  .menu a:hover {
    background: var(--hover);
  }
  .arte {
    display: grid;
    place-items: center;
    flex: none;
    width: 58px;
    height: 36px;
    border-radius: 7px;
    background: var(--superficie-2);
  }
  /* Touch screens: the compact chip keeps its look next to headings, but its hit area grows to 44 px. */
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
