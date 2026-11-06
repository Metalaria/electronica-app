<script lang="ts">
  // 1.0: the small «¿Cómo funciona?» link to a section (or subsection) of the «Guía de uso». Used in a handful of
  // places only (synchronisation, teacher mode, «Encuentre la avería», the spaced review of the start page); the ids
  // are checked by tests/guia10-contenido.spec.ts against lib/guia/contenido.ts.
  import CircleQuestionMark from '@lucide/svelte/icons/circle-question-mark';

  let { seccion, apartado, texto = '¿Cómo funciona?' }: { seccion: string; apartado?: string; texto?: string } = $props();
  // (the route is built here, not with lib/guia/contenido.ts: that would bring the whole guide into these pages' chunks)
  const href = $derived(apartado ? `#/guia/${seccion}/${apartado}` : `#/guia/${seccion}`);
</script>

<a class="enlace-guia toque-44" {href} data-enlace-guia={apartado ? `${seccion}/${apartado}` : seccion}
  ><CircleQuestionMark size={16} aria-hidden="true" /> {texto}<span class="solo-lector"> (guía de uso)</span></a
>

<style>
  .enlace-guia {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    /* 44 px tall itself (the lists' 44 px checks measure the box), 44 px wide on touch through toque-44 */
    min-height: var(--toque);
    vertical-align: middle;
    color: var(--acento);
    font-family: var(--sans);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
  }
  .enlace-guia:hover {
    text-decoration: underline;
  }
</style>
