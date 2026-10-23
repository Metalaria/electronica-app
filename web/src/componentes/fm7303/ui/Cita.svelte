<script lang="ts">
  // «Libro · 15.11.2»: where a value comes from, linked to that section or figure of the book (the reader's
  // «Volver» button brings the reader back here). The quote checked at build time is the tooltip.
  import BookOpen from '@lucide/svelte/icons/book-open';
  import { rutaDeRef } from '../../../lib/datos';
  import { prepararSalto } from '../../../lib/ruta.svelte';
  import type { Cita } from '../tipos';

  let { cita, corto = false }: { cita: Cita | undefined; corto?: boolean } = $props();

  const href = $derived(cita ? rutaDeRef(cita.ref) : null);
  const rotulo = $derived(cita ? `${cita.tipo === 'fig' ? 'figura ' : ''}${cita.num ?? cita.ref}` : '');
</script>

{#if cita}
  <a
    class="cita"
    href={href ?? undefined}
    title={`Del libro (${rotulo}): «${cita.texto}»`}
    onclick={() => prepararSalto({ texto: 'Volver al kit FM7303' })}
  >
    <BookOpen size={13} strokeWidth={2.2} aria-hidden="true" />{#if !corto}<span class="del">libro</span>{/if}<span>{rotulo}</span>
  </a>
{/if}

<style>
  .cita {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 7px;
    border: 1px solid var(--acento-borde);
    border-radius: 999px;
    background: var(--acento-tinte);
    color: var(--acento);
    font-family: var(--sans);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.5;
    text-decoration: none;
    white-space: nowrap;
    vertical-align: baseline;
  }
  .cita:hover {
    background: var(--acento-suave);
  }
  .del {
    font-weight: 500;
    opacity: 0.85;
  }
</style>
