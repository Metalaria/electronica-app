<script lang="ts">
  // Schematic «wheatstone» (esquema.ts): the left divider at x = 150, the right one at x = 270, the detector between.
  import type { PropsDibujo } from '../dibujos';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} alto={250}>
  <Flujo d="M40 230 V30 H150 V230 Z" {dur} />
  <Flujo d="M40 230 V30 H270 V230 Z" {dur} />
  <Pila x={40} y1={230} y2={30} pieza="fuente" nodos={['0', 't']} />
  <Et x={2} y={160} t={c.val('fuente')} />
  <path class="hilo" d="M40 30 H270" data-red="t"></path>
  <path class="hilo" d="M40 230 H270" data-red="0"></path>
  <R x1={150} y1={30} x2={150} y2={130} color="azul" pieza="r1" />
  <R x1={150} y1={130} x2={150} y2={230} color="azul" pieza="r2" />
  <R x1={270} y1={30} x2={270} y2={130} color="naranja" pieza="r3" />
  <R x1={270} y1={130} x2={270} y2={230} color="naranja" pieza="r4" />
  <Et x={86} y={72} t={c.simT('r1')} color="azul" />
  <Et x={86} y={90} t={c.val('r1')} color="azul" peq />
  <Et x={86} y={182} t={c.simT('r2')} color="azul" />
  <Et x={86} y={200} t={c.val('r2')} color="azul" peq />
  <Et x={284} y={72} t={c.simT('r3')} color="naranja" />
  <Et x={284} y={90} t={c.val('r3')} color="naranja" peq />
  <Et x={284} y={182} t={c.simT('r4')} color="naranja" />
  <Et x={284} y={200} t={c.val('r4')} color="naranja" peq />
  {#if c.tiene('rd')}
    <path class="hilo" d="M150 130 H158" data-red="a"></path>
    <path class="hilo" d="M262 130 H270" data-red="b"></path>
    <R x1={158} y1={130} x2={262} y2={130} color="verde" pieza="rd" />
    <Et x={210} y={156} t={c.val('rd')} color="verde" peq ancla="middle" />
  {:else}
    <path class="hilo" d="M150 130 H194" data-red="a"></path>
    <path class="hilo" d="M226 130 H270" data-red="b"></path>
    <circle class="pieza verde" cx="210" cy="130" r="16"></circle>
    <Et x={210} y={135} t="V" color="verde" ancla="middle" />
  {/if}
  <circle class="nodo" cx="150" cy="130" r="4.5" data-red="a"></circle>
  <circle class="nodo" cx="270" cy="130" r="4.5" data-red="b"></circle>
  <Et x={158} y={120} t="a" peq />
  <Et x={262} y={120} t="b" peq ancla="end" />
</Lienzo>
