<script lang="ts">
  // 0.9 big primary button (52 px, radius 12): a link with `href`, else a button. `color`/`sobre` paint it in a
  // block colour (tonoBloque in lib/color.ts); by default the accent. `contorno` is the outlined 44 px variant.
  import type { Snippet } from 'svelte';

  let {
    href,
    color,
    sobre,
    ancho = false,
    contorno = false,
    flecha = false,
    clase = '',
    tipo = 'button',
    onclick,
    children,
    ...resto
  }: {
    href?: string;
    color?: string;
    sobre?: string;
    /** Full width of its container. */
    ancho?: boolean;
    contorno?: boolean;
    /** Arrow after the text («Continuar →»). */
    flecha?: boolean;
    clase?: string;
    tipo?: 'button' | 'submit';
    onclick?: (ev: MouseEvent) => void;
    children?: Snippet;
    [k: string]: unknown;
  } = $props();
</script>

{#snippet contenido()}
  {@render children?.()}
  {#if flecha}
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      ><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg
    >
  {/if}
{/snippet}

{#if href}
  <a {href} class={['t09-boton', clase, { 't09-ancho': ancho, 't09-contorno': contorno }]} style:--c09={color} style:--sobre09={sobre} {onclick} {...resto}>
    {@render contenido()}
  </a>
{:else}
  <button type={tipo} class={['t09-boton', clase, { 't09-ancho': ancho, 't09-contorno': contorno }]} style:--c09={color} style:--sobre09={sobre} {onclick} {...resto}>
    {@render contenido()}
  </button>
{/if}
