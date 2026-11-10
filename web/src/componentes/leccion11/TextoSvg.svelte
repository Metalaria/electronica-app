<script lang="ts">
  // 1.1 lessons: a short text (lib/leccion11/texto.ts runs) inside an SVG <text>: subscripts and superscripts as
  // shifted <tspan>s, bold, live values. No markup is ever injected.
  import type { Texto } from '../../lib/leccion11/tipos';
  let { t, valor = (id: string) => id }: { t: Texto | string; valor?: (id: string) => string } = $props();
  const trozos = $derived(typeof t === 'string' ? [{ t: 'txt' as const, s: t }] : t);
</script>

{#each trozos as x, k (k)}{#if x.t === 'sub'}<tspan baseline-shift="sub" font-size="72%">{x.s}</tspan>{:else if x.t === 'sup'}<tspan baseline-shift="super" font-size="72%">{x.s}</tspan>{:else if x.t === 'b'}<tspan font-weight="700">{x.s}</tspan>{:else if x.t === 'val'}{valor(x.id)}{:else}{x.s}{/if}{/each}
