<script lang="ts">
  // Schematic «serie» (esquema.ts): one loop — r1 and r2 on top, r3 on the right, r4 along the bottom.
  import type { PropsDibujo } from '../dibujos';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} alto={262}>
  <Flujo d="M40 230 V50 H300 V230 Z" {dur} />
  <Pila x={40} y1={230} y2={50} />
  <Et x={2} y={170} t={c.val('fuente')} />
  <path class="hilo" d="M40 50 H60"></path>
  <R x1={60} y1={50} x2={170} y2={50} color="azul" />
  <Et x={115} y={30} t={c.rot('r1')} ancla="middle" color="azul" />
  <R x1={175} y1={50} x2={285} y2={50} color="naranja" />
  <Et x={230} y={30} t={c.rot('r2')} ancla="middle" color="naranja" />
  <path class="hilo" d="M285 50 H300"></path>
  {#if c.tiene('r3')}
    <R x1={300} y1={50} x2={300} y2={230} color="verde" />
    <Et x={312} y={136} t={c.simT('r3')} color="verde" />
    <Et x={312} y={156} t={c.val('r3')} color="verde" peq />
  {:else}
    <path class="hilo" d="M300 50 V230"></path>
  {/if}
  {#if c.tiene('r4')}
    <path class="hilo" d="M300 230 H285 M40 230 H65"></path>
    <R x1={285} y1={230} x2={175} y2={230} color="azul" />
    <Et x={230} y={256} t={c.rot('r4')} ancla="middle" color="azul" />
    <path class="hilo" d="M175 230 H65"></path>
  {:else}
    <path class="hilo" d="M300 230 H40"></path>
  {/if}
</Lienzo>
