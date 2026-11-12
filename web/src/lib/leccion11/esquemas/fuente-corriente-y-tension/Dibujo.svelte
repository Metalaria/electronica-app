<script lang="ts">
  // Schematic «fuente-corriente-y-tension» (esquema.ts), as figure 22.9: the voltage source and its series resistance on
  // the left, the resistance and the current source between the same two wires, the terminals and, if the widget has
  // it, the switch and the load on the right.
  import type { PropsDibujo } from '../dibujos';
  import Et from '../kit/Et.svelte';
  import Flujo from '../kit/Flujo.svelte';
  import FuenteI from '../kit/FuenteI.svelte';
  import Interruptor from '../kit/Interruptor.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const conCarga = $derived(c.tiene('carga'));
  const cerrado = $derived(conCarga && c.cerrado('interruptor'));
  const fin = $derived(conCarga ? 430 : 350);
</script>

<Lienzo {descripcion} ancho={conCarga ? 480 : 380} alto={250}>
  <Flujo d="M40 230 V50 H210 V230 Z" {dur} medidor="vm" />
  <Flujo d="M300 230 V50 H210 V230 Z" {dur} medidor="vi" />
  {#if cerrado}<Flujo d="M300 230 V50 H430 V230 Z" {dur} medidor="vcarga" />{/if}
  <Pila x={40} y1={230} y2={50} pieza="fuente" nodos={['0', 'f']} />
  <Et x={58} y={150} t={c.val('fuente')} />
  <path class="hilo" d="M40 50 H60" data-red="f"></path>
  <R x1={60} y1={50} x2={180} y2={50} color="azul" pieza="rs" />
  <Et x={120} y={30} t={c.rot('rs')} ancla="middle" color="azul" />
  <path class="hilo" d={`M180 50 H${conCarga ? 360 : fin}`} data-red="a"></path>
  <path class="hilo" d={`M40 230 H${fin}`} data-red="0"></path>
  <circle class="nodo" cx="210" cy="50" r="4.5" data-red="a"></circle>
  <circle class="nodo" cx="210" cy="230" r="4.5" data-red="0"></circle>
  <R x1={210} y1={50} x2={210} y2={230} color="naranja" pieza="rp" />
  <Et x={224} y={136} t={c.simT('rp')} color="naranja" />
  <Et x={224} y={156} t={c.val('rp')} color="naranja" peq />
  <FuenteI x={300} y1={230} y2={50} pieza="corriente" nodos={['0', 'a']} />
  <circle class="nodo" cx="300" cy="50" r="4.5" data-red="a"></circle>
  <circle class="nodo" cx="300" cy="230" r="4.5" data-red="0"></circle>
  <Et x={324} y={146} t={c.val('corriente')} />
  <circle class="borne" cx="350" cy="50" r="5"></circle>
  <circle class="borne" cx="350" cy="230" r="5"></circle>
  {#if conCarga}
    {#if c.tiene('interruptor')}
      <Interruptor x1={360} y1={50} x2={410} y2={50} {cerrado} color="verde" pieza="interruptor" />
    {:else}
      <path class="hilo" d="M360 50 H410" data-red="a"></path>
    {/if}
    <path class="hilo" d="M410 50 H430" data-red={cerrado ? 'a' : undefined}></path>
    <R x1={430} y1={50} x2={430} y2={230} color="verde" fantasma={!cerrado} pieza="carga" />
    {#if cerrado}
      <Et x={444} y={136} t={c.simT('carga')} color="verde" />
      <Et x={444} y={156} t={c.val('carga')} color="verde" peq />
    {/if}
  {/if}
</Lienzo>
