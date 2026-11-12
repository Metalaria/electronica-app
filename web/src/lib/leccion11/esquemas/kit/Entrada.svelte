<script lang="ts">
  // 1.2 schematic kit (esquemas12): the input source of an op-amp schematic (comun-ao.ts piezasEntrada) on a vertical
  // line from y1 (bottom, ground) to y2 (top, node «in»): a battery for a DC input, the sine symbol for a signal (with a
  // square or triangle glyph inside for those forms).
  import FuenteCA from './FuenteCA.svelte';
  import Pila from './Pila.svelte';
  import type { ContextoDibujo } from '../tipos';
  let { c, x, y1, y2, nodo = 'in' }: { c: ContextoDibujo; x: number; y1: number; y2: number; nodo?: string } = $props();
  const senal = $derived(c.tiene('amplitud') && c.tiene('f') && c.p('f') > 0);
</script>

{#if senal}
  <FuenteCA {x} {y1} {y2} pieza="entrada" nodos={['0', nodo]} />
{:else}
  <Pila {x} {y1} {y2} pieza="entrada" nodos={['0', nodo]} />
{/if}
