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
  } from '../../lib/sincronizacion/actualizaciones.svelte';
  import { instalador } from '../../lib/sincronizacion/instalador.svelte';
  import BotonesInstalador from './BotonesInstalador.svelte';
  import { cuando } from './tiempo';
  import { exportarCopia } from './exportar';

  // 0.12: «Copia de seguridad» — export here; import (with its preview) on the Sincronización page
  let exportando = $state(false);
  let avisoCopia = $state('');
  let errorCopia = $state(false);
  async function exportar() {
    exportando = true;
    avisoCopia = '';
    try {
      avisoCopia = await exportarCopia();
      errorCopia = false;
    } catch (e) {
      avisoCopia = e instanceof Error ? e.message : String(e);
      errorCopia = true;
    } finally {
      exportando = false;
    }
  }

  const nueva = $derived(versionNueva());
  const buscando = $derived(actualizacion.buscando || instalador.estado === 'buscando');

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

<div class="grupo" data-grupo-copia>
  <span class="etiqueta" id="et-copia">Copia de seguridad</span>
  <p class="linea" aria-labelledby="et-copia">Todo su progreso en un fichero, para guardarlo o pasarlo a otro dispositivo.</p>
  <div class="botones">
    <button class="boton toque-44" onclick={exportar} disabled={exportando} data-aa-exportar>Exportar copia</button>
    <a class="boton toque-44" href="#/sincronizacion/copia" onclick={configurar} data-aa-importar>Importar…</a>
  </div>
  {#if avisoCopia}<p class="linea" class:error={errorCopia} role={errorCopia ? 'alert' : 'status'} data-aa-aviso-copia>{avisoCopia}</p>{/if}
</div>

<!-- No token needed (0.12): the app's repository is public -->
<div class="grupo" data-grupo-actualizaciones>
  <span class="etiqueta" id="et-act">Versión {actualizacion.version}</span>
  <div class="botones">
    <button class="boton" onclick={() => buscarActualizaciones(true)} disabled={buscando}>
      <span class:gira={buscando}><RefreshCw size={15} aria-hidden="true" /></span> Buscar actualizaciones
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
  <BotonesInstalador compacto />
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
