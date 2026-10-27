<script lang="ts">
  // The action bar at the bottom of a lesson step or a question (0.9 mockups): a secondary action on the
  // left («Atrás», «Ver la sección 5.2») and the primary one, wide, on the right («Continuar»). It sticks to
  // the bottom of the window (above the tab bar on the phone) so «Continuar» is always at hand.
  // The children are links or buttons with the classes `accion` and `accion primaria`.
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
    padding: 14px var(--pad-pie, 16px) calc(18px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--linea);
    background: var(--fondo);
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
    max-width: 640px;
    margin: 0 auto;
  }
  .fila :global(.accion) {
    display: flex;
    flex: 1 1 150px;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 54px;
    padding: 0 20px;
    border: 2px solid var(--linea);
    border-radius: 14px;
    background: transparent;
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 16px;
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
    text-decoration: none;
  }
  .fila :global(.accion.corta) {
    flex: 0 0 auto;
  }
  .fila :global(.accion:hover) {
    background: var(--hover);
  }
  .fila :global(.accion.primaria) {
    flex: 2 1 180px;
    border-color: transparent;
    background: var(--bloque, var(--titulos));
    color: var(--sobre-bloque, var(--fondo));
    font-size: 17px;
    font-weight: 700;
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
    filter: brightness(1.08);
  }
  .fila :global(.accion[disabled]),
  .fila :global(.accion[aria-disabled='true']) {
    opacity: 0.45;
    cursor: default;
    filter: none;
  }
</style>
