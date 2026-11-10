<script lang="ts">
  // Schematic «thevenin» (esquema.ts): the source and its resistance inside a dashed box (the equivalent), the two
  // terminals, the switch and the load on the right.
  import type { PropsDibujo } from '../dibujos';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Interruptor from '../kit/Interruptor.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const cerrado = $derived(c.cerrado('interruptor'));
</script>

<Lienzo {descripcion} alto={250}>
  {#if cerrado}<Flujo d="M50 230 V50 H320 V230 Z" {dur} />{/if}
  <rect class="cuerpo" x="12" y="18" width="188" height="226" rx="10" stroke-dasharray="6 5"></rect>
  <Pila x={50} y1={230} y2={50} />
  <Et x={66} y={150} t={c.val('fuente')} />
  <path class="hilo" d="M50 50 H70"></path>
  <R x1={70} y1={50} x2={190} y2={50} color="azul" />
  <Et x={130} y={84} t={c.rot('rth')} ancla="middle" color="azul" />
  <path class="hilo" d="M190 50 H230 M50 230 H320"></path>
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
