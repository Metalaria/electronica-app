<script lang="ts">
  // 1.1 lessons: a short text of the lesson (lib/leccion11/tipos.ts Texto), run by run — never as HTML — with the live
  // values of the model formatted in their units.
  import type { Texto } from '../../lib/leccion11/tipos';

  let { texto, valor }: { texto: Texto | undefined; valor: (id: string) => string } = $props();
</script>

{#each texto ?? [] as x, i (i)}{#if x.t === 'txt'}{x.s}{:else if x.t === 'b'}<strong>{x.s}</strong>{:else if x.t === 'sub'}<sub>{x.s}</sub>{:else if x.t === 'sup'}<sup>{x.s}</sup>{:else}<span class="vivo" data-valor={x.id}>{valor(x.id)}</span>{/if}{/each}

<style>
  .vivo {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
