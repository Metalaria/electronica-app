<script lang="ts">
  import { app } from '../lib/estado.svelte';
  import { ruta } from '../lib/ruta.svelte';
  import { infoParte, rotuloParte } from '../lib/datos';
  import { abrirBuscador, abrirLateral } from '../lib/acciones';
  import Icono from './Icono.svelte';
  import Ajustes from './Ajustes.svelte';

  const esMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  const info = $derived(ruta.vista === 'parte' && app.cargado ? infoParte(ruta.parte) : undefined);
  const titulo = $derived.by(() => {
    if (!app.cargado) return '';
    if (ruta.vista === 'inicio') return 'Inicio';
    if (ruta.vista === 'glosario') return 'Glosario';
    if (ruta.vista === 'marcadores') return 'Marcadores y notas';
    return info ? (info.titulo.split(' — ')[0] ?? info.titulo) : '';
  });
  const rotulo = $derived(info && ruta.vista === 'parte' ? rotuloParte(ruta.parte) : '');
  const seccion = $derived(ruta.vista === 'parte' && app.seccion?.parte === ruta.parte ? app.seccion : null);

  let botonAjustes: HTMLButtonElement | undefined = $state();
</script>

<header class="barra">
  {#if app.movil}
    <button class="boton-icono" aria-label="Abrir el índice" onclick={abrirLateral}><Icono nombre="menu" tam={22} /></button>
  {/if}

  <div class="donde">
    {#if rotulo && rotulo !== titulo}
      <span class="rotulo">{rotulo}</span>
      <span class="sep" aria-hidden="true">·</span>
    {/if}
    <span class="titulo">{titulo}</span>
    {#if seccion && !app.movil}
      <span class="sep flecha" aria-hidden="true"><Icono nombre="chevron" tam={14} /></span>
      <span class="seccion"><b>{seccion.num}</b> {seccion.titulo}</span>
    {/if}
  </div>

  <div class="acciones">
    {#if app.movil}
      <button class="boton-icono" aria-label="Buscar" onclick={abrirBuscador}><Icono nombre="buscar" tam={21} /></button>
    {:else}
      <button class="buscar" onclick={abrirBuscador}>
        <Icono nombre="buscar" tam={17} />
        <span>Buscar en el libro</span>
        <kbd>{esMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
    {/if}
    <button
      class="boton-icono"
      aria-label="Tema y tamaño de letra"
      aria-expanded={app.ajustes}
      aria-haspopup="dialog"
      bind:this={botonAjustes}
      onclick={() => (app.ajustes = !app.ajustes)}
    >
      <span class="aa" aria-hidden="true">Aa</span>
    </button>
  </div>

  {#if ruta.vista === 'parte'}
    <div class="progreso" aria-hidden="true"><span style:transform={`scaleX(${app.progreso})`}></span></div>
  {/if}
</header>

{#if app.ajustes}
  <Ajustes ancla={botonAjustes} />
{/if}

<style>
  .barra {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 6px;
    height: calc(var(--alto-barra) + env(safe-area-inset-top));
    padding: env(safe-area-inset-top) 10px 0 14px;
    background: color-mix(in srgb, var(--fondo) 94%, transparent);
    border-bottom: 1px solid var(--linea-suave);
    -webkit-backdrop-filter: saturate(1.4) blur(12px);
    backdrop-filter: saturate(1.4) blur(12px);
    font-family: var(--sans);
  }
  @supports not (background: color-mix(in srgb, red 50%, blue)) {
    .barra {
      background: var(--fondo);
    }
  }
  .donde {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 7px;
    min-width: 0;
    padding-left: 4px;
    font-size: 15px;
    white-space: nowrap;
  }
  .rotulo {
    color: var(--acento);
    font-weight: 700;
  }
  .titulo {
    overflow: hidden;
    color: var(--tinta);
    font-weight: 600;
    text-overflow: ellipsis;
  }
  .sep {
    color: var(--tinta-tenue);
  }
  .flecha {
    display: inline-grid;
  }
  .seccion {
    overflow: hidden;
    color: var(--tinta-suave);
    text-overflow: ellipsis;
  }
  .seccion b {
    color: var(--acento);
    font-weight: 600;
  }
  .acciones {
    display: flex;
    flex: none;
    align-items: center;
    gap: 4px;
  }
  .buscar {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 250px;
    height: 36px;
    padding: 0 8px 0 12px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta-tenue);
    font-size: 14.5px;
    text-align: left;
    transition: border-color 0.15s;
  }
  .buscar:hover {
    border-color: var(--acento-borde);
  }
  .buscar span {
    flex: 1;
  }
  kbd {
    padding: 1px 6px;
    border: 1px solid var(--linea);
    border-radius: 5px;
    font-family: var(--sans);
    font-size: 11.5px;
  }
  .aa {
    font-family: var(--serif);
    font-size: 19px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .progreso {
    position: absolute;
    right: 0;
    bottom: -1px;
    left: 0;
    height: 2px;
    overflow: hidden;
  }
  .progreso span {
    display: block;
    height: 100%;
    background: var(--acento);
    transform-origin: left;
    transition: transform 0.12s linear;
  }
  @media (max-width: 1023px) {
    .barra {
      padding-left: 6px;
    }
    .donde {
      font-size: 15.5px;
    }
  }
  @media (max-width: 1180px) and (min-width: 1024px) {
    .buscar {
      width: 190px;
    }
  }
</style>
