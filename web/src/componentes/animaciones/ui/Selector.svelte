<script lang="ts" generics="T extends string | number">
  // Segmented control (one of a few options).
  import Rico from './Rico.svelte';

  let {
    opciones,
    valor = $bindable(),
    etiqueta,
  }: {
    opciones: { valor: T; texto: string; color?: string }[];
    valor: T;
    etiqueta?: string;
  } = $props();
</script>

<div class="selector">
  {#if etiqueta}<span class="et"><Rico texto={etiqueta} /></span>{/if}
  <div class="opciones" role="radiogroup" aria-label={etiqueta}>
    {#each opciones as o (o.valor)}
      <button
        type="button"
        role="radio"
        aria-checked={valor === o.valor}
        class:activo={valor === o.valor}
        style:--c={o.color}
        onclick={() => (valor = o.valor)}
      >
        {#if o.color}<i></i>{/if}<span><Rico texto={o.texto} /></span>
      </button>
    {/each}
  </div>
</div>

<style>
  .selector {
    display: grid;
    gap: 6px;
    min-width: 0;
  }
  .et {
    font-size: 14px;
    font-weight: 600;
  }
  .opciones {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 3px;
    border-radius: 12px;
    background: var(--superficie-2);
    border: 1px solid var(--linea-suave);
  }
  button {
    flex: 1 1 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 34px;
    padding: 0 10px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--tinta-suave);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    transition:
      background 0.15s,
      color 0.15s;
  }
  button:hover {
    color: var(--tinta);
  }
  button.activo {
    background: var(--superficie);
    color: var(--tinta);
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.12),
      0 0 0 1px var(--linea);
  }
  i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--c);
  }
  @media (pointer: coarse) {
    button {
      min-height: 44px;
    }
  }
</style>
