<script lang="ts">
  // Schematic «termica» (esquema.ts): the power P as a current source on the left, the chain along the top — junction,
  // R_jc, case, R_cs, heatsink, R_sa — to the ambient T_a, a source on the right; without a heatsink one resistor from
  // the case to the ambient. The thermal capacitances hang from their nodes down to the 0 °C rail. The living circuit
  // labels and keys the nodes in °C (Lienzo «nodos»).
  import type { PropsDibujo } from '../dibujos';
  import C from '../kit/C.svelte';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import FuenteI from '../kit/FuenteI.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  import { conDisipador } from './esquema';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const disip = $derived(conDisipador(c));
</script>

<Lienzo {descripcion} ancho={460} alto={262} nodos={{ magnitud: 'Temperatura', unidad: '°C' }}>
  <Flujo d="M40 240 V60 H400 V240 Z" {dur} medidor="vmq" />
  <FuenteI x={40} y1={240} y2={60} pieza="p" nodos={['0', 'j']} />
  <Et x={34} y={100} t={c.simT('p')} ancla="end" />
  <Et x={34} y={118} t={c.val('p')} ancla="end" peq />
  <path class="hilo" d="M40 60 H100" data-red="j"></path>
  <R x1={100} y1={60} x2={200} y2={60} color="naranja" pieza="rjc" />
  <Et x={150} y={40} t={c.rot('rjc')} ancla="middle" color="naranja" peq />
  {#if disip}
    {#if c.tiene('rcs')}
      <R x1={200} y1={60} x2={300} y2={60} color="azul" pieza="rcs" />
      <Et x={250} y={40} t={c.rot('rcs')} ancla="middle" color="azul" peq />
    {:else}
      <path class="hilo" d="M200 60 H300" data-red="c"></path>
    {/if}
    <R x1={300} y1={60} x2={400} y2={60} color="verde" pieza="rsa" />
    <Et x={350} y={40} t={c.rot('rsa')} ancla="middle" color="verde" peq />
    <Et x={306} y={84} t="disipador" color="verde" peq />
  {:else}
    <!-- without a heatsink: the case straight to the ambient, what R_ja leaves after R_jc -->
    <R x1={200} y1={60} x2={400} y2={60} pieza="rja" />
    <Et x={300} y={40} t={[{ t: 'txt', s: 'sin disipador: ' }, ...c.rot('rja')]} ancla="middle" peq />
  {/if}
  <Et x={106} y={84} t="unión" color="naranja" peq />
  <Et x={206} y={84} t="cápsula" color="azul" peq />
  <Pila x={400} y1={240} y2={60} pieza="ta" nodos={['0', 'a']} />
  <Et x={414} y={100} t="ambiente" peq />
  <Et x={414} y={140} t={c.simT('ta')} />
  <Et x={414} y={158} t={c.val('ta')} peq />
  {#if c.tiene('cj')}
    <circle class="nodo" cx="100" cy="60" r="4.5" data-red="j"></circle>
    <C x1={100} y1={60} x2={100} y2={240} color="naranja" pieza="cj" />
    <Et x={116} y={150} t={c.simT('cj')} color="naranja" peq />
    <Et x={116} y={168} t={c.val('cj')} color="naranja" peq />
  {/if}
  {#if c.tiene('cc')}
    <circle class="nodo" cx="200" cy="60" r="4.5" data-red="c"></circle>
    <C x1={200} y1={60} x2={200} y2={240} color="azul" pieza="cc" />
    <Et x={216} y={150} t={c.simT('cc')} color="azul" peq />
    <Et x={216} y={168} t={c.val('cc')} color="azul" peq />
  {/if}
  {#if c.tiene('cs') && disip}
    <circle class="nodo" cx="300" cy="60" r="4.5" data-red="s"></circle>
    <C x1={300} y1={60} x2={300} y2={240} color="verde" pieza="cs" />
    <Et x={316} y={150} t={c.simT('cs')} color="verde" peq />
    <Et x={316} y={168} t={c.val('cs')} color="verde" peq />
  {/if}
  <path class="hilo" d="M40 240 H400" data-red="0"></path>
</Lienzo>
