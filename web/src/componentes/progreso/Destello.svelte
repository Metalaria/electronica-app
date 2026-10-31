<script lang="ts">
  // The reaction to a right answer (0.11): wraps the verdict's seal; when `activo` the seal pops once and eight
  // small sparks fly out of it. Transforms and opacity only (compositor), about 0.6 s, then the sparks are removed
  // from the DOM: nothing stays animating. Out of flow (absolutely placed), so nothing around it moves.
  // With prefers-reduced-motion there is no pop and no sparks.
  // The caller passes `activo` only for an answer just given (a question revisited does not celebrate again).
  import type { Snippet } from 'svelte';

  let { activo = false, children }: { activo?: boolean; children: Snippet } = $props();

  let chispas = $state(false);
  let pop = $state(false);

  $effect(() => {
    if (!activo || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    pop = true;
    chispas = true;
    const t = setTimeout(() => (chispas = false), 700);
    return () => clearTimeout(t);
  });
</script>

<span class="destello" class:pop data-destello={pop ? 'si' : undefined}>
  {@render children()}
  {#if chispas}
    <span class="chispas" aria-hidden="true">
      {#each [0, 1, 2, 3, 4, 5, 6, 7] as k (k)}
        <i style:--giro={`${k * 45 + 22.5}deg`}></i>
      {/each}
    </span>
  {/if}
</span>

<style>
  .destello {
    position: relative;
    display: inline-grid;
    flex: none;
  }
  .pop {
    animation: pop 0.42s cubic-bezier(0.3, 1.6, 0.5, 1) both;
  }
  @keyframes pop {
    0% {
      transform: scale(0.6);
    }
    60% {
      transform: scale(1.18);
    }
    100% {
      transform: scale(1);
    }
  }
  .chispas {
    position: absolute;
    inset: 50% auto auto 50%;
    width: 0;
    height: 0;
    pointer-events: none;
  }
  .chispas i {
    position: absolute;
    top: -3px;
    left: -3px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--c-ejemplo);
    opacity: 0;
    transform: rotate(var(--giro)) translateY(0);
    animation: chispa 0.6s ease-out both;
  }
  .chispas i:nth-child(even) {
    width: 5px;
    height: 5px;
    background: var(--ambar-relleno);
  }
  @keyframes chispa {
    0% {
      opacity: 1;
      transform: rotate(var(--giro)) translateY(-10px) scale(1);
    }
    100% {
      opacity: 0;
      transform: rotate(var(--giro)) translateY(-30px) scale(0.4);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pop,
    .chispas i {
      animation: none;
    }
    .chispas {
      display: none;
    }
  }
</style>
