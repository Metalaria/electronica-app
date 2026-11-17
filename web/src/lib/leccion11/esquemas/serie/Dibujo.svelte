<script lang="ts">
  // Schematic «serie» (esquema.ts): one loop — r1 and r2 on top, r3 on the right, r4 along the bottom.
  import type { PropsDibujo } from '../dibujos';
  import Punto from '../kit/Punto.svelte';
  import Rama from '../kit/Rama.svelte';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} alto={262}>
  <Flujo d="M40 230 V50 H300 V230 Z" {dur} />
  <Pila x={40} y1={230} y2={50} pieza="fuente" nodos={['0', 'fte']} />
  <Et x={2} y={170} t={c.val('fuente')} />
  <path class="hilo" d="M40 50 H60" data-red="fte"></path>
  <R x1={60} y1={50} x2={170} y2={50} color="azul" pieza="r1" />
  <Et x={115} y={30} t={c.rot('r1')} ancla="middle" color="azul" />
  <path class="hilo" d="M170 50 H175" data-red="a1"></path>
  <R x1={175} y1={50} x2={285} y2={50} color="naranja" pieza="r2" />
  <Et x={230} y={30} t={c.rot('r2')} ancla="middle" color="naranja" />
  <path class="hilo" d="M285 50 H300" data-red="a2"></path>
  {#if c.tiene('r3')}
    <R x1={300} y1={50} x2={300} y2={230} color="verde" pieza="r3" />
    <Et x={312} y={136} t={c.simT('r3')} color="verde" />
    <Et x={312} y={156} t={c.val('r3')} color="verde" peq />
  {:else}
    <path class="hilo" d="M300 50 V230" data-red="a2"></path>
  {/if}
  {#if c.tiene('r4')}
    <path class="hilo" d="M300 230 H285" data-red="a3"></path>
    <path class="hilo" d="M40 230 H65" data-red="0"></path>
    <R x1={285} y1={230} x2={175} y2={230} color="azul" pieza="r4" />
    <Et x={230} y={256} t={c.rot('r4')} ancla="middle" color="azul" />
    <path class="hilo" d="M175 230 H65" data-red="0"></path>
  {:else}
    <path class="hilo" d="M300 230 H40" data-red="0"></path>
  {/if}
  <!-- (1.2.1: where the probes touch each node and the ammeter opens each branch) -->
  <Punto x={50} y={50} red="fte" />
  <Punto x={172} y={50} red="a1" />
  {#if c.tiene('r3')}<Punto x={293} y={50} red="a2" />{/if}
  {#if c.tiene('r4')}<Punto x={300} y={222} red="a3" />{/if}
  <Punto x={110} y={230} red="0" />
  <Rama x={50} y={50} medidor="vmed" />
  <Rama x={110} y={230} medidor="vfin" />
</Lienzo>
