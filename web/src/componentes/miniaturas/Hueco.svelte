<script lang="ts">
  // Neutral placeholder of a list thumbnail (the item has no picture): the box keeps its size and shows a
  // faint outline icon of what kind of item it is.
  let { icono = 'figura' }: { icono?: 'figura' | 'esquema' | 'seccion' | 'termino' | 'modelo' } = $props();
</script>

<span class="hueco" data-miniatura-hueco={icono}>
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" focusable="false">
    {#if icono === 'esquema'}
      <path d="M2 12h4l1.5-3 3 6 3-6 3 6 1.5-3h4" />
    {:else if icono === 'seccion'}
      <path d="M6 3h9l4 4v14H6z" /><path d="M9 11h7M9 15h7M9 7h3" />
    {:else if icono === 'termino'}
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
    {:else if icono === 'modelo'}
      <path d="M12 2 3 7v10l9 5 9-5V7z" /><path d="m3 7 9 5 9-5M12 12v10" />
    {:else}
      <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-9 9" />
    {/if}
  </svg>
</span>

<style>
  .hueco {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    color: var(--tinta-tenue);
    opacity: 0.55;
  }
</style>
