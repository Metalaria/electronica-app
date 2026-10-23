<script lang="ts">
  // Bottom tab bar (phone and tablet portrait): the registry's entries marked `pestana` and «Más» for the rest.
  // «Libro» opens the index drawer.
  import { app } from '../lib/estado.svelte';
  import { HERRAMIENTAS, INICIO, activar, esActiva, type Herramienta } from '../lib/navegacion.svelte';
  import Icono from './Icono.svelte';
  import MenuHerramientas from './MenuHerramientas.svelte';

  const pestanas = HERRAMIENTAS.filter((h) => h.pestana);
  const resto = [INICIO, ...HERRAMIENTAS.filter((h) => !h.pestana)];

  let mas = $state(false);
  let botonMas: HTMLButtonElement | undefined = $state();
  const masActivo = $derived(resto.some(esActiva));

  function activa(h: Herramienta): boolean {
    if (h.id === 'libro') return app.lateral || (esActiva(h) && !masActivo);
    return esActiva(h) && !app.lateral;
  }

</script>

<nav class="pestanas" aria-label="Secciones de la aplicación">
  {#each pestanas as h (h.id)}
    {#if h.ruta}
      <a class="pestana" class:activa={activa(h)} href={h.ruta} aria-label={h.etiqueta} aria-current={activa(h) ? 'page' : undefined} data-herramienta={h.id}>
        <span class="icono"><Icono nombre={h.icono} tam={23} /></span>
        <span class="etiqueta">{h.corta ?? h.etiqueta}</span>
      </a>
    {:else}
      <button
        class="pestana"
        class:activa={activa(h)}
        type="button"
        aria-label={h.etiqueta}
        aria-expanded={h.id === 'libro' ? app.lateral : undefined}
        data-herramienta={h.id}
        onclick={() => activar(h)}
      >
        <span class="icono"><Icono nombre={h.icono} tam={23} /></span>
        <span class="etiqueta">{h.corta ?? h.etiqueta}</span>
      </button>
    {/if}
  {/each}
  <button
    class="pestana"
    class:activa={masActivo && !app.lateral}
    bind:this={botonMas}
    type="button"
    aria-haspopup="menu"
    aria-expanded={mas}
    aria-label="Más"
    data-herramienta="mas"
    onclick={() => (mas = !mas)}
  >
    <span class="icono"><Icono nombre="mas" tam={23} /></span>
    <span class="etiqueta">Más</span>
  </button>
</nav>

{#if mas && botonMas}
  <MenuHerramientas items={resto} ancla={botonMas} modo="hoja" onCerrar={() => (mas = false)} />
{/if}

<style>
  .pestanas {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 28;
    display: flex;
    justify-content: space-around;
    height: calc(var(--alto-pestanas) + env(safe-area-inset-bottom));
    padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    background: color-mix(in srgb, var(--fondo-lateral) 96%, transparent);
    border-top: 1px solid var(--linea);
    -webkit-backdrop-filter: saturate(1.4) blur(12px);
    backdrop-filter: saturate(1.4) blur(12px);
    font-family: var(--sans);
  }
  @supports not (background: color-mix(in srgb, red 50%, blue)) {
    .pestanas {
      background: var(--fondo-lateral);
    }
  }
  /* the keyboard is up: the tabs would only take room above it */
  :global(html:has(input:not([type='range'], [type='checkbox'], [type='radio'], [type='button']):focus, textarea:focus)) .pestanas {
    display: none;
  }
  .pestana {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    max-width: 120px;
    min-width: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--tinta-suave);
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
  }
  .icono {
    display: grid;
    place-items: center;
    width: 56px;
    height: 30px;
    border-radius: 15px;
    transition: background 0.15s, color 0.15s;
  }
  .etiqueta {
    max-width: 100%;
    overflow: hidden;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pestana.activa .icono {
    background: var(--acento-suave);
    color: var(--acento);
  }
  .pestana.activa .etiqueta {
    color: var(--tinta);
    font-weight: 700;
  }
  .pestana:focus-visible {
    outline: none;
  }
  .pestana:focus-visible .icono {
    outline: 2px solid var(--acento);
  }
</style>
