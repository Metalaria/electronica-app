<script lang="ts">
  // Play/pause, speed and restart of an animation.
  import Play from '@lucide/svelte/icons/play';
  import Pause from '@lucide/svelte/icons/pause';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import type { Reloj } from '../nucleo/reloj.svelte';

  let { reloj, reiniciar = true }: { reloj: Reloj; reiniciar?: boolean } = $props();

  const VELOCIDADES = [0.1, 0.25, 0.5, 1, 2, 4];
  const nombre = (v: number) => (v < 1 ? `${String(v).replace('.', ',')}×` : `${v}×`);
</script>

<div class="reproduccion">
  <button
    type="button"
    class="play"
    aria-label={reloj.play ? 'Pausar la animación' : 'Reanudar la animación'}
    title={reloj.play ? 'Pausar' : 'Reanudar'}
    onclick={() => reloj.alternar()}
  >
    {#if reloj.play}<Pause size={18} strokeWidth={2.2} />{:else}<Play size={18} strokeWidth={2.2} />{/if}
  </button>
  <label class="vel">
    <span class="solo-lector">Velocidad</span>
    <select bind:value={reloj.velocidad} aria-label="Velocidad">
      {#each VELOCIDADES as v (v)}<option value={v}>{nombre(v)}</option>{/each}
    </select>
  </label>
  {#if reiniciar}
    <button type="button" class="boton-icono" aria-label="Reiniciar" title="Reiniciar" onclick={() => reloj.reiniciar()}>
      <RotateCcw size={18} strokeWidth={2} />
    </button>
  {/if}
</div>

<style>
  .reproduccion {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .play {
    display: inline-grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 0;
    border-radius: 50%;
    background: var(--banda);
    color: #fff;
    box-shadow: var(--sombra);
  }
  .play:hover {
    filter: brightness(1.1);
  }
  select {
    height: 36px;
    padding: 0 8px;
    border: 1px solid var(--linea);
    border-radius: 10px;
    background: var(--superficie);
    color: var(--tinta);
    font-size: 14px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  /* Touch screens: every control at least 44 px. */
  @media (pointer: coarse) {
    .play,
    .reproduccion .boton-icono {
      width: 44px;
      height: 44px;
    }
    select {
      height: 44px;
    }
  }
</style>
