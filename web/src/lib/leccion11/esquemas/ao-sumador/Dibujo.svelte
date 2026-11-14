<script lang="ts">
  // Schematic «ao-sumador» (esquema.ts): input 1 on the left with R₁ along the top to the − input (the node N); inputs
  // 2 and 3 below, each with its resistor to a bus that goes up to N; R_f above from N to the output; the + input to
  // ground.
  import type { PropsDibujo } from '../dibujos';
  import AO from '../kit/AO.svelte';
  import Entrada from '../kit/Entrada.svelte';
  import Et from '../kit/Et.svelte';
  import EtiquetasAO from '../kit/EtiquetasAO.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import Pila from '../kit/Pila.svelte';
  import R from '../kit/R.svelte';
  let { c, descripcion }: PropsDibujo = $props();
  const tres = $derived(c.tiene('entrada3'));
</script>

<Lienzo {descripcion} ancho={480} alto={260}>
  <path class="flujo" d="M40 240 V110 H200" data-medidor="vm1"></path>
  <path class="flujo" d="M100 240 V170 H200 V110" data-medidor="vm2"></path>
  {#if tres}<path class="flujo" d="M150 240 V210 H200 V170" data-medidor="vm3"></path>{/if}
  <path class="flujo" d="M200 110 V40 H340 V130" data-medidor="vmf"></path>
  <Entrada {c} x={40} y1={240} y2={110} />
  <EtiquetasAO {c} x={2} y={92} />
  <path class="hilo" d="M40 110 H70" data-red="in"></path>
  <R x1={70} y1={110} x2={160} y2={110} color="azul" pieza="r1" />
  <Et x={115} y={92} t={c.rot('r1')} ancla="middle" color="azul" />
  <Pila x={100} y1={240} y2={170} pieza="entrada2" nodos={['0', 'in2']} />
  <Et x={104} y={192} t={c.val('entrada2')} peq />
  <path class="hilo" d="M100 170 H110" data-red="in2"></path>
  <R x1={110} y1={170} x2={190} y2={170} color="azul" pieza="r2" />
  <Et x={150} y={152} t={c.rot('r2')} ancla="middle" color="azul" peq />
  {#if tres}
    <Pila x={150} y1={240} y2={210} pieza="entrada3" nodos={['0', 'in3']} />
    <Et x={134} y={236} t={c.val('entrada3')} ancla="end" peq />
    <path class="hilo" d="M150 210 H151" data-red="in3"></path>
    <R x1={151} y1={210} x2={200} y2={210} color="azul" pieza="r3" />
    <Et x={176} y={198} t={c.simT('r3')} ancla="middle" color="azul" peq />
    <path class="hilo" d="M200 210 V170" data-red="mn"></path>
  {/if}
  <path class="hilo" d="M160 110 H250 M190 170 H200 V110 M200 110 V40 H220" data-red="mn"></path>
  <circle class="nodo" cx="200" cy="110" r="4.5" data-red="mn"></circle>
  {#if tres}<circle class="nodo" cx="200" cy="170" r="4.5" data-red="mn"></circle>{/if}
  <R x1={220} y1={40} x2={320} y2={40} color="naranja" pieza="rf" />
  <Et x={270} y={22} t={c.rot('rf')} ancla="middle" color="naranja" />
  <path class="hilo" d="M320 40 H340 V130 M310 130 H440" data-red="out"></path>
  <circle class="nodo" cx="340" cy="130" r="4.5" data-red="out"></circle>
  <AO x={250} y={130} />
  <path class="hilo" d="M250 150 H230 V240" data-red="0"></path>
  <EtiquetasAO {c} x={262} y={190} ao />
  <circle class="borne" cx="440" cy="130" r="5"></circle>
  <Et x={440} y={114} t={[{ t: 'txt', s: 'v' }, { t: 'sub', s: 'o' }]} ancla="middle" />
  <path class="hilo" d="M40 240 H440" data-red="0"></path>
  <circle class="borne" cx="440" cy="240" r="5"></circle>
</Lienzo>
