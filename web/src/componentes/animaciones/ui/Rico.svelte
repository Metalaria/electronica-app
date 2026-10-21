<script lang="ts">
  // Inline text with subscripts, superscripts and bold (see nucleo/rico.ts).
  import { analizar } from '../nucleo/rico';

  let { texto }: { texto: string } = $props();
  const trozos = $derived(analizar(texto));
</script>

{#each trozos as t, i (i)}{#if t.sub}<sub class:b={t.b}>{t.t}</sub>{:else if t.sup}<sup class:b={t.b}>{t.t}</sup>{:else if t.b}<strong>{t.t}</strong>{:else}{t.t}{/if}{/each}

<style>
  sub,
  sup {
    font-size: 0.72em;
    line-height: 0;
  }
  .b {
    font-weight: 700;
  }
</style>
