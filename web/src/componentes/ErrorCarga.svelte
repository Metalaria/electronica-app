<script lang="ts">
  // A load that failed (the content's data or a part of the app that comes on demand): what failed, the cause in
  // plain Spanish and «Reintentar» (0.11 QA: pages said «Failed to fetch» with no way out, stayed «Cargando…» or
  // showed half of themselves). Without `reintentar`, the page is loaded again (a part of the app that did not
  // arrive cannot be asked for twice in the same page).
  import { textoError } from '../lib/errores';
  import { esCargaFallida, informarFallo } from '../lib/informe-fallos';

  let { titulo, error = null, reintentar, grande = false }: { titulo: string; error?: unknown; reintentar?: () => void; grande?: boolean } = $props();

  // 1.0: a part of the app that did not arrive while the device is online is most likely a stale copy of the page
  // after an update (its chunks have new names): say so and offer to load the page again. Into the «Informe de fallos».
  const parte = $derived(!reintentar && esCargaFallida(error) && globalThis.navigator?.onLine !== false);
  $effect(() => {
    if (esCargaFallida(error)) informarFallo('carga', error, { zona: titulo });
  });
</script>

<div class="error-carga" class:grande role="alert">
  {#if grande}<h1>{titulo}</h1>{:else}<p class="tit">{titulo}</p>{/if}
  {#if parte}
    <p data-parte-desactualizada>Falta una parte de la aplicación; puede que se haya actualizado mientras estaba abierta. Vuelva a cargar la página.</p>
    <button type="button" class="boton" onclick={() => location.reload()}>Recargar la página</button>
  {:else}
    <p>{textoError(error)}</p>
    <button type="button" class="boton" onclick={() => (reintentar ? reintentar() : location.reload())}>Reintentar</button>
  {/if}
</div>

<style>
  .error-carga {
    max-width: 36em;
    margin: 24px auto;
    padding: 14px 18px;
    font-family: var(--sans);
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
  }
  .error-carga.grande {
    margin: 18vh auto;
    border: 0;
    background: none;
    padding: 0 20px;
  }
  h1 {
    color: var(--titulos);
  }
  .tit {
    margin: 0 0 4px;
    font-weight: 700;
    color: var(--titulos);
  }
  p {
    margin: 0 0 12px;
  }
</style>
