<script lang="ts">
  // Start page (0.9): «Repaso pendiente», the flashcards due today in the deck chosen on the «Repaso» page
  // (the same count as that page), counted in idle time: the glossary is not needed to show the page.
  import { onMount } from 'svelte';
  import type { ResumenRepaso } from './repasoHoy';
  import BotonPrincipal from '../ui09/BotonPrincipal.svelte';

  let resumen = $state<ResumenRepaso | null>(null);
  let fallo = $state(false);

  onMount(() => {
    let vivo = true;
    const contar = () =>
      import('./repasoHoy')
        .then((m) => m.resumenRepaso())
        .then((r) => {
          if (vivo) resumen = r;
        })
        .catch(() => {
          if (vivo) fallo = true;
        });
    const id = 'requestIdleCallback' in window ? window.requestIdleCallback(contar, { timeout: 1200 }) : setTimeout(contar, 300);
    return () => {
      vivo = false;
      if ('cancelIdleCallback' in window && typeof id === 'number') window.cancelIdleCallback(id);
    };
  });

  const detalle = $derived.by(() => {
    if (fallo) return 'No se pudo contar el repaso.';
    if (!resumen) return 'Contando las tarjetas…';
    if (!resumen.total) return 'Al día: vuelve mañana para las siguientes.';
    // about 20 s per card
    const min = Math.max(1, Math.round(resumen.total / 3));
    return `${resumen.total} ${resumen.total === 1 ? 'tarjeta' : 'tarjetas'} · unos ${min} ${min === 1 ? 'minuto' : 'minutos'}`;
  });
</script>

<section class="t09-tarjeta repaso-hoy" aria-labelledby="tit-repaso-hoy" aria-busy={!resumen && !fallo} data-pendientes={resumen?.total}>
  <div class="fila">
    <span class="icono" aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        ><rect x="3" y="6" width="14" height="14" rx="2" /><path d="M7 3h12a2 2 0 0 1 2 2v12" /><path d="M7 13h6" /></svg
      >
    </span>
    <div class="textos">
      <h2 id="tit-repaso-hoy">Repaso pendiente</h2>
      <span class="det">{detalle}</span>
    </div>
    {#if resumen?.total}
      <BotonPrincipal href="#/repaso/tarjetas" contorno>Repasar</BotonPrincipal>
    {:else if resumen || fallo}
      <BotonPrincipal href="#/repaso" contorno>Ver</BotonPrincipal>
    {/if}
  </div>
  {#if resumen?.fallos}
    <a class="fallos" href="#/repaso/repasar">{resumen.fallos} {resumen.fallos === 1 ? 'pregunta fallada' : 'preguntas falladas'} para repasar</a>
  {/if}
</section>

<style>
  .fila {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .icono {
    display: grid;
    flex: none;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--acento-tinte);
    color: var(--acento);
  }
  .textos {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  h2 {
    margin: 0;
    color: var(--tinta);
    font-size: 16px;
    font-weight: 600;
  }
  .det {
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .fila :global(.t09-boton) {
    flex: none;
  }
  .fallos {
    display: flex;
    align-items: center;
    min-height: var(--toque);
    margin: 6px 0 -10px 62px;
    color: var(--acento);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
  }
  .fallos:hover {
    text-decoration: underline;
  }
</style>
