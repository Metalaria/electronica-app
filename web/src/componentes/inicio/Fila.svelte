<script lang="ts">
  // 2.1 start page: one row of «Para hoy también» (the approved mock-up Inicio.png), the shared hairline row of
  // estilos/sistema21.css (.fila21): a title, one secondary line and a chevron, the whole row a link. Extra attributes
  // (data-*, aria-busy) go on the link.
  import type { Snippet } from 'svelte';
  import type { HTMLAnchorAttributes } from 'svelte/elements';
  import Icono from '../Icono.svelte';

  let {
    href,
    titulo,
    detalle = '',
    aviso = false,
    clase = '',
    children,
    ...resto
  }: HTMLAnchorAttributes & {
    href: string;
    titulo: string;
    /** The secondary line. */
    detalle?: string;
    /** The secondary line in amber (something waiting). */
    aviso?: boolean;
    /** Extra class of the link. */
    clase?: string;
    children?: Snippet;
  } = $props();
</script>

<li>
  <a {...resto} class="fila21 {clase}" {href}>
    <span class="fila21-texto">
      <span class="fila21-titulo">{titulo}</span>
      {#if detalle}<span class="fila21-sub" class:aviso>{detalle}</span>{/if}
      {@render children?.()}
    </span>
    <span class="fila21-fin" aria-hidden="true"><Icono nombre="chevron" tam={20} grosor={2} /></span>
  </a>
</li>

<style>
  .aviso {
    color: var(--v11-naranja-texto);
  }
</style>
