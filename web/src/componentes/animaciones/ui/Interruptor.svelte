<script lang="ts">
  // On/off switch with label.
  import Rico from './Rico.svelte';

  let { etiqueta, valor = $bindable() }: { etiqueta: string; valor: boolean } = $props();
</script>

<label class="interruptor">
  <input type="checkbox" role="switch" bind:checked={valor} />
  <span class="pista" aria-hidden="true"><span class="bola"></span></span>
  <span class="et"><Rico texto={etiqueta} /></span>
</label>

<style>
  .interruptor {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 36px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    user-select: none;
  }
  input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }
  .pista {
    position: relative;
    flex: none;
    width: 40px;
    height: 24px;
    border-radius: 12px;
    background: var(--linea);
    transition: background 0.18s;
  }
  .bola {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--superficie);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    transition: transform 0.18s;
  }
  input:checked + .pista {
    background: var(--acento);
  }
  input:checked + .pista .bola {
    transform: translateX(16px);
  }
  input:focus-visible + .pista {
    outline: 2px solid var(--acento);
    outline-offset: 2px;
  }
  @media (pointer: coarse) {
    .interruptor {
      min-height: 44px;
    }
  }
</style>
