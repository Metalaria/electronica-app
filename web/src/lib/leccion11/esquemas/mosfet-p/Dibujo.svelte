<script lang="ts">
  // Schematic «mosfet-p» (esquema.ts): the gate source and R_G on the left, the P-channel MOSFET with its source up to
  // the V_DD rail and its drain down through R_D to ground, R_GS from the gate up to the rail, V_DD on the right.
  import type { PropsDibujo } from '../dibujos';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Mosfet from '../kit/Mosfet.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} alto={260}>
  <Flujo d="M340 240 V30 H222 V240 Z" {dur} medidor="vmd" />
  <Pila x={40} y1={240} y2={110} pieza="entrada" nodos={['0', 'in']} />
  <Et x={2} y={98} t={c.val('entrada')} />
  {#if c.tiene('rg')}
    <path class="hilo" d="M40 110 H70" data-red="in"></path>
    <R x1={70} y1={110} x2={150} y2={110} color="azul" pieza="rg" />
    <Et x={110} y={136} t={c.rot('rg')} ancla="middle" color="azul" peq />
    <path class="hilo" d="M150 110 H176" data-red="g"></path>
  {:else}
    <path class="hilo" d="M40 110 H176" data-red="g"></path>
  {/if}
  {#if c.tiene('rgs')}
    <circle class="nodo" cx="162" cy="110" r="4.5" data-red="g"></circle>
    <R x1={162} y1={110} x2={162} y2={30} color="azul" pieza="rgs" />
    <Et x={148} y={66} t={c.rot('rgs')} ancla="end" color="azul" peq />
  {/if}
  <Mosfet x={210} y={110} canal="p" diodo />
  <Et x={254} y={150} t={`k ${c.val('k')}`} peq />
  <Et x={254} y={168} t={`V_th −${c.val('vth')}`} peq />
  <path class="hilo" d="M222 70 V30" data-red="vdd"></path>
  <path class="hilo" d={`M${c.tiene('rgs') ? 162 : 222} 30 H340`} data-red="vdd"></path>
  <path class="hilo" d="M222 150 V170" data-red="d"></path>
  <R x1={222} y1={170} x2={222} y2={240} color="naranja" pieza="rd" />
  <Et x={208} y={210} t={c.rot('rd')} ancla="end" color="naranja" peq />
  <path class="hilo" d="M40 240 H340" data-red="0"></path>
  <Pila x={340} y1={240} y2={30} pieza="vdd" nodos={['0', 'vdd']} />
  <Et x={354} y={150} t={c.val('vdd')} peq />
</Lienzo>
