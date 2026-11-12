<script lang="ts">
  // Schematic «ao-integrador» (esquema.ts): the input source on the left, R along the row to the − input (the node N),
  // C above from N to the output and, with R_f, R_f in parallel above it; the + input to ground.
  import type { PropsDibujo } from '../dibujos';
  import AO from '../kit/AO.svelte';
  import C from '../kit/C.svelte';
  import Entrada from '../kit/Entrada.svelte';
  import Et from '../kit/Et.svelte';
  import EtiquetasAO from '../kit/EtiquetasAO.svelte';
  import Lienzo from '../kit/Lienzo.svelte';
  import R from '../kit/R.svelte';
  let { c, dur, descripcion }: PropsDibujo = $props();
</script>

<Lienzo {descripcion} ancho={480} alto={260}>
  <path class="flujo" d="M40 240 V110 H200 V66 H340 V130" style:animation-duration={`${dur.toFixed(2)}s`} data-medidor="vmi"></path>
  <Entrada {c} x={40} y1={240} y2={110} />
  <EtiquetasAO {c} x={64} y={170} />
  <path class="hilo" d="M40 110 H70" data-red="in"></path>
  <R x1={70} y1={110} x2={160} y2={110} color="azul" pieza="r" />
  <Et x={115} y={92} t={c.rot('r')} ancla="middle" color="azul" />
  <path class="hilo" d="M160 110 H250 M200 110 V66 H220" data-red="mn"></path>
  <circle class="nodo" cx="200" cy="110" r="4.5" data-red="mn"></circle>
  <C x1={220} y1={66} x2={320} y2={66} color="naranja" pieza="c" />
  <Et x={270} y={44} t={c.rot('c')} ancla="middle" color="naranja" peq />
  {#if c.tiene('rf')}
    <path class="hilo" d="M200 66 V24 H220" data-red="mn"></path>
    <circle class="nodo" cx="200" cy="66" r="4.5" data-red="mn"></circle>
    <R x1={220} y1={24} x2={320} y2={24} color="naranja" pieza="rf" />
    <Et x={360} y={28} t={c.rot('rf')} color="naranja" peq />
    <path class="hilo" d="M320 24 H340 V66" data-red="out"></path>
    <circle class="nodo" cx="340" cy="66" r="4.5" data-red="out"></circle>
  {/if}
  <path class="hilo" d="M320 66 H340 V130 M310 130 H440" data-red="out"></path>
  <circle class="nodo" cx="340" cy="130" r="4.5" data-red="out"></circle>
  <AO x={250} y={130} />
  <path class="hilo" d="M250 150 H230 V240" data-red="0"></path>
  <EtiquetasAO {c} x={262} y={190} ao />
  <circle class="borne" cx="440" cy="130" r="5"></circle>
  <Et x={440} y={114} t={[{ t: 'txt', s: 'v' }, { t: 'sub', s: 'o' }]} ancla="middle" />
  <path class="hilo" d="M40 240 H440" data-red="0"></path>
  <circle class="borne" cx="440" cy="240" r="5"></circle>
</Lienzo>
