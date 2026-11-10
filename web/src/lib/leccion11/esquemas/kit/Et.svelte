<script lang="ts">
  // 1.1 schematic kit: a label in the colour of its piece (tinta, azul, naranja, verde); plain text, or the runs of a
  // symbol with its subscripts («R_{L}», ContextoDibujo.simT / rot).
  import TextoSvg from '../../../../componentes/leccion11/TextoSvg.svelte';
  import type { Texto } from '../../tipos';
  let { x, y, t, color = 'tinta', peq = false, ancla = 'start' }: { x: number; y: number; t: string | Texto; color?: string; peq?: boolean; ancla?: 'start' | 'middle' | 'end' } = $props();
</script>

<text {x} {y} class={`et ${color}`} class:peq text-anchor={ancla}><TextoSvg {t} /></text>
