<script lang="ts">
  // The action bar at the bottom of a lesson step or a question (0.9 mockups): a secondary action on the
  // left («Atrás», «Ver la sección 5.2») and the primary one, wide, on the right («Continuar»). It sticks to
  // the bottom of the window (above the tab bar on the phone) so «Continuar» is always at hand.
  // The children are links or buttons with the classes `accion` and `accion primaria`.
  // 2.1 (Leccion.png and the system sheet): the 680 px column of the lesson, the primary in the one accent (never the
  // chapter's colour), 52 px with 14 px corners; the secondary one with a 1 px line.
  import type { Snippet } from 'svelte';

  let { children, fijo = true }: { children: Snippet; fijo?: boolean } = $props();
</script>

<div class="pie-acciones" class:fijo>
  <div class="fila">
    {@render children()}
  </div>
</div>

<style>
  .pie-acciones {
    padding: 20px var(--pad-pie, 20px) calc(28px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--v11-linea);
    background: var(--v11-fondo);
  }
  .pie-acciones.fijo {
    position: sticky;
    bottom: var(--pie-abajo, 0px);
    z-index: 5;
  }
  .fila {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    width: 100%;
    max-width: 680px;
    margin: 0 auto;
  }
  .fila :global(.accion) {
    display: flex;
    flex: 1 1 150px;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 52px;
    padding: 0 20px;
    border: 1px solid var(--v11-linea);
    border-radius: 14px;
    background: transparent;
    color: var(--v11-tinta);
    font-family: var(--v11-texto);
    font-size: 15px;
    font-weight: 500;
    line-height: 1.2;
    text-align: center;
    text-decoration: none;
  }
  .fila :global(.accion.corta) {
    flex: 0 0 auto;
  }
  .fila :global(.accion:hover) {
    border-color: var(--v11-borde);
  }
  .fila :global(.accion.primaria) {
    flex: 2 1 180px;
    border-color: transparent;
    background: var(--v11-azul);
    color: var(--v11-sobre-azul);
    font-size: 17px;
    font-weight: 600;
  }
  @media (max-width: 440px) {
    .fila :global(.accion) {
      padding: 0 12px;
    }
    .fila :global(.accion.primaria) {
      font-size: 16px;
    }
  }
  .fila :global(.accion.primaria:hover) {
    border-color: transparent;
    background: var(--v11-azul-hover);
  }
  /* 1.1: a disabled action is the mock-up's grey button with readable text (it was faded to 45 %) */
  .fila :global(.accion[disabled]),
  .fila :global(.accion[aria-disabled='true']) {
    border-color: transparent;
    background: var(--v11-inactivo);
    color: var(--v11-sobre-inactivo);
    cursor: default;
    filter: none;
  }
</style>
