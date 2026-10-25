<script lang="ts">
  // Background part of the synchronisation and of the update check (lazy chunk, mounted by Arranque.svelte
  // once the reader is up): starts both, and shows the «Versión X.Y.Z disponible» notice.
  import { onMount } from 'svelte';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import X from '@lucide/svelte/icons/x';
  import {
    actualizacion,
    avisoVisible,
    buscarActualizaciones,
    descartarAviso,
    ficheroParaEsteEquipo,
    resumenNotas,
    versionNueva,
    abrirEnNavegador,
  } from '../../lib/sincronizacion/actualizaciones.svelte';
  import { iniciarSincronizacionAutomatica } from '../../lib/sincronizacion/sincronizar.svelte';

  const nueva = $derived(avisoVisible() ? versionNueva() : null);
  const fichero = $derived(nueva ? ficheroParaEsteEquipo(nueva) : null);

  onMount(() => {
    void buscarActualizaciones();
    void iniciarSincronizacionAutomatica();
  });
</script>

{#if nueva}
  <div class="aviso" role="status" aria-live="polite" data-aviso-version={nueva.version}>
    <span class="icono" aria-hidden="true"><Sparkles size={20} /></span>
    <div class="texto">
      <p class="titulo">Versión {nueva.version} disponible</p>
      {#if nueva.notas}<p class="notas">{resumenNotas(nueva.notas)}</p>{/if}
      <p class="detalle">
        Tiene la {actualizacion.version}.{#if fichero} Para este equipo: <code>{fichero}</code>.{/if}
      </p>
      <div class="botones">
        <button class="boton primario" onclick={() => abrirEnNavegador(nueva.url)}>Ver la publicación</button>
        <button class="boton" onclick={descartarAviso}>Ahora no</button>
      </div>
    </div>
    <button class="boton-icono cerrar" aria-label="Cerrar el aviso de versión nueva" onclick={descartarAviso}><X size={18} /></button>
  </div>
{/if}

<style>
  .aviso {
    position: fixed;
    right: 16px;
    bottom: calc(var(--hueco-inferior) + 16px);
    z-index: 45;
    display: flex;
    gap: 12px;
    width: min(400px, calc(100vw - 32px));
    padding: 14px 10px 14px 16px;
    border: 1px solid var(--acento-borde);
    border-radius: 14px;
    background: var(--superficie);
    box-shadow: var(--sombra-alta);
    font-family: var(--sans);
    color: var(--tinta);
    animation: subir 0.2s ease-out;
  }
  @keyframes subir {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .aviso {
      animation: none;
    }
  }
  .icono {
    flex: none;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--acento-tinte);
    color: var(--acento);
  }
  .texto {
    flex: 1;
    min-width: 0;
  }
  p {
    margin: 0;
  }
  .titulo {
    font-weight: 700;
    color: var(--titulos);
    font-size: 16px;
  }
  .notas {
    margin-top: 4px;
    color: var(--tinta-suave);
    font-size: 14px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .detalle {
    margin-top: 4px;
    color: var(--tinta-tenue);
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  code {
    font-family: var(--mono);
    font-size: 0.95em;
  }
  .botones {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }
  .cerrar {
    flex: none;
    width: 32px;
    height: 32px;
    margin-top: -4px;
  }
</style>
