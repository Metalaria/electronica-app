<script lang="ts">
  // Schematic «transformador» (esquema.ts): the AC source, the primary (blue) and secondary (orange) windings on the
  // core, the switch and the load.
  import type { PropsDibujo } from '../dibujos';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import FuenteCA from '../kit/FuenteCA.svelte';
  import Interruptor from '../kit/Interruptor.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  import Trafo from '../kit/Trafo.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const cerrado = $derived(c.cerrado('interruptor'));
</script>

<Lienzo {descripcion} alto={250}>
  <Flujo d="M40 210 V60 H150 V210 Z" {dur} medidor="vmed" />
  {#if cerrado}<Flujo d="M210 60 H320 V210 H210 Z" {dur} medidor="vcarga" />{/if}
  <FuenteCA x={40} y1={210} y2={60} pieza="fuente" />
  <Et x={2} y={36} t={c.val('fuente')} />
  <path class="hilo" d="M40 60 H150 V80 M40 210 H150 V190 M210 80 V60 H240 M210 190 V210 H320"></path>
  <Trafo x1={150} x2={210} y1={80} y2={190} />
  <Et x={140} y={232} t={`${c.val('n1')} esp.`} color="azul" peq ancla="end" />
  <Et x={220} y={232} t={`${c.val('n2')} esp.`} color="naranja" peq />
  {#if c.tiene('interruptor')}
    <Interruptor x1={240} y1={60} x2={295} y2={60} {cerrado} color="verde" pieza="interruptor" />
  {:else}
    <path class="hilo" d="M240 60 H295"></path>
  {/if}
  <path class="hilo" d="M295 60 H320"></path>
  <R x1={320} y1={60} x2={320} y2={210} color="verde" fantasma={!cerrado} pieza="carga" />
  {#if cerrado}
    <Et x={334} y={130} t={c.simT('carga')} color="verde" />
    <Et x={334} y={150} t={c.val('carga')} color="verde" peq />
  {/if}
</Lienzo>
