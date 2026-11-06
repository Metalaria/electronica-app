<script lang="ts">
  import { informarFallo } from '../lib/informe-fallos';
  // The reader's library («Mis circuitos», «Mis montajes») could not be read or a save failed (sixth review: the
  // failure was swallowed and the page said «Guardado en este dispositivo»). Non-blocking: the page keeps working, what
  // the reader does stays in the page, and «Reintentar» reads and writes again (the module also retries by itself).
  let {
    error,
    nombre,
    reintentar,
  }: { error: '' | 'lectura' | 'escritura' | 'memoria'; nombre: string; reintentar: () => Promise<void> } = $props();

  // 1.0: a failed read or save goes to the local «Informe de fallos» (once per kind; the library's name, not its data)
  $effect(() => {
    if (error === 'lectura' || error === 'escritura') informarFallo('almacenamiento', error === 'lectura' ? 'No se pudo leer del almacenamiento del dispositivo.' : 'No se pudo guardar en el almacenamiento del dispositivo.', { zona: nombre });
  });

  let intentando = $state(false);
  async function otraVez() {
    intentando = true;
    try {
      await reintentar();
    } finally {
      intentando = false;
    }
  }
</script>

{#if error}
  <div class="aviso-guardado" role="alert" data-aviso-guardado={error}>
    {#if error === 'memoria'}
      <span>Este navegador no deja guardar nada en el dispositivo: «{nombre}» y lo que haga aquí se conservan solo mientras no cierre la página.</span>
    {:else if error === 'lectura'}
      <span>No se pudo leer «{nombre}» en este dispositivo. Lo que haga aquí se conserva mientras no cierre la página, pero aún no está guardado.</span>
    {:else}
      <span>No se pudieron guardar sus cambios en «{nombre}» en este dispositivo. Se volverá a intentar; mientras tanto, no cierre la página.</span>
    {/if}
    {#if error !== 'memoria'}<button type="button" class="boton" onclick={otraVez} disabled={intentando}>{intentando ? 'Reintentando…' : 'Reintentar'}</button>{/if}
  </div>
{/if}

<style>
  .aviso-guardado {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    margin: 10px 0;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--c-precaucion) 45%, transparent);
    background: color-mix(in srgb, var(--c-precaucion) 8%, var(--superficie));
    font-family: var(--sans);
    font-size: 14px;
    color: var(--tinta);
  }
  span {
    flex: 1 1 20em;
    min-width: 0;
  }
</style>
