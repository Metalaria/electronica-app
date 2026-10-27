<script lang="ts">
  // 0.9 card: rounded 18 px surface with the theme's line; optional block-colour stripe on top and shadow.
  // A link when `href` is given. Extra attributes (aria-*, data-*) pass through to the element.
  import type { Snippet } from 'svelte';

  let {
    etiqueta = 'section',
    href,
    banda,
    grande = false,
    media = false,
    sombra = false,
    clase = '',
    children,
    ...resto
  }: {
    /** Element when it is not a link. */
    etiqueta?: 'section' | 'div' | 'article' | 'li';
    href?: string;
    /** Colour of the 6 px stripe on top (a CSS colour); none without it. */
    banda?: string;
    /** 20 px padding instead of 16 px. */
    grande?: boolean;
    /** 14 px radius (cards inside cards, list rows). */
    media?: boolean;
    sombra?: boolean;
    clase?: string;
    children?: Snippet;
    [k: string]: unknown;
  } = $props();
</script>

<svelte:element
  this={href ? 'a' : etiqueta}
  {href}
  class={['t09-tarjeta', clase, { 't09-grande': grande, 't09-media': media, 't09-sombra': sombra, 't09-banda': !!banda }]}
  style:--c09={banda}
  {...resto}
>
  {@render children?.()}
</svelte:element>
