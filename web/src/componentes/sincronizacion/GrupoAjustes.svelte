<script lang="ts">
  // The «Sincronización» and «Actualizaciones» groups of the settings popover (Ajustes.svelte), loaded lazily.
  import { onMount } from 'svelte';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import { app } from '../../lib/estado.svelte';
  import { sinc, cargarSinc, sincronizar } from '../../lib/sincronizacion/sincronizar.svelte';
  import {
    actualizacion,
    buscarActualizaciones,
    versionNueva,
    abrirEnNavegador,
    REPO_APP,
  } from '../../lib/sincronizacion/actualizaciones.svelte';
  import { cuando } from './tiempo';

  const nueva = $derived(versionNueva());

  onMount(() => {
    void cargarSinc();
  });

  function configurar() {
    app.ajustes = false;
  }
</script>

<div class="grupo" data-grupo-sincronizacion>
  <span class="etiqueta" id="et-sinc">Sincronización</span>
  <p class="linea" aria-labelledby="et-sinc">
    {#if !sinc.cargado}
      …
    {:else if !sinc.hayToken}
      Desactivada: falta el token de GitHub.
    {:else if sinc.ocupado}
      Sincronizando…
    {:else if sinc.error}
      <span class="error">{sinc.error}</span>
    {:else if sinc.ultima}
      Última: {cuando(sinc.ultima)}.
    {:else}
      Aún no se ha sincronizado.
    {/if}
  </p>
  <div class="botones">
    {#if sinc.hayToken}
      <button class="boton" onclick={() => sincronizar(true)} disabled={sinc.ocupado}>
        <span class:gira={sinc.ocupado}><RefreshCw size={15} aria-hidden="true" /></span> Sincronizar ahora
      </button>
    {/if}
    <a class="boton" href="#/sincronizacion" onclick={configurar}>{sinc.hayToken ? 'Ajustes' : 'Configurar'}</a>
  </div>
</div>

<div class="grupo" data-grupo-actualizaciones>
  <span class="etiqueta" id="et-act">Versión {actualizacion.version}</span>
  {#if !sinc.cargado}
    <p class="linea">…</p>
  {:else if !sinc.hayToken}
    <p class="linea" data-sin-token>
      Sin token no se buscan actualizaciones: el repositorio {REPO_APP.owner}/{REPO_APP.repo} es privado.
    </p>
  {:else}
    <div class="botones">
      <button class="boton" onclick={() => buscarActualizaciones(true)} disabled={actualizacion.buscando}>
        <span class:gira={actualizacion.buscando}><RefreshCw size={15} aria-hidden="true" /></span> Buscar actualizaciones
      </button>
    </div>
    {#if actualizacion.error}
      <p class="linea error" role="alert">{actualizacion.error}</p>
    {:else if nueva}
      <p class="linea">
        <b>Versión {nueva.version} disponible.</b>
        <button class="enlace" onclick={() => abrirEnNavegador(nueva.url)}>Ver la publicación</button>
      </p>
    {:else if actualizacion.alDia}
      <p class="linea" role="status">Tiene la última versión.</p>
    {/if}
  {/if}
</div>

<style>
  .grupo {
    margin-top: 16px;
  }
  .etiqueta {
    display: block;
    margin-bottom: 6px;
    color: var(--tinta-tenue);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .linea {
    margin: 0 0 8px;
    color: var(--tinta-suave);
    font-size: 13.5px;
    line-height: 1.4;
  }
  .botones + .linea {
    margin: 8px 0 0;
  }
  .error {
    color: var(--c-precaucion);
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .boton {
    min-height: 34px;
    padding: 0 12px;
    font-size: 13.5px;
  }
  .boton:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .enlace {
    border: 0;
    padding: 0;
    background: none;
    color: var(--acento);
    font-weight: 600;
  }
  .gira {
    display: inline-grid;
    animation: girar 0.9s linear infinite;
  }
  @keyframes girar {
    to {
      transform: rotate(360deg);
    }
  }
</style>
