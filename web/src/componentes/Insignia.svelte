<script lang="ts">
  // Coloured badge of a part: its number on the block colour, or an icon for unnumbered parts.
  import { infoParte } from '../lib/datos';
  import { colorBloque } from '../lib/color';
  import Icono from './Icono.svelte';

  let { parte, grande = false }: { parte: string; grande?: boolean } = $props();

  const info = $derived(infoParte(parte));
  const num = $derived(info?.num != null && info.num !== '' ? info.num : null);
</script>

<span class="insignia" class:grande class:hueca={num == null} style:--c={colorBloque(info?.color)} aria-hidden="true">
  {#if num != null}
    {num}
  {:else}
    <Icono nombre={info?.tipo === 'glosario' ? 'glosario' : 'libro'} tam={grande ? 20 : 14} grosor={2.1} />
  {/if}
</span>

<style>
  .insignia {
    display: inline-grid;
    flex: none;
    place-items: center;
    min-width: 28px;
    height: 24px;
    padding: 0 5px;
    border-radius: 6px;
    background: var(--c);
    color: #fff;
    font-family: var(--sans);
    font-size: 13px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .insignia.grande {
    min-width: 44px;
    height: 44px;
    border-radius: 10px;
    font-size: 19px;
  }
  .hueca {
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--c);
    color: var(--c);
  }
  /* Dark theme: the darkest block colours (navy) almost vanish on the dark panels, so lighten the fill a
     little and add a faint ring; the white number keeps its contrast. */
  :global(:root[data-tema='oscuro']) .insignia:not(.hueca) {
    background: color-mix(in srgb, var(--c) 78%, #fff 22%);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.22);
  }
  :global(:root[data-tema='oscuro']) .hueca {
    filter: brightness(1.7) saturate(0.8);
  }
</style>
