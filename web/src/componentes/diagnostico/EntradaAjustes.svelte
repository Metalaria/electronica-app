<script lang="ts">
  // The «Rendimiento» group of the settings popover (Ajustes.svelte): the way to «Diagnóstico de rendimiento».
  import Gauge from '@lucide/svelte/icons/gauge';
  import { app } from '../../lib/estado.svelte';
</script>

<div class="grupo" data-grupo-diagnostico>
  <span class="etiqueta">Rendimiento</span>
  <a class="enlace-diagnostico" href="#/diagnostico" onclick={() => (app.ajustes = false)}>
    <Gauge size={17} aria-hidden="true" /> Diagnóstico de rendimiento
  </a>
</div>

<style>
  .grupo {
    margin-top: 16px;
  }
  .etiqueta {
    display: block;
    margin-bottom: 8px;
    color: var(--tinta-tenue);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .enlace-diagnostico {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: var(--acento);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
  }
  .enlace-diagnostico:hover {
    text-decoration: underline;
  }
</style>
