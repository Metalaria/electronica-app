<script lang="ts">
  // A glossary flashcard inside «Práctica inteligente» (0.11, group B). Only cards already due come here (never
  // new ones), and the answer goes to the same SM-2 scheduler and stores as the Repaso page (`calificar`), so a card
  // reviewed here is simply reviewed: the Repaso page's queue for today is one card shorter.
  import { prepararHtml } from '../../lib/datos';
  import type { Tarjeta } from '../repaso/datos';
  import { calificar, repaso } from '../repaso/estado.svelte';
  import { previsiones, type Calificacion } from '../repaso/srs';

  let { tarjeta, onresponder }: { tarjeta: Tarjeta; onresponder: (c: Calificacion) => void } = $props();

  let volteada = $state(false);
  let respondida = $state<Calificacion | null>(null);
  /** When it comes back, as the button said before answering. */
  let vuelve = $state('');
  const e = $derived(tarjeta.entrada);
  const termino = $derived(prepararHtml(e.termino_html ?? e.termino));
  const esperas = $derived(previsiones(repaso.tarjetas[tarjeta.id], Date.now(), tarjeta.id));

  const BOTONES: { c: Calificacion; nombre: string; clase: string }[] = [
    { c: 1, nombre: 'Otra vez', clase: 'otra' },
    { c: 2, nombre: 'Difícil', clase: 'dificil' },
    { c: 3, nombre: 'Bien', clase: 'bien' },
    { c: 4, nombre: 'Fácil', clase: 'facil' },
  ];

  function responder(c: Calificacion) {
    if (respondida) return;
    vuelve = esperas[c];
    respondida = c;
    calificar(tarjeta.id, c);
    onresponder(c);
  }
</script>

<div class="tarjeta-sesion" data-tarjeta-sesion={tarjeta.id} data-respondida={respondida ?? ''}>
  <span class="etq">Tarjeta del glosario{tarjeta.inversa ? ' · inversa' : ''}</span>
  <div class="cara">
    {#if tarjeta.inversa}
      <p class="pista">¿Qué término es?</p>
      <div class="definicion">{@html prepararHtml(e.html)}</div>
    {:else}
      <p class="termino">{@html termino}</p>
    {/if}
  </div>
  {#if volteada}
    <div class="cara reverso" data-reverso>
      {#if tarjeta.inversa}
        <p class="termino">{@html termino}</p>
      {:else}
        <div class="definicion">{@html prepararHtml(e.html)}</div>
      {/if}
    </div>
    {#if respondida}
      <p class="hecho" role="status">Anotada como «{BOTONES.find((b) => b.c === respondida)?.nombre}» en su repaso de tarjetas. Volverá en {vuelve}.</p>
    {:else}
      <div class="notas" role="group" aria-label="¿Cómo la recordaba?">
        {#each BOTONES as b (b.c)}
          <button type="button" class="nota {b.clase}" onclick={() => responder(b.c)} data-calificar={b.c}>
            <span class="nom">{b.nombre}</span>
            <span class="esp">{esperas[b.c]}</span>
          </button>
        {/each}
      </div>
    {/if}
  {:else}
    <button type="button" class="t09-boton mostrar" onclick={() => (volteada = true)} data-mostrar>Mostrar la respuesta</button>
  {/if}
</div>

<style>
  .tarjeta-sesion {
    display: flex;
    flex-direction: column;
    gap: 14px;
    font-family: var(--sans);
  }
  .etq {
    color: var(--bloque-texto, var(--titulos));
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .cara {
    padding: 20px 22px;
    border: 1px solid var(--linea);
    border-radius: var(--radio-tarjeta);
    background: var(--superficie);
    box-shadow: var(--sombra);
  }
  .reverso {
    background: var(--superficie-2);
    box-shadow: none;
  }
  .termino {
    margin: 0;
    color: var(--titulos);
    font-family: var(--serif);
    font-size: 24px;
    font-weight: 700;
    line-height: 1.25;
    text-align: center;
  }
  .definicion {
    color: var(--tinta);
    font-family: var(--serif);
    font-size: 17px;
    line-height: 1.5;
  }
  .definicion :global(p) {
    margin: 0 0 0.5em;
  }
  .pista {
    margin: 0 0 6px;
    color: var(--tinta-suave);
    font-size: 14px;
  }
  .mostrar {
    align-self: center;
  }
  .notas {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }
  .nota {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-height: 56px;
    padding: 6px 4px;
    border: 1px solid var(--linea);
    border-radius: var(--radio-boton);
    background: var(--superficie);
    color: var(--tinta);
    font: inherit;
  }
  .nota .nom {
    font-size: 15px;
    font-weight: 700;
  }
  .nota .esp {
    color: var(--tinta-suave);
    font-size: 13px;
  }
  .nota.otra .nom {
    color: color-mix(in srgb, var(--c-precaucion) 75%, var(--tinta));
  }
  .nota.bien .nom {
    color: color-mix(in srgb, var(--c-ejemplo) 75%, var(--tinta));
  }
  .hecho {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 15px;
    text-align: center;
  }
</style>
