<script lang="ts">
  // «Explorar la placa» button that the reader shows under the two mainboard photos of the book
  // (figures 36.16 and 36.22, labels fig-37.16 and fig-37.22).
  import Gamepad from '@lucide/svelte/icons/gamepad-2';
  import { app } from '../../lib/estado.svelte';
  import { prepararSalto } from '../../lib/ruta.svelte';

  let { label }: { label: string } = $props();

  const FIGURAS: Record<string, string> = { 'fig-37.16': 'nes', 'fig-37.22': 'neogeo' };
  const maquina = $derived(FIGURAS[label]);

  function salto(): void {
    const r = app.refs[label];
    prepararSalto({ texto: r ? `Volver a la figura ${r.num}` : 'Volver al libro' });
  }
</script>

{#if maquina}
  <a class="ver" href={`#/consolas/${maquina}/foto`} onclick={salto}>
    <Gamepad size={16} strokeWidth={2.2} /><span>Explorar la placa</span>
  </a>
{/if}

<style>
  .ver {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    padding: 0 12px;
    border: 1px solid var(--acento-borde);
    border-radius: 999px;
    background: var(--acento-tinte);
    color: var(--acento);
    font-family: var(--sans);
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
  }
  .ver:hover {
    background: var(--acento-suave);
    border-color: var(--acento);
  }
  @media (pointer: coarse) {
    .ver {
      min-height: 44px;
    }
  }
</style>
