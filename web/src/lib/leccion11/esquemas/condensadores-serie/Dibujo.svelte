<script lang="ts">
  // Schematic «condensadores-serie» (esquema.ts): the source on the left; the two capacitors in series in the first
  // column, their leakages (dashed: they are not parts, but the capacitors' own leak) in the second, and the
  // balancing resistors in the third (a ghost while disconnected).
  import type { PropsDibujo } from '../dibujos';
  import C from '../kit/C.svelte';
  import Et from '../kit/Et.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, descripcion }: PropsDibujo = $props();
  const conRe = $derived(c.tiene('re'));
  const cerrado = $derived(conRe && c.cerrado('interruptor'));
  const fin = $derived(conRe ? 300 : 200);
</script>

<Lienzo {descripcion} alto={250}>
  <Pila x={30} y1={230} y2={40} pieza="fuente" nodos={['0', 'a']} />
  <Et x={38} y={176} t={c.val('fuente')} />
  <path class="hilo" d={`M30 40 H${fin}`} data-red="a"></path>
  <path class="hilo" d={`M30 230 H${fin}`} data-red="0"></path>
  <path class="hilo" d={`M110 135 H${fin}`} data-red="m"></path>
  <C x1={110} y1={40} x2={110} y2={135} color="azul" polar pieza="c1" />
  <Et x={128} y={82} t={c.simT('c1')} color="azul" />
  <Et x={128} y={100} t={c.val('c1')} color="azul" peq />
  <C x1={110} y1={135} x2={110} y2={230} color="naranja" polar pieza="c2" />
  <Et x={128} y={177} t={c.simT('c2')} color="naranja" />
  <Et x={128} y={195} t={c.val('c2')} color="naranja" peq />
  <g class="fuga" stroke-dasharray="4 3">
    <R x1={200} y1={40} x2={200} y2={135} color="azul" pieza="f1" />
    <R x1={200} y1={135} x2={200} y2={230} color="naranja" pieza="f2" />
  </g>
  <Et x={214} y={82} t="fuga" color="azul" peq />
  <Et x={214} y={100} t={c.val('f1')} color="azul" peq />
  <Et x={214} y={177} t="fuga" color="naranja" peq />
  <Et x={214} y={195} t={c.val('f2')} color="naranja" peq />
  {#if conRe}
    <R x1={300} y1={40} x2={300} y2={135} color="verde" fantasma={!cerrado} pieza="re" />
    <R x1={300} y1={135} x2={300} y2={230} color="verde" fantasma={!cerrado} />
    {#if cerrado}
      <Et x={314} y={82} t={c.simT('re')} color="verde" />
      <!-- (review 11c: 22 below R_e, whose subscript hung into the value at 18) -->
      <Et x={314} y={104} t={c.val('re')} color="verde" peq />
      <Et x={314} y={177} t={c.simT('re')} color="verde" />
      <Et x={314} y={199} t={c.val('re')} color="verde" peq />
    {/if}
    <circle cx="200" cy="135" r="4.5" class="nodo" data-red="m"></circle>
  {/if}
  <circle cx="110" cy="135" r="4.5" class="nodo" data-red="m"></circle>
</Lienzo>
