<script lang="ts">
  // 0.9 section label: 12 px, bold, spaced capitals («SEGUIR LEYENDO», «TOMO I · 6 DE 8 PARTES LEÍDAS»).
  // `color` must read at 4.5:1 on its background (tonoBloque(...).texto for a block colour).
  import type { Snippet } from 'svelte';

  let {
    etiqueta = 'span',
    color,
    clase = '',
    id,
    children,
  }: { etiqueta?: 'span' | 'h2' | 'h3' | 'p'; color?: string; clase?: string; id?: string; children?: Snippet } = $props();
</script>

<svelte:element this={etiqueta} {id} class={['t09-rotulo', clase]} style:--c09-texto={color}>{@render children?.()}</svelte:element>
