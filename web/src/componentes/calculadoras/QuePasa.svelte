<script lang="ts">
  // «¿Qué pasa si…?»: for every input, whether the result goes up or down when it grows, the proportionality
  // when the formula is a power law in it, and a button that tries the change.
  import './mates.css';
  import type { Entorno } from './expresion';
  import type { Formula } from './tipos';
  import { efectos } from './quepasa';

  let {
    f,
    objetivo,
    valores,
    onprobar,
  }: { f: Formula; objetivo: string; valores: Entorno; onprobar: (id: string, x: number) => void } = $props();

  const lista = $derived.by(() => {
    try {
      return efectos(f, objetivo, valores, (id) => f.vars.find((v) => v.id === id)?.sim ?? id);
    } catch {
      return [];
    }
  });
</script>

<div class="que-pasa">
  {#if !lista.length}
    <p class="nota">Completa los datos para ver cómo influye cada uno.</p>
  {:else}
    <ul>
      {#each lista as e (e.v.id)}
        <li class:sube={e.sube === true} class:baja={e.sube === false}>
          <span class="flecha" aria-hidden="true" style="--fuerza: {0.45 + 0.55 * e.fuerza}">{e.sube === null ? '·' : e.sube ? '↑' : '↓'}</span>
          <div class="texto">
            {#if e.ley}<div class="ley mate">{@html e.ley}</div>{/if}
            <div class="efecto">{@html e.texto}</div>
          </div>
          <button class="probar" onclick={() => onprobar(e.v.id, e.nuevo)} aria-label="Probar: {e.cambio.replace(/<[^>]+>/g, '')}">
            {@html e.cambio.startsWith('doblar') ? '×2' : '+'}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  li {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 10px;
    background: var(--superficie-2);
  }
  .flecha {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--linea-suave);
    color: var(--tinta-suave);
    font-size: 20px;
    font-weight: 700;
    opacity: var(--fuerza);
  }
  .sube .flecha {
    background: color-mix(in srgb, var(--c-ejemplo) 16%, transparent);
    color: var(--c-ejemplo);
  }
  .baja .flecha {
    background: color-mix(in srgb, var(--c-precaucion) 14%, transparent);
    color: var(--c-precaucion);
  }
  .ley {
    font-size: 17px;
  }
  .ley :global(sup) {
    font-size: 0.7em;
  }
  .efecto {
    color: var(--tinta-suave);
    font-size: 14px;
    line-height: 1.4;
  }
  .efecto :global(.m-v) {
    font-family: var(--serif);
    font-style: italic;
    color: var(--tinta);
  }
  .efecto :global(sub) {
    font-size: 0.75em;
  }
  .probar {
    min-width: 44px;
    height: 44px;
    padding: 0 8px;
    border: 1px solid var(--acento-borde);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--acento);
    font: inherit;
    font-weight: 700;
    font-size: 15px;
    cursor: pointer;
  }
  .probar:hover {
    background: var(--acento-tinte);
  }
  .nota {
    margin: 0;
    color: var(--tinta-suave);
    font-size: 14px;
  }
</style>
