<script lang="ts">
  // The answer panel of a problem, shown in the reader right after its «Se pide» paragraph. The book's
  // analysis below it can be hidden while trying («Ocultar solución») and comes back with «Ver solución».
  import { onMount, tick } from 'svelte';
  import { cargarEjercicios, ejercicios, item, problemaEn } from '../../lib/ejercicios.svelte';
  import { aprendizaje, cargarAprendizaje, taparProblema } from '../../lib/aprendizaje.svelte';
  import { tapar } from '../../lib/tapar';
  import Comprobador from './Comprobador.svelte';

  let { parte, indice }: { parte: string; indice: number } = $props();

  const label = $derived(ejercicios.datos ? problemaEn(parte, indice) : undefined);
  const datos = $derived(item(label));
  const tapada = $derived(!!(label && aprendizaje.ejercicios[label]?.tapada));

  $effect(() => {
    if (!label || !datos) return;
    tapar(label, parte, (datos.pos[1] ?? 0) + 1, datos.pos[2] ?? 0, tapada);
  });

  async function alVerSolucion(ver: boolean) {
    if (!label || !datos) return;
    taparProblema(label, !ver);
    if (!ver) return;
    await tick();
    const primero = document.querySelector<HTMLElement>(
      `article[id="${CSS.escape(parte)}"] .trozo > [data-b="${(datos.pos[1] ?? 0) + 1}"]`,
    );
    primero?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  onMount(() => {
    void cargarEjercicios();
    void cargarAprendizaje();
  });
</script>

{#if label && datos}
  <div class="panel-problema" id={`resp-${label}`}>
    <div class="cab">Comprobar el resultado · Problema {datos.num}</div>
    <Comprobador {label} item={datos} solucionVisible={!tapada} {alVerSolucion} sinSolucion={datos.clase === 'sin-solucion'} />
    {#if tapada}
      <p class="tapada">El análisis del libro está oculto mientras lo intenta.</p>
    {/if}
  </div>
{/if}

<style>
  .panel-problema {
    margin: 0.4em 0 1.2em;
  }
  .cab {
    margin-bottom: 4px;
    color: var(--acento);
    font-family: var(--sans);
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .tapada {
    margin: -0.3em 0 0;
    color: var(--tinta-tenue);
    font-family: var(--sans);
    font-size: 13.5px;
    font-style: italic;
  }
</style>
