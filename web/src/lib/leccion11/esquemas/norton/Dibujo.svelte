<script lang="ts">
  // Schematic «norton» (esquema.ts): the current source and its parallel resistance in the dashed box, the switch and
  // the load on the right.
  import type { PropsDibujo } from '../dibujos';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import FuenteI from '../kit/FuenteI.svelte';
  import Interruptor from '../kit/Interruptor.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const cerrado = $derived(c.cerrado('interruptor'));
</script>

<Lienzo {descripcion} alto={250}>
  <Flujo d={cerrado ? 'M50 230 V50 H320 V230 Z' : 'M50 230 V50 H140 V230 Z'} {dur} />
  <rect class="cuerpo" x="12" y="18" width="188" height="226" rx="10" stroke-dasharray="6 5"></rect>
  <FuenteI x={50} y1={230} y2={50} />
  <Et x={74} y={145} t={c.val('fuente')} />
  <path class="hilo" d="M50 50 H230 M50 230 H320"></path>
  <circle class="nodo" cx="140" cy="50" r="4.5"></circle>
  <circle class="nodo" cx="140" cy="230" r="4.5"></circle>
  <R x1={140} y1={50} x2={140} y2={230} color="azul" />
  <Et x={152} y={120} t={c.simT('rn')} color="azul" />
  <Et x={152} y={140} t={c.val('rn')} color="azul" peq />
  <circle class="borne" cx="215" cy="50" r="5"></circle>
  <circle class="borne" cx="215" cy="230" r="5"></circle>
  {#if c.tiene('interruptor')}
    <Interruptor x1={230} y1={50} x2={290} y2={50} {cerrado} color="verde" />
  {:else}
    <path class="hilo" d="M230 50 H290"></path>
  {/if}
  <path class="hilo" d="M290 50 H320"></path>
  <R x1={320} y1={50} x2={320} y2={230} color="verde" fantasma={!cerrado} />
  {#if cerrado}
    <Et x={334} y={136} t={c.simT('carga')} color="verde" />
    <Et x={334} y={156} t={c.val('carga')} color="verde" peq />
  {/if}
</Lienzo>
