<script lang="ts">
  // «Ver la placa» button that the reader shows next to the KiCad figures of printed chapters 48–51, the
  // schematics the boards implement and the sections that present them. The map is static and tiny.
  import CircuitBoard from '@lucide/svelte/icons/circuit-board';
  import { app } from '../../lib/estado.svelte';
  import { prepararSalto } from '../../lib/ruta.svelte';
  import { PLACA_DE_LABEL } from './estado';

  let { label, compacto = false }: { label: string; compacto?: boolean } = $props();
  const destino = $derived(PLACA_DE_LABEL[label]);

  function salto(): void {
    const r = app.refs[label];
    prepararSalto({ texto: r ? `Volver a ${r.tipo === 'fig' ? 'la figura ' : ''}${r.num}` : 'Volver al libro' });
  }
</script>

{#if destino}
  <a class="ver-placa" class:compacto href={`#/proyectos/${destino}`} onclick={salto} title="Explorar la placa del proyecto KiCad en 3D y en 2D">
    <CircuitBoard size={16} strokeWidth={2.2} /><span class="texto">Ver la placa</span>
  </a>
{/if}

<style>
  .ver-placa {
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
    vertical-align: middle;
  }
  .ver-placa:hover {
    background: var(--acento-suave);
    border-color: var(--acento);
  }
  .ver-placa.compacto {
    min-height: 28px;
    padding: 0 9px;
    font-size: 12.5px;
  }
  @media (pointer: coarse) {
    .ver-placa {
      min-height: 44px;
    }
  }
  @media (max-width: 599px) {
    .ver-placa.compacto .texto {
      display: none;
    }
  }
</style>
