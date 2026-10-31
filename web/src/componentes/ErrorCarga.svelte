<script lang="ts">
  // A load that failed (the content's data or a part of the app that comes on demand): what failed, the cause in
  // plain Spanish and «Reintentar» (0.11 QA: pages said «Failed to fetch» with no way out, stayed «Cargando…» or
  // showed half of themselves). Without `reintentar`, the page is loaded again (a part of the app that did not
  // arrive cannot be asked for twice in the same page).
  import { textoError } from '../lib/errores';

  let { titulo, error = null, reintentar, grande = false }: { titulo: string; error?: unknown; reintentar?: () => void; grande?: boolean } = $props();
</script>

<div class="error-carga" class:grande role="alert">
  {#if grande}<h1>{titulo}</h1>{:else}<p class="tit">{titulo}</p>{/if}
  <p>{textoError(error)}</p>
  <button type="button" class="boton" onclick={() => (reintentar ? reintentar() : location.reload())}>Reintentar</button>
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
