<script lang="ts">
  // «Repaso» page (#/repaso…): home, flashcard session, chapter quiz, mixed exam, review of mistakes.
  // Routes (ruta.ancla): ''  ·  tarjetas  ·  test/<parte>  ·  examen  ·  repasar[/<parte>]  ·  practica/<parte> (0.10)
  import { onMount } from 'svelte';
  import { app } from '../../lib/estado.svelte';
  import { ruta } from '../../lib/ruta.svelte';
  import { cargarRepaso, repaso, volcarRepaso } from './estado.svelte';
  import Portada from './Portada.svelte';
  import Tarjetas from './Tarjetas.svelte';
  import TestParte from './TestParte.svelte';
  import Examen from './Examen.svelte';
  import Repasar from './Repasar.svelte';
  import PracticaParte from '../practica/PracticaParte.svelte';

  const [vista = '', arg = ''] = $derived(ruta.ancla.split('/'));

  let error = $state('');
  onMount(() => {
    app.seccion = null;
    cargarRepaso().catch((e: unknown) => (error = e instanceof Error ? e.message : String(e)));
    return volcarRepaso;
  });

  // Each sub-view starts at the top (Back restores the scroll the router remembered).
  $effect(() => {
    void ruta.n;
    window.scrollTo({ top: ruta.y ?? 0, behavior: 'instant' });
  });
</script>

<svelte:head><title>Repaso · Electrónica Práctica Avanzada</title></svelte:head>

<div class="repaso-pagina">
  {#if error}
    <div class="aviso"><h1>No se pudieron leer los datos del repaso</h1><p>{error}</p></div>
  {:else if !repaso.listo}
    <div class="cargando" aria-live="polite">Abriendo el repaso…</div>
  {:else if vista === 'tarjetas'}
    <Tarjetas />
  {:else if vista === 'test' && arg}
    {#key arg}<TestParte parte={arg} />{/key}
  {:else if vista === 'examen'}
    <Examen />
  {:else if vista === 'practica' && arg}
    {#key arg}<PracticaParte parte={arg} />{/key}
  {:else if vista === 'repasar'}
    {#key arg}<Repasar parte={arg} />{/key}
  {:else}
    <Portada />
  {/if}
</div>

<style>
  .repaso-pagina {
    max-width: 920px;
    margin: 0 auto;
    padding: 0 clamp(16px, 4vw, 40px) calc(64px + var(--hueco-inferior));
    font-family: var(--sans);
  }
  .cargando {
    padding: 30vh 0;
    color: var(--tinta-suave);
    text-align: center;
  }
  .aviso h1 {
    color: var(--titulos);
  }

  /* Shared by the sub-views */
  .repaso-pagina :global(.rp-cab) {
    padding: clamp(18px, 4vw, 36px) 0 14px;
  }
  .repaso-pagina :global(.rp-volver) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
    margin-left: -8px;
    padding: 0 8px;
    border-radius: 8px;
    color: var(--tinta-suave);
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
  }
  .repaso-pagina :global(.rp-volver:hover) {
    background: var(--hover);
    color: var(--tinta);
  }
  .repaso-pagina :global(h1.rp-titulo) {
    margin: 2px 0 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: clamp(26px, 4.6vw, 38px);
    font-weight: 700;
    letter-spacing: -0.015em;
    line-height: 1.15;
  }
  .repaso-pagina :global(.rp-sub) {
    margin: 6px 0 0;
    color: var(--tinta-suave);
    font-size: 16px;
  }
  .repaso-pagina :global(.rp-caja) {
    border: 1px solid var(--linea);
    border-radius: 14px;
    background: var(--superficie);
    box-shadow: var(--sombra);
  }
  .repaso-pagina :global(.boton) {
    min-height: 44px;
    padding: 0 18px;
    font-size: 15.5px;
  }
  .repaso-pagina :global(.boton:disabled) {
    opacity: 0.5;
    cursor: default;
  }
  .repaso-pagina :global(kbd) {
    display: inline-block;
    min-width: 1.6em;
    padding: 0 0.35em;
    border: 1px solid var(--linea);
    border-bottom-width: 2px;
    border-radius: 5px;
    background: var(--superficie-2);
    color: var(--tinta-suave);
    font-family: var(--sans);
    font-size: 0.82em;
    font-weight: 600;
    line-height: 1.5;
    text-align: center;
  }
</style>
