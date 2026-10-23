<script lang="ts">
  // Small ring with the fraction of a part's sections read (sidebar index).
  import { onMount } from 'svelte';
  import { aprendizaje, cargarAprendizaje } from '../../lib/aprendizaje.svelte';
  import { fraccionLeida } from '../../lib/lectura';
  import { infoParte } from '../../lib/datos';

  let { parte }: { parte: string } = $props();

  const f = $derived(aprendizaje.listo ? fraccionLeida(parte, infoParte(parte)?.secciones) : 0);

  onMount(() => {
    void cargarAprendizaje();
  });
</script>

{#if f > 0}
  <span
    class="anillo"
    class:completo={f >= 1}
    style:--f={f}
    role="img"
    aria-label={`${Math.round(f * 100)} % leído`}
    title={`${Math.round(f * 100)} % leído`}
  ></span>
{/if}

<style>
  .anillo {
    flex: none;
    width: 16px;
    height: 16px;
    margin-left: 4px;
    border-radius: 50%;
    background: conic-gradient(var(--c-ejemplo) calc(var(--f) * 360deg), var(--linea) 0);
    -webkit-mask: radial-gradient(circle, transparent 4.5px, #000 5px);
    mask: radial-gradient(circle, transparent 4.5px, #000 5px);
  }
  .anillo.completo {
    -webkit-mask: none;
    mask: none;
    background: var(--c-ejemplo);
  }
</style>
