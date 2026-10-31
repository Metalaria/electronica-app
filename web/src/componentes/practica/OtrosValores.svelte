<script lang="ts">
  // «Practicar con otros valores» under an exercise of the book that a formula of the catalogue reproduces
  // (practica/indice.json `ejercicios`): the same statement with other realistic values on every attempt,
  // in the practice shell. Nothing is loaded until the reader asks for it. Exercises do not count for the
  // daily goal (as the exercises themselves do not).
  import { onMount } from 'svelte';
  import Shuffle from '@lucide/svelte/icons/shuffle';
  import type { ItemPractica } from './tipos';
  import { cargarIndicePractica, cargarPractica } from './datos';

  let { label, parte }: { label: string; parte: string } = $props();

  let id = $state<string | null>(null);
  let abierto = $state(false);
  let item = $state.raw<ItemPractica | null>(null);
  let Practica: typeof import('./Practica.svelte').default | null = $state.raw(null);

  onMount(() => {
    // the label read now: when the index arrives the exercise may be gone (leaving the page), and reading its props
    // then warned «derived_inert» (0.11 QA)
    const l = label;
    let vivo = true;
    void cargarIndicePractica().then((ind) => {
      if (vivo) id = ind?.ejercicios[l] ?? null;
    });
    return () => {
      vivo = false;
    };
  });

  async function abrir() {
    abierto = !abierto;
    if (!abierto || item) return;
    const r = await Promise.all([cargarPractica(parte), import('./Practica.svelte')]).catch(() => null);
    if (!r) {
      // no network: closed again, the button stays to try later
      abierto = false;
      return;
    }
    const [d, m] = r;
    item = d?.items.find((x) => x.id === id) ?? null;
    Practica = m.default;
  }
</script>

{#if id}
  <div class="otros-valores" data-otros-valores={label}>
    <button type="button" class="abrir" aria-expanded={abierto} onclick={abrir} data-practicar-ej>
      <Shuffle size={16} aria-hidden="true" />
      {abierto ? 'Cerrar la práctica' : 'Practicar con otros valores'}
    </button>
    {#if abierto && item && Practica}
      {@const P = Practica}
      <div class="caja"><P {item} etiqueta="Con otros valores" /></div>
    {/if}
  </div>
{/if}

<style>
  .otros-valores {
    margin-top: 8px;
  }
  .abrir {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--acento);
    font-family: var(--sans);
    font-size: 14.5px;
    font-weight: 600;
  }
  .caja {
    margin-top: 10px;
    padding: 14px;
    border: 1px solid var(--linea);
    border-radius: 14px;
    background: var(--fondo);
  }
</style>
