<script lang="ts">
  // «Simular» next to a figure, section, problem or exercise that has netlists in the book's material.
  import { spice, rutaSimulacion } from '../simulador/datos.svelte';
  import Icono from './Icono.svelte';
  import MiniaturaEsquema from './miniaturas/MiniaturaEsquema.svelte';

  let { label, compacto = false }: { label: string | null | undefined; compacto?: boolean } = $props();

  const ids = $derived(label ? (spice.porRef[label] ?? []) : []);
  let abierto = $state(false);

  function nombre(id: string): string {
    return id.split('/')[1]?.replace(/_/g, ' ') ?? id;
  }
</script>

{#if ids.length === 1}
  <a class="simular" class:compacto href={rutaSimulacion(ids[0]!)} title="Abrir esta netlist en el simulador">
    <Icono nombre="simulador" tam={16} /> Simular
  </a>
{:else if ids.length > 1}
  <span class="grupo">
    <button class="simular" class:compacto aria-expanded={abierto} aria-haspopup="true" onclick={() => (abierto = !abierto)}>
      <Icono nombre="simulador" tam={16} /> Simular <span class="n">{ids.length}</span>
    </button>
    {#if abierto}
      <ul class="menu">
        {#each ids as id (id)}
          <li><a href={rutaSimulacion(id)} onclick={() => (abierto = false)}><MiniaturaEsquema {id} /><span>{nombre(id)}</span></a></li>
        {/each}
      </ul>
    {/if}
  </span>
{/if}

<style>
  .simular {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 32px;
    padding: 0 11px;
    border: 1px solid var(--acento-borde);
    border-radius: 999px;
    background: var(--superficie);
    color: var(--acento);
    font-family: var(--sans);
    font-size: 13.5px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    vertical-align: middle;
  }
  .simular:hover {
    background: var(--acento-tinte);
  }
  .simular.compacto {
    min-height: 28px;
    padding: 0 9px;
    font-size: 12.5px;
  }
  .n {
    min-width: 1.4em;
    padding: 0 4px;
    border-radius: 999px;
    background: var(--acento-suave);
    font-size: 11.5px;
    text-align: center;
  }
  .grupo {
    position: relative;
    display: inline-block;
  }
  .menu {
    position: absolute;
    z-index: 15;
    top: calc(100% + 4px);
    right: 0;
    min-width: 16em;
    max-width: min(26em, 86vw);
    margin: 0;
    padding: 6px;
    list-style: none;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
    text-align: left;
  }
  .menu a {
    /* Each netlist with a small thumbnail of its schematic. */
    --mini-w: 72px;
    --mini-h: 42px;
    --mini-radio: 7px;
    --mini-fondo: var(--superficie-2);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    border-radius: 7px;
    color: var(--tinta);
    font-family: var(--mono);
    font-size: 13px;
    text-decoration: none;
  }
  .menu a:hover {
    background: var(--hover);
  }
</style>
