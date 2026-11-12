<script lang="ts">
  // Schematic «regulador-lineal» (esquema.ts): V_in on the left and the input rail along the top to the pass
  // transistor; the error amplifier under the rail (+ from the reference battery, − from the divider's tap, its output
  // to the base); the output rail with the divider R₁–R₂ and, through the switch, the load.
  import type { PropsDibujo } from '../dibujos';
  import AO from '../kit/AO.svelte';
  import Et from '../kit/Et.svelte';
  import Interruptor from '../kit/Interruptor.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Npn from '../kit/Npn.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
  const cerrado = $derived(c.cerrado('interruptor'));
  const divisor = $derived(c.tiene('r1'));
  const d = (s: number) => `${s.toFixed(2)}s`;
</script>

<Lienzo {descripcion} ancho={480} alto={260}>
  <path class="flujo" d="M30 240 V40 H282 V120 H350" style:animation-duration={d(dur)} data-medidor="vmi"></path>
  {#if cerrado}<path class="flujo" d="M350 120 H410 V240 H350" style:animation-duration={d(dur)} data-medidor="vml"></path>{/if}
  <path class="flujo" d={divisor ? 'M350 120 V240 H30' : 'M350 240 H30'} style:animation-duration={d(dur)} data-medidor="vmi"></path>
  <Pila x={30} y1={240} y2={40} pieza="entrada" nodos={['0', 'in']} />
  <Et x={44} y={170} t={c.val('entrada')} peq />
  <path class="hilo" d="M30 40 H282" data-red="in"></path>
  <Npn x={270} y={80} />
  {#if c.tiene('dropout')}<Et x={300} y={76} t={[{ t: 'txt', s: 'V' }, { t: 'sub', s: 'do' }, { t: 'txt', s: ` ${c.val('dropout')}` }]} peq />{/if}
  <AO x={150} y={120} masArriba />
  <path class="hilo" d="M210 120 H222 V80 H236" data-red="b"></path>
  <Pila x={100} y1={240} y2={100} pieza="ref" nodos={['0', 'ref']} />
  <path class="hilo" d="M100 100 H150" data-red="ref"></path>
  <Et x={118} y={210} t={[{ t: 'txt', s: 'V' }, { t: 'sub', s: 'ref' }, { t: 'txt', s: ` ${c.val('ref')}` }]} peq />
  <path class="hilo" d="M282 120 H440" data-red="out"></path>
  <circle class="nodo" cx="350" cy="120" r="4.5" data-red="out"></circle>
  {#if divisor}
    <R x1={350} y1={120} x2={350} y2={180} color="azul" pieza="r1" />
    <Et x={336} y={154} t={c.rot('r1')} ancla="end" color="azul" peq />
    <R x1={350} y1={180} x2={350} y2={240} color="azul" pieza="r2" />
    <Et x={336} y={218} t={c.rot('r2')} ancla="end" color="azul" peq />
    <circle class="nodo" cx="350" cy="180" r="4.5" data-red="fb"></circle>
    <path class="hilo" d="M350 180 H130 V140 H150" data-red="fb"></path>
  {:else}
    <path class="hilo" d="M350 120 V180 H130 V140 H150" data-red="out"></path>
  {/if}
  <circle class="nodo" cx="410" cy="120" r="4.5" data-red="out"></circle>
  <Interruptor x1={410} y1={120} x2={410} y2={165} {cerrado} color="verde" pieza="interruptor" />
  <R x1={410} y1={165} x2={410} y2={240} color="verde" fantasma={!cerrado} pieza="carga" />
  {#if cerrado}
    <Et x={424} y={196} t={c.simT('carga')} color="verde" peq />
    <Et x={424} y={214} t={c.val('carga')} color="verde" peq />
  {/if}
  <circle class="borne" cx="440" cy="120" r="5"></circle>
  <Et x={440} y={104} t={[{ t: 'txt', s: 'V' }, { t: 'sub', s: 'out' }]} ancla="middle" />
  <path class="hilo" d="M30 240 H410" data-red="0"></path>
</Lienzo>
