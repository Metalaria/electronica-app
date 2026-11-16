<script lang="ts">
  // Schematic «media-onda» (esquema.ts): the AC input, the diode on top, the capacitor and the load down the right.
  import type { PropsDibujo } from '../dibujos';
  import C from '../kit/C.svelte';
  import D from '../kit/D.svelte';
  import Et from '../kit/Et.svelte';
  import FuenteCA from '../kit/FuenteCA.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  import Interruptor from '../kit/Interruptor.svelte';
  import Punto from '../kit/Punto.svelte';
  import Rama from '../kit/Rama.svelte';
  let { c, descripcion }: PropsDibujo = $props();
  const fin = $derived(c.tiene('carga') ? 320 : 230);
</script>

<Lienzo {descripcion} alto={250}>
  <FuenteCA x={40} y1={230} y2={50} pieza="fuente" />
  <Et x={2} y={110} t={c.val('fuente')} peq />
  <Et x={2} y={190} t={c.val('f')} peq />
  <path class="hilo" d="M40 50 H90" data-red="fte"></path>
  <path class="hilo" d={`M150 50 H${fin}`} data-red="s"></path>
  <path class="hilo" d={`M40 230 H${fin}`} data-red="0"></path>
  <g data-pieza="diodo"><D x1={90} y1={50} x2={150} y2={50} color="azul" /></g>
  <Et x={120} y={30} t={`diodo ${c.val('vd')}`} ancla="middle" color="azul" peq />
  {#if c.tiene('c')}
    <circle class="nodo" cx="230" cy="50" r="4.5"></circle>
    <C x1={230} y1={50} x2={230} y2={230} color="naranja" polar pieza="c" />
    <Et x={246} y={136} t={c.simT('c')} color="naranja" />
    <Et x={246} y={156} t={c.val('c')} color="naranja" peq />
  {/if}
  {#if c.tiene('carga')}
    {#if c.tiene('interruptor')}
      <Interruptor x1={320} y1={50} x2={320} y2={100} cerrado={c.cerrado('interruptor')} color="verde" pieza="interruptor" />
      <R x1={320} y1={100} x2={320} y2={230} color="verde" fantasma={!c.cerrado('interruptor')} pieza="carga" />
    {:else}
      <R x1={320} y1={50} x2={320} y2={230} color="verde" pieza="carga" />
    {/if}
    <Et x={334} y={136} t={c.simT('carga')} color="verde" />
    <Et x={334} y={156} t={c.val('carga')} color="verde" peq />
  {/if}
  <circle class="salida" cx="190" cy="50" r="6" data-red="s"></circle>
  <Et x={190} y={34} t="salida" color="naranja" peq ancla="middle" />
  <!-- (1.2.1: where the probes touch each node and the ammeter opens the branch) -->
  <Punto x={64} y={50} red="fte" />
  <Punto x={190} y={50} red="s" />
  <Punto x={140} y={230} red="0" />
  <Rama x={64} y={50} medidor="vdm" />
</Lienzo>
