<script lang="ts">
  // The automatic-update part (0.12, Windows and macOS) of the «Versión nueva» notice, of «Aa» and of
  // #/sincronizacion: «Descargar e instalar», the download progress, «Reiniciar para terminar», «Cancelar» while
  // downloading, and the errors (a stalled download ends in one).
  // Shows nothing where the app cannot update itself (Android, browser, placeholder public key): the release link
  // next to it is then the way to update, as before.
  import Download from '@lucide/svelte/icons/download';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import {
    instalador,
    actualizadorDisponible,
    descargarEInstalar,
    reiniciarParaTerminar,
    reintentarActualizacion,
    cancelarDescarga,
    sistemaActualizable,
  } from '../../lib/sincronizacion/instalador.svelte';

  interface Props {
    /** Smaller text (notice and «Aa»). */
    compacto?: boolean;
    /** Only when latest.json offers this version (the notice announces a given one). */
    version?: string;
  }
  let { compacto = false, version = '' }: Props = $props();
  // the notice and the page can show it at the same time: ids must differ
  const uid = $props.id();

  const disponible = actualizadorDisponible();
  const windows = sistemaActualizable() === 'windows';
  const coincide = $derived(!version || !instalador.version || instalador.version === version);
  const porcentaje = $derived(instalador.total > 0 ? Math.min(100, Math.round((instalador.descargado / instalador.total) * 100)) : null);

  function megas(b: number): string {
    return (b / 1_048_576).toLocaleString('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' MB';
  }
</script>

{#if disponible && coincide}
  <div class="instalador" class:compacto data-instalador={instalador.estado}>
    {#if instalador.estado === 'disponible'}
      {#if !version}<p class="texto">La versión {instalador.version} se puede descargar e instalar desde aquí (firmada).</p>{/if}
      <button class="boton primario toque-44" onclick={descargarEInstalar}>
        <Download size={16} aria-hidden="true" /> Descargar e instalar
      </button>
    {:else if instalador.estado === 'descargando'}
      <p class="texto" id="progreso-{uid}">
        Descargando la versión {instalador.version}…
        {#if porcentaje !== null}{porcentaje} %{:else if instalador.descargado}{megas(instalador.descargado)}{/if}
      </p>
      <div
        class="barra"
        role="progressbar"
        aria-labelledby="progreso-{uid}"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={porcentaje ?? undefined}
      >
        <span class:indeterminada={porcentaje === null} style:width={porcentaje === null ? undefined : `${porcentaje}%`}></span>
      </div>
      <button class="boton toque-44" onclick={cancelarDescarga}>Cancelar</button>
    {:else if instalador.estado === 'instalando'}
      <p class="texto" role="status">Instalando la versión {instalador.version}…</p>
    {:else if instalador.estado === 'listo'}
      <p class="texto" role="status">
        {#if windows}
          Descargada. Al reiniciar se cerrará la aplicación, se instalará la versión {instalador.version} y volverá a abrirse
          (sus datos se guardan antes).
        {:else}
          La versión {instalador.version} ya está instalada; se usará al reiniciar la aplicación (sus datos se guardan antes).
        {/if}
      </p>
      <button class="boton primario toque-44" onclick={reiniciarParaTerminar}>
        <RotateCcw size={16} aria-hidden="true" /> Reiniciar para terminar
      </button>
    {:else if instalador.estado === 'error'}
      <p class="texto error" role="alert">{instalador.error}</p>
      <button class="boton toque-44" onclick={reintentarActualizacion}>Volver a intentarlo</button>
    {/if}
  </div>
{/if}

<style>
  .instalador {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin-top: 10px;
  }
  .instalador[data-instalador='inactivo'],
  .instalador[data-instalador='buscando'],
  .instalador[data-instalador='al-dia'] {
    display: none;
  }
  .texto {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14px;
    line-height: 1.4;
  }
  .compacto .texto {
    font-size: 13.5px;
  }
  .error {
    color: var(--c-precaucion);
  }
  .barra {
    position: relative;
    width: 100%;
    max-width: 320px;
    height: 8px;
    border-radius: 4px;
    background: var(--superficie-2);
    border: 1px solid var(--linea);
    overflow: hidden;
  }
  .barra span {
    display: block;
    height: 100%;
    background: var(--acento);
    transition: width 0.2s;
  }
  .barra .indeterminada {
    width: 35%;
    animation: ir 1.2s ease-in-out infinite alternate;
  }
  @keyframes ir {
    from {
      transform: translateX(-10%);
    }
    to {
      transform: translateX(200%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .barra span {
      transition: none;
    }
    .barra .indeterminada {
      animation: none;
      width: 100%;
      opacity: 0.5;
    }
  }
</style>
