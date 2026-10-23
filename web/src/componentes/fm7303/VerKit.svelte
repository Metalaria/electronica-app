<script lang="ts">
  // «Kit FM7303» button that the reader shows next to the kit's schematics and figures and the headings of the
  // sections it brings to life (printed chapter 15). The map is static and tiny.
  import Radio from '@lucide/svelte/icons/radio';
  import { app } from '../../lib/estado.svelte';
  import { prepararSalto } from '../../lib/ruta.svelte';

  let { label, compacto = false }: { label: string; compacto?: boolean } = $props();

  const DESTINOS: Record<string, string> = {
    'fig-16.3': 'senal',
    'fig-16.9': 'esquema',
    'fig-16.12': 'senal/TP3',
    'fig-16.13': 'senal/TP3',
    'fig-16.16': 'senal/TP3',
    'fig-16.17': 'averias',
    'fig-16.23': 'alineacion',
    'fig-16.25': 'esquema',
    'fig-16.26': 'esquema',
    'fig-16.28': 'esquema',
    'sec-16.3': 'senal',
    'sec-16.6': 'esquema/b6',
    'sec-16.8': 'esquema',
    'sec-16.8.1': 'esquema/b1',
    'sec-16.8.2': 'esquema/b2',
    'sec-16.8.3': 'esquema/b3',
    'sec-16.8.4': 'esquema/b4',
    'sec-16.8.5': 'esquema/b5',
    'sec-16.8.6': 'esquema/b6',
    'sec-16.8.7': 'esquema/b7',
    'sec-16.8.8': 'esquema/b8',
    'sec-16.9': 'senal/TP3',
    'sec-16.11': 'alineacion',
    'sec-16.11.2': 'alineacion',
    'sec-16.11.3': 'alineacion',
    'sec-16.11.4': 'alineacion',
    'sec-16.11.5': 'alineacion',
    'sec-16.11.6': 'alineacion',
    'sec-16.11.7': 'alineacion',
    'sec-16.12': 'averias',
    'sec-16.20': 'senal',
    'sec-16.21': 'esquema',
  };
  const destino = $derived(DESTINOS[label]);

  function salto(): void {
    const r = app.refs[label];
    prepararSalto({ texto: r ? `Volver a ${r.tipo === 'fig' ? 'la figura ' : ''}${r.num}` : 'Volver al libro' });
  }
</script>

{#if destino}
  <a class="ver-kit" class:compacto href={`#/fm7303/${destino}`} onclick={salto} title="Abrir el kit FM7303 vivo">
    <Radio size={16} strokeWidth={2.2} /><span class="texto">Kit FM7303</span>
  </a>
{/if}

<style>
  .ver-kit {
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
  .ver-kit:hover {
    background: var(--acento-suave);
    border-color: var(--acento);
  }
  .ver-kit.compacto {
    min-height: 28px;
    padding: 0 9px;
    font-size: 12.5px;
  }
  @media (pointer: coarse) {
    .ver-kit {
      min-height: 44px;
    }
  }
  @media (max-width: 599px) {
    .ver-kit.compacto .texto {
      display: none;
    }
  }
</style>
