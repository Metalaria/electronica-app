<script lang="ts">
  // A labelled slider with its value, ±fine steps and a 44 px touch target.
  import Minus from '@lucide/svelte/icons/minus';
  import Plus from '@lucide/svelte/icons/plus';

  let {
    etiqueta,
    valor = $bindable(),
    min = 0,
    max = 1,
    paso = 0.001,
    fino = 0.005,
    texto = '',
    ayuda = '',
    destacado = false,
    id,
  }: {
    etiqueta: string;
    valor: number;
    min?: number;
    max?: number;
    paso?: number;
    /** Step of the − and + buttons. */
    fino?: number;
    /** Value as shown. */
    texto?: string;
    ayuda?: string;
    destacado?: boolean;
    id: string;
  } = $props();

  function mover(d: number) {
    valor = Math.min(max, Math.max(min, Math.round((valor + d) / paso) * paso));
  }
</script>

<div class="deslizador" class:destacado data-mando={id}>
  <div class="fila">
    <label for={`fm-${id}`}>{etiqueta}</label>
    <output for={`fm-${id}`}>{texto}</output>
  </div>
  <div class="fila control">
    <button type="button" aria-label={`${etiqueta}: menos`} onclick={() => mover(-fino)}><Minus size={16} /></button>
    <input id={`fm-${id}`} type="range" {min} {max} step={paso} bind:value={valor} aria-valuetext={texto} />
    <button type="button" aria-label={`${etiqueta}: más`} onclick={() => mover(fino)}><Plus size={16} /></button>
  </div>
  {#if ayuda}<p class="ayuda">{ayuda}</p>{/if}
</div>

<style>
  .deslizador {
    padding: 6px 8px;
    border-radius: 10px;
    border: 1px solid transparent;
  }
  .deslizador.destacado {
    border-color: var(--acento-borde);
    background: var(--acento-tinte);
  }
  .fila {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  label {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--tinta);
  }
  output {
    font-size: 13px;
    color: var(--tinta-suave);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .control {
    gap: 4px;
  }
  input[type='range'] {
    flex: 1;
    min-width: 0;
    height: 44px;
    margin: 0;
    accent-color: var(--acento);
    background: transparent;
    cursor: pointer;
  }
  button {
    display: grid;
    place-items: center;
    flex: none;
    width: 44px;
    height: 44px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    cursor: pointer;
  }
  button:hover {
    background: var(--superficie-2);
  }
  .ayuda {
    margin: 2px 0 0;
    font-size: 12.5px;
    color: var(--tinta-suave);
    line-height: 1.35;
  }
</style>
