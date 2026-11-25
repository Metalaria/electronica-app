<script lang="ts">
  // Start page (0.9; 2.1 rows of «Para hoy también»): «Repaso pendiente», the flashcards due today in the deck chosen
  // on the «Repaso» page (the same count as that page; a link to the cards, or to «Repaso» when there are none), and
  // the quiz questions answered wrong (#/repaso/repasar) when there are any. Counted in idle time: the glossary is not
  // needed to show the page.
  import { onMount } from 'svelte';
  import type { ResumenRepaso } from './repasoHoy';
  import Fila from './Fila.svelte';

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
    if (!resumen.total) return 'Al día: mañana habrá más.';
    // about 20 s per card
    const min = Math.max(1, Math.round(resumen.total / 3));
    return `${resumen.total} ${resumen.total === 1 ? 'tarjeta' : 'tarjetas'} · unos ${min} ${min === 1 ? 'minuto' : 'minutos'}`;
  });
</script>

<Fila
  href={resumen?.total ? '#/repaso/tarjetas' : '#/repaso'}
  titulo="Repaso pendiente"
  {detalle}
  clase="repaso-hoy"
  aria-busy={!resumen && !fallo}
  data-pendientes={resumen?.total}
/>
{#if resumen?.fallos}
  <Fila
    href="#/repaso/repasar"
    titulo="Preguntas falladas"
    detalle={`${resumen.fallos} ${resumen.fallos === 1 ? 'pregunta' : 'preguntas'} para repasar`}
    aviso
    data-fallos-inicio={resumen.fallos}
  />
{/if}
