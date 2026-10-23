<script lang="ts">
  // «Leída» toggle next to a section title: shows whether the section counts as read and lets the reader
  // mark or unmark it by hand.
  import { onMount } from 'svelte';
  import { aprendizaje, cargarAprendizaje } from '../../lib/aprendizaje.svelte';
  import { alternarLeida } from '../../lib/lectura';
  import Icono from '../Icono.svelte';

  let { parte, label }: { parte: string; label: string } = $props();

  const leida = $derived(!!aprendizaje.leidas[parte]?.[label]);

  onMount(() => {
    void cargarAprendizaje();
  });
</script>

<button
  type="button"
  class="boton-icono leida"
  class:si={leida}
  aria-pressed={leida}
  aria-label={leida ? 'Sección leída: desmarcar' : 'Marcar la sección como leída'}
  title={leida ? 'Leída (pulse para desmarcar)' : 'Marcar como leída'}
  onclick={() => alternarLeida(parte, label)}><Icono nombre="leida" tam={19} /></button
>

<style>
  .leida {
    width: 44px;
    height: 44px;
  }
  .leida.si {
    color: var(--c-ejemplo);
  }
</style>
