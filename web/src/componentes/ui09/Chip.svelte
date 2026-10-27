<script lang="ts">
  // 0.9 chip: a pill with an optional colour square. A link with `href`, a toggle button with `pulsado`,
  // else plain text. Interactive chips keep a 44 px touch target.
  import type { Snippet } from 'svelte';

  let {
    href,
    color,
    pulsado,
    clase = '',
    onclick,
    children,
    ...resto
  }: {
    href?: string;
    /** Colour of the small square before the text. */
    color?: string;
    /** Toggle state (renders a button with aria-pressed). */
    pulsado?: boolean;
    clase?: string;
    onclick?: (ev: MouseEvent) => void;
    children?: Snippet;
    [k: string]: unknown;
  } = $props();
</script>

{#snippet contenido()}
  {#if color}<i class="punto" style:--c09={color} aria-hidden="true"></i>{/if}
  {@render children?.()}
{/snippet}

{#if href}
  <a {href} class={['t09-chip', clase]} {onclick} {...resto}>{@render contenido()}</a>
{:else if pulsado !== undefined || onclick}
  <button type="button" class={['t09-chip', clase]} aria-pressed={pulsado} {onclick} {...resto}>{@render contenido()}</button>
{:else}
  <span class={['t09-chip', clase]} {...resto}>{@render contenido()}</span>
{/if}
