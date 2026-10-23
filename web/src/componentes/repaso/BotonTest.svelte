<script lang="ts">
  // «Test del capítulo» at the end of a chapter or appendix in the reader (only when it has a quiz).
  import { onMount } from 'svelte';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import { cargarIndiceRepaso, type EntradaIndiceRepaso } from './datos';
  import { cargarRepaso, repaso } from './estado.svelte';

  let { parte }: { parte: string } = $props();

  let entrada = $state<EntradaIndiceRepaso | null>(null);
  onMount(() => {
    void cargarIndiceRepaso().then((i) => (entrada = i.partes.find((p) => p.parte === parte) ?? null));
    void cargarRepaso();
  });
  const previo = $derived(repaso.tests[parte]);
</script>

{#if entrada}
  <a class="test-capitulo" href={`#/repaso/test/${parte}`} data-test-capitulo>
    <ListChecks size={20} aria-hidden="true" />
    <span class="txt">
      <strong>Test del {entrada.tipo === 'apendice' ? 'apéndice' : 'capítulo'}</strong>
      <span>{entrada.preguntas} preguntas{previo ? ` · mejor ${Math.round(previo.mejor * 100)} %` : ''}</span>
    </span>
  </a>
{/if}

<style>
  .test-capitulo {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    margin: 28px 0 0;
    padding: 8px 18px 8px 14px;
    border: 1px solid var(--acento-borde);
    border-radius: 12px;
    background: var(--acento-tinte);
    color: var(--acento);
    font-family: var(--sans);
    text-decoration: none;
  }
  .test-capitulo:hover {
    filter: brightness(0.98);
  }
  .txt {
    display: flex;
    flex-direction: column;
    line-height: 1.25;
  }
  .txt strong {
    font-size: 15.5px;
  }
  .txt span {
    color: var(--tinta-suave);
    font-size: 13.5px;
  }
</style>
