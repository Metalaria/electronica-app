<script lang="ts">
  // «Paso a paso»: the formula, the numbers in SI with their units, the arithmetic and the result.
  import './mates.css';
  import type { Entorno } from './expresion';
  import type { Formula } from './tipos';
  import { pasos } from './mates';

  let { f, objetivo, valores, resultado }: { f: Formula; objetivo: string; valores: Entorno; resultado: number } = $props();

  const lista = $derived.by(() => {
    if (!Number.isFinite(resultado)) return null;
    try {
      return pasos(f, objetivo, valores, resultado, (id) => f.vars.find((v) => v.id === id)?.sim ?? id);
    } catch {
      return null;
    }
  });
</script>

<div class="paso-a-paso">
  {#if !lista}
    <p class="nota">Completa los datos para ver la cuenta.</p>
  {:else}
    <ol>
      {#each lista as p, i (i)}
        <li class="paso {p.tipo}">
          {#if p.nota}<span class="que">{@html p.nota}</span>{/if}
          {#if p.html}<div class="linea mate">{@html p.html}</div>{/if}
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  ol {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .paso {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
    padding: 6px 0 6px 12px;
    border-left: 3px solid var(--linea);
  }
  .paso.resultado {
    border-left-color: var(--acento);
  }
  .paso.intermedio {
    padding-top: 0;
  }
  .que {
    color: var(--tinta-tenue);
    font-family: var(--sans);
    font-size: 12.5px;
  }
  .que :global(sub) {
    font-size: 0.75em;
  }
  .linea {
    overflow-x: auto;
    font-size: 19px;
    padding: 2px 0;
    scrollbar-width: thin;
  }
  .nota {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14px;
  }
</style>
